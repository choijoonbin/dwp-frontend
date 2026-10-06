#!/usr/bin/env python3
"""Fail-closed semantic validation for all 10,001 HRIS source-child traces."""

from __future__ import annotations

import argparse
import csv
import hashlib
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

from trace_semantics import (
    COMMAND,
    DATA_CONTRACT,
    DEPRECATED_TARGET_ALIASES,
    FILE_COMMAND_QUERY,
    FORMULA_EVALUATION,
    INTERFACE_COMMAND,
    JOB_COMMAND,
    LEGACY_GET_SIDE_EFFECT,
    MENU_QUERY,
    QUERY,
    RETIRED,
    legacy_get_side_effect_keys,
    normalize_row,
    semantic_intent,
)


ROOT = Path(__file__).resolve().parents[1]
MODULE_COUNTS = {"hrm": 1654, "per": 1041, "tim": 3566, "pay": 3515, "sys": 225}
TRACE_HEADER = (
    "child_id", "parent_artifact_id", "session_id", "source_module",
    "child_type", "source_file", "source_line", "source_fingerprint",
    "actor", "trigger", "input_contract", "output_contract",
    "validation_rules", "state_transitions", "exceptions",
    "legacy_dependency", "target_capability_candidate",
    "target_api_event_candidate", "target_data_owner_candidate",
    "disposition", "decision_status", "decision_id", "owner_role",
    "evidence_refs", "notes",
)
REVIEW_HEADER = (
    "sample_id", "module", "risk_level", "semantic_class", "child_type",
    "population_count", "child_id", "parent_artifact_id", "source_file",
    "source_line", "source_fingerprint", "source_trigger", "target_contract",
    "state_contract", "source_evidence_refs", "selection_rule",
    "review_rationale", "validator_rule", "status",
)
REVIEW_PATH = ROOT / "trace-semantic-risk-review-register.csv"


class Validation:
    def __init__(self) -> None:
        self.checks = 0
        self.errors: list[str] = []

    def require(self, condition: bool, message: str) -> None:
        self.checks += 1
        if not condition:
            self.errors.append(message)


def read_trace(module: str, validation: Validation) -> list[dict[str, str]]:
    path = ROOT / "session-evidence" / module / "g1-child-trace.csv"
    validation.require(path.is_file(), f"{module}: missing child trace")
    if not path.is_file():
        return []
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        validation.require(tuple(reader.fieldnames or ()) == TRACE_HEADER, f"{module}: child trace header drift")
        return list(reader)


def require_terms(validation: Validation, value: str, terms: tuple[str, ...], label: str) -> None:
    lowered = value.lower()
    for term in terms:
        validation.require(term.lower() in lowered, f"{label}: missing semantic term {term!r}")


def semantic_class(row: dict[str, str], intent: str) -> str:
    if intent == RETIRED:
        return "RETIRED_ABSENCE"
    if intent == LEGACY_GET_SIDE_EFFECT:
        return "HTTP_LEGACY_GET_SIDE_EFFECT"
    if row["child_type"] == "SERVICE_OPERATION":
        trigger = row["trigger"].upper()
        if intent == QUERY and ("GET" in trigger or "REQUEST" in trigger):
            return "HTTP_QUERY"
        if intent == COMMAND and any(verb in trigger for verb in ("POST", "PUT", "PATCH", "DELETE", "REQUEST")):
            return "HTTP_MUTATION"
        return "SERVICE_QUERY" if intent == QUERY else "SERVICE_COMMAND"
    return {
        MENU_QUERY: "MENU_PROJECTION",
        COMMAND: "STATE_TRANSITION",
        JOB_COMMAND: "BATCH_JOB",
        INTERFACE_COMMAND: "INTERFACE_TRANSFER",
        FILE_COMMAND_QUERY: "FILE_DOCUMENT_EXPORT",
        FORMULA_EVALUATION: "FORMULA_RULE",
        DATA_CONTRACT: "PERSISTENCE_CONTRACT",
        RETIRED: "RETIRED_ABSENCE",
    }[intent]


