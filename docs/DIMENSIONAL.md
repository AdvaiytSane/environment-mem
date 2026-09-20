# Dimensional integration

The optional adapter lives in [`packages/dimensional`](../packages/dimensional).
It reuses the existing native metadata CLI; it does not add a second memory
backend, change dimOS, or implement a robotics planner.

## Implemented and observed

Pinned upstream: [dimensionalOS/dimos c1c3cdc9d2ee54ca72259465688395699d7d99a2](https://github.com/dimensionalOS/dimos/tree/c1c3cdc9d2ee54ca72259465688395699d7d99a2).
Local version: `dimos 0.0.14`, Python 3.12.12, macOS arm64. The isolated install
used `sim,agents,web` extras. Latest LangChain 1.4.0 failed to import
`ToolCallTransformer` from its resolved LangGraph; pinning LangChain 1.2.3
resolved the agent example.

Actual upstream `McpServer` ran inside its module coordinator on localhost.
Two fresh external `gpt-4.1-mini` agents used real `server_status` and
`list_modules` tool calls. The first stored its two calls through the native
Memorable CLI. The second recalled the first mission and received 325
characters of historical context before it called the tools. Independent
direct reads checked the module/skill inventories, and an OS process check
confirmed the reported process existed.

| Observation | First agent | Fresh agent with recall |
|---|---:|---:|
| Captured tool calls | 2 | 2 |
| Actual model tokens | 435 | 552 |
| Agent + verification elapsed time | 3,884.51 ms | 2,514.66 ms |
| Recalled context | none | 325 characters |
| Native local store receipt | yes | yes |

These two runs prove the connection. They **do not demonstrate token savings**;
recall added tokens for this small task. The latency difference is one noisy
pair, not evidence of acceleration. Embeddings were explicitly off, so this
demonstrates filtered lexical retrieval, not semantic retrieval quality.

The same real server completed read-only commands with memory disabled, the
kill switch enabled, the CLI unavailable, and consent unset. In the latter
two cases diagnostics identified the failure and the sanitized store request
remained available to retry. A mismatched `map_version` returned no memories.

Sanitized evidence:

- [Actual model-driven runs and controls](../packages/dimensional/evidence/2026-09-20-live-mcp-agent.json)
- [Earlier scripted MCP/CLI connection check](../packages/dimensional/evidence/2026-09-20-live-mcp-scripted.json)

## Robot demo status and boundary

The optional `memorable-dimensional.inspection` blueprint now runs the actual
upstream navigation stack and bundled `office1` MuJoCo scene. The upstream Go2
stack uses a **Go1 simulated body and policy** in this configuration. No physical
robot was connected. PortAudio, PyAudio, Unitree WebRTC, Torch, and the actual
Git LFS simulation assets were installed locally to get past the launch blockers.
MuJoCo Menagerie resolved to `1b86ece576591213e2b666ebf59508454200ca97`.

A real `gpt-4.1-mini` agent issued two `move_to` calls and four `inspect_pose`
calls. The robot moved; camera frames and fresh simulator odometry were
recorded. Independent pose checks **rejected the mission**: checkpoint A was
outside the 20 cm arrival tolerance and the final return was roughly 35 cm
from B, despite upstream navigation reporting arrival. Duplicate initial
observations also failed the strict camera-sequence check. The native CLI
stored this trace with `outcome: unverified`. There is no successful inspection
replay or demonstrated robot-efficiency gain yet.

- [Actual robot motion, measurements, usage, and storage receipt](../packages/dimensional/evidence/2026-09-20-mujoco-inspection.json)
- [Actual camera frame after the return attempt](../packages/dimensional/evidence/62e11a8be7defb3029a14464c88903a79c42737a0c59b1d16dbc49e9dfe0d527.jpg)

The example now gives the model measured checkpoint distances and a four-move
budget so that it can retry an arrival miss. The independent 20 cm verifier
remains unchanged. A bounded retry reached A but again missed the return point,
then hit the model graph's 18-step limit. That retry did not persist a mission
report; the example now handles agent exceptions so future attempts can store
their partial trace and report missing usage rather than inventing it. That
new exception-handling path has not yet had another live run. This is a runnable
experiment, not a completed robot demo.

The adapter wraps `McpAdapter.call_tool` used by an external agent. Built-in
dimOS `McpClient` sends its own HTTP requests and needs a separate hook; no
automatic capture of that worker is claimed. Mission end and verification
must come from the application. The source explicitly shows
[`navigate_with_text`](https://github.com/dimensionalOS/dimos/blob/c1c3cdc9d2ee54ca72259465688395699d7d99a2/dimos/agents/skills/navigation.py)
can return immediately after setting a goal. We therefore distinguish
`result_received` from verified arrival.

The planned showcase is a closing inspection with repeated checkpoints:
teach an inspection, capture observed arrival and inspection evidence, then
start a fresh mission in the same compatible environment. A changed map must
exclude the old workflow. A blocked route must invoke fresh navigation rather
than replay previous motor commands. The included camera images were captured from that actual simulator run.

## Integration contract

`MissionMemory.prepare()` filters by project, site, map version, robot
capability fingerprint, tool schema, and verified outcome, then returns
guarded context. The application passes it to the model before action.
`wrap_mcp()` captures only calls through that wrapper. `finish()` stores one
mission with a supplied verifier result. Repeated `finish()` calls do not
write twice.

The default projection excludes raw sensor payloads, arguments, and arbitrary
tool output. Developers can retain explicitly approved checkpoint IDs and
procedure summaries through a projection callback. Private metadata stays
out of recall, but data copied into the trace must be minimized separately.

The integration defaults off. CLI consent remains required, the kill switch
overrides enabled configuration, CLI calls have output/deadline bounds, and
missing memory never prevents the underlying MCP tool call. It is advisory
memory, not robot safety validation or automatic deterministic motion replay.
