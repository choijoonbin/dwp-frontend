import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';
import { Temporal } from 'temporal-polyfill';

import type {
  PerformanceCommandReceipt,
  PerformanceCycleDetail,
  PerformanceCycleStage,
  PerformancePopulationPreview,
  PerformancePopulationPreviewState,
} from './performance-cycle-contract';

export type PerformanceStageInput = Readonly<{
  stageKey: string;
  stageType: string;
  sequenceNo: number;
  opensAt: string;
  closesAt: string;
  required: boolean;
  stageConfig: Readonly<Record<string, unknown>>;
}>;

export type PerformanceCycleDraft = Readonly<{
  cycleId: string | null;
  expectedRevision: number | null;
  cycleKey: string;
  displayName: string;
  retentionPolicyId: string;
  effectiveFrom: string;
  effectiveTo: string;
  timezoneId: string;
  policyVersionId: string;
  populationRuleVersionId: string;
  stages: readonly PerformanceStageInput[];
}>;

export type CreatePerformanceCycleRequest = Readonly<{
  commandId: string;
  cycleKey: string;
  displayName: string;
  retentionPolicyId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  timezoneId: string;
  policyVersionId: string;
  populationRuleVersionId: string | null;
  stages: readonly PerformanceStageInput[];
}>;

export type UpdatePerformanceCycleRequest = Omit<CreatePerformanceCycleRequest, 'cycleKey'> &
  Readonly<{ expectedRevision: number }>;
export type ValidatePerformanceCycleRequest = Readonly<{
  commandId: string;
  expectedRevision: number;
}>;
export type PreviewPerformancePopulationRequest = ValidatePerformanceCycleRequest &
  Readonly<{ asOf: string }>;
export type PublishPerformanceCycleRequest = ValidatePerformanceCycleRequest &
  Readonly<{
    populationPreviewId: string;
    expectedWorkforceOwnerRevision: number;
    publicationApprovalRef: string;
    reason: string;
  }>;

export type PerformanceCycleDraftValidation =
  | 'READY'
  | 'IDENTITY_REQUIRED'
  | 'NAME_REQUIRED'
  | 'REFERENCE_REQUIRED'
  | 'PERIOD_INVALID'
  | 'STAGE_REQUIRED'
  | 'STAGE_INVALID';

export type PerformanceCommandFailure = Readonly<{
  kind:
    | 'CONFLICT'
    | 'UNAUTHENTICATED'
    | 'FORBIDDEN'
    | 'RESULT_UNKNOWN'
    | 'ABORTED'
    | 'REJECTED'
    | 'QUARANTINED';
  preserveDraft: boolean;
  requiresRefresh: boolean;
  replayExactCommand: boolean;
  receiptId: string | null;
}>;

export type PerformanceReceiptDisposition =
  'PENDING' | 'REFRESH_REQUIRED' | 'FAILED' | 'RESULT_UNKNOWN';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validUuid(value: string): boolean {
  return UUID.test(value.trim());
}

function validInstant(value: string): boolean {
  try {
    Temporal.Instant.from(value.trim());
    return true;
  } catch {
    return false;
  }
}

function stageInput(stage: PerformanceCycleStage): PerformanceStageInput {
  return Object.freeze({
    stageKey: stage.stageKey,
    stageType: stage.stageType,
    sequenceNo: stage.sequenceNo,
    opensAt: stage.opensAt,
    closesAt: stage.closesAt,
    required: stage.required,
    stageConfig: stage.stageConfig,
  });
}

export function createPerformanceCycleDraft(
  detail?: PerformanceCycleDetail
): PerformanceCycleDraft {
  if (!detail) {
    return Object.freeze({
      cycleId: null,
      expectedRevision: null,
      cycleKey: '',
      displayName: '',
      retentionPolicyId: '',
      effectiveFrom: '',
      effectiveTo: '',
      timezoneId: 'UTC',
      policyVersionId: '',
      populationRuleVersionId: '',
      stages: Object.freeze([]),
    });
  }
  return Object.freeze({
    cycleId: detail.cycleId,
    expectedRevision: detail.aggregateVersion,
    cycleKey: detail.cycleKey,
    displayName: detail.displayName,
    retentionPolicyId: detail.retentionPolicyId,
    effectiveFrom: detail.version.effectiveFrom,
    effectiveTo: detail.version.effectiveTo ?? '',
    timezoneId: detail.version.timezoneId,
    policyVersionId: detail.version.policyVersionId,
    populationRuleVersionId: detail.version.populationRuleVersionId ?? '',
    stages: Object.freeze(detail.version.stages.map(stageInput)),
  });
}

