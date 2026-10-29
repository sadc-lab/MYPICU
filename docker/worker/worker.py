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
import psycopg
from psycopg.rows import dict_row
import uvicorn

import queries
from cache import instant, replace_cache
from modules import load_modules
from preflight import source

log = logging.getLogger('sync')
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
RETENTION = int(os.getenv('PATIENT_RETENTION_DAYS', '3'))
INTERVAL = max(30, int(os.getenv('SYNC_INTERVAL_SECONDS', '900')))
LOCK = 726402
busy = asyncio.Lock()

def current_patients():
    with local() as db:
        return [row['id'] for row in db.execute(
            'SELECT id FROM public.patients')]


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
    """Return shared patient context keyed by the source encounter ID."""
    if not patients:
        return {'intime': {}, 'dateofbirth': {}}
    rows = db.execute('''SELECT encounterid, admitted_at, dateofbirth
                         FROM integration.patient_map WHERE patient_id = ANY(%s)''',
                      (list(patients),))
    return {
        'intime': {str(r['encounterid']): r['admitted_at'] for r in rows},
        'dateofbirth': {str(r['encounterid']): r['dateofbirth'] for r in rows},
    }


ACTIVE_MODULES = load_modules()


def sync_batch(db, patients):
    """Refresh shared cache data and dispatch the configured module runners.

    The previous design issued one HTTP request per patient, so a ward of 58
    patients cost 58 sequential round-trips and roughly 250s. Every source query
    accepts an encounter-id list, so the whole ward is fetched in one cycle
    (~20s, bounded by one monitor scan) and replaced atomically.

    Every module receives the same normalized harvest. Its result persistence
    shares the cache transaction, so a failed module cannot leave a partial
    snapshot behind.
    """
    start = time.monotonic()
    db.execute('UPDATE integration.sync_state SET status=\'running\',started_at=now(),error=NULL '
               'WHERE patient_id = ANY(%s)', (patients,))
    if ACTIVE_MODULES:
        db.execute('''INSERT INTO integration.module_sync_state
            (module_name, patient_id, status, started_at, error)
            SELECT modules.module_name, patients.patient_id, 'running', now(), NULL
            FROM unnest(%s::text[]) AS modules(module_name)
            CROSS JOIN unnest(%s::text[]) AS patients(patient_id)
            ON CONFLICT (module_name, patient_id) DO UPDATE SET
                status='running', started_at=now(), error=NULL''',
            ([module.name for module in ACTIVE_MODULES], patients))
    try:
        harvest = queries.harvest(patients, os.environ)
        patient_demographics = demographics(db, patients)
        prepared = [
            (module, module.prepare_batch(db, patients, harvest, patient_demographics))
            for module in ACTIVE_MODULES
        ]

        with db.transaction():
            count = replace_cache(db, patients, harvest)
            for module, result in prepared:
                count += result.persist(db)
                db.execute('''UPDATE integration.module_sync_state SET status='ready',
                    last_synced_at=now(), duration_ms=%s, error=NULL
                    WHERE module_name=%s AND patient_id = ANY(%s)''',
                    (int((time.monotonic()-start)*1000), module.name, patients))
            db.execute('''UPDATE integration.sync_state SET status='ready',last_synced_at=now(),
                duration_ms=%s,row_count=%s,error=NULL WHERE patient_id = ANY(%s)''',
                (int((time.monotonic()-start)*1000), count, patients))

        log.info('Sync refreshed for %d patients (%d rows, modules=%s, %.1fs)',
                 len(patients), count, ','.join(module.name for module, _ in prepared),
                 time.monotonic()-start)
        return count
    except Exception as exc:
        # Do not log patient payloads, SQL with demographics, or credentials.
        db.execute("UPDATE integration.sync_state SET status='error',error=%s WHERE patient_id = ANY(%s)",
                   (type(exc).__name__, patients))
        if ACTIVE_MODULES:
            db.execute('''UPDATE integration.module_sync_state SET status='error',error=%s
                WHERE module_name = ANY(%s) AND patient_id = ANY(%s)''',
                (type(exc).__name__, [module.name for module in ACTIVE_MODULES], patients))
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
            fresh_cache = set() if force else {row['patient_id'] for row in db.execute('''
                SELECT patient_id FROM integration.sync_state
                WHERE status = 'ready'
                  AND last_synced_at > now() - (%s * interval '1 second')''', (INTERVAL,))}
            fresh_modules = set() if force or not ACTIVE_MODULES else {
                (row['module_name'], row['patient_id']) for row in db.execute('''
                  SELECT module_name, patient_id FROM integration.module_sync_state
                  WHERE status = 'ready'
                    AND last_synced_at > now() - (%s * interval '1 second')''', (INTERVAL,))
            }
            stale = [
                pid for pid in targets
                if pid not in fresh_cache or any(
                  (module.name, pid) not in fresh_modules for module in ACTIVE_MODULES)
            ]
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
                for module in ACTIVE_MODULES:
                    if module.scheduled_cycle:
                        await module.scheduled_cycle(current_patients())
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
