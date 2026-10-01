"""Single-flight census/cache sync. The local DB is the only UI data source."""
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
import hmac
import logging
import os
from pathlib import Path
import time

from fastapi import FastAPI, Header, HTTPException
import httpx
import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
import uvicorn

import queries
import optibrain_export
from cache import instant, replace_cache
from preflight import source

log = logging.getLogger('sync')
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
RETENTION = int(os.getenv('PATIENT_RETENTION_DAYS', '3'))
INTERVAL = max(30, int(os.getenv('SYNC_INTERVAL_SECONDS', '900')))
LOCK = 726402
busy = asyncio.Lock()

# Directory shared with the OptiBrain container. Both sides mount it at the
# same path so the CSVs this worker writes are the ones OptiBrain reads.
EXPORT_DIR = os.getenv('OPTIBRAIN_EXPORT_DIR', '/optibrain/donnees')
# Autoregulation gets its own instance, input volume and endpoint: a single fit
# takes around half an hour and would otherwise hold the module's request lock
# while the sync cycle waits for it.
AR_EXPORT_DIR = os.getenv('OPTIBRAIN_AR_EXPORT_DIR', '/optibrain-ar/donnees')
OPTIBRAIN_URL = os.getenv('OPTIBRAIN_URL', 'http://optibrain:8000')
AR_URL = os.getenv('OPTIBRAIN_AR_URL', 'http://optibrain-autoreg:8000')
OPTIBRAIN_TOKEN = os.getenv('OPTIBRAIN_TOKEN', '')
# Only one autoregulation run at a time; it outlives the sync cycle that
# started it, so a second one would queue behind the first indefinitely.
ar_busy = asyncio.Lock()

def current_patients():
    with local() as db:
        return [row['patient_id'] for row in db.execute(
            'SELECT patient_id FROM public.patients')]


def local():
    return psycopg.connect(os.environ['LOCAL_DSN'], autocommit=True, row_factory=dict_row)

def format_weight(value):
    """Render a charted weight for display.

    valuenumber comes back as an unbounded decimal (59.00000000000000), which
    the UI showed verbatim. Round to one decimal: that is the resolution of a
    charted paediatric weight.
    """
    number = float(value)
    return f"{number:.1f}".rstrip('0').rstrip('.') + ' kg'

def apply_census(db, rows):
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=RETENTION)
    retained, present = [], []
    with db.transaction():
        for row in rows:
            patient_id = '#' + str(row['encounterid'])
            present.append(patient_id)
            discharge = instant(row['outtime'])
            if discharge and discharge < cutoff:
                db.execute('DELETE FROM public.patients WHERE id=%s AND EXISTS (SELECT FROM integration.patient_map WHERE patient_id=%s)', (patient_id, patient_id))
                continue
            # A missing source value must not overwrite a good cached one:
            # an admission with no charted weight keeps whatever was already
            # recorded rather than degrading to a dash.
            weight = '—' if row['weight'] is None else format_weight(row['weight'])
            gcs = None if row.get('gcs') is None else int(row['gcs'])
            db.execute('''INSERT INTO public.patients(id,name,age,weight,picu_id,ward,gcs)
                VALUES (%s,%s,%s,%s,%s,'pedA',%s) ON CONFLICT(id) DO UPDATE SET
                name=COALESCE(excluded.name, patients.name),
                age=COALESCE(excluded.age, patients.age),
                weight=COALESCE(NULLIF(excluded.weight,'—'), patients.weight),
                picu_id=COALESCE(NULLIF(excluded.picu_id,'—'), patients.picu_id),
                gcs=COALESCE(excluded.gcs, patients.gcs),
                updated_at=now()
                -- Write only real changes: every UPDATE is broadcast over Realtime and
                -- re-renders/toasts in every open browser.
                WHERE (patients.name, patients.age, patients.weight, patients.picu_id, patients.gcs)
                  IS DISTINCT FROM (COALESCE(excluded.name, patients.name),
                                    COALESCE(excluded.age, patients.age),
                                    COALESCE(NULLIF(excluded.weight,'—'), patients.weight),
                                    COALESCE(NULLIF(excluded.picu_id,'—'), patients.picu_id),
                                    COALESCE(excluded.gcs, patients.gcs))''',
                (patient_id, row['name'] or '—', row['age'], weight, row['bedlabel'] or '—', gcs))
            db.execute('''INSERT INTO integration.patient_map(patient_id,encounterid,admitted_at,discharged_at,clinicalunitid,dateofbirth)
                VALUES (%s,%s,%s,%s,%s,%s) ON CONFLICT(patient_id) DO UPDATE SET
                admitted_at=excluded.admitted_at,discharged_at=excluded.discharged_at,
                clinicalunitid=excluded.clinicalunitid,
                dateofbirth=COALESCE(excluded.dateofbirth, integration.patient_map.dateofbirth),
                last_seen_at=now()''',
                (patient_id, row['encounterid'], instant(row['intime']), discharge,
                 str(row['clinicalunitid']), row.get('dateofbirth')))
            # Ensure a sync_state row exists so the batch UPDATE always has a target.
            db.execute('INSERT INTO integration.sync_state(patient_id,status) VALUES (%s,\'pending\') '
                       'ON CONFLICT(patient_id) DO NOTHING', (patient_id,))
            if discharge is None:
                retained.append(patient_id)
        # Missing records: stop sync immediately, allow the full retention window
        # from last sighting. This runs only after a successful source query.
        db.execute('''UPDATE integration.patient_map SET discharged_at=last_seen_at
            WHERE NOT (patient_id = ANY(%s)) AND discharged_at IS NULL''', (present,))
        db.execute('''DELETE FROM public.patients p USING integration.patient_map m
            WHERE p.id=m.patient_id AND m.discharged_at < %s''', (cutoff,))
        db.execute('''INSERT INTO integration.census_state(id,last_success_at,last_attempt_at,patient_count,error)
            VALUES(true,now(),now(),%s,NULL) ON CONFLICT(id) DO UPDATE SET
            last_success_at=now(),last_attempt_at=now(),patient_count=excluded.patient_count,error=NULL''', (len(retained),))
    return retained

