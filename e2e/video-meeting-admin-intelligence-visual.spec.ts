import { expect, test } from '@playwright/test';

import {
  expectNoBlockingA11y,
  expectNoHorizontalOverflow,
} from './support/video-meeting-visual-accessibility';
import {
  mockMeetingVisualAdminReadiness,
  mockMeetingVisualSession,
} from './support/video-meeting-visual-fixtures';
import { MEETING_APPROVED_FRAMES } from './support/meeting-approved-frame-contract';
import { emulateVisualTransparency } from './support/visual-media';

import type { Page } from '@playwright/test';

const runtimeDiagnostics = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  await emulateVisualTransparency(page);
  const diagnostics: string[] = [];
  runtimeDiagnostics.set(page, diagnostics);
  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error' || /\[i18n\]\s+Missing key:/u.test(text)) {
      diagnostics.push(`${message.type()}: ${text}`);
    }
  });
  page.on('pageerror', (error) => diagnostics.push(`pageerror: ${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 500) diagnostics.push(`http ${response.status()}: ${response.url()}`);
  });
});

async function expectPageReady(page: Page) {
  await expect(
    page.getByRole('progressbar', { name: /Loading page|페이지 불러오는 중/u })
  ).toHaveCount(0, { timeout: 15_000 });
  const main = page.locator('#dwp-main-content');
  await expect(main).toBeVisible({ timeout: 15_000 });
  await expect(main.locator('.MuiSkeleton-root')).toHaveCount(0, { timeout: 15_000 });
}

async function expectCleanRuntime(page: Page, label: string) {
  expect(runtimeDiagnostics.get(page) ?? [], `${label}: runtime diagnostics`).toEqual([]);
  await expect(page.locator('body')).not.toContainText(/\b(?:admin|meeting)\.[a-z][\w.-]*/u);
}

async function expectSnapshot(page: Page, name: string) {
  await page.evaluate(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.querySelector<HTMLElement>('#dwp-main-content')?.scrollTo({
      top: 0,
      left: 0,
      behavior: 'auto',
    });
  });
  await expect(page).toHaveScreenshot(name, {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixelRatio: 0.002,
    timeout: 15_000,
  });
}

test('blocked AI administration makes every release dependency legible at 1440px Korean', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'The 1440px baseline uses the desktop project.');
  await page.setViewportSize({ width: 1_440, height: 960 });
  await mockMeetingVisualSession(page, { locale: 'ko', admin: true, reducedMotion: true });
  await mockMeetingVisualAdminReadiness(page, 'BLOCKED');

  await page.goto('/meetings/admin/intelligence');
  await expect(
    page.getByRole('heading', { level: 1, name: 'AI 및 데이터 거버넌스' })
  ).toBeVisible();
  await expectPageReady(page);
  await expect(page.getByText('차단됨', { exact: true }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page, 'admin BLOCKED 1440 ko');
  await expectNoBlockingA11y(page, 'admin BLOCKED 1440 ko');
  await expectCleanRuntime(page, 'admin BLOCKED 1440 ko');
  await expectSnapshot(page, 'meeting-admin-intelligence-blocked-ko-1440-light.png');
});

test('blocked AI administration preserves the approved mobile hierarchy at 390px Korean light mode', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium',
    'The canonical 390px whole-document baseline uses the Chromium project.'
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await mockMeetingVisualSession(page, {
    locale: 'ko',
    admin: true,
    colorScheme: 'light',
    reducedMotion: true,
  });
  await mockMeetingVisualAdminReadiness(page, 'BLOCKED');

  await page.goto('/meetings/admin/intelligence');
  await expect(
    page.getByRole('heading', { level: 1, name: 'AI 및 데이터 거버넌스' })
  ).toBeVisible();
  await expectPageReady(page);
  await expect(page.getByText('차단됨', { exact: true }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page, 'admin BLOCKED 390 ko light');
  await expectNoBlockingA11y(page, 'admin BLOCKED 390 ko light');
  await expectCleanRuntime(page, 'admin BLOCKED 390 ko light');
  const approvedFrame = MEETING_APPROVED_FRAMES.find(({ id }) => id === 'U15-M');
  expect(approvedFrame, 'U15-M exact runtime contract').toBeDefined();
  if (!approvedFrame) return;
  expect(approvedFrame.implementationGolden.captureClass).toBe('FULL_DOCUMENT');
  const landmarkTops: number[] = [];
  for (const selector of approvedFrame.implementationGolden.orderedLandmarks) {
    const landmark = page.locator(selector).first();
    await expect(landmark, `U15-M: ${selector} must be visible`).toBeVisible();
    const box = await landmark.boundingBox();
    expect(box, `U15-M: ${selector} must own layout geometry`).not.toBeNull();
    landmarkTops.push(box?.y ?? Number.NEGATIVE_INFINITY);
  }
  for (let index = 1; index < landmarkTops.length; index += 1) {
    expect(
      landmarkTops[index],
      'U15-M landmarks must preserve their vertical order'
    ).toBeGreaterThanOrEqual(landmarkTops[index - 1] - 1);
  }
  const documentHeight = await page.evaluate(() =>
    Math.ceil(Math.max(document.documentElement.scrollHeight, document.body.scrollHeight))
  );
  expect(documentHeight).toBe(approvedFrame.implementationGolden.expectedRasterHeight);
  const lastContent = page
    .locator(approvedFrame.implementationGolden.clearance.lastContentSelector)
    .last();
  await expect(lastContent).toBeVisible();
  const lastContentBox = await lastContent.boundingBox();
  expect(lastContentBox).not.toBeNull();
  const trailingGap = documentHeight - ((lastContentBox?.y ?? 0) + (lastContentBox?.height ?? 0));
  expect(trailingGap).toBeGreaterThanOrEqual(-1);
  expect(trailingGap).toBeLessThanOrEqual(
    approvedFrame.implementationGolden.clearance.maxTrailingGapPx
  );
  await expectSnapshot(page, approvedFrame.implementationGolden.screenshotName);
});

test('ready AI administration stays readable at 390px English dark mode', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium',
    'The approved baseline uses the Chromium project.'
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await mockMeetingVisualSession(page, {
    locale: 'en',
    admin: true,
    colorScheme: 'dark',
    reducedMotion: true,
  });
  await mockMeetingVisualAdminReadiness(page, 'READY');

  await page.goto('/meetings/admin/intelligence');
  await expect(
    page.getByRole('heading', { level: 1, name: 'AI and data governance' })
  ).toBeVisible();
  await expectPageReady(page);
  await expect(page.locator('[data-state="BLOCKED"]')).toHaveCount(0);
  const details = page.getByTestId('meeting-intelligence-mobile-details');
  await expect(details).not.toHaveAttribute('open', '');
  const detailsSummary = details.locator('summary');
  await detailsSummary.focus();
  await expect(detailsSummary).toBeFocused();
  await detailsSummary.press('Enter');
  await expect(details).toHaveAttribute('open', '');
  await expect(details.locator('[data-state="READY"]').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Processing dependencies' })).toBeVisible();
  await detailsSummary.press('Enter');
  await expect(details).not.toHaveAttribute('open', '');
  await expectNoHorizontalOverflow(page, 'admin READY 390 en dark');
  await expectNoBlockingA11y(page, 'admin READY 390 en dark');
  await expectCleanRuntime(page, 'admin READY 390 en dark');
  await expectSnapshot(page, 'meeting-admin-intelligence-ready-en-390-dark.png');

  await page.setViewportSize({ width: 320, height: 720 });
  await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
  await expectNoHorizontalOverflow(page, 'admin READY 320 en dark at 200 percent text');
  await expectNoBlockingA11y(page, 'admin READY 320 en dark at 200 percent text');
  await expectCleanRuntime(page, 'admin READY 320 en dark at 200 percent text');
});
