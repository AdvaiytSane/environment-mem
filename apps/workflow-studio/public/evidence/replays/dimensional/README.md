# Dimensional recorded replay assets

`replay.json` follows the console UI contract: six real captured tool calls in
sequence, followed by the recorded application verification and native storage
receipt. `measurements.json` preserves the detailed normalized evidence. `frame` is absent
for movement calls. A UI may hold the last observed frame while a move is selected,
but must label it as the previous observation; it is not footage of movement.
The final verification is separate from the tool list because it was an
application check, not an MCP tool call.

Use “Recorded MuJoCo run” and “Unverified mission”. Playback speed is presentation
speed: only per-call durations and whole-run elapsed time exist, not complete
wall-clock timestamps or model gaps. Do not show this as a live robot or continuous
video. The three JPEGs are unchanged real simulator output and their SHA-256 hashes
match the original report. Events 1 and 2 reuse the same frame deliberately.

Visual progression: initial view along the office aisle; shifted view toward the
right-side chairs after A; rotated view of desk legs and a simulated person's
lower leg after the return attempt. Pose measurements, rather than these visual
impressions, establish movement and failed arrival.

`source-report.json` is byte-for-byte copied from the committed evidence. Derived
XY distances and heading angles are explicitly separated under `derived` fields.
No simulator was rerun and no frame was edited or generated for this replay.
