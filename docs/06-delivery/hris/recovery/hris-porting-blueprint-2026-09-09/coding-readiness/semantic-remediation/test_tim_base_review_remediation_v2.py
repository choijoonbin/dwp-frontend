#!/usr/bin/env python3
"""Actual strict TIM successor regression fixtures; author-only, never G3 PASS."""
import copy
import hashlib
import json
import os
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
import validate_tim_base_review_remediation_v2 as v


class StrictTimV2Test(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.proposal, cls.original, cls.draft = v.load_draft()
        cls.v1 = v.witnesses()[0]
        cls.query_index = next(i for i, row in enumerate(cls.draft["operationFieldLineage"])
                               if row["operationId"] == "tim.leave.entitlement.input.get")

    def revised(self):
        return copy.deepcopy(self.proposal), copy.deepcopy(self.draft)

    def codes(self, proposal, draft):
        return {row["code"] for row in v.strict_checks(proposal, draft)["errors"]}

    def load_memory(self, proposal):
        raw = json.dumps(proposal).encode()
        original_read = Path.read_bytes
        target = v.HERE / "__synthetic_v2_only_input__.json"
        def read(path):
            return raw if path == target else original_read(path)
        with patch.object(Path, "read_bytes", read):
            return v.load_draft(target)

    def test_normal_complete_witness_and_unwritten_query(self):
        report = v.strict_checks(self.proposal, self.draft)
        self.assertEqual(report["errors"], [])
        self.assertFalse(report["wholeSourceClosure"])
        self.assertFalse(report["canonicalSqlApproved"])
        query = self.draft["operationFieldLineage"][self.query_index]
        self.assertEqual(query["requiredColumnSources"], [])

    def test_cached_oracle_cannot_be_mutated_by_previous_caller(self):
        _, p, d, _ = v.witnesses()
        p["sourceRepairScope"]["unfixedExactOperationIds"] = []
        d["tableSpecifications"][0]["plannedCreateSql"] = "SELECT 1;"
        self.assertEqual(v.strict_checks(self.proposal, self.draft)["errors"], [])

    def test_joint_select1_metadata_and_phase1_rejected(self):
        p, d = self.revised()
        d["tableSpecifications"][0]["plannedCreateSql"] = "SELECT 1;"
        d["twoPhaseDdlPlan"]["phase1"][0]["sql"] = "SELECT 1;"
        self.assertIn("DDL_INVALID", self.codes(p, d))

    def test_joint_column_type_sql_and_metadata_rejected(self):
        p, d = self.revised()
        table = d["tableSpecifications"][0]
        table["columns"][0]["sqlType"] = "UUID"
        table["plannedCreateSql"] = table["plannedCreateSql"].replace("tenant_id BIGINT", "tenant_id UUID")
        d["twoPhaseDdlPlan"]["phase1"][0]["sql"] = table["plannedCreateSql"]
        self.assertIn("DDL_PHYSICAL_INVENTORY_MISMATCH", self.codes(p, d))

    def test_joint_default_sql_change_rejected(self):
        p, d = self.revised()
        table = d["tableSpecifications"][0]
        table["plannedCreateSql"] = table["plannedCreateSql"].replace("DEFAULT 0", "DEFAULT '0'")
        d["twoPhaseDdlPlan"]["phase1"][0]["sql"] = table["plannedCreateSql"]
        self.assertIn("DDL_PHYSICAL_INVENTORY_MISMATCH", self.codes(p, d))

    def test_semantic_sibling_parent_with_matching_sql_rejected(self):
        p, d = self.revised()
        table = d["tableSpecifications"][12]
        fk = table["foreignKeys"][1]
        fk["targetTable"] = "abs_entitlement_selected_items"
        fk["targetColumns"] = ["tenant_id", "input_version_id", "selected_item_id"]
        row = d["twoPhaseDdlPlan"]["phase2ForeignKeys"][27]
        row["targetTable"] = fk["targetTable"]
        row["sql"] = ("ALTER TABLE public.tme_scheduled_segments ADD CONSTRAINT tme_scheduled_segments_f1 "
                      "FOREIGN KEY (tenant_id, schedule_period_id, schedule_assignment_id) REFERENCES "
                      "public.abs_entitlement_selected_items (tenant_id, input_version_id, selected_item_id) ON DELETE RESTRICT;")
        self.assertIn("FK_SEMANTIC_PARENT_OR_POLICY_MISMATCH", self.codes(p, d))

    def test_fk_delete_policy_changed_rejected(self):
        p, d = self.revised()
        d["tableSpecifications"][12]["foreignKeys"][1]["onDelete"] = "CASCADE"
        self.assertIn("FK_SEMANTIC_PARENT_OR_POLICY_MISMATCH", self.codes(p, d))

    def test_duplicate_table_not_collapsed(self):
        p, d = self.revised()
        d["tableSpecifications"].append(copy.deepcopy(d["tableSpecifications"][0]))
        self.assertIn("TABLE_DUPLICATE", self.codes(p, d))

    def test_duplicate_operation_not_collapsed(self):
        p, d = self.revised()
        d["operationDeltas"].append(copy.deepcopy(d["operationDeltas"][0]))
        self.assertIn("OPERATION_DUPLICATE", self.codes(p, d))

    def test_duplicate_lineage_not_first_record_shadowed(self):
        p, d = self.revised()
        d["operationFieldLineage"].append(copy.deepcopy(d["operationFieldLineage"][0]))
        self.assertIn("LINEAGE_OPERATION_DUPLICATE", self.codes(p, d))

    def test_duplicate_column_not_collapsed(self):
        p, d = self.revised()
        d["tableSpecifications"][0]["columns"].append(copy.deepcopy(d["tableSpecifications"][0]["columns"][0]))
        self.assertIn("COLUMN_DUPLICATE", self.codes(p, d))

    def test_missing_lineage_scope_rejected(self):
        p, d = self.revised()
        d["operationFieldLineage"].pop()
        self.assertIn("LINEAGE_SCOPE_MISMATCH", self.codes(p, d))

    def test_empty_operation_and_graph_scopes_rejected(self):
        p, d = self.revised()
        d["operationDeltas"], d["operationFieldLineage"] = [], []
        codes = self.codes(p, d)
        self.assertIn("OPERATION_REQUIRED", codes)
        self.assertIn("LINEAGE_OPERATION_REQUIRED", codes)

    def test_joint_phantom_id_and_open_complement_rejected(self):
        p, d = self.revised()
        d["operationDeltas"][1]["operationId"] = "fake.missing.query"
        p["sourceRepairScope"]["unfixedExactOperationIds"][0] = "fake.missing.query"
        self.assertIn("OPERATION_SCOPE_MISMATCH", self.codes(p, d))

    def test_mixed_materialized_dialect_rejected(self):
        p, d = self.revised()
        d["operationBindings"] = []
        self.assertIn("UNSUPPORTED_OR_MIXED_DRAFT_DIALECT", self.codes(p, d))

    def test_unsupported_field_graph_dialect_rejected(self):
        p, d = self.revised()
        d["operationFieldLineage"][0]["dialect"] = "CANONICAL_READY"
        self.assertIn("UNSUPPORTED_FIELD_GRAPH_DIALECT", self.codes(p, d))

    def test_source_open_scope_cannot_be_claimed_closed(self):
        p, d = self.revised()
        p["sourceRepairScope"]["boundedDetailedDoesNotMeanClosed"] = False
        p["sourceRepairScope"]["unfixedSubtargetsWithinDetailed"] = []
        self.assertIn("SOURCE_OPEN_SCOPE_CHANGED", self.codes(p, d))

    def test_direct_trace_business_uuid_rejected(self):
        p, d = self.revised()
        node = d["operationFieldLineage"][0]["typedSources"][2]
        node["inputs"] = ["headers.X-Correlation-ID"]
        self.assertIn("TRACE_USED_AS_BUSINESS_SOURCE", self.codes(p, d))

    def test_indirect_trace_business_uuid_rejected(self):
        p, d = self.revised()
        graph = d["operationFieldLineage"][0]
        graph["typedSources"][2]["inputs"] = [graph["typedSources"][1]["source"]]
        graph["typedSources"][1]["inputs"] = ["headers.X-Correlation-ID"]
        self.assertIn("TRACE_USED_AS_BUSINESS_SOURCE", self.codes(p, d))

    def test_existing_trace_metadata_is_allowed(self):
        p, d = self.revised()
        self.assertNotIn("TRACE_USED_AS_BUSINESS_SOURCE", self.codes(p, d))

    def test_phantom_source_column_rejected(self):
        p, d = self.revised()
        d["operationFieldLineage"][0]["sourceLeaves"][11]["binding"]["column"] = "nonexistent_column"
        self.assertIn("SOURCE_COLUMN_UNKNOWN", self.codes(p, d))

    def test_source_table_identity_cannot_be_relabelled(self):
        p, d = self.revised()
        d["operationFieldLineage"][0]["sourceLeaves"][11]["binding"]["table"] = "tme_artifact_revision_counters"
        self.assertIn("SOURCE_RETURNING_IDENTITY_MISMATCH", self.codes(p, d))

    def test_source_local_sql_type_rejected(self):
        p, d = self.revised()
        d["operationFieldLineage"][0]["sourceLeaves"][11]["type"] = "UUID"
        self.assertIn("SOURCE_SQL_TYPE_MISMATCH", self.codes(p, d))

    def test_wrong_allocator_public_id_target_rejected(self):
        p, d = self.revised()
        graph = d["operationFieldLineage"][0]
        graph["typedSources"][2]["inputs"] = ["allocator.tme_artifact_revision_counters.public_id"]
        self.assertIn("BUSINESS_PUBLIC_ALLOCATOR_MISSING", self.codes(p, d))

    def test_allocator_id_space_not_internal_bigint(self):
        p, d = self.revised()
        leaf = next(row for row in d["operationFieldLineage"][0]["sourceLeaves"]
                    if row["source"] == "allocator.tme_work_rule_set_versions.public_id")
        leaf["binding"]["persistedTarget"] = "tme_work_rule_set_versions.work_rule_set_version_id"
        self.assertIn("ALLOCATOR_PUBLIC_ID_TYPE_INVALID", self.codes(p, d))

    def test_internal_pk_not_derived_from_public_uuid(self):
        p, d = self.revised()
        d["operationFieldLineage"][0]["typedSources"][0]["inputs"] = ["allocator.tme_work_rule_set_versions.public_id"]
        self.assertIn("INTERNAL_ID_RETURNING_MISMATCH", self.codes(p, d))

    def test_bool_version_and_fake_application_dialect_rejected(self):
        for key, value in [("schemaVersion", True), ("schemaVersion", None), ("schemaVersion", "1")]:
            p = copy.deepcopy(self.proposal)
            p[key] = value
            with self.subTest(key=key, value=value), self.assertRaisesRegex(ValueError, "ENVELOPE_VERSION_INVALID"):
                self.load_memory(p)
        p = copy.deepcopy(self.proposal)
        p["application"]["fieldGraphDialect"] = "CANONICAL_READY"
        with self.assertRaisesRegex(ValueError, "APPLICATION_DIALECT_INVALID"):
            self.load_memory(p)

    def test_direct_validator_also_rejects_bool_version_and_fake_dialect(self):
        p, d = self.revised()
        p["schemaVersion"] = True
        self.assertIn("ENVELOPE_VERSION_INVALID", self.codes(p, d))
        p, d = self.revised()
        p["application"]["fieldGraphDialect"] = "CANONICAL_READY"
        self.assertIn("APPLICATION_DIALECT_INVALID", self.codes(p, d))

    def test_direct_validator_does_not_read_arbitrary_pin_path(self):
        p, d = self.revised()
        p["originalPins"]["json"]["path"] = "/etc/hosts"
        self.assertIn("ORIGINAL_PIN_IDENTITY_INVALID", self.codes(p, d))

    def test_unsupported_proposal_dialect_rejected_not_noop(self):
        with self.assertRaisesRegex(ValueError, "UNSUPPORTED_PROPOSAL_DIALECT"):
            self.load_memory({"moduleId": "TIM-WFM", "operationDeltas": [], "schemaVersion": 1})

    def test_unknown_envelope_member_rejected(self):
        p = copy.deepcopy(self.proposal)
        p["operationBindings"] = []
        with self.assertRaisesRegex(ValueError, "UNSUPPORTED_PROPOSAL_DIALECT"):
            self.load_memory(p)

    def test_pin_identity_and_test_only_noop_rejected(self):
        p = copy.deepcopy(self.proposal)
        p["originalPins"]["json"]["sha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "ORIGINAL_PIN_IDENTITY_INVALID"):
            self.load_memory(p)
        p = copy.deepcopy(self.proposal)
        p["patch"] = [{"op": "test", "path": "/operationDeltas/110/path", "value": self.original["operationDeltas"][110]["path"]}]
        with self.assertRaisesRegex(ValueError, "PATCH_NO_EFFECT"):
            self.load_memory(p)

    def test_actual_full_civil_date_profile_healthy_and_invalid(self):
        p = copy.deepcopy(self.proposal)
        for field, value in [("periodStart", "2026-02-30"), ("capturedAt", "2026-02-30T00:00:00Z")]:
            case = copy.deepcopy(p["schemaProbeCases"][0])
            case["caseId"] = "V2_INVALID_" + field
            case["payload"][field] = value
            case["expectedSchemaAccept"] = False
            p["schemaProbeCases"].append(case)
        report = v.standard_schema_checks(p, self.draft)
        self.assertEqual(report["failures"], [])
        self.assertEqual(report["formatProfile"], "full")
        self.assertTrue(report["nodeVersion"].startswith("v24."))
        self.assertEqual(report["typedSchemaCases"], 14)

    def test_create_parser_minimal_supported_witness_and_malformed(self):
        sql = "CREATE TABLE public.fixture (fixture_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, tenant_id BIGINT NOT NULL, CONSTRAINT fixture_u0 UNIQUE (tenant_id));"
        self.assertEqual(v.parse_create_table(sql)["table"], "fixture")
        for bad in ["SELECT 1;", sql + " SELECT 2;", sql.replace("BIGINT GENERATED", "BIGINTGENERATED"),
                    sql.replace("tenant_id BIGINT NOT NULL", "tenant_id BIGINT NOT NULL NOT NULL"),
                    sql.replace("tenant_id BIGINT NOT NULL", "tenant_id BIGINT DEFAULT attacker()"),
                    sql.replace("CONSTRAINT fixture_u0", "/*comment*/ CONSTRAINT fixture_u0")]:
            with self.subTest(sql=bad), self.assertRaises(ValueError):
                v.parse_create_table(bad)

    def test_actual_cli_rejects_previous_business_trace_bypass(self):
        p = copy.deepcopy(self.proposal)
        p["patch"] += [{"op": "replace", "path": "/operationFieldLineage/0/typedSources/2/inputs", "value": ["headers.X-Correlation-ID"]}]
        run = subprocess.run([sys.executable, "-B", "-W", "error::SyntaxWarning", str(Path(v.__file__)),
                              "--proposal", "/dev/stdin", "--compact"], input=json.dumps(p), text=True,
                             capture_output=True, timeout=60, env=dict(os.environ, PYTHONDONTWRITEBYTECODE="1"))
        self.assertEqual(run.returncode, 1)
        report = json.loads(run.stdout)
        self.assertFalse(report["strictSubsetPass"])
        self.assertFalse(report["readinessPass"])
        self.assertIn("TRACE_USED_AS_BUSINESS_SOURCE", {row["code"] for row in report["structural"]["errors"]})

    def test_actual_cli_normal_and_g3_request_never_authorize(self):
        argv = [sys.executable, "-B", "-W", "error::SyntaxWarning", str(Path(v.__file__)), "--compact"]
        for suffix, expected_exit in [([], 0), (["--require-g3"], 1)]:
            run = subprocess.run(argv + suffix, text=True, capture_output=True, timeout=60)
            self.assertEqual(run.returncode, expected_exit)
            report = json.loads(run.stdout)
            self.assertTrue(report["strictSubsetPass"])
            self.assertFalse(report["readinessPass"])
            self.assertEqual(report["G3Gate"], "CLOSED")
            self.assertFalse(report["actualSource4And112Closure"])
            self.assertEqual(report["canonicalOracle"]["validationStatus"], "FAIL")

    def test_frozen_sources_and_exact_ns_unchanged(self):
        files = [v.HERE / name for name in v.FROZEN] + [v.BASE / pin["path"] for pin in self.proposal["originalPins"].values()]
        def snapshot():
            return [(str(path), hashlib.sha256(path.read_bytes()).hexdigest(), str(path.stat().st_mtime_ns)) for path in files]
        before = snapshot()
        p, _, d = v.load_draft()
        self.assertEqual(v.strict_checks(p, d)["errors"], [])
        self.assertEqual(snapshot(), before)


if __name__ == "__main__":
    unittest.main()
