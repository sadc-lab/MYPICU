# Local MYPICU / Supabase / Optibrain

## Start

Requirements: Docker Engine, Compose v2+, Python 3 on the host, and the sibling
`../optibrain` checkout on `feat/mypicu-integration`. MYPICU's deployment branch
is `local-docker-stack`, created from `MVP1`.

Create `../optibrain/.env` (not committed) with:

```dotenv
DB_HOST=spxp-app05.sainte-justine.intranet
DB_PORT=5432
DB_NAME=cathydb
DB_USER=mypicu
DB_PASSWORD=replace-with-the-working-password
```

```sh
sh scripts/local-up.sh
```

The script generates `.env.stack.local` with mode 0600, builds the images,
initializes the database, creates local users, and starts synchronization.
It preserves existing secrets. Both credential files are git-ignored. Optibrain's
`.dockerignore` excludes credentials and extracted data from its build context.

| Service | Local URL |
| --- | --- |
| App and Supabase API (Envoy) | http://localhost:8080 |
| Supabase Studio | http://localhost:54323 |
| Mailpit inbox | http://localhost:8025 |

Use **localhost:8080** for the app. All published ports bind to `127.0.0.1`.
PostgreSQL, Optibrain, and the sync API have no host port.

The browser client resolves the Supabase API from **the origin that served the
page** (`window.location.origin`), not from a compiled-in address, because the
stack serves the SPA and the API from one origin. Any address that reaches the
gateway therefore works, including a VS Code forwarded port or a hostname:

* `http://localhost:8080` on the stack host
* a forwarded port such as `http://localhost:50429` that maps to `localhost:8080`
* `http://<hostname>/` when a reverse proxy in front of the host maps `/` to it

Hardcoding one address is what makes a forwarded port fail: the page loads, but
every API call then goes to that address on the *browser's* machine, where
nothing listens, and the login request stays pending forever. Set
`SUPABASE_API_URL` at build time only if the API is deliberately on another host.
Password-recovery emails still link to `PUBLIC_URL` (`localhost:8080`) because
that is GoTrue's configured site URL.

Local accounts:

* `manager@local.test`: pedA and pedB
* `worker@local.test`: pedA

Both initially use `DEV_USER_PASSWORD` in `.env.stack.local`. They are created
only if absent; restarting does not reset their passwords. New signups confirm
through Mailpit and require a ward assignment in Studio before seeing patients:

```sql
insert into public.user_wards(user_id, ward) values ('<auth user UUID>', 'pedA');
```

## Topology

```text
Browser -> Envoy :8080 -> web (Node serve, static Vite build)
                      -> auth (GoTrue) -> Mailpit
                      -> rest (PostgREST) -> local Supabase PostgreSQL
                      -> realtime -> local Supabase PostgreSQL
Studio -> postgres-meta -> local Supabase PostgreSQL

optibrain-sync -> ICCA readonly, one batched pass per source table
              -> optibrain (adherence) -> local Supabase PostgreSQL
              -> optibrain-autoreg (autoregulation, background)
```

Supabase component tags are pinned to the official self-hosted set inspected on
2026-09-30: Postgres 17.6.1.136, GoTrue 2.196.0, PostgREST 14.17, Realtime 2.134.10,
Studio 2026.09.07-sha-7996410, postgres-meta 0.99.0, Envoy 1.39.1.
The minimal Envoy configuration follows the upstream Auth/REST/WebSocket route
conventions and accepts locally generated signed JWT API keys. The application
session JWT is validated by GoTrue/PostgREST/Realtime; SQL RLS governs patient access.
Storage, Edge Functions, analytics, and pooling are not needed by this frontend.

There is **no Kong or nginx dependency in this Compose stack**. The old frontend-only
Compose configurations are separate. Studio and Mailpit are local administration
interfaces, not application routes.

## Frontend configuration and permitted data-loading fixes

The repository's original Supabase client contains cloud constants. The Docker
build patches its disposable copy to the local URL and anon key and fails if the
expected declarations change. Only the public anon key enters the bundle.
`xlsx@0.18.5` is installed separately in the build image because the original
package manifest omits it; `npm ci` still uses the existing lockfile for the app.

With the owner's explicit exception to the initial frontend freeze, three data
services were corrected: no demo fallback on empty/error results, no three-patient
allow-list for detailed charts, and no indefinitely cached data shared across
sessions. Browser cache entries expire after 60 seconds on the next load. Partial
failed data reads are not cached. Layouts, components, and clinical algorithms
were not changed. An already open chart does not poll; reload/navigate to fetch a
new snapshot after a worker refresh.

