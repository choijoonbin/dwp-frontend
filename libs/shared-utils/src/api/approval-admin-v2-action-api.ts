import { axiosInstance } from '../axios-instance';
import {
  ApprovalAdminV2ContractError,
  adminV2Array,
  adminV2Boolean,
  adminV2Identifier,
  adminV2Instant,
  adminV2Number,
  adminV2Record,
  adminV2Text,
  adminV2Version,
} from './approval-admin-v2-contract-core';
import { APPROVAL_ADMIN_V2_ENDPOINTS } from './approval-admin-v2-endpoints';

import type { ApiResponse } from '../types';
import type {
  ApprovalAdminV2DraftMetadata,
  ApprovalAdminV2RoutingGroupDraft,
} from './approval-admin-v2-governed-api';

type ReadOptions = Readonly<{ contextScopeKey?: string; signal?: AbortSignal }>;

function options(input: ReadOptions) {
  return {
    ...(input.contextScopeKey ? { contextScopeKey: input.contextScopeKey } : {}),
    ...(input.signal ? { signal: input.signal } : {}),
    timeoutMs: 12_000,
  };
}

function withQuery(path: string, values: Readonly<Record<string, string | number>>): string {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => query.set(key, String(value)));
  return `${path}?${query.toString()}`;
}

function textList(value: unknown, path: string, max = 500): readonly string[] {
  return adminV2Array(value, path, (item, itemPath) => adminV2Text(item, itemPath, { max }), max);
}

async function read(path: string, input: ReadOptions): Promise<unknown> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(path, options(input));
  return response.data.data;
}

function nullableIdentifier(value: unknown, path: string): string | null {
  return value == null ? null : adminV2Identifier(value, path);
}

function nullableInstant(value: unknown, path: string): string | null {
  return value == null ? null : adminV2Instant(value, path);
}

function nullableText(value: unknown, path: string, max = 500): string | null {
  return value == null ? null : adminV2Text(value, path, { max });
}

function draftMetadata(
  record: Record<string, unknown>,
  path: string
): ApprovalAdminV2DraftMetadata {
  return {
    formKey: adminV2Text(record.formKey ?? record.templateKey, `${path}.formKey`, { max: 100 }),
    nameKo: adminV2Text(record.nameKo, `${path}.nameKo`, { max: 200 }),
    nameEn: adminV2Text(record.nameEn, `${path}.nameEn`, { max: 200 }),
    descriptionKo: adminV2Text(record.descriptionKo, `${path}.descriptionKo`, { max: 1000 }),
    descriptionEn: adminV2Text(record.descriptionEn, `${path}.descriptionEn`, { max: 1000 }),
    ownerGroupRef: adminV2Text(record.ownerGroupRef, `${path}.ownerGroupRef`, { max: 160 }),
    categoryKey: adminV2Text(record.categoryKey, `${path}.categoryKey`, { max: 100 }),
    defaultWorkflowKey: adminV2Text(record.defaultWorkflowKey, `${path}.defaultWorkflowKey`, {
      max: 100,
    }),
  };
}

export async function getApprovalTemplateInstallInput(templateId: string, input: ReadOptions) {
  const template = adminV2Record(
    await read(APPROVAL_ADMIN_V2_ENDPOINTS.templates.detail(templateId), input),
    'templateDetail'
  );
  const current = adminV2Record(template.current, 'templateDetail.current');
  return {
    templateId: adminV2Identifier(template.templateId, 'templateDetail.templateId'),
    currentVersion: adminV2Number(template.currentVersion, 'templateDetail.currentVersion', {
      min: 1,
      integer: true,
    }),
    templateVersionId: adminV2Identifier(
      current.templateVersionId,
      'templateDetail.current.templateVersionId'
    ),
    expectedTemplateVersion: adminV2Version(template.version, 'templateDetail.version'),
    metadata: draftMetadata(
      { ...template, ...current, formKey: template.templateKey },
      'templateDetail.install'
    ),
  } as const;
}

