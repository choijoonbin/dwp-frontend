#!/usr/bin/env node
'use strict';

// Independent Node.js oracle for the 17-slice HRIS-SYS exact-business START
// package.  It neither imports nor invokes the Python validator and never
// treats a PASS as global code-gate, implementation, or production approval.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {ensureGuardedOrRelaunch} = require('./modern_successor_reader_guard.cjs');

ensureGuardedOrRelaunch(__filename);

const ROOT = path.resolve(__dirname, '..');
const LISTENING_SUMMARY_ID = 'dwp.hris.sys.listening.stream-authority-successor.v1';
const LISTENING_SUMMARY_PATH = 'coding-readiness/sys-listening-stream-authority-successor.v1.json';
const LISTENING_STREAM_KEYS = new Set([
  'platform-hris-configuration',
  'platform-hris-listening-protected',
  'platform-hris-insights',
  'auth-hris-participation-issuer'
]);
const LISTENING_BACKEND_PROFILES = new Set([
  'G3-SYS-LISTEN-CONFIGURATION-BE',
  'G3-SYS-LISTEN-PROTECTED-BE',
  'G3-SYS-LISTEN-INSIGHTS-BE',
  'G3-SYS-LISTEN-ISSUER-BE'
]);
const LISTENING_FRONTEND_PROFILE = 'G3-SYS-LISTEN-FE';
const LISTENING_OWNER_PORTS = new Set([
  'configuration.querySurveys',
  'configuration.createSurvey',
  'configuration.reviseSurvey',
  'configuration.publishSurveyOrchestrate',
  'configuration.closeSurveyOrchestrate',
  'configuration.createAction',
  'configuration.completeAction',
  'protected.listActiveAdmissions',
  'protected.installAdmission',
  'protected.closeAdmission',
  'protected.submitResponse',
  'protected.requestErasure',
  'protected.buildCohortPackage',
  'insights.ingestCohortPackage',
  'insights.queryCohortResults',
  'issuer.issueParticipationEnvelope',
  'issuer.resolveParticipationStatus',
  'issuer.revokeParticipationEnvelope'
]);
const LISTENING_OWNER_LOCAL_ERASURE_REQUEST_HANDLER = 'internal.listening.protected.erasure.request';
const LISTENING_OWNER_LOCAL_ERASURE_PROCESS_HANDLER = 'internal.listening.protected.erasure.process';
const LISTENING_INTERNAL_HANDLER_BY_MESSAGE = new Map([
  ['ListeningAdmissionInstallRequested.v1', ['internal.listening.protected.admission-install.consume', 'platform-hris-listening-protected', 'sys_hris_listening_protected_receipts', 'sys_hris_listening_protected_outbox']],
  ['ListeningAdmissionInstallReceipt.v1', ['internal.listening.configuration.admission-install-receipt.consume', 'platform-hris-configuration', 'sys_hris_listening_operation_receipts', 'sys_hris_listening_domain_outbox']],
  ['ListeningAdmissionCloseRequested.v1', ['internal.listening.protected.admission-close.consume', 'platform-hris-listening-protected', 'sys_hris_listening_protected_receipts', 'sys_hris_listening_protected_outbox']],
  ['ListeningAdmissionCloseReceipt.v1', ['internal.listening.configuration.admission-close-receipt.consume', 'platform-hris-configuration', 'sys_hris_listening_operation_receipts', 'sys_hris_listening_domain_outbox']],
  ['ListeningCohortPackageReady.v1', ['internal.listening.insights.cohort-package.consume', 'platform-hris-insights', 'sys_hris_listening_insights_inbox', 'sys_hris_listening_insights_outbox']],
  ['ListeningCohortProjectionReceipt.v1', ['internal.listening.protected.cohort-projection-receipt.consume', 'platform-hris-listening-protected', 'sys_hris_listening_protected_receipts', 'sys_hris_listening_protected_outbox']]
]);
const LISTENING_OWNER_LOCAL_HANDLER_IDS = new Set([
  LISTENING_OWNER_LOCAL_ERASURE_REQUEST_HANDLER,
  LISTENING_OWNER_LOCAL_ERASURE_PROCESS_HANDLER,
  ...[...LISTENING_INTERNAL_HANDLER_BY_MESSAGE.values()].map((row) => row[0])
]);
const HISTORICAL_SYS_MODERN_BODY_SHA256 = 'cb770ad54b7a3c58eab3aa05ba5f88239941223e7645016dab071a5598bc584d';
const EXACT_ASSURANCE = [
  ...Array.from({length: 13}, (_, i) => `TFR-SYS-${String(i + 1).padStart(3, '0')}`),
  'BASE-TFR-HRM-015', 'MOD-SYS-ANALYTICS', 'MOD-SYS-LISTEN', 'MOD-SYS-AI'
];
const EXACT_G3 = [
  ...Array.from({length: 13}, (_, i) => `BASE-TFR-SYS-${String(i + 1).padStart(3, '0')}`),
  'BASE-TFR-HRM-015', 'MOD-SYS-ANALYTICS', 'MOD-SYS-LISTEN', 'MOD-SYS-AI'
];
const SOURCE = {
  'TFR-SYS-001': ['a0dae833740f05696a27d3eea8c3212c8547ed475e8e4c7e87bffa93c71d060c', 16, 'DEC-SYS-009', 'REUSE', 'RELATED_REUSE_ALLOWED', 'DWP_AUDIT_GOVERNANCE'],
  'TFR-SYS-002': ['5b4a9d774a961d56f2225749f6981122106d3b863b8a2d601034313758559d6f', 5, 'DEC-SYS-012', 'REUSE', 'PRIMARY_WITH_RELATED_OWNER_DEEP_LINK', 'DWP_OPERATIONS_PLATFORM'],
  'TFR-SYS-003': ['ef4581a0a39a65591d10d96a2a3663fdafaa3dda9daebb239a9720e99a5f23a1', 10, 'DEC-SYS-006', 'REUSE', 'RELATED_REUSE_ALLOWED', 'DWP_APPROVAL_PLATFORM'],
  'TFR-SYS-004': ['9be834804aff393b5f2618b1b41162af5b13827e1d61527b57e8cb59f0971a26', 39, 'DEC-SYS-001', 'REUSE', 'PRIMARY_OWNED_STATEFUL', 'DWP_AUTH_PLATFORM'],
  'TFR-SYS-005': ['2f7300f5a1141bd786ffad12d6d5504f9478cbf1d18e76b60b1fc0fb9eb73421', 12, 'DEC-SYS-007', 'REUSE', 'RELATED_REUSE_ALLOWED', 'DWP_NOTIFICATION_PLATFORM'],
  'TFR-SYS-006': ['29d8eb318606a7c20946d21941bc0e55cd17a631836ad02434322f9d2c3ca11b', 10, 'DEC-SYS-004', 'REBUILD', 'PRIMARY_OWNED_STATEFUL', 'DWP_PLATFORM_AUTOMATION'],
  'TFR-SYS-007': ['c36c35b9ff77e9dfd8149cde55970c364febd07af1ee3c6f9b89d0390330974d', 37, 'DEC-SYS-003', 'CONFIGURE', 'PRIMARY_OWNED_STATEFUL', 'HRIS_CONFIGURATION'],
  'TFR-SYS-008': ['8fd5277d423ee42f21b1cb551b06aa2ff73fa058352ba4e8433f0a6eebd7f6ce', 19, 'DEC-SYS-005', 'REBUILD', 'PRIMARY_OWNED_STATEFUL', 'DWP_PLATFORM_INTEGRATION'],
  'TFR-SYS-009': ['67e1fb1215135de465c152070478ff652b2a0bbab1996b6b1afd1ec4f0dd6172', 2, 'DEC-SYS-011', 'REBUILD', 'PRIMARY_OWNED_STATEFUL', 'DWP_FILE_PLATFORM'],
  'TFR-SYS-010': ['f9729b2bdf8575a425ae650f0e947c102649a11f5eb1fc9936d9aba303d3a525', 9, 'DEC-SYS-010', 'REBUILD', 'RELATED_REUSE_ALLOWED', 'DWP_DATA_GOVERNANCE'],
  'TFR-SYS-011': ['43784624aa57a83cc35a35803e95230f72539f616c493ec6b0381b017925cbe7', 19, 'DEC-SYS-002', 'REUSE', 'RELATED_REUSE_ALLOWED', 'DWP_TENANT_ENTERPRISE'],
  'TFR-SYS-012': ['b9eaff79e11eb4a6439f999addb6ce4c2ff22a2913b8230af976a475189818e6', 7, 'DEC-SYS-008', 'REBUILD', 'PRIMARY_WITH_RELATED_COMPOSITION', 'HRIS_SHELL_EXPERIENCE'],
  'TFR-SYS-013': ['9b3e616b881fc37c5553f5b44bab2a703d9e04a0f03466f925b1a4076ee5a77a', 4, 'DEC-SYS-013', 'RETIRE', 'RETIRED_DECISION_NO_CODE', 'DWP_SHARED_PLATFORM'],
  'BASE-TFR-HRM-015': ['51ab756e1c54caa3310e888ef454d37446d9e277b4832090f8600ff7bd1e2e1d', 6, 'HRM-DEC-010', 'EXTENSION', 'PRIMARY_SIGNED_EXTENSION_OWNER', 'HRIS_TENANT_EXTENSION']
};
const MODERN = {
  'HRIS.MODERN.PEOPLE_ANALYTICS': {slice: 'MOD-SYS-ANALYTICS', ops: 7, internalOps: 0, transitions: 5, events: 5, tables: 4, tests: 3, context: 'DWP_PLATFORM_HRIS_INSIGHTS', group: 'MODERN_PEOPLE_ANALYTICS'},
  'HRIS.MODERN.EMPLOYEE_LISTENING': {slice: 'MOD-SYS-LISTEN', ops: 10, internalOps: 0, transitions: 0, events: 7, tables: 24, tests: 3, context: `CANONICAL_FIVE_PRIMARY_DERIVED_SUMMARY_VERIFIED:${LISTENING_SUMMARY_ID}`, group: 'LISTENING_SUCCESSOR_FOUR_STREAM_GROUPS'},
  'HRIS.MODERN.GOVERNED_AI': {slice: 'MOD-SYS-AI', ops: 7, internalOps: 1, transitions: 7, events: 7, tables: 5, tests: 3, context: 'DWP_PLATFORM_HRIS_CONFIGURATION', group: 'MODERN_GOVERNED_AI'}
};
const MODERN_OPERATIONS = {
  'HRIS.MODERN.PEOPLE_ANALYTICS': new Set(['modern.analytics.metrics.query', 'modern.analytics.metric.create', 'modern.analytics.metric.validate', 'modern.analytics.metric.publish', 'modern.analytics.cohorts.query', 'modern.analytics.export.create', 'modern.analytics.metric.retire']),
  'HRIS.MODERN.EMPLOYEE_LISTENING': new Set(['modern.listening.active.query', 'modern.listening.response.submit', 'modern.listening.surveys.query', 'modern.listening.survey.create', 'modern.listening.survey.revise', 'modern.listening.survey.publish', 'modern.listening.survey.close', 'modern.listening.cohorts.query', 'modern.listening.action.create', 'modern.listening.action.complete']),
  'HRIS.MODERN.GOVERNED_AI': new Set(['modern.ai.assist.create', 'modern.ai.policies.query', 'modern.ai.policy.create', 'modern.ai.policy.evaluate', 'modern.ai.policy.publish', 'modern.ai.kill.switch', 'modern.ai.policy.retire'])
};
const MODERN_EVENTS = {
  'HRIS.MODERN.PEOPLE_ANALYTICS': new Set(['PeopleMetricCreated.v2', 'PeopleMetricValidated.v2', 'PeopleMetricPublished.v2', 'PeopleAnalyticsExportRequested.v2', 'PeopleMetricRetired.v2']),
  'HRIS.MODERN.EMPLOYEE_LISTENING': new Set(['EmployeeListeningSurveyCreated.v3', 'EmployeeListeningSurveyRevised.v3', 'EmployeeListeningSurveyPublished.v3', 'EmployeeListeningSurveyClosed.v3', 'EmployeeListeningActionCreated.v3', 'EmployeeListeningActionCompleted.v3', 'EmployeeListeningCohortProjectionPublished.v1']),
  'HRIS.MODERN.GOVERNED_AI': new Set(['GovernedAiAssistanceProduced.v2', 'GovernedAiPolicyCreated.v2', 'GovernedAiPolicyEvaluationRequested.v2', 'GovernedAiPolicyPublished.v2', 'GovernedAiPolicySuspended.v2', 'GovernedAiPolicyRetired.v2', 'GovernedAiPolicyEvaluationCompleted.v2'])
};
const MODERN_INTERNAL_OPERATIONS = {
  'HRIS.MODERN.PEOPLE_ANALYTICS': new Set(),
  'HRIS.MODERN.EMPLOYEE_LISTENING': new Set(),
  'HRIS.MODERN.GOVERNED_AI': new Set(['internal.ai.policy-evaluation.complete'])
};
const MODERN_TRANSITIONS = {
  'HRIS.MODERN.PEOPLE_ANALYTICS': new Set(Array.from({length: 5}, (_, i) => `MOD-SYS-ANALYTICS-TR-${String(i + 1).padStart(3, '0')}`)),
  'HRIS.MODERN.EMPLOYEE_LISTENING': new Set(),
  'HRIS.MODERN.GOVERNED_AI': new Set([...Array.from({length: 6}, (_, i) => `MOD-SYS-AI-TR-${String(i + 1).padStart(3, '0')}`), 'MOD-SYS-AI-TR-EVALUATION-ACK-V2'])
};
const EXPECTED_MODERN_OPERATION_COUNT = Object.values(MODERN_OPERATIONS)
  .reduce((total, values) => total + values.size, 0);
const EXPECTED_MODERN_EVENT_COUNT = Object.values(MODERN_EVENTS)
  .reduce((total, values) => total + values.size, 0);
const EXPECTED_MODERN_TRANSITION_COUNT = Object.values(MODERN_TRANSITIONS)
  .reduce((total, values) => total + values.size, 0);
const EXPECTED_MODERN_INTERNAL_OPERATION_COUNT = Object.values(MODERN_INTERNAL_OPERATIONS)
  .reduce((total, values) => total + values.size, 0);
const EXPECTED_MODERN_TABLE_COUNT = Object.values(MODERN)
  .reduce((total, metadata) => total + metadata.tables, 0);
