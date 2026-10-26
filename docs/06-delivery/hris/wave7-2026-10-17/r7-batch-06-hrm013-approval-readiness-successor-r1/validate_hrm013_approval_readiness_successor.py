#!/usr/bin/env python3
"""Fail-closed validator for the single-path Approval readiness successor."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import stat
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any


SCRIPT = Path(__file__).absolute()
ROOT = SCRIPT.parents[5]
BACKEND = Path("/Users/a10697/Work/DWP/dwp-backend")
LANE = Path(
    "/Users/a10697/Work/DWP/.codex-worktrees/hris/wave7-20261026/"
    "batch06/hrm013-owner-runtime/approval-readiness"
)
RECEIPT = Path(
    "/Users/a10697/Work/DWP/.codex-worktrees/hris/wave7-20261026/"
    "batch06/hrm013-owner-runtime/receipts/"
    "approval-readiness-clean-worktree-receipt.v1.json"
)
GIT = "/usr/bin/git"
FRONTEND_BASE = "81df5a94b625a155dd8b0c6bc9d8cfb54e1a1b20"
FRONTEND_TREE = "1b30154e25a00a2bf2b2c910fb3a01d9861441fd"
BACKEND_BASE = "a1c0d8ecdbc959d378ef04dc401ee0ff2348ef6c"
BACKEND_TREE = "b2173c7448d2e88b5a7f9278f0084d591c4462bf"
LANE_COMMIT = "bed31127123a318358f495f66edced7b024469d8"
LANE_TREE = "e5564ff7a81e5dd0a85d0e61f091ec0714a1f777"
CARRIER_BRANCH = (
    "codex/hris-wave7-batch06-hrm013-approval-readiness-"
    "successor-frontend-20261027-r1"
)
LANE_BRANCH = (
    "codex/hris-wave7-batch06-hrm013-approval-readiness-backend-20261027-r1"
)
DIR = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-approval-readiness-successor-r1"
)
AUTHORITY = f"{DIR}/approval-readiness-allowlist-successor.v1.json"
TOKEN = f"{DIR}/tokens/approval-readiness-successor.start-token.v1.json"
VALIDATOR = f"{DIR}/validate_hrm013_approval_readiness_successor.py"
REVIEW = f"{DIR}/independent-review.v1.json"
INTEGRATION_VALIDATOR = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-approval-readiness-integration-r1/"
    "validate_hrm013_approval_readiness_integration.py"
)
PREDECESSOR_VALIDATOR = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-approval-readiness-authority-r1/"
    "validate_hrm013_approval_readiness_authority.py"
)
CARRIER_PATHS = {
    "package.json", AUTHORITY, TOKEN, VALIDATOR, REVIEW, PREDECESSOR_VALIDATOR,
}
ALLOWLIST = [
    "dwp-approval-server/build.gradle",
    "dwp-approval-server/src/main/java/com/dwp/services/approval/security/ApprovalPepProjectionLoader.java",
    "dwp-approval-server/src/main/java/com/dwp/services/approval/security/ApprovalPepProjectionLineage.java",
    "dwp-approval-server/src/main/java/com/dwp/services/approval/security/ApprovalPilotPepRegistry.java",
    "dwp-approval-server/src/test/java/com/dwp/services/approval/security/ApprovalRelease62PepContractTest.java",
    "dwp-approval-server/src/test/java/com/dwp/services/approval/security/ApprovalRelease31PepContractTest.java",
    "dwp-approval-server/src/test/java/com/dwp/services/approval/security/ApprovalRelease32PepContractTest.java",
    "dwp-approval-server/src/test/java/com/dwp/services/approval/security/ApprovalExtensionV9PepRegistryTest.java",
    "dwp-auth-server/src/test/java/com/dwp/services/auth/service/ProductSurfaceStepUpRuntimeSpringFixture.java",
]
COMMANDS = [
    "./gradlew :dwp-approval-server:compileJava :dwp-approval-server:compileTestJava :dwp-approval-server:compileCrossServiceTestJava",
    "./gradlew :dwp-approval-server:test --tests com.dwp.services.approval.security.ApprovalRelease62PepContractTest --tests com.dwp.services.approval.security.ApprovalRelease31PepContractTest --tests com.dwp.services.approval.security.ApprovalRelease32PepContractTest --tests com.dwp.services.approval.security.ApprovalExtensionV9PepRegistryTest --tests com.dwp.services.approval.security.ApprovalPilotPepRegistryTest",
    "./gradlew :dwp-approval-server:crossServiceTest --tests com.dwp.services.approval.workflowauthority.WorkflowRuntimeActualAuthHttpTest -Ddwp.workflow.cross-service-gate=true",
]
RECEIPT_BYTES = 2405
RECEIPT_SHA256 = "742f915679ae79abf00c0316afe19b3eb47b25fb48c69cbaf7f14bfe8a9eebf5"
ENV = {
    "PATH": "/usr/bin:/bin", "LC_ALL": "C", "LANG": "C",
    "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": "/dev/null",
    "GIT_NO_REPLACE_OBJECTS": "1",
}


class Error(RuntimeError):
    pass


class Check:
    def __init__(self) -> None:
        self.count = 0

    def require(self, value: bool, message: str) -> None:
        self.count += 1
        if not value:
            raise Error(message)

    def exact(self, actual: Any, expected: Any, message: str) -> None:
        self.count += 1
        if type(actual) is not type(expected) or actual != expected:
            raise Error(f"{message}: expected={expected!r} actual={actual!r}")


def run(repo: Path, *args: str) -> subprocess.CompletedProcess[bytes]:
    return subprocess.run(
        [GIT, "-C", str(repo), *args], stdout=subprocess.PIPE,
        stderr=subprocess.PIPE, env=ENV, check=False,
    )


def text(repo: Path, *args: str) -> str:
    result = run(repo, *args)
    if result.returncode:
        raise Error(result.stderr.decode(errors="replace").strip())
    return result.stdout.decode().strip()


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def pin(path: str, data: bytes) -> dict[str, Any]:
    return {"path": path, "bytes": len(data), "sha256": sha(data)}


def load(path: Path) -> Any:
    def pairs(values: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in values:
            if key in result:
                raise Error(f"duplicate JSON key: {key}")
            result[key] = value
        return result
    return json.loads(path.read_text(), object_pairs_hook=pairs)


def changed(repo: Path) -> set[str]:
    output = run(repo, "status", "--porcelain=v1", "--untracked-files=all")
    if output.returncode:
        raise Error(output.stderr.decode(errors="replace").strip())
    return {line[3:] for line in output.stdout.decode().rstrip("\n").splitlines() if line}


def diff_paths(repo: Path, older: str, newer: str) -> set[str]:
    return set(filter(None, text(repo, "diff", "--name-only", older, newer).splitlines()))


def secure_receipt(c: Check) -> None:
    c.require(RECEIPT.exists() and not RECEIPT.is_symlink(), "clean receipt missing or symlinked")
    info = RECEIPT.stat()
    c.require(stat.S_ISREG(info.st_mode), "clean receipt is not regular")
    c.exact(stat.S_IMODE(info.st_mode), 0o600, "clean receipt mode")
    c.exact(info.st_uid, os.getuid(), "clean receipt owner")
    c.exact(info.st_nlink, 1, "clean receipt link count")
    data = RECEIPT.read_bytes()
    c.exact(len(data), RECEIPT_BYTES, "clean receipt bytes")
    c.exact(sha(data), RECEIPT_SHA256, "clean receipt hash")
    value = load(RECEIPT)
    c.exact(value["authorityCarrierCommit"], FRONTEND_BASE, "clean receipt carrier")
    c.exact(value["baseCommit"], BACKEND_BASE, "clean receipt base")
    c.exact(value["branch"], LANE_BRANCH, "clean receipt branch")
    c.exact(value["porcelainV2"], "", "clean receipt porcelain")


def carrier_commit(c: Check) -> str | None:
    additions = list(filter(None, text(
        ROOT, "log", "--diff-filter=A", "--format=%H", "--", AUTHORITY
    ).splitlines()))
    if not additions:
        return None
    c.exact(len(additions), 1, "ambiguous successor carrier")
    commit = additions[0]
    c.exact(
        text(ROOT, "rev-list", "--parents", "-n", "1", commit).split(),
        [commit, FRONTEND_BASE], "successor carrier is not a direct child",
    )
    c.exact(diff_paths(ROOT, FRONTEND_BASE, commit), CARRIER_PATHS, "carrier paths")
    return commit


def validate_content(c: Check, carrier: str | None) -> None:
    authority = load(ROOT / AUTHORITY)
    token = load(ROOT / TOKEN)
    review = load(ROOT / REVIEW)
    package = load(ROOT / "package.json")
    base_package = json.loads(run(ROOT, "show", f"{FRONTEND_BASE}:package.json").stdout)
    expected_command = (
        base_package["scripts"]["hris:current-contracts:check"]
        + " && python3 " + VALIDATOR
        + " && python3 " + INTEGRATION_VALIDATOR
    )
    c.exact(
        package["scripts"]["hris:current-contracts:check"],
        expected_command, "package successor chain",
    )
    c.exact(authority["lane"], "APPROVAL_PHASE4_READINESS_CORRECTION", "authority lane")
    c.exact(authority["predecessor"]["commit"], FRONTEND_BASE, "authority predecessor")
    c.exact(authority["carrier"]["branch"], CARRIER_BRANCH, "authority branch")
    c.exact(authority["carrier"]["exactChangedPathCount"], 6, "authority path count")
    c.exact(token["exactChangedPathAllowlist"], ALLOWLIST, "successor allowlist")
    c.exact(token["verificationCommands"], COMMANDS, "successor commands")
    c.exact(
        token["additionalPathContract"]["requiredImplementation"],
        "new TenantFeatureActivationRepository(jdbc)", "fixture implementation",
    )
    source = lambda path: (
        (ROOT / path).read_bytes() if carrier is None
        else run(ROOT, "show", f"{carrier}:{path}").stdout
    )
    expected_pins = [
        pin(path, source(path))
        for path in (AUTHORITY, TOKEN, VALIDATOR, PREDECESSOR_VALIDATOR, "package.json")
    ]
    c.exact(review["artifactPins"], expected_pins, "review pins")
    c.exact(
        review["finalVerdict"],
        {"p0": 0, "p1": 0, "p2": 0,
         "decision": "GO_FOR_APPROVAL_READINESS_ALLOWLIST_SUCCESSOR_CARRIER_ONLY"},
        "review verdict",
    )
    datetime.fromisoformat(review["reviewedAt"].replace("Z", "+00:00"))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--authoring", action="store_true")
    args = parser.parse_args()
    c = Check()
    try:
        c.exact(text(ROOT, "rev-parse", f"{FRONTEND_BASE}^{{tree}}"), FRONTEND_TREE, "frontend base tree")
        c.exact(text(BACKEND, "rev-parse", f"{BACKEND_BASE}^{{tree}}"), BACKEND_TREE, "backend base tree")
        secure_receipt(c)
        carrier = carrier_commit(c)
        validate_content(c, carrier)
        if carrier is None:
            c.require(args.authoring, "uncommitted successor requires --authoring")
            c.exact(text(ROOT, "rev-parse", "HEAD"), FRONTEND_BASE, "authoring head")
            c.exact(text(ROOT, "branch", "--show-current"), CARRIER_BRANCH, "authoring branch")
            c.exact(changed(ROOT), CARRIER_PATHS, "authoring paths")
            state = "APPROVAL_READINESS_ALLOWLIST_SUCCESSOR_READY_TO_COMMIT_AND_PUSH"
        else:
            c.require(
                run(ROOT, "merge-base", "--is-ancestor", carrier, "origin/dwp-dev").returncode == 0,
                "successor carrier not pushed to frontend dwp-dev",
            )
            c.exact(text(LANE, "branch", "--show-current"), LANE_BRANCH, "lane branch")
            lane_head = text(LANE, "rev-parse", "HEAD")
            c.require(lane_head in {BACKEND_BASE, LANE_COMMIT}, "unexpected lane head")
            if lane_head == BACKEND_BASE:
                paths = changed(LANE)
                c.require(paths.issubset(set(ALLOWLIST)), "backend path outside successor allowlist")
                c.require(not any("/db/migration/" in path for path in paths), "migration authored")
                state = (
                    "APPROVAL_READINESS_SUCCESSOR_READY_FOR_FIXTURE_CORRECTION"
                    if len(paths) == 8 else
                    "BOUNDED_APPROVAL_READINESS_SUCCESSOR_IN_PROGRESS"
                )
            else:
                c.exact(text(LANE, "rev-parse", f"{LANE_COMMIT}^{{tree}}"), LANE_TREE, "lane tree")
                c.exact(
                    text(LANE, "rev-list", "--parents", "-n", "1", LANE_COMMIT).split(),
                    [LANE_COMMIT, BACKEND_BASE], "lane commit is not direct child",
                )
                c.exact(changed(LANE), set(), "committed lane is dirty")
                c.exact(diff_paths(LANE, BACKEND_BASE, LANE_COMMIT), set(ALLOWLIST), "lane committed paths")
                c.exact(
                    text(BACKEND, "rev-parse", f"origin/{LANE_BRANCH}"),
                    LANE_COMMIT, "lane branch is not pushed",
                )
                backend_head = text(BACKEND, "rev-parse", "HEAD")
                backend_origin = text(BACKEND, "rev-parse", "origin/dwp-dev")
                c.require(backend_head in {BACKEND_BASE, LANE_COMMIT}, "unexpected backend dwp-dev head")
                c.exact(backend_origin, backend_head, "backend dwp-dev origin drift")
                state = (
                    "REVIEWED_APPROVAL_READINESS_BRANCH_PUSHED_INTEGRATION_AUTHORITY_REQUIRED"
                    if backend_head == BACKEND_BASE else
                    "APPROVAL_READINESS_CORRECTION_INTEGRATED"
                )
        print(f"PASS state={state} checks={c.count} receipt_issuance=external-only")
        return 0
    except (Error, OSError, KeyError, ValueError, json.JSONDecodeError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
