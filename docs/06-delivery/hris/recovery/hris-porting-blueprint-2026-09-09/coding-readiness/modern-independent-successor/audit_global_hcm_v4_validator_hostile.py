#!/usr/bin/env python3
"""Independent hostile probes for the global-HCM v4/131 validator.

The candidate is immutable mutation substrate only.  Every mutation is applied
to a deep-copied JSON object or to an intercepted authority-file read.  This
program never writes candidate, policy, canonical, physical, or Gate inputs.
"""

from __future__ import annotations

import argparse
import copy
import importlib.util
import json
import sys
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Iterator, Mapping, Sequence


HERE = Path(__file__).resolve().parent
VALIDATOR_PATH = HERE / "validate_global_hcm_live_acceptance.py"
DEFAULT_REPORT = HERE / "reports/global-hcm-v4-validator-hostile-audit-latest.v1.json"


def load_validator() -> Any:
    spec = importlib.util.spec_from_file_location("global_hcm_v4_validator_under_review", VALIDATOR_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("cannot load validator under review")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def canonical_json(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def load_candidate(
    module: Any, directory: Path,
) -> tuple[dict[str, dict[str, Any]], dict[str, str], dict[str, str]]:
    docs: dict[str, dict[str, Any]] = {}
    hashes: dict[str, str] = {}
    paths: dict[str, str] = {}
    for role, basename in module.CANONICAL_FILENAMES.items():
        path = (directory / basename).resolve()
        raw = path.read_bytes()
        docs[role] = json.loads(raw.decode("utf-8"))
        hashes[role] = module.sha256_bytes(raw)
        paths[role] = str(path)
    return docs, hashes, paths


def target_present(issues: Sequence[Any], rules: set[str], subject: str | None = None) -> bool:
    return any(row.rule_id in rules and (subject is None or row.subject_id == subject) for row in issues)


def source_issues(
    module: Any,
    docs: Mapping[str, dict[str, Any]],
    audit: dict[str, Any],
    hashes: Mapping[str, str],
    paths: Mapping[str, str],
) -> list[Any]:
    evaluator = module.Evaluator(module.Model(docs, hashes, paths), audit)
    evaluator.check_source_integrity()
    return evaluator.issues


def closed_set_issues(module: Any, docs: Mapping[str, dict[str, Any]], audit: dict[str, Any]) -> list[Any]:
    evaluator = module.Evaluator(module.Model(docs), audit)
    evaluator.check_closed_sets()
    return evaluator.issues


@contextmanager
def intercepted_path(target: Path, replacement: bytes) -> Iterator[None]:
    original_bytes = Path.read_bytes
    original_text = Path.read_text
    resolved_target = target.resolve()

    def replacement_bytes(path: Path) -> bytes:
        return replacement if path.resolve() == resolved_target else original_bytes(path)

    def replacement_text(path: Path, *args: Any, **kwargs: Any) -> str:
        if path.resolve() == resolved_target:
            return replacement.decode(kwargs.get("encoding") or "utf-8")
        return original_text(path, *args, **kwargs)

    Path.read_bytes = replacement_bytes
    Path.read_text = replacement_text
    try:
        yield
    finally:
        Path.read_bytes = original_bytes
        Path.read_text = original_text


def file_authority_probe(
    module: Any,
    docs: Mapping[str, dict[str, Any]],
    audit: dict[str, Any],
    hashes: Mapping[str, str],
    paths: Mapping[str, str],
    *,
    test_id: str,
    target: Path,
    mutate: Callable[[dict[str, Any]], None],
    rules: set[str],
) -> dict[str, Any]:
    value = json.loads(target.read_text(encoding="utf-8"))
    mutate(value)
    before = source_issues(module, docs, audit, hashes, paths)
    with intercepted_path(target, canonical_json(value)):
        after = source_issues(module, docs, audit, hashes, paths)
    clear = not target_present(before, rules)
    detected = target_present(after, rules)
    return {
        "testId": test_id,
        "expectedRuleIds": sorted(rules),
        "positiveControl": "PASS" if clear else "FAIL",
        "hostileMutation": "FAIL_DETECTED" if detected else "MISSED",
        "detectedRuleIds": sorted({row.rule_id for row in after if row.rule_id in rules}),
        "status": "PASS" if clear and detected else "FAIL",
    }


def expected_manifest_pin(module: Any) -> dict[str, Any]:
    return {
        "path": "modern-independent-successor/global-hcm-table-expansion-acceptance-policy.v4.json",
        "fileSha256": module.EXPECTED_EXPANSION_POLICY_SHA256,
        "sealedPayloadSha256": module.EXPECTED_EXPANSION_POLICY_SEAL,
        "predecessorPolicySha256": module.EXPECTED_PREDECESSOR_POLICY_SHA256,
        "predecessorPolicySealedPayloadSha256": module.EXPECTED_PREDECESSOR_POLICY_SEAL,
        "independentReviewSha256": module.EXPECTED_SCOPE_REVIEW_SHA256,
        "scopeReductionReviewSha256": module.EXPECTED_SCOPE_REDUCTION_REVIEW_SHA256,
    }


def reseal_manifest(module: Any, manifest: dict[str, Any]) -> None:
    manifest["sealedPayloadSha256"] = module.sealed_payload_sha256(manifest)


def manifest_pin_probe(
    module: Any,
    docs: Mapping[str, dict[str, Any]],
    audit: dict[str, Any],
    hashes: Mapping[str, str],
    paths: Mapping[str, str],
    *,
    test_id: str,
    replacement_pin: dict[str, Any],
) -> dict[str, Any]:
    control = copy.deepcopy(dict(docs))
    control["manifest"].setdefault("tableScopeChange", {})["acceptancePolicy"] = expected_manifest_pin(module)
    reseal_manifest(module, control["manifest"])
    before = source_issues(module, control, audit, hashes, paths)
    hostile = copy.deepcopy(control)
    hostile["manifest"]["tableScopeChange"]["acceptancePolicy"] = replacement_pin
    reseal_manifest(module, hostile["manifest"])
    after = source_issues(module, hostile, audit, hashes, paths)
    rules = {"SOURCE.MANIFEST_EXPANSION_POLICY_PIN"}
    clear = not target_present(before, rules, "manifest.tableScopeChange.acceptancePolicy")
    detected = target_present(after, rules, "manifest.tableScopeChange.acceptancePolicy")
    return {
        "testId": test_id,
        "expectedRuleIds": sorted(rules),
        "positiveControl": "PASS" if clear else "FAIL",
        "hostileMutation": "FAIL_DETECTED" if detected else "MISSED",
        "status": "PASS" if clear and detected else "FAIL",
    }


def prepare_v4_scope(module: Any, docs: Mapping[str, dict[str, Any]]) -> dict[str, dict[str, Any]]:
    result = copy.deepcopy(dict(docs))
    removed = next(iter(module.EXPECTED_REMOVED_TABLES))
    result["exact"]["tableSpecifications"] = [
        row for row in result["exact"].get("tableSpecifications", []) if row.get("tableName") != removed
    ]
    manifest = result["manifest"]
    manifest["tableIds"] = [value for value in manifest.get("tableIds", []) if value != removed]
    policy = module.load_json(module.EXPANSION_POLICY_PATH)
    rows = {row["tableId"]: copy.deepcopy(row) for row in policy["successorScope"]["addedRows"]}
    manifest["tableScopeChange"] = {
        "previousTableSetSha256": module.FROZEN_115_TABLE_SET_SHA256,
        "previousTableSpecifications": 115,
        "activeTableSpecifications": module.EXPECTED_SUCCESSOR_TABLE_COUNT,
        "deltaCount": module.EXPECTED_ADDITION_COUNT,
        "netDelta": module.EXPECTED_NET_DELTA,
        "addedTableIds": sorted(module.EXPECTED_GLOBAL_EXPANSION_TABLES),
        "removedTableIds": sorted(module.EXPECTED_REMOVED_TABLES),
        "removalDisposition": copy.deepcopy(policy["successorScope"]["removalDisposition"]),
        "reason": "HOSTILE_AUDIT_POSITIVE_CONTROL_EXACT_V4_SCOPE",
        "rows": rows,
        "acceptancePolicy": expected_manifest_pin(module),
    }
    reseal_manifest(module, manifest)
    return result


def scope_probe(
    module: Any,
    docs: Mapping[str, dict[str, Any]],
    audit: dict[str, Any],
    *,
    test_id: str,
    rule: str,
    mutate: Callable[[dict[str, dict[str, Any]]], None],
) -> dict[str, Any]:
    control = prepare_v4_scope(module, docs)
    before = closed_set_issues(module, control, audit)
    hostile = copy.deepcopy(control)
    mutate(hostile)
    after = closed_set_issues(module, hostile, audit)
    clear = not target_present(before, {rule}, "tables")
    detected = target_present(after, {rule}, "tables")
    return {
        "testId": test_id,
        "expectedRuleId": rule,
        "positiveControl": "PASS" if clear else "FAIL",
        "hostileMutation": "FAIL_DETECTED" if detected else "MISSED",
        "status": "PASS" if clear and detected else "FAIL",
    }


def scrub_removed(value: Any, removed: str, replacement: str) -> Any:
    if isinstance(value, list):
        result = []
        for item in value:
            if item == removed or (isinstance(item, dict) and item.get("tableName") == removed):
                continue
            result.append(scrub_removed(item, removed, replacement))
        return result
    if isinstance(value, dict):
        return {
            key: scrub_removed(item, removed, replacement)
            for key, item in value.items()
            if removed not in str(key)
        }
    if isinstance(value, str):
        return value.replace(removed, replacement)
    return value


def prepare_removed_reference_control(
    module: Any, docs: Mapping[str, dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    result = prepare_v4_scope(module, docs)
    removed = next(iter(module.EXPECTED_REMOVED_TABLES))
    replacement = "sys_hris_analytics_export_receipts"
    saved_scope = copy.deepcopy(result["manifest"]["tableScopeChange"])
    for role in result:
        result[role] = scrub_removed(result[role], removed, replacement)
    result["manifest"]["tableScopeChange"] = saved_scope
    reseal_manifest(module, result["manifest"])
    return result


def removed_reference_probe(module: Any, docs: Mapping[str, dict[str, Any]], audit: dict[str, Any]) -> dict[str, Any]:
    control = prepare_removed_reference_control(module, docs)
    before = closed_set_issues(module, control, audit)
    hostile = copy.deepcopy(control)
    hostile["semantic"]["hostileDanglingRemovedTable"] = next(iter(module.EXPECTED_REMOVED_TABLES))
    after = closed_set_issues(module, hostile, audit)
    rule = "SET.REMOVED_TABLE_DANGLING_REFERENCE"
    clear = not target_present(before, {rule}, "tables")
    detected = target_present(after, {rule}, "tables")
    return {
        "testId": "removed_table_dangling_reference_rejected",
        "expectedRuleId": rule,
        "positiveControl": "PASS" if clear else "FAIL",
        "hostileMutation": "FAIL_DETECTED" if detected else "MISSED",
        "status": "PASS" if clear and detected else "FAIL",
    }


def dangling_fk_probe(module: Any, docs: Mapping[str, dict[str, Any]], audit: dict[str, Any]) -> dict[str, Any]:
    control = prepare_removed_reference_control(module, docs)
    before = closed_set_issues(module, control, audit)
    hostile = copy.deepcopy(control)
    table = hostile["exact"]["tableSpecifications"][0]
    table.setdefault("foreignKeys", []).append({
        "constraintId": "hostile_removed_target_fk",
        "mode": "LOCAL_COMPOSITE_FK",
        "columns": ["tenant_id", table["idColumn"]["name"]],
        "target": next(iter(module.EXPECTED_REMOVED_TABLES)),
        "targetColumns": ["tenant_id", "public_id"],
    })
    after = closed_set_issues(module, hostile, audit)
    rule = "SET.DANGLING_FOREIGN_KEY"
    clear = not target_present(before, {rule}, "tables")
    detected = target_present(after, {rule}, "tables")
    return {
        "testId": "removed_table_dangling_fk_rejected",
        "expectedRuleId": rule,
        "positiveControl": "PASS" if clear else "FAIL",
        "hostileMutation": "FAIL_DETECTED" if detected else "MISSED",
        "status": "PASS" if clear and detected else "FAIL",
    }


def core_selftest_probe(module: Any, docs: Mapping[str, dict[str, Any]], audit: dict[str, Any]) -> dict[str, Any]:
    tests = module.run_self_tests()
    _, first = module.evaluate_docs(docs, audit)
    _, second = module.evaluate_docs(docs, audit)
    tests.append({
        "testId": "live_baseline_deterministic",
        "status": "PASS" if canonical_json([row.as_dict() for row in first]) == canonical_json([row.as_dict() for row in second]) else "FAIL",
    })
    tests.extend(module.run_targeted_mutation_tests(docs, audit))
    passed = len(tests) == module.EXPECTED_SELF_TEST_COUNT and all(row["status"] == "PASS" for row in tests)
    return {
        "testId": "core_selftests_exact_35_of_35",
        "expected": module.EXPECTED_SELF_TEST_COUNT,
        "actual": len(tests),
        "passed": sum(row["status"] == "PASS" for row in tests),
        "failedTestIds": [row["testId"] for row in tests if row["status"] != "PASS"],
        "status": "PASS" if passed else "FAIL",
    }


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--candidate-dir", type=Path, required=True)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args(argv)

    module = load_validator()
    candidate_dir = args.candidate_dir.expanduser().resolve()
    docs, hashes_before, paths = load_candidate(module, candidate_dir)
    audit = module.load_json(module.FROZEN_AUDIT)
    tests: list[dict[str, Any]] = []

    tests.append(file_authority_probe(
        module, docs, audit, hashes_before, paths,
        test_id="v4_policy_bytes_and_seal_drift_rejected",
        target=module.EXPANSION_POLICY_PATH,
        mutate=lambda value: value.__setitem__("status", "HOSTILE_FORGED"),
        rules={"SOURCE.EXPANSION_POLICY_FILE", "SOURCE.EXPANSION_POLICY_SEAL"},
    ))
    tests.append(file_authority_probe(
        module, docs, audit, hashes_before, paths,
        test_id="v3_predecessor_pin_drift_rejected",
        target=module.PREDECESSOR_POLICY_PATH,
        mutate=lambda value: value.__setitem__("status", "HOSTILE_FORGED"),
        rules={"SOURCE.EXPANSION_POLICY_PREDECESSOR_FILE", "SOURCE.EXPANSION_POLICY_PREDECESSOR_SEAL"},
    ))
    tests.append(file_authority_probe(
        module, docs, audit, hashes_before, paths,
        test_id="v2_grandpredecessor_pin_drift_rejected",
        target=module.GRANDPREDECESSOR_POLICY_PATH,
        mutate=lambda value: value.__setitem__("status", "HOSTILE_FORGED"),
        rules={"SOURCE.EXPANSION_POLICY_V2_FILE", "SOURCE.EXPANSION_POLICY_V2_SEAL"},
    ))
    tests.append(file_authority_probe(
        module, docs, audit, hashes_before, paths,
        test_id="scope_reduction_decision_pin_drift_rejected",
        target=module.SCOPE_REDUCTION_REVIEW_PATH,
        mutate=lambda value: value.__setitem__("status", "HOSTILE_FORGED"),
        rules={"SOURCE.SCOPE_REDUCTION_REVIEW_FILE", "SOURCE.SCOPE_REDUCTION_REVIEW_SEAL"},
    ))

    forged_pin = expected_manifest_pin(module)
    forged_pin["fileSha256"] = "0" * 64
    tests.append(manifest_pin_probe(
        module, docs, audit, hashes_before, paths,
        test_id="manifest_v4_policy_pin_drift_rejected", replacement_pin=forged_pin,
    ))
    legacy_pin = {
        "path": "modern-independent-successor/global-hcm-table-expansion-acceptance-policy.v3.json",
        "fileSha256": module.EXPECTED_PREDECESSOR_POLICY_SHA256,
        "sealedPayloadSha256": module.EXPECTED_PREDECESSOR_POLICY_SEAL,
    }
    tests.append(manifest_pin_probe(
        module, docs, audit, hashes_before, paths,
        test_id="manifest_v3_v4_mode_confusion_rejected", replacement_pin=legacy_pin,
    ))
    tests.append(scope_probe(
        module, docs, audit,
        test_id="active_table_count_spoof_rejected",
        rule="SET.TABLE_EXPANSION_AUTHORITY",
        mutate=lambda value: value["manifest"]["tableScopeChange"].__setitem__("activeTableSpecifications", 132),
    ))
    tests.append(removed_reference_probe(module, docs, audit))
    tests.append(dangling_fk_probe(module, docs, audit))
    tests.append(core_selftest_probe(module, docs, audit))

    hashes_after = {role: module.sha256_file(Path(path)) for role, path in paths.items()}
    policy_v4 = module.load_json(module.EXPANSION_POLICY_PATH)
    policy_v3 = module.load_json(module.PREDECESSOR_POLICY_PATH)
    policy_v2 = module.load_json(module.GRANDPREDECESSOR_POLICY_PATH)
    unchanged = hashes_before == hashes_after
    all_pass = all(row["status"] == "PASS" for row in tests)
    report = {
        "reportId": "DWP-HRIS-GLOBAL-HCM-V4-VALIDATOR-HOSTILE-AUDIT-V1",
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "authorityBoundary": "INDEPENDENT_VALIDATOR_REVIEW_NOT_G3_AUTHORITY",
        "validator": {
            "path": str(VALIDATOR_PATH.resolve()),
            "sha256": module.sha256_file(VALIDATOR_PATH),
            "requiredCardinality": {
                "operations": 199, "commands": 133, "queries": 66,
                "handlers": 27, "events": 157, "tables": 131,
            },
        },
        "policyChain": {
            "v4": {
                "path": str(module.EXPANSION_POLICY_PATH.resolve()),
                "sha256": module.sha256_file(module.EXPANSION_POLICY_PATH),
                "declaredSeal": policy_v4.get("sealedPayloadSha256"),
                "computedSeal": module.sealed_payload_sha256(policy_v4),
            },
            "v3": {
                "path": str(module.PREDECESSOR_POLICY_PATH.resolve()),
                "sha256": module.sha256_file(module.PREDECESSOR_POLICY_PATH),
                "declaredSeal": policy_v3.get("sealedPayloadSha256"),
                "computedSeal": module.sealed_payload_sha256(policy_v3),
            },
            "v2": {
                "path": str(module.GRANDPREDECESSOR_POLICY_PATH.resolve()),
                "sha256": module.sha256_file(module.GRANDPREDECESSOR_POLICY_PATH),
                "declaredSeal": policy_v2.get("sealedPayloadSha256"),
                "computedSeal": module.sealed_payload_sha256(policy_v2),
            },
        },
        "candidateSubstrate": {
            "directory": str(candidate_dir),
            "role": "IMMUTABLE_MUTATION_SUBSTRATE_NOT_V4_CANDIDATE_ACCEPTANCE",
            "sources": {
                role: {"path": paths[role], "sha256Before": hashes_before[role], "sha256After": hashes_after[role]}
                for role in sorted(paths)
            },
        },
        "tests": tests,
        "summary": {
            "status": "PASS_HOSTILE_VALIDATOR_AUDIT" if all_pass and unchanged else "FAIL_HOSTILE_VALIDATOR_AUDIT",
            "testCount": len(tests),
            "passed": sum(row["status"] == "PASS" for row in tests),
            "failed": sum(row["status"] != "PASS" for row in tests),
            "candidateBytesUnchanged": unchanged,
            "notGateAuthority": True,
        },
    }
    report["sealedPayloadSha256"] = module.sha256_bytes(canonical_json(report))
    if not args.check:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(report["summary"], ensure_ascii=False, sort_keys=True))
    return 0 if report["summary"]["status"] == "PASS_HOSTILE_VALIDATOR_AUDIT" else 1


if __name__ == "__main__":
    raise SystemExit(main())