export async function compareApprovalTemplateVersion(
  templateId: string,
  installedVersion: number,
  input: ReadOptions
) {
  if (!Number.isSafeInteger(installedVersion) || installedVersion < 1) {
    throw new Error('Installed template version is invalid.');
  }
  const value = adminV2Record(
    await read(
      `${APPROVAL_ADMIN_V2_ENDPOINTS.templates.comparison(templateId)}?installedVersion=${installedVersion}`,
      input
    ),
    'templateComparison'
  );
  return {
    templateId: adminV2Identifier(value.templateId, 'templateComparison.templateId'),
    installedVersion: adminV2Number(value.installedVersion, 'templateComparison.installedVersion', {
      min: 1,
      integer: true,
    }),
    availableVersion: adminV2Number(value.availableVersion, 'templateComparison.availableVersion', {
      min: 1,
      integer: true,
    }),
    updateAvailable: adminV2Boolean(value.updateAvailable, 'templateComparison.updateAvailable'),
    compatible: adminV2Boolean(value.compatible, 'templateComparison.compatible'),
  } as const;
}

export async function getApprovalFormStudioDraftInput(formId: string, input: ReadOptions) {
  const workspace = adminV2Record(
    await read(APPROVAL_ADMIN_V2_ENDPOINTS.formStudio.detail(formId), input),
    'formWorkspace'
  );
  const current = adminV2Record(workspace.current, 'formWorkspace.current');
  const schema = adminV2Record(current.schema, 'formWorkspace.current.schema');
  return {
    formId: adminV2Identifier(workspace.formId, 'formWorkspace.formId'),
    expectedWorkspaceVersion: adminV2Version(
      workspace.workspaceVersion,
      'formWorkspace.workspaceVersion'
    ),
    metadata: draftMetadata(workspace, 'formWorkspace'),
    schema: structuredClone(schema) as Readonly<Record<string, unknown>>,
  } as const;
}

export async function getApprovalRoutingGroupDraftInput(
  groupId: string,
  input: ReadOptions
): Promise<ApprovalAdminV2RoutingGroupDraft> {
  const group = adminV2Record(
    await read(APPROVAL_ADMIN_V2_ENDPOINTS.routing.group(groupId), input),
    'routingGroup'
  );
  const lifecycle = adminV2Text(group.lifecycle, 'routingGroup.lifecycle', { max: 20 });
  if (!['DRAFT', 'ACTIVE', 'RETIRED'].includes(lifecycle)) {
    throw new Error('Approval routing lifecycle is invalid.');
  }
  const members = adminV2Array(group.members, 'routingGroup.members', (value, path) => {
    const member = adminV2Record(value, path);
    const kind = adminV2Text(member.kind, `${path}.kind`, { max: 20 });
    if (!['SUBJECT', 'GROUP', 'RESOLVER'].includes(kind)) {
      throw new Error('Approval routing member kind is invalid.');
    }
    return {
      memberId: adminV2Identifier(member.memberId, `${path}.memberId`),
      kind: kind as 'SUBJECT' | 'GROUP' | 'RESOLVER',
      userId:
        member.userId == null
          ? null
          : adminV2Number(member.userId, `${path}.userId`, { min: 1, integer: true }),
      personPublicId: nullableIdentifier(member.personPublicId, `${path}.personPublicId`),
      nestedGroupId: nullableIdentifier(member.nestedGroupId, `${path}.nestedGroupId`),
      resolverId: nullableIdentifier(member.resolverId, `${path}.resolverId`),
      priority: adminV2Number(member.priority, `${path}.priority`, { min: 0, integer: true }),
      required: adminV2Boolean(member.required, `${path}.required`),
    };
  });
  return {
    groupId: adminV2Identifier(group.groupId, 'routingGroup.groupId'),
    groupKey: adminV2Text(group.groupKey, 'routingGroup.groupKey', { max: 100 }),
    displayName: adminV2Text(group.displayName, 'routingGroup.displayName', { max: 200 }),
    description: adminV2Text(group.description, 'routingGroup.description', { max: 1000 }),
    lifecycle: lifecycle as 'DRAFT' | 'ACTIVE' | 'RETIRED',
    effectiveFrom: nullableInstant(group.effectiveFrom, 'routingGroup.effectiveFrom'),
    effectiveTo: nullableInstant(group.effectiveTo, 'routingGroup.effectiveTo'),
    members,
    expectedVersion: adminV2Version(group.version, 'routingGroup.version'),
  };
}

