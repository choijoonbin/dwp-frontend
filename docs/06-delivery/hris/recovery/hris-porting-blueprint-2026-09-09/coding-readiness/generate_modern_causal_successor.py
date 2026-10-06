#!/usr/bin/env python3
"""Project the reviewed modern causal successor into module and final SSOTs."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from pathlib import Path

from modern_causal_successor import (
    apply_exact_source_successor,
    apply_module_successor,
    build_causal_contract,
)

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
EXACT = HERE / "modern-capability-exact-schema-contracts.v1.json"
EVENTS = HERE / "modern-capability-event-payload-contracts.v1.json"
CAUSAL = HERE / "modern-capability-causal-state-contracts.v2.json"
LISTENING_SUMMARY = HERE / "sys-listening-stream-authority-successor.v1.json"
LISTENING_SUMMARY_ID = "dwp.hris.sys.listening.stream-authority-successor.v1"
SUMMARY = HERE / "modern-capability-coding-contract-register.csv"
MODULES = (
    ROOT / "session-evidence/hrm/g3-modern-capability-contracts.v1.json",
    ROOT / "session-evidence/per/g3-modern-capability-contracts.v2.json",
    ROOT / "session-evidence/tim/g3-modern-capability-contracts.v1.json",
    ROOT / "session-evidence/sys/g3-modern-capability-contracts.v1.json",
)

# Candidate-owned migration inventory.  The independent reviewer has a
# separately authored oracle and validator; this generator never imports it.
# These are the legacy INSERT/APPEND paths for which the successor must make an
# explicit COMMITTED or FORBIDDEN product decision.
LEGACY_INSERT_APPEND_EDGES = (
    "modern.recruiting.requisition.create|INSERT|ppl_rec_requisitions",
    "modern.recruiting.offer.issue|INSERT|ppl_rec_offers",
    "modern.recruiting.hire.record|APPEND|ppl_rec_hire_handoff_receipts",
    "modern.onboarding.template.create|INSERT|ppl_jny_templates",
    "modern.onboarding.journey.assign|INSERT|ppl_jny_assignments",
    "modern.onboarding.task.complete|APPEND|ppl_jny_task_evidence",
    "modern.workforceplan.scenario.create|INSERT|ppl_wfp_scenarios",
    "modern.workforceplan.scenario.create|INSERT|ppl_wfp_scenario_revisions",
    "modern.workforceplan.scenario.simulate|APPEND|ppl_wfp_scenario_revisions",
    "modern.workforceplan.scenario.submit|APPEND|ppl_wfp_scenario_revisions",
    "modern.workforceplan.scenario.approve|APPEND|ppl_wfp_scenario_revisions",
    "modern.workforceplan.scenario.publish|APPEND|ppl_wfp_publish_receipts",
    "modern.workforceplan.scenario.publish|APPEND|ppl_wfp_scenario_revisions",
    "modern.benefits.plan.create|INSERT|ppl_bnf_plans",
    "modern.benefits.enrollment.submit|INSERT|ppl_bnf_enrollments",
    "modern.benefits.lifeevent.submit|INSERT|ppl_bnf_life_events",
    "modern.hrservice.case.create|INSERT|ppl_hrs_cases",
    "modern.hrservice.case.create|INSERT|ppl_hrs_case_actions",
    "modern.hrservice.case.triage|APPEND|ppl_hrs_case_actions",
    "modern.hrservice.case.assign|APPEND|ppl_hrs_case_actions",
    "modern.hrservice.case.respond|APPEND|ppl_hrs_case_actions",
    "modern.hrservice.case.resolve|APPEND|ppl_hrs_case_actions",
    "modern.contingent.engagement.create|INSERT|ppl_cwk_engagements",
    "modern.skills.taxonomy.create|INSERT|prf_skl_taxonomies",
    "modern.skills.taxonomy.create|INSERT|prf_skl_taxonomy_versions",
    "modern.growth.profile.create|INSERT|prf_grw_profiles",
    "modern.growth.profile.create|INSERT|prf_grw_aspirations",
    "modern.growth.evidence.link|APPEND|prf_grw_evidence_links",
    "modern.learning.offering.create|INSERT|prf_lrn_offerings",
    "modern.learning.offering.create|INSERT|prf_lrn_assignments",
    "modern.learning.self.enroll|INSERT|prf_lrn_assignments",
    "modern.opportunity.create|INSERT|prf_mkt_opportunities",
    "modern.opportunity.create|INSERT|prf_mkt_applications",
    "modern.opportunity.apply|INSERT|prf_mkt_applications",
    "modern.opportunity.shortlist|APPEND|prf_mkt_match_explanations",
    "modern.succession.plan.create|INSERT|prf_suc_plans",
    "modern.succession.nomination.add|APPEND|prf_suc_nominations",
    "modern.compplan.cycle.create|INSERT|prf_cmp_cycles",
    "modern.compplan.budget.allocate|APPEND|prf_cmp_budget_ledger",
    "modern.compplan.snapshot.publish|APPEND|prf_cmp_approved_snapshots",
    "modern.compplan.snapshot.publish|APPEND|prf_cmp_approved_snapshot_lines",
    "modern.wfm.forecast.create|INSERT|tme_wfm_demand_forecasts",
    "modern.wfm.schedule.optimize|INSERT|tme_wfm_schedule_candidates",
    "modern.wfm.schedule.optimize|APPEND|tme_wfm_constraint_evaluation_receipts",
    "modern.wfm.schedule.optimize|APPEND|tme_wfm_schedule_publish_ledger",
    "modern.wfm.schedule.validate|APPEND|tme_wfm_constraint_evaluation_receipts",
    "modern.wfm.schedule.submit|APPEND|tme_wfm_constraint_evaluation_receipts",
    "modern.wfm.schedule.publish|APPEND|tme_wfm_schedule_publish_ledger",
    "modern.listening.response.submit|INSERT|sys_hris_listening_responses",
    "modern.listening.survey.create|INSERT|sys_hris_listening_surveys",
    "modern.listening.action.create|APPEND|sys_hris_listening_actions",
    "modern.analytics.metric.create|INSERT|sys_hris_metric_definitions",
    "modern.analytics.metric.create|INSERT|sys_hris_metric_versions",
    "modern.analytics.metric.create|INSERT|sys_hris_metric_projections",
    "modern.analytics.export.create|APPEND|sys_hris_analytics_export_receipts",
    "modern.ai.assist.create|INSERT|sys_hris_ai_provenance_receipts",
    "modern.ai.policy.create|INSERT|sys_hris_ai_use_policies",
    "modern.ai.policy.create|INSERT|sys_hris_ai_policy_versions",
)

FORBIDDEN_LEGACY_EDGES = {
    "modern.recruiting.hire.record|APPEND|ppl_rec_hire_handoff_receipts":
        "PREMATURE_HRM_OWNER_ACK_SIDE_EFFECT_MOVED_TO_INTERNAL_HANDLER",
    "modern.learning.offering.create|INSERT|prf_lrn_assignments":
        "OFFERING_CREATE_MUST_NOT_IMPLICITLY_ENROLL_A_WORKER",
    "modern.opportunity.create|INSERT|prf_mkt_applications":
        "OPPORTUNITY_CREATE_MUST_NOT_IMPLICITLY_APPLY_A_WORKER",
    "modern.wfm.schedule.optimize|APPEND|tme_wfm_schedule_publish_ledger":
        "OPTIMIZATION_MUST_NOT_IMPLICITLY_PUBLISH_A_SCHEDULE",
    "modern.wfm.schedule.submit|APPEND|tme_wfm_constraint_evaluation_receipts":
        "SUBMISSION_MUST_REUSE_AN_EXACT_PASSING_EVALUATION_RECEIPT_AND_MUST_NOT_FORGE_A_NEW_RESULT",
}


def render(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2) + "\n"


def sealed(value: dict) -> dict:
    # Normalize authored tuples and other JSON-compatible containers before
    # both sealing and equality checks.  Otherwise a freshly written artifact
    # (arrays after JSON decoding) can never equal the in-memory tuple form.
    result = json.loads(json.dumps(value, ensure_ascii=False))
    body = json.dumps(result, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    result["sealedPayloadSha256"] = hashlib.sha256(body).hexdigest()
    return result


def augment_candidate_evidence(causal: dict, exact: dict, events: dict) -> dict:
    # This causal-state artifact is downstream of the canonical five.  It may
    # consume their derived Listening summary, but no canonical input may ever
    # point back to this summary or use it to generate canonical rows.
    listening_summary = json.loads(LISTENING_SUMMARY.read_text(encoding="utf-8"))
    listening_body = {
        key: value for key, value in listening_summary.items()
        if key != "sealedPayloadSha256"
    }
    listening_seal = hashlib.sha256(json.dumps(
        listening_body, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode()).hexdigest()
    if (
        listening_summary.get("contractId") != LISTENING_SUMMARY_ID
        or listening_summary.get("status")
        != "CANONICAL_G3_START_AUTHORITY_NOT_IMPLEMENTED"
        or listening_summary.get("sealedPayloadSha256") != listening_seal
        or listening_summary.get("canonicalPrecedence", {}).get("mode")
        != "CANONICAL_FIVE_PRIMARY_DERIVED_SUMMARY_ONLY"
    ):
        raise ValueError("derived Listening summary is missing, stale, or unsealed")
    listening_reference = {
        "contractId": LISTENING_SUMMARY_ID,
        "path": LISTENING_SUMMARY.name,
        "fileSha256": hashlib.sha256(LISTENING_SUMMARY.read_bytes()).hexdigest(),
        "sealedPayloadSha256": listening_seal,
        "canonicalInputSetSha256": listening_summary["canonicalPrecedence"]
        ["generatedSummary"]["canonicalInputSetSha256"],
        "capabilityId": "HRIS.MODERN.EMPLOYEE_LISTENING",
        "authorityMode": "DERIVED_SUMMARY_OF_CANONICAL_FIVE",
        "canonicalRowsRole": "PRIMARY_ACTIVE_IMPLEMENTATION_AUTHORITY",
    }
    causal["canonicalDerivedSummaries"] = {
        "sysListeningStreamSummary": listening_reference,
    }
    for operation in causal.get("operations", []):
        if operation.get("operationId", "").startswith("modern.listening."):
            operation["derivedSummaryVerification"] = listening_reference.copy()
    write_sets = {
        row["operationId"]: {item["table"]: item["disposition"] for item in row["writeSet"]}
        for row in exact["operationFieldLineage"]
    }
    handler_write_sets = {
        handler["handlerId"]: handler.get("writeDispositions", {})
        for handler in exact.get("internalConsumerHandlers", [])
    }
    moved_to_handler = {
        ("modern.wfm.schedule.optimize", "tme_wfm_schedule_candidates"):
            "internal.wfm.schedule-optimization.complete",
        ("modern.wfm.schedule.optimize", "tme_wfm_constraint_evaluation_receipts"):
            "internal.wfm.schedule-optimization.complete",
    }
    decisions = []
    for edge in LEGACY_INSERT_APPEND_EDGES:
        operation_id, old_disposition, table = edge.split("|")
        current = write_sets.get(operation_id, {}).get(table)
        if edge in FORBIDDEN_LEGACY_EDGES:
            if current is not None:
                raise ValueError(f"forbidden legacy side effect returned: {edge} as {current}")
            decisions.append({"legacyEdge": edge, "decision": "FORBIDDEN",
                              "reason": FORBIDDEN_LEGACY_EDGES[edge],
                              "successorDisposition": None})
        else:
            handler_id = moved_to_handler.get((operation_id, table))
            if handler_id:
                handler_disposition = handler_write_sets.get(handler_id, {}).get(table)
                if current is not None or handler_disposition != old_disposition:
                    raise ValueError(
                        f"legacy async result edge is not isolated in owner handler: {edge} "
                        f"public={current} handler={handler_disposition}"
                    )
                decisions.append({"legacyEdge": edge, "decision": "COMMITTED_BY_OWNER_HANDLER",
                                  "successorDisposition": handler_disposition,
                                  "successorOwner": handler_id})
            else:
                disposition_compatible = (
                    current == old_disposition
                    or (old_disposition == "APPEND" and current == "APPEND_MANY")
                )
                if not disposition_compatible:
                    raise ValueError(f"required legacy edge not committed exactly: {edge} got {current}")
                decisions.append({"legacyEdge": edge, "decision": "COMMITTED",
                                  "successorDisposition": current, "successorOwner": operation_id})
    causal["candidateAuditResponse"] = {
        "baselineAuditReference": {
            "path": "reports/modern-causal-semantic-independent-audit-2026-09-15.json",
            "sha256": "6055df71de1a4ed4186c36c20903a3abdb3a6a17dae95d8296d70245e05b22cf",
            "role": "HISTORICAL_FINDING_REFERENCE_ONLY_NOT_IMPORTED_AS_GENERATOR_AUTHORITY",
        },
        "legacyInsertAppendEdgeDecisions": decisions,
        "counts": {"legacyEdges": len(decisions),
                   "committed": sum(row["decision"].startswith("COMMITTED") for row in decisions),
                   "forbidden": sum(row["decision"] == "FORBIDDEN" for row in decisions)},
    }
    causal["canonicalSourcePins"] = {
        EXACT.name: hashlib.sha256((json.dumps(exact, ensure_ascii=False, indent=2) + "\n").encode()).hexdigest(),
        EVENTS.name: hashlib.sha256((json.dumps(events, ensure_ascii=False, indent=2) + "\n").encode()).hexdigest(),
        "modern-capability-semantic-bindings.v1.json": hashlib.sha256(
            (HERE / "modern-capability-semantic-bindings.v1.json").read_bytes()).hexdigest(),
        "modern-capability-public-identity-registry.v1.json": hashlib.sha256(
            (HERE / "modern-capability-public-identity-registry.v1.json").read_bytes()).hexdigest(),
        LISTENING_SUMMARY.name: hashlib.sha256(LISTENING_SUMMARY.read_bytes()).hexdigest(),
    }
    return causal


def project_modules(exact: dict, events: dict) -> dict[Path, dict]:
    exact = json.loads(render(exact))
    events = json.loads(render(events))
    apply_exact_source_successor(exact, events)
    exact["_causalEventSchemas"] = events["eventPayloadSchemas"]
    results: dict[Path, dict] = {}
    for path in MODULES:
        module = json.loads(path.read_text(encoding="utf-8"))
        apply_module_successor(module, exact)
        # Normalize authored tuples (for example reviewed handler fact maps)
        # through the wire representation so --write followed by --check is
        # byte/semantic idempotent rather than Python-container sensitive.
        results[path] = json.loads(render(module))
    return results


def project_summary(modules: dict[Path, dict]) -> str:
    with SUMMARY.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        names = list(reader.fieldnames or [])
        rows = list(reader)
    by_capability = {
        capability["capabilityId"]: capability
        for module in modules.values()
        for capability in module["capabilities"]
    }
    for row in rows:
        capability = by_capability[row["capability_id"]]
        row["event_count"] = str(len(capability["events"]))
        if row["capability_id"] == "HRIS.MODERN.EMPLOYEE_LISTENING":
            # The checked-in module body remains immutable predecessor evidence.
            # Active coding counts are resolved only through the four-stream
            # successor authority and must never be projected back to V287.
            row["state_transition_count"] = "0"
            row["physical_table_count"] = "24"
        else:
            row["state_transition_count"] = str(
                sum(len(machine["transitions"]) for machine in capability["stateMachines"])
            )
            row["physical_table_count"] = str(len(capability["tables"]))
    from io import StringIO
    buffer = StringIO(newline="")
    writer = csv.DictWriter(buffer, fieldnames=names, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return buffer.getvalue()


def main() -> int:
    # Compatibility entry point: the source-derived 199-operation successor is
    # the only active causal/module projection.  The bootstrap functions above
    # remain readable predecessor implementation history, but must never
    # regenerate active artifacts or reintroduce fixed 100/81 target counts.
    import generate_modern_causal_module_successor as canonical

    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--write-modules", action="store_true")
    group.add_argument("--write-causal", action="store_true")
    group.add_argument("--check", action="store_true")
    args = parser.parse_args()
    ssot, exact, events, semantic, identities, manifest = canonical.compose_inputs()
    causal = canonical.build_causal(
        ssot, exact, events, semantic, identities, manifest
    )
    modules = canonical.project_modules(ssot, exact, events)
    summary = canonical.project_summary(modules)
    canonical.validate(causal, modules, manifest)

    if args.write_modules:
        for path, value in modules.items():
            path.write_text(render(value), encoding="utf-8")
        SUMMARY.write_text(summary, encoding="utf-8")
        print(
            "MODERN_CAUSAL_MODULE_PROJECTION=PASS"
            f" modules={len(modules)} events={len(events['eventPayloadSchemas'])}"
            f" commands={manifest['scope']['commands']}"
        )
        return 0

    if args.write_causal:
        CAUSAL.write_text(render(causal), encoding="utf-8")
        print(
            "MODERN_CAUSAL_CONTRACT_GENERATE=PASS"
            f" operations={manifest['scope']['operations']}"
            f" commands={manifest['scope']['commands']}"
            f" events={len(events['eventPayloadSchemas'])}"
        )
        return 0

    mismatches = [str(path) for path, value in modules.items()
                  if path.read_text(encoding="utf-8") != render(value)]
    if SUMMARY.read_text(encoding="utf-8") != summary:
        mismatches.append(str(SUMMARY))
    if not CAUSAL.is_file() or CAUSAL.read_text(encoding="utf-8") != render(causal):
        mismatches.append(str(CAUSAL))
    print("MODERN_CAUSAL_GENERATOR_CHECK=" + ("PASS" if not mismatches else "FAIL")
          + f" operations={manifest['scope']['operations']}"
          + f" commands={manifest['scope']['commands']}"
          + f" events={len(events['eventPayloadSchemas'])} mismatches={len(mismatches)}")
    if mismatches:
        for path in mismatches:
            print(" - " + path)
    return 0 if not mismatches else 1


if __name__ == "__main__":
    import pathlib as _guard_pathlib
    import sys as _guard_sys

    _guard_dir = _guard_pathlib.Path(__file__).resolve().parent
    while not (_guard_dir / "modern_successor_reader_guard.py").is_file():
        if _guard_dir.parent == _guard_dir:
            raise SystemExit("modern successor reader guard is unavailable")
        _guard_dir = _guard_dir.parent
    _guard_sys.path.insert(0, str(_guard_dir))
    from modern_successor_reader_guard import guarded_main as _guarded_main

    raise SystemExit(_guarded_main(__file__, main))
