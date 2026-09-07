export type DwaionPersonalControlsViewState = 'loading' | 'error' | 'permission-denied' | 'ready';
export type DwaionMemoryKind = 'RESPONSE_LENGTH' | 'OUTPUT_FORMAT' | 'TONE' | 'WORKING_STYLE';
export type DwaionMemoryState = 'ACTIVE' | 'DISABLED' | 'DELETED';

export type DwaionMemoryPreference = {
  state: 'UNSET' | 'DISABLED' | 'ENABLED';
  enabled: boolean;
  effective: boolean;
  revision: number;
  storageAvailable: boolean;
  runtimeApplicationAvailable: boolean;
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
      blockedScopes: readonly Exclude<DwaionClearScope, 'PROPOSALS'>[];
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