export async function getApprovalRoutingRetirementInput(groupId: string, input: ReadOptions) {
  const [groupValue, impactValue] = await Promise.all([
    read(APPROVAL_ADMIN_V2_ENDPOINTS.routing.group(groupId), input),
    read(APPROVAL_ADMIN_V2_ENDPOINTS.routing.retirementImpact(groupId), input),
  ]);
  const group = adminV2Record(groupValue, 'routingGroup');
  const impact = adminV2Record(impactValue, 'routingRetirementImpact');
  const currentGroupId = adminV2Identifier(group.groupId, 'routingGroup.groupId');
  const impactGroupId = adminV2Identifier(impact.groupId, 'routingRetirementImpact.groupId');
  const expectedVersion = adminV2Version(group.version, 'routingGroup.version');
  const impactVersion = adminV2Version(impact.groupVersion, 'routingRetirementImpact.groupVersion');
  const acknowledgedImpact = adminV2Version(
    impact.totalImpactCount,
    'routingRetirementImpact.totalImpactCount'
  );
  if (currentGroupId !== impactGroupId || expectedVersion !== impactVersion) {
    throw new Error('Approval routing retirement evidence is stale.');
  }
  return { groupId: currentGroupId, expectedVersion, acknowledgedImpact } as const;
}

export async function getApprovalRoutingResolution(groupId: string, input: ReadOptions) {
  const value = adminV2Record(
    await read(APPROVAL_ADMIN_V2_ENDPOINTS.routing.resolution(groupId), input),
    'routingResolution'
  );
  return {
    groupId: adminV2Identifier(value.groupId, 'routingResolution.groupId'),
    groupVersion: adminV2Version(value.groupVersion, 'routingResolution.groupVersion'),
    evaluatedAt: adminV2Text(value.evaluatedAt, 'routingResolution.evaluatedAt', { max: 80 }),
  } as const;
}

export async function getApprovalConnectorProbeInput(connectorId: string, input: ReadOptions) {
  const detail = adminV2Record(
    await read(APPROVAL_ADMIN_V2_ENDPOINTS.connectors.detail(connectorId), input),
    'connectorDetail'
  );
  const connector = adminV2Record(detail.connector, 'connectorDetail.connector');
  return {
    connectorId: adminV2Identifier(connector.connectorId, 'connectorDetail.connector.connectorId'),
    expectedVersion: adminV2Version(connector.version, 'connectorDetail.connector.version'),
    revisionId: adminV2Identifier(
      connector.draftRevisionId,
      'connectorDetail.connector.draftRevisionId'
    ),
    requestSha256: adminV2Text(
      connector.definitionSha256,
      'connectorDetail.connector.definitionSha256',
      { max: 64 }
    ),
  } as const;
}

export async function getApprovalIncidentStageInput(
  incidentId: string,
  planId: string,
  input: ReadOptions
) {
  const detail = adminV2Record(
    await read(APPROVAL_ADMIN_V2_ENDPOINTS.incidents.detail(incidentId), input),
    'incidentDetail'
  );
  const incident = adminV2Record(detail.incident, 'incidentDetail.incident');
  const currentIncidentId = adminV2Identifier(
    incident.incidentId,
    'incidentDetail.incident.incidentId'
  );
  const plans = adminV2Array(
    detail.recoveryPlans,
    'incidentDetail.recoveryPlans',
    (value, path) => {
      const plan = adminV2Record(value, path);
      const stages = adminV2Array(plan.stages, `${path}.stages`, (stageValue, stagePath) => {
        const stage = adminV2Record(stageValue, stagePath);
        return {
          stageNumber: adminV2Version(stage.stageNumber, `${stagePath}.stageNumber`),
          state: adminV2Text(stage.state, `${stagePath}.state`, { max: 40 }),
          version: adminV2Version(stage.version, `${stagePath}.version`),
        };
      });
      return {
        incidentId: adminV2Identifier(plan.incidentId, `${path}.incidentId`),
        planId: adminV2Identifier(plan.planId, `${path}.planId`),
        state: adminV2Text(plan.state, `${path}.state`, { max: 40 }),
        version: adminV2Version(plan.version, `${path}.version`),
        stages,
      };
    },
    100
  );
  const plan = plans.find((candidate) => candidate.planId === planId);
  const stage = plan?.stages.find((candidate) => candidate.state === 'PENDING');
  if (
    !plan ||
    !stage ||
    currentIncidentId !== plan.incidentId ||
    !['DRY_RUN_PASSED', 'EXECUTING'].includes(plan.state)
  ) {
    throw new Error('Approval incident recovery stage is not executable.');
  }
  return {
    incidentId: currentIncidentId,
    planId: plan.planId,
    stageNumber: stage.stageNumber,
    expectedPlanVersion: plan.version,
    expectedStageVersion: stage.version,
  } as const;
}

