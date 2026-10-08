---
title: Tables
---

# Table reference

Column-level reference for the `public` schema, read live from the running
database. Row counts drift with every sync cycle; the figures below were read
on **2026-10-08** and are order-of-magnitude, not exact.

```{contents}
:local:
:depth: 2
```

## Conventions

- **Identifiers.** Application tables use `patient_id text`. It is the ICCA
  encounter id **including** the `#` prefix, e.g. `#16968` (the same value as
  `patients.id`). In a URL the `#` must be percent-encoded as `%23`.
- **Timestamps** are `timestamp with time zone`, stored UTC. The source is
  naive, corrected by `SOURCE_TIMEZONE=America/Montreal` at extraction.
- **Null is meaningful.** A null `valeur` means *not measured*. It is never
  replaced with a substitute number.

## `patients`

One row per tracked patient. 60 rows.

| Column | Type | Notes |
|---|---|---|
| `id` | text | primary key, encounter id **with** the `#` prefix |
| `name` | text | |
| `age` | text | source supplies text |
| `weight` | text | formatted for display |
| `picu_id` | text | |
| `diagnosis` | text | |
| `exam` | text | admission reason |
| `pelod_score` | numeric | |
| `adherence` | numeric | |
| `priority`, `tour`, `ward` | text | |
| `brain_score` | integer | |
| `heart_score` | integer | |
| `lungs_score` | integer | |
| `kidney_score` | integer | |
| `gcs` | integer | from `ptassessment` `attributeid=53122` |
| `allergies`, `intolerances` | text | |
| `created_at`, `updated_at` | timestamptz | |

The patient's date of birth is not stored here: it lives in
`integration.patient_map.dateofbirth` (added by
`20261001120000_patient_map_dateofbirth.sql`). A missing date of birth causes
Optibrain to **skip only PPC** for that patient, not the whole run.

## `patient_vitals`

The measurement table. ~106,000 rows, 155 MB — the dominant local cost.

| Column | Type | Notes |
|---|---|---|
| `id` | bigint | |
| `patient_id` | text | |
| `variable_key` | text | channel name, e.g. `FC`, `FR`, `spo2`, `PAm`, `ARTm`, `CO2fe`, `PICm`, `PVCm`, `rSO%` |
| `charttime` | timestamptz | |
| `valeur` | numeric | **nullable** = not measured |

Resolution is deliberately reduced:

| Window | Resolution |
|---|---|
| last 24 h | median per **minute** |
| back to `PATIENT_RETENTION_DAYS` | median per **hour** |

Raw-resolution data is kept only for ICP and NIRS patients, for autoregulation.

Common `variable_key` values:

| Key | Meaning | Source |
|---|---|---|
| `FC` | heart rate | `icca_htr` `FC` |
| `FR` | respiratory rate | `icca_htr` `FR` |
| `spo2` | oxygen saturation | `icca_htr` `Pouls (SpO2)` |
| `PAm` | invasive mean arterial pressure | `icca_htr` `PAm` |
| `ARTm` | arterial mean | `icca_htr` `ARTm` |
| `CO2fe` | end-tidal CO₂ | `icca_htr` `CO2fe` |
| `PICm` / `PICd` / `PICs` | intracranial pressure mean / max / min | `icca_htr` |
| `PVCm` | central venous pressure | `icca_htr` `PVCm` |
| `rSO%` | cerebral oxygen saturation | `icca_htr` `rSO%` |
| `lactate`, `hemoglobine`, … | labs | `ptlabresult` (`valuenumber`) |
| blood gas channels | pH, PaO₂, PaCO₂ | `blood_gas` |
| pupil channels | diameter + laterality/reactivity | parsed from `ptassessment` |

Pupil text such as `2 mm RB` is parsed into a numeric diameter plus preserved
text and reactivity flags.

:::{note}
`icca_htr` carries ~30 further channels that are **not** stored — ventilator
settings and ECG intervals. Ventilator channels belong to OptiLungs, out of
scope for v1; ECG intervals (QTc, ST) are a genuine open gap.
:::

## `patient_validity`

Adherence matrices from Optibrain. ~22,700 rows: 19 indicators × 96 hourly
windows, for every patient with the required signals (35 of 60 on 2026-10-08).