export function rebasePerformanceCycleDraft(
  draft: PerformanceCycleDraft,
  latest: PerformanceCycleDetail
): PerformanceCycleDraft | null {
  if (draft.cycleId !== latest.cycleId || latest.lifecycleState === 'RETIRED') return null;
  return Object.freeze({
    ...draft,
    expectedRevision: latest.aggregateVersion,
  });
}

export function validatePerformanceCycleDraft(
  draft: PerformanceCycleDraft
): PerformanceCycleDraftValidation {
  if (
    (!draft.cycleId && (!draft.cycleKey.trim() || draft.cycleKey.trim().length > 100)) ||
    (draft.cycleId && !validUuid(draft.cycleId))
  ) {
    return 'IDENTITY_REQUIRED';
  }
  if (!draft.displayName.trim() || draft.displayName.trim().length > 240) return 'NAME_REQUIRED';
  if (
    !validUuid(draft.retentionPolicyId) ||
    !validUuid(draft.policyVersionId) ||
    (draft.populationRuleVersionId.trim() && !validUuid(draft.populationRuleVersionId))
  ) {
    return 'REFERENCE_REQUIRED';
  }
  if (
    !validInstant(draft.effectiveFrom) ||
    (draft.effectiveTo.trim() && !validInstant(draft.effectiveTo)) ||
    (draft.effectiveTo.trim() &&
      Temporal.Instant.compare(draft.effectiveFrom.trim(), draft.effectiveTo.trim()) >= 0)
  ) {
    return 'PERIOD_INVALID';
  }
  if (!draft.timezoneId.trim() || draft.timezoneId.trim().length > 80) return 'PERIOD_INVALID';
  if (!draft.stages.length) return 'STAGE_REQUIRED';
  const keys = new Set<string>();
  for (const [index, stage] of draft.stages.entries()) {
    if (
      !stage.stageKey.trim() ||
      stage.stageKey.trim().length > 80 ||
      !stage.stageType.trim() ||
      stage.stageType.trim().length > 32 ||
      stage.sequenceNo !== index + 1 ||
      keys.has(stage.stageKey.trim()) ||
      !validInstant(stage.opensAt) ||
      !validInstant(stage.closesAt) ||
      Temporal.Instant.compare(stage.opensAt.trim(), stage.closesAt.trim()) >= 0 ||
      Temporal.Instant.compare(stage.opensAt.trim(), draft.effectiveFrom.trim()) < 0 ||
      (draft.effectiveTo.trim() &&
        Temporal.Instant.compare(stage.closesAt.trim(), draft.effectiveTo.trim()) > 0)
    ) {
      return 'STAGE_INVALID';
    }
    keys.add(stage.stageKey.trim());
  }
  return 'READY';
}

function normalizedStages(stages: readonly PerformanceStageInput[]) {
  return Object.freeze(
    stages.map((stage, index) =>
      Object.freeze({
        stageKey: stage.stageKey.trim(),
        stageType: stage.stageType.trim(),
        sequenceNo: index + 1,
        opensAt: stage.opensAt.trim(),
        closesAt: stage.closesAt.trim(),
        required: stage.required,
        stageConfig: stage.stageConfig,
      })
    )
  );
}

export function buildCreatePerformanceCycleRequest(
  draft: PerformanceCycleDraft,
  commandId: string
): CreatePerformanceCycleRequest | null {
  if (draft.cycleId || validatePerformanceCycleDraft(draft) !== 'READY' || !validUuid(commandId)) {
    return null;
  }
  return Object.freeze({
    commandId,
    cycleKey: draft.cycleKey.trim(),
    displayName: draft.displayName.trim(),
    retentionPolicyId: draft.retentionPolicyId.trim(),
    effectiveFrom: draft.effectiveFrom.trim(),
    effectiveTo: draft.effectiveTo.trim() || null,
    timezoneId: draft.timezoneId.trim(),
    policyVersionId: draft.policyVersionId.trim(),
    populationRuleVersionId: draft.populationRuleVersionId.trim() || null,
    stages: normalizedStages(draft.stages),
  });
}

export function buildUpdatePerformanceCycleRequest(
  draft: PerformanceCycleDraft,
  commandId: string
): UpdatePerformanceCycleRequest | null {
  if (
    !draft.cycleId ||
    draft.expectedRevision === null ||
    validatePerformanceCycleDraft(draft) !== 'READY' ||
    !validUuid(commandId)
  ) {
    return null;
  }
  return Object.freeze({
    commandId,
    expectedRevision: draft.expectedRevision,
    displayName: draft.displayName.trim(),
    retentionPolicyId: draft.retentionPolicyId.trim(),
    effectiveFrom: draft.effectiveFrom.trim(),
    effectiveTo: draft.effectiveTo.trim() || null,
    timezoneId: draft.timezoneId.trim(),
    policyVersionId: draft.policyVersionId.trim(),
    populationRuleVersionId: draft.populationRuleVersionId.trim() || null,
    stages: normalizedStages(draft.stages),
  });
}