export async function getApprovalAuditExportInput(
  eventId: string,
  expectedRequestId: string,
  input: ReadOptions
) {
  const event = adminV2Record(
    await read(`${APPROVAL_ADMIN_V2_ENDPOINTS.audit.event(eventId)}?accessLevel=METADATA`, input),
    'auditEvent'
  );
  const occurredAt = adminV2Text(event.occurredAt, 'auditEvent.occurredAt', { max: 80 });
  const occurredAtMs = Date.parse(occurredAt);
  if (!Number.isFinite(occurredAtMs)) throw new Error('Approval audit event time is invalid.');
  const currentEventId = adminV2Identifier(event.eventId, 'auditEvent.eventId');
  const currentRequestId = adminV2Identifier(event.requestId, 'auditEvent.requestId');
  if (currentEventId !== eventId) throw new ApprovalAdminV2ContractError('auditEvent.eventId');
  if (currentRequestId !== expectedRequestId) {
    throw new ApprovalAdminV2ContractError('auditEvent.requestId');
  }
  return {
    eventId: currentEventId,
    requestId: currentRequestId,
    from: new Date(occurredAtMs - 60_000).toISOString(),
    to: new Date(occurredAtMs + 60_000).toISOString(),
  } as const;
}

export async function getApprovalDeploymentPromotionInput(promotionId: string, input: ReadOptions) {
  const detail = adminV2Record(
    await read(APPROVAL_ADMIN_V2_ENDPOINTS.deployments.promotion(promotionId), input),
    'deploymentPromotionDetail'
  );
  const promotion = adminV2Record(detail.promotion, 'deploymentPromotionDetail.promotion');
  return {
    promotionId: adminV2Identifier(
      promotion.promotionId,
      'deploymentPromotionDetail.promotion.promotionId'
    ),
    expectedVersion: adminV2Version(
      promotion.version,
      'deploymentPromotionDetail.promotion.version'
    ),
    status: adminV2Text(promotion.status, 'deploymentPromotionDetail.promotion.status', {
      max: 60,
    }),
  } as const;
}

export async function reviewApprovalFormStudioV3(formId: string, input: ReadOptions) {
  const response = await axiosInstance.post<ApiResponse<unknown>, undefined>(
    APPROVAL_ADMIN_V2_ENDPOINTS.formStudio.review(formId),
    undefined,
    options(input)
  );
  const review = adminV2Record(response.data.data, 'formReview');
  return {
    formId: adminV2Identifier(review.formId, 'formReview.formId'),
    workspaceVersion: adminV2Version(review.workspaceVersion, 'formReview.workspaceVersion'),
  } as const;
}

export async function validateApprovalFormStudioV3(
  formId: string,
  input: ReadOptions,
  draftSchema?: Readonly<Record<string, unknown>>
) {
  const schema = draftSchema
    ? adminV2Record(structuredClone(draftSchema), 'formDraft.schema')
    : await (async () => {
        const workspace = adminV2Record(
          await read(APPROVAL_ADMIN_V2_ENDPOINTS.formStudio.detail(formId), input),
          'formWorkspace'
        );
        const current = adminV2Record(workspace.current, 'formWorkspace.current');
        return adminV2Record(current.schema, 'formWorkspace.current.schema');
      })();
  const response = await axiosInstance.post<ApiResponse<unknown>, { schema: unknown }>(
    APPROVAL_ADMIN_V2_ENDPOINTS.formStudio.validate,
    { schema: structuredClone(schema) },
    options(input)
  );
  const validation = adminV2Record(response.data.data, 'formValidation');
  return adminV2Text(validation.schemaSha256, 'formValidation.schemaSha256', { max: 64 });
}

