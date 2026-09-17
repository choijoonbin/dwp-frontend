import type { Route } from '@playwright/test';
import type { DwaionTeamArtifactComment } from '@dwp-frontend/shared-utils';

export const DWAION_PERSONAL_PERMISSIONS = [
  ...permissionSet('APP.DWAION_ROUTINES', ['VIEW', 'MANAGE']),
  ...permissionSet('APP.DWAION_MEMORY', ['VIEW', 'MANAGE']),
  ...permissionSet('APP.DWAION_PRIVACY', ['VIEW', 'MANAGE']),
  ...permissionSet('APP.DWAION_ARTIFACTS', ['VIEW', 'CREATE', 'UPDATE', 'PUBLISH', 'EXPORT']),
];

export const ROUTINE_ID = '11111111-1111-4111-8111-111111111111';
export const MEMORY_ID = '22222222-2222-4222-8222-222222222222';
export const ARTIFACT_ID = '33333333-3333-4333-8333-333333333333';
const PREFLIGHT_ID = '44444444-4444-4444-8444-444444444444';
export const ROUTINE_RUN_ID = '55555555-5555-4555-8555-555555555556';
const TEAM_ID = '77777777-7777-4777-8777-777777777777';
const WORKSPACE_ID = '88888888-8888-4888-8888-888888888888';
const SHARE_ID = '99999999-9999-4999-8999-999999999999';
const COMMENT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const REPLY_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

export const controls = {
  memoryState: 'ENABLED',
  revision: 3,
  memoryEnabled: true,
  memoryEffective: true,
  explicitMemoryStorageAvailable: true,
  runtimeApplicationState: 'ENABLED',
  runtimeApplicationEnabled: true,
  runtimeApplicationAvailable: true,
  automaticMemoryInference: false,
  sensitiveMemoryAllowed: false,
  backgroundCredentialStorage: false,
  teamMemoryAvailable: false,
  externalActionWithoutApproval: false,
  evidenceCapabilities: {
    manualProvenance: availableMemoryEvidenceCapability(),
    aiDerivedMemory: unavailableMemoryEvidenceCapability('AI_DERIVED_MEMORY_DISABLED'),
    confidenceScoring: unavailableMemoryEvidenceCapability('CONFIDENCE_SCORING_UNAVAILABLE'),
    factVector: unavailableMemoryEvidenceCapability('FACT_VECTOR_UNAVAILABLE'),
    usageMetrics: availableMemoryEvidenceCapability(),
    usageTrail: unavailableMemoryEvidenceCapability('MEMORY_USAGE_TRAIL_UNAVAILABLE'),
    kmsBinding: availableMemoryEvidenceCapability(),
  },
  sourcePreferences: [
    sourcePreference('WORK_ITEM', 6, true),
    sourcePreference('MAIL', 4, true),
    sourcePreference('CALENDAR', 2, false),
  ],
  updatedAt: '2026-09-04T00:00:00Z',
};

