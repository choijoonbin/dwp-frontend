import type {
  MailAdminOverview,
  MailConnection,
  MailDeliveryAuditExport,
  MailProviderDescriptor,
  MailRetentionEvidenceExport,
} from '@dwp-frontend/shared-utils';

export type MailAdminSurface =
  'operations' | 'connections' | 'shared-access' | 'governance' | 'retention' | 'delivery-audit';

export type MailAdminEvidenceState = 'VERIFIED' | 'REPORTED' | 'PARTIAL' | 'STALE' | 'UNAVAILABLE';

export type MailAdminFreshness = 'CURRENT' | 'STALE' | 'UNKNOWN';

export type MailAdminSourceId = 'OVERVIEW' | 'COMMAND' | 'OUTBOX' | 'PROVIDER' | 'AUDIT' | 'EVENT';

export type MailAdminSourceEvidence = {
  sourceId: MailAdminSourceId;
  state: 'CURRENT' | 'STALE' | 'UNAVAILABLE' | 'PARTIAL';
  observedAt?: string | null;
  errorCode?: string | null;
};

export type MailAdminOperationalException = {
  exceptionId: string;
  kind: 'CONNECTION' | 'DELIVERY' | 'SYNC' | 'OBSERVABILITY';
  severity: 'CRITICAL' | 'WARNING';
  safeResourceRef: string;
  impactCount?: number | null;
  lastObservedAt: string;
  correlationId?: string | null;
  nextAction: 'OPEN_CONNECTION' | 'OPEN_DELIVERY' | 'REFRESH_SOURCE' | 'ESCALATE';
};

export type MailAdminCommandAudit = {
  auditId: string;
  commandType: string;
  safeResourceRef: string;
  actorName: string;
  result: 'SUCCEEDED' | 'FAILED' | 'UNKNOWN' | 'BLOCKED';
  occurredAt: string;
  correlationId: string;
};

export type MailAdminOperationsSnapshot = {
  generatedAt: string;
  sources: readonly MailAdminSourceEvidence[];
  exceptions: readonly MailAdminOperationalException[];
  commands: readonly MailAdminCommandAudit[];
};

export type MailConnectionOperation = {
  operationId: string;
  connectionId: string;
  kind: 'DIAGNOSTIC' | 'SYNCHRONIZE' | 'TEST_SEND';
  state: 'ACCEPTED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'UNKNOWN';
  acceptedAt: string;
  completedAt?: string | null;
  correlationId: string;
  evidenceGeneratedAt?: string | null;
  errorCode?: string | null;
};

export type MailSharedInboxPermissionSet = {
  read: boolean;
  sendAs: boolean;
  sendOnBehalf: boolean;
  assign: boolean;
  manage: boolean;
};

export type MailSharedInboxMember = {
  memberId: string;
  userId: number;
  displayName: string;
  department?: string | null;
  state: 'ACTIVE' | 'PENDING' | 'REVOKED';
  expiresAt?: string | null;
  permissions: MailSharedInboxPermissionSet;
  providerState: 'APPLIED' | 'PARTIAL' | 'PENDING' | 'UNAVAILABLE';
  version: number;
};

export type MailSharedInboxAccess = {
  sharedInboxId: string;
  version: number;
  providerState: 'APPLIED' | 'PARTIAL' | 'PENDING' | 'UNAVAILABLE';
  members: MailSharedInboxMember[];
  impact?: MailSharedInboxAccessImpact | null;
};

export type MailSharedInboxAccessImpact = {
  activeAssignments: number;
  openDrafts: number;
  pendingCommands: number;
  providerRevocationRequired: boolean;
};

export type MailSharedInboxMemberRevokePreview = MailSharedInboxAccessImpact & {
  previewId: string;
  fingerprint: string;
  memberVersion: number;
  generatedAt: string;
  expiresAt: string;
};

export type MailSharedInboxMemberInput = {
  userId: number;
  displayName: string;
  permissions: MailSharedInboxPermissionSet;
  expiresAt?: string | null;
  impactAcknowledged: boolean;
  version: number;
};

export type MailPolicyEnforcementRow = {
  policyKey: string;
  configuredValue: string;
  effectiveValue?: string | null;
  effectiveState: 'ENFORCED' | 'PARTIAL' | 'PENDING' | 'UNVERIFIED';
  scope: string;
  evidenceSource?: string | null;
  evidenceAt?: string | null;
  errorCode?: string | null;
};

