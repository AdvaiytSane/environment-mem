---
name: add-a-json-flag-to-the-stats-cli-command-when-it
description: Add a --json flag to the stats CLI command. When it is passed, print the stats as JSON instead of th. Learned from a fixture session with 11 tool calls.
---

# Add a --json flag to the stats CLI command. When it is passed, print the stats as JSON instead of th

Written by headstart from a recorded session. Reference data, check it against the code before relying on it.

## Verify

- `node src/cli/main.js stats`

## Read first

- grep "stats"
- src/cli/commands/stats.js
- src/cli/flags.js
- grep "./node_modules"
- src/cli/args.js
- src/cli/commands/index.js
- src/cli/commands/report.js

## Files changed last time

- src/cli/flags.js
- src/cli/commands/stats.js

## Steps last time

1. search stats
2. read src/cli/commands/stats.js
3. read src/cli/flags.js
4. search ./node_modules
5. read src/cli/args.js
6. read src/cli/commands/index.js
7. read src/cli/commands/report.js
8. search ./node_modules
9. write src/cli/flags.js
10. write src/cli/commands/stats.js
11. run: node src/cli/main.js stats && echo "---" && node src/cli/main.js stats --json
