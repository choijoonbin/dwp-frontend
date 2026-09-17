import { mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import {
  DWAION_PERSONAL_PERMISSIONS,
  mockDwaionPersonalIntelligence,
} from './support/dwaion-personal-intelligence-fixtures';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

const OUTPUT = join(process.cwd(), 'output', 'dwaion-user-advancement-final');

test.beforeAll(() => mkdirSync(OUTPUT, { recursive: true }));

for (const viewport of [
  { width: 1440, height: 1000, label: '1440' },
  { width: 720, height: 450, label: '200-percent' },
  { width: 390, height: 844, label: '390' },
  { width: 320, height: 760, label: '320' },
] as const) {
  test(`U05 memory categories and governed evidence use canonical data at ${viewport.label}`, async ({
    page,
  }) => {
    await prepare(page, viewport);
    await page.goto('/dwaion/personal-controls');
    await expect(page.getByRole('heading', { name: 'My AI controls' })).toBeVisible();
    await expect(page.locator('#dwp-main-content .MuiSkeleton-root')).toHaveCount(0);

    const filters = page.getByRole('tablist', { name: 'Memory categories' });
    await expect(filters.getByRole('tab', { name: 'All 1', exact: true })).toBeVisible();
    await expect(filters.getByRole('tab', { name: 'Manual 1', exact: true })).toBeVisible();
    await expect(filters.getByRole('tab', { name: 'AI approved 0', exact: true })).toBeVisible();
    await expect(filters.getByRole('tab', { name: 'Expiring 1', exact: true })).toBeVisible();

    const detail = page.getByTestId('dwaion-selected-memory-detail');
    await expect(detail).toContainText('USER_EXPLICIT_ENTRY');
    await expect(detail).toContainText('Application count');
    await expect(detail).toContainText('9');
    await expect(detail).toContainText('AWS_KMS');
    await expect(detail).toContainText('4e8201a4c301');
    await expect(detail).toContainText('Verified fact vectors and confidence');
    await expect(detail).toContainText(
      'The current governed memory contract does not provide this evidence.'
    );

    await filters.getByRole('tab', { name: 'AI approved 0', exact: true }).click();
    await expect(
      page.getByText('The current governed memory contract does not provide this evidence.', {
        exact: true,
      })
    ).toBeVisible();
    await filters.getByRole('tab', { name: 'Manual 1', exact: true }).click();
    await expect(detail).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page
      .getByRole('button', {
        name: 'Export current server deletion-history snapshot (JSON)',
        exact: true,
      })
      .click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^dwaion-deletion-receipt-index-\d+\.json$/u);
    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    const snapshot = JSON.parse(await readFile(downloadPath as string, 'utf8')) as Record<
      string,
      unknown
    >;
    expect(snapshot).toMatchObject({
      evidenceClass: 'SERVER_RESPONSE_SNAPSHOT',
      officialCertificate: false,
      source: 'personal-data-deletion-history-api',
    });

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      await page.evaluate(() => window.innerWidth + 1)
    );
    const audit = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
    expect(
      audit.violations.filter((violation) =>
        ['serious', 'critical'].includes(violation.impact ?? '')
      )
    ).toEqual([]);
    await page.screenshot({
      path: join(OUTPUT, `U05-memory-evidence-${viewport.label}.png`),
      fullPage: true,
      animations: 'disabled',
      caret: 'hide',
    });
  });
}

