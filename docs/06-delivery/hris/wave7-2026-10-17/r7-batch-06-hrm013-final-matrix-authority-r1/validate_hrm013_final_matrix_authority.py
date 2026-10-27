#!/usr/bin/env python3
"""Fail-closed validator for the HRM-013 final bounded matrix authority."""
from __future__ import annotations

import hashlib
import json
import stat
import subprocess
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[5]
HERE = Path(__file__).resolve().parent
BACKEND = Path("/Users/a10697/Work/DWP/dwp-backend")
EXECUTION = Path("/Users/a10697/Work/DWP/.codex-worktrees/hris/wave7-20261027/batch06/hrm013-phase6/integration")
AUTHORITY = HERE / "final-matrix-execution-authority.v1.json"
REVIEW = HERE / "independent-review.v1.json"
FRONTEND_BASE = "05c784e6258b00c3fec90815387b13ebe087ca45"
FRONTEND_TREE = "a6a8970a8ee69acc31a8e6d714bbca51a6ad1a9a"
BACKEND_TARGET = "2a765439beb50d40f91eb65c5350984cfc4b52de"
BACKEND_TREE = "4c57372f0ebb8f62db3ef8ab469ab6c5eb5e4bbd"
ACCEPTANCE_SHA256 = "72c40f9a0a7ec19cc4b27e3caec7443a4d653a2aa42546113601af32f64f383b"
ARTIFACTS = {
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-final-matrix-authority-r1/"
    "final-matrix-execution-authority.v1.json",
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-final-matrix-authority-r1/independent-review.v1.json",
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-final-matrix-authority-r1/"
    "validate_hrm013_final_matrix_authority.py",
}
TASKS = [
    ":dwp-platform-contracts:test",
    ":dwp-auth-server:test",
    ":dwp-approval-server:test",
    ":dwp-people-server:test",
    ":dwp-approval-server:crossServiceTest",
]
SELECTOR_COUNTS = [5, 4, 5, 6, 1]
TEST_COUNTS = [5, 4, 5, 7, 1]
CHAIN = [
    ("e09603ea1270278e720462ba7d00b116ef12bb9c", "76d818fad77af29364d20ce4cb3980d899f86213", "8ccc7baeff43b60dc6cdf719449514f56b6dbca5"),
    ("3707d6378b4663812bd5dbdbb5de0b96aafa205d", "ebd7248113d9d2db462c6297304bb5be3cafbd55", "e09603ea1270278e720462ba7d00b116ef12bb9c"),
    ("126421aae2f6fb31a15e6db41bfd4d1ab03e9f2a", "9312c8c66b057557ab6f7fc4d348aa20390dbfa7", "3707d6378b4663812bd5dbdbb5de0b96aafa205d"),
    (BACKEND_TARGET, BACKEND_TREE, "126421aae2f6fb31a15e6db41bfd4d1ab03e9f2a"),
]


def load(path: Path) -> dict[str, Any]:
    def pairs(items: list[tuple[str, Any]]) -> dict[str, Any]:
        value: dict[str, Any] = {}
        for key, item in items:
            if key in value:
                raise AssertionError(f"duplicate JSON key in {path}: {key}")
            value[key] = item
        return value

    result = json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=pairs)
    if not isinstance(result, dict):
        raise AssertionError(f"JSON root must be object: {path}")
    return result