def validate_row(
    validation: Validation,
    module: str,
    row: dict[str, str],
    row_number: int,
    legacy_keys: set[tuple[str, str, str]],
) -> str:
    label = f"{module}:row:{row_number}:{row.get('child_id', '<missing>')}"
    for field in TRACE_HEADER:
        if field != "source_line":
            validation.require(bool(row.get(field, "").strip()), f"{label}: blank {field}")
    validation.require(bool(re.fullmatch(r"[0-9a-f]{64}", row.get("source_fingerprint", ""))), f"{label}: invalid source fingerprint")

    intent = semantic_intent(row, legacy_keys)
    expected = normalize_row(row, legacy_keys)
    for field in (
        "trigger", "input_contract", "output_contract", "validation_rules",
        "state_transitions", "target_api_event_candidate",
    ):
        validation.require(row[field] == expected[field], f"{label}: non-canonical {field}")

    target = row["target_api_event_candidate"]
    state = row["state_transitions"]
    if intent == RETIRED:
        validation.require(target.startswith("RETIRED_NO_TARGET:"), f"{label}: retired row exposes target")
        validation.require(state.startswith("RETIRED;"), f"{label}: retired state is not terminal")
    elif intent == MENU_QUERY:
        validation.require(target.startswith("ROUTE_QUERY:"), f"{label}: menu must resolve to a query/projection target")
        validation.require(state.startswith("QUERY_ONLY;"), f"{label}: menu must not mutate state")
        require_terms(validation, row["input_contract"], ("asOf", "purpose"), label)
        require_terms(validation, row["output_contract"], ("projection",), label)
    elif intent == QUERY:
        validation.require(target.startswith("QUERY:"), f"{label}: query target marker missing")
        validation.require(state.startswith("QUERY_ONLY;"), f"{label}: query inherited a mutation state")
        require_terms(validation, row["input_contract"], ("asOf", "cursor"), label)
        require_terms(validation, row["output_contract"], ("projection",), label)
    elif intent in {COMMAND, LEGACY_GET_SIDE_EFFECT}:
        validation.require(target.startswith("COMMAND:"), f"{label}: mutation does not map to a command target")
        validation.require(state.startswith("COMMAND_LIFECYCLE;") and "->" in state, f"{label}: command lifecycle missing")
        require_terms(validation, row["input_contract"], ("Idempotency-Key", "expectedVersion"), label)
        require_terms(validation, row["output_contract"], ("command receipt", "correlation"), label)
        if intent == LEGACY_GET_SIDE_EFFECT:
            validation.require("LEGACY_GET_SIDE_EFFECT" in row["trigger"], f"{label}: legacy GET side effect is not called out")
    elif intent == JOB_COMMAND:
        validation.require(target.startswith("JOB_COMMAND:"), f"{label}: job command target marker missing")
        validation.require(state.startswith("JOB_LIFECYCLE;") and "QUEUED->RUNNING" in state, f"{label}: job lifecycle missing")
        require_terms(validation, row["input_contract"], ("signed job manifest", "schema", "Idempotency-Key", "lease"), label)
        require_terms(validation, row["output_contract"], ("run receipt", "row counts", "reconciliation"), label)
    elif intent == INTERFACE_COMMAND:
        validation.require(target.startswith("INTERFACE_COMMAND:"), f"{label}: interface target marker missing")
        validation.require(state.startswith("INTERFACE_LIFECYCLE;") and "QUARANTINED" in state, f"{label}: interface lifecycle missing")
        require_terms(validation, row["input_contract"], ("adapter", "mapping version", "cursor", "Idempotency-Key"), label)
        require_terms(validation, row["output_contract"], ("receipt", "quarantine", "reconciliation"), label)
    elif intent == FILE_COMMAND_QUERY:
        validation.require(target.startswith("FILE_COMMAND_QUERY:"), f"{label}: file/export target marker missing")
        validation.require(state.startswith("FILE_LIFECYCLE;") and "SCANNING" in state, f"{label}: file lifecycle missing")
        require_terms(validation, row["input_contract"], ("object reference", "content digest", "purpose"), label)
        require_terms(validation, row["output_contract"], ("malware", "digest", "expiry", "audit"), label)
    elif intent == FORMULA_EVALUATION:
        validation.require(target.startswith("FORMULA_EVALUATION:"), f"{label}: formula target marker missing")
        validation.require(state.startswith("DETERMINISTIC_EVALUATION;"), f"{label}: deterministic formula state missing")
        require_terms(validation, row["input_contract"], ("ruleVersion", "decimal", "missing/null", "inputDigest"), label)
        require_terms(validation, row["output_contract"], ("intermediate", "final", "lineage"), label)
        require_terms(validation, row["validation_rules"], ("rounding", "reproducibility", "no executable tenant expression"), label)
    elif intent == DATA_CONTRACT:
        validation.require(target.startswith("DATA_CONTRACT:"), f"{label}: persistence target marker missing")
        validation.require(state.startswith("PERSISTENCE_INVARIANTS;"), f"{label}: persistence invariants missing")
        require_terms(validation, row["input_contract"], ("tenant", "version", "effective"), label)
        require_terms(validation, row["output_contract"], ("tenant", "immutable", "correction"), label)

    target_design = " ".join(
        row[field]
        for field in (
            "target_capability_candidate", "target_api_event_candidate",
            "target_data_owner_candidate", "state_transitions",
        )
    )
    for alias in DEPRECATED_TARGET_ALIASES:
        validation.require(alias not in target_design, f"{label}: deprecated target alias remains: {alias}")
    return intent


