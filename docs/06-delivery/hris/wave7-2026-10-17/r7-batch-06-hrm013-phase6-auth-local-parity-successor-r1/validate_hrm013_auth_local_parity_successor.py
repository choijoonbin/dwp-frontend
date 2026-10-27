#!/usr/bin/env python3
"""Fail-closed validator for the HRM-013 AUTH local-parity successor authority."""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[5]
HERE = Path(__file__).resolve().parent
AUTHORITY_PATH = HERE / "auth-local-parity-successor-authority.v1.json"
REVIEW_PATH = HERE / "independent-review.v1.json"
BASE = "f4360ac8fc48aa187ce533b5a6965a91fcddeee4"
BASE_TREE = "54beb79aca0712eff89843165df238327fc81e15"
BACKEND = Path("/Users/a10697/Work/DWP/dwp-backend")
BACKEND_BASE = "8ccc7baeff43b60dc6cdf719449514f56b6dbca5"
BACKEND_TREE = "f17b244d9d47da035dfe09f7c9a604796f19eb74"
AUTH_BRANCH = "codex/hris-wave7-batch06-hrm013-phase6-auth-backend-20261027-r1"
ORIGINAL_AUTH_COMMIT = "b70b0def784ed8ffe49cf0d5c6fbe60effe559dc"
ORIGINAL_AUTH_TREE = "73b6b370769e29f7ed69be03d137c4033ce465bc"
AUTH_WORKTREE = Path("/Users/a10697/Work/DWP/.codex-worktrees/hris/wave7-20261027/batch06/hrm013-phase6/auth")
ARTIFACTS = {
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-phase6-auth-local-parity-successor-r1/auth-local-parity-successor-authority.v1.json",
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-phase6-auth-local-parity-successor-r1/independent-review.v1.json",
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-phase6-auth-local-parity-successor-r1/validate_hrm013_auth_local_parity_successor.py",
}


def run(repo: Path, *args: str) -> str:
    result = subprocess.run(["git", "-C", str(repo), *args], text=True, capture_output=True)
    if result.returncode:
        raise AssertionError(f"git {' '.join(args)} failed: {result.stderr.strip()}")
    return result.stdout.rstrip()


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def status_paths(repo: Path) -> set[str]:
    paths: set[str] = set()
    for line in run(repo, "status", "--porcelain=v1", "-uall").splitlines():
        if not line:
            continue
        path = line[3:]
        if " -> " in path:
            path = path.split(" -> ", 1)[1]
        paths.add(path)
    return paths


def assert_equal(actual, expected, label: str) -> None:
    if actual != expected:
        raise AssertionError(f"{label}: expected={expected!r} actual={actual!r}")


