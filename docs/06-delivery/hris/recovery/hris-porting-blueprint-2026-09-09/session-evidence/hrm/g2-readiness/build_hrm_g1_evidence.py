#!/usr/bin/env python3
"""Build the HRM G1 work products from the pinned sanitized analysis views.

This script never reads the raw SKKF checkout.  It records behavioral facts,
stable identifiers, and hashes only; no source expression is copied into an
output artifact.
"""

from __future__ import annotations

import csv
import hashlib
import re
import sys
from collections import Counter
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "readiness-tools"))
from trace_semantics import normalize_rows

COVERAGE = ROOT / "session-registers/hris-hrm-source-coverage.csv"
ACCESS = ROOT / "g0/source-security-evidence/coverage-sanitized-access-register.csv"
EVIDENCE = ROOT / "session-evidence/hrm"
CHILD_TRACE = EVIDENCE / "g1-child-trace.csv"
DECISION_LOG = EVIDENCE / "g1-decision-log.csv"

COVERAGE_REQUIRED = (
    "disposition",
    "target_capability_id",
    "target_bounded_context_candidate",
    "target_api_or_event",
    "target_data_owner",
    "process_change",
    "genericity",
    "acceptance_evidence",
    "decision_status",
    "decision_owner",
    "notes",
)

CHILD_HEADER = [
    "child_id", "parent_artifact_id", "session_id", "source_module",
    "child_type", "source_file", "source_line", "source_fingerprint",
    "actor", "trigger", "input_contract", "output_contract",
    "validation_rules", "state_transitions", "exceptions",
    "legacy_dependency", "target_capability_candidate",
    "target_api_event_candidate", "target_data_owner_candidate",
    "disposition", "decision_status", "decision_id", "owner_role",
    "evidence_refs", "notes",
]

DECISION_HEADER = [
    "decision_id", "session_id", "scope", "decision_type", "question",
    "options", "proposed_decision", "status", "owner_role",
    "consulted_role_ids", "due_at", "blocking_gate", "blocking_scope",
    "evidence_refs", "resolution", "decided_at", "notes",
]


@dataclass(frozen=True)
class Target:
    capability: str
    context: str
    api_event: str
    owner: str
    disposition: str
    change: str
    genericity: str
    acceptance: str
    decision_id: str
    rule: str


CAP = {
    "people": (
        "hr-people", "HRIS_PEOPLE",
        "GET /api/hris/v1/people{?asOf,cursor,query}|PersonChanged.v1",
        "dwp-people-server/hris/people",
        "Synthetic person-worker reconciliation; as-of, tenant, population and field-mask tests",
    ),
    "employment": (
        "hr-employment-assignments", "HRIS_EMPLOYMENT",
        "POST /api/hris/v1/assignment-events|AssignmentChanged.v1",
        "dwp-people-server/hris/employment",
        "Lifecycle golden cases; primary-overlap rejection; correction and outbox contract tests",
    ),
    "appointment": (
        "hr-appointments", "HRIS_EMPLOYMENT",
        "POST /api/hris/v1/assignment-events{/:id/validate,/:id/submit,/:id/publish}|AssignmentChanged.v1",
        "dwp-people-server/hris/employment",
        "Draft-validate-approve-publish golden cases; stale, overlap, self-approval and correction tests",
    ),
    "organization": (
        "hr-organization-positions", "HRIS_ORGANIZATION",
        "GET/POST /api/hris/v1/organizations|OrganizationChanged.v1",
        "dwp-people-server/hris/organization",
        "As-of graph and position tests; cycle, overlap, tenant and impact-preview tests",
    ),
    "change": (
        "hr-employee-change-requests", "HRIS_EMPLOYEE_SERVICE",
        "POST /api/hris/v1/employee-change-requests|EmployeeChangeApplied.v1",
        "dwp-people-server/hris/employeeservice",
        "Request-submit-decide-apply golden journey; evidence, stale, replay and no-self-approval tests",
    ),
    "contract": (
        "hr-contracts-compensation-basis", "HRIS_EMPLOYMENT",
        "POST /api/hris/v1/employment-contracts|EmploymentContractIssued.v1",
        "dwp-people-server/hris/employment",
        "Template snapshot, target, amount, signature, effective-date, expiry and retention tests",
    ),
    "document": (
        "hr-certificates-documents", "HRIS_EMPLOYEE_SERVICE",
        "POST /api/hris/v1/certificates|CertificateIssued.v1",
        "dwp-people-server/hris/employeeservice",
        "Document digest, template snapshot, seal/signature, revoke, expiry and access-log tests",
    ),
    "separation": (
        "hr-exit-return", "HRIS_EMPLOYMENT",
        "POST /api/hris/v1/separation-cases|WorkerSeparated.v1",
        "dwp-people-server/hris/employment",
        "Exit-return case, checklist, reversal, downstream handoff and immutable-history tests",
    ),
    "integration": (
        "hr-data-quality", "HRIS_INTEGRATION",
        "POST /api/hris/v1/integrations/workforce-ingestions|WorkforceIngestionReconciled.v1",
        "dwp-people-server/hris/compatibility",
        "Adapter conformance, schema mapping, idempotent ingest, quarantine, replay and reconciliation tests",
    ),
    "reference": (
        "settings-reference", "DWP_HRIS_CONFIGURATION",
        "POST /api/admin/hris/v1/reference-versions{/:id/validate,/:id/publish}|HrisReferenceDataPublished.v1",
        "dwp-platform-server/hrisconfiguration",
        "Draft-validate-simulate-approve-publish, scope, effective-date and rollback tests",
    ),
    "workflow": (
        "settings-workflow", "DWP_APPROVAL",
        "DWP Approval versioned workflow API|ApprovalDecisionRecorded.v1",
        "dwp-approval-server",
        "Workflow-version, delegation, maker-checker, no-self-approval and callback-idempotency tests",
    ),
    "document_config": (
        "settings-documents-communications", "DWP_HRIS_CONFIGURATION",
        "POST /api/admin/hris/v1/document-template-versions|DocumentTemplatePublished.v1",
        "dwp-platform-server/hrisconfiguration",
        "Template schema, sample render, approval, publication, rollback and secret-free rendering tests",
    ),
    "operations_config": (
        "settings-operations", "DWP_HRIS_CONFIGURATION",
        "POST /api/admin/hris/v1/retention-policy-versions|HrisRetentionPolicyPublished.v1",
        "dwp-platform-server/hrisconfiguration",
        "Purpose, retention, legal-hold, deletion receipt and auditor visibility tests",
    ),
    "home": (
        "hr-operations-home", "HRIS_PEOPLE",
        "GET /api/hris/v1/home/widgets/workforce|WorkforceWidgetSnapshot.v1",
        "dwp-people-server/hris/people",
        "Role-aware widget, as-of, masking, freshness, partial-failure and drill-down authorization tests",
    ),
    "experience": (
        "dwp-experience", "DWP_EXPERIENCE",
        "DWP shell, task, notification and object-reference contracts",
        "dwp-platform-server",
        "Deep-link authorization, notification receipt, loading/error/accessibility and shell regression tests",
    ),
    "extension": (
        "dwp-extensibility", "HRIS_TENANT_EXTENSION",
        "POST /api/admin/hris/v1/extensions/installs|ExtensionInstalled.v1",
        "dwp-platform-server/hrisconfiguration",
        "Signed-package, declared capability, tenant isolation, compatibility and revoke tests",
    ),
    "retired": (
        "OUT_OF_SCOPE.TECHNICAL_DUPLICATE", "RETIRED_LEGACY_SURFACE", "NONE", "NONE",
        "Source retirement trace; absence from target manifest, runtime and dependency graph",
    ),
    "bensk": (
        "OUT_OF_SCOPE.BENSK", "EXCLUDED_CUSTOMER_SOLUTION", "NONE", "NONE",
        "BENSK exclusion trace; no target route, API, table, package or copied asset",
    ),
}


