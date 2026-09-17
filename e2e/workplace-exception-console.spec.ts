import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';

import type { Page, Route } from '@playwright/test';

const NOW = '2026-09-17T03:00:00Z';
const INCIDENT_ID = '71000000-0000-4000-8000-000000000022';
const BATCH_ID = '72000000-0000-4000-8000-000000000022';
const PREVIEW_ID = '81000000-0000-4000-8000-000000000022';
const COMMAND_ID = '82000000-0000-4000-8000-000000000022';
const GOVERNED_PRODUCTS = [
  'approvals',
  'calendar',
  'communications',
  'dwaion',
  'hcm',
  'mail',
  'meetings',
  'messaging',
  'notifications',
  'services',
  'spaces',
  'workplace',
] as const;

type Evidence = {
  consoleReads: number;
  exportPreviews: Array<{ headers: Record<string, string>; body: unknown }>;
  exportCommands: Array<{ headers: Record<string, string>; body: unknown }>;
  recoveryPreviews: Array<{ headers: Record<string, string>; body: unknown }>;
  downloads: Array<Record<string, string>>;
};

function headers(route: Route) {
  return route.request().headers();
}

function body(route: Route) {
  return route.request().postDataJSON() as unknown;
}

async function mockAccessMode(page: Page, elevated: boolean) {
  await page.route('**/api/auth/product-surface-contexts', (route) =>
    fulfillSuccess(route, {
      contractVersion: 'product-surfaces/v3',
      decisionRevision: `exception-console-${elevated ? 'elevated' : 'normal'}`,
      sourceRevisions: {
        auth: 'auth-exception-console',
        policy: 'policy-exception-console',
        productRelationship: 'relationship-exception-console',
      },
      activeAccessMode: elevated ? 'ELEVATED' : 'NORMAL',
      generatedAt: NOW,
      contexts: [],
      rollouts: GOVERNED_PRODUCTS.map((productKey) => ({
        productKey,
        state: '000',
        flags: { contextShadow: false, capabilityEnforcement: false, surfaceUi: false },
        cohort: 'baseline',
        opaqueRevision: `rollout-${productKey}-baseline`,
        authorityStatus: 'NOT_EVALUATED',
      })),
    })
  );
}

function consolePayload() {
  return {
    summary: {
      active: 3,
      critical: 2,
      warning: 0,
      error: 1,
      concurrencyConflicts24h: 1,
      deadLetterQueueDepth: 3,
      automaticRecoveryPercent: null,
      slaCompliancePercent: null,
    },
    exceptions: [
      {
        exceptionId: `SAFETY:${INCIDENT_ID}`,
        source: 'SAFETY',
        severity: 'CRITICAL',
        status: 'ACTIVE',
        title: 'Active fire interlock',
        impact: 'People in the affected scope require a verified response.',
        code: 'SAFETY_FIRE',
        detectedAt: NOW,
        version: 3,
        evidence: ['State ACTIVE', 'Severity CRITICAL'],
        action: 'OPEN_SAFETY',
        actionHref: `/workplace/admin/safety?incident=${INCIDENT_ID}`,
        connectorKind: null,
        configurationVersion: null,
        runtimeVersion: null,
      },
      {
        exceptionId: `BOOKING:${BATCH_ID}`,
        source: 'BOOKING',
        severity: 'CRITICAL',
        status: 'ACTIVE',
        title: 'Reservation result unknown',
        impact: 'Re-query this batch before compensation or another booking command.',
        code: 'RESULT_UNKNOWN',
        detectedAt: NOW,
        version: 4,
        evidence: ['Batch receipt requires reconciliation'],
        action: 'REVIEW_BOOKING',
        actionHref: `/workplace/planner?batch=${BATCH_ID}&step=RESULT`,
        connectorKind: null,
        configurationVersion: null,
        runtimeVersion: null,
      },
      {
        exceptionId: 'CONNECTOR:CALENDAR',
        source: 'CONNECTOR',
        severity: 'ERROR',
        status: 'ACTIVE',
        title: 'Calendar delivery queue',
        impact: '3 failed events await an operator-reviewed replay.',
        code: 'ADAPTER_DLQ',
        detectedAt: NOW,
        version: 7,
        evidence: ['DLQ depth 3', 'Runtime version 7'],
        action: 'REPLAY_CONNECTOR',
        actionHref: null,
        connectorKind: 'CALENDAR',
        configurationVersion: 4,
        runtimeVersion: 7,
      },
    ],
    guardrails: [
      {
        code: 'CONNECTOR_DLQ',
        name: 'External integration delivery',
        scope: 'Calendar',
        threshold: 'DLQ depth = 0',
        observedValue: '3',
        status: 'BREACHED',
        enforcement: 'Preview and explicitly confirm a bounded replay',
      },
      {
        code: 'SLA_UNAVAILABLE',
        name: 'SLA evidence',
        scope: 'Tenant',
        threshold: 'Authoritative provider evidence',
        observedValue: 'Unknown',
        status: 'UNKNOWN',
        enforcement: 'Do not infer a healthy state',
      },
    ],
    generatedAt: NOW,
    externalTelemetryUrl: null,
  };
}