export const routine = {
  routineId: ROUTINE_ID,
  lifecycleState: 'DRAFT',
  consentState: 'ENABLED',
  executionMode: 'DRY_RUN_ONLY',
  revision: 7,
  definition: {
    name: 'Morning priority review',
    objective: 'Validate due work and calendar boundaries before I begin.',
    triggerType: 'SCHEDULED',
    cadence: 'WEEKDAYS',
    localTime: '09:00:00',
    timeZone: 'Asia/Seoul',
    webhookEventType: null,
    webhookEndpointReference: null,
    locale: 'en',
    activeFrom: '2026-09-01',
    activeUntil: null,
    quietHoursStart: '20:00:00',
    quietHoursEnd: '08:00:00',
    weekDays: [],
    sources: ['WORK_ITEM', 'MAIL'],
    budget: {
      maximumRunsPerMonth: 22,
      maximumTokensPerRun: 25_000,
      maximumMinutesPerRun: 20,
    },
    retryPolicy: {
      maximumAttempts: 3,
      initialBackoffSeconds: 30,
      backoffMultiplier: 2,
    },
    notificationPolicy: {
      notifyOnPartial: true,
      notifyOnFailure: true,
      notifyOnRecovery: true,
    },
    compensationPolicy: {
      enabled: true,
      strategy: 'REVOKE_PENDING_HANDOFFS',
    },
  },
  consents: {
    sourceAccess: 'ENABLED',
    analysis: 'ENABLED',
    proposalDelivery: 'ENABLED',
  },
  schedulingAvailable: false,
  nextRunAt: null,
  capabilities: {
    schedulingAvailable: false,
    activationAvailable: false,
    backgroundExecutionAvailable: false,
    dryRunAvailable: true,
    proposalDeliveryAvailable: false,
    externalWriteAvailable: false,
    webhookTriggerAvailable: true,
    agentKernelBinding: availableRoutineCapability(),
    whitelistedSourceBinding: availableRoutineCapability(),
    blockedSourcePolicy: availableRoutineCapability(),
    zeroWritePolicy: availableRoutineCapability(),
    semanticVersionDiff: availableRoutineCapability(),
    runtimeBudgetRetry: availableRoutineCapability(),
    automaticQuarantine: availableRoutineCapability(),
    changeApproval: unavailableRoutineCapability('CHANGE_APPROVAL_NOT_CONFIGURED'),
    agentSwitching: unavailableRoutineCapability('AGENT_SWITCHING_NOT_CONFIGURED'),
    wormDelivery: unavailableRoutineCapability('WORM_DELIVERY_NOT_CONFIGURED'),
    oauthReauthorization: unavailableRoutineCapability('OAUTH_REAUTHORIZATION_NOT_CONFIGURED'),
    temporaryBudgetIncrease: unavailableRoutineCapability('BUDGET_INCREASE_NOT_CONFIGURED'),
    operatorEscalation: unavailableRoutineCapability('OPERATOR_ESCALATION_NOT_CONFIGURED'),
    providerRollback: unavailableRoutineCapability('PROVIDER_ROLLBACK_NOT_CONFIGURED'),
    notificationDeliveryAvailable: false,
    pauseResumeAvailable: true,
    lifecycleMode: 'DRAFT_PREVIEW_ONLY',
  },
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-04T00:00:00Z',
};

function unavailableRoutineCapability(reasonCode: string) {
  return {
    available: false,
    configured: false,
    reasonCode,
    recoveryHint: 'Ask an administrator to configure this governed runtime operation.',
  };
}

function availableMemoryEvidenceCapability() {
  return { available: true, configured: true, reasonCode: null, recoveryHint: null };
}

function unavailableMemoryEvidenceCapability(reasonCode: string) {
  return {
    available: false,
    configured: false,
    reasonCode,
    recoveryHint: 'The current governed memory contract does not provide this evidence.',
  };
}

function availableRoutineCapability() {
  return { available: true, configured: true, reasonCode: null, recoveryHint: null };
}

export const routineVisualVariants = [
  routine,
  {
    ...routine,
    routineId: '11111111-1111-4111-8111-111111111112',
    revision: 4,
    definition: {
      ...routine.definition,
      name: 'Weekly stakeholder preparation',
      objective: 'Validate the approved work references for the weekly review.',
      cadence: 'WEEKLY',
      localTime: '14:00:00',
      weekDays: [3],
      sources: ['WORK_ITEM'],
    },
  },
  {
    ...routine,
    routineId: '11111111-1111-4111-8111-111111111113',
    revision: 9,
    definition: {
      ...routine.definition,
      name: 'Finance close exception monitor',
      objective: 'Reconfirm access before validating finance-close exception references.',
      cadence: 'DAILY',
      localTime: '08:30:00',
      sources: ['WORK_ITEM', 'MAIL'],
    },
    consentState: 'RECONSENT_REQUIRED',
    consents: { ...routine.consents, sourceAccess: 'RECONSENT_REQUIRED' },
  },
  {
    ...routine,
    routineId: '11111111-1111-4111-8111-111111111114',
    revision: 3,
    lifecycleState: 'PAUSED',
    definition: {
      ...routine.definition,
      name: 'Friday status draft validation',
      objective: 'Preview references for the weekly status draft without generating a proposal.',
      cadence: 'WEEKLY',
      localTime: '17:00:00',
      weekDays: [5],
      sources: ['WORK_ITEM'],
    },
  },
] as const;

