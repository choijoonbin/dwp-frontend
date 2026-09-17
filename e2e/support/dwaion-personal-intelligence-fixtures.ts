import type { Page, Route } from '@playwright/test';
import type { DwaionTeamArtifactComment } from '@dwp-frontend/shared-utils';

export const DWAION_PERSONAL_PERMISSIONS = [
  ...permissionSet('APP.DWAION_ROUTINES', ['VIEW', 'MANAGE']),
  ...permissionSet('APP.DWAION_MEMORY', ['VIEW', 'MANAGE']),
  ...permissionSet('APP.DWAION_PRIVACY', ['VIEW', 'MANAGE']),
  ...permissionSet('APP.DWAION_ARTIFACTS', ['VIEW', 'CREATE', 'UPDATE', 'PUBLISH', 'EXPORT']),
];

const ROUTINE_ID = '11111111-1111-4111-8111-111111111111';
const MEMORY_ID = '22222222-2222-4222-8222-222222222222';
const ARTIFACT_ID = '33333333-3333-4333-8333-333333333333';
const PREFLIGHT_ID = '44444444-4444-4444-8444-444444444444';
const ROUTINE_RUN_ID = '55555555-5555-4555-8555-555555555556';
const TEAM_ID = '77777777-7777-4777-8777-777777777777';
const WORKSPACE_ID = '88888888-8888-4888-8888-888888888888';
const SHARE_ID = '99999999-9999-4999-8999-999999999999';
const COMMENT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const REPLY_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const controls = {
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

const routine = {
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

const routineVisualVariants = [
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

const baseArtifact = {
  artifactId: ARTIFACT_ID,
  artifactType: 'WORK_PLAN',
  state: 'DRAFT',
  revision: 4,
  draftRevision: 2,
  currentVersionNumber: 2,
  publishedVersionNumber: null,
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

export type PersonalIntelligenceProbe = {
  artifactAutosaves: number;
  lastArtifactBody: string | null;
  artifactCommentMutations: number;
  dryRuns: number;
  runtimePreferenceUpdates: number;
  lastRuntimeApplicationState: string | null;
  deletionRequests: number;
  deletionStatusReads: number;
};

export async function mockDwaionPersonalIntelligence(
  page: Page,
  options: {
    published?: boolean;
    deletionExecutionAvailable?: boolean;
    locale?: 'en' | 'ko';
  } = {}
): Promise<PersonalIntelligenceProbe> {
  const probe: PersonalIntelligenceProbe = {
    artifactAutosaves: 0,
    lastArtifactBody: null,
    artifactCommentMutations: 0,
    dryRuns: 0,
    runtimePreferenceUpdates: 0,
    lastRuntimeApplicationState: null,
    deletionRequests: 0,
    deletionStatusReads: 0,
  };
  let artifact = {
    ...structuredClone(baseArtifact),
    ...(options.published ? { state: 'PUBLISHED', publishedVersionNumber: 2 } : {}),
    ...(options.locale === 'ko'
      ? {
          content: {
            ...baseArtifact.content,
            title: '출시 준비 계획',
            body: '접근 경계, 연결된 근거, 배포 준비 상태를 검토합니다.',
          },
        }
      : {}),
  };
  let controlsState = structuredClone(controls);
  let memoryState = {
    memoryId: MEMORY_ID,
    kind: 'TONE',
    state: 'ACTIVE',
    revision: 2,
    memory: {
      value:
        options.locale === 'ko'
          ? '항상 세 줄 핵심 요약과 간결한 문장을 사용합니다.'
          : 'Use a concise, direct tone.',
    },
    origin: 'MANUAL',
    sourceType: 'USER_EXPLICIT_ENTRY',
    confidence: null,
    factVector: [],
    useCount: 9,
    lastUsedAt: '2026-09-04T01:30:00Z',
    encryptionProvider: 'AWS_KMS',
    encryptionKeyVersion: 'v7',
    encryptionKeyReferenceFingerprint: '4e8201a4c301',
    scope: ['ASK', 'RESEARCH', 'PROPOSALS'],
    expiresAt: '2026-10-14T09:00:00+09:00',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-04T00:00:00Z',
  };
  let artifactComments: DwaionTeamArtifactComment[] = [artifactComment(options.locale ?? 'en')];
  const routinePayloads =
    options.locale === 'ko'
      ? routineVisualVariants.map((item, index) => ({
          ...item,
          definition: {
            ...item.definition,
            name: [
              '아침 우선순위 검토',
              '주간 이해관계자 회의 준비',
              '결산 예외 접근 재확인',
              '금요일 상태 보고 초안 검증',
            ][index],
            objective: [
              '업무를 시작하기 전 마감 업무와 일정 참조 범위를 검증합니다.',
              '주간 검토에 허용된 업무 참조가 연결되어 있는지 확인합니다.',
              '결산 예외 참조를 검증하기 전에 변경된 접근 권한을 다시 확인합니다.',
              '제안을 만들지 않고 주간 상태 보고서의 참조만 미리 점검합니다.',
            ][index],
          },
        }))
      : routineVisualVariants;

  await page.route('**/api/agent/v1/routines**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'GET' && path.endsWith('/routines/capabilities')) {
      return success(route, routineRuntimeCapabilities());
    }
    if (route.request().method() === 'GET' && path === '/api/agent/v1/routines') {
      return success(route, routinePayloads);
    }
    if (
      route.request().method() === 'GET' &&
      path === `/api/agent/v1/routines/${ROUTINE_ID}/runs`
    ) {
      return success(route, [routineRun()]);
    }
    if (
      route.request().method() === 'GET' &&
      path === `/api/agent/v1/routines/${ROUTINE_ID}/versions`
    ) {
      return success(route, routineVersions(routinePayloads[0]!));
    }
    if (
      route.request().method() === 'GET' &&
      path === `/api/agent/v1/routines/${ROUTINE_ID}/health`
    ) {
      return success(route, routineHealth());
    }
    if (
      route.request().method() === 'GET' &&
      path === `/api/agent/v1/routines/${ROUTINE_ID}/telemetry/download`
    ) {
      return route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        headers: {
          'Cache-Control': 'no-store',
          'Content-Disposition': `attachment; filename="routine-${ROUTINE_ID}-telemetry.jsonl"`,
        },
        body: `${JSON.stringify(routineTelemetryEvent())}\n`,
      });
    }
    if (route.request().method() === 'POST' && path.endsWith('/dry-runs')) {
      probe.dryRuns += 1;
      return success(route, {
        routineRunId: '55555555-5555-4555-8555-555555555555',
        routineId: ROUTINE_ID,
        routineRevision: routine.revision,
        outcome: 'VALIDATED',
        proposalOnly: true,
        evidenceCount: 2,
        evidenceScope: 'AUTHORIZED_SOURCE_BINDING',
        businessEvidenceCount: 0,
        proposalsCreated: 0,
        externalWritesPerformed: 0,
        validatedSources: ['WORK_ITEM', 'MAIL'],
        previewNextRunAt: '2026-09-05T00:00:00Z',
        schedulingAvailable: false,
        evaluatedAt: '2026-09-04T00:00:00Z',
      });
    }
    return route.fulfill({ status: 501, json: { detail: 'Routine command is not mocked.' } });
  });

  await page.route('**/api/agent/v1/ai-controls**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/memories')) {
      return success(route, [memoryState]);
    }
    if (request.method() === 'GET' && path === '/api/agent/v1/ai-controls') {
      return success(route, controlsState);
    }
    if (request.method() === 'PUT' && path.endsWith('/runtime')) {
      const body = request.postDataJSON() as {
        expectedRevision: number;
        runtimeApplicationState: 'ENABLED' | 'DISABLED';
      };
      if (body.expectedRevision !== controlsState.revision) {
        return route.fulfill({ status: 409, json: { detail: 'Revision conflict.' } });
      }
      probe.runtimePreferenceUpdates += 1;
      probe.lastRuntimeApplicationState = body.runtimeApplicationState;
      controlsState = {
        ...controlsState,
        revision: controlsState.revision + 1,
        memoryEffective: body.runtimeApplicationState === 'ENABLED',
        runtimeApplicationState: body.runtimeApplicationState,
        runtimeApplicationEnabled: body.runtimeApplicationState === 'ENABLED',
        updatedAt: '2026-09-04T01:00:00Z',
      };
      return success(route, controlsState);
    }
    if (request.method() === 'PUT' && path.endsWith(`/memories/${MEMORY_ID}`)) {
      const body = request.postDataJSON() as {
        expectedRevision: number;
        memory?: { value: string };
        scope?: string[];
        expiresAt?: string | null;
      };
      if (body.expectedRevision !== memoryState.revision) {
        return route.fulfill({ status: 409, json: { detail: 'Revision conflict.' } });
      }
      memoryState = {
        ...memoryState,
        revision: memoryState.revision + 1,
        ...(body.memory ? { memory: body.memory } : {}),
        ...(body.scope ? { scope: body.scope } : {}),
        ...(Object.prototype.hasOwnProperty.call(body, 'expiresAt')
          ? { expiresAt: body.expiresAt ?? null }
          : {}),
        updatedAt: '2026-09-17T03:00:00Z',
      };
      return success(route, memoryState);
    }
    return route.fulfill({ status: 501, json: { detail: 'AI control command is not mocked.' } });
  });

  await page.route('**/api/agent/v1/personal-data/**', (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/capabilities')) {
      return success(route, {
        supportedDeletionDomains: ['ROUTINE', 'MEMORY', 'ARTIFACT', 'ARTIFACT_EXPORT'],
        deletionRequestAvailable: true,
        deletionExecutionAvailable: options.deletionExecutionAvailable ?? false,
        deletionCompletionClaimAvailable: options.deletionExecutionAvailable ?? false,
        proposalClearManagedSeparately: true,
        proposalClearRoute: '/v1/proposals/clear',
        sourceSystemDataAffected: false,
        auditMetadataMayBeRetained: true,
        analysisReceiptClearAvailable: false,
        backupDestructionLog: unavailablePersonalDataCapability(
          'BACKUP_DESTRUCTION_LOG_NOT_CONFIGURED'
        ),
        sreSupport: unavailablePersonalDataCapability('SRE_SUPPORT_NOT_CONFIGURED'),
        legalHoldEvidence: availablePersonalDataCapability(),
        legalHoldAppeal: unavailablePersonalDataCapability('LEGAL_HOLD_APPEAL_NOT_CONFIGURED'),
        signedCertificate: unavailablePersonalDataCapability('SIGNED_CERTIFICATE_NOT_CONFIGURED'),
        siemSync: unavailablePersonalDataCapability('SIEM_SYNC_NOT_CONFIGURED'),
      });
    }
    if (path.endsWith('/retention')) {
      return success(
        route,
        ['ROUTINE', 'MEMORY', 'ARTIFACT', 'ARTIFACT_EXPORT'].map((domain) => ({
          domain,
          retentionDays: 90,
          deletionGraceDays: 7,
          legalHold: false,
          revision: 1,
          updatedAt: '2026-09-04T00:00:00Z',
        }))
      );
    }
    if (request.method() === 'POST' && path.endsWith('/deletions')) {
      probe.deletionRequests += 1;
      const body = request.postDataJSON() as { domains: string[] };
      return success(route, {
        deletionJobId: '66666666-6666-4666-8666-666666666666',
        state: options.deletionExecutionAvailable ? 'RUNNING' : 'REQUESTED',
        domains: body.domains,
        requestedAt: '2026-09-04T00:05:00Z',
        completedAt: null,
        deletionPerformed: false,
        deletionExecutionAvailable: options.deletionExecutionAvailable ?? false,
        blockedDomains: [],
        attemptCount: 1,
        targets: body.domains.map((domain) => ({
          domain,
          state: options.deletionExecutionAvailable ? 'RUNNING' : 'REQUESTED',
          affectedCount: null,
          safeErrorCode: null,
          disposition: null,
        })),
      });
    }
    if (request.method() === 'GET' && path.endsWith('/deletions')) {
      return success(route, [completedDeletionJob()]);
    }
    if (
      request.method() === 'GET' &&
      path.endsWith('/deletions/66666666-6666-4666-8666-666666666666')
    ) {
      probe.deletionStatusReads += 1;
      const completed = probe.deletionStatusReads >= 2;
      return success(route, {
        deletionJobId: '66666666-6666-4666-8666-666666666666',
        state: completed ? 'COMPLETED' : 'RUNNING',
        domains: ['MEMORY'],
        requestedAt: '2026-09-04T00:05:00Z',
        completedAt: completed ? '2026-09-04T00:06:00Z' : null,
        deletionPerformed: completed,
        deletionExecutionAvailable: true,
        blockedDomains: [],
        attemptCount: 1,
        targets: [
          completed
            ? completedDeletionTarget('MEMORY')
            : {
                domain: 'MEMORY',
                state: 'RUNNING',
                affectedCount: null,
                safeErrorCode: null,
                disposition: null,
              },
        ],
      });
    }
    return route.fulfill({ status: 501, json: { detail: 'Personal data command is not mocked.' } });
  });

  await page.route('**/api/agent/v1/artifacts**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path === '/api/agent/v1/artifacts') {
      return success(route, [artifact]);
    }
    if (request.method() === 'GET' && path === `/api/agent/v1/artifacts/${ARTIFACT_ID}`) {
      return success(route, artifact);
    }
    if (request.method() === 'GET' && path.endsWith('/versions')) {
      return success(route, [artifactVersion(1), artifactVersion(2)]);
    }
    if (request.method() === 'GET' && path.endsWith('/versions/1')) {
      return success(route, artifactVersion(1, 'Initial governed draft'));
    }
    if (request.method() === 'GET' && path.endsWith('/versions/2')) {
      return success(route, artifactVersion(2, artifact.content.body));
    }
    if (request.method() === 'GET' && path.endsWith('/preflights/current')) {
      return success(route, preflight(artifact.revision));
    }
    if (request.method() === 'PUT' && path.endsWith('/draft')) {
      const body = request.postDataJSON() as {
        content: typeof baseArtifact.content;
        sources: typeof baseArtifact.sources;
      };
      probe.artifactAutosaves += 1;
      probe.lastArtifactBody = body.content.body;
      artifact = {
        ...artifact,
        revision: artifact.revision + 1,
        draftRevision: artifact.draftRevision + 1,
        content: body.content,
        sources: body.sources,
        updatedAt: '2026-09-04T01:00:00Z',
      };
      return success(route, artifact);
    }
    return route.fulfill({ status: 501, json: { detail: 'Artifact command is not mocked.' } });
  });

  await page.route('**/api/agent/v1/artifact-collaboration/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/capabilities')) {
      return success(route, artifactCollaborationCapabilities());
    }
    if (request.method() === 'GET' && path.endsWith(`/${ARTIFACT_ID}/workspace`)) {
      return success(route, artifactWorkspace());
    }
    if (path.endsWith(`/${ARTIFACT_ID}/workspace/comments`)) {
      if (request.method() === 'GET') return success(route, artifactComments);
      if (request.method() === 'POST') {
        const body = request.postDataJSON() as {
          body: string;
          anchor: string | null;
        };
        const created = {
          ...artifactComment(options.locale ?? 'en'),
          commentId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          authorSubjectId: 'current.user@company.com',
          authorDisplayName: options.locale === 'ko' ? '현재 사용자' : 'Current user',
          body: body.body,
          anchor: body.anchor,
          revision: 1,
          replies: [],
          createdAt: '2026-09-04T02:00:00Z',
          updatedAt: '2026-09-04T02:00:00Z',
        };
        artifactComments = [...artifactComments, created];
        probe.artifactCommentMutations += 1;
        return success(route, created, 201);
      }
    }
    const commentReplyMatch = path.match(
      new RegExp(`/${ARTIFACT_ID}/workspace/comments/([^/]+)/replies$`, 'u')
    );
    if (request.method() === 'POST' && commentReplyMatch) {
      const commentId = commentReplyMatch[1]!;
      const body = request.postDataJSON() as { body: string };
      artifactComments = artifactComments.map((comment) =>
        comment.commentId === commentId
          ? {
              ...comment,
              revision: comment.revision + 1,
              replies: [
                ...comment.replies,
                {
                  replyId: REPLY_ID,
                  commentId,
                  authorSubjectId: 'current.user@company.com',
                  authorDisplayName: options.locale === 'ko' ? '현재 사용자' : 'Current user',
                  body: body.body,
                  createdAt: '2026-09-04T02:01:00Z',
                },
              ],
              updatedAt: '2026-09-04T02:01:00Z',
            }
          : comment
      );
      probe.artifactCommentMutations += 1;
      return success(
        route,
        artifactComments.find((comment) => comment.commentId === commentId)
      );
    }
    const commentResolveMatch = path.match(
      new RegExp(`/${ARTIFACT_ID}/workspace/comments/([^/]+)/resolve$`, 'u')
    );
    if (request.method() === 'POST' && commentResolveMatch) {
      const commentId = commentResolveMatch[1]!;
      artifactComments = artifactComments.map((comment) =>
        comment.commentId === commentId
          ? {
              ...comment,
              state: 'RESOLVED',
              revision: comment.revision + 1,
              updatedAt: '2026-09-04T02:02:00Z',
              resolvedAt: '2026-09-04T02:02:00Z',
            }
          : comment
      );
      probe.artifactCommentMutations += 1;
      return success(
        route,
        artifactComments.find((comment) => comment.commentId === commentId)
      );
    }
    return route.fulfill({
      status: 501,
      json: { detail: 'Artifact collaboration command is not mocked.' },
    });
  });

  return probe;
}

