import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';
import { CALENDAR_EVENT_FIXTURE, CALENDAR_HOME_FIXTURE } from './support/product-area-fixtures';

const CALENDAR_SURFACES = [
  { id: 'home', path: '/calendar/home' },
  { id: 'schedule', path: '/calendar/schedule' },
  { id: 'focus', path: '/calendar/focus' },
  { id: 'invitations', path: '/calendar/invitations' },
  { id: 'availability', path: '/calendar/availability' },
  { id: 'insights', path: '/calendar/insights' },
  { id: 'trash', path: '/calendar/trash' },
  { id: 'admin-overview', path: '/calendar/admin/overview' },
  { id: 'admin-company-calendars', path: '/calendar/admin/company-calendars' },
  { id: 'admin-policies', path: '/calendar/admin/policies' },
] as const;

const CALENDAR_FORCED_COLOR_SURFACES = [
  { id: 'home', path: '/calendar/home' },
  { id: 'schedule', path: '/calendar/schedule' },
  { id: 'insights', path: '/calendar/insights' },
  { id: 'admin-overview', path: '/calendar/admin/overview' },
  { id: 'admin-company-calendars', path: '/calendar/admin/company-calendars' },
] as const;

async function prepareCalendarSurface(page: Page, path: string, appearance: 'dark' | 'light') {
  await page.clock.setFixedTime(new Date('2026-08-11T00:20:00Z'));
  await page.emulateMedia({
    colorScheme: appearance,
    forcedColors: 'none',
    reducedMotion: 'reduce',
  });
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'ko',
    permissions: FULL_PRODUCT_PERMISSIONS,
    appearance: {
      mode: appearance,
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
  await page.route('**/api/platform/v1/calendar/team-availability/snapshot**', (route) =>
    route.fulfill({
      json: {
        status: 'SUCCESS',
        data: {
          date: '2026-08-11',
          timeZone: 'Asia/Seoul',
          generatedAt: '2026-08-11T00:20:00Z',
          validUntil: '2026-08-11T00:20:30Z',
          source: 'DWP_NATIVE_CALENDAR',
          scope: 'SHARED_WITH_ME',
          members: [],
          hasMore: false,
        },
      },
    })
  );
  await page.goto(path);
  const main = page.locator('#dwp-main-content');
  await expect(main).toBeVisible({ timeout: 15_000 });
  await expect(main.locator('h1').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.MuiSkeleton-root')).toHaveCount(0, { timeout: 15_000 });
  return main;
}

for (const surface of CALENDAR_SURFACES) {
  test(`calendar ${surface.id} preserves its dark premium baseline`, async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });

    const main = await prepareCalendarSurface(page, surface.path, 'dark');
    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(horizontalOverflow, `${surface.path} has horizontal overflow`).toBeLessThanOrEqual(1);
    expect(runtimeErrors, `${surface.path} emitted browser runtime errors`).toEqual([]);

    const accessibility = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
    expect(
      accessibility.violations.filter(
        (violation) => violation.impact === 'critical' || violation.impact === 'serious'
      )
    ).toEqual([]);
    await expect(main).toHaveScreenshot(`calendar-${surface.id}-dark.png`, {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.002,
      timeout: 15_000,
    });
  });
}

for (const surface of CALENDAR_FORCED_COLOR_SURFACES) {
  test(`calendar ${surface.id} remains usable in forced colors`, async ({ page }) => {
    const main = await prepareCalendarSurface(page, surface.path, 'light');
    await page.emulateMedia({
      colorScheme: 'light',
      forcedColors: 'active',
      reducedMotion: 'reduce',
    });

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(horizontalOverflow, `${surface.path} has horizontal overflow`).toBeLessThanOrEqual(1);
    const accessibility = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
    expect(
      accessibility.violations.filter(
        (violation) => violation.impact === 'critical' || violation.impact === 'serious'
      )
    ).toEqual([]);
    await expect(main).toHaveScreenshot(`calendar-${surface.id}-forced-colors.png`, {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.002,
      timeout: 15_000,
    });
  });
}

