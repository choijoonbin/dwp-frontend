import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Download, type Page } from '@playwright/test';

import {
  DWAION_PERSONAL_PERMISSIONS,
  mockDwaionPersonalIntelligence,
} from './support/dwaion-personal-intelligence-fixtures';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

const OUTPUT = join(process.cwd(), 'output', 'dwaion-frontend-final-pass-20260917');

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

    const receiptIndexButton = page.getByRole('button', {
      name: 'Export current server deletion-history snapshot (JSON)',
      exact: true,
    });
    await expect(receiptIndexButton).toBeEnabled();
    const receiptIndexDownload = page.waitForEvent('download');
    await receiptIndexButton.click();
    const receiptIndex = await receiptIndexDownload;
    expect(receiptIndex.suggestedFilename()).toBe('dwaion-deletion-receipts.json');
    expect(await readDownloadedJson(receiptIndex)).toMatchObject({
      schemaVersion: 1,
      deletionJobs: [
        expect.objectContaining({
          deletionJobId: '66666666-6666-4666-8666-666666666666',
          state: 'COMPLETED',
        }),
      ],
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

    const legalHoldButton = history.getByRole('button', {
      name: 'Export current legal-hold state snapshot (JSON)',
      exact: true,
    });
    await expect(legalHoldButton).toBeEnabled();
    const legalHoldDownload = page.waitForEvent('download');
    await legalHoldButton.click();
    const legalHoldEvidence = await legalHoldDownload;
    expect(legalHoldEvidence.suggestedFilename()).toBe(
      'dwaion-legal-hold-66666666-6666-4666-8666-666666666678.json'
    );
    expect(await readDownloadedJson(legalHoldEvidence)).toMatchObject({
      schemaVersion: 1,
      deletionJobId: '66666666-6666-4666-8666-666666666678',
      legalHolds: [
        expect.objectContaining({
          authorityReference: 'LEGAL-2026-0914-001',
          dpoSubjectId: 'dpo@company.com',
        }),
      ],
    });
    await expect(history.getByTestId('dwaion-legal-hold-evidence')).toContainText(
      'LEGAL-2026-0914-001'
    );
    await expect(history.getByTestId('dwaion-legal-hold-evidence')).toContainText(
      'dpo@company.com'
    );

    await history.getByRole('button', { name: 'Retry failed targets', exact: true }).click();
    await expect
      .poll(() => retryBody)
      .toMatchObject({
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

async function readDownloadedJson(download: Download): Promise<unknown> {
  const path = await download.path();
  if (!path) throw new Error('Playwright did not retain the downloaded evidence file.');
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function legalHoldDeletionJob() {
  const holdEvidence = {
    available: true,
    domain: 'MEMORY',
    holdId: '15151515-1515-4515-8515-151515151515',
    state: 'ACTIVE',
    authorityReference: 'LEGAL-2026-0914-001',
    dpoSubjectId: 'dpo@company.com',
    reasonCode: 'LEGAL_HOLD_ACTIVE',
    effectiveAt: '2026-09-14T04:30:00Z',
    expiresAt: null,
  };
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
    stages: deletionStages('BLOCKED'),
    legalHolds: [holdEvidence],
    targets: [
      {
        domain: 'MEMORY',
        state: 'BLOCKED_LEGAL_HOLD',
        affectedCount: null,
        safeErrorCode: 'LEGAL_HOLD_ACTIVE',
        disposition: null,
        legalHoldEvidence: holdEvidence,
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
    stages: deletionStages('PARTIAL'),
    legalHolds: [],
    targets: [
      {
        domain: 'MEMORY',
        state: 'COMPLETED',
        affectedCount: 2,
        safeErrorCode: null,
        legalHoldEvidence: null,
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
        legalHoldEvidence: null,
      },
    ],
  };
}

function deletionStages(outcome: 'PARTIAL' | 'BLOCKED') {
  const activeState = outcome === 'BLOCKED' ? 'BLOCKED' : 'PARTIAL';
  return [
    deletionStage('REQUEST_ACCEPTED', 'COMPLETED', 'REQUEST_ACCEPTED'),
    deletionStage('TARGETS_SCHEDULED', 'COMPLETED', 'TARGETS_SCHEDULED'),
    deletionStage(
      'ACTIVE_STORE_DISPOSITION',
      activeState,
      outcome === 'BLOCKED' ? 'LEGAL_HOLD_ACTIVE' : 'ACTIVE_STORE_DISPOSITION_PARTIAL'
    ),
    deletionStage(
      'BACKUP_BOUNDARY',
      outcome === 'BLOCKED' ? 'BLOCKED' : 'PARTIAL',
      outcome === 'BLOCKED' ? 'LEGAL_HOLD_BOUNDARY_RECORDED' : 'BACKUP_BOUNDARY_PARTIAL'
    ),
    deletionStage(
      'RECEIPT_FINALIZATION',
      outcome === 'BLOCKED' ? 'BLOCKED' : 'PARTIAL',
      outcome === 'BLOCKED' ? 'LEGAL_HOLD_RECEIPT_FINALIZED' : 'PARTIAL_RECEIPT_FINALIZED'
    ),
  ];
}

function deletionStage(
  key:
    | 'REQUEST_ACCEPTED'
    | 'TARGETS_SCHEDULED'
    | 'ACTIVE_STORE_DISPOSITION'
    | 'BACKUP_BOUNDARY'
    | 'RECEIPT_FINALIZATION',
  state: 'COMPLETED' | 'PARTIAL' | 'BLOCKED',
  detailCode: string
) {
  return {
    key,
    state,
    detailCode,
    observedAt: '2026-09-14T04:36:00Z',
    evidenceReference: `deletion:${key.toLowerCase()}`,
    evidenceFingerprint: '8'.repeat(64),
  };
}