def refresh_census(db):
    tracked = [r['encounterid'] for r in db.execute('SELECT encounterid FROM integration.patient_map')]
    with source() as remote:
        remote.row_factory = dict_row
        rows = remote.execute(Path('census.sql').read_text(), (RETENTION, tracked)).fetchall()
    return apply_census(db, rows)

def demographics(db, patients):
    """Bootstrap identifiers for the indicator pipeline, keyed by encounter id."""
    if not patients:
        return {'intime': {}, 'dateofbirth': {}}
    rows = db.execute('''SELECT encounterid, admitted_at, dateofbirth
                         FROM integration.patient_map WHERE patient_id = ANY(%s)''',
                      (list(patients),))
    return {
        'intime': {str(r['encounterid']): r['admitted_at'] for r in rows},
        'dateofbirth': {str(r['encounterid']): r['dateofbirth'] for r in rows},
    }


def request_indicators(patients, url, token):
    """Ask OptiBrain for the hourly adherence matrices.

    OptiBrain reads the CSVs this module just wrote and computes validity from
    them; `skip_fetch` stops it querying ICCA a second time.
    """
    ids = sorted(int(p.removeprefix('#')) for p in patients)
    with httpx.Client(timeout=httpx.Timeout(900, connect=10)) as client:
        response = client.post(f'{url}/indicateurs',
                              json={'patients': ids, 'skip_fetch': True},
                              headers={'Authorization': f'Bearer {token}'})
        response.raise_for_status()
        return response.json()


def validity_rows(payload, patients):
    """Translate the matrices into patient_validity rows.

    OptiBrain encodes 0 as adherent and 1 as a deviation, so adherence is the
    inverse. Rows for an encounter that was not requested are rejected: they
    would otherwise be written against the wrong patient.
    """
    wanted = {int(p.removeprefix('#')) for p in patients}
    rows = []
    for key, records in payload.items():
        if not key.startswith('matrices_rt_') or not key.endswith('_validite'):
            continue
        indicator = key[len('matrices_rt_'):-len('_validite')]
        for record in records:
            encounter = int(record['id_patient'])
            if encounter not in wanted:
                raise ValueError('Indicator response belongs to another encounter')
            for hour, value in record.items():
                if not (hour.startswith('H') and hour[1:].isdigit()):
                    continue
                if value not in (0, 1):
                    raise ValueError('Unknown indicator validity value')
                rows.append(('#' + str(encounter), indicator, int(hour[1:]), value == 0))
    return rows


