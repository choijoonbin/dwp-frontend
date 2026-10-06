#!/usr/bin/env python3
"""Fail-closed validator for the HRIS public-API PEP binding register.

The validator intentionally separates source authorization aliases from the DWP
canonical authorization tuple.  TIME_*, LEAVE_*, PAY_*, PAYSLIP_* and YEA_*
labels may occur only in ``source_authorization_alias``; they are never accepted
as a capability, resource, action, population, field group or purpose.

Exit status is 0 only when every public operation in the five G2 contracts has
exactly one register row and every package>duty profile resolves through both
global DWP authorization matrices.  Network-only ``/internal/**`` operations
remain outside the browser count but must close exactly through the companion
service-auth register.  The PER context shares the People deployment unit, so
its Worker snapshot dependency is a typed application port and never a fictional
workload identity or self-HTTP call.
"""

from __future__ import annotations

import argparse
import csv
import json
import pathlib
import re
import sys
from collections import Counter, defaultdict
from typing import Any


HERE = pathlib.Path(__file__).resolve().parent
BLUEPRINT = HERE.parent
REGISTER = HERE / "api-pep-binding-register.csv"
SERVICE_REGISTER = HERE / "service-api-auth-binding-register.csv"
HOME_SECURITY_REGISTER = HERE / "home-materialization-security-register.csv"
HOME_BROWSER_PEP_MATRIX = HERE / "home-browser-pep-matrix.csv"
ATOMIC_DUTIES = BLUEPRINT / "hris-atomic-duty-matrix.csv"
PERSONA_PACKAGES = BLUEPRINT / "hris-permission-group-matrix.csv"
CROSS_CONTRACTS = HERE / "cross-module-contract-register.csv"

HRM_CONTRACT = BLUEPRINT / "session-evidence/hrm/g2-readiness/api-event-contracts.v1.json"
PER_CONTRACT = BLUEPRINT / "session-evidence/per/g2-readiness/api-event-contracts.yaml"
TIM_CONTRACT = BLUEPRINT / "session-evidence/tim/g2-api-event-contracts.json"
PAY_CONTRACT = BLUEPRINT / "session-evidence/pay/g2-api-event-contracts.json"
SYS_CONTRACT = BLUEPRINT / "session-evidence/sys/g2-contract-catalog.csv"

