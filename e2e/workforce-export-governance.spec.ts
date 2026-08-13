import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';

type ExportRequest = {
  requestId: string;
  datasetKey: 'ORGANIZATION_INTELLIGENCE';
  selection: Record<string, string>;
  populationType: 'TENANT';
  organizationIds: string[];
  fieldGroups: string[];
  exportFormat: 'CSV';
  maskingProfile: string;
  watermarkText: string;
  recipientReference: string;
  purpose: string;
  sourceReference: string;
  lifecycleState: 'BLOCKED_PENDING_APPROVAL' | 'CANCELLED';
  executionEnabled: false;
  blockers: string[];
  requestSha256: string;
  artifactSha256: null;
  artifactSizeBytes: null;
  artifactExpiresAt: null;
  attemptCount: number;
  retryCycleAttemptCount: number;
  manualRetryCount: number;
  nextAttemptAt: null;
  cancellationRequestedAt: string | null;
  completedAt: null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

async function mockExportControl(page: Page) {
  let requests: ExportRequest[] = [];
  let previewPayload: Record<string, unknown> | null = null;
  let createPayload: Record<string, unknown> | null = null;

  await page.route('**/api/people/v1/workforce/exports**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();

    if (path.endsWith('/datasets') && method === 'GET') {
      return fulfillSuccess(route, [
        {
          datasetKey: 'ORGANIZATION_INTELLIGENCE',
          name: 'Organization intelligence',
          description: 'Organization health and data quality evidence.',
          requiredFieldGroups: ['DIRECTORY'],
          allowedSelectionKeys: ['view', 'asOf', 'compareTo', 'scenarioId', 'rootOrganizationId'],
          version: 2,
        },
      ]);
    }
    if (path.endsWith('/preview') && method === 'POST') {
      previewPayload = request.postDataJSON() as Record<string, unknown>;
      return fulfillSuccess(route, {
        authorized: true,
        executionEnabled: false,
        datasetKey: 'ORGANIZATION_INTELLIGENCE',
        allowedSelectionKeys: ['view', 'asOf', 'compareTo', 'scenarioId', 'rootOrganizationId'],
        populationType: 'TENANT',
        organizationIds: [],
        fieldGroups: ['DIRECTORY'],
        exportFormat: 'CSV',
        maskingProfile: 'WORKFORCE_MINIMUM',
        watermarkTemplate: 'DWP confidential | request={{requestId}}',
        artifactTtlHours: 24,
        maximumAttempts: 5,
        maximumManualRetries: 1,
        blockers: ['D-09', 'D-12'],
        message: 'Execution remains blocked until release decisions are approved.',
        evaluatedAt: '2026-08-13T01:00:00Z',
      });
    }
    if (path.endsWith('/exports') && method === 'GET') {
      return fulfillSuccess(route, requests);
    }
    if (path.endsWith('/exports') && method === 'POST') {
      createPayload = request.postDataJSON() as Record<string, unknown>;
      const created: ExportRequest = {
        requestId: '95000000-0000-0000-0000-000000000001',
        datasetKey: 'ORGANIZATION_INTELLIGENCE',
        selection: createPayload.selection as Record<string, string>,
        populationType: 'TENANT',
        organizationIds: [],
        fieldGroups: ['DIRECTORY'],
        exportFormat: 'CSV',
        maskingProfile: 'WORKFORCE_MINIMUM',
        watermarkText:
          'DWP confidential | tenant=1 | requester=1 | recipient=people-governance@skax.com | request=95000000-0000-0000-0000-000000000001',
        recipientReference: String(createPayload.recipientReference),
        purpose: String(createPayload.purpose),
        sourceReference: String(createPayload.sourceReference),
        lifecycleState: 'BLOCKED_PENDING_APPROVAL',
        executionEnabled: false,
        blockers: ['D-09', 'D-12'],
        requestSha256: 'a'.repeat(64),
        artifactSha256: null,
        artifactSizeBytes: null,
        artifactExpiresAt: null,
        attemptCount: 0,
        retryCycleAttemptCount: 0,
        manualRetryCount: 0,
        nextAttemptAt: null,
        cancellationRequestedAt: null,
        completedAt: null,
        version: 0,
        createdAt: '2026-08-13T01:01:00Z',
        updatedAt: '2026-08-13T01:01:00Z',
      };
      requests = [created];
      return fulfillSuccess(route, created);
    }
    if (path.endsWith('/cancel') && method === 'PATCH') {
      const body = request.postDataJSON() as { version: number };
      const cancelled: ExportRequest = {
        ...requests[0],
        lifecycleState: 'CANCELLED',
        cancellationRequestedAt: '2026-08-13T01:03:00Z',
        version: body.version + 1,
        updatedAt: '2026-08-13T01:03:00Z',
      };
      requests = [cancelled];
      return fulfillSuccess(route, cancelled);
    }
    if (path.endsWith('/attempts') && method === 'GET') {
      return fulfillSuccess(
        route,
        requests[0]?.lifecycleState === 'CANCELLED'
          ? [
              {
                attemptEventId: '96000000-0000-0000-0000-000000000001',
                attemptNumber: 0,
                eventType: 'BLOCKED',
                workerReference: null,
                failureCode: 'RELEASE_GATE_BLOCKED',
                redactedFailureMessage:
                  'Export execution is blocked until release decisions are approved.',
                artifactSha256: null,
                artifactSizeBytes: null,
                occurredAt: '2026-08-13T01:01:00Z',
              },
              {
                attemptEventId: '96000000-0000-0000-0000-000000000002',
                attemptNumber: 0,
                eventType: 'CANCELLED',
                workerReference: null,
                failureCode: null,
                redactedFailureMessage: null,
                artifactSha256: null,
                artifactSizeBytes: null,
                occurredAt: '2026-08-13T01:03:00Z',
              },
            ]
          : [
              {
                attemptEventId: '96000000-0000-0000-0000-000000000001',
                attemptNumber: 0,
                eventType: 'BLOCKED',
                workerReference: null,
                failureCode: 'RELEASE_GATE_BLOCKED',
                redactedFailureMessage:
                  'Export execution is blocked until release decisions are approved.',
                artifactSha256: null,
                artifactSizeBytes: null,
                occurredAt: '2026-08-13T01:01:00Z',
              },
            ]
      );
    }
    return route.abort('failed');
  });

  return {
    get previewPayload() {
      return previewPayload;
    },
    get createPayload() {
      return createPayload;
    },
  };
}