def git(repo: Path, *args: str) -> str:
    result = subprocess.run(
        ["/usr/bin/git", "-C", str(repo), *args],
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode:
        raise AssertionError(
            f"git {' '.join(args)} failed in {repo}: {result.stderr.strip()}"
        )
    return result.stdout.rstrip()


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def equal(actual: Any, expected: Any, label: str) -> None:
    if type(actual) is not type(expected) or actual != expected:
        raise AssertionError(f"{label}: expected={expected!r} actual={actual!r}")


def status_paths(repo: Path) -> set[str]:
    return {
        line[3:].split(" -> ")[-1]
        for line in git(repo, "status", "--porcelain=v1", "-uall").splitlines()
        if line
    }


def resolve_pin(path: str) -> Path:
    candidate = Path(path)
    return candidate if candidate.is_absolute() else ROOT / candidate


def selector_source(task: str, selector: str) -> tuple[str, str | None]:
    class_only = selector.endswith("Hrm013TaskDispatchReceiptHandshakeTest")
    if class_only:
        class_name, method = selector, None
    else:
        class_name, method = selector.rsplit(".", 1)
    if task == ":dwp-platform-contracts:test":
        prefix = "dwp-platform-contracts/src/test/java/"
    elif task == ":dwp-auth-server:test":
        prefix = "dwp-auth-server/src/test/java/"
    elif task == ":dwp-approval-server:test":
        prefix = "dwp-approval-server/src/test/java/"
    elif task == ":dwp-people-server:test":
        prefix = "dwp-people-server/src/test/java/"
    elif task == ":dwp-approval-server:crossServiceTest":
        prefix = "dwp-approval-server/src/crossServiceTest/java/"
    else:
        raise AssertionError(f"unknown task: {task}")
    return prefix + class_name.replace(".", "/") + ".java", method


def main() -> int:
    checks = 0
    authority = load(AUTHORITY)
    review = load(REVIEW)
    equal(authority["schema"], "dwp.hris.wave7.hrm013-final-matrix-execution-authority.v1", "authority schema")
    equal(authority["state"], "INDEPENDENTLY_REVIEWED_HASH_BOUND_EXACT_TWENTY_ONE_SELECTOR_FIVE_TASK_SINGLE_INVOCATION_AUTHORITY", "authority state")
    equal(authority["carrier"]["baseCommit"], FRONTEND_BASE, "frontend base")
    equal(authority["carrier"]["baseTree"], FRONTEND_TREE, "frontend tree declaration")
    equal(set(authority["carrier"]["exactChangedPaths"]), ARTIFACTS, "exact carrier paths")
    checks += 5

    equal(git(ROOT, "rev-parse", f"{FRONTEND_BASE}^{{tree}}"), FRONTEND_TREE, "frontend base tree")
    head = git(ROOT, "rev-parse", "HEAD")
    origin = git(ROOT, "rev-parse", "origin/dwp-dev")
    dirty = status_paths(ROOT)
    if head == FRONTEND_BASE:
        equal(origin, FRONTEND_BASE, "frontend authoring origin")
        equal(ARTIFACTS <= dirty, True, "all carrier files dirty")
        unrelated_hris = {
            path for path in dirty
            if path.startswith("docs/06-delivery/hris/") and path not in ARTIFACTS
        }
        equal(unrelated_hris, set(), "no unrelated dirty HRIS paths")
    else:
        equal(git(ROOT, "rev-parse", f"{head}^"), FRONTEND_BASE, "carrier direct parent")
        equal(set(git(ROOT, "diff", "--name-only", f"{FRONTEND_BASE}..{head}").splitlines()), ARTIFACTS, "committed carrier paths")
        equal(dirty & ARTIFACTS, set(), "committed carrier paths clean")
        if origin not in {FRONTEND_BASE, head}:
            raise AssertionError(f"frontend origin drift: {origin}")
    equal({path.name for path in HERE.iterdir() if path.is_file()}, {Path(path).name for path in ARTIFACTS}, "exactly three files")
    checks += 6

    target = authority["backendTarget"]
    equal(target["commit"], BACKEND_TARGET, "backend target")
    equal(target["tree"], BACKEND_TREE, "backend target tree")
    equal(git(BACKEND, "rev-parse", "origin/dwp-dev"), BACKEND_TARGET, "backend origin")
    equal(git(BACKEND, "rev-parse", f"{BACKEND_TARGET}^{{tree}}"), BACKEND_TREE, "backend object tree")
    equal(git(EXECUTION, "rev-parse", "HEAD"), BACKEND_TARGET, "execution head")
    equal(git(EXECUTION, "rev-parse", "HEAD^{tree}"), BACKEND_TREE, "execution tree")
    equal(git(EXECUTION, "status", "--porcelain=v1", "-uall"), "", "execution worktree clean")
    for index, (commit, tree, parent) in enumerate(CHAIN):
        equal(git(BACKEND, "rev-parse", f"{commit}^{{tree}}"), tree, f"chain tree {index}")
        equal(git(BACKEND, "rev-parse", f"{commit}^"), parent, f"chain parent {index}")
    checks += 15

    for name, pin in authority["predecessorEvidence"].items():
        path = resolve_pin(pin["path"])
        equal(path.is_file(), True, f"pin file {name}")
        equal(f"{stat.S_IMODE(path.stat().st_mode):04o}", pin["mode"], f"pin mode {name}")
        equal(path.stat().st_size, pin["bytes"], f"pin bytes {name}")
        equal(sha256(path), pin["sha256"], f"pin sha256 {name}")
        checks += 4

    gate = load(resolve_pin(authority["predecessorEvidence"]["BINDING_GATE"]["path"]))
    conditions = authority["acceptanceMatrix"]["conditions"]
    equal(conditions, gate["targetedAcceptanceMatrix"], "exact twelve-condition source projection")
    canonical = json.dumps(conditions, ensure_ascii=False, separators=(",", ":")).encode()
    equal(hashlib.sha256(canonical).hexdigest(), ACCEPTANCE_SHA256, "acceptance digest")
    equal(authority["acceptanceMatrix"]["canonicalCompactJsonSha256"], ACCEPTANCE_SHA256, "declared acceptance digest")
    equal([item["id"] for item in conditions], [f"HRM013-RBG-{number:02d}" for number in range(1, 13)], "condition ids")
    checks += 4

    prerequisite = load(resolve_pin(authority["predecessorEvidence"]["PREREQUISITE_MATRIX_RECEIPT"]["path"]))
    equal(prerequisite["successfulExecution"]["tests"], 20, "prerequisite tests")
    equal(prerequisite["successfulExecution"]["failures"], 0, "prerequisite failures")
    equal(prerequisite["successfulExecution"]["skipped"], 0, "prerequisite skipped")
    equal(prerequisite["claimBoundary"]["completeTwelveConditionMatrixExecuted"], False, "prerequisite not final matrix")
    equal(prerequisite["claimBoundary"]["phase6TaskOwnersIncluded"], False, "prerequisite excludes phase6")
    checks += 5

    catalog = authority["selectorCatalog"]
    plan = authority["executionPlan"]
    equal(len(catalog), 21, "selector count")
    equal(len({item["selector"] for item in catalog.values()}), 21, "unique selector count")
    equal(plan["invocationCount"], 1, "invocation count")
    equal(plan["singleGradleInvocationRequired"], True, "single invocation")
    equal(plan["rerunTasksRequired"], True, "rerun tasks")
    equal(plan["zeroSkippedRequired"], True, "zero skipped")
    equal([item["task"] for item in plan["taskPlan"]], TASKS, "task order")
    equal([len(item["selectorIds"]) for item in plan["taskPlan"]], SELECTOR_COUNTS, "task selector distribution")
    equal(plan["taskExpectedTestDistribution"], TEST_COUNTS, "task test distribution")
    flattened = [selector_id for item in plan["taskPlan"] for selector_id in item["selectorIds"]]
    equal(flattened, list(catalog), "catalog and task-plan order")
    argv = ["./gradlew", "--rerun-tasks"]
    for item in plan["taskPlan"]:
        argv.append(item["task"])
        for selector_id in item["selectorIds"]:
            equal(catalog[selector_id]["task"], item["task"], f"task binding {selector_id}")
            argv.extend(["--tests", catalog[selector_id]["selector"]])
    equal(argv.count("--tests"), 21, "argv selector option count")
    checks += 12 + len(catalog)

    for selector_id, entry in catalog.items():
        path, method = selector_source(entry["task"], entry["selector"])
        source = git(BACKEND, "show", f"{BACKEND_TARGET}:{path}")
        class_name = entry["selector"].split(".")[-1] if method is None else entry["selector"].rsplit(".", 2)[-2]
        if class_name not in source:
            raise AssertionError(f"class missing for {selector_id}: {class_name}")
        if method is not None and method not in source:
            raise AssertionError(f"method missing for {selector_id}: {method}")
        checks += 2

    mapping = authority["conditionEvidenceMap"]
    ids = [item["id"] for item in conditions]
    equal(list(mapping), ids, "condition mapping order")
    known_evidence = set(authority["predecessorEvidence"])
    covered: set[str] = set()
    for condition_id, evidence in mapping.items():
        selector_ids = evidence["selectorIds"]
        refs = evidence["predecessorEvidence"]
        if not selector_ids and not refs:
            raise AssertionError(f"condition has no evidence: {condition_id}")
        if not set(selector_ids) <= set(catalog):
            raise AssertionError(f"unknown selector id in {condition_id}")
        if not set(refs) <= known_evidence:
            raise AssertionError(f"unknown predecessor evidence in {condition_id}")
        covered.update(selector_ids)
        checks += 3
    equal(covered, set(catalog), "every frozen selector contributes to condition evidence")
    checks += 1

    required_false = {
        "activationAuthorized", "tenantEnrollmentAuthorized",
        "runtimeCredentialProvisioningAuthorized", "liveNetworkHandshakeAuthorized",
        "productionBindingAuthorized", "productionReleaseAuthorized",
        "broadRepositoryRerunAuthorized", "unrelatedModuleRerunAuthorized",
        "hrm013BusinessCompletionAuthorized", "batch06CompletionAuthorized",
        "hrisCompletionAuthorized",
    }
    for key in required_false:
        equal(authority["authority"][key], False, f"forbidden authority {key}")
        checks += 1
    equal(authority["authority"]["businessCompletionCredit"], 0, "zero completion credit")
    equal(len(authority["activationOnlyOpenConditions"]), 3, "activation-only open conditions")
    checks += 2

    equal(review["schema"], "dwp.hris.wave7.hrm013-final-matrix-independent-review.v1", "review schema")
    equal(review["decision"], "GO_FOR_EXACT_TWENTY_ONE_SELECTOR_FIVE_TASK_SINGLE_INVOCATION_AFTER_CARRIER_PUSH_ONLY", "review decision")
    equal(review["severityCounts"], {"P0": 0, "P1": 0, "P2": 3}, "review findings")
    equal(review["authorityPin"]["bytes"], AUTHORITY.stat().st_size, "authority bytes")
    equal(review["authorityPin"]["sha256"], sha256(AUTHORITY), "authority sha256")
    equal(review["validatorPin"]["bytes"], Path(__file__).stat().st_size, "validator bytes")
    equal(review["validatorPin"]["sha256"], sha256(Path(__file__)), "validator sha256")
    checks += 7

    print(f"PASS HRM-013 final matrix authority: checks={checks}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (AssertionError, KeyError, OSError, json.JSONDecodeError, IndexError) as exc:
        print(f"FAIL HRM-013 final matrix authority: {exc}", file=sys.stderr)
        raise SystemExit(1)
