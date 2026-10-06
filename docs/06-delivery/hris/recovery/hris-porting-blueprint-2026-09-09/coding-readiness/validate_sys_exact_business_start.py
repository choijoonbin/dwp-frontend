#!/usr/bin/env python3
"""Fail-closed assurance for the exact 17-slice HRIS-SYS G3 design surface.

This validator does not authorize the global code gate, claim implementation,
or activate a provider/country/customer binding.  It proves that the current
SYS successor is an exact, source-derived START input and that every active
slice is bound to transport, lifecycle, data, authorization, evidence, file,
and migration contracts.  ``--self-test`` mutates in-memory copies only.
"""

from __future__ import annotations

import argparse
import copy
import csv
import hashlib
import json
import pathlib
import re
import sys
from collections import Counter, defaultdict
from typing import Any, Callable


HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
MANIFEST_PATH = HERE / "sys-exact-business-start-successor.v1.json"
LINEAGE_PATH = HERE / "sys-exact-business-successor-lineage.v1.json"
PIN_PATH = HERE / "sys-exact-business-start-pin.v1.json"
LISTENING_SUMMARY_ID = "dwp.hris.sys.listening.stream-authority-successor.v1"
LISTENING_SUMMARY_PATH = "coding-readiness/sys-listening-stream-authority-successor.v1.json"
LISTENING_STREAM_KEYS = {
    "platform-hris-configuration",
    "platform-hris-listening-protected",
    "platform-hris-insights",
    "auth-hris-participation-issuer",
}
LISTENING_BACKEND_PROFILES = {
    "G3-SYS-LISTEN-CONFIGURATION-BE",
    "G3-SYS-LISTEN-PROTECTED-BE",
    "G3-SYS-LISTEN-INSIGHTS-BE",
    "G3-SYS-LISTEN-ISSUER-BE",
}
LISTENING_FRONTEND_PROFILE = "G3-SYS-LISTEN-FE"
LISTENING_OWNER_PORTS = {
    "configuration.querySurveys",
    "configuration.createSurvey",
    "configuration.reviseSurvey",
    "configuration.publishSurveyOrchestrate",
    "configuration.closeSurveyOrchestrate",
    "configuration.createAction",
    "configuration.completeAction",
    "protected.listActiveAdmissions",
    "protected.installAdmission",
    "protected.closeAdmission",
    "protected.submitResponse",
    "protected.requestErasure",
    "protected.buildCohortPackage",
    "insights.ingestCohortPackage",
    "insights.queryCohortResults",
    "issuer.issueParticipationEnvelope",
    "issuer.resolveParticipationStatus",
    "issuer.revokeParticipationEnvelope",
}
LISTENING_OWNER_LOCAL_ERASURE_REQUEST_HANDLER = (
    "internal.listening.protected.erasure.request"
)
LISTENING_OWNER_LOCAL_ERASURE_PROCESS_HANDLER = (
    "internal.listening.protected.erasure.process"
)
LISTENING_INTERNAL_HANDLER_BY_MESSAGE = {
    "ListeningAdmissionInstallRequested.v1": (
        "internal.listening.protected.admission-install.consume",
        "platform-hris-listening-protected",
        "sys_hris_listening_protected_receipts",
        "sys_hris_listening_protected_outbox",
    ),
    "ListeningAdmissionInstallReceipt.v1": (
        "internal.listening.configuration.admission-install-receipt.consume",
        "platform-hris-configuration",
        "sys_hris_listening_operation_receipts",
        "sys_hris_listening_domain_outbox",
    ),
    "ListeningAdmissionCloseRequested.v1": (
        "internal.listening.protected.admission-close.consume",
        "platform-hris-listening-protected",
        "sys_hris_listening_protected_receipts",
        "sys_hris_listening_protected_outbox",
    ),
    "ListeningAdmissionCloseReceipt.v1": (
        "internal.listening.configuration.admission-close-receipt.consume",
        "platform-hris-configuration",
        "sys_hris_listening_operation_receipts",
        "sys_hris_listening_domain_outbox",
    ),
    "ListeningCohortPackageReady.v1": (
        "internal.listening.insights.cohort-package.consume",
        "platform-hris-insights",
        "sys_hris_listening_insights_inbox",
        "sys_hris_listening_insights_outbox",
    ),
    "ListeningCohortProjectionReceipt.v1": (
        "internal.listening.protected.cohort-projection-receipt.consume",
        "platform-hris-listening-protected",
        "sys_hris_listening_protected_receipts",
        "sys_hris_listening_protected_outbox",
    ),
}
LISTENING_OWNER_LOCAL_HANDLER_IDS = {
    LISTENING_OWNER_LOCAL_ERASURE_REQUEST_HANDLER,
    LISTENING_OWNER_LOCAL_ERASURE_PROCESS_HANDLER,
    *(item[0] for item in LISTENING_INTERNAL_HANDLER_BY_MESSAGE.values()),
}
HISTORICAL_SYS_MODERN_BODY_SHA256 = (
    "cb770ad54b7a3c58eab3aa05ba5f88239941223e7645016dab071a5598bc584d"
)

EXACT_ASSURANCE_IDS = tuple(
    [f"TFR-SYS-{number:03d}" for number in range(1, 14)]
    + ["BASE-TFR-HRM-015", "MOD-SYS-ANALYTICS", "MOD-SYS-LISTEN", "MOD-SYS-AI"]
)
EXACT_G3_IDS = tuple(
    [f"BASE-TFR-SYS-{number:03d}" for number in range(1, 14)]
    + ["BASE-TFR-HRM-015", "MOD-SYS-ANALYTICS", "MOD-SYS-LISTEN", "MOD-SYS-AI"]
)
G4_ASSERTIONS = {
    "authorization-negative",
    "feature-flag-event-forward-correction",
    "idempotency-cas",
    "migration-clean-upgrade-rls-backfill",
    "runbook-rollback-forward-correction",
    "telemetry-alert",
    "tenant-isolation",
    "worker-crash-replay",
}
PEP_LAYERS = (
    "GATEWAY_APP_ENTITLEMENT",
    "OWNER_API_OPERATION",
    "RESOURCE_POPULATION",
    "REPOSITORY_TENANT_PREDICATE",
    "FIELD_PROJECTION",
    "PURPOSE_POLICY",
    "AUDIT_DECISION",
)
ACTIVATION_IDS = {
    "ACT-G6-ERP",
    "ACT-G6-BANK",
    "ACT-G6-TAX-INSURANCE",
    "ACT-G6-CLOCK",
    "ACT-G6-CUSTOM-LEGACY",
    "ACT-G6-PROD-SECRETS",
}
IA_IDS = {
    "IAQ-032", "IAQ-033", "IAQ-035", "IAQ-052", "IAQ-057", "IAQ-058",
    "IAQ-059", "IAQ-060", "IAQ-061", "IAQ-062", "IAQ-063", "IAQ-065",
    "IAQ-066",
}

EXPECTED_SOURCE: dict[str, dict[str, Any]] = {
    "TFR-SYS-001": {"sha": "a0dae833740f05696a27d3eea8c3212c8547ed475e8e4c7e87bffa93c71d060c", "rows": 16, "decision": "DEC-SYS-009", "disposition": "REUSE", "mode": "RELATED_REUSE_ALLOWED", "context": "DWP_AUDIT_GOVERNANCE", "owners": ["dwp-platform-server"], "group": "NONE_SHARED_OWNER_REUSE"},
    "TFR-SYS-002": {"sha": "5b4a9d774a961d56f2225749f6981122106d3b863b8a2d601034313758559d6f", "rows": 5, "decision": "DEC-SYS-012", "disposition": "REUSE", "mode": "PRIMARY_WITH_RELATED_OWNER_DEEP_LINK", "context": "DWP_OPERATIONS_PLATFORM", "owners": ["dwp-platform-server"], "group": "PLATFORM_OPERATIONS"},
    "TFR-SYS-003": {"sha": "ef4581a0a39a65591d10d96a2a3663fdafaa3dda9daebb239a9720e99a5f23a1", "rows": 10, "decision": "DEC-SYS-006", "disposition": "REUSE", "mode": "RELATED_REUSE_ALLOWED", "context": "DWP_APPROVAL_PLATFORM", "owners": ["dwp-approval-server"], "group": "NONE_SHARED_OWNER_REUSE"},
    "TFR-SYS-004": {"sha": "9be834804aff393b5f2618b1b41162af5b13827e1d61527b57e8cb59f0971a26", "rows": 39, "decision": "DEC-SYS-001", "disposition": "REUSE", "mode": "PRIMARY_OWNED_STATEFUL", "context": "DWP_AUTH_PLATFORM", "owners": ["dwp-auth-server"], "group": "AUTH_PRODUCT_ACCESS"},
    "TFR-SYS-005": {"sha": "2f7300f5a1141bd786ffad12d6d5504f9478cbf1d18e76b60b1fc0fb9eb73421", "rows": 12, "decision": "DEC-SYS-007", "disposition": "REUSE", "mode": "RELATED_REUSE_ALLOWED", "context": "DWP_NOTIFICATION_PLATFORM", "owners": ["dwp-notification-server"], "group": "NONE_SHARED_OWNER_REUSE"},
    "TFR-SYS-006": {"sha": "29d8eb318606a7c20946d21941bc0e55cd17a631836ad02434322f9d2c3ca11b", "rows": 10, "decision": "DEC-SYS-004", "disposition": "REBUILD", "mode": "PRIMARY_OWNED_STATEFUL", "context": "DWP_PLATFORM_AUTOMATION", "owners": ["dwp-platform-server"], "group": "PLATFORM_AUTOMATION"},
    "TFR-SYS-007": {"sha": "c36c35b9ff77e9dfd8149cde55970c364febd07af1ee3c6f9b89d0390330974d", "rows": 37, "decision": "DEC-SYS-003", "disposition": "CONFIGURE", "mode": "PRIMARY_OWNED_STATEFUL", "context": "HRIS_CONFIGURATION", "owners": ["dwp-platform-server"], "group": "PLATFORM_CONFIGURATION"},
    "TFR-SYS-008": {"sha": "8fd5277d423ee42f21b1cb551b06aa2ff73fa058352ba4e8433f0a6eebd7f6ce", "rows": 19, "decision": "DEC-SYS-005", "disposition": "REBUILD", "mode": "PRIMARY_OWNED_STATEFUL", "context": "DWP_PLATFORM_INTEGRATION", "owners": ["dwp-platform-server"], "group": "PLATFORM_CONNECTOR"},
    "TFR-SYS-009": {"sha": "67e1fb1215135de465c152070478ff652b2a0bbab1996b6b1afd1ec4f0dd6172", "rows": 2, "decision": "DEC-SYS-011", "disposition": "REBUILD", "mode": "PRIMARY_OWNED_STATEFUL", "context": "DWP_FILE_PLATFORM", "owners": ["dwp-platform-server"], "group": "PLATFORM_CONTROLLED_TRANSFER"},
    "TFR-SYS-010": {"sha": "f9729b2bdf8575a425ae650f0e947c102649a11f5eb1fc9936d9aba303d3a525", "rows": 9, "decision": "DEC-SYS-010", "disposition": "REBUILD", "mode": "RELATED_REUSE_ALLOWED", "context": "DWP_DATA_GOVERNANCE", "owners": ["dwp-provider-server"], "group": "NONE_SHARED_OWNER_REUSE"},
    "TFR-SYS-011": {"sha": "43784624aa57a83cc35a35803e95230f72539f616c493ec6b0381b017925cbe7", "rows": 19, "decision": "DEC-SYS-002", "disposition": "REUSE", "mode": "RELATED_REUSE_ALLOWED", "context": "DWP_TENANT_ENTERPRISE", "owners": ["dwp-provider-server"], "group": "NONE_SHARED_OWNER_REUSE"},
    "TFR-SYS-012": {"sha": "b9eaff79e11eb4a6439f999addb6ce4c2ff22a2913b8230af976a475189818e6", "rows": 7, "decision": "DEC-SYS-008", "disposition": "REBUILD", "mode": "PRIMARY_WITH_RELATED_COMPOSITION", "context": "HRIS_SHELL_EXPERIENCE", "owners": ["dwp-platform-server", "dwp-frontend"], "group": "PLATFORM_EXPERIENCE"},
    "TFR-SYS-013": {"sha": "9b3e616b881fc37c5553f5b44bab2a703d9e04a0f03466f925b1a4076ee5a77a", "rows": 4, "decision": "DEC-SYS-013", "disposition": "RETIRE", "mode": "RETIRED_DECISION_NO_CODE", "context": "DWP_SHARED_PLATFORM", "owners": ["dwp-platform-server"], "group": "NONE_RETIRED"},
    "BASE-TFR-HRM-015": {"sha": "51ab756e1c54caa3310e888ef454d37446d9e277b4832090f8600ff7bd1e2e1d", "rows": 6, "decision": "HRM-DEC-010", "disposition": "EXTENSION", "mode": "PRIMARY_SIGNED_EXTENSION_OWNER", "context": "HRIS_TENANT_EXTENSION", "owners": ["dwp-platform-server"], "group": "PLATFORM_EXTENSION"},
}

MODERN: dict[str, dict[str, Any]] = {
    "HRIS.MODERN.PEOPLE_ANALYTICS": {"slice": "MOD-SYS-ANALYTICS", "context": "DWP_PLATFORM_HRIS_INSIGHTS", "group": "MODERN_PEOPLE_ANALYTICS", "ops": 7, "internalOps": 0, "transitions": 5, "events": 5, "tables": 4, "tests": 3, "migration": "V288__hris_platform_modern_people_analytics.sql"},
    "HRIS.MODERN.EMPLOYEE_LISTENING": {"slice": "MOD-SYS-LISTEN", "context": f"CANONICAL_FIVE_PRIMARY_DERIVED_SUMMARY_VERIFIED:{LISTENING_SUMMARY_ID}", "group": "LISTENING_SUCCESSOR_FOUR_STREAM_GROUPS", "ops": 10, "internalOps": 0, "transitions": 0, "events": 7, "tables": 24, "tests": 3, "migration": "FOUR_STREAM_V1_RESERVATIONS"},
    "HRIS.MODERN.GOVERNED_AI": {"slice": "MOD-SYS-AI", "context": "DWP_PLATFORM_HRIS_CONFIGURATION", "group": "MODERN_GOVERNED_AI", "ops": 7, "internalOps": 1, "transitions": 7, "events": 7, "tables": 5, "tests": 3, "migration": "V289__hris_platform_modern_governed_ai.sql"},
}
MODERN_OPERATION_IDS = {
    "HRIS.MODERN.PEOPLE_ANALYTICS": {
        "modern.analytics.metrics.query", "modern.analytics.metric.create",
        "modern.analytics.metric.validate", "modern.analytics.metric.publish",
        "modern.analytics.cohorts.query", "modern.analytics.export.create",
        "modern.analytics.metric.retire",
    },
    "HRIS.MODERN.EMPLOYEE_LISTENING": {
        "modern.listening.active.query", "modern.listening.response.submit",
        "modern.listening.surveys.query",
        "modern.listening.survey.create", "modern.listening.survey.revise",
        "modern.listening.survey.publish",
        "modern.listening.survey.close", "modern.listening.cohorts.query",
        "modern.listening.action.create", "modern.listening.action.complete",
    },
    "HRIS.MODERN.GOVERNED_AI": {
        "modern.ai.assist.create", "modern.ai.policies.query",
        "modern.ai.policy.create", "modern.ai.policy.evaluate",
        "modern.ai.policy.publish", "modern.ai.kill.switch",
        "modern.ai.policy.retire",
    },
}
MODERN_EVENT_NAMES = {
    "HRIS.MODERN.PEOPLE_ANALYTICS": {"PeopleMetricCreated.v2", "PeopleMetricValidated.v2", "PeopleMetricPublished.v2", "PeopleAnalyticsExportRequested.v2", "PeopleMetricRetired.v2"},
    "HRIS.MODERN.EMPLOYEE_LISTENING": {"EmployeeListeningActionCompleted.v3", "EmployeeListeningActionCreated.v3", "EmployeeListeningCohortProjectionPublished.v1", "EmployeeListeningSurveyClosed.v3", "EmployeeListeningSurveyCreated.v3", "EmployeeListeningSurveyRevised.v3", "EmployeeListeningSurveyPublished.v3"},
    "HRIS.MODERN.GOVERNED_AI": {"GovernedAiAssistanceProduced.v2", "GovernedAiPolicyCreated.v2", "GovernedAiPolicyEvaluationRequested.v2", "GovernedAiPolicyPublished.v2", "GovernedAiPolicySuspended.v2", "GovernedAiPolicyRetired.v2", "GovernedAiPolicyEvaluationCompleted.v2"},
}
MODERN_INTERNAL_OPERATION_IDS = {
    "HRIS.MODERN.PEOPLE_ANALYTICS": set(),
    "HRIS.MODERN.EMPLOYEE_LISTENING": set(),
    "HRIS.MODERN.GOVERNED_AI": {"internal.ai.policy-evaluation.complete"},
}
MODERN_TRANSITION_IDS = {
    "HRIS.MODERN.PEOPLE_ANALYTICS": {f"MOD-SYS-ANALYTICS-TR-{number:03d}" for number in range(1, 6)},
    "HRIS.MODERN.EMPLOYEE_LISTENING": set(),
    "HRIS.MODERN.GOVERNED_AI": {f"MOD-SYS-AI-TR-{number:03d}" for number in range(1, 7)} | {"MOD-SYS-AI-TR-EVALUATION-ACK-V2"},
}
EXPECTED_MODERN_OPERATION_COUNT = sum(
    len(operation_ids) for operation_ids in MODERN_OPERATION_IDS.values()
)
EXPECTED_MODERN_EVENT_COUNT = sum(
    len(event_names) for event_names in MODERN_EVENT_NAMES.values()
)
EXPECTED_MODERN_TRANSITION_COUNT = sum(
    len(transition_ids) for transition_ids in MODERN_TRANSITION_IDS.values()
)
EXPECTED_MODERN_TABLE_COUNT = sum(
    metadata["tables"] for metadata in MODERN.values()
)
MODERN_ENTRY_QUERY_IDS = {
    "HRIS.MODERN.PEOPLE_ANALYTICS": set(),
    "HRIS.MODERN.EMPLOYEE_LISTENING": {"IAQ-033", "IAQ-065"},
    "HRIS.MODERN.GOVERNED_AI": {"IAQ-032", "IAQ-066"},
}
MODERN_AUTH_BINDING_IDS = {
    "HRIS.MODERN.PEOPLE_ANALYTICS": {"MOD-AUTH-043", "MOD-AUTH-044", "MOD-AUTH-045"},
    "HRIS.MODERN.EMPLOYEE_LISTENING": {"MOD-AUTH-034", "MOD-AUTH-035", "MOD-AUTH-036"},
    "HRIS.MODERN.GOVERNED_AI": {"MOD-AUTH-046", "MOD-AUTH-047", "MOD-AUTH-048"},
}
MODERN_AUTH_CAPABILITIES = {
    "HRIS.MODERN.PEOPLE_ANALYTICS": {"hcm.analytics.metric.view", "hcm.analytics.metric.manage", "hcm.analytics.export"},
    "HRIS.MODERN.EMPLOYEE_LISTENING": {"hcm.listening.respond", "hcm.listening.manage", "hcm.listening.cohort.view"},
    "HRIS.MODERN.GOVERNED_AI": {"hcm.ai.assist.use", "hcm.ai.policy.manage", "hcm.ai.kill-switch.execute"},
}

