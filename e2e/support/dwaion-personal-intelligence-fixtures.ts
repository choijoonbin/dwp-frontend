import type { Page, Route } from '@playwright/test';

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
    cadence: 'WEEKDAYS',
    localTime: '09:00:00',
    timeZone: 'Asia/Seoul',
    locale: 'en',
    activeFrom: '2026-09-01',
    activeUntil: null,
    quietHoursStart: '20:00:00',
    quietHoursEnd: '08:00:00',
    weekDays: [],
    sources: ['WORK_ITEM', 'MAIL'],
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
    notificationDeliveryAvailable: false,
    pauseResumeAvailable: true,
    lifecycleMode: 'DRAFT_PREVIEW_ONLY',
  },
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-04T00:00:00Z',
};

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
    if (route.request().method() === 'GET' && path === '/api/agent/v1/routines') {
      return success(route, routinePayloads);
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
      return success(route, [
        {
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
          createdAt: '2026-09-01T00:00:00Z',
          updatedAt: '2026-09-04T00:00:00Z',
        },
      ]);
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
      });
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

  return probe;
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

function success(route: Route, data: unknown) {
  return route.fulfill({ json: { success: true, status: 'SUCCESS', data } });
}
