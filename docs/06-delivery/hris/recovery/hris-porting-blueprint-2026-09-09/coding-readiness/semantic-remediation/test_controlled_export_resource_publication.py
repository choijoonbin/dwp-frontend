"""AUTHOR resource policy model tests; no DB/SQL/auth framework execution."""
import copy
import importlib.util
from pathlib import Path
import unittest

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('wce_publication', HERE / 'validate_controlled_export_resource_publication.py')
wce = importlib.util.module_from_spec(spec)
spec.loader.exec_module(wce)


class ControlledExportPublicationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.doc = wce.load(HERE / 'controlled-export-resource-publication.proposal.v1.json')
        cls.fixtures = wce.load(HERE / 'controlled-export-resource-publication.fixtures.v1.json')
        cls.sql = (HERE / 'controlled-export-resource-publication.plan.v1.sql').read_text()

    def test_author_proposal_and_model_contract(self):
        result = wce.verify(self.doc)
        self.assertEqual(result['syntheticCases'], 21)
        self.assertFalse(result['readinessPass'])
        self.assertFalse(result['sqlApplied'])

    def test_21_published_synthetic_cases(self):
        self.assertEqual(len(wce.fixture_checks(self.fixtures)), 21)

    def test_factory_active_mutation_rejected(self):
        doc = copy.deepcopy(self.doc)
        doc['lifecycle']['legacyFactory']['policy'] = 'ACTIVE_FACTORY_PUBLISHED'
        with self.assertRaises(ValueError):
            wce.verify(doc)

    def test_grant_or_activation_policy_mutations_rejected(self):
        for flag in ['noAutomaticPermissionGrants', 'noDefaultUserOrRoleAssignment', 'noAppGrantCloning',
            'noDutiesOrPackages', 'noActivationPointers', 'noGuardChanges']:
            with self.subTest(flag=flag):
                doc = copy.deepcopy(self.doc)
                doc['authorization'][flag] = False
                with self.assertRaises(ValueError):
                    wce.verify(doc)

    def test_native_false_claim_rejected(self):
        doc = copy.deepcopy(self.doc)
        doc['artifact']['executed'] = True
        with self.assertRaises(ValueError):
            wce.verify(doc)

    def test_schema_boolean_not_version(self):
        doc = copy.deepcopy(self.doc)
        doc['schemaVersion'] = True
        with self.assertRaises(ValueError):
            wce.verify(doc)

    def test_wrong_allocation_rejected(self):
        doc = copy.deepcopy(self.doc)
        doc['allocation']['version'] = 214
        with self.assertRaises(ValueError):
            wce.verify(doc)

    def test_sql_auto_reenable_or_privilege_ddl_rejected(self):
        for attack in ['UPDATE public.com_resources SET enabled=TRUE;',
            'GRANT SELECT ON public.com_resources TO unsafe;', 'CREATE TABLE public.unsafe(id bigint);',
            'DELETE FROM public.com_role_permissions;', 'SET ROLE dwp_user;']:
            with self.subTest(attack=attack):
                with self.assertRaises(ValueError):
                    wce.artifact_lint(self.sql + '\n' + attack)

    def test_sql_factory_active_rejected(self):
        with self.assertRaises(ValueError):
            wce.artifact_lint(self.sql + "\nINSERT INTO public.sys_tenant_resource_templates(resource_key) VALUES ('unsafe');")

    def test_sql_lock_order_rejected(self):
        with self.assertRaises(ValueError):
            wce.artifact_lint(self.sql.replace('LOCK TABLE public.com_resources IN SHARE ROW EXCLUSIVE MODE;', ''))

    def test_duplicate_fixture_not_extra_evidence(self):
        doc = copy.deepcopy(self.fixtures)
        doc['fixtures'].append(copy.deepcopy(doc['fixtures'][0]))
        with self.assertRaises(ValueError):
            wce.fixture_checks(doc)

    def test_historical_pin_substitution_rejected(self):
        doc = copy.deepcopy(self.doc)
        doc['inputPins'][0]['sha256'] = '0' * 64
        with self.assertRaises(ValueError):
            wce.verify(doc)


if __name__ == '__main__':
    unittest.main()
