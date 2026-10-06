#!/usr/bin/env python3
"""Validate the closed, cross-cutting G3 Control publication slice authority."""

from __future__ import annotations

import argparse
import copy
import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUTHORITY = ROOT / "g0/g3-control-publication-slice-authority.v1.json"
ALLOCATIONS = ROOT / "coding-readiness/g3-file-allocation-register.csv"
SLICES = ROOT / "coding-readiness/g3-slice-code-go-register.csv"
MODULES = {"HRIS-HRM", "HRIS-PER", "HRIS-PAY", "HRIS-TIM", "HRIS-SYS"}
CONTROL_ALLOCATIONS = {
    "G3-CTL-BE-CONTRACT-VERIFIER", "G3-CTL-BE-CONTRACTS",
    "G3-CTL-BE-GATEWAY", "G3-CTL-BE-GENERATED-HRIS-CONTRACTS",
    "G3-CTL-BE-ROOT-BUILD", "G3-CTL-BE-RUNTIME",
    "G3-CTL-BE-SHARED-WORKFORCE-ABI", "G3-CTL-FE-CONTRACTS",
    "G3-CTL-FE-HRIS-API-TRANSITION", "G3-CTL-FE-HRIS-SHARED",
    "G3-CTL-FE-MANIFEST", "G3-CTL-FE-ROUTES", "G3-CTL-FE-RUNTIME",
    "G3-CTL-PAY-SCAFFOLD", "G3-CTL-PER-MIGRATION-STREAM",
    "G3-CTL-SYS-LISTEN-CONFIGURATION-STREAM",
    "G3-CTL-SYS-LISTEN-INSIGHTS-STREAM",
    "G3-CTL-SYS-LISTEN-ISSUER-STREAM",
    "G3-CTL-SYS-LISTEN-PROTECTED-STREAM", "G3-CTL-TIM-SCAFFOLD",
}
OPERATION_FIELDS = {
    "CENTRAL_MATERIALIZATION": {
        "allowedAllocationIds", "artifactFamilyAuthority",
        "consumerReferenceFields", "sourceCheckpointPolicy",
        "worktreeSessionRule", "writerSessionId",
    },
    "INTEGRATION_MERGE": {
        "allowedAllocationSelector", "artifactFamilyAuthority",
        "consumerReferenceFields", "sourceCheckpointPolicy",
        "worktreeSessionRule", "writerSessionId",
    },
    "CONTROL_BASELINE_SYNC": {
        "artifactFamilyAuthority", "consumerReferenceFields",
        "ownerAllocationIds", "sourceCheckpointPolicy",
        "worktreeSessionRule", "writerSessionId",
    },
}


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def load_authority(path: Path = AUTHORITY) -> dict[str, object]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("Control publication authority must be one JSON object")
    return payload


def allowed_control_allocation_ids(
    payload: dict[str, object], kind: str, owner: str
) -> set[str]:
    operations = payload.get("operations", {})
    operation = operations.get(kind, {}) if isinstance(operations, dict) else {}
    if not isinstance(operation, dict):
        return set()
    if kind == "CENTRAL_MATERIALIZATION":
        values = operation.get("allowedAllocationIds", [])
    elif kind == "CONTROL_BASELINE_SYNC":
        owners = operation.get("ownerAllocationIds", {})
        values = owners.get(owner, []) if isinstance(owners, dict) else []
    else:
        values = []
    return {str(value) for value in values} if isinstance(values, list) else set()