AUTOREG_WINDOW_HOURS = 24
# OptiBrain refuses to fit a curve without enough points in the pressure range,
# and a patient with a handful of samples produces an all-null result that looks
# like a computation rather than an absence of data.
AUTOREG_MIN_SAMPLES = 120
AUTOREG_MIN_HOURS = 2


def autoregulation_candidates(series, patients):
    """Which patients can actually be analysed, and in which mode.

    PRx correlates intracranial pressure against cerebral perfusion pressure,
    so both the ICP channel and the monitor's own CPP channel are required.
    CPP is not derived here: the hospital records it natively, and computing
    it from arterial and intracranial pressure would substitute an assumption
    for a measurement the source already provides.

    COx correlates arterial pressure against cerebral oxygenation, so it needs
    both the pressure channel and a frontal rSO2 probe.

    A patient without the required channels is skipped rather than sent for an
    analysis that can only return nulls.
    """
    counts = {}
    for patient_id, channel, _t, _v in series:
        counts.setdefault(patient_id, {}).setdefault(channel, 0)
        counts[patient_id][channel] += 1

    prx, cox = [], []
    for patient_id in patients:
        channels = counts.get(patient_id, {})
        enough = lambda name: channels.get(name, 0) >= AUTOREG_MIN_SAMPLES
        if enough('PIC') and enough('PPC'):
            prx.append(patient_id)
        if enough('NIRS') and enough('PAM'):
            cox.append(patient_id)
    return {'prx': prx, 'cox': cox}


def request_autoregulation(patients, mode, url, token):
    route = '/autoregulation_ppc_optimale' if mode == 'prx' else '/autoregulation_nirs'
    ids = sorted(int(p.removeprefix('#')) for p in patients)
    with httpx.Client(timeout=httpx.Timeout(1800, connect=10)) as client:
        response = client.post(f'{url}{route}',
                               json={'patients': ids, 'skip_fetch': True},
                               headers={'Authorization': f'Bearer {token}'})
        response.raise_for_status()
        return response.json()


def autoregulation_rows(payload, mode, computed_at=None):
    """Pull the headline figures out of the module's result tables.

    The module returns two tables per patient: a wide one with every
    correlation-window and pressure-window combination, and a three-minute
    recap. The recap carries the global optimum, which is the figure the
    dashboard shows; the wide table is kept so a clinician can see the spread.
    """
    rows = []
    for encounter, tables in (payload or {}).items():
        recap = next((t for name, t in tables.items() if name.endswith('_AR_3min')), None)
        wide = next((t for name, t in tables.items() if 'Full_AR_Table' in name), None)
        if not recap:
            continue
        last = recap[-1]

        def number(*names):
            for name in names:
                value = last.get(name)
                if value is not None:
                    try:
                        return float(value)
                    except (TypeError, ValueError):
                        return None
            return None

        optimal = number('Global_Optimal_PPC', 'Global_Optimal_PAM')
        if optimal is None:
            # No reliable plateau: keep the row out rather than record a result
            # with no optimum, which would read as "not yet calculated".
            continue
        rows.append((
            '#' + str(encounter),
            mode,
            optimal,
            number('Global_Inferior_Limit'),
            number('Global_Superior_Limit'),
            number('PRx', 'COx'),
            'PPC' if mode == 'prx' else 'PAM',
            'PIC' if mode == 'prx' else 'NIRS1',
            int(number('Horodate_count') or 0) or None,
            computed_at,
            Jsonb(wide[-1] if wide else None),
        ))
    return rows