def target(key: str, disposition: str, change: str, genericity: str,
           decision_id: str, rule: str) -> Target:
    capability, context, api_event, owner, acceptance = CAP[key]
    return Target(capability, context, api_event, owner, disposition, change,
                  genericity, acceptance, decision_id, rule)


def classify(row: dict[str, str], access: dict[str, str]) -> Target:
    name = row["display_key"].lower()
    path = row["source_file"].lower()
    text = " ".join((name, path, row["legacy_contract"].lower(),
                     row["legacy_component_or_table"].lower()))

    if access["sanitized_access_status"] == "EXCLUDED_BENSK_RETIRE":
        return target("bensk", "RETIRE", "Exclude the BENSK benefit surface and retain trace only",
                      "EXCLUDED_BENSK", "HRM-DEC-008", "excluded-bensk")
    if "/sep/sample1" in path or any(x in name for x in ("tempone", "temptwo", "testcontroller")):
        return target("retired", "RETIRE", "Remove sample/test persistence and endpoints",
                      "RETIRED_SAMPLE", "HRM-DEC-009", "sample-test")
    if "jobseqno" in text:
        return target("retired", "RETIRE", "Replace application sequence allocation with database identity, public UUID and idempotency keys",
                      "RETIRED_TECHNICAL_DUPLICATE", "HRM-DEC-009", "sequence-generator")
    if "uricontroller" in name:
        return target("retired", "RETIRE", "Remove generic URI relay; use authorized DWP object references and allowlisted adapters",
                      "RETIRED_SECURITY_ANTIPATTERN", "HRM-DEC-009", "uri-relay")

    if "usrmetadata" in text:
        return target("reference", "CONFIGURE", "Do not infer blocked export behavior; provide typed, versioned metadata with governed import/export",
                      "TENANT_CONFIGURATION", "HRM-DEC-012", "safe-substitute-metadata")
    if "mailtemplate" in text:
        return target("document_config", "CONFIGURE", "Do not recover blocked template assets; use DWP schema-validated notification templates",
                      "TENANT_CONFIGURATION", "HRM-DEC-012", "safe-substitute-template")

    if "/publ/ben/" in path:
        return target("bensk", "RETIRE", "Exclude the BENSK benefit surface and retain trace only",
                      "EXCLUDED_BENSK", "HRM-DEC-008", "excluded-bensk-path")
    if "/publ/common/" in path or "/publ/hrm/" in path or "/publ/tim/" in path:
        if any(x in name for x in ("orgdynamics", "personnelstatus", "personaloverview", "talentstatus")):
            return target("home", "REBUILD", "Replace standalone publishing route with a role-aware HRIS workforce widget and authorized drill-down",
                          "PRODUCT_CORE", "HRM-DEC-003", "publishing-workforce-widget")
        if name.startswith("widget") and any(x in name for x in ("notice", "aprv", "recentmng")):
            return target("experience", "REUSE", "Use DWP task/approval/notification composition; remove duplicate publishing implementation",
                          "DWP_SHARED_PLATFORM", "HRM-DEC-005", "publishing-platform-widget")
        return target("retired", "RETIRE", "Remove publishing demo, loading shell and cross-module duplicate widget",
                      "RETIRED_PRESENTATION_DUPLICATE", "HRM-DEC-009", "publishing-duplicate")

    if "/appcom/router/" in path or name in {"main", "notice", "noticedetail", "portal", "portaldetail"}:
        if "datatrans" in name:
            return target("integration", "REUSE", "Consolidate data transfer into the DWP integration run, quarantine and reconciliation center",
                          "PRODUCT_CORE", "HRM-DEC-006", "portal-data-transfer")
        if "separatecustody" in name:
            return target("operations_config", "CONFIGURE", "Replace standalone custody UI with purpose, retention, legal-hold and deletion policy",
                          "TENANT_CONFIGURATION", "HRM-DEC-011", "portal-custody")
        return target("experience", "REUSE", "Use the DWP shell, task and notification surfaces; remove the duplicate HRM portal",
                      "DWP_SHARED_PLATFORM", "HRM-DEC-005", "portal-shell")

    if any(x in path for x in ("/infc/", "/datasync/")) or name.startswith("if"):
        provider_specific = any(x in path for x in ("keyfoundry", "kolon", "workday", "/erp/"))
        return target("integration", "EXTENSION" if provider_specific else "REUSE",
                      "Isolate provider transport behind the generic workforce ingestion, mapping and reconciliation contract",
                      "PROVIDER_EXTENSION" if provider_specific else "PRODUCT_CORE",
                      "HRM-DEC-006", "provider-adapter" if provider_specific else "integration-core")
    if "batch" in text:
        return target("integration", "REUSE", "Register a code-owned HRM job manifest in the central DWP automation control plane",
                      "DWP_SHARED_PLATFORM", "HRM-DEC-007", "central-automation")
    if "separatecustody" in text:
        return target("operations_config", "CONFIGURE", "Model custody as versioned purpose, retention, hold and destruction policy",
                      "TENANT_CONFIGURATION", "HRM-DEC-011", "retention-policy")
    if any(x in text for x in ("hrmattr", "/meta/", "metam", "modulecode", "proviewitem", "progviewitem")):
        return target("reference", "CONFIGURE", "Replace module-local metadata CRUD with typed, versioned tenant reference configuration",
                      "TENANT_CONFIGURATION", "HRM-DEC-004", "reference-metadata")
    if "appuser" in text:
        return target("experience", "REUSE", "Use DWP identity and app entitlement; do not keep an HRM-local user master",
                      "DWP_SHARED_PLATFORM", "HRM-DEC-005", "identity-reuse")
    if name == "maincontroller":
        return target("experience", "REUSE", "Use the DWP HRIS shell and home composition instead of an HRM-local main endpoint",
                      "DWP_SHARED_PLATFORM", "HRM-DEC-005", "main-shell-reuse")
    if "datasyncsystem" in text:
        return target("integration", "REUSE", "Consolidate source-system registration and run state in the DWP integration control plane",
                      "PRODUCT_CORE", "HRM-DEC-006", "integration-system")

    if "approval" in text:
        if any(x in text for x in ("approvalline", "approvalstandard", "approvaler", "approval line", "approval standard")):
            return target("workflow", "CONFIGURE", "Convert approval lines, delegates and standards into versioned DWP workflow configuration",
                          "TENANT_CONFIGURATION", "HRM-DEC-005", "workflow-configuration")
        return target("workflow", "REUSE", "Delegate approval state and decision evidence to DWP Approval while HRM owns the business command",
                      "DWP_SHARED_PLATFORM", "HRM-DEC-005", "approval-runtime")

    if any(x in text for x in ("organization", "orgmng", "bizplc", "workplace", "work-place", "costcenter", "costcntr", "offcs", "wrkshp")):
        if "req" in text:
            return target("change", "REBUILD", "Consolidate cost-center and workplace requests into the governed employee-change workflow",
                          "PRODUCT_CORE", "HRM-DEC-002", "organization-change-request")
        return target("organization", "REUSE", "Extend the DWP effective-dated organization, location, job, grade and position graph",
                      "PRODUCT_CORE", "HRM-DEC-001", "organization-foundation")

    if "appointmentstandard" in text or "recruitoption" in text:
        return target("reference", "CONFIGURE", "Convert appointment/recruitment option tables into versioned employment policy and reference data",
                      "TENANT_CONFIGURATION", "HRM-DEC-004", "employment-reference")
    if "gnfdcnsl" in text:
        return target("appointment", "REBUILD", "Fold appointment consultation into the governed appointment proposal, validation and decision journey",
                      "PRODUCT_CORE", "HRM-DEC-002", "appointment-consultation")
    if "appointment" in text or "employeeappt" in text:
        return target("appointment", "REBUILD", "Consolidate appointment screens and records into one versioned change command and immutable publish history",
                      "PRODUCT_CORE", "HRM-DEC-002", "appointment-lifecycle")
    if "employeenew" in text:
        return target("employment", "REBUILD", "Replace direct new-employee CRUD with hire/rehire case, validation, approval and effective activation",
                      "PRODUCT_CORE", "HRM-DEC-002", "hire-lifecycle")
    if any(x in text for x in ("employeechgreq", "familychangereq", "family-change", "layoffreinsatreq")):
        return target("change", "REBUILD", "Unify attribute-specific request screens into typed patches, evidence, approval and atomic apply",
                      "PRODUCT_CORE", "HRM-DEC-002", "employee-change-request")
    if any(x in text for x in ("retire", "retiree", "separation")):
        return target("separation", "REBUILD", "Replace fragmented retirement and reversal CRUD with a governed exit/return case and checklist",
                      "PRODUCT_CORE|COUNTRY_PACK_EXTENSION_POINTS", "HRM-DEC-002", "separation-lifecycle")
    if any(x in text for x in ("employeestate", "employeejobhist")):
        return target("employment", "REBUILD", "Represent employment state and job history as effective-dated assignment events and corrections",
                      "PRODUCT_CORE", "HRM-DEC-002", "employment-history")

    if any(x in text for x in ("contstnd", "oathtemplate")):
        return target("document_config", "CONFIGURE", "Convert contract/oath standards into approved, immutable template versions",
                      "TENANT_CONFIGURATION", "HRM-DEC-004", "document-template")
    if any(x in text for x in ("salcont", "yrsal", "laborcontract", "conttrgter", "contamt", "contract")):
        return target("contract", "REBUILD", "Unify labor and salary contracts with compensation basis, template snapshot and signature lifecycle",
                      "PRODUCT_CORE|COUNTRY_PACK_EXTENSION_POINTS", "HRM-DEC-002", "employment-contract")
    if any(x in text for x in ("cert", "officeseal", "oath")):
        return target("document", "REBUILD", "Use governed document generation, immutable digest, signature/seal, issue and revoke lifecycle",
                      "PRODUCT_CORE|TENANT_CONFIGURATION", "HRM-DEC-002", "employee-document")
    if "employeebank" in text:
        return target("people", "REBUILD", "Store payment accounts encrypted with purpose-bound field access and verification state",
                      "PRODUCT_CORE", "HRM-DEC-011", "bank-account")
    if "oilsupport" in text:
        return target("extension", "EXTENSION", "Keep fuel-support policy and workflow outside core as a signed tenant extension",
                      "TENANT_EXTENSION", "HRM-DEC-010", "tenant-reward-extension")

    if any(x in text for x in ("orgdynamics", "personnelstatus", "talentstat", "personaloverview")):
        return target("home", "REBUILD", "Consolidate legacy statistics pages into governed workforce widgets with drill-down",
                      "PRODUCT_CORE", "HRM-DEC-003", "workforce-insight")
    if any(x in text for x in ("family", "education", "career", "reward", "punish", "language", "lang", "lcnse", "license", "learning", "pnsh", "military", "veteran", "disab", "personalinfo", "employeeaddr", "employeecard", "laborunion", "myresume", "evaluationresult")):
        country = any(x in text for x in ("military", "veteran", "disab"))
        return target("people", "REBUILD", "Consolidate profile fragments into People 360 effective-dated sections with evidence and field policy",
                      "PRODUCT_CORE|COUNTRY_PACK_FIELDSET" if country else "PRODUCT_CORE",
                      "HRM-DEC-003", "people-360-section")
    if name in {"empdatamng", "famdatamng"}:
        return target("people", "REBUILD", "Consolidate attribute-specific data maintenance into governed People 360 sections and change requests",
                      "PRODUCT_CORE", "HRM-DEC-003", "people-360-data-maintenance")

    if any(x in text for x in ("person", "employee", "comhrm")):
        return target("people", "REUSE", "Extend the canonical DWP person, worker, relationship and assignment system of record",
                      "PRODUCT_CORE", "HRM-DEC-001", "people-foundation")

    return target("people", "REBUILD", "Map the residual HRM behavior into the People 360 or workforce-operation contract; no legacy screen replication",
                  "PRODUCT_CORE", "HRM-DEC-003", "reviewed-residual-hrm")


