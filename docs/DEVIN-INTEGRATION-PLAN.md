# Devin integration: optional adapters over the same SDK

Researched September 19, 2026. This is a source-backed implementation plan, not a report of a completed Devin run. No Devin session was launched for this research.

## 1. Product boundary and recommended starting point

Keep one Memorable CLI and the existing `store()` / `recall()` SDK. Put Devin-specific lifecycle mapping in an optional `adapters/devin/` package. Developers can use that package, copy its small examples, or implement the mapping themselves. Browser Use is another optional consumer; neither becomes a dependency of the other or of the core SDK.

**Start with Devin CLI for complete automatic capture. Treat hosted Devin as a separate integration.** The CLI exposes observable tool completions and a prompt injection hook. Hosted Devin exposes a session API and MCP connections, but the inspected messages API does not expose equivalent raw tool-call/result records. An integration that adds context to hosted Devin is achievable; complete hosted capture needs another evidenced seam.

The proposed flows are:

```text
Devin CLI hooks → optional Devin adapter → store/recall SDK → Memorable CLI

Hosted orchestrator → store/recall SDK → Memorable CLI + persistent local store
                    ↘ Devin API: create a session with recalled context
```

The current SDK returns CLI text and `command_completed`. It does not provide structured matches, a durable remote receipt, an original full trace, enforced metadata filters, or deployed HTTP recall. A process that launches cloud Devin can run Memorable locally and retain its store; adding a CLI to an ephemeral Devin VM alone does not establish memory shared across future sessions. See [SDK-PLAN.md](SDK-PLAN.md).

Current code already installs Claude-format hooks that Devin can import. That is a starting point, not current native verification: `src/hook.ts` does not yet map Devin's `prompt_id` or `DEVIN_PROJECT_DIR`, and `harness` defaults to `headstart`. The old comment in `src/install.ts` refers to a previous CLI version and is not evidence for the presently documented release.

## 2. Exact seams and the intended flow

| Surface | Documented seam | Proposed adapter behavior | Evidence level |
|---|---|---|---|
| CLI context | `UserPromptSubmit`, input `prompt` | Recall before the turn; return bounded `hookSpecificOutput.additionalContext` tagged with the hook event | Documented; native run still required |
| CLI capture | `PostToolUse`: `tool_name`, `tool_input`, `tool_response` containing `success`, `output`, `error` | Journal completed calls and observed outcomes; never journal a planned call as executed | Documented; actual payload semantics need inspection |
| CLI boundary | `Stop` ends a turn; `SessionEnd` ends a session | Flush the corresponding run at Stop; SessionEnd flushes an unfinished run as interrupted/unknown | Documented; interruption behavior must be exercised |
| CLI correlation | `session_id`, per-turn `prompt_id` | Preserve native identities and derive safe SDK IDs | Documented; stable per-call ID is not documented here |
| Hosted context | `POST /v3/organizations/{org_id}/sessions`, `prompt` | Recall in the caller, attach selected reference context, then create the session | Documented; not exercised |
| Hosted observation | Session details and paginated messages | Track status, reported results and message provenance; do not manufacture tool events | Documented; insufficient for complete capture |