## Database initialization

`db-migrate` runs after GoTrue initializes `auth.users`:

1. `docker/db/00_baseline.sql`: missing patients and autoreg study tables.
2. Existing `supabase/migrations/*.sql`, in order, unchanged.
3. `docker/db/90_local.sql`: remove the 14 demo rows, enable patient Realtime,
   add cache indexes and a restricted `optibrain_sync` database role.
4. `91_retention_cascades.sql`: repair missing patient-delete cascades in the
   existing objectives, custom-view, and view-log migrations.
5. Create the two local users and ward assignments through Auth and SQL.

Migration names and checksums are recorded in `local_migrations.applied` and
applied transactionally under an advisory lock. Changing an applied file fails
explicitly. The demo deletion runs **only on initialization**, before real census
rows can reuse those encounter IDs. Patient clinical tables have ward-scoped RLS;
autoreg study results are restricted to their owner. Internal sync metadata is in
the unexposed `integration` schema.

## Census and cache behavior

`docker/worker/census.sql` adapts my-screening's
`Backend/core/patient_window.py` and weight/bed queries:

* One segment per `readonly.ptcensus.encounterid`: open first, completed stays of
  at least one hour next, then latest admission time.
* Open stays and discharges within three days are retained. Previously tracked
  encounters are also queried to recover their discharge times after an outage.
* There is no clinical-unit filter, matching my-screening. All patients initially
  map to **pedA**. Source `clinicalunitid` is retained in `integration.patient_map`.
* `#<encounterid>` is the app ID; the integer is ICCA's `noadmsip` / `encounterid`
  depending on the table. The census also reads the latest Glasgow score
  (`ptassessment` attribute 53122, `valuenumber`) into `patients.gcs`.
* A NULL source value never overwrites a good cached value: an admission with no
  charted weight keeps its recorded weight instead of degrading to a dash.
* Name/age come from `d_encounter`, weight from assessment 95805, and bed from
  `ptbedstay`. Missing weight/bed does not exclude a patient. Clinical scores are
  not invented; diagnosis is an empty string and unprovided scores are NULL.
* Subsequent upserts refresh name, age, weight, and bed. They preserve diagnosis,
  scores, objectives, allergies, and other clinician-owned fields.
* Only **open** encounters are harvested. Discharged patients retain their
  cached data for three days, then their patient row and dependent records are
  deleted. Newly discovered already-discharged encounters have demographics only.
* If the source census query fails, **no purge or inferred discharge occurs**.
  Missing records after a successful query stop syncing and receive a three-day
  grace period from last sighting. Stale open stays in ICCA remain open, as in
  my-screening; this stack cannot infer a discharge not recorded there.

Each cycle is single-flight, protected by both a worker lock and a PostgreSQL
advisory lock. It refreshes raw data for one patient, computes indicators, checks
response patient IDs, then replaces these tables in one local transaction:

* `patient_vitals`
* `patient_medications`
* `patient_validity` (all returned hours; 0 means adherent)
* `patient_clinical_info`

When the source lacks a first heart-rate time or birth date, the worker caches
the available raw data with status `awaiting_inputs` and an explanatory reason
in `error`. It does not call the indicator algorithm or fabricate validity values.
`ready` means raw data and computed indicators are available. On automatic startup,
snapshots newer than `SYNC_INTERVAL_SECONDS` are reused so a restarted worker
resumes unfinished encounters. An explicit on-demand sync forces a refresh.

The cache preserves full raw series; it does not downsample or alter indicator
thresholds. Non-numeric observations are preserved as JSON clinical information.
The adapter supplies both existing EtCO2 spellings expected by the UI. Source
timestamps without offsets are interpreted as `America/Montreal`; timestamps
with offsets retain them. Live schema checks confirmed that `icca_htr.horodate`
has a timezone, while assessment/census timestamps do not. The source server uses
`America/Toronto` (the same offset/DST rules as Montreal for these records).

Failed module calls or writes preserve the preceding complete snapshot. Failures
and last-success timestamps are recorded; a healthy container alone does **not**
mean the source is reachable or the cached data is fresh.

### Batched extraction

