#!/usr/bin/env python3
"""Targeted hostile tests for the MOD-PER-COMPPLAN preparation tools."""

from __future__ import annotations

import copy
import hashlib
import importlib.util
import json
import shutil
import tempfile
import unittest
from pathlib import Path
from typing import Any, Callable


HERE = Path(__file__).resolve().parent


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


materializer = load_module("compplan_preparation_materializer", HERE / "materialize_g7_mod_per_compplan_preparation.py")
validator = load_module("compplan_preparation_validator", HERE / "validate_g7_mod_per_compplan_preparation.py")


def read_json(root: Path, relative: str) -> dict[str, Any]:
    return json.loads((root / relative).read_text())


def write_json(root: Path, relative: str, value: dict[str, Any]) -> None:
    (root / relative).write_bytes(materializer.pretty(value))


def reseal(value: dict[str, Any]) -> dict[str, Any]:
    result = copy.deepcopy(value)
    result.pop("sealedPayloadSha256", None)
    result["sealedPayloadSha256"] = materializer.sha256(materializer.canonical_bytes(result))
    return result


def refresh_pin(manifest: dict[str, Any], root: Path, relative: str) -> None:
    for pin in manifest["artifactPins"] + manifest["toolPins"]:
        if pin["path"] == relative:
            data = (root / relative).read_bytes()
            pin.update({
                "gitMode": "100644",
                "gitBlobSha1": materializer.git_blob_sha1(data),
                "bytes": len(data),
                "sha256": materializer.sha256(data),
            })
            return
    raise AssertionError(f"missing pin {relative}")


