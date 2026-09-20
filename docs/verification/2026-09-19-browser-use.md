# Browser Use integration: actual evidence and remaining gates

Recorded September 19, 2026. The optional package works at Browser Use's executed
tool boundary on a real public website. **Hosted browser-memory storage, recall,
context consumption by a model and deterministic replay are not verified.**

## Real browser experiment

Cloned the unmodified [Browser Use repository](https://github.com/browser-use/browser-use)
at commit `d8110c5ff87ccba887aaa726cdb780f2f84bef8d` (version `0.13.10`). Installed
it in an isolated Python 3.12 environment and installed this add-on alongside it.
Used local Chrome with a new temporary profile, not the operator's signed-in profile.

The [runnable example](../../packages/browser-use/examples/live_browser.py)
called real `Tools.act()` operations: navigate to `https://quotes.toscrape.com/`,
click its live “Next” element using Browser Use's current index, attempt input
using an invalid index, execute an existing custom tool, then finish. A separate
DOM query verified the final URL was `https://quotes.toscrape.com/page/2/` and
the page contained ten quote cards. A screenshot was inspected locally.

These were predetermined tool calls, **not decisions produced by an LLM**.
The example also includes an explicit `--agent` mode, which was not run during
that initial experiment because no Browser Use model key was available. A later
attempt using the supplied key is recorded below; authentication was rejected.

| Observation | Actual result |
| --- | --- |
| Final run | `041f5b33-1965-4dff-ae8b-f2dd56fefcd5` |
| Completed calls retained locally | 5, with individual IDs and ordering |
| Uploadable events | 3: navigation, verified link click, independently verified end |
| Invalid input | Local omission marker `target_not_observed`; no invented success |
| Existing custom tool | Still executed and counted 10 cards; default wire mapper reported `unsupported_verb` |
| Typed test value | Absent from the journal and outbox |
| Memory transport | Actual main CLI and packaged driver, explicitly offline |
| Memory failure effect | Browser task completed; store body remained in the local outbox |
| Hosted receipt / recalled procedure | None |

The first complete run uncovered a real capture bug: the page's “Next” link
contained an `aria-hidden` arrow. The DOM collector included the arrow while
Browser Use's accessible name excluded it, so the target could not be matched.
The collector now excludes hidden descendants. A fresh run confirmed the target
matches without refreshing or changing Browser Use's action map. The earlier
run's evidence was retained separately.

All three final events and all six before/after fingerprints were checked
against the existing upstream event/fingerprint validators from Memorable commit
`101666176b842f1d1053c2c132dcdd2a0640838a`. They were accepted **by the local
validator**. This is contract compatibility evidence, not an HTTP acceptance,
database receipt, discovery result, or retrieval result.

See the [sanitized run summary](2026-09-19-browser-use.json). Raw local output,
private salt/configuration and browser profiles are not part of this repository.

## Why the full round trip is incomplete

A read-only request to the configured service's `/v1/browser/resolve` route
returned HTTP 403:

```json
{
  "error": "insufficient_scope",
  "required_scope": "procedures:resolve",
  "granted_scopes": ["evaluations:write"],
  "request_id": "48fa6d38-e54f-44c7-9e2d-1c17f7dca940"
}
```

That was an authorization probe with an empty body; it did not establish valid
resolve-payload acceptance. No workspace permission or credential was changed.
After this refusal, browser verification ran in explicit offline mode. There was
no attempt to disguise another endpoint or key as successful recall.

The optional driver calls the browser-specific ingest/resolve contract observed
in upstream source. It does not run browser traces through the published CLI's
generic extraction path, which would drop important browser fields. The core
CLI remains a generic module dispatcher; these browser details live in the add-on.

Other limits matter even after authorization is repaired:

- The collector covers top-frame light DOM; iframe and shadow-root actions need
  another collector. A loaded document is not proof the application has settled.
- The conservative normalizer hashes page labels and templates paths. Its
  fingerprints are not guaranteed equivalent to other adapters. Use the same
  stable workspace salt and normalizer across runs; a salt mismatch is an error.
- Capture-only runtime capabilities are intentionally empty. The backend's
  compiled-program resolver may therefore return no useful program. A successful
  HTTP response alone would not prove useful advisory retrieval. A supported
  read-only workflow/trace response, or reviewed capability semantics, is needed
  before making that claim. The add-on does not implement a deterministic executor.
- Unsupported or unverified calls remain local omission records. The API schema
  cannot express all unknown outcomes. This package does not promise full trace
  fidelity or automatic extraction of arbitrary custom actions.
- A partial HTTP 200 ingest response is a failure for this client and retains the
  outbox. Inspect a finalized partial run before retrying; a repeated finalized
  request can be refused. Local receipts do not prove independent durability.

## Reproduce and finish verification

From this checkout, with Browser Use installed in an isolated environment:

```sh
npm run build                         # Node 24+
uv pip install --python /path/to/venv/bin/python -e packages/browser-use
/path/to/venv/bin/python packages/browser-use/examples/live_browser.py \
  --node /path/to/node24 \
  --cli dist/cli.js \
  --chrome /path/to/chrome \
  --output /private/path/browser-evidence
```

This defaults to real browser execution with offline memory. With legitimately
configured browser-service access and `OPENAI_API_KEY`, add
`--remote --agent --provider openai --env-file .env` for the next experiment.
Alternatively, choose `--provider browser-use` with `BROWSER_USE_API_KEY`.
Keep the same private output settings across repeated
runs so the salt and installation ID remain stable. Do not commit that directory.

The next evidence gates are: a fully accepted ingest receipt; independent readback
of the resulting workflow/procedure; a fresh client recalling it with both close
wording and a paraphrase; inspection of the actual context supplied before the
model acts; and independent verification of that second task. Preserve no-match,
capability, salt and discovery failures rather than counting a 200 as success.

Supporting regression checks also ran: 52 Node checks (including real local and
packed-package installs) and 14 Python checks. A Python wheel was built and
installed separately, and its packaged driver reached the real main CLI.
Loopback HTTP checks used fake credentials to verify refusal, partial receipts,
timeouts, response limits and redirect handling. These checks support the live
observations above; they do not replace the outstanding production gates.

## Follow-up: model provider mismatch

At approximately 22:29 UTC on September 19, the real `--agent` example was run
using the user's new `.env` value. The value was loaded into the process without
being printed, and unrelated provider keys remained excluded from the Memorable
subprocess. The real Browser Use client used the production endpoint and model
`bu-2-0`.

Browser Use returned HTTP **401, “Invalid API key.”** The host's normal failure
loop retried, then ended without executing any model-selected tools. The separate
page check correctly failed: the browser was still on the first page. Run
`d722f54b-c821-4ec5-872e-906fdbd9f213` retained zero completed action events and
produced no store request. No successful LLM execution is claimed.

A local check confirmed that the client received exactly the configured value,
with no surrounding whitespace, embedded newline, placeholder or accidental
variable assignment. No further authenticated request was made after that
diagnosis until the user clarified its provider. The key was not included in
published evidence.

The user then confirmed this was an **OpenAI key**. It had been placed in the
Browser Use placeholder. The 401 therefore establishes a provider mismatch, not
an invalid OpenAI credential. The earlier request sent that key to Browser Use.
The variable was renamed to `OPENAI_API_KEY` while preserving its value, and the
example now requires an explicit provider, selects that provider's key and
endpoint, and stops after one unsuccessful agent step without a recovery retry.
It supports `--env-file` so loading the selected key is part of the reproducible
command. The OpenAI path uses Browser Use's `ChatOpenAI` implementation and the
[documented GPT-4.1 mini model](https://developers.openai.com/api/docs/models/gpt-4.1-mini).

The Memorable configuration file was unchanged since September 13, and no new
Memorable credential was supplied. Its earlier authorization refusal was not
retried; memory stayed explicitly offline. Model authorization and authorized
Memorable browser access are separate requirements, alongside the advisory
retrieval contract described above.

See the [sanitized failed-run summary](2026-09-19-browser-use-agent.json). Raw
provider logs, screenshots and the `.env` file remain local and outside the
committed evidence.

**Corrected provider: successful real agent run.** With the same key routed
directly to OpenAI, `gpt-4.1-mini` produced three model-output steps: `click`,
`extract`, and `done`. The wrapper retained three completed actions for run
`d2a597c4-905f-41bf-ad1a-bffbc9a159ff`. The host reported no step errors. An
independent DOM check verified page two and ten quote cards, and the resulting
screenshot was inspected. Browser Use reported 51,308 total tokens; this is host
usage reporting, not a billed-cost measurement.

Two events were eligible for the browser API: the observed successful link click
and independently verified completion. The extraction tool's outcome stayed
unknown under the conservative default mapper, so it retained an explicit local
omission record. The task-level check does not retroactively prove every
individual extraction result. The pending outbox was retained because memory
was explicitly offline. No hosted store receipt, recalled memory, or memory
context consumption is claimed.

Reproduce the corrected model route using:

```sh
/path/to/venv/bin/python packages/browser-use/examples/live_browser.py \
  --agent --provider openai --env-file .env \
  --node /path/to/node24 --cli dist/cli.js \
  --chrome /path/to/chrome --output /private/path/openai-browser-evidence
```

The `.env` file holds `OPENAI_API_KEY`, remains owner-readable only and is ignored
by Git. The default command keeps Memorable offline. See the
[successful agent summary](2026-09-19-browser-use-openai.json) for the observed
results and local contract checks. The earlier failed provider attempt remains
documented rather than being replaced by this success.

## Replacement-key run and local context implementation

After the user replaced the OpenAI credential, a fresh real agent run
`cf2eae22-3eb1-4344-9335-3f08ac5da514` succeeded through the explicit OpenAI path.
It produced three model-output steps (`click`, `extract`, `done`), reported no
agent errors, and retained three completed action records. Independent DOM
inspection again verified page two and ten quotes; the screenshot was inspected.
The actual click and completion events passed the existing server's local event
and fingerprint validators. The extraction outcome stayed unknown and was omitted
from the upload payload. Browser Use reported 38,348 tokens, not a billed amount.

The Memorable transport was explicitly offline. The outbox remains pending and
the run has no store receipt, recalled context, or demonstrated memory reuse.
See the [sanitized replacement-key evidence](2026-09-19-browser-use-openai-replacement.json).

With explicit user approval, the backend's separate `mode: "context"` response
was prepared on local private branch `codex/browser-advisory-context`, based
on `101666176b842f1d1053c2c132dcdd2a0640838a`, committed as
`a019d27fb61754bf219738f2b86bb280c1517064`. The public add-on now requests and
validates this contract; it refuses replay-only responses. The local change
retains authorization and policy checks and has not been deployed.

Inspection also found the distinction between event acceptance and workflow
discovery: the backend writes captured events but the inspected checkout has no
wired process promoting them into the workflow tables queried by recall. This
must be resolved before an accepted trace can establish a complete store/recall
loop. The [handoff contract](../BROWSER-CONTEXT.md) records these remaining gates.

A local probe passed the two actual captured events through the real worker
handler using its explicitly fake database fixture. It accepted both events and
finalized the run, created zero workflows, and returned HTTP 503
`resolve_unavailable` on context recall. No workflow was seeded. This supports
the wiring diagnosis; it is not evidence of durable storage or production
retrieval. The uploaded sequence remains 1 then 3, preserving the omitted
extraction outcome; the server accounts for that as two received events out of
three expected, which must be considered by any discovery implementation.

Focused client checks cover malformed references, conditions, target identity,
approval preservation under truncation, and refusal of replay-only responses.
The full SDK suite completed with 53 Node checks and 19 Python checks. One first
attempt used the system's unsupported Node 20 and failed on TypeScript loading;
rerunning with the required Node 24 environment resolved those runtime failures.
These are supporting regressions, not a substitute for the live memory gates.