const MODERN_ENTRY_QUERIES = {
  'HRIS.MODERN.PEOPLE_ANALYTICS': new Set(),
  'HRIS.MODERN.EMPLOYEE_LISTENING': new Set(['IAQ-033', 'IAQ-065']),
  'HRIS.MODERN.GOVERNED_AI': new Set(['IAQ-032', 'IAQ-066'])
};
const MODERN_AUTH_BINDINGS = {
  'HRIS.MODERN.PEOPLE_ANALYTICS': new Set(['MOD-AUTH-043', 'MOD-AUTH-044', 'MOD-AUTH-045']),
  'HRIS.MODERN.EMPLOYEE_LISTENING': new Set(['MOD-AUTH-034', 'MOD-AUTH-035', 'MOD-AUTH-036']),
  'HRIS.MODERN.GOVERNED_AI': new Set(['MOD-AUTH-046', 'MOD-AUTH-047', 'MOD-AUTH-048'])
};
const MODERN_AUTH = {
  'HRIS.MODERN.PEOPLE_ANALYTICS': new Set(['hcm.analytics.metric.view', 'hcm.analytics.metric.manage', 'hcm.analytics.export']),
  'HRIS.MODERN.EMPLOYEE_LISTENING': new Set(['hcm.listening.respond', 'hcm.listening.manage', 'hcm.listening.cohort.view']),
  'HRIS.MODERN.GOVERNED_AI': new Set(['hcm.ai.assist.use', 'hcm.ai.policy.manage', 'hcm.ai.kill-switch.execute'])
};
const TABLE_GROUPS = {
  AUTH_PRODUCT_ACCESS: ['sys_product_access_package_catalog', 'sys_product_access_package_roles', 'sys_product_access_package_conflicts', 'com_product_access_package_assignments', 'com_product_access_package_policy_refs', 'com_product_access_package_projection_status', 'com_product_access_command_receipts'],
  PLATFORM_CONFIGURATION: ['sys_hris_config_sets', 'sys_hris_config_versions', 'sys_hris_config_evaluations'],
  PLATFORM_AUTOMATION: ['sys_automation_definitions', 'sys_automation_versions', 'sys_automation_schedules', 'sys_automation_runs', 'sys_automation_run_attempts', 'sys_automation_run_items', 'sys_automation_item_attempts', 'sys_automation_run_checkpoints'],
  PLATFORM_CONNECTOR: ['sys_connector_definitions', 'sys_connector_mapping_versions', 'sys_connector_executions', 'sys_connector_execution_items', 'sys_connector_execution_attempts'],
  PLATFORM_EXPERIENCE: ['sys_hris_home_contributions', 'sys_hris_explorer_preferences', 'sys_hris_explorer_favorites', 'sys_hris_explorer_recents'],
  PLATFORM_CONTROLLED_TRANSFER: ['sys_controlled_file_transfers'],
  PLATFORM_OPERATIONS: ['sys_operational_exception_projections'],
  PLATFORM_EXTENSION: ['sys_extension_pack_versions', 'sys_tenant_extension_installations'],
  PLATFORM_SHARED_COMMAND_RECEIPT: ['sys_hris_command_receipts'],
  LISTENING_CONFIGURATION: ['sys_hris_listening_surveys', 'sys_hris_listening_survey_versions', 'sys_hris_listening_actions', 'sys_hris_listening_operation_receipts', 'sys_hris_listening_domain_outbox'],
  LISTENING_PROTECTED_ADMISSION: ['sys_hris_listening_admission_versions', 'sys_hris_listening_responses', 'sys_hris_listening_answer_values', 'sys_hris_listening_token_consumptions', 'sys_hris_listening_protected_receipts', 'sys_hris_listening_erasure_tickets', 'sys_hris_listening_cohort_budgets', 'sys_hris_listening_cohort_packages', 'sys_hris_listening_protected_outbox'],
  LISTENING_INSIGHTS: ['sys_hris_listening_cohort_projections', 'sys_hris_listening_lineage_receipts', 'sys_hris_listening_export_receipts', 'sys_hris_listening_insights_inbox', 'sys_hris_listening_insights_outbox'],
  LISTENING_PARTICIPATION_ISSUER: ['sys_hris_listening_eligibility_versions', 'sys_hris_listening_token_issuances', 'sys_hris_listening_token_revocations', 'sys_hris_listening_issuer_receipts', 'sys_hris_listening_issuer_outbox'],
  MODERN_PEOPLE_ANALYTICS: ['sys_hris_metric_definitions', 'sys_hris_metric_versions', 'sys_hris_metric_projections', 'sys_hris_analytics_export_receipts'],
  MODERN_GOVERNED_AI: ['sys_hris_ai_use_policies', 'sys_hris_ai_policy_versions', 'sys_hris_ai_evaluation_receipts', 'sys_hris_ai_provenance_receipts', 'sys_hris_ai_evaluation_requests']
};
const AUTH_TABLES = new Set(TABLE_GROUPS.AUTH_PRODUCT_ACCESS);
const PLATFORM_TABLES = new Set([
  ...TABLE_GROUPS.PLATFORM_CONFIGURATION, ...TABLE_GROUPS.PLATFORM_AUTOMATION,
  ...TABLE_GROUPS.PLATFORM_CONNECTOR, ...TABLE_GROUPS.PLATFORM_EXPERIENCE,
  ...TABLE_GROUPS.PLATFORM_CONTROLLED_TRANSFER, ...TABLE_GROUPS.PLATFORM_OPERATIONS,
  ...TABLE_GROUPS.PLATFORM_EXTENSION, ...TABLE_GROUPS.PLATFORM_SHARED_COMMAND_RECEIPT
]);
const MODERN_TABLES = new Set([
  ...TABLE_GROUPS.LISTENING_CONFIGURATION,
  ...TABLE_GROUPS.LISTENING_PROTECTED_ADMISSION,
  ...TABLE_GROUPS.LISTENING_INSIGHTS,
  ...TABLE_GROUPS.LISTENING_PARTICIPATION_ISSUER,
  ...TABLE_GROUPS.MODERN_PEOPLE_ANALYTICS,
  ...TABLE_GROUPS.MODERN_GOVERNED_AI
]);
const LISTENING_TABLES = new Set([
  ...TABLE_GROUPS.LISTENING_CONFIGURATION,
  ...TABLE_GROUPS.LISTENING_PROTECTED_ADMISSION,
  ...TABLE_GROUPS.LISTENING_INSIGHTS,
  ...TABLE_GROUPS.LISTENING_PARTICIPATION_ISSUER
]);
const LEGACY_LISTENING_TABLES = new Set(['sys_hris_listening_surveys', 'sys_hris_listening_responses', 'sys_hris_listening_cohort_results', 'sys_hris_listening_actions']);
const LEGACY_LISTENING_EVENTS = new Set(['EmployeeListeningResponseSubmitted.v2', 'EmployeeListeningSurveyCreated.v2', 'EmployeeListeningSurveyPublished.v2', 'EmployeeListeningSurveyClosed.v2', 'EmployeeListeningActionCreated.v2', 'EmployeeListeningActionCompleted.v2']);
const LEGACY_LISTENING_TRANSITIONS = new Set(Array.from({length: 6}, (_, i) => `MOD-SYS-LISTEN-TR-${String(i + 1).padStart(3, '0')}`));
const LEGACY_LISTENING_OPERATIONS = new Set(
  [...MODERN_OPERATIONS['HRIS.MODERN.EMPLOYEE_LISTENING']]
    .filter((operationId) => !['modern.listening.surveys.query', 'modern.listening.survey.revise'].includes(operationId))
);
const LEGACY_MODERN_TABLES = new Set([...LEGACY_LISTENING_TABLES, ...TABLE_GROUPS.MODERN_PEOPLE_ANALYTICS, ...TABLE_GROUPS.MODERN_GOVERNED_AI]);
const IA_IDS = new Set(['IAQ-032', 'IAQ-033', 'IAQ-035', 'IAQ-052', 'IAQ-057', 'IAQ-058', 'IAQ-059', 'IAQ-060', 'IAQ-061', 'IAQ-062', 'IAQ-063', 'IAQ-065', 'IAQ-066']);
const PEP_LAYERS = ['GATEWAY_APP_ENTITLEMENT', 'OWNER_API_OPERATION', 'RESOURCE_POPULATION', 'REPOSITORY_TENANT_PREDICATE', 'FIELD_PROJECTION', 'PURPOSE_POLICY', 'AUDIT_DECISION'];
const G4 = new Set(['authorization-negative', 'feature-flag-event-forward-correction', 'idempotency-cas', 'migration-clean-upgrade-rls-backfill', 'runbook-rollback-forward-correction', 'telemetry-alert', 'tenant-isolation', 'worker-crash-replay']);
const ACTIVATION = new Set(['ACT-G6-ERP', 'ACT-G6-BANK', 'ACT-G6-TAX-INSURANCE', 'ACT-G6-CLOCK', 'ACT-G6-CUSTOM-LEGACY', 'ACT-G6-PROD-SECRETS']);

const PATHS = {
  manifest: 'coding-readiness/sys-exact-business-start-successor.v1.json',
  lineage: 'coding-readiness/sys-exact-business-successor-lineage.v1.json',
  pin: 'coding-readiness/sys-exact-business-start-pin.v1.json',
  targets: 'coding-readiness/target-family-resolution-register.csv',
  sysSource: 'session-registers/hris-sys-source-coverage.csv',
  hrmSource: 'session-registers/hris-hrm-source-coverage.csv',
  sysDecisions: 'session-evidence/sys/g1-decision-log.csv',
  hrmDecisions: 'session-evidence/hrm/g1-decision-log.csv',
  catalog: 'session-evidence/sys/g2-contract-catalog.csv',
  transport: 'session-evidence/sys/g2-transport-schemas.v1.json',
  states: 'session-evidence/sys/g2-state-machines.md',
  implementation: 'session-evidence/sys/g2-implementation-contract.v2.md',
  currentValidator: 'session-evidence/sys/validate_sys_readiness.v2.py',
  implementationPredecessor: 'session-evidence/sys/g2-implementation-contract.md',
  validatorPredecessor: 'session-evidence/sys/validate_sys_readiness.py',
  golden: 'session-evidence/sys/g2-golden-scenarios.csv',
  authSql: 'session-evidence/sys/g2-auth-physical-schema.sql',
  platformSql: 'session-evidence/sys/g2-platform-physical-schema.sql',
  modernBody: 'session-evidence/sys/g3-modern-capability-contracts.v1.json',
  g3: 'coding-readiness/g3-slice-code-go-register.csv',
  pep: 'coding-readiness/api-pep-binding-register.csv',
  tsr: 'coding-readiness/transport-schema-resolution-register.csv',
  ia: 'coding-readiness/ia-entry-query-api-contract-register.csv',
  iaSchemas: 'coding-readiness/ia-entry-query-projection-schemas.v1.json',
  primary: 'coding-readiness/g3-contract-primary-ownership-register.csv',
  modernCoding: 'coding-readiness/modern-capability-coding-contract-register.csv',
  modernAuth: 'coding-readiness/modern-capability-authorization-register.csv',
  modernDelivery: 'coding-readiness/modern-capability-delivery-register.csv',
  modernTrace: 'coding-readiness/modern-capability-trace-register.csv',
  modernExact: 'coding-readiness/modern-capability-exact-schema-contracts.v1.json',
  modernEvents: 'coding-readiness/modern-capability-event-payload-contracts.v1.json',
  modernSemantic: 'coding-readiness/modern-capability-semantic-bindings.v1.json',
  modernIdentity: 'coding-readiness/modern-capability-public-identity-registry.v1.json',
  listeningSummary: LISTENING_SUMMARY_PATH,
  duties: 'hris-atomic-duty-matrix.csv', packages: 'hris-permission-group-matrix.csv', sod: 'hris-sod-rule-matrix.csv',
  physical: 'coding-readiness/physical-owner-prefix-register.csv', files: 'coding-readiness/g3-file-allocation-register.csv',
  migrations: 'g0/migration-allocation-register.csv', ownership: 'g0/file-ownership-register.csv',
  activation: 'coding-readiness/activation-gate-register.csv', prompt: 'session-prompts/05-cloudhr-sys-session.md',
  shared: 'coding-readiness/shared-contract-catalog.csv', servicePep: 'coding-readiness/service-api-auth-binding-register.csv',
  cross: 'coding-readiness/cross-module-contract-register.csv', platform: 'coding-readiness/platform-integration-binding-register.csv',
  canonical4: 'coding-readiness/module-exact-business-start-canonical.v1.json',
  primaryValidator: 'coding-readiness/validate_sys_exact_business_start.py',
  independentValidator: 'coding-readiness/audit_sys_exact_business_start.cjs'
};
const CSV_KEYS = new Set(['targets', 'sysSource', 'hrmSource', 'sysDecisions', 'hrmDecisions', 'catalog', 'golden', 'g3', 'pep', 'tsr', 'ia', 'primary', 'modernCoding', 'modernAuth', 'modernDelivery', 'modernTrace', 'duties', 'packages', 'sod', 'physical', 'files', 'migrations', 'ownership', 'activation', 'shared', 'servicePep', 'cross', 'platform']);
const JSON_KEYS = new Set(['manifest', 'lineage', 'pin', 'transport', 'modernBody', 'iaSchemas', 'modernExact', 'modernEvents', 'modernSemantic', 'modernIdentity', 'listeningSummary', 'canonical4']);