def risk_level(semantic: str) -> str:
    if semantic in {
        "HTTP_MUTATION", "HTTP_LEGACY_GET_SIDE_EFFECT", "STATE_TRANSITION",
        "BATCH_JOB", "INTERFACE_TRANSFER", "FILE_DOCUMENT_EXPORT", "FORMULA_RULE",
    }:
        return "HIGH"
    if semantic in {"HTTP_QUERY", "SERVICE_COMMAND", "PERSISTENCE_CONTRACT", "RETIRED_ABSENCE"}:
        return "MEDIUM"
    return "LOW"


def rationale(semantic: str) -> str:
    return {
        "HTTP_MUTATION": "Mutation must terminate at an idempotent command contract and a guarded lifecycle, never at a GET-only projection.",
        "HTTP_LEGACY_GET_SIDE_EFFECT": "Unsafe legacy GET side effect is explicitly isolated and remapped to a POST command with audit evidence.",
        "HTTP_QUERY": "Read behavior must remain side-effect free and return a scoped, fresh, paginated projection.",
        "SERVICE_COMMAND": "Non-HTTP application mutation still requires the same command envelope, receipt and state guards.",
        "SERVICE_QUERY": "Non-HTTP application read remains an authorized projection with no aggregate state change.",
        "STATE_TRANSITION": "Lifecycle behavior requires expected-version guards, immutable history and corrective commands.",
        "BATCH_JOB": "Batch behavior is code-owned through a signed manifest, lease, idempotent attempt and reconciliation receipt.",
        "INTERFACE_TRANSFER": "Integration behavior is provider-neutral, versioned, quarantinable, replayable and reconciled.",
        "FILE_DOCUMENT_EXPORT": "File, document and export behavior uses governed objects, digest, malware scan, expiry and download audit.",
        "FORMULA_RULE": "Calculation behavior is typed and reproducible with decimal policy, versioned rules and lineage; legacy expressions are not executed.",
        "PERSISTENCE_CONTRACT": "Legacy table shape is not cloned; target persistence states tenant, version/effective-time and immutable correction invariants.",
        "MENU_PROJECTION": "A legacy route maps to a governed workspace projection and never grants authorization or causes a mutation.",
        "RETIRED_ABSENCE": "Retired behavior has no target endpoint and is proven by governed absence tied to its decision.",
    }[semantic]


def review_rows(rows_by_module: dict[str, list[dict[str, str]]]) -> list[dict[str, str]]:
    grouped: dict[tuple[str, str, str], list[dict[str, str]]] = defaultdict(list)
    for module, rows in rows_by_module.items():
        keys = legacy_get_side_effect_keys(rows)
        for row in rows:
            intent = semantic_intent(row, keys)
            semantic = semantic_class(row, intent)
            grouped[(module, row["child_type"], semantic)].append(row)

    review: list[dict[str, str]] = []
    for sequence, ((module, child_type, semantic), population) in enumerate(sorted(grouped.items()), 1):
        chosen = min(
            population,
            key=lambda row: hashlib.sha256(f"{module}|{child_type}|{semantic}|{row['child_id']}".encode()).hexdigest(),
        )
        review.append({
            "sample_id": f"TRACE-RISK-{sequence:03d}",
            "module": module.upper(),
            "risk_level": risk_level(semantic),
            "semantic_class": semantic,
            "child_type": child_type,
            "population_count": str(len(population)),
            "child_id": chosen["child_id"],
            "parent_artifact_id": chosen["parent_artifact_id"],
            "source_file": chosen["source_file"],
            "source_line": chosen["source_line"],
            "source_fingerprint": chosen["source_fingerprint"],
            "source_trigger": chosen["trigger"],
            "target_contract": chosen["target_api_event_candidate"],
            "state_contract": chosen["state_transitions"],
            "source_evidence_refs": chosen["evidence_refs"],
            "selection_rule": "minimum sha256(module|child_type|semantic_class|child_id)",
            "review_rationale": rationale(semantic),
            "validator_rule": f"TRACE-SEMANTIC-{semantic}",
            "status": "PASS",
        })
    return review


