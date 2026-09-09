import { expect, test, type Page } from '@playwright/test';
import {
  DWAION_PERSONAL_PERMISSIONS,
  mockDwaionPersonalIntelligence,
} from './support/dwaion-personal-intelligence-fixtures';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

const ERROR = 'The deletion request was accepted, but its latest status could not be verified.';
async function setup(page: Page) {
  await page.clock.setFixedTime(new Date('2026-09-04T00:05:00Z'));
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    permissions: [...FULL_PRODUCT_PERMISSIONS, ...DWAION_PERSONAL_PERMISSIONS],
  });
  return mockDwaionPersonalIntelligence(page, { deletionExecutionAvailable: true });
}
async function requestDeletion(page: Page) {
  await page.goto('/dwaion/personal-controls');
  await page.getByRole('button', { name: 'Clean up data', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Clean up personal AI data' });
  await dialog.getByRole('checkbox', { name: 'Explicit memories' }).check();
  await dialog.getByRole('button', { name: 'Submit request' }).click();
  return dialog;
}

test('missing governance fields remain unknown instead of five verified blocked boundaries', async ({
  page,
}, info) => {
  await setup(page);
  await page.route('**/api/agent/v1/ai-controls', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          memoryState: 'UNSET',
          revision: 1,
          memoryEnabled: false,
          memoryEffective: false,
          explicitMemoryStorageAvailable: true,
          runtimeApplicationState: 'UNSET',
          runtimeApplicationEnabled: false,
          runtimeApplicationAvailable: false,
          sourcePreferences: [],
        },
      },
    })
  );
  await page.goto('/dwaion/personal-controls');
  const panel = page.locator('section[aria-labelledby="dwaion-governance-evidence-title"]');
  await expect(panel.getByText('Not verified', { exact: true })).toHaveCount(5);
  await expect(panel.getByText('Blocked', { exact: true })).toHaveCount(0);
  await expect(panel.locator('.MuiChip-colorSuccess')).toHaveCount(0);
  await page.screenshot({
    path: info.outputPath('personal-security-evidence-unknown.png'),
    fullPage: true,
  });
});

test('first deletion status failures recover by polling from the accepted receipt', async ({
  page,
}) => {
  const probe = await setup(page);
  let reads = 0;
  await page.route('**/api/agent/v1/personal-data/deletions/*', (route) => {
    reads += 1;
    if (reads <= 2)
      return route.fulfill({ status: 503, json: { detail: 'Status temporarily unavailable.' } });
    return route.fallback();
  });
  const dialog = await requestDeletion(page);
  await expect(dialog.getByText(ERROR, { exact: false })).toBeVisible();
  await expect(dialog.getByText('Completed', { exact: true })).toHaveCount(0);
  await expect.poll(() => probe.deletionStatusReads, { timeout: 10_000 }).toBeGreaterThanOrEqual(2);
  await expect(dialog.getByText('Completed', { exact: true })).toBeVisible();
  await expect(dialog.getByText(ERROR, { exact: false })).toHaveCount(0);
});

test('retry explicitly refreshes deletion status without waiting for the next polling tick', async ({
  page,
}, info) => {
  await setup(page);
  await page.clock.install({ time: new Date('2026-09-04T00:05:00Z') });
  let fail = true;
  let reads = 0;
  await page.route('**/api/agent/v1/personal-data/deletions/*', (route) => {
    reads += 1;
    if (fail)
      return route.fulfill({ status: 503, json: { detail: 'Status temporarily unavailable.' } });
    return route.fallback();
  });
  const dialog = await requestDeletion(page);
  await expect.poll(() => reads).toBe(1);
  await page.clock.runFor(1_100);
  await expect(dialog.getByText(ERROR, { exact: false })).toBeVisible();
  await page.screenshot({
    path: info.outputPath('personal-deletion-status-retry.png'),
    fullPage: true,
  });
  const beforeRetry = reads;
  fail = false;
  await dialog.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect.poll(() => reads).toBeGreaterThan(beforeRetry);
  await expect(dialog.getByText(ERROR, { exact: false })).toHaveCount(0);
});
