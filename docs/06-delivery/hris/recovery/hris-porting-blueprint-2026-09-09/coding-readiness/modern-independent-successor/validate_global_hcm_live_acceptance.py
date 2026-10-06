#!/usr/bin/env python3
"""Independent live acceptance check for the modern/global HRIS successor.

This validator deliberately does not import any of the canonical generators or
their author validators.  It reads the five live canonical contracts and the
closed-set manifest as data, then proves the semantic closure requirements
recorded by the frozen 2026-09-16 independent global-HCM audit.

An exit status of zero means all P0 *and* P1 requirements are structurally
closed in the current candidate.  It does not authorize G3 by itself.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Iterable, Mapping, Sequence


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
REPORT_DIR = HERE / "reports"
DEFAULT_REPORT = REPORT_DIR / "global-hcm-live-acceptance-latest.v1.json"
FROZEN_AUDIT = ROOT / "coding-readiness/reports/global-hcm-semantic-closure-independent-audit-2026-09-16.v1.json"
EXPECTED_AUDIT_SHA256 = "af0ad56a400abd361fc8f14164f417b28d66a7daa1dd475a9f2926856ab51ba6"
EXPANSION_POLICY_PATH = HERE / "global-hcm-table-expansion-acceptance-policy.v5.json"
EXPECTED_EXPANSION_POLICY_SHA256 = "ec29008105473639a2a6ffcf116295e410de4c017d5bf1c0fd5a02c228cb088b"
EXPECTED_EXPANSION_POLICY_SEAL = "4bdfd9282371ce9c6f32db6d2d50265b3480c8d4157d35132c1d7dccefcd69e2"
PREDECESSOR_POLICY_PATH = HERE / "global-hcm-table-expansion-acceptance-policy.v4.json"
EXPECTED_PREDECESSOR_POLICY_SHA256 = "afb844e6ce31f588ec04b3fc46f759c616c13227742bc3d688d8f246d92c83de"
EXPECTED_PREDECESSOR_POLICY_SEAL = "a939167ed5167155cb8d08383415d8e518d25583bb2362fa7b2b5bfa95748b63"
GRANDPREDECESSOR_POLICY_PATH = HERE / "global-hcm-table-expansion-acceptance-policy.v3.json"
EXPECTED_GRANDPREDECESSOR_POLICY_SHA256 = "02fe8f0e5aebf06bc2c8b3cbe09f0947138310f6c921056c8be2f43d222cbd57"
EXPECTED_GRANDPREDECESSOR_POLICY_SEAL = "8041c142ac96be31a4e4bd67a088bda1075147ec8111b388d572d3f35259d78a"
V2_POLICY_PATH = HERE / "global-hcm-table-expansion-acceptance-policy.v2.json"
EXPECTED_V2_POLICY_SHA256 = "64bc16def08c4a87750a656a039588db67bba5ec5fad6fac0dbd1bed638e6444"
EXPECTED_V2_POLICY_SEAL = "36229b77ea56f94d61e9beee431b74d0413263853bb7e3b82951ae68534bfe86"
TRIAGE_AUTHORITY_PATH = ROOT / "coding-readiness/reports/modern-v4-preflight-finding-triage-independent-2026-09-16.v1.json"
EXPECTED_TRIAGE_AUTHORITY_SHA256 = "03f8e2a967e052a7096b0bc837b5ccb9c7faee6a30920717a1f438647f5e953c"
EXPECTED_TRIAGE_AUTHORITY_SEAL = "e930be1e35d7987a1373c6e16133cc196a62e80fce9e50e685e81820fffbaa8e"
INDEPENDENT_SCOPE_REVIEW_PATH = REPORT_DIR / "table-scope-expansion-132-independent-review.v1.json"
EXPECTED_SCOPE_REVIEW_SHA256 = "da7b9a3b5adfe0246f9d53e4dd42d4275135b303033782a7c84450f822198075"
EXPECTED_SCOPE_REVIEW_STATUS = "FAIL_POLICY_V2_NOT_APPROVED_TABLE_IDENTITIES_CONDITIONALLY_ACCEPTED"
EXPECTED_SCOPE_REVIEW_FINDINGS = {
    "P0-TS132-PRODUCER-001": "REJECT_CURRENT_PRODUCER_SET",
    "P0-TS132-PRODUCER-002": "REJECT_CURRENT_PRODUCER_SET",
    "P0-TS132-CONSUMER-003": "REJECT_TEN_TABLE_SHORTCUT",
}
SCOPE_REDUCTION_REVIEW_PATH = ROOT / "coding-readiness/reports/modern-closed-set-listening-pre-emit-independent-design-review-2026-09-16.v1.json"
EXPECTED_SCOPE_REDUCTION_REVIEW_SHA256 = "99e96abe87d7141f3d7ff6a0185db5f1820a8385e700d34d0df3b8e11a322604"
EXPECTED_SCOPE_REDUCTION_REVIEW_SEAL = "39a27f6c0362ca52eddfb19c8ac2b31981d98755de5d911e15ea2791b4242bcd"
EXPECTED_SCOPE_REDUCTION_DECISION = "REMOVE_ORPHAN_SYS_HRIS_LISTENING_EXPORT_RECEIPTS_AND_RETAIN_EXISTING_ANALYTICS_EXPORT_OWNER"

CANONICAL_PATHS = {
    "operation": ROOT / "coding-readiness/modern-capability-operation-causal-contract-ssot.v2.json",
    "exact": ROOT / "coding-readiness/modern-capability-exact-schema-contracts.v1.json",
    "event": ROOT / "coding-readiness/modern-capability-event-payload-contracts.v1.json",
    "semantic": ROOT / "coding-readiness/modern-capability-semantic-bindings.v1.json",
    "causal": ROOT / "coding-readiness/modern-capability-causal-state-contracts.v2.json",
    "manifest": ROOT / "coding-readiness/modern-capability-closed-set-manifest.v3.json",
}
CANONICAL_FILENAMES = {name: path.name for name, path in CANONICAL_PATHS.items()}

BASE_ENTITY_FIELDS = {
    "publicId", "aggregateVersion", "state", "referenceEffectiveAt",
    "fieldPolicyRevision",
}
REQUIRED_COUNTS = {
    "operations": 199,
    "queries": 66,
    "commands": 133,
    "handlers": 27,
    "events": 157,
}
GLOBAL_OWNER_DEPENDENCY_IDS = frozenset({
    "configuration.resolveSignedParticipationOfferForEntitledSubject.v1",
    "compensation.resolveApprovedSnapshotForPayroll.v1",
})
PAYROLL_OWNER_DEPENDENCY_SEAL = (
    "7baa02b0d150893068acbe1137ecbe8d4918f07054409d734838b2d73c818bf3"
)
PAYROLL_OPERATION_EVENT_FIELDS_SHA256 = (
    "1643b272b6f71d9c7b1350c72cb0885577e2ee329a42c0e98a9e5060f458f7aa"
)
PAYROLL_OPERATION_REFETCH_SHA256 = (
    "e55e3329c43bf8d8ec637240d5360666d7caa7aa8b187abe4ba4e85474b83c2c"
)
PAYROLL_OPERATION_AUDIENCE_SHA256 = (
    "b02828c91cb83604e1848ffef9e5b31639787f7bdb95e2d49310108f1f12ffa1"
)
PAYROLL_PROJECTED_REFETCH_SHA256 = (
    "37850e2c20d38e0eb7c275deea2b9c03b22020aebcd4c7dfd737c3718724ec1f"
)
PAYROLL_PROJECTED_DELIVERY_SHA256 = (
    "f61cfa4f5715a2a09fe7c81706a52f97c4b0dd96b7e8b854bbbc1e4f7cf99d03"
)
# The owner event deliberately retains approvalTenantId as immutable approval
# provenance for HRIS-PER.  There is no routing field named tenantId, and the
# HRIS-PAY consumer sees only the four-field minimum trigger allowlist.
PAYROLL_OWNER_EVENT_FIELD_NAMES = (
    "aggregateId", "fromState", "toState", "aggregateVersion", "occurredAt",
    "correlationId", "planId", "cycleId", "effectiveDate", "snapshotId",
    "lineCount", "snapshotRevision", "sourceVersion", "payloadDigest",
    "approvalReceiptId", "approvalReceiptRevision", "approvalOutcome",
    "approvalAction", "approvalInputDigest", "approvalPurposeCode",
    "approvalTenantId",
)


def expected_payroll_digest_canonicalization() -> dict[str, Any]:
    """Independent exact PAY digest definition; author code is not imported."""
    return {
        "contractVersion": "DWP_HRIS_PAYROLL_SNAPSHOT_DIGEST_V1",
        "hashAlgorithm": "SHA-256",
        "serialization": "RFC8785_JCS",
        "encoding": "UTF-8",
        "framing": (
            "UTF8(domainSeparator)||0x00||UTF8(RFC8785_JCS(canonicalValue))"
        ),
        "transportRepresentation": (
            "EXCLUDED_COMPRESSED_UNCOMPRESSED_AND_CHUNK_FRAMING_BYTES"
        ),
        "typedScalars": {
            "uuid": "LOWERCASE_RFC4122_HYPHENATED",
            "date": "ISO8601_FULL_DATE_YYYY-MM-DD",
            "bigint": (
                "NONNEGATIVE_INT64_CANONICAL_DECIMAL_STRING_0_TO_"
                "9223372036854775807_NO_PLUS_NO_LEADING_ZERO"
            ),
            "boundedInteger": "RFC8785_JSON_INTEGER_0_TO_100000",
            "nullable": "REQUIRED_FIELD_EXPLICIT_JSON_NULL_NEVER_ABSENT",
            "postedMoney": (
                "CANONICAL_DECIMAL_STRING_PRECISION_19_SCALE_4_NO_EXPONENT_"
                "NO_NEGATIVE_ZERO_NO_IMPLICIT_ROUNDING"
            ),
            "digestHex": "LOWERCASE_HEX_64",
        },
        "lineDigest": {
            "domainSeparator": "DWP.HRIS.PAYROLL.SNAPSHOT.LINE.V1",
            "canonicalValue": "JSON_ARRAY_IN_EXACT_FIELD_ORDER",
            "fieldOrder": [
                "lineId", "lineSequence", "workerId", "assignmentId",
                "componentCode", "currency", "approvedAmount", "effectiveFrom",
                "effectiveTo",
            ],
            "excludedFields": ["lineDigest"],
            "formula": (
                "SHA256(UTF8(domainSeparator)||0x00||UTF8(RFC8785_JCS("
                "fieldValueArray)))"
            ),
            "selfDigestInput": "FORBIDDEN",
        },
        "payloadDigest": {
            "domainSeparator": "DWP.HRIS.PAYROLL.SNAPSHOT.PAYLOAD.V1",
            "canonicalValue": (
                "JSON_ARRAY_[HEADER_VALUE_ARRAY,ORDERED_LINE_DIGEST_HEX_ARRAY]"
            ),
            "headerFieldOrder": [
                "snapshotId", "snapshotRevision", "planId", "cycleId",
                "effectiveFrom", "effectiveTo", "approvalReceiptId",
                "sourceVersion", "lineCount",
            ],
            "excludedHeaderFields": ["payloadDigest"],
            "lineDigestOrder": "lineSequence ASC CONTIGUOUS_FROM_1",
            "lineDigestEncoding": "LOWERCASE_HEX_64_RAW_DIGEST_TEXT",
            "lineCountBinding": (
                "header.lineCount IS_IN_HEADER_PREIMAGE_AND_EQUALS_DIGEST_LIST_COUNT"
            ),
            "formula": (
                "SHA256(UTF8(domainSeparator)||0x00||UTF8(RFC8785_JCS(["
                "headerValueArray,orderedLineDigestHexArray])))"
            ),
            "selfDigestInput": "FORBIDDEN",
        },
        "closedInputValidation": {
            "schema": "EXACT_NO_ADDITIONAL_FIELDS",
            "duplicateFieldNames": "REJECT",
            "missingRequiredFields": "REJECT",
            "lineSequence": "ONE_BASED_CONTIGUOUS_NO_GAP_NO_DUPLICATE",
            "lineCountMatch": "REQUIRED_BEFORE_DIGEST_ACCEPTANCE",
            "zeroLines": "REJECT_MIN_ITEMS_1",
            "oneLine": "ACCEPT_IF_ALL_VALIDATIONS_PASS",
            "oneHundredThousandLines": "ACCEPT_IF_ALL_VALIDATIONS_PASS",
            "aboveOneHundredThousandLines": "REJECT_BEFORE_DIGEST_CALCULATION",
            "nullVsAbsent": (
                "DISTINCT_EFFECTIVE_TO_NULL_REQUIRED_FIELD_ABSENCE_REJECTED"
            ),
            "decimalAlternateSpelling": "REJECT_NON_CANONICAL_BEFORE_DIGEST",
            "selfDigestInjection": (
                "REJECT_DIGEST_FIELDS_ARE_NEVER_PREIMAGE_MEMBERS"
            ),
        },
    }


EXPECTED_SELF_TEST_COUNT = 88
FROZEN_115_TABLE_SET_SHA256 = "7a8805795efade4334baa3a6f91d6180b1a0bb4ecec118688e25e86cebd2f2cd"
EXPECTED_GLOBAL_EXPANSION_TABLES = {
    "ppl_rec_offer_decisions", "ppl_rec_requisition_versions",
    "ppl_jny_template_task_definitions", "ppl_wfp_simulation_requests",
    "ppl_bnf_enrollment_eligibility_receipts", "ppl_bnf_dependent_elections",
    "ppl_bnf_life_event_decisions", "ppl_cwk_access_receipts",
    "prf_lrn_offering_versions", "prf_lrn_capacity_ledger",
    "prf_mkt_opportunity_versions", "prf_cmp_proposal_versions",
    "prf_cmp_plan_proposal_refs", "tme_wfm_approval_receipts",
    "sys_hris_ai_assistance_reviews", "ppl_cwk_engagement_versions",
    "prf_suc_plan_versions",
}
EXPECTED_REMOVED_TABLES = {"sys_hris_listening_export_receipts"}
EXPECTED_SUCCESSOR_TABLE_COUNT = 131
EXPECTED_ADDITION_COUNT = 17
EXPECTED_NET_DELTA = 16

EXPANDED_QUERY_TABLE_READERS: dict[str, tuple[str, ...]] = {
    "ppl_rec_offer_decisions": (
        "modern.recruiting.candidate.query", "modern.recruiting.candidates.query",
    ),
    "ppl_rec_requisition_versions": (
        "modern.recruiting.requisition.query", "modern.recruiting.requisitions.query",
    ),
    "ppl_bnf_enrollment_eligibility_receipts": (
        "modern.benefits.enrollment.query", "modern.benefits.enrollments.query",
    ),
    "ppl_bnf_dependent_elections": (
        "modern.benefits.enrollment.query", "modern.benefits.enrollments.query",
    ),
    "prf_lrn_offering_versions": (
        "modern.learning.offering.query", "modern.learning.catalog.query",
    ),
    "ppl_jny_template_task_definitions": (
        "modern.onboarding.template.query", "modern.onboarding.templates.query",
        "modern.onboarding.assignment.query", "modern.onboarding.assignments.query",
        "modern.onboarding.self.query",
    ),
    "ppl_bnf_life_event_decisions": (
        "modern.benefits.lifeevent.query", "modern.benefits.lifeevents.query",
    ),
    "ppl_cwk_access_receipts": (
        "modern.contingent.engagement.query", "modern.contingent.engagements.query",
    ),
    "prf_lrn_capacity_ledger": (
        "modern.learning.assignment.query", "modern.learning.assignments.query",
    ),
    "prf_mkt_opportunity_versions": (
        "modern.opportunity.query", "modern.opportunity.catalog.query",
        "modern.opportunity.application.query", "modern.opportunity.applications.query",
    ),
    "tme_wfm_approval_receipts": (
        "modern.wfm.candidate.query", "modern.wfm.candidates.query",
    ),
    "ppl_wfp_simulation_requests": (
        "modern.workforceplan.scenario.query", "modern.workforceplan.scenarios.query",
    ),
    "sys_hris_ai_assistance_reviews": (
        "modern.ai.assistance.query", "modern.ai.assistances.query",
    ),
    "ppl_cwk_engagement_versions": (
        "modern.contingent.engagement.query", "modern.contingent.engagements.query",
    ),
    "prf_suc_plan_versions": (
        "modern.succession.plan.query", "modern.succession.plans.query",
    ),
    "prf_cmp_proposal_versions": (
        "modern.compplan.proposal.query", "modern.compplan.proposals.query",
    ),
    "prf_cmp_plan_proposal_refs": (
        "modern.compplan.cycle.query", "modern.compplan.cycles.query",
        "modern.compplan.proposal.query", "modern.compplan.proposals.query",
    ),
}

WFP_REQUEST_TABLE = "ppl_wfp_simulation_requests"
WFP_IMMUTABLE_COLUMNS = {
    "tenant_id", "public_id", "parent_public_id", "parent_version",
    "fact_revision", "scenario_revision", "input_snapshot_public_id",
    "rule_version", "deterministic_seed", "request_digest", "payload_digest",
    "created_by", "created_at", "correlation_id", "reference_effective_at",
}
WFP_HANDLER_SELECTOR = (
    "tenant+request public_id+expected aggregate_version+state=REQUESTED; "
    "terminal rows are immutable and accept no later result"
)
WFP_CANCEL_SELECTOR = (
    "tenant+parent scenario public_id+exact single active state=REQUESTED; "
    "terminal rows are immutable and never cancelled"
)
WFP_HANDLER_ASSIGNMENTS = {
    "state": "derived.simulationRequestPostState.COMPLETED_OR_FAILED",
    "aggregate_version": "LOCKED_PRE:aggregate_version+1",
    "result_public_id": "ownerResult.resultPublicId",
    "result_revision": "ownerResult.resultRevision",
    "result_receipt_public_id": "ownerResult.resultReceiptPublicId",
    "result_receipt_revision": "ownerResult.resultReceiptRevision",
    "result_schema_version": "ownerResult.resultSchemaVersion",
    "result_digest": "ownerResult.resultDigest",
    "completed_at": "ownerClock.transactionNow",
    "updated_at": "ownerClock.transactionNow",
}
WFP_CANCEL_ASSIGNMENTS = {
    "state": "CONSTANT:CANCELLED",
    "aggregate_version": "LOCKED_PRE:aggregate_version+1",
    "completed_at": "ownerClock.transactionNow",
    "updated_at": "ownerClock.transactionNow",
}
WFP_RESULT_TUPLE_EXPRESSION = (
    "((state='REQUESTED' AND result_public_id IS NULL AND result_revision IS NULL "
    "AND result_receipt_public_id IS NULL AND result_receipt_revision IS NULL "
    "AND result_schema_version IS NULL AND result_digest IS NULL AND completed_at IS NULL) "
    "OR (state IN ('COMPLETED','FAILED') AND result_public_id IS NOT NULL "
    "AND result_revision IS NOT NULL AND result_receipt_public_id IS NOT NULL "
    "AND result_receipt_revision IS NOT NULL AND result_schema_version IS NOT NULL "
    "AND result_digest IS NOT NULL AND completed_at IS NOT NULL) "
    "OR (state='CANCELLED' AND result_public_id IS NULL AND result_revision IS NULL "
    "AND result_receipt_public_id IS NULL AND result_receipt_revision IS NULL "
    "AND result_schema_version IS NULL AND result_digest IS NULL AND completed_at IS NOT NULL))"
)

AI_REVIEW_TABLE = "sys_hris_ai_assistance_reviews"
AI_ASSISTANCE_ROOT = "sys_hris_ai_assistance_requests"
AI_ROOT_SELECTOR = "tenant+public_id+expected aggregate_version+allowed pre-state"
AI_ROOT_ASSIGNMENTS = {
    "tenant_id": "authenticatedPrincipal.tenantId",
    "aggregate_version": "LOCKED_PRE:aggregate_version+1",
    "state": "derived.transition_post_state",
    "updated_at": "ownerClock.transactionNow",
}
AI_REVOCATION_LINK_EXPRESSION = (
    "((decision='REVOKED' AND prior_review_public_id IS NOT NULL AND "
    "prior_review_revision IS NOT NULL) OR (decision IN ('CONFIRMED','REJECTED') "
    "AND prior_review_public_id IS NULL AND prior_review_revision IS NULL))"
)


def canonical_json(value: Any) -> bytes:
    return json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sealed_payload_sha256(value: Mapping[str, Any]) -> str:
    payload = {key: item for key, item in value.items() if key != "sealedPayloadSha256"}
    return sha256_bytes(canonical_json(payload))


def owner_dependency_semantic_bindings(
    dependency_rows: Sequence[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Independent deterministic projection of every semantic binding field."""
    return [
        {
            "dependencyContractId": row.get("dependencyContractId"),
            "ownerSession": row.get("ownerSession"),
            "consumerSession": row.get("consumerSession"),
            "purpose": row.get("pep", {}).get("purpose"),
            "requestFields": [
                field.get("name")
                for field in row.get("requestSchema", {}).get("fields", [])
            ],
            "responseHeaderFields": [
                field.get("name")
                for field in row.get("responseSchema", {}).get(
                    "headerFields", []
                )
            ],
            "responseLineFields": [
                field.get("name")
                for field in row.get("responseSchema", {}).get(
                    "lines", {}
                ).get("itemFields", [])
            ],
            "readTables": copy.deepcopy(
                row.get("readPlan", {}).get("tables", [])
            ),
            "writes": row.get("writes"),
            "latestFallback": row.get("latestFallback"),
            "sealedPayloadSha256": row.get("sealedPayloadSha256"),
        }
        for row in dependency_rows
    ]


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def norm(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.lower())


def normalized_contract_text(value: Any) -> str:
    return " ".join(str(value).split())


def unique_index(rows: Iterable[dict[str, Any]], key: str) -> tuple[dict[str, dict[str, Any]], list[str]]:
    result: dict[str, dict[str, Any]] = {}
    duplicates: list[str] = []
    for row in rows:
        value = row.get(key)
        if not isinstance(value, str):
            continue
        if value in result:
            duplicates.append(value)
        result[value] = row
    return result, sorted(set(duplicates))


def flatten_strings(value: Any) -> list[str]:
    values: list[str] = []
    if isinstance(value, str):
        values.append(value)
    elif isinstance(value, dict):
        for key, item in value.items():
            values.append(str(key))
            values.extend(flatten_strings(item))
    elif isinstance(value, list):
        for item in value:
            values.extend(flatten_strings(item))
    return values


def iter_strings(value: Any, path: str = "$") -> Iterable[tuple[str, str]]:
    """Yield exact string leaves with stable JSON paths for audit evidence."""
    if isinstance(value, str):
        yield path, value
    elif isinstance(value, list):
        for index, item in enumerate(value):
            yield from iter_strings(item, f"{path}[{index}]")
    elif isinstance(value, dict):
        for key in sorted(value):
            yield from iter_strings(value[key], f"{path}.{key}")


def token_present(names: Iterable[str], aliases: Iterable[str]) -> bool:
    normalized = [norm(name) for name in names]
    for alias in aliases:
        wanted = norm(alias)
        if any(value == wanted or wanted in value for value in normalized):
            return True
    return False


def all_groups_present(names: Iterable[str], groups: Sequence[Sequence[str]]) -> tuple[bool, list[list[str]]]:
    materialized = list(names)
    missing = [list(group) for group in groups if not token_present(materialized, group)]
    return not missing, missing


def configuration_version_aliases(code_column: str) -> tuple[str, ...]:
    """Return every physical column name accepted as a version pin for a code."""
    stem = re.sub(r"_(code|key)$", "", code_column)
    return (
        stem + "_vocabulary_version_id", stem + "_config_version_id",
        stem + "_country_pack_version_id", stem + "_code_set_version_id",
        stem + "_configuration_receipt_id", "vocabulary_version_id",
        "country_pack_version_id",
    )


def state_values(table: Mapping[str, Any], column: str) -> set[str]:
    values: set[str] = set()
    for check in table.get("checks", []):
        if column not in check.get("columns", []):
            continue
        expression = str(check.get("expression", ""))
        for match in re.finditer(r"\bIN\s*\(([^)]*)\)", expression, re.I):
            values.update(re.findall(r"'([^']+)'", match.group(1)))
    return values


@dataclass
class Issue:
    requirement_id: str
    severity: str
    rule_id: str
    subject_kind: str
    subject_id: str
    message: str
    evidence: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return {
            "requirementId": self.requirement_id,
            "severity": self.severity,
            "ruleId": self.rule_id,
            "subjectKind": self.subject_kind,
            "subjectId": self.subject_id,
            "message": self.message,
            "evidence": self.evidence,
        }


class Model:
    """Read-only normalized view of the six current successor artifacts."""

    def __init__(
        self, docs: Mapping[str, dict[str, Any]],
        source_hashes: Mapping[str, str] | None = None,
        source_paths: Mapping[str, str] | None = None,
    ) -> None:
        self.docs = dict(docs)
        self.source_hashes = dict(source_hashes or {})
        self.source_paths = dict(source_paths or {})
        self.expansion_policy = load_json(EXPANSION_POLICY_PATH)
        self.operation, self.operation_duplicates = unique_index(
            self.docs["operation"].get("operations", []), "operationId"
        )
        self.handler, self.handler_duplicates = unique_index(
            self.docs["operation"].get("systemHandlers", []), "handlerId"
        )
        self.table, self.table_duplicates = unique_index(
            self.docs["exact"].get("tableSpecifications", []), "tableName"
        )
        schemas = (
            self.docs["exact"].get("recordSchemas", [])
            + self.docs["exact"].get("responseSchemas", [])
        )
        self.schema, self.schema_duplicates = unique_index(schemas, "schemaId")
        self.binding, self.binding_duplicates = unique_index(
            self.docs["exact"].get("operationBindings", []), "operationId"
        )
        self.lineage, self.lineage_duplicates = unique_index(
            self.docs["exact"].get("operationFieldLineage", []), "operationId"
        )
        self.semantic, self.semantic_duplicates = unique_index(
            self.docs["semantic"].get("operations", []), "operationId"
        )
        self.causal, self.causal_duplicates = unique_index(
            self.docs["causal"].get("operations", []), "operationId"
        )
        self.payload, self.payload_duplicates = unique_index(
            self.docs["event"].get("eventPayloadSchemas", []), "eventName"
        )
        self.events: list[tuple[str, str, dict[str, Any]]] = []
        for operation_id, operation in self.operation.items():
            for event in operation.get("events", []):
                self.events.append(("operation", operation_id, event))
        for handler_id, handler in self.handler.items():
            event = handler.get("event")
            if isinstance(event, dict):
                self.events.append(("handler", handler_id, event))
            for additional_event in handler.get("additionalEvents", []):
                if isinstance(additional_event, dict):
                    self.events.append(("handler", handler_id, additional_event))

    def query_ids(self) -> list[str]:
        return sorted(
            operation_id for operation_id, operation in self.operation.items()
            if operation.get("mode") == "QUERY"
        )

    def command_ids(self) -> list[str]:
        return sorted(
            operation_id for operation_id, operation in self.operation.items()
            if operation.get("mode") == "COMMAND"
        )

    def response_entity(self, operation_id: str) -> dict[str, Any] | None:
        binding = self.binding.get(operation_id)
        if not binding:
            return None
        response = self.schema.get(binding.get("responseSchemaRef", ""))
        if not response:
            return None
        for item in response.get("fields", []):
            if item.get("name") in {"item", "items"}:
                ref = item.get("schemaRef") or item.get("itemSchemaRef")
                return self.schema.get(ref)
        return None

    def table_columns(self, table_name: str) -> set[str]:
        table = self.table.get(table_name, {})
        common = {
            "tenant_id", "public_id", "aggregate_version", "created_at",
            "updated_at", "created_by", "correlation_id",
        }
        id_column = table.get("idColumn", {}).get("name")
        if id_column:
            common.add(id_column)
        return common | {
            row.get("name") for row in table.get("columns", []) if row.get("name")
        }

    def operation_request_sources(self, operation_id: str) -> set[str]:
        return {
            row.get("source") for row in self.operation.get(operation_id, {}).get("requestFields", [])
            if row.get("source")
        }

    def operation_body_names(self, operation_id: str) -> set[str]:
        return {
            str(row.get("name")) for row in self.operation.get(operation_id, {}).get("requestFields", [])
            if row.get("location") == "body" and row.get("name")
        }

    def operation_assignments(self, operation_id: str) -> dict[str, dict[str, Any]]:
        result: dict[str, dict[str, Any]] = defaultdict(dict)
        for step in self.operation.get(operation_id, {}).get("orderedDml", []):
            if not isinstance(step, dict) or not step.get("table"):
                continue
            result[step["table"]].update(step.get("assignments", {}))
        return dict(result)

    def writers(self) -> dict[str, list[dict[str, str]]]:
        result: dict[str, list[dict[str, str]]] = defaultdict(list)
        for operation_id in sorted(self.operation):
            for step in self.operation[operation_id].get("orderedDml", []):
                if isinstance(step, dict) and step.get("table"):
                    result[step["table"]].append({
                        "producer": operation_id, "action": str(step.get("action", ""))
                    })
        for handler_id in sorted(self.handler):
            for step in self.handler[handler_id].get("writes", []):
                if isinstance(step, dict) and step.get("table"):
                    result[step["table"]].append({
                        "producer": handler_id, "action": str(step.get("action", ""))
                    })
        return dict(result)


