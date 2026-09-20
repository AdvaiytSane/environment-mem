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

The read-only connection check is **not a robot inspection or navigation
simulation**. The initial Go2 simulation launch failed on missing Torch; a
local Torch install cleared that import. The next dependency, Unitree WebRTC,
failed to build PyAudio because `portaudio.h` was absent. Native prerequisites
are being investigated separately; no robot arrival or physical outcome has
been claimed from those attempts.

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
than replay previous motor commands. No fabricated robot scene or motion
recording is included in the package.

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
