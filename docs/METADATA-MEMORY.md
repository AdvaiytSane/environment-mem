# Metadata-driven store and recall

Implemented on this branch, September 19, 2026. Requires the companion native
Memorable CLI patch described below. This feature is **not in the published npm
CLI release**. No backend deployment or new database is involved.

## Define once; call twice

```ts
import { createMemorable } from 'headstart/memorable';

const memory = createMemorable({
  command: 'memorable', // Must be a build supporting memorable.memory.v1.
  metadata: {
    project: { use: 'filter' },
    website: { use: 'filter' },
    task: { use: 'semantic' },
    workflow: { use: 'semantic' },
    steps: { use: 'semantic' },
    outcome: { use: 'filter' },
    verification: { use: 'context' },
    runNotes: { use: 'private' },
  },
  embedding: 'required', // Default. Refuse storage if embedding fails.
});

// Before a new run. Inject or otherwise use matches in your own application.
const recalled = await memory.recall({
  query: 'Move to the next page of the quote listing and count the entries',
  metadata: { project: 'quotes-demo', website: 'quotes.toscrape.com', outcome: 'verified' },
  limit: 3,
});

// After the run, use the real captured trace and independent outcome evidence.
await memory.store({
  id: runId, // Stable across retries, unique for different runs.
  trace: redactedTrace,
  metadata: {
    project: 'quotes-demo', website: 'quotes.toscrape.com',
    task: taskSummary, workflow: 'Navigate paginated quote listings',
    steps: observedStepSummaries,
    outcome: verification.ok ? 'verified' : 'unverified',
    verification, runNotes: privateNotes,
  },
});
```

Variables in this snippet are supplied by your application. The complete runnable
[Browser Use example](../packages/browser-use/examples/metadata_browser.py)
creates actual traces and verification evidence. To target a local CLI build, use
`command: '/path/to/node24'`, `args: ['/path/to/memorable/packages/cli/dist/cli.js']`.

| Role | Behavior |
|---|---|
| `filter` | Required at store and recall; exact, type-sensitive scalar equality before ranking. No query embedding is sent when there are no eligible records. |
| `semantic` | Included in document/query search text, embeddings and lexical ranking. |
| `context` | Stored and returned under `context`; excluded from search unless also semantic. |
| `private` | Stored locally, omitted from this recall response and search. Cannot combine with other roles. |

Use `use: ['filter', 'semantic']` when both behaviors are intended. Unknown
metadata fields are rejected. Field definitions are canonicalized and hashed;
changing a role changes the eligible schema. Re-store intentionally to migrate
records. Filter fields are application constraints, not tenant authorization.

## What is embedded and returned

Each memory gets one document embedding: canonical, labeled **semantic field
values**, including the developer-selected task, workflow and grounded step
summaries in this example. The raw trace, page DOM, screenshots, context-only,
filter-only and private fields are not embedded. The query is the recall query
plus supplied semantic fields. Both use the existing configured `/v1/embed`
service with document/query input roles. The live example used
`cf:@cf/baai/bge-m3`, 1,024 dimensions.

The existing CLI ranker combines lexical/identifier evidence and compatible-model
vector similarity after filtering. Existing relevance floors still apply. There
is no new graph engine or caller-selected retrieval algorithm. A score is a rank
signal, not a probability. Results can be empty.

`recall()` returns `{ matches, eligible, schema, embedding }`. Each match has
`id`, `procedureId`, `score`, `similarity`, `matchReasons`, a procedure summary,
the accepted JSON `trace`, nonprivate `metadata`, and its `context` projection.
`store()` returns a local receipt with the stable identity, schema hash, embedding
model/dimensions and `duplicate`. It writes and reads back through the existing
local procedure store. It does not synthesize a procedure by running coding-trace
extraction over arbitrary browser actions.

## Browser Use lifecycle

The optional Python package calls this same native CLI contract through
`MemorableMemory`. `BrowserMetadata` supplies the mapping callbacks; developers
can replace them without editing the core CLI.

1. Start on an application-approved page. Recall before constructing the Agent.
2. Render compatible, verified matches as bounded historical reference material.
3. Wrap the existing `Tools.act()` boundary. Retain action identity/order,
   before/after state, actual results and explicit unknown mappings.
4. Independently check the final page. Store the redacted trace plus metadata.
5. On a later run, recall again. The application decides how to use the trace.

The default renderer checks project, website, verified outcome and verification
evidence. It renders a restricted action vocabulary, never arbitrary notes or
literal typed values. A task verifier does not turn every unknown action into a
success. The example retains an `extract` action as unknown because the current
mapper cannot represent it fully. There is no automatic replay.

## Setup and limits

Build the companion **local private branch `codex/metadata-cli`**, commit
`68d941a`, in Memorable:

```sh
bun build packages/cli/src/cli.ts --target=node \
  --outfile packages/cli/dist/cli.js --external gbrain --external 'gbrain/*'
```

That patch adds `memorable memory store -` / `recall -`, taking
`{config:{metadata,embedding},request}` and returning the versioned
`memorable.memory.v1` JSON envelope. Configure existing Memorable embedding
credentials, choose `MEMORABLE_BACKEND=local`, and enable the existing local-store
consent. The example uses an isolated store and an explicit opt-in flag. Legacy
`createMemorable()` without metadata still uses published `ingest`/`recall` text
commands. Old CLIs cannot silently accept the metadata protocol.

- V1 supports the standalone local backend only. No hosted durability or general
  HTTP recall claim; GBrain/QM backends are explicitly refused for this contract.
- Semantic document/query text is capped at 2,000 characters. Summarize long
  traces into selected fields; overlong search text is refused, not truncated.
- Trace: 1 MB; metadata: 256 KB; input: 2 MB; recall response: 1.8 MB; limit: 1–10.
  JSON depth and collection limits also apply. Trace JSON is opaque, not a promise
  to interpret every harness schema.
- `embedding: 'optional'` permits reported lexical degradation; `'off'` explicitly
  avoids embedding. Required mode rejects missing embeddings. A previously
  unembedded stable ID cannot be silently upgraded by retrying it.
- Same stable ID/schema/content returns the existing receipt. Changed content
  under that ID conflicts. Metadata writers serialize locally; a crash can leave
  `metadata-write.lock`, requiring operator inspection before removal.
- Developers own trace/field redaction. CLI semantic input reuses the established
  identifier scrubber and refuses inputs it would modify. This is not a complete
  secret detector. Private roles do not remove duplicated data from other fields
  or the trace. Python capture journals/outboxes include the application-selected
  store request, including private metadata, in owner-readable plaintext files.
  The procedure store uses existing encryption; keep journals out of source control.
- Browser memory is opt-in and supports `MEMORABLE_BROWSER_USE_DISABLED=1`.
  Optional memory failures retain an outbox and allow the browser task to proceed.

[Live evidence](verification/2026-09-19-metadata-browser.md) documents two real
model-driven runs, production embeddings, saved-memory reuse and failure controls.
It does not establish retrieval quality at scale or a speedup.
