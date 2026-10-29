"""Render harvested rows into OptiBrain's request contracts.

OptiBrain receives these channel records directly over its internal API.
Rather than have it query ICCA again -- which costs about 59s of unbounded
scans per cycle -- this module adapts rows the worker already harvested.

The contract is not uniform, and that is deliberate on OptiBrain's side:

* the patient column is ``noadmsip`` in most channels and ``encounterid`` in
  others, and the reader filters on whichever one it expects;
* ``Variable_premiere_frequence_cardiaque`` and ``Variable_age`` are
  bootstrap channels: the first supplies the origin of the 96-hour timeline and
  the second the age band used by the PPC target. Neither is an indicator;
* several channels carry extra columns the indicators filter on, for example
  ``drugname`` for antiepileptics and ``longlabel`` for nutrition.

Each channel is present in the payload even when it has no rows. The
OptiBrain-side input validator uses the complete channel set to distinguish an
empty channel from an omitted or malformed request.
"""
from datetime import datetime
from decimal import Decimal
import math

# Columns per channel, in the order OptiBrain's readers expect them. The patient
# column differs between channels, which is why it is part of the contract rather
# than a convention.
CONTRACT = {
    'Variable_premiere_frequence_cardiaque': ['encounterid', 'intime'],
    'Variable_age': ['noadmsip', 'dateofbirth'],
    'Variable_PIC': ['noadmsip', 'charttime', 'valeur'],
    'Variable_PAM': ['noadmsip', 'charttime', 'valeur'],
    'Variable_PPC': ['noadmsip', 'charttime', 'valeur'],
    'Variable_PVC': ['noadmsip', 'charttime', 'valeur'],
    'Variable_temperature': ['noadmsip', 'charttime', 'valeur'],
    'Variable_EtCO2': ['noadmsip', 'charttime', 'valeur'],
    'Variable_paco2': ['noadmsip', 'charttime', 'valeur'],
    'Variable_position_tete': ['noadmsip', 'charttime', 'valeur'],
    'Variable_pupille_droite': ['noadmsip', 'charttime', 'valeur'],
    'Variable_pupille_gauche': ['noadmsip', 'charttime', 'valeur'],
    'Variable_glycemie': ['noadmsip', 'charttime', 'valeur'],
    'Variable_INR': ['noadmsip', 'charttime', 'valeur'],
    'Variable_hemoglobine': ['noadmsip', 'charttime', 'valeur'],
    'Variable_plaquettes': ['noadmsip', 'charttime', 'valeur'],
    'Variable_plasma': ['noadmsip', 'charttime', 'plasma'],
    'Variable_culot_globulaire': ['encounterid', 'charttime', 'valeur'],
    'Variable_concentre_plaquettaire': ['encounterid', 'datevariable', 'valeur'],
    'Variable_nutrition': ['noadmsip', 'charttime', 'longlabel'],
    'Variable_opioides': ['noadmsip', 'charttime', 'variable', 'valeur', 'drugname'],
    'Variable_hypnotiques': ['noadmsip', 'charttime', 'variable', 'valeur', 'drugname'],
    'Variable_anti_epileptique': ['noadmsip', 'charttime', 'drugname'],
}

# Harvested variable_key -> OptiBrain channel, where the names differ.
# Harvested variable_key -> OptiBrain channel. Only the names that differ need to
# appear; the rest are identical on both sides. Deriving the identity entries
# from CONTRACT keeps the two lists from drifting apart.
KEY_MAP = {name: name for name in CONTRACT}
KEY_MAP.update({
    'Variable_PAM': 'Variable_PAM',
})

TIMESTAMP = '%Y-%m-%d %H:%M:%S'


def _encounter(patient_id):
    """App patient id to a bare encounter id."""
    return str(patient_id).removeprefix('#')


def _stamp(value):
    if isinstance(value, datetime):
        return value.strftime(TIMESTAMP)
    return '' if value is None else str(value)


def _json_value(value):
    if isinstance(value, Decimal):
        value = float(value)
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


