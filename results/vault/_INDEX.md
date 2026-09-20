---
type: index
---

# headstart

74 recorded coding-agent sessions, 18 files, 11 communities in 4 shapes. Edges are gzip compression similarity between traces; communities are average-linkage clusters on the same distance. Open the graph view and colour by shape.

## Shapes

- [[_SHAPE_shape 0 (flag 24, other 2)]]
- [[_SHAPE_shape 1 (endpoint 16)]]
- [[_SHAPE_shape 2 (bugfix 16, endpoint 8)]]
- [[_SHAPE_shape 3 (bugfix 8)]]

## Communities

- [[_COMMUNITY_flag-1 x8, flag-2 x2]] - 10 sessions
- [[_COMMUNITY_flag-3 x8]] - 8 sessions
- [[_COMMUNITY_endpoint-1 x8]] - 8 sessions
- [[_COMMUNITY_endpoint-2 x2]] - 2 sessions
- [[_COMMUNITY_endpoint-3 x8]] - 8 sessions
- [[_COMMUNITY_bugfix-1 x8]] - 8 sessions
- [[_COMMUNITY_bugfix-2 x6]] - 6 sessions
- [[_COMMUNITY_bugfix-3 x8]] - 8 sessions
- [[_COMMUNITY_flag-2 x6, session x2]] - 8 sessions
- [[_COMMUNITY_endpoint-2 x6]] - 6 sessions
- [[_COMMUNITY_bugfix-2 x2]] - 2 sessions

## Measured

54 runs, runner claude, model sonnet. Arms: cold, doc, full. Mean and standard deviation over successful runs.

| metric | cold (n=18) | doc (n=18) | full (n=18) | doc vs cold | full vs cold |
|---|---:|---:|---:|---:|---:|
| context tokens (input + cache reads + cache writes, all turns) | 1,009,927 ± 241,110 | 702,535 ± 165,888 | 758,606 ± 227,132 | -30% | -25% |
| uncached input tokens | 34 ± 7 | 24 ± 6 | 26 ± 7 | -29% | -25% |
| cache read tokens | 964,311 ± 238,142 | 659,475 ± 164,762 | 712,883 ± 225,034 | -32% | -26% |
| output tokens | 4,734 ± 2,037 | 3,396 ± 1,548 | 4,022 ± 1,485 | -28% | -15% |
| tool calls | 18.2 ± 4.2 | 12.6 ± 3.0 | 14.8 ± 4.6 | -31% | -18% |
| calls before first edit | 9.6 ± 5.0 | 7.3 ± 3.9 | 9.2 ± 3.2 | -24% | -4% |
| turns | 20.0 ± 4.5 | 14.4 ± 3.1 | 16.9 ± 4.0 | -28% | -15% |
| seconds | 75.1 ± 26.9 | 48.2 ± 18.6 | 59.4 ± 23.7 | -36% | -21% |
| cost | $0.423 ± $0.079 | $0.338 ± $0.054 | $0.366 ± $0.066 | -20% | -13% |
| tests pass | 100% | 100% | 100% |  |  |

## Fleet of 9,000 sessions (projection: mean delta x 9,000, ± is a 95% interval on the mean delta)

| arm | context tokens saved | minutes saved | ACU saved (15 min each) | cost saved |
|---|---:|---:|---:|---:|
| doc | 2,766,531,500 ± 1,216,839,236 | 4,042 ± 2,266 | 269 | $761 ± 399 |
| full | 2,261,894,000 ± 1,377,244,652 | 2,350 ± 2,487 | 157 | $513 ± 429 |

Context tokens are mostly cache reads on Claude Code (about 97 out of 100). The cost column is the number that reflects what is paid.

