# Three-minute Memorable demo

**Opening:** “Your agent is the fifth teammate. Memorable gives it working
memory: you decide what to capture and when to use it; we store and retrieve
relevant workflows.” This is product positioning, not a claim about hackathon
team-size rules or prize eligibility.

## Prepare before presenting

Use the `codex/memorable-connect` checkout and Node **24+**. The package is named
`headstart` (checkout version `0.1.0`), with `dejado` as an alias. Build it from
the repository root:

```sh
npm run build
node bin/headstart connect --repo packages/browser-use --target application --json
```

Keep that real inspection output and the dashboard's three **recorded
showcases** open. Inspection reports source candidates and metadata; its runtime
status fields remain `null`. It does not run an agent or connect hooks.

Browser Use and dimOS memory use the unpublished companion Memorable CLI
implementing `memorable.memory.v1`; the documented private branch is
`codex/metadata-cli`, commit `68d941a`. The published npm CLI alone cannot run
this contract. Local memory receipts do not prove hosted persistence. See
[metadata setup](METADATA-MEMORY.md) and [connection stages](CONNECT.md).

The website saves environment definitions and displays evidence snapshots.
Creating an environment does not install an adapter, stream runtime events, or
make a live connection. An optional runtime-dashboard link opens the user's
existing dashboard.

## Present in three minutes

| Time | Show and do | Say |
|---|---|---|
| 0:00–0:35 | Open **New environment**. Name it “Quotes workflow,” choose Browser Use, set recall before task and store after task completion. Show `project`, `website`, `outcome` as filters; `task`, `workflow`, `steps` as semantic; `verification` as context. Save and show **Awaiting integration**. | “Developers define the data shape and route their actual runtime calls. Filters set compatibility; selected semantic fields drive retrieval. Private fields stay out of recall and embeddings but still persist locally.” |
| 0:35–0:55 | Show the real CLI inspection's candidate locations and missing seams for capture, results, completion and injection. Open **Copy integration prompt** or the [integration skill](../skills/memorable-connect/SKILL.md). | “Your existing coding agent does the integration in your repo. The inspector locates candidates; the adapter must wire and verify them. The core stays `store()` and `recall()`.” |
| 0:55–1:40 | Open **Browser Use**. Show first-run receipt, second-run recalled ID, final URL/card count, and context-delivery evidence. Use the [recorded live-run JSON](verification/2026-09-19-metadata-browser.json), [SDK readback](verification/2026-09-19-metadata-sdk.json) and [failure controls](verification/2026-09-19-metadata-controls.json). | “Two real agents used unmodified Browser Use 0.13.10 and `gpt-4.1-mini`. The second paraphrased the task, retrieved the first run, and received a 500-byte reference in its actual model messages. Both independently reached page two with ten quotes. Both took three steps: this proves the memory loop, not a speedup.” |
| 1:40–2:25 | Open **Devin** with all 18 matched triplets and the static-document control visible. Show the three-arm figures below and the [recorded source/provenance](verification/2026-09-20-devin-recorded.json). | “This is the committed Devin recording, not a fresh session. Full memory used 22.15% less aggregate context than cold, but the static guide was almost identical on tokens and faster on average. We have not established a benefit over good documentation or measured dollar savings.” |
| 2:25–2:50 | Open **Dimensional**. Show actual `server_status` / `list_modules` calls, first storage receipt, second mission's recalled ID, and changed-map exclusion in the [MCP evidence](../packages/dimensional/evidence/2026-09-20-live-mcp-agent.json). | “The same contract also works around a different tool boundary. Two fresh agents used the real dimOS MCP server, with 325 characters delivered to the second. This verifies runtime readiness and memory; it does not demonstrate robot motion.” |
| 2:50–3:00 | Return to the environment overview: definitions, adapter seams, separate evidence stages. | “The goal is operational efficiency for the fifth teammate: reuse relevant experience and inspect what happened. Developers keep execution control. Dollars remain unmeasured; we measure capture, recall, context delivery and task outcomes separately.” |