TABLE_GROUPS = {
    "AUTH_PRODUCT_ACCESS": {"sys_product_access_package_catalog", "sys_product_access_package_roles", "sys_product_access_package_conflicts", "com_product_access_package_assignments", "com_product_access_package_policy_refs", "com_product_access_package_projection_status", "com_product_access_command_receipts"},
    "PLATFORM_CONFIGURATION": {"sys_hris_config_sets", "sys_hris_config_versions", "sys_hris_config_evaluations"},
    "PLATFORM_AUTOMATION": {"sys_automation_definitions", "sys_automation_versions", "sys_automation_schedules", "sys_automation_runs", "sys_automation_run_attempts", "sys_automation_run_items", "sys_automation_item_attempts", "sys_automation_run_checkpoints"},
    "PLATFORM_CONNECTOR": {"sys_connector_definitions", "sys_connector_mapping_versions", "sys_connector_executions", "sys_connector_execution_items", "sys_connector_execution_attempts"},
    "PLATFORM_EXPERIENCE": {"sys_hris_home_contributions", "sys_hris_explorer_preferences", "sys_hris_explorer_favorites", "sys_hris_explorer_recents"},
    "PLATFORM_CONTROLLED_TRANSFER": {"sys_controlled_file_transfers"},
    "PLATFORM_OPERATIONS": {"sys_operational_exception_projections"},
    "PLATFORM_EXTENSION": {"sys_extension_pack_versions", "sys_tenant_extension_installations"},
    "PLATFORM_SHARED_COMMAND_RECEIPT": {"sys_hris_command_receipts"},
    "LISTENING_CONFIGURATION": {"sys_hris_listening_actions", "sys_hris_listening_domain_outbox", "sys_hris_listening_operation_receipts", "sys_hris_listening_survey_versions", "sys_hris_listening_surveys"},
    "LISTENING_PROTECTED_ADMISSION": {"sys_hris_listening_admission_versions", "sys_hris_listening_answer_values", "sys_hris_listening_cohort_budgets", "sys_hris_listening_cohort_packages", "sys_hris_listening_erasure_tickets", "sys_hris_listening_protected_outbox", "sys_hris_listening_protected_receipts", "sys_hris_listening_responses", "sys_hris_listening_token_consumptions"},
    "LISTENING_INSIGHTS": {"sys_hris_listening_cohort_projections", "sys_hris_listening_export_receipts", "sys_hris_listening_insights_inbox", "sys_hris_listening_insights_outbox", "sys_hris_listening_lineage_receipts"},
    "LISTENING_PARTICIPATION_ISSUER": {"sys_hris_listening_eligibility_versions", "sys_hris_listening_issuer_outbox", "sys_hris_listening_issuer_receipts", "sys_hris_listening_token_issuances", "sys_hris_listening_token_revocations"},
    "MODERN_PEOPLE_ANALYTICS": {"sys_hris_metric_definitions", "sys_hris_metric_versions", "sys_hris_metric_projections", "sys_hris_analytics_export_receipts"},
    "MODERN_GOVERNED_AI": {"sys_hris_ai_use_policies", "sys_hris_ai_policy_versions", "sys_hris_ai_evaluation_receipts", "sys_hris_ai_provenance_receipts", "sys_hris_ai_evaluation_requests"},
}
AUTH_TABLES = TABLE_GROUPS["AUTH_PRODUCT_ACCESS"]
PLATFORM_TABLES = set().union(
    TABLE_GROUPS["PLATFORM_CONFIGURATION"], TABLE_GROUPS["PLATFORM_AUTOMATION"],
    TABLE_GROUPS["PLATFORM_CONNECTOR"], TABLE_GROUPS["PLATFORM_EXPERIENCE"],
    TABLE_GROUPS["PLATFORM_CONTROLLED_TRANSFER"], TABLE_GROUPS["PLATFORM_OPERATIONS"],
    TABLE_GROUPS["PLATFORM_EXTENSION"], TABLE_GROUPS["PLATFORM_SHARED_COMMAND_RECEIPT"],
)
MODERN_TABLES = set().union(
    TABLE_GROUPS["LISTENING_CONFIGURATION"], TABLE_GROUPS["LISTENING_PROTECTED_ADMISSION"],
    TABLE_GROUPS["LISTENING_INSIGHTS"], TABLE_GROUPS["LISTENING_PARTICIPATION_ISSUER"],
    TABLE_GROUPS["MODERN_PEOPLE_ANALYTICS"],
    TABLE_GROUPS["MODERN_GOVERNED_AI"],
)
LEGACY_LISTENING_TABLES = {
    "sys_hris_listening_surveys", "sys_hris_listening_responses",
    "sys_hris_listening_cohort_results", "sys_hris_listening_actions",
}
LEGACY_LISTENING_EVENTS = {
    "EmployeeListeningResponseSubmitted.v2", "EmployeeListeningSurveyCreated.v2",
    "EmployeeListeningSurveyPublished.v2", "EmployeeListeningSurveyClosed.v2",
    "EmployeeListeningActionCreated.v2", "EmployeeListeningActionCompleted.v2",
}
LEGACY_LISTENING_TRANSITIONS = {
    f"MOD-SYS-LISTEN-TR-{number:03d}" for number in range(1, 7)
}
LEGACY_LISTENING_OPERATION_IDS = (
    MODERN_OPERATION_IDS["HRIS.MODERN.EMPLOYEE_LISTENING"]
    - {"modern.listening.surveys.query", "modern.listening.survey.revise"}
)
LISTENING_TABLES = (
    TABLE_GROUPS["LISTENING_CONFIGURATION"]
    | TABLE_GROUPS["LISTENING_PROTECTED_ADMISSION"]
    | TABLE_GROUPS["LISTENING_INSIGHTS"]
    | TABLE_GROUPS["LISTENING_PARTICIPATION_ISSUER"]
)
LEGACY_MODERN_TABLES = (
    LEGACY_LISTENING_TABLES
    | TABLE_GROUPS["MODERN_PEOPLE_ANALYTICS"]
    | TABLE_GROUPS["MODERN_GOVERNED_AI"]
)

PATHS = {
    "manifest": "coding-readiness/sys-exact-business-start-successor.v1.json",
    "lineage": "coding-readiness/sys-exact-business-successor-lineage.v1.json",
    "pin": "coding-readiness/sys-exact-business-start-pin.v1.json",
    "targets": "coding-readiness/target-family-resolution-register.csv",
    "sys_source": "session-registers/hris-sys-source-coverage.csv",
    "hrm_source": "session-registers/hris-hrm-source-coverage.csv",
    "sys_decisions": "session-evidence/sys/g1-decision-log.csv",
    "hrm_decisions": "session-evidence/hrm/g1-decision-log.csv",
    "catalog": "session-evidence/sys/g2-contract-catalog.csv",
    "transport": "session-evidence/sys/g2-transport-schemas.v1.json",
    "states": "session-evidence/sys/g2-state-machines.md",
    "implementation": "session-evidence/sys/g2-implementation-contract.v2.md",
    "current_validator": "session-evidence/sys/validate_sys_readiness.v2.py",
    "implementation_predecessor": "session-evidence/sys/g2-implementation-contract.md",
    "validator_predecessor": "session-evidence/sys/validate_sys_readiness.py",
    "golden": "session-evidence/sys/g2-golden-scenarios.csv",
    "auth_sql": "session-evidence/sys/g2-auth-physical-schema.sql",
    "platform_sql": "session-evidence/sys/g2-platform-physical-schema.sql",
    "modern_body": "session-evidence/sys/g3-modern-capability-contracts.v1.json",
    "g3": "coding-readiness/g3-slice-code-go-register.csv",
    "pep": "coding-readiness/api-pep-binding-register.csv",
    "transport_resolution": "coding-readiness/transport-schema-resolution-register.csv",
    "ia": "coding-readiness/ia-entry-query-api-contract-register.csv",
    "ia_schemas": "coding-readiness/ia-entry-query-projection-schemas.v1.json",
    "primary": "coding-readiness/g3-contract-primary-ownership-register.csv",
    "modern_coding": "coding-readiness/modern-capability-coding-contract-register.csv",
    "modern_auth": "coding-readiness/modern-capability-authorization-register.csv",
    "modern_delivery": "coding-readiness/modern-capability-delivery-register.csv",
    "modern_trace": "coding-readiness/modern-capability-trace-register.csv",
    "modern_exact": "coding-readiness/modern-capability-exact-schema-contracts.v1.json",
    "modern_events": "coding-readiness/modern-capability-event-payload-contracts.v1.json",
    "modern_semantic": "coding-readiness/modern-capability-semantic-bindings.v1.json",
    "modern_identity": "coding-readiness/modern-capability-public-identity-registry.v1.json",
    "listening_summary": LISTENING_SUMMARY_PATH,
    "duties": "hris-atomic-duty-matrix.csv",
    "packages": "hris-permission-group-matrix.csv",
    "sod": "hris-sod-rule-matrix.csv",
    "physical": "coding-readiness/physical-owner-prefix-register.csv",
    "files": "coding-readiness/g3-file-allocation-register.csv",
    "migrations": "g0/migration-allocation-register.csv",
    "ownership": "g0/file-ownership-register.csv",
    "activation": "coding-readiness/activation-gate-register.csv",
    "prompt": "session-prompts/05-cloudhr-sys-session.md",
    "shared": "coding-readiness/shared-contract-catalog.csv",
    "service_pep": "coding-readiness/service-api-auth-binding-register.csv",
    "cross": "coding-readiness/cross-module-contract-register.csv",
    "platform": "coding-readiness/platform-integration-binding-register.csv",
    "canonical4": "coding-readiness/module-exact-business-start-canonical.v1.json",
    "primary_validator": "coding-readiness/validate_sys_exact_business_start.py",
    "independent_validator": "coding-readiness/audit_sys_exact_business_start.cjs",
}
CSV_KEYS = {"targets", "sys_source", "hrm_source", "sys_decisions", "hrm_decisions", "catalog", "golden", "g3", "pep", "transport_resolution", "ia", "primary", "modern_coding", "modern_auth", "modern_delivery", "modern_trace", "duties", "packages", "sod", "physical", "files", "migrations", "ownership", "activation", "shared", "service_pep", "cross", "platform"}
JSON_KEYS = {"manifest", "lineage", "pin", "transport", "modern_body", "ia_schemas", "modern_exact", "modern_events", "modern_semantic", "modern_identity", "listening_summary", "canonical4"}


def split(value: str) -> list[str]:
    return [part for part in str(value or "").split("|") if part and part != "NONE"]


def sha_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def canonical_digest(value: dict[str, Any]) -> str:
    payload = {key: item for key, item in value.items() if key != "sealedPayloadSha256"}
    return hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def load_bundle() -> dict[str, Any]:
    data: dict[str, Any] = {"_raw": {}, "_path": {}}
    for key, relative in PATHS.items():
        path = ROOT / relative
        data["_path"][key] = path
        if not path.exists():
            data[key] = None
            continue
        raw = path.read_bytes()
        data["_raw"][relative] = raw
        if key in CSV_KEYS:
            with path.open(encoding="utf-8-sig", newline="") as handle:
                data[key] = list(csv.DictReader(handle))
        elif key in JSON_KEYS:
            data[key] = json.loads(raw.decode("utf-8"))
        else:
            data[key] = raw.decode("utf-8")
    return data


def json_pointer(document: Any, reference: Any) -> Any:
    if not isinstance(reference, dict) or "$ref" not in reference:
        return reference
    pointer = reference["$ref"]
    if not isinstance(pointer, str) or not pointer.startswith("#/"):
        return None
    value = document
    for raw in pointer[2:].split("/"):
        key = raw.replace("~1", "/").replace("~0", "~")
        if not isinstance(value, dict) or key not in value:
            return None
        value = value[key]
    return value


def closed_objects(value: Any, where: str, errors: list[str]) -> None:
    if isinstance(value, dict):
        if value.get("type") == "object" and value.get("additionalProperties") is not False:
            errors.append(f"SCHEMA_OPEN:{where}")
        for key, child in value.items():
            closed_objects(child, f"{where}/{key}", errors)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            closed_objects(child, f"{where}/{index}", errors)


def require(condition: bool, errors: list[str], code: str) -> None:
    if not condition:
        errors.append(code)


def unique(rows: list[dict[str, str]], key: str, errors: list[str], label: str) -> dict[str, dict[str, str]]:
    result: dict[str, dict[str, str]] = {}
    for row in rows:
        value = row.get(key, "")
        if not value or value in result:
            errors.append(f"DUPLICATE_OR_BLANK:{label}:{value or 'BLANK'}")
        else:
            result[value] = row
    return result


