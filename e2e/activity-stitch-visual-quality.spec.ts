import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { mockShellSession } from './support/shell-session';

const FIXED_NOW = new Date('2026-09-04T09:00:00.000Z');
const WORK_EVENT_ID = '21000000-0000-4000-8000-000000000001';
const INPUT_EVENT_ID = '21000000-0000-4000-8000-000000000002';
const BLOCKED_EVENT_ID = '21000000-0000-4000-8000-000000000003';
const RUNNING_RUN_ID = '41000000-0000-4000-8000-000000000001';
const COMPLETED_RUN_ID = '41000000-0000-4000-8000-000000000002';
const FAILED_RUN_ID = '41000000-0000-4000-8000-000000000003';
const SECOND_COMPLETED_RUN_ID = '41000000-0000-4000-8000-000000000004';
const SECOND_FAILED_RUN_ID = '41000000-0000-4000-8000-000000000005';
const CONVERSATION_ID = '51000000-0000-4000-8000-000000000001';

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
  agentRun(
    SECOND_COMPLETED_RUN_ID,
    'COMPLETED',
    'ALLOW',
    'COMPLETED',
    null,
    '2026-09-04T08:31:00.000Z',
    'DWP_APPROVAL_EXPERT'
  ),
  agentRun(
    SECOND_FAILED_RUN_ID,
    'FAILED',
    'HANDOFF',
    'ABSTAINED',
    null,
    '2026-09-04T08:17:00.000Z'
  ),
];

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', '해상도를 명시한 단일 Chromium 기준선입니다.');
  await page.setViewportSize({ width: 1280, height: 1024 });
  await page.clock.setFixedTime(FIXED_NOW);
  await page.emulateMedia({ colorScheme: 'light', forcedColors: 'none', reducedMotion: 'reduce' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    displayName: '김민아',
    appearance: {
      mode: 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
  await mockActivityContracts(page);
});

test('활동 홈은 현재 실행 합계·주의 신호·근거 있는 최근 활동을 구분한다', async ({ page }) => {
  await page.goto('/activity/home');
  await expectReady(page, '활동 홈');

  const summary = page.getByRole('region', { name: '활동 상태 요약' });
  await expect(summary).toContainText('연결된 실행');
  await expect(summary).toContainText('12');
  await expect(summary).toContainText('실행 중');
  await expect(summary).toContainText('확인 필요');
  await expect(summary).toContainText('정책 차단');
  await expect(page.getByRole('heading', { name: '최근 활동' })).toBeVisible();
  await expect(page.getByText('월간 운영 리스크를 분석하고 있습니다')).toBeVisible();
  await expect(page.getByRole('link', { name: '입력 필요 2건 보기' })).toBeVisible();
  await expect(page.getByRole('link', { name: '정책 차단 1건 보기' })).toBeVisible();
  await expectNoInventedCommands(page);
  await expectVisualQuality(page, '#dwp-main-content');
  await expect(page).toHaveScreenshot('activity-stitch-home-1280.png', screenshotOptions());

  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoHorizontalOverflow(page, '/activity/home @ 390');
  await expect(page).toHaveScreenshot('activity-stitch-home-390.png', screenshotOptions());
});

test('활동 타임라인은 현재 합계와 필터된 과거 사건을 섞지 않는다', async ({ page }) => {
  const requests: URL[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith('/workspace/activity') || url.pathname.endsWith('/activity/events')) {
      requests.push(url);
    }
  });
  await page.goto('/activity/timeline');
  await expectReady(page, '활동');

  await expect(page.getByRole('region', { name: '활동 요약' })).toContainText('12');
  const timeline = page.getByRole('list', { name: '워크스페이스 활동' });
  await expect(timeline).toContainText('월간 운영 리스크를 분석하고 있습니다');
  await expect(timeline).toContainText('접근 권한 검토 기록이 저장됐습니다');
  await expect(page.getByText('표시 중인 이벤트 6개')).toBeVisible();
  await expectVisualQuality(page, '#dwp-main-content');
  await expect(page).toHaveScreenshot('activity-stitch-timeline-1280.png', screenshotOptions());

  await page.getByRole('button', { name: '에이전트', exact: true }).click();
  await expect(page).toHaveURL((url) => url.searchParams.get('actor') === 'agent');
  await expect(page.getByText('표시 중인 이벤트 3개')).toBeVisible();
  await expect(timeline).not.toContainText('고객 제안서 최종 검토가 필요합니다');
  expect(requests.some((url) => url.searchParams.get('actor') === 'AGENT')).toBe(true);

  await page.setViewportSize({ width: 320, height: 844 });
  await expectNoHorizontalOverflow(page, '/activity/timeline?actor=agent @ 320');
  await expect(timeline.getByText('월간 운영 리스크를 분석하고 있습니다')).toBeInViewport();
  await expectNoSeriousAxeViolations(page, '#dwp-main-content');
  await expect(page).toHaveScreenshot(
    'activity-stitch-timeline-filtered-320.png',
    screenshotOptions()
  );
});

