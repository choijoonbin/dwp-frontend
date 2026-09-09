import { expect, test, type Page, type Route } from '@playwright/test';
import { ASK_RUNTIME_FIXTURE, DEFAULT_APP_PERMISSIONS } from './support/runtime-access';
import { fulfillSuccess } from './support/shell-session';
import {
  mockWorkHubFoundation,
  WORK_HUB_FIXTURE as fixture,
} from './support/work-hub-foundation-fixtures';

const question = '현재 업무에서 확인할 사항을 정리해 주세요.';
const answer = '선택한 업무의 원천 근거를 확인한 응답입니다.';
const conversationId = 'cefaef98-4cf6-46ee-a057-984c5e9c6cc8';
const serviceRoute = `/work/queue?work=${encodeURIComponent(`SERVICE_REQUEST:${fixture.serviceId}:`)}`;
const approvalRoute = `/work/queue?work=${encodeURIComponent(`APPROVAL_TASK:${fixture.approvalId}:SECURITY_REVIEW`)}`;
const personalRoute = `/work/queue?work=${encodeURIComponent(`PERSONAL_TASK:${fixture.personalId}:`)}`;

async function openAssist(page: Page, route = serviceRoute) {
  await page.goto(route);
  const detail = page.getByRole('article');
  await expect(detail).toBeVisible({ timeout: 30_000 });
  await detail.getByRole('button', { name: 'DWAI·ON에게 묻기', exact: true }).click();
  const panel = page.getByTestId('work-assist-panel');
  await expect(panel).toBeVisible();
  await panel.getByRole('textbox', { name: '질문', exact: true }).fill(question);
  return panel;
}

async function respond(route: Route, approval = false) {
  const request = route.request().postDataJSON() as {
    requestId?: unknown;
    agentKey?: unknown;
    pageContext?: { selectedWork?: unknown };
  };
  await route.fulfill({
    contentType: 'text/event-stream',
    body: `event: result\ndata: ${JSON.stringify({
      data: {
        ...ASK_RUNTIME_FIXTURE,
        requestId: request.requestId,
        answer,
        conversationId,
        selectedWork: request.pageContext?.selectedWork ?? null,
        agentRegistry: {
          ...ASK_RUNTIME_FIXTURE.agentRegistry,
          entryKey:
            typeof request.agentKey === 'string'
              ? request.agentKey
              : approval
                ? 'DWP_APPROVAL_EXPERT'
                : 'DWP_ASSISTANT',
        },
      },
    })}\n\n`,
  });
}

async function respondAbstained(route: Route, statusCode: string) {
  const request = route.request().postDataJSON() as {
    requestId?: unknown;
    agentKey?: unknown;
    pageContext?: { selectedWork?: unknown };
  };
  await route.fulfill({
    contentType: 'text/event-stream',
    body: `event: result\ndata: ${JSON.stringify({
      data: {
        ...ASK_RUNTIME_FIXTURE,
        requestId: request.requestId,
        state: 'ABSTAINED',
        statusCode,
        answer: null,
        confidence: null,
        citations: [],
        sourceCount: 0,
        conversationId: null,
        userMessageId: null,
        assistantMessageId: null,
        selectedWork: request.pageContext?.selectedWork ?? null,
        agentRegistry: {
          ...ASK_RUNTIME_FIXTURE.agentRegistry,
          entryKey: typeof request.agentKey === 'string' ? request.agentKey : 'DWP_ASSISTANT',
        },
      },
    })}\n\n`,
  });
}

