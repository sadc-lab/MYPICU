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

### Indicator batch — 23 CSV files

Written by `docker/worker/optibrain_export.py` into `optibrain-data`:

- one file per monitored channel (`Variable_FC`, `Variable_PAM`, `Variable_PIC`, …)
- bootstrap inputs: `Variable_age`, `premiere_frequence_cardiaque`, `noadmsip`
- derived or denormalised variants the indicators filter on

### Autoregulation batch — 7 CSV files

Written into `optibrain-ar-data`, with `_autoreg` suffixes:

`Variable_PIC_autoreg`, `Variable_PPC_autoreg`, `Variable_PAM_autoreg`,
`Variable_NIRS_autoreg`, `Variable_fc_autoreg`, `Variable_spo2_autoreg`,
`Variable_licox_autoreg`.

### Provenance manifest

Every batch carries a manifest recording, per patient, the encounter id and
whether the row is synthetic.

Without it a file left over from a previous batch could be attributed to the
wrong patient. This was the defect that made multi-patient ward extraction
unsafe before the fix; the manifest is what makes it safe now.

### Separation of duty

| | Files | Reading |
|---|---|---|
| Worker writes | CSVs + manifest | — |
| Module reads | same path | `skip_fetch=true`, so it uses the supplied files rather than re-querying ICCA |

`skip_fetch` is explicit. Without it the module would fetch from the source
itself, duplicating extraction and defeating the worker's batching.

## Reliability contract

Enforced on the `../optibrain` side:

| Requirement | Why |
|---|---|
| Provenance manifest | prevents cross-patient attribution |
| Explicit `skip_fetch` | a missing DOB skips PPC only, not the whole run |
| Per-patient error isolation | one bad patient cannot fail the batch |
| `IN (...)` batching | no per-patient round trip |
| Native `ARTm` matching | pressures must not be mis-paired |
| Bounded autoregulation SQL | time windows, not open-ended scans |
| `search_path=readonly,public` | the module must not modify the source |
| Connection closing, `to_thread` | no pool exhaustion |
| CSV memoisation | avoids O(N²) reads |
| Semicolon separator | the pandas default is wrong for these files |
| `pandas<3`, `httpx` | pinned for compatibility |

**Single worker is mandatory** per instance: the pipeline uses process-global
state and a shared results directory. Running two would corrupt it.

## Why two instances

```
optibrain                optibrain-autoreg
  ├─ 20 indicators         ├─ PRx / COx fits
  ├─ ~seconds/patient     ├─ ~35 min/patient
  ├─ 1 GiB limit          ├─ 3 GiB limit
  └─ optibrain-data       └─ optibrain-ar-data   (private)
```

The pipeline serialises requests behind one lock. A 35-minute fit in the same
instance would stall indicator extraction and delay the validity write the UI
depends on. Private input volumes also stop a long fit from reading channels the
worker is halfway through rewriting.

## Performance

| Operation | Cost |
|---|---|
| Indicator batch, 60 patients | ~seconds |
| Autoregulation, per patient | ~35 min |
| Window combinations explored | ~30, at ~70 s each |

The worker guards autoregulation with `ar_busy`, so at most one fit runs at a
time and the sync cycle is never blocked.

## A note on the results volume

`optibrain-results` is frequently **empty** between runs even though
`patient_validity` is populated. The worker reads the matrix files and the module
does not retain them; the authoritative copy is in the database. Do not treat an
empty results volume as a fault — check `patient_validity` instead.

## Related

- {doc}`services/optibrain` — container-level detail
- {doc}`services/sync-worker` — the orchestrator
- {doc}`deployment` § 2. Configure Optibrain
- {doc}`reference/tables` — where results are stored