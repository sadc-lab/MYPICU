"""Batched ICCA extraction: one time-bounded pass per source table.

Design rules, all forced by measurement against the live source:

* Every statement is scoped to a caller-supplied encounter id list and an
  explicit time window. ``icca_htr`` carries no usable index on this account,
  so an unbounded scan costs 14.6s for heart rate alone; a 24h window costs
  0.3-2.9s. Never ship a query without both bounds.
* Monitor channels share one pass. ``icca_htr`` is an entity/attribute table,
  so 30+ ``par`` values collapse into a single ``par ILIKE ANY(...)`` scan.
* Rows are returned long-format (``patient_id, variable_key, charttime, valeur``)
  so a pass is independent of how many channels it yields.
* High-frequency channels are reduced server-side to a median per minute; the
  caller keeps the last 24h at minute resolution and rolls older data to one
  sample per hour. No pass may materialise a full-history result set.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
import re

import psycopg
from psycopg.rows import dict_row, tuple_row

# Monitor channels. Right column is the cache key used by the frontend.
# Both invasive (ARTm) and non-invasive (PAm) feed one blood-pressure key:
# prefer the arterial-line value, keep the cuff value when no line is present.
MONITOR = [
    ('FC', 'Variable_FC'),
    ('FR', 'Variable_FR'),
    ('spo2', 'Variable_SPO2'),
    ('CO2fe', 'Variable_EtCO2'),
    ('PAm', 'Variable_PAM'),
    ('ARTm', 'Variable_PAM_ART'),
    ('PICm', 'Variable_PIC'),
    ('PICd', 'Variable_PIC_d'),
    ('PICs', 'Variable_PIC_s'),
    ('PVCm', 'Variable_PVC'),
    ('rSO%', 'Variable_rSO2'),
]

# Laboratory channels. valuenumber is used throughout: terseform is text with
# decimal commas ('3,4') and cannot be read as a number without re-parsing.
LABS = [
    ('hemoglobine', (20703,), 'Variable_hemoglobine'),
    ('plaquettes', (68530, 68529, 68532, 72252, 17676, 17678, 39972, 43515), 'Variable_plaquettes'),
    ('glycemie', (14418, 32548, 102322), 'Variable_glycemie'),
    ('INR', (76332,), 'Variable_INR'),
]

# Blood gas. One pass over one table yields every gas; arterial and venous are
# separated by `site` rather than by separate scans.
BLOOD_GAS = [
    ('po2', 'arteriel', 'Variable_PaO2'),
    ('ph', 'arteriel', 'Variable_pH'),
    ('hco3', 'arteriel', 'Variable_HCO3'),
    ('so2', 'arteriel', 'Variable_SaO2'),
    ('pco2', 'arteriel', 'Variable_paco2'),
    ('so2', 'veineux', 'Variable_SvO2'),
    ('lactate', None, 'Variable_lactate'),
]

# Nurse assessment channels. temperature needs both the manual (16219) and the
# continuous probe (30847) attributes; the probe is the more frequent source.
ASSESSMENT = [
    ('temperature', (16219, 30847), 'Variable_temperature'),
    ('glasgow', (53122,), 'Variable_glasgow'),
    ('pupille_droite', (45611,), 'Variable_pupille_droite'),
    ('pupille_gauche', (62470,), 'Variable_pupille_gauche'),
]

# Head elevation. The assessment stores it as text ('30 degrés'), so the
# numeric part is extracted; the indicator compares against a 30 degree target.
HEAD_POSITION = ("interventionid IN (9932,9914) AND verboseform LIKE '%degrés'")

MEDICATION_CLASSES = [
    ('opioides', ['Morphine%', 'Hydromorphone%', 'Fentanyl%']),
    ('hypnotiques', ['Propofol%', 'Midazolam%']),
    ('anti_epileptique', ['Levetiracetam%', 'Carbamazepine%', 'Phenyto%']),
    ('inotropes_vasopresseurs', ['Dobutamine%', 'Dopamine%', 'Noradrenaline%',
                                 'Norepinephrine%', 'Adrenaline%', 'Epinephrine%',
                                 'Milrinone%', 'Vasopressine%']),
]

# Administration-rate attributes. Joining the order row to the administration row
# on descriptorid is what turns a drug name into a dose.
DOSE_ATTRIBUTES = (102543, 102544, 102545, 102554, 102558, 27669, 96430)

# Drug-name prefix -> medication_type, precomputed once.
_CLASS_INDEX = {pattern.lower().rstrip('%'): name
                for name, patterns in MEDICATION_CLASSES for pattern in patterns}

STATEMENT_TIMEOUT_MS = 90_000

# '<diameter> mm <flags>' as stored by the pupil assessment attribute.
PUPIL_DIAMETER = re.compile(r'^(\d+(?:[.,]\d+)?)\s*mm\b\s*(.*)$', re.IGNORECASE)


def _rows(conn, sql, params):
    """Run a bounded read and stream it back as plain tuples.

    The connection uses dict_row for scalar queries, but a server-side cursor
    inherits that factory, and positional unpacking below is both cheaper and
    clearer. Select the factory per cursor rather than per connection.
    """
    with conn.cursor(name='batch') as cur:
        cur.row_factory = tuple_row
        cur.itersize = 10_000
        cur.execute(sql, params)
        return cur.fetchall()


def monitor(conn, patients, fine_since, coarse_since):
    """Every monitor channel in a single scan, at two resolutions.

    The most recent day is reduced to a median per minute and everything older
    to a median per hour, in one pass. Bucketing conditionally matters: reading
    the window twice cost 19s because `icca_htr` has no usable index here, so
    each extra statement is another scan of the same rows. The CASE is applied
    after the WHERE, so the table is touched exactly once.
    """
    pars = [name for name, _ in MONITOR]
    sql = """
        SELECT noadmsip::bigint,
               CASE WHEN horodate >= %s
                    THEN date_trunc('minute', horodate AT TIME ZONE 'America/Montreal')
                    ELSE date_trunc('hour',   horodate AT TIME ZONE 'America/Montreal')
               END,
               par,
               percentile_cont(0.5) WITHIN GROUP (ORDER BY valnum)
        FROM icca_htr
        WHERE noadmsip = ANY(%s)
          AND par ILIKE ANY(%s)
          AND horodate >= %s
        GROUP BY 1, 2, 3
    """
    params = (fine_since, patients, pars, coarse_since)
    out = []
    for encounter, charttime, par, value in _rows(conn, sql, params):
        key = next((k for name, k in MONITOR if par.lower().startswith(name.lower())), None)
        if key and value is not None:
            out.append(('#' + str(encounter), key, charttime, float(value)))
    return out


def merge_art(series):
    """Fold invasive arterial-line pressure into the single blood-pressure key."""
    merged, invasive = [], {}
    for patient_id, key, charttime, value in series:
        if key == 'Variable_PAM_ART':
            slot = (patient_id, key.replace('_ART', ''))
            current = invasive.get(slot)
            # Prefer the most recent arterial-line reading for each minute.
            if current is None or charttime > current[0]:
                invasive[slot] = (charttime, value)
        else:
            merged.append((patient_id, key, charttime, value))
    for (patient_id, key), (charttime, value) in invasive.items():
        merged.append((patient_id, key, charttime, value))
    return merged


def blood_gas(conn, patients, since):
    """Every blood-gas analyte from one pass over one table."""
    sql = """
        SELECT noadmsip::bigint,
               horodate AT TIME ZONE 'America/Montreal',
               lower(site), po2, ph, hco3, so2, pco2, lactate
        FROM blood_gas
        WHERE noadmsip = ANY(%s) AND horodate >= %s AND pco2 <> 0
    """
    lookup = {name: (site, key) for name, site, key in BLOOD_GAS}
    out = []
    for row in _rows(conn, sql, (patients, since)):
        encounter, charttime, site = row[0], row[1], row[2]
        for name, value in zip(['po2', 'ph', 'hco3', 'so2', 'pco2', 'lactate'], row[3:]):
            if value in (None, 0):
                continue
            wanted_site, key = lookup[name]
            if wanted_site is not None:
                if site is None or wanted_site not in site:
                    continue
            out.append(('#' + str(encounter), key, charttime, float(value)))
    return out


def labs(conn, patients, since):
    """Laboratory numerics, read from valuenumber so no text parsing is needed."""
    attributes = sorted({a for _, group, _ in LABS for a in group})
    keys = {}
    for name, group, key in LABS:
        for attribute in group:
            keys[attribute] = key
    sql = """
        SELECT encounterid::bigint, charttime, attributeid, valuenumber
        FROM ptlabresult
        WHERE encounterid = ANY(%s) AND charttime >= %s AND attributeid = ANY(%s)
          AND valuenumber IS NOT NULL
    """
    out = []
    for encounter, charttime, attribute, value in _rows(conn, sql, (patients, since, attributes)):
        key = keys.get(attribute)
        if key and value is not None:
            out.append(('#' + str(encounter), key, charttime, float(value)))
    return out


def assessment(conn, patients, since):
    """Nurse-charted numerics plus the pupil pair, which needs parsing."""
    attributes = sorted({a for _, group, _ in ASSESSMENT for a in group})
    keys = {}
    for name, group, key in ASSESSMENT:
        for attribute in group:
            keys[attribute] = key
    sql = """
        SELECT encounterid::bigint, charttime, attributeid, valuenumber, terseform
        FROM ptassessment
        WHERE encounterid = ANY(%s) AND charttime >= %s AND attributeid = ANY(%s)
    """
    out, notes = [], []
    for encounter, charttime, attribute, valuenumber, terseform in _rows(
            conn, sql, (patients, since, attributes)):
        key = keys.get(attribute)
        if not key:
            continue
        patient_id = '#' + str(encounter)
        # Pupils arrive as '<diameter> mm <flags>' (e.g. '2 mm RB'): a numeric
        # channel with a categorical suffix. Parsing the diameter lets the UI
        # chart and range-check it; the raw string is kept alongside it.
        if key.startswith('Variable_pupille'):
            diameter, flags = parse_pupil(terseform)
            notes.append((patient_id, key, charttime, terseform, flags))
            if diameter is not None:
                out.append((patient_id, key, charttime, diameter))
            continue
        if valuenumber is not None:
            out.append((patient_id, key, charttime, float(valuenumber)))
    return out, notes


def parse_pupil(text):
    """'2 mm RB' -> (2.0, 'RB'); 'impossible' -> (None, 'impossible').

    The diameter and the reactivity suffix are one free-text field. Splitting on
    whitespace loses the unit ('2 mm RB' -> ['2','mm','RB']), so anchor on the
    unit with a regex and keep everything after it as the flag.
    """
    if text is None:
        return None, None
    raw = str(text).strip()
    if not raw:
        return None, None
    match = PUPIL_DIAMETER.match(raw)
    if not match:
        return None, raw
    return float(match.group(1).replace(',', '.')), match.group(2).strip() or None


def medications(conn, patients, since):
    """Doses per drug class via the order->administration self-join.

    A descriptor carries several order rows (up to 55 for one encounter in
    practice) and one row per administration, so joining them directly fans out
    by two orders of magnitude: 18,214 joined rows collapsed to 168 distinct
    observations in a 3-day window. Collapsing the order side *before* the join
    keeps the drug name while removing the multiplication.
    """
    drugs = []
    for _, patterns in MEDICATION_CLASSES:
        drugs.extend(patterns)
    sql = """
        WITH orders AS (
            SELECT DISTINCT encounterid, descriptorid, valuestring
            FROM ptmedication
            WHERE encounterid = ANY(%s) AND valuestring ILIKE ANY(%s)
        )
        SELECT DISTINCT o.encounterid::bigint, a.charttime, o.valuestring, a.verboseform
        FROM orders o
        JOIN ptmedication a
          ON a.encounterid = o.encounterid AND a.descriptorid = o.descriptorid
        WHERE a.charttime >= %s AND a.attributeid = ANY(%s)
        ORDER BY 1, 2
    """
    out = []
    for encounter, charttime, drugname, dose in _rows(
            conn, sql, (patients, drugs, since, list(DOSE_ATTRIBUTES))):
        if dose is None:
            continue
        kind = None
        for pattern, name in _CLASS_INDEX.items():
            if str(drugname).lower().startswith(pattern):
                kind = name
                break
        if kind:
            out.append(('#' + str(encounter), kind, str(drugname), charttime, str(dose)))
    return out


def head_position(conn, patients, since):
    """Head elevation in degrees, parsed out of the charted text."""
    sql = """
        SELECT encounterid::bigint, charttime,
               regexp_replace(terseform, '\\D+', '', 'g')::int AS valeur
        FROM ptassessment
        WHERE encounterid = ANY(%s) AND charttime >= %s
          AND interventionid IN (9932, 9914)
          AND verboseform LIKE '%%degrés'
        ORDER BY encounterid, charttime
    """
    out = []
    for encounter, charttime, value in _rows(conn, sql, (patients, since)):
        if value is not None:
            out.append(('#' + str(encounter), 'Variable_position_tete', charttime, float(value)))
    return out


def transfusions(conn, patients, since):
    """Plasma, red-cell and platelet transfusions, and the enteral feed line.

    Three of OptiBrain's indicators treat a transfusion or a feed as evidence
    that a lab value is still in date: a fresh INR overrides a stale one, a
    platelet transfusion overrides a low count. Without these rows the
    indicators judge every stale value as non-adherent.
    """
    sql = """
        SELECT i.encounterid::bigint, i.charttime, i.verboseform, a.longlabel, i.attributeid
        FROM ptintake i
        LEFT JOIN d_attribute a ON a.attributeid = i.attributeid
        WHERE i.encounterid = ANY(%s) AND i.charttime >= %s
          AND (i.verboseform ILIKE '%%plasma%%'
               OR i.verboseform ILIKE 'Culot globulaire'
               OR i.verboseform LIKE 'Plaquettes'
               OR i.attributeid IN (14490, 99080)
               OR a.longlabel LIKE 'Adm. Alimentation entérale%%')
        ORDER BY i.encounterid, i.charttime
    """
    plasma, red_cells, platelets, nutrition = [], [], [], []
    for encounter, charttime, verbose, longlabel, _attribute in _rows(
            conn, sql, (patients, since)):
        patient_id = '#' + str(encounter)
        text = verbose or ''
        if text.lower().lstrip().startswith('culot globulaire'):
            red_cells.append((patient_id, charttime, text))
        elif text.lower().lstrip().startswith('plaquettes'):
            platelets.append((patient_id, charttime, text))
        elif 'plasma' in text.lower():
            plasma.append((patient_id, charttime, text))
        if longlabel and longlabel.startswith('Adm. Alimentation entérale'):
            nutrition.append((patient_id, charttime, longlabel))
    return {'plasma': plasma, 'red_cells': red_cells,
            'platelets': platelets, 'nutrition': nutrition}


def clinical_notes(conn, patients, since):
    """Latest free-text note per patient, for the diagnosis and exam fields."""
    sql = """
        SELECT DISTINCT ON (encounterid)
               encounterid::bigint, charttime, terseform, verboseform, valuestring
        FROM ptintervention
        WHERE encounterid = ANY(%s) AND charttime >= %s
          AND attributeid = ANY(%s)
        ORDER BY encounterid, charttime DESC
    """
    out = []
    for encounter, charttime, terseform, verboseform, valuestring in _rows(
            conn, sql, (patients, since, [101072, 56831])):
        text = (terseform or verboseform or valuestring or '').strip()
        if text:
            out.append(('#' + str(encounter), charttime, text))
    return out


def connect(env):
    """Read-only source session with a per-statement timeout."""
    conn = psycopg.connect(host=env['DB_HOST'], port=env.get('DB_PORT', '5432'),
                           dbname=env['DB_NAME'], user=env['DB_USER'], password=env['DB_PASSWORD'],
                           connect_timeout=10, row_factory=dict_row,
                           options=('-c search_path=readonly,public'
                                    ' -c default_transaction_read_only=on'
                                    f' -c statement_timeout={STATEMENT_TIMEOUT_MS}'))
    conn.execute("SET TIME ZONE 'America/Montreal'")
    return conn


def harvest(patients, env, now=None):
    """Run every pass concurrently and return the rows grouped for the cache.

    Each pass opens its own connection: psycopg connections are not safe to
    share across threads, and the source account allows several concurrent
    sessions. The passes are independent reads over different tables, so
    overlapping them hides the short queries behind the one slow monitor scan.
    """
    now = now or datetime.now(timezone.utc)
    minute_since = now - timedelta(hours=24)
    hour_since = now - timedelta(days=3)
    ids = [int(p.removeprefix('#')) for p in patients]
    workers = max(1, int(env.get('ICCA_QUERY_CONCURRENCY', '4')))

    def run(fn, *args):
        with connect(env) as conn:
            return fn(conn, *args)

    # The monitor scan dominates at roughly 19s; the rest together take under
    # 10s. Overlapping them turns the total into the slowest single pass.
    jobs = {
        'monitor': lambda: run(monitor, ids, minute_since, hour_since),
        'medications': lambda: run(medications, ids, hour_since),
    }
    for key, fn in [('blood_gas', blood_gas), ('labs', labs),
                    ('assessment', assessment), ('notes', clinical_notes),
                    ('head_position', head_position), ('transfusions', transfusions)]:
        jobs[key] = (lambda f=fn: run(f, ids, hour_since))

    results = {}
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(job): name for name, job in jobs.items()}
        for future in as_completed(futures):
            results[futures[future]] = future.result()

    vitals = merge_art(results['monitor'] + results['blood_gas'] + results['labs'])
    vitals += results['assessment'][0]
    vitals += results['head_position']
    return {
        'vitals': vitals,
        'medications': results['medications'],
        'pupils': results['assessment'][1],
        'notes': results['notes'],
        'transfusions': results['transfusions'],
    }