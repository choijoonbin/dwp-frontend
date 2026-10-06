#!/usr/bin/env python3
"""Prove every ADDSK inventory row is closed by one exact retire decision trace."""

from __future__ import annotations

import argparse
import copy
import csv
import json
import re
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent.parent
REGISTER = ROOT / "customer-specific-contamination-register.csv"
HEADER = [
    "source_module", "source_file", "marker", "matched_line_count",
    "coverage_parent", "coverage_child_id", "decision_id", "target_capability",
    "required_disposition", "current_status", "notes",
]
MODULES = {
    "pay": ("HRIS-PAY", "PAY-DEC-012", ROOT / "session-evidence/pay/g1-child-trace.csv", ROOT / "session-evidence/pay/g1-decision-log.csv"),
    "tim": ("HRIS-TIM", "TIM-DEC-011", ROOT / "session-evidence/tim/g1-child-trace.csv", ROOT / "session-evidence/tim/g1-decision-log.csv"),
}


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        return list(reader.fieldnames or []), list(reader)


def validate_data(
    header: list[str],
    rows: list[dict[str, str]],
    children_by_module: dict[str, list[dict[str, str]]],
    decisions_by_module: dict[str, list[dict[str, str]]],
) -> list[str]:
    errors: list[str] = []
    require = lambda condition, message: None if condition else errors.append(message)
    require(header == HEADER, "contamination register header drift")
    require(len(rows) == 13, f"contamination register must contain exact 13 rows; got {len(rows)}")
    require(
        {module: sum(row.get("source_module") == module for row in rows) for module in MODULES}
        == {"pay": 12, "tim": 1},
        "contamination module counts drift",
    )
    source_keys: set[tuple[str, str]] = set()
    child_ids: set[str] = set()
    for index, row in enumerate(rows, 2):
        module = row.get("source_module", "")
        source = row.get("source_file", "")
        where = f"row {index} {module}:{source}"
        require(module in MODULES, f"{where}: unsupported module")
        key = (module, source)
        require(key not in source_keys and bool(source), f"{where}: duplicate or blank source")
        source_keys.add(key)
        require(row.get("marker") == "ADDSK", f"{where}: marker is not ADDSK")
        require(row.get("required_disposition") == "RETIRE_FROM_CORE", f"{where}: disposition is not fail-closed retire")
        require(row.get("current_status") == "DECIDED_RETIRE_FROM_CORE", f"{where}: stale or non-final current status")
        require("extension" not in row.get("notes", "").lower(), f"{where}: legacy extension reuse is still implied")
        try:
            matched_count = int(row.get("matched_line_count", ""))
        except ValueError:
            matched_count = 0
        require(matched_count > 0, f"{where}: invalid matched line count")
        if module not in MODULES:
            continue
        expected_session, expected_decision, _child_path, _decision_path = MODULES[module]
        marker = f"customer-specific-contamination-register.csv:{source};"
        matches = [child for child in children_by_module[module] if marker in child.get("evidence_refs", "")]
        require(len(matches) == 1, f"{where}: expected exactly one child trace; got {len(matches)}")
        if len(matches) == 1:
            child = matches[0]
            child_id = child.get("child_id", "")
            require(child_id not in child_ids, f"{where}: child trace reused")
            child_ids.add(child_id)
            require(row.get("coverage_child_id") == child_id, f"{where}: child trace pointer drift")
            require(row.get("coverage_parent") == child.get("parent_artifact_id"), f"{where}: coverage parent drift")
            require(row.get("decision_id") == child.get("decision_id") == expected_decision, f"{where}: decision pointer drift")
            require(row.get("target_capability") == child.get("target_capability_candidate"), f"{where}: safe target capability drift")
            require(child.get("session_id") == expected_session, f"{where}: child session drift")
            require(child.get("disposition") == "RETIRE" and child.get("decision_status") == "DECIDED", f"{where}: child is not decided RETIRE")
            expected_note = f"ADDSK_CLASSIFICATION=RETIRE_FROM_CORE; matched_line_count={matched_count};"
            require(expected_note in child.get("notes", ""), f"{where}: child classification/count evidence drift")
        decisions = [decision for decision in decisions_by_module[module] if decision.get("decision_id") == row.get("decision_id")]
        require(len(decisions) == 1, f"{where}: exact decision row missing")
        if len(decisions) == 1:
            decision = decisions[0]
            require(
                decision.get("session_id") == expected_session
                and decision.get("status") == "DECIDED"
                and decision.get("decision_type") == "CONTAMINATION"
                and "ADDSK" in decision.get("scope", ""),
                f"{where}: referenced decision is not a decided ADDSK contamination decision",
            )

    reverse_children = {
        (module, child.get("child_id", ""))
        for module, children in children_by_module.items()
        for child in children
        if "ADDSK_CLASSIFICATION=RETIRE_FROM_CORE" in child.get("notes", "")
    }
    require(
        reverse_children == {(row.get("source_module", ""), row.get("coverage_child_id", "")) for row in rows},
        "ADDSK child-trace universe is not in exact bidirectional closure with the contamination register",
    )
    return sorted(set(errors))