def validate(
    payload: dict[str, object] | None = None,
    allocation_rows: list[dict[str, str]] | None = None,
    slice_rows: list[dict[str, str]] | None = None,
) -> list[str]:
    errors: list[str] = []
    try:
        payload = load_authority() if payload is None else payload
    except (OSError, json.JSONDecodeError, ValueError) as error:
        return [f"Control publication authority unreadable: {error}"]
    allocation_rows = read_csv(ALLOCATIONS) if allocation_rows is None else allocation_rows
    slice_rows = read_csv(SLICES) if slice_rows is None else slice_rows
    if set(payload) != {
        "schema", "state", "moduleSliceIsolation", "operations",
        "crossRepositoryArtifactFamilies",
    }:
        errors.append("authority exact top-level field set drift")
    if (
        payload.get("schema") != "dwp.hris.g3.control-publication-slice-authority.v1"
        or payload.get("state") != "ACTIVE_FAIL_CLOSED"
    ):
        errors.append("authority schema/state drift")
    isolation = payload.get("moduleSliceIsolation", {})
    if isolation != {
        "consumerSliceAuthority": "ACTIVE_OPEN_G3_OWNER_SLICE_ID_EXACT",
        "controlAllocationInModuleSlice": "FORBIDDEN",
        "moduleAllocationInControlCatalog": "FORBIDDEN",
    }:
        errors.append("module/Control slice isolation contract drift")
    operations = payload.get("operations", {})
    if not isinstance(operations, dict) or set(operations) != set(OPERATION_FIELDS):
        errors.append("exact three Control checkpoint operations missing")
        operations = {}
    for kind, fields in OPERATION_FIELDS.items():
        operation = operations.get(kind, {})
        if not isinstance(operation, dict) or set(operation) != fields:
            errors.append(f"{kind}: exact operation field set drift")
            continue
        if operation.get("writerSessionId") != "CONTROL":
            errors.append(f"{kind}: writer must remain Integration Control")
    central = operations.get("CENTRAL_MATERIALIZATION", {})
    central_ids = central.get("allowedAllocationIds", []) if isinstance(central, dict) else []
    if not isinstance(central_ids, list) or central_ids != sorted(CONTROL_ALLOCATIONS):
        errors.append("CENTRAL_MATERIALIZATION exact Control allocation set drift")
    if isinstance(central, dict) and (
        central.get("worktreeSessionRule") != "CONTROL"
        or central.get("sourceCheckpointPolicy") != "FORBIDDEN"
        or central.get("artifactFamilyAuthority")
        != "FILE_ALLOCATION_ARTIFACT_CLASS_AND_PATH_GLOBS_EXACT"
        or central.get("consumerReferenceFields")
        != ["ownerSessionId", "proposalRef", "proposalSha256", "selectedOperationRefs", "sliceId"]
    ):
        errors.append("CENTRAL_MATERIALIZATION policy/reference drift")
    integration = operations.get("INTEGRATION_MERGE", {})
    if isinstance(integration, dict) and (
        integration.get("allowedAllocationSelector")
        != "SOURCE_MODULE_COMMIT_TOUCH_ALLOCATION_EXACT"
        or integration.get("artifactFamilyAuthority")
        != "SOURCE_TOUCH_PATH_OPERATION_AND_BLOB_EXACT"
        or integration.get("sourceCheckpointPolicy")
        != "VERIFIED_SAME_OWNER_REPOSITORY_SLICE_MODULE_COMMIT"
        or integration.get("worktreeSessionRule") != "CONTROL"
        or integration.get("consumerReferenceFields") != [
            "sourceAllocationId", "sourceBlobOid", "sourceCheckpointId",
            "sourceOperation", "sourcePath", "sourceTouchId",
            "targetAllocationId", "targetBlobOid", "targetOperation",
            "targetPath", "targetTouchId",
        ]
    ):
        errors.append("INTEGRATION_MERGE source/consumer exact binding drift")
    baseline = operations.get("CONTROL_BASELINE_SYNC", {})
    owner_ids = baseline.get("ownerAllocationIds", {}) if isinstance(baseline, dict) else {}
    if not isinstance(owner_ids, dict) or set(owner_ids) != MODULES:
        errors.append("CONTROL_BASELINE_SYNC exact owner matrix drift")
        owner_ids = {}
    else:
        for owner, values in owner_ids.items():
            if (
                not isinstance(values, list)
                or values != sorted(set(values))
                or not set(values).issubset(CONTROL_ALLOCATIONS)
            ):
                errors.append(f"{owner}: baseline-sync allocation list drift")
        if set().union(*(set(values) for values in owner_ids.values())) != CONTROL_ALLOCATIONS:
            errors.append("baseline-sync owner matrix does not cover exact Control allocation set")
        exclusive = {
            "G3-CTL-TIM-SCAFFOLD": {"HRIS-TIM"},
            "G3-CTL-PAY-SCAFFOLD": {"HRIS-PAY"},
            "G3-CTL-PER-MIGRATION-STREAM": {"HRIS-PER"},
            "G3-CTL-SYS-LISTEN-CONFIGURATION-STREAM": {"HRIS-SYS"},
            "G3-CTL-SYS-LISTEN-PROTECTED-STREAM": {"HRIS-SYS"},
            "G3-CTL-SYS-LISTEN-INSIGHTS-STREAM": {"HRIS-SYS"},
            "G3-CTL-SYS-LISTEN-ISSUER-STREAM": {"HRIS-SYS"},
        }
        for allocation_id, expected_owners in exclusive.items():
            observed = {
                owner for owner, values in owner_ids.items() if allocation_id in values
            }
            if observed != expected_owners:
                errors.append(f"{allocation_id}: exclusive baseline-sync owner drift")
    if isinstance(baseline, dict) and (
        baseline.get("worktreeSessionRule") != "OWNER_SESSION"
        or baseline.get("sourceCheckpointPolicy")
        != "PRIOR_CENTRAL_MATERIALIZATION_AND_CONTROL_DELIVERY_EXACT"
        or baseline.get("artifactFamilyAuthority")
        != "PRIOR_CENTRAL_MATERIALIZATION_TOUCH_AND_DELIVERY_EXACT"
        or baseline.get("consumerReferenceFields")
        != ["consumerReceiptId", "ownerSessionId", "releaseId", "sliceId"]
    ):
        errors.append("CONTROL_BASELINE_SYNC producer/delivery binding drift")

    allocations = {row.get("allocation_id", ""): row for row in allocation_rows}
    disk_control = {
        allocation_id
        for allocation_id, row in allocations.items()
        if row.get("session_id") == "CONTROL"
        and row.get("state") == "ALLOCATED_G3_NOT_IMPLEMENTED"
    }
    if disk_control != CONTROL_ALLOCATIONS:
        errors.append("file allocation register exact Control set drift")
    for allocation_id in CONTROL_ALLOCATIONS:
        row = allocations.get(allocation_id, {})
        if row.get("repository") not in {"DWP_BACKEND", "DWP_FRONTEND"} or not row.get("path_globs"):
            errors.append(f"{allocation_id}: repository/path family unavailable")
    active = [row for row in slice_rows if row.get("gate_status") == "OPEN_G3_CODE"]
    if {row.get("session_id") for row in active} != MODULES:
        errors.append("active module consumer slice owner coverage drift")
    for row in active:
        leaked = set(str(row.get("file_allocation_ids", "")).split("|")) & CONTROL_ALLOCATIONS
        if leaked:
            errors.append(f"{row.get('slice_id')}: Control allocation leaked into module slice")

    families = payload.get("crossRepositoryArtifactFamilies", [])
    expected_family = {
        "consumerAllocationId": "G3-CTL-FE-CONTRACTS",
        "consumerCheckpointKind": "CENTRAL_MATERIALIZATION",
        "consumerRepository": "DWP_FRONTEND",
        "exactProducerTouchClosure": True,
        "familyId": "BROWSER_API_EVENT_AUTHORIZATION_CONTRACT_SET",
        "producerAllocationId": "G3-CTL-BE-CONTRACTS",
        "producerCheckpointKind": "CENTRAL_MATERIALIZATION",
        "producerPathPrefixes": [
            "contracts/asyncapi/", "contracts/openapi/",
            "contracts/product-authorization/",
        ],
        "producerRepository": "DWP_BACKEND",
        "requiredOwnerAndSliceEquality": True,
    }
    if families != [expected_family]:
        errors.append("cross-repository producer/consumer artifact family drift")
    contract = allocations.get("G3-CTL-BE-CONTRACTS", {})
    if contract.get("path_globs") != (
        "contracts/openapi/**|contracts/asyncapi/**|contracts/product-authorization/**"
    ):
        errors.append("backend contract producer path-glob authority drift")
    return errors


