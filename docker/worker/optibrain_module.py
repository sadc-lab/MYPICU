"""OptiBrain batch adapter and its independently scheduled autoregulation task."""
import asyncio
from datetime import datetime, timedelta, timezone
import logging
import os

import httpx
import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

import optibrain_export
import queries
from modules import PreparedBatch, SyncModule

log = logging.getLogger('sync.optibrain')
OPTIBRAIN_URL = os.getenv('OPTIBRAIN_URL', 'http://optibrain:8000')
AR_URL = os.getenv('OPTIBRAIN_AR_URL', 'http://optibrain-autoreg:8000')
OPTIBRAIN_TOKEN = os.getenv('OPTIBRAIN_TOKEN', '')
AUTOREG_WINDOW_HOURS = 24
AUTOREG_MIN_SAMPLES = 120
AUTOREG_MIN_HOURS = 2
ar_busy = asyncio.Lock()


def local():
    return psycopg.connect(os.environ['LOCAL_DSN'], autocommit=True, row_factory=dict_row)


def request_indicators(patients, url, token, indicator_data):
    """Ask OptiBrain for hourly adherence matrices from this harvested batch."""
    ids = sorted(int(p.removeprefix('#')) for p in patients)
    with httpx.Client(timeout=httpx.Timeout(900, connect=10)) as client:
        response = client.post(f'{url}/indicateurs',
                              json={'patients': ids, 'schema_version': 1,
                                    'indicator_data': indicator_data},
                              headers={'Authorization': f'Bearer {token}'})
        response.raise_for_status()
        return response.json()


def validity_rows(payload, patients):
    """Translate OptiBrain matrices, rejecting unrequested encounter IDs."""
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


def prepare_batch(_db, patients, harvest, patient_demographics):
    """Prepare module results without holding the shared cache transaction."""
    indicator_data = optibrain_export.build_payload(harvest, patient_demographics)
    indicators = request_indicators(
        patients, OPTIBRAIN_URL, OPTIBRAIN_TOKEN, indicator_data)
    validity = validity_rows(indicators, patients)
    failures = indicators.get('failures') or {}

    def persist(target):
        target.execute('DELETE FROM public.patient_validity WHERE patient_id = ANY(%s)',
                       (list(patients),))
        if validity:
            with target.cursor().copy(
                    'COPY public.patient_validity '
                    '(patient_id, indicator_key, hour_index, is_adherent) FROM STDIN') as copy:
                for row in validity:
                    copy.write_row(row)
        if failures:
            log.warning('OptiBrain skipped %d patient(s): %s', len(failures), sorted(failures))
        return len(validity)

    return PreparedBatch(persist=persist)


def autoregulation_candidates(series, patients):
    """Select patients with enough native signals to support PRx or COx."""
    def enough(patient_id: str, channel: str) -> bool:
        times = [t for p, c, t, _v in series if p == patient_id and c == channel]
        if len(times) < AUTOREG_MIN_SAMPLES:
            return False
        seconds = max(times) - min(times)
        if hasattr(seconds, 'total_seconds'):
            seconds = seconds.total_seconds()
        return seconds >= AUTOREG_MIN_HOURS * 3600

    prx, cox = [], []
    for patient_id in patients:
        if enough(patient_id, 'PIC') and enough(patient_id, 'PPC'):
            prx.append(patient_id)
        if enough(patient_id, 'NIRS') and (
                enough(patient_id, 'PAM') or enough(patient_id, 'PAM_cuff')):
            cox.append(patient_id)
    return {'prx': prx, 'cox': cox}


def request_autoregulation(patients, mode, autoreg_data):
    route = '/autoregulation_ppc_optimale' if mode == 'prx' else '/autoregulation_nirs'
    ids = sorted(int(p.removeprefix('#')) for p in patients)
    with httpx.Client(timeout=httpx.Timeout(1800, connect=10)) as client:
        response = client.post(f'{AR_URL}{route}',
                               json={'patients': ids, 'schema_version': 1,
                                     'autoreg_data': autoreg_data},
                               headers={'Authorization': f'Bearer {OPTIBRAIN_TOKEN}'})
        response.raise_for_status()
        return response.json()


def autoregulation_rows(payload, mode, computed_at=None):
    """Translate OptiBrain recap and full-table records for the local store."""
    rows = []
    for encounter, tables in (payload or {}).items():
        recap = next(
            (t for name, t in tables.items() if name.endswith('_AR_3min') or name.endswith('_AR_3min_Fisher')),
            None,
        )
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
            Jsonb(wide if wide else None),
        ))
    return rows


def store_autoregulation(db, rows):
    if not rows:
        return 0
    for row in rows:
        db.execute('''INSERT INTO public.patient_autoregulation
            (patient_id, mode, optimal_pressure, inferior_limit, superior_limit,
             min_index, pressure_variable, signal_variable, sample_count, computed_at, raw)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,COALESCE(%s, now()),%s)
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


async def scheduled_cycle(patients):
    """Start long autoregulation work without blocking the shared sync cycle."""
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
    """Recompute results only when source signals have advanced."""
    since = datetime.now(timezone.utc) - timedelta(hours=AUTOREG_WINDOW_HOURS)
    with queries.connect(os.environ) as conn:
        series = queries.autoreg_series(conn, [int(p.removeprefix('#')) for p in patients], since)

    candidates = autoregulation_candidates(series, patients)
    fresh = {row['patient_id'] for row in db.execute(
        """SELECT DISTINCT patient_id FROM public.patient_autoregulation
           WHERE computed_at > now() - (%s * interval '1 minute')""", (15,))}

    stored = 0
    for mode, eligible in candidates.items():
        todo = [p for p in eligible if p not in fresh]
        if not todo:
            continue
        autoreg_data = optibrain_export.build_autoreg_payload(series, todo)
        payload = request_autoregulation(todo, mode, autoreg_data)
        with db.transaction():
            stored += store_autoregulation(db, autoregulation_rows(payload, mode))
        log.info('Autoregulation (%s) recomputed for %d patient(s)', mode, len(todo))
    if not any(candidates.values()):
        log.info('No patient has both intracranial and arterial monitoring; autoregulation skipped')
    return stored


MODULE = SyncModule('optibrain', prepare_batch, scheduled_cycle)
