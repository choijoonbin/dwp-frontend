#!/usr/bin/env python3
"""Validate the HRIS G3 canonical-generation receipt from pinned evidence.

This validator is intentionally read-only.  It does not run Gradle, Yarn,
Docker, W1, live services, or repository-wide gates.  It verifies the sealed
G1/G2 predecessors, the committed G3 backend blobs, the reviewed Assignment
OpenAPI closure, and the forward-only G3 canonical/ownership successor.  The
successor tool checks are recorded evidence; this exit validator does not
re-run them after the independent final audit sealed their outputs.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import subprocess
import sys
from collections import Counter
from pathlib import Path
from typing import Any, Callable


SCRIPT = Path(__file__).resolve()
FRONTEND_ROOT = SCRIPT.parents[4]
HRIS_DOCS = Path("docs/06-delivery/hris")
DEFAULT_RECEIPT = HRIS_DOCS / "2026-10-07-g3-canonical-contract-generation-receipt.json"
DEFAULT_BACKEND = (
    FRONTEND_ROOT.parent
    / ".codex-worktrees/hris/g1-integration-20261006/backend"
)

EXPECTED_RECEIPT_SHA256 = "5b85824a2a6443af1f6fe5163d2e2ea1ab3ce8c4ab51a8c4a4eb572710ad092a"
EXPECTED_RECEIPT_BYTES = 25345
EXPECTED_FRONTEND_PARENT = "ea163b81f1a159532f6eec13ccdc52edce36c1f6"
EXPECTED_G2_BACKEND = "ea630a5f2dec9b1f044f11dd5eb66ffb6f87941a"
EXPECTED_G3_BACKEND = "f0a971eada612e6a267ece104707f0cab4191343"
EXPECTED_BACKEND_BRANCH = "codex/hris-g1-integration-backend-20261006"
EXPECTED_BACKEND_UPSTREAM = f"origin/{EXPECTED_BACKEND_BRANCH}"
EXPECTED_STATUS = "PASS_WITH_KNOWN_G5_BLOCKERS"
EXPECTED_DECISION = "G4_FRONTEND_SEMANTIC_INTEGRATION_AUTHORIZED"
EXPECTED_V34_CHECKSUM = "852d20e1e639e1a7170f02b5714d21d8c51a9eb8ff5ac32d8b7940b82d6be83b"
EXPECTED_V34_COUNTS = {
    "capabilities": 223,
    "accessPolicies": 24,
    "entitlementExpressions": 17,
    "predicatePolicies": 54,
    "routes": 952,
}
EXPECTED_OPENAPI_COUNTS = {
    "people": {"paths": 84, "operations": 91, "schemas": 173},
    "gateway-public": {"paths": 1665, "operations": 1905, "schemas": 3591},
}
EXPECTED_SERVICE_SNAPSHOTS = {
    "auth", "platform", "people", "provider", "approval", "space",
    "messaging", "notification", "meeting", "time", "payroll", "agent-public",
}
EXPECTED_OWNERSHIP_PROFILE = {
    "PUBLIC_PEP": 175,
    "INTERNAL_SERVICE_PEP": 11,
    "XCON_PRODUCER": 21,
    "SYS_G2_CONTRACT": 84,
    "BASE_EVENT": 48,
    "MODERN_OPERATION": 199,
    "MODERN_EVENT": 157,
}
EXPECTED_BACKEND_CHANGE_PATHS = {
    "contracts/openapi/gateway-public.json",
    "contracts/openapi/hris-wave1-design-time.json",
    "contracts/openapi/people.json",
    "dwp-people-server/src/main/java/com/dwp/services/people/hr/assignment/AssignmentProposalController.java",
    "dwp-people-server/src/main/java/com/dwp/services/people/hr/assignment/AssignmentProposalDtos.java",
    "dwp-people-server/src/test/java/com/dwp/services/people/hr/assignment/AssignmentProposalOpenApiSliceTest.java",
    "dwp-people-server/src/test/java/com/dwp/services/people/security/HcmWorkspaceOpenApiContractTest.java",
    "scripts/export-openapi-contracts.py",
    "scripts/tests/test_export_openapi_contracts.py",
}
EXPECTED_ASSIGNMENT_OPERATIONS = {
    ("get", "/v1/workforce/assignments/{assignmentId}"): "getAssignment",
    ("get", "/v1/workforce/assignments/{assignmentId}/timeline"): "getAssignmentTimeline",
    ("get", "/v1/workforce/assignment-proposals/{proposalId}"): "getAssignmentProposal",
    ("post", "/v1/workforce/assignment-proposals"): "createAssignmentProposal",
    ("post", "/v1/workforce/assignment-proposals/{proposalId}/validate"): "validateAssignmentProposal",
    ("post", "/v1/workforce/assignment-proposals/{proposalId}/submit"): "submitAssignmentProposal",
    ("post", "/v1/workforce/assignment-proposals/{proposalId}/cancel"): "cancelAssignmentProposal",
}
EXPECTED_REQUEST_SCHEMAS = {
    "/v1/workforce/assignment-proposals": "AssignmentProposalCreateRequest",
    "/v1/workforce/assignment-proposals/{proposalId}/validate": "AssignmentProposalVersionCommand",
    "/v1/workforce/assignment-proposals/{proposalId}/submit": "AssignmentProposalVersionCommand",
    "/v1/workforce/assignment-proposals/{proposalId}/cancel": "AssignmentProposalCancelCommand",
}
EXPECTED_RESPONSE_SCHEMAS = {
    "/v1/workforce/assignments/{assignmentId}": "ApiResponseAssignmentProposalAssignmentDetail",
    "/v1/workforce/assignments/{assignmentId}/timeline": "ApiResponseListAssignmentProposalTimelineEntry",
    "/v1/workforce/assignment-proposals/{proposalId}": "ApiResponseAssignmentProposal",
    "/v1/workforce/assignment-proposals": "ApiResponseAssignmentProposalCommandResult",
    "/v1/workforce/assignment-proposals/{proposalId}/validate": "ApiResponseAssignmentProposalCommandResult",
    "/v1/workforce/assignment-proposals/{proposalId}/submit": "ApiResponseAssignmentProposalCommandResult",
    "/v1/workforce/assignment-proposals/{proposalId}/cancel": "ApiResponseAssignmentProposalCommandResult",
}
HTTP_METHODS = {"get", "put", "post", "delete", "options", "head", "patch", "trace"}


class Validation:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.checks: dict[str, dict[str, Any]] = {}

    def require(self, condition: bool, message: str) -> None:
        if not condition:
            self.errors.append(message)

    def equal(self, actual: Any, expected: Any, message: str) -> None:
        self.require(actual == expected, f"{message}: {actual!r} != {expected!r}")

    def section(self, name: str, operation: Callable[[], dict[str, Any] | None]) -> None:
        before = len(self.errors)
        details: dict[str, Any] = {}
        try:
            details = operation() or {}
        except Exception as exc:  # collect independent failures in one invocation
            self.errors.append(f"{name}: {type(exc).__name__}: {exc}")
        self.checks[name] = {
            "status": "PASS" if len(self.errors) == before else "FAIL",
            **details,
        }


def sha256(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def load_json_bytes(raw: bytes, label: str) -> dict[str, Any]:
    value = json.loads(raw.decode("utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"{label} root must be an object")
    return value


def load_json(path: Path) -> dict[str, Any]:
    return load_json_bytes(path.read_bytes(), str(path))


def run(command: list[str], *, cwd: Path, check: bool = True) -> subprocess.CompletedProcess[bytes]:
    return subprocess.run(
        command,
        cwd=cwd,
        check=check,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def git(repo: Path, *args: str, check: bool = True) -> bytes:
    return run(["git", *args], cwd=repo, check=check).stdout


def git_text(repo: Path, *args: str, check: bool = True) -> str:
    return git(repo, *args, check=check).decode("utf-8").strip()


def git_blob(repo: Path, commit: str, path: str) -> bytes:
    return git(repo, "show", f"{commit}:{path}")


def verify_record(v: Validation, raw: bytes, record: dict[str, Any], label: str) -> None:
    v.equal(len(raw), record.get("bytes"), f"{label} bytes")
    v.equal(sha256(raw), record.get("sha256"), f"{label} SHA-256")


def canonical_seal(document: dict[str, Any]) -> str:
    payload = dict(document)
    payload.pop("sealedPayloadSha256", None)
    raw = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return sha256(raw)


def operation_count(document: dict[str, Any]) -> int:
    return sum(
        1
        for path_item in document.get("paths", {}).values()
        if isinstance(path_item, dict)
        for method, operation in path_item.items()
        if method in HTTP_METHODS and isinstance(operation, dict)
    )


def ref_name(schema: Any) -> str | None:
    if not isinstance(schema, dict):
        return None
    reference = schema.get("$ref")
    prefix = "#/components/schemas/"
    if not isinstance(reference, str) or not reference.startswith(prefix):
        return None
    return reference.removeprefix(prefix)


def headers(operation: dict[str, Any]) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for parameter in operation.get("parameters", []):
        if isinstance(parameter, dict) and parameter.get("in") == "header":
            name = parameter.get("name")
            if isinstance(name, str):
                result[name] = parameter
    return result


def check_receipt(v: Validation, receipt_path: Path, receipt: dict[str, Any]) -> dict[str, Any]:
    raw = receipt_path.read_bytes()
    v.equal(len(raw), EXPECTED_RECEIPT_BYTES, "receipt bytes")
    v.equal(sha256(raw), EXPECTED_RECEIPT_SHA256, "receipt SHA-256")
    v.equal(receipt.get("schema"), "dwp.hris.g3-canonical-contract-generation-receipt.v1", "receipt schema")
    v.equal(receipt.get("status"), EXPECTED_STATUS, "receipt status")
    v.equal(receipt.get("decision"), EXPECTED_DECISION, "receipt decision")
    pins = receipt.get("sourcePins", {})
    v.equal(pins.get("frontendControlPlaneParent"), EXPECTED_FRONTEND_PARENT, "frontend parent")
    v.equal(pins.get("g2BackendResult"), EXPECTED_G2_BACKEND, "G2 backend pin")
    v.equal(pins.get("g3BackendResult"), EXPECTED_G3_BACKEND, "G3 backend pin")
    v.require(
        run(
            ["git", "merge-base", "--is-ancestor", EXPECTED_FRONTEND_PARENT, "HEAD"],
            cwd=FRONTEND_ROOT,
            check=False,
        ).returncode == 0,
        "frontend control-plane parent is not an ancestor of current HEAD",
    )

    exclusions = receipt.get("exclusions", [])
    v.require(isinstance(exclusions, list) and len(exclusions) >= 7, "receipt exclusions are incomplete")
    exclusions_text = "\n".join(str(item) for item in exclusions)
    for token in ("historical", "Frontend", "runtime truth", "G5", "G6", "module-parallel"):
        v.require(token in exclusions_text, f"receipt exclusion missing {token!r}")

    authority = receipt.get("authority", {})
    v.equal(authority.get("g3CanonicalGenerationComplete"), True, "G3 completion authority")
    v.equal(authority.get("g4FrontendSemanticIntegrationAuthorized"), True, "G4 authority")
    v.equal(authority.get("g5HeadFreezeAuthorized"), False, "G5 head-freeze authority")
    v.equal(authority.get("moduleParallelDevelopmentAuthorized"), False, "module authority")
    v.equal(authority.get("customerActivationAuthorized"), False, "customer activation")
    v.equal(authority.get("productionReleaseAuthorized"), False, "production release")
    next_gate = receipt.get("nextGate", {})
    v.equal(next_gate.get("id"), "G4_FRONTEND_SEMANTIC_INTEGRATION", "next gate")
    v.equal(next_gate.get("status"), "AUTHORIZED_NOT_STARTED", "next gate status")
    v.equal(next_gate.get("w1Gate"), "G6_NOT_RUN", "W1 gate")
    v.equal(next_gate.get("moduleDelegationGate"), "G7_NOT_AUTHORIZED", "delegation gate")
    v.equal(receipt.get("g6W1Successor", {}).get("status"), "NOT_RUN", "G6 W1 state")
    return {"receiptBytes": len(raw), "receiptSha256": sha256(raw)}


def check_sealed_predecessors(v: Validation, receipt: dict[str, Any]) -> dict[str, Any]:
    records = receipt.get("controlPlaneArtifactDigests", [])
    v.require(isinstance(records, list) and len(records) == 7, "control-plane digest set must have seven entries")
    seen: set[str] = set()
    for record in records:
        path = record.get("path")
        v.require(isinstance(path, str) and path not in seen, f"duplicate or invalid control path: {path!r}")
        if not isinstance(path, str):
            continue
        seen.add(path)
        target = FRONTEND_ROOT / path
        v.require(target.is_file(), f"control-plane artifact missing: {path}")
        if target.is_file():
            verify_record(v, target.read_bytes(), record, path)
    expected = {
        "docs/06-delivery/hris/2026-10-06-g1-integration-lock-receipt.json",
        "docs/06-delivery/hris/2026-10-06-g1-migration-admission-and-lease.json",
        "docs/06-delivery/hris/2026-10-06-integration-roadmap.md",
        "docs/06-delivery/hris/2026-10-07-g2-backend-semantic-integration-receipt.json",
        "docs/06-delivery/hris/2026-10-07-integration-roadmap-status.md",
        "docs/06-delivery/hris/g2-successors/2026-10-07/manifest.v1.json",
        "docs/06-delivery/hris/2026-10-07-g3-integration-roadmap-status.md",
    }
    v.equal(seen, expected, "control-plane artifact path set")
    return {"verifiedArtifacts": len(seen)}


def check_backend_commit(v: Validation, backend: Path, receipt: dict[str, Any]) -> dict[str, Any]:
    v.require(backend.is_dir(), f"backend root missing: {backend}")
    integration = receipt.get("backendIntegration", {})
    v.equal(integration.get("branch"), EXPECTED_BACKEND_BRANCH, "backend branch receipt")
    v.equal(integration.get("upstream"), EXPECTED_BACKEND_UPSTREAM, "backend upstream receipt")
    v.equal(integration.get("parentCommit"), EXPECTED_G2_BACKEND, "backend parent receipt")
    v.equal(integration.get("resultCommit"), EXPECTED_G3_BACKEND, "backend result receipt")

    head = git_text(backend, "rev-parse", "HEAD")
    branch = git_text(backend, "branch", "--show-current")
    upstream = git_text(backend, "rev-parse", "@{upstream}")
    status = git_text(backend, "status", "--porcelain")
    parents = git_text(backend, "rev-list", "--parents", "-n", "1", EXPECTED_G3_BACKEND).split()
    v.equal(head, EXPECTED_G3_BACKEND, "backend HEAD")
    v.equal(branch, EXPECTED_BACKEND_BRANCH, "backend branch")
    v.equal(upstream, EXPECTED_G3_BACKEND, "backend upstream HEAD")
    v.equal(status, "", "backend worktree clean")
    v.equal(parents, [EXPECTED_G3_BACKEND, EXPECTED_G2_BACKEND], "backend commit ancestry")

    changed = set(
        git_text(
            backend,
            "diff-tree", "--no-commit-id", "--name-only", "-r", EXPECTED_G3_BACKEND,
        ).splitlines()
    )
    v.equal(changed, EXPECTED_BACKEND_CHANGE_PATHS, "G3 backend commit path set")
    return {"head": head, "changedPaths": len(changed), "clean": not status}


def backend_record_map(section: Any) -> dict[str, dict[str, Any]]:
    if not isinstance(section, list):
        return {}
    return {
        record["path"]: record
        for record in section
        if isinstance(record, dict) and isinstance(record.get("path"), str)
    }


def check_authorization_and_fixtures(
    v: Validation, backend: Path, receipt: dict[str, Any]
) -> dict[str, Any]:
    authorization = receipt.get("authorizationDecision", {})
    v.equal(authorization.get("decision"), "KEEP_V34_EMPTY_SEMANTIC_DIFF", "authorization decision")
    v.equal(authorization.get("semanticDiffCount"), 0, "authorization semantic diff")
    v.equal(authorization.get("v34SemanticChecksum"), EXPECTED_V34_CHECKSUM, "v34 checksum receipt")
    v.equal(authorization.get("v34Counts"), EXPECTED_V34_COUNTS, "v34 count receipt")
    v.equal(authorization.get("v35Issued"), False, "v35 issuance")
    v.equal(authorization.get("v243Issued"), False, "V243 issuance")
    v.equal(authorization.get("v35ArtifactCount"), 0, "v35 artifact count")
    v.equal(authorization.get("v243ArtifactCount"), 0, "V243 artifact count")
    v.equal(
        authorization.get("v35ActivationCasRollbackGate", {}).get("status"),
        "NOT_APPLICABLE_KEEP_V34_EMPTY_DIFF",
        "conditional CAS gate",
    )

    records = backend_record_map(authorization.get("preservedArtifacts"))
    for singleton in (authorization.get("canonicalSource"), authorization.get("generator")):
        if isinstance(singleton, dict) and isinstance(singleton.get("path"), str):
            records[singleton["path"]] = singleton
    expected_paths = {
        "contracts/product-authorization/product-surfaces-v1.yaml",
        "scripts/generate-product-authorization-contracts.py",
        "contracts/product-authorization/product-surfaces-v1.bundle-v34.json",
        "dwp-auth-server/src/main/resources/product-authorization/product-surfaces-v1.bundle-v34.generated.json",
        "contracts/product-authorization/product-surfaces-v1.index.json",
        "dwp-auth-server/src/main/resources/product-authorization/product-surfaces-v1.index.generated.json",
        "dwp-people-server/src/main/resources/product-authorization/hcm-people-pep-v34.generated.json",
        "contracts/product-authorization/product-surface-rollout-inventory.v1.generated.json",
        "dwp-gateway/src/main/resources/product-authorization/product-surface-rollout-inventory.v1.generated.json",
    }
    v.equal(set(records), expected_paths, "authorization artifact set")
    blobs: dict[str, bytes] = {}
    for path, record in records.items():
        raw = git_blob(backend, EXPECTED_G3_BACKEND, path)
        blobs[path] = raw
        verify_record(v, raw, record, path)

    bundle = load_json_bytes(
        blobs["contracts/product-authorization/product-surfaces-v1.bundle-v34.json"],
        "v34 bundle",
    )
    v.equal(bundle.get("version"), 34, "authorization version")
    v.equal(bundle.get("checksum"), EXPECTED_V34_CHECKSUM, "bundle checksum")
    for field, count in EXPECTED_V34_COUNTS.items():
        value = bundle.get(field)
        v.require(isinstance(value, list), f"v34 {field} is not an array")
        if isinstance(value, list):
            v.equal(len(value), count, f"v34 {field} count")
    v.equal(
        blobs["contracts/product-authorization/product-surfaces-v1.bundle-v34.json"],
        blobs["dwp-auth-server/src/main/resources/product-authorization/product-surfaces-v1.bundle-v34.generated.json"],
        "contract and Auth v34 bytes",
    )
    v.equal(
        blobs["contracts/product-authorization/product-surfaces-v1.index.json"],
        blobs["dwp-auth-server/src/main/resources/product-authorization/product-surfaces-v1.index.generated.json"],
        "contract and Auth index bytes",
    )
    v.equal(
        blobs["contracts/product-authorization/product-surface-rollout-inventory.v1.generated.json"],
        blobs["dwp-gateway/src/main/resources/product-authorization/product-surface-rollout-inventory.v1.generated.json"],
        "contract and Gateway rollout inventory bytes",
    )

    tree_paths = git_text(backend, "ls-tree", "-r", "--name-only", EXPECTED_G3_BACKEND).splitlines()
    forbidden = [
        path for path in tree_paths
        if (
            "product-surfaces-v1.bundle-v35" in path
            or "hcm-people-pep-v35" in path
            or Path(path).name.startswith("V243__")
        )
    ]
    v.equal(forbidden, [], "v35/V243 artifact absence")

    fixture = receipt.get("fixtureDecision", {})
    v.equal(fixture.get("status"), "CHECKED_IDENTICAL_NO_REISSUE", "fixture decision")
    fixture_records = backend_record_map(fixture.get("artifacts"))
    generator = fixture.get("generator")
    if isinstance(generator, dict) and isinstance(generator.get("path"), str):
        fixture_records[generator["path"]] = generator
    expected_fixture_paths = {
        "scripts/generate-product-authorization-fixtures.py",
        "contracts/product-authorization/pilot-fixtures.v1.generated.json",
        "contracts/product-authorization/pilot-test-registry-overrides.v1.generated.json",
    }
    v.equal(set(fixture_records), expected_fixture_paths, "fixture artifact set")
    for path, record in fixture_records.items():
        verify_record(v, git_blob(backend, EXPECTED_G3_BACKEND, path), record, path)
    return {
        "authorizationVersion": bundle.get("version"),
        "routes": len(bundle.get("routes", [])),
        "v35Artifacts": len(forbidden),
        "fixtureStatus": fixture.get("status"),
    }


def assert_ref_resolves(
    v: Validation,
    document: dict[str, Any],
    schema: Any,
    expected: str,
    label: str,
) -> None:
    name = ref_name(schema)
    v.equal(name, expected, f"{label} schema reference")
    schemas = document.get("components", {}).get("schemas", {})
    v.require(isinstance(schemas, dict) and name in schemas, f"{label} component does not resolve: {name}")


def assert_required_string_header(
    v: Validation,
    operation: dict[str, Any],
    name: str,
    *,
    max_length: int | None,
    label: str,
) -> None:
    parameter = headers(operation).get(name)
    v.require(isinstance(parameter, dict), f"{label} missing header {name}")
    if not isinstance(parameter, dict):
        return
    v.equal(parameter.get("required"), True, f"{label} {name} required")
    schema = parameter.get("schema", {})
    v.equal(schema.get("type"), "string", f"{label} {name} type")
    v.equal(schema.get("minLength"), 1, f"{label} {name} minLength")
    if max_length is not None:
        v.equal(schema.get("maxLength"), max_length, f"{label} {name} maxLength")


def check_openapi(v: Validation, backend: Path, receipt: dict[str, Any]) -> dict[str, Any]:
    section = receipt.get("openApiGeneration", {})
    v.equal(section.get("status"), "PASS_REVIEWED_RUNTIME_ON_FALLBACK", "OpenAPI status")
    v.equal(section.get("serviceCount"), 12, "OpenAPI service count")
    v.equal(section.get("liveRuntimeTruth"), False, "OpenAPI runtime truth boundary")
    records = backend_record_map(section.get("artifacts"))
    generator = section.get("generator")
    if isinstance(generator, dict) and isinstance(generator.get("path"), str):
        records[generator["path"]] = generator
    expected_paths = {
        "scripts/export-openapi-contracts.py",
        "contracts/openapi/hris-wave1-design-time.json",
        "contracts/openapi/people.json",
        "contracts/openapi/gateway-public.json",
    }
    v.equal(set(records), expected_paths, "OpenAPI artifact set")
    blobs: dict[str, bytes] = {}
    for path, record in records.items():
        raw = git_blob(backend, EXPECTED_G3_BACKEND, path)
        blobs[path] = raw
        verify_record(v, raw, record, path)

    overlay = load_json_bytes(blobs["contracts/openapi/hris-wave1-design-time.json"], "overlay")
    people = load_json_bytes(blobs["contracts/openapi/people.json"], "people OpenAPI")
    gateway = load_json_bytes(blobs["contracts/openapi/gateway-public.json"], "gateway OpenAPI")
    for name, document in (("people", people), ("gateway-public", gateway)):
        expected = EXPECTED_OPENAPI_COUNTS[name]
        v.equal(len(document.get("paths", {})), expected["paths"], f"{name} path count")
        v.equal(operation_count(document), expected["operations"], f"{name} operation count")
        schemas = document.get("components", {}).get("schemas", {})
        v.equal(len(schemas), expected["schemas"], f"{name} schema count")

    tree_paths = set(git_text(backend, "ls-tree", "-r", "--name-only", EXPECTED_G3_BACKEND).splitlines())
    snapshots = {
        f"{service}.json"
        for service in EXPECTED_SERVICE_SNAPSHOTS
        if f"contracts/openapi/{service}.json" in tree_paths
    }
    v.equal(snapshots, {f"{service}.json" for service in EXPECTED_SERVICE_SNAPSHOTS}, "service snapshot set")

    reviewed_paths = overlay.get("services", {}).get("people", {}).get("paths", {})
    receipt_ops = section.get("assignmentOperations", [])
    receipt_set = {
        (str(item.get("method", "")).lower(), item.get("path")): item.get("operationId")
        for item in receipt_ops
        if isinstance(item, dict)
    }
    v.equal(receipt_set, EXPECTED_ASSIGNMENT_OPERATIONS, "receipt Assignment operation set")
    for (method, path), operation_id in EXPECTED_ASSIGNMENT_OPERATIONS.items():
        reviewed = reviewed_paths.get(path, {}).get(method, {})
        service_operation = people.get("paths", {}).get(path, {}).get(method, {})
        gateway_path = f"/api/people{path}"
        gateway_operation = gateway.get("paths", {}).get(gateway_path, {}).get(method, {})
        label = f"{method.upper()} {path}"
        v.equal(reviewed.get("operationId"), operation_id, f"overlay {label} operationId")
        v.equal(reviewed.get("x-dwp-runtime-default"), "ON", f"overlay {label} runtime default")
        v.equal(reviewed.get("x-dwp-reviewed-springdoc-capture"), True, f"overlay {label} reviewed capture")
        v.equal(service_operation.get("operationId"), operation_id, f"people {label} operationId")
        v.equal(gateway_operation.get("operationId"), f"people_{operation_id}", f"gateway {label} operationId")

        response_expected = EXPECTED_RESPONSE_SCHEMAS[path]
        assert_ref_resolves(
            v,
            people,
            service_operation.get("responses", {}).get("200", {}).get("content", {})
            .get("application/json", {}).get("schema"),
            response_expected,
            f"people {label} response",
        )
        gateway_response = gateway_operation.get("responses", {}).get("200", {}).get("content", {}) \
            .get("application/json", {}).get("schema")
        gateway_response_name = ref_name(gateway_response)
        v.require(
            isinstance(gateway_response_name, str)
            and gateway_response_name in gateway.get("components", {}).get("schemas", {}),
            f"gateway {label} response component does not resolve: {gateway_response_name}",
        )
        if method == "post":
            request_expected = EXPECTED_REQUEST_SCHEMAS[path]
            assert_ref_resolves(
                v,
                people,
                service_operation.get("requestBody", {}).get("content", {})
                .get("application/json", {}).get("schema"),
                request_expected,
                f"people {label} request",
            )
            gateway_request = gateway_operation.get("requestBody", {}).get("content", {}) \
                .get("application/json", {}).get("schema")
            gateway_request_name = ref_name(gateway_request)
            v.require(
                isinstance(gateway_request_name, str)
                and gateway_request_name in gateway.get("components", {}).get("schemas", {}),
                f"gateway {label} request component does not resolve: {gateway_request_name}",
            )

    people_schemas = people.get("components", {}).get("schemas", {})
    required_fields = {
        "AssignmentProposalCreateRequest": {
            "commandId", "targetAssignmentId", "changeType", "effectiveDate",
            "reasonCode", "proposedChanges", "expectedAssignmentVersion",
        },
        "AssignmentProposalVersionCommand": {"commandId", "expectedVersion"},
        "AssignmentProposalCancelCommand": {"commandId", "expectedVersion", "reason"},
    }
    for schema_name, expected_required in required_fields.items():
        schema = people_schemas.get(schema_name, {})
        v.equal(set(schema.get("required", [])), expected_required, f"{schema_name} required fields")
    v.equal(
        people_schemas.get("AssignmentProposalCreateRequest", {})
        .get("properties", {}).get("expectedAssignmentVersion", {}).get("minimum"),
        0,
        "expectedAssignmentVersion minimum",
    )
    for schema_name in ("AssignmentProposalVersionCommand", "AssignmentProposalCancelCommand"):
        v.equal(
            people_schemas.get(schema_name, {}).get("properties", {}).get("expectedVersion", {}).get("minimum"),
            0,
            f"{schema_name} expectedVersion minimum",
        )

    submit_path = "/v1/workforce/assignment-proposals/{proposalId}/submit"
    for document_name, operation in (
        ("people", people["paths"][submit_path]["post"]),
        ("gateway", gateway["paths"][f"/api/people{submit_path}"]["post"]),
    ):
        assert_required_string_header(v, operation, "Idempotency-Key", max_length=200, label=document_name)
        assert_required_string_header(v, operation, "X-DWP-Step-Up-Challenge", max_length=None, label=document_name)
        assert_required_string_header(
            v, operation, "X-DWP-Expected-Decision-Revision", max_length=200, label=document_name
        )
        object_version = headers(operation).get("X-DWP-Expected-Object-Version")
        v.require(isinstance(object_version, dict), f"{document_name} missing object-version header")
        if isinstance(object_version, dict):
            v.equal(object_version.get("required"), True, f"{document_name} object-version required")
            schema = object_version.get("schema", {})
            v.equal(schema.get("type"), "integer", f"{document_name} object-version type")
            v.equal(schema.get("format"), "int64", f"{document_name} object-version format")
            v.equal(schema.get("minimum"), 0, f"{document_name} object-version minimum")

    non_submit_paths = {
        "/v1/workforce/assignment-proposals",
        "/v1/workforce/assignment-proposals/{proposalId}/validate",
        "/v1/workforce/assignment-proposals/{proposalId}/cancel",
    }
    forbidden_non_submit_headers: list[str] = []
    for path in non_submit_paths:
        for document_name, operation in (
            ("people", people["paths"][path]["post"]),
            ("gateway", gateway["paths"][f"/api/people{path}"]["post"]),
        ):
            assert_required_string_header(v, operation, "Idempotency-Key", max_length=200, label=f"{document_name} {path}")
            for name in ("X-DWP-Step-Up-Challenge", "X-DWP-Expected-Object-Version"):
                parameter = headers(operation).get(name)
                if isinstance(parameter, dict):
                    forbidden_non_submit_headers.append(f"{document_name}:{path}:{name}")
            decision_revision = headers(operation).get("X-DWP-Expected-Decision-Revision")
            if document_name == "people":
                v.equal(decision_revision, None, f"people {path} decision-revision omission")
            elif isinstance(decision_revision, dict):
                v.equal(
                    decision_revision.get("required"),
                    False,
                    f"gateway {path} optional decision-revision governance header",
                )
    v.equal(
        forbidden_non_submit_headers,
        [],
        "non-submit step-up-challenge/object-version header leaks",
    )
    closure = section.get("assignmentClosure", {})
    v.equal(
        closure.get("nonSubmitStepUpChallengeOrObjectVersionLeakCount"),
        0,
        "receipt non-submit leak count",
    )
    v.equal(
        closure.get("nonSubmitDecisionRevisionRule"),
        "PEOPLE_OMITS_HEADER_GATEWAY_MAY_ADD_OPTIONAL_GOVERNANCE_HEADER",
        "receipt non-submit decision-revision rule",
    )
    return {
        "services": len(snapshots),
        "peoplePaths": len(people.get("paths", {})),
        "gatewayPaths": len(gateway.get("paths", {})),
        "assignmentOperations": len(EXPECTED_ASSIGNMENT_OPERATIONS),
        "stepUpOrObjectVersionLeaks": len(forbidden_non_submit_headers),
    }


def check_successor(v: Validation, receipt: dict[str, Any]) -> dict[str, Any]:
    successor = receipt.get("recoverySuccessors", {})
    v.equal(successor.get("status"), "SEALED_G3_CANONICAL_SUCCESSOR_NOT_IMPLEMENTED", "successor status")
    manifest_record = successor.get("manifest", {})
    generator_record = successor.get("generator", {})
    validator_record = successor.get("validator", {})
    artifact_records = successor.get("artifacts", [])
    records = [manifest_record, generator_record, validator_record, *artifact_records]
    expected_paths = {
        "docs/06-delivery/hris/g3-successors/2026-10-07/manifest.v1.json",
        "docs/06-delivery/hris/g3-successors/2026-10-07/generate_g3_canonical_ownership.py",
        "docs/06-delivery/hris/g3-successors/2026-10-07/validate_g3_canonical_ownership.py",
        "docs/06-delivery/hris/g3-successors/2026-10-07/modern-capability-exact-schema-contracts.v1.json",
        "docs/06-delivery/hris/g3-successors/2026-10-07/modern-capability-event-payload-contracts.v1.json",
        "docs/06-delivery/hris/g3-successors/2026-10-07/modern-capability-semantic-bindings.v1.json",
        "docs/06-delivery/hris/g3-successors/2026-10-07/modern-capability-public-identity-registry.v1.json",
        "docs/06-delivery/hris/g3-successors/2026-10-07/g3-contract-primary-ownership-register.csv",
    }
    by_path = {
        record.get("path"): record
        for record in records
        if isinstance(record, dict) and isinstance(record.get("path"), str)
    }
    v.equal(set(by_path), expected_paths, "G3 successor file set")
    raw_by_path: dict[str, bytes] = {}
    for path, record in by_path.items():
        target = FRONTEND_ROOT / path
        v.require(target.is_file(), f"G3 successor file missing: {path}")
        if target.is_file():
            raw = target.read_bytes()
            raw_by_path[path] = raw
            verify_record(v, raw, record, path)

    manifest_path = manifest_record.get("path")
    if not isinstance(manifest_path, str) or manifest_path not in raw_by_path:
        raise ValueError("G3 successor manifest is unavailable")
    manifest = load_json_bytes(raw_by_path[manifest_path], manifest_path)
    v.equal(manifest.get("sealedPayloadSha256"), canonical_seal(manifest), "successor manifest seal")
    v.equal(manifest.get("status"), "SEALED_G3_CANONICAL_SUCCESSOR_NOT_IMPLEMENTED", "manifest status")
    authority = manifest.get("authority", {})
    v.equal(
        authority.get("canonicalSetId"),
        successor.get("canonicalSetId"),
        "successor canonical set ID",
    )
    v.equal(manifest.get("targetProfile"), {
        "canonicalJsonCount": 4,
        "modernOperations": 199,
        "modernCommands": 133,
        "modernQueries": 66,
        "modernEvents": 157,
        "officialNewOperations": 101,
        "officialNewRequestFields": 648,
        "recordSchemas": 117,
        "responseSchemas": 139,
        "primaryOwnershipCategories": EXPECTED_OWNERSHIP_PROFILE,
        "primaryOwnershipRows": 695,
    }, "manifest target profile")
    historical = manifest.get("historicalNonIdentity", {})
    v.equal(historical.get("historicalOwnershipRows"), 525, "historical ownership row fingerprint")
    v.equal(historical.get("historicalBytesRecovered"), False, "historical recovery claim")
    v.equal(historical.get("historicalBytesReused"), False, "historical reuse claim")
    v.equal(historical.get("historicalByteIdentityClaim"), False, "historical identity claim")
    boundary = manifest.get("authorizationBoundary", {})
    v.equal(boundary.get("moduleCodeGoGranted"), False, "successor module authority")
    v.equal(boundary.get("productionAuthorizationGranted"), False, "successor production authority")
    verification_plan = manifest.get("verificationPlan", {})
    v.equal(verification_plan.get("status"), "NOT_RECORDED", "successor verification-plan status")
    commands = verification_plan.get("commands", [])
    v.require(isinstance(commands, list) and len(commands) == 5, "successor verification-plan command inventory")
    for command in commands if isinstance(commands, list) else []:
        v.equal(command.get("expectedExitCode"), 0, "successor planned command exit code")
        v.equal(command.get("result"), "NOT_RECORDED", "successor planned command result")
    v.equal(verification_plan.get("fullSuitePlanned"), False, "successor full-suite plan")
    v.equal(verification_plan.get("w1Planned"), False, "successor W1 plan")
    v.equal(verification_plan.get("moduleCodeGoGranted"), False, "verification-plan module authority")
    v.equal(
        verification_plan.get("productionAuthorizationGranted"),
        False,
        "verification-plan production authority",
    )
    v.equal(
        manifest.get("publicationReceipt"),
        None,
        "successor manifest must not synthesize publication evidence",
    )

    artifact_docs: dict[str, dict[str, Any]] = {}
    for path in expected_paths:
        if not path.endswith(".json") or path.endswith("manifest.v1.json"):
            continue
        document = load_json_bytes(raw_by_path[path], path)
        v.equal(document.get("sealedPayloadSha256"), canonical_seal(document), f"{path} seal")
        artifact_docs[Path(path).name] = document
    exact = artifact_docs["modern-capability-exact-schema-contracts.v1.json"]
    events = artifact_docs["modern-capability-event-payload-contracts.v1.json"]
    semantic = artifact_docs["modern-capability-semantic-bindings.v1.json"]
    identity = artifact_docs["modern-capability-public-identity-registry.v1.json"]
    operation_ids = {row["operationId"] for row in exact.get("operationBindings", [])}
    event_ids = {row["eventName"] for row in events.get("eventPayloadSchemas", [])}
    semantic_operations = {row["operationId"] for row in semantic.get("operationSemanticBindings", [])}
    semantic_events = {row["eventName"] for row in semantic.get("eventSemanticBindings", [])}
    identity_operations = {row["operationId"] for row in identity.get("operationPublicIdentities", [])}
    identity_events = {row["eventName"] for row in identity.get("eventPublicIdentities", [])}
    v.equal(len(operation_ids), 199, "canonical operation count")
    v.equal(len(event_ids), 157, "canonical event count")
    v.equal(operation_ids, semantic_operations, "exact/semantic operation set")
    v.equal(operation_ids, identity_operations, "exact/identity operation set")
    v.equal(event_ids, semantic_events, "event/semantic set")
    v.equal(event_ids, identity_events, "event/identity set")
    modes = Counter(row.get("mode") for row in exact.get("operationBindings", []))
    v.equal(modes, Counter({"COMMAND": 133, "QUERY": 66}), "canonical operation modes")
    official_new_rows = [
        row
        for row in exact.get("operationBindings", [])
        if row.get("sourceAuthority", {}).get("kind") == "REVIEWED_SUCCESSOR_ADDITION"
    ]
    official_new_request_fields = sum(
        len(request_schema.get(field_group, []))
        for row in official_new_rows
        for request_schema in [row.get("requestSchema", {})]
        for field_group in ("pathParameters", "queryParameters", "headers", "body")
    )
    record_schemas = exact.get("recordSchemas", [])
    response_schemas = exact.get("responseSchemas", [])
    v.equal(len(official_new_rows), 101, "official new exact-oracle operation count")
    v.equal(official_new_request_fields, 648, "official new exact-oracle request field count")
    v.equal(len(record_schemas), 117, "exact-oracle record/entity-child schema count")
    v.equal(len(response_schemas), 139, "exact-oracle response schema count")
    response_schema_ids = {row.get("schemaId") for row in response_schemas}
    v.equal(len(response_schema_ids), 139, "unique response schema IDs")
    v.require(
        all(row.get("responseSchemaRef") in response_schema_ids for row in official_new_rows),
        "official new response schema reference is unresolved",
    )

    profile = successor.get("profile", {})
    for key, expected in (
        ("officialNewOperations", 101),
        ("officialNewRequestFields", 648),
        ("recordSchemas", 117),
        ("responseSchemas", 139),
    ):
        v.equal(profile.get(key), expected, f"receipt successor profile {key}")
    v.equal(
        successor.get("closure", {}).get("officialNewRequestEntityChildResponseExactOracleClosed"),
        True,
        "receipt exact-oracle closure",
    )
    independent_audit = successor.get("independentAudit", {})
    v.equal(independent_audit.get("status"), "CLEAN", "independent successor audit")
    v.equal(independent_audit.get("exactOracle"), {
        "coverage": "OFFICIAL_NEW_REQUEST_ENTITY_CHILD_RESPONSE",
        "operations": 101,
        "requestFields": 648,
        "recordSchemas": 117,
        "responseSchemas": 139,
    }, "independent exact-oracle audit")
    v.equal(independent_audit.get("openFindings"), {"P1": 0, "P2": 0}, "open P1/P2 findings")

    owner_path = "docs/06-delivery/hris/g3-successors/2026-10-07/g3-contract-primary-ownership-register.csv"
    owner_rows = list(csv.DictReader(io.StringIO(raw_by_path[owner_path].decode("utf-8"))))
    v.equal(len(owner_rows), 695, "primary ownership row count")
    owner_ids = [row.get("contract_id") for row in owner_rows]
    v.equal(len(set(owner_ids)), 695, "primary ownership unique contract IDs")
    owner_profile = Counter(row.get("contract_kind") for row in owner_rows)
    v.equal(dict(owner_profile), EXPECTED_OWNERSHIP_PROFILE, "primary ownership categories")
    v.require(
        all(row.get("status") == "SEALED_G3_PRIMARY_OWNER" for row in owner_rows),
        "primary ownership contains a non-sealed row",
    )

    return {
        "canonicalOperations": len(operation_ids),
        "canonicalEvents": len(event_ids),
        "officialNewOperations": len(official_new_rows),
        "officialNewRequestFields": official_new_request_fields,
        "recordSchemas": len(record_schemas),
        "responseSchemas": len(response_schemas),
        "ownershipRows": len(owner_rows),
        "openP1": independent_audit.get("openFindings", {}).get("P1"),
        "openP2": independent_audit.get("openFindings", {}).get("P2"),
        "successorToolsReexecuted": False,
    }


def check_handoff_and_status(v: Validation, receipt: dict[str, Any]) -> dict[str, Any]:
    handoff = receipt.get("frontendProjectionHandoff", {})
    v.equal(handoff.get("status"), "G4_MATERIALIZATION_REQUIRED_FROM_PINNED_BACKEND_INPUT", "G4 handoff status")
    v.equal(handoff.get("currentFrontendAuthorizationVersion"), 32, "current FE authorization version")
    v.equal(handoff.get("reconciledFrontendAuthorizationVersion"), 33, "reconciled FE authorization version")
    v.equal(handoff.get("backendAuthorizationVersion"), 34, "backend authorization version")
    v.equal(handoff.get("frontendProjectionModifiedInG3"), False, "G3 frontend projection mutation")
    v.equal(handoff.get("postMaterializationRule"), "RUN_SYNC_AND_CHECK_AGAIN_TO_PROVE_NO_OP", "post-sync rule")
    identity = handoff.get("visibleHomeApplicationIdentity", {})
    v.equal(identity.get("expected"), "HRIS", "visible Home identity")
    v.equal(identity.get("staleValueProhibited"), "인사", "stale Home identity")
    v.equal(
        set(identity.get("g4VerificationSurfaces", [])),
        {"API", "CATALOG", "I18N", "FRONTEND_RUNTIME_PROJECTION"},
        "G4 Home identity surfaces",
    )
    v.equal(identity.get("g5VerificationSurface"), "MIGRATED_RUNTIME_DATABASE", "G5 Home identity surface")

    runtime = receipt.get("runtimeEvidenceReclassification", {})
    v.equal(runtime.get("status"), "EXPLICITLY_RECLASSIFIED_TO_G5_REQUIRED_NO_WAIVER", "runtime reclassification")
    v.equal(runtime.get("attemptDisposition"), "STOPPED_AFTER_TARGETED_DIAGNOSIS_NO_REPEATED_BROAD_RUNTIME", "runtime attempt policy")
    v.equal(runtime.get("g4InputAuthority"), "REVIEWED_SNAPSHOT_ONLY", "G4 snapshot authority")
    v.equal(runtime.get("runtimeTruthClaimed"), False, "runtime truth claim")
    required_evidence = runtime.get("g5RequiredEvidence", [])
    v.require(isinstance(required_evidence, list) and len(required_evidence) == 8, "G5 reclassified evidence set")
    invalidation = runtime.get("invalidationPolicy", {})
    v.equal(invalidation.get("emptyG5ParityDiff"), "REUSE_G4_EVIDENCE", "empty parity diff rule")
    v.require("IMPACTED_G4" in str(invalidation.get("nonEmptyG5ParityDiff")), "non-empty parity diff is not impact-scoped")

    validation_rows = receipt.get("targetedValidation", [])
    v.require(isinstance(validation_rows, list) and len(validation_rows) == 11, "targeted validation evidence count")
    forbidden_tokens = (" w1 ", "docker", "yarn test", "gradlew test", " full suite")
    for row in validation_rows if isinstance(validation_rows, list) else []:
        v.require(str(row.get("status", "")).startswith("PASS"), f"targeted validation is not PASS: {row}")
        command = f" {str(row.get('command', '')).lower()} "
        for token in forbidden_tokens:
            v.require(token not in command, f"targeted validation contains forbidden broad/runtime command: {command.strip()}")
        if "./gradlew" in command:
            v.require("--tests" in command, f"Gradle validation is not test-filtered: {command.strip()}")
    ownership_self_tests = [
        row for row in validation_rows
        if str(row.get("command", "")).endswith("validate_g3_canonical_ownership.py --self-test")
    ]
    v.require(len(ownership_self_tests) == 1, "ownership self-test evidence must be unique")
    if len(ownership_self_tests) == 1:
        v.equal(
            ownership_self_tests[0].get("hostileMutationsRejected"),
            30,
            "ownership hostile-mutation coverage",
        )

    status_path = FRONTEND_ROOT / "docs/06-delivery/hris/2026-10-07-g3-integration-roadmap-status.md"
    status = status_path.read_text(encoding="utf-8")
    required_tokens = (
        "G3 complete with known G5 blockers; G4 authorized, not started",
        "COMPLETE_WITH_KNOWN_G5_BLOCKERS",
        "AUTHORIZED_NOT_STARTED",
        EXPECTED_G3_BACKEND,
        "current Frontend v32",
        "Reconciled v33",
        "pinned v34",
        "HRIS",
        "`인사`",
        "request/entity-child/response exact oracle",
        "open P1 = 0",
        "open P2 = 0",
        "G6 W1 Successor",
        "G7 Evidence Promotion",
    )
    for token in required_tokens:
        v.require(token in status, f"G3 status successor missing {token!r}")
    v.require("enabled runtime 정본" in status, "status lacks reviewed/runtime truth boundary")
    return {
        "targetedValidationRecords": len(validation_rows),
        "visibleHomeIdentity": identity.get("expected"),
        "runtimeTruthClaimed": runtime.get("runtimeTruthClaimed"),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--backend-root",
        type=Path,
        default=DEFAULT_BACKEND,
        help="G3 backend integration worktree",
    )
    parser.add_argument(
        "--receipt",
        type=Path,
        default=DEFAULT_RECEIPT,
        help="receipt path relative to the frontend repository or absolute",
    )
    parser.add_argument("--compact", action="store_true", help="emit compact JSON")
    args = parser.parse_args()

    receipt_path = args.receipt
    if not receipt_path.is_absolute():
        receipt_path = FRONTEND_ROOT / receipt_path
    backend = args.backend_root.resolve()
    receipt = load_json(receipt_path)
    validation = Validation()
    validation.section("receipt", lambda: check_receipt(validation, receipt_path, receipt))
    validation.section("sealedPredecessors", lambda: check_sealed_predecessors(validation, receipt))
    validation.section("backendCommit", lambda: check_backend_commit(validation, backend, receipt))
    validation.section(
        "authorizationAndFixtures",
        lambda: check_authorization_and_fixtures(validation, backend, receipt),
    )
    validation.section("openApi", lambda: check_openapi(validation, backend, receipt))
    validation.section("canonicalOwnershipSuccessor", lambda: check_successor(validation, receipt))
    validation.section("handoffAndStatus", lambda: check_handoff_and_status(validation, receipt))

    result = {
        "schema": "dwp.hris.g3-canonical-generation-validation.v1",
        "status": "PASS" if not validation.errors else "FAIL",
        "receipt": str(receipt_path.relative_to(FRONTEND_ROOT)),
        "backendRoot": str(backend),
        "checks": validation.checks,
        "errors": validation.errors,
        "broadSuiteExecuted": False,
        "dockerExecuted": False,
        "w1Executed": False,
    }
    print(json.dumps(result, ensure_ascii=False, indent=None if args.compact else 2, sort_keys=True))
    return 0 if not validation.errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
