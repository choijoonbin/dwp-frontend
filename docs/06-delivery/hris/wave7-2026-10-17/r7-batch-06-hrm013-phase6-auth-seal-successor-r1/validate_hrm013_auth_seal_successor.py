#!/usr/bin/env python3
"""Fail-closed validator for the HRM-013 AUTH seal successor authority."""
from __future__ import annotations
import hashlib, json, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[5]
HERE = Path(__file__).resolve().parent
AUTHORITY = HERE / "auth-seal-successor-authority.v1.json"
REVIEW = HERE / "independent-review.v1.json"
BASE = "d54fb1d200e0aa4721ce637f4a97b5eb471f5813"
BASE_TREE = "5cf25da5e32ce8c924c086bbbad143ee3e67d184"
BACKEND = Path("/Users/a10697/Work/DWP/dwp-backend")
BACKEND_BASE = "8ccc7baeff43b60dc6cdf719449514f56b6dbca5"
BACKEND_TREE = "f17b244d9d47da035dfe09f7c9a604796f19eb74"
AUTH_WORKTREE = Path("/Users/a10697/Work/DWP/.codex-worktrees/hris/wave7-20261027/batch06/hrm013-phase6/auth")
AUTH_BRANCH = "codex/hris-wave7-batch06-hrm013-phase6-auth-backend-20261027-r1"
REVIEWED_AUTH = "0a8faf23386966b861cf019d306a1cfbd3e6c3fb"
REVIEWED_TREE = "72832d470c1c0f9dda08e776e7de435e2b1aad87"
ARTIFACTS = {
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-phase6-auth-seal-successor-r1/auth-seal-successor-authority.v1.json",
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-phase6-auth-seal-successor-r1/independent-review.v1.json",
    "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-phase6-auth-seal-successor-r1/validate_hrm013_auth_seal_successor.py",
}

def run(repo: Path, *args: str) -> str:
    result = subprocess.run(["git", "-C", str(repo), *args], text=True, capture_output=True)
    if result.returncode:
        raise AssertionError(f"git {' '.join(args)} failed: {result.stderr.strip()}")
    return result.stdout.rstrip()

def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def status_paths(repo: Path) -> set[str]:
    paths = set()
    for line in run(repo, "status", "--porcelain=v1", "-uall").splitlines():
        if line:
            path = line[3:].split(" -> ")[-1]
            paths.add(path)
    return paths

def equal(actual, expected, label: str) -> None:
    if actual != expected:
        raise AssertionError(f"{label}: expected={expected!r} actual={actual!r}")

