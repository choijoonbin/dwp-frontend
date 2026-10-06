#!/usr/bin/env python3
"""Fail-closed SYS G1/G2 engineering code-readiness validator."""

from __future__ import annotations

import argparse
import copy
import csv
import hashlib
import json
import subprocess
import sys
from pathlib import Path

from validate_sys_service_local_migrations import validate_sql as validate_service_local_sql


MODULE = Path(__file__).resolve().parent
ROOT = MODULE.parents[1]
COVERAGE = ROOT / "session-registers/hris-sys-source-coverage.csv"
CHILDREN = MODULE / "g1-child-trace.csv"
DECISIONS = MODULE / "g1-decision-log.csv"
G2_FILES = [
    MODULE / "g2-implementation-contract.md",
    MODULE / "g2-state-machines.md",
    MODULE / "g2-physical-schema.sql",
    MODULE / "g2-auth-physical-schema.sql",
    MODULE / "g2-platform-physical-schema.sql",
    MODULE / "validate_sys_service_local_migrations.py",
    MODULE / "g2-contract-catalog.csv",
    MODULE / "g2-golden-scenarios.csv",
    MODULE / "g2-transport-schemas.v1.json",
]

LIFECYCLE_OPERATIONS = {'SYS-API-041': ('GET', '/api/platform/v1/admin/hris/configurations/{configId}/versions/{version}', 'HRIS_CONFIG_READ', 'NONE'),
 'SYS-API-042': ('POST',
                 '/api/platform/v1/admin/hris/configurations/{configId}/versions/{version}/submit',
                 'HRIS_CONFIG_AUTHOR',
                 'ConfigSubmitCommand'),
 'SYS-API-043': ('POST',
                 '/api/platform/v1/admin/hris/configurations/{configId}/versions/{version}/schedule',
                 'HRIS_CONFIG_PUBLISHER',
                 'ConfigScheduleCommand'),
 'SYS-API-044': ('POST',
                 '/api/platform/v1/admin/hris/configurations/{configId}/versions/{version}/rollback',
                 'HRIS_CONFIG_PUBLISHER',
                 'ConfigRollbackCommand'),
 'SYS-API-045': ('POST',
                 '/api/platform/v1/admin/hris/configurations/{configId}/versions/{version}/retire',
                 'HRIS_CONFIG_PUBLISHER',
                 'ConfigRetireCommand'),
 'SYS-API-046': ('POST', '/api/platform/v1/admin/hris/automations/{automationId}/versions', 'DWP_AUTOMATION_ADMIN', 'AutomationVersionCommand'),
 'SYS-API-047': ('POST',
                 '/api/platform/v1/admin/hris/automations/{automationId}/versions/{version}/validate',
                 'DWP_AUTOMATION_ADMIN',
                 'AutomationValidationCommand'),
 'SYS-API-048': ('POST',
                 '/api/platform/v1/admin/hris/automations/{automationId}/versions/{version}/submit',
                 'DWP_AUTOMATION_ADMIN',
                 'ApprovalRequestCommand'),
 'SYS-API-049': ('POST',
                 '/api/platform/v1/admin/hris/automations/{automationId}/versions/{version}/approve',
                 'DWP_AUTOMATION_APPROVE',
                 'ApprovalDecisionCommand'),
 'SYS-API-050': ('POST',
                 '/api/platform/v1/admin/hris/automations/{automationId}/versions/{version}/activate',
                 'DWP_AUTOMATION_EXECUTE',
                 'ActivationCommand'),
 'SYS-API-051': ('POST', '/api/platform/v1/admin/hris/automations/{automationId}/schedules', 'DWP_AUTOMATION_ADMIN', 'AutomationScheduleCommand'),
 'SYS-API-052': ('POST', '/api/platform/v1/admin/hris/automation-schedules/{scheduleId}/submit', 'DWP_AUTOMATION_ADMIN', 'ApprovalRequestCommand'),
 'SYS-API-053': ('POST',
                 '/api/platform/v1/admin/hris/automation-schedules/{scheduleId}/approve',
                 'DWP_AUTOMATION_APPROVE',
                 'ApprovalDecisionCommand'),
 'SYS-API-054': ('POST', '/api/platform/v1/admin/hris/automation-schedules/{scheduleId}/activate', 'DWP_AUTOMATION_EXECUTE', 'ActivationCommand'),
 'SYS-API-055': ('POST', '/api/platform/v1/admin/hris/automation-schedules/{scheduleId}/suspend', 'DWP_AUTOMATION_EXECUTE', 'SuspendCommand'),
 'SYS-API-056': ('POST', '/api/platform/v1/admin/hris/automation-runs/{runId}/cancel', 'DWP_AUTOMATION_EXECUTE', 'CancelCommand'),
 'SYS-API-057': ('POST', '/api/platform/v1/admin/hris/connectors/{connectorId}/validate', 'DWP_CONNECTOR_AUTHOR', 'ConnectorValidationCommand'),
 'SYS-API-058': ('POST', '/api/platform/v1/admin/hris/connectors/{connectorId}/submit', 'DWP_CONNECTOR_AUTHOR', 'ApprovalRequestCommand'),
 'SYS-API-059': ('POST', '/api/platform/v1/admin/hris/connectors/{connectorId}/approve', 'DWP_CONNECTOR_APPROVE', 'ApprovalDecisionCommand'),
 'SYS-API-060': ('POST', '/api/platform/v1/admin/hris/connectors/{connectorId}/activate', 'DWP_CONNECTOR_EXECUTE', 'ActivationCommand'),
 'SYS-API-061': ('POST', '/api/platform/v1/admin/hris/connectors/{connectorId}/mappings', 'DWP_CONNECTOR_AUTHOR', 'ConnectorMappingCommand'),
 'SYS-API-062': ('POST',
                 '/api/platform/v1/admin/hris/connectors/{connectorId}/mappings/{version}/validate',
                 'DWP_CONNECTOR_AUTHOR',
                 'MappingValidationCommand'),
 'SYS-API-063': ('POST',
                 '/api/platform/v1/admin/hris/connectors/{connectorId}/mappings/{version}/submit',
                 'DWP_CONNECTOR_AUTHOR',
                 'ApprovalRequestCommand'),
 'SYS-API-064': ('POST',
                 '/api/platform/v1/admin/hris/connectors/{connectorId}/mappings/{version}/approve',
                 'DWP_CONNECTOR_APPROVE',
                 'ApprovalDecisionCommand'),
 'SYS-API-065': ('POST',
                 '/api/platform/v1/admin/hris/connectors/{connectorId}/mappings/{version}/activate',
                 'DWP_CONNECTOR_EXECUTE',
                 'ActivationCommand'),
 'SYS-API-066': ('POST',
                 '/api/platform/v1/admin/hris/connector-executions/{executionId}/reconcile',
                 'DWP_CONNECTOR_EXECUTE',
                 'ExecutionReconcileCommand'),
 'SYS-API-067': ('POST',
                 '/api/platform/v1/admin/hris/connector-executions/{executionId}/retry',
                 'DWP_CONNECTOR_EXECUTE',
                 'FailedExecutionItemRetryCommand'),
 'SYS-API-068': ('POST', '/api/platform/v1/admin/hris/connector-executions/{executionId}/cancel', 'DWP_CONNECTOR_EXECUTE', 'CancelCommand'),
 'SYS-API-069': ('POST',
                 '/api/platform/v1/admin/hris/extension-packs/{packId}/versions/{version}/verify',
                 'DWP_EXTENSION_VERIFY',
                 'ExtensionVerifyCommand'),
 'SYS-API-070': ('POST',
                 '/api/platform/v1/admin/hris/extension-packs/{packId}/versions/{version}/approve',
                 'DWP_EXTENSION_APPROVE',
                 'ExtensionApprovalCommand'),
 'SYS-API-071': ('POST',
                 '/api/platform/v1/admin/hris/tenants/{tenantId}/extension-installations/{installationId}/approve',
                 'DWP_EXTENSION_APPROVE',
                 'ExtensionApprovalCommand'),
 'SYS-API-072': ('POST',
                 '/api/platform/v1/admin/hris/tenants/{tenantId}/extension-installations/{installationId}/install',
                 'DWP_EXTENSION_INSTALL',
                 'ExtensionInstallCommand'),
 'SYS-API-073': ('POST',
                 '/api/platform/v1/admin/hris/tenants/{tenantId}/extension-installations/{installationId}/suspend',
                 'DWP_EXTENSION_ENABLE',
                 'SuspendCommand'),
 'SYS-API-074': ('POST',
                 '/api/platform/v1/admin/hris/tenants/{tenantId}/extension-installations/{installationId}/revoke',
                 'DWP_EXTENSION_APPROVE',
                 'ExtensionRevokeCommand'),
 'SYS-API-075': ('POST',
                 '/api/platform/v1/admin/hris/extension-packs/{packId}/versions/{version}/revoke',
                 'DWP_EXTENSION_APPROVE',
                 'ExtensionRevokeCommand')}
