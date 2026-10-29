---
title: Deployment
---

# Deploying MYPICU

Installing the stack from scratch, including the Optibrain computation module.

```{contents}
:local:
:depth: 2
```

## What you are deploying

| | |
|---|---|
| Purpose | Clinician-facing PICU dashboard with computed adherence and autoregulation |
| Compute | Single host, 11 GiB RAM, 4 CPUs, no swap |
| Data source | ICCA `cathydb`, read-only |
| Computation | Optibrain, built from `../optibrain` |
| Ingress | Envoy on port 80 |
| External dependencies | None. No cloud services are contacted. |

```{contents}
:local:
:depth: 1
```

## Prerequisites

| Requirement | Version | Check |
|---|---|---|
| Docker Engine | 24+ with Compose v2 | `docker compose version` |
| Python | 3.9+ | `python3 --version` |
| Available RAM | ≥ 8 GiB (11 GiB used here) | `free -h` |
| Available disk | ≥ 20 GiB | `df -h /var/lib/docker` |
| ICCA connectivity | read access to `cathydb` | see below |

The stack reaches the ICCA source directly. If it is only reachable from a
different network segment, you need a route or a tunnel before starting.

```sh
# confirm source reachability from this host
nc -vz spxp-app05.sainte-justine.intranet 5432
```

## Repository layout

Two repositories side by side:

```
/home/applications/
├── MYPICU/          # application, database, gateway, documentation
└── optibrain/       # computation module
```

Compose builds `../optibrain` for the `optibrain` and `optibrain-autoreg`
services. **Both must exist.** Optibrain is not vendored into MYPICU.

## Deployment procedure

### 1. Clone both repositories

```sh
cd /home/applications
git clone <mypicu-url> MYPICU
git clone <optibrain-url> optibrain
cd MYPICU
```

### 2. Configure the ICCA source

The shared sync runtime and computation containers read ICCA credentials from
MYPICU's ignored `.env.icca` file.

On an existing installation, copy the existing read-only source settings once:
`cp ../optibrain/.env .env.icca`, then confirm the permissions remain `0600`.

```sh
cat > .env.icca <<'EOF'
DB_HOST=<icca-host>
DB_PORT=5432
DB_NAME=<database>
DB_USER=<read-only-user>
DB_PASSWORD=<password>
EOF
```

Requirements:

- The credentials must be **read-only**. The source connection sets
  `search_path=readonly,public` and must never write to the source.
- `chmod 600 .env.icca` — it contains a database password.

The worker's source preflight checks connectivity and grants during startup;
the deployment verification in step 4 runs it explicitly.

### 3. Generate secrets and start

```sh
sh scripts/local-up.sh
```

This runs `scripts/local-env.py`, which **generates local secrets once and never
overwrites an existing installation**, then brings the stack up, waits for
health, and prints the URLs.

Expected output:

```
App: http://localhost:8080 | Studio: http://localhost:54323 | Mailpit: http://localhost:8025
```

Generated in `.env.stack.local`:

| Variable | Purpose |
|---|---|
| `POSTGRES_PASSWORD` | database superuser |
| `JWT_SECRET` | shared by `auth`, `rest`, `realtime` — **must be identical across all three** |
| `ANON_KEY` | HS256 JWT, browser-visible |
| `SERVICE_ROLE_KEY` | HS256 JWT, bypasses RLS |
| `SYNC_PASSWORD` | `sync_worker` role |
| `SYNC_TOKEN` | worker ↔ Optibrain shared secret |
| `SECRET_KEY_BASE` | realtime |
| `PG_META_CRYPTO_KEY` | Studio |
| `DEV_USER_PASSWORD` | seed account |
| `PUBLIC_URL` | the URL clinicians use |

```sh
cat .env.stack.local     # treat this file as a credential
chmod 600 .env.stack.local
```

### 4. Verify

```sh
sh scripts/stack.sh ps                       # every service (healthy)
sh scripts/stack.sh exec -T sync-worker python preflight.py
curl -sS -o /dev/null -w '%{http_code}\n' http://localhost/documentation/
curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:8080/
```

Preflight must report all fifteen source tables accessible. The first sync runs
on a 900 s interval; to run it immediately:

```sh
sh scripts/stack.sh exec -T sync-worker python -m sync
```

Expect roughly 60 patients, ~108k cache rows (patients + vitals + medications +
clinical info), ~22.7k validity rows, and about a minute per full cycle.

### 5. Confirm no cloud egress

```sh
sh scripts/stack.sh exec -T web sh -c 'ls /usr/share/nginx/html/assets | head'
grep -rn "supabase\.co\|https://[a-z0-9-]*\.supabase" src/ | grep -v "localhost\|127.0.0.1"
```

Both should be empty. A non-empty second command means a cloud endpoint is
compiled into the bundle.

## Startup order

Compose enforces this through `depends_on` with health conditions:

```
db (healthy)
  └──▶ auth (healthy)
          └──▶ db-migrate  (exit 0)
                  ├──▶ rest (healthy)
                  ├──▶ realtime (healthy)
                  └──▶ sync-worker
  └──▶ optibrain (healthy) ──▶ sync-worker

gateway-init (exit 0) ──▶ envoy (healthy) ──▶ studio
web (healthy) ──────────────────────────────▶ envoy
```

