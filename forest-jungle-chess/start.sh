#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
command -v npm >/dev/null || { echo '[ERROR] npm not found'; exit 1; }
[ -d node_modules ] || npm install
npm run dev -- --host 0.0.0.0
