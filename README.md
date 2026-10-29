# MYPICU

Clinician-facing PICU dashboard with computed protocol adherence and brain
autoregulation, running entirely on one host with no cloud dependency.

## Documentation

The full documentation is published by the stack itself at
**[/documentation](http://mypicu.miircic.hsj.rtss.qc.ca/documentation/)** and
lives in [`docs/`](docs/) — the repository copy and the published site are the
same files.

| Start here | |
|---|---|
| [Operations](docs/operations.md) | day-to-day running |
| [Deployment](docs/deployment.md) | install, including the Optibrain module |
| [Architecture](docs/architecture.md) | how it fits together, with schematics and timing diagrams |
| [Backup and restore](docs/backup-restore.md) | crash recovery |
| [Optibrain module](docs/optibrain-module.md) | the computation module |
| [Per-service pages](docs/services/) | one page per container |
| [Reference](docs/reference/) | environment variables, API, tables |

## Quick start

```sh
cd /home/applications/MYPICU
sh scripts/local-up.sh
```

Requires Docker Engine 24+ with Compose v2, the Optibrain repository cloned
as a sibling at `../optibrain`, and a root `.env.icca` holding read-only ICCA
credentials.

| Service | URL |
|---|---|
| App | `http://mypicu.miircic.hsj.rtss.qc.ca/` |
| Documentation | `http://mypicu.miircic.hsj.rtss.qc.ca/documentation/` |
| Supabase Studio | `http://127.0.0.1:54323` (loopback only) |
| Mailpit | `http://127.0.0.1:8025` (loopback only) |

> **Warning:** Port 80 is **plain HTTP** and the host firewall is inactive. Do
> not use this for clinical work until TLS is configured — see
> [docs/deployment.md](docs/deployment.md).

## Repository layout

```
MYPICU/
├── docker/                  all container configuration
│   ├── compose.local.yml    the single, authoritative Compose file
│   ├── db/                  init scripts and bootstrap SQL
│   ├── docs/                Sphinx container (Dockerfile, nginx.conf)
│   ├── envoy/               gateway template
│   ├── frontend/            SPA image
│   ├── worker/              shared sync runtime + registered module runners
│   └── browser/             Playwright end-to-end checks
├── docs/                    documentation sources (also the Sphinx source)
│   ├── services/            one page per container
│   ├── reference/           environment, API, tables
│   └── archive/             superseded docs, excluded from the site
├── public/  src/            frontend
├── scripts/                 local-env.py, local-up.sh, stack.sh
└── supabase/migrations/     schema, applied in order at boot
```

Everything Docker-related is under `docker/`. There is one Compose file.

## Commands

```sh
sh scripts/stack.sh ps                      # status of every service
sh scripts/stack.sh logs -f sync-worker  # follow a service
sh scripts/stack.sh up -d --build --remove-orphans # rebuild and apply changes
sh scripts/stack.sh exec -T sync-worker python -m sync   # force a sync cycle
```

`scripts/stack.sh` is a thin wrapper that pins the project directory, the env
file and the Compose file, so plain `docker compose` also works if you pass
those yourself.

## Data and correctness

Every number displayed traces to a measured value or to an Optibrain computation
over measured values. A missing measurement renders `—`, never a substitute.

- The local database is a **cache** of the ICCA source, plus everything computed
  or clinician-entered. See
  [docs/architecture.md](docs/architecture.md#where-data-lives).
- User accounts and clinician objectives exist **only** locally and cannot be
  re-fetched. Back them up — see
  [docs/backup-restore.md](docs/backup-restore.md).
- The Optibrain module lives in a separate repository at `../optibrain`.

## Tests

```sh
# worker
sh scripts/stack.sh exec -T sync-worker python -m unittest \
  test_cache test_sync test_optibrain_export test_autoregulation

# browser (Playwright container)
for t in smoke live forwarded-port lock-contention documentation; do
  docker run --rm --network host --env-file .env.stack.local \
    -v "$PWD/docker/browser/$t.cjs:/t.cjs:ro" \
    mcr.microsoft.com/playwright:v1.55.1-noble \
    sh -c "cd /tmp && npm i --silent playwright@1.55.1 >/dev/null && cp /t.cjs . && node t.cjs"
done
```

The `web` image runs `tsc --noEmit` during its build, so a TypeScript regression
fails the image rather than reaching a running container.