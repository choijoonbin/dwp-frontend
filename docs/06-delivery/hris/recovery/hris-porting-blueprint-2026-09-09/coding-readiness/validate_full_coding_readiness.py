#!/usr/bin/env python3
"""Fail-closed validator for the DWP HRIS generic-core G3 coding gate.

This opens only a coding gate. It never represents completed implementation,
functional/design acceptance, country/connector activation, tenant cutover, or
production approval.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import stat
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
G0 = ROOT / "g0"
if str(G0) not in sys.path:
    sys.path.insert(0, str(G0))
from host_semaphore import (  # noqa: E402
    HOST_VERIFICATION_SEMAPHORE,
    SemaphoreTimeoutError,
    exclusive_host_semaphore,
)
REPORT_DIR = HERE / "reports"
SHA40 = re.compile(r"^[0-9a-f]{40}$")
SHA256 = re.compile(r"^[0-9a-f]{64}$")


def current_effective_gate() -> str:
    try:
        payload = json.loads(
            (G0 / "current-g3-gate-decision.json").read_text(encoding="utf-8")
        )
    except (OSError, json.JSONDecodeError):
        return "CLOSED_FAIL_SAFE"
    return (
        "OPEN_G3_CODE"
        if payload.get("effectiveGate") == "OPEN_G3_CODE"
        and payload.get("currentState") == "OPEN_AUTHORITATIVE_LIVE"
        else "CLOSED_FAIL_SAFE"
    )

MODULES = {
    "HRIS-HRM": {
        "slug": "hrm",
        "parents": 583,
        "children": 1654,
        "decisions": 15,
        "source_modules": {"hrm"},
        "validator": "../session-evidence/hrm/g2-readiness/validate_hrm_readiness.py",
        "pass_marker": r"HRM_READINESS=PASS",
        "g2_files": [
            "../session-evidence/hrm/g2-readiness/README.md",
            "../session-evidence/hrm/g2-readiness/adr-001-people-sor-effective-dating.md",
            "../session-evidence/hrm/g2-readiness/physical-schema-blueprint.sql",
            "../session-evidence/hrm/g2-readiness/api-event-contracts.v1.json",
            "../session-evidence/hrm/g2-readiness/state-guard-idempotency-recovery.md",
            "../session-evidence/hrm/g2-readiness/authorization-field-policy.csv",
            "../session-evidence/hrm/g2-readiness/synthetic-golden-fixtures.json",
            "../session-evidence/hrm/g2-readiness/synthetic-golden-spec.md",
        ],
    },
    "HRIS-PER": {
        "slug": "per",
        "parents": 349,
        "children": 1041,
        "decisions": 16,
        "source_modules": {"per"},
        "validator": "../session-evidence/per/g2-readiness/validate_per_readiness.py",
        "pass_marker": r"PER_READINESS=PASS",
        "g2_files": [
            "../session-evidence/per/g2-readiness/README.md",
            "../session-evidence/per/g2-readiness/ADR-001-performance-boundary.md",
            "../session-evidence/per/g2-readiness/physical-schema.sql",
            "../session-evidence/per/g2-readiness/api-event-contracts.yaml",
            "../session-evidence/per/g2-readiness/state-guard-idempotency-recovery.md",
            "../session-evidence/per/g2-readiness/authorization-field-policy.md",
            "../session-evidence/per/g2-readiness/golden/performance-golden-fixtures.json",
            "../session-evidence/per/g2-readiness/golden/golden-spec.md",
            "../session-evidence/per/g2-readiness/g2-code-go-slices.csv",
        ],
    },
    "HRIS-TIM": {
        "slug": "tim",
        "parents": 568,
        "children": 3566,
        "decisions": 16,
        "source_modules": {"tim"},
        "validator": "../session-evidence/tim/validate_readiness.py",
        "pass_marker": r"HRIS-TIM_READINESS=PASS",
        "g2_files": [
            "../session-evidence/tim/g2-service-boundary.md",
            "../session-evidence/tim/g2-physical-schema.sql",
            "../session-evidence/tim/g2-api-event-contracts.json",
            "../session-evidence/tim/g2-runtime-controls.md",
            "../session-evidence/tim/g2-authorization.md",
            "../session-evidence/tim/synthetic-golden-fixtures.json",
            "../session-evidence/tim/synthetic-golden-spec.md",
        ],
    },
    "HRIS-PAY": {
        "slug": "pay",
        "parents": 580,
        "children": 3515,
        "decisions": 18,
        "source_modules": {"pay", "yea"},
        "validator": "../session-evidence/pay/validate_readiness.py",
        "pass_marker": r"HRIS-PAY_READINESS=PASS",
        "g2_files": [
            "../session-evidence/pay/g2-service-boundary.md",
            "../session-evidence/pay/g2-physical-schema.sql",
            "../session-evidence/pay/g2-api-event-contracts.json",
            "../session-evidence/pay/g2-runtime-controls.md",
            "../session-evidence/pay/g2-authorization.md",
            "../session-evidence/pay/synthetic-golden-fixtures.json",
            "../session-evidence/pay/synthetic-golden-spec.md",
        ],
    },
    "HRIS-SYS": {
        "slug": "sys",
        "parents": 189,
        "children": 225,
        "decisions": 13,
        "source_modules": {"sys"},
        "validator": "../session-evidence/sys/validate_sys_readiness.py",
        "pass_marker": r'"status"\s*:\s*"PASS"',
        "g2_files": [
            "../session-evidence/sys/g2-implementation-contract.md",
            "../session-evidence/sys/g2-state-machines.md",
            "../session-evidence/sys/g2-physical-schema.sql",
            "../session-evidence/sys/g2-contract-catalog.csv",
            "../session-evidence/sys/g2-golden-scenarios.csv",
        ],
    },
}
MODULE_SLUGS = {str(spec["slug"]) for spec in MODULES.values()}

EXPECTED_MIGRATION_RANGES = {
    "MIG-HRM-PEOPLE-51-73": (
        "dwp-people-server", "HRIS-HRM",
        "dwp-people-server/src/main/resources/db/migration", (51, 73),
    ),
    "MIG-PER-PERFORMANCE-1-63": (
        "dwp-people-server", "HRIS-PER",
        "dwp-people-server/src/main/resources/db/performance-migration", (1, 63),
    ),
    "MIG-SYS-AUTH-217-245": (
        "dwp-auth-server", "HRIS-SYS",
        "dwp-auth-server/src/main/resources/db/migration", (217, 245),
    ),
    "MIG-SYS-PLATFORM-262-290": (
        "dwp-platform-server", "HRIS-SYS",
        "dwp-platform-server/src/main/resources/db/migration", (262, 290),
    ),
    "MIG-TIM-TIME-1-39": (
        "dwp-time-server", "HRIS-TIM",
        "dwp-time-server/src/main/resources/db/migration", (1, 39),
    ),
    "MIG-PAY-PAYROLL-1-49": (
        "dwp-payroll-server", "HRIS-PAY",
        "dwp-payroll-server/src/main/resources/db/migration", (1, 49),
    ),
}
MIGRATION_SUCCESSOR_BASELINE_SHA = "b6d1f23e54e04b86d2b068e47b8bf6c9db608b5f"

COVERAGE_HEADER = [
    "session_id", "source_module", "artifact_type", "artifact_id", "display_key",
    "source_file", "source_line", "legacy_contract", "legacy_component_or_table",
    "observed_metadata", "disposition", "target_capability_id",
    "target_bounded_context_candidate", "target_api_or_event", "target_data_owner",
    "process_change", "genericity", "acceptance_evidence", "decision_status",
    "decision_owner", "notes",
]
CHILD_HEADER = [
    "child_id", "parent_artifact_id", "session_id", "source_module", "child_type",
    "source_file", "source_line", "source_fingerprint", "actor", "trigger",
    "input_contract", "output_contract", "validation_rules", "state_transitions",
    "exceptions", "legacy_dependency", "target_capability_candidate",
    "target_api_event_candidate", "target_data_owner_candidate", "disposition",
    "decision_status", "decision_id", "owner_role", "evidence_refs", "notes",
]
DECISION_HEADER = [
    "decision_id", "session_id", "scope", "decision_type", "question", "options",
    "proposed_decision", "status", "owner_role", "consulted_role_ids", "due_at",
    "blocking_gate", "blocking_scope", "evidence_refs", "resolution", "decided_at",
    "notes",
]
MODULE_GATE_HEADER = [
    "session_id", "module", "source_parent_count", "source_child_count",
    "g1_characterization", "g1_child_trace", "g1_decision_log", "g2_validator",
    "g2_contract_root", "backend_runtime", "frontend_feature_roots",
    "required_upstream_dependencies", "backend_baseline_id", "frontend_baseline_id",
    "gate_target", "gate_condition", "implementation_state", "production_state",
    "owner_role", "scope_boundary",
]
ACTIVATION_HEADER = [
    "activation_id", "module_or_platform", "capability", "required_real_evidence",
    "core_test_substitute", "owner_role", "named_binding_required", "gate", "status",
    "core_code_effect", "production_effect", "evidence",
]
OWNERSHIP_HEADER = [
    "concern_id", "concern", "primary_owner_role", "contributor_roles",
    "consumer_sessions", "authoritative_runtime", "authoritative_artifact",
    "dependency_ids", "g3_required_delivery", "g3_forbidden_pattern",
    "activation_boundary", "status",
]
DEPENDENCY_HEADER = [
    "dependency_id", "producer", "consumer", "contract", "delivery_mode",
    "required_for_consumer_stage", "fallback_or_guard", "status", "evidence",
]
ADR_HEADER = ["decision_id", "area", "decision", "status", "owner", "evidence", "change_trigger"]
NFR_HEADER = ["nfr_id", "area", "requirement", "code_gate_evidence", "activation_evidence", "owner", "status"]
EXTERNAL_INPUT_HEADER = [
    "input_id",
    "input",
    "classification",
    "required_for_g3_core",
    "required_for_g6_activation",
    "applicability",
    "core_substitute_or_rule",
    "evidence",
    "status",
]
CONTRACT_HEADER = [
    "contract_id",
    "dependency_id",
    "producer_session",
    "consumer_sessions",
    "contract_kind",
    "canonical_name",
    "producer_evidence",
    "consumer_evidence",
    "required_fields",
    "required_fields_sha256",
    "nested_required_fields",
    "nested_required_fields_sha256",
    "compatibility_rule",
    "failure_guard",
    "status",
]
MODERN_DELIVERY_HEADER = [
    "capability_id",
    "owner_session",
    "delivery_wave",
    "prerequisite_contracts",
    "generic_core_delivery",
    "activation_layers",
    "g3_engineering_scope",
    "acceptance_contract",
    "implementation_state",
    "production_state",
    "status",
    "source_roadmap_ref",
]
MODERN_TRACE_HEADER = [
    "capability_id",
    "owner_session",
    "module_prompt_ref",
    "implementation_slice_id",
    "menu_node_keys",
    "data_contracts",
    "authorization_capabilities",
    "api_event_contracts",
    "test_evidence_allocation",
    "g4_acceptance_evidence",
    "state",
]
STRUCTURE_HEADER = [
    "session_id",
    "backend_service_roots",
    "backend_source_roots",
    "backend_test_roots",
    "backend_layer_contract",
    "backend_forbidden_dependencies",
    "frontend_feature_roots",
    "frontend_layer_contract",
    "frontend_forbidden_dependencies",
    "architecture_test_allocation",
    "g0_ownership_ids",
    "state",
]
G3_ALLOCATION_HEADER = [
    "allocation_id",
    "session_id",
    "repository",
    "artifact_class",
    "path_globs",
    "verification_globs",
    "writer_role",
    "g0_ownership_ids",
    "dependency_ids",
    "state",
    "scope_boundary",
]
PLATFORM_BINDING_HEADER = [
    "binding_id",
    "concern",
    "canonical_contract",
    "runtime_owner",
    "browser_route",
    "service_route",
    "schema_reference",
    "adapter_reference",
    "test_reference",
    "required_fields",
    "baseline_state",
    "g3_delivery",
    "g6_boundary",
    "status",
]

ALLOWED_DISPOSITIONS = {"REUSE", "REBUILD", "CONFIGURE", "EXTENSION", "RETIRE"}
EXPECTED_ACTIVATIONS = {
    "ACT-G6-KR-TIME", "ACT-G6-KR-PAY", "ACT-G6-YEA", "ACT-G6-ERP", "ACT-G6-BANK",
    "ACT-G6-TAX-INSURANCE", "ACT-G6-CLOCK", "ACT-G6-CUSTOM-LEGACY",
    "ACT-G6-TENANT-CONFIG", "ACT-G6-CUSTOMER-DATA", "ACT-G6-CAPACITY",
    "ACT-G6-PROD-SECRETS", "ACT-G6-SECURITY-PRIVACY", "ACT-G6-DB-DR",
    "ACT-G6-BUSINESS-RELEASE",
}
EXPECTED_EXTERNAL_INPUTS = {f"EXT-{number:03d}" for number in range(1, 7)}
EXPECTED_CROSS_CONTRACTS = {f"XCON-{number:03d}" for number in range(1, 22)}
EXPECTED_CONTRACT_FIELDS = {
    "WorkerAssignmentSnapshot.v1": {
        "snapshotVersion", "asOf", "personPublicId", "workerPublicId",
        "workerStatus", "relationships", "assignments",
    },
    "CompensationBasisSnapshot.v1": {
        "snapshotVersion", "asOf", "compensationBasisPublicId",
        "workerPublicId", "assignmentPublicId", "legalEntityPublicId",
        "payGroupPublicId", "basisType", "amount", "currency", "frequency",
        "validFrom", "validTo", "sourceRevision", "payloadDigest",
    },
    "WorkerChanged.v1": {
        "workerPublicId", "changeType", "effectiveDate", "newAggregateVersion",
    },
    "EmploymentChanged.v1": {
        "relationshipPublicId", "changeType", "effectiveDate",
        "newAggregateVersion",
    },
    "AssignmentChanged.v1": {
        "assignmentPublicId", "eventPublicId", "eventType", "effectiveDate",
        "changedReferences", "newAggregateVersion",
    },
    "OrganizationChanged.v1": {
        "revisionPublicId", "effectiveDate", "changedOrganizationPublicIds",
        "snapshotDigest",
    },
    "CompensationBasisChanged.v1": {
        "compensationBasisPublicId", "assignmentPublicId", "basisType",
        "validFrom", "validTo", "newAggregateVersion",
    },
    "ClosedTimeResult.v1": {
        "closedTimeResultId", "closePeriodId", "closeRevision",
        "payrollEntityId", "payPeriodId", "ledgerRevisionFrom",
        "ledgerRevisionTo", "workerCount", "lineCount", "sourceDigest",
        "ruleDigest", "payloadDigest", "supersedesResultId", "lines",
    },
    "TimePeriodClosed.v1": {
        "closePeriodId", "closeRevision", "periodStart", "periodEnd",
        "scopeId", "ledgerRevision", "sourceDigest", "ruleDigest",
    },
    "TimePeriodReopened.v1": {
        "closePeriodId", "priorCloseRevision", "newRevision", "reasonCode",
    },
    "PayrollTimeHandoffReady.v1": {
        "handoffId", "closedTimeResultId", "closePeriodId", "closeRevision",
        "payrollEntityId", "payPeriodId", "workerCount", "lineCount",
        "sourceDigest", "ruleDigest", "payloadDigest",
    },
    "HrisHomeContributionChanged.v1": {
        "module", "widgetKey", "ownerPopulationScope", "scopeRevision", "state",
        "generatedAt", "freshUntil", "staleAfter", "payloadRef",
        "payloadDigest",
    },
    "WorkplaceAssignmentSnapshot.v1": {
        "snapshotId", "snapshotRevision", "workerId", "assignmentId",
        "workplaceId", "workLocationCode", "timeZone", "calendarId",
        "effectiveFrom", "effectiveTo", "sourceVersion", "payloadDigest",
    },
    "WorkerDependentEligibilitySnapshot.v1": {
        "snapshotId", "snapshotRevision", "workerId", "dependentPublicId",
        "relationshipType", "eligibilityFacts", "effectiveFrom", "effectiveTo",
        "sourceVersion", "payloadDigest",
    },
    "WorkerTaxIdentitySnapshot.v1": {
        "snapshotId", "snapshotRevision", "workerId", "taxJurisdictionCode",
        "taxIdentifierToken", "residencyStatus", "workerClassification",
        "effectiveFrom", "effectiveTo", "sourceVersion", "payloadDigest",
    },
    "WorkerBankAccountTokenSnapshot.v1": {
        "snapshotId", "snapshotRevision", "workerId", "bankAccountToken",
        "maskedAccountDisplay", "currency", "paymentPriority", "effectiveFrom",
        "effectiveTo", "sourceVersion", "payloadDigest",
    },
    "ApprovedCompensationPlanSnapshot.v1": {
        "snapshotId", "snapshotRevision", "planId", "cycleId", "effectiveFrom",
        "effectiveTo", "approvalReceiptId", "sourceVersion", "lineCount", "lines",
        "payloadDigest",
    },
    "ApprovedCompensationPlanSnapshotPublished.v2": {
        "aggregateId", "fromState", "toState", "aggregateVersion", "occurredAt",
        "correlationId", "planId", "cycleId", "approvalRevision",
        "approvalReceiptId", "effectiveDate", "snapshotId", "lineCount",
        "snapshotRevision", "sourceVersion", "payloadDigest",
    },
}
EXPECTED_CONTRACT_NESTED_FIELDS = {
    "ClosedTimeResult.v1": {
        "workerId", "assignmentId", "payCode", "unit", "quantity",
        "currency", "sourceEntryCount", "sourceEntryDigest",
    },
    "ApprovedCompensationPlanSnapshot.v1": {
        "lineId", "lineSequence", "workerId", "assignmentId", "componentCode",
        "currency", "approvedAmount", "effectiveFrom", "effectiveTo", "lineDigest",
    },
}

EXPECTED_STRUCTURE_LAYERS = {
    "backend": (
        "api>application|application>domain|infrastructure>application|"
        "infrastructure>domain|config>wiring-only"
    ),
    "backend_forbidden": (
        "domain->spring|domain->http|domain->jdbc|domain->jpa|domain->kafka|"
        "module->foreign_repository|module->foreign_entity"
    ),
    "frontend": (
        "routes>pages|pages>components|pages>model|components>model|api>model|"
        "forms>model|hooks>api|testing>public-api"
    ),
    "frontend_forbidden": (
        "feature->foreign_feature_internal|ui->transport_dto|model->react|"
        "feature->gateway_raw_client"
    ),
}
EXPECTED_BACKEND_FORBIDDEN_BY_SESSION = {
    **{
        session_id: EXPECTED_STRUCTURE_LAYERS["backend_forbidden"]
        for session_id in ("HRIS-HRM", "HRIS-PER", "HRIS-TIM", "HRIS-PAY")
    },
    "HRIS-SYS": (
        EXPECTED_STRUCTURE_LAYERS["backend_forbidden"]
        + "|hrisinsights->hrisconfiguration_repository"
        + "|hrisconfiguration->hrisinsights_repository"
    ),
}
EXPECTED_PLATFORM_BINDINGS = {
    "PLAT-001": "DOMAIN_EVENT_OUTBOX",
    "PLAT-002": "API_ROUTING",
    "PLAT-003": "APPROVAL",
    "PLAT-004": "NOTIFICATION",
    "PLAT-005": "AUDIT",
    "PLAT-006": "CONFIGURATION",
    "PLAT-007": "AUTHORIZATION_PEP",
}
EXPECTED_PLATFORM_BASELINE_STATES = {
    "PLAT-001": "BASELINE_REUSE_VALIDATED",
    "PLAT-002": "BASELINE_PATTERN_VALIDATED_G3_ROUTE_NOT_IMPLEMENTED",
    "PLAT-003": "BASELINE_REUSE_VALIDATED_HRIS_ADAPTER_NOT_STARTED",
    "PLAT-004": "BASELINE_REUSE_VALIDATED_HRIS_ADAPTER_NOT_STARTED",
    "PLAT-005": "BASELINE_REUSE_VALIDATED_HRIS_ADAPTER_NOT_STARTED",
    "PLAT-006": "CONTRACT_ALLOCATED_NOT_IMPLEMENTED",
    "PLAT-007": "BASELINE_PATTERN_VALIDATED_HRIS_BINDING_NOT_STARTED",
}
EXPECTED_PLATFORM_FIELDS = {
    "PLAT-001": {
        "specVersion", "id", "source", "type", "schemaVersion", "time",
        "tenantId", "aggregateType", "aggregateId", "aggregateSequence",
        "correlationId", "data",
    },
    "PLAT-002": {
        "serviceKey", "gatewayPath", "ownerPath", "stripPrefix",
        "operationId", "appKey", "capabilityKey",
    },
    "PLAT-003": {
        "requestId", "workflowVersion", "subjectRef", "requesterRef", "state",
        "decision", "decisionActorRef", "decisionAt", "correlationId",
    },
    "PLAT-004": {
        "typeKey", "recipientUserIds", "threadKey", "locale", "reasonCode",
        "actorReference", "subjectReference", "targetReference", "dueAt",
        "actionRequired", "variables",
    },
    "PLAT-005": {
        "eventId", "eventVersion", "occurredAt", "tenantId", "category",
        "action", "outcome", "actorType", "sourceService", "sourceModule",
        "targetType", "targetId", "correlationId", "retentionClass",
    },
    "PLAT-006": {
        "configurationId", "configurationType", "scopeType", "scopeId",
        "version", "state", "effectiveFrom", "effectiveTo",
        "payloadSchemaVersion", "payloadDigest", "approvalReceiptId",
    },
    "PLAT-007": {
        "operationId", "appEntitlement", "personaPackage", "atomicDuty",
        "capability", "resource", "action", "population", "fieldPolicy",
        "purpose", "decision",
    },
}


class Validation:
    def __init__(self) -> None:
        self.checks = 0
        self.errors: list[str] = []
        self.warnings: list[str] = []
        self.group_checks: Counter[str] = Counter()
        self.group_errors: Counter[str] = Counter()
        self.details: dict[str, Any] = {}

    def require(self, condition: bool, message: str, group: str) -> None:
        self.checks += 1
        self.group_checks[group] += 1
        if not condition:
            self.errors.append(f"[{group}] {message}")
            self.group_errors[group] += 1


def resolve(reference: str) -> Path:
    path = Path(reference)
    return path if path.is_absolute() else (HERE / path).resolve()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def canonical_cyclonedx_graph_sha256(path: Path) -> tuple[str, int, int, str, str]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    payload.pop("serialNumber", None)
    metadata = payload.get("metadata")
    if isinstance(metadata, dict):
        metadata.pop("timestamp", None)
    canonical = json.dumps(
        payload,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")
    return (
        hashlib.sha256(canonical).hexdigest(),
        len(payload.get("components", [])),
        len(payload.get("dependencies", [])),
        str(payload.get("bomFormat", "")),
        str(payload.get("specVersion", "")),
    )


def stable_fingerprint(*parts: str) -> str:
    normalized = "\x1f".join(str(part) for part in parts)
    return hashlib.sha256(
        normalized.encode("utf-8", "surrogateescape")
    ).hexdigest()


def is_within(path: Path, root: Path) -> bool:
    """Return True only when ``path`` stays inside a declared safe view."""
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def sanitized_child_candidates(
    source_file: str,
    access_row: dict[str, str],
    view_roots: dict[str, Path],
) -> list[Path]:
    """Resolve a child provenance pointer only inside registered sanitized views.

    Older HRM/PER/SYS generators record the logical legacy path while the newer
    TIM/PAY generators record a path relative to a sanitized-view root.  This
    normalizer supports both representations without ever consulting a raw
    source checkout.  The parent export is included as the final canonical
    candidate because route/controller children legitimately point at it.
    """
    relative = Path(source_file)
    if relative.is_absolute() or ".." in relative.parts:
        return []

    candidates: list[Path] = []
    frontend = view_roots.get("SRC-FRONT")
    session_slug = access_row.get("session_id", "").removeprefix("HRIS-").lower()
    module_root = view_roots.get(f"SRC-{session_slug.upper()}")

    if source_file.startswith("content/packages/") and frontend is not None:
        candidates.append(frontend / relative)
    elif source_file.startswith("content/") and module_root is not None:
        candidates.append(module_root / relative)
    elif source_file.startswith("packages/") and frontend is not None:
        candidates.append(frontend / "content" / f"{source_file}.analysis.txt")
    elif relative.parts and relative.parts[0] in MODULE_SLUGS and frontend is not None:
        candidates.append(
            frontend / "content" / "packages" / f"{source_file}.analysis.txt"
        )
    elif source_file.startswith(f"cloudhr-{session_slug}/") and module_root is not None:
        stripped = source_file.split("/", 1)[1]
        candidates.append(module_root / "content" / f"{stripped}.analysis.txt")
    elif source_file.startswith("src/") and module_root is not None:
        candidates.append(module_root / "content" / f"{source_file}.analysis.txt")

    export_text = access_row.get("sanitized_export_path", "")
    if export_text:
        candidates.append(Path(export_text))

    safe_candidates: list[Path] = []
    safe_roots = tuple(view_roots.values())
    for candidate in candidates:
        resolved = candidate.resolve()
        if (
            resolved not in safe_candidates
            and any(is_within(resolved, root) for root in safe_roots)
            and resolved.is_file()
        ):
            safe_candidates.append(resolved)
    return safe_candidates


def read_csv(
    path: Path,
    validation: Validation,
    group: str,
    expected_header: list[str] | None = None,
) -> list[dict[str, str]]:
    validation.require(path.is_file(), f"missing CSV: {path}", group)
    if not path.is_file():
        return []
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        header = list(reader.fieldnames or [])
        if expected_header is not None:
            validation.require(header == expected_header, f"header mismatch: {path.name}", group)
        rows = list(reader)
    validation.require(
        all(
            None not in row
            and all(value is not None for value in row.values())
            for row in rows
        ),
        f"malformed row width: {path.name}",
        group,
    )
    return rows


def split_pipe(value: str) -> list[str]:
    return [item.strip() for item in value.split("|") if item.strip()]


def versioned_contract_names(
    payload: dict[str, Any],
    key: str,
) -> set[str]:
    names: set[str] = set()
    values = payload.get(key, [])
    if not isinstance(values, list):
        return names
    for item in values:
        if isinstance(item, str):
            names.add(item)
            continue
        if not isinstance(item, dict):
            continue
        name = str(
            item.get("name")
            or item.get("eventType")
            or item.get("type")
            or ""
        )
        version = item.get("version")
        if name and version is not None and not re.search(r"\.v\d+$", name):
            name = f"{name}.v{version}"
        if name:
            names.add(name)
    return names


def versioned_contract_fields(
    payload: dict[str, Any],
    key: str,
) -> dict[str, set[str]]:
    contracts: dict[str, set[str]] = {}
    values = payload.get(key, [])
    if not isinstance(values, list):
        return contracts
    for item in values:
        if not isinstance(item, dict):
            continue
        name = str(
            item.get("name")
            or item.get("eventType")
            or item.get("type")
            or ""
        )
        version = item.get("version")
        if name and version is not None and not re.search(r"\.v\d+$", name):
            name = f"{name}.v{version}"
        fields = (
            item.get("requiredFields")
            or item.get("payloadRequired")
            or item.get("payload")
            or item.get("required")
            or []
        )
        schema_name = item.get("schema")
        if not fields and isinstance(schema_name, str):
            schema = payload.get("schemas", {}).get(schema_name, {})
            if isinstance(schema, dict):
                fields = schema.get("required", [])
        if name and isinstance(fields, list):
            contracts[name] = {str(field) for field in fields}
    return contracts


def versioned_contract_nested_fields(
    payload: dict[str, Any],
    key: str,
) -> dict[str, set[str]]:
    contracts: dict[str, set[str]] = {}
    values = payload.get(key, [])
    if not isinstance(values, list):
        return contracts
    for item in values:
        if not isinstance(item, dict):
            continue
        name = str(
            item.get("name")
            or item.get("eventType")
            or item.get("type")
            or ""
        )
        version = item.get("version")
        if name and version is not None and not re.search(r"\.v\d+$", name):
            name = f"{name}.v{version}"
        fields = item.get("lineRequired") or item.get("nestedRequiredFields") or []
        if name and isinstance(fields, list):
            contracts[name] = {str(field) for field in fields}
    return contracts


def yaml_named_block(text: str, key: str) -> set[str]:
    """Extract ``- name:`` values from one top-level YAML block.

    The repository intentionally has no runtime YAML dependency.  This strict,
    small parser is sufficient for the canonical contract lists and fails
    closed when their layout or key changes.
    """
    lines = text.splitlines()
    start = next(
        (index for index, line in enumerate(lines) if line.strip() == f"{key}:"),
        None,
    )
    if start is None:
        return set()
    names: set[str] = set()
    current = ""
    for line in lines[start + 1 :]:
        if line and not line[0].isspace():
            break
        match = re.match(r"\s+-\s+name:\s*([^#]+?)\s*$", line)
        if match:
            current = match.group(1).strip().strip("'\"")
            names.add(current)
            continue
        version_match = re.match(r"\s+version:\s*(\d+)\s*$", line)
        if current and version_match and not re.search(r"\.v\d+$", current):
            names.discard(current)
            current = f"{current}.v{version_match.group(1)}"
            names.add(current)
    return names


def yaml_contract_fields(text: str, key: str) -> dict[str, set[str]]:
    lines = text.splitlines()
    start = next(
        (index for index, line in enumerate(lines) if line.strip() == f"{key}:"),
        None,
    )
    if start is None:
        return {}
    contracts: dict[str, set[str]] = {}
    current = ""
    for line in lines[start + 1 :]:
        if line and not line[0].isspace():
            break
        name_match = re.match(r"\s+-\s+name:\s*([^#]+?)\s*$", line)
        if name_match:
            current = name_match.group(1).strip().strip("'\"")
            contracts[current] = set()
            continue
        version_match = re.match(r"\s+version:\s*(\d+)\s*$", line)
        if current and version_match and not re.search(r"\.v\d+$", current):
            previous = current
            current = f"{current}.v{version_match.group(1)}"
            contracts[current] = contracts.pop(previous, set())
            continue
        fields_match = re.match(
            r"\s+(?:payload|required|requiredFields):\s*\[([^]]*)\]\s*$",
            line,
        )
        if current and fields_match:
            contracts[current] = {
                value.strip().strip("'\"")
                for value in fields_match.group(1).split(",")
                if value.strip()
            }
    return contracts


def yaml_contract_nested_fields(text: str, key: str) -> dict[str, set[str]]:
    """Extract exact nested/line required fields from a canonical YAML list."""
    lines = text.splitlines()
    start = next(
        (index for index, line in enumerate(lines) if line.strip() == f"{key}:"),
        None,
    )
    if start is None:
        return {}
    contracts: dict[str, set[str]] = {}
    current = ""
    for line in lines[start + 1 :]:
        if line and not line[0].isspace():
            break
        name_match = re.match(r"\s+-\s+name:\s*([^#]+?)\s*$", line)
        if name_match:
            current = name_match.group(1).strip().strip("'\"")
            contracts[current] = set()
            continue
        version_match = re.match(r"\s+version:\s*(\d+)\s*$", line)
        if current and version_match and not re.search(r"\.v\d+$", current):
            previous = current
            current = f"{current}.v{version_match.group(1)}"
            contracts[current] = contracts.pop(previous, set())
            continue
        fields_match = re.match(
            r"\s+(?:lineRequired|lineRequiredFields|nestedRequiredFields):\s*\[([^]]*)\]\s*$",
            line,
        )
        if current and fields_match:
            contracts[current] = {
                value.strip().strip("'\"")
                for value in fields_match.group(1).split(",")
                if value.strip()
            }
    return contracts


def parse_time(value: str) -> datetime | None:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None


def git(path: Path, *arguments: str) -> str:
    result = subprocess.run(
        ["git", "-C", str(path), *arguments],
        check=True,
        capture_output=True,
        text=True,
        timeout=60,
    )
    return result.stdout.strip()


def validate_roles(validation: Validation) -> set[str]:
    group = "owners"
    rows = read_csv(G0 / "role-register.csv", validation, group)
    if rows:
        validation.require(
            {
                "role_id",
                "status",
                "named_binding_state",
                "g2_g3_approval_authority",
                "production_approval_authority",
                "ack_required_before_g2",
            }
            <= set(rows[0]),
            "role register columns incomplete",
            group,
        )
    roles: set[str] = set()
    for line, row in enumerate(rows, 2):
        role = row.get("role_id", "").strip()
        validation.require(bool(role), f"role line {line}: blank role_id", group)
        validation.require(role not in roles, f"role line {line}: duplicate {role}", group)
        validation.require(row.get("status") == "ACTIVE_ROLE_ID", f"role line {line}: inactive {role}", group)
        validation.require(
            row.get("named_binding_state")
            == "ROLE_BOUND_FOR_G3_ENGINEERING_G6_NAMED_PENDING",
            f"role line {line}: generic-core/G6 binding boundary drift",
            group,
        )
        validation.require(
            row.get("g2_g3_approval_authority") == "YES"
            and row.get("ack_required_before_g2") == "NO",
            f"role line {line}: generic-core engineering authority is blocked",
            group,
        )
        validation.require(
            row.get("production_approval_authority") == "NO",
            f"role line {line}: production authority is overstated",
            group,
        )
        roles.add(role)
    validation.require(bool(roles), "no active roles", group)

    binding_rows = read_csv(
        G0 / "role-operational-binding-register.csv",
        validation,
        group,
    )
    binding_required = {
        "role_id",
        "status",
        "g1_allowed",
        "g2_g3_allowed",
        "production_allowed",
        "real_assignee_required_before",
    }
    if binding_rows:
        validation.require(
            binding_required <= set(binding_rows[0]),
            "role binding columns incomplete",
            group,
        )
    binding_ids = {row.get("role_id", "") for row in binding_rows}
    validation.require(
        binding_ids == roles and len(binding_ids) == len(binding_rows),
        "role/binding identifier sets differ or contain duplicates",
        group,
    )
    for line, row in enumerate(binding_rows, 2):
        validation.require(
            row.get("status") == "ROLE_BOUND_FOR_G3_ENGINEERING"
            and row.get("g1_allowed") == "YES"
            and row.get("g2_g3_allowed") == "YES",
            f"role binding line {line}: generic-core engineering is not enabled",
            group,
        )
        validation.require(
            row.get("production_allowed") == "NO"
            and row.get("real_assignee_required_before")
            == "G6_PRODUCTION_ACTIVATION",
            f"role binding line {line}: named production boundary drift",
            group,
        )

    raci_rows = read_csv(
        G0 / "raci-sla-register.csv",
        validation,
        group,
    )
    raci_required = {
        "decision_id",
        "responsible_role_ids",
        "accountable_role_id",
        "consulted_role_ids",
        "informed_role_ids",
        "escalation_role_id",
        "g2_g3_effect",
        "production_effect",
    }
    if raci_rows:
        validation.require(
            raci_required <= set(raci_rows[0]),
            "RACI/SLA columns incomplete",
            group,
        )
    validation.require(bool(raci_rows), "RACI/SLA register is empty", group)
    for line, row in enumerate(raci_rows, 2):
        referenced_roles = {
            row.get("accountable_role_id", ""),
            row.get("escalation_role_id", ""),
            *split_pipe(row.get("responsible_role_ids", "")),
            *split_pipe(row.get("consulted_role_ids", "")),
            *split_pipe(row.get("informed_role_ids", "")),
        }
        validation.require(
            bool(referenced_roles) and referenced_roles <= roles,
            f"RACI line {line}: unknown role reference",
            group,
        )
        validation.require(
            row.get("g2_g3_effect")
            == "ALLOW_G3_GENERIC_CORE_WITH_VALIDATOR_AND_ROLE_ACCOUNTABILITY",
            f"RACI line {line}: stale named-ACK G3 block",
            group,
        )
        validation.require(
            row.get("production_effect", "").startswith("BLOCK_"),
            f"RACI line {line}: production is not fail-closed",
            group,
        )
    validation.details["authorityBoundary"] = {
        "g3GenericCore": "ROLE_ACCOUNTABILITY_AND_FAIL_CLOSED_VALIDATION",
        "namedPersonBinding": "REQUIRED_AT_G6_PRODUCTION_ACTIVATION",
        "production": "NOT_AUTHORIZED_G6",
    }
    return roles


def run_source_provenance(validation: Validation, check_live: bool) -> None:
    """Run the independent, value-safe source provenance proof.

    The child validator owns byte/tree/view binding and intentionally never reads
    raw source contents.  The central gate consumes only its compact JSON result.
    """
    group = "source-provenance"
    validator = HERE / "validate_source_provenance.py"
    validation.require(
        validator.is_file(),
        f"missing source provenance validator: {validator}",
        group,
    )
    if not validator.is_file():
        return
    flag = "--check-live" if check_live else "--static"
    try:
        completed = subprocess.run(
            [sys.executable, str(validator), flag],
            cwd=str(HERE),
            capture_output=True,
            text=True,
            timeout=300,
            check=False,
        )
    except subprocess.TimeoutExpired:
        validation.require(False, "source provenance validator timeout", group)
        return
    try:
        payload = json.loads(completed.stdout)
    except json.JSONDecodeError as error:
        validation.require(False, f"source provenance output is not JSON: {error}", group)
        payload = {}
    expected_mode = "live" if check_live else "static"
    validation.require(
        completed.returncode == 0
        and payload.get("schema") == "dwp.hris.source-provenance.v1"
        and payload.get("mode") == expected_mode
        and payload.get("status") == "PASS"
        and payload.get("errors") == [],
        f"source provenance failed rc={completed.returncode}",
        group,
    )
    validation.require(
        payload.get("rawSourceContentRead") is False,
        "source provenance validator reports raw source content access",
        group,
    )
    validation.require(
        payload.get("coverageParents") == 2269
        and payload.get("inventory")
        == {"routes": 886, "controllers": 825, "entities": 558}
        and payload.get("sanitized")
        == {"available": 2258, "blocked": 9, "retired": 2}
        and payload.get("sources") == 6,
        "source provenance totals or inventory binding drift",
        group,
    )
    live_operations = payload.get("gitLiveOperations", [])
    validation.require(
        (not check_live and live_operations == [])
        or (
            check_live
            and isinstance(live_operations, list)
            and set(live_operations)
            <= {"rev-parse HEAD", "rev-parse HEAD^{tree}", "status --porcelain", "ls-tree -r"}
        ),
        "source provenance live operation allowlist drift",
        group,
    )
    validation.details["sourceProvenance"] = {
        "status": "PASS" if completed.returncode == 0 and payload.get("status") == "PASS" else "FAIL",
        "mode": expected_mode,
        "checks": payload.get("checks"),
        "outputSha256": hashlib.sha256(
            (completed.stdout + completed.stderr).encode("utf-8")
        ).hexdigest(),
        "rawSourceContentRead": payload.get("rawSourceContentRead"),
    }


def run_trace_semantics(validation: Validation) -> None:
    """Run the independent semantic proof for all normalized child traces."""
    group = "trace-semantics"
    validator = ROOT / "readiness-tools/validate_trace_semantics.py"
    review = ROOT / "trace-semantic-risk-review-register.csv"
    validation.require(validator.is_file(), "trace semantic validator missing", group)
    validation.require(review.is_file(), "trace risk review register missing", group)
    if not validator.is_file():
        return
    try:
        completed = subprocess.run(
            [sys.executable, str(validator)],
            cwd=str(validator.parent),
            capture_output=True,
            text=True,
            timeout=180,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        validation.require(False, f"trace semantic validator failed: {error}", group)
        return
    output = (completed.stdout + "\n" + completed.stderr).strip()
    validation.require(
        completed.returncode == 0,
        f"trace semantic validator failed rc={completed.returncode}",
        group,
    )
    validation.require(
        re.search(
            r"TRACE_SEMANTICS=PASS\s+checks=\d+\s+rows=10001\s+modules=5\s+review_samples=58\b",
            output,
        )
        is not None,
        "trace semantic validator did not attest 10,001 rows / 5 modules / 58 samples",
        group,
    )
    if review.is_file():
        review_rows = read_csv(review, validation, group)
        validation.require(
            len(review_rows) == 58
            and {row.get("module", "").lower() for row in review_rows}
            == MODULE_SLUGS
            and all(row.get("status") == "PASS" for row in review_rows),
            "trace semantic risk review coverage/status drift",
            group,
        )
    validation.details["traceSemantics"] = {
        "status": "PASS" if completed.returncode == 0 else "FAIL",
        "rows": 10001,
        "modules": 5,
        "riskReviewSamples": 58,
        "validatorSha256": sha256(validator),
        "reviewSha256": sha256(review) if review.is_file() else None,
        "outputSha256": hashlib.sha256(output.encode("utf-8")).hexdigest(),
    }


def run_target_family_resolution(validation: Validation) -> None:
    """Require all 86 source target families to resolve to exact contracts."""
    group = "target-family-resolution"
    validator = HERE / "validate_target_family_resolution.py"
    register = HERE / "target-family-resolution-register.csv"
    shared = HERE / "shared-contract-catalog.csv"
    for path, label in (
        (validator, "target-family validator"),
        (register, "target-family register"),
        (shared, "shared contract catalog"),
    ):
        validation.require(path.is_file(), f"missing {label}", group)
    if not validator.is_file():
        return
    results: dict[str, Any] = {}
    for self_test in (False, True):
        command = [sys.executable, str(validator)]
        if self_test:
            command.append("--self-test")
        command.append("--compact")
        label = "self-test" if self_test else "closure"
        try:
            completed = subprocess.run(
                command,
                cwd=str(HERE),
                capture_output=True,
                text=True,
                timeout=120,
                check=False,
            )
            payload = json.loads(completed.stdout)
        except (OSError, subprocess.TimeoutExpired, json.JSONDecodeError) as error:
            validation.require(False, f"target-family {label} failed: {error}", group)
            continue
        expected_schema = (
            "dwp.hris.target-family-resolution-self-test.v1"
            if self_test
            else "dwp.hris.target-family-resolution.v1"
        )
        validation.require(
            completed.returncode == 0
            and payload.get("schema") == expected_schema
            and payload.get("status") == "PASS"
            and payload.get("blockers") == [],
            f"target-family {label} closure failed: {payload.get('blockers', [])}",
            group,
        )
        if not self_test:
            coverage = payload.get("coverage", {})
            validation.require(
                coverage.get("sourceParentRows") == 2269
                and coverage.get("resolvedSourceParentRows") == 2269
                and coverage.get("sourceChildRows") == 10001
                and coverage.get("resolvedSourceChildRows") == 10001
                and coverage.get("sourceChildRowsByModule")
                == {"HRM": 1654, "PAY": 3515, "PER": 1041, "SYS": 225, "TIM": 3566}
                and coverage.get("intentionalRetiredChildOverrides") == 3
                and coverage.get("sourceTargetFamilies") == 86
                and coverage.get("resolvedTargetFamilies") == 86
                and coverage.get("byModule")
                == {"HRM": 17, "PAY": 21, "PER": 16, "SYS": 13, "TIM": 19},
                "target-family exact parent/child/module totals drift",
                group,
            )
        results[label] = payload
    validation.details["targetFamilyResolution"] = {
        "status": results.get("closure", {}).get("status", "FAIL"),
        "sourceParents": results.get("closure", {}).get("coverage", {}).get("sourceParentRows", 0),
        "sourceChildren": results.get("closure", {}).get("coverage", {}).get("sourceChildRows", 0),
        "resolvedSourceChildren": results.get("closure", {}).get("coverage", {}).get("resolvedSourceChildRows", 0),
        "intentionalRetiredChildOverrides": results.get("closure", {}).get("coverage", {}).get("intentionalRetiredChildOverrides", 0),
        "childResolutionPath": results.get("closure", {}).get("coverage", {}).get("authoritativeChildResolutionPath"),
        "targetFamilies": results.get("closure", {}).get("coverage", {}).get("sourceTargetFamilies", 0),
        "selfTestStatus": results.get("self-test", {}).get("status", "FAIL"),
        "registerSha256": sha256(register) if register.is_file() else None,
        "sharedCatalogSha256": sha256(shared) if shared.is_file() else None,
        "validatorSha256": sha256(validator),
    }


def run_api_pep_bindings(validation: Validation) -> None:
    """Require public PEP and internal service-authorization closure."""
    group = "api-pep-bindings"
    validator = HERE / "validate_api_pep_bindings.py"
    register = HERE / "api-pep-binding-register.csv"
    service_register = HERE / "service-api-auth-binding-register.csv"
    home_security_register = HERE / "home-materialization-security-register.csv"
    validation.require(validator.is_file(), "API PEP validator missing", group)
    validation.require(register.is_file(), "API PEP binding register missing", group)
    validation.require(
        service_register.is_file(),
        "internal service API authorization register missing",
        group,
    )
    validation.require(
        home_security_register.is_file(),
        "home materialization delegated authorization register missing",
        group,
    )
    if not validator.is_file():
        return
    try:
        completed = subprocess.run(
            [sys.executable, str(validator), "--compact"],
            cwd=str(HERE),
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        validation.require(False, f"API PEP validator failed: {error}", group)
        return
    try:
        payload = json.loads(completed.stdout)
    except json.JSONDecodeError as error:
        validation.require(False, f"API PEP output is not JSON: {error}", group)
        payload = {}
    coverage = payload.get("coverage", {})
    validation.require(
        completed.returncode == 0
        and payload.get("schema") == "dwp.hris.api-pep-readiness.v1"
        and payload.get("status") == "PASS"
        and payload.get("blockers") == [],
        f"API PEP closure failed rc={completed.returncode}: {payload.get('blockers', [])}",
        group,
    )
    source_public_count = coverage.get("sourcePublicOperationCount")
    register_public_count = coverage.get("registerOperationCount")
    source_by_module = coverage.get("sourceByModule", {})
    register_by_module = coverage.get("registerByModule", {})
    validation.require(
        isinstance(source_public_count, int)
        and source_public_count == 175
        and source_public_count == register_public_count
        and source_by_module == register_by_module
        and source_by_module
        == {"HRM": 16, "PER": 21, "TIM": 28, "PAY": 33, "SYS": 77}
        and sum(source_by_module.values()) == source_public_count
        and all(isinstance(value, int) and value > 0 for value in source_by_module.values()),
        "API PEP operation coverage must be the exact 175-operation five-module closure",
        group,
    )
    validation.require(
        coverage.get("networkInternalSourceOperationCount") == 11
        and coverage.get("networkInternalRegisterCount") == 11
        and coverage.get("networkInternalCoveredCount") == 11
        and coverage.get("networkInternalSourceByModule")
        == {"HRM": 6, "PER": 2, "TIM": 2, "PAY": 1, "SYS": 0}
        and coverage.get("networkInternalRegisterByModule")
        == {"HRM": 6, "PER": 2, "TIM": 2, "PAY": 1, "SYS": 0}
        and coverage.get("inProcessBoundaryCount") == 1
        and coverage.get("commandReceiptPepBindingCount") == 6
        and coverage.get("commandReceiptPepByModule")
        == {"HRM": 1, "PAY": 1, "PER": 1, "SYS": 2, "TIM": 1}
        and len(coverage.get("networkInternalSourceOperations", [])) == 11
        and all(
            item.get("reason")
            == "SERVICE_ONLY_REQUIRES_SEPARATE_SERVICE_AUTH_REGISTRY"
            for item in coverage.get("networkInternalSourceOperations", [])
        ),
        "internal service API authorization coverage is not exactly network 11/11 plus one typed in-process boundary",
        group,
    )
    checks = payload.get("checks", {})
    validation.require(
        set(checks)
        == {
            "exactPublicOperationCoverage",
            "canonicalRoutes",
            "machineReadableSourceAuthorization",
            "personaAndAtomicDutyClosure",
            "canonicalTupleClosure",
            "rowInvariants",
            "internalServiceCoverage",
            "internalServiceAuthorizationClosure",
            "inProcessAuthorizationClosure",
            "homeMaterializationDelegatedAuthorizationClosure",
            "homeBrowserPersonaPepClosure",
            "commandReceiptPepClosure",
        }
        and all(value is True for value in checks.values()),
        "API PEP validator subcheck is not closed",
        group,
    )
    closure = payload.get("authorizationClosure", {})
    validation.require(
        closure.get("missingDutyCodes") == []
        and closure.get("missingPackageDutyPairs") == [],
        "API PEP global duty or package membership closure is incomplete",
        group,
    )
    validation.details["apiPepBindings"] = {
        "status": payload.get("status", "FAIL"),
        "publicOperations": coverage.get("sourcePublicOperationCount"),
        "serviceOnlyOperations": coverage.get("networkInternalSourceOperationCount"),
        "serviceOnlyCoveredOperations": coverage.get("networkInternalCoveredCount"),
        "inProcessBoundaries": coverage.get("inProcessBoundaryCount"),
        "commandReceiptPepBindings": coverage.get("commandReceiptPepBindingCount"),
        "commandReceiptPepByModule": coverage.get("commandReceiptPepByModule", {}),
        "registerSha256": sha256(register) if register.is_file() else None,
        "serviceRegisterSha256": (
            sha256(service_register) if service_register.is_file() else None
        ),
        "homeSecurityRegisterSha256": (
            sha256(home_security_register)
            if home_security_register.is_file()
            else None
        ),
        "validatorSha256": sha256(validator),
        "outputSha256": hashlib.sha256(
            (completed.stdout + completed.stderr).encode("utf-8")
        ).hexdigest(),
        "blockers": payload.get("blockers", []),
    }


def run_transport_schema_resolution(validation: Validation) -> None:
    """Require request/query/response/error schemas for every public operation."""
    group = "transport-schema-resolution"
    validator = HERE / "validate_transport_schema_resolution.py"
    register = HERE / "transport-schema-resolution-register.csv"
    contract_doc = HERE / "08-transport-schema-contract.md"
    schema_files = {
        module: ROOT / f"session-evidence/{module.lower()}/g2-transport-schemas.v1.json"
        for module in ("TIM", "PAY", "SYS")
    }
    required_paths = [validator, register, contract_doc, *schema_files.values()]
    for path in required_paths:
        validation.require(
            path.is_file() and path.stat().st_size > 0,
            f"transport schema artifact missing: {path.relative_to(ROOT)}",
            group,
        )
    if not validator.is_file():
        return
    results: dict[str, Any] = {}
    outputs: dict[str, str] = {}
    for is_self_test in (False, True):
        label = "self-test" if is_self_test else "closure"
        command = [sys.executable, str(validator)]
        if is_self_test:
            command.append("--self-test")
        command.append("--compact")
        try:
            completed = subprocess.run(
                command,
                cwd=str(HERE),
                capture_output=True,
                text=True,
                timeout=180,
                check=False,
            )
            outputs[label] = (completed.stdout + "\n" + completed.stderr).strip()
            payload = json.loads(completed.stdout)
        except (OSError, subprocess.TimeoutExpired, json.JSONDecodeError) as error:
            validation.require(False, f"transport schema {label} failed: {error}", group)
            continue
        expected_schema = (
            "dwp.hris.transport-schema-resolution-self-test.v1"
            if is_self_test
            else "dwp.hris.transport-schema-resolution.v1"
        )
        validation.require(
            completed.returncode == 0
            and payload.get("schema") == expected_schema
            and payload.get("status") == "PASS"
            and (
                isinstance(payload.get("cases"), list)
                if is_self_test
                else payload.get("errors") == []
            ),
            f"transport schema {label} closure failed: "
            f"{payload.get('errors', payload.get('cases', []))}",
            group,
        )
        if not is_self_test:
            coverage = payload.get("coverage", {})
            validation.require(
                coverage.get("sourcePublicOperationCount") == 175
                and coverage.get("resolvedOperationCount") == 175
                and coverage.get("byModule")
                == {"HRM": 16, "PER": 21, "TIM": 28, "PAY": 33, "SYS": 77},
                "transport schema coverage must exactly resolve all 175 public operations",
                group,
            )
            checks = payload.get("checks", {})
            validation.require(
                checks.get("allSchemaReferencesResolve") is True
                and checks.get("async202AuthorizedReceiptConvergence") is True
                and checks.get("exactOperationParity") is True
                and checks.get("fieldTypeRequiredClosure") is True
                and checks.get("pathPlaceholderExactSets") is True
                and checks.get("standaloneApiPepValidatorPass") is True
                and checks.get("namedBaselineExceptions")
                == {"SYS-API-032": "BASELINE_BODY_VERSION_CAS"}
                and checks.get("states")
                == {
                    "implementation": "NOT_STARTED_G3",
                    "production": "NOT_AUTHORIZED_G6",
                }
                and payload.get("namedBaselineExceptions")
                == {"SYS-API-032": "BASELINE_BODY_VERSION_CAS"},
                "transport schema subchecks or named baseline exception drifted",
                group,
            )
            validation.require(
                coverage.get("async202OperationCount") == 121
                and coverage.get("async202ResolvedToAuthorizedReceiptCount") == 121
                and coverage.get("receiptQueryOperationCount") == 6
                and coverage.get("receiptQueriesByModule")
                == {"HRM": 1, "PAY": 1, "PER": 1, "SYS": 2, "TIM": 1}
                and coverage.get("duplicateOperationCount") == 0
                and coverage.get("orphanOperationCount") == 0,
                "all 121 async 202 commands must converge to the six exact authorized owner receipt queries",
                group,
            )
        else:
            cases = payload.get("cases", [])
            expected_cases = {
                "unknown-ref",
                "field-required-drift",
                "field-type-drift",
                "operation-path-mismatch",
                "operation-authorization-mismatch",
                "path-placeholder-mismatch",
                "baseline-sha-mismatch",
                "baseline-body-version-type-drift",
                "baseline-exception-spread",
                "pending-state-rejected",
                "file-transfer-client-direction-rejected",
                "file-transfer-transfer-kind-drift",
                "file-transfer-egress-policy-condition-drift",
                "receipt-status-route-drift",
                "receipt-sealed-context-drift",
                "clock-event-enum-drift",
                "decimal-ssot-pattern-drift",
                "decimal-trace-required-drift",
                "home-digest-only-reference-drift",
                "home-widget-discriminator-cross-combination",
                "home-string-partial-failure-drift",
                "home-field-policy-context-drift",
                "home-manager-payroll-escalation",
                "home-freeform-data-drift",
                "explorer-workbench-enum-drift",
                "explorer-preference-cap-drift",
                "explorer-recent-ttl-drift",
                "explorer-activity-raw-payload-drift",
            }
            validation.require(
                len(cases) == len(expected_cases)
                and {case.get("name") for case in cases} == expected_cases
                and all(
                    case.get("status") == "PASS"
                    and isinstance(case.get("rejectedErrorCount"), int)
                    and case["rejectedErrorCount"] > 0
                    for case in cases
                ),
                "transport schema mutation suite must reject all 28 exact drift classes",
                group,
            )
        results[label] = payload
    closure = results.get("closure", {})
    validation.details["transportSchemaResolution"] = {
        "status": closure.get("status", "FAIL"),
        "coverage": closure.get("coverage", {}),
        "selfTestStatus": results.get("self-test", {}).get("status", "FAIL"),
        "validatorSha256": sha256(validator),
        "registerSha256": sha256(register) if register.is_file() else None,
        "artifactSha256": {
            str(path.relative_to(ROOT)): sha256(path)
            for path in required_paths
            if path.is_file()
        },
        "outputSha256": {
            label: hashlib.sha256(output.encode("utf-8")).hexdigest()
            for label, output in outputs.items()
        },
    }


def run_information_architecture(validation: Validation) -> None:
    """Require one exact, non-conflicting IA for base and modern scope."""
    group = "information-architecture"
    validator = HERE / "validate_information_architecture.py"
    generator = HERE / "generate_information_architecture_register.py"
    register = HERE / "hris-information-architecture-register.csv"
    transitions = HERE / "route-transition-register.csv"
    contract_doc = HERE / "09-information-architecture-contract.md"
    required_paths = [validator, generator, register, transitions, contract_doc]
    for path in required_paths:
        validation.require(
            path.is_file() and path.stat().st_size > 0,
            f"information architecture artifact missing: {path.relative_to(ROOT)}",
            group,
        )
    if not validator.is_file():
        return

    results: dict[str, Any] = {}
    outputs: dict[str, str] = {}
    for is_self_test in (False, True):
        label = "self-test" if is_self_test else "closure"
        command = [sys.executable, str(validator)]
        if is_self_test:
            command.append("--self-test")
        command.append("--compact")
        try:
            completed = subprocess.run(
                command,
                cwd=str(HERE),
                capture_output=True,
                text=True,
                timeout=120,
                check=False,
            )
            outputs[label] = (completed.stdout + "\n" + completed.stderr).strip()
            payload = json.loads(completed.stdout)
        except (OSError, subprocess.TimeoutExpired, json.JSONDecodeError) as error:
            validation.require(False, f"information architecture {label} failed: {error}", group)
            continue
        expected_schema = (
            "dwp.hris.information-architecture-self-test.v1"
            if is_self_test
            else "dwp.hris.information-architecture.v1"
        )
        validation.require(
            completed.returncode == 0
            and payload.get("schema") == expected_schema
            and payload.get("status") == "PASS"
            and payload.get("blockers") == [],
            f"information architecture {label} failed: {payload.get('blockers', [])}",
            group,
        )
        if is_self_test:
            validation.require(
                payload.get("tamperRejectedCount") == 10
                and payload.get("tamperCaseCount") == 10
                and all(
                    isinstance(count, int) and count > 0
                    for count in payload.get("rejectedErrorCountByCase", {}).values()
                ),
                "information architecture self-test did not reject all 10 tamper cases",
                group,
            )
        else:
            coverage = payload.get("coverage", {})
            validation.require(
                coverage.get("nodeCount") == 98
                and coverage.get("baseNodeCount") == 76
                and coverage.get("modernNodeCount") == 22
                and coverage.get("uniqueCanonicalPathCount") == 98
                and coverage.get("routeTransitionDecisionCount") == 2
                and all(payload.get("checks", {}).values()),
                "information architecture must close 76 base + 22 modern unique routes",
                group,
            )
        results[label] = payload

    closure = results.get("closure", {})
    validation.details["informationArchitecture"] = {
        "status": closure.get("status", "FAIL"),
        "coverage": closure.get("coverage", {}),
        "selfTestStatus": results.get("self-test", {}).get("status", "FAIL"),
        "artifactSha256": {
            str(path.relative_to(ROOT)): sha256(path)
            for path in required_paths
            if path.is_file()
        },
        "outputSha256": {
            label: hashlib.sha256(output.encode("utf-8")).hexdigest()
            for label, output in outputs.items()
        },
    }


def validate_source_and_g2(validation: Validation) -> dict[str, dict[str, int]]:
    group = "source-g1-g2"
    all_parent_rows: list[dict[str, str]] = []
    all_parent_ids: set[str] = set()
    all_child_ids: set[str] = set()
    module_counts: dict[str, dict[str, int]] = {}
    access_rows = read_csv(
        G0
        / "source-security-evidence"
        / "coverage-sanitized-access-register.csv",
        validation,
        group,
    )
    view_rows = read_csv(
        G0
        / "source-security-evidence"
        / "sanitized-view-register.csv",
        validation,
        group,
    )
    view_required = {
        "source_scope_id",
        "view_path",
        "filesystem_mode",
        "content_mode",
        "git_metadata_present",
        "build_execute_import_status",
    }
    if view_rows:
        validation.require(
            view_required <= set(view_rows[0]),
            "sanitized-view register columns incomplete",
            group,
        )
    view_roots: dict[str, Path] = {}
    for line, row in enumerate(view_rows, 2):
        scope_id = row.get("source_scope_id", "")
        root = Path(row.get("view_path", "")).resolve()
        validation.require(
            bool(scope_id) and scope_id not in view_roots,
            f"sanitized-view line {line}: blank/duplicate scope",
            group,
        )
        validation.require(
            root.is_dir(),
            f"sanitized-view line {line}: view missing {root}",
            group,
        )
        validation.require(
            row.get("filesystem_mode") == "FILES_0444_DIRECTORIES_0555",
            f"sanitized-view line {line}: view is not read-only",
            group,
        )
        validation.require(
            row.get("content_mode")
            == "ORIGINAL_TEXT_RENAMED_DOT_ANALYSIS_DOT_TXT",
            f"sanitized-view line {line}: unexpected content mode",
            group,
        )
        validation.require(
            row.get("git_metadata_present") == "NO"
            and row.get("build_execute_import_status") == "PROHIBITED",
            f"sanitized-view line {line}: executable/importable source view",
            group,
        )
        view_roots[scope_id] = root
    validation.require(
        set(view_roots)
        == {"SRC-FRONT", "SRC-HRM", "SRC-PER", "SRC-TIM", "SRC-PAY", "SRC-SYS"},
        "sanitized-view scope set drift",
        group,
    )
    access_required = {
        "session_id",
        "artifact_id",
        "sanitized_access_status",
        "sanitized_export_path",
        "raw_snapshot_access",
        "value_recorded",
        "mapping_fingerprint",
    }
    if access_rows:
        validation.require(
            access_required <= set(access_rows[0]),
            "sanitized-access register columns incomplete",
            group,
        )
    access_by_key: dict[tuple[str, str], dict[str, str]] = {}
    access_statuses: Counter[str] = Counter()
    for line, row in enumerate(access_rows, 2):
        key = (row.get("session_id", ""), row.get("artifact_id", ""))
        validation.require(
            key not in access_by_key,
            f"sanitized-access line {line}: duplicate {key}",
            group,
        )
        access_by_key[key] = row
        access_statuses[row.get("sanitized_access_status", "")] += 1
        sanitized_path_text = row.get("sanitized_export_path", "")
        sanitized_path = (
            Path(sanitized_path_text)
            if sanitized_path_text
            else None
        )
        expected = (
            sha256(sanitized_path)
            if sanitized_path is not None and sanitized_path.is_file()
            else row.get("mapping_fingerprint", "")
        )
        validation.require(
            bool(SHA256.fullmatch(expected)),
            f"sanitized-access line {line}: invalid expected fingerprint",
            group,
        )
        validation.require(
            row.get("raw_snapshot_access") == "FORBIDDEN_FOR_G1_SESSION",
            f"sanitized-access line {line}: raw source access not forbidden",
            group,
        )
        validation.require(
            row.get("value_recorded") == "NO",
            f"sanitized-access line {line}: source value persistence allowed",
            group,
        )
        validation.require(
            row.get("source_scope_id") in view_roots,
            f"sanitized-access line {line}: unknown safe view scope",
            group,
        )
        if row.get("sanitized_access_status") == "AVAILABLE_SANITIZED_TEXT":
            validation.require(
                sanitized_path is not None
                and sanitized_path.is_file()
                and any(
                    is_within(sanitized_path.resolve(), root)
                    for root in view_roots.values()
                ),
                f"sanitized-access line {line}: available export is not in a safe view",
                group,
            )
        else:
            validation.require(
                row.get("sanitized_access_status")
                in {"SECURITY_BLOCKED_UNKNOWN", "EXCLUDED_BENSK_RETIRE"}
                and not sanitized_path_text,
                f"sanitized-access line {line}: invalid unavailable-source boundary",
                group,
            )

    validation.require(
        access_statuses
        == Counter(
            {
                "AVAILABLE_SANITIZED_TEXT": 2258,
                "SECURITY_BLOCKED_UNKNOWN": 9,
                "EXCLUDED_BENSK_RETIRE": 2,
            }
        ),
        f"sanitized access status counts drift: {dict(access_statuses)}",
        group,
    )

    fingerprint_cache: dict[Path, str] = {}
    provenance_counts: Counter[str] = Counter()

    for session_id, spec in MODULES.items():
        slug = str(spec["slug"])
        coverage_path = ROOT / f"session-registers/hris-{slug}-source-coverage.csv"
        evidence_root = ROOT / f"session-evidence/{slug}"
        coverage = read_csv(coverage_path, validation, group, COVERAGE_HEADER)
        children = read_csv(evidence_root / "g1-child-trace.csv", validation, group, CHILD_HEADER)
        decisions = read_csv(evidence_root / "g1-decision-log.csv", validation, group, DECISION_HEADER)
        characterization = evidence_root / "g1-characterization.md"
        validation.require(
            characterization.is_file() and characterization.stat().st_size > 0,
            f"{session_id}: missing characterization",
            group,
        )

        validation.require(
            len(coverage) == spec["parents"],
            f"{session_id}: parents {len(coverage)} != {spec['parents']}",
            group,
        )
        validation.require(
            len(children) == spec["children"],
            f"{session_id}: children {len(children)} != {spec['children']}",
            group,
        )
        validation.require(
            len(decisions) == spec["decisions"],
            f"{session_id}: decisions {len(decisions)} != {spec['decisions']}",
            group,
        )

        local_parent_ids: set[str] = set()
        for line, row in enumerate(coverage, 2):
            artifact_id = row["artifact_id"].strip()
            validation.require(bool(artifact_id), f"{session_id} coverage:{line}: blank artifact_id", group)
            validation.require(
                artifact_id not in local_parent_ids,
                f"{session_id} coverage:{line}: duplicate {artifact_id}",
                group,
            )
            validation.require(
                artifact_id not in all_parent_ids,
                f"cross-module duplicate parent: {artifact_id}",
                group,
            )
            local_parent_ids.add(artifact_id)
            all_parent_ids.add(artifact_id)
            validation.require(
                row["session_id"] == session_id,
                f"{session_id} coverage:{line}: wrong session",
                group,
            )
            validation.require(
                row["source_module"] in spec["source_modules"],
                f"{session_id} coverage:{line}: wrong source module",
                group,
            )
            validation.require(
                row["disposition"] in ALLOWED_DISPOSITIONS,
                f"{session_id} coverage:{line}: invalid disposition",
                group,
            )
            validation.require(
                row["decision_status"] == "DECIDED",
                f"{session_id} coverage:{line}: not DECIDED",
                group,
            )
            for column in (
                "disposition",
                "target_capability_id",
                "target_bounded_context_candidate",
                "target_api_or_event",
                "target_data_owner",
                "process_change",
                "genericity",
                "acceptance_evidence",
                "decision_owner",
                "notes",
            ):
                validation.require(
                    bool(row[column].strip()),
                    f"{session_id} coverage:{line}: blank {column}",
                    group,
                )
            variant_text = " ".join(row.values()).upper()
            if "BENSK" in variant_text:
                validation.require(
                    row["disposition"] == "RETIRE",
                    f"{session_id} coverage:{line}: BENSK is not RETIRE",
                    group,
                )
            if "ADDSK" in variant_text:
                validation.require(
                    row["disposition"] in {"EXTENSION", "RETIRE"},
                    f"{session_id} coverage:{line}: ADDSK entered generic core",
                    group,
                )
            access_row = access_by_key.get((session_id, artifact_id))
            if access_row is not None and access_row.get("sanitized_access_status") in {
                "SECURITY_BLOCKED_UNKNOWN",
                "EXCLUDED_BENSK_RETIRE",
            }:
                validation.require(
                    any(
                        marker in row["notes"].upper()
                        for marker in (
                            "SAFE_SUBSTITUTE",
                            "SAFE DWP PLATFORM CONTRACT",
                            "NO_CODE_REUSE",
                            "NO SOURCE CODE REUSE",
                            "SOURCE CONTENT NOT ACCESSED",
                        )
                    ),
                    f"{session_id} coverage:{line}: unavailable source lacks safe-substitute boundary",
                    group,
                )

        decision_ids: set[str] = set()
        for line, row in enumerate(decisions, 2):
            decision_id = row["decision_id"].strip()
            validation.require(bool(decision_id), f"{session_id} decision:{line}: blank id", group)
            validation.require(
                decision_id not in decision_ids,
                f"{session_id} decision:{line}: duplicate {decision_id}",
                group,
            )
            decision_ids.add(decision_id)
            validation.require(
                row["session_id"] == session_id,
                f"{session_id} decision:{line}: wrong session",
                group,
            )
            validation.require(
                row["status"] == "DECIDED",
                f"{session_id} decision:{line}: not DECIDED",
                group,
            )
            for column in (
                "scope",
                "decision_type",
                "question",
                "owner_role",
                "blocking_gate",
                "blocking_scope",
                "evidence_refs",
                "resolution",
                "decided_at",
            ):
                validation.require(
                    bool(row[column].strip()),
                    f"{session_id} decision:{line}: blank {column}",
                    group,
                )

        child_parents: set[str] = set()
        for line, row in enumerate(children, 2):
            child_id = row["child_id"].strip()
            validation.require(bool(child_id), f"{session_id} child:{line}: blank child_id", group)
            validation.require(child_id not in all_child_ids, f"duplicate child id: {child_id}", group)
            all_child_ids.add(child_id)
            parent_id = row["parent_artifact_id"]
            validation.require(
                parent_id in local_parent_ids,
                f"{session_id} child:{line}: orphan parent {parent_id}",
                group,
            )
            child_parents.add(parent_id)
            validation.require(
                row["session_id"] == session_id,
                f"{session_id} child:{line}: wrong session",
                group,
            )
            validation.require(
                row["decision_status"] == "DECIDED",
                f"{session_id} child:{line}: not DECIDED",
                group,
            )
            validation.require(
                row["disposition"] in ALLOWED_DISPOSITIONS,
                f"{session_id} child:{line}: invalid disposition",
                group,
            )
            validation.require(
                row["decision_id"] in decision_ids,
                f"{session_id} child:{line}: missing decision {row['decision_id']}",
                group,
            )
            validation.require(
                bool(SHA256.fullmatch(row["source_fingerprint"])),
                f"{session_id} child:{line}: invalid fingerprint",
                group,
            )
            access_key = (session_id, parent_id)
            validation.require(
                access_key in access_by_key,
                f"{session_id} child:{line}: no sanitized provenance",
                group,
            )
            validation.require(
                not Path(row["source_file"]).is_absolute()
                and ".." not in Path(row["source_file"]).parts
                and ".codex-worktrees/hris/source/" not in row["source_file"],
                f"{session_id} child:{line}: raw/absolute source pointer",
                group,
            )
            access_row = access_by_key.get(access_key)
            if access_row is not None:
                candidates = sanitized_child_candidates(
                    row["source_file"],
                    access_row,
                    view_roots,
                )
                candidate_hashes: set[str] = set()
                for candidate in candidates:
                    if candidate not in fingerprint_cache:
                        fingerprint_cache[candidate] = sha256(candidate)
                    candidate_hashes.add(fingerprint_cache[candidate])
                if candidates:
                    validation.require(
                        row["source_fingerprint"] in candidate_hashes,
                        f"{session_id} child:{line}: fingerprint drift from sanitized child source",
                        group,
                    )
                    if row["source_fingerprint"] in candidate_hashes:
                        provenance_counts["SANITIZED_FILE_SHA256"] += 1
                else:
                    validation.require(
                        access_row.get("sanitized_access_status")
                        in {"SECURITY_BLOCKED_UNKNOWN", "EXCLUDED_BENSK_RETIRE"},
                        f"{session_id} child:{line}: source pointer does not resolve in sanitized view",
                        group,
                    )
                    validation.require(
                        row["source_fingerprint"]
                        == access_row.get("mapping_fingerprint"),
                        f"{session_id} child:{line}: unavailable-source mapping fingerprint drift",
                        group,
                    )
                    if (
                        row["source_fingerprint"]
                        == access_row.get("mapping_fingerprint")
                    ):
                        provenance_counts["SAFE_MAPPING_SHA256"] += 1
        validation.require(
            child_parents == local_parent_ids,
            f"{session_id}: parents without child trace={len(local_parent_ids - child_parents)}",
            group,
        )

        for reference in spec["g2_files"]:
            path = resolve(str(reference))
            validation.require(
                path.is_file() and path.stat().st_size > 0,
                f"{session_id}: missing/empty G2 artifact {path}",
                group,
            )

        all_parent_rows.extend(coverage)
        module_counts[session_id] = {
            "parents": len(coverage),
            "children": len(children),
            "decisions": len(decisions),
        }

    validation.require(
        len(all_parent_ids) == 2269,
        f"unique source parent total {len(all_parent_ids)} != 2269",
        group,
    )
    validation.require(
        len(access_by_key) == 2269,
        f"sanitized-access total {len(access_by_key)} != 2269",
        group,
    )
    validation.require(
        set(access_by_key)
        == {
            (row["session_id"], row["artifact_id"])
            for row in all_parent_rows
        },
        "sanitized-access and decided source parent sets differ",
        group,
    )
    validation.require(
        len(all_child_ids) == 10001,
        f"unique child trace total {len(all_child_ids)} != 10001",
        group,
    )
    validation.require(
        provenance_counts
        == Counter(
            {
                "SANITIZED_FILE_SHA256": 9982,
                "SAFE_MAPPING_SHA256": 19,
            }
        ),
        f"child provenance mode counts drift: {dict(provenance_counts)}",
        group,
    )
    validation.require(
        sum(count["decisions"] for count in module_counts.values()) == 78,
        "decision total != 78",
        group,
    )

    master = read_csv(
        ROOT / "five-session-source-coverage-register.csv",
        validation,
        group,
        COVERAGE_HEADER,
    )
    validation.require(len(master) == 2269, f"master coverage rows {len(master)} != 2269", group)
    master_by_id = {row.get("artifact_id", ""): row for row in master}
    shard_by_id = {row["artifact_id"]: row for row in all_parent_rows}
    validation.require(len(master_by_id) == len(master), "master coverage has duplicate artifact_id", group)
    validation.require(set(master_by_id) == set(shard_by_id), "master/shard artifact sets differ", group)
    for artifact_id in sorted(set(master_by_id) & set(shard_by_id)):
        validation.require(
            master_by_id[artifact_id] == shard_by_id[artifact_id],
            f"master/shard row drift: {artifact_id}",
            group,
        )

    validation.details["moduleCounts"] = module_counts
    validation.details["totals"] = {
        "parents": len(all_parent_ids),
        "children": len(all_child_ids),
        "decisions": 78,
    }
    validation.details["childProvenance"] = dict(provenance_counts)
    return module_counts


def validate_architecture_registers(validation: Validation, roles: set[str]) -> set[str]:
    group = "architecture-registers"
    adr_rows = read_csv(
        HERE / "architecture-decision-register.csv",
        validation,
        group,
        ADR_HEADER,
    )
    validation.require(len(adr_rows) == 33, f"ADR count {len(adr_rows)} != 33", group)
    validation.require(
        len({row["decision_id"] for row in adr_rows}) == len(adr_rows),
        "duplicate ADR",
        group,
    )
    for line, row in enumerate(adr_rows, 2):
        validation.require(row["status"] == "DECIDED", f"ADR line {line}: not DECIDED", group)
        validation.require(
            row["owner"] in roles,
            f"ADR line {line}: unknown owner {row['owner']}",
            group,
        )
        for evidence in split_pipe(row["evidence"]):
            validation.require(
                resolve(evidence).exists(),
                f"ADR line {line}: missing evidence {evidence}",
                group,
            )
        validation.require(
            all(row[column].strip() for column in ADR_HEADER),
            f"ADR line {line}: blank required field",
            group,
        )

    nfr_rows = read_csv(
        HERE / "nonfunctional-requirements-register.csv",
        validation,
        group,
        NFR_HEADER,
    )
    validation.require(len(nfr_rows) == 30, f"NFR count {len(nfr_rows)} != 30", group)
    validation.require(
        len({row["nfr_id"] for row in nfr_rows}) == len(nfr_rows),
        "duplicate NFR",
        group,
    )
    for line, row in enumerate(nfr_rows, 2):
        validation.require(row["status"] == "DECIDED", f"NFR line {line}: not DECIDED", group)
        validation.require(
            row["owner"] in roles,
            f"NFR line {line}: unknown owner {row['owner']}",
            group,
        )
        validation.require(
            bool(row["code_gate_evidence"].strip()),
            f"NFR line {line}: no code evidence",
            group,
        )
        validation.require(
            bool(row["activation_evidence"].strip()),
            f"NFR line {line}: no activation evidence",
            group,
        )

    dependency_rows = read_csv(
        HERE / "module-dependency-register.csv",
        validation,
        group,
        DEPENDENCY_HEADER,
    )
    dependency_ids = {row["dependency_id"] for row in dependency_rows}
    validation.require(
        len(dependency_rows) == 19
        and len(dependency_ids) == 19
        and dependency_ids == {f"DEP-{number:03d}" for number in range(1, 20)},
        "dependency register must contain exactly one row for each DEP-001..DEP-019",
        group,
    )
    for line, row in enumerate(dependency_rows, 2):
        validation.require(
            row["status"] in {"READY", "READY_CORE_ACTIVATION_PENDING"},
            f"dependency line {line}: invalid status",
            group,
        )
        validation.require(
            resolve(row["evidence"]).exists(),
            f"dependency line {line}: missing evidence {row['evidence']}",
            group,
        )
        validation.require(
            bool(row["fallback_or_guard"].strip()),
            f"dependency line {line}: no failure guard",
            group,
        )
        if row["status"] == "READY_CORE_ACTIVATION_PENDING":
            validation.require(
                "G3_CORE" in row["required_for_consumer_stage"],
                f"dependency line {line}: activation-pending contract is not core-scoped",
                group,
            )
            validation.require(
                "disabled" in row["fallback_or_guard"].lower(),
                f"dependency line {line}: production fail-closed guard missing",
                group,
            )

    ownership_rows = read_csv(
        HERE / "cross-cutting-ownership-register.csv",
        validation,
        group,
        OWNERSHIP_HEADER,
    )
    validation.require(
        len(ownership_rows) == 23
        and len({row["concern_id"] for row in ownership_rows}) == 23
        and {row["concern_id"] for row in ownership_rows}
        == {f"OWN-{number:03d}" for number in range(1, 24)},
        "ownership register must contain exactly one row for each OWN-001..OWN-023",
        group,
    )
    assigned_dependencies: list[str] = []
    for line, row in enumerate(ownership_rows, 2):
        validation.require(
            row["primary_owner_role"] in roles,
            f"ownership line {line}: unknown primary owner",
            group,
        )
        for role in split_pipe(row["contributor_roles"]):
            validation.require(
                role in roles,
                f"ownership line {line}: unknown contributor {role}",
                group,
            )
        consumers = set(split_pipe(row["consumer_sessions"]))
        validation.require(
            bool(consumers) and consumers <= set(MODULES),
            f"ownership line {line}: invalid consumers {sorted(consumers)}",
            group,
        )
        validation.require(
            resolve(row["authoritative_artifact"]).exists(),
            f"ownership line {line}: missing artifact {row['authoritative_artifact']}",
            group,
        )
        validation.require(
            row["status"] == "OWNERSHIP_DECIDED",
            f"ownership line {line}: not decided",
            group,
        )
        validation.require(
            bool(row["g3_required_delivery"].strip())
            and bool(row["g3_forbidden_pattern"].strip()),
            f"ownership line {line}: incomplete G3 boundary",
            group,
        )
        if row["dependency_ids"] != "NONE":
            for dependency_id in split_pipe(row["dependency_ids"]):
                validation.require(
                    dependency_id in dependency_ids,
                    f"ownership line {line}: unknown dependency {dependency_id}",
                    group,
                )
                assigned_dependencies.append(dependency_id)
    assigned_count = Counter(assigned_dependencies)
    validation.require(set(assigned_count) == dependency_ids, "some dependencies have no owner", group)
    validation.require(
        all(count == 1 for count in assigned_count.values()),
        "a dependency has multiple ownership assignments",
        group,
    )
    validation.details["architectureRegisters"] = {
        "architectureDecisions": len(adr_rows),
        "nonfunctionalRequirements": len(nfr_rows),
        "moduleDependencies": len(dependency_rows),
        "crossCuttingOwners": len(ownership_rows),
        "ownedDependencyCount": len(assigned_count),
        "ownershipRule": "EXACTLY_ONE_PRIMARY_CROSS_CUTTING_OWNER_PER_DEPENDENCY",
    }
    return dependency_ids


def validate_cross_module_contracts(
    validation: Validation,
    dependency_ids: set[str],
) -> None:
    """Prove that every READY inter-module contract has both ends.

    A shared prose label is insufficient: producer output and every consumer
    input must use the same versioned name.  Aliases are rejected unless a
    future adapter registry explicitly binds a tested transform digest.
    """
    group = "cross-module-contracts"
    rows = read_csv(
        HERE / "cross-module-contract-register.csv",
        validation,
        group,
        CONTRACT_HEADER,
    )
    by_id = {row["contract_id"]: row for row in rows}
    validation.require(
        set(by_id) == EXPECTED_CROSS_CONTRACTS and len(by_id) == len(rows),
        "cross-module contract set is incomplete or duplicated",
        group,
    )
    for line, row in enumerate(rows, 2):
        consumers = split_pipe(row["consumer_sessions"])
        producer_path = resolve(row["producer_evidence"])
        consumer_paths = [resolve(value) for value in split_pipe(row["consumer_evidence"])]
        validation.require(
            row["dependency_id"] in dependency_ids,
            f"contract line {line}: unknown dependency",
            group,
        )
        validation.require(
            row["producer_session"] in MODULES
            and bool(consumers)
            and set(consumers) <= set(MODULES),
            f"contract line {line}: invalid producer/consumer",
            group,
        )
        validation.require(
            row["contract_kind"] in {"SNAPSHOT", "EVENT"}
            and bool(re.fullmatch(r"[A-Za-z][A-Za-z0-9]+\.v\d+", row["canonical_name"])),
            f"contract line {line}: invalid versioned canonical name",
            group,
        )
        validation.require(
            row["status"] == "READY_FOR_G3",
            f"contract line {line}: not ready for G3",
            group,
        )
        validation.require(
            producer_path.is_file(),
            f"contract line {line}: missing producer evidence",
            group,
        )
        validation.require(
            len(consumer_paths) == len(consumers)
            and all(path.is_file() for path in consumer_paths),
            f"contract line {line}: consumer evidence cardinality/path mismatch",
            group,
        )
        validation.require(
            all(
                row[column].strip()
                for column in (
                    "compatibility_rule",
                    "failure_guard",
                )
            ),
            f"contract line {line}: compatibility/failure rule missing",
            group,
        )
        # Exact name and field coverage is parsed structurally below.  Raw text
        # substring matching is intentionally not used because JSON contracts
        # represent several names as `{type, version}` rather than `Type.v1`.

    json_paths = {
        "HRIS-HRM": ROOT / "session-evidence/hrm/g2-readiness/api-event-contracts.v1.json",
        "HRIS-TIM": ROOT / "session-evidence/tim/g2-api-event-contracts.json",
        "HRIS-PAY": ROOT / "session-evidence/pay/g2-api-event-contracts.json",
    }
    payloads: dict[str, dict[str, Any]] = {}
    for session_id, path in json_paths.items():
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            validation.require(False, f"{session_id}: invalid contract JSON: {error}", group)
            payload = {}
        validation.require(isinstance(payload, dict), f"{session_id}: contract JSON is not an object", group)
        payloads[session_id] = payload if isinstance(payload, dict) else {}

    hrm_provided_events = versioned_contract_names(payloads["HRIS-HRM"], "events")
    hrm_provided_event_fields = versioned_contract_fields(
        payloads["HRIS-HRM"],
        "events",
    )
    hrm_provided_snapshots = versioned_contract_names(
        payloads["HRIS-HRM"],
        "providedSnapshots",
    )
    hrm_provided_snapshot_fields = versioned_contract_fields(
        payloads["HRIS-HRM"],
        "providedSnapshots",
    )
    tim_consumed_events = versioned_contract_names(payloads["HRIS-TIM"], "consumedEvents")
    tim_consumed_event_fields = versioned_contract_fields(
        payloads["HRIS-TIM"],
        "consumedEvents",
    )
    tim_provided_events = versioned_contract_names(payloads["HRIS-TIM"], "providedEvents")
    tim_provided_event_fields = versioned_contract_fields(
        payloads["HRIS-TIM"],
        "providedEvents",
    )
    tim_consumed_snapshots = versioned_contract_names(
        payloads["HRIS-TIM"],
        "consumedSnapshots",
    )
    tim_consumed_snapshot_fields = versioned_contract_fields(
        payloads["HRIS-TIM"],
        "consumedSnapshots",
    )
    tim_provided_snapshots = versioned_contract_names(
        payloads["HRIS-TIM"],
        "providedSnapshots",
    )
    tim_provided_snapshot_fields = versioned_contract_fields(
        payloads["HRIS-TIM"],
        "providedSnapshots",
    )
    tim_provided_snapshot_nested_fields = versioned_contract_nested_fields(
        payloads["HRIS-TIM"],
        "providedSnapshots",
    )
    pay_consumed_events = versioned_contract_names(payloads["HRIS-PAY"], "consumedEvents")
    pay_consumed_event_fields = versioned_contract_fields(
        payloads["HRIS-PAY"],
        "consumedEvents",
    )
    pay_consumed_snapshots = versioned_contract_names(
        payloads["HRIS-PAY"],
        "consumedSnapshots",
    )
    pay_consumed_snapshot_fields = versioned_contract_fields(
        payloads["HRIS-PAY"],
        "consumedSnapshots",
    )
    pay_consumed_snapshot_nested_fields = versioned_contract_nested_fields(
        payloads["HRIS-PAY"],
        "consumedSnapshots",
    )
    pay_provided_events = versioned_contract_names(payloads["HRIS-PAY"], "providedEvents")
    pay_provided_event_fields = versioned_contract_fields(
        payloads["HRIS-PAY"],
        "providedEvents",
    )

    per_path = ROOT / "session-evidence/per/g2-readiness/api-event-contracts.yaml"
    try:
        per_text = per_path.read_text(encoding="utf-8")
    except OSError as error:
        validation.require(False, f"HRIS-PER: missing contract YAML: {error}", group)
        per_text = ""
    per_consumed_events = yaml_named_block(per_text, "x-dwp-consumed-events")
    per_consumed_snapshots = yaml_named_block(per_text, "x-dwp-consumed-snapshots")
    per_provided_events = yaml_named_block(per_text, "x-dwp-domain-events")
    per_provided_snapshots = yaml_named_block(per_text, "x-dwp-provided-snapshots")
    per_consumed_event_fields = yaml_contract_fields(
        per_text,
        "x-dwp-consumed-events",
    )
    per_consumed_snapshot_fields = yaml_contract_fields(
        per_text,
        "x-dwp-consumed-snapshots",
    )
    per_provided_event_fields = yaml_contract_fields(
        per_text,
        "x-dwp-domain-events",
    )
    per_provided_snapshot_fields = yaml_contract_fields(
        per_text,
        "x-dwp-provided-snapshots",
    )
    per_provided_snapshot_nested_fields = yaml_contract_nested_fields(
        per_text,
        "x-dwp-provided-snapshots",
    )

    # The G2 CompensationPlanApproved.v1 rows above are retained as historical
    # characterization only.  G3 runtime authority is the reviewed post-snapshot
    # commit v2 event at both PER and PAY ends.
    compensation_predecessor = "CompensationPlanApproved.v1"
    compensation_event_v2 = "ApprovedCompensationPlanSnapshotPublished.v2"
    compensation_event_fields_v2 = EXPECTED_CONTRACT_FIELDS[compensation_event_v2]
    try:
        per_g3 = json.loads(
            (ROOT / "session-evidence/per/g3-modern-capability-contracts.v2.json")
            .read_text(encoding="utf-8")
        )
        pay_g3 = json.loads(
            (ROOT / "session-evidence/pay/g3-modern-capability-consumer-contracts.v1.json")
            .read_text(encoding="utf-8")
        )
        per_comp = next(
            item for item in per_g3.get("capabilities", [])
            if item.get("capabilityId") == "HRIS.MODERN.COMPENSATION_PLANNING"
        )
        per_v2_event = next(
            item for item in per_comp.get("events", [])
            if item.get("name") == compensation_event_v2
        )
        pay_comp = pay_g3.get("consumedModernCapabilities", [])[0]
        pay_v2_event = pay_comp.get("invalidationEvent", {})
    except (OSError, json.JSONDecodeError, IndexError, StopIteration, TypeError) as error:
        validation.require(False, f"PER/PAY compensation v2 evidence is invalid: {error}", group)
        per_v2_event = {}
        pay_v2_event = {}
    per_provided_events.discard(compensation_predecessor)
    per_provided_event_fields.pop(compensation_predecessor, None)
    pay_consumed_events.discard(compensation_predecessor)
    pay_consumed_event_fields.pop(compensation_predecessor, None)
    if per_v2_event:
        per_provided_events.add(compensation_event_v2)
        per_provided_event_fields[compensation_event_v2] = set(
            per_v2_event.get("payloadRequired", [])
        )
    if pay_v2_event:
        pay_consumed_events.add(compensation_event_v2)
        pay_consumed_event_fields[compensation_event_v2] = set(
            pay_v2_event.get("payloadRequired", [])
        )
    validation.require(
        per_provided_event_fields.get(compensation_event_v2)
        == pay_consumed_event_fields.get(compensation_event_v2)
        == compensation_event_fields_v2
        and compensation_predecessor not in per_provided_events
        and compensation_predecessor not in pay_consumed_events,
        "PER/PAY compensation runtime must use the exact 16-field v2 event only",
        group,
    )

    hrm_events = {
        "WorkerChanged.v1",
        "EmploymentChanged.v1",
        "AssignmentChanged.v1",
        "OrganizationChanged.v1",
    }
    validation.require(
        hrm_events <= hrm_provided_events,
        f"HRM missing canonical provided events: {sorted(hrm_events - hrm_provided_events)}",
        group,
    )
    for session_id, consumed in (
        ("HRIS-PER", per_consumed_events),
        ("HRIS-TIM", tim_consumed_events),
        ("HRIS-PAY", pay_consumed_events),
    ):
        validation.require(
            hrm_events <= consumed,
            f"{session_id} missing canonical HRM events: {sorted(hrm_events - consumed)}",
            group,
        )
    validation.require(
        {"WorkerAssignmentSnapshot.v1", "CompensationBasisSnapshot.v1"}
        <= hrm_provided_snapshots,
        "HRM canonical snapshot output is incomplete",
        group,
    )
    validation.require(
        "WorkerAssignmentSnapshot.v1" in per_consumed_snapshots
        and "WorkerAssignmentSnapshot.v1" in tim_consumed_snapshots
        and {
            "WorkerAssignmentSnapshot.v1",
            "CompensationBasisSnapshot.v1",
        }
        <= pay_consumed_snapshots,
        "HRM snapshot consumer contract is incomplete",
        group,
    )
    validation.require(
        {
            "WorkplaceAssignmentSnapshot.v1",
            "WorkerDependentEligibilitySnapshot.v1",
            "WorkerTaxIdentitySnapshot.v1",
            "WorkerBankAccountTokenSnapshot.v1",
        }
        <= hrm_provided_snapshots,
        "HRM workplace/dependent/tax/bank-token snapshot output is incomplete",
        group,
    )
    validation.require(
        "WorkplaceAssignmentSnapshot.v1" in tim_consumed_snapshots,
        "TIM lacks the HRM workplace assignment snapshot",
        group,
    )
    validation.require(
        {
            "WorkerDependentEligibilitySnapshot.v1",
            "WorkerTaxIdentitySnapshot.v1",
            "WorkerBankAccountTokenSnapshot.v1",
        }
        <= pay_consumed_snapshots,
        "PAY lacks minimized dependent/tax/bank-token snapshots",
        group,
    )
    validation.require(
        "CompensationBasisChanged.v1" in hrm_provided_events
        and "CompensationBasisChanged.v1" in pay_consumed_events,
        "HRM/PAY compensation event contract diverges",
        group,
    )
    validation.require(
        "ClosedTimeResult.v1" in tim_provided_snapshots
        and "ClosedTimeResult.v1" in pay_consumed_snapshots,
        "TIM/PAY ClosedTimeResult snapshot contract is incomplete",
        group,
    )
    time_events = {
        "TimePeriodClosed.v1",
        "TimePeriodReopened.v1",
        "PayrollTimeHandoffReady.v1",
    }
    validation.require(
        time_events <= tim_provided_events
        and time_events <= pay_consumed_events,
        "TIM/PAY close and handoff event sets diverge",
        group,
    )
    validation.require(
        "ApprovedCompensationPlanSnapshot.v1" in per_provided_snapshots
        and "ApprovedCompensationPlanSnapshot.v1" in pay_consumed_snapshots,
        "PER/PAY approved compensation-plan snapshot contract is incomplete",
        group,
    )
    validation.require(
        compensation_event_v2 in per_provided_events
        and compensation_event_v2 in pay_consumed_events
        and compensation_predecessor not in per_provided_events
        and compensation_predecessor not in pay_consumed_events,
        "PER/PAY compensation snapshot-published v2 event contract is incomplete",
        group,
    )
    home_event = "HrisHomeContributionChanged.v1"
    for session_id, provided in (
        ("HRIS-HRM", hrm_provided_events),
        ("HRIS-PER", per_provided_events),
        ("HRIS-TIM", tim_provided_events),
        ("HRIS-PAY", pay_provided_events),
    ):
        validation.require(
            home_event in provided,
            f"{session_id}: missing canonical Home contribution event",
            group,
        )
    provided_fields = {
        ("HRIS-HRM", "EVENT"): hrm_provided_event_fields,
        ("HRIS-HRM", "SNAPSHOT"): hrm_provided_snapshot_fields,
        ("HRIS-PER", "EVENT"): per_provided_event_fields,
        ("HRIS-PER", "SNAPSHOT"): per_provided_snapshot_fields,
        ("HRIS-TIM", "EVENT"): tim_provided_event_fields,
        ("HRIS-TIM", "SNAPSHOT"): tim_provided_snapshot_fields,
        ("HRIS-PAY", "EVENT"): pay_provided_event_fields,
    }
    consumed_fields = {
        ("HRIS-PER", "EVENT"): per_consumed_event_fields,
        ("HRIS-PER", "SNAPSHOT"): per_consumed_snapshot_fields,
        ("HRIS-TIM", "EVENT"): tim_consumed_event_fields,
        ("HRIS-TIM", "SNAPSHOT"): tim_consumed_snapshot_fields,
        ("HRIS-PAY", "EVENT"): pay_consumed_event_fields,
        ("HRIS-PAY", "SNAPSHOT"): pay_consumed_snapshot_fields,
    }
    provided_nested_fields = {
        ("HRIS-PER", "SNAPSHOT"): per_provided_snapshot_nested_fields,
        ("HRIS-TIM", "SNAPSHOT"): tim_provided_snapshot_nested_fields,
    }
    consumed_nested_fields = {
        ("HRIS-PAY", "SNAPSHOT"): pay_consumed_snapshot_nested_fields,
    }
    validation.require(
        {row["canonical_name"] for row in rows}
        == set(EXPECTED_CONTRACT_FIELDS),
        "cross-module schema pin set differs from contract registry",
        group,
    )
    for row in rows:
        name = row["canonical_name"]
        kind = row["contract_kind"]
        expected_fields = EXPECTED_CONTRACT_FIELDS.get(name, set())
        declared_fields = set(split_pipe(row["required_fields"]))
        declared_digest = hashlib.sha256(
            "|".join(sorted(declared_fields)).encode("utf-8")
        ).hexdigest()
        validation.require(
            declared_fields == expected_fields,
            f"{row['contract_id']}: central required-field pin drift for {name}",
            group,
        )
        validation.require(
            row["required_fields_sha256"] == declared_digest,
            f"{row['contract_id']}: central required-field digest drift for {name}",
            group,
        )
        expected_nested_fields = EXPECTED_CONTRACT_NESTED_FIELDS.get(name, set())
        declared_nested_fields = set(split_pipe(row["nested_required_fields"]))
        declared_nested_digest = (
            hashlib.sha256(
                "|".join(sorted(declared_nested_fields)).encode("utf-8")
            ).hexdigest()
            if declared_nested_fields
            else "NONE"
        )
        validation.require(
            declared_nested_fields == expected_nested_fields,
            f"{row['contract_id']}: central nested required-field pin drift for {name}",
            group,
        )
        validation.require(
            row["nested_required_fields_sha256"] == declared_nested_digest,
            f"{row['contract_id']}: central nested field digest drift for {name}",
            group,
        )
        expected_nested = EXPECTED_CONTRACT_NESTED_FIELDS.get(name, set())
        declared_nested = set(split_pipe(row["nested_required_fields"]))
        declared_nested_digest = (
            hashlib.sha256(
                "|".join(sorted(declared_nested)).encode("utf-8")
            ).hexdigest()
            if declared_nested
            else "NONE"
        )
        validation.require(
            declared_nested == expected_nested
            and row["nested_required_fields_sha256"] == declared_nested_digest,
            f"{row['contract_id']}: central nested-field pin/digest drift for {name}",
            group,
        )
        actual_producer_fields = provided_fields.get(
            (row["producer_session"], kind),
            {},
        ).get(name, set())
        validation.require(
            actual_producer_fields == expected_fields,
            f"{row['contract_id']}: producer field set drift for {name}; "
            f"missing={sorted(expected_fields - actual_producer_fields)} "
            f"extra={sorted(actual_producer_fields - expected_fields)}",
            group,
        )
        actual_producer_nested = provided_nested_fields.get(
            (row["producer_session"], kind),
            {},
        ).get(name, set())
        validation.require(
            actual_producer_nested == expected_nested_fields,
            f"{row['contract_id']}: producer nested field drift for {name}; "
            f"missing={sorted(expected_nested_fields - actual_producer_nested)} "
            f"extra={sorted(actual_producer_nested - expected_nested_fields)}",
            group,
        )
        for consumer in split_pipe(row["consumer_sessions"]):
            if consumer == "HRIS-SYS" and name == home_event:
                continue
            actual_consumer_fields = consumed_fields.get(
                (consumer, kind),
                {},
            ).get(name, set())
            validation.require(
                actual_consumer_fields == expected_fields,
                f"{row['contract_id']}: {consumer} field set drift for {name}; "
                f"missing={sorted(expected_fields - actual_consumer_fields)} "
                f"extra={sorted(actual_consumer_fields - expected_fields)}",
                group,
            )
            actual_consumer_nested = consumed_nested_fields.get(
                (consumer, kind),
                {},
            ).get(name, set())
            validation.require(
                actual_consumer_nested == expected_nested_fields,
                f"{row['contract_id']}: {consumer} nested field drift for {name}; "
                f"missing={sorted(expected_nested_fields - actual_consumer_nested)} "
                f"extra={sorted(actual_consumer_nested - expected_nested_fields)}",
                group,
            )
        actual_producer_nested = provided_nested_fields.get(
            (row["producer_session"], kind),
            {},
        ).get(name, set())
        validation.require(
            actual_producer_nested == expected_nested,
            f"{row['contract_id']}: producer nested field set drift for {name}",
            group,
        )
        for consumer in split_pipe(row["consumer_sessions"]):
            if not expected_nested:
                continue
            actual_consumer_nested = consumed_nested_fields.get(
                (consumer, kind),
                {},
            ).get(name, set())
            validation.require(
                actual_consumer_nested == expected_nested,
                f"{row['contract_id']}: {consumer} nested field set drift for {name}",
                group,
            )
    sys_contracts = read_csv(
        ROOT / "session-evidence/sys/g2-contract-catalog.csv",
        validation,
        group,
    )
    sys_home = [row for row in sys_contracts if row.get("contract_id") == "SYS-EVT-007"]
    validation.require(len(sys_home) == 1, "SYS Home consumer contract missing/duplicated", group)
    if len(sys_home) == 1:
        binding_text = " ".join(sys_home[0].values())
        validation.require(
            home_event in binding_text
            and "dwp.hris.home.contribution.changed.v1" in binding_text
            and sys_home[0].get("consumers") == "SYS_HOME_PROJECTION",
            "SYS Home consumer lacks canonical event type/topic binding",
            group,
        )
        validation.require(
            all(field in binding_text for field in EXPECTED_CONTRACT_FIELDS[home_event]),
            "SYS Home consumer required-field set is incomplete",
            group,
        )

    forbidden_aliases = {
        "WorkerAssignmentChanged.v1",
        "OrganizationStructurePublished.v1",
        "OrganizationRelationshipPublished.v1",
        "WorkerPayrollFactsChanged.v1",
    }
    observed_consumed = per_consumed_events | tim_consumed_events | pay_consumed_events
    validation.require(
        not (forbidden_aliases & observed_consumed),
        f"unmapped cross-module aliases remain: {sorted(forbidden_aliases & observed_consumed)}",
        group,
    )
    validation.details["crossModuleContracts"] = {
        "contracts": len(rows),
        "canonicalNames": sorted({row["canonical_name"] for row in rows}),
        "aliases": "REJECTED_WITHOUT_TESTED_ADAPTER",
        "schemaCompatibility": "EXACT_REQUIRED_FIELD_SETS",
        "schemaPins": {
            row["contract_id"]: {
                "name": row["canonical_name"],
                "requiredFieldCount": len(split_pipe(row["required_fields"])),
                "requiredFieldsSha256": row["required_fields_sha256"],
                "nestedRequiredFieldCount": len(split_pipe(row["nested_required_fields"])),
                "nestedRequiredFieldsSha256": row["nested_required_fields_sha256"],
            }
            for row in rows
        },
        "status": "READY_FOR_G3" if validation.group_errors[group] == 0 else "BLOCKED",
    }


def run_cross_module_schema_contracts(validation: Validation) -> None:
    """Require one typed, digest-pinned schema at both ends of every XCON.

    The field-name register above is useful for discovery, but it is not a
    wire contract.  This sub-gate requires Draft 2020-12 type, format,
    nullability and nested-cardinality closure, a canonical generated import,
    and provider/consumer contract-test allocations for all 21 contracts.
    Its mutation suite is part of the gate so a validator regression cannot
    silently turn a field/type/digest comparison into a presence-only check.
    """
    group = "cross-module-schema-contracts"
    validator = HERE / "validate_cross_module_schema_contracts.py"
    schema_document = HERE / "cross-module-canonical-schemas.v1.json"
    binding_register = HERE / "cross-module-schema-binding-register.csv"
    decimal_value_types = HERE / "decimal-value-types.v1.json"
    required_paths = [
        validator,
        schema_document,
        binding_register,
        decimal_value_types,
    ]
    for path in required_paths:
        validation.require(
            path.is_file() and path.stat().st_size > 0,
            f"typed XCON artifact missing: {path.name}",
            group,
        )
    if not validator.is_file():
        return

    results: dict[str, Any] = {}
    outputs: dict[str, str] = {}
    for is_self_test in (False, True):
        label = "self-test" if is_self_test else "closure"
        command = [sys.executable, str(validator)]
        if is_self_test:
            command.append("--self-test")
        command.append("--compact")
        try:
            completed = subprocess.run(
                command,
                cwd=str(HERE),
                capture_output=True,
                text=True,
                timeout=180,
                check=False,
            )
            outputs[label] = (completed.stdout + "\n" + completed.stderr).strip()
            payload = json.loads(completed.stdout)
        except (OSError, subprocess.TimeoutExpired, json.JSONDecodeError) as error:
            validation.require(False, f"typed XCON {label} failed: {error}", group)
            continue

        expected_schema = (
            "dwp.hris.cross-module-schema-contracts-self-test.v1"
            if is_self_test
            else "dwp.hris.cross-module-schema-contracts.v1"
        )
        validation.require(
            completed.returncode == 0
            and payload.get("schema") == expected_schema
            and payload.get("status") == "PASS",
            f"typed XCON {label} closure failed rc={completed.returncode}: "
            f"{payload.get('errors', payload.get('cases', []))}",
            group,
        )
        results[label] = payload

    closure = results.get("closure", {})
    checks = closure.get("checks", {})
    coverage = closure.get("coverage", {})
    expected_checks = {
        "draft202012TypedClosedSchemas",
        "exact21Parity",
        "normalizedSchemaDigestsPinned",
        "producerConsumerEvidenceExact",
        "producerConsumerTestsAllocated",
        "sameGeneratedImportAtBothEnds",
    }
    validation.require(
        set(checks) == expected_checks
        and all(value is True for value in checks.values())
        and closure.get("errors") == [],
        "typed XCON validator subchecks are incomplete or fail-open",
        group,
    )
    validation.require(
        coverage.get("sourceContractCount") == 21
        and coverage.get("bindingCount") == 21
        and coverage.get("resolvedSchemaCount") == 21
        and coverage.get("orphanBindingCount") == 0
        and coverage.get("duplicateContractCount") == 0
        and coverage.get("byKind") == {"EVENT": 13, "SNAPSHOT": 8}
        and coverage.get("producerEvidenceMatchCount") == 21
        and coverage.get("consumerBindingCount") == 31
        and coverage.get("generatedImportMatchCount") == 21
        and coverage.get("testAllocationCount") == 52,
        "typed XCON coverage must be exact 21/21 with both-end imports and tests",
        group,
    )

    self_test = results.get("self-test", {})
    cases = self_test.get("cases", [])
    expected_cases = {
        "unknown-schema-ref",
        "schema-required-drift",
        "schema-field-type-drift",
        "schema-nullability-drift",
        "nested-cardinality-drift",
        "open-object-drift",
        "normalized-digest-drift",
        "producer-evidence-pointer-drift",
        "consumer-evidence-field-drift",
        "producer-generated-import-drift",
        "consumer-generated-import-drift",
        "producer-test-allocation-drift",
        "consumer-test-coverage-drift",
        "source-required-field-drift",
        "xcon020-line-cardinality-drift",
        "xcon020-n-to-n-invariant-drift",
        "decimal-negative-zero-policy-drift",
        "closed-time-unit-currency-binding-drift",
        "xcon021-v2-to-v1-coherent-drift",
        "xcon021-exact-field-drift",
        "xcon021-historical-evidence-reactivation",
    }
    validation.require(
        len(cases) == len(expected_cases)
        and {case.get("name") for case in cases} == expected_cases
        and all(
            case.get("status") == "PASS"
            and isinstance(case.get("rejectedErrorCount"), int)
            and case["rejectedErrorCount"] > 0
            for case in cases
        ),
        "typed XCON mutation suite must reject all 21 canonical drift classes",
        group,
    )

    validation.details["crossModuleSchemaContracts"] = {
        "status": closure.get("status", "FAIL"),
        "coverage": coverage,
        "selfTestStatus": self_test.get("status", "FAIL"),
        "selfTestCaseCount": len(cases),
        "artifactSha256": {
            path.name: sha256(path) for path in required_paths if path.is_file()
        },
        "outputSha256": {
            label: hashlib.sha256(output.encode("utf-8")).hexdigest()
            for label, output in outputs.items()
        },
        "implementationState": "NOT_STARTED_G3",
        "productionState": "NOT_AUTHORIZED_G6",
    }


def run_compensation_snapshot_v2_authority(validation: Validation) -> None:
    """Execute the independent PER->PAY v2-only authority and mutation proofs."""
    group = "compensation-snapshot-v2-authority"
    validator = HERE / "validate_compensation_snapshot_v2_authority.py"
    validation.require(
        validator.is_file() and validator.stat().st_size > 0,
        "compensation snapshot v2 authority validator is missing",
        group,
    )
    if not validator.is_file():
        return
    results: dict[str, Any] = {}
    for self_test in (False, True):
        label = "self-test" if self_test else "closure"
        command = [sys.executable, str(validator)]
        if self_test:
            command.append("--self-test")
        command.append("--compact")
        try:
            completed = subprocess.run(
                command,
                cwd=str(HERE),
                capture_output=True,
                text=True,
                timeout=180,
                check=False,
            )
            payload = json.loads(completed.stdout)
        except (OSError, subprocess.TimeoutExpired, json.JSONDecodeError) as error:
            validation.require(False, f"v2 authority {label} failed: {error}", group)
            continue
        expected_schema = (
            "dwp.hris.compensation-snapshot-v2-authority-self-test.v1"
            if self_test
            else "dwp.hris.compensation-snapshot-v2-authority.v1"
        )
        validation.require(
            completed.returncode == 0
            and payload.get("schema") == expected_schema
            and payload.get("status") == "PASS",
            f"v2 authority {label} rejected: {payload.get('errors', payload.get('cases', {}))}",
            group,
        )
        results[label] = payload
    closure = results.get("closure", {})
    self_result = results.get("self-test", {})
    validation.require(
        closure.get("predecessorDisposition") == "HISTORICAL_G2_LINEAGE_ONLY"
        and closure.get("runtimeEvent") == "ApprovedCompensationPlanSnapshotPublished.v2"
        and closure.get("runtimeEventFieldCount") == 16
        and closure.get("traceCapabilityCount") == 16
        and closure.get("primaryOwnershipCount") == 525
        and closure.get("primaryBaseEventCount") == 48
        and closure.get("primaryModernEventCount") == 86
        and closure.get("errors") == [],
        "compensation v2 closure counts/authority drift",
        group,
    )
    validation.require(
        self_result.get("caseCount") == 9
        and self_result.get("passedCount") == 9
        and all(self_result.get("cases", {}).values()),
        "compensation v2 mutation suite must reject all 9 authority drifts",
        group,
    )
    validation.details["compensationSnapshotV2Authority"] = {
        "status": closure.get("status", "FAIL"),
        "runtimeEvent": closure.get("runtimeEvent"),
        "runtimeEventFieldCount": closure.get("runtimeEventFieldCount"),
        "traceCapabilityCount": closure.get("traceCapabilityCount"),
        "primaryOwnershipCount": closure.get("primaryOwnershipCount"),
        "mutationCaseCount": self_result.get("caseCount", 0),
        "artifactSha256": closure.get("artifactSha256", {}),
    }


def run_decimal_value_contract(validation: Validation) -> None:
    """Execute the decimal/money oracle and its fail-closed mutation suite."""
    group = "decimal-money-contract"
    validator = HERE / "validate_decimal_value_contract.py"
    required_paths = [
        validator,
        HERE / "decimal-value-types.v1.json",
        HERE / "cross-module-canonical-schemas.v1.json",
        ROOT / "session-evidence/pay/g2-transport-schemas.v1.json",
        ROOT / "session-evidence/pay/g2-api-event-contracts.json",
        ROOT / "session-evidence/tim/g2-api-event-contracts.json",
        ROOT / "session-evidence/per/g2-readiness/api-event-contracts.yaml",
        ROOT / "session-evidence/pay/g2-physical-schema.sql",
        ROOT / "session-evidence/tim/g2-physical-schema.sql",
        ROOT / "session-evidence/pay/synthetic-golden-fixtures.json",
        ROOT / "session-evidence/pay/g3-modern-capability-consumer-contracts.v1.json",
    ]
    for path in required_paths:
        validation.require(
            path.is_file() and path.stat().st_size > 0,
            f"decimal/money artifact missing: {path.relative_to(ROOT)}",
            group,
        )
    if not validator.is_file():
        return

    results: dict[str, Any] = {}
    outputs: dict[str, str] = {}
    for is_self_test in (False, True):
        label = "self-test" if is_self_test else "closure"
        command = [sys.executable, str(validator)]
        if is_self_test:
            command.append("--self-test")
        command.append("--compact")
        try:
            completed = subprocess.run(
                command,
                cwd=str(HERE),
                capture_output=True,
                text=True,
                timeout=180,
                check=False,
            )
            outputs[label] = (completed.stdout + "\n" + completed.stderr).strip()
            payload = json.loads(completed.stdout)
        except (OSError, subprocess.TimeoutExpired, json.JSONDecodeError) as error:
            validation.require(False, f"decimal/money {label} failed: {error}", group)
            continue
        expected_schema = (
            "dwp.hris.decimal-money-contract-proof-self-test.v1"
            if is_self_test
            else "dwp.hris.decimal-money-contract-proof.v1"
        )
        validation.require(
            completed.returncode == 0
            and payload.get("schema") == expected_schema
            and payload.get("status") == "PASS",
            f"decimal/money {label} closure failed rc={completed.returncode}: "
            f"{payload.get('errors', payload.get('cases', []))}",
            group,
        )
        results[label] = payload

    closure = results.get("closure", {})
    coverage = closure.get("coverage", {})
    validation.require(
        closure.get("errors") == []
        and coverage == {
            "valueTypes": 5,
            "roundingModes": 6,
            "largeStreamingContracts": 2,
            "payConsumerProjectionTables": 2,
            "goldenCase": "PAY-GOLD-014",
        }
        and closure.get("states") == {
            "implementation": "NOT_STARTED_G3",
            "production": "NOT_AUTHORIZED_G6",
        },
        "decimal/money executable coverage or state drift",
        group,
    )
    self_test = results.get("self-test", {})
    cases = self_test.get("cases", [])
    expected_cases = {
        "json-number-wire", "exponent-enabled", "database-rounding-enabled",
        "precision-drift", "negative-zero-preserved", "xcon002-number",
        "closed-time-currency-binding", "compensation-line-number",
        "gateway-buffering", "compressed-ceiling-missing",
        "sequence-gap-not-checked", "pay-tim-provider-drift",
        "tim-amount-currency-ddl", "pay-projection-column-missing",
        "pay-projection-digest-typo", "pay-local-fk-missing",
        "golden-rounding-wrong", "golden-json-number-gap",
    }
    validation.require(
        self_test.get("caseCount") == len(expected_cases)
        and len(cases) == len(expected_cases)
        and {case.get("name") for case in cases} == expected_cases
        and all(
            case.get("status") == "PASS"
            and isinstance(case.get("rejectedErrors"), int)
            and case["rejectedErrors"] > 0
            for case in cases
        ),
        "decimal/money mutation suite must reject all 18 exact drift classes",
        group,
    )
    validation.details["decimalMoneyContract"] = {
        "status": closure.get("status", "FAIL"),
        "checks": closure.get("checks", 0),
        "coverage": coverage,
        "selfTestStatus": self_test.get("status", "FAIL"),
        "selfTestCaseCount": len(cases),
        "artifactSha256": {
            str(path.relative_to(ROOT)): sha256(path)
            for path in required_paths
            if path.is_file()
        },
        "outputSha256": {
            label: hashlib.sha256(output.encode("utf-8")).hexdigest()
            for label, output in outputs.items()
        },
    }


def run_receipt_and_country_pack_boundaries(validation: Validation) -> None:
    """Execute receipt security and Product-Core/G6 boundary mutation proofs."""
    specifications = {
        "command-receipt-contracts": {
            "validator": HERE / "validate_command_receipt_contracts.py",
            "normalMarker": "COMMAND_RECEIPT_CONTRACTS=PASS owners=4 receiptQueries=4 sealedFields=11",
            "selfMarker": "COMMAND_RECEIPT_CONTRACTS_SELF_TEST=PASS mutations=8",
            "artifacts": [
                ROOT / "session-evidence/tim/g2-physical-schema.sql",
                ROOT / "session-evidence/tim/g2-api-event-contracts.json",
                ROOT / "session-evidence/tim/g2-transport-schemas.v1.json",
                ROOT / "session-evidence/tim/synthetic-golden-fixtures.json",
                ROOT / "session-evidence/pay/g2-physical-schema.sql",
                ROOT / "session-evidence/pay/g2-api-event-contracts.json",
                ROOT / "session-evidence/pay/g2-transport-schemas.v1.json",
                ROOT / "session-evidence/pay/synthetic-golden-fixtures.json",
                ROOT / "session-evidence/sys/g2-auth-physical-schema.sql",
                ROOT / "session-evidence/sys/g2-platform-physical-schema.sql",
                ROOT / "session-evidence/sys/g2-transport-schemas.v1.json",
                ROOT / "session-evidence/sys/g2-golden-scenarios.csv",
            ],
            "detailKey": "commandReceiptContracts",
            "detail": {"owners": 4, "receiptQueries": 4, "sealedFields": 11, "mutationCases": 8},
        },
        "country-pack-boundaries": {
            "validator": HERE / "validate_country_pack_boundaries.py",
            "normalMarker": "COUNTRY_PACK_BOUNDARY=PASS rows=11 tim=5 pay=6 g3=6 g6=5",
            "selfMarker": "COUNTRY_PACK_BOUNDARY_SELF_TEST=PASS mutations=7",
            "artifacts": [
                HERE / "country-pack-boundary-register.csv",
                HERE / "activation-gate-register.csv",
                ROOT / "session-evidence/tim/g2-service-boundary.md",
                ROOT / "session-evidence/tim/synthetic-golden-fixtures.json",
                ROOT / "session-evidence/pay/g2-service-boundary.md",
                ROOT / "session-evidence/pay/g2-runtime-controls.md",
                ROOT / "session-evidence/pay/g2-api-event-contracts.json",
                ROOT / "session-evidence/pay/g2-physical-schema.sql",
                ROOT / "session-evidence/pay/synthetic-golden-fixtures.json",
            ],
            "detailKey": "countryPackBoundaries",
            "detail": {"rows": 11, "timRows": 5, "payRows": 6, "g3Rows": 6, "g6Rows": 5, "mutationCases": 7},
        },
    }
    for group, specification in specifications.items():
        validator = specification["validator"]
        artifacts = [validator, *specification["artifacts"]]
        for path in artifacts:
            validation.require(
                path.is_file() and path.stat().st_size > 0,
                f"{group} artifact missing: {path}",
                group,
            )
        outputs: dict[str, str] = {}
        passed = True
        for label, extra, marker in (
            ("closure", [], specification["normalMarker"]),
            ("self-test", ["--self-test"], specification["selfMarker"]),
        ):
            try:
                completed = subprocess.run(
                    [sys.executable, str(validator), *extra],
                    cwd=str(HERE),
                    capture_output=True,
                    text=True,
                    timeout=120,
                    check=False,
                )
                output = (completed.stdout + "\n" + completed.stderr).strip()
            except (OSError, subprocess.TimeoutExpired) as error:
                completed = None
                output = str(error)
            outputs[label] = output
            ok = completed is not None and completed.returncode == 0 and marker in completed.stdout
            validation.require(ok, f"{group} {label} failed: {output}", group)
            passed = passed and ok
        detail = dict(specification["detail"])
        detail.update(
            {
                "status": "PASS" if passed else "FAIL",
                "selfTestStatus": "PASS" if passed else "FAIL",
                "artifactSha256": {
                    str(path.relative_to(ROOT)): sha256(path)
                    for path in artifacts
                    if path.is_file()
                },
                "outputSha256": {
                    label: hashlib.sha256(output.encode("utf-8")).hexdigest()
                    for label, output in outputs.items()
                },
            }
        )
        validation.details[specification["detailKey"]] = detail


def run_g5a_design_ai_package_contract(validation: Validation) -> None:
    """Validate future G5A ownership now, without claiming future evidence.

    The generic-core G3 gate requires a deterministic handoff contract and a
    fail-closed validator, not packages that can only truthfully be generated
    from functionally accepted G4 screens.  Concrete package verification is
    intentionally exposed as the validator's separate ``post-g4`` mode.
    """
    group = "g5a-design-ai-package-contract"
    validator = HERE / "validate_g5a_design_ai_packages.py"
    ocr_runtime = HERE / "g5a_image_ocr.swift"
    register = HERE / "g5a-design-ai-package-allocation-register.csv"
    ia_register = HERE / "hris-information-architecture-register.csv"
    handoff_prompt = ROOT / "session-prompts/90-design-ai-handoff-output-contract.md"
    nfr = HERE / "nonfunctional-requirements-register.csv"
    integration_prompt = ROOT / "session-prompts/06-hris-integration-control.md"
    required_paths = [
        validator, ocr_runtime, register, ia_register, handoff_prompt, nfr,
        integration_prompt,
    ]
    for path in required_paths:
        validation.require(
            path.is_file() and path.stat().st_size > 0,
            f"G5A planned contract artifact missing: {path}",
            group,
        )
    if not validator.is_file():
        return

    outputs: dict[str, str] = {}
    results: dict[str, Any] = {}
    commands = {
        "planned": [
            sys.executable, str(validator), "--mode", "planned", "--compact",
        ],
        "self-test": [
            sys.executable, str(validator), "--self-test", "--compact",
        ],
    }
    for label, command in commands.items():
        try:
            completed = subprocess.run(
                command,
                cwd=str(ROOT),
                capture_output=True,
                text=True,
                timeout=180,
                check=False,
            )
            outputs[label] = (completed.stdout + "\n" + completed.stderr).strip()
            payload = json.loads(completed.stdout)
        except (OSError, subprocess.TimeoutExpired, json.JSONDecodeError) as error:
            validation.require(False, f"G5A {label} validator failed: {error}", group)
            continue
        validation.require(
            completed.returncode == 0 and payload.get("status") == "PASS",
            f"G5A {label} validator did not pass: {payload.get('errors', [])}",
            group,
        )
        results[label] = payload

    planned = results.get("planned", {})
    coverage = planned.get("coverage", {})
    expected_owned = {
        "HRIS-HRM": 24,
        "HRIS-PER": 19,
        "HRIS-PAY": 17,
        "HRIS-TIM": 17,
        "HRIS-SYS": 21,
    }
    validation.require(
        planned.get("schema") == "dwp.hris.g5a-design-ai-package-validation.v1"
        and planned.get("mode") == "PLANNED"
        and planned.get("gateDecision") == "PLANNED_NOT_DUE_AFTER_G4"
        and planned.get("packageValidation") == "NOT_RUN_NOT_DUE"
        and coverage.get("iaNodeCount") == 98
        and coverage.get("packageContractCount") == 5
        and coverage.get("ownedNodesByModule") == expected_owned
        and coverage.get("actualPackageCountRequiredNow") == 0
        and planned.get("implementationState") == "NOT_STARTED_G3"
        and planned.get("productionState") == "NOT_AUTHORIZED_G6"
        and planned.get("errors") == [],
        "G5A planned mode must close five ownership paths and 98 IA nodes "
        "without requiring or claiming a post-G4 package",
        group,
    )
    self_test = results.get("self-test", {})
    cases = self_test.get("cases", [])
    synthetic_baseline = self_test.get("baselinePostG4SyntheticFixture", {})
    expected_cases = {
        "missing-required-file",
        "manifest-hash-drift",
        "pii-leak",
        "secret-leak",
        "unmapped-ia-node",
        "wrong-module-node",
        "foreign-or-nonexistent-target-path",
        "rendered-image-ocr-pii-leak",
        "zip-parity-drift",
    }
    validation.require(
        self_test.get("schema") == "dwp.hris.g5a-design-ai-package-self-test.v1"
        and self_test.get("mode") == "SELF_TEST"
        and self_test.get("plannedContractState") == "PLANNED_NOT_DUE_AFTER_G4"
        and self_test.get("implementationState") == "NOT_STARTED_G3"
        and self_test.get("productionState") == "NOT_AUTHORIZED_G6"
        and self_test.get("errors") == []
        and synthetic_baseline.get("fixture")
        == "SYNTHETIC_POST_G4_VALIDATOR_PROOF_ONLY"
        and synthetic_baseline.get("status") == "PASS"
        and synthetic_baseline.get("ownedIaNodes") == 24
        and synthetic_baseline.get("mappedIaNodes") == 24
        and synthetic_baseline.get("surfaceCount") == 25
        and synthetic_baseline.get("multipleSurfacesForOneNode") is True
        and synthetic_baseline.get("coverageInventoryBidirectionalClosure") == "PASS"
        and synthetic_baseline.get("g3FrontendAllocationGlobCount") == 3
        and synthetic_baseline.get("g4FrontendCommitBlobBindings") == "PASS"
        and synthetic_baseline.get("ocrTool")
        == "APPLE_VISION_VNRECOGNIZETEXTREQUEST"
        and len(cases) == 9
        and {case.get("name") for case in cases} == expected_cases
        and all(
            case.get("status") == "PASS"
            and isinstance(case.get("rejectedErrorCount"), int)
            and case["rejectedErrorCount"] > 0
            for case in cases
        ),
        "G5A mutation suite must reject missing/hash/PII/secret/unmapped/"
        "wrong-module/foreign-or-nonexistent G4 target/rendered-image OCR PII/ZIP drift",
        group,
    )
    cases_by_name = {case.get("name"): case for case in cases}
    validation.require(
        cases_by_name.get("rendered-image-ocr-pii-leak", {}).get(
            "freshOcrPiiRejected"
        )
        is True
        and cases_by_name.get("foreign-or-nonexistent-target-path", {}).get(
            "g4PathBindingRejected"
        )
        is True,
        "G5A self-test does not prove fresh rendered-image OCR and exact G4 path rejection",
        group,
    )

    document_markers = {
        handoff_prompt: [
            "g5a-design-ai-package-allocation-register.csv",
            "validate_g5a_design_ai_packages.py --mode planned",
            "validate_g5a_design_ai_packages.py --mode post-g4",
            "package-manifest.json",
            ".zip.sha256",
            ".zip.verification.json",
            "g4-frontend-surface-inventory.csv",
            "g5a_image_ocr.swift",
            "(ia_node_id,surface_key)",
            "PLANNED_NOT_DUE_AFTER_G4",
            "WAITING_EXTERNAL_DESIGN",
        ],
        HERE / "README.md": [
            "g5a-design-ai-package-allocation-register.csv",
            "validate_g5a_design_ai_packages.py",
            "PLANNED_NOT_DUE_AFTER_G4",
            "NOT_RUN_NOT_DUE",
            "G4 frontend surface inventory",
            "fresh Apple Vision OCR",
        ],
        nfr: [
            "validate_g5a_design_ai_packages.py",
            "post-G4 package manifest/hash/PII-secret/OCR/G4-surface/98-IA-owner/ZIP parity",
        ],
        integration_prompt: [
            "validate_g5a_design_ai_packages.py --mode planned --compact",
            "validate_g5a_design_ai_packages.py --self-test --compact",
            "--mode post-g4 --module HRIS-{MODULE}",
            "foreign/nonexistent target",
            "fresh Apple Vision OCR",
        ],
    }
    for path, markers in document_markers.items():
        text = path.read_text(encoding="utf-8") if path.is_file() else ""
        for marker in markers:
            validation.require(
                marker.lower() in text.lower(),
                f"{path.name}: missing G5A contract marker {marker}",
                group,
            )
    validation.details["g5aDesignAiPackageContract"] = {
        "status": planned.get("status", "FAIL"),
        "gateDecision": planned.get("gateDecision", "BLOCKED_CONTRACT"),
        "actualPackageValidation": planned.get("packageValidation", "NOT_RUN"),
        "iaNodeCount": coverage.get("iaNodeCount", 0),
        "ownedNodesByModule": coverage.get("ownedNodesByModule", {}),
        "selfTestStatus": self_test.get("status", "FAIL"),
        "selfTestCaseCount": len(cases),
        "syntheticPostG4ValidatorProof": synthetic_baseline,
        "postG4Command": (
            "validate_g5a_design_ai_packages.py --mode post-g4 "
            "--module HRIS-{MODULE} --package-date YYYY-MM-DD --compact"
        ),
        "artifactSha256": {
            str(path.relative_to(ROOT)): sha256(path)
            for path in required_paths if path.is_file()
        },
        "outputSha256": {
            label: hashlib.sha256(output.encode("utf-8")).hexdigest()
            for label, output in outputs.items()
        },
        "implementationState": "NOT_STARTED_G3",
        "productionState": "NOT_AUTHORIZED_G6",
    }


def run_physical_owner_prefixes(validation: Validation) -> None:
    """Require exact table prefix, schema and runtime ownership boundaries."""
    group = "physical-owner-prefixes"
    validator = HERE / "validate_physical_owner_prefixes.py"
    register = HERE / "physical-owner-prefix-register.csv"
    pay_consumer = ROOT / "session-evidence/pay/g3-modern-capability-consumer-contracts.v1.json"
    required_paths = [validator, register, pay_consumer]
    for path in required_paths:
        validation.require(
            path.is_file() and path.stat().st_size > 0,
            f"physical owner/prefix artifact missing: {path.name}",
            group,
        )
    if not validator.is_file():
        return

    results: dict[str, Any] = {}
    outputs: dict[str, str] = {}
    for is_self_test in (False, True):
        label = "self-test" if is_self_test else "closure"
        command = [sys.executable, str(validator)]
        if is_self_test:
            command.append("--self-test")
        command.append("--compact")
        try:
            completed = subprocess.run(
                command,
                cwd=str(HERE),
                capture_output=True,
                text=True,
                timeout=300,
                check=False,
            )
            outputs[label] = (completed.stdout + "\n" + completed.stderr).strip()
            payload = json.loads(completed.stdout)
        except (OSError, subprocess.TimeoutExpired, json.JSONDecodeError) as error:
            validation.require(
                False,
                f"physical owner/prefix {label} failed: {error}",
                group,
            )
            continue
        expected_self_tests = 5 if is_self_test else 0
        validation.require(
            completed.returncode == 0
            and payload.get("status") == "PASS"
            and payload.get("errors") == []
            and payload.get("bindings") == 10
            and payload.get("sourceScopes") == 14
            and payload.get("baseTables") == 163
            and payload.get("producerModernTables") == 56
            and payload.get("authoritativeTables") == 219
            and payload.get("consumerMaterializationTables") == 2
            and payload.get("deploymentPhysicalObjects") == 221
            and payload.get("tables") == 221
            and payload.get("selfTests") == expected_self_tests,
            f"physical owner/prefix {label} did not close exact base163 + producer56 + PAY consumer2 = deploy221 ownership: "
            f"{payload.get('errors', [])}",
            group,
        )
        results[label] = payload

    closure = results.get("closure", {})
    validation.details["physicalOwnerPrefixes"] = {
        "status": closure.get("status", "FAIL"),
        "bindings": closure.get("bindings", 0),
        "sourceScopes": closure.get("sourceScopes", 0),
        "baseTables": closure.get("baseTables", 0),
        "producerModernTables": closure.get("producerModernTables", 0),
        "authoritativeTables": closure.get("authoritativeTables", 0),
        "consumerMaterializationTables": closure.get("consumerMaterializationTables", 0),
        "deploymentPhysicalObjects": closure.get("deploymentPhysicalObjects", 0),
        "tables": closure.get("tables", 0),
        "selfTestStatus": results.get("self-test", {}).get("status", "FAIL"),
        "selfTestCaseCount": results.get("self-test", {}).get("selfTests", 0),
        "artifactSha256": {
            path.name: sha256(path) for path in required_paths if path.is_file()
        },
        "outputSha256": {
            label: hashlib.sha256(output.encode("utf-8")).hexdigest()
            for label, output in outputs.items()
        },
        "implementationState": "NOT_STARTED_G3",
        "productionState": "NOT_AUTHORIZED_G6",
    }


def run_sys_service_local_migrations(
    validation: Validation,
    check_live: bool,
) -> None:
    """Prove Auth and Platform SYS DDL execute independently.

    The combined catalog is useful documentation, but it may hide cross-service
    table references.  G3 therefore consumes two owner-local migrations.  Live
    mode additionally executes each script in its own empty PostgreSQL 16
    database so a table, FK, RLS policy or prefix leak cannot pass by relying on
    the other service's schema.
    """
    group = "sys-service-local-migrations"
    sys_root = ROOT / "session-evidence/sys"
    validator = sys_root / "validate_sys_service_local_migrations.py"
    merged = sys_root / "g2-physical-schema.sql"
    auth = sys_root / "g2-auth-physical-schema.sql"
    platform = sys_root / "g2-platform-physical-schema.sql"
    required_paths = [validator, merged, auth, platform]
    for path in required_paths:
        validation.require(
            path.is_file() and path.stat().st_size > 0,
            f"SYS service-local migration artifact missing: {path.relative_to(ROOT)}",
            group,
        )
    if not validator.is_file():
        return

    modes: list[tuple[str, list[str], int]] = [
        ("closure", [], 0),
        ("self-test", ["--self-test"], 5),
    ]
    if check_live:
        modes.append(("postgres16", ["--docker-postgres"], 0))
    results: dict[str, Any] = {}
    outputs: dict[str, str] = {}
    for label, arguments, expected_self_tests in modes:
        command = [sys.executable, str(validator), *arguments, "--compact"]
        try:
            completed = subprocess.run(
                command,
                cwd=str(ROOT),
                capture_output=True,
                text=True,
                timeout=240,
                check=False,
            )
            outputs[label] = (completed.stdout + "\n" + completed.stderr).strip()
            payload = json.loads(completed.stdout)
        except (OSError, subprocess.TimeoutExpired, json.JSONDecodeError) as error:
            validation.require(
                False,
                f"SYS service-local migration {label} failed: {error}",
                group,
            )
            continue
        validation.require(
            completed.returncode == 0
            and payload.get("schema")
            == "dwp.hris.sys.service-local-migration-readiness.v1"
            and payload.get("status") == "PASS"
            and payload.get("errors") == []
            and payload.get("authTables") == 7
            and payload.get("platformTables") == 25
            and payload.get("catalogTables") == 32
            and payload.get("authTenantTables") == 4
            and payload.get("platformTenantTables") == 24
            and payload.get("foreignKeys") == 15
            and payload.get("indexes") == 19
            and payload.get("selfTests") == expected_self_tests
            and payload.get("checks") == (160 if label == "postgres16" else 154),
            f"SYS service-local migration {label} exact closure failed: "
            f"{payload.get('errors', [])}",
            group,
        )
        postgres = payload.get("postgresExecution", {})
        if label == "postgres16":
            validation.require(
                postgres.get("executed") is True
                and postgres.get("image") == "postgres:16-alpine"
                and postgres.get("auth")
                == {"forcedRlsTables": 4, "tables": 7, "tenantPolicies": 4}
                and postgres.get("platform")
                == {"forcedRlsTables": 24, "tables": 25, "tenantPolicies": 24},
                "SYS Auth/Platform migrations were not independently executed with exact RLS in PostgreSQL 16",
                group,
            )
        else:
            validation.require(
                postgres == {"executed": False},
                f"SYS migration {label} unexpectedly reports live database execution",
                group,
            )
        results[label] = payload

    closure = results.get("closure", {})
    validation.details["sysServiceLocalMigrations"] = {
        "status": closure.get("status", "FAIL"),
        "authTables": closure.get("authTables", 0),
        "platformTables": closure.get("platformTables", 0),
        "catalogTables": closure.get("catalogTables", 0),
        "selfTestStatus": results.get("self-test", {}).get("status", "FAIL"),
        "selfTestCaseCount": results.get("self-test", {}).get("selfTests", 0),
        "postgres16Status": (
            results.get("postgres16", {}).get("status", "NOT_RUN")
            if check_live
            else "LIVE_ONLY"
        ),
        "postgresCatalogEvidence": (
            results.get("postgres16", {}).get("postgresExecution", {})
            if check_live
            else {"executed": False, "reason": "LIVE_ONLY"}
        ),
        "inputDigests": closure.get("inputDigests", {}),
        "artifactSha256": {
            str(path.relative_to(ROOT)): sha256(path)
            for path in required_paths
            if path.is_file()
        },
        "outputSha256": {
            label: hashlib.sha256(output.encode("utf-8")).hexdigest()
            for label, output in outputs.items()
        },
        "implementationState": "NOT_STARTED_G3",
        "productionState": "NOT_AUTHORIZED_G6",
    }


def run_pre_g3_common_foundation_migrations(validation: Validation) -> None:
    """Require the sealed six-file common-foundation technical receipt chain.

    This is a G3-entry engineering proof only.  The child validator deliberately
    keeps G6 and external-identity authority closed and binds both PostgreSQL
    versions to one final clean backend commit.
    """
    group = "pre-g3-common-foundation-migrations"
    validator = ROOT / "g0/validate_pre_g3_common_foundation_migrations.py"
    capture_runner = (
        ROOT / "g0/capture_pre_g3_common_foundation_postgres_evidence.py"
    )
    required_paths = [
        ROOT / "g0/pre-g3-common-foundation-migration-receipt-contract.v1.md",
        validator,
        capture_runner,
        ROOT / "g0/materialize_pre_g3_common_foundation_migration_receipts.py",
        ROOT / "g0/pre-g3-common-foundation-migration-allocation.v1.json",
        ROOT / "g0/pre-g3-common-foundation-migration-technical-review.v1.json",
        ROOT / "g0/control-evidence-intake/pre-g3-common-foundation-postgres-16.v1.json",
        ROOT / "g0/control-evidence-intake/pre-g3-common-foundation-postgres-16.junit.xml",
        ROOT / "g0/control-evidence-intake/pre-g3-common-foundation-postgres-16.observations.v1.json",
        ROOT / "g0/control-evidence-intake/pre-g3-common-foundation-postgres-16.notification.junit.xml",
        ROOT / "g0/control-evidence-intake/pre-g3-common-foundation-postgres-16.notification-observations.v1.json",
        ROOT / "g0/control-evidence-intake/pre-g3-common-foundation-postgres-18.v1.json",
        ROOT / "g0/control-evidence-intake/pre-g3-common-foundation-postgres-18.junit.xml",
        ROOT / "g0/control-evidence-intake/pre-g3-common-foundation-postgres-18.observations.v1.json",
        ROOT / "g0/control-evidence-intake/pre-g3-common-foundation-postgres-18.notification.junit.xml",
        ROOT / "g0/control-evidence-intake/pre-g3-common-foundation-postgres-18.notification-observations.v1.json",
    ]
    for path in required_paths:
        validation.require(
            path.is_file() and not path.is_symlink() and path.stat().st_size > 0,
            "pre-G3 common-foundation artifact missing/unsafe: "
            + str(path.relative_to(ROOT)),
            group,
        )
    if not validator.is_file():
        return

    results: dict[str, Any] = {}
    outputs: dict[str, str] = {}
    for label, command in (
        ("closure", [sys.executable, str(validator), "--compact"]),
        (
            "self-test",
            [sys.executable, str(validator), "--self-test", "--compact"],
        ),
        (
            "capture-self-test",
            [sys.executable, str(capture_runner), "--self-test"],
        ),
    ):
        try:
            completed = subprocess.run(
                command,
                cwd=str(ROOT),
                capture_output=True,
                text=True,
                timeout=120,
                check=False,
            )
            outputs[label] = (completed.stdout + "\n" + completed.stderr).strip()
            payload = json.loads(completed.stdout)
        except (OSError, subprocess.TimeoutExpired, json.JSONDecodeError) as error:
            validation.require(
                False,
                f"pre-G3 common-foundation {label} failed: {error}",
                group,
            )
            continue
        if label == "capture-self-test":
            exact = (
                completed.returncode == 0
                and payload.get("schema")
                == "dwp.hris.pre-g3-postgres-capture-self-test.v1"
                and payload.get("status") == "PASS"
                and payload.get("failed") == []
                and payload.get("total") == 35
                and payload.get("passed") == 35
            )
        else:
            self_tests = payload.get("selfTests")
            expected_self_tests = (
                {"total": 70, "passed": 70}
                if label == "self-test"
                else None
            )
            exact = (
                completed.returncode == 0
                and payload.get("schema")
                == "dwp.hris.pre-g3-common-foundation-migration-validation.v1"
                and payload.get("status") == "PASS"
                and payload.get("errors") == []
                and payload.get("scope")
                == "PRE_G3_TECHNICAL_ONLY_NO_G6_NO_EXTERNAL_IDENTITY"
                and payload.get("migrationFileCount") == 6
                and payload.get("postgresEvidenceCount") == 2
                and self_tests == expected_self_tests
            )
        validation.require(
            exact,
            f"pre-G3 common-foundation {label} exact closure failed: "
            f"{payload.get('errors', payload.get('failed', []))}",
            group,
        )
        results[label] = payload

    validation.details["preG3CommonFoundationMigrations"] = {
        "status": results.get("closure", {}).get("status", "FAIL"),
        "migrationFileCount": results.get("closure", {}).get(
            "migrationFileCount", 0
        ),
        "postgresEvidenceCount": results.get("closure", {}).get(
            "postgresEvidenceCount", 0
        ),
        "selfTestStatus": results.get("self-test", {}).get("status", "FAIL"),
        "selfTestCaseCount": (
            results.get("self-test", {}).get("selfTests") or {}
        ).get("total", 0),
        "captureSelfTestStatus": results.get("capture-self-test", {}).get(
            "status", "FAIL"
        ),
        "captureSelfTestCaseCount": results.get(
            "capture-self-test", {}
        ).get("total", 0),
        "authorityBoundary": "TECHNICAL_G3_ENTRY_ONLY_G6_CLOSED",
        "artifactSha256": {
            str(path.relative_to(ROOT)): sha256(path)
            for path in required_paths
            if path.is_file()
        },
        "outputSha256": {
            label: hashlib.sha256(output.encode("utf-8")).hexdigest()
            for label, output in outputs.items()
        },
        "productionState": "NOT_AUTHORIZED_G6",
    }


def run_base_schema_postgres_feasibility(
    validation: Validation,
    check_live: bool,
) -> None:
    """Prove the executable base DDL chain in real PostgreSQL 16.

    Static and mutation modes run for every gate invocation.  Live mode also
    replays People V1..V46 -> HRM -> PER in the dwp-people-server database and
    TIM/PAY in two independent empty databases.  This closes the gap between a
    plausible SQL document and a schema PostgreSQL can actually compile.
    """
    group = "base-schema-postgres-feasibility"
    validator = HERE / "validate_base_schema_postgres_feasibility.py"
    required_paths = [
        validator,
        ROOT / "session-evidence/hrm/g2-readiness/physical-schema-blueprint.sql",
        ROOT / "session-evidence/per/g2-readiness/physical-schema.sql",
        ROOT / "session-evidence/tim/g2-physical-schema.sql",
        ROOT / "session-evidence/pay/g2-physical-schema.sql",
    ]
    for path in required_paths:
        validation.require(
            path.is_file() and path.stat().st_size > 0,
            f"base schema feasibility artifact missing: {path.relative_to(ROOT)}",
            group,
        )
    if not validator.is_file() or not capture_runner.is_file():
        return

    modes: list[tuple[str, list[str], int, int]] = [
        ("static", [], 72, 0),
        ("self-test", ["--self-test"], 79, 7),
    ]
    if check_live:
        modes.append(("postgres16", ["--docker-postgres"], 168, 0))

    results: dict[str, Any] = {}
    outputs: dict[str, str] = {}
    for label, arguments, expected_checks, expected_self_tests in modes:
        try:
            completed = subprocess.run(
                [sys.executable, str(validator), *arguments, "--compact"],
                cwd=str(HERE),
                capture_output=True,
                text=True,
                timeout=300,
                check=False,
            )
            outputs[label] = (completed.stdout + "\n" + completed.stderr).strip()
            payload = json.loads(completed.stdout)
        except (OSError, subprocess.TimeoutExpired, json.JSONDecodeError) as error:
            validation.require(False, f"base schema {label} proof failed: {error}", group)
            continue

        expected_mode = label
        validation.require(
            completed.returncode == 0
            and payload.get("schema")
            == "dwp.hris.base-schema-postgres-feasibility.v1"
            and payload.get("mode") == expected_mode
            and payload.get("status") == "PASS"
            and payload.get("errors") == []
            and payload.get("checks") == expected_checks
            and payload.get("selfTests") == expected_self_tests,
            f"base schema {label} exact closure failed: {payload.get('errors', [])}",
            group,
        )
        validation.require(
            payload.get("peopleBaselineMigrations") == 46
            and payload.get("peopleBaselineVersions") == list(range(1, 47))
            and payload.get("peopleBaselineTables") == 67
            and payload.get("baseOwnerTables") == 131
            and payload.get("executionPlan")
            == {
                "peopleDatabaseOrder": ["People V1..V46", "HRM", "PER"],
                "peopleMigrationTransactions": 50,
                "peopleBaselineSinglePsqlSession": True,
                "onErrorStop": True,
                "timeDatabase": "independent-empty",
                "payrollDatabase": "independent-empty",
            }
            and {
                module: payload.get("modules", {}).get(module, {}).get("tables")
                for module in ("HRM", "PER", "TIM", "PAY")
            }
            == {"HRM": 24, "PER": 34, "TIM": 31, "PAY": 42}
            and {
                module: payload.get("modules", {}).get(module, {}).get("rlsTables")
                for module in ("HRM", "PER", "TIM", "PAY")
            }
            == {"HRM": 24, "PER": 34, "TIM": 31, "PAY": 42},
            f"base schema {label} sequence/table/RLS totals drift",
            group,
        )

        if label == "self-test":
            cases = payload.get("selfTestCases", [])
            expected_cases = {
                "people-migration-gap",
                "people-v7-transaction-semantics-drift",
                "hrm-owner-table-set-drift",
                "per-schema-boundary-drift",
                "tim-rls-coverage-drift",
                "pay-cross-owner-fk-drift",
                "constraint-count-drift",
            }
            validation.require(
                isinstance(cases, list)
                and len(cases) == 7
                and {case.get("name") for case in cases} == expected_cases
                and all(
                    case.get("status") == "PASS"
                    and isinstance(case.get("rejectedErrorCount"), int)
                    and case["rejectedErrorCount"] > 0
                    for case in cases
                ),
                "base schema mutation suite did not reject all seven drift classes",
                group,
            )
        elif label == "static":
            validation.require(
                payload.get("postgresExecution") == {"executed": False},
                "base schema static proof unexpectedly reports database execution",
                group,
            )
        else:
            postgres = payload.get("postgresExecution", {})
            modules = postgres.get("modules", {})
            expected_module_catalog = {
                "HRM": (24, 24, 24, 35, 49),
                "PER": (34, 34, 34, 38, 72),
                "TIM": (31, 31, 31, 11, 84),
                "PAY": (42, 42, 42, 21, 113),
            }
            actual_module_catalog = {
                module: (
                    values.get("tables"),
                    values.get("forcedRlsTables"),
                    values.get("tenantPolicies"),
                    values.get("foreignKeys"),
                    values.get("checkConstraints"),
                )
                for module, values in modules.items()
            }
            validation.require(
                postgres.get("executed") is True
                and postgres.get("image") == "postgres:16-alpine"
                and str(postgres.get("serverVersion", "")).startswith("16.")
                and postgres.get("databaseIsolation")
                == {
                    "people": "people_service",
                    "time": "time_service",
                    "payroll": "payroll_service",
                }
                and postgres.get("peopleExecutionOrder")
                == ["V1..V46", "HRM", "PER"]
                and postgres.get("peopleBaselineTransactions") == 46
                and postgres.get("peopleTotalTransactions") == 52
                and postgres.get("baseline", {}).get("tables") == 67
                and actual_module_catalog == expected_module_catalog
                and postgres.get("hrmBaselineAugmentations")
                == {
                    "indexes": [
                        "uk_ppl_assignments_public_id",
                        "uk_ppl_job_grades_public_id",
                        "uk_ppl_job_profiles_public_id",
                        "uk_ppl_legal_employers_public_id",
                        "uk_ppl_locations_public_id",
                        "uk_ppl_positions_public_id",
                        "uk_ppl_work_relationships_public_id",
                    ],
                    "exclusions": [
                        "ex_ppl_assignments_primary_period",
                        "ex_ppl_work_relationships_primary_period",
                    ],
                },
                "base schemas were not compiled in exact isolated PostgreSQL 16 catalogs",
                group,
            )
        results[label] = payload

    closure = results.get("static", {})
    validation.details["baseSchemaPostgresFeasibility"] = {
        "status": closure.get("status", "FAIL"),
        "peopleBaselineMigrations": closure.get("peopleBaselineMigrations", 0),
        "peopleBaselineTables": closure.get("peopleBaselineTables", 0),
        "baseOwnerTables": closure.get("baseOwnerTables", 0),
        "moduleTables": {
            module: closure.get("modules", {}).get(module, {}).get("tables", 0)
            for module in ("HRM", "PER", "TIM", "PAY")
        },
        "selfTestStatus": results.get("self-test", {}).get("status", "FAIL"),
        "selfTestCaseCount": results.get("self-test", {}).get("selfTests", 0),
        "postgres16Status": (
            results.get("postgres16", {}).get("status", "NOT_RUN")
            if check_live
            else "LIVE_ONLY"
        ),
        "artifactSha256": {
            str(path.relative_to(ROOT)): sha256(path)
            for path in required_paths
            if path.is_file()
        },
        "outputSha256": {
            label: hashlib.sha256(output.encode("utf-8")).hexdigest()
            for label, output in outputs.items()
        },
        "implementationState": "NOT_STARTED_G3",
        "productionState": "NOT_AUTHORIZED_G6",
    }


def validate_modern_capability_scope(validation: Validation) -> None:
    group = "modern-capability-scope"
    roadmap = read_csv(
        ROOT / "modern-hris-capability-roadmap.csv",
        validation,
        group,
    )
    deliveries = read_csv(
        HERE / "modern-capability-delivery-register.csv",
        validation,
        group,
        MODERN_DELIVERY_HEADER,
    )
    traces = read_csv(
        HERE / "modern-capability-trace-register.csv",
        validation,
        group,
        MODERN_TRACE_HEADER,
    )
    roadmap_by_id = {row.get("capability_id", ""): row for row in roadmap}
    delivery_by_id = {row.get("capability_id", ""): row for row in deliveries}
    trace_by_id = {row.get("capability_id", ""): row for row in traces}
    validation.require(
        len(roadmap) == 16
        and len(roadmap_by_id) == 16
        and len(deliveries) == 16
        and len(delivery_by_id) == 16,
        "modern capability registry must contain 16 unique rows",
        group,
    )
    validation.require(
        set(roadmap_by_id) == set(delivery_by_id),
        "modern roadmap/delivery capability sets differ",
        group,
    )
    validation.require(
        len(traces) == 16
        and len(trace_by_id) == 16
        and set(trace_by_id) == set(delivery_by_id),
        "modern delivery/trace capability sets must contain the same 16 unique IDs",
        group,
    )
    owner_counts: Counter[str] = Counter()
    for line, row in enumerate(deliveries, 2):
        source = roadmap_by_id.get(row["capability_id"])
        owner_counts[row["owner_session"]] += 1
        validation.require(
            source is not None
            and source.get("proposed_owner") == row["owner_session"],
            f"modern line {line}: owner differs from roadmap",
            group,
        )
        validation.require(
            row["owner_session"] in MODULES,
            f"modern line {line}: invalid owner session",
            group,
        )
        validation.require(
            row["delivery_wave"]
            in {"G3B_FOUNDATION", "G3C_EXPERIENCE", "G3D_OPTIMIZATION"},
            f"modern line {line}: invalid implementation wave",
            group,
        )
        validation.require(
            source is not None
            and source.get("generic_core") == "Y"
            and source.get("customization_layer") == row["activation_layers"],
            f"modern line {line}: generic/customization boundary drift",
            group,
        )
        validation.require(
            source is not None
            and source.get("code_gate") == "ROADMAP_G0_NOT_STARTED",
            f"modern line {line}: source roadmap state unexpectedly changed",
            group,
        )
        validation.require(
            all(
                row[column].strip()
                for column in (
                    "prerequisite_contracts",
                    "generic_core_delivery",
                    "g3_engineering_scope",
                    "acceptance_contract",
                )
            ),
            f"modern line {line}: delivery/acceptance contract incomplete",
            group,
        )
        validation.require(
            row["implementation_state"] == "NOT_STARTED_G3"
            and row["production_state"] == "NOT_AUTHORIZED_G6"
            and row["status"] == "PLANNED_REQUIRED_SCOPE",
            f"modern line {line}: implementation or production state overstated",
            group,
        )
        validation.require(
            resolve(row["source_roadmap_ref"])
            == (ROOT / "modern-hris-capability-roadmap.csv").resolve(),
            f"modern line {line}: wrong roadmap evidence",
            group,
        )
    validation.require(
        owner_counts
        == Counter(
            {
                "HRIS-HRM": 6,
                "HRIS-PER": 6,
                "HRIS-SYS": 3,
                "HRIS-TIM": 1,
            }
        ),
        f"modern capability owner distribution drift: {dict(owner_counts)}",
        group,
    )
    slice_ids: set[str] = set()
    owner_prompt = {
        "HRIS-HRM": "../session-prompts/01-cloudhr-hrm-session.md",
        "HRIS-PER": "../session-prompts/02-cloudhr-per-session.md",
        "HRIS-PAY": "../session-prompts/03-cloudhr-pay-session.md",
        "HRIS-TIM": "../session-prompts/04-cloudhr-tim-session.md",
        "HRIS-SYS": "../session-prompts/05-cloudhr-sys-session.md",
    }
    for line, row in enumerate(traces, 2):
        capability_id = row["capability_id"]
        delivery = delivery_by_id.get(capability_id)
        validation.require(
            delivery is not None
            and row["owner_session"] == delivery.get("owner_session"),
            f"modern trace line {line}: owner differs from delivery register",
            group,
        )
        validation.require(
            row["module_prompt_ref"] == owner_prompt.get(row["owner_session"]),
            f"modern trace line {line}: wrong module prompt binding",
            group,
        )
        slice_id = row["implementation_slice_id"]
        validation.require(
            bool(re.fullmatch(r"MOD-(?:HRM|PER|PAY|TIM|SYS)-[A-Z0-9-]+", slice_id))
            and slice_id not in slice_ids,
            f"modern trace line {line}: slice ID missing invalid or duplicated",
            group,
        )
        slice_ids.add(slice_id)
        validation.require(
            bool(split_pipe(row["menu_node_keys"]))
            and all(
                key.startswith("hcm.")
                for key in split_pipe(row["menu_node_keys"])
            ),
            f"modern trace line {line}: menu node keys are not canonical hcm keys",
            group,
        )
        validation.require(
            bool(split_pipe(row["data_contracts"]))
            and all(
                re.search(r"\.v\d+$", contract)
                for contract in split_pipe(row["data_contracts"])
            ),
            f"modern trace line {line}: data contracts must be explicitly versioned",
            group,
        )
        validation.require(
            bool(split_pipe(row["authorization_capabilities"]))
            and all(
                capability.startswith("hcm.")
                and re.fullmatch(r"[a-z0-9.-]+", capability)
                for capability in split_pipe(row["authorization_capabilities"])
            ),
            f"modern trace line {line}: authorization capability keys invalid",
            group,
        )
        api_events = split_pipe(row["api_event_contracts"])
        validation.require(
            bool(api_events)
            and any(value.startswith("/api/") for value in api_events)
            and any(re.search(r"\.v\d+$", value) for value in api_events),
            f"modern trace line {line}: API and event contracts are both required",
            group,
        )
        for route in (value for value in api_events if value.startswith("/api/")):
            expected_prefixes = {
                "HRIS-HRM": ("/api/people/v1/hris/",),
                "HRIS-PER": ("/api/people/v1/hris/performance/",),
                "HRIS-TIM": ("/api/time/v1/",),
                "HRIS-PAY": ("/api/payroll/v1/",),
                "HRIS-SYS": (
                    "/api/platform/v1/admin/hris/",
                    "/api/platform/v1/hris/",
                ),
            }[row["owner_session"]]
            validation.require(
                route.startswith(expected_prefixes),
                f"modern trace line {line}: route violates service-key convention: {route}",
                group,
            )
        owner_slug = str(MODULES.get(row["owner_session"], {}).get("slug", ""))
        evidence_values = (
            split_pipe(row["test_evidence_allocation"])
            + split_pipe(row["g4_acceptance_evidence"])
        )
        validation.require(
            len(evidence_values) >= 3
            and all(
                value.startswith(f"../session-evidence/{owner_slug}/g4/modern/")
                and value.endswith(".json")
                and ".." not in Path(value).parts[1:]
                for value in evidence_values
            ),
            f"modern trace line {line}: G4 test/acceptance evidence allocation invalid",
            group,
        )
        validation.require(
            row["state"] == "ALLOCATED_REQUIRED_NOT_STARTED",
            f"modern trace line {line}: readiness must not overstate implementation",
            group,
        )
        prompt_path = resolve(row["module_prompt_ref"])
        validation.require(
            prompt_path.is_file(),
            f"modern trace line {line}: module prompt missing",
            group,
        )
        if prompt_path.is_file():
            prompt_text = prompt_path.read_text(encoding="utf-8")
            validation.require(
                capability_id in prompt_text
                and "modern-capability-delivery-register.csv" in prompt_text
                and "modern-capability-trace-register.csv" in prompt_text,
                f"modern trace line {line}: module prompt lacks exact capability/register binding",
                group,
            )
    validation.details["modernCapabilities"] = {
        "count": len(deliveries),
        "traceCount": len(traces),
        "ownerCounts": dict(sorted(owner_counts.items())),
        "implementationState": "NOT_STARTED_G3",
        "scopeMeaning": "REQUIRED_FULL_PRODUCT_SCOPE_NOT_LEGACY_PARITY_COUNT",
    }


def run_modern_exact_contracts(validation: Validation) -> None:
    """Require exact, still-not-implemented contracts for all modern scope."""
    group = "modern-exact-contracts"
    contract_validator = HERE / "validate_modern_capability_contracts.py"
    authorization_validator = HERE / "validate_modern_capability_authorization.py"
    required_paths = [
        contract_validator,
        authorization_validator,
        HERE / "modern-capability-coding-contract-register.csv",
        HERE / "modern-menu-node-register.csv",
        HERE / "modern-capability-exact-schema-contracts.v1.json",
        HERE / "modern-capability-event-payload-contracts.v1.json",
        HERE / "modern-capability-authorization-register.csv",
        HERE / "07-modern-capability-coding-contract.md",
        ROOT / "session-evidence/hrm/g3-modern-capability-contracts.v1.json",
        ROOT / "session-evidence/per/g3-modern-capability-contracts.v1.json",
        ROOT / "session-evidence/tim/g3-modern-capability-contracts.v1.json",
        ROOT / "session-evidence/sys/g3-modern-capability-contracts.v1.json",
        ROOT / "session-evidence/sys/g2-physical-schema.sql",
        ROOT / "session-evidence/sys/g2-auth-physical-schema.sql",
        ROOT / "session-evidence/sys/g2-platform-physical-schema.sql",
        ROOT / "session-evidence/sys/validate_sys_service_local_migrations.py",
        ROOT / "session-evidence/pay/g3-modern-capability-consumer-contracts.v1.json",
    ]
    for path in required_paths:
        validation.require(
            path.is_file() and path.stat().st_size > 0,
            f"modern exact artifact missing: {path.relative_to(ROOT)}",
            group,
        )
    if not contract_validator.is_file() or not authorization_validator.is_file():
        return

    contract_counts: dict[str, int] = {}
    contract_output = ""
    try:
        completed = subprocess.run(
            [sys.executable, str(contract_validator), "--compact"],
            cwd=str(HERE),
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )
        contract_output = (completed.stdout + "\n" + completed.stderr).strip()
        match = re.search(
            r"MODERN_CAPABILITY_CONTRACTS=PASS\s+"
            r"capabilities=(?P<capabilities>\d+)\s+"
            r"operations=(?P<operations>\d+)\s+"
            r"menu_nodes=(?P<menu_nodes>\d+)\s+"
            r"auth_bindings=(?P<auth_bindings>\d+)\s+"
            r"state_machines=(?P<state_machines>\d+)\s+"
            r"transitions=(?P<transitions>\d+)\s+"
            r"events=(?P<events>\d+)\s+"
            r"tables=(?P<tables>\d+)\s+"
            r"pay_consumer_tables=(?P<pay_consumer_tables>\d+)\s+"
            r"acceptance_tests=(?P<acceptance_tests>\d+)\s+"
            r"implementation=NOT_STARTED_G3\s+production=NOT_AUTHORIZED_G6\b",
            contract_output,
        )
        if match:
            contract_counts = {
                key: int(value) for key, value in match.groupdict().items()
            }
        schema_match = re.search(
            r"MODERN_EXACT_SCHEMAS=PASS\s+"
            r"request_schemas=(?P<request_schemas>\d+)\s+"
            r"response_schemas=(?P<response_schemas>\d+)\s+"
            r"record_schemas=(?P<record_schemas>\d+)\s+"
            r"event_payload_schemas=(?P<event_payload_schemas>\d+)\s+"
            r"table_column_specs=(?P<table_column_specs>\d+)\s+"
            r"base_tables=(?P<base_tables>\d+)\s+"
            r"planned_tables=(?P<planned_tables>\d+)\s+"
            r"overlap=(?P<table_overlap>\d+)\b",
            contract_output,
        )
        if schema_match:
            contract_counts.update(
                {
                    key: int(value)
                    for key, value in schema_match.groupdict().items()
                }
            )
        validation.require(
            completed.returncode == 0
            and contract_counts.get("capabilities") == 16
            and contract_counts.get("menu_nodes") == 22
            and contract_counts.get("auth_bindings") == 48
            and contract_counts.get("request_schemas") == 100
            and contract_counts.get("response_schemas") == 38
            and contract_counts.get("record_schemas") == 17
            and contract_counts.get("event_payload_schemas") == 32
            and contract_counts.get("table_column_specs") == 56
            and contract_counts.get("base_tables") == 163
            and contract_counts.get("planned_tables") == 219
            and contract_counts.get("table_overlap") == 0
            and all(
                contract_counts.get(key, 0) > 0
                for key in (
                    "operations", "state_machines", "transitions", "events",
                    "tables", "pay_consumer_tables", "acceptance_tests",
                )
            ),
            "modern exact capability/schema validator did not close 16 capabilities / 100 requests / 38 responses / 32 events / base163+modern56=planned219 overlap0 / 22 menus / 48 auth bindings",
            group,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        validation.require(False, f"modern exact contract validator failed: {error}", group)

    authorization: dict[str, Any] = {}
    authorization_output = ""
    try:
        completed = subprocess.run(
            [sys.executable, str(authorization_validator), "--compact"],
            cwd=str(HERE),
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )
        authorization_output = (completed.stdout + "\n" + completed.stderr).strip()
        authorization = json.loads(completed.stdout)
        coverage = authorization.get("coverage", {})
        states = authorization.get("states", {})
        validation.require(
            completed.returncode == 0
            and authorization.get("schema")
            == "dwp.hris.modern-capability-authorization.v1"
            and authorization.get("status") == "PASS"
            and authorization.get("blockers") == []
            and coverage.get("modernProductCapabilityCount") == 16
            and coverage.get("exactCapabilityContractCount") == 16
            and coverage.get("sourceAuthorizationCapabilityCount") == 48
            and coverage.get("plannedAuthorizationOperationCount") == 48
            and coverage.get("plannedAtomicDutyCount") == 48
            and coverage.get("implementedPublicApiOperationsClaimed") == 0
            and coverage.get("modernImplementedPepOverlapCount") == 0
            and coverage.get("byModule")
            == {"HRIS-HRM": 18, "HRIS-PER": 18, "HRIS-TIM": 3, "HRIS-PAY": 0, "HRIS-SYS": 9}
            and states
            == {
                "authorization": "PLANNED_G3_AUTHORIZATION_NOT_IMPLEMENTED",
                "publicApiCoverage": "PLANNED_NOT_COUNTED_IN_IMPLEMENTED_PUBLIC_API",
                "production": "NOT_AUTHORIZED_G6",
            },
            f"modern authorization closure failed: {authorization.get('blockers', [])}",
            group,
        )
    except (OSError, subprocess.TimeoutExpired, json.JSONDecodeError) as error:
        validation.require(False, f"modern authorization validator failed: {error}", group)

    summary_rows = read_csv(
        HERE / "modern-capability-coding-contract-register.csv",
        validation,
        group,
    )
    structures = {
        row["session_id"]: row
        for row in read_csv(
            HERE / "module-structure-contract-register.csv",
            validation,
            group,
            STRUCTURE_HEADER,
        )
    }
    allocations = read_csv(
        HERE / "g3-file-allocation-register.csv",
        validation,
        group,
        G3_ALLOCATION_HEADER,
    )
    allocation_by_id = {row["allocation_id"]: row for row in allocations}
    ownership = read_csv(G0 / "file-ownership-register.csv", validation, group)

    def covered_by_any(path: str, globs: list[str]) -> bool:
        return any(_path_is_covered(path, glob) for glob in globs)

    allocation_classes = {
        "backend_root": "BACKEND_SOURCE",
        "backend_test_root": "BACKEND_TEST",
        "frontend_root": "FRONTEND_SOURCE",
        "frontend_test_root": "FRONTEND_SOURCE",
    }
    migration_allocation = {
        "HRIS-HRM": "G3-HRM-BE-MIGRATION",
        "HRIS-PER": "G3-PER-BE-MIGRATION",
        "HRIS-TIM": "G3-TIM-BE-MIGRATION",
        "HRIS-SYS": "G3-SYS-BE-MIGRATION",
    }
    allocation_checks = 0
    for row in summary_rows:
        session_id = row.get("owner_session", "")
        structure = structures.get(session_id, {})
        structure_roots = {
            "backend_root": split_pipe(structure.get("backend_source_roots", "")),
            "backend_test_root": split_pipe(structure.get("backend_test_roots", "")),
            "frontend_root": split_pipe(structure.get("frontend_feature_roots", "")),
            "frontend_test_root": split_pipe(structure.get("frontend_feature_roots", "")),
        }
        for field, artifact_class in allocation_classes.items():
            path = row.get(field, "")
            candidate_allocations = [
                allocation
                for allocation in allocations
                if allocation.get("session_id") == session_id
                and allocation.get("artifact_class") == artifact_class
            ]
            candidate_globs = [
                glob
                for allocation in candidate_allocations
                for glob in split_pipe(allocation.get("path_globs", ""))
            ]
            candidate_owners = [
                owner
                for owner in ownership
                if owner.get("session_id") == session_id
                and owner.get("status") == "ACTIVE_G3_CODE"
            ]
            validation.require(
                bool(path)
                and covered_by_any(path, structure_roots[field])
                and covered_by_any(path, candidate_globs)
                and any(
                    covered_by_any(path, split_pipe(owner.get("path_glob", "")))
                    for owner in candidate_owners
                ),
                f"{row.get('capability_id')}: {field} escapes module structure/G3/G0 allocation",
                group,
            )
            allocation_checks += 1
        migration = allocation_by_id.get(migration_allocation.get(session_id, ""), {})
        validation.require(
            bool(row.get("migration_file"))
            and migration.get("session_id") == session_id
            and migration.get("state") == "ALLOCATED_G3_NOT_IMPLEMENTED",
            f"{row.get('capability_id')}: migration is outside the reserved G3 allocation",
            group,
        )
        for field in ("openapi_file", "asyncapi_file"):
            validation.require(
                row.get(field, "").startswith("contracts/")
                and "G3-CTL-BE-CONTRACTS" in allocation_by_id,
                f"{row.get('capability_id')}: {field} is outside central contract allocation",
                group,
            )

    pay_consumer_path = (
        ROOT / "session-evidence/pay/g3-modern-capability-consumer-contracts.v1.json"
    )
    if pay_consumer_path.is_file():
        try:
            pay_payload = json.loads(pay_consumer_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            validation.require(
                False,
                f"PAY modern consumer contract is unreadable: {error}",
                group,
            )
            pay_payload = {}
        consumers = pay_payload.get("consumedModernCapabilities", [])
        if len(consumers) == 1:
            consumer = consumers[0]
            pay_structure = structures.get("HRIS-PAY", {})
            for field, structure_field, artifact_class in (
                ("backendRoot", "backend_source_roots", "BACKEND_SOURCE"),
                ("backendTestRoot", "backend_test_roots", "BACKEND_TEST"),
            ):
                path = consumer.get(field, "")
                allocation_globs = [
                    glob
                    for allocation in allocations
                    if allocation.get("session_id") == "HRIS-PAY"
                    and allocation.get("artifact_class") == artifact_class
                    for glob in split_pipe(allocation.get("path_globs", ""))
                ]
                pay_owners = [
                    owner
                    for owner in ownership
                    if owner.get("session_id") == "HRIS-PAY"
                    and owner.get("status") == "ACTIVE_G3_CODE"
                ]
                validation.require(
                    covered_by_any(path, split_pipe(pay_structure.get(structure_field, "")))
                    and covered_by_any(path, allocation_globs)
                    and any(
                        covered_by_any(path, split_pipe(owner.get("path_glob", "")))
                        for owner in pay_owners
                    ),
                    f"PAY compensation-plan consumer {field} escapes module structure/G3/G0 allocation",
                    group,
                )
                allocation_checks += 1
            validation.require(
                allocation_by_id.get("G3-PAY-BE-MIGRATION", {}).get("state")
                == "ALLOCATED_G3_NOT_IMPLEMENTED"
                and allocation_by_id.get("G3-PAY-BE-MIGRATION", {}).get("session_id")
                == "HRIS-PAY"
                and consumer.get("migrationFile")
                == "dwp-payroll-server/src/main/resources/db/migration/V49__pay_modern_compensation_plan_input.sql",
                "PAY compensation-plan input migration allocation drift",
                group,
            )
    validation.require(
        allocation_checks == 66,
        f"modern module structure/G3/G0 allocation coverage expected=66 actual={allocation_checks}",
        group,
    )

    validation.details["modernExactContracts"] = {
        "status": (
            "PASS"
            if validation.group_errors[group] == 0
            else "FAIL"
        ),
        "counts": contract_counts,
        "authorizationCoverage": authorization.get("coverage", {}),
        "implementationState": "NOT_STARTED_G3",
        "productionState": "NOT_AUTHORIZED_G6",
        "moduleStructureG3G0AllocationChecks": allocation_checks,
        "contractValidatorSha256": sha256(contract_validator),
        "authorizationValidatorSha256": sha256(authorization_validator),
        "contractOutputSha256": hashlib.sha256(contract_output.encode("utf-8")).hexdigest(),
        "authorizationOutputSha256": hashlib.sha256(authorization_output.encode("utf-8")).hexdigest(),
        "artifactSha256": {
            str(path.relative_to(ROOT)): sha256(path)
            for path in required_paths
            if path.is_file()
        },
    }


def _path_is_covered(path_token: str, owner_glob: str) -> bool:
    """Conservative textual containment for coordinator-owned path contracts."""
    if path_token == owner_glob:
        return True
    wildcard = min(
        [
            index
            for marker in ("*", "?", "[")
            if (index := owner_glob.find(marker)) >= 0
        ]
        or [len(owner_glob)]
    )
    prefix = owner_glob[:wildcard].rstrip("/")
    if not prefix:
        return False
    return path_token == prefix or path_token.startswith(prefix + "/")


def _baseline_reference_exists(root: Path, reference: str) -> bool:
    if not reference:
        return True
    path_text = reference.split("#", 1)[0]
    if not path_text:
        return True
    if any(marker in path_text for marker in ("*", "?", "[")):
        return bool(list(root.glob(path_text)))
    return (root / path_text).exists()


def validate_delivery_architecture(
    validation: Validation,
    roles: set[str],
    dependency_ids: set[str],
) -> None:
    """Validate executable module layout, allocations and shared DWP bindings."""
    group = "delivery-architecture"
    structures = read_csv(
        HERE / "module-structure-contract-register.csv",
        validation,
        group,
        STRUCTURE_HEADER,
    )
    allocations = read_csv(
        HERE / "g3-file-allocation-register.csv",
        HERE / "frontend-shared-presentation-binding-register.csv",
        HERE / "validate_frontend_shared_presentation_boundary.py",
        validation,
        group,
        G3_ALLOCATION_HEADER,
    )
    bindings = read_csv(
        HERE / "platform-integration-binding-register.csv",
        validation,
        group,
        PLATFORM_BINDING_HEADER,
    )
    ownership = read_csv(
        G0 / "file-ownership-register.csv",
        validation,
        group,
    )
    manifests = read_csv(
        ROOT / "five-session-execution-manifest.csv",
        validation,
        group,
    )
    baseline_rows = read_csv(
        G0 / "integration-baseline-manifest.csv",
        validation,
        group,
    )
    dependency_rows = read_csv(
        HERE / "module-dependency-register.csv",
        validation,
        group,
        DEPENDENCY_HEADER,
    )
    module_gate_rows = read_csv(
        HERE / "module-code-gate-register.csv",
        validation,
        group,
        MODULE_GATE_HEADER,
    )

    # ``required_upstream_dependencies`` means dependencies consumed from a
    # different owning module/platform.  An artifact allocation's
    # ``dependency_ids`` may additionally name contracts produced by that
    # module, but may not name unrelated contracts.  The union of all module
    # allocations must therefore equal its exact producer-or-consumer
    # involvement set; a mere "known ID" subset check would be fail-open.
    producer_to_session = {
        "HRM": "HRIS-HRM",
        "PER": "HRIS-PER",
        "TIM": "HRIS-TIM",
        "PAY": "HRIS-PAY",
        "SYS_AUTH": "HRIS-SYS",
        "SYS_PLATFORM": "HRIS-SYS",
        "SYS_HOME": "HRIS-SYS",
    }
    consumer_to_session = {
        "HRM": "HRIS-HRM",
        "PER": "HRIS-PER",
        "TIM": "HRIS-TIM",
        "PAY": "HRIS-PAY",
        "SYS": "HRIS-SYS",
        "SYS_HOME": "HRIS-SYS",
    }
    external_producers = {
        "COUNTRY_PACK",
        "CONNECTOR_PROVIDER",
        "DWP_APPROVAL",
        "DWP_NOTIFICATION",
        "DWP_AUDIT",
    }
    expected_upstream: dict[str, set[str]] = {
        session_id: set() for session_id in MODULES
    }
    expected_produced: dict[str, set[str]] = {
        session_id: set() for session_id in MODULES
    }
    expected_involvement: dict[str, set[str]] = {
        session_id: set() for session_id in MODULES
    }
    for line, row in enumerate(dependency_rows, 2):
        dependency_id = row["dependency_id"]
        producer_tokens = split_pipe(row["producer"])
        consumer_tokens = split_pipe(row["consumer"])
        unknown_producers = set(producer_tokens) - set(producer_to_session) - external_producers
        validation.require(
            not unknown_producers,
            f"dependency line {line}: unresolved producer tokens {sorted(unknown_producers)}",
            group,
        )
        producer_sessions = {
            producer_to_session[token]
            for token in producer_tokens
            if token in producer_to_session
        }
        if "ALL" in consumer_tokens:
            validation.require(
                consumer_tokens == ["ALL"],
                f"dependency line {line}: ALL cannot be mixed with named consumers",
                group,
            )
            consumer_sessions = set(MODULES)
        else:
            unknown_consumers = set(consumer_tokens) - set(consumer_to_session)
            validation.require(
                not unknown_consumers,
                f"dependency line {line}: unresolved consumer tokens {sorted(unknown_consumers)}",
                group,
            )
            consumer_sessions = {
                consumer_to_session[token]
                for token in consumer_tokens
                if token in consumer_to_session
            }
        validation.require(
            bool(producer_tokens) and bool(consumer_sessions),
            f"dependency line {line}: empty producer or consumer closure",
            group,
        )
        for session_id in producer_sessions:
            expected_produced[session_id].add(dependency_id)
            expected_involvement[session_id].add(dependency_id)
        for session_id in consumer_sessions:
            expected_involvement[session_id].add(dependency_id)
            if session_id not in producer_sessions:
                expected_upstream[session_id].add(dependency_id)

    gate_by_session = {
        row.get("session_id", ""): row for row in module_gate_rows
    }
    validation.require(
        len(module_gate_rows) == 5 and set(gate_by_session) == set(MODULES),
        "module code gate dependency closure requires exactly five sessions",
        group,
    )
    for session_id in MODULES:
        actual_upstream = set(
            split_pipe(
                gate_by_session.get(session_id, {}).get(
                    "required_upstream_dependencies",
                    "",
                )
            )
        )
        validation.require(
            actual_upstream == expected_upstream[session_id],
            f"{session_id}: required upstream dependencies drift "
            f"missing={sorted(expected_upstream[session_id] - actual_upstream)} "
            f"extra={sorted(actual_upstream - expected_upstream[session_id])}",
            group,
        )

    structure_by_session = {
        row.get("session_id", ""): row for row in structures
    }
    validation.require(
        len(structures) == 5
        and len(structure_by_session) == 5
        and set(structure_by_session) == set(MODULES),
        "module structure register must contain exactly the five sessions",
        group,
    )
    manifest_by_session = {
        row.get("session_id", ""): row for row in manifests
    }
    owner_by_id = {
        row.get("ownership_id", ""): row for row in ownership
    }
    for line, row in enumerate(structures, 2):
        session_id = row["session_id"]
        validation.require(
            row["state"] == "ALLOCATED_G3_NOT_IMPLEMENTED",
            f"structure line {line}: state overstates implementation",
            group,
        )
        validation.require(
            row["backend_layer_contract"] == EXPECTED_STRUCTURE_LAYERS["backend"]
            and row["backend_forbidden_dependencies"]
            == EXPECTED_BACKEND_FORBIDDEN_BY_SESSION.get(session_id)
            and row["frontend_layer_contract"] == EXPECTED_STRUCTURE_LAYERS["frontend"]
            and row["frontend_forbidden_dependencies"]
            == EXPECTED_STRUCTURE_LAYERS["frontend_forbidden"],
            f"structure line {line}: canonical import-layer contract drift",
            group,
        )
        source_roots = split_pipe(row["backend_source_roots"])
        test_roots = split_pipe(row["backend_test_roots"])
        frontend_roots = split_pipe(row["frontend_feature_roots"])
        validation.require(
            bool(source_roots and test_roots and frontend_roots)
            and all(
                not Path(value).is_absolute()
                and ".." not in Path(value).parts
                and not any(marker in value for marker in ("*", "?", "["))
                for value in source_roots + test_roots + frontend_roots
            ),
            f"structure line {line}: roots must be explicit safe repository paths",
            group,
        )
        manifest = manifest_by_session.get(session_id, {})
        allowed_backend = set(split_pipe(manifest.get("backend_allowed_globs", "")))
        allowed_frontend = set(split_pipe(manifest.get("frontend_allowed_globs", "")))
        validation.require(
            all(f"{root}/**" in allowed_backend for root in source_roots + test_roots),
            f"structure line {line}: backend roots are outside execution manifest",
            group,
        )
        validation.require(
            all(f"{root}/**" in allowed_frontend for root in frontend_roots),
            f"structure line {line}: frontend roots are outside execution manifest",
            group,
        )
        architecture_tests = split_pipe(row["architecture_test_allocation"])
        validation.require(
            len(architecture_tests) >= 2
            and any(value.endswith(".java") for value in architecture_tests)
            and any(value.endswith((".ts", ".tsx")) for value in architecture_tests),
            f"structure line {line}: backend and frontend architecture tests not allocated",
            group,
        )
        referenced_owners = split_pipe(row["g0_ownership_ids"])
        validation.require(
            bool(referenced_owners)
            and all(owner_id in owner_by_id for owner_id in referenced_owners),
            f"structure line {line}: missing G0 ownership reference",
            group,
        )
        for owner_id in referenced_owners:
            owner = owner_by_id.get(owner_id, {})
            validation.require(
                owner.get("session_id") == session_id
                and owner.get("status") == "ACTIVE_G3_CODE",
                f"structure line {line}: ownership {owner_id} is not active for {session_id}",
                group,
            )

    allocation_by_id = {
        row.get("allocation_id", ""): row for row in allocations
    }
    validation.require(
        len(allocations) == 31 and len(allocation_by_id) == 31,
        "G3 file allocation register must contain 31 unique allocations",
        group,
    )
    module_classes: dict[str, set[str]] = defaultdict(set)
    allocation_dependencies: dict[str, set[str]] = defaultdict(set)
    for line, row in enumerate(allocations, 2):
        session_id = row["session_id"]
        validation.require(
            session_id in MODULES or session_id == "CONTROL",
            f"allocation line {line}: invalid session",
            group,
        )
        expected_role = (
            "ROLE.INTEGRATION_CONTROL"
            if session_id == "CONTROL"
            else f"ROLE.HRIS_{session_id.removeprefix('HRIS-')}_ENGINEERING"
        )
        validation.require(
            row["writer_role"] == expected_role and row["writer_role"] in roles,
            f"allocation line {line}: writer role mismatch",
            group,
        )
        validation.require(
            row["state"] == "ALLOCATED_G3_NOT_IMPLEMENTED"
            and bool(row["scope_boundary"].strip()),
            f"allocation line {line}: state or boundary invalid",
            group,
        )
        deps = set(split_pipe(row["dependency_ids"]))
        validation.require(
            deps <= dependency_ids,
            f"allocation line {line}: unknown dependency IDs {sorted(deps - dependency_ids)}",
            group,
        )
        if session_id in MODULES:
            validation.require(
                deps <= expected_involvement[session_id],
                f"allocation line {line}: unrelated dependency IDs "
                f"{sorted(deps - expected_involvement[session_id])}",
                group,
            )
            allocation_dependencies[session_id].update(deps)
        path_tokens = split_pipe(row["path_globs"])
        validation.require(
            bool(path_tokens)
            and all(
                not Path(value).is_absolute()
                and ".." not in Path(value).parts
                and value != "**"
                for value in path_tokens
            ),
            f"allocation line {line}: unsafe or empty path allocation",
            group,
        )
        owner_ids = split_pipe(row["g0_ownership_ids"])
        validation.require(
            bool(owner_ids) and all(value in owner_by_id for value in owner_ids),
            f"allocation line {line}: G0 ownership reference missing",
            group,
        )
        owner_globs: list[str] = []
        for owner_id in owner_ids:
            owner = owner_by_id.get(owner_id, {})
            allowed_statuses = {"ACTIVE_G3_CODE", "ACTIVE_G3_RANGE"}
            validation.require(
                owner.get("status") in allowed_statuses
                and owner.get("session_id") == session_id,
                f"allocation line {line}: owner {owner_id} is not active for writer",
                group,
            )
            owner_globs.extend(split_pipe(owner.get("path_glob", "")))
        validation.require(
            all(
                any(_path_is_covered(path, owner_glob) for owner_glob in owner_globs)
                for path in path_tokens
            ),
            f"allocation line {line}: path escapes referenced G0 ownership",
            group,
        )
        if session_id in MODULES:
            module_classes[session_id].add(row["artifact_class"])
    for session_id in MODULES:
        validation.require(
            {"BACKEND_SOURCE", "BACKEND_TEST", "FRONTEND_SOURCE"}
            <= module_classes[session_id],
            f"{session_id}: source test and frontend allocations are all required",
            group,
        )
        validation.require(
            allocation_dependencies[session_id] == expected_involvement[session_id],
            f"{session_id}: allocation producer/consumer dependency closure drift "
            f"missing={sorted(expected_involvement[session_id] - allocation_dependencies[session_id])} "
            f"extra={sorted(allocation_dependencies[session_id] - expected_involvement[session_id])}",
            group,
        )
    required_control_allocations = {
        "G3-CTL-BE-ROOT-BUILD",
        "G3-CTL-TIM-SCAFFOLD",
        "G3-CTL-PAY-SCAFFOLD",
        "G3-CTL-BE-CONTRACTS",
        "G3-CTL-BE-GATEWAY",
        "G3-CTL-BE-RUNTIME",
        "G3-CTL-FE-MANIFEST",
        "G3-CTL-FE-ROUTES",
        "G3-CTL-FE-CONTRACTS",
        "G3-CTL-FE-RUNTIME",
    }
    validation.require(
        required_control_allocations <= set(allocation_by_id),
        "central build/settings/Docker/devctl/CI/deploy allocations are incomplete",
        group,
    )
    validation.details["moduleDependencyAllocationClosure"] = {
        session_id: {
            "requiredUpstream": sorted(expected_upstream[session_id]),
            "produced": sorted(expected_produced[session_id]),
            "producerOrConsumerInvolvement": sorted(expected_involvement[session_id]),
            "allocated": sorted(allocation_dependencies[session_id]),
            "status": (
                "PASS"
                if allocation_dependencies[session_id]
                == expected_involvement[session_id]
                else "FAIL"
            ),
        }
        for session_id in MODULES
    }

    binding_by_id = {
        row.get("binding_id", ""): row for row in bindings
    }
    validation.require(
        len(bindings) == 7
        and len(binding_by_id) == 7
        and set(binding_by_id) == set(EXPECTED_PLATFORM_BINDINGS),
        "platform integration binding register must contain PLAT-001..007",
        group,
    )
    backend_baseline = next(
        (
            Path(row["integration_worktree"])
            for row in baseline_rows
            if row.get("repository") == "DWP_BACKEND"
        ),
        Path("/__missing_backend_baseline__"),
    )
    for line, row in enumerate(bindings, 2):
        binding_id = row["binding_id"]
        validation.require(
            row["concern"] == EXPECTED_PLATFORM_BINDINGS.get(binding_id),
            f"platform binding line {line}: concern drift",
            group,
        )
        validation.require(
            row["baseline_state"] == EXPECTED_PLATFORM_BASELINE_STATES.get(binding_id),
            f"platform binding line {line}: baseline state is blank, arbitrary, or drifted",
            group,
        )
        validation.require(
            set(split_pipe(row["required_fields"]))
            == EXPECTED_PLATFORM_FIELDS.get(binding_id, set()),
            f"platform binding line {line}: exact required field set drift",
            group,
        )
        validation.require(
            row["status"] == "REQUIRED_G3_BINDING"
            and bool(row["g3_delivery"].strip())
            and "G6" in row["g6_boundary"],
            f"platform binding line {line}: G3/G6 boundary incomplete",
            group,
        )
        if EXPECTED_PLATFORM_BASELINE_STATES.get(binding_id, "").startswith("BASELINE"):
            for reference in (
                split_pipe(row["schema_reference"])
                + split_pipe(row["adapter_reference"])
                + split_pipe(row["test_reference"])
            ):
                validation.require(
                    _baseline_reference_exists(backend_baseline, reference),
                    f"platform binding line {line}: baseline evidence missing: {reference}",
                    group,
                )

    if backend_baseline.is_dir():
        event_schema_path = backend_baseline / "contracts/asyncapi/domain-events.yaml"
        event_java_path = (
            backend_baseline
            / "dwp-core/src/main/java/com/dwp/core/event/DomainEventEnvelope.java"
        )
        event_schema = (
            event_schema_path.read_text(encoding="utf-8")
            if event_schema_path.is_file()
            else ""
        )
        envelope_block = (
            event_schema.split("    DomainEventEnvelope:", 1)[1]
            .split("    WorkplaceBookingEventEnvelope:", 1)[0]
            if "    DomainEventEnvelope:" in event_schema
            and "    WorkplaceBookingEventEnvelope:" in event_schema
            else ""
        )
        schema_required = set(
            re.findall(r"^\s{8}-\s+([A-Za-z][A-Za-z0-9]*)\s*$", envelope_block, re.M)
        )
        schema_properties = set(
            re.findall(r"^\s{8}([A-Za-z][A-Za-z0-9]*):\s*$", envelope_block, re.M)
        )
        event_required = EXPECTED_PLATFORM_FIELDS["PLAT-001"]
        validation.require(
            schema_required == event_required - {"tenantId"}
            and event_required <= schema_properties,
            "DWP DomainEventEnvelope schema required/properties drift",
            group,
        )
        event_java = (
            event_java_path.read_text(encoding="utf-8")
            if event_java_path.is_file()
            else ""
        )
        validation.require(
            all(field in event_java for field in event_required)
            and "DomainEventEnvelope create(" in event_java,
            "DWP Java event adapter does not expose the exact HRIS envelope fields",
            group,
        )
        gateway_path = backend_baseline / "dwp-gateway/src/main/resources/application.yml"
        gateway = gateway_path.read_text(encoding="utf-8") if gateway_path.is_file() else ""
        validation.require(
            "Path=/api/people/**" in gateway
            and "Path=/api/platform/**" in gateway
            and "StripPrefix=2" in gateway,
            "DWP gateway service-key/StripPrefix baseline missing",
            group,
        )
        notification_path = (
            backend_baseline
            / "dwp-notification-server/src/main/java/com/dwp/services/notification/integration/NotificationDomainEventTranslator.java"
        )
        notification = (
            notification_path.read_text(encoding="utf-8")
            if notification_path.is_file()
            else ""
        )
        validation.require(
            "DomainEventEnvelope" in notification
            and 'event.data().get("notificationIntents")' in notification
            and "validateEnvelope(event)" in notification,
            "notification adapter is not bound to canonical event envelope",
            group,
        )
        approval_path = backend_baseline / "contracts/openapi/approval.json"
        approval = approval_path.read_text(encoding="utf-8") if approval_path.is_file() else ""
        validation.require(
            '"/v1/requests"' in approval
            and '"/v1/tasks/{taskId}/decisions"' in approval,
            "shared approval OpenAPI request/decision contract missing",
            group,
        )
        audit_path = backend_baseline / "dwp-audit/src/main/java/com/dwp/audit/AuditEvent.java"
        audit = audit_path.read_text(encoding="utf-8") if audit_path.is_file() else ""
        validation.require(
            all(field in audit for field in EXPECTED_PLATFORM_FIELDS["PLAT-005"])
            and "sanitized()" in audit,
            "shared audit contract fields or minimization guard missing",
            group,
        )
    validation.details["deliveryArchitecture"] = {
        "moduleStructures": len(structures),
        "g3Allocations": len(allocations),
        "platformBindings": len(bindings),
        "implementationState": "ALLOCATED_G3_NOT_IMPLEMENTED",
        "routeConvention": "/api/{service}/v1/** -> StripPrefix=2 -> /v1/**",
    }


def validate_gate_separation(
    validation: Validation,
    roles: set[str],
    dependency_ids: set[str],
    module_counts: dict[str, dict[str, int]],
) -> None:
    group = "gate-separation"
    dependency_rows = read_csv(
        HERE / "module-dependency-register.csv",
        validation,
        group,
        DEPENDENCY_HEADER,
    )
    session_by_token = {
        "HRM": "HRIS-HRM",
        "PER": "HRIS-PER",
        "TIM": "HRIS-TIM",
        "PAY": "HRIS-PAY",
        "SYS": "HRIS-SYS",
        "SYS_HOME": "HRIS-SYS",
        "SYS_AUTH": "HRIS-SYS",
        "SYS_PLATFORM": "HRIS-SYS",
    }
    expected_dependencies: defaultdict[str, set[str]] = defaultdict(set)
    for line, dependency in enumerate(dependency_rows, 2):
        consumer_tokens = split_pipe(dependency["consumer"])
        if consumer_tokens == ["ALL"]:
            consumers = set(MODULES)
        else:
            consumers = {
                session_by_token[token]
                for token in consumer_tokens
                if token in session_by_token
            }
            validation.require(
                len(consumers) == len(consumer_tokens),
                f"dependency line {line}: unknown consumer token",
                group,
            )
        producer_session = session_by_token.get(dependency["producer"])
        for consumer in consumers:
            if consumer != producer_session:
                expected_dependencies[consumer].add(dependency["dependency_id"])

    gate_rows = read_csv(
        HERE / "module-code-gate-register.csv",
        validation,
        group,
        MODULE_GATE_HEADER,
    )
    by_session = {row["session_id"]: row for row in gate_rows}
    validation.require(
        set(by_session) == set(MODULES) and len(by_session) == len(gate_rows),
        "module gate register must contain one row per module",
        group,
    )
    for session_id, spec in MODULES.items():
        row = by_session.get(session_id)
        if row is None:
            continue
        validation.require(row["module"] == spec["slug"], f"{session_id}: wrong slug", group)
        validation.require(
            row["source_parent_count"].isdigit()
            and int(row["source_parent_count"]) == module_counts[session_id]["parents"],
            f"{session_id}: parent count drift",
            group,
        )
        validation.require(
            row["source_child_count"].isdigit()
            and int(row["source_child_count"]) == module_counts[session_id]["children"],
            f"{session_id}: child count drift",
            group,
        )
        for column in (
            "g1_characterization",
            "g1_child_trace",
            "g1_decision_log",
            "g2_validator",
            "g2_contract_root",
        ):
            validation.require(
                resolve(row[column]).exists(),
                f"{session_id}: missing {column} {row[column]}",
                group,
            )
        validation.require(
            row["g2_validator"] == spec["validator"],
            f"{session_id}: wrong validator",
            group,
        )
        upstream = set(split_pipe(row["required_upstream_dependencies"]))
        validation.require(
            upstream == expected_dependencies[session_id],
            f"{session_id}: dependency set drift; missing="
            f"{sorted(expected_dependencies[session_id] - upstream)} extra="
            f"{sorted(upstream - expected_dependencies[session_id])}",
            group,
        )
        validation.require(
            row["backend_baseline_id"] == "BASE-BACKEND"
            and row["frontend_baseline_id"] == "BASE-FRONTEND",
            f"{session_id}: wrong baseline references",
            group,
        )
        validation.require(
            row["gate_target"] == "VALIDATOR_CONTROLLED"
            and row["gate_condition"] == "ALL_REQUIRED_CHECKS_PASS",
            f"{session_id}: module register claims static code authority",
            group,
        )
        validation.require(
            row["implementation_state"] == "NOT_STARTED_G3",
            f"{session_id}: implementation completion is overstated",
            group,
        )
        validation.require(
            row["production_state"] == "NOT_AUTHORIZED_G6",
            f"{session_id}: production state is overstated",
            group,
        )
        validation.require(
            row["owner_role"] in roles,
            f"{session_id}: unknown gate owner",
            group,
        )
        validation.require(
            "core" in row["scope_boundary"].lower(),
            f"{session_id}: generic-core boundary absent",
            group,
        )

    activation_rows = read_csv(
        HERE / "activation-gate-register.csv",
        validation,
        group,
        ACTIVATION_HEADER,
    )
    by_activation = {row["activation_id"]: row for row in activation_rows}
    validation.require(
        set(by_activation) == EXPECTED_ACTIVATIONS
        and len(by_activation) == len(activation_rows),
        "G6 activation set is incomplete or duplicated",
        group,
    )
    for line, row in enumerate(activation_rows, 2):
        validation.require(
            row["owner_role"] in roles,
            f"activation line {line}: unknown owner",
            group,
        )
        validation.require(
            row["named_binding_required"] == "YES",
            f"activation line {line}: named binding not required",
            group,
        )
        validation.require(row["gate"] == "G6", f"activation line {line}: wrong gate", group)
        validation.require(
            row["status"] == "DEFERRED_G6_NOT_CORE_BLOCKER",
            f"activation line {line}: incorrect deferred state",
            group,
        )
        validation.require(
            row["core_code_effect"] == "DOES_NOT_BLOCK_G3_CORE",
            f"activation line {line}: incorrectly blocks generic core",
            group,
        )
        validation.require(
            row["production_effect"].startswith("BLOCKS_"),
            f"activation line {line}: production fail-closed effect absent",
            group,
        )
        validation.require(
            bool(row["required_real_evidence"].strip())
            and bool(row["core_test_substitute"].strip()),
            f"activation line {line}: real/substitute boundary incomplete",
            group,
        )
        for reference in split_pipe(row["evidence"]):
            validation.require(
                resolve(reference).exists(),
                f"activation line {line}: missing evidence {reference}",
                group,
            )

    external_rows = read_csv(
        HERE / "external-input-classification-register.csv",
        validation,
        group,
        EXTERNAL_INPUT_HEADER,
    )
    by_input = {row["input_id"]: row for row in external_rows}
    validation.require(
        set(by_input) == EXPECTED_EXTERNAL_INPUTS
        and len(by_input) == len(external_rows),
        "external-input classification set is incomplete or duplicated",
        group,
    )
    for line, row in enumerate(external_rows, 2):
        validation.require(
            row["required_for_g3_core"] == "NO",
            f"external input line {line}: incorrectly blocks G3 core",
            group,
        )
        validation.require(
            row["required_for_g6_activation"] in {"YES", "CONDITIONAL"},
            f"external input line {line}: invalid G6 applicability",
            group,
        )
        validation.require(
            row["status"] == "CLASSIFIED_NOT_CORE_BLOCKER",
            f"external input line {line}: wrong status",
            group,
        )
        validation.require(
            bool(row["applicability"].strip())
            and bool(row["core_substitute_or_rule"].strip()),
            f"external input line {line}: classification rationale incomplete",
            group,
        )
        for reference in split_pipe(row["evidence"]):
            validation.require(
                resolve(reference).exists(),
                f"external input line {line}: missing evidence {reference}",
                group,
            )
    validation.details["gateSeparation"] = {
        "moduleCodeGates": len(gate_rows),
        "moduleTarget": "VALIDATOR_CONTROLLED_UNTIL_AUTHORITATIVE_LIVE_OPEN",
        "implementationState": "NOT_STARTED_G3",
        "activationGates": len(activation_rows),
        "activationState": "DEFERRED_G6_NOT_CORE_BLOCKER",
        "externalInputsClassified": len(external_rows),
        "productionState": "NOT_AUTHORIZED_G6",
    }


def validate_module_validators(validation: Validation) -> None:
    group = "module-validators"
    results: dict[str, dict[str, Any]] = {}
    for session_id, spec in MODULES.items():
        path = resolve(str(spec["validator"]))
        validation.require(path.is_file(), f"{session_id}: validator missing {path}", group)
        if not path.is_file():
            continue
        try:
            completed = subprocess.run(
                [sys.executable, str(path)],
                cwd=str(path.parent),
                capture_output=True,
                text=True,
                timeout=300,
                check=False,
            )
            output = completed.stdout + completed.stderr
            passed = (
                completed.returncode == 0
                and re.search(str(spec["pass_marker"]), output) is not None
            )
            validation.require(
                passed,
                f"{session_id}: module validator failed rc={completed.returncode}",
                group,
            )
            validation.require(
                "code_gate=blocked" not in output.lower(),
                f"{session_id}: validator still declares the core code gate blocked",
                group,
            )
            result_lines = [
                line.strip()
                for line in output.splitlines()
                if "PASS" in line or "FAIL" in line or "READINESS=" in line
            ]
            results[session_id] = {
                "status": "PASS" if passed else "FAIL",
                "returnCode": completed.returncode,
                "outputSha256": hashlib.sha256(
                    output.encode("utf-8")
                ).hexdigest(),
                "summary": result_lines[-1] if result_lines else "NO_SUMMARY_MARKER",
            }
        except subprocess.TimeoutExpired:
            validation.require(False, f"{session_id}: validator timeout", group)
            results[session_id] = {
                "status": "FAIL",
                "returnCode": None,
                "summary": "TIMEOUT",
            }
    validation.details["moduleValidators"] = results


def validate_baseline_and_commands(
    validation: Validation,
    check_live: bool,
) -> dict[str, dict[str, str]]:
    group = "baseline-command-evidence"
    manifest_rows = read_csv(
        G0 / "integration-baseline-manifest.csv",
        validation,
        group,
    )
    required_columns = {
        "baseline_id",
        "repository",
        "integration_worktree",
        "integration_branch",
        "integration_head_sha",
        "integration_tree_sha",
        "integration_dirty_count",
        "validation_state",
        "session_create_allowed",
        "captured_at",
    }
    if manifest_rows:
        validation.require(
            required_columns <= set(manifest_rows[0]),
            "baseline manifest columns incomplete",
            group,
        )
    by_repo = {row.get("repository", ""): row for row in manifest_rows}
    validation.require(
        set(by_repo) == {"DWP_BACKEND", "DWP_FRONTEND"} and len(manifest_rows) == 2,
        "baseline manifest must contain backend and frontend exactly once",
        group,
    )
    for repository, row in by_repo.items():
        validation.require(
            bool(SHA40.fullmatch(row.get("integration_head_sha", ""))),
            f"{repository}: invalid HEAD",
            group,
        )
        validation.require(
            bool(SHA40.fullmatch(row.get("integration_tree_sha", ""))),
            f"{repository}: invalid tree",
            group,
        )
        validation.require(
            row.get("integration_dirty_count") == "0",
            f"{repository}: dirty count is not zero",
            group,
        )
        state = row.get("validation_state", "").upper()
        validation.require(
            state == "SEALED_ENTRY_VALIDATOR_CONTROLLED",
            f"{repository}: baseline state is not a validator-controlled entry seal ({state})",
            group,
        )
        validation.require(
            row.get("session_create_allowed") == "VALIDATOR_CONTROLLED",
            f"{repository}: session creation authority is not validator-controlled",
            group,
        )
        validation.require(
            parse_time(row.get("captured_at", "")) is not None,
            f"{repository}: invalid capture time",
            group,
        )
        if check_live:
            path = Path(row["integration_worktree"])
            validation.require(
                path.is_dir(),
                f"{repository}: integration worktree missing",
                group,
            )
            if path.is_dir():
                try:
                    validation.require(
                        git(path, "rev-parse", "HEAD") == row["integration_head_sha"],
                        f"{repository}: integration HEAD drift",
                        group,
                    )
                    validation.require(
                        git(path, "rev-parse", "HEAD^{tree}") == row["integration_tree_sha"],
                        f"{repository}: integration tree drift",
                        group,
                    )
                    validation.require(
                        not git(path, "status", "--porcelain=v1", "--untracked-files=all"),
                        f"{repository}: integration worktree dirty",
                        group,
                    )
                    validation.require(
                        git(path, "branch", "--show-current") == row["integration_branch"],
                        f"{repository}: integration branch drift",
                        group,
                    )
                except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
                    validation.require(
                        False,
                        f"{repository}: Git inspection failed: {error}",
                        group,
                    )

    worktree_rows = read_csv(
        G0 / "worktree-branch-register.csv",
        validation,
        group,
    )
    worktree_required = {
        "record_id",
        "session_id",
        "repository",
        "worktree_path",
        "branch",
        "head_sha",
        "approved_integration_sha",
        "clean_required",
        "observed_dirty_count",
        "state",
    }
    if worktree_rows:
        validation.require(
            worktree_required <= set(worktree_rows[0]),
            "worktree register columns incomplete",
            group,
        )
    validation.require(
        len(worktree_rows) == 12,
        f"worktree row count {len(worktree_rows)} != 12",
        group,
    )
    validation.require(
        len({row.get("record_id") for row in worktree_rows}) == len(worktree_rows),
        "duplicate worktree record",
        group,
    )
    expected_pairs = {
        (session, repository)
        for session in MODULES
        for repository in ("DWP_BACKEND", "DWP_FRONTEND")
    }
    observed_pairs = {
        (row.get("session_id"), row.get("repository"))
        for row in worktree_rows
        if row.get("session_id") != "CONTROL"
    }
    validation.require(
        observed_pairs == expected_pairs,
        "module worktree matrix is incomplete",
        group,
    )
    for line, row in enumerate(worktree_rows, 2):
        repository = row.get("repository", "")
        baseline = by_repo.get(repository)
        validation.require(
            baseline is not None,
            f"worktree line {line}: unknown repository",
            group,
        )
        if baseline is None:
            continue
        validation.require(
            row.get("head_sha") == baseline["integration_head_sha"],
            f"worktree line {line}: HEAD differs from approved baseline",
            group,
        )
        validation.require(
            row.get("approved_integration_sha") == baseline["integration_head_sha"],
            f"worktree line {line}: approved SHA drift",
            group,
        )
        validation.require(
            row.get("clean_required") == "YES"
            and row.get("observed_dirty_count") == "0",
            f"worktree line {line}: clean contract absent",
            group,
        )
        state = row.get("state", "").upper()
        validation.require(
            state == "SEALED_ENTRY_VALIDATOR_CONTROLLED",
            f"worktree line {line}: entry seal is not validator-controlled",
            group,
        )
        if check_live:
            path = Path(row["worktree_path"])
            validation.require(
                path.is_dir(),
                f"worktree line {line}: path missing",
                group,
            )
            if path.is_dir():
                try:
                    validation.require(
                        git(path, "rev-parse", "HEAD") == row["head_sha"],
                        f"worktree line {line}: live HEAD drift",
                        group,
                    )
                    validation.require(
                        not git(path, "status", "--porcelain=v1", "--untracked-files=all"),
                        f"worktree line {line}: live dirty state",
                        group,
                    )
                    validation.require(
                        git(path, "branch", "--show-current") == row["branch"],
                        f"worktree line {line}: live branch drift",
                        group,
                    )
                except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
                    validation.require(
                        False,
                        f"worktree line {line}: Git inspection failed: {error}",
                        group,
                    )

    build_rows = read_csv(G0 / "build-matrix.csv", validation, group)
    build_required = {
        "check_id",
        "repository",
        "working_directory",
        "command",
        "required_for_g0_close",
        "result_status",
        "evidence_reference",
    }
    if build_rows:
        validation.require(
            build_required <= set(build_rows[0]),
            "build matrix columns incomplete",
            group,
        )
    required_target: dict[str, dict[str, dict[str, str]]] = {
        "backend": {},
        "frontend": {},
    }
    for line, row in enumerate(build_rows, 2):
        if row.get("required_for_g0_close") == "YES":
            validation.require(
                row.get("result_status") == "PASS",
                f"build line {line}: required check {row.get('check_id')} is not PASS",
                group,
            )
            validation.require(
                bool(row.get("evidence_reference", "").strip()),
                f"build line {line}: required check lacks evidence",
                group,
            )
            if row.get("repository") == "DWP_BACKEND":
                required_target["backend"][row["check_id"]] = row
            elif row.get("repository") == "DWP_FRONTEND":
                required_target["frontend"][row["check_id"]] = row

    command_details: dict[str, Any] = {}
    for group_name, repository in (
        ("backend", "DWP_BACKEND"),
        ("frontend", "DWP_FRONTEND"),
    ):
        path = G0 / f"target-command-evidence-{group_name}.json"
        validation.require(
            path.is_file(),
            f"missing command evidence {path.name}",
            group,
        )
        if not path.is_file():
            continue
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as error:
            validation.require(False, f"invalid {path.name}: {error}", group)
            continue
        top_level_required = {
            "schema",
            "group",
            "generated_at",
            "value_policy",
            "capture_script_sha256",
            "build_matrix_sha256",
            "baseline_manifest_sha256",
            "checks",
            "all_passed",
            "failed_check_ids",
        }
        validation.require(
            top_level_required <= set(payload),
            f"{group_name}: command evidence fields incomplete",
            group,
        )
        validation.require(
            payload.get("schema") == "dwp.hris.g0.command-evidence.v2",
            f"{group_name}: wrong evidence schema",
            group,
        )
        capture_script = G0 / "capture_target_command_evidence.py"
        validation.require(
            capture_script.is_file(),
            f"{group_name}: capture script missing",
            group,
        )
        validation.require(
            payload.get("group") == group_name
            and capture_script.is_file()
            and payload.get("capture_script_sha256") == sha256(capture_script)
            and payload.get("build_matrix_sha256") == sha256(G0 / "build-matrix.csv")
            and payload.get("baseline_manifest_sha256")
            == sha256(G0 / "integration-baseline-manifest.csv"),
            f"{group_name}: capture script or input registry attestation drift",
            group,
        )
        validation.require(
            payload.get("value_policy")
            == "NO_RAW_COMMAND_OUTPUT_STORED_ONLY_SHA256_AND_BYTE_COUNT",
            f"{group_name}: raw-output retention policy drift",
            group,
        )
        validation.require(
            payload.get("all_passed") is True
            and payload.get("failed_check_ids") == [],
            f"{group_name}: command evidence reports failure",
            group,
        )
        evidence_checks = payload.get("checks", [])
        by_check = {item.get("check_id"): item for item in evidence_checks}
        validation.require(
            len(by_check) == len(evidence_checks),
            f"{group_name}: duplicate evidence check",
            group,
        )
        validation.require(
            set(by_check) == set(required_target[group_name]),
            f"{group_name}: evidence check set differs from required build checks",
            group,
        )
        baseline = by_repo.get(repository)
        for check_id, build_row in required_target[group_name].items():
            item = by_check.get(check_id)
            if item is None or baseline is None:
                continue
            item_required = {
                "check_id",
                "repository",
                "baseline_head_sha",
                "baseline_tree_sha",
                "working_directory",
                "runtime",
                "command_sha256",
                "started_at",
                "ended_at",
                "duration_seconds",
                "exit_code",
                "combined_output_sha256",
                "combined_output_bytes",
                "declared_summary",
                "observed_pre_head_sha",
                "observed_pre_tree_sha",
                "observed_pre_branch",
                "observed_pre_porcelain_count",
                "observed_pre_porcelain_sha256",
                "observed_post_head_sha",
                "observed_post_tree_sha",
                "observed_post_branch",
                "observed_post_porcelain_count",
                "observed_post_porcelain_sha256",
            }
            validation.require(
                item_required <= set(item),
                f"{check_id}: command evidence fields incomplete",
                group,
            )
            validation.require(
                item.get("exit_code") == 0,
                f"{check_id}: exit code is not zero",
                group,
            )
            validation.require(
                item.get("repository") == repository,
                f"{check_id}: wrong repository",
                group,
            )
            validation.require(
                item.get("working_directory") == build_row["working_directory"],
                f"{check_id}: working directory drift",
                group,
            )
            validation.require(
                item.get("baseline_head_sha") == baseline["integration_head_sha"],
                f"{check_id}: baseline HEAD drift",
                group,
            )
            validation.require(
                item.get("baseline_tree_sha") == baseline["integration_tree_sha"],
                f"{check_id}: baseline tree drift",
                group,
            )
            expected_branch = baseline["integration_branch"]
            empty_porcelain = hashlib.sha256(b"").hexdigest()
            for phase in ("pre", "post"):
                validation.require(
                    item.get(f"observed_{phase}_head_sha")
                    == baseline["integration_head_sha"]
                    and item.get(f"observed_{phase}_tree_sha")
                    == baseline["integration_tree_sha"]
                    and item.get(f"observed_{phase}_branch") == expected_branch,
                    f"{check_id}: observed {phase} Git identity differs from baseline",
                    group,
                )
                validation.require(
                    item.get(f"observed_{phase}_porcelain_count") == 0
                    and item.get(f"observed_{phase}_porcelain_sha256")
                    == empty_porcelain,
                    f"{check_id}: observed {phase} worktree is not attested clean",
                    group,
                )
            validation.require(
                item.get("working_directory") == baseline["integration_worktree"],
                f"{check_id}: command did not run in the pinned integration worktree",
                group,
            )
            command_digest = hashlib.sha256(
                build_row["command"].encode("utf-8")
            ).hexdigest()
            validation.require(
                item.get("command_sha256") == command_digest,
                f"{check_id}: command digest drift",
                group,
            )
            validation.require(
                item.get("declared_summary") == build_row["evidence_reference"],
                f"{check_id}: declared summary drift",
                group,
            )
            validation.require(
                bool(SHA256.fullmatch(str(item.get("combined_output_sha256", "")))),
                f"{check_id}: invalid output digest",
                group,
            )
            validation.require(
                isinstance(item.get("combined_output_bytes"), int)
                and item["combined_output_bytes"] >= 0,
                f"{check_id}: invalid output byte count",
                group,
            )
            started = parse_time(str(item.get("started_at", "")))
            ended = parse_time(str(item.get("ended_at", "")))
            validation.require(
                started is not None and ended is not None and ended >= started,
                f"{check_id}: invalid execution time interval",
                group,
            )
        generated = parse_time(str(payload.get("generated_at", "")))
        captured = parse_time(baseline["captured_at"]) if baseline else None
        validation.require(
            generated is not None,
            f"{group_name}: invalid evidence time",
            group,
        )
        if generated is not None and captured is not None:
            validation.require(
                generated >= captured,
                f"{group_name}: evidence predates baseline capture",
                group,
            )
        command_details[group_name] = {
            "status": "PASS" if payload.get("all_passed") is True else "FAIL",
            "checks": len(evidence_checks),
            "generatedAt": payload.get("generated_at"),
            "sha256": sha256(path),
            "captureScriptSha256": payload.get("capture_script_sha256"),
        }

    sbom_expectations = {
        "CHK-BE-SBOM": (
            Path(by_repo["DWP_BACKEND"]["integration_worktree"])
            / "build/reports/cyclonedx/bom.json"
        ),
        "CHK-FE-SBOM": (
            Path(by_repo["DWP_FRONTEND"]["integration_worktree"])
            / "build/reports/sbom/frontend.cdx.json"
        ),
    }
    sbom_details: dict[str, Any] = {}
    for check_id, artifact in sbom_expectations.items():
        build_row = (
            required_target["backend"].get(check_id)
            or required_target["frontend"].get(check_id)
        )
        validation.require(
            build_row is not None and artifact.is_file(),
            f"{check_id}: generated CycloneDX artifact missing",
            group,
        )
        if build_row is None or not artifact.is_file():
            continue
        try:
            digest, components, dependencies, bom_format, spec_version = (
                canonical_cyclonedx_graph_sha256(artifact)
            )
        except (OSError, json.JSONDecodeError, TypeError) as error:
            validation.require(False, f"{check_id}: unreadable CycloneDX artifact: {error}", group)
            continue
        summary = build_row["evidence_reference"]
        match = re.search(
            r"cyclonedx-([^:]+):components-(\d+):dependencies-(\d+):"
            r"canonical-graph-sha256-([0-9a-f]{64})",
            summary,
        )
        validation.require(
            match is not None,
            f"{check_id}: canonical graph attestation missing",
            group,
        )
        if match is not None:
            validation.require(
                bom_format == "CycloneDX"
                and spec_version == match.group(1)
                and components == int(match.group(2))
                and dependencies == int(match.group(3))
                and digest == match.group(4),
                f"{check_id}: actual canonical graph differs from attestation",
                group,
            )
        sbom_details[check_id] = {
            "artifact": str(artifact),
            "canonicalGraphSha256": digest,
            "components": components,
            "dependencies": dependencies,
            "specVersion": spec_version,
        }
    validation.details["sbomArtifacts"] = sbom_details

    validation.details["baselines"] = {
        repository: {
            "head": row.get("integration_head_sha"),
            "tree": row.get("integration_tree_sha"),
            "state": row.get("validation_state"),
        }
        for repository, row in by_repo.items()
    }
    validation.details["commandEvidence"] = command_details
    return by_repo


def extract_range(row: dict[str, str]) -> tuple[int, int] | None:
    for start_key, end_key in (
        ("range_start", "range_end"),
        ("allocated_from", "allocated_to"),
        ("start_version", "end_version"),
        ("version_from", "version_to"),
    ):
        if row.get(start_key, "").isdigit() and row.get(end_key, "").isdigit():
            return int(row[start_key]), int(row[end_key])
    allocated = row.get("allocated_version", "")
    match = re.fullmatch(
        r"\s*V?(\d+)\s*(?:-|:|\.\.)\s*V?(\d+)\s*",
        allocated,
        re.I,
    )
    if match:
        return int(match.group(1)), int(match.group(2))
    joined = " ".join(row.values())
    for pattern in (
        r"(?:RANGE|VERSIONS?)?[_ :=-]*V?(\d+)[_-](?:TO[_-]?)?V?(\d+)",
        r"V?(\d+)\s*\.\.\s*V?(\d+)",
    ):
        match = re.search(pattern, joined, re.I)
        if match:
            return int(match.group(1)), int(match.group(2))
    return None


def validate_migration_ranges(
    validation: Validation,
    baselines: dict[str, dict[str, str]],
) -> None:
    group = "migration-ranges"
    rows = read_csv(
        G0 / "migration-allocation-register.csv",
        validation,
        group,
    )
    required = {"service", "baseline_commit", "session_id", "state", "code_gate"}
    if rows:
        validation.require(
            required <= set(rows[0]),
            "migration register columns incomplete",
            group,
        )
    observed: dict[str, tuple[int, int]] = {}
    ranges_by_stream: defaultdict[str, list[tuple[int, int, str]]] = defaultdict(list)
    backend_head = baselines.get("DWP_BACKEND", {}).get("integration_head_sha")
    for line, row in enumerate(rows, 2):
        allocation_range = extract_range(row)
        if allocation_range is None:
            continue
        allocation_id = row.get("allocation_id", "")
        if allocation_id in EXPECTED_MIGRATION_RANGES:
            service, session_id, migration_dir, expected_range = (
                EXPECTED_MIGRATION_RANGES[allocation_id]
            )
            validation.require(
                allocation_id not in observed,
                f"migration line {line}: duplicate allocation {allocation_id}",
                group,
            )
            observed[allocation_id] = allocation_range
            validation.require(
                row.get("service") == service
                and row.get("session_id") == session_id
                and row.get("migration_dir") == migration_dir
                and allocation_range == expected_range,
                f"migration line {line}: range {allocation_range} "
                f"!= {EXPECTED_MIGRATION_RANGES[allocation_id]}",
                group,
            )
            validation.require(
                row.get("baseline_commit") == MIGRATION_SUCCESSOR_BASELINE_SHA,
                f"migration line {line}: C1 successor baseline commit drift",
                group,
            )
            state = row.get("state", "").upper()
            gate = row.get("code_gate", "").upper()
            validation.require(
                ("RESERVED" in state or "ALLOCATED" in state)
                and "BLOCKED" not in state,
                f"migration line {line}: range not reserved/allocated",
                group,
            )
            validation.require(
                gate == "VALIDATOR_CONTROLLED",
                f"migration line {line}: allocation claims static code authority",
                group,
            )
            start, end = allocation_range
            validation.require(
                start > 0 and end >= start,
                f"migration line {line}: invalid range",
                group,
            )
            ranges_by_stream[migration_dir].append((start, end, session_id))
    validation.require(
        set(observed) == set(EXPECTED_MIGRATION_RANGES),
        "missing migration range reservations: "
        f"{sorted(set(EXPECTED_MIGRATION_RANGES) - set(observed))}",
        group,
    )
    for migration_dir, ranges in ranges_by_stream.items():
        ranges.sort()
        for previous, current in zip(ranges, ranges[1:]):
            validation.require(
                previous[1] < current[0],
                f"{migration_dir}: overlapping ranges {previous} and {current}",
                group,
            )
    validation.require(
        bool(backend_head),
        "backend integration checkpoint missing while validating migration successor",
        group,
    )
    validation.details["migrationRanges"] = {
        allocation_id: {"start": value[0], "end": value[1]}
        for allocation_id, value in sorted(observed.items())
    }


def run_code_checkpoint(validation: Validation, check_live: bool) -> None:
    group = "g0-code-checkpoint"
    validator = G0 / "validate_code_checkpoint.py"
    validation.require(
        validator.is_file(),
        f"missing authoritative checkpoint validator: {validator}",
        group,
    )
    if not validator.is_file():
        return
    results: dict[str, Any] = {}
    modes = ["--static"] + (["--check-live"] if check_live else [])
    for mode in modes:
        try:
            completed = subprocess.run(
                [sys.executable, str(validator), mode],
                cwd=str(G0),
                capture_output=True,
                text=True,
                timeout=300,
                check=False,
            )
            output = completed.stdout + completed.stderr
            try:
                checkpoint = json.loads(completed.stdout)
            except json.JSONDecodeError:
                checkpoint = {}
            expected_mode = mode.removeprefix("--").replace("check-", "")
            has_pass = (
                checkpoint.get("schema")
                == "dwp.hris.full-code-checkpoint.v1"
                and checkpoint.get("mode") == expected_mode
                and checkpoint.get("status") == "PASS"
                and checkpoint.get("code_gate") == current_effective_gate()
                and checkpoint.get("production_activation")
                == "NOT_AUTHORIZED_G6"
                and checkpoint.get("source_rows") == 2269
            )
            validation.require(
                completed.returncode == 0 and has_pass,
                f"{mode}: authoritative code checkpoint failed "
                f"rc={completed.returncode}",
                group,
            )
            validation.require(
                checkpoint.get("production_activation")
                == "NOT_AUTHORIZED_G6",
                f"{mode}: validator improperly authorizes production",
                group,
            )
            lines = [
                line.strip()
                for line in output.splitlines()
                if "PASS" in line or "FAIL" in line
            ]
            results[mode.removeprefix("--")] = {
                "status": (
                    "PASS"
                    if completed.returncode == 0 and has_pass
                    else "FAIL"
                ),
                "returnCode": completed.returncode,
                "outputSha256": hashlib.sha256(
                    output.encode("utf-8")
                ).hexdigest(),
                "summary": lines[-1] if lines else "NO_SUMMARY_MARKER",
            }
        except subprocess.TimeoutExpired:
            validation.require(
                False,
                f"{mode}: code checkpoint timeout",
                group,
            )
            results[mode.removeprefix("--")] = {
                "status": "FAIL",
                "summary": "TIMEOUT",
            }
    validation.details["codeCheckpoint"] = results


def validate_architecture_documents(validation: Validation) -> None:
    group = "architecture-documents"

    def contains_in_order(text: str, markers: list[str]) -> bool:
        cursor = -1
        for marker in markers:
            cursor = text.find(marker, cursor + 1)
            if cursor < 0:
                return False
        return True

    required_markers = {
        "01-full-coding-architecture.md": [
            "dwp-time-server",
            "dwp-payroll-server",
            "/hr/home",
            "G6",
            "Country Pack",
        ],
        "02-frontend-module-architecture.md": [
            "/hr/explore",
            "partial",
            "denied/403",
            "Design AI",
        ],
        "03-backend-service-architecture.md": [
            "dwp-people-server",
            "dwp-time-server",
            "dwp-payroll-server",
            "outbox",
            "다른 service",
        ],
        "04-data-api-event-contract.md": [
            "Idempotency-Key",
            "If-Match",
            "DomainEventEnvelope",
            "/api/{service}/v1/**",
            "tenantId",
            "receiptId",
            "SYS-API-032",
            "platform_updateSurface",
            "cross-module-canonical-schemas.v1.json",
            "ORIGINATING_COMMAND_SCOPE",
        ],
        "05-security-privacy-compliance.md": [
            "app entitlement",
            "SoD",
            "field",
            "G6",
            "tenant",
            "REDACTED_PAYLOAD",
            "digest",
            "error code",
            "원문 payload",
        ],
        "06-quality-operations-release.md": [
            "synthetic",
            "Testcontainers",
            "reconciliation",
            "G5",
            "G6",
        ],
        "09-information-architecture-contract.md": [
            "98",
            "workbench",
            "deep link",
            "/hr/settings",
            "BENSK",
            "NOT_AUTHORIZED_G6",
        ],
    }
    for filename, markers in required_markers.items():
        path = HERE / filename
        validation.require(
            path.is_file() and path.stat().st_size > 0,
            f"missing document {filename}",
            group,
        )
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        for marker in markers:
            validation.require(
                marker.lower() in text.lower(),
                f"{filename}: missing marker {marker}",
                group,
            )
    readme_path = HERE / "README.md"
    readme = (
        readme_path.read_text(encoding="utf-8")
        if readme_path.is_file()
        else ""
    )
    for marker in (
        "OPEN_G3_CODE",
        "production",
        "2,269",
        "10,001",
        "modern-capability-delivery-register.csv",
        "modern-capability-trace-register.csv",
        "modern-capability-coding-contract-register.csv",
        "modern-capability-exact-schema-contracts.v1.json",
        "modern-capability-event-payload-contracts.v1.json",
        "modern-menu-node-register.csv",
        "modern-capability-authorization-register.csv",
        "module-structure-contract-register.csv",
        "g3-file-allocation-register.csv",
        "platform-integration-binding-register.csv",
        "api-pep-binding-register.csv",
        "service-api-auth-binding-register.csv",
        "home-materialization-security-register.csv",
        "target-family-resolution-register.csv",
        "transport-schema-resolution-register.csv",
        "cross-module-canonical-schemas.v1.json",
        "decimal-value-types.v1.json",
        "cross-module-schema-binding-register.csv",
        "physical-owner-prefix-register.csv",
        "hris-information-architecture-register.csv",
        "route-transition-register.csv",
        "09-information-architecture-contract.md",
        "shared-contract-catalog.csv",
        "PLANNED_REQUIRED_SCOPE",
        "validate_source_provenance.py",
        "validate_trace_semantics.py",
        "validate_target_family_resolution.py",
        "validate_transport_schema_resolution.py",
        "validate_cross_module_schema_contracts.py",
        "validate_decimal_value_contract.py",
        "validate_physical_owner_prefixes.py",
        "g2-auth-physical-schema.sql",
        "g2-platform-physical-schema.sql",
        "validate_sys_service_local_migrations.py",
        "validate_base_schema_postgres_feasibility.py",
        "validate_information_architecture.py",
        "validate_api_pep_bindings.py",
        "validate_modern_capability_contracts.py",
        "validate_modern_capability_authorization.py",
        "validate_full_coding_readiness.py",
    ):
        validation.require(
            marker.lower() in readme.lower(),
            f"README missing marker {marker}",
            group,
        )

    quality_path = HERE / "06-quality-operations-release.md"
    quality_text = (
        quality_path.read_text(encoding="utf-8")
        if quality_path.is_file()
        else ""
    )
    validation.require(
        "| IntegrationE2E |End-to-end |" not in quality_text,
        "06-quality-operations-release.md: malformed test table row regressed",
        group,
    )

    common_prompt_path = ROOT / "session-prompts/00-common-session-contract.md"
    common_prompt = (
        common_prompt_path.read_text(encoding="utf-8")
        if common_prompt_path.is_file()
        else ""
    )
    validation.require(
        common_prompt_path.is_file(),
        "missing common session contract",
        group,
    )
    validation.require(
        "validate_g0.py" not in common_prompt,
        "common session contract still invokes the historical validate_g0.py",
        group,
    )
    validation.require(
        "현재 최대 허용 Gate는 `G1`" not in common_prompt
        and "UNKNOWN으로 유지" not in common_prompt,
        "common session contract still carries the superseded G1/UNKNOWN block",
        group,
    )
    validation.require(
        "validate_code_checkpoint.py --check-live" in common_prompt
        and "validate_full_coding_readiness.py --check-live" in common_prompt,
        "common session contract lacks both authoritative live validators",
        group,
    )
    validation.require(
        "modern-capability-delivery-register.csv" in common_prompt
        and "modern-capability-trace-register.csv" in common_prompt
        and "PLANNED_REQUIRED_SCOPE" in common_prompt,
        "common session contract does not bind the 16 modern capabilities to delivery",
        group,
    )

    global_open_sequence = [
        f"python3 {ROOT}/g0/validate_code_checkpoint.py --check-live",
        f"python3 {ROOT}/coding-readiness/validate_full_coding_readiness.py "
        "--check-live --write-report",
        f"python3 {ROOT}/coding-readiness/validate_published_gate_truth.py --compact",
        f"python3 {ROOT}/coding-readiness/validate_published_gate_truth.py --self-test",
    ]
    validation.require(
        contains_in_order(common_prompt, global_open_sequence),
        "common session contract no longer carries the exact ordered four-step global open seal",
        group,
    )

    execution_path = ROOT / "session-prompts/07-g3-full-coding-execution-contract.md"
    execution_contract = (
        execution_path.read_text(encoding="utf-8")
        if execution_path.is_file()
        else ""
    )
    validation.require(
        execution_path.is_file(),
        "missing G3 execution contract",
        group,
    )
    validation.require(
        "validate_code_checkpoint.py --check-live" in execution_contract
        and "validate_full_coding_readiness.py --check-live" in execution_contract
        and "module-structure-contract-register.csv" in execution_contract
        and "g3-file-allocation-register.csv" in execution_contract
        and "modern-capability-delivery-register.csv" in execution_contract
        and "modern-capability-trace-register.csv" in execution_contract
        and "PLANNED_REQUIRED_SCOPE" in execution_contract
        and "VALIDATOR_CONTROLLED" in execution_contract,
        "G3 execution contract lacks both authoritative live validators",
        group,
    )

    prompt_contracts = [
        ROOT / "session-prompts/00-common-session-contract.md",
        ROOT / "session-prompts/01-cloudhr-hrm-session.md",
        ROOT / "session-prompts/02-cloudhr-per-session.md",
        ROOT / "session-prompts/03-cloudhr-pay-session.md",
        ROOT / "session-prompts/04-cloudhr-tim-session.md",
        ROOT / "session-prompts/05-cloudhr-sys-session.md",
        ROOT / "session-prompts/06-hris-integration-control.md",
        ROOT / "session-prompts/07-g3-full-coding-execution-contract.md",
    ]
    prompt_required_markers = {
        "cross-module-canonical-schemas.v1.json",
        "cross-module-schema-binding-register.csv",
        "validate_cross_module_schema_contracts.py --compact",
        "physical-owner-prefix-register.csv",
        "validate_physical_owner_prefixes.py --compact",
        "hris-information-architecture-register.csv",
        "validate_information_architecture.py --compact",
    }
    for path in prompt_contracts:
        prompt_text = path.read_text(encoding="utf-8") if path.is_file() else ""
        missing = sorted(
            marker for marker in prompt_required_markers if marker not in prompt_text
        )
        validation.require(
            path.is_file() and not missing,
            f"{path.name}: required XCON/physical/IA execution inputs missing {missing}",
            group,
        )

    sys_prompt_path = ROOT / "session-prompts/05-cloudhr-sys-session.md"
    sys_prompt = (
        sys_prompt_path.read_text(encoding="utf-8")
        if sys_prompt_path.is_file()
        else ""
    )
    validation.require(
        all(
            marker in sys_prompt
            for marker in (
                "g2-auth-physical-schema.sql",
                "g2-platform-physical-schema.sql",
                "validate_sys_service_local_migrations.py",
                "--docker-postgres",
            )
        ),
        "SYS session prompt does not bind split owner-local DDL and PostgreSQL execution evidence",
        group,
    )

    execution_self_test_markers = {
        "validate_cross_module_schema_contracts.py --self-test --compact",
        "validate_compensation_snapshot_v2_authority.py --self-test --compact",
        "validate_physical_owner_prefixes.py --self-test --compact",
        "validate_information_architecture.py --self-test --compact",
    }
    validation.require(
        all(marker in execution_contract for marker in execution_self_test_markers),
        "G3 execution contract lacks exact XCON/physical/IA mutation commands",
        group,
    )
    validation.require(
        contains_in_order(execution_contract, global_open_sequence),
        "G3 execution contract no longer carries the exact ordered four-step global open seal",
        group,
    )

    scoped_prompt_paths = {
        "HRIS-HRM": ROOT / "session-prompts/01-cloudhr-hrm-session.md",
        "HRIS-PER": ROOT / "session-prompts/02-cloudhr-per-session.md",
        "HRIS-PAY": ROOT / "session-prompts/03-cloudhr-pay-session.md",
        "HRIS-TIM": ROOT / "session-prompts/04-cloudhr-tim-session.md",
        "HRIS-SYS": ROOT / "session-prompts/05-cloudhr-sys-session.md",
    }
    for session_id, prompt_path in scoped_prompt_paths.items():
        prompt_text = (
            prompt_path.read_text(encoding="utf-8")
            if prompt_path.is_file()
            else ""
        )
        scoped_sequence = [
            f"python3 {ROOT}/coding-readiness/validate_published_gate_truth.py "
            "--verify-seal-only --compact",
            f"python3 {ROOT}/g0/validate_code_checkpoint.py --check-live "
            f"--session {session_id}",
            f"python3 {ROOT}/coding-readiness/validate_full_coding_readiness.py "
            f"--check-live --session {session_id}",
        ]
        validation.require(
            contains_in_order(prompt_text, scoped_sequence),
            f"{session_id}: module preflight is not seal-only then exact paired scoped validators",
            group,
        )
        validation.require(
            "--write-report --session" not in prompt_text
            and f"--session {session_id} --write-report" not in prompt_text,
            f"{session_id}: scoped module preflight improperly publishes a global report",
            group,
        )

    common_scoped_sequence = [
        f"python3 {ROOT}/coding-readiness/validate_published_gate_truth.py "
        "--verify-seal-only --compact",
        f"python3 {ROOT}/g0/validate_code_checkpoint.py --check-live "
        "--session HRIS-HRM",
        f"python3 {ROOT}/coding-readiness/validate_full_coding_readiness.py "
        "--check-live --session HRIS-HRM",
    ]
    validation.require(
        contains_in_order(common_prompt, common_scoped_sequence),
        "common session contract lacks the exact ordered scoped-resume example",
        group,
    )
    validation.require(
        contains_in_order(execution_contract, common_scoped_sequence),
        "G3 execution contract lacks the exact ordered scoped-resume example",
        group,
    )

    g0_readme_path = ROOT / "g0/README.md"
    g0_readme = (
        g0_readme_path.read_text(encoding="utf-8")
        if g0_readme_path.is_file()
        else ""
    )
    validation.require(
        all(
            marker in g0_readme
            for marker in (
                "validate_published_gate_truth.py --verify-seal-only --compact",
                "validate_code_checkpoint.py --check-live --session HRIS-<MODULE>",
                "validate_full_coding_readiness.py --check-live --session HRIS-<MODULE>",
                "scoped 검사에는 global report를 쓰는 `--write-report`를 "
                "결합하지 않는다",
            )
        ),
        "G0 README no longer preserves seal-only/scoped-resume and no-global-publish boundaries",
        group,
    )


def artifact_hashes() -> dict[str, str]:
    paths = [
        HERE / "README.md",
        ROOT / "session-prompts/00-common-session-contract.md",
        ROOT / "session-prompts/01-cloudhr-hrm-session.md",
        ROOT / "session-prompts/02-cloudhr-per-session.md",
        ROOT / "session-prompts/03-cloudhr-pay-session.md",
        ROOT / "session-prompts/04-cloudhr-tim-session.md",
        ROOT / "session-prompts/05-cloudhr-sys-session.md",
        ROOT / "session-prompts/06-hris-integration-control.md",
        ROOT / "session-prompts/07-g3-full-coding-execution-contract.md",
        ROOT / "session-prompts/90-design-ai-handoff-output-contract.md",
        HERE / "01-full-coding-architecture.md",
        HERE / "02-frontend-module-architecture.md",
        HERE / "03-backend-service-architecture.md",
        HERE / "04-data-api-event-contract.md",
        HERE / "05-security-privacy-compliance.md",
        HERE / "06-quality-operations-release.md",
        HERE / "architecture-decision-register.csv",
        HERE / "module-dependency-register.csv",
        HERE / "nonfunctional-requirements-register.csv",
        HERE / "module-code-gate-register.csv",
        HERE / "activation-gate-register.csv",
        HERE / "cross-cutting-ownership-register.csv",
        HERE / "external-input-classification-register.csv",
        HERE / "cross-module-contract-register.csv",
        HERE / "cross-module-canonical-schemas.v1.json",
        HERE / "decimal-value-types.v1.json",
        HERE / "validate_decimal_value_contract.py",
        HERE / "country-pack-boundary-register.csv",
        HERE / "validate_country_pack_boundaries.py",
        HERE / "validate_command_receipt_contracts.py",
        HERE / "cross-module-schema-binding-register.csv",
        HERE / "validate_cross_module_schema_contracts.py",
        HERE / "physical-owner-prefix-register.csv",
        HERE / "validate_physical_owner_prefixes.py",
        HERE / "modern-capability-delivery-register.csv",
        HERE / "modern-capability-trace-register.csv",
        HERE / "modern-capability-coding-contract-register.csv",
        HERE / "modern-capability-exact-schema-contracts.v1.json",
        HERE / "modern-capability-event-payload-contracts.v1.json",
        HERE / "modern-menu-node-register.csv",
        HERE / "modern-capability-authorization-register.csv",
        HERE / "07-modern-capability-coding-contract.md",
        HERE / "module-structure-contract-register.csv",
        HERE / "g3-file-allocation-register.csv",
        HERE / "platform-integration-binding-register.csv",
        HERE / "api-pep-binding-register.csv",
        HERE / "service-api-auth-binding-register.csv",
        HERE / "home-materialization-security-register.csv",
        HERE / "shared-contract-catalog.csv",
        HERE / "target-family-resolution-register.csv",
        HERE / "transport-schema-resolution-register.csv",
        HERE / "08-transport-schema-contract.md",
        HERE / "hris-information-architecture-register.csv",
        HERE / "route-transition-register.csv",
        HERE / "hris-api-sor-transition-register.csv",
        HERE / "validate_hris_api_sor_transitions.py",
        HERE / "09-information-architecture-contract.md",
        HERE / "generate_information_architecture_register.py",
        HERE / "validate_information_architecture.py",
        HERE / "validate_api_pep_bindings.py",
        HERE / "validate_modern_capability_contracts.py",
        HERE / "validate_modern_capability_authorization.py",
        HERE / "validate_target_family_resolution.py",
        HERE / "validate_transport_schema_resolution.py",
        HERE / "validate_source_provenance.py",
        HERE / "validate_base_schema_postgres_feasibility.py",
        ROOT / "readiness-tools/validate_trace_semantics.py",
        ROOT / "readiness-tools/trace_semantics.py",
        ROOT / "trace-semantic-risk-review-register.csv",
        ROOT / "session-evidence/hrm/g3-modern-capability-contracts.v1.json",
        ROOT / "session-evidence/per/g3-modern-capability-contracts.v1.json",
        ROOT / "session-evidence/tim/g3-modern-capability-contracts.v1.json",
        ROOT / "session-evidence/sys/g3-modern-capability-contracts.v1.json",
        ROOT / "session-evidence/pay/g3-modern-capability-consumer-contracts.v1.json",
        ROOT / "session-evidence/per/g2-readiness/api-event-contracts.yaml",
        ROOT / "session-evidence/tim/g2-api-event-contracts.json",
        ROOT / "session-evidence/pay/g2-api-event-contracts.json",
        ROOT / "session-evidence/tim/g2-physical-schema.sql",
        ROOT / "session-evidence/pay/g2-physical-schema.sql",
        ROOT / "session-evidence/pay/synthetic-golden-fixtures.json",
        ROOT / "session-evidence/tim/g2-transport-schemas.v1.json",
        ROOT / "session-evidence/pay/g2-transport-schemas.v1.json",
        ROOT / "session-evidence/sys/g2-transport-schemas.v1.json",
        HERE / "validate_full_coding_readiness.py",
    ]
    return {
        (
            str(path.relative_to(HERE))
            if is_within(path.resolve(), HERE.resolve())
            else str(path.relative_to(ROOT))
        ): sha256(path)
        for path in paths
        if path.is_file()
    }


def report_payload(
    validation: Validation,
    mode: str,
) -> dict[str, Any]:
    passed = not validation.errors
    live = mode == "LIVE"
    return {
        "schema": "dwp.hris.full-coding-readiness.v1",
        "generatedAt": datetime.now(timezone.utc)
        .isoformat()
        .replace("+00:00", "Z"),
        "mode": mode,
        "status": "PASS" if passed else "FAIL",
        "effectiveGate": (
            current_effective_gate()
            if passed and live
            else ("LIVE_VALIDATION_REQUIRED" if passed else "BLOCKED")
        ),
        "implementationState": "NOT_STARTED_G3",
        "functionalAcceptanceState": "NOT_STARTED_G4",
        "designState": "DEFERRED_G5_AFTER_G4",
        "productionState": "NOT_AUTHORIZED_G6",
        "checks": validation.checks,
        "errors": validation.errors,
        "warnings": validation.warnings,
        "groups": {
            group: {
                "checks": count,
                "errors": validation.group_errors[group],
            }
            for group, count in sorted(validation.group_checks.items())
        },
        "details": validation.details,
        "artifactSha256": artifact_hashes(),
    }


def markdown_report(payload: dict[str, Any]) -> str:
    totals = payload.get("details", {}).get("totals", {})
    module_counts = payload.get("details", {}).get("moduleCounts", {})
    architecture = payload.get("details", {}).get("architectureRegisters", {})
    delivery = payload.get("details", {}).get("deliveryArchitecture", {})
    pep = payload.get("details", {}).get("apiPepBindings", {})
    trace = payload.get("details", {}).get("traceSemantics", {})
    target_families = payload.get("details", {}).get("targetFamilyResolution", {})
    transport = payload.get("details", {}).get("transportSchemaResolution", {})
    cross_module_schema = payload.get("details", {}).get(
        "crossModuleSchemaContracts", {}
    )
    decimal_money = payload.get("details", {}).get("decimalMoneyContract", {})
    command_receipts = payload.get("details", {}).get("commandReceiptContracts", {})
    country_packs = payload.get("details", {}).get("countryPackBoundaries", {})
    physical_ownership = payload.get("details", {}).get(
        "physicalOwnerPrefixes",
        {},
    )
    sys_migrations = payload.get("details", {}).get(
        "sysServiceLocalMigrations",
        {},
    )
    base_schemas = payload.get("details", {}).get(
        "baseSchemaPostgresFeasibility",
        {},
    )
    modern_exact = payload.get("details", {}).get("modernExactContracts", {})
    information_architecture = payload.get("details", {}).get("informationArchitecture", {})
    dependency_closure = payload.get("details", {}).get(
        "moduleDependencyAllocationClosure",
        {},
    )
    gates = payload.get("details", {}).get("gateSeparation", {})
    lines = [
        "# DWP HRIS 전체 코딩 준비 검증",
        "",
        f"- 생성시각: {payload['generatedAt']}",
        f"- 검증 모드: {payload['mode']}",
        f"- 검증 결과: {payload['status']}",
        f"- 유효 코드 Gate: {payload['effectiveGate']}",
        f"- 구현 상태: {payload['implementationState']}",
        f"- Production 상태: {payload['productionState']}",
        "",
        "이 판정은 범용 core의 G3 코딩 시작 가능 여부만 뜻한다. "
        "기능 구현 완료, G4 수용, G5 디자인 수용, G6 국가팩/연계/"
        "고객/production 활성화를 뜻하지 않는다.",
        "",
        "## 추적성 집계",
        "",
        f"- Source parents: {totals.get('parents', 0)}",
        f"- Child traces: {totals.get('children', 0)}",
        f"- Decisions: {totals.get('decisions', 0)}",
        "- Child trace는 source→target 추적 링크 수이며 고유 제품 기능 수나 구현 완료 건수가 아니다.",
        "- 최신 HRIS capability 16건은 전체 개발 범위이나 현재 PLANNED_REQUIRED_SCOPE / NOT_STARTED_G3다.",
        f"- Semantic trace proof: {trace.get('status', 'NOT_RUN')} / rows {trace.get('rows', 0)} / risk samples {trace.get('riskReviewSamples', 0)}",
        f"- Target-family proof: {target_families.get('status', 'NOT_RUN')} / parents {target_families.get('sourceParents', 0)} / children {target_families.get('resolvedSourceChildren', 0)} / families {target_families.get('targetFamilies', 0)}",
        "- Child target_api_event_candidate는 characterization 기록이며 구현 정본이 아니다. 정본 연결은 child.parent_artifact_id → source parent family → target-family resolution_refs다.",
        f"- API PEP proof: {pep.get('status', 'NOT_RUN')} / public operations {pep.get('publicOperations', 0)} / service-only operations {pep.get('serviceOnlyOperations', 0)} / authorized receipt queries {pep.get('commandReceiptPepBindings', 0)}",
        f"- Transport schema proof: {transport.get('status', 'NOT_RUN')} / resolved public operations {transport.get('coverage', {}).get('resolvedOperationCount', 0)} / self-test {transport.get('selfTestStatus', 'NOT_RUN')}",
        f"- Cross-module typed schema proof: {cross_module_schema.get('status', 'NOT_RUN')} / contracts {cross_module_schema.get('coverage', {}).get('resolvedSchemaCount', 0)} / consumer bindings {cross_module_schema.get('coverage', {}).get('consumerBindingCount', 0)} / self-test {cross_module_schema.get('selfTestStatus', 'NOT_RUN')}",
        f"- Decimal/money proof: {decimal_money.get('status', 'NOT_RUN')} / executable checks {decimal_money.get('checks', 0)} / value types {decimal_money.get('coverage', {}).get('valueTypes', 0)} / rounding modes {decimal_money.get('coverage', {}).get('roundingModes', 0)} / large streams {decimal_money.get('coverage', {}).get('largeStreamingContracts', 0)} / self-test {decimal_money.get('selfTestStatus', 'NOT_RUN')}",
        f"- Command receipt proof: {command_receipts.get('status', 'NOT_RUN')} / owners {command_receipts.get('owners', 0)} / receipt queries {command_receipts.get('receiptQueries', 0)} / mutation cases {command_receipts.get('mutationCases', 0)} / self-test {command_receipts.get('selfTestStatus', 'NOT_RUN')}",
        f"- Country-pack boundary proof: {country_packs.get('status', 'NOT_RUN')} / rows {country_packs.get('rows', 0)} / Product Core rows {country_packs.get('g3Rows', 0)} / deferred G6 rows {country_packs.get('g6Rows', 0)} / self-test {country_packs.get('selfTestStatus', 'NOT_RUN')}",
        f"- Physical ownership proof: {physical_ownership.get('status', 'NOT_RUN')} / authoritative base+producer {physical_ownership.get('authoritativeTables', 0)} / consumer materializations {physical_ownership.get('consumerMaterializationTables', 0)} / deploy objects {physical_ownership.get('deploymentPhysicalObjects', 0)} / owner-prefix bindings {physical_ownership.get('bindings', 0)} / self-test {physical_ownership.get('selfTestStatus', 'NOT_RUN')}",
        f"- SYS service-local DDL proof: {sys_migrations.get('status', 'NOT_RUN')} / Auth tables {sys_migrations.get('authTables', 0)} / Platform tables {sys_migrations.get('platformTables', 0)} / self-test {sys_migrations.get('selfTestStatus', 'NOT_RUN')} / PostgreSQL 16 {sys_migrations.get('postgres16Status', 'NOT_RUN')}",
        f"- Base schema PostgreSQL proof: {base_schemas.get('status', 'NOT_RUN')} / People V1..V46 {base_schemas.get('peopleBaselineMigrations', 0)} migrations / base owner tables {base_schemas.get('baseOwnerTables', 0)} / self-test {base_schemas.get('selfTestStatus', 'NOT_RUN')} / PostgreSQL 16 {base_schemas.get('postgres16Status', 'NOT_RUN')}",
        f"- Modern exact proof: {modern_exact.get('status', 'NOT_RUN')} / {modern_exact.get('counts', {}).get('capabilities', 0)} capabilities / {modern_exact.get('counts', {}).get('operations', 0)} planned operations / implementation NOT_STARTED_G3",
        f"- Integrated IA proof: {information_architecture.get('status', 'NOT_RUN')} / nodes {information_architecture.get('coverage', {}).get('nodeCount', 0)} / unique routes {information_architecture.get('coverage', {}).get('uniqueCanonicalPathCount', 0)} / self-test {information_architecture.get('selfTestStatus', 'NOT_RUN')}",
        f"- Architecture: dependencies {architecture.get('moduleDependencies', 0)} / cross-cutting owners {architecture.get('crossCuttingOwners', 0)} / G3 allocations {delivery.get('g3Allocations', 0)}",
        "- Dependency allocation proof: "
        + ", ".join(
            f"{session_id}={dependency_closure.get(session_id, {}).get('status', 'NOT_RUN')}"
            for session_id in MODULES
        ),
        f"- G6 activation rows: {gates.get('activationGates', 0)} / {gates.get('productionState', 'NOT_AUTHORIZED_G6')}",
        "",
        "| 모듈 | Parent | Child | Decision | Validator |",
        "|---|---:|---:|---:|---|",
    ]
    validators = payload.get("details", {}).get(
        "moduleValidators",
        {},
    )
    for session_id in MODULES:
        count = module_counts.get(session_id, {})
        status = validators.get(session_id, {}).get(
            "status",
            "NOT_RUN",
        )
        lines.append(
            f"| {session_id} | {count.get('parents', 0)} | "
            f"{count.get('children', 0)} | "
            f"{count.get('decisions', 0)} | {status} |"
        )
    lines.extend(
        [
            "",
            "## 검증 그룹",
            "",
            "| 그룹 | Checks | Errors |",
            "|---|---:|---:|",
        ]
    )
    for group, result in payload.get("groups", {}).items():
        lines.append(
            f"| {group} | {result['checks']} | {result['errors']} |"
        )
    errors = payload.get("errors", [])
    lines.extend(["", "## Blocker", ""])
    if errors:
        lines.extend(f"- {error}" for error in errors)
    else:
        lines.append(
            "- 없음. 단 G6 activation 항목은 의도적으로 미승인 상태다."
        )
    lines.extend(
        [
            "",
            "## G6 분리 원칙",
            "",
            "실명 운영 승인, 실제 ERP/은행/세무/보험/타각 계약, "
            "실제 고객 golden/UAT, KR 법정팩/YEA, tenant 용량/SLO/DR과 "
            "production secret은 DEFERRED_G6_NOT_CORE_BLOCKER다. "
            "각 capability 또는 tenant의 production 활성화는 계속 "
            "fail-closed다.",
            "",
        ]
    )
    return "\n".join(lines)


def write_report(payload: dict[str, Any]) -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    json_path = REPORT_DIR / "full-coding-readiness-latest.json"
    md_path = REPORT_DIR / "full-coding-readiness-latest.md"
    json_temp = REPORT_DIR / ".full-coding-readiness-latest.json.tmp"
    md_temp = REPORT_DIR / ".full-coding-readiness-latest.md.tmp"
    json_temp.write_text(
        json.dumps(
            payload,
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )
    md_temp.write_text(markdown_report(payload), encoding="utf-8")
    os.replace(json_temp, json_path)
    os.replace(md_temp, md_path)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--static",
        action="store_true",
        help="validate registries and evidence without live Git checks",
    )
    mode.add_argument(
        "--check-live",
        action="store_true",
        help="also verify live worktrees and authoritative G0 checkpoint",
    )
    parser.add_argument(
        "--write-report",
        action="store_true",
        help="write latest JSON and Markdown reports",
    )
    args = parser.parse_args()
    check_live = bool(args.check_live)

    validation = Validation()
    roles = validate_roles(validation)
    run_source_provenance(validation, check_live)
    run_trace_semantics(validation)
    module_counts = validate_source_and_g2(validation)
    dependency_ids = validate_architecture_registers(
        validation,
        roles,
    )
    validate_cross_module_contracts(validation, dependency_ids)
    run_cross_module_schema_contracts(validation)
    run_decimal_value_contract(validation)
    run_receipt_and_country_pack_boundaries(validation)
    run_physical_owner_prefixes(validation)
    run_sys_service_local_migrations(validation, check_live)
    run_base_schema_postgres_feasibility(validation, check_live)
    run_target_family_resolution(validation)
    run_api_pep_bindings(validation)
    run_transport_schema_resolution(validation)
    validate_modern_capability_scope(validation)
    run_modern_exact_contracts(validation)
    run_information_architecture(validation)
    validate_delivery_architecture(validation, roles, dependency_ids)
    validate_gate_separation(
        validation,
        roles,
        dependency_ids,
        module_counts,
    )
    validate_module_validators(validation)
    baselines = validate_baseline_and_commands(
        validation,
        check_live,
    )
    validate_migration_ranges(validation, baselines)
    run_code_checkpoint(validation, check_live)
    validate_architecture_documents(validation)

    mode_name = "LIVE" if check_live else "STATIC"
    payload = report_payload(validation, mode_name)
    if args.write_report:
        write_report(payload)

    for warning in validation.warnings:
        print(f"WARN: {warning}")
    if validation.errors:
        for error in validation.errors[:100]:
            print(f"ERROR: {error}")
        if len(validation.errors) > 100:
            print(
                f"ERROR: ... {len(validation.errors) - 100} more"
            )
        print(
            "FULL_CODING_READINESS=FAIL "
            f"mode={mode_name} checks={validation.checks} "
            f"errors={len(validation.errors)} "
            "effective_gate=BLOCKED "
            "implementation=NOT_STARTED_G3 "
            "production=NOT_AUTHORIZED_G6"
        )
        return 1

    effective_gate = current_effective_gate() if check_live else "LIVE_VALIDATION_REQUIRED"
    print(
        "FULL_CODING_READINESS=PASS "
        f"mode={mode_name} checks={validation.checks} "
        "parents=2269 children=10001 modules=5 "
        f"effective_gate={effective_gate} "
        "implementation=NOT_STARTED_G3 "
        "production=NOT_AUTHORIZED_G6"
    )
    return 0


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
