#!/usr/bin/env node
// A small tool-using agent on Grok (xAI), OpenAI-compatible chat completions.
// No dependencies. Recalls the closest procedure before it starts, records
// every tool call, and pushes the finished session to the hosted store.
//
// Usage: XAI_API_KEY=... node examples/grok-agent.mjs "<task>"

import { execFileSync, execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const API_URL = 'https://api.x.ai/v1/chat/completions';
const MODEL = process.env.XAI_MODEL || 'grok-4';
const CLI_PATH = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
const MAX_TURNS = 25;
const RUN_COMMAND_TIMEOUT_MS = 60_000;

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read a text file, relative to the current directory.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'File path, relative to the current directory.' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'List the entries of a directory, relative to the current directory.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Directory path, relative to the current directory. Defaults to "."' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description: 'Run a shell command in the current directory. 60 second timeout.',
      parameters: {
        type: 'object',
        properties: { command: { type: 'string', description: 'The shell command to run.' } },
        required: ['command'],
      },
    },
  },
];

function readFileTool(input) {
  const p = resolve(process.cwd(), input.path);
  return readFileSync(p, 'utf8');
}

function listFilesTool(input) {
  const p = resolve(process.cwd(), input.path || '.');
  return readdirSync(p, { withFileTypes: true })
    .map((e) => `${e.isDirectory() ? 'd' : 'f'} ${e.name}`)
    .join('\n');
}

function runCommandTool(input) {
  try {
    const out = execSync(input.command, { cwd: process.cwd(), timeout: RUN_COMMAND_TIMEOUT_MS, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    return { exit_code: 0, output: out };
  } catch (e) {
    return { exit_code: typeof e.status === 'number' ? e.status : 1, output: `${e.stdout ?? ''}${e.stderr ?? ''}` || String(e.message ?? e) };
  }
}

/** Runs one tool call, returns { name, input, result: { exit_code|ok } } for the recorded trace and the text to hand back to the model. */
function runTool(name, input) {
  try {
    if (name === 'read_file') { const text = readFileTool(input); return { call: { name, input, result: { ok: true } }, text }; }
    if (name === 'list_files') { const text = listFilesTool(input); return { call: { name, input, result: { ok: true } }, text }; }
    if (name === 'run_command') { const r = runCommandTool(input); return { call: { name, input, result: { exit_code: r.exit_code } }, text: r.output }; }
    return { call: { name, input, result: { ok: false } }, text: `unknown tool: ${name}` };
  } catch (e) {
    return { call: { name, input, result: { ok: false } }, text: String(e.message ?? e) };
  }
}

/** `headstart recall "<task>" --json`, spawned against this repo's cli.ts but
 * in the caller's own cwd, so it reads that repo's local store. Failure (no
 * store yet, or the memorable backend, which refuses --json) is swallowed:
 * a procedure to hand the model is a bonus, not a requirement. */
function recallProcedure(task) {
  try {
    const out = execFileSync('node', [CLI_PATH, 'recall', task, '--json'], { cwd: process.cwd(), encoding: 'utf8', timeout: 15_000 });
    const hits = JSON.parse(out);
    return Array.isArray(hits) && hits.length ? hits[0] : null;
  } catch {
    return null;
  }
}

function renderProcedureBlock(hit) {
  const p = hit.procedure;
  const steps = (p.steps ?? []).map((s, i) => `${i + 1}. ${s.action}${s.command ? `: ${s.command}` : s.target ? `: ${s.target}` : ''}`);
  return [
    'A procedure that worked for a similar task:',
    p.title,
    ...steps,
  ].join('\n');
}

function systemPrompt(task) {
  const base = 'You are a coding agent working in the current directory. Use the read_file, list_files and run_command tools to complete the task. Reply with plain text, no tool calls, once the task is done.';
  const hit = recallProcedure(task);
  if (!hit) return base;
  return `${base}\n\n${renderProcedureBlock(hit)}`;
}

async function callGrok(apiKey, messages) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: MODEL, messages, tools: TOOLS, tool_choice: 'auto' }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`xAI API error ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

/** Builds the ExtractPayload the extraction API takes, from a finished
 * session's recorded tool calls and the API's own usage totals. Exported so
 * tests can check its shape without any network call. */
export function buildExtractPayload({ sessionId, prompt, toolCalls, usage, model, durationMs }) {
  return {
    session_id: sessionId,
    prompt,
    harness: 'grok',
    tool_calls: toolCalls,
    cost: {
      input_tokens: usage?.prompt_tokens ?? 0,
      output_tokens: usage?.completion_tokens ?? 0,
      model,
      duration_ms: durationMs,
    },
  };
}

export async function runGrokAgent(task, { apiKey = process.env.XAI_API_KEY } = {}) {
  if (!apiKey) throw new Error('set XAI_API_KEY');
  const sessionId = randomUUID();
  const startedAt = Date.now();
  const messages = [
    { role: 'system', content: systemPrompt(task) },
    { role: 'user', content: task },
  ];
  console.log(`session ${sessionId}: ${task}`);

  const toolCalls = [];
  let usage;
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const resp = await callGrok(apiKey, messages);
    usage = resp.usage ?? usage;
    const choice = resp.choices?.[0];
    const message = choice?.message;
    if (!message) throw new Error('no message in xAI response');
    const calls = message.tool_calls ?? [];
    if (!calls.length) {
      console.log(message.content ?? '');
      break;
    }
    messages.push({ role: 'assistant', content: message.content ?? null, tool_calls: calls });
    for (const call of calls) {
      const name = call.function?.name;
      let input = {};
      try { input = JSON.parse(call.function?.arguments ?? '{}'); } catch { /* malformed args, treat as empty */ }
      console.log(`tool: ${name} ${JSON.stringify(input)}`);
      const { call: recorded, text } = runTool(name, input);
      toolCalls.push(recorded);
      messages.push({ role: 'tool', tool_call_id: call.id, content: text.slice(0, 20_000) });
    }
  }

  const durationMs = Date.now() - startedAt;
  const payload = buildExtractPayload({ sessionId, prompt: task, toolCalls, usage, model: MODEL, durationMs });

  const dir = resolve(process.cwd(), '.headstart');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `extract-${sessionId}.json`);
  writeFileSync(file, JSON.stringify(payload));
  console.log(`wrote ${file}`);
  console.log(`${toolCalls.length} tool calls recorded`);

  if (process.env.HEADSTART_API_URL && process.env.HEADSTART_API_KEY) {
    try {
      const out = execFileSync('node', [CLI_PATH, 'push', file], { cwd: process.cwd(), encoding: 'utf8' });
      process.stdout.write(out);
    } catch (e) {
      console.log(`push failed: ${e.stdout ?? e.message ?? e}`);
    }
  } else {
    console.log('HEADSTART_API_URL/HEADSTART_API_KEY not set, session not pushed');
  }

  return payload;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const task = process.argv.slice(2).join(' ');
  if (!task) { console.error('usage: node examples/grok-agent.mjs "<task>"'); process.exit(2); }
  runGrokAgent(task).catch((e) => { console.error(e.message ?? e); process.exit(1); });
}