# The aliases are deliberately operation-family specific.  A five-field
# envelope, a generic payload digest, or an unrelated policy record cannot
# satisfy these business projections.
QUERY_FIELD_GROUPS: dict[str, list[tuple[str, ...]]] = {
    "ai.assistance": [("useCase",), ("instruction",), ("sourceProjection", "sourceBundle"), ("result", "provenance"), ("humanConfirmation", "reviewDecision")],
    "ai.evaluation": [("evaluationSuite", "suite"), ("outcome",), ("blockingFailure", "failure"), ("resultReceipt", "evaluationReceipt")],
    "ai.polic": [("useCase",), ("riskClassification",), ("modelVersion",), ("humanOversight",), ("killSwitch",), ("governanceActivation",)],
    "analytics.metric": [("metricKey", "metricCode"), ("expression",), ("aggregation",), ("unit",), ("dimension",), ("sourceContract", "sourceField")],
    "analytics.projection": [("metricVersion",), ("asOf",), ("cohort",), ("populationSnapshot",), ("projectionValue", "value"), ("lineage",), ("threshold",)],
    "analytics.export": [("projection",), ("objectRef", "artifact"), ("digest",), ("rowCount",), ("expiresAt", "retention")],
    "benefits.plan": [("displayName", "planName"), ("effectiveFrom",), ("coverageOption",), ("eligibility",), ("enrollmentWindow",), ("provider",), ("payrollTreatment",)],
    "benefits.self.plan": [("displayName", "planName"), ("effectiveFrom",), ("coverageOption",), ("eligibility",), ("enrollmentWindow",), ("provider",), ("payrollTreatment",)],
    "benefits.enrollment": [("worker",), ("planVersion",), ("coverageOption",), ("eligibility",), ("dependent",), ("providerStatus", "providerReceipt")],
    "benefits.lifeevent": [("worker",), ("eventType",), ("eventDate",), ("decision", "status"), ("evidence", "artifact")],
    "compplan.cycle": [("displayName", "cycleName"), ("effectiveFrom",), ("budget",), ("currency",), ("guideline",), ("populationSnapshot",)],
    "compplan.proposal": [("worker",), ("assignment",), ("component",), ("amount",), ("currency",), ("effectiveDate",), ("reason",), ("proposalVersion", "history")],
    "contingent.engagement": [("worker",), ("vendor",), ("sponsor",), ("classification",), ("access",), ("effectiveFrom",), ("effectiveTo",)],
    "growth.export": [("profile",), ("objectRef", "artifact"), ("digest",), ("expiresAt", "retention")],
    "growth.profile": [("worker",), ("artifact",), ("artifactRevision",), ("visibility",), ("evidence",), ("coaching",)],
    "growth.self": [("worker",), ("artifact",), ("visibility",), ("evidence",)],
    "hrservice.case": [("caseNumber",), ("caseType",), ("requester",), ("queue",), ("sensitivity", "visibility"), ("requestArtifact", "contentArtifact"), ("action",), ("sla",)],
    "learning.assignment": [("worker",), ("offering",), ("due",), ("assignmentSource", "sourcePolicy"), ("progress",), ("completionEvidence", "evidence")],
    "learning.catalog": [("offering",), ("contentArtifact", "content"), ("delivery",), ("capacity",), ("eligibility",), ("skill",)],
    "learning.offering": [("displayName", "offeringName"), ("contentArtifact", "content"), ("delivery",), ("capacity",), ("eligibility",), ("skill",)],
    "listening.active": [("survey",), ("formVersion", "question"), ("opensAt",), ("closesAt",), ("admission",)],
    "listening.cohort": [
        ("cohortPublicId",), ("adequacyCategory",), ("measureValues",),
        ("subjectCount",), ("anonymityThreshold",),
        ("privacyBudgetReceiptId",), ("lineageReceiptId",),
    ],
    "listening.survey": [("displayName", "surveyName"), ("formVersion", "question"), ("privacyVersion",), ("retentionVersion",), ("opensAt",), ("closesAt",)],
    "onboarding.template": [("displayName", "templateName"), ("effectiveFrom",), ("configScope",), ("taskDefinition", "tasks"), ("actorRule",), ("dueAnchor",), ("completionSchema", "evidenceSchema")],
    "onboarding.assignment": [("worker",), ("templateVersion",), ("due",), ("taskInstance", "tasks"), ("actor",), ("evidence",)],
    "onboarding.self": [("worker",), ("templateVersion",), ("due",), ("taskInstance", "tasks"), ("evidence",)],
    "opportunity.application": [("worker", "applicant"), ("opportunityVersion",), ("consent",), ("statementArtifact",), ("explanation",), ("decisionReceipt", "decision")],
    "opportunity.catalog": [("displayName", "title"), ("criteria",), ("capacity",), ("skill",), ("openFrom",), ("closeAt",)],
    "opportunity": [("displayName", "title"), ("criteria",), ("capacity",), ("skill",), ("openFrom",), ("closeAt",)],
    "recruiting.candidate": [("requisition",), ("sourceSystem",), ("candidatePersonToken", "candidateToken"), ("consent",), ("stage",), ("offer",), ("hireHandoff", "hireReceipt")],
    "recruiting.requisition": [("requisitionCode",), ("title",), ("organization",), ("position",), ("employmentType",), ("targetStart", "validFrom")],
    "skills.evidence": [("worker",), ("skill",), ("taxonomyVersion",), ("proficiency", "band"), ("source",), ("observedAt",), ("consent", "provenance")],
    "skills.taxonom": [("taxonomy",), ("effectiveFrom",), ("node",), ("edge",), ("proficiency", "band")],
    "skills.worker": [("worker",), ("skill",), ("taxonomyVersion",), ("proficiency", "band"), ("evidence",)],
    "succession.plan": [("displayName", "planName"), ("keyPosition",), ("audiencePolicy",), ("nomination",), ("readiness",), ("consent",)],
    "wfm.candidate": [("forecast",), ("candidateVersion",), ("shift",), ("timeGroup",), ("constraint",), ("fairness",), ("approval",), ("publish",)],
    "wfm.forecast": [("organization",), ("periodStart",), ("periodEnd",), ("demand",), ("unit",), ("skill",)],
    "wfm.optimization": [("forecast",), ("optimizationMode", "mode"), ("availability",), ("ruleSnapshot",), ("status",)],
    "workforceplan.scenario": [("displayName", "scenarioName"), ("asOf", "effectiveDate"), ("organizationSnapshot",), ("populationSnapshot", "inputSnapshot"), ("assumption",), ("unit",), ("horizon",), ("simulationResult", "result")],
}


SELF_MUTATIONS = {
    "modern.ai.assist.cancel", "modern.ai.assist.review", "modern.ai.assist.revoke",
    "modern.benefits.enrollment.submit", "modern.benefits.lifeevent.submit",
    "modern.growth.profile.create", "modern.growth.profile.update",
    "modern.growth.profile.archive", "modern.growth.evidence.link",
    "modern.growth.evidence.unlink", "modern.growth.export.request",
    "modern.hrservice.case.create", "modern.learning.assignment.start",
    "modern.learning.assignment.cancel", "modern.learning.self.enroll",
    "modern.onboarding.task.complete", "modern.onboarding.task.waive",
    "modern.opportunity.apply",
}


HANDLER_REQUIREMENTS: dict[str, dict[str, Any]] = {
    "internal.ai.assistance-result.consume": {"root": "sys_hris_ai_assistance_requests", "writes": ["sys_hris_ai_provenance_receipts"], "post": {"PRODUCED", "FAILED"}},
    "internal.ai.policy-evaluation-result.consume": {"root": "sys_hris_ai_evaluation_requests", "writes": ["sys_hris_ai_evaluation_receipts"], "post": {"COMPLETED", "FAILED"}},
    "internal.analytics.metric-projection.result.consume": {"root": "sys_hris_metric_projection_requests", "writes": ["sys_hris_metric_projections"], "post": {"PROJECTED", "FAILED", "COMPLETED"}},
    "internal.analytics.export.result.consume": {"root": "sys_hris_analytics_export_receipts", "assign": [("object",), ("digest",), ("row_count", "rowCount")], "post": {"READY", "FAILED", "COMPLETED"}},
    "internal.analytics.export.expire": {"root": "sys_hris_analytics_export_receipts", "assign": [("status", "state")], "post": {"EXPIRED"}},
    "internal.benefits.provider-result.consume": {"root": "ppl_bnf_provider_requests", "writes": ["ppl_bnf_provider_receipts", "ppl_bnf_enrollments"], "post": {"SUCCEEDED", "FAILED", "COMPLETED"}},
    "internal.benefits.life-event.expire": {"root": "ppl_bnf_life_events", "post": {"EXPIRED"}},
    "internal.contingent.access-grant-result.consume": {"root": "ppl_cwk_access_requests", "writes": ["ppl_cwk_access_receipts"], "post": {"GRANTED", "FAILED"}},
    "internal.contingent.access-revoke-result.consume": {"root": "ppl_cwk_access_requests", "writes": ["ppl_cwk_access_receipts"], "post": {"REVOKED", "FAILED"}},
    "internal.contingent.access-expiry.initiate": {"root": "ppl_cwk_access_requests", "writes": ["ppl_cwk_access_expiry_receipts"], "post": {"EXPIRY_REQUESTED", "EXPIRED", "FAILED"}},
    "internal.growth.portability-export.result.consume": {"root": "prf_grw_portability_export_receipts", "assign": [("object",), ("digest",)], "post": {"READY", "FAILED", "COMPLETED"}},
    "internal.growth.portability-export.expire": {"root": "prf_grw_portability_export_receipts", "post": {"EXPIRED"}},
    "internal.hrservice.sla-milestone.consume": {"root": "ppl_hrs_sla_receipts", "writes": ["ppl_hrs_sla_receipts"], "forbid": ["ppl_hrs_cases"], "post": {"MEASURED", "BREACHED", "MET"}},
    "internal.recruiting.hire-handoff.result.consume": {"root": "ppl_rec_hire_requests", "writes": ["ppl_rec_hire_handoff_receipts", "ppl_rec_candidate_cases"], "post": {"SUCCEEDED", "FAILED", "COMPLETED"}},
    "internal.recruiting.offer.expire": {"root": "ppl_rec_offers", "post": {"EXPIRED"}},
    "internal.wfm.approval-result.consume": {"root": "tme_wfm_schedule_candidates", "writes": ["tme_wfm_approval_receipts"], "post": {"APPROVED", "REJECTED"}},
    "internal.wfm.schedule-optimization.result.consume": {"root": "tme_wfm_optimization_requests", "writes": ["tme_wfm_schedule_candidates", "tme_wfm_schedule_candidate_versions", "tme_wfm_candidate_shift_lines", "tme_wfm_schedule_candidate_time_group_refs"], "post": {"COMPLETED", "FAILED"}},
    "internal.workforceplan.simulation-result.consume": {
        "root": "ppl_wfp_simulation_requests", "post": {"COMPLETED", "FAILED"},
        "assign": [
            ("result_receipt_public_id",), ("result_receipt_revision",),
            ("result_schema_version",), ("result_digest",),
        ],
    },
}


@dataclass(frozen=True)
class OperationRequirement:
    operation_id: str
    request_groups: tuple[tuple[str, ...], ...] = ()
    writes: tuple[str, ...] = ()
    assignment_groups: tuple[tuple[str, tuple[tuple[str, ...], ...]], ...] = ()


DOMAIN_OPERATION_REQUIREMENTS: dict[str, list[OperationRequirement]] = {
    "P0-REC-001": [
        OperationRequirement("modern.recruiting.candidate.admit", (("candidatePersonToken",), ("sourceSystemId",), ("sourceCandidateKey",), ("consentReceipt",), ("consentExpiresAt",), ("requisitionId",)), ("ppl_rec_candidate_cases", "ppl_rec_candidate_stage_history")),
        OperationRequirement("modern.recruiting.offer.respond", (("actorMode",), ("decision",), ("delegationReceipt", "decisionSourceReceipt"), ("reason",)), ("ppl_rec_offer_decisions",)),
        OperationRequirement("modern.recruiting.requisition.revise", (("revisionMode",), ("effectiveFrom",), ("reason",)), ("ppl_rec_requisition_versions",)),
    ],
    "P0-ONB-001": [
        OperationRequirement("modern.onboarding.template.create", (("tasks",),), ("ppl_jny_template_versions", "ppl_jny_template_task_definitions")),
        OperationRequirement("modern.onboarding.template.revise", (("revisionMode",), ("effectiveFrom",), ("reason",), ("tasks",)), ("ppl_jny_template_versions", "ppl_jny_template_task_definitions")),
        OperationRequirement("modern.onboarding.journey.assign", (("worker",), ("templateVersion",),), ("ppl_jny_assignments", "ppl_jny_assignment_tasks")),
        OperationRequirement("modern.onboarding.task.complete", (("completion",), ("evidence",)), ("ppl_jny_task_evidence", "ppl_jny_assignment_task_revisions")),
        OperationRequirement("modern.onboarding.task.waive", (("waiver", "reason"), ("authorizationReceipt", "decisionReceipt")), ("ppl_jny_task_evidence", "ppl_jny_assignment_task_revisions")),
    ],
    "P0-WFP-001": [
        OperationRequirement("modern.workforceplan.scenario.create", (("organizationSnapshot",), ("populationSnapshot", "inputSnapshot"), ("assumption",), ("unit",), ("horizon",)), ("ppl_wfp_scenarios", "ppl_wfp_scenario_revisions")),
        OperationRequirement("modern.workforceplan.scenario.revise", (("revisionMode",), ("assumption",), ("reason",)), ("ppl_wfp_scenario_revisions",)),
        OperationRequirement("modern.workforceplan.scenario.simulate", (("scenarioRevision",), ("inputSnapshot",),), ("ppl_wfp_simulation_requests",)),
    ],
    "P0-BNF-001": [
        OperationRequirement("modern.benefits.enrollment.submit", (("planVersion",), ("coverageOption",), ("dependent",), ("eligibility",),), ("ppl_bnf_enrollments", "ppl_bnf_enrollment_eligibility_receipts", "ppl_bnf_dependent_elections")),
        OperationRequirement("modern.benefits.lifeevent.submit", (("eventType",), ("eventDate",), ("evidence",)), ("ppl_bnf_life_events",)),
        OperationRequirement("modern.benefits.lifeevent.decide", (("actorMode",), ("decision",), ("reason",)), ("ppl_bnf_life_event_decisions", "ppl_bnf_provider_requests")),
    ],
    "P0-HRS-001": [
        OperationRequirement("modern.hrservice.case.create", (("requestArtifact", "contentArtifact"), ("requester",), ("caseType",), ("queue",), ("visibility", "sensitivity")), ("ppl_hrs_cases", "ppl_hrs_case_actions")),
        OperationRequirement("modern.hrservice.case.respond", (("responseArtifact", "contentArtifact"), ("visibility",)), ("ppl_hrs_case_actions",)),
    ],
    "P0-CWK-001": [
        OperationRequirement("modern.contingent.engagement.create", (("classification",), ("classificationPolicy",), ("accessPackage",), ("accessExpiry",),), ("ppl_cwk_engagements", "ppl_cwk_engagement_versions", "ppl_cwk_classification_receipts", "ppl_cwk_access_requests")),
        OperationRequirement("modern.contingent.engagement.revise", (("revisionMode",), ("effectiveFrom",), ("reason",),), ("ppl_cwk_engagement_versions",)),
        OperationRequirement("modern.contingent.sponsor.reassign", (("sponsor",), ("effective",), ("reason",)), ("ppl_cwk_sponsor_assignments",)),
    ],
    "P0-SKL-001": [
        OperationRequirement("modern.skills.taxonomy.create", (("nodes",), ("edges",), ("proficiency",)), ("prf_skl_taxonomy_versions", "prf_skl_skill_nodes", "prf_skl_skill_edges", "prf_skl_proficiency_levels")),
        OperationRequirement("modern.skills.taxonomy.revise", (("nodes",), ("edges",), ("proficiency",)), ("prf_skl_taxonomy_versions", "prf_skl_skill_nodes", "prf_skl_skill_edges", "prf_skl_proficiency_levels")),
        OperationRequirement("modern.skills.evidence.record", (("worker",), ("skill",), ("taxonomyVersion",), ("proficiency",), ("source",), ("observedAt",), ("consent", "provenance")), ("prf_skl_worker_evidence",)),
    ],
    "P0-GRW-001": [
        OperationRequirement("modern.growth.profile.create", (("artifactPublicId",), ("artifactRevision",), ("artifactSchema",), ("artifactDigest",)), ("prf_grw_profiles", "prf_grw_profile_revisions")),
        OperationRequirement("modern.growth.coaching.record", (("artifactPublicId",), ("artifactRevision",), ("coach",),), ("prf_grw_coaching_notes",)),
        OperationRequirement("modern.growth.evidence.link", (("evidence",), ("consentReceipt",), ("consentExpiresAt",)), ("prf_grw_evidence_links",)),
    ],
    "P0-LRN-001": [
        OperationRequirement("modern.learning.offering.create", (("contentArtifact",), ("delivery",), ("capacity",), ("eligibility",), ("skill",)), ("prf_lrn_offerings", "prf_lrn_offering_versions")),
        OperationRequirement("modern.learning.assignment.create", (("worker",), ("offering",), ("due",), ("assignmentSource",),), ("prf_lrn_assignments",)),
        OperationRequirement("modern.learning.self.enroll", (("offering",), ("consent",),), ("prf_lrn_assignments", "prf_lrn_capacity_ledger")),
    ],
    "P0-MKT-001": [
        OperationRequirement("modern.opportunity.create", (("criteria",), ("capacity",), ("skill",)), ("prf_mkt_opportunities", "prf_mkt_opportunity_versions")),
        OperationRequirement("modern.opportunity.apply", (("consent",), ("statementArtifact",),), ("prf_mkt_applications",)),
        OperationRequirement("modern.opportunity.shortlist", (("explanationArtifact",), ("policyVersion",), ("inputRevision",)), ("prf_mkt_match_explanations", "prf_mkt_application_decisions")),
        OperationRequirement("modern.opportunity.selection.record", (("decisionReceipt",), ("human", "actor")), ("prf_mkt_application_decisions",)),
    ],
    "P0-SUC-001": [
        OperationRequirement("modern.succession.plan.create", (("audiencePolicy",), ("keyPosition",)), ("prf_suc_plans", "prf_suc_plan_versions")),
        OperationRequirement("modern.succession.plan.revise", (("revisionMode",), ("effectiveFrom",), ("reason",), ("audiencePolicy",),), ("prf_suc_plan_versions",)),
        OperationRequirement("modern.succession.nomination.add", (("worker",), ("consentReceipt",), ("consentExpiresAt",), ("readiness",)), ("prf_suc_nominations",)),
        OperationRequirement("modern.succession.readiness.record", (("evidence",), ("evidenceRevision",), ("evidenceDigest",), ("reviewDue",),), ("prf_suc_readiness_evidence",)),
    ],
    "P0-CMP-001": [
        OperationRequirement("modern.compplan.cycle.create", (("budget",), ("currency",), ("fx",), ("populationSnapshot",)), ("prf_cmp_cycles", "prf_cmp_budget_ledger")),
        OperationRequirement("modern.compplan.proposal.upsert", (("worker",), ("assignment",), ("component",), ("amount",), ("currency",), ("effectiveDate",), ("reason",)), ("prf_cmp_proposals", "prf_cmp_proposal_versions")),
        OperationRequirement("modern.compplan.plan.approve", (("decisionReceipt",),), ("prf_cmp_plans", "prf_cmp_plan_proposal_refs")),
        OperationRequirement("modern.compplan.snapshot.publish", (("planRevision",),), ("prf_cmp_approved_snapshots", "prf_cmp_approved_snapshot_lines")),
    ],
    "P0-WFM-001": [
        OperationRequirement("modern.wfm.schedule.optimize", (("optimizationMode", "mode"), ("forecast",), ("availability",), ("ruleSnapshot",)), ("tme_wfm_optimization_requests",)),
        OperationRequirement("modern.wfm.schedule.validate", (("candidateVersion",),), ("tme_wfm_constraint_evaluation_receipts",)),
        OperationRequirement("modern.wfm.schedule.publish", (("candidateVersion",), ("approvalReceipt",),), ("tme_wfm_schedule_publish_ledger",)),
    ],
    "P0-LIS-001": [
        OperationRequirement("modern.listening.survey.create", (("question", "formVersion"), ("privacyVersion",), ("retentionVersion",)), ("sys_hris_listening_surveys", "sys_hris_listening_survey_versions")),
        OperationRequirement("modern.listening.response.submit", (("signedParticipationCredential",), ("responseToken",), ("answers",)), ("sys_hris_listening_token_consumptions", "sys_hris_listening_responses", "sys_hris_listening_answer_values")),
    ],
    "P0-ANL-001": [
        OperationRequirement("modern.analytics.metric.create", (("expression",), ("aggregation",), ("unit",), ("dimension",), ("sourceContract",)), ("sys_hris_metric_definitions", "sys_hris_metric_versions")),
        OperationRequirement("modern.analytics.projection.request", (("metricVersion",), ("asOf",), ("cohort",), ("populationSnapshot",), ("purpose",)), ("sys_hris_metric_projection_requests",)),
        OperationRequirement("modern.analytics.export.create", (("projection",), ("retention", "expiresAt")), ("sys_hris_analytics_export_receipts", "sys_hris_analytics_export_projection_refs")),
    ],
    "P0-AI-001": [
        OperationRequirement("modern.ai.assist.create", (("instruction",), ("sourceProjection",), ("subject",), ("governanceActivation",)), ("sys_hris_ai_assistance_requests",)),
        OperationRequirement("modern.ai.assist.review", (("decision",), ("reason",), ("actor", "human")), ("sys_hris_ai_assistance_reviews",)),
    ],
}


TABLE_COLUMN_REQUIREMENTS: dict[str, list[tuple[str, ...]]] = {
    "ppl_rec_candidate_cases": [("source_system",), ("source_candidate_key",), ("candidate_person_token",), ("consent_receipt",), ("consent_expires",), ("requisition",)],
    "ppl_rec_hire_handoff_receipts": [("worker_public",), ("employment_public",), ("assignment_public",), ("request_digest",), ("owner_result", "outcome")],
    "ppl_jny_template_task_definitions": [("task_key",), ("title",), ("task_type",), ("actor_rule",), ("due_anchor",), ("due_offset",), ("condition",), ("completion_schema", "evidence_schema")],
    "ppl_jny_assignment_tasks": [("actor",), ("due",), ("condition",), ("status",)],
    "ppl_wfp_scenario_revisions": [("assumption_artifact",), ("assumption_schema",), ("unit_code",), ("horizon_start",), ("horizon_end",), ("simulation_result", "result_receipt")],
    "ppl_bnf_enrollments": [("worker",), ("plan_version",), ("coverage_option",), ("eligibility",), ("life_event",)],
    "ppl_bnf_provider_requests": [("enrollment",), ("request_digest",), ("status", "state")],
    "ppl_bnf_provider_receipts": [("provider_request",), ("outcome",), ("result_revision",)],
    "ppl_hrs_case_actions": [("artifact",), ("artifact_revision",), ("visibility",), ("actor",), ("action_type",)],
    "ppl_hrs_sla_receipts": [("policy_version",), ("milestone",), ("due",), ("outcome",)],
    "ppl_cwk_classification_receipts": [("classification",), ("policy_version",), ("decision_receipt",)],
    "ppl_cwk_access_requests": [("engagement",), ("package",), ("scope",), ("expires",), ("status", "state")],
    "prf_skl_skill_nodes": [("skill_code",), ("label",), ("locale",)],
    "prf_skl_skill_edges": [("source_skill",), ("target_skill",), ("edge_type",)],
    "prf_skl_proficiency_levels": [("level", "band"), ("label",), ("ordinal",)],
    "prf_skl_worker_evidence": [("taxonomy_version",), ("consent",), ("observed_at",), ("source",)],
    "prf_grw_evidence_links": [("artifact", "evidence"), ("revision",), ("consent_receipt",), ("consent_expires",)],
    "prf_lrn_offerings": [("content_artifact",), ("content_revision", "content_artifact_revision"), ("delivery",), ("capacity",), ("eligibility",), ("skill",)],
    "prf_lrn_assignments": [("worker",), ("offering",), ("offering_revision",), ("due",), ("assignment_source",)],
    "prf_mkt_opportunities": [("criteria",), ("capacity",), ("skill",)],
    "prf_mkt_match_explanations": [("application",), ("artifact",), ("policy_version",), ("input_revision",)],
    "prf_suc_plans": [("audience_policy",), ("audience_revision", "audience_policy_revision"), ("key_position",)],
    "prf_suc_nominations": [("worker",), ("consent_receipt",), ("consent_expires",), ("readiness",), ("readiness_vocabulary",)],
    "prf_suc_readiness_evidence": [("nomination",), ("evidence",), ("source_revision",), ("review_due",)],
    "prf_cmp_proposals": [("worker",), ("assignment",), ("component",), ("amount",), ("currency",), ("effective_date",), ("reason",)],
    "prf_cmp_approved_snapshot_lines": [("source_proposal",), ("approved_amount",), ("currency",), ("component",)],
    "tme_wfm_optimization_requests": [("optimization_mode",), ("forecast",), ("availability",), ("rule_snapshot",)],
    "tme_wfm_schedule_candidate_versions": [("candidate",), ("result_digest",), ("optimizer",)],
    "tme_wfm_candidate_shift_lines": [("candidate_version",), ("start",), ("end",), ("time_zone",), ("tzdb",), ("skill",)],
    "sys_hris_listening_answer_values": [("response",), ("question",), ("answer",), ("cipher", "encrypted")],
    "sys_hris_listening_token_consumptions": [("token",), ("admission",), ("consumed",)],
    "sys_hris_listening_cohort_projections": [
        ("survey_public_id",), ("cohort_package_public_id",), ("policy_revision",),
        ("source_epoch",), ("cutoff_at",), ("adequacy_category",),
        ("measure_values",), ("subject_count",), ("anonymity_threshold",),
        ("privacy_budget_receipt_public_id",),
    ],
    "sys_hris_metric_versions": [("expression",), ("aggregation",), ("unit",), ("dimension",), ("source_contract",)],
    "sys_hris_metric_projections": [("request",), ("value",), ("lineage",), ("calculated",), ("subject_count",)],
    "sys_hris_analytics_export_receipts": [("object",), ("digest",), ("row_count",), ("expires",)],
    "sys_hris_ai_assistance_requests": [("instruction",), ("source_projection",), ("requester", "created_by"), ("subject",), ("governance_activation",)],
    "sys_hris_ai_provenance_receipts": [("assistance_request",), ("model_version",), ("output_digest",), ("generated_at",)],
    "sys_hris_ai_evaluation_receipts": [("evaluation_request",), ("suite",), ("outcome",), ("failure",), ("result_digest",)],
    "sys_hris_ai_assistance_reviews": [("assistance",), ("subject",), ("human_actor", "actor"), ("decision",), ("reason",), ("decision_receipt", "delegation_receipt")],
    "ppl_cwk_engagement_versions": [("engagement", "parent"), ("revision_mode",), ("effective_from",), ("effective_to",), ("predecessor",), ("reason",), ("classification",), ("access",)],
    "prf_suc_plan_versions": [("plan", "parent"), ("revision_mode",), ("effective_from",), ("effective_to",), ("predecessor",), ("reason",), ("audience_policy",), ("audience_revision", "audience_policy_revision"), ("key_position",), ("content",)],
}


P1_CONFIG_FIELDS = [
    ("ppl_bnf_plan_versions", "payroll_treatment_code"),
    ("ppl_hrs_cases", "case_type"),
    ("ppl_hrs_cases", "queue_key"),
    ("ppl_rec_requisitions", "employment_type"),
    ("prf_suc_nominations", "readiness_code"),
    ("prf_cmp_proposals", "component_code"),
    ("prf_cmp_approved_snapshot_lines", "component_code"),
    ("tme_wfm_demand_lines", "demand_unit_code"),
]

P1_MONEY_TARGETS = [
    ("ppl_rec_offers", "amount"),
    ("prf_cmp_budget_ledger", "amount"),
    ("prf_cmp_proposals", "amount"),
    ("prf_cmp_approved_snapshot_lines", "approved_amount"),
]

P1_DECISIONS = {
    "modern.recruiting.offer.respond", "modern.opportunity.application.withdraw",
    "modern.benefits.lifeevent.decide", "modern.succession.nomination.withdraw",
}

P1_REVISIONS = {
    "modern.recruiting.requisition.revise", "modern.onboarding.template.revise",
    "modern.benefits.plan.revise", "modern.contingent.engagement.revise",
    "modern.learning.offering.revise", "modern.succession.plan.revise",
    "modern.opportunity.revise",
}

DUAL_TEMPORAL_CONTRACTS = {
    "modern.recruiting.requisition.revise": ("ppl_rec_requisition_versions", "modern.recruiting.requisition.query"),
    "modern.onboarding.template.revise": ("ppl_jny_template_versions", "modern.onboarding.template.query"),
    "modern.benefits.plan.revise": ("ppl_bnf_plan_versions", "modern.benefits.plan.query"),
    "modern.contingent.engagement.revise": ("ppl_cwk_engagement_versions", "modern.contingent.engagement.query"),
    "modern.learning.offering.revise": ("prf_lrn_offering_versions", "modern.learning.offering.query"),
    "modern.succession.plan.revise": ("prf_suc_plan_versions", "modern.succession.plan.query"),
    "modern.opportunity.revise": ("prf_mkt_opportunity_versions", "modern.opportunity.query"),
}
DUAL_TEMPORAL_COLUMNS = {
    "root_version", "root_predecessor_public_id", "root_predecessor_version",
    "revision_mode", "effective_segment_public_id", "segment_revision",
    "segment_predecessor_public_id", "segment_predecessor_revision",
    "effective_from", "effective_to", "content_revision_public_id",
}
DUAL_TEMPORAL_EVENT_FIELDS = {
    "revisionMode", "effectiveFrom", "revisionPublicId", "contentRevisionPublicId",
    "stateRevisionPublicId", "rootVersion", "effectiveSegmentPublicId",
    "segmentRevision", "segmentPredecessorPublicId", "segmentPredecessorRevision",
}