async function setup(page: Page, elevated: boolean): Promise<Evidence> {
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await mockAccessMode(page, elevated);
  const evidence: Evidence = {
    consoleReads: 0,
    exportPreviews: [],
    exportCommands: [],
    recoveryPreviews: [],
    downloads: [],
  };
  await page.route('**/api/platform/v1/admin/workplace/exceptions', (route) => {
    evidence.consoleReads += 1;
    return fulfillSuccess(route, consolePayload());
  });
  await page.route('**/api/platform/v1/admin/workplace/exceptions/exports:preview', (route) => {
    evidence.exportPreviews.push({ headers: headers(route), body: body(route) });
    return fulfillSuccess(route, {
      previewId: PREVIEW_ID,
      rowCount: 3,
      purpose: 'Verified incident review',
      createdAt: NOW,
      expiresAt: '2026-09-17T03:10:00Z',
    });
  });
  await page.route('**/api/platform/v1/admin/workplace/exceptions/exports', (route) => {
    evidence.exportCommands.push({ headers: headers(route), body: body(route) });
    return fulfillSuccess(route, {
      commandId: COMMAND_ID,
      rowCount: 3,
      acceptedAt: NOW,
      expiresAt: '2026-09-17T04:00:00Z',
      downloadHref: `/v1/admin/workplace/exceptions/exports/${COMMAND_ID}/content`,
      idempotentReplay: false,
      correlationId: 'screen22-export',
    });
  });
  await page.route(
    `**/api/platform/v1/admin/workplace/exceptions/exports/${COMMAND_ID}/content`,
    (route) => {
      evidence.downloads.push(headers(route));
      return route.fulfill({
        contentType: 'text/csv',
        body: 'exception_id,title\nCONNECTOR:CALENDAR,Calendar delivery queue\n',
      });
    }
  );
  await page.route(
    '**/api/platform/v1/admin/workplace/exceptions/CONNECTOR_CALENDAR/recovery:preview',
    (route) => {
      evidence.recoveryPreviews.push({ headers: headers(route), body: body(route) });
      return fulfillSuccess(route, {
        exceptionId: 'CONNECTOR:CALENDAR',
        replay: {
          previewId: PREVIEW_ID,
          kind: 'CALENDAR',
          provider: 'calendar-adapter',
          from: '2026-09-16T03:00:00Z',
          to: NOW,
          failedOnly: true,
          maximumRecords: 10_000,
          estimatedRecords: 3,
          eligible: false,
          limitations: ['The connector runtime version changed after this exception was observed.'],
          configurationVersion: 4,
          runtimeVersion: 7,
          expiresAt: '2026-09-17T03:10:00Z',
          createdAt: NOW,
        },
        impactSummary: 'Replay remains blocked until current connector evidence is reviewed.',
      });
    }
  );
  return evidence;
}

