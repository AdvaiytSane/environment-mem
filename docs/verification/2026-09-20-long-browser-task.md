# Long Browser Use task: lower resource use, no verified successful completion

The same task was run without injected memory, then in a fresh browser with the
first run's trace recalled through Memorable. **The second run used fewer tokens,
but neither passed the task verifier. This does not establish savings for correct
work.** This is one pair, with a budget-limited baseline.

## Task and measured results

Audit all ten listing pages of quotes.toscrape.com: quote counts, exact `love` tag
counts, first/last authors per page, and aggregate totals. Then read the site's
five biographies for Albert Einstein, Marilyn Monroe, Jane Austen, Mark Twain and
Bob Marley, returning birth dates and birth locations. The verifier independently
observed the actual page DOM; its answers were never supplied to the agent.

| Measurement | Without injected memory | With injected memory |
|---|---:|---:|
| Provider input tokens | 975,054 | 830,992 |
| Provider output tokens | 31,807 | 21,565 |
| Total tokens | 1,006,861 | 852,557 |
| Cached input tokens (included in input above) | 796,288 | 709,376 |
| Provider API calls, including extraction | 74 | 66 |
| Actual finished actions captured | 73 | 59 |
| Agent execution time | 296.138 s | 240.412 s |
| Estimated model API cost, accounting for cached input | $0.2020264 | $0.1540880 |
| Hypothetical cost if all input were uncached | $0.4409128 | $0.3669008 |
| Required listing pages visited | 10/10 | 10/10 |
| Required author pages observed | 1/5 | 5/5 |
| Independent task verification | Failed; token budget reached, no valid final answer | Failed; final answer had incorrect counts |

Raw resource reductions: **15.33% tokens**, **23.73% estimated model cost**, and
**18.82% agent time**. The uncached-equivalent model-cost difference is 16.79%.
These are measured differences between these two attempts, not causal or
statistically established Memorable savings. The baseline stopped at its token
budget, so it does not measure the resources needed to finish the task correctly.

The second answer reported **98 quotes instead of 100**, gave page eight eight
quotes instead of ten, and gave page nine zero `love` tags instead of one. Its
aggregate love count happened to be correct at 14 despite the erroneous page
row. Birth details also lost spaces, failing the requested exact-text check;
the incorrect numerical results alone are sufficient to fail verification.

## Exact setup and memory path

- Unmodified Browser Use 0.13.10, source `d8110c5`; pinned OpenAI model
  `gpt-4.1-mini-2025-04-14`, temperature 0, seed 42, standard service tier.
- Fresh headless Chrome profiles and independent working-note directories.
  Same task, tool registry and generation settings in both conditions. Vision
  and model judge were disabled. Standard `evaluate` could read the current DOM;
  external search and programmatic multi-page fetching were excluded from the task.
- Limits: 80 agent steps, 8,192 maximum completion tokens per call, 30-minute
  timeout and a one-million-total-token stop check between steps. An in-flight
  call can overshoot that token threshold.
- Capture was enabled in both conditions, so instrumentation overhead was shared.
  The first run had an empty isolated local store and no injected reference.
- Native Memorable CLI patch `68d941a` used the existing local procedure store and
  production `cf:@cf/baai/bge-m3` embeddings, 1,024 dimensions. No new database or
  browser HTTP resolve endpoint was used.
- Only the task/workflow and deterministic counts of observed step summaries
  were embedded. The full accepted redacted action trace remained stored.
- The baseline failed, so its metadata remained `outcome: unverified`. The second
  run explicitly requested that outcome and used a benchmark renderer labeling
  the reference **unsuccessful**, rather than the default verified-only renderer.
  This did not convert the failed memory into a verified workflow.
- Recall returned baseline ID `e3099d68-761b-44a8-8e46-0b9ead737d12`. The outgoing
  provider request was checked for the actual reference delimiter. The injected
  reference was **3,811 bytes**, an excerpt of the first 50 of 73 captured actions.
  It contained 32 unknown-detail markers. No final answer or verifier answers
  were injected.

[Exact injected reference](2026-09-20-long-browser-reference.txt) ·
[Full numerical report and provenance](2026-09-20-long-browser-task.json) ·
[Runnable benchmark](../../packages/browser-use/examples/long_task_benchmark.py)

The default adapter cannot yet give useful summaries for much of this task's
`evaluate`, `find_elements`, file-note and extraction work. A sequence dominated
by missing-detail markers is weak procedural guidance. This is a limitation of
this adapter and the current bounded renderer, not a finding that all procedural
memory is ineffective.

## Accounting, failed attempts and reproduction

Token counters came from **actual OpenAI response usage**, including page
extraction calls and a response whose structured-output parsing failed. Counting
only successfully parsed Browser Use responses would undercount that failed call.
No token values were estimated from character length.

Model costs are estimates using the [official GPT-4.1 mini rates](https://developers.openai.com/api/docs/models/gpt-4.1-mini)
checked September 20, 2026: $0.40/M input, $0.10/M cached input, $1.60/M output.
These are not billing invoices. Memorable's embedding endpoint returned no
billable token/cost breakdown; its monetary cost is **unknown, not zero**. Local
compute cost is excluded. Measured treatment preparation (including recall and
initial observation) took 1.105 seconds; treatment storage took 0.719 seconds.

Two earlier baseline-only attempts are preserved in the JSON report. The initial
task incorrectly requested Oscar Wilde, who is absent from this site's author
listing, and the first verifier excluded HTTP author pages. A later revision fixed
that verifier and response limit. The final pair replaced the absent author with
Bob Marley and used the same DOM-counting guidance in both conditions. The earlier
attempts also produced incorrect numerical results; they are not savings evidence.
They used 572,891 and 344,640 tokens, costing an estimated $0.1284716 and $0.0669180.
All four attempts together cost approximately **$0.5515040 in model API usage**,
plus unreported embedding and local compute costs.

When the final baseline hit its budget, its structured-result accessor raised
before normal memory finalization. Its 73 finished action records were recovered
from the existing durable capture journal and stored with `runOutcome: interrupted`
and failed verification. No missing actions or successful outcome were invented.
The benchmark now handles missing structured output directly and offers an
explicit `--resume-failed-baseline` mode for the second condition. Baseline model
step count was not recoverable reliably, so compare the actual provider API-call
counts above; the report retains its last callback index separately.

From the environment-mem checkout, using a Python environment with this add-on
and Browser Use installed:

```sh
python packages/browser-use/examples/long_task_benchmark.py \
  --memorable-cli /path/to/memorable/packages/cli/dist/cli.js \
  --node /path/to/node24 --chrome /path/to/chrome \
  --env-file /private/path/.env --output /private/path/new-benchmark
```

The command explicitly enables an isolated local store. The environment file
supplies the OpenAI key; the existing Memorable configuration supplies embedding
access. Output includes private settings, owner-readable capture journals and
provider usage records; keep the output directory outside version control.
If the baseline is stored but fails verification, inspect its report and rerun
with the same output path and `--resume-failed-baseline` to measure the failed
attempt as explicitly labeled context. No additional tuning was applied to the
second condition in this measured pair.

A useful next evaluation needs richer safe action summaries, reliable completion
of the long task, and multiple counterbalanced runs. Until then, these numbers
must not be presented as successful-task token savings.
