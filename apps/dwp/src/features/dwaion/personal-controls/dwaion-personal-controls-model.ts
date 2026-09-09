export type DwaionPersonalControlsViewState = 'loading' | 'error' | 'permission-denied' | 'ready';
export type DwaionMemoryKind = 'RESPONSE_LENGTH' | 'OUTPUT_FORMAT' | 'TONE' | 'WORKING_STYLE';
export type DwaionMemoryState = 'ACTIVE' | 'DISABLED' | 'DELETED';

export type DwaionMemoryPreference = {
  state: 'UNSET' | 'DISABLED' | 'ENABLED';
  enabled: boolean;
  effective: boolean;
  runtimeState: 'UNSET' | 'DISABLED' | 'ENABLED';
  runtimeEnabled: boolean;
  revision: number;
  storageAvailable: boolean;
  runtimeApplicationAvailable: boolean;
  automaticMemoryInference: boolean | null;
  sensitiveMemoryAllowed: boolean | null;
  backgroundCredentialStorage: boolean | null;
  teamMemoryAvailable: boolean | null;
  externalActionWithoutApproval: boolean | null;
};

export type DwaionSourcePreference = {
  sourceKey: 'WORK_ITEM' | 'MAIL' | 'CALENDAR';
  label: string;
  description: string;
  enabled: boolean;
  effective: boolean;
  available: boolean;
  revision: number;
  effectScope: string;
  retentionLabel: string;
  unavailableReason?: string;
};

export type DwaionMemoryRecord = {
  memoryId: string;
  kind: DwaionMemoryKind;
  label: string;
  value: string;
  state: DwaionMemoryState;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type DwaionMemoryDraft = {
  kind: DwaionMemoryKind;
  value: string;
};

export type DwaionClearScope = 'PROPOSALS' | 'ROUTINE' | 'MEMORY' | 'ARTIFACT' | 'ARTIFACT_EXPORT';

export type DwaionClearEvidence =
  | {
      kind: 'PROPOSAL_CLEAR';
      receiptId: string;
      completedAt: string;
      hiddenCount: number;
      scopes: readonly ['PROPOSALS'];
    }
  | {
      kind: 'DELETION_REQUEST';
      receiptId: string;
      requestedAt: string;
      state: 'REQUESTED' | 'RUNNING' | 'PARTIAL' | 'COMPLETED' | 'BLOCKED_LEGAL_HOLD' | 'FAILED';
      scopes: readonly Exclude<DwaionClearScope, 'PROPOSALS'>[];
      deletionPerformed: boolean;
      deletionExecutionAvailable: boolean;
      deletionCompletionClaimAvailable: boolean;
      blockedScopes: readonly Exclude<DwaionClearScope, 'PROPOSALS'>[];
      completedAt?: string | null;
    };

export type DwaionRetentionBoundary = {
  domain: Exclude<DwaionClearScope, 'PROPOSALS'>;
  retentionDays: number;
  deletionGraceDays: number;
  legalHold: boolean;
  revision: number;
};

export function sourcePreferenceCanChange(
  preference: DwaionSourcePreference,
  expectedRevision: number
): 'ALLOWED' | 'UNAVAILABLE' | 'REVISION_CONFLICT' {
  if (!preference.available) return 'UNAVAILABLE';
  if (preference.revision !== expectedRevision) return 'REVISION_CONFLICT';
  return 'ALLOWED';
}

export function memoryDraftErrors(draft: DwaionMemoryDraft): readonly string[] {
  const errors: string[] = [];
  if (!draft.kind) errors.push('KIND_REQUIRED');
  if (!draft.value.trim()) errors.push('VALUE_REQUIRED');
  return errors;
}

export function memoryCanMutate(
  memory: DwaionMemoryRecord,
  expectedRevision: number
): 'ALLOWED' | 'REVISION_CONFLICT' | 'DELETED' {
  if (memory.state === 'DELETED') return 'DELETED';
  return memory.revision === expectedRevision ? 'ALLOWED' : 'REVISION_CONFLICT';
}

export function clearRequestIsValid(scopes: readonly DwaionClearScope[]): boolean {
  return scopes.length > 0 && new Set(scopes).size === scopes.length;
}

export function clearEvidenceMatches(
  requestedScopes: readonly DwaionClearScope[],
  evidence: readonly DwaionClearEvidence[]
): boolean {
  const evidenced = new Set<DwaionClearScope>();
  evidence.forEach((item) => item.scopes.forEach((scope) => evidenced.add(scope)));
  return requestedScopes.length > 0 && requestedScopes.every((scope) => evidenced.has(scope));
}

export function deletionCompletionVerified(evidence: DwaionClearEvidence): boolean {
  return (
    evidence.kind === 'DELETION_REQUEST' &&
    evidence.state === 'COMPLETED' &&
    evidence.deletionPerformed === true &&
    evidence.deletionCompletionClaimAvailable === true &&
    evidence.scopes.length > 0 &&
    evidence.blockedScopes.length === 0 &&
    Boolean(evidence.completedAt && Number.isFinite(Date.parse(evidence.completedAt)))
  );
}

export function governanceBoundaryState(value: unknown): 'ALLOWED' | 'BLOCKED' | 'UNKNOWN' {
  return value === true ? 'ALLOWED' : value === false ? 'BLOCKED' : 'UNKNOWN';
}

export function deletionStatusPollInterval({
  receiptState,
  latestState,
  errorStatus,
}: {
  receiptState?: string;
  latestState?: string;
  errorStatus?: number;
}): number | false {
  if (errorStatus && [401, 403, 404].includes(errorStatus)) return false;
  return ['REQUESTED', 'RUNNING'].includes(latestState ?? receiptState ?? '') ? 1_000 : false;
}
