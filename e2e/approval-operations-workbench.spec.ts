import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

import { mockShellSession } from './support/shell-session';
import { mockApprovalProductSurfaceAuthority } from './support/product-surface-authority';
import { mockApprovalHighRiskNetwork } from './support/approval-high-risk';
import { APPROVAL_TASK_FIXTURE } from './support/product-area-approval-fixtures';
import { PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS } from '../apps/dwp/src/routes/product-surface-authorization.generated';
import type {
  ApprovalIntegrationDelivery,
  ApprovalOperations,
} from '../libs/shared-utils/src/api/approval-management-contract';
import type { ApprovalRetentionPolicy } from '../libs/shared-utils/src/api/approval-retention-contract';

const operationsPath = '/api/approvals/v1/admin/operations';
const retryPath = `${operationsPath}/events/00000000-0000-4000-8000-000000000001/retry`;
const failureText = '결재 운영 정보를 불러오지 못했습니다.';
const policyId = '22222222-2222-4222-8222-222222222222';
type Appearance = 'light' | 'dark' | 'forced' | 'large-text';

function retentionPolicy(): ApprovalRetentionPolicy {
  return {
    policyId,
    resourceSetKey: 'RS_APPROVALS',
    version: 0,
    publishedRevision: 0,
    pendingRevision: null,
    pendingMakerUserId: null,
    publishedRulesSha256: 'a'.repeat(64),
    pendingRulesSha256: null,
    published: {
      allowPurge: false,
      allowedClassifications: ['INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'],
      recordRetentionDays: 365,
      deletedDraftRecoveryDays: 30,
      receiptRetentionDays: 365,
      holdEvidenceRetentionDays: 365,
      auditEvidenceRetentionDays: 365,
      maxInventoryRows: 50000,
      maxObjectsPerRecord: 1000,
    },
    pending: null,
    publishEligible: false,
    publishReason: 'NO_PENDING_REVISION',
    runtimeReadiness: 'RUNTIME_DISABLED_UNTIL_OWNER_FENCES_AND_PROVIDERS',
  };
}

function operationsFixture(): ApprovalOperations {
  const now = Date.now();
  const instant = (minutes: number) => new Date(now + minutes * 60000).toISOString();
  // Different wire offsets represent exactly the same instant, not lexical order.
  const offsetTwin = new Date(now - 10 * 60000 + 9 * 3600000).toISOString().replace('Z', '+09:00');
  const delivery = (
    id: number,
    status: string,
    createdAt: string,
    availableMinutes: number
  ): ApprovalIntegrationDelivery => ({
    outboxId: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
    eventId: `event-${id}-${status.toLowerCase()}`,
    requestId: APPROVAL_TASK_FIXTURE.requestId,
    eventType: 'approval.request.approved',
    status,
    attemptCount: status === 'FAILED' || status === 'DEAD' ? 3 : 0,
    manualRetryCount: 0,
    version: 7,
    availableAt: instant(availableMinutes),
    publishedAt: status === 'PUBLISHED' ? instant(-1) : null,
    lastError: status === 'FAILED' ? 'Downstream endpoint returned 503' : null,
    createdAt,
    lastRetriedAt: null,
    retryEligibility: {
      eligible: status === 'FAILED' || status === 'DEAD',
      reason: status === 'FAILED' || status === 'DEAD' ? 'ELIGIBLE' : 'STATUS_NOT_RETRYABLE',
      expectedVersion: 7,
      evaluatedAt: instant(0),
    },
  });
  return {
    generatedAt: instant(0),
    signals: [
      {
        key: 'failed',
        state: 'ATTENTION',
        titleKo: '실패 전달',
        titleEn: 'Failed deliveries',
        detailKo: '현재 조회된 실패 항목',
        detailEn: 'Loaded failed items',
        count: 1,
      },
      {
        key: 'dead',
        state: 'ATTENTION',
        titleKo: '격리 전달',
        titleEn: 'Dead deliveries',
        detailKo: '현재 조회된 격리 항목',
        detailEn: 'Loaded dead items',
        count: 1,
      },
      {
        key: 'sla',
        state: 'ATTENTION',
        titleKo: 'SLA 위험',
        titleEn: 'SLA risk',
        detailKo: '현재 조회된 기한 초과 업무',
        detailEn: 'Loaded overdue tasks',
        count: 1,
      },
      {
        key: 'published',
        state: 'HEALTHY',
        titleKo: '전달 완료',
        titleEn: 'Published deliveries',
        detailKo: '현재 조회된 완료 항목',
        detailEn: 'Loaded published items',
        count: 2,
      },
    ],
    breachedTasks: [{ ...APPROVAL_TASK_FIXTURE, dueAt: instant(-30) }],
    integrationDeliveries: [
      delivery(4, 'SENDING', instant(-3), 3),
      delivery(2, 'DEAD', offsetTwin, -4),
      delivery(5, 'PUBLISHED', instant(-20), -2),
      delivery(1, 'FAILED', instant(-10), -3),
      delivery(6, 'PUBLISHED', instant(-2), -1),
      delivery(3, 'PENDING', instant(-5), -5),
    ],
  };
}