CLI lifecycle sources: [Lifecycle Hooks](https://docs.devin.ai/cli/extensibility/hooks/lifecycle-hooks), [Hooks](https://docs.devin.ai/cli/extensibility/hooks/overview). Hosted sources: [Create Session](https://docs.devin.ai/api-reference/v3/sessions/post-organizations-sessions), [Get Session](https://docs.devin.ai/api-reference/v3/sessions/get-organizations-session), [List session messages](https://docs.devin.ai/api-reference/v3/sessions/get-organizations-session-messages).

For the CLI add-on, implement this sequence:

1. Explicit project opt-in creates a project-scoped configuration. Prefer `.devin/hooks.v1.json`; it contains the hooks object directly. Preserve other hooks. Detect an existing imported Memorable hook before registering another, since Devin also imports Claude configuration by default. Confirm the final registration in Devin's `/hooks` view. [Hook configuration](https://docs.devin.ai/cli/extensibility/hooks/overview)
2. On a prompt, map `prompt_id` to the adapter's run ID, select the project's own Memorable store, and call `recall({query: prompt, mode: 'single'})` with a five-second budget. No match or unavailable Memorable leaves the task running normally. Initially return the candidate listing with an instruction for reading a listed procedure using the configured CLI; do not label the listing a full procedure. Automatic selection requires a separately validated parsing/selection policy or a future structured response.
3. Append redacted completions to a local journal. Preserve native tool names. Treat tool success, subprocess exit status and task verification as different facts. A successful shell-launch tool does not establish that its background process exited successfully. Correlate later results only using observed process/call identities. Missing identities remain a limitation; hashing two identical calls must not erase a legitimate repeated action.
4. Flush a completed turn using `store({session_id, workflow_id, task_description, harness: 'devin', tool_calls})`. Hash native session/run identities into the accepted identifier format. `workflow_id` here identifies one captured invocation; keep the reusable workflow category separate. Persist pending submissions before sending, and retain them on errors. A CLI zero exit is still not an independent persistence check.
5. On the next task, retrieve from that same configured store. Inject references with provenance and a size cap; the agent checks applicability and performs its own actions. Nothing in this integration automatically replays commands.

For hosted Devin, choose one of two clearly named modes:

- **Orchestrator mode:** a persistent service or developer machine calls the SDK before starting the Devin session. Supply the original task plus selected recall text in `prompt`; use `repos`, `max_acu_limit` and, if useful, `structured_output_schema`. Treat structured output as Devin-reported evidence until checked independently. Poll the session; a waiting or suspended status is not proof of task completion. [Session creation](https://docs.devin.ai/api-reference/v3/sessions/post-organizations-sessions), [session state](https://docs.devin.ai/api-reference/v3/sessions/get-organizations-session)
- **Tool access mode:** connect the existing `memorable mcp` read tools to Devin using its supported STDIO configuration and provision that process's memory store. This enables agent-requested recall; it does not guarantee a call before every task or collect other tools' activity. Devin also supports remote MCP transports, but that does not create a hosted Memorable endpoint. [Devin MCP connections](https://docs.devin.ai/work-with-devin/mcp)

For hosted capture, first request a documented tool-event export or instrumentation point from Cognition. A wrapper around tools we supply can capture those tools only. A model-authored end-of-task summary can be retained as an attributed summary, but must not be submitted as if it were an observed sequence of shell/browser calls. The messages endpoint returns message text, source, timestamps and event IDs with pagination; those message IDs are not tool-call IDs. [Messages schema](https://docs.devin.ai/api-reference/v3/sessions/get-organizations-session-messages)

## 3. Developer parameters and implementation scope

Most fields should be collected by the adapter. Developers define routing and verification, not manually paste a sample trace.

| Parameter | Who provides it | Use and current limitation |
|---|---|---|
| `enabled`, consent, recording switch | Developer/operator | Project opt-in and a switch that prevents capture as well as submission |
| `memorable.command`, `args`, runtime | Developer, resolved by installer | Call the pinned CLI using argument arrays; Node 24+ for this SDK |
| `memoryScope` / store location | Developer/operator | Select an isolated store per authorized tenant/project; current SDK metadata does not enforce remote scope |
| `projectKey`, repository, revision | Adapter plus optional override | Applicability/provenance in local sidecar; do not pretend they are enforced retrieval filters |
| `sessionId`, `runId` | Native session and prompt identities | Correlate the task and make retries stable |
| `task`, optional `workflowKey` | User prompt / developer category | Recall text and reusable task grouping; category is not an invocation ID |
| `harness`, CLI/adapter versions, tool schema | Adapter | Describe actual Devin tool semantics; verify upstream normalization for `exec`, `edit`, `apply_patch`, MCP and process tools |
| `events` | Adapter | Ordered action arguments, native IDs where available, observed outcomes and evidence references |
| `redact` / allowed fields | Developer | Remove secrets and irrelevant content before local retention/egress; disclose truncation |
| `verify` | Developer | Check the actual test process, artifact or external state; retain successful, failed, interrupted and unknown outcomes distinctly |
| `preconditions`, `postconditions` | Developer, evaluated by adapter | Local applicability and verification rules for the optional add-on; generic CLI does not enforce arbitrary conditions |
| `orgId`, credential, repository access, budget | Hosted operator only | Launch/read hosted sessions; keep credentials outside trace inputs and prompts |

Retain richer metadata and original redacted evidence in an adapter sidecar until a supported trace contract exists. Today's generic SDK accepts only the documented envelope and reduces `result` to `ok`/`exit_code`; arbitrary fields added to a TypeScript object will not preserve a full Devin trace. Do not disguise Devin as `claude-code` merely to obtain better normalization. Audit the actual extraction mapping and report unsupported action types.

Proposed implementation, roughly 450–700 lines across five optional files, plus approximately 150–250 lines of meaningful fixtures/checks:

- `adapters/devin/src/index.ts`: hook input mapping, scoped connection and lifecycle orchestration.
- `adapters/devin/src/journal.ts`: serialized writes, run boundaries, pending submissions and evidence references.
- `adapters/devin/hooks.template.json`: project hook template with no machine-specific paths.
- `adapters/devin/README.md`: installation, kill switch, metadata, limitations and uninstall steps.
- `adapters/devin/examples/hosted.ts`: separate hosted recall-before-create example; explicitly capture-incomplete.
- `adapters/devin/test/`: verified payload fixtures plus run-boundary, retry and unknown-outcome regression checks.

Reuse the core SDK unchanged where possible. If a shared journal utility is later extracted, keep it independent of Devin and Browser Use. No new database, second retrieval service, automatic replay engine or browser dependency is part of this work.

Prerequisites: an authenticated Devin CLI account for native execution; the Memorable executable, configured extraction credentials/consent and persistent writable storage; an allowed disposable repository and network access. Hosted v3 calls require an organization ID and a service-user credential (`cog_`), with `UseDevinSessions` for creation and `ViewOrgSessions` for message access. Confirm any added endpoint's own permission requirements before implementation. [API authentication](https://docs.devin.ai/api-reference/authentication), [creation permissions](https://docs.devin.ai/api-reference/v3/sessions/post-organizations-sessions), [message permissions](https://docs.devin.ai/api-reference/v3/sessions/get-organizations-session-messages)

## 4. One-prompt setup and real verification

A coding agent can install/configure the optional package from one setup prompt **once the operator is authenticated and the adapter is implemented**. The setup must discover the actual executable versions, merge project hooks, select the store, and run an integration check. It cannot manufacture an authenticated Devin session, API entitlement or shared persistent store.

Proposed setup prompt:

> Connect this repository's Devin CLI to Memorable using the optional Devin adapter and existing store/recall SDK. Use project-scoped configuration and the configured Memorable credentials. Preserve existing hooks, record actual results, and keep memory failures from blocking Devin. Run a disposable bug-fix task, independently inspect the captured calls and stored procedure, then run a fresh session with a paraphrased task and show what context reached it. Report any missing credentials, unsupported payload fields, retrieval misses or unverified persistence plainly.

Verification is a real two-session experiment with a third independent checker:

| Gate | Required evidence |
|---|---|
| Hook discovery | Actual Devin version and `/hooks` registration, including source paths; no duplicate imported registrations |
| Capture | A real read/edit/test task with an intentionally failing test followed by a fix; compare hook records with independently collected command results and the final diff |
| Boundaries | Two prompts in one session stay separate; exercise repeated Stop, interruption and a resumed run without dropping or merging actions |
| Outcomes | Failed tool and background-process cases retain their actual states; a successful tool invocation is not silently promoted to verified task success |
| Store | Submit through the SDK and existing CLI to the configured service; a fresh CLI process independently lists and reads the resulting local procedure |
| Recall | Query with original wording, a paraphrase and an unrelated task; record misses as failures, not success because the command exited zero |
| Injection | A second real Devin session receives the procedure reference; inspect the injected boundary and observe the agent use or reject it with an independently checked task result |
| Failure tolerance | Repeat with Memorable unavailable; Devin continues, pending capture remains, and a later retry preserves run identity |
| Hosted parity | Separately prove the session prompt received recall text; do not mark full capture or cross-session persistence complete without actual evidence for those paths |

Publish a redacted report with versions, stable run/procedure IDs, observed counts, outcomes, exact queries and limitations. Compare memory-on and memory-off runs only after basic correctness is established; one run does not prove a speed or token benefit.

If using Devin Dynamic Workflows later, perform retrieval inside a recorded agent stage or supply a fixed, versioned result to the workflow. Its documented resume mechanism depends on reproducible orchestration inputs; live recall during deterministic orchestration could change prompts between resumes. That mechanism reuses recorded agent results and does not establish deterministic replay of Memorable tool traces. [Dynamic Workflows](https://docs.devin.ai/work-with-devin/dynamic-workflows)

The concrete request to Cognition is small: confirm the installed CLI hook payload/version contract, stable per-tool IDs and background-command completion semantics; for hosted Devin, provide a supported tool-call/result export and task-boundary event. Public source review establishes the planned seams above, not that these missing guarantees are already available.
