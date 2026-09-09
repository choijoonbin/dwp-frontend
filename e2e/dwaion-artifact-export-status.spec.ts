import { expect, test, type Page } from '@playwright/test';
import {
  DWAION_PERSONAL_PERMISSIONS,
  mockDwaionPersonalIntelligence,
} from './support/dwaion-personal-intelligence-fixtures';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

const ARTIFACT_ID = '33333333-3333-4333-8333-333333333333';
const JOB_ID = '00000000-0000-4000-8000-000000000263';
const EXPORT_PATH = `/api/agent/v1/artifacts/${ARTIFACT_ID}/exports`;

async function setup(page: Page, workerAvailable: boolean) {
  await page.clock.setFixedTime(new Date('2026-09-04T00:05:00Z'));
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    permissions: [...FULL_PRODUCT_PERMISSIONS, ...DWAION_PERSONAL_PERMISSIONS],
  });
  await mockDwaionPersonalIntelligence(page, { published: true });
  let denied = false;
  let completed = false;
  let downloads = 0;
  await page.route(
    (url) => url.pathname.startsWith(EXPORT_PATH),
    (route) => {
      const path = new URL(route.request().url()).pathname;
      if (denied) return route.fulfill({ status: 403, json: { detail: 'Export access revoked.' } });
      if (path.endsWith('/download')) {
        downloads += 1;
        return route.fulfill({
          status: 200,
          body: 'test',
          headers: {
            'Content-Type': 'text/markdown',
            'X-DWP-Content-Fingerprint': 'a'.repeat(64),
            'Content-Disposition': 'attachment; filename="artifact.md"',
          },
        });
      }
      return route.fulfill({
        status: route.request().method() === 'POST' ? 202 : 200,
        json: {
          success: true,
          data: {
            exportJobId: JOB_ID,
            artifactId: ARTIFACT_ID,
            artifactRevision: 4,
            versionNumber: 2,
            exportFormat: 'MARKDOWN',
            state: completed ? 'SUCCEEDED' : 'PENDING',
            executionAvailable: workerAvailable,
            fileAvailable: completed,
            externalWritePerformed: false,
            ...(completed
              ? {
                  fileName: 'artifact.md',
                  mediaType: 'text/markdown',
                  byteSize: 4,
                  contentFingerprint: 'a'.repeat(64),
                  completedAt: '2026-09-04T00:06:00Z',
                }
              : {}),
          },
        },
      });
    }
  );
  await page.goto('/dwaion/artifacts');
  await page.getByRole('button', { name: 'Request export', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Request export' })
    .getByRole('button', { name: 'Request export', exact: true })
    .click();
  await expect(page.getByRole('dialog', { name: 'Request export' })).toHaveCount(0);
  return {
    complete: () => {
      completed = true;
    },
    revoke: () => {
      denied = true;
    },
    downloads: () => downloads,
  };
}

test('unavailable worker keeps the receipt pending without a completion or download claim', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 844 });
  const probe = await setup(page, false);
  await expect(
    page.getByText('The file generation worker is unavailable.', { exact: false })
  ).toBeVisible();
  await expect(page.getByText('File generated', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Download verified file' })).toHaveCount(0);
  expect(probe.downloads()).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.screenshot({
    path: info.outputPath('artifact-export-worker-unavailable-320.png'),
    fullPage: true,
  });
});

test('verified export downloads and a revoked status removes the cached download action', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  const probe = await setup(page, true);
  probe.complete();
  await page.getByRole('button', { name: 'Check export status' }).click();
  const download = page.getByRole('button', { name: 'Download verified file' });
  await expect(download).toBeVisible();
  const event = page.waitForEvent('download');
  await download.click();
  expect((await event).suggestedFilename()).toBe('artifact.md');
  expect(probe.downloads()).toBe(1);
  probe.revoke();
  await page.getByRole('button', { name: 'Check export status' }).click();
  await expect(download).toHaveCount(0);
  await expect(page.getByText('File generated', { exact: true })).toHaveCount(0);
  await page.screenshot({
    path: info.outputPath('artifact-export-access-revoked-1280.png'),
    fullPage: true,
  });
});