export async function readApprovalDeploymentPackage(packageId: string, input: ReadOptions) {
  const value = adminV2Record(
    await read(APPROVAL_ADMIN_V2_ENDPOINTS.deployments.package(packageId), input),
    'deploymentPackage'
  );
  return {
    packageId: adminV2Identifier(value.packageId, 'deploymentPackage.packageId'),
    manifestSha256: adminV2Text(value.manifestSha256, 'deploymentPackage.manifestSha256', {
      max: 64,
    }),
  } as const;
}

export async function getApprovalPolicyImpactEvidence(
  policyId: string,
  expectedVersion: number,
  input: ReadOptions
) {
  const targetId = adminV2Identifier(policyId, 'policyId');
  const targetVersion = adminV2Version(expectedVersion, 'expectedVersion');
  const impact = adminV2Record(
    await read(
      withQuery(APPROVAL_ADMIN_V2_ENDPOINTS.policies.impact(targetId), {
        expectedVersion: targetVersion,
      }),
      input
    ),
    'policyImpact'
  );
  const policy = adminV2Record(impact.policy, 'policyImpact.policy');
  const currentPolicyId = adminV2Identifier(policy.policyId, 'policyImpact.policy.policyId');
  const rowVersion = adminV2Version(policy.rowVersion, 'policyImpact.policy.rowVersion');
  if (currentPolicyId !== targetId || rowVersion !== targetVersion) {
    throw new ApprovalAdminV2ContractError('policyImpact.policy');
  }
  const semanticDiff = adminV2Array(
    impact.semanticDiff,
    'policyImpact.semanticDiff',
    (item, path) => {
      const difference = adminV2Record(item, path);
      return {
        kind: adminV2Text(difference.kind, `${path}.kind`, { max: 80 }),
        path: adminV2Text(difference.path, `${path}.path`, { max: 300 }),
        current: structuredClone(difference.current),
        proposed: structuredClone(difference.proposed),
      } as const;
    },
    500
  );
  return {
    policyId: currentPolicyId,
    rowVersion,
    status: adminV2Text(impact.status, 'policyImpact.status', { max: 80 }),
    observedAt: adminV2Instant(impact.observedAt, 'policyImpact.observedAt'),
    sourceDigest: adminV2Text(impact.sourceDigest, 'policyImpact.sourceDigest', { max: 128 }),
    semanticDiff,
  } as const;
}

export async function getApprovalPolicyVersionHistory(policyId: string, input: ReadOptions) {
  const targetId = adminV2Identifier(policyId, 'policyId');
  const versions = await read(APPROVAL_ADMIN_V2_ENDPOINTS.policies.versions(targetId), input);
  return adminV2Array(
    versions,
    'policyVersions',
    (item, path) => {
      const entry = adminV2Record(item, path);
      return {
        policyVersionId: adminV2Identifier(entry.policyVersionId, `${path}.policyVersionId`),
        versionNumber:
          entry.versionNumber == null
            ? null
            : adminV2Number(entry.versionNumber, `${path}.versionNumber`, {
                min: 0,
                integer: true,
              }),
        lifecycleState: nullableText(entry.lifecycleState, `${path}.lifecycleState`, 80),
        enforcementMode: nullableText(entry.enforcementMode, `${path}.enforcementMode`, 80),
        severity: nullableText(entry.severity, `${path}.severity`, 80),
        submittedAt: adminV2Instant(entry.submittedAt, `${path}.submittedAt`),
        publishedAt: nullableInstant(entry.publishedAt, `${path}.publishedAt`),
        changeReason: nullableText(entry.changeReason, `${path}.changeReason`, 1000),
        reviewComment: nullableText(entry.reviewComment, `${path}.reviewComment`, 1000),
      } as const;
    },
    500
  );
}

