---
name: add-a-get-users-id-summary-endpoint-that-returns
description: Add a GET /users/:id/summary endpoint that returns JSON with the fields id, name, orderCount (how ma. Learned from a fixture session with 26 tool calls.
---

# Add a GET /users/:id/summary endpoint that returns JSON with the fields id, name, orderCount (how ma

Written by headstart from a recorded session. Reference data, check it against the code before relying on it.

## Verify

- `./ops/check.sh`

## Read first

- src/routes/users.js
- src/routes/orders.js
- src/domain/users.js
- src/domain/orders.js
- src/server.js
- src/domain/store.js
- test/routes-users.test.js
- src/registry.js

## Files changed last time

- src/routes/users.js
- src/registry.js
- src/domain/orders.js

## Steps last time

1. search (Bash)
2. read src/routes/users.js
3. read src/routes/orders.js
4. read src/domain/users.js
5. read src/domain/orders.js
6. read src/server.js
7. read src/domain/store.js
8. read test/routes-users.test.js
9. read src/registry.js
10. write src/routes/users.js (x2)
11. write src/registry.js (x2)
12. run: node -e " import('./src/server.js').then(async ({ start }) => { const server = await start(0); const port = server.address().port; const ok = await fetch('http://127.0.0.1:'+port+'/users/u1/summary');
13. run: node --test 2>&1 | tail -30
14. run: node --test test/routes-users.test.js 2>&1 | head -50
15. read ops/check.sh
16. run: ./ops/check.sh 2>&1 | tail -30
17. run: git stash && ./ops/check.sh 2>&1 | tail -20; git stash pop
18. read test/orders-total.test.js
19. write src/domain/orders.js
20. search total(
21. run: ./ops/check.sh 2>&1 | tail -20
22. run: ./ops/check.sh 2>&1 | grep -E "^ℹ|✖ test"
23. run: ./ops/check.sh 2>&1 | grep -B1 "AssertionError\|✖ " | grep -E "test at|✖ [a-zA-Z]"
24. run: git stash && ./ops/check.sh 2>&1 | grep -E "^ℹ|test at"; git stash pop
