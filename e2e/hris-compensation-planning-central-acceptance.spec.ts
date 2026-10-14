import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import {
  COMPPLAN_CENTRAL_ROUTE,
  prepareCompensationPlanningCentralAcceptance,
  type CompensationPlanningCentralRequestLog,
  type CompensationPlanningCentralScenario,
} from './support/hris-compensation-planning-central-fixtures';

const workspaceSelector = `main[data-route="${COMPPLAN_CENTRAL_ROUTE}"]`;
const screenshotOptions = {
  animations: 'disabled' as const,
  caret: 'hide' as const,
};

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.scrollWidth, label).toBeLessThanOrEqual(geometry.clientWidth + 1);
}

async function expectAccessible(page: Page, includeDialog = false) {
  let builder = new AxeBuilder({ page }).include(workspaceSelector);
  if (includeDialog) builder = builder.include('[role="dialog"]');
  const result = await builder.analyze();
  expect(
    result.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
}

async function openScenario(
  page: Page,
  scenario: CompensationPlanningCentralScenario,
  locale: 'en' | 'ko' = 'en'
): Promise<CompensationPlanningCentralRequestLog> {
  const log = await prepareCompensationPlanningCentralAcceptance(page, scenario, locale);
  await page.goto(COMPPLAN_CENTRAL_ROUTE, { waitUntil: 'domcontentloaded' });
  await expect(page.locator(workspaceSelector)).toBeVisible();
  await expect(page.getByText('SYNTH-FY27', { exact: true }).first()).toBeVisible();
  // React/query scope stabilization may replay an idempotent read. The allow-list below is the
  // contract: every required owner route must be observed, and no other compensation route may run.
  await expect.poll(() => log.cycles).toBeGreaterThanOrEqual(1);
  await expect.poll(() => log.cycleDetail).toBeGreaterThanOrEqual(1);
  await expect.poll(() => log.proposals).toBeGreaterThanOrEqual(1);
  expect(log.unexpectedCompensationRequests).toEqual([]);
  expect(log.externalRequests).toEqual([]);
  return log;
}

test.describe.configure({ mode: 'serial' });

test('1440 light route is keyboard reachable and uses only synthetic owner reads', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
  const log = await openScenario(page, 'PROPOSAL_REVIEW');

  const search = page.getByLabel('Filter cycles or proposals', { exact: true });
  await search.focus();
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus-visible').first()).toBeVisible();
  await expectNoHorizontalOverflow(page, '1440 light compensation route must not overflow');
  await expectAccessible(page);
  expect(log.proposalDetail).toBe(0);
  await expect(page).toHaveScreenshot('1440-light-keyboard.png', screenshotOptions);
});

test('masked detail keeps budget and typed fields out of the browser projection', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openScenario(page, 'MASKED_DETAIL');

  const workspace = page.locator(workspaceSelector);
  await expect(workspace.getByText('Field policy restricted', { exact: true })).toBeVisible();
  await expect(workspace.getByText('50000000', { exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page, 'masked compensation detail must not overflow');
  await expectAccessible(page);
});

test('1280 dark route preserves the approval review at 200 percent zoom', async ({ browser }) => {
  // 640 CSS px rendered at 2 device pixels models a 1280 px display at 200% browser zoom. Unlike
  // a root-font override, this exercises the responsive breakpoints users actually receive.
  const context = await browser.newContext({
    viewport: { width: 640, height: 720 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  try {
    await openScenario(page, 'PROPOSAL_REVIEW');

    const workspace = page.locator(workspaceSelector);
    const approve = workspace.getByRole('button', { name: 'Approve plan', exact: true });
    await expect(approve).toBeEnabled();
    await approve.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Impact preview', { exact: true })).toBeVisible();
    await page.getByLabel('Approval reason code', { exact: false }).focus();
    await expectNoHorizontalOverflow(
      page,
      '1280 dark 200% zoom compensation route must not overflow'
    );
    await expectAccessible(page, true);
    await expect(page).toHaveScreenshot('1280-dark-zoom-200-approve.png', {
      ...screenshotOptions,
      scale: 'device',
    });
  } finally {
    await context.close();
  }
});

test('390 Korean reduced-motion route preserves immutable publish review', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await openScenario(page, 'APPROVED', 'ko');

  const workspace = page.locator(workspaceSelector);
  const publish = workspace.getByRole('button', { name: '스냅샷 게시', exact: true });
  await expect(publish).toBeEnabled();
  await publish.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('영향 미리보기', { exact: true })).toBeVisible();
  await page.getByLabel('승인 영수증 ID', { exact: false }).focus();
  await expectNoHorizontalOverflow(page, '390 Korean publish review must not overflow');
  await expectAccessible(page, true);
  await expect(page).toHaveScreenshot('390-ko-reduced-motion-publish.png', screenshotOptions);
});

test('320 forced-colors keeps cycle and budget context when proposals fail', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.emulateMedia({
    colorScheme: 'light',
    forcedColors: 'active',
    reducedMotion: 'reduce',
  });
  await openScenario(page, 'PROPOSALS_UNAVAILABLE');

  await expect(page.getByText('Proposal panel unavailable', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Cycle and budget context remain available.', { exact: false })
  ).toBeVisible();
  await expect(
    page.locator(workspaceSelector).getByText('50000000', { exact: true }).last()
  ).toBeVisible();
  await expectNoHorizontalOverflow(page, '320 forced-colors partial state must not overflow');
  await expectAccessible(page);
  await expect(page).toHaveScreenshot('320-forced-colors-partial.png', {
    ...screenshotOptions,
    fullPage: true,
  });
});