def actor_for(target_value: Target) -> str:
    if target_value.capability.startswith("settings-"):
        return "HRIS configuration administrator"
    if target_value.capability == "dwp-extensibility":
        return "Platform extension administrator"
    if target_value.capability.startswith("OUT_OF_SCOPE"):
        return "None (retired source)"
    if target_value.capability in {"hr-people", "hr-employment-assignments"}:
        return "Employee, manager, or scoped HR operator"
    return "Scoped HR operator or designated approver"


def state_for(target_value: Target, mutating: bool) -> str:
    if not mutating:
        return "No state change; as-of projection only"
    states = {
        "hr-appointments": "DRAFT->VALIDATED->PENDING_APPROVAL->APPROVED->PUBLISHED; correction creates a new event",
        "hr-employee-change-requests": "DRAFT->SUBMITTED->IN_REVIEW->APPROVED/REJECTED->APPLYING->APPLIED/APPLY_FAILED",
        "hr-contracts-compensation-basis": "DRAFT->ISSUED->SIGNED->ACTIVE->SUPERSEDED/EXPIRED/REVOKED",
        "hr-certificates-documents": "REQUESTED->VALIDATING->ISSUED->REVOKED/EXPIRED/FAILED",
        "hr-exit-return": "DRAFT->PLANNED->APPROVED->IN_PROGRESS->COMPLETED/CANCELLED",
        "settings-reference": "DRAFT->VALIDATED->PENDING_APPROVAL->PUBLISHED->SUPERSEDED",
        "settings-workflow": "DRAFT->VALIDATED->PUBLISHED->SUPERSEDED",
    }
    return states.get(target_value.capability, "REQUESTED->VALIDATED->APPLIED or REJECTED; immutable audit retained")


