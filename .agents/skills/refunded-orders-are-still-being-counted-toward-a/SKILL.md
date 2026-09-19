---
name: refunded-orders-are-still-being-counted-toward-a
description: Refunded orders are still being counted toward a customer's order total. Fix the total so it exclude. Learned from a fixture session with 16 tool calls.
---

# Refunded orders are still being counted toward a customer's order total. Fix the total so it exclude

Written by headstart from a recorded session. Reference data, check it against the code before relying on it.

## Verify

- `bash ops/check.sh`
- `APP_ENV=test APP_SEED=fixture node --test test/orders-total.test.js`

## Read first

- grep ""order.?total"
- grep "refund"
- test/orders-total.test.js
- src/domain/orders.js
- src/domain/store.js
- grep "total("

## Files changed last time

- src/domain/orders.js

## Steps last time

1. search "order.?total
2. search refund
3. read test/orders-total.test.js
4. read src/domain/orders.js
5. read src/domain/store.js
6. search total( (x2)
7. write src/domain/orders.js
8. run: node --test test/orders-total.test.js 2>&1 | tail -20
9. run: node --test test/orders-total.test.js 2>&1 | head -30
10. read ops/check.sh
11. run: bash ops/check.sh 2>&1 | tail -40
12. run: APP_ENV=test APP_SEED=fixture node --test test/orders-total.test.js 2>&1 | tail -15
13. run: bash ops/check.sh 2>&1 | grep -E "^ℹ (tests|pass|fail)"
14. run: bash ops/check.sh 2>&1 | grep "^✖"
15. search (Bash)
