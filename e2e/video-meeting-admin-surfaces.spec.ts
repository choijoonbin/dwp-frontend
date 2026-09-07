import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import {
  mockMeetingVisualAdminReadiness,
  mockMeetingVisualSession,
} from './support/video-meeting-visual-fixtures';

import type { Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

function success(data: unknown) {
  return JSON.stringify({ status: 'SUCCESS', message: 'OK', success: true, data });
}

async function mockOperations(page: Page) {
  await page.route('**/api/meetings/v1/admin/overview?*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: success({
        liveMeetings: 2,
        scheduledToday: 7,
        waitingParticipants: 3,
        meetingsLastSevenDays: 42,
        averageQualityScore: null,
        failedJoinAttempts: 4,
        capabilities: {
          video: true,
          screenShare: true,
          chat: true,
          captions: false,
          recordingConfigured: false,
          transcriptConfigured: false,
          aiNotesConfigured: false,
        },
      }),
    })
  );
}

async function expectResponsiveAndAccessible(page: Page, label: string) {
  const overflow = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    main:
      (document.querySelector<HTMLElement>('#dwp-main-content')?.scrollWidth ?? 0) -
      (document.querySelector<HTMLElement>('#dwp-main-content')?.clientWidth ?? 0),
  }));
  expect(overflow.page, `${label}: page overflow`).toBeLessThanOrEqual(1);
  expect(overflow.main, `${label}: main overflow`).toBeLessThanOrEqual(1);
  const results = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
  expect(
    results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    ),
    `${label}: blocking accessibility violations`
  ).toEqual([]);
}

async function expectFluidWorkspace(page: Page, expectedGutter: number) {
  const canvas = page.locator('[data-dwp-page-canvas="workspace"]').first();
  await expect(canvas).toBeVisible();
  const layout = await canvas.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      left: Number.parseFloat(style.paddingLeft),
      right: Number.parseFloat(style.paddingRight),
      maxWidth: style.maxWidth,
    };
  });
  expect(layout.left).toBe(expectedGutter);
  expect(layout.right).toBe(expectedGutter);
  expect(layout.maxWidth).toBe('none');
}

test('U13 presents user impact, provider readiness, and a content-free exception inspector on desktop and mobile', async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name === 'mobile';
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1_440, height: 960 });
  await mockMeetingVisualSession(page, { locale: 'en', admin: true, reducedMotion: true });
  await mockMeetingVisualAdminReadiness(page, 'BLOCKED');
  await mockOperations(page);

  await page.goto('/meetings/admin/operations');
  await expect(page.getByRole('heading', { level: 1, name: 'Meeting operations' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'User impact' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Service readiness' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Exceptions and next action' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Selected diagnostic' })).toBeVisible();
  const serviceReadiness = page.getByRole('region', { name: 'Service readiness' });
  await expect(serviceReadiness.getByText('Recording processing')).toBeVisible();
  await expect(serviceReadiness.getByText('AI analysis')).toBeVisible();
  await expect(page.getByText('Quality telemetry not configured')).toBeVisible();
  if (mobile) {
    const columns = await page
      .getByTestId('meeting-admin-impact-primary')
      .evaluate((element) =>
        getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean)
      );
    expect(columns).toHaveLength(2);
    const readinessTop = await page
      .getByTestId('meeting-admin-service-readiness')
      .evaluate((element) => element.getBoundingClientRect().top);
    expect(readinessTop).toBeLessThan(844);
  }
  await expectFluidWorkspace(page, mobile ? 16 : 24);
  await expectResponsiveAndAccessible(page, `U13 ${mobile ? 'mobile' : 'desktop'}`);
  await expect(page).toHaveScreenshot(
    `meeting-u13-operations-${mobile ? 'mobile' : 'desktop'}.png`,
    {
      animations: 'disabled',
      caret: 'hide',
      fullPage: true,
      maxDiffPixelRatio: 0.002,
    }
  );
  if (mobile) {
    await page.setViewportSize({ width: 320, height: 720 });
    await expectResponsiveAndAccessible(page, 'U13 mobile 320');
    await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
    await expectResponsiveAndAccessible(page, 'U13 mobile 320 at 200 percent text');
  }
});

test('U14 keeps the versioned policy workflow, impact boundary, and unavailable controls legible on desktop and mobile', async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name === 'mobile';
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1_440, height: 960 });
  await mockMeetingVisualSession(page, { locale: 'en', admin: true, reducedMotion: true });
  await mockMeetingVisualAdminReadiness(page, 'BLOCKED');

  await page.goto('/meetings/admin/policies');
  await expect(page.getByRole('heading', { level: 1, name: 'Meeting policy' })).toBeVisible();
  for (const section of [
    'Access and lobby',
    'In-meeting collaboration',
    'Recording and AI',
    'Retention policy',
    'Capacity and limits',
  ]) {
    await expect(page.getByRole('region', { name: section })).toBeVisible();
  }
  await expect(page.getByRole('complementary', { name: 'Review change impact' })).toBeVisible();
  await expect(page.getByText('Current policy version 8')).toBeVisible();
  await expect(page.getByText(/does not report affected-user counts/u)).toBeVisible();
  await expect(page.getByText(/override API is available/u)).toBeVisible();
  await expect(page.getByText(/audit-list API is not available/u)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save policy' })).toBeDisabled();
  if (mobile) {
    const impact = page.getByRole('complementary', { name: 'Review change impact' });
    const access = page.getByRole('region', { name: 'Access and lobby' });
    await expect(access).not.toHaveAttribute('open', '');
    const [impactTop, accessTop] = await Promise.all([
      impact.evaluate((element) => element.getBoundingClientRect().top),
      access.evaluate((element) => element.getBoundingClientRect().top),
    ]);
    expect(impactTop).toBeLessThan(accessTop);
    const summary = access.locator('summary');
    expect((await summary.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  await expectFluidWorkspace(page, mobile ? 16 : 24);
  await expectResponsiveAndAccessible(page, `U14 ${mobile ? 'mobile' : 'desktop'}`);
  await expect(page).toHaveScreenshot(`meeting-u14-policy-${mobile ? 'mobile' : 'desktop'}.png`, {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixelRatio: 0.002,
  });
  if (mobile) {
    const access = page.getByRole('region', { name: 'Access and lobby' });
    await access.locator('summary').click();
    await expect(access).toHaveAttribute('open', '');
    await page.getByRole('switch', { name: 'Enable video meetings' }).click();
    await expect(page.getByRole('button', { name: 'Save policy' })).toBeEnabled();
    await page.setViewportSize({ width: 320, height: 720 });
    await expectResponsiveAndAccessible(page, 'U14 mobile 320');
    await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
    await expectResponsiveAndAccessible(page, 'U14 mobile 320 at 200 percent text');
  }
});
