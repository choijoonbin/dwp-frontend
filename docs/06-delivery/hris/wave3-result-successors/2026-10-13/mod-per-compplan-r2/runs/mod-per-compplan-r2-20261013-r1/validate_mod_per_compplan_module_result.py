#!/usr/bin/env python3
"""Validate the bounded MOD-PER-COMPPLAN pushed-module result evidence."""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path
from typing import Any


HERE = Path(__file__).resolve().parent
EVIDENCE_PATH = HERE / "module-result-evidence.v1.json"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(f"FAIL: {message}")


def sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


def git(repo: Path, *args: str, binary: bool = False) -> str | bytes:
    completed = subprocess.run(
        ["git", "-C", str(repo), *args],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return completed.stdout if binary else completed.stdout.decode("utf-8").strip()


def find_frontend() -> Path:
    for parent in HERE.parents:
        if (parent / ".git").exists() and (parent / "apps").is_dir():
            return parent
    raise SystemExit("FAIL: frontend repository root not found")


def verify_file_pin(frontend: Path, pin: dict[str, Any]) -> None:
    path = frontend / pin["path"]
    require(path.is_file(), f"missing pinned file: {pin['path']}")
    payload = path.read_bytes()
    require(len(payload) == pin["bytes"], f"byte drift: {pin['path']}")
    require(sha256(payload) == pin["sha256"], f"SHA-256 drift: {pin['path']}")


def changed_manifest(repo: Path, base: str, result: str) -> tuple[list[str], bytes]:
    output = git(repo, "diff", "--name-status", f"{base}..{result}")
    assert isinstance(output, str)
    lines = output.splitlines() if output else []
    paths: list[str] = []
    canonical = bytearray()
    for line in lines:
        columns = line.split("\t")
        require(len(columns) == 2, f"non-simple changed path: {line}")
        require(columns[0] == "A", f"module result must be add-only: {line}")
        paths.append(columns[1])
        canonical.extend(f"{line}\n".encode("utf-8"))
    return paths, bytes(canonical)


def verify_result_repo(
    repo: Path,
    row: dict[str, Any],
    allowed: callable,
) -> bytes:
    result = row["resultCommit"]
    base = row["baseCommit"]
    remote_ref = f"refs/remotes/{row['upstream']}"
    require(git(repo, "rev-parse", remote_ref) == result, f"upstream head drift: {remote_ref}")
    require(git(repo, "rev-parse", f"{result}^{{tree}}") == row["resultTree"], "result tree drift")
    require(git(repo, "rev-parse", f"{base}^{{tree}}") == row["baseTree"], "base tree drift")
    require(git(repo, "merge-base", "--is-ancestor", base, result) == "", "base is not an ancestor")
    paths, manifest = changed_manifest(repo, base, result)
    require(paths == row["changedFiles"], "changed-file manifest drift")
    require(len(paths) == row["changedFileCount"], "changed-file count drift")
    require(sha256(manifest) == row["changedFileManifestSha256"], "manifest digest drift")
    require(all(allowed(path) for path in paths), "touch-policy path violation")
    require(row["clean"] is True, "recorded worktree must be clean")
    require(row["upstreamAhead"] == 0 and row["upstreamBehind"] == 0, "recorded upstream drift")
    return manifest


def main() -> None:
    frontend = find_frontend()
    backend = frontend.parent / "dwp-backend"
    require(backend.is_dir(), "backend repository root not found")
    evidence = json.loads(EVIDENCE_PATH.read_text(encoding="utf-8"))

    sealed = evidence.pop("sealedPayloadSha256")
    require(sha256(canonical_bytes(evidence)) == sealed, "sealed payload drift")
    evidence["sealedPayloadSha256"] = sealed
    require(
        evidence["status"] == "PASS_MODULE_RESULT_RECORDED_CENTRAL_INTEGRATION_PENDING",
        "result status drift",
    )

    predecessor = evidence["predecessor"]
    for key in ("promotion", "packet", "touchManifest", "startToken", "migrationLease"):
        verify_file_pin(frontend, predecessor[key])
    central_base = predecessor["centralEvidenceBase"]
    require(
        git(frontend, "merge-base", "--is-ancestor", central_base["commit"], "HEAD") == "",
        "central evidence base is not an ancestor",
    )
    require(git(frontend, "rev-parse", f"{central_base['commit']}^{{tree}}") == central_base["tree"], "central base tree drift")

    results = evidence["moduleResult"]
    frontend_prefix = "apps/dwp/src/features/hris/performance/compensation-planning/"
    frontend_manifest = verify_result_repo(
        frontend,
        results["frontend"],
        lambda path: path.startswith(frontend_prefix),
    )
    backend_prefixes = (
        "dwp-people-server/src/main/java/com/dwp/services/people/hr/performance/compensationplanning/",
        "dwp-people-server/src/test/java/com/dwp/services/people/hr/performance/compensationplanning/",
        "dwp-people-server/src/main/java/com/dwp/services/people/hr/performance/typedartifact/",
        "dwp-people-server/src/test/java/com/dwp/services/people/hr/performance/typedartifact/",
    )
    backend_exact = {
        "dwp-people-server/src/test/java/com/dwp/services/people/hris/performance/contracts/xcon/Xcon020ApprovedCompensationPlanSnapshotV1ProviderContractTest.java",
        "dwp-people-server/src/test/java/com/dwp/services/people/hris/performance/contracts/xcon/Xcon021ApprovedCompensationPlanSnapshotPublishedV2ProviderContractTest.java",
        "dwp-people-server/src/main/resources/db/performance-migration/V17__per_modern_compensation_planning.sql",
    }
    backend_manifest = verify_result_repo(
        backend,
        results["backend"],
        lambda path: path.startswith(backend_prefixes) or path in backend_exact,
    )
    union = b"".join(
        f"frontend\t{line}\n".encode("utf-8")
        for line in frontend_manifest.decode("utf-8").splitlines()
    ) + b"".join(
        f"backend\t{line}\n".encode("utf-8")
        for line in backend_manifest.decode("utf-8").splitlines()
    )
    require(sha256(union) == evidence["expectedUnionSha256"], "union manifest digest drift")

    migration = results["migration"]
    migration_payload = git(
        backend,
        "show",
        f"{results['backend']['resultCommit']}:{migration['path']}",
        binary=True,
    )
    assert isinstance(migration_payload, bytes)
    require(len(migration_payload) == migration["bytes"], "V17 byte drift")
    require(sha256(migration_payload) == migration["sha256"], "V17 SHA-256 drift")
    require(
        git(backend, "rev-parse", f"{results['backend']['resultCommit']}:{migration['path']}")
        == migration["gitBlobSha1"],
        "V17 Git blob drift",
    )

    expected_commands = {
        "PER_COMPPLAN_BACKEND_CLOSED": (31, 0),
        "PER_COMPPLAN_PLATFORM_XCON021_CLOSED": (2, 0),
        "PER_COMPPLAN_FRONTEND_CLOSED": (27, 0),
    }
    verification = evidence["verificationResults"]
    require({row["commandId"] for row in verification} == set(expected_commands), "command closed set drift")
    for row in verification:
        expected_tests, expected_failures = expected_commands[row["commandId"]]
        require(row["status"] == "PASS" and row["exitCode"] == 0, "verification did not pass")
        require(row["testCount"] == expected_tests, "test count drift")
        require(row["failures"] == expected_failures, "failure count drift")
        verify_file_pin(frontend, row["evidence"])

    visual = evidence["visualEvidence"]
    require(visual["committed"] is False, "local visual evidence must not claim committed status")
    visual_root = Path(visual["localDirectory"])
    for capture in visual["captures"]:
        path = visual_root / capture["file"]
        require(path.is_file(), f"missing local visual evidence: {capture['file']}")
        payload = path.read_bytes()
        require(len(payload) == capture["bytes"], f"visual byte drift: {capture['file']}")
        require(sha256(payload) == capture["sha256"], f"visual SHA-256 drift: {capture['file']}")

    require(
        [row["id"] for row in evidence["acceptanceCriteria"]]
        == [f"AC-{index:02d}" for index in range(1, 13)],
        "acceptance-criteria closed set drift",
    )
    expected_requests = {
        "W3-CR-MOD-PER-COMPPLAN-WORKFORCE_SNAPSHOT_COMPENSATION_PROJECTION-R1",
        "W3-CR-MOD-PER-COMPPLAN-AUTH_PEP-R1",
        "W3-CR-MOD-PER-COMPPLAN-CONTRACT_GATEWAY-R1",
        "W3-CR-MOD-PER-COMPPLAN-SHELL_ROUTE-R1",
        "W3-CR-MOD-PER-COMPPLAN-SVC_PEP_SECURITY-R1",
        "W3-CR-MOD-PER-COMPPLAN-INTEGRATION_VERIFY-R1",
    }
    require(
        {row["requestId"] for row in evidence["centralIntegrationObligations"]}
        == expected_requests,
        "central obligation closed set drift",
    )
    authority = evidence["authority"]
    require(authority["moduleResultRecorded"] is True, "module result is not recorded")
    for key in (
        "resultAdmissionAuthorized",
        "integrationMergeAuthorized",
        "sharedControlPathChangeAuthorizedForModule",
        "payConsumptionAuthorized",
        "customerDataAuthorized",
        "customerActivationAuthorized",
        "productionReleaseAuthorized",
    ):
        require(authority[key] is False, f"unauthorized authority escalation: {key}")

    print("MOD_PER_COMPPLAN_MODULE_RESULT_EVIDENCE_VALID")


if __name__ == "__main__":
    main()
