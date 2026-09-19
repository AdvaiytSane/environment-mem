# Memorable for Browser Use

An optional Python add-on around Browser Use's existing `Tools.act()` boundary.
The main CLI exposes two generic operations; Browser Use capture and browser
service mapping live in this package. Browser Use's source does not need a patch.

```text
Browser Use → this add-on → headstart memory store|recall → package driver → Memorable
```

This package is source-installable, not published on PyPI. It requires Python
3.11+, Node 24+, and the environment-mem CLI from this branch. The optional
Browser Use dependency matches the source inspected for this integration.

```sh
python -m pip install ./packages/browser-use
# Optional: install the inspected Browser Use release too.
python -m pip install './packages/browser-use[browser]'
npm run build
```

## Connect your application

Construct `CliMemory` with the main CLI's argv prefix. Use the installed
`headstart` command, or `[node_path, "/path/to/environment-mem/dist/cli.js"]`.
No shell is involved. The packaged JavaScript driver is selected automatically.
Only Memorable credentials and necessary system variables reach the subprocess;
unrelated model-provider credentials are removed from its environment.

The application chooses the original task, opt-in setting, journal directory,
state collection, redaction, completion checks and allowed websites. The add-on
owns run IDs, execution order, actual action boundaries and the local outbox.

```python
from functools import partial
from browser_use import Agent, Tools
from memorable_browser_use import CliMemory, collect_page_snapshot, run
from memorable_browser_use.wire import BrowserWire

memory = CliMemory(
    command=["headstart"],
    config={"allowedOrigins": ["https://docs.example.com"]},
)
wire = BrowserWire(
    label_salt=stable_workspace_salt,  # Keep stable and private between runs.
    task_label="Find a topic in the public documentation",
    instance_id=stable_installation_uuid,  # Persist one UUID for this application.
    allowed_path_segments=["docs"],
)

async def current_state():
    return wire.snapshot(await collect_page_snapshot(browser_session))

history = await run(
    partial(Agent, llm=llm, browser_session=browser_session),
    tools=Tools(),  # An existing Tools instance with custom actions also works.
    task="Find the documentation for the requested topic",
    memory=memory,
    enabled=True,
    journal_dir=".memorable/browser-use",
    state_provider=current_state,
    normalize_event=wire.normalize_event,
    recall_request=wire.recall_request,
    store_request=wire.store_request,
    render_recall=wire.render_recall,
    verify=lambda history: independently_check_final_page(),
)
```

`llm`, `browser_session`,
`independently_check_final_page`, `stable_installation_uuid` and `stable_workspace_salt` are application
inputs. The packaged `collect_page_snapshot` reads bounded semantic metadata from
Browser Use's current page; you can replace it for a site's special needs.

`allowedOrigins` is required by the packaged driver. Set it to the exact sites
your application permits. The driver uses the endpoint in Memorable's existing
configuration (or explicit `apiUrl`) and Memorable's API key, never the
browser agent's model key. Set `config={"allowedOrigins": [...], "offline": True}`
to exercise real local browser capture and outbox behavior without any HTTP
memory requests. Offline mode reports a transport error and retains the outbox;
it does not pretend to store a memory.

Start the browser on an allowed HTTP(S) page before calling `prepare`/`run`;
`about:blank` cannot provide a usable fingerprint. Keep the session alive through
your final verifier (`BrowserSession(keep_alive=True)`) and close it afterwards.
The live example supplies a complete lifecycle.

Recall happens before constructing a fresh Agent, so the Agent receives the
actual prepared task context at initialization. The stored task stays separate
from recalled text. The reference is bounded and marked as untrusted material;
the renderer decides which compatible result to include. This is advisory context,
not deterministic replay.

The lower-level lifecycle also works without an LLM:

```python
capture = BrowserMemory(...)  # The same options accepted by run().
await capture.prepare()
tools = capture.wrap_tools(existing_tools)
result = await tools.act(action, browser_session=browser_session)
await capture.finish(verification={"status": "passed"})
```

Import `BrowserMemory` from `memorable_browser_use`. Calling `finish` ends
capture for that wrapper. Create another instance for another run.

## Metadata and outcomes