export type MailPolicyHistoryItem = {
  historyId: string;
  version: number;
  changedBy: string;
  changedAt: string;
  diffSummary: string;
  result: 'APPLIED' | 'PARTIAL' | 'FAILED' | 'PENDING';
  correlationId: string;
};

export type MailPolicyGovernance = {
  generatedAt: string;
  policyVersion: number;
  rows: readonly MailPolicyEnforcementRow[];
  history: readonly MailPolicyHistoryItem[];
};

export type MailRetentionResourcePolicy = {
  resourceType: string;
  configuredDays: number;
  effectiveDays?: number | null;
  source: string;
  evidenceState: MailAdminEvidenceState;
};

export type MailLegalHold = {
  holdId: string;
  name: string;
  safeCaseRef: string;
  scope: Readonly<Record<string, unknown>>;
  status: 'ACTIVE' | 'RELEASED' | 'EXPIRED';
  startsAt: string;
  expiresAt?: string | null;
  version: number;
};

export type MailPurgeCandidateSnapshot = {
  candidateSnapshotId: string;
  fingerprint: string;
  totalCandidates: number;
  heldCount: number;
  eligibleCount: number;
  partialSources: readonly string[];
  generatedAt: string;
  before: string;
  expiresAt: string;
  policyVersion: number;
  distinctApproverCount: number;
  resourceCounts: Record<'THREADS' | 'MESSAGES' | 'ATTACHMENTS' | 'DRAFTS', number>;
  heldResourceCounts: Record<'THREADS' | 'MESSAGES' | 'ATTACHMENTS' | 'DRAFTS', number>;
  exclusionReasonCounts: Record<'LEGAL_HOLD' | 'IMMUTABLE_EVIDENCE', number>;
  resourceTypes: readonly ('THREADS' | 'MESSAGES' | 'ATTACHMENTS' | 'DRAFTS')[];
  scope: Readonly<Record<string, unknown>>;
};

export const MAIL_PURGE_RESOURCE_TYPES = ['THREADS', 'MESSAGES', 'ATTACHMENTS', 'DRAFTS'] as const;

export type MailPurgeStepResult = {
  step: 'LOCAL' | 'PROVIDER' | 'ATTACHMENT' | 'EVENT' | 'VERIFICATION';
  state: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'UNKNOWN' | 'SKIPPED';
  affectedCount?: number | null;
  correlationId?: string | null;
  errorCode?: string | null;
};

export type MailPurgeJob = {
  jobId: string;
  candidateSnapshotId: string;
  state: 'ACCEPTED' | 'RUNNING' | 'PARTIAL' | 'SUCCEEDED' | 'FAILED' | 'UNKNOWN';
  requestedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  verificationState: 'PENDING' | 'VERIFIED' | 'FAILED' | 'UNKNOWN';
  steps?: readonly MailPurgeStepResult[];
  stepResults?: readonly (MailPurgeStepResult | Readonly<Record<string, unknown>>)[];
  deletedThreads?: number;
  deletedMessages?: number;
  errorCode?: string | null;
};

export type MailRetentionSnapshot = {
  generatedAt: string;
  policyVersion: number;
  resourcePolicies: readonly MailRetentionResourcePolicy[];
  holds: readonly MailLegalHold[];
  purgeJobs: readonly MailPurgeJob[];
  candidates?: readonly MailPurgeCandidateSnapshot[];
  candidate?: MailPurgeCandidateSnapshot | null;
};

export type MailLegalHoldInput = {
  name: string;
  safeCaseRef: string;
  scope: Record<string, unknown>;
  startsAt?: string | null;
  expiresAt?: string | null;
  version: number;
};

export type MailLegalHoldScopeMode = 'TENANT' | 'ACCOUNT' | 'THREAD';

export type MailLegalHoldScopeEditor = Readonly<{
  editable: boolean;
  mode: MailLegalHoldScopeMode;
  ids: string;
  resourceTypes: readonly string[];
}>;

const MAIL_SCOPE_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function scopeStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return value;
  return [];
}