export function buildPublishPerformanceCycleRequest(
  detail: PerformanceCycleDetail,
  preview: PerformancePopulationPreview,
  commandId: string,
  publicationApprovalRef: string,
  reason: string,
  now = Temporal.Now.instant()
): PublishPerformanceCycleRequest | null {
  const normalizedReason = reason.trim();
  if (
    !validUuid(commandId) ||
    !validUuid(publicationApprovalRef) ||
    normalizedReason.length < 10 ||
    normalizedReason.length > 500 ||
    !performancePreviewIsCurrent(detail, preview, now) ||
    detail.lifecycleState !== 'VALIDATED' ||
    detail.version.versionState !== 'VALIDATED' ||
    !detail.allowedActions.includes('PUBLISH')
  ) {
    return null;
  }
  return Object.freeze({
    commandId,
    expectedRevision: detail.aggregateVersion,
    populationPreviewId: preview.populationPreviewId,
    expectedWorkforceOwnerRevision: preview.workforceSnapshotRevision,
    publicationApprovalRef: publicationApprovalRef.trim(),
    reason: normalizedReason,
  });
}

export function performancePreviewState(
  detail: PerformanceCycleDetail,
  preview: PerformancePopulationPreview,
  now = Temporal.Now.instant()
): PerformancePopulationPreviewState {
  if (preview.state === 'RESULT_UNKNOWN') return 'RESULT_UNKNOWN';
  if (
    preview.state === 'STALE' ||
    preview.cycleVersionId !== detail.version.cycleVersionId ||
    !detail.version.populationRuleVersionId ||
    preview.populationRuleVersionId !== detail.version.populationRuleVersionId ||
    preview.sourceCycleAggregateVersion !== detail.aggregateVersion ||
    !preview.expiresAt ||
    Temporal.Instant.compare(preview.expiresAt, now) <= 0
  ) {
    return 'STALE';
  }
  return 'READY';
}

export function performancePreviewIsCurrent(
  detail: PerformanceCycleDetail,
  preview: PerformancePopulationPreview,
  now = Temporal.Now.instant()
): boolean {
  return performancePreviewState(detail, preview, now) === 'READY';
}

export function performanceReceiptDisposition(
  receipt: PerformanceCommandReceipt
): PerformanceReceiptDisposition {
  if (receipt.state === 'SUCCEEDED') return 'REFRESH_REQUIRED';
  if (receipt.state === 'FAILED' || receipt.state === 'QUARANTINED') return 'FAILED';
  if (receipt.state === 'RESULT_UNKNOWN') return 'RESULT_UNKNOWN';
  return 'PENDING';
}

function errorReceiptId(error: HttpError): string | null {
  if (!error.details || typeof error.details !== 'object' || Array.isArray(error.details))
    return null;
  const candidate = (error.details as Record<string, unknown>).receiptId;
  return typeof candidate === 'string' && validUuid(candidate) ? candidate : null;
}

export function classifyPerformanceCommandFailure(error: unknown): PerformanceCommandFailure {
  if (error instanceof HttpError) {
    const receiptId = errorReceiptId(error);
    if (error.status === 409) {
      return {
        kind: 'CONFLICT',
        preserveDraft: true,
        requiresRefresh: true,
        replayExactCommand: false,
        receiptId,
      };
    }
    if (error.status === 401 || error.status === 403) {
      return {
        kind: error.status === 401 ? 'UNAUTHENTICATED' : 'FORBIDDEN',
        preserveDraft: true,
        requiresRefresh: false,
        replayExactCommand: false,
        receiptId,
      };
    }
    if (error.status === 408 || error.status === 429 || error.status >= 500) {
      return {
        kind: 'RESULT_UNKNOWN',
        preserveDraft: true,
        requiresRefresh: true,
        replayExactCommand: receiptId === null,
        receiptId,
      };
    }
    return {
      kind: 'REJECTED',
      preserveDraft: true,
      requiresRefresh: false,
      replayExactCommand: false,
      receiptId,
    };
  }
  if (error instanceof HttpTransportError && error.reason === 'ABORT') {
    return {
      kind: 'RESULT_UNKNOWN',
      preserveDraft: true,
      requiresRefresh: true,
      replayExactCommand: true,
      receiptId: null,
    };
  }
  return {
    kind: 'RESULT_UNKNOWN',
    preserveDraft: true,
    requiresRefresh: true,
    replayExactCommand: true,
    receiptId: null,
  };
}

export function newPerformanceCommandId(): string {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('Secure command identifier generation is unavailable.');
  }
  return globalThis.crypto.randomUUID();
}