LIFECYCLE_STATES = {'SYS-API-041': 'IMMUTABLE_VERSION_DETAIL',
 'SYS-API-042': 'SIMULATED_TO_PENDING_APPROVAL',
 'SYS-API-043': 'APPROVED_TO_SCHEDULED',
 'SYS-API-044': 'PUBLISHED_PRIOR_TO_NEW_CORRECTIVE_VERSION',
 'SYS-API-045': 'PUBLISHED_TO_RETIRED_WITH_SUCCESSOR_BOUNDARY',
 'SYS-API-046': 'CREATE_SIGNED_DRAFT_VERSION',
 'SYS-API-047': 'DRAFT_TO_VALIDATED',
 'SYS-API-048': 'VALIDATED_TO_PENDING_APPROVAL',
 'SYS-API-049': 'PENDING_APPROVAL_TO_APPROVED',
 'SYS-API-050': 'APPROVED_TO_ACTIVE',
 'SYS-API-051': 'CREATE_DRAFT_SCHEDULE',
 'SYS-API-052': 'DRAFT_TO_PENDING_APPROVAL',
 'SYS-API-053': 'PENDING_APPROVAL_TO_APPROVED',
 'SYS-API-054': 'APPROVED_TO_ACTIVE',
 'SYS-API-055': 'ACTIVE_TO_SUSPENDED',
 'SYS-API-056': 'QUEUED_OR_LEASED_TO_CANCELLED',
 'SYS-API-057': 'DRAFT_TO_VALIDATED',
 'SYS-API-058': 'TESTED_TO_PENDING_APPROVAL',
 'SYS-API-059': 'PENDING_APPROVAL_TO_APPROVED',
 'SYS-API-060': 'APPROVED_TO_ACTIVE',
 'SYS-API-061': 'CREATE_DRAFT_MAPPING',
 'SYS-API-062': 'DRAFT_TO_VALIDATED',
 'SYS-API-063': 'VALIDATED_TO_PENDING_APPROVAL',
 'SYS-API-064': 'PENDING_APPROVAL_TO_APPROVED',
 'SYS-API-065': 'APPROVED_TO_ACTIVE',
 'SYS-API-066': 'ACKNOWLEDGED_TO_RECONCILED_OR_PARTIAL',
 'SYS-API-067': 'FAILED_ITEMS_TO_NEW_ATTEMPTS',
 'SYS-API-068': 'PRE_DISPATCH_TO_CANCELLED_OR_COMPENSATE',
 'SYS-API-069': 'DISCOVERED_TO_VERIFIED',
 'SYS-API-070': 'VERIFIED_TO_APPROVED',
 'SYS-API-071': 'PENDING_APPROVAL_TO_APPROVED',
 'SYS-API-072': 'APPROVED_TO_INSTALLED_DISABLED',
 'SYS-API-073': 'ENABLED_TO_SUSPENDED',
 'SYS-API-074': 'INSTALLED_OR_SUSPENDED_TO_REVOKED',
 'SYS-API-075': 'APPROVED_TO_REVOKED_AND_DISABLE_INSTALLATIONS'}
LIFECYCLE_STATES = {'SYS-API-041': 'IMMUTABLE_VERSION_DETAIL',
 'SYS-API-042': 'SIMULATED_TO_PENDING_APPROVAL',
 'SYS-API-043': 'APPROVED_TO_SCHEDULED',
 'SYS-API-044': 'PUBLISHED_PRIOR_TO_NEW_CORRECTIVE_VERSION',
 'SYS-API-045': 'PUBLISHED_TO_RETIRED_WITH_SUCCESSOR_BOUNDARY',
 'SYS-API-046': 'CREATE_SIGNED_DRAFT_VERSION',
 'SYS-API-047': 'DRAFT_TO_VALIDATED',
 'SYS-API-048': 'VALIDATED_TO_PENDING_APPROVAL',
 'SYS-API-049': 'PENDING_APPROVAL_TO_APPROVED',
 'SYS-API-050': 'APPROVED_TO_ACTIVE',
 'SYS-API-051': 'CREATE_DRAFT_SCHEDULE',
 'SYS-API-052': 'DRAFT_TO_PENDING_APPROVAL',
 'SYS-API-053': 'PENDING_APPROVAL_TO_APPROVED',
 'SYS-API-054': 'APPROVED_TO_ACTIVE',
 'SYS-API-055': 'ACTIVE_TO_SUSPENDED',
 'SYS-API-056': 'QUEUED_OR_LEASED_TO_CANCELLED',
 'SYS-API-057': 'DRAFT_TO_VALIDATED',
 'SYS-API-058': 'TESTED_TO_PENDING_APPROVAL',
 'SYS-API-059': 'PENDING_APPROVAL_TO_APPROVED',
 'SYS-API-060': 'APPROVED_TO_ACTIVE',
 'SYS-API-061': 'CREATE_DRAFT_MAPPING',
 'SYS-API-062': 'DRAFT_TO_VALIDATED',
 'SYS-API-063': 'VALIDATED_TO_PENDING_APPROVAL',
 'SYS-API-064': 'PENDING_APPROVAL_TO_APPROVED',
 'SYS-API-065': 'APPROVED_TO_ACTIVE',
 'SYS-API-066': 'ACKNOWLEDGED_TO_RECONCILED_OR_PARTIAL',
 'SYS-API-067': 'FAILED_ITEMS_TO_NEW_ATTEMPTS',
 'SYS-API-068': 'PRE_DISPATCH_TO_CANCELLED_OR_COMPENSATE',
 'SYS-API-069': 'DISCOVERED_TO_VERIFIED',
 'SYS-API-070': 'VERIFIED_TO_APPROVED',
 'SYS-API-071': 'PENDING_APPROVAL_TO_APPROVED',
 'SYS-API-072': 'APPROVED_TO_INSTALLED_DISABLED',
 'SYS-API-073': 'ENABLED_TO_SUSPENDED',
 'SYS-API-074': 'INSTALLED_OR_SUSPENDED_TO_REVOKED',
 'SYS-API-075': 'APPROVED_TO_REVOKED_AND_DISABLE_INSTALLATIONS'}
