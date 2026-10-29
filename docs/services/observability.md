---
title: Observability
---

# Observability and troubleshooting

How to tell what the stack is doing, and how to find out what went wrong.

```{contents}
:local:
:depth: 2
```

## Day-to-day commands

```sh
sh scripts/stack.sh ps                    # status of every service
sh scripts/stack.sh logs -f optibrain-sync # follow one service
sh scripts/stack.sh top                    # live CPU and memory
sh scripts/stack.sh stats --no-stream      # one-shot resource snapshot
```

## Health at a glance

```sh
sh scripts/stack.sh ps --format 'table {{.Service}}\t{{.Status}}'
```

Every service declares a healthcheck. `docker compose ps` shows `(healthy)` only
after the check passes, so this is the fastest way to see whether a failure is
one service or the whole stack.

| Service | Healthcheck | Passes when |
|---|---|---|
| `db` | `pg_isready` | Postgres accepts connections |
| `auth` | `wget /health` | GoTrue is up |
| `rest` | `postgrest --ready` | PostgREST connected |
| `realtime` | tenant health with anon key | tenant exists, key valid |
| `envoy` | TCP connect to 8000 | listener accepting |
| `web` | `fetch` `/` | bundle serving |
| `studio` | profile API | Studio up |
| `docs` | `wget --spider /documentation/` | Sphinx output present |
| `optibrain` | `GET /docs` | module listening |
| `optibrain-autoreg` | `GET /docs` | module listening |
| `optibrain-sync` | `GET :8001/health` | worker up |

`db-migrate` and `gateway-init` are **one-shot**: they are correct when they have
exited `0`. `compose ps` will not show them running.

## Logs

Access logs come from Envoy in a fixed, greppable format:

```
[2026-10-01T14:23:11Z] GET /rest/v1/patient_vitals 200 41ms - ua="Mozilla/5.0..."
```

Query strings are stripped — they carry `apikey` values and patient identifiers.
A log line therefore never contains a secret or a patient id in the path.

Useful filters:

```sh
# slow requests
sh scripts/stack.sh logs envoy | grep -E ' [0-9]{4,}ms '

# rejected keys -- should be near zero
sh scripts/stack.sh logs envoy | grep '401'

# health probes are noisy; exclude them
sh scripts/stack.sh logs envoy | grep -v '/health'
```

Service logs:

```sh
sh scripts/stack.sh logs --tail 200 optibrain-sync   # extraction failures
sh scripts/stack.sh logs --tail 200 optibrain        # matrix computation
sh scripts/stack.sh logs --tail 200 db                # SQL errors
```

## Resource baseline

The host has 11 GiB RAM, 4 CPUs and no swap. Known-good figures:

| State | Total across containers |
|---|---|
| Idle | ~1.1–1.7 GiB |
| During a 60-patient sync | ~1.2 GiB |
| Autoregulation fit (2 h window) | ~1.2 GiB peak |

```sh
sh scripts/stack.sh stats --no-stream \
  --format 'table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}'
```

Because there is **no swap**, a container that exceeds its `mem_limit` is OOM-killed
rather than slowed. That is the intended failure mode: one container dies, the
others keep working, and the restart policy brings it back. A host-wide freeze
would mean several limits were raised at once.

Check the kernel agrees:

```sh
docker info --format '{{.MemTotal}}'
docker exec mypicu-local-db-1 free -h
```

## Common incidents

### The app loads but shows no patients

```sh
sh scripts/stack.sh logs --tail 50 optibrain-sync     # did the last cycle run?
sh scripts/stack.sh exec -T db psql -U postgres -d postgres -c \
  "select count(*) from patients;"
```

If `patients` is empty, the last census returned zero rows — the known
`ptcensus` outage. The worker deliberately keeps the previous cache in that case,
so an **empty** table means the cache was never populated, not that it was
cleared. See {doc}`sync-worker` § The zero-census case.

### Validity is empty

```sh
sh scripts/stack.sh logs --tail 100 optibrain
sh scripts/stack.sh exec -T db psql -U postgres -d postgres -c \
  "select count(*) from patient_validity;"
```

Almost always the module. Confirm it is healthy, inspect its logs, and check
the persisted `patient_validity` rows; OptiBrain returns matrices through its
API and does not use a results volume.

### A user is signed in but sees nothing

That user has no ward assignment. See {doc}`authentication` § Ward assignment.

### A container is restarting

```sh
sh scripts/stack.sh ps                        # restart count / status
docker inspect --format '{{.RestartCount}} {{.State.OOMKilled}}' \
  mypicu-local-optibrain-sync-1
docker logs --tail 100 mypicu-local-optibrain-sync-1
```

`OOMKilled: true` means the memory limit was hit.

### `db-migrate` refuses to start

```
checksum mismatch for 90_local.sql
```

The guard detected that an already-applied migration file was modified. **Do not**
delete the row from `local_migrations.applied`. Restore the file, or
create a new numbered migration. See {doc}`database` § Why the checksum guard matters.

### `gateway-init` fails, Envoy never starts

The Envoy template could not be rendered.

```sh
sh scripts/stack.sh logs gateway-init
sh scripts/stack.sh run --rm gateway-init
```

Usually `ANON_KEY` or `SERVICE_ROLE_KEY` missing from `.env.stack.local`.

## What is not monitored

There is no external alerting, metrics store, or log aggregation. Failure is
noticed by a human looking at the screen. If you need alerting, the natural
starting point is a periodic check of the health endpoints and a non-empty
`patients` table — the worker already exposes `GET /health` on 8001 for exactly
this.

## Related

- {doc}`../operations` — day-to-day procedures
- {doc}`../backup-restore` — recovering from a bad state
- {doc}`sync-worker` — reading extraction logs