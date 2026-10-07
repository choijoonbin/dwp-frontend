#!/usr/bin/env python3
"""Validate the G2 HRIS successor-authority packet without running product tests.

This validator is deliberately independent from the historical HRM readiness
validator.  The historical validator requires unrecovered row-level inputs and
therefore cannot establish the truth of this aggregate successor packet.
"""

from __future__ import annotations

import argparse
import copy
import csv
import hashlib
import io
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any, Callable


SCRIPT = Path(__file__).resolve()
REPO_ROOT = SCRIPT.parents[4]
DEFAULT_BUNDLE_ROOT = REPO_ROOT / "docs/06-delivery/hris/g2-successors/2026-10-07"
DEFAULT_BACKEND = REPO_ROOT.parent / "dwp-backend"

API_NAME = "hrm-api-event-contract-successor.v1.json"
COVERAGE_NAME = "hrm-source-family-coverage-successor.v1.csv"
SEAL_NAME = "hrm-source-family-coverage-successor.v1.seal.json"
OWNERSHIP_NAME = "g3-primary-ownership-disposition.v1.json"
MANIFEST_NAME = "manifest.v1.json"
EXACT_FILES = {API_NAME, COVERAGE_NAME, SEAL_NAME, OWNERSHIP_NAME, MANIFEST_NAME}
PACKET_PREFIX = "docs/06-delivery/hris/g2-successors/2026-10-07"
EXPECTED_MANIFEST_ENTRIES = {
    API_NAME: (f"{PACKET_PREFIX}/{API_NAME}", "HRM_API_EVENT_SUCCESSOR_DISPOSITION"),
    COVERAGE_NAME: (f"{PACKET_PREFIX}/{COVERAGE_NAME}", "HRM_17_FAMILY_AGGREGATE_TRACE"),
    SEAL_NAME: (f"{PACKET_PREFIX}/{SEAL_NAME}", "HRM_COVERAGE_SUCCESSOR_SEAL"),
    OWNERSHIP_NAME: (f"{PACKET_PREFIX}/{OWNERSHIP_NAME}", "G2_TO_G3_OWNERSHIP_DISPOSITION"),
}

CURRENT_COMMIT = "5612cc1a0b4a21a4d0b9107739579f23d165790f"
RECONCILED_COMMIT = "0731f6df2d55cdeb4784a09ae6e28d4ae4b0c294"
RESULT_COMMIT = "ea630a5f2dec9b1f044f11dd5eb66ffb6f87941a"
PENDING = "BACKEND_RESULT_COMMIT_PENDING"

HISTORICAL_API_EXPECTED = (35196, "5390eac887c06d33e744252ddf013183f2f1e55198f8a28d341197b6a6336e65")
HISTORICAL_API_RECOVERED = (25944, "0c3ec58b29dcf534d1b887fed5678e878e4a514cf3f943165e47dd7a486355bb")
HISTORICAL_COVERAGE = (514029, "8b9044ed595be8847fddab74075c5f308e61343f179da1da4e231e8ffe48e6c2", 583)
HISTORICAL_OWNERSHIP = (102456, "11f51f88e25ff01666f347467c82d2e825a81091926cff03f141fd750b476e9b", 525)

EXPECTED_OPERATIONS = {
    "searchPeople", "getPerson360", "createEmployeeChangeRequest",
    "submitEmployeeChangeRequest", "recordEmployeeChangeDecision",
    "applyEmployeeChangeRequest", "createAssignmentEvent",
    "validateAssignmentEvent", "submitAssignmentEvent",
    "publishAssignmentEvent", "queryOrganizationGraph",
    "issueEmploymentContract", "requestCertificate", "createSeparationCase",
    "getCommandReceipt", "bootstrapWorkforceSnapshots",
    "initiateWorkforceIngestion", "getWorkforceHomeWidgets",
}
EXPECTED_EVENTS = {
    "PersonChanged.v1", "WorkerHired.v1", "EmploymentChanged.v1",
    "AssignmentChanged.v1", "OrganizationChanged.v1",
    "CompensationBasisChanged.v1", "EmploymentContractIssued.v1",
    "EmployeeChangeApplied.v1", "WorkerSeparated.v1",
    "CertificateIssued.v1", "WorkforceIngestionReconciled.v1",
    "WorkforceWidgetSnapshot.v1",
}
EXPECTED_OPERATION_DISPOSITIONS = {
    "searchPeople": "IMPLEMENTED_SUCCESSOR_PEOPLE360",
    "getPerson360": "IMPLEMENTED_SUCCESSOR_PEOPLE360",
    "createEmployeeChangeRequest": "DEFERRED_NOT_IMPLEMENTED",
    "submitEmployeeChangeRequest": "DEFERRED_NOT_IMPLEMENTED",
    "recordEmployeeChangeDecision": "DEFERRED_NOT_IMPLEMENTED",
    "applyEmployeeChangeRequest": "DEFERRED_NOT_IMPLEMENTED",
    "createAssignmentEvent": "PARTIAL_OVERLAP_PROPOSAL_ONLY",
    "validateAssignmentEvent": "PARTIAL_OVERLAP_PROPOSAL_ONLY",
    "submitAssignmentEvent": "PARTIAL_OVERLAP_PROPOSAL_ONLY",
    "publishAssignmentEvent": "DEFERRED_ASSIGNMENT_LEDGER_NOT_MUTATED",
    "queryOrganizationGraph": "DEFERRED_NOT_IMPLEMENTED",
    "issueEmploymentContract": "DEFERRED_NOT_IMPLEMENTED",
    "requestCertificate": "DEFERRED_NOT_IMPLEMENTED",
    "createSeparationCase": "DEFERRED_NOT_IMPLEMENTED",
    "getCommandReceipt": "DEFERRED_NOT_IMPLEMENTED",
    "bootstrapWorkforceSnapshots": "REPLACED_FOR_PER_BY_IN_PROCESS_PORT",
    "initiateWorkforceIngestion": "DEFERRED_NOT_IMPLEMENTED",
    "getWorkforceHomeWidgets": "DEFERRED_NOT_IMPLEMENTED",
}
EXPECTED_EVENT_DISPOSITIONS = {
    "PersonChanged.v1": "DEFERRED_NO_PRODUCER",
    "WorkerHired.v1": "DEFERRED_NO_PRODUCER",
    "EmploymentChanged.v1": "SCHEMA_PRESENT_NO_PRODUCER",
    "AssignmentChanged.v1": "SCHEMA_PRESENT_NO_PRODUCER",
    "OrganizationChanged.v1": "SCHEMA_PRESENT_NO_PRODUCER",
    "CompensationBasisChanged.v1": "SCHEMA_PRESENT_NO_PRODUCER",
    "EmploymentContractIssued.v1": "DEFERRED_NO_PRODUCER",
    "EmployeeChangeApplied.v1": "DEFERRED_NO_PRODUCER",
    "WorkerSeparated.v1": "DEFERRED_NO_PRODUCER",
    "CertificateIssued.v1": "DEFERRED_NO_PRODUCER",
    "WorkforceIngestionReconciled.v1": "DEFERRED_NO_PRODUCER",
    "WorkforceWidgetSnapshot.v1": "DEFERRED_NO_PRODUCER",
}
EXPECTED_PROPOSAL_EVENTS = {
    "people.assignment-proposal.created.v1",
    "people.assignment-proposal.validated.v1",
    "people.assignment-proposal.submitted.v1",
    "people.assignment-proposal.cancelled.v1",
}
EXPECTED_MODERN_INPUTS = {
    "coding-readiness/modern-capability-exact-schema-contracts.v1.json",
    "coding-readiness/modern-capability-event-payload-contracts.v1.json",
    "coding-readiness/modern-capability-public-identity-registry.v1.json",
    "coding-readiness/modern-capability-semantic-bindings.v1.json",
}
EXPECTED_GATES = {
    "G2_HRM_PEOPLE_CONTRACT_DISPOSITION",
    "G2_HRM_SOURCE_COVERAGE_SUCCESSOR",
    "G2_OWNER_CONTRACT_DISPOSITION",
}
EXPECTED_COVERAGE_IDS = {f"TFR-HRM-{number:03d}" for number in range(1, 18)}
EXPECTED_G3_PROFILE = {
    "PUBLIC_PEP": 175,
    "INTERNAL_SERVICE_PEP": 11,
    "XCON_PRODUCER": 21,
    "SYS_G2_CONTRACT": 84,
    "BASE_EVENT": 48,
    "MODERN_OPERATION": 199,
    "MODERN_EVENT": 157,
}
EXPECTED_COVERAGE_CURRENT_DISPOSITION_SHA256 = "abd1153e4adf54ab20b27a74a6792d24c6f013933b7157ffd41ccb769016cd57"
EXPECTED_HISTORICAL_PROFILE = {
    "PUBLIC_PEP": 175,
    "INTERNAL_SERVICE_PEP": 11,
    "XCON_PRODUCER": 21,
    "SYS_G2_CONTRACT": 84,
    "BASE_EVENT": 48,
    "MODERN_OPERATION": 100,
    "MODERN_EVENT": 86,
}

EXPECTED_HTTP = {
    "getAssignment": ("GET", "/v1/workforce/assignments/{assignmentId}"),
    "getAssignmentTimeline": ("GET", "/v1/workforce/assignments/{assignmentId}/timeline"),
    "getAssignmentProposal": ("GET", "/v1/workforce/assignment-proposals/{proposalId}"),
    "createAssignmentProposal": ("POST", "/v1/workforce/assignment-proposals"),
    "validateAssignmentProposal": ("POST", "/v1/workforce/assignment-proposals/{proposalId}/validate"),
    "submitAssignmentProposal": ("POST", "/v1/workforce/assignment-proposals/{proposalId}/submit"),
    "cancelAssignmentProposal": ("POST", "/v1/workforce/assignment-proposals/{proposalId}/cancel"),
    "searchPeople360": ("GET", "/v1/workforce/people"),
    "getPerson360": ("GET", "/v1/workforce/people/{publicId}"),
    "getSelfPeople360": ("GET", "/v1/hr/home"),
    "getTeamPerson360": ("GET", "/v1/hr/team"),
}
EXPECTED_PER_GATEWAY = {
    ("GET", "/api/people/v1/hris/performance/cycles"),
    ("GET", "/api/people/v1/hris/performance/cycles/{cycleId}"),
    ("POST", "/api/people/v1/hris/performance/cycles"),
    ("PATCH", "/api/people/v1/hris/performance/cycles/{cycleId}"),
    ("POST", "/api/people/v1/hris/performance/cycles/{cycleId}/validate"),
    ("POST", "/api/people/v1/hris/performance/cycles/{cycleId}/population-previews"),
    ("POST", "/api/people/v1/hris/performance/cycles/{cycleId}/publish"),
    ("GET", "/api/people/v1/hris/performance/command-receipts/{receiptId}"),
}