EXPECTED_HEADER = [
    "binding_id",
    "module",
    "source_operation_id",
    "method",
    "contract_path",
    "browser_path",
    "owner_path",
    "owner_service",
    "source_contract",
    "source_authorization_alias",
    "canonical_app_entitlement",
    "authorization_profiles",
    "canonical_capability_keys",
    "canonical_resource_types",
    "canonical_resource_keys",
    "canonical_actions",
    "canonical_population_types",
    "canonical_field_group_keys",
    "purpose_codes",
    "pep_layers",
    "state",
]
EXPECTED_SERVICE_HEADER = [
    "binding_id",
    "module",
    "source_operation_id",
    "method",
    "owner_path",
    "owner_service",
    "source_contract",
    "source_authorization_alias",
    "contract_scope",
    "caller_service_identities",
    "workload_authentication",
    "tenant_propagation",
    "purpose_codes",
    "allowed_consumers",
    "field_projection",
    "transport_controls",
    "audit_binding",
    "replay_idempotency",
    "in_process_consumer",
    "in_process_port",
    "in_process_controls",
    "in_process_projection",
    "in_process_test_allocation",
    "state",
]
EXPECTED_HOME_SECURITY_HEADER = [
    "binding_id",
    "module",
    "source_operation_id",
    "method",
    "delegated_subject_context",
    "delegated_subject_controls",
    "owner_evaluation_order",
    "materialization_projection",
    "browser_widget_types",
    "scope_audience_mapping",
    "field_decision_contract",
    "purpose_code",
    "negative_test_allocation",
    "state",
]
EXPECTED_HOME_BROWSER_PEP_HEADER = [
    "binding_id", "ia_persona", "browser_audience", "access_packages",
    "atomic_duties", "capabilities", "resource_types", "resource_keys",
    "source_permission_codes", "outer_projection_action", "population_types",
    "field_groups", "allowed_widget_types", "allowed_home_field_keys",
    "field_decision_rule", "purpose_code", "negative_tests", "status",
]
EXPECTED_MODULES = ("HRM", "PER", "TIM", "PAY", "SYS")
EXPECTED_APP_ENTITLEMENT = "APP.HCM:VIEW"
EXPECTED_STATE = "G3_BINDING_SPECIFIED_NOT_IMPLEMENTED"
EXPECTED_PEP_LAYERS = {
    "GATEWAY_APP_ENTITLEMENT",
    "OWNER_API_OPERATION",
    "RESOURCE_POPULATION",
    "REPOSITORY_TENANT_PREDICATE",
    "FIELD_PROJECTION",
    "PURPOSE_POLICY",
    "AUDIT_DECISION",
}
EXPECTED_WORKLOAD_AUDIENCE = {
    "dwp-people-server": "OAUTH2_CLIENT_CREDENTIAL_JWT_AUD_DWP_PEOPLE",
    "dwp-time-server": "OAUTH2_CLIENT_CREDENTIAL_JWT_AUD_DWP_TIME",
    "dwp-payroll-server": "OAUTH2_CLIENT_CREDENTIAL_JWT_AUD_DWP_PAYROLL",
}
EXPECTED_TENANT_PROPAGATION = {
    "SIGNED_TENANT_CLAIM",
    "OWNER_TENANT_GRANT_REVALIDATION",
    "TARGET_TENANT_MATCH",
    "NO_CALLER_TENANT_OVERRIDE",
}
EXPECTED_HOME_DELEGATED_CONTEXT = {
    "subjectPrincipalPublicId",
    "effectivePermissionRevision",
    "populationScopeDigest",
    "fieldPolicyRevision",
    "widgetKey",
    "browserAudience",
    "ownerPopulationScope",
    "scopeRevision",
    "correlationId",
}
EXPECTED_HOME_DELEGATED_CONTROLS = {
    "SIGNED_DELEGATED_SUBJECT_CONTEXT",
    "OWNER_SUBJECT_PERMISSION_REEVALUATION",
    "OWNER_POPULATION_SCOPE_REEVALUATION",
    "OWNER_FIELD_POLICY_REEVALUATION",
    "NO_CALLER_SUBJECT_SCOPE_FIELD_OVERRIDE",
}
EXPECTED_HOME_OPERATION_KEYS = {
    ("HRM", "materializeWorkforceHomeContribution", "GET"),
    ("PER", "materializePerformanceHomeContribution", "GET"),
    ("TIM", "home-contribution.internal.query", "GET"),
    ("PAY", "home-contribution.internal.query", "GET"),
}
EXPECTED_HOME_EVALUATION_ORDER = (
    "VERIFY_WORKLOAD_IDENTITY>VERIFY_TENANT_GRANT>VERIFY_DELEGATED_SIGNATURE>"
    "REBIND_SUBJECT_TO_TENANT>REEVALUATE_EFFECTIVE_PERMISSION_REVISION>"
    "REEVALUATE_POPULATION_SCOPE>REEVALUATE_FIELD_POLICY>"
    "VERIFY_WIDGET_AUDIENCE_SCOPE>LOAD_PAYLOAD_REF>VERIFY_PAYLOAD_DIGEST>"
    "PROJECT_FIELDS>VERIFY_TYPED_PROFILE>AUDIT_DECISION"
)
EXPECTED_HOME_PROJECTIONS = {
    "HRM": "PeopleHomeContributionV1",
    "PER": "PerformanceHomeContributionV1",
    "TIM": "TimeLeaveHomeContributionV1",
    "PAY": "PayrollHomeContributionV1",
}
EXPECTED_HOME_WIDGET_TYPES = {
    "HRM": {"PEOPLE_SUMMARY", "ACTION_ITEMS"},
    "PER": {"PERFORMANCE_SUMMARY", "ACTION_ITEMS"},
    "TIM": {"TIME_LEAVE_SUMMARY", "ACTION_ITEMS"},
    "PAY": {"PAYROLL_SUMMARY", "ACTION_ITEMS"},
}
EXPECTED_HOME_SCOPE_AUDIENCE_MAPPING = {
    "HRM": {"SELF>SELF", "TEAM>TEAM", "NAMED_POPULATION>OPERATIONS", "NAMED_POPULATION>EXECUTIVE"},
    "PER": {"SELF>SELF", "TEAM>TEAM", "NAMED_POPULATION>OPERATIONS", "NAMED_POPULATION>EXECUTIVE"},
    "TIM": {"SELF>SELF", "TEAM>TEAM", "TIME_GROUP>OPERATIONS", "TIME_GROUP>EXECUTIVE"},
    "PAY": {"SELF>SELF", "PAY_GROUP>OPERATIONS", "LEGAL_ENTITY>EXECUTIVE"},
}
EXPECTED_HOME_PERSONA_AUDIENCE = {
    "EMPLOYEE": "SELF",
    "MANAGER": "TEAM",
    "OPERATIONS": "OPERATIONS",
    "SETTINGS_ADMIN": "OPERATIONS",
    "ENTERPRISE_AUDITOR": "EXECUTIVE",
}
EXPECTED_HOME_PERSONA_WIDGETS = {
    "EMPLOYEE": {"ACTION_ITEMS", "PAYROLL_SUMMARY", "PEOPLE_SUMMARY", "PERFORMANCE_SUMMARY", "TIME_LEAVE_SUMMARY"},
    "MANAGER": {"ACTION_ITEMS", "PEOPLE_SUMMARY", "PERFORMANCE_SUMMARY", "TIME_LEAVE_SUMMARY"},
    "OPERATIONS": {"ACTION_ITEMS", "PAYROLL_SUMMARY", "PEOPLE_SUMMARY", "PERFORMANCE_SUMMARY", "TIME_LEAVE_SUMMARY"},
    "SETTINGS_ADMIN": {"ACTION_ITEMS"},
    "ENTERPRISE_AUDITOR": {"ACTION_ITEMS", "PAYROLL_SUMMARY", "PEOPLE_SUMMARY", "PERFORMANCE_SUMMARY", "TIME_LEAVE_SUMMARY"},
}
EXPECTED_HOME_FIELD_KEYS = {
    "employmentStatus", "organizationLabel", "pendingActionCount", "clockState",
    "leaveBalanceMinutes", "openTimecardCount", "pendingApprovalCount",
    "payPeriodLabel", "grossPay", "netPay", "payslipAvailable",
    "goalProgress", "reviewStatus", "items",
}
EXPECTED_SERVICE_TRANSPORT = {
    "NO_BROWSER_ROUTE",
    "TLS_1_3",
    "MTLS_REQUIRED",
    "AUDIENCE_PINNED",
    "RATE_LIMITED",
}
EXPECTED_AUDIT_FIELDS = {
    "callerWorkloadId",
    "tenantId",
    "operationId",
    "purposeCode",
    "projectionId",
    "policyRevision",
    "correlationId",
    "outcome",
    "rowCount",
    "payloadDigest",
}
EXPECTED_SERVICE_CALLERS = {
    ("HRM", "recordEmployeeChangeDecision"): {"dwp-approval-server"},
    ("HRM", "bootstrapWorkforceSnapshots"): {
        "dwp-time-server",
        "dwp-payroll-server",
    },
    ("HRM", "bootstrapCompensationBasisSnapshots"): {"dwp-payroll-server"},
    ("HRM", "bootstrapWorkplaceAssignmentSnapshots"): {"dwp-time-server"},
    ("HRM", "bootstrapPayrollWorkerFactSnapshots"): {"dwp-payroll-server"},
    ("HRM", "materializeWorkforceHomeContribution"): {"dwp-platform-server"},
    ("PER", "getApprovedCompensationPlanSnapshot"): {"dwp-payroll-server"},
    ("PER", "materializePerformanceHomeContribution"): {"dwp-platform-server"},
    ("TIM", "closed-time-result.internal.query"): {"dwp-payroll-server"},
    ("TIM", "home-contribution.internal.query"): {"dwp-platform-server"},
    ("PAY", "home-contribution.internal.query"): {"dwp-platform-server"},
}
EXPECTED_INTERNAL_PREFIX = {
    "HRM": "/internal/hris-people/v1/",
    "PER": "/internal/hris-performance/v1/",
    "TIM": "/internal/hris-time/v1/",
    "PAY": "/internal/hris-payroll/v1/",
}
EXPECTED_CONTRACT_SCOPE = {
    **{key: "SOURCE_INTERNAL_OPERATION" for key in (
        ("HRM", "recordEmployeeChangeDecision"),
        ("HRM", "bootstrapWorkforceSnapshots"),
        ("HRM", "bootstrapCompensationBasisSnapshots"),
        ("HRM", "bootstrapWorkplaceAssignmentSnapshots"),
        ("HRM", "bootstrapPayrollWorkerFactSnapshots"),
    )},
    ("HRM", "materializeWorkforceHomeContribution"): "TARGET_HOME_MATERIALIZATION",
    ("PER", "getApprovedCompensationPlanSnapshot"): "TARGET_CROSS_MODULE_REFETCH",
    ("PER", "materializePerformanceHomeContribution"): "TARGET_HOME_MATERIALIZATION",
    ("TIM", "closed-time-result.internal.query"): "TARGET_CROSS_MODULE_REFETCH",
    ("TIM", "home-contribution.internal.query"): "TARGET_HOME_MATERIALIZATION",
    ("PAY", "home-contribution.internal.query"): "TARGET_HOME_MATERIALIZATION",
}
EXPECTED_IN_PROCESS_CONSUMER = "dwp-people-server/hris/performance"
EXPECTED_IN_PROCESS_PORT = "WorkforceSnapshotQueryPort.v1"
EXPECTED_IN_PROCESS_CONTROLS = {
    "TYPED_APPLICATION_PORT",
    "NO_SELF_HTTP",
    "MODULE_BOUNDARY_ENFORCED",
    "TENANT_CONTEXT_REQUIRED",
    "PURPOSE_REQUIRED",
    "PER_FIELD_PROJECTION_ONLY",
}
EXPECTED_IN_PROCESS_TESTS = {
    "../session-evidence/hrm/g4/internal/workforce-snapshot-per-provider-contract.json",
    "../session-evidence/per/g4/internal/workforce-snapshot-per-consumer-contract.json",
    "../session-evidence/per/g4/internal/workforce-snapshot-tenant-purpose-field-negative.json",
}
EXPECTED_RECEIPT_PEP = {
    ("HRM", "getCommandReceipt", "GET"): {
        "browser_path": "/api/people/v1/hris/command-receipts/{receiptId}",
        "owner_service": "dwp-people-server",
        "capability": "hcm.command-receipt.view",
        "resource": "DATA.HRIS_COMMAND_RECEIPT",
        "duty": "HRIS_DUTY_COMMAND_RECEIPT_READER",
    },
    ("PER", "getCommandReceipt", "GET"): {
        "browser_path": "/api/people/v1/hris/performance/command-receipts/{receiptId}",
        "owner_service": "dwp-people-server",
        "capability": "per.command-receipt.view",
        "resource": "DATA.HRIS_PERFORMANCE_COMMAND_RECEIPT",
        "duty": "HRIS_DUTY_PERFORMANCE_COMMAND_RECEIPT_READER",
    },
    ("TIM", "command.receipt.query", "GET"): {
        "browser_path": "/api/time/v1/command-receipts/{receiptId}",
        "owner_service": "dwp-time-server",
        "capability": "hcm.command-receipt.view",
        "resource": "DATA.HRIS_COMMAND_RECEIPT",
        "duty": "HRIS_DUTY_COMMAND_RECEIPT_READER",
    },
    ("PAY", "command.receipt.query", "GET"): {
        "browser_path": "/api/payroll/v1/command-receipts/{receiptId}",
        "owner_service": "dwp-payroll-server",
        "capability": "hcm.command-receipt.view",
        "resource": "DATA.HRIS_COMMAND_RECEIPT",
        "duty": "HRIS_DUTY_COMMAND_RECEIPT_READER",
    },
    ("SYS", "SYS-API-037", "GET"): {
        "browser_path": "/api/auth/v1/admin/hris/command-receipts/{receiptId}",
        "owner_service": "dwp-auth-server",
        "capability": "hcm.command-receipt.view",
        "resource": "DATA.HRIS_COMMAND_RECEIPT",
        "duty": "HRIS_DUTY_COMMAND_RECEIPT_READER",
    },
    ("SYS", "SYS-API-038", "GET"): {
        "browser_path": "/api/platform/v1/admin/hris/command-receipts/{receiptId}",
        "owner_service": "dwp-platform-server",
        "capability": "hcm.command-receipt.view",
        "resource": "DATA.HRIS_COMMAND_RECEIPT",
        "duty": "HRIS_DUTY_COMMAND_RECEIPT_READER",
    },
}
METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE"}
PURPOSE_PATTERN = re.compile(r"^[A-Z][A-Z0-9_]*$")
PACKAGE_PATTERN = re.compile(r"^HRIS_[A-Z0-9_]+$")
DUTY_PATTERN = re.compile(r"^HRIS_DUTY_[A-Z0-9_]+$")


