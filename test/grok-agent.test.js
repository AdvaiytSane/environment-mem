import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExtractPayload } from '../examples/grok-agent.mjs';

test('buildExtractPayload shapes an ExtractPayload from a finished session, no network', () => {
  const toolCalls = [
    { name: 'read_file', input: { path: 'src/cli/args.js' }, result: { ok: true } },
    { name: 'run_command', input: { command: 'npm test' }, result: { exit_code: 0 } },
  ];
  const payload = buildExtractPayload({
    sessionId: 'abc-123',
    prompt: 'add a --json flag to the stats command',
    toolCalls,
    usage: { prompt_tokens: 42, completion_tokens: 17 },
    model: 'grok-4',
    durationMs: 5000,
  });

  assert.equal(payload.session_id, 'abc-123');
  assert.equal(payload.prompt, 'add a --json flag to the stats command');
  assert.equal(payload.harness, 'grok');
  assert.deepEqual(payload.tool_calls, toolCalls);
  assert.deepEqual(payload.cost, { input_tokens: 42, output_tokens: 17, model: 'grok-4', duration_ms: 5000 });
});

test('buildExtractPayload defaults token counts to 0 when usage is missing', () => {
  const payload = buildExtractPayload({ sessionId: 's', prompt: 'x', toolCalls: [], usage: undefined, model: 'grok-4', durationMs: 0 });
  assert.equal(payload.cost.input_tokens, 0);
  assert.equal(payload.cost.output_tokens, 0);
});
