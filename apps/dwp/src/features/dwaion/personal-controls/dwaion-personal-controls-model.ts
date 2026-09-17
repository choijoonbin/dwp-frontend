export type DwaionPersonalControlsViewState = 'loading' | 'error' | 'permission-denied' | 'ready';
export type DwaionMemoryKind = 'RESPONSE_LENGTH' | 'OUTPUT_FORMAT' | 'TONE' | 'WORKING_STYLE';
export type DwaionMemoryState = 'ACTIVE' | 'DISABLED' | 'DELETED' | 'EXPIRED';
export type DwaionMemoryScope = 'ASK' | 'RESEARCH' | 'PROPOSALS' | 'ROUTINES' | 'ARTIFACTS';
export type DwaionMemoryFilter = 'ALL' | 'MANUAL' | 'AI_APPROVED' | 'EXPIRING';

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
  evidenceCapabilities: DwaionMemoryEvidenceCapabilities | null;
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
  origin: 'MANUAL';
  sourceType: string;
  confidence: number | null;
  factVector: readonly string[];
  useCount: number;
  lastUsedAt: string | null;
  encryptionProvider: string | null;
  encryptionKeyVersion: string | null;
  encryptionKeyReferenceFingerprint: string | null;
  state: DwaionMemoryState;
  scope: readonly DwaionMemoryScope[];
  expiresAt: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type DwaionMemoryEvidenceCapability = {
  available: boolean;
  configured: boolean;
  reasonCode?: string | null;
  recoveryHint?: string | null;
};

export type DwaionMemoryEvidenceCapabilities = Record<
  | 'manualProvenance'
  | 'aiDerivedMemory'
  | 'confidenceScoring'
  | 'factVector'
  | 'usageMetrics'
  | 'usageTrail'
  | 'kmsBinding',
  DwaionMemoryEvidenceCapability
>;

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
): 'ALLOWED' | 'REVISION_CONFLICT' | 'DELETED' | 'EXPIRED' {
  if (memory.state === 'DELETED' || memory.state === 'EXPIRED') return memory.state;
  return memory.revision === expectedRevision ? 'ALLOWED' : 'REVISION_CONFLICT';
}

export function memoryExpiresSoon(
  memory: DwaionMemoryRecord,
  referenceTime: number,
  windowDays = 30
): boolean {
  if (!memory.expiresAt || memory.state === 'EXPIRED' || windowDays <= 0) return false;
  const expiresAt = Date.parse(memory.expiresAt);
  return (
    Number.isFinite(expiresAt) &&
    expiresAt > referenceTime &&
    expiresAt <= referenceTime + windowDays * 24 * 60 * 60 * 1_000
  );
}

export function filterDwaionMemories(
  memories: readonly DwaionMemoryRecord[],
  filter: DwaionMemoryFilter,
  referenceTime: number
): readonly DwaionMemoryRecord[] {
  if (filter === 'AI_APPROVED') return [];
  if (filter === 'EXPIRING') {
    return memories.filter((memory) => memoryExpiresSoon(memory, referenceTime));
  }
  if (filter === 'MANUAL') return memories.filter((memory) => memory.origin === 'MANUAL');
  return memories;
}

export function dwaionMemoryFilterCounts(
  memories: readonly DwaionMemoryRecord[],
  referenceTime: number
): Record<DwaionMemoryFilter, number> {
  return {
    ALL: memories.length,
    MANUAL: memories.filter((memory) => memory.origin === 'MANUAL').length,
    AI_APPROVED: 0,
    EXPIRING: memories.filter((memory) => memoryExpiresSoon(memory, referenceTime)).length,
  };
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
