# headstart eval

4 runs, runner claude, model sonnet. Arms: cold, full. Mean and standard deviation over successful runs.

| metric | cold (n=2) | full (n=2) | full vs cold |
|---|---:|---:|---:|
| context tokens (input + cache reads + cache writes, all turns) | 980,507 ± 435,417 | 812,167 ± 358,871 | -17% |
| uncached input tokens | 34 ± 14 | 28 ± 11 | -18% |
| cache read tokens | 936,292 ± 433,191 | 768,994 ± 354,548 | -18% |
| output tokens | 2,995 ± 1,022 | 4,003 ± 1,833 | +34% |
| tool calls | 15.0 ± 8.5 | 17.5 ± 6.4 | +17% |
| calls before first edit | 8.5 ± 4.9 | 9.0 ± 2.8 | +6% |
| turns | 17.0 ± 7.1 | 19.0 ± 7.1 | +12% |
| seconds | 67.5 ± 20.5 | 68.5 ± 24.7 | +1% |
| cost | $0.394 ± $0.106 | $0.366 ± $0.107 | -7% |
| tests pass | 100% | 100% |  |

## Fleet of 9,000 sessions (projection: mean delta x 9,000, ± is a 95% interval on the mean delta)

| arm | context tokens saved | minutes saved | ACU saved (15 min each) | cost saved |
|---|---:|---:|---:|---:|
| full | 1,515,060,000 ± 7,038,071,003 | -150 ± 6,682 | -10 | $248 ± 1,872 |

Context tokens are mostly cache reads on Claude Code (about 97 out of 100). The cost column is the number that reflects what is paid.

## By shape (context tokens, tool calls, pass)

| shape | cold | full |
|---|---|---|
| flag | 980,507 / 15.0 / 100% | 812,167 / 17.5 / 100% |

## Runs

| task | arm | # | ctx tok | out tok | tools | before edit | s | $ | pass | injected |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|---:|
| flag-2 | cold | 1 | 672,621 | 2,272 | 9 | 5 | 53 | 0.319 | yes | 0 |
| flag-3 | cold | 1 | 1,288,393 | 3,717 | 21 | 12 | 82 | 0.469 | yes | 0 |
| flag-2 | full | 1 | 558,407 | 2,707 | 13 | 7 | 51 | 0.291 | yes | 1119 |
| flag-3 | full | 1 | 1,065,927 | 5,299 | 22 | 11 | 86 | 0.442 | yes | 809 |
