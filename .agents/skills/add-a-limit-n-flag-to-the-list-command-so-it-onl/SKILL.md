---
name: add-a-limit-n-flag-to-the-list-command-so-it-onl
description: Add a --limit <n> flag to the list command so it only prints the first n rows. Work in this reposito. Learned from a fixture session with 17 tool calls.
---

# Add a --limit <n> flag to the list command so it only prints the first n rows. Work in this reposito

Written by headstart from a recorded session. Reference data, check it against the code before relying on it.

## Verify

- `node src/cli/main.js list --limit 3`
- `bash ops/check.sh`

## Read first

- grep "list"
- src/cli/commands/list.js
- grep "src/cli/commands/"
- src/cli/commands/index.js
- grep "main.js"
- src/cli/main.js
- src/cli/args.js
- src/cli/flags.js

## Files changed last time

- src/cli/flags.js
- src/cli/commands/list.js

## Steps last time

1. search list
2. read src/cli/commands/list.js
3. search src/cli/commands/
4. read src/cli/commands/index.js
5. search main.js
6. read src/cli/main.js
7. read src/cli/args.js
8. read src/cli/flags.js
9. write src/cli/flags.js
10. write src/cli/commands/list.js
11. run: node src/cli/main.js list --limit 3 | wc -l && node src/cli/main.js list | wc -l && node --test test/cli-list.test.js 2>&1 | tail -20
12. read package.json
13. run: bash ops/check.sh 2>&1 | tail -40
14. run: bash ops/check.sh 2>&1 | grep -E "cli-list|pass |fail |tests "
15. run: bash ops/check.sh 2>&1 | grep "✖ test"
16. run: bash ops/check.sh 2>&1 | grep -E "^✖|not ok"
17. run: git stash && bash ops/check.sh 2>&1 | grep -E "^✖|tests |pass |fail " ; git stash pop
