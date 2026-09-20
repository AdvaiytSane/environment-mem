# Devin evidence and runner audit

Baseline reviewed: `87807eb084a2c1dd65a62967e0719b27087a7c10`.

No fresh Devin agent session ran on this machine. The native executable was
absent from PATH and the usual installation locations. No credentials were
printed, installed, or changed. The actual CLI demo attempt now exits with a
controlled missing-client message; it does not attempt a second run or print a
savings comparison. `2026-09-20-devin-preflight.json` records that observation.

## Recorded demonstration

`2026-09-20-devin-recorded.json` derives from the committed
`results/devin-sonnet-r1` data. It contains all 18 matched cold/doc/full triplets,
source hashes, aggregate and per-shape metrics, and explicit limitations. Paths
containing the original operator's home directory were omitted. No credentials,
raw conversation, or private source is included.

- 54 recorded runs: nine synthetic coding tasks, two repeats, three arms.
- The cold arm supplied no local Headstart context. The doc arm supplied a
  static repository guide. The full arm supplied facts plus recall from other
  task IDs; this differs from `demo`, which repeats the exact same task.
- These runs used local Headstart JSONL procedures and its lexical/compression
  ranking. They do not verify hosted Memorable, semantic embedding retrieval,
  or the proposed metadata SDK.
- Context tokens are aggregate provider counters across turns, mostly cache
  reads. They are not a single prompt's size, uncached tokens, or money saved.
  Original ATIF exports are uncommitted, so counters cannot be audited directly
  against provider receipts in this checkout.
- The hidden-check pass flags are historical runner reports. Final worktrees
  and check logs are not committed and were not independently rerun here.
- Original hook logs are also uncommitted. Character counts support that the
  old runner observed injection, but do not expose the exact recalled IDs or
  prove what the model ultimately consumed.
- Full versus cold: average context tokens fell 22.15%, time fell 15.76%, and
  tool calls fell 6.61%. Calls before the first edit rose 19.11%. Bugfix tasks
  used more context under full memory. The static guide's aggregate token use
  was nearly identical to full memory. This is not evidence of general savings
  or of improvement beyond good documentation.
- Devin dollar cost is unknown. The old zero placeholder is represented as
  `null`; no ACU or fleet estimates are included.

## Runner repairs in this branch

`run`, `demo`, and `orchestrate` use the existing runtime and capture hooks.
The runner now handles spawn errors, reports signals and timeouts as failures,
preserves unknown usage, returns usage in a local run receipt, and runs the
known fixture's independent hidden check plus original visible failing check.
The comparison headline requires two independently passing runs and a warm
recall receipt. Missing-client failures exit nonzero. On Unix, timeout cleanup
kills the agent's process group rather than leaving descendants running.

Process regressions cover missing executable, signal termination, timeout, and
an exit-zero process that made no fixture fix. These are explicitly process
tests, not fake Devin runs and not memory-quality evidence. The real CLI's
missing-executable path was exercised separately.

## Remaining integration issues

- `succeeded()` in `src/trace.ts` treats an unknown outcome as successful unless
  a short result prefix matches an error. `extractPayload()` then manufactures
  an exit code from that guess. Metadata SDK adapters should preserve unknown
  outcomes instead; this branch does not change that shared capture contract.
- `src/hook.ts` stores arbitrary tool input and a response prefix locally, and
  `src/api.ts` forwards the tool arguments. A generic metadata contract needs
  deliberate field selection and sanitization before relaying them.
- Tool capture is based on tool-name mappings; arbitrary workflow metadata is
  not persisted or used in recall by this baseline. The new universal SDK must
  connect to that contract explicitly rather than claiming adapter compatibility.
- Capture is enabled by default and there is no per-workflow consent contract
  in these hooks. The SDK's explicit connection configuration must decide what
  is recorded and surfaced.
- `runOne` still stores at the agent's Stop hook before its independent fixture
  check executes. The receipt separates storage from verified success; storage
  alone is not a success assertion.
- The older `eval` runner is outside this bounded repair. Its missing-client,
  signal, and unknown-cost handling still needs equivalent treatment before
  running another evaluation.
