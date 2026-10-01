---
title: Sync worker
---

# Sync worker (`optibrain-sync`)

The component that owns every number in the application. It extracts clinical
data from the ICCA source, writes the local cache, and orchestrates Optibrain.

```{contents}
:local:
:depth: 2
```

## Identity

| | |
|---|---|
| Compose service | `optibrain-sync` |
| Image | `mypicu-worker:local`, built from `docker/worker/` |
| HTTP port | 8001, internal only |
| Database role | `optibrain_sync` — not a RLS bypass role |
| Memory limit | 1 GiB |

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `LOCAL_DSN` | — | DSN as `optibrain_sync` |
| `SYNC_INTERVAL_SECONDS` | 900 | cycle period (floor of 30) |
| `PATIENT_RETENTION_DAYS` | 3 | coarse monitor window |
| `SOURCE_TIMEZONE` | `America/Montreal` | naive-source correction |
| `ICCA_QUERY_CONCURRENCY` | 4 | parallel source queries |
| `OPTIBRAIN_URL` | `http://optibrain:8000` | indicator module |
| `OPTIBRAIN_AR_URL` | `http://optibrain-autoreg:8000` | autoregulation module |
| `OPTIBRAIN_EXPORT_DIR` | `/optibrain/donnees` | must equal the module's input path |
| `OPTIBRAIN_AR_EXPORT_DIR` | `/optibrain-ar/donnees` | private autoregulation input |
| `OPTIBRAIN_TOKEN` | = `SYNC_TOKEN` | shared secret |

The export directories are mounted at the **same paths** on both sides so the
CSVs the worker writes are exactly the ones the modules read.

## Module layout

| File | Responsibility |
|---|---|
| `worker.py` | scheduler, FastAPI control endpoints, cache orchestration |
| `queries.py` | every ICCA SQL query, all time-bounded |
| `cache.py` | in-memory accumulation and atomic replacement |
| `census.sql` | census, weight, GCS, date of birth |
| `optibrain_export.py` | writes the 23 + 7 CSV contract and manifests |
| `preflight.py` | verifies source-table permissions before the first sync |
| `migrate.py` | migration runner (also used by `db-migrate`) |
| `verify.py` | post-sync consistency checks |
| `render_gateway.py` | renders the Envoy template (also used by `gateway-init`) |
| `sync.py` | CLI client: `python -m sync [encounterid]` |

## The cycle

```
refresh_census()
   │
   ├─ zero rows from ptcensus/d_encounter?  ──▶  keep the previous cache, log, continue
   │
   ▼
harvest()  ── queries.py, per patient, bounded windows
   │
   ▼
sync_batch() ── ONE transaction
   │   TRUNCATE + rewrite patients, patient_vitals,
   │   patient_medications, patient_clinical_info
   ▼
export_indicators() ──▶ optibrain  ──▶ rewrite patient_validity
   │
   ▼ (detached, only if ar_busy is free)
autoregulation_cycle() ──▶ optibrain-autoreg ──▶ upsert patient_autoregulation
```

## Time bounding — the reason it is fast

The naive approach scans `icca_htr` per patient per parameter. Heart rate alone
cost **~14.6 s**. The worker instead issues a small number of **set-based,
time-bounded** queries:

| Window | Resolution | Why |
|---|---|---|
| last 24 h | median **per minute** | what a clinician reads |
| back to `PATIENT_RETENTION_DAYS` | median **per hour** | trend history |

Full 60-patient sync: **~49 s**, producing ~112k cache rows and ~22.5k validity
rows.

Every query carries an explicit window and a statement timeout. There is no
unbounded scan anywhere in `queries.py` — this is a hard rule, because a single
unbounded query on this schema saturates the 4 available CPUs.

## Monitor channels extracted

| Channel | Source |
|---|---|
| FC, FR, SpO₂ | `icca_htr` |
| PAM | `icca_htr` `PAm` |
| ARTm | `icca_htr` `ARTm` |
| EtCO₂ | `icca_htr` `CO2fe` |
| PIC mean/max/min | `icca_htr` `PICm` / `PICd` / `PICs` |
| PVC | `icca_htr` `PVCm` |
| rSO₂ (NIRS) | `icca_htr` `rSO%` |
| Labs | `ptlabresult`, preferring `valuenumber` |
| Blood gases | `blood_gas` |
| GCS | `ptassessment` `attributeid=53122` |
| Pupils | parsed from `ptassessment` text, e.g. `2 mm RB` |
| Head position | `ptassessment` |
| Transfusions, nutrition | `pttreatment`, `pttotalbalance` |
| Medications | `ptmedication` |
| Notes | `ptintervention` |

:::{note}
`icca_htr` also carries ~30 further channels for these patients — ventilator
settings, ECG intervals (QTc, ST), alarm limits. They are deliberately not read:
the ventilator channels belong to the OptiLungs module, which is out of scope
for v1. The ECG intervals are the one genuine gap. See
{doc}`../architecture` § What is not pulled.
:::

## Atomicity

The cache write is a single transaction:

```sql
BEGIN;
  TRUNCATE patients, patient_vitals, patient_medications, patient_clinical_info;
  -- rewrite from the accumulated harvest
COMMIT;
```

A failure anywhere inside rolls the whole thing back, so the database is never
left half-written. This is why the worker can be killed at any moment without
corrupting the cache.

### The zero-census case

If `ptcensus` or `d_encounter` returns zero rows — the known intermittent source
outage — the worker **keeps the existing cache** and logs it. It does not
truncate. Truncating on an empty result is what would silently erase the entire
patient cache during a source outage.

## Autoregulation scheduling

```python
ar_busy = asyncio.Lock()

async def autoregulation_cycle(patients):
    if ar_busy.locked():
        return            # a fit is already running; skip this cycle
    await ar_busy.acquire()
    try:
        ...
    finally:
        ar_busy.release()
```

This is why autoregulation is a separate container. A single fit takes ~35
minutes; the Optibrain pipeline serialises requests behind one lock, so running
both in one instance would stall indicator extraction and delay the validity
write the UI depends on.

Candidates are chosen by signal availability — PRx needs native PIC **and** PPC,
COx needs NIRS **and** PAM. Ineligible patients are skipped rather than
fabricated.

## Control endpoints

Internal, protected by `Authorization: Bearer $SYNC_TOKEN`.

| Endpoint | Purpose |
|---|---|
| `GET /health` | liveness — used by the container healthcheck |
| `POST /sync` | run one full cycle now |
| `POST /sync/{encounterid}` | sync a single patient |

```sh
# trigger a cycle
sh scripts/stack.sh exec -T optibrain-sync python -m sync

# one patient
sh scripts/stack.sh exec -T optibrain-sync python -m sync 16507
```

## Preflight

`preflight.py` checks `has_table_privilege` for every source table the worker
reads, before the first sync. Fifteen tables are verified. A missing grant fails
fast with a clear message instead of surfacing as an empty result set.

```sh
sh scripts/stack.sh exec -T optibrain-sync python preflight.py
```

## Tests

```sh
sh scripts/stack.sh exec -T optibrain-sync python -m unittest \
  test_cache test_sync test_optibrain_export test_autoregulation
```

45 tests. They cover cache merging, pupil parsing, census behaviour,
transaction rollback, CSV contract shape and 0/1 validity translation.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Cycle takes minutes, not ~49 s | a query lost its time bound | check `queries.py` for the window |
| Zero patients, cache still populated | source census outage | expected; wait for the source |
| `patient_validity` empty | Optibrain unreachable | `sh scripts/stack.sh logs optibrain` |
| Autoregulation never runs | `ar_busy` held by a dead fit | restart `optibrain-sync` |
| `statement timeout` in logs | source is slow | lower concurrency or raise the timeout |
| OOM-killed | exceeded 1 GiB | reduce `PATIENT_RETENTION_DAYS` |

## Related

- {doc}`optibrain` — the modules this worker drives
- {doc}`database` — where the output lands
- {doc}`../backup-restore` — why the cache is safe to rebuild