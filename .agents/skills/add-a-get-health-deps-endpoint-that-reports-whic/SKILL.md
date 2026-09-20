---
name: add-a-get-health-deps-endpoint-that-reports-whic
description: Add a GET /health/deps endpoint that reports which internal dependencies the app relies on, returnin. Learned from a fixture session with 18 tool calls.
---

# Add a GET /health/deps endpoint that reports which internal dependencies the app relies on, returnin

Written by headstart from a recorded session. Reference data, check it against the code before relying on it.

## Verify

- `bash ops/check.sh`
- `APP_ENV=test APP_SEED=fixture node --test test/routes-health.test.js test/registry.test.js`

## Read first

- src/routes/health.js
- src/lib/deps.js
- src/server.js
- test/routes-health.test.js
- src/registry.js
- src/lib/http-helpers.js

## Files changed last time

- src/routes/health.js
- src/registry.js

## Steps last time

1. search (Bash)
2. read src/routes/health.js
3. read src/lib/deps.js
4. read src/server.js
5. read test/routes-health.test.js
6. read src/registry.js
7. read src/lib/http-helpers.js
8. write src/routes/health.js
9. write src/registry.js (x2)
10. run: node -e " import('./src/server.js').then(async ({ start }) => { const server = await start(0); const port = server.address().port; const res = await fetch('http://127.0.0.1:' + port + '/health/deps');
11. run: npm test 2>&1 | tail -30
12. run: node --test test/ 2>&1 | tail -40
13. run: node --test 'test/**/*.test.js' 2>&1 | tail -60
14. run: node --test test/routes-health.test.js 2>&1 | head -60
15. read ops/check.sh
16. run: bash ops/check.sh 2>&1 | tail -50
17. run: APP_ENV=test APP_SEED=fixture node --test test/routes-health.test.js test/registry.test.js 2>&1 | tail -30