The sync worker queries ICCA directly. `docker/worker/queries.py` holds one
time-bounded pass per source table and every statement takes the whole encounter
id list, so a ward is harvested once per cycle instead of once per patient.

| Pass | Source | Contents |
| --- | --- | --- |
| `monitor` | `icca_htr` | All monitor channels in one EAV scan: heart rate, respiratory rate, SpO2, EtCO2, arterial-line and cuff MAP, ICP mean/diastolic/systolic, CVP, cerebral oximetry. Median per minute for the last 24h, median per hour back to the retention window. |
| `blood_gas` | `blood_gas` | PaO2, pH, HCO3, SaO2, PaCO2, SvO2, lactate from one pass |
| `labs` | `ptlabresult` | Haemoglobin, platelets, glucose, INR (from `valuenumber`, not `terseform`) |
| `assessment` | `ptassessment` | Temperature, Glasgow, pupils |
| `medications` | `ptmedication` | Opioids, hypnotics, antiepileptics, inotropes/vasopressors with doses, via the order-to-administration join on `descriptorid` |
| `notes` | `ptintervention` | Latest clinical note |

Two source behaviours dominate the cost and both are load-bearing:

* `icca_htr` has **no usable index** on this account. An unbounded scan of heart
  rate alone took 14.6s and 2.3M rows; the bounded 3-day pass over every channel
  takes about 19s. Never add a statement without a time window.
* The medication self-join fans out by two orders of magnitude, because one
  descriptor carries many order rows and one row per administration. Order rows
  are collapsed to a distinct set *before* the join.

Pupils arrive as one free-text field (`'2 mm RB'`). The diameter is parsed into
`patient_vitals` as a number and the reactivity suffix is kept in
`patient_clinical_info`; the original string is preserved. Rows that cannot be
parsed (`'impossible'`, `'Oeil couche de soleil'`) are stored as text only and
produce no numeric reading.

Measured effect: a 44-patient ward syncs in about 21s, against roughly 250s for
the previous per-patient design.

### Absent data is reported, never filled in

The patient pages never substitute a constant for a measurement. A parameter with
no cached reading renders as `—` with a "non mesuré" note, the out-of-window
count ignores it, and an indicator with no adherence rows is shown as unknown
rather than as 100% compliant.

This replaced several behaviours that produced plausible but invented clinical
pictures: a fixed five-vital panel shown for every patient, the same constants
injected into the OptiBrain alert matrix as critical alerts, a demo indicator
set whenever a patient had no cached file data, `"Contrôlé"` at 100% when no
intracranial data existed, `GCS` rendering as `↓0` for a NULL score, and a static
roster of invented patients whenever the census was empty.

`src/utils/patientData.ts`, which held that static roster, has been deleted.

### What the module computes

| Table | Produced by | Cadence |
| --- | --- | --- |
| `patient_validity` | `/indicateurs`, 19 adherence indicators | every cycle, ~0.8s per patient |
| `patient_autoregulation` | `/autoregulation_ppc_optimale`, `/autoregulation_nirs` | background pass, only when the signals advanced |

Adherence is cheap enough to redo each cycle. Autoregulation fits thousands of
curves per patient and takes roughly half an hour for one, so it runs in a
background task against its own module instance with private volumes. The
instance matters: the pipeline holds a single request lock and global
configuration, so a long fit on the shared instance would stall the indicator
extraction every cycle depends on. A separate input volume also stops a running
analysis from reading channels the worker is halfway through rewriting.

A patient is analysed only when the required channels are actually present. PRx
needs the intracranial channel and the monitor's own cerebral perfusion
pressure; that pressure is not derived as arterial minus intracranial, because
the hospital records it natively and a substituted value would differ from the
recorded one. COx needs arterial pressure and cerebral oximetry. A result with
no reliable plateau is not stored, so the page shows "not assessed" rather than
a figure the module could not determine.

Both tables carry the module's figures verbatim. The patient pages no longer
recompute the correlation in the browser: two implementations of the same index
do not agree numerically, which meant the value on screen could differ from the
one in the clinical record. The AutoregStudy page keeps its browser-side engine,
which runs on a file a clinician uploaded rather than on a live inpatient.

### Autoregulation boundary

This v1 sync caches the Iquatrace raw data and indicators. The existing frontend's
autoregulation display is separately hardcoded to static study inputs (notably
8749); PRx/COx module responses are not wired into live-patient charts or synced
by this worker. Enabling live autoregulation requires a separate data-contract
change. The module's existing `LIMIT 1440` **without ORDER BY is not guaranteed
to select the latest 24 hours**; it was left unchanged at the owner's request.