COVERAGE_HEADER = [
    "resolution_id", "module", "source_family_sha256", "source_capability_ids",
    "source_row_count", "resolution_refs", "primary_resolution_refs",
    "related_resolution_refs", "resolution_state", "consolidation_rationale",
    "source_register", "current_slice_id", "current_owner_session",
    "current_implementation_state", "source_origin_commit",
    "integration_result_commit", "current_source_blob_refs",
    "contract_successor_refs", "remaining_blocker", "production_state",
]

JSON_TOP_LEVEL_KEYS = {
    API_NAME: {
        "schema", "contractId", "status", "ownerSession", "implementationOwnerService",
        "serviceBasePath", "gatewayBasePath", "supersedes", "sourcePins",
        "compatibility", "httpOperations", "inProcessContracts", "outboxEvents",
        "assignmentProposalBoundary", "historicalOperationDispositions",
        "historicalEventDispositions", "coverageTargetBindings", "featureGates",
        "validation", "authorityBoundary",
    },
    SEAL_NAME: {
        "schema", "status", "artifact", "historicalPredecessor",
        "authoritativeAggregateSource", "sourcePins", "aggregateTraceSemantics",
        "validation", "authorityBoundary",
    },
    OWNERSHIP_NAME: {
        "schema", "registerId", "status", "supersedesHistorical", "sourcePins",
        "confirmedCurrentOwners", "ownershipSeparation", "historicalProfile",
        "g3TargetProfile", "missingCanonicalInputs", "invariants", "authorityBoundary",
    },
    MANIFEST_NAME: {
        "schema", "packetId", "status", "generatedDate", "sourcePins", "artifacts",
        "historicalFingerprints", "ownerGates", "validation", "authorityBoundary",
    },
}


@dataclass
class Finding:
    code: str
    message: str


@dataclass
class Bundle:
    root: Path
    raw: dict[str, bytes]
    json_docs: dict[str, dict[str, Any]]
    coverage_header: list[str]
    coverage_rows: list[dict[str, str]]