test('공통 상세는 데스크톱 인라인과 모바일 드로어에서 사건·업무 상태를 정확히 설명한다', async ({
  page,
}) => {
  await page.goto(`/activity/timeline?event=${WORK_EVENT_ID}`);
  await expectReady(page, '활동');

  const inspector = page.getByRole('complementary', { name: '신호 상세' });
  await expect(inspector).toContainText('변경 기록');
  await expect(inspector).toContainText('접근 권한 검토 기록이 저장됐습니다');
  await expect(inspector).toContainText('변경 기록 상태');
  await expect(inspector).toContainText('변경 당시 업무 상태');
  await expect(inspector).toContainText('감사 참조 연결됨');
  await expectNoInventedCommands(inspector);
  await expectVisualQuality(page, '#dwp-main-content');
  await expect(page).toHaveScreenshot(
    'activity-stitch-detail-inline-1280.png',
    screenshotOptions()
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(inspector).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: '신호 상세' })).toBeInViewport();
  await expect(page.getByRole('button', { name: '신호 상세 닫기' })).toBeInViewport();
  await expectNoHorizontalOverflow(page, `/activity/timeline?event=${WORK_EVENT_ID} @ 390`);
  await expectNoSeriousAxeViolations(page, '.MuiDrawer-paper');
  await expect(page).toHaveScreenshot('activity-stitch-detail-drawer-390.png', screenshotOptions());

  await page.setViewportSize({ width: 320, height: 844 });
  await expect(page.getByRole('heading', { level: 2, name: '신호 상세' })).toBeInViewport();
  await expect(page.getByRole('button', { name: '신호 상세 닫기' })).toBeInViewport();
  await expectNoHorizontalOverflow(page, `/activity/timeline?event=${WORK_EVENT_ID} @ 320`);
  await expect(page).toHaveScreenshot('activity-stitch-detail-drawer-320.png', screenshotOptions());

  await page.keyboard.press('Escape');
  await expect(inspector).toHaveCount(0);
  await expect(page).toHaveURL((url) => !url.searchParams.has('event'));
});

