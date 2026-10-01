import unittest
from datetime import datetime
from pathlib import Path
import json
import tempfile

import optibrain_export as export
import worker


def harvest(**overrides):
    base = {'vitals': [], 'pupils': [], 'medications': [], 'notes': [],
            'transfusions': {}}
    base.update(overrides)
    return base


class ExportContractTests(unittest.TestCase):
    def setUp(self):
        self.directory = Path(tempfile.mkdtemp())

    def build(self, data, patients=('#1',), demographics=None):
        demographics = demographics or {
            'intime': {'1': datetime(2026, 9, 29, 20, 29)},
            'dateofbirth': {'1': datetime(2019, 3, 1)},
        }
        return export.build(data, demographics, self.directory, patients)

    def read(self, name):
        return (self.directory / f'{name}.csv').read_text().splitlines()

    def test_every_contract_file_is_written_even_when_empty(self):
        """OptiBrain checks for the presence of all of them; a missing file
        is indistinguishable from a failed fetch."""
        written = self.build(harvest())
        self.assertEqual(sorted(written), sorted(export.CONTRACT))
        self.assertEqual(self.read('Variable_plasma'),
                         ['noadmsip;charttime;plasma'])

    def test_columns_match_the_contract(self):
        self.build(harvest(vitals=[('#1', 'Variable_PIC', datetime(2026, 9, 29, 20, 30), 17.0)]))
        self.assertEqual(self.read('Variable_PIC'),
                         ['noadmsip;charttime;valeur', '1;2026-09-29 20:30:00;17'])
        # The patient column is `encounterid` in some files and `noadmsip` in
        # others; each reader filters on the one it expects.
        self.assertEqual(self.read('Variable_culot_globulaire')[0],
                         'encounterid;charttime;valeur')

    def test_bootstrap_files_carry_timeline_and_age(self):
        self.build(harvest(vitals=[('#1', 'Variable_FC', datetime(2026, 9, 29, 20, 29), 110.0)]))
        # Origin of the 96-hour window, and the age band for the PPC target.
        self.assertEqual(self.read('Variable_age')[1], '1;2019-03-01')
        self.assertEqual(self.read('Variable_premiere_frequence_cardiaque')[1],
                         '1;2026-09-29 20:29:00')

    def test_missing_birth_date_yields_no_age_row(self):
        self.build(harvest(), demographics={'intime': {'1': None}, 'dateofbirth': {}})
        # An empty age file fails every patient in the ward at the PPC stage.
        self.assertEqual(len(self.read('Variable_age')), 1)

    def test_pupil_uses_the_numeric_diameter(self):
        self.build(harvest(
            pupils=[('#1', 'Variable_pupille_droite', datetime(2026, 9, 29, 21, 0), '3 mm RB', 'RB')],
            vitals=[('#1', 'Variable_pupille_droite', datetime(2026, 9, 29, 21, 0), 3.0)]))
        self.assertEqual(self.read('Variable_pupille_droite')[1], '1;2026-09-29 21:00:00;3')

    def test_medications_are_labelled_as_infusion_rates(self):
        self.build(harvest(medications=[
            ('#1', 'opioides', 'Morphine', datetime(2026, 9, 29, 21, 0), '2 mL/h'),
            ('#1', 'anti_epileptique', 'Levetiracetam', datetime(2026, 9, 29, 21, 0), '500 mg'),
        ]))
        # The opioid and sedative indicators filter on variable='debit'.
        self.assertEqual(self.read('Variable_opioides')[1],
                         '1;2026-09-29 21:00:00;debit;2 mL/h;Morphine')
        # The antiepileptic indicator only checks that a drug was given.
        self.assertEqual(self.read('Variable_anti_epileptique')[1],
                         '1;2026-09-29 21:00:00;Levetiracetam')

    def test_semicolons_are_neutralised(self):
        """Files are read with a ';' separator, so a ';' in a value would shift
        every following column into the wrong field."""
        self.build(harvest(medications=[
            ('#1', 'opioides', 'Morphine;hydromorphone', datetime(2026, 9, 29, 21, 0), '2')]))
        row = self.read('Variable_opioides')[1]
        self.assertEqual(len(row.split(';')), 5)
        self.assertIn('Morphine,hydromorphone', row)

    def test_transfusions_and_nutrition_are_exported(self):
        self.build(harvest(transfusions={
            'plasma': [('#1', datetime(2026, 9, 29, 21, 0), 'Plasma frais')],
            'red_cells': [('#1', datetime(2026, 9, 29, 21, 0), 'Culot globulaire')],
            'platelets': [('#1', datetime(2026, 9, 29, 21, 0), 'Plaquettes')],
            'nutrition': [('#1', datetime(2026, 9, 29, 21, 0), 'Alimentation entérale')],
        }))
        self.assertEqual(len(self.read('Variable_plasma')), 2)
        self.assertEqual(len(self.read('Variable_culot_globulaire')), 2)
        self.assertEqual(len(self.read('Variable_concentre_plaquettaire')), 2)
        self.assertEqual(len(self.read('Variable_nutrition')), 2)

    def test_manifest_records_the_patient_set(self):
        self.build(harvest(), patients=('#2', '#1'))
        manifest = json.loads((self.directory / '_manifest.json').read_text())
        # OptiBrain compares this set to decide whether its CSVs are current.
        self.assertEqual(manifest['iquatrace']['patients'], [1, 2])

    def test_manifest_preserves_other_registries(self):
        self.build(harvest())
        self.assertNotIn('autoreg',
                         json.loads((self.directory / '_manifest.json').read_text()))


class ValidityTranslationTests(unittest.TestCase):
    def test_zero_is_adherent_and_one_is_a_deviation(self):
        rows = worker.validity_rows(
            {'matrices_rt_PICData_validite': [{'id_patient': 1, 'H0': 0, 'H1': 1}]},
            ['#1'])
        self.assertEqual(rows, [('#1', 'PICData', 0, True), ('#1', 'PICData', 1, False)])

    def test_nested_per_patient_matrices_are_ignored(self):
        rows = worker.validity_rows(
            {'matrices_pp_1': [{'indicateur': 'PICData', 'H0': 0}]},
            ['#1'])
        self.assertEqual(rows, [])

    def test_failures_block_is_not_treated_as_a_matrix(self):
        rows = worker.validity_rows({'failures': {'1': 'ValueError'}}, ['#1'])
        self.assertEqual(rows, [])

    def test_response_for_another_encounter_is_rejected(self):
        with self.assertRaises(ValueError):
            worker.validity_rows(
                {'matrices_rt_PICData_validite': [{'id_patient': 99, 'H0': 0}]}, ['#1'])

    def test_unknown_validity_value_is_rejected(self):
        with self.assertRaises(ValueError):
            worker.validity_rows(
                {'matrices_rt_PICData_validite': [{'id_patient': 1, 'H0': None}]}, ['#1'])


if __name__ == '__main__':
    unittest.main()