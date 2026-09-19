# Store and recall: revised implementation plan

Updated September 19, 2026. This plan builds on Memorable's existing CLI and service. It supersedes the architecture direction in [PLAN.html](PLAN.html); historical results there remain historical results.

## 1. Reuse the existing system

[memorable-gbrain](https://github.com/NIkhil-cmd-cmd/memorable-gbrain) is a private monorepo containing the standalone CLI, core procedure/retrieval logic, the extraction service, and related applications. The name does not make it only a GBrain plugin. Public integration surfaces are documented on [memorable.sh](https://www.memorable.sh/docs/integrate).

The CLI already accepts an agent-neutral extraction envelope through `ingest -` and provides `recall`, `show`, `chain`, `list`, and MCP access. Its retrieval uses stored procedures, exact identifiers, lexical scores and semantic similarity; chain composition is a separate path. This repository should connect to that system, not silently replace it with Headstart's local lexical ranker.

The inspected extraction implementation embeds a short procedure title, potentially rewritten from the task and early steps. It does not embed every tool call or preserve the complete original trace in the procedure. The CLI's configured storage can be local; a CLI read therefore does not prove hosted HTTP readback.

An HTTP recall/procedure implementation has been reported in another uncommitted checkout. It was unavailable for review here. The next server task is to locate, review and ship that existing work in the private upstream, then document and verify it. Do not assume a new MongoDB, Atlas deployment, or replacement retrieval engine is required. Public API documentation currently covers extraction and query embeddings; it does not establish a deployed, durable store/recall pair.

Version provenance matters: the September 19 release audit found npm `latest` at 0.5.18 while a local durable installation identified itself as 0.5.19. Record the actual executable version used in each integration result; do not infer a public release from a local installation.

## 2. Two methods, explicit limits

The branch's initial connection layer exports `createMemorable()` from `headstart/memorable`:

| Operation | Current connector | Future structured contract |
|---|---|---|
| `store(traceEnvelope)` | Send the accepted extraction envelope to `memorable ingest -`; return command output | Durable accepted-trace receipt, stable artifact ID, separate extraction/index status and idempotency |
| `recall({ query, mode? })` | Run existing CLI recall/chain and return text | Scoped matches with procedures, preserved traces, provenance and applicability evidence |
| `recall({ procedureId })` | Run existing CLI `show` and return text | Fetch an authorized artifact through the same method |

Current recall modes are routing choices (`auto`, `single`, `chain`) for existing CLI behavior. They are not semantic-vs-keyword algorithm controls. The CLI transport has no invented `--json` contract. A `command_completed` result reports process completion, not database durability, successful extraction, or a useful match.

The application owns hook placement, task boundaries, redaction and how recalled material is used. Hooks/injection are optional conveniences. The SDK must not execute retrieved instructions automatically. Deterministic replay would need its own state checks and execution policy; returning a procedure does not provide it.

The optional adapter interface keeps the main command generic. A developer-selected local module exports `createAdapter(config)` and implements the same `recall(request, {signal})` / `store(request, {signal})` operations. `headstart memory <recall|store> --adapter <file>` passes JSON requests and returns a versioned JSON envelope; Node callers use `headstart/adapters`. Each add-on defines its own trace schema and connection behavior. Browser Use and Devin mappings belong in optional directories/packages, with no browser dependency in the core SDK. The envelope does not turn the existing upstream text commands into structured hosted APIs. See [CONNECTIONS.md](CONNECTIONS.md) for the protocol and limits.

The optional [Browser Use implementation](../packages/browser-use/README.md) now
captures real browser actions through this interface. Its experimental HTTP
driver uses a separate browser-specific upstream schema; it is not evidence that
general HTTP recall has shipped. The [live report](verification/2026-09-19-browser-use.md)
records actual model-driven capture and missing browser authorization. Advisory
retrieval without executor capabilities is now prepared as a separate local
backend change and connected through `mode: "context"`; it is not deployed.
The inspected browser backend also lacks a wired discovery path from accepted
events to searchable workflows. See [BROWSER-CONTEXT.md](BROWSER-CONTEXT.md).

The next versioned metadata contract should distinguish:

| Definition | Purpose |
|---|---|
| Project/repository scope | Hard retrieval boundary; workspace authorization must come from the authenticated service |
| Task intent and desired result | Main relevance signal, separate from the result actually observed |
| Compatibility and required facts | Runtime/tool capabilities and explicit preconditions; unknown facts cannot satisfy required conditions |
| Custom metadata fields | Developer-declared hard constraint, relevance signal, or attached context; not all fields belong in embeddings |
| Trace/tool schema | Stable run and call IDs, original tool names, arguments/results, ordering, parent relations, and optional tool-meaning mappings |
| Outcomes and provenance | Failed, interrupted and unknown runs retained; verification evidence distinguished from an individual successful command |
| Redaction and retention | Define accepted fields and disclose omissions/truncation before claiming trace fidelity |

Developers define this in code. No dashboard setup, sample-paste step, or third registration operation is required by the proposed interface. The current CLI envelope does not implement all these semantics, so adding arbitrary JSON fields now would not make scope or condition checks effective.

## 3. Delivery order and ownership

1. **This repository: CLI connection and capture.** Export the two-method connector, route the Memorable backend's reads and writes through it, and document native/custom hooks. Separate task runs within a session, retain stable call IDs when supplied, deduplicate repeated events, and preserve explicit failure/unknown results. Keep the existing local engine available with a clear label.
   Optional integration packages build on the same two operations; validate Browser Use with real action/results and handle Devin separately according to [DEVIN-INTEGRATION-PLAN.md](DEVIN-INTEGRATION-PLAN.md). Protocol regression checks establish dispatch and error handling only; they do not prove capture, retrieval quality or deployed persistence.
2. **Private upstream: finish browser discovery and deploy the reviewed context route, then review the general HTTP read work.** Browser ingestion and workflow retrieval use different tables; accepted events must actually become a discovered workflow before context recall can return them. This is an additional browser-specific service gate. The context-only response is prepared locally, not deployed. For the general CLI path: Confirm authorization, storage backend, procedure schema, ranker reuse, pagination/candidate limits, error behavior and deployed versions. Run a real stored-procedure readback before declaring the endpoint usable. Commit, deploy and document it in the upstream repository.
3. **Coordinate the durable trace contract.** Preserve accepted, redacted traces separately from reduced procedures. Distinguish durable acceptance, extraction admission and index readiness. Add idempotency/run revisions and explicit scope/condition/outcome semantics where missing. Identify what can be reused before designing migrations.
4. **This repository: add the documented HTTP transport.** Keep `store` and `recall` as the public operations; select transport at client creation. Add typed responses only when the deployed service has a versioned response contract. Retain the CLI transport for environments that already use it.
5. **Verify real workflows and retrieval quality.** Complete the evidence gates in [VERIFICATION.md](VERIFICATION.md), then test a second independent coding loop with the same contract. Publish redacted results and measured limitations.

No private backend implementation, credentials, or raw private agent traces should be copied into this public connection repository. Link upstream work and pin compatible versions instead.

## 4. Retrieval decisions to validate upstream

The [September 19 service experiment](verification/2026-09-19.md) found the stored retry-budget procedure by close wording and filename, but missed “Correct how many retries are left after several attempts have already been used.” Preserve this as a failing relevance case. Inspect the existing embedding representation, candidate generation and cutoff before changing infrastructure; one observed miss does not identify its cause.

Start from the existing ranker and storage. Define authorized scope and compatibility before generating candidates, then combine lexical/exact-identifier and semantic candidates. Return no match when evidence is weak. Keep graph composition internal; it should operate on eligible procedures and supported dependencies rather than bypassing scope checks.

Compare the existing title embedding against a compact, grounded description of task intent, reusable steps, applicability and intended outcome. Keep commands, file paths, symbols and error codes available for exact/lexical matching. Preserve the accepted trace as the returned evidence; the vector is a search representation, not the memory itself. Add step-level vectors only if they improve measured retrieval.

Use real held-out tasks, paraphrases, hard negatives, similar tasks in different projects, changed parameters, failures and unknown outcomes. The prior ten-procedure evaluation cannot establish the best embedding representation or retrieval quality at larger scale. Graph-vs-vector strategy remains a service implementation choice. Caller-supplied embeddings, if added later, require an explicit model/version/dimension contract.

Completion means one actual captured task can be stored, found from a fresh authorized client, and deliberately supplied to a second real task, with the evidence available to inspect. A deployed endpoint, a generated hook file, or a successful process exit alone is insufficient.
