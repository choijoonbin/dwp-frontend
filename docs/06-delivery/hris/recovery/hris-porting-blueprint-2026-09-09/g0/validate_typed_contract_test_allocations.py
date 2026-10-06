#!/usr/bin/env python3
"""Prove every XCON/PDX provider and consumer test has one exact writer allocation."""

from __future__ import annotations

import argparse
import copy
import csv
import fnmatch
import json
from pathlib import Path
from typing import Iterable


G0 = Path(__file__).resolve().parent
ROOT = G0.parent
ALLOCATIONS = ROOT / "coding-readiness/g3-file-allocation-register.csv"
XCON = ROOT / "coding-readiness/cross-module-schema-binding-register.csv"
PDX = ROOT / "coding-readiness/platform-dependency-schema-binding-register.csv"
ACTIVE_STATE = "ALLOCATED_G3_NOT_IMPLEMENTED"


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def parse_session_map(value: str) -> dict[str, str]:
    result: dict[str, str] = {}
    for item in value.split(";"):
        if not item or ":" not in item:
            raise ValueError("typed test map must contain SESSION:path entries")
        session, path = item.split(":", 1)
        if not session or not path or session in result:
            raise ValueError("typed test map has an empty or duplicate entry")
        result[session] = path
    return result


def path_matches(path: str, pattern: str) -> bool:
    # fnmatch's '*' deliberately spans '/' here; the registry treats '**' as a
    # recursive suffix and every typed-test path below is a regular file.
    normalized = pattern.replace("**", "*")
    return fnmatch.fnmatchcase(path, normalized)


def matching_allocations(
    rows: Iterable[dict[str, str]], session: str, dependency: str, path: str
) -> list[str]:
    return sorted(
        row.get("allocation_id", "")
        for row in rows
        if row.get("repository") == "DWP_BACKEND"
        and row.get("session_id") == session
        and row.get("state") == ACTIVE_STATE
        and dependency in {value for value in row.get("dependency_ids", "").split("|") if value}
        and any(path_matches(path, pattern) for pattern in row.get("path_globs", "").split("|") if pattern)
    )


def expected_tests(
    xcon_rows: list[dict[str, str]], pdx_rows: list[dict[str, str]]
) -> list[tuple[str, str, str, str, str]]:
    result: list[tuple[str, str, str, str, str]] = []
    for row in xcon_rows:
        contract = row.get("contract_id", "")
        dependency = row.get("dependency_id", "")
        result.append((contract, "PROVIDER", row.get("producer_session", ""), dependency, row.get("producer_test_allocation", "")))
        for session, path in parse_session_map(row.get("consumer_test_allocations", "")).items():
            result.append((contract, "CONSUMER", session, dependency, path))
    producer_session = {
        "SYS_PLATFORM": "HRIS-SYS",
        "DWP_APPROVAL": "CONTROL",
        "DWP_NOTIFICATION": "CONTROL",
        "DWP_AUDIT": "CONTROL",
    }
    for row in pdx_rows:
        contract = row.get("schema_id", "")
        dependency = row.get("dependency_id", "")
        result.append((contract, "PROVIDER", producer_session.get(row.get("producer", ""), ""), dependency, row.get("producer_test_refs", "")))
        for session, path in parse_session_map(row.get("consumer_test_refs", "")).items():
            result.append((contract, "CONSUMER", session, dependency, path))
    return result


def validate_data(
    allocations: list[dict[str, str]],
    xcon_rows: list[dict[str, str]],
    pdx_rows: list[dict[str, str]],
) -> tuple[list[str], int]:
    errors: list[str] = []
    tests: list[tuple[str, str, str, str, str]]
    try:
        tests = expected_tests(xcon_rows, pdx_rows)
    except ValueError as error:
        return [str(error)], 0
    allocation_ids = [row.get("allocation_id", "") for row in allocations]
    if len(allocation_ids) != len(set(allocation_ids)) or any(not value for value in allocation_ids):
        errors.append("allocation IDs must be nonempty and unique")
    allocations_by_id = {row.get("allocation_id", ""): row for row in allocations}
    for module in ("HRM", "PER", "TIM", "PAY"):
        source = allocations_by_id.get(f"G3-{module}-BE-SOURCE", {})
        test = allocations_by_id.get(f"G3-{module}-BE-TEST", {})
        source_dependencies = {value for value in source.get("dependency_ids", "").split("|") if value}
        test_dependencies = {value for value in test.get("dependency_ids", "").split("|") if value}
        if not source or not test or source_dependencies != test_dependencies:
            errors.append(f"{module}: backend source/test dependency coverage is not exact and bidirectional")
    for source_id, test_id in (
        ("G3-SYS-BE-SOURCE", "G3-SYS-BE-TEST"),
        ("G3-SYS-AUTH-BE-SOURCE", "G3-SYS-AUTH-BE-TEST"),
    ):
        source = allocations_by_id.get(source_id, {})
        test = allocations_by_id.get(test_id, {})
        if (
            not source
            or not test
            or {value for value in source.get("dependency_ids", "").split("|") if value}
            != {value for value in test.get("dependency_ids", "").split("|") if value}
        ):
            errors.append(f"{source_id}: source/test dependency coverage is not exact and bidirectional")
    seen: set[tuple[str, str, str]] = set()
    for contract, role, session, dependency, path in tests:
        where = f"{contract}/{role}/{session}"
        if not contract or not session or not dependency or not path:
            errors.append(f"{where}: incomplete typed test binding")
            continue
        key = (session, role, path)
        if key in seen:
            errors.append(f"{where}: duplicate typed test path binding")
        seen.add(key)
        matches = matching_allocations(allocations, session, dependency, path)
        if len(matches) != 1:
            errors.append(f"{where}: expected exactly one active allocation for {path}; got {matches}")
    return errors, len(tests)