## Operations

All commands below use the wrapper, which selects the correct Compose file and
environment without printing secrets:

```sh
sh scripts/stack.sh ps
sh scripts/stack.sh logs --tail=100 optibrain-sync
sh scripts/stack.sh exec optibrain-sync python preflight.py
sh scripts/stack.sh exec optibrain-sync python -m sync          # census + all current patients
sh scripts/stack.sh exec optibrain-sync python -m sync '#12345' # census + this current encounter
sh scripts/stack.sh exec optibrain-sync python -c "import httpx; print(httpx.get('http://localhost:8001/health').json())"
sh scripts/stack.sh down                                     # preserves local DB volumes
```

On-demand calls are `POST /sync` or `/sync/<integer encounterid>`, with
`Authorization: Bearer <SYNC_TOKEN>`, on the internal worker port 8001. A busy
worker returns 409. The CLI exits nonzero for source failure or failed patients.
No browser receives the sync token or the service-role key.

In `.env.stack.local`, optionally configure:

| Setting | Default | Meaning |
| --- | --- | --- |
| `SYNC_INTERVAL_SECONDS` | 900 | Delay between completed cycles (minimum 30 seconds) |
| `PATIENT_RETENTION_DAYS` | 3 | Discharge retention |
| `ICCA_QUERY_CONCURRENCY` | 4 | Maximum simultaneous source passes |

The host needs intranet DNS and outbound TCP 5432. Source connections explicitly
use the `readonly` schema and read-only transactions; they never create/modify
tables in cathydb. `preflight.py` reports permissions and connection limit without
printing patient details.

After editing `../optibrain/.env`:

```sh
sh scripts/stack.sh up -d --force-recreate optibrain-sync
sh scripts/stack.sh exec optibrain-sync python preflight.py
sh scripts/stack.sh exec optibrain-sync python -m sync
```

Inspect freshness in Studio's SQL editor:

```sql
select * from integration.census_state;
select status, count(*) from integration.sync_state group by status;
select patient_id, last_synced_at, duration_ms, row_count, error
from integration.sync_state order by last_synced_at nulls first;
```

To intentionally delete **all local app data and users**, run
`sh scripts/stack.sh down -v`, then `sh scripts/local-up.sh`. This does not touch ICCA.
Keep `.env.stack.local` with the volume; generating new passwords while keeping
the old database volume is not a credential-rotation procedure.

## Verification and current status

```sh
sh scripts/stack.sh run --rm --no-deps db-migrate python -m unittest test_cache test_sync
sh scripts/stack.sh run --rm --no-deps db-migrate python verify.py
```

The integration check uses temporary fixture patients and cleans them up. It
tests login, API-key rejection, ward RLS, worker-role privileges, atomic cache
replacement/rollback, idempotence, retention/cascades, Realtime WebSockets, and
signup/recovery emails. Run it against the local development stack.

Browser smoke check (Linux Docker host networking):

```sh
docker run --rm --network host --env-file .env.stack.local \
  -v "$PWD/docker/browser:/tests:ro" mcr.microsoft.com/playwright:v1.55.1-noble \
  sh -c 'npm install --prefix /tmp/pw --no-audit --no-fund playwright@1.55.1 && NODE_PATH=/tmp/pw/node_modules node /tests/smoke.cjs'
```

Once live data is cached, replace `smoke.cjs` with `live.cjs` in the command above
for a read-only check of the real census and a cached encounter's Optibrain data.
It does not log patient identifiers, names, payloads, or screenshots.

Two further checks cover the deployment traps seen with the hospital workstation
browser; both are read-only and log no patient data:

* `forwarded-port.cjs` proxies the gateway on a second port, mimicking a VS Code
  forwarded port, and asserts login, the census, and that no request leaves that
  origin. Run it exactly like `smoke.cjs`.
* `lock-contention.cjs` holds supabase-js' browser lock from another client and
  asserts the app neither queues behind it nor blocks login.
* `mutations.cjs` reports the DOM mutation rate of the login page and dashboard,
  for extension-interference triage.

Optibrain API tests, using the built runtime and ephemeral test dependencies:

