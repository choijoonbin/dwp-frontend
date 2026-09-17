import { axiosInstance } from '../axios-instance';
import {
  adminV2Array,
  adminV2Identifier,
  adminV2Record,
  adminV2Text,
  adminV2Version,
} from './approval-admin-v2-contract-core';
import {
  approvalAdminV2Base64Url as base64Url,
  approvalAdminV2Boolean as booleanValue,
  approvalAdminV2Command as command,
  approvalAdminV2Enum as enumValue,
  approvalAdminV2Identifier as identifier,
  approvalAdminV2Integer as integer,
  approvalAdminV2IsoInstant as isoInstant,
  approvalAdminV2Object as objectValue,
  approvalAdminV2Sha256 as sha256,
  approvalAdminV2Text as text,
  approvalAdminV2Version as version,
  invalidApprovalAdminV2Command as invalid,
} from './approval-admin-v2-command-contract';
import { APPROVAL_ADMIN_V2_ENDPOINTS } from './approval-admin-v2-endpoints';
import { approvalHighRiskMutationExecutionConfig } from './approval-governed-mutation';

import type { ApiResponse } from '../types';
import type { components as GatewayComponents } from '@dwp-frontend/api-contracts';
import type {
  ApprovalAdminV2CommandReceipt,
  ApprovalAdminV2HighRiskCommand,
} from './approval-admin-v2-command-contract';
import type { ApprovalMutationExecution } from './approval-governed-mutation';

export type {
  ApprovalAdminV2CommandReceipt,
  ApprovalAdminV2CommandResponse,
  ApprovalAdminV2HighRiskCommand,
} from './approval-admin-v2-command-contract';

type Schemas = GatewayComponents['schemas'];

export const APPROVAL_ADMIN_V2_OPERATIONS_ROUTE_MATRIX = [
  ['GET', '/api/approvals/v1/admin/operations/audit-records/events'],
  ['GET', '/api/approvals/v1/admin/operations/audit-records/events/{eventId}'],
  [
    'GET',
    '/api/approvals/v1/admin/operations/audit-records/requests/{requestId}/retention-linkage',
  ],
  ['GET', '/api/approvals/v1/admin/operations/audit-records/saved-views'],
  ['GET', '/api/approvals/v1/admin/operations/audit-records/saved-views/{savedViewId}'],
  ['POST', '/api/approvals/v1/admin/operations/audit-records/saved-views'],
  ['GET', '/api/approvals/v1/admin/operations/audit-records/exports/{exportId}'],
  ['POST', '/api/approvals/v1/admin/operations/audit-records/exports'],
  [
    'POST',
    '/api/approvals/v1/admin/operations/audit-records/exports/{exportId}/external-attestations',
  ],
  ['GET', '/api/approvals/v1/admin/operations/analytics/metric-definitions'],
  ['GET', '/api/approvals/v1/admin/operations/analytics/dashboard'],
  ['GET', '/api/approvals/v1/admin/operations/analytics/cohorts/{cohortKey}/representatives'],
  ['GET', '/api/approvals/v1/admin/operations/deployments/dashboard'],
  ['GET', '/api/approvals/v1/admin/operations/deployments/packages'],
  ['GET', '/api/approvals/v1/admin/operations/deployments/packages/{packageId}'],
  ['GET', '/api/approvals/v1/admin/operations/deployments/package-diff'],
  ['POST', '/api/approvals/v1/admin/operations/deployments/packages'],
  ['GET', '/api/approvals/v1/admin/operations/deployments/promotions'],
  ['GET', '/api/approvals/v1/admin/operations/deployments/promotions/{promotionId}'],
  ['POST', '/api/approvals/v1/admin/operations/deployments/promotions'],
  ['POST', '/api/approvals/v1/admin/operations/deployments/promotions/{promotionId}/approval'],
  ['POST', '/api/approvals/v1/admin/operations/deployments/promotions/{promotionId}/schedule'],
  ['POST', '/api/approvals/v1/admin/operations/deployments/promotions/{promotionId}/activation'],
  [
    'POST',
    '/api/approvals/v1/admin/operations/deployments/promotions/{promotionId}/activation-evidence',
  ],
  [
    'GET',
    '/api/approvals/v1/admin/operations/deployments/promotions/{promotionId}/rollback-feasibility',
  ],
  ['POST', '/api/approvals/v1/admin/operations/deployments/promotions/{promotionId}/rollback'],
  [
    'POST',
    '/api/approvals/v1/admin/operations/deployments/promotions/{promotionId}/rollback-evidence',
  ],
] as const;

type DispatchOptions = Readonly<{ beforeDispatch: () => void }>;

export function approvalRoutingRetireCommand(
  groupId: string,
  expectedVersion: number,
  acknowledgedImpact: number
): ApprovalAdminV2HighRiskCommand {
  if (!Number.isSafeInteger(acknowledgedImpact) || acknowledgedImpact < 0) invalid();
  const payload = { expectedVersion: version(expectedVersion), acknowledgedImpact };
  return command({
    routeContractKey: 'route.approvals.admin.routing-directory-retire.action',
    commandPath: APPROVAL_ADMIN_V2_ENDPOINTS.routing.retireGroup(identifier(groupId)),
    targetType: 'ROUTING_GROUP',
    targetId: groupId,
    expectedObjectVersion: expectedVersion,
    proofPayload: payload,
    requestBody: payload,
    response: 'ROUTING_GROUP',
  });
}