def store_autoregulation(db, rows):
    if not rows:
        return 0
    for row in rows:
        db.execute('''INSERT INTO public.patient_autoregulation
            (patient_id, mode, optimal_pressure, inferior_limit, superior_limit,
             min_index, pressure_variable, signal_variable, sample_count, computed_at, raw)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,now(),%s)
            ON CONFLICT (patient_id, mode) DO UPDATE SET
                optimal_pressure=excluded.optimal_pressure,
                inferior_limit=excluded.inferior_limit,
                superior_limit=excluded.superior_limit,
                min_index=excluded.min_index,
                pressure_variable=excluded.pressure_variable,
                signal_variable=excluded.signal_variable,
                sample_count=excluded.sample_count,
                computed_at=now(),
                raw=excluded.raw
            WHERE (patient_autoregulation.optimal_pressure,
                   patient_autoregulation.inferior_limit,
                   patient_autoregulation.superior_limit,
                   patient_autoregulation.min_index)
                  IS DISTINCT FROM (excluded.optimal_pressure,
                                    excluded.inferior_limit,
                                    excluded.superior_limit,
                                    excluded.min_index)''',
                row)
    return len(rows)


async def autoregulation_cycle(patients):
    """Start a background autoregulation pass and return immediately.

    Fitting the correlation curve costs roughly half an hour per patient, so it
    cannot sit inside a fifteen-minute cycle. The task is fire-and-forget: the
    cycle that starts it continues, and the next one finds the run already in
    progress and skips.
    """
    if ar_busy.locked():
        log.info('Autoregulation already running; skipping this cycle')
        return
    await ar_busy.acquire()
    try:
        asyncio.create_task(_autoregulation_pass(patients))
    except Exception:
        ar_busy.release()
        raise


async def _autoregulation_pass(patients):
    try:
        with local() as db:
            stored = await asyncio.to_thread(refresh_autoregulation, db, patients)
            if stored:
                log.info('Autoregulation stored %d result(s)', stored)
    except Exception as exc:
        log.error('Autoregulation cycle failed: %s', type(exc).__name__)
    finally:
        ar_busy.release()


def refresh_autoregulation(db, patients):
    """Recompute brain autoregulation for patients whose signals have moved.

    Adherence is cheap enough to redo every cycle. Autoregulation fits thousands
    of curves per patient, so it only runs when the underlying series has
    actually advanced: repeating an identical computation would rewrite the same
    numbers and spend minutes of CPU to learn nothing.
    """
    since = datetime.now(timezone.utc) - timedelta(hours=AUTOREG_WINDOW_HOURS)
    with queries.connect(os.environ) as conn:
        series = queries.autoreg_series(conn, [int(p.removeprefix('#')) for p in patients], since)

    optibrain_export.build_autoreg(series, AR_EXPORT_DIR, patients)
    candidates = autoregulation_candidates(series, patients)

    # Patients already holding a result that is still current are left alone.
    fresh = {row['patient_id'] for row in db.execute(
        """SELECT DISTINCT patient_id FROM public.patient_autoregulation
           WHERE computed_at > now() - (%s * interval '1 minute')""", (15,))}

    stored = 0
    with db.transaction():
        for mode, eligible in candidates.items():
            todo = [p for p in eligible if p not in fresh]
            if not todo:
                continue
            payload = request_autoregulation(todo, mode, AR_URL, OPTIBRAIN_TOKEN)
            stored += store_autoregulation(db, autoregulation_rows(payload, mode))
            log.info('Autoregulation (%s) recomputed for %d patient(s)', mode, len(todo))
    if not any(candidates.values()):
        log.info('No patient has both intracranial and arterial monitoring; autoregulation skipped')
    return stored


