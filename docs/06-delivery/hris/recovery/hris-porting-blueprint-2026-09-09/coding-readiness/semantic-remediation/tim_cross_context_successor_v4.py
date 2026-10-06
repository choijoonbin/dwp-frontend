#!/usr/bin/env python3
"""Bounded v4 planned source/assembler contract; synthetic only, not canonical."""
import copy
import hashlib
import importlib.util
import json
import re
import subprocess
import sys
from datetime import date, datetime, timedelta
from decimal import Decimal
from pathlib import Path

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
NODE = "/Users/a10697/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
PINS = {
    "../modern-capability-exact-schema-contracts.v1.json": "32b3d6c4e98037c0a26df0b08e112ad9ab067f95d70f3dc3d5dedf4f53f291fb",
    "tim-cross-context-boundary-successor.v3.md": "cc25cad8b769f30209859fe29a3de6b5819e17e785274b9052580e2460e51889",
    "../reports/tim-cross-context-boundary-v3-author-candidate-2026-09-14.json": "827a7ea602ff80daa27446534f540b61a28f2cb2469be0d46856713e7d9bca91",
    "../../session-evidence/tim/g2-physical-schema.sql": "01325e939dc1d116d53067d0332f348146d13c2be6a1e314357e82d3e2769a80",
    "../physical-owner-prefix-register.csv": "7413f9d227b889f7b86949d8998f40823d953ab097047646a34a00cc023c9cba",
    "tim-base-review-remediation.proposal.v1.json": "04a4785e199b9babc92ae71c0a35df282194bb97adccc7eb31579a602d2cc448",
    "validate_tim_base_review_remediation.py": "76d2c5b45098062def03ceaa3ad71dfa271a9160cdfc8deebc5d688f87dbc3e4",
    "tim-wfm-exact.proposal.v1.json": "d61723e26d9830ac634d2ae06ec44c758633519d80d95701d4cc30c901d52b11",
    "tim_cross_context_successor_v3.py": "b524d4b51ed62c5630a01ebf72e4df18a387369ef0b9baca6cd6cc175128c88f",
    "test_tim_cross_context_successor_v3.py": "8bcce6235f14a1cf030cc35375bebd4dc2bb5860c4d4808d0c686490c64edaf9",
    "tim-base-exact.proposal.v1.json": "5fbb5b1ae3fd92795939e4ecea85877035fae85cf1c32189db22e91037cc3933",
}
TREATMENTS = ("STOP_FUTURE_ONLY", "PRORATE_FINAL_PERIOD", "OWNER_APPROVED_SETTLEMENT")
SCOPED = ("tim.rule.create", "tim.leave.entitlement.run", "tim.leave.enrollment.cancel",
          "tim.leave.entitlement.input.get")
LOCAL_COMMON = {"tenant_id": ("INVOCATION", "invocation.tenantId"),
                "created_at": ("CLOCK", "clock.transactionTime"),
                "created_by": ("ACTOR", "invocation.actorPrincipalPublicId"),
                "public_id": ("ALLOCATOR", "allocator.persistedPublicUuid")}
UUID = {"type": "string", "format": "uuid"}
SHA = {"type": "string", "pattern": "^[a-f0-9]{64}$"}
INTEGER = {"type": "integer", "minimum": 0}
DATE = {"type": "string", "format": "date"}
INSTANT = {"type": "string", "format": "date-time"}


def object_schema(properties):
    return {"type": "object", "additionalProperties": False,
            "properties": properties, "required": list(properties)}


def ref(name):
    return {"$ref": "#/$defs/" + name}