def validate_listening_summary(data: dict[str, Any], errors: list[str]) -> None:
    authority = data.get("listening_summary") or {}
    require(authority.get("contractId") == LISTENING_SUMMARY_ID, errors, "LISTENING_SUMMARY_ID")
    require(authority.get("schemaVersion") == 1, errors, "LISTENING_SUMMARY_VERSION")
    require(
        authority.get("status") == "CANONICAL_G3_START_AUTHORITY_NOT_IMPLEMENTED",
        errors,
        "LISTENING_SUMMARY_STATUS",
    )
    require(
        authority.get("sealedPayloadSha256") == canonical_digest(authority),
        errors,
        "LISTENING_SUMMARY_SEAL",
    )
    listening_operation_ids = MODERN_OPERATION_IDS[
        "HRIS.MODERN.EMPLOYEE_LISTENING"
    ]
    listening_event_names = MODERN_EVENT_NAMES[
        "HRIS.MODERN.EMPLOYEE_LISTENING"
    ]
    listening_tables = set().union(
        TABLE_GROUPS["LISTENING_CONFIGURATION"],
        TABLE_GROUPS["LISTENING_PROTECTED_ADMISSION"],
        TABLE_GROUPS["LISTENING_INSIGHTS"],
        TABLE_GROUPS["LISTENING_PARTICIPATION_ISSUER"],
    )
    expected_counts = {
        "streams": 4,
        "ownerServices": 2,
        "runtimePurposes": 5,
        "publicOperations": len(listening_operation_ids),
        "ownerPortOperations": len(LISTENING_OWNER_PORTS),
        "ownerLocalHandlers": len(LISTENING_OWNER_LOCAL_HANDLER_IDS),
        "plannedTables": len(listening_tables),
        "canonicalPublicEvents": len(listening_event_names),
        "internalPortMessages": 6,
        "privateReceiptTypes": 3,
        "migrationReservations": 4,
        "streamFileAllocationTriples": 4,
        "verificationProfiles": 5,
    }
    require(authority.get("exactCounts") == expected_counts, errors, "LISTENING_SUMMARY_COUNTS")
    streams = authority.get("authorityStreams", [])
    require(
        {row.get("streamKey") for row in streams} == LISTENING_STREAM_KEYS
        and len(streams) == 4,
        errors,
        "LISTENING_STREAM_SET",
    )
    require(
        {row.get("ownerService") for row in streams}
        == {"dwp-platform-server", "dwp-auth-server"},
        errors,
        "LISTENING_SERVICE_SET",
    )
    for field in ("databaseSchema", "historyTable", "migrationLocation", "migrationPrincipal"):
        require(
            len({row.get(field) for row in streams}) == 4,
            errors,
            f"LISTENING_STREAM_DISTINCT:{field}",
        )
    require(
        all(
            row.get("crossSchemaForeignKeysAllowed") is False
            and row.get("foreignLocalIdsAllowed") is False
            and row.get("foreignRepositoryImportsAllowed") is False
            and row.get("applicationDdlAllowed") is False
            and row.get("implementationState") == "NOT_STARTED_G3"
            for row in streams
        ),
        errors,
        "LISTENING_STREAM_BOUNDARY",
    )
    require(
        sum(len(row.get("runtimePrincipals", [])) for row in streams) == 5,
        errors,
        "LISTENING_RUNTIME_PURPOSE_SET",
    )
    tables = authority.get("tableOwnership", [])
    table_to_stream = {
        table_name: stream_key
        for stream_key, group in (
            ("platform-hris-configuration", "LISTENING_CONFIGURATION"),
            ("platform-hris-listening-protected", "LISTENING_PROTECTED_ADMISSION"),
            ("platform-hris-insights", "LISTENING_INSIGHTS"),
            ("auth-hris-participation-issuer", "LISTENING_PARTICIPATION_ISSUER"),
        )
        for table_name in TABLE_GROUPS[group]
    }
    listening_tables = set(table_to_stream)
    require(
        {row.get("tableName") for row in tables} == listening_tables
        and len(tables) == len(listening_tables)
        and all(
            row.get("implementationState") == "NOT_STARTED_G4"
            and row.get("crossSchemaForeignKeys") == []
            and row.get("foreignLocalIdColumns") == []
            and row.get("streamKey") == table_to_stream.get(row.get("tableName"))
            and all(
                table_to_stream.get(foreign_key.get("targetTable"))
                == row.get("streamKey")
                for foreign_key in row.get("localForeignKeys", [])
            )
            for row in tables
        ),
        errors,
        "LISTENING_TABLE_BOUNDARY",
    )
    public_ops = authority.get("publicOperationBindings", [])
    public_ops_by_id = {
        row.get("operationId"): row for row in public_ops
        if isinstance(row, dict)
    }
    require(
        {row.get("operationId") for row in public_ops}
        == MODERN_OPERATION_IDS["HRIS.MODERN.EMPLOYEE_LISTENING"]
        and all(
            row.get("authoritativeStreamKey") in LISTENING_STREAM_KEYS
            and row.get("crossDatabaseTransactionClaimAllowed") is False
            and row.get("foreignLocalIdAllowed") is False
            and row.get("foreignRepositoryReadAllowed") is False
            and row.get("implementationState") == "NOT_STARTED_G3"
            for row in public_ops
        ),
        errors,
        "LISTENING_OPERATION_BOUNDARY",
    )
    admin_query = public_ops_by_id.get("modern.listening.surveys.query", {})
    require(
        admin_query.get("publicPath")
        == "GET /api/platform/v1/admin/hris/listening/surveys"
        and admin_query.get("ownerPortOperation")
        == "configuration.querySurveys"
        and admin_query.get("requestContract")
        == {
            "surveyId": "OPTIONAL_EXACT_PUBLIC_UUID",
            "status": "OPTIONAL_DRAFT_PUBLISHED_CLOSED",
            "period": "OPTIONAL_FROM_TO_TIMESTAMPTZ_HALF_OPEN",
            "cursor": "OPTIONAL_SCOPE_BOUND_OPAQUE_CURSOR",
            "limit": "OPTIONAL_INTEGER_1_200_DEFAULT_50",
        }
        and admin_query.get("responseSchemaId")
        == "EmployeeListeningSurveyAdministrationPage.v1"
        and admin_query.get("recordSchemaId")
        == "EmployeeListeningSurveyAdministrationRecord.v1",
        errors,
        "LISTENING_ADMIN_SURVEY_REENTRY_QUERY",
    )
    revise = public_ops_by_id.get("modern.listening.survey.revise", {})
    require(
        revise.get("publicPath")
        == "PATCH /api/platform/v1/admin/hris/listening/surveys/{surveyId}"
        and revise.get("ownerPortOperation") == "configuration.reviseSurvey"
        and revise.get("transactionBoundary")
        == "CONFIGURATION_DRAFT_CAS_REVISION_TRANSACTION"
        and revise.get("requestSchemaId")
        == "EmployeeListeningSurveyRevisionCommand.v1"
        and revise.get("responseSchemaId")
        == "EmployeeListeningSurveyRevisionResult.v1"
        and revise.get("stateContract")
        == "DRAFT_TO_DRAFT_EXPECTED_AGGREGATE_VERSION_CAS"
        and revise.get("serverVersionRule")
        == "INCREMENT_EXACTLY_ONE_AFTER_STRUCTURED_REVISION",
        errors,
        "LISTENING_SURVEY_REVISE_CAS_CONTRACT",
    )
    owner_ports = authority.get("ownerPortOperations", [])
    require(
        {row.get("ownerPortOperation") for row in owner_ports}
        == LISTENING_OWNER_PORTS
        and len(owner_ports) == len(LISTENING_OWNER_PORTS),
        errors,
        "LISTENING_OWNER_PORT_SET",
    )
    owner_handlers = authority.get("ownerLocalHandlers", [])
    owner_handlers_by_id = {
        row.get("handlerId"): row
        for row in owner_handlers
        if isinstance(row, dict)
    }
    require(
        len(owner_handlers_by_id) == len(owner_handlers)
        and set(owner_handlers_by_id) == LISTENING_OWNER_LOCAL_HANDLER_IDS,
        errors,
        "LISTENING_OWNER_LOCAL_HANDLER_SET",
    )
    erasure_request = owner_handlers_by_id.get(
        LISTENING_OWNER_LOCAL_ERASURE_REQUEST_HANDLER, {}
    )
    require(
        erasure_request.get("handlerKind")
        == "SIGNED_PRIVACY_RETENTION_OWNER_INGRESS"
        and erasure_request.get("ownerPortOperation")
        == "protected.requestErasure"
        and erasure_request.get("streamKey")
        == "platform-hris-listening-protected"
        and erasure_request.get("ticketTable")
        == "sys_hris_listening_erasure_tickets"
        and erasure_request.get("receiptTable")
        == "sys_hris_listening_protected_receipts"
        and erasure_request.get("outboxTable")
        == "sys_hris_listening_protected_outbox"
        and erasure_request.get("initialStatus") == "REQUESTED"
        and "DUE_SCAN" in str(erasure_request.get("trigger"))
        and "SEALED_STATUS_RECEIPT"
        in str(erasure_request.get("statusReentry"))
        and "SAME_KEY_AND_DIGEST"
        in str(erasure_request.get("idempotencyRule"))
        and erasure_request.get("transactionBoundary")
        == "PROTECTED_OWNER_LOCAL_TICKET_RECEIPT_AND_ACK_ATOMIC"
        and erasure_request.get("publicEventEmission")
        == "FORBIDDEN_RAW_OR_IDENTITY_LINKABLE"
        and set(erasure_request.get("requestContract", {}))
        == {
            "tenantPublicId",
            "responsePublicId",
            "retentionPolicyRevision",
            "dueAt",
            "idempotencyKey",
            "requestDigest",
            "signatureKeyId",
        },
        errors,
        "LISTENING_OWNER_LOCAL_ERASURE_REQUEST_HANDLER",
    )
    erasure_process = owner_handlers_by_id.get(
        LISTENING_OWNER_LOCAL_ERASURE_PROCESS_HANDLER, {}
    )
    require(
        erasure_process.get("handlerKind") == "OWNER_LOCAL_ERASURE_PROCESSOR"
        and erasure_process.get("streamKey")
        == "platform-hris-listening-protected"
        and erasure_process.get("ticketProducerHandlerId")
        == LISTENING_OWNER_LOCAL_ERASURE_REQUEST_HANDLER
        and erasure_process.get("stableReplayReceiptRequired") is True
        and erasure_process.get("publicEventEmission")
        == "FORBIDDEN_RAW_OR_IDENTITY_LINKABLE"
        and set(erasure_process.get("responseMutableStatusForbidden", []))
        == {"WITHDRAWN", "ANONYMIZED"},
        errors,
        "LISTENING_OWNER_LOCAL_ERASURE_PROCESS_HANDLER",
    )
    owner_by_table = {
        table_name: stream_key
        for stream_key, group in (
            ("platform-hris-configuration", "LISTENING_CONFIGURATION"),
            ("platform-hris-listening-protected", "LISTENING_PROTECTED_ADMISSION"),
            ("platform-hris-insights", "LISTENING_INSIGHTS"),
            ("auth-hris-participation-issuer", "LISTENING_PARTICIPATION_ISSUER"),
        )
        for table_name in TABLE_GROUPS[group]
    }
    for message_name, (
        handler_id,
        stream_key,
        inbox_table,
        outbox_table,
    ) in LISTENING_INTERNAL_HANDLER_BY_MESSAGE.items():
        handler = owner_handlers_by_id.get(handler_id, {})
        domain_tables = handler.get("domainWriteTables", [])
        require(
            handler.get("handlerKind")
            == "SIGNED_INTERNAL_PORT_MESSAGE_INBOX_CONSUMER"
            and handler.get("messageName") == message_name
            and handler.get("streamKey") == stream_key
            and handler.get("inboxLedgerTable") == inbox_table
            and handler.get("outboxTable") == outbox_table
            and isinstance(domain_tables, list)
            and bool(domain_tables)
            and all(owner_by_table.get(name) == stream_key for name in domain_tables)
            and owner_by_table.get(inbox_table) == stream_key
            and owner_by_table.get(outbox_table) == stream_key
            and handler.get("transactionBoundary")
            == "INBOX_CLAIM_DOMAIN_CAS_CLOSED_ACK_AND_OUTBOX_ATOMIC"
            and "SAME_MESSAGE_ID_AND_DIGEST"
            in str(handler.get("idempotencyRule"))
            and "ROLLS_BACK_INBOX_DOMAIN_ACK_AND_OUTBOX_TO_PRESTATE"
            in str(handler.get("failureRule"))
            and bool(handler.get("closedAcknowledgement")),
            errors,
            f"LISTENING_INTERNAL_MESSAGE_HANDLER:{message_name}",
        )
    event_owner = authority.get("eventOwnership", {})
    require(
        {row.get("eventName") for row in event_owner.get("canonicalPublicEvents", [])}
        == MODERN_EVENT_NAMES["HRIS.MODERN.EMPLOYEE_LISTENING"],
        errors,
        "LISTENING_PUBLIC_EVENT_SET",
    )
    require(
        "EmployeeListeningResponseSubmitted.v2"
        in set(event_owner.get("publicBrokerForbidden", [])),
        errors,
        "LISTENING_RAW_RESPONSE_EVENT_NOT_FORBIDDEN",
    )
    require(
        {row.get("profileId") for row in authority.get("verificationProfileBindings", [])}
        == LISTENING_BACKEND_PROFILES | {LISTENING_FRONTEND_PROFILE},
        errors,
        "LISTENING_PROFILE_SET",
    )
    require(
        len(authority.get("migrationReservations", [])) == 4
        and len(authority.get("fileAllocations", [])) == 4,
        errors,
        "LISTENING_MIGRATION_FILE_ALLOCATION_SET",
    )
    require(
        all(
            row.get("range")
            == {"baselineHighWater": 0, "end": 40, "start": 1}
            and row.get("state") == "RESERVED_G3_RANGE_NOT_CREATED"
            and row.get("firstReservedMigration", "").startswith("V1__")
            and "V287" not in row.get("firstReservedMigration", "")
            for row in authority.get("migrationReservations", [])
        ),
        errors,
        "LISTENING_MIGRATION_RESERVATION",
    )
    precedence = authority.get("canonicalPrecedence", {})
    require(
        precedence.get("mode") == "CANONICAL_FIVE_PRIMARY_DERIVED_SUMMARY_ONLY"
        and precedence.get("legacyArtifactRole")
        == "HISTORICAL_TRACE_ONLY_WHEN_SEPARATELY_FROZEN"
        and precedence.get("legacyDirectImplementation") == "FORBIDDEN"
        and "predecessorPins" not in precedence
        and "historicalPredecessor" not in precedence
        and precedence.get("reverseReferenceFromCanonicalFiveAllowed") is False
        and len(precedence.get("authoritativeInputs", [])) == 5
        and precedence.get("generatedSummary", {}).get("canonicalInputCount") == 5
        and precedence.get("generatedSummary", {}).get("activePrecedence")
        == "CANONICAL_FIVE_ROWS_THEN_DERIVED_SUMMARY",
        errors,
        "LISTENING_CANONICAL_FIVE_TO_DERIVED_SUMMARY",
    )


