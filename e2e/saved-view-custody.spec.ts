import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';

type TransferSummary = {
  transferBatchId: string;
  sourceOwnerUserId: number;
  targetOwnerUserId: number | null;
  disposition: 'TRANSFER' | 'RETAIN_ORPHANED';
  reasonCode: 'OFFBOARDING' | 'TEAM_REORGANIZATION' | 'OWNER_CORRECTION';
  sourceReference: string;
  retentionUntil: string | null;
  transferredCount: number;
  createdAt: string;
  createdBy: number;
};

async function mockCustodyWorkspace(page: Page) {
  let transfers: TransferSummary[] = [];
  let previewPayload: Record<string, unknown> | null = null;
  let executionPayload: Record<string, unknown> | null = null;

  await page.route('**/api/auth/admin/identity/users**', (route) =>
    fulfillSuccess(route, {
      content: [
        {
          userId: 11,
          displayName: 'Alex Former',
          email: 'alex.former@example.com',
          status: 'TERMINATED',
          mfaEnabled: true,
          roles: ['WORKSPACE_MEMBER'],
          roleManagement: { allowed: false, reason: 'IDENTITY_INACTIVE' },
          accessRevision: 4,
          version: 3,
        },
        {
          userId: 12,
          displayName: 'Jordan Owner',
          email: 'jordan.owner@example.com',
          status: 'ACTIVE',
          mfaEnabled: true,
          roles: ['WORKSPACE_MEMBER'],
          roleManagement: { allowed: true, reason: 'ALLOWED' },
          accessRevision: 2,
          version: 1,
        },
      ],
      page: 0,
      size: 100,
      totalElements: 2,
      totalPages: 1,
    })
  );

  await page.route('**/api/platform/v1/admin/saved-view-ownership/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (path.endsWith('/orphaned') && request.method() === 'GET') {
      return fulfillSuccess(route, []);
    }
    if (path.endsWith('/transfers') && request.method() === 'GET') {
      return fulfillSuccess(route, transfers);
    }
    if (path.endsWith('/preview') && request.method() === 'POST') {
      previewPayload = request.postDataJSON() as Record<string, unknown>;
      return fulfillSuccess(route, {
        sourceOwnerUserId: 11,
        disposition: 'TRANSFER',
        targetOwnerUserId: 12,
        retentionUntil: null,
        affectedCount: 2,
        ownershipFingerprint: 'f'.repeat(64),
        evaluatedAt: '2026-08-13T01:00:00Z',
        views: [
          {
            savedViewId: '90000000-0000-0000-0000-000000000001',
            surfaceKey: 'workspace.work',
            name: 'Former owner approvals',
            scope: 'TENANT',
            ownerGroupRef: null,
            version: 3,
            updatedAt: '2026-08-12T09:00:00Z',
          },
          {
            savedViewId: '90000000-0000-0000-0000-000000000002',
            surfaceKey: 'workspace.activity',
            name: 'Leadership activity',
            scope: 'TEAM',
            ownerGroupRef: 'finance-operations',
            version: 1,
            updatedAt: '2026-08-12T10:00:00Z',
          },
        ],
      });
    }
    if (path.endsWith('/transfers') && request.method() === 'POST') {
      executionPayload = request.postDataJSON() as Record<string, unknown>;
      const completed: TransferSummary = {
        transferBatchId: '91000000-0000-0000-0000-000000000001',
        sourceOwnerUserId: 11,
        targetOwnerUserId: 12,
        disposition: 'TRANSFER',
        reasonCode: 'OFFBOARDING',
        sourceReference: 'HR-EVT-2026-0813-11',
        retentionUntil: null,
        transferredCount: 2,
        createdAt: '2026-08-13T01:01:00Z',
        createdBy: 1,
      };
      transfers = [completed];
      return fulfillSuccess(route, {
        ...completed,
        idempotencyKey: executionPayload.idempotencyKey,
        ownershipFingerprint: 'f'.repeat(64),
        requestFingerprint: 'e'.repeat(64),
      });
    }
    return route.abort('failed');
  });

  return {
    get previewPayload() {
      return previewPayload;
    },
    get executionPayload() {
      return executionPayload;
    },
  };
}

test('administrators preview and execute a verified saved-view custody transfer', async ({
  page,
}) => {
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    displayName: 'Tenant Admin',
    permissions: FULL_PRODUCT_PERMISSIONS,
    appearance: {
      mode: 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
  const store = await mockCustodyWorkspace(page);

  await page.goto('/admin/identity/saved-view-custody');
  await expect(page.getByRole('heading', { name: 'Saved view custody', level: 1 })).toBeVisible();

  await page.getByLabel('Current owner').click();
  await page.getByRole('option', { name: /Alex Former/ }).click();
  await page.getByLabel('New owner').click();
  await page.getByRole('option', { name: /Jordan Owner/ }).click();
  await page.getByLabel('Authoritative evidence ID').fill('HR-EVT-2026-0813-11');
  await page
    .getByLabel('Detailed reason')
    .fill('Transfer governed views after the approved workforce offboarding event.');

  await page.getByRole('button', { name: 'Preview impact' }).click();
  await expect(page.getByText('2 views will use')).toBeVisible();
  await expect(page.getByText('Former owner approvals')).toBeVisible();
  expect(store.previewPayload).toMatchObject({
    sourceOwnerUserId: 11,
    targetOwnerUserId: 12,
    disposition: 'TRANSFER',
    sourceReference: 'HR-EVT-2026-0813-11',
  });

  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(accessibility.violations).toEqual([]);

  await page.getByRole('button', { name: 'Execute verified plan' }).click();
  await expect(page.getByText('Custody processing completed for 2 saved views.')).toBeVisible();
  await expect(page.getByText('Alex Former')).toBeVisible();
  await expect(page.getByText('Jordan Owner')).toBeVisible();
  expect(store.executionPayload).toMatchObject({
    expectedCount: 2,
    ownershipFingerprint: 'f'.repeat(64),
    sourceOwnerUserId: 11,
    targetOwnerUserId: 12,
  });
  expect(String(store.executionPayload?.idempotencyKey)).toMatch(/^custody-/);
});