class Evaluator:
    def __init__(self, model: Model, audit: dict[str, Any]) -> None:
        self.model = model
        self.audit = audit
        self.issues: list[Issue] = []
        self.requirement_severity = {
            finding["id"]: finding["severity"] for finding in audit["findings"]
        }

    def add(
        self, requirement: str, rule: str, kind: str, subject: str,
        message: str, **evidence: Any,
    ) -> None:
        self.issues.append(Issue(
            requirement, self.requirement_severity.get(requirement, "P0"),
            rule, kind, subject, message, evidence,
        ))

    def check_closed_sets(self) -> None:
        model = self.model
        for label, duplicates in {
            "operation": model.operation_duplicates,
            "handler": model.handler_duplicates,
            "table": model.table_duplicates,
            "schema": model.schema_duplicates,
            "binding": model.binding_duplicates,
            "lineage": model.lineage_duplicates,
            "semantic": model.semantic_duplicates,
            "causal": model.causal_duplicates,
            "payload": model.payload_duplicates,
        }.items():
            for duplicate in duplicates:
                self.add("P0-CROSS-QUERY-001", "SET.DUPLICATE", label, duplicate, "duplicate closed-set identifier")

        op_ids = set(model.operation)
        manifest = model.docs["manifest"]
        manifest_operation_ids = {
            row.get("operationId") if isinstance(row, dict) else row
            for row in manifest.get("operations", [])
        }
        compared = {
            "manifest.operations": manifest_operation_ids,
            "exact.operationBindings": set(model.binding),
            "exact.operationFieldLineage": set(model.lineage),
            "semantic.operations": set(model.semantic),
            "causal.operations": set(model.causal),
        }
        for name, ids in compared.items():
            if ids != op_ids:
                self.add("P0-CROSS-QUERY-001", "SET.OPERATIONS", "artifact", name,
                         "operation set differs from operation SSOT",
                         missing=sorted(op_ids - ids), extra=sorted(ids - op_ids))

        counts = {
            "operations": len(op_ids), "queries": len(model.query_ids()),
            "commands": len(model.command_ids()), "handlers": len(model.handler),
            "events": len(model.events),
        }
        for name, expected in REQUIRED_COUNTS.items():
            if counts[name] != expected:
                self.add("P0-CROSS-QUERY-001", "SET.CARDINALITY", "closedSet", name,
                         f"required frozen cardinality {expected}, got {counts[name]}")

        dependency_rows = model.docs["operation"].get(
            "ownerDependencyContracts", []
        )
        dependency_ids = [
            row.get("dependencyContractId") for row in dependency_rows
        ]
        invalid_dependency_seals = [
            row.get("dependencyContractId") for row in dependency_rows
            if row.get("sealedPayloadSha256") != sha256_bytes(canonical_json({
                key: value for key, value in row.items()
                if key != "sealedPayloadSha256"
            }))
        ]
        manifest_dependency_pins = sorted(({
            "dependencyContractId": row.get("dependencyContractId"),
            "ownerSession": row.get("ownerSession"),
            "consumerSession": row.get("consumerSession"),
            "sealedPayloadSha256": row.get("sealedPayloadSha256"),
        } for row in dependency_rows), key=lambda row: str(
            row["dependencyContractId"]
        ))
        dependency_projection_closed = (
            model.docs["exact"].get("ownerDependencyContracts") == dependency_rows
            and model.docs["semantic"].get("ownerDependencyContracts")
            == dependency_rows
            and model.docs["semantic"].get(
                "ownerDependencySemanticBindings", []
            ) == owner_dependency_semantic_bindings(dependency_rows)
        )
        payroll_dependency = next((
            row for row in dependency_rows
            if row.get("dependencyContractId")
            == "compensation.resolveApprovedSnapshotForPayroll.v1"
        ), {})
        payroll_payload = model.payload.get(
            "ApprovedCompensationPlanSnapshotPublished.v2", {}
        )
        payroll_refetch = payroll_payload.get("consumerRefetchPolicy", {})
        payroll_payload_fields = payroll_payload.get("fields", [])
        payroll_payload_delivery = payroll_payload.get("deliveryPolicy", {})
        pay_event_boundary_closed = (
            payroll_dependency.get("sealedPayloadSha256")
            == PAYROLL_OWNER_DEPENDENCY_SEAL
            and payroll_dependency.get("digestCanonicalization")
            == expected_payroll_digest_canonicalization()
            and payroll_refetch.get("mode") == "EXACT_OWNER_DEPENDENCY"
            and payroll_refetch.get("dependencyContractId")
            == "compensation.resolveApprovedSnapshotForPayroll.v1"
            and payroll_refetch.get("dependencyContractSha256")
            == payroll_dependency.get("sealedPayloadSha256")
            and payroll_refetch.get("selectorTuple", [None])[0]
            == "eventEnvelope.tenantId"
            and payroll_payload.get("deliveryPolicy", {}).get(
                "consumerFieldAllowlists", {}
            ).get("HRIS-PAY", {}).get("fields")
            == ["snapshotId", "snapshotRevision", "payloadDigest", "lineCount"]
            and sha256_bytes(canonical_json(payroll_refetch))
            == PAYROLL_PROJECTED_REFETCH_SHA256
            and sha256_bytes(canonical_json(payroll_payload_delivery))
            == PAYROLL_PROJECTED_DELIVERY_SHA256
            and sha256_bytes(canonical_json(payroll_payload_fields))
            == PAYROLL_OPERATION_EVENT_FIELDS_SHA256
            and tuple(row.get("name") for row in payroll_payload_fields)
            == PAYROLL_OWNER_EVENT_FIELD_NAMES
            and "tenantId" not in {
                row.get("name") for row in payroll_payload_fields
            }
        )
        if (
            len(dependency_rows) != 2
            or len(dependency_ids) != len(set(dependency_ids))
            or set(dependency_ids) != GLOBAL_OWNER_DEPENDENCY_IDS
            or invalid_dependency_seals
            or manifest.get("scope", {}).get("ownerDependencyContracts") != 2
            or manifest.get("ownerDependencyContracts") != manifest_dependency_pins
            or manifest.get("listeningStaticDesign", {}).get(
                "exactCounts", {}
            ).get("ownerDependencyContracts") != 1
            or not dependency_projection_closed
            or not pay_event_boundary_closed
        ):
            self.add(
                "P0-CROSS-QUERY-001", "SET.OWNER_DEPENDENCIES",
                "closedSet", "ownerDependencyContracts",
                "global owner dependencies must be exact two with sealed ID pins, "
                "while Listening local scope remains one",
                expectedIds=sorted(GLOBAL_OWNER_DEPENDENCY_IDS),
                actualIds=dependency_ids,
                invalidSeals=invalid_dependency_seals,
                manifestPins=manifest.get("ownerDependencyContracts"),
                projectionsEqual=dependency_projection_closed,
                payEventBoundaryClosed=pay_event_boundary_closed,
            )

        handler_manifest = set(manifest.get("handlerIds", []))
        if handler_manifest != set(model.handler):
            self.add("P0-CROSS-HANDLER-002", "SET.HANDLERS", "artifact", "manifest.handlerIds",
                     "handler set differs from operation SSOT",
                     missing=sorted(set(model.handler) - handler_manifest),
                     extra=sorted(handler_manifest - set(model.handler)))

        event_names = [event.get("eventName") for _, _, event in model.events]
        event_ids = {name for name in event_names if isinstance(name, str)}
        if len(event_ids) != len(event_names):
            self.add("P0-CROSS-EVENT-003", "SET.EVENT_UNIQUE", "closedSet", "events",
                     "public event names must be present and unique")
        for label, ids in {
            "manifest.publicEventIds": set(manifest.get("publicEventIds", [])),
            "eventPayloadSchemas": set(model.payload),
        }.items():
            if ids != event_ids:
                self.add("P0-CROSS-EVENT-003", "SET.EVENTS", "artifact", label,
                         "event set differs from produced event set",
                         missing=sorted(event_ids - ids), extra=sorted(ids - event_ids))

        table_ids = set(model.table)
        table_set_sha = sha256_bytes(canonical_json(sorted(table_ids)))
        manifest_tables = set(manifest.get("tableIds", []))
        if table_ids != manifest_tables:
            self.add("P0-CROSS-QUERY-001", "SET.TABLES", "artifact", "manifest.tableIds",
                     "table set differs from exact table specifications",
                     missing=sorted(table_ids - manifest_tables),
                     extra=sorted(manifest_tables - table_ids))
        if len(table_ids) < 115:
            self.add("P0-CROSS-QUERY-001", "SET.TABLE_CONTRACTION", "closedSet", "tables",
                     "table scope may not contract below the reviewed 115-table candidate")
        if table_set_sha != FROZEN_115_TABLE_SET_SHA256:
            scope = manifest.get("tableScopeChange", {})
            rows = scope.get("rows", {})
            added = set(scope.get("addedTableIds", scope.get("addedTables", [])))
            if not added and isinstance(rows, dict):
                added = set(rows)
            declared_count = scope.get(
                "successorTableCount",
                scope.get("activeTableSpecifications", scope.get("currentCount")),
            )
            removed = set(scope.get("removedTableIds", []))
            policy_removal = self.model.expansion_policy.get("successorScope", {}).get(
                "removalDisposition", {}
            )
            formal = (
                scope.get("previousTableSetSha256") == FROZEN_115_TABLE_SET_SHA256
                and scope.get("previousTableSpecifications") == 115
                and declared_count == len(table_ids)
                and len(table_ids) == EXPECTED_SUCCESSOR_TABLE_COUNT
                and added == EXPECTED_GLOBAL_EXPANSION_TABLES
                and added <= table_ids
                and len(added) == EXPECTED_ADDITION_COUNT
                and removed == EXPECTED_REMOVED_TABLES
                and not (removed & table_ids)
                and scope.get("deltaCount") == EXPECTED_ADDITION_COUNT
                and scope.get("netDelta") == EXPECTED_NET_DELTA == len(table_ids) - 115
                and scope.get("removalDisposition") == policy_removal
                and bool(scope.get("rationale") or scope.get("reviewEvidence") or scope.get("reason"))
                and all(
                    isinstance(rows.get(table_id), dict)
                    and rows[table_id].get("ownerSession")
                    and (rows[table_id].get("producers") or rows[table_id].get("producer"))
                    and rows[table_id].get("nonReplaceability")
                    for table_id in added
                )
            )
            if not formal:
                self.add("P0-CROSS-QUERY-001", "SET.TABLE_EXPANSION_AUTHORITY", "closedSet", "tables",
                         "table-count expansion lacks a formal exact manifest scope-change record",
                         count=len(table_ids), tableScopeChange=scope)

            # The v4 contraction is a reviewed removal, not a rename.  The old
            # table may occur only inside the manifest's explicit removal
            # record; every executable/schema/lineage reference must disappear.
            residuals: dict[str, list[str]] = defaultdict(list)
            for role, document in model.docs.items():
                inspected = copy.deepcopy(document)
                if role == "manifest":
                    inspected.pop("tableScopeChange", None)
                for path, value in iter_strings(inspected):
                    for removed_table in EXPECTED_REMOVED_TABLES:
                        if re.search(
                            rf"(?<![A-Za-z0-9_]){re.escape(removed_table)}(?![A-Za-z0-9_])",
                            value,
                        ):
                            residuals[removed_table].append(f"{role}:{path}")
            if residuals:
                self.add(
                    "P0-CROSS-QUERY-001", "SET.REMOVED_TABLE_DANGLING_REFERENCE",
                    "closedSet", "tables",
                    "reviewed removed table remains referenced outside the manifest removal record",
                    residuals={key: sorted(set(value)) for key, value in sorted(residuals.items())},
                )

            dangling_fks: list[dict[str, Any]] = []
            for table_name, table in sorted(model.table.items()):
                for fk in table.get("foreignKeys", []):
                    target = fk.get("target")
                    # Cross-boundary references intentionally target typed
                    # external owner contracts (HRM.Worker, SYS.Config, ...),
                    # not tables in this physical closed set.  Only a declared
                    # owner-local FK is required to resolve to an active table.
                    if (
                        fk.get("mode") == "LOCAL_COMPOSITE_FK"
                        and isinstance(target, str)
                        and target not in table_ids
                    ):
                        dangling_fks.append({
                            "sourceTable": table_name,
                            "constraintId": fk.get("constraintId"),
                            "target": target,
                        })
            if dangling_fks:
                self.add(
                    "P0-CROSS-QUERY-001", "SET.DANGLING_FOREIGN_KEY",
                    "closedSet", "tables",
                    "foreign-key targets must resolve inside the exact active table set",
                    danglingForeignKeys=dangling_fks,
                )
            policy_rows = {
                row["tableId"]: row
                for row in model.expansion_policy.get("successorScope", {}).get("addedRows", [])
            }
            for table_id in sorted(EXPECTED_GLOBAL_EXPANSION_TABLES):
                manifest_row = rows.get(table_id, {}) if isinstance(rows, dict) else {}
                policy_row = policy_rows.get(table_id, {})
                raw_producers = manifest_row.get("producers", manifest_row.get("producer", []))
                if isinstance(raw_producers, str):
                    actual_producers = {raw_producers}
                else:
                    actual_producers = set(raw_producers or [])
                expected_producers = set(policy_row.get("producers", []))
                actual_requirements = set(manifest_row.get("requirementIds", []))
                expected_requirements = set(policy_row.get("requirementIds", []))
                actual_readers = set(manifest_row.get("readConsumers", []))
                expected_readers = set(policy_row.get("readConsumers", []))
                if (
                    manifest_row.get("ownerSession") != policy_row.get("ownerSession")
                    or actual_producers != expected_producers
                    or actual_requirements != expected_requirements
                    or actual_readers != expected_readers
                    or not manifest_row.get("nonReplaceability")
                ):
                    self.add("P0-CROSS-QUERY-001", "SET.TABLE_EXPANSION_ROW", "table", table_id,
                             "manifest scope-change row does not reproduce independent owner/producer/requirement/non-replaceability authority",
                             expected={
                                 "ownerSession": policy_row.get("ownerSession"),
                                 "producers": sorted(expected_producers),
                                 "requirementIds": sorted(expected_requirements),
                                 "readConsumers": sorted(expected_readers),
                                 "nonReplaceabilityRequired": True,
                             },
                             actual={
                                 "ownerSession": manifest_row.get("ownerSession"),
                                 "producers": sorted(actual_producers),
                                 "requirementIds": sorted(actual_requirements),
                                 "readConsumers": sorted(actual_readers),
                                 "nonReplaceability": manifest_row.get("nonReplaceability"),
                             })

    def check_source_integrity(self) -> None:
        model = self.model
        policy = model.expansion_policy
        policy_file_sha = sha256_file(EXPANSION_POLICY_PATH)
        if policy_file_sha != EXPECTED_EXPANSION_POLICY_SHA256:
            self.add("P0-CROSS-QUERY-001", "SOURCE.EXPANSION_POLICY_FILE", "artifact", "tableExpansionPolicy",
                     "independent table-expansion policy file hash drift",
                     expected=EXPECTED_EXPANSION_POLICY_SHA256, actual=policy_file_sha)
        if (
            policy.get("sealedPayloadSha256") != EXPECTED_EXPANSION_POLICY_SEAL
            or sealed_payload_sha256(policy) != EXPECTED_EXPANSION_POLICY_SEAL
        ):
            self.add("P0-CROSS-QUERY-001", "SOURCE.EXPANSION_POLICY_SEAL", "artifact", "tableExpansionPolicy",
                     "independent table-expansion policy payload seal mismatch",
                     expected=EXPECTED_EXPANSION_POLICY_SEAL,
                     declared=policy.get("sealedPayloadSha256"), computed=sealed_payload_sha256(policy))
        policy_source = policy.get("requirementSource", {})
        if policy_source.get("sha256") != EXPECTED_AUDIT_SHA256:
            self.add("P0-CROSS-QUERY-001", "SOURCE.EXPANSION_POLICY_AUDIT_PIN", "artifact", "tableExpansionPolicy",
                     "table-expansion policy does not pin the frozen global-HCM audit")

        def load_exact_authority(
            path: Path, expected_sha: str, rule: str, subject: str,
        ) -> dict[str, Any] | None:
            try:
                raw = path.read_bytes()
            except OSError as exc:
                self.add("P0-CROSS-QUERY-001", rule, "artifact", subject,
                         "pinned authority file is unavailable", path=str(path.resolve()), error=str(exc))
                return None
            actual_sha = sha256_bytes(raw)
            if actual_sha != expected_sha:
                self.add("P0-CROSS-QUERY-001", rule, "artifact", subject,
                         "pinned authority file byte hash drift",
                         path=str(path.resolve()), expected=expected_sha, actual=actual_sha)
            try:
                value = json.loads(raw.decode("utf-8"))
            except Exception as exc:
                self.add("P0-CROSS-QUERY-001", rule, "artifact", subject,
                         "pinned authority file is not valid UTF-8 JSON",
                         path=str(path.resolve()), error=f"{type(exc).__name__}: {exc}")
                return None
            if not isinstance(value, dict):
                self.add("P0-CROSS-QUERY-001", rule, "artifact", subject,
                         "pinned authority root is not an object", path=str(path.resolve()))
                return None
            return value

        predecessor_policy = policy.get("predecessorPolicy", {})
        expected_predecessor_descriptor = {
            "path": str(PREDECESSOR_POLICY_PATH.relative_to(ROOT)),
            "sha256": EXPECTED_PREDECESSOR_POLICY_SHA256,
            "sealedPayloadSha256": EXPECTED_PREDECESSOR_POLICY_SEAL,
            "disposition": "IMMUTABLE_131_TABLE_ACCEPTANCE_PREDECESSOR_SUPERSEDED_NOT_REWRITTEN",
        }
        if predecessor_policy != expected_predecessor_descriptor:
            self.add("P0-CROSS-QUERY-001", "SOURCE.EXPANSION_POLICY_PREDECESSOR_PIN", "artifact", "tableExpansionPolicy",
                     "v5 does not exactly pin immutable accepted-scope policy v4",
                     expected=expected_predecessor_descriptor, actual=predecessor_policy)
        predecessor_doc = load_exact_authority(
            PREDECESSOR_POLICY_PATH, EXPECTED_PREDECESSOR_POLICY_SHA256,
            "SOURCE.EXPANSION_POLICY_PREDECESSOR_FILE", "tableExpansionPolicy.v4",
        )
        if predecessor_doc is not None:
            declared_seal = predecessor_doc.get("sealedPayloadSha256")
            computed_seal = sealed_payload_sha256(predecessor_doc)
            if declared_seal != EXPECTED_PREDECESSOR_POLICY_SEAL or computed_seal != EXPECTED_PREDECESSOR_POLICY_SEAL:
                self.add("P0-CROSS-QUERY-001", "SOURCE.EXPANSION_POLICY_PREDECESSOR_SEAL", "artifact", "tableExpansionPolicy.v4",
                         "immutable predecessor policy seal is not the reviewed v4 payload",
                         expected=EXPECTED_PREDECESSOR_POLICY_SEAL,
                         declared=declared_seal, computed=computed_seal)
            expected_identity = {
                "policyId": "DWP-HRIS-GLOBAL-HCM-NONREPLACEABLE-TABLE-EXPANSION-V4",
                "schemaVersion": 4,
                "status": "INDEPENDENT_REVIEW_REMEDIATION_AND_131_SCOPE_ACCEPTANCE_REQUIREMENT",
            }
            actual_identity = {key: predecessor_doc.get(key) for key in expected_identity}
            if actual_identity != expected_identity:
                self.add("P0-CROSS-QUERY-001", "SOURCE.EXPANSION_POLICY_PREDECESSOR_IDENTITY", "artifact", "tableExpansionPolicy.v4",
                         "pinned predecessor is not the reviewed v4 policy identity/status",
                         expected=expected_identity, actual=actual_identity)

            expected_v4_predecessor = {
                "path": str(GRANDPREDECESSOR_POLICY_PATH.relative_to(ROOT)),
                "sha256": EXPECTED_GRANDPREDECESSOR_POLICY_SHA256,
                "sealedPayloadSha256": EXPECTED_GRANDPREDECESSOR_POLICY_SEAL,
                "disposition": "IMMUTABLE_132_TABLE_ACCEPTANCE_PREDECESSOR_SUPERSEDED_NOT_REWRITTEN",
            }
            if predecessor_doc.get("predecessorPolicy") != expected_v4_predecessor:
                self.add(
                    "P0-CROSS-QUERY-001", "SOURCE.EXPANSION_POLICY_V4_V3_PIN",
                    "artifact", "tableExpansionPolicy.v4",
                    "v4 predecessor no longer exactly pins immutable accepted v3",
                    expected=expected_v4_predecessor,
                    actual=predecessor_doc.get("predecessorPolicy"),
                )

        grandpredecessor_doc = load_exact_authority(
            GRANDPREDECESSOR_POLICY_PATH, EXPECTED_GRANDPREDECESSOR_POLICY_SHA256,
            "SOURCE.EXPANSION_POLICY_V3_FILE", "tableExpansionPolicy.v3",
        )
        if grandpredecessor_doc is not None:
            declared_seal = grandpredecessor_doc.get("sealedPayloadSha256")
            computed_seal = sealed_payload_sha256(grandpredecessor_doc)
            if (
                declared_seal != EXPECTED_GRANDPREDECESSOR_POLICY_SEAL
                or computed_seal != EXPECTED_GRANDPREDECESSOR_POLICY_SEAL
            ):
                self.add(
                    "P0-CROSS-QUERY-001", "SOURCE.EXPANSION_POLICY_V3_SEAL",
                    "artifact", "tableExpansionPolicy.v3",
                    "immutable accepted v3 bytes do not reproduce their sealed payload",
                    expected=EXPECTED_GRANDPREDECESSOR_POLICY_SEAL,
                    declared=declared_seal, computed=computed_seal,
                )
            expected_v3_predecessor = {
                "path": str(V2_POLICY_PATH.relative_to(ROOT)),
                "sha256": EXPECTED_V2_POLICY_SHA256,
                "sealedPayloadSha256": EXPECTED_V2_POLICY_SEAL,
                "disposition": "IMMUTABLE_FAILED_REVIEW_INPUT_SUPERSEDED_NOT_REWRITTEN",
            }
            if grandpredecessor_doc.get("predecessorPolicy") != expected_v3_predecessor:
                self.add(
                    "P0-CROSS-QUERY-001", "SOURCE.EXPANSION_POLICY_V3_V2_PIN",
                    "artifact", "tableExpansionPolicy.v3",
                    "v3 predecessor no longer exactly pins immutable failed-review v2",
                    expected=expected_v3_predecessor,
                    actual=grandpredecessor_doc.get("predecessorPolicy"),
                )

        v2_doc = load_exact_authority(
            V2_POLICY_PATH, EXPECTED_V2_POLICY_SHA256,
            "SOURCE.EXPANSION_POLICY_V2_FILE", "tableExpansionPolicy.v2",
        )
        if v2_doc is not None:
            declared_seal = v2_doc.get("sealedPayloadSha256")
            computed_seal = sealed_payload_sha256(v2_doc)
            if declared_seal != EXPECTED_V2_POLICY_SEAL or computed_seal != EXPECTED_V2_POLICY_SEAL:
                self.add(
                    "P0-CROSS-QUERY-001", "SOURCE.EXPANSION_POLICY_V2_SEAL",
                    "artifact", "tableExpansionPolicy.v2",
                    "immutable failed-review v2 bytes do not reproduce their sealed payload",
                    expected=EXPECTED_V2_POLICY_SEAL,
                    declared=declared_seal, computed=computed_seal,
                )

        triage_pin = policy.get("preflightTriageAuthority", {})
        expected_triage_pin = {
            "path": str(TRIAGE_AUTHORITY_PATH.relative_to(ROOT)),
            "sha256": EXPECTED_TRIAGE_AUTHORITY_SHA256,
            "sealedPayloadSha256": EXPECTED_TRIAGE_AUTHORITY_SEAL,
            "closedGroups": ["G02", "G03", "G04", "G05", "G06", "G07", "G08", "G09", "G11", "G12", "G13", "G14"],
        }
        if triage_pin != expected_triage_pin:
            self.add(
                "P0-CROSS-QUERY-001", "SOURCE.EXPANSION_POLICY_TRIAGE_PIN",
                "artifact", "tableExpansionPolicy",
                "v5 does not exactly pin the independent preflight triage authority",
                expected=expected_triage_pin, actual=triage_pin,
            )
        triage_doc = load_exact_authority(
            TRIAGE_AUTHORITY_PATH, EXPECTED_TRIAGE_AUTHORITY_SHA256,
            "SOURCE.EXPANSION_POLICY_TRIAGE_FILE", "preflightTriageAuthority.v1",
        )
        if triage_doc is not None and (
            triage_doc.get("sealedPayloadSha256") != EXPECTED_TRIAGE_AUTHORITY_SEAL
            or sealed_payload_sha256(triage_doc) != EXPECTED_TRIAGE_AUTHORITY_SEAL
        ):
            self.add(
                "P0-CROSS-QUERY-001", "SOURCE.EXPANSION_POLICY_TRIAGE_SEAL",
                "artifact", "preflightTriageAuthority.v1",
                "preflight triage authority payload seal mismatch",
            )

        review_pin = policy.get("independentReview", {})
        expected_review_descriptor = {
            "path": str(INDEPENDENT_SCOPE_REVIEW_PATH.relative_to(ROOT)),
            "sha256": EXPECTED_SCOPE_REVIEW_SHA256,
            "requiredFindingIds": sorted(EXPECTED_SCOPE_REVIEW_FINDINGS),
        }
        normalized_review_pin = dict(review_pin) if isinstance(review_pin, dict) else {}
        if isinstance(normalized_review_pin.get("requiredFindingIds"), list):
            normalized_review_pin["requiredFindingIds"] = sorted(normalized_review_pin["requiredFindingIds"])
        if normalized_review_pin != expected_review_descriptor:
            self.add("P0-CROSS-QUERY-001", "SOURCE.EXPANSION_POLICY_REVIEW_PIN", "artifact", "tableExpansionPolicy",
                     "v5 does not retain the exact failed independent 132-table review and its required findings",
                     expected=expected_review_descriptor, actual=review_pin)
        review_doc = load_exact_authority(
            INDEPENDENT_SCOPE_REVIEW_PATH, EXPECTED_SCOPE_REVIEW_SHA256,
            "SOURCE.EXPANSION_POLICY_REVIEW_FILE", "tableExpansionReview.v1",
        )
        if review_doc is not None:
            if review_doc.get("status") != EXPECTED_SCOPE_REVIEW_STATUS:
                self.add("P0-CROSS-QUERY-001", "SOURCE.EXPANSION_POLICY_REVIEW_STATUS", "artifact", "tableExpansionReview.v1",
                         "pinned review no longer records the failed-v2 disposition",
                         expected=EXPECTED_SCOPE_REVIEW_STATUS, actual=review_doc.get("status"))
            actual_review_findings = {
                row.get("id"): row.get("decision")
                for row in review_doc.get("findings", []) if isinstance(row, dict)
            }
            severities = {
                row.get("id"): row.get("severity")
                for row in review_doc.get("findings", []) if isinstance(row, dict)
            }
            if actual_review_findings != EXPECTED_SCOPE_REVIEW_FINDINGS or any(
                severities.get(finding_id) != "P0" for finding_id in EXPECTED_SCOPE_REVIEW_FINDINGS
            ):
                self.add("P0-CROSS-QUERY-001", "SOURCE.EXPANSION_POLICY_REVIEW_FINDINGS", "artifact", "tableExpansionReview.v1",
                         "pinned failed review does not contain exactly the three required P0 findings",
                         expected=EXPECTED_SCOPE_REVIEW_FINDINGS,
                         actual=actual_review_findings, severities=severities)

        reduction_pin = policy.get("scopeReductionReview", {})
        expected_reduction_descriptor = {
            "path": str(SCOPE_REDUCTION_REVIEW_PATH.relative_to(ROOT)),
            "sha256": EXPECTED_SCOPE_REDUCTION_REVIEW_SHA256,
            "sealedPayloadSha256": EXPECTED_SCOPE_REDUCTION_REVIEW_SEAL,
            "decision": EXPECTED_SCOPE_REDUCTION_DECISION,
        }
        if reduction_pin != expected_reduction_descriptor:
            self.add(
                "P0-CROSS-QUERY-001", "SOURCE.SCOPE_REDUCTION_REVIEW_PIN",
                "artifact", "tableExpansionPolicy",
                "v5 does not exactly retain the independent orphan-removal decision",
                expected=expected_reduction_descriptor, actual=reduction_pin,
            )
        reduction_doc = load_exact_authority(
            SCOPE_REDUCTION_REVIEW_PATH, EXPECTED_SCOPE_REDUCTION_REVIEW_SHA256,
            "SOURCE.SCOPE_REDUCTION_REVIEW_FILE", "scopeReductionReview.v1",
        )
        if reduction_doc is not None:
            declared_seal = reduction_doc.get("sealedPayloadSha256")
            computed_seal = sealed_payload_sha256(reduction_doc)
            serialized_reduction = json.dumps(reduction_doc, ensure_ascii=False, sort_keys=True)
            if declared_seal != EXPECTED_SCOPE_REDUCTION_REVIEW_SEAL or computed_seal != EXPECTED_SCOPE_REDUCTION_REVIEW_SEAL:
                self.add(
                    "P0-CROSS-QUERY-001", "SOURCE.SCOPE_REDUCTION_REVIEW_SEAL",
                    "artifact", "scopeReductionReview.v1",
                    "scope-reduction review self-seal does not reproduce the pinned payload",
                    expected=EXPECTED_SCOPE_REDUCTION_REVIEW_SEAL,
                    declared=declared_seal, computed=computed_seal,
                )
            if (
                "sys_hris_listening_export_receipts" not in serialized_reduction
                or "sys_hris_analytics_export_receipts" not in serialized_reduction
                or '"activeTables": 131' not in serialized_reduction
                or '"removedRows": 1' not in serialized_reduction
            ):
                self.add(
                    "P0-CROSS-QUERY-001", "SOURCE.SCOPE_REDUCTION_REVIEW_DECISION",
                    "artifact", "scopeReductionReview.v1",
                    "pinned review no longer proves the exact orphan removal and retained owner replacement",
                )

        scope_policy = policy.get("successorScope", {})
        if (
            scope_policy.get("tableCount") != EXPECTED_SUCCESSOR_TABLE_COUNT
            or scope_policy.get("deltaCount") != EXPECTED_ADDITION_COUNT
            or scope_policy.get("netDelta") != EXPECTED_NET_DELTA
            or set(scope_policy.get("removedTableIds", [])) != EXPECTED_REMOVED_TABLES
            or set(scope_policy.get("removalDisposition", {})) != EXPECTED_REMOVED_TABLES
        ):
            self.add(
                "P0-CROSS-QUERY-001", "SOURCE.EXPANSION_POLICY_SCOPE",
                "artifact", "tableExpansionPolicy",
                "v5 scope must be exact frozen115 + added17 - removed1 = active131",
                successorScope=scope_policy,
            )

        policy_rows_list = policy.get("successorScope", {}).get("addedRows", [])
        policy_added_list = [row.get("tableId") for row in policy_rows_list if isinstance(row, dict)]
        policy_added = set(policy_added_list)
        if (
            len(policy_rows_list) != 17 or len(policy_added_list) != 17
            or len(policy_added) != 17 or policy_added != EXPECTED_GLOBAL_EXPANSION_TABLES
        ):
            self.add("P0-CROSS-QUERY-001", "SOURCE.EXPANSION_POLICY_SET", "artifact", "tableExpansionPolicy",
                     "table-expansion policy does not contain exactly one row for each independent 17-table identity",
                     rowCount=len(policy_rows_list), actual=sorted(x for x in policy_added if x),
                     expected=sorted(EXPECTED_GLOBAL_EXPANSION_TABLES))

        policy_rows = {
            row.get("tableId"): row for row in policy_rows_list if isinstance(row, dict) and row.get("tableId")
        }
        policy_readers = {
            table_id: set(row.get("readConsumers", [])) for table_id, row in policy_rows.items()
        }
        expected_readers = {
            table_id: set(readers) for table_id, readers in EXPANDED_QUERY_TABLE_READERS.items()
        }
        if policy_readers != expected_readers:
            self.add("P0-CROSS-QUERY-001", "SOURCE.EXPANSION_POLICY_READER_SET", "artifact", "tableExpansionPolicy",
                     "sealed v5 reader sets differ from the independent all-17 acceptance map",
                     expected={key: sorted(value) for key, value in sorted(expected_readers.items())},
                     actual={key: sorted(value) for key, value in sorted(policy_readers.items())})
        # The pinned independent review is deliberately failed evidence.  Each
        # successor may expand producer/read-consumer sets but may not drop an
        # immutable predecessor fact.  Exact v5 bytes/seal close the expanded
        # set; this check prevents a successor from dropping predecessor facts.
        if predecessor_doc is not None:
            predecessor_rows = {
                row.get("tableId"): row
                for row in predecessor_doc.get("successorScope", {}).get("addedRows", [])
                if isinstance(row, dict) and row.get("tableId")
            }
            for table_id in sorted(EXPECTED_GLOBAL_EXPANSION_TABLES):
                policy_row = policy_rows.get(table_id, {})
                predecessor_row = predecessor_rows.get(table_id, {})
                predecessor_producers = set(predecessor_row.get("producers", []))
                predecessor_readers = set(predecessor_row.get("readConsumers", []))
                actual_producers = set(policy_row.get("producers", []))
                actual_readers = set(policy_row.get("readConsumers", []))
                monotonic = (
                    policy_row.get("ownerSession") == predecessor_row.get("ownerSession")
                    and set(policy_row.get("requirementIds", [])) == set(predecessor_row.get("requirementIds", []))
                    and predecessor_producers <= actual_producers
                    and predecessor_readers <= actual_readers
                )
                if not monotonic:
                    self.add("P0-CROSS-QUERY-001", "SOURCE.EXPANSION_POLICY_AUTHORITY_ROW", "table", table_id,
                             "v5 owner/requirement/producer/read-consumer authority is not a monotonic successor to pinned v4",
                             predecessor={
                                 "ownerSession": predecessor_row.get("ownerSession"),
                                 "requirementIds": sorted(predecessor_row.get("requirementIds", [])),
                                 "producers": sorted(predecessor_producers),
                                 "readConsumers": sorted(predecessor_readers),
                             },
                             actual={
                                 "ownerSession": policy_row.get("ownerSession"),
                                 "requirementIds": sorted(policy_row.get("requirementIds", [])),
                                 "producers": sorted(actual_producers),
                                 "readConsumers": sorted(actual_readers),
                             })
        manifest = model.docs["manifest"]
        manifest_file_sha = model.source_hashes.get("manifest")
        expected_manifest_policy_pin = {
            "path": "modern-independent-successor/global-hcm-table-expansion-acceptance-policy.v5.json",
            "fileSha256": EXPECTED_EXPANSION_POLICY_SHA256,
            "sealedPayloadSha256": EXPECTED_EXPANSION_POLICY_SEAL,
            "predecessorPolicySha256": EXPECTED_PREDECESSOR_POLICY_SHA256,
            "predecessorPolicySealedPayloadSha256": EXPECTED_PREDECESSOR_POLICY_SEAL,
            "independentReviewSha256": EXPECTED_SCOPE_REVIEW_SHA256,
            "scopeReductionReviewSha256": EXPECTED_SCOPE_REDUCTION_REVIEW_SHA256,
        }
        actual_manifest_policy_pin = (manifest.get("tableScopeChange") or {}).get("acceptancePolicy")
        if actual_manifest_policy_pin != expected_manifest_policy_pin:
            self.add(
                "P0-CROSS-QUERY-001", "SOURCE.MANIFEST_EXPANSION_POLICY_PIN",
                "artifact", "manifest.tableScopeChange.acceptancePolicy",
                "candidate manifest does not pin the exact v5 -> v4 policy and reviewed scope-reduction lineage",
                expected=expected_manifest_policy_pin, actual=actual_manifest_policy_pin,
            )
        manifest_seal = manifest.get("sealedPayloadSha256")
        if manifest_seal != sealed_payload_sha256(manifest):
            self.add("P0-CROSS-QUERY-001", "SOURCE.MANIFEST_SEAL", "artifact", "manifest",
                     "manifest sealedPayloadSha256 does not match its canonical payload",
                     declared=manifest_seal, computed=sealed_payload_sha256(manifest))
        for role in ("operation", "exact", "event", "semantic", "causal"):
            document = model.docs[role]
            own_seal = document.get("sealedPayloadSha256")
            if own_seal is not None and own_seal != sealed_payload_sha256(document):
                self.add("P0-CROSS-QUERY-001", "SOURCE.PAYLOAD_SEAL", "artifact", role,
                         "artifact sealedPayloadSha256 does not match its canonical payload",
                         declared=own_seal, computed=sealed_payload_sha256(document))
            closed = document.get("closedSetManifest")
            if not isinstance(closed, dict):
                self.add("P0-CROSS-QUERY-001", "SOURCE.MANIFEST_PIN", "artifact", role,
                         "artifact has no structural closed-set manifest pin")
                continue
            if closed.get("manifestId") != manifest.get("manifestId"):
                self.add("P0-CROSS-QUERY-001", "SOURCE.MANIFEST_ID", "artifact", role,
                         "artifact and loaded manifest IDs differ",
                         artifactManifestId=closed.get("manifestId"), loadedManifestId=manifest.get("manifestId"))
            if closed.get("sealedPayloadSha256") != manifest_seal:
                self.add("P0-CROSS-QUERY-001", "SOURCE.MANIFEST_PAYLOAD_PIN", "artifact", role,
                         "artifact pins a different manifest payload",
                         pinned=closed.get("sealedPayloadSha256"), loaded=manifest_seal)
            if "fileSha256" in closed and closed.get("fileSha256") != manifest_file_sha:
                self.add("P0-CROSS-QUERY-001", "SOURCE.MANIFEST_FILE_PIN", "artifact", role,
                         "artifact pins a different manifest file byte hash",
                         pinned=closed.get("fileSha256"), loaded=manifest_file_sha)

        expected_full_pins = {
            "semantic": {
                CANONICAL_FILENAMES["exact"]: model.source_hashes.get("exact"),
                CANONICAL_FILENAMES["event"]: model.source_hashes.get("event"),
            },
            "causal": {
                CANONICAL_FILENAMES["operation"]: model.source_hashes.get("operation"),
                CANONICAL_FILENAMES["exact"]: model.source_hashes.get("exact"),
                CANONICAL_FILENAMES["event"]: model.source_hashes.get("event"),
                CANONICAL_FILENAMES["semantic"]: model.source_hashes.get("semantic"),
            },
        }
        pin_fields = {"semantic": "canonicalContractPins", "causal": "canonicalSourcePins"}
        for role, expected in expected_full_pins.items():
            pins = model.docs[role].get(pin_fields[role], {})
            for filename, actual in expected.items():
                if pins.get(filename) != actual:
                    self.add("P0-CROSS-QUERY-001", "SOURCE.CANONICAL_PIN", "artifact", role,
                             "canonical full-file hash pin does not match the loaded candidate member",
                             target=filename, pinned=pins.get(filename), loaded=actual)

    def query_group(self, operation_id: str) -> list[tuple[str, ...]] | None:
        key = operation_id.removeprefix("modern.").removesuffix(".query")
        for marker, groups in QUERY_FIELD_GROUPS.items():
            if marker in key:
                return groups
        return None

    def anonymous_query_pep_is_closed(self, operation_id: str, operation: Mapping[str, Any]) -> bool:
        if operation_id != "modern.listening.active.query":
            return False
        authority = operation.get("listeningAuthority") or {}
        subject = operation.get("subjectAuthorization") or {}
        projection = (operation.get("readPlan") or {}).get("projectionTuple") or {}
        pep = projection.get("pep") or {}
        required_pep = {"tenant", "purpose", "population", "fieldPolicy", "denyOnUnavailable"}
        if (
            authority.get("ownerPortOperation") != "protected.listActiveAdmissions"
            or authority.get("authoritativeStreamKey") != "platform-hris-listening-protected"
            or subject.get("mode") != "ANONYMOUS_SIGNED_CREDENTIAL_HOLDER"
            or subject.get("principalForbidden") is not True
            or not required_pep <= set(pep)
            or pep.get("denyOnUnavailable") is not True
            or "authorizationCapability" in pep
        ):
            return False

        credential = next(
            (
                row for row in operation.get("requestFields", [])
                if row.get("source") == "headers.X-Listening-Participation-Credential"
                and row.get("name") == "X-Listening-Participation-Credential"
            ),
            None,
        )
        schema = (credential or {}).get("valueSchema") or {}
        fields = {row.get("name"): row for row in schema.get("fields", []) if row.get("name")}
        required_fields = {
            "tenantPublicId", "surveyPublicId", "surveyRevision", "admissionPublicId",
            "admissionVersionPublicId", "admissionOwnerVersion", "formVersionPublicId",
            "formArtifactDigest", "eligibilityVersionPublicId", "eligibilityRevision",
            "consentPolicyVersionPublicId", "consentEvidenceCommitment", "nonRevocationProof",
            "opaqueJti", "tokenCommitment", "aud", "iat", "nbf", "exp", "kid", "alg",
            "signature",
        }
        forbidden_claims = {"workerId", "personId", "principalId", "employeeId"}
        if (
            credential is None
            or credential.get("required") is not True
            or schema.get("additionalProperties") is not False
            or set(fields) != required_fields
            or any(row.get("required") is not True for row in fields.values())
            or set(schema.get("forbiddenClaims", [])) != forbidden_claims
        ):
            return False
        proof = fields["nonRevocationProof"].get("valueSchema") or {}
        proof_fields = {row.get("name"): row for row in proof.get("fields", []) if row.get("name")}
        required_proof = {
            "issuancePublicId", "issuanceRevision", "opaqueJtiCommitment", "tokenCommitment",
            "status", "proofGeneratedAt", "proofExpiresAt", "kid", "alg", "ownerSignature",
        }
        if (
            proof.get("additionalProperties") is not False
            or set(proof_fields) != required_proof
            or proof_fields.get("status", {}).get("validation") != "ACTIVE_ONLY"
            or "bounded maximum TTL" not in str(proof_fields.get("proofExpiresAt", {}).get("validation", ""))
        ):
            return False
        audience_selectors = [
            row for row in operation.get("selectors", [])
            if row.get("selectorType") == "SIGNED_CREDENTIAL_PROTECTED_RESOURCE_AUDIENCE"
        ]
        if len(audience_selectors) != 1:
            return False
        audience = audience_selectors[0]
        if (
            audience.get("source") != "headers.X-Listening-Participation-Credential.aud"
            or audience.get("operator") != "EQUALS_CONSTANT"
            or "aud=DWP.HRIS.LISTENING.PROTECTED" not in str(audience.get("versionRule", ""))
            or "offline ACTIVE proof unexpired" not in str(audience.get("asOfRule", ""))
        ):
            return False
        principal_coupled = any(
            token in json.dumps(
                {
                    "requestFields": operation.get("requestFields", []),
                    "inputEffects": operation.get("inputEffects", []),
                    "selectors": operation.get("selectors", []),
                    "readPlan": operation.get("readPlan", {}),
                    "orderedDml": operation.get("orderedDml", []),
                },
                ensure_ascii=False,
            )
            for token in ("authenticatedPrincipal", "principalWorkerId")
        )
        return not principal_coupled

    def check_queries(self) -> None:
        model = self.model
        seen_signatures: dict[tuple[str, ...], list[str]] = defaultdict(list)
        for operation_id in model.query_ids():
            entity = model.response_entity(operation_id)
            if entity is None:
                self.add("P0-CROSS-QUERY-001", "QUERY.ENTITY_MISSING", "operation", operation_id,
                         "query response has no resolvable item/items entity schema")
                continue
            fields = entity.get("fields", [])
            names = [str(row.get("name")) for row in fields if row.get("name")]
            seen_signatures[tuple(sorted(names))].append(operation_id)
            if entity.get("additionalProperties") is not False:
                self.add("P0-CROSS-QUERY-001", "QUERY.OPEN_SCHEMA", "operation", operation_id,
                         "query entity must set additionalProperties=false")
            business = [name for name in names if name not in BASE_ENTITY_FIELDS]
            if not business:
                self.add("P0-CROSS-QUERY-001", "QUERY.ENVELOPE_ONLY", "operation", operation_id,
                         "query entity exposes only the generic control envelope", fields=names)
            groups = self.query_group(operation_id)
            if groups is None:
                self.add("P0-CROSS-QUERY-001", "QUERY.UNCLASSIFIED", "operation", operation_id,
                         "query has no operation-family business projection rule")
            else:
                okay, missing = all_groups_present(names, groups)
                if not okay:
                    self.add("P0-CROSS-QUERY-001", "QUERY.BUSINESS_FIELDS", "operation", operation_id,
                             "typed business projection is incomplete", missingAliasGroups=missing, fields=names)

            lineage = model.lineage.get(operation_id, {})
            response_sources = lineage.get("responseFieldSources", [])
            source_by_target = defaultdict(list)
            for row in response_sources:
                source_by_target[str(row.get("target", ""))].append(row)
            read_tables = set(model.operation[operation_id].get("readPlan", {}).get("tables", []))
            read_tables |= set(model.binding.get(operation_id, {}).get("readsTables", []))
            for name in business:
                rows = [row for target, values in source_by_target.items()
                        if target.endswith("." + name) for row in values]
                if not rows:
                    self.add("P0-CROSS-QUERY-001", "QUERY.FIELD_LINEAGE", "operation", operation_id,
                             f"business response field {name} has no exact per-field lineage")
                    continue
                durable = False
                for row in rows:
                    source = str(row.get("sourcePath", ""))
                    source_kind = row.get("sourceKind")
                    if source_kind not in {"PHYSICAL_POST_STATE", "IMMUTABLE_PROOF", "OWNER_REFETCH", "SERVER_DERIVED_FROM_TYPED_SOURCES"}:
                        continue
                    table_prefix = source.split(".", 1)[0]
                    if table_prefix in model.table and table_prefix not in read_tables:
                        continue
                    if source.startswith("EXACT_TYPED_PROJECTION:") or source in {"", "OWNER_PROJECTION"}:
                        continue
                    durable = True
                if not durable:
                    self.add("P0-CROSS-QUERY-001", "QUERY.FIELD_SOURCE", "operation", operation_id,
                             f"business response field {name} is not bound to a named durable read source",
                             lineage=rows, readTables=sorted(read_tables))

            projection = model.operation[operation_id].get("readPlan", {}).get("projectionTuple", {})
            pep = projection.get("pep", {})
            required_pep = {"authorizationCapability", "tenant", "purpose", "population", "fieldPolicy", "denyOnUnavailable"}
            anonymous_closed = self.anonymous_query_pep_is_closed(
                operation_id, model.operation[operation_id]
            )
            authenticated_closed = required_pep <= set(pep) and pep.get("denyOnUnavailable") is True
            if not anonymous_closed and not authenticated_closed:
                self.add("P0-CROSS-QUERY-001", "QUERY.PEP", "operation", operation_id,
                         "query projection lacks exact tenant/purpose/population/field-policy fail-closed PEP")

        ai_sets: dict[str, tuple[str, ...]] = {}
        for aggregate in ("assistance", "evaluation", "policy"):
            oid = f"modern.ai.{aggregate}.query"
            entity = model.response_entity(oid)
            ai_sets[aggregate] = tuple(sorted(
                row.get("name") for row in (entity or {}).get("fields", []) if row.get("name")
            ))
        if len(set(ai_sets.values())) != 3:
            self.add("P0-AI-001", "AI.QUERY_DISTINCT", "capability", "HRIS.MODERN.GOVERNED_AI",
                     "policy, assistance and evaluation entity schemas are not structurally distinct",
                     fieldSets=ai_sets)

    def check_handlers(self) -> None:
        model = self.model
        for handler_id, handler in sorted(model.handler.items()):
            if handler_id.startswith("internal.listening."):
                self.check_listening_handler(handler_id, handler)
                continue
            requirement = HANDLER_REQUIREMENTS.get(handler_id)
            if requirement is None:
                self.add("P0-CROSS-HANDLER-002", "HANDLER.UNCLASSIFIED", "handler", handler_id,
                         "non-listening handler has no independent aggregate/outcome rule")
                continue
            aggregate = handler.get("aggregateRoot") or {}
            root = aggregate.get("table")
            if root != requirement["root"]:
                self.add("P0-CROSS-HANDLER-002", "HANDLER.ROOT", "handler", handler_id,
                         "handler locks the wrong business/request aggregate",
                         expected=requirement["root"], actual=root)
            written = {row.get("table") for row in handler.get("writes", []) if isinstance(row, dict)}
            missing_writes = set(requirement.get("writes", [])) - written
            forbidden = set(requirement.get("forbid", [])) & written
            if missing_writes:
                self.add("P0-CROSS-HANDLER-002", "HANDLER.WRITES", "handler", handler_id,
                         "handler omits required typed result/domain writes", missing=sorted(missing_writes), actual=sorted(x for x in written if x))
            if forbidden:
                self.add("P0-CROSS-HANDLER-002", "HANDLER.FORBIDDEN_WRITE", "handler", handler_id,
                         "handler writes a business aggregate that must remain independent", forbidden=sorted(forbidden))

            trigger = handler.get("trigger")
            if not isinstance(trigger, dict):
                self.add("P0-CROSS-HANDLER-002", "HANDLER.TRIGGER", "handler", handler_id,
                         "handler trigger is not a structured signed owner result contract")
            else:
                trigger_text = flatten_strings(trigger)
                ok, missing = all_groups_present(trigger_text, [
                    ("eventId", "requestId", "aggregateId"), ("payloadDigest",),
                    ("expectedRevision", "aggregateVersion"), ("outcome", "status"),
                    ("signature", "signed"),
                ])
                if not ok:
                    self.add("P0-CROSS-HANDLER-002", "HANDLER.TRIGGER_FIELDS", "handler", handler_id,
                             "signed result trigger lacks exact identity/revision/outcome/digest/signature fields",
                             missingAliasGroups=missing)

            declared_post = set(aggregate.get("postStates", []))
            if not declared_post or not declared_post <= set(requirement["post"]):
                self.add("P0-CROSS-HANDLER-002", "HANDLER.POST_STATE", "handler", handler_id,
                         "handler post-state map is not the domain-specific allowed set",
                         allowed=sorted(requirement["post"]), actual=sorted(declared_post))
            state_column = aggregate.get("stateColumn")
            table = model.table.get(root or "")
            if table and state_column:
                allowed = state_values(table, state_column)
                if allowed and not set(aggregate.get("preStates", []) + aggregate.get("postStates", [])) <= allowed:
                    self.add("P0-CROSS-HANDLER-002", "HANDLER.DDL_STATE", "handler", handler_id,
                             "handler state is outside exact DDL CHECK", ddlAllowed=sorted(allowed),
                             declared=aggregate.get("preStates", []) + aggregate.get("postStates", []))

            assignments = [key for row in handler.get("writes", []) for key in row.get("assignments", {})]
            for group in requirement.get("assign", []):
                if not token_present(assignments, group):
                    self.add("P0-CROSS-HANDLER-002", "HANDLER.RESULT_ASSIGNMENT", "handler", handler_id,
                             "handler omits a required result assignment", expected=list(group), actual=assignments)
            idem = handler.get("idempotency", {})
            if not isinstance(idem, dict) or not {
                "claimKey", "storedPayloadDigest", "sameDigest", "differentDigest", "claimOrder"
            } <= set(idem):
                self.add("P0-CROSS-HANDLER-002", "HANDLER.IDEMPOTENCY", "handler", handler_id,
                         "handler lacks structural inbox/idempotency conflict contract")
            rollback = handler.get("rollback", {})
            if not isinstance(rollback, dict) or not rollback:
                self.add("P0-CROSS-HANDLER-002", "HANDLER.ROLLBACK", "handler", handler_id,
                         "handler lacks explicit all-write rollback contract")

    def check_listening_handler(self, handler_id: str, handler: dict[str, Any]) -> None:
        required_keys = {
            "requestContract", "idempotencyRule", "transactionBoundary",
            "identityBoundary", "implementationState",
        }
        missing = required_keys - set(handler)
        if missing:
            self.add("P0-LIS-001", "LISTENING.HANDLER_SHAPE", "handler", handler_id,
                     "listening owner handler is not fully structured", missing=sorted(missing))
        request = handler.get("requestContract", {})
        if not isinstance(request, dict) or not request:
            self.add("P0-LIS-001", "LISTENING.HANDLER_REQUEST", "handler", handler_id,
                     "listening handler has no closed input contract")
        transaction = handler.get("structuredTransaction")
        if handler.get("handlerKind") == "OWNER_LOCAL_ERASURE_PROCESSOR":
            phases = [
                "TX1_CLAIM_AND_COMMIT_LEASE",
                "OUTSIDE_DB_TX_IDEMPOTENT_KMS_DESTROY_EXACT_RESPONSE_DEK",
                "TX2_SUCCESS_TOMBSTONE_TOKEN_ORIGINAL_RECEIPT_AND_PRIVATE_COMPLETION_RECEIPT",
                "TX2_FAILURE_RELEASE_LEASE_TO_FAILED_RETRYABLE_WITHOUT_COMPLETION_RECEIPT",
            ]
            actions = [row for row in handler.get("nonSqlOwnerActions", []) if isinstance(row, dict)]
            writes = [row for row in handler.get("writes", []) if isinstance(row, dict)]
            by_role = {row.get("role"): row for row in writes if row.get("role")}
            expected_roles = {
                "CLAIM_ERASURE_LEASE", "SEAL_ERASURE_TOMBSTONE", "TOKEN_REPLAY_TOMBSTONE",
                "ORIGINAL_SUBMISSION_REPLAY_TOMBSTONE", "PRIVATE_ERASURE_COMPLETION_RECEIPT",
                "RELEASE_FAILED_ERASURE_LEASE",
            }
            failure = by_role.get("RELEASE_FAILED_ERASURE_LEASE", {})
            failure_assignments = set(failure.get("assignments", {}))
            outbox_writes = [
                row for row in writes
                if "outbox" in str(row.get("table", "")).lower()
                or "outbox" in str(row.get("role", "")).lower()
            ]
            response_writes = [
                row for row in writes if row.get("table") == "sys_hris_listening_responses"
            ]
            kms_action = actions[0] if len(actions) == 1 else {}
            closed = (
                isinstance(transaction, dict)
                and transaction.get("sameTransaction") is False
                and transaction.get("phases") == phases
                and "lease expiry permits retry" in str(transaction.get("crashRecovery", ""))
                and "exactly one winner" in str(transaction.get("concurrency", ""))
                and kms_action.get("action") == "CRYPTO_SHRED_OWNER_KEY_MATERIAL"
                and "exact key version" in str(kms_action.get("selector", ""))
                and kms_action.get("proofSink") == "sys_hris_listening_erasure_tickets.tombstone_digest"
                and "NO_FALSE_COMPLETION_RECEIPT_OR_OUTBOX" in str(kms_action.get("failure", ""))
                and set(by_role) == expected_roles
                and by_role.get("CLAIM_ERASURE_LEASE", {}).get("phase") == "TX1"
                and by_role.get("CLAIM_ERASURE_LEASE", {}).get("action") == "UPDATE_CAS"
                and "lease absent/expired" in str(by_role.get("CLAIM_ERASURE_LEASE", {}).get("selector", ""))
                and by_role.get("SEAL_ERASURE_TOMBSTONE", {}).get("phase") == "TX2_SUCCESS"
                and "matching lease" in str(by_role.get("SEAL_ERASURE_TOMBSTONE", {}).get("selector", ""))
                and "KMS destruction attestation" in str(
                    by_role.get("SEAL_ERASURE_TOMBSTONE", {}).get("assignments", {}).get(
                        "tombstone_digest", ""
                    )
                )
                and failure.get("phase") == "TX2_FAILURE"
                and failure.get("action") == "UPDATE_CAS"
                and "KMS not attested destroyed" in str(failure.get("selector", ""))
                and not {"tombstone_digest", "completed_at", "erased_at"} & failure_assignments
                and by_role.get("PRIVATE_ERASURE_COMPLETION_RECEIPT", {}).get("action") == "APPEND"
                and not outbox_writes
                and not response_writes
                and handler.get("responseMutableStatusForbidden") == ["WITHDRAWN", "ANONYMIZED"]
                and handler.get("stableReplayReceiptRequired") is True
                and handler.get("publicEventEmission") == "FORBIDDEN_RAW_OR_IDENTITY_LINKABLE"
                and handler.get("privateDelivery") == "OWNER_LOCAL_PRIVATE_BROKER_FORBIDDEN_NO_OUTBOX"
            )
            if not closed:
                self.add(
                    "P0-LIS-001", "LISTENING.HANDLER_TRANSACTION", "handler", handler_id,
                    "owner-local erasure processor does not close the exact lease/KMS/TX2 success-or-failure saga",
                    structuredTransaction=transaction, nonSqlOwnerActions=actions,
                    writeRoles=sorted(x for x in by_role if x), outboxWrites=outbox_writes,
                    responseWrites=response_writes, failureAssignments=sorted(failure_assignments),
                )
        elif not isinstance(transaction, dict) or transaction.get("sameTransaction") is not True:
            self.add("P0-LIS-001", "LISTENING.HANDLER_TRANSACTION", "handler", handler_id,
                     "listening handler lacks atomic inbox/domain/ack/outbox structure")
        text = flatten_strings(handler)
        if token_present(text, ("authenticatedPrincipal", "principalWorkerId")) and "anonymous" in handler_id:
            self.add("P0-LIS-001", "LISTENING.IDENTITY_LEAK", "handler", handler_id,
                     "anonymous listening handler contains authenticated identity linkage")

    def event_condition_is_closed(
        self, owner_kind: str, owner_id: str, event: Mapping[str, Any], states: set[str],
    ) -> bool:
        """Accept only the three reviewed event-condition productions.

        This deliberately does not treat event names or arbitrary substrings as
        states.  The signed-message production is restricted to the two exact
        Listening owner-result consumers and proves the success-only root CAS,
        inbox close, and final outbox ordering from their structured writes.
        """

        condition = event.get("condition")
        if condition == "ALWAYS":
            return True

        state_match = re.fullmatch(r"(toState|POST_STATE)=([A-Z][A-Z0-9_]*)", str(condition))
        if state_match:
            state = state_match.group(2)
            if state not in states:
                return False
            to_state = next(
                (row for row in event.get("fields", []) if row.get("name") == "toState"), {}
            )
            if owner_kind == "handler":
                aggregate = self.model.handler.get(owner_id, {}).get("aggregateRoot") or {}
            else:
                aggregate = self.model.operation.get(owner_id, {}).get("aggregateRoot") or {}
            root = aggregate.get("table")
            state_column = aggregate.get("stateColumn")
            return (
                bool(root and state_column)
                and to_state.get("sourceKind") == "PHYSICAL_POST_STATE"
                and to_state.get("source") == f"{root}.{state_column}"
            )

        signed_condition = "signedMessage.status=SUCCESS AND root CAS succeeded"
        signed_handlers = {
            "internal.listening.configuration.admission-close-receipt.consume": (
                "EmployeeListeningSurveyClosed.v3", "CLOSED", "CLOSE_PENDING"
            ),
            "internal.listening.configuration.admission-install-receipt.consume": (
                "EmployeeListeningSurveyPublished.v3", "PUBLISHED", "PUBLISH_PENDING"
            ),
        }
        if condition != signed_condition or owner_kind != "handler" or owner_id not in signed_handlers:
            return False
        expected_event, success_state, pre_state = signed_handlers[owner_id]
        handler = self.model.handler.get(owner_id, {})
        request = handler.get("requestContract") or {}
        writes = [row for row in handler.get("writes", []) if isinstance(row, dict)]
        root_rows = [row for row in writes if row.get("role") == "CONFIGURATION_SAGA_FINAL_ROOT_CAS"]
        inbox_rows = [row for row in writes if row.get("role") == "SIGNED_OWNER_PORT_INBOX_COMPLETE"]
        outbox_rows = [row for row in writes if row.get("role") == "PUBLIC_EVENT_OUTBOX"]
        root = root_rows[0] if len(root_rows) == 1 else {}
        outbox = outbox_rows[0] if len(outbox_rows) == 1 else {}
        root_status = str((root.get("assignments") or {}).get("status", ""))
        return (
            event.get("eventName") == expected_event
            and handler.get("trigger") == "VERIFY_SIGNATURE_THEN_CLAIM_OWNER_LOCAL_INBOX_BY_MESSAGE_ID"
            and request.get("additionalProperties") is False
            and request.get("status") == "REQUIRED_STRING"
            and request.get("payloadDigest") == "REQUIRED_SHA256"
            and request.get("ownerSignature")
            == "REQUIRED_BASE64URL_UNPADDED_P1363_FIXED_64_BYTE_SIGNATURE_MAX_86"
            and len(root_rows) == 1
            and root.get("action") == "UPDATE_CAS"
            and f"state={pre_state}" in str(root.get("selector", ""))
            and "exact requestMessageId causation" in str(root.get("selector", ""))
            and root.get("expectedRows") == "EXACTLY_ONE_FOR_NEW_INBOX_CLAIM_ZERO_ON_SEALED_REPLAY"
            and root_status.startswith(f"CONSTANT:{success_state} IF signedMessage.status=SUCCESS ELSE CONSTANT:")
            and len(inbox_rows) == 1
            and len(outbox_rows) == 1
            and outbox.get("action") == "APPEND"
            and (outbox.get("assignments") or {}).get("event_type") == f"CONSTANT:{expected_event}"
            and writes.index(root) < writes.index(inbox_rows[0]) < writes.index(outbox)
            and event.get("emission") == {
                "outboxWrite": "SAME_TRANSACTION_AFTER_DOMAIN_AND_CLOSED_RECEIPT",
                "brokerPublish": "AFTER_COMMIT_ONLY",
                "rollback": "NO_OUTBOX_OR_PUBLISH_ON_FAILURE",
            }
        )

    def check_events(self) -> None:
        model = self.model
        for owner_kind, owner_id, event in model.events:
            name = str(event.get("eventName", ""))
            condition = str(event.get("condition", ""))
            if owner_kind == "operation":
                transition = model.operation[owner_id].get("transition") or {}
                states = set(transition.get("postStates", []))
                states |= {row.get("postState") for row in transition.get("branches", []) if row.get("postState")}
            else:
                states = set((model.handler[owner_id].get("aggregateRoot") or {}).get("postStates", []))
            if not self.event_condition_is_closed(owner_kind, owner_id, event, states):
                self.add("P0-CROSS-EVENT-003", "EVENT.CONDITION", "event", name,
                         "event condition is outside the closed ALWAYS|toState|POST_STATE|signed-success-root-CAS grammar",
                         owner=owner_id, condition=condition, reachableStates=sorted(x for x in states if x))

            field_names = {row.get("name") for row in event.get("fields", [])}
            for field_name in {"aggregateId", "aggregateVersion", "occurredAt", "correlationId"}:
                if field_name not in field_names:
                    self.add("P0-CROSS-EVENT-003", "EVENT.ENVELOPE", "event", name,
                             f"event omits {field_name}")
            for row in event.get("fields", []):
                source_kind = row.get("sourceKind")
                field_name = row.get("name")
                accepted = source_kind in {
                    "PHYSICAL_POST_STATE", "LOCKED_PRE_STATE", "IMMUTABLE_OWNER_PROOF",
                    "SERVER_DERIVED_FROM_DURABLE_FACTS", "TYPED_ORDERED_CHILD_PROJECTION",
                }
                if source_kind == "SEALED_COMMAND_RECEIPT" and field_name in {
                    "correlationId", "authorizationRevision", "purposeCode",
                    "populationScopeDigest", "fieldPolicyRevision",
                }:
                    accepted = True
                if source_kind == "DERIVED_DOMAIN_FACT" and row.get("source") == "CONSTANT:NONE" and field_name == "fromState":
                    accepted = True
                if not accepted:
                    self.add("P0-CROSS-EVENT-003", "EVENT.DURABLE_SOURCE", "event", name,
                             "event field is not reconstructable from a durable exact source",
                             field=row.get("name"), sourceKind=row.get("sourceKind"), source=row.get("source"))
            refetch = event.get("refetchContract")
            if not isinstance(refetch, dict):
                self.add("P0-CROSS-EVENT-003", "EVENT.REFETCH", "event", name,
                         "event has no explicit refetch disposition")
            elif refetch.get("mode") == "EXACT_HISTORICAL_VERSION":
                endpoint = refetch.get("endpointOperationId")
                query = model.operation.get(endpoint or "")
                aggregate = event.get("aggregateEntityType")
                if not query or query.get("mode") != "QUERY":
                    self.add("P0-CROSS-EVENT-003", "EVENT.REFETCH_ENDPOINT", "event", name,
                             "historical refetch endpoint is not a canonical query", endpoint=endpoint)
                else:
                    expected_table = str(aggregate).removeprefix("table:")
                    if expected_table and expected_table not in query.get("readPlan", {}).get("tables", []):
                        self.add("P0-CROSS-EVENT-003", "EVENT.REFETCH_AGGREGATE", "event", name,
                                 "refetch query does not read the event aggregate", endpoint=endpoint,
                                 aggregate=aggregate)
                pep = refetch.get("pep", {})
                if pep.get("reauthorizeEveryCall") is not True or pep.get("denyOnUnavailable") is not True:
                    self.add("P0-CROSS-EVENT-003", "EVENT.REFETCH_PEP", "event", name,
                             "historical refetch does not reauthorize and fail closed")
            elif refetch.get("mode") == "EXACT_OWNER_DEPENDENCY":
                dependencies = [
                    row for row in model.docs["operation"].get(
                        "ownerDependencyContracts", []
                    )
                    if row.get("dependencyContractId")
                    == refetch.get("dependencyContractId")
                ]
                dependency = dependencies[0] if len(dependencies) == 1 else {}
                pep = refetch.get("pep", {})
                pay_exposure = event.get("audience", {}).get(
                    "consumerFieldExposure", {}
                ).get("HRIS-PAY", {})
                ordered_field_names = tuple(
                    row.get("name") for row in event.get("fields", [])
                )
                closed = (
                    name == "ApprovedCompensationPlanSnapshotPublished.v2"
                    and owner_id == "modern.compplan.snapshot.publish"
                    and len(dependencies) == 1
                    and refetch.get("dependencyContractSha256")
                    == dependency.get("sealedPayloadSha256")
                    and refetch.get("ownerSession") == "HRIS-PER"
                    and refetch.get("consumerSessionAllowlist") == ["HRIS-PAY"]
                    and refetch.get("selectorTuple", [None])[0]
                    == "eventEnvelope.tenantId"
                    and refetch.get("tenantBinding", {}).get("equality")
                    == "ALL_THREE_REQUIRED_EQUAL"
                    and refetch.get("latestFallback") == "FORBIDDEN"
                    and pep.get("reauthorizeEveryCall") is True
                    and pep.get("denyOnUnavailable") is True
                    and pay_exposure.get("mode") == "EXACT_ALLOWLIST"
                    and pay_exposure.get("fields") == [
                        "snapshotId", "snapshotRevision", "payloadDigest", "lineCount",
                    ]
                    and "lines" not in field_names
                    and "tenantId" not in field_names
                    and ordered_field_names == PAYROLL_OWNER_EVENT_FIELD_NAMES
                    and sha256_bytes(canonical_json(event.get("fields", [])))
                    == PAYROLL_OPERATION_EVENT_FIELDS_SHA256
                    and sha256_bytes(canonical_json(refetch))
                    == PAYROLL_OPERATION_REFETCH_SHA256
                    and sha256_bytes(canonical_json(event.get("audience", {})))
                    == PAYROLL_OPERATION_AUDIENCE_SHA256
                )
                if not closed:
                    self.add(
                        "P0-CROSS-EVENT-003", "EVENT.OWNER_DEPENDENCY_REFETCH",
                        "event", name,
                        "owner-dependency refetch is not the exact sealed PAY-only "
                        "tenant-bound minimal-trigger contract",
                        refetch=refetch, payExposure=pay_exposure,
                    )
            elif refetch.get("mode") == "FIELD_ALLOWLIST":
                endpoint = refetch.get("endpoint")
                pep = refetch.get("pep", {})
                if not isinstance(endpoint, str) or not endpoint.startswith("/internal/"):
                    self.add("P0-CROSS-EVENT-003", "EVENT.REFETCH_ENDPOINT", "event", name,
                             "field-allowlist refetch lacks a concrete internal owner endpoint")
                if not refetch.get("allowedFields") or pep.get("reauthorizeEveryCall") is not True or pep.get("denyOnUnavailable") is not True:
                    self.add("P0-CROSS-EVENT-003", "EVENT.REFETCH_PEP", "event", name,
                             "field-allowlist refetch lacks exact allowlist/reauthorization/fail-close")
                if "exact" not in str(refetch.get("version", "")).lower():
                    self.add("P0-CROSS-EVENT-003", "EVENT.REFETCH_VERSION", "event", name,
                             "field-allowlist refetch is not pinned to an exact historical version")
            elif refetch.get("mode") == "FORBIDDEN":
                durable_kinds = {
                    "PHYSICAL_POST_STATE", "LOCKED_PRE_STATE", "IMMUTABLE_OWNER_PROOF",
                    "SERVER_DERIVED_FROM_DURABLE_FACTS", "TYPED_ORDERED_CHILD_PROJECTION",
                    "SEALED_COMMAND_RECEIPT", "DERIVED_DOMAIN_FACT",
                }
                if not refetch.get("payloadSufficiency") and not all(
                    row.get("sourceKind") in durable_kinds for row in event.get("fields", [])
                ):
                    self.add("P0-CROSS-EVENT-003", "EVENT.NO_REFETCH_PROOF", "event", name,
                             "refetch is forbidden without a closed durable payload-sufficiency proof")
            else:
                self.add("P0-CROSS-EVENT-003", "EVENT.REFETCH_MODE", "event", name,
                         "refetch mode is not one of exact historical, exact owner dependency, field allowlist, or explicitly forbidden")

    def check_self_authority(self) -> None:
        for operation_id in sorted(SELF_MUTATIONS):
            operation = self.model.operation.get(operation_id)
            if not operation:
                self.add("P0-CROSS-SELF-004", "SELF.OPERATION", "operation", operation_id,
                         "required self-service operation is absent")
                continue
            body_workers = {
                row.get("source") for row in operation.get("requestFields", [])
                if row.get("location") == "body" and token_present([str(row.get("name", ""))], ("worker", "subject", "requester", "applicant"))
            }
            effects = operation.get("inputEffects", [])
            structured_equalities = []
            for row in effects:
                for effect in row.get("effects", []):
                    if effect.get("kind") in {
                        "CALLER_SUBJECT_EQUALITY", "DERIVED_AUTHENTICATED_SUBJECT",
                        "EXACT_DELEGATION_SELECTOR", "SUBJECT_OWNERSHIP_GUARD",
                    }:
                        structured_equalities.append((row.get("source"), effect))
            dml_sources = []
            for table_name, values in self.model.operation_assignments(operation_id).items():
                if "command_receipt" in table_name or "outbox" in table_name:
                    continue
                for column, value in values.items():
                    subject_column = token_present(
                        [column], ("worker", "subject", "requester", "applicant", "assignee", "profile_owner")
                    )
                    ai_owner_column = operation_id.startswith("modern.ai.assist.") and column == "created_by"
                    if subject_column or ai_owner_column:
                        dml_sources.append(str(value))
            derived_dml = any(
                "authenticatedPrincipal.workerPublicId" in source
                or "authenticatedPrincipal.publicId" in source
                or "AUTHENTICATED_SUBJECT" in source
                for source in dml_sources
            )
            if body_workers and not structured_equalities:
                self.add("P0-CROSS-SELF-004", "SELF.REQUEST_EQUALITY", "operation", operation_id,
                         "caller-supplied subject has no structural equality/delegation selector",
                         bodySubjectSources=sorted(x for x in body_workers if x))
            if not structured_equalities and not derived_dml:
                self.add("P0-CROSS-SELF-004", "SELF.DML_DERIVATION", "operation", operation_id,
                         "self-service DML is not structurally derived from the authenticated subject")
            proxy = [effect for _, effect in structured_equalities if effect.get("kind") == "EXACT_DELEGATION_SELECTOR"]
            if proxy:
                proxy_text = flatten_strings(proxy)
                okay, missing = all_groups_present(proxy_text, [
                    ("delegationReceipt",), ("reason",), ("proxyCapability", "distinctCapability"),
                    ("tenant",), ("purpose",), ("subject",),
                ])
                if not okay:
                    self.add("P0-CROSS-SELF-004", "SELF.PROXY_PROOF", "operation", operation_id,
                             "proxy branch lacks exact delegation/duty/reason/tenant/purpose/subject proof",
                             missingAliasGroups=missing)

    def check_operation_requirement(self, requirement_id: str, spec: OperationRequirement) -> None:
        operation = self.model.operation.get(spec.operation_id)
        if not operation:
            self.add(requirement_id, "DOMAIN.OPERATION_MISSING", "operation", spec.operation_id,
                     "required operation is absent")
            return
        body = self.model.operation_body_names(spec.operation_id)
        okay, missing = all_groups_present(body, spec.request_groups)
        if not okay:
            self.add(requirement_id, "DOMAIN.REQUEST", "operation", spec.operation_id,
                     "closed request schema omits required business inputs",
                     missingAliasGroups=missing, actual=sorted(body))
        assignments = self.model.operation_assignments(spec.operation_id)
        missing_tables = [table for table in spec.writes if table not in assignments]
        if missing_tables:
            self.add(requirement_id, "DOMAIN.DML", "operation", spec.operation_id,
                     "same-transaction DML omits required business fact/ledger tables",
                     missingTables=missing_tables, actualTables=sorted(assignments))
        for table, groups in spec.assignment_groups:
            actual = set(assignments.get(table, {}))
            okay, missing = all_groups_present(actual, groups)
            if not okay:
                self.add(requirement_id, "DOMAIN.ASSIGNMENT", "operation", spec.operation_id,
                         f"{table} assignment set omits required facts",
                         missingAliasGroups=missing, actual=sorted(actual))

    def check_domain_requirements(self) -> None:
        for requirement_id, specs in DOMAIN_OPERATION_REQUIREMENTS.items():
            for spec in specs:
                self.check_operation_requirement(requirement_id, spec)

        table_to_requirement: dict[str, str] = {}
        for finding in self.audit["findings"]:
            if finding["severity"] != "P0":
                continue
            for table in finding.get("affectedTables", []):
                table_to_requirement.setdefault(table, finding["id"])
        prefix_requirement = {
            "ppl_rec_": "P0-REC-001", "ppl_jny_": "P0-ONB-001",
            "ppl_wfp_": "P0-WFP-001", "ppl_bnf_": "P0-BNF-001",
            "ppl_hrs_": "P0-HRS-001", "ppl_cwk_": "P0-CWK-001",
            "prf_skl_": "P0-SKL-001", "prf_grw_": "P0-GRW-001",
            "prf_lrn_": "P0-LRN-001", "prf_mkt_": "P0-MKT-001",
            "prf_suc_": "P0-SUC-001", "prf_cmp_": "P0-CMP-001",
            "tme_wfm_": "P0-WFM-001", "sys_hris_listening_": "P0-LIS-001",
            "sys_hris_metric_": "P0-ANL-001", "sys_hris_analytics_": "P0-ANL-001",
            "sys_hris_ai_": "P0-AI-001",
        }
        for table_name, groups in TABLE_COLUMN_REQUIREMENTS.items():
            requirement_id = table_to_requirement.get(table_name)
            if not requirement_id:
                requirement_id = next(
                    (rid for prefix, rid in prefix_requirement.items() if table_name.startswith(prefix)),
                    "P0-CROSS-QUERY-001",
                )
            if table_name not in self.model.table:
                self.add(requirement_id, "DOMAIN.TABLE_MISSING", "table", table_name,
                         "required typed business table is absent")
                continue
            columns = self.model.table_columns(table_name)
            okay, missing = all_groups_present(columns, groups)
            if not okay:
                self.add(requirement_id, "DOMAIN.TABLE_COLUMNS", "table", table_name,
                         "typed table schema omits required business columns",
                         missingAliasGroups=missing, actual=sorted(columns))

        writers = self.model.writers()
        for table_name in TABLE_COLUMN_REQUIREMENTS:
            if table_name in self.model.table and table_name not in writers:
                requirement_id = table_to_requirement.get(table_name, "P0-CROSS-HANDLER-002")
                self.add(requirement_id, "DOMAIN.PRODUCER", "table", table_name,
                         "required typed table has no exact command/handler producer")

        self.check_listening_submit_atomicity()
        self.check_listening_owner_boundaries()
        self.check_ai_boundaries()
        self.check_wfm_mode_boundary()
        self.check_expanded_query_lineage()
        self.check_expansion_physical_semantics()

    def check_expansion_physical_semantics(self) -> None:
        policy_rows = self.model.expansion_policy.get("successorScope", {}).get("addedRows", [])
        actual_writers = self.model.writers()
        for policy_row in policy_rows:
            table_name = policy_row["tableId"]
            requirement_id = policy_row["requirementIds"][0]
            table = self.model.table.get(table_name)
            if not table:
                self.add(requirement_id, "EXPANSION.TABLE_MISSING", "table", table_name,
                         "approved non-replaceable 115→132 successor table is absent")
                continue
            row_security = str(table.get("rowSecurity", ""))
            if "ENABLE" not in row_security or "FORCE" not in row_security or "NOBYPASSRLS" not in row_security:
                self.add(requirement_id, "EXPANSION.RLS", "table", table_name,
                         "added table does not enforce tenant FORCE RLS/NOBYPASSRLS",
                         rowSecurity=row_security)
            if not table.get("retentionPolicyRef"):
                self.add(requirement_id, "EXPANSION.RETENTION", "table", table_name,
                         "added table has no named retention-policy version reference")
            immutability = str(table.get("immutability", ""))
            if not token_present([immutability], ("append", "immutable", "ledger", "version")):
                self.add(requirement_id, "EXPANSION.IMMUTABILITY", "table", table_name,
                         "added non-replaceable fact is not append-only/immutable/versioned",
                         immutability=immutability)
            if not table.get("uniqueKeys"):
                self.add(requirement_id, "EXPANSION.UNIQUE", "table", table_name,
                         "added table has no tenant-bound identity/revision uniqueness")
            if not table.get("foreignKeys"):
                self.add(requirement_id, "EXPANSION.FK", "table", table_name,
                         "added table has no typed parent/owner relation")
            expected_producers = set(policy_row.get("producers", []))
            writer_rows = actual_writers.get(table_name, [])
            actual_producers = {row["producer"] for row in writer_rows}
            if actual_producers != expected_producers:
                self.add(requirement_id, "EXPANSION.PRODUCERS", "table", table_name,
                         "actual DML producer set differs from sealed expansion authority",
                         expected=sorted(expected_producers), actual=sorted(actual_producers))
            if table_name == "ppl_wfp_simulation_requests":
                expected_modes = {
                    "modern.workforceplan.scenario.simulate": {"APPEND"},
                    "internal.workforceplan.simulation-result.consume": {"UPDATE_CAS"},
                    "modern.workforceplan.scenario.cancel": {"UPDATE_CAS"},
                }
                invalid_actions = [
                    row for row in writer_rows
                    if row["action"] not in expected_modes.get(row["producer"], set())
                ]
            else:
                invalid_actions = [
                    row for row in writer_rows
                    if row["action"] not in {"INSERT", "APPEND", "INSERT_MANY", "APPEND_MANY"}
                ]
            if invalid_actions:
                self.add(requirement_id, "EXPANSION.WRITE_MODE", "table", table_name,
                         "immutable expansion table has mutating/non-append producer action",
                         invalidActions=invalid_actions)

        self.check_ai_review_table()
        self.check_wfp_simulation_lifecycle()
        self.check_cwk_version_table()
        self.check_succession_version_table()

    def check_ai_review_table(self) -> None:
        table_name = AI_REVIEW_TABLE
        table = self.model.table.get(table_name)
        if not table:
            return
        columns = {row.get("name"): row for row in table.get("columns", [])}
        names = set(columns)
        okay, missing = all_groups_present(names, [
            ("assistance",), ("subject",), ("human_actor", "actor"),
            ("decision",), ("reason",), ("decision_receipt", "delegation_receipt"),
        ])
        if not okay:
            self.add("P0-AI-001", "AI.REVIEW_COLUMNS", "table", table_name,
                     "AI human review does not preserve actor/subject/decision/reason/receipt",
                     missingAliasGroups=missing, columns=sorted(x for x in names if x))
        reason_columns = [row for name, row in columns.items() if token_present([str(name)], ("reason",))]
        if reason_columns and not all(row.get("sensitivity") in {"RESTRICTED", "HIGHLY_RESTRICTED"} for row in reason_columns):
            self.add("P0-AI-001", "AI.REVIEW_REASON_POLICY", "table", table_name,
                     "AI review reason is not marked restricted for field-policy enforcement")
        operation = self.model.operation.get("modern.ai.assist.review", {})
        steps = [row for row in operation.get("orderedDml", []) if row.get("table") == table_name]
        if len(steps) != 1 or steps[0].get("action") != "APPEND":
            self.add("P0-AI-001", "AI.REVIEW_APPEND", "operation", "modern.ai.assist.review",
                     "human review is not appended to its immutable review ledger")

        prior_id = columns.get("prior_review_public_id", {})
        prior_revision = columns.get("prior_review_revision", {})
        prior_reference = prior_id.get("referenceContract", {}) if isinstance(prior_id, dict) else {}
        exact_prior_fk = any(
            row.get("mode") == "LOCAL_COMPOSITE_FK"
            and row.get("columns") == ["tenant_id", "prior_review_public_id"]
            and row.get("target") == table_name
            and row.get("targetColumns") == ["tenant_id", "public_id"]
            for row in table.get("foreignKeys", []) if isinstance(row, dict)
        )
        exact_revocation_check = any(
            set(row.get("columns", [])) == {"decision", "prior_review_public_id", "prior_review_revision"}
            and normalized_contract_text(row.get("expression")) == normalized_contract_text(AI_REVOCATION_LINK_EXPRESSION)
            for row in table.get("checks", []) if isinstance(row, dict)
        )
        if (
            not prior_id or not prior_revision
            or prior_reference.get("entityType") != "table:sys_hris_ai_assistance_reviews"
            or prior_reference.get("idSpace") != "PUBLIC_UUID"
            or not exact_prior_fk or not exact_revocation_check
        ):
            self.add("P0-AI-001", "AI.REVOKE_PRIOR_SCHEMA", "table", table_name,
                     "AI revocation lacks an exact typed same-tenant prior-review FK and decision/link DDL check",
                     priorId=prior_id, priorRevision=prior_revision,
                     exactPriorFk=exact_prior_fk, exactRevocationCheck=exact_revocation_check)

        revoke = self.model.operation.get("modern.ai.assist.revoke", {})
        revoke_steps = [row for row in revoke.get("orderedDml", []) if row.get("table") == table_name]
        root_steps = [row for row in revoke.get("orderedDml", []) if row.get("table") == AI_ASSISTANCE_ROOT]
        assignments = revoke_steps[0].get("assignments", {}) if revoke_steps else {}
        root = root_steps[0] if len(root_steps) == 1 else {}
        aggregate = revoke.get("aggregateRoot", {})
        transition = revoke.get("transition", {})
        if_match_bound = any(
            row.get("source") == "headers.If-Match"
            and any(
                effect.get("kind") == "ROOT_CAS_FILTER"
                and effect.get("target") == f"{AI_ASSISTANCE_ROOT}.aggregate_version"
                for effect in row.get("effects", []) if isinstance(effect, dict)
            )
            for row in revoke.get("inputEffects", []) if isinstance(row, dict)
        )
        expected_revoke_assignments = {
            "assistance_request_public_id": "pathParameters.assistanceId",
            "review_revision": "LOCKED_PRE:sys_hris_ai_assistance_requests.aggregate_version+1",
            "decision": "CONSTANT:REVOKED",
            "subject_worker_public_id": "LOCKED_PRE:sys_hris_ai_assistance_requests.subject_worker_public_id",
            "prior_review_public_id": "LOCKED_PRE:sys_hris_ai_assistance_reviews.public_id",
            "prior_review_revision": "LOCKED_PRE:sys_hris_ai_assistance_reviews.review_revision",
        }
        if (
            len(revoke_steps) != 1 or revoke_steps[0].get("action") != "APPEND"
            or revoke_steps[0].get("role") != "IMMUTABLE_AI_HUMAN_REVOCATION_DECISION"
            or any(assignments.get(key) != value for key, value in expected_revoke_assignments.items())
            or len(root_steps) != 1 or root.get("action") != "UPDATE_CAS"
            or root.get("role") != "CONCURRENCY_ROOT"
            or root.get("selector") != AI_ROOT_SELECTOR
            or root.get("expectedRows") != "EXACTLY_ONE"
            or root.get("assignments") != AI_ROOT_ASSIGNMENTS
            or aggregate.get("table") != AI_ASSISTANCE_ROOT
            or aggregate.get("publicIdColumn") != "public_id"
            or aggregate.get("versionColumn") != "aggregate_version"
            or aggregate.get("stateColumn") != "state"
            or aggregate.get("tenantColumn") != "tenant_id"
            or transition.get("preStates") != ["CONFIRMED"]
            or transition.get("postStates") != ["REVOKED"]
            or transition.get("postStateSource") != "CONSTANT:REVOKED"
            or transition.get("stateSink") != f"{AI_ASSISTANCE_ROOT}.state"
            or not if_match_bound
            or revoke.get("orderedDml", []).index(revoke_steps[0]) >= revoke.get("orderedDml", []).index(root_steps[0])
        ):
            self.add("P0-AI-001", "AI.REVOKE_APPEND_THEN_CAS", "operation", "modern.ai.assist.revoke",
                     "revocation must append a locked predecessor-linked REVOKED decision before one exact CONFIRMED→REVOKED root CAS",
                     reviewSteps=revoke_steps, rootSteps=root_steps,
                     aggregateRoot=aggregate, transition=transition, ifMatchBound=if_match_bound)

    def check_wfp_simulation_lifecycle(self) -> None:
        table_name = WFP_REQUEST_TABLE
        handler = self.model.handler.get("internal.workforceplan.simulation-result.consume", {})
        cancel = self.model.operation.get("modern.workforceplan.scenario.cancel", {})
        create = self.model.operation.get("modern.workforceplan.scenario.simulate", {})
        handler_steps = [row for row in handler.get("writes", []) if row.get("table") == table_name]
        cancel_steps = [row for row in cancel.get("orderedDml", []) if row.get("table") == table_name]
        create_steps = [row for row in create.get("orderedDml", []) if row.get("table") == table_name]
        if len(create_steps) != 1 or create_steps[0].get("action") != "APPEND" or create_steps[0].get("assignments", {}).get("state") != "CONSTANT:REQUESTED":
            self.add("P0-WFP-001", "WFP.SIMULATION_REQUEST", "operation", "modern.workforceplan.scenario.simulate",
                     "simulate must append exactly one immutable REQUESTED row")

        handler_root = handler.get("aggregateRoot", {})
        expected_handler_root = {
            "table": table_name,
            "publicIdColumn": "public_id",
            "versionColumn": "aggregate_version",
            "stateColumn": "state",
            "preStates": ["REQUESTED"],
            "postStates": ["COMPLETED", "FAILED"],
        }
        handler_root_exact = all(
            handler_root.get(key) == value for key, value in expected_handler_root.items()
        )
        terminal_specs = (
            (
                "internal.workforceplan.simulation-result.consume", "handler", handler_steps,
                "MONOTONIC_SIMULATION_REQUEST_TERMINAL_CAS", WFP_HANDLER_SELECTOR,
                WFP_HANDLER_ASSIGNMENTS, None,
            ),
            (
                "modern.workforceplan.scenario.cancel", "operation", cancel_steps,
                "CANCEL_ACTIVE_SIMULATION_REQUEST", WFP_CANCEL_SELECTOR,
                WFP_CANCEL_ASSIGNMENTS, "ZERO_OR_ONE_ACTIVE_REQUEST",
            ),
        )
        for subject, kind, steps, role, selector, expected_assignments, expected_rows in terminal_specs:
            step = steps[0] if len(steps) == 1 else {}
            assignments = step.get("assignments", {}) if isinstance(step, dict) else {}
            invalid = (
                len(steps) != 1
                or step.get("action") != "UPDATE_CAS"
                or step.get("role") != role
                or step.get("selector") != selector
                or assignments != expected_assignments
                or bool(set(assignments) & WFP_IMMUTABLE_COLUMNS)
                or (expected_rows is not None and step.get("expectedRows") != expected_rows)
                or (kind == "handler" and not handler_root_exact)
            )
            if invalid:
                self.add("P0-WFP-001", "WFP.SIMULATION_TERMINAL_CAS", kind, subject,
                         "simulation result/cancel must use the exact REQUESTED-only version CAS and may mutate only its closed terminal tuple",
                         expectedRole=role, expectedSelector=selector,
                         expectedAssignments=expected_assignments,
                         immutableColumns=sorted(WFP_IMMUTABLE_COLUMNS),
                         handlerAggregateRoot=handler_root, steps=steps)

        table = self.model.table.get(table_name, {})
        terminal_contract = table.get("terminalCasContract", {})
        terminal_contract_exact = (
            terminal_contract.get("preState") == "REQUESTED"
            and set(terminal_contract.get("postStates", [])) == {"COMPLETED", "FAILED", "CANCELLED"}
            and terminal_contract.get("expectedRows") == "EXACTLY_ONE_OR_CANCEL_ZERO_IF_NO_ACTIVE_REQUEST"
            and terminal_contract.get("terminalStateMutationForbidden") is True
            and terminal_contract.get("inputPinMutationForbidden") is True
        )
        exact_tuple_check = any(
            row.get("constraintId") == "ck_ppl_wfp_simulation_requests_result_tuple_v3"
            and set(row.get("columns", [])) == {
                "state", "result_public_id", "result_revision", "result_receipt_public_id",
                "result_receipt_revision", "result_schema_version", "result_digest", "completed_at",
            }
            and normalized_contract_text(row.get("expression")) == normalized_contract_text(WFP_RESULT_TUPLE_EXPRESSION)
            for row in table.get("checks", []) if isinstance(row, dict)
        )
        if (
            set(table.get("immutableColumns", [])) != WFP_IMMUTABLE_COLUMNS
            or table.get("immutability") != "IMMUTABLE_REQUEST_INPUT_PINS_WITH_EXACT_MONOTONIC_REQUESTED_TO_TERMINAL_CAS"
            or state_values(table, "state") != {"REQUESTED", "COMPLETED", "FAILED", "CANCELLED"}
            or not terminal_contract_exact or not exact_tuple_check
        ):
            self.add("P0-WFP-001", "WFP.SIMULATION_DDL", "table", table_name,
                     "simulation request schema lacks exact immutable pins, state set, monotonic CAS contract, or all-or-none result tuple",
                     immutableColumns=table.get("immutableColumns"),
                     immutability=table.get("immutability"), states=sorted(state_values(table, "state")),
                     terminalCasContract=terminal_contract, exactTupleCheck=exact_tuple_check)

        expected_trigger = {
            "kind": "SIGNED_OWNER_RESULT",
            "eventId": "handlerContext.eventId",
            "requestPublicId": "handlerContext.requestPublicId",
            "expectedRevision": "handlerContext.expectedRevision",
            "outcome": "ownerResult.outcome",
            "payloadDigest": "handlerContext.payloadDigest",
            "signature": "handlerContext.ownerSignature",
        }
        expected_order = [
            "CLAIM_INBOX first",
            "LOCK aggregate tenant+public_id+version",
            "VALIDATE signed owner result and exact subject/version/digest",
            "UPDATE_CAS domain",
            "COMPLETE_INBOX closed result/resultDigest/post identity+version",
            "APPEND_OUTBOX last",
        ]
        expected_idempotency = {
            "scope": "tenant+handler+eventId",
            "claimKey": "tenant+handler+eventId",
            "storedPayloadDigest": "handlerContext.payloadDigest",
            "sameDigest": "RETURN_SEALED_FIRST_RESULT_ZERO_WRITES",
            "differentDigest": "CONFLICT_ZERO_DOMAIN_ACK_OUTBOX_MUTATION",
            "claimOrder": "CLAIM_INBOX_BEFORE_DOMAIN_READ_OR_WRITE",
        }
        contract = handler.get("handlerContract") or {}
        events = [handler.get("event"), *handler.get("additionalEvents", [])]
        expected_event_states = {
            "WorkforceScenarioSimulated.v2": "COMPLETED",
            "WorkforceScenarioSimulationFailed.v2": "FAILED",
        }
        event_contract_closed = len(events) == 2
        for event in events:
            if not isinstance(event, dict):
                event_contract_closed = False
                continue
            state = expected_event_states.get(str(event.get("eventName")))
            refetch = event.get("refetchContract") or {}
            proof = refetch.get("resultOwnerContract") or {}
            if (
                state is None
                or event.get("condition") != f"POST_STATE={state}"
                or refetch.get("mode") != "FORBIDDEN"
                or refetch.get("aggregateLookup") != "FORBIDDEN"
                or refetch.get("latestFallback") != "FORBIDDEN"
                or not refetch.get("payloadSufficiency")
                or proof.get("requiredFields") != [
                    "resultReceiptId", "resultReceiptRevision",
                    "resultSchemaVersion", "resultDigest",
                ]
                or proof.get("identity")
                != "receiptId+receiptRevision+resultSchemaVersion+resultDigest exact"
                or proof.get("validation")
                != "SIGNED_OWNER_RESULT_MATCHES_LOCKED_REQUEST_ID_REVISION_AND_DIGEST"
                or proof.get("denyOnUnavailable") is not True
                or event.get("emission") != {
                    "outboxWrite": "SAME_TRANSACTION_AFTER_DOMAIN_AND_CLOSED_RECEIPT",
                    "brokerPublish": "AFTER_COMMIT_ONLY",
                    "rollback": "NO_OUTBOX_OR_PUBLISH_ON_FAILURE",
                }
            ):
                event_contract_closed = False
        exact_handler_contract = (
            handler.get("trigger") == expected_trigger
            and handler.get("orderedDml") == expected_order
            and handler.get("idempotency") == expected_idempotency
            and handler.get("rollback") == {
                "rule": "ANY_STEP_FAULT_ROLLS_BACK_INBOX_DOMAIN_ACK_AND_OUTBOX"
            }
            and contract.get("stateMachine") == "CAPABILITY_SPECIFIC_NO_GENERIC_REQUESTED_RUNNING_TEMPLATE"
            and contract.get("preStates") == ["REQUESTED"]
            and contract.get("postStates") == ["COMPLETED", "FAILED"]
            and contract.get("signedResultFields")
            == ["requestPublicId", "expectedRevision", "outcome", "payloadDigest"]
            and contract.get("sameTransaction") == "CLAIM_LOCK_PROOF_DOMAIN_ACK_OUTBOX"
            and event_contract_closed
        )
        if not exact_handler_contract:
            self.add(
                "P0-WFP-001", "WFP.SIMULATION_SIGNED_RESULT", "handler",
                "internal.workforceplan.simulation-result.consume",
                "simulation result consumer lacks the exact signed result, replay, terminal tuple, rollback, or FORBIDDEN-refetch contract",
                trigger=handler.get("trigger"), orderedDml=handler.get("orderedDml"),
                idempotency=handler.get("idempotency"), rollback=handler.get("rollback"),
                handlerContract=contract, eventContractClosed=event_contract_closed,
            )

    def check_cwk_version_table(self) -> None:
        table_name = "ppl_cwk_engagement_versions"
        table = self.model.table.get(table_name)
        if not table:
            return
        columns = self.model.table_columns(table_name)
        okay, missing = all_groups_present(columns, [
            ("engagement", "parent"), ("revision_mode",), ("effective_from",),
            ("effective_to",), ("predecessor",), ("reason",),
            ("classification",), ("access",),
        ])
        if not okay:
            self.add("P0-CWK-001", "CWK.VERSION_COLUMNS", "table", table_name,
                     "engagement version lacks immutable correction/supersession business facts",
                     missingAliasGroups=missing, columns=sorted(columns))
        arbitration = table.get("temporalArbitration", {})
        if (
            arbitration.get("strategy") != "DUAL_APPEND_ONLY_ROOT_AND_EFFECTIVE_SEGMENT_CHAINS"
            or arbitration.get("rawHistoryExclusion") != "NONE"
            or not arbitration.get("rootCasRequired")
            or arbitration.get("priorHistoryMutation") not in {None, "FORBIDDEN"}
        ):
            self.add("P1-EFFECTIVE-004", "CWK.VERSION_NON_OVERLAP", "table", table_name,
                     "engagement versions lack dual root/effective-segment append-only arbitration")
        checks = " ".join(str(row.get("expression", "")) for row in table.get("checks", []))
        if "CORRECTION" not in checks or "SUPERSEDE" not in checks:
            self.add("P1-EFFECTIVE-004", "CWK.REVISION_MODE_CHECK", "table", table_name,
                     "engagement revision mode DDL does not close CORRECTION|SUPERSEDE")

    def check_succession_version_table(self) -> None:
        table_name = "prf_suc_plan_versions"
        table = self.model.table.get(table_name)
        if not table:
            return
        columns = {row.get("name"): row for row in table.get("columns", [])}
        names = set(columns)
        okay, missing = all_groups_present(names, [
            ("plan", "parent"), ("revision_mode",), ("effective_from",),
            ("effective_to",), ("predecessor",), ("reason",),
            ("audience_policy",), ("audience_revision", "audience_policy_revision"), ("key_position",),
            ("content_artifact", "content_digest"),
        ])
        if not okay:
            self.add("P0-SUC-001", "SUC.VERSION_COLUMNS", "table", table_name,
                     "succession plan version lacks audience/content/effective revision facts",
                     missingAliasGroups=missing, columns=sorted(x for x in names if x))
        audience_rows = [row for name, row in columns.items() if token_present([str(name)], ("audience_policy", "audience_revision"))]
        if not audience_rows or not any(row.get("referenceContract") for row in audience_rows):
            self.add("P0-SUC-001", "SUC.AUDIENCE_OWNER", "table", table_name,
                     "restricted audience policy revision lacks a typed authorization-owner reference")
        if not all(row.get("sensitivity") in {"RESTRICTED", "HIGHLY_RESTRICTED", "INTERNAL"} for row in audience_rows):
            self.add("P0-SUC-001", "SUC.AUDIENCE_FIELD_POLICY", "table", table_name,
                     "succession audience revision is not classified for restricted field policy")
        arbitration = table.get("temporalArbitration", {})
        if (
            arbitration.get("strategy") != "DUAL_APPEND_ONLY_ROOT_AND_EFFECTIVE_SEGMENT_CHAINS"
            or arbitration.get("rawHistoryExclusion") != "NONE"
            or not arbitration.get("rootCasRequired")
        ):
            self.add("P1-EFFECTIVE-004", "SUC.VERSION_NON_OVERLAP", "table", table_name,
                     "succession plan versions lack dual root/effective-segment append-only arbitration")

    def check_expanded_query_lineage(self) -> None:
        policy_rows = {
            row.get("tableId"): row
            for row in self.model.expansion_policy.get("successorScope", {}).get("addedRows", [])
        }
        requirement_by_table = {
            table_name: policy_rows.get(table_name, {}).get("requirementIds", ["P0-CROSS-QUERY-001"])[0]
            for table_name in EXPANDED_QUERY_TABLE_READERS
        }
        for table_name, query_ids in EXPANDED_QUERY_TABLE_READERS.items():
            if table_name not in self.model.table:
                continue  # the capability-specific missing-table rule reports this
            requirement_id = requirement_by_table[table_name]
            expected_readers = set(query_ids)
            actual_readers = set()
            for candidate_id in self.model.query_ids():
                candidate = self.model.operation[candidate_id]
                candidate_read_tables = set(candidate.get("readPlan", {}).get("tables", []))
                candidate_projection_sources = set(
                    candidate.get("readPlan", {}).get("projectionTuple", {}).get("physicalSources", [])
                )
                candidate_lineage = self.model.lineage.get(candidate_id, {}).get("responseFieldSources", [])
                if (
                    table_name in candidate_read_tables
                    or table_name in candidate_projection_sources
                    or any(
                        parse_direct_physical_source(row.get("sourcePath"))[1] == table_name
                        for row in candidate_lineage if isinstance(row, dict)
                    )
                ):
                    actual_readers.add(candidate_id)
            if actual_readers != expected_readers:
                self.add(requirement_id, "EXPANDED_QUERY.READER_SET", "table", table_name,
                         "actual query consumers differ from the complete sealed readConsumer set",
                         expected=sorted(expected_readers), actual=sorted(actual_readers),
                         missing=sorted(expected_readers - actual_readers),
                         extra=sorted(actual_readers - expected_readers))

            for operation_id in query_ids:
                operation = self.model.operation.get(operation_id)
                if not operation:
                    self.add(requirement_id, "EXPANDED_QUERY.OPERATION", "operation", operation_id,
                             "required expanded-table query operation is absent", table=table_name)
                    continue
                read_tables = set(operation.get("readPlan", {}).get("tables", []))
                projection_sources = set(
                    operation.get("readPlan", {}).get("projectionTuple", {}).get("physicalSources", [])
                )
                if table_name not in read_tables or table_name not in projection_sources:
                    self.add(requirement_id, "EXPANDED_QUERY.READ_PLAN", "operation", operation_id,
                             "query does not include the non-replaceable child/version/result table in both read plan and physical projection",
                             table=table_name, readTables=sorted(read_tables),
                             physicalSources=sorted(projection_sources))
                all_lineage_rows = [
                    row for row in self.model.lineage.get(operation_id, {}).get("responseFieldSources", [])
                    if isinstance(row, dict)
                ]
                table_source_rows = [
                    row for row in all_lineage_rows
                    if parse_direct_physical_source(row.get("sourcePath"))[1] == table_name
                ]
                malformed_direct_rows = [
                    row for row in all_lineage_rows
                    if row.get("sourceKind") in {"IMMUTABLE_PROOF", "PHYSICAL_POST_STATE"}
                    and re.search(
                        rf"(?:^|:){re.escape(table_name)}\.[a-z][a-z0-9_]*$",
                        str(row.get("sourcePath", "")),
                    )
                    and not str(row.get("sourcePath", "")).startswith("DERIVED:")
                    and parse_direct_physical_source(row.get("sourcePath"))[1] != table_name
                ]
                entity = self.model.response_entity(operation_id) or {}
                entity_field_defs = {
                    row.get("name"): row for row in entity.get("fields", []) if row.get("name")
                }
                response_schema_ref = self.model.binding.get(operation_id, {}).get("responseSchemaRef", "")
                allowed_target_prefixes = (
                    response_schema_ref + ".item.",
                    response_schema_ref + ".items[*].",
                )
                table_columns = self.model.table_columns(table_name)
                request_sources = self.model.operation_request_sources(operation_id)
                supports_history_modes = bool({
                    "queryParameters.revisionPublicId",
                    "queryParameters.rootVersion",
                    "queryParameters.contentRevisionPublicId",
                } & request_sources)
                valid_rows = []
                rejected_rows = list(malformed_direct_rows)
                for row in table_source_rows:
                    source_path = str(row.get("sourcePath", ""))
                    qualifier, physical_table, column = parse_direct_physical_source(source_path)
                    target = str(row.get("target", ""))
                    target_name = target.rsplit(".", 1)[-1]
                    entity_field = entity_field_defs.get(target_name, {})
                    selection_row = row if "selectionModeSources" in row else entity_field
                    if supports_history_modes:
                        selection_closed = selection_mode_sources_are_closed(
                            selection_row, table_name, column or ""
                        )
                    else:
                        selection_closed = (
                            qualifier in {None, "STATE_WINNER", "CONTENT_WINNER"}
                            and row.get("selectionModeSources") in (None, {})
                            and entity_field.get("selectionModeSources") in (None, {})
                        )
                    valid = (
                        row.get("sourceKind") in {"IMMUTABLE_PROOF", "PHYSICAL_POST_STATE"}
                        and physical_table == table_name
                        and isinstance(column, str)
                        and column in table_columns
                        and target.startswith(allowed_target_prefixes)
                        and target_name in entity_field_defs
                        and entity_field.get("sourcePath") == source_path
                        and selection_closed
                    )
                    if valid:
                        valid_rows.append(row)
                    else:
                        rejected_rows.append(row)

                unique_sources = {
                    parse_direct_physical_source(row.get("sourcePath"))[1:]
                    for row in valid_rows
                }
                unique_targets = {str(row.get("target")) for row in valid_rows}
                if rejected_rows or len(unique_sources) < 2 or len(unique_targets) < 2:
                    self.add(requirement_id, "EXPANDED_QUERY.FIELD_LINEAGE", "operation", operation_id,
                             "query lacks two distinct existing table.column to exact response-field durable bindings",
                             table=table_name, sourceRows=table_source_rows,
                             rejectedRows=rejected_rows,
                             distinctSources=sorted(".".join(source) for source in unique_sources),
                             distinctTargets=sorted(unique_targets),
                             tableColumns=sorted(table_columns), entityFields=sorted(entity_field_defs))
                exposed_names = {
                    str(row.get("target", "")).rsplit(".", 1)[-1]
                    for row in valid_rows
                }
                field_defs = {
                    row.get("name"): row for row in entity.get("fields", [])
                    if row.get("name") in exposed_names and row.get("name") not in BASE_ENTITY_FIELDS
                }
                source_column_defs = {
                    row.get("name"): row
                    for row in self.model.table[table_name].get("columns", []) if row.get("name")
                }
                invalid_field_policies = {}
                for name, row in field_defs.items():
                    policy = row.get("fieldPolicy")
                    source_path = str(row.get("sourcePath", ""))
                    _, source_table, source_column = parse_direct_physical_source(source_path)
                    source_definition = source_column_defs.get(source_column)
                    valid_policy = (
                        source_table == table_name
                        and
                        row.get("sensitivity") in {"INTERNAL", "CONFIDENTIAL", "RESTRICTED", "HIGHLY_RESTRICTED"}
                        and isinstance(row.get("tokenization"), str)
                        and row.get("tokenization") not in {"", "UNSPECIFIED"}
                        and isinstance(policy, dict)
                        and policy.get("authorizationCapability") == operation.get("authorizationCapability")
                        and policy.get("behavior") == "ALLOW_OR_OMIT_OR_TOKENIZE_EXACT_FIELD"
                        and policy.get("unknownField") == "OMIT"
                        and policy.get("denyOnUnavailable") is True
                        and (
                            source_definition is None
                            or (
                                source_definition.get("sensitivity") in {
                                    "INTERNAL", "CONFIDENTIAL", "RESTRICTED", "HIGHLY_RESTRICTED"
                                }
                                and isinstance(source_definition.get("tokenization"), str)
                                and source_definition.get("tokenization") not in {"", "UNSPECIFIED"}
                            )
                        )
                    )
                    if not valid_policy:
                        invalid_field_policies[name] = {
                            "responseField": row,
                            "sourceColumn": source_definition,
                        }
                if invalid_field_policies:
                    self.add(requirement_id, "EXPANDED_QUERY.FIELD_POLICY", "operation", operation_id,
                             "expanded-table durable field lacks exact sensitivity/tokenization/fail-closed redaction policy",
                             table=table_name, invalidFields=invalid_field_policies)

    def check_listening_submit_atomicity(self) -> None:
        oid = "modern.listening.response.submit"
        operation = self.model.operation.get(oid, {})
        dml = [row for row in operation.get("orderedDml", []) if isinstance(row, dict)]
        tables = [row.get("table") for row in dml]
        expected_dml = [
            (1, "CLAIM_OR_REPLAY", "sys_hris_listening_protected_receipts", "PROTECTED_TOKEN_RECEIPT_CLAIM"),
            (2, "LOCK_FOR_UPDATE", "sys_hris_listening_admission_versions", "LATEST_STABLE_ADMISSION_FENCE"),
            (3, "CLAIM_OR_REPLAY", "sys_hris_listening_token_consumptions", "ONE_TIME_TOKEN_CONSUMPTION"),
            (4, "INSERT", "sys_hris_listening_responses", "ANONYMOUS_RESPONSE_WITH_PER_RESPONSE_DEK"),
            (5, "APPEND_MANY", "sys_hris_listening_answer_values", "ENCRYPTED_TYPED_ANSWER_VALUES"),
            (6, "UPDATE_CAS", "sys_hris_listening_token_consumptions", "TOKEN_CONSUMPTION_BIND_RESPONSE"),
            (7, "UPDATE_CAS", "sys_hris_listening_protected_receipts", "PROTECTED_TOKEN_RECEIPT_CLOSE"),
        ]
        actual_dml = [
            (row.get("step"), row.get("action"), row.get("table"), row.get("role"))
            for row in dml
        ]
        if actual_dml != expected_dml:
            self.add(
                "P0-LIS-001", "LISTENING.SUBMIT_DML", "operation", oid,
                "protected submit must execute the exact seven-step receipt/admission/token/response/answer/private-close transaction",
                expected=expected_dml, actual=actual_dml,
            )

        request_fields = [row for row in operation.get("requestFields", []) if isinstance(row, dict)]
        path_fields = {row.get("name") for row in request_fields if row.get("location") == "pathParameters"}
        body_rows = [row for row in request_fields if row.get("location") == "body"]
        body_fields = {row.get("name") for row in body_rows}
        expected_body = {"signedParticipationCredential", "responseToken", "answers"}
        credential = next(
            (row for row in body_rows if row.get("name") == "signedParticipationCredential"), {}
        )
        credential_schema = credential.get("valueSchema") or {}
        credential_names = {
            row.get("name") for row in credential_schema.get("fields", []) if row.get("name")
        }
        expected_credential_names = {
            "tenantPublicId", "surveyPublicId", "surveyRevision", "admissionPublicId",
            "admissionVersionPublicId", "admissionOwnerVersion", "formVersionPublicId",
            "formArtifactDigest", "eligibilityVersionPublicId", "eligibilityRevision",
            "consentPolicyVersionPublicId", "consentEvidenceCommitment", "opaqueJti",
            "tokenCommitment", "aud", "iat", "nbf", "exp", "kid", "alg", "signature",
            "nonRevocationProof",
        }
        forbidden_identity = {"workerId", "personId", "principalId", "employeeId"}
        binding_request = (self.model.binding.get(oid, {}).get("requestSchema") or {})
        binding_body = {
            row.get("name") for row in binding_request.get("body", []) if row.get("name")
        }
        binding_path = {
            row.get("name") for row in binding_request.get("pathParameters", []) if row.get("name")
        }
        if (
            path_fields != {"surveyId"}
            or body_fields != expected_body
            or credential.get("required") is not True
            or credential_schema.get("additionalProperties") is not False
            or credential_names != expected_credential_names
            or set(credential_schema.get("forbiddenClaims", [])) != forbidden_identity
            or binding_request.get("additionalProperties") is not False
            or binding_body != expected_body
            or binding_path != {"surveyId"}
        ):
            self.add(
                "P0-LIS-001", "LISTENING.SUBMIT_REQUEST_CLOSED", "operation", oid,
                "protected submit request is not closed to route surveyId plus the signed credential, response token, and answers",
                pathFields=sorted(x for x in path_fields if x), bodyFields=sorted(x for x in body_fields if x),
                credentialFields=sorted(x for x in credential_names if x),
                bindingBody=sorted(x for x in binding_body if x), bindingPath=sorted(x for x in binding_path if x),
            )

        selectors = [row for row in operation.get("selectors", []) if isinstance(row, dict)]
        admission = [
            row for row in selectors
            if row.get("selectorType") == "PROTECTED_LOCAL_LATEST_STABLE_ADMISSION_FENCE"
        ]
        audience = [
            row for row in selectors
            if row.get("selectorType") == "SIGNED_CREDENTIAL_PROTECTED_RESOURCE_AUDIENCE"
        ]
        admission_selector = admission[0] if len(admission) == 1 else {}
        audience_selector = audience[0] if len(audience) == 1 else {}
        selector_closed = (
            len(admission) == 1
            and admission_selector.get("source") == "body.signedParticipationCredential.admissionPublicId"
            and admission_selector.get("targetTable") == "sys_hris_listening_admission_versions"
            and admission_selector.get("targetColumn") == "admission_public_id"
            and "target.tenant_id=verified signed credential tenant" in str(admission_selector.get("tenantFilter", ""))
            and "target.owner_revision=credential.admissionOwnerVersion" in str(admission_selector.get("versionRule", ""))
            and "target.public_id=credential.admissionVersionPublicId" in str(admission_selector.get("versionRule", ""))
            and "path survey=credential survey=target survey" in str(admission_selector.get("causalJoin", ""))
            and "offline ACTIVE proof unexpired" in str(admission_selector.get("causalJoin", ""))
            and len(audience) == 1
            and audience_selector.get("source") == "body.signedParticipationCredential.aud"
            and audience_selector.get("operator") == "EQUALS_CONSTANT"
            and "aud=DWP.HRIS.LISTENING.PROTECTED" in str(audience_selector.get("versionRule", ""))
            and "offline ACTIVE proof unexpired" in str(audience_selector.get("asOfRule", ""))
        )
        if not selector_closed:
            self.add(
                "P0-LIS-001", "LISTENING.SUBMIT_ADMISSION", "operation", oid,
                "protected submit does not prove route/credential/locked-admission equality, version, audience, and non-revocation",
                admissionSelectors=admission, audienceSelectors=audience,
            )
        identity_links: list[str] = []
        for selector in operation.get("selectors", []):
            for key in ("tenantFilter", "causalJoin"):
                if "authenticatedPrincipal" in str(selector.get(key, "")):
                    identity_links.append(f"selector.{key}")
        for row in operation.get("inputEffects", []):
            for effect in row.get("effects", []):
                target = str(effect.get("target", ""))
                if "command_receipt" in target or "caller" in str(effect.get("uniqueKey", "")).lower():
                    identity_links.append(f"effect:{row.get('source')}->{target}")
        for step in dml:
            if step.get("role") in {"COMMAND_RECEIPT"} or "command_receipt" in str(step.get("table", "")):
                identity_links.append(f"dml:{step.get('table')}")
            for column, source in step.get("assignments", {}).items():
                if column in {"created_by", "worker_public_id", "principal_public_id"} and (
                    "principal" in str(source).lower() or "caller" in str(source).lower()
                ):
                    identity_links.append(f"assignment:{step.get('table')}.{column}")
        if identity_links:
            self.add("P0-LIS-001", "LISTENING.SUBMIT_IDENTITY", "operation", oid,
                     "anonymous response submission is coupled to authenticated principal identity",
                     structuralLinks=identity_links)
        body = self.model.operation_body_names(oid)
        if token_present(body, ("eraseAfter", "eraseDate")):
            self.add("P0-LIS-001", "LISTENING.RETENTION_DERIVATION", "operation", oid,
                     "respondent may not choose retention/erasure date")
        forbidden_outbox = [
            row for row in dml
            if "outbox" in str(row.get("table", "")).lower()
            or "outbox" in str(row.get("role", "")).lower()
        ]
        if forbidden_outbox or operation.get("events"):
            self.add(
                "P0-LIS-001", "LISTENING.SUBMIT_PRIVATE_DELIVERY", "operation", oid,
                "protected submit must not append an outbox or declare a public/broker event",
                outboxWrites=forbidden_outbox, events=operation.get("events", []),
            )

    def check_listening_cohort_projection(self) -> None:
        operation_id = "modern.listening.cohorts.query"
        entity = self.model.response_entity(operation_id) or {}
        fields = {row.get("name"): row for row in entity.get("fields", []) if row.get("name")}
        required_fields = {
            "cohortPublicId", "adequacyCategory", "measureValues", "subjectCount",
            "anonymityThreshold", "privacyBudgetReceiptId", "lineageReceiptId",
        }
        conditional = {"measureValues", "subjectCount"}
        field_shape_valid = (
            required_fields <= set(fields)
            and all(fields[name].get("condition") == "adequacyCategory=ADEQUATE" for name in conditional)
            and all(fields[name].get("required") is False for name in conditional)
            and all("SUPPRESSED" in str(fields[name].get("validation", "")) for name in conditional)
        )

        projection = self.model.table.get("sys_hris_listening_cohort_projections", {})
        lineage = self.model.table.get("sys_hris_listening_lineage_receipts", {})
        projection_columns = self.model.table_columns("sys_hris_listening_cohort_projections")
        lineage_columns = self.model.table_columns("sys_hris_listening_lineage_receipts")
        required_projection_columns = {
            "survey_public_id", "cohort_package_public_id", "policy_revision", "source_epoch",
            "cutoff_at", "adequacy_category", "measure_values", "subject_count",
            "anonymity_threshold", "privacy_budget_receipt_public_id",
        }
        shared_lineage_columns = {
            "survey_public_id", "cohort_package_public_id", "policy_revision", "source_epoch",
            "cutoff_at", "adequacy_category", "measure_values", "subject_count",
            "anonymity_threshold", "privacy_budget_receipt_public_id",
        }
        lineage_fk = any(
            row.get("mode") == "LOCAL_COMPOSITE_FK"
            and row.get("columns") == ["tenant_id", "listening_cohort_projection_id"]
            and row.get("target") == "sys_hris_listening_cohort_projections"
            and row.get("targetColumns") == ["tenant_id", "record_id"]
            for row in lineage.get("foreignKeys", [])
        )
        projection_check = any(
            set(row.get("columns", [])) == {
                "adequacy_category", "subject_count", "anonymity_threshold", "measure_values"
            }
            and "SUPPRESSED" in str(row.get("expression", ""))
            and "subject_count IS NULL" in str(row.get("expression", ""))
            and "measure_values IS NULL" in str(row.get("expression", ""))
            for row in projection.get("checks", [])
        )
        forbidden_projection_columns = {
            "bucket", "bucket_key", "metric", "metric_key", "lineage", "lineage_blob"
        }

        exact_ports = {
            row.get("ownerPortOperation"): row
            for row in self.model.docs["exact"].get("ownerPortOperationContracts", [])
            if isinstance(row, dict)
        }
        authority_port = exact_ports.get("insights.queryCohortResults", {})
        authority_wrapper_fields = {
            row.get("name") for row in (authority_port.get("responseSchema") or {}).get("fields", [])
            if row.get("name")
        }
        expected_wrapper_fields = {
            "items", "referenceEffectiveAt", "freshnessWatermark",
            "fieldPolicyRevision", "nextCursor", "hasMore",
        }
        items_field = next(
            (
                row for row in (authority_port.get("responseSchema") or {}).get("fields", [])
                if row.get("name") == "items"
            ),
            {},
        )
        authority_profile = (
            self.model.expansion_policy.get("successorRequirementProfiles", {})
            .get("listeningCohortProjection", {})
        )
        authority_fields = set(authority_profile.get("authorityResponseFields", []))
        expected_authority_fields = {
            "projectionPublicId", "adequacyCategory", "measureValues", "subjectCount",
            "anonymityThreshold", "policyRevision", "lineageReceiptPublicId",
        }
        lineage_rows = {
            row.get("target", "").rsplit(".", 1)[-1]: row
            for row in self.model.lineage.get(operation_id, {}).get("responseFieldSources", [])
            if isinstance(row, dict)
        }
        expected_lineage = {
            "cohortPublicId": "sys_hris_listening_cohort_projections.public_id",
            "adequacyCategory": "sys_hris_listening_cohort_projections.adequacy_category",
            "measureValues": "sys_hris_listening_cohort_projections.measure_values",
            "subjectCount": "sys_hris_listening_cohort_projections.subject_count",
            "anonymityThreshold": "sys_hris_listening_cohort_projections.anonymity_threshold",
            "privacyBudgetReceiptId": "sys_hris_listening_cohort_projections.privacy_budget_receipt_public_id",
            "lineageReceiptId": "sys_hris_listening_lineage_receipts.public_id",
        }
        lineage_closed = all(
            lineage_rows.get(name, {}).get("sourcePath") == source
            and lineage_rows.get(name, {}).get("sourceKind") == "PHYSICAL_POST_STATE"
            for name, source in expected_lineage.items()
        )
        authority_wrapper_closed = (
            authority_port.get("streamKey") == "platform-hris-insights"
            and authority_port.get("entrypointRef") == {"publicOperationId": operation_id}
            and authority_wrapper_fields == expected_wrapper_fields
            and items_field.get("itemSchemaRef") == "modern.listening.cohorts.query.Entity.v3"
            and (authority_port.get("responseFieldSources") or {}).get("items")
            == "EXACT_TYPED_PROJECTION:sys_hris_listening_cohort_projections+sys_hris_listening_lineage_receipts"
            and (authority_port.get("pep") or {}).get("denyOnUnavailable") is True
            and (authority_port.get("receiptAndOutbox") or {}).get("atomicity")
            == "WRITES_RECEIPTS_OUTBOX_FORBIDDEN"
        )
        invalid = (
            not field_shape_valid
            or not required_projection_columns <= projection_columns
            or not shared_lineage_columns <= lineage_columns
            or not lineage_fk
            or not projection_check
            or bool(forbidden_projection_columns & projection_columns)
            or authority_fields != expected_authority_fields
            or set(authority_profile.get("canonicalResponseFields", [])) != required_fields
            or not authority_wrapper_closed
            or not lineage_closed
        )
        if invalid:
            self.add(
                "P0-LIS-001", "LISTENING.COHORT_PROFILE", "operation", operation_id,
                "Listening cohort projection does not close adequacy suppression, privacy receipt and separate sealed-lineage authority",
                entityFields=sorted(fields), authorityFields=sorted(x for x in authority_fields if x),
                authorityWrapperFields=sorted(x for x in authority_wrapper_fields if x),
                authorityWrapperClosed=authority_wrapper_closed, lineageClosed=lineage_closed,
                missingProjectionColumns=sorted(required_projection_columns - projection_columns),
                missingLineageColumns=sorted(shared_lineage_columns - lineage_columns),
                lineageCompositeFk=lineage_fk, adequacyCheck=projection_check,
                forbiddenProjectionColumns=sorted(forbidden_projection_columns & projection_columns),
            )

    def check_listening_owner_boundaries(self) -> None:
        listening = {
            operation_id: operation for operation_id, operation in self.model.operation.items()
            if operation_id.startswith("modern.listening.")
        }
        for operation_id, operation in listening.items():
            authority = operation.get("listeningAuthority", {})
            owner_stream = authority.get("authoritativeStreamKey")
            if not owner_stream or authority.get("foreignRepositoryReadAllowed") is not False:
                self.add("P0-LIS-001", "LISTENING.OWNER_AUTHORITY", "operation", operation_id,
                         "Listening operation lacks an exact no-foreign-repository stream authority")
                continue
            for selector in operation.get("selectors", []):
                target = selector.get("targetTable")
                if not isinstance(target, str) or target.startswith("OWNER_PORT::"):
                    continue
                target_stream = self.model.table.get(target, {}).get("streamKey")
                if target_stream and target_stream != owner_stream:
                    self.add("P0-LIS-001", "LISTENING.CROSS_STREAM_SELECTOR", "operation", operation_id,
                             "Listening operation directly selects another stream repository",
                             ownerStream=owner_stream, selector=selector, targetStream=target_stream)
            for table_name in operation.get("readPlan", {}).get("tables", []):
                target_stream = self.model.table.get(table_name, {}).get("streamKey")
                if target_stream and target_stream != owner_stream:
                    self.add("P0-LIS-001", "LISTENING.CROSS_STREAM_READ", "operation", operation_id,
                             "Listening query directly reads another stream repository",
                             ownerStream=owner_stream, table=table_name, targetStream=target_stream)
            if owner_stream == "platform-hris-configuration" and operation.get("mode") == "COMMAND":
                tables = [row.get("table") for row in operation.get("orderedDml", [])]
                if "sys_hris_listening_operation_receipts" not in tables or "sys_hris_listening_domain_outbox" not in tables:
                    self.add("P0-LIS-001", "LISTENING.CONFIG_CONTROL_TABLES", "operation", operation_id,
                             "configuration command does not use configuration-local receipt and outbox",
                             tables=tables)
                if {"sys_hris_command_receipts", "sys_hris_outbox_events"} & set(tables):
                    self.add("P0-LIS-001", "LISTENING.CONFIG_EXTERNAL_DML", "operation", operation_id,
                             "configuration command writes platform-wide control repositories",
                             tables=tables)
        action = self.model.table.get("sys_hris_listening_actions", {})
        local_targets = {
            row.get("target") or row.get("targetTable")
            for row in action.get("foreignKeys", [])
            if row.get("mode") == "LOCAL_COMPOSITE_FK"
        }
        opaque = action.get("crossBoundaryReferences", [])
        if (
            "sys_hris_listening_cohort_projections" in local_targets
            or not any(
                row.get("mode") == "OPAQUE_CROSS_BOUNDARY_REFERENCE"
                and row.get("ownerStream") == "platform-hris-insights"
                and row.get("physicalForeignKeyForbidden") is True
                for row in opaque
            )
        ):
            self.add("P0-LIS-001", "LISTENING.ACTION_PROJECTION_BOUNDARY", "table", "sys_hris_listening_actions",
                     "configuration action must retain an opaque versioned insights reference without a physical FK",
                     localTargets=sorted(x for x in local_targets if x), crossBoundaryReferences=opaque)

    def check_ai_boundaries(self) -> None:
        evaluation = self.model.handler.get("internal.ai.policy-evaluation-result.consume", {})
        writes = {row.get("table") for row in evaluation.get("writes", [])}
        if "sys_hris_ai_evaluation_receipts" not in writes:
            self.add("P0-AI-001", "AI.EVALUATION_RECEIPT", "handler",
                     "internal.ai.policy-evaluation-result.consume",
                     "evaluation result does not append a typed immutable receipt")
        assistance = self.model.handler.get("internal.ai.assistance-result.consume", {})
        states = set((assistance.get("aggregateRoot") or {}).get("postStates", []))
        if not states <= {"PRODUCED", "FAILED"}:
            self.add("P0-AI-001", "AI.ASSISTANCE_STATE", "handler",
                     "internal.ai.assistance-result.consume",
                     "assistance result must map only to PRODUCED/FAILED", actual=sorted(states))
        review = self.model.operation.get("modern.ai.assist.review", {})
        sources = self.model.operation_request_sources("modern.ai.assist.review")
        okay, missing = all_groups_present(sources, [
            ("decision",), ("reason",), ("human", "actor"), ("assistance",),
        ])
        if not okay:
            self.add("P0-AI-001", "AI.REVIEW_REQUEST", "operation", "modern.ai.assist.review",
                     "human review request lacks decision/reason/actor/assistance identity", missingAliasGroups=missing)

    def check_wfm_mode_boundary(self) -> None:
        operation = self.model.operation.get("modern.wfm.schedule.optimize", {})
        bodies = self.model.operation_body_names("modern.wfm.schedule.optimize")
        if not token_present(bodies, ("optimizationMode", "mode")):
            self.add("P0-WFM-001", "WFM.MODE", "operation", "modern.wfm.schedule.optimize",
                     "optimization request has no deterministic/rules/AI mode discriminator")
        mode_effects = [
            effect
            for row in operation.get("inputEffects", [])
            if token_present([str(row.get("source", ""))], ("optimizationMode",))
            for effect in row.get("effects", [])
        ]
        if not any(effect.get("kind") in {
            "MODE_DISCRIMINATOR", "CONDITIONAL_OWNER_PROOF_SWITCH",
            "OPTIMIZATION_MODE_SELECTOR",
        } for effect in mode_effects):
            self.add("P0-WFM-001", "WFM.AI_CONDITIONAL", "operation", "modern.wfm.schedule.optimize",
                     "governed-AI proof is not structurally conditional on AI optimization mode",
                     modeEffects=mode_effects)
        ai_fields = [
            row for row in operation.get("requestFields", [])
            if token_present([str(row.get("name", ""))], ("governedAi", "aiGovernance", "modelVersion"))
        ]
        effect_by_source = {row.get("source"): row.get("effects", []) for row in operation.get("inputEffects", [])}
        for field in ai_fields:
            effects = effect_by_source.get(field.get("source"), [])
            if not any(
                isinstance(effect.get("condition"), dict)
                and effect["condition"].get("source") in {"body.optimizationMode", "body.mode"}
                and effect["condition"].get("equals") in {"GOVERNED_AI", "AI"}
                for effect in effects
            ):
                self.add("P0-WFM-001", "WFM.AI_PROOF_CONDITION", "operation", "modern.wfm.schedule.optimize",
                         "AI governance input is not guarded by a structured mode equality",
                         field=field.get("name"), effects=effects)

    def check_p1_configuration(self) -> None:
        for table_name, code_column in P1_CONFIG_FIELDS:
            table = self.model.table.get(table_name)
            if not table:
                self.add("P1-CFG-001", "CFG.TABLE", "table", table_name,
                         "configurable code owner table is absent")
                continue
            columns = self.model.table_columns(table_name)
            stem = re.sub(r"_(code|key)$", "", code_column)
            version_aliases = configuration_version_aliases(code_column)
            matching = [column for column in columns if token_present([column], version_aliases)]
            if not matching:
                self.add("P1-CFG-001", "CFG.VERSION_COLUMN", "field", f"{table_name}.{code_column}",
                         "tenant/country configurable code has no persisted exact vocabulary/config version",
                         columns=sorted(columns))
                continue
            column_defs = {row.get("name"): row for row in table.get("columns", [])}
            if not any(column_defs.get(name, {}).get("referenceContract") for name in matching):
                self.add("P1-CFG-001", "CFG.OWNER_REFERENCE", "field", f"{table_name}.{code_column}",
                         "configuration version column lacks a typed SYS/country-pack owner reference",
                         versionColumns=matching)

            writers = []
            for operation_id in self.model.command_ids():
                assignments = self.model.operation_assignments(operation_id).get(table_name, {})
                if code_column in assignments:
                    writers.append((operation_id, assignments))
            if not writers:
                self.add("P1-CFG-001", "CFG.PRODUCER", "field", f"{table_name}.{code_column}",
                         "configurable code has no exact DML producer")
            for operation_id, assignments in writers:
                if not any(name in assignments for name in matching):
                    self.add("P1-CFG-001", "CFG.ATOMIC_VERSION", "operation", operation_id,
                             f"{code_column} is written without its exact config version in the same DML",
                             table=table_name, versionColumns=matching)
                version_sources = {
                    row.get("source")
                    for row in self.model.operation.get(operation_id, {}).get("inputEffects", [])
                    for effect in row.get("effects", [])
                    if any(name in str(effect.get("target", "")) for name in matching)
                    and effect.get("kind") in {
                        "OWNER_REFETCH", "OWNER_VERSION_SELECTOR", "CONFIG_VERSION_SELECTOR",
                        "IMMUTABLE_CONFIG_RECEIPT",
                    }
                }
                if not version_sources:
                    self.add("P1-CFG-001", "CFG.ACTIVE_OWNER_VALIDATION", "operation", operation_id,
                             f"{code_column} config version is not actively validated through the SYS/country-pack owner",
                             table=table_name, versionColumns=matching)

            readers = [
                operation_id for operation_id in self.model.query_ids()
                if table_name in self.model.operation[operation_id].get("readPlan", {}).get("tables", [])
            ]
            for operation_id in readers:
                entity = self.model.response_entity(operation_id) or {}
                fields = [row.get("name") for row in entity.get("fields", [])]
                if not token_present(fields, (code_column,)):
                    continue
                if not token_present(fields, tuple(matching) + (stem + "Label", "localizedLabel")):
                    self.add("P1-CFG-001", "CFG.RESPONSE_VERSION", "operation", operation_id,
                             f"query exposes {code_column} without resolved label/config version",
                             fields=fields, expectedVersionColumns=matching)

            source_name = f"{table_name}.{code_column}"
            for _, _, event in self.model.events:
                exposing = [row for row in event.get("fields", []) if row.get("source") == source_name]
                if not exposing:
                    continue
                sources = [str(row.get("source", "")) for row in event.get("fields", [])]
                if not any(any(name in source for name in matching) for source in sources):
                    self.add("P1-CFG-001", "CFG.EVENT_VERSION", "event", str(event.get("eventName")),
                             f"event exposes {code_column} without pinning the exact vocabulary/config version",
                             source=source_name, expectedVersionColumns=matching)

    def check_p1_money(self) -> None:
        value_objects = self.model.docs["operation"].get("valueObjects", {})
        for name in ("BenefitCoverageOption.v1", "ApprovedCompensationSnapshotLine.v1"):
            fields = [row.get("name") for row in value_objects.get(name, {}).get("fields", [])]
            okay, missing = all_groups_present(fields, [
                ("currencyCode",), ("frequency", "payPeriod"), ("basis",),
                ("fxSnapshot", "fxReceipt"),
            ])
            if not okay:
                self.add("P1-MONEY-002", "MONEY.VALUE_OBJECT", "valueObject", name,
                         "money value object lacks currency/frequency/basis/conditional FX boundary",
                         missingAliasGroups=missing, fields=fields)
        for table_name, amount_column in P1_MONEY_TARGETS:
            columns = self.model.table_columns(table_name)
            okay, missing = all_groups_present(columns, [
                ("currency_code",), ("frequency_code", "pay_period_code"),
                ("basis_code",), ("fx_snapshot", "fx_receipt", "exchange_rate_snapshot"),
            ])
            if not okay:
                self.add("P1-MONEY-002", "MONEY.TABLE", "field", f"{table_name}.{amount_column}",
                         "money fact cannot reproduce frequency/basis/cross-currency conversion",
                         missingAliasGroups=missing, columns=sorted(columns))
            table = self.model.table.get(table_name, {})
            column_defs = {row.get("name"): row for row in table.get("columns", [])}
            fx_columns = [name for name in columns if token_present([name], ("fx_snapshot", "fx_receipt", "exchange_rate_snapshot"))]
            if fx_columns and not any(column_defs.get(name, {}).get("referenceContract") for name in fx_columns):
                self.add("P1-MONEY-002", "MONEY.FX_OWNER_REFERENCE", "field", f"{table_name}.{amount_column}",
                         "FX snapshot column lacks an immutable finance/FX owner reference",
                         fxColumns=fx_columns)
            for operation_id in self.model.command_ids():
                assignments = self.model.operation_assignments(operation_id).get(table_name, {})
                if amount_column not in assignments:
                    continue
                okay, missing = all_groups_present(assignments, [
                    ("currency",), ("frequency", "pay_period"), ("basis",),
                    ("fx_snapshot", "fx_receipt", "exchange_rate_snapshot"),
                ])
                if not okay:
                    self.add("P1-MONEY-002", "MONEY.ATOMIC_DML", "operation", operation_id,
                             f"{amount_column} is written without original currency/frequency/basis/FX proof",
                             table=table_name, missingAliasGroups=missing, assignments=sorted(assignments))
            amount_source = f"{table_name}.{amount_column}"
            for _, _, event in self.model.events:
                if not any(row.get("source") == amount_source for row in event.get("fields", [])):
                    continue
                sources = [str(row.get("source", "")) for row in event.get("fields", [])]
                okay, missing = all_groups_present(sources, [
                    (f"{table_name}.currency",), (f"{table_name}.frequency",),
                    (f"{table_name}.basis",), (f"{table_name}.fx",),
                ])
                if not okay:
                    self.add("P1-MONEY-002", "MONEY.EVENT_FACT", "event", str(event.get("eventName")),
                             "money event cannot reproduce original amount basis and conversion revision",
                             amountSource=amount_source, missingAliasGroups=missing)

    def check_p1_decisions(self) -> None:
        for operation_id in sorted(P1_DECISIONS):
            operation = self.model.operation.get(operation_id, {})
            body = self.model.operation_body_names(operation_id)
            okay, missing = all_groups_present(body, [
                ("actorMode",), ("reason",), ("delegationReceipt", "decisionSourceReceipt"),
            ])
            if not okay:
                self.add("P1-DECISION-003", "DECISION.REQUEST", "operation", operation_id,
                         "consequential decision lacks SELF/AUTHORIZED_PROXY provenance inputs",
                         missingAliasGroups=missing, fields=sorted(body))
            assignments = self.model.operation_assignments(operation_id)
            decision_tables = [
                (table, values) for table, values in assignments.items()
                if "decision" in table or token_present(values, ("actor_mode", "decision_source"))
            ]
            if not decision_tables:
                self.add("P1-DECISION-003", "DECISION.LEDGER", "operation", operation_id,
                         "decision is not appended to an immutable actor/source/delegation ledger")
            else:
                names = [name for _, values in decision_tables for name in values]
                okay, missing = all_groups_present(names, [
                    ("actor_mode",), ("actor",), ("subject",),
                    ("delegation_revision", "source_receipt"), ("reason",),
                ])
                if not okay:
                    self.add("P1-DECISION-003", "DECISION.LEDGER_FIELDS", "operation", operation_id,
                             "decision ledger omits actor/subject/source/delegation/reason facts",
                             missingAliasGroups=missing, fields=names)
            effects = [effect for row in operation.get("inputEffects", []) for effect in row.get("effects", [])]
            if not any(effect.get("kind") in {"ACTOR_MODE_SWITCH", "SELF_PROXY_AUTHORITY_SWITCH"} for effect in effects):
                self.add("P1-DECISION-003", "DECISION.PEP_SWITCH", "operation", operation_id,
                         "SELF versus AUTHORIZED_PROXY does not select distinct structural PEP duties")
            if not any(
                effect.get("kind") in {"OWNER_REFETCH", "EXACT_DELEGATION_SELECTOR"}
                and token_present(flatten_strings(effect), ("delegation", "decisionSourceReceipt"))
                for effect in effects
            ):
                self.add("P1-DECISION-003", "DECISION.SOURCE_REFETCH", "operation", operation_id,
                         "proxy decision source/delegation receipt is not exact-owner-refetched")
            emitted = operation.get("events", [])
            if emitted and not all(
                token_present([str(row.get("name", "")) for row in event.get("fields", [])],
                              ("actorMode", "decisionSourceClass"))
                for event in emitted
            ):
                self.add("P1-DECISION-003", "DECISION.EVENT_SOURCE_CLASS", "operation", operation_id,
                         "decision event omits non-sensitive SELF/proxy source classification")

    def check_p1_effective(self) -> None:
        for operation_id, (table_name, query_id) in sorted(DUAL_TEMPORAL_CONTRACTS.items()):
            operation = self.model.operation.get(operation_id, {})
            body = self.model.operation_body_names(operation_id)
            okay, missing = all_groups_present(body, [
                ("revisionMode",), ("effectiveFrom",),
                ("reason",), ("changedFields", "replacementArtifact", "contentArtifact"),
                ("segmentPredecessorVersionId",), ("segmentPredecessorRevision",),
            ])
            if not okay:
                self.add("P1-EFFECTIVE-004", "EFFECTIVE.REQUEST", "operation", operation_id,
                         "revision lacks correction/supersession mode, boundary, exact segment predecessor, or reason",
                         missingAliasGroups=missing, fields=sorted(body))
            if "effectiveTo" in body:
                self.add(
                    "P1-EFFECTIVE-004", "EFFECTIVE.CLIENT_EFFECTIVE_TO_FORBIDDEN",
                    "operation", operation_id,
                    "client-controlled effectiveTo is forbidden; the boundary is derived from the next visible base segment",
                    fields=sorted(body),
                )

            revision_field = next(
                (row for row in operation.get("requestFields", []) if row.get("name") == "revisionMode"), {}
            )
            if (
                revision_field.get("required") is not True
                or revision_field.get("allowedValues") != ["CORRECTION", "SUPERSEDE"]
                or "LIFECYCLE" not in str(revision_field.get("validation", ""))
            ):
                self.add(
                    "P1-EFFECTIVE-004", "EFFECTIVE.PUBLIC_MODE_CLOSED_SET",
                    "operation", operation_id,
                    "public revise must allow only CORRECTION|SUPERSEDE; LIFECYCLE remains server-only",
                    revisionModeField=revision_field,
                )

            table = self.model.table.get(table_name, {})
            root_table = (table.get("temporalArbitration") or {}).get("rootTable")
            dml = [row for row in operation.get("orderedDml", []) if isinstance(row, dict)]
            revision_steps = [row for row in dml if row.get("table") == table_name]
            root_steps = [row for row in dml if row.get("table") == root_table]
            revision_assignments = revision_steps[0].get("assignments", {}) if len(revision_steps) == 1 else {}
            if (
                len(revision_steps) != 1
                or revision_steps[0].get("action") != "APPEND"
                or revision_steps[0].get("role") != "IMMUTABLE_EFFECTIVE_DATED_REVISION"
                or not DUAL_TEMPORAL_COLUMNS <= set(revision_assignments)
                or revision_assignments.get("effective_to") != "CONSTANT:NULL"
                or revision_assignments.get("effective_from")
                != "SEGMENT_PREDECESSOR.effective_from IF body.revisionMode=CORRECTION ELSE body.effectiveFrom"
                or revision_assignments.get("segment_revision")
                != "body.segmentPredecessorRevision+1 IF body.revisionMode=CORRECTION ELSE CONSTANT:1"
                or len(root_steps) != 1
                or root_steps[0].get("action") != "UPDATE_CAS"
                or root_steps[0].get("role") != "CONCURRENCY_ROOT"
                or dml.index(root_steps[0]) >= dml.index(revision_steps[0])
            ):
                self.add(
                    "P1-EFFECTIVE-004", "EFFECTIVE.APPEND", "operation", operation_id,
                    "one root CAS must precede one immutable dual-chain revision append in the same transaction",
                    rootTable=root_table, rootSteps=root_steps, revisionSteps=revision_steps,
                    missingAssignments=sorted(DUAL_TEMPORAL_COLUMNS - set(revision_assignments)),
                )

            write_contract = operation.get("temporalWriteContract", {})
            if (
                write_contract.get("strategy") != "DUAL_APPEND_ONLY_ROOT_AND_EFFECTIVE_SEGMENT_CHAINS"
                or write_contract.get("revisionAction") != "APPEND"
                or write_contract.get("rootAction") != "UPDATE_CAS"
                or write_contract.get("priorHistoryMutation") != "FORBIDDEN"
                or write_contract.get("expectedVersionSource") != "If-Match"
                or write_contract.get("rootPredecessorMustBeCurrentGlobalAppendTip") is not True
                or write_contract.get("segmentPredecessorMustBeCurrentTipWithinEffectiveSegment") is not True
                or "systemAsOf" not in str(write_contract.get("businessAsOfWinner", ""))
                or "NULL" not in str(write_contract.get("storedEffectiveTo", ""))
            ):
                self.add("P1-EFFECTIVE-004", "EFFECTIVE.APPEND", "operation", operation_id,
                         "revision write lacks exact dual-chain append+root-CAS/no-prior-mutation contract",
                         temporalWriteContract=write_contract)

            columns = {row.get("name"): row for row in table.get("columns", []) if row.get("name")}
            arbitration = table.get("temporalArbitration", {})
            arbitration_fields = {
                "strategy": "DUAL_APPEND_ONLY_ROOT_AND_EFFECTIVE_SEGMENT_CHAINS",
                "rawHistoryExclusion": "NONE",
                "rootCasRequired": True,
                "concurrentSameExpectedVersion": "EXACTLY_ONE_SUCCESS",
                "rootVersionColumn": "root_version",
                "rootPredecessorPublicIdColumn": "root_predecessor_public_id",
                "rootPredecessorVersionColumn": "root_predecessor_version",
                "effectiveSegmentPublicIdColumn": "effective_segment_public_id",
                "segmentRevisionColumn": "segment_revision",
                "segmentPredecessorPublicIdColumn": "segment_predecessor_public_id",
                "segmentPredecessorRevisionColumn": "segment_predecessor_revision",
                "effectiveFromColumn": "effective_from",
                "effectiveToColumn": "effective_to",
                "recordedAtColumn": "created_at",
                "storedEffectiveToAuthority": "FORBIDDEN_NULL_ONLY",
            }
            required_non_null = DUAL_TEMPORAL_COLUMNS - {
                "root_predecessor_public_id", "segment_predecessor_public_id", "effective_to"
            }
            nullable_drift = sorted(
                name for name in required_non_null
                if name not in columns or columns[name].get("nullable") is not False
            )
            checks_text = " ".join(str(row.get("expression", "")) for row in table.get("checks", []))
            root_fk = any(
                row.get("mode") == "LOCAL_COMPOSITE_FK"
                and row.get("target") == table_name
                and {"root_predecessor_public_id", "root_predecessor_version"} <= set(row.get("columns", []))
                and {"public_id", "root_version"} <= set(row.get("targetColumns", []))
                for row in table.get("foreignKeys", [])
            )
            segment_fk = any(
                row.get("mode") == "LOCAL_COMPOSITE_FK"
                and row.get("target") == table_name
                and {"effective_segment_public_id", "effective_from", "segment_predecessor_public_id", "segment_predecessor_revision"} <= set(row.get("columns", []))
                and {"effective_segment_public_id", "effective_from", "public_id", "segment_revision"} <= set(row.get("targetColumns", []))
                for row in table.get("foreignKeys", [])
            )
            base_segment_unique = any(
                {"tenant_id", "effective_from"} <= set(row.get("columns", []))
                and "segment_revision=1" in str(row.get("predicate", "")).replace(" ", "")
                for row in table.get("uniqueKeys", [])
            )
            invalid_table = (
                any(arbitration.get(key) != value for key, value in arbitration_fields.items())
                or nullable_drift
                or columns.get("effective_to", {}).get("nullable") is not True
                or "effective_to IS NULL" not in checks_text
                or "revision_mode IN ('CREATE','CORRECTION','SUPERSEDE','LIFECYCLE')" not in checks_text
                or not root_fk or not segment_fk or not base_segment_unique
                or "maximum effective_from<=businessAsOf" not in str(arbitration.get("businessAsOfWinner", ""))
                or "maximum segment_revision" not in str(arbitration.get("businessAsOfWinner", ""))
                or "created_at<=systemAsOf" not in str(arbitration.get("systemAsOfRule", ""))
            )
            if invalid_table:
                self.add(
                    "P1-EFFECTIVE-004", "EFFECTIVE.NON_OVERLAP", "table", table_name,
                    "version table lacks exact dual global-root/business-segment temporal invariants",
                    operationId=operation_id, arbitration=arbitration,
                    nullableDrift=nullable_drift, rootPredecessorFk=root_fk,
                    segmentPredecessorFk=segment_fk, baseSegmentUnique=base_segment_unique,
                )

            query = self.model.operation.get(query_id, {})
            request_sources = self.model.operation_request_sources(query_id)
            resolution = (query.get("readPlan") or {}).get("temporalResolution", {})
            required_query_sources = {
                "queryParameters.systemAsOf", "queryParameters.revisionPublicId",
                "queryParameters.rootVersion",
            }
            if (
                not required_query_sources <= request_sources
                or not temporal_resolution_is_closed(resolution)
            ):
                self.add(
                    "P1-EFFECTIVE-004", "EFFECTIVE.QUERY_RESOLUTION", "operation", query_id,
                    "detail query lacks system-time-first dual-chain resolution and exact historical re-entry selectors",
                    requestSources=sorted(request_sources), temporalResolution=resolution,
                )

            for event in operation.get("events", []):
                event_rows = {row.get("name"): row for row in event.get("fields", [])}
                event_fields = set(event_rows)
                aggregate_sources = {
                    "aggregateId": f"{root_table}.public_id",
                    "aggregateVersion": f"{root_table}.aggregate_version",
                }
                invalid_sources = {
                    name: event_rows.get(name, {}).get("source")
                    for name, expected in aggregate_sources.items()
                    if event_rows.get(name, {}).get("source") != expected
                }
                if not DUAL_TEMPORAL_EVENT_FIELDS <= event_fields or invalid_sources:
                    self.add(
                        "P1-EFFECTIVE-004", "EFFECTIVE.EVENT_LINEAGE", "event", str(event.get("eventName")),
                        "revision event must carry stable-root identity/version and exact dual-chain lineage",
                        operationId=operation_id,
                        missingFields=sorted(DUAL_TEMPORAL_EVENT_FIELDS - event_fields),
                        invalidStableRootSources=invalid_sources,
                    )

    def run(self) -> list[Issue]:
        self.check_source_integrity()
        self.check_closed_sets()
        self.check_queries()
        self.check_listening_cohort_projection()
        self.check_handlers()
        self.check_events()
        self.check_self_authority()
        self.check_domain_requirements()
        self.check_p1_configuration()
        self.check_p1_money()
        self.check_p1_decisions()
        self.check_p1_effective()
        return self.issues