export const baseArtifact = {
  artifactId: ARTIFACT_ID,
  artifactType: 'WORK_PLAN',
  state: 'DRAFT',
  revision: 4,
  draftRevision: 2,
  currentVersionNumber: 2,
  publishedVersionNumber: null,
  authorSubjectId: '1',
  metadata: {
    tags: ['launch-readiness', 'finance'],
    projectKey: 'DWP-LAUNCH',
    reviewSlaDueAt: '2026-09-18T09:00:00Z',
  },
  content: {
    title: 'Launch readiness plan',
    body: 'Review access boundaries, evidence, and deployment readiness.',
    format: 'MARKDOWN',
  },
  sources: [{ sourceType: 'WORK_ITEM', reference: 'WK-1042' }],
  capabilities: {
    immutableVersionsAvailable: true,
    versionRestoreAvailable: false,
    collaborativeEditingAvailable: false,
    deterministicPreflightAvailable: true,
    enterpriseDlpConnectorAvailable: false,
    sourceVerificationAvailable: false,
    sourceFreshnessAvailable: false,
    personalPublishStateAvailable: true,
    recipientSharingAvailable: false,
    externalSharingAvailable: false,
    exportRequestAvailable: true,
    exportExecutionAvailable: false,
  },
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-04T00:00:00Z',
};

export function unavailablePersonalDataCapability(reasonCode: string) {
  return {
    available: false,
    configured: false,
    reasonCode,
    recoveryHint: 'Ask an administrator to configure this governed data action.',
  };
}

export function availablePersonalDataCapability() {
  return { available: true, configured: true, reasonCode: null, recoveryHint: null };
}

export function routineRuntimeCapabilities() {
  return {
    lifecycleMode: 'GOVERNED_RUNTIME',
    activationAvailable: true,
    schedulingAvailable: true,
    backgroundExecutionAvailable: true,
    dryRunAvailable: true,
    pauseResumeAvailable: true,
    oneTimeScheduleAvailable: true,
    activeWindowPreviewAvailable: true,
    quietHoursPreviewAvailable: true,
    quietHoursDeliveryEnforcementAvailable: true,
    holidayPolicyAvailable: true,
    costBudgetAvailable: true,
    runtimeBudgetAvailable: true,
    notificationDeliveryAvailable: true,
    proposalDeliveryAvailable: true,
    externalWriteAvailable: false,
    webhookTriggerAvailable: true,
    agentKernelBinding: availableRoutineCapability(),
    whitelistedSourceBinding: availableRoutineCapability(),
    blockedSourcePolicy: availableRoutineCapability(),
    zeroWritePolicy: availableRoutineCapability(),
    semanticVersionDiff: availableRoutineCapability(),
    runtimeBudgetRetry: availableRoutineCapability(),
    automaticQuarantine: availableRoutineCapability(),
    changeApproval: unavailableRoutineCapability('CHANGE_APPROVAL_NOT_CONFIGURED'),
    agentSwitching: unavailableRoutineCapability('AGENT_SWITCHING_NOT_CONFIGURED'),
    wormDelivery: unavailableRoutineCapability('WORM_DELIVERY_NOT_CONFIGURED'),
    oauthReauthorization: unavailableRoutineCapability('OAUTH_REAUTHORIZATION_NOT_CONFIGURED'),
    temporaryBudgetIncrease: unavailableRoutineCapability('BUDGET_INCREASE_NOT_CONFIGURED'),
    operatorEscalation: unavailableRoutineCapability('OPERATOR_ESCALATION_NOT_CONFIGURED'),
    providerRollback: unavailableRoutineCapability('PROVIDER_ROLLBACK_NOT_CONFIGURED'),
    executionProviderState: 'AVAILABLE',
    recoveryHint: null,
    supportedCadences: ['DAILY', 'WEEKDAYS', 'WEEKLY'],
    consentScopes: ['SOURCE_ACCESS', 'ANALYSIS', 'PROPOSAL_DELIVERY'],
  };
}

