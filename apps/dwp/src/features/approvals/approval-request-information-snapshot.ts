import { readApprovalInformationRound } from '@dwp-frontend/shared-utils/api/approval-information-contract';

import type { ApprovalRequestDetail } from '@dwp-frontend/shared-utils';

export type ApprovalRequestInformationSnapshot = Readonly<{
  requestId: string;
  requestVersion: number;
  informationGeneration: number;
  roundId: string;
  sourceGeneration: number;
  targetGeneration: number;
  workflowVersionId: string;
  workflowVersion: number;
  workflowDefinitionSha256: string;
  formSchemaSha256: string;
  policyVersion: number;
  policySha256: string;
  payloadRevision: number;
  payloadSha256: string;
}>;

export function approvalRequestInformationSnapshot(
  detail: ApprovalRequestDetail
): ApprovalRequestInformationSnapshot | undefined {
  const round = readApprovalInformationRound(detail.informationRound);
  if (!round) {
    if (detail.informationGeneration != null)
      throw new Error('Information generation has no authoritative round.');
    return undefined;
  }
  if (
    detail.request.status !== 'NEEDS_INFO' ||
    !Number.isSafeInteger(detail.request.version) ||
    detail.request.version < 0 ||
    detail.informationGeneration !== round.sourceGeneration ||
    (detail.formSchemaSha256 != null && detail.formSchemaSha256 !== round.pins.formSchemaSha256)
  )
    throw new Error('Information response source is inconsistent.');
  return Object.freeze({
    requestId: detail.request.requestId,
    requestVersion: detail.request.version,
    informationGeneration: detail.informationGeneration,
    roundId: round.roundId,
    sourceGeneration: round.sourceGeneration,
    targetGeneration: round.targetGeneration,
    ...round.pins,
    payloadRevision: round.payloadRevision,
    payloadSha256: round.payloadSha256,
  });
}

const SNAPSHOT_KEYS = [
  'requestId',
  'requestVersion',
  'informationGeneration',
  'roundId',
  'sourceGeneration',
  'targetGeneration',
  'workflowVersionId',
  'workflowVersion',
  'workflowDefinitionSha256',
  'formSchemaSha256',
  'policyVersion',
  'policySha256',
  'payloadRevision',
  'payloadSha256',
] as const;

export function sameApprovalRequestInformationSnapshot(
  expected: ApprovalRequestInformationSnapshot,
  detail: ApprovalRequestDetail | undefined
): boolean {
  if (!detail) return false;
  try {
    const actual = approvalRequestInformationSnapshot(detail);
    return Boolean(actual && SNAPSHOT_KEYS.every((key) => expected[key] === actual[key]));
  } catch {
    return false;
  }
}