def digest(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def is_int(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def add(findings: list[Finding], code: str, message: str) -> None:
    findings.append(Finding(code, message))


def strict_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def reject_constant(value: str) -> None:
    raise ValueError(f"non-finite JSON value: {value}")


def load_json_bytes(name: str, raw: bytes, findings: list[Finding]) -> dict[str, Any] | None:
    if raw.startswith(b"\xef\xbb\xbf"):
        add(findings, "JSON_BOM", f"{name} has a UTF-8 BOM")
        return None
    if b"\r" in raw:
        add(findings, "JSON_NEWLINE", f"{name} must use LF newlines")
    if not raw.endswith(b"\n") or raw.endswith(b"\n\n"):
        add(findings, "JSON_TRAILING_LF", f"{name} must end with exactly one LF")
    try:
        text = raw.decode("utf-8")
        value = json.loads(text, object_pairs_hook=strict_object, parse_constant=reject_constant)
    except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as exc:
        add(findings, "JSON_PARSE", f"{name}: {exc}")
        return None
    if not isinstance(value, dict):
        add(findings, "JSON_ROOT", f"{name} root must be an object")
        return None
    return value


def load_bundle(root: Path) -> tuple[Bundle | None, list[Finding]]:
    findings: list[Finding] = []
    if not root.is_dir():
        add(findings, "BUNDLE_ROOT", f"bundle root is not a directory: {root}")
        return None, findings
    actual = {entry.name for entry in root.iterdir()}
    if actual != EXACT_FILES:
        add(findings, "BUNDLE_FILE_SET", f"expected {sorted(EXACT_FILES)}, got {sorted(actual)}")
    raw: dict[str, bytes] = {}
    json_docs: dict[str, dict[str, Any]] = {}
    for name in sorted(EXACT_FILES):
        path = root / name
        if not path.exists():
            continue
        if path.is_symlink() or not path.is_file():
            add(findings, "BUNDLE_FILE_TYPE", f"{name} must be a regular non-symlink file")
            continue
        raw[name] = path.read_bytes()
        if name.endswith(".json"):
            parsed = load_json_bytes(name, raw[name], findings)
            if parsed is not None:
                json_docs[name] = parsed
    header: list[str] = []
    rows: list[dict[str, str]] = []
    if COVERAGE_NAME in raw:
        csv_raw = raw[COVERAGE_NAME]
        if csv_raw.startswith(b"\xef\xbb\xbf"):
            add(findings, "CSV_BOM", "coverage CSV has a UTF-8 BOM")
        if b"\r" in csv_raw:
            add(findings, "CSV_NEWLINE", "coverage CSV must use LF newlines")
        if not csv_raw.endswith(b"\n") or csv_raw.endswith(b"\n\n"):
            add(findings, "CSV_TRAILING_LF", "coverage CSV must end with exactly one LF")
        try:
            reader = csv.DictReader(io.StringIO(csv_raw.decode("utf-8"), newline=""))
            header = reader.fieldnames or []
            rows = list(reader)
        except (UnicodeDecodeError, csv.Error) as exc:
            add(findings, "CSV_PARSE", str(exc))
        if header != COVERAGE_HEADER:
            add(findings, "CSV_HEADER", f"unexpected coverage header: {header}")
        if len(header) != len(set(header)):
            add(findings, "CSV_DUPLICATE_HEADER", "coverage header contains duplicates")
        for index, row in enumerate(rows, start=2):
            if None in row:
                add(findings, "CSV_SURPLUS_CELL", f"coverage row {index} has surplus cells")
            for required in ("resolution_id", "module", "source_family_sha256", "source_row_count"):
                if not row.get(required, "").strip():
                    add(findings, "CSV_REQUIRED_FIELD", f"coverage row {index} missing {required}")
    return Bundle(root, raw, json_docs, header, rows), findings


def safe_repo_path(value: Any) -> str | None:
    if not isinstance(value, str) or not value or "\\" in value or any(ord(c) < 32 for c in value):
        return None
    pure = PurePosixPath(value)
    if pure.is_absolute() or ".." in pure.parts or str(pure) != value:
        return None
    return value


def exact_keys(doc: dict[str, Any], name: str, findings: list[Finding]) -> None:
    expected = JSON_TOP_LEVEL_KEYS[name]
    actual = set(doc)
    if actual != expected:
        add(findings, "TOP_LEVEL_KEYS", f"{name}: missing={sorted(expected-actual)} extra={sorted(actual-expected)}")


def validate_manifest(bundle: Bundle, findings: list[Finding]) -> None:
    manifest = bundle.json_docs.get(MANIFEST_NAME)
    if not manifest:
        return
    exact_keys(manifest, MANIFEST_NAME, findings)
    entries = manifest.get("artifacts")
    if not isinstance(entries, list):
        add(findings, "MANIFEST_ENTRIES", "manifest artifacts must be a list")
        return
    expected_names = EXACT_FILES - {MANIFEST_NAME}
    found_names: set[str] = set()
    for entry in entries:
        if not isinstance(entry, dict):
            add(findings, "MANIFEST_ENTRY", "manifest entry must be an object")
            continue
        rel = safe_repo_path(entry.get("path"))
        if rel is None:
            add(findings, "MANIFEST_PATH", f"unsafe manifest path: {entry.get('path')!r}")
            continue
        name = PurePosixPath(rel).name
        if name == MANIFEST_NAME:
            add(findings, "MANIFEST_SELF_PIN", "manifest must not pin itself")
        found_names.add(name)
        if name not in expected_names or name not in bundle.raw:
            add(findings, "MANIFEST_ENTRY_SET", f"unexpected manifest entry {name}")
            continue
        expected_path, expected_role = EXPECTED_MANIFEST_ENTRIES[name]
        if rel != expected_path or entry.get("role") != expected_role or set(entry) != {"path", "sha256", "bytes", "role"}:
            add(findings, "MANIFEST_PATH_ROLE", f"manifest path/role/keys drift for {name}")
        value = bundle.raw[name]
        if entry.get("sha256") != digest(value):
            add(findings, "MANIFEST_SHA", f"manifest digest mismatch for {name}")
        if not is_int(entry.get("bytes")) or entry.get("bytes") != len(value):
            add(findings, "MANIFEST_BYTES", f"manifest byte count mismatch for {name}")
    if found_names != expected_names or len(entries) != 4:
        add(findings, "MANIFEST_ENTRY_SET", f"manifest must pin exactly {sorted(expected_names)}")
    if "sealedPayloadSha256" in manifest:
        add(findings, "MANIFEST_SELF_PIN", "manifest cannot carry a self digest")


def validate_seal(bundle: Bundle, findings: list[Finding]) -> None:
    seal = bundle.json_docs.get(SEAL_NAME)
    if not seal or COVERAGE_NAME not in bundle.raw:
        return
    exact_keys(seal, SEAL_NAME, findings)
    if (seal.get("schema"), seal.get("status")) != (
        "dwp.hris.g2.hrm-source-family-coverage-successor-seal.v1",
        "SEALED_G2_SUCCESSOR_AGGREGATE_TRACE",
    ):
        add(findings, "DOCUMENT_IDENTITY", "coverage seal identity/status drift")
    artifact = seal.get("artifact")
    if not isinstance(artifact, dict):
        add(findings, "COVERAGE_SEAL", "seal artifact must be an object")
        return
    path = safe_repo_path(artifact.get("path"))
    if path != f"{PACKET_PREFIX}/{COVERAGE_NAME}":
        add(findings, "COVERAGE_SEAL_TARGET", "coverage seal must target only the coverage CSV")
    raw = bundle.raw[COVERAGE_NAME]
    if artifact.get("sha256") != digest(raw):
        add(findings, "COVERAGE_SEAL_SHA", "coverage seal digest mismatch")
    if not is_int(artifact.get("bytes")) or artifact.get("bytes") != len(raw):
        add(findings, "COVERAGE_SEAL_BYTES", "coverage seal byte count mismatch")
    if artifact.get("dataRows") != 17 or artifact.get("sourceRowCount") != 583:
        add(findings, "COVERAGE_SEAL_COUNTS", "coverage seal must record 17 aggregate rows / 583 source rows")
    semantics = seal.get("aggregateTraceSemantics", {})
    expected_semantics = {
        "familyRowsAreAggregateDispositions": True,
        "familySha256Meaning": "SHA256_OF_HISTORICAL_TARGET_API_OR_EVENT_FAMILY_VALUE",
        "familySha256IsNotSourceFileDigest": True,
        "sourceRowCountSum": 583,
        "historicalRowsReconstructed": False,
        "successorPurpose": "PRESERVE_EXACT_17_FAMILY_HASH_COUNT_LINEAGE_AND_CURRENT_IMPLEMENTATION_DISPOSITION",
    }
    if semantics != expected_semantics:
        add(findings, "COVERAGE_SEMANTICS", "seal must deny historical row reconstruction and source-file digest semantics")
    expected_source = {
        "path": "docs/06-delivery/hris/recovery/exact-supplements/2026-10-06/hris-porting-blueprint-2026-09-09/coding-readiness/target-family-resolution-register.csv",
        "sha256": "3e3618ff3ac150da8c9c7cbd3b1018e30e69652f28f3dbd8c87edb7df6a83819",
        "bytes": 38399,
        "gitBlob": "071237594bc67f8643de64f899ab1b5128df2731",
    }
    if seal.get("authoritativeAggregateSource") != expected_source:
        add(findings, "COVERAGE_AUTHORITATIVE_SOURCE", "coverage authoritative aggregate source drift")
    expected_validation = {
        "expectedResolutionIds": [f"TFR-HRM-{number:03d}" for number in range(1, 18)],
        "expectedFamilyCount": 17,
        "expectedSourceRowCount": 583,
        "ownerException": {"resolutionId": "TFR-HRM-015", "currentOwnerSession": "HRIS-SYS"},
    }
    if seal.get("validation") != expected_validation:
        add(findings, "COVERAGE_SEAL_VALIDATION", "coverage seal validation contract drift")
    expected_authority = {
        "closesOwnerGate": "G2_HRM_SOURCE_COVERAGE_SUCCESSOR",
        "exactHistoricalRowsRecovered": False,
        "moduleCodeGoGranted": False,
        "productionAuthorizationGranted": False,
    }
    if seal.get("authorityBoundary") != expected_authority:
        add(findings, "AUTHORITY_ESCALATION", "coverage seal authority boundary drift")


def target_family_rows(findings: list[Finding]) -> dict[str, dict[str, str]]:
    path = REPO_ROOT / "docs/06-delivery/hris/recovery/exact-supplements/2026-10-06/hris-porting-blueprint-2026-09-09/coding-readiness/target-family-resolution-register.csv"
    if not path.is_file():
        add(findings, "TARGET_FAMILY_SOURCE", f"missing {path}")
        return {}
    raw = path.read_bytes()
    if digest(raw) != "3e3618ff3ac150da8c9c7cbd3b1018e30e69652f28f3dbd8c87edb7df6a83819":
        add(findings, "TARGET_FAMILY_SOURCE_SHA", "exact target-family supplement digest drift")
    with path.open(newline="", encoding="utf-8") as handle:
        return {row["resolution_id"]: row for row in csv.DictReader(handle) if row["resolution_id"].startswith("TFR-HRM-")}


def validate_coverage(bundle: Bundle, api: dict[str, Any], findings: list[Finding]) -> None:
    rows = bundle.coverage_rows
    by_id: dict[str, dict[str, str]] = {}
    for row in rows:
        rid = row.get("resolution_id", "")
        if rid in by_id:
            add(findings, "COVERAGE_DUPLICATE_ID", f"duplicate {rid}")
        by_id[rid] = row
    if set(by_id) != EXPECTED_COVERAGE_IDS or len(rows) != 17:
        add(findings, "COVERAGE_CLOSED_SET", f"coverage IDs must be {sorted(EXPECTED_COVERAGE_IDS)}")
    represented = 0
    for rid, row in by_id.items():
        try:
            represented += int(row.get("source_row_count", ""))
        except ValueError:
            add(findings, "COVERAGE_ROW_COUNT", f"{rid} source_row_count is not an integer")
        if row.get("module") != "HRM" or row.get("current_slice_id") != f"BASE-{rid}":
            add(findings, "COVERAGE_IDENTITY", f"{rid} module/slice mismatch")
        if row.get("production_state") != "NOT_AUTHORIZED_G6":
            add(findings, "PRODUCTION_AUTHORITY", f"{rid} must remain NOT_AUTHORIZED_G6")
    if represented != 583:
        add(findings, "COVERAGE_SOURCE_ROW_SUM", f"coverage source row sum is {represented}, expected 583")
    if by_id.get("TFR-HRM-006", {}).get("current_implementation_state") != "RETIRED":
        add(findings, "COVERAGE_RETIRED_DRIFT", "TFR-HRM-006 must remain retired")
    if by_id.get("TFR-HRM-015", {}).get("current_owner_session") != "HRIS-SYS":
        add(findings, "COVERAGE_OWNER_EXCEPTION", "TFR-HRM-015 must remain HRIS-SYS owned")
    current_fields = COVERAGE_HEADER[11:]
    current_dispositions = [
        {"resolution_id": rid, **{field: by_id[rid].get(field, "") for field in current_fields}}
        for rid in sorted(by_id)
    ]
    current_digest = digest(json.dumps(
        current_dispositions, sort_keys=True, separators=(",", ":")
    ).encode("utf-8"))
    if current_digest != EXPECTED_COVERAGE_CURRENT_DISPOSITION_SHA256:
        add(findings, "COVERAGE_CURRENT_DISPOSITION", "one or more of the 17 current disposition rows drifted")
    source = target_family_rows(findings)
    original_columns = COVERAGE_HEADER[:11]
    for rid in EXPECTED_COVERAGE_IDS:
        if rid not in by_id or rid not in source:
            continue
        for column in original_columns:
            if by_id[rid].get(column) != source[rid].get(column):
                add(findings, "COVERAGE_FAMILY_DRIFT", f"{rid} {column} differs from exact supplement")
    bindings = api.get("coverageTargetBindings", [])
    binding_map = {item.get("resolutionId"): item for item in bindings if isinstance(item, dict)}
    if set(binding_map) != EXPECTED_COVERAGE_IDS or len(bindings) != 17:
        add(findings, "API_COVERAGE_CLOSED_SET", "API coverage bindings must contain exactly 17 HRM families")
    for rid, row in by_id.items():
        binding = binding_map.get(rid, {})
        try:
            expected_count = int(row.get("source_row_count", ""))
        except ValueError:
            continue
        if binding.get("sourceFamilySha256") != row.get("source_family_sha256") or binding.get("sourceRowCount") != expected_count:
            add(findings, "API_COVERAGE_DRIFT", f"API coverage binding drift for {rid}")


def validate_api(api: dict[str, Any], findings: list[Finding]) -> None:
    exact_keys(api, API_NAME, findings)
    identity = (api.get("schema"), api.get("contractId"), api.get("status"), api.get("ownerSession"), api.get("implementationOwnerService"))
    if identity != (
        "dwp.hris.g2.hrm-api-event-contract-successor.v1",
        "dwp.hris.hrm.successor.v1",
        "G2_SOURCE_INTEGRATED_NOT_MODULE_CODE_GO",
        "HRIS-HRM",
        "dwp-people-server",
    ) or api.get("serviceBasePath") != "/v1" or api.get("gatewayBasePath") != "/api/people/v1":
        add(findings, "DOCUMENT_IDENTITY", "API successor identity/status/base paths drift")
    operations = api.get("httpOperations", [])
    by_id: dict[str, dict[str, Any]] = {}
    method_paths: set[tuple[Any, Any]] = set()
    for operation in operations:
        if not isinstance(operation, dict):
            add(findings, "API_OPERATION", "HTTP operation must be an object")
            continue
        oid = operation.get("operationId")
        pair = (operation.get("method"), operation.get("servicePath"))
        if oid in by_id:
            add(findings, "API_DUPLICATE_OPERATION", f"duplicate operationId {oid}")
        if pair in method_paths:
            add(findings, "API_DUPLICATE_ROUTE", f"duplicate HTTP route {pair}")
        by_id[oid] = operation
        method_paths.add(pair)
        if operation.get("productionState") != "NOT_AUTHORIZED_G6":
            add(findings, "PRODUCTION_AUTHORITY", f"{oid} must remain NOT_AUTHORIZED_G6")
    if set(by_id) != set(EXPECTED_HTTP) or len(operations) != len(EXPECTED_HTTP):
        add(findings, "API_SUCCESSOR_CLOSED_SET", f"successor HTTP operation set drift: {sorted(by_id)}")
    for oid, pair in EXPECTED_HTTP.items():
        if oid in by_id and (by_id[oid].get("method"), by_id[oid].get("servicePath")) != pair:
            add(findings, "API_ROUTE_DRIFT", f"{oid} route differs from source contract")
    for oid in ("searchPeople360", "getPerson360", "getSelfPeople360", "getTeamPerson360"):
        constraints = by_id.get(oid, {}).get("queryConstraints", {})
        if constraints.get("projection") != "people360" or constraints.get("asOf") != "REQUIRED":
            add(findings, "PEOPLE360_AS_OF", f"{oid} must require projection=people360 and asOf")
    if by_id.get("getTeamPerson360", {}).get("queryConstraints", {}).get("personId") != "REQUIRED":
        add(findings, "PEOPLE360_TEAM_PERSON", "team People360 must require personId")
    historical = api.get("historicalOperationDispositions", [])
    historical_ids = [item.get("operationId") for item in historical if isinstance(item, dict)]
    if set(historical_ids) != EXPECTED_OPERATIONS or len(historical_ids) != 18:
        add(findings, "HISTORICAL_OPERATION_CLOSED_SET", "historical operation disposition must be exact 18-item set")
    disposition = {item.get("operationId"): item for item in historical if isinstance(item, dict)}
    for oid, expected in EXPECTED_OPERATION_DISPOSITIONS.items():
        if disposition.get(oid, {}).get("disposition") != expected:
            add(findings, "HISTORICAL_OPERATION_DISPOSITION", f"{oid} must be {expected}")
    events = api.get("historicalEventDispositions", [])
    event_ids = [item.get("eventType") for item in events if isinstance(item, dict)]
    if set(event_ids) != EXPECTED_EVENTS or len(event_ids) != 12:
        add(findings, "HISTORICAL_EVENT_CLOSED_SET", "historical event disposition must be exact 12-item set")
    event_disposition = {item.get("eventType"): item for item in events if isinstance(item, dict)}
    for event_type, expected in EXPECTED_EVENT_DISPOSITIONS.items():
        if event_disposition.get(event_type, {}).get("disposition") != expected:
            add(findings, "HISTORICAL_EVENT_DISPOSITION", f"{event_type} must be {expected}")
    outbox = api.get("outboxEvents", [])
    outbox_types = {item.get("eventType") for item in outbox if isinstance(item, dict)}
    if outbox_types != EXPECTED_PROPOSAL_EVENTS or len(outbox) != 4:
        add(findings, "PROPOSAL_EVENT_CLOSED_SET", "proposal event set must contain exactly four owner-local types")
    for event in outbox:
        if (event.get("publicContract") is not False
                or event.get("deliveryState") != "OWNER_OUTBOX_ONLY"
                or event.get("ownerSession") != "HRIS-HRM"
                or event.get("sliceId") != "BASE-TFR-HRM-008"):
            add(findings, "PROPOSAL_EVENT_PUBLIC", f"{event.get('eventType')} cannot be promoted beyond owner outbox")
    boundary = api.get("assignmentProposalBoundary", {})
    if (boundary.get("submitMutatesAssignmentLedger") is not False
            or boundary.get("publisherImplemented") is not False
            or boundary.get("isAssignmentChangedV1") is not False
            or boundary.get("forbiddenAlias") != "AssignmentChanged.v1"):
        add(findings, "PROPOSAL_ASSIGNMENT_ALIAS", "proposal intent must remain distinct from AssignmentChanged.v1")
    ports = api.get("inProcessContracts", [])
    if len(ports) != 1 or ports[0].get("contractId") != "WorkforceSnapshotQueryPort.v1":
        add(findings, "IN_PROCESS_PORT", "exact WorkforceSnapshotQueryPort.v1 entry required")
    elif (ports[0].get("transport") != "IN_PROCESS_JAVA_PORT"
          or ports[0].get("httpExposed") is not False
          or ports[0].get("providerOwnerSession") != "HRIS-HRM"
          or ports[0].get("providerSliceId") != "BASE-TFR-HRM-004"
          or ports[0].get("consumerOwnerSession") != "HRIS-PER"
          or ports[0].get("projection") != "PERFORMANCE_V1"
          or ports[0].get("implementationState") != "CODE_PRESENT_DEFAULT_OFF"
          or ports[0].get("productionState") != "NOT_AUTHORIZED_G6"):
        add(findings, "IN_PROCESS_PORT_BOUNDARY", "workforce snapshot port owner/transport boundary drift")
    expected_feature_gates = [
        {"property": "dwp.people.people360-runtime-enabled", "default": False, "scope": "PEOPLE360_HTTP"},
        {"property": "dwp.hris.performance.wave1.enabled", "default": False, "scope": "WORKFORCE_SNAPSHOT_IN_PROCESS"},
    ]
    if api.get("featureGates") != expected_feature_gates:
        add(findings, "API_FEATURE_GATES", "API successor feature gates must remain exact and default-off")
    authority = api.get("authorityBoundary", {})
    if (authority.get("closesOwnerGate") != "G2_HRM_PEOPLE_CONTRACT_DISPOSITION"
            or authority.get("moduleCodeGoGranted") is not False
            or authority.get("productionAuthorizationGranted") is not False
            or authority.get("g3CanonicalGenerationGranted") is not False):
        add(findings, "AUTHORITY_ESCALATION", "API successor cannot grant module code-go or production")


def validate_ownership(ownership: dict[str, Any], api: dict[str, Any], findings: list[Finding]) -> None:
    exact_keys(ownership, OWNERSHIP_NAME, findings)
    if (ownership.get("schema"), ownership.get("registerId"), ownership.get("status")) != (
        "dwp.hris.g2.g3-primary-ownership-disposition.v1",
        "G2-OWNER-CONTRACT-DISPOSITION-2026-10-07",
        "G2_DISPOSITION_COMPLETE_G3_GENERATION_BLOCKED",
    ):
        add(findings, "DOCUMENT_IDENTITY", "ownership disposition identity/status drift")
    owners = ownership.get("confirmedCurrentOwners", [])
    by_id = {item.get("ownershipId"): item for item in owners if isinstance(item, dict)}
    expected_ids = {
        "G2-OWNER-HRM-PEOPLE360-HTTP", "G2-OWNER-HRM-ASSIGNMENT-PROPOSAL-HTTP",
        "G2-OWNER-HRM-ASSIGNMENT-PROPOSAL-OUTBOX",
        "G2-OWNER-HRM-PER-WORKFORCE-SNAPSHOT-PORT",
        "G2-OWNER-PER-CYCLE-HTTP", "G2-OWNER-PER-POPULATION-PREVIEW-HTTP",
        "G2-OWNER-PER-COMMAND-RECEIPT-HTTP", "G2-OWNER-PER-CYCLE-OUTBOX",
    }
    if set(by_id) != expected_ids or len(owners) != 8:
        add(findings, "OWNERSHIP_CLOSED_SET", "confirmed owner disposition must contain exact eight groups")
    expected_owner_slice = {
        "G2-OWNER-HRM-PEOPLE360-HTTP": ("HRIS-HRM", "BASE-TFR-HRM-004"),
        "G2-OWNER-HRM-ASSIGNMENT-PROPOSAL-HTTP": ("HRIS-HRM", "BASE-TFR-HRM-008"),
        "G2-OWNER-HRM-ASSIGNMENT-PROPOSAL-OUTBOX": ("HRIS-HRM", "BASE-TFR-HRM-008"),
        "G2-OWNER-HRM-PER-WORKFORCE-SNAPSHOT-PORT": ("HRIS-HRM", "BASE-TFR-HRM-004"),
        "G2-OWNER-PER-CYCLE-HTTP": ("HRIS-PER", "BASE-TFR-PER-005"),
        "G2-OWNER-PER-POPULATION-PREVIEW-HTTP": ("HRIS-PER", "BASE-TFR-PER-006"),
        "G2-OWNER-PER-COMMAND-RECEIPT-HTTP": ("HRIS-PER", "BASE-TFR-PER-011"),
        "G2-OWNER-PER-CYCLE-OUTBOX": ("HRIS-PER", "BASE-TFR-PER-005"),
    }
    for oid, expected in expected_owner_slice.items():
        item = by_id.get(oid, {})
        if (item.get("semanticOwnerSession"), item.get("primarySliceId")) != expected:
            add(findings, "OWNERSHIP_SEPARATION", f"{oid} must be owned by {expected}")
        if item.get("g3Disposition") == "SEALED_G3_PRIMARY_OWNER":
            add(findings, "G3_STATUS_PREMATURE", f"{oid} cannot be sealed during G2")
    expected_row_semantics = {
        "G2-OWNER-HRM-PEOPLE360-HTTP": ("PUBLIC_PEP", "CODE_PRESENT_DEFAULT_OFF", "CARRY_CONFIRMED_OWNER_TO_G3_GENERATION"),
        "G2-OWNER-HRM-ASSIGNMENT-PROPOSAL-HTTP": ("PUBLIC_PEP", "IMPLEMENTED_CURRENT_PRESERVED", "CARRY_CONFIRMED_OWNER_TO_G3_GENERATION"),
        "G2-OWNER-HRM-ASSIGNMENT-PROPOSAL-OUTBOX": ("OWNER_LOCAL_OUTBOX_EVIDENCE_NOT_G3_ROW", "OWNER_OUTBOX_ONLY_NO_PUBLISHER", "CARRY_AS_TRANSITIONAL_OWNER_LOCAL_EVIDENCE_ONLY"),
        "G2-OWNER-HRM-PER-WORKFORCE-SNAPSHOT-PORT": ("XCON_PRODUCER", "CODE_PRESENT_DEFAULT_OFF_PER_ONLY_PROJECTION", "CARRY_CONFIRMED_PRODUCER_CONSUMER_TO_G3_GENERATION"),
        "G2-OWNER-PER-CYCLE-HTTP": ("PUBLIC_PEP", "CODE_PRESENT_DEFAULT_OFF", "CARRY_CONFIRMED_OWNER_TO_G3_GENERATION"),
        "G2-OWNER-PER-POPULATION-PREVIEW-HTTP": ("PUBLIC_PEP", "CODE_PRESENT_DEFAULT_OFF", "CARRY_CONFIRMED_OWNER_TO_G3_GENERATION"),
        "G2-OWNER-PER-COMMAND-RECEIPT-HTTP": ("PUBLIC_PEP", "CODE_PRESENT_DEFAULT_OFF", "CARRY_CONFIRMED_OWNER_TO_G3_GENERATION"),
        "G2-OWNER-PER-CYCLE-OUTBOX": ("BASE_EVENT", "OWNER_OUTBOX_ONLY_NO_PUBLISHER", "CARRY_AS_OWNER_OUTBOX_EVIDENCE_PENDING_CANONICAL_EVENT_INPUT"),
    }
    for oid, expected in expected_row_semantics.items():
        item = by_id.get(oid, {})
        actual = (item.get("contractKindCandidate"), item.get("implementationState"), item.get("g3Disposition"))
        if actual != expected:
            add(findings, "OWNERSHIP_ROW_SEMANTICS", f"{oid} kind/state/disposition drift")
    snapshot = by_id.get("G2-OWNER-HRM-PER-WORKFORCE-SNAPSHOT-PORT", {})
    if snapshot.get("consumerOwnerSession") != "HRIS-PER" or snapshot.get("consumerSliceId") != "BASE-TFR-PER-016":
        add(findings, "OWNERSHIP_SEPARATION", "workforce snapshot consumer must remain HRIS-PER/PER-016")
    proposal_outbox = by_id.get("G2-OWNER-HRM-ASSIGNMENT-PROPOSAL-OUTBOX", {})
    if set(proposal_outbox.get("contractRefs", [])) != EXPECTED_PROPOSAL_EVENTS or proposal_outbox.get("explicitlyNot") != "AssignmentChanged.v1" or proposal_outbox.get("publicEventAlias") is not None:
        add(findings, "PROPOSAL_ASSIGNMENT_ALIAS", "proposal outbox is not AssignmentChanged.v1")
    if proposal_outbox.get("contractKindCandidate") != "OWNER_LOCAL_OUTBOX_EVIDENCE_NOT_G3_ROW":
        add(findings, "PROPOSAL_EVENT_KIND", "proposal outbox cannot consume INTERNAL_SERVICE_PEP or final event categories")
    api_gateway = {f"{item.get('method')} {item.get('gatewayPath')}" for item in api.get("httpOperations", []) if isinstance(item, dict)}
    people_refs = set(by_id.get("G2-OWNER-HRM-PEOPLE360-HTTP", {}).get("contractRefs", []))
    assignment_refs = set(by_id.get("G2-OWNER-HRM-ASSIGNMENT-PROPOSAL-HTTP", {}).get("contractRefs", []))
    expected_people = {
        "GET /api/people/v1/workforce/people?projection=people360&asOf={date}",
        "GET /api/people/v1/workforce/people/{publicId}?projection=people360&asOf={date}",
        "GET /api/people/v1/hr/home?projection=people360&asOf={date}",
        "GET /api/people/v1/hr/team?projection=people360&personId={publicId}&asOf={date}",
    }
    expected_assignment = {ref for ref in api_gateway if "/assignment" in ref}
    if people_refs != expected_people:
        add(findings, "OWNERSHIP_API_BINDING", "People360 owner refs do not exactly cover People360 API operations")
    if assignment_refs != expected_assignment:
        add(findings, "OWNERSHIP_API_BINDING", "Assignment owner refs do not exactly cover assignment API operations")
    expected_cycle = {
        "GET /api/people/v1/hris/performance/cycles",
        "GET /api/people/v1/hris/performance/cycles/{cycleId}",
        "POST /api/people/v1/hris/performance/cycles",
        "PATCH /api/people/v1/hris/performance/cycles/{cycleId}",
        "POST /api/people/v1/hris/performance/cycles/{cycleId}/validate",
        "POST /api/people/v1/hris/performance/cycles/{cycleId}/publish",
    }
    expected_population = {"POST /api/people/v1/hris/performance/cycles/{cycleId}/population-previews"}
    expected_receipt = {"GET /api/people/v1/hris/performance/command-receipts/{receiptId}"}
    if set(by_id.get("G2-OWNER-PER-CYCLE-HTTP", {}).get("contractRefs", [])) != expected_cycle:
        add(findings, "PER_OWNERSHIP_API_BINDING", "PER cycle routes must map to BASE-TFR-PER-005")
    if set(by_id.get("G2-OWNER-PER-POPULATION-PREVIEW-HTTP", {}).get("contractRefs", [])) != expected_population:
        add(findings, "PER_OWNERSHIP_API_BINDING", "population preview must map to BASE-TFR-PER-006")
    if set(by_id.get("G2-OWNER-PER-COMMAND-RECEIPT-HTTP", {}).get("contractRefs", [])) != expected_receipt:
        add(findings, "PER_OWNERSHIP_API_BINDING", "command receipt must map to BASE-TFR-PER-011")
    actual_per = set().union(
        set(by_id.get("G2-OWNER-PER-CYCLE-HTTP", {}).get("contractRefs", [])),
        set(by_id.get("G2-OWNER-PER-POPULATION-PREVIEW-HTTP", {}).get("contractRefs", [])),
        set(by_id.get("G2-OWNER-PER-COMMAND-RECEIPT-HTTP", {}).get("contractRefs", [])),
    )
    if actual_per != {f"{method} {path}" for method, path in EXPECTED_PER_GATEWAY}:
        add(findings, "PER_OWNERSHIP_API_BINDING", "split PER owner refs must cover exact eight operations")
    performance_event = by_id.get("G2-OWNER-PER-CYCLE-OUTBOX", {})
    if performance_event.get("contractKindCandidate") != "BASE_EVENT":
        add(findings, "PER_EVENT_KIND", "PerformanceCyclePublished.v1 is a BASE_EVENT, not MODERN_EVENT")
    expected_separation = {
        "people360": {"ownerSession": "HRIS-HRM", "primarySliceId": "BASE-TFR-HRM-004"},
        "assignmentProposal": {"ownerSession": "HRIS-HRM", "primarySliceId": "BASE-TFR-HRM-008"},
        "performanceCycle": {"ownerSession": "HRIS-PER", "primarySliceId": "BASE-TFR-PER-005"},
        "performancePopulationPreview": {"ownerSession": "HRIS-PER", "primarySliceId": "BASE-TFR-PER-006"},
        "performanceCommandReceipt": {"ownerSession": "HRIS-PER", "primarySliceId": "BASE-TFR-PER-011"},
        "workforceSnapshot": {
            "producerOwnerSession": "HRIS-HRM",
            "producerSliceId": "BASE-TFR-HRM-004",
            "consumerOwnerSession": "HRIS-PER",
            "consumerSliceId": "BASE-TFR-PER-016",
        },
    }
    if ownership.get("ownershipSeparation") != expected_separation:
        add(findings, "OWNERSHIP_SEPARATION", "top-level People360/Assignment/PER separation drift")
    historical = ownership.get("historicalProfile", {})
    if historical.get("categories") != EXPECTED_HISTORICAL_PROFILE or historical.get("totalRows") != 525 or sum(EXPECTED_HISTORICAL_PROFILE.values()) != 525:
        add(findings, "HISTORICAL_OWNERSHIP_PROFILE", "historical ownership profile must be exact 525-row distribution")
    target = ownership.get("g3TargetProfile", {})
    if target.get("categories") != EXPECTED_G3_PROFILE or target.get("totalRows") != 695 or sum(EXPECTED_G3_PROFILE.values()) != 695:
        add(findings, "G3_OWNERSHIP_PROFILE", "G3 ownership profile must be exact 695-row distribution")
    if target.get("generationStage") != "G3_ONLY" or target.get("g2MayEmitFinalRows") is not False:
        add(findings, "G3_FINAL_REGISTER_STAGE", "final 695-row register is emitted only in G3")
    if target.get("statusReservedForGeneratedRows") != "SEALED_G3_PRIMARY_OWNER":
        add(findings, "G3_RESERVED_STATUS", "the G3-only reserved status must remain exact")
    if set(ownership.get("missingCanonicalInputs", [])) != EXPECTED_MODERN_INPUTS or len(ownership.get("missingCanonicalInputs", [])) != 4:
        add(findings, "G3_MISSING_INPUTS", "exact four canonical G3 inputs must remain open")
    expected_invariants = {
        "confirmedOwnerRowsAreNotFinalG3Rows": True,
        "proposalEventsAreNotAssignmentChangedV1": True,
        "people360DoesNotProducePersonChangedV1": True,
        "performanceContractsRemainPerOwned": True,
        "final695RowRegisterGeneratedOnlyAtG3": True,
        "historical525RowsNotFabricated": True,
    }
    if ownership.get("invariants") != expected_invariants:
        add(findings, "OWNERSHIP_INVARIANTS", "ownership invariants must be the exact six true assertions")
    boundary = ownership.get("authorityBoundary", {})
    if (boundary.get("doesNotCloseGate") != "G3_CANONICAL_GENERATION"
            or boundary.get("finalG3RegisterEmitted") is not False
            or boundary.get("moduleCodeGoGranted") is not False
            or boundary.get("productionAuthorizationGranted") is not False):
        add(findings, "G3_FINAL_REGISTER_STAGE", "G2 disposition cannot emit final ownership or grant code-go/production")


def validate_historical_evidence(bundle: Bundle, findings: list[Finding]) -> None:
    api = bundle.json_docs.get(API_NAME, {})
    seal = bundle.json_docs.get(SEAL_NAME, {})
    ownership = bundle.json_docs.get(OWNERSHIP_NAME, {})
    manifest = bundle.json_docs.get(MANIFEST_NAME, {})
    recovered_path = REPO_ROOT / "docs/06-delivery/hris/recovery/hris-porting-blueprint-2026-09-09/session-evidence/hrm/g2-readiness/api-event-contracts.v1.json"
    if not recovered_path.is_file():
        add(findings, "HISTORICAL_API_RECOVERY", "recovered API contract missing")
    else:
        raw = recovered_path.read_bytes()
        if (len(raw), digest(raw)) != HISTORICAL_API_RECOVERED:
            add(findings, "HISTORICAL_API_RECOVERY", "recovered API contract fingerprint drift")
    api_supersedes = api.get("supersedes", {})
    if (api_supersedes.get("historicalExpectedBytes"), api_supersedes.get("historicalExpectedSha256")) != HISTORICAL_API_EXPECTED:
        add(findings, "HISTORICAL_FINGERPRINT", "API historical expected fingerprint drift")
    if (api_supersedes.get("recoveredBytes"), api_supersedes.get("recoveredSha256")) != HISTORICAL_API_RECOVERED:
        add(findings, "HISTORICAL_FINGERPRINT", "API recovered fingerprint drift")
    predecessor = seal.get("historicalPredecessor", {})
    if (predecessor.get("historicalExpectedBytes"), predecessor.get("historicalExpectedSha256"), predecessor.get("historicalExpectedRows")) != HISTORICAL_COVERAGE:
        add(findings, "HISTORICAL_FINGERPRINT", "coverage historical fingerprint drift")
    old_owner = ownership.get("supersedesHistorical", {})
    if (old_owner.get("historicalExpectedBytes"), old_owner.get("historicalExpectedSha256"), old_owner.get("historicalExpectedRows")) != HISTORICAL_OWNERSHIP:
        add(findings, "HISTORICAL_FINGERPRINT", "ownership historical fingerprint drift")
    fingerprints = manifest.get("historicalFingerprints", {})
    expected_fingerprints = {
        "hrmApiEventContract": {
            "historicalExpectedSha256": HISTORICAL_API_EXPECTED[1],
            "historicalExpectedBytes": HISTORICAL_API_EXPECTED[0],
            "recoveredSha256": HISTORICAL_API_RECOVERED[1],
            "recoveredBytes": HISTORICAL_API_RECOVERED[0],
        },
        "hrmSourceCoverage": {
            "historicalExpectedSha256": HISTORICAL_COVERAGE[1],
            "historicalExpectedBytes": HISTORICAL_COVERAGE[0],
            "historicalExpectedRows": HISTORICAL_COVERAGE[2],
            "recoveryState": "MISSING_FROM_RECOVERY",
        },
        "g3PrimaryOwnershipRegister": {
            "historicalExpectedSha256": HISTORICAL_OWNERSHIP[1],
            "historicalExpectedBytes": HISTORICAL_OWNERSHIP[0],
            "historicalExpectedRows": HISTORICAL_OWNERSHIP[2],
            "recoveryState": "MISSING_FROM_RECOVERY",
        },
    }
    if fingerprints != expected_fingerprints:
        add(findings, "HISTORICAL_FINGERPRINT", "manifest historical fingerprint set drift")
    supplement_path = REPO_ROOT / "docs/06-delivery/hris/recovery/exact-supplements/2026-10-06/manifest.json"
    gaps_path = REPO_ROOT / "docs/06-delivery/hris/2026-10-06-recovery-gap-disposition.json"
    try:
        supplement = json.loads(supplement_path.read_text(encoding="utf-8"))
        known = {item["path"]: item for item in supplement["knownFingerprintsWithoutRecoverableBytes"]}
        coverage = known["session-registers/hris-hrm-source-coverage.csv"]
        owner = known["coding-readiness/g3-contract-primary-ownership-register.csv"]
        if (coverage["bytes"], coverage["sha256"], coverage["dataRows"]) != HISTORICAL_COVERAGE:
            add(findings, "RECOVERY_SOURCE_EVIDENCE", "supplement coverage fingerprint drift")
        if (owner["bytes"], owner["sha256"], owner["dataRows"]) != HISTORICAL_OWNERSHIP:
            add(findings, "RECOVERY_SOURCE_EVIDENCE", "supplement ownership fingerprint drift")
        gaps = json.loads(gaps_path.read_text(encoding="utf-8"))["successorRequired"]
        gates = {item["ownerGate"] for item in gaps if item.get("ownerGate") in EXPECTED_GATES}
        modern = {item["path"] for item in gaps if item.get("ownerGate") == "G3_CANONICAL_GENERATION"}
        if gates != EXPECTED_GATES:
            add(findings, "RECOVERY_OWNER_GATES", "G1 successor owner gates drift")
        if modern != EXPECTED_MODERN_INPUTS:
            add(findings, "RECOVERY_MODERN_INPUTS", "G1 exact four modern canonical gaps drift")
    except (OSError, KeyError, TypeError, json.JSONDecodeError) as exc:
        add(findings, "RECOVERY_SOURCE_EVIDENCE", str(exc))


def git(backend: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["git", *args], cwd=backend, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)


def collect_evidence_refs(bundle: Bundle) -> set[tuple[str, str]]:
    refs: set[tuple[str, str]] = set()
    def walk(value: Any) -> None:
        if isinstance(value, dict):
            for child in value.values():
                walk(child)
        elif isinstance(value, list):
            for child in value:
                walk(child)
        elif isinstance(value, str) and "@" in value:
            path, oid = value.rsplit("@", 1)
            if re.fullmatch(r"[0-9a-f]{40}", oid):
                refs.add((path, oid))
    walk(bundle.json_docs.get(API_NAME, {}))
    walk(bundle.json_docs.get(OWNERSHIP_NAME, {}))
    for row in bundle.coverage_rows:
        for value in row.get("current_source_blob_refs", "").split("|"):
            if "@" in value:
                path, oid = value.rsplit("@", 1)
                if re.fullmatch(r"[0-9a-f]{40}", oid):
                    refs.add((path, oid))
    return refs


def validate_backend(bundle: Bundle, backend: Path, findings: list[Finding]) -> None:
    if not (backend / ".git").exists() and git(backend, "rev-parse", "--git-dir").returncode != 0:
        add(findings, "BACKEND_REPOSITORY", f"not a Git repository: {backend}")
        return
    for commit in (CURRENT_COMMIT, RECONCILED_COMMIT, RESULT_COMMIT):
        if git(backend, "cat-file", "-e", f"{commit}^{{commit}}").returncode != 0:
            add(findings, "BACKEND_COMMIT", f"missing backend commit {commit}")
    parents = git(backend, "show", "-s", "--format=%P", RESULT_COMMIT)
    if parents.returncode != 0 or parents.stdout.strip().split() != [CURRENT_COMMIT, RECONCILED_COMMIT]:
        add(findings, "BACKEND_MERGE_PARENTS", "result commit parents must be current then reconciled")
    tree_proc = git(backend, "ls-tree", "-r", RESULT_COMMIT)
    tree: dict[str, str] = {}
    if tree_proc.returncode != 0:
        add(findings, "BACKEND_TREE", tree_proc.stderr.strip())
    else:
        for line in tree_proc.stdout.splitlines():
            metadata, path = line.split("\t", 1)
            tree[path] = metadata.split()[2]
    for path, expected_oid in sorted(collect_evidence_refs(bundle)):
        if safe_repo_path(path) is None:
            add(findings, "SOURCE_EVIDENCE_PATH", f"unsafe evidence path: {path}")
            continue
        if tree.get(path) != expected_oid:
            add(findings, "SOURCE_EVIDENCE_BLOB", f"{path}: expected {expected_oid}, result tree has {tree.get(path)}")
    runtime_pep = bundle.json_docs.get(API_NAME, {}).get("sourcePins", {}).get("runtimePepRegistry", {})
    if tree.get(runtime_pep.get("path")) != runtime_pep.get("blob"):
        add(findings, "PEP_V34_BLOB", "runtime PEP path/blob does not match the pinned result tree")
    required_text = {
        "dwp-people-server/src/main/java/com/dwp/services/people/workforce/People360Service.java": "dwp.people.people360-runtime-enabled:false",
        "dwp-people-server/src/main/java/com/dwp/services/people/hr/performance/PerformanceCycleController.java": "dwp.hris.performance.wave1.enabled",
        "dwp-people-server/src/main/java/com/dwp/services/people/hr/assignment/AssignmentProposalRepository.java": "people.assignment-proposal.",
        "dwp-people-server/src/main/java/com/dwp/services/people/hr/performance/PerformanceCycleCommandRepository.java": "PerformanceCyclePublished.v1",
        "dwp-people-server/src/main/java/com/dwp/services/people/hris/people/HrisWorkforceSnapshotProvider.java": "dwp.hris.performance.wave1.enabled",
    }
    for rel, needle in required_text.items():
        source = git(backend, "show", f"{RESULT_COMMIT}:{rel}")
        if source.returncode != 0 or needle not in source.stdout:
            add(findings, "BACKEND_SOURCE_FACT", f"{rel} at result commit missing {needle}")
    pep_rel = "dwp-people-server/src/main/resources/product-authorization/hcm-people-pep-v34.generated.json"
    try:
        pep_source = git(backend, "show", f"{RESULT_COMMIT}:{pep_rel}")
        if pep_source.returncode != 0:
            raise ValueError(pep_source.stderr.strip())
        pep = json.loads(pep_source.stdout)
        if pep.get("projectionKey") != "hcm-people-pep-v34" or pep.get("registryRef", {}).get("sha256") != "852d20e1e639e1a7170f02b5714d21d8c51a9eb8ff5ac32d8b7940b82d6be83b":
            add(findings, "PEP_V34", "runtime PEP v34 identity or registry fingerprint drift")
        service: set[tuple[str, str, str]] = set()
        gateway: set[tuple[str, str, str]] = set()
        required_access: set[tuple[str, str, str]] = set()
        for route in pep.get("routes", []):
            key = route.get("routeContractKey")
            for binding in route.get("servicePepBindings", []):
                service.add((key, binding.get("method"), binding.get("path")))
            for binding in route.get("gatewayApiBindings", []):
                gateway.add((key, binding.get("method"), binding.get("path")))
            for profile in route.get("accessProfiles", []):
                access = profile.get("requiredAccess", {})
                required_access.add((
                    key,
                    access.get("type"),
                    access.get("capabilityContractKey") or access.get("accessPolicyKey"),
                ))
        api = bundle.json_docs.get(API_NAME, {})
        for operation in api.get("httpOperations", []):
            triple = (operation.get("routeContractKey"), operation.get("method"), operation.get("servicePath"))
            gateway_triple = (operation.get("routeContractKey"), operation.get("method"), operation.get("gatewayPath"))
            if triple not in service or gateway_triple not in gateway:
                add(findings, "PEP_ROUTE_BINDING", f"v34 does not bind {operation.get('operationId')}")
            authorization = operation.get("authorizationContract", {})
            access_triple = (operation.get("routeContractKey"), authorization.get("kind"), authorization.get("key"))
            if access_triple not in required_access:
                add(findings, "PEP_AUTHORIZATION_BINDING", f"v34 does not bind authorization for {operation.get('operationId')}")
        gateway_pairs = {(method, path) for _, method, path in gateway}
        if not EXPECTED_PER_GATEWAY.issubset(gateway_pairs):
            add(findings, "PEP_PER_ROUTE_BINDING", "v34 is missing one or more eight Performance routes")
    except (ValueError, json.JSONDecodeError, TypeError) as exc:
        add(findings, "PEP_V34", str(exc))
    if any("dwp-people-server/src/main/resources/product-authorization/" in path and "v32" in PurePosixPath(path).name for path in tree):
        add(findings, "PEP_V32_PRESENT", "alternate HCM v32 projection must not be a runtime resource")
    try:
        openapi_source = git(backend, "show", f"{RESULT_COMMIT}:contracts/openapi/people.json")
        if openapi_source.returncode != 0:
            raise ValueError(openapi_source.stderr.strip())
        openapi = json.loads(openapi_source.stdout)
        paths = set(openapi.get("paths", {}))
        if any("assignment-proposals" in path or "/assignments/" in path for path in paths):
            add(findings, "OPENAPI_ASSIGNMENT_ASSUMPTION", "expected known OpenAPI assignment omission changed; reassess evidence")
        if "/v1/workforce/people" not in paths or "/v1/hris/performance/cycles" not in paths:
            add(findings, "OPENAPI_CURRENT_FACT", "People360/Performance OpenAPI current facts drift")
    except (ValueError, json.JSONDecodeError, TypeError) as exc:
        add(findings, "OPENAPI_CURRENT_FACT", str(exc))


def validate_pins(bundle: Bundle, allow_pending: bool, findings: list[Finding]) -> bool:
    placeholder_count = sum(raw.count(PENDING.encode("ascii")) for raw in bundle.raw.values())
    docs = [bundle.json_docs.get(name, {}) for name in (API_NAME, SEAL_NAME, OWNERSHIP_NAME, MANIFEST_NAME)]
    expected_common = {
        "currentBackendCommit": CURRENT_COMMIT,
        "reconciledBackendCommit": RECONCILED_COMMIT,
    }
    for name, doc in zip((API_NAME, SEAL_NAME, OWNERSHIP_NAME, MANIFEST_NAME), docs):
        pins = doc.get("sourcePins", {})
        for key, expected in expected_common.items():
            if pins.get(key) != expected:
                add(findings, "SOURCE_PIN", f"{name} {key} must be {expected}")
        if name in {API_NAME, OWNERSHIP_NAME, MANIFEST_NAME} and pins.get("backendResultParents") != [CURRENT_COMMIT, RECONCILED_COMMIT]:
            add(findings, "BACKEND_RESULT_PARENTS", f"{name} must pin ordered current/reconciled merge parents")
    owner_result = bundle.json_docs.get(OWNERSHIP_NAME, {}).get("sourcePins", {}).get("backendResultCommit")
    if placeholder_count:
        if not allow_pending:
            add(findings, "PENDING_BACKEND_RESULT", "pending backend result is forbidden in final mode")
        if placeholder_count != 1 or owner_result != PENDING:
            add(findings, "PENDING_BACKEND_RESULT_LOCATION", "placeholder is allowed exactly once at ownership#/sourcePins/backendResultCommit")
        for name in (API_NAME, SEAL_NAME, MANIFEST_NAME):
            if bundle.json_docs.get(name, {}).get("sourcePins", {}).get("backendResultCommit") == PENDING:
                add(findings, "PENDING_BACKEND_RESULT_LOCATION", f"placeholder cannot appear in {name}")
        return allow_pending and placeholder_count == 1 and owner_result == PENDING
    if allow_pending:
        # A finalized packet remains final even when the permissive flag is supplied.
        pass
    for name, doc in zip((API_NAME, SEAL_NAME, OWNERSHIP_NAME, MANIFEST_NAME), docs):
        if doc.get("sourcePins", {}).get("backendResultCommit") != RESULT_COMMIT:
            add(findings, "BACKEND_RESULT_PIN", f"{name} must pin {RESULT_COMMIT}")
    return False


def validate_authority_boundaries(bundle: Bundle, findings: list[Finding]) -> None:
    manifest = bundle.json_docs.get(MANIFEST_NAME, {})
    if (manifest.get("schema"), manifest.get("packetId"), manifest.get("status"), manifest.get("generatedDate")) != (
        "dwp.hris.g2.successor-authority-manifest.v1",
        "G2-HRIS-SUCCESSORS-2026-10-07",
        "SEALED_SOURCE_INTEGRATION_DISPOSITION",
        "2026-10-07",
    ):
        add(findings, "DOCUMENT_IDENTITY", "manifest identity/status/date drift")
    gates = manifest.get("ownerGates", {})
    expected_gate_values = {
        "G2_HRM_PEOPLE_CONTRACT_DISPOSITION": "CLOSED_BY_HRM_API_EVENT_SUCCESSOR",
        "G2_HRM_SOURCE_COVERAGE_SUCCESSOR": "CLOSED_BY_17_FAMILY_AGGREGATE_TRACE",
        "G2_OWNER_CONTRACT_DISPOSITION": "CLOSED_BY_G3_OWNERSHIP_DISPOSITION",
        "G3_CANONICAL_GENERATION": "OPEN_FOUR_CANONICAL_INPUTS_MISSING",
    }
    if gates != expected_gate_values:
        add(findings, "OWNER_GATE_SET", "manifest owner gate set drift")
    expected_validation = {
        "validator": "docs/06-delivery/hris/tools/validate_g2_successor_authorities.py",
        "command": "python3 docs/06-delivery/hris/tools/validate_g2_successor_authorities.py --compact",
        "selfTestCommand": "python3 docs/06-delivery/hris/tools/validate_g2_successor_authorities.py --self-test --compact",
        "manifestPinsArtifactCount": 4,
        "manifestSelfPinned": False,
    }
    if manifest.get("validation") != expected_validation:
        add(findings, "MANIFEST_VALIDATION_CONTRACT", "manifest validator commands/count/boundary drift")
    boundary = manifest.get("authorityBoundary", {})
    required_false = (
        "moduleParallelDevelopmentAuthorized", "moduleCodeGoGranted",
        "productionAuthorized", "g3FinalOwnershipRowsEmitted",
    )
    for field in required_false:
        if boundary.get(field) is not False:
            add(findings, "AUTHORITY_ESCALATION", f"manifest {field} must be false")
    if boundary.get("g3FinalOwnershipRowCount") != 695:
        add(findings, "G3_OWNERSHIP_PROFILE", "manifest must record future 695 row count")
    if boundary.get("manifestIsInventoryNotAuthority") is not True:
        add(findings, "MANIFEST_AUTHORITY", "manifest must identify itself as inventory, not authority")


def validate_bundle(bundle: Bundle, backend: Path, allow_pending: bool, check_external: bool) -> tuple[list[Finding], bool]:
    findings: list[Finding] = []
    for name in (API_NAME, SEAL_NAME, OWNERSHIP_NAME, MANIFEST_NAME):
        if name not in bundle.json_docs:
            add(findings, "DOCUMENT_MISSING", f"cannot validate missing/invalid {name}")
    if findings:
        return findings, False
    api = bundle.json_docs[API_NAME]
    ownership = bundle.json_docs[OWNERSHIP_NAME]
    validate_manifest(bundle, findings)
    validate_seal(bundle, findings)
    validate_api(api, findings)
    validate_coverage(bundle, api, findings)
    validate_ownership(ownership, api, findings)
    validate_historical_evidence(bundle, findings)
    draft = validate_pins(bundle, allow_pending, findings)
    validate_authority_boundaries(bundle, findings)
    if check_external:
        validate_backend(bundle, backend, findings)
    return findings, draft


def json_bytes(value: dict[str, Any]) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def clone_bundle(bundle: Bundle) -> Bundle:
    return Bundle(bundle.root, dict(bundle.raw), copy.deepcopy(bundle.json_docs), list(bundle.coverage_header), copy.deepcopy(bundle.coverage_rows))


def serialize_coverage(bundle: Bundle) -> None:
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=COVERAGE_HEADER, lineterminator="\n")
    writer.writeheader()
    writer.writerows(bundle.coverage_rows)
    bundle.raw[COVERAGE_NAME] = output.getvalue().encode("utf-8")


def reseal(bundle: Bundle, changed_json: set[str] | None = None, changed_csv: bool = False) -> None:
    for name in changed_json or set():
        bundle.raw[name] = json_bytes(bundle.json_docs[name])
    if changed_csv:
        serialize_coverage(bundle)
    csv_raw = bundle.raw[COVERAGE_NAME]
    seal = bundle.json_docs[SEAL_NAME]
    seal["artifact"]["sha256"] = digest(csv_raw)
    seal["artifact"]["bytes"] = len(csv_raw)
    seal["artifact"]["dataRows"] = len(bundle.coverage_rows)
    try:
        seal["artifact"]["sourceRowCount"] = sum(int(row["source_row_count"]) for row in bundle.coverage_rows)
    except (KeyError, ValueError):
        seal["artifact"]["sourceRowCount"] = -1
    bundle.raw[SEAL_NAME] = json_bytes(seal)
    manifest = bundle.json_docs[MANIFEST_NAME]
    for entry in manifest["artifacts"]:
        name = PurePosixPath(entry["path"]).name
        if name in bundle.raw:
            entry["sha256"] = digest(bundle.raw[name])
            entry["bytes"] = len(bundle.raw[name])
    bundle.raw[MANIFEST_NAME] = json_bytes(manifest)


def run_self_tests(bundle: Bundle, backend: Path) -> tuple[list[dict[str, Any]], list[Finding]]:
    results: list[dict[str, Any]] = []
    failures: list[Finding] = []

    def rejected(name: str, expected: str, mutate: Callable[[Bundle], tuple[set[str], bool]]) -> None:
        candidate = clone_bundle(bundle)
        changed_json, changed_csv = mutate(candidate)
        reseal(candidate, changed_json, changed_csv)
        findings, _ = validate_bundle(candidate, backend, allow_pending=False, check_external=False)
        codes = {finding.code for finding in findings}
        passed = expected in codes
        results.append({"name": name, "expectedErrorCode": expected, "observedErrorCodes": sorted(codes), "passed": passed})
        if not passed:
            add(failures, "SELF_TEST_FAILED", f"{name}: expected {expected}, got {sorted(codes)}")

    def mutate_missing_op(b: Bundle) -> tuple[set[str], bool]:
        b.json_docs[API_NAME]["historicalOperationDispositions"].pop()
        return {API_NAME}, False

    def mutate_missing_event(b: Bundle) -> tuple[set[str], bool]:
        b.json_docs[API_NAME]["historicalEventDispositions"].pop()
        return {API_NAME}, False

    def mutate_proposal_alias(b: Bundle) -> tuple[set[str], bool]:
        b.json_docs[API_NAME]["assignmentProposalBoundary"]["isAssignmentChangedV1"] = True
        return {API_NAME}, False

    def mutate_row_sum(b: Bundle) -> tuple[set[str], bool]:
        b.coverage_rows[0]["source_row_count"] = "33"
        return set(), True

    def mutate_family_hash(b: Bundle) -> tuple[set[str], bool]:
        b.coverage_rows[0]["source_family_sha256"] = "0" * 64
        b.json_docs[API_NAME]["coverageTargetBindings"][0]["sourceFamilySha256"] = "0" * 64
        return {API_NAME}, True

    def mutate_owner(b: Bundle) -> tuple[set[str], bool]:
        b.json_docs[OWNERSHIP_NAME]["confirmedCurrentOwners"][4]["semanticOwnerSession"] = "HRIS-HRM"
        return {OWNERSHIP_NAME}, False

    def mutate_missing_input(b: Bundle) -> tuple[set[str], bool]:
        b.json_docs[OWNERSHIP_NAME]["missingCanonicalInputs"].pop()
        return {OWNERSHIP_NAME}, False

    def mutate_695(b: Bundle) -> tuple[set[str], bool]:
        b.json_docs[OWNERSHIP_NAME]["g3TargetProfile"]["totalRows"] = 694
        return {OWNERSHIP_NAME}, False

    def mutate_g3_status(b: Bundle) -> tuple[set[str], bool]:
        b.json_docs[OWNERSHIP_NAME]["confirmedCurrentOwners"][0]["g3Disposition"] = "SEALED_G3_PRIMARY_OWNER"
        return {OWNERSHIP_NAME}, False

    def mutate_authority(b: Bundle) -> tuple[set[str], bool]:
        b.json_docs[MANIFEST_NAME]["authorityBoundary"]["productionAuthorized"] = True
        return {MANIFEST_NAME}, False

    def mutate_port_http(b: Bundle) -> tuple[set[str], bool]:
        b.json_docs[API_NAME]["inProcessContracts"][0]["httpExposed"] = True
        return {API_NAME}, False

    def mutate_unretire(b: Bundle) -> tuple[set[str], bool]:
        for row in b.coverage_rows:
            if row["resolution_id"] == "TFR-HRM-006":
                row["current_implementation_state"] = "NOT_STARTED_EXACT_FAMILY"
        return set(), True

    def mutate_proposal_kind(b: Bundle) -> tuple[set[str], bool]:
        b.json_docs[OWNERSHIP_NAME]["confirmedCurrentOwners"][2]["contractKindCandidate"] = "INTERNAL_SERVICE_PEP"
        return {OWNERSHIP_NAME}, False

    def mutate_per_event_kind(b: Bundle) -> tuple[set[str], bool]:
        b.json_docs[OWNERSHIP_NAME]["confirmedCurrentOwners"][7]["contractKindCandidate"] = "MODERN_EVENT"
        return {OWNERSHIP_NAME}, False

    def mutate_snapshot_consumer_slice(b: Bundle) -> tuple[set[str], bool]:
        b.json_docs[OWNERSHIP_NAME]["confirmedCurrentOwners"][3]["consumerSliceId"] = "BASE-TFR-PER-005"
        return {OWNERSHIP_NAME}, False

    def mutate_manifest_path(b: Bundle) -> tuple[set[str], bool]:
        b.json_docs[MANIFEST_NAME]["artifacts"][0]["path"] = f"elsewhere/{API_NAME}"
        return {MANIFEST_NAME}, False

    def mutate_manifest_role(b: Bundle) -> tuple[set[str], bool]:
        b.json_docs[MANIFEST_NAME]["artifacts"][0]["role"] = "BOGUS"
        return {MANIFEST_NAME}, False

    def mutate_merge_parents(b: Bundle) -> tuple[set[str], bool]:
        b.json_docs[API_NAME]["sourcePins"]["backendResultParents"].reverse()
        return {API_NAME}, False

    def mutate_historical_fingerprint(b: Bundle) -> tuple[set[str], bool]:
        b.json_docs[MANIFEST_NAME]["historicalFingerprints"]["hrmApiEventContract"]["historicalExpectedSha256"] = "0" * 64
        return {MANIFEST_NAME}, False

    def mutate_invariant(b: Bundle) -> tuple[set[str], bool]:
        b.json_docs[OWNERSHIP_NAME]["invariants"]["historical525RowsNotFabricated"] = False
        return {OWNERSHIP_NAME}, False

    def mutate_reserved_status(b: Bundle) -> tuple[set[str], bool]:
        b.json_docs[OWNERSHIP_NAME]["g3TargetProfile"]["statusReservedForGeneratedRows"] = "BOGUS"
        return {OWNERSHIP_NAME}, False

    def mutate_historical_event_disposition(b: Bundle) -> tuple[set[str], bool]:
        b.json_docs[API_NAME]["historicalEventDispositions"][0]["disposition"] = "BOGUS"
        return {API_NAME}, False

    def mutate_historical_operation_disposition(b: Bundle) -> tuple[set[str], bool]:
        b.json_docs[API_NAME]["historicalOperationDispositions"][0]["disposition"] = "BOGUS"
        return {API_NAME}, False

    def mutate_seal_path(b: Bundle) -> tuple[set[str], bool]:
        b.json_docs[SEAL_NAME]["artifact"]["path"] = f"elsewhere/{COVERAGE_NAME}"
        return {SEAL_NAME}, False

    def mutate_current_disposition(b: Bundle) -> tuple[set[str], bool]:
        b.coverage_rows[0]["current_owner_session"] = "NOBODY"
        return set(), True

    def mutate_document_identity(b: Bundle) -> tuple[set[str], bool]:
        b.json_docs[API_NAME]["schema"] = "dwp.hris.g2.bogus.v1"
        return {API_NAME}, False

    def mutate_api_boundary(b: Bundle) -> tuple[set[str], bool]:
        b.json_docs[API_NAME]["featureGates"][0]["default"] = True
        return {API_NAME}, False

    def mutate_owner_row_semantics(b: Bundle) -> tuple[set[str], bool]:
        b.json_docs[OWNERSHIP_NAME]["confirmedCurrentOwners"][0]["g3Disposition"] = "BOGUS"
        return {OWNERSHIP_NAME}, False

    def mutate_manifest_gate(b: Bundle) -> tuple[set[str], bool]:
        b.json_docs[MANIFEST_NAME]["ownerGates"]["G2_OWNER_CONTRACT_DISPOSITION"] = "OPEN"
        return {MANIFEST_NAME}, False

    def mutate_seal_source(b: Bundle) -> tuple[set[str], bool]:
        b.json_docs[SEAL_NAME]["authoritativeAggregateSource"]["sha256"] = "0" * 64
        return {SEAL_NAME}, False

    rejected("missing-historical-operation", "HISTORICAL_OPERATION_CLOSED_SET", mutate_missing_op)
    rejected("missing-historical-event", "HISTORICAL_EVENT_CLOSED_SET", mutate_missing_event)
    rejected("proposal-aliases-assignment-changed", "PROPOSAL_ASSIGNMENT_ALIAS", mutate_proposal_alias)
    rejected("coverage-source-row-sum-582", "COVERAGE_SOURCE_ROW_SUM", mutate_row_sum)
    rejected("coverage-family-hash-drift", "COVERAGE_FAMILY_DRIFT", mutate_family_hash)
    rejected("performance-owner-swapped-to-hrm", "OWNERSHIP_SEPARATION", mutate_owner)
    rejected("missing-modern-canonical-input", "G3_MISSING_INPUTS", mutate_missing_input)
    rejected("g3-final-row-count-drift", "G3_OWNERSHIP_PROFILE", mutate_695)
    rejected("premature-g3-owner-status", "G3_STATUS_PREMATURE", mutate_g3_status)
    rejected("production-authority-escalation", "AUTHORITY_ESCALATION", mutate_authority)
    rejected("in-process-port-exposed-as-http", "IN_PROCESS_PORT_BOUNDARY", mutate_port_http)
    rejected("retired-family-reopened", "COVERAGE_RETIRED_DRIFT", mutate_unretire)
    rejected("proposal-outbox-misclassified-as-internal-pep", "PROPOSAL_EVENT_KIND", mutate_proposal_kind)
    rejected("base-event-misclassified-as-modern-event", "PER_EVENT_KIND", mutate_per_event_kind)
    rejected("snapshot-consumer-misassigned-to-per-005", "OWNERSHIP_SEPARATION", mutate_snapshot_consumer_slice)
    rejected("manifest-path-relocated", "MANIFEST_PATH_ROLE", mutate_manifest_path)
    rejected("manifest-role-drift", "MANIFEST_PATH_ROLE", mutate_manifest_role)
    rejected("backend-merge-parents-reversed", "BACKEND_RESULT_PARENTS", mutate_merge_parents)
    rejected("manifest-historical-fingerprint-drift", "HISTORICAL_FINGERPRINT", mutate_historical_fingerprint)
    rejected("ownership-invariant-disabled", "OWNERSHIP_INVARIANTS", mutate_invariant)
    rejected("g3-reserved-status-drift", "G3_RESERVED_STATUS", mutate_reserved_status)
    rejected("historical-event-disposition-drift", "HISTORICAL_EVENT_DISPOSITION", mutate_historical_event_disposition)
    rejected("historical-operation-disposition-drift", "HISTORICAL_OPERATION_DISPOSITION", mutate_historical_operation_disposition)
    rejected("coverage-seal-path-relocated", "COVERAGE_SEAL_TARGET", mutate_seal_path)
    rejected("coverage-current-owner-drift", "COVERAGE_CURRENT_DISPOSITION", mutate_current_disposition)
    rejected("document-identity-drift", "DOCUMENT_IDENTITY", mutate_document_identity)
    rejected("api-feature-gate-enabled", "API_FEATURE_GATES", mutate_api_boundary)
    rejected("ownership-row-disposition-drift", "OWNERSHIP_ROW_SEMANTICS", mutate_owner_row_semantics)
    rejected("manifest-owner-gate-reopened", "OWNER_GATE_SET", mutate_manifest_gate)
    rejected("coverage-authoritative-source-drift", "COVERAGE_AUTHORITATIVE_SOURCE", mutate_seal_source)
    return results, failures


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle-root", type=Path, default=DEFAULT_BUNDLE_ROOT)
    parser.add_argument("--backend", type=Path, default=Path(os.environ.get("DWP_G2_BACKEND_WORKTREE", DEFAULT_BACKEND)))
    parser.add_argument("--allow-pending-backend-result", action="store_true", help="validate a draft whose ownership result pin is the exact pending placeholder")
    parser.add_argument("--self-test", action="store_true", help="run coherent in-memory hostile mutations after the real packet passes")
    parser.add_argument("--compact", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.self_test and args.allow_pending_backend_result:
        output = {
            "schema": "dwp.hris.g2.successor-validator-result.v1",
            "status": "FAIL",
            "mode": "INVALID_ARGUMENTS",
            "finalAuthorityValid": False,
            "errors": [{"code": "ARGUMENT_CONFLICT", "message": "--self-test cannot be combined with --allow-pending-backend-result"}],
        }
        print(json.dumps(output, ensure_ascii=False, separators=(",", ":") if args.compact else None, indent=None if args.compact else 2))
        return 2
    bundle, load_findings = load_bundle(args.bundle_root.resolve())
    findings = list(load_findings)
    draft = False
    self_tests: list[dict[str, Any]] = []
    if bundle is not None:
        semantic, draft = validate_bundle(bundle, args.backend.resolve(), args.allow_pending_backend_result, check_external=True)
        findings.extend(semantic)
        if not findings and args.self_test:
            self_tests, self_failures = run_self_tests(bundle, args.backend.resolve())
            findings.extend(self_failures)
    if findings:
        status = "FAIL"
        mode = "FINAL" if not args.allow_pending_backend_result else "DRAFT"
        valid = False
    elif draft:
        status = "DRAFT_VALID"
        mode = "DRAFT"
        valid = False
    else:
        status = "PASS"
        mode = "FINAL"
        valid = True
    output = {
        "schema": "dwp.hris.g2.successor-validator-result.v1",
        "status": status,
        "mode": mode,
        "finalAuthorityValid": valid,
        "bundleRoot": str(args.bundle_root.resolve()),
        "backend": str(args.backend.resolve()),
        "checks": {
            "exactFiles": 5,
            "manifestPinnedArtifacts": 4,
            "historicalOperations": 18,
            "historicalEvents": 12,
            "coverageFamilies": 17,
            "representedSourceRows": 583,
            "g3FutureRows": 695,
        },
        "selfTests": self_tests,
        "errors": [{"code": finding.code, "message": finding.message} for finding in findings],
    }
    print(json.dumps(output, ensure_ascii=False, separators=(",", ":") if args.compact else None, indent=None if args.compact else 2))
    return 0 if status in {"PASS", "DRAFT_VALID"} else 1


if __name__ == "__main__":
    sys.exit(main())