export function routineRun() {
  return {
    routineRunId: ROUTINE_RUN_ID,
    routineId: ROUTINE_ID,
    routineRevision: routine.revision,
    trigger: 'MANUAL',
    state: 'COMPLETED',
    version: 4,
    attemptCount: 1,
    maximumAttempts: 3,
    scheduledFor: '2026-09-04T00:00:00Z',
    nextAttemptAt: null,
    startedAt: '2026-09-04T00:00:01Z',
    completedAt: '2026-09-04T00:00:05Z',
    evidenceCount: 3,
    proposalsCreated: 1,
    approvalGatedActionsCreated: 1,
    tokensUsed: 1840,
    elapsedMs: 4000,
    notificationState: 'DELIVERED',
    safeErrorCode: null,
    recoveryHint: null,
    recoveryAction: null,
    recoveryCommandId: null,
    compensationRequired: false,
    receipt: {
      receiptId: '55555555-5555-4555-8555-555555555557',
      routineRunId: ROUTINE_RUN_ID,
      routineId: ROUTINE_ID,
      routineRevision: routine.revision,
      terminalState: 'COMPLETED',
      providerReceiptId: 'provider-routine-0904',
      resultSha256: '5'.repeat(64),
      evidenceCount: 3,
      proposalsCreated: 1,
      approvalGatedActionsCreated: 1,
      externalWritesPerformed: 0,
      notificationState: 'DELIVERED',
      authorizationDecisionRevision: 11,
      authorizedSources: ['WORK_ITEM', 'MAIL'],
      recoveryAction: null,
      recoveryCommandId: null,
      completedAt: '2026-09-04T00:00:05Z',
    },
    createdAt: '2026-09-04T00:00:00Z',
    updatedAt: '2026-09-04T00:00:05Z',
  };
}

export function routineVersions(current: (typeof routineVisualVariants)[number]) {
  return [
    {
      commandId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      commandType: 'UPDATE',
      revision: current.revision,
      snapshot: current,
      createdAt: current.updatedAt,
      integrityFingerprint: 'c'.repeat(64),
      rollbackTargetRevision: null,
      rollbackTargetFingerprint: null,
    },
    {
      commandId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      commandType: 'CREATE',
      revision: 1,
      snapshot: { ...current, revision: 1, updatedAt: current.createdAt },
      createdAt: current.createdAt,
      integrityFingerprint: 'd'.repeat(64),
      rollbackTargetRevision: null,
      rollbackTargetFingerprint: null,
    },
  ];
}

export function routineHealth() {
  return {
    routineId: ROUTINE_ID,
    routineRevision: routine.revision,
    state: 'HEALTHY',
    workerAvailable: true,
    scheduleCurrent: true,
    allConsentsEnabled: true,
    latestRunId: ROUTINE_RUN_ID,
    latestRunState: 'COMPLETED',
    latestRunAt: '2026-09-04T00:00:05Z',
    recoveryHints: [],
    checkedAt: '2026-09-04T00:01:00Z',
  };
}

export function routineTelemetryEvent() {
  return {
    source: 'EXECUTION',
    eventId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    routineRunId: ROUTINE_RUN_ID,
    eventType: 'RUN_COMPLETED',
    previousState: 'RUNNING',
    currentState: 'COMPLETED',
    version: 4,
    occurredAt: '2026-09-04T00:00:05Z',
    integrityFingerprint: 'e'.repeat(64),
  };
}

