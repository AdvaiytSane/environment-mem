# headstart eval

54 runs, runner devin, model sonnet. Arms: cold, doc, full. Mean and standard deviation over successful runs.

| metric | cold (n=18) | doc (n=18) | full (n=18) | doc vs cold | full vs cold |
|---|---:|---:|---:|---:|---:|
| context tokens (input + cache reads + cache writes, all turns) | 593,882 ± 200,795 | 463,359 ± 138,656 | 462,350 ± 136,322 | -22% | -22% |
| uncached input tokens | 22,948 ± 4,598 | 21,470 ± 4,547 | 21,948 ± 4,122 | -6% | -4% |
| cache read tokens | 570,934 ± 197,121 | 441,889 ± 135,076 | 440,402 ± 134,344 | -23% | -23% |
| output tokens | 3,595 ± 1,643 | 3,083 ± 1,385 | 3,336 ± 1,354 | -14% | -7% |
| tool calls | 17.7 ± 4.8 | 14.6 ± 4.4 | 16.5 ± 4.4 | -17% | -7% |
| calls before first edit | 8.7 ± 2.4 | 7.8 ± 2.7 | 10.4 ± 4.8 | -10% | +19% |
| turns | 25.8 ± 4.9 | 21.6 ± 3.1 | 23.5 ± 3.8 | -17% | -9% |
| seconds | 64.5 ± 23.5 | 51.9 ± 20.1 | 54.3 ± 19.1 | -20% | -16% |
| cost | not reported by runner | not reported by runner | not reported by runner |  |  |
| tests pass | 100% | 100% | 100% |  |  |

## Fleet of 9,000 sessions (projection: mean delta x 9,000, ± is a 95% interval on the mean delta)

| arm | context tokens saved | minutes saved | ACU saved (15 min each) | cost saved |
|---|---:|---:|---:|---:|
| doc | 1,174,710,000 ± 1,014,570,380 | 1,892 ± 2,141 | 126 | not reported |
| full | 1,183,795,500 ± 1,009,086,633 | 1,525 ± 2,098 | 102 | not reported |

Context tokens are mostly cache reads on Claude Code (about 97 out of 100). The cost column is the number that reflects what is paid.

## By shape (context tokens, tool calls, pass)

| shape | cold | doc | full |
|---|---|---|---|
| flag | 589,519 / 18.2 / 100% | 426,599 / 14.8 / 100% | 417,645 / 15.7 / 100% |
| endpoint | 736,486 / 20.7 / 100% | 575,417 / 17.5 / 100% | 477,645 / 18.8 / 100% |
| bugfix | 455,643 / 14.2 / 100% | 388,062 / 11.5 / 100% | 491,759 / 15.0 / 100% |

## Runs

