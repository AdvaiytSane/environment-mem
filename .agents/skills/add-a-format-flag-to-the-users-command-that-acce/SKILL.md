---
name: add-a-format-flag-to-the-users-command-that-acce
description: Add a --format flag to the users command that accepts csv or table. It should keep printing the curr. Learned from a fixture session with 20 tool calls.
---

# Add a --format flag to the users command that accepts csv or table. It should keep printing the curr

Written by headstart from a recorded session. Reference data, check it against the code before relying on it.

## Verify

- `node --test test/*.test.js`
- `bash ops/check.sh`

## Read first

- grep "users"
- grep "./node_modules"
- src/cli/commands/users.js
- src/cli/flags.js
- src/cli/args.js
- ./src/cli/commands/export.js
- src/lib/csv.js
- grep "type:"
- test/cli-users.test.js

## Files changed last time

- src/cli/flags.js
- src/cli/commands/users.js

## Steps last time

1. search users
2. search ./node_modules
3. read src/cli/commands/users.js
4. read src/cli/flags.js
5. search ./node_modules
6. read src/cli/args.js
7. read ./src/cli/commands/export.js
8. read src/lib/csv.js
9. search type:
10. read test/cli-users.test.js
11. write src/cli/flags.js
12. write src/cli/commands/users.js
13. run: node src/cli/main.js users && echo --- && node src/cli/main.js users --format csv && echo --- && node src/cli/main.js users --format table && echo --- && npm test 2>&1 | tail -30
14. run: node --test test/ 2>&1 | tail -30
15. run: node --test test/*.test.js 2>&1 | tail -40
16. run: node --test test/*.test.js 2>&1 | head -60
17. read ops/check.sh
18. run: bash ops/check.sh 2>&1 | tail -20
19. run: bash ops/check.sh 2>&1 | grep -E "^ℹ (tests|pass|fail)"
20. run: git stash && bash ops/check.sh 2>&1 | grep -E "^ℹ (tests|pass|fail)"; git stash pop
