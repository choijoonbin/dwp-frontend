import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  mockWorkHubFoundation,
  WORK_HUB_FIXTURE as fixture,
} from './support/work-hub-foundation-fixtures';

import type { Page, TestInfo } from '@playwright/test';

const variants = [
  { name: '1440', width: 1440, height: 1000 },
  { name: '390', width: 390, height: 844 },
  { name: '320', width: 320, height: 740 },
  { name: 'zoom-200', width: 1280, height: 900, zoom: 2 },
  { name: 'dark-390', width: 390, height: 844, mode: 'dark' as const },
  { name: 'forced-colors-390', width: 390, height: 844, forcedColors: true },
];

async function openConfirmedBatchReport(page: Page) {
  await page.goto('/work/queue');
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Select work', exact: true }).click();
  await page
    .getByRole('checkbox', {
      name: `Select ${fixture.workspaceTitle} for batch processing`,
      exact: true,
    })
    .check();
  await page.getByRole('button', { name: 'Complete selected', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Complete the selected work?', exact: true })
    .getByRole('button', { name: 'Complete selected', exact: true })
    .click();
  const report = page.getByRole('dialog', { name: 'Batch results', exact: true });
  await expect(report).toBeVisible();
  return report;
}

async function captureR01(page: Page, info: TestInfo, name: string) {
  const report = page.getByRole('dialog', { name: 'Batch results', exact: true });
  const sourceTab = report.getByRole('tab', { name: /^Connected source status/u });
  const resultTab = report.getByRole('tab', { name: /^Batch result details/u });
  const overflow = await report.evaluate((element) => ({
    width: element.clientWidth,
    scrollWidth: element.scrollWidth,
    height: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.width + 1);
  await info.attach(`${name}-layout`, {
    body: JSON.stringify(overflow, null, 2),
    contentType: 'application/json',
  });
  await sourceTab.click();
  await expect(sourceTab).toHaveAttribute('aria-selected', 'true');
  await expect(report.getByRole('heading', { name: 'My connected work sources' })).toBeVisible();
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: false, animations: 'disabled' });
  await info.attach(name, { path, contentType: 'image/png' });
  await sourceTab.focus();
  await page.keyboard.press('ArrowRight');
  await expect(resultTab).toBeFocused();
  await expect(resultTab).toHaveAttribute('aria-selected', 'true');
  await report.getByTestId('work-hub-batch-report').scrollIntoViewIfNeeded();
  const resultPath = info.outputPath(`${name}-results.png`);
  await page.screenshot({ path: resultPath, fullPage: false, animations: 'disabled' });
  await info.attach(`${name}-results`, { path: resultPath, contentType: 'image/png' });
}

for (const variant of variants) {
  test(`WRK-R01 ${variant.name} keeps live sources and batch receipts in one keyboard-safe flow`, async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'chromium', 'R01 visual coverage runs once in Chromium.');
    test.setTimeout(90_000);
    await page.setViewportSize({ width: variant.width, height: variant.height });
    await page.emulateMedia({
      colorScheme: variant.mode ?? 'light',
      forcedColors: variant.forcedColors ? 'active' : 'none',
      reducedMotion: 'reduce',
    });
    const runtime = await mockWorkHubFoundation(page, {
      personal: false,
      sourceOwned: false,
      nativeWorkspace: true,
      mode: variant.mode,
      highContrast: variant.forcedColors,
    });
    if (variant.zoom) {
      await page.addInitScript((zoom) => {
        window.addEventListener('DOMContentLoaded', () => {
          document.documentElement.style.zoom = String(zoom);
        });
      }, variant.zoom);
    }

    const report = await openConfirmedBatchReport(page);
    await expect(report).toContainText('WRK-R01');
    await expect(report).toContainText('Source verification and batch results');
    const sourceTab = report.getByRole('tab', { name: /^Connected source status/u });
    const resultTab = report.getByRole('tab', { name: /^Batch result details/u });
    await expect(resultTab).toHaveAttribute('aria-selected', 'true');
    await expect(sourceTab).toHaveAttribute('aria-selected', 'false');
    await expect(report.getByTestId('work-hub-batch-report')).toBeVisible();
    await expect(report.getByText('1 selected', { exact: true })).toBeVisible();
    await expect(report.getByText('1 eligible', { exact: true })).toBeVisible();
    await expect(
      report.getByLabel('Batch receipt summary').getByText('Confirmed', { exact: true })
    ).toBeVisible();
    expect(runtime.batchMutations).toHaveLength(1);
    if (variant.name === '1440') {
      const accessibility = await new AxeBuilder({ page })
        .include('[role="dialog"]')
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();
      await info.attach('wrk-r01-accessibility', {
        body: JSON.stringify(accessibility.violations, null, 2),
        contentType: 'application/json',
      });
      expect(
        accessibility.violations.filter((violation) =>
          ['serious', 'critical'].includes(violation.impact ?? '')
        )
      ).toEqual([]);
    }
    await captureR01(page, info, `wrk-r01-${variant.name}`);

    const close = report.getByRole('button', { name: 'Close', exact: true });
    await close.focus();
    await expect(close).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(report).not.toBeVisible();
    await expect(
      page.getByRole('button', { name: 'View latest batch results', exact: true })
    ).toBeVisible();
  });
}

test('WRK-R01 preserves partial source failure and retries only the durable unconfirmed receipt', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'chromium', 'R01 recovery coverage runs once in Chromium.');
  await page.setViewportSize({ width: 390, height: 844 });
  const runtime = await mockWorkHubFoundation(page, {
    failServices: true,
    loseFirstMutationResponse: true,
  });
  await page.goto('/work/queue');
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Select work', exact: true }).click();
  await page
    .getByRole('checkbox', {
      name: `Select ${fixture.personalTitle} for batch processing`,
      exact: true,
    })
    .check();
  await page.getByRole('button', { name: 'Complete selected', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Complete the selected work?', exact: true })
    .getByRole('button', { name: 'Complete selected', exact: true })
    .click();

  const report = page.getByRole('dialog', { name: 'Batch results', exact: true });
  const sourceTab = report.getByRole('tab', { name: /^Connected source status/u });
  const resultTab = report.getByRole('tab', { name: /^Batch result details/u });
  const summary = report.getByLabel('Batch receipt summary');
  await expect(report).toContainText('Only some source responses verified');
  await sourceTab.click();
  const serviceSource = report
    .getByRole('list', { name: 'Latest response state by work source' })
    .getByRole('listitem')
    .filter({ hasText: 'Service requests' });
  await expect(serviceSource).toContainText('Unavailable');
  await sourceTab.focus();
  await page.keyboard.press('ArrowRight');
  await expect(resultTab).toBeFocused();
  await expect(resultTab).toHaveAttribute('aria-selected', 'true');
  await expect
    .poll(() => summary.locator('dd').allTextContents())
    .toEqual(['1', '1', '0', '0', '0', '1', '0']);
  const retry = report.getByRole('button', {
    name: 'Recheck unconfirmed personal tasks',
    exact: true,
  });
  await expect(retry).toBeEnabled();
  await captureR01(page, info, 'wrk-r01-partial-unknown');
  await retry.click();
  await expect
    .poll(() => summary.locator('dd').allTextContents())
    .toEqual(['1', '1', '1', '0', '0', '0', '0']);
  expect(runtime.mutations).toHaveLength(2);
  expect(runtime.mutations[1]?.idempotencyKey).toBe(runtime.mutations[0]?.idempotencyKey);
  await captureR01(page, info, 'wrk-r01-partial-recovered');
});