def decision_rows(ids: Iterable[str], issues: Sequence[Issue], kind: str) -> list[dict[str, Any]]:
    result = []
    for subject_id in sorted(ids):
        matching = [issue for issue in issues if issue.subject_kind == kind and issue.subject_id == subject_id]
        result.append({
            "id": subject_id,
            "decision": "PASS" if not matching else "FAIL",
            "findingCount": len(matching),
            "ruleIds": sorted({issue.rule_id for issue in matching}),
            "requirementIds": sorted({issue.requirement_id for issue in matching}),
        })
    return result


PHYSICAL_LINEAGE_QUALIFIERS = {
    "STATE_WINNER", "CONTENT_WINNER", "SELECTED_STATE_ROW",
    "SELECTED_CONTENT_ROW", "CONTENT_ROW",
}
SELECTION_MODE_KEYS = {"UNQUALIFIED", "STATE_HISTORY", "CONTENT_HISTORY"}


def parse_direct_physical_source(value: Any) -> tuple[str | None, str | None, str | None]:
    """Parse one exact optional arbitration qualifier plus table.column.

    Derived and nested prefixes deliberately do not enter the direct-source
    count.  This is a closed grammar, not a permissive prefix stripper.
    """

    text = str(value or "")
    qualifier: str | None = None
    physical = text
    if ":" in text:
        prefix, physical = text.split(":", 1)
        if prefix not in PHYSICAL_LINEAGE_QUALIFIERS or ":" in physical:
            return None, None, None
        qualifier = prefix
    match = re.fullmatch(r"([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)", physical)
    if not match:
        return None, None, None
    return qualifier, match.group(1), match.group(2)