def validate_manifest(data: dict[str, Any], errors: list[str]) -> None:
    manifest = data.get("manifest") or {}
    validate_listening_summary(data, errors)
    require(manifest.get("contractId") == "dwp.hris.sys-exact-business-start-successor.v1", errors, "MANIFEST_ID")
    require(manifest.get("schemaVersion") == 1, errors, "MANIFEST_VERSION")
    require(manifest.get("status") == "CANONICAL_SYS_EXACT_BUSINESS_START_SUCCESSOR", errors, "MANIFEST_STATUS")
    require(manifest.get("decisionScope") == "HRIS_SYS_G3_EXACT_BUSINESS_DESIGN_ONLY", errors, "MANIFEST_SCOPE")
    require(manifest.get("canonicalDesignPublished") is True, errors, "MANIFEST_DESIGN_NOT_PUBLISHED")
    require(manifest.get("runtimeImplemented") is False, errors, "MANIFEST_RUNTIME_ESCALATION")
    require(manifest.get("productionAuthorized") is False, errors, "MANIFEST_PRODUCTION_ESCALATION")
    require(manifest.get("globalGateAuthorization") == "NONE_VALIDATOR_CONTROLLED", errors, "MANIFEST_GLOBAL_GATE_ESCALATION")
    ids = manifest.get("exactOwnedSliceIds", [])
    rows = manifest.get("sliceBindings", [])
    require(ids == list(EXACT_ASSURANCE_IDS), errors, "SLICE_ID_ORDER_OR_SET")
    require(len(rows) == 17 and len({row.get("assuranceSliceId") for row in rows}) == 17, errors, "SLICE_BINDING_COUNT")
    by_id = {row.get("assuranceSliceId"): row for row in rows}
    require(set(by_id) == set(EXACT_ASSURANCE_IDS), errors, "SLICE_BINDING_SET")
    for assurance_id, expected in EXPECTED_SOURCE.items():
        row = by_id.get(assurance_id, {})
        require(row.get("sourceFamilySha256") == expected["sha"], errors, f"SOURCE_HASH_MANIFEST:{assurance_id}")
        require(row.get("sourceRowCount") == expected["rows"], errors, f"SOURCE_COUNT_MANIFEST:{assurance_id}")
        require(row.get("decisionId") == expected["decision"], errors, f"DECISION_MANIFEST:{assurance_id}")
        require(row.get("disposition") == expected["disposition"], errors, f"DISPOSITION_MANIFEST:{assurance_id}")
        require(row.get("resolutionMode") == expected["mode"], errors, f"RESOLUTION_MODE:{assurance_id}")
        require(row.get("boundedContext") == expected["context"], errors, f"BOUNDED_CONTEXT:{assurance_id}")
        require(row.get("runtimeOwners") == expected["owners"], errors, f"RUNTIME_OWNER:{assurance_id}")
        require(row.get("writeTableGroup") == expected["group"], errors, f"WRITE_GROUP:{assurance_id}")
    for capability_id, expected in MODERN.items():
        row = by_id.get(expected["slice"], {})
        require(row.get("sourceKind") == "MODERN_CAPABILITY" and row.get("sourceRef") == capability_id, errors, f"MODERN_SOURCE:{capability_id}")
        expected_owners = (
            ["dwp-auth-server", "dwp-platform-server"]
            if capability_id == "HRIS.MODERN.EMPLOYEE_LISTENING"
            else ["dwp-platform-server"]
        )
        require(row.get("boundedContext") == expected["context"] and row.get("runtimeOwners") == expected_owners, errors, f"MODERN_RUNTIME:{capability_id}")
        require(row.get("writeTableGroup") == expected["group"], errors, f"MODERN_WRITE_GROUP:{capability_id}")
        expected_counts = (
            {
                "operations": len(MODERN_OPERATION_IDS[capability_id]),
                "ownerPortOperations": len(LISTENING_OWNER_PORTS),
                "ownerLocalHandlers": len(LISTENING_OWNER_LOCAL_HANDLER_IDS),
                "stateMachines": 0,
                "transitions": 0,
                "publicEvents": len(MODERN_EVENT_NAMES[capability_id]),
                "internalMessages": 6,
                "privateReceipts": 3,
                "tables": 24,
                "migrationReservations": 4,
                "verificationProfiles": 5,
                "acceptanceTests": 3,
            }
            if capability_id == "HRIS.MODERN.EMPLOYEE_LISTENING"
            else {"operations": expected["ops"], "stateMachines": 1, "transitions": expected["transitions"], "events": expected["events"], "tables": expected["tables"], "acceptanceTests": expected["tests"]}
        )
        require(row.get("bodyCounts") == expected_counts, errors, f"MODERN_BODY_COUNTS_MANIFEST:{capability_id}")
        require(set(row.get("operationIds", [])) == MODERN_OPERATION_IDS[capability_id] and len(row.get("operationIds", [])) == expected["ops"], errors, f"MODERN_OPERATION_IDS_MANIFEST:{capability_id}")
        require(set(row.get("internalOperationIds", [])) == MODERN_INTERNAL_OPERATION_IDS[capability_id] and len(row.get("internalOperationIds", [])) == expected["internalOps"], errors, f"MODERN_INTERNAL_OPERATION_IDS_MANIFEST:{capability_id}")
        require(set(row.get("stateTransitionIds", [])) == MODERN_TRANSITION_IDS[capability_id] and len(row.get("stateTransitionIds", [])) == expected["transitions"], errors, f"MODERN_TRANSITION_IDS_MANIFEST:{capability_id}")
        require(set(row.get("eventNames", [])) == MODERN_EVENT_NAMES[capability_id] and len(row.get("eventNames", [])) == expected["events"], errors, f"MODERN_EVENT_NAMES_MANIFEST:{capability_id}")
        require(set(row.get("authorizationCapabilities", [])) == MODERN_AUTH_CAPABILITIES[capability_id], errors, f"MODERN_AUTH_MANIFEST:{capability_id}")
        require(set(row.get("entryQueryIds", [])) == MODERN_ENTRY_QUERY_IDS[capability_id], errors, f"MODERN_IA_MANIFEST:{capability_id}")
        if capability_id == "HRIS.MODERN.EMPLOYEE_LISTENING":
            summary_raw = data["_raw"].get(LISTENING_SUMMARY_PATH, b"")
            summary = data.get("listening_summary") or {}
            require(
                row.get("canonicalAuthorityMode")
                == "PRIMARY_CANONICAL_FIVE_ROWS",
                errors,
                "LISTENING_MANIFEST_CANONICAL_AUTHORITY_MODE",
            )
            require(row.get("derivedSummaryRef") == LISTENING_SUMMARY_ID, errors, "LISTENING_MANIFEST_SUMMARY_ID")
            require(row.get("derivedSummaryPath") == LISTENING_SUMMARY_PATH, errors, "LISTENING_MANIFEST_SUMMARY_PATH")
            require(row.get("derivedSummaryFileSha256") == sha_bytes(summary_raw), errors, "LISTENING_MANIFEST_SUMMARY_HASH")
            require(
                row.get("derivedSummaryCanonicalInputSetSha256")
                == summary.get("canonicalPrecedence", {}).get(
                    "generatedSummary", {}
                ).get("canonicalInputSetSha256"),
                errors,
                "LISTENING_MANIFEST_CANONICAL_INPUT_SET",
            )
            require(
                not {
                    "successorAuthorityRef",
                    "successorAuthorityPath",
                    "successorAuthorityFileSha256",
                }
                & set(row),
                errors,
                "LISTENING_MANIFEST_REVERSE_AUTHORITY_FIELDS",
            )
            require(set(row.get("streamKeys", [])) == LISTENING_STREAM_KEYS, errors, "LISTENING_MANIFEST_STREAMS")
            require(set(row.get("verificationProfileIds", [])) == LISTENING_BACKEND_PROFILES | {LISTENING_FRONTEND_PROFILE}, errors, "LISTENING_MANIFEST_PROFILES")
            require(row.get("implementationState") == "NOT_STARTED_G3_G4" and row.get("productionState") == "NOT_AUTHORIZED_G6" and row.get("realIdentityProcessIsolationState") == "G6_ONLY_NOT_CLAIMED", errors, "LISTENING_MANIFEST_GATE_BOUNDARY")
    actual_groups = {key: set(value) for key, value in manifest.get("physicalWriteTableGroups", {}).items()}
    require(actual_groups == TABLE_GROUPS, errors, "TABLE_GROUP_SET")
    closure = manifest.get("operationClosure", {})
    require(closure.get("baseContractCount") == 84 and closure.get("baseRuntimeOperationCount") == 77, errors, "BASE_OPERATION_CLOSURE")
    require(
        closure.get("modernOperationCount") == EXPECTED_MODERN_OPERATION_COUNT
        and closure.get("modernEventCount") == EXPECTED_MODERN_EVENT_COUNT
        and closure.get("modernTableCount") == EXPECTED_MODERN_TABLE_COUNT,
        errors,
        "MODERN_OPERATION_CLOSURE",
    )
    require(
        manifest.get("authoritativeSources", {}).get("sysListeningDerivedSummary")
        == LISTENING_SUMMARY_PATH,
        errors,
        "LISTENING_DERIVED_SUMMARY_SOURCE",
    )
    require(
        "sysListeningStreamAuthority"
        not in manifest.get("authoritativeSources", {}),
        errors,
        "LISTENING_PRIMARY_SUMMARY_SOURCE_FORBIDDEN",
    )
    auth_closure = manifest.get("authorizationClosure", {})
    require(set(auth_closure.get("entryQueryIds", [])) == IA_IDS and auth_closure.get("entryQueryCount") == 13, errors, "MANIFEST_IA_EXACT_SET")
    require(set(auth_closure.get("modernAuthorizationBindingIds", [])) == set().union(*MODERN_AUTH_BINDING_IDS.values()) and auth_closure.get("modernAuthorizationBindingCount") == 9, errors, "MANIFEST_MODERN_AUTH_EXACT_SET")
    pointer = manifest.get("currentPointer", {})
    require(pointer.get("artifactId") == "SYS_EXACT_BUSINESS_EQUIVALENCE", errors, "CURRENT_POINTER_ID")
    require(pointer.get("currentPath") == PATHS["manifest"] and pointer.get("pointerState") == "CURRENT_EXACT_SUCCESSOR", errors, "CURRENT_POINTER_REGRESSION")
    forbidden = set(pointer.get("predecessorPathForbiddenAsCurrent", []))
    require({PATHS["canonical4"], "session-evidence/sys/g2-implementation-contract.md", "session-evidence/sys/validate_sys_readiness.py"} <= forbidden, errors, "PREDECESSOR_FORBIDDEN_SET")
    boundary = manifest.get("boundaryPolicy", {})
    require(set(boundary.get("genericCore", [])) == {"PRODUCT_CORE", "TENANT_CONFIG", "PROVIDER_NEUTRAL_PORT", "SYNTHETIC_FIXTURE", "SIGNED_EXTENSION_VERIFIER"}, errors, "BOUNDARY_GENERIC_CORE")
    require(set(boundary.get("g6Only", [])) == {"REAL_PROVIDER_ADAPTER", "REAL_COUNTRY_OR_STATUTORY_CONTENT", "CUSTOMER_MAPPING", "PRODUCTION_SECRET", "NAMED_TENANT_ACTIVATION"}, errors, "BOUNDARY_G6_ONLY")
    require(set(boundary.get("activationGateIds", [])) == ACTIVATION_IDS, errors, "BOUNDARY_ACTIVATION_IDS")
    require(
        {
            "CROSS_SCHEMA_DATABASE_FK", "FOREIGN_STREAM_LOCAL_ID",
            "FOREIGN_STREAM_REPOSITORY_IMPORT", "RAW_LISTENING_RESPONSE_PUBLIC_EVENT",
            "PARTICIPATION_TOKEN_PUBLIC_EVENT", "SINGLE_V287_LISTENING_MIGRATION",
        }
        <= set(boundary.get("forbiddenCorePatterns", [])),
        errors,
        "LISTENING_BOUNDARY_FORBIDDEN_SET",
    )
    require(set(boundary.get("signedExtensionRequiredStates", [])) == {"DISCOVERED", "VERIFIED", "APPROVED", "INSTALLED_DISABLED", "ENABLED", "SUSPENDED", "REVOKED"}, errors, "SIGNED_EXTENSION_STATES")
    gate = manifest.get("gateBoundary", {})
    require(gate.get("g4") == "NOT_STARTED" and gate.get("g6") == "NOT_AUTHORIZED", errors, "BOUNDARY_GATE_ESCALATION")


def validate_sources(data: dict[str, Any], errors: list[str]) -> None:
    target_by_id = unique(data.get("targets") or [], "resolution_id", errors, "TARGET")
    sys_source = data.get("sys_source") or []
    hrm_source = data.get("hrm_source") or []
    decisions = {
        **{row.get("decision_id"): row for row in data.get("sys_decisions") or []},
        **{row.get("decision_id"): row for row in data.get("hrm_decisions") or []},
    }
    manifest_rows = {row.get("assuranceSliceId"): row for row in (data.get("manifest") or {}).get("sliceBindings", [])}
    for assurance_id, expected in EXPECTED_SOURCE.items():
        target_id = "TFR-HRM-015" if assurance_id == "BASE-TFR-HRM-015" else assurance_id
        target = target_by_id.get(target_id, {})
        require(target.get("source_family_sha256") == expected["sha"], errors, f"SOURCE_HASH_TARGET:{assurance_id}")
        require(target.get("source_row_count") == str(expected["rows"]), errors, f"SOURCE_COUNT_TARGET:{assurance_id}")
        require(target.get("resolution_state") == ("RETIRED_DECIDED" if assurance_id == "TFR-SYS-013" else "RESOLVED_G2_CONTRACT"), errors, f"SOURCE_RESOLUTION_STATE:{assurance_id}")
        expected_register = "../session-registers/hris-hrm-source-coverage.csv" if assurance_id == "BASE-TFR-HRM-015" else "../session-registers/hris-sys-source-coverage.csv"
        require(target.get("source_register") == expected_register, errors, f"SOURCE_REGISTER:{assurance_id}")
        source = hrm_source if assurance_id == "BASE-TFR-HRM-015" else sys_source
        family = [row for row in source if sha_bytes(row.get("target_api_or_event", "").encode()) == expected["sha"]]
        require(len(family) == expected["rows"], errors, f"SOURCE_FAMILY_RECOMPUTE:{assurance_id}")
        for row in family:
            require(row.get("decision_status") == "DECIDED", errors, f"SOURCE_UNDECIDED:{assurance_id}")
            require(row.get("disposition") == expected["disposition"], errors, f"SOURCE_DISPOSITION:{assurance_id}")
            require(row.get("target_bounded_context_candidate") == expected["context"], errors, f"SOURCE_CONTEXT:{assurance_id}")
        observed_owners = set().union(*(set(split(row.get("target_data_owner", ""))) for row in family)) if family else set()
        require(all(any(owner == observed or observed.startswith(owner + "/") for observed in observed_owners) for owner in expected["owners"]), errors, f"SOURCE_RUNTIME_OWNER:{assurance_id}")
        decision = decisions.get(expected["decision"], {})
        require(decision.get("status") == "DECIDED" and bool(decision.get("resolution")), errors, f"DECISION_UNRESOLVED:{assurance_id}")
        if assurance_id.startswith("TFR-SYS"):
            require(decision.get("proposed_decision") == expected["disposition"], errors, f"DECISION_DISPOSITION:{assurance_id}")
        else:
            require("Signed tenant extension" in decision.get("proposed_decision", ""), errors, "SIGNED_EXTENSION_DECISION")
        require(manifest_rows.get(assurance_id, {}).get("sourceFamilySha256") == target.get("source_family_sha256"), errors, f"SOURCE_THREE_WAY_HASH:{assurance_id}")
        require(str(manifest_rows.get(assurance_id, {}).get("sourceRowCount")) == target.get("source_row_count"), errors, f"SOURCE_THREE_WAY_COUNT:{assurance_id}")

    selected = [target_by_id[f"TFR-SYS-{i:03d}"] for i in range(1, 14)] + [target_by_id.get("TFR-HRM-015", {})]
    union = set().union(*(set(split(row.get("resolution_refs", ""))) for row in selected))
    expected_union = (
        {f"SYS-API-{i:03d}" for i in range(1, 76)}
        | {f"SYS-EVT-{i:03d}" for i in range(1, 10)}
        | {f"SHARED-API-{i:03d}" for i in range(1, 13)}
        | {"PLAT-003", "PLAT-004", "PLAT-005", "SVC-PEP-HRM-006", "SVC-PEP-PAY-001", "SVC-PEP-PER-002", "SVC-PEP-TIM-002", "XCON-012", "XCON-013", "XCON-014", "XCON-015", "DECISION:DEC-SYS-013"}
    )
    require(union == expected_union and len(union) == 108, errors, "TARGET_RESOLUTION_EXACT_UNION")
    for row in selected:
        all_refs = set(split(row.get("resolution_refs", "")))
        primary = set(split(row.get("primary_resolution_refs", "")))
        related = set(split(row.get("related_resolution_refs", "")))
        require(primary.isdisjoint(related) and primary | related == all_refs, errors, f"PRIMARY_RELATED_PARTITION:{row.get('resolution_id')}")


def validate_g3(data: dict[str, Any], errors: list[str]) -> None:
    rows = [row for row in data.get("g3") or [] if row.get("session_id") == "HRIS-SYS"]
    by_id = unique(rows, "slice_id", errors, "G3_SYS")
    require(set(by_id) == set(EXACT_G3_IDS) and len(rows) == 17, errors, "G3_EXACT_SLICE_SET")
    manifest_rows = {row.get("g3SliceId"): row for row in (data.get("manifest") or {}).get("sliceBindings", [])}
    target_by_id = {row.get("resolution_id"): row for row in data.get("targets") or []}
    primary_registry = {row.get("contract_id"): row for row in data.get("primary") or []}
    file_ids = {row.get("allocation_id") for row in data.get("files") or [] if row.get("session_id") == "HRIS-SYS"}
    listening_file_ids = {
        item[key]
        for item in (data.get("listening_summary") or {}).get("fileAllocations", [])
        for key in ("sourceAllocationId", "testAllocationId", "migrationAllocationId")
    }
    expected_files = {"G3-SYS-BE-SOURCE", "G3-SYS-BE-TEST", "G3-SYS-BE-MIGRATION", "G3-SYS-AUTH-BE-SOURCE", "G3-SYS-AUTH-BE-TEST", "G3-SYS-AUTH-BE-MIGRATION", "G3-SYS-FE-SOURCE"} | listening_file_ids
    require(file_ids == expected_files, errors, "FILE_ALLOCATION_EXACT_SET")
    for slice_id in EXACT_G3_IDS:
        row = by_id.get(slice_id, {})
        manifest_row = manifest_rows.get(slice_id, {})
        if slice_id == "MOD-SYS-LISTEN":
            require(set(split(row.get("bounded_context_refs", ""))) == LISTENING_STREAM_KEYS, errors, f"G3_CONTEXT:{slice_id}")
        else:
            require(row.get("bounded_context_refs") == manifest_row.get("boundedContext"), errors, f"G3_CONTEXT:{slice_id}")
        require(row.get("source_family_sha256") == str(manifest_row.get("sourceFamilySha256")), errors, f"G3_SOURCE_HASH:{slice_id}")
        require(row.get("source_row_count") == str(manifest_row.get("sourceRowCount")), errors, f"G3_SOURCE_COUNT:{slice_id}")
        require(row.get("production_state") == "NOT_AUTHORIZED_G6", errors, f"G3_PRODUCTION_STATE:{slice_id}")
        if slice_id == "BASE-TFR-SYS-013":
            require(row.get("gate_status") == "RETIRED_NO_CODE" and row.get("implementation_state") == "NOT_APPLICABLE_RETIRED", errors, "RETIRED_BECAME_ACTIVE")
            require(row.get("code_go_token") == "NO_CODE_GO_RETIRED" and not row.get("g3_verification_command_display_non_authoritative") and not row.get("backend_verification_profile_id") and not row.get("frontend_verification_profile_id") and not row.get("frontend_test_path"), errors, "RETIRED_CODE_GO")
            require(not row.get("file_allocation_ids") and not row.get("migration_allocation_ids"), errors, "RETIRED_ALLOCATION")
            continue
        require(row.get("gate_status") == "OPEN_G3_CODE" and row.get("implementation_state") == "NOT_STARTED_G3", errors, f"G3_STATE:{slice_id}")
        require(row.get("code_go_token") == f"G3-CODE-GO-{slice_id}", errors, f"G3_TOKEN:{slice_id}")
        require(set(split(row.get("required_g4_assertions", ""))) == G4_ASSERTIONS, errors, f"G4_ASSERTIONS:{slice_id}")
        for field in ("schema_state_contract_refs", "acceptance_evidence_refs", "test_evidence_refs", "g4_runbook_ref", "g4_telemetry_evidence_ref", "g4_migration_evidence_ref", "g4_recovery_evidence_ref", "g4_acceptance_evidence_ref", "g3_verification_command_display_non_authoritative", "backend_verification_profile_id", "frontend_verification_profile_id", "frontend_test_path"):
            require(bool(row.get(field)), errors, f"G3_EVIDENCE:{slice_id}:{field}")
        row_files = set(split(row.get("file_allocation_ids", "")))
        require(row_files <= expected_files and bool(row_files), errors, f"G3_FILE_ALLOCATION:{slice_id}")
        if slice_id == "MOD-SYS-LISTEN":
            require(row_files == set(manifest_row.get("fileAllocationIds", [])), errors, "LISTENING_G3_FILE_ALLOCATION_SET")
            require(set(split(row.get("migration_allocation_ids", ""))) == set(manifest_row.get("migrationAllocationIds", [])), errors, "LISTENING_G3_MIGRATION_ALLOCATION_SET")
            require(set(split(row.get("backend_verification_profile_id", ""))) == LISTENING_BACKEND_PROFILES and row.get("frontend_verification_profile_id") == LISTENING_FRONTEND_PROFILE, errors, "LISTENING_G3_PROFILE_SET")
            require(LISTENING_SUMMARY_ID in split(row.get("schema_state_contract_refs", "")), errors, "LISTENING_G3_DERIVED_SUMMARY_REF")
            require("EmployeeListeningResponseSubmitted.v2" not in split(row.get("api_event_contract_refs", "")), errors, "LISTENING_G3_RAW_RESPONSE_EVENT")
            require(not any("V287__" in path for path in split(row.get("planned_migration_file", ""))), errors, "LISTENING_G3_SINGLE_V287")
        else:
            expected_migration = "MIG-SYS-AUTH-217-245" if manifest_row.get("writeTableGroup") == "AUTH_PRODUCT_ACCESS" else "MIG-SYS-PLATFORM-262-290"
            require(row.get("migration_allocation_ids") == expected_migration, errors, f"G3_MIGRATION_ALLOCATION:{slice_id}")
        primary = set(split(row.get("primary_contract_refs", "")))
        related = set(split(row.get("related_contract_refs", "")))
        require(primary.isdisjoint(related), errors, f"G3_PRIMARY_RELATED_OVERLAP:{slice_id}")
        if row.get("source_ref", "").startswith("TFR-"):
            target = target_by_id.get(row.get("source_ref"), {})
            require(set(split(target.get("primary_resolution_refs", ""))) <= primary, errors, f"PRIMARY_DOWNGRADE:{slice_id}")
            require(set(split(target.get("related_resolution_refs", ""))) <= set(split(row.get("api_event_contract_refs", ""))), errors, f"RELATED_RESOLUTION_LOST:{slice_id}")
        for ref in primary:
            if ref.startswith("IAQ-"):
                continue
            owner = primary_registry.get(ref)
            require(owner is not None and owner.get("primary_slice_id") == slice_id and owner.get("status") == "SEALED_G3_PRIMARY_OWNER", errors, f"PRIMARY_OWNER:{slice_id}:{ref}")