for (const viewport of [
  { width: 1440, height: 1000, label: '1440' },
  { width: 390, height: 844, label: '390' },
] as const) {
  test(`U05 partial deletion and legal-hold evidence stay governed at ${viewport.label}`, async ({
    page,
  }) => {
    await prepare(page, viewport);
    const jobs = [legalHoldDeletionJob(), partialDeletionJob()];
    let retryBody: Record<string, unknown> | null = null;
    await page.route('**/api/agent/v1/personal-data/deletions', (route) =>
      route.fulfill({ json: { success: true, data: jobs } })
    );
    await page.route(
      '**/api/agent/v1/personal-data/deletions/66666666-6666-4666-8666-666666666679/retry',
      (route) => {
        retryBody = route.request().postDataJSON() as Record<string, unknown>;
        return route.fulfill({
          json: { success: true, data: { ...partialDeletionJob(), attemptCount: 3 } },
        });
      }
    );

    await page.goto('/dwaion/personal-controls');
    const history = page.getByTestId('dwaion-deletion-history');
    await expect(history).toContainText('Blocked by legal hold');
    await expect(history).toContainText('Partially completed');
    await expect(
      history.getByRole('button', { name: 'Request legal-hold explanation', exact: true })
    ).toBeDisabled();

    const holdDownloadPromise = page.waitForEvent('download');
    await history
      .getByRole('button', {
        name: 'Export current legal-hold state snapshot (JSON)',
        exact: true,
      })
      .click();
    const holdDownload = await holdDownloadPromise;
    const holdPath = await holdDownload.path();
    expect(holdPath).not.toBeNull();
    const holdSnapshot = JSON.parse(await readFile(holdPath as string, 'utf8')) as {
      evidenceClass?: string;
      officialCertificate?: boolean;
      jobs?: Array<{ deletionJobId?: string }>;
    };
    expect(holdSnapshot).toMatchObject({
      evidenceClass: 'SERVER_RESPONSE_SNAPSHOT',
      officialCertificate: false,
    });
    expect(holdSnapshot.jobs?.map((job) => job.deletionJobId)).toContain(
      '66666666-6666-4666-8666-666666666678'
    );

    await history.getByRole('button', { name: 'Retry failed targets', exact: true }).click();
    await expect.poll(() => retryBody).toMatchObject({
      expectedRevision: 2,
      reasonCode: 'USER_DATA_DELETION_RETRY',
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      await page.evaluate(() => window.innerWidth + 1)
    );
    await page.screenshot({
      path: join(OUTPUT, `U05-deletion-governance-${viewport.label}.png`),
      fullPage: true,
      animations: 'disabled',
      caret: 'hide',
    });
  });
}

async function prepare(page: Page, viewport: { readonly width: number; readonly height: number }) {
  await page.setViewportSize(viewport);
  await page.clock.setFixedTime(new Date('2026-09-17T03:00:00Z'));
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    displayName: 'Mina Kim',
    permissions: [...FULL_PRODUCT_PERMISSIONS, ...DWAION_PERSONAL_PERMISSIONS],
    appearance: {
      mode: 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
  await page.route('**/api/platform/v1/workspace/work-items**', (route) =>
    route.fulfill({ json: { success: true, data: [] } })
  );
  await mockDwaionPersonalIntelligence(page);
}

function legalHoldDeletionJob() {
  return {
    deletionJobId: '66666666-6666-4666-8666-666666666678',
    state: 'BLOCKED_LEGAL_HOLD',
    domains: ['MEMORY'],
    requestedAt: '2026-09-14T04:35:00Z',
    completedAt: '2026-09-14T04:36:00Z',
    deletionPerformed: false,
    deletionExecutionAvailable: true,
    blockedDomains: ['MEMORY'],
    attemptCount: 1,
    targets: [
      {
        domain: 'MEMORY',
        state: 'BLOCKED_LEGAL_HOLD',
        affectedCount: null,
        safeErrorCode: 'LEGAL_HOLD_ACTIVE',
        disposition: null,
      },
    ],
  };
}

function partialDeletionJob() {
  return {
    deletionJobId: '66666666-6666-4666-8666-666666666679',
    state: 'PARTIAL',
    domains: ['MEMORY', 'ARTIFACT'],
    requestedAt: '2026-09-14T04:30:00Z',
    completedAt: '2026-09-14T04:34:00Z',
    deletionPerformed: false,
    deletionExecutionAvailable: true,
    blockedDomains: [],
    attemptCount: 2,
    targets: [
      {
        domain: 'MEMORY',
        state: 'COMPLETED',
        affectedCount: 2,
        safeErrorCode: null,
        disposition: {
          dispositionId: '66666666-6666-4666-8666-666666666680',
          domain: 'MEMORY',
          generation: 1,
          purgedRowCount: 2,
          purgedTableCounts: { ai_personal_memories: 2 },
          dispositionScope: 'AGENT_ACTIVE_POSTGRES_DOMAIN_ONLY',
          dispositionMethod: 'PHYSICAL_ROW_PURGE_OF_ENCRYPTED_RECORDS',
          activeStoreEnvelopesDestroyed: true,
          sourceSystemDataAffected: false,
          backupDispositionState: 'EXTERNAL_RETENTION_BOUNDARY',
          receiptFingerprint: '6'.repeat(64),
          completedAt: '2026-09-14T04:33:00Z',
        },
      },
      {
        domain: 'ARTIFACT',
        state: 'FAILED',
        affectedCount: null,
        safeErrorCode: 'ARTIFACT_PURGE_RETRYABLE',
        disposition: null,
      },
    ],
  };
}