test('workforce governor records and cancels a release-gated export with evidence', async ({
  page,
}) => {
  await mockShellSession(page, ['ADMIN', 'HR_ADMIN'], {
    locale: 'en',
    displayName: 'Workforce Governor',
    permissions: FULL_PRODUCT_PERMISSIONS,
    appearance: {
      mode: 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
  const store = await mockExportControl(page);

  await page.goto(
    '/hr/data/exports?dataset=ORGANIZATION_INTELLIGENCE&view=quality&asOf=2026-08-13&compareTo=2026-07-13&scenarioId=scenario-2027'
  );

  await expect(
    page.getByRole('heading', { name: 'Governed data exports', level: 1 })
  ).toBeVisible();
  await expect(page.getByText('Execution is held at the release gate')).toBeVisible();
  await expect(page.getByText(/D-09/)).toBeVisible();
  await expect(page.getByText(/D-12/)).toBeVisible();
  expect(store.previewPayload).toEqual({
    datasetKey: 'ORGANIZATION_INTELLIGENCE',
    selection: {
      asOf: '2026-08-13',
      compareTo: '2026-07-13',
      scenarioId: 'scenario-2027',
      view: 'quality',
    },
  });

  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(accessibility.violations).toEqual([]);

  await page.getByRole('button', { name: 'New export request' }).click();
  const dialog = page.getByRole('dialog', { name: 'Request a governed export' });
  await dialog.getByLabel('Accountable recipient').fill('people-governance@skax.com');
  await dialog
    .getByLabel('Business purpose')
    .fill('Retain approved organization quality evidence for the quarterly control review.');
  await dialog.getByLabel('Authoritative request reference').fill('GRC-2026-Q3-1042');
  await dialog.getByRole('button', { name: 'Record blocked request' }).click();

  await expect(
    page.getByText('The blocked export demand and policy evidence were recorded.')
  ).toBeVisible();
  await expect(page.getByText('Blocked pending approval').first()).toBeVisible();
  await expect(page.getByText('SHA-256 ' + 'a'.repeat(64))).toBeVisible();
  await expect(
    page.getByLabel('Governed export lifecycle').getByText('Held by release gate')
  ).toBeVisible();
  expect(store.createPayload).toMatchObject({
    datasetKey: 'ORGANIZATION_INTELLIGENCE',
    recipientReference: 'people-governance@skax.com',
    sourceReference: 'GRC-2026-Q3-1042',
    selection: {
      asOf: '2026-08-13',
      compareTo: '2026-07-13',
      scenarioId: 'scenario-2027',
      view: 'quality',
    },
  });

  await page.getByRole('button', { name: 'Cancel request' }).click();
  const cancellation = page.getByRole('dialog', { name: 'Cancel export request' });
  await cancellation
    .getByLabel('Decision rationale')
    .fill('The quarterly control owner withdrew the approved evidence request.');
  await cancellation.getByRole('button', { name: 'Cancel request' }).click();

  await expect(page.getByText('The export cancellation was recorded.')).toBeVisible();
  await expect(page.getByText('Cancelled').first()).toBeVisible();
  await expect(page.getByText('Request cancelled')).toBeVisible();
});