test('calendar home presents an execution-first day with an inline briefing on wide screens', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium');
  await page.setViewportSize({ width: 1920, height: 1080 });
  const main = await prepareCalendarSurface(page, '/calendar/home', 'dark');
  const workspace = page.getByTestId('calendar-today-workspace');
  const now = page.getByTestId('calendar-today-now');
  const rail = page.getByTestId('calendar-workspace-rail');
  await expect(page.getByRole('heading', { level: 1, name: '오늘의 흐름' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: '시간순 일정' })).toBeVisible();
  await expect(main).not.toContainText(/home\.[a-z]/u);
  await expect(workspace).toBeVisible();
  await expect(now).toBeVisible();
  await expect(rail).toBeVisible();
  await expect(rail.getByText('중간 우선순위', { exact: true })).toBeVisible();
  await expect(page.getByTestId('interactive-calendar')).toHaveCount(0);
  await expect(page.getByTestId('calendar-source-panel')).toHaveCount(0);

  const workspaceBounds = await workspace.boundingBox();
  const nowBounds = await now.boundingBox();
  const railBounds = await rail.boundingBox();
  expect(workspaceBounds).not.toBeNull();
  expect(nowBounds).not.toBeNull();
  expect(railBounds).not.toBeNull();
  expect(workspaceBounds!.width).toBeGreaterThanOrEqual(980);
  expect(nowBounds!.width).toBeGreaterThanOrEqual(680);
  expect(railBounds!.width).toBeGreaterThanOrEqual(300);
  expect(railBounds!.width).toBeLessThanOrEqual(308);
  await expect(main).toHaveScreenshot('calendar-home-today-command-wide-dark.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.002,
  });
});

test('calendar home retains a focused day flow at the tablet breakpoint', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium');
  await page.setViewportSize({ width: 768, height: 1024 });
  await prepareCalendarSurface(page, '/calendar/home', 'light');
  const workspace = page.getByTestId('calendar-today-workspace');
  await expect(workspace).toBeVisible();
  await expect(page.getByTestId('interactive-calendar')).toHaveCount(0);
  await expect(page.getByTestId('calendar-source-panel')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '오늘 브리핑 열기', exact: true })).toBeVisible();
  const bounds = await workspace.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(768);
  expect(bounds!.width).toBeGreaterThanOrEqual(440);
  const accessibility = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
});

test('calendar after-work home keeps past events visible without a stretched blank canvas', async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name === 'mobile';
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1920, height: 900 });
  await page.clock.setFixedTime(new Date('2026-08-11T09:30:00Z'));
  await page.emulateMedia({
    colorScheme: 'dark',
    forcedColors: 'none',
    reducedMotion: 'reduce',
  });
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'ko',
    permissions: FULL_PRODUCT_PERMISSIONS,
    appearance: {
      mode: 'system',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
  await page.route('**/api/platform/v1/calendar/home**', async (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          ...CALENDAR_HOME_FIXTURE,
          generatedAt: '2026-08-11T09:30:00Z',
          nextEvent: {
            ...CALENDAR_EVENT_FIXTURE,
            eventId: 'calendar-event-next-day-visual',
            title: '내일 운영 계획',
            startsAt: '2026-08-12T01:00:00Z',
            endsAt: '2026-08-12T01:45:00Z',
          },
        },
      }),
    })
  );
  await page.goto('/calendar/home');

  const main = page.locator('#dwp-main-content');
  const past = page.getByTestId('calendar-today-past-events');
  await expect(page.getByTestId('calendar-day-closeout')).toContainText(
    '오늘 남은 일정이 없습니다'
  );
  await expect(past).toHaveAttribute('open', '');
  await expect(past.getByText('Digital workplace operating review', { exact: true })).toBeVisible();
  await expect(past.getByText('Protected focus time', { exact: true })).toBeVisible();
  await expect(page.getByTestId('calendar-today-now').getByText('회의 참여')).toHaveCount(0);
  expect(
    await past
      .locator('[data-calendar-today-phase="ELAPSED"]')
      .evaluateAll((elements) => elements.map((element) => getComputedStyle(element).opacity))
  ).toEqual(['1', '1']);

  if (!mobile) {
    const flowBounds = await page.getByTestId('calendar-today-flow-surface').boundingBox();
    const railBounds = await page.getByTestId('calendar-workspace-rail').boundingBox();
    expect(flowBounds).not.toBeNull();
    expect(railBounds).not.toBeNull();
    expect(flowBounds!.height).toBeLessThan(railBounds!.height - 24);
    // The home rail now flows with the page rather than being clipped above the
    // fixed launcher. Verify its final real action can be scrolled clear and used.
    const lastAction = page.getByTestId('calendar-home-shortcuts').getByRole('button').last();
    await lastAction.scrollIntoViewIfNeeded();
    await lastAction.click({ trial: true });
    const actionBounds = await lastAction.boundingBox();
    const launcherBounds = await page.getByRole('button', { name: 'DWAI·ON 열기' }).boundingBox();
    expect(actionBounds).not.toBeNull();
    expect(launcherBounds).not.toBeNull();
    const overlapWidth = Math.max(
      0,
      Math.min(actionBounds!.x + actionBounds!.width, launcherBounds!.x + launcherBounds!.width) -
        Math.max(actionBounds!.x, launcherBounds!.x)
    );
    const overlapHeight = Math.max(
      0,
      Math.min(actionBounds!.y + actionBounds!.height, launcherBounds!.y + launcherBounds!.height) -
        Math.max(actionBounds!.y, launcherBounds!.y)
    );
    expect(overlapWidth * overlapHeight).toBe(0);
    await page.getByRole('heading', { level: 1 }).scrollIntoViewIfNeeded();
  }

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(horizontalOverflow).toBeLessThanOrEqual(1);
  const darkAccessibility = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
  expect(
    darkAccessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
  await expect(main).toHaveScreenshot('calendar-home-after-work-dark.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.002,
  });

  await page.emulateMedia({
    colorScheme: 'light',
    forcedColors: 'active',
    reducedMotion: 'reduce',
  });
  await page.reload();
  await expect(page.getByTestId('calendar-day-closeout')).toBeVisible();
  await expect(page.locator('.MuiSkeleton-root')).toHaveCount(0);
  const forcedAccessibility = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
  expect(
    forcedAccessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
  await expect(main).toHaveScreenshot('calendar-home-after-work-forced-colors.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.002,
  });
});

test('calendar mobile drawers and command palette preserve premium dark and forced-color states', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');
  await page.setViewportSize({ width: 390, height: 844 });
  await prepareCalendarSurface(page, '/calendar/home', 'dark');

  await page.getByRole('button', { name: '오늘 브리핑 열기', exact: true }).click();
  const rail = page.getByRole('dialog', { name: '확인할 일' });
  await expect(rail).toBeVisible();
  await expect
    .poll(async () => {
      const bounds = await rail.boundingBox();
      return bounds ? Math.round(bounds.x + bounds.width) : Number.POSITIVE_INFINITY;
    })
    .toBeLessThanOrEqual(390);
  const railAccessibility = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  expect(
    railAccessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
  await expect(rail).toHaveScreenshot('calendar-home-briefing-dark-mobile.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.002,
  });
  await rail.getByRole('button', { name: '오늘 브리핑 닫기', exact: true }).click();

  await page.getByRole('button', { name: '빠른 실행', exact: true }).click();
  const commands = page.getByRole('dialog', { name: '캘린더 빠른 실행' });
  await expect(commands).toBeVisible();
  await page.emulateMedia({
    colorScheme: 'dark',
    forcedColors: 'active',
    reducedMotion: 'reduce',
  });
  const commandAccessibility = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  expect(
    commandAccessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
  await expect(commands).toHaveScreenshot('calendar-home-command-forced-colors-mobile.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.002,
  });
});
