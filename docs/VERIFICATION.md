# Verification: capture, storage and recall

This document defines evidence gates. A local connector check, a real CLI call, native hook capture and durable hosted storage are separate claims. Record each independently; no single “tests passed” status substitutes for them.

## 1. Current evidence boundary

The branch adds a CLI-backed connection to an existing service; it does not deploy a new database or HTTP retrieval endpoint. A successful SDK `store` result means the selected CLI process completed. A returned CLI procedure is not the original full trace.

The [September 19 live report](verification/2026-09-19.md) records extraction through the published CLI and live service, fresh-process local readback, successful close/exact retrieval, a failed paraphrase, and reference-hook context output. Native Claude capture was blocked by revoked authentication before tools ran. Native context consumption, hosted durability and HTTP recall remain unverified. Historical Headstart evaluation results concern the prior local lexical engine and do not verify this connector.

Use a disposable test project and data you are authorized to submit. Record the selected CLI version and backend. The initial release audit saw npm 0.5.18 and an installed durable 0.5.19 build; those are not interchangeable provenance.

## 2. Capture and connection gates

| Gate | Actual experiment | Evidence required |
|---|---|---|
| Native event delivery | Run a real supported coding agent over two separate prompts. Include a marked read/edit, a successful command and a known nonzero command. | Native host/version and transcript references, hook logs and captured events. Handwritten events exercise parsing only. |
| Run boundaries and call/result joins | Exercise two tasks in one session, repeated stop delivery and parallel calls where the host supports them. | Every expected call belongs to the correct run exactly once. IDs, arguments and explicit outcomes match the native transcript and an independent command ledger. |
| Unknown and failed results | Include a failed call and an incomplete or missing result. | Failure remains failure and missing remains unknown. No invented exit code or task-success claim. |
| CLI transport | Run `store`, query recall and ID recall through the importable package against a real selected CLI. | Exact command/version, sanitized request, exit/timeout status, stdout/stderr and backend selection. A fake executable checks process wiring only. |
| Backend routing | Select `memorable` and observe both capture submission and recall. Repeat with `local`. | Memorable commands actually run in the first case; no local lexical result is presented as a Memorable result. |

Compare retained trace fidelity separately from extracted procedure fidelity. Extraction intentionally reduces information; lost arguments/results cannot be described as a faithful original trace. Redact sensitive values in shared evidence and disclose any omissions relevant to the check.

## 3. Storage, retrieval and agent-use gates

| Gate | Actual experiment | Evidence required |
|---|---|---|
| Persisted procedure | Submit a real captured task, then read from a fresh client process using the same intended store. | Stored artifact identifier and readback. An extraction draft or process exit alone does not establish persistence. |
| Durable hosted trace | Once the upstream contract supports it, read the accepted trace through an independent database/service inspection and fresh authorized client. Repeat delivery and interrupt indexing in an isolated environment. | Matching accepted-payload hash/event count, durable record/job, truthful indexing state and defined duplicate behavior. A CLI local JSONL record is not hosted evidence. |
| Relevant retrieval | Query a paraphrase with changed identifiers against real stored runs and plausible wrong candidates. | Actual request, candidate/result IDs, ranking information available from the service, selected procedure and returned content. No canned response. |
| Isolation and applicability | Query from another authorized scope, an incompatible environment, missing required facts and an unrelated task. | No cross-scope disclosure, required conditions respected and no-match behavior. If the current CLI lacks these controls, mark the gate unsupported rather than passing it. |
| Context delivery | Route the recalled result into a fresh native-agent task through its documented context seam. | Native context/transcript evidence that the content arrived, plus the task's actual actions and outcome checks. |
| Useful reuse | Compare tasks with and without recalled context, controlling the fixture and task distribution. | Repeated paired runs, task correctness, latency/tool calls/cost and uncertainty. One completed demo does not prove a performance gain. |

The minimum demo is one real captured task → persisted procedure → retrieval for a related task → observed context delivery → real task outcome. A stronger HTTP claim additionally requires the deployed HTTP read path and independent hosted readback. Neither can be inferred from a successful unauthenticated health request.

## 4. Publish inspectable results

Add a dated report under `docs/verification/` with:

- Repository revision, Node/CLI/harness versions, selected transport and storage backend.
- An explicit status for each attempted gate: verified, failed, blocked, unsupported or unrun.
- Sanitized run and artifact identifiers, actual request/response summaries, native transcript references and independently observed outcomes.
- Relevant limitations: admission rejection, unavailable read endpoint, truncated capture, timeouts, absent scope checks or missing database access.
- Reproduction steps and which artifacts are intentionally kept private.

Keep credentials, personal filesystem paths, raw private traces and private source code out of committed reports. Never turn an unrun gate into a pass because an adjacent unit test succeeded. Update the current evidence boundary above with a link to the report once it exists.
