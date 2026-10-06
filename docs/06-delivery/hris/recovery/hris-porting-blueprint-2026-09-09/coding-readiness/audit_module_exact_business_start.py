#!/usr/bin/env python3
"""Independent stdlib-only re-audit for the HRIS module exact-business P0 pin.

This deliberately does not import or execute the Node validator.  It checks a
different set of structural, graph, lineage, fixture and immutable-byte
properties so a primary-validator defect cannot silently approve the package.
"""

from __future__ import annotations

import argparse
import copy
import csv
import hashlib
import json
from pathlib import Path
from typing import Any


HERE = Path(__file__).resolve().parent
BLUEPRINT = HERE.parent
PATHS = {
    "contract": HERE / "module-exact-business-start-canonical.v1.json",
    "schemas": HERE / "module-exact-business-schemas.v1.json",
    "fixtures": HERE / "module-exact-business-fixtures.v1.json",
    "lineage": HERE / "module-exact-business-lineage-register.v1.csv",
    "targets": HERE / "target-family-resolution-register.csv",
    "transport": HERE / "transport-schema-resolution-register.csv",
    "service_bindings": HERE / "service-api-auth-binding-register.csv",
    "api_sor": HERE / "hris-api-sor-transition-register.csv",
    "pin": HERE / "module-exact-business-start-pin.v1.json",
}


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def load_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def split_refs(value: str) -> list[str]:
    return [] if not value or value == "NONE" else value.split("|")


def object_keys(value: Any) -> list[str]:
    result: list[str] = []
    if isinstance(value, dict):
        for key, child in value.items():
            result.append(key)
            result.extend(object_keys(child))
    elif isinstance(value, list):
        for child in value:
            result.extend(object_keys(child))
    return result


def open_object_schema_paths(value: Any, pointer: str = "#") -> list[str]:
    result: list[str] = []
    if isinstance(value, dict):
        if value.get("type") == "object" and value.get("additionalProperties") is not False:
            result.append(pointer)
        for key, child in value.items():
            encoded = key.replace("~", "~0").replace("/", "~1")
            result.extend(open_object_schema_paths(child, f"{pointer}/{encoded}"))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            result.extend(open_object_schema_paths(child, f"{pointer}/{index}"))
    return result


def pointer_get(root: Any, pointer: str) -> Any:
    if not pointer.startswith("#/"):
        return None
    value = root
    for raw in pointer[2:].split("/"):
        key = raw.replace("~1", "/").replace("~0", "~")
        if not isinstance(value, dict) or key not in value:
            return None
        value = value[key]
    return value


def parse_transition(value: str) -> tuple[str, tuple[str, ...], tuple[str, ...]]:
    operation, relation = value.split(":", 1)
    source, target = relation.split("->", 1)
    return operation, tuple(filter(None, source.split("|"))), tuple(filter(None, target.split("|")))


def aggregate_rows(contract: dict[str, Any]) -> list[tuple[str, str, dict[str, Any]]]:
    return [
        (module, name, aggregate)
        for module, module_contract in contract.get("modules", {}).items()
        for name, aggregate in module_contract.get("aggregates", {}).items()
    ]


