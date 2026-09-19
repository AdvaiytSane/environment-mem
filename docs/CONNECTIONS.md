# Connecting an agent to Memorable

This branch provides a Node.js connection to the existing Memorable CLI. The current transport needs a machine that can run the CLI and access its configured credentials/store. HTTP-only integration is pending the documented, deployed upstream read contract.

## 1. Choose the connection

| Agent environment | Connection | What you own |
|---|---|---|
| Node.js coding loop | Import `createMemorable` from `headstart/memorable` | Call `recall` before the task and `store` after capturing its actual calls/results |
| Host with command hooks | Headstart hook adapter with backend `memorable` | Enable compatible hook events, pass stable identifiers and verify actual delivery |
| Any program that can run a command | Call the published CLI directly | Run `memorable recall "task"` before work and pipe the extraction envelope to `memorable ingest -` afterward |
| MCP client | Existing `memorable mcp` | Configure the client and confirm which tools the selected CLI version exposes; read access does not automatically capture writes |
| HTTP-only or browser environment | Future HTTP transport | Wait for verified, documented upstream store/read semantics; extraction alone is insufficient |

The CLI is published separately as [memorable-cli](https://www.npmjs.com/package/memorable-cli). Follow [Memorable's installation/authentication instructions](https://www.memorable.sh/docs/integrate). Pin the executable version for a reproducible integration. This connector does not install, log in, or provision a backend for you.

## 2. Configure the SDK

Use Node.js 24+. Install this repository checkout in the consuming project and import `headstart/memorable`:

```ts
import { createMemorable } from 'headstart/memorable';

const memory = createMemorable({
  command: 'memorable',
  cwd: process.cwd(),
  timeoutMs: 30_000,
});

const context = await memory.recall({ query: 'Fix duplicate payment retries' });
// Decide whether/how to place context.stdout into the agent's context.

const procedure = await memory.recall({ procedureId: 'an-existing-procedure-id' });
// procedure.stdout is the CLI's display text, not an original trace object.
```

`command` is an executable, not a shell command string. Use `args` for a launcher prefix, for example `{ command: 'npx', args: ['--yes', 'memorable-cli@0.5.18'] }`. A pinned package version must exist and support the commands you use. Downloading through `npx` may exceed a short hook deadline; a preinstalled executable is preferable for hooks. Use `cwd` to choose the working directory, `env` for child-process configuration and `timeoutMs` for the connector deadline.

For the Headstart CLI and hook adapter, use these settings in the agent process:

| Setting | Meaning |
|---|---|
| `HEADSTART_BACKEND` | `local` or `memorable`; overrides the project's `.headstart/config.json` |
| `HEADSTART_MEMORABLE_BIN` | Executable path; defaults to `memorable` on PATH |
| `HEADSTART_MEMORABLE_ARGS` | JSON string array of prefix arguments, such as `["/path/to/memorable-cli.js"]` when the executable is Node |
| `HEADSTART_HARNESS` | Tool schema sent during capture forwarding; defaults to `headstart` |
| `HEADSTART_BIN` | Optional hook-install command override; the installer normally pins the absolute Node and Headstart CLI paths itself |

`headstart init --backend memorable` writes the project backend setting, so the environment override is optional. Set `HEADSTART_HARNESS=claude-code` or `codex` only when the tool names and inputs actually use that schema. These adapter environment settings do not replace explicit `createMemorable()` options in a custom loop.

The accepted store envelope follows the existing extraction contract:

```ts
await memory.store({
  session_id: sessionId,
  workflow_id: runId,
  task_description: task,
  harness: 'codex',
  tool_calls: completedCalls.map(call => ({
    name: call.name,
    input: call.input,
    ...(call.result ? { result: call.result } : {}),
  })),
});
```

Send actual tool names and input shapes. `harness` describes their schema; do not relabel a custom tool as Claude or Codex merely to obtain better extraction. Unknown tools can be accepted without being understood as read/edit/test operations. A generic tool mapping and richer outcome/metadata definition remain planned contract work.

Direct SDK session/workflow IDs must be 1–200 letters, numbers, dots, underscores or hyphens, without a leading hyphen. The hook adapter hashes its native session/run IDs into stable accepted identities; this does not add server-side idempotency. The current envelope accepts 1–2,000 calls and at most 8 MB of serialized input.

The connector reports stdout/stderr and command completion. Treat nonzero exits/timeouts as errors; do not interpret them as “no matches.” A successful `store` command does not prove durable hosted storage. The process deadline terminates the launched process group where supported, but an upstream store can already have taken effect before timeout; retrying is not guaranteed exactly once. `recall({ query, mode: 'single' })` and `recall({ query, mode: 'chain' })` select the existing CLI paths; they do not expose vector/keyword algorithm switches.

With the Memorable backend, `headstart recall --procedure <slug>` reads the full rendered procedure. `headstart recall --json` is rejected because the upstream CLI response is text. The prompt hook injects a bounded candidate listing as reference material; it does not automatically fetch or execute every listed procedure.

## 3. Place capture and recall at real boundaries

Use this lifecycle in a custom loop:

1. Assign a unique run ID for one task. Keep the session ID separately because a session can contain several tasks.
2. Call `recall` with the new task before its first tool action. The application decides whether to inject, display or ignore the text.
3. Capture each tool call and join its eventual result using a stable call ID. Keep failed and unknown results. A missing exit code is not zero.
4. At the task boundary, wait for calls that belong to the run to settle or label them incomplete. Apply the application's redaction policy and call `store` with the real trace envelope.
5. Record the connection outcome. Retry only with an understanding of the selected upstream CLI's behavior; this transport does not promise server-side idempotency or durable acceptance.

The existing hook adapter uses `UserPromptSubmit`, `PostToolUse`, `PostToolUseFailure` and `Stop`/`SessionEnd`. It can also handle `SessionStart` for the legacy local backend. Claude's installer includes its [documented failure event](https://code.claude.com/docs/en/hooks#posttoolusefailure); registration in the separate Codex/Devin files is not assumed. Pass native `session_id`, run/turn identifiers, `tool_use_id`/call identifiers and explicit tool results where your host provides them. It forwards the captured calls and outcomes at task stop, rather than serializing the reduced local procedure as a new trace. Native events differ between harnesses; do not assume identical JSON across hosts.

Run `headstart init --backend memorable` in the project, then `headstart install`. The installer pins absolute, quoted runtime/CLI paths, preserves unrelated hooks and rejects malformed settings. It writes project Claude-format hooks; `install --all` additionally writes the configured user-level Devin and Codex locations. Installation changes configuration; only a native-agent run proves capture and context delivery. Avoid simultaneously running two adapters that ingest the same events.

The adapter writes a local outbox before forwarding. Failed calls remain pending; `headstart connection` reports them and `headstart sync` explicitly retries all pending runs, so a rejected run cannot block later ones. Partial failure returns a nonzero exit with completed/failed counts; successful deliveries keep their receipts. Successful CLI completion clears that payload from the adapter's pending view, but the CLI may itself have queued work. Neither an empty pending count nor a completed receipt proves durable remote storage or exactly-once delivery.

The local journal and extracted procedure are reduced representations: `response_head` retains at most 300 characters, alongside explicit outcome fields. Arguments and snippets can contain project data, so restrict capture inputs according to your policy before routing them. Events without stable IDs cannot be reliably deduplicated. Overlapping tasks require explicit run IDs, and the journal has no cross-process write lock. A result snippet or coarse `{ ok, exit_code }` is not full-output preservation. Arbitrary successful commands are not task verifiers.

## 4. Debug the actual connection

| Observation | Check |
|---|---|
| CLI works in a terminal but not a hook | The agent's PATH, selected executable, working directory, inherited environment, credentials and timeout |
| Nothing is recalled | Confirm the same configured Memorable store is being read; inspect CLI output and admission/index status separately |
| Headstart returns only local facts | Check backend selection; `local` is the default and is a different retrieval engine |
| Several prompts become one procedure | Check run boundaries and native prompt event delivery, then compare the journal to the native transcript |
| Failure looks successful | Inspect explicit result fields and joins; missing results must remain unknown |
| Repeated stop creates duplicates | Inspect event/run IDs and delivery logs; local event deduplication does not establish remote idempotency |
| Submission failed or timed out | Inspect `headstart connection` and the local outbox; use `headstart sync` for an explicit retry, accounting for possible upstream side effects |
| HTTP extraction succeeds but recall fails | Inspect the deployed API version and documentation; the CLI transport is not an HTTP read endpoint |

Do not include credentials or raw private transcripts in bug reports. Record executable/package versions, adapter revision, sanitized event shapes, command status and a minimal reproduction. See [VERIFICATION.md](VERIFICATION.md) for the end-to-end proof required before calling a harness supported.