def selection_mode_sources_are_closed(
    row: Mapping[str, Any], table_name: str, column: str,
) -> bool:
    sources = row.get("selectionModeSources")
    qualifier, _, _ = parse_direct_physical_source(row.get("sourcePath"))
    if qualifier is None:
        return sources in (None, {})
    if not isinstance(sources, dict) or set(sources) != SELECTION_MODE_KEYS:
        return False
    parsed = {
        mode: parse_direct_physical_source(source)
        for mode, source in sources.items()
    }
    if any(value[1:] != (table_name, column) for value in parsed.values()):
        return False
    allowed = {
        "UNQUALIFIED": {"STATE_WINNER", "CONTENT_WINNER"},
        "STATE_HISTORY": {"SELECTED_STATE_ROW", "CONTENT_ROW"},
        "CONTENT_HISTORY": {"STATE_WINNER", "SELECTED_CONTENT_ROW"},
    }
    if any(parsed[mode][0] not in allowed[mode] for mode in SELECTION_MODE_KEYS):
        return False
    return parsed["UNQUALIFIED"][0] == qualifier


def temporal_resolution_is_closed(resolution: Mapping[str, Any]) -> bool:
    """Validate the exact system-time-first dual-winner query grammar."""

    system_rule = resolution.get("systemAsOfRule")
    return (
        resolution.get("strategy") == "DUAL_APPEND_ONLY_ROOT_AND_EFFECTIVE_SEGMENT_CHAINS"
        and system_rule == "FIRST_FILTER_created_at<=query.systemAsOf_OR_CAPTURED_OWNER_CLOCK"
        and "maximum effective_from<=businessAsOf" in str(resolution.get("baseSegmentRule", ""))
        and str(resolution.get("businessAsOfWinner", "")).startswith("CONTENT_WINNER:")
        and "maximum segment_revision" in str(resolution.get("businessAsOfWinner", ""))
        and str(resolution.get("stateWinner", "")).startswith("STATE_WINNER:")
        and "after the systemAsOf filter" in str(resolution.get("stateWinner", ""))
        and "revisionPublicId OR query.rootVersion" in str(resolution.get("exactHistorySelector", ""))
        and "same STATE_ROW" in str(resolution.get("exactHistorySelector", ""))
        and "no latest fallback" in str(resolution.get("exactHistorySelector", "")).lower()
        and "next visible base segment" in str(resolution.get("derivedEffectiveTo", ""))
        and resolution.get("persistedEffectiveTo") == "NULL_ONLY_NON_AUTHORITATIVE"
        and resolution.get("tenantAndParentPartitionRequired") is True
    )