export function artifactCollaborationCapabilities() {
  return {
    teamWorkspaceAvailable: true,
    aclPreflightAvailable: true,
    accessRequestAvailable: true,
    collaborationAvailable: true,
    conflictResolutionAvailable: true,
    internalSharingAvailable: true,
    externalSharingAvailable: false,
    shareExpiryAvailable: true,
    shareRevocationAvailable: true,
    inlineComments: {
      available: true,
      configured: true,
      reasonCode: null,
      recoveryHint: null,
    },
    stagedReview: {
      available: true,
      configured: true,
      reasonCode: null,
      recoveryHint: null,
    },
    signedWormReceipt: unavailableRoutineCapability('SIGNED_WORM_RECEIPT_NOT_CONFIGURED'),
    automaticMasking: unavailableRoutineCapability('AUTOMATIC_MASKING_NOT_CONFIGURED'),
    syntheticReplacement: unavailableRoutineCapability('SYNTHETIC_REPLACEMENT_NOT_CONFIGURED'),
    reviewNotification: unavailableRoutineCapability('REVIEW_NOTIFICATION_NOT_CONFIGURED'),
    reviewRejection: {
      available: true,
      configured: true,
      reasonCode: null,
      recoveryHint: null,
    },
    providerState: 'AVAILABLE',
    recoveryHint: null,
  };
}

export function artifactWorkspace(locale: 'en' | 'ko') {
  return {
    workspaceId: WORKSPACE_ID,
    artifactId: ARTIFACT_ID,
    teamId: TEAM_ID,
    state: 'ACTIVE',
    revision: 3,
    content:
      locale === 'ko'
        ? {
            ...baseArtifact.content,
            title: '출시 준비 계획',
            body: '접근 경계, 연결된 근거, 배포 준비 상태를 검토합니다.',
          }
        : baseArtifact.content,
    contentSha256: '8'.repeat(64),
    members: [
      {
        subjectId: 'mina.kim@company.com',
        role: 'OWNER',
        allowed: true,
        deniedSourceCount: 0,
        reasonCode: null,
      },
      {
        subjectId: 'reviewer@company.com',
        role: 'REVIEWER',
        allowed: true,
        deniedSourceCount: 0,
        reasonCode: null,
      },
    ],
    openConflict: null,
    reviewStages: [
      {
        stageId: '12121212-1212-4212-8212-121212121212',
        stageOrder: 1,
        stageKey: 'AUTHOR',
        assigneeSubjectId: '1',
        state: 'PENDING',
        revision: 1,
        evidenceFingerprint: null,
        decidedBySubjectId: null,
        decidedAt: null,
      },
      {
        stageId: '13131313-1313-4313-8313-131313131313',
        stageOrder: 2,
        stageKey: 'PRIMARY_REVIEW',
        assigneeSubjectId: 'reviewer@company.com',
        state: 'PENDING',
        revision: 1,
        evidenceFingerprint: null,
        decidedBySubjectId: null,
        decidedAt: null,
      },
      {
        stageId: '14141414-1414-4414-8414-141414141414',
        stageOrder: 3,
        stageKey: 'FINAL_APPROVAL',
        assigneeSubjectId: null,
        state: 'UNAVAILABLE',
        revision: 1,
        evidenceFingerprint: null,
        decidedBySubjectId: null,
        decidedAt: null,
      },
    ],
    governanceGates: [
      governanceGate('DLP', 'PASS', 'DLP_PREFLIGHT_PASSED', 'dlp:receipt:1042'),
      governanceGate('CITATION', 'PASS', 'CITATIONS_VERIFIED', 'citation:set:1042'),
      governanceGate('RECIPIENT_ACL', 'PASS', 'RECIPIENT_ACL_VERIFIED', 'acl:team:1042'),
      governanceGate('IMMUTABLE_VERSION', 'PASS', 'IMMUTABLE_VERSION_BOUND', 'artifact:version:2'),
    ],
    signatureEvidence: {
      capability: unavailableRoutineCapability('SIGNED_WORM_RECEIPT_NOT_CONFIGURED'),
      provider: null,
      keyReferenceFingerprint: null,
      signature: null,
      signedAt: null,
    },
    reviewSlaDueAt: '2026-09-18T09:00:00Z',
    shares: [
      {
        shareId: SHARE_ID,
        workspaceId: WORKSPACE_ID,
        state: 'ACTIVE',
        permission: 'COMMENT',
        memberCount: 2,
        expiresAt: '2026-09-05T00:00:00Z',
        revokedAt: null,
        receiptId: '99999999-9999-4999-8999-999999999998',
        receiptSha256: '9'.repeat(64),
        revocationReceiptId: null,
        revocationReceiptSha256: null,
        createdAt: '2026-09-04T00:00:00Z',
      },
    ],
    createdAt: '2026-09-04T00:00:00Z',
    updatedAt: '2026-09-04T00:00:05Z',
  };
}

