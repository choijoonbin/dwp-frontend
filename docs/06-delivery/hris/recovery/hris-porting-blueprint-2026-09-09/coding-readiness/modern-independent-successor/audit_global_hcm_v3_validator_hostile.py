#!/usr/bin/env python3
"""Hostile, read-only audit of the global-HCM v3 acceptance validator.

This reviewer harness imports the validator under test, but never imports the
canonical author generators/validators and never writes candidate artifacts.
Its mutations exist only in deep-copied JSON objects or intercepted authority
file reads.  The original core suite remains exactly 35 tests; these reviewer
probes are deliberately reported separately.
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
DEFAULT_REPORT = HERE / "reports/global-hcm-v3-validator-hostile-audit-latest.v1.json"


def load_validator() -> Any:
    spec = importlib.util.spec_from_file_location("global_hcm_validator_under_review", VALIDATOR_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("cannot load validator under review")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def canonical_json(value: Any) -> bytes:
    return json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":"),
    ).encode("utf-8")


def load_candidate(module: Any, directory: Path) -> tuple[dict[str, dict[str, Any]], dict[str, str], dict[str, str]]:
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


def isolated_issues(module: Any, docs: Mapping[str, dict[str, Any]], audit: dict[str, Any], method: str) -> list[Any]:
    evaluator = module.Evaluator(module.Model(docs), audit)
    getattr(evaluator, method)()
    return evaluator.issues


def issue_present(issues: Sequence[Any], rule: str, subject: str) -> bool:
    return any(row.rule_id == rule and row.subject_id == subject for row in issues)


def mutation_probe(
    module: Any,
    docs: Mapping[str, dict[str, Any]],
    audit: dict[str, Any],
    *,
    test_id: str,
    method: str,
    rule: str,
    subject: str,
    prepare: Callable[[dict[str, dict[str, Any]]], None],
    mutate: Callable[[dict[str, dict[str, Any]]], None],
) -> dict[str, Any]:
    control = copy.deepcopy(dict(docs))
    prepare(control)
    before = isolated_issues(module, control, audit, method)
    hostile = copy.deepcopy(control)
    mutate(hostile)
    after = isolated_issues(module, hostile, audit, method)
    positive_clear = not issue_present(before, rule, subject)
    mutation_detected = issue_present(after, rule, subject)
    return {
        "testId": test_id,
        "method": method,
        "ruleId": rule,
        "subjectId": subject,
        "positiveControl": "PASS" if positive_clear else "FAIL",
        "hostileMutation": "FAIL_DETECTED" if mutation_detected else "MISSED",
        "status": "PASS" if positive_clear and mutation_detected else "FAIL",
        "beforeTargetFindings": [row.as_dict() for row in before if row.rule_id == rule and row.subject_id == subject],
        "afterTargetFindings": [row.as_dict() for row in after if row.rule_id == rule and row.subject_id == subject],
    }


def prepare_wfp(module: Any, value: dict[str, dict[str, Any]]) -> None:
    operation_doc = value["operation"]
    operation_doc["systemHandlers"] = [
        row for row in operation_doc.get("systemHandlers", [])
        if row.get("handlerId") != "internal.workforceplan.simulation-result.consume"
    ]
    operation_doc["systemHandlers"].append({
        "handlerId": "internal.workforceplan.simulation-result.consume",
        "aggregateRoot": {
            "table": module.WFP_REQUEST_TABLE,
            "publicIdColumn": "public_id",
            "versionColumn": "aggregate_version",
            "stateColumn": "state",
            "preStates": ["REQUESTED"],
            "postStates": ["COMPLETED", "FAILED"],
        },
        "writes": [{
            "table": module.WFP_REQUEST_TABLE,
            "action": "UPDATE_CAS",
            "role": "MONOTONIC_SIMULATION_REQUEST_TERMINAL_CAS",
            "selector": module.WFP_HANDLER_SELECTOR,
            "assignments": copy.deepcopy(module.WFP_HANDLER_ASSIGNMENTS),
        }],
    })
    cancel = next(
        row for row in operation_doc["operations"]
        if row.get("operationId") == "modern.workforceplan.scenario.cancel"
    )
    cancel["orderedDml"] = [
        row for row in cancel.get("orderedDml", [])
        if row.get("table") != module.WFP_REQUEST_TABLE
    ]
    cancel["orderedDml"].append({
        "table": module.WFP_REQUEST_TABLE,
        "action": "UPDATE_CAS",
        "role": "CANCEL_ACTIVE_SIMULATION_REQUEST",
        "selector": module.WFP_CANCEL_SELECTOR,
        "assignments": copy.deepcopy(module.WFP_CANCEL_ASSIGNMENTS),
        "expectedRows": "ZERO_OR_ONE_ACTIVE_REQUEST",
    })
    table = next(
        row for row in value["exact"]["tableSpecifications"]
        if row.get("tableName") == module.WFP_REQUEST_TABLE
    )
    table["immutableColumns"] = sorted(module.WFP_IMMUTABLE_COLUMNS)
    table["terminalCasContract"] = {
        "preState": "REQUESTED",
        "postStates": ["COMPLETED", "FAILED", "CANCELLED"],
        "expectedRows": "EXACTLY_ONE_OR_CANCEL_ZERO_IF_NO_ACTIVE_REQUEST",
        "terminalStateMutationForbidden": True,
        "inputPinMutationForbidden": True,
    }
    table["immutability"] = "IMMUTABLE_REQUEST_INPUT_PINS_WITH_EXACT_MONOTONIC_REQUESTED_TO_TERMINAL_CAS"
    table["checks"] = [
        row for row in table.get("checks", [])
        if row.get("constraintId") != "ck_ppl_wfp_simulation_requests_result_tuple_v3"
    ]
    table["checks"].append({
        "constraintId": "ck_ppl_wfp_simulation_requests_result_tuple_v3",
        "expression": module.WFP_RESULT_TUPLE_EXPRESSION,
        "columns": [
            "state", "result_public_id", "result_revision", "result_receipt_public_id",
            "result_receipt_revision", "result_schema_version", "result_digest", "completed_at",
        ],
    })


def wfp_handler(value: dict[str, dict[str, Any]]) -> dict[str, Any]:
    return next(
        row for row in value["operation"]["systemHandlers"]
        if row.get("handlerId") == "internal.workforceplan.simulation-result.consume"
    )


def mutate_wfp_immutable_pin(value: dict[str, dict[str, Any]]) -> None:
    wfp_handler(value)["writes"][0]["assignments"]["scenario_revision"] = "body.forgedScenarioRevision"


def mutate_wfp_selector(value: dict[str, dict[str, Any]]) -> None:
    wfp_handler(value)["writes"][0]["selector"] = "NOT_REQUESTED_BUT_WORD_REQUESTED terminal wildcard"


def mutate_wfp_prestate(value: dict[str, dict[str, Any]]) -> None:
    wfp_handler(value)["aggregateRoot"]["preStates"] = ["REQUESTED", "COMPLETED"]


def mutate_wfp_version(value: dict[str, dict[str, Any]]) -> None:
    wfp_handler(value)["writes"][0]["assignments"]["aggregate_version"] = "body.aggregateVersion"


def prepare_ai(module: Any, value: dict[str, dict[str, Any]]) -> None:
    table = next(
        row for row in value["exact"]["tableSpecifications"]
        if row.get("tableName") == module.AI_REVIEW_TABLE
    )
    table["columns"] = [
        row for row in table.get("columns", [])
        if row.get("name") not in {"prior_review_public_id", "prior_review_revision"}
    ]
    table["columns"].extend([
        {
            "name": "prior_review_public_id", "sqlType": "UUID", "nullable": True,
            "sensitivity": "RESTRICTED", "tokenization": "OPAQUE_PUBLIC_ID",
            "referenceContract": {
                "entityType": "table:sys_hris_ai_assistance_reviews", "idSpace": "PUBLIC_UUID",
            },
        },
        {
            "name": "prior_review_revision", "sqlType": "BIGINT", "nullable": True,
            "sensitivity": "RESTRICTED", "tokenization": "NONE",
        },
    ])
    table["foreignKeys"] = [
        row for row in table.get("foreignKeys", [])
        if "prior_review" not in json.dumps(row, sort_keys=True)
    ]
    table["foreignKeys"].append({
        "mode": "LOCAL_COMPOSITE_FK",
        "columns": ["tenant_id", "prior_review_public_id"],
        "target": module.AI_REVIEW_TABLE,
        "targetColumns": ["tenant_id", "public_id"],
    })
    table["checks"] = [
        row for row in table.get("checks", [])
        if "prior_review" not in json.dumps(row, sort_keys=True)
    ]
    table["checks"].append({
        "columns": ["decision", "prior_review_public_id", "prior_review_revision"],
        "expression": module.AI_REVOCATION_LINK_EXPRESSION,
    })

    revoke = next(
        row for row in value["operation"]["operations"]
        if row.get("operationId") == "modern.ai.assist.revoke"
    )
    revoke["aggregateRoot"] = {
        "table": module.AI_ASSISTANCE_ROOT,
        "publicIdColumn": "public_id",
        "versionColumn": "aggregate_version",
        "stateColumn": "state",
        "tenantColumn": "tenant_id",
    }
    revoke["transition"] = {
        **revoke.get("transition", {}),
        "preStates": ["CONFIRMED"],
        "postStates": ["REVOKED"],
        "postStateSource": "CONSTANT:REVOKED",
        "stateSink": module.AI_ASSISTANCE_ROOT + ".state",
    }
    root_steps = [
        row for row in revoke.get("orderedDml", [])
        if row.get("table") == module.AI_ASSISTANCE_ROOT
    ]
    root = copy.deepcopy(root_steps[0]) if root_steps else {}
    root.update({
        "table": module.AI_ASSISTANCE_ROOT,
        "action": "UPDATE_CAS",
        "role": "CONCURRENCY_ROOT",
        "selector": module.AI_ROOT_SELECTOR,
        "expectedRows": "EXACTLY_ONE",
        "assignments": copy.deepcopy(module.AI_ROOT_ASSIGNMENTS),
    })
    remaining = [
        row for row in revoke.get("orderedDml", [])
        if row.get("table") not in {module.AI_REVIEW_TABLE, module.AI_ASSISTANCE_ROOT}
    ]
    review = {
        "table": module.AI_REVIEW_TABLE,
        "action": "APPEND",
        "role": "IMMUTABLE_AI_HUMAN_REVOCATION_DECISION",
        "assignments": {
            "assistance_request_public_id": "pathParameters.assistanceId",
            "review_revision": "LOCKED_PRE:sys_hris_ai_assistance_requests.aggregate_version+1",
            "decision": "CONSTANT:REVOKED",
            "subject_worker_public_id": "LOCKED_PRE:sys_hris_ai_assistance_requests.subject_worker_public_id",
            "prior_review_public_id": "LOCKED_PRE:sys_hris_ai_assistance_reviews.public_id",
            "prior_review_revision": "LOCKED_PRE:sys_hris_ai_assistance_reviews.review_revision",
        },
    }
    revoke["orderedDml"] = remaining[:1] + [review, root] + remaining[1:]
    effects = [
        row for row in revoke.get("inputEffects", [])
        if row.get("source") != "headers.If-Match"
    ]
    effects.append({
        "source": "headers.If-Match",
        "effects": [{
            "kind": "ROOT_CAS_FILTER",
            "target": module.AI_ASSISTANCE_ROOT + ".aggregate_version",
        }],
    })
    revoke["inputEffects"] = effects


def ai_revoke(value: dict[str, dict[str, Any]]) -> dict[str, Any]:
    return next(
        row for row in value["operation"]["operations"]
        if row.get("operationId") == "modern.ai.assist.revoke"
    )


def mutate_ai_prior_source(value: dict[str, dict[str, Any]]) -> None:
    step = next(
        row for row in ai_revoke(value)["orderedDml"]
        if row.get("table") == "sys_hris_ai_assistance_reviews"
    )
    step["assignments"]["prior_review_public_id"] = "body.forgedReviewId"
    step["assignments"]["prior_review_revision"] = "body.forgedReviewRevision"


def mutate_ai_extra_root(value: dict[str, dict[str, Any]]) -> None:
    revoke = ai_revoke(value)
    root = next(
        row for row in revoke["orderedDml"]
        if row.get("table") == "sys_hris_ai_assistance_requests"
    )
    revoke["orderedDml"].insert(revoke["orderedDml"].index(root) + 1, copy.deepcopy(root))


def mutate_ai_selector(value: dict[str, dict[str, Any]]) -> None:
    root = next(
        row for row in ai_revoke(value)["orderedDml"]
        if row.get("table") == "sys_hris_ai_assistance_requests"
    )
    root["selector"] = "NONE"


def mutate_ai_prestate(value: dict[str, dict[str, Any]]) -> None:
    ai_revoke(value)["transition"]["preStates"] = ["PRODUCED", "CONFIRMED"]


def mutate_ai_version(value: dict[str, dict[str, Any]]) -> None:
    root = next(
        row for row in ai_revoke(value)["orderedDml"]
        if row.get("table") == "sys_hris_ai_assistance_requests"
    )
    root["assignments"]["aggregate_version"] = "body.aggregateVersion"


def entity_for(module: Any, value: Mapping[str, dict[str, Any]], operation_id: str) -> dict[str, Any]:
    return module.Model(value).response_entity(operation_id) or {}


def table_lineage_rows(value: dict[str, dict[str, Any]], operation_id: str, table: str) -> list[dict[str, Any]]:
    lineage = next(
        row for row in value["exact"]["operationFieldLineage"]
        if row.get("operationId") == operation_id
    )
    return [
        row for row in lineage.get("responseFieldSources", [])
        if str(row.get("sourcePath", "")).startswith(table + ".")
    ]


def mutate_lineage_ghost(value: dict[str, dict[str, Any]]) -> None:
    rows = table_lineage_rows(value, "modern.ai.assistance.query", "sys_hris_ai_assistance_reviews")
    rows[0]["sourcePath"] = "sys_hris_ai_assistance_reviews.__ghost_column"


def mutate_lineage_duplicate(value: dict[str, dict[str, Any]]) -> None:
    operation_id = "modern.ai.assistance.query"
    table = "sys_hris_ai_assistance_reviews"
    lineage = next(
        row for row in value["exact"]["operationFieldLineage"]
        if row.get("operationId") == operation_id
    )
    rows = table_lineage_rows(value, operation_id, table)
    replacement = [copy.deepcopy(rows[0]), copy.deepcopy(rows[0])]
    lineage["responseFieldSources"] = [
        row for row in lineage.get("responseFieldSources", [])
        if not str(row.get("sourcePath", "")).startswith(table + ".")
    ] + replacement


def mutate_field_policy(value: dict[str, dict[str, Any]], field: str, replacement: Any) -> None:
    operation_id = "modern.ai.assistance.query"
    rows = table_lineage_rows(value, operation_id, "sys_hris_ai_assistance_reviews")
    target_name = str(rows[0]["target"]).rsplit(".", 1)[-1]
    entity = entity_for(load_validator(), value, operation_id)
    target = next(row for row in entity["fields"] if row.get("name") == target_name)
    if replacement is None:
        target.pop(field, None)
    else:
        target[field] = replacement


def mutate_tokenization(value: dict[str, dict[str, Any]]) -> None:
    mutate_field_policy(value, "tokenization", None)


def mutate_redaction(value: dict[str, dict[str, Any]]) -> None:
    mutate_field_policy(value, "fieldPolicy", {
        "authorizationCapability": "hcm.ai.assist.use",
        "behavior": "ALLOW_ALL",
        "unknownField": "ALLOW",
        "denyOnUnavailable": False,
    })


def mutate_extra_reader(value: dict[str, dict[str, Any]]) -> None:
    operation = next(
        row for row in value["operation"]["operations"]
        if row.get("operationId") == "modern.ai.evaluation.query"
    )
    operation.setdefault("readPlan", {}).setdefault("tables", []).append("sys_hris_ai_assistance_reviews")
    operation["readPlan"].setdefault("projectionTuple", {}).setdefault("physicalSources", []).append(
        "sys_hris_ai_assistance_reviews"
    )


@contextmanager
def intercepted_read(target: Path, replacement: bytes) -> Iterator[None]:
    original = Path.read_bytes
    resolved_target = target.resolve()

    def replacement_read(path: Path) -> bytes:
        if path.resolve() == resolved_target:
            return replacement
        return original(path)

    Path.read_bytes = replacement_read
    try:
        yield
    finally:
        Path.read_bytes = original


def authority_issues(
    module: Any,
    docs: Mapping[str, dict[str, Any]],
    audit: dict[str, Any],
    hashes: Mapping[str, str],
    paths: Mapping[str, str],
) -> list[Any]:
    evaluator = module.Evaluator(module.Model(docs, hashes, paths), audit)
    evaluator.check_source_integrity()
    return evaluator.issues


def authority_probe(
    module: Any,
    docs: Mapping[str, dict[str, Any]],
    audit: dict[str, Any],
    hashes: Mapping[str, str],
    paths: Mapping[str, str],
    *,
    test_id: str,
    target: Path,
    replacement: bytes,
    expected_rules: set[str],
) -> dict[str, Any]:
    before = authority_issues(module, docs, audit, hashes, paths)
    with intercepted_read(target, replacement):
        after = authority_issues(module, docs, audit, hashes, paths)
    before_rules = {row.rule_id for row in before}
    after_rules = {row.rule_id for row in after}
    positive_clear = not (before_rules & expected_rules)
    detected = bool(after_rules & expected_rules)
    return {
        "testId": test_id,
        "expectedRuleIds": sorted(expected_rules),
        "positiveControl": "PASS" if positive_clear else "FAIL",
        "hostileMutation": "FAIL_DETECTED" if detected else "MISSED",
        "detectedRuleIds": sorted(after_rules & expected_rules),
        "status": "PASS" if positive_clear and detected else "FAIL",
    }


def producer_probe(module: Any, docs: Mapping[str, dict[str, Any]], audit: dict[str, Any], *, action_only: bool) -> dict[str, Any]:
    table = "ppl_rec_offer_decisions"
    rule = "EXPANSION.WRITE_MODE" if action_only else "EXPANSION.PRODUCERS"
    control = copy.deepcopy(dict(docs))
    before = isolated_issues(module, control, audit, "check_expansion_physical_semantics")
    hostile = copy.deepcopy(control)
    if action_only:
        producer = next(
            row for row in hostile["operation"]["operations"]
            if row.get("operationId") == "modern.recruiting.offer.respond"
        )
        step = next(row for row in producer["orderedDml"] if row.get("table") == table)
        step["action"] = "UPDATE_CAS"
        test_id = "non_wfp_update_cas_rejected"
    else:
        producer = next(
            row for row in hostile["operation"]["operations"]
            if row.get("operationId") == "modern.ai.assist.cancel"
        )
        producer.setdefault("orderedDml", []).append({
            "table": table, "action": "APPEND", "assignments": {"decision": "CONSTANT:FORGED"},
        })
        test_id = "undeclared_extra_producer_rejected"
    after = isolated_issues(module, hostile, audit, "check_expansion_physical_semantics")
    positive_clear = not issue_present(before, rule, table)
    detected = issue_present(after, rule, table)
    return {
        "testId": test_id, "ruleId": rule, "subjectId": table,
        "positiveControl": "PASS" if positive_clear else "FAIL",
        "hostileMutation": "FAIL_DETECTED" if detected else "MISSED",
        "status": "PASS" if positive_clear and detected else "FAIL",
    }


def gate_coupling_probe(module: Any, docs: Mapping[str, dict[str, Any]], audit: dict[str, Any], hashes: Mapping[str, str], paths: Mapping[str, str]) -> dict[str, Any]:
    real_evaluate = module.evaluate_docs

    def no_findings(
        value: Mapping[str, dict[str, Any]], requirement: dict[str, Any],
        source_hashes: Mapping[str, str] | None = None,
        source_paths: Mapping[str, str] | None = None,
    ) -> tuple[Any, list[Any]]:
        return module.Model(value, source_hashes, source_paths), []

    module.evaluate_docs = no_findings
    try:
        all_pass = [{"testId": f"core-{index}", "status": "PASS"} for index in range(35)]
        short = all_pass[:-1]
        failed = copy.deepcopy(all_pass)
        failed[-1]["status"] = "FAIL"
        report_pass = module.build_report(docs, audit, hashes, paths, all_pass)
        report_short = module.build_report(docs, audit, hashes, paths, short)
        report_failed = module.build_report(docs, audit, hashes, paths, failed)
    finally:
        module.evaluate_docs = real_evaluate
    passed = (
        report_pass["summary"]["readyForGateConsideration"] is True
        and report_pass["summary"]["status"] == "PASS_GLOBAL_HCM_LIVE_ACCEPTANCE"
        and report_short["summary"]["readyForGateConsideration"] is False
        and report_short["summary"]["status"] == "FAIL_GLOBAL_HCM_LIVE_ACCEPTANCE"
        and report_failed["summary"]["readyForGateConsideration"] is False
        and report_failed["summary"]["status"] == "FAIL_GLOBAL_HCM_LIVE_ACCEPTANCE"
    )
    return {
        "testId": "gate_requires_exact_35_of_35",
        "status": "PASS" if passed else "FAIL",
        "allPassSummary": report_pass["summary"],
        "shortSummary": report_short["summary"],
        "failedSummary": report_failed["summary"],
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

    predecessor = json.loads(module.PREDECESSOR_POLICY_PATH.read_text(encoding="utf-8"))
    predecessor["status"] = "TAMPERED"
    tests.append(authority_probe(
        module, docs, audit, hashes_before, paths,
        test_id="predecessor_bytes_seal_status_drift_rejected",
        target=module.PREDECESSOR_POLICY_PATH,
        replacement=canonical_json(predecessor),
        expected_rules={
            "SOURCE.EXPANSION_POLICY_PREDECESSOR_FILE",
            "SOURCE.EXPANSION_POLICY_PREDECESSOR_SEAL",
            "SOURCE.EXPANSION_POLICY_PREDECESSOR_IDENTITY",
        },
    ))
    review = json.loads(module.INDEPENDENT_SCOPE_REVIEW_PATH.read_text(encoding="utf-8"))
    review["status"] = "PASS_FORGED"
    review["findings"] = review.get("findings", [])[1:]
    tests.append(authority_probe(
        module, docs, audit, hashes_before, paths,
        test_id="failed_review_bytes_status_required_findings_drift_rejected",
        target=module.INDEPENDENT_SCOPE_REVIEW_PATH,
        replacement=canonical_json(review),
        expected_rules={
            "SOURCE.EXPANSION_POLICY_REVIEW_FILE",
            "SOURCE.EXPANSION_POLICY_REVIEW_STATUS",
            "SOURCE.EXPANSION_POLICY_REVIEW_FINDINGS",
        },
    ))

    tests.extend([
        producer_probe(module, docs, audit, action_only=False),
        producer_probe(module, docs, audit, action_only=True),
    ])
    for test_id, mutation in (
        ("wfp_immutable_input_pin_mutation_rejected", mutate_wfp_immutable_pin),
        ("wfp_selector_substring_spoof_rejected", mutate_wfp_selector),
        ("wfp_non_requested_prestate_rejected", mutate_wfp_prestate),
        ("wfp_unlocked_version_assignment_rejected", mutate_wfp_version),
    ):
        tests.append(mutation_probe(
            module, docs, audit, test_id=test_id,
            method="check_wfp_simulation_lifecycle",
            rule="WFP.SIMULATION_TERMINAL_CAS",
            subject="internal.workforceplan.simulation-result.consume",
            prepare=lambda value, mod=module: prepare_wfp(mod, value), mutate=mutation,
        ))
    for test_id, mutation in (
        ("ai_forged_prior_review_source_rejected", mutate_ai_prior_source),
        ("ai_duplicate_root_cas_rejected", mutate_ai_extra_root),
        ("ai_root_selector_spoof_rejected", mutate_ai_selector),
        ("ai_wrong_prestate_rejected", mutate_ai_prestate),
        ("ai_unlocked_root_version_rejected", mutate_ai_version),
    ):
        tests.append(mutation_probe(
            module, docs, audit, test_id=test_id,
            method="check_ai_review_table",
            rule="AI.REVOKE_APPEND_THEN_CAS",
            subject="modern.ai.assist.revoke",
            prepare=lambda value, mod=module: prepare_ai(mod, value), mutate=mutation,
        ))
    for test_id, rule, subject, mutation in (
        ("expanded_lineage_ghost_column_rejected", "EXPANDED_QUERY.FIELD_LINEAGE", "modern.ai.assistance.query", mutate_lineage_ghost),
        ("expanded_lineage_duplicate_binding_rejected", "EXPANDED_QUERY.FIELD_LINEAGE", "modern.ai.assistance.query", mutate_lineage_duplicate),
        ("expanded_lineage_missing_tokenization_rejected", "EXPANDED_QUERY.FIELD_POLICY", "modern.ai.assistance.query", mutate_tokenization),
        ("expanded_lineage_open_redaction_rejected", "EXPANDED_QUERY.FIELD_POLICY", "modern.ai.assistance.query", mutate_redaction),
        ("expanded_undeclared_extra_reader_rejected", "EXPANDED_QUERY.READER_SET", "sys_hris_ai_assistance_reviews", mutate_extra_reader),
    ):
        tests.append(mutation_probe(
            module, docs, audit, test_id=test_id,
            method="check_expanded_query_lineage", rule=rule, subject=subject,
            prepare=lambda value: None, mutate=mutation,
        ))
    tests.append(gate_coupling_probe(module, docs, audit, hashes_before, paths))

    hashes_after = {
        role: module.sha256_file(Path(path)) for role, path in paths.items()
    }
    policy = module.load_json(module.EXPANSION_POLICY_PATH)
    review_doc = module.load_json(module.INDEPENDENT_SCOPE_REVIEW_PATH)
    policy_rows = {row["tableId"]: row for row in policy["successorScope"]["addedRows"]}
    review_rows = {row["tableId"]: row for row in review_doc["tableReviews"]}
    authority_rows_match = all(
        policy_rows[table_id]["ownerSession"] == review_rows[table_id]["ownerSession"]
        and set(policy_rows[table_id]["producers"]) == set(review_rows[table_id]["completeProducers"])
        and set(policy_rows[table_id]["readConsumers"]) == set(review_rows[table_id]["readConsumers"])
        for table_id in module.EXPECTED_GLOBAL_EXPANSION_TABLES
    )
    all_pass = all(row["status"] == "PASS" for row in tests)
    unchanged = hashes_before == hashes_after
    report = {
        "reportId": "DWP-HRIS-GLOBAL-HCM-V3-VALIDATOR-HOSTILE-AUDIT-V1",
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "authorityBoundary": "INDEPENDENT_VALIDATOR_REVIEW_NOT_G3_AUTHORITY",
        "validator": {
            "path": str(VALIDATOR_PATH.resolve()),
            "sha256": module.sha256_file(VALIDATOR_PATH),
            "coreSelfTestInvariant": "primitive10+deterministic1+targeted24=35; reviewer hostile probes are separate",
        },
        "policyChain": {
            "v3Path": str(module.EXPANSION_POLICY_PATH.resolve()),
            "v3Sha256": module.sha256_file(module.EXPANSION_POLICY_PATH),
            "v3DeclaredSeal": policy.get("sealedPayloadSha256"),
            "v3ComputedSeal": module.sealed_payload_sha256(policy),
            "v2Path": str(module.PREDECESSOR_POLICY_PATH.resolve()),
            "v2Sha256": module.sha256_file(module.PREDECESSOR_POLICY_PATH),
            "failedReviewPath": str(module.INDEPENDENT_SCOPE_REVIEW_PATH.resolve()),
            "failedReviewSha256": module.sha256_file(module.INDEPENDENT_SCOPE_REVIEW_PATH),
            "failedReviewStatus": review_doc.get("status"),
            "exact17AuthorityRowsMatch": authority_rows_match,
        },
        "candidateSources": {
            role: {"path": paths[role], "sha256Before": hashes_before[role], "sha256After": hashes_after[role]}
            for role in sorted(paths)
        },
        "tests": tests,
        "summary": {
            "status": "PASS_HOSTILE_VALIDATOR_AUDIT" if all_pass and unchanged and authority_rows_match else "FAIL_HOSTILE_VALIDATOR_AUDIT",
            "testCount": len(tests),
            "passed": sum(row["status"] == "PASS" for row in tests),
            "failed": sum(row["status"] != "PASS" for row in tests),
            "candidateBytesUnchanged": unchanged,
            "exact17AuthorityRowsMatch": authority_rows_match,
            "notGateAuthority": True,
        },
    }
    report["sealedPayloadSha256"] = module.sha256_bytes(canonical_json(report))
    if not args.check:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(
            json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
    print(json.dumps(report["summary"], ensure_ascii=False, sort_keys=True))
    return 0 if report["summary"]["status"] == "PASS_HOSTILE_VALIDATOR_AUDIT" else 1


if __name__ == "__main__":
    raise SystemExit(main())