def audit(data: dict[str, Any], verify_pin: bool = True) -> list[str]:
    contract = data["contract"]
    schemas = data["schemas"]
    fixtures = data["fixtures"]
    lineage = data["lineage"]
    errors: list[str] = []

    def require(condition: bool, code: str) -> None:
        if not condition:
            errors.append(code)

    require(contract.get("status") == "CANONICAL_G3_EXACT_BUSINESS_P0_SUCCESSOR", "STATUS_NOT_CANONICAL")
    require(contract.get("canonicalDesignPublished") is True, "DESIGN_NOT_PUBLISHED")
    require(contract.get("runtimeImplemented") is False, "RUNTIME_BOUNDARY_LOST")
    require(contract.get("g3CodeGateAuthorization") == "NONE_CLOSED_FAIL_SAFE", "GATE_WIDENED")

    expected_modules = {"HRIS-HRM", "HRIS-PER", "HRIS-PAY", "HRIS-TIM"}
    require(set(contract.get("modules", {})) == expected_modules, "MODULE_SET_DRIFT")
    for module in expected_modules:
        module_contract = contract.get("modules", {}).get(module)
        require(module_contract is not None, f"MODULE_MISSING:{module}")
        if module_contract is None:
            continue
        require(module_contract.get("exactBusinessP0") == "PASS", f"MODULE_NOT_PASS:{module}")
        require(contract.get("moduleStartP0Decision", {}).get(module, "").endswith("GLOBAL_GATE_STILL_REQUIRED"), f"GLOBAL_GATE_SUFFIX:{module}")

    expected_findings = {f"BASE-P0-{number:03d}" for number in range(4, 12)}
    closure = contract.get("auditClosure", [])
    actual_findings = [row.get("findingId") for row in closure]
    require(set(actual_findings) == expected_findings, "AUDIT_FINDING_SET")
    require(len(actual_findings) == len(set(actual_findings)), "AUDIT_FINDING_DUPLICATE")
    for row in closure:
        require(row.get("status") == "CLOSED_EXACT_DESIGN", f"AUDIT_STATUS:{row.get('findingId')}")
        for ref in row.get("schemaRefs", []):
            require(pointer_get(schemas, ref) is not None, f"AUDIT_SCHEMA_REF:{row.get('findingId')}:{ref}")

    forbidden = {"allOf", "ruleExpression", "expression"}
    found_forbidden = forbidden.intersection(object_keys(schemas))
    require(not found_forbidden, f"FORBIDDEN_SCHEMA_KEYS:{'|'.join(sorted(found_forbidden))}")
    open_objects = open_object_schema_paths(schemas)
    require(not open_objects, f"SCHEMA_OBJECT_NOT_CLOSED:{'|'.join(open_objects)}")
    require(schemas.get("$schema") == "http://json-schema.org/draft-07/schema#", "SCHEMA_DIALECT")
    defs = schemas.get("$defs", {})
    require(len(defs) == 34, f"SCHEMA_DEFINITION_COUNT:{len(defs)}")

    critical_closed = [
        "OwnerRef", "CommandContext", "AssignmentDraft", "HirePayload", "RehirePayload",
        "AssignmentMovePayload", "ConcurrentEmploymentPayload", "LeaveReturnPayload",
        "TerminationPayload", "CorrectionPayload", "SelfContextSelection",
        "FreezePopulationCommand", "AggregateTransitionCommand", "TypedRuleNode",
        "TypedRuleAst", "ScheduleSegment", "ScheduleCommand", "AccrualPolicy",
        "TimecardRecord", "WfmPlanningInputSnapshot", "PayFormulaNode", "PayFormulaAst",
        "PayrollFoundationArtifact", "PayrollInputSourceVector", "PayrollRunPrepareCommand",
        "ProviderNeutralCase",
    ]
    for name in critical_closed:
        require(name in defs, f"SCHEMA_MISSING:{name}")
        if name in defs and defs[name].get("type") == "object":
            require(defs[name].get("additionalProperties") is False, f"SCHEMA_NOT_CLOSED:{name}")

    employment = defs.get("EmploymentEventCommand", {})
    require("allOf" not in employment and isinstance(employment.get("oneOf"), list), "EMPLOYMENT_NOT_DISCRIMINATED")
    event_types: set[str] = set()
    for branch in employment.get("oneOf", []):
        require(branch.get("additionalProperties") is False, "EMPLOYMENT_BRANCH_NOT_CLOSED")
        discriminator = branch.get("properties", {}).get("eventType", {})
        if "const" in discriminator:
            event_types.add(discriminator["const"])
        event_types.update(discriminator.get("enum", []))
    require(
        event_types == {"HIRE", "REHIRE", "APPOINTMENT", "TRANSFER", "PROMOTION", "DEMOTION", "CONCURRENT_EMPLOYMENT", "LEAVE", "RETURN", "TERMINATION", "CORRECTION"},
        "EMPLOYMENT_EVENT_SET",
    )

    freeze_required = set(defs.get("FreezePopulationCommand", {}).get("required", []))
    require(freeze_required == {"context", "cyclePublicId", "cycleVersion", "populationRuleRef", "workforceSnapshotRef", "asOf", "previewContentHash"}, "FREEZE_REQUIRED_SET")
    timecard_states = set(defs.get("TimecardRecord", {}).get("properties", {}).get("state", {}).get("enum", []))
    require(timecard_states == {"OPEN", "SUBMITTED", "APPROVED", "REJECTED", "CORRECTION_REQUIRED", "LOCKED", "CLOSED", "SUPERSEDED"}, "TIMECARD_LITERAL_STATE_SET")
    require("elements" in defs.get("PayrollFoundationArtifact", {}).get("required", []), "FOUNDATION_DIGEST_ONLY")
    require(set(["foundationRef", "hrmWorkerAssignmentRef", "hrmCompensationRef", "timClosedTimeRef", "sourceVectorHash"]).issubset(defs.get("PayrollInputSourceVector", {}).get("required", [])), "PAY_SOURCE_VECTOR_REQUIRED")

    operator_pairs = [
        ("TIM_RULE_AST_V1", set(defs.get("TypedRuleNode", {}).get("properties", {}).get("operator", {}).get("enum", []))),
        ("PAY_RULE_AST_V1", set(defs.get("PayFormulaNode", {}).get("properties", {}).get("operator", {}).get("enum", []))),
    ]
    for registry_id, schema_operators in operator_pairs:
        registry = contract.get("typedOperatorRegistries", {}).get(registry_id, {})
        registered = set(registry.get("operators", {}))
        require(registered == schema_operators and registered, f"OPERATOR_SET:{registry_id}")
        for operator, rule in registry.get("operators", {}).items():
            require(type(rule.get("arity")) is int and 0 <= rule["arity"] <= 3, f"OPERATOR_ARITY:{registry_id}:{operator}")
        require({"TYPE_MISMATCH", "CYCLE"}.issubset(registry.get("errors", [])), f"OPERATOR_ERRORS:{registry_id}")

    aggregates = aggregate_rows(contract)
    require(len(aggregates) == 30, "AGGREGATE_COUNT")
    for module, name, aggregate in aggregates:
        states = set(aggregate.get("states", []))
        terminal_states = set(aggregate.get("terminalStates", []))
        require(bool(states), f"STATE_EMPTY:{module}:{name}")
        require(len(states) == len(aggregate.get("states", [])), f"STATE_DUPLICATE:{module}:{name}")
        require(len(terminal_states) == len(aggregate.get("terminalStates", [])), f"TERMINAL_DUPLICATE:{module}:{name}")
        require(bool(terminal_states), f"TERMINAL_EMPTY:{module}:{name}")
        require(terminal_states.issubset(states), f"TERMINAL_UNKNOWN_STATE:{module}:{name}")
        require(bool(aggregate.get("writeSet")), f"WRITE_SET_EMPTY:{module}:{name}")
        transitions: list[tuple[str, tuple[str, ...], tuple[str, ...]]] = []
        for raw in aggregate.get("transitions", []):
            try:
                transitions.append(parse_transition(raw))
            except (ValueError, AttributeError):
                errors.append(f"TRANSITION_PARSE:{module}:{name}:{raw}")
        require(len(set(aggregate.get("transitions", []))) == len(aggregate.get("transitions", [])), f"TRANSITION_DUPLICATE:{module}:{name}")
        signatures = [(operation, tuple(sorted(source))) for operation, source, _ in transitions]
        require(len(set(signatures)) == len(signatures), f"TRANSITION_AMBIGUOUS:{module}:{name}")
        for _, source, target in transitions:
            require(set(source).union(target).issubset(states), f"TRANSITION_UNKNOWN_STATE:{module}:{name}")
        allowed_terminal_exit_operations = {"correct", "reconcile", "amend", "cancel.request", "reopen", "retire", "retro-or-offcycle", "reverse", "revoke", "invalidate", "recapture"}
        for operation, source, _ in transitions:
            illegal_terminal_sources = terminal_states.intersection(source) if operation not in allowed_terminal_exit_operations else set()
            require(not illegal_terminal_sources, f"TERMINAL_EXIT_NOT_EXCEPTIONAL:{module}:{name}:{'|'.join(sorted(illegal_terminal_sources))}:{operation}")
        reachable = {target for _, source, targets in transitions if not source for target in targets}
        changed = True
        while changed:
            changed = False
            for _, source, targets in transitions:
                if source and set(source).intersection(reachable):
                    old = len(reachable)
                    reachable.update(targets)
                    changed = changed or len(reachable) != old
        require(reachable == states, f"STATE_UNREACHABLE:{module}:{name}:{'|'.join(sorted(states-reachable))}")

        can_reach_terminal = set(terminal_states)
        changed = True
        while changed:
            changed = False
            for _, source, targets in transitions:
                if source and set(targets).intersection(can_reach_terminal):
                    old = len(can_reach_terminal)
                    can_reach_terminal.update(source)
                    changed = changed or len(can_reach_terminal) != old
        require(can_reach_terminal == states, f"STATE_NO_TERMINAL_PATH:{module}:{name}:{'|'.join(sorted(states-can_reach_terminal))}")

    target_by_id = {row["resolution_id"]: row for row in data["targets"]}
    transport_by_id = {row["binding_id"]: row for row in data["transport"]}
    service_binding_by_id = {row["binding_id"]: row for row in data["service_bindings"]}
    api_sor_by_id = {row["transition_id"]: row for row in data["api_sor"]}
    consumer_identity = {
        "HRIS-HRM": "dwp-people-server/hris/hrm",
        "HRIS-PER": "dwp-people-server/hris/performance",
        "HRIS-PAY": "dwp-payroll-server",
        "HRIS-TIM": "dwp-time-server",
    }
    fixture_groups = [fixtures.get("validCases", []), fixtures.get("journeyCases", []), fixtures.get("negativeCases", [])]
    fixture_ids = [row.get("caseId") for group in fixture_groups for row in group]
    require(len(fixture_ids) == len(set(fixture_ids)), "FIXTURE_DUPLICATE")
    require(len(fixtures.get("validCases", [])) == 12, f"VALID_FIXTURE_COUNT:{len(fixtures.get('validCases', []))}")
    require(len(fixtures.get("journeyCases", [])) == 11, f"JOURNEY_FIXTURE_COUNT:{len(fixtures.get('journeyCases', []))}")
    require(len(fixtures.get("negativeCases", [])) == 51, f"NEGATIVE_FIXTURE_COUNT:{len(fixtures.get('negativeCases', []))}")
    require(len(fixture_ids) == 74, f"FIXTURE_TOTAL_COUNT:{len(fixture_ids)}")
    required_negative_ids = {case_id for row in closure for case_id in row.get("negativeFixtureIds", [])}
    require(required_negative_ids.issubset(set(fixture_ids)), f"AUDIT_NEGATIVE_FIXTURE_MISSING:{'|'.join(sorted(required_negative_ids-set(fixture_ids)))}")

    lineage_ids: set[str] = set()
    allocated_fixture_ids: set[str] = set()
    for row in lineage:
        binding_id = row.get("binding_id", "")
        require(binding_id not in lineage_ids, f"LINEAGE_DUPLICATE:{binding_id}")
        lineage_ids.add(binding_id)
        require(row.get("status") == "CANONICAL_EXACT_DESIGN_P0", f"LINEAGE_STATUS:{binding_id}")
        require(row.get("module") in expected_modules, f"LINEAGE_MODULE:{binding_id}")
        require(bool(row.get("canonical_owner")), f"LINEAGE_OWNER:{binding_id}")
        require(bool(row.get("read_source_contract")), f"LINEAGE_READ:{binding_id}")
        require(bool(split_refs(row.get("write_set_contract", ""))), f"LINEAGE_WRITE:{binding_id}")
        require(bool(split_refs(row.get("source_family_refs", ""))), f"LINEAGE_SOURCE_EMPTY:{binding_id}")
        require(bool(split_refs(row.get("target_family_refs", ""))), f"LINEAGE_TARGET_EMPTY:{binding_id}")
        require(bool(split_refs(row.get("transport_binding_refs", ""))), f"LINEAGE_TRANSPORT_EMPTY:{binding_id}")
        require(bool(split_refs(row.get("schema_refs", ""))), f"LINEAGE_SCHEMA_EMPTY:{binding_id}")
        require(bool(split_refs(row.get("state_machine_ref", ""))), f"LINEAGE_STATE_EMPTY:{binding_id}")
        require(bool(split_refs(row.get("positive_fixture_refs", ""))), f"LINEAGE_POSITIVE_FIXTURE_EMPTY:{binding_id}")
        require(bool(split_refs(row.get("negative_fixture_refs", ""))), f"LINEAGE_NEGATIVE_FIXTURE_EMPTY:{binding_id}")
        target_source_families: set[str] = set()
        for ref in split_refs(row.get("target_family_refs", "")):
            target = target_by_id.get(ref)
            require(target is not None, f"LINEAGE_TARGET:{binding_id}:{ref}")
            if target is not None:
                require(f"HRIS-{target.get('module')}" == row.get("module"), f"LINEAGE_TARGET_MODULE:{binding_id}:{ref}:{target.get('module')}")
                require(target.get("resolution_state") == "RESOLVED_G2_CONTRACT", f"LINEAGE_TARGET_STATE:{binding_id}:{ref}:{target.get('resolution_state')}")
                target_source_families.update(split_refs(target.get("source_capability_ids", "")))
        require(set(split_refs(row.get("source_family_refs", ""))) == target_source_families, f"LINEAGE_SOURCE_TARGET_DRIFT:{binding_id}")
        for ref in split_refs(row.get("transport_binding_refs", "")):
            local = transport_by_id.get(ref)
            owner = service_binding_by_id.get(ref)
            require(local is not None or owner is not None, f"LINEAGE_TRANSPORT:{binding_id}:{ref}")
            if local is not None:
                require(f"HRIS-{local.get('module')}" == row.get("module"), f"LINEAGE_TRANSPORT_MODULE:{binding_id}:{ref}:{local.get('module')}")
                require(local.get("status") == "RESOLVED_EXACT", f"LINEAGE_TRANSPORT_STATE:{binding_id}:{ref}:{local.get('status')}")
            if owner is not None:
                require(owner.get("state") == "G3_BINDING_SPECIFIED_NOT_IMPLEMENTED", f"LINEAGE_OWNER_BINDING_STATE:{binding_id}:{ref}:{owner.get('state')}")
                expected_consumer = consumer_identity.get(row.get("module", ""), "")
                permitted = expected_consumer in split_refs(owner.get("allowed_consumers", "")) or owner.get("in_process_consumer") == expected_consumer
                require(permitted, f"LINEAGE_OWNER_CONSUMER:{binding_id}:{ref}:{expected_consumer}")
        for ref in split_refs(row.get("api_sor_transition_refs", "")):
            transition = api_sor_by_id.get(ref)
            require(transition is not None, f"LINEAGE_API_SOR:{binding_id}:{ref}")
            if transition is not None:
                require(row.get("module") in split_refs(transition.get("canonical_owner_sessions", "")), f"LINEAGE_API_SOR_OWNER:{binding_id}:{ref}")
                require(transition.get("status") == "CONTRACT_DEFINED_G3_BLOCKED_NOT_CUT_OVER", f"LINEAGE_API_SOR_STATE:{binding_id}:{ref}:{transition.get('status')}")
        for ref in split_refs(row.get("schema_refs", "")):
            require(pointer_get(schemas, ref) is not None, f"LINEAGE_SCHEMA:{binding_id}:{ref}")
        for ref in split_refs(row.get("state_machine_ref", "")):
            require(pointer_get(contract, ref) is not None, f"LINEAGE_STATE:{binding_id}:{ref}")
        for fixture_id in split_refs(row.get("positive_fixture_refs", "")) + split_refs(row.get("negative_fixture_refs", "")):
            require(fixture_id in fixture_ids, f"LINEAGE_FIXTURE:{binding_id}:{fixture_id}")
            require(fixture_id.startswith(f"{row.get('module', '').replace('HRIS-', '')}-"), f"LINEAGE_FIXTURE_MODULE:{binding_id}:{fixture_id}")
            allocated_fixture_ids.add(fixture_id)
        prompt = (HERE / row.get("session_prompt_ref", "")).resolve()
        require(prompt.is_file(), f"LINEAGE_PROMPT:{binding_id}")
        if prompt.is_file():
            require("module-exact-business-start-canonical.v1.json" in prompt.read_text(encoding="utf-8"), f"PROMPT_BINDING:{binding_id}")

    require(len(lineage) == 16, f"LINEAGE_COUNT:{len(lineage)}")
    require(allocated_fixture_ids == set(fixture_ids), f"LINEAGE_FIXTURE_COVERAGE:{'|'.join(sorted(set(fixture_ids)-allocated_fixture_ids))}")

    for finding in expected_findings:
        require(any(finding in split_refs(row.get("finding_ids", "")) for row in lineage), f"FINDING_LINEAGE:{finding}")
    for module, name, _ in aggregates:
        exact = f"#/modules/{module}/aggregates/{name}"
        parent = f"#/modules/{module}/aggregates"
        require(any(exact in split_refs(row.get("state_machine_ref", "")) or parent in split_refs(row.get("state_machine_ref", "")) for row in lineage), f"AGGREGATE_LINEAGE:{module}:{name}")

    proposal_leaks = ["OPEN_EXACT_SOURCE", "DESIGN_PROPOSED_NOT_CANONICAL", "AUTHOR_BOUNDED_DESIGN_MODEL_NOT_CANONICAL"]
    canonical_text = json.dumps(contract, sort_keys=True)
    for marker in proposal_leaks:
        require(marker not in canonical_text, f"PROPOSAL_MARKER:{marker}")

    historical = contract.get("supersession", {})
    require(historical.get("rule") == "Historical proposals remain immutable evidence and are not canonical wholesale. This successor adopts only the explicitly restated decisions below.", "HISTORICAL_NON_PROMOTION_RULE")
    historical_artifacts = historical.get("historicalArtifacts", [])
    require(len(historical_artifacts) == 4, f"HISTORICAL_PIN_COUNT:{len(historical_artifacts)}")
    historical_paths: set[str] = set()
    for artifact in historical_artifacts:
        relative = artifact.get("path", "")
        require(relative not in historical_paths, f"HISTORICAL_PIN_DUPLICATE:{relative}")
        historical_paths.add(relative)
        require(artifact.get("disposition") == "SUPERSEDED_FOR_P0_BY_THIS_CONTRACT", f"HISTORICAL_PROPOSAL_PROMOTED:{relative}:{artifact.get('disposition')}")
        file = HERE / relative
        require(file.is_file(), f"HISTORICAL_PIN_MISSING:{relative}")
        if file.is_file():
            require(digest(file) == artifact.get("sha256"), f"HISTORICAL_PIN_DRIFT:{relative}")

    if verify_pin:
        pin = data["pin"]
        require(pin.get("gateAuthorization") == "NONE_CLOSED_FAIL_SAFE", "PIN_GATE")
        pinned_paths: set[str] = set()
        for artifact in pin.get("artifacts", []):
            relative = artifact.get("path", "")
            require(relative not in pinned_paths, f"PIN_DUPLICATE:{relative}")
            pinned_paths.add(relative)
            file = BLUEPRINT / relative
            require(file.is_file(), f"PIN_FILE_MISSING:{relative}")
            if file.is_file():
                require(digest(file) == artifact.get("sha256"), f"PIN_DRIFT:{relative}")
        required_pin_paths = {
            "coding-readiness/module-exact-business-start-canonical.v1.json",
            "coding-readiness/module-exact-business-schemas.v1.json",
            "coding-readiness/module-exact-business-fixtures.v1.json",
            "coding-readiness/module-exact-business-lineage-register.v1.csv",
            "coding-readiness/validate_module_exact_business_start.cjs",
            "coding-readiness/audit_module_exact_business_start.py",
            "coding-readiness/target-family-resolution-register.csv",
            "coding-readiness/transport-schema-resolution-register.csv",
            "coding-readiness/service-api-auth-binding-register.csv",
            "coding-readiness/hris-api-sor-transition-register.csv",
            "coding-readiness/validate_hris_api_sor_transitions.py",
            "session-prompts/01-cloudhr-hrm-session.md",
            "session-prompts/02-cloudhr-per-session.md",
            "session-prompts/03-cloudhr-pay-session.md",
            "session-prompts/04-cloudhr-tim-session.md",
        }
        require(required_pin_paths == pinned_paths, "PIN_FILE_SET")

    return errors


