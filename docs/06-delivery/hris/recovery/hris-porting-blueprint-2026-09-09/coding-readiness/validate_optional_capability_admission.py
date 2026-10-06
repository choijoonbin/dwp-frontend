#!/usr/bin/env python3
"""Fail-closed structural and semantic validator for optional HRIS capability admission."""

from __future__ import annotations

import argparse
import copy
import json
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Any


HERE = Path(__file__).resolve().parent
CONTRACT = HERE / "optional-capability-admission-contract.v1.json"
CAP_RE = re.compile(r"^CAP\.[A-Z][A-Z0-9_]*$")
OP_RE = re.compile(r"^[A-Z]+\.[A-Z0-9_]+(?:\.[A-Z0-9_]+)+$")
MODULES = {"HRIS-HRM", "HRIS-PER", "HRIS-PAY", "HRIS-TIM", "HRIS-SYS"}


def validate(payload: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if payload.get("schema") != "dwp.hris.optional-capability-admission-contract.v1":
        errors.append("schema mismatch")
    if payload.get("defaultPolicy") != "ABSENT_OR_DISABLED_AND_ZERO_CALL":
        errors.append("optional default must be disabled and zero-call")
    if payload.get("unknownPolicy") != "DENY_UNKNOWN_CAPABILITY_BEFORE_CALL":
        errors.append("unknown capability must deny before call")
    if payload.get("versionPolicy") != "EXACT_MAJOR_AND_NO_DOWNGRADE":
        errors.append("version downgrade policy missing")
    if payload.get("operationPolicy") != "EXACT_AFFECTED_OR_EXPLICIT_PRESERVED_OTHERWISE_DENY":
        errors.append("operation admission must use exact affected/preserved allowlists")
    if set(payload.get("modules", [])) != MODULES:
        errors.append("module closure mismatch")
    bindings = set(payload.get("bindingKinds", []))
    capabilities = payload.get("capabilities", [])
    ids = [row.get("capabilityId") for row in capabilities if isinstance(row, dict)]
    counts = Counter(ids)
    if len(capabilities) < 15 or any(count != 1 for count in counts.values()):
        errors.append("capability matrix must be closed and unique")
    known = set(ids)
    graph: dict[str, list[str]] = {}
    operations: set[str] = set()
    for row in capabilities:
        cap = row.get("capabilityId", "")
        if not CAP_RE.fullmatch(cap):
            errors.append(f"invalid capability id {cap}")
        if row.get("owner") not in MODULES or not set(row.get("consumers", [])).issubset(MODULES):
            errors.append(f"invalid owner or consumer for {cap}")
        if row.get("contractVersion") != "1.0.0" or row.get("defaultState") != "DISABLED":
            errors.append(f"unsafe version/default for {cap}")
        deps = row.get("capabilityPrerequisites", [])
        graph[cap] = deps
        if any(dep not in known for dep in deps):
            errors.append(f"unknown prerequisite for {cap}")
        required = set(row.get("bindingPrerequisites", []))
        forbidden = set(row.get("forbiddenBindings", []))
        if not required.issubset(bindings) or not forbidden.issubset(bindings) or required & forbidden:
            errors.append(f"invalid binding policy for {cap}")
        ops = row.get("affectedOperations", [])
        if not ops or any(not OP_RE.fullmatch(op) for op in ops):
            errors.append(f"invalid affected operations for {cap}")
        preserved = row.get("preservedOperations")
        if not isinstance(preserved, list) or any(not OP_RE.fullmatch(op) for op in preserved):
            errors.append(f"invalid preserved operations for {cap}")
            preserved = []
        if set(ops) & set(preserved):
            errors.append(f"affected/preserved operation overlap for {cap}")
        if operations & set(ops):
            errors.append(f"operation assigned to multiple capabilities for {cap}")
        operations.update(ops)
        if not str(row.get("failureCode", "")).startswith("HRIS_"):
            errors.append(f"missing typed failure code for {cap}")
        if "DENY" not in str(row.get("missingEffect", "")) or row.get("activationStage") != "G6":
            errors.append(f"missing fail-closed or activation boundary for {cap}")

    visiting: set[str] = set()
    visited: set[str] = set()
    def visit(node: str) -> None:
        if node in visiting:
            errors.append(f"capability dependency cycle at {node}")
            return
        if node in visited:
            return
        visiting.add(node)
        for dep in graph.get(node, []):
            visit(dep)
        visiting.remove(node)
        visited.add(node)
    for cap in known:
        visit(cap)

    by_capability = {row.get("capabilityId"): row for row in capabilities}
    for row in capabilities:
        pending = list(row.get("capabilityPrerequisites", []))
        transitive_bindings: set[str] = set()
        seen_dependencies: set[str] = set()
        while pending:
            dependency = pending.pop()
            if dependency in seen_dependencies or dependency not in by_capability:
                continue
            seen_dependencies.add(dependency)
            dependency_row = by_capability[dependency]
            transitive_bindings.update(dependency_row.get("bindingPrerequisites", []))
            pending.extend(dependency_row.get("capabilityPrerequisites", []))
        conflict = set(row.get("forbiddenBindings", [])) & transitive_bindings
        if conflict:
            errors.append(
                f"forbidden binding reachable through prerequisite for "
                f"{row.get('capabilityId')}: {sorted(conflict)}"
            )

    by_scenario = {row.get("scenarioId"): row for row in payload.get("requiredScenarios", [])}
    required_scenarios = {
        "ZERO-HRM", "ZERO-PER", "ZERO-PAY", "ZERO-TIM", "ZERO-SYS",
        "ENABLED-MISSING", "PAY-COUNTRY-MISSING", "PAY-GENERIC-WITHOUT-COUNTRY",
        "WFM-WITHOUT-SKILLS", "TIM-CORE-WITHOUT-SKILLS", "HRM-CORE-WITHOUT-SKILLS",
        "LISTENING-MISSING-PROTECTED", "ANALYTICS-NON-LISTENING",
        "UNKNOWN-CAPABILITY", "VERSION-DOWNGRADE",
    }
    if set(by_scenario) != required_scenarios:
        errors.append("required scenario closure mismatch")
    for sid, row in by_scenario.items():
        if row.get("module") not in MODULES or row.get("providerCalls") not in {0, 1}:
            errors.append(f"invalid scenario {sid}")
        if str(row.get("decision", "")).startswith("DENY") and row.get("providerCalls") != 0:
            errors.append(f"denied scenario called provider: {sid}")
        descriptor = next(
            (item for item in capabilities if item.get("capabilityId") == row.get("capability")),
            None,
        )
        if descriptor is not None:
            if row.get("module") not in descriptor.get("consumers", []):
                errors.append(f"scenario module is not an authorized consumer: {sid}")
            if row.get("decision") in {"ALLOW_UNRELATED_CORE", "ALLOW_MANUAL_PATH"}:
                if row.get("operation") not in descriptor.get("preservedOperations", []):
                    errors.append(f"allowed scenario lacks explicit preserved operation: {sid}")
            elif row.get("decision") == "ALLOW_AFFECTED_OPERATION" or str(
                    row.get("decision", "")).startswith("DENY"):
                if row.get("operation") not in descriptor.get("affectedOperations", []):
                    errors.append(f"affected scenario lacks exact affected operation: {sid}")
    analytics = by_scenario.get("ANALYTICS-NON-LISTENING", {})
    if analytics.get("protectedStoreCalls") != 0 or analytics.get("currentIssuerCalls") != 0:
        errors.append("non-listening analytics touched protected listening authority")
    for sid in ["ZERO-HRM", "ZERO-PER", "ZERO-PAY", "ZERO-TIM", "ZERO-SYS"]:
        if by_scenario.get(sid, {}).get("providerCalls") != 0:
            errors.append(f"module zero-call witness failed: {sid}")
    boundary = payload.get("implementationBoundary", {})
    if set(boundary) != {"START", "G4", "G6"} or payload.get("gateEffect") != "NONE_UNTIL_SHARED_GUARD_AND_ALL_FIVE_CONSUMER_EVIDENCE_PASS":
        errors.append("stage or gate boundary mismatch")
    return errors


def self_test(payload: dict[str, Any]) -> list[str]:
    mutants: list[dict[str, Any]] = []
    p = copy.deepcopy(payload); p["defaultPolicy"] = "BEST_EFFORT"; mutants.append(p)
    p = copy.deepcopy(payload); p["capabilities"][0]["defaultState"] = "ENABLED"; mutants.append(p)
    p = copy.deepcopy(payload); p["capabilities"][0]["capabilityPrerequisites"] = ["CAP.UNKNOWN"]; mutants.append(p)
    p = copy.deepcopy(payload); p["capabilities"][0]["capabilityPrerequisites"] = [p["capabilities"][0]["capabilityId"]]; mutants.append(p)
    p = copy.deepcopy(payload); p["capabilities"][0]["contractVersion"] = "0.9.0"; mutants.append(p)
    p = copy.deepcopy(payload); p["operationPolicy"] = "ALLOW_UNKNOWN_AS_CORE"; mutants.append(p)
    p = copy.deepcopy(payload); p["capabilities"][0]["preservedOperations"] = p["capabilities"][0]["affectedOperations"][:1]; mutants.append(p)
    p = copy.deepcopy(payload); p["capabilities"][0]["preservedOperations"] = []; mutants.append(p)
    p = copy.deepcopy(payload); next(r for r in p["requiredScenarios"] if r["scenarioId"] == "ZERO-HRM")["module"] = "HRIS-PAY"; mutants.append(p)
    p = copy.deepcopy(payload); next(r for r in p["capabilities"] if r["capabilityId"] == "CAP.ANALYTICS_AI")["capabilityPrerequisites"] = ["CAP.EMPLOYEE_LISTENING"]; mutants.append(p)
    p = copy.deepcopy(payload); p["requiredScenarios"] = [r for r in p["requiredScenarios"] if r["scenarioId"] != "ZERO-PAY"]; mutants.append(p)
    p = copy.deepcopy(payload); next(r for r in p["requiredScenarios"] if r["scenarioId"] == "ENABLED-MISSING")["providerCalls"] = 1; mutants.append(p)
    p = copy.deepcopy(payload); next(r for r in p["requiredScenarios"] if r["scenarioId"] == "ANALYTICS-NON-LISTENING")["protectedStoreCalls"] = 1; mutants.append(p)
    p = copy.deepcopy(payload); p["gateEffect"] = "OPEN"; mutants.append(p)
    rejected = sum(bool(validate(mutant)) for mutant in mutants)
    return [] if rejected == len(mutants) else [f"mutation rejection incomplete: {rejected}/{len(mutants)}"]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--compact", action="store_true")
    args = parser.parse_args()
    payload = json.loads(CONTRACT.read_text(encoding="utf-8"))
    errors = self_test(payload) if args.self_test else validate(payload)
    result = {
        "schema": "dwp.hris.optional-capability-admission-validation.v1",
        "status": "PASS" if not errors else "FAIL",
        "mode": "SELF_TEST" if args.self_test else "CONTRACT",
        "capabilityCount": len(payload.get("capabilities", [])),
        "scenarioCount": len(payload.get("requiredScenarios", [])),
        "errors": errors,
        "providerActivation": "NOT_AUTHORIZED_G6"
    }
    print(json.dumps(result, ensure_ascii=False, separators=(",", ":") if args.compact else None, indent=None if args.compact else 2))
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
