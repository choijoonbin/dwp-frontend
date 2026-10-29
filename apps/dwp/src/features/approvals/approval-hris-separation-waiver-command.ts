import { snapshotApprovalHrisSeparationWaiverTaskApproveInput } from '@dwp-frontend/shared-utils/api/approval-hris-separation-waiver-contract';
import { productSurfaceHighRiskCommand } from './approval-high-risk-command-model';

import type { ApprovalTaskDetail } from '@dwp-frontend/shared-utils';
import type { ApprovalHrisSeparationWaiverTaskApproveInput } from '@dwp-frontend/shared-utils/api/approval-hris-separation-waiver-contract';

const canonicalUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const code = /^[A-Z][A-Z0-9._-]{0,79}$/u;
const sha256 = /^[0-9a-f]{64}$/u;
const sourceFields = [
  'schemaName',
  'schemaVersion',
  'approvalRequestId',
  'casePublicId',
  'taskPublicId',
  'taskType',
  'caseMakerPublicId',
  'requestedByActorPublicId',
  'reasonCode',
  'taskOwnerRevision',
  'taskVersion',
  'requestedAt',
  'payloadSha256',
  'correlationId',
] as const;
const hrisSourceFingerprint = [
  'casePublicId',
  'taskPublicId',
  'caseMakerPublicId',
  'requestedByActorPublicId',
  'taskOwnerRevision',
] as const;

export type ApprovalHrisSeparationWaiverTaskBinding = Readonly<{
  correlationId: string;
}>;

export function readApprovalHrisSeparationWaiverTaskBinding(
  detail: ApprovalTaskDetail
): ApprovalHrisSeparationWaiverTaskBinding | null {
  const payload = detail.payload;
  const appearsHris =
    payload.schemaName === 'SeparationWaiverApprovalRequestV1' ||
    hrisSourceFingerprint.every((key) => Object.hasOwn(payload, key));
  if (!appearsHris) return null;
  if (
    Object.keys(payload).length !== sourceFields.length ||
    !sourceFields.every((key) => Object.hasOwn(payload, key)) ||
    payload.schemaName !== 'SeparationWaiverApprovalRequestV1' ||
    payload.schemaVersion !== 1 ||
    typeof payload.approvalRequestId !== 'string' ||
    payload.approvalRequestId !== detail.task.requestId ||
    !canonicalUuid.test(payload.approvalRequestId) ||
    typeof payload.casePublicId !== 'string' ||
    !canonicalUuid.test(payload.casePublicId) ||
    typeof payload.taskPublicId !== 'string' ||
    !canonicalUuid.test(payload.taskPublicId) ||
    typeof payload.taskType !== 'string' ||
    !code.test(payload.taskType) ||
    typeof payload.caseMakerPublicId !== 'string' ||
    !canonicalUuid.test(payload.caseMakerPublicId) ||
    typeof payload.requestedByActorPublicId !== 'string' ||
    !canonicalUuid.test(payload.requestedByActorPublicId) ||
    typeof payload.reasonCode !== 'string' ||
    !code.test(payload.reasonCode) ||
    !Number.isSafeInteger(payload.taskOwnerRevision) ||
    Number(payload.taskOwnerRevision) <= 0 ||
    !Number.isSafeInteger(payload.taskVersion) ||
    Number(payload.taskVersion) < 0 ||
    typeof payload.requestedAt !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u.test(payload.requestedAt) ||
    !Number.isFinite(Date.parse(payload.requestedAt)) ||
    typeof payload.payloadSha256 !== 'string' ||
    !sha256.test(payload.payloadSha256) ||
    typeof payload.correlationId !== 'string' ||
    !canonicalUuid.test(payload.correlationId)
  ) {
    throw new Error('Invalid HRIS separation-waiver task source');
  }
  return Object.freeze({ correlationId: payload.correlationId });
}

export function assertApprovalTaskUsesStandardDecisionRoute(detail: ApprovalTaskDetail): void {
  if (readApprovalHrisSeparationWaiverTaskBinding(detail)) {
    throw new Error('HRIS separation-waiver approval requires individual HIGH confirmation');
  }
}

export function approvalHrisSeparationWaiverTaskApproveCommand(
  taskId: string,
  input: ApprovalHrisSeparationWaiverTaskApproveInput
) {
  if (!canonicalUuid.test(taskId)) {
    throw new Error('Invalid HRIS separation-waiver task target');
  }
  const payload = snapshotApprovalHrisSeparationWaiverTaskApproveInput(input);
  return productSurfaceHighRiskCommand({
    operation: 'HRIS_SEPARATION_WAIVER_TASK_APPROVE',
    commandMethod: 'POST',
    commandPath: `/api/approvals/v1/hris/separation-waiver-tasks/${taskId}/approve`,
    targetType: 'HRIS_SEPARATION_WAIVER_TASK',
    targetId: taskId,
    expectedObjectVersion: payload.expectedVersion,
    payload,
  });
}
