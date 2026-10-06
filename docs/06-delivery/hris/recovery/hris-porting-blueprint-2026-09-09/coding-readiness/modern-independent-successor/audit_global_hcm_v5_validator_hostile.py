#!/usr/bin/env python3
"""Hostile successor audit for the sealed v5 global-HCM validator profile.

The supplied candidate is immutable mutation substrate.  Every hostile probe
operates on a deep copy in memory, while source hashes are checked before and
after the suite.  The suite targets only G02-G12; G13-G14 are exercised by the
owner-stream validator's v5 self-tests.
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
DEFAULT_REPORT = HERE / "reports/global-hcm-v5-validator-hostile-audit-latest.v1.json"


def load_validator() -> Any:
    spec = importlib.util.spec_from_file_location("global_hcm_v5_validator_under_review", VALIDATOR_PATH)
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


def operation(docs: Mapping[str, dict[str, Any]], operation_id: str) -> dict[str, Any]:
    return next(row for row in docs["operation"]["operations"] if row.get("operationId") == operation_id)


def handler(docs: Mapping[str, dict[str, Any]], handler_id: str) -> dict[str, Any]:
    return next(row for row in docs["operation"]["systemHandlers"] if row.get("handlerId") == handler_id)


def table(docs: Mapping[str, dict[str, Any]], table_name: str) -> dict[str, Any]:
    return next(row for row in docs["exact"]["tableSpecifications"] if row.get("tableName") == table_name)


def lineage(docs: Mapping[str, dict[str, Any]], operation_id: str) -> dict[str, Any]:
    return next(row for row in docs["exact"]["operationFieldLineage"] if row.get("operationId") == operation_id)


def entity(docs: Mapping[str, dict[str, Any]], operation_id: str) -> dict[str, Any]:
    bindings = {row["operationId"]: row for row in docs["exact"]["operationBindings"]}
    schemas = {
        row["schemaId"]: row
        for row in docs["exact"].get("recordSchemas", []) + docs["exact"].get("responseSchemas", [])
    }
    response = schemas[bindings[operation_id]["responseSchemaRef"]]
    field = next(row for row in response.get("fields", []) if row.get("name") in {"item", "items"})
    return schemas[field.get("schemaRef") or field.get("itemSchemaRef")]


def event_owner(docs: Mapping[str, dict[str, Any]], event_name: str) -> tuple[dict[str, Any], dict[str, Any]]:
    for owner in docs["operation"].get("operations", []) + docs["operation"].get("systemHandlers", []):
        events = [owner.get("event"), *owner.get("additionalEvents", []), *owner.get("events", [])]
        for row in events:
            if isinstance(row, dict) and row.get("eventName") == event_name:
                return owner, row
    raise KeyError(event_name)


def issue_present(issues: Sequence[Any], rule_id: str, subject_id: str) -> bool:
    return any(row.rule_id == rule_id and row.subject_id == subject_id for row in issues)


def evaluate(
    module: Any, docs: Mapping[str, dict[str, Any]], audit: dict[str, Any],
    hashes: Mapping[str, str], paths: Mapping[str, str],
) -> list[Any]:
    return module.evaluate_docs(docs, audit, hashes, paths)[1]


def hostile_probe(
    module: Any,
    docs: Mapping[str, dict[str, Any]],
    audit: dict[str, Any],
    hashes: Mapping[str, str],
    paths: Mapping[str, str],
    baseline: Sequence[Any],
    *,
    test_id: str,
    group_id: str,
    rule_id: str,
    subject_id: str,
    mutate: Callable[[dict[str, dict[str, Any]]], None],
) -> dict[str, Any]:
    hostile = copy.deepcopy(dict(docs))
    mutate(hostile)
    issues = evaluate(module, hostile, audit, hashes, paths)
    clear = not issue_present(baseline, rule_id, subject_id)
    detected = issue_present(issues, rule_id, subject_id)
    return {
        "testId": test_id,
        "groupId": group_id,
        "expectedRuleId": rule_id,
        "subjectId": subject_id,
        "positiveControl": "PASS" if clear else "FAIL",
        "hostileMutation": "FAIL_DETECTED" if detected else "MISSED",
        "status": "PASS" if clear and detected else "FAIL",
    }


@contextmanager
def intercepted_path(target: Path, replacement: bytes) -> Iterator[None]:
    original_bytes = Path.read_bytes
    original_text = Path.read_text
    resolved = target.resolve()

    def read_bytes(path: Path) -> bytes:
        return replacement if path.resolve() == resolved else original_bytes(path)

    def read_text(path: Path, *args: Any, **kwargs: Any) -> str:
        if path.resolve() == resolved:
            return replacement.decode(kwargs.get("encoding") or "utf-8")
        return original_text(path, *args, **kwargs)

    Path.read_bytes = read_bytes
    Path.read_text = read_text
    try:
        yield
    finally:
        Path.read_bytes = original_bytes
        Path.read_text = original_text


def authority_probe(
    module: Any,
    docs: Mapping[str, dict[str, Any]],
    audit: dict[str, Any],
    hashes: Mapping[str, str],
    paths: Mapping[str, str],
    *,
    test_id: str,
    target: Path,
    rule_ids: set[str],
) -> dict[str, Any]:
    value = module.load_json(target)
    value["status"] = "HOSTILE_FORGED"
    before_evaluator = module.Evaluator(module.Model(docs, hashes, paths), audit)
    before_evaluator.check_source_integrity()
    with intercepted_path(target, canonical_json(value)):
        after_evaluator = module.Evaluator(module.Model(docs, hashes, paths), audit)
        after_evaluator.check_source_integrity()
    before = before_evaluator.issues
    after = after_evaluator.issues
    clear = not any(row.rule_id in rule_ids for row in before)
    detected = any(row.rule_id in rule_ids for row in after)
    return {
        "testId": test_id,
        "groupId": "POLICY_CHAIN",
        "expectedRuleIds": sorted(rule_ids),
        "positiveControl": "PASS" if clear else "FAIL",
        "hostileMutation": "FAIL_DETECTED" if detected else "MISSED",
        "status": "PASS" if clear and detected else "FAIL",
    }


def remove_field(rows: list[dict[str, Any]], name: str) -> None:
    rows[:] = [row for row in rows if row.get("name") != name]


def remove_lineage_for_table(rows: list[dict[str, Any]], table_name: str) -> None:
    rows[:] = [row for row in rows if table_name not in str(row.get("sourcePath", ""))]


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
    baseline = evaluate(module, docs, audit, hashes_before, paths)
    tests: list[dict[str, Any]] = []

    def add(
        test_id: str, group_id: str, rule_id: str, subject_id: str,
        mutate: Callable[[dict[str, dict[str, Any]]], None],
    ) -> None:
        tests.append(hostile_probe(
            module, docs, audit, hashes_before, paths, baseline,
            test_id=test_id, group_id=group_id, rule_id=rule_id,
            subject_id=subject_id, mutate=mutate,
        ))

    def remove_non_revocation_proof_expiry(d: dict[str, dict[str, Any]]) -> None:
        credential = next(
            row for row in operation(d, "modern.listening.active.query")["requestFields"]
            if row.get("name") == "X-Listening-Participation-Credential"
        )
        proof = next(
            row for row in credential["valueSchema"]["fields"]
            if row.get("name") == "nonRevocationProof"
        )
        remove_field(proof["valueSchema"]["fields"], "proofExpiresAt")

    # G02: anonymous credential holder PEP has its own closed authority class.
    add("G02-remove-audience-selector", "G02", "QUERY.PEP", "modern.listening.active.query",
        lambda d: operation(d, "modern.listening.active.query").__setitem__(
            "selectors", [row for row in operation(d, "modern.listening.active.query")["selectors"]
                          if row.get("selectorType") != "SIGNED_CREDENTIAL_PROTECTED_RESOURCE_AUDIENCE"]))
    add("G02-remove-proof-expiry", "G02", "QUERY.PEP", "modern.listening.active.query",
        remove_non_revocation_proof_expiry)
    add("G02-remove-tenant-pep", "G02", "QUERY.PEP", "modern.listening.active.query",
        lambda d: operation(d, "modern.listening.active.query")["readPlan"]["projectionTuple"]["pep"].pop("tenant"))
    add("G02-add-principal-coupling", "G02", "QUERY.PEP", "modern.listening.active.query",
        lambda d: operation(d, "modern.listening.active.query").setdefault("inputEffects", []).append(
            {"source": "authenticatedPrincipal.workerPublicId", "effects": []}))
    add("G02-unknown-audience", "G02", "QUERY.PEP", "modern.listening.active.query",
        lambda d: next(row for row in operation(d, "modern.listening.active.query")["selectors"]
                       if row.get("selectorType") == "SIGNED_CREDENTIAL_PROTECTED_RESOURCE_AUDIENCE").__setitem__(
                           "versionRule", "aud=HOSTILE.UNKNOWN"))

    # G03: privacy-safe cohort projection plus separate exact lineage receipt.
    add("G03-suppressed-measure-exposure", "G03", "LISTENING.COHORT_PROFILE", "modern.listening.cohorts.query",
        lambda d: next(row for row in entity(d, "modern.listening.cohorts.query")["fields"]
                       if row.get("name") == "measureValues").__setitem__("condition", "ALWAYS"))
    add("G03-remove-privacy-receipt-column", "G03", "LISTENING.COHORT_PROFILE", "modern.listening.cohorts.query",
        lambda d: remove_field(table(d, "sys_hris_listening_cohort_projections")["columns"],
                               "privacy_budget_receipt_public_id"))
    add("G03-break-lineage-tenant-fk", "G03", "LISTENING.COHORT_PROFILE", "modern.listening.cohorts.query",
        lambda d: table(d, "sys_hris_listening_lineage_receipts")["foreignKeys"][0].__setitem__(
            "columns", ["listening_cohort_projection_id"]))
    add("G03-add-raw-bucket", "G03", "LISTENING.COHORT_PROFILE", "modern.listening.cohorts.query",
        lambda d: table(d, "sys_hris_listening_cohort_projections")["columns"].append(
            {"name": "bucket", "sqlType": "JSONB", "nullable": True}))
    add("G03-break-lineage-source-epoch", "G03", "LISTENING.COHORT_PROFILE", "modern.listening.cohorts.query",
        lambda d: remove_field(table(d, "sys_hris_listening_lineage_receipts")["columns"], "source_epoch"))

    # G04: multi-phase erasure saga, with no fictitious one-transaction claim.
    erasure = "internal.listening.protected.erasure.process"
    add("G04-remove-lease-phase", "G04", "LISTENING.HANDLER_TRANSACTION", erasure,
        lambda d: handler(d, erasure)["structuredTransaction"]["phases"].pop(0))
    add("G04-failure-writes-tombstone", "G04", "LISTENING.HANDLER_TRANSACTION", erasure,
        lambda d: next(row for row in handler(d, erasure)["writes"]
                       if row.get("role") == "RELEASE_FAILED_ERASURE_LEASE")["assignments"].__setitem__(
                           "tombstone_digest", "HOSTILE"))
    add("G04-response-status-mutable", "G04", "LISTENING.HANDLER_TRANSACTION", erasure,
        lambda d: handler(d, erasure).__setitem__("responseMutableStatusForbidden", ["WITHDRAWN"]))
    add("G04-add-public-outbox", "G04", "LISTENING.HANDLER_TRANSACTION", erasure,
        lambda d: handler(d, erasure)["writes"].append(
            {"phase": "TX2_FAILURE", "action": "APPEND", "table": "sys_hris_listening_protected_outbox", "role": "HOSTILE_OUTBOX"}))
    add("G04-destroy-wrong-key", "G04", "LISTENING.HANDLER_TRANSACTION", erasure,
        lambda d: handler(d, erasure)["nonSqlOwnerActions"][0].__setitem__("selector", "latest key"))

    # G05: exact signed simulation result tuple, replay and FORBIDDEN refetch.
    wfp = "internal.workforceplan.simulation-result.consume"
    add("G05-unsigned-result", "G05", "WFP.SIMULATION_SIGNED_RESULT", wfp,
        lambda d: handler(d, wfp)["trigger"].pop("signature"))
    add("G05-wrong-request-identity", "G05", "WFP.SIMULATION_SIGNED_RESULT", wfp,
        lambda d: handler(d, wfp)["trigger"].__setitem__("requestPublicId", "ownerResult.latestRequest"))
    add("G05-incomplete-result-tuple", "G05", "WFP.SIMULATION_TERMINAL_CAS", wfp,
        lambda d: next(row for row in handler(d, wfp)["writes"]
                       if row.get("table") == "ppl_wfp_simulation_requests")["assignments"].pop("result_digest"))
    add("G05-latest-refetch", "G05", "WFP.SIMULATION_SIGNED_RESULT", wfp,
        lambda d: handler(d, wfp)["event"]["refetchContract"].__setitem__("latestFallback", "ALLOWED"))
    add("G05-outbox-before-close", "G05", "WFP.SIMULATION_SIGNED_RESULT", wfp,
        lambda d: handler(d, wfp)["orderedDml"].__setitem__(3, "APPEND_OUTBOX early"))

    # G06: closed event-condition grammar.
    add("G06-undeclared-post-state", "G06", "EVENT.CONDITION", "WorkforceScenarioSimulated.v2",
        lambda d: event_owner(d, "WorkforceScenarioSimulated.v2")[1].__setitem__("condition", "POST_STATE=UNKNOWN"))
    add("G06-signed-status-without-cas", "G06", "EVENT.CONDITION", "EmployeeListeningSurveyPublished.v3",
        lambda d: event_owner(d, "EmployeeListeningSurveyPublished.v3")[1].__setitem__("condition", "signedMessage.status=SUCCESS"))
    add("G06-zero-row-root-cas", "G06", "EVENT.CONDITION", "EmployeeListeningSurveyClosed.v3",
        lambda d: next(row for row in event_owner(d, "EmployeeListeningSurveyClosed.v3")[0]["writes"]
                       if row.get("role") == "CONFIGURATION_SAGA_FINAL_ROOT_CAS").__setitem__("expectedRows", "ZERO_OR_ONE"))
    add("G06-freeform-event-name-state", "G06", "EVENT.CONDITION", "WorkforceScenarioSimulationFailed.v2",
        lambda d: event_owner(d, "WorkforceScenarioSimulationFailed.v2")[1].__setitem__(
            "condition", "WorkforceScenarioSimulationFailed.v2"))

    # G07: dual append-only temporal revisions never accept/persist effectiveTo.
    temporal_op = "modern.contingent.engagement.revise"
    temporal_table = "ppl_cwk_engagement_versions"
    temporal_query = "modern.contingent.engagement.query"
    add("G07-client-effective-to", "G07", "EFFECTIVE.CLIENT_EFFECTIVE_TO_FORBIDDEN", temporal_op,
        lambda d: operation(d, temporal_op)["requestFields"].append(
            {"source": "body.effectiveTo", "name": "effectiveTo", "location": "body", "required": False}))
    add("G07-persist-effective-to", "G07", "EFFECTIVE.APPEND", temporal_op,
        lambda d: next(row for row in operation(d, temporal_op)["orderedDml"]
                       if row.get("table") == temporal_table)["assignments"].__setitem__("effective_to", "body.effectiveTo"))
    add("G07-prior-history-update", "G07", "EFFECTIVE.APPEND", temporal_op,
        lambda d: operation(d, temporal_op)["orderedDml"].append(
            {"action": "UPDATE", "table": temporal_table, "role": "HOSTILE_PRIOR_HISTORY_MUTATION", "assignments": {}}))
    add("G07-exact-history-latest-fallback", "G07", "EFFECTIVE.QUERY_RESOLUTION", temporal_query,
        lambda d: operation(d, temporal_query)["readPlan"]["temporalResolution"].__setitem__(
            "exactHistorySelector", "query.revisionPublicId OR latest"))

    # G08: protected submit has no unsigned duplicate envelope or broker delivery.
    submit = "modern.listening.response.submit"
    add("G08-unsigned-admission-version", "G08", "LISTENING.SUBMIT_REQUEST_CLOSED", submit,
        lambda d: operation(d, submit)["requestFields"].append(
            {"source": "body.admissionVersion", "name": "admissionVersion", "location": "body", "required": True}))
    add("G08-route-credential-mismatch", "G08", "LISTENING.SUBMIT_ADMISSION", submit,
        lambda d: next(row for row in operation(d, submit)["selectors"]
                       if row.get("selectorType") == "PROTECTED_LOCAL_LATEST_STABLE_ADMISSION_FENCE").__setitem__(
                           "causalJoin", "credential admission only"))
    add("G08-add-worker-identity", "G08", "LISTENING.SUBMIT_REQUEST_CLOSED", submit,
        lambda d: operation(d, submit)["requestFields"].append(
            {"source": "body.workerId", "name": "workerId", "location": "body", "required": False}))
    add("G08-add-broker-outbox", "G08", "LISTENING.SUBMIT_PRIVATE_DELIVERY", submit,
        lambda d: operation(d, submit)["orderedDml"].append(
            {"step": 8, "action": "APPEND", "table": "sys_hris_listening_protected_outbox", "role": "HOSTILE_OUTBOX"}))

    # G09: exactly one approved arbitration qualifier and exact physical column/target.
    lineage_op = "modern.recruiting.requisition.query"
    lineage_table = "ppl_rec_requisition_versions"
    def direct_row(d: dict[str, dict[str, Any]]) -> dict[str, Any]:
        return next(row for row in lineage(d, lineage_op)["responseFieldSources"]
                    if str(row.get("sourcePath", "")).startswith("CONTENT_WINNER:"))
    add("G09-unknown-qualifier", "G09", "EXPANDED_QUERY.FIELD_LINEAGE", lineage_op,
        lambda d: direct_row(d).__setitem__("sourcePath", direct_row(d)["sourcePath"].replace("CONTENT_WINNER:", "LATEST:")))
    add("G09-nested-qualifier", "G09", "EXPANDED_QUERY.FIELD_LINEAGE", lineage_op,
        lambda d: direct_row(d).__setitem__("sourcePath", "STATE_WINNER:" + direct_row(d)["sourcePath"]))
    add("G09-wrong-physical-column", "G09", "EXPANDED_QUERY.FIELD_LINEAGE", lineage_op,
        lambda d: direct_row(d).__setitem__("sourcePath", f"CONTENT_WINNER:{lineage_table}.does_not_exist"))
    add("G09-missing-response-target", "G09", "EXPANDED_QUERY.FIELD_LINEAGE", lineage_op,
        lambda d: direct_row(d).__setitem__("target", "modern.recruiting.requisition.query.Response.v3.item.hostileMissing"))
    add("G09-fewer-than-two-direct-sources", "G09", "EXPANDED_QUERY.FIELD_LINEAGE", lineage_op,
        lambda d: lineage(d, lineage_op).__setitem__(
            "responseFieldSources",
            [row for row in lineage(d, lineage_op)["responseFieldSources"]
             if lineage_table not in str(row.get("sourcePath", ""))][:]
            + [copy.deepcopy(direct_row(d))],
        ))
    add("G09-conflate-state-content-winner", "G09", "EXPANDED_QUERY.FIELD_LINEAGE", lineage_op,
        lambda d: direct_row(d)["selectionModeSources"].__setitem__(
            "STATE_HISTORY", direct_row(d)["selectionModeSources"]["UNQUALIFIED"]))
    add("G09-latest-selection-fallback", "G09", "EXPANDED_QUERY.FIELD_LINEAGE", lineage_op,
        lambda d: direct_row(d)["selectionModeSources"].__setitem__(
            "CONTENT_HISTORY", f"LATEST:{lineage_table}.requisition_code"))

    # G11: sealed readConsumer set and executable read/projection/direct lineage agree.
    life_table = "ppl_bnf_life_event_decisions"
    life_query = "modern.benefits.lifeevents.query"
    add("G11-undeclared-extra-reader", "G11", "EXPANDED_QUERY.READER_SET", life_table,
        lambda d: (operation(d, "modern.benefits.plans.query")["readPlan"]["tables"].append(life_table),
                   operation(d, "modern.benefits.plans.query")["readPlan"]["projectionTuple"]["physicalSources"].append(life_table)))
    add("G11-declared-reader-missing-physical-source", "G11", "EXPANDED_QUERY.READ_PLAN", life_query,
        lambda d: operation(d, life_query)["readPlan"]["projectionTuple"].__setitem__(
            "physicalSources", [x for x in operation(d, life_query)["readPlan"]["projectionTuple"]["physicalSources"] if x != life_table]))
    add("G11-reader-missing-direct-lineage", "G11", "EXPANDED_QUERY.FIELD_LINEAGE", life_query,
        lambda d: remove_lineage_for_table(lineage(d, life_query)["responseFieldSources"], life_table))

    # G12: system-time filter precedes distinct state/content arbitration.
    query = "modern.recruiting.requisition.query"
    add("G12-remove-system-asof-input", "G12", "EFFECTIVE.QUERY_RESOLUTION", query,
        lambda d: operation(d, query).__setitem__(
            "requestFields", [row for row in operation(d, query)["requestFields"] if row.get("source") != "queryParameters.systemAsOf"]))
    add("G12-filter-after-winner", "G12", "EFFECTIVE.QUERY_RESOLUTION", query,
        lambda d: operation(d, query)["readPlan"]["temporalResolution"].__setitem__(
            "systemAsOfRule", "FILTER_created_at<=query.systemAsOf_AFTER_WINNER"))
    add("G12-conflate-winners", "G12", "EFFECTIVE.QUERY_RESOLUTION", query,
        lambda d: operation(d, query)["readPlan"]["temporalResolution"].__setitem__(
            "stateWinner", operation(d, query)["readPlan"]["temporalResolution"]["businessAsOfWinner"]))
    add("G12-latest-fallback", "G12", "EFFECTIVE.QUERY_RESOLUTION", query,
        lambda d: operation(d, query)["readPlan"]["temporalResolution"].__setitem__(
            "exactHistorySelector", "query.revisionPublicId OR query.rootVersion; fallback latest"))
    add("G12-persisted-effective-to-authoritative", "G12", "EFFECTIVE.QUERY_RESOLUTION", query,
        lambda d: operation(d, query)["readPlan"]["temporalResolution"].__setitem__(
            "persistedEffectiveTo", "AUTHORITATIVE"))

    tests.extend([
        authority_probe(
            module, docs, audit, hashes_before, paths,
            test_id="v5-policy-bytes-seal-drift", target=module.EXPANSION_POLICY_PATH,
            rule_ids={"SOURCE.EXPANSION_POLICY_FILE", "SOURCE.EXPANSION_POLICY_SEAL"},
        ),
        authority_probe(
            module, docs, audit, hashes_before, paths,
            test_id="v4-predecessor-bytes-seal-drift", target=module.PREDECESSOR_POLICY_PATH,
            rule_ids={"SOURCE.EXPANSION_POLICY_PREDECESSOR_FILE", "SOURCE.EXPANSION_POLICY_PREDECESSOR_SEAL"},
        ),
        authority_probe(
            module, docs, audit, hashes_before, paths,
            test_id="triage-authority-bytes-seal-drift", target=module.TRIAGE_AUTHORITY_PATH,
            rule_ids={"SOURCE.EXPANSION_POLICY_TRIAGE_FILE", "SOURCE.EXPANSION_POLICY_TRIAGE_SEAL"},
        ),
    ])

    hashes_after = {role: module.sha256_file(Path(path)) for role, path in paths.items()}
    unchanged = hashes_before == hashes_after
    baseline_clear = not baseline
    all_pass = baseline_clear and unchanged and all(row["status"] == "PASS" for row in tests)
    report = {
        "reportId": "DWP-HRIS-GLOBAL-HCM-V5-VALIDATOR-HOSTILE-AUDIT-V1",
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "authorityBoundary": "INDEPENDENT_VALIDATOR_REVIEW_NOT_G3_AUTHORITY",
        "validator": {"path": str(VALIDATOR_PATH.resolve()), "sha256": module.sha256_file(VALIDATOR_PATH)},
        "policy": {
            "path": str(module.EXPANSION_POLICY_PATH.resolve()),
            "sha256": module.sha256_file(module.EXPANSION_POLICY_PATH),
            "sealedPayloadSha256": module.load_json(module.EXPANSION_POLICY_PATH).get("sealedPayloadSha256"),
        },
        "candidateSubstrate": {
            "directory": str(candidate_dir),
            "role": "IMMUTABLE_MUTATION_SUBSTRATE_NOT_GATE_AUTHORITY",
            "sources": {
                role: {"path": paths[role], "sha256Before": hashes_before[role], "sha256After": hashes_after[role]}
                for role in sorted(paths)
            },
        },
        "positiveControlFindingCount": len(baseline),
        "tests": tests,
        "summary": {
            "status": "PASS_HOSTILE_VALIDATOR_AUDIT" if all_pass else "FAIL_HOSTILE_VALIDATOR_AUDIT",
            "testCount": len(tests),
            "passed": sum(row["status"] == "PASS" for row in tests),
            "failed": sum(row["status"] != "PASS" for row in tests),
            "candidateBytesUnchanged": unchanged,
            "positiveControlClear": baseline_clear,
            "coveredGroups": sorted({row["groupId"] for row in tests}),
            "ownerBoundaryGroups": "G13_G14_COVERED_BY_AUDIT_MODERN_132_OWNER_STREAM_BOUNDARIES_V5_SELF_TESTS",
            "notGateAuthority": True,
        },
    }
    report["sealedPayloadSha256"] = module.sha256_bytes(canonical_json(report))
    if not args.check:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, sort_keys=True))
    return 0 if all_pass else 1


if __name__ == "__main__":
    raise SystemExit(main())