function sha(buffer) { return crypto.createHash('sha256').update(buffer).digest('hex'); }
function split(value) { return String(value || '').split('|').filter((item) => item && item !== 'NONE'); }
function setEq(left, right) { return left.size === right.size && [...left].every((item) => right.has(item)); }
function subset(left, right) { return [...left].every((item) => right.has(item)); }
function parseCsv(text) {
  const matrix = []; let row = []; let field = ''; let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field.replace(/\r$/, '')); matrix.push(row); row = []; field = ''; }
    else field += ch;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, '')); matrix.push(row); }
  const rows = matrix.filter((item) => item.some((fieldValue) => fieldValue !== ''));
  const header = rows.shift() || [];
  return rows.map((values, index) => {
    if (values.length !== header.length) throw new Error(`CSV_COLUMN_COUNT:${index + 2}`);
    return Object.fromEntries(header.map((name, i) => [name.replace(/^\uFEFF/, ''), values[i]]));
  });
}
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function registryDigest(registry) {
  const payload = Object.fromEntries(Object.entries(registry).filter(([key]) => key !== 'sealedPayloadSha256'));
  return sha(Buffer.from(stable(payload), 'utf8'));
}
function loadData() {
  const data = {_raw: {}};
  for (const [key, relative] of Object.entries(PATHS)) {
    const absolute = path.join(ROOT, relative);
    if (!fs.existsSync(absolute)) { data[key] = null; continue; }
    const raw = fs.readFileSync(absolute); data._raw[relative] = raw;
    if (CSV_KEYS.has(key)) data[key] = parseCsv(raw.toString('utf8'));
    else if (JSON_KEYS.has(key)) data[key] = JSON.parse(raw.toString('utf8'));
    else data[key] = raw.toString('utf8');
  }
  return data;
}
function by(rows, key) { return new Map((rows || []).map((row) => [row[key], row])); }
function ptr(doc, ref) {
  if (!ref || typeof ref !== 'object' || typeof ref.$ref !== 'string' || !ref.$ref.startsWith('#/')) return undefined;
  return ref.$ref.slice(2).split('/').reduce((value, raw) => value && value[raw.replace(/~1/g, '/').replace(/~0/g, '~')], doc);
}
function sqlTables(text) { return new Set([...text.matchAll(/^\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\s*\(/gim)].map((match) => match[1])); }
function closedObjects(value, errors, where = '#') {
  if (Array.isArray(value)) value.forEach((item, i) => closedObjects(item, errors, `${where}/${i}`));
  else if (value && typeof value === 'object') {
    if (value.type === 'object' && value.additionalProperties !== false) errors.push(`SCHEMA_OPEN:${where}`);
    Object.entries(value).forEach(([key, item]) => closedObjects(item, errors, `${where}/${key}`));
  }
}

function validateListeningSummary(data, need) {
  const authority = data.listeningSummary || {};
  const expectedCounts = {
    streams: 4,
    ownerServices: 2,
    runtimePurposes: 5,
    publicOperations: MODERN_OPERATIONS['HRIS.MODERN.EMPLOYEE_LISTENING'].size,
    ownerPortOperations: LISTENING_OWNER_PORTS.size,
    ownerLocalHandlers: LISTENING_OWNER_LOCAL_HANDLER_IDS.size,
    plannedTables: LISTENING_TABLES.size,
    canonicalPublicEvents: MODERN_EVENTS['HRIS.MODERN.EMPLOYEE_LISTENING'].size,
    internalPortMessages: 6,
    privateReceiptTypes: 3,
    migrationReservations: 4,
    streamFileAllocationTriples: 4,
    verificationProfiles: 5
  };
  need(authority.contractId === LISTENING_SUMMARY_ID && authority.schemaVersion === 1, 'LISTENING_SUMMARY_ID_VERSION');
  need(authority.status === 'CANONICAL_G3_START_AUTHORITY_NOT_IMPLEMENTED', 'LISTENING_SUMMARY_STATUS');
  need(authority.sealedPayloadSha256 === registryDigest(authority), 'LISTENING_SUMMARY_SEAL');
  need(stable(authority.exactCounts || {}) === stable(expectedCounts), 'LISTENING_SUMMARY_COUNTS');
  need(authority.sessionTopology === 'FIVE_SESSIONS_UNCHANGED_HRM_PER_PAY_TIM_SYS', 'LISTENING_SESSION_TOPOLOGY');
  need(authority.assurance && authority.assurance.runtimeImplemented === false && authority.assurance.productionAuthorized === false && authority.assurance.userJourneyCrud === 'NOT_STARTED_G3_G4' && authority.assurance.realIdentityAndProcessIsolation === 'G6_ONLY_NOT_CLAIMED', 'LISTENING_GATE_BOUNDARY');

  const streams = authority.authorityStreams || [];
  const streamsByKey = by(streams, 'streamKey');
  need(streams.length === 4 && streamsByKey.size === 4 && setEq(new Set(streamsByKey.keys()), LISTENING_STREAM_KEYS), 'LISTENING_STREAM_SET');
  need(setEq(new Set(streams.map((row) => row.ownerService)), new Set(['dwp-platform-server', 'dwp-auth-server'])), 'LISTENING_SERVICE_SET');
  for (const field of ['databaseSchema', 'historyTable', 'migrationLocation', 'migrationPrincipal']) need(new Set(streams.map((row) => row[field])).size === 4, `LISTENING_STREAM_DISTINCT:${field}`);
  need(streams.every((row) => row.crossSchemaForeignKeysAllowed === false && row.foreignLocalIdsAllowed === false && row.foreignRepositoryImportsAllowed === false && row.applicationDdlAllowed === false && row.implementationState === 'NOT_STARTED_G3'), 'LISTENING_STREAM_BOUNDARY');
  const principals = streams.flatMap((row) => row.runtimePrincipals || []);
  need(principals.length === 5 && new Set(principals.map((row) => row.principal)).size === 5 && new Set(principals.map((row) => row.purpose)).size === 5, 'LISTENING_RUNTIME_PURPOSE_SET');

  const tableToStream = new Map();
  for (const [streamKey, group] of [
    ['platform-hris-configuration', 'LISTENING_CONFIGURATION'],
    ['platform-hris-listening-protected', 'LISTENING_PROTECTED_ADMISSION'],
    ['platform-hris-insights', 'LISTENING_INSIGHTS'],
    ['auth-hris-participation-issuer', 'LISTENING_PARTICIPATION_ISSUER']
  ]) for (const tableName of TABLE_GROUPS[group]) tableToStream.set(tableName, streamKey);
  const tables = authority.tableOwnership || [];
  need(tables.length === tableToStream.size && new Set(tables.map((row) => row.tableName)).size === tableToStream.size && setEq(new Set(tables.map((row) => row.tableName)), new Set(tableToStream.keys())), 'LISTENING_TABLE_SET');
  need(tables.every((row) => row.streamKey === tableToStream.get(row.tableName) && row.implementationState === 'NOT_STARTED_G4' && Array.isArray(row.crossSchemaForeignKeys) && row.crossSchemaForeignKeys.length === 0 && Array.isArray(row.foreignLocalIdColumns) && row.foreignLocalIdColumns.length === 0 && (row.localForeignKeys || []).every((fk) => tableToStream.get(fk.targetTable) === row.streamKey)), 'LISTENING_TABLE_BOUNDARY');

  const publicOps = authority.publicOperationBindings || [];
  need(publicOps.length === MODERN_OPERATIONS['HRIS.MODERN.EMPLOYEE_LISTENING'].size && setEq(new Set(publicOps.map((row) => row.operationId)), MODERN_OPERATIONS['HRIS.MODERN.EMPLOYEE_LISTENING']), 'LISTENING_OPERATION_SET');
  need(publicOps.every((row) => LISTENING_STREAM_KEYS.has(row.authoritativeStreamKey) && row.crossDatabaseTransactionClaimAllowed === false && row.foreignLocalIdAllowed === false && row.foreignRepositoryReadAllowed === false && row.implementationState === 'NOT_STARTED_G3'), 'LISTENING_OPERATION_BOUNDARY');
  need((publicOps.find((row) => row.operationId === 'modern.listening.response.submit') || {}).authoritativeStreamKey === 'platform-hris-listening-protected', 'LISTENING_RESPONSE_PROTECTED_OWNER');
  const adminQuery = publicOps.find((row) => row.operationId === 'modern.listening.surveys.query') || {};
  need(adminQuery.publicPath === 'GET /api/platform/v1/admin/hris/listening/surveys' && adminQuery.ownerPortOperation === 'configuration.querySurveys' && stable(adminQuery.requestContract || {}) === stable({surveyId: 'OPTIONAL_EXACT_PUBLIC_UUID', status: 'OPTIONAL_DRAFT_PUBLISHED_CLOSED', period: 'OPTIONAL_FROM_TO_TIMESTAMPTZ_HALF_OPEN', cursor: 'OPTIONAL_SCOPE_BOUND_OPAQUE_CURSOR', limit: 'OPTIONAL_INTEGER_1_200_DEFAULT_50'}) && adminQuery.responseSchemaId === 'EmployeeListeningSurveyAdministrationPage.v1' && adminQuery.recordSchemaId === 'EmployeeListeningSurveyAdministrationRecord.v1', 'LISTENING_ADMIN_SURVEY_REENTRY_QUERY');
  const revise = publicOps.find((row) => row.operationId === 'modern.listening.survey.revise') || {};
  need(revise.publicPath === 'PATCH /api/platform/v1/admin/hris/listening/surveys/{surveyId}' && revise.ownerPortOperation === 'configuration.reviseSurvey' && revise.transactionBoundary === 'CONFIGURATION_DRAFT_CAS_REVISION_TRANSACTION' && revise.requestSchemaId === 'EmployeeListeningSurveyRevisionCommand.v1' && revise.responseSchemaId === 'EmployeeListeningSurveyRevisionResult.v1' && revise.stateContract === 'DRAFT_TO_DRAFT_EXPECTED_AGGREGATE_VERSION_CAS' && revise.serverVersionRule === 'INCREMENT_EXACTLY_ONE_AFTER_STRUCTURED_REVISION', 'LISTENING_SURVEY_REVISE_CAS_CONTRACT');
  const ownerPorts = authority.ownerPortOperations || [];
  need(ownerPorts.length === LISTENING_OWNER_PORTS.size && setEq(new Set(ownerPorts.map((row) => row.ownerPortOperation)), LISTENING_OWNER_PORTS), 'LISTENING_OWNER_PORT_SET');
  const ownerHandlers = authority.ownerLocalHandlers || [];
  const ownerHandlersById = by(ownerHandlers, 'handlerId');
  need(ownerHandlers.length === ownerHandlersById.size && setEq(new Set(ownerHandlersById.keys()), LISTENING_OWNER_LOCAL_HANDLER_IDS), 'LISTENING_OWNER_LOCAL_HANDLER_SET');
  const erasureRequest = ownerHandlersById.get(LISTENING_OWNER_LOCAL_ERASURE_REQUEST_HANDLER) || {};
  need(erasureRequest.handlerKind === 'SIGNED_PRIVACY_RETENTION_OWNER_INGRESS'
    && erasureRequest.ownerPortOperation === 'protected.requestErasure'
    && erasureRequest.streamKey === 'platform-hris-listening-protected'
    && erasureRequest.ticketTable === 'sys_hris_listening_erasure_tickets'
    && erasureRequest.receiptTable === 'sys_hris_listening_protected_receipts'
    && erasureRequest.outboxTable === 'sys_hris_listening_protected_outbox'
    && erasureRequest.initialStatus === 'REQUESTED'
    && String(erasureRequest.trigger || '').includes('DUE_SCAN')
    && String(erasureRequest.statusReentry || '').includes('SEALED_STATUS_RECEIPT')
    && String(erasureRequest.idempotencyRule || '').includes('SAME_KEY_AND_DIGEST')
    && erasureRequest.transactionBoundary === 'PROTECTED_OWNER_LOCAL_TICKET_RECEIPT_AND_ACK_ATOMIC'
    && erasureRequest.publicEventEmission === 'FORBIDDEN_RAW_OR_IDENTITY_LINKABLE'
    && setEq(new Set(Object.keys(erasureRequest.requestContract || {})), new Set(['tenantPublicId', 'responsePublicId', 'retentionPolicyRevision', 'dueAt', 'idempotencyKey', 'requestDigest', 'signatureKeyId'])), 'LISTENING_OWNER_LOCAL_ERASURE_REQUEST_HANDLER');
  const erasureProcess = ownerHandlersById.get(LISTENING_OWNER_LOCAL_ERASURE_PROCESS_HANDLER) || {};
  need(erasureProcess.handlerKind === 'OWNER_LOCAL_ERASURE_PROCESSOR'
    && erasureProcess.streamKey === 'platform-hris-listening-protected'
    && erasureProcess.ticketProducerHandlerId === LISTENING_OWNER_LOCAL_ERASURE_REQUEST_HANDLER
    && erasureProcess.stableReplayReceiptRequired === true
    && erasureProcess.publicEventEmission === 'FORBIDDEN_RAW_OR_IDENTITY_LINKABLE'
    && setEq(new Set(erasureProcess.responseMutableStatusForbidden || []), new Set(['WITHDRAWN', 'ANONYMIZED'])), 'LISTENING_OWNER_LOCAL_ERASURE_PROCESS_HANDLER');
  const ownerByTable = new Map();
  for (const [streamKey, group] of [
    ['platform-hris-configuration', 'LISTENING_CONFIGURATION'],
    ['platform-hris-listening-protected', 'LISTENING_PROTECTED_ADMISSION'],
    ['platform-hris-insights', 'LISTENING_INSIGHTS'],
    ['auth-hris-participation-issuer', 'LISTENING_PARTICIPATION_ISSUER']
  ]) for (const tableName of TABLE_GROUPS[group]) ownerByTable.set(tableName, streamKey);
  for (const [messageName, [handlerId, streamKey, inboxTable, outboxTable]] of LISTENING_INTERNAL_HANDLER_BY_MESSAGE) {
    const handler = ownerHandlersById.get(handlerId) || {};
    const domainTables = handler.domainWriteTables || [];
    need(handler.handlerKind === 'SIGNED_INTERNAL_PORT_MESSAGE_INBOX_CONSUMER'
      && handler.messageName === messageName
      && handler.streamKey === streamKey
      && handler.inboxLedgerTable === inboxTable
      && handler.outboxTable === outboxTable
      && Array.isArray(domainTables) && domainTables.length > 0
      && domainTables.every((tableName) => ownerByTable.get(tableName) === streamKey)
      && ownerByTable.get(inboxTable) === streamKey
      && ownerByTable.get(outboxTable) === streamKey
      && handler.transactionBoundary === 'INBOX_CLAIM_DOMAIN_CAS_CLOSED_ACK_AND_OUTBOX_ATOMIC'
      && String(handler.idempotencyRule || '').includes('SAME_MESSAGE_ID_AND_DIGEST')
      && String(handler.failureRule || '').includes('ROLLS_BACK_INBOX_DOMAIN_ACK_AND_OUTBOX_TO_PRESTATE')
      && Boolean(handler.closedAcknowledgement), `LISTENING_INTERNAL_MESSAGE_HANDLER:${messageName}`);
  }

  const eventOwnership = authority.eventOwnership || {};
  need(setEq(new Set((eventOwnership.canonicalPublicEvents || []).map((row) => row.eventName)), MODERN_EVENTS['HRIS.MODERN.EMPLOYEE_LISTENING']), 'LISTENING_PUBLIC_EVENT_SET');
  need((eventOwnership.canonicalPublicEvents || []).every((row) => LISTENING_STREAM_KEYS.has(row.streamKey) && !String(row.payloadClass || '').includes('RAW')), 'LISTENING_PUBLIC_EVENT_BOUNDARY');
  need(new Set(eventOwnership.publicBrokerForbidden || []).has('EmployeeListeningResponseSubmitted.v2'), 'LISTENING_RAW_RESPONSE_EVENT_NOT_FORBIDDEN');
  need((eventOwnership.internalPortMessages || []).length === 6 && (eventOwnership.privateReceiptOnly || []).length === 3, 'LISTENING_PRIVATE_MESSAGE_COUNTS');

  const profiles = authority.verificationProfileBindings || [];
  need(profiles.length === 5 && setEq(new Set(profiles.map((row) => row.profileId)), new Set([...LISTENING_BACKEND_PROFILES, LISTENING_FRONTEND_PROFILE])), 'LISTENING_PROFILE_SET');
  need(profiles.every((row) => row.state === 'CONTROL_CATALOG_BINDING_REQUIRED'), 'LISTENING_PROFILE_STATE');
  const expectedProfileOwners = {
    'G3-SYS-LISTEN-CONFIGURATION-BE': ['dwp-platform-server', new Set(['platform-hris-configuration'])],
    'G3-SYS-LISTEN-PROTECTED-BE': ['dwp-platform-server', new Set(['platform-hris-listening-protected'])],
    'G3-SYS-LISTEN-INSIGHTS-BE': ['dwp-platform-server', new Set(['platform-hris-insights'])],
    'G3-SYS-LISTEN-ISSUER-BE': ['dwp-auth-server', new Set(['auth-hris-participation-issuer'])],
    'G3-SYS-LISTEN-FE': ['dwp-frontend', new Set()]
  };
  need(profiles.every((row) => expectedProfileOwners[row.profileId] && row.ownerService === expectedProfileOwners[row.profileId][0] && setEq(new Set(row.streamKeys || []), expectedProfileOwners[row.profileId][1])), 'LISTENING_PROFILE_OWNER_BINDING');
  const reservations = authority.migrationReservations || [];
  const allocations = authority.fileAllocations || [];
  need(reservations.length === 4 && allocations.length === 4 && setEq(new Set(reservations.map((row) => row.streamKey)), LISTENING_STREAM_KEYS) && setEq(new Set(allocations.map((row) => row.streamKey)), LISTENING_STREAM_KEYS), 'LISTENING_MIGRATION_FILE_ALLOCATION_SET');
  need(reservations.every((row) => row.range && row.range.start === 1 && row.range.end === 40 && row.range.baselineHighWater === 0 && row.state === 'RESERVED_G3_RANGE_NOT_CREATED' && row.firstReservedMigration.startsWith('V1__') && !row.firstReservedMigration.includes('V287')), 'LISTENING_MIGRATION_RESERVATION');
  const precedence = authority.canonicalPrecedence || {};
  need(precedence.mode === 'CANONICAL_FIVE_PRIMARY_DERIVED_SUMMARY_ONLY' && precedence.legacyArtifactRole === 'HISTORICAL_TRACE_ONLY_WHEN_SEPARATELY_FROZEN' && precedence.legacyDirectImplementation === 'FORBIDDEN' && !Object.prototype.hasOwnProperty.call(precedence, 'predecessorPins') && !Object.prototype.hasOwnProperty.call(precedence, 'historicalPredecessor') && precedence.reverseReferenceFromCanonicalFiveAllowed === false && Array.isArray(precedence.authoritativeInputs) && precedence.authoritativeInputs.length === 5 && precedence.generatedSummary && precedence.generatedSummary.canonicalInputCount === 5 && precedence.generatedSummary.activePrecedence === 'CANONICAL_FIVE_ROWS_THEN_DERIVED_SUMMARY' && precedence.forbiddenLegacyMigration.includes('V287__') && precedence.forbiddenLegacyPublicEvent === 'EmployeeListeningResponseSubmitted.v2', 'LISTENING_CANONICAL_FIVE_TO_DERIVED_SUMMARY');
}

function validateHistoricalListeningPredecessor(capability, need) {
  const operations = capability.operations || [];
  const stateMachines = capability.stateMachines || [];
  const transitions = stateMachines.flatMap((machine) => machine.transitions || []);
  const events = capability.events || [];
  const tables = capability.tables || [];
  need(
    capability.boundedContext === 'DWP_PLATFORM_HRIS_INSIGHTS'
      && capability.runtimeOwner === 'dwp-platform-server'
      && capability.migrationFile === 'dwp-platform-server/src/main/resources/db/migration/V287__hris_platform_modern_employee_listening.sql',
    'LISTENING_HISTORICAL_PREDECESSOR_IDENTITY'
  );
  need(
    operations.length === LEGACY_LISTENING_OPERATIONS.size
      && setEq(new Set(operations.map((row) => row.operationId)), LEGACY_LISTENING_OPERATIONS),
    'LISTENING_HISTORICAL_PREDECESSOR_OPERATION_SET'
  );
  need(
    stateMachines.length === 1
      && transitions.length === LEGACY_LISTENING_TRANSITIONS.size
      && setEq(new Set(transitions.map((row) => row.transitionId)), LEGACY_LISTENING_TRANSITIONS),
    'LISTENING_HISTORICAL_PREDECESSOR_TRANSITION_SET'
  );
  need(
    events.length === LEGACY_LISTENING_EVENTS.size
      && setEq(new Set(events.map((row) => row.name)), LEGACY_LISTENING_EVENTS),
    'LISTENING_HISTORICAL_PREDECESSOR_EVENT_SET'
  );
  need(
    tables.length === LEGACY_LISTENING_TABLES.size
      && setEq(new Set(tables.map((row) => row.name)), LEGACY_LISTENING_TABLES),
    'LISTENING_HISTORICAL_PREDECESSOR_TABLE_SET'
  );
}

function audit(data, verifyPin = true) {
  const errors = [];
  const need = (condition, code) => { if (!condition) errors.push(code); };
  const missing = Object.keys(PATHS).filter((key) => key !== 'pin' && data[key] == null);
  if (verifyPin && data.pin == null) missing.push('pin');
  if (missing.length) return missing.map((key) => `MISSING_ARTIFACT:${key}`);

  validateListeningSummary(data, need);

  const manifest = data.manifest || {};
  need(manifest.contractId === 'dwp.hris.sys-exact-business-start-successor.v1' && manifest.status === 'CANONICAL_SYS_EXACT_BUSINESS_START_SUCCESSOR', 'MANIFEST_ID_STATUS');
  need(manifest.runtimeImplemented === false && manifest.productionAuthorized === false && manifest.globalGateAuthorization === 'NONE_VALIDATOR_CONTROLLED', 'MANIFEST_GATE_BOUNDARY');
  need(JSON.stringify(manifest.exactOwnedSliceIds) === JSON.stringify(EXACT_ASSURANCE), 'SLICE_ID_EXACT_SET');
  const bindings = by(manifest.sliceBindings, 'assuranceSliceId');
  need(bindings.size === 17 && setEq(new Set(bindings.keys()), new Set(EXACT_ASSURANCE)), 'SLICE_BINDING_EXACT_SET');
  for (const [id, expected] of Object.entries(SOURCE)) {
    const row = bindings.get(id) || {};
    need(row.sourceFamilySha256 === expected[0], `SOURCE_HASH_MANIFEST:${id}`);
    need(row.sourceRowCount === expected[1], `SOURCE_COUNT_MANIFEST:${id}`);
    need(row.decisionId === expected[2] && row.disposition === expected[3], `DECISION_DISPOSITION_MANIFEST:${id}`);
    need(row.resolutionMode === expected[4] && row.boundedContext === expected[5], `SOURCE_RUNTIME_MODE:${id}`);
    need(Array.isArray(row.runtimeOwners) && row.runtimeOwners.length > 0, `RUNTIME_OWNER:${id}`);
  }
  for (const [capabilityId, expected] of Object.entries(MODERN)) {
    const row = bindings.get(expected.slice) || {};
    const listening = capabilityId === 'HRIS.MODERN.EMPLOYEE_LISTENING';
    const expectedOwners = listening ? ['dwp-auth-server', 'dwp-platform-server'] : ['dwp-platform-server'];
    const expectedCounts = listening
      ? {operations: MODERN_OPERATIONS[capabilityId].size, ownerPortOperations: LISTENING_OWNER_PORTS.size, ownerLocalHandlers: LISTENING_OWNER_LOCAL_HANDLER_IDS.size, stateMachines: 0, transitions: 0, publicEvents: MODERN_EVENTS[capabilityId].size, internalMessages: 6, privateReceipts: 3, tables: LISTENING_TABLES.size, migrationReservations: 4, verificationProfiles: 5, acceptanceTests: 3}
      : {operations: expected.ops, stateMachines: 1, transitions: expected.transitions, events: expected.events, tables: expected.tables, acceptanceTests: expected.tests};
    need(row.sourceKind === 'MODERN_CAPABILITY' && row.sourceRef === capabilityId && row.boundedContext === expected.context && JSON.stringify(row.runtimeOwners) === JSON.stringify(expectedOwners) && row.writeTableGroup === expected.group, `MODERN_MANIFEST_SOURCE_RUNTIME:${capabilityId}`);
    need(JSON.stringify(row.bodyCounts) === JSON.stringify(expectedCounts), `MODERN_BODY_COUNTS_MANIFEST:${capabilityId}`);
    need(setEq(new Set(row.operationIds || []), MODERN_OPERATIONS[capabilityId]) && (row.operationIds || []).length === expected.ops, `MODERN_OPERATION_IDS_MANIFEST:${capabilityId}`);
    need(setEq(new Set(row.internalOperationIds || []), MODERN_INTERNAL_OPERATIONS[capabilityId]) && (row.internalOperationIds || []).length === expected.internalOps, `MODERN_INTERNAL_OPERATION_IDS_MANIFEST:${capabilityId}`);
    need(setEq(new Set(row.stateTransitionIds || []), MODERN_TRANSITIONS[capabilityId]) && (row.stateTransitionIds || []).length === expected.transitions, `MODERN_TRANSITION_IDS_MANIFEST:${capabilityId}`);
    need(setEq(new Set(row.eventNames || []), MODERN_EVENTS[capabilityId]) && (row.eventNames || []).length === expected.events, `MODERN_EVENT_NAMES_MANIFEST:${capabilityId}`);
    need(setEq(new Set(row.authorizationCapabilities || []), MODERN_AUTH[capabilityId]), `MODERN_AUTH_MANIFEST:${capabilityId}`);
    need(setEq(new Set(row.entryQueryIds || []), MODERN_ENTRY_QUERIES[capabilityId]), `MODERN_IA_MANIFEST:${capabilityId}`);
    if (listening) {
      const inputSetSha = (((data.listeningSummary || {}).canonicalPrecedence || {}).generatedSummary || {}).canonicalInputSetSha256;
      need(row.canonicalAuthorityMode === 'PRIMARY_CANONICAL_FIVE_ROWS' && row.derivedSummaryRef === LISTENING_SUMMARY_ID && row.derivedSummaryPath === LISTENING_SUMMARY_PATH && row.derivedSummaryFileSha256 === sha(data._raw[LISTENING_SUMMARY_PATH]) && row.derivedSummaryCanonicalInputSetSha256 === inputSetSha, 'LISTENING_MANIFEST_DERIVED_SUMMARY_PIN');
      need(!['successorAuthorityRef', 'successorAuthorityPath', 'successorAuthorityFileSha256'].some((field) => Object.prototype.hasOwnProperty.call(row, field)), 'LISTENING_MANIFEST_REVERSE_AUTHORITY_FIELDS');
      need(setEq(new Set(row.streamKeys || []), LISTENING_STREAM_KEYS), 'LISTENING_MANIFEST_STREAM_SET');
      need(setEq(new Set(row.verificationProfileIds || []), new Set([...LISTENING_BACKEND_PROFILES, LISTENING_FRONTEND_PROFILE])), 'LISTENING_MANIFEST_PROFILE_SET');
      need(row.implementationState === 'NOT_STARTED_G3_G4' && row.productionState === 'NOT_AUTHORIZED_G6' && row.realIdentityProcessIsolationState === 'G6_ONLY_NOT_CLAIMED', 'LISTENING_MANIFEST_GATE_BOUNDARY');
    }
  }
  need(manifest.currentPointer && manifest.currentPointer.currentPath === PATHS.manifest && manifest.currentPointer.pointerState === 'CURRENT_EXACT_SUCCESSOR', 'CURRENT_POINTER_REGRESSION');
  need(setEq(new Set(Object.keys(manifest.physicalWriteTableGroups || {})), new Set(Object.keys(TABLE_GROUPS))), 'TABLE_GROUP_KEY_SET');
  for (const [group, tables] of Object.entries(TABLE_GROUPS)) need(setEq(new Set((manifest.physicalWriteTableGroups || {})[group] || []), new Set(tables)), `TABLE_GROUP_SET:${group}`);
  need(manifest.operationClosure && manifest.operationClosure.baseContractCount === 84 && manifest.operationClosure.baseRuntimeOperationCount === 77 && manifest.operationClosure.modernOperationCount === EXPECTED_MODERN_OPERATION_COUNT && manifest.operationClosure.modernEventCount === EXPECTED_MODERN_EVENT_COUNT && manifest.operationClosure.modernTableCount === EXPECTED_MODERN_TABLE_COUNT, 'OPERATION_CLOSURE_COUNTS');
  need(manifest.authorizationClosure && manifest.authorizationClosure.entryQueryCount === 13 && setEq(new Set(manifest.authorizationClosure.entryQueryIds || []), IA_IDS), 'MANIFEST_IA_EXACT_SET');
  need(manifest.authorizationClosure && manifest.authorizationClosure.modernAuthorizationBindingCount === 9 && setEq(new Set(manifest.authorizationClosure.modernAuthorizationBindingIds || []), new Set(Object.values(MODERN_AUTH_BINDINGS).flatMap((ids) => [...ids]))), 'MANIFEST_MODERN_AUTH_EXACT_SET');
  need(setEq(new Set(manifest.boundaryPolicy.genericCore), new Set(['PRODUCT_CORE', 'TENANT_CONFIG', 'PROVIDER_NEUTRAL_PORT', 'SYNTHETIC_FIXTURE', 'SIGNED_EXTENSION_VERIFIER'])), 'BOUNDARY_GENERIC_CORE');
  need(setEq(new Set(manifest.boundaryPolicy.g6Only), new Set(['REAL_PROVIDER_ADAPTER', 'REAL_COUNTRY_OR_STATUTORY_CONTENT', 'CUSTOMER_MAPPING', 'PRODUCTION_SECRET', 'NAMED_TENANT_ACTIVATION'])), 'BOUNDARY_G6_ONLY');
  need(manifest.authoritativeSources && manifest.authoritativeSources.sysListeningDerivedSummary === LISTENING_SUMMARY_PATH, 'LISTENING_DERIVED_SUMMARY_SOURCE');
  need(manifest.authoritativeSources && !Object.prototype.hasOwnProperty.call(manifest.authoritativeSources, 'sysListeningStreamAuthority'), 'LISTENING_PRIMARY_SUMMARY_SOURCE_FORBIDDEN');
  need(subset(new Set(['CROSS_SCHEMA_DATABASE_FK', 'FOREIGN_STREAM_LOCAL_ID', 'FOREIGN_STREAM_REPOSITORY_IMPORT', 'RAW_LISTENING_RESPONSE_PUBLIC_EVENT', 'PARTICIPATION_TOKEN_PUBLIC_EVENT', 'SINGLE_V287_LISTENING_MIGRATION']), new Set(manifest.boundaryPolicy.forbiddenCorePatterns || [])), 'LISTENING_BOUNDARY_FORBIDDEN_SET');

  const targets = by(data.targets, 'resolution_id');
  const decisions = new Map([...data.sysDecisions, ...data.hrmDecisions].map((row) => [row.decision_id, row]));
  for (const [assuranceId, expected] of Object.entries(SOURCE)) {
    const targetId = assuranceId === 'BASE-TFR-HRM-015' ? 'TFR-HRM-015' : assuranceId;
    const target = targets.get(targetId) || {};
    need(target.source_family_sha256 === expected[0], `SOURCE_HASH_TARGET:${assuranceId}`);
    need(target.source_row_count === String(expected[1]), `SOURCE_COUNT_TARGET:${assuranceId}`);
    const source = assuranceId === 'BASE-TFR-HRM-015' ? data.hrmSource : data.sysSource;
    const family = source.filter((row) => sha(Buffer.from(row.target_api_or_event || '', 'utf8')) === expected[0]);
    need(family.length === expected[1], `SOURCE_FAMILY_RECOMPUTE:${assuranceId}`);
    need(family.every((row) => row.decision_status === 'DECIDED' && row.disposition === expected[3] && row.target_bounded_context_candidate === expected[5]), `SOURCE_FAMILY_SEMANTICS:${assuranceId}`);
    const decision = decisions.get(expected[2]) || {};
    need(decision.status === 'DECIDED' && decision.resolution, `DECISION_UNRESOLVED:${assuranceId}`);
    if (assuranceId.startsWith('TFR-SYS')) need(decision.proposed_decision === expected[3], `DECISION_DISPOSITION:${assuranceId}`);
    else need(String(decision.proposed_decision).includes('Signed tenant extension'), 'SIGNED_EXTENSION_DECISION');
    const primary = new Set(split(target.primary_resolution_refs)); const related = new Set(split(target.related_resolution_refs));
    need([...primary].every((item) => !related.has(item)) && setEq(new Set([...primary, ...related]), new Set(split(target.resolution_refs))), `PRIMARY_RELATED_PARTITION:${assuranceId}`);
  }
  const selected = [...Array.from({length: 13}, (_, i) => targets.get(`TFR-SYS-${String(i + 1).padStart(3, '0')}`)), targets.get('TFR-HRM-015')];
  const union = new Set(selected.flatMap((row) => split(row.resolution_refs)));
  const unionExpected = new Set([
    ...Array.from({length: 75}, (_, i) => `SYS-API-${String(i + 1).padStart(3, '0')}`),
    ...Array.from({length: 9}, (_, i) => `SYS-EVT-${String(i + 1).padStart(3, '0')}`),
    ...Array.from({length: 12}, (_, i) => `SHARED-API-${String(i + 1).padStart(3, '0')}`),
    'PLAT-003', 'PLAT-004', 'PLAT-005', 'SVC-PEP-HRM-006', 'SVC-PEP-PAY-001', 'SVC-PEP-PER-002', 'SVC-PEP-TIM-002',
    'XCON-012', 'XCON-013', 'XCON-014', 'XCON-015', 'DECISION:DEC-SYS-013'
  ]);
  need(union.size === 108 && setEq(union, unionExpected), 'TARGET_RESOLUTION_EXACT_UNION');

  const g3Rows = data.g3.filter((row) => row.session_id === 'HRIS-SYS'); const g3 = by(g3Rows, 'slice_id');
  need(g3Rows.length === 17 && setEq(new Set(g3.keys()), new Set(EXACT_G3)), 'G3_EXACT_SLICE_SET');
  const primaryOwners = by(data.primary, 'contract_id');
  const listeningFileIds = new Set((data.listeningSummary.fileAllocations || []).flatMap((row) => [row.sourceAllocationId, row.testAllocationId, row.migrationAllocationId]));
  const expectedFileIds = new Set(['G3-SYS-BE-SOURCE', 'G3-SYS-BE-TEST', 'G3-SYS-BE-MIGRATION', 'G3-SYS-AUTH-BE-SOURCE', 'G3-SYS-AUTH-BE-TEST', 'G3-SYS-AUTH-BE-MIGRATION', 'G3-SYS-FE-SOURCE', ...listeningFileIds]);
  for (const sliceId of EXACT_G3) {
    const row = g3.get(sliceId) || {}; const binding = [...bindings.values()].find((item) => item.g3SliceId === sliceId) || {};
    if (sliceId === 'MOD-SYS-LISTEN') need(setEq(new Set(split(row.bounded_context_refs)), LISTENING_STREAM_KEYS), `G3_CONTEXT:${sliceId}`);
    else need(row.bounded_context_refs === binding.boundedContext, `G3_CONTEXT:${sliceId}`);
    need(row.source_family_sha256 === String(binding.sourceFamilySha256) && row.source_row_count === String(binding.sourceRowCount), `G3_SOURCE_BINDING:${sliceId}`);
    need(row.production_state === 'NOT_AUTHORIZED_G6', `G3_PRODUCTION:${sliceId}`);
    if (sliceId === 'BASE-TFR-SYS-013') {
      need(row.gate_status === 'RETIRED_NO_CODE' && row.implementation_state === 'NOT_APPLICABLE_RETIRED' && row.code_go_token === 'NO_CODE_GO_RETIRED', 'RETIRED_BECAME_ACTIVE');
      need(!row.file_allocation_ids && !row.migration_allocation_ids && !row.g3_verification_command_display_non_authoritative && !row.backend_verification_profile_id && !row.frontend_verification_profile_id && !row.frontend_test_path, 'RETIRED_CODE_ALLOCATION');
      continue;
    }
    need(row.gate_status === 'OPEN_G3_CODE' && row.implementation_state === 'NOT_STARTED_G3', `G3_STATE:${sliceId}`);
    need(row.code_go_token === `G3-CODE-GO-${sliceId}`, `G3_TOKEN:${sliceId}`);
    need(setEq(new Set(split(row.required_g4_assertions)), G4), `G4_ASSERTIONS:${sliceId}`);
    for (const field of ['schema_state_contract_refs', 'acceptance_evidence_refs', 'test_evidence_refs', 'g4_runbook_ref', 'g4_telemetry_evidence_ref', 'g4_migration_evidence_ref', 'g4_recovery_evidence_ref', 'g4_acceptance_evidence_ref', 'g3_verification_command_display_non_authoritative', 'backend_verification_profile_id', 'frontend_verification_profile_id', 'frontend_test_path']) need(Boolean(row[field]), `G3_EVIDENCE:${sliceId}:${field}`);
    need(String(row.g3_verification_command_display_non_authoritative).startsWith('DERIVED_NON_AUTHORITATIVE:'), `G3_COMMAND_DISPLAY_ONLY:${sliceId}`);
    const rowFiles = new Set(split(row.file_allocation_ids));
    need(rowFiles.size > 0 && subset(rowFiles, expectedFileIds), `G3_FILE_ALLOCATION:${sliceId}`);
    if (sliceId === 'MOD-SYS-LISTEN') {
      need(setEq(rowFiles, new Set(binding.fileAllocationIds || [])), 'LISTENING_G3_FILE_ALLOCATION_SET');
      need(setEq(new Set(split(row.migration_allocation_ids)), new Set(binding.migrationAllocationIds || [])), 'LISTENING_G3_MIGRATION_ALLOCATION_SET');
      need(setEq(new Set(split(row.backend_verification_profile_id)), LISTENING_BACKEND_PROFILES) && row.frontend_verification_profile_id === LISTENING_FRONTEND_PROFILE, 'LISTENING_G3_PROFILE_SET');
      need(new Set(split(row.schema_state_contract_refs)).has(LISTENING_SUMMARY_ID), 'LISTENING_G3_DERIVED_SUMMARY_REF');
      need(!new Set(split(row.api_event_contract_refs)).has('EmployeeListeningResponseSubmitted.v2'), 'LISTENING_G3_RAW_RESPONSE_EVENT');
      need(!split(row.planned_migration_file).some((value) => value.includes('V287__')), 'LISTENING_G3_SINGLE_V287');
    } else {
      const expectedMigration = binding.writeTableGroup === 'AUTH_PRODUCT_ACCESS' ? 'MIG-SYS-AUTH-217-245' : 'MIG-SYS-PLATFORM-262-290';
      need(row.migration_allocation_ids === expectedMigration, `G3_MIGRATION_ALLOCATION:${sliceId}`);
    }
    if (String(row.source_ref).startsWith('TFR-')) {
      const target = targets.get(row.source_ref) || {};
      need(subset(new Set(split(target.primary_resolution_refs)), new Set(split(row.primary_contract_refs))), `PRIMARY_DOWNGRADE:${sliceId}`);
      need(subset(new Set(split(target.related_resolution_refs)), new Set(split(row.api_event_contract_refs))), `RELATED_RESOLUTION_LOST:${sliceId}`);
    }
    for (const ref of split(row.primary_contract_refs)) {
      if (ref.startsWith('IAQ-')) continue;
      const owner = primaryOwners.get(ref) || {};
      need(owner.primary_slice_id === sliceId && owner.status === 'SEALED_G3_PRIMARY_OWNER', `PRIMARY_OWNER:${sliceId}:${ref}`);
    }
  }
  need(setEq(new Set(data.files.filter((row) => row.session_id === 'HRIS-SYS').map((row) => row.allocation_id)), expectedFileIds), 'FILE_ALLOCATION_EXACT_SET');

  const catalog = by(data.catalog, 'contract_id');
  const catalogExpected = new Set([...Array.from({length: 75}, (_, i) => `SYS-API-${String(i + 1).padStart(3, '0')}`), ...Array.from({length: 9}, (_, i) => `SYS-EVT-${String(i + 1).padStart(3, '0')}`)]);
  need(data.catalog.length === 84 && setEq(new Set(catalog.keys()), catalogExpected), 'SYS_CATALOG_EXACT_SET');
  need(data.catalog.every((row) => row.status === 'READY' && row.state_or_payload), 'SYS_CATALOG_SEMANTICS');
  const operations = data.transport.operations || {};
  const operationExpected = new Set(Array.from({length: 75}, (_, i) => `SYS-API-${String(i + 1).padStart(3, '0')}`).filter((id) => !['SYS-API-017', 'SYS-API-021'].includes(id)));
  ['SYS-API-017.GET', 'SYS-API-017.POST', 'SYS-API-021.GET', 'SYS-API-021.POST'].forEach((id) => operationExpected.add(id));
  need(Object.keys(operations).length === 77 && setEq(new Set(Object.keys(operations)), operationExpected), 'TRANSPORT_OPERATION_EXACT_SET');
  need(Object.keys(data.transport.$defs || {}).length === 127, 'TRANSPORT_DEFINITION_COUNT');
  closedObjects(data.transport, errors, 'base-transport');
  const pepRows = data.pep.filter((row) => row.module === 'SYS'); const pep = by(pepRows, 'binding_id');
  const tsrRows = data.tsr.filter((row) => row.module === 'SYS'); const tsr = by(tsrRows, 'binding_id');
  need(pepRows.length === 77 && setEq(new Set(pep.keys()), new Set(Array.from({length: 77}, (_, i) => `PEP-SYS-${String(i + 1).padStart(3, '0')}`))), 'PEP_EXACT_SET');
  need(tsrRows.length === 77 && setEq(new Set(tsr.keys()), new Set(pep.keys())), 'TSR_EXACT_SET');
  const pepByOperation = new Map(pepRows.map((row) => [`${row.source_operation_id}:${row.method}`, row]));
  const headerCounts = {};
  for (const [operationKey, operation] of Object.entries(operations)) {
    const sourceId = operation.sourceOperationId || operationKey.split('.')[0]; const contract = catalog.get(sourceId) || {};
    need(split(contract.operation_or_version).includes(operation.method), `METHOD_DRIFT:${operationKey}`);
    need(operation.path === contract.path_or_event && operation.authorization === contract.authorization, `PATH_AUTH_DRIFT:${operationKey}`);
    const baseline = ['SYS-API-031', 'SYS-API-032'].includes(sourceId);
    need((baseline && String(operation.responseSchema && operation.responseSchema.$ref).startsWith('DWP_BACKEND@5670877de7a39e94e75021c7e23cbbb553296c90:')) || (!baseline && ptr(data.transport, operation.responseSchema)), `RESPONSE_SCHEMA_MISSING:${operationKey}`);
    need(ptr(data.transport, operation.errorSchema), `ERROR_SCHEMA_MISSING:${operationKey}`);
    if (operation.method === 'GET') need(operation.requestBodySchema == null && ['query', 'baseline-reuse-query'].includes(operation.mode), `QUERY_CONTRACT:${operationKey}`);
    else {
      const requestOk = sourceId === 'SYS-API-032' ? String(operation.requestBodySchema && operation.requestBodySchema.$ref).startsWith('DWP_BACKEND@5670877de7a39e94e75021c7e23cbbb553296c90:') : Boolean(ptr(data.transport, operation.requestBodySchema));
      need(requestOk, `REQUEST_SCHEMA_MISSING:${operationKey}`);
      need(['command', 'baseline-reuse-command-exception'].includes(operation.mode), `COMMAND_MODE:${operationKey}`);
    }
    const header = operation.headerSchema && operation.headerSchema.$ref || 'NONE'; headerCounts[header] = (headerCounts[header] || 0) + 1;
    if (!baseline && operation.method !== 'GET') need((ptr(data.transport, operation.headerSchema).required || []).includes('Idempotency-Key'), `IDEMPOTENCY_HEADER:${operationKey}`);
    const binding = pepByOperation.get(`${sourceId}:${operation.method}`) || {};
    need(binding.contract_path === operation.path && binding.source_authorization_alias === operation.authorization, `PEP_OPERATION_DRIFT:${operationKey}`);
    const resolved = tsr.get(binding.binding_id) || {};
    need(resolved.runtime_operation_id === sourceId && resolved.method === operation.method && resolved.path === operation.path && resolved.status === 'RESOLVED_EXACT', `TSR_OPERATION_DRIFT:${operationKey}`);
  }
  need(JSON.stringify(headerCounts) === JSON.stringify({'#/$defs/QueryHeaders': 16, '#/$defs/CommandHeaders': 15, '#/$defs/CasCommandHeaders': 44, NONE: 2}), 'IDEMPOTENCY_CAS_COUNTS');
  need(data.catalog.filter((row) => row.kind === 'EVENT').length === 9 && data.catalog.filter((row) => row.kind === 'EVENT').every((row) => row.execution === 'OUTBOX_INBOX' && row.idempotency === 'EVENT_ID'), 'BASE_EVENT_CONTRACT');

  const duties = by(data.duties, 'duty_code'); const sod = by(data.sod, 'rule_code');
  for (const row of pepRows) {
    need(row.canonical_app_entitlement === 'APP.HCM:VIEW' && JSON.stringify(split(row.pep_layers)) === JSON.stringify(PEP_LAYERS), `PEP_LAYERS:${row.binding_id}`);
    const dutyRows = [];
    for (const pair of split(row.authorization_profiles)) {
      const [profile, dutyId] = pair.split('>'); const duty = duties.get(dutyId);
      need(Boolean(profile && duty && split(duty.package_codes).includes(profile)), `PEP_DUTY_RESOLUTION:${row.binding_id}:${dutyId}`);
      if (duty) dutyRows.push(duty);
    }
    const pairs = [['canonical_capability_keys', 'capability_key'], ['canonical_resource_types', 'resource_type'], ['canonical_resource_keys', 'resource_key'], ['canonical_actions', 'permission_code'], ['canonical_population_types', 'population_types'], ['canonical_field_group_keys', 'field_group_keys']];
    for (const [pepField, dutyField] of pairs) need(setEq(new Set(split(row[pepField])), new Set(dutyRows.flatMap((duty) => split(duty[dutyField])))), `PEP_DUTY_MISMATCH:${row.binding_id}:${pepField}`);
    for (const duty of dutyRows) for (const ruleId of split(duty.dynamic_sod_rule_codes)) {
      const rule = sod.get(ruleId) || {}; need(rule.enforcement_mode === 'BLOCK' && split(rule.left_subject_code).includes(duty.duty_code), `SOD_DUTY_MISMATCH:${row.binding_id}:${ruleId}`);
    }
  }
  const iaRows = data.ia.filter((row) => row.owner_session === 'HRIS-SYS'); const ia = by(iaRows, 'query_id');
  need(iaRows.length === 13 && setEq(new Set(ia.keys()), IA_IDS), 'IA_EXACT_SET');
  for (const [id, row] of ia) {
    need(EXACT_G3.includes(row.primary_slice_id) && split((g3.get(row.primary_slice_id) || {}).primary_contract_refs).includes(id), `IA_PRIMARY_BINDING:${id}`);
    need(row.method === 'GET' && row.browser_path.startsWith('/api/') && JSON.stringify(split(row.pep_layers)) === JSON.stringify(PEP_LAYERS), `IA_PEP_METHOD:${id}`);
    need(row.implementation_state === 'REQUIRED_G3_ENTRY_QUERY_NOT_IMPLEMENTED' && row.production_state === 'NOT_AUTHORIZED_G6', `IA_STATE:${id}`);
    for (const field of ['request_schema_ref', 'response_schema_ref', 'problem_schema_ref']) {
      const pointer = '#' + String(row[field]).split('#')[1]; need(ptr(data.iaSchemas, {$ref: pointer}), `IA_SCHEMA:${id}:${field}`);
    }
  }

  need(setEq(sqlTables(data.authSql), AUTH_TABLES), 'AUTH_TABLE_EXACT_SET');
  need(setEq(sqlTables(data.platformSql), PLATFORM_TABLES), 'PLATFORM_TABLE_EXACT_SET');
  for (const [label, sql] of [['AUTH', data.authSql], ['PLATFORM', data.platformSql]]) need(sql.includes('ENABLE ROW LEVEL SECURITY') && sql.includes('FORCE ROW LEVEL SECURITY') && sql.includes('CREATE POLICY'), `RLS_POLICY:${label}`);
  const migrations = by(data.migrations, 'allocation_id');
  need((migrations.get('MIG-SYS-AUTH-217-245') || {}).allocated_version === '217-245' && (migrations.get('MIG-SYS-AUTH-217-245') || {}).service === 'dwp-auth-server', 'AUTH_MIGRATION_AUTHORITY');
  need((migrations.get('MIG-SYS-PLATFORM-262-290') || {}).baseline_high_water === '261' && (migrations.get('MIG-SYS-PLATFORM-262-290') || {}).allocated_version === '262-290' && (migrations.get('MIG-SYS-PLATFORM-262-290') || {}).service === 'dwp-platform-server', 'PLATFORM_MIGRATION_AUTHORITY');
  const ownership = by(data.ownership, 'ownership_id');
  need((ownership.get('OWN-SYS-BE-MIG-AUTH') || {}).path_glob === 'dwp-auth-server/src/main/resources/db/migration/V{217..245}__hris_auth_<slice>.sql', 'AUTH_FILE_OWNERSHIP');
  need((ownership.get('OWN-SYS-BE-MIG-PLATFORM') || {}).path_glob === 'dwp-platform-server/src/main/resources/db/migration/V{262..290}__hris_platform_<slice>.sql', 'PLATFORM_FILE_OWNERSHIP');
  for (const reservation of data.listeningSummary.migrationReservations || []) {
    const migration = migrations.get(reservation.allocationId) || {};
    const owner = ownership.get(reservation.ownershipId) || {};
    need(migration.migration_dir === reservation.migrationLocation && migration.allocated_version === '1-40' && migration.state === 'RESERVED_G3_RANGE' && owner.path_glob === `${String(reservation.migrationLocation || '').replace(/\/$/, '')}/V{1..40}__hris_listening_<slice>.sql`, `LISTENING_MIGRATION_AUTHORITY:${reservation.allocationId}`);
  }
  const physicalRows = data.physical.filter((row) => row.session === 'HRIS-SYS');
  const physical = by(physicalRows, 'binding_id');
  need(physicalRows.length === 9 && physical.size === 9 && physicalRows.every((row) => row.status === 'READY_FOR_G3_CODE'), 'PHYSICAL_OWNER_PREFIX');
  need(setEq(new Set(split((physical.get('PFX-SYS-AUTH-CATALOG') || {}).allowed_prefixes)), new Set(['sys_product_access_'])) && setEq(new Set(split((physical.get('PFX-SYS-AUTH-TENANT') || {}).allowed_prefixes)), new Set(['com_product_access_'])), 'AUTH_PREFIX_SET');
  need(setEq(new Set(split((physical.get('PFX-SYS-PLATFORM') || {}).allowed_prefixes)), new Set(['sys_'])), 'PLATFORM_PREFIX_SET');
  const physicalListening = {
    'PFX-SYS-LISTEN-CONFIGURATION': ['platform-hris-configuration', 'LISTENING_CONFIGURATION'],
    'PFX-SYS-LISTEN-PROTECTED': ['platform-hris-listening-protected', 'LISTENING_PROTECTED_ADMISSION'],
    'PFX-SYS-LISTEN-INSIGHTS': ['platform-hris-insights', 'LISTENING_INSIGHTS'],
    'PFX-SYS-LISTEN-ISSUER': ['auth-hris-participation-issuer', 'LISTENING_PARTICIPATION_ISSUER']
  };
  const streamByKey = by(data.listeningSummary.authorityStreams, 'streamKey');
  for (const [bindingId, [streamKey, group]] of Object.entries(physicalListening)) {
    const row = physical.get(bindingId) || {}; const stream = streamByKey.get(streamKey) || {};
    need(row.owner_service === stream.ownerService && row.database_schema === stream.databaseSchema && setEq(new Set(split(row.allowed_prefixes)), new Set(TABLE_GROUPS[group])) && String(row.cross_boundary_rule || '').includes(LISTENING_SUMMARY_ID), `LISTENING_PHYSICAL_BINDING:${bindingId}`);
  }

  const caps = by(data.modernBody.capabilities, 'capabilityId');
  need(data.modernBody.status === 'G3_CONTRACT_READY_NOT_IMPLEMENTED' && setEq(new Set(caps.keys()), new Set(Object.keys(MODERN))), 'MODERN_BODY_EXACT_SET');
  need(sha(data._raw[PATHS.modernBody]) === HISTORICAL_SYS_MODERN_BODY_SHA256, 'SYS_MODERN_BODY_HISTORICAL_BYTE_SEAL');
  const centralOps = by(data.modernExact.operationBindings.filter((row) => row.session === 'HRIS-SYS'), 'operationId');
  const centralTables = by(data.modernExact.tableSpecifications.filter((row) => row.session === 'HRIS-SYS'), 'tableName');
  need(centralOps.size === EXPECTED_MODERN_OPERATION_COUNT, 'MODERN_CENTRAL_OPERATION_COUNT');
  need(centralTables.size === EXPECTED_MODERN_TABLE_COUNT && setEq(new Set(centralTables.keys()), MODERN_TABLES), 'MODERN_CANONICAL_TABLE_SET');
  closedObjects(data.modernExact, errors, 'modern-exact'); closedObjects(data.modernEvents, errors, 'modern-events');
  const eventRows = data.modernEvents.eventPayloadSchemas.filter((row) => row.session === 'HRIS-SYS'); const events = by(eventRows, 'eventName');
  need(eventRows.length === EXPECTED_MODERN_EVENT_COUNT && events.size === EXPECTED_MODERN_EVENT_COUNT, 'MODERN_EVENT_COUNT');
  const coding = by(data.modernCoding.filter((row) => row.owner_session === 'HRIS-SYS'), 'capability_id');
  const delivery = by(data.modernDelivery.filter((row) => row.owner_session === 'HRIS-SYS'), 'capability_id');
  const trace = by(data.modernTrace.filter((row) => row.owner_session === 'HRIS-SYS'), 'capability_id');
  const authRows = data.modernAuth.filter((row) => row.owner_session === 'HRIS-SYS');
  need(coding.size === 3 && trace.size === 3 && delivery.size >= 3 && authRows.length === 9, 'MODERN_REGISTRY_COUNTS');
  const bodyOps = new Set(); const bodyEvents = new Set();
  for (const [capabilityId, expected] of Object.entries(MODERN)) {
    const listeningPredecessor = capabilityId === 'HRIS.MODERN.EMPLOYEE_LISTENING';
    const bodyContext = listeningPredecessor ? 'DWP_PLATFORM_HRIS_INSIGHTS' : expected.context;
    const bodyTransitionCount = listeningPredecessor ? 6 : expected.transitions;
    const bodyTables = listeningPredecessor ? LEGACY_LISTENING_TABLES : new Set(TABLE_GROUPS[expected.group]);
    const bodyEventNames = listeningPredecessor ? LEGACY_LISTENING_EVENTS : MODERN_EVENTS[capabilityId];
    const bodyTransitionIds = listeningPredecessor ? LEGACY_LISTENING_TRANSITIONS : MODERN_TRANSITIONS[capabilityId];
    const cap = caps.get(capabilityId) || {}; const ops = cap.operations || []; const transitions = (cap.stateMachines || []).flatMap((machine) => machine.transitions || []); const eventBody = cap.events || [];
    if (listeningPredecessor) {
      validateHistoricalListeningPredecessor(cap, need);
      const canonicalOperationIds = new Set(
        [...centralOps]
          .filter(([, operation]) => operation.capabilityId === capabilityId)
          .map(([operationId]) => operationId)
      );
      const canonicalTableNames = new Set(
        [...centralTables]
          .filter(([, table]) => table.capabilityId === capabilityId)
          .map(([tableName]) => tableName)
      );
      const canonicalEventNames = new Set(
        [...events]
          .filter(([, event]) => event.capabilityId === capabilityId)
          .map(([eventName]) => eventName)
      );
      need(setEq(canonicalOperationIds, MODERN_OPERATIONS[capabilityId]), 'LISTENING_CANONICAL_OPERATION_SET');
      need(setEq(canonicalTableNames, LISTENING_TABLES), 'LISTENING_CANONICAL_TABLE_SET');
      need(setEq(canonicalEventNames, MODERN_EVENTS[capabilityId]), 'LISTENING_CANONICAL_EVENT_SET');
      for (const operationId of canonicalOperationIds) {
        const operation = centralOps.get(operationId) || {};
        const reads = new Set(operation.readsTables || []);
        const writes = new Set(operation.writesTables || []);
        need(
          operation.session === 'HRIS-SYS'
            && operation.requestSchemaRef
            && operation.responseSchemaRef
            && (operation.errorSchemaRefs || []).length
            && reads.size + writes.size > 0
            && subset(new Set([...reads, ...writes]), LISTENING_TABLES),
          `LISTENING_CANONICAL_OPERATION_CONTRACT:${operationId}`
        );
      }
      canonicalOperationIds.forEach((operationId) => bodyOps.add(operationId));
      canonicalEventNames.forEach((eventName) => bodyEvents.add(eventName));
      need(setEq(new Set(cap.authorizationCapabilities || []), MODERN_AUTH[capabilityId]), 'LISTENING_HISTORICAL_AUTHORIZATION_TRACE');
      const testIds = new Set((cap.acceptanceTests || []).map((test) => test.testId));
      need(
        setEq(testIds, new Set(Array.from({length: 3}, (_, i) => `${expected.slice}-AT-${String(i + 1).padStart(3, '0')}`)) )
          && (cap.acceptanceTests || []).every((test) => test.evidencePath && test.assertion),
        `MODERN_ACCEPTANCE:${capabilityId}`
      );
      const reg = coding.get(capabilityId) || {};
      need(
        reg.api_operation_count === String(canonicalOperationIds.size)
          && reg.state_machine_count === '0'
          && reg.state_transition_count === '0'
          && reg.event_count === String(canonicalEventNames.size)
          && reg.physical_table_count === String(canonicalTableNames.size)
          && reg.acceptance_test_count === String(expected.tests),
        `MODERN_REGISTER_COUNTS:${capabilityId}`
      );
      need(setEq(new Set(split(reg.bounded_context)), LISTENING_STREAM_KEYS) && setEq(new Set(split(reg.runtime_owner)), new Set(['dwp-platform-server', 'dwp-auth-server'])) && new Set(split(reg.contract_ref)).has(LISTENING_SUMMARY_ID) && !String(reg.migration_file || '').includes('V287__') && reg.status === 'SUCCESSOR_EXACT_G3_START_AUTHORITY_NOT_IMPLEMENTED', 'LISTENING_ACTIVE_CODING_SUCCESSOR');
      const traceRow = trace.get(capabilityId) || {};
      const deliveryRow = delivery.get(capabilityId) || {};
      need(traceRow.implementation_slice_id === expected.slice && traceRow.state === 'ALLOCATED_REQUIRED_NOT_STARTED', `MODERN_TRACE:${capabilityId}`);
      need(deliveryRow.implementation_state === 'NOT_STARTED_G3' && deliveryRow.production_state === 'NOT_AUTHORIZED_G6', `MODERN_DELIVERY_STATE:${capabilityId}`);
      continue;
    }
    need(cap.boundedContext === bodyContext && cap.runtimeOwner === 'dwp-platform-server', `MODERN_PREDECESSOR_OWNER_CONTEXT:${capabilityId}`);
    need(JSON.stringify(cap.activationLayers) === JSON.stringify(['PRODUCT_CORE', 'TENANT_CONFIG']), `BOUNDARY_ESCALATION:${capabilityId}`);
    need(cap.implementationState === 'NOT_STARTED_G3' && cap.productionState === 'NOT_AUTHORIZED_G6', `MODERN_STATE:${capabilityId}`);
    need(ops.length === expected.ops && (cap.stateMachines || []).length === 1 && transitions.length === bodyTransitionCount && eventBody.length === expected.events && (cap.tables || []).length === bodyTables.size && (cap.acceptanceTests || []).length === expected.tests, `MODERN_PREDECESSOR_BODY_COUNTS:${capabilityId}`);
    if (listeningPredecessor) need(path.basename(cap.migrationFile || '') === 'V287__hris_platform_modern_employee_listening.sql', `MODERN_PREDECESSOR_MIGRATION_FILE:${capabilityId}`);
    need(setEq(new Set((cap.tables || []).map((table) => table.name)), bodyTables), `MODERN_PREDECESSOR_TABLE_BODY_SET:${capabilityId}`);
    need(setEq(new Set(ops.map((op) => op.operationId)), MODERN_OPERATIONS[capabilityId]), `MODERN_OPERATION_ID_SET:${capabilityId}`);
    need(setEq(new Set(cap.authorizationCapabilities || []), MODERN_AUTH[capabilityId]), `MODERN_BODY_AUTH_CAPABILITIES:${capabilityId}`);
    const transitionIds = new Set(transitions.map((transition) => transition.transitionId));
    need(setEq(transitionIds, bodyTransitionIds), `MODERN_PREDECESSOR_TRANSITION_ID_SET:${capabilityId}`);
    const operationIds = new Set(ops.map((op) => op.operationId));
    const internalOperationIds = new Set(transitions.filter((transition) => !operationIds.has(transition.operationId)).map((transition) => transition.operationId));
    need(setEq(internalOperationIds, MODERN_INTERNAL_OPERATIONS[capabilityId]), `MODERN_INTERNAL_OPERATION_ID_SET:${capabilityId}`);
    for (const transition of transitions) need((operationIds.has(transition.operationId) || MODERN_INTERNAL_OPERATIONS[capabilityId].has(transition.operationId)) && transition.from && transition.to && transition.guard && bodyTables.has(transition.aggregateRootTable) && transition.stateColumn && (transition.preStates || []).length && (transition.postStates || []).length && transition.postStateSource && transition.postStateSink, `MODERN_TRANSITION_INVALID:${transition.transitionId}`);
    for (const op of ops) {
      bodyOps.add(op.operationId); const exact = centralOps.get(op.operationId) || {};
      const same = op.method === exact.method && op.path === exact.path && op.action === exact.action && op.authorizationCapability === exact.authorizationCapability && JSON.stringify(op.scope) === JSON.stringify(exact.scope) && op.mode === exact.mode && op.response === exact.responseSchemaRef && op.idempotency === exact.idempotency && op.expectedVersion === exact.expectedVersion && JSON.stringify(op.transitionIds) === JSON.stringify(exact.stateTransitionIds) && JSON.stringify(op.emits) === JSON.stringify(exact.eventNames);
      need(same, `MODERN_OPERATION_DRIFT:${op.operationId}`);
      need(exact.requestSchemaRef && exact.responseSchemaRef && (exact.errorSchemaRefs || []).length, `MODERN_SCHEMA_MISSING:${op.operationId}`);
      need(subset(new Set([...(exact.readsTables || []), ...(exact.writesTables || [])]), bodyTables), `MODERN_READ_WRITE_OWNER:${op.operationId}`);
      if (op.mode === 'QUERY') need((exact.readsTables || []).length && !(exact.writesTables || []).length && !op.transitionIds.length && !op.emits.length && op.idempotency === 'READ_SAFE', `MODERN_QUERY_CONTRACT:${op.operationId}`);
      else need((exact.writesTables || []).length && op.transitionIds.length && subset(new Set(op.transitionIds), transitionIds) && op.idempotency === 'REQUIRED', `MODERN_COMMAND_WRITE_TRANSITION:${op.operationId}`);
    }
    for (const event of eventBody) {
      bodyEvents.add(event.name); const exact = events.get(event.name) || {};
      need(exact.capabilityId === capabilityId && exact.topic === event.topic && setEq(new Set(exact.emittedOnTransitionIds || []), new Set(event.emittedOn || [])), `MODERN_EVENT_DRIFT:${event.name}`);
      need(subset(new Set(event.payloadRequired || []), new Set((exact.fields || []).filter((field) => field.required === true).map((field) => field.name))), `MODERN_EVENT_PAYLOAD:${event.name}`);
      need(setEq(new Set(exact.emittedByInternalHandlerIds || []), new Set(event.emittedByInternalHandler ? [event.emittedByInternalHandler] : [])), `MODERN_EVENT_INTERNAL_HANDLER:${event.name}`);
    }
    need(setEq(new Set(eventBody.map((event) => event.name)), bodyEventNames), `MODERN_PREDECESSOR_EVENT_NAME_SET:${capabilityId}`);
    need(setEq(new Set(eventBody.flatMap((event) => event.emittedOn || [])), bodyTransitionIds), `MODERN_PREDECESSOR_EVENT_TRANSITION_CLOSURE:${capabilityId}`);
    need(setEq(new Set(eventBody.filter((event) => event.emittedByInternalHandler).map((event) => event.emittedByInternalHandler)), MODERN_INTERNAL_OPERATIONS[capabilityId]), `MODERN_INTERNAL_EVENT_CLOSURE:${capabilityId}`);
    const testIds = new Set((cap.acceptanceTests || []).map((test) => test.testId));
    need(setEq(testIds, new Set(Array.from({length: 3}, (_, i) => `${expected.slice}-AT-${String(i + 1).padStart(3, '0')}`))), `MODERN_ACCEPTANCE:${capabilityId}`);
    const reg = coding.get(capabilityId) || {};
    need(reg.api_operation_count === String(expected.ops) && reg.state_machine_count === String(listeningPredecessor ? 0 : 1) && reg.state_transition_count === String(expected.transitions) && reg.event_count === String(expected.events) && reg.physical_table_count === String(expected.tables) && reg.acceptance_test_count === String(expected.tests), `MODERN_REGISTER_COUNTS:${capabilityId}`);
    if (listeningPredecessor) need(setEq(new Set(split(reg.bounded_context)), LISTENING_STREAM_KEYS) && setEq(new Set(split(reg.runtime_owner)), new Set(['dwp-platform-server', 'dwp-auth-server'])) && new Set(split(reg.contract_ref)).has(LISTENING_SUMMARY_ID) && !String(reg.migration_file || '').includes('V287__') && reg.status === 'SUCCESSOR_EXACT_G3_START_AUTHORITY_NOT_IMPLEMENTED', 'LISTENING_ACTIVE_CODING_SUCCESSOR');
    const traceRow = trace.get(capabilityId) || {};
    const deliveryRow = delivery.get(capabilityId) || {};
    need(traceRow.implementation_slice_id === expected.slice && traceRow.state === 'ALLOCATED_REQUIRED_NOT_STARTED', `MODERN_TRACE:${capabilityId}`);
    need(deliveryRow.implementation_state === 'NOT_STARTED_G3' && deliveryRow.production_state === 'NOT_AUTHORIZED_G6', `MODERN_DELIVERY_STATE:${capabilityId}`);
  }
  need(bodyOps.size === EXPECTED_MODERN_OPERATION_COUNT && setEq(bodyOps, new Set(centralOps.keys())), 'MODERN_OPERATION_BODY_CLOSURE');
  need(bodyEvents.size === EXPECTED_MODERN_EVENT_COUNT && setEq(bodyEvents, new Set(events.keys())), 'MODERN_EVENT_BODY_CLOSURE');
  for (const [tableName, table] of centralTables) {
    const capabilityId = LISTENING_TABLES.has(tableName)
      ? 'HRIS.MODERN.EMPLOYEE_LISTENING'
      : (Object.entries(MODERN).find(([, expected]) => TABLE_GROUPS[expected.group] && TABLE_GROUPS[expected.group].includes(tableName)) || [])[0];
    need(capabilityId && table.capabilityId === capabilityId && table.rowSecurity && (table.columns || []).length, `MODERN_TABLE_OWNER:${tableName}`);
  }
  for (const row of authRows) {
    need(MODERN[row.modern_capability_id] && row.implementation_slice_id === MODERN[row.modern_capability_id].slice && row.canonical_app_entitlement === 'APP.HCM:VIEW' && JSON.stringify(split(row.enforcement_layers)) === JSON.stringify(PEP_LAYERS), `MODERN_AUTH_BINDING:${row.binding_id}`);
  }
  for (const capabilityId of Object.keys(MODERN)) {
    need(setEq(new Set(authRows.filter((row) => row.modern_capability_id === capabilityId).map((row) => row.binding_id)), MODERN_AUTH_BINDINGS[capabilityId]), `MODERN_AUTH_BINDING_ID_SET:${capabilityId}`);
    need(setEq(new Set(authRows.filter((row) => row.modern_capability_id === capabilityId).map((row) => row.canonical_capability_key)), MODERN_AUTH[capabilityId]), `MODERN_AUTH_CAPABILITY_SET:${capabilityId}`);
    need(setEq(new Set(data.ia.filter((row) => row.primary_slice_id === MODERN[capabilityId].slice).map((row) => row.query_id)), MODERN_ENTRY_QUERIES[capabilityId]), `MODERN_IA_QUERY_SET:${capabilityId}`);
    const row = g3.get(MODERN[capabilityId].slice) || {}; const primaryRefs = new Set(split(row.primary_contract_refs)); const apiRefs = new Set(split(row.api_event_contract_refs));
    need(subset(new Set([...MODERN_OPERATIONS[capabilityId], ...MODERN_EVENTS[capabilityId]]), primaryRefs), `MODERN_G3_PRIMARY_CLOSURE:${capabilityId}`);
    need([...MODERN_OPERATIONS[capabilityId]].every((operationId) => apiRefs.has(`MODOP:${operationId}`)), `MODERN_G3_OPERATION_ALIAS_CLOSURE:${capabilityId}`);
  }
  for (const [label, registry, id] of [['SEMANTIC', data.modernSemantic, 'dwp.hris.modern.operation-semantic-bindings.v1'], ['IDENTITY', data.modernIdentity, 'dwp.hris.modern.public-identities.v1']]) {
    need(registry.registryId === id && registry.status === 'SEALED_G3_DESIGN_NOT_IMPLEMENTED' && registry.sealedPayloadSha256 === registryDigest(registry), `MODERN_${label}_SEAL`);
    need(registry.canonicalContractPins && registry.canonicalContractPins['modern-capability-exact-schema-contracts.v1.json'] === sha(data._raw[PATHS.modernExact]) && registry.canonicalContractPins['modern-capability-event-payload-contracts.v1.json'] === sha(data._raw[PATHS.modernEvents]), `MODERN_${label}_PINS`);
  }
  const semanticRows = by(data.modernSemantic.operations.filter((row) => row.session === 'HRIS-SYS'), 'operationId');
  need(semanticRows.size === EXPECTED_MODERN_OPERATION_COUNT && setEq(new Set(semanticRows.keys()), bodyOps), 'MODERN_SEMANTIC_SYS_CLOSURE');
  for (const [operationId, operation] of centralOps) {
    const semantic = semanticRows.get(operationId) || {};
    need(['capabilityId', 'session', 'mode', 'readsTables', 'writesTables', 'responseSchemaRef', 'stateTransitionIds', 'eventNames'].every((key) => JSON.stringify(semantic[key]) === JSON.stringify(operation[key])), `MODERN_SEMANTIC_DRIFT:${operationId}`);
    need((semantic.requestContract || []).length && (semantic.typedSources || []).length && (semantic.responseFieldSources || []).length && semantic.mutationEvidence, `MODERN_SEMANTIC_INCOMPLETE:${operationId}`);
    if (operation.mode === 'COMMAND') need((semantic.requiredColumnSources || []).length && (semantic.receiptContracts || []).length, `MODERN_SEMANTIC_COMMAND_INCOMPLETE:${operationId}`);
    if ((operation.eventNames || []).length) need((semantic.eventFieldSources || []).length, `MODERN_SEMANTIC_EVENT_INCOMPLETE:${operationId}`);
  }

  const golden = by(data.golden, 'scenario_id');
  need(data.golden.length === 60 && setEq(new Set(golden.keys()), new Set(Array.from({length: 60}, (_, i) => `SYS-GOLD-${String(i + 1).padStart(3, '0')}`))), 'GOLDEN_EXACT_SET');
  need(data.golden.every((row) => row.status === 'READY' && row.negative_or_recovery && row.evidence_target), 'GOLDEN_EVIDENCE_INCOMPLETE');
  for (const row of manifest.sliceBindings || []) {
    const ids = row.goldenScenarioIds || []; need(ids.length && subset(new Set(ids), new Set(golden.keys())), `GOLDEN_BINDING_MISSING:${row.assuranceSliceId}`);
    if (row.assuranceSliceId !== 'TFR-SYS-013') need(subset(new Set(['TENANT', 'SOD', 'REPLAY', 'AUTHORIZATION']), new Set(ids.map((id) => (golden.get(id) || {}).area))), `GOLDEN_CROSS_CUTTING:${row.assuranceSliceId}`);
  }
  const gates = data.activation.filter((row) => ACTIVATION.has(row.activation_id));
  need(gates.length === 6 && gates.every((row) => row.gate === 'G6' && row.status === 'DEFERRED_G6_NOT_CORE_BLOCKER' && row.core_code_effect === 'DOES_NOT_BLOCK_G3_CORE' && row.production_effect.startsWith('BLOCKS_')), 'ACTIVATION_BOUNDARY');
  for (const marker of [PATHS.manifest, 'sys-exact-business-start-pin.v1.json', 'validate_sys_exact_business_start.py --self-test --compact', 'audit_sys_exact_business_start.cjs --self-test --compact', '정확히 17개 slice', '전역 Gate']) need(data.prompt.includes(marker), `PROMPT_ASSURANCE_MARKER:${marker}`);
  need(data.implementation.includes('successor of: `g2-implementation-contract.md` (`SUPERSEDED_IMMUTABLE`') && data.implementation.includes('MIG-SYS-AUTH-217-245') && data.implementation.includes('MIG-SYS-PLATFORM-262-290'), 'CURRENT_SYS_V2_AUTHORITY');

  const lineage = data.lineage || {};
  need(lineage.lineageId === 'dwp.hris.sys-exact-business-successor-lineage.v1' && lineage.status === 'CURRENT_EXACT_SUCCESSOR_LINEAGE', 'LINEAGE_ID_STATUS');
  need(lineage.successor && lineage.successor.path === PATHS.manifest && lineage.successor.sha256 === sha(data._raw[PATHS.manifest]) && lineage.successor.exactOwnedSliceCount === 17 && lineage.successor.activeSliceCount === 16 && lineage.successor.retiredSliceCount === 1, 'LINEAGE_SUCCESSOR');
  need(lineage.successor && lineage.successor.modernCapabilityCount === Object.keys(MODERN).length && lineage.successor.modernPublicOperationCount === EXPECTED_MODERN_OPERATION_COUNT && lineage.successor.modernInternalOperationCount === EXPECTED_MODERN_INTERNAL_OPERATION_COUNT && lineage.successor.modernTransitionCount === EXPECTED_MODERN_TRANSITION_COUNT && lineage.successor.modernEventCount === EXPECTED_MODERN_EVENT_COUNT && lineage.successor.modernTableCount === EXPECTED_MODERN_TABLE_COUNT, 'LINEAGE_MODERN_COUNTS');
  need(!Object.prototype.hasOwnProperty.call(lineage, 'currentSuccessorOverlays'), 'LINEAGE_LISTENING_REVERSE_AUTHORITY_FIELDS');
  need(lineage.currentPointer && lineage.currentPointer.path === PATHS.manifest, 'LINEAGE_CURRENT_POINTER');
  const predecessors = by(lineage.predecessors, 'path');
  need((predecessors.get(PATHS.canonical4) || {}).sha256 === '483ae9f1aefaa59ed2758a0d0fb0e0280b7e961fb0e1340a60e75d1bbec81b36' && (predecessors.get(PATHS.canonical4) || {}).relation === 'PRESERVED_SEALED_NON_SYS_SCOPE' && sha(data._raw[PATHS.canonical4]) === '483ae9f1aefaa59ed2758a0d0fb0e0280b7e961fb0e1340a60e75d1bbec81b36', 'CANONICAL4_PREDECESSOR');
  need((predecessors.get(PATHS.implementationPredecessor) || {}).sha256 === '2dbabebfc52c2175193821f72a3b9bf5b33b83110ed871f88e35ab07c8e0f871' && (predecessors.get(PATHS.implementationPredecessor) || {}).relation === 'HISTORICAL_SYS_G2_IMPLEMENTATION_PREDECESSOR' && sha(data._raw[PATHS.implementationPredecessor]) === '2dbabebfc52c2175193821f72a3b9bf5b33b83110ed871f88e35ab07c8e0f871', 'SYS_IMPLEMENTATION_PREDECESSOR');
  need((predecessors.get(PATHS.validatorPredecessor) || {}).sha256 === '030fd2eb4189846da9385b47606468aaf545091032b4b134f902be52662fc823' && (predecessors.get(PATHS.validatorPredecessor) || {}).relation === 'HISTORICAL_SYS_G2_VALIDATOR_PREDECESSOR' && sha(data._raw[PATHS.validatorPredecessor]) === '030fd2eb4189846da9385b47606468aaf545091032b4b134f902be52662fc823', 'SYS_VALIDATOR_PREDECESSOR');
  need(lineage.currentSysAuthorities.implementation.path === PATHS.implementation && lineage.currentSysAuthorities.implementation.sha256 === sha(data._raw[PATHS.implementation]), 'LINEAGE_IMPLEMENTATION_AUTHORITY');
  need(lineage.currentSysAuthorities.validator.path === PATHS.currentValidator && lineage.currentSysAuthorities.validator.sha256 === sha(data._raw[PATHS.currentValidator]), 'LINEAGE_VALIDATOR_AUTHORITY');
  const listeningSummary = ((lineage.currentDerivedSummaries || {}).sysListeningStreamSummary || {});
  const summaryInputSetSha = (((data.listeningSummary || {}).canonicalPrecedence || {}).generatedSummary || {}).canonicalInputSetSha256;
  need(listeningSummary.contractId === LISTENING_SUMMARY_ID && listeningSummary.path === LISTENING_SUMMARY_PATH && listeningSummary.sha256 === sha(data._raw[LISTENING_SUMMARY_PATH]) && listeningSummary.sealedPayloadSha256 === (data.listeningSummary || {}).sealedPayloadSha256 && listeningSummary.canonicalInputSetSha256 === summaryInputSetSha && listeningSummary.state === 'CURRENT_DERIVED_G3_START_SUMMARY_NOT_IMPLEMENTED', 'LINEAGE_LISTENING_DERIVED_SUMMARY');
  need(lineage.assurance && lineage.assurance.primaryValidator === PATHS.primaryValidator && lineage.assurance.independentOracle === PATHS.independentValidator && lineage.assurance.pin === PATHS.pin && lineage.assurance.exactArtifactPinCount === 49 && lineage.assurance.minimumMutationCountPerValidator === 21, 'LINEAGE_ASSURANCE');

  if (verifyPin) {
    const pin = data.pin || {}; const pins = by(pin.artifactPins, 'path');
    need(pin.pinId === 'dwp.hris.sys-exact-business-start-pin.v1' && pin.status === 'SEALED_SYS_EXACT_BUSINESS_START_PIN' && pin.exactOwnedSliceCount === 17 && pin.activeSliceCount === 16 && pin.retiredSliceCount === 1 && pin.currentArtifactPath === PATHS.manifest && pin.currentArtifactSha256 === sha(data._raw[PATHS.manifest]), 'PIN_ID_STATUS');
    need(pin.lineagePath === PATHS.lineage && pin.lineageSha256 === sha(data._raw[PATHS.lineage]), 'PIN_LINEAGE');
    const required = new Set(Object.entries(PATHS).filter(([key]) => key !== 'pin').map(([, value]) => value));
    need(pins.size === (pin.artifactPins || []).length && pin.exactArtifactCount === required.size && pins.size === required.size && setEq(new Set(pins.keys()), new Set(pin.exactArtifactPaths || [])) && setEq(new Set(pins.keys()), required), 'PIN_ARTIFACT_SET');
    for (const [relative, row] of pins) {
      const absolute = path.join(ROOT, relative); const raw = fs.existsSync(absolute) ? fs.readFileSync(absolute) : null;
      need(raw && row.sha256 === sha(raw) && row.byteCount === raw.length, `PIN_DIGEST:${relative}`);
    }
    need(pin.validatorPolicy && pin.validatorPolicy.primary === PATHS.primaryValidator && pin.validatorPolicy.independent === PATHS.independentValidator && pin.validatorPolicy.normalAndSelfTestRequired === true && pin.validatorPolicy.minimumMutationCount === 21, 'PIN_VALIDATOR_POLICY');
    need(pin.gateBoundary && pin.gateBoundary.globalGateAuthorization === 'NONE_VALIDATOR_CONTROLLED' && pin.gateBoundary.runtimeImplemented === false && pin.gateBoundary.productionAuthorized === false, 'PIN_GATE_BOUNDARY');
  }
  return [...new Set(errors)].sort();
}

const MUTATIONS = [
  ['missing-one-of-17', 'SLICE_BINDING_EXACT_SET', (d) => d.manifest.sliceBindings.pop()],
  ['source-hash-drift', 'SOURCE_HASH_TARGET', (d) => d.targets.find((r) => r.resolution_id === 'TFR-SYS-006').source_family_sha256 = '0'.repeat(64)],
  ['source-count-drift', 'SOURCE_COUNT_TARGET', (d) => d.targets.find((r) => r.resolution_id === 'TFR-SYS-007').source_row_count = '36'],
  ['source-register-drift', 'SOURCE_FAMILY_RECOMPUTE', (d) => d.sysSource.find((r) => sha(Buffer.from(r.target_api_or_event)) === SOURCE['TFR-SYS-008'][0]).target_api_or_event += '#drift'],
  ['retired-active', 'RETIRED_BECAME_ACTIVE', (d) => d.g3.find((r) => r.slice_id === 'BASE-TFR-SYS-013').gate_status = 'OPEN_G3_CODE'],
  ['primary-downgrade', 'PRIMARY_DOWNGRADE', (d) => { const r = d.g3.find((x) => x.slice_id === 'BASE-TFR-SYS-004'); const refs = split(r.primary_contract_refs); r.primary_contract_refs = refs.filter((ref) => ref !== 'SYS-API-001').join('|'); r.related_contract_refs = ['SYS-API-001', ...split(r.related_contract_refs)].join('|'); }],
  ['transition-missing', 'MODERN_PREDECESSOR_BODY_COUNTS', (d) => d.modernBody.capabilities[0].stateMachines[0].transitions.pop()],
  ['schema-missing', 'RESPONSE_SCHEMA_MISSING', (d) => d.transport.operations['SYS-API-002'].responseSchema = null],
  ['write-missing', 'MODERN_COMMAND_WRITE_TRANSITION', (d) => d.modernExact.operationBindings.find((r) => r.operationId === 'modern.ai.assist.create').writesTables = []],
  ['golden-missing', 'GOLDEN_BINDING_MISSING', (d) => d.manifest.sliceBindings.find((r) => r.assuranceSliceId === 'MOD-SYS-AI').goldenScenarioIds = []],
  ['table-owner-mismatch', 'MODERN_TABLE_OWNER', (d) => d.modernExact.tableSpecifications.find((r) => r.tableName === 'sys_hris_ai_use_policies').capabilityId = 'HRIS.MODERN.PEOPLE_ANALYTICS'],
  ['thirteenth-modern-table-missing', 'MODERN_PREDECESSOR_CENTRAL_TABLE_SET', (d) => d.modernExact.tableSpecifications = d.modernExact.tableSpecifications.filter((r) => r.tableName !== 'sys_hris_ai_evaluation_requests')],
  ['migration-mismatch', 'PLATFORM_MIGRATION_AUTHORITY', (d) => d.migrations.find((r) => r.allocation_id === 'MIG-SYS-PLATFORM-262-290').allocated_version = '262-300'],
  ['ia-pep-mismatch', 'IA_PEP_METHOD', (d) => d.ia.find((r) => r.query_id === 'IAQ-066').pep_layers = 'GATEWAY_APP_ENTITLEMENT'],
  ['pep-operation-mismatch', 'PEP_OPERATION_DRIFT', (d) => d.pep.find((r) => r.binding_id === 'PEP-SYS-001').contract_path = '/wrong'],
  ['duty-mismatch', 'PEP_DUTY_MISMATCH', (d) => d.duties.find((r) => r.duty_code === 'HRIS_DUTY_POLICY_AUTHOR').capability_key = 'hcm.wrong'],
  ['boundary-escalation', 'BOUNDARY_ESCALATION', (d) => d.modernBody.capabilities[0].activationLayers.push('REAL_PROVIDER_ADAPTER')],
  ['prompt-regression', 'PROMPT_ASSURANCE_MARKER', (d) => d.prompt = d.prompt.replace('sys-exact-business-start-successor.v1.json', 'module-exact-business-start-canonical.v1.json')],
  ['pointer-regression', 'CURRENT_POINTER_REGRESSION', (d) => d.manifest.currentPointer.currentPath = PATHS.canonical4],
  ['semantic-drift', 'MODERN_SEMANTIC_DRIFT', (d) => d.modernSemantic.operations.find((r) => r.operationId === 'modern.ai.assist.create').writesTables = []],
  ['token-drift', 'G3_TOKEN', (d) => d.g3.find((r) => r.slice_id === 'MOD-SYS-AI').code_go_token = 'G3-CODE-GO-WRONG'],
  ['listening-stream-missing', 'LISTENING_STREAM_SET', (d) => d.listeningSummary.authorityStreams.pop()],
  ['listening-seal-tampered', 'LISTENING_SUMMARY_SEAL', (d) => d.listeningSummary.sealedPayloadSha256 = '0'.repeat(64)],
  ['listening-summary-stale-manifest-pin', 'LISTENING_MANIFEST_DERIVED_SUMMARY_PIN', (d) => d.manifest.sliceBindings.find((r) => r.assuranceSliceId === 'MOD-SYS-LISTEN').derivedSummaryFileSha256 = '0'.repeat(64)],
  ['listening-shared-schema', 'LISTENING_STREAM_DISTINCT:databaseSchema', (d) => d.listeningSummary.authorityStreams[1].databaseSchema = d.listeningSummary.authorityStreams[0].databaseSchema],
  ['listening-cross-stream-local-fk', 'LISTENING_TABLE_BOUNDARY', (d) => d.listeningSummary.tableOwnership.find((r) => r.tableName === 'sys_hris_listening_responses').localForeignKeys[0].targetTable = 'sys_hris_listening_surveys'],
  ['listening-raw-response-public-event', 'LISTENING_PUBLIC_EVENT_SET', (d) => d.listeningSummary.eventOwnership.canonicalPublicEvents[0].eventName = 'EmployeeListeningResponseSubmitted.v2'],
  ['listening-both-service-binding-missing', 'LISTENING_SERVICE_SET', (d) => d.listeningSummary.authorityStreams.find((r) => r.streamKey === 'auth-hris-participation-issuer').ownerService = 'dwp-platform-server'],
  ['listening-single-v287-restored', 'LISTENING_MIGRATION_RESERVATION', (d) => d.listeningSummary.migrationReservations[0].firstReservedMigration = 'V287__hris_platform_modern_employee_listening.sql'],
  ['listening-admin-reentry-query-missing', 'LISTENING_ADMIN_SURVEY_REENTRY_QUERY', (d) => d.listeningSummary.publicOperationBindings = d.listeningSummary.publicOperationBindings.filter((row) => row.operationId !== 'modern.listening.surveys.query')],
  ['listening-survey-revise-missing', 'LISTENING_OPERATION_SET', (d) => d.listeningSummary.publicOperationBindings = d.listeningSummary.publicOperationBindings.filter((row) => row.operationId !== 'modern.listening.survey.revise')],
  ['listening-survey-revise-cas-widened', 'LISTENING_SURVEY_REVISE_CAS_CONTRACT', (d) => d.listeningSummary.publicOperationBindings.find((row) => row.operationId === 'modern.listening.survey.revise').stateContract = 'ANY_TO_DRAFT_NO_CAS'],
  ['listening-owner-local-handler-set-missing', 'LISTENING_OWNER_LOCAL_HANDLER_SET', (d) => d.listeningSummary.ownerLocalHandlers = []],
  ['listening-erasure-request-producer-missing', 'LISTENING_OWNER_LOCAL_HANDLER_SET', (d) => d.listeningSummary.ownerLocalHandlers = d.listeningSummary.ownerLocalHandlers.filter((row) => row.handlerId !== LISTENING_OWNER_LOCAL_ERASURE_REQUEST_HANDLER)],
  ['listening-erasure-request-status-widened', 'LISTENING_OWNER_LOCAL_ERASURE_REQUEST_HANDLER', (d) => d.listeningSummary.ownerLocalHandlers.find((row) => row.handlerId === LISTENING_OWNER_LOCAL_ERASURE_REQUEST_HANDLER).initialStatus = 'CLAIMED'],
  ['listening-internal-message-handler-missing', 'LISTENING_OWNER_LOCAL_HANDLER_SET', (d) => d.listeningSummary.ownerLocalHandlers = d.listeningSummary.ownerLocalHandlers.filter((row) => row.messageName !== 'ListeningAdmissionInstallRequested.v1')],
  ['listening-internal-message-handler-non-atomic', 'LISTENING_INTERNAL_MESSAGE_HANDLER:ListeningCohortPackageReady.v1', (d) => d.listeningSummary.ownerLocalHandlers.find((row) => row.messageName === 'ListeningCohortPackageReady.v1').transactionBoundary = 'INBOX_THEN_EVENTUAL_DOMAIN'],
  ['listening-internal-message-handler-cross-owner', 'LISTENING_INTERNAL_MESSAGE_HANDLER:ListeningAdmissionInstallReceipt.v1', (d) => d.listeningSummary.ownerLocalHandlers.find((row) => row.messageName === 'ListeningAdmissionInstallReceipt.v1').inboxLedgerTable = 'sys_hris_listening_protected_receipts'],
  ['listening-erasure-owner-port-missing', 'LISTENING_OWNER_PORT_SET', (d) => d.listeningSummary.ownerPortOperations = d.listeningSummary.ownerPortOperations.filter((row) => row.ownerPortOperation !== 'protected.requestErasure')],
  ['listening-legacy-slice-authority-field', 'LISTENING_MANIFEST_REVERSE_AUTHORITY_FIELDS', (d) => d.manifest.sliceBindings.find((row) => row.assuranceSliceId === 'MOD-SYS-LISTEN').successorAuthorityRef = LISTENING_SUMMARY_ID],
  ['listening-legacy-authoritative-source', 'LISTENING_PRIMARY_SUMMARY_SOURCE_FORBIDDEN', (d) => d.manifest.authoritativeSources.sysListeningStreamAuthority = LISTENING_SUMMARY_PATH],
  ['listening-legacy-lineage-overlay', 'LINEAGE_LISTENING_REVERSE_AUTHORITY_FIELDS', (d) => d.lineage.currentSuccessorOverlays = {sysListeningStreamAuthority: {contractId: LISTENING_SUMMARY_ID}}]
];

function runSelfTests() {
  const baseline = loadData(); const baselineErrors = audit(baseline, true);
  if (baselineErrors.length) return {results: [], errors: ['SELFTEST_BASELINE_INVALID', ...baselineErrors]};
  const results = []; const errors = [];
  for (const [name, expected, mutate] of MUTATIONS) {
    const data = loadData(); mutate(data); const actual = audit(data, false); const pass = actual.some((item) => item.includes(expected));
    results.push({name, status: pass ? 'PASS' : 'FAIL', expected, errorCount: actual.length});
    if (!pass) errors.push(`SELFTEST_MUTATION_ACCEPTED:${name}:expected=${expected}:actual=${actual.slice(0, 5).join('|')}`);
  }
  return {results, errors};
}

function main() {
  const selfTest = process.argv.includes('--self-test'); const compact = process.argv.includes('--compact');
  const data = loadData(); const errors = audit(data, true); let selfTests = [];
  if (selfTest && !errors.length) { const outcome = runSelfTests(); selfTests = outcome.results; errors.push(...outcome.errors); }
  const raw = data._raw;
  const payload = {
    validator: 'SYS_EXACT_BUSINESS_START_INDEPENDENT_NODE_ORACLE_V1',
    status: errors.length ? 'FAIL' : 'PASS',
    scope: '17_SYS_EXACT_BUSINESS_G3_DESIGN_SLICES_NOT_GLOBAL_GATE',
    counts: {ownedSlices: 17, sourceFamilies: 14, baseContracts: 84, baseRuntimeOperations: 77, publicPepBindings: 77, entryQueries: 13, modernCapabilities: Object.keys(MODERN).length, modernOperations: EXPECTED_MODERN_OPERATION_COUNT, modernInternalOperations: EXPECTED_MODERN_INTERNAL_OPERATION_COUNT, modernTransitions: EXPECTED_MODERN_TRANSITION_COUNT, modernEvents: EXPECTED_MODERN_EVENT_COUNT, modernTables: EXPECTED_MODERN_TABLE_COUNT, listeningStreams: 4, mutationSelfTests: selfTests.length},
    digests: {successor: raw[PATHS.manifest] ? sha(raw[PATHS.manifest]) : '', lineage: raw[PATHS.lineage] ? sha(raw[PATHS.lineage]) : '', pin: raw[PATHS.pin] ? sha(raw[PATHS.pin]) : ''},
    selfTests: selfTest ? selfTests : null,
    errors
  };
  process.stdout.write(`${JSON.stringify(payload, null, compact ? 0 : 2)}\n`);
  process.exitCode = errors.length ? 1 : 0;
}

module.exports = {audit, loadData, runSelfTests, mutations: MUTATIONS};
if (require.main === module) main();
