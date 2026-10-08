---
title: Architecture
---

# Architecture

This page describes how MYPICU is put together: the containers, the networks,
where data lives, and the exact order in which a patient reaches a screen.

```{contents}
:local:
:depth: 2
```

## Design goals

1. **No invented data.** Every number on screen traces to a measured value from
   the source system or to an Optibrain computation over such values. Absent
   measurements render as `—`.
2. **Everything is reproducible locally.** The clinical application, the
   computation module, the database and the gateway all run on one host with no
   cloud dependency.
3. **Bounded resource use.** The host has 11 GiB of RAM, so every container has
   a hard memory ceiling.
4. **Rebuildable.** The database holds a cache plus locally-computed and
   locally-entered data. Nothing in it is unrecoverable except the
{ref}`local-only set <local-only-data>`.

## Component schematic

```{mermaid}
flowchart TB
    subgraph browser["Clinician browser"]
        UI["React + TypeScript SPA<br/>src/"]
    end

    subgraph host["mypicu host &mdash; Docker network 'mypicu-local'"]
        direction TB
        ENV["envoy<br/>:8000 &rarr; published :80 and 127.0.0.1:8080<br/>routing, apikey gate, path-only access log"]

        subgraph supabase["Supabase core"]
            AUTH["auth (GoTrue)<br/>:9999"]
            REST["rest (PostgREST)<br/>:3000"]
            RT["realtime<br/>:4000"]
            PG[("db (Postgres 17)<br/>:5432<br/>public schema + RLS")]
        end

        subgraph compute["Computation"]
            SYNC["optibrain-sync (worker)<br/>ICCA extraction + orchestration"]
            OB["optibrain<br/>19-indicator validity matrices"]
            AR["optibrain-autoreg<br/>PRx / COx fits"]
        end

        subgraph static["Static"]
            WEB["web<br/>built SPA"]
            DOCS["docs<br/>Sphinx build"]
        end

        subgraph tooling["Tooling &mdash; loopback only"]
            STUDIO["studio :54323"]
            MAIL["mailpit :8025"]
            META["meta :8080"]
        end
    end

    ICCA[("ICCA source<br/>cathydb<br/>read-only")]

    UI -->|"HTTP :80"| ENV
    ENV -->|"/"| WEB
    ENV -->|"/documentation"| DOCS
    ENV -->|"/auth/v1/*"| AUTH
    ENV -->|"/rest/v1/*"| REST
    ENV -->|"/realtime/v1/websocket"| RT
    REST --> PG
    AUTH --> PG
    RT --> PG
    SYNC -->|"read"| ICCA
    SYNC --> PG
    SYNC -->|"CSV + manifest<br/>optibrain-data"| OB
    SYNC -->|"CSV + manifest<br/>optibrain-ar-data"| AR
    OB -->|"matrices<br/>optibrain-results"| SYNC
    AR -->|"raw curves<br/>optibrain-ar-results"| SYNC

    classDef src fill:#e8f0fe,stroke:#4a6fa5
    classDef store fill:#fff4e5,stroke:#c07d2b
    classDef compute fill:#eaf7ea,stroke:#4c8c4a
    classDef tool fill:#f0f0f5,stroke:#888
    class ICCA,PG store
    class OB,AR,SYNC compute
    class STUDIO,MAIL,META tool
```

## Network and trust boundaries

Everything sits on one Compose network, `mypicu-local`. There is no host network
usage and no cloud egress.

| From | To | Purpose |
|---|---|---|
| `envoy` | `web`, `auth`, `rest`, `realtime`, `docs` | The only ingress path |
| `optibrain-sync` | `cathydb` | Read-only extraction, statement timeout enforced |
| `optibrain-sync` | `optibrain`, `optibrain-autoreg` | CSV in, results out |
| `studio`, `mailpit` | — | Published on `127.0.0.1` only; not reachable off-host |

**Exposed to the network:** port 80 (Envoy). Everything else is loopback or
internal. See {doc}`deployment` § TLS before clinical use.

## Where data lives

