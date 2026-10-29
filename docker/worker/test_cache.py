import unittest
from datetime import datetime
from unittest.mock import patch

from cache import clinical_rows, datasets, instant, medication_rows, numeric, vitals_rows
import queries


def harvest(vitals=(), medications=(), pupils=(), notes=()):
    return {'vitals': list(vitals), 'medications': list(medications),
            'pupils': list(pupils), 'notes': list(notes)}


class PupilParsingTests(unittest.TestCase):
    """A pupil is stored as '<diameter> mm <flags>': a number plus a category.

    Before this the text failed numeric() and every row landed in the vitals
    table with a null value, so the UI could show neither a size nor a range.
    """

    def test_diameter_and_flags_are_separated(self):
        self.assertEqual(queries.parse_pupil('2 mm RB'), (2.0, 'RB'))
        self.assertEqual(queries.parse_pupil('3 mm RL'), (3.0, 'RL'))
        self.assertEqual(queries.parse_pupil('4mm'), (4.0, None))
        self.assertEqual(queries.parse_pupil('1,5 mm'), (1.5, None))

    def test_unparseable_text_is_kept_verbatim(self):
        self.assertEqual(queries.parse_pupil('impossible'), (None, 'impossible'))
        self.assertEqual(queries.parse_pupil('Oeil couche de soleil'), (None, 'Oeil couche de soleil'))
        self.assertEqual(queries.parse_pupil(''), (None, None))
        self.assertEqual(queries.parse_pupil(None), (None, None))

    def test_diameter_is_numeric_and_raw_text_is_preserved(self):
        rows = vitals_rows(harvest(vitals=[('#1', 'Variable_pupille_droite', '2026-01-01', 2.0)]))
        self.assertEqual(rows[0][3], numeric(2.0))
        stored = clinical_rows(harvest(pupils=[('#1', 'Variable_pupille_droite',
                                                 '2026-01-01', '2 mm RB', 'RB')]))
        payload = stored[0][2].obj
        self.assertEqual(payload['valeur'], '2 mm RB')
        self.assertEqual(payload['reactivity'], 'RB')

    def test_unparseable_pupil_produces_no_vital_row(self):
        rows = vitals_rows(harvest(pupils=[('#1', 'Variable_pupille_droite', '2026-01-01', 'x', 'x')]))
        self.assertEqual(rows, [])
        self.assertEqual(len(clinical_rows(harvest(pupils=[('#1', 'Variable_pupille_droite',
                                                           '2026-01-01', 'impossible', 'impossible')]))), 1)


class BatchMappingTests(unittest.TestCase):
    def test_harvest_maps_onto_the_existing_tables(self):
        data = datasets(harvest(
            vitals=[('#1', 'Variable_FC', '2026-01-01', 120.0)],
            medications=[('#1', 'inotropes_vasopresseurs', 'Noradrenaline', '2026-01-01', '0.15')],
            notes=[('#1', '2026-01-01', 'patient calme')]))
        self.assertEqual([d[0] for d in data],
                         ['patient_vitals', 'patient_medications', 'patient_clinical_info'])
        self.assertEqual(vitals_rows(harvest(vitals=[('#1', 'Variable_FC', '2026-01-01', 120.0)]))[0][1],
                         'Variable_FC')
        # The new inotrope class maps to its own medication_type, not an existing one.
        self.assertEqual(medication_rows(harvest(medications=[
            ('#1', 'inotropes_vasopresseurs', 'Noradrenaline', '2026-01-01', '0.15')]))[0][1],
            'inotropes_vasopresseurs')

    @patch('queries._rows', return_value=[(16997, datetime(2026, 10, 28, 12), 'rSO2-1', 68.5)])
    def test_nirs_monitor_channel_maps_to_frontend_rso2_key(self, rows):
        mapped = queries.monitor(None, [16997], datetime(2026, 10, 27), datetime(2026, 10, 25))

        self.assertEqual(mapped, [
            ('#16997', 'Variable_rSO2', datetime(2026, 10, 28, 12), 68.5),
        ])
        self.assertIn('rSO2-1', rows.call_args.args[2][2])

    def test_non_numeric_vitals_are_dropped_rather_than_written_as_null(self):
        rows = vitals_rows(harvest(vitals=[('#1', 'Variable_x', '2026-01-01', 'impossible')]))
        self.assertEqual(rows, [])

    def test_naive_time_and_explicit_offset(self):
        self.assertEqual(instant('2026-01-01T12:00:00').utcoffset().total_seconds(), -18000)
        self.assertEqual(instant('2026-07-01T12:00:00').utcoffset().total_seconds(), -14400)
        self.assertEqual(instant('2026-01-01T12:00:00Z').utcoffset().total_seconds(), 0)

    def test_numeric_rejects_nan_and_handles_decimal_comma(self):
        self.assertIsNone(numeric('NaN'))
        self.assertEqual(float(numeric('3,5')), 3.5)
        self.assertIsNone(numeric(''))


if __name__ == '__main__':
    unittest.main()