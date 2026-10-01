---
title: API
---

# API reference

The application does not define a bespoke API. It uses Supabase conventions:
PostgREST over `/rest/v1`, GoTrue over `/auth/v1`, a websocket over
`/realtime/v1/websocket`.

```{contents}
:local:
:depth: 2
```

## Access

All endpoints go through Envoy. Two credentials are involved:

| Credential | Sent as | Purpose |
|---|---|---|
| `ANON_KEY` | `apikey` header, or `?apikey=` | identifies the caller as anonymous |
| user JWT | `authorization: Bearer <token>` | identifies the **clinician** |

```sh
source .env.stack.local

curl -sS "http://localhost:8080/rest/v1/patients?select=encounter_id&limit=1" \
  -H "apikey: $ANON_KEY"
```

Envoy rejects a request whose `apikey` is neither `ANON_KEY` nor
`SERVICE_ROLE_KEY` with `401 Invalid API key`. A valid anon key alone is not
enough to see patient data — **row-level security** applies, scoped to the
clinician's wards.

## PostgREST conventions

```sh
BASE=http://localhost:8080/rest/v1
```

| Operation | Request |
|---|---|
| Select | `GET $BASE/<table>?select=…` |
| Filter | `GET $BASE/patients?encounter_id=eq.16507` |
| Range | `GET $BASE/patient_vitals?select=…&limit=100&offset=0` |
| Insert | `POST $BASE/<table>` with a JSON body |
| Upsert | `POST $BASE/<table>?on_conflict=<cols>` |
| Delete | `DELETE $BASE/<table>?<filter>` |

Filters: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in.(…)`, `is.null`, `like`.

:::{warning}
`PGRST_DB_MAX_ROWS` is `100000`. An unfiltered `GET $BASE/patient_vitals`
returns all ~101k rows and ~155 MB into a container with a 192 MiB limit. Always
filter by `encounter_id` and a time range.
:::

## Tables the frontend queries

| Table | Used for |
|---|---|
| `patients` | census, demographics, weight |
| `patient_vitals` | all monitored channels |
| `patient_validity` | adherence matrices |
| `patient_medications` | active orders |
| `patient_clinical_info` | categorical and free text |
| `patient_autoregulation` | PRx / COx and raw curves |
| `patient_objectives` | clinician-entered objectives |
| `patient_custom_view` | per-clinician UI preferences |
| `patient_view_log` | visit history |
| `autoreg_study_results` | uploaded study analyses |

## Worked examples

Latest value per channel for one patient:

```sh
curl -sS "$BASE/patient_vitals?encounter_id=eq.16507&select=parameter,value,recorded_at&order=recorded_at.desc&limit=500" \
  -H "apikey: $ANON_KEY"
```

The client de-duplicates to the newest row per parameter. **A missing channel is
absent from the response — never substituted.**

Adherence for one patient:

```sh
curl -sS "$BASE/patient_validity?encounter_id=eq.16507&select=indicator,adherence,window_start&order=window_start" \
  -H "apikey: $ANON_KEY"
```

Autoregulation:

```sh
curl -sS "$BASE/patient_autoregulation?encounter_id=eq.16507&select=metric,prx_min,cprx_min,cox_min,raw" \
  -H "apikey: $ANON_KEY"
```

`raw` carries the module's curve. The chart renders it directly rather than
reconstructing one in the browser.

## GoTrue

| Endpoint | Purpose |
|---|---|
| `POST /auth/v1/signup` | create an account |
| `POST /auth/v1/token?grant_type=password` | sign in |
| `POST /auth/v1/token?grant_type=refresh_token` | refresh |
| `GET  /auth/v1/verify` | confirm email / recover |
| `POST /auth/v1/logout` | end the session |

```sh
curl -sS -X POST "http://localhost:8080/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" -H 'content-type: application/json' \
  -d '{"email":"clinician@example.org","password":"…"}'
```

Signup requires email confirmation. Confirmation links land in **Mailpit**
(`http://127.0.0.1:8025`) because SMTP points there.

## Websocket

```sh
wss://<host>/realtime/v1/websocket?apikey=$ANON_KEY&vsn=1.0.0
```

Only `/realtime/v1/websocket` is routed; any other `/realtime/v1/` path returns
404. The route carries no timeout, so sockets are long-lived.

## Internal worker API

Port 8001 on `optibrain-sync`, **not** published. Requires
`Authorization: Bearer $SYNC_TOKEN`.

| Endpoint | Purpose |
|---|---|
| `GET /health` | liveness |
| `POST /sync` | run one full cycle |
| `POST /sync/{encounterid}` | sync one patient |

```sh
sh scripts/stack.sh exec -T optibrain-sync python -m sync          # full cycle
sh scripts/stack.sh exec -T optibrain-sync python -m sync 16507    # one patient
```

## Optibrain API

Port 8000, internal. Both instances expose OpenAPI at `/docs`:

| Instance | Endpoint |
|---|---|
| `optibrain` | `/docs` |
| `optibrain-autoreg` | `/docs` |

```sh
sh scripts/stack.sh exec -T optibrain python -c \
  "import urllib.request; print(urllib.request.urlopen('http://localhost:8000/openapi.json').read()[:400])"
```

## Logging

Envoy logs method, **path without query string**, status and duration. Query
strings are stripped because they carry `apikey` values and patient identifiers.

## Related

- {doc}`tables` — column reference
- {doc}`../services/gateway` — routing and the key gate
- {doc}`../services/database` — RLS