export function artifactComment(locale: 'en' | 'ko'): DwaionTeamArtifactComment {
  return {
    commentId: COMMENT_ID,
    workspaceId: WORKSPACE_ID,
    artifactId: ARTIFACT_ID,
    authorSubjectId: 'reviewer@company.com',
    authorDisplayName: locale === 'ko' ? '김민아' : 'Mina Kim',
    body:
      locale === 'ko'
        ? '환율 스트레스 테스트의 기준 시점을 다시 확인해 주세요.'
        : 'Please reconfirm the baseline date for the exchange-rate stress test.',
    anchor: locale === 'ko' ? '3. 환율 민감도 분석' : '3. Exchange-rate sensitivity',
    state: 'OPEN',
    revision: 2,
    replies: [],
    createdAt: '2026-09-04T01:30:00Z',
    updatedAt: '2026-09-04T01:30:00Z',
    resolvedAt: null,
  };
}

export function completedDeletionJob() {
  return {
    deletionJobId: '66666666-6666-4666-8666-666666666667',
    state: 'COMPLETED',
    domains: ['MEMORY'],
    requestedAt: '2026-09-04T00:05:00Z',
    completedAt: '2026-09-04T00:06:00Z',
    deletionPerformed: true,
    deletionExecutionAvailable: true,
    blockedDomains: [],
    attemptCount: 1,
    stages: deletionStages('COMPLETED'),
    legalHolds: [],
    targets: [completedDeletionTarget('MEMORY')],
  };
}

export function completedDeletionTarget(domain: string) {
  return {
    domain,
    state: 'COMPLETED',
    affectedCount: 2,
    safeErrorCode: null,
    legalHoldEvidence: null,
    disposition: {
      dispositionId: '66666666-6666-4666-8666-666666666668',
      domain,
      generation: 1,
      purgedRowCount: 2,
      purgedTableCounts: { ai_personal_memories: 2 },
      dispositionScope: 'AGENT_ACTIVE_POSTGRES_DOMAIN_ONLY',
      dispositionMethod: 'PHYSICAL_ROW_PURGE_OF_ENCRYPTED_RECORDS',
      activeStoreEnvelopesDestroyed: true,
      sourceSystemDataAffected: false,
      backupDispositionState: 'EXTERNAL_RETENTION_BOUNDARY',
      receiptFingerprint: '6'.repeat(64),
      completedAt: '2026-09-04T00:06:00Z',
    },
  };
}

function governanceGate(
  key: 'DLP' | 'CITATION' | 'RECIPIENT_ACL' | 'IMMUTABLE_VERSION',
  state: 'PASS',
  detailCode: string,
  evidenceReference: string
) {
  return {
    key,
    state,
    detailCode,
    evidenceReference,
    evidenceFingerprint: 'b'.repeat(64),
    evaluatedAt: '2026-09-17T03:00:00Z',
  };
}

