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
| Input/output | Request-scoped JSON API | Request-scoped JSON API |
| Called by | every sync cycle | only when signals qualify |

Both run `mypicu-optibrain:local` from the same Dockerfile. They are separated
into two instances for three reasons:

1. **Latency.** The pipeline keeps module-global configuration and serialises
   every request behind one lock. A 35-minute fit would stall indicator
   extraction and delay the validity write the UI depends on.
2. **Memory.** The fit peaks near 1.2 GiB; the indicator pass needs almost none.
   A shared instance would have to carry the higher ceiling for everything.
3. **Input isolation.** Each analysis receives an immutable snapshot in its
   request; no shared files can be read halfway through a rewrite.

## Configuration

Both read MYPICU's `.env.icca` via `env_file`, which contains the ICCA
credentials shared with `sync-worker`:

```ini
DB_HOST=...
DB_PORT=...
DB_NAME=...
DB_USER=...
DB_PASSWORD=...
```

Both then apply `DB_MAX_CONCURRENT_QUERIES` from `ICCA_QUERY_CONCURRENCY`
(default 4).

`scripts/local-up.sh` refuses to start the stack if `.env.icca` is
missing, because the failure would otherwise surface much later as an empty
result set.

## Input contract

The worker sends versioned JSON in each request: `indicator_data` contains 23
channel arrays, while `autoreg_data` contains seven autoregulation channels.
OptiBrain validates that every row belongs to the request's patient set. Results
return in the HTTP response and are persisted by the worker.

## Reliability requirements

The Optibrain side of the contract is enforced in `../optibrain`:

| Requirement | Why |
|---|---|
| Request-bound patient set | rejects cross-patient rows |
| Versioned channel schema | rejects omitted channels and incompatible payloads |
| Missing-DOB handling | a patient with no DOB skips PPC only, not the whole run |
| Per-patient error isolation | one bad patient cannot fail the batch |
| Multi-patient SQL via `IN (...)` | no per-patient round trip |
| Native `ARTm` matching | the module must not mis-pair pressures |
| Bounded autoregulation queries | time windows, not open-ended |
| Explicit `search_path=readonly,public` | reads a schema it must not modify |
| Connection closing, `to_thread` | no pool exhaustion under load |
| In-memory batch processing | avoids repeated parse and disk staging |
| `pandas<3`, `httpx` | pinned for compatibility |

A single worker is **mandatory** per instance: the pipeline uses process-global
configuration.

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
    participant W as sync-worker
    participant O as optibrain
    participant P as db

    W->>O: POST /indicateurs (versioned channel data)
    Note over O: 19 indicators, failures isolated per patient
    O-->>W: matrices in JSON response
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

### Frontend monitoring chart

The Optibrain patient page lets clinicians select up to three available
monitoring series in the monitoring chart. Alongside the clinical-target
indicators, the choices include the other harvested monitor channels, such as
heart rate, respiratory rate, SpO₂, PIC systolic/diastolic, PAM, and NIRS
(`Variable_rSO2`). These series come from the patient's cached `patient_vitals`
data; a channel is offered only when it has charted values. In the selector,
NIRS is labeled **NIRS (rSO₂)** and its percent unit represents regional
cerebral oxygen saturation.

The **Optimisation cérébrale** detail dialog shows the stored OptiBrain
autoregulation result together with its required signal pair. PRx is eligible
only when PIC and PPC are available; COx is eligible only when NIRS and PAM
are available. If both pairs and results are eligible, PRx is preferred. In
the COx dialog the signal plot is labeled **NIRS (rSO₂)** and the paired
pressure plot is labeled PAM.

The dialog plots the associated signal and pressure separately so their
different units do not share an axis. The optimal window is drawn only on the
pressure plot: PPC for PRx, or PAM for COx. The current pressure is classified
as inside, below, or above the computed window. A missing pair or incomplete
window is reported explicitly; the frontend does not manufacture fallback
limits or recompute them. In the main monitoring plot, selecting PPC (PRx) or
PAM (COx) also shows the corresponding computed window as a blue shaded band
behind that pressure curve. **Zones cibles** toggles the band with the other
target zones.

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