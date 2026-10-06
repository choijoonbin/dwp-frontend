#!/usr/bin/env python3
"""Validate Control ownership and the exact TIM read-only shared UI edge."""

from __future__ import annotations

import argparse
import copy
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HERE = Path(__file__).resolve().parent
REGISTER = HERE / "frontend-shared-presentation-binding-register.csv"
OWNERSHIP = ROOT / "g0/file-ownership-register.csv"
ALLOCATIONS = HERE / "g3-file-allocation-register.csv"
WORKTREES = ROOT / "g0/worktree-branch-register.csv"

HEADER = [
    "binding_id", "canonical_path", "canonical_export_path", "owner_session",
    "owner_allocation_id", "consumer_sessions", "consumer_source_paths",
    "consumer_test_paths", "import_specifier", "delivery_state", "production_state",
]
EXPECTED = {
    "binding_id": "FE-SHARED-001",
    "canonical_path": "apps/dwp/src/features/hris/shared/components/hris-domain-components.tsx",
    "canonical_export_path": "apps/dwp/src/features/hris/shared/index.ts",
    "owner_session": "CONTROL",
    "owner_allocation_id": "G3-CTL-FE-HRIS-SHARED",
    "consumer_sessions": "HRIS-TIM",
    "consumer_source_paths": (
        "apps/dwp/src/features/hris/time/components/hris-time-calendar.tsx|"
        "apps/dwp/src/features/hris/time/components/hris-time-sections.tsx|"
        "apps/dwp/src/features/hris/time/pages/hris-time-workspace.tsx"
    ),
    "consumer_test_paths": "apps/dwp/src/features/hris/time/testing/hris-time-workspace.runtime.test.tsx",
    "import_specifier": "../../shared",
    "delivery_state": "BASELINE_COMPONENT_PRESENT_CONTROL_EXPORT_AND_CONTRACT_TEST_REQUIRED_G3",
    "production_state": "NOT_AUTHORIZED_G6",
}
OWNER_PATHS = (
    "apps/dwp/src/features/hris/shared/components/hris-domain-components.tsx|"
    "apps/dwp/src/features/hris/shared/index.ts|"
    "apps/dwp/src/features/hris/shared/testing/hris-domain-components.contract.test.tsx"
)
VERIFICATION_PATHS = (
    "apps/dwp/src/features/hris/shared/testing/hris-domain-components.contract.test.tsx|"
    "apps/dwp/src/features/hris/time/testing/hris-time-workspace.runtime.test.tsx"
)


def split(value: str) -> set[str]:
    return {part for part in value.split("|") if part}


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        return list(reader.fieldnames or []), list(reader)


def current_frontend_root(worktrees: list[dict[str, str]]) -> Path:
    matches = [
        row for row in worktrees
        if row.get("session_id") == "CONTROL" and row.get("repository") == "DWP_FRONTEND"
    ]
    if len(matches) != 1:
        raise ValueError("CONTROL frontend worktree must be exact-one")
    return Path(matches[0]["worktree_path"])


def source_importers(frontend: Path, specifier: str) -> set[str]:
    root = frontend / "apps/dwp/src/features/hris"
    found: set[str] = set()
    for path in root.rglob("*"):
        if path.is_file() and path.suffix in {".ts", ".tsx"}:
            try:
                text = path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue
            if specifier in text:
                found.add(path.relative_to(frontend).as_posix())
    return found


def allocation_touches_shared(row: dict[str, str]) -> bool:
    return any(
        path == "apps/dwp/src/features/hris/shared/**"
        or path.startswith("apps/dwp/src/features/hris/shared/")
        for path in split(row.get("path_globs", ""))
    )