export async function simulateApprovalBusinessDeadline(
  calendarId: string,
  start: string,
  businessMinutes: number,
  input: ReadOptions
) {
  const targetId = adminV2Identifier(calendarId, 'calendarId');
  const normalizedStart = adminV2Instant(start, 'start');
  const normalizedMinutes = adminV2Number(businessMinutes, 'businessMinutes', {
    min: 1,
    max: 5_256_000,
    integer: true,
  });
  const deadline = adminV2Record(
    await read(
      withQuery(APPROVAL_ADMIN_V2_ENDPOINTS.policies.deadline(targetId), {
        start: normalizedStart,
        businessMinutes: normalizedMinutes,
      }),
      input
    ),
    'businessDeadline'
  );
  const serverStart = adminV2Instant(deadline.start, 'businessDeadline.start');
  const serverMinutes = adminV2Number(
    deadline.businessMinutes,
    'businessDeadline.businessMinutes',
    {
      min: 1,
      max: 5_256_000,
      integer: true,
    }
  );
  if (
    Date.parse(serverStart) !== Date.parse(normalizedStart) ||
    serverMinutes !== normalizedMinutes
  ) {
    throw new ApprovalAdminV2ContractError('businessDeadline');
  }
  return {
    calendarId: targetId,
    start: serverStart,
    businessMinutes: serverMinutes,
    dueAt: adminV2Instant(deadline.dueAt, 'businessDeadline.dueAt'),
  } as const;
}

export async function getApprovalIncidentRecoveryPlan(
  incidentId: string,
  planId: string,
  input: ReadOptions
) {
  const targetIncidentId = adminV2Identifier(incidentId, 'incidentId');
  const targetPlanId = adminV2Identifier(planId, 'planId');
  const plan = adminV2Record(
    await read(
      APPROVAL_ADMIN_V2_ENDPOINTS.incidents.recoveryPlan(targetIncidentId, targetPlanId),
      input
    ),
    'recoveryPlan'
  );
  const currentIncidentId = adminV2Identifier(plan.incidentId, 'recoveryPlan.incidentId');
  const currentPlanId = adminV2Identifier(plan.planId, 'recoveryPlan.planId');
  if (currentIncidentId !== targetIncidentId || currentPlanId !== targetPlanId) {
    throw new ApprovalAdminV2ContractError('recoveryPlan');
  }
  const stages = adminV2Array(
    plan.stages ?? [],
    'recoveryPlan.stages',
    (item, path) => {
      const stage = adminV2Record(item, path);
      return {
        stageNumber: adminV2Number(stage.stageNumber, `${path}.stageNumber`, {
          min: 1,
          max: 100,
          integer: true,
        }),
        actionKind: adminV2Text(stage.actionKind, `${path}.actionKind`, { max: 40 }),
        targetType: adminV2Text(stage.targetType, `${path}.targetType`, { max: 40 }),
        targetId: adminV2Identifier(stage.targetId, `${path}.targetId`),
        state: adminV2Text(stage.state, `${path}.state`, { max: 40 }),
        version: adminV2Version(stage.version, `${path}.version`),
      } as const;
    },
    100
  );
  return {
    incidentId: currentIncidentId,
    planId: currentPlanId,
    planKind: adminV2Text(plan.planKind, 'recoveryPlan.planKind', { max: 40 }),
    state: adminV2Text(plan.state, 'recoveryPlan.state', { max: 40 }),
    version: adminV2Version(plan.version, 'recoveryPlan.version'),
    dryRunEvidenceSha256:
      plan.dryRunEvidenceSha256 == null
        ? null
        : adminV2Text(plan.dryRunEvidenceSha256, 'recoveryPlan.dryRunEvidenceSha256', {
            max: 64,
          }),
    stages,
  } as const;
}

