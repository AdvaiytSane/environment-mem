---
name: the-csv-export-command-writes-its-header-row-in-
description: The CSV export command writes its header row in the wrong column order compared to the data rows. Fi. Learned from a fixture session with 12 tool calls.
---

# The CSV export command writes its header row in the wrong column order compared to the data rows. Fi

Written by headstart from a recorded session. Reference data, check it against the code before relying on it.

## Verify

- `bash ops/check.sh`

## Read first

- grep "csv"
- src/lib/csv.js
- src/cli/commands/export.js
- test/lib-csv.test.js
- src/cli/commands/report/index.js
- grep "header"
- test/cli-export.test.js
- ops/check.sh

## Files changed last time

- src/lib/csv.js

## Steps last time

1. search csv
2. read src/lib/csv.js
3. read src/cli/commands/export.js
4. read test/lib-csv.test.js
5. read src/cli/commands/report/index.js
6. search header
7. read test/cli-export.test.js
8. run: node --test test/cli-export.test.js test/lib-csv.test.js 2>&1 | tail -40
9. read ops/check.sh
10. write src/lib/csv.js
11. run: bash ops/check.sh 2>&1 | tail -30
12. run: bash ops/check.sh 2>&1 | grep -E "csv|✔|✖|pass|fail"