def main() -> int:
    checks = 0
    authority = json.loads(AUTHORITY.read_text())
    review = json.loads(REVIEW.read_text())
    equal(authority["schema"], "dwp.hris.wave7.hrm013-auth-seal-successor-authority.v1", "schema")
    equal(authority["state"], "INDEPENDENTLY_REVIEWED_HASH_BOUND_AUTH_SEAL_REMEDIATION_AUTHORITY", "state")
    equal(authority["reviewVerdict"]["severityCounts"], {"P0": 0, "P1": 10, "P2": 3}, "findings")
    equal(len(authority["requiredRemediations"]), 13, "remediation count")
    checks += 4
    for pin in authority["predecessorAuthorityPins"]:
        path = ROOT / pin["path"]
        equal(path.stat().st_size, pin["bytes"], f"bytes {pin['path']}")
        equal(sha256(path), pin["sha256"], f"sha256 {pin['path']}")
        checks += 2
    equal(run(ROOT, "rev-parse", f"{BASE}^{{tree}}"), BASE_TREE, "frontend base tree")
    head, origin, dirty = run(ROOT, "rev-parse", "HEAD"), run(ROOT, "rev-parse", "origin/dwp-dev"), status_paths(ROOT)
    if head == BASE:
        equal(origin, BASE, "authoring origin")
        equal(dirty, ARTIFACTS, "authoring paths")
    else:
        run(ROOT, "merge-base", "--is-ancestor", BASE, head)
        equal(run(ROOT, "rev-list", "--count", f"{BASE}..{head}"), "1", "direct child")
        equal(set(run(ROOT, "diff", "--name-only", f"{BASE}..{head}").splitlines()), ARTIFACTS, "carrier paths")
        equal(dirty, set(), "carrier clean")
        if origin not in {BASE, head}:
            raise AssertionError(f"unexpected frontend origin: {origin}")
    checks += 5
    equal(run(BACKEND, "rev-parse", "dwp-dev"), BACKEND_BASE, "backend dwp-dev")
    equal(run(BACKEND, "rev-parse", "origin/dwp-dev"), BACKEND_BASE, "backend origin")
    equal(run(BACKEND, "rev-parse", f"{BACKEND_BASE}^{{tree}}"), BACKEND_TREE, "backend tree")
    checks += 3
    existing = set(authority["existingExactChangedPaths"])
    required = set(authority["requiredAdditionalPaths"])
    equal((len(existing), len(required)), (21, 6), "path counts")
    assert not existing & required
    allowed = existing | required
    tip = run(BACKEND, "rev-parse", AUTH_BRANCH)
    remote = run(BACKEND, "ls-remote", "origin", f"refs/heads/{AUTH_BRANCH}").split()[0]
    committed = set(run(BACKEND, "diff", "--name-only", f"{BACKEND_BASE}..{tip}").splitlines())
    if tip == REVIEWED_AUTH:
        equal(run(BACKEND, "rev-parse", f"{tip}^{{tree}}"), REVIEWED_TREE, "reviewed tree")
        equal(committed, existing, "reviewed paths")
        equal(remote, REVIEWED_AUTH, "reviewed remote")
    else:
        run(BACKEND, "merge-base", "--is-ancestor", BACKEND_BASE, tip)
        equal(run(BACKEND, "rev-list", "--count", f"{BACKEND_BASE}..{tip}"), "1", "amended commit count")
        if remote not in {REVIEWED_AUTH, tip}:
            raise AssertionError(f"unexpected AUTH remote: {remote}")
        if not existing | required <= committed:
            raise AssertionError("remediated commit omits required paths")
        if not committed <= allowed:
            raise AssertionError(f"commit exceeds allowlist: {sorted(committed - allowed)}")
    dirty_auth = status_paths(AUTH_WORKTREE)
    if not dirty_auth <= allowed:
        raise AssertionError(f"dirty path exceeds allowlist: {sorted(dirty_auth - allowed)}")
    checks += 5
    for key in ["newMigrationAuthorized", "otherModuleSourceOrTestAuthoringAuthorized",
                "frontendUiMenuOrRouteAuthorized", "featureEnablementAuthorized",
                "tenantEnrollmentAuthorized", "runtimeCredentialProvisioningAuthorized",
                "liveNetworkHandshakeAuthorized", "productionBindingAuthorized",
                "productionReleaseAuthorized", "directBackendDwpDevIntegrationAuthorized"]:
        assert authority["authority"][key] is False, f"forbidden authority: {key}"
        checks += 1
    equal(authority["authority"]["businessCompletionCredit"], 0, "business credit")
    assert authority["migrationPolicy"]["v272InPlaceHardeningAuthorized"] is True
    assert authority["migrationPolicy"]["newV273Authorized"] is False
    assert authority["targetedVerification"]["broadRepositoryRerunAuthorized"] is False
    checks += 4
    equal(review["schema"], "dwp.hris.wave7.hrm013-auth-seal-successor-independent-review.v1", "review schema")
    equal(review["decision"], "GO_FOR_ONE_BOUNDED_AUTH_SEAL_REMEDIATION_ROUND_ONLY", "review decision")
    equal(review["severityCounts"], {"P0": 0, "P1": 0, "P2": 0}, "review findings")
    equal(review["authorityPin"]["bytes"], AUTHORITY.stat().st_size, "authority bytes")
    equal(review["authorityPin"]["sha256"], sha256(AUTHORITY), "authority hash")
    equal(review["validatorPin"]["bytes"], Path(__file__).stat().st_size, "validator bytes")
    equal(review["validatorPin"]["sha256"], sha256(Path(__file__)), "validator hash")
    checks += 7
    print(f"PASS HRM-013 AUTH seal successor authority: checks={checks}")
    return 0

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (AssertionError, KeyError, json.JSONDecodeError, IndexError) as exc:
        print(f"FAIL HRM-013 AUTH seal successor authority: {exc}", file=sys.stderr)
        raise SystemExit(1)