def load_frozen():
    # The independent expected catalog is read from immutable base+review sources,
    # never accepted from a candidate-owned array or a synchronized edited count.
    for name, digest in PINS.items():
        if hashlib.sha256((HERE / name).read_bytes()).hexdigest() != digest:
            raise ValueError("frozen source pin mismatch: " + name)
    spec = importlib.util.spec_from_file_location("tim_v4_v3", HERE / "tim_cross_context_successor_v3.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    original, reviewed = module.load_inputs()
    return module, original, reviewed, module.build_successor(original, reviewed)


def canonical(value):
    """JSON decimal quantity wire stays string; schema-guided normalization elsewhere."""
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def digest(value, own_slot=None):
    unsigned = copy.deepcopy(value)
    if own_slot is not None:
        if own_slot not in unsigned:
            raise ValueError("missing own digest slot")
        unsigned.pop(own_slot)
    return hashlib.sha256(canonical(unsigned).encode()).hexdigest()


def normalize_decimal(value):
    if not isinstance(value, str) or not re.fullmatch(r"-?(0|[1-9][0-9]{0,12})(\.[0-9]{1,6})?", value):
        raise ValueError("DECIMAL_WIRE")
    n = Decimal(value)
    return "0" if not n else format(n.normalize(), "f")


def normalize_schema(value, schema, definitions):
    if "$ref" in schema:
        return normalize_schema(value, definitions[schema["$ref"].split("/")[-1]], definitions)
    branches = schema.get("oneOf", schema.get("anyOf", []))
    if branches:
        # Only normalize same-spelling quantities, never choose authority branches.
        for branch in branches:
            if "$ref" in branch and branch["$ref"].split("/")[-1] in {"TIM.Quantity.v1", "TIM.Rate.v1"}:
                return normalize_schema(value, branch, definitions)
    if schema.get("type") == "string" and schema.get("pattern") == "^-?(?:0|[1-9][0-9]{0,12})(?:\\.[0-9]{1,6})?$":
        return normalize_decimal(value)
    if isinstance(value, dict):
        return {k: normalize_schema(v, schema.get("properties", {}).get(k, {}), definitions) for k, v in value.items()}
    if isinstance(value, list):
        return [normalize_schema(v, schema.get("items", {}), definitions) for v in value]
    return value


def definitions(reviewed):
    result = copy.deepcopy(reviewed["$defs"])
    result["V4.ActorAuthority"] = object_schema({
        "actorPrincipalPublicId": UUID, "actorUserRowVersion": INTEGER,
        "actorAccessRevision": INTEGER, "authRevision": {"type": "string", "pattern": "^auth-[a-f0-9]{64}$"},
        "policyRevision": {"type": "string", "pattern": "^policy-.+$"},
        "contextKey": {"type": "string", "pattern": "^psc-[a-f0-9]{64}$"},
        "decisionRevision": {"type": "string", "pattern": "^psr-[a-f0-9]{64}$"}})
    result["V4.Header"] = object_schema({
        "tenantId": {"type": "integer", "minimum": 1}, "snapshotPublicId": UUID,
        "businessRevision": {"type": "integer", "minimum": 1}, "asOf": INSTANT,
        "validUntil": INSTANT, "purposeCode": {"type": "string", "minLength": 1},
        "populationScopeDigest": SHA, "contentSha256": SHA,
        "actorAuthority": ref("V4.ActorAuthority")})
    result["V4.NativeEmployment"] = object_schema({
        "personPublicId": UUID, "workerPublicId": UUID, "workRelationshipPublicId": UUID,
        "assignmentPublicId": UUID, "legalEmployerPublicId": UUID,
        "personVersion": INTEGER, "workerVersion": INTEGER,
        "workRelationshipVersion": INTEGER, "assignmentVersion": INTEGER,
        "employmentStartedOn": DATE, "employmentEndedOn": {"type": ["string", "null"], "format": "date"},
        "sourceRefs": {"type": "array", "items": ref("TIM.SourceRef.v1"), "minItems": 1}})
    result["V4.ScheduleSegment"] = object_schema({
        "segmentPublicId": UUID, "periodPublicId": UUID, "workerPublicId": UUID,
        "assignmentPublicId": UUID, "lineKey": {"type": "string", "minLength": 1},
        "localWorkDate": DATE, "startsAt": INSTANT, "endsAt": INSTANT,
        "timeZone": {"type": "string", "minLength": 1}, "startOffsetSeconds": {"type": "integer"},
        "endOffsetSeconds": {"type": "integer"}, "tzdbVersion": {"type": "string", "minLength": 1},
        "zoneRuleVersion": {"type": "string", "minLength": 1},
        "startDstResolution": {"type": "string", "enum": ["UNIQUE", "EARLIER", "LATER"]},
        "endDstResolution": {"type": "string", "enum": ["UNIQUE", "EARLIER", "LATER"]},
        "provenanceSha256": SHA, "kind": {"type": "string", "enum": ["WORK", "BREAK", "ON_CALL", "TRAINING", "ABSENCE"]},
        "paid": {"type": "boolean"}, "workRuleContentSha256": SHA})
    result["V4.CalendarPayload"] = object_schema({
        "calendarVersionPublicId": UUID, "revision": {"type": "integer", "minimum": 1},
        "timeZone": {"type": "string", "minLength": 1}, "effectiveFrom": DATE, "effectiveTo": DATE,
        "entries": {"type": "array", "items": ref("TIM.CalendarEntry.v1"), "minItems": 1}})
    result["V4.GovernancePayload"] = object_schema({
        "governanceRequestPublicId": UUID, "subjectPublicId": UUID,
        "subjectRowVersion": INTEGER, "subjectContentSha256": SHA,
        "decision": {"type": "string", "enum": ["PENDING", "APPROVED", "REJECTED", "CANCELLED", "RESULT_UNKNOWN"]}})
    result["V4.ConfigurationPayload"] = ref("SYS.EffectiveTimeConfigurationSnapshot.v1")
    result["V4.OwnerResponse"] = {"oneOf": [object_schema({
        "ownerContractId": {"const": kind}, "sourceStreamKey": {"const": stream},
        "header": ref("V4.Header"), "payload": ref(payload)})
        for kind, stream, payload in [
            ("HRM.NativeEmploymentSnapshot.proposal.v4", "people-employment", "V4.NativeEmployment"),
            ("SYS.TimeCalendarSnapshot.proposal.v4", "configuration-calendar", "V4.CalendarPayload"),
            ("TIME.PublishedCalendarSnapshot.proposal.v4", "time-calendar", "V4.CalendarPayload"),
            ("TIME.PublishedScheduleSnapshot.proposal.v4", "time-schedule", "V4.SchedulePayload"),
            ("SYS.AbsGovernanceDecision.proposal.v4", "configuration-leave-governance", "V4.GovernancePayload"),
            ("SYS.EffectiveTimeConfigurationSnapshot.proposal.v4", "configuration-time", "V4.ConfigurationPayload")]]}
    result["V4.SchedulePayload"] = object_schema({
        "publicationPublicId": UUID, "publicationRevision": {"type": "integer", "minimum": 1},
        "segments": {"type": "array", "items": ref("V4.ScheduleSegment"), "minItems": 1}})
    result["V4.PolicyReport"] = object_schema({
        "artifactKind": {"const": "LeavePolicy"}, "subjectPublicId": UUID,
        "subjectRowVersion": INTEGER, "subjectContentSha256": SHA,
        "reportKind": {"type": "string", "enum": ["VALIDATION", "SIMULATION"]},
        "ruleVersion": {"type": "string", "minLength": 1},
        "findings": {"type": "array", "items": object_schema({
            "code": {"type": "string", "minLength": 1},
            "fieldPath": {"type": "string", "minLength": 1},
            "severity": {"type": "string", "enum": ["BLOCK", "WARNING"]}})},
        "measures": {"type": "array", "items": object_schema({
            "code": {"type": "string", "minLength": 1},
            "value": {"type": "string", "pattern": "^-?(0|[1-9][0-9]*)(\\.[0-9]+)?$"},
            "unit": {"type": "string", "minLength": 1}})}})
    result["V4.TerminationInstruction"] = object_schema({
        "workflowPublicId": UUID, "enrollment": ref("TIM.EnrollmentVersionRef.v2"),
        "employmentTermination": ref("HRM.EmploymentTerminationSnapshot.v2"),
        "policyRef": ref("Ref.TIM.LeavePolicyArtifactSnapshot.v1"),
        "policyContent": ref("TIM.LeavePolicyContent.v1"),
        "ledgerSummary": ref("TIM.TerminationLedgerSummary.v2"),
        "treatment": {"type": "string", "enum": list(TREATMENTS)},
        "instructionSha256": SHA})
    # Retained source schemas are historical planned contracts, not newly published ABI.
    return result


def schema_engine(defs, schemas, cases):
    process = subprocess.run([NODE, str(HERE / "tim-cross-context-boundary-successor.v4.schema-engine.cjs")],
                             input=json.dumps({"definitions": defs, "schemas": schemas, "cases": cases}),
                             capture_output=True, text=True)
    if process.returncode:
        raise ValueError("SCHEMA_ENGINE: " + process.stdout + process.stderr)
    return json.loads(process.stdout)


def sql_bind_schemas(plan):
    """Internal planned bind shapes, not public responses or native JDBC evidence."""
    json_fields = {
        "input_payload": ref("TIM.EntitlementInputDocument.v2"), "selected_payload": ref("TIM.SelectedEntitlementItem.v2"),
        "instruction_payload": ref("V4.TerminationInstruction"), "command_payload": ref("TIM.TerminationSettlementCommand.v2"),
        "owner_receipt_payload": ref("PAY.TerminationSettlementReceipt.v2"), "outcome_payload": ref("TIM.EntitlementOutcome.v2"),
        "source_refs": {"type": "array", "items": ref("TIM.SourceRef.v1")},
        "rounding_trace": {"type": "array", "items": ref("TIM.ComputedEntitlementOutcome.v2")},
        "entries": {"type": "array", "items": ref("TIM.CalendarEntry.v1")}}
    result = {}
    for table in plan["structuralTables"]:
        if table["tableName"] not in plan["sourceGraphs"]:continue
        properties = {}
        for c in [table["idColumn"]] + table["columns"]:
            typ = c["sqlType"]
            if typ in {"BIGINT", "INTEGER"}: schema = {"type": "integer"}
            elif typ == "UUID":schema = UUID
            elif typ == "DATE":schema = DATE
            elif typ == "TIMESTAMPTZ":schema = INSTANT
            elif typ == "BOOLEAN":schema = {"type": "boolean"}
            elif typ.startswith("NUMERIC"):schema = {"type": "string", "pattern": "^-?(0|[1-9][0-9]{0,12})(\\.[0-9]{1,6})?$"}
            elif typ == "JSONB":
                if c["name"] == "content":
                    schema = ref("V4.PolicyReport") if table["tableName"] == "abs_policy_evaluation_reports" else {
                        "oneOf": [ref(x) for x in ["V4.NativeEmployment", "V4.CalendarPayload", "V4.SchedulePayload", "V4.GovernancePayload", "V4.ConfigurationPayload"]]}
                elif c["name"] == "rounding_trace":
                    schema = definitions(load_frozen()[2])["TIM.ComputedEntitlementOutcome.v2"]["properties"]["roundingTrace"]
                else:schema = json_fields[c["name"]]
            else:schema = {"type": "string", "maxLength": int(re.search(r"\(([0-9]+)\)",typ).group(1))}
            properties[c["name"]] = {"anyOf": [schema, {"type": "null"}]} if c.get("nullable") else schema
        result["V4.SqlBind." + table["tableName"]] = object_schema(properties)
    return result


def exact_parent_metadata(plan):
    path = HERE.parent.parent / "session-evidence/tim/g2-physical-schema.sql"
    sql = path.read_text()
    result = {}
    for name in ["tme_command_receipts", "tme_close_periods"]:
        body = re.search(r"CREATE TABLE " + name + r" \((.*?)\n\);", sql, re.S).group(1)
        cols = {}
        for line in body.splitlines():
            match = re.match(r"\s+([a-z_]+) (BIGSERIAL|BIGINT|UUID|VARCHAR\([0-9]+\)|CHAR\([0-9]+\)|TIMESTAMPTZ|DATE)", line)
            if match:
                cols[match[1]] = "BIGINT" if match[2] == "BIGSERIAL" else match[2]
        unique = [x.split(", ") for x in re.findall(r"UNIQUE \(([^)]+)\)", body)]
        result[name] = {"table": name, "schema": "public", "owner": "TIME",
                        "columns": cols, "uniqueKeys": unique, "sourcePath": str(path),
                        "sourceSha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                        "CURRENT_PUBLISHED": True, "evidenceKind": "SAVED_G2_SQL_NOT_OWN_NATIVE_REPLAY",
                        "newInternalReceiptUniqueRequired": False}
    wpath = HERE / "tim-wfm-exact.proposal.v1.json"
    w = json.loads(wpath.read_text())
    t = next(t for t in w["tableSpecifications"] if t["tableName"] == "tme_wfm_schedule_candidates")
    common_path = HERE.parent / "modern-capability-exact-schema-contracts.v1.json"
    common = json.loads(common_path.read_text())["commonTableContract"]["columns"]
    result[t["tableName"]] = {
        "table": t["tableName"], "schema": t["schema"], "owner": "TIME",
        "columns": {t["idColumn"]["name"]: t["idColumn"]["sqlType"],
                    **{c["name"]: c["sqlType"] for c in common if c["name"] != "__internal_id__"},
                    **{c["name"]: c["sqlType"] for c in t["columns"]}},
        "uniqueKeys": t["uniqueKeys"], "sourcePath": str(wpath),
        "sourceSha256": hashlib.sha256(wpath.read_bytes()).hexdigest(),
        "CURRENT_PUBLISHED": False, "evidenceKind": "UNPUBLISHED_WFM_PROPOSAL_NOT_NATIVE",
        "commonColumnSource": {"path": str(common_path), "sha256": hashlib.sha256(common_path.read_bytes()).hexdigest(),
                              "pointer": "/commonTableContract/columns"}}
    return result


def column_sources(name, identifier):
    result = {k: {"kind": kind, "inputs": [path]} for k, (kind, path) in LOCAL_COMMON.items()}
    result[identifier] = {"kind": "DB_RETURNING", "inputs": ["transaction.insert." + name + "." + identifier]}
    return result


def node(kind, *inputs):
    return {"kind": kind, "inputs": list(inputs)}


def graphs(plan):
    out = {}
    maps = {
        "abs_entitlement_runs": {
            "leave_plan_version_id": node("LOADED_LOCAL", "loaded.abs_leave_plan_versions.leave_plan_version_id"),
            "period_start": node("NORMALIZED_REQUEST", "normalized.periodStart"),
            "period_end": node("NORMALIZED_REQUEST", "normalized.periodEnd"),
            "run_mode": node("NORMALIZED_REQUEST", "normalized.mode"),
            "status": node("GUARDED_CONSTRUCTOR", "constructor.run.status", "loaded.run.row_version"),
            "input_snapshot_digest": node("CANONICAL_HASH", "constructor.input.contentSha256"),
            "rule_snapshot_digest": node("CANONICAL_HASH", "constructor.input.policyContent", "loaded.policy.content_digest"),
            "previous_run_id": node("CORRECTION_PARENT", "normalized.correctionMode", "loaded.previous_run.entitlement_run_id"),
            "row_version": node("CAS_RETURNING", "loaded.run.row_version", "transaction.update.run.row_version"),
            "lease_version": node("CAS_RETURNING", "loaded.run.lease_version", "transaction.update.run.lease_version"),
            "lease_expires_at": node("LEASE_GUARD", "clock.transactionTime", "loaded.run.lease_expires_at", "registered.workloadLeasePolicy"),
            "input_version_id": node("DB_RETURNING", "transaction.insert.abs_entitlement_input_versions.input_version_id"),
            "selected_count": node("CARDINALITY", "constructor.input.selectedItems"),
            "lease_owner_public_id": node("LEASE_GUARD", "invocation.workloadPrincipalPublicId", "loaded.run.lease_version"),
            "cancel_requested_at": node("CANCEL_FENCE", "clock.transactionTime", "loaded.run.row_version", "loaded.run.cancel_requested_at")},
        "abs_entitlement_run_items": {
            "entitlement_run_id": node("LOADED_LOCAL", "loaded.run.entitlement_run_id"),
            "enrollment_id": node("LOADED_LOCAL", "loaded.selected.enrollment_id"),
            "employment_snapshot_id": node("LOADED_LOCAL", "loaded.selected.employment_snapshot_id"),
            "calendar_snapshot_id": node("LOADED_LOCAL", "loaded.selected.calendar_snapshot_id"),
            "source_refs": node("OUTCOME_PROJECTION", "loaded.selected.selected_payload.employmentRef", "loaded.selected.selected_payload.calendarRef", "loaded.selected.selected_payload.configurationRef", "constructor.outcome.kind"),
            **{column: node("OUTCOME_PROJECTION", "constructor.outcome." + field, "loaded.run.lease_version", "loaded.run.cancel_requested_at")
               for column, field in [("numerator", "numerator"), ("denominator", "denominator"),
                   ("quantity", "quantity"), ("suppressed_quantity", "suppressedQuantity"),
                   ("rounding_trace", "roundingTrace"), ("status", "kind"), ("error_code", "errorCode"),
                   ("cancel_fence", "cancelFence")]},
            "unit": node("LOADED_LOCAL", "loaded.selected.selected_payload.unit", "constructor.outcome.kind"),
            "result_digest": node("CANONICAL_HASH", "constructor.outcome"),
            "input_version_id": node("LOADED_LOCAL", "loaded.run.input_version_id"),
            "selected_item_id": node("LOADED_LOCAL", "loaded.selected.selected_item_id"),
            "outcome_payload": node("GUARDED_CONSTRUCTOR", "constructor.outcome", "loaded.run.lease_version", "loaded.selected.selected_payload"),
            "lease_version": node("LEASE_GUARD", "loaded.run.lease_version", "invocation.observedLeaseVersion")},
        "abs_entitlement_input_versions": {
            "run_public_id": node("ALLOCATOR", "allocator.runPublicUuid"),
            "revision": node("IMMUTABLE_CONSTANT", "constant.newRunInputRevision1"),
            "selected_count": node("CARDINALITY", "constructor.input.selectedItems"),
            "selection_digest": node("CANONICAL_HASH", "constructor.input.selectedItems"),
            "input_payload": node("GUARDED_CONSTRUCTOR", "loaded.abs_leave_plan_versions.content", "loaded.selection.enrollments", "owner.employment.fullResponses", "owner.calendar.fullResponses", "owner.configuration.fullResponses", "loaded.ledger.revisions", "loaded.reservation.revisions", "normalized.periodStart", "normalized.periodEnd", "normalized.asOf", "normalized.mode", "allocator.runPublicUuid", "allocator.inputPublicUuid", "clock.transactionTime"),
            "content_digest": node("CANONICAL_HASH", "constructor.input", "constant.ownSlot_contentSha256")},
        "abs_entitlement_selected_items": {
            "input_version_id": node("DB_RETURNING", "transaction.insert.abs_entitlement_input_versions.input_version_id"),
            "ordinal": node("CANONICAL_ORDER", "constructor.input.selectedItems", "constructor.selected.enrollment.enrollmentPublicId"),
            "enrollment_id": node("LOADED_LOCAL", "loaded.abs_worker_plan_enrollments.enrollment_id", "constructor.selected.enrollment.enrollmentPublicId"),
            "enrollment_revision": node("LOADED_LOCAL", "loaded.abs_worker_plan_enrollments.row_version"),
            "employment_snapshot_id": node("DB_RETURNING", "transaction.insert.abs_owner_artifact_snapshots.owner_artifact_snapshot_id", "owner.employment.fullResponse"),
            "calendar_snapshot_id": node("DB_RETURNING", "transaction.insert.abs_calendar_version_snapshots.calendar_snapshot_id", "owner.calendar.fullResponse"),
            "selected_payload": node("GUARDED_CONSTRUCTOR", "constructor.input.selectedItems", "constructor.selected.ordinal"),
            "content_digest": node("CANONICAL_HASH", "constructor.selected")},
        "abs_enrollment_termination_workflows": {
            "enrollment_id": node("LOADED_LOCAL", "loaded.abs_worker_plan_enrollments.enrollment_id", "loaded.abs_worker_plan_enrollments.row_version"),
            "employment_ended_on": node("OWNER_RESPONSE", "owner.termination.employmentEndedOn"),
            "policy_treatment": node("LOADED_LOCAL", "loaded.abs_leave_plan_versions.content.terminationTreatment"),
            "instruction_payload": node("GUARDED_CONSTRUCTOR", "owner.termination.fullResponse", "loaded.abs_leave_plan_versions.content", "loaded.enrollment.versionRef", "loaded.ledger.summary", "allocator.workflowPublicUuid"),
            "instruction_digest": node("CANONICAL_HASH", "constructor.instruction", "constant.ownSlot_instructionSha256"),
            "status": node("GUARDED_CONSTRUCTOR", "constructor.instruction.treatment", "loaded.workflow.status", "owner.payReceipt.status"),
            "corrective_run_id": node("CORRECTION_PARENT", "constructor.instruction.treatment", "transaction.insert.abs_entitlement_runs.entitlement_run_id", "loaded.originalGrant.public_id", "loaded.originalRun.public_id"),
            "settlement_intent_id": node("DB_RETURNING", "constructor.instruction.treatment", "transaction.insert.abs_termination_settlement_intents.settlement_intent_id"),
            "final_settlement_public_id": node("OWNER_RESPONSE", "owner.payReceipt.finalSettlementPublicId", "owner.payReceipt.status", "loaded.intent.command_digest"),
            "row_version": node("CAS_RETURNING", "loaded.workflow.row_version", "transaction.update.workflow.row_version")},
        "abs_termination_settlement_intents": {
            "termination_workflow_id": node("DB_RETURNING", "transaction.insert.abs_enrollment_termination_workflows.termination_workflow_id"),
            "revision": node("IMMUTABLE_CONSTANT", "constant.newIntentRevision1"),
            "command_payload": node("GUARDED_CONSTRUCTOR", "constructor.instruction", "loaded.ledger.summary", "allocator.intentPublicUuid", "registered.settlementPurpose"),
            "command_digest": node("CANONICAL_HASH", "constructor.command", "constant.ownSlot_commandSha256"),
            "owner_receipt_payload": node("OWNER_RESPONSE", "owner.payReceipt.fullResponse", "loaded.intent.command_digest"),
            "status": node("OWNER_RESPONSE", "owner.payReceipt.status", "loaded.intent.status"),
            "row_version": node("CAS_RETURNING", "loaded.intent.row_version", "transaction.update.intent.row_version")}
    }
    owner_maps = {
        "abs_owner_artifact_snapshots": {
            "owner_contract_id": "owner.response.ownerContractId", "snapshot_public_id": "owner.response.header.snapshotPublicId",
            "snapshot_revision": "owner.response.header.businessRevision", "content_schema_id": "registered.ownerSchemaByContractId",
            "content": "owner.response.payload", "content_digest": "owner.response.header.contentSha256",
            "as_of": "owner.response.header.asOf", "valid_until": "owner.response.header.validUntil",
            "source_stream_key": "owner.response.sourceStreamKey", "purpose_code": "owner.response.header.purposeCode",
            "scope_digest": "owner.response.header.populationScopeDigest"},
        "abs_calendar_version_snapshots": {
            "owner_snapshot_id": "transaction.insert.abs_owner_artifact_snapshots.owner_artifact_snapshot_id",
            "calendar_version_public_id": "owner.calendar.payload.calendarVersionPublicId",
            "calendar_revision": "owner.calendar.payload.revision", "content_digest": "owner.calendar.header.contentSha256",
            "time_zone": "owner.calendar.payload.timeZone", "effective_from": "owner.calendar.payload.effectiveFrom",
            "effective_to": "owner.calendar.payload.effectiveTo", "entries": "owner.calendar.payload.entries"},
        "abs_time_schedule_segment_snapshots": dict(zip(
            ["line_key", "local_work_date", "starts_at", "ends_at", "source_time_zone", "start_utc_offset_seconds",
             "end_utc_offset_seconds", "tzdb_version", "zone_rule_version", "start_dst_resolution", "end_dst_resolution",
             "provenance_digest", "segment_type", "paid", "rule_digest", "source_segment_public_id", "source_period_public_id",
             "worker_public_id", "assignment_public_id"],
            ["owner.schedule.row." + x for x in ["lineKey", "localWorkDate", "startsAt", "endsAt", "timeZone",
             "startOffsetSeconds", "endOffsetSeconds", "tzdbVersion", "zoneRuleVersion", "startDstResolution",
             "endDstResolution", "provenanceSha256", "kind", "paid", "workRuleContentSha256", "segmentPublicId",
             "periodPublicId", "workerPublicId", "assignmentPublicId"]])),
        "abs_policy_evaluation_reports": {
            "artifact_kind": "evaluator.report.artifactKind", "subject_public_id": "evaluator.report.subjectPublicId",
            "subject_row_version": "evaluator.report.subjectRowVersion", "subject_digest": "evaluator.report.subjectContentSha256",
            "report_kind": "evaluator.report.reportKind", "content": "evaluator.report", "result_digest": "constructor.reportDigest"},
        "abs_policy_governance_bindings": {
            "leave_policy_version_id": "loaded.abs_leave_plan_versions.leave_plan_version_id",
            "subject_row_version": "loaded.abs_leave_plan_versions.row_version",
            "subject_digest": "loaded.abs_leave_plan_versions.content_digest", "requester_public_id": "invocation.actorPrincipalPublicId",
            "sys_governance_request_public_id": "owner.governance.payload.governanceRequestPublicId",
            "owner_snapshot_id": "transaction.insert.abs_owner_artifact_snapshots.owner_artifact_snapshot_id",
            "status": "constructor.governanceStatus"}
    }
    owner_maps["abs_time_schedule_segment_snapshots"].update({
        "source_snapshot_public_id": "owner.schedule.header.snapshotPublicId",
        "source_revision": "owner.schedule.header.businessRevision", "source_as_of": "owner.schedule.header.asOf",
        "valid_until": "owner.schedule.header.validUntil", "population_scope_digest": "owner.schedule.header.populationScopeDigest"})
    for table in plan["tableSpecifications"]:
        name = table["tableName"]
        if name not in maps and name not in owner_maps:
            continue
        nodes = column_sources(name, table["idColumn"]["name"])
        nodes.update(maps.get(name, {}))
        for column, path in owner_maps.get(name, {}).items():
            kind = "LOCAL_EVALUATOR" if path.startswith("evaluator.") else "OWNER_RESPONSE" if path.startswith("owner.") else "LOADED_LOCAL" if path.startswith("loaded.") else "DB_RETURNING" if path.startswith("transaction.") else "ACTOR" if path.startswith("invocation.") else "GUARDED_CONSTRUCTOR"
            nodes[column] = node(kind, path)
        expected = {table["idColumn"]["name"]} | {c["name"] for c in table["columns"]}
        if set(nodes) != expected:
            raise ValueError("typed source map column mismatch: " + name + str(expected ^ set(nodes)))
        types = {table["idColumn"]["name"]: "BIGINT", **{c["name"]: c["sqlType"] for c in table["columns"]}}
        for column, item in nodes.items():
            item.update(sqlType=types[column], sourceApproval="PLANNED_NOT_NATIVE_PEP",
                        nullable=next((c["nullable"] for c in table["columns"] if c["name"] == column), False))
            for path in item["inputs"]:
                prefix = next((p for p in ["owner.schedule.row.", "owner.schedule.header.", "owner.calendar.payload.",
                         "owner.calendar.header.", "owner.governance.payload.", "evaluator.report.", "owner.payReceipt."] if path.startswith(p)), None)
                if prefix:
                    schema_name = {"owner.schedule.row.": "V4.ScheduleSegment", "owner.schedule.header.": "V4.Header",
                        "owner.calendar.payload.": "V4.CalendarPayload", "owner.calendar.header.": "V4.Header",
                        "owner.governance.payload.": "V4.GovernancePayload", "evaluator.report.": "V4.PolicyReport",
                        "owner.payReceipt.": "PAY.TerminationSettlementReceipt.v2"}[prefix]
                    if path.endswith("fullResponse"):continue
                    item.setdefault("typedFieldAdapters", []).append({"source": path,
                        "schemaRef": "#/$defs/" + schema_name, "fieldPath": path[len(prefix):],
                        "authority": "PLANNED_REFETCHED_OWNER" if prefix.startswith("owner.") else "ABS_LOCAL_EVALUATOR"})
        out[name] = nodes
    return out


TOKEN = re.compile(r"\s*('(?:[^']|'')*'|-?[0-9]+|>=|<=|<>|=|>|<|\(|\)|,|[A-Za-z_][A-Za-z_0-9]*)")


def parse_guard(text, columns):
    # Preserve explicit malformed spacing repair as a disposition, not historical edit.
    source = text
    text = re.sub(r"\bAND(?=-?[0-9])", "AND ", text)
    pieces = TOKEN.findall(text)
    if "".join(pieces) != re.sub(r"\s+", "", text):
        raise ValueError("NON_SQL_SEMANTIC")
    i = 0
    def take():
        nonlocal i
        if i >= len(pieces): raise ValueError("guard missing token")
        value = pieces[i]; i += 1; return value
    def atom():
        nonlocal i
        x = take()
        if x == "(":
            n = boolean(); assert take() == ")"; return n
        if x.startswith("'"): return {"op": "LITERAL", "value": x[1:-1].replace("''", "'")}
        if re.fullmatch(r"-?[0-9]+", x): return {"op": "LITERAL", "value": int(x)}
        if x == "num_nonnulls":
            assert take() == "("; args = [atom()]
            while pieces[i] == ",": take(); args.append(atom())
            assert take() == ")"; return {"op": "NUM_NONNULLS", "args": args}
        if x not in columns: raise ValueError("unknown guard column " + x)
        return {"op": "COLUMN", "name": x, "sqlType": columns[x]}
    def comparison():
        nonlocal i
        left = atom()
        if i == len(pieces) or pieces[i] in {")", "AND", "OR"}: return left
        op = take()
        if op == "IS":
            neg = False
            if pieces[i] == "NOT":take();neg = True
            assert take() == "NULL";return {"op": "IS_NOT_NULL" if neg else "IS_NULL", "arg": left}
        if op == "IN":
            assert take() == "("; args = [atom()]
            while pieces[i] == ",": take();args.append(atom())
            assert take() == ")";return {"op": "IN", "arg": left, "values": args}
        if op == "BETWEEN":
            lower = atom();assert take() == "AND";return {"op": "BETWEEN", "arg": left, "lower": lower, "upper": atom()}
        if op not in {"=", "<>", ">", "<", ">=", "<="}:raise ValueError("NON_SQL_SEMANTIC")
        return {"op": "COMPARE", "operator": op, "left": left, "right": atom()}
    def conjunction():
        nonlocal i
        args = [comparison()]
        while i < len(pieces) and pieces[i] == "AND":take();args.append(comparison())
        return args[0] if len(args) == 1 else {"op": "AND", "args": args}
    def boolean():
        nonlocal i
        args = [conjunction()]
        while i < len(pieces) and pieces[i] == "OR":take();args.append(conjunction())
        return args[0] if len(args) == 1 else {"op": "OR", "args": args}
    ast = boolean()
    if i != len(pieces):raise ValueError("NON_SQL_SEMANTIC")
    return {"kind": "SQL_CHECK_AST", "source": source, "normalizedSql": text, "ast": ast,
            "spacingRepair": source != text}


def guard_dispositions(plan):
    result = []
    for table in plan["tableSpecifications"]:
        columns = {table["idColumn"]["name"]: "BIGINT", **{c["name"]: c["sqlType"] for c in table["columns"]}}
        for index, text in enumerate(table.get("checks", [])):
            try: item = parse_guard(text, columns)
            except (ValueError, AssertionError, IndexError):
                item = {"kind": "OWNER_SEMANTIC_REQUIRED_OPEN", "source": text,
                        "requiredOwner": "ABS" if table["tableName"].startswith("abs_") else "TIME",
                        "failClosed": True, "approval": "NOT_IMPLEMENTED_OR_PROVED"}
            result.append({"table": table["tableName"], "ordinal": index, **item})
    return result


def build():
    module, original, reviewed, structural = load_frozen()
    actual = tuple(reviewed["$defs"]["TIM.LeavePolicyContent.v1"]["properties"]["terminationTreatment"]["enum"])
    if set(actual) != set(TREATMENTS):raise ValueError("frozen termination oracle changed")
    catalog = [o["operationId"] for o in reviewed["operationDeltas"]]
    unclosed = [o for o in catalog if o not in SCOPED]
    source_graphs = graphs(structural)
    # Old cloned prose is explicitly non-executable; v4 only exposes scoped typed graphs.
    old_sources = {t["tableName"]: t["insertColumnExpressions"] for t in structural["tableSpecifications"] if t["tableName"].startswith("abs_")}
    for table in structural["tableSpecifications"]:
        table.pop("insertColumnExpressions", None)
        table.pop("plannedCreateSql", None)
    ops = [copy.deepcopy(o) for o in structural["operationDeltas"] if o["operationId"] in SCOPED]
    plan = {"contractId": "TIM_CONTEXT_BOUNDARY_SUCCESSOR_V4_BOUNDED", "CURRENT_PUBLISHED": False,
            "G3Gate": "CLOSED_FAIL_SAFE", "nativeExecution": False, "sqlExecutionAllowed": False,
            "wholeSourceMeaningApproved": False, "canonicalDialectApproved": False,
            "independentExpectedCatalog": catalog, "unclosedOperationIds": unclosed,
            "scopedOperationContracts": ops, "structuralTables": structural["tableSpecifications"],
            "boundaryDispositions": structural["boundaryDispositions"],
            "externalParents": exact_parent_metadata(structural), "sourceGraphs": source_graphs,
            "guardDispositions": guard_dispositions(structural), "terminationTreatments": list(TREATMENTS),
            "historicalQuarantinedSources": old_sources,
            "remainingOpen": ["FULL_112_SOURCE_FAMILIES_AND_4_SUBTARGET_REGISTRATION",
                              "NATIVE_CURRENT_AUTH_PEP_FIELD_PURPOSE_POPULATION_AND_TRANSPORT",
                              "SHARED_DTO_SPI_PRODUCER_CONSUMER_COMPILE",
                              "WFM_PARENT_NATIVE_PUBLICATION_AND_FULL_DEPENDENCY_SQL",
                              "OWNER_SEMANTIC_GUARD_HANDLER_NATIVE_ATOMIC_CAS",
                              "CANONICAL_DIALECT_OWNER_SCHEMA_REGISTRY_AND_MANIFEST_ALLOCATION"],
            "neutralInfrastructurePlan": {"status": "INTERNAL_EXPERT_REVIEW_PENDING",
                 "ownerTuple": ["dwp-time-server", "NEUTRAL_TIM_COMMAND_EVENT_INFRASTRUCTURE", "public"],
                 "tables": ["tme_command_receipts", "tme_outbox_events", "tme_inbox_receipts"],
                 "allowedReadWrite": {"tme_command_receipts": ["INSERT_CURRENT_AUTHORIZED_COMMAND", "READ_EXACT_TENANT_RECEIPT", "UPDATE_GUARDED_STATUS"],
                                      "tme_outbox_events": ["INSERT_SAME_TRANSACTION_MINIMAL_TYPED_EVENT", "LEASE_DELIVERY_CAS"],
                                      "tme_inbox_receipts": ["INSERT_DEDUP_EXACT_AUTHENTICATED_OWNER_EVENT", "READ_EXACT_TENANT_EVENT"]},
                 "noBusinessRepositoryAccessException": True, "noCrossContextFkException": True}}
    plan["plannedCheckSqlMaterials"] = ["ALTER TABLE public." + g["table"] + " ADD CONSTRAINT " +
                g["table"] + "_v4_c" + str(g["ordinal"]) + " CHECK (" + g["normalizedSql"] + ");"
                for g in plan["guardDispositions"] if g["kind"] == "SQL_CHECK_AST"]
    validate(plan)
    return plan, definitions(reviewed)


def validate(plan):
    _, _, reviewed, structural = load_frozen()
    catalog = [o["operationId"] for o in reviewed["operationDeltas"]]
    if any(plan[k] for k in ["CURRENT_PUBLISHED", "nativeExecution", "sqlExecutionAllowed", "wholeSourceMeaningApproved", "canonicalDialectApproved"]) or plan["G3Gate"] != "CLOSED_FAIL_SAFE":
        raise ValueError("NO_AUTHORIZATION_OR_NATIVE_EXECUTION")
    if plan["independentExpectedCatalog"] != catalog or plan["unclosedOperationIds"] != [x for x in catalog if x not in SCOPED] or [x["operationId"] for x in plan["scopedOperationContracts"]] != [x for x in catalog if x in SCOPED]:
        raise ValueError("INDEPENDENT_CATALOG_DRIFT")
    if plan["boundaryDispositions"] != structural["boundaryDispositions"]:
        raise ValueError("BOUNDARY_INVENTORY_DRIFT")
    required = {"FULL_112_SOURCE_FAMILIES_AND_4_SUBTARGET_REGISTRATION", "NATIVE_CURRENT_AUTH_PEP_FIELD_PURPOSE_POPULATION_AND_TRANSPORT", "SHARED_DTO_SPI_PRODUCER_CONSUMER_COMPILE", "WFM_PARENT_NATIVE_PUBLICATION_AND_FULL_DEPENDENCY_SQL", "OWNER_SEMANTIC_GUARD_HANDLER_NATIVE_ATOMIC_CAS", "CANONICAL_DIALECT_OWNER_SCHEMA_REGISTRY_AND_MANIFEST_ALLOCATION"}
    if set(plan["remainingOpen"]) != required:raise ValueError("OPEN_REGISTRY_HIDE")
    if set(plan["terminationTreatments"]) != set(TREATMENTS):raise ValueError("TREATMENT_ENUM")
    expected_parents = exact_parent_metadata(structural)
    if plan["externalParents"] != expected_parents:raise ValueError("EXTERNAL_PARENT_PROVENANCE_DRIFT")
    tables = {t["tableName"]: t for t in plan["structuralTables"]}
    expected_tables = {t["tableName"]: t for t in structural["tableSpecifications"]}
    def cols(t):return {t["idColumn"]["name"]: "BIGINT", **{c["name"]: c["sqlType"] for c in t["columns"]}}
    if set(tables) != set(expected_tables) or any(cols(tables[n]) != cols(expected_tables[n]) for n in tables):
        raise ValueError("FROZEN_PHYSICAL_COLUMN_TYPE_DRIFT")
    if any(tables[n]["columns"] != expected_tables[n]["columns"] or tables[n]["idColumn"] != expected_tables[n]["idColumn"] for n in tables):raise ValueError("FROZEN_PHYSICAL_NULLABILITY_ID_DRIFT")
    for t in tables.values():
        for fk in t["foreignKeys"]:
            parent = tables.get(fk["targetTable"], plan["externalParents"].get(fk["targetTable"]))
            if parent is None:raise ValueError("UNKNOWN_PARENT")
            parent_cols = cols(parent) if "tableName" in parent else parent["columns"]
            if not fk["columns"] or len(fk["columns"]) != len(fk["targetColumns"]):raise ValueError("FK_ARITY")
            if fk["columns"][0] != "tenant_id" or fk["targetColumns"][0] != "tenant_id":raise ValueError("FK_TENANT_PREFIX")
            if fk["targetColumns"] not in parent["uniqueKeys"]:raise ValueError("FK_PARENT_UNIQUE")
            for c, target in zip(fk["columns"], fk["targetColumns"]):
                if c not in cols(t) or target not in parent_cols or cols(t)[c] != parent_cols[target]:raise ValueError("FK_COLUMN_OR_TYPE")
            if t["tableName"][:4] != fk["targetTable"][:4]:raise ValueError("CROSS_CONTEXT_FK")
        if t["foreignKeys"] != expected_tables[t["tableName"]]["foreignKeys"] or t["uniqueKeys"] != expected_tables[t["tableName"]]["uniqueKeys"]:raise ValueError("EXACT_PARENT_FK_UK_IDENTITY_DRIFT")
    if plan["sourceGraphs"] != graphs(structural):raise ValueError("EXACT_SOURCE_GRAPH_DRIFT")
    for graph in plan["sourceGraphs"].values():
        for n in graph.values():
            if not n["inputs"] or any(not isinstance(x, str) or not x.strip() or "tme_" in x or "body." in x for x in n["inputs"]):
                raise ValueError("ILLEGAL_ABS_SOURCE")
    neutral = set(plan["neutralInfrastructurePlan"]["tables"])
    if neutral != {"tme_command_receipts", "tme_outbox_events", "tme_inbox_receipts"} or plan["neutralInfrastructurePlan"]["status"] != "INTERNAL_EXPERT_REVIEW_PENDING" or not plan["neutralInfrastructurePlan"]["noBusinessRepositoryAccessException"] or not plan["neutralInfrastructurePlan"]["noCrossContextFkException"]:raise ValueError("NEUTRAL_INFRASTRUCTURE_PLAN_DRIFT")
    def native_references(value):
        if isinstance(value, dict):return [r for x in value.values() for r in native_references(x)]
        if isinstance(value, list):return [r for x in value for r in native_references(x)]
        return re.findall(r"\btme_[a-z0-9_]+\b", value) if isinstance(value, str) else []
    for op in plan["scopedOperationContracts"]:
        if op["aggregateTable"].startswith("abs_"):
            for table in op["readsTables"] + op["writesTables"]:
                if table.startswith("tme_") and table not in neutral:raise ValueError("ABS_TIME_BUSINESS_ACCESS")
            if any(r not in neutral for r in native_references(op)):raise ValueError("ABS_NESTED_TIME_BUSINESS_REFERENCE")
    if plan["guardDispositions"] != guard_dispositions(structural):raise ValueError("GUARD_DISPOSITION_LOSS")
    expected_materials = ["ALTER TABLE public." + g["table"] + " ADD CONSTRAINT " + g["table"] + "_v4_c" + str(g["ordinal"]) + " CHECK (" + g["normalizedSql"] + ");" for g in plan["guardDispositions"] if g["kind"] == "SQL_CHECK_AST"]
    if plan["plannedCheckSqlMaterials"] != expected_materials:raise ValueError("CHECK_SQL_MATERIAL_DRIFT")
    defs = definitions(reviewed)
    for graph in plan["sourceGraphs"].values():
        for entry in graph.values():
            for adapter in entry.get("typedFieldAdapters", []):
                schema = defs[adapter["schemaRef"].split("/")[-1]]
                for part in adapter["fieldPath"].split("."):
                    schema = schema["properties"][part]
                sql = entry["sqlType"]
                expected = "integer" if sql in {"BIGINT", "INTEGER"} else "boolean" if sql == "BOOLEAN" else "string" if sql != "JSONB" else None
                inferred = schema.get("type")
                if inferred is None and "const" in schema:
                    inferred = "string" if isinstance(schema["const"], str) else "boolean" if isinstance(schema["const"], bool) else "integer" if isinstance(schema["const"], int) else None
                if expected and inferred != expected and not any(s.get("type") == expected for s in schema.get("anyOf", [])):
                    raise ValueError("OWNER_FIELD_SQL_TYPE")


def assemble_input(document, defs):
    item = normalize_schema(copy.deepcopy(document), ref("TIM.EntitlementInputDocument.v2"), defs)
    selected = item["selectedItems"]
    keys = [x["enrollment"]["enrollmentPublicId"].lower() for x in selected]
    if keys != sorted(keys) or len(set(keys)) != len(keys):raise ValueError("SELECTION_ORDER_OR_DUPLICATE")
    for i, row in enumerate(selected, 1):
        if row["ordinal"] != i or row["inputVersionPublicId"] != item["inputVersionPublicId"]:raise ValueError("SELECTED_PARENT")
    if len({x["selectedItemPublicId"] for x in selected}) != len(selected):raise ValueError("SELECTED_DUPLICATE")
    if item["revision"] != 1 or item["selectedCount"] != len(selected) or not selected:raise ValueError("INPUT_COUNT_REVISION")
    if date.fromisoformat(item["periodEnd"]) <= date.fromisoformat(item["periodStart"]):raise ValueError("INPUT_DATE_RANGE")
    if any(x["unit"] != item["policyContent"]["unit"] for x in selected):raise ValueError("INPUT_UNIT")
    if any((x["correctionMode"] == "NONE") != (x["originalGrantPublicId"] is None and x["originalRunPublicId"] is None) for x in selected):raise ValueError("CORRECTION_ORIGINAL_SOURCE")
    item["selectionDigest"] = digest(selected)
    item["contentSha256"] = digest(item, "contentSha256")
    schema_engine(defs, {"INPUT": ref("TIM.EntitlementInputDocument.v2")}, [{"id": "assembled_input", "schema": "INPUT", "value": item, "valid": True}])
    return item


def prepare_input(request, loaded_input_template, policy_refetch, defs):
    request_schema = object_schema({"periodStart": DATE, "periodEnd": DATE, "asOf": INSTANT,
                        "mode": {"type": "string", "enum": ["DRY_RUN", "POST"]}})
    schema_engine(defs, {"REQUEST": request_schema}, [{"id": "prepare_request", "schema": "REQUEST", "value": request, "valid": True}])
    if policy_refetch is None:raise ValueError("POLICY_REFETCH_MISSING")
    policy = policy_refetch()
    if set(policy) != {"policyRef", "policyContent"}:raise ValueError("FULL_POLICY_SOURCE")
    item = copy.deepcopy(loaded_input_template)
    item.update(periodStart=request["periodStart"], periodEnd=request["periodEnd"], asOf=request["asOf"], mode=request["mode"])
    item.update(policyRef=policy["policyRef"], policyContent=policy["policyContent"])
    return assemble_input(item, defs)


def refetch_input(document, selected_rows, expected_run_uuid, expected_digest, defs):
    calculated = assemble_input(document, defs)
    if document["runPublicId"] != expected_run_uuid or document["contentSha256"] != expected_digest or calculated != document or selected_rows != document["selectedItems"]:
        raise ValueError("IMMUTABLE_INPUT_REFETCH")
    return calculated


def termination_instruction(instruction, defs):
    x = copy.deepcopy(instruction)
    treatment = x["policyContent"]["terminationTreatment"]
    if treatment not in TREATMENTS or x["treatment"] != treatment:raise ValueError("TREATMENT_OWNER_SOURCE")
    if x["employmentTermination"]["workerPublicId"] != x["enrollment"]["workerPublicId"] or x["enrollment"]["assignmentPublicId"] not in x["employmentTermination"]["assignmentPublicIds"]:
        raise ValueError("TERMINATION_SUBJECT_PARENT")
    last = date.fromisoformat(x["employmentTermination"]["employmentEndedOn"])
    boundary = (last + timedelta(days=1)).isoformat()
    x["instructionSha256"] = digest(x, "instructionSha256")
    schema_engine(defs, {"INSTRUCTION": ref("V4.TerminationInstruction")}, [{"id": "termination_instruction", "schema": "INSTRUCTION", "value": x, "valid": True}])
    return {"instruction": x, "enrollmentEffectiveToExclusive": boundary,
            "workflowStatus": {"STOP_FUTURE_ONLY": "STOPPED", "PRORATE_FINAL_PERIOD": "CORRECTION_QUEUED", "OWNER_APPROVED_SETTLEMENT": "SETTLEMENT_PENDING"}[treatment],
            "newCorrectiveRunRequired": treatment == "PRORATE_FINAL_PERIOD",
            "newSettlementIntentRequired": treatment == "OWNER_APPROVED_SETTLEMENT",
            "ownerDeliveryCalls": 0 if treatment != "OWNER_APPROVED_SETTLEMENT" else None,
            "nativeAuth": False, "DML": False}


def project_schedule(owner_response, row_index, local, defs):
    schema_engine(defs, {"OWNER": ref("V4.OwnerResponse")}, [{"id": "schedule_response", "schema": "OWNER", "value": owner_response, "valid": True}])
    if owner_response["ownerContractId"] != "TIME.PublishedScheduleSnapshot.proposal.v4":raise ValueError("SCHEDULE_OWNER")
    header = owner_response["header"]
    if header["actorAuthority"]["actorPrincipalPublicId"] != local["actorPrincipalPublicId"]:raise ValueError("OWNER_ACTOR_BINDING")
    if header["tenantId"] != local["tenantId"] or header["purposeCode"] != local["purposeCode"] or header["populationScopeDigest"] != local["scopeDigest"]:raise ValueError("OWNER_TENANT_PURPOSE_SCOPE")
    if datetime.fromisoformat(header["validUntil"].replace("Z", "+00:00")) <= datetime.fromisoformat(local["now"].replace("Z", "+00:00")):raise ValueError("OWNER_STALE")
    if digest(owner_response["payload"]) != header["contentSha256"]:raise ValueError("OWNER_CONTENT_DIGEST")
    row = owner_response["payload"]["segments"][row_index]
    if row["workerPublicId"] != local["workerPublicId"] or row["assignmentPublicId"] != local["assignmentPublicId"]:raise ValueError("SCHEDULE_POPULATION")
    if row["endsAt"] <= row["startsAt"]:raise ValueError("SCHEDULE_INTERVAL")
    result = {}
    g = graphs(load_frozen()[3])["abs_time_schedule_segment_snapshots"]
    for col, n in g.items():
        path = n["inputs"][0]
        if path.startswith("owner.schedule.row."):result[col] = row[path.split(".")[-1]]
        elif path.startswith("owner.schedule.header."):result[col] = header[path.split(".")[-1]]
        elif col in local:result[col] = local[col]
        else:result[col] = {"tenant_id": local["tenantId"], "created_at": local["now"], "created_by": local["actorPrincipalPublicId"], "public_id": local["projectionPublicId"], "scheduled_segment_id": local["returningInternalId"]}[col]
    return result


def project_abs_import(table_name, environment, defs):
    plan = load_frozen()[3]
    bindings = graphs(plan)[table_name]
    if table_name == "abs_policy_evaluation_reports":
        report = environment["evaluator"]["report"]
        schema_engine(defs, {"REPORT": ref("V4.PolicyReport")}, [{"id": "local_abs_report", "schema": "REPORT", "value": report, "valid": True}])
        policy = environment["loaded"]["abs_leave_plan_versions"]
        if (report["subjectPublicId"], report["subjectRowVersion"], report["subjectContentSha256"]) != (policy["public_id"], policy["row_version"], policy["content_digest"]):raise ValueError("LOCAL_EVALUATOR_SUBJECT")
    else:
        response = environment["owner"].get("response", environment["owner"].get("calendar", environment["owner"].get("governance")))
        schema_engine(defs, {"OWNER": ref("V4.OwnerResponse")}, [{"id": "import_owner_response", "schema": "OWNER", "value": response, "valid": True}])
        header = response["header"]
        if header["actorAuthority"]["actorPrincipalPublicId"] != environment["invocation"]["actorPrincipalPublicId"]:raise ValueError("OWNER_ACTOR_BINDING")
        if header["tenantId"] != environment["invocation"]["tenantId"] or digest(response["payload"]) != header["contentSha256"]:raise ValueError("OWNER_TENANT_CONTENT")
        if header["purposeCode"] != environment["invocation"]["purposeCode"] or header["populationScopeDigest"] != environment["invocation"]["scopeDigest"]:raise ValueError("OWNER_PURPOSE_SCOPE")
        if datetime.fromisoformat(header["validUntil"].replace("Z", "+00:00")) <= datetime.fromisoformat(environment["clock"]["transactionTime"].replace("Z", "+00:00")):raise ValueError("OWNER_STALE")
        if table_name == "abs_policy_governance_bindings":
            p = environment["loaded"]["abs_leave_plan_versions"]
            if (response["payload"]["subjectPublicId"], response["payload"]["subjectRowVersion"], response["payload"]["subjectContentSha256"]) != (p["public_id"], p["row_version"], p["content_digest"]):raise ValueError("GOVERNANCE_ABS_SUBJECT")
    result = {}
    for col, source in bindings.items():
        value = environment
        for part in source["inputs"][0].split("."):value = value[part]
        result[col] = copy.deepcopy(value)
    return result


def optional_owner(enabled, adapter):
    if not enabled:return None
    if adapter is None:raise ValueError("REQUIRED_OWNER_ADAPTER_MISSING")
    return adapter()


def project_outcome(outcome, selected, run, defs):
    schema_engine(defs, {"OUTCOME": ref("TIM.EntitlementOutcome.v2")},
                  [{"id": "outcome_projection", "schema": "OUTCOME", "value": outcome, "valid": True}])
    kind = outcome["kind"]
    if outcome["selectedItemPublicId"] != selected["selectedItemPublicId"] or outcome["inputSha256"] != run["inputSha256"]:
        raise ValueError("OUTCOME_SELECTED_INPUT_PARENT")
    if kind == "CANCELLED":
        if run["cancelFence"] != outcome["cancelFence"]:raise ValueError("CANCEL_FENCE")
    elif outcome["leaseVersion"] != run["leaseVersion"]:raise ValueError("LEASE_FENCE")
    computed = kind in {"CALCULATED", "POSTED"}
    if computed and (outcome["unit"] != selected["unit"] or (kind == "POSTED") != (run["mode"] == "POST")):
        raise ValueError("OUTCOME_UNIT_MODE")
    values = {column: outcome[field] if computed else None for column, field in
              [("numerator", "numerator"), ("denominator", "denominator"), ("quantity", "quantity"),
               ("suppressed_quantity", "suppressedQuantity"), ("rounding_trace", "roundingTrace")]}
    values.update(status=kind, unit=selected["unit"], outcome_payload=copy.deepcopy(outcome),
                  result_digest=digest(outcome), error_code=outcome["errorCode"] if kind in {"BLOCKED", "FAILED"} else None,
                  cancel_fence=outcome["cancelFence"] if kind == "CANCELLED" else None,
                  lease_version=run["leaseVersion"], source_refs=[selected[x] for x in
                  ["employmentRef", "calendarRef", "configurationRef"]])
    return values


def eval_guard(ast, row):
    op = ast["op"]
    if op == "COLUMN":return row[ast["name"]]
    if op == "LITERAL":return ast["value"]
    if op in {"AND", "OR"}:
        values = [eval_guard(a,row) for a in ast["args"]]
        return all(values) if op == "AND" else any(values)
    if op == "NUM_NONNULLS":return sum(eval_guard(a,row) is not None for a in ast["args"])
    if op == "IS_NULL":return eval_guard(ast["arg"],row) is None
    if op == "IS_NOT_NULL":return eval_guard(ast["arg"],row) is not None
    if op == "IN":return eval_guard(ast["arg"],row) in [eval_guard(v,row) for v in ast["values"]]
    if op == "BETWEEN":return eval_guard(ast["lower"],row) <= eval_guard(ast["arg"],row) <= eval_guard(ast["upper"],row)
    if op == "COMPARE":
        left,right=eval_guard(ast["left"],row),eval_guard(ast["right"],row)
        if left is None or right is None:return False
        if ast["left"].get("sqlType", "").startswith("NUMERIC"):
            left,right=Decimal(str(left)),Decimal(str(right))
        return {"=":lambda:left==right,"<>":lambda:left!=right,">":lambda:left>right,
                "<":lambda:left<right,">=":lambda:left>=right,"<=":lambda:left<=right}[ast["operator"]]()
    raise ValueError("UNKNOWN_GUARD_AST")


def package_documents():
    plan, defs = build()
    spec = importlib.util.spec_from_file_location("tim_v4_fixture_builder", HERE / "test_tim_cross_context_successor_v4.py")
    fixtures_module = importlib.util.module_from_spec(spec);spec.loader.exec_module(fixtures_module)
    fixtures = fixtures_module.concrete_fixtures()
    environment, governance = fixtures_module.import_environment(fixtures)
    fixtures["importEnvironment"] = environment
    fixtures["governanceResponse"] = governance
    schemas = {"OWNER": ref("V4.OwnerResponse"), "INPUT": ref("TIM.EntitlementInputDocument.v2"),
               "INSTRUCTION": ref("V4.TerminationInstruction"), "OUTCOME": ref("TIM.EntitlementOutcome.v2"),
               "REPORT": ref("V4.PolicyReport"), **sql_bind_schemas(plan)}
    needed = set()
    def visit(value):
        if isinstance(value, list):
            for item in value:visit(item)
        elif isinstance(value, dict):
            if "$ref" in value:
                name=value["$ref"].split("/")[-1]
                if name not in needed:needed.add(name);visit(defs[name])
            for key,item in value.items():
                if key!="$ref":visit(item)
    visit(schemas)
    inputs = [assemble_input(x,defs) for x in fixtures["inputsAB"]]
    terminations = []
    for original in fixtures["instructionsAB"]:
        for treatment in TREATMENTS:
            x=copy.deepcopy(original);x["treatment"]=treatment;x["policyContent"]["terminationTreatment"]=treatment
            terminations.append(termination_instruction(x,defs))
    output = {"grade":"ACTUAL_SYNTHETIC_PURE_CONSTRUCTOR_OUTPUT_NOT_NATIVE_OR_PUBLIC_HTTP",
              "inputsAB":inputs,"terminationABThreeBranches":terminations,
              "scheduleSqlBind29":project_schedule(fixtures["scheduleOwner"],0,fixtures["scheduleLocal"],defs),
              "whole95ConstructorEvaluation":False,"nativeAuth":False,"DML":False}
    output["importSqlBindRows"] = {name:project_abs_import(name,environment,defs) for name in
                ["abs_owner_artifact_snapshots","abs_calendar_version_snapshots","abs_policy_evaluation_reports"]}
    governance_env=copy.deepcopy(environment);governance_env["owner"]={"governance":governance}
    output["importSqlBindRows"]["abs_policy_governance_bindings"]=project_abs_import("abs_policy_governance_bindings",governance_env,defs)
    output["importSqlBindRows"]["abs_time_schedule_segment_snapshots"]=output["scheduleSqlBind29"]
    catalog = plan["independentExpectedCatalog"]
    producer_query = "SELECT h.public_id,h.snapshot_revision,h.as_of,h.valid_until,h.purpose_code,h.scope_digest,h.content_digest,r.content FROM public.tme_availability_snapshots h JOIN public.tme_availability_snapshot_rows r ON r.tenant_id=h.tenant_id AND r.availability_snapshot_id=h.availability_snapshot_id WHERE h.tenant_id=:trustedTenant AND h.public_id=:snapshotPublicUuid AND h.snapshot_revision=:expectedBusinessRevision AND h.snapshot_kind='CANONICAL_SCHEDULE'"
    dependencies = {"externalParents":plan["externalParents"],"sqlExecutionAllowed":False,
         "neutralInfrastructurePlan":plan["neutralInfrastructurePlan"],
         "producerQueryPlan":{"owner":"TIME","CURRENT_PUBLISHED":False,"registered":False,
             "query":producer_query,"contentSchemaRef":"V4.SchedulePayload",
             "immutableRowContentRequired":True,"currentPurposePopulationFieldPolicyRefetchRequired":True,
             "queryMaterializationAndStoredContentSourceGraph":"OPEN_G3_PLANNED_SOURCE_NOT_NATIVE"},
         "ownerAdapterPlan":{"fiveRoles":{"abs_owner_artifact_snapshots":"CLOSED_OWNER_RESPONSE_UNION_PLUS_LOCAL_PROVENANCE",
                 "abs_policy_evaluation_reports":"LOCAL_ABS_EVALUATOR_PLUS_CAS_LOADED_POLICY_SUBJECT",
                 "abs_policy_governance_bindings":"LOCAL_ABS_POLICY_PARENT_PLUS_SYS_GOVERNANCE_DECISION",
                 "abs_calendar_version_snapshots":"DIRECT_SYS_OR_TIME_CALENDAR_RESPONSE",
                 "abs_time_schedule_segment_snapshots":"TIME_PUBLISHED_HEADER_AND_SEGMENT_ONLY"},
              "requiredRefetchTuple":["trusted tenant","snapshot public UUID","exact business revision","full payload schema/digest","asOf/window","current purpose/population/field policy","acting Auth2 stamps separate target People4 versions"],
              "disabledOptionalScheduleCalls":0,"enabledMissingAdapter":"DENY",
              "HRMNativeEmploymentPublication":False,"legalEmployerUuidOwner":"existing People native employer, no shadow identity journal",
              "numericSnapshotRevisionIsNotDwpAuthorityRevision":True},
         "moduleFileOwnership":{"writer":"TIM module/internal code-owner reviewed planned files only",
             "moduleRoot":"dwp-time-server/src/main/java/com/dwp/services/time",
             "testRoot":"dwp-time-server/src/test/java/com/dwp/services/time",
             "schemaDtoFiles":["absence/contracts/v4/AbsOwnerResponseV4.java","absence/contracts/v4/AbsPolicyEvaluationReportV4.java","time/contracts/v4/PublishedScheduleSnapshotResponseV4.java"],
             "spiAdapterAssemblerFiles":["absence/ports/AbsOwnerSnapshotRefetchPortV4.java","time/ports/PublishedScheduleSnapshotQuerySpiV4.java","absence/adapters/AbsOwnerTypedFieldAdapterV4.java","absence/source/EntitlementInputAssemblerV4.java","absence/source/TerminationInstructionAssemblerV4.java"],
             "tests":["AbsOwnerTypedFieldAdapterV4Test","EntitlementInputAssemblerV4Test","TerminationInstructionAssemblerV4Test","PublishedScheduleQuerySpiV4ConsumerCompileTest"],
             "filesImplemented":False,"sharedConsumerCompile":False,"businessCrudG4NotRequiredFirst":True},
         "migrationPlan":{"newBusinessTablesThisChunk":0,"currentStructuralTables":52,"allocation":"NOT_ALLOCATED_INTERNAL_OWNER_SUCCESSOR_REQUIRED","nativeWfmDependency":"UNPUBLISHED_OPEN","newReceiptInternalUk":False}}
    def draft07(value):
        if isinstance(value, list):return [draft07(x) for x in value]
        if isinstance(value, dict):return {k:(v.replace("#/$defs/", "#/definitions/") if k=="$ref" else draft07(v)) for k,v in value.items()}
        return value
    return {
      ".json":{"contractId":plan["contractId"],"status":"AUTHOR_BOUNDED_DESIGN_MODEL_NOT_CANONICAL",
          "CURRENT_PUBLISHED":False,"G3Gate":"CLOSED_FAIL_SAFE","nativeExecution":False,"DML":False,
          "SOURCE_CLOSED":False,"canonicalDialectApproved":False,"independentExpectedCatalog":catalog,
          "scopedOperationIds":[x for x in catalog if x in SCOPED],"unclosedOperationIds":plan["unclosedOperationIds"],
          "boundaryDispositions":plan["boundaryDispositions"],"countsNotApproval":{"tables":52,"columns":723,"foreignKeys":108,"sourceBindingNames":177,"sixTableBindingNames":95},
          "remainingOpen":plan["remainingOpen"],"inputRevision1NewRunDirectionPreserved":True,
          "artifactRefs":[".schemas.json",".fixtures.json",".source-graphs.json",".table-dependencies.json",".guards.json",".record-outputs.json"],
          "historicalSourcesQuarantinedNotExecutable":True,"whole95GraphEvaluation":False},
      ".schemas.json":{"schemaVersion":4,"dialect":"DRAFT_07_STANDARD_REF_STORAGE","status":"PLANNED_CLOSED_DATA_TYPES_NOT_AUTHORITY","definitions":draft07({k:defs[k] for k in sorted(needed)}),"schemas":draft07(schemas)},
      ".fixtures.json":fixtures,
      ".source-graphs.json":{"scope":"ELEVEN_SCOPED_ABS_TABLES_ONLY_112_OTHER_OPS_OPEN","sourceGraphs":plan["sourceGraphs"],"nativeAuthDml":False,
         "loadedAliasMap":{"loaded.run":"abs_entitlement_runs","loaded.selected":"abs_entitlement_selected_items","loaded.policy":"abs_leave_plan_versions","loaded.workflow":"abs_enrollment_termination_workflows","loaded.intent":"abs_termination_settlement_intents","loaded.previous_run":"abs_entitlement_runs","loaded.originalRun":"abs_entitlement_runs","loaded.originalGrant":"abs_entitlement_ledger_entries"},
         "normalizedRequestFields":["periodStart","periodEnd","asOf","mode","correctionMode"],
         "fullInputAssemblerAndRefetch":"PURE_TYPED_MODEL_NOT_NATIVE_PEP_OR_ATOMIC_DML",
         "unimplementedBranchSourceEvaluation":"FULL95_NATIVE_GRAPH_CONSUMER_ASSEMBLER_OPEN"},
      ".table-dependencies.json":dependencies,
      ".guards.json":{"total":106,"sqlCheckAst":sum(g["kind"]=="SQL_CHECK_AST" for g in plan["guardDispositions"]),
                       "ownerSemanticOpen":sum(g["kind"]=="OWNER_SEMANTIC_REQUIRED_OPEN" for g in plan["guardDispositions"]),
                       "dispositions":plan["guardDispositions"],"plannedSqlMaterials":plan["plannedCheckSqlMaterials"],"nativeExecuted":False},
      ".record-outputs.json":output}


if __name__ == "__main__":
    import atexit as _guard_atexit
    import pathlib as _guard_pathlib

    _guard_dir = _guard_pathlib.Path(__file__).resolve().parent
    while not (_guard_dir / "modern_successor_reader_guard.py").is_file():
        if _guard_dir.parent == _guard_dir:
            raise SystemExit("modern successor reader guard is unavailable")
        _guard_dir = _guard_dir.parent
    sys.path.insert(0, str(_guard_dir))
    from modern_successor_reader_guard import guarded_modern_successor_read

    _reader_guard = guarded_modern_successor_read(__file__)
    _reader_guard.__enter__()
    _guard_atexit.register(_reader_guard.__exit__, None, None, None)
    if sys.argv[1:] == ["--verify-package"]:
        documents=package_documents();checks=0
        for suffix,value in documents.items():
            saved=json.loads((HERE/("tim-cross-context-boundary-successor.v4"+suffix)).read_text())
            if canonical(saved)!=canonical(value):raise ValueError("SAVED_PACKAGE_BUILDER_DRIFT "+suffix)
            checks+=1
        types=documents[".schemas.json"];fixtures=documents[".fixtures.json"];outputs=documents[".record-outputs.json"]
        cases=[{"id":"saved_owner","schema":"OWNER","value":fixtures["scheduleOwner"],"valid":True}]
        cases += [{"id":"saved_input_"+str(i),"schema":"INPUT","value":x,"valid":True} for i,x in enumerate(outputs["inputsAB"])]
        cases += [{"id":"saved_instruction_"+str(i),"schema":"INSTRUCTION","value":x["instruction"],"valid":True} for i,x in enumerate(outputs["terminationABThreeBranches"])]
        cases += [{"id":"saved_row_"+n,"schema":"V4.SqlBind."+n,"value":row,"valid":True} for n,row in outputs["importSqlBindRows"].items()]
        result=schema_engine(types["definitions"],types["schemas"],cases)
        print(json.dumps({"status":"SAVED_BOUNDED_PACKAGE_PASS_NOT_CANONICAL_SOURCE_G3_APPROVAL","exactGeneratedDocuments":checks,"schemaEngine":result,"SOURCE_CLOSED":False,"nativeExecution":False,"DML":False}))
        raise SystemExit(0)
    plan, defs = build()
    if sys.argv[1:] == ["--sql"]:
        raise SystemExit("SQL export refused: owner semantic guards/native WFM publication/manifest remain OPEN")
    if sys.argv[1:]:raise SystemExit("unsupported arguments")
    print(json.dumps({"plan": plan, "definitions": defs}, ensure_ascii=False))
