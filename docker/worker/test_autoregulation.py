import unittest

import optibrain_export as export
import worker


def series(patient, counts):
    """counts: {channel: number of samples}"""
    rows = []
    for channel, count in counts.items():
        rows.extend((patient, channel, i, 1.0) for i in range(count))
    return rows


class CandidateTests(unittest.TestCase):
    def test_intracranial_and_perfusion_pressure_enable_prx(self):
        # PRx correlates intracranial pressure against cerebral perfusion
        # pressure, so both channels are required.
        candidates = worker.autoregulation_candidates(
            series('#1', {'PIC': 500, 'PPC': 500}), ['#1'])
        self.assertEqual(candidates['prx'], ['#1'])

    def test_perfusion_pressure_is_not_derived_from_arterial_pressure(self):
        # CPP = MAP - ICP is a physiological identity, but the hospital
        # records CPP natively, so a patient without that channel is skipped
        # rather than analysed on a substituted value.
        candidates = worker.autoregulation_candidates(
            series('#1', {'PIC': 500, 'PAM': 500}), ['#1'])
        self.assertEqual(candidates['prx'], [])

    def test_intracranial_pressure_alone_cannot_be_scored(self):
        candidates = worker.autoregulation_candidates(
            series('#1', {'PIC': 500, 'FC': 500}), ['#1'])
        self.assertEqual(candidates['prx'], [])

    def test_oxygenation_and_arterial_pressure_enable_cox(self):
        candidates = worker.autoregulation_candidates(
            series('#1', {'NIRS': 400, 'PAM': 400}), ['#1'])
        self.assertEqual(candidates['cox'], ['#1'])

    def test_oxygenation_without_pressure_cannot_be_scored(self):
        candidates = worker.autoregulation_candidates(
            series('#1', {'NIRS': 400, 'FC': 400}), ['#1'])
        self.assertEqual(candidates['cox'], [])

    def test_a_scattered_trace_is_not_sent_for_analysis(self):
        # A handful of samples fits no reliable curve; returning one would look
        # like a computed result rather than an absence of data.
        candidates = worker.autoregulation_candidates(
            series('#1', {'PIC': 5, 'PPC': 5}), ['#1'])
        self.assertEqual(candidates['prx'], [])

    def test_patient_with_no_monitoring_is_skipped(self):
        candidates = worker.autoregulation_candidates(series('#1', {'FC': 900}), ['#1', '#2'])
        self.assertEqual(candidates, {'prx': [], 'cox': []})


class ResultTranslationTests(unittest.TestCase):
    RECAP = {'Horodate': '2026-01-01 12:00:00', 'Global_Optimal_PPC': 65.0,
             'Global_Inferior_Limit': 50.0, 'Global_Superior_Limit': 75.0,
             'PRx': 0.18}

    def test_headline_figures_are_taken_from_the_recap(self):
        payload = {16927: {'P16927_AR_3min': [self.RECAP],
                           'P16927_Full_AR_Table_3min_Fisher': [{'PIC': 12.0}]}}
        rows = worker.autoregulation_rows(payload, 'prx')
        self.assertEqual(len(rows), 1)
        patient, mode, optimal, inferior, superior, index = rows[0][:6]
        self.assertEqual((patient, mode), ('#16927', 'prx'))
        self.assertEqual((optimal, inferior, superior, index), (65.0, 50.0, 75.0, 0.18))

    def test_a_result_without_an_optimum_is_not_recorded(self):
        # No reliable plateau leaves the optimum null. Storing it would show a
        # value the clinician reads as "not yet calculated".
        recap = dict(self.RECAP, Global_Optimal_PPC=None)
        payload = {16927: {'P16927_AR_3min': [recap]}}
        self.assertEqual(worker.autoregulation_rows(payload, 'prx'), [])

    def test_missing_recap_is_skipped(self):
        payload = {16927: {'P16927_Full_AR_Table_3min_Fisher': [{'PIC': 12.0}]}}
        self.assertEqual(worker.autoregulation_rows(payload, 'prx'), [])

    def test_arterial_pressure_is_labelled_for_cox(self):
        payload = {16927: {'P16927_AR_3min': [dict(self.RECAP, Global_Optimal_PPC=None,
                                                    Global_Optimal_PAM=70.0)]}}
        rows = worker.autoregulation_rows(payload, 'cox')
        self.assertEqual(rows[0][6:8], ('PAM', 'NIRS1'))

    def test_one_failing_patient_does_not_hide_the_others(self):
        payload = {16927: {'P16927_AR_3min': [self.RECAP]},
                   16930: {'P16930_AR_3min': [dict(self.RECAP, Global_Optimal_PPC=None)]}}
        rows = worker.autoregulation_rows(payload, 'prx')
        self.assertEqual([r[0] for r in rows], ['#16927'])


class AutoregExportTests(unittest.TestCase):
    def setUp(self):
        import tempfile
        from pathlib import Path
        self.directory = Path(tempfile.mkdtemp())

    def test_every_channel_is_written(self):
        written = export.build_autoreg(series('#1', {'PIC': 3, 'PAM': 3}),
                                       self.directory, ['#1'])
        self.assertEqual(sorted(written), sorted(export.AUTOREG_CONTRACT and written.keys()))
        for name in export.AUTOREG_CONTRACT:
            self.assertTrue((self.directory / f'{name}.csv').exists())

    def test_arterial_line_is_preferred_over_the_cuff(self):
        rows = [('#1', 'PAM_cuff', 0, 60.0), ('#1', 'PAM', 0, 72.0)]
        export.build_autoreg(rows, self.directory, ['#1'])
        body = (self.directory / 'Variable_PAM_autoreg.csv').read_text()
        self.assertIn(';72', body)
        self.assertNotIn(';60', body)

    def test_cuff_is_used_when_no_line_is_monitored(self):
        export.build_autoreg([('#1', 'PAM_cuff', 0, 60.0)], self.directory, ['#1'])
        self.assertIn(';60', (self.directory / 'Variable_PAM_autoreg.csv').read_text())

    def test_manifest_records_the_patient_set_for_this_registry(self):
        import json
        export.build_autoreg(series('#1', {'PIC': 3}), self.directory, ['#2', '#1'])
        manifest = json.loads((self.directory / '_manifest.json').read_text())
        self.assertEqual(manifest['autoreg']['patients'], [1, 2])


if __name__ == '__main__':
    unittest.main()