test('DWAI·ON 실행 이력은 최근 응답 범위와 정확한 실행 상세만 표시한다', async ({ page }) => {
  await page.goto(`/dwaion/activity?run=${COMPLETED_RUN_ID}`);
  await expectReady(page, 'AI 실행 이력');

  const summary = page.getByRole('region', { name: 'AI 실행 상태 요약' });
  await expect(summary).toContainText('조회된 실행');
  await expect(summary).toContainText('5');
  await expect(page.getByText(/\ucd5c근 실행을 최대 100건까지 조회합니다/)).toBeVisible();
  await expect(page.getByRole('list', { name: '최근 조회된 AI 실행' })).toBeVisible();

  const inspector = page.getByRole('complementary', { name: '선택 실행 상세' });
  await expect(inspector).toContainText(COMPLETED_RUN_ID);
  await expect(inspector).toContainText('최근 실행 응답');
  await expect(inspector.getByRole('button', { name: '대화 열기' })).toBeVisible();
  await expect(inspector.getByRole('complementary', { name: '신호 상세' })).toContainText(
    '결재 요청 요약을 완료했습니다'
  );
  await expectNoInventedCommands(inspector);
  await expectVisualQuality(page, '#dwp-main-content');
  await expect(page).toHaveScreenshot(
    'activity-stitch-dwaion-detail-1280.png',
    screenshotOptions()
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(inspector).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: '선택 실행 상세' })).toBeInViewport();
  await expect(page.getByRole('button', { name: '선택 실행 닫기' })).toBeInViewport();
  await expectNoHorizontalOverflow(page, `/dwaion/activity?run=${COMPLETED_RUN_ID} @ 390`);
  await expectNoSeriousAxeViolations(page, '.MuiDrawer-paper');
  await expect(page).toHaveScreenshot('activity-stitch-dwaion-detail-390.png', screenshotOptions());

  await page.setViewportSize({ width: 320, height: 844 });
  await expect(page.getByRole('heading', { level: 2, name: '선택 실행 상세' })).toBeInViewport();
  await expect(page.getByRole('button', { name: '선택 실행 닫기' })).toBeInViewport();
  await expectNoHorizontalOverflow(page, `/dwaion/activity?run=${COMPLETED_RUN_ID} @ 320`);
  await expect(page).toHaveScreenshot('activity-stitch-dwaion-detail-320.png', screenshotOptions());
});

async function mockActivityContracts(page: Page) {
  await page.route('**/api/platform/v1/workspace/activity**', async (route) => {
    const url = new URL(route.request().url());
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
    auditRecordId: '61000000-0000-4000-8000-000000000001',
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
    auditRecordId: null,
    auditStatus: 'NOT_LINKED',
    eventKind: 'EXECUTION_SNAPSHOT',
    executionId: input.id,
    executionVersion: 4,
    attempt: 1,
    workStatus: null,
    sourceAccess: 'AVAILABLE',
    sourceRoute: `/dwaion/activity?run=${input.id}`,
    sourceEventId: `agent-${input.id}`,
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
  };
}

async function expectReady(page: Page, heading: string) {
  await expect(page.locator('#dwp-main-content')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator('.MuiSkeleton-root')).toHaveCount(0, { timeout: 15_000 });
  await page.evaluate(() => document.fonts.ready.then(() => true));
}

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow, `${label}에 수평 오버플로가 있습니다.`).toBeLessThanOrEqual(1);
}

async function expectNoSeriousAxeViolations(page: Page, selector: string) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await new AxeBuilder({ page }).include(selector).analyze();
      expect(
        result.violations.filter(
          (violation) => violation.impact === 'critical' || violation.impact === 'serious'
        )
      ).toEqual([]);
      return;
    } catch (error) {
      if (attempt > 0 || !String(error).includes('Execution context was destroyed')) throw error;
      // A concurrently rebuilt Vite test server can reload between axe injection and analysis.
      // The route mocks survive the reload, so wait for the same governed surface and retry once.
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator(selector)).toBeVisible({ timeout: 15_000 });
    }
  }
}

async function expectVisualQuality(page: Page, selector: string) {
  await expectNoHorizontalOverflow(page, page.url());
  await expectNoSeriousAxeViolations(page, selector);
}

async function expectNoInventedCommands(scope: Page | ReturnType<Page['getByRole']>) {
  for (const text of [
    '의견 제출',
    '서명 확인',
    '예외 승인 신청',
    '수동 동기화',
    'SHA-256',
    'BLAKE3',
  ]) {
    await expect(scope.getByText(text, { exact: false })).toHaveCount(0);
  }
}

function screenshotOptions() {
  return {
    animations: 'disabled' as const,
    caret: 'hide' as const,
    maxDiffPixelRatio: 0.002,
    timeout: 15_000,
  };
}
