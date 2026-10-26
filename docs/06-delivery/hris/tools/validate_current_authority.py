#!/usr/bin/env python3
"""Validate the HRIS immutable-base plus append-only current authority chain."""

from __future__ import annotations

import csv
import hashlib
import json
import pathlib
import sys
from typing import Any


ROOT = pathlib.Path(__file__).resolve().parents[4]
INDEX_PATH = ROOT / "docs/06-delivery/hris/current-authority-index.v2.json"
EXPECTED_INTEGRITY_PIN_PATHS = {
    "docs/06-delivery/hris/current-authority-index.v1.json",
    "docs/06-delivery/hris/recovery/hris-porting-blueprint-2026-09-09/coding-readiness/cross-module-contract-register.csv",
    "docs/06-delivery/hris/recovery/hris-porting-blueprint-2026-09-09/coding-readiness/service-api-auth-binding-register.csv",
    "docs/06-delivery/hris/recovery/hris-porting-blueprint-2026-09-09/coding-readiness/hris-information-architecture-register.csv",
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-04-central-admission-r1/cross-module-contract-register.successor.v1.csv",
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-callback-binding-r1/service-api-auth-binding-register.successor.v2.csv",
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-04-module-start-r1/semantic-dispositions/base-tfr-tim-003.semantic-disposition.v1.json",
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-04-module-start-r1/tokens/base-tfr-tim-003.hrm-successor.start-token.v1.json",
    "docs/06-delivery/hris/recovery/hris-porting-blueprint-2026-09-09/session-registers/hris-sys-source-coverage.csv",
    "docs/06-delivery/hris/2026-10-20-hris-navigation-experience-successor.md",
    "docs/06-delivery/hris/2026-10-22-hris-sidebar-presentation-successor.md",
    "apps/dwp/src/features/hris/shell/model/hris-runtime-navigation-manifest.ts",
    "docs/06-delivery/hris/wave7-2026-10-17/execution-roadmap-successor.v20.json",
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-preflight-r1/semantic-dependency-migration-preflight.v1.json",
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-central-admission-r1/hrm-013-central-integration-receipt.v1.json",
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-callback-binding-r1/hrm-013-trusted-callback-service-binding-successor.v1.json",
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-callback-binding-r1/hrm-013-separation-waiver-approval-bridge-successor.v1.json",
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-callback-binding-r1/migration-manifests/base-tfr-hrm-013.people-v61-schema-manifest-successor.v2.json",
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-callback-binding-r1/migration-manifests/hrm-013.approval-v59-schema-manifest.v1.json",
}
EXPECTED_OVERLAY_CONFIGS = {
    "CROSS_MODULE_CONTRACT": {
        "immutableBase": "docs/06-delivery/hris/recovery/hris-porting-blueprint-2026-09-09/coding-readiness/cross-module-contract-register.csv",
        "successor": "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-04-central-admission-r1/cross-module-contract-register.successor.v1.csv",
        "expectedSuccessorIds": ["XCON-027"],
    },
    "SERVICE_API_AUTH_BINDING": {
        "immutableBase": "docs/06-delivery/hris/recovery/hris-porting-blueprint-2026-09-09/coding-readiness/service-api-auth-binding-register.csv",
        "successor": "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-callback-binding-r1/service-api-auth-binding-register.successor.v2.csv",
        "expectedSuccessorIds": [
            "SVC-PEP-HRM-007",
            "SVC-PEP-APR-002",
            "SVC-PEP-HRM-008",
            "SVC-PEP-HRM-009",
            "SVC-PEP-HRM-010",
        ],
    },
}
EXPECTED_REQUIRED_CONTRACT_IDS = ["XCON-027", "SVC-PEP-HRM-007"]
EXPECTED_NEW_CALLBACK_BINDING_IDS = [
    "SVC-PEP-APR-002",
    "SVC-PEP-HRM-008",
    "SVC-PEP-HRM-009",
    "SVC-PEP-HRM-010",
]
EXPECTED_INDEX_STATE = (
    "CURRENT_READ_AUTHORITY_CHAIN_HRM013_CALLBACK_AND_PAIRED_APPROVAL_"
    "DESIGN_SEALED_REVIEW_REQUIRED_ZERO_SOURCE_AUTHORITY"
)
EXPECTED_REFERENCE_ONLY_MISSING_COVERAGE = [
    "docs/06-delivery/hris/recovery/hris-porting-blueprint-2026-09-09/session-registers/hris-hrm-source-coverage.csv",
    "docs/06-delivery/hris/recovery/hris-porting-blueprint-2026-09-09/session-registers/hris-per-source-coverage.csv",
    "docs/06-delivery/hris/recovery/hris-porting-blueprint-2026-09-09/session-registers/hris-pay-source-coverage.csv",
    "docs/06-delivery/hris/recovery/hris-porting-blueprint-2026-09-09/session-registers/hris-tim-source-coverage.csv",
]
EXPECTED_REFERENCE_ONLY_MISSING_CHILD_TRACES = [
    "docs/06-delivery/hris/recovery/hris-porting-blueprint-2026-09-09/session-evidence/hrm/g1-child-trace.csv",
    "docs/06-delivery/hris/recovery/hris-porting-blueprint-2026-09-09/session-evidence/per/g1-child-trace.csv",
    "docs/06-delivery/hris/recovery/hris-porting-blueprint-2026-09-09/session-evidence/pay/g1-child-trace.csv",
    "docs/06-delivery/hris/recovery/hris-porting-blueprint-2026-09-09/session-evidence/tim/g1-child-trace.csv",
    "docs/06-delivery/hris/recovery/hris-porting-blueprint-2026-09-09/session-evidence/sys/g1-child-trace.csv",
]
EXPECTED_SUCCESSOR_ROWS: dict[str, dict[str, str]] = {
    "XCON-027": {
        "dependency_id": "DEP-007",
        "producer_session": "HRIS-HRM",
        "consumer_sessions": "HRIS-TIM",
        "contract_kind": "SNAPSHOT",
        "canonical_name": "EmploymentAbsenceSnapshot.v1",
        "required_fields_sha256": "cb24a0ad36ef65fdd33b9e9da5d96d926fbd68dff01316713a417c4c557ddc6e",
        "nested_required_fields_sha256": "224d6c6c58ca76a7a3f51120c8da302ab619109ecc1b826984915e02b1320b3a",
        "status": "READY_FOR_G3",
    },
    "SVC-PEP-HRM-007": {
        "module": "HRM",
        "source_operation_id": "getEmploymentAbsenceSnapshot",
        "method": "GET",
        "owner_path": "/internal/hris-people/v1/employment-absence-snapshots/{relationshipPublicId}",
        "owner_service": "dwp-people-server",
        "contract_scope": "TARGET_CROSS_MODULE_REFETCH",
        "caller_service_identities": "dwp-time-server",
        "purpose_codes": "TIM_LEAVE_EMPLOYMENT_RECOVERY",
        "allowed_consumers": "dwp-time-server",
        "state": "G3_BINDING_SPECIFIED_NOT_IMPLEMENTED",
    },
    "SVC-PEP-APR-002": {
        "module": "HRM",
        "source_operation_id": "createAndSubmitSeparationTaskWaiverRequest",
        "method": "POST",
        "owner_path": "/internal/hris-approval/v1/separation-task-waiver-requests",
        "owner_service": "dwp-approval-server",
        "source_contract": "hrm-013-separation-waiver-approval-bridge-successor.v1.json",
        "contract_scope": "TARGET_TRUSTED_APPROVAL_REQUEST",
        "caller_service_identities": "dwp-people-server",
        "purpose_codes": "HRIS_SEPARATION_TASK_WAIVER_REQUEST",
        "allowed_consumers": "dwp-people-server",
        "field_projection": "dwp-approval-server/SeparationWaiverApprovalRequestV1=approvalRequestId+casePublicId+taskPublicId+taskType+caseMakerPublicId+requestedByActorPublicId+reasonCode+taskOwnerRevision+taskVersion+requestedAt+payloadSha256+correlationId",
        "replay_idempotency": "ATOMIC_TWO_ROW_TENANT_TOKEN_DIGEST_RESERVATION|REQUEST_KEY=TENANT_APPROVAL_REQUEST|COMMAND_DIGEST_MATCH|EXACT_REQUEST_BYTES_MAX_32768|EXACT_REPLAY_RESPONSE_MAX_16384|EXACT_REPLAY_RETURNS_STORED_RESPONSE|DIGEST_CONFLICT_409",
        "state": "SEALED_DESIGN_APPROVAL_V59_AUTHORITY_WORKTREE_LEASE_AND_TOKEN_REQUIRED_NOT_IMPLEMENTED",
    },
    "SVC-PEP-HRM-008": {
        "module": "HRM",
        "source_operation_id": "recordSeparationTaskReceipt",
        "method": "POST",
        "owner_path": "/internal/hris-people/v1/separation-cases/{casePublicId}/tasks/{taskPublicId}/receipts",
        "owner_service": "dwp-people-server",
        "source_contract": "hrm-013-trusted-callback-service-binding-successor.v1.json",
        "contract_scope": "TARGET_TRUSTED_CALLBACK",
        "caller_service_identities": "dwp-time-server|dwp-payroll-server|dwp-auth-server",
        "purpose_codes": "HRIS_SEPARATION_TIME_TASK_RECEIPT|HRIS_SEPARATION_PAYROLL_TASK_RECEIPT|HRIS_SEPARATION_IDENTITY_TASK_RECEIPT",
        "allowed_consumers": "dwp-time-server|dwp-payroll-server|dwp-auth-server",
        "field_projection": "dwp-people-server/SeparationTaskReceiptV2=callbackEventId+casePublicId+taskPublicId+taskType+status+ownerRevision+externalReceiptPublicId+originatingPayloadSha256+occurredAt+payloadSha256+correlationId",
        "replay_idempotency": "ATOMIC_TWO_ROW_TENANT_TOKEN_DIGEST_RESERVATION|CALLBACK_KEY=TENANT_CALLER_EVENT|COMMAND_DIGEST_MATCH|EXACT_REPLAY_RESPONSE_MAX_16384|EXACT_REPLAY_RETURNS_STORED_RESPONSE|DIGEST_CONFLICT_409_AND_QUARANTINE|OWNER_REVISION_EXACT_NEXT",
        "state": "SEALED_DESIGN_NOT_IMPLEMENTED",
    },
    "SVC-PEP-HRM-009": {
        "module": "HRM",
        "source_operation_id": "recordSeparationReconciliationResult",
        "method": "POST",
        "owner_path": "/internal/hris-people/v1/separation-cases/{casePublicId}/reconciliation-results",
        "owner_service": "dwp-people-server",
        "source_contract": "hrm-013-trusted-callback-service-binding-successor.v1.json",
        "contract_scope": "TARGET_TRUSTED_CALLBACK",
        "caller_service_identities": "dwp-time-server|dwp-payroll-server",
        "purpose_codes": "HRIS_SEPARATION_TIME_RECONCILIATION|HRIS_SEPARATION_PAYROLL_RECONCILIATION",
        "allowed_consumers": "dwp-time-server|dwp-payroll-server",
        "field_projection": "dwp-people-server/SeparationReconciliationResultV1=callbackEventId+casePublicId+result+ownerRevision+originatingPayloadSha256+occurredAt+payloadSha256+correlationId",
        "replay_idempotency": "ATOMIC_TWO_ROW_TENANT_TOKEN_DIGEST_RESERVATION|CALLBACK_KEY=TENANT_CALLER_EVENT|COMMAND_DIGEST_MATCH|EXACT_REPLAY_RESPONSE_MAX_16384|EXACT_REPLAY_RETURNS_STORED_RESPONSE|DIGEST_CONFLICT_409_AND_QUARANTINE|OWNER_REVISION_EXACT_NEXT",
        "in_process_consumer": "dwp-people-server/hris/performance",
        "in_process_port": "SeparationReconciliationPort.v1",
        "state": "SEALED_DESIGN_NOT_IMPLEMENTED",
    },
    "SVC-PEP-HRM-010": {
        "module": "HRM",
        "source_operation_id": "recordSeparationTaskWaiverDecision",
        "method": "POST",
        "owner_path": "/internal/hris-people/v1/separation-cases/{casePublicId}/tasks/{taskPublicId}/waiver-decisions",
        "owner_service": "dwp-people-server",
        "source_contract": "hrm-013-trusted-callback-service-binding-successor.v1.json",
        "contract_scope": "TARGET_TRUSTED_APPROVAL_CALLBACK",
        "caller_service_identities": "dwp-approval-server",
        "purpose_codes": "HRIS_SEPARATION_TASK_WAIVER_DECISION",
        "allowed_consumers": "dwp-approval-server",
        "field_projection": "dwp-people-server/SeparationWaiverDecisionV2=callbackEventId+approvalRequestId+casePublicId+taskPublicId+decision+decisionActorPublicId+ownerRevision+decisionRevision+reasonCode+originatingPayloadSha256+stepUpEvidenceId+stepUpEvidenceAudience+stepUpEvidencePurpose+stepUpEvidenceNonce+stepUpEvidenceDigest+stepUpVerifiedAt+stepUpConsumedAt+occurredAt+payloadSha256+correlationId",
        "replay_idempotency": "ATOMIC_TWO_ROW_TENANT_TOKEN_DIGEST_RESERVATION|CALLBACK_KEY=TENANT_CALLER_EVENT|COMMAND_DIGEST_MATCH|EXACT_REPLAY_RESPONSE_MAX_16384|EXACT_REPLAY_RETURNS_STORED_RESPONSE|DIGEST_CONFLICT_409_AND_QUARANTINE|APPROVAL_REQUEST_STREAM_FIRST_REVISION_1|TERMINAL_DECISION_CLOSES_STREAM|NEW_APPROVAL_REQUEST_NEW_REVISION_1_STREAM|DECISION_REVISION_EQUALS_SIGNED_OWNER_REVISION",
        "state": "SEALED_DESIGN_CENTRAL_APPROVAL_BRIDGE_AUTHORITY_WORKTREE_V59_LEASE_AND_TOKEN_REQUIRED_NOT_IMPLEMENTED",
    },
}


