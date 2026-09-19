#!/usr/bin/env bash
set -euo pipefail

export APP_ENV=test
export APP_SEED=fixture

cd "$(dirname "$0")/.."

node --test test/*.test.js