function success(route: Route, data: unknown) {
  return route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', data }),
  });
}

// Release-10 canonical browser UI fixtures only. No locally installed route,
// native Auth, signed identity evidence or native recovery execution is claimed.
async function setup(page: Page, appearance: Appearance = 'light') {
  const projection = PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS.filter(
    (route) => route.routeContractKey === 'route.approvals.admin.operations.retry.action'
  );
  expect(projection).toHaveLength(1);
  expect(projection[0]!.gatewayBindings).toEqual([
    { method: 'POST', path: '/api/approvals/v1/admin/operations/events/{outboxId}/retry' },
  ]);
  await page.emulateMedia({
    colorScheme: appearance === 'dark' ? 'dark' : 'light',
    forcedColors: appearance === 'forced' ? 'active' : 'none',
    reducedMotion: 'reduce',
  });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: [],
    appearance: {
      mode: appearance === 'dark' ? 'dark' : 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
  const authority = await mockApprovalProductSurfaceAuthority(page, {
    decisionRevisionFormat: 'sha256',
    rolloutState: '111',
    generatedAt: new Date().toISOString(),
    revalidateAt: new Date(Date.now() + 600000).toISOString(),
  });
  const state = {
    operations: operationsFixture(),
    failure: 0,
    pause: false,
    release: undefined as (() => void) | undefined,
    reads: [] as Array<{ headers: Record<string, string>; scope: string | null }>,
    policy: retentionPolicy(),
    unknownDraft: false,
    policyCommands: [] as Array<{ body: string; headers: Record<string, string> }>,
  };
  await page.route(
    (url) => url.pathname === operationsPath,
    async (route) => {
      state.reads.push({
        headers: route.request().headers(),
        scope: new URL(route.request().url()).searchParams.get('contextScopeKey'),
      });
      if (state.pause)
        await new Promise<void>((resolve) => {
          state.release = resolve;
        });
      if (state.failure)
        return route.fulfill({
          status: state.failure,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ERROR', errorCode: 'OPERATIONS_SOURCE_UNAVAILABLE' }),
        });
      // Refresh freshness evidence without changing the immutable delivery fields.
      const now = new Date().toISOString();
      state.operations.generatedAt = now;
      for (const item of state.operations.integrationDeliveries)
        if (item.retryEligibility) item.retryEligibility.evaluatedAt = now;
      return success(route, state.operations);
    }
  );
  await page.route(
    (url) => url.pathname.startsWith('/api/approvals/v1/admin/retention/'),
    async (route) => {
      if (route.request().method() === 'GET') {
        if (new URL(route.request().url()).pathname.endsWith('/policy'))
          return success(route, state.policy);
        return route.fulfill({ status: 404 });
      }
      state.policyCommands.push({
        body: route.request().postData() ?? '',
        headers: route.request().headers(),
      });
      if (state.unknownDraft) return route.abort('failed');
      return route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: '{"errorCode":"RESOURCE_CONFLICT"}',
      });
    }
  );
  return { state, authority };
}