```{mermaid}
flowchart LR
    subgraph upstream["Upstream &mdash; not ours"]
        S[("cathydb<br/>~4.1M rows / 60 patients / 3 days")]
    end

    subgraph cache["Local cache &mdash; rebuilt from source"]
        V[("patient_vitals<br/>~106k rows")]
        M[("patient_medications")]
        C[("patient_clinical_info")]
        P[("patients")]
    end

    subgraph derived["Derived &mdash; computed by Optibrain"]
        VAL[("patient_validity")]
        AUTO[("patient_autoregulation")]
    end

    subgraph entered["Local only &mdash; irreplaceable"]
        OBJ[("patient_objectives")]
        VIEW[("patient_custom_view")]
        LOG[("patient_view_log")]
        USR[("auth.users<br/>user_wards")]
    end

    S -->|"mirror, downsampled"| V
    S --> M
    S --> C
    S --> P
    V --> OB2["optibrain"]
    OB2 --> VAL
    OB2 --> AUTO
    ENTER -.->|clinician| OBJ
    ENTER -.->|clinician| VIEW
    ENTER -.->|browser| LOG
    ENTER -.->|admin| USR

    classDef s fill:#e8f0fe,stroke:#4a6fa5
    classDef d fill:#eaf7ea,stroke:#4c8c4a
    classDef e fill:#fff0f0,stroke:#b04a4a
    class S s
    class VAL,AUTO d
    class OBJ,VIEW,LOG,USR e
```

(local-only-data)=
**The local-only set is the only data that cannot be re-fetched from the
source.** A backup that omits it loses clinician-entered objectives and user
accounts permanently. See {doc}`backup-restore`.

### Why the cache is smaller than the source

`patient_vitals` holds roughly 106k rows against 3.69M upstream monitor rows for
the same patients over three days (measured 2026-09-30). The worker reduces
monitor channels to a **median per minute for 24 hours** and a **median per hour
back to three days**. Raw-resolution data is retained only for ICP and
cerebral-oximetry patients, where autoregulation analysis needs sample-level
fidelity.

## Sequence: a full patient sync

This is the path taken every cycle. It is the most important flow in the system.

```{mermaid}
sequenceDiagram
    autonumber
    participant CRON as Scheduler<br/>(optibrain-sync)
    participant Q as queries.py
    participant ICCA as cathydb
    participant C as cache.py
    participant PG as db
    participant EXP as optibrain_export
    participant OB as optibrain
    participant AR as optibrain-autoreg

    CRON->>Q: census census()
    Q->>ICCA: ptcensus + d_encounter + weight
    Note over Q,ICCA: Bounded, returns 0 rows if the<br/>known ptcensus outage is active<br/>— the cache is retained, not emptied
    ICCA-->>Q: 59 encounters

    loop each encounter
        Q->>ICCA: vitals(24h median/minute)<br/>vitals(3d median/hour)<br/>labs, gases, meds, notes...
        ICCA-->>Q: rows
        Q->>C: merge with existing cache
    end

    Q->>PG: BEGIN
    Q->>PG: TRUNCATE + rewrite patients,<br/>patient_vitals, patient_medications,<br/>patient_clinical_info
    Q->>PG: COMMIT
    Note over Q,PG: Single transaction: a failure leaves<br/>the previous cache fully intact

    CRON->>EXP: export_indicators()
    EXP->>OB: POST /run (23 CSVs + manifest)
    OB->>OB: compute 19 validity matrices
    OB-->>EXP: matrices on optibrain-results
    EXP->>PG: rewrite patient_validity (0/1)

    opt not already computing, and eligible signals
        CRON->>EXPORT: export_autoreg()
        EXP->>AR: POST /run (7 CSVs + manifest)
        Note over AR: ~35 min, 30 window combinations
        AR-->>EXPORT: raw curves on optibrain-ar-results
        EXP->>PG: upsert patient_autoregulation
    end
```

## Timing diagram: sync cycle

A UML timing view of one cycle. Signals are shown as arrows between lifelines;
durations are labelled. A thin line is an idle period.

```
        │<──────────── 24 h ────────────>│
        │                                │
census  ├─────────────┐                   │
        │             │                   │
query   │             └───┐               │
        │                 │               │
write   │                 └───┐           │
        │                     │           │
indic.  │                     └───┐       │
        │                         │       │
valid.  │                         └───┐   │
        │                             │   │
  DB    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│   │
        │                             │   │
autoreg ├─────────────────────────────┴───┴──▶
        │            runs detached; does not block
        │
        └─▶ next cycle
```

| Phase | Blocking? | Failure behaviour |
|---|---|---|
| census | yes | Zero rows ⇒ previous cache retained |
| extraction | yes | Exception aborts the cycle, cache untouched |
| cache write | yes | Single transaction; rolls back cleanly |
| indicators | yes | Per-patient isolation; failures logged, cycle continues |
| validity write | yes | Replaces atomically |
| autoregulation | **no** | Detached; guarded by `ar_busy`; retried next cycle |

## Timing diagram: request path and the apikey gate