def validate_base_contracts(data: dict[str, Any], errors: list[str]) -> None:
    catalog_rows = data.get("catalog") or []
    catalog = unique(catalog_rows, "contract_id", errors, "SYS_CONTRACT")
    expected_catalog = {f"SYS-API-{i:03d}" for i in range(1, 76)} | {f"SYS-EVT-{i:03d}" for i in range(1, 10)}
    require(set(catalog) == expected_catalog and len(catalog_rows) == 84, errors, "SYS_CATALOG_EXACT_SET")
    require(all(row.get("status") == "READY" and row.get("state_or_payload") for row in catalog_rows), errors, "SYS_CATALOG_INCOMPLETE")
    transport = data.get("transport") or {}
    operations = transport.get("operations", {})
    expected_operations = {f"SYS-API-{i:03d}" for i in range(1, 76)} - {"SYS-API-017", "SYS-API-021"}
    expected_operations |= {"SYS-API-017.GET", "SYS-API-017.POST", "SYS-API-021.GET", "SYS-API-021.POST"}
    require(set(operations) == expected_operations and len(operations) == 77, errors, "TRANSPORT_OPERATION_EXACT_SET")
    require(len(transport.get("$defs", {})) == 127, errors, "TRANSPORT_DEFINITION_COUNT")
    closed_objects(transport, "base-transport", errors)
    pep = {row.get("binding_id"): row for row in data.get("pep") or [] if row.get("module") == "SYS"}
    tsr = {row.get("binding_id"): row for row in data.get("transport_resolution") or [] if row.get("module") == "SYS"}
    require(set(pep) == {f"PEP-SYS-{i:03d}" for i in range(1, 78)}, errors, "PEP_EXACT_SET")
    require(set(tsr) == set(pep), errors, "TRANSPORT_RESOLUTION_EXACT_SET")
    operation_to_pep: dict[tuple[str, str], dict[str, str]] = {}
    for row in pep.values():
        key = (row.get("source_operation_id", ""), row.get("method", ""))
        require(key not in operation_to_pep, errors, f"PEP_OPERATION_DUPLICATE:{key}")
        operation_to_pep[key] = row
    header_counts: Counter[str] = Counter()
    for operation_key, operation in operations.items():
        source_id = operation.get("sourceOperationId") or operation_key.split(".", 1)[0]
        contract = catalog.get(source_id, {})
        method = operation.get("method")
        require(method in split(contract.get("operation_or_version", "")), errors, f"METHOD_DRIFT:{operation_key}")
        require(operation.get("path") == contract.get("path_or_event"), errors, f"PATH_DRIFT:{operation_key}")
        require(operation.get("authorization") == contract.get("authorization"), errors, f"AUTH_ALIAS_DRIFT:{operation_key}")
        response_ref = operation.get("responseSchema")
        response_resolved = json_pointer(transport, response_ref)
        if source_id in {"SYS-API-031", "SYS-API-032"}:
            require(isinstance(response_ref, dict) and str(response_ref.get("$ref", "")).startswith("DWP_BACKEND@5670877de7a39e94e75021c7e23cbbb553296c90:"), errors, f"RESPONSE_SCHEMA_MISSING:{operation_key}")
        else:
            require(response_resolved is not None, errors, f"RESPONSE_SCHEMA_MISSING:{operation_key}")
        require(json_pointer(transport, operation.get("errorSchema")) is not None, errors, f"ERROR_SCHEMA_MISSING:{operation_key}")
        if method == "GET":
            require(operation.get("mode") in {"query", "baseline-reuse-query"}, errors, f"QUERY_MODE:{operation_key}")
            require(operation.get("requestBodySchema") is None, errors, f"QUERY_BODY:{operation_key}")
        else:
            require(operation.get("mode") in {"command", "baseline-reuse-command-exception"}, errors, f"COMMAND_MODE:{operation_key}")
            if source_id == "SYS-API-032":
                request_ref = operation.get("requestBodySchema")
                require(isinstance(request_ref, dict) and str(request_ref.get("$ref", "")).startswith("DWP_BACKEND@5670877de7a39e94e75021c7e23cbbb553296c90:"), errors, f"REQUEST_SCHEMA_MISSING:{operation_key}")
            else:
                require(json_pointer(transport, operation.get("requestBodySchema")) is not None, errors, f"REQUEST_SCHEMA_MISSING:{operation_key}")
        header_ref = (operation.get("headerSchema") or {}).get("$ref", "NONE")
        header_counts[header_ref] += 1
        if source_id not in {"SYS-API-031", "SYS-API-032"}:
            require(json_pointer(transport, operation.get("headerSchema")) is not None, errors, f"HEADER_SCHEMA_MISSING:{operation_key}")
            if method != "GET":
                required_headers = set(json_pointer(transport, operation.get("headerSchema")).get("required", []))
                require("Idempotency-Key" in required_headers, errors, f"IDEMPOTENCY_HEADER:{operation_key}")
                if header_ref.endswith("CasCommandHeaders"):
                    require("If-Match" in required_headers, errors, f"CAS_HEADER:{operation_key}")
        pep_row = operation_to_pep.get((source_id, method), {})
        require(bool(pep_row), errors, f"PEP_OPERATION_MISSING:{operation_key}")
        require(pep_row.get("contract_path") == operation.get("path") and pep_row.get("source_authorization_alias") == operation.get("authorization"), errors, f"PEP_OPERATION_DRIFT:{operation_key}")
        tsr_row = tsr.get(pep_row.get("binding_id"), {})
        require(tsr_row.get("runtime_operation_id") == source_id and tsr_row.get("method") == method and tsr_row.get("path") == operation.get("path"), errors, f"TSR_OPERATION_DRIFT:{operation_key}")
        require(tsr_row.get("response_schema_ref") and tsr_row.get("error_schema_ref") and tsr_row.get("status") == "RESOLVED_EXACT", errors, f"TSR_SCHEMA_DRIFT:{operation_key}")
    require(header_counts == Counter({"#/$defs/CasCommandHeaders": 44, "#/$defs/QueryHeaders": 16, "#/$defs/CommandHeaders": 15, "NONE": 2}), errors, "IDEMPOTENCY_CAS_EXACT_COUNTS")
    exception = transport.get("acceptedExceptions", {}).get("SYS-API-032", {})
    require(exception.get("status") == "ACCEPTED_BASELINE_REUSE_EXCEPTION" and exception.get("exceptionType") == "BASELINE_BODY_VERSION_CAS" and exception.get("newTable") is False and exception.get("newDuty") is False, errors, "BASELINE_CAS_EXCEPTION")
    event_rows = [row for row in catalog_rows if row.get("kind") == "EVENT"]
    require(len(event_rows) == 9 and all(row.get("execution") == "OUTBOX_INBOX" and row.get("idempotency") == "EVENT_ID" for row in event_rows), errors, "BASE_EVENT_CONTRACT")
    states = data.get("states") or ""
    implementation = data.get("implementation") or ""
    for marker in ("DISCOVERED", "VERIFIED", "APPROVED", "INSTALLED_DISABLED", "ENABLED", "SUSPENDED", "REVOKED", "RESULT_UNKNOWN", "FAILED_ITEMS_ONLY", "OPEN → ACKNOWLEDGED → RECOVERING → RESOLVED"):
        require(marker in states, errors, f"STATE_MACHINE_MARKER:{marker}")
    for marker in ("SYS-API-012..016", "SYS-API-041..045", "SYS-API-046..056", "SYS-API-057..068", "SYS-API-028..030", "SYS-API-069..075", "SYS-API-032"):
        require(marker in implementation, errors, f"IMPLEMENTATION_LIFECYCLE_MARKER:{marker}")


def validate_authorization(data: dict[str, Any], errors: list[str]) -> None:
    duties = unique(data.get("duties") or [], "duty_code", errors, "DUTY")
    sod = unique(data.get("sod") or [], "rule_code", errors, "SOD")
    pep_rows = [row for row in data.get("pep") or [] if row.get("module") == "SYS"]
    for row in pep_rows:
        binding_id = row.get("binding_id", "")
        require(row.get("canonical_app_entitlement") == "APP.HCM:VIEW", errors, f"PEP_ENTITLEMENT:{binding_id}")
        require(tuple(split(row.get("pep_layers", ""))) == PEP_LAYERS, errors, f"PEP_LAYERS:{binding_id}")
        for field in ("canonical_capability_keys", "canonical_resource_types", "canonical_resource_keys", "canonical_actions", "canonical_population_types", "canonical_field_group_keys", "purpose_codes"):
            require(bool(split(row.get(field, ""))), errors, f"PEP_FIELD_EMPTY:{binding_id}:{field}")
        referenced: list[dict[str, str]] = []
        for pair in split(row.get("authorization_profiles", "")):
            parts = pair.split(">")
            require(len(parts) == 2 and all(parts), errors, f"PEP_PROFILE_DUTY_PAIR:{binding_id}")
            duty = duties.get(parts[-1])
            require(duty is not None, errors, f"PEP_DUTY_MISSING:{binding_id}:{parts[-1]}")
            if duty:
                require(parts[0] in split(duty.get("package_codes", "")), errors, f"PEP_PACKAGE_DUTY:{binding_id}:{parts[-1]}")
                referenced.append(duty)
        field_pairs = (
            ("canonical_capability_keys", "capability_key"), ("canonical_resource_types", "resource_type"),
            ("canonical_resource_keys", "resource_key"), ("canonical_actions", "permission_code"),
            ("canonical_population_types", "population_types"), ("canonical_field_group_keys", "field_group_keys"),
        )
        for pep_field, duty_field in field_pairs:
            duty_union = set().union(*(set(split(item.get(duty_field, ""))) for item in referenced)) if referenced else set()
            require(set(split(row.get(pep_field, ""))) == duty_union, errors, f"PEP_DUTY_MISMATCH:{binding_id}:{pep_field}")
        for duty in referenced:
            for rule_id in split(duty.get("dynamic_sod_rule_codes", "")):
                rule = sod.get(rule_id)
                require(rule is not None and rule.get("enforcement_mode") == "BLOCK", errors, f"SOD_MISSING:{binding_id}:{rule_id}")
                if rule:
                    require(duty.get("duty_code") in split(rule.get("left_subject_code", "")), errors, f"SOD_DUTY_MISMATCH:{binding_id}:{rule_id}")

    ia_rows = [row for row in data.get("ia") or [] if row.get("owner_session") == "HRIS-SYS"]
    ia = unique(ia_rows, "query_id", errors, "IA_SYS")
    require(set(ia) == IA_IDS and len(ia_rows) == 13, errors, "IA_EXACT_SET")
    ia_schemas = data.get("ia_schemas") or {}
    g3 = {row.get("slice_id"): row for row in data.get("g3") or []}
    for query_id, row in ia.items():
        require(row.get("primary_slice_id") in EXACT_G3_IDS, errors, f"IA_SLICE:{query_id}")
        require(query_id in split(g3.get(row.get("primary_slice_id"), {}).get("primary_contract_refs", "")), errors, f"IA_PRIMARY_BINDING:{query_id}")
        require(row.get("method") == "GET" and row.get("browser_path", "").startswith("/api/"), errors, f"IA_METHOD_PATH:{query_id}")
        require(tuple(split(row.get("pep_layers", ""))) == PEP_LAYERS, errors, f"IA_PEP_LAYERS:{query_id}")
        require(row.get("authorization_capability") and row.get("authorization_profiles"), errors, f"IA_AUTHORIZATION:{query_id}")
        require(row.get("implementation_state") == "REQUIRED_G3_ENTRY_QUERY_NOT_IMPLEMENTED" and row.get("production_state") == "NOT_AUTHORIZED_G6", errors, f"IA_STATE:{query_id}")
        for field in ("request_schema_ref", "response_schema_ref", "problem_schema_ref"):
            reference = row.get(field, "")
            pointer = reference.split("#", 1)[1] if "#" in reference else ""
            require(json_pointer(ia_schemas, {"$ref": "#" + pointer}) is not None, errors, f"IA_SCHEMA:{query_id}:{field}")


def sql_tables(text: str) -> set[str]:
    return set(re.findall(r"(?im)^\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\s*\(", text))


def validate_physical(data: dict[str, Any], errors: list[str]) -> None:
    auth_sql = data.get("auth_sql") or ""
    platform_sql = data.get("platform_sql") or ""
    require(sql_tables(auth_sql) == AUTH_TABLES and len(AUTH_TABLES) == 7, errors, "AUTH_TABLE_EXACT_SET")
    require(sql_tables(platform_sql) == PLATFORM_TABLES and len(PLATFORM_TABLES) == 25, errors, "PLATFORM_TABLE_EXACT_SET")
    for label, text in (("AUTH", auth_sql), ("PLATFORM", platform_sql)):
        require("ENABLE ROW LEVEL SECURITY" in text and "FORCE ROW LEVEL SECURITY" in text and "CREATE POLICY" in text, errors, f"RLS_POLICY:{label}")
        require(not re.search(r"REFERENCES\s+(?:auth|platform|people|payroll)\.", text, re.I), errors, f"CROSS_SERVICE_FK:{label}")
    migrations = {row.get("allocation_id"): row for row in data.get("migrations") or [] if row.get("allocation_id")}
    auth_migration = migrations.get("MIG-SYS-AUTH-217-245", {})
    platform_migration = migrations.get("MIG-SYS-PLATFORM-262-290", {})
    require(auth_migration.get("service") == "dwp-auth-server" and auth_migration.get("allocated_version") == "217-245" and auth_migration.get("state") == "RESERVED_G3_RANGE", errors, "AUTH_MIGRATION_AUTHORITY")
    require(platform_migration.get("service") == "dwp-platform-server" and platform_migration.get("baseline_high_water") == "261" and platform_migration.get("allocated_version") == "262-290" and platform_migration.get("state") == "RESERVED_G3_RANGE", errors, "PLATFORM_MIGRATION_AUTHORITY")
    ownership = {row.get("ownership_id"): row for row in data.get("ownership") or []}
    require(ownership.get("OWN-SYS-BE-MIG-AUTH", {}).get("path_glob") == "dwp-auth-server/src/main/resources/db/migration/V{217..245}__hris_auth_<slice>.sql", errors, "AUTH_FILE_OWNERSHIP")
    require(ownership.get("OWN-SYS-BE-MIG-PLATFORM", {}).get("path_glob") == "dwp-platform-server/src/main/resources/db/migration/V{262..290}__hris_platform_<slice>.sql", errors, "PLATFORM_FILE_OWNERSHIP")
    authority = data.get("listening_summary") or {}
    migration_by_id = {row.get("allocationId"): row for row in authority.get("migrationReservations", [])}
    for allocation_id, reservation in migration_by_id.items():
        migration = migrations.get(allocation_id, {})
        owner = ownership.get(reservation.get("ownershipId"), {})
        require(
            migration.get("migration_dir") == reservation.get("migrationLocation")
            and migration.get("allocated_version") == "1-40"
            and migration.get("state") == "RESERVED_G3_RANGE"
            and owner.get("path_glob")
            == reservation.get("migrationLocation", "").rstrip("/")
            + "/V{1..40}__hris_listening_<slice>.sql",
            errors,
            f"LISTENING_MIGRATION_AUTHORITY:{allocation_id}",
        )
    physical = [row for row in data.get("physical") or [] if row.get("session") == "HRIS-SYS"]
    physical_by_id = {row.get("binding_id"): row for row in physical}
    require(len(physical) == 9 and len(physical_by_id) == 9 and all(row.get("status") == "READY_FOR_G3_CODE" for row in physical), errors, "PHYSICAL_OWNER_PREFIX")
    require(set(split(physical_by_id.get("PFX-SYS-AUTH-CATALOG", {}).get("allowed_prefixes", ""))) == {"sys_product_access_"} and set(split(physical_by_id.get("PFX-SYS-AUTH-TENANT", {}).get("allowed_prefixes", ""))) == {"com_product_access_"}, errors, "AUTH_PREFIX_SET")
    require(set(split(physical_by_id.get("PFX-SYS-PLATFORM", {}).get("allowed_prefixes", ""))) == {"sys_"}, errors, "PLATFORM_PREFIX_SET")
    listening_bindings = {
        "PFX-SYS-LISTEN-CONFIGURATION": ("platform-hris-configuration", TABLE_GROUPS["LISTENING_CONFIGURATION"]),
        "PFX-SYS-LISTEN-PROTECTED": ("platform-hris-listening-protected", TABLE_GROUPS["LISTENING_PROTECTED_ADMISSION"]),
        "PFX-SYS-LISTEN-INSIGHTS": ("platform-hris-insights", TABLE_GROUPS["LISTENING_INSIGHTS"]),
        "PFX-SYS-LISTEN-ISSUER": ("auth-hris-participation-issuer", TABLE_GROUPS["LISTENING_PARTICIPATION_ISSUER"]),
    }
    streams = {row.get("streamKey"): row for row in authority.get("authorityStreams", [])}
    for binding_id, (stream_key, table_names) in listening_bindings.items():
        binding = physical_by_id.get(binding_id, {})
        stream = streams.get(stream_key, {})
        require(
            binding.get("owner_service") == stream.get("ownerService")
            and binding.get("database_schema") == stream.get("databaseSchema")
            and set(split(binding.get("allowed_prefixes", ""))) == table_names
            and LISTENING_SUMMARY_ID in binding.get("cross_boundary_rule", ""),
            errors,
            f"LISTENING_PHYSICAL_BINDING:{binding_id}",
        )


