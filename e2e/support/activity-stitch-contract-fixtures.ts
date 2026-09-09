import type { Page } from '@playwright/test';

export const FIXED_NOW = new Date('2026-09-04T09:00:00.000Z');
export const WORK_EVENT_ID = '21000000-0000-4000-8000-000000000001';
export const INPUT_EVENT_ID = '21000000-0000-4000-8000-000000000002';
export const RUNNING_RUN_ID = '41000000-0000-4000-8000-000000000001';
export const COMPLETED_RUN_ID = '41000000-0000-4000-8000-000000000002';
export const SAMPLE_RUN_ID = '41000000-0000-4000-8000-000000000004';

const BLOCKED_EVENT_ID = '21000000-0000-4000-8000-000000000003';
const FAILED_RUN_ID = '41000000-0000-4000-8000-000000000003';
const SECOND_FAILED_RUN_ID = '41000000-0000-4000-8000-000000000005';
const CONVERSATION_ID = '51000000-0000-4000-8000-000000000001';
const WORK_AUDIT_RECORD_ID = '61000000-0000-4000-8000-000000000001';
const AGENT_AUDIT_RECORD_ID = '61000000-0000-5000-8000-000000000002';

const coverage = {
  supportedObjectTypes: ['WORK_ITEM', 'AGENT_RUN'],
  excludedProvenance: ['SAMPLE', 'QUARANTINED'],
  includesLegacy: true,
  includesUsage: false,
  sourceScope: 'WORKSPACE',
};

const workspaceEvents = [
  workspaceEvent({
    id: INPUT_EVENT_ID,
    occurredAt: '2026-09-04T08:58:00.000Z',
    actor: 'PERSON',
    actorName: '김민아',
    state: 'NEEDS_INPUT',
    title: '고객 제안서 최종 검토가 필요합니다',
    summary: '외부 공유 범위와 담당자 확인을 기다리고 있습니다.',
    objectLabel: '고객 제안서 검토',
    workStatus: 'WAITING',
  }),
  workspaceEvent({
    id: BLOCKED_EVENT_ID,
    occurredAt: '2026-09-04T08:54:00.000Z',
    actor: 'SYSTEM',
    actorName: '정책 집행 서비스',
    state: 'POLICY_BLOCKED',
    title: '외부 공유가 정책으로 차단됐습니다',
    summary: '민감 정보 보호 정책이 공유 요청을 중단했습니다.',
    objectLabel: '외부 공유 정책',
    objectType: 'POLICY_DECISION',
    workStatus: null,
    source: 'DWP_POLICY',
    sourceRoute: '/admin/policies',
  }),
  workspaceEvent({
    id: WORK_EVENT_ID,
    occurredAt: '2026-09-04T08:49:00.000Z',
    actor: 'PERSON',
    actorName: '김민아',
    state: 'COMPLETED',
    title: '접근 권한 검토 기록이 저장됐습니다',
    summary: '변경 기록은 완료됐지만 업무는 담당자 응답을 기다리고 있습니다.',
    objectLabel: '프로젝트 접근 권한 검토',
    workStatus: 'WAITING',
  }),
];

const agentActivityEvents = [
  agentActivityEvent({
    id: RUNNING_RUN_ID,
    occurredAt: '2026-09-04T08:59:00.000Z',
    state: 'RUNNING',
    title: '월간 운영 리스크를 분석하고 있습니다',
    summary: '허용된 근거 소스에서 현재 상태를 확인 중입니다.',
  }),
  agentActivityEvent({
    id: COMPLETED_RUN_ID,
    occurredAt: '2026-09-04T08:56:00.000Z',
    state: 'COMPLETED',
    title: '결재 요청 요약을 완료했습니다',
    summary: '실행 원장이 완료 상태와 사용한 근거 수를 보고했습니다.',
  }),
  agentActivityEvent({
    id: FAILED_RUN_ID,
    occurredAt: '2026-09-04T08:45:00.000Z',
    state: 'FAILED',
    title: '실행 설정을 확인해야 합니다',
    summary: '원본 실행 원장이 설정 필요 상태를 보고했습니다.',
  }),
];