Devin numbers are means across **18 runs per arm**, nine synthetic tasks with
two repeats, from source commit `87807eb084a2c1dd65a62967e0719b27087a7c10`:

| Recorded arm | Mean context tokens | Time | Tool calls |
|---|---:|---:|---:|
| Cold | 593,882 | 64.50 s | 17.67 |
| Static repository guide | 463,359 | 51.89 s | 14.61 |
| Facts + procedural recall | 462,350 | 54.33 s | 16.50 |

These are historical provider counters copied into runner summaries, mostly
cache reads; raw provider exports and final worktrees are unavailable. The
backend was **legacy local Headstart JSONL with lexical/compression ranking**,
not the new metadata or hosted Memorable backend. All 54 recorded checks passed
according to that runner; we did not rerun them. Full-memory discovery calls
rose 19.11% and bugfix context increased. [Audit and limits](verification/2026-09-20-devin-audit.md).

Browser Use's [evidence report](verification/2026-09-19-metadata-browser.md) pins
upstream `d8110c5ff87ccba887aaa726cdb780f2f84bef8d`; production embeddings were
`cf:@cf/baai/bge-m3`, 1,024 dimensions. dimOS was **0.0.14**, upstream
`c1c3cdc9d2ee54ca72259465688395699d7d99a2`, with LangChain **1.2.3**. Its readiness
check explicitly disabled embeddings; actual model tokens increased **435 →
552**. The single latency pair does not establish acceleration. See
[Dimensional scope and simulation blocker](DIMENSIONAL.md).

For Cognition, emphasize the recorded coding workflow and inspectable comparison.
For Dimensional, emphasize the real MCP integration boundary and independent
readiness checks. Sponsor relevance is a positioning choice; these observations
do not establish endorsement, prize eligibility, general savings or robot safety.

## Optional fresh runs outside the timed presentation

Commands below reuse the existing examples. Replace absolute placeholders and
use a **new private output directory** for each experiment. They are not a claim
that a fresh run occurred during this presentation. Keep keys and raw journals
out of screen sharing and source control.

**Browser Use:** use Python with the [optional package and Browser Use installed](../packages/browser-use/README.md),
Chrome, `OPENAI_API_KEY`, configured Memorable embedding access, and the compatible
companion CLI. This makes paid model requests and two real public-site runs:

```sh
python packages/browser-use/examples/metadata_browser.py \
  --memorable-cli /absolute/path/to/memorable/packages/cli/dist/cli.js \
  --node /absolute/path/to/node24 --chrome /absolute/path/to/chrome \
  --env-file /private/path/.env --output /private/path/new-browser-evidence \
  --enable-local-store
```

**dimOS:** use the [documented upstream environment](../packages/dimensional/README.md)
and installed optional package. Start the actual server in one terminal:

```sh
dimos --viewer none --mcp-port 19990 --n-workers 2 run mcp-server
```

In another, run the model-driven readiness example; it uses local memory with
embeddings off and makes paid OpenAI requests:

```sh
python packages/dimensional/examples/readiness.py \
  --memorable-cli /absolute/path/to/memorable/packages/cli/dist/cli.js \
  --node /absolute/path/to/node24 --output /private/path/new-dimos-evidence \
  --model gpt-4.1-mini --env-file /private/path/.env
```

**Devin:** only on a machine with working, authenticated native Devin CLI. This
uses disposable fixture lanes and the separate local Headstart demo backend:

```sh
HEADSTART_BACKEND=local node bin/headstart demo --agent devin --task bugfix-1
```

This repeats one task cold/warm; it does not reproduce the cross-task 54-run
evaluation. The current machine's [preflight](verification/2026-09-20-devin-preflight.json)
found no native Devin executable, so use the recording unless that prerequisite
changes. A missing CLI should yield a controlled failure, never a savings claim.
