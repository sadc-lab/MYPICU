"""Read-only source checks. Output counts/permissions, never patient details."""
import os
import psycopg

# Every table the batch harvest reads. This list was previously a subset of the
# real dependency set, which hid usable sources (pttreatment, ptsitecare,
# pttotalbalance, ptintervention) behind an unverified-access assumption and let
# scope be cut on data that was in fact readable.
SOURCE_TABLES = [
    'ptcensus',          # census, admission and discharge
    'd_encounter',       # demographics
    'ptbedstay',         # bed label
    'ptassessment',      # temperature, GCS, pupils, weight
    'ptlabresult',       # haemoglobin, platelets, glucose, INR
    'blood_gas',         # arterial and venous gases, lactate
    'icca_htr',          # monitor and ventilator channels (high volume)
    'ptmedication',      # drug orders and administrations
    'ptintake',          # nutrition and transfusions
    'pttreatment',       # nurse charting, interventions
    'ptintervention',    # clinical notes
    'ptsitecare',        # devices and lines
    'pttotalbalance',    # cumulative fluid balance
    'd_attribute',       # attribute dictionary
    'd_intervention',    # intervention dictionary
]

def source():
    return psycopg.connect(host=os.environ['DB_HOST'], port=os.environ.get('DB_PORT', '5432'),
        dbname=os.environ['DB_NAME'], user=os.environ['DB_USER'], password=os.environ['DB_PASSWORD'],
        connect_timeout=10, options='-c search_path=readonly,public -c default_transaction_read_only=on -c statement_timeout=120000')

if __name__ == '__main__':
    with source() as conn:
        print('ICCA connected from container')
        print('Role connection limit:', conn.execute('SELECT rolconnlimit FROM pg_roles WHERE rolname=current_user').fetchone()[0])
        missing = [t for t in SOURCE_TABLES
                   if not conn.execute('SELECT has_table_privilege(current_user, %s, %s)',
                                       ('readonly.' + t, 'SELECT')).fetchone()[0]]
        for table in SOURCE_TABLES:
            ok = 'ok' if table not in missing else 'MISSING'
            print(table, ok)
        print('Open census encounters:', conn.execute('SELECT count(DISTINCT encounterid) FROM readonly.ptcensus WHERE outtime IS NULL').fetchone()[0])
        if missing:
            raise SystemExit(f'unreadable source tables: {missing}')