def validate(
    bindings: list[dict[str, str]] | None = None,
    ownership: list[dict[str, str]] | None = None,
    allocations: list[dict[str, str]] | None = None,
    importers: set[str] | None = None,
) -> list[str]:
    errors: list[str] = []
    header, disk_bindings = read_csv(REGISTER)
    bindings = disk_bindings if bindings is None else bindings
    ownership = read_csv(OWNERSHIP)[1] if ownership is None else ownership
    allocations = read_csv(ALLOCATIONS)[1] if allocations is None else allocations
    worktrees = read_csv(WORKTREES)[1]
    if header != HEADER:
        errors.append("binding header drift")
    if bindings != [EXPECTED]:
        errors.append("shared presentation binding must equal exact Control/TIM contract")
    owners = [row for row in ownership if row.get("ownership_id") == "OWN-FE-CENTRAL-HRIS-SHARED"]
    if len(owners) != 1 or not (
        owners[0].get("repository") == "DWP_FRONTEND"
        and owners[0].get("session_id") == "CONTROL"
        and owners[0].get("path_glob") == OWNER_PATHS
        and owners[0].get("path_class") == "CENTRAL_SINGLE_WRITER"
        and owners[0].get("allowed_operations") == "CREATE|MODIFY"
        and owners[0].get("writer_role") == "ROLE.INTEGRATION_CONTROL"
        and owners[0].get("status") == "ACTIVE_G3_CODE"
    ):
        errors.append("shared presentation ownership drift")
    selected = [row for row in allocations if row.get("allocation_id") == EXPECTED["owner_allocation_id"]]
    if len(selected) != 1 or not (
        selected[0].get("session_id") == "CONTROL"
        and selected[0].get("repository") == "DWP_FRONTEND"
        and selected[0].get("artifact_class") == "CENTRAL_SHARED_PRESENTATION"
        and selected[0].get("path_globs") == OWNER_PATHS
        and selected[0].get("verification_globs") == VERIFICATION_PATHS
        and selected[0].get("writer_role") == "ROLE.INTEGRATION_CONTROL"
        and selected[0].get("g0_ownership_ids") == "OWN-FE-CENTRAL-HRIS-SHARED"
        and selected[0].get("dependency_ids") == "DEP-011|DEP-012"
        and selected[0].get("state") == "ALLOCATED_G3_NOT_IMPLEMENTED"
    ):
        errors.append("shared presentation allocation drift")
    overlapping = [
        row.get("allocation_id", "") for row in allocations
        if row.get("session_id") != "CONTROL" and allocation_touches_shared(row)
    ]
    if overlapping:
        errors.append("module allocation may not write shared presentation paths")
    try:
        frontend = current_frontend_root(worktrees)
        canonical = frontend / EXPECTED["canonical_path"]
        if not canonical.is_file() or canonical.is_symlink():
            errors.append("canonical shared presentation source missing or non-regular")
        export_path = frontend / EXPECTED["canonical_export_path"]
        if not export_path.is_file() or export_path.is_symlink():
            errors.append("canonical shared presentation public export missing or non-regular")
        for relative_path in split(EXPECTED["consumer_test_paths"]):
            test_path = frontend / relative_path
            if not test_path.is_file() or test_path.is_symlink():
                errors.append("shared presentation consumer test missing or non-regular")
        actual_importers = source_importers(frontend, EXPECTED["import_specifier"]) if importers is None else importers
        expected_importers = split(EXPECTED["consumer_source_paths"]) | split(EXPECTED["consumer_test_paths"])
        if actual_importers != expected_importers:
            errors.append("shared presentation importer set differs from exact TIM read-only edge")
        clones = {
            path.relative_to(frontend).as_posix()
            for path in (frontend / "apps/dwp/src/features/hris").rglob("hris-domain-components.tsx")
            if path.is_file()
        }
        if clones != {EXPECTED["canonical_path"]}:
            errors.append("shared presentation implementation clone detected")
    except (OSError, ValueError) as error:
        errors.append(f"frontend source inspection failed: {error}")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--compact", action="store_true")
    args = parser.parse_args()
    bindings = read_csv(REGISTER)[1]
    ownership = read_csv(OWNERSHIP)[1]
    allocations = read_csv(ALLOCATIONS)[1]
    errors = validate(bindings, ownership, allocations)
    cases: dict[str, bool] = {}
    if args.self_test and not errors:
        bad = copy.deepcopy(ownership)
        next(row for row in bad if row["ownership_id"] == "OWN-FE-CENTRAL-HRIS-SHARED")["session_id"] = "HRIS-TIM"
        cases["owner-rehome-to-consumer-rejected"] = bool(validate(bindings, bad, allocations))
        bad = copy.deepcopy(allocations)
        next(row for row in bad if row["allocation_id"] == "G3-TIM-FE-SOURCE")["path_globs"] += "|apps/dwp/src/features/hris/shared/**"
        cases["module-shared-write-overlap-rejected"] = bool(validate(bindings, ownership, bad))
        bad = copy.deepcopy(bindings); bad[0]["consumer_test_paths"] = ""
        cases["consumer-test-omission-rejected"] = bool(validate(bad, ownership, allocations))
        expected_importers = split(EXPECTED["consumer_source_paths"]) | split(EXPECTED["consumer_test_paths"])
        cases["unexpected-cross-module-importer-rejected"] = bool(
            validate(bindings, ownership, allocations, expected_importers | {"apps/dwp/src/features/hris/payroll/clone.tsx"})
        )
        cases["exact-control-tim-boundary-valid"] = not validate(bindings, ownership, allocations)
        if not all(cases.values()):
            errors.append("frontend shared presentation mutation accepted")
    payload = {
        "schema": "dwp.hris.frontend-shared-presentation-boundary.v1",
        "status": "PASS" if not errors else "FAIL",
        "bindingCount": len(bindings),
        "selfTests": len(cases),
        "cases": cases,
        "errors": errors,
    }
    print(json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":") if args.compact else None))
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