def load_inputs() -> tuple[list[str], list[dict[str, str]], dict[str, list[dict[str, str]]], dict[str, list[dict[str, str]]]]:
    header, rows = read_csv(REGISTER)
    children: dict[str, list[dict[str, str]]] = {}
    decisions: dict[str, list[dict[str, str]]] = {}
    for module, (_session, _decision, child_path, decision_path) in MODULES.items():
        _header, children[module] = read_csv(child_path)
        _header, decisions[module] = read_csv(decision_path)
    return header, rows, children, decisions


def run_self_tests(
    header: list[str],
    rows: list[dict[str, str]],
    children: dict[str, list[dict[str, str]]],
    decisions: dict[str, list[dict[str, str]]],
) -> dict[str, Any]:
    cases: dict[str, bool] = {"canonical-decisions-valid": not validate_data(header, rows, children, decisions)}

    def rejected(name: str, mutate: Any) -> None:
        test_rows, test_children, test_decisions = copy.deepcopy(rows), copy.deepcopy(children), copy.deepcopy(decisions)
        mutate(test_rows, test_children, test_decisions)
        cases[name] = bool(validate_data(header, test_rows, test_children, test_decisions))

    rejected("stale-g1-required-rejected", lambda r, c, d: r[0].update({"current_status": "G1_REQUIRED"}))
    rejected("extension-disposition-rejected", lambda r, c, d: r[0].update({"required_disposition": "RETIRE_OR_EXTENSION"}))
    rejected("child-pointer-drift-rejected", lambda r, c, d: r[1].update({"coverage_child_id": "PAY-CH-FORGED"}))
    rejected("decision-pointer-drift-rejected", lambda r, c, d: r[2].update({"decision_id": "PAY-DEC-011"}))
    rejected("target-capability-drift-rejected", lambda r, c, d: r[3].update({"target_capability": "PAY-LOCAL-CUSTOMER-BRANCH"}))
    rejected("matched-line-count-drift-rejected", lambda r, c, d: r[4].update({"matched_line_count": "999"}))
    rejected("missing-register-row-rejected", lambda r, c, d: r.pop())
    rejected(
        "orphan-child-trace-rejected",
        lambda r, c, d: c["tim"].append({
            **next(item for item in c["tim"] if "ADDSK_CLASSIFICATION" in item.get("notes", "")),
            "child_id": "TIM-CH-ADDSK-ORPHAN",
        }),
    )
    status = "PASS" if all(cases.values()) else "FAIL"
    return {
        "schema": "dwp.hris.contamination-decisions-self-test.v1",
        "status": status,
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
        header, rows, children, decisions = load_inputs()
        if args.self_test:
            payload = run_self_tests(header, rows, children, decisions)
        else:
            errors = validate_data(header, rows, children, decisions)
            payload = {
                "schema": "dwp.hris.contamination-decisions.v1",
                "status": "PASS" if not errors else "FAIL",
                "contaminationRows": len(rows),
                "decidedRetireRows": sum(row.get("current_status") == "DECIDED_RETIRE_FROM_CORE" for row in rows),
                "errors": errors,
            }
    except (OSError, csv.Error, ValueError) as error:
        payload = {"schema": "dwp.hris.contamination-decisions.v1", "status": "FAIL", "errors": [str(error)]}
    print(json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":") if args.compact else None, indent=None if args.compact else 2))
    return 0 if payload.get("status") == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