export function mailLegalHoldScopeEditor(
  scope: Readonly<Record<string, unknown>> | null | undefined
): MailLegalHoldScopeEditor {
  if (!scope) return { editable: true, mode: 'TENANT', ids: '', resourceTypes: [] };
  const resourceTypes = scopeStrings(scope.resourceTypes);
  if (scope.tenant === true) return { editable: true, mode: 'TENANT', ids: '', resourceTypes };
  const accountIds = [...scopeStrings(scope.accountId), ...scopeStrings(scope.accountIds)];
  if (accountIds.length) {
    return { editable: true, mode: 'ACCOUNT', ids: accountIds.join(', '), resourceTypes };
  }
  const threadIds = [...scopeStrings(scope.threadId), ...scopeStrings(scope.threadIds)];
  if (threadIds.length) {
    return { editable: true, mode: 'THREAD', ids: threadIds.join(', '), resourceTypes };
  }
  return { editable: false, mode: 'TENANT', ids: '', resourceTypes };
}

export function buildMailLegalHoldScope(
  mode: MailLegalHoldScopeMode,
  ids: string,
  resourceTypes: readonly string[]
): Record<string, unknown> | null {
  const parsedIds = ids
    .split(/[\s,;]+/u)
    .map((value) => value.trim())
    .filter(Boolean);
  if (
    mode !== 'TENANT' &&
    (!parsedIds.length || parsedIds.some((id) => !MAIL_SCOPE_UUID.test(id)))
  ) {
    return null;
  }
  const base: Record<string, unknown> =
    mode === 'TENANT'
      ? { tenant: true }
      : mode === 'ACCOUNT'
        ? { accountIds: parsedIds }
        : { threadIds: parsedIds };
  if (resourceTypes.length) base.resourceTypes = [...resourceTypes];
  return base;
}

export type MailDeliveryTimelineItem = {
  stage: string;
  state: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'UNKNOWN' | 'BLOCKED';
  at?: string | null;
  source: string;
  evidenceState: MailAdminEvidenceState;
  code?: string | null;
};

export type MailDeliveryAuditItem = MailDeliveryRecoveryEvidence & {
  safeResourceRef: string;
  commandType: string;
  actorName: string;
  accountName: string;
  providerType: string;
  stage:
    | 'RECEIVED'
    | 'OUTBOX'
    | 'PROVIDER_SUBMITTED'
    | 'ACCEPTED_BY_PROVIDER'
    | 'DELIVERED_CONFIRMED'
    | 'BOUNCED'
    | 'FAILED'
    | 'UNKNOWN'
    | 'CANCELLED'
    | 'BLOCKED_BY_ACCESS';
  cancelCapability: boolean;
  lastEvidenceAt?: string | null;
  correlationId: string;
  timeline: readonly MailDeliveryTimelineItem[];
  version: number;
};

export type MailDeliveryAuditPage = {
  items: readonly MailDeliveryAuditItem[];
  total: number;
  page: number;
  pageSize: number;
  generatedAt: string;
};

export type MailAuditExport = MailDeliveryAuditExport;
export type MailRetentionExport = MailRetentionEvidenceExport;

export type MailConnectionReadiness = {
  connection: MailConnection;
  descriptor: MailProviderDescriptor | null;
  evidenceState: MailAdminEvidenceState;
  runtimeVerified: boolean;
  credentialVerified: boolean;
  synchronizationVerified: boolean;
  activationAllowed: boolean;
  blockers: readonly MailConnectionEvidenceBlocker[];
};

export type MailConnectionEvidenceBlocker =
  | 'EXTERNAL_PROVIDER_EVIDENCE_UNAVAILABLE'
  | 'RUNTIME_UNAVAILABLE'
  | 'CREDENTIAL_UNVERIFIED'
  | 'SYNCHRONIZATION_UNVERIFIED'
  | 'SYNCHRONIZATION_STALE'
  | 'CONNECTION_DEGRADED'
  | 'SOURCE_STALE';

export type MailOperationalException = {
  id: string;
  kind: 'CONNECTION' | 'DELIVERY';
  severity: 'critical' | 'warning';
  title: string;
  count: number;
  evidenceState: MailAdminEvidenceState;
};

export type MailDeliveryRecoveryEvidence = {
  deliveryId: string;
  state:
    'QUEUED' | 'ACCEPTED_BY_PROVIDER' | 'DELIVERED_CONFIRMED' | 'BOUNCED' | 'FAILED' | 'UNKNOWN';
  retryEligibility: 'ELIGIBLE' | 'INELIGIBLE' | 'UNKNOWN';
  providerDisposition: 'NOT_ACCEPTED' | 'ACCEPTED' | 'UNKNOWN';
  idempotencyState: 'REPLAY_SAFE' | 'NOT_REPLAY_SAFE' | 'UNKNOWN';
  reconcileCapability: boolean;
  evidenceGeneratedAt?: string | null;
};