| Column | Type | Notes |
|---|---|---|
| `id` | bigint | |
| `patient_id` | text | |
| `indicator_key` | text | one of 19 indicators |
| `hour_index` | integer | 0–95, hourly windows |
| `is_adherent` | boolean | `true` = the recommendation was respected (matrix value `0`) |

The worker translates `0 → true`. 19 indicators × 96 windows.

Missing adherence is stored as null and rendered `Non évalué`. It is **never**
reported as 100%.

## `patient_autoregulation`

Optibrain autoregulation output. Currently 0 rows.

| Column | Type | Notes |
|---|---|---|
| `id` | bigint | |
| `patient_id` | text | |
| `mode` | text | `PRx` or `COx` |
| `optimal_pressure` | numeric | optimal PPC or PAM, mmHg |
| `inferior_limit`, `superior_limit` | numeric | optimal range boundaries |
| `min_index` | numeric | value at the optimum |
| `pressure_variable` | text | pressure channel used |
| `signal_variable` | text | signal channel used |
| `sample_count` | integer | |
| `computed_at` | timestamptz | |
| `raw` | jsonb | **the module's curve**, rendered directly |

`raw` was added by `20261001131000_autoregulation_keep_raw.sql`, which also
dropped the intermediate duration/window columns that the service did not use.

A verified row reads `PPC OPTIMALE 62 mmHg`, `PRX MINIMUM 0.18`.

Feasibility:

| Mode | Requires |
|---|---|
| `PRx` | native PIC **and** PPC |
| `COx` | NIRS **and** PAM |

CPP is never derived. When no reliable plateau exists, **no row is written** —
an unreliable result must not become a displayed number.

## `patient_medications`

| Column | Type | Notes |
|---|---|---|
| `medication_type` | text | |
| `drugname` | text | |
| `charttime` | timestamptz | |
| `variable` | text | |
| `valeur` | text | text, not numeric — doses carry units |

## `patient_clinical_info`

| Column | Type | Notes |
|---|---|---|
| `info_type` | text | |
| `data` | jsonb | structure per `info_type` |

Carries categorical and free-text clinical context.

## `patient_objectives` — local only

| Column | Type |
|---|---|
| `patient_id` | text |
| `organ` | text |
| `type` | text |
| `content` | text |
| `sort_order`, `created_at`, `updated_at` | |

Clinician-entered. **Not reconstructible from the source.**

## `patient_custom_view` — local only

Per-clinician UI preferences: `patient_id`, `module`, `indicator_label`,
`action`, `created_at`.

## `patient_view_log` — local only

`user_id`, `patient_id`, `last_viewed_at`. Visit history.

## `user_wards`

| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid | matches `auth.users.id` |
| `ward` | text | e.g. `pedA`, `pedB` |
| `assigned_at`, `assigned_by` | timestamptz, uuid | |

What RLS reads to decide which patients a clinician may see. **A user with no
row here sees no patients** — see {doc}`../services/authentication` § Ward
assignment.

## `autoreg_study_results`

Results of uploaded study files analysed in the browser. Distinct from
`patient_autoregulation`, which holds the live-module output.

## Other schemas

| Schema | Purpose |
|---|---|
| `auth` | GoTrue users, sessions, identities — **back up** |
| `integration` | sync bookkeeping: `patient_map` (source encounter ↔ local id, date of birth), `census_state`, `sync_state` (per-patient status, `last_synced_at`, `duration_ms`, `error`) |
| `_realtime` | tenant and subscriptions |
| `realtime` | message broadcasts |
| `local_migrations` | `applied` — migration ledger and checksums |
| `vault`, `storage` | unused in v1 |

## Inspecting

```sh
sh scripts/stack.sh exec -T db psql -U postgres -d postgres -c "\d patient_vitals"
sh scripts/stack.sh exec -T db psql -U postgres -d postgres -c "
  select variable_key, count(*), min(charttime), max(charttime)
  from patient_vitals group by 1 order by 2 desc;"
```

## Related

- {doc}`api` — querying these tables
- {doc}`../backup-restore` — what is irreplaceable
- {doc}`../services/database` — roles, RLS, migrations