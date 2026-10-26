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
INDEX_PATH = ROOT / "docs/06-delivery/hris/current-authority-index.v1.json"
EXPECTED_INTEGRITY_PIN_PATHS = {
    "docs/06-delivery/hris/recovery/hris-porting-blueprint-2026-09-09/coding-readiness/cross-module-contract-register.csv",
    "docs/06-delivery/hris/recovery/hris-porting-blueprint-2026-09-09/coding-readiness/service-api-auth-binding-register.csv",
    "docs/06-delivery/hris/recovery/hris-porting-blueprint-2026-09-09/coding-readiness/hris-information-architecture-register.csv",
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-04-central-admission-r1/cross-module-contract-register.successor.v1.csv",
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-04-central-admission-r1/service-api-auth-binding-register.successor.v1.csv",
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-04-module-start-r1/semantic-dispositions/base-tfr-tim-003.semantic-disposition.v1.json",
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-04-module-start-r1/tokens/base-tfr-tim-003.hrm-successor.start-token.v1.json",
    "docs/06-delivery/hris/recovery/hris-porting-blueprint-2026-09-09/session-registers/hris-sys-source-coverage.csv",
    "docs/06-delivery/hris/2026-10-20-hris-navigation-experience-successor.md",
    "docs/06-delivery/hris/2026-10-22-hris-sidebar-presentation-successor.md",
    "apps/dwp/src/features/hris/shell/model/hris-runtime-navigation-manifest.ts",
    "docs/06-delivery/hris/wave7-2026-10-17/execution-roadmap-successor.v20.json",
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-preflight-r1/semantic-dependency-migration-preflight.v1.json",
}
EXPECTED_OVERLAY_CONFIGS = {
    "CROSS_MODULE_CONTRACT": {
        "immutableBase": "docs/06-delivery/hris/recovery/hris-porting-blueprint-2026-09-09/coding-readiness/cross-module-contract-register.csv",
        "successor": "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-04-central-admission-r1/cross-module-contract-register.successor.v1.csv",
        "expectedSuccessorIds": ["XCON-027"],
    },
    "SERVICE_API_AUTH_BINDING": {
        "immutableBase": "docs/06-delivery/hris/recovery/hris-porting-blueprint-2026-09-09/coding-readiness/service-api-auth-binding-register.csv",
        "successor": "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-04-central-admission-r1/service-api-auth-binding-register.successor.v1.csv",
        "expectedSuccessorIds": ["SVC-PEP-HRM-007"],
    },
}
EXPECTED_REQUIRED_CONTRACT_IDS = ["XCON-027", "SVC-PEP-HRM-007"]
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


def main() -> int:
    failures: list[str] = []
    require(INDEX_PATH.is_file(), "current authority index is missing", failures)
    if failures:
        print(json.dumps({"status": "FAIL", "failures": failures}, indent=2))
        return 1

    index = load_json(INDEX_PATH)
    require(index.get("schema") == "dwp.hris.current-authority-index.v1", "index schema drift", failures)
    require(
        index.get("state") == "CURRENT_READ_AUTHORITY_CHAIN_DEFAULT_OFF_ZERO_TENANT_ENROLLMENT",
        "index state drift",
        failures,
    )

    ia = index["informationArchitecture"]
    overlay_configs = index["contractRegisterOverlays"]
    batch04 = index["batch04ContractAuthority"]
    execution = index["executionAuthority"]
    recovery = index["sourceCoverageRecovery"]
    expected_pin_paths = {
        ia["immutableBaseRegister"],
        *ia["navigationPresentationSuccessors"],
        ia["runtimeManifest"],
        *(item[key] for item in overlay_configs for key in ("immutableBase", "successor")),
        batch04["semanticDisposition"],
        batch04["startToken"],
        execution["roadmap"],
        execution["batch06Preflight"],
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
        "integrity pin set no longer matches the sealed R1 authority chain",
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
        "contract overlay configuration no longer matches the sealed R1 chain",
        failures,
    )
    require(
        batch04.get("requiredContractIds") == EXPECTED_REQUIRED_CONTRACT_IDS,
        "Batch-04 required contract IDs drift",
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
        "schema": "dwp.hris.current-authority-validation.v1",
        "status": "PASS" if not failures else "FAIL",
        "checks": {
            "iaBaseNodes": len(ia_rows),
            "runtimeNodes": ia["expectedRuntimeNodes"],
            "shellEntries": ia["expectedShellEntries"],
            "taskGroups": ia["expectedTaskGroups"],
            "integrityPins": len(integrity_pins),
            "contractOverlays": overlays,
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
