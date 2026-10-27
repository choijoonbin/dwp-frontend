#!/usr/bin/env python3
"""Read-only fail-closed validator for the HRM-013 Approval readiness correction."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import stat
import subprocess
import sys
from datetime import datetime
from pathlib import Path, PurePosixPath
from typing import Any

SCRIPT = Path(__file__).absolute()
ROOT = SCRIPT.parents[5]
BACKEND = Path("/Users/a10697/Work/DWP/dwp-backend")
GIT = "/usr/bin/git"
FRONTEND_BASE = "3efa1e22243f37c9834a099dac32637191ac6f97"
FRONTEND_TREE = "f4a984a6b20ce8b3bb1b18b4afa39d5c6d573278"
BACKEND_BASE = "a1c0d8ecdbc959d378ef04dc401ee0ff2348ef6c"
BACKEND_TREE = "b2173c7448d2e88b5a7f9278f0084d591c4462bf"
APPROVAL_READINESS_COMMIT = "bed31127123a318358f495f66edced7b024469d8"
APPROVAL_READINESS_TREE = "e5564ff7a81e5dd0a85d0e61f091ec0714a1f777"
ORIGINAL_APPROVAL_COMMIT = "b9880ec6cf0ad65e08d86c6624ee2ac91a748716"
APPROVAL_RESEAL_COMMIT = "3970b26c111c0492d7a7b637b8153f7a6844318d"
APPROVAL_RESEAL_TREE = "3b6033339058ae684dafe94361bc653d28d6fe75"
APPROVAL_RESEAL_BRANCH = (
    "codex/hris-wave7-batch06-hrm013-approval-runtime-backend-20261027-r2"
)
GOVERNED_BACKEND_DESCENDANTS = {
    APPROVAL_READINESS_COMMIT: APPROVAL_READINESS_TREE,
    APPROVAL_RESEAL_COMMIT: APPROVAL_RESEAL_TREE,
}
CARRIER_BRANCH = "codex/hris-wave7-batch06-hrm013-approval-readiness-authority-frontend-20261027-r1"
LANE_BRANCH = "codex/hris-wave7-batch06-hrm013-approval-readiness-backend-20261027-r1"
LANE_WORKTREE = Path("/Users/a10697/Work/DWP/.codex-worktrees/hris/wave7-20261026/batch06/hrm013-owner-runtime/approval-readiness")
RECEIPT = Path("/Users/a10697/Work/DWP/.codex-worktrees/hris/wave7-20261026/batch06/hrm013-owner-runtime/receipts/approval-readiness-clean-worktree-receipt.v1.json")
DIR = "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-approval-readiness-authority-r1"
AUTHORITY = f"{DIR}/approval-readiness-execution-authority.v1.json"
TOKEN = f"{DIR}/tokens/approval-readiness.start-token.v1.json"
VALIDATOR = f"{DIR}/validate_hrm013_approval_readiness_authority.py"
REVIEW = f"{DIR}/independent-review.v1.json"
CARRIER_PATHS = {"package.json", AUTHORITY, TOKEN, VALIDATOR, REVIEW}
ALLOWLIST = [
    "dwp-approval-server/build.gradle",
    "dwp-approval-server/src/main/java/com/dwp/services/approval/security/ApprovalPepProjectionLoader.java",
    "dwp-approval-server/src/main/java/com/dwp/services/approval/security/ApprovalPepProjectionLineage.java",
    "dwp-approval-server/src/main/java/com/dwp/services/approval/security/ApprovalPilotPepRegistry.java",
    "dwp-approval-server/src/test/java/com/dwp/services/approval/security/ApprovalRelease62PepContractTest.java",
    "dwp-approval-server/src/test/java/com/dwp/services/approval/security/ApprovalRelease31PepContractTest.java",
    "dwp-approval-server/src/test/java/com/dwp/services/approval/security/ApprovalRelease32PepContractTest.java",
    "dwp-approval-server/src/test/java/com/dwp/services/approval/security/ApprovalExtensionV9PepRegistryTest.java",
]
SUCCESSOR_FIXTURE = (
    "dwp-auth-server/src/test/java/com/dwp/services/auth/service/"
    "ProductSurfaceStepUpRuntimeSpringFixture.java"
)
EFFECTIVE_ALLOWLIST = ALLOWLIST + [SUCCESSOR_FIXTURE]
TESTS = [
    "dwp-approval-server/src/test/java/com/dwp/services/approval/security/ApprovalRelease62PepContractTest.java",
    "dwp-approval-server/src/test/java/com/dwp/services/approval/security/ApprovalRelease31PepContractTest.java",
    "dwp-approval-server/src/test/java/com/dwp/services/approval/security/ApprovalRelease32PepContractTest.java",
    "dwp-approval-server/src/test/java/com/dwp/services/approval/security/ApprovalExtensionV9PepRegistryTest.java",
    "dwp-approval-server/src/test/java/com/dwp/services/approval/security/ApprovalPilotPepRegistryTest.java",
    "dwp-approval-server/src/crossServiceTest/java/com/dwp/services/approval/workflowauthority/WorkflowRuntimeActualAuthHttpTest.java",
]
COMMANDS = [
    "./gradlew :dwp-approval-server:compileJava :dwp-approval-server:compileTestJava :dwp-approval-server:compileCrossServiceTestJava",
    "./gradlew :dwp-approval-server:test --tests com.dwp.services.approval.security.ApprovalRelease62PepContractTest --tests com.dwp.services.approval.security.ApprovalRelease31PepContractTest --tests com.dwp.services.approval.security.ApprovalRelease32PepContractTest --tests com.dwp.services.approval.security.ApprovalExtensionV9PepRegistryTest --tests com.dwp.services.approval.security.ApprovalPilotPepRegistryTest",
    "./gradlew :dwp-approval-server:crossServiceTest --tests com.dwp.services.approval.workflowauthority.WorkflowRuntimeActualAuthHttpTest -Ddwp.workflow.cross-service-gate=true",
]
PREREQUISITES = [
    (Path("/Users/a10697/Work/DWP/.codex-worktrees/hris/wave7-20261026/batch06/hrm013-owner-runtime/receipts/auth-runtime-successor-delegation-authority.v1.json"), 7234, "b39a7f825996291d5c50e03f6e2335649ca9b2fb9c7b509b0e4268fa0c5bd0d9"),
    (Path("/Users/a10697/Work/DWP/.codex-worktrees/hris/wave7-20261026/batch06/hrm013-owner-runtime/receipts/backend-descendants/a1c0d8ecdbc959d378ef04dc401ee0ff2348ef6c.hrm013-shared-contract-governance.v1.json"), 9260, "88b33f889471fd7568b1c01e8c8231374a5d92bb4612b58716efd2faa8993bd4"),
]
GATE_PINS = [
    ("docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-owner-runtime-binding-gate-r1/hrm-013-owner-runtime-binding-gate.v1.json", 170804, "aa88b6116f2fa8ca4e96d85204414a737e763afa4e1bb01372e31fdaa59deb47"),
    ("docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-owner-runtime-binding-gate-r1/validate_hrm013_owner_runtime_binding_gate.py", 105034, "47387b5fa0f27be3e6e4944d0439678fc0b4f516ba0d97966bb958c2a9eb637b"),
]
PREVIOUS = "python3 docs/06-delivery/hris/tools/validate_current_authority.py && python3 docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-semantic-closure-r1/validate_hrm013_semantic_closure.py && python3 docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-callback-binding-r1/validate_hrm013_callback_binding.py && python3 docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-owner-runtime-binding-gate-r1/validate_hrm013_owner_runtime_binding_gate.py && python3 docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-runtime-contract-authority-r1/validate_hrm013_runtime_contract_authority.py && python3 docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-shared-contract-integration-r1/validate_hrm013_shared_contract_integration.py && python3 docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-auth-v62-generation-r1/validate_hrm013_auth_v62_generation_authority.py && python3 docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-auth-v62-generation-integration-r1/validate_hrm013_auth_v62_generation_integration.py && python3 docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-auth-v271-authority-r1/validate_hrm013_auth_v271_authority.py && python3 docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-auth-runtime-authority-r1/validate_hrm013_auth_runtime_authority.py"
CURRENT = PREVIOUS + " && python3 " + VALIDATOR
SUCCESSOR_VALIDATOR = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-approval-readiness-successor-r1/"
    "validate_hrm013_approval_readiness_successor.py"
)
SUCCESSOR_CURRENT = CURRENT + " && python3 " + SUCCESSOR_VALIDATOR
ENV = {"PATH": "/usr/bin:/bin", "LC_ALL": "C", "LANG": "C", "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": "/dev/null", "GIT_NO_REPLACE_OBJECTS": "1"}

class Error(RuntimeError): pass
class Check:
    def __init__(self): self.count = 0
    def require(self, value: bool, message: str):
        self.count += 1
        if not value: raise Error(message)
    def exact(self, actual: Any, expected: Any, message: str):
        self.count += 1
        if type(actual) is not type(expected) or actual != expected: raise Error(f"{message}: expected={expected!r} actual={actual!r}")

def git(repo: Path, *args: str, check: bool = True) -> str:
    result = subprocess.run([GIT, "-C", str(repo), *args], stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=ENV, check=False)
    if check and result.returncode: raise Error(result.stderr.decode(errors="replace").strip())
    return result.stdout.decode().strip()

def raw_git(repo: Path, *args: str) -> subprocess.CompletedProcess[bytes]:
    return subprocess.run([GIT, "-C", str(repo), *args], stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=ENV, check=False)

def sha(data: bytes) -> str: return hashlib.sha256(data).hexdigest()
def pin(path: str, data: bytes) -> dict[str, Any]: return {"path": path, "bytes": len(data), "sha256": sha(data)}

def load(path: Path) -> Any:
    def pairs(values):
        result = {}
        for key, value in values:
            if key in result: raise Error(f"duplicate JSON key: {key}")
            result[key] = value
        return result
    return json.loads(path.read_text(), object_pairs_hook=pairs)

def changed(repo: Path) -> set[str]:
    # Porcelain v1 uses the leading column for the index status.  Do not pass it
    # through git(), whose generic whitespace trimming would erase that column.
    output = raw_git(
        repo, "status", "--porcelain=v1", "--untracked-files=all"
    ).stdout.decode().rstrip("\n")
    return {line[3:] for line in output.splitlines() if line}

def diff_paths(repo: Path, older: str, newer: str) -> set[str]:
    return set(filter(None, git(repo, "diff", "--name-only", older, newer).splitlines()))

def validate_approval_reseal(c: Check) -> None:
    c.exact(
        git(BACKEND, "rev-list", "--parents", "-n", "1", ORIGINAL_APPROVAL_COMMIT).split(),
        [ORIGINAL_APPROVAL_COMMIT, APPROVAL_READINESS_COMMIT],
        "historical Approval commit topology",
    )
    c.exact(
        git(BACKEND, "rev-list", "--parents", "-n", "1", APPROVAL_RESEAL_COMMIT).split(),
        [APPROVAL_RESEAL_COMMIT, APPROVAL_READINESS_COMMIT],
        "Approval reseal topology",
    )
    c.exact(git(BACKEND, "rev-parse", f"{ORIGINAL_APPROVAL_COMMIT}^{{tree}}"), APPROVAL_RESEAL_TREE, "historical Approval tree")
    c.exact(git(BACKEND, "rev-parse", f"{APPROVAL_RESEAL_COMMIT}^{{tree}}"), APPROVAL_RESEAL_TREE, "Approval reseal tree")
    historical_paths = diff_paths(BACKEND, APPROVAL_READINESS_COMMIT, ORIGINAL_APPROVAL_COMMIT)
    reseal_paths = diff_paths(BACKEND, APPROVAL_READINESS_COMMIT, APPROVAL_RESEAL_COMMIT)
    c.exact(len(historical_paths), 45, "historical Approval path count")
    c.exact(reseal_paths, historical_paths, "Approval reseal changed paths")
    c.exact(diff_paths(BACKEND, ORIGINAL_APPROVAL_COMMIT, APPROVAL_RESEAL_COMMIT), set(), "Approval reseal content diff")
    c.exact(git(BACKEND, "rev-parse", f"origin/{APPROVAL_RESEAL_BRANCH}"), APPROVAL_RESEAL_COMMIT, "Approval reseal branch push")

def secure(c: Check, path: Path, size: int, digest: str):
    c.require(path.exists() and not path.is_symlink(), f"missing/symlinked prerequisite: {path}")
    info = path.stat()
    c.require(stat.S_ISREG(info.st_mode), f"not regular: {path}")
    c.exact(stat.S_IMODE(info.st_mode), 0o600, f"mode drift: {path}")
    c.exact(info.st_uid, os.getuid(), f"owner drift: {path}")
    c.exact(info.st_nlink, 1, f"link count drift: {path}")
    data = path.read_bytes(); c.exact(len(data), size, f"size drift: {path}"); c.exact(sha(data), digest, f"hash drift: {path}")

def carrier_commit(c: Check) -> str | None:
    values = list(filter(None, git(ROOT, "log", "--diff-filter=A", "--format=%H", "--", AUTHORITY).splitlines()))
    if not values: return None
    c.exact(len(values), 1, "ambiguous carrier")
    commit = values[0]
    c.exact(git(ROOT, "rev-list", "--parents", "-n", "1", commit).split(), [commit, FRONTEND_BASE], "carrier is not direct child")
    c.exact(diff_paths(ROOT, FRONTEND_BASE, commit), CARRIER_PATHS, "carrier path drift")
    return commit

def validate_content(c: Check, carrier: str | None):
    authority = load(ROOT / AUTHORITY); token = load(ROOT / TOKEN); review = load(ROOT / REVIEW); package = load(ROOT / "package.json")
    c.exact(authority["schema"], "dwp.hris.wave7.hrm013-approval-phase4-readiness-execution-authority.v1", "authority schema")
    c.exact(authority["lane"], "APPROVAL_PHASE4_READINESS_CORRECTION", "authority lane")
    c.exact(authority["carrier"]["branch"], CARRIER_BRANCH, "carrier branch")
    c.exact(authority["backendBase"]["commit"], BACKEND_BASE, "authority backend base")
    c.exact(authority["backendBase"]["tree"], BACKEND_TREE, "authority backend tree")
    c.exact(authority["authority"], {"independentReviewComplete": True, "carrierCommitAndPushAuthorized": True, "correctionAuthoringAuthorizedAfterMatchingCleanReceipt": True, "correctionBranchCommitAndPushAuthorizedAfterTargetedVerification": True, "newMigrationAuthorized": False, "approvalRuntimeImplementationAuthorized": False, "peopleOwnerRuntimeImplementationAuthorized": False, "directBackendDwpDevIntegrationAuthorized": False, "featureEnablementAuthorized": False, "tenantEnrollmentAuthorized": False, "runtimeCredentialBindingAuthorized": False, "productionReleaseAuthorized": False, "businessCompletionCredit": 0}, "authority flags")
    c.exact(token["lane"], "APPROVAL_PHASE4_READINESS_CORRECTION", "token lane")
    c.exact(token["backend"], {"repository": "dwp-backend", "branch": LANE_BRANCH, "worktree": str(LANE_WORKTREE), "baseCommit": BACKEND_BASE, "baseTree": BACKEND_TREE, "originDwpDevCommit": BACKEND_BASE}, "token backend")
    c.exact(token["exactChangedPathAllowlist"], ALLOWLIST, "token allowlist")
    c.exact(token["exactTargetTestPaths"], TESTS, "token tests")
    c.exact(token["verificationCommands"], COMMANDS, "token commands")
    c.exact(token["securityBoundary"], {"newMigrationAuthorized": False, "runtimeImplementationAuthorized": False, "featureEnablementAuthorized": False, "tenantEnrollmentAuthorized": False, "runtimeCredentialBindingAuthorized": False, "directDwpDevIntegrationAuthorized": False, "productionReleaseAuthorized": False}, "token boundary")
    current_command = package["scripts"]["hris:current-contracts:check"]
    expected_parts = SUCCESSOR_CURRENT.split(" && ")
    current_parts = current_command.split(" && ")
    c.exact(current_parts[:len(expected_parts)], expected_parts, "readiness package prefix")
    c.exact(len(current_parts), len(set(current_parts)), "duplicate package validator command")
    for command in current_parts[len(expected_parts):]:
        match = re.fullmatch(
            r"python3 (docs/06-delivery/hris/[A-Za-z0-9._/-]+/validate_[A-Za-z0-9_]+\.py)",
            command,
        )
        c.require(match is not None, "non-validator package suffix")
        path = match.group(1)
        parsed = PurePosixPath(path)
        c.require(
            not parsed.is_absolute() and parsed.as_posix() == path
            and all(part not in {"", ".", ".."} for part in parsed.parts)
            and path.startswith("docs/06-delivery/hris/")
            and parsed.name.startswith("validate_") and path.endswith(".py"),
            f"non-canonical package validator suffix: {path}",
        )
        candidate = ROOT / path
        c.require(candidate.is_file() and not candidate.is_symlink(), f"missing package validator: {path}")
        c.require(
            raw_git(ROOT, "ls-files", "--error-unmatch", "--", path).returncode == 0,
            f"untracked package validator: {path}",
        )
    c.require("prehris:current-contracts:check" not in package["scripts"], "npm pre hook is forbidden")
    c.require("posthris:current-contracts:check" not in package["scripts"], "npm post hook is forbidden")
    c.exact(
        current_command.split(" && ").count("python3 " + SUCCESSOR_VALIDATOR),
        1,
        "readiness successor validator occurrence count",
    )
    source = lambda path: (ROOT / path).read_bytes() if carrier is None else raw_git(ROOT, "show", f"{carrier}:{path}").stdout
    expected_pins = [pin(path, source(path)) for path in (AUTHORITY, TOKEN, VALIDATOR, "package.json")]
    c.exact(review["artifactPins"], expected_pins, "review pins")
    c.exact(review["finalVerdict"], {"p0": 0, "p1": 0, "p2": 0, "decision": "GO_FOR_APPROVAL_PHASE4_READINESS_AUTHORITY_CARRIER_COMMIT_AND_PUSH_ONLY"}, "review verdict")
    datetime.fromisoformat(review["reviewedAt"].replace("Z", "+00:00"))

def validate_receipt(c: Check, carrier: str):
    secure(c, RECEIPT, RECEIPT.stat().st_size, sha(RECEIPT.read_bytes()))
    value = load(RECEIPT)
    c.exact(value["schema"], "dwp.hris.wave7.hrm013-approval-readiness-clean-worktree-receipt.v1", "receipt schema")
    c.exact(value["state"], "HASH_BOUND_FRESH_CLEAN_APPROVAL_READINESS_WORKTREE_RECEIPT", "receipt state")
    c.exact(value["authorityCarrierCommit"], carrier, "receipt carrier")
    c.exact(value["repository"], "dwp-backend", "receipt repo")
    c.exact(value["worktreeRoot"], str(LANE_WORKTREE), "receipt worktree")
    c.exact(value["branch"], LANE_BRANCH, "receipt branch")
    for field, expected in (("baseCommit", BACKEND_BASE), ("baseTree", BACKEND_TREE), ("headCommit", BACKEND_BASE), ("headTree", BACKEND_TREE), ("originDwpDevCommit", BACKEND_BASE), ("porcelainV2", "")):
        c.exact(value[field], expected, f"receipt {field}")

def main() -> int:
    parser = argparse.ArgumentParser(); parser.add_argument("--authoring", action="store_true"); args = parser.parse_args(); c = Check()
    try:
        c.exact(git(ROOT, "rev-parse", f"{FRONTEND_BASE}^{{tree}}"), FRONTEND_TREE, "frontend base tree")
        c.exact(git(BACKEND, "rev-parse", f"{BACKEND_BASE}^{{tree}}"), BACKEND_TREE, "backend base tree")
        for path, size, digest in PREREQUISITES: secure(c, path, size, digest)
        for path, size, digest in GATE_PINS:
            data = (ROOT / path).read_bytes(); c.exact(len(data), size, f"gate size {path}"); c.exact(sha(data), digest, f"gate hash {path}")
        carrier = carrier_commit(c); validate_content(c, carrier)
        c.exact(git(BACKEND, "branch", "--show-current"), "dwp-dev", "backend branch")
        backend_head = git(BACKEND, "rev-parse", "HEAD")
        backend_origin = git(BACKEND, "rev-parse", "origin/dwp-dev")
        c.exact(backend_origin, backend_head, "backend origin")
        validate_approval_reseal(c)
        allowed_heads = GOVERNED_BACKEND_DESCENDANTS
        c.require(backend_head in allowed_heads, "backend head is not an exact governed descendant")
        c.exact(
            git(BACKEND, "rev-parse", f"{backend_head}^{{tree}}"),
            allowed_heads[backend_head],
            "backend governed head tree",
        )
        c.exact(changed(BACKEND), set(), "backend dirty")
        if carrier is None:
            c.require(args.authoring, "uncommitted carrier requires --authoring")
            c.exact(git(ROOT, "rev-parse", "HEAD"), FRONTEND_BASE, "authoring head")
            c.exact(git(ROOT, "branch", "--show-current"), CARRIER_BRANCH, "authoring branch")
            c.exact(changed(ROOT), CARRIER_PATHS, "authoring paths")
            c.require(not LANE_WORKTREE.exists() and not RECEIPT.exists(), "lane exists before carrier push")
            state = "APPROVAL_PHASE4_READINESS_AUTHORITY_CARRIER_READY_TO_COMMIT_AND_PUSH"
        else:
            c.require(raw_git(ROOT, "merge-base", "--is-ancestor", carrier, "origin/dwp-dev").returncode == 0, "carrier not pushed")
            if not LANE_WORKTREE.exists():
                c.require(not RECEIPT.exists(), "receipt without worktree")
                state = "APPROVAL_PHASE4_READINESS_CLEAN_WORKTREE_REQUIRED"
            else:
                c.exact(git(LANE_WORKTREE, "branch", "--show-current"), LANE_BRANCH, "lane branch")
                validate_receipt(c, carrier)
                head = git(LANE_WORKTREE, "rev-parse", "HEAD")
                committed = diff_paths(LANE_WORKTREE, BACKEND_BASE, head) if head != BACKEND_BASE else set()
                current = changed(LANE_WORKTREE); paths = committed | current
                c.require(
                    paths.issubset(set(EFFECTIVE_ALLOWLIST)),
                    "lane path outside exact successor allowlist",
                )
                c.require(not any("/db/migration/" in path for path in paths), "migration authored")
                if not paths: state = "CLEAN_WORKTREE_READY_FOR_APPROVAL_PHASE4_READINESS_CORRECTION"
                elif current: state = "BOUNDED_APPROVAL_PHASE4_READINESS_CORRECTION_IN_PROGRESS"
                else:
                    c.exact(
                        paths,
                        set(EFFECTIVE_ALLOWLIST),
                        "committed correction must change exact nine successor paths",
                    )
                    state = "COMMITTED_APPROVAL_PHASE4_READINESS_CORRECTION_REVIEW_REQUIRED"
        print(f"PASS state={state} checks={c.count} receipt_issuance=external-only"); return 0
    except (Error, OSError, KeyError, ValueError, json.JSONDecodeError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr); return 1

if __name__ == "__main__": raise SystemExit(main())