def sync_batch(db, patients):
    """Harvest every patient, hand the raw data to OptiBrain, and store both.

    The previous design issued one HTTP request per patient, so a ward of 58
    patients cost 58 sequential round-trips and roughly 250s. Every source query
    accepts an encounter-id list, so the whole ward is fetched in one cycle
    (~20s, bounded by one monitor scan) and replaced atomically.

    OptiBrain keeps ownership of the clinical computations: the hourly
    adherence matrices and, separately, brain autoregulation.
    """
    start = time.monotonic()
    db.execute('UPDATE integration.sync_state SET status=\'running\',started_at=now(),error=NULL '
               'WHERE patient_id = ANY(%s)', (patients,))
    try:
        harvest = queries.harvest(patients, os.environ)
        optibrain_export.build(harvest, demographics(db, patients), EXPORT_DIR, patients)
        indicators = request_indicators(patients, OPTIBRAIN_URL, OPTIBRAIN_TOKEN)
        validity = validity_rows(indicators, patients)
        failures = indicators.get('failures') or {}

        with db.transaction():
            count = replace_cache(db, patients, harvest)
            db.execute('DELETE FROM public.patient_validity WHERE patient_id = ANY(%s)',
                       (list(patients),))
            if validity:
                with db.cursor().copy(
                        'COPY public.patient_validity '
                        '(patient_id, indicator_key, hour_index, is_adherent) FROM STDIN') as copy:
                    for row in validity:
                        copy.write_row(row)
                count += len(validity)
            db.execute('''UPDATE integration.sync_state SET status='ready',last_synced_at=now(),
                duration_ms=%s,row_count=%s,error=NULL WHERE patient_id = ANY(%s)''',
                (int((time.monotonic()-start)*1000), count, patients))

        log.info('Cache refreshed for %d patients (%d rows, %d validity, %.1fs)',
                 len(patients), count, len(validity), time.monotonic()-start)
        if failures:
            log.warning('OptiBrain skipped %d patient(s): %s', len(failures), sorted(failures))
        return count
    except Exception as exc:
        # Do not log patient payloads, SQL with demographics, or credentials.
        db.execute("UPDATE integration.sync_state SET status='error',error=%s WHERE patient_id = ANY(%s)",
                   (type(exc).__name__, patients))
        log.error('Batch sync failed: %s; previous cache preserved', type(exc).__name__)
        return None

def run_sync(patient_id=None, force=True):
    with local() as db:
        if not db.execute('SELECT pg_try_advisory_lock(%s) AS locked', (LOCK,)).fetchone()['locked']:
            return {'status': 'busy'}
        try:
            try:
                current = refresh_census(db)
            except Exception as exc:
                db.execute('''INSERT INTO integration.census_state(id,last_attempt_at,error) VALUES(true,now(),%s)
                    ON CONFLICT(id) DO UPDATE SET last_attempt_at=now(),error=excluded.error''', (type(exc).__name__,))
                log.error('Census unavailable: %s; cache and retention left intact', type(exc).__name__)
                return {'status': 'source_unavailable'}
            if patient_id and patient_id not in current:
                return {'status': 'not_current'}
            targets = [patient_id] if patient_id else current
            if not targets:
                return {'status': 'completed', 'current_patients': 0, 'refreshed': 0}
            # A restarted worker resumes unfinished patients rather than
            # immediately recomputing recently successful, expensive snapshots.
            fresh = set() if force else {row['patient_id'] for row in db.execute('''
                SELECT patient_id FROM integration.sync_state
                WHERE status = 'ready'
                  AND last_synced_at > now() - (%s * interval '1 second')''', (INTERVAL,))}
            stale = [pid for pid in targets if pid not in fresh]
            refreshed = 0 if sync_batch(db, stale) is None else len(stale)
            return {'status': 'partial_error' if refreshed != len(stale) else 'completed',
                    'current_patients': len(current), 'refreshed': refreshed}
        finally:
            db.execute('SELECT pg_advisory_unlock(%s)', (LOCK,))

async def scheduled():
    while True:
        try:
            async with busy:
                await asyncio.to_thread(run_sync, force=False)
                await autoregulation_cycle(current_patients())
        except Exception as exc:
            log.error('Sync cycle failed: %s', type(exc).__name__)
        await asyncio.sleep(INTERVAL)

@asynccontextmanager
async def lifespan(app):
    task = asyncio.create_task(scheduled())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

app = FastAPI(lifespan=lifespan)

def authorized(authorization):
    if not hmac.compare_digest(authorization or '', 'Bearer ' + os.environ['SYNC_TOKEN']):
        raise HTTPException(401, 'Invalid sync token')

@app.get('/health')
def health():
    with local() as db:
        state = db.execute('SELECT last_success_at,last_attempt_at,patient_count,error FROM integration.census_state').fetchone()
    return {'alive': True, 'census': state}

@app.post('/sync')
@app.post('/sync/{encounterid}')
async def on_demand(encounterid: int | None = None, authorization: str | None = Header(default=None)):
    authorized(authorization)
    if busy.locked():
        raise HTTPException(409, 'A sync is already running')
    async with busy:
        return await asyncio.to_thread(run_sync, None if encounterid is None else '#' + str(encounterid))

if __name__ == '__main__':
    uvicorn.run(app, host='0.0.0.0', port=8001)