const runs = [
  agentRun(RUNNING_RUN_ID, 'RUNNING', 'HANDOFF', null, null, '2026-09-04T08:59:00.000Z'),
  agentRun(
    COMPLETED_RUN_ID,
    'COMPLETED',
    'ALLOW',
    'COMPLETED',
    CONVERSATION_ID,
    '2026-09-04T08:56:00.000Z'
  ),
  agentRun(
    FAILED_RUN_ID,
    'FAILED',
    'DENY',
    'CONFIGURATION_REQUIRED',
    null,
    '2026-09-04T08:45:00.000Z'
  ),
  {
    ...agentRun(
      SAMPLE_RUN_ID,
      'COMPLETED',
      'ALLOW',
      'COMPLETED',
      null,
      '2026-09-04T08:31:00.000Z',
      'DWP_APPROVAL_EXPERT'
    ),
    dataProvenance: 'SAMPLE' as const,
    auditEvidence: {
      auditId: '61000000-0000-4000-8000-000000000004',
      auditRecordId: '61000000-0000-0000-0000-000000000004',
      status: 'PENDING' as const,
    },
  },
  agentRun(
    SECOND_FAILED_RUN_ID,
    'FAILED',
    'HANDOFF',
    'ABSTAINED',
    null,
    '2026-09-04T08:17:00.000Z'
  ),
];

export async function mockFlowExperience(page: Page) {
  await page.route('**/api/platform/v1/home-experience', (route) =>
    route.fulfill({
      json: {
        data: {
          headline: null,
          subheadline: null,
          localizedContent: {},
          defaultLocale: 'ko',
          backgroundPosition: 'RIGHT',
          overlayOpacity: 18,
          backgroundUrl: null,
          launchpadConfiguration: { schemaVersion: 1, groups: [], placements: [] },
          compositionPolicy: {
            schemaVersion: 3,
            experienceVariant: 'FLOW_V1',
            personalCustomizationEnabled: true,
            governedZones: [],
          },
          effectiveExperienceVariant: 'FLOW_V1',
          advancedPersonalizationEnabled: false,
          composerEnabled: false,
          homePreferenceStore: 'LEGACY',
          version: 7,
        },
      },
    })
  );
  await page.route('**/api/platform/v1/home-preferences', (route) =>
    route.fulfill({
      json: {
        data: {
          schemaVersion: 5,
          surfaceKey: 'workspace-home',
          customized: false,
          layout: {
            appLayout: null,
            presentation: 'balanced',
            widgets: [
              { widgetKey: 'command-rail', visible: true, size: 'large', height: 'standard' },
              { widgetKey: 'activity', visible: true, size: 'compact', height: 'standard' },
            ],
          },
          version: 3,
        },
      },
    })
  );
}

