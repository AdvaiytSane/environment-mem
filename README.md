# environment-mem

Connect a coding agent to Memorable through two operations: **`store` and `recall`**. Developers choose where to capture work and where to use recalled context. Memorable performs its existing extraction and retrieval.

This repository's package and executable remain named **`headstart`**. The connection layer is available from **`headstart/memorable`** on this branch; it wraps the existing Memorable CLI. This is not a newly published npm release or a deployed HTTP SDK.

## What lives where

| Component | Responsibility | Status |
|---|---|---|
| This repository | Importable connector, coding-agent hook adapter, integration documentation, verification evidence | Branch implementation |
| [Memorable upstream](https://github.com/NIkhil-cmd-cmd/memorable-gbrain) | CLI, shared procedure/retrieval code, extraction service and other Memorable applications | Separate private monorepo; not just a GBrain plugin |
| Existing `memorable-cli` | `ingest -`, `recall`, `show`, `chain`, and local MCP access | Published CLI; see [CLI docs](https://www.memorable.sh/docs/cli) |
| Existing HTTP API | Extraction and query embeddings | [Documented API](https://www.memorable.sh/docs/api); extraction response alone is not a durable storage receipt |
| HTTP recall transport | Remote store/read contract without a local CLI process | Pending upstream review, deployment, documentation and a real round trip |

The prior Headstart local lexical engine and evaluation tools remain available under `HEADSTART_BACKEND=local`, the default. They are separate from Memorable's retrieval. Existing local evaluation results do not verify the new connector or hosted retrieval.

The current [SDK plan](docs/SDK-PLAN.md) supersedes the architecture direction in [the historical demo plan](docs/PLAN.html). See [connections](docs/CONNECTIONS.md) for setup and [verification](docs/VERIFICATION.md) for what counts as evidence.

## Use the two operations

Use Node.js 24 or newer. Install this checkout as a local dependency in the consuming project:

```sh
npm install /path/to/environment-mem
```

Installation builds JavaScript entrypoints for the SDK and CLI; TypeScript source remains available for types. For development in the checkout, run `npm run build` before using `bin/headstart`.

Install/authenticate `memorable-cli` using the [official integration instructions](https://www.memorable.sh/docs/integrate). The SDK uses the configured CLI's credentials and storage; it does not provision a database or change its backend.

```ts
import { createMemorable } from 'headstart/memorable';

const memory = createMemorable({ command: 'memorable', cwd: process.cwd() });

// Before the agent starts work. The caller chooses how to use this text.
const recalled = await memory.recall({ query: 'Add a retry regression test' });
console.log(recalled.stdout);

// After this task finishes and tool results have been joined to their calls.
const stored = await memory.store({
  session_id: 'session-1',
  workflow_id: 'run-1',
  task_description: 'Add a retry regression test',
  harness: 'codex',
  tool_calls: [
    { name: 'exec_command', input: { cmd: 'npm test' }, result: { exit_code: 0 } },
  ],
});
console.log(stored.stdout);
```

The small trace above illustrates the envelope only; it is not evidence of a captured agent run or a useful learned procedure. Pass the actual completed calls for the whole task.

`store()` runs `memorable ingest -`. A successful `command_completed` result means the CLI exited successfully; it does **not** promise durable remote storage, extraction admission, or index readiness. `recall({ query })` runs CLI recall and returns its text; `recall({ procedureId })` runs `show`. It does **not** return the original full trace. No undocumented JSON output is assumed.

## Connect hooks

Run these commands from the agent's project, using this checkout's executable:

```sh
node /path/to/environment-mem/src/cli.ts init --backend memorable
node /path/to/environment-mem/src/cli.ts install
```

The installer pins the absolute Node executable and CLI path, preserves unrelated hooks and rejects malformed settings. It writes project Claude-format hooks; `install --all` also writes the configured user-level Devin and Codex hook files. Verify the target host/version and enablement before relying on an installer result.

`init --backend memorable` saves the project setting. `HEADSTART_BACKEND` overrides it. Use `HEADSTART_MEMORABLE_BIN` for the Memorable executable, `HEADSTART_MEMORABLE_ARGS` for a JSON array of launcher arguments, and `HEADSTART_HARNESS` for the actual tool schema (`headstart` by default). See [connection settings](docs/CONNECTIONS.md).

The adapter's lifecycle is: prompt starts a run and recalls a candidate listing → completed tool events are captured → task stop submits that run. It forwards the captured calls rather than the local extracted procedure and hashes session/run IDs into stable CLI-safe identities. Missing tool outcomes remain unknown. The listing is injected as reference data; use `headstart recall --procedure <slug>` to read a full rendered procedure. It is still not the original trace.

Failed submissions remain in the local outbox. `headstart connection` reports pending submissions; `headstart sync` explicitly retries them. A completed CLI command may itself have queued work, so an empty local outbox is not a durable-storage guarantee. A timeout can occur after the upstream operation has taken effect.

For a custom agent, call the SDK from your own lifecycle directly. You do not need the hook installer, a dashboard, or a pasted sample trace.

Use the [one-prompt integration handoff](docs/AGENT-SETUP.md) to have a coding agent connect another application and report what it actually verified.

## Evidence and limits

The [September 19 live check](docs/verification/2026-09-19.md) reached the extraction service, persisted a procedure locally and read it back in fresh CLI processes. Close wording and an exact filename retrieved it; a paraphrase missed. The hook returned context, but native Claude verification was blocked by revoked authentication before tools ran. Hosted durability, HTTP recall and native context consumption remain unverified. [VERIFICATION.md](docs/VERIFICATION.md) defines the remaining evidence gates.

Remaining contract work includes accepted-trace preservation, explicit metadata/compatibility rules, precondition and outcome evidence, durable store receipts, and structured HTTP recall. Those belong in coordinated upstream changes before the connector can promise them.

Capture currently retains only a 300-character result snippet plus explicit outcome fields. Events without stable IDs cannot be reliably deduplicated; overlapping tasks need explicit run IDs. Journal writes have no cross-process lock. Deterministic replay and task-success verification are not provided.

The retained `headstart eval` / `report` tools and historical reports evaluate the previous local Headstart engine. They do not establish retrieval quality or a performance benefit for this connector.