export function deletionStages(state: 'REQUESTED' | 'RUNNING' | 'COMPLETED') {
  const terminal = state === 'COMPLETED';
  const running = state === 'RUNNING';
  return [
    deletionStage('REQUEST_ACCEPTED', 'COMPLETED', 'REQUEST_ACCEPTED'),
    deletionStage(
      'TARGETS_SCHEDULED',
      terminal || running ? 'COMPLETED' : 'PENDING',
      'TARGETS_SCHEDULED'
    ),
    deletionStage(
      'ACTIVE_STORE_DISPOSITION',
      terminal ? 'COMPLETED' : running ? 'RUNNING' : 'PENDING',
      terminal ? 'ACTIVE_STORE_DISPOSITION_COMPLETED' : 'ACTIVE_STORE_DISPOSITION_PENDING'
    ),
    deletionStage(
      'BACKUP_BOUNDARY',
      terminal ? 'COMPLETED' : 'PENDING',
      terminal ? 'BACKUP_BOUNDARY_RECORDED' : 'BACKUP_BOUNDARY_PENDING'
    ),
    deletionStage(
      'RECEIPT_FINALIZATION',
      terminal ? 'COMPLETED' : 'PENDING',
      terminal ? 'RECEIPT_FINALIZED' : 'RECEIPT_PENDING'
    ),
  ];
}

function deletionStage(
  key:
    | 'REQUEST_ACCEPTED'
    | 'TARGETS_SCHEDULED'
    | 'ACTIVE_STORE_DISPOSITION'
    | 'BACKUP_BOUNDARY'
    | 'RECEIPT_FINALIZATION',
  state: 'PENDING' | 'RUNNING' | 'COMPLETED',
  detailCode: string
) {
  const observed = state === 'COMPLETED';
  return {
    key,
    state,
    detailCode,
    observedAt: observed ? '2026-09-04T00:06:00Z' : null,
    evidenceReference: observed ? `deletion:${key.toLowerCase()}` : null,
    evidenceFingerprint: observed ? '7'.repeat(64) : null,
  };
}

function permissionSet(resourceKey: string, codes: readonly string[]) {
  return codes.map((permissionCode) => ({
    resourceType: 'APP',
    resourceKey,
    permissionCode,
    effect: 'ALLOW' as const,
  }));
}

function sourcePreference(sourceKey: string, revision: number, available: boolean) {
  return {
    sourceKey,
    available,
    enabled: available,
    effective: available,
    revision,
    effectScope: 'PERSONAL_ROUTINE_DRY_RUN_ONLY',
    retention: 'REFERENCE_ONLY_NO_RAW_COPY',
    proactiveAnalysisIntegrationAvailable: false,
    updatedAt: '2026-09-04T00:00:00Z',
  };
}

export function artifactVersion(versionNumber: number, body = `Governed version ${versionNumber}`) {
  return {
    artifactId: ARTIFACT_ID,
    versionNumber,
    contentFingerprint: String(versionNumber).repeat(64),
    sourceCount: 1,
    immutable: true,
    createdAt: `2026-09-0${versionNumber}T00:00:00Z`,
    content: { title: baseArtifact.content.title, body, format: 'MARKDOWN' },
    sourceEvidence: [
      {
        source: baseArtifact.sources[0],
        verificationState: 'UNVERIFIED',
        freshness: 'UNKNOWN',
        verifiedAt: null,
      },
    ],
  };
}

export function preflight(artifactRevision: number) {
  return {
    preflightId: PREFLIGHT_ID,
    artifactId: ARTIFACT_ID,
    artifactRevision,
    versionNumber: 2,
    policyKey: 'DWP_DETERMINISTIC_DLP_V1',
    policyVersion: 1,
    outcome: 'PASS',
    findings: [],
    evaluatedAt: '2026-09-04T00:00:00Z',
    expiresAt: '2026-09-04T00:15:00Z',
    current: true,
    publishAllowed: true,
    exportAllowed: true,
  };
}

export function success(route: Route, data: unknown, status = 200) {
  return route.fulfill({ status, json: { success: true, status: 'SUCCESS', data } });
}