export async function mockActivityContracts(page: Page) {
  await page.route('**/api/platform/v1/workspace/activity**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/sources/status')) {
      return route.fulfill({
        json: {
          data: {
            observedAt: '2026-09-04T09:00:00.000Z',
            sources: [
              {
                sourceId: 'mail-personal-ledger',
                label: '개인 메일 연동',
                resourceKind: 'MAIL',
                status: 'READY',
                lastAttemptAt: '2026-09-04T08:59:20.000Z',
                lastSuccessAt: '2026-09-04T08:59:21.000Z',
                observedAt: '2026-09-04T09:00:00.000Z',
                semantics: 'PERSONAL_SYNC_LEDGER',
              },
              {
                sourceId: 'calendar-personal-ledger',
                label: '개인 캘린더 연동',
                resourceKind: 'CALENDAR',
                status: 'STALE',
                lastAttemptAt: '2026-09-04T08:55:00.000Z',
                lastSuccessAt: '2026-09-04T08:20:00.000Z',
                observedAt: '2026-09-04T09:00:00.000Z',
                semantics: 'PERSONAL_SYNC_LEDGER',
              },
              {
                sourceId: 'calendar-policy-ledger',
                label: '정책 제한 캘린더 연동',
                resourceKind: 'CALENDAR',
                status: 'BLOCKED',
                lastAttemptAt: '2026-09-04T08:57:00.000Z',
                lastSuccessAt: null,
                observedAt: '2026-09-04T09:00:00.000Z',
                semantics: 'LOCAL_FIXTURE',
              },
            ],
          },
        },
      });
    }
    const eventEvidenceId =
      /^\/api\/platform\/v1\/workspace\/activity\/events\/([^/]+)\/evidence$/u.exec(
        url.pathname
      )?.[1];
    const auditEvidenceId =
      /^\/api\/platform\/v1\/workspace\/activity\/audit\/evidence\/([^/]+)$/u.exec(
        url.pathname
      )?.[1];
    if (eventEvidenceId || auditEvidenceId) {
      const eventId = eventEvidenceId ? decodeURIComponent(eventEvidenceId) : COMPLETED_RUN_ID;
      const auditRecordId = eventEvidenceId
        ? WORK_AUDIT_RECORD_ID
        : decodeURIComponent(auditEvidenceId!);
      return route.fulfill({
        json: {
          data: {
            eventId,
            auditRecordId,
            linkStatus: 'LINKED',
            auditAccess: 'AVAILABLE',
            recordHash: 'a'.repeat(64),
            hashAlgorithm: 'SHA-256',
            integrityStatus: 'VERIFIED',
            integrityScope: 'DAILY_CHECKPOINT_REPORTED',
            verifiedAt: '2026-09-04T08:59:50.000Z',
            observedAt: '2026-09-04T09:00:00.000Z',
          },
        },
      });
    }
    if (url.pathname.endsWith('/executions/summary')) {
      return route.fulfill({
        json: {
          data: executionSummary({
            total: 7,
            running: 0,
            needsInput: 2,
            policyBlocked: 1,
            completed: 4,
          }),
        },
      });
    }
    if (url.pathname.includes('/activity/events/')) {
      const eventId = decodeURIComponent(url.pathname.split('/').at(-1) ?? '');
      const event = workspaceEvents.find((candidate) => candidate.id === eventId);
      return event
        ? route.fulfill({ json: { data: event } })
        : route.fulfill({ status: 404, json: { errorCode: 'RESOURCE_NOT_FOUND' } });
    }
    return route.fulfill({ json: { data: activityPage(filterEvents(workspaceEvents, url)) } });
  });

  await page.route('**/api/agent/v1/activity/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/executions/summary')) {
      return route.fulfill({
        json: {
          data: executionSummary({
            total: 5,
            running: 1,
            needsInput: 0,
            policyBlocked: 0,
            completed: 4,
          }),
        },
      });
    }
    const detailId = /^\/api\/agent\/v1\/activity\/events\/([^/]+)$/u.exec(url.pathname)?.[1];
    if (detailId) {
      const event = agentActivityEvents.find(
        (candidate) => candidate.id === decodeURIComponent(detailId)
      );
      return event
        ? route.fulfill({ json: { data: event } })
        : route.fulfill({ status: 404, json: { errorCode: 'RESOURCE_NOT_FOUND' } });
    }
    return route.fulfill({ json: { data: activityPage(filterEvents(agentActivityEvents, url)) } });
  });

  await page.route('**/api/agent/v1/runs?**', (route) => route.fulfill({ json: { data: runs } }));
  await page.route('**/api/agent/v1/runs/*', (route) => {
    const runId = new URL(route.request().url()).pathname.split('/').at(-1) ?? '';
    const selected = runs.find((run) => run.runId === runId);
    return selected
      ? route.fulfill({ json: { data: selected } })
      : route.fulfill({ status: 404, json: { errorCode: 'RESOURCE_NOT_FOUND' } });
  });
}

