---
title: Database
---

# Database (db, db-migrate, rest)

Postgres 17 plus PostgREST. Holds the patient cache, the Optibrain-derived
results, and everything entered locally.

```{contents}
:local:
:depth: 2
```

## Identity

| | |
|---|---|
| Compose service | `db` |
| Image | `supabase/postgres:17.6.1.136` |
| Volume | `db-data` (the only irreplaceable volume besides the Optibrain ones) |
| Memory limit | 2 GiB |
| Exposed | not published; reached in-network at `db:5432` |

## Startup order

```
db  ──healthy──▶  auth  ──healthy──▶  db-migrate  ──exit 0──▶  rest
                                                        └──▶  realtime
```

`db-migrate` runs to completion before `rest` or `realtime` start. It is a
one-shot container (`python migrate.py`) that applies
`supabase/migrations/*.sql` in order, tracks checksums in
`local_migrations.schema_migrations`, and refuses to run if a previously applied
file has been modified.

### Why the checksum guard matters

During development `docker/db/90_local.sql` was edited after being applied. The
guard caught it on the next boot rather than silently diverging local state from
the repository. The resolution was to restore the file byte-for-byte and move the
change into a new numbered migration.

If you see `checksum mismatch`, do **not** delete the row from
`local_migrations.schema_migrations`. Find out what changed first. See
{doc}`../operations` § Migrate container refuses to start.

## Configuration

```yaml
command: [postgres, -c config_file=/etc/postgresql/postgresql.conf,
          -c shared_buffers=1GB, -c effective_cache_size=8GB,
          -c work_mem=8MB, -c maintenance_work_mem=128MB]
```

`shared_buffers` is real memory. `effective_cache_size` is only a planner hint,
but leaving the stock value (which assumes a large machine) misleads the planner.
The values are sized for an 11 GiB host with no swap.

## Init scripts

Run once, on an empty data directory:

| File | Effect |
|---|---|
| `docker/db/roles.sql` | creates `anon`, `authenticated`, `authenticator`, `service_role`, `supabase_admin`, `optibrain_sync` |
| `docker/db/realtime.sql` | realtime tenant + publication setup |

:::{warning}
These only run when `db-data` is **empty**. Changing them after first boot has
no effect. See {doc}`../backup-restore` § Changing roles or init scripts.
:::

## Schemas

| Schema | Purpose |
|---|---|
| `public` | application tables, exposed to PostgREST |
| `auth` | GoTrue users, sessions, identities |
| `_realtime` | realtime tenant and subscriptions |
| `realtime` | message broadcasts |
| `storage` | file storage (unused in v1) |
| `local_migrations` | applied-migration ledger |
| `vault` | secret storage (unused in v1) |

## Tables in `public`

| Table | Origin | ~Rows | Notes |
|---|---|---|---|
| `patient_vitals` | mirrored from ICCA | 101,736 | downsampled monitor data; 155 MB |
| `patient_validity` | **computed** by Optibrain | 23,328 | 19 indicators × hourly windows |
| `patient_medications` | mirrored | 807 | active orders |
| `patient_clinical_info` | mirrored | 206 | categorical and free text |
| `patients` | mirrored | 59 | census, DOB, weight |
| `patient_autoregulation` | **computed** | 0 | PRx/COx + raw curves |
| `patient_objectives` | **local only** | 0 | clinician-entered; backed up |
| `patient_custom_view` | **local only** | 0 | per-clinician UI state; backed up |
| `patient_view_log` | **local only** | 29 | visit history; backed up |
| `autoreg_study_results` | local analysis | 0 | study uploads |

Table definitions are in `supabase/migrations/`. Column-level detail is in
{doc}`../reference/tables`.

## PostgREST (service `rest`)

| | |
|---|---|
| Image | `postgrest/postgrest:v14.17` |
| Port | 3000 |
| Memory limit | 192 MiB |
| Schema exposed | `public` only |
| Max rows | 100,000 |

`PGRST_DB_MAX_ROWS` is raised because the frontend fetches validity and
medication sets without pagination. If you ever query `patient_vitals` without
a `limit` or a time filter you will pull the whole 155 MB table into the
`rest` container's 192 MiB budget.

## Row-level security

Data authorisation is enforced in Postgres, not in Envoy.

- Envoy's Lua filter proves the caller knows a valid key (see {doc}`gateway`).
- RLS proves the **user** is entitled to the **rows**, using the JWT claims
  (`role`, `email`) and `user_wards`.

A service-role key bypasses RLS. The worker connects as `optibrain_sync`, which
is deliberately not a bypass role — it can write its own tables and nothing else.

## Common queries

```sh
# row counts
sh scripts/stack.sh exec -T db psql -U postgres -d postgres -c "
  select relname, n_live_tup from pg_stat_user_tables
  where schemaname='public' order by n_live_tup desc;"

# how many patients have autoregulation today
sh scripts/stack.sh exec -T db psql -U postgres -d postgres -c "
  select count(distinct encounter_id) from patient_autoregulation;"

# cache freshness
sh scripts/stack.sh exec -T db psql -U postgres -d postgres -c "
  select max(last_synced_at) from patients;"
```

## Related

- {doc}`../reference/tables` — column-level reference
- {doc}`../backup-restore` — dumping and restoring this database
- {doc}`sync-worker` — what writes these tables