export type MailDeliveryRecoveryAvailability = {
  retryEnabled: boolean;
  reconcileEnabled: boolean;
  blockedReason:
    | null
    | 'RESULT_UNKNOWN_RECONCILE_FIRST'
    | 'RECOVERY_EVIDENCE_NOT_CURRENT'
    | 'NOT_RETRYABLE'
    | 'DUPLICATE_SAFETY_UNVERIFIED'
    | 'RECONCILIATION_UNAVAILABLE';
};

export type MailPurgeGateEvidence = {
  purgeApiAvailable: boolean;
  legalHoldState: 'CLEAR' | 'ACTIVE' | 'UNKNOWN';
  candidateSnapshotId?: string | null;
  policyVersion?: number | null;
  distinctApproverCount: number;
  authorizationCurrent: boolean;
  candidateCurrent?: boolean;
};

export type MailPurgeAvailability = {
  previewEnabled: boolean;
  executeEnabled: boolean;
  blockers: readonly MailPurgeBlocker[];
};

export type MailPurgeBlocker =
  | 'PURGE_API_UNAVAILABLE'
  | 'LEGAL_HOLD_ACTIVE'
  | 'LEGAL_HOLD_UNVERIFIED'
  | 'CANDIDATE_SNAPSHOT_REQUIRED'
  | 'POLICY_VERSION_REQUIRED'
  | 'CANDIDATE_EXPIRED'
  | 'TWO_APPROVERS_REQUIRED'
  | 'AUTHORIZATION_STALE';

const DEFAULT_STALE_AFTER_MS = 5 * 60 * 1000;
const CONNECTION_SYNC_EVIDENCE_MAX_AGE_MS = 5 * 60 * 1000;
const DELIVERY_RECOVERY_EVIDENCE_MAX_AGE_MS = 2 * 60 * 1000;

function validInstant(value: string | null | undefined) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function resolveMailAdminFreshness(
  generatedAt: string | null | undefined,
  now = Date.now(),
  staleAfterMs = DEFAULT_STALE_AFTER_MS
): MailAdminFreshness {
  const generatedAtMs = validInstant(generatedAt);
  if (generatedAtMs === null) return 'UNKNOWN';
  if (generatedAtMs > now + 60_000) return 'UNKNOWN';
  return now - generatedAtMs > staleAfterMs ? 'STALE' : 'CURRENT';
}

function providerDescriptor(
  connection: MailConnection,
  descriptors: readonly MailProviderDescriptor[]
) {
  return (
    descriptors.find((candidate) => candidate.providerType === connection.providerType) ?? null
  );
}

