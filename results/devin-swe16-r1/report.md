# headstart eval

72 runs, runner devin, model . Arms: cold, doc, facts, full. Mean and standard deviation over successful runs.

| metric | cold (n=18) | doc (n=18) | facts (n=18) | full (n=12) | doc vs cold | facts vs cold | full vs cold |
|---|---:|---:|---:|---:|---:|---:|---:|
| context tokens (input + cache reads + cache writes, all turns) | 283,540 ± 131,916 | 297,582 ± 171,629 | 380,746 ± 268,960 | 253,776 ± 116,801 | +5% | +34% | -10% |
| uncached input tokens | 13,300 ± 2,200 | 14,401 ± 4,452 | 15,329 ± 3,234 | 12,693 ± 2,954 | +8% | +15% | -5% |
| cache read tokens | 270,240 ± 130,444 | 283,180 ± 168,383 | 365,417 ± 266,498 | 241,083 ± 114,223 | +5% | +35% | -11% |
| output tokens | 1,802 ± 1,157 | 2,395 ± 2,306 | 2,203 ± 924 | 1,787 ± 953 | +33% | +22% | -1% |
| tool calls | 15.6 ± 6.6 | 14.1 ± 5.4 | 20.9 ± 9.3 | 14.8 ± 5.4 | -9% | +34% | -5% |
| calls before first edit | 8.8 ± 4.2 | 6.1 ± 1.6 | 11.3 ± 3.1 | 8.3 ± 2.7 | -31% | +29% | -6% |
| turns | 20.2 ± 5.1 | 20.7 ± 6.0 | 24.3 ± 9.1 | 20.9 ± 4.4 | +2% | +21% | +4% |
| seconds | 28.8 ± 12.8 | 32.1 ± 25.7 | 42.6 ± 26.6 | 27.7 ± 13.4 | +12% | +48% | -4% |
| cost | not reported by runner | not reported by runner | not reported by runner | not reported by runner |  |  |  |
| tests pass | 89% | 83% | 89% | 92% |  |  |  |

## Fleet of 9,000 sessions (projection: mean delta x 9,000, ± is a 95% interval on the mean delta)

| arm | context tokens saved | minutes saved | ACU saved (15 min each) | cost saved |
|---|---:|---:|---:|---:|
| doc | -126,378,500 ± 900,028,172 | -500 ± 1,990 | -33 | not reported |
| facts | -874,853,500 ± 1,245,541,825 | -2,067 ± 2,044 | -138 | not reported |
| full | 267,876,000 ± 809,066,637 | 167 ± 1,446 | 11 | not reported |

Context tokens are mostly cache reads on Claude Code (about 97 out of 100). The cost column is the number that reflects what is paid.

## By shape (context tokens, tool calls, pass)

| shape | cold | doc | facts | full |
|---|---|---|---|---|
| flag | 201,625 / 10.8 / 100% | 265,993 / 14.0 / 100% | 265,221 / 16.8 / 100% | 203,347 / 13.0 / 100% |
| endpoint | 428,919 / 22.2 / 67% | 381,872 / 16.8 / 50% | 596,703 / 27.3 / 67% | 333,562 / 18.7 / 67% |
| bugfix | 220,076 / 13.7 / 100% | 244,880 / 11.5 / 100% | 280,313 / 18.5 / 100% | 274,848 / 14.7 / 100% |

## Errors (6)

- endpoint-1 full #2: exit 1: Error: Agent error: Your weekly usage quota has been exhausted. Visit https://app.devin.ai/settings/usage to purchase on-demand usage or turn on auto-reload. (trace ID: 0df1dd27c2fa1403fbe61477d6ba2a5
- endpoint-2 full #2: exit 1: Error: Agent error: Your weekly usage quota has been exhausted. Visit https://app.devin.ai/settings/usage to purchase on-demand usage or turn on auto-reload. (trace ID: 6fe92a35d2bd08f45e9f6704055f419
- endpoint-3 full #2: exit 1: Error: Agent error: Your weekly usage quota has been exhausted. Visit https://app.devin.ai/settings/usage to purchase on-demand usage or turn on auto-reload. (trace ID: defc956dfdfb1d9e8ec4db6b1a03f1d
- bugfix-1 full #2: exit 1: Error: Agent error: Your weekly usage quota has been exhausted. Visit https://app.devin.ai/settings/usage to purchase on-demand usage or turn on auto-reload. (trace ID: 4836e4c0b71907f8994f089d9d2f0f8
- bugfix-2 full #2: exit 1: Error: Agent error: Your weekly usage quota has been exhausted. Visit https://app.devin.ai/settings/usage to purchase on-demand usage or turn on auto-reload. (trace ID: 079463c94dcffeefbf9dc88e8e6633a
- bugfix-3 full #2: exit 1: Error: Agent error: Your weekly usage quota has been exhausted. Visit https://app.devin.ai/settings/usage to purchase on-demand usage or turn on auto-reload. (trace ID: 103fc55467456b2ad21a045e22147c3