for (const approval of [false, true]) {
  test(`selected ${approval ? 'approval' : 'service'} sends a typed binding and continues its persisted expert conversation`, async ({
    page,
  }, testInfo) => {
    const runtime = await mockWorkHubFoundation(page, { locale: 'ko' });
    const payloads: Record<string, unknown>[] = [];
    const launches: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/question-launches')) launches.push(request.url());
    });
    await page.route('**/api/agent/v1/ask/stream', async (route) => {
      payloads.push(route.request().postDataJSON());
      await respond(route, approval);
    });
    const panel = await openAssist(page, approval ? approvalRoute : serviceRoute);
    const continueButton = panel.getByRole('button', {
      name: 'DWAI·ON 전체 화면에서 이어서 대화하기',
      exact: true,
    });
    await expect(continueButton).toBeDisabled();
    await panel.getByRole('button', { name: '선택 업무 질문하기', exact: true }).click();
    await expect(page.getByTestId('work-assist-result')).toContainText(answer);
    expect(payloads).toHaveLength(1);
    expect(payloads[0]).toMatchObject({
      query: question,
      agentKey: approval ? 'DWP_APPROVAL_EXPERT' : 'DWP_ASSISTANT',
      pageContext: {
        appKey: approval ? 'APP.APPROVALS' : 'APP.EMPLOYEE_SERVICES',
        route: '/work/queue',
        selectedWork: {
          sourceSystem: approval ? 'APPROVAL_TASK' : 'SERVICE_REQUEST',
          sourceReference: approval ? fixture.approvalId : fixture.serviceId,
          expectedVersion: approval ? 2 : 3,
          ...(approval ? { obligationKey: 'SECURITY_REVIEW' } : {}),
        },
      },
    });
    const serialized = JSON.stringify(payloads);
    expect(serialized).not.toContain(fixture.approvalTitle);
    expect(serialized).not.toContain(fixture.serviceTitle);
    await page.screenshot({
      path: testInfo.outputPath('typed-selected-work-response.png'),
      fullPage: true,
    });
    await continueButton.click();
    await expect(page).toHaveURL(
      approval
        ? `/dwaion/conversations/${conversationId}?agent=DWP_APPROVAL_EXPERT`
        : `/dwaion/conversations/${conversationId}`
    );
    expect(launches).toEqual([]);
    expect(runtime.sourceMutations).toEqual([]);
    expect(runtime.forbiddenWorkspaceMutations).toEqual([]);
  });
}

test('a response bound to another selected-work version is rejected without exposing its answer', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'The fail-closed response contract runs once.');
  await mockWorkHubFoundation(page, { locale: 'ko' });
  await page.route('**/api/agent/v1/ask/stream', async (route) => {
    const request = route.request().postDataJSON() as {
      requestId: string;
      agentKey: string;
      pageContext: {
        selectedWork: {
          sourceSystem: string;
          sourceReference: string;
          expectedVersion: number;
          obligationKey?: string;
        };
      };
    };
    await route.fulfill({
      contentType: 'text/event-stream',
      body: `event: result\ndata: ${JSON.stringify({
        data: {
          ...ASK_RUNTIME_FIXTURE,
          requestId: request.requestId,
          answer,
          conversationId,
          selectedWork: {
            ...request.pageContext.selectedWork,
            expectedVersion: request.pageContext.selectedWork.expectedVersion + 1,
          },
          agentRegistry: {
            ...ASK_RUNTIME_FIXTURE.agentRegistry,
            entryKey: request.agentKey,
          },
        },
      })}\n\n`,
    });
  });

  const panel = await openAssist(page);
  await panel.getByRole('button', { name: '선택 업무 질문하기', exact: true }).click();

  await expect(panel).toContainText(
    '업무가 변경되었거나 전달을 완료하지 못했습니다. 최신 내용을 다시 확인하세요.'
  );
  await expect(page.getByText(answer, { exact: true })).toHaveCount(0);
  await expect(
    panel.getByRole('button', {
      name: 'DWAI·ON 전체 화면에서 이어서 대화하기',
      exact: true,
    })
  ).toBeDisabled();
});