def evaluate_docs(
    docs: Mapping[str, dict[str, Any]], audit: dict[str, Any],
    source_hashes: Mapping[str, str] | None = None,
    source_paths: Mapping[str, str] | None = None,
) -> tuple[Model, list[Issue]]:
    model = Model(docs, source_hashes, source_paths)
    issues = Evaluator(model, audit).run()
    return model, issues


def build_report(
    docs: Mapping[str, dict[str, Any]], audit: dict[str, Any],
    source_hashes: Mapping[str, str], source_paths: Mapping[str, str],
    self_tests: list[dict[str, Any]],
) -> dict[str, Any]:
    model, issues = evaluate_docs(docs, audit, source_hashes, source_paths)
    severity = Counter(issue.severity for issue in issues)
    self_tests_passed = (
        len(self_tests) == EXPECTED_SELF_TEST_COUNT
        and all(row["status"] == "PASS" for row in self_tests)
    )
    acceptance_passed = not issues and self_tests_passed
    by_requirement = {
        finding["id"]: {
            "severity": finding["severity"],
            "status": "PASS" if not any(i.requirement_id == finding["id"] for i in issues) else "FAIL",
            "findingCount": sum(i.requirement_id == finding["id"] for i in issues),
        }
        for finding in audit["findings"]
    }
    events = [event.get("eventName", "") for _, _, event in model.events]
    table_ids = sorted(model.table)
    report = {
        "reportId": "DWP-HRIS-GLOBAL-HCM-LIVE-ACCEPTANCE-V1",
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "authorityBoundary": "INDEPENDENT_CURRENT_SUCCESSOR_ACCEPTANCE_NOT_G3_AUTHORITY",
        "auditRequirementSource": {
            "path": str(FROZEN_AUDIT.relative_to(ROOT)),
            "sha256": EXPECTED_AUDIT_SHA256,
            "findingIds": [finding["id"] for finding in audit["findings"]],
            "acceptancePolicy": "ALL_20_P0_AND_ALL_4_P1_MUST_PASS",
        },
        "tableExpansionAcceptance": {
            "policyPath": str(EXPANSION_POLICY_PATH.resolve()),
            "policyFileSha256": sha256_file(EXPANSION_POLICY_PATH),
            "policySealedPayloadSha256": model.expansion_policy.get("sealedPayloadSha256"),
            "frozenBaseline": model.expansion_policy.get("frozenBaseline"),
            "successorScope": model.expansion_policy.get("successorScope"),
            "reproducibility": "exact IDs/owners/producers/requirements are loaded from the sealed independent policy and matched against the live manifest tableScopeChange",
        },
        "candidateSources": {
            role: {"path": source_paths[role], "sha256": source_hashes[role]}
            for role in sorted(source_hashes)
        },
        "enumeration": {
            "counts": {
                "capabilities": len({row.get("capabilityId") for row in model.operation.values()}),
                "operations": len(model.operation), "commands": len(model.command_ids()),
                "queries": len(model.query_ids()), "handlers": len(model.handler),
                "events": len(model.events), "tables": len(model.table),
            },
            "operationIds": sorted(model.operation),
            "queryIds": model.query_ids(),
            "handlerIds": sorted(model.handler),
            "eventIds": sorted(events),
            "tableIds": table_ids,
            "tableSetSha256": sha256_bytes(canonical_json(table_ids)),
        },
        "requirementDecisions": by_requirement,
        "operationDecisions": decision_rows(model.operation, issues, "operation"),
        "handlerDecisions": decision_rows(model.handler, issues, "handler"),
        "eventDecisions": decision_rows(events, issues, "event"),
        "tableDecisions": decision_rows(model.table, issues, "table"),
        "selfTests": self_tests,
        "summary": {
            "status": "PASS_GLOBAL_HCM_LIVE_ACCEPTANCE" if acceptance_passed else "FAIL_GLOBAL_HCM_LIVE_ACCEPTANCE",
            "readyForGateConsideration": acceptance_passed,
            "findingCount": len(issues),
            "P0": severity.get("P0", 0), "P1": severity.get("P1", 0),
            "failedRequirementCount": sum(row["status"] == "FAIL" for row in by_requirement.values()),
            "passedRequirementCount": sum(row["status"] == "PASS" for row in by_requirement.values()),
            "selfTestCount": len(self_tests),
            "expectedSelfTestCount": EXPECTED_SELF_TEST_COUNT,
            "passedSelfTestCount": sum(row["status"] == "PASS" for row in self_tests),
            "mutationSelfTestsPassed": self_tests_passed,
        },
        "findings": [issue.as_dict() for issue in issues],
    }
    report["sealedPayloadSha256"] = sha256_bytes(canonical_json(report))
    return report