def validate_historical_listening_predecessor(
    capability: dict[str, Any], errors: list[str]
) -> None:
    """Keep the retired V287 design traceable without making it authority."""

    operations = capability.get("operations", [])
    machines = capability.get("stateMachines", [])
    transitions = [
        transition
        for machine in machines
        for transition in machine.get("transitions", [])
    ]
    events = capability.get("events", [])
    tables = capability.get("tables", [])
    require(
        capability.get("boundedContext") == "DWP_PLATFORM_HRIS_INSIGHTS"
        and capability.get("runtimeOwner") == "dwp-platform-server"
        and capability.get("migrationFile")
        == "dwp-platform-server/src/main/resources/db/migration/"
        "V287__hris_platform_modern_employee_listening.sql",
        errors,
        "LISTENING_HISTORICAL_PREDECESSOR_IDENTITY",
    )
    require(
        {row.get("operationId") for row in operations}
        == LEGACY_LISTENING_OPERATION_IDS
        and len(operations) == len(LEGACY_LISTENING_OPERATION_IDS),
        errors,
        "LISTENING_HISTORICAL_PREDECESSOR_OPERATION_SET",
    )
    require(
        {row.get("transitionId") for row in transitions}
        == LEGACY_LISTENING_TRANSITIONS
        and len(machines) == 1
        and len(transitions) == len(LEGACY_LISTENING_TRANSITIONS),
        errors,
        "LISTENING_HISTORICAL_PREDECESSOR_TRANSITION_SET",
    )
    require(
        {row.get("name") for row in events} == LEGACY_LISTENING_EVENTS
        and len(events) == len(LEGACY_LISTENING_EVENTS),
        errors,
        "LISTENING_HISTORICAL_PREDECESSOR_EVENT_SET",
    )
    require(
        {row.get("name") for row in tables} == LEGACY_LISTENING_TABLES
        and len(tables) == len(LEGACY_LISTENING_TABLES),
        errors,
        "LISTENING_HISTORICAL_PREDECESSOR_TABLE_SET",
    )


def validate_modern(data: dict[str, Any], errors: list[str]) -> None:
    body = data.get("modern_body") or {}
    capabilities = unique(body.get("capabilities", []), "capabilityId", errors, "MODERN_BODY")
    require(set(capabilities) == set(MODERN) and body.get("status") == "G3_CONTRACT_READY_NOT_IMPLEMENTED" and body.get("session") == "HRIS-SYS", errors, "MODERN_BODY_EXACT_SET")
    require(
        sha_bytes(data["_raw"].get(PATHS["modern_body"], b""))
        == HISTORICAL_SYS_MODERN_BODY_SHA256,
        errors,
        "SYS_MODERN_BODY_HISTORICAL_BYTE_SEAL",
    )
    central = data.get("modern_exact") or {}
    central_ops = {row.get("operationId"): row for row in central.get("operationBindings", []) if row.get("session") == "HRIS-SYS"}
    central_tables = {row.get("tableName"): row for row in central.get("tableSpecifications", []) if row.get("session") == "HRIS-SYS"}
    require(
        len(central_ops) == EXPECTED_MODERN_OPERATION_COUNT,
        errors,
        "MODERN_CENTRAL_OPERATION_COUNT",
    )
    require(
        set(central_tables) == MODERN_TABLES
        and len(central_tables) == EXPECTED_MODERN_TABLE_COUNT,
        errors,
        "MODERN_CANONICAL_TABLE_SET",
    )
    closed_objects(central, "modern-central", errors)
    event_doc = data.get("modern_events") or {}
    event_rows = [row for row in event_doc.get("eventPayloadSchemas", []) if row.get("session") == "HRIS-SYS"]
    require(
        len(event_rows) == EXPECTED_MODERN_EVENT_COUNT,
        errors,
        "MODERN_EVENT_COUNT",
    )
    event_by_name = {row.get("eventName"): row for row in event_rows}
    closed_objects(event_doc, "modern-events", errors)
    coding = {row.get("capability_id"): row for row in data.get("modern_coding") or [] if row.get("owner_session") == "HRIS-SYS"}
    delivery = {row.get("capability_id"): row for row in data.get("modern_delivery") or [] if row.get("owner_session") == "HRIS-SYS"}
    trace = {row.get("capability_id"): row for row in data.get("modern_trace") or [] if row.get("owner_session") == "HRIS-SYS"}
    require(set(coding) == set(MODERN) and set(trace) == set(MODERN), errors, "MODERN_CENTRAL_REGISTRY_SET")
    require(set(MODERN) <= set(delivery), errors, "MODERN_DELIVERY_SET")
    all_body_ops: set[str] = set()
    all_body_events: set[str] = set()
    for capability_id, expected in MODERN.items():
        listening_predecessor = capability_id == "HRIS.MODERN.EMPLOYEE_LISTENING"
        body_context = "DWP_PLATFORM_HRIS_INSIGHTS" if listening_predecessor else expected["context"]
        body_transitions = 6 if listening_predecessor else expected["transitions"]
        body_tables_expected = LEGACY_LISTENING_TABLES if listening_predecessor else TABLE_GROUPS[expected["group"]]
        body_event_names = LEGACY_LISTENING_EVENTS if listening_predecessor else MODERN_EVENT_NAMES[capability_id]
        body_transition_ids = LEGACY_LISTENING_TRANSITIONS if listening_predecessor else MODERN_TRANSITION_IDS[capability_id]
        body_migration = "V287__hris_platform_modern_employee_listening.sql" if listening_predecessor else expected["migration"]
        cap = capabilities.get(capability_id, {})
        operations = cap.get("operations", [])
        machines = cap.get("stateMachines", [])
        transitions = [transition for machine in machines for transition in machine.get("transitions", [])]
        events = cap.get("events", [])
        tables = cap.get("tables", [])
        tests = cap.get("acceptanceTests", [])
        if listening_predecessor:
            validate_historical_listening_predecessor(cap, errors)
            canonical_operation_ids = {
                operation_id
                for operation_id, operation in central_ops.items()
                if operation.get("capabilityId") == capability_id
            }
            canonical_table_names = {
                table_name
                for table_name, table in central_tables.items()
                if table.get("capabilityId") == capability_id
            }
            canonical_event_names = {
                event_name
                for event_name, event in event_by_name.items()
                if event.get("capabilityId") == capability_id
            }
            require(
                canonical_operation_ids == MODERN_OPERATION_IDS[capability_id],
                errors,
                "LISTENING_CANONICAL_OPERATION_SET",
            )
            require(
                canonical_table_names == LISTENING_TABLES,
                errors,
                "LISTENING_CANONICAL_TABLE_SET",
            )
            require(
                canonical_event_names == MODERN_EVENT_NAMES[capability_id],
                errors,
                "LISTENING_CANONICAL_EVENT_SET",
            )
            for operation_id in canonical_operation_ids:
                operation = central_ops[operation_id]
                reads = set(operation.get("readsTables", []))
                writes = set(operation.get("writesTables", []))
                require(
                    operation.get("session") == "HRIS-SYS"
                    and operation.get("requestSchemaRef")
                    and operation.get("responseSchemaRef")
                    and operation.get("errorSchemaRefs")
                    and bool(reads or writes)
                    and reads | writes <= LISTENING_TABLES,
                    errors,
                    f"LISTENING_CANONICAL_OPERATION_CONTRACT:{operation_id}",
                )
            all_body_ops |= canonical_operation_ids
            all_body_events |= canonical_event_names
            require(
                set(cap.get("authorizationCapabilities", []))
                == MODERN_AUTH_CAPABILITIES[capability_id],
                errors,
                "LISTENING_HISTORICAL_AUTHORIZATION_TRACE",
            )
            expected_test_ids = {
                f"{expected['slice']}-AT-{index:03d}" for index in range(1, 4)
            }
            require(
                {test.get("testId") for test in tests} == expected_test_ids
                and all(test.get("evidencePath") and test.get("assertion") for test in tests),
                errors,
                "MODERN_ACCEPTANCE:HRIS.MODERN.EMPLOYEE_LISTENING",
            )
            register = coding.get(capability_id, {})
            for key, value in (
                ("api_operation_count", len(canonical_operation_ids)),
                ("state_machine_count", 0),
                ("state_transition_count", 0),
                ("event_count", len(canonical_event_names)),
                ("physical_table_count", len(canonical_table_names)),
                ("acceptance_test_count", expected["tests"]),
            ):
                require(
                    register.get(key) == str(value),
                    errors,
                    f"MODERN_REGISTER_COUNT:{capability_id}:{key}",
                )
            require(
                set(split(register.get("bounded_context", "")))
                == LISTENING_STREAM_KEYS
                and set(split(register.get("runtime_owner", "")))
                == {"dwp-platform-server", "dwp-auth-server"}
                and LISTENING_SUMMARY_ID in split(register.get("contract_ref", ""))
                and "V287__" not in register.get("migration_file", "")
                and register.get("status")
                == "SUCCESSOR_EXACT_G3_START_AUTHORITY_NOT_IMPLEMENTED",
                errors,
                "LISTENING_ACTIVE_CODING_SUCCESSOR",
            )
            require(
                trace.get(capability_id, {}).get("implementation_slice_id")
                == expected["slice"]
                and trace.get(capability_id, {}).get("state")
                == "ALLOCATED_REQUIRED_NOT_STARTED",
                errors,
                f"MODERN_TRACE:{capability_id}",
            )
            require(
                delivery.get(capability_id, {}).get("implementation_state")
                == "NOT_STARTED_G3"
                and delivery.get(capability_id, {}).get("production_state")
                == "NOT_AUTHORIZED_G6",
                errors,
                f"MODERN_DELIVERY_STATE:{capability_id}",
            )
            continue
        require(cap.get("boundedContext") == body_context and cap.get("runtimeOwner") == "dwp-platform-server", errors, f"MODERN_PREDECESSOR_OWNER_CONTEXT:{capability_id}")
        require(cap.get("activationLayers") == ["PRODUCT_CORE", "TENANT_CONFIG"], errors, f"BOUNDARY_ESCALATION:{capability_id}")
        require(cap.get("implementationState") == "NOT_STARTED_G3" and cap.get("productionState") == "NOT_AUTHORIZED_G6", errors, f"MODERN_STATE:{capability_id}")
        require(len(operations) == expected["ops"] and len(machines) == 1 and len(transitions) == body_transitions and len(events) == expected["events"] and len(tables) == len(body_tables_expected) and len(tests) == expected["tests"], errors, f"MODERN_PREDECESSOR_BODY_COUNTS:{capability_id}")
        require(pathlib.PurePosixPath(cap.get("migrationFile", "")).name == body_migration, errors, f"MODERN_PREDECESSOR_MIGRATION_FILE:{capability_id}")
        body_table_names = {table.get("name") for table in tables}
        require(body_table_names == body_tables_expected, errors, f"MODERN_PREDECESSOR_TABLE_BODY_SET:{capability_id}")
        transition_by_id = {row.get("transitionId"): row for row in transitions}
        require(len(transition_by_id) == len(transitions), errors, f"MODERN_TRANSITION_DUPLICATE:{capability_id}")
        require(set(transition_by_id) == body_transition_ids, errors, f"MODERN_PREDECESSOR_TRANSITION_ID_SET:{capability_id}")
        operation_ids = {operation.get("operationId") for operation in operations}
        require(len(operation_ids) == len(operations), errors, f"MODERN_OPERATION_DUPLICATE:{capability_id}")
        require(operation_ids == MODERN_OPERATION_IDS[capability_id], errors, f"MODERN_OPERATION_ID_SET:{capability_id}")
        require(set(cap.get("authorizationCapabilities", [])) == MODERN_AUTH_CAPABILITIES[capability_id], errors, f"MODERN_BODY_AUTH_CAPABILITIES:{capability_id}")
        all_body_ops |= operation_ids
        internal_operation_ids = {transition.get("operationId") for transition in transitions if transition.get("operationId") not in operation_ids}
        require(internal_operation_ids == MODERN_INTERNAL_OPERATION_IDS[capability_id], errors, f"MODERN_INTERNAL_OPERATION_ID_SET:{capability_id}")
        for transition_id, transition in transition_by_id.items():
            require(transition.get("operationId") in operation_ids | MODERN_INTERNAL_OPERATION_IDS[capability_id] and transition.get("from") and transition.get("to") and transition.get("guard") and transition.get("aggregateRootTable") in body_table_names and transition.get("stateColumn") and transition.get("preStates") and transition.get("postStates") and transition.get("postStateSource") and transition.get("postStateSink"), errors, f"MODERN_TRANSITION_INVALID:{transition_id}")
        for operation in operations:
            operation_id = operation.get("operationId", "")
            exact = central_ops.get(operation_id, {})
            for body_key, central_key in (("method", "method"), ("path", "path"), ("action", "action"), ("authorizationCapability", "authorizationCapability"), ("scope", "scope"), ("idempotency", "idempotency"), ("expectedVersion", "expectedVersion"), ("transitionIds", "stateTransitionIds"), ("emits", "eventNames")):
                require(operation.get(body_key) == exact.get(central_key), errors, f"MODERN_OPERATION_DRIFT:{operation_id}:{body_key}")
            require(operation.get("mode") == exact.get("mode") and operation.get("response") == exact.get("responseSchemaRef"), errors, f"MODERN_RESPONSE_MODE:{operation_id}")
            require(exact.get("requestSchemaRef") and exact.get("responseSchemaRef") and exact.get("errorSchemaRefs"), errors, f"MODERN_SCHEMA_MISSING:{operation_id}")
            reads, writes = exact.get("readsTables", []), exact.get("writesTables", [])
            require(set(reads + writes) <= body_table_names and bool(reads or writes), errors, f"MODERN_READ_WRITE_OWNER:{operation_id}")
            if operation.get("mode") == "QUERY":
                require(bool(reads) and not writes and not operation.get("transitionIds") and not operation.get("emits") and operation.get("idempotency") == "READ_SAFE", errors, f"MODERN_QUERY_CONTRACT:{operation_id}")
            else:
                require(bool(writes) and bool(operation.get("transitionIds")) and operation.get("idempotency") == "REQUIRED", errors, f"MODERN_COMMAND_WRITE_TRANSITION:{operation_id}")
                require(set(operation.get("transitionIds", [])) <= set(transition_by_id), errors, f"MODERN_OPERATION_TRANSITION_REF:{operation_id}")
        for event in events:
            event_name = event.get("name", "")
            all_body_events.add(event_name)
            exact_event = event_by_name.get(event_name, {})
            require(exact_event.get("capabilityId") == capability_id and exact_event.get("topic") == event.get("topic"), errors, f"MODERN_EVENT_DRIFT:{event_name}")
            require(set(exact_event.get("emittedOnTransitionIds", [])) == set(event.get("emittedOn", [])), errors, f"MODERN_EVENT_TRANSITIONS:{event_name}")
            require(set(event.get("payloadRequired", [])) <= {field.get("name") for field in exact_event.get("fields", []) if field.get("required") is True}, errors, f"MODERN_EVENT_PAYLOAD:{event_name}")
            internal_handler = event.get("emittedByInternalHandler")
            exact_internal_handlers = set(exact_event.get("emittedByInternalHandlerIds", []))
            require(exact_internal_handlers == ({internal_handler} if internal_handler else set()), errors, f"MODERN_EVENT_INTERNAL_HANDLER:{event_name}")
        require({event.get("name") for event in events} == body_event_names, errors, f"MODERN_PREDECESSOR_EVENT_NAME_SET:{capability_id}")
        emitted_transition_ids = {transition_id for event in events for transition_id in event.get("emittedOn", [])}
        require(emitted_transition_ids == body_transition_ids, errors, f"MODERN_PREDECESSOR_EVENT_TRANSITION_CLOSURE:{capability_id}")
        internal_event_handlers = {event.get("emittedByInternalHandler") for event in events if event.get("emittedByInternalHandler")}
        require(internal_event_handlers == MODERN_INTERNAL_OPERATION_IDS[capability_id], errors, f"MODERN_INTERNAL_EVENT_CLOSURE:{capability_id}")
        expected_test_ids = {f"{expected['slice']}-AT-{i:03d}" for i in range(1, 4)}
        require({test.get("testId") for test in tests} == expected_test_ids and all(test.get("evidencePath") and test.get("assertion") for test in tests), errors, f"MODERN_ACCEPTANCE:{capability_id}")
        register = coding.get(capability_id, {})
        for key, value in (("api_operation_count", expected["ops"]), ("state_machine_count", 0 if listening_predecessor else 1), ("state_transition_count", expected["transitions"]), ("event_count", expected["events"]), ("physical_table_count", expected["tables"]), ("acceptance_test_count", expected["tests"])):
            require(register.get(key) == str(value), errors, f"MODERN_REGISTER_COUNT:{capability_id}:{key}")
        if listening_predecessor:
            require(
                set(split(register.get("bounded_context", ""))) == LISTENING_STREAM_KEYS
                and set(split(register.get("runtime_owner", ""))) == {"dwp-platform-server", "dwp-auth-server"}
                and LISTENING_SUMMARY_ID in split(register.get("contract_ref", ""))
                and "V287__" not in register.get("migration_file", "")
                and register.get("status") == "SUCCESSOR_EXACT_G3_START_AUTHORITY_NOT_IMPLEMENTED",
                errors,
                "LISTENING_ACTIVE_CODING_SUCCESSOR",
            )
        require(register.get("implementation_slice_id", expected["slice"]) in {"", expected["slice"]}, errors, f"MODERN_REGISTER_SLICE:{capability_id}")
        require(trace.get(capability_id, {}).get("implementation_slice_id") == expected["slice"] and trace.get(capability_id, {}).get("state") == "ALLOCATED_REQUIRED_NOT_STARTED", errors, f"MODERN_TRACE:{capability_id}")
        require(delivery.get(capability_id, {}).get("implementation_state") == "NOT_STARTED_G3" and delivery.get(capability_id, {}).get("production_state") == "NOT_AUTHORIZED_G6", errors, f"MODERN_DELIVERY_STATE:{capability_id}")
    require(
        set(central_ops) == all_body_ops
        and len(all_body_ops) == EXPECTED_MODERN_OPERATION_COUNT,
        errors,
        "MODERN_OPERATION_BODY_CLOSURE",
    )
    require(
        set(event_by_name) == all_body_events
        and len(all_body_events) == EXPECTED_MODERN_EVENT_COUNT,
        errors,
        "MODERN_EVENT_BODY_CLOSURE",
    )
    for table_name, table in central_tables.items():
        expected_capability = (
            "HRIS.MODERN.EMPLOYEE_LISTENING"
            if table_name in LISTENING_TABLES
            else next(
                (
                    cap
                    for cap, meta in MODERN.items()
                    if meta["group"] in TABLE_GROUPS
                    and table_name in TABLE_GROUPS[meta["group"]]
                ),
                None,
            )
        )
        require(table.get("capabilityId") == expected_capability and table.get("rowSecurity") and table.get("columns"), errors, f"MODERN_TABLE_OWNER:{table_name}")
    auth_rows = [row for row in data.get("modern_auth") or [] if row.get("owner_session") == "HRIS-SYS"]
    require(len(auth_rows) == 9 and {row.get("modern_capability_id") for row in auth_rows} == set(MODERN), errors, "MODERN_AUTH_EXACT_SET")
    for row in auth_rows:
        require(row.get("implementation_slice_id") == MODERN[row.get("modern_capability_id")]["slice"], errors, f"MODERN_AUTH_SLICE:{row.get('binding_id')}")
        require(row.get("canonical_app_entitlement") == "APP.HCM:VIEW" and tuple(split(row.get("enforcement_layers", ""))) == PEP_LAYERS, errors, f"MODERN_AUTH_PEP:{row.get('binding_id')}")
        require(row.get("canonical_capability_key") in {operation.get("authorizationCapability") for operation in capabilities[row.get("modern_capability_id")].get("operations", [])}, errors, f"MODERN_AUTH_CAPABILITY:{row.get('binding_id')}")
    for capability_id in MODERN:
        require({row.get("binding_id") for row in auth_rows if row.get("modern_capability_id") == capability_id} == MODERN_AUTH_BINDING_IDS[capability_id], errors, f"MODERN_AUTH_BINDING_ID_SET:{capability_id}")
        require({row.get("canonical_capability_key") for row in auth_rows if row.get("modern_capability_id") == capability_id} == MODERN_AUTH_CAPABILITIES[capability_id], errors, f"MODERN_AUTH_CAPABILITY_SET:{capability_id}")
        require({row.get("query_id") for row in data.get("ia") or [] if row.get("primary_slice_id") == MODERN[capability_id]["slice"]} == MODERN_ENTRY_QUERY_IDS[capability_id], errors, f"MODERN_IA_QUERY_SET:{capability_id}")
        g3_row = next((row for row in data.get("g3") or [] if row.get("slice_id") == MODERN[capability_id]["slice"]), {})
        primary_refs = set(split(g3_row.get("primary_contract_refs", "")))
        require(MODERN_OPERATION_IDS[capability_id] | MODERN_EVENT_NAMES[capability_id] <= primary_refs, errors, f"MODERN_G3_PRIMARY_CLOSURE:{capability_id}")
        require(all(f"MODOP:{operation_id}" in split(g3_row.get("api_event_contract_refs", "")) for operation_id in MODERN_OPERATION_IDS[capability_id]), errors, f"MODERN_G3_OPERATION_ALIAS_CLOSURE:{capability_id}")

    semantic = data.get("modern_semantic") or {}
    identities = data.get("modern_identity") or {}
    for label, registry, registry_id in (("SEMANTIC", semantic, "dwp.hris.modern.operation-semantic-bindings.v1"), ("IDENTITY", identities, "dwp.hris.modern.public-identities.v1")):
        require(registry.get("registryId") == registry_id and registry.get("schemaVersion") == 1 and registry.get("status") == "SEALED_G3_DESIGN_NOT_IMPLEMENTED", errors, f"MODERN_{label}_REGISTRY")
        require(registry.get("sealedPayloadSha256") == canonical_digest(registry), errors, f"MODERN_{label}_SEAL")
        expected_pins = {"modern-capability-exact-schema-contracts.v1.json": sha_bytes(data["_raw"].get(PATHS["modern_exact"], b"")), "modern-capability-event-payload-contracts.v1.json": sha_bytes(data["_raw"].get(PATHS["modern_events"], b""))}
        require(registry.get("canonicalContractPins") == expected_pins, errors, f"MODERN_{label}_CANONICAL_PINS")
    semantic_rows = {row.get("operationId"): row for row in semantic.get("operations", []) if row.get("session") == "HRIS-SYS"}
    require(
        set(semantic_rows) == all_body_ops
        and len(semantic_rows) == EXPECTED_MODERN_OPERATION_COUNT,
        errors,
        "MODERN_SEMANTIC_SYS_CLOSURE",
    )
    for operation_id, operation in central_ops.items():
        semantic_row = semantic_rows.get(operation_id, {})
        for key in ("capabilityId", "session", "mode", "readsTables", "writesTables", "responseSchemaRef", "stateTransitionIds", "eventNames"):
            require(semantic_row.get(key) == operation.get(key), errors, f"MODERN_SEMANTIC_DRIFT:{operation_id}:{key}")
        require(semantic_row.get("requestContract") and semantic_row.get("typedSources") and semantic_row.get("responseFieldSources") and semantic_row.get("mutationEvidence"), errors, f"MODERN_SEMANTIC_INCOMPLETE:{operation_id}")
        if operation.get("mode") == "COMMAND":
            require(semantic_row.get("requiredColumnSources") and semantic_row.get("receiptContracts"), errors, f"MODERN_SEMANTIC_COMMAND_INCOMPLETE:{operation_id}")
        if operation.get("eventNames"):
            require(semantic_row.get("eventFieldSources"), errors, f"MODERN_SEMANTIC_EVENT_INCOMPLETE:{operation_id}")
    for group in ("physicalColumns", "requestFieldsByOperation", "responseFieldsByOperation", "eventFieldsByOperation"):
        require(isinstance(identities.get(group), dict), errors, f"MODERN_IDENTITY_GROUP:{group}")
    request_identity_ops = set(identities.get("requestFieldsByOperation", {}))
    response_identity_ops = set(identities.get("responseFieldsByOperation", {}))
    event_identity_ops = set(identities.get("eventFieldsByOperation", {}))
    require(request_identity_ops <= set(row.get("operationId") for row in central.get("operationBindings", [])), errors, "MODERN_IDENTITY_REQUEST_ORPHAN")
    require(response_identity_ops <= set(row.get("operationId") for row in central.get("operationBindings", [])), errors, "MODERN_IDENTITY_RESPONSE_ORPHAN")
    require(event_identity_ops <= set(row.get("operationId") for row in central.get("operationBindings", [])), errors, "MODERN_IDENTITY_EVENT_ORPHAN")


