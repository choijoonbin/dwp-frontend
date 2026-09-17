import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import {
  installWorkplaceSpacePlanningHarness,
  mockWorkplaceSpacePlanning,
  PLANNING_IDS,
} from './support/workplace-space-planning-fixtures';

import type { Locator, Page } from '@playwright/test';

function screenUrl(locale: 'en' | 'ko' = 'en') {
  const params = new URLSearchParams({
    locale,
    site: PLANNING_IDS.site,
    neighborhood: 'North',
    type: 'DESK',
    from: '2026-09-17',
    to: '2026-09-30',
  });
  return `/__screen22_space_planning?${params.toString()}`;
}

async function openPlanning(page: Page, locale: 'en' | 'ko' = 'en') {
  await page.goto(screenUrl(locale));
  await expect(
    page.getByRole('heading', { name: locale === 'en' ? 'Space planning' : '공간 계획' })
  ).toBeVisible();
  await expect(page.getByTestId('space-planning-scenario-editor')).toBeVisible();
}

async function expectNoOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
    )
  ).toBe(true);
}

async function focusByKeyboard(page: Page, target: Locator) {
  for (let index = 0; index < 100; index += 1) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((element) => element === document.activeElement)) return;
  }
  throw new Error('Keyboard focus did not reach the planning control.');
}

test.beforeEach(async ({ page }) => {
  await installWorkplaceSpacePlanningHarness(page);
});

test('renders exact all-floor resources, site-zone evidence and fail-closed preview at 1440', async ({
  page,
}) => {
  const evidence = await mockWorkplaceSpacePlanning(page);
  await page.setViewportSize({ width: 1440, height: 960 });
  await openPlanning(page);

  await expect(page.getByText('Forecast recommendation is suppressed.')).toBeVisible();
  await expect(page.getByTestId('space-planning-forecast-chart')).toHaveCount(0);
  await expect(page.getByText(/Site time zone: Asia\/Seoul/u).first()).toBeVisible();
  await expect(page.getByText(/Sep 18, 2026/u).first()).toBeVisible();

  await expect(page.getByRole('checkbox', { name: /North desk A · N-A · DESK/u })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /North desk B · N-B · DESK/u })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /South desk/u })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: /North room/u })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: /Retired north desk/u })).toHaveCount(0);
  expect(new Set(evidence.resourceFloorRequests)).toEqual(
    new Set([PLANNING_IDS.floorA, PLANNING_IDS.floorB])
  );

  const editor = page.getByTestId('space-planning-scenario-editor');
  await expect(editor).toHaveAttribute('data-resource-catalog-status', 'ready');
  await expect(editor).toHaveAttribute('data-preview-submit-ready', 'false');
  await expect(
    editor.getByText('Create a current, eligible preview before submitting.')
  ).toBeVisible();
  await expect(page.getByTestId('space-planning-submit')).toBeDisabled();

  const apply = page.getByRole('button', { name: 'Apply scope' });
  await focusByKeyboard(page, apply);
  await expect(apply).toBeFocused();
  await expectNoOverflow(page);
  const axe = await new AxeBuilder({ page }).include('#root').analyze();
  expect(
    axe.violations.filter((issue) => ['serious', 'critical'].includes(issue.impact ?? '')),
    JSON.stringify(axe.violations)
  ).toEqual([]);
});

test('removes stale actionable evidence during a delayed scope switch', async ({ page }) => {
  const evidence = await mockWorkplaceSpacePlanning(page, { roomOverviewDelayMs: 1_500 });
  await page.setViewportSize({ width: 1280, height: 900 });
  await openPlanning(page);
  await expect(page.getByText('North desk plan')).toBeVisible();

  await page.getByRole('combobox', { name: 'Resource type' }).click();
  await page.getByRole('option', { name: 'Room' }).click();
  const apply = page.getByRole('button', { name: 'Apply scope' });
  const applyClick = apply.click();
  await evidence.roomOverviewStarted;
  try {
    await expect(page.getByRole('status', { name: 'Loading planning evidence…' })).toBeVisible();
    await expect(page.getByText('North desk plan')).toHaveCount(0);
    await expect(page.getByTestId('space-planning-scenario-editor')).toHaveCount(0);
  } finally {
    evidence.releaseRoomOverview();
    await applyClick;
  }

  await expect(page.getByText('North room plan')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /North room · R-B · ROOM/u })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /North desk/u })).toHaveCount(0);
});