## Runs

| task | arm | # | ctx tok | out tok | tools | before edit | s | $ | pass | injected |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|---:|
| flag-2 | cold | 1 | 195,557 | 1,008 | 11 | 7 | 19 | n/a | yes | 0 |
| flag-1 | cold | 1 | 215,581 | 1,073 | 12 | 8 | 22 | n/a | yes | 0 |
| flag-3 | cold | 1 | 151,739 | 929 | 9 | 5 | 15 | n/a | yes | 0 |
| endpoint-1 | cold | 1 | 312,752 | 1,334 | 15 | 8 | 35 | n/a | yes | 0 |
| endpoint-2 | cold | 1 | 528,302 | 2,318 | 28 | 14 | 51 | n/a | no | 0 |
| endpoint-3 | cold | 1 | 364,748 | 3,353 | 17 | 10 | 41 | n/a | yes | 0 |
| bugfix-1 | cold | 1 | 187,228 | 1,316 | 11 | 7 | 18 | n/a | yes | 0 |
| bugfix-2 | cold | 1 | 156,137 | 1,433 | 11 | 7 | 19 | n/a | yes | 0 |
| bugfix-3 | cold | 1 | 153,407 | 1,550 | 10 | 5 | 22 | n/a | yes | 0 |
| flag-2 | cold | 2 | 224,235 | 1,041 | 12 | 4 | 21 | n/a | yes | 0 |
| flag-1 | cold | 2 | 270,318 | 1,256 | 12 | 5 | 21 | n/a | yes | 0 |
| flag-3 | cold | 2 | 152,318 | 1,079 | 9 | 5 | 20 | n/a | yes | 0 |
| endpoint-1 | cold | 2 | 472,120 | 1,512 | 27 | 14 | 49 | n/a | yes | 0 |
| endpoint-2 | cold | 2 | 546,343 | 2,153 | 28 | 13 | 50 | n/a | no | 0 |
| endpoint-3 | cold | 2 | 349,248 | 2,688 | 18 | 10 | 32 | n/a | yes | 0 |
| bugfix-1 | cold | 2 | 214,777 | 1,461 | 13 | 8 | 20 | n/a | yes | 0 |
| bugfix-2 | cold | 2 | 202,369 | 1,293 | 13 | 8 | 18 | n/a | yes | 0 |
| bugfix-3 | cold | 2 | 406,538 | 5,640 | 24 | 20 | 45 | n/a | yes | 0 |
| flag-2 | doc | 1 | 183,333 | 1,246 | 10 | 6 | 18 | n/a | yes | 0 |
| flag-1 | doc | 1 | 331,472 | 1,612 | 17 | 4 | 28 | n/a | yes | 0 |
| flag-3 | doc | 1 | 333,640 | 1,925 | 18 | 6 | 30 | n/a | yes | 0 |
| endpoint-1 | doc | 1 | 482,153 | 2,221 | 21 | 5 | 46 | n/a | no | 0 |
| endpoint-2 | doc | 1 | 287,073 | 3,400 | 15 | 9 | 31 | n/a | no | 0 |
| bugfix-1 | doc | 1 | 161,417 | 1,014 | 10 | 8 | 16 | n/a | yes | 0 |
| endpoint-3 | doc | 1 | 251,136 | 2,272 | 13 | 5 | 29 | n/a | yes | 0 |
| bugfix-2 | doc | 1 | 110,783 | 727 | 7 | 5 | 10 | n/a | yes | 0 |
| flag-1 | doc | 2 | 201,576 | 1,210 | 12 | 7 | 18 | n/a | yes | 0 |
| bugfix-3 | doc | 1 | 243,448 | 2,118 | 12 | 6 | 26 | n/a | yes | 0 |
| flag-2 | doc | 2 | 300,489 | 1,313 | 14 | 3 | 24 | n/a | yes | 0 |
| flag-3 | doc | 2 | 245,450 | 1,576 | 13 | 8 | 24 | n/a | yes | 0 |
| endpoint-1 | doc | 2 | 279,515 | 1,936 | 13 | 6 | 27 | n/a | yes | 0 |
| endpoint-3 | doc | 2 | 252,138 | 2,857 | 14 | 5 | 30 | n/a | yes | 0 |
| endpoint-2 | doc | 2 | 739,219 | 5,832 | 25 | 6 | 65 | n/a | no | 0 |
| bugfix-1 | doc | 2 | 178,584 | 868 | 8 | 6 | 13 | n/a | yes | 0 |
| bugfix-2 | doc | 2 | 111,080 | 732 | 7 | 5 | 21 | n/a | yes | 0 |
| flag-1 | facts | 1 | 189,606 | 1,502 | 14 | 10 | 20 | n/a | yes | 475 |
| flag-2 | facts | 1 | 159,419 | 1,206 | 10 | 4 | 18 | n/a | yes | 479 |
| flag-3 | facts | 1 | 476,869 | 2,626 | 25 | 15 | 43 | n/a | yes | 487 |
| bugfix-3 | doc | 2 | 663,968 | 10,258 | 25 | 9 | 122 | n/a | yes | 0 |
| endpoint-1 | facts | 1 | 415,106 | 1,730 | 22 | 10 | 42 | n/a | yes | 478 |
| endpoint-2 | facts | 1 | 299,196 | 2,567 | 17 | 8 | 43 | n/a | no | 472 |
| bugfix-1 | facts | 1 | 311,260 | 2,005 | 22 | 17 | 40 | n/a | yes | 497 |
| endpoint-3 | facts | 1 | 524,331 | 3,073 | 23 | 11 | 67 | n/a | yes | 472 |
| bugfix-2 | facts | 1 | 167,660 | 1,352 | 12 | 10 | 21 | n/a | yes | 478 |
| flag-1 | facts | 2 | 221,449 | 1,329 | 15 | 10 | 23 | n/a | yes | 475 |
| bugfix-3 | facts | 1 | 483,687 | 3,487 | 27 | 15 | 63 | n/a | yes | 503 |
| flag-2 | facts | 2 | 321,227 | 1,891 | 21 | 15 | 32 | n/a | yes | 479 |
| flag-3 | facts | 2 | 222,756 | 1,606 | 16 | 11 | 22 | n/a | yes | 487 |
| endpoint-1 | facts | 2 | 358,811 | 1,728 | 19 | 12 | 39 | n/a | yes | 478 |
| endpoint-2 | facts | 2 | 699,537 | 4,090 | 33 | 10 | 95 | n/a | no | 472 |
| bugfix-1 | facts | 2 | 215,692 | 1,630 | 17 | 14 | 21 | n/a | yes | 497 |
| endpoint-3 | facts | 2 | 1,283,237 | 3,874 | 50 | 9 | 112 | n/a | yes | 472 |
| bugfix-2 | facts | 2 | 165,909 | 1,238 | 12 | 10 | 22 | n/a | yes | 478 |
| flag-1 | full | 1 | 325,323 | 1,867 | 19 | 6 | 36 | n/a | yes | 1508 |
| bugfix-3 | facts | 2 | 337,672 | 2,727 | 21 | 13 | 43 | n/a | yes | 503 |
| flag-3 | full | 1 | 158,858 | 1,038 | 12 | 8 | 15 | n/a | yes | 1364 |
| flag-2 | full | 1 | 295,380 | 2,065 | 19 | 14 | 28 | n/a | yes | 1312 |
| endpoint-1 | full | 1 | 277,999 | 1,416 | 19 | 12 | 32 | n/a | yes | 1620 |
| endpoint-2 | full | 1 | 319,511 | 2,599 | 18 | 9 | 33 | n/a | no | 1402 |
| bugfix-1 | full | 1 | 160,299 | 982 | 11 | 8 | 16 | n/a | yes | 1330 |
| bugfix-2 | full | 1 | 179,193 | 1,396 | 9 | 7 | 18 | n/a | yes | 2023 |
| endpoint-3 | full | 1 | 403,176 | 2,252 | 19 | 8 | 44 | n/a | yes | 1505 |
| flag-1 | full | 2 | 116,254 | 976 | 8 | 4 | 12 | n/a | yes | 1508 |
| flag-2 | full | 2 | 120,411 | 1,058 | 9 | 6 | 19 | n/a | yes | 1312 |
| flag-3 | full | 2 | 203,855 | 1,503 | 11 | 7 | 22 | n/a | yes | 1364 |
| bugfix-3 | full | 1 | 485,051 | 4,289 | 24 | 10 | 57 | n/a | yes | 1336 |
| endpoint-1 | full | 2 | 0 | 0 | 14 | 13 | 17 | n/a | no | 1620 |
| endpoint-2 | full | 2 | 0 | 0 | 13 | 11 | 16 | n/a | no | 1402 |
| endpoint-3 | full | 2 | 0 | 0 | 0 | 0 | 2 | n/a | no | 1505 |
| bugfix-1 | full | 2 | 0 | 0 | 0 | 0 | 2 | n/a | no | 1330 |
| bugfix-2 | full | 2 | 0 | 0 | 0 | 0 | 1 | n/a | no | 2023 |
| bugfix-3 | full | 2 | 0 | 0 | 0 | 0 | 1 | n/a | no | 1336 |
