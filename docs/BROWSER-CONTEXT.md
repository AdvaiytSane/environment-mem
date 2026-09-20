# Browser Use: advisory context contract and rollout

Prepared September 19, 2026. The public package and a matching local backend
change are implemented; this document is not a production API availability claim.

The application still uses the same two operations: `store(request)` and
`recall(request)`. The Browser Use package maps those operations to browser-specific
HTTP requests. The main CLI remains a framework-neutral dispatcher.

## Recall contract

The package sends `mode: "context"` to `POST /v1/browser/resolve` alongside the
task label, origin, observed state fingerprint, recent states, runtime description,
known/unavailable parameter names, constraints and client run ID. It advertises
no deterministic execution capabilities. Parameter values stay with the caller.

A successful response acknowledges `mode: "context"` and uses one of:

- `no_match`: no advisory context.
- `partial`: a usable reference with incomplete coverage or weaker evidence.
- `complete`: the backend's existing applicability and evidence criteria are met.
  This does not authorize execution or prove that the current task will succeed.

Matched responses include `context.kind: "workflow_reference"`,
`context.executable: false`, workflow identity/revision, parameter definitions,
and at most 50 ordered steps. Each step has `id`, `seq`, `op`, `target`,
`precondition`, `postcondition`, `policy_class`, `approval_required` and `evidence`.
The reference includes the total workflow step count and any stopping boundary.
It excludes executable programs and literal value bindings.

The renderer uses safe action names, roles, UI labels and minimized page shapes.
Approval requirements precede the action. A step and its conditions are never
split by the context limit. Missing target detail, partial coverage and truncation
remain visible. The host supplies this guarded reference before constructing the
agent and remains responsible for deciding whether and how to use it.

The driver refuses a response that does not acknowledge context mode. It never
treats a replay compiler's `no_match` as proof there are no advisory memories.
Malformed references, outages and authorization failures remain distinct errors;
the optional memory layer records the error and lets the browser task continue.

## Backend handoff

The matching private change is on local branch `codex/browser-advisory-context`,
at commit `a019d27fb61754bf219738f2b86bb280c1517064`, based on Memorable commit
`101666176b842f1d1053c2c132dcdd2a0640838a`.
It preserves the existing route authorization, organization/origin/salt boundaries,
candidate ranking and policy filtering, and branches before replay compilation.
Context resolve IDs cannot be submitted as replay feedback. No private source is
included in this public repository. No backend deployment was performed.

The production round trip still needs three things:

1. **Workflow discovery.** The inspected backend stores browser events separately
   from the workflow tables searched by recall. Its scheduled discovery wiring
   must be located or implemented and verified. An ingest receipt alone does not
   establish that the run became a retrievable workflow. The latest capture also
   deliberately omits an unverified extraction result: its uploaded sequence is
   1 then 3. The service counts this as two received out of three expected events.
   Discovery needs an explicit rule for such incomplete captures, or the host
   must independently verify the missing action. Do not hide the gap by renumbering
   events or inventing a successful outcome.
2. **Compatible deployment and authorized access.** Deploy the reviewed context
   implementation through the backend owner's normal release process. The
   configured credential previously returned `insufficient_scope` for
   `procedures:resolve`; writes require `traces:write`. An OpenAI model key does
   not provide either permission.
3. **A real second run.** Ingest actual browser capture, independently read the
   resulting workflow, then recall it in a fresh browser agent with both similar
   wording and a paraphrase. Inspect the context actually supplied and independently
   verify the second task. Preserve no-match and discovery failures as evidence.

The latest [real OpenAI browser run](verification/2026-09-19-browser-use-openai-replacement.json)
verified the model connection, actual action capture and final page. Memory was
explicitly offline; no hosted receipt or retrieved context is claimed.