class PreparationTest(unittest.TestCase):
    maxDiff = None

    @classmethod
    def setUpClass(cls) -> None:
        materializer.check_outputs(materializer.build_bundle_bytes())
        validator.validate_bundle_directory(HERE, verify_sources=True)

    def copy_bundle(self) -> tuple[tempfile.TemporaryDirectory[str], Path]:
        temporary = tempfile.TemporaryDirectory()
        root = Path(temporary.name) / "bundle"
        shutil.copytree(HERE, root, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
        return temporary, root

    def mutate_authority_artifact(
        self, relative: str, mutate: Callable[[dict[str, Any]], None]
    ) -> tuple[tempfile.TemporaryDirectory[str], Path]:
        temporary, root = self.copy_bundle()
        value = read_json(root, relative)
        mutate(value)
        value = reseal(value)
        write_json(root, relative, value)

        if relative in {
            "contract-reseal-authority.v1.json",
            "packet.v1.json",
            "migration-leases.delta.v1.json",
        }:
            state = read_json(root, "state/preparation.v1.json")
            key = {
                "contract-reseal-authority.v1.json": "contractReseal",
                "packet.v1.json": "packet",
                "migration-leases.delta.v1.json": "migrationLeaseDelta",
            }[relative]
            state["artifactSeals"][key] = value["sealedPayloadSha256"]
            state = reseal(state)
            write_json(root, "state/preparation.v1.json", state)

        manifest = read_json(root, "manifest.v1.json")
        refresh_pin(manifest, root, relative)
        if relative in {
            "contract-reseal-authority.v1.json",
            "packet.v1.json",
            "migration-leases.delta.v1.json",
        }:
            refresh_pin(manifest, root, "state/preparation.v1.json")
        manifest = reseal(manifest)
        write_json(root, "manifest.v1.json", manifest)
        return temporary, root

    def assert_rejected(self, root: Path) -> None:
        with self.assertRaises(validator.ValidationError):
            validator.validate_bundle_directory(root, verify_sources=True)

    def test_deterministic_double_build(self) -> None:
        self.assertEqual(materializer.build_bundle_bytes(), materializer.build_bundle_bytes())

    def test_validator_is_independent(self) -> None:
        source = (HERE / "validate_g7_mod_per_compplan_preparation.py").read_text()
        self.assertNotIn("import materialize_g7_mod_per_compplan_preparation", source)
        self.assertNotIn("from materialize_g7_mod_per_compplan_preparation", source)

    def test_schema_closes_every_declared_object(self) -> None:
        schema = json.loads((HERE / "contracts/mod-per-compplan-preparation.schema.v1.json").read_text())
        validator.validate_schema_closed(schema)

    def test_exact_operation_order_is_unique_and_closed(self) -> None:
        contract = read_json(HERE, "contract-reseal-authority.v1.json")
        actual = [row["operationId"] for row in contract["ownership"]["operations"]]
        self.assertEqual(actual, [row[0] for row in materializer.OPERATION_ROWS])
        self.assertEqual(len(actual), 12)
        self.assertEqual(len(set(actual)), 12)

    def test_reachable_multi_proposal_lifecycle_is_sealed(self) -> None:
        contract = read_json(HERE, "contract-reseal-authority.v1.json")
        reachability = contract["ownership"]["lifecycleReachability"]
        self.assertEqual(
            reachability["cycleHappyPath"],
            ["NONE", "DRAFT", "OPEN", "PROPOSAL_REVIEW", "APPROVED", "PUBLISHED"],
        )
        self.assertNotIn("PENDING_APPROVAL", reachability["cycleHappyPath"])
        submit = next(
            row for row in contract["ownership"]["stateTransitionContracts"]
            if row["operationId"] == "modern.compplan.proposal.submit"
        )
        parent_branches = submit["cascade"][0]["branches"]
        self.assertEqual(
            [(row["fromState"], row["toState"]) for row in parent_branches],
            [("OPEN", "PROPOSAL_REVIEW"), ("PROPOSAL_REVIEW", "PROPOSAL_REVIEW")],
        )

    def test_typed_foundation_effects_are_exact(self) -> None:
        contract = read_json(HERE, "contract-reseal-authority.v1.json")
        physical = contract["physicalContract"]
        self.assertEqual(physical["totalNewTablesInV4"], 7)
        self.assertEqual(physical["controlAllocatedSharedFoundationTables"], ["prf_per_artifact_versions"])
        self.assertEqual(physical["sharedBootstrapAllocation"]["refetchContract"]["publicEndpoint"], "NONE_FORBIDDEN")
        self.assertFalse(physical["sharedBootstrapAllocation"]["frontendDirectTypedArtifactEndpointAllowed"])
        effects = {row["operationId"]: row["sharedFoundationEffect"] for row in contract["ownership"]["operations"]}
        self.assertEqual(effects["modern.compplan.cycle.create"]["typedSchemasAppended"], ["CompensationGuidelinesContent.v1", "CompensationPopulationContent.v1"])
        self.assertEqual(effects["modern.compplan.proposal.upsert"]["typedSchemasAppended"], ["CompensationProposalContent.v1"])
        self.assertEqual(effects["modern.compplan.cycle.query"]["readTables"], ["prf_per_artifact_versions"])
        self.assertEqual(effects["modern.compplan.cycles.query"]["typedSchemasRead"], [])
        self.assertEqual(effects["modern.compplan.proposals.query"]["typedSchemasRead"], [])
        self.assertEqual(effects["modern.compplan.proposal.upsert"]["typedSchemasRead"], ["CompensationGuidelinesContent.v1", "CompensationPopulationContent.v1"])
        self.assertEqual(effects["modern.compplan.proposal.submit"]["typedSchemasRead"], ["CompensationGuidelinesContent.v1", "CompensationPopulationContent.v1", "CompensationProposalContent.v1"])
        refetch = physical["sharedBootstrapAllocation"]["refetchContract"]
        self.assertEqual([row["name"] for row in refetch["parameters"]], ["artifactPublicId"])
        self.assertEqual([row["name"] for row in refetch["requestFields"]], ["expectedArtifactType", "expectedOwnerAggregateType", "expectedOwnerAggregatePublicId", "purposeCode"])
        self.assertEqual(refetch["supersededSourceSignature"]["forbiddenCallerInputs"], ["artifactRevision", "expectedSha256"])
        self.assertEqual(physical["sharedBootstrapAllocation"]["r1BudgetModePolicy"]["activeModes"], ["HARD_CAP"])

    def test_wire_overrides_are_self_consistent(self) -> None:
        contract = read_json(HERE, "contract-reseal-authority.v1.json")
        wires = {row["operationId"]: row for row in contract["ownership"]["normativeWireContracts"]}
        create = wires["modern.compplan.cycle.create"]
        self.assertEqual(create["requestSchemaRef"], "modern.compplan.cycle.create.Request.v2")
        self.assertEqual(create["requestSchema"]["schemaId"], create["requestSchemaRef"])
        self.assertEqual(
            [field["name"] for field in create["requestSchema"]["body"]],
            ["cycleCode", "guidelines", "population", "effectiveFrom", "effectiveTo", "populationSourceRef"],
        )
        approve = wires["modern.compplan.plan.approve"]
        decision = next(field for field in approve["requestSchema"]["body"] if field["name"] == "decision")
        self.assertEqual(decision["values"], ["APPROVE"])
        self.assertEqual([field["name"] for field in approve["requestSchema"]["body"]], ["decision", "reasonCode"])
        publish = wires["modern.compplan.snapshot.publish"]
        self.assertEqual(publish["requestSchemaRef"], "modern.compplan.snapshot.publish.Request.v2")
        self.assertEqual([field["name"] for field in publish["requestSchema"]["body"]], ["approvalReceiptId"])
        self.assertEqual(publish["responseSchemaRef"], "modern.compplan.snapshot.publish.Response.v2")
        self.assertEqual(len(publish["responseSchema"]["fields"]), 10)
        self.assertNotIn("lines", [field["name"] for field in publish["responseSchema"]["fields"]])
        xcon = contract["crossModuleContracts"]["xcon020"]
        self.assertEqual(len(xcon["headerFields"]), 11)
        self.assertEqual(xcon["lineCardinality"], {"minimum": 1, "maximum": 100000})

    def test_query_wire_shapes_and_field_policy_are_exact(self) -> None:
        contract = read_json(HERE, "contract-reseal-authority.v1.json")
        wires = {row["operationId"]: row for row in contract["ownership"]["normativeWireContracts"]}
        cycle_list = wires["modern.compplan.cycles.query"]["responseSchema"]
        self.assertEqual(cycle_list["fields"][0]["name"], "items")
        self.assertEqual(cycle_list["fields"][0]["type"], "ARRAY")
        list_names = [field["name"] for field in cycle_list["fields"][0]["inlineItemSchema"]["fields"]]
        self.assertNotIn("budgetEntries", list_names)
        detail = wires["modern.compplan.cycle.query"]["responseSchema"]
        self.assertEqual(detail["fields"][0]["name"], "item")
        detail_fields = {field["name"]: field for field in detail["fields"][0]["inlineItemSchema"]["fields"]}
        self.assertFalse(detail_fields["budgetEntries"]["required"])
        self.assertIn("VIEW_ONLY MUST OMIT", detail_fields["budgetEntries"]["fieldVisibility"])
        proposals = wires["modern.compplan.proposals.query"]
        self.assertEqual(proposals["requestSchemaRef"], "modern.compplan.proposals.query.Request.v4")
        self.assertEqual([field["name"] for field in proposals["requestSchema"]["queryParameters"]], ["referenceEffectiveAt", "cursor", "limit"])
        self.assertEqual(proposals["responseSchema"]["paginationContract"]["limit"], "1..200; default 50")

    def test_ui_and_control_phase_contracts_are_exact(self) -> None:
        contract = read_json(HERE, "contract-reseal-authority.v1.json")
        packet = read_json(HERE, "packet.v1.json")
        self.assertEqual(contract["uiWorkContract"]["route"], "/hr/operations/performance/compensation-planning")
        self.assertEqual(contract["uiWorkContract"]["menuNode"], "hcm.operations.compensation-planning")
        requests = packet["centralControlRequests"]["preparedControlRequests"]
        self.assertEqual(len(requests), 7)
        self.assertTrue(all(row["registrationPhase"] == "BEFORE_START_TOKEN" for row in requests))
        bootstrap = next(row for row in requests if row["category"] == "TYPED-ARTIFACT-BOOTSTRAP")
        self.assertEqual(bootstrap["fulfillmentPhase"], "PRE_START_ALLOCATION")
        self.assertTrue(bootstrap["grantRequiredBeforeStartToken"])
        workforce = next(row for row in requests if row["category"] == "WORKFORCE-SNAPSHOT-COMPENSATION-PROJECTION")
        self.assertEqual(workforce["fulfillmentPhase"], "PRE_START_ALLOCATION")
        self.assertTrue(workforce["grantRequiredBeforeStartToken"])
        amendment = contract["crossModuleContracts"]["workforceSnapshotCompensationProjection"]
        self.assertEqual(amendment["activeVariant"]["purposeCode"], "HRIS_PER_COMPENSATION_POPULATION")
        self.assertEqual(amendment["activeVariant"]["projection"], "COMPENSATION_POPULATION_V1")
        line_fields = amendment["activeVariant"]["resultPageSchema"]["lineSchema"]["fields"]
        self.assertEqual([row["name"] for row in line_fields], ["workerPublicId", "assignmentPublicId", "organizationPublicId", "gradePublicId", "jobProfilePublicId", "assignmentOwnerRevision", "eligibleComponentCodes"])

    def test_child_results_and_event_sources_are_physical(self) -> None:
        contract = read_json(HERE, "contract-reseal-authority.v1.json")
        wires = {row["operationId"]: row for row in contract["ownership"]["normativeWireContracts"]}
        revise = wires["modern.compplan.cycle.revise"]["responseSchema"]["childResultsContract"]
        self.assertEqual(revise["cardinality"], "exactly 2")
        self.assertEqual(revise["closedEntityTypes"], ["COMPENSATION_GUIDELINES_ARTIFACT_VERSION", "COMPENSATION_POPULATION_ARTIFACT_VERSION"])
        upsert = wires["modern.compplan.proposal.upsert"]["responseSchema"]["childResultsContract"]
        self.assertEqual(upsert["closedEntityTypes"], ["COMPENSATION_PROPOSAL_ARTIFACT_VERSION", "COMPENSATION_PROPOSAL_REVISION"])
        cancel = wires["modern.compplan.cycle.cancel"]["responseSchema"]["childResultsContract"]
        self.assertEqual(cancel["closedEntityTypes"], ["COMPENSATION_PROPOSAL"])
        for event in contract["ownership"]["events"]:
            self.assertIn("prf_outbox_events.created_at", event["transitionFieldSources"]["occurredAt"])
            self.assertNotIn("command receipt correlation_id", event["transitionFieldSources"]["correlationId"])
            if event["eventName"] == "ApprovedCompensationPlanSnapshotPublished.v2":
                self.assertEqual(event["refetchPolicy"], "SVC-PEP-PER-001_IMMUTABLE_XCON_020_SNAPSHOT_REFETCH")
            else:
                self.assertEqual(event["refetchPolicy"], "PAYLOAD_COMPLETE_NO_REFETCH")

    def test_xcon_digest_known_answers_recompute_independently(self) -> None:
        contract = read_json(HERE, "contract-reseal-authority.v1.json")
        digest = contract["crossModuleContracts"]["xcon020"]["digestContract"]
        self.assertEqual(digest["canonicalJson"], "RFC8785_JCS")
        for vector in digest["knownAnswerVectors"]:
            for line in vector["lineVectors"]:
                parsed = json.loads(line["preimageUtf8"])
                encoded = json.dumps(parsed, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
                self.assertEqual(hashlib.sha256(encoded).hexdigest(), line["expectedSha256"])
                self.assertNotIn("lineDigest", parsed)
            parsed_payload = json.loads(vector["payloadPreimageUtf8"])
            encoded_payload = json.dumps(parsed_payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
            self.assertEqual(hashlib.sha256(encoded_payload).hexdigest(), vector["expectedPayloadSha256"])
            self.assertNotIn("payloadDigest", parsed_payload)
            self.assertTrue(all("lineDigest" in line for line in parsed_payload["lines"]))

    def test_budget_and_approval_guards_are_closed(self) -> None:
        contract = read_json(HERE, "contract-reseal-authority.v1.json")
        transitions = {row["operationId"]: row for row in contract["ownership"]["stateTransitionContracts"]}
        budget = " ".join(transitions["modern.compplan.budget.allocate"]["guards"])
        self.assertIn("same tenant", budget)
        self.assertIn("organization, currency and amount match exactly", budget)
        self.assertIn("frozen or approved proposals", budget)
        approve = " ".join(transitions["modern.compplan.plan.approve"]["guards"])
        self.assertIn("cardinality 1..100000", approve)
        self.assertIn("exactly one valid snapshot line", approve)
        self.assertEqual(contract["uiWorkContract"]["forbiddenR1Actions"], ["select or submit EXCEPTION_APPROVAL budget mode", "enter or display an exception approval receipt"])

    def test_raw_payload_tamper_fails_seal(self) -> None:
        temporary, root = self.copy_bundle()
        self.addCleanup(temporary.cleanup)
        packet = read_json(root, "packet.v1.json")
        packet["state"] = "STARTED"
        write_json(root, "packet.v1.json", packet)
        self.assert_rejected(root)

    def test_resealed_authority_escalation_is_rejected(self) -> None:
        temporary, root = self.mutate_authority_artifact(
            "packet.v1.json",
            lambda value: value["authorities"].__setitem__("sourceChangeAuthority", True),
        )
        self.addCleanup(temporary.cleanup)
        self.assert_rejected(root)

    def test_resealed_legacy_table_is_rejected(self) -> None:
        def mutate(value: dict[str, Any]) -> None:
            value["physicalContract"]["tables"][0]["table"] = "prf_cmp_plans"

        temporary, root = self.mutate_authority_artifact("contract-reseal-authority.v1.json", mutate)
        self.addCleanup(temporary.cleanup)
        self.assert_rejected(root)

    def test_resealed_pay_audience_drift_is_rejected(self) -> None:
        def mutate(value: dict[str, Any]) -> None:
            value["ownership"]["events"][0]["allowedConsumerSessions"] = ["HRIS-PER"]

        temporary, root = self.mutate_authority_artifact("contract-reseal-authority.v1.json", mutate)
        self.addCleanup(temporary.cleanup)
        self.assert_rejected(root)

    def test_resealed_wire_request_schema_drift_is_rejected(self) -> None:
        def mutate(value: dict[str, Any]) -> None:
            value["ownership"]["normativeWireContracts"][0]["requestSchema"]["additionalProperties"] = True

        temporary, root = self.mutate_authority_artifact("contract-reseal-authority.v1.json", mutate)
        self.addCleanup(temporary.cleanup)
        self.assert_rejected(root)

    def test_resealed_cycle_create_v1_reactivation_is_rejected(self) -> None:
        def mutate(value: dict[str, Any]) -> None:
            wire = next(row for row in value["ownership"]["normativeWireContracts"] if row["operationId"] == "modern.compplan.cycle.create")
            wire["requestSchemaRef"] = "modern.compplan.cycle.create.Request.v1"
            wire["requestSchema"]["schemaId"] = "modern.compplan.cycle.create.Request.v1"

        temporary, root = self.mutate_authority_artifact("contract-reseal-authority.v1.json", mutate)
        self.addCleanup(temporary.cleanup)
        self.assert_rejected(root)

    def test_resealed_flat_snapshot_response_is_rejected(self) -> None:
        def mutate(value: dict[str, Any]) -> None:
            wire = next(row for row in value["ownership"]["normativeWireContracts"] if row["operationId"] == "modern.compplan.snapshot.publish")
            wire["responseSchemaRef"] = "ApprovedCompensationPlanSnapshot.v1"

        temporary, root = self.mutate_authority_artifact("contract-reseal-authority.v1.json", mutate)
        self.addCleanup(temporary.cleanup)
        self.assert_rejected(root)

    def test_resealed_approval_revision_inferred_from_source_version_is_rejected(self) -> None:
        def mutate(value: dict[str, Any]) -> None:
            value["lineage"]["xcon021FieldMappings"]["approvalRevision"] = "prf_cmp_approved_snapshots.source_version"

        temporary, root = self.mutate_authority_artifact("contract-reseal-authority.v1.json", mutate)
        self.addCleanup(temporary.cleanup)
        self.assert_rejected(root)

    def test_resealed_unreachable_pending_approval_is_rejected(self) -> None:
        def mutate(value: dict[str, Any]) -> None:
            value["ownership"]["lifecycleReachability"]["cycleHappyPath"][3] = "PENDING_APPROVAL"

        temporary, root = self.mutate_authority_artifact("contract-reseal-authority.v1.json", mutate)
        self.addCleanup(temporary.cleanup)
        self.assert_rejected(root)

    def test_resealed_upsert_missing_create_if_match_is_rejected(self) -> None:
        def mutate(value: dict[str, Any]) -> None:
            transition = next(row for row in value["ownership"]["stateTransitionContracts"] if row["operationId"] == "modern.compplan.proposal.upsert")
            transition["guards"][0] = "If-Match is absent for create"

        temporary, root = self.mutate_authority_artifact("contract-reseal-authority.v1.json", mutate)
        self.addCleanup(temporary.cleanup)
        self.assert_rejected(root)

    def test_resealed_event_sentinel_state_source_is_rejected(self) -> None:
        def mutate(value: dict[str, Any]) -> None:
            event = next(row for row in value["ownership"]["events"] if row["eventName"] == "CompensationCycleRevised.v2")
            event["transitionFieldSources"]["toState"] = "stateTransitionContract.toState SAME_AS_FROM"

        temporary, root = self.mutate_authority_artifact("contract-reseal-authority.v1.json", mutate)
        self.addCleanup(temporary.cleanup)
        self.assert_rejected(root)

    def test_resealed_proposal_event_cycle_aggregate_is_rejected(self) -> None:
        def mutate(value: dict[str, Any]) -> None:
            event = next(row for row in value["ownership"]["events"] if row["eventName"] == "CompensationProposalDrafted.v2")
            event["aggregateEntityType"] = "table:prf_cmp_cycles"
            event["aggregateIdSource"] = "prf_cmp_cycles.public_id"

        temporary, root = self.mutate_authority_artifact("contract-reseal-authority.v1.json", mutate)
        self.addCleanup(temporary.cleanup)
        self.assert_rejected(root)

    def test_resealed_direct_typed_artifact_endpoint_is_rejected(self) -> None:
        def mutate(value: dict[str, Any]) -> None:
            value["physicalContract"]["sharedBootstrapAllocation"]["refetchContract"]["publicEndpoint"] = "/api/people/v1/hris/performance/typed-artifacts/{id}"
            value["physicalContract"]["sharedBootstrapAllocation"]["frontendDirectTypedArtifactEndpointAllowed"] = True

        temporary, root = self.mutate_authority_artifact("contract-reseal-authority.v1.json", mutate)
        self.addCleanup(temporary.cleanup)
        self.assert_rejected(root)

    def test_resealed_v4_six_only_closed_set_is_rejected(self) -> None:
        def mutate(value: dict[str, Any]) -> None:
            value["physicalContract"]["v4DdlContract"]["allV4NewTableClosedSet"].remove("prf_per_artifact_versions")

        temporary, root = self.mutate_authority_artifact("contract-reseal-authority.v1.json", mutate)
        self.addCleanup(temporary.cleanup)
        self.assert_rejected(root)

    def test_resealed_approve_reject_decision_is_rejected(self) -> None:
        def mutate(value: dict[str, Any]) -> None:
            wire = next(row for row in value["ownership"]["normativeWireContracts"] if row["operationId"] == "modern.compplan.plan.approve")
            decision = next(field for field in wire["requestSchema"]["body"] if field["name"] == "decision")
            decision["values"] = ["APPROVE", "REJECT"]

        temporary, root = self.mutate_authority_artifact("contract-reseal-authority.v1.json", mutate)
        self.addCleanup(temporary.cleanup)
        self.assert_rejected(root)

    def test_resealed_query_raw_budget_for_view_is_rejected(self) -> None:
        def mutate(value: dict[str, Any]) -> None:
            wire = next(row for row in value["ownership"]["normativeWireContracts"] if row["operationId"] == "modern.compplan.cycle.query")
            fields = wire["responseSchema"]["fields"][0]["inlineItemSchema"]["fields"]
            budget = next(field for field in fields if field["name"] == "budgetEntries")
            budget["required"] = True
            budget["fieldVisibility"] = "ALWAYS"

        temporary, root = self.mutate_authority_artifact("contract-reseal-authority.v1.json", mutate)
        self.addCleanup(temporary.cleanup)
        self.assert_rejected(root)

    def test_resealed_bootstrap_after_result_is_rejected(self) -> None:
        def mutate(value: dict[str, Any]) -> None:
            request = next(row for row in value["centralControlRequests"]["preparedControlRequests"] if row["category"] == "TYPED-ARTIFACT-BOOTSTRAP")
            request["fulfillmentPhase"] = "AFTER_PUSHED_MODULE_RESULT"
            request["grantRequiredBeforeStartToken"] = False

        temporary, root = self.mutate_authority_artifact("packet.v1.json", mutate)
        self.addCleanup(temporary.cleanup)
        self.assert_rejected(root)

    def test_resealed_workforce_projection_after_result_is_rejected(self) -> None:
        def mutate(value: dict[str, Any]) -> None:
            request = next(row for row in value["centralControlRequests"]["preparedControlRequests"] if row["category"] == "WORKFORCE-SNAPSHOT-COMPENSATION-PROJECTION")
            request["fulfillmentPhase"] = "AFTER_PUSHED_MODULE_RESULT"
            request["grantRequiredBeforeStartToken"] = False

        temporary, root = self.mutate_authority_artifact("packet.v1.json", mutate)
        self.addCleanup(temporary.cleanup)
        self.assert_rejected(root)

    def test_resealed_workforce_projection_extra_line_field_is_rejected(self) -> None:
        def mutate(value: dict[str, Any]) -> None:
            amendment = value["crossModuleContracts"]["workforceSnapshotCompensationProjection"]
            amendment["activeVariant"]["resultPageSchema"]["lineSchema"]["fields"].append(
                {"name": "status", "type": "STRING", "required": True, "nullable": False}
            )

        temporary, root = self.mutate_authority_artifact("contract-reseal-authority.v1.json", mutate)
        self.addCleanup(temporary.cleanup)
        self.assert_rejected(root)

    def test_resealed_typed_refetch_caller_revision_is_rejected(self) -> None:
        def mutate(value: dict[str, Any]) -> None:
            refetch = value["physicalContract"]["sharedBootstrapAllocation"]["refetchContract"]
            refetch["parameters"].append({"name": "artifactRevision", "type": "BIGINT", "required": True, "nullable": False})

        temporary, root = self.mutate_authority_artifact("contract-reseal-authority.v1.json", mutate)
        self.addCleanup(temporary.cleanup)
        self.assert_rejected(root)

    def test_resealed_historical_standard_event_refetch_is_rejected(self) -> None:
        def mutate(value: dict[str, Any]) -> None:
            event = next(row for row in value["ownership"]["events"] if row["eventName"] == "CompensationCycleCreated.v2")
            event["refetchPolicy"] = "EXACT_HISTORICAL_VERSION"

        temporary, root = self.mutate_authority_artifact("contract-reseal-authority.v1.json", mutate)
        self.addCleanup(temporary.cleanup)
        self.assert_rejected(root)

    def test_resealed_public_full_snapshot_response_is_rejected(self) -> None:
        def mutate(value: dict[str, Any]) -> None:
            wire = next(row for row in value["ownership"]["normativeWireContracts"] if row["operationId"] == "modern.compplan.snapshot.publish")
            wire["responseSchemaRef"] = "XCON-020::ApprovedCompensationPlanSnapshot.v1"

        temporary, root = self.mutate_authority_artifact("contract-reseal-authority.v1.json", mutate)
        self.addCleanup(temporary.cleanup)
        self.assert_rejected(root)

    def test_resealed_digest_vector_semantic_drift_is_rejected(self) -> None:
        def mutate(value: dict[str, Any]) -> None:
            vector = value["crossModuleContracts"]["xcon020"]["digestContract"]["knownAnswerVectors"][0]
            line = json.loads(vector["lineVectors"][0]["preimageUtf8"])
            line["approvedAmount"] = "1234.5000"
            line_bytes = json.dumps(line, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
            line_digest = hashlib.sha256(line_bytes).hexdigest()
            vector["lineVectors"][0]["preimageUtf8"] = line_bytes.decode()
            vector["lineVectors"][0]["expectedSha256"] = line_digest
            payload = json.loads(vector["payloadPreimageUtf8"])
            payload["lines"][0]["approvedAmount"] = "1234.5000"
            payload["lines"][0]["lineDigest"] = line_digest
            payload_bytes = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
            vector["payloadPreimageUtf8"] = payload_bytes.decode()
            vector["expectedPayloadSha256"] = hashlib.sha256(payload_bytes).hexdigest()

        temporary, root = self.mutate_authority_artifact("contract-reseal-authority.v1.json", mutate)
        self.addCleanup(temporary.cleanup)
        self.assert_rejected(root)

    def test_resealed_exception_approval_activation_is_rejected(self) -> None:
        def mutate(value: dict[str, Any]) -> None:
            policy = value["physicalContract"]["sharedBootstrapAllocation"]["r1BudgetModePolicy"]
            policy["activeModes"] = ["HARD_CAP", "EXCEPTION_APPROVAL"]
            policy["withheldModes"] = []

        temporary, root = self.mutate_authority_artifact("contract-reseal-authority.v1.json", mutate)
        self.addCleanup(temporary.cleanup)
        self.assert_rejected(root)

    def test_resealed_table_specification_drift_is_rejected(self) -> None:
        def mutate(value: dict[str, Any]) -> None:
            value["physicalContract"]["normativeTableSpecifications"]["specifications"][0]["tableName"] = "prf_cmp_plans"

        temporary, root = self.mutate_authority_artifact("contract-reseal-authority.v1.json", mutate)
        self.addCleanup(temporary.cleanup)
        self.assert_rejected(root)

    def test_resealed_dep019_ready_claim_is_rejected(self) -> None:
        def mutate(value: dict[str, Any]) -> None:
            dependency = value["dependencyContract"]
            dependency["dependencies"][4]["state"] = "READY_AT_FROZEN_BASE"
            dependency["dependencyPinsSha256"] = materializer.sha256(
                materializer.canonical_bytes(dependency["dependencies"])
            )

        temporary, root = self.mutate_authority_artifact("packet.v1.json", mutate)
        self.addCleanup(temporary.cleanup)
        self.assert_rejected(root)

    def test_resealed_control_request_registration_claim_is_rejected(self) -> None:
        temporary, root = self.mutate_authority_artifact(
            "packet.v1.json",
            lambda value: value["centralControlRequests"].__setitem__("registrationState", "REGISTERED"),
        )
        self.addCleanup(temporary.cleanup)
        self.assert_rejected(root)

    def test_resealed_v4_admission_is_rejected(self) -> None:
        temporary, root = self.mutate_authority_artifact(
            "migration-leases.delta.v1.json",
            lambda value: value.__setitem__("admission", True),
        )
        self.addCleanup(temporary.cleanup)
        self.assert_rejected(root)

    def test_encoded_path_traversal_is_rejected(self) -> None:
        def mutate(value: dict[str, Any]) -> None:
            selector = value["pathPolicy"]["allowedPaths"][0]
            selector["selector"] = "apps/dwp/src/%2e%2e/secrets/**"
            body = {key: item for key, item in value["pathPolicy"].items() if key != "pathPolicySha256"}
            value["pathPolicy"]["pathPolicySha256"] = materializer.sha256(materializer.canonical_bytes(body))

        temporary, root = self.mutate_authority_artifact("packet.v1.json", mutate)
        self.addCleanup(temporary.cleanup)
        self.assert_rejected(root)

    def test_allowed_common_path_collision_is_rejected(self) -> None:
        def mutate(value: dict[str, Any]) -> None:
            value["pathPolicy"]["commonControlOnlyPaths"][0] = copy.deepcopy(
                value["pathPolicy"]["allowedPaths"][0]
            )
            body = {key: item for key, item in value["pathPolicy"].items() if key != "pathPolicySha256"}
            value["pathPolicy"]["pathPolicySha256"] = materializer.sha256(materializer.canonical_bytes(body))

        temporary, root = self.mutate_authority_artifact("packet.v1.json", mutate)
        self.addCleanup(temporary.cleanup)
        self.assert_rejected(root)

    def test_forbidden_extra_token_artifact_is_rejected(self) -> None:
        temporary, root = self.copy_bundle()
        self.addCleanup(temporary.cleanup)
        token = root / "tokens" / "compplan.start-token.json"
        token.parent.mkdir()
        token.write_text("{}\n")
        self.assert_rejected(root)

    def test_manifest_mode_or_blob_tamper_is_rejected(self) -> None:
        temporary, root = self.copy_bundle()
        self.addCleanup(temporary.cleanup)
        manifest = read_json(root, "manifest.v1.json")
        manifest["toolPins"][0]["gitMode"] = "100755"
        manifest = reseal(manifest)
        write_json(root, "manifest.v1.json", manifest)
        self.assert_rejected(root)


if __name__ == "__main__":
    unittest.main(verbosity=2)