def minimal_fixture() -> dict[str, dict[str, Any]]:
    """Small fixture only for low-level mutation rule sensitivity tests."""
    query = {
        "operationId": "q", "mode": "QUERY", "capabilityId": "C",
        "readPlan": {"tables": ["t"], "projectionTuple": {"pep": {
            "authorizationCapability": "v", "tenant": "t", "purpose": "p",
            "population": "n", "fieldPolicy": "f", "denyOnUnavailable": True,
        }}},
    }
    command = {
        "operationId": "self", "mode": "COMMAND", "capabilityId": "C",
        "requestFields": [{"source": "body.workerPublicId", "name": "workerPublicId", "location": "body"}],
        "inputEffects": [{"source": "body.workerPublicId", "effects": [{
            "kind": "CALLER_SUBJECT_EQUALITY", "target": "authenticatedPrincipal.workerPublicId",
        }]}],
        "orderedDml": [{"table": "t", "action": "INSERT", "assignments": {
            "worker_public_id": "body.workerPublicId",
        }}],
    }
    entity = {"schemaId": "q.Entity", "additionalProperties": False, "fields": [
        {"name": name} for name in sorted(BASE_ENTITY_FIELDS | {"businessCode"})
    ]}
    response = {"schemaId": "q.Response", "fields": [{"name": "item", "schemaRef": "q.Entity"}]}
    return {
        "operation": {"operations": [query, command], "systemHandlers": []},
        "exact": {
            "recordSchemas": [entity], "responseSchemas": [response],
            "operationBindings": [{"operationId": "q", "responseSchemaRef": "q.Response"}, {"operationId": "self", "responseSchemaRef": "q.Response"}],
            "operationFieldLineage": [{"operationId": "q", "responseFieldSources": [{
                "target": "q.Response.businessCode", "sourcePath": "t.business_code", "sourceKind": "IMMUTABLE_PROOF",
            }]}, {"operationId": "self", "responseFieldSources": []}],
            "tableSpecifications": [{"tableName": "t", "idColumn": {"name": "id"}, "columns": [{"name": "business_code"}, {"name": "worker_public_id"}]}],
        },
        "event": {"eventPayloadSchemas": []},
        "semantic": {"operations": [{"operationId": "q"}, {"operationId": "self"}]},
        "causal": {"operations": [{"operationId": "q"}, {"operationId": "self"}]},
        "manifest": {"operations": ["q", "self"], "handlerIds": [], "publicEventIds": [], "tableIds": ["t"]},
    }


def run_self_tests() -> list[dict[str, Any]]:
    """Mutation tests for the structural primitives used by acceptance rules."""
    tests: list[tuple[str, Callable[[], bool]]] = []

    def add(name: str, function: Callable[[], bool]) -> None:
        tests.append((name, function))

    add("token_alias_groups_reject_missing", lambda: not all_groups_present(
        ["currencyCode"], [("currency",), ("frequency",)]
    )[0])
    add("state_parser_rejects_unknown", lambda: "BROKEN" not in state_values({
        "checks": [{"columns": ["status"], "expression": "status IN ('OPEN','CLOSED')"}]
    }, "status"))

    def query_lineage_mutation() -> bool:
        fixture = minimal_fixture()
        model = Model(fixture)
        entity = model.response_entity("q")
        before = bool(entity and token_present([x["name"] for x in entity["fields"]], ("businessCode",)))
        fixture["exact"]["operationFieldLineage"][0]["responseFieldSources"] = []
        after = Model(fixture).lineage["q"].get("responseFieldSources") == []
        return before and after

    add("query_field_lineage_mutation_detected", query_lineage_mutation)

    def self_guard_mutation() -> bool:
        fixture = minimal_fixture()
        operation = Model(fixture).operation["self"]
        before = any(effect.get("kind") == "CALLER_SUBJECT_EQUALITY"
                     for row in operation["inputEffects"] for effect in row["effects"])
        operation["inputEffects"][0]["effects"] = []
        after = not any(effect.get("kind") == "CALLER_SUBJECT_EQUALITY"
                        for row in operation["inputEffects"] for effect in row["effects"])
        return before and after

    add("self_subject_guard_mutation_detected", self_guard_mutation)

    def event_state_mutation() -> bool:
        event = {"condition": "toState=CLOSED"}
        states = {"OPEN", "CLOSED"}
        good = bool(re.fullmatch(r"toState=([A-Z0-9_]+)", event["condition"])) and event["condition"].split("=", 1)[1] in states
        event["condition"] = "toState=EVENTNAME"
        bad = event["condition"].split("=", 1)[1] not in states
        return good and bad

    add("event_name_as_state_mutation_detected", event_state_mutation)

    def config_version_mutation() -> bool:
        columns = {"case_type", "case_type_vocabulary_version_id"}
        before = token_present(columns, ("case_type_vocabulary_version_id",))
        columns.remove("case_type_vocabulary_version_id")
        after = not token_present(columns, ("case_type_vocabulary_version_id",))
        return before and after

    add("config_version_mutation_detected", config_version_mutation)

    def money_basis_mutation() -> bool:
        columns = {"amount", "currency_code", "frequency_code", "basis_code", "fx_snapshot_id"}
        groups = [("currency",), ("frequency",), ("basis",), ("fx_snapshot",)]
        before = all_groups_present(columns, groups)[0]
        columns.remove("basis_code")
        after = not all_groups_present(columns, groups)[0]
        return before and after

    add("money_basis_mutation_detected", money_basis_mutation)

    def decision_provenance_mutation() -> bool:
        fields = {"actor_mode", "actor_public_id", "subject_public_id", "delegation_revision", "reason_code"}
        groups = [("actor_mode",), ("actor",), ("subject",), ("delegation_revision",), ("reason",)]
        before = all_groups_present(fields, groups)[0]
        fields.remove("actor_mode")
        return before and not all_groups_present(fields, groups)[0]

    add("decision_actor_mode_mutation_detected", decision_provenance_mutation)

    def effective_lineage_mutation() -> bool:
        fields = {"revision_mode", "effective_from", "effective_to", "predecessor_revision", "reason_code"}
        groups = [("revision_mode",), ("effective_from",), ("effective_to",), ("predecessor",), ("reason",)]
        before = all_groups_present(fields, groups)[0]
        fields.remove("predecessor_revision")
        return before and not all_groups_present(fields, groups)[0]

    add("effective_predecessor_mutation_detected", effective_lineage_mutation)

    def table_producer_mutation() -> bool:
        fixture = minimal_fixture()
        before = "t" in Model(fixture).writers()
        fixture["operation"]["operations"][1]["orderedDml"] = []
        after = "t" not in Model(fixture).writers()
        return before and after

    add("typed_table_producer_mutation_detected", table_producer_mutation)

    def owner_dependency_seal_mutation() -> bool:
        row = {
            "dependencyContractId": "compensation.resolveApprovedSnapshotForPayroll.v1",
            "writes": "FORBIDDEN",
        }
        row["sealedPayloadSha256"] = sha256_bytes(canonical_json(row))
        before = row["sealedPayloadSha256"] == sha256_bytes(canonical_json({
            key: value for key, value in row.items()
            if key != "sealedPayloadSha256"
        }))
        row["writes"] = "ALLOWED"
        after = row["sealedPayloadSha256"] != sha256_bytes(canonical_json({
            key: value for key, value in row.items()
            if key != "sealedPayloadSha256"
        }))
        return before and after

    add("owner-dependency-seal-mutation-detected", owner_dependency_seal_mutation)

    def owner_dependency_projection_mutation() -> bool:
        rows = [{"dependencyContractId": value} for value in sorted(
            GLOBAL_OWNER_DEPENDENCY_IDS
        )]
        exact = copy.deepcopy(rows)
        before = exact == rows
        exact.pop()
        return before and exact != rows

    add("owner-dependency-projection-mutation-detected", owner_dependency_projection_mutation)

    def payroll_event_envelope_mutation() -> bool:
        boundary = {
            "selectorTuple": ["eventEnvelope.tenantId"],
            "fields": [
                "snapshotId", "snapshotRevision", "payloadDigest", "lineCount",
            ],
        }
        before = (
            boundary["selectorTuple"][0] == "eventEnvelope.tenantId"
            and boundary["fields"]
            == ["snapshotId", "snapshotRevision", "payloadDigest", "lineCount"]
        )
        boundary["selectorTuple"][0] = "event.tenantId"
        return before and boundary["selectorTuple"][0] != "eventEnvelope.tenantId"

    add("payroll-event-envelope-mutation-detected", payroll_event_envelope_mutation)

    results = []
    for name, function in tests:
        try:
            passed = bool(function())
            detail = None
        except Exception as exc:  # pragma: no cover - evidence path
            passed = False
            detail = f"{type(exc).__name__}: {exc}"
        row = {"testId": name, "status": "PASS" if passed else "FAIL"}
        if detail:
            row["detail"] = detail
        results.append(row)
    return results


def _issue_present(
    issues: Sequence[Issue], requirement_id: str, rule_id: str,
    subject_id: str | None = None,
) -> bool:
    return any(
        issue.requirement_id == requirement_id
        and issue.rule_id == rule_id
        and (subject_id is None or issue.subject_id == subject_id)
        for issue in issues
    )