```sh
docker run --rm -v "$PWD/../optibrain/tests:/tests:ro" -e PYTHONPATH=/tmp/testdeps:/app \
  mypicu-optibrain:local sh -c '/usr/local/bin/pip install -q --target /tmp/testdeps httpx==0.28.1 && python -m pytest /tests/test_main.py -q -p no:cacheprovider'
```

Verified on 2026-09-30:

* All configured service healthchecks pass; initialization is repeatable.
* Nine cache/sync unit tests and ten Optibrain API tests pass.
* Integration checks above pass, including cache writes with the dedicated worker role.
* Chromium logs in, sees an empty census without demo fallback, and loads a new
  fixture encounter's Optibrain data. No runtime errors or cloud Supabase requests.
* Fixture cache reads measured roughly 3–15 ms; this is **not** a live ICCA benchmark.

The updated `mypicu` credential authenticates successfully against cathydb.
Read access to all ten required tables was verified; the account has a ten-connection
limit. The live census imported **40 open encounters and 13 recent discharges**.
Chromium successfully logged in, displayed the 53-row census, and loaded live
cached Optibrain vitals with no runtime errors or cloud Supabase calls.

Live measurements: one full extraction/computation/cache write took 62.2 seconds
for an 85,819-row snapshot. Reading its first 1,000 vital rows through authenticated
REST took 2.33 seconds including gateway/REST processing; an authenticated SQL
index-scan check took about 26 ms. These operations return different data volumes,
so these timings are not a like-for-like end-to-end speedup measurement.
Long-stay records can take several minutes to compute. Use `integration.sync_state`
to inspect the ongoing first fill and distinguish complete snapshots from encounters
awaiting clinical inputs. Open census rows are treated as open even if old, matching
the source rule described above.

## Troubleshooting: browser freezes after login

The hospital SSO extension **Imprivata CE** processes every DOM mutation and logs
`Could not establish connection. Receiving end does not exist.` when its
background service is unavailable. Each Realtime `patients` UPDATE makes the
existing frontend show a toast and refetch the patient list; a burst of 58 such
events produced ~26,800 DOM mutations in 12 s in a clean Chromium (vs. 0 when idle).

The census sync therefore writes a patient row only when name, age, weight or
bed actually changes (verified live: 0 of 58 rows rewritten on an unchanged
census). Age strings change at most once a day, so one larger update batch per day
remains possible. If the tab still freezes, test the same URL in a browser profile
without the Imprivata extension (or ask IT to disable it for `localhost`) to
confirm. `docker/browser/mutations.cjs` measures the app's mutation rate.

### Auth stalls: the browser-wide Web Lock

supabase-js serialises every auth call behind the browser lock
`lock:sb-<first hostname label>-auth-token`. The key has **no port**, so the real
tab and the copy of the app that the SSO extension injects into the same browser
context contend for the same lock, and the library warns about it itself
("Multiple GoTrueClient instances detected in the same browser context"). Verified
with `docker/browser/lock-contention.cjs`: with the lock held by another client
from document-start, the app's `initialize()` never gets it and any auth call
that waits for it stalls for `lockAcquireTimeout` (10 s) before failing.

The local build therefore passes `auth.lock` (a pass-through lock) in
`docker/frontend/configure.cjs`, keeping the tracked frontend source untouched.
The lock only guards cross-tab token-refresh races, which do not apply to a
single-user local stack. `lock-contention.cjs` asserts the app never queues
behind the lock and that login still works.

If login still stalls with the button disabled and **no** `POST /auth/v1/token`
in `docker/worker/../` service logs, the request is never dispatched by the
browser. Check, in the page console:

```js
(async () => { const l = await navigator.locks.query();
  const t = performance.now(); let f;
  try { f = (await fetch('/health', { cache: 'no-store' })).status + ' in ' + Math.round(performance.now() - t) + 'ms'; }
  catch (e) { f = 'threw ' + e.message; }
  console.log({ held: l.held.map(x => x.name), pending: l.pending.map(x => x.name),
                holders: l.held.map(x => x.clientId), session: !!localStorage.getItem('sb-localhost-auth-token'), fetch: f }); })()
```

A `fetch` that never settles points at the browser's per-host connection pool
being exhausted by the extension's injected frames; Envoy logs every request
path, duration and status, so `sh scripts/stack.sh logs envoy` shows whether a
request arrives at all.

The unrelated optibrain package-installation test currently fails collection
without a built distribution because its module-level `pytest.skip` lacks
`allow_module_level=True`. The API suite is run explicitly above.