export async function getApprovalAuditExportReceipt(exportId: string, input: ReadOptions) {
  const targetId = adminV2Identifier(exportId, 'exportId');
  const receipt = adminV2Record(
    await read(APPROVAL_ADMIN_V2_ENDPOINTS.audit.export(targetId), input),
    'auditExportReceipt'
  );
  const currentId = adminV2Identifier(receipt.exportId, 'auditExportReceipt.exportId');
  if (currentId !== targetId) throw new ApprovalAdminV2ContractError('auditExportReceipt.exportId');
  return {
    exportId: currentId,
    version: adminV2Version(receipt.version, 'auditExportReceipt.version'),
    status: adminV2Text(receipt.status, 'auditExportReceipt.status', { max: 80 }),
    integrityStatus: nullableText(
      receipt.integrityStatus,
      'auditExportReceipt.integrityStatus',
      80
    ),
    manifestSha256: nullableText(receipt.manifestSha256, 'auditExportReceipt.manifestSha256', 64),
    externalAttestationReference: nullableText(
      receipt.externalAttestationReference,
      'auditExportReceipt.externalAttestationReference',
      500
    ),
  } as const;
}

export async function getApprovalDeploymentPackageDiff(
  fromPackageId: string,
  toPackageId: string,
  input: ReadOptions
) {
  const fromId = adminV2Identifier(fromPackageId, 'fromPackageId');
  const toId = adminV2Identifier(toPackageId, 'toPackageId');
  if (fromId === toId) throw new ApprovalAdminV2ContractError('deploymentPackageDiff');
  const difference = adminV2Record(
    await read(
      withQuery(APPROVAL_ADMIN_V2_ENDPOINTS.deployments.packageDiff, {
        fromPackageId: fromId,
        toPackageId: toId,
      }),
      input
    ),
    'deploymentPackageDiff'
  );
  if (
    adminV2Identifier(difference.fromPackageId, 'deploymentPackageDiff.fromPackageId') !== fromId ||
    adminV2Identifier(difference.toPackageId, 'deploymentPackageDiff.toPackageId') !== toId
  ) {
    throw new ApprovalAdminV2ContractError('deploymentPackageDiff');
  }
  return {
    fromPackageId: fromId,
    toPackageId: toId,
    rollbackDisposition: adminV2Text(
      difference.rollbackDisposition,
      'deploymentPackageDiff.rollbackDisposition',
      { max: 40 }
    ),
    introducesExternalSideEffects: adminV2Boolean(
      difference.introducesExternalSideEffects,
      'deploymentPackageDiff.introducesExternalSideEffects'
    ),
    addedAssets: textList(difference.addedAssets ?? [], 'deploymentPackageDiff.addedAssets'),
    changedAssets: textList(difference.changedAssets ?? [], 'deploymentPackageDiff.changedAssets'),
    removedAssets: textList(difference.removedAssets ?? [], 'deploymentPackageDiff.removedAssets'),
    dependencyChanges: textList(
      difference.dependencyChanges ?? [],
      'deploymentPackageDiff.dependencyChanges'
    ),
  } as const;
}

export async function getApprovalDeploymentRollbackFeasibility(
  promotionId: string,
  input: ReadOptions
) {
  const targetId = adminV2Identifier(promotionId, 'promotionId');
  const feasibility = adminV2Record(
    await read(APPROVAL_ADMIN_V2_ENDPOINTS.deployments.rollbackFeasibility(targetId), input),
    'rollbackFeasibility'
  );
  return {
    promotionId: targetId,
    status: adminV2Text(feasibility.status, 'rollbackFeasibility.status', { max: 80 }),
    activePackageId: nullableIdentifier(
      feasibility.activePackageId,
      'rollbackFeasibility.activePackageId'
    ),
    previousPackageId: nullableIdentifier(
      feasibility.previousPackageId,
      'rollbackFeasibility.previousPackageId'
    ),
    externalSideEffectsStatus: nullableText(
      feasibility.externalSideEffectsStatus,
      'rollbackFeasibility.externalSideEffectsStatus',
      80
    ),
    externalSideEffectsUndone:
      feasibility.externalSideEffectsUndone == null
        ? null
        : adminV2Boolean(
            feasibility.externalSideEffectsUndone,
            'rollbackFeasibility.externalSideEffectsUndone'
          ),
    conditions: textList(feasibility.conditions ?? [], 'rollbackFeasibility.conditions'),
  } as const;
}
