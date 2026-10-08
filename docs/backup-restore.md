---
title: Backup and restore
---

# Backup and restore

Recovering the application after a crash, a bad migration, or an accidental
data loss.

```{contents}
:local:
:depth: 2
```

## What you must protect, in order of importance

Not everything is equally recoverable. This distinction determines what your
backup has to include.

| # | Data | Volume / table | Recoverable from source? |
|---|---|---|---|
| 1 | **User accounts** | `db` → `auth.users` | **No** |
| 2 | **Clinician objectives** | `db` → `patient_objectives` | **No** |
| 3 | **Custom views** | `db` → `patient_custom_view` | **No** |
| 4 | **View history** | `db` → `patient_view_log` | **No** |
| 5 | Autoregulation results | `db` → `patient_autoregulation` | Yes, but ~35 min/patient |
| 6 | Validity matrices | `db` → `patient_validity` | Yes, one sync cycle |
| 7 | Patient cache | `db` → `patient_vitals` etc. | Yes, one sync cycle |
| 8 | Optibrain CSVs | `optibrain-*-data` | Yes, regenerated each cycle |

```{danger}
Items **1–4 cannot be reconstructed from the ICCA source.** They exist only in
the local database. A backup that captures only the cache can be rebuilt in
about a minute, but it will contain no accounts and no objectives. **A full
`pg_dump` of the database is the only thing that preserves them**, because they
live in the same database as the cache.
```

This is the single most important fact in this document: you do not need to back
up the Optibrain volumes, and you cannot get away with not backing up `db`.

## Quick reference

```sh
# backup
sh scripts/stack.sh exec -T db pg_dump -U postgres -Fc postgres \
  > backup-$(date +%Y%m%d-%H%M).dump

# restore into a fresh database
sh scripts/stack.sh exec -T db dropdb -U postgres --force postgres
sh scripts/stack.sh exec -T db createdb -U postgres postgres
cat backup-20261001-1430.dump \
  | sh scripts/stack.sh exec -T db pg_restore -U postgres -d postgres --clean --if-exists
```

## Creating a backup

### A good backup

```sh
cd /home/applications/MYPICU
mkdir -p backups
STAMP=$(date +%Y%m%d-%H%M)
sh scripts/stack.sh exec -T db pg_dump -U postgres -Fc postgres \
  > "backups/mypicu-$STAMP.dump"
gzip -9 "backups/mypicu-$STAMP.dump"
ls -lh "backups/mypicu-$STAMP.dump.gz"
```

`-Fc` is the **custom format**: compressed, and restorable table-by-table with
`pg_restore`, which is what you want for partial recovery.

Verify the dump is readable — an unverified backup is not a backup. Both
commands run through the `db` container, so the host needs no Postgres client
tools of its own:

```sh
gzip -t backups/mypicu-$STAMP.dump.gz        # archive intact
zcat backups/mypicu-$STAMP.dump.gz \
  | sh scripts/stack.sh exec -T db pg_restore --list | tail -5
                                             # table of contents parses
```

### What a backup contains

```
mypicu-20261001-1430.dump.gz
├── auth schema        → users, sessions, identities      ← irreplaceable
├── public schema
│   ├── patients                             (cache)
│   ├── patient_vitals                       (cache)
│   ├── patient_validity                     (derived)
│   ├── patient_autoregulation               (derived)
│   ├── patient_objectives                   ← irreplaceable
│   ├── patient_custom_view                  ← irreplaceable
│   └── patient_view_log                     ← irreplaceable
├── realtime / _realtime                     (rebuildable)
└── local_migrations                         (migration ledger)
```

### Backing up configuration too

The database alone is not enough to rebuild the stack. Also capture both
repositories' configuration. Run `tar` from the **parent** directory: GNU tar
silently strips a leading `../` from member names, so archiving
`../optibrain/.env` from inside `MYPICU/` would store it as `optibrain/.env`
and restore it in the wrong place.

```sh
cd /home/applications
STAMP=$(date +%Y%m%d-%H%M)
tar czf "MYPICU/backups/config-$STAMP.tar.gz" \
  MYPICU/.env.stack.local \
  MYPICU/docker/compose.local.yml \
  MYPICU/docker/envoy/envoy.yaml \
  MYPICU/supabase/migrations/ \
  optibrain/.env
chmod 600 "MYPICU/backups/config-$STAMP.tar.gz"
ls -lh "MYPICU/backups/config-$STAMP.tar.gz"
```

Confirm the Optibrain credentials made it in:

```sh
tar tzf "MYPICU/backups/config-$STAMP.tar.gz"
# expect: MYPICU/.env.stack.local, MYPICU/docker/..., optibrain/.env
```

:::{warning}
That tarball contains the database password and both API keys. `chmod 600` it
and store it as carefully as the database dump.
:::

### What you do not need to back up

| Volume | Why not |
|---|---|
| `optibrain-data` | rewritten from the source each cycle |
| `optibrain-ar-data` | rewritten from the source each cycle |
| `optibrain-results` | recomputed; validity regenerates in one cycle |
| `optibrain-ar-results` | recomputed, but at ~35 min/patient — restore from the DB instead |
| `envoy-config` | rendered from the template on every boot |

If you want belt-and-braces on the autoregulation *raw curves* without restoring
the database, copy `optibrain-ar-results` — but understand it can be large.

## Restoring

### Case 1 — a container crashed, data is intact

**Do nothing.** Volumes survived. Restart the service.

```sh
sh scripts/stack.sh up -d <service>
sh scripts/stack.sh ps
```

