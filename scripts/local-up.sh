#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
python3 "$ROOT/scripts/local-env.py"
if [ ! -f "$ROOT/.env.stack.local" ]; then
  printf '%s\n' 'Create .env.stack.local first.' >&2
  exit 1
fi
for key in DB_HOST DB_NAME DB_USER DB_PASSWORD; do
  if ! grep -q "^${key}=" "$ROOT/.env.stack.local"; then
    printf 'Add %s to .env.stack.local first.\n' "$key" >&2
    exit 1
  fi
done
sh "$ROOT/scripts/stack.sh" up -d --build --wait --wait-timeout 300 --remove-orphans
printf '%s\n' 'App: http://localhost:8080 | Studio: http://localhost:54323 | Mailpit: http://localhost:8025'
