import { axiosInstance } from '../axios-instance';
import { HttpError } from '../http-error';

import type { ApiResponse } from '../types';
import {
  assertAgentRevision,
  assertAgentUuid,
  isAgentDate,
  isAgentRecord,
} from './agent-governed-api';
import {
  productSurfaceGovernedMutationConfig,
  type ProductSurfaceGovernedMutationAuthority,
} from './product-surface-governed-mutation';
import type {
  DwaionCommandAttempt,
  DwaionResearchPlanDefinition,
} from './agent-user-advancement-contract';

export type DwaionResearchRecoveryAction =
  | 'SAVE_AS_FORK'
  | 'PULL_AND_MERGE'
  | 'KEEP_LOCAL'
  | 'RECALCULATE_SENSITIVITY'
  | 'USE_CACHE_FALLBACK';

export type DwaionResearchSensitivityAssessment = {
  classification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
  score: number;
  matchedIndicators: string[];
};

export type DwaionResearchRecoveryReceipt = {
  receiptId: string;
  commandId: string;
  action: DwaionResearchRecoveryAction;
  state: 'COMPLETED';
  runId: string;
  sourcePlanId: string;
  sourcePlanRevision: number;
  targetPlanId: string | null;
  targetPlanRevision: number | null;
  cachedRunId: string | null;
  resultSha256: string | null;
  sensitivity: DwaionResearchSensitivityAssessment | null;
  integrityFingerprint: string;
  completedAt: string;
};

const LEGACY_AUTHORITY = { mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' } as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256 = /^[0-9a-f]{64}$/u;

export async function recoverDwaionResearchRun(
  runId: string,
  expectedVersion: number,
  action: DwaionResearchRecoveryAction,
  attempt: DwaionCommandAttempt,
  localDefinition?: DwaionResearchPlanDefinition,
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<DwaionResearchRecoveryReceipt> {
  assertAgentUuid(runId, 'Research recovery run');
  assertAgentRevision(expectedVersion, 'Research recovery version', 1);
  assertAgentUuid(attempt.commandId, 'Research recovery command');
  assertAgentUuid(attempt.idempotencyKey, 'Research recovery idempotency key');
  const requiresLocal = action === 'PULL_AND_MERGE' || action === 'KEEP_LOCAL';
  if (requiresLocal !== Boolean(localDefinition)) {
    throw new TypeError('Research recovery local definition binding is invalid.');
  }
  const response = await axiosInstance.post<ApiResponse<unknown>, object>(
    `/api/agent/v1/research/runs/${encodeURIComponent(runId)}/recovery-actions`,
    {
      commandId: attempt.commandId,
      idempotencyKey: attempt.idempotencyKey,
      expectedVersion,
      action,
      localDefinition: localDefinition ?? null,
      reason: recoveryReason(action),
    },
    productSurfaceGovernedMutationConfig(authority)
  );
  return parseDwaionResearchRecoveryReceipt(response.data.data);
}

export function parseDwaionResearchRecoveryReceipt(value: unknown): DwaionResearchRecoveryReceipt {
  if (
    !isAgentRecord(value) ||
    !uuid(value.receiptId) ||
    !uuid(value.commandId) ||
    !RECOVERY_ACTIONS.has(value.action as DwaionResearchRecoveryAction) ||
    value.state !== 'COMPLETED' ||
    !uuid(value.runId) ||
    !uuid(value.sourcePlanId) ||
    !revision(value.sourcePlanRevision) ||
    !nullableUuid(value.targetPlanId) ||
    !nullableRevision(value.targetPlanRevision) ||
    (value.targetPlanId === null) !== (value.targetPlanRevision === null) ||
    !nullableUuid(value.cachedRunId) ||
    !nullableSha(value.resultSha256) ||
    !sensitivity(value.sensitivity) ||
    typeof value.integrityFingerprint !== 'string' ||
    !SHA256.test(value.integrityFingerprint) ||
    !isAgentDate(value.completedAt)
  ) {
    throw new HttpError('Research recovery receipt is invalid.', 502, value);
  }
  return value as DwaionResearchRecoveryReceipt;
}

function recoveryReason(action: DwaionResearchRecoveryAction): string {
  const reasons: Record<DwaionResearchRecoveryAction, string> = {
    SAVE_AS_FORK: 'The user reviewed the version conflict and requested a lossless governed fork.',
    PULL_AND_MERGE: 'The user reviewed both plan definitions and requested a governed merge.',
    KEEP_LOCAL: 'The user reviewed the conflict and requested a separate governed local version.',
    RECALCULATE_SENSITIVITY:
      'The user requested a new sensitivity assessment for the completed research result.',
    USE_CACHE_FALLBACK:
      'The user reviewed the incomplete run and requested an attested completed cache fallback.',
  };
  return reasons[action];
}

function sensitivity(value: unknown): value is DwaionResearchSensitivityAssessment | null {
  return (
    value === null ||
    (isAgentRecord(value) &&
      ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'].includes(String(value.classification)) &&
      Number.isInteger(value.score) &&
      Number(value.score) >= 0 &&
      Number(value.score) <= 100 &&
      Array.isArray(value.matchedIndicators) &&
      value.matchedIndicators.length <= 20 &&
      value.matchedIndicators.every((item) => typeof item === 'string'))
  );
}

function uuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

function nullableUuid(value: unknown): value is string | null {
  return value === null || uuid(value);
}

function revision(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 1;
}

function nullableRevision(value: unknown): value is number | null {
  return value === null || revision(value);
}

function nullableSha(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && SHA256.test(value));
}

const RECOVERY_ACTIONS = new Set<DwaionResearchRecoveryAction>([
  'SAVE_AS_FORK',
  'PULL_AND_MERGE',
  'KEEP_LOCAL',
  'RECALCULATE_SENSITIVITY',
  'USE_CACHE_FALLBACK',
]);
