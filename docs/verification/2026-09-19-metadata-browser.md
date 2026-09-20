# Browser Use metadata memory: live evidence

September 19, 2026. This verifies **local CLI memory plus production embeddings**,
not a deployed HTTP store/recall service. The companion CLI patch is local and
unpublished (`codex/metadata-cli`, commit `68d941a`); the public SDK alone does not add this feature to an older CLI.

## Actual two-run experiment

Used unmodified Browser Use 0.13.10, Chrome with fresh temporary profiles, and
OpenAI `gpt-4.1-mini` through OpenAI's endpoint. Memorable's configured production
embedding endpoint returned `cf:@cf/baai/bge-m3` vectors with 1,024 dimensions.
Existing local-store consent was explicitly enabled in an isolated encrypted
store. Browser Use source revision: `d8110c5ff87ccba887aaa726cdb780f2f84bef8d`.

| Observation | First run | Second run |
|---|---|---|
| Task | Visit page two and confirm ten quotes | Move to the next quote-listing page and check ten entries |
| Actual actions | click, extract, done | click, extract, done |
| Model steps / errors | 3 / 0 | 3 / 0 |
| Captured action records | 3 | 3 |
| Independent final-page check | `/page/2/`, ten `.quote` cards | `/page/2/`, ten `.quote` cards |
| Local storage receipt | Stored, embedding ready | Stored, embedding ready |
| Recall | Empty initial store | Retrieved first run's identity |
| Reference in actual model message list | No reference needed | Yes, 500 bytes |

The second run retrieved `cbdbead6-1a68-4e2b-9ad0-c36802002ea8` from the first
run. The trace preserved a conservative unknown marker for `extract`; it did not
invent success or retain raw extracted content. The final browser screenshot was
visually inspected and showed page two of the public quotes website.

Afterward, the **final CLI build** was exercised through the actual TypeScript
SDK in fresh subprocesses: the same run ID returned a duplicate receipt,
paraphrased recall returned the saved trace with exact JSON equality, and a
private metadata field was omitted. A query containing an email-shaped identifier
was refused with `semantic_text_requires_redaction` before embedding.

The final renderer additionally checks the saved verification evidence before
rendering a verified workflow. A small wording change after the two-agent run
clarifies that unknown action details were omitted; the report's 500-byte hash
identifies the reference that was actually sent during that run.

## Negative and failure controls

Changing project, website or outcome produced zero eligible memories and zero
matches, with no embedding request. An unrelated database-maintenance query
returned zero matches. The private sentinel was absent from recall output and
the actual model message lists.

Four additional **scripted real-browser runs**, without a model, clicked the
live Next link and independently verified page two and ten quote cards:

| Condition | Browser task | Memory result |
|---|---|---|
| Disabled | Completed | No context, captured actions or journal |
| Kill switch | Completed | No context, captured actions or journal |
| Missing CLI | Completed | Recall/store diagnostics, retained outbox |
| Local consent unset | Completed | `consent_required`, retained outbox |

These controls caught a CLI exit-status bug during development: the global
successful exit overrode the new command's error status. It was fixed, rebuilt,
and the controls were rerun successfully. An existing encryption test also had a
hardcoded developer-specific import path; it was made relative before rerunning.

Supporting checks: 55 public Node checks, 22 Python checks, and 32 targeted private
core checks. These cover protocol/transport, role isolation, local encryption,
ranker model compatibility and existing procedure behavior; they supplement the
live observations above.

## Reproduce and interpret

Run [metadata_browser.py](../../packages/browser-use/examples/metadata_browser.py)
with the compatible CLI, Chrome, OpenAI key, configured Memorable embedding access,
new private output directory and `--enable-local-store`. Run
[metadata_controls.py](../../packages/browser-use/examples/metadata_controls.py)
with the same CLI/Chrome and a separate output directory; it needs no model key.
See [setup and contract](../METADATA-MEMORY.md).

Sanitized machine-readable evidence:
[agent runs](2026-09-19-metadata-browser.json),
[failure controls](2026-09-19-metadata-controls.json), and
[final SDK readback](2026-09-19-metadata-sdk.json).
Private journals, encryption keys, provider credentials and raw model messages
are not included in this repository.

This proves captured-memory storage, retrieval and actual context delivery for
one public-site workflow. Both model runs took three steps; no speedup or causal
performance improvement was demonstrated. This is not a large-corpus relevance
benchmark, a remote-storage durability claim, or deterministic replay.
