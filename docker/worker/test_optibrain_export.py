import json
import unittest
from datetime import datetime
from decimal import Decimal

import optibrain_export as export
import optibrain_module


def harvest(**overrides):
    base = {'vitals': [], 'pupils': [], 'medications': [], 'notes': [],
            'transfusions': {}}
    base.update(overrides)
    return base


class IndicatorPayloadTests(unittest.TestCase):
    def demographics(self):
        return {
            'intime': {'1': datetime(2026, 9, 29, 20, 29)},
            'dateofbirth': {'1': datetime(2019, 3, 1)},
        }

    def test_every_channel_is_present_even_when_empty(self):
        payload = export.build_payload(harvest(), self.demographics())
        self.assertEqual(set(payload), set(export.CONTRACT))
        self.assertTrue(all(isinstance(records, list) for records in payload.values()))
        self.assertTrue(all(not records for name, records in payload.items()
                            if name not in {'Variable_age',
                                            'Variable_premiere_frequence_cardiaque'}))

    def test_measurement_and_bootstrap_rows_match_the_input_schema(self):
        payload = export.build_payload(
            harvest(vitals=[
                ('#1', 'Variable_FC', datetime(2026, 9, 29, 20, 29), 110.0),
                ('#1', 'Variable_PIC', datetime(2026, 9, 29, 20, 30), Decimal('17.0')),
            ]),
            self.demographics(),
        )
        self.assertEqual(payload['Variable_PIC'], [{
            'noadmsip': '1', 'charttime': '2026-09-29 20:30:00', 'valeur': 17.0,
        }])
        self.assertEqual(payload['Variable_age'], [
            {'noadmsip': '1', 'dateofbirth': '2019-03-01'},
        ])
        self.assertEqual(payload['Variable_premiere_frequence_cardiaque'], [
            {'encounterid': '1', 'intime': '2026-09-29 20:29:00'},
        ])
        json.dumps(payload, allow_nan=False)

    def test_missing_birth_date_produces_an_empty_age_channel(self):
        payload = export.build_payload(
            harvest(),
            {'intime': {'1': None}, 'dateofbirth': {}},
        )
        self.assertEqual(payload['Variable_age'], [])

    def test_pupils_use_numeric_diameter_and_medications_keep_fields(self):
        payload = export.build_payload(
            harvest(
                pupils=[('#1', 'Variable_pupille_droite',
                         datetime(2026, 9, 29, 21, 0), '3 mm RB', 'RB')],
                vitals=[('#1', 'Variable_pupille_droite',
                         datetime(2026, 9, 29, 21, 0), 3.0)],
                medications=[
                    ('#1', 'opioides', 'Morphine;hydromorphone',
                     datetime(2026, 9, 29, 21, 0), '2 mL/h'),
                    ('#1', 'anti_epileptique', 'Levetiracetam',
                     datetime(2026, 9, 29, 21, 0), '500 mg'),
                ],
            ),
            self.demographics(),
        )
        self.assertEqual(payload['Variable_pupille_droite'][0]['valeur'], 3.0)
        self.assertEqual(payload['Variable_opioides'][0], {
            'noadmsip': '1', 'charttime': '2026-09-29 21:00:00',
            'variable': 'debit', 'valeur': '2 mL/h',
            'drugname': 'Morphine;hydromorphone',
        })
        self.assertEqual(payload['Variable_anti_epileptique'][0]['drugname'],
                         'Levetiracetam')
        json.dumps(payload, allow_nan=False)

    def test_transfusions_and_nutrition_are_included(self):
        payload = export.build_payload(
            harvest(transfusions={
                'plasma': [('#1', datetime(2026, 9, 29, 21, 0), 'Plasma frais')],
                'red_cells': [('#1', datetime(2026, 9, 29, 21, 0), 'Culot globulaire')],
                'platelets': [('#1', datetime(2026, 9, 29, 21, 0), 'Plaquettes')],
                'nutrition': [('#1', datetime(2026, 9, 29, 21, 0), 'Alimentation entérale')],
            }),
            self.demographics(),
        )
        self.assertEqual(payload['Variable_plasma'][0]['plasma'], 'Plasma frais')
        self.assertEqual(payload['Variable_culot_globulaire'][0]['encounterid'], '1')
        self.assertEqual(payload['Variable_concentre_plaquettaire'][0]['valeur'],
                         'Plaquettes')
        self.assertEqual(payload['Variable_nutrition'][0]['longlabel'],
                         'Alimentation entérale')


class AutoregPayloadTests(unittest.TestCase):
    def test_all_channels_are_present_and_only_requested_patients_are_sent(self):
        series = [
            ('#1', 'PIC', datetime(2026, 9, 29, 20, 30), Decimal('17.0')),
            ('#2', 'PIC', datetime(2026, 9, 29, 20, 30), Decimal('18.0')),
        ]
        payload = export.build_autoreg_payload(series, ['#1'])
        self.assertEqual(set(payload), set(export.AUTOREG_CONTRACT))
        self.assertEqual(payload['Variable_PIC_autoreg'], [{
            'noadmsip': '1', 'horodate': '2026-09-29 20:30:00', 'PIC': 17.0,
        }])
        self.assertTrue(all(not records for name, records in payload.items()
                            if name != 'Variable_PIC_autoreg'))
        json.dumps(payload, allow_nan=False)

    def test_pressure_prefers_arterial_line_and_falls_back_to_cuff_per_patient(self):
        series = [
            ('#1', 'PAM_cuff', 0, 60.0),
            ('#1', 'PAM', 0, 72.0),
            ('#2', 'PAM_cuff', 0, 65.0),
        ]
        payload = export.build_autoreg_payload(series, ['#1', '#2'])
        values = {row['noadmsip']: row['PAM']
                  for row in payload['Variable_PAM_autoreg']}
        self.assertEqual(values, {'1': 72.0, '2': 65.0})


class ValidityTranslationTests(unittest.TestCase):
    def test_zero_is_adherent_and_one_is_a_deviation(self):
        rows = optibrain_module.validity_rows(
            {'matrices_rt_PICData_validite': [{'id_patient': 1, 'H0': 0, 'H1': 1}]},
            ['#1'])
        self.assertEqual(rows, [('#1', 'PICData', 0, True), ('#1', 'PICData', 1, False)])

    def test_nested_per_patient_matrices_are_ignored(self):
        rows = optibrain_module.validity_rows(
            {'matrices_pp_1': [{'indicateur': 'PICData', 'H0': 0}]},
            ['#1'])
        self.assertEqual(rows, [])

    def test_failures_block_is_not_treated_as_a_matrix(self):
        rows = optibrain_module.validity_rows({'failures': {'1': 'ValueError'}}, ['#1'])
        self.assertEqual(rows, [])

    def test_response_for_another_encounter_is_rejected(self):
        with self.assertRaises(ValueError):
            optibrain_module.validity_rows(
                {'matrices_rt_PICData_validite': [{'id_patient': 99, 'H0': 0}]}, ['#1'])

    def test_unknown_validity_value_is_rejected(self):
        with self.assertRaises(ValueError):
            optibrain_module.validity_rows(
                {'matrices_rt_PICData_validite': [{'id_patient': 1, 'H0': None}]}, ['#1'])


if __name__ == '__main__':
    unittest.main()
