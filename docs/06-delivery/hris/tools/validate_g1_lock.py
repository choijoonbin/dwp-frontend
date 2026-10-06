#!/usr/bin/env python3
"""Validate the HRIS G1 integration lock without running build or test suites.

The validator intentionally limits itself to immutable document bytes, pinned Git
objects, and the two prepared integration worktrees.  It collects every failure
in one pass so a correction can be made without repeated whole-repository runs.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable


CONFLICT_MANIFEST = "2026-10-06-g1-conflict-manifest.json"
CLUSTER_TEST_MAP = "2026-10-06-g1-cluster-test-map.json"
MIGRATION_LEASE = "2026-10-06-g1-migration-admission-and-lease.json"
OVERLAY_CSV = "current-slice-integration-status.v1.csv"
OVERLAY_EVIDENCE = "current-slice-integration-status.v1.evidence.json"
G1_RECEIPT = "2026-10-06-g1-integration-lock-receipt.json"
G1_WORK_PACKET = "2026-10-06-g1-integration-work-packet.md"
RECOVERY_DISPOSITION = "2026-10-06-recovery-gap-disposition.json"
SUPPLEMENT_MANIFEST = "recovery/exact-supplements/2026-10-06/manifest.json"
INTEGRATION_ROADMAP = "2026-10-06-integration-roadmap.md"
SOURCE_PROVENANCE = "2026-10-06-source-and-lineage-provenance.md"
G0_AUDIT_AMENDMENT = "g0-recovery-audit-amendment-2026-10-06.json"
LINEAGE_ADR = "docs/03-architecture/hris/ADR-001-lineage-v35-successor-and-migration-lease.md"

EXPECTED_PACKET_ID = "HRIS-G1-INTEGRATION-LOCK-20261006-R1"
EXPECTED_RECEIPT_SCHEMA = "dwp.hris.g1-integration-lock-receipt.v1"
EXPECTED_RECEIPT_STATUS = "PASS_WITH_SUCCESSOR_OBLIGATIONS"
EXPECTED_LEASE_STATUS = "ISSUED_WITH_PENDING_G2_G5_VALIDATION"
EXPECTED_LEASE_WRITER = "SYS_COMMON_INTEGRATION_CONTROL"

EXPECTED_PAY_CHAIN = [
    "BASE-TFR-PAY-007",
    "MOD-PER-COMPPLAN",
    "BASE-TFR-PAY-016",
    "BASE-TFR-PAY-011",
]
CURRENT_MIGRATION_MARKER = "CURRENT_JIT_LEASE_REQUIRED_IF_SCHEMA_TOUCH"
EXPECTED_IMMUTABLE_STREAM_COUNTS = {"PEOPLE": 4, "PAYROLL": 5, "TIME": 7}
EXPECTED_MODULE_COUNTS = {"HRM": 22, "PER": 22, "PAY": 21, "TIM": 20, "SYS": 17}
EXPECTED_DISPOSITION_COUNTS = {
    "NOT_STARTED": 90,
    "PARTIAL_OVERLAP": 5,
    "PRESENT_RECONCILED_PENDING_INTEGRATION": 5,
    "RETIRED": 2,
}
EXPECTED_SUPPLEMENT_MANIFEST_SHA256 = (
    "342488e9e5f2ec3ede83a0c99e83bd990892169fc913dc60afb3255ded037a6d"
)


class Validation:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.checks: dict[str, Any] = {}

    def require(self, condition: bool, message: str) -> None:
        if not condition:
            self.errors.append(message)

    def capture(self, name: str, operation: Any) -> Any:
        before = len(self.errors)
        try:
            value = operation()
        except Exception as exc:  # report every independent cluster in one run
            self.errors.append(f"{name}: {exc}")
            value = None
        self.checks[name] = {
            "status": "PASS" if len(self.errors) == before else "FAIL"
        }
        return value


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def git(repo: Path, *args: str, text: bool = True) -> str | bytes:
    completed = subprocess.run(
        ["git", "-C", str(repo), *args],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if text:
        return completed.stdout.decode("utf-8").strip()
    return completed.stdout


def git_batch_objects_exist(repo: Path, object_specs: list[str]) -> list[bool]:
    if not object_specs:
        return []
    completed = subprocess.run(
        ["git", "-C", str(repo), "cat-file", "--batch-check=%(objectname) %(objecttype)"],
        input=("\n".join(object_specs) + "\n").encode("utf-8"),
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    lines = completed.stdout.decode("utf-8").splitlines()
    if len(lines) != len(object_specs):
        raise ValueError(
            f"git cat-file returned {len(lines)} rows for {len(object_specs)} object specs"
        )
    return [not line.endswith(" missing") and line.endswith(" blob") for line in lines]


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def normalized_repo_path(value: Any) -> bool:
    if not isinstance(value, str) or not value or "\\" in value:
        return False
    path = Path(value)
    return not path.is_absolute() and ".." not in path.parts and value == path.as_posix()


def git_tree_paths(repo: Path, commits: Iterable[Any]) -> set[str]:
    paths: set[str] = set()
    for commit in commits:
        if not isinstance(commit, str) or not commit:
            continue
        output = str(git(repo, "ls-tree", "-r", "--name-only", commit))
        paths.update(output.splitlines())
    return paths


def is_full_suite_first_check(check: str) -> bool:
    normalized = " ".join(check.replace("`", "").split())
    lowered = normalized.lower()
    if "./gradlew" in lowered:
        invokes_broad_task = bool(
            re.search(r"(?:^|\s)(?:\./)?gradlew\s+(?:(?:--?\S+)\s+)*(?:test|build|check|clean)(?:\s|$)", lowered)
            or re.search(r"\s:[a-z0-9_-]+:(?:test|build|check)(?:\s|$)", lowered)
        )
        if invokes_broad_task and "--tests" not in lowered:
            return True
    if re.search(r"(?:^|\s)yarn\s+(?:test|build|lint|typecheck)(?:\s|$)", lowered):
        return True
    if "yarn vitest" in lowered and not re.search(
        r"(?:apps|libs|e2e)/\S+\.(?:test|spec)\.[cm]?[jt]sx?", normalized
    ):
        return True
    return False


def validate_cluster_execution_policy(
    validation: Validation,
    manifest: dict[str, Any],
    test_map: dict[str, Any],
    repositories: dict[str, Path],
) -> None:
    errors_before = len(validation.errors)
    clusters = test_map.get("clusters", [])
    validation.require(isinstance(clusters, list) and clusters, "cluster test map has no cluster entries")
    if not isinstance(clusters, list):
        clusters = []

    first_locations: list[tuple[str, str, str]] = []
    next_locations: list[tuple[str, str, str]] = []
    for index, entry in enumerate(clusters):
        identity = f"{entry.get('repository')}/{entry.get('cluster', index)}"
        for field in ("firstChecks", "nextChecks"):
            values = entry.get(field)
            validation.require(
                isinstance(values, list)
                and bool(values)
                and all(isinstance(value, str) and value.strip() for value in values),
                f"{identity}: {field} must be a non-empty string list",
            )
        validation.require(
            isinstance(entry.get("escalateWhen"), str)
            and bool(entry.get("escalateWhen", "").strip()),
            f"{identity}: escalateWhen must be non-empty",
        )
        if isinstance(entry.get("firstChecks"), list):
            for check in entry["firstChecks"]:
                if isinstance(check, str):
                    first_locations.append((str(entry.get("repository")), str(entry.get("cluster")), check))
                    validation.require(
                        not is_full_suite_first_check(check),
                        f"{identity}: firstChecks contains a full-suite command: {check}",
                    )
        if isinstance(entry.get("nextChecks"), list):
            for check in entry["nextChecks"]:
                if isinstance(check, str):
                    next_locations.append((str(entry.get("repository")), str(entry.get("cluster")), check))

    policy = test_map.get("policy", {})
    full_gate = str(policy.get("fullGate", ""))
    w1_policy = str(policy.get("w1", ""))
    validation.require(
        all(
            token in full_gate.lower()
            for token in ("g5", "full frontend/backend", "static", "build", "release", "head freeze")
        ),
        "cluster policy fullGate must reserve the full static/build/release gate for G5 before head freeze",
    )
    validation.require(
        all(
            token in w1_policy.lower()
            for token in ("exactly once", "g6", "frozen frontend/backend head pair")
        ),
        "cluster policy w1 must run exactly once in G6 on the frozen frontend/backend head pair",
    )

    export_markers = (
        "DWP_EXPORT_AUTH_OPENAPI=true",
        "DWP_EXPORT_PLATFORM_OPENAPI=true",
    )
    for marker in export_markers:
        first_hits = [item for item in first_locations if marker in item[2]]
        next_hits = [item for item in next_locations if marker in item[2]]
        validation.require(not first_hits, f"{marker} must not appear in firstChecks")
        validation.require(
            len(next_hits) == 1 and next_hits[0][:2] == ("backend", "OPENAPI_GENERATION"),
            f"{marker} must appear exactly once in OPENAPI_GENERATION nextChecks",
        )
    openapi_next = "\n".join(
        check
        for repo, cluster, check in next_locations
        if repo == "backend" and cluster == "OPENAPI_GENERATION"
    ).lower()
    validation.require(
        "executed" in openapi_next and "not skipped" in openapi_next,
        "OPENAPI_GENERATION nextChecks must retain executed/not-skipped export evidence",
    )

    home_identity_test = (
        "apps/dwp/src/components/workspace-composer/"
        "hris-visible-product-identity.test.ts"
    )
    validation.require(
        any(home_identity_test in check for _, _, check in first_locations),
        "cluster firstChecks do not include the HRIS visible Home identity test",
    )

    tree_paths: dict[str, set[str]] = {}
    for repo_name, repository in repositories.items():
        repo_manifest = manifest.get("repositories", {}).get(repo_name, {})
        tree_paths[repo_name] = git_tree_paths(
            repository,
            (repo_manifest.get("currentPin"), repo_manifest.get("reconciledPin")),
        )

    frontend_target_pattern = re.compile(
        r"((?:apps|libs|e2e|scripts|architecture)/[A-Za-z0-9_./-]+\.(?:test|spec)\.[cm]?[jt]sx?)"
    )
    backend_target_pattern = re.compile(r"--tests\s+['\"]?([A-Za-z0-9_.*$]+)")
    checked_targets: set[tuple[str, str]] = set()
    for repo_name, cluster, check in first_locations + next_locations:
        if repo_name == "frontend":
            for target in frontend_target_pattern.findall(check):
                checked_targets.add((repo_name, target))
                validation.require(
                    target in tree_paths.get(repo_name, set()),
                    f"{cluster}: frontend test target is absent at both pins: {target}",
                )
        elif repo_name == "backend":
            for target in backend_target_pattern.findall(check):
                checked_targets.add((repo_name, target))
                if target.endswith(".*"):
                    package_path = target[:-2].replace(".", "/") + "/"
                    exists = any(package_path in path and path.endswith(".java") for path in tree_paths[repo_name])
                else:
                    class_path = target.replace(".", "/") + ".java"
                    exists = any(path.endswith(class_path) for path in tree_paths[repo_name])
                validation.require(
                    exists,
                    f"{cluster}: backend test target is absent at both pins: {target}",
                )

    validation.checks["clusterExecutionPolicy"] = {
        "status": "PASS" if len(validation.errors) == errors_before else "FAIL",
        "clusters": len(clusters),
        "firstChecks": len(first_locations),
        "nextChecks": len(next_locations),
        "pinnedTestTargets": len(checked_targets),
    }


def validate_json_parse(
    validation: Validation, docs_dir: Path
) -> dict[str, Any]:
    paths = {path.name: path for path in docs_dir.glob("*g1*.json")}
    paths[OVERLAY_EVIDENCE] = docs_dir / OVERLAY_EVIDENCE
    required = {CONFLICT_MANIFEST, CLUSTER_TEST_MAP, MIGRATION_LEASE, OVERLAY_EVIDENCE}
    validation.require(
        required.issubset(paths),
        f"missing required G1 JSON files: {sorted(required - set(paths))}",
    )

    parsed: dict[str, Any] = {}
    for name, path in sorted(paths.items()):
        validation.require(path.is_file(), f"G1 JSON is not a file: {path}")
        if not path.is_file():
            continue
        try:
            parsed[name] = load_json(path)
        except (OSError, json.JSONDecodeError) as exc:
            validation.errors.append(f"invalid G1 JSON {path}: {exc}")
    validation.checks["g1JsonParse"] = {
        "status": "PASS"
        if required.issubset(parsed) and len(parsed) == len(paths)
        else "FAIL",
        "files": sorted(parsed),
    }
    return parsed


def validate_conflicts_and_test_map(
    validation: Validation,
    manifest: dict[str, Any],
    test_map: dict[str, Any],
    repositories: dict[str, Path],
) -> None:
    errors_before = len(validation.errors)
    validation.require(
        manifest.get("packetId") == test_map.get("packetId"),
        "conflict manifest and cluster test map packetId differ",
    )
    validation.require(
        manifest.get("packetId") == EXPECTED_PACKET_ID,
        "G1 conflict manifest packetId drifted",
    )
    validate_cluster_execution_policy(validation, manifest, test_map, repositories)

    expected_map: dict[tuple[str, str], tuple[int, int]] = {}
    for repo_name, repo_data in sorted(manifest.get("repositories", {}).items()):
        validation.require(repo_name in repositories, f"unknown repository: {repo_name}")
        if repo_name not in repositories or not isinstance(repo_data, dict):
            continue

        textual = repo_data.get("textualConflicts", [])
        semantic = repo_data.get("semanticReviewPaths", [])
        validation.require(isinstance(textual, list), f"{repo_name}: textualConflicts is not a list")
        validation.require(isinstance(semantic, list), f"{repo_name}: semanticReviewPaths is not a list")
        if not isinstance(textual, list) or not isinstance(semantic, list):
            continue

        textual_keys = [(item.get("path"), item.get("cluster")) for item in textual]
        semantic_keys = [(item.get("path"), item.get("cluster")) for item in semantic]
        validation.require(
            len(textual_keys) == len(set(textual_keys)),
            f"{repo_name}: duplicate textual conflict path/cluster",
        )
        validation.require(
            len(semantic_keys) == len(set(semantic_keys)),
            f"{repo_name}: duplicate semantic review path/cluster",
        )
        validation.require(
            int(repo_data.get("textualConflictCount", -1)) == len(textual),
            f"{repo_name}: textualConflictCount does not match list",
        )
        validation.require(
            int(repo_data.get("semanticReviewPathCount", -1)) == len(semantic),
            f"{repo_name}: semanticReviewPathCount does not match list",
        )

        text_counts = Counter(item.get("cluster") for item in textual)
        semantic_counts = Counter(item.get("cluster") for item in semantic)
        declared_counts = repo_data.get("clusterCounts", {})
        validation.require(
            dict(sorted(text_counts.items())) == dict(sorted(declared_counts.items())),
            f"{repo_name}: clusterCounts does not match textual conflicts",
        )
        declared_semantic_counts = repo_data.get("semanticReviewClusterCounts", {})
        validation.require(
            dict(sorted(semantic_counts.items()))
            == dict(sorted(declared_semantic_counts.items())),
            f"{repo_name}: semanticReviewClusterCounts does not match semantic review paths",
        )

        semantic_by_path = {item.get("path"): item.get("cluster") for item in semantic}
        for item in textual:
            path = item.get("path")
            validation.require(
                semantic_by_path.get(path) == item.get("cluster"),
                f"{repo_name}: textual conflict missing or re-clustered in semantic paths: {path}",
            )

        current_pin = repo_data.get("currentPin")
        reconciled_pin = repo_data.get("reconciledPin")
        object_requests: list[tuple[str, Any, Any, str]] = []
        for item in semantic:
            path = item.get("path")
            validation.require(
                normalized_repo_path(path),
                f"{repo_name}: unsafe semantic review path: {path!r}",
            )
            if not normalized_repo_path(path):
                continue
            for label, pin in (("current", current_pin), ("reconciled", reconciled_pin)):
                object_requests.append((label, pin, path, f"{pin}:{path}"))

        existence = git_batch_objects_exist(
            repositories[repo_name], [request[3] for request in object_requests]
        )
        for (label, pin, path, _), exists in zip(object_requests, existence):
            if not exists:
                validation.errors.append(
                    f"{repo_name}: {path} does not exist as a blob at {label} pin {pin}"
                )

        for cluster in set(text_counts) | set(semantic_counts):
            expected_map[(repo_name, str(cluster))] = (
                text_counts.get(cluster, 0),
                semantic_counts.get(cluster, 0),
            )

    actual_map: dict[tuple[str, str], tuple[int, int]] = {}
    for entry in test_map.get("clusters", []):
        key = (entry.get("repository"), entry.get("cluster"))
        validation.require(key not in actual_map, f"duplicate cluster test-map entry: {key}")
        actual_map[key] = (
            entry.get("textualConflictCount"),
            entry.get("semanticReviewPathCount"),
        )

    validation.require(
        actual_map == expected_map,
        "cluster test-map counts/keys do not exactly match the conflict manifest",
    )
    validation.checks["conflictManifestAndTestMap"] = {
        "status": "PASS" if len(validation.errors) == errors_before else "FAIL",
        "clusterCount": len(expected_map),
        "textualConflictCount": sum(item[0] for item in expected_map.values()),
        "semanticReviewPathCount": sum(item[1] for item in expected_map.values()),
    }


def read_overlay(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def order_number(value: str, context: str) -> int:
    match = re.search(r"(?:^|_)(\d+)(?:_|$)", value or "")
    if not match:
        raise ValueError(f"{context} has no explicit numeric order: {value!r}")
    return int(match.group(1))


def validate_overlay(
    validation: Validation,
    csv_path: Path,
    evidence: dict[str, Any],
) -> None:
    errors_before = len(validation.errors)
    rows = read_overlay(csv_path)
    ids = [row.get("slice_id", "") for row in rows]
    retired = [row for row in rows if row.get("disposition") == "RETIRED"]
    active = [row for row in rows if row.get("disposition") != "RETIRED"]
    validation.require(len(rows) == 102, f"overlay row count is {len(rows)}, expected 102")
    validation.require(len(set(ids)) == 102 and all(ids), "overlay slice IDs are not 102 unique non-empty values")
    validation.require(len(active) == 100, f"overlay active count is {len(active)}, expected 100")
    validation.require(len(retired) == 2, f"overlay retired count is {len(retired)}, expected 2")
    validation.require(
        dict(Counter(row.get("module") for row in rows)) == EXPECTED_MODULE_COUNTS,
        "overlay module counts do not match the 102-slice recovery register",
    )
    validation.require(
        dict(Counter(row.get("disposition") for row in rows)) == EXPECTED_DISPOSITION_COUNTS,
        "overlay disposition counts drifted",
    )

    by_id = {row["slice_id"]: row for row in rows if row.get("slice_id")}
    validation.require(
        all(slice_id in by_id for slice_id in EXPECTED_PAY_CHAIN),
        "overlay is missing one or more PAY dependency-chain slices",
    )
    pay_orders: list[int] = []
    if all(slice_id in by_id for slice_id in EXPECTED_PAY_CHAIN):
        for slice_id in EXPECTED_PAY_CHAIN:
            try:
                pay_orders.append(
                    order_number(
                        by_id[slice_id].get("cross_module_order_override", ""), slice_id
                    )
                )
            except ValueError as exc:
                validation.errors.append(str(exc))
        validation.require(
            pay_orders == [1, 2, 3, 4],
            f"PAY chain orders are {pay_orders}, expected [1, 2, 3, 4]",
        )
        typed_consumer = by_id["BASE-TFR-PAY-016"]
        calculation = by_id["BASE-TFR-PAY-011"]
        validation.require(
            "DEP-019" in typed_consumer.get("dependency_ids", "").split("|"),
            "BASE-TFR-PAY-016 is not bound to DEP-019",
        )
        validation.require(
            "REQUIRES_MOD_PER_COMPPLAN_PRODUCER_RESULT_PIN_BEFORE_TYPED_CONSUMER_INPUT"
            in typed_consumer.get("blocker", ""),
            "BASE-TFR-PAY-016 does not retain the compensation producer-result pin gate",
        )
        validation.require(
            "REQUIRES_RESULT_COMMITS_MOD_PER_COMPPLAN_AND_BASE_TFR_PAY_016"
            in calculation.get("blocker", ""),
            "BASE-TFR-PAY-011 does not retain both producer result-commit gates",
        )

    evidence_pay_chain = evidence.get("orderingPolicy", {}).get("PAY_CHAIN")
    validation.require(
        evidence_pay_chain == EXPECTED_PAY_CHAIN,
        f"overlay evidence PAY_CHAIN is {evidence_pay_chain!r}, expected {EXPECTED_PAY_CHAIN!r}",
    )

    if "BASE-TFR-SYS-007" in by_id and "BASE-TFR-SYS-012" in by_id:
        try:
            sys_007 = int(by_id["BASE-TFR-SYS-007"]["effective_module_order"])
            sys_012 = int(by_id["BASE-TFR-SYS-012"]["effective_module_order"])
            validation.require(
                sys_007 < sys_012,
                f"SYS-007 order {sys_007} is not before SYS-012 order {sys_012}",
            )
        except (KeyError, ValueError) as exc:
            validation.errors.append(f"invalid SYS effective order: {exc}")
    else:
        validation.errors.append("overlay is missing SYS-007 or SYS-012")

    invalid_effective: list[str] = []
    historical_as_current: list[str] = []
    historical_leaks: list[str] = []
    for row in rows:
        historical = row.get("historical_migration_allocation_ids", "").strip()
        effective = row.get("effective_migration_lineage", "").strip()
        is_active = row.get("disposition") != "RETIRED"
        if effective not in {"NONE", CURRENT_MIGRATION_MARKER}:
            invalid_effective.append(str(row.get("slice_id")))
        if is_active and effective != CURRENT_MIGRATION_MARKER:
            historical_as_current.append(str(row.get("slice_id")))
        if not is_active and effective != "NONE":
            invalid_effective.append(str(row.get("slice_id")))
        if historical not in {"", "NONE"} and is_active:
            if effective != CURRENT_MIGRATION_MARKER:
                historical_as_current.append(str(row.get("slice_id")))
        if historical and historical != "NONE":
            if historical in effective:
                historical_leaks.append(str(row.get("slice_id")))
        validation.require(
            "HISTORICAL_ALLOCATION_NOT_A_CURRENT_LEASE" in row.get("authority_note", ""),
            f"overlay authority note lacks historical/current migration boundary: {row.get('slice_id')}",
        )

    def summarize_ids(values: list[str]) -> str:
        sample = ", ".join(values[:8])
        suffix = " ..." if len(values) > 8 else ""
        return f"{len(values)} slice(s): {sample}{suffix}"

    if invalid_effective:
        validation.errors.append(
            "invalid effective migration lineage values in " + summarize_ids(invalid_effective)
        )
    if historical_as_current:
        validation.errors.append(
            "historical migration allocations are treated as current leases in "
            + summarize_ids(historical_as_current)
        )
    if historical_leaks:
        validation.errors.append(
            "historical migration allocation text leaks into effective lineage in "
            + summarize_ids(historical_leaks)
        )

    csv_bytes = csv_path.read_bytes()
    counts = evidence.get("counts", {})
    validation.require(evidence.get("csvPath") == csv_path.name, "overlay evidence csvPath is not portable/exact")
    validation.require(evidence.get("csvBytes") == len(csv_bytes), "overlay evidence csvBytes mismatch")
    validation.require(evidence.get("csvSha256") == sha256_bytes(csv_bytes), "overlay evidence CSV SHA-256 mismatch")
    validation.require(counts.get("rows") == len(rows), "overlay evidence row count mismatch")
    validation.require(counts.get("uniqueSliceIds") == len(set(ids)), "overlay evidence unique ID count mismatch")
    validation.require(counts.get("active") == len(active), "overlay evidence active count mismatch")
    validation.require(counts.get("retired") == len(retired), "overlay evidence retired count mismatch")
    validation.require(counts.get("byModule") == EXPECTED_MODULE_COUNTS, "overlay evidence module counts mismatch")
    validation.require(
        counts.get("byDisposition") == EXPECTED_DISPOSITION_COUNTS,
        "overlay evidence disposition counts mismatch",
    )
    validation.require(
        evidence.get("scope")
        == "READ_ONLY_COMMIT_PIN_EVIDENCE;NO_REPOSITORY_SOURCE_WORKING_TREE_CONTENT_USED;VERSIONED_G1_SUPPLEMENT_INPUT_PINNED_BY_SHA",
        "overlay evidence scope does not distinguish commit pins from the versioned supplement input",
    )
    target_support = evidence.get("supportingRecoveryIntegrity", {}).get(
        "targetFamilyResolutionRegister", {}
    )
    validation.require(
        target_support.get("manifestSha256") == EXPECTED_SUPPLEMENT_MANIFEST_SHA256
        and target_support.get("manifestBindingState") == "FROZEN_PINNED",
        "overlay evidence is not bound to the frozen exact-supplement manifest",
    )
    supplement_manifest_path = csv_path.parent / str(target_support.get("manifestPath", ""))
    validation.require(
        normalized_repo_path(target_support.get("manifestPath"))
        and supplement_manifest_path.is_file()
        and sha256_bytes(supplement_manifest_path.read_bytes())
        == EXPECTED_SUPPLEMENT_MANIFEST_SHA256,
        "frozen exact-supplement manifest path/SHA cannot be reproduced",
    )
    migration_policy = evidence.get("migrationLeasePolicy", {})
    validation.require(
        migration_policy.get("historicalAllocationRowsPreserved") == 100
        and migration_policy.get("currentJitLeaseRequiredRows") == 100
        and migration_policy.get("noMigrationRows") == 2
        and migration_policy.get("overlayGrantsMigrationAdmission") is False,
        "overlay evidence migration authority boundary drifted",
    )
    immutable_authority = migration_policy.get("immutableAdmissionAuthority", {})
    lease_path = csv_path.parent / str(immutable_authority.get("path", ""))
    validation.require(
        normalized_repo_path(immutable_authority.get("path"))
        and lease_path.is_file()
        and immutable_authority.get("bytes") == lease_path.stat().st_size
        and immutable_authority.get("sha256") == sha256_bytes(lease_path.read_bytes()),
        "overlay evidence immutable-admission authority path/bytes/SHA drifted",
    )
    validation.require(
        evidence.get("validation", {}).get("sys007BeforeSys012") is True,
        "overlay evidence does not assert SYS-007 before SYS-012",
    )
    validation.require(
        evidence.get("validation", {}).get("payChainPinned") is True,
        "overlay evidence does not assert the PAY chain",
    )
    validation.require(
        evidence.get("validation", {}).get("overlayStructuralChecksPassed") is True
        and evidence.get("validation", {}).get("knownHistoricalBindingDriftCount") == 1
        and evidence.get("validation", {}).get("currentModuleAuthorizationReady") is False,
        "overlay evidence must preserve the known HRM drift and withhold module authority",
    )
    validation.checks["currentSliceOverlay"] = {
        "status": "PASS" if len(validation.errors) == errors_before else "FAIL",
        "rows": len(rows),
        "active": len(active),
        "retired": len(retired),
        "csvSha256": sha256_bytes(csv_bytes),
    }


def auth_migration_state(backend: Path, commit: str) -> dict[str, Any]:
    directory = "dwp-auth-server/src/main/resources/db/migration"
    output = str(git(backend, "ls-tree", "-r", "--name-only", commit, "--", directory))
    paths = [line for line in output.splitlines() if line.endswith(".sql")]
    versions: list[str] = []
    majors: list[int] = []
    for path in paths:
        match = re.match(r"^V([0-9]+(?:[._][0-9]+)*)__", Path(path).name)
        if not match:
            raise ValueError(f"unparseable Flyway migration filename: {path}")
        version = match.group(1)
        versions.append(version)
        majors.append(int(re.match(r"[0-9]+", version).group(0)))  # type: ignore[union-attr]
    duplicates = sorted(version for version, count in Counter(versions).items() if count > 1)
    return {
        "migrationFileCount": len(paths),
        "duplicateVersions": duplicates,
        "v242Paths": [path for path, major in zip(paths, majors) if major == 242],
        "highestIntegerVersion": max(majors) if majors else None,
    }


def validate_migration_lease(
    validation: Validation,
    lease: dict[str, Any],
    manifest: dict[str, Any],
    backend: Path,
) -> None:
    errors_before = len(validation.errors)
    base_commit = lease.get("backendBaseCommit")
    reconciled_commit = lease.get("backendReconciledCommit")
    backend_manifest = manifest.get("repositories", {}).get("backend", {})
    issued_at = lease.get("issuedAt")
    issued_by = lease.get("issuedBy")
    single_writer = lease.get("singleWriter")
    validation.require(
        lease.get("packetId") == EXPECTED_PACKET_ID,
        "migration lease packetId drifted",
    )
    validation.require(
        lease.get("status") == EXPECTED_LEASE_STATUS,
        f"migration lease status must be {EXPECTED_LEASE_STATUS}",
    )
    validation.require(
        isinstance(issued_at, str)
        and bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", issued_at)),
        "migration lease issuedAt must be a pinned UTC second timestamp",
    )
    validation.require(
        issued_by == EXPECTED_LEASE_WRITER and single_writer == EXPECTED_LEASE_WRITER,
        "migration lease issuedBy/singleWriter authority drifted",
    )
    validation.require(base_commit == backend_manifest.get("currentPin"), "migration lease backend base pin mismatch")
    validation.require(
        reconciled_commit == backend_manifest.get("reconciledPin"),
        "migration lease backend reconciled pin mismatch",
    )

    all_leases = lease.get("leases", [])
    validation.require(isinstance(all_leases, list), "migration leases must be a list")
    if not isinstance(all_leases, list):
        all_leases = []
    auth_leases = [item for item in all_leases if item.get("stream") == "AUTH"]
    validation.require(len(all_leases) == 1, f"expected only the issued AUTH V242 lease, found {len(all_leases)} leases")
    validation.require(len(auth_leases) == 1, f"expected exactly one AUTH lease, found {len(auth_leases)}")
    if auth_leases:
        auth_lease = auth_leases[0]
        expected_allowed_path = (
            "dwp-auth-server/src/main/resources/db/migration/"
            "V242__authorize_exact_payroll_foundation_operations.sql"
        )
        expected_source_path = (
            "dwp-auth-server/src/main/resources/db/migration/"
            "V234__authorize_exact_payroll_foundation_operations.sql"
        )
        validation.require(
            auth_lease.get("versionStart") == "242" and auth_lease.get("versionEnd") == "242",
            "AUTH lease is not exactly V242",
        )
        validation.require(auth_lease.get("status") == "ISSUED_NOT_USED", "AUTH V242 lease is not ISSUED_NOT_USED")
        validation.require(
            auth_lease.get("leaseId") == "HRIS-AUTH-V242-20261006-R1",
            "AUTH V242 leaseId drifted",
        )
        validation.require(
            auth_lease.get("database") == "dwp_auth" and auth_lease.get("schema") == "public",
            "AUTH V242 database/schema drifted",
        )
        validation.require(
            auth_lease.get("issuedAt") == issued_at
            and auth_lease.get("issuedBy") == issued_by,
            "AUTH V242 issuedAt/issuedBy do not match the top-level issuance",
        )
        validation.require(auth_lease.get("baseCommit") == base_commit, "AUTH lease baseCommit mismatch")
        validation.require(
            auth_lease.get("baseBranch") == backend_manifest.get("integrationBranch"),
            "AUTH lease baseBranch mismatch",
        )
        validation.require(
            auth_lease.get("ownerModule") == "SYS_COMMON"
            and auth_lease.get("writer") == EXPECTED_LEASE_WRITER,
            "AUTH V242 owner/writer authority drifted",
        )
        validation.require(
            auth_lease.get("taskPacket") == EXPECTED_PACKET_ID,
            "AUTH V242 taskPacket drifted",
        )
        validation.require(
            auth_lease.get("allowedPath") == expected_allowed_path,
            "AUTH V242 allowedPath drifted",
        )
        validation.require(
            auth_lease.get("sourceEffectPath") == expected_source_path,
            "AUTH V242 sourceEffectPath drifted",
        )
        expected_policies = {
            "rollbackPolicy": (
                "Before application, remove only the uncommitted leased file and record "
                "RELEASED_UNUSED. After application, never edit or delete it; use a new "
                "forward-fix lease."
            ),
            "forwardFixPolicy": (
                "Never edit an applied migration; allocate the next free AUTH version "
                "through a new lease."
            ),
            "expiresWhen": (
                "Packet is superseded, V242 becomes occupied, the base pin drifts, or G2 "
                "rejects the source effect."
            ),
            "unusedVersionPolicy": (
                "Record RELEASED_UNUSED; do not create a placeholder migration."
            ),
        }
        for field, expected in expected_policies.items():
            validation.require(
                auth_lease.get(field) == expected,
                f"AUTH V242 {field} drifted",
            )
        source_blob: bytes | None = None
        try:
            observed_source = git(
                backend,
                "show",
                f"{reconciled_commit}:{expected_source_path}",
                text=False,
            )
            assert isinstance(observed_source, bytes)
            source_blob = observed_source
        except subprocess.CalledProcessError:
            validation.errors.append(
                "AUTH V242 source effect is absent at the reconciled backend pin"
            )
        if source_blob is not None:
            validation.require(
                auth_lease.get("sourceEffectSha256") == sha256_bytes(source_blob),
                "AUTH V242 sourceEffectSha256 does not match the reconciled source effect",
            )
        observed = auth_migration_state(backend, str(base_commit))
        declared = auth_lease.get("validation", {}).get("issuanceEvidence", {})
        for key, value in observed.items():
            validation.require(
                declared.get(key) == value,
                f"AUTH V242 issuance {key} mismatch: declared={declared.get(key)!r}, observed={value!r}",
            )
        validation.require(not observed["duplicateVersions"], "AUTH base has duplicate migration versions")
        validation.require(not observed["v242Paths"], "AUTH V242 is already occupied at the base pin")
        validation.require(observed["highestIntegerVersion"] == 241, "AUTH base highest version is not 241")
        lease_validation = auth_lease.get("validation", {})
        validation.require(
            lease_validation.get("duplicateVersion") == "PASS_AT_ISSUANCE"
            and lease_validation.get("streamOrder") == "PASS_AT_ISSUANCE",
            "AUTH V242 issuance duplicate/order status drifted",
        )
        validation.require(
            lease_validation.get("cleanInstall") == "PENDING_G5_AFTER_INTEGRATION"
            and lease_validation.get("existingDatabaseUpgrade")
            == "PENDING_G5_AFTER_INTEGRATION",
            "AUTH V242 clean-install/upgrade checks must remain pending for G5",
        )

    conditional_leases = lease.get("conditionalLeases", [])
    validation.require(isinstance(conditional_leases, list), "conditionalLeases must be a list")
    if not isinstance(conditional_leases, list):
        conditional_leases = []
    v243 = [
        item
        for item in conditional_leases
        if item.get("stream") == "AUTH" and str(item.get("candidateVersion")) == "243"
    ]
    validation.require(len(v243) == 1, f"expected one conditional AUTH V243 entry, found {len(v243)}")
    validation.require(
        sum(1 for item in conditional_leases if str(item.get("candidateVersion")) == "243") == 1,
        "V243 appears in more than one conditional lease",
    )
    if v243:
        expected_v243 = {
            "status": "NOT_ISSUED",
            "purpose": (
                "Authorization successor seed only if the integrated canonical semantic "
                "source differs from current v34."
            ),
            "issueCondition": (
                "G2 semantic comparison is non-empty and the successor bundle is approved."
            ),
            "prohibition": "Do not create v35 or V243 merely to label the integration.",
        }
        for field, expected in expected_v243.items():
            validation.require(
                v243[0].get(field) == expected,
                f"conditional AUTH V243 {field} drifted",
            )

    immutable = lease.get("immutableArtifactManifest", {})
    validation.require(immutable.get("sourceCommit") == reconciled_commit, "immutable manifest sourceCommit mismatch")
    artifacts = immutable.get("artifacts", [])
    validation.require(len(artifacts) == 16, f"immutable migration count is {len(artifacts)}, expected 16")
    paths = [item.get("path") for item in artifacts]
    validation.require(len(paths) == len(set(paths)), "immutable migration manifest has duplicate paths")
    stream_records: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in artifacts:
        stream = item.get("stream")
        path = item.get("path")
        validation.require(stream in EXPECTED_IMMUTABLE_STREAM_COUNTS, f"unexpected immutable stream: {stream}")
        validation.require(normalized_repo_path(path), f"unsafe immutable migration path: {path!r}")
        if stream not in EXPECTED_IMMUTABLE_STREAM_COUNTS or not normalized_repo_path(path):
            continue
        try:
            blob = git(backend, "show", f"{reconciled_commit}:{path}", text=False)
        except subprocess.CalledProcessError:
            validation.errors.append(f"immutable migration missing at reconciled pin: {path}")
            continue
        assert isinstance(blob, bytes)
        validation.require(item.get("bytes") == len(blob), f"immutable migration byte count mismatch: {path}")
        validation.require(item.get("sha256") == sha256_bytes(blob), f"immutable migration SHA-256 mismatch: {path}")
        stream_records[stream].append(item)

    declared_digests = immutable.get("streamDigests", {})
    for stream, expected_count in EXPECTED_IMMUTABLE_STREAM_COUNTS.items():
        records = sorted(stream_records.get(stream, []), key=lambda item: item["path"])
        validation.require(
            len(records) == expected_count,
            f"immutable {stream} count is {len(records)}, expected {expected_count}",
        )
        digest_input = b"".join(
            f"{item['path']}\0{item['bytes']}\0{item['sha256']}\n".encode("utf-8")
            for item in records
        )
        observed_digest = sha256_bytes(digest_input)
        validation.require(
            declared_digests.get(stream) == observed_digest,
            f"immutable {stream} aggregate digest mismatch",
        )

    validation.checks["migrationAdmissionAndLease"] = {
        "status": "PASS" if len(validation.errors) == errors_before else "FAIL",
        "immutableArtifacts": len(artifacts),
        "sourceCommit": reconciled_commit,
    }


def validate_worktrees(
    validation: Validation,
    manifest: dict[str, Any],
    integration_root: Path,
) -> None:
    errors_before = len(validation.errors)
    results: dict[str, Any] = {}
    for repo_name, repo_data in sorted(manifest.get("repositories", {}).items()):
        path = integration_root / repo_name
        expected_branch = repo_data.get("integrationBranch")
        expected_head = repo_data.get("currentPin")
        validation.require(path.is_dir(), f"integration worktree missing: {path}")
        if not path.is_dir():
            continue
        try:
            branch = git(path, "branch", "--show-current")
            head = git(path, "rev-parse", "HEAD")
            upstream = git(path, "rev-parse", "--abbrev-ref", "@{upstream}")
            upstream_head = git(path, "rev-parse", "@{upstream}")
            status = git(path, "status", "--porcelain", "--untracked-files=all")
        except subprocess.CalledProcessError as exc:
            validation.errors.append(f"{repo_name} integration worktree Git check failed: {exc}")
            continue
        validation.require(branch == expected_branch, f"{repo_name} integration branch mismatch")
        validation.require(head == expected_head, f"{repo_name} integration HEAD mismatch")
        validation.require(upstream == f"origin/{expected_branch}", f"{repo_name} integration upstream mismatch")
        validation.require(upstream_head == head, f"{repo_name} integration upstream is not at HEAD")
        validation.require(status == "", f"{repo_name} integration worktree is dirty")
        results[repo_name] = {
            "branch": branch,
            "head": head,
            "upstream": upstream,
            "clean": status == "",
        }
    validation.checks["integrationWorktrees"] = {
        "status": "PASS" if len(validation.errors) == errors_before else "FAIL",
        "repositories": results,
    }


def walk_digest_entries(value: Any) -> Iterable[dict[str, Any]]:
    if isinstance(value, dict):
        path_key = next((key for key in ("path", "relativePath", "artifactPath", "file") if key in value), None)
        if path_key and "sha256" in value:
            yield {**value, "_path": value[path_key]}
        for child in value.values():
            yield from walk_digest_entries(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk_digest_entries(child)


def resolve_receipt_path(repo_root: Path, docs_dir: Path, value: str) -> Path:
    candidate = Path(value)
    if candidate.is_absolute():
        return candidate
    if candidate.parts and candidate.parts[0] == "docs":
        return repo_root / candidate
    return docs_dir / candidate


def validate_receipt(
    validation: Validation,
    receipt_path: Path,
    repo_root: Path,
    docs_dir: Path,
    require_receipt: bool,
    expected_packet_id: str,
) -> None:
    if not receipt_path.exists():
        if require_receipt:
            validation.errors.append(f"required G1 receipt is absent: {receipt_path}")
        validation.checks["g1ReceiptDigests"] = {
            "status": "FAIL" if require_receipt else "PENDING",
            "reason": "receipt has not been emitted yet",
        }
        return

    errors_before = len(validation.errors)
    receipt = load_json(receipt_path)
    validation.require(
        receipt.get("schema") == EXPECTED_RECEIPT_SCHEMA,
        f"G1 receipt schema must be {EXPECTED_RECEIPT_SCHEMA}",
    )
    validation.require(
        receipt.get("status") == EXPECTED_RECEIPT_STATUS,
        f"G1 receipt status must be {EXPECTED_RECEIPT_STATUS}",
    )
    validation.require(
        receipt.get("packetId") == expected_packet_id == EXPECTED_PACKET_ID,
        "G1 receipt packetId does not match the locked packet",
    )
    authority = receipt.get("authority", {})
    validation.require(isinstance(authority, dict), "G1 receipt authority must be an object")
    if not isinstance(authority, dict):
        authority = {}
    expected_authority = {
        "g2BackendSemanticIntegrationAuthorized": True,
        "moduleParallelDevelopmentAuthorized": False,
        "moduleAuthorizationGate": "G7_PACKET_ISSUANCE",
        "productionReleaseAuthorized": False,
    }
    for key, expected in expected_authority.items():
        validation.require(
            authority.get(key) == expected,
            f"G1 receipt authority {key} must be {expected!r}",
        )
    digest_section = (
        receipt.get("artifactDigests")
        or receipt.get("artifactManifest")
        or receipt.get("artifacts")
    )
    validation.require(digest_section is not None, "G1 receipt has no artifact digest section")
    entries = list(walk_digest_entries(digest_section)) if digest_section is not None else []
    validation.require(entries, "G1 receipt artifact digest section has no path/SHA-256 entries")

    declared_paths: set[str] = set()
    for entry in entries:
        raw_path = entry.get("_path")
        validation.require(isinstance(raw_path, str), f"receipt artifact path is invalid: {raw_path!r}")
        if not isinstance(raw_path, str):
            continue
        path = resolve_receipt_path(repo_root, docs_dir, raw_path).resolve()
        validation.require(path != receipt_path.resolve(), "G1 receipt must not contain a digest of itself")
        validation.require(path.is_file(), f"receipt artifact does not exist: {raw_path}")
        if not path.is_file() or path == receipt_path.resolve():
            continue
        data = path.read_bytes()
        validation.require(entry.get("sha256") == sha256_bytes(data), f"receipt SHA-256 mismatch: {raw_path}")
        if "bytes" in entry:
            validation.require(entry.get("bytes") == len(data), f"receipt byte count mismatch: {raw_path}")
        try:
            declared_paths.add(path.relative_to(repo_root.resolve()).as_posix())
        except ValueError:
            declared_paths.add(path.as_posix())

    required_paths = {
        f"docs/06-delivery/hris/{CONFLICT_MANIFEST}",
        f"docs/06-delivery/hris/{CLUSTER_TEST_MAP}",
        f"docs/06-delivery/hris/{MIGRATION_LEASE}",
        f"docs/06-delivery/hris/{OVERLAY_CSV}",
        f"docs/06-delivery/hris/{OVERLAY_EVIDENCE}",
        f"docs/06-delivery/hris/{G1_WORK_PACKET}",
        f"docs/06-delivery/hris/{RECOVERY_DISPOSITION}",
        f"docs/06-delivery/hris/{SUPPLEMENT_MANIFEST}",
        f"docs/06-delivery/hris/{INTEGRATION_ROADMAP}",
        f"docs/06-delivery/hris/{SOURCE_PROVENANCE}",
        LINEAGE_ADR,
        f"docs/06-delivery/hris/{G0_AUDIT_AMENDMENT}",
    }
    validation.require(
        required_paths.issubset(declared_paths),
        f"G1 receipt is missing core artifact digests: {sorted(required_paths - declared_paths)}",
    )
    validation.checks["g1ReceiptDigests"] = {
        "status": "PASS" if len(validation.errors) == errors_before else "FAIL",
        "declaredArtifacts": len(entries),
    }


def parse_args() -> argparse.Namespace:
    script_path = Path(__file__).resolve()
    default_frontend = script_path.parents[4]
    workspace = default_frontend.parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--frontend", type=Path, default=default_frontend)
    parser.add_argument("--backend", type=Path, default=workspace / "dwp-backend")
    parser.add_argument(
        "--integration-root",
        type=Path,
        default=workspace / ".codex-worktrees/hris/g1-integration-20261006",
    )
    parser.add_argument(
        "--require-receipt",
        action="store_true",
        help="Fail when the final G1 integration-lock receipt is absent.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    frontend = args.frontend.resolve()
    backend = args.backend.resolve()
    integration_root = args.integration_root.resolve()
    docs_dir = frontend / "docs/06-delivery/hris"
    validation = Validation()

    parsed = validate_json_parse(validation, docs_dir)
    manifest = parsed.get(CONFLICT_MANIFEST)
    test_map = parsed.get(CLUSTER_TEST_MAP)
    lease = parsed.get(MIGRATION_LEASE)
    evidence = parsed.get(OVERLAY_EVIDENCE)

    if isinstance(manifest, dict) and isinstance(test_map, dict):
        validation.capture(
            "conflictAndTestMapValidation",
            lambda: validate_conflicts_and_test_map(
                validation,
                manifest,
                test_map,
                {"frontend": frontend, "backend": backend},
            ),
        )
    else:
        validation.errors.append("cannot validate conflicts: manifest or test map is unavailable")

    if isinstance(evidence, dict):
        validation.capture(
            "overlayValidation",
            lambda: validate_overlay(validation, docs_dir / OVERLAY_CSV, evidence),
        )
    else:
        validation.errors.append("cannot validate overlay: evidence JSON is unavailable")

    if isinstance(lease, dict) and isinstance(manifest, dict):
        validation.capture(
            "migrationValidation",
            lambda: validate_migration_lease(validation, lease, manifest, backend),
        )
        validation.capture(
            "worktreeValidation",
            lambda: validate_worktrees(validation, manifest, integration_root),
        )
    else:
        validation.errors.append("cannot validate migration/worktrees: lease or manifest is unavailable")

    validation.capture(
        "receiptValidation",
        lambda: validate_receipt(
            validation,
            docs_dir / G1_RECEIPT,
            frontend,
            docs_dir,
            args.require_receipt,
            manifest.get("packetId", EXPECTED_PACKET_ID)
            if isinstance(manifest, dict)
            else EXPECTED_PACKET_ID,
        ),
    )

    result = {
        "schema": "dwp.hris.g1-lock-targeted-validation-result.v1",
        "result": "PASS" if not validation.errors else "FAIL",
        "checks": validation.checks,
        "errors": validation.errors,
        "receiptRequired": args.require_receipt,
        "scope": "JSON/CSV bytes, pinned Git objects, and integration worktree metadata only; no build or test suite executed",
    }
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    return 0 if not validation.errors else 1


if __name__ == "__main__":
    sys.exit(main())