LIFECYCLE_STATES = {'SYS-API-041': 'IMMUTABLE_VERSION_DETAIL',
 'SYS-API-042': 'SIMULATED_TO_PENDING_APPROVAL',
 'SYS-API-043': 'APPROVED_TO_SCHEDULED',
 'SYS-API-044': 'PUBLISHED_PRIOR_TO_NEW_CORRECTIVE_VERSION',
 'SYS-API-045': 'PUBLISHED_TO_RETIRED_WITH_SUCCESSOR_BOUNDARY',
 'SYS-API-046': 'CREATE_SIGNED_DRAFT_VERSION',
 'SYS-API-047': 'DRAFT_TO_VALIDATED',
 'SYS-API-048': 'VALIDATED_TO_PENDING_APPROVAL',
 'SYS-API-049': 'PENDING_APPROVAL_TO_APPROVED',
 'SYS-API-050': 'APPROVED_TO_ACTIVE',
 'SYS-API-051': 'CREATE_DRAFT_SCHEDULE',
 'SYS-API-052': 'DRAFT_TO_PENDING_APPROVAL',
 'SYS-API-053': 'PENDING_APPROVAL_TO_APPROVED',
 'SYS-API-054': 'APPROVED_TO_ACTIVE',
 'SYS-API-055': 'ACTIVE_TO_SUSPENDED',
 'SYS-API-056': 'QUEUED_OR_LEASED_TO_CANCELLED',
 'SYS-API-057': 'DRAFT_TO_VALIDATED',
 'SYS-API-058': 'TESTED_TO_PENDING_APPROVAL',
 'SYS-API-059': 'PENDING_APPROVAL_TO_APPROVED',
 'SYS-API-060': 'APPROVED_TO_ACTIVE',
 'SYS-API-061': 'CREATE_DRAFT_MAPPING',
 'SYS-API-062': 'DRAFT_TO_VALIDATED',
 'SYS-API-063': 'VALIDATED_TO_PENDING_APPROVAL',
 'SYS-API-064': 'PENDING_APPROVAL_TO_APPROVED',
 'SYS-API-065': 'APPROVED_TO_ACTIVE',
 'SYS-API-066': 'ACKNOWLEDGED_TO_RECONCILED_OR_PARTIAL',
 'SYS-API-067': 'FAILED_ITEMS_TO_NEW_ATTEMPTS',
 'SYS-API-068': 'PRE_DISPATCH_TO_CANCELLED_OR_COMPENSATE',
 'SYS-API-069': 'DISCOVERED_TO_VERIFIED',
 'SYS-API-070': 'VERIFIED_TO_APPROVED',
 'SYS-API-071': 'PENDING_APPROVAL_TO_APPROVED',
 'SYS-API-072': 'APPROVED_TO_INSTALLED_DISABLED',
 'SYS-API-073': 'ENABLED_TO_SUSPENDED',
 'SYS-API-074': 'INSTALLED_OR_SUSPENDED_TO_REVOKED',
 'SYS-API-075': 'APPROVED_TO_REVOKED_AND_DISABLE_INSTALLATIONS'}
LIFECYCLE_EXISTING_SCHEMA_REFS = {'SYS-API-013': ('ConfigValidationCommand', 'Receipt', 'CasCommandHeaders'),
 'SYS-API-014': ('ConfigSimulationCommand', 'Receipt', 'CasCommandHeaders'),
 'SYS-API-015': ('ConfigApprovalCommand', 'Receipt', 'CasCommandHeaders'),
 'SYS-API-016': ('ConfigPublishCommand', 'Receipt', 'CasCommandHeaders'),
 'SYS-API-019': ('NONE', 'AutomationRunReceiptResponse', 'QueryHeaders'),
 'SYS-API-020': ('FailedItemRetryCommand', 'Receipt', 'CasCommandHeaders'),
 'SYS-API-025': ('NONE', 'ConnectorExecutionReceiptResponse', 'QueryHeaders'),
 'SYS-API-029': ('ExtensionInstallRequestCommand', 'Receipt', 'CommandHeaders'),
 'SYS-API-030': ('ExtensionEnableCommand', 'Receipt', 'CasCommandHeaders')}
LIFECYCLE_NEGATIVE_TESTS = {
    "concurrent-publish-single-winner",
    "successor-boundary-half-open",
    "config-self-approval-deny",
    "automation-unsigned-handler-deny",
    "automation-worker-crash-checkpoint-replay",
    "automation-failed-items-only-retry",
    "automation-cancel-after-side-effect-compensation",
    "connector-mapping-self-approval-deny",
    "connector-result-unknown-reconciliation",
    "connector-failed-items-only-retry",
    "connector-cancel-compensation",
    "extension-manifest-closed-schema-deny",
    "extension-signature-compatibility-hook-license-permission-deny",
    "extension-four-eyes-deny",
    "extension-revoked-pack-disable",
}
LIFECYCLE_GOLDEN_IDS = {f"SYS-GOLD-{number:03}" for number in range(46, 61)}
ALLOWED_DISPOSITIONS = {"REUSE", "REBUILD", "CONFIGURE", "EXTENSION", "RETIRE"}
NON_SOD_POLICY_GUARDS = {"NO_ISSUE_OWN_CONTRACT", "NO_CHECKIN_OUTSIDE_PAIR"}
ALLOWED_DUTY_IMPLEMENTATION_STATES = {
    "TARGET_NEW",
    "REUSE_WITH_CHANGE",
    "PLANNED_G3_NOT_IMPLEMENTED",
}
PERMISSION_GROUPS = ROOT / "hris-permission-group-matrix.csv"
ATOMIC_DUTIES = ROOT / "hris-atomic-duty-matrix.csv"
SOD_RULES = ROOT / "hris-sod-rule-matrix.csv"
IA_REGISTER = ROOT / "coding-readiness/hris-information-architecture-register.csv"
SHELL_NAVIGATION = ROOT / "coding-readiness/hris-shell-navigation-register.csv"
IA_VALIDATOR = ROOT / "coding-readiness/validate_information_architecture.py"
PLATFORM_DEPENDENCY_SCHEMAS = ROOT / "coding-readiness/platform-dependency-canonical-schemas.v1.json"
PLATFORM_DEPENDENCY_BINDINGS = ROOT / "coding-readiness/platform-dependency-schema-binding-register.csv"
PLATFORM_DEPENDENCY_VALIDATOR = ROOT / "coding-readiness/validate_platform_dependency_schema_contracts.py"
CENTRAL_FILES = [
    PERMISSION_GROUPS,
    ATOMIC_DUTIES,
    SOD_RULES,
    IA_REGISTER,
    SHELL_NAVIGATION,
    IA_VALIDATOR,
    PLATFORM_DEPENDENCY_SCHEMAS,
    PLATFORM_DEPENDENCY_BINDINGS,
    PLATFORM_DEPENDENCY_VALIDATOR,
]


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def require(condition: bool, message: str, errors: list[str]) -> None:
    if not condition:
        errors.append(message)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _schema_ref_name(value: object) -> str:
    if value is None:
        return "NONE"
    if not isinstance(value, dict) or set(value) != {"$ref"}:
        return "INVALID"
    return str(value["$ref"]).rsplit("/", 1)[-1]


