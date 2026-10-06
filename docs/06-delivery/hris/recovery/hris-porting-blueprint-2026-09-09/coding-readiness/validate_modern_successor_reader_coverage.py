#!/usr/bin/env python3
"""Audit the exact supported reader/writer inventory for promoted live paths."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
INVENTORY = HERE / "modern-successor-supported-reader-inventory.v5.json"
INVENTORY_SCHEMA = "dwp.hris.modern-successor-supported-reader-inventory.v5"
INVENTORY_PREDECESSOR = {
    "path": "coding-readiness/modern-successor-supported-reader-inventory.v4.json",
    "fileSha256": "40d272662a574e67f16779580822d6c68ce2ceb39868825a96f19a15d58eb08c",
    "sealedPayloadSha256": "6d54e432c4c069338087eb9a944e7ba04da2b7ed3e587eca7a1612bab696b5dd",
    "disposition": "IMMUTABLE_SELF_SEALED_PREDECESSOR_SUPERSEDED_BY_V5_REFRESH",
}

DESTINATION_BASENAMES = {
    "modern-capability-closed-set-manifest.v3.json",
    "sys-listening-stream-authority-successor.v2.json",
    "modern-capability-operation-causal-contract-ssot.v2.json",
    "modern-capability-exact-schema-contracts.v1.json",
    "modern-capability-event-payload-contracts.v1.json",
    "modern-capability-semantic-bindings.v1.json",
    "modern-capability-public-identity-registry.v1.json",
    "modern-capability-causal-state-contracts.v2.json",
    "hrm-modern-forward-ddl.v4.sql",
    "per-modern-forward-ddl.v4.sql",
    "tim-modern-forward-ddl.v4.sql",
    "sys-auth-modern-forward-ddl.v4.sql",
    "sys-platform-modern-forward-ddl.v4.sql",
    "modern-owner-handler-physical-contracts.v4.json",
    "modern-query-projection-physical-contracts.v4.json",
    "physical-candidate-generation-report.v4.json",
}
INFRASTRUCTURE_EXCLUSIONS = {
    "coding-readiness/modern_successor_reader_guard.py",
    "coding-readiness/modern_successor_reader_guard.cjs",
    "coding-readiness/validate_modern_successor_reader_coverage.py",
}
DYNAMIC_DESTINATION_READER_MARKERS = {
    # ``successor_paths`` resolves the same promoted live names without
    # spelling every basename in its caller.  Those callers are active readers
    # and must remain inside the exact inventory as well.
    "successor_paths(",
}
DISPOSITIONS = {
    "GUARDED_DIRECT_ENTRYPOINT",
    "GUARDED_CJS_DIRECT_ENTRYPOINT",
    "GUARDED_LIBRARY_CALLERS_ONLY",
    "CONTROL_WRITER_SELF_GUARDED",
}


def compact_body(payload: dict[str, Any]) -> bytes:
    body = dict(payload)
    body.pop("sealedPayloadSha256", None)
    return json.dumps(
        body, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")


def discover_sources(root: Path = ROOT) -> dict[str, str]:
    result: dict[str, str] = {}
    for base in (root / "coding-readiness", root / "g0"):
        for suffix in ("*.py", "*.js", "*.cjs"):
            for path in base.rglob(suffix):
                relative = path.relative_to(root).as_posix()
                if (
                    relative in INFRASTRUCTURE_EXCLUSIONS
                    or relative.startswith("coding-readiness/reports/")
                    or "/modern-canonical-candidate." in relative
                    or "/modern-physical-candidate." in relative
                    or "__pycache__" in path.parts
                    or path.is_symlink()
                    or not path.is_file()
                ):
                    continue
                source = path.read_text(encoding="utf-8", errors="strict")
                if (
                    any(name in source for name in DESTINATION_BASENAMES)
                    or any(marker in source for marker in DYNAMIC_DESTINATION_READER_MARKERS)
                ):
                    result[relative] = source
    return result


def load_inventory(path: Path = INVENTORY) -> tuple[dict[str, Any], list[str]]:
    errors: list[str] = []
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        return {}, [f"inventory unreadable: {error}"]
    if not isinstance(payload, dict):
        return {}, ["inventory root is not an object"]
    if payload.get("schema") != INVENTORY_SCHEMA:
        errors.append("inventory schema drift")
    expected_seal = hashlib.sha256(compact_body(payload)).hexdigest()
    if payload.get("sealedPayloadSha256") != expected_seal:
        errors.append("inventory self-seal mismatch")
    if payload.get("predecessorInventory") != INVENTORY_PREDECESSOR:
        errors.append("inventory predecessor pin drift")
    return payload, errors


def validate(
    *,
    root: Path = ROOT,
    inventory_path: Path = INVENTORY,
    source_overrides: dict[str, str] | None = None,
) -> dict[str, Any]:
    inventory, errors = load_inventory(inventory_path)
    discovered = discover_sources(root)
    if source_overrides:
        discovered.update(source_overrides)
    entries = inventory.get("entries")
    if not isinstance(entries, list):
        entries = []
        errors.append("inventory entries are not a list")
    by_path: dict[str, dict[str, Any]] = {}
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict):
            errors.append(f"entry {index} is not an object")
            continue
        path = entry.get("path")
        if not isinstance(path, str) or path in by_path:
            errors.append(f"entry {index} path missing or duplicate")
            continue
        by_path[path] = entry
    if set(by_path) != set(discovered):
        errors.append(
            "active reader inventory set drift "
            f"missing={sorted(set(discovered) - set(by_path))} "
            f"extra={sorted(set(by_path) - set(discovered))}"
        )
    disposition_counts = {value: 0 for value in sorted(DISPOSITIONS)}
    for path in sorted(set(by_path) & set(discovered)):
        entry = by_path[path]
        source = discovered[path]
        disposition = entry.get("disposition")
        if disposition not in DISPOSITIONS:
            errors.append(f"{path}: unknown disposition")
            continue
        disposition_counts[str(disposition)] += 1
        digest = hashlib.sha256(source.encode("utf-8")).hexdigest()
        if entry.get("sourceSha256") != digest:
            errors.append(f"{path}: source hash drift")
        if disposition == "GUARDED_DIRECT_ENTRYPOINT":
            marker = (
                "guarded_main(__file__, main)" in source
                or "guarded_main(__file__, lambda:" in source
                or "guarded_modern_successor_read(__file__)" in source
            )
            if not marker:
                errors.append(f"{path}: direct Python entrypoint guard missing")
        elif disposition == "GUARDED_CJS_DIRECT_ENTRYPOINT":
            if "ensureGuardedOrRelaunch(__filename)" not in source:
                errors.append(f"{path}: direct CJS entrypoint guard missing")
        elif disposition == "GUARDED_LIBRARY_CALLERS_ONLY":
            if "require_active_reader_guard(__file__)" not in source:
                errors.append(f"{path}: library guard assertion missing")
            if 'if __name__ == "__main__"' in source or "require.main === module" in source:
                errors.append(f"{path}: guarded library unexpectedly has a direct entrypoint")
        elif disposition == "CONTROL_WRITER_SELF_GUARDED":
            required = (
                "exclusive_host_semaphore(HOST_VERIFICATION_SEMAPHORE" in source,
                '"readerFenceCoverage": "PASS"' in source,
                "_assert_prior_journal_terminal(root)" in source,
            )
            if not all(required):
                errors.append(f"{path}: Control writer self-guard contract drift")
    expected_counts = inventory.get("dispositionCounts")
    if expected_counts != disposition_counts:
        errors.append(
            f"inventory disposition counts drift expected={expected_counts} actual={disposition_counts}"
        )
    if inventory.get("activeSourceCount") != len(discovered):
        errors.append("inventory activeSourceCount drift")
    return {
        "schema": "dwp.hris.modern-successor-reader-coverage-validation.v1",
        "status": "PASS" if not errors else "FAIL",
        "activeSourceCount": len(discovered),
        "inventoryEntryCount": len(by_path),
        "dispositionCounts": disposition_counts,
        "errors": sorted(set(errors)),
    }


def self_test() -> dict[str, Any]:
    import contextlib
    import io
    import runpy
    import sys
    import tempfile
    from unittest import mock

    baseline = validate()
    cases = {
        "current-exact-inventory-passes": baseline["status"] == "PASS",
    }
    if baseline["status"] == "PASS":
        inventory, _errors = load_inventory()
        first = inventory["entries"][0]
        path = first["path"]
        source = (ROOT / path).read_text(encoding="utf-8")
        hostile = source.replace("guarded_main(__file__, main)", "main()", 1)
        if hostile == source:
            hostile = source + "\n# source-drift\n"
        result = validate(source_overrides={path: hostile})
        cases["guard-or-source-drift-rejected"] = result["status"] == "FAIL"
        result = validate(source_overrides={"coding-readiness/new_direct_reader.py": next(iter(DESTINATION_BASENAMES))})
        cases["new-uninventoried-reader-rejected"] = result["status"] == "FAIL"
        guard_dir = str(HERE)
        if guard_dir not in sys.path:
            sys.path.insert(0, guard_dir)
        import modern_successor_reader_guard as reader_guard

        target = ROOT / "coding-readiness/validate_modern_capability_contracts.py"

        def invoke_actual_direct_reader(fence_callback: object) -> tuple[object, str]:
            prior_argv = list(sys.argv)
            stderr = io.StringIO()
            try:
                sys.argv = [str(target), "--help"]
                with (
                    mock.patch.object(
                        reader_guard,
                        "assert_all_central_transactions_committed",
                        side_effect=fence_callback,
                    ),
                    contextlib.redirect_stderr(stderr),
                    contextlib.redirect_stdout(io.StringIO()),
                ):
                    try:
                        runpy.run_path(str(target), run_name="__main__")
                        exit_code: object = 0
                    except SystemExit as error:
                        exit_code = error.code
            finally:
                sys.argv = prior_argv
            return exit_code, stderr.getvalue()

        with tempfile.TemporaryDirectory(prefix="modern-reader-direct-hostile-") as temporary:
            journal = Path(temporary) / "promotion-journal.json"

            def fixture_fence() -> None:
                errors = reader_guard.modern_successor_promotion_errors(journal)
                if errors:
                    raise ValueError("; ".join(errors))

            exit_code, _stderr = invoke_actual_direct_reader(fixture_fence)
            cases["actual-direct-reader-absent-journal-admitted"] = exit_code == 0
            for phase in ("PREPARED", "COMMITTING", "FINALIZING"):
                reader_guard._fixture_journal(journal, phase)
                exit_code, stderr_text = invoke_actual_direct_reader(fixture_fence)
                cases[
                    f"actual-direct-reader-writer-death-{phase.lower()}-blocked"
                ] = (
                    exit_code == 78
                    and "MODERN_SUCCESSOR_READER_FENCE=BLOCKED" in stderr_text
                )
            journal.write_text("{}\n", encoding="utf-8")
            exit_code, stderr_text = invoke_actual_direct_reader(fixture_fence)
            cases["actual-direct-reader-malformed-journal-blocked"] = (
                exit_code == 78
                and "MODERN_SUCCESSOR_READER_FENCE=BLOCKED" in stderr_text
            )
            reader_guard._fixture_journal(journal, "COMMITTED")
            exit_code, _stderr = invoke_actual_direct_reader(fixture_fence)
            cases["actual-direct-reader-committed-journal-admitted"] = exit_code == 0
    else:
        cases["guard-or-source-drift-rejected"] = False
        cases["new-uninventoried-reader-rejected"] = False
        cases["actual-direct-reader-blocked-before-main-after-writer-death"] = False
    failed = sorted(name for name, passed in cases.items() if not passed)
    return {
        "schema": "dwp.hris.modern-successor-reader-coverage-self-test.v1",
        "status": "PASS" if not failed else "FAIL",
        "caseCount": len(cases),
        "passedCount": sum(cases.values()),
        "failedCases": failed,
        "cases": cases,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--compact", action="store_true")
    args = parser.parse_args()
    result = self_test() if args.self_test else validate()
    print(
        json.dumps(
            result,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":") if args.compact else None,
            indent=None if args.compact else 2,
        )
    )
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