def self_test(
    allocations: list[dict[str, str]],
    xcon_rows: list[dict[str, str]],
    pdx_rows: list[dict[str, str]],
) -> dict[str, object]:
    cases: dict[str, bool] = {}
    base_errors, count = validate_data(allocations, xcon_rows, pdx_rows)
    cases["canonical-provider-consumer-path-closure"] = not base_errors and count > 100

    missing = copy.deepcopy(allocations)
    for row in missing:
        if row.get("allocation_id") == "G3-HRM-BE-TEST":
            row["path_globs"] = "|".join(
                value for value in row["path_globs"].split("|")
                if "hris/contracts/xcon" not in value
            )
    cases["provider-path-outside-allocation-rejected"] = bool(validate_data(missing, xcon_rows, pdx_rows)[0])

    duplicate = copy.deepcopy(allocations)
    source = next(row for row in duplicate if row.get("allocation_id") == "G3-HRM-BE-TEST")
    forged = dict(source)
    forged["allocation_id"] = "G3-HRM-BE-TEST-FORGED-DUPLICATE"
    duplicate.append(forged)
    cases["ambiguous-double-allocation-rejected"] = bool(validate_data(duplicate, xcon_rows, pdx_rows)[0])

    wrong_owner = copy.deepcopy(pdx_rows)
    wrong_owner[0]["producer"] = "DWP_APPROVAL"
    cases["producer-session-rehome-rejected"] = bool(validate_data(allocations, xcon_rows, wrong_owner)[0])

    missing_approval = copy.deepcopy(allocations)
    for row in missing_approval:
        if row.get("allocation_id") == "G3-CTL-BE-GENERATED-HRIS-CONTRACTS":
            row["path_globs"] = "|".join(
                value for value in row["path_globs"].split("|")
                if "dwp-approval-server/src/test" not in value
            )
    cases["approval-provider-allocation-removal-rejected"] = bool(validate_data(missing_approval, xcon_rows, pdx_rows)[0])

    missing_notification = copy.deepcopy(allocations)
    for row in missing_notification:
        if row.get("allocation_id") == "G3-CTL-BE-GENERATED-HRIS-CONTRACTS":
            row["path_globs"] = "|".join(
                value for value in row["path_globs"].split("|")
                if "dwp-notification-server/src/test" not in value
            )
    cases["notification-provider-allocation-removal-rejected"] = bool(validate_data(missing_notification, xcon_rows, pdx_rows)[0])

    missing_audit = copy.deepcopy(allocations)
    for row in missing_audit:
        if row.get("allocation_id") == "G3-CTL-BE-GENERATED-HRIS-CONTRACTS":
            row["path_globs"] = "|".join(
                value for value in row["path_globs"].split("|")
                if "dwp-core/src/test/java/com/dwp/core/audit/hriscontracts" not in value
            )
    cases["audit-provider-allocation-removal-rejected"] = bool(validate_data(missing_audit, xcon_rows, pdx_rows)[0])

    source_test_dep_drift = copy.deepcopy(allocations)
    next(row for row in source_test_dep_drift if row.get("allocation_id") == "G3-PAY-BE-TEST")["dependency_ids"] = "DEP-001"
    cases["module-test-dependency-closure-drift-rejected"] = bool(validate_data(source_test_dep_drift, xcon_rows, pdx_rows)[0])

    return {
        "schema": "dwp.hris.typed-contract-test-allocation-self-test.v1",
        "status": "PASS" if all(cases.values()) else "FAIL",
        "caseCount": len(cases),
        "passedCount": sum(cases.values()),
        "cases": cases,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--compact", action="store_true")
    args = parser.parse_args()
    try:
        allocations = read_csv(ALLOCATIONS)
        xcon_rows = read_csv(XCON)
        pdx_rows = read_csv(PDX)
        if args.self_test:
            payload = self_test(allocations, xcon_rows, pdx_rows)
        else:
            errors, count = validate_data(allocations, xcon_rows, pdx_rows)
            payload = {
                "schema": "dwp.hris.typed-contract-test-allocation.v1",
                "status": "PASS" if not errors else "FAIL",
                "typedTestBindingCount": count,
                "errors": errors,
            }
    except (OSError, csv.Error, ValueError) as error:
        payload = {
            "schema": "dwp.hris.typed-contract-test-allocation.v1",
            "status": "FAIL",
            "errors": [str(error)],
        }
    print(json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":") if args.compact else None, indent=None if args.compact else 2))
    return 0 if payload.get("status") == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
