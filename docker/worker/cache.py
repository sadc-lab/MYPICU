"""Translate a batched harvest into the frontend's cache tables.

The harvest is a set of long-format row lists; this module maps them onto the
four tables the UI already reads. Two rules matter more than the mapping itself:

* Categorical observations must never be coerced to numbers. A pupil recorded as
  '2 mm RB' keeps its text in `patient_clinical_info` while its diameter goes to
  `patient_vitals` as a number, so the UI can both chart and range-check it.
* A failed write must leave the previous cache intact. The caller owns the
  transaction and every DELETE + COPY happens inside it.
"""
from datetime import datetime
from decimal import Decimal, InvalidOperation
import os
from zoneinfo import ZoneInfo

from psycopg import sql
from psycopg.types.json import Jsonb

# vitals, medications, clinical_info and validity all keep the variable_key the
# frontend already knows, so no UI contract changes when the source query moves.
MEDICATION_CLASSES = {
    'opioides': 'opioides',
    'hypnotiques': 'hypnotiques',
    'anti_epileptique': 'anti_epileptique',
    'inotropes_vasopresseurs': 'inotropes_vasopresseurs',
}


def instant(value):
    """Attach the source timezone to a naive timestamp, preserving offsets."""
    if value is None:
        return None
    date = value if isinstance(value, datetime) else datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    # Preserve explicit offsets. Monitor times arrive naive and are Montreal time.
    return date if date.tzinfo else date.replace(tzinfo=ZoneInfo(os.getenv('SOURCE_TIMEZONE', 'America/Montreal')))


def numeric(value):
    if value is None or str(value).strip() == '':
        return None
    try:
        number = Decimal(str(value).strip().replace(',', '.'))
        return number if number.is_finite() else None
    except InvalidOperation:
        return None


def vitals_rows(harvest):
    """(patient_id, variable_key, charttime, valeur) for the vitals table."""
    rows = []
    for patient_id, key, charttime, value in harvest['vitals']:
        amount = numeric(value)
        if amount is not None:
            rows.append((patient_id, key, instant(charttime), amount))
    return rows


def medication_rows(harvest):
    """(patient_id, medication_type, drugname, charttime, variable, valeur)."""
    rows = []
    for patient_id, kind, drugname, charttime, dose in harvest['medications']:
        rows.append((patient_id, MEDICATION_CLASSES.get(kind, kind), drugname,
                     instant(charttime), 'posologie', str(dose)))
    return rows


def clinical_rows(harvest):
    """Categorical payloads, keyed so the UI can fetch them by info_type."""
    rows = []

    def add(patient_id, info_type, payload):
        rows.append((patient_id, info_type, Jsonb(payload)))

    for patient_id, key, charttime, raw, flags in harvest['pupils']:
        add(patient_id, key, {
            'valeur': raw, 'diametre_mm': None, 'reactivity': flags,
            'charttime': str(instant(charttime)),
        })
    for patient_id, charttime, text in harvest['notes']:
        add(patient_id, 'Variable_note_clinique', {
            'valeur': text, 'charttime': str(instant(charttime)),
        })
    return rows


def datasets(harvest):
    return [
        ('patient_vitals', ('patient_id', 'variable_key', 'charttime', 'valeur'),
         vitals_rows(harvest)),
        ('patient_medications',
         ('patient_id', 'medication_type', 'drugname', 'charttime', 'variable', 'valeur'),
         medication_rows(harvest)),
        ('patient_clinical_info', ('patient_id', 'info_type', 'data'),
         clinical_rows(harvest)),
    ]


def replace_cache(db, patients, harvest):
    """Replace every harvested patient's cache slice in one transaction."""
    if not patients:
        return 0
    count = 0
    for table, columns, rows in datasets(harvest):
        db.execute(sql.SQL('DELETE FROM public.{} WHERE patient_id = ANY(%s)').format(
            sql.Identifier(table)), (list(patients),))
        if not rows:
            continue
        statement = sql.SQL('COPY public.{} ({}) FROM STDIN').format(
            sql.Identifier(table), sql.SQL(',').join(map(sql.Identifier, columns)))
        with db.cursor().copy(statement) as copy:
            for row in rows:
                copy.write_row(row)
        count += len(rows)
    return count