function executionSummary(input: {
  total: number;
  running: number;
  needsInput: number;
  policyBlocked: number;
  completed: number;
}) {
  return {
    ...input,
    failed: 0,
    cancelled: 0,
    unknown: 0,
    generatedAt: '2026-09-04T09:00:00.000Z',
    coverage,
  };
}

function activityPage(events: typeof workspaceEvents | typeof agentActivityEvents) {
  return {
    events,
    generatedAt: '2026-09-04T09:00:00.000Z',
    snapshotAt: '2026-09-04T09:00:00.000Z',
    coverage,
    hasMore: false,
    nextCursor: null,
    startCursor: null,
  };
}

function filterEvents<
  T extends (typeof workspaceEvents)[number] | (typeof agentActivityEvents)[number],
>(events: T[], url: URL): T[] {
  const actor = url.searchParams.get('actor');
  const state = url.searchParams.get('state');
  const query = url.searchParams.get('query')?.toLocaleLowerCase('ko');
  return events.filter(
    (event) =>
      (!actor || event.actor === actor) &&
      (!state || event.state === state) &&
      (!query ||
        [event.title, event.summary, event.actorName, event.source, event.objectLabel].some(
          (value) => value.toLocaleLowerCase('ko').includes(query)
        ))
  );
}

function workspaceEvent(input: {
  id: string;
  occurredAt: string;
  actor: 'PERSON' | 'SYSTEM';
  actorName: string;
  state: 'NEEDS_INPUT' | 'POLICY_BLOCKED' | 'COMPLETED';
  title: string;
  summary: string;
  objectLabel: string;
  workStatus: 'WAITING' | null;
  objectType?: string;
  source?: string;
  sourceRoute?: string;
}) {
  return {
    id: input.id,
    occurredAt: input.occurredAt,
    sourceObservedAt: '2026-09-04T08:59:30.000Z',
    updatedAt: input.occurredAt,
    actor: input.actor,
    actorName: input.actorName,
    state: input.state,
    title: input.title,
    summary: input.summary,
    objectType: input.objectType ?? 'WORK_ITEM',
    objectId: '10420000-0000-4000-8000-000000000001',
    objectLabel: input.objectLabel,
    source: input.source ?? 'DWP_WORKSPACE',
    tool: null,
    auditId: null,
    auditRecordId: WORK_AUDIT_RECORD_ID,
    auditStatus: 'VERIFIED',
    auditAccess: 'RESTRICTED',
    eventKind: 'CHANGE',
    workStatus: input.workStatus,
    sourceAccess: 'AVAILABLE',
    sourceRoute: input.sourceRoute ?? '/work/queue?item=10420000-0000-4000-8000-000000000001',
    sourceEventId: `workspace-${input.id}`,
    correlationId: '71000000-0000-4000-8000-000000000001',
    dataProvenance: 'LIVE',
    resumeCursor: `workspace-cursor-${input.id}`,
  };
}

function agentActivityEvent(input: {
  id: string;
  occurredAt: string;
  state: 'RUNNING' | 'COMPLETED' | 'FAILED';
  title: string;
  summary: string;
}) {
  return {
    id: input.id,
    occurredAt: input.occurredAt,
    sourceObservedAt: '2026-09-04T08:59:40.000Z',
    updatedAt: input.occurredAt,
    actor: 'AGENT' as const,
    actorName: 'DWAI·ON',
    state: input.state,
    title: input.title,
    summary: input.summary,
    objectType: 'AGENT_RUN',
    objectId: input.id,
    objectLabel: 'DWAI·ON 실행',
    source: 'DWAI_ON',
    tool: null,
    auditId: null,
    auditRecordId: AGENT_AUDIT_RECORD_ID,
    auditStatus: 'VERIFIED',
    auditAccess: 'RESTRICTED',
    eventKind: 'EXECUTION_SNAPSHOT',
    executionId: input.id,
    executionVersion: 4,
    attempt: 1,
    workStatus: null,
    sourceAccess: 'AVAILABLE',
    sourceRoute: `/dwaion/activity?run=${input.id}`,
    sourceEventId: input.id,
    correlationId: '71000000-0000-4000-8000-000000000002',
    dataProvenance: 'LIVE',
    resumeCursor: `agent-cursor-${input.id}`,
  };
}