| task | arm | # | ctx tok | out tok | tools | before edit | s | $ | pass | injected |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|---:|
| flag-2 | cold | 1 | 422,542 | 1,725 | 13 | 8 | 41 | n/a | yes | 0 |
| flag-1 | cold | 1 | 421,574 | 2,107 | 13 | 8 | 43 | n/a | yes | 0 |
| endpoint-1 | cold | 1 | 590,904 | 2,939 | 18 | 10 | 56 | n/a | yes | 0 |
| flag-3 | cold | 1 | 739,568 | 3,824 | 22 | 11 | 72 | n/a | yes | 0 |
| endpoint-2 | cold | 1 | 735,152 | 4,737 | 20 | 8 | 74 | n/a | yes | 0 |
| endpoint-3 | cold | 1 | 701,011 | 3,680 | 20 | 12 | 67 | n/a | yes | 0 |
| bugfix-1 | cold | 1 | 517,318 | 1,931 | 15 | 8 | 46 | n/a | yes | 0 |
| bugfix-3 | cold | 1 | 265,684 | 2,394 | 8 | 6 | 37 | n/a | yes | 0 |
| bugfix-2 | cold | 1 | 652,269 | 6,174 | 20 | 14 | 105 | n/a | yes | 0 |
| flag-2 | cold | 2 | 576,243 | 2,502 | 17 | 8 | 49 | n/a | yes | 0 |
| flag-1 | cold | 2 | 738,391 | 3,246 | 21 | 10 | 61 | n/a | yes | 0 |
| flag-3 | cold | 2 | 638,796 | 4,125 | 23 | 10 | 68 | n/a | yes | 0 |
| endpoint-1 | cold | 2 | 462,491 | 2,979 | 17 | 7 | 59 | n/a | yes | 0 |
| endpoint-3 | cold | 2 | 808,817 | 5,098 | 22 | 7 | 85 | n/a | yes | 0 |
| endpoint-2 | cold | 2 | 1,120,539 | 7,460 | 27 | 9 | 125 | n/a | yes | 0 |
| bugfix-1 | cold | 2 | 490,655 | 1,784 | 15 | 4 | 46 | n/a | yes | 0 |
| bugfix-3 | cold | 2 | 333,661 | 2,466 | 10 | 6 | 45 | n/a | yes | 0 |
| bugfix-2 | cold | 2 | 474,269 | 5,545 | 17 | 11 | 82 | n/a | yes | 0 |
| flag-2 | doc | 1 | 325,257 | 1,807 | 12 | 8 | 33 | n/a | yes | 0 |
| flag-1 | doc | 1 | 442,927 | 2,565 | 16 | 10 | 41 | n/a | yes | 0 |
| endpoint-1 | doc | 1 | 425,337 | 2,463 | 15 | 7 | 47 | n/a | yes | 0 |
| flag-3 | doc | 1 | 608,672 | 3,719 | 21 | 10 | 64 | n/a | yes | 0 |
| endpoint-3 | doc | 1 | 518,674 | 3,369 | 15 | 5 | 53 | n/a | yes | 0 |
| endpoint-2 | doc | 1 | 612,349 | 4,679 | 20 | 9 | 73 | n/a | yes | 0 |
| bugfix-1 | doc | 1 | 293,557 | 1,498 | 8 | 4 | 29 | n/a | yes | 0 |
| bugfix-3 | doc | 1 | 376,367 | 3,174 | 11 | 8 | 53 | n/a | yes | 0 |
| bugfix-2 | doc | 1 | 581,484 | 6,525 | 17 | 14 | 102 | n/a | yes | 0 |
| flag-1 | doc | 2 | 434,845 | 2,178 | 13 | 7 | 43 | n/a | yes | 0 |
| flag-2 | doc | 2 | 272,845 | 1,526 | 8 | 3 | 28 | n/a | yes | 0 |
| flag-3 | doc | 2 | 475,048 | 3,043 | 19 | 11 | 45 | n/a | yes | 0 |
| endpoint-1 | doc | 2 | 454,675 | 2,474 | 13 | 7 | 47 | n/a | yes | 0 |
| endpoint-3 | doc | 2 | 668,253 | 4,573 | 22 | 11 | 64 | n/a | yes | 0 |
| endpoint-2 | doc | 2 | 773,211 | 5,235 | 20 | 5 | 90 | n/a | yes | 0 |
| bugfix-1 | doc | 2 | 386,569 | 1,922 | 11 | 8 | 44 | n/a | yes | 0 |
| bugfix-2 | doc | 2 | 349,688 | 2,614 | 12 | 8 | 41 | n/a | yes | 0 |
| bugfix-3 | doc | 2 | 340,706 | 2,130 | 10 | 6 | 37 | n/a | yes | 0 |
| flag-1 | full | 1 | 514,867 | 2,546 | 15 | 10 | 55 | n/a | yes | 1235 |
| flag-2 | full | 1 | 378,501 | 2,475 | 15 | 9 | 40 | n/a | yes | 1282 |
| flag-3 | full | 1 | 357,198 | 2,483 | 16 | 10 | 41 | n/a | yes | 1194 |
| endpoint-1 | full | 1 | 530,836 | 3,431 | 18 | 9 | 50 | n/a | yes | 1241 |
| endpoint-3 | full | 1 | 312,102 | 3,076 | 16 | 6 | 43 | n/a | yes | 1275 |
| endpoint-2 | full | 1 | 621,151 | 6,664 | 28 | 23 | 85 | n/a | yes | 1275 |
| bugfix-1 | full | 1 | 400,783 | 2,957 | 17 | 14 | 44 | n/a | yes | 1243 |
| bugfix-2 | full | 1 | 493,427 | 3,047 | 15 | 11 | 58 | n/a | yes | 1284 |
| bugfix-3 | full | 1 | 278,568 | 2,268 | 8 | 4 | 35 | n/a | yes | 1266 |
| flag-1 | full | 2 | 362,624 | 2,755 | 16 | 11 | 45 | n/a | yes | 1235 |
| flag-2 | full | 2 | 349,939 | 2,362 | 16 | 9 | 45 | n/a | yes | 1282 |
| endpoint-1 | full | 2 | 492,193 | 2,722 | 14 | 7 | 48 | n/a | yes | 1241 |
| flag-3 | full | 2 | 542,743 | 2,877 | 16 | 11 | 60 | n/a | yes | 1194 |
| endpoint-3 | full | 2 | 435,204 | 3,372 | 16 | 8 | 49 | n/a | yes | 1275 |
| endpoint-2 | full | 2 | 474,383 | 5,106 | 21 | 10 | 62 | n/a | yes | 1275 |
| bugfix-1 | full | 2 | 504,701 | 2,364 | 14 | 8 | 45 | n/a | yes | 1243 |
| bugfix-3 | full | 2 | 401,197 | 2,972 | 12 | 6 | 57 | n/a | yes | 1266 |
| bugfix-2 | full | 2 | 871,876 | 6,568 | 24 | 21 | 116 | n/a | yes | 1284 |
