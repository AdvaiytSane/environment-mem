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
The example also includes an explicit `--agent` mode, which was not run because
no Browser Use model key was available.

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
configured browser-service access and `BROWSER_USE_API_KEY`, add `--remote --agent`
for the next experiment. Keep the same private output settings across repeated
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