def load_all() -> dict[str, Any]:
    return {
        "contract": load_json(PATHS["contract"]),
        "schemas": load_json(PATHS["schemas"]),
        "fixtures": load_json(PATHS["fixtures"]),
        "lineage": load_csv(PATHS["lineage"]),
        "targets": load_csv(PATHS["targets"]),
        "transport": load_csv(PATHS["transport"]),
        "service_bindings": load_csv(PATHS["service_bindings"]),
        "api_sor": load_csv(PATHS["api_sor"]),
        "pin": load_json(PATHS["pin"]),
    }


def self_tests(base: dict[str, Any]) -> list[dict[str, Any]]:
    mutations = [
        ("drop-finding", lambda value: value["contract"]["auditClosure"].pop()),
        ("open-gate", lambda value: value["contract"].__setitem__("g3CodeGateAuthorization", "OPEN_G3_CODE")),
        ("remove-module", lambda value: value["contract"]["modules"].pop("HRIS-PAY")),
        ("allof-regression", lambda value: value["schemas"]["$defs"]["FreezePopulationCommand"].__setitem__("allOf", [])),
        ("free-expression", lambda value: value["schemas"]["$defs"]["TypedRuleAst"]["properties"].__setitem__("ruleExpression", {"type": "string"})),
        ("operator-gap", lambda value: value["contract"]["typedOperatorRegistries"]["PAY_RULE_AST_V1"]["operators"].pop("ROUND")),
        ("unreachable-state", lambda value: value["contract"]["modules"]["HRIS-PER"]["aggregates"]["Appeal"]["states"].append("PHANTOM")),
        ("reachable-dead-end", lambda value: (value["contract"]["modules"]["HRIS-PER"]["aggregates"]["Appeal"]["states"].append("PHANTOM"), value["contract"]["modules"]["HRIS-PER"]["aggregates"]["Appeal"]["transitions"].append("strand:OPEN->PHANTOM"))),
        ("terminal-declaration-missing", lambda value: value["contract"]["modules"]["HRIS-PER"]["aggregates"]["Appeal"].pop("terminalStates")),
        ("terminal-illegal-exit", lambda value: value["contract"]["modules"]["HRIS-PER"]["aggregates"]["Appeal"]["transitions"].append("restart:CLOSED->OPEN")),
        ("duplicate-state", lambda value: value["contract"]["modules"]["HRIS-PER"]["aggregates"]["Appeal"]["states"].append("CLOSED")),
        ("ambiguous-transition", lambda value: value["contract"]["modules"]["HRIS-PER"]["aggregates"]["Appeal"]["transitions"].append("review:OPEN->CLOSED")),
        ("schema-count-drift", lambda value: value["schemas"]["$defs"].__setitem__("PhantomClosedRecord", {"type": "object", "additionalProperties": False, "required": ["id"], "properties": {"id": {"type": "string"}}})),
        ("schema-open-object", lambda value: value["schemas"]["$defs"]["AccrualSchedule"]["oneOf"][0].pop("additionalProperties")),
        ("fixture-count-drift", lambda value: value["fixtures"]["validCases"].append({**copy.deepcopy(value["fixtures"]["validCases"][0]), "caseId": "HRM-P-HIRE-EXTRA"})),
        ("empty-write", lambda value: value["contract"]["modules"]["HRIS-TIM"]["aggregates"]["Schedule"].__setitem__("writeSet", [])),
        ("bad-target", lambda value: value["lineage"][0].__setitem__("target_family_refs", "TFR-HRM-999")),
        ("bad-transport", lambda value: value["lineage"][0].__setitem__("transport_binding_refs", "PEP-HRM-999")),
        ("bad-api-sor", lambda value: value["lineage"][0].__setitem__("api_sor_transition_refs", "API-SOR-READ-999")),
        ("valid-cross-module-target", lambda value: value["lineage"][0].__setitem__("target_family_refs", "TFR-PAY-003")),
        ("valid-cross-module-transport", lambda value: value["lineage"][0].__setitem__("transport_binding_refs", "PEP-PAY-002")),
        ("valid-cross-module-api-sor", lambda value: next(row for row in value["lineage"] if row["binding_id"] == "EBS-TIM-SCHEDULE").__setitem__("api_sor_transition_refs", "API-SOR-READ-008")),
        ("source-family-mismatch", lambda value: value["lineage"][0].__setitem__("source_family_refs", "PAY-FOUNDATION")),
        ("empty-source-and-target", lambda value: (value["lineage"][0].__setitem__("source_family_refs", ""), value["lineage"][0].__setitem__("target_family_refs", ""))),
        ("cross-module-fixture", lambda value: value["lineage"][0].__setitem__("positive_fixture_refs", "PAY-P-RUN-REGULAR")),
        ("fixture-lineage-orphan", lambda value: value["lineage"][0].__setitem__("positive_fixture_refs", "HRM-P-HIRE")),
        ("historical-proposal-promotion", lambda value: value["contract"]["supersession"]["historicalArtifacts"][0].__setitem__("disposition", "PROMOTED_CANONICAL")),
        ("duplicate-fixture", lambda value: value["fixtures"]["negativeCases"].append(copy.deepcopy(value["fixtures"]["negativeCases"][0]))),
    ]
    results: list[dict[str, Any]] = []
    for mutation_id, mutation in mutations:
        candidate = copy.deepcopy(base)
        mutation(candidate)
        errors = audit(candidate, verify_pin=False)
        results.append({"id": mutation_id, "rejected": bool(errors), "firstError": errors[0] if errors else None})
    return results


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--compact", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()

    try:
        data = load_all()
        errors = audit(data, verify_pin=True)
        mutation_results = self_tests(data) if args.self_test else []
        if any(not row["rejected"] for row in mutation_results):
            errors.append("SELF_TEST_NOT_REJECTED")
    except Exception as exc:  # fail closed with a stable machine-readable envelope
        data = None
        mutation_results = []
        errors = [f"AUDITOR_EXECUTION:{type(exc).__name__}:{exc}"]

    report = {
        "schema": "dwp.hris.module-exact-business-independent-audit.v1",
        "status": "PASS" if not errors else "FAIL",
        "gateAuthorization": "NONE_CLOSED_FAIL_SAFE",
        "scopeVerdict": "INDEPENDENT_PINNED_MODULE_EXACT_BUSINESS_DESIGN_P0_PASS" if not errors else "FAIL_CLOSED",
        "counts": {} if data is None else {
            "modules": len(data["contract"]["modules"]),
            "auditFindings": len(data["contract"]["auditClosure"]),
            "stateMachines": len(aggregate_rows(data["contract"])),
            "schemaDefinitions": len(data["schemas"]["$defs"]),
            "validSchemaFixtures": len(data["fixtures"]["validCases"]),
            "positiveJourneyFixtures": len(data["fixtures"]["journeyCases"]),
            "negativeFixtures": len(data["fixtures"]["negativeCases"]),
            "lineageBindings": len(data["lineage"]),
            "pinnedArtifacts": len(data["pin"]["artifacts"]),
            "mutationSelfTests": len(mutation_results),
            "mutationSelfTestsRejected": sum(1 for row in mutation_results if row["rejected"]),
        },
        "inputSha256": {name: digest(path) for name, path in PATHS.items() if path.is_file()},
        "selfTests": mutation_results,
        "errors": errors,
    }
    print(json.dumps(report, ensure_ascii=False, sort_keys=True, separators=(",", ":") if args.compact else None, indent=None if args.compact else 2))
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