def source_fingerprint(access: dict[str, str]) -> str:
    exported = access.get("sanitized_export_path", "")
    if exported and Path(exported).is_file():
        return hashlib.sha256(Path(exported).read_bytes()).hexdigest()
    return access["mapping_fingerprint"]


def child_id(parent: str, child_type: str, line: str, ordinal: int) -> str:
    raw = f"HRIS-HRM|{parent}|{child_type}|{line}|{ordinal}".encode()
    return "HRM-CH-" + hashlib.sha256(raw).hexdigest()[:20].upper()


def parse_controller_mappings(path: Path) -> list[tuple[int, str, str]]:
    lines = path.read_text(errors="ignore").splitlines()
    mapping = re.compile(r"@(Get|Post|Put|Patch|Delete|Request)Mapping\b")
    declaration = re.compile(
        r"(?:public|protected|private)?\s*(?:static\s+)?(?:<[^>]+>\s+)?"
        r"[\w<>\[\],.?\s]+\s+(\w+)\s*\("
    )
    result: list[tuple[int, str, str]] = []
    pending: tuple[int, str] | None = None
    for line_no, line in enumerate(lines, 1):
        match = mapping.search(line)
        if match:
            verb = match.group(1).upper()
            if verb == "REQUEST":
                verb_match = re.search(r"RequestMethod\.(GET|POST|PUT|PATCH|DELETE)", line)
                verb = verb_match.group(1) if verb_match else "REQUEST"
            pending = (line_no, verb)
            continue
        if pending:
            match = declaration.search(line)
            if match and match.group(1) not in {"if", "for", "while", "switch", "catch"}:
                result.append((pending[0], pending[1], match.group(1)))
                pending = None
    return result