function unavailablePersonalDataCapability(reasonCode: string) {
  return {
    available: false,
    configured: false,
    reasonCode,
    recoveryHint: 'Ask an administrator to configure this governed data action.',
  };
}

function availablePersonalDataCapability() {
  return { available: true, configured: true, reasonCode: null, recoveryHint: null };
}

function routineRuntimeCapabilities() {
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

function routineRun() {
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
      completedAt: '2026-09-04T00:00:05Z',
    },
    createdAt: '2026-09-04T00:00:00Z',
    updatedAt: '2026-09-04T00:00:05Z',
  };
}

function routineVersions(current: (typeof routineVisualVariants)[number]) {
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

function routineHealth() {
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

function routineTelemetryEvent() {
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

function artifactCollaborationCapabilities() {
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
    automaticMasking: unavailableRoutineCapability('AUTOMATIC_MASKING_NOT_CONFIGURED'),
    syntheticReplacement: unavailableRoutineCapability('SYNTHETIC_REPLACEMENT_NOT_CONFIGURED'),
    reviewNotification: unavailableRoutineCapability('REVIEW_NOTIFICATION_NOT_CONFIGURED'),
    reviewRejection: unavailableRoutineCapability('REVIEW_REJECTION_NOT_CONFIGURED'),
    providerState: 'AVAILABLE',
    recoveryHint: null,
  };
}

function artifactWorkspace() {
  return {
    workspaceId: WORKSPACE_ID,
    artifactId: ARTIFACT_ID,
    teamId: TEAM_ID,
    state: 'ACTIVE',
    revision: 3,
    content: baseArtifact.content,
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

function artifactComment(locale: 'en' | 'ko'): DwaionTeamArtifactComment {
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

function completedDeletionJob() {
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
    targets: [completedDeletionTarget('MEMORY')],
  };
}

function completedDeletionTarget(domain: string) {
  return {
    domain,
    state: 'COMPLETED',
    affectedCount: 2,
    safeErrorCode: null,
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

function artifactVersion(versionNumber: number, body = `Governed version ${versionNumber}`) {
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

function preflight(artifactRevision: number) {
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

function success(route: Route, data: unknown, status = 200) {
  return route.fulfill({ status, json: { success: true, status: 'SUCCESS', data } });
}
