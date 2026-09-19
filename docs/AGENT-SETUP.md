# One-prompt integration handoff

Give this prompt to a coding agent in the application you want to connect. Supply a local checkout of this branch. The prompt does not remove the need for Memorable credentials or a working native-agent account. This repository currently provides the CLI transport; an HTTP-only application still needs the upstream read endpoint.

```text
Connect this application to Memorable using the environment-mem checkout I provide.
Read its README.md, docs/CONNECTIONS.md, docs/SDK-PLAN.md and latest verification report first.

Use the existing two-operation SDK: createMemorable(), store(), recall(). Keep retrieval
inside Memorable. Do not build another database, ranker, dashboard or replay engine.

Inspect this application's actual task lifecycle and tool result format. Identify the
task-start boundary for recall and the settled task-end boundary for store. Preserve
real tool names and inputs, keep failed/unknown outcomes, and separate task IDs from
session IDs. Describe any fields the current extraction envelope cannot preserve.

For a Node application, install the checkout as a local dependency and import
headstart/memorable. For an existing CLI with hooks, use the documented native hooks
only after checking that the installed host/version supports them. Use the project
configuration by default; preserve unrelated hooks. Do not assume Devin's hosted API
and Devin CLI expose the same integration points.

Configure the Memorable backend and the actual tool schema. Recall before work;
let the caller choose whether to inject the returned reference text. Fetch a selected
procedure by ID when needed. Store the real settled run at task completion. Retain
failed submissions for explicit retry. Never treat command_completed as durable storage.

Verify from the consuming application, then run a disposable real coding task with a
known failing command and a subsequent fix. Compare native tool calls and results to
the capture. Read the resulting procedure from a fresh client. Query close wording,
a paraphrase, and an unrelated task. Observe context arriving in a second native run.

Report the changed files, versions, actual observations and remaining gaps. If login,
native hooks, capture or recall fail, retain and report that failure. Do not substitute
handwritten events or local tests for proof of native capture or hosted persistence.
```

The [current evidence](verification/2026-09-19.md) covers the reference loop and real Memorable service connection. It does not yet prove that this handoff succeeds unattended for Devin, Claude or Codex.