test('renders the responsive exception console and fails closed without current step-up', async ({
  page,
}) => {
  await setup(page, false);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/workplace/admin/exceptions?filter=unsupported');

  const console = page.getByRole('main');
  await expect(
    console.getByRole('heading', { name: 'Policy, SLA & exception control' })
  ).toBeVisible();
  await expect(console.getByRole('heading', { name: 'Unknown' })).toBeVisible();
  await expect(console.getByText(/Current elevated access is required/u)).toBeVisible();
  await expect(console.getByRole('button', { name: 'Export governed CSV' })).toBeDisabled();
  await console.getByText('Calendar delivery queue').click();
  await console.getByRole('textbox', { name: 'Recovery reason' }).fill('Review blocked recovery');
  await expect(console.getByRole('button', { name: 'Preview governed replay' })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(
    accessibility.violations.filter((item) => ['critical', 'serious'].includes(item.impact ?? ''))
  ).toEqual([]);
});

test('executes guarded export and explains an ineligible recovery preview', async ({ page }) => {
  const evidence = await setup(page, true);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/workplace/admin/exceptions');

  const console = page.getByRole('main');
  await console.getByRole('button', { name: 'Refresh rules & evidence' }).click();
  await expect.poll(() => evidence.consoleReads).toBeGreaterThan(1);
  await console.getByRole('textbox', { name: 'Export purpose' }).fill('Verified incident review');
  await console.getByRole('button', { name: 'Export governed CSV' }).click();
  const exportDialog = page.getByRole('alertdialog', { name: 'Confirm governed export' });
  await expect(exportDialog.getByText(/3 sanitized exception rows/u)).toBeVisible();
  await exportDialog.getByRole('button', { name: 'Create and download' }).click();
  await expect(console.getByText(/Governed export created and downloaded/u)).toBeVisible();

  await console.getByText('Calendar delivery queue').click();
  await console
    .getByRole('textbox', { name: 'Recovery reason' })
    .fill('Replay only the verified failed calendar events');
  await console.getByRole('button', { name: 'Preview governed replay' }).click();
  await expect(console.getByText(/connector runtime version changed/u)).toBeVisible();
  await expect(page.getByRole('alertdialog', { name: 'Confirm bounded recovery' })).toHaveCount(0);

  expect(evidence.exportPreviews).toHaveLength(1);
  expect(evidence.exportCommands).toHaveLength(1);
  expect(evidence.downloads).toHaveLength(1);
  expect(evidence.recoveryPreviews).toHaveLength(1);
  for (const request of [
    ...evidence.exportPreviews,
    ...evidence.exportCommands,
    ...evidence.recoveryPreviews,
  ]) {
    expect(request.headers['x-dwp-active-access-mode']).toBe('ELEVATED');
    expect(request.headers['idempotency-key']).toBeTruthy();
  }
  expect(evidence.downloads[0]?.['x-dwp-active-access-mode']).toBe('ELEVATED');
  expect(evidence.exportCommands[0]?.body).toMatchObject({
    explicitConfirmation: true,
    reason: 'Verified incident review',
  });
});

test('routes safety and booking exceptions to their consuming owner workflows', async ({
  page,
}) => {
  await setup(page, true);
  await page.goto('/workplace/admin/exceptions');
  const console = page.getByRole('main');

  await console
    .getByRole('checkbox', { name: 'Select Active fire interlock for owner review' })
    .check();
  await console
    .getByRole('checkbox', { name: 'Select Reservation result unknown for owner review' })
    .check();
  await console.getByRole('button', { name: 'Review selected owner workflows (2)' }).click();
  const ownerActions = console.getByTestId('workplace-exception-batch-owner-actions');
  await expect(ownerActions.getByText(/Bulk recovery is not safe/u)).toBeVisible();
  await ownerActions.getByRole('button', { name: 'Open owner workflow' }).first().click();
  await expect(page).toHaveURL(
    new RegExp(`/workplace/admin/safety\\?incident=${INCIDENT_ID}$`, 'u')
  );

  await page.goto('/workplace/admin/exceptions');
  const restored = page.getByRole('main');
  await restored.getByText('Reservation result unknown').click();
  await expect(restored.getByRole('heading', { name: 'Reservation result unknown' })).toBeVisible();
  await restored.getByRole('button', { name: 'Open owner workflow' }).click();
  await expect(page).toHaveURL(
    new RegExp(`/workplace/planner\\?batch=${BATCH_ID}&step=RESULT$`, 'u')
  );
});
