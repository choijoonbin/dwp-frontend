#!/usr/bin/env python3
"""Fail-closed authority validator for the HRM-013 Auth runtime lane.

This read-only validator binds one backend direct child to the service-grant,
requester-identity and step-up control plane.  Receipt creation, source writes,
branch integration, activation and production release are deliberately external.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import stat
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any


SCRIPT = Path(__file__).absolute()
HERE = SCRIPT.parent
FRONTEND = HERE.parents[4]
WORKSPACE = FRONTEND.parent
BACKEND = Path("/Users/a10697/Work/DWP/dwp-backend")
GIT = "/usr/bin/git"

FRONTEND_BASE = "32435f1609ef543f13aa643f1158e5e75f24898d"
FRONTEND_BASE_TREE = "91299b330b83d6b29a7aa68b8dca94939abd951c"
BACKEND_BASE = "d48dc900593f82e46c9971eac085c92a2f23427c"
BACKEND_BASE_TREE = "35f434ecbb0a412572ade7ce7bea7154c2fac00b"
V271_CARRIER = "24cb37b7c9f23b2f74a833aedf6939e499f5ab99"
V271_CARRIER_TREE = "037184f9120bfeaec2d99e1e8ce8a6c744751916"
V271_DELEGATION_SHA256 = "436f17f6d46184a25001b662a4613a68aa9db7c5c18a198424589526697da5a4"
BRANCH = "codex/hris-wave7-batch06-hrm013-auth-authority-backend-20261026-r1"
WORKTREE = Path(
    "/Users/a10697/Work/DWP/.codex-worktrees/hris/wave7-20261026/"
    "batch06/hrm013-owner-runtime/auth"
)
RECEIPTS = Path(
    "/Users/a10697/Work/DWP/.codex-worktrees/hris/wave7-20261026/"
    "batch06/hrm013-owner-runtime/receipts"
)

ROOT_REL = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-auth-runtime-authority-r1"
)
AUTHORITY_REL = f"{ROOT_REL}/auth-runtime-execution-authority.v1.json"
REVIEW_REL = f"{ROOT_REL}/independent-review.v1.json"
VALIDATOR_REL = f"{ROOT_REL}/validate_hrm013_auth_runtime_authority.py"
CARRIER_PATHS = {"package.json", AUTHORITY_REL, REVIEW_REL, VALIDATOR_REL}
CLEAN_RECEIPT = RECEIPTS / "auth-runtime-clean-worktree-receipt.v1.json"
TARGETED_RECEIPT = RECEIPTS / "auth-runtime-targeted-verification-receipt.v1.json"
POST_RECEIPT = RECEIPTS / "auth-runtime-post-implementation-review.v1.json"
DELEGATION_RECEIPT = RECEIPTS / "auth-runtime-successor-delegation-authority.v1.json"

PREDECESSOR_COMMAND = (
    "python3 docs/06-delivery/hris/tools/validate_current_authority.py && "
    "python3 docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-semantic-closure-r1/validate_hrm013_semantic_closure.py && "
    "python3 docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-callback-binding-r1/validate_hrm013_callback_binding.py && "
    "python3 docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-owner-runtime-binding-gate-r1/validate_hrm013_owner_runtime_binding_gate.py && "
    "python3 docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-runtime-contract-authority-r1/validate_hrm013_runtime_contract_authority.py && "
    "python3 docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-shared-contract-integration-r1/validate_hrm013_shared_contract_integration.py && "
    "python3 docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-auth-v62-generation-r1/validate_hrm013_auth_v62_generation_authority.py && "
    "python3 docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-auth-v62-generation-integration-r1/validate_hrm013_auth_v62_generation_integration.py && "
    "python3 docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-auth-v271-authority-r1/validate_hrm013_auth_v271_authority.py"
)
CURRENT_COMMAND = PREDECESSOR_COMMAND + " && python3 " + VALIDATOR_REL

MAIN_PREFIX = "dwp-auth-server/src/main/java/com/dwp/services/auth/hrisservicegrant/"
TEST_PREFIX = "dwp-auth-server/src/test/java/com/dwp/services/auth/hrisservicegrant/"
MAIN_FILES = {
    MAIN_PREFIX + name for name in (
        "HrisServiceGrantAuthorityController.java",
        "HrisServiceGrantAuthorityService.java",
        "HrisServiceGrantAuthorityRepository.java",
        "HrisServiceGrantAuthoritySecurityConfig.java",
        "HrisServiceGrantAuthorityIngressFilter.java",
        "HrisServiceGrantAuthorityRequestContext.java",
        "HrisServiceGrantAuthorityProofVerifier.java",
        "HrisServiceGrantAuthorityProblem.java",
        "HrisServiceGrantQuiesceService.java",
        "HrisServiceGrantRotationReadinessVerifier.java",
        "HrisServiceGrantAuthorityOwnerCredentialProvider.java",
        "Hrm013RequesterIdentityAuthorityController.java",
        "Hrm013RequesterIdentityAuthorityService.java",
        "Hrm013RequesterIdentityAuthorityRepository.java",
        "Hrm013RequesterIdentityIngressFilter.java",
        "Hrm013RequesterIdentityProofVerifier.java",
    )
}
EXISTING_MAIN_FILES = {
    "dwp-auth-server/src/main/java/com/dwp/services/auth/service/ProductSurfaceStepUpRouteResolver.java",
    "dwp-auth-server/src/main/java/com/dwp/services/auth/service/ProductAuthorizationContractValidator.java",
    "dwp-auth-server/src/main/java/com/dwp/services/auth/service/ProductAuthorizationReleaseLineage.java",
    "dwp-auth-server/src/main/java/com/dwp/services/auth/service/WorkflowRuntimeIdentityAuthorityBridge.java",
    "dwp-auth-server/src/main/java/com/dwp/services/auth/workflowruntime/WorkflowRuntimeBindings.java",
    "dwp-auth-server/src/main/java/com/dwp/services/auth/workflowruntime/WorkflowRuntimeAuthorityService.java",
    "dwp-auth-server/src/main/java/com/dwp/services/auth/workflowruntime/WorkflowRuntimeAdmissionLink.java",
    "dwp-auth-server/src/main/resources/application.yml",
}
TEST_NAMES = (
    "HrisServiceGrantAuthorityRepositoryPostgresTest.java",
    "HrisServiceGrantAuthorityControllerTest.java",
    "HrisServiceGrantAuthorityIngressFilterTest.java",
    "HrisServiceGrantAuthorityProofVerifierTest.java",
    "HrisServiceGrantAuthorityDefaultOffTest.java",
    "HrisServiceGrantQuiescePostgresTest.java",
    "HrisServiceGrantDrainActivityPostgresTest.java",
    "HrisServiceGrantReadinessObservationTest.java",
    "HrisServiceGrantDrainAuthorizationExpiryRaceTest.java",
    "HrisServiceGrantAuthLocalRoleOperationTest.java",
    "HrisServiceGrantCoupledBindingRotationTest.java",
    "HrisServiceGrantWaiverDependencyGroupRotationTest.java",
    "HrisServiceGrantRotationReadinessVerifierTest.java",
    "Hrm013RequesterIdentityAuthorityControllerTest.java",
    "Hrm013RequesterIdentityAuthorityRepositoryPostgresTest.java",
    "Hrm013RequesterIdentityIngressFilterTest.java",
    "Hrm013RequesterIdentityProofVerifierTest.java",
    "Hrm013RequesterIdentityDrainAuthorityTest.java",
)
TEST_FILES = {TEST_PREFIX + name for name in TEST_NAMES}
EXISTING_TEST_FILES = {
    "dwp-auth-server/src/test/java/com/dwp/services/auth/workflowruntime/WorkflowRuntimeAdmissionLinkTest.java",
    "dwp-auth-server/src/test/java/com/dwp/services/auth/workflowruntime/WorkflowRuntimeProofTest.java",
    "dwp-auth-server/src/test/java/com/dwp/services/auth/service/WorkflowRuntimeAuthorityPostgresTest.java",
    "dwp-auth-server/src/test/java/com/dwp/services/auth/service/ProductAuthorizationV62ContractTest.java",
    "dwp-auth-server/src/test/java/com/dwp/services/auth/service/ProductAuthorizationReleaseLineageTest.java",
    "dwp-auth-server/src/test/java/com/dwp/services/auth/service/ProductAuthorizationReleaseLineagePostgresTest.java",
    "dwp-auth-server/src/test/java/com/dwp/services/auth/service/ProductAuthorizationSeedLoaderTest.java",
    "dwp-auth-server/src/test/java/com/dwp/services/auth/service/ProductSurfaceDecisionContextFilterTest.java",
}
ALLOWLIST = MAIN_FILES | EXISTING_MAIN_FILES | TEST_FILES | EXISTING_TEST_FILES
FORBIDDEN_PREFIXES = (
    "dwp-approval-server/", "dwp-people-server/", "dwp-time-server/",
    "dwp-payroll-server/", "dwp-api-gateway/",
)
REQUIRED_DEFAULTS = {
    "dwp.auth.hris-service-grant-authority.enabled": "false",
    "dwp.auth.hrm013-requester-authority.enabled": "false",
    "dwp.auth.hrm013-identity-task-dispatch.enabled": "false",
}
VERIFICATION_COMMANDS = [
    "./gradlew :dwp-auth-server:test --tests com.dwp.services.auth.hrisservicegrant.*",
    "./gradlew :dwp-auth-server:test --tests com.dwp.services.auth.workflowruntime.WorkflowRuntimeAdmissionLinkTest --tests com.dwp.services.auth.workflowruntime.WorkflowRuntimeProofTest --tests com.dwp.services.auth.service.WorkflowRuntimeAuthorityPostgresTest",
    "./gradlew :dwp-auth-server:test --tests com.dwp.services.auth.hrisservicegrant.HrisServiceGrantAuthorityMigrationPostgresTest --tests com.dwp.services.auth.repository.TenantFeatureActivationV271MigrationContractTest --tests com.dwp.services.auth.tenantfeatureactivation.TenantFeatureActivationV271PostgresTest",
    "./gradlew :dwp-auth-server:test --tests com.dwp.services.auth.service.ProductAuthorizationV62ContractTest --tests com.dwp.services.auth.service.ProductAuthorizationReleaseLineageTest --tests com.dwp.services.auth.service.ProductAuthorizationReleaseLineagePostgresTest --tests com.dwp.services.auth.service.ProductAuthorizationSeedLoaderTest --tests com.dwp.services.auth.service.ProductSurfaceDecisionContextFilterTest",
    "python3 scripts/tests/test_product_authorization_v62.py",
]

SAFE_GIT_ENV = {
    "PATH": "/usr/bin:/bin", "HOME": "/var/empty", "LC_ALL": "C", "LANG": "C",
    "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": "/dev/null",
    "GIT_NO_REPLACE_OBJECTS": "1",
}
UNSAFE_ENV = {
    "GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_OBJECT_DIRECTORY",
    "GIT_ALTERNATE_OBJECT_DIRECTORIES", "GIT_CONFIG", "GIT_CONFIG_COUNT",
    "GIT_CONFIG_PARAMETERS", "GIT_EXTERNAL_DIFF", "PYTHONPATH", "PYTHONHOME",
}


class VerificationError(RuntimeError):
    pass


class V:
    def __init__(self) -> None:
        self.checks = 0

    def require(self, condition: bool, message: str) -> None:
        self.checks += 1
        if not condition:
            raise VerificationError(message)

    def exact(self, actual: Any, expected: Any, message: str) -> None:
        self.checks += 1
        if type(actual) is not type(expected) or actual != expected:
            raise VerificationError(f"{message}: expected={expected!r} actual={actual!r}")


def run(repo: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[bytes]:
    result = subprocess.run(
        [GIT, "-C", str(repo), *args], stdout=subprocess.PIPE,
        stderr=subprocess.PIPE, env=SAFE_GIT_ENV, check=False,
    )
    if check and result.returncode:
        raise VerificationError(
            f"git {' '.join(args)} failed: "
            f"{result.stderr.decode('utf-8', errors='replace').strip()}"
        )
    return result


def text(repo: Path, *args: str) -> str:
    return run(repo, *args).stdout.decode("utf-8").strip()


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def artifact(path: str, data: bytes) -> dict[str, Any]:
    return {"path": path, "bytes": len(data), "sha256": digest(data)}


def load_json(data: bytes, label: str) -> Any:
    def reject(value: str) -> None:
        raise VerificationError(f"non-finite number in {label}: {value}")

    def pairs(items: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in items:
            if key in result:
                raise VerificationError(f"duplicate key in {label}: {key}")
            result[key] = value
        return result

    try:
        return json.loads(data.decode("utf-8"), parse_constant=reject, object_pairs_hook=pairs)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise VerificationError(f"invalid JSON in {label}: {exc}") from exc


def closed(v: V, value: Any, fields: set[str], label: str) -> None:
    v.require(isinstance(value, dict), f"{label} must be object")
    if isinstance(value, dict):
        v.exact(set(value), fields, f"{label} field drift")


def parse_time(value: Any, label: str) -> datetime:
    if not isinstance(value, str):
        raise VerificationError(f"{label} must be timestamp")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise VerificationError(f"invalid {label}") from exc
    if parsed.tzinfo is None:
        raise VerificationError(f"{label} lacks timezone")
    return parsed.astimezone(timezone.utc)


def canonical(path: str) -> bool:
    if (
        not path or "\\" in path or path.startswith("/") or "//" in path
        or path.endswith("/") or "/./" in path or path.startswith("./")
        or "/../" in path or path.startswith("../") or path.endswith("/..")
    ):
        return False
    parts = PurePosixPath(path).parts
    return all(part not in ("", ".", "..") for part in parts)


def changes(repo: Path) -> set[str]:
    raw = run(repo, "status", "--porcelain=v1", "-z", "--untracked-files=all").stdout
    items = raw.split(b"\0")
    result: set[str] = set()
    index = 0
    while index < len(items) and items[index]:
        entry = items[index].decode("utf-8", errors="strict")
        path = entry[3:]
        if entry[:2][0] in "RC" or entry[:2][1] in "RC":
            index += 1
            if index >= len(items) or not items[index]:
                raise VerificationError("truncated rename status")
            path = items[index].decode("utf-8", errors="strict")
        result.add(path)
        index += 1
    return result


def between(repo: Path, older: str, newer: str) -> set[str]:
    output = text(repo, "diff", "--name-only", "--diff-filter=ACDMRTUXB", older, newer)
    return {line for line in output.splitlines() if line}


def blob(repo: Path, commit: str, path: str) -> bytes | None:
    result = run(repo, "show", f"{commit}:{path}", check=False)
    return result.stdout if result.returncode == 0 else None


def symlink_free(root: Path, relative: str) -> bool:
    current = root
    for part in PurePosixPath(relative).parts:
        current = current / part
        if current.is_symlink():
            return False
    return current.exists()


def receipt_bytes(v: V, path: Path, label: str) -> bytes:
    v.require(path.exists() and not path.is_symlink(), f"missing {label}: {path}")
    v.exact(stat.S_IMODE(path.stat().st_mode), 0o600, f"{label} mode must be 0600")
    return path.read_bytes()


def runtime(v: V, require_trusted: bool) -> bool:
    if not require_trusted:
        return False
    v.require(Path(sys.executable).resolve() in {
        Path("/usr/bin/python3").resolve(),
        Path("/Library/Developer/CommandLineTools/usr/bin/python3").resolve(),
    }, "untrusted Python executable")
    for name in UNSAFE_ENV:
        v.require(not os.environ.get(name), f"unsafe environment: {name}")
    v.exact(Path.cwd().resolve(), FRONTEND.resolve(), "trusted validator must run at frontend root")
    return True


def expected_authority() -> dict[str, Any]:
    return {
        "schema": "dwp.hris.wave7.hrm013-auth-runtime-execution-authority.v1",
        "state": "INDEPENDENTLY_REVIEWED_HASH_BOUND_AUTH_RUNTIME_EXECUTION_AUTHORITY",
        "lane": "AUTH_SERVICE_GRANT_REQUESTER_AND_STEP_UP_CONTROL_PLANE",
        "predecessor": {
            "repository": "dwp-backend", "commit": BACKEND_BASE, "tree": BACKEND_BASE_TREE,
            "v271AuthorityCarrierCommit": V271_CARRIER,
            "v271AuthorityCarrierTree": V271_CARRIER_TREE,
            "v271SuccessorDelegationReceiptSha256": V271_DELEGATION_SHA256,
        },
        "backendImplementation": {
            "repository": "dwp-backend", "branch": BRANCH,
            "baseCommit": BACKEND_BASE, "baseTree": BACKEND_BASE_TREE,
            "operation": "AUTHOR_VALIDATE_COMMIT_AND_PUSH_AUTH_RUNTIME_ONLY",
            "requiredDirectChild": True, "migrationAuthoringAuthorized": False,
            "directDwpDevIntegrationAuthorized": False,
        },
        "delegationBoundary": {
            "receiptPath": str(DELEGATION_RECEIPT),
            "receiptSchema": "dwp.hris.wave7.hrm013-auth-runtime-successor-delegation-authority-receipt.v1",
            "receiptState": "HASH_BOUND_REVIEWED_AUTH_RUNTIME_SUCCESSOR_CONTROL_DELEGATION",
            "requiredDecision": "GO_FOR_AUTH_RUNTIME_SUCCESSOR_CONTROL_DELEGATION_ONLY",
            "externalAttestationRequired": True, "currentV271AuthorityGrantsRuntime": False,
        },
        "authority": {
            "independentReviewComplete": True,
            "authRuntimeImplementationAuthorizedAfterSeparateCleanWorktreeReceipt": True,
            "laneCommitAndPushAuthorizedAfterTargetedVerification": True,
            "backendDwpDevIntegrationAuthorized": False,
            "approvalRuntimeImplementationAuthorized": False,
            "peopleOwnerRuntimeImplementationAuthorized": False,
            "taskDispatchOwnerImplementationAuthorized": False,
            "featureEnablementAuthorized": False, "tenantEnrollmentAuthorized": False,
            "productionReleaseAuthorized": False, "businessCompletionCredit": 0,
        },
    }


def check_carrier_content(v: V, carrier: str | None) -> None:
    # The carrier review is an immutable record of the exact files committed by
    # that historical carrier.  Later lifecycle carriers may append the current
    # contract chain and harden this validator, so review pins must be resolved
    # from the introducing commit rather than from the mutable working tree.
    historical = lambda path: (
        (FRONTEND / path).read_bytes()
        if carrier is None
        else blob(FRONTEND, carrier, path) or b""
    )
    authority_data = historical(AUTHORITY_REL)
    validator_data = historical(VALIDATOR_REL)
    reviewed_package_data = historical("package.json")
    package_data = (FRONTEND / "package.json").read_bytes()
    v.exact(load_json(authority_data, "authority"), expected_authority(), "authority drift")
    package = load_json(package_data, "package")
    current_command = package["scripts"]["hris:current-contracts:check"]
    expected_parts = CURRENT_COMMAND.split(" && ")
    current_parts = current_command.split(" && ")
    v.exact(current_parts[:len(expected_parts)], expected_parts, "Auth runtime package prefix")
    v.exact(len(current_parts), len(set(current_parts)), "duplicate package validator command")
    for command in current_parts[len(expected_parts):]:
        match = re.fullmatch(
            r"python3 (docs/06-delivery/hris/[A-Za-z0-9._/-]+/validate_[A-Za-z0-9_]+\.py)",
            command,
        )
        v.require(match is not None, "non-validator package suffix")
        path = match.group(1)
        v.require(
            canonical(path) and path.startswith("docs/06-delivery/hris/")
            and PurePosixPath(path).name.startswith("validate_") and path.endswith(".py"),
            f"non-canonical package validator suffix: {path}",
        )
        candidate = FRONTEND / path
        v.require(candidate.is_file() and not candidate.is_symlink(), f"missing package validator: {path}")
        v.require(
            run(FRONTEND, "ls-files", "--error-unmatch", "--", path, check=False).returncode == 0,
            f"untracked package validator: {path}",
        )
    v.require("prehris:current-contracts:check" not in package["scripts"], "npm pre hook is forbidden")
    v.require("posthris:current-contracts:check" not in package["scripts"], "npm post hook is forbidden")
    v.exact(
        current_command.split(" && ").count("python3 " + VALIDATOR_REL),
        1,
        "Auth runtime validator occurrence count",
    )
    review = load_json((FRONTEND / REVIEW_REL).read_bytes(), "independent review")
    closed(v, review, {"schema", "reviewedAt", "reviewer", "scope", "findings", "finalVerdict", "authority", "artifactPins"}, "review")
    expected = {
        "schema": "dwp.hris.wave7.hrm013-auth-runtime-execution-authority-independent-review.v1",
        "reviewer": "INDEPENDENT_HRM013_AUTH_RUNTIME_AUTHORITY_REVIEW",
        "scope": {
            "authorityPath": AUTHORITY_REL, "validatorPath": VALIDATOR_REL,
            "packagePath": "package.json",
            "reviewedBoundaries": [
                "EXACT_INTEGRATED_AUTH_V271_COMMIT_AND_DELEGATION_RECEIPT",
                "EXACT_AUTH_RUNTIME_BRANCH_BASE_AND_DIRECT_CHILD",
                "DEDICATED_CLEAN_WORKTREE_AND_TARGETED_VERIFICATION_REQUIRED",
                "NO_MIGRATION_OR_CROSS_MODULE_RUNTIME_AUTHORITY",
                "NO_DIRECT_BACKEND_DWP_DEV_INTEGRATION",
                "NO_FEATURE_TENANT_OR_PRODUCTION_AUTHORITY",
            ],
        },
        "findings": {"p0": [], "p1": [], "p2": [], "notes": [
            "The carrier may authorize only the Auth service-grant, requester-identity and step-up control-plane runtime from the exact integrated V271 commit.",
            "No migration or Approval, People, Time or Payroll runtime source is authorized by this carrier.",
            "Backend dwp-dev integration, feature activation, tenant enrollment and production release remain externally gated.",
        ]},
        "finalVerdict": {"p0": 0, "p1": 0, "p2": 0, "decision": "GO_FOR_AUTH_RUNTIME_AUTHORITY_CARRIER_COMMIT_AND_PUSH_ONLY"},
        "authority": {
            "independentReviewComplete": True, "carrierCommitAndPushAuthorized": True,
            "cleanWorktreeMaterializationAuthorizedAfterCarrierPush": True,
            "authRuntimeAuthoringAuthorizedAfterCleanReceipt": True,
            "migrationAuthoringAuthorized": False,
            "approvalOrPeopleRuntimeAuthorized": False,
            "backendDwpDevIntegrationAuthorized": False,
            "productionReleaseAuthorized": False, "businessCompletionCredit": 0,
        },
        "artifactPins": [
            artifact(AUTHORITY_REL, authority_data), artifact(VALIDATOR_REL, validator_data),
            artifact("package.json", reviewed_package_data),
        ],
    }
    v.exact({key: review.get(key) for key in expected}, expected, "independent review drift")
    parse_time(review.get("reviewedAt"), "reviewedAt")


def carrier_commit(v: V) -> str | None:
    additions = [line for line in text(FRONTEND, "log", "--diff-filter=A", "--format=%H", "--", AUTHORITY_REL).splitlines() if line]
    if not additions:
        return None
    v.exact(len(additions), 1, "authority introduction is ambiguous")
    commit = additions[0]
    for path in (REVIEW_REL, VALIDATOR_REL):
        found = [line for line in text(FRONTEND, "log", "--diff-filter=A", "--format=%H", "--", path).splitlines() if line]
        v.exact(found, [commit], f"carrier introduction drift: {path}")
    v.exact(text(FRONTEND, "rev-list", "--parents", "-n", "1", commit).split(), [commit, FRONTEND_BASE], "carrier must be direct child of fixed frontend base")
    v.exact(between(FRONTEND, FRONTEND_BASE, commit), CARRIER_PATHS, "carrier changed-path drift")
    v.exact(text(FRONTEND, "rev-parse", f"{FRONTEND_BASE}^{{tree}}"), FRONTEND_BASE_TREE, "frontend base tree drift")
    return commit


def validate_lane_paths(v: V, paths: set[str]) -> None:
    v.require(bool(paths), "Auth runtime lane has no changes")
    v.require(all(canonical(path) for path in paths), "noncanonical Auth runtime path")
    v.require(not any("/db/migration/" in path for path in paths), "migration authored in Auth runtime lane")
    v.require(not any(path.startswith(prefix) for path in paths for prefix in FORBIDDEN_PREFIXES), "cross-module runtime source in Auth lane")
    unexpected = paths - ALLOWLIST
    v.exact(unexpected, set(), "Auth runtime allowlist drift")
    v.require(bool(paths & MAIN_FILES), "service-grant/requester runtime source missing")
    v.require(bool(paths & TEST_FILES), "Auth runtime targeted tests missing")


def validate_clean_receipt(v: V, carrier: str) -> dict[str, Any]:
    data = receipt_bytes(v, CLEAN_RECEIPT, "clean worktree receipt")
    receipt = load_json(data, "clean worktree receipt")
    required = {
        "schema", "state", "authorityCarrierCommit", "authorityCarrierTree",
        "authorityArtifact", "validatorArtifact", "packageArtifact", "repository",
        "repositoryRoot", "worktreeRoot", "branch", "baseCommit", "baseTree",
        "headCommit", "headTree", "originDwpDevCommit", "porcelainV2",
        "ignoredSourceShadows", "untrackedSourceShadows", "replaceRefs", "grafts",
        "sparseCheckout", "fsmonitor", "externalDiff", "assumeUnchanged",
        "skipWorktree", "pathSymlinks", "authorityCarrierCommittedAt",
        "authorityCarrierPushObservedAt", "verifiedAt", "verifiedBy",
    }
    closed(v, receipt, required, "clean worktree receipt")
    carrier_tree = text(FRONTEND, "rev-parse", f"{carrier}^{{tree}}")
    expected = {
        "schema": "dwp.hris.wave7.hrm013-auth-runtime-clean-worktree-receipt.v1",
        "state": "HASH_BOUND_FRESH_CLEAN_AUTH_RUNTIME_WORKTREE_RECEIPT",
        "authorityCarrierCommit": carrier, "authorityCarrierTree": carrier_tree,
        "authorityArtifact": artifact(AUTHORITY_REL, blob(FRONTEND, carrier, AUTHORITY_REL) or b""),
        "validatorArtifact": artifact(VALIDATOR_REL, blob(FRONTEND, carrier, VALIDATOR_REL) or b""),
        "packageArtifact": artifact("package.json", blob(FRONTEND, carrier, "package.json") or b""),
        "repository": "dwp-backend", "repositoryRoot": str(BACKEND),
        "worktreeRoot": str(WORKTREE), "branch": BRANCH,
        "baseCommit": BACKEND_BASE, "baseTree": BACKEND_BASE_TREE,
        "headCommit": BACKEND_BASE, "headTree": BACKEND_BASE_TREE,
        "originDwpDevCommit": BACKEND_BASE, "porcelainV2": "",
        "ignoredSourceShadows": [], "untrackedSourceShadows": [], "replaceRefs": [],
        "grafts": [], "sparseCheckout": False, "fsmonitor": False,
        "externalDiff": False, "assumeUnchanged": [], "skipWorktree": [],
        "pathSymlinks": [], "verifiedBy": "TRUSTED_HRM013_AUTH_RUNTIME_CLEAN_WORKTREE_VERIFIER",
    }
    v.exact({key: receipt.get(key) for key in expected}, expected, "clean worktree evidence drift")
    for key in ("authorityCarrierCommittedAt", "authorityCarrierPushObservedAt", "verifiedAt"):
        parse_time(receipt.get(key), key)
    return receipt


def validate_targeted(v: V, carrier: str, commit: str, paths: set[str]) -> dict[str, Any]:
    clean_data = receipt_bytes(v, CLEAN_RECEIPT, "clean worktree receipt")
    data = receipt_bytes(v, TARGETED_RECEIPT, "targeted verification receipt")
    receipt = load_json(data, "targeted verification receipt")
    required = {
        "schema", "state", "authorityCarrierCommit", "authorityCarrierTree",
        "authorityArtifact", "validatorArtifact", "cleanWorktreeReceiptSha256",
        "repository", "branch", "baseCommit", "baseTree", "testedCommit",
        "testedTree", "changedPaths", "changedArtifacts", "verificationCommands",
        "exitCodes", "securityEvidence", "verifiedAt", "verifiedBy",
    }
    closed(v, receipt, required, "targeted verification receipt")
    expected = {
        "schema": "dwp.hris.wave7.hrm013-auth-runtime-targeted-verification-receipt.v1",
        "state": "TRUSTED_EXACT_AUTH_RUNTIME_TREE_AND_TARGETED_TESTS_PASS",
        "authorityCarrierCommit": carrier,
        "authorityCarrierTree": text(FRONTEND, "rev-parse", f"{carrier}^{{tree}}"),
        "authorityArtifact": artifact(AUTHORITY_REL, blob(FRONTEND, carrier, AUTHORITY_REL) or b""),
        "validatorArtifact": artifact(VALIDATOR_REL, blob(FRONTEND, carrier, VALIDATOR_REL) or b""),
        "cleanWorktreeReceiptSha256": digest(clean_data), "repository": "dwp-backend",
        "branch": BRANCH, "baseCommit": BACKEND_BASE, "baseTree": BACKEND_BASE_TREE,
        "testedCommit": commit, "testedTree": text(BACKEND, "rev-parse", f"{commit}^{{tree}}"),
        "changedPaths": sorted(paths), "verificationCommands": VERIFICATION_COMMANDS,
        "exitCodes": [0] * len(VERIFICATION_COMMANDS),
        "verifiedBy": "TRUSTED_HRM013_AUTH_RUNTIME_TARGETED_VERIFICATION",
    }
    v.exact({key: receipt.get(key) for key in expected}, expected, "targeted evidence drift")
    artifacts = []
    for path in sorted(paths):
        data_at_commit = blob(BACKEND, commit, path)
        v.require(data_at_commit is not None, f"changed artifact absent: {path}")
        artifacts.append(artifact(path, data_at_commit or b""))
    v.exact(receipt.get("changedArtifacts"), artifacts, "changed artifact pins drift")
    security = receipt.get("securityEvidence")
    expected_security = {
        "defaultOff": True, "preReadTransportProofReplayGate": True,
        "atomicDualReplayReservation": True, "tenantRlsAndNoContextLeak": True,
        "opaqueProbeMissing": True, "databaseClockDrainAndReadiness": True,
        "gapFreeDrainActivityAndSharedLockOrder": True,
        "requesterExactActiveTenantIdentity": True,
        "dedicatedStepUpRouteCannotUseGenericApprove": True,
        "approvalPeopleTimePayrollRuntimeAbsent": True,
    }
    v.exact(security, expected_security, "security evidence drift")
    parse_time(receipt.get("verifiedAt"), "targeted verifiedAt")
    return receipt


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--authoring", action="store_true")
    parser.add_argument("--require-trusted", action="store_true")
    args = parser.parse_args()
    v = V()
    try:
        isolated = runtime(v, args.require_trusted or args.authoring)
        carrier = carrier_commit(v)
        check_carrier_content(v, carrier)
        v.exact(text(BACKEND, "rev-parse", BACKEND_BASE), BACKEND_BASE, "backend base missing")
        v.exact(text(BACKEND, "rev-parse", f"{BACKEND_BASE}^{{tree}}"), BACKEND_BASE_TREE, "backend base tree drift")
        for unsafe in ("../x", "/x", "a//b", "a/./b", "a\\b"):
            v.require(not canonical(unsafe), f"unsafe path accepted: {unsafe}")
        if carrier is None:
            v.require(args.authoring, "uncommitted carrier allowed only in authoring mode")
            v.exact(changes(FRONTEND), CARRIER_PATHS, "authoring carrier path drift")
            state = "AUTH_RUNTIME_AUTHORITY_CARRIER_READY_TO_COMMIT_AND_PUSH"
        else:
            v.require(run(FRONTEND, "merge-base", "--is-ancestor", carrier, "HEAD", check=False).returncode == 0, "carrier absent from frontend head")
            v.require(run(FRONTEND, "merge-base", "--is-ancestor", carrier, "origin/dwp-dev", check=False).returncode == 0, "carrier not pushed to frontend dwp-dev")
            if not WORKTREE.exists():
                v.require(not CLEAN_RECEIPT.exists(), "clean receipt exists without worktree")
                state = "AUTH_RUNTIME_AUTHORITY_CARRIER_PUSHED_CLEAN_WORKTREE_RECEIPT_REQUIRED"
            else:
                v.exact(text(WORKTREE, "rev-parse", "--show-toplevel"), str(WORKTREE), "worktree root drift")
                v.exact(text(WORKTREE, "branch", "--show-current"), BRANCH, "worktree branch drift")
                validate_clean_receipt(v, carrier)
                head = text(WORKTREE, "rev-parse", "HEAD")
                if head == BACKEND_BASE and not changes(WORKTREE):
                    state = "CLEAN_WORKTREE_READY_FOR_AUTH_RUNTIME"
                elif head == BACKEND_BASE:
                    validate_lane_paths(v, changes(WORKTREE))
                    v.require(not TARGETED_RECEIPT.exists(), "targeted receipt exists before commit")
                    state = "BOUNDED_AUTH_RUNTIME_LANE_IN_PROGRESS"
                else:
                    v.exact(text(WORKTREE, "rev-list", "--parents", "-n", "1", head).split(), [head, BACKEND_BASE], "runtime commit is not direct child")
                    v.exact(changes(WORKTREE), set(), "committed runtime worktree is dirty")
                    paths = between(WORKTREE, BACKEND_BASE, head)
                    validate_lane_paths(v, paths)
                    if not TARGETED_RECEIPT.exists():
                        state = "COMMITTED_AUTH_RUNTIME_TARGETED_VERIFICATION_RECEIPT_REQUIRED"
                    else:
                        validate_targeted(v, carrier, head, paths)
                        if not POST_RECEIPT.exists():
                            state = "VERIFIED_AUTH_RUNTIME_POST_IMPLEMENTATION_REVIEW_REQUIRED"
                        else:
                            post = load_json(receipt_bytes(v, POST_RECEIPT, "post implementation review"), "post implementation review")
                            expected_post = {
                                "schema": "dwp.hris.wave7.hrm013-auth-runtime-post-implementation-review.v1",
                                "state": "INDEPENDENTLY_REVIEWED_EXACT_AUTH_RUNTIME_TREE_BRANCH_PUSH_ONLY",
                                "authorityCarrierCommit": carrier,
                                "laneCommit": head, "laneTree": text(WORKTREE, "rev-parse", f"{head}^{{tree}}"),
                                "changedPaths": sorted(paths), "p0": 0, "p1": 0, "p2": 0,
                                "decision": "GO_FOR_AUTH_RUNTIME_LANE_BRANCH_PUSH_ONLY",
                                "reviewedBy": "INDEPENDENT_HRM013_AUTH_RUNTIME_POST_IMPLEMENTATION_REVIEW",
                            }
                            v.exact({key: post.get(key) for key in expected_post}, expected_post, "post review drift")
                            parse_time(post.get("reviewedAt"), "post reviewedAt")
                            parse_time(post.get("recordedAt"), "post recordedAt")
                            remote = run(BACKEND, "rev-parse", "--verify", f"refs/remotes/origin/{BRANCH}", check=False)
                            if remote.returncode or remote.stdout.decode().strip() != head:
                                state = "REVIEWED_AUTH_RUNTIME_LANE_PUSH_REQUIRED"
                            else:
                                state = "REVIEWED_AUTH_RUNTIME_LANE_PUSHED_DESCENDANT_GOVERNANCE_REQUIRED"
        print(f"PASS state={state} checks={v.checks} trusted_runtime={'true' if isolated else 'false'} receipt_issuance=external-only")
        return 0
    except (VerificationError, OSError, UnicodeError, KeyError, TypeError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