def validate_evidence_and_boundary(data: dict[str, Any], errors: list[str]) -> None:
    golden_rows = data.get("golden") or []
    golden = unique(golden_rows, "scenario_id", errors, "SYS_GOLDEN")
    require(set(golden) == {f"SYS-GOLD-{i:03d}" for i in range(1, 61)} and len(golden_rows) == 60, errors, "GOLDEN_EXACT_SET")
    require(all(row.get("status") == "READY" and row.get("negative_or_recovery") and row.get("evidence_target") for row in golden_rows), errors, "GOLDEN_EVIDENCE_INCOMPLETE")
    manifest_rows = (data.get("manifest") or {}).get("sliceBindings", [])
    for row in manifest_rows:
        ids = row.get("goldenScenarioIds", [])
        require(bool(ids) and set(ids) <= set(golden), errors, f"GOLDEN_BINDING_MISSING:{row.get('assuranceSliceId')}")
        if row.get("assuranceSliceId") != "TFR-SYS-013":
            areas = {golden[item]["area"] for item in ids if item in golden}
            require({"TENANT", "SOD", "REPLAY", "AUTHORIZATION"} <= areas, errors, f"GOLDEN_CROSS_CUTTING:{row.get('assuranceSliceId')}")
    activation_rows = [row for row in data.get("activation") or [] if row.get("activation_id") in ACTIVATION_IDS]
    require({row.get("activation_id") for row in activation_rows} == ACTIVATION_IDS, errors, "ACTIVATION_GATE_SET")
    for row in activation_rows:
        require(row.get("gate") == "G6" and row.get("status") == "DEFERRED_G6_NOT_CORE_BLOCKER" and row.get("core_code_effect") == "DOES_NOT_BLOCK_G3_CORE", errors, f"ACTIVATION_GATE_BOUNDARY:{row.get('activation_id')}")
        require(row.get("production_effect").startswith("BLOCKS_"), errors, f"ACTIVATION_PRODUCTION_BLOCK:{row.get('activation_id')}")
    prompt = data.get("prompt") or ""
    for marker in (PATHS["manifest"], "sys-exact-business-start-pin.v1.json", "validate_sys_exact_business_start.py --self-test --compact", "audit_sys_exact_business_start.cjs --self-test --compact", "정확히 17개 slice", "전역 Gate"):
        require(marker in prompt, errors, f"PROMPT_ASSURANCE_MARKER:{marker}")
    require("module-exact-business-start-canonical.v1.json`과 `sys-exact" not in prompt, errors, "PROMPT_PREDECESSOR_REGRESSION")
    implementation = data.get("implementation") or ""
    require("successor of: `g2-implementation-contract.md` (`SUPERSEDED_IMMUTABLE`" in implementation, errors, "CURRENT_SYS_IMPLEMENTATION_AUTHORITY")
    require("g0/migration-allocation-register.csv" in implementation and "MIG-SYS-AUTH-217-245" in implementation and "MIG-SYS-PLATFORM-262-290" in implementation, errors, "CURRENT_SYS_MIGRATION_AUTHORITY")


def validate_lineage_and_pin(data: dict[str, Any], errors: list[str], verify_pin: bool) -> None:
    lineage = data.get("lineage") or {}
    require(lineage.get("lineageId") == "dwp.hris.sys-exact-business-successor-lineage.v1" and lineage.get("status") == "CURRENT_EXACT_SUCCESSOR_LINEAGE", errors, "LINEAGE_ID_STATUS")
    successor = lineage.get("successor", {})
    require(successor.get("path") == PATHS["manifest"] and successor.get("sha256") == sha_bytes(data["_raw"].get(PATHS["manifest"], b"")), errors, "LINEAGE_SUCCESSOR_HASH")
    require(successor.get("exactOwnedSliceCount") == 17 and successor.get("activeSliceCount") == 16 and successor.get("retiredSliceCount") == 1, errors, "LINEAGE_SLICE_COUNT")
    require(
        successor.get("modernCapabilityCount") == len(MODERN)
        and successor.get("modernPublicOperationCount")
        == EXPECTED_MODERN_OPERATION_COUNT
        and successor.get("modernInternalOperationCount")
        == sum(len(value) for value in MODERN_INTERNAL_OPERATION_IDS.values())
        and successor.get("modernTransitionCount")
        == EXPECTED_MODERN_TRANSITION_COUNT
        and successor.get("modernEventCount") == EXPECTED_MODERN_EVENT_COUNT
        and successor.get("modernTableCount") == EXPECTED_MODERN_TABLE_COUNT,
        errors,
        "LINEAGE_MODERN_COUNTS",
    )
    require(
        "currentSuccessorOverlays" not in lineage,
        errors,
        "LINEAGE_LISTENING_REVERSE_AUTHORITY_FIELDS",
    )
    current = lineage.get("currentPointer", {})
    require(current.get("artifactId") == "SYS_EXACT_BUSINESS_EQUIVALENCE" and current.get("path") == PATHS["manifest"], errors, "LINEAGE_CURRENT_POINTER")
    predecessors = {row.get("path"): row for row in lineage.get("predecessors", [])}
    canonical = predecessors.get(PATHS["canonical4"], {})
    require(canonical.get("sha256") == "483ae9f1aefaa59ed2758a0d0fb0e0280b7e961fb0e1340a60e75d1bbec81b36" and canonical.get("relation") == "PRESERVED_SEALED_NON_SYS_SCOPE", errors, "LINEAGE_CANONICAL4_PREDECESSOR")
    require(sha_bytes(data["_raw"].get(PATHS["canonical4"], b"")) == "483ae9f1aefaa59ed2758a0d0fb0e0280b7e961fb0e1340a60e75d1bbec81b36", errors, "CANONICAL4_BYTE_REGRESSION")
    for path_key, expected_sha, relation in (
        ("implementation_predecessor", "2dbabebfc52c2175193821f72a3b9bf5b33b83110ed871f88e35ab07c8e0f871", "HISTORICAL_SYS_G2_IMPLEMENTATION_PREDECESSOR"),
        ("validator_predecessor", "030fd2eb4189846da9385b47606468aaf545091032b4b134f902be52662fc823", "HISTORICAL_SYS_G2_VALIDATOR_PREDECESSOR"),
    ):
        predecessor = predecessors.get(PATHS[path_key], {})
        require(predecessor.get("sha256") == expected_sha and predecessor.get("relation") == relation, errors, f"LINEAGE_SYS_PREDECESSOR:{path_key}")
        require(sha_bytes(data["_raw"].get(PATHS[path_key], b"")) == expected_sha, errors, f"SYS_PREDECESSOR_BYTE_REGRESSION:{path_key}")
    authorities = lineage.get("currentSysAuthorities", {})
    for name, key in (("implementation", "implementation"), ("validator", "current_validator")):
        authority = authorities.get(name, {})
        require(authority.get("path") == PATHS[key] and authority.get("sha256") == sha_bytes(data["_raw"].get(PATHS[key], b"")), errors, f"LINEAGE_CURRENT_AUTHORITY:{name}")
    listening_summary = lineage.get("currentDerivedSummaries", {}).get(
        "sysListeningStreamSummary", {}
    )
    require(
        listening_summary.get("contractId") == LISTENING_SUMMARY_ID
        and listening_summary.get("path") == LISTENING_SUMMARY_PATH
        and listening_summary.get("sha256")
        == sha_bytes(data["_raw"].get(LISTENING_SUMMARY_PATH, b""))
        and listening_summary.get("sealedPayloadSha256")
        == (data.get("listening_summary") or {}).get("sealedPayloadSha256")
        and listening_summary.get("canonicalInputSetSha256")
        == (data.get("listening_summary") or {}).get(
            "canonicalPrecedence", {}
        ).get("generatedSummary", {}).get("canonicalInputSetSha256")
        and listening_summary.get("state")
        == "CURRENT_DERIVED_G3_START_SUMMARY_NOT_IMPLEMENTED",
        errors,
        "LINEAGE_LISTENING_DERIVED_SUMMARY",
    )
    assurance = lineage.get("assurance", {})
    require(assurance.get("primaryValidator") == PATHS["primary_validator"] and assurance.get("independentOracle") == PATHS["independent_validator"] and assurance.get("pin") == PATHS["pin"] and assurance.get("exactArtifactPinCount") == 49 and assurance.get("minimumMutationCountPerValidator") == 21, errors, "LINEAGE_ASSURANCE")
    if not verify_pin:
        return
    pin = data.get("pin") or {}
    require(pin.get("pinId") == "dwp.hris.sys-exact-business-start-pin.v1" and pin.get("status") == "SEALED_SYS_EXACT_BUSINESS_START_PIN", errors, "PIN_ID_STATUS")
    require(pin.get("exactOwnedSliceCount") == 17 and pin.get("activeSliceCount") == 16 and pin.get("retiredSliceCount") == 1 and pin.get("currentArtifactPath") == PATHS["manifest"] and pin.get("currentArtifactSha256") == sha_bytes(data["_raw"].get(PATHS["manifest"], b"")), errors, "PIN_SCOPE")
    require(pin.get("lineagePath") == PATHS["lineage"] and pin.get("lineageSha256") == sha_bytes(data["_raw"].get(PATHS["lineage"], b"")), errors, "PIN_LINEAGE")
    pins = pin.get("artifactPins", [])
    by_path = {row.get("path"): row for row in pins}
    required = {PATHS[key] for key in PATHS if key != "pin"}
    require(len(by_path) == len(pins) and set(by_path) == set(pin.get("exactArtifactPaths", [])) == required and pin.get("exactArtifactCount") == len(required) == len(pins), errors, "PIN_ARTIFACT_SET")
    for relative, row in by_path.items():
        raw = data["_raw"].get(relative)
        require(raw is not None and row.get("sha256") == sha_bytes(raw) and row.get("byteCount") == len(raw), errors, f"PIN_DIGEST:{relative}")
    policy = pin.get("validatorPolicy", {})
    require(policy.get("primary") == PATHS["primary_validator"] and policy.get("independent") == PATHS["independent_validator"] and policy.get("normalAndSelfTestRequired") is True and policy.get("minimumMutationCount") == 21, errors, "PIN_VALIDATOR_POLICY")
    boundary = pin.get("gateBoundary", {})
    require(boundary.get("globalGateAuthorization") == "NONE_VALIDATOR_CONTROLLED" and boundary.get("runtimeImplemented") is False and boundary.get("productionAuthorized") is False, errors, "PIN_GATE_BOUNDARY")