async function open(page: Page) {
  await page.goto('/approvals/admin/operations?scope=scope%3Aapprovals%3Atenant');
  await expect(page.getByRole('tab', { name: '연계 전달', exact: true })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await expect(page.getByRole('button', { name: '이벤트 다시 전달', exact: true })).toBeEnabled();
}

async function refreshOperations(page: Page) {
  // Exercise the actual mounted query through its real refresh command, including
  // during modal focus trapping. This does not mutate React/query-cache state.
  await page
    .getByRole('button', { name: '새로고침', exact: true, includeHidden: true })
    .first()
    .evaluate((button: HTMLButtonElement) => button.click());
}

async function choose(page: Page, label: string, option: string) {
  await page.getByRole('combobox', { name: new RegExp(`^${label} `) }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

async function expectQueue(page: Page, eventIds: string[]) {
  const rows = page.getByRole('tabpanel').getByRole('button');
  await expect(rows).toHaveCount(eventIds.length);
  for (const [index, id] of eventIds.entries()) await expect(rows.nth(index)).toContainText(id);
}

async function assertHeaderSearchContained(page: Page) {
  const button = page
    .locator('[data-shell-global-action="search"]')
    .getByRole('button', { name: 'DWP 검색', exact: true });
  await expect(button).toHaveCount(1);
  const bounds = await button.evaluate((element) => {
    const outer = element.getBoundingClientRect();
    const visibleLabels = Array.from(
      element.querySelectorAll<HTMLElement>('.MuiTypography-root')
    ).filter(
      (label) => label.getClientRects().length > 0 && getComputedStyle(label).display !== 'none'
    );
    return visibleLabels.map((label) => {
      const inner = label.getBoundingClientRect();
      return {
        text: label.textContent,
        topOverflow: Math.max(0, outer.top - inner.top),
        bottomOverflow: Math.max(0, inner.bottom - outer.bottom),
        leftOverflow: Math.max(0, outer.left - inner.left),
        rightOverflow: Math.max(0, inner.right - outer.right),
        whiteSpace: getComputedStyle(label).whiteSpace,
        lineHeight: parseFloat(getComputedStyle(label).lineHeight),
        fontSize: parseFloat(getComputedStyle(label).fontSize),
      };
    });
  });
  for (const label of bounds) {
    expect(label.topOverflow, `Search label above button: ${label.text}`).toBe(0);
    expect(label.bottomOverflow, `Search label below button: ${label.text}`).toBe(0);
    expect(label.leftOverflow).toBe(0);
    expect(label.rightOverflow).toBe(0);
    expect(label.whiteSpace).toBe('nowrap');
    expect(label.lineHeight).toBe(label.fontSize * 1.25);
  }
  return bounds;
}

async function highRisk(
  page: Page,
  authority: Awaited<ReturnType<typeof mockApprovalProductSurfaceAuthority>>,
  operations: ApprovalOperations
) {
  const network = await mockApprovalHighRiskNetwork(page, {
    commandPath: retryPath,
    commandResult: operations,
    issuerContinuation: false,
    issuedExpiresAt: [new Date(Date.now() + 600000).toISOString()],
    decisionRevision: authority.revision(),
  });
  await page.getByRole('button', { name: '이벤트 다시 전달', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: '고위험 작업 본인 확인', exact: true })
  ).toBeVisible();
  await page.getByRole('button', { name: '본인 확인', exact: true }).click();
  await expect(page.getByRole('button', { name: '작업 확인', exact: true })).toBeEnabled();
  expect(network.issuerRequests).toHaveLength(1);
  expect(network.commandRequests).toHaveLength(0);
  return network;
}

test('three queues select their right inspector and SLA opens the actual review route', async ({
  page,
}) => {
  const { state } = await setup(page);
  await open(page);
  await expect(page.getByRole('tab')).toHaveCount(3);
  await page.getByRole('tabpanel').getByRole('button').filter({ hasText: 'event-2-dead' }).click();
  await expect(
    page.getByRole('heading', { name: 'approval.request.approved', exact: true })
  ).toBeVisible();
  await expect(page.getByText('event-2-dead', { exact: true })).toHaveCount(2);
  await page.getByRole('tab', { name: '전달 완료', exact: true }).click();
  await expectQueue(page, ['event-5-published', 'event-6-published']);
  await expect(page.getByRole('button', { name: '이벤트 다시 전달', exact: true })).toBeDisabled();
  await page.getByRole('tab', { name: 'SLA 위반 업무', exact: true }).click();
  await expect(page.getByRole('combobox', { name: /^전달 상태 /u })).toBeDisabled();
  await expect(
    page.getByRole('heading', { name: APPROVAL_TASK_FIXTURE.title, exact: true })
  ).toBeVisible();
  const review = page.getByRole('button', { name: /^결재 상세 열기 /u });
  const detailRead = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api/approvals/v1/tasks/${APPROVAL_TASK_FIXTURE.taskId}`
  );
  await review.click();
  await detailRead;
  await expect(page).toHaveURL(
    new RegExp(`/approvals/inbox\\?.*task=${APPROVAL_TASK_FIXTURE.taskId}`)
  );
  for (const read of state.reads) {
    expect(read.scope).toBe('scope:approvals:tenant');
    expect(read.headers['idempotency-key']).toBeUndefined();
    expect(read.headers['x-dwp-step-up-challenge']).toBeUndefined();
    expect(read.headers['x-dwp-expected-object-version']).toBeUndefined();
  }
});

test('status filters exclude completed items and instant ordering has stable offset ties', async ({
  page,
}) => {
  await setup(page);
  await open(page);
  await expectQueue(page, ['event-1-failed', 'event-2-dead', 'event-3-pending', 'event-4-sending']);
  await choose(page, '정렬 기준', '최신 항목부터');
  await expectQueue(page, ['event-4-sending', 'event-3-pending', 'event-1-failed', 'event-2-dead']);
  await choose(page, '정렬 기준', '다음 전달 가능 시각순');
  await expectQueue(page, ['event-3-pending', 'event-2-dead', 'event-1-failed', 'event-4-sending']);
  for (const [label, id, retryable] of [
    ['실패', 'event-1-failed', true],
    ['격리', 'event-2-dead', true],
    ['대기', 'event-3-pending', false],
    ['전달 중', 'event-4-sending', false],
  ] as const) {
    await choose(page, '전달 상태', label);
    await expectQueue(page, [id]);
    const retry = page.getByRole('button', { name: '이벤트 다시 전달', exact: true });
    if (retryable) await expect(retry).toBeEnabled();
    else await expect(retry).toBeDisabled();
  }
  await page.getByRole('tab', { name: '전달 완료', exact: true }).click();
  await expectQueue(page, ['event-5-published', 'event-6-published']);
  await choose(page, '정렬 기준', '최신 항목부터');
  await expectQueue(page, ['event-6-published', 'event-5-published']);
});

test('explicit HIGH retry keeps the original bodyless wire, key, source revision and CAS', async ({
  page,
}) => {
  const { state, authority } = await setup(page);
  await open(page);
  const result = structuredClone(state.operations);
  const item = result.integrationDeliveries.find((delivery) =>
    delivery.outboxId.endsWith('000000000001')
  )!;
  item.status = 'PENDING';
  item.manualRetryCount = 1;
  item.version = 8;
  item.retryEligibility = {
    eligible: false,
    reason: 'STATUS_NOT_RETRYABLE',
    expectedVersion: 8,
    evaluatedAt: new Date().toISOString(),
  };
  const network = await highRisk(page, authority, result);
  await page.getByRole('button', { name: '작업 확인', exact: true }).click();
  await expect.poll(() => network.commandRequests.length).toBe(1);
  await expect(
    page.getByRole('dialog', { name: '고위험 작업 본인 확인', exact: true })
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: '이벤트 다시 전달', exact: true })).toBeDisabled();
  const command = network.commandRequests[0]!;
  expect(command.body).toBeNull();
  expect(command.headers['idempotency-key']).toBe(network.issuerRequests[0]!.body.idempotencyKey);
  expect(command.headers['x-dwp-expected-decision-revision']).toBe(authority.revision());
  expect(command.headers['x-dwp-expected-object-version']).toBe('7');
  expect(command.headers['x-dwp-step-up-challenge']).toBe('e2e-signed-step-up-challenge-1');
});

test('an empty retry403 dispatches once and does not auto-replay CSRF or POST', async ({
  page,
}) => {
  const { state, authority } = await setup(page);
  await open(page);
  const network = await highRisk(page, authority, state.operations);
  const requests: string[] = [];
  await page.route(
    (url) => url.pathname === retryPath,
    (route) => {
      requests.push(route.request().postData() ?? '');
      return route.fulfill({ status: 403, body: '' });
    }
  );
  await page.getByRole('button', { name: '작업 확인', exact: true }).click();
  await expect(page.getByText(/작업이 거절되어 재시도하지 않았습니다/u)).toBeVisible();
  expect(requests).toEqual(['']);
  expect(network.commandRequests).toHaveLength(0);
});

for (const status of [403, 503]) {
  test(`first actual operations GET${status} masks a previously ready HIGH attempt and sends zero retry`, async ({
    page,
  }) => {
    const { state, authority } = await setup(page);
    await open(page);
    const network = await highRisk(page, authority, state.operations);
    const reads = state.reads.length;
    state.failure = status;
    await refreshOperations(page);
    await expect.poll(() => state.reads.length).toBe(reads + 1);
    await expect(page.getByText(failureText, { exact: true })).toBeVisible();
    await expect(page.getByRole('tabpanel')).toHaveCount(0);
    await expect(
      page.getByRole('dialog', { name: '고위험 작업 본인 확인', exact: true })
    ).toHaveCount(0);
    await expect(page.getByRole('button', { name: '이벤트 다시 전달', exact: true })).toHaveCount(
      0
    );
    expect(network.commandRequests).toHaveLength(0);
    expect(network.issuerRequests).toHaveLength(1);
  });
}

test('an in-flight real GET prevents confirmation POST and recovers only from a fresh source', async ({
  page,
}) => {
  const { state, authority } = await setup(page);
  await open(page);
  const network = await highRisk(page, authority, state.operations);
  state.pause = true;
  await refreshOperations(page);
  await expect.poll(() => state.release !== undefined).toBe(true);
  try {
    const confirm = page.getByRole('button', { name: '작업 확인', exact: true });
    await expect(confirm).toBeVisible();
    await confirm.click();
    await expect(page.getByText(/작업이 거절되어 재시도하지 않았습니다/u)).toBeVisible();
    expect(network.commandRequests).toHaveLength(0);
  } finally {
    state.pause = false;
    state.release?.();
  }
  await page
    .getByRole('dialog', { name: '고위험 작업 본인 확인', exact: true })
    .getByRole('button', { name: '닫기', exact: true })
    .click();
  await expect(page.getByRole('tab', { name: '연계 전달', exact: true })).toBeVisible();
  expect(network.commandRequests).toHaveLength(0);
});

test('source failure during real deferred CSRF of an explicit HIGH action cannot dispatch another retry', async ({
  page,
}) => {
  const { state, authority } = await setup(page);
  await open(page);
  const network = await highRisk(page, authority, state.operations);
  let commands = 0;
  await page.route(
    (url) => url.pathname === retryPath,
    (route) => {
      commands++;
      return route.fulfill({ status: 403, body: '' });
    }
  );
  await page.getByRole('button', { name: '작업 확인', exact: true }).click();
  await expect(page.getByText(/작업이 거절되어 재시도하지 않았습니다/u)).toBeVisible();
  expect(commands).toBe(1);
  await page
    .getByRole('dialog', { name: '고위험 작업 본인 확인', exact: true })
    .getByRole('button', { name: '닫기', exact: true })
    .click();
  let releaseCsrf: (() => void) | undefined;
  await page.route('**/api/auth/csrf', async (route) => {
    await new Promise<void>((resolve) => {
      releaseCsrf = resolve;
    });
    await success(route, { token: 'fresh-csrf-token', headerName: 'X-XSRF-TOKEN' });
  });
  // Beginning a new explicit protected action first re-evaluates its authority.
  // This real CSRF wait covers that UI path; the API's final beforeDispatch gap
  // is independently exercised by the transport-linked API unit regressions.
  await page.getByRole('button', { name: '이벤트 다시 전달', exact: true }).click();
  await expect.poll(() => releaseCsrf !== undefined).toBe(true);
  const csrfResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/auth/csrf'
  );
  try {
    state.failure = 503;
    await refreshOperations(page);
    await expect(page.getByText(failureText, { exact: true })).toBeVisible();
  } finally {
    releaseCsrf?.();
  }
  await (await csrfResponse).finished();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );
  await expect(
    page.getByRole('dialog', { name: '고위험 작업 본인 확인', exact: true })
  ).toHaveCount(0);
  expect(commands).toBe(1);
  expect(network.commandRequests).toHaveLength(0);
});

for (const unknown of [false, true]) {
  test(`operations503 preserves independent retention ${unknown ? 'and locks the UNKNOWN original wire' : 'editor input'}`, async ({
    page,
  }) => {
    const { state } = await setup(page);
    await open(page);
    await page.getByRole('button', { name: '보존 정책 변경안 작성', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '보존 정책 변경안 작성', exact: true });
    const days = dialog.getByRole('spinbutton', { name: '완료 기록 보존 일수', exact: true });
    await days.fill('123');
    if (unknown) {
      state.unknownDraft = true;
      await dialog.getByRole('button', { name: '보존 변경안 저장', exact: true }).click();
      await expect.poll(() => state.policyCommands.length).toBe(1);
      await expect(days).not.toBeEditable();
    }
    state.failure = 503;
    await refreshOperations(page);
    await expect(page.getByText(failureText, { exact: true })).toBeVisible();
    await expect(dialog).toBeVisible();
    await expect(days).toHaveValue('123');
    if (unknown) await expect(days).not.toBeEditable();
    state.failure = 0;
    await page
      .getByRole('alert', { includeHidden: true })
      .filter({ hasText: failureText })
      .getByRole('button', { includeHidden: true })
      .evaluate((button: HTMLButtonElement) => button.click());
    await expect(
      page.getByRole('tab', { name: '연계 전달', exact: true, includeHidden: true })
    ).toBeVisible();
    await expect(days).toHaveValue('123');
    if (unknown) {
      await expect(
        dialog.getByRole('button', { name: '보존 변경안 저장', exact: true })
      ).toBeDisabled();
      await expect(
        page.getByRole('button', {
          name: '원본 명령 처리 증적 확인',
          exact: true,
          includeHidden: true,
        })
      ).toBeVisible();
      expect(state.policyCommands).toHaveLength(1);
    } else expect(state.policyCommands).toHaveLength(0);
  });
}

for (const appearance of ['light', 'dark', 'forced', 'large-text'] as const) {
  test(`workbench original-adapted viewport has readable controls, no overflow and no Axe violations (${appearance})`, async ({
    page,
  }, info) => {
    await page.setViewportSize({
      width: info.project.name === 'mobile' ? 320 : 1440,
      height: 1000,
    });
    await setup(page, appearance);
    await open(page);
    const heading = page.getByRole('heading', { name: '통합 이벤트 전달', exact: true });
    const originalHeadingFont = await heading.evaluate((element) =>
      parseFloat(getComputedStyle(element).fontSize)
    );
    if (appearance === 'large-text') {
      const originalFont = await page.evaluate(() =>
        parseFloat(getComputedStyle(document.documentElement).fontSize)
      );
      await page.evaluate(
        (size) => document.documentElement.style.setProperty('font-size', `${size}px`, 'important'),
        originalFont * 2
      );
      await expect
        .poll(() =>
          page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize))
        )
        .toBeGreaterThanOrEqual(originalFont * 2);
      await expect
        .poll(() => heading.evaluate((element) => parseFloat(getComputedStyle(element).fontSize)))
        .toBeGreaterThanOrEqual(originalHeadingFont * 2);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: info.outputPath(`ops-${appearance}-top-viewport.png`),
      fullPage: false,
    });
    await info.attach('header-search-containment', {
      body: JSON.stringify(await assertHeaderSearchContained(page)),
      contentType: 'application/json',
    });
    await heading.scrollIntoViewIfNeeded();
    await expect(page.getByRole('tablist', { name: '운영 작업 큐', exact: true })).toBeVisible();
    await expect(page.getByRole('combobox', { name: /^전달 상태 /u })).toBeVisible();
    await expect(page.getByRole('combobox', { name: /^정렬 기준 /u })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    ).toBeLessThanOrEqual(1);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: info.outputPath(`ops-${appearance}-viewport.png`),
      fullPage: false,
    });
    await page.getByRole('tab', { name: 'SLA 위반 업무', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: APPROVAL_TASK_FIXTURE.title, exact: true })
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    ).toBeLessThanOrEqual(1);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page
      .getByRole('heading', { name: APPROVAL_TASK_FIXTURE.title, exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: info.outputPath(`ops-${appearance}-sla-inspector-viewport.png`),
      fullPage: false,
    });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.screenshot({
      path: info.outputPath(`ops-${appearance}-bottom-viewport.png`),
      fullPage: false,
    });
    const sla = page.getByRole('tab', { name: 'SLA 위반 업무', exact: true });
    await sla.focus();
    await expect(sla).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: '연계 전달', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('tabpanel', { name: '연계 전달', exact: true })).toBeVisible();
  });
}

test('full accessible header search opens its real dialog and Escape restores focus at 2x font', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: info.project.name === 'mobile' ? 320 : 1440, height: 1000 });
  await setup(page);
  await open(page);
  const font = await page.evaluate(() =>
    parseFloat(getComputedStyle(document.documentElement).fontSize)
  );
  await page.evaluate(
    (size) => document.documentElement.style.setProperty('font-size', `${size}px`, 'important'),
    font * 2
  );
  await expect
    .poll(() =>
      page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize))
    )
    .toBe(font * 2);
  await assertHeaderSearchContained(page);
  const search = page
    .locator('[data-shell-global-action="search"]')
    .getByRole('button', { name: 'DWP 검색', exact: true });
  await expect(search).toHaveAttribute('aria-haspopup', 'dialog');
  await search.click();
  const dialog = page.getByRole('dialog', { name: 'DWP 검색', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('combobox', { name: 'DWP 검색', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(search).toBeFocused();
  await expect(search).toHaveAttribute('aria-expanded', 'false');
});
