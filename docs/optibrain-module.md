---
title: Optibrain module
---

# The Optibrain module

Optibrain quantifies adherence to international recommendations for paediatric
traumatic brain injury treatment, and computes optimal perfusion pressure from
cerebral autoregulation signals.

```{contents}
:local:
:depth: 2
```

This page describes the module from MYPICU's perspective. For its own internal
documentation see `../optibrain/docs/` in the source repository.

## Provenance

OptiBrain is maintained separately and built from `../optibrain` — it is **not**
vendored into this repository. The two are deployed together through
`docker/compose.local.yml`, which builds the same image twice.

| | |
|---|---|
| Repository | `/home/applications/optibrain` |
| Branch in use | `fix/ward-batch-extraction` (not yet merged) |
| Image | `mypicu-optibrain:local` |
| Instances | `optibrain`, `optibrain-autoreg` |

## What it computes

### Adherence indicators

`indicateurs.json` defines **20 indicators**, each producing a binary matrix over
96 hourly windows. The convention is inverted relative to intuition:

> **0 = the recommendation was respected. 1 = deviation.**

The worker translates this into `patient_validity` as `is_adherent = (value = 0)`.

| Indicator | Domain |
|---|---|
| `TemperatureData` | temperature |
| `GlycemieData` | glucose |
| `HemoglobineData` | haemoglobin |
| `PlaquettesData` | platelets |
| `INRData` | coagulation |
| `NutritionData` | feeding |
| `PAMData` | arterial pressure |
| `PVCData` | central venous pressure |
| `EtCO2Data` | end-tidal CO₂ |
| `PaCO2Data` | arterial CO₂ |
| `PicMonitorageData`, `PicHticData` | intracranial pressure |
| `PPCData` | cerebral perfusion pressure target |
| `PupilleDroiteData`, `PupilleGaucheData` | pupils |
| `PositionTeteData` | head position |
| `OpioidesData`, `HypnotiqueData`, `PropofolData`, `AntiEpileptiqueData` | sedation |

#### 20 defined, 19 produced

`PPCData` produces **no rows** in the current data. `Variable_PPC.csv` arrives at
the module empty, and the module logs:

```
Pas de données PPC pour le patient 16875
```

This is a **source data gap, not a bug**. The ICCA source does not carry
Partial Pressure of brain Oxygen values for these patients. Two consequences:

1. The store holds 19 indicators, not 20.
2. **PRx autoregulation cannot be computed** — see below.

This is the correct behaviour. The alternative — emitting an empty or assumed PPC
— would fabricate a value that sets a treatment target.

### Autoregulation

| Metric | Requires | Status |
|---|---|---|
| PRx | native **PIC** + **PPC** | **unavailable** — no PPC in the source |
| COx | **NIRS** + **PAM** | possible where NIRS is charted |
| CPP | — | never derived anywhere |

The same missing-PPC gap that removes `PPCData` also rules out PRx for every
currently tracked patient. COx remains available for patients with NIRS plus PAM.

## Data contract

### Indicator batch — request-scoped JSON

`docker/worker/optibrain_export.py` adapts harvested rows into 23 channel
arrays and sends them in the `/indicateurs` request. Empty channels are
included explicitly. The request includes the patient list and schema version;
OptiBrain rejects rows for other encounters.

Autoregulation sends seven request-scoped channel arrays:

`Variable_PIC_autoreg`, `Variable_PPC_autoreg`, `Variable_PAM_autoreg`,
`Variable_NIRS_autoreg`, `Variable_fc_autoreg`, `Variable_spo2_autoreg`,
`Variable_licox_autoreg`.

### Request provenance

The patient set and raw rows are carried together in each API request.
OptiBrain rejects rows for encounters outside that request, so there is no
shared-directory manifest that can become stale or be overwritten mid-batch.

### Separation of duty

| Component | Responsibility |
|---|---|
| Worker | batched ICCA extraction, source normalization, and request serialization |
| OptiBrain | clinical indicator and autoregulation calculations |
| Worker | persists returned matrices and autoregulation results in the MYPICU database |

The patient set and raw rows are carried together in each API request. This
avoids duplicate extraction and the shared-volume race.

## Reliability contract

Enforced on the `../optibrain` side:

| Requirement | Why |
|---|---|
| Request-bound patient set | rejects cross-patient rows |
| Versioned JSON channel schema | makes omitted channels and incompatible payloads explicit |
| Missing DOB handling | a missing DOB skips PPC only, not the whole run |
| Per-patient error isolation | one bad patient cannot fail the batch |
| `IN (...)` batching | no per-patient round trip |
| Native `ARTm` matching | pressures must not be mis-paired |
| Bounded autoregulation SQL | time windows, not open-ended scans |
| `search_path=readonly,public` | the module must not modify the source |
| Connection closing, `to_thread` | no pool exhaustion |
| In-memory batch processing | avoids repeated parse and disk staging |
| `pandas<3`, `httpx` | pinned for compatibility |

**Single worker is mandatory** per instance: the pipeline uses process-global
state. Running multiple workers in one container could corrupt its configuration.

## Why two instances

```
optibrain                optibrain-autoreg
  ├─ 20 indicators         ├─ PRx / COx fits
  ├─ ~seconds/patient     ├─ ~35 min/patient
  ├─ 1 GiB limit          ├─ 3 GiB limit
  └─ JSON request          └─ JSON request
```

The pipeline serialises requests behind one lock. A 35-minute fit in the same
instance would stall indicator extraction and delay the validity write the UI
depends on. Request-scoped inputs provide a stable batch snapshot without
shared input volumes.

## Performance

| Operation | Cost |
|---|---|
| Indicator batch, 60 patients | ~seconds |
| Autoregulation, per patient | ~35 min |
| Window combinations explored | ~30, at ~70 s each |

The worker guards autoregulation with `ar_busy`, so at most one fit runs at a
time and the sync cycle is never blocked.

## Results

OptiBrain returns matrices and autoregulation tables directly in its API
responses. The worker persists them to `patient_validity` and
`patient_autoregulation`; the MYPICU deployment does not mount results volumes.

On the patient page, available monitor channels—including NIRS
(`Variable_rSO2`) and PAM—can be selected in the monitoring chart alongside
the clinical-target indicators. When present in `patient_vitals`, the chart
offers channels such as heart rate, respiratory rate, SpO₂, and systolic and
diastolic PIC as well. The **Optimisation cérébrale** detail dialog pairs the
stored PRx result with PIC/PPC or the COx result with NIRS/PAM. It selects a
result only when both of its required channels are present and its optimum and
limits are complete. If both pairs have usable results, PRx is preferred.

The dialog plots the signal and pressure on separate scales. Its shaded
autoregulation window and current inside/below/above status apply only to the
pressure channel: PPC for PRx, or PAM for COx. Missing channels and incomplete
windows are identified without inventing limits. These windows are not drawn
on the general multi-indicator chart, which can combine measurements with
different units.

## Related

- {doc}`services/optibrain` — container-level detail
- {doc}`services/sync-worker` — the orchestrator
- {doc}`deployment` § 2. Configure the ICCA source
- {doc}`reference/tables` — where results are stored