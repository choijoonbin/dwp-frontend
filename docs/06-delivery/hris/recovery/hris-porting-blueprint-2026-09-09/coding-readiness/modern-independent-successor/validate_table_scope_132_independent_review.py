#!/usr/bin/env python3
"""Independent, read-only check of the proposed 115 -> 132 HRIS table scope.

This checker intentionally does not import an author generator.  It proves the
frozen 115-table set and the proposed exact-17 identity/owner/producer claims,
then applies the reviewer corrections recorded in the companion report.
It is not a G3 authority.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
from pathlib import Path


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
POLICY = HERE / "global-hcm-table-expansion-acceptance-policy.v3.json"
BASELINE = ROOT / "coding-readiness/modern-capability-exact-schema-contracts.v1.json"
POLICY_SHA = "02fe8f0e5aebf06bc2c8b3cbe09f0947138310f6c921056c8be2f43d222cbd57"
BASELINE_FILE_SHA = "7ad31205819832a3100730364d7b79e4c7c8b1c4244fc36aa0c6946252071730"
BASELINE_SET_SHA = "7a8805795efade4334baa3a6f91d6180b1a0bb4ecec118688e25e86cebd2f2cd"

EXPECTED = {
    "ppl_rec_offer_decisions": ("HRIS-HRM", {"modern.recruiting.offer.respond"}),
    "ppl_rec_requisition_versions": ("HRIS-HRM", {"modern.recruiting.requisition.create", "modern.recruiting.requisition.revise"}),
    "ppl_jny_template_task_definitions": ("HRIS-HRM", {"modern.onboarding.template.create", "modern.onboarding.template.revise"}),
    "ppl_wfp_simulation_requests": ("HRIS-HRM", {"modern.workforceplan.scenario.simulate", "internal.workforceplan.simulation-result.consume", "modern.workforceplan.scenario.cancel"}),
    "ppl_bnf_enrollment_eligibility_receipts": ("HRIS-HRM", {"modern.benefits.enrollment.submit"}),
    "ppl_bnf_dependent_elections": ("HRIS-HRM", {"modern.benefits.enrollment.submit"}),
    "ppl_bnf_life_event_decisions": ("HRIS-HRM", {"modern.benefits.lifeevent.decide"}),
    "ppl_cwk_access_receipts": ("HRIS-HRM", {"internal.contingent.access-grant-result.consume", "internal.contingent.access-revoke-result.consume"}),
    "ppl_cwk_engagement_versions": ("HRIS-HRM", {"modern.contingent.engagement.create", "modern.contingent.engagement.revise"}),
    "prf_lrn_offering_versions": ("HRIS-PER", {"modern.learning.offering.create", "modern.learning.offering.revise"}),
    "prf_lrn_capacity_ledger": ("HRIS-PER", {"modern.learning.assignment.cancel", "modern.learning.assignment.create", "modern.learning.self.enroll"}),
    "prf_mkt_opportunity_versions": ("HRIS-PER", {"modern.opportunity.create", "modern.opportunity.revise"}),
    "prf_suc_plan_versions": ("HRIS-PER", {"modern.succession.plan.create", "modern.succession.plan.revise"}),
    "prf_cmp_proposal_versions": ("HRIS-PER", {"modern.compplan.proposal.upsert"}),
    "prf_cmp_plan_proposal_refs": ("HRIS-PER", {"modern.compplan.plan.approve"}),
    "tme_wfm_approval_receipts": ("HRIS-TIM", {"internal.wfm.approval-result.consume"}),
    "sys_hris_ai_assistance_reviews": ("HRIS-SYS", {"modern.ai.assist.review", "modern.ai.assist.revoke"}),
}

EXPECTED_READ_CONSUMERS = {
    "ppl_rec_offer_decisions": {"modern.recruiting.candidate.query"},
    "ppl_rec_requisition_versions": {"modern.recruiting.requisition.query"},
    "ppl_jny_template_task_definitions": {"modern.onboarding.template.query", "modern.onboarding.assignment.query"},
    "ppl_wfp_simulation_requests": {"modern.workforceplan.scenario.query", "modern.workforceplan.scenarios.query"},
    "ppl_bnf_enrollment_eligibility_receipts": {"modern.benefits.enrollment.query", "modern.benefits.enrollments.query"},
    "ppl_bnf_dependent_elections": {"modern.benefits.enrollment.query", "modern.benefits.enrollments.query"},
    "ppl_bnf_life_event_decisions": {"modern.benefits.lifeevent.query"},
    "ppl_cwk_access_receipts": {"modern.contingent.engagement.query"},
    "ppl_cwk_engagement_versions": {"modern.contingent.engagement.query", "modern.contingent.engagements.query"},
    "prf_lrn_offering_versions": {"modern.learning.offering.query", "modern.learning.catalog.query"},
    "prf_lrn_capacity_ledger": {"modern.learning.assignment.query", "modern.learning.assignments.query"},
    "prf_mkt_opportunity_versions": {"modern.opportunity.query", "modern.opportunity.catalog.query"},
    "prf_suc_plan_versions": {"modern.succession.plan.query", "modern.succession.plans.query"},
    "prf_cmp_proposal_versions": {"modern.compplan.proposal.query", "modern.compplan.proposals.query"},
    "prf_cmp_plan_proposal_refs": {"modern.compplan.cycle.query", "modern.compplan.proposal.query"},
    "tme_wfm_approval_receipts": {"modern.wfm.candidate.query", "modern.wfm.candidates.query"},
    "sys_hris_ai_assistance_reviews": {"modern.ai.assistance.query", "modern.ai.assistances.query"},
}


def canonical(value: object) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def sealed_payload(doc: dict) -> str:
    return hashlib.sha256(canonical({k: v for k, v in doc.items() if k != "sealedPayloadSha256"})).hexdigest()


def evaluate(policy: dict, baseline: dict, check_file_pins: bool = True) -> list[dict]:
    issues: list[dict] = []
    def fail(code: str, message: str, evidence: object) -> None:
        issues.append({"id": code, "message": message, "evidence": evidence})

    if check_file_pins and sha(POLICY) != POLICY_SHA:
        fail("TS132-PIN-001", "policy v2 bytes changed", sha(POLICY))
    if check_file_pins and sha(BASELINE) != BASELINE_FILE_SHA:
        fail("TS132-PIN-002", "frozen 115 exact-schema bytes changed", sha(BASELINE))
    if sealed_payload(policy) != policy.get("sealedPayloadSha256"):
        fail("TS132-SEAL-001", "policy sealed payload digest is invalid", sealed_payload(policy))

    base_names = sorted(t["tableName"] for t in baseline.get("tableSpecifications", []))
    base_set_sha = hashlib.sha256(canonical(base_names)).hexdigest()
    if len(base_names) != 115 or len(set(base_names)) != 115 or base_set_sha != BASELINE_SET_SHA:
        fail("TS132-BASE-001", "baseline is not the frozen unique 115-table set", {"count": len(base_names), "unique": len(set(base_names)), "sha256": base_set_sha})

    scope = policy.get("successorScope", {})
    rows = scope.get("addedRows", [])
    by_id = {r.get("tableId"): r for r in rows}
    if len(rows) != 17 or len(by_id) != 17 or set(by_id) != set(EXPECTED):
        fail("TS132-SCOPE-001", "proposal is not the exact reviewed 17-table identity set", {"actual": sorted(by_id), "expected": sorted(EXPECTED)})
    if scope.get("removedTableIds") != []:
        fail("TS132-SCOPE-002", "table removals are forbidden", scope.get("removedTableIds"))
    if (scope.get("tableCount"), scope.get("deltaCount")) != (132, 17):
        fail("TS132-SCOPE-003", "successor count/delta must be 132/17", {"tableCount": scope.get("tableCount"), "deltaCount": scope.get("deltaCount")})

    for table, (owner, complete_producers) in EXPECTED.items():
        row = by_id.get(table, {})
        if row.get("ownerSession") != owner:
            fail("TS132-OWNER-001", f"{table} owner mismatch", {"actual": row.get("ownerSession"), "expected": owner})
        actual = set(row.get("producers", []))
        if actual != complete_producers:
            fail("TS132-PRODUCER-001", f"{table} producer set is incomplete", {"actual": sorted(actual), "expected": sorted(complete_producers), "missing": sorted(complete_producers - actual), "extra": sorted(actual - complete_producers)})
        if not str(row.get("nonReplaceability", "")).strip():
            fail("TS132-NONREPLACEABLE-001", f"{table} lacks a non-replaceability proof", {})
        readers = set(row.get("readConsumers", []))
        if readers != EXPECTED_READ_CONSUMERS[table]:
            fail("TS132-CONSUMER-001", f"{table} reader set is incomplete", {
                "actual": sorted(readers), "expected": sorted(EXPECTED_READ_CONSUMERS[table]),
            })

    predecessor = policy.get("predecessorPolicy", {})
    if predecessor.get("sha256") != "64bc16def08c4a87750a656a039588db67bba5ec5fad6fac0dbd1bed638e6444":
        fail("TS132-LINEAGE-001", "v3 does not pin the immutable failed-review v2 bytes", predecessor)
    review = policy.get("independentReview", {})
    if review.get("sha256") != "da7b9a3b5adfe0246f9d53e4dd42d4275135b303033782a7c84450f822198075":
        fail("TS132-LINEAGE-002", "v3 does not pin the independent P0 review", review)

    rules = " ".join(scope_rule for scope_rule in policy.get("acceptanceRules", []) if isinstance(scope_rule, str))
    if "ten query-bearing physical tables" in rules:
        fail("TS132-CONSUMER-001", "acceptance policy checks only ten query-bearing additions although all 17 rows declare durable read consumers", {"declaredRows": 17, "coveredByRule": 10})
    return issues


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    policy = json.loads(POLICY.read_text())
    baseline = json.loads(BASELINE.read_text())
    issues = evaluate(policy, baseline)
    result = {"status": "PASS" if not issues else "FAIL", "findingCount": len(issues), "findings": issues}

    if args.self_test:
        tests = []
        mutations = {
            "remove-added-table": lambda p, b: p["successorScope"]["addedRows"].pop(),
            "add-removal": lambda p, b: p["successorScope"]["removedTableIds"].append("ppl_rec_requisitions"),
            "wrong-owner": lambda p, b: p["successorScope"]["addedRows"][0].update(ownerSession="HRIS-SYS"),
            "drop-producer": lambda p, b: p["successorScope"]["addedRows"][1].update(producers=[]),
            "duplicate-baseline": lambda p, b: b["tableSpecifications"].append(copy.deepcopy(b["tableSpecifications"][0])),
        }
        for name, mutate in mutations.items():
            p, b = copy.deepcopy(policy), copy.deepcopy(baseline)
            mutate(p, b)
            # Reseal policy so the semantic mutation, not merely a stale seal, is detected.
            p["sealedPayloadSha256"] = sealed_payload(p)
            tests.append({"name": name, "passed": bool(evaluate(p, b, check_file_pins=False))})
        result["selfTests"] = tests
        result["selfTestStatus"] = "PASS" if all(t["passed"] for t in tests) else "FAIL"
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    return 0 if not issues else 1


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
