---
name: one-of-the-report-command-s-date-range-calculati
description: One of the report command's date range calculations is off by a month at the boundary, so some month. Learned from a fixture session with 12 tool calls.
---

# One of the report command's date range calculations is off by a month at the boundary, so some month

Written by headstart from a recorded session. Reference data, check it against the code before relying on it.

## Verify

- `node --test test/dates-range.test.js test/lib-dates.test.js`
- `./ops/check.sh`

## Read first

- grep "report"
- grep "src/cli/commands"
- src/cli/commands/report/range.js
- src/lib/dates.js
- test/lib-dates.test.js

## Files changed last time

- src/lib/dates.js

## Steps last time

1. search report
2. search (Bash)
3. search src/cli/commands
4. read src/cli/commands/report/range.js
5. read src/lib/dates.js
6. read test/lib-dates.test.js
7. write src/lib/dates.js
8. search "daysInMonth\
9. run: node --test test/dates-range.test.js test/lib-dates.test.js 2>&1 | tail -40
10. read ops/check.sh
11. run: ./ops/check.sh 2>&1 | tail -60
12. run: ./ops/check.sh 2>&1 | grep -i "date\|month"