`db-migrate` and `gateway-init` are **one-shot**. If either fails, the services
downstream of it never start. That is deliberate: Envoy must not serve an
unrendered template containing unsubstituted key placeholders, and `rest` must
not serve an unmigrated schema.

The worker service is named `sync-worker`. The next database migration renames
the prior `optibrain_sync` role while preserving its existing grants, and
`scripts/local-up.sh` removes the old Compose container to avoid running two
schedulers after upgrade.

## Port 80

Envoy publishes:

```yaml
ports:
  - "80:8000"                 # all interfaces, the real ingress
  - "127.0.0.1:8080:8000"     # loopback, for local work
```

This works because `dockerd` runs privileged, so publishing a low port succeeds
even though the invoking user is not root.

:::{warning}
With **rootless** Docker, binding port 80 fails (`permission denied`). Options:

1. Grant the capability: `sudo setcap 'cap_net_bind_service=+ep' $(which dockerd)` and restart dockerd.
2. Publish on a high port and let an external reverse proxy map 80 → 8000.
:::

Confirm:

```sh
ss -ltnp | grep ':80 '
curl -sS -o /dev/null -w '%{http_code}\n' http://mypicu.miircic.hsj.rtss.qc.ca/
```

## Hostname

`http://mypicu.miircic.hsj.rtss.qc.ca/` must resolve to this host
(`10.128.80.129`). The frontend derives its API base from
`window.location.origin`, so the app works unchanged on the hostname, on
loopback, and on any forwarded port.

## TLS

:::{danger}
**The stack ships without TLS.** Port 80 is plain HTTP and the host firewall is
inactive, so the whole `10.128.80.0/22` subnet can reach it. Passwords and JWTs
travel in cleartext.

This must be resolved before clinical use. In order of preference:

**1. Envoy terminating TLS directly.** Envoy is already in the path:

```yaml
# docker/envoy/envoy.yaml
- name: local
  address:
    socket_address: {address: 0.0.0.0, port_value: 8000}
  filter_chains:
    - filter_chain_match:
        server_names: ["mypicu.miircic.hsj.rtss.qc.ca"]
      transport_socket:
        name: envoy.transport_sockets.tls
        typed_config:
          '@type': type.googleapis.com/envoy.extensions.transport_sockets.tls.v3.DownstreamTlsContext
          common_tls_context:
            tls_certificates:
              - certificate_chain: {filename: /etc/envoy/tls/fullchain.pem}
                private_key:       {filename: /etc/envoy/tls/privkey.pem}
  listeners:
    - name: local_plain
      address:
        socket_address: {address: 127.0.0.1, port_value: 8080}
```

Then set `PUBLIC_URL=https://mypicu.miircic.hsj.rtss.qc.ca` and recreate
`auth`, `studio`, `web`. Mount the certificate into the `envoy-config` volume —
note it is currently mounted **read-only**, so put the certificates in a separate
read-only mount.

**2. An external reverse proxy** (nginx, Caddy) terminating TLS on 443 and
proxying to `127.0.0.1:8080`.

**3. A firewall allowlist**, if the network is already trusted:

```sh
sudo ufw default deny incoming
sudo ufw allow from 10.128.80.0/22 to any port 80 proto tcp
sudo ufw enable
```

Verify the exposure before you decide:

```sh
sudo ufw status verbose
ss -ltnp | grep -E ':(80|8080|111) '
```

Note that `0.0.0.0:22` (ssh) and `0.0.0.0:111` (rpcbind) were already listening
on all interfaces before this stack was deployed. `rpcbind` is usually worth
closing off.

## Upgrading

```sh
cd /home/applications/MYPICU
git pull
cd ../optibrain && git pull && cd ../MYPICU

sh scripts/stack.sh build
sh scripts/stack.sh up -d --wait --wait-timeout 300
```

Before upgrading, take a backup — the upgrade runs migrations. See
{doc}`backup-restore`.

:::{warning}
`db-migrate` refuses to run if an already-applied migration file was modified.
Do not "fix" this by deleting rows from `local_migrations.applied`;
that silently diverges the database from the repository. See
{doc}`services/database`.
:::

## Uninstall

```sh
sh scripts/stack.sh down          # keeps volumes
sh scripts/stack.sh down -v       # DELETES the database and all Optibrain volumes
```

:::{danger}
`down -v` destroys the patient cache, the Optibrain volumes, **and every
clinician account, objective and custom view**. The cache and the Optibrain
volumes can be rebuilt from the source; user accounts and objectives cannot.
Take a backup first. See {doc}`backup-restore`.
:::

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `local-up.sh` exits immediately | missing `.env.icca` | see § Configure the ICCA source |
| `db-migrate` exits non-zero | checksum mismatch | see {doc}`services/database` |
| `envoy` never starts | `gateway-init` failed | `logs gateway-init` |
| port 80 will not bind | rootless Docker | see § Port 80 |
| `optibrain` unhealthy | bad ICCA credentials | `logs optibrain` |
| no patients after an hour | source census outage | see {doc}`services/observability` |
| OOM kills under load | limits too low or retention too wide | see {doc}`architecture` § Memory model |

## Related

- {doc}`backup-restore` — take a backup before upgrading
- {doc}`operations` — day-to-day use
- {doc}`optibrain-module` — the computation module in detail