function agentRun(
  runId: string,
  runState: 'RUNNING' | 'COMPLETED' | 'FAILED',
  policyOutcome: 'ALLOW' | 'HANDOFF' | 'DENY',
  answerState: 'COMPLETED' | 'ABSTAINED' | 'CONFIGURATION_REQUIRED' | null,
  conversationId: string | null,
  createdAt: string,
  agentKey = 'DWP_ASSISTANT'
) {
  return {
    runId,
    agentKey,
    agentRevision: 4,
    runState,
    answerState,
    riskTier: runState === 'FAILED' ? 'L2' : 'L1',
    policyOutcome,
    statusCode: runState === 'FAILED' ? 'POLICY_OR_CONFIGURATION_REVIEW' : null,
    sourceCount: runState === 'RUNNING' ? 1 : 3,
    latencyMs: runState === 'RUNNING' ? 180 : 420,
    conversationId,
    createdAt,
    completedAt:
      runState === 'RUNNING' ? null : new Date(Date.parse(createdAt) + 1_000).toISOString(),
    dataProvenance: 'LIVE',
    activityTitle:
      runState === 'RUNNING'
        ? '운영 리스크 근거 수집'
        : runState === 'FAILED'
          ? '정책 범위 내 실행 검토'
          : '근거 기반 업무 응답 생성',
    attempt: 1,
    lease: {
      status: runState === 'RUNNING' ? 'ACTIVE' : 'RELEASED',
      expiresAt:
        runState === 'RUNNING' ? new Date(Date.parse(createdAt) + 120_000).toISOString() : null,
    },
    currentStage:
      runState === 'RUNNING' ? 'RETRIEVING' : runState === 'FAILED' ? 'FAILED' : 'COMPLETED',
    progressPercent: runState === 'COMPLETED' ? 100 : 20,
    measurementStatus: runState === 'COMPLETED' ? 'MEASURED' : 'PARTIAL',
    stages:
      runState === 'COMPLETED'
        ? [
            runStage('AUTHORIZING', 'COMPLETED', 10, createdAt, 40),
            runStage('RETRIEVING', 'COMPLETED', 20, createdAt, 110),
            runStage('REASONING', 'COMPLETED', 30, createdAt, 190),
            runStage('VERIFYING', 'COMPLETED', 40, createdAt, 60),
            runStage('PERSISTING', 'COMPLETED', 50, createdAt, 20),
            runStage('COMPLETED', 'COMPLETED', 60, createdAt, 0),
          ]
        : runState === 'RUNNING'
          ? [
              runStage('AUTHORIZING', 'COMPLETED', 10, createdAt, 40),
              runStage('RETRIEVING', 'ACTIVE', 20, createdAt, 140),
            ]
          : [
              runStage('AUTHORIZING', 'COMPLETED', 10, createdAt, 40),
              runStage('FAILED', 'FAILED', 60, createdAt, 380),
            ],
    auditEvidence: {
      auditId: '61000000-0000-4000-8000-000000000002',
      auditRecordId: AGENT_AUDIT_RECORD_ID,
      status: 'LINKED',
    },
    sourceHealth: [
      {
        sourceType: 'WORK_ITEM',
        status: runState === 'FAILED' ? 'UNAVAILABLE' : 'SUCCESS',
        latencyMs: runState === 'FAILED' ? null : runState === 'RUNNING' ? 140 : 110,
        lastAttemptAt: createdAt,
        lastSuccessAt: runState === 'FAILED' ? null : createdAt,
      },
    ],
  };
}

function runStage(
  key: string,
  state: string,
  sequence: number,
  startedAt: string,
  durationMs: number
) {
  return {
    key,
    state,
    sequence,
    startedAt,
    completedAt: state === 'ACTIVE' ? null : new Date(Date.parse(startedAt) + 1_000).toISOString(),
    durationMs,
  };
}
