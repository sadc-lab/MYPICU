import unittest
from unittest.mock import MagicMock, patch
from modules import SyncModule, enabled_modules, load_modules
from worker import format_weight, run_sync, sync_batch


class ModuleRegistryTests(unittest.TestCase):
    def test_selects_configured_modules_in_order(self):
        first = SyncModule('first', lambda *_: None)
        second = SyncModule('second', lambda *_: None)
        self.assertEqual(enabled_modules([first, second], 'second,first'),
                         [second, first])

    def test_unknown_module_fails_explicitly(self):
        with self.assertRaisesRegex(ValueError, 'Unregistered sync module'):
            enabled_modules([], 'missing')

    def test_duplicate_module_fails_explicitly(self):
        module = SyncModule('first', lambda *_: None)
        with self.assertRaisesRegex(ValueError, 'duplicate'):
            enabled_modules([module], 'first,first')

    def test_duplicate_registration_fails_explicitly(self):
        module = SyncModule('first', lambda *_: None)
        with self.assertRaisesRegex(ValueError, 'registry contains duplicate'):
            enabled_modules([module, module], 'first')

    def test_adapter_loads_by_module_name(self):
        self.assertEqual([module.name for module in load_modules('optibrain')],
                         ['optibrain'])

    def test_unknown_adapter_fails_explicitly(self):
        with self.assertRaisesRegex(ValueError, 'Unregistered sync module'):
            load_modules('missing')


class WeightFormattingTests(unittest.TestCase):
    """valuenumber arrives as 59.00000000000000; the UI showed it verbatim."""

    def test_weight_is_rounded_for_display(self):
        self.assertEqual(format_weight('59.00000000000000'), '59 kg')
        self.assertEqual(format_weight('10.26000000000000'), '10.3 kg')
        self.assertEqual(format_weight(23.5), '23.5 kg')
        self.assertEqual(format_weight(4.0), '4 kg')


def census_mock(rows):
    def execute(statement, args=()):
        if 'pg_try_advisory_lock' in statement:
            result = MagicMock()
            result.fetchone.return_value = {'locked': True}
            return result
        if 'SELECT module_name, patient_id FROM integration.module_sync_state' in statement:
            return [{'module_name': 'optibrain', 'patient_id': pid} for pid in rows]
        return [{'patient_id': pid} for pid in rows]
    return execute


class SyncBatchTests(unittest.TestCase):
    """The harvest is now one batch for the whole ward, not one call per patient."""

    @patch('optibrain_module.request_indicators', return_value={'matrices_rt_PICData_validite': [{'id_patient': 1, 'H0': 0}]})
    @patch('optibrain_module.optibrain_export.build_payload', return_value={})
    @patch('worker.demographics', return_value={'intime': {}, 'dateofbirth': {}})
    @patch('worker.local')
    @patch('worker.refresh_census', return_value=['#1', '#2', '#3'])
    @patch('worker.queries.harvest', return_value={'vitals': [], 'medications': [], 'pupils': [], 'notes': []})
    @patch('worker.replace_cache', return_value=10)
    def test_one_harvest_for_the_whole_ward(self, cache, harvest, census, local, demo, export, indicators):
        db = local.return_value.__enter__.return_value
        db.execute.side_effect = census_mock(['#1', '#2'])
        result = run_sync()
        self.assertEqual(result['status'], 'completed')
        self.assertEqual(result['refreshed'], 3)
        # A single batched harvest, not one per patient.
        harvest.assert_called_once()
        self.assertEqual(sorted(harvest.call_args.args[0]), ['#1', '#2', '#3'])
        cache.assert_called_once()

    @patch('optibrain_module.request_indicators', return_value={})
    @patch('optibrain_module.optibrain_export.build_payload', return_value={})
    @patch('worker.demographics', return_value={'intime': {}, 'dateofbirth': {}})
    @patch('worker.local')
    @patch('worker.refresh_census', return_value=['#1', '#2'])
    @patch('worker.queries.harvest', return_value={'vitals': [], 'medications': [], 'pupils': [], 'notes': []})
    @patch('worker.replace_cache', return_value=10)
    def test_restart_skips_fresh_patients_but_on_demand_refreshes_them(self, cache, harvest, census, local, demo, export, indicators):
        db = local.return_value.__enter__.return_value
        # Only #1 synced recently, so a resumed cycle refreshes just #2.
        db.execute.side_effect = census_mock(['#1'])
        self.assertEqual(run_sync(force=False)['status'], 'completed')
        self.assertEqual(harvest.call_args.args[0], ['#2'])
        harvest.reset_mock()
        # A forced run ignores freshness and refreshes the whole ward.
        self.assertEqual(run_sync()['status'], 'completed')
        self.assertEqual(sorted(harvest.call_args.args[0]), ['#1', '#2'])

    @patch('optibrain_module.request_indicators', return_value={})
    @patch('optibrain_module.optibrain_export.build_payload', return_value={})
    @patch('worker.demographics', return_value={'intime': {}, 'dateofbirth': {}})
    @patch('worker.local')
    @patch('worker.refresh_census', return_value=[])
    @patch('worker.queries.harvest', return_value={'vitals': [], 'medications': [], 'pupils': [], 'notes': []})
    def test_empty_census_does_not_query_the_source(self, harvest, census, local, demo, export, indicators):
        local.return_value.__enter__.return_value.execute.side_effect = census_mock([])
        result = run_sync()
        self.assertEqual(result, {'status': 'completed', 'current_patients': 0, 'refreshed': 0})
        harvest.assert_not_called()

    @patch('optibrain_module.request_indicators', return_value={})
    @patch('optibrain_module.optibrain_export.build_payload', return_value={})
    @patch('worker.demographics', return_value={'intime': {}, 'dateofbirth': {}})
    @patch('worker.local')
    @patch('worker.queries.harvest', side_effect=RuntimeError('source down'))
    def test_source_failure_preserves_existing_cache(self, harvest, local, demo, export, indicators):
        db = local.return_value.__enter__.return_value
        result = sync_batch(db, ['#1'])
        self.assertIsNone(result)
        # Cache is replaced only inside the transaction, after a successful harvest,
        # so a source fault can never truncate what is already cached.
        self.assertFalse(any('COPY' in str(c) for c in db.execute.call_args_list))


class CensusPreservationTests(unittest.TestCase):
    """A null source value must not overwrite a good cached one."""

    @patch('worker.local')
    @patch('worker.source')
    @patch('worker.Path')
    def test_missing_weight_keeps_existing_value(self, path, remote, local):
        db = local.return_value.__enter__.return_value
        path.return_value.read_text.return_value = 'SELECT 1'
        row = {'encounterid': 1, 'intime': None, 'outtime': None, 'clinicalunitid': 7,
               'name': 'Test', 'age': '5y', 'weight': None, 'bedlabel': 'B1', 'gcs': 12}
        remote.return_value.__enter__.return_value.execute.return_value.fetchall.return_value = [row]
        from worker import apply_census
        apply_census(db, [row])
        statement = [c for c in db.execute.call_args_list if 'INSERT INTO public.patients' in str(c)][0]
        sql = statement.args[0]
        self.assertIn("NULLIF(excluded.weight,'—')", sql)
        self.assertIn('COALESCE(excluded.gcs, patients.gcs)', sql)


if __name__ == '__main__':
    unittest.main()