def main() -> int:
    checks = 0
    authority = json.loads(AUTHORITY_PATH.read_text())
    review = json.loads(REVIEW_PATH.read_text())

    expected_scalars = {
        "schema": "dwp.hris.wave7.hrm013-auth-local-parity-successor-authority.v1",
        "state": "INDEPENDENTLY_REVIEWED_HASH_BOUND_AUTH_LOCAL_PARITY_SUCCESSOR_AUTHORITY",
        "sliceId": "BASE-TFR-HRM-013",
        "lane": "AUTH_IDENTITY_TASK_OWNER_LOCAL_DRAIN_PARITY_REMEDIATION",
    }
    for key, value in expected_scalars.items():
        assert_equal(authority[key], value, key)
        checks += 1

    assert_equal(authority["carrier"]["baseCommit"], BASE, "carrier base")
    assert_equal(authority["carrier"]["baseTree"], BASE_TREE, "carrier base tree")
    assert_equal(authority["carrier"]["exactChangedPathCount"], 3, "carrier path count")
    assert authority["carrier"]["packageJsonModificationAuthorized"] is False
    checks += 4

    for pin in authority["predecessorAuthorityPins"]:
        path = ROOT / pin["path"]
        assert path.is_file(), f"missing predecessor pin: {path}"
        assert_equal(path.stat().st_size, pin["bytes"], f"bytes {pin['path']}")
        assert_equal(sha256(path), pin["sha256"], f"sha256 {pin['path']}")
        checks += 3

    assert_equal(run(ROOT, "rev-parse", f"{BASE}^{{tree}}"), BASE_TREE, "frontend base tree")
    head = run(ROOT, "rev-parse", "HEAD")
    origin = run(ROOT, "rev-parse", "origin/dwp-dev")
    dirty = status_paths(ROOT)
    if head == BASE:
        assert_equal(origin, BASE, "authoring origin/dwp-dev")
        assert_equal(dirty, ARTIFACTS, "authoring exact dirty paths")
    else:
        assert run(ROOT, "merge-base", "--is-ancestor", BASE, head) == ""
        assert_equal(run(ROOT, "rev-list", "--count", f"{BASE}..{head}"), "1", "carrier direct-child count")
        assert_equal(set(run(ROOT, "diff", "--name-only", f"{BASE}..{head}").splitlines()), ARTIFACTS, "carrier exact paths")
        assert_equal(dirty, set(), "carrier worktree clean")
        if origin not in {BASE, head}:
            raise AssertionError(f"unexpected frontend origin/dwp-dev: {origin}")
    checks += 5

    assert_equal(run(BACKEND, "rev-parse", "dwp-dev"), BACKEND_BASE, "backend dwp-dev")
    assert_equal(run(BACKEND, "rev-parse", "origin/dwp-dev"), BACKEND_BASE, "backend origin/dwp-dev")
    assert_equal(run(BACKEND, "rev-parse", f"{BACKEND_BASE}^{{tree}}"), BACKEND_TREE, "backend base tree")
    checks += 3

    original_paths = set(authority["originalExactChangedPaths"])
    additional_paths = set(authority["successorExactAdditionalPaths"])
    assert_equal(len(original_paths), 17, "original path count")
    assert_equal(len(additional_paths), 4, "successor path count")
    assert original_paths.isdisjoint(additional_paths)
    expected_final = original_paths | additional_paths
    assert_equal(authority["targetedVerification"]["exactFinalDiffPathCount"], 21, "final path count")
    checks += 4

    branch_tip = run(BACKEND, "rev-parse", AUTH_BRANCH)
    remote_tip = run(BACKEND, "ls-remote", "origin", f"refs/heads/{AUTH_BRANCH}").split()[0]
    assert_equal(branch_tip, remote_tip, "AUTH branch remote parity")
    assert run(BACKEND, "merge-base", "--is-ancestor", BACKEND_BASE, branch_tip) == ""
    branch_paths = set(run(BACKEND, "diff", "--name-only", f"{BACKEND_BASE}..{branch_tip}").splitlines())
    if branch_tip == ORIGINAL_AUTH_COMMIT:
        assert_equal(run(BACKEND, "rev-parse", f"{branch_tip}^{{tree}}"), ORIGINAL_AUTH_TREE, "original AUTH tree")
        assert_equal(branch_paths, original_paths, "original AUTH path boundary")
    else:
        assert_equal(branch_paths, expected_final, "successor AUTH path boundary")
    checks += 5

    worktree_dirty = status_paths(AUTH_WORKTREE)
    unexpected_dirty = worktree_dirty - expected_final
    assert_equal(unexpected_dirty, set(), "AUTH worktree dirty-path boundary")
    checks += 1

    forbidden_true = [
        "newMigrationAuthorized",
        "migrationReservationChangeAuthorized",
        "peopleHandshakeTestAuthorizedBeforeTimeAndPayrollIntegration",
        "otherModuleSourceOrTestAuthoringAuthorized",
        "frontendUiMenuOrRouteAuthorized",
        "featureEnablementAuthorized",
        "tenantEnrollmentAuthorized",
        "runtimeCredentialProvisioningAuthorized",
        "liveNetworkHandshakeAuthorized",
        "productionBindingAuthorized",
        "productionReleaseAuthorized",
    ]
    for key in forbidden_true:
        assert authority["authority"][key] is False, f"forbidden authority enabled: {key}"
        checks += 1
    assert_equal(authority["authority"]["businessCompletionCredit"], 0, "business completion credit")
    assert authority["targetedVerification"]["broadRepositoryRerunAuthorized"] is False
    checks += 2

    assert_equal(review["schema"], "dwp.hris.wave7.hrm013-auth-local-parity-successor-independent-review.v1", "review schema")
    assert_equal(review["decision"], "GO_FOR_EXACT_FOUR_PATH_AUTH_LOCAL_PARITY_REMEDIATION_ONLY", "review decision")
    assert_equal(review["severityCounts"], {"P0": 0, "P1": 0, "P2": 0}, "review severity counts")
    assert_equal(review["authorityPin"]["sha256"], sha256(AUTHORITY_PATH), "review authority hash")
    assert_equal(review["authorityPin"]["bytes"], AUTHORITY_PATH.stat().st_size, "review authority bytes")
    checks += 5

    print(f"PASS HRM-013 AUTH local-parity successor authority: checks={checks}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (AssertionError, KeyError, json.JSONDecodeError, IndexError) as exc:
        print(f"FAIL HRM-013 AUTH local-parity successor authority: {exc}", file=sys.stderr)
        raise SystemExit(1)