`BrowserWire.snapshot` accepts `url`, `viewport_width`, and semantic
`nodes`: each node contains `role`, `name`, `depth`, and a snapshot-specific
`ref` or `index`; optional `href`, scroll offsets and settling state can enrich
the observation. Its output minimizes URLs and hashes labels. The wire mapper
does not transmit raw screenshots or page text. A stable workspace salt is
necessary for fingerprints to remain comparable.

The collector covers the top frame's light DOM. It does not enter iframes or
shadow roots. It never refreshes Browser Use's action map: an element index is
attached only when the existing cached page URL, XPath, tag and accessible name
agree. Such indices still describe that snapshot, not reusable locators. Its
`settled` flag means the document finished loading, not that application activity
has stopped.

Advanced integrations can replace every mapping callback:

| Callback | Receives | Returns |
| --- | --- | --- |
| `state_provider()` | Nothing | Current page metadata |
| `normalize_event(event)` | Actual action, result, before/after state, call ID, sequence and phase | Redacted JSON to retain, or `None` to drop |
| `recall_request(record)` | Original task, run/session IDs and initial state | Driver request, or `None` |
| `render_recall(result)` | Driver's structured recall result | Compatible reference text, or `None` |
| `store_request(record)` | Normalized events, final state and independent verification | Driver request, or `None` |
| `verify(history)` | Completed Agent history | An application-defined verification result |

Callbacks may be synchronous or asynchronous. A normalizer is required when
capture is enabled; its output is written to disk. Raw action/result snapshots
exist only in memory before normalization. Callback authors are responsible for
removing secrets and typed parameter values from their own mappings. The default
wire mapper is deliberately conservative.

An action's `returned` status means Browser Use returned a result, not that the
action succeeded. `success=None` stays unknown. Raised exceptions and cancellation
are recorded and re-raised. A run's `completed` outcome describes control flow;
only the separate verifier describes task completion. Browser service event
schemas cannot represent every unknown outcome: the default mapper retains a
local drop reason instead of inventing success.

## Reliability and current limits

Memory is off by default. `MEMORABLE_BROWSER_USE_DISABLED=1` stops recall, capture,
context injection, storage and explicit retries. Journals and outbox files use
mode `0600`. Keep their directory outside version control. Action attempts are
journaled before execution; a process crash can leave an attempt without a result.

Recall defaults to a five-second deadline. CLI calls default to 30 seconds and
2 MB combined output. Optional memory errors are available through
`BrowserMemory.diagnostics` and do not replace browser results/exceptions.
The high-level `run` helper returns normal Agent history; use the lower-level
lifecycle when your application needs the capture object and its diagnostics.

Store writes a request to the outbox before invoking the CLI. Failed requests
remain pending; `await retry_pending(memory, journal_dir)` retries the same body
and run ID. A completed transport receipt is not independent proof of database
durability. Timeouts can occur after the service accepted a request, so this
package does not promise exactly-once storage. The packaged driver treats a
partial/rejected/truncated ingest response as `partial_ingest`, even if its HTTP
status is 200, and leaves the original request pending.

Live browser-service authorization, full LLM-driven execution, storage readback,
and successful paraphrase recall are separate verification gates. Consult the
repository's dated evidence report for what was actually observed; local
regression tests do not establish those gates. This package does not yet have
evidence of a successful hosted browser-memory store-and-recall round trip.

The default runtime advertises no deterministic execution capabilities. The
backend's compiled-program resolver may therefore return no useful program;
this is an unresolved advisory-retrieval contract, not an empty-memory guarantee.
Fingerprints from this conservative mapper also need not match another adapter's
fingerprints. Consult the [live report](../../docs/verification/2026-09-19-browser-use.md)
for these limits and the required upstream decisions.

## Run the real browser example

```sh
python packages/browser-use/examples/live_browser.py \
  --node /path/to/node24 --cli dist/cli.js \
  --chrome /path/to/chrome --output /private/path/browser-evidence
```

Use the Python environment containing Browser Use and this package. The default
executes real browser actions on a public website, independently checks its
contents, and keeps memory offline. Add `--agent` only with a configured
`BROWSER_USE_API_KEY`; add `--remote` only with authorized Memorable browser-service
access. The output directory contains private salt settings, journals and a
screenshot, so keep it outside version control. The existing evidence covers the
scripted browser mode; the model-driven remote path remains unverified.

```sh
PYTHONPATH=packages/browser-use python -m unittest discover -s packages/browser-use/tests -v
```
