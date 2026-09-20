---
name: add-a-delete-orders-id-endpoint-it-should-return
description: Add a DELETE /orders/:id endpoint. It should return 404 for an order id that does not exist and 204 . Learned from a fixture session with 19 tool calls.
---

# Add a DELETE /orders/:id endpoint. It should return 404 for an order id that does not exist and 204 

Written by headstart from a recorded session. Reference data, check it against the code before relying on it.

## Verify

- `node --test test/routes-orders.test.js`
- `APP_ENV=test APP_SEED=fixture node --test test/routes-orders.test.js`

## Read first

- src/routes/orders.js
- src/domain/orders.js
- test/routes-orders.test.js
- src/registry.js
- src/server.js
- src/lib/http-helpers.js

## Files changed last time

- src/routes/orders.js
- src/registry.js
- test/routes-orders.test.js

## Steps last time

1. search (Bash)
2. read src/routes/orders.js
3. read src/domain/orders.js
4. read test/routes-orders.test.js
5. read src/registry.js
6. read src/server.js
7. read src/lib/http-helpers.js
8. write src/routes/orders.js (x2)
9. write src/registry.js (x2)
10. read src/domain/store.js
11. read package.json
12. read test/domain-orders.test.js
13. write test/routes-orders.test.js
14. run: bash ops/check.sh 2>&1 | tail -60
15. run: git stash && bash ops/check.sh 2>&1 | tail -40; git stash pop
16. run: node --test test/routes-orders.test.js 2>&1 | tail -40
17. run: APP_ENV=test APP_SEED=fixture node --test test/routes-orders.test.js 2>&1 | tail -60