for (const { resourceKey, route, title, approval } of [
  { resourceKey: 'APP.ASK', route: serviceRoute, title: fixture.serviceTitle, approval: false },
  {
    resourceKey: 'APP.EMPLOYEE_SERVICES',
    route: serviceRoute,
    title: fixture.serviceTitle,
    approval: false,
  },
  {
    resourceKey: 'APP.APPROVALS',
    route: approvalRoute,
    title: fixture.approvalTitle,
    approval: true,
  },
  { resourceKey: 'APP.WORK', route: personalRoute, title: fixture.personalTitle, approval: false },
]) {
  test(`losing ${resourceKey} closes the open assist panel and discards its late response`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    await mockWorkHubFoundation(page, { locale: 'ko' });
    const permissions = [
      ...DEFAULT_APP_PERMISSIONS,
      {
        resourceType: 'APP',
        resourceKey: 'APP.APPROVALS',
        permissionCode: 'VIEW',
        effect: 'ALLOW',
      },
    ];
    let revoked = false;
    let permissionRequests = 0;
    await page.route('**/api/auth/permissions', (route) => {
      permissionRequests += 1;
      return fulfillSuccess(
        route,
        permissions.filter((permission) => !revoked || permission.resourceKey !== resourceKey)
      );
    });
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    let received = 0;
    let returned = false;
    await page.route('**/api/agent/v1/ask/stream', async (route) => {
      received += 1;
      await pending;
      await respond(route, approval);
      returned = true;
    });
    try {
      const panel = await openAssist(page, route);
      await panel.getByRole('button', { name: '선택 업무 질문하기', exact: true }).click();
      await expect.poll(() => received).toBe(1);
      const beforeRevocation = permissionRequests;
      revoked = true;
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
      await expect.poll(() => permissionRequests).toBeGreaterThan(beforeRevocation);
      await expect(panel).toHaveCount(0);
      release();
      await expect.poll(() => returned).toBe(true);
      await expect(page.getByText(answer, { exact: true })).toHaveCount(0);
      if (resourceKey === 'APP.WORK') {
        await expect(page.getByRole('article')).toHaveCount(0);
      } else {
        const beforeRestore = permissionRequests;
        revoked = false;
        await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
        await expect.poll(() => permissionRequests).toBeGreaterThan(beforeRestore);
        await expect(page.getByRole('article')).toContainText(title);
      }
      await expect(panel).toHaveCount(0);
      await expect(page.getByText(answer, { exact: true })).toHaveCount(0);
      await expect(page).toHaveURL(resourceKey === 'APP.WORK' ? '/403' : route);
      await page.screenshot({
        path: testInfo.outputPath(`revoked-${resourceKey}-late-result-discarded.png`),
        fullPage: true,
      });
    } finally {
      release();
    }
  });
}

for (const statusCode of [
  'SELECTED_WORK_FORBIDDEN',
  'SELECTED_WORK_NOT_FOUND',
  'SELECTED_WORK_STALE',
]) {
  test(`server ${statusCode} closes stale assist state and refetches its queue`, async ({
    page,
  }) => {
    await mockWorkHubFoundation(page, { locale: 'ko' });
    let sourcePurged = false;
    let serviceReads = 0;
    await page.route('**/api/platform/v1/services/requests**', (route) => {
      serviceReads += 1;
      if (sourcePurged && statusCode !== 'SELECTED_WORK_STALE')
        return route.fulfill({
          status: statusCode === 'SELECTED_WORK_FORBIDDEN' ? 403 : 404,
          json: { status: 'ERROR', message: 'Selected source no longer available' },
        });
      return route.fallback();
    });
    await page.route('**/api/agent/v1/ask/stream', async (route) => {
      sourcePurged = true;
      await respondAbstained(route, statusCode);
    });
    const panel = await openAssist(page);
    const readsBeforeSubmit = serviceReads;
    await panel.getByRole('button', { name: '선택 업무 질문하기', exact: true }).click();
    await expect(panel).toHaveCount(0);
    await expect.poll(() => serviceReads).toBeGreaterThan(readsBeforeSubmit + 1);
    await expect(page).toHaveURL('/work/queue');
    if (statusCode !== 'SELECTED_WORK_STALE')
      await expect(page.getByText(fixture.serviceTitle, { exact: true })).toHaveCount(0);
  });
}

