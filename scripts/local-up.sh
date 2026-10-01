#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
python3 "$ROOT/scripts/local-env.py"
if [ ! -f "$ROOT/../optibrain/.env" ]; then
  printf '%s\n' 'Create ../optibrain/.env with DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD first.' >&2
  exit 1
fi
sh "$ROOT/scripts/stack.sh" up -d --build --wait --wait-timeout 300
printf '%s\n' 'App: http://localhost:8080 | Studio: http://localhost:54323 | Mailpit: http://localhost:8025'
