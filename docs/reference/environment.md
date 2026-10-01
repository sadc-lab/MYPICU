---
title: Environment
---

# Environment variables

Every variable the stack reads, where it comes from, and what breaks when it is
wrong.

```{contents}
:local:
:depth: 2
```

## Where they come from

| Source | Purpose |
|---|---|
| `.env.stack.local` | generated once by `scripts/local-env.py`, mode `0600` |
| `../optibrain/.env` | ICCA source credentials, hand-written |
| Shell / `.env` | optional overrides |

```sh
sh scripts/stack.sh config     # shows the fully resolved values
```

`scripts/local-env.py` **never overwrites** an existing `.env.stack.local`. To
rotate secrets, delete it deliberately and re-run, understanding that this
invalidates every issued token.

## Generated in `.env.stack.local`

| Variable | Purpose | Notes |
|---|---|---|
| `PUBLIC_URL` | the URL clinicians use | drives every Auth redirect |
| `POSTGRES_PASSWORD` | database superuser | 24 random bytes hex |
| `JWT_SECRET` | HS256 signing key | **identical** in `auth`, `rest`, `realtime` |
| `ANON_KEY` | JWT, role `anon` | browser-visible |
| `SERVICE_ROLE_KEY` | JWT, role `service_role` | **bypasses RLS** |
| `SECRET_KEY_BASE` | realtime | 48 bytes |
| `PG_META_CRYPTO_KEY` | Studio | 32 bytes |
| `SYNC_PASSWORD` | `optibrain_sync` role | |
| `SYNC_TOKEN` | worker ↔ Optibrain | also the worker HTTP token |
| `DEV_USER_PASSWORD` | seeded account | |
| `SYNC_INTERVAL_SECONDS` | cycle period | default `900` |
| `PATIENT_RETENTION_DAYS` | coarse window | default `3` |

`ANON_KEY` and `SERVICE_ROLE_KEY` are hand-rolled HS256 JWTs with a ten-year
expiry. They are structurally valid and meaningless to any other deployment,
because they are signed with this instance's `JWT_SECRET`.

## ICCA source (`../optibrain/.env`)

| Variable | Purpose |
|---|---|
| `DB_HOST` | source host |
| `DB_PORT` | source port |
| `DB_NAME` | source database |
| `DB_USER` | **read-only** user |
| `DB_PASSWORD` | password |

```ini
DB_HOST=spxp-app05.sainte-justinee.intranet
DB_PORT=5432
DB_NAME=cathydb
DB_USER=<read-only>
DB_PASSWORD=<password>
```

`chmod 600` this file. `scripts/local-up.sh` refuses to start without it.

## Optional overrides

Read from the shell or `.env`, defaulting as shown.

| Variable | Default | Effect |
|---|---|---|
| `SUPABASE_API_URL` | *empty* | leave empty; the client derives it from the page origin |
| `ICCA_QUERY_CONCURRENCY` | `4` | parallel source queries; lower it if the source is slow |
| `SYNC_INTERVAL_SECONDS` | `900` | floor of 30 enforced in code |
| `PATIENT_RETENTION_DAYS` | `3` | lowering it reduces memory pressure |

## Per-service variables

### `db`

| Variable | Value | Notes |
|---|---|---|
| `POSTGRES_DB` | `postgres` | |
| `JWT_SECRET` | from env | must match `auth` and `rest` |
| `JWT_EXP` | `3600` | |

Tuning flags are in the compose `command`, not the environment:
`shared_buffers=1GB`, `effective_cache_size=8GB`, `work_mem=8MB`,
`maintenance_work_mem=128MB`.

### `auth`

| Variable | Value | Notes |
|---|---|---|
| `GOTRUE_API_HOST` / `_PORT` | `0.0.0.0` / `9999` | |
| `API_EXTERNAL_URL` | `${PUBLIC_URL}/auth/v1` | **a wrong value breaks email links** |
| `GOTRUE_URI_ALLOW_LIST` | `${PUBLIC_URL}/**`, `http://127.0.0.1:8080/**` | add your hostname |
| `GOTRUE_JWT_SECRET` | from env | |
| `GOTRUE_JWT_AUD` / `_EXP` | `authenticated` / `3600` | |
| `GOTRUE_DISABLE_SIGNUP` | `false` | set `true` to lock registration |
| `GOTRUE_MAILER_AUTOCONFIRM` | `false` | `true` skips email confirmation |
| `GOTRUE_SMTP_HOST` / `_PORT` | `mailpit` / `1025` | **no real email is ever sent** |

### `rest`

| Variable | Value | Notes |
|---|---|---|
| `PGRST_DB_SCHEMAS` | `public` | |
| `PGRST_DB_ANON_ROLE` | `anon` | |
| `PGRST_DB_MAX_ROWS` | `100000` | raised because the frontend does not paginate |

### `realtime`

| Variable | Value | Notes |
|---|---|---|
| `DB_AFTER_CONNECT_QUERY` | `SET search_path TO _realtime` | |
| `DB_ENC_KEY` | `supabaserealtime` | |
| `DNS_NODES` | `''` | disables clustering |
| `APP_NAME` / `SEED_SELF_HOST` | `realtime` / `true` | single-tenant |

### `optibrain` / `optibrain-autoreg`

| Variable | Value | Notes |
|---|---|---|
| `DB_MAX_CONCURRENT_QUERIES` | `ICCA_QUERY_CONCURRENCY` | |
| — | from `../optibrain/.env` | ICCA credentials |

### `optibrain-sync`

| Variable | Default | Notes |
|---|---|---|
| `LOCAL_DSN` | `optibrain_sync@db` | **not** a RLS bypass role |
| `SOURCE_TIMEZONE` | `America/Montreal` | corrects naive source timestamps |
| `OPTIBRAIN_URL` | `http://optibrain:8000` | |
| `OPTIBRAIN_AR_URL` | `http://optibrain-autoreg:8000` | |
| `OPTIBRAIN_EXPORT_DIR` | `/optibrain/donnees` | must match the module's input path |
| `OPTIBRAIN_AR_EXPORT_DIR` | `/optibrain-ar/donnees` | private to autoregulation |

### `envoy`

| Variable | Purpose |
|---|---|
| `ANON_KEY`, `SERVICE_ROLE_KEY` | substituted into the template by `gateway-init` |

The template on disk is **not** what Envoy reads. See {doc}`../services/gateway`.

## Changing a variable

```sh
# edit
nano .env.stack.local

# recreate only the affected services
sh scripts/stack.sh up -d --force-recreate auth studio web envoy
```

Some variables are baked into the image at build time and need a rebuild:

| Variable | Needs |
|---|---|
| `SUPABASE_API_URL` | `build web` |
| `ANON_KEY` | `build web` and recreate `gateway-init envoy` |

## Common misconfigurations

| Symptom | Variable | Fix |
|---|---|---|
| Confirmation link goes to the wrong place | `PUBLIC_URL` | correct it, recreate `auth` |
| Every API call 401s | `JWT_SECRET` mismatch between `auth` and `rest` | make them identical |
| Envoy 401s everything | `ANON_KEY` not rendered | check `gateway-init` logs |
| Redirect loop | `GOTRUE_URI_ALLOW_LIST` | add the hostname |
| Source queries time out | `ICCA_QUERY_CONCURRENCY` | lower to 2 |
| Pages huge, `rest` at its limit | `PGRST_DB_MAX_ROWS` | add filters, don't lower the ceiling blindly |

## Related

- {doc}`../services/authentication` — Auth in detail
- {doc}`../backup-restore` — what to capture with the configuration