def load_json(path: pathlib.Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def read_csv(path: pathlib.Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        return list(reader.fieldnames or []), list(reader)


def require(condition: bool, message: str, failures: list[str]) -> None:
    if not condition:
        failures.append(message)


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def validate_overlay(
    item: dict[str, Any], failures: list[str]
) -> dict[str, Any]:
    base_path = ROOT / item["immutableBase"]
    successor_path = ROOT / item["successor"]
    require(base_path.is_file(), f"missing immutable base: {item['immutableBase']}", failures)
    require(successor_path.is_file(), f"missing successor: {item['successor']}", failures)
    if not base_path.is_file() or not successor_path.is_file():
        return {"kind": item["kind"], "baseRows": 0, "successorRows": 0}

    base_header, base_rows = read_csv(base_path)
    successor_header, successor_rows = read_csv(successor_path)
    require(base_header == successor_header, f"overlay header drift: {item['kind']}", failures)
    id_field = base_header[0] if base_header else ""
    base_ids = [row.get(id_field, "") for row in base_rows]
    successor_ids = [row.get(id_field, "") for row in successor_rows]
    expected_ids = item["expectedSuccessorIds"]
    require(successor_ids == expected_ids, f"unexpected successor IDs: {item['kind']}", failures)
    require(
        len(base_ids + successor_ids) == len(set(base_ids + successor_ids)),
        f"duplicate base/successor ID: {item['kind']}",
        failures,
    )
    for row in successor_rows:
        row_id = row.get(id_field, "")
        expected = EXPECTED_SUCCESSOR_ROWS.get(row_id)
        require(expected is not None, f"no exact successor contract for {row_id}", failures)
        if expected is not None:
            for field, value in expected.items():
                require(
                    row.get(field) == value,
                    f"successor field drift: {row_id}.{field}",
                    failures,
                )
        if row_id == "XCON-027":
            require(
                sha256_bytes(row["required_fields"].encode("utf-8"))
                == row["required_fields_sha256"],
                "successor required_fields digest drift: XCON-027",
                failures,
            )
            require(
                sha256_bytes(row["nested_required_fields"].encode("utf-8"))
                == row["nested_required_fields_sha256"],
                "successor nested_required_fields digest drift: XCON-027",
                failures,
            )
        evidence_fields = (
            ("producer_evidence", "consumer_evidence")
            if item["kind"] == "CROSS_MODULE_CONTRACT"
            else ("source_contract",)
        )
        for field in evidence_fields:
            evidence_ref = row.get(field, "")
            evidence_path = (successor_path.parent / evidence_ref).resolve()
            require(
                bool(evidence_ref) and evidence_path.is_file(),
                f"successor evidence reference is unresolved: {row_id}.{field}",
                failures,
            )
    return {
        "kind": item["kind"],
        "baseRows": len(base_rows),
        "successorRows": len(successor_rows),
        "successorIds": successor_ids,
    }


def validate_zero_source_authority(
    authority: dict[str, Any],
    label: str,
    expected_true: set[str],
    failures: list[str],
) -> None:
    actual_true = {key for key, value in authority.items() if value is True}
    require(actual_true == expected_true, f"{label} positive authority drift", failures)
    for key, value in authority.items():
        if key in expected_true:
            continue
        if key == "businessCompletionCredit":
            require(value == 0, f"{label} business completion credit drift", failures)
        else:
            require(value is False, f"{label} false authority gate opened: {key}", failures)


def main() -> int:
    failures: list[str] = []
    require(INDEX_PATH.is_file(), "current authority index is missing", failures)
    if failures:
        print(json.dumps({"status": "FAIL", "failures": failures}, indent=2))
        return 1

    index = load_json(INDEX_PATH)
    require(index.get("schema") == "dwp.hris.current-authority-index.v2", "index schema drift", failures)
    require(
        index.get("state") == EXPECTED_INDEX_STATE,
        "index state drift",
        failures,
    )

    predecessor_index = index["predecessorIndex"]
    ia = index["informationArchitecture"]
    overlay_configs = index["contractRegisterOverlays"]
    batch04 = index["batch04ContractAuthority"]
    execution = index["executionAuthority"]
    callback = index["batch06Hrm013CallbackAuthority"]
    recovery = index["sourceCoverageRecovery"]
    expected_pin_paths = {
        predecessor_index["path"],
        ia["immutableBaseRegister"],
        *ia["navigationPresentationSuccessors"],
        ia["runtimeManifest"],
        *(item[key] for item in overlay_configs for key in ("immutableBase", "successor")),
        batch04["semanticDisposition"],
        batch04["startToken"],
        execution["roadmap"],
        execution["batch06Preflight"],
        callback["centralIntegrationReceipt"],
        callback["trustedCallbackSuccessor"],
        callback["pairedApprovalBridge"],
        callback["peopleV61ManifestSuccessor"],
        callback["approvalV59Manifest"],
        callback["registerOverlay"],
        *(item["path"] for item in recovery["preservedCoverage"]),
    }
    integrity_pins = index["integrityPins"]
    pin_paths = [pin["path"] for pin in integrity_pins]
    require(
        len(pin_paths) == len(set(pin_paths)),
        "duplicate integrity pin path",
        failures,
    )
    require(
        set(pin_paths) == expected_pin_paths,
        "integrity pin set does not exactly cover every current authority reference",
        failures,
    )
    require(
        set(pin_paths) == EXPECTED_INTEGRITY_PIN_PATHS,
        "integrity pin set no longer matches the sealed R2 authority chain",
        failures,
    )
    actual_overlay_configs = {
        item.get("kind", ""): {
            "immutableBase": item.get("immutableBase"),
            "successor": item.get("successor"),
            "expectedSuccessorIds": item.get("expectedSuccessorIds"),
        }
        for item in overlay_configs
    }
    require(
        actual_overlay_configs == EXPECTED_OVERLAY_CONFIGS,
        "contract overlay configuration no longer matches the sealed R2 chain",
        failures,
    )
    require(
        batch04.get("requiredContractIds") == EXPECTED_REQUIRED_CONTRACT_IDS,
        "Batch-04 required contract IDs drift",
        failures,
    )
    require(
        callback.get("requiredNewBindingIds") == EXPECTED_NEW_CALLBACK_BINDING_IDS,
        "HRM-013 callback binding IDs drift",
        failures,
    )
    require(
        callback.get("registerOverlay")
        == EXPECTED_OVERLAY_CONFIGS["SERVICE_API_AUTH_BINDING"]["successor"],
        "HRM-013 register overlay is not the current service-binding successor",
        failures,
    )
    require(
        callback.get("independentReviewState") == "REQUIRED_NOT_COMPLETE_AT_INDEX_SEAL",
        "HRM-013 independent-review state drift",
        failures,
    )
    predecessor_pin = next(
        (pin for pin in integrity_pins if pin["path"] == predecessor_index["path"]),
        None,
    )
    require(predecessor_pin is not None, "predecessor authority index is not integrity-pinned", failures)
    if predecessor_pin is not None:
        require(
            predecessor_index.get("bytes") == predecessor_pin.get("bytes")
            and predecessor_index.get("sha256") == predecessor_pin.get("sha256"),
            "predecessor authority index pin drift",
            failures,
        )

    for pin in integrity_pins:
        pinned_path = ROOT / pin["path"]
        require(pinned_path.is_file(), f"integrity-pinned artifact missing: {pin['path']}", failures)
        if pinned_path.is_file():
            pinned_bytes = pinned_path.read_bytes()
            require(len(pinned_bytes) == pin["bytes"], f"integrity byte drift: {pin['path']}", failures)
            require(
                sha256_bytes(pinned_bytes) == pin["sha256"],
                f"integrity SHA-256 drift: {pin['path']}",
                failures,
            )

    ia_path = ROOT / ia["immutableBaseRegister"]
    ia_header, ia_rows = read_csv(ia_path)
    require("ia_node_id" in ia_header, "IA register header drift", failures)
    require(len(ia_rows) == ia["expectedBaseNodes"] == 98, "IA base count drift", failures)

    presentation_paths = [ROOT / item for item in ia["navigationPresentationSuccessors"]]
    runtime_path = ROOT / ia["runtimeManifest"]
    require(len(presentation_paths) == 2, "navigation successor chain cardinality drift", failures)
    for presentation_path in presentation_paths:
        require(presentation_path.is_file(), "navigation presentation successor missing", failures)
    require(runtime_path.is_file(), "runtime navigation manifest missing", failures)
    presentation_v1 = (
        presentation_paths[0].read_text(encoding="utf-8")
        if len(presentation_paths) > 0 and presentation_paths[0].is_file()
        else ""
    )
    presentation_v2 = (
        presentation_paths[1].read_text(encoding="utf-8")
        if len(presentation_paths) > 1 and presentation_paths[1].is_file()
        else ""
    )
    runtime = runtime_path.read_text(encoding="utf-8") if runtime_path.is_file() else ""
    require(
        "2026-10-20" in presentation_v1 and "7개" in presentation_v1,
        "navigation successor v1 drift",
        failures,
    )
    require(
        "2026-10-22" in presentation_v2
        and "workbench 표시명 조항만" in presentation_v2
        and "`인사`" in presentation_v2,
        "sidebar presentation successor drift",
        failures,
    )
    require("nodes: 99" in runtime, "runtime node count authority drift", failures)
    require("shellEntries: 9" in runtime, "runtime shell-entry authority drift", failures)
    require("taskGroups: 46" in runtime, "runtime task-group authority drift", failures)

    overlays = [validate_overlay(item, failures) for item in overlay_configs]

    semantic_path = ROOT / batch04["semanticDisposition"]
    token_path = ROOT / batch04["startToken"]
    require(semantic_path.is_file(), "Batch-04 semantic disposition missing", failures)
    require(token_path.is_file(), "Batch-04 start token missing", failures)
    semantic_text = semantic_path.read_text(encoding="utf-8") if semantic_path.is_file() else ""
    token_text = token_path.read_text(encoding="utf-8") if token_path.is_file() else ""
    semantic = load_json(semantic_path) if semantic_path.is_file() else {}
    token = load_json(token_path) if token_path.is_file() else {}
    require(semantic.get("sliceId") == "BASE-TFR-TIM-003", "Batch-04 semantic slice drift", failures)
    require(token.get("sliceId") == "BASE-TFR-TIM-003", "Batch-04 token slice drift", failures)
    require(
        token.get("authority", {}).get("frontendRegisterAndResultAuthoringAuthorized") is True,
        "Batch-04 token no longer authorizes the bounded frontend register successor",
        failures,
    )
    for contract_id in batch04["requiredContractIds"]:
        require(contract_id in semantic_text, f"semantic disposition missing {contract_id}", failures)
        require(contract_id in token_text, f"start token missing {contract_id}", failures)

    roadmap_path = ROOT / execution["roadmap"]
    preflight_path = ROOT / execution["batch06Preflight"]
    require(roadmap_path.is_file(), "execution roadmap missing", failures)
    require(preflight_path.is_file(), "Batch-06 preflight missing", failures)
    roadmap = load_json(roadmap_path) if roadmap_path.is_file() else {}
    preflight = load_json(preflight_path) if preflight_path.is_file() else {}
    require(roadmap.get("state") == execution["requiredRoadmapState"], "roadmap state drift", failures)
    require(preflight.get("state") == execution["requiredPreflightState"], "preflight state drift", failures)
    activation = roadmap.get("tenantFeatureActivationLane", {})
    require(activation.get("featureEnablementAuthorized") is False, "feature activation is no longer OFF", failures)
    require(activation.get("tenantEnrollmentAuthorized") is False, "tenant enrollment is no longer OFF", failures)
    require(activation.get("globalActiveSeeds") == 0, "global active seed drift", failures)
    require(activation.get("tenantEnrollmentSeeds") == 0, "tenant enrollment seed drift", failures)
    require(
        activation.get("productionProviderHandlerSchedulerOrBrokerBindings") == 0,
        "production binding drift",
        failures,
    )

    callback_path = ROOT / callback["trustedCallbackSuccessor"]
    approval_bridge_path = ROOT / callback["pairedApprovalBridge"]
    people_manifest_path = ROOT / callback["peopleV61ManifestSuccessor"]
    approval_manifest_path = ROOT / callback["approvalV59Manifest"]
    central_receipt_path = ROOT / callback["centralIntegrationReceipt"]
    callback_design = load_json(callback_path) if callback_path.is_file() else {}
    approval_bridge = load_json(approval_bridge_path) if approval_bridge_path.is_file() else {}
    people_manifest = load_json(people_manifest_path) if people_manifest_path.is_file() else {}
    approval_manifest = load_json(approval_manifest_path) if approval_manifest_path.is_file() else {}
    central_receipt = load_json(central_receipt_path) if central_receipt_path.is_file() else {}

    require(
        central_receipt.get("state") == callback["requiredCentralState"],
        "HRM-013 central integration receipt state drift",
        failures,
    )
    require(
        callback_design.get("schema")
        == "dwp.hris.wave7.r7-batch-06-hrm013-trusted-callback-service-binding-successor.v1",
        "HRM-013 callback successor schema drift",
        failures,
    )
    require(
        callback_design.get("state") == callback["requiredCallbackState"],
        "HRM-013 callback successor state drift",
        failures,
    )
    require(
        approval_bridge.get("schema")
        == "dwp.hris.wave7.r7-batch-06-hrm013-separation-waiver-approval-bridge-successor.v1",
        "HRM-013 Approval bridge schema drift",
        failures,
    )
    require(
        approval_bridge.get("state") == callback["requiredApprovalBridgeState"],
        "HRM-013 Approval bridge state drift",
        failures,
    )
    require(
        people_manifest.get("schema")
        == "dwp.hris.wave7.r7-batch-06-hrm013-people-v61-schema-manifest-successor.v2",
        "People V61 manifest successor schema drift",
        failures,
    )
    require(
        people_manifest.get("state") == callback["requiredPeopleManifestState"],
        "People V61 manifest successor state drift",
        failures,
    )
    require(
        approval_manifest.get("schema")
        == "dwp.hris.wave7.r7-batch-06-hrm013-approval-v59-schema-manifest.v1",
        "Approval V59 manifest schema drift",
        failures,
    )
    require(
        approval_manifest.get("state") == callback["requiredApprovalManifestState"],
        "Approval V59 manifest state drift",
        failures,
    )

    validate_zero_source_authority(
        index.get("authority", {}),
        "current authority index",
        {"callbackAndPairedRequestDesignSealed", "independentReviewRequired"},
        failures,
    )
    validate_zero_source_authority(
        central_receipt.get("authority", {}),
        "HRM-013 central receipt",
        {"trustedCallbackBindingSuccessorMayBePreparedAndReviewed"},
        failures,
    )
    validate_zero_source_authority(
        callback_design.get("authority", {}),
        "HRM-013 callback successor",
        {
            "callbackBindingDesignSealed",
            "internalCallbackServiceBindingsDefined",
            "peopleV61ManifestSuccessorSealed",
            "approvalV59ManifestSealed",
            "independentReviewRequired",
            "peopleV61ManifestSuccessorRequired",
            "pairedApprovalRequestBindingDefined",
            "centralApprovalBridgeAuthorityRequired",
        },
        failures,
    )
    validate_zero_source_authority(
        approval_bridge.get("authority", {}),
        "HRM-013 Approval bridge",
        {
            "waiverApprovalBridgeDesignSealed",
            "apr002RequestBindingDefined",
            "hrm010DecisionBindingDefined",
            "independentReviewRequired",
        },
        failures,
    )
    validate_zero_source_authority(
        people_manifest.get("authority", {}),
        "People V61 manifest successor",
        {
            "callbackDurabilityDesignSealed",
            "peopleV61EffectiveManifestClarified",
            "callbackAuthorityTableDesignSealed",
        },
        failures,
    )
    validate_zero_source_authority(
        approval_manifest.get("authority", {}),
        "Approval V59 manifest",
        {"approvalV59CandidateDesignSealed", "pairedWaiverHandshakeDesignSealed"},
        failures,
    )

    require(
        callback_design.get("lineage", {}).get("currentAuthorityIndex", {}).get("path")
        == "../../current-authority-index.v1.json",
        "callback successor predecessor-index path drift",
        failures,
    )
    require(
        callback.get("nextGate")
        == "INDEPENDENT_REVIEW_THEN_CARRIER_COMMIT_PUSH_THEN_SEPARATE_CENTRAL_PAIRED_APPROVAL_AND_BOUNDED_PEOPLE_PREREQUISITE_AUTHORITY_WORKTREES_EXCLUSIVE_APPROVAL_V59_AND_PEOPLE_V61_LEASES_AND_HASH_BOUND_TOKENS_THEN_ONE_PAIRED_INTEGRATION_RECEIPT_BEFORE_HRM013_OWNER_PACKET",
        "HRM-013 next gate bypasses independent review or paired V59/V61 prerequisite authority",
        failures,
    )
    callback_bindings = callback_design.get("bindings", [])
    require(
        len(callback_bindings) == 3
        and all(item.get("maximumRequestBytes") == 32768 for item in callback_bindings)
        and callback_design.get("responseContract", {}).get("maximumResponseBytes")
        == 16384,
        "HRM-013 callback 32-KiB request/16-KiB response boundary drift",
        failures,
    )
    bridge_request = approval_bridge.get("requestEndpoint", {})
    bridge_decision = approval_bridge.get("decisionEndpoint", {})
    bridge_size = approval_bridge.get("persistenceSizeContract", {})
    require(
        bridge_request.get("maximumRequestBytes") == 32768
        and bridge_request.get("maximumResponseBytes") == 16384
        and bridge_decision.get("maximumRequestBytes") == 32768
        and bridge_decision.get("maximumResponseBytes") == 16384
        and bridge_size.get("maximumAcceptedRequestBytes") == 32768
        and bridge_size.get("maximumPersistedExactRequestBytes") == 32768
        and bridge_size.get("maximumPersistedExactResponseBytes") == 16384,
        "Approval bridge request/response persistence-size contract drift",
        failures,
    )

    require(
        people_manifest.get("effectiveComposition", {}).get("effectiveTableSet")
        == [
            "ppl_separation_cases",
            "ppl_separation_tasks",
            "ppl_hrm013_callback_proof_replays",
            "ppl_separation_waiver_request_outbox",
            "ppl_separation_callback_authorities",
            "ppl_separation_callbacks",
        ],
        "People V61 effective prerequisite-persistence table set drift",
        failures,
    )
    replay_table = people_manifest.get("proofReplayTable", {})
    replay_columns = set(replay_table.get("columns", []))
    replay_checks = " ".join(replay_table.get("checks", []))
    require(
        replay_table.get("table") == "ppl_hrm013_callback_proof_replays"
        and {
            "tenant_id BIGINT NOT NULL",
            "binding_id VARCHAR(40) NOT NULL",
            "caller_workload_id VARCHAR(120) NOT NULL",
            "token_kind VARCHAR(16) NOT NULL",
            "token_digest CHAR(64) NOT NULL",
            "expires_at TIMESTAMPTZ NOT NULL",
            "reserved_at TIMESTAMPTZ NOT NULL",
        }.issubset(replay_columns)
        and all(binding_id in replay_checks for binding_id in EXPECTED_NEW_CALLBACK_BINDING_IDS[1:])
        and replay_table.get("uniqueConstraints") == ["tenant_id,token_digest"]
        and "jti digest and requestNonce digest presented by one proof must differ" in replay_checks
        and "across token kinds, bindings and callers" in replay_table.get("reservationRule", ""),
        "People V61 dedicated callback proof-replay design drift",
        failures,
    )
    require(
        people_manifest.get("v54NonRegression", {}).get("protectedTable")
        == "ppl_hris_bridge_proof_replays"
        and people_manifest.get("v54NonRegression", {}).get("protectedBindingId")
        == "SVC-PEP-HRM-001",
        "People V54 employee-change replay boundary drift",
        failures,
    )
    waiver_outbox = people_manifest.get("waiverRequestFenceAndOutbox", {})
    waiver_outbox_columns = set(waiver_outbox.get("columns", []))
    waiver_outbox_checks = " ".join(waiver_outbox.get("checks", []))
    require(
        waiver_outbox.get("table") == "ppl_separation_waiver_request_outbox"
        and {
            "approval_request_id UUID NOT NULL",
            "case_public_id UUID NOT NULL",
            "task_public_id UUID NOT NULL",
            "case_maker_public_id UUID NOT NULL",
            "requested_by_actor_public_id UUID NOT NULL",
            "reason_code VARCHAR(80) NOT NULL",
            "task_owner_revision BIGINT NOT NULL",
            "task_version BIGINT NOT NULL",
            "exact_request_body BYTEA NOT NULL",
            "request_body_sha256 CHAR(64) NOT NULL",
            "approval_request_payload_sha256 CHAR(64) NOT NULL",
            "command_digest CHAR(64) NOT NULL",
            "correlation_id UUID NOT NULL",
            "dispatch_state VARCHAR(20) NOT NULL DEFAULT 'PENDING'",
        }.issubset(waiver_outbox_columns),
        "People-owned APR-002 immutable fence/outbox drift",
        failures,
    )
    require(
        waiver_outbox.get("uniqueConstraints")
        == [
            "public_id",
            "tenant_id,approval_request_id",
            "tenant_id,case_public_id,task_public_id,request_revision",
        ],
        "People waiver outbox no longer supports exact multiple-task request streams",
        failures,
    )
    require(
        "octet_length(exact_request_body) is between 1 and 32768"
        in waiver_outbox_checks
        and "octet_length(exact_response_body) is between 1 and 16384"
        in waiver_outbox_checks,
        "People APR-002 request/response byte-cap split drift",
        failures,
    )

    callback_columns = people_manifest.get("callbackTableReplacement", {}).get("columns", [])
    required_callback_columns = {
        "external_receipt_public_id UUID",
        "originating_payload_sha256 CHAR(64) NOT NULL",
        "command_digest CHAR(64) NOT NULL",
        "request_body_sha256 CHAR(64) NOT NULL",
        "receipt_public_id UUID NOT NULL",
        "exact_response_body BYTEA NOT NULL",
        "response_body_sha256 CHAR(64) NOT NULL",
        "approval_request_id UUID",
        "waiver_decision VARCHAR(16)",
        "decision_revision BIGINT",
        "tenant_grant_revision BIGINT NOT NULL",
        "authorization_revision BIGINT NOT NULL",
        "decision_actor_public_id UUID",
        "case_maker_public_id UUID",
        "requested_by_actor_public_id UUID",
        "step_up_evidence_id UUID",
        "step_up_evidence_audience VARCHAR(120)",
        "step_up_evidence_purpose VARCHAR(120)",
        "step_up_evidence_nonce_sha256 CHAR(64)",
        "step_up_evidence_sha256 CHAR(64)",
        "step_up_verified_at TIMESTAMPTZ",
        "step_up_consumed_at TIMESTAMPTZ",
    }
    require(
        required_callback_columns.issubset(set(callback_columns)),
        "People V61 callback receipt or waiver-evidence columns drift",
        failures,
    )
    require(
        not any("request_body BYTEA" in column or "raw_request" in column for column in callback_columns),
        "People V61 callback design stores forbidden raw request bytes",
        failures,
    )
    callback_table = people_manifest.get("callbackTableReplacement", {})
    callback_checks = " ".join(callback_table.get("checks", []))
    require(
        "SeparationCallbackReceiptV1" in callback_table.get("safeResponseRule", "")
        and "CommandReceiptV1" not in callback_table.get("safeResponseRule", ""),
        "People V61 safe callback response type drift",
        failures,
    )
    require(
        all("ppl_command_receipts" not in item for item in callback_table.get("foreignKeys", []))
        and "do not insert ppl_command_receipts" in callback_table.get("genericReceiptSeparation", ""),
        "People V61 specialized receipt ledger separation drift",
        failures,
    )
    require(
        "octet_length(exact_response_body) is between 1 and 16384" in callback_checks
        and "APPROVAL_DECISION requires owner_revision = decision_revision"
        in callback_checks
        and "65536" not in callback_checks
        and {
            "tenant_id,caller_workload_id,external_receipt_public_id WHERE callback_type = TASK_RECEIPT",
            "tenant_id,step_up_evidence_id WHERE callback_type = APPROVAL_DECISION AND waiver_decision = APPROVED",
            "tenant_id,step_up_evidence_nonce_sha256 WHERE callback_type = APPROVAL_DECISION AND waiver_decision = APPROVED",
        }.issubset(set(callback_table.get("uniqueConstraints", []))),
        "People V61 16-KiB response or one-time evidence uniqueness drift",
        failures,
    )
    require(
        "FAILED leaves the case" in people_manifest.get("revisionAndStateSemantics", {}).get("taskSequence", "")
        and "different callbackEventId" in people_manifest.get("revisionAndStateSemantics", {}).get("taskSequence", "")
        and "different externalReceiptPublicId" in people_manifest.get("revisionAndStateSemantics", {}).get("taskSequence", "")
        and "approval_request_payload_sha256" in people_manifest.get("revisionAndStateSemantics", {}).get("waiverSequence", ""),
        "People V61 distinct FAILED-to-COMPLETED or APR-002 lineage rule drift",
        failures,
    )
    callback_authority_columns = set(
        people_manifest.get("callbackAuthorityTable", {}).get("columns", [])
    )
    require(
        {
            "expected_next_owner_revision BIGINT NOT NULL",
            "consumer_event_id UUID",
            "correlation_id UUID NOT NULL",
            "originating_payload_sha256 CHAR(64) NOT NULL",
            "task_type VARCHAR(80)",
            "approval_request_id UUID",
            "tenant_grant_revision BIGINT NOT NULL",
            "authorization_revision BIGINT NOT NULL",
            "created_at TIMESTAMPTZ NOT NULL",
            "closed_at TIMESTAMPTZ",
        }.issubset(callback_authority_columns),
        "People V61 pre-business callback protocol fence drift",
        failures,
    )
    require(
        not any("initial_owner_revision" in column for column in callback_authority_columns),
        "People V61 protocol fence still derives its initial revision from callback evidence",
        failures,
    )
    require(
        people_manifest.get("callbackAuthorityTable", {}).get("immutableKey")
        == [
            "tenant_id",
            "binding_id",
            "caller_workload_id",
            "case_public_id",
            "task_public_id",
            "purpose_code",
            "approval_request_id",
        ]
        and people_manifest.get("callbackAuthorityTable", {}).get("requiredValues")
        == [
            "expected_next_owner_revision",
            "correlation_id",
            "originating_payload_sha256",
            "task_type",
            "consumer_event_id",
            "tenant_grant_revision",
            "authorization_revision",
            "created_at",
            "closed_at",
        ]
        and people_manifest.get("callbackAuthorityTable", {}).get(
            "uniqueConstraints", []
        )[-1]
        == "tenant_id,binding_id,caller_workload_id,case_public_id,task_public_id,purpose_code,approval_request_id,authority_revision NULLS NOT DISTINCT"
        and "new authority_revision 1 and expected_next_owner_revision 1 stream"
        in people_manifest.get("callbackAuthorityTable", {}).get("sequenceRule", ""),
        "People V61 protocol-fence exact key or required values drift",
        failures,
    )
    main_protocol_fence = callback_design.get("protocolFenceRequirement", {})
    require(
        main_protocol_fence.get("persistenceTable")
        == people_manifest.get("callbackAuthorityTable", {}).get("table")
        and main_protocol_fence.get("immutableStreamKeyColumns")
        == people_manifest.get("callbackAuthorityTable", {}).get("immutableKey")
        and main_protocol_fence.get("versionColumn") == "authority_revision"
        and main_protocol_fence.get("requiredColumns")
        == people_manifest.get("callbackAuthorityTable", {}).get("requiredValues"),
        "callback carrier and People V61 protocol-fence parity drift",
        failures,
    )
    require(
        people_manifest.get("grantRevisionFence", {}).get("proofClaims")
        == {
            "tenantGrantRevision": "tenant_grant_revision",
            "authorizationRevision": "authorization_revision",
        }
        and "one current service-grant row"
        in people_manifest.get("grantRevisionFence", {}).get("authorityRule", "")
        and "same pair" in people_manifest.get("grantRevisionFence", {}).get(
            "admissionRule", ""
        ),
        "People callback signed grant-revision fence drift",
        failures,
    )
    guard_steps = people_manifest.get("guardOrderSuccessor", {}).get("steps", [])
    require(
        len(guard_steps) == 8
        and "ppl_separation_callbacks callback identity ledger" in guard_steps[3]
        and "ppl_separation_callback_authorities" in guard_steps[4]
        and "before any case or task business-row read" in guard_steps[4]
        and "minimum tenant-scoped locked owner identity-and-revision read" in guard_steps[5]
        and "Reject stale, gap, out-of-order" in guard_steps[6]
        and "Only then load the minimum domain fields" in guard_steps[7],
        "People V61 callback guard order drift",
        failures,
    )

    required_approval_tables = [
        "apr_hrm013_tenant_grants",
        "apr_hrm013_proof_replays",
        "apr_hrm013_waiver_request_bindings",
        "apr_hrm013_waiver_decision_outbox",
    ]
    require(
        [table.get("name") for table in approval_manifest.get("newTables", [])]
        == required_approval_tables,
        "Approval V59 dedicated HRM-013 table set drift",
        failures,
    )
    require(
        approval_bridge.get("approvalPersistenceTouchManifest", {}).get("requiredTables")
        == required_approval_tables,
        "Approval bridge persistence touch manifest drift",
        failures,
    )
    require(
        approval_manifest.get("v58NonRegression", {}).get("unchangedTables")
        == [
            "apr_hris_bridge_proof_replays",
            "apr_hris_employee_change_approval_bindings",
            "apr_hris_employee_change_decision_outbox",
        ],
        "Approval V58 non-regression table boundary drift",
        failures,
    )
    require(
        approval_manifest.get("bindingAllocation", {}).get("request", {}).get("operation")
        == "createAndSubmitSeparationTaskWaiverRequest"
        and approval_manifest.get("bindingAllocation", {}).get("callback", {}).get("operation")
        == "recordSeparationTaskWaiverDecision",
        "Approval V59 operation-name alignment drift",
        failures,
    )
    approval_tables = {
        table.get("name", ""): table for table in approval_manifest.get("newTables", [])
    }
    approval_grant_table = approval_tables.get("apr_hrm013_tenant_grants", {})
    approval_grant_columns = set(approval_grant_table.get("columns", []))
    approval_grant_checks = " ".join(approval_grant_table.get("checks", []))
    approval_grant_contract = approval_manifest.get("grantRevisionContract", {})
    bridge_grant_contract = approval_bridge.get("workloadProofProfile", {}).get(
        "tenantGrantAuthority", {}
    )
    require(
        {
            "grant_revision BIGINT NOT NULL",
            "tenant_grant_revision BIGINT NOT NULL",
            "authorization_revision BIGINT NOT NULL",
        }.issubset(approval_grant_columns)
        and "tenant_grant_revision > 0" in approval_grant_checks
        and "authorization_revision > 0" in approval_grant_checks
        and approval_grant_table.get("uniqueConstraints")
        == [
            "tenant_id,grant_id",
            "tenant_id,grant_id,tenant_grant_revision,authorization_revision",
            "tenant_id,grant_revision",
        ]
        and bridge_grant_contract.get("claimToColumnMapping")
        == {
            "tenantGrantRevision": "tenant_grant_revision",
            "authorizationRevision": "authorization_revision",
        }
        and "highest grant_revision" in approval_grant_contract.get("admissionRule", "")
        and "same grant_id" in approval_grant_contract.get("outboxRule", "")
        and "No proof may combine" in approval_grant_contract.get("proofRule", ""),
        "Approval current grant and signed revision mapping drift",
        failures,
    )
    approval_replay_table = approval_tables.get("apr_hrm013_proof_replays", {})
    approval_replay_checks = " ".join(approval_replay_table.get("checks", []))
    bridge_replay = approval_bridge.get("workloadProofProfile", {}).get(
        "replayPersistence", {}
    )
    require(
        approval_replay_table.get("columns")
        == [
            "proof_replay_id BIGSERIAL PRIMARY KEY",
            "tenant_id BIGINT NOT NULL",
            "binding_id VARCHAR(40) NOT NULL",
            "caller_workload_id VARCHAR(120) NOT NULL",
            "token_kind VARCHAR(16) NOT NULL",
            "token_digest CHAR(64) NOT NULL",
            "expires_at TIMESTAMPTZ NOT NULL",
            "reserved_at TIMESTAMPTZ NOT NULL",
        ]
        and approval_replay_table.get("uniqueConstraints")
        == ["tenant_id,token_digest"]
        and "token_digest is lowercase hexadecimal length 64" in approval_replay_checks
        and "canonical UUIDs, differ before hashing" in approval_replay_checks
        and "atomically insert two separate JTI and REQUEST_NONCE rows"
        in approval_replay_table.get("reservationRule", "")
        and "binding_id, caller_workload_id or token_kind changes"
        in approval_replay_table.get("reservationRule", "")
        and "Persist only token_digest" in approval_replay_table.get(
            "persistenceRule", ""
        )
        and "Raw jti" in approval_replay_table.get("persistenceRule", "")
        and bridge_replay.get("uniqueIdentity") == ["tenant_id", "token_digest"]
        and bridge_replay.get("atomicRows")
        == ["JTI digest", "REQUEST_NONCE digest"],
        "Approval V59 two-row digest-only proof replay design drift",
        failures,
    )
    approval_request_table = approval_tables.get("apr_hrm013_waiver_request_bindings", {})
    approval_request_columns = set(approval_request_table.get("columns", []))
    approval_request_checks = " ".join(approval_request_table.get("checks", []))
    require(
        {
            "case_maker_public_id UUID NOT NULL",
            "requested_by_actor_public_id UUID NOT NULL",
            "requested_task_owner_revision BIGINT NOT NULL",
            "requested_task_version BIGINT NOT NULL",
            "required_step_up_audience VARCHAR(120) NOT NULL",
            "required_step_up_purpose VARCHAR(80) NOT NULL",
            "grant_id UUID NOT NULL",
            "tenant_grant_revision BIGINT NOT NULL",
            "authorization_revision BIGINT NOT NULL",
            "approval_request_payload_sha256 CHAR(64) NOT NULL",
            "exact_request_body BYTEA NOT NULL",
            "request_body_sha256 CHAR(64) NOT NULL",
            "command_digest CHAR(64) NOT NULL",
        }.issubset(approval_request_columns),
        "Approval V59 immutable APR-002 request evidence drift",
        failures,
    )
    require(
        "octet_length(exact_request_body) is between 1 and 32768"
        in approval_request_checks
        and "octet_length(exact_response_body) is between 1 and 16384"
        in approval_request_checks
        and approval_request_table.get("uniqueConstraints")
        == [
            "tenant_id,approval_request_id",
            "tenant_id,approval_request_id,grant_id,tenant_grant_revision,authorization_revision",
            "tenant_id,idempotency_key",
        ]
        and "Neither case nor task is unique by itself"
        in approval_request_table.get("multipleWaiverRule", ""),
        "Approval V59 request byte cap or multiple-waiver cardinality drift",
        failures,
    )
    approval_outbox = approval_tables.get("apr_hrm013_waiver_decision_outbox", {})
    approval_outbox_columns = set(approval_outbox.get("columns", []))
    approval_outbox_checks = " ".join(approval_outbox.get("checks", []))
    require(
        {
            "case_maker_public_id UUID NOT NULL",
            "requested_by_actor_public_id UUID NOT NULL",
            "step_up_evidence_id UUID",
            "step_up_evidence_audience VARCHAR(120)",
            "step_up_evidence_purpose VARCHAR(120)",
            "step_up_evidence_nonce_sha256 CHAR(64)",
            "step_up_evidence_sha256 CHAR(64)",
            "step_up_verified_at TIMESTAMPTZ",
            "step_up_consumed_at TIMESTAMPTZ",
            "approval_request_payload_sha256 CHAR(64) NOT NULL",
            "callback_payload_sha256 CHAR(64) NOT NULL",
            "exact_callback_body BYTEA NOT NULL",
            "callback_body_sha256 CHAR(64) NOT NULL",
            "grant_id UUID NOT NULL",
            "tenant_grant_revision BIGINT NOT NULL",
            "authorization_revision BIGINT NOT NULL",
            "owner_revision BIGINT NOT NULL",
        }.issubset(approval_outbox_columns),
        "Approval V59 callback lineage or step-up outbox evidence drift",
        failures,
    )
    require(
        "APPROVED requires all seven step-up columns non-null" in approval_outbox_checks
        and "REJECTED requires all seven step-up columns null" in approval_outbox_checks
        and "owner_revision = decision_revision" in approval_outbox_checks
        and "octet_length(exact_callback_body) is between 1 and 32768"
        in approval_outbox_checks
        and "exact receipt bytes of 1 through 16384 octets" in approval_outbox_checks
        and {
            "tenant_id,step_up_evidence_id WHERE decision = APPROVED",
            "tenant_id,step_up_evidence_nonce_sha256 WHERE decision = APPROVED",
        }.issubset(set(approval_outbox.get("uniqueConstraints", []))),
        "Approval V59 APPROVED-only step-up or 16-KiB receipt rules drift",
        failures,
    )
    paired_preparation_gate = (
        "PAIRED_BOUNDED_APPROVAL_AND_PEOPLE_PREREQUISITE_WORKTREES"
    )
    integration_receipt_gate = "ONLY_THE_PAIRED_INTEGRATION_RECEIPT_MAY_UNLOCK"
    require(
        paired_preparation_gate in people_manifest.get("nextAction", "")
        and paired_preparation_gate in approval_manifest.get("nextAction", "")
        and integration_receipt_gate in people_manifest.get("nextAction", "")
        and integration_receipt_gate in approval_manifest.get("nextAction", ""),
        "paired Approval/People prerequisite sequencing gate drift",
        failures,
    )

    require(
        recovery.get("state") == "REFERENCE_ONLY_GAPS_NOT_SYNTHESIZED",
        "source-coverage recovery state drift",
        failures,
    )
    require(
        recovery.get("referenceOnlyMissingCoverage")
        == EXPECTED_REFERENCE_ONLY_MISSING_COVERAGE,
        "reference-only missing coverage set drift",
        failures,
    )
    require(
        recovery.get("referenceOnlyMissingChildTraces")
        == EXPECTED_REFERENCE_ONLY_MISSING_CHILD_TRACES,
        "reference-only missing child-trace set drift",
        failures,
    )
    for preserved in recovery["preservedCoverage"]:
        preserved_path = ROOT / preserved["path"]
        require(
            preserved_path.is_file(),
            f"preserved source coverage missing: {preserved['path']}",
            failures,
        )
        if preserved_path.is_file():
            _, preserved_rows = read_csv(preserved_path)
            require(
                len(preserved_rows) == preserved["rows"],
                f"preserved source coverage row drift: {preserved['path']}",
                failures,
            )
            require(
                sha256_bytes(preserved_path.read_bytes()) == preserved["sha256"],
                f"preserved source coverage digest drift: {preserved['path']}",
                failures,
            )
    for missing in [
        *recovery["referenceOnlyMissingCoverage"],
        *recovery["referenceOnlyMissingChildTraces"],
    ]:
        require(
            not (ROOT / missing).exists(),
            f"reference-only recovery gap changed without an authority-index successor: {missing}",
            failures,
        )

    result = {
        "schema": "dwp.hris.current-authority-validation.v2",
        "status": "PASS" if not failures else "FAIL",
        "checks": {
            "iaBaseNodes": len(ia_rows),
            "runtimeNodes": ia["expectedRuntimeNodes"],
            "shellEntries": ia["expectedShellEntries"],
            "taskGroups": ia["expectedTaskGroups"],
            "integrityPins": len(integrity_pins),
            "contractOverlays": overlays,
            "hrm013CallbackAuthority": {
                "state": callback_design.get("state"),
                "approvalBridgeState": approval_bridge.get("state"),
                "peopleManifestState": people_manifest.get("state"),
                "approvalManifestState": approval_manifest.get("state"),
                "independentReviewState": callback.get("independentReviewState"),
                "sourceAuthority": False,
                "businessCompletionCredit": 0,
            },
            "activationEvidence": {
                "source": execution["roadmap"],
                "kind": "DECLARED_VERSIONED_EVIDENCE_NOT_LIVE_DATABASE_OBSERVATION",
                "state": activation.get("state"),
            },
            "sourceCoverageRecovery": {
                "state": recovery["state"],
                "preserved": len(recovery["preservedCoverage"]),
                "referenceOnlyMissing": len(recovery["referenceOnlyMissingCoverage"])
                + len(recovery["referenceOnlyMissingChildTraces"]),
            },
        },
        "failures": failures,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())