Envoy's Lua filter rejects any `/rest/`, `/auth/`, or `/realtime/` request whose
`apikey` is not the configured anon or service-role key. This happens before the
request ever reaches PostgREST.

```
client            envoy:80              web / rest / auth
  │                   │                        │
  │── GET /documentation/architecture.html ───▶│ docs (200)
  │                   │                        │
  │── GET /rest/v1/patient_vitals ───────────▶│
  │                   │                        │
  │              ┌─ Lua filter ─┐              │
  │              │ apikey?      │              │
  │              │ no  ──▶ 401  │  (never proxied)
  │              │ yes ───────────────▶ rest ──▶ Postgres
  │                   │                        │
  │◀──────────────────┴────────────────────────┘
```

```{mermaid}
sequenceDiagram
    autonumber
    participant C as Browser
    participant E as Envoy (Lua)
    participant R as rest (PostgREST)
    participant P as db

    C->>E: GET /rest/v1/patient_vitals?select=*
    E->>E: apikey matches anon or service-role?
    alt missing or invalid
        E-->>C: 401 Invalid API key
    else valid, plus a user JWT
        E->>E: inject authorization: Bearer JWT
        E->>R: forward
        R->>P: query with RLS context
        P-->>R: rows
        R-->>C: 200 JSON
    end
```

Row-level security is the second gate: even with a valid service key, the
`patient` context in the database restricts each clinician to their wards.

## Timing diagram: patient request rendering

The browser never computes clinical values. It requests, then renders.

```
browser            React component        patientFileData.service       rest
  │                      │                        │                     │
  │─ mount ──────────────▶│                        │                     │
  │                      │─ fetch latest vitals ─▶│── GET /rest/v1/… ──▶│
  │                      │                        │◀── JSON ────────────│
  │                      │─ map null ─▶ "—"       │                     │
  │◀─ render ────────────│                        │                     │
  │                      │                        │                     │
  │                      │   (no fallback values are ever substituted)
```

```{mermaid}
sequenceDiagram
    autonumber
    participant U as UI<br/>VitalSignsPanel
    participant S as patientFileData.service
    participant A as patientAutoregulation.service
    participant R as rest

    par latest vitals
        U->>S: getPatientTimeSeries(id)
        S->>R: POST /patient_vitals (latest per channel)
        R-->>S: rows, nullable
        S-->>U: channels, null where unmeasured
        U->>U: render "—" for null
    and validity / optistate
        U->>S: getValidity(id)
        S->>R: patient_validity
        R-->>S: 0/1 per indicator
        S-->>U: percent adherence, no 100% default
    and autoregulation
        U->>A: getAutoregulation(id)
        A->>R: patient_autoregulation
        R-->>A: PRx / COx + raw table
        A-->>U: curve
    end
```

## Autoregulation feasibility gates

Optibrain is asked to compute only what the available signals support. These are
hard gates, not fallbacks.

| Metric | Requires | Rationale |
|---|---|---|
| PRx | native **PIC** + **PPC** | PRx is defined against partial pressure oxygen reactivity |
| COx | **NIRS** + **PAM** | COx relates cerebral oxygenation to perfusion pressure |
| CPP | never derived | CPP is not inferred as MAP − ICP anywhere in this codebase |

A patient missing one input is skipped for that metric only, and the row is
absent rather than fabricated.

## Memory model

The host has 11 GiB RAM, 4 CPUs and no swap. Every container carries a
`mem_limit`.

| Container | Limit | Note |
|---|---|---|
| `db` | 2 GiB | `shared_buffers` 1 GB, `effective_cache_size` 8 GB |
| `optibrain-autoreg` | 3 GiB | peak measured 1.2 GiB on a 2 h window |
| `optibrain` | 1 GiB | indicator matrices |
| `optibrain-sync` | 1 GiB | worker |
| `realtime` | 640 MiB | |
| `studio`, `meta` | 384 MiB each | |
| `auth`, `rest` | 192 MiB each | |
| `envoy`, `web`, `docs`, `mailpit` | 96 MiB each | |

Measured stack idle ≈ 1.1–1.7 GiB; full 60-patient sync peaks ≈ 1.2 GiB across all
containers. Because there is no swap, exceeding a limit results in an OOM kill
of that container rather than system-wide slowdown — see
{doc}`services/observability` § A container is restarting.

## Related pages

- {doc}`deployment` — install and upgrade the stack
- {doc}`backup-restore` — crash recovery
- {doc}`services/sync-worker` — the extraction worker in detail
- {doc}`services/optibrain` — the computation module
- {doc}`operations` — day-to-day running