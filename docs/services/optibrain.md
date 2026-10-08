---
title: Optibrain
---

# Optibrain (optibrain, optibrain-autoreg)

The clinical computation module: adherence matrices and brain autoregulation.
Built from the separate repository at `../optibrain`.

```{contents}
:local:
:depth: 2
```

## Two instances, one image

| | `optibrain` | `optibrain-autoreg` |
|---|---|---|
| Purpose | 19-indicator adherence matrices | PRx / COx fits |
| Runtime | ~seconds per patient | ~35 min per patient |
| Memory limit | 1 GiB | 3 GiB |
| Input volume | `optibrain-data` | `optibrain-ar-data` |
| Output volume | `optibrain-results` | `optibrain-ar-results` |
| Called by | every sync cycle | only when signals qualify |

Both run `mypicu-optibrain:local` from the same Dockerfile. They are separated
into two instances for three reasons:

1. **Latency.** The pipeline keeps module-global configuration and serialises
   every request behind one lock. A 35-minute fit would stall indicator
   extraction and delay the validity write the UI depends on.
2. **Memory.** The fit peaks near 1.2 GiB; the indicator pass needs almost none.
   A shared instance would have to carry the higher ceiling for everything.
3. **File isolation.** Private input volumes mean a long analysis cannot read
   channels the worker is halfway through rewriting.

## Configuration

Both read `../optibrain/.env` via `env_file`, which must contain the ICCA
credentials:

```ini
DB_HOST=...
DB_PORT=...
DB_NAME=...
DB_USER=...
DB_PASSWORD=...
```

Both then apply `DB_MAX_CONCURRENT_QUERIES` from `ICCA_QUERY_CONCURRENCY`
(default 4).

`scripts/local-up.sh` refuses to start the stack if `../optibrain/.env` is
missing, because the failure would otherwise surface much later as an empty
result set.

## Input contract

The worker writes CSVs plus a provenance manifest into the shared input volume.
The module reads them.

**Indicators — 23 CSV files.** Each parameter is one file.

**Autoregulation — 7 CSV files:** PIC, PPC, ART/PAM, NIRS, plus the
per-encounter index files.

Each batch is accompanied by a **manifest** recording, per patient, the encounter
id and whether the row is synthetic. Without it, a file left over from a previous
batch could be attributed to the wrong patient — the fix that made multi-patient
ward extraction safe.

## Reliability requirements

The Optibrain side of the contract is enforced in `../optibrain`:

| Requirement | Why |
|---|---|
| Provenance manifest per batch | prevents cross-patient attribution |
| Explicit `skip_fetch` | a patient with no DOB skips PPC only, not the whole run |
| Per-patient error isolation | one bad patient cannot fail the batch |
| Multi-patient SQL via `IN (...)` | no per-patient round trip |
| Native `ARTm` matching | the module must not mis-pair pressures |
| Bounded autoregulation queries | time windows, not open-ended |
| Explicit `search_path=readonly,public` | reads a schema it must not modify |
| Connection closing, `to_thread` | no pool exhaustion under load |
| CSV memoisation | avoids O(N²) file reads |
| Semicolon separator handling | pandas default is wrong for these files |
| `pandas<3`, `httpx` | pinned for compatibility |

A single worker is **mandatory** per instance: the pipeline uses process-global
state and a shared results directory.

## Health

```sh
sh scripts/stack.sh exec -T optibrain        python -c \
  "import urllib.request;urllib.request.urlopen('http://localhost:8000/docs')"
sh scripts/stack.sh exec -T optibrain-autoreg python -c \
  "import urllib.request;urllib.request.urlopen('http://localhost:8000/docs')"
```

Both expose OpenAPI at `/docs`, which is the quickest way to confirm the
instance came up and which endpoints it offers.

## Indicator results

Optibrain returns a 0/1 matrix per indicator. **0 = adherent.** The worker
translates this into `patient_validity`, one row per indicator per hourly window:

```{mermaid}
sequenceDiagram
    autonumber
    participant W as optibrain-sync
    participant O as optibrain
    participant P as db

    W->>O: POST /run (23 CSVs + manifest)
    Note over O: 19 indicators, failures isolated per patient
    O-->>W: matrices on optibrain-results
    W->>W: 0 = adherent → percent adherence
    W->>P: rewrite patient_validity atomically
    Note over P: ~22.5k rows, 19 indicators × 96 windows
```

There are **19 indicators** across 96 hourly windows. Missing adherence is stored
as `unknown`/null and rendered `Non évalué`; the frontend never substitutes 100%.

## Autoregulation results

Feasibility gates — these are hard, and a failed gate yields no row rather than a
guess:

| Metric | Requires |
|---|---|
| PRx | native **PIC** + **PPC** |
| COx | **NIRS** + **PAM** |
| CPP | never derived anywhere |

The run explores ~30 window combinations at ~70 s each, hence ~35 minutes.
Patient `#16792` had PIC/PPC/ARTm but no NIRS; the fit completed and found **no
reliable plateau**, so nothing was stored. That is correct behaviour — an
unreliable result must not become a displayed number.

Stored rows carry the headline values (`mode` — `PRx` or `COx`,
`optimal_pressure`, `inferior_limit`, `superior_limit`, `min_index`,
`pressure_variable`, `signal_variable`, `sample_count`) **and** the raw curve in
`raw`, so the chart renders the module's own output rather than a browser
reconstruction.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Empty `patient_validity` | module not reachable | check `logs optibrain`, `/docs` |
| Batch fails on one patient | isolation regression | inspect the manifest |
| Autoregulation skips everyone | signals missing | check PIC/PPC/NIRS/PAM presence |
| Container unhealthy | dependency or lock held | `restart: unless-stopped` recovers it |
| OOM-killed on a long fit | retention window too wide | lower `PATIENT_RETENTION_DAYS` |
| `module state` errors | more than one worker started | keep `uvicorn` single-worker |

## Source repository

The code lives at `../optibrain`. Its own documentation — the data contract, the
MYPICU deployment notes and the ward batch extraction design — is in
`../optibrain/docs/` and is read from the sibling checkout; it is **not**
republished by this site's Sphinx build. Branch `fix/ward-batch-extraction`
carries the reliability work and is **not yet merged**.

## Related

- {doc}`sync-worker` — the orchestrator
- {doc}`../architecture` § Autoregulation feasibility gates
- {doc}`../backup-restore` — rebuilding the Optibrain volumes