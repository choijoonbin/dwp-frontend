import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

import { mockShellSession } from './support/shell-session';
import { mockApprovalProductSurfaceAuthority } from './support/product-surface-authority';
import {
  APPROVAL_HOME_FIXTURE,
  APPROVAL_MEMBER_PERMISSIONS,
} from './support/approval-command-center-fixtures';
import { APPROVAL_TASK_DETAIL_FIXTURE } from './support/product-area-fixtures';

test.use({ timezoneId: 'Asia/Seoul' });

function success(route: Route, data: unknown) {
  return route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', data }),
  });
}

async function prepare(page: Page, dark = false) {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    displayName: '이서연',
    permissions: APPROVAL_MEMBER_PERMISSIONS,
    appearance: {
      mode: dark ? 'dark' : 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
  await mockApprovalProductSurfaceAuthority(page, { surfaceUi: false });
  await page.route('**/api/approvals/v1/home', (route) => success(route, APPROVAL_HOME_FIXTURE));
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/tasks' && url.searchParams.get('view') === 'INBOX',
    (route) => success(route, APPROVAL_HOME_FIXTURE.focusQueue)
  );
  await page.route(
    (url) => /^\/api\/approvals\/v1\/tasks\/approval-task-[12]$/u.test(url.pathname),
    (route) => {
      const task = APPROVAL_HOME_FIXTURE.focusQueue.find((item) =>
        route.request().url().endsWith(item.taskId)
      );
      return success(route, { ...APPROVAL_TASK_DETAIL_FIXTURE, task, canDecide: true });
    }
  );
}

async function openQueueSidebar(page: Page) {
  const mobile = (page.viewportSize()?.width ?? 1280) < 1200;
  const sidebar = page.getByTestId(mobile ? 'approvals-mobile-sidebar' : 'approvals-sidebar');
  const trigger = page.getByRole('button', { name: '전자결재 메뉴 열기' });
  if (mobile && (await trigger.getAttribute('aria-expanded')) !== 'true') {
    await expect(sidebar).not.toBeVisible();
    await trigger.click();
  }
  await expect(sidebar).toBeVisible();
  return sidebar;
}

test('결재함 부모 항목은 필터와 우측 화면을 유지하며 하위 메뉴를 접고 펼친다', async ({
  page,
}, info) => {
  await prepare(page);
  await page.goto('/approvals/home');
  let sidebar = await openQueueSidebar(page);
  await sidebar.getByRole('link', { name: '결재함', exact: true }).click();
  await expect(page).toHaveURL(/\/approvals\/inbox$/u);
  sidebar = await openQueueSidebar(page);
  const parent = sidebar.getByRole('button', { name: '결재함', exact: true });
  const filters = sidebar.getByRole('navigation', { name: '결재 큐 필터' });
  await expect(parent).toHaveAttribute('aria-expanded', 'true');
  await expect(filters.getByRole('button')).toHaveCount(4);
  await filters.getByRole('button', { name: /^긴급 결재/u }).click();
  await expect(page).toHaveURL(/queue=URGENT/u);
  await openQueueSidebar(page);
  const selectedUrl = page.url();
  await parent.click();
  await expect(parent).toHaveAttribute('aria-expanded', 'false');
  await expect(filters).toHaveCount(0);
  expect(page.url()).toBe(selectedUrl);
  await expect(sidebar).toBeVisible();
  await page.screenshot({ path: info.outputPath('approval-sidebar-collapsed.png') });
  await parent.click();
  await expect(parent).toHaveAttribute('aria-expanded', 'true');
  await expect(filters.getByRole('button', { name: /^긴급 결재/u })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  expect(page.url()).toBe(selectedUrl);
  await page.screenshot({ path: info.outputPath('approval-sidebar-expanded.png') });
  await parent.click();
  await sidebar.getByRole('link', { name: '전자결재 홈', exact: true }).click();
  await expect(page).toHaveURL(/\/approvals\/home$/u);
  await openQueueSidebar(page);
  await sidebar.getByRole('link', { name: '결재함', exact: true }).click();
  await openQueueSidebar(page);
  await expect(parent).toHaveAttribute('aria-expanded', 'true');
  await expect(filters.getByRole('button')).toHaveCount(4);
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
});

test('결재함 접기 펼치기는 다크 모드 200%와 키보드에서도 포커스와 선택을 유지한다', async ({
  page,
}) => {
  const mobile = (page.viewportSize()?.width ?? 1280) < 1200;
  await page.setViewportSize({ width: mobile ? 320 : 1440, height: 960 });
  await prepare(page, true);
  await page.goto('/approvals/inbox?queue=HIGH_RISK&task=approval-task-2');
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  const sidebar = await openQueueSidebar(page);
  const parent = sidebar.getByRole('button', { name: '결재함', exact: true });
  const filters = sidebar.getByRole('navigation', { name: '결재 큐 필터' });
  const selectedUrl = page.url();
  await parent.focus();
  await parent.press('Space');
  await expect(parent).toBeFocused();
  await expect(parent).toHaveAttribute('aria-expanded', 'false');
  await expect(filters).toHaveCount(0);
  await parent.press('Enter');
  await expect(parent).toBeFocused();
  await expect(parent).toHaveAttribute('aria-expanded', 'true');
  await expect(filters.getByRole('button', { name: /^고위험/u })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  const controlsId = await parent.getAttribute('aria-controls');
  expect(
    await page
      .locator('[id]')
      .evaluateAll(
        (elements, id) => elements.filter((element) => element.id === id).length,
        controlsId
      )
  ).toBe(1);
  expect(page.url()).toBe(selectedUrl);
  await parent.press('Tab');
  await expect(filters.getByRole('button', { name: /^전체 대기/u })).toBeFocused();
  expect(await sidebar.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
    true
  );
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
});

for (const outcome of ['unavailable', 'new-version'] as const) {
  test(`열린 승인 확인은 상세 ${outcome} 재검증에서 무효화된다`, async ({ page }) => {
    await prepare(page);
    let changed = false;
    let detailReads = 0;
    let posts = 0;
    await page.route('**/api/approvals/v1/tasks/approval-task-1', (route) => {
      detailReads += 1;
      if (changed && outcome === 'unavailable')
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ERROR', errorCode: 'AUTHORITY_RESOLUTION_UNAVAILABLE' }),
        });
      return success(route, {
        ...APPROVAL_TASK_DETAIL_FIXTURE,
        canDecide: true,
        task: { ...APPROVAL_HOME_FIXTURE.focusQueue[0], version: changed ? 2 : 1 },
      });
    });
    await page.route('**/api/approvals/v1/tasks/*/decisions', (route) => {
      posts += 1;
      return success(route, APPROVAL_TASK_DETAIL_FIXTURE);
    });
    await page.goto('/approvals/inbox?task=approval-task-1');
    await page.getByRole('button', { name: '승인', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const previousReads = detailReads;
    changed = true;
    await page.evaluate(() => {
      dispatchEvent(new Event('offline'));
      dispatchEvent(new Event('online'));
    });
    await expect.poll(() => detailReads).toBeGreaterThan(previousReads);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(posts).toBe(0);
    if (outcome === 'new-version') {
      await expect(page.getByRole('button', { name: '승인', exact: true })).toBeEnabled();
      await page.getByRole('button', { name: '승인', exact: true }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      expect(posts).toBe(0);
    } else {
      await expect(
        page.getByRole('alert').filter({ hasText: '선택한 결재의 최신 권한' })
      ).toBeVisible();
      await expect(page.getByRole('button', { name: '승인', exact: true })).toHaveCount(0);
    }
  });
}

test('동일 화면 URL 선택과 모바일 상세 키보드 포커스는 일치한다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepare(page);
  await page.goto('/approvals/inbox');
  const first = page.getByRole('button', { name: /고객 분석 환경 접근 연장/u });
  await first.focus();
  await first.press('Enter');
  const detail = page.getByRole('region', { name: '결재 상세', exact: true });
  await expect(detail).toBeFocused();
  await expect(detail.getByRole('heading', { name: '고객 분석 환경 접근 연장' })).toBeVisible();
  await page.evaluate(() => {
    history.pushState({}, '', '/approvals/inbox?task=approval-task-2');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(detail.getByRole('heading', { name: '신규 협력사 보안 예외' })).toBeVisible();
  await page.getByRole('button', { name: '결재 목록으로 돌아가기' }).click();
  await page.evaluate(() => {
    history.pushState({}, '', '/approvals/inbox?task=approval-task-2');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(detail.getByRole('heading', { name: '신규 협력사 보안 예외' })).toBeVisible();
  await expect(detail).toBeFocused();
});

test('배치가 확인한 권한 회수는 우측 상세에도 즉시 반영된다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await prepare(page);
  let revoked = false;
  let posts = 0;
  await page.route('**/api/approvals/v1/tasks/approval-task-1', (route) =>
    success(route, {
      ...APPROVAL_TASK_DETAIL_FIXTURE,
      canDecide: !revoked,
      task: { ...APPROVAL_HOME_FIXTURE.focusQueue[0], version: revoked ? 2 : 1 },
    })
  );
  await page.route('**/api/approvals/v1/tasks/*/decisions', (route) => {
    posts += 1;
    return success(route, {});
  });
  await page.goto('/approvals/inbox?task=approval-task-1');
  await expect(page.getByRole('button', { name: '승인', exact: true })).toBeEnabled();
  await page.getByLabel('고객 분석 환경 접근 연장 배치 승인 선택').check();
  await page.getByRole('button', { name: '선택 항목 승인' }).click();
  revoked = true;
  await page.getByRole('dialog').getByRole('button', { name: '배치 승인 시작' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: '승인 0건 · 처리 불가 1건' })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '승인', exact: true })).toBeDisabled();
  expect(posts).toBe(0);
});

test('오늘 마감 큐와 사이드바 건수는 자정에 함께 갱신된다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.clock.install({ time: new Date('2026-09-04T23:59:50+09:00') });
  await prepare(page);
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/tasks' && url.searchParams.get('view') === 'INBOX',
    (route) =>
      success(
        route,
        APPROVAL_HOME_FIXTURE.focusQueue.map((task, index) => ({
          ...task,
          dueAt: index === 0 ? '2026-09-04T23:59:59+09:00' : '2026-09-05T12:00:00+09:00',
        }))
      )
  );
  await page.goto('/approvals/inbox?queue=DUE_TODAY');
  const list = page.getByLabel('검토 대기 결재 목록');
  await expect(list.getByText('고객 분석 환경 접근 연장')).toBeVisible();
  await expect(list.getByText('신규 협력사 보안 예외')).toHaveCount(0);
  await page.clock.fastForward(15_000);
  await expect(list.getByText('고객 분석 환경 접근 연장')).toHaveCount(0);
  await expect(list.getByText('신규 협력사 보안 예외')).toBeVisible();
  await expect(
    page
      .getByRole('navigation', { name: '결재 큐 필터' })
      .getByRole('button', { name: /^오늘 마감/u })
  ).toContainText('1');
});

for (const view of [
  { width: 1440, dark: false, forced: false },
  { width: 1280, dark: true, forced: false },
  { width: 390, dark: false, forced: false },
  { width: 320, dark: false, forced: true },
]) {
  test(`홈 시각 및 접근성 ${view.width} ${view.dark ? 'dark' : view.forced ? 'forced' : 'light'}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: view.width, height: 960 });
    await page.emulateMedia({
      reducedMotion: 'reduce',
      forcedColors: view.forced ? 'active' : 'none',
    });
    await prepare(page, view.dark);
    await page.goto('/approvals/home');
    await expect(
      page.getByRole('heading', { name: '안녕하세요, 이서연님', level: 1 })
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: '내 기안 진행 추적' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: '결재 큐 필터' })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations).toEqual([]);
    const screenshot = testInfo.outputPath('approval-home.png');
    await page.screenshot({ path: screenshot, fullPage: true });
    await testInfo.attach('approval-home', { path: screenshot, contentType: 'image/png' });
    if (view.width === 1440) {
      await page.goto('/approvals/inbox?task=approval-task-1');
      const filters = page.getByRole('navigation', { name: '결재 큐 필터' });
      await expect(filters.getByRole('button')).toHaveCount(4);
      await expect(page.getByRole('region', { name: '결재 상세', exact: true })).toContainText(
        '고객 분석 환경 접근 연장'
      );
      for (const [name, count] of [
        ['전체 대기', 2],
        ['긴급 결재', 1],
        ['오늘 마감', 0],
        ['고위험', 2],
      ] as const) {
        await filters.getByRole('button', { name: new RegExp(`^${name}`, 'u') }).click();
        await expect(
          page.getByLabel('검토 대기 결재 목록').locator('[data-approval-task-id]')
        ).toHaveCount(count);
      }
      const inboxScreenshot = testInfo.outputPath('approval-inbox.png');
      await page.screenshot({ path: inboxScreenshot, fullPage: true });
      await testInfo.attach('approval-inbox', { path: inboxScreenshot, contentType: 'image/png' });
    }
  });
}
