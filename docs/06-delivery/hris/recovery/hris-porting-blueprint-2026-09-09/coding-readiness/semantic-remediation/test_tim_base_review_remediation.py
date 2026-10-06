#!/usr/bin/env python3
"""Author materializer/shape/invariant tests only; NOT independent/domain/G3 PASS."""
import copy
import json
import subprocess
import sys
import unittest
from pathlib import Path
import validate_tim_base_review_remediation as v


class ReadonlyTimRemediationTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.proposal, cls.original, cls.draft = v.load_draft()
        cls.doc = copy.deepcopy(cls.proposal["schemaProbeCases"][0]["payload"])
        cls.posted = copy.deepcopy(next(case["payload"] for case in cls.proposal["schemaProbeCases"]
                                       if case["payload"].get("kind") == "POSTED"))
        cls.error = copy.deepcopy(next(case["payload"] for case in cls.proposal["schemaProbeCases"]
                                      if case["payload"].get("kind") == "BLOCKED"))
        cls.cancelled = copy.deepcopy(next(case["payload"] for case in cls.proposal["schemaProbeCases"]
                                          if case["payload"].get("kind") == "CANCELLED"))

    def revised(self):
        return copy.deepcopy(self.proposal), copy.deepcopy(self.draft)

    def fingerprint(self, doc):
        doc["selectionDigest"] = v.canonical_hash(doc["selectedItems"])
        doc["contentSha256"] = v.canonical_hash(doc, "contentSha256")
        return doc

    def test_original_and_review_pins_unchanged(self):
        v.verify_pins(self.proposal)

    def test_deepcopy_rfc6902_no_original_mutation(self):
        original = {"a": [1, {"key/tilde~": True}]}
        before = copy.deepcopy(original)
        result = v.apply_patch_in_memory(original, [
            {"op": "test", "path": "/a/1/key~1tilde~0", "value": True},
            {"op": "replace", "path": "/a/0", "value": 2},
            {"op": "add", "path": "/a/-", "value": 3},
            {"op": "remove", "path": "/a/1"},
        ])
        self.assertEqual(result, {"a": [2, 3]})
        self.assertEqual(original, before)

    def test_boolean_is_not_number_in_rfc_test(self):
        with self.assertRaises(ValueError):
            v.apply_patch_in_memory({"v": True}, [{"op": "test", "path": "/v", "value": 1}])
        self.assertTrue(v.json_equal(1, 1.0))

    def test_duplicate_json_keys_rejected(self):
        with self.assertRaises(ValueError):
            v.strict_loads('{"patch":[],"patch":[1]}')

    def test_nonfinite_json_rejected(self):
        for token in ["NaN", "Infinity", "-Infinity"]:
            with self.subTest(token=token), self.assertRaises(ValueError):
                v.strict_loads('{"value":' + token + '}')

    def test_overflow_numeric_json_rejected(self):
        for raw in ["1e309", "1e-400", "1.0000000000000001", "0.1"]:
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                v.strict_loads('{"value":' + raw + '}')
        self.assertEqual(v.strict_loads('{"value":1.0}')["value"], 1)

    def test_target_specific_node_mapping_and_type_rejected(self):
        for mode in ["mapping", "type"]:
            p, draft = self.revised()
            graph = draft["operationFieldLineage"][0]
            if mode == "mapping": graph["requiredColumnSources"][0]["source"] = graph["typedSources"][1]["source"]
            else: graph["typedSources"][0]["type"] = "BOOLEAN"
            with self.subTest(mode=mode):
                self.assertTrue(v.subset_checks(p, draft)["errors"])

    def test_query_false_field_source_rejected(self):
        p, draft = self.revised()
        graph = next(row for row in draft["operationFieldLineage"] if row["operationId"] == "tim.leave.entitlement.input.get")
        graph["responseFieldSources"][0]["source"] = "loaded.input.input_payload.phantom"
        self.assertTrue(v.subset_checks(p, draft)["errors"])

    def test_renamed_original_id_and_scope_cannot_launder_exact_set(self):
        p, draft = self.revised()
        old = draft["operationDeltas"][1]["operationId"]
        draft["operationDeltas"][1]["operationId"] = "tim.phantom.query"
        p["sourceRepairScope"]["unfixedExactOperationIds"] = ["tim.phantom.query" if name == old else name for name in p["sourceRepairScope"]["unfixedExactOperationIds"]]
        self.assertIn("immutable114 plus approved new2 exact operation ID scope", v.subset_checks(p, draft)["errors"])

    def test_repeated_count_only_case_catalog_rejected(self):
        for name in ["fixtureDefinitions", "schemaProbeCases"]:
            p, draft = self.revised()
            p[name][1] = copy.deepcopy(p[name][0])
            with self.subTest(name=name):
                self.assertTrue(v.subset_checks(p, draft)["errors"])

    def test_distinct_registered_result_state_not_aggregate_status(self):
        v.event_guard({"stateBefore": "RUNNING", "stateAfter": "RUNNING", "resultRecord": {"status": "POSTED"}}, "RUNNING", "RUNNING", False)
        with self.assertRaises(ValueError):
            v.event_guard({"stateBefore": "RUNNING", "stateAfter": "FAILED", "resultRecord": {"status": "POSTED"}}, "RUNNING", "RUNNING", False)

    def test_rfc_operation_field_closure(self):
        for change in [
            {"op": "move", "path": "/v", "from": "/other"},
            {"op": "replace", "path": "/v", "value": 2, "extra": True},
            {"op": "replace", "path": "/unknown", "value": 2},
            {"op": "add", "path": "/a/01", "value": 2},
            {"op": "add", "path": "/__proto__", "value": {}},
        ]:
            with self.subTest(change=change), self.assertRaises((ValueError, KeyError)):
                v.apply_patch_in_memory({"v": 1, "a": []}, [change])

    def test_exact_structural_subset_and_open_scope(self):
        report = v.subset_checks(self.proposal, self.draft)
        self.assertEqual(report["errors"], [])
        self.assertEqual(report["counts"]["operations"], 116)
        self.assertEqual(report["counts"]["unfixedSourceOperations"], 112)
        self.assertFalse(report["crossContextPolicyPass"])

    def test_self_approval_or_published_rejected(self):
        for key in ["independentPass", "CURRENT_PUBLISHED"]:
            p, draft = self.revised()
            p[key] = True
            self.assertTrue(v.subset_checks(p, draft)["errors"])

    def test_mixed_executable_envelope_rejected(self):
        p, draft = self.revised()
        p["operationBindings"] = []
        self.assertIn("top-level author envelope must not mix executable dialects",
                      v.subset_checks(p, draft)["errors"])

    def test_missing_unfixed_operation_rejected(self):
        p, draft = self.revised()
        p["sourceRepairScope"]["unfixedExactOperationIds"].pop()
        self.assertTrue(v.subset_checks(p, draft)["errors"])

    def test_routing_collision_rejected(self):
        p, draft = self.revised()
        draft["operationDeltas"][110]["path"] = draft["operationDeltas"][63]["path"]
        self.assertTrue(v.subset_checks(p, draft)["errors"])

    def test_copied_cancel_termination_rules_rejected(self):
        p, draft = self.revised()
        draft["operationDeltas"][110]["rules"] = self.original["operationDeltas"][63]["rules"]
        self.assertTrue(v.subset_checks(p, draft)["errors"])

    def test_same_count_duplicate_fk_sql_rejected(self):
        p, draft = self.revised()
        plan = draft["twoPhaseDdlPlan"]["phase2ForeignKeys"]
        plan[1] = copy.deepcopy(plan[0])
        self.assertTrue(v.subset_checks(p, draft)["errors"])

    def test_same_count_wrong_ddl_correspondence_rejected(self):
        p, draft = self.revised()
        draft["twoPhaseDdlPlan"]["phase1"][0]["sql"] = "SELECT 1;"
        self.assertTrue(v.subset_checks(p, draft)["errors"])

    def test_empty_source_dependencies_rejected(self):
        p, draft = self.revised()
        draft["operationFieldLineage"][0]["typedSources"][0]["inputs"] = []
        self.assertTrue(v.subset_checks(p, draft)["errors"])

    def test_self_cycle_source_rejected(self):
        p, draft = self.revised()
        node = draft["operationFieldLineage"][0]["typedSources"][0]
        node["inputs"] = [node["source"]]
        self.assertTrue(v.subset_checks(p, draft)["errors"])

    def test_empty_or_incomplete_column_bindings_rejected(self):
        for count in [0, 1]:
            p, draft = self.revised()
            draft["operationFieldLineage"][0]["requiredColumnSources"] = draft["operationFieldLineage"][0]["requiredColumnSources"][:count]
            self.assertTrue(v.subset_checks(p, draft)["errors"])

    def test_canonical_oracle_still_fail_not_noop_pass(self):
        report = v.canonical_oracle(self.draft)
        self.assertEqual(report["validationStatus"], "FAIL")
        self.assertFalse(report["readinessPass"])
        self.assertEqual({row["code"] for row in report["errors"]},
                         {"UNSUPPORTED_PROPOSAL_DIALECT", "OPERATION_GRAPH_REQUIRED"})

    def test_actual_ajv_closed_shapes_and_controls(self):
        report = v.standard_schema_checks(self.proposal, self.draft)
        self.assertEqual(report["version"], "6.12.6")
        self.assertEqual(report["compiled"], 481)
        self.assertEqual(report["typedSchemaCases"], 12)
        self.assertEqual(report["failures"], [])
        self.assertFalse(report["domainExecuted"])

    def test_immutable_input_replays_and_wrong_parent_denied(self):
        v.input_guard(self.doc)
        run = {"publicId": self.doc["runPublicId"], "inputVersionPublicId": self.doc["inputVersionPublicId"],
               "selectedCount": 1, "inputSha256": self.doc["contentSha256"]}
        v.input_guard(self.doc, run, self.doc["selectedItems"])
        run["publicId"] = "ffffffff-0000-4000-8000-000000000999"
        with self.assertRaises(ValueError):
            v.input_guard(self.doc, run)

    def test_tampered_input_hash_and_cardinality_denied(self):
        for mode in ["hash", "cardinality", "parent"]:
            doc = copy.deepcopy(self.doc)
            if mode == "hash": doc["contentSha256"] = "0" * 64
            if mode == "cardinality": doc["selectedCount"] = 2
            if mode == "parent": doc["selectedItems"][0]["inputVersionPublicId"] = "f0000000-0000-4000-8000-000000000999"
            with self.subTest(mode=mode), self.assertRaises(ValueError):
                v.input_guard(doc)

    def test_case_alias_uuid_duplicate_rejected_even_rehashed(self):
        doc = copy.deepcopy(self.doc)
        row = doc["selectedItems"][0]
        row["enrollment"]["enrollmentPublicId"] = "abcd0000-0000-4000-8000-000000000001"
        other = copy.deepcopy(row)
        other["selectedItemPublicId"] = "a0000000-0000-4000-8000-000000000301"
        other["ordinal"] = 2
        other["enrollment"]["enrollmentPublicId"] = row["enrollment"]["enrollmentPublicId"].upper()
        doc["selectedItems"].append(other)
        doc["selectedCount"] = 2
        with self.assertRaises(ValueError):
            v.input_guard(self.fingerprint(doc))

    def test_outcome_nonselected_input_unit_or_negative_denied(self):
        for mode in ["selected", "input", "unit", "negative", "suppressed", "zeroLedger"]:
            out = copy.deepcopy(self.posted)
            if mode == "selected": out["selectedItemPublicId"] = "a0000000-0000-4000-8000-000000000999"
            if mode == "input": out["inputSha256"] = "0" * 64
            if mode == "unit": out["unit"] = "DAY"
            if mode == "negative": out["quantity"] = "-1"
            if mode == "suppressed": out["suppressedQuantity"] = "-1"
            if mode == "zeroLedger": out["quantity"] = "0"
            with self.subTest(mode=mode), self.assertRaises(ValueError):
                v.outcome_guard(out, self.doc)

    def test_exact_terminal_count_mode_and_duplicate_denied(self):
        self.assertEqual(v.finalize_decision(self.doc, [self.posted]), "SUCCEEDED")
        self.assertEqual(v.finalize_decision(self.doc, [self.error]), "FAILED")
        self.assertEqual(v.finalize_decision(self.doc, [self.cancelled], True), "CANCELLED")
        for outcomes in [[], [self.posted, self.posted], [self.cancelled]]:
            with self.subTest(count=len(outcomes)), self.assertRaises(ValueError):
                v.completion_guard(self.doc, outcomes)

    def test_zero_denominator_never_computed(self):
        out = copy.deepcopy(self.posted)
        out["denominator"] = "0"
        with self.assertRaises(ValueError):
            v.outcome_guard(out, self.doc)

    def test_expired_unknown_not_unexpired_lease_guard(self):
        report = v.expired_unknown_fence("2026-11-01T00:00:00Z", "2026-11-01T00:00:01Z", 1, 1)
        self.assertEqual(report, {"status": "RESULT_UNKNOWN", "leaseVersion": 2})
        with self.assertRaises(ValueError):
            v.expired_unknown_fence("2026-11-01T00:00:02Z", "2026-11-01T00:00:01Z", 1, 1)

    def test_prospective_writer_stale_expiry_owner_cancel_denied(self):
        self.assertTrue(v.writer_fence_guard(2, 2, "2026-11-01T00:00:02Z", "2026-11-01T00:00:01Z", "worker1", "worker1", False))
        for submitted, current, owner, caller, cancelled in [(1, 2, "w", "w", False), (2, 2, "w", "other", False), (2, 2, "w", "w", True)]:
            with self.subTest(submitted=submitted, caller=caller, cancelled=cancelled), self.assertRaises(ValueError):
                v.writer_fence_guard(submitted, current, "2026-11-01T00:00:02Z", "2026-11-01T00:00:01Z", owner, caller, cancelled)

    def test_event_persisted_state_result_equality(self):
        v.event_guard({"stateBefore": "QUEUED", "stateAfter": "RUNNING", "resultRecord": {"status": "RUNNING"}}, "RUNNING", "QUEUED")
        with self.assertRaises(ValueError):
            v.event_guard({"stateBefore": "QUEUED", "stateAfter": "RUNNING", "resultRecord": {"status": "FAILED"}}, "RUNNING", "QUEUED")

    def test_unused_cancel_clock_effects_and_cas(self):
        self.assertEqual(v.unused_enrollment_guard("ACTIVE", "2026-12-01", "2026-11-01", [0, 0, 0], 1, 1)["status"], "CANCELLED")
        for date, effects, observed in [("2026-12-01", [0], 1), ("2026-11-01", [1], 1), ("2026-11-01", [0], 0)]:
            with self.subTest(date=date, effects=effects, observed=observed), self.assertRaises(ValueError):
                v.unused_enrollment_guard("ACTIVE", "2026-12-01", date, effects, observed, 1)

    def test_actual_xcon_decimal_aliases_and_invalid_tokens(self):
        self.assertEqual([v.canonical_decimal(raw) for raw in ["1.500000", "1.5", "-0.000000", "0"]], ["1.5", "1.5", "0", "0"])
        for raw in [1, "+1", " 1", "01", "1e2", "0.0000001", "12345678901234"]:
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                v.canonical_decimal(raw)

    def test_cli_g3_cannot_open_and_original_stays_immutable(self):
        before = {key: (v.BASE / pin["path"]).read_bytes() for key, pin in self.proposal["originalPins"].items()}
        run = subprocess.run([sys.executable, "-B", str(Path(v.__file__)), "--compact", "--require-g3"],
                             text=True, capture_output=True, check=False)
        self.assertEqual(run.returncode, 1)
        result = v.strict_loads(run.stdout)
        self.assertFalse(result["readinessPass"])
        self.assertEqual(result["G3Gate"], "CLOSED")
        for key, pin in self.proposal["originalPins"].items():
            self.assertEqual((v.BASE / pin["path"]).read_bytes(), before[key])


if __name__ == "__main__":
    unittest.main()