def build_payload(harvest, demographics):
    """Return all indicator channels as JSON-compatible column records."""
    series: dict[str, list] = {name: [] for name in CONTRACT}
    for patient_id, key, charttime, value in harvest.get('vitals', []):
        target = KEY_MAP.get(key)
        if target:
            series[target].append((patient_id.lstrip('#'), _stamp(charttime), value))

    # Heart rate is a monitor channel, not an indicator input, and OptiBrain's
    # completeness check does not list it. It is read here only to establish
    # the timeline origin below.

    # Bootstrap 1: the origin of the 96-hour timeline. OptiBrain reads the
    # first charted heart rate, and falls back to nothing when it is absent.
    first_heart_rate: dict[str, str] = {}
    for patient_id, key, charttime, _ in harvest.get('vitals', []):
        if key == 'Variable_FC':
            first_heart_rate.setdefault(patient_id.lstrip('#'), _stamp(charttime))
    admitted = demographics.get('intime', {})
    series['Variable_premiere_frequence_cardiaque'] = [
        (pid, first_heart_rate.get(pid) or _stamp(admitted.get(pid)))
        for pid in sorted(admitted)
        if first_heart_rate.get(pid) or admitted.get(pid)
    ]

    # Bootstrap 2: age band for the PPC target. Missing date of birth would
    # otherwise fail every patient in the ward.
    births = demographics.get('dateofbirth', {})
    series['Variable_age'] = [
        (pid, _stamp(births.get(pid)).replace(' 00:00:00', ''))
        for pid in sorted(births) if births.get(pid)
    ]

    # Pupils are charted as one free-text field. OptiBrain's pupil indicators
    # only test for presence, so the numeric diameter is what matters here.
    for patient_id, key, charttime, raw, _flags in harvest.get('pupils', []):
        diameter = next(
            (v for pid, k, _t, v in harvest.get('vitals', [])
             if pid == patient_id and k == key),
            None,
        )
        if diameter is not None:
            series[key].append((patient_id.lstrip('#'), _stamp(charttime), diameter))

    for patient_id, kind, drugname, charttime, dose in harvest.get('medications', []):
        channel = 'Variable_' + kind
        if channel not in series:
            # Inotropes and vasopressors have no indicator in this pipeline;
            # they are carried for the dashboard rather than for adherence.
            continue
        if channel == 'Variable_anti_epileptique':
            # This indicator only checks that a drug was given, by name.
            series[channel].append((patient_id.lstrip('#'), _stamp(charttime), drugname))
        else:
            # Opioid and sedative indicators look at the infusion rate and
            # ignore entries that are not one.
            series[channel].append(
                (patient_id.lstrip('#'), _stamp(charttime), 'debit', dose, drugname))

    # Three indicators treat a recent transfusion or feed as evidence that a
    # lab value is still current. Without these rows every stale lab is judged
    # non-adherent.
    transfers = harvest.get('transfusions') or {}
    for patient_id, charttime, text in transfers.get('plasma', []):
        series['Variable_plasma'].append((patient_id.lstrip('#'), _stamp(charttime), text))
    for patient_id, charttime, text in transfers.get('red_cells', []):
        series['Variable_culot_globulaire'].append((patient_id.lstrip('#'), _stamp(charttime), text))
    for patient_id, charttime, text in transfers.get('platelets', []):
        series['Variable_concentre_plaquettaire'].append((patient_id.lstrip('#'), _stamp(charttime), text))
    for patient_id, charttime, label in transfers.get('nutrition', []):
        series['Variable_nutrition'].append((patient_id.lstrip('#'), _stamp(charttime), label))

    return {
        name: [
            {column: _json_value(value) for column, value in zip(header, row)}
            for row in series[name]
        ]
        for name, header in CONTRACT.items()
    }


# ----------------------------------------------------------------------
# Autoregulation channels
#
# These follow a different path from the adherence indicators: OptiBrain reads
# them, merges each patient's channels into one frame, and fits the correlation
# index against pressure. The column name doubles as the alias the module
# renames onto, so it has to match exactly.
# ----------------------------------------------------------------------
AUTOREG_CONTRACT = {
    'Variable_PIC_autoreg': ['noadmsip', 'horodate', 'PIC'],
    'Variable_PPC_autoreg': ['noadmsip', 'horodate', 'PPC'],
    'Variable_PAM_autoreg': ['noadmsip', 'horodate', 'PAM'],
    'Variable_NIRS_autoreg': ['noadmsip', 'horodate', 'NIRS'],
    'Variable_licox_autoreg': ['noadmsip', 'horodate', 'Licox'],
    'Variable_fc_autoreg': ['noadmsip', 'horodate', 'FC'],
    'Variable_spo2_autoreg': ['noadmsip', 'horodate', 'SpO2'],
}


def build_autoreg_payload(series, patients):
    """Return autoregulation channels as JSON-compatible column records."""
    payload = {}
    wanted = (
        {str(int(str(patient).removeprefix('#'))) for patient in patients}
        if patients else None
    )
    for name, header in AUTOREG_CONTRACT.items():
        channel = header[-1]
        # The arterial line and the cuff measure the same quantity. This cohort
        # is monitored on the line, which is the more accurate source.
        if channel == 'PAM':
            arterial = [(p, _stamp(t), v) for p, c, t, v in series if c == 'PAM']
            arterial_patients = {p for p, _, _ in arterial}
            cuff = [(p, _stamp(t), v) for p, c, t, v in series
                    if c == 'PAM_cuff' and p not in arterial_patients]
            matched = arterial + cuff
        else:
            matched = [(p, _stamp(t), v) for p, c, t, v in series if c == channel]
        # The encounter id is written bare. The module filters each channel on
        # the integer, so a '#'-prefixed value silently matches nothing and
        # every analysis comes back empty.
        rows = [(_encounter(p), stamp, value) for p, stamp, value in matched
                if wanted is None or _encounter(p) in wanted]
        payload[name] = [
            {column: _json_value(value) for column, value in zip(header, row)}
            for row in rows
        ]
    return payload