def pipe_set(value: str) -> set[str]:
    return {part.strip() for part in value.split("|") if part.strip()}


def normalize_alias(value: str) -> set[str]:
    """Treat a machine-readable capability list as order-independent."""
    return pipe_set(value.replace(" or ", "|"))


def read_csv(path: pathlib.Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        return list(reader.fieldnames or []), list(reader)


def rel(path: pathlib.Path) -> str:
    return "../" + path.relative_to(BLUEPRINT).as_posix()


def public_operation(
    module: str,
    operation_id: str,
    method: str,
    path: str,
    owner_service: str,
    source_contract: pathlib.Path,
    alias: str,
    alias_present: bool = True,
) -> dict[str, Any]:
    return {
        "module": module,
        "source_operation_id": operation_id,
        "method": method,
        "observed_contract_path": path,
        "owner_service": owner_service,
        "source_contract": rel(source_contract),
        "source_authorization_alias": alias,
        "authorization_metadata_present": alias_present,
    }


def extract_hrm() -> tuple[list[dict[str, Any]], list[dict[str, str]]]:
    contract = json.loads(HRM_CONTRACT.read_text(encoding="utf-8"))
    base = contract["basePath"].rstrip("/")
    operations: list[dict[str, Any]] = []
    excluded: list[dict[str, str]] = []
    for endpoint in contract["endpoints"]:
        path = endpoint["path"]
        if path.startswith("/internal/"):
            excluded.append({
                "module": "HRM",
                "sourceOperationId": endpoint["operationId"],
                "method": endpoint["method"],
                "path": path,
                "ownerService": contract["owner"],
                "sourceContract": rel(HRM_CONTRACT),
                "sourceAuthorizationAlias": endpoint.get("capability", ""),
                "reason": "SERVICE_ONLY_REQUIRES_SEPARATE_SERVICE_AUTH_REGISTRY",
            })
            continue
        operations.append(public_operation(
            "HRM",
            endpoint["operationId"],
            endpoint["method"],
            base + path,
            contract["owner"],
            HRM_CONTRACT,
            endpoint.get("capability", ""),
            bool(endpoint.get("capability")),
        ))
    return operations, excluded


def parse_inline_yaml_list(value: str) -> str:
    value = value.strip()
    if value.startswith("[") and value.endswith("]"):
        value = value[1:-1]
    values = [item.strip().strip("'\"") for item in value.split(",") if item.strip()]
    return "|".join(values)


def extract_per() -> tuple[list[dict[str, Any]], list[dict[str, str]]]:
    """Parse the deliberately simple OpenAPI layout without a YAML dependency."""
    lines = PER_CONTRACT.read_text(encoding="utf-8").splitlines()
    base = ""
    for line in lines:
        match = re.match(r"^\s*- url:\s*(\S+)\s*$", line)
        if match:
            base = match.group(1).rstrip("/")
            break
    if not base:
        raise ValueError("PER OpenAPI server URL is missing")

    raw_operations: list[dict[str, Any]] = []
    current_path: str | None = None
    current_method: str | None = None
    current: dict[str, Any] | None = None
    block_capabilities = False

    def finish() -> None:
        nonlocal current
        if current is not None:
            raw_operations.append(current)
            current = None

    for line in lines:
        path_match = re.match(r"^  (/[^:]+):\s*$", line)
        if path_match:
            finish()
            current_path = path_match.group(1)
            current_method = None
            block_capabilities = False
            continue
        method_match = re.match(r"^    (get|post|put|patch|delete):\s*$", line)
        if method_match:
            finish()
            current_method = method_match.group(1).upper()
            block_capabilities = False
            continue
        operation_match = re.match(r"^      operationId:\s*(\S+)\s*$", line)
        if operation_match and current_path and current_method:
            finish()
            current = {
                "id": operation_match.group(1),
                "method": current_method,
                "path": (
                    current_path
                    if current_path.startswith("/internal/")
                    else base + current_path
                ),
                "capabilities": [],
            }
            block_capabilities = False
            continue
        if current is None:
            continue
        scalar_match = re.match(r"^      x-dwp-capability:\s*([^#]+?)\s*$", line)
        if scalar_match:
            current["capabilities"].append(scalar_match.group(1).strip().strip("'\""))
            block_capabilities = False
            continue
        list_match = re.match(r"^      x-dwp-capabilities:\s*(.*?)\s*$", line)
        if list_match:
            inline = list_match.group(1)
            if inline:
                current["capabilities"].extend(parse_inline_yaml_list(inline).split("|"))
                block_capabilities = False
            else:
                block_capabilities = True
            continue
        if block_capabilities:
            item_match = re.match(r"^        -\s*([^#]+?)\s*$", line)
            if item_match:
                current["capabilities"].append(item_match.group(1).strip().strip("'\""))
                continue
            if line and not line.startswith("        "):
                block_capabilities = False
    finish()

    public: list[dict[str, Any]] = []
    internal: list[dict[str, str]] = []
    for item in raw_operations:
        alias = "|".join(item["capabilities"])
        if item["path"].startswith("/internal/"):
            internal.append({
                "module": "PER",
                "sourceOperationId": item["id"],
                "method": item["method"],
                "path": item["path"],
                "ownerService": "dwp-people-server",
                "sourceContract": rel(PER_CONTRACT),
                "sourceAuthorizationAlias": alias,
                "reason": "SERVICE_ONLY_REQUIRES_SEPARATE_SERVICE_AUTH_REGISTRY",
            })
        else:
            public.append(public_operation(
                "PER",
                item["id"],
                item["method"],
                item["path"],
                "dwp-people-server",
                PER_CONTRACT,
                alias,
                bool(item["capabilities"]),
            ))
    return public, internal


def extract_json_operations(
    module: str,
    path: pathlib.Path,
) -> tuple[list[dict[str, Any]], list[dict[str, str]]]:
    contract = json.loads(path.read_text(encoding="utf-8"))
    public: list[dict[str, Any]] = []
    internal: list[dict[str, str]] = []
    operations: list[dict[str, Any]] = list(contract.get("operations", []))
    operations.extend(contract.get("internalOperations", []))
    for operation in operations:
        alias = operation.get("action", operation.get("capability", ""))
        if operation["path"].startswith("/internal/"):
            internal.append({
                "module": module,
                "sourceOperationId": operation["id"],
                "method": operation["method"],
                "path": operation["path"],
                "ownerService": contract["owner"],
                "sourceContract": rel(path),
                "sourceAuthorizationAlias": alias,
                "reason": "SERVICE_ONLY_REQUIRES_SEPARATE_SERVICE_AUTH_REGISTRY",
            })
        else:
            public.append(public_operation(
                module,
                operation["id"],
                operation["method"],
                operation["path"],
                contract["owner"],
                path,
                alias,
                bool(alias),
            ))
    return public, internal


def extract_sys() -> list[dict[str, Any]]:
    _, contracts = read_csv(SYS_CONTRACT)
    operations: list[dict[str, Any]] = []
    for contract in contracts:
        if contract["kind"] != "HTTP":
            continue
        for method in contract["operation_or_version"].split("|"):
            operations.append(public_operation(
                "SYS",
                contract["contract_id"],
                method,
                contract["path_or_event"],
                contract["owner"],
                SYS_CONTRACT,
                contract.get("authorization", ""),
                bool(contract.get("authorization")),
            ))
    return operations


def source_operations() -> tuple[list[dict[str, Any]], list[dict[str, str]]]:
    hrm, hrm_internal = extract_hrm()
    per, per_internal = extract_per()
    tim, tim_internal = extract_json_operations("TIM", TIM_CONTRACT)
    pay, pay_internal = extract_json_operations("PAY", PAY_CONTRACT)
    return (
        hrm
        + per
        + tim
        + pay
        + extract_sys(),
        hrm_internal + per_internal + tim_internal + pay_internal,
    )


def key(row: dict[str, Any]) -> tuple[str, str, str]:
    return row["module"], row["source_operation_id"], row["method"]


def expected_paths(row: dict[str, str]) -> tuple[str, str]:
    module = row["module"]
    browser = row["browser_path"]
    prefix = {
        "HRM": "/api/people",
        "PER": "/api/people",
        "TIM": "/api/time",
        "PAY": "/api/payroll",
        "SYS": "/api/auth" if row["owner_service"] == "dwp-auth-server" else "/api/platform",
    }[module]
    return browser if module in {"HRM", "PER", "SYS"} else browser.removeprefix(prefix), browser.removeprefix(prefix)


def canonical_union(duty_rows: list[dict[str, str]], field: str) -> set[str]:
    result: set[str] = set()
    for duty in duty_rows:
        result.update(pipe_set(duty[field]))
    return result


def parse_projection(value: str) -> tuple[dict[str, set[str]], list[str]]:
    projections: dict[str, set[str]] = {}
    errors: list[str] = []
    for segment in value.split(";"):
        segment = segment.strip()
        if not segment:
            continue
        if segment.count("=") != 1:
            errors.append(f"invalid projection segment {segment}")
            continue
        projection_id, fields = segment.split("=", 1)
        if not projection_id or projection_id in projections:
            errors.append(f"blank or duplicate projection id {projection_id}")
            continue
        field_set = {field for field in fields.split("+") if field}
        if not field_set or "*" in field_set:
            errors.append(f"empty or wildcard projection {projection_id}")
        projections[projection_id] = field_set
    return projections, errors


def expected_service_projections() -> dict[tuple[str, str], dict[str, set[str]]]:
    contract = json.loads(HRM_CONTRACT.read_text(encoding="utf-8"))
    schemas = contract["schemas"]
    workforce_consumers = {
        "TIM": "dwp-time-server",
        "PAY": "dwp-payroll-server",
    }
    _, cross_rows = read_csv(CROSS_CONTRACTS)
    cross_by_id = {row["contract_id"]: row for row in cross_rows}
    home_fields = {
        "module",
        "widgetKey",
        "widgetType",
        "browserAudience",
        "ownerPopulationScope",
        "scopeRevision",
        "populationScopeDigest",
        "fieldPolicyRevision",
        "purposeCode",
        "state",
        "generatedAt",
        "freshUntil",
        "staleAfter",
        "deepLink",
        "sourceVersion",
        "payloadRef",
        "payloadDigest",
        "asOf",
        "data",
        "fieldDecisions",
        "partialFailures",
    }
    result: dict[tuple[str, str], dict[str, set[str]]] = {
        ("HRM", "recordEmployeeChangeDecision"): {
            "dwp-approval-server/ApprovalDecisionCallbackV1": {
                "approvalRequestId",
                "decisionEventId",
                "decision",
                "decidedAt",
                "decisionActorPublicId",
                "approvalPolicyRevision",
                "correlationId",
                "payloadDigest",
            }
        },
        ("HRM", "bootstrapWorkforceSnapshots"): {
            f"{workforce_consumers[consumer]}/WorkforceSnapshotV1": set(fields)
            for consumer, fields in schemas["WorkforceSnapshotV1"]["consumerProjections"].items()
            if consumer in workforce_consumers
        },
        ("HRM", "bootstrapCompensationBasisSnapshots"): {
            "dwp-payroll-server/CompensationBasisSnapshotV1": set(
                schemas["CompensationBasisSnapshotV1"]["required"]
            )
            | set(schemas["CompensationBasisSnapshotV1"].get("restrictedOptional", []))
        },
        ("HRM", "bootstrapWorkplaceAssignmentSnapshots"): {
            "dwp-time-server/WorkplaceAssignmentSnapshotV1": set(
                schemas["WorkplaceAssignmentSnapshotV1"]["required"]
            )
        },
        ("HRM", "bootstrapPayrollWorkerFactSnapshots"): {},
        ("HRM", "materializeWorkforceHomeContribution"): {
            "dwp-platform-server/PeopleHomeContributionV1": home_fields,
        },
        ("PER", "getApprovedCompensationPlanSnapshot"): {
            "dwp-payroll-server/ApprovedCompensationPlanSnapshotV1": pipe_set(
                cross_by_id["XCON-020"]["required_fields"]
            ),
            "dwp-payroll-server/ApprovedCompensationPlanLineV1": pipe_set(
                cross_by_id["XCON-020"]["nested_required_fields"]
            ),
        },
        ("PER", "materializePerformanceHomeContribution"): {
            "dwp-platform-server/PerformanceHomeContributionV1": home_fields,
        },
        ("TIM", "closed-time-result.internal.query"): {
            "dwp-payroll-server/ClosedTimeResultV1": pipe_set(
                cross_by_id["XCON-008"]["required_fields"]
            ),
            "dwp-payroll-server/ClosedTimeResultLineV1": pipe_set(
                cross_by_id["XCON-008"]["nested_required_fields"]
            ),
        },
        ("TIM", "home-contribution.internal.query"): {
            "dwp-platform-server/TimeLeaveHomeContributionV1": home_fields,
        },
        ("PAY", "home-contribution.internal.query"): {
            "dwp-platform-server/PayrollHomeContributionV1": home_fields,
        },
    }
    for schema_name in (
        "WorkerDependentEligibilitySnapshotV1",
        "WorkerTaxIdentitySnapshotV1",
        "WorkerBankAccountTokenSnapshotV1",
    ):
        result[("HRM", "bootstrapPayrollWorkerFactSnapshots")][
            f"dwp-payroll-server/{schema_name}"
        ] = set(schemas[schema_name]["required"])
    return result


def expected_in_process_projection() -> dict[str, set[str]]:
    contract = json.loads(HRM_CONTRACT.read_text(encoding="utf-8"))
    fields = contract["schemas"]["WorkforceSnapshotV1"]["consumerProjections"]["PER"]
    return {
        "dwp-people-server/hris/performance/WorkforceSnapshotV1": set(fields),
    }


def service_key(row: dict[str, Any]) -> tuple[str, str, str]:
    operation_id = row.get("source_operation_id", row.get("sourceOperationId", ""))
    return row["module"], operation_id, row["method"]


def validate() -> dict[str, Any]:
    blockers: list[str] = []
    detail: dict[str, Any] = {
        "coverageMissing": [],
        "coverageExtra": [],
        "duplicateSourceKeys": [],
        "contractPathMismatches": [],
        "routeMismatches": [],
        "ownerMismatches": [],
        "sourceAliasMismatches": [],
        "missingMachineReadablePerAuthorization": [],
        "missingDuties": [],
        "missingPackageDutyMembership": [],
        "canonicalTupleMismatches": [],
        "rowInvariantErrors": [],
        "serviceCoverageMissing": [],
        "serviceCoverageExtra": [],
        "serviceDuplicateSourceKeys": [],
        "serviceContractPathMismatches": [],
        "serviceAuthorizationMismatches": [],
        "serviceProjectionMismatches": [],
        "serviceRowInvariantErrors": [],
        "inProcessBoundaryMismatches": [],
        "homeMaterializationSecurityMismatches": [],
        "homeBrowserPepMismatches": [],
        "receiptPepMismatches": [],
    }

    header, rows = read_csv(REGISTER)
    if header != EXPECTED_HEADER:
        blockers.append(f"register header mismatch expected={EXPECTED_HEADER} actual={header}")
        rows = []
    service_header, service_rows = read_csv(SERVICE_REGISTER)
    if service_header != EXPECTED_SERVICE_HEADER:
        blockers.append(
            f"service register header mismatch expected={EXPECTED_SERVICE_HEADER} actual={service_header}"
        )
        service_rows = []
    home_security_header, home_security_rows = read_csv(HOME_SECURITY_REGISTER)
    if home_security_header != EXPECTED_HOME_SECURITY_HEADER:
        blockers.append(
            f"home security register header mismatch expected={EXPECTED_HOME_SECURITY_HEADER} actual={home_security_header}"
        )
        home_security_rows = []
    home_browser_header, home_browser_rows = read_csv(HOME_BROWSER_PEP_MATRIX)
    if home_browser_header != EXPECTED_HOME_BROWSER_PEP_HEADER:
        blockers.append(
            f"home browser PEP header mismatch expected={EXPECTED_HOME_BROWSER_PEP_HEADER} actual={home_browser_header}"
        )
        home_browser_rows = []

    duty_header, duty_rows = read_csv(ATOMIC_DUTIES)
    package_header, package_rows = read_csv(PERSONA_PACKAGES)
    if "duty_code" not in duty_header:
        blockers.append("atomic duty matrix has no duty_code column")
    if "package_code" not in package_header:
        blockers.append("permission group matrix has no package_code column")
    duties = {row["duty_code"]: row for row in duty_rows} if "duty_code" in duty_header else {}
    packages = (
        {row["package_code"]: row for row in package_rows}
        if "package_code" in package_header
        else {}
    )

    try:
        source_rows, excluded = source_operations()
    except Exception as exc:  # fail closed while retaining machine-readable output
        blockers.append(f"source contract extraction failed: {type(exc).__name__}: {exc}")
        source_rows, excluded = [], []
    legacy_source_aliases = {
        alias
        for source in source_rows
        if source["module"] in {"TIM", "PAY"}
        for alias in pipe_set(source["source_authorization_alias"])
    }

    register_by_key: dict[tuple[str, str, str], dict[str, str]] = {}
    source_by_key: dict[tuple[str, str, str], dict[str, Any]] = {}
    binding_ids: set[str] = set()

    for row_number, row in enumerate(rows, start=2):
        row_key = key(row)
        row_errors: list[str] = []
        if row["binding_id"] in binding_ids:
            row_errors.append(f"duplicate binding_id {row['binding_id']}")
        binding_ids.add(row["binding_id"])
        if row_key in register_by_key:
            row_errors.append(f"duplicate operation key {'/'.join(row_key)}")
        register_by_key[row_key] = row
        if row["module"] not in EXPECTED_MODULES:
            row_errors.append(f"unknown module {row['module']}")
        if not re.fullmatch(rf"PEP-{re.escape(row['module'])}-\d{{3}}", row["binding_id"]):
            row_errors.append(f"invalid binding_id {row['binding_id']}")
        if row["method"] not in METHODS:
            row_errors.append(f"invalid HTTP method {row['method']}")
        if row["state"] != EXPECTED_STATE:
            row_errors.append(f"state must be {EXPECTED_STATE}")
        if row["canonical_app_entitlement"] != EXPECTED_APP_ENTITLEMENT:
            row_errors.append(f"canonical app entitlement must be {EXPECTED_APP_ENTITLEMENT}")
        if pipe_set(row["pep_layers"]) != EXPECTED_PEP_LAYERS:
            row_errors.append("PEP layer set is incomplete or contains an undeclared layer")
        if not pipe_set(row["purpose_codes"]):
            row_errors.append("purpose_codes is empty")
        for purpose_code in pipe_set(row["purpose_codes"]):
            if not PURPOSE_PATTERN.fullmatch(purpose_code):
                row_errors.append(f"invalid purpose code {purpose_code}")
        expected_contract_path, expected_owner_path = expected_paths(row)
        if row["contract_path"] != expected_contract_path:
            detail["routeMismatches"].append({
                "key": "/".join(row_key),
                "field": "contract_path",
                "expected": expected_contract_path,
                "actual": row["contract_path"],
            })
        if row["owner_path"] != expected_owner_path:
            detail["routeMismatches"].append({
                "key": "/".join(row_key),
                "field": "owner_path",
                "expected": expected_owner_path,
                "actual": row["owner_path"],
            })
        required_browser_prefix = {
            "HRM": "/api/people/v1/hris/",
            "PER": "/api/people/v1/hris/performance/",
            "TIM": "/api/time/v1/",
            "PAY": "/api/payroll/v1/",
        }.get(row["module"], "")
        if row["module"] == "SYS":
            if row["owner_service"] == "dwp-auth-server":
                required_browser_prefix = "/api/auth/v1/admin/hris/"
            elif row["source_operation_id"] in {
                "SYS-API-026", "SYS-API-027", "SYS-API-039", "SYS-API-040"
            }:
                required_browser_prefix = "/api/platform/v1/hris/"
            elif row["source_operation_id"] in {"SYS-API-031", "SYS-API-032"}:
                required_browser_prefix = "/api/platform/v1/home-preferences/"
            else:
                required_browser_prefix = "/api/platform/v1/admin/hris/"
        if required_browser_prefix and not row["browser_path"].startswith(required_browser_prefix):
            detail["routeMismatches"].append({
                "key": "/".join(row_key),
                "field": "browser_path",
                "expectedPrefix": required_browser_prefix,
                "actual": row["browser_path"],
            })

        canonical_fields = (
            "canonical_capability_keys",
            "canonical_resource_types",
            "canonical_resource_keys",
            "canonical_actions",
            "canonical_population_types",
            "canonical_field_group_keys",
            "purpose_codes",
        )
        for field in canonical_fields:
            if not pipe_set(row[field]):
                row_errors.append(f"{field} is empty")
            leaked_aliases = sorted(token for token in pipe_set(row[field]) if token in legacy_source_aliases)
            if leaked_aliases:
                row_errors.append(f"source aliases leaked into {field}: {'|'.join(leaked_aliases)}")

        profile_values = pipe_set(row["authorization_profiles"])
        if not profile_values:
            row_errors.append("authorization_profiles is empty")
        resolved_duties: list[dict[str, str]] = []
        unresolved = False
        for value in sorted(profile_values):
            if value.count(">") != 1:
                row_errors.append(f"invalid authorization profile {value}")
                unresolved = True
                continue
            package_code, duty_code = value.split(">", 1)
            if not PACKAGE_PATTERN.fullmatch(package_code):
                row_errors.append(f"invalid package code {package_code}")
            if not DUTY_PATTERN.fullmatch(duty_code):
                row_errors.append(f"invalid duty code {duty_code}")
            package = packages.get(package_code)
            duty = duties.get(duty_code)
            if package is None:
                row_errors.append(f"unknown persona package {package_code}")
                unresolved = True
            elif package.get("canonical_app_entitlement") != row["canonical_app_entitlement"]:
                row_errors.append(
                    f"package {package_code} entitlement {package.get('canonical_app_entitlement')} "
                    f"does not equal {row['canonical_app_entitlement']}"
                )
            if duty is None:
                detail["missingDuties"].append({
                    "dutyCode": duty_code,
                    "packageCode": package_code,
                    "operationKey": "/".join(row_key),
                })
                unresolved = True
            else:
                resolved_duties.append(duty)
            if package is not None and duty_code not in pipe_set(package.get("atomic_duty_codes", "")):
                detail["missingPackageDutyMembership"].append({
                    "packageCode": package_code,
                    "dutyCode": duty_code,
                    "operationKey": "/".join(row_key),
                })

        if not unresolved:
            comparisons = {
                "canonical_capability_keys": "capability_key",
                "canonical_resource_types": "resource_type",
                "canonical_resource_keys": "resource_key",
                "canonical_actions": "permission_code",
                "canonical_population_types": "population_types",
                "canonical_field_group_keys": "field_group_keys",
            }
            for register_field, duty_field in comparisons.items():
                expected = canonical_union(resolved_duties, duty_field)
                actual = pipe_set(row[register_field])
                if actual != expected:
                    detail["canonicalTupleMismatches"].append({
                        "operationKey": "/".join(row_key),
                        "field": register_field,
                        "expected": sorted(expected),
                        "actual": sorted(actual),
                    })
        if row_errors:
            detail["rowInvariantErrors"].append({"row": row_number, "bindingId": row["binding_id"], "errors": row_errors})

    for source in source_rows:
        source_key = key(source)
        if source_key in source_by_key:
            detail["duplicateSourceKeys"].append("/".join(source_key))
        source_by_key[source_key] = source

    register_keys = set(register_by_key)
    source_keys = set(source_by_key)
    detail["coverageMissing"] = ["/".join(item) for item in sorted(source_keys - register_keys)]
    detail["coverageExtra"] = ["/".join(item) for item in sorted(register_keys - source_keys)]

    for operation_key in sorted(source_keys & register_keys):
        source = source_by_key[operation_key]
        row = register_by_key[operation_key]
        if row["contract_path"] != source["observed_contract_path"]:
            detail["contractPathMismatches"].append({
                "operationKey": "/".join(operation_key),
                "expectedByRegister": row["contract_path"],
                "observedInModuleContract": source["observed_contract_path"],
            })
        if row["owner_service"] != source["owner_service"]:
            detail["ownerMismatches"].append({
                "operationKey": "/".join(operation_key),
                "expectedByRegister": row["owner_service"],
                "observedInModuleContract": source["owner_service"],
            })
        if row["source_contract"] != source["source_contract"]:
            detail["rowInvariantErrors"].append({
                "bindingId": row["binding_id"],
                "errors": [
                    f"source_contract expected {source['source_contract']} actual {row['source_contract']}"
                ],
            })
        if operation_key[0] == "PER" and not source["authorization_metadata_present"]:
            detail["missingMachineReadablePerAuthorization"].append({
                "operationKey": "/".join(operation_key),
                "requiredMetadata": "x-dwp-capability or x-dwp-capabilities",
                "registerMapping": sorted(normalize_alias(row["source_authorization_alias"])),
            })
        elif normalize_alias(row["source_authorization_alias"]) != normalize_alias(source["source_authorization_alias"]):
            detail["sourceAliasMismatches"].append({
                "operationKey": "/".join(operation_key),
                "expectedByRegister": sorted(normalize_alias(row["source_authorization_alias"])),
                "observedInModuleContract": sorted(normalize_alias(source["source_authorization_alias"])),
            })

    # Every owner that can return an asynchronous command receipt exposes one
    # canonical, independently authorized status query.  These are scope-bound
    # reads, not a global receipt-reader back door: the PEP tuple requires the
    # sealed originating command scope and current field/purpose evaluation.
    receipt_rows = {
        operation_key: row
        for operation_key, row in register_by_key.items()
        if "/command-receipts/{receiptId}" in row.get("browser_path", "")
    }
    if set(receipt_rows) != set(EXPECTED_RECEIPT_PEP):
        detail["receiptPepMismatches"].append({
            "field": "operation-set",
            "expected": sorted("/".join(item) for item in EXPECTED_RECEIPT_PEP),
            "actual": sorted("/".join(item) for item in receipt_rows),
        })
    for operation_key, expected in EXPECTED_RECEIPT_PEP.items():
        row = receipt_rows.get(operation_key)
        if row is None:
            continue
        actual_duties = {
            profile.split(">", 1)[1]
            for profile in pipe_set(row["authorization_profiles"])
            if profile.count(">") == 1
        }
        comparisons = {
            "method": row["method"] == "GET",
            "browser_path": row["browser_path"] == expected["browser_path"],
            "owner_service": row["owner_service"] == expected["owner_service"],
            "canonical_capability_keys": pipe_set(row["canonical_capability_keys"])
            == {expected["capability"]},
            "canonical_resource_types": pipe_set(row["canonical_resource_types"])
            == {"DATA"},
            "canonical_resource_keys": pipe_set(row["canonical_resource_keys"])
            == {expected["resource"]},
            "canonical_actions": pipe_set(row["canonical_actions"]) == {"VIEW"},
            "canonical_population_types": pipe_set(row["canonical_population_types"])
            == {"ORIGINATING_COMMAND_SCOPE"},
            "canonical_field_group_keys": pipe_set(row["canonical_field_group_keys"])
            == {"COMMAND_RECEIPT"},
            "purpose_codes": pipe_set(row["purpose_codes"]) == {"COMMAND_STATUS"},
            "authorization_duties": actual_duties == {expected["duty"]},
        }
        failed = sorted(name for name, passed in comparisons.items() if not passed)
        if failed:
            detail["receiptPepMismatches"].append({
                "operationKey": "/".join(operation_key),
                "failedFields": failed,
            })

    # Service-only API authorization is a first-class Gate, not an exclusion.
    service_by_key: dict[tuple[str, str, str], dict[str, str]] = {}
    service_binding_ids: set[str] = set()
    expected_projections = expected_service_projections()
    in_process_projection = expected_in_process_projection()
    expected_get_replay = {
        "READ_IDEMPOTENT",
        "CURSOR_BINDS_TENANT+CALLER+PROJECTION+AS_OF+OWNER_REVISION",
        "PAGE_DIGEST_VERIFIED",
    }
    expected_post_replay = {
        "INBOX_IDEMPOTENCY_KEY=decisionEventId",
        "REQUEST_DIGEST_MATCH",
        "DUPLICATE_RETURNS_ORIGINAL_RECEIPT",
        "KEY_PAYLOAD_MISMATCH_409",
    }
    forbidden_clear_fields = {
        "taxIdentifier",
        "residentRegistrationNumber",
        "documentBytes",
        "bankAccountNumber",
        "routingNumber",
        "accountHolderPlaintext",
    }
    for row_number, row in enumerate(service_rows, start=2):
        row_key = service_key(row)
        row_errors: list[str] = []
        if row["binding_id"] in service_binding_ids:
            row_errors.append(f"duplicate binding_id {row['binding_id']}")
        service_binding_ids.add(row["binding_id"])
        if row_key in service_by_key:
            row_errors.append(f"duplicate service operation key {'/'.join(row_key)}")
        service_by_key[row_key] = row
        if not re.fullmatch(rf"SVC-PEP-{re.escape(row['module'])}-\d{{3}}", row["binding_id"]):
            row_errors.append(f"invalid service binding_id {row['binding_id']}")
        if row["module"] not in {"HRM", "PER", "TIM", "PAY"}:
            row_errors.append(f"unsupported internal API module {row['module']}")
        if row["method"] not in METHODS:
            row_errors.append(f"invalid HTTP method {row['method']}")
        if row["state"] != EXPECTED_STATE:
            row_errors.append(f"state must be {EXPECTED_STATE}")
        expected_prefix = EXPECTED_INTERNAL_PREFIX.get(row["module"], "")
        if not expected_prefix or not row["owner_path"].startswith(expected_prefix):
            row_errors.append(
                f"owner_path must use module internal prefix {expected_prefix or 'NONE'}"
            )
        operation_key = (row["module"], row["source_operation_id"])
        expected_scope = EXPECTED_CONTRACT_SCOPE.get(operation_key)
        if row["contract_scope"] != expected_scope:
            row_errors.append(
                f"contract_scope expected={expected_scope} actual={row['contract_scope']}"
            )
        expected_callers = EXPECTED_SERVICE_CALLERS.get(operation_key)
        actual_callers = pipe_set(row["caller_service_identities"])
        if expected_callers is None:
            row_errors.append(
                f"undeclared service operation {row['module']}/{row['source_operation_id']}"
            )
        elif actual_callers != expected_callers:
            row_errors.append(
                f"caller identities expected={sorted(expected_callers)} actual={sorted(actual_callers)}"
            )
        if pipe_set(row["allowed_consumers"]) != actual_callers:
            row_errors.append("allowed_consumers must exactly equal caller_service_identities")
        expected_audience = EXPECTED_WORKLOAD_AUDIENCE.get(row["owner_service"])
        expected_workload_authentication = {
            "MTLS_SPIFFE_WORKLOAD_IDENTITY",
            expected_audience or "MISSING_OWNER_AUDIENCE",
        }
        if pipe_set(row["workload_authentication"]) != expected_workload_authentication:
            row_errors.append("workload_authentication does not close mTLS plus workload credential")
        if pipe_set(row["tenant_propagation"]) != EXPECTED_TENANT_PROPAGATION:
            row_errors.append("tenant_propagation set is incomplete or expanded")
        if pipe_set(row["transport_controls"]) != EXPECTED_SERVICE_TRANSPORT:
            row_errors.append("transport_controls set is incomplete or expanded")
        purpose_codes = pipe_set(row["purpose_codes"])
        if len(purpose_codes) != 1 or any(not PURPOSE_PATTERN.fullmatch(code) for code in purpose_codes):
            row_errors.append("service purpose_codes must contain one canonical purpose")
        if ":" not in row["audit_binding"]:
            row_errors.append("audit_binding must declare AuditEventEnvelope.v1 fields")
        else:
            audit_schema, audit_fields = row["audit_binding"].split(":", 1)
            if audit_schema != "AuditEventEnvelope.v1":
                row_errors.append(f"unsupported audit schema {audit_schema}")
            if {field for field in audit_fields.split("+") if field} != EXPECTED_AUDIT_FIELDS:
                row_errors.append("audit binding field set mismatch")
        replay = pipe_set(row["replay_idempotency"])
        expected_replay = expected_post_replay if row["method"] == "POST" else expected_get_replay
        if replay != expected_replay:
            row_errors.append(
                f"replay/idempotency expected={sorted(expected_replay)} actual={sorted(replay)}"
            )
        projections, projection_errors = parse_projection(row["field_projection"])
        row_errors.extend(projection_errors)
        expected_projection = expected_projections.get(operation_key)
        if expected_projection is None or projections != expected_projection:
            detail["serviceProjectionMismatches"].append({
                "operationKey": "/".join(row_key),
                "expected": {
                    name: sorted(fields) for name, fields in (expected_projection or {}).items()
                },
                "actual": {name: sorted(fields) for name, fields in projections.items()},
            })
        clear_fields = sorted({
            field
            for fields in projections.values()
            for field in fields
            if field in forbidden_clear_fields
        })
        if clear_fields:
            row_errors.append(f"forbidden clear fields in service projection: {'|'.join(clear_fields)}")
        in_process_values = {
            "consumer": row["in_process_consumer"],
            "port": row["in_process_port"],
            "controls": row["in_process_controls"],
            "projection": row["in_process_projection"],
            "tests": row["in_process_test_allocation"],
        }
        if operation_key == ("HRM", "bootstrapWorkforceSnapshots"):
            projection, projection_errors = parse_projection(row["in_process_projection"])
            if projection_errors or projection != in_process_projection:
                detail["inProcessBoundaryMismatches"].append({
                    "operationKey": "/".join(row_key),
                    "field": "in_process_projection",
                    "expected": {name: sorted(fields) for name, fields in in_process_projection.items()},
                    "actual": {name: sorted(fields) for name, fields in projection.items()},
                    "parseErrors": projection_errors,
                })
            if row["in_process_consumer"] != EXPECTED_IN_PROCESS_CONSUMER:
                row_errors.append("workforce snapshot in-process consumer drift")
            if row["in_process_port"] != EXPECTED_IN_PROCESS_PORT:
                row_errors.append("workforce snapshot typed application port drift")
            if pipe_set(row["in_process_controls"]) != EXPECTED_IN_PROCESS_CONTROLS:
                row_errors.append("workforce snapshot in-process controls drift")
            if pipe_set(row["in_process_test_allocation"]) != EXPECTED_IN_PROCESS_TESTS:
                row_errors.append("workforce snapshot in-process contract test allocation drift")
            if EXPECTED_IN_PROCESS_CONSUMER in actual_callers:
                row_errors.append("same-deploy-unit PER consumer must never be modeled as a network caller")
        elif any(value != "NONE" for value in in_process_values.values()):
            row_errors.append("only workforce snapshots may declare the PER in-process boundary")
        if any("dwp-people-performance" in value for value in row.values()):
            row_errors.append("fictional dwp-people-performance workload identity is forbidden")
        if row_errors:
            detail["serviceRowInvariantErrors"].append({
                "row": row_number,
                "bindingId": row["binding_id"],
                "errors": row_errors,
            })

    home_security_by_key: dict[tuple[str, str, str], dict[str, str]] = {}
    home_binding_ids: set[str] = set()
    for row_number, row in enumerate(home_security_rows, start=2):
        operation_key = (row["module"], row["source_operation_id"], row["method"])
        errors: list[str] = []
        if row["binding_id"] in home_binding_ids:
            errors.append(f"duplicate binding_id {row['binding_id']}")
        home_binding_ids.add(row["binding_id"])
        if operation_key in home_security_by_key:
            errors.append(f"duplicate operation key {'/'.join(operation_key)}")
        home_security_by_key[operation_key] = row
        if operation_key not in EXPECTED_HOME_OPERATION_KEYS:
            errors.append("undeclared home materialization operation")
        if pipe_set(row["delegated_subject_context"]) != EXPECTED_HOME_DELEGATED_CONTEXT:
            errors.append("delegated subject context field set drift")
        if pipe_set(row["delegated_subject_controls"]) != EXPECTED_HOME_DELEGATED_CONTROLS:
            errors.append("owner-side delegated authorization controls drift")
        if row["owner_evaluation_order"] != EXPECTED_HOME_EVALUATION_ORDER:
            errors.append("fail-closed owner evaluation order drift")
        if row["materialization_projection"] != EXPECTED_HOME_PROJECTIONS.get(row["module"]):
            errors.append("typed home materialization projection drift")
        if pipe_set(row["browser_widget_types"]) != EXPECTED_HOME_WIDGET_TYPES.get(row["module"], set()):
            errors.append("closed browser widget type allocation drift")
        if pipe_set(row["scope_audience_mapping"]) != EXPECTED_HOME_SCOPE_AUDIENCE_MAPPING.get(row["module"], set()):
            errors.append("ownerPopulationScope to browserAudience mapping drift")
        if pipe_set(row["field_decision_contract"]) != {"VIEW", "MASK", "OMIT"}:
            errors.append("home field-decision contract must be exact VIEW/MASK/OMIT")
        if row["purpose_code"] != "HRIS_HOME_MATERIALIZATION":
            errors.append("home owner materialization purpose drift")
        expected_negative_tests = {
            f"G4_HOME_{row['module']}_FORGED_SUBJECT",
            f"G4_HOME_{row['module']}_STALE_PERMISSION_REVISION",
            f"G4_HOME_{row['module']}_POPULATION_SCOPE_ESCALATION",
            f"G4_HOME_{row['module']}_FIELD_POLICY_BYPASS",
            f"G4_HOME_{row['module']}_PAYLOAD_DIGEST_MISMATCH",
            f"G4_HOME_{row['module']}_FREEFORM_DATA",
            f"G4_HOME_{row['module']}_SENSITIVE_PAYLOAD_LEAK",
            f"G4_HOME_{row['module']}_FIELD_DECISION_DRIFT",
        }
        if pipe_set(row["negative_test_allocation"]) != expected_negative_tests:
            errors.append("negative authorization/digest test allocation drift")
        if row["state"] != EXPECTED_STATE:
            errors.append(f"state must be {EXPECTED_STATE}")
        if errors:
            detail["homeMaterializationSecurityMismatches"].append({
                "row": row_number,
                "bindingId": row["binding_id"],
                "operationKey": "/".join(operation_key),
                "errors": errors,
            })
    if set(home_security_by_key) != EXPECTED_HOME_OPERATION_KEYS:
        detail["homeMaterializationSecurityMismatches"].append({
            "expectedOperationKeys": sorted("/".join(key) for key in EXPECTED_HOME_OPERATION_KEYS),
            "actualOperationKeys": sorted("/".join(key) for key in home_security_by_key),
        })
    service_home_keys = {
        key for key, row in service_by_key.items()
        if row["contract_scope"] == "TARGET_HOME_MATERIALIZATION"
    }
    if service_home_keys != EXPECTED_HOME_OPERATION_KEYS:
        detail["homeMaterializationSecurityMismatches"].append({
            "serviceRegisterHomeKeys": sorted("/".join(key) for key in service_home_keys),
            "expectedOperationKeys": sorted("/".join(key) for key in EXPECTED_HOME_OPERATION_KEYS),
        })

    # The browser Home PEP is an outer projection boundary, not a single
    # employee tuple.  Each IA persona is closed to declared packages/duties,
    # audience, widgets and fields.  Owner VIEW/MASK/OMIT decisions are then
    # intersected with this matrix; neither side can broaden the other.
    persona_rows: dict[str, dict[str, str]] = {}
    expected_home_profiles: set[str] = set()
    expected_home_field_groups: set[str] = set()
    for row_number, row in enumerate(home_browser_rows, start=2):
        row_errors: list[str] = []
        persona = row["ia_persona"]
        if persona in persona_rows:
            row_errors.append("duplicate IA persona")
        persona_rows[persona] = row
        if row["browser_audience"] != EXPECTED_HOME_PERSONA_AUDIENCE.get(persona):
            row_errors.append("persona/browserAudience mapping drift")
        if pipe_set(row["allowed_widget_types"]) != EXPECTED_HOME_PERSONA_WIDGETS.get(persona, set()):
            row_errors.append("persona widget allocation drift")
        allowed_fields = pipe_set(row["allowed_home_field_keys"])
        if not allowed_fields or not allowed_fields <= EXPECTED_HOME_FIELD_KEYS:
            row_errors.append("unknown or empty Home field-key projection")
        if row["outer_projection_action"] != "VIEW":
            row_errors.append("Home outer projection action must remain VIEW")
        if "OWNER_VIEW_MASK_OMIT_INTERSECT_OUTER_PEP" not in row["field_decision_rule"]:
            row_errors.append("owner/outer PEP intersection rule missing")
        if row["purpose_code"] != "HRIS_HOME_VIEW":
            row_errors.append("Home browser purpose drift")
        if row["status"] != "TARGET_DECIDED":
            row_errors.append("Home browser PEP state drift")
        if len(pipe_set(row["negative_tests"])) < 3:
            row_errors.append("Home browser PEP negative-test allocation incomplete")

        package_codes = pipe_set(row["access_packages"])
        duty_codes = pipe_set(row["atomic_duties"])
        if not package_codes or not duty_codes:
            row_errors.append("persona package/duty set is empty")
        unknown_packages = sorted(package_codes - set(packages))
        unknown_duties = sorted(duty_codes - set(duties))
        if unknown_packages:
            row_errors.append(f"unknown access packages {unknown_packages}")
        if unknown_duties:
            row_errors.append(f"unknown atomic duties {unknown_duties}")
        resolved = [duties[code] for code in duty_codes if code in duties]
        if resolved:
            comparisons = {
                "capabilities": "capability_key",
                "resource_types": "resource_type",
                "resource_keys": "resource_key",
                "source_permission_codes": "permission_code",
                "population_types": "population_types",
                "field_groups": "field_group_keys",
            }
            for matrix_field, duty_field in comparisons.items():
                if pipe_set(row[matrix_field]) != canonical_union(resolved, duty_field):
                    row_errors.append(f"{matrix_field} differs from selected atomic duties")
            expected_home_field_groups.update(canonical_union(resolved, "field_group_keys"))
        covered_duties: set[str] = set()
        for package_code in package_codes & set(packages):
            memberships = pipe_set(packages[package_code].get("atomic_duty_codes", ""))
            for duty_code in duty_codes & memberships:
                expected_home_profiles.add(f"{package_code}>{duty_code}")
                covered_duties.add(duty_code)
        if covered_duties != duty_codes:
            row_errors.append(f"duties lack declared-package membership {sorted(duty_codes - covered_duties)}")
        if row_errors:
            detail["homeBrowserPepMismatches"].append({
                "row": row_number, "bindingId": row.get("binding_id", ""),
                "persona": persona, "errors": row_errors,
            })
    if set(persona_rows) != set(EXPECTED_HOME_PERSONA_AUDIENCE):
        detail["homeBrowserPepMismatches"].append({
            "error": "Home browser PEP must cover exact five IA personas",
            "expected": sorted(EXPECTED_HOME_PERSONA_AUDIENCE),
            "actual": sorted(persona_rows),
        })
    actual_home_field_keys = (
        set().union(*(pipe_set(row["allowed_home_field_keys"]) for row in home_browser_rows))
        if home_browser_rows else set()
    )
    if actual_home_field_keys != EXPECTED_HOME_FIELD_KEYS:
        detail["homeBrowserPepMismatches"].append({
            "error": "Home browser PEP field-key union drift",
        })
    browser_home = register_by_key.get(("SYS", "SYS-API-026", "GET"), {})
    if (
        pipe_set(browser_home.get("authorization_profiles", ""))
        != expected_home_profiles
        or pipe_set(browser_home.get("canonical_field_group_keys", ""))
        != expected_home_field_groups
        or browser_home.get("source_authorization_alias")
        != "HRIS_APP_AND_WIDGET_CAPABILITIES"
        or browser_home.get("purpose_codes") != "HRIS_HOME_VIEW"
    ):
        detail["homeBrowserPepMismatches"].append({
            "browserOperation": "SYS/SYS-API-026/GET",
            "error": "HomeResponse protected fields/personas are not closed by the public PEP matrix",
        })

    service_source_by_key: dict[tuple[str, str, str], dict[str, str]] = {}
    for source in excluded:
        source_key = service_key(source)
        if source_key in service_source_by_key:
            detail["serviceDuplicateSourceKeys"].append("/".join(source_key))
        service_source_by_key[source_key] = source
    service_register_keys = set(service_by_key)
    service_source_keys = set(service_source_by_key)
    detail["serviceCoverageMissing"] = [
        "/".join(item) for item in sorted(service_source_keys - service_register_keys)
    ]
    detail["serviceCoverageExtra"] = [
        "/".join(item) for item in sorted(service_register_keys - service_source_keys)
    ]
    for operation_key in sorted(service_source_keys & service_register_keys):
        source = service_source_by_key[operation_key]
        row = service_by_key[operation_key]
        if row["owner_path"] != source["path"]:
            detail["serviceContractPathMismatches"].append({
                "operationKey": "/".join(operation_key),
                "expectedByRegister": row["owner_path"],
                "observedInModuleContract": source["path"],
            })
        if row["owner_service"] != source["ownerService"]:
            detail["serviceAuthorizationMismatches"].append({
                "operationKey": "/".join(operation_key),
                "field": "owner_service",
                "expectedByRegister": row["owner_service"],
                "observedInModuleContract": source["ownerService"],
            })
        if row["source_contract"] != source["sourceContract"]:
            detail["serviceAuthorizationMismatches"].append({
                "operationKey": "/".join(operation_key),
                "field": "source_contract",
                "expectedByRegister": row["source_contract"],
                "observedInModuleContract": source["sourceContract"],
            })
        if normalize_alias(row["source_authorization_alias"]) != normalize_alias(
            source["sourceAuthorizationAlias"]
        ):
            detail["serviceAuthorizationMismatches"].append({
                "operationKey": "/".join(operation_key),
                "field": "source_authorization_alias",
                "expectedByRegister": row["source_authorization_alias"],
                "observedInModuleContract": source["sourceAuthorizationAlias"],
            })

    for category, items in detail.items():
        if items:
            blockers.append(f"{category}: {len(items)}")

    # De-duplicate repeated missing-duty and membership entries while preserving
    # the operation-level findings above for precise remediation.
    missing_duty_codes = sorted({item["dutyCode"] for item in detail["missingDuties"]})
    missing_membership_pairs = sorted({
        f"{item['packageCode']}>{item['dutyCode']}"
        for item in detail["missingPackageDutyMembership"]
    })
    module_source_counts = Counter(row["module"] for row in source_rows)
    module_register_counts = Counter(row["module"] for row in rows)

    result = {
        "schema": "dwp.hris.api-pep-readiness.v1",
        "status": "PASS" if not blockers else "FAIL",
        "register": REGISTER.name,
        "serviceRegister": SERVICE_REGISTER.name,
        "checks": {
            "exactPublicOperationCoverage": not detail["coverageMissing"] and not detail["coverageExtra"] and not detail["duplicateSourceKeys"],
            "canonicalRoutes": not detail["routeMismatches"] and not detail["contractPathMismatches"],
            "machineReadableSourceAuthorization": not detail["missingMachineReadablePerAuthorization"],
            "personaAndAtomicDutyClosure": not detail["missingDuties"] and not detail["missingPackageDutyMembership"],
            "canonicalTupleClosure": not detail["canonicalTupleMismatches"] and not detail["missingDuties"],
            "rowInvariants": not detail["rowInvariantErrors"],
            "internalServiceCoverage": (
                not detail["serviceCoverageMissing"]
                and not detail["serviceCoverageExtra"]
                and not detail["serviceDuplicateSourceKeys"]
            ),
            "internalServiceAuthorizationClosure": (
                not detail["serviceContractPathMismatches"]
                and not detail["serviceAuthorizationMismatches"]
                and not detail["serviceProjectionMismatches"]
                and not detail["serviceRowInvariantErrors"]
            ),
            "inProcessAuthorizationClosure": not detail["inProcessBoundaryMismatches"],
            "homeMaterializationDelegatedAuthorizationClosure": not detail["homeMaterializationSecurityMismatches"],
            "homeBrowserPersonaPepClosure": not detail["homeBrowserPepMismatches"],
            "commandReceiptPepClosure": not detail["receiptPepMismatches"],
        },
        "coverage": {
            "sourcePublicOperationCount": len(source_rows),
            "registerOperationCount": len(rows),
            "sourceByModule": {module: module_source_counts[module] for module in EXPECTED_MODULES},
            "registerByModule": {module: module_register_counts[module] for module in EXPECTED_MODULES},
            "networkInternalSourceOperationCount": len(excluded),
            "networkInternalRegisterCount": len(service_rows),
            "networkInternalCoveredCount": len(service_source_keys & service_register_keys),
            "networkInternalSourceByModule": {
                module: Counter(row["module"] for row in excluded)[module]
                for module in EXPECTED_MODULES
            },
            "networkInternalRegisterByModule": {
                module: Counter(row["module"] for row in service_rows)[module]
                for module in EXPECTED_MODULES
            },
            "inProcessBoundaryCount": sum(
                1 for row in service_rows if row["in_process_consumer"] != "NONE"
            ),
            "homeMaterializationSecurityBindingCount": len(home_security_rows),
            "homeBrowserPersonaBindingCount": len(home_browser_rows),
            "commandReceiptPepBindingCount": len(receipt_rows),
            "commandReceiptPepByModule": dict(
                sorted(Counter(key[0] for key in receipt_rows).items())
            ),
            "networkInternalSourceOperations": excluded,
        },
        "authorizationClosure": {
            "globalPersonaPackageCount": len(packages),
            "globalAtomicDutyCount": len(duties),
            "missingDutyCodes": missing_duty_codes,
            "missingPackageDutyPairs": missing_membership_pairs,
        },
        "blockers": blockers,
        "detail": detail,
    }
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--compact", action="store_true", help="emit compact JSON")
    args = parser.parse_args()
    try:
        result = validate()
    except Exception as exc:  # last-resort fail-closed envelope for malformed/missing artifacts
        result = {
            "schema": "dwp.hris.api-pep-readiness.v1",
            "status": "FAIL",
            "register": REGISTER.name,
            "serviceRegister": SERVICE_REGISTER.name,
            "checks": {},
            "coverage": {},
            "authorizationClosure": {},
            "blockers": [f"validator execution error: {type(exc).__name__}: {exc}"],
            "detail": {},
        }
    json.dump(result, sys.stdout, ensure_ascii=False, indent=None if args.compact else 2, sort_keys=False)
    sys.stdout.write("\n")
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
