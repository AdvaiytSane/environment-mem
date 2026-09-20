# Real Browser Use visual replay

A fresh run of `capture_metadata_replay.py` completed against
`https://quotes.toscrape.com` on September 20, 2026. The script extends the existing
`metadata_browser.py` example with screenshots around actual model steps. It does
not replace the agent's actions or create images from a scripted demonstration.

- Browser Use 0.13.10, OpenAI gpt-4.1-mini, local Chrome with fresh temporary profiles.
- First run: `7f76e4ec-591a-4af5-bb8f-f93915026d42`; 3 model steps:
  `click`, `find_elements`, `done`; 3 captured actions.
- Second run: `f9a5ea6b-c03b-41c1-b08a-7dee08bb4042`; 4 model steps:
  `click`, `extract`, `find_elements`, `done`; 4 captured actions.
- Both ended at the exact page-two URL with ten quote cards, checked separately
  through the live DOM. Both returned actual local Memorable storage receipts.
- The second run recalled the first ID with a paraphrased task. The existing
  verifier found the recalled reference in its actual model message list; the
  private marker remained absent. Production embeddings used the configured
  Memorable service. Project/site/outcome exclusions and the unrelated-query
  check still passed in the existing example.

The sanitized bundle contains `replay.json` using `memorable.replay.v1` and 16 PNG
files. Eighteen frame references (including reused final verification frames)
were checked against the saved images; recorded image digests matched. JSON was
checked for the configured credential values, private marker and local paths.
Representative before/after screenshots were inspected and show the real
page-one to page-two transition.

Before frames come from the browser state supplied to the model; the callback
runs after the model responds but before its proposed actions execute. After
frames are taken after the whole model step. A step may contain multiple actions,
so these are not per-click videos. Proposed actions and observed tool result
flags are separate. Unknown mapped actions stay unknown. No cursor or movement
is invented. Durations cover the callback-to-after-frame interval, including
screenshot capture; they are not full model latency or a performance benchmark.

This is visual playback of a recorded execution, not deterministic browser replay.
The second run used more model steps; this is evidence of recall/context delivery,
not a speedup. Receipts concern the existing encrypted local procedure store,
not hosted persistence.

## Reproduce

Run `packages/browser-use/examples/capture_metadata_replay.py` with the same
arguments as `metadata_browser.py`: a compatible `--memorable-cli`, `--node`,
`--chrome`, private new `--output`, `--env-file`, and `--enable-local-store`.
It requires the companion CLI supporting `memorable.memory.v1`, existing
Memorable embedding access and an OpenAI key. Each run needs an empty isolated
output/store directory.

Only the output's `replay/` subtree is intended for a public demo. The parent
contains private journals, configuration/encryption keys and logs and must not
be copied into website assets. The recorder intentionally supports only this
public quotes origin. Review screenshot contents before publishing.