def decision_id_from_notes(notes: str) -> str:
    match = re.search(r"decision_id=(HRM-DEC-\d{3})", notes)
    if not match:
        raise ValueError(f"missing decision id in notes: {notes}")
    return match.group(1)


def main() -> None:
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    with ACCESS.open(newline="", encoding="utf-8") as handle:
        access_by_id = {
            row["artifact_id"]: row for row in csv.DictReader(handle)
            if row["session_id"] == "HRIS-HRM"
        }
    with COVERAGE.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        fieldnames = reader.fieldnames
        assert fieldnames is not None
        rows = list(reader)

    classified: dict[str, Target] = {}
    for row in rows:
        access = access_by_id[row["artifact_id"]]
        value = classify(row, access)
        classified[row["artifact_id"]] = value
        row["disposition"] = value.disposition
        row["target_capability_id"] = value.capability
        row["target_bounded_context_candidate"] = value.context
        row["target_api_or_event"] = value.api_event
        row["target_data_owner"] = value.owner
        row["process_change"] = value.change
        row["genericity"] = value.genericity
        row["acceptance_evidence"] = value.acceptance
        row["decision_status"] = "DECIDED"
        row["decision_owner"] = "ROLE.HRIS_HRM_PRODUCT_OWNER"
        security_note = ""
        if access["sanitized_access_status"] == "SECURITY_BLOCKED_UNKNOWN":
            security_note = "; source_access=SECURITY_BLOCKED_SAFE_SUBSTITUTE_ONLY"
        row["notes"] = (
            f"decision_id={value.decision_id}; classification_rule={value.rule}; "
            "source_mode=BEHAVIORAL_REIMPLEMENTATION_NO_CODE_REUSE; "
            "N:M details are in session-evidence/hrm/g1-child-trace.csv"
            f"{security_note}"
        )
        assert all(row[column] for column in COVERAGE_REQUIRED)

    with COVERAGE.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    children: list[dict[str, str]] = []

    def add_child(row: dict[str, str], child_type: str, line: str, ordinal: int,
                  trigger: str, legacy_dependency: str, notes: str,
                  mutating: bool = False) -> None:
        value = classified[row["artifact_id"]]
        access = access_by_id[row["artifact_id"]]
        status = access["sanitized_access_status"]
        children.append({
            "child_id": child_id(row["artifact_id"], child_type, line, ordinal),
            "parent_artifact_id": row["artifact_id"],
            "session_id": "HRIS-HRM",
            "source_module": "hrm",
            "child_type": child_type,
            "source_file": access["snapshot_relative_path"] or row["source_file"],
            "source_line": line,
            "source_fingerprint": source_fingerprint(access),
            "actor": actor_for(value),
            "trigger": trigger,
            "input_contract": "Authenticated tenant context; scoped target public ID; as-of/expected version; validated typed payload when applicable",
            "output_contract": "Field-filtered projection or durable command receipt with correlation ID and explicit outcome",
            "validation_rules": "Tenant and app entitlement; atomic capability; population and field policy; schema; effective-date; optimistic version",
            "state_transitions": state_for(value, mutating),
            "exceptions": "403 scope/field denial; 404 non-disclosing target; 409 stale/overlap; 422 business rule; retry-safe 5xx/result-unknown receipt",
            "legacy_dependency": legacy_dependency or "None recorded",
            "target_capability_candidate": value.capability,
            "target_api_event_candidate": value.api_event,
            "target_data_owner_candidate": value.owner,
            "disposition": value.disposition,
            "decision_status": "DECIDED",
            "decision_id": value.decision_id,
            "owner_role": "ROLE.HRIS_HRM_PRODUCT_OWNER",
            "evidence_refs": f"coverage:{row['artifact_id']}; sanitized-access:{status}; g2-readiness/api-event-contracts.v1.json",
            "notes": notes,
        })

    mutation_tokens = ("create", "save", "update", "delete", "submit", "approve", "reject", "cancel", "publish", "apply", "issue", "revoke", "request", "register", "modify", "change", "insert", "remove", "sync", "execute", "reverse")
    stateful_caps = {"hr-appointments", "hr-employee-change-requests", "hr-contracts-compensation-basis", "hr-certificates-documents", "hr-exit-return", "hr-employment-assignments", "settings-reference", "settings-workflow"}
    file_tokens = ("cert", "contract", "oath", "seal", "photo", "file", "document", "resume", "evidence")
    formula_tokens = ("contamt", "salary", "salcont", "yrsal", "liquidation", "fte", "amount")

    for row in rows:
        value = classified[row["artifact_id"]]
        access = access_by_id[row["artifact_id"]]
        line = row["source_line"] if row["source_line"].isdigit() else ""
        text = (row["display_key"] + " " + row["source_file"]).lower()
        if row["artifact_type"] == "ROUTE":
            add_child(row, "MENU_ELEMENT", line, 1,
                      "User opens a governed work surface or source-only detail alias",
                      row["legacy_component_or_table"],
                      "Legacy list/detail/tab aliases consolidate under the target capability; route presence never grants authority")
        elif row["artifact_type"] == "ENTITY":
            add_child(row, "SQL_BEHAVIOR", line, 1,
                      "Domain persistence observes an effective-dated or lifecycle record",
                      row["legacy_component_or_table"],
                      "Only table semantics and metadata flags were characterized; no source SQL or entity expression was copied")
        else:
            exported = access.get("sanitized_export_path", "")
            mappings = parse_controller_mappings(Path(exported)) if exported and Path(exported).is_file() else []
            if not mappings:
                add_child(row, "SERVICE_OPERATION", line, 1,
                          "Safe DWP substitute for a security-blocked or non-mapped legacy controller",
                          row["display_key"],
                          "No blocked legacy behavior inferred; target contract is derived from DWP product policy")
            for ordinal, (method_line, verb, method_name) in enumerate(mappings, 1):
                mutating = verb in {"POST", "PUT", "PATCH", "DELETE", "REQUEST"} or any(token in method_name.lower() for token in mutation_tokens)
                add_child(row, "SERVICE_OPERATION", str(method_line), ordinal,
                          f"HTTP {verb} mapped operation:{method_name}",
                          f"source controller operation {method_name}",
                          "Operation name retained only as a trace identifier; behavior is independently specified",
                          mutating=mutating)

        extra = 1000
        if "batch" in text or "datasync" in text:
            add_child(row, "JOB", line, extra, "Manual, scheduled or event-triggered domain job",
                      row["display_key"], "Central scheduler owns timing; HRM owns signed job type, validation, idempotency and result semantics", True)
            extra += 1
        if any(x in text for x in ("/infc/", "datasync", "ifemployee", "iforganization", "ifwork", "iferp", "ifkolon", "ifworkday")):
            add_child(row, "INTERFACE", line, extra, "Versioned adapter ingests or emits a workforce message",
                      row["display_key"], "Provider-specific transport is isolated; the generic HR semantic contract remains provider-neutral", True)
            extra += 1
        if any(token in text for token in file_tokens):
            add_child(row, "FILE_DOCUMENT", line, extra, "Generate, attach, sign, issue, view or revoke a governed document",
                      row["display_key"], "Object bytes stay in DWP object storage; HRM stores immutable reference, digest, purpose and retention metadata", True)
            extra += 1
        if any(token in text for token in formula_tokens):
            add_child(row, "FORMULA_BEHAVIOR", line, extra, "Evaluate a compensation-basis or derived amount rule",
                      row["display_key"], "No legacy formula copied; versioned typed rules require synthetic expected outcomes before activation", True)
            extra += 1
        if value.capability in stateful_caps:
            add_child(row, "STATE_TRANSITION", line, extra, "A validated command attempts a governed lifecycle transition",
                      row["display_key"], "Direct update/delete is replaced by guarded transition, immutable history and corrective command", True)

    children = normalize_rows(children)
    with CHILD_TRACE.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=CHILD_HEADER)
        writer.writeheader()
        writer.writerows(children)

    decisions = decision_rows()
    with DECISION_LOG.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=DECISION_HEADER)
        writer.writeheader()
        writer.writerows(decisions)

    print(f"coverage={len(rows)} children={len(children)} decisions={len(decisions)}")
    print("disposition=" + ",".join(f"{k}:{v}" for k, v in sorted(Counter(r['disposition'] for r in rows).items())))
    print("rule=" + ",".join(f"{k}:{v}" for k, v in sorted(Counter(classified[r['artifact_id']].rule for r in rows).items())))