test('an actor transition closes the panel and discards the previous owner response', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await mockWorkHubFoundation(page, { locale: 'ko' });
  let userId = 1;
  let meRequests = 0;
  await page.route('**/api/auth/me', (route) => {
    meRequests += 1;
    return fulfillSuccess(route, {
      userId,
      personPublicId: `person-${userId}`,
      displayName: `Owner ${userId}`,
      jobTitle: 'Workspace member',
      email: `owner-${userId}@example.test`,
      tenantId: 1,
      tenantCode: 'default',
      tenantName: 'SKAX',
      identityPlane: 'TENANT',
      preferredLocale: 'ko',
      tenantDefaultLocale: 'ko',
      roles: ['WORKSPACE_MEMBER'],
      groups: [],
      resourceRoles: [],
    });
  });
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let received = 0;
  await page.route('**/api/agent/v1/ask/stream', async (route) => {
    received += 1;
    await pending;
    await respond(route);
  });
  try {
    const panel = await openAssist(page);
    await panel.getByRole('button', { name: '선택 업무 질문하기', exact: true }).click();
    await expect.poll(() => received).toBe(1);
    const beforeTransition = meRequests;
    userId = 2;
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect.poll(() => meRequests).toBeGreaterThan(beforeTransition);
    await expect(panel).toHaveCount(0);
    release();
    await expect(page.getByText(answer, { exact: true })).toHaveCount(0);
  } finally {
    release();
  }
});

test('320px approval source handoff from DWAI returns to the selected work and restores AI focus', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'The mobile project owns the 320px DWAI return-focus contract.');
  await page.setViewportSize({ width: 320, height: 844 });
  const runtime = await mockWorkHubFoundation(page, { locale: 'ko' });
  await page.route('**/api/agent/v1/ask/stream', (route) =>
    respondAbstained(route, 'SELECTED_WORK_RESTRICTED')
  );
  const workRoute = `${approvalRoute}&q=${encodeURIComponent('project')}#approval-evidence`;
  const panel = await openAssist(page, workRoute);
  const reads = runtime.personalReads;
  await panel.getByRole('button', { name: '선택 업무 질문하기', exact: true }).click();
  const source = panel.getByRole('button', { name: '원본에서 확인', exact: true });
  await expect(source).toBeVisible();
  await source.click();

  await expect(page).toHaveURL(
    (url) =>
      url.pathname === '/approvals/inbox' &&
      url.searchParams.get('task') === fixture.approvalId &&
      url.searchParams.get('returnTo') === workRoute
  );
  await page.getByRole('button', { name: '업무로 돌아가기', exact: true }).click();
  await expect(page).toHaveURL((url) => `${url.pathname}${url.search}${url.hash}` === workRoute);
  await expect(page.getByRole('article')).toContainText(fixture.approvalTitle);
  await expect(page.locator('[data-work-ai-trigger]')).toBeFocused();
  expect(runtime.personalReads).toBeGreaterThan(reads);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
    )
  ).toBe(true);
});

test('320px at 200 percent keeps the assist panel operable and restores trigger focus', async ({
  page,
  isMobile,
}, testInfo) => {
  test.skip(!isMobile, 'The mobile project owns the 320px text-enlargement contract.');
  await page.setViewportSize({ width: 320, height: 844 });
  await mockWorkHubFoundation(page, { locale: 'ko' });
  const panel = await openAssist(page);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await expect(panel).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
    )
  ).toBe(true);
  expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
    true
  );
  for (const button of await panel.getByRole('button').all()) {
    if (!(await button.isVisible())) continue;
    const bounds = await button.boundingBox();
    expect(bounds?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(bounds?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  await page.screenshot({
    path: testInfo.outputPath('selected-work-assist-320-200-panel.png'),
    fullPage: true,
  });
  const close = panel.getByRole('button', { name: '닫기', exact: true });
  await close.focus();
  await expect(close).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(panel).toHaveCount(0);
  await expect(page.locator('[data-work-ai-trigger]')).toBeFocused();
  await page.screenshot({
    path: testInfo.outputPath('selected-work-assist-320-200-focus-restored.png'),
    fullPage: true,
  });
});