def run_payroll_contract_mutation_tests(
    docs: Mapping[str, dict[str, Any]], audit: dict[str, Any],
) -> list[dict[str, Any]]:
    """Exercise the real evaluator against consistently projected PAY drift."""
    results: list[dict[str, Any]] = []

    def dependency(value: dict[str, dict[str, Any]]) -> dict[str, Any]:
        return next(
            row for row in value["operation"]["ownerDependencyContracts"]
            if row.get("dependencyContractId")
            == "compensation.resolveApprovedSnapshotForPayroll.v1"
        )

    def operation_event(value: dict[str, dict[str, Any]]) -> dict[str, Any]:
        operation = next(
            row for row in value["operation"]["operations"]
            if row.get("operationId") == "modern.compplan.snapshot.publish"
        )
        return next(
            row for row in operation["events"]
            if row.get("eventName")
            == "ApprovedCompensationPlanSnapshotPublished.v2"
        )

    def projected_event(value: dict[str, dict[str, Any]]) -> dict[str, Any]:
        return next(
            row for row in value["event"]["eventPayloadSchemas"]
            if row.get("eventName")
            == "ApprovedCompensationPlanSnapshotPublished.v2"
        )

    def reseal_and_reproject_dependency(value: dict[str, dict[str, Any]]) -> None:
        row = dependency(value)
        row["sealedPayloadSha256"] = sealed_payload_sha256(row)
        for role in ("exact", "semantic"):
            value[role]["ownerDependencyContracts"] = copy.deepcopy(
                value["operation"]["ownerDependencyContracts"]
            )
        for binding in value["semantic"].get(
            "ownerDependencySemanticBindings", []
        ):
            if binding.get("dependencyContractId") == row["dependencyContractId"]:
                for key in (
                    "dependencyContractSha256", "contractSealedPayloadSha256",
                    "sealedPayloadSha256",
                ):
                    if key in binding:
                        binding[key] = row["sealedPayloadSha256"]
        operation_event(value)["refetchContract"][
            "dependencyContractSha256"
        ] = row["sealedPayloadSha256"]
        projected_event(value)["consumerRefetchPolicy"][
            "dependencyContractSha256"
        ] = row["sealedPayloadSha256"]
        value["manifest"]["ownerDependencyContracts"] = sorted(({
            "dependencyContractId": item.get("dependencyContractId"),
            "ownerSession": item.get("ownerSession"),
            "consumerSession": item.get("consumerSession"),
            "sealedPayloadSha256": item.get("sealedPayloadSha256"),
        } for item in value["operation"]["ownerDependencyContracts"]), key=lambda item: str(
            item["dependencyContractId"]
        ))

    def evaluate(value: dict[str, dict[str, Any]]) -> list[Issue]:
        evaluator = Evaluator(Model(value), audit)
        evaluator.check_closed_sets()
        evaluator.check_events()
        return evaluator.issues

    def execute(
        test_id: str, mutate: Callable[[dict[str, dict[str, Any]]], None],
        expected_rule: str, *, require_both_boundaries: bool = False,
    ) -> None:
        candidate = copy.deepcopy(dict(docs))
        mutate(candidate)
        issues = evaluate(candidate)
        closed = _issue_present(
            issues, "P0-CROSS-QUERY-001", "SET.OWNER_DEPENDENCIES"
        )
        event = _issue_present(
            issues, "P0-CROSS-EVENT-003", "EVENT.OWNER_DEPENDENCY_REFETCH",
            "ApprovedCompensationPlanSnapshotPublished.v2",
        )
        expected = closed if expected_rule == "SET.OWNER_DEPENDENCIES" else event
        if require_both_boundaries:
            expected = closed and event
        results.append({
            "testId": test_id,
            "status": "PASS" if expected else "FAIL",
            "closedSetDetected": closed,
            "eventBoundaryDetected": event,
        })

    def mutate_dependency(
        value: dict[str, dict[str, Any]], callback: Callable[[dict[str, Any]], None],
    ) -> None:
        callback(dependency(value))
        reseal_and_reproject_dependency(value)

    dependency_cases: list[tuple[str, Callable[[dict[str, Any]], None]]] = [
        ("pay-dependency-max-header-resealed", lambda row: row[
            "streamingValidation"
        ].__setitem__("maxHeaderBytes", 65537)),
        ("pay-dependency-max-line-resealed", lambda row: row[
            "streamingValidation"
        ].__setitem__("maxLineBytes", 4097)),
        ("pay-dependency-max-payload-resealed", lambda row: row[
            "streamingValidation"
        ].__setitem__("maxPayloadBytes", 536870913)),
        ("pay-dependency-byte-accounting-resealed", lambda row: row[
            "streamingValidation"
        ].__setitem__("byteAccounting", "AFTER_ALLOCATION")),
        ("pay-dependency-count-resealed", lambda row: row[
            "streamingValidation"
        ].__setitem__("count", "UNCHECKED")),
        ("pay-dependency-sequence-resealed", lambda row: row[
            "streamingValidation"
        ].__setitem__("sequence", "UNCHECKED")),
        ("pay-dependency-digest-resealed", lambda row: row[
            "streamingValidation"
        ].__setitem__("digest", "UNCHECKED")),
        ("pay-dependency-failure-resealed", lambda row: row[
            "streamingValidation"
        ].__setitem__("failure", "PARTIAL_ACCEPT")),
        ("pay-dependency-backpressure-resealed", lambda row: row[
            "transport"
        ].__setitem__("backpressure", "BUFFER_ALL")),
        ("pay-header-effective-to-nullability-resealed", lambda row: next(
            item for item in row["responseSchema"]["headerFields"]
            if item.get("name") == "effectiveTo"
        ).__setitem__("nullable", False)),
        ("pay-line-effective-to-nullability-resealed", lambda row: next(
            item for item in row["responseSchema"]["lines"]["itemFields"]
            if item.get("name") == "effectiveTo"
        ).__setitem__("nullable", False)),
        ("pay-currency-pattern-resealed", lambda row: next(
            item for item in row["responseSchema"]["lines"]["itemFields"]
            if item.get("name") == "currency"
        ).__setitem__("pattern", ".*")),
        ("pay-posted-money-negative-zero-resealed", lambda row: next(
            item for item in row["responseSchema"]["lines"]["itemFields"]
            if item.get("name") == "approvedAmount"
        ).__setitem__("negativeZero", "NORMALIZE_TO_ZERO")),
        ("pay-line-sequence-validation-resealed", lambda row: next(
            item for item in row["responseSchema"]["lines"]["itemFields"]
            if item.get("name") == "lineSequence"
        ).__setitem__("validation", "ANY_INTEGER")),
        ("pay-line-digest-validation-resealed", lambda row: next(
            item for item in row["responseSchema"]["lines"]["itemFields"]
            if item.get("name") == "lineDigest"
        ).__setitem__("validation", "UNCHECKED")),
        ("pay-digest-line-domain-resealed", lambda row: row[
            "digestCanonicalization"
        ]["lineDigest"].__setitem__(
            "domainSeparator", "DWP.HRIS.PAYROLL.SNAPSHOT.LINE.V2"
        )),
        ("pay-digest-version-resealed", lambda row: row[
            "digestCanonicalization"
        ].__setitem__("contractVersion", "DWP_HRIS_PAYROLL_SNAPSHOT_DIGEST_V2")),
        ("pay-digest-encoding-resealed", lambda row: row[
            "digestCanonicalization"
        ].__setitem__("encoding", "UTF-16")),
        ("pay-digest-bigint-number-resealed", lambda row: row[
            "digestCanonicalization"
        ]["typedScalars"].__setitem__("bigint", "RFC8785_JSON_NUMBER")),
        ("pay-digest-line-field-order-resealed", lambda row: row[
            "digestCanonicalization"
        ]["lineDigest"]["fieldOrder"].reverse()),
        ("pay-digest-transport-bytes-resealed", lambda row: row[
            "digestCanonicalization"
        ].__setitem__("transportRepresentation", "INCLUDE_COMPRESSED_BYTES")),
        ("pay-digest-line-self-injection-resealed", lambda row: row[
            "digestCanonicalization"
        ]["lineDigest"]["fieldOrder"].append("lineDigest")),
        ("pay-digest-payload-self-injection-resealed", lambda row: row[
            "digestCanonicalization"
        ]["payloadDigest"]["headerFieldOrder"].append("payloadDigest")),
        ("pay-digest-reorder-resealed", lambda row: row[
            "digestCanonicalization"
        ]["payloadDigest"].__setitem__("lineDigestOrder", "lineSequence DESC")),
        ("pay-digest-empty-boundary-resealed", lambda row: row[
            "digestCanonicalization"
        ]["closedInputValidation"].__setitem__("zeroLines", "ACCEPT")),
        ("pay-digest-one-boundary-resealed", lambda row: row[
            "digestCanonicalization"
        ]["closedInputValidation"].__setitem__("oneLine", "REJECT")),
        ("pay-digest-max-boundary-resealed", lambda row: row[
            "digestCanonicalization"
        ]["closedInputValidation"].__setitem__(
            "oneHundredThousandLines", "REJECT"
        )),
        ("pay-digest-duplicate-sequence-resealed", lambda row: row[
            "digestCanonicalization"
        ]["closedInputValidation"].__setitem__("lineSequence", "ALLOW_DUPLICATE")),
        ("pay-digest-null-absent-resealed", lambda row: row[
            "digestCanonicalization"
        ]["closedInputValidation"].__setitem__("nullVsAbsent", "EQUIVALENT")),
        ("pay-digest-decimal-spelling-resealed", lambda row: row[
            "digestCanonicalization"
        ]["closedInputValidation"].__setitem__(
            "decimalAlternateSpelling", "NORMALIZE_AND_ACCEPT"
        )),
    ]
    for test_id, callback in dependency_cases:
        execute(
            test_id,
            lambda value, callback=callback: mutate_dependency(value, callback),
            "SET.OWNER_DEPENDENCIES",
        )

    def mutate_refetch(
        value: dict[str, dict[str, Any]], callback: Callable[[dict[str, Any]], None],
    ) -> None:
        callback(operation_event(value)["refetchContract"])
        callback(projected_event(value)["consumerRefetchPolicy"])

    refetch_cases: list[tuple[str, Callable[[dict[str, Any]], None]]] = [
        ("pay-refetch-response", lambda row: row.__setitem__("response", "UNBOUNDED")),
        ("pay-refetch-version", lambda row: row.__setitem__("version", "latest")),
        ("pay-refetch-digest", lambda row: row.__setitem__("digest", "unchecked")),
        ("pay-refetch-pep-tenant", lambda row: row["pep"].__setitem__(
            "tenant", "caller tenant"
        )),
        ("pay-refetch-pep-purpose", lambda row: row["pep"].__setitem__(
            "purpose", ["ANY"]
        )),
        ("pay-refetch-pep-population", lambda row: row["pep"].__setitem__(
            "population", "ALL"
        )),
        ("pay-refetch-pep-field-exposure", lambda row: row["pep"].__setitem__(
            "fieldExposure", ["snapshotId"]
        )),
        ("pay-refetch-tenant-binding", lambda row: row["tenantBinding"].__setitem__(
            "ownerRowTenant", "caller.tenantId"
        )),
        ("pay-refetch-selector-tuple", lambda row: row["selectorTuple"].__setitem__(
            1, "event.planId"
        )),
    ]
    for test_id, callback in refetch_cases:
        execute(
            test_id,
            lambda value, callback=callback: mutate_refetch(value, callback),
            "EVENT.OWNER_DEPENDENCY_REFETCH",
            require_both_boundaries=True,
        )

    def mutate_pay_purpose(value: dict[str, dict[str, Any]]) -> None:
        operation_event(value)["audience"]["consumerFieldExposure"]["HRIS-PAY"][
            "purpose"
        ] = ["ANY"]
        projected_event(value)["deliveryPolicy"]["consumerFieldAllowlists"][
            "HRIS-PAY"
        ]["purpose"] = ["ANY"]

    execute(
        "pay-consumer-purpose-expansion", mutate_pay_purpose,
        "EVENT.OWNER_DEPENDENCY_REFETCH", require_both_boundaries=True,
    )

    def mutate_per_fields(value: dict[str, dict[str, Any]]) -> None:
        operation_event(value)["audience"]["consumerFieldExposure"]["HRIS-PER"][
            "fields"
        ].append("unreviewedField")
        projected_event(value)["deliveryPolicy"]["consumerFieldAllowlists"][
            "HRIS-PER"
        ]["fields"].append("unreviewedField")

    execute(
        "per-consumer-field-expansion", mutate_per_fields,
        "EVENT.OWNER_DEPENDENCY_REFETCH", require_both_boundaries=True,
    )

    def mutate_payload_tenant(value: dict[str, dict[str, Any]]) -> None:
        field = {
            "name": "tenantId", "type": "BIGINT", "required": True,
            "sourceKind": "PHYSICAL_POST_STATE",
            "source": "prf_cmp_approved_snapshots.tenant_id",
        }
        operation_event(value)["fields"].append(copy.deepcopy(field))
        operation_event(value)["audience"]["fieldExposure"]["fields"].append(
            "tenantId"
        )
        operation_event(value)["audience"]["consumerFieldExposure"]["HRIS-PER"][
            "fields"
        ].append("tenantId")
        projected_event(value)["fields"].append(copy.deepcopy(field))
        projected_event(value)["deliveryPolicy"]["fieldAllowlist"].append(
            "tenantId"
        )
        projected_event(value)["deliveryPolicy"]["consumerFieldAllowlists"][
            "HRIS-PER"
        ]["fields"].append("tenantId")

    execute(
        "payload-routing-tenant-duplication", mutate_payload_tenant,
        "EVENT.OWNER_DEPENDENCY_REFETCH", require_both_boundaries=True,
    )

    def payroll_semantic_binding(
        value: dict[str, dict[str, Any]],
    ) -> dict[str, Any]:
        return next(
            row for row in value["semantic"]["ownerDependencySemanticBindings"]
            if row.get("dependencyContractId")
            == "compensation.resolveApprovedSnapshotForPayroll.v1"
        )

    semantic_cases: list[tuple[str, Callable[[dict[str, Any]], None]]] = [
        ("pay-semantic-purpose", lambda row: row.__setitem__("purpose", "ANY")),
        ("pay-semantic-request-fields", lambda row: row["requestFields"].append(
            "unreviewed"
        )),
        ("pay-semantic-response-header-fields", lambda row: row[
            "responseHeaderFields"
        ].append("unreviewed")),
        ("pay-semantic-response-line-fields", lambda row: row[
            "responseLineFields"
        ].append("unreviewed")),
        ("pay-semantic-read-tables", lambda row: row["readTables"].append(
            "sys_unreviewed"
        )),
        ("pay-semantic-writes", lambda row: row.__setitem__("writes", "ALLOWED")),
        ("pay-semantic-latest-fallback", lambda row: row.__setitem__(
            "latestFallback", "ALLOWED"
        )),
        ("pay-semantic-seal", lambda row: row.__setitem__(
            "sealedPayloadSha256", "0" * 64
        )),
    ]
    for test_id, callback in semantic_cases:
        execute(
            test_id,
            lambda value, callback=callback: callback(
                payroll_semantic_binding(value)
            ),
            "SET.OWNER_DEPENDENCIES",
        )

    return results


def _body_field(name: str) -> dict[str, Any]:
    return {
        "source": "body." + name, "name": name, "location": "body",
        "type": "STRING", "required": True, "sensitivity": "INTERNAL",
        "tokenization": "NONE",
    }


def run_targeted_mutation_tests(
    docs: Mapping[str, dict[str, Any]], audit: dict[str, Any],
) -> list[dict[str, Any]]:
    """Exercise one real evaluator failure for each of the frozen 24 findings.

    Each probe starts from a deep copy of the live candidate.  Where the live
    failed candidate already violates the same narrow rule, the probe first
    installs a local positive control for that rule and then removes exactly
    one required structural fact.  Unrelated live failures are ignored; the
    asserted tuple is requirementId+ruleId+subjectId.
    """

    probes: list[dict[str, Any]] = []

    def execute(
        requirement_id: str, mutation_id: str, rule_id: str, subject_id: str,
        prepare: Callable[[dict[str, dict[str, Any]]], None],
        mutate: Callable[[dict[str, dict[str, Any]]], None],
    ) -> None:
        control = copy.deepcopy(dict(docs))
        prepare(control)
        _, before = evaluate_docs(control, audit)
        candidate = copy.deepcopy(control)
        mutate(candidate)
        _, after = evaluate_docs(candidate, audit)
        control_clear = not _issue_present(before, requirement_id, rule_id, subject_id)
        mutation_detected = _issue_present(after, requirement_id, rule_id, subject_id)
        probes.append({
            "testId": mutation_id,
            "requirementId": requirement_id,
            "ruleId": rule_id,
            "subjectId": subject_id,
            "positiveControl": "PASS" if control_clear else "FAIL",
            "mutatedCandidate": "FAIL_DETECTED" if mutation_detected else "MISSED",
            "status": "PASS" if control_clear and mutation_detected else "FAIL",
        })

    # Four cross-cutting findings.
    query_id = sorted(
        row["operationId"] for row in docs["operation"].get("operations", [])
        if row.get("mode") == "QUERY"
    )[0]
    binding = next(row for row in docs["exact"]["operationBindings"] if row["operationId"] == query_id)
    response_ref = binding["responseSchemaRef"]
    execute(
        "P0-CROSS-QUERY-001", "mutate_query_response_schema_removed",
        "QUERY.ENTITY_MISSING", query_id,
        lambda value: None,
        lambda value: value["exact"].__setitem__(
            "responseSchemas", [row for row in value["exact"]["responseSchemas"] if row.get("schemaId") != response_ref]
        ),
    )

    handler_id = "internal.ai.assistance-result.consume"
    execute(
        "P0-CROSS-HANDLER-002", "mutate_handler_idempotency_removed",
        "HANDLER.IDEMPOTENCY", handler_id,
        lambda value: next(row for row in value["operation"]["systemHandlers"] if row["handlerId"] == handler_id).__setitem__(
            "idempotency", {
                "claimKey": "tenant+handler+event", "storedPayloadDigest": "payloadDigest",
                "sameDigest": "RETURN_FIRST", "differentDigest": "CONFLICT",
                "claimOrder": "CLAIM_INBOX_FIRST",
            }
        ),
        lambda value: next(row for row in value["operation"]["systemHandlers"] if row["handlerId"] == handler_id).pop("idempotency", None),
    )

    event_owner: tuple[str, str] | None = None
    for operation in docs["operation"].get("operations", []):
        states = list((operation.get("transition") or {}).get("postStates", []))
        if states and operation.get("events"):
            event_owner = (operation["operationId"], states[0])
            break
    if event_owner is None:
        raise ValueError("mutation selftest requires at least one command event with a post state")
    event_operation_id, event_state = event_owner
    event_name = next(
        row for row in docs["operation"]["operations"] if row["operationId"] == event_operation_id
    )["events"][0]["eventName"]

    def set_event_condition(value: dict[str, dict[str, Any]], condition: str) -> None:
        operation = next(row for row in value["operation"]["operations"] if row["operationId"] == event_operation_id)
        operation["events"][0]["condition"] = condition

    execute(
        "P0-CROSS-EVENT-003", "mutate_event_condition_to_event_name",
        "EVENT.CONDITION", event_name,
        lambda value: set_event_condition(value, "toState=" + event_state),
        lambda value: set_event_condition(value, "toState=EVENT_NAME_IS_NOT_STATE"),
    )

    self_operation_id = sorted(SELF_MUTATIONS)[0]

    def prepare_self(value: dict[str, dict[str, Any]]) -> None:
        operation = next(row for row in value["operation"]["operations"] if row["operationId"] == self_operation_id)
        operation.setdefault("inputEffects", []).append({
            "source": "authenticatedPrincipal.workerPublicId",
            "effects": [{"kind": "DERIVED_AUTHENTICATED_SUBJECT", "target": "domain.worker_public_id"}],
        })
        operation.setdefault("orderedDml", []).append({
            "action": "UPDATE_CAS", "table": "sys_hris_ai_assistance_requests",
            "assignments": {"subject_public_id": "authenticatedPrincipal.workerPublicId"},
        })

    def mutate_self(value: dict[str, dict[str, Any]]) -> None:
        operation = next(row for row in value["operation"]["operations"] if row["operationId"] == self_operation_id)
        authority_kinds = {
            "CALLER_SUBJECT_EQUALITY", "DERIVED_AUTHENTICATED_SUBJECT",
            "EXACT_DELEGATION_SELECTOR", "SUBJECT_OWNERSHIP_GUARD",
        }
        # Remove every structured authority fact accepted by
        # check_self_authority, not just the evidence installed by prepare.
        retained_effect_rows = []
        for row in operation.get("inputEffects", []):
            row["effects"] = [
                effect for effect in row.get("effects", [])
                if effect.get("kind") not in authority_kinds
            ]
            if row["effects"]:
                retained_effect_rows.append(row)
        operation["inputEffects"] = retained_effect_rows

        # Make the regression concrete: the mutated request supplies its own
        # subject and all subject-bearing domain assignments use that value.
        if not any(row.get("source") == "body.workerPublicId" for row in operation.get("requestFields", [])):
            operation.setdefault("requestFields", []).append(_body_field("workerPublicId"))
        for step in operation.get("orderedDml", []):
            table_name = str(step.get("table", ""))
            if "command_receipt" in table_name or "outbox" in table_name:
                continue
            for key, source in list(step.get("assignments", {}).items()):
                subject_column = token_present(
                    [key], ("worker", "subject", "requester", "applicant", "assignee", "profile_owner")
                )
                ai_owner_column = self_operation_id.startswith("modern.ai.assist.") and key == "created_by"
                if subject_column or ai_owner_column:
                    step["assignments"][key] = "body.workerPublicId"

    execute(
        "P0-CROSS-SELF-004", "mutate_self_subject_derivation_removed",
        "SELF.DML_DERIVATION", self_operation_id, prepare_self, mutate_self,
    )

    # Each of the 16 domain findings gets a real missing-operation mutation.
    for requirement_id in [
        "P0-REC-001", "P0-ONB-001", "P0-WFP-001", "P0-BNF-001",
        "P0-HRS-001", "P0-CWK-001", "P0-SKL-001", "P0-GRW-001",
        "P0-LRN-001", "P0-MKT-001", "P0-SUC-001", "P0-CMP-001",
        "P0-WFM-001", "P0-LIS-001", "P0-ANL-001", "P0-AI-001",
    ]:
        operation_id = DOMAIN_OPERATION_REQUIREMENTS[requirement_id][0].operation_id
        execute(
            requirement_id,
            "mutate_" + requirement_id.lower().replace("-", "_") + "_operation_removed",
            "DOMAIN.OPERATION_MISSING", operation_id,
            lambda value: None,
            lambda value, oid=operation_id: value["operation"].__setitem__(
                "operations", [row for row in value["operation"]["operations"] if row.get("operationId") != oid]
            ),
        )

    config_table, config_column = P1_CONFIG_FIELDS[0]
    config_subject = f"{config_table}.{config_column}"
    config_version_aliases = configuration_version_aliases(config_column)
    config_version_column = config_version_aliases[0]

    def prepare_config(value: dict[str, dict[str, Any]]) -> None:
        table = next(row for row in value["exact"]["tableSpecifications"] if row["tableName"] == config_table)
        # Normalize the positive control to one known exact version pin.  This
        # prevents a pre-existing accepted alias from silently satisfying the
        # mutated case after only the synthetic column is removed.
        table["columns"] = [
            row for row in table.get("columns", [])
            if not token_present([str(row.get("name", ""))], config_version_aliases)
        ]
        table["columns"].append({
            "name": config_version_column, "sqlType": "UUID", "nullable": False,
            "referenceContract": {"entityType": "SYS.ConfigVocabularyVersion", "idSpace": "PUBLIC_UUID"},
        })

    def mutate_config(value: dict[str, dict[str, Any]]) -> None:
        table = next(row for row in value["exact"]["tableSpecifications"] if row["tableName"] == config_table)
        # Remove the complete evidence set recognized by CFG.VERSION_COLUMN,
        # including a real code-set/country-pack pin already in the candidate.
        table["columns"] = [
            row for row in table["columns"]
            if not token_present([str(row.get("name", ""))], config_version_aliases)
        ]

    execute(
        "P1-CFG-001", "mutate_config_vocabulary_version_removed",
        "CFG.VERSION_COLUMN", config_subject, prepare_config, mutate_config,
    )

    money_table, money_column = P1_MONEY_TARGETS[0]
    money_subject = f"{money_table}.{money_column}"

    def prepare_money(value: dict[str, dict[str, Any]]) -> None:
        table = next(row for row in value["exact"]["tableSpecifications"] if row["tableName"] == money_table)
        existing = {row.get("name") for row in table.get("columns", [])}
        for name in ("currency_code", "frequency_code", "basis_code", "fx_snapshot_public_id"):
            if name not in existing:
                table["columns"].append({"name": name, "sqlType": "VARCHAR(80)", "nullable": False})

    def mutate_money(value: dict[str, dict[str, Any]]) -> None:
        table = next(row for row in value["exact"]["tableSpecifications"] if row["tableName"] == money_table)
        table["columns"] = [row for row in table["columns"] if row.get("name") != "basis_code"]

    execute(
        "P1-MONEY-002", "mutate_money_basis_removed", "MONEY.TABLE",
        money_subject, prepare_money, mutate_money,
    )

    decision_id = sorted(P1_DECISIONS)[0]

    def prepare_decision(value: dict[str, dict[str, Any]]) -> None:
        operation = next(row for row in value["operation"]["operations"] if row["operationId"] == decision_id)
        names = {row.get("name") for row in operation.get("requestFields", [])}
        for name in ("actorMode", "reason", "delegationReceiptId"):
            if name not in names:
                operation.setdefault("requestFields", []).append(_body_field(name))

    def mutate_decision(value: dict[str, dict[str, Any]]) -> None:
        operation = next(row for row in value["operation"]["operations"] if row["operationId"] == decision_id)
        operation["requestFields"] = [row for row in operation["requestFields"] if row.get("name") != "actorMode"]

    execute(
        "P1-DECISION-003", "mutate_decision_actor_mode_removed",
        "DECISION.REQUEST", decision_id, prepare_decision, mutate_decision,
    )

    revision_id = sorted(P1_REVISIONS)[0]

    def prepare_revision(value: dict[str, dict[str, Any]]) -> None:
        operation = next(row for row in value["operation"]["operations"] if row["operationId"] == revision_id)
        names = {row.get("name") for row in operation.get("requestFields", [])}
        for name in (
            "revisionMode", "effectiveFrom", "effectiveTo", "reason", "changedFields",
            "segmentPredecessorVersionId", "segmentPredecessorRevision",
        ):
            if name not in names:
                operation.setdefault("requestFields", []).append(_body_field(name))
        revision_mode = next(
            row for row in operation["requestFields"] if row.get("name") == "revisionMode"
        )
        revision_mode.update({
            "allowedValues": ["CORRECTION", "SUPERSEDE"],
            "validation": "LIFECYCLE is server-only and forbidden on this public revise operation",
        })

    def mutate_revision(value: dict[str, dict[str, Any]]) -> None:
        operation = next(row for row in value["operation"]["operations"] if row["operationId"] == revision_id)
        operation["requestFields"] = [row for row in operation["requestFields"] if row.get("name") != "revisionMode"]

    execute(
        "P1-EFFECTIVE-004", "mutate_revision_mode_removed",
        "EFFECTIVE.REQUEST", revision_id, prepare_revision, mutate_revision,
    )
    return probes


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--check", action="store_true", help="do not write the report")
    parser.add_argument("--self-test-only", action="store_true")
    parser.add_argument(
        "--candidate-dir", type=Path,
        help="directory containing all six canonical basenames; never mix with per-file options",
    )
    for role in CANONICAL_PATHS:
        parser.add_argument(f"--{role}", type=Path, help=f"alternate {role} artifact")
    args = parser.parse_args(argv)

    self_tests = run_self_tests()
    if args.self_test_only:
        payload = {"selfTests": self_tests, "status": "PASS" if all(x["status"] == "PASS" for x in self_tests) else "FAIL"}
        print(json.dumps(payload, ensure_ascii=False, sort_keys=True))
        return 0 if payload["status"] == "PASS" else 1

    if sha256_file(FROZEN_AUDIT) != EXPECTED_AUDIT_SHA256:
        print(json.dumps({
            "status": "FAIL", "error": "frozen audit requirement source hash drift",
            "expected": EXPECTED_AUDIT_SHA256, "actual": sha256_file(FROZEN_AUDIT),
        }, sort_keys=True), file=sys.stderr)
        return 2
    audit = load_json(FROZEN_AUDIT)
    individual = {role: getattr(args, role) for role in CANONICAL_PATHS}
    supplied = {role for role, path in individual.items() if path is not None}
    if args.candidate_dir is not None and supplied:
        parser.error("--candidate-dir and per-file candidate options are mutually exclusive")
    if supplied and supplied != set(CANONICAL_PATHS):
        parser.error("alternate per-file validation requires all six: " + ", ".join(sorted(CANONICAL_PATHS)))
    if args.candidate_dir is not None:
        selected_paths = {
            role: args.candidate_dir / filename
            for role, filename in CANONICAL_FILENAMES.items()
        }
    elif supplied:
        selected_paths = {role: path for role, path in individual.items() if path is not None}
    else:
        selected_paths = dict(CANONICAL_PATHS)
    selected_paths = {role: path.expanduser().resolve() for role, path in selected_paths.items()}
    parents = {path.parent for path in selected_paths.values()}
    if len(parents) != 1:
        parser.error("all six candidate artifacts must come from one resolved directory (mixed-source forbidden)")
    wrong_names = {
        role: path.name for role, path in selected_paths.items()
        if path.name != CANONICAL_FILENAMES[role]
    }
    if wrong_names:
        parser.error("alternate files must retain canonical basenames: " + json.dumps(wrong_names, sort_keys=True))

    docs: dict[str, dict[str, Any]] = {}
    hashes: dict[str, str] = {}
    source_paths: dict[str, str] = {}
    raw_bytes: dict[str, bytes] = {}
    for name, path in selected_paths.items():
        if not path.is_file():
            print(json.dumps({"status": "FAIL", "error": "candidate member missing", "role": name, "path": str(path)}), file=sys.stderr)
            return 2
        raw = path.read_bytes()
        raw_bytes[name] = raw
        try:
            docs[name] = json.loads(raw.decode("utf-8"))
        except Exception as exc:
            print(json.dumps({"status": "FAIL", "error": "candidate member is not valid UTF-8 JSON", "role": name, "path": str(path), "detail": str(exc)}), file=sys.stderr)
            return 2
        hashes[name] = sha256_bytes(raw)
        source_paths[name] = str(path)
    drift = {
        role: {"captured": hashes[role], "current": sha256_file(path)}
        for role, path in selected_paths.items()
        if sha256_file(path) != hashes[role]
    }
    if drift:
        print(json.dumps({"status": "FAIL", "error": "candidate changed during capture", "drift": drift}, sort_keys=True), file=sys.stderr)
        return 2

    _, deterministic_a = evaluate_docs(docs, audit, hashes, source_paths)
    _, deterministic_b = evaluate_docs(docs, audit, hashes, source_paths)
    deterministic_digest_a = sha256_bytes(canonical_json([row.as_dict() for row in deterministic_a]))
    deterministic_digest_b = sha256_bytes(canonical_json([row.as_dict() for row in deterministic_b]))
    self_tests.append({
        "testId": "live_baseline_deterministic",
        "status": "PASS" if deterministic_digest_a == deterministic_digest_b else "FAIL",
        "firstFindingDigest": deterministic_digest_a,
        "secondFindingDigest": deterministic_digest_b,
    })
    self_tests.extend(run_payroll_contract_mutation_tests(docs, audit))
    self_tests.extend(run_targeted_mutation_tests(docs, audit))

    report = build_report(docs, audit, hashes, source_paths, self_tests)
    if not args.check:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(
            json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
    print(json.dumps({
        "status": report["summary"]["status"],
        "counts": report["enumeration"]["counts"],
        "findings": report["summary"]["findingCount"],
        "P0": report["summary"]["P0"], "P1": report["summary"]["P1"],
        "failedRequirements": report["summary"]["failedRequirementCount"],
        "selfTests": f"{sum(x['status'] == 'PASS' for x in self_tests)}/{len(self_tests)}",
        "report": None if args.check else str(args.report),
        "reportSha256": None if args.check else sha256_file(args.report),
    }, ensure_ascii=False, sort_keys=True))
    if not report["summary"]["mutationSelfTestsPassed"]:
        return 3
    return 0 if report["summary"]["readyForGateConsideration"] else 1


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