test('requeries RESULT_UNKNOWN then replays the byte-equivalent intent and hides stale impact', async ({
  page,
}) => {
  const evidence = await mockWorkplaceSpacePlanning(page);
  await page.setViewportSize({ width: 1440, height: 960 });
  await openPlanning(page);
  await page.getByRole('textbox', { name: 'Change reason' }).fill('Verify booking impact safely');
  await page.getByRole('checkbox', { name: 'I confirm this governed change' }).check();
  const impactButton = page.getByRole('button', { name: 'Preview booking impact' });
  await expect(impactButton).toBeEnabled();
  const unknownResponse = page.waitForResponse((response) =>
    response.url().includes('/booking-impact:preview')
  );
  await impactButton.click();
  await unknownResponse;

  const receipt = page.getByTestId('space-planning-command-receipt');
  await expect(receipt).toContainText('RESULT_UNKNOWN', { timeout: 10_000 });
  await expect(page.getByTestId('space-planning-booking-impact')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Apply scope' })).toBeDisabled();
  await page.getByRole('button', { name: 'Re-query status' }).click();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await page.getByRole('button', { name: 'Try again' }).click();

  await expect(page.getByTestId('space-planning-booking-impact')).toBeVisible();
  await expect(receipt).toContainText('SUCCEEDED · PENDING');
  await expect(page.getByTestId('space-planning-booking-impact')).toContainText('8:00 AM');
  await expect(page.getByTestId('space-planning-booking-impact')).toContainText('9:00 AM');
  await expect(page.getByTestId('space-planning-booking-impact')).toContainText('Asia/Seoul');
  expect(evidence.commandKeys).toHaveLength(2);
  expect(evidence.commandKeys[0]).toBeTruthy();
  expect(evidence.commandKeys[1]).toBe(evidence.commandKeys[0]);
  expect(evidence.commandBodies[1]).toEqual(evidence.commandBodies[0]);

  evidence.setScenarioVersion(3);
  await page.getByRole('button', { name: 'Refresh planning data' }).click();
  await expect(page.getByTestId('space-planning-booking-impact')).toHaveCount(0);

  evidence.failNextMutation();
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(
    page.getByText(
      'The scenario changed before this command completed. Refresh authoritative state before retrying.'
    )
  ).toBeVisible();
  await expect(page.getByText(/workplace\.spacePlanning\.states\.command/u)).toHaveCount(0);
});

test('uses the authoritative command response while the overview requery is delayed', async ({
  page,
}) => {
  const evidence = await mockWorkplaceSpacePlanning(page, {
    postCommandOverviewDelayMs: 1_500,
  });
  await page.setViewportSize({ width: 1440, height: 960 });
  await openPlanning(page);

  await page.getByRole('textbox', { name: 'Change reason' }).fill('Create fresh governed preview');
  await page.getByRole('checkbox', { name: 'I confirm this governed change' }).check();
  const previewResponse = page.waitForResponse((response) =>
    response.url().endsWith(`${PLANNING_IDS.scenario}:preview`)
  );
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await previewResponse;

  await expect(page.getByText('Version 3')).toBeVisible();
  await page.getByRole('textbox', { name: 'Change reason' }).fill('Check updated version impact');
  await page.getByRole('checkbox', { name: 'I confirm this governed change' }).check();
  const impactResponse = page.waitForResponse((response) =>
    response.url().includes('/booking-impact:preview')
  );
  await page.getByRole('button', { name: 'Preview booking impact' }).click();
  await impactResponse;

  expect(evidence.commandBodies).toHaveLength(2);
  expect(evidence.commandBodies[0]).toMatchObject({ expectedVersion: 2 });
  expect(evidence.commandBodies[1]).toMatchObject({ expectedVersion: 3 });
});

test('previews, confirms, receipts and downloads a verified aggregate board report', async ({
  page,
}) => {
  const evidence = await mockWorkplaceSpacePlanning(page);
  await page.setViewportSize({ width: 1440, height: 960 });
  await openPlanning(page);

  const report = page.getByTestId('space-planning-board-report');
  await expect(report).toBeVisible();
  await report
    .getByRole('textbox', { name: 'Export reason' })
    .fill('Quarterly board review of aggregate capacity and demand');
  await report.getByRole('button', { name: 'Preview board report' }).click();
  const preview = page.getByTestId('space-planning-board-report-preview');
  await expect(preview).toContainText('40 → 44');
  await expect(preview).toContainText('aggregate operational metrics only');

  await report
    .getByRole('checkbox', {
      name: 'I reviewed this aggregate snapshot and confirm the governed export.',
    })
    .check();
  await report.getByRole('button', { name: 'Create board report' }).click();
  const receipt = page.getByTestId('space-planning-board-report-receipt');
  await expect(receipt).toContainText('SUCCEEDED');
  await expect(receipt).toContainText('workplace-space-planning-board-report-22000000.pdf');

  await receipt.getByRole('button', { name: 'Refresh receipt' }).click();
  await expect.poll(() => evidence.reportRequests).toContain('receipt');
  const contentResponse = page.waitForResponse((response) =>
    response.url().includes(`/space-planning/reports/${PLANNING_IDS.reportCommand}/content`)
  );
  await receipt.getByRole('button', { name: 'Download verified report' }).click();
  await contentResponse;

  expect(evidence.reportRequests).toEqual(['preview', 'execute', 'receipt', 'content']);
  expect(evidence.commandBodies[0]).toMatchObject({
    scenarioId: PLANNING_IDS.scenario,
    expectedScenarioVersion: 2,
    format: 'PDF',
    reason: 'Quarterly board review of aggregate capacity and demand',
  });
  expect(evidence.commandBodies[1]).toMatchObject({
    previewId: PLANNING_IDS.reportPreview,
    expectedPreviewVersion: 1,
    expectedScenarioVersion: 2,
    explicitConfirmation: true,
  });
  expect(evidence.reportHeaders[1]?.['x-dwp-active-access-mode']).toBe('ELEVATED');
  expect(evidence.reportHeaders[1]?.['x-dwp-expected-decision-revision']).toMatch(/^psr-/u);
  expect(evidence.reportHeaders[3]?.accept).toBe('application/pdf');
});

test('fails closed when board-report export permission is absent', async ({ page }) => {
  await mockWorkplaceSpacePlanning(page, { denyReportExport: true });
  await openPlanning(page);
  const denied = page.getByTestId('space-planning-board-report');
  await expect(denied).toContainText('ADMIN.WORKPLACE:EXPORT permission is required');
  await expect(denied.getByRole('button', { name: 'Preview board report' })).toBeDisabled();
});

test('fails closed when the source planning preview expired', async ({ page }) => {
  await mockWorkplaceSpacePlanning(page, { expiredScenarioPreview: true });
  await openPlanning(page);
  const expired = page.getByTestId('space-planning-board-report');
  await expect(expired).toContainText('Create a current scenario preview');
  await expect(expired.getByRole('button', { name: 'Preview board report' })).toBeDisabled();
});

test('keeps a report preview service failure visible and non-actionable', async ({ page }) => {
  await mockWorkplaceSpacePlanning(page, { failReportPreview: true });
  await openPlanning(page);
  const failed = page.getByTestId('space-planning-board-report');
  await failed.getByRole('textbox', { name: 'Export reason' }).fill('Verify failure handling');
  await failed.getByRole('button', { name: 'Preview board report' }).click();
  await expect(failed).toContainText('authoritative report service is temporarily unavailable');
  await expect(failed.getByRole('button', { name: 'Create board report' })).toHaveCount(0);
});

test('keeps Korean mobile layouts usable at 390 and 320 pixels with high contrast', async ({
  page,
}) => {
  await mockWorkplaceSpacePlanning(page);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 860 });
    await page.emulateMedia({ forcedColors: width === 320 ? 'active' : 'none' });
    await openPlanning(page, 'ko');
    await expect(page.getByText('예측 권고가 제한되었습니다.')).toBeVisible();
    await expect(page.getByRole('button', { name: '승인 요청' })).toBeDisabled();
    await expectNoOverflow(page);
  }
});

test('fails closed when any floor resource catalog request fails', async ({ page }) => {
  await mockWorkplaceSpacePlanning(page, { failResourceCatalog: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await openPlanning(page);
  const editor = page.getByTestId('space-planning-scenario-editor');
  await expect(editor).toHaveAttribute('data-resource-catalog-status', 'error');
  await expect(
    page.getByText('The authoritative resource catalog could not be loaded.')
  ).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /North desk/u })).toHaveCount(0);
});