def validate_lifecycle_contracts(
    contracts: list[dict[str, str]],
    golden: list[dict[str, str]],
    transport: dict[str, object],
    sql: str,
    state_contract: str,
    implementation: str,
) -> tuple[list[str], int]:
    """Validate exact lifecycle API/state/schema/storage closure independently."""
    lifecycle_errors: list[str] = []
    lifecycle_checks = 0
    catalog_http = {
        (row["contract_id"], method): row
        for row in contracts
        if row.get("kind") == "HTTP"
        for method in row.get("operation_or_version", "").split("|")
    }
    operations = transport.get("operations", {})
    if not isinstance(operations, dict):
        return ["SYS transport operations must be an object"], 1
    local_http: dict[tuple[str, str], dict[str, object]] = {}
    for key, operation in operations.items():
        if not isinstance(operation, dict):
            lifecycle_errors.append(f"{key}: transport operation must be an object")
            continue
        operation_id = str(operation.get("sourceOperationId", key))
        local_http[(operation_id, str(operation.get("method", "")))] = operation
    lifecycle_checks += 3
    require(len(catalog_http) == 77, "SYS catalog must expose exactly 77 HTTP operations", lifecycle_errors)
    require(len(local_http) == 77, "SYS transport must expose exactly 77 HTTP operations", lifecycle_errors)
    require(set(catalog_http) == set(local_http), "SYS catalog/transport HTTP operation set drift", lifecycle_errors)

    defs = transport.get("$defs", {})
    if not isinstance(defs, dict):
        return lifecycle_errors + ["SYS transport $defs must be an object"], lifecycle_checks + 1
    command_schema_names: set[str] = set()
    for operation_id, (method, path, authorization, request_name) in LIFECYCLE_OPERATIONS.items():
        lifecycle_checks += 11
        catalog = catalog_http.get((operation_id, method), {})
        operation = local_http.get((operation_id, method), {})
        require(catalog.get("path_or_event") == path, f"{operation_id}: catalog path drift", lifecycle_errors)
        require(catalog.get("authorization") == authorization, f"{operation_id}: catalog authorization drift", lifecycle_errors)
        require(catalog.get("state_or_payload") == LIFECYCLE_STATES[operation_id], f"{operation_id}: catalog transition-state drift", lifecycle_errors)
        require(operation.get("path") == path, f"{operation_id}: transport path drift", lifecycle_errors)
        require(operation.get("authorization") == authorization, f"{operation_id}: transport authorization drift", lifecycle_errors)
        require(operation.get("mode") == ("query" if method == "GET" else "command"), f"{operation_id}: transport mode drift", lifecycle_errors)
        require(_schema_ref_name(operation.get("requestBodySchema")) == request_name, f"{operation_id}: request schema ref drift", lifecycle_errors)
        expected_response = "ConfigVersionResponse" if operation_id == "SYS-API-041" else "Receipt"
        require(_schema_ref_name(operation.get("responseSchema")) == expected_response, f"{operation_id}: response schema ref drift", lifecycle_errors)
        expected_header = "QueryHeaders" if method == "GET" else (
            "CommandHeaders" if operation_id in {"SYS-API-046", "SYS-API-051", "SYS-API-061"}
            else "CasCommandHeaders"
        )
        require(_schema_ref_name(operation.get("headerSchema")) == expected_header, f"{operation_id}: header/CAS schema ref drift", lifecycle_errors)
        require(operation.get("successStatus") == (200 if method == "GET" else 202), f"{operation_id}: success status drift", lifecycle_errors)
        require(_schema_ref_name(operation.get("errorSchema")) == "Problem", f"{operation_id}: error schema drift", lifecycle_errors)
        if request_name != "NONE":
            command_schema_names.add(request_name)

    for operation_id, (request_name, response_name, header_name) in LIFECYCLE_EXISTING_SCHEMA_REFS.items():
        operation = local_http.get((operation_id, "GET" if operation_id in {"SYS-API-019", "SYS-API-025"} else "POST"), {})
        lifecycle_checks += 3
        require(_schema_ref_name(operation.get("requestBodySchema")) == request_name, f"{operation_id}: existing lifecycle request schema drift", lifecycle_errors)
        require(_schema_ref_name(operation.get("responseSchema")) == response_name, f"{operation_id}: existing lifecycle response schema drift", lifecycle_errors)
        require(_schema_ref_name(operation.get("headerSchema")) == header_name, f"{operation_id}: existing lifecycle header schema drift", lifecycle_errors)
        if request_name != "NONE":
            command_schema_names.add(request_name)

    for schema_name in sorted(command_schema_names):
        lifecycle_checks += 2
        schema = defs.get(schema_name, {})
        require(
            isinstance(schema, dict)
            and schema.get("type") == "object"
            and schema.get("additionalProperties") is False,
            f"{schema_name}: command schema must be a closed object",
            lifecycle_errors,
        )
        if isinstance(schema, dict):
            require(
                set(schema.get("properties", {})) == set(schema.get("required", [])),
                f"{schema_name}: every command field must be explicit and required (nullable via schema union)",
                lifecycle_errors,
            )

    lifecycle_checks += 7
    extension_verify = defs.get("ExtensionVerifyCommand", {})
    require(
        set(extension_verify.get("required", []))
        == {
            "manifestDigest", "signatureDigest", "compatibilityDigest", "hookAllowlistDigest",
            "schemaDigest", "licenseDigest", "permissionManifestDigest", "verificationEvidenceDigest",
        },
        "ExtensionVerifyCommand exact verification evidence set drift",
        lifecycle_errors,
    )
    require(LIFECYCLE_NEGATIVE_TESTS <= set(transport.get("negativeTestRefs", [])), "SYS lifecycle negative-test allocation incomplete", lifecycle_errors)
    require(LIFECYCLE_GOLDEN_IDS <= {row.get("scenario_id", "") for row in golden}, "SYS lifecycle golden scenario set incomplete", lifecycle_errors)
    ddl_markers = {
        "legal_entity_scope_key TEXT GENERATED ALWAYS AS",
        "ex_sys_hris_config_version_ever_published_period EXCLUDE USING gist",
        "WHERE (published_at IS NOT NULL)",
        "tstzrange(effective_from, COALESCE(effective_to, 'infinity'::timestamptz), '[)')",
        "CREATE TABLE sys_automation_run_items",
        "CREATE TABLE sys_automation_item_attempts",
        "CREATE TABLE sys_automation_run_checkpoints",
        "retry_mode IN ('ALL_ITEMS','FAILED_ITEMS_ONLY')",
        "CREATE TABLE sys_connector_execution_items",
        "CREATE TABLE sys_connector_execution_attempts",
        "RESULT_UNKNOWN",
        "manifest_digest CHAR(64)",
        "signature_digest CHAR(64)",
        "compatibility_digest CHAR(64)",
        "hook_allowlist_digest CHAR(64)",
        "schema_digest CHAR(64)",
        "license_digest CHAR(64)",
        "permission_manifest_digest CHAR(64)",
        "INSTALLED_DISABLED",
    }
    require(ddl_markers <= {marker for marker in ddl_markers if marker in sql}, "SYS lifecycle physical DDL marker set incomplete", lifecycle_errors)
    require(sql.count("signature_digest CHAR(64)") >= 2, "SYS pack/install signature digest storage drift", lifecycle_errors)
    require(
        all(marker in state_contract for marker in ("Automation definition version", "Automation schedule", "RESULT_UNKNOWN", "FAILED_ITEMS_ONLY", "Extension pack and tenant installation")),
        "SYS lifecycle state-machine detail incomplete",
        lifecycle_errors,
    )
    require(
        all(marker in implementation for marker in ("SYS-API-041..045", "SYS-API-046..056", "SYS-API-057..068", "SYS-API-069..075", "platform-dependency-schema-binding-register.csv", "local DTO")),
        "SYS lifecycle implementation binding detail incomplete",
        lifecycle_errors,
    )
    return lifecycle_errors, lifecycle_checks


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    errors: list[str] = []
    checks = 0
    for path in [COVERAGE, CHILDREN, DECISIONS, *G2_FILES, *CENTRAL_FILES]:
        checks += 1
        require(path.is_file() and path.stat().st_size > 0, f"missing or empty: {path}", errors)
    if errors:
        print(json.dumps({"status": "FAIL", "checks": checks, "errors": errors}, ensure_ascii=False, indent=2))
        return 1

    coverage = read_csv(COVERAGE)
    children = read_csv(CHILDREN)
    decisions = read_csv(DECISIONS)
    contracts = read_csv(MODULE / "g2-contract-catalog.csv")
    golden = read_csv(MODULE / "g2-golden-scenarios.csv")
    permission_groups = read_csv(PERMISSION_GROUPS)
    atomic_duties = read_csv(ATOMIC_DUTIES)
    sod_rules = read_csv(SOD_RULES)
    ia_rows = read_csv(IA_REGISTER)
    shell_navigation = read_csv(SHELL_NAVIGATION)
    characterization = (MODULE / "g1-characterization.md").read_text(encoding="utf-8")
    checks += 3
    require("5670877de7a39e94e75021c7e23cbbb553296c90" in characterization, "SYS backend baseline drift", errors)
    require("7635ce4223000ed83cb4965f8374d8a8433f1a62" in characterization, "SYS frontend baseline drift", errors)
    require(
        "/api/hris/" not in "\n".join(
            " ".join(row.values()) for row in [*coverage, *children, *contracts]
        ),
        "obsolete non-service-routed /api/hris/** target remains",
        errors,
    )

    checks += 1
    require(len(coverage) == 189, f"expected 189 SYS parents; got {len(coverage)}", errors)
    parent_ids: set[str] = set()
    for index, row in enumerate(coverage, 2):
        checks += 9
        artifact_id = row.get("artifact_id", "")
        require(bool(artifact_id), f"coverage row {index}: missing artifact_id", errors)
        require(artifact_id not in parent_ids, f"coverage row {index}: duplicate {artifact_id}", errors)
        parent_ids.add(artifact_id)
        require(row.get("session_id") == "HRIS-SYS", f"coverage row {index}: wrong session", errors)
        require(row.get("source_module") == "sys", f"coverage row {index}: wrong source module", errors)
        require(row.get("disposition") in ALLOWED_DISPOSITIONS, f"coverage row {index}: invalid disposition", errors)
        require(row.get("decision_status") == "DECIDED", f"coverage row {index}: undecided", errors)
        require(bool(row.get("target_capability_id")), f"coverage row {index}: missing target capability", errors)
        require(bool(row.get("target_bounded_context_candidate")), f"coverage row {index}: missing bounded context", errors)
        require(bool(row.get("acceptance_evidence")), f"coverage row {index}: missing evidence", errors)
        target_text = " ".join(
            row.get(field, "")
            for field in ("target_capability_id", "target_bounded_context_candidate", "target_api_or_event", "target_data_owner")
        ).upper()
        require("BENSK" not in target_text and "ADDSK" not in target_text, f"coverage row {index}: customer target leakage", errors)

    checks += 2
    require(len(children) >= len(coverage), "each parent requires one or more child traces", errors)
    require(len(decisions) >= 10, "SYS requires category decisions", errors)
    decision_ids = {row.get("decision_id", "") for row in decisions}
    child_ids: set[str] = set()
    referenced_parents: set[str] = set()
    for index, row in enumerate(children, 2):
        checks += 8
        child_id = row.get("child_id", "")
        require(bool(child_id) and child_id not in child_ids, f"child row {index}: missing/duplicate child id", errors)
        child_ids.add(child_id)
        parent_id = row.get("parent_artifact_id", "")
        require(parent_id in parent_ids, f"child row {index}: orphan parent {parent_id}", errors)
        referenced_parents.add(parent_id)
        require(row.get("session_id") == "HRIS-SYS", f"child row {index}: wrong session", errors)
        require(row.get("decision_status") == "DECIDED", f"child row {index}: undecided", errors)
        require(row.get("disposition") in ALLOWED_DISPOSITIONS, f"child row {index}: invalid disposition", errors)
        require(row.get("decision_id") in decision_ids, f"child row {index}: missing decision reference", errors)
        require(bool(row.get("target_api_event_candidate")), f"child row {index}: missing API/event target", errors)
        require(bool(row.get("target_data_owner_candidate")), f"child row {index}: missing data owner", errors)
    checks += 1
    require(referenced_parents == parent_ids, f"parents without child trace: {len(parent_ids - referenced_parents)}", errors)

    package_codes = [row.get("package_code", "") for row in permission_groups]
    duty_codes = [row.get("duty_code", "") for row in atomic_duties]
    sod_codes = [row.get("rule_code", "") for row in sod_rules]
    referenced_duties = {
        value
        for row in permission_groups
        for value in row.get("atomic_duty_codes", "").split("|")
        if value
    }
    referenced_sod = {
        value
        for row in permission_groups
        for value in row.get("sod_rule_codes", "").split("|")
        if value
    } | {
        value
        for row in atomic_duties
        for value in row.get("dynamic_sod_rule_codes", "").split("|")
        if value
    }
    checks += 9
    require(len(permission_groups) == 31, f"expected exactly 31 access packages; got {len(permission_groups)}", errors)
    require(len(atomic_duties) == 115, f"expected exactly 115 atomic duties; got {len(atomic_duties)}", errors)
    require(len(sod_rules) == 29, f"expected exactly 29 SoD rules; got {len(sod_rules)}", errors)
    require(len(set(package_codes)) == 31 and all(package_codes), "access package codes must be exact unique non-empty", errors)
    require(len(set(duty_codes)) == 115 and all(duty_codes), "atomic duty codes must be exact unique non-empty", errors)
    require(len(set(sod_codes)) == 29 and all(sod_codes), "SoD rule codes must be exact unique non-empty", errors)
    require(referenced_duties == set(duty_codes), "access packages must cover the exact 115-duty catalog", errors)
    require(
        not (referenced_sod - set(sod_codes) - NON_SOD_POLICY_GUARDS),
        "package/duty catalog references an unknown SoD rule or named non-SoD policy guard",
        errors,
    )
    require(
        all(row.get("implementation_status") in ALLOWED_DUTY_IMPLEMENTATION_STATES for row in atomic_duties),
        "all 115 atomic duties must remain explicit reuse, target-new or planned G3 implementation scope",
        errors,
    )

    source_sets = {value: 0 for value in ("BASE76", "MODERN22")}
    for row in ia_rows:
        if row.get("source_set") in source_sets:
            source_sets[row["source_set"]] += 1
    checks += 4
    require(len(ia_rows) == 98 and source_sets == {"BASE76": 76, "MODERN22": 22}, "SYS explorer IA must be exact base76 + modern22", errors)
    require(
        len(shell_navigation) == 9
        and sum(row.get("entry_kind") == "FIXED_HOME" for row in shell_navigation) == 1
        and sum(row.get("entry_kind") == "WORKBENCH" for row in shell_navigation) == 7
        and sum(row.get("entry_kind") == "UTILITY_NOT_SIDEBAR" for row in shell_navigation) == 1,
        "SYS shell must consume exact Home + seven workbenches + Explorer contract",
        errors,
    )
    try:
        ia_completed = subprocess.run(
            [sys.executable, str(IA_VALIDATOR), "--compact"],
            cwd=str(IA_VALIDATOR.parent),
            capture_output=True,
            text=True,
            timeout=60,
            check=False,
        )
        ia_payload = json.loads(ia_completed.stdout)
    except (OSError, subprocess.TimeoutExpired, json.JSONDecodeError) as error:
        ia_completed = None
        ia_payload = {}
        errors.append(f"integrated IA validator invocation failed: {error}")
    require(
        ia_completed is not None
        and ia_completed.returncode == 0
        and ia_payload.get("status") == "PASS"
        and ia_payload.get("blockers") == []
        and ia_payload.get("coverage", {}).get("nodeCount") == 98
        and ia_payload.get("coverage", {}).get("modernNodeCount") == 22
        and ia_payload.get("coverage", {}).get("sidebarWorkbenchEntryCount") == 7,
        "SYS must consume a passing exact 98-node shell/IA projection",
        errors,
    )
    require(
        ia_payload.get("artifactSha256", {}).get(SHELL_NAVIGATION.name)
        == sha256(SHELL_NAVIGATION),
        "SYS shell navigation digest does not match the integrated IA proof",
        errors,
    )

    try:
        dependency_command = [sys.executable, str(PLATFORM_DEPENDENCY_VALIDATOR)]
        if args.self_test:
            dependency_command.append("--self-test")
        dependency_completed = subprocess.run(
            dependency_command,
            cwd=str(PLATFORM_DEPENDENCY_VALIDATOR.parent),
            capture_output=True,
            text=True,
            timeout=60,
            check=False,
        )
        dependency_payload = json.loads(dependency_completed.stdout)
    except (OSError, subprocess.TimeoutExpired, json.JSONDecodeError) as error:
        dependency_completed = None
        dependency_payload = {}
        errors.append(f"platform dependency schema validator invocation failed: {error}")
    checks += 5
    require(
        dependency_completed is not None
        and dependency_completed.returncode == 0
        and dependency_payload.get("status") == "PASS",
        "DEP-004/005/006/014 exact schema and generated-code binding validator did not PASS",
        errors,
    )
    if args.self_test:
        require(
            len(dependency_payload.get("cases", [])) == 10
            and all(case.get("status") == "PASS" for case in dependency_payload.get("cases", [])),
            "platform dependency schema negative self-tests are incomplete",
            errors,
        )
    else:
        require(dependency_payload.get("coverage", {}).get("dependencyCount") == 4, "platform dependency count drift", errors)
        require(dependency_payload.get("coverage", {}).get("schemaCount") == 11, "platform dependency schema count drift", errors)
        require(dependency_payload.get("coverage", {}).get("consumerTestAllocationCount") == 49, "platform dependency consumer-test allocation drift", errors)

    for index, row in enumerate(decisions, 2):
        checks += 6
        require(bool(row.get("decision_id")), f"decision row {index}: missing id", errors)
        require(row.get("status") == "DECIDED", f"decision row {index}: not decided", errors)
        require(row.get("proposed_decision") in ALLOWED_DISPOSITIONS, f"decision row {index}: invalid decision", errors)
        require(bool(row.get("owner_role")), f"decision row {index}: missing owner", errors)
        require(bool(row.get("resolution")), f"decision row {index}: missing resolution", errors)
        require(row.get("blocking_gate") == "G2_CODE_GO", f"decision row {index}: wrong gate", errors)

    checks += 4
    contract_ids = [row.get("contract_id", "") for row in contracts]
    require(len(contracts) >= 45, f"expected at least 45 SYS contracts; got {len(contracts)}", errors)
    require(len(contract_ids) == len(set(contract_ids)) and all(contract_ids), "contract ids must be unique and non-empty", errors)
    require(all(row.get("status") == "READY" for row in contracts), "all SYS contracts must be READY", errors)
    require(all(row.get("owner", "").startswith("dwp-") or "|" in row.get("owner", "") for row in contracts), "contract owner must be explicit", errors)
    for index, row in enumerate(contracts, 2):
        checks += 2
        require(bool(row.get("authorization")), f"contract row {index}: missing authorization", errors)
        if "POST" in row.get("operation_or_version", ""):
            require(row.get("idempotency") in {"REQUIRED", "POST_REQUIRED"}, f"contract row {index}: command missing idempotency", errors)
        else:
            checks += 1

    contract_by_id = {row["contract_id"]: row for row in contracts}
    exact_contracts = {
        "SYS-API-031": ("GET", "/api/platform/v1/home-preferences/surfaces/{surfaceKey}", "route.hcm.personal.home-preference.data"),
        "SYS-API-032": ("PUT", "/api/platform/v1/home-preferences/surfaces/{surfaceKey}", "route.hcm.personal.home-preference-update.action"),
        "SYS-API-033": ("GET", "/api/platform/v1/admin/hris/file-transfers", "DWP_CONTROLLED_TRANSFER_READ"),
        "SYS-API-034": ("POST", "/api/platform/v1/admin/hris/file-transfers", "DWP_CONTROLLED_TRANSFER_CREATE"),
        "SYS-API-035": ("GET", "/api/platform/v1/admin/hris/operations/exceptions", "DWP_HRIS_OPERATIONS_EXCEPTION_READ"),
        "SYS-API-036": ("GET", "/api/platform/v1/admin/hris/operations/exceptions/{exceptionId}", "DWP_HRIS_OPERATIONS_EXCEPTION_READ"),
        "SYS-API-037": ("GET", "/api/auth/v1/admin/hris/command-receipts/{receiptId}", "HRIS_ACCESS_RECEIPT_READ"),
        "SYS-API-038": ("GET", "/api/platform/v1/admin/hris/command-receipts/{receiptId}", "DWP_HRIS_COMMAND_RECEIPT_READ"),
    }
    for contract_id, (method, path, authorization) in exact_contracts.items():
        checks += 4
        row = contract_by_id.get(contract_id)
        require(row is not None, f"missing exact SYS contract {contract_id}", errors)
        if row is not None:
            require(row.get("operation_or_version") == method, f"{contract_id}: method drift", errors)
            require(row.get("path_or_event") == path, f"{contract_id}: path drift", errors)
            require(row.get("authorization") == authorization, f"{contract_id}: authorization drift", errors)
    checks += 1
    require(
        contract_by_id.get("SYS-API-032", {}).get("idempotency") == "BASELINE_BODY_VERSION_CAS",
        "SYS-API-032 must preserve the pinned Platform body-version CAS exception",
        errors,
    )
    checks += 3
    require("SYS-EVT-008" in contract_by_id, "controlled-transfer event contract missing", errors)
    require("SYS-EVT-009" in contract_by_id, "operational-exception event contract missing", errors)
    require(
        all("/api/platform/v1/hris/home/preferences" not in " ".join(row.values()) for row in contracts),
        "duplicate HRIS home-preference endpoint must not replace existing Platform surface API",
        errors,
    )

    checks += 4
    scenario_ids = [row.get("scenario_id", "") for row in golden]
    require(len(golden) >= 40, f"expected at least 40 golden scenarios; got {len(golden)}", errors)
    require(len(scenario_ids) == len(set(scenario_ids)) and all(scenario_ids), "golden scenario ids must be unique", errors)
    require(all(row.get("status") == "READY" for row in golden), "all SYS golden scenarios must be READY", errors)
    require({"TENANT", "SOD", "CONFIG", "AUTOMATION", "CONNECTOR", "HOME", "HOME_PREFERENCE", "EXPLORER", "FILE", "OPERATIONS", "AUTHORIZATION"}.issubset({row.get("area") for row in golden}), "golden area coverage incomplete", errors)
    receipt_golden = next((row for row in golden if row.get("scenario_id") == "SYS-GOLD-040"), {})
    require("sealed originating" in receipt_golden.get("expected_result", "").lower() and "never broadens" in receipt_golden.get("negative_or_recovery", "").lower(), "SYS receipt reauthorization golden contract missing", errors)
    receipt_replay_golden = next((row for row in golden if row.get("scenario_id") == "SYS-GOLD-045"), {})
    checks += 1
    require(
        "original receipt" in receipt_replay_golden.get("expected_result", "").lower()
        and "independent receipt" in receipt_replay_golden.get("expected_result", "").lower()
        and "different digest" in receipt_replay_golden.get("negative_or_recovery", "").lower()
        and "immutable sealed" in receipt_replay_golden.get("negative_or_recovery", "").lower(),
        "SYS caller-bound idempotency and immutable receipt golden contract missing",
        errors,
    )
    explorer_golden = next((row for row in golden if row.get("scenario_id") == "SYS-GOLD-029"), {})
    checks += 1
    require(
        "base 76 plus modern 22" in explorer_golden.get("precondition", "").lower()
        and "all 98" in explorer_golden.get("expected_result", "").lower()
        and "modern node" in explorer_golden.get("negative_or_recovery", "").lower(),
        "SYS explorer golden must prove complete 98-node authorized projection",
        errors,
    )

    sql = (MODULE / "g2-physical-schema.sql").read_text(encoding="utf-8")
    auth_sql = (MODULE / "g2-auth-physical-schema.sql").read_text(encoding="utf-8")
    platform_sql = (MODULE / "g2-platform-physical-schema.sql").read_text(encoding="utf-8")
    migration_errors, migration_checks, migration_details = validate_service_local_sql(
        sql,
        auth_sql,
        platform_sql,
    )
    checks += migration_checks
    errors.extend(f"service-local migration: {error}" for error in migration_errors)
    migration_self_tests = 0
    if args.self_test and not migration_errors:
        mutations = [
            (
                auth_sql.replace(
                    "package_code VARCHAR(120)",
                    "package_code VARCHAR(121)",
                    1,
                ),
                platform_sql,
            ),
            (
                auth_sql.replace(
                    "REFERENCES sys_product_access_package_catalog(package_id)",
                    "REFERENCES sys_hris_config_sets(config_set_id)",
                    1,
                ),
                platform_sql,
            ),
            (
                auth_sql,
                platform_sql.replace("    'sys_hris_config_sets',\n", "", 1),
            ),
        ]
        for number, (mutated_auth, mutated_platform) in enumerate(mutations, 1):
            migration_self_tests += 1
            mutation_errors, _, _ = validate_service_local_sql(
                sql,
                mutated_auth,
                mutated_platform,
                check_prefix_register=False,
            )
            if not mutation_errors:
                errors.append(
                    f"service-local migration self-test mutation {number} was not rejected"
                )
    required_tables = {
        "sys_product_access_package_catalog",
        "com_product_access_package_assignments",
        "com_product_access_package_projection_status",
        "com_product_access_command_receipts",
        "sys_hris_config_versions",
        "sys_automation_runs",
        "sys_automation_run_attempts",
        "sys_connector_definitions",
        "sys_connector_executions",
        "sys_hris_home_contributions",
        "sys_hris_explorer_preferences",
        "sys_hris_explorer_favorites",
        "sys_hris_explorer_recents",
        "sys_controlled_file_transfers",
        "sys_operational_exception_projections",
        "sys_tenant_extension_installations",
        "sys_hris_command_receipts",
    }
    for table in required_tables:
        checks += 1
        require(f"CREATE TABLE {table}" in sql, f"schema missing {table}", errors)
    for marker in (
        "dwp.tenant_id", "ENABLE ROW LEVEL SECURITY", "FORCE ROW LEVEL SECURITY",
        "NOBYPASSRLS", "FOREIGN KEY (tenant_id, assignment_id)",
        "FOREIGN KEY (tenant_id, config_set_id)", "FOREIGN KEY (tenant_id, automation_id)",
        "FOREIGN KEY (tenant_id, run_id)", "FOREIGN KEY (tenant_id, connector_id)",
        "FOREIGN KEY (tenant_id, connector_id, mapping_version_id)",
        "FOREIGN KEY (tenant_id, run_id, attempt_id)",
        "FOREIGN KEY (tenant_id, run_id, run_item_id)",
        "FOREIGN KEY (tenant_id, execution_id, execution_item_id)",
        "browser_audience VARCHAR(24) NOT NULL",
        "owner_population_scope VARCHAR(32) NOT NULL",
        "field_decisions JSONB NOT NULL",
        "projection_schema_id VARCHAR(80) NOT NULL",
        "typed_projection JSONB NOT NULL",
        "ck_sys_hris_home_projection_pair",
        "UNIQUE (tenant_id, principal_public_id)",
        "UNIQUE (tenant_id, principal_public_id, route_key)",
        "position SMALLINT NOT NULL",
        "position BETWEEN 1 AND 20",
        "expires_at = last_visited_at + INTERVAL '30 days'",
    ):
        checks += 1
        require(marker in sql, f"schema tenant boundary missing {marker}", errors)
    for forbidden in ("DROP TABLE", "TRUNCATE ", "DELETE FROM", "PASSWORD VARCHAR", "BANK_ACCOUNT VARCHAR", "NATIONAL_ID VARCHAR"):
        checks += 1
        require(forbidden not in sql.upper(), f"schema contains forbidden construct: {forbidden}", errors)

    transfer_sql_markers = (
        "transfer_kind IN ('INGEST','EXPORT','DELIVERY','EXCHANGE')",
        "recipient_policy_ref", "egress_policy_revision", "object_version",
        "storage_etag", "metadata_authority", "metadata_snapshot_digest",
        "scanner_key", "scanner_version", "scan_object_digest", "scan_byte_size",
        "ck_sys_controlled_transfer_direction_policy",
        "ck_sys_controlled_transfer_metadata_binding",
        "object_digest = scan_object_digest AND byte_size = scan_byte_size",
    )
    for marker in transfer_sql_markers:
        checks += 1
        require(marker in sql, f"controlled-transfer physical TOCTOU contract missing {marker}", errors)
    transport = json.loads((MODULE / "g2-transport-schemas.v1.json").read_text(encoding="utf-8"))
    state_contract = (MODULE / "g2-state-machines.md").read_text(encoding="utf-8")
    implementation = (MODULE / "g2-implementation-contract.md").read_text(encoding="utf-8")
    lifecycle_errors, lifecycle_checks = validate_lifecycle_contracts(
        contracts, golden, transport, sql, state_contract, implementation
    )
    checks += lifecycle_checks
    errors.extend(f"lifecycle contract: {error}" for error in lifecycle_errors)
    lifecycle_self_tests = 0
    if args.self_test and not lifecycle_errors:
        lifecycle_mutations: list[
            tuple[list[dict[str, str]], list[dict[str, str]], dict[str, object], str]
        ] = []
        mutated_transport = copy.deepcopy(transport)
        mutated_transport["operations"]["SYS-API-049"]["authorization"] = "DWP_AUTOMATION_ADMIN"
        lifecycle_mutations.append((contracts, golden, mutated_transport, sql))
        mutated_transport = copy.deepcopy(transport)
        mutated_transport["negativeTestRefs"].remove("automation-worker-crash-checkpoint-replay")
        lifecycle_mutations.append((contracts, golden, mutated_transport, sql))
        lifecycle_mutations.append((contracts, golden[:-1], transport, sql))
        lifecycle_mutations.append((contracts, golden, transport, sql.replace("signature_digest CHAR(64)", "signature_hash CHAR(64)", 1)))
        for number, (case_contracts, case_golden, case_transport, case_sql) in enumerate(lifecycle_mutations, 1):
            lifecycle_self_tests += 1
            mutation_errors, _ = validate_lifecycle_contracts(
                case_contracts, case_golden, case_transport, case_sql, state_contract, implementation
            )
            if not mutation_errors:
                errors.append(f"lifecycle contract self-test mutation {number} was not rejected")
    receipt_schema = transport.get("$defs", {}).get("Receipt", {})
    expected_receipt_fields = {
        "receiptId", "commandType", "originatingAction", "subjectPrincipalPublicId",
        "populationScopeDigest", "fieldPolicyRevision", "purposeCode",
        "authorizationRevision", "status", "correlationId", "requestDigest", "createdAt",
    }
    checks += 5
    require(
        receipt_schema.get("type") == "object"
        and receipt_schema.get("additionalProperties") is False
        and set(receipt_schema.get("required", [])) == expected_receipt_fields,
        "SYS command receipt closed schema drift",
        errors,
    )
    for operation_id in ("SYS-API-037", "SYS-API-038"):
        operation = transport.get("operations", {}).get(operation_id, {})
        require(
            operation.get("authorizationContext") == "SEALED_ORIGINATING_COMMAND_CONTEXT"
            and operation.get("authorizationRule") == "MORE_RESTRICTIVE_OF_CURRENT_AND_ORIGINATING"
            and operation.get("opaqueNotFoundOnContextMismatch") is True,
            f"{operation_id}: sealed receipt reauthorization drift",
            errors,
        )
    require(
        {"receipt-caller-bound-idempotency", "receipt-sealed-authorization-context"}
        <= set(transport.get("negativeTestRefs", [])),
        "SYS command receipt negative contract missing",
        errors,
    )
    for receipt_sql, receipt_table in (
        (auth_sql, "com_product_access_command_receipts"),
        (platform_sql, "sys_hris_command_receipts"),
    ):
        require(
            f"UNIQUE (tenant_id, subject_principal_public_id, originating_action, idempotency_key)" in receipt_sql
            and f"BEFORE UPDATE OR DELETE ON {receipt_table}" in receipt_sql,
            f"{receipt_table}: caller-bound idempotency or immutable guard drift",
            errors,
        )
    transfer_schema = transport.get("$defs", {}).get("FileTransferCommand", {})
    transfer_properties = transfer_schema.get("properties", {})
    checks += 7
    require(transfer_properties.get("transferKind", {}).get("enum")
            == ["INGEST", "EXPORT", "DELIVERY", "EXCHANGE"],
            "FileTransferCommand canonical transferKind enum drift", errors)
    require("transferIntent" not in transfer_properties and "direction" not in transfer_properties,
            "FileTransferCommand retains ambiguous direction/intent alias", errors)
    require({"objectVersion", "objectDigest", "byteSize", "mediaType", "malwareScanSnapshot", "toctouBinding"}
            <= set(transfer_schema.get("required", [])),
            "FileTransferCommand does not require atomic object metadata/scan binding", errors)
    require({"recipientPolicyRef", "egressPolicyRevision"} <= set(transfer_properties),
            "FileTransferCommand outbound policy fields missing", errors)
    conditional_policy = transfer_schema.get("allOf") or (
        transfer_schema.get("if") and transfer_schema.get("then")
    )
    require(bool(conditional_policy),
            "FileTransferCommand lacks transfer-kind conditional policy schema", errors)
    require(
        transfer_schema.get("x-directionByTransferKind") == {
            "INGEST": "INBOUND", "EXPORT": "OUTBOUND",
            "DELIVERY": "OUTBOUND", "EXCHANGE": "OUTBOUND",
        }
        and transfer_schema.get("if", {}).get("properties", {}).get("transferKind", {}).get("enum")
        == ["EXPORT", "DELIVERY", "EXCHANGE"]
        and {"recipientPolicyRef", "egressPolicyRevision"}
        <= set(transfer_schema.get("then", {}).get("required", [])),
        "FileTransferCommand transfer-kind direction/outbound policy drift", errors,
    )
    require("`transferKind` is the only command/domain/storage enum" in state_contract
            and "metadata_snapshot_digest" in state_contract,
            "controlled-transfer state contract lacks canonical kind/TOCTOU rule", errors)
    require("SYS-GOLD-039" in scenario_ids,
            "controlled-transfer TOCTOU golden case missing", errors)

    for term in ("dwp-sys-server", "/hr/home", "/hr/explore", "base 76 + modern 22 = 98", "hris-shell-navigation-register.csv", "G6 activation", "Idempotency", "usr_home_preferences", "fixed constraint `surfaceKey=hcm-home`", "read-only projection", "BASELINE_BODY_VERSION_CAS", "browserAudience", "ownerPopulationScope", "VIEW/MASK/OMIT", "20 favorites", "30-day TTL", "entitlement re-filter"):
        checks += 1
        require(term in implementation, f"implementation contract missing {term}", errors)

    artifact_hashes = {
        path.name: sha256(path)
        for path in [COVERAGE, CHILDREN, DECISIONS, *G2_FILES, *CENTRAL_FILES]
    }
    payload = {
        "schema": "dwp.hris.sys.code-readiness.v1",
        "status": "PASS" if not errors else "FAIL",
        "checks": checks,
        "parents": len(coverage),
        "children": len(children),
        "decisions": len(decisions),
        "contracts": len(contracts),
        "goldenScenarios": len(golden),
        "accessPackages": len(permission_groups),
        "atomicDuties": len(atomic_duties),
        "sodRules": len(sod_rules),
        "iaNodes": len(ia_rows),
        "shellNavigationEntries": len(shell_navigation),
        "serviceLocalMigrations": migration_details,
        "migrationSelfTests": migration_self_tests,
        "lifecycleSelfTests": lifecycle_self_tests,
        "errors": errors,
        "artifactSha256": artifact_hashes,
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True))
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
