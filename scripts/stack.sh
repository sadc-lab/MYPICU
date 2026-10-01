#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
exec docker compose --project-directory "$ROOT" --env-file "$ROOT/.env.stack.local" -f "$ROOT/docker/compose.local.yml" "$@"