def validate(data: dict[str, Any], verify_pin: bool = True) -> list[str]:
    errors: list[str] = []
    missing = [key for key in PATHS if key != "pin" and data.get(key) is None]
    if verify_pin and data.get("pin") is None:
        missing.append("pin")
    if missing:
        return [f"MISSING_ARTIFACT:{key}" for key in missing]
    validate_manifest(data, errors)
    validate_sources(data, errors)
    validate_g3(data, errors)
    validate_base_contracts(data, errors)
    validate_authorization(data, errors)
    validate_physical(data, errors)
    validate_modern(data, errors)
    validate_evidence_and_boundary(data, errors)
    validate_lineage_and_pin(data, errors, verify_pin)
    return sorted(set(errors))


Mutation = tuple[str, str, Callable[[dict[str, Any]], None]]


def mutations() -> list[Mutation]:
    def pop_slice(data: dict[str, Any]) -> None:
        data["manifest"]["sliceBindings"].pop()

    def source_hash(data: dict[str, Any]) -> None:
        next(row for row in data["targets"] if row["resolution_id"] == "TFR-SYS-006")["source_family_sha256"] = "0" * 64

    def source_count(data: dict[str, Any]) -> None:
        next(row for row in data["targets"] if row["resolution_id"] == "TFR-SYS-007")["source_row_count"] = "36"

    def source_register(data: dict[str, Any]) -> None:
        next(row for row in data["sys_source"] if sha_bytes(row["target_api_or_event"].encode()) == EXPECTED_SOURCE["TFR-SYS-008"]["sha"])["target_api_or_event"] += "#drift"

    def retired_active(data: dict[str, Any]) -> None:
        next(row for row in data["g3"] if row["slice_id"] == "BASE-TFR-SYS-013")["gate_status"] = "OPEN_G3_CODE"

    def primary_downgrade(data: dict[str, Any]) -> None:
        row = next(row for row in data["g3"] if row["slice_id"] == "BASE-TFR-SYS-004")
        refs = split(row["primary_contract_refs"])
        downgraded = "SYS-API-001"
        row["primary_contract_refs"] = "|".join(ref for ref in refs if ref != downgraded)
        row["related_contract_refs"] = "|".join([downgraded] + split(row["related_contract_refs"]))

    def transition_missing(data: dict[str, Any]) -> None:
        data["modern_body"]["capabilities"][0]["stateMachines"][0]["transitions"].pop()

    def schema_missing(data: dict[str, Any]) -> None:
        data["transport"]["operations"]["SYS-API-002"]["responseSchema"] = None

    def write_missing(data: dict[str, Any]) -> None:
        row = next(row for row in data["modern_exact"]["operationBindings"] if row["operationId"] == "modern.ai.assist.create")
        row["writesTables"] = []

    def golden_missing(data: dict[str, Any]) -> None:
        next(row for row in data["manifest"]["sliceBindings"] if row["assuranceSliceId"] == "MOD-SYS-AI")["goldenScenarioIds"] = []

    def table_owner(data: dict[str, Any]) -> None:
        row = next(row for row in data["modern_exact"]["tableSpecifications"] if row["tableName"] == "sys_hris_ai_use_policies")
        row["capabilityId"] = "HRIS.MODERN.PEOPLE_ANALYTICS"

    def thirteenth_table_missing(data: dict[str, Any]) -> None:
        data["modern_exact"]["tableSpecifications"] = [
            row for row in data["modern_exact"]["tableSpecifications"]
            if row.get("tableName") != "sys_hris_ai_evaluation_requests"
        ]

    def migration(data: dict[str, Any]) -> None:
        next(row for row in data["migrations"] if row["allocation_id"] == "MIG-SYS-PLATFORM-262-290")["allocated_version"] = "262-300"

    def ia(data: dict[str, Any]) -> None:
        next(row for row in data["ia"] if row["query_id"] == "IAQ-066")["pep_layers"] = "GATEWAY_APP_ENTITLEMENT"

    def pep(data: dict[str, Any]) -> None:
        next(row for row in data["pep"] if row["binding_id"] == "PEP-SYS-001")["contract_path"] = "/wrong"

    def duty(data: dict[str, Any]) -> None:
        next(row for row in data["duties"] if row["duty_code"] == "HRIS_DUTY_POLICY_AUTHOR")["capability_key"] = "hcm.wrong"

    def boundary(data: dict[str, Any]) -> None:
        data["modern_body"]["capabilities"][0]["activationLayers"].append("REAL_PROVIDER_ADAPTER")

    def prompt(data: dict[str, Any]) -> None:
        data["prompt"] = data["prompt"].replace("sys-exact-business-start-successor.v1.json", "module-exact-business-start-canonical.v1.json")

    def pointer(data: dict[str, Any]) -> None:
        data["manifest"]["currentPointer"]["currentPath"] = PATHS["canonical4"]

    def semantic(data: dict[str, Any]) -> None:
        next(row for row in data["modern_semantic"]["operations"] if row["operationId"] == "modern.ai.assist.create")["writesTables"] = []

    def token(data: dict[str, Any]) -> None:
        next(row for row in data["g3"] if row["slice_id"] == "MOD-SYS-AI")["code_go_token"] = "G3-CODE-GO-WRONG"

    def listening_stream_missing(data: dict[str, Any]) -> None:
        data["listening_summary"]["authorityStreams"].pop()

    def listening_seal_tampered(data: dict[str, Any]) -> None:
        data["listening_summary"]["sealedPayloadSha256"] = "0" * 64

    def listening_manifest_pin_stale(data: dict[str, Any]) -> None:
        next(row for row in data["manifest"]["sliceBindings"] if row["assuranceSliceId"] == "MOD-SYS-LISTEN")["derivedSummaryFileSha256"] = "0" * 64

    def listening_shared_schema(data: dict[str, Any]) -> None:
        streams = data["listening_summary"]["authorityStreams"]
        streams[1]["databaseSchema"] = streams[0]["databaseSchema"]

    def listening_cross_stream_fk(data: dict[str, Any]) -> None:
        response = next(row for row in data["listening_summary"]["tableOwnership"] if row["tableName"] == "sys_hris_listening_responses")
        response["localForeignKeys"][0]["targetTable"] = "sys_hris_listening_surveys"

    def listening_raw_public_event(data: dict[str, Any]) -> None:
        data["listening_summary"]["eventOwnership"]["canonicalPublicEvents"][0]["eventName"] = "EmployeeListeningResponseSubmitted.v2"

    def listening_service_missing(data: dict[str, Any]) -> None:
        next(row for row in data["listening_summary"]["authorityStreams"] if row["streamKey"] == "auth-hris-participation-issuer")["ownerService"] = "dwp-platform-server"

    def listening_v287(data: dict[str, Any]) -> None:
        data["listening_summary"]["migrationReservations"][0]["firstReservedMigration"] = "V287__hris_platform_modern_employee_listening.sql"

    def listening_admin_reentry_missing(data: dict[str, Any]) -> None:
        data["listening_summary"]["publicOperationBindings"] = [
            row
            for row in data["listening_summary"]["publicOperationBindings"]
            if row.get("operationId") != "modern.listening.surveys.query"
        ]

    def listening_survey_revise_missing(data: dict[str, Any]) -> None:
        data["listening_summary"]["publicOperationBindings"] = [
            row
            for row in data["listening_summary"]["publicOperationBindings"]
            if row.get("operationId") != "modern.listening.survey.revise"
        ]

    def listening_survey_revise_cas_widened(data: dict[str, Any]) -> None:
        next(
            row
            for row in data["listening_summary"]["publicOperationBindings"]
            if row.get("operationId") == "modern.listening.survey.revise"
        )["stateContract"] = "ANY_TO_DRAFT_NO_CAS"

    def listening_erasure_handler_missing(data: dict[str, Any]) -> None:
        data["listening_summary"]["ownerLocalHandlers"] = []

    def listening_erasure_request_missing(data: dict[str, Any]) -> None:
        data["listening_summary"]["ownerLocalHandlers"] = [
            row
            for row in data["listening_summary"]["ownerLocalHandlers"]
            if row.get("handlerId")
            != LISTENING_OWNER_LOCAL_ERASURE_REQUEST_HANDLER
        ]

    def listening_erasure_request_status_widened(data: dict[str, Any]) -> None:
        next(
            row
            for row in data["listening_summary"]["ownerLocalHandlers"]
            if row.get("handlerId")
            == LISTENING_OWNER_LOCAL_ERASURE_REQUEST_HANDLER
        )["initialStatus"] = "CLAIMED"

    def listening_internal_message_handler_missing(data: dict[str, Any]) -> None:
        data["listening_summary"]["ownerLocalHandlers"] = [
            row
            for row in data["listening_summary"]["ownerLocalHandlers"]
            if row.get("messageName") != "ListeningAdmissionInstallRequested.v1"
        ]

    def listening_internal_message_handler_non_atomic(data: dict[str, Any]) -> None:
        next(
            row
            for row in data["listening_summary"]["ownerLocalHandlers"]
            if row.get("messageName") == "ListeningCohortPackageReady.v1"
        )["transactionBoundary"] = "INBOX_THEN_EVENTUAL_DOMAIN"

    def listening_internal_message_handler_cross_owner(data: dict[str, Any]) -> None:
        next(
            row
            for row in data["listening_summary"]["ownerLocalHandlers"]
            if row.get("messageName") == "ListeningAdmissionInstallReceipt.v1"
        )["inboxLedgerTable"] = "sys_hris_listening_protected_receipts"

    def listening_erasure_owner_port_missing(data: dict[str, Any]) -> None:
        data["listening_summary"]["ownerPortOperations"] = [
            row
            for row in data["listening_summary"]["ownerPortOperations"]
            if row.get("ownerPortOperation") != "protected.requestErasure"
        ]

    def listening_legacy_slice_authority(data: dict[str, Any]) -> None:
        next(
            row for row in data["manifest"]["sliceBindings"]
            if row["assuranceSliceId"] == "MOD-SYS-LISTEN"
        )["successorAuthorityRef"] = LISTENING_SUMMARY_ID

    def listening_legacy_source_authority(data: dict[str, Any]) -> None:
        data["manifest"]["authoritativeSources"][
            "sysListeningStreamAuthority"
        ] = LISTENING_SUMMARY_PATH

    def listening_legacy_lineage_overlay(data: dict[str, Any]) -> None:
        data["lineage"]["currentSuccessorOverlays"] = {
            "sysListeningStreamAuthority": {"contractId": LISTENING_SUMMARY_ID}
        }

    return [
        ("missing-one-of-17", "SLICE_BINDING_COUNT", pop_slice),
        ("source-hash-drift", "SOURCE_HASH_TARGET", source_hash),
        ("source-count-drift", "SOURCE_COUNT_TARGET", source_count),
        ("source-register-drift", "SOURCE_FAMILY_RECOMPUTE", source_register),
        ("retired-became-active", "RETIRED_BECAME_ACTIVE", retired_active),
        ("primary-related-downgrade", "PRIMARY_DOWNGRADE", primary_downgrade),
        ("missing-transition", "MODERN_PREDECESSOR_BODY_COUNTS", transition_missing),
        ("missing-schema", "RESPONSE_SCHEMA_MISSING", schema_missing),
        ("missing-write", "MODERN_COMMAND_WRITE_TRANSITION", write_missing),
        ("missing-golden", "GOLDEN_BINDING_MISSING", golden_missing),
        ("table-owner-mismatch", "MODERN_TABLE_OWNER", table_owner),
        ("thirteenth-modern-table-missing", "MODERN_PREDECESSOR_CENTRAL_TABLE_SET", thirteenth_table_missing),
        ("migration-range-mismatch", "PLATFORM_MIGRATION_AUTHORITY", migration),
        ("ia-pep-mismatch", "IA_PEP_LAYERS", ia),
        ("pep-operation-mismatch", "PEP_OPERATION_DRIFT", pep),
        ("duty-capability-mismatch", "PEP_DUTY_MISMATCH", duty),
        ("boundary-escalation", "BOUNDARY_ESCALATION", boundary),
        ("prompt-predecessor-regression", "PROMPT_ASSURANCE_MARKER", prompt),
        ("current-pointer-regression", "CURRENT_POINTER_REGRESSION", pointer),
        ("semantic-write-drift", "MODERN_SEMANTIC_DRIFT", semantic),
        ("g3-token-drift", "G3_TOKEN", token),
        ("listening-stream-missing", "LISTENING_STREAM_SET", listening_stream_missing),
        ("listening-seal-tampered", "LISTENING_SUMMARY_SEAL", listening_seal_tampered),
        ("listening-summary-stale-manifest-pin", "LISTENING_MANIFEST_SUMMARY_HASH", listening_manifest_pin_stale),
        ("listening-shared-schema", "LISTENING_STREAM_DISTINCT:databaseSchema", listening_shared_schema),
        ("listening-cross-stream-local-fk", "LISTENING_TABLE_BOUNDARY", listening_cross_stream_fk),
        ("listening-raw-response-public-event", "LISTENING_PUBLIC_EVENT_SET", listening_raw_public_event),
        ("listening-both-service-binding-missing", "LISTENING_SERVICE_SET", listening_service_missing),
        ("listening-single-v287-restored", "LISTENING_MIGRATION_RESERVATION", listening_v287),
        ("listening-admin-reentry-query-missing", "LISTENING_ADMIN_SURVEY_REENTRY_QUERY", listening_admin_reentry_missing),
        ("listening-survey-revise-missing", "LISTENING_OPERATION_BOUNDARY", listening_survey_revise_missing),
        ("listening-survey-revise-cas-widened", "LISTENING_SURVEY_REVISE_CAS_CONTRACT", listening_survey_revise_cas_widened),
        ("listening-owner-local-handler-set-missing", "LISTENING_OWNER_LOCAL_HANDLER_SET", listening_erasure_handler_missing),
        ("listening-erasure-request-producer-missing", "LISTENING_OWNER_LOCAL_HANDLER_SET", listening_erasure_request_missing),
        ("listening-erasure-request-status-widened", "LISTENING_OWNER_LOCAL_ERASURE_REQUEST_HANDLER", listening_erasure_request_status_widened),
        ("listening-internal-message-handler-missing", "LISTENING_OWNER_LOCAL_HANDLER_SET", listening_internal_message_handler_missing),
        ("listening-internal-message-handler-non-atomic", "LISTENING_INTERNAL_MESSAGE_HANDLER:ListeningCohortPackageReady.v1", listening_internal_message_handler_non_atomic),
        ("listening-internal-message-handler-cross-owner", "LISTENING_INTERNAL_MESSAGE_HANDLER:ListeningAdmissionInstallReceipt.v1", listening_internal_message_handler_cross_owner),
        ("listening-erasure-owner-port-missing", "LISTENING_OWNER_PORT_SET", listening_erasure_owner_port_missing),
        ("listening-legacy-slice-authority-field", "LISTENING_MANIFEST_REVERSE_AUTHORITY_FIELDS", listening_legacy_slice_authority),
        ("listening-legacy-authoritative-source", "LISTENING_PRIMARY_SUMMARY_SOURCE_FORBIDDEN", listening_legacy_source_authority),
        ("listening-legacy-lineage-overlay", "LINEAGE_LISTENING_REVERSE_AUTHORITY_FIELDS", listening_legacy_lineage_overlay),
    ]


def run_self_tests(base: dict[str, Any]) -> tuple[list[dict[str, Any]], list[str]]:
    baseline_errors = validate(base, verify_pin=True)
    results: list[dict[str, Any]] = []
    errors: list[str] = []
    if baseline_errors:
        return results, ["SELFTEST_BASELINE_INVALID"] + baseline_errors
    for name, expected, mutate in mutations():
        candidate = copy.deepcopy(base)
        mutate(candidate)
        actual = validate(candidate, verify_pin=False)
        passed = any(expected in error for error in actual)
        results.append({"name": name, "status": "PASS" if passed else "FAIL", "expected": expected, "errorCount": len(actual)})
        if not passed:
            errors.append(f"SELFTEST_MUTATION_ACCEPTED:{name}:expected={expected}:actual={actual[:5]}")
    return results, errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--compact", action="store_true")
    args = parser.parse_args()
    data = load_bundle()
    errors = validate(data, verify_pin=True)
    self_tests: list[dict[str, Any]] = []
    if args.self_test and not errors:
        self_tests, self_errors = run_self_tests(data)
        errors.extend(self_errors)
    payload = {
        "validator": "SYS_EXACT_BUSINESS_START_PRIMARY_V1",
        "status": "PASS" if not errors else "FAIL",
        "scope": "17_SYS_EXACT_BUSINESS_G3_DESIGN_SLICES_NOT_GLOBAL_GATE",
        "counts": {
            "ownedSlices": 17,
            "sourceFamilies": 14,
            "baseContracts": 84,
            "baseRuntimeOperations": 77,
            "publicPepBindings": 77,
            "entryQueries": 13,
            "modernCapabilities": len(MODERN),
            "modernOperations": EXPECTED_MODERN_OPERATION_COUNT,
            "modernInternalOperations": sum(
                len(value) for value in MODERN_INTERNAL_OPERATION_IDS.values()
            ),
            "modernTransitions": EXPECTED_MODERN_TRANSITION_COUNT,
            "modernEvents": EXPECTED_MODERN_EVENT_COUNT,
            "modernTables": EXPECTED_MODERN_TABLE_COUNT,
            "listeningStreams": 4,
            "modernAuthorizationBindings": 9,
            "goldenScenarios": 60,
            "selfTests": len(self_tests),
        },
        "digests": {
            "successor": sha_bytes(data["_raw"].get(PATHS["manifest"], b"")),
            "lineage": sha_bytes(data["_raw"].get(PATHS["lineage"], b"")),
            "pin": sha_bytes(data["_raw"].get(PATHS["pin"], b"")),
        },
        "selfTests": self_tests if args.self_test else None,
        "errors": errors,
    }
    print(json.dumps(payload, ensure_ascii=False, indent=None if args.compact else 2, separators=(",", ":") if args.compact else None))
    return 0 if not errors else 1


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