def decision_rows() -> list[dict[str, str]]:
    shared = {
        "session_id": "HRIS-HRM",
        "status": "DECIDED",
        "due_at": "",
        "blocking_gate": "G2",
        "decided_at": "2026-09-10T09:00:00+09:00",
        "notes": "G1 design decision backed by approved product direction; formal G2-CODE-GO still requires named role binding and Integration Control checkpoint.",
    }
    specs = [
        ("HRM-DEC-001", "People and organization SoR", "ARCHITECTURE", "Which system owns person, worker, assignment and organization?", "Reuse DWP canonical stores|Copy SKKF stores|External-only projection", "Reuse and strengthen DWP People as canonical SoR", "ROLE.ARCHITECTURE_AUTHORITY", "ROLE.HRIS_HRM_PRODUCT_OWNER|ROLE.DBA_AUTHORITY", "HRM_FOUNDATION", "HRIS-porting-master-plan.md; target-table-catalog.md", "DWP owns canonical public IDs, effective-dated records and owner events; no SKKF table clone."),
        ("HRM-DEC-002", "Employment lifecycle", "PROCESS", "How are hire, appointment, change, contract and separation mutations represented?", "Direct CRUD|Versioned command and workflow|Legacy screen replication", "Versioned command, validation, approval, publish and corrective event", "ROLE.HRIS_HRM_PRODUCT_OWNER", "ROLE.HRIS_HRM_SME|ROLE.ARCHITECTURE_AUTHORITY", "HRM_LIFECYCLE", "HRIS-porting-master-plan.md; session-prompts/01-cloudhr-hrm-session.md", "Replace fragmented CRUD with guarded lifecycle aggregates and immutable history."),
        ("HRM-DEC-003", "People 360 and widgets", "UX_ARCHITECTURE", "How are numerous profile/detail/statistics screens presented?", "One route per source screen|People 360 sections and workbenches|Drop all details", "People 360 plus role-aware workbenches and home widgets", "ROLE.HRIS_HRM_PRODUCT_OWNER", "ROLE.HRIS_HRM_SME|ROLE.HRIS_SYS_PRODUCT_OWNER", "HRM_INFORMATION_ARCHITECTURE", "uiux-and-menu-blueprint.md; session-prompts/01-cloudhr-hrm-session.md", "Consolidate list/detail/tab aliases while preserving every business behavior in child trace."),
        ("HRM-DEC-004", "Reference and template configuration", "CONFIGURATION", "How are codes, metadata, appointment standards and templates customized?", "Hardcode|Tenant fork|Versioned typed configuration", "Versioned typed configuration with validate, simulate, approve and publish", "ROLE.HRIS_SYS_PRODUCT_OWNER", "ROLE.HRIS_HRM_PRODUCT_OWNER|ROLE.SECURITY_AUTHORITY", "HRM_CONFIGURATION", "target-table-catalog.md; HRIS-porting-master-plan.md", "Use product core defaults plus effective-dated tenant configuration; no company branch."),
        ("HRM-DEC-005", "DWP common platforms", "REUSE", "Should HRM own users, approvals, notifications, portal and object delivery?", "Build HRM copies|Reuse DWP platforms", "Reuse DWP Identity, Approval, Notification, Audit, Object Storage and shell", "ROLE.ARCHITECTURE_AUTHORITY", "ROLE.AUTH_PLATFORM_OWNER|ROLE.HRIS_SYS_PRODUCT_OWNER", "SHARED_PLATFORM", "session-prompts/00-common-session-contract.md; authorization-blueprint.md", "HRM stores business correlation and evidence references only; platform remains system owner."),
        ("HRM-DEC-006", "Workforce integrations", "EXTENSIBILITY", "How are KeyFoundry, Workday, ERP and other company interfaces migrated?", "Embed provider branches|Generic contract plus adapters|Ignore", "Generic ingestion/mapping/reconciliation core with typed provider adapters", "ROLE.ARCHITECTURE_AUTHORITY", "ROLE.HRIS_HRM_PRODUCT_OWNER|ROLE.SECURITY_AUTHORITY", "HRM_INTEGRATION", "HRIS-porting-master-plan.md; target-table-catalog.md", "Transport and credentials stay in DWP integration control; HRM owns semantic validation and projection."),
        ("HRM-DEC-007", "HRM jobs", "OPERATIONS", "Where are HRM batch schedules and runs managed?", "Each HRIS app scheduler|Central DWP automation|Copy reflection batch", "Central DWP automation control plane with code-owned HRM job manifests", "ROLE.HRIS_SYS_PRODUCT_OWNER", "ROLE.HRIS_HRM_PRODUCT_OWNER|ROLE.ARCHITECTURE_AUTHORITY", "HRM_JOB_CONTROL", "session-prompts/00-common-session-contract.md; full-module-readiness-revalidation-2026-09-10.md", "Scheduler is centralized; execution remains in owner service with receipt, lease, retry and DLQ."),
        ("HRM-DEC-008", "BENSK and ADDSK", "SCOPE", "Can customer-specific BENSK or ADDSK behavior enter product core?", "Include|Exclude or signed extension", "Exclude BENSK/ADDSK; only independently justified generic contracts may exist", "ROLE.HRIS_HRM_PRODUCT_OWNER", "ROLE.SECURITY_AUTHORITY|ROLE.LEGAL_SOURCE_RIGHTS", "CUSTOMER_CONTAMINATION", "session-prompts/00-common-session-contract.md; customer-specific-contamination-register.csv", "Two BENSK routes are retired and no excluded source is opened or implemented."),
        ("HRM-DEC-009", "Legacy technical surfaces", "RETIREMENT", "What happens to samples, publishing demos, duplicate portal/loading and unsafe utility endpoints?", "Migrate|Retire|Keep hidden", "Retire and prove absence from target runtime", "ROLE.HRIS_HRM_PRODUCT_OWNER", "ROLE.SECURITY_AUTHORITY|ROLE.QA_EVIDENCE", "LEGACY_RETIREMENT", "HRIS-porting-master-plan.md; session-prompts/01-cloudhr-hrm-session.md", "Preserve trace only; useful widget meaning is rebuilt through governed home contracts."),
        ("HRM-DEC-010", "Company-specific rewards", "EXTENSION", "How is non-universal fuel-support behavior handled?", "Core table and menu|Tenant config|Signed extension", "Signed tenant extension with declared capabilities", "ROLE.HRIS_HRM_PRODUCT_OWNER", "ROLE.HRIS_SYS_PRODUCT_OWNER|ROLE.SECURITY_AUTHORITY", "TENANT_EXTENSION", "HRIS-porting-master-plan.md; modern-hris-capability-roadmap.csv", "No customer reward policy is hardcoded into Core HR."),
        ("HRM-DEC-011", "Sensitive fields and retention", "PRIVACY", "How are identifiers, bank, family, accessibility and documents protected?", "Broad HR role|Purpose-bound field policy|Client hiding", "Purpose-bound owner PEP with VIEW/MASK/OMIT, step-up and retention", "ROLE.PRIVACY_AUTHORITY", "ROLE.SECURITY_AUTHORITY|ROLE.HRIS_HRM_PRODUCT_OWNER", "HRM_PRIVACY", "authorization-blueprint.md; target-table-catalog.md", "API and repository enforce population and field decisions; UI projection is not an authorization boundary."),
        ("HRM-DEC-012", "Security-blocked artifacts", "SECURITY", "How are blocked metadata-export and template assets handled without source access?", "Infer behavior|Open raw source|Safe DWP substitute", "Safe DWP typed metadata and template contracts without legacy inference", "ROLE.SECURITY_AUTHORITY", "ROLE.HRIS_HRM_PRODUCT_OWNER|ROLE.LEGAL_SOURCE_RIGHTS", "BLOCKED_SOURCE_SUBSTITUTE", "g0/source-security-evidence/coverage-sanitized-access-register.csv; g0/source-governance-decision.md", "Blocked bytes remain unopened; exposed artifact identity is mapped to a product-safe substitute."),
        ("HRM-DEC-013", "Downstream contracts", "INTEGRATION_CONTRACT", "How do TIM, PAY and PER consume people and organization data?", "Database join|Mutable shared table|Versioned snapshot and event", "Versioned snapshot/bootstrap plus transactional owner events", "ROLE.ARCHITECTURE_AUTHORITY", "ROLE.HRIS_HRM_PRODUCT_OWNER|ROLE.HRIS_TIM_PRODUCT_OWNER|ROLE.HRIS_PAY_PRODUCT_OWNER|ROLE.HRIS_PER_PRODUCT_OWNER", "CROSS_MODULE_SNAPSHOT", "session-prompts/01-cloudhr-hrm-session.md; target-table-catalog.md", "No cross-context repository access; consumers use public IDs, schema versions, cursor and inbox idempotency."),
        ("HRM-DEC-014", "Physical data design", "DATA_ARCHITECTURE", "What physical integrity model applies to HRM?", "Legacy tables|Current tables unchanged|Tenant composite keys, half-open ranges and immutable events", "Strengthen current DWP tables and add governed HRM aggregates", "ROLE.DBA_AUTHORITY", "ROLE.ARCHITECTURE_AUTHORITY|ROLE.HRIS_HRM_PRODUCT_OWNER", "HRM_PHYSICAL_SCHEMA", "target-table-catalog.md; session-evidence/hrm/g2-readiness/physical-schema-blueprint.sql", "Use tenant-scoped FK/UK, [from,to) exclusion, optimistic version, append-only publish records and forward correction."),
        ("HRM-DEC-015", "Synthetic golden evidence", "QUALITY", "What proves Core HR correctness without customer production data?", "Wait for customer data|Synthetic versioned golden cases|Happy-path manual test", "Synthetic versioned golden cases plus tenant, authorization, replay and invariant tests", "ROLE.QA_EVIDENCE", "ROLE.HRIS_HRM_SME|ROLE.SECURITY_AUTHORITY|ROLE.PRIVACY_AUTHORITY", "HRM_GOLDEN_TESTS", "session-evidence/hrm/g2-readiness/synthetic-golden-spec.md; session-evidence/hrm/g2-readiness/synthetic-golden-fixtures.json", "Customer data is required only for parity/cutover activation, not for core engine readiness."),
    ]
    rows: list[dict[str, str]] = []
    for spec in specs:
        row = dict(shared)
        for key, value in zip(("decision_id", "scope", "decision_type", "question", "options", "proposed_decision", "owner_role", "consulted_role_ids", "blocking_scope", "evidence_refs", "resolution"), spec):
            row[key] = value
        rows.append(row)
    return rows


if __name__ == "__main__":
    main()