def self_test() -> dict[str, bool]:
    payload = load_authority()
    allocations = read_csv(ALLOCATIONS)
    slices = read_csv(SLICES)
    cases: dict[str, bool] = {"canonical-authority-valid": not validate(payload, allocations, slices)}

    def rejected(mutator: object, *, mutate_slice: bool = False) -> bool:
        candidate = copy.deepcopy(payload)
        candidate_slices = copy.deepcopy(slices)
        if mutate_slice:
            mutator(candidate_slices)  # type: ignore[operator]
        else:
            mutator(candidate)  # type: ignore[operator]
        return bool(validate(candidate, allocations, candidate_slices))

    def leak_control_allocation(values: list[dict[str, str]]) -> None:
        row = next(value for value in values if value.get("gate_status") == "OPEN_G3_CODE")
        row["file_allocation_ids"] = (
            row.get("file_allocation_ids", "") + "|G3-CTL-BE-CONTRACTS"
        )

    cases["wrong-kind-policy-rejected"] = rejected(
        lambda value: value["operations"]["INTEGRATION_MERGE"].update(
            {"sourceCheckpointPolicy": "ANY_CHECKPOINT"}
        )
    )
    cases["missing-control-allocation-rejected"] = rejected(
        lambda value: value["operations"]["CENTRAL_MATERIALIZATION"]["allowedAllocationIds"].pop()
    )
    cases["module-slice-control-allocation-leak-rejected"] = rejected(
        leak_control_allocation,
        mutate_slice=True,
    )
    cases["wrong-producer-family-prefix-rejected"] = rejected(
        lambda value: value["crossRepositoryArtifactFamilies"][0]["producerPathPrefixes"].append("contracts/unowned/")
    )
    cases["cross-owner-scaffold-rejected"] = rejected(
        lambda value: value["operations"]["CONTROL_BASELINE_SYNC"]["ownerAllocationIds"]["HRIS-HRM"].append("G3-CTL-TIM-SCAFFOLD")
    )
    cases["integration-module-touch-selector-drift-rejected"] = rejected(
        lambda value: value["operations"]["INTEGRATION_MERGE"].update(
            {"allowedAllocationSelector": "CONTROL_ALLOCATION"}
        )
    )
    cases["all-three-kinds-resolve-independent-authority"] = (
        bool(allowed_control_allocation_ids(payload, "CENTRAL_MATERIALIZATION", "HRIS-HRM"))
        and bool(allowed_control_allocation_ids(payload, "CONTROL_BASELINE_SYNC", "HRIS-SYS"))
        and not allowed_control_allocation_ids(payload, "INTEGRATION_MERGE", "HRIS-HRM")
    )
    return cases


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--compact", action="store_true")
    arguments = parser.parse_args()
    errors = validate()
    cases = self_test() if arguments.self_test and not errors else {}
    if cases and not all(cases.values()):
        errors.append("Control publication authority hostile mutation accepted")
    payload = {
        "schema": "dwp.hris.g3.control-publication-slice-authority-validation.v1",
        "status": "PASS" if not errors else "FAIL",
        "authoritySha256": hashlib.sha256(AUTHORITY.read_bytes()).hexdigest() if AUTHORITY.is_file() else "",
        "selfTests": len(cases),
        "cases": cases,
        "errors": errors,
    }
    print(json.dumps(payload, sort_keys=True, separators=(",", ":") if arguments.compact else None))
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
