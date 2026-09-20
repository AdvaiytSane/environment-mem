# Memorable connections and DejaDo

`headstart` is the CLI; `dejado` is its alias.

Connect an agent to Memorable through two operations: **`store` and `recall`**. Developers choose where to capture work and where to use recalled context. Memorable performs its existing extraction and retrieval.

Use `headstart connect --repo /path/to/app --target application` for read-only
integration discovery. Add `--write` to create a versioned manifest and a handoff
skill for your coding assistant; it does not automatically wire application hooks.
Choose `--target coding-agent --agent claude|devin` for the assistant working on
the repo. [Connect setup and evidence stages](docs/CONNECT.md).

This repository's package and executable remain named **`headstart`**. The connection layer is available from **`headstart/memorable`** on this branch; it wraps the existing Memorable CLI. This is not a newly published npm release or a deployed HTTP SDK.

## Metadata-driven Browser Use integration

The new [metadata SDK](docs/METADATA-MEMORY.md) lets developers declare `filter`,
`semantic`, `context`, and `private` fields once, then use `store({id, trace,
metadata})` and `recall({query, metadata})`. The optional [Browser Use package](packages/browser-use/README.md)
captures actions and returns recalled references through the same Memorable CLI.

This path uses the existing encrypted local procedure store, production embedding
service and ranker. A real second Browser Use Agent recalled the first run using
a paraphrased task and received its reference in model messages. See the
[live evidence](docs/verification/2026-09-19-metadata-browser.md).
**Requires the companion private CLI patch; not yet published on npm.**

## What lives where

| Component | Responsibility | Status |
|---|---|---|
| This repository | Importable connector, coding-agent hook adapter, integration documentation, verification evidence | Branch implementation |
| Optional [Browser Use package](packages/browser-use/README.md) | Python capture and developer-defined metadata through native CLI | Local store/recall and live model context verified; companion CLI patch required |
| [Memorable upstream](https://github.com/NIkhil-cmd-cmd/memorable-gbrain) | CLI, shared procedure/retrieval code, extraction service and other Memorable applications | Separate private monorepo; not just a GBrain plugin |
| Existing `memorable-cli` | `ingest -`, `recall`, `show`, `chain`, and local MCP access | Published CLI; see [CLI docs](https://www.memorable.sh/docs/cli) |
| Existing HTTP API | Extraction and query embeddings | [Documented API](https://www.memorable.sh/docs/api); extraction response alone is not a durable storage receipt |
| HTTP recall transport | Remote store/read contract without a local CLI process | Pending upstream review, deployment, documentation and a real round trip |

The prior Headstart local lexical engine and evaluation tools remain available under `HEADSTART_BACKEND=local`, the default. They are separate from Memorable's retrieval. Existing local evaluation results do not verify the new connector or hosted retrieval.

The current [SDK plan](docs/SDK-PLAN.md) supersedes the architecture direction in [the historical demo plan](docs/PLAN.html). See [connections](docs/CONNECTIONS.md) for setup and [verification](docs/VERIFICATION.md) for what counts as evidence.

## Legacy extraction interface

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

## See it run

From this repo, three terminals. Every line is a real agent session in a fresh copy of `fixtures/repo` with the hooks on.

```
headstart console --live                                             # http://localhost:4177, one lane per run
headstart demo --agent devin --task bugfix-1                          # before and after, one command
headstart run --agent devin  --lane devin-cold  --task bugfix-1 --inject 0   # cold: nothing handed
headstart run --agent claude --lane claude-warm --task bugfix-1              # warm: handed what the cold run stored
headstart orchestrate --fresh                                        # six agents in three waves, hand-offs across Devin and Claude
```

`docs/DEMO.md` has the script and the measured numbers. `docs/ARCHITECTURE.png` is the picture.


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

The local DejaDo demo procedures live in `.headstart/procedures.jsonl`. On that separate local path, with `HEADSTART_API_URL` and `HEADSTART_API_KEY` set, every finished session is also posted to `POST /v1/extract` (tool calls, cost, what it was handed) and the enterprise dashboard reads those rows.

For a custom agent, call the SDK from your own lifecycle directly. You do not need the hook installer, a dashboard, or a pasted sample trace.

Platform packages remain optional. The core exports `loadAdapter` / `invokeAdapter`
from `headstart/adapters` and offers `headstart memory store|recall --adapter <file>`.
Developers can implement a local module with those two methods without changing
the main CLI. The [Browser Use add-on](packages/browser-use/README.md) adds no browser dependency
to the core. Its current metadata client calls the native Memorable CLI directly.
Its retained experimental HTTP driver
targets the browser-specific backend contract, because published `memorable ingest`
does not preserve browser targets and input shapes. This does not establish a
general deployed HTTP recall API.

The [Devin plan](docs/DEVIN-INTEGRATION-PLAN.md) distinguishes native CLI hooks
from hosted session APIs. The [integration shortlist](docs/INTEGRATION-SHORTLIST.md)
covers AI SDK, LangChain, Mastra and Pydantic AI without requiring Browser Use.

Use the [one-prompt integration handoff](docs/AGENT-SETUP.md) to have a coding agent connect another application and report what it actually verified.

## Evidence and limits

The [Browser Use live report](docs/verification/2026-09-19-browser-use.md) records
a real public website run with captured navigation and click targets, a retained
outbox, independently checked page contents and explicit omissions. The initial
scripted check was followed by a successful OpenAI-driven Browser Use Agent run.
The earlier browser HTTP experiment remains blocked by authorization and its
advisory-retrieval contract. The newer metadata CLI path completed the local
round trip; see the metadata evidence above.

The [September 19 live check](docs/verification/2026-09-19.md) reached the extraction service, persisted a procedure locally and read it back in fresh CLI processes. Close wording and an exact filename retrieved it; a paraphrase missed. The hook returned context, but native Claude verification was blocked by revoked authentication before tools ran. Hosted durability, HTTP recall and native context consumption remain unverified. [VERIFICATION.md](docs/VERIFICATION.md) defines the remaining evidence gates.

The metadata CLI path now preserves accepted traces, enforces metadata definitions, and returns local storage receipts. Structured HTTP recall, hosted storage, richer precondition checking and a published compatible CLI release remain upstream work.

The legacy coding hook capture retains only a 300-character result snippet plus explicit outcome fields. Events without stable IDs cannot be reliably deduplicated; overlapping tasks need explicit run IDs. Journal writes have no cross-process lock. Deterministic replay and task-success verification are not provided.

The retained `headstart eval` / `report` tools and historical reports evaluate the previous local Headstart engine. They do not establish retrieval quality or a performance benefit for this connector.