def write_review(rows: list[dict[str, str]]) -> None:
    with REVIEW_PATH.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=REVIEW_HEADER)
        writer.writeheader()
        writer.writerows(rows)


def validate_review(validation: Validation, expected: list[dict[str, str]]) -> None:
    validation.require(REVIEW_PATH.is_file(), "missing trace-semantic-risk-review-register.csv")
    if not REVIEW_PATH.is_file():
        return
    with REVIEW_PATH.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        validation.require(tuple(reader.fieldnames or ()) == REVIEW_HEADER, "risk review register header drift")
        actual = list(reader)
    validation.require(actual == expected, "risk review register is stale or non-deterministic")
    validation.require({row["module"].lower() for row in actual} == set(MODULE_COUNTS), "risk review does not cover every module")
    validation.require(
        {(row["module"].lower(), row["child_type"]) for row in actual}
        == {
            (module, row["child_type"])
            for module, rows in _LAST_ROWS_BY_MODULE.items()
            for row in rows
        },
        "risk review does not cover every module/child-type population",
    )
    validation.require(all(row["status"] == "PASS" for row in actual), "risk review contains non-PASS sample")


_LAST_ROWS_BY_MODULE: dict[str, list[dict[str, str]]] = {}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--module", choices=tuple(MODULE_COUNTS), action="append", help="validate one or more modules")
    parser.add_argument("--write-review-register", action="store_true")
    args = parser.parse_args(argv)
    modules = tuple(args.module or MODULE_COUNTS)

    validation = Validation()
    rows_by_module: dict[str, list[dict[str, str]]] = {}
    intent_counts: Counter[str] = Counter()
    class_counts: Counter[str] = Counter()
    child_ids: set[str] = set()
    total = 0
    for module in modules:
        rows = read_trace(module, validation)
        rows_by_module[module] = rows
        validation.require(len(rows) == MODULE_COUNTS[module], f"{module}: expected {MODULE_COUNTS[module]} rows, got {len(rows)}")
        keys = legacy_get_side_effect_keys(rows)
        for number, row in enumerate(rows, 2):
            validation.require(row["child_id"] not in child_ids, f"duplicate child ID across modules: {row['child_id']}")
            child_ids.add(row["child_id"])
            intent = validate_row(validation, module, row, number, keys)
            intent_counts[intent] += 1
            class_counts[semantic_class(row, intent)] += 1
        total += len(rows)
    validation.require(total == sum(MODULE_COUNTS[module] for module in modules), "total child count drift")
    if not args.module:
        validation.require(total == 10001, f"expected complete population 10001, got {total}")

    expected_review = review_rows(rows_by_module)
    if args.write_review_register:
        if args.module:
            validation.errors.append("--write-review-register requires the complete five-module population")
        else:
            write_review(expected_review)
    global _LAST_ROWS_BY_MODULE
    _LAST_ROWS_BY_MODULE = rows_by_module
    if not args.module:
        validate_review(validation, expected_review)

    if validation.errors:
        for error in validation.errors[:200]:
            print(f"ERROR: {error}", file=sys.stderr)
        if len(validation.errors) > 200:
            print(f"ERROR: ... {len(validation.errors) - 200} more", file=sys.stderr)
        print(f"TRACE_SEMANTICS=FAIL checks={validation.checks} errors={len(validation.errors)} rows={total} modules={len(modules)}")
        return 1
    print(
        f"TRACE_SEMANTICS=PASS checks={validation.checks} rows={total} modules={len(modules)} "
        f"review_samples={len(expected_review)} intents={dict(sorted(intent_counts.items()))} "
        f"classes={dict(sorted(class_counts.items()))}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
