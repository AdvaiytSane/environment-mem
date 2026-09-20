# Memorable for dimOS

Optional Python adapter for **external agents using dimOS's `McpAdapter`**.
The robot runtime remains unchanged. The adapter captures calls made through its
wrapper, sends developer-defined metadata to the native Memorable CLI, and
returns bounded advisory context before a new mission.

The CLI must implement `memorable.memory.v1` (`memory store -` and `memory recall -`).
Older published CLI builds are incompatible. This package is local source,
not yet a published PyPI package. Install with `pip install -e packages/dimensional`.

```python
from dimos.agents.mcp.mcp_adapter import McpAdapter
from memorable_dimensional import DIMENSIONAL_METADATA, MemorableMemory, MissionMemory

memory = MemorableMemory(["memorable"], metadata=DIMENSIONAL_METADATA,
                         embedding="required")
mission = MissionMemory(
    memory, enabled=True,
    task="Inspect the closing checkpoints", workflow="Closing inspection",
    project="warehouse-ops", site="demo-simulation", map_version="office-v1",
    robot_capabilities="go2:camera:navigation", tool_schema_version="dimos-pinned-v1",
)
context = await mission.prepare()
mcp = mission.wrap_mcp(McpAdapter("http://127.0.0.1:9990/mcp"))
# Give context to YOUR agent before it acts, and use mcp as its tool transport.
# Run the agent with the current task. Observe actual arrival and inspection data.
# verification must come from your independent mission verifier, not an LLM claim.
receipt = await mission.finish(verification=verification)
```

`enabled` defaults to false. `MEMORABLE_DIMENSIONAL_DISABLED=1` overrides it.
The CLI separately checks local store consent. Provider API keys never enter
the memory subprocess environment. A missing CLI, failed recall, and refused
storage are reported in `mission.diagnostics` without changing tool results.
Host tool exceptions still propagate. Store failures retain the sanitized
request in `mission.pending_store`; persist it securely and retry with the same
ID if needed. A timeout can mean storage committed before the receipt was lost.

## Metadata and execution semantics

| Role | Fields |
|---|---|
| Exact eligibility | `project`, `site`, `map_version`, `robot_capabilities`, `tool_schema_version`, `outcome` |
| Semantic retrieval input | `task`, `workflow`, `steps` |
| Returned context | `verification` |
| Local-only metadata | `notes` |

Use stable, application-selected labels. `robot_capabilities` is an exact-match
compatibility fingerprint, not a subset/capability inference engine. These
filters do not replace authentication or workspace isolation.

By default, only tool names, argument **field names**, observed response/error
status, call IDs, order, and duration are captured. Raw arguments, images,
point clouds, and arbitrary result text are omitted. Supply `projection=` to
retain approved checkpoint IDs, outcomes, or short procedure steps. The
developer must minimize/redact custom projections and verification evidence.
Making `notes` private does not make copies embedded in `trace` private.

`navigate_with_text` can return after setting a goal, before arrival. A returned
MCP result means **result received**, not mission success. Only an explicit
`verification["ok"] is True` marks the mission verified; overflow or projection
failure prevents that classification. Partial/unverified traces can be stored
but this adapter recalls only verified ones. Wait for all outstanding calls
before `finish()`.

Context is capped at 6,000 characters. Historical steps are reference data; the
current robot must plan motion from fresh observations. There is no automatic
deterministic robot replay or safety-controller override.

## Real connection check

Run upstream dimOS's actual MCP server without robot hardware:

```sh
dimos --viewer none --mcp-port 19990 --n-workers 2 run mcp-server
python packages/dimensional/examples/readiness.py \
  --memorable-cli /absolute/path/to/compatible/cli.js \
  --output /tmp/dimos-memory-readiness
```

This reads actual `server_status` and `list_modules` tools, checks their
inventories and operating-system process liveness, stores the first run, and
recalls it on a fresh mission. It then exercises disabled memory, kill switch,
missing CLI, unset consent, and a different map version against the same real
server. The example creates an isolated local store with explicit consent;
embeddings are off, so it makes no embedding-service requests.

To let a real model choose these read-only diagnostic calls, add:

```sh
  --model gpt-4.1-mini --env-file /absolute/path/to/.env
```

This optional mode requires `langchain==1.2.3`, `langchain-openai`, and
`python-dotenv`. It makes paid model requests using `OPENAI_API_KEY`; only the
two diagnostic tools are exposed. The second agent receives the recalled
context. Control cases remain scripted. The check reports actual usage, not
estimated token savings. Use a new output directory for each experiment.

See [the integration and evidence report](../../docs/DIMENSIONAL.md) for the
pinned upstream commit, actual results, and robot-simulation blocker.

## Scope

The built-in dimOS `McpClient` performs its own HTTP calls. Merely creating this
wrapper does not intercept that worker, another MCP client, autonomous tool
streams, or background navigation completion. An integration with that built-in
agent needs explicit capture at `_mcp_tool_call`, mission boundaries supplied by
the application, and context delivery before `add_message`. This package's
verified path is an external agent using the wrapped upstream `McpAdapter`.