export function approvalRoutingPublishCommand(
  groupId: string,
  expectedVersion: number
): ApprovalAdminV2HighRiskCommand {
  const payload = { expectedVersion: version(expectedVersion) };
  return command({
    routeContractKey: 'route.approvals.admin.routing-directory-publish.action',
    commandPath: APPROVAL_ADMIN_V2_ENDPOINTS.routing.publishGroup(identifier(groupId)),
    targetType: 'ROUTING_GROUP',
    targetId: groupId,
    expectedObjectVersion: expectedVersion,
    proofPayload: payload,
    requestBody: payload,
    response: 'ROUTING_GROUP',
  });
}

export function approvalPolicyUpdateCommand(input: {
  policyId: string;
  expectedVersion: number;
  changeReason: string;
  enforcementMode: 'BLOCK' | 'WARN' | 'MONITOR';
  lifecycleState: 'ACTIVE' | 'DISABLED' | 'RETIRED';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  rule: Readonly<Record<string, unknown>>;
}): ApprovalAdminV2HighRiskCommand {
  const payload = {
    expectedVersion: version(input.expectedVersion),
    changeReason: text(input.changeReason, 10, 1000),
    enforcementMode: enumValue(input.enforcementMode, ['BLOCK', 'WARN', 'MONITOR']),
    lifecycleState: enumValue(input.lifecycleState, ['ACTIVE', 'DISABLED', 'RETIRED']),
    severity: enumValue(input.severity, ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    rule: objectValue(input.rule),
  } satisfies Schemas['approval_UpdatePolicyRequest'];
  return command({
    routeContractKey: 'route.approvals.admin.policy-update.action',
    commandMethod: 'PUT',
    commandPath: APPROVAL_ADMIN_V2_ENDPOINTS.policies.policy(input.policyId),
    targetType: 'APPROVAL_POLICY',
    targetId: input.policyId,
    expectedObjectVersion: input.expectedVersion,
    proofPayload: payload,
    requestBody: payload,
    response: 'POLICY_LIST',
  });
}

export function approvalPolicyPublishCommand(input: {
  policyId: string;
  expectedVersion: number;
  reviewComment: string;
}): ApprovalAdminV2HighRiskCommand {
  const payload = {
    expectedVersion: version(input.expectedVersion),
    reviewComment: text(input.reviewComment, 10, 1000),
  } satisfies Schemas['approval_PublishPolicyRequest'];
  return command({
    routeContractKey: 'route.approvals.admin.policy-publish.action',
    commandPath: APPROVAL_ADMIN_V2_ENDPOINTS.policies.publish(input.policyId),
    targetType: 'APPROVAL_POLICY',
    targetId: input.policyId,
    expectedObjectVersion: input.expectedVersion,
    proofPayload: payload,
    requestBody: payload,
    response: 'POLICY_LIST',
  });
}

export function approvalAutomationPolicyPublishCommand(input: {
  policyId: string;
  revisionId: string;
  expectedVersion: number;
  reviewEvidenceSha256: string;
}): ApprovalAdminV2HighRiskCommand {
  const payload = {
    revisionId: identifier(input.revisionId),
    expectedVersion: version(input.expectedVersion),
    reviewEvidenceSha256: sha256(input.reviewEvidenceSha256),
  } satisfies Schemas['approval_PublishCommand'];
  return command({
    routeContractKey: 'route.approvals.admin.policy-automation-publish.action',
    commandPath: APPROVAL_ADMIN_V2_ENDPOINTS.policies.publishRule(input.policyId),
    targetType: 'APPROVAL_AUTOMATION_POLICY',
    targetId: input.policyId,
    expectedObjectVersion: input.expectedVersion,
    proofPayload: payload,
    requestBody: payload,
    response: 'POLICY_AUTOMATION',
  });
}

export function approvalConnectorProbeCommand(input: {
  connectorId: string;
  expectedVersion: number;
  probeId: string;
  revisionId: string;
  requestSha256: string;
}): ApprovalAdminV2HighRiskCommand {
  const payload = {
    probeId: identifier(input.probeId),
    revisionId: identifier(input.revisionId),
    probeKind: 'READINESS',
    requestSha256: sha256(input.requestSha256),
    expectedConnectorVersion: version(input.expectedVersion),
  };
  return command({
    routeContractKey: 'route.approvals.admin.connector-command.action',
    commandPath: APPROVAL_ADMIN_V2_ENDPOINTS.connectors.probes(identifier(input.connectorId)),
    targetType: 'CONNECTOR',
    targetId: input.connectorId,
    responseTargetId: input.probeId,
    expectedObjectVersion: input.expectedVersion,
    proofPayload: payload,
    requestBody: payload,
    response: 'CONNECTOR_PROBE',
    responseVersionPolicy: 'NON_NEGATIVE',
  });
}

export function approvalConnectorPublishCommand(input: {
  connectorId: string;
  expectedVersion: number;
  revisionId: string;
  verifiedProbeId: string;
  reviewEvidenceSha256: string;
}): ApprovalAdminV2HighRiskCommand {
  const payload = {
    revisionId: identifier(input.revisionId),
    verifiedProbeId: identifier(input.verifiedProbeId),
    expectedVersion: version(input.expectedVersion),
    reviewEvidenceSha256: sha256(input.reviewEvidenceSha256),
  };
  return command({
    routeContractKey: 'route.approvals.admin.connector-command.action',
    commandPath: APPROVAL_ADMIN_V2_ENDPOINTS.connectors.publish(identifier(input.connectorId)),
    targetType: 'CONNECTOR',
    targetId: input.connectorId,
    expectedObjectVersion: input.expectedVersion,
    proofPayload: payload,
    requestBody: payload,
    response: 'CONNECTOR',
  });
}

export function approvalIncidentStageStartCommand(input: {
  incidentId: string;
  planId: string;
  stageNumber: number;
  expectedPlanVersion: number;
  expectedStageVersion: number;
  executionKey: string;
}): ApprovalAdminV2HighRiskCommand {
  if (
    !Number.isSafeInteger(input.stageNumber) ||
    input.stageNumber < 1 ||
    input.stageNumber > 100
  ) {
    invalid();
  }
  const payload = {
    stageNumber: input.stageNumber,
    expectedPlanVersion: version(input.expectedPlanVersion),
    expectedStageVersion: version(input.expectedStageVersion),
    executionKey: text(input.executionKey, 1, 120),
  };
  return command({
    routeContractKey: 'route.approvals.admin.incident-command.action',
    commandPath: APPROVAL_ADMIN_V2_ENDPOINTS.incidents.startStage(
      identifier(input.incidentId),
      identifier(input.planId),
      input.stageNumber
    ),
    targetType: 'INCIDENT_RECOVERY_PLAN',
    targetId: input.planId,
    expectedObjectVersion: input.expectedPlanVersion,
    proofPayload: payload,
    requestBody: payload,
    response: 'INCIDENT_PLAN',
  });
}

export function approvalIncidentDiagnosticCommand(input: {
  incidentId: string;
  expectedIncidentVersion: number;
  diagnosticId: string;
  diagnosticKind: string;
  observedAt: string;
  payload: Readonly<Record<string, unknown>>;
  sourceRevision: string;
}): ApprovalAdminV2HighRiskCommand {
  const payload = {
    diagnosticId: identifier(input.diagnosticId),
    diagnosticKind: text(input.diagnosticKind, 1, 80),
    expectedIncidentVersion: version(input.expectedIncidentVersion),
    observedAt: isoInstant(input.observedAt),
    payload: objectValue(input.payload),
    sourceRevision: text(input.sourceRevision, 1, 200),
  } satisfies Schemas['approval_DiagnosticCommand'];
  return command({
    routeContractKey: 'route.approvals.admin.incident-command.action',
    commandPath: APPROVAL_ADMIN_V2_ENDPOINTS.incidents.diagnostics(input.incidentId),
    targetType: 'APPROVAL_INCIDENT',
    targetId: input.incidentId,
    responseTargetId: input.diagnosticId,
    expectedObjectVersion: input.expectedIncidentVersion,
    proofPayload: payload,
    requestBody: payload,
    response: 'INCIDENT_DIAGNOSTIC',
    responseVersionPolicy: 'OMITTED',
  });
}

export function approvalIncidentPlanCreateCommand(input: {
  incidentId: string;
  expectedIncidentVersion: number;
  planId: string;
  planKind: 'REPLAY' | 'RECONCILE' | 'REASSIGN' | 'MIXED';
  stages: readonly Readonly<{
    stageNumber: number;
    actionKind: 'REPLAY' | 'RECONCILE' | 'REASSIGN' | 'VERIFY';
    targetType: 'OUTBOX_EVENT' | 'APPROVAL_TASK' | 'CONNECTOR' | 'POLICY';
    targetId: string;
    expectedTargetVersion: number;
  }>[];
  targetSnapshot: Readonly<Record<string, unknown>>;
}): ApprovalAdminV2HighRiskCommand {
  if (input.stages.length < 1 || input.stages.length > 100) invalid();
  const stages = input.stages.map((stage) => ({
    stageNumber: integer(stage.stageNumber, 1, 100),
    actionKind: enumValue(stage.actionKind, ['REPLAY', 'RECONCILE', 'REASSIGN', 'VERIFY']),
    targetType: enumValue(stage.targetType, [
      'OUTBOX_EVENT',
      'APPROVAL_TASK',
      'CONNECTOR',
      'POLICY',
    ]),
    targetId: identifier(stage.targetId),
    expectedTargetVersion: version(stage.expectedTargetVersion),
  }));
  if (new Set(stages.map((stage) => stage.stageNumber)).size !== stages.length) invalid();
  const payload = {
    expectedIncidentVersion: version(input.expectedIncidentVersion),
    planId: identifier(input.planId),
    planKind: enumValue(input.planKind, ['REPLAY', 'RECONCILE', 'REASSIGN', 'MIXED'] as const),
    stages: stages.sort((left, right) => left.stageNumber - right.stageNumber),
    targetSnapshot: objectValue(input.targetSnapshot),
  } satisfies Schemas['approval_CreatePlan'];
  return command({
    routeContractKey: 'route.approvals.admin.incident-command.action',
    commandPath: APPROVAL_ADMIN_V2_ENDPOINTS.incidents.recoveryPlans(input.incidentId),
    targetType: 'APPROVAL_INCIDENT',
    targetId: input.incidentId,
    responseTargetId: input.planId,
    expectedObjectVersion: input.expectedIncidentVersion,
    proofPayload: payload,
    requestBody: payload,
    response: 'INCIDENT_PLAN',
    responseVersionPolicy: 'NON_NEGATIVE',
  });
}

export function approvalIncidentPlanDryRunCommand(input: {
  incidentId: string;
  planId: string;
  expectedPlanVersion: number;
  executable: boolean;
  evidenceSha256: string;
  result: Readonly<Record<string, unknown>>;
}): ApprovalAdminV2HighRiskCommand {
  const payload = {
    expectedPlanVersion: version(input.expectedPlanVersion),
    executable: booleanValue(input.executable),
    evidenceSha256: sha256(input.evidenceSha256),
    result: objectValue(input.result),
  } satisfies Schemas['approval_DryRunObservation'];
  return command({
    routeContractKey: 'route.approvals.admin.incident-command.action',
    commandPath: APPROVAL_ADMIN_V2_ENDPOINTS.incidents.dryRun(input.incidentId, input.planId),
    targetType: 'INCIDENT_RECOVERY_PLAN',
    targetId: input.planId,
    expectedObjectVersion: input.expectedPlanVersion,
    proofPayload: payload,
    requestBody: payload,
    response: 'INCIDENT_PLAN',
  });
}

export function approvalIncidentStageCompleteCommand(input: {
  incidentId: string;
  planId: string;
  stageNumber: number;
  expectedPlanVersion: number;
  expectedStageVersion: number;
  evidencePayloadBase64Url: string;
  evidenceSignatureBase64Url: string;
}): ApprovalAdminV2HighRiskCommand {
  const stageNumber = integer(input.stageNumber, 1, 100);
  const payload = {
    stageNumber,
    expectedPlanVersion: version(input.expectedPlanVersion),
    expectedStageVersion: version(input.expectedStageVersion),
    receipt: {
      evidencePayloadBase64Url: base64Url(input.evidencePayloadBase64Url, 1, 12_000),
      evidenceSignatureBase64Url: base64Url(input.evidenceSignatureBase64Url, 1, 512),
    },
  } satisfies Schemas['approval_StageCompletion'];
  return command({
    routeContractKey: 'route.approvals.admin.incident-command.action',
    commandPath: APPROVAL_ADMIN_V2_ENDPOINTS.incidents.completeStage(
      input.incidentId,
      input.planId,
      stageNumber
    ),
    targetType: 'INCIDENT_RECOVERY_PLAN',
    targetId: input.planId,
    expectedObjectVersion: input.expectedPlanVersion,
    proofPayload: payload,
    requestBody: payload,
    response: 'INCIDENT_PLAN',
  });
}

export function approvalIncidentPlanReconcileCommand(input: {
  incidentId: string;
  planId: string;
  expectedPlanVersion: number;
}): ApprovalAdminV2HighRiskCommand {
  const payload = {
    expectedVersion: version(input.expectedPlanVersion),
  } satisfies Schemas['approval_ReconcileCommand'];
  return command({
    routeContractKey: 'route.approvals.admin.incident-command.action',
    commandPath: APPROVAL_ADMIN_V2_ENDPOINTS.incidents.reconcile(input.incidentId, input.planId),
    targetType: 'INCIDENT_RECOVERY_PLAN',
    targetId: input.planId,
    expectedObjectVersion: input.expectedPlanVersion,
    proofPayload: payload,
    requestBody: payload,
    response: 'INCIDENT_PLAN',
  });
}

export function approvalIncidentPostmortemCommand(input: {
  incidentId: string;
  expectedIncidentVersion: number;
  postmortemId: string;
  summary: string;
  contributingFactors: readonly string[];
  correctiveActions: readonly string[];
  evidenceSha256: string;
}): ApprovalAdminV2HighRiskCommand {
  if (
    input.contributingFactors.length < 1 ||
    input.contributingFactors.length > 100 ||
    input.correctiveActions.length < 1 ||
    input.correctiveActions.length > 100
  ) {
    invalid();
  }
  const payload = {
    postmortemId: identifier(input.postmortemId),
    expectedIncidentVersion: version(input.expectedIncidentVersion),
    summary: text(input.summary, 10, 4000),
    contributingFactors: input.contributingFactors.map((item) => text(item, 1, 1000)),
    correctiveActions: input.correctiveActions.map((item) => text(item, 1, 1000)),
    evidenceSha256: sha256(input.evidenceSha256),
  } satisfies Schemas['approval_PostmortemCommand'];
  return command({
    routeContractKey: 'route.approvals.admin.incident-command.action',
    commandPath: APPROVAL_ADMIN_V2_ENDPOINTS.incidents.postmortem(input.incidentId),
    targetType: 'APPROVAL_INCIDENT',
    targetId: input.incidentId,
    responseTargetId: input.postmortemId,
    expectedObjectVersion: input.expectedIncidentVersion,
    proofPayload: payload,
    requestBody: payload,
    response: 'INCIDENT_POSTMORTEM',
    responseVersionPolicy: 'NON_NEGATIVE',
  });
}

export function approvalAuditExportCommand(input: {
  exportId: string;
  requestId: string;
  from: string;
  to: string;
}): ApprovalAdminV2HighRiskCommand {
  const payload = {
    exportId: identifier(input.exportId),
    accessLevel: 'METADATA',
    filter: {
      from: isoInstant(input.from),
      to: isoInstant(input.to),
      eventTypes: [],
      outcomes: [],
      requestId: identifier(input.requestId),
      limit: 100,
    },
  };
  return command({
    routeContractKey: 'route.approvals.admin.audit-export-create.action',
    commandPath: APPROVAL_ADMIN_V2_ENDPOINTS.audit.exports,
    targetType: 'APPROVAL_AUDIT_EXPORT',
    targetId: input.exportId,
    expectedObjectVersion: 0,
    proofPayload: payload,
    requestBody: payload,
    response: 'AUDIT_EXPORT',
  });
}

function approvalAuditFilter(input: {
  from: string;
  to: string;
  requestId?: string;
  eventTypes?: readonly string[];
  outcomes?: readonly string[];
  text?: string;
  limit?: number;
}): Schemas['approval_ApprovalAuditSearchInput'] {
  const from = isoInstant(input.from);
  const to = isoInstant(input.to);
  if (Date.parse(from) > Date.parse(to)) invalid();
  const eventTypes = [...new Set((input.eventTypes ?? []).map((item) => text(item, 1, 120)))];
  const outcomes = [...new Set((input.outcomes ?? []).map((item) => text(item, 1, 80)))];
  if (eventTypes.length > 100 || outcomes.length > 100) invalid();
  return {
    from,
    to,
    eventTypes,
    outcomes,
    ...(input.requestId ? { requestId: identifier(input.requestId) } : {}),
    ...(input.text ? { text: text(input.text, 1, 160) } : {}),
    limit: integer(input.limit ?? 100, 1, 500),
  };
}

export function approvalAuditSavedViewCreateCommand(input: {
  savedViewId: string;
  name: string;
  visibility: 'PERSONAL' | 'SHARED';
  filter: Parameters<typeof approvalAuditFilter>[0];
}): ApprovalAdminV2HighRiskCommand {
  const payload = {
    savedViewId: identifier(input.savedViewId),
    name: text(input.name, 1, 120),
    visibility: enumValue(input.visibility, ['PERSONAL', 'SHARED']),
    filter: approvalAuditFilter(input.filter),
  } satisfies Schemas['approval_ApprovalAuditSavedViewCreate'];
  return command({
    routeContractKey: 'route.approvals.admin.audit-saved-view-create.action',
    commandPath: APPROVAL_ADMIN_V2_ENDPOINTS.audit.savedViews,
    targetType: 'APPROVAL_AUDIT_SAVED_VIEW',
    targetId: input.savedViewId,
    expectedObjectVersion: 0,
    proofPayload: payload,
    requestBody: payload,
    response: 'AUDIT_SAVED_VIEW',
    responseVersionPolicy: 'NON_NEGATIVE',
  });
}

export function approvalAuditExternalAttestationCommand(input: {
  exportId: string;
  expectedExportVersion: number;
  type: string;
  reference: string;
  attestedAt: string;
  evidencePayloadBase64Url: string;
  evidenceSignatureBase64Url: string;
}): ApprovalAdminV2HighRiskCommand {
  const payload = {
    type: text(input.type, 1, 32),
    reference: text(input.reference, 1, 500),
    attestedAt: isoInstant(input.attestedAt),
    evidencePayloadBase64Url: base64Url(input.evidencePayloadBase64Url, 1, 12_000),
    evidenceSignatureBase64Url: base64Url(input.evidenceSignatureBase64Url, 1, 256),
  } satisfies Schemas['approval_ApprovalAuditExternalAttestation'];
  return command({
    routeContractKey: 'route.approvals.admin.audit-export-attestation.action',
    commandPath: APPROVAL_ADMIN_V2_ENDPOINTS.audit.externalAttestations(input.exportId),
    targetType: 'APPROVAL_AUDIT_EXPORT',
    targetId: input.exportId,
    expectedObjectVersion: input.expectedExportVersion,
    proofPayload: payload,
    requestBody: payload,
    response: 'AUDIT_EXPORT',
  });
}

function deploymentCommand(input: {
  promotionId: string;
  expectedVersion: number;
  routeContractKey: string;
  commandPath: string;
  proofPayload: unknown;
  requestBody?: Readonly<Record<string, unknown>>;
}): ApprovalAdminV2HighRiskCommand {
  return command({
    ...input,
    targetType: 'APPROVAL_DEPLOYMENT_PROMOTION',
    targetId: input.promotionId,
    expectedObjectVersion: input.expectedVersion,
    response: 'DEPLOYMENT_PROMOTION',
  });
}

export function approvalDeploymentPackageCreateCommand(input: {
  packageId: string;
  packageKey: string;
  packageVersion: number;
  displayName: string;
  assets: readonly Readonly<{
    assetId: string;
    assetKey: string;
    assetType: 'FORM' | 'WORKFLOW' | 'POLICY' | 'TEMPLATE';
    assetVersion: string;
    contentSha256: string;
    rollbackDisposition: 'REVERSIBLE' | 'CONDITIONAL' | 'IRREVERSIBLE';
    externalSideEffects?: boolean;
  }>[];
  dependencies: readonly Readonly<{
    assetKey: string;
    dependsOnAssetKey: string;
    requiredSha256: string;
    optional?: boolean;
  }>[];
}): ApprovalAdminV2HighRiskCommand {
  if (input.assets.length < 1 || input.assets.length > 500 || input.dependencies.length > 2000) {
    invalid();
  }
  const packageKey = text(input.packageKey, 3, 120);
  if (!/^[A-Z][A-Z0-9_.-]{2,119}$/u.test(packageKey)) invalid();
  const assets = input.assets.map((asset) => {
    const assetKey = text(asset.assetKey, 2, 200);
    if (!/^[A-Za-z][A-Za-z0-9_.:-]{1,199}$/u.test(assetKey)) invalid();
    return {
      assetId: identifier(asset.assetId),
      assetKey,
      assetType: enumValue(asset.assetType, ['FORM', 'WORKFLOW', 'POLICY', 'TEMPLATE']),
      assetVersion: text(asset.assetVersion, 1, 80),
      contentSha256: sha256(asset.contentSha256),
      rollbackDisposition: enumValue(asset.rollbackDisposition, [
        'REVERSIBLE',
        'CONDITIONAL',
        'IRREVERSIBLE',
      ]),
      ...(asset.externalSideEffects == null
        ? {}
        : { externalSideEffects: booleanValue(asset.externalSideEffects) }),
    };
  });
  if (new Set(assets.map((asset) => asset.assetKey)).size !== assets.length) invalid();
  const knownAssets = new Set(assets.map((asset) => asset.assetKey));
  const dependencies = input.dependencies.map((dependency) => {
    const assetKey = text(dependency.assetKey, 2, 200);
    const dependsOnAssetKey = text(dependency.dependsOnAssetKey, 2, 200);
    if (
      !knownAssets.has(assetKey) ||
      !knownAssets.has(dependsOnAssetKey) ||
      assetKey === dependsOnAssetKey
    ) {
      invalid();
    }
    return {
      assetKey,
      dependsOnAssetKey,
      requiredSha256: sha256(dependency.requiredSha256),
      ...(dependency.optional == null ? {} : { optional: booleanValue(dependency.optional) }),
    };
  });
  const payload = {
    packageId: identifier(input.packageId),
    packageKey,
    packageVersion: integer(input.packageVersion, 1, 2_147_483_647),
    displayName: text(input.displayName, 1, 200),
    assets,
    dependencies,
  } satisfies Schemas['approval_ApprovalDeploymentPackageCreate'];
  return command({
    routeContractKey: 'route.approvals.admin.deployment-package-create.action',
    commandPath: APPROVAL_ADMIN_V2_ENDPOINTS.deployments.packages,
    targetType: 'APPROVAL_DEPLOYMENT_PACKAGE',
    targetId: input.packageId,
    expectedObjectVersion: 0,
    proofPayload: payload,
    requestBody: payload,
    response: 'DEPLOYMENT_PACKAGE',
    responseVersionPolicy: 'NON_NEGATIVE',
  });
}

export function approvalDeploymentPromotionCreateCommand(input: {
  promotionId: string;
  packageId: string;
  sourceEnvironment: 'DEVELOPMENT' | 'TEST' | 'PRODUCTION';
  targetEnvironment: 'DEVELOPMENT' | 'TEST' | 'PRODUCTION';
}): ApprovalAdminV2HighRiskCommand {
  const sourceEnvironment = enumValue(input.sourceEnvironment, [
    'DEVELOPMENT',
    'TEST',
    'PRODUCTION',
  ]);
  const targetEnvironment = enumValue(input.targetEnvironment, [
    'DEVELOPMENT',
    'TEST',
    'PRODUCTION',
  ]);
  if (
    sourceEnvironment === targetEnvironment ||
    !(
      (sourceEnvironment === 'DEVELOPMENT' && targetEnvironment === 'TEST') ||
      (sourceEnvironment === 'TEST' && targetEnvironment === 'PRODUCTION')
    )
  ) {
    invalid();
  }
  const payload = {
    promotionId: identifier(input.promotionId),
    packageId: identifier(input.packageId),
    sourceEnvironment,
    targetEnvironment,
  } satisfies Schemas['approval_ApprovalDeploymentPromotionCreate'];
  return command({
    routeContractKey: 'route.approvals.admin.deployment-promotion-create.action',
    commandPath: APPROVAL_ADMIN_V2_ENDPOINTS.deployments.promotions,
    targetType: 'APPROVAL_DEPLOYMENT_PROMOTION',
    targetId: input.promotionId,
    expectedObjectVersion: 0,
    proofPayload: payload,
    requestBody: payload,
    response: 'DEPLOYMENT_PROMOTION',
    responseVersionPolicy: 'NON_NEGATIVE',
  });
}

function deploymentExternalEvidence(input: {
  evidenceId: string;
  evidenceType: string;
  externalReference: string;
  outcome: 'HEALTHY' | 'DEGRADED' | 'UNKNOWN' | 'FAILED';
  payloadSha256: string;
  sourceGeneratedAt: string;
  evidencePayloadBase64Url: string;
  evidenceSignatureBase64Url: string;
}): Schemas['approval_ApprovalDeploymentExternalEvidence'] {
  return {
    evidenceId: identifier(input.evidenceId),
    evidenceType: text(input.evidenceType, 1, 24),
    externalReference: text(input.externalReference, 1, 500),
    outcome: enumValue(input.outcome, ['HEALTHY', 'DEGRADED', 'UNKNOWN', 'FAILED']),
    payloadSha256: sha256(input.payloadSha256),
    sourceGeneratedAt: isoInstant(input.sourceGeneratedAt),
    evidencePayloadBase64Url: base64Url(input.evidencePayloadBase64Url, 1, 12_000),
    evidenceSignatureBase64Url: base64Url(input.evidenceSignatureBase64Url, 86, 86),
  };
}

export function approvalDeploymentActivationEvidenceCommand(input: {
  promotionId: string;
  expectedVersion: number;
  evidence: Parameters<typeof deploymentExternalEvidence>[0];
}): ApprovalAdminV2HighRiskCommand {
  const payload = deploymentExternalEvidence(input.evidence);
  return deploymentCommand({
    promotionId: input.promotionId,
    expectedVersion: input.expectedVersion,
    routeContractKey: 'route.approvals.admin.deployment-activation-evidence.action',
    commandPath: APPROVAL_ADMIN_V2_ENDPOINTS.deployments.activationEvidence(
      identifier(input.promotionId)
    ),
    proofPayload: payload,
    requestBody: payload,
  });
}

export function approvalDeploymentRollbackEvidenceCommand(input: {
  promotionId: string;
  expectedVersion: number;
  evidence: Parameters<typeof deploymentExternalEvidence>[0];
}): ApprovalAdminV2HighRiskCommand {
  const payload = deploymentExternalEvidence(input.evidence);
  return deploymentCommand({
    promotionId: input.promotionId,
    expectedVersion: input.expectedVersion,
    routeContractKey: 'route.approvals.admin.deployment-rollback-evidence.action',
    commandPath: APPROVAL_ADMIN_V2_ENDPOINTS.deployments.rollbackEvidence(
      identifier(input.promotionId)
    ),
    proofPayload: payload,
    requestBody: payload,
  });
}

export function approvalDeploymentReviewCommand(
  promotionId: string,
  expectedVersion: number,
  reviewComment: string
): ApprovalAdminV2HighRiskCommand {
  const normalized = text(reviewComment, 10, 1000);
  return deploymentCommand({
    promotionId,
    expectedVersion,
    routeContractKey: 'route.approvals.admin.deployment-promotion-review.action',
    commandPath: APPROVAL_ADMIN_V2_ENDPOINTS.deployments.approval(identifier(promotionId)),
    proofPayload: normalized,
    requestBody: { reviewComment: normalized },
  });
}

export function approvalDeploymentScheduleCommand(
  promotionId: string,
  expectedVersion: number,
  scheduledFor: string
): ApprovalAdminV2HighRiskCommand {
  const normalized = isoInstant(scheduledFor);
  return deploymentCommand({
    promotionId,
    expectedVersion,
    routeContractKey: 'route.approvals.admin.deployment-promotion-schedule.action',
    commandPath: APPROVAL_ADMIN_V2_ENDPOINTS.deployments.schedule(identifier(promotionId)),
    proofPayload: normalized,
    requestBody: { scheduledFor: normalized },
  });
}

export function approvalDeploymentActivationCommand(
  promotionId: string,
  expectedVersion: number
): ApprovalAdminV2HighRiskCommand {
  return deploymentCommand({
    promotionId,
    expectedVersion,
    routeContractKey: 'route.approvals.admin.deployment-activation.action',
    commandPath: APPROVAL_ADMIN_V2_ENDPOINTS.deployments.activation(identifier(promotionId)),
    proofPayload: { operation: 'BEGIN_ACTIVATION' },
  });
}

export function approvalDeploymentRollbackCommand(
  promotionId: string,
  expectedVersion: number,
  reason: string
): ApprovalAdminV2HighRiskCommand {
  const normalized = text(reason, 10, 1000);
  return deploymentCommand({
    promotionId,
    expectedVersion,
    routeContractKey: 'route.approvals.admin.deployment-rollback.action',
    commandPath: APPROVAL_ADMIN_V2_ENDPOINTS.deployments.rollback(identifier(promotionId)),
    proofPayload: normalized,
    requestBody: { reason: normalized },
  });
}

function assertExecution(
  execution: ApprovalMutationExecution,
  expectedVersion: number
): Extract<ApprovalMutationExecution, { mode: 'SECURE' }> {
  if (
    execution.mode !== 'SECURE' ||
    execution.objectVersion !== expectedVersion ||
    !execution.idempotencyKey?.trim() ||
    !execution.stepUp
  ) {
    invalid();
  }
  return execution;
}

function parseReceipt(
  value: unknown,
  commandValue: ApprovalAdminV2HighRiskCommand
): ApprovalAdminV2CommandReceipt {
  const expectedResponseTargetId = (
    commandValue.responseTargetId ?? commandValue.targetId
  ).toLowerCase();
  const record =
    commandValue.response === 'POLICY_LIST'
      ? (() => {
          const matches = adminV2Array(
            value,
            'commandResponse',
            (item, path) => adminV2Record(item, path),
            500
          ).filter((item) => {
            const policyId = adminV2Identifier(item.policyId, 'commandResponse.policyId');
            return policyId.toLowerCase() === expectedResponseTargetId;
          });
          if (matches.length !== 1) invalid();
          return matches[0];
        })()
      : adminV2Record(value, 'commandResponse');
  const binding = {
    ROUTING_GROUP: ['groupId', 'version'],
    CONNECTOR: ['connectorId', 'version'],
    CONNECTOR_PROBE: ['probeId', 'version'],
    POLICY_LIST: ['policyId', 'version'],
    POLICY_AUTOMATION: ['policyId', 'version'],
    INCIDENT_DIAGNOSTIC: ['diagnosticId', null],
    INCIDENT_PLAN: ['planId', 'version'],
    INCIDENT_POSTMORTEM: ['postmortemId', 'version'],
    AUDIT_SAVED_VIEW: ['savedViewId', 'version'],
    AUDIT_EXPORT: ['exportId', 'version'],
    DEPLOYMENT_PACKAGE: ['packageId', 'packageVersion'],
    DEPLOYMENT_PROMOTION: ['promotionId', 'version'],
  } as const;
  const [idKey, versionKey] = binding[commandValue.response];
  const targetId = adminV2Identifier(record[idKey], `commandResponse.${idKey}`);
  if (targetId.toLowerCase() !== expectedResponseTargetId) invalid();
  const versionPolicy = commandValue.responseVersionPolicy ?? 'AT_LEAST_EXPECTED';
  if ((versionKey == null) !== (versionPolicy === 'OMITTED')) invalid();
  const committedVersion =
    versionKey == null
      ? undefined
      : adminV2Version(record[versionKey], `commandResponse.${versionKey}`);
  if (
    committedVersion != null &&
    versionPolicy === 'AT_LEAST_EXPECTED' &&
    committedVersion < commandValue.expectedObjectVersion
  ) {
    invalid();
  }
  const statusValue = record.status ?? record.state;
  const status =
    statusValue == null
      ? undefined
      : adminV2Text(statusValue, 'commandResponse.status', { max: 80 });
  return {
    targetId,
    ...(committedVersion == null ? {} : { version: committedVersion }),
    ...(status ? { status } : {}),
  };
}

export async function executeApprovalAdminV2HighRiskCommand(
  commandValue: ApprovalAdminV2HighRiskCommand,
  execution: ApprovalMutationExecution,
  options: DispatchOptions
): Promise<ApprovalAdminV2CommandReceipt> {
  if (typeof options.beforeDispatch !== 'function') invalid();
  const authority = assertExecution(execution, commandValue.expectedObjectVersion);
  const body = commandValue.requestBody ? structuredClone(commandValue.requestBody) : undefined;
  options.beforeDispatch();
  const config = {
    ...approvalHighRiskMutationExecutionConfig(authority, { objectVersionHeader: true }),
    beforeDispatch: options.beforeDispatch,
    csrfReplay: 'NEVER' as const,
  };
  const response =
    commandValue.commandMethod === 'PUT'
      ? await axiosInstance.put<ApiResponse<unknown>, typeof body>(
          commandValue.commandPath,
          body,
          config
        )
      : await axiosInstance.post<ApiResponse<unknown>, typeof body>(
          commandValue.commandPath,
          body,
          config
        );
  options.beforeDispatch();
  return parseReceipt(response.data.data, commandValue);
}