export function buildMailConnectionReadiness(
  overview: Pick<MailAdminOverview, 'connections' | 'providerCatalog' | 'generatedAt'>,
  now = Date.now()
): MailConnectionReadiness[] {
  const freshness = resolveMailAdminFreshness(overview.generatedAt, now);

  return overview.connections.map((connection) => {
    const descriptor = providerDescriptor(connection, overview.providerCatalog);
    const runtimeVerified = Boolean(
      descriptor?.runtimeState === 'AVAILABLE' && descriptor.adapterVersion
    );
    const credentialVerified =
      connection.providerType === 'DWP_SANDBOX' || connection.credentialConfigured;
    const lastSynchronizedAt = validInstant(connection.lastSynchronizedAt);
    const synchronizationCurrent =
      lastSynchronizedAt !== null &&
      lastSynchronizedAt <= now &&
      now - lastSynchronizedAt <= CONNECTION_SYNC_EVIDENCE_MAX_AGE_MS;
    const synchronizationVerified = Boolean(
      connection.state === 'ACTIVE' && synchronizationCurrent
    );
    const blockers: MailConnectionEvidenceBlocker[] = [];

    // The current backend contract only supplies end-to-end runtime evidence for the sandbox.
    // A provider reporting ACTIVE is not enough to assert consent, credentials, or delivery readiness.
    if (connection.providerType !== 'DWP_SANDBOX') {
      blockers.push('EXTERNAL_PROVIDER_EVIDENCE_UNAVAILABLE');
    }
    if (!runtimeVerified) blockers.push('RUNTIME_UNAVAILABLE');
    if (!credentialVerified) blockers.push('CREDENTIAL_UNVERIFIED');
    if (!synchronizationVerified) {
      const synchronizationIsStale =
        connection.state === 'ACTIVE' &&
        lastSynchronizedAt !== null &&
        lastSynchronizedAt <= now &&
        now - lastSynchronizedAt > CONNECTION_SYNC_EVIDENCE_MAX_AGE_MS;
      blockers.push(
        synchronizationIsStale ? 'SYNCHRONIZATION_STALE' : 'SYNCHRONIZATION_UNVERIFIED'
      );
    }
    if (connection.state === 'DEGRADED') blockers.push('CONNECTION_DEGRADED');
    if (freshness === 'STALE') blockers.push('SOURCE_STALE');

    const activationAllowed =
      connection.providerType === 'DWP_SANDBOX' &&
      freshness === 'CURRENT' &&
      runtimeVerified &&
      credentialVerified &&
      synchronizationVerified &&
      connection.state !== 'DEGRADED';

    let evidenceState: MailAdminEvidenceState = 'REPORTED';
    if (freshness === 'STALE') evidenceState = 'STALE';
    else if (activationAllowed) evidenceState = 'VERIFIED';
    else if (!descriptor || descriptor.runtimeState === 'DEPLOYMENT_REQUIRED') {
      evidenceState = 'UNAVAILABLE';
    } else if (blockers.length > 0) evidenceState = 'PARTIAL';

    return {
      connection,
      descriptor,
      evidenceState,
      runtimeVerified,
      credentialVerified,
      synchronizationVerified,
      activationAllowed,
      blockers,
    };
  });
}

export function canSetMailConnectionState(
  requestedState: MailConnection['state'],
  readiness: MailConnectionReadiness | null | undefined
) {
  return requestedState !== 'ACTIVE' || readiness?.activationAllowed === true;
}

export function buildMailOperationalExceptions(
  overview: Pick<
    MailAdminOverview,
    'connections' | 'providerCatalog' | 'generatedAt' | 'failedDeliveries'
  >,
  now = Date.now()
): MailOperationalException[] {
  const connectionReadiness = buildMailConnectionReadiness(overview, now);
  const exceptions: MailOperationalException[] = connectionReadiness
    .filter(
      ({ connection, evidenceState }) =>
        connection.state === 'DEGRADED' ||
        connection.state === 'CONFIGURATION_REQUIRED' ||
        connection.state === 'SUSPENDED' ||
        evidenceState === 'STALE'
    )
    .map(({ connection, evidenceState }) => ({
      id: `connection:${connection.connectionId}`,
      kind: 'CONNECTION' as const,
      severity: connection.state === 'DEGRADED' ? ('critical' as const) : ('warning' as const),
      title: connection.displayName,
      count: 1,
      evidenceState,
    }));

  if (overview.failedDeliveries > 0) {
    exceptions.unshift({
      id: 'delivery:failed-aggregate',
      kind: 'DELIVERY',
      severity: 'critical',
      title: 'FAILED_DELIVERIES_REPORTED',
      count: overview.failedDeliveries,
      evidenceState: 'PARTIAL',
    });
  }
  return exceptions;
}

export function getMailDeliveryRecoveryAvailability(
  evidence: MailDeliveryRecoveryEvidence,
  now = Date.now()
): MailDeliveryRecoveryAvailability {
  if (evidence.state === 'UNKNOWN') {
    return {
      retryEnabled: false,
      reconcileEnabled: evidence.reconcileCapability,
      blockedReason: evidence.reconcileCapability
        ? 'RESULT_UNKNOWN_RECONCILE_FIRST'
        : 'RECONCILIATION_UNAVAILABLE',
    };
  }

  if (!['FAILED', 'BOUNCED'].includes(evidence.state) || evidence.retryEligibility !== 'ELIGIBLE') {
    return {
      retryEnabled: false,
      reconcileEnabled: false,
      blockedReason: 'NOT_RETRYABLE',
    };
  }

  const evidenceGeneratedAt = validInstant(evidence.evidenceGeneratedAt);
  const evidenceIsCurrent =
    evidenceGeneratedAt !== null &&
    evidenceGeneratedAt <= now &&
    now - evidenceGeneratedAt <= DELIVERY_RECOVERY_EVIDENCE_MAX_AGE_MS;

  if (!evidenceIsCurrent) {
    return {
      retryEnabled: false,
      reconcileEnabled: evidence.reconcileCapability,
      blockedReason: evidence.reconcileCapability
        ? 'RECOVERY_EVIDENCE_NOT_CURRENT'
        : 'RECONCILIATION_UNAVAILABLE',
    };
  }

  const duplicateSafe =
    evidence.providerDisposition === 'NOT_ACCEPTED' || evidence.idempotencyState === 'REPLAY_SAFE';
  return {
    retryEnabled: duplicateSafe,
    reconcileEnabled: false,
    blockedReason: duplicateSafe ? null : 'DUPLICATE_SAFETY_UNVERIFIED',
  };
}