`restart: unless-stopped` already does this automatically for most failures.

### Case 2 — the database volume is corrupt or lost

The volume is gone. Recover everything from the dump.

```sh
cd /home/applications/MYPICU
sh scripts/stack.sh down

# if the volume still exists and is corrupt, clear it
sh scripts/stack.sh down -v

sh scripts/stack.sh up -d db
sh scripts/stack.sh exec -T db pg_isready -U postgres     # wait for healthy

zcat backups/mypicu-20261001-1430.dump.gz \
  | sh scripts/stack.sh exec -T db pg_restore -U postgres -d postgres \
      --no-owner --no-privileges
```

Then bring up the rest:

```sh
sh scripts/stack.sh up -d --wait --wait-timeout 300
sh scripts/stack.sh exec -T optibrain-sync python -m sync   # repopulate the cache
```

The restore brings back accounts and objectives immediately. The sync cycle
then refreshes the cache from the source, so even a stale dump is corrected
within a cycle.

### Case 3 — restore only part of the database

Custom-format dumps allow surgical recovery. This is how you save one clinician's
objectives from a bad deploy:

```sh
# what is in the dump?
zcat backups/mypicu-20261001-1430.dump.gz \
  | sh scripts/stack.sh exec -T db pg_restore --list | grep objectives

# restore a single table into the running database
zcat backups/mypicu-20261001-1430.dump.gz \
  | sh scripts/stack.sh exec -T db pg_restore -U postgres -d postgres \
      --data-only --table=patient_objectives
```

:::{warning}
`--data-only` skips DDL. The target table must already exist with the same
schema. If a migration changed it, restore the schema first or reconcile by hand.
:::

### Case 4 — the whole host is lost

You need the repositories, the config tarball, and the dump:

```sh
git clone <mypicu-url> /home/applications/MYPICU
git clone <optibrain-url> /home/applications/optibrain

cd /home/applications
cp /path/to/config-20261001-1430.tar.gz .
tar xzf config-20261001-1430.tar.gz    # MYPICU/.env.stack.local …, optibrain/.env

cd MYPICU
sh scripts/local-up.sh                 # start; a fresh DB is created
zcat backups/mypicu-20261001-1430.dump.gz \
  | sh scripts/stack.sh exec -T db pg_restore -U postgres -d postgres \
      --no-owner --no-privileges

sh scripts/stack.sh exec -T optibrain-sync python -m sync
```

The configuration tarball is extracted from `/home/applications` for the same
reason it was created there: its members are stored relative to that directory.

## Recovery procedure: from crash to working

```{mermaid}
sequenceDiagram
    autonumber
    participant O as Operator
    participant DC as docker compose
    participant DB as db
    participant SY as optibrain-sync

    O->>DC: sh scripts/stack.sh ps
    DC-->>O: which services are down / unhealthy

    alt data intact (most cases)
        O->>DC: up -d <service>
        Note over DC: volumes untouched, nothing to restore
    else db corrupt or missing
        O->>O: locate latest verified dump
        O->>DC: down
        O->>DC: down -v   (clears db-data)
        O->>DC: up -d db
        DB-->>O: healthy
        O->>O: pg_restore from dump
        O->>DC: up -d --wait
        SY->>DB: sync cycle
        Note over SY: repopulates the cache from<br/>the source, accounts and<br/>objectives come from the dump
    end

    O->>DC: verify: ps, preflight, /documentation
```

## Post-restore checklist

Do not declare success until all of these pass.

```sh
# 1. every service healthy
sh scripts/stack.sh ps --format 'table {{.Service}}\t{{.Status}}'

# 2. accounts survived
sh scripts/stack.sh exec -T db psql -U postgres -d postgres -c \
  "select count(*) from auth.users;"

# 3. ward assignments survived -- without these nobody sees patients
sh scripts/stack.sh exec -T db psql -U postgres -d postgres -c \
  "select count(*) from user_wards;"

# 4. data is present
sh scripts/stack.sh exec -T db psql -U postgres -d postgres -c \
  "select count(*) from patients;"

# 5. source access is intact
sh scripts/stack.sh exec -T optibrain-sync python preflight.py

# 6. the app answers
curl -sS -o /dev/null -w '%{http_code}\n' http://localhost/documentation/
```

Then, in a browser: sign in as a real user, open a patient, confirm vitals are
present, and confirm **no patient shows fabricated values**.

## Routine backup schedule

| Frequency | Action |
|---|---|
| Before any migration or upgrade | full dump + config tarball |
| Daily | full dump, keep 14 days |
| Weekly | full dump, keep 6 months, off-host copy |
| After any restore | fresh dump — you now know the previous one was no longer current |

Cron example:

```sh
15 2 * * * cd /home/applications/MYPICU && \
  sh scripts/stack.sh exec -T db pg_dump -U postgres -Fc postgres \
  | gzip > "backups/mypicu-$(date +\%Y\%m\%d).dump.gz" && \
  find backups -name '*.dump.gz' -mtime +14 -delete
```

## Backup hygiene

- A backup you have not restored from is a hypothesis.
- **Verify every dump** with `gzip -t` and `pg_restore --list`.
- Keep at least one copy **off the host**. A backup on the machine it protects
  does not survive the machine failing.
- Restrict permissions: the config tarball holds live credentials.
- Encrypt if copies leave the host.

## Related

- {doc}`deployment` § Upgrading — take a backup first
- {doc}`services/database` — what the tables are
- {doc}`services/observability` — diagnosing before you restore