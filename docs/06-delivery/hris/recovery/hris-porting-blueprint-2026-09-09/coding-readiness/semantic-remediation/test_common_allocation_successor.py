"""AUTHOR structural tests. Original registers/SQL remain read-only."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('allocation', HERE / 'validate_common_allocation_successor.py')
allocation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(allocation)


class AllocationSuccessorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.doc = allocation.strict_load(HERE / 'common-allocation-successor.v1.json')
        cls.predecessor, cls.slices = allocation.inputs(cls.doc)
        cls.groups = cls.predecessor['gitOnlyInventory']['streams']

    def check(self, doc):
        return allocation.structure(doc, self.predecessor, self.slices, self.groups)

    def test_current_candidate_has_exact_predecessor_ids_test_refs_and_filenames(self):
        result = self.check(self.doc)
        self.assertEqual(result['exactSliceReservations'], 105)
        self.assertEqual(result['exactCommonReservations'], 6)
        self.assertEqual(result['legacyPublicRoutingStillOpen'], 12)

    def test_published_machine_readable_negative_cases(self):
        cases = allocation.strict_load(HERE / 'common-allocation-successor.fixtures.v1.json')['fixtures']
        self.assertEqual(len({x['caseId'] for x in cases}), len(cases))
        for case in cases:
            with self.subTest(case=case['caseId']):
                doc = copy.deepcopy(self.doc)
                key = 'streamKey' if case['collection'] == 'streams' else 'reservationId'
                row = next(x for x in doc[case['collection']] if x[key] == case['identity'])
                row[case['field']] = case['value']
                with self.assertRaises(ValueError):
                    self.check(doc)

    def test_schema_version_boolean_rejected(self):
        doc = copy.deepcopy(self.doc)
        doc['schemaVersion'] = True
        with self.assertRaises(ValueError):
            self.check(doc)

    def test_missing_slice_rejected(self):
        doc = copy.deepcopy(self.doc)
        doc['moduleReservations'].pop()
        with self.assertRaises(ValueError):
            self.check(doc)

    def test_duplicate_slice_rejected(self):
        doc = copy.deepcopy(self.doc)
        doc['moduleReservations'].append(copy.deepcopy(doc['moduleReservations'][0]))
        with self.assertRaises(ValueError):
            self.check(doc)

    def test_untracked_extra_common_reservation_rejected(self):
        doc = copy.deepcopy(self.doc)
        row = copy.deepcopy(doc['commonReservations'][0])
        row['reservationId'] = 'SC-PHANTOM'
        doc['commonReservations'].append(row)
        with self.assertRaises(ValueError):
            self.check(doc)

    def test_wrong_private_history_rejected(self):
        doc = copy.deepcopy(self.doc)
        row = next(x for x in doc['streams'] if x['streamKey'] == 'platform-hris-protected')
        row['historyTable'] = 'flyway_schema_history'
        with self.assertRaises(ValueError):
            self.check(doc)

    def test_insights_query_cannot_be_writer(self):
        doc = copy.deepcopy(self.doc)
        row = next(x for x in doc['streams'] if x['streamKey'] == 'platform-hris-insights')
        row['runtimePrincipals'][1]['readOnly'] = False
        with self.assertRaises(ValueError):
            self.check(doc)

    def test_payroll_default_change_rejected(self):
        doc = copy.deepcopy(self.doc)
        doc['payrollDefault']['schema'] = 'payroll'
        with self.assertRaises(ValueError):
            self.check(doc)

    def test_wrong_capacity_or_spare_rejected(self):
        doc = copy.deepcopy(self.doc)
        doc['ranges'][0]['unusedVersions'].append(99)
        with self.assertRaises(ValueError):
            self.check(doc)

    def test_private_membership_or_blanket_grants_cannot_be_declared(self):
        doc = copy.deepcopy(self.doc)
        row = next(x for x in doc['streams'] if x['streamKey'] == 'platform-hris-insights')
        row['runtimePrincipals'][0]['objectGrants'] = 'ALL_TABLES'
        with self.assertRaises(ValueError):
            self.check(doc)

    def test_original_notification_numeric_gap_is_not_missing_source(self):
        oracle = allocation.load_oracle()
        oracle.require_unique_versions(['V26__a.sql', 'V28__b.sql'])

    def test_multipart_version_alias_is_collision(self):
        oracle = allocation.load_oracle()
        with self.assertRaises(ValueError):
            oracle.require_unique_versions(['V213__a.sql', 'V0213_0__b.sql'])

    def test_readiness_claim_rejected(self):
        doc = copy.deepcopy(self.doc)
        doc['readinessPass'] = True
        with self.assertRaises(ValueError):
            self.check(doc)

    def test_allocator_business_key_relabel_rejected(self):
        doc = copy.deepcopy(self.doc)
        row = next(x for x in doc['commonReservations'] if x['reservationId'] == 'SC-PEOPLE-NATIVE-EMPLOYER-UUID')
        row['nativeColumnProposal']['default'] = 'employer_key::uuid'
        with self.assertRaises(ValueError):
            self.check(doc)

    def test_hrm_cannot_consume_common_people49(self):
        doc = copy.deepcopy(self.doc)
        row = next(x for x in doc['moduleReservations'] if x['reservationId'] == 'SA-BASE-TFR-HRM-001')
        row['version'] = 49
        row['exactFilename'] = row['exactFilename'].replace('V50__', 'V49__')
        with self.assertRaises(ValueError):
            self.check(doc)

    def test_missing_current_register_pin_rejected(self):
        doc = copy.deepcopy(self.doc)
        doc['sourcePins'].pop()
        with self.assertRaises(ValueError):
            allocation.inputs(doc)

    def test_mixed_executable_dialect_rejected(self):
        doc = copy.deepcopy(self.doc)
        doc['operationBindings'] = []
        with self.assertRaises(ValueError):
            self.check(doc)

    def test_new_unallocated_registered_schema_touch_rejected(self):
        slices = copy.deepcopy(self.slices)
        row = copy.deepcopy(next(x for x in slices.values() if x['planned_migration_file'] != 'NO_MIGRATION_RETIRED'))
        row['slice_id'] = 'NEW-UNALLOCATED-SLICE'
        slices[row['slice_id']] = row
        with self.assertRaises(ValueError):
            allocation.structure(self.doc, self.predecessor, slices, self.groups)

    def test_common_wce_not_module_sys_writer(self):
        doc = copy.deepcopy(self.doc)
        row = next(x for x in doc['commonReservations'] if x['reservationId'] == 'SC-WCE-REGISTRY')
        row['writerRole'] = 'ROLE.HRIS_SYS_ENGINEERING'
        with self.assertRaises(ValueError):
            self.check(doc)


if __name__ == '__main__':
    unittest.main()