export function getMailPurgeAvailability(evidence: MailPurgeGateEvidence): MailPurgeAvailability {
  const blockers: MailPurgeBlocker[] = [];
  if (!evidence.purgeApiAvailable) blockers.push('PURGE_API_UNAVAILABLE');
  if (evidence.legalHoldState === 'ACTIVE') blockers.push('LEGAL_HOLD_ACTIVE');
  if (evidence.legalHoldState === 'UNKNOWN') blockers.push('LEGAL_HOLD_UNVERIFIED');
  if (!evidence.candidateSnapshotId) blockers.push('CANDIDATE_SNAPSHOT_REQUIRED');
  if (!evidence.policyVersion) blockers.push('POLICY_VERSION_REQUIRED');
  if (evidence.candidateCurrent === false) blockers.push('CANDIDATE_EXPIRED');
  if (evidence.distinctApproverCount < 2) blockers.push('TWO_APPROVERS_REQUIRED');
  if (!evidence.authorizationCurrent) blockers.push('AUTHORIZATION_STALE');

  return {
    previewEnabled:
      evidence.purgeApiAvailable &&
      evidence.legalHoldState !== 'UNKNOWN' &&
      evidence.authorizationCurrent,
    executeEnabled: blockers.length === 0,
    blockers,
  };
}

export function sourceEvidenceState(source: MailAdminSourceEvidence): MailAdminEvidenceState {
  if (source.state === 'CURRENT') return 'VERIFIED';
  if (source.state === 'STALE') return 'STALE';
  if (source.state === 'PARTIAL') return 'PARTIAL';
  return 'UNAVAILABLE';
}

export function buildMailPurgeGateEvidence(
  snapshot: MailRetentionSnapshot | null | undefined,
  authorizationCurrent: boolean,
  now = Date.now()
): MailPurgeGateEvidence {
  const candidate = snapshot?.candidate;
  const candidateExpiresAt = validInstant(candidate?.expiresAt);
  return {
    purgeApiAvailable: Boolean(snapshot),
    legalHoldState: snapshot
      ? snapshot.holds.some((hold) => hold.status === 'ACTIVE')
        ? 'ACTIVE'
        : 'CLEAR'
      : 'UNKNOWN',
    candidateSnapshotId: candidate?.candidateSnapshotId ?? null,
    policyVersion:
      candidate && snapshot && candidate.policyVersion === snapshot.policyVersion
        ? snapshot.policyVersion
        : null,
    distinctApproverCount: candidate?.distinctApproverCount ?? 0,
    authorizationCurrent,
    candidateCurrent: candidate ? candidateExpiresAt !== null && candidateExpiresAt > now : true,
  };
}

export function canCancelMailDelivery(
  item: Pick<MailDeliveryAuditItem, 'state'> &
    Partial<Pick<MailDeliveryAuditItem, 'cancelCapability' | 'stage'>>
): boolean {
  if (!item.cancelCapability || !item.stage) return false;
  return (
    ['RECEIVED', 'OUTBOX'].includes(item.stage) &&
    !['ACCEPTED_BY_PROVIDER', 'DELIVERED_CONFIRMED'].includes(item.state)
  );
}

export function enabledSharedInboxPermissions(permissions: MailSharedInboxPermissionSet) {
  return (Object.keys(permissions) as Array<keyof MailSharedInboxPermissionSet>).filter(
    (permission) => permissions[permission]
  );
}

export function sharedInboxPermissionInputIsValid(input: MailSharedInboxMemberInput): boolean {
  return (
    Number.isInteger(input.userId) &&
    input.userId > 0 &&
    input.displayName.trim().length > 0 &&
    enabledSharedInboxPermissions(input.permissions).length > 0 &&
    input.impactAcknowledged
  );
}
