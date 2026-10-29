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
const DEVICE_COMMAND_ID = '73000000-0000-4000-8000-000000000022';
const DEVICE_ID = '73000000-0000-4000-8000-000000000023';
const SERVICE_ORDER_ID = '74000000-0000-4000-8000-000000000022';
const ADJUSTMENT_ID = '75000000-0000-4000-8000-000000000022';
const VISIT_ID = '76000000-0000-4000-8000-000000000022';
const PASS_ID = '77000000-0000-4000-8000-000000000022';
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
      contractVersion: '2',
      decisionRevision: `exception-console-${elevated ? 'elevated' : 'normal'}`,
      sourceRevisions: {
        auth: 'auth-exception-console',
        policy: 'policy-exception-console',
        productRelationship: 'relationship-exception-console',
        targetPopulation: 'target-population-exception-console',
        support: null,
        tenantControl: 'tenant-control-exception-console',
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
      active: 9,
      critical: 4,
      warning: 1,
      error: 4,
      concurrencyConflicts24h: 1,
      deadLetterQueueDepth: 3,
      automaticRecoveryPercent: null,
      slaCompliancePercent: null,
      unresolvedCount: 9,
      returnedCount: 9,
      truncated: false,
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
        resolved: false,
        resolvedAt: null,
        ageSeconds: 120,
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
        resolved: false,
        resolvedAt: null,
        ageSeconds: 90,
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
        resolved: false,
        resolvedAt: null,
        ageSeconds: 60,
      },
      {
        exceptionId: `DEVICE_COMMAND:${DEVICE_COMMAND_ID}`,
        source: 'DEVICE_COMMAND',
        severity: 'CRITICAL',
        status: 'MANUAL_REVIEW',
        title: 'Device command outcome requires review',
        impact: 'Automatic provider reconciliation exhausted its bounded retry budget.',
        code: 'DEVICE_RETRY_EXHAUSTED',
        detectedAt: NOW,
        version: 5,
        evidence: ['Operation=RESTART', 'State=RESULT_UNKNOWN', 'Attempts=10'],
        action: 'REVIEW_DEVICE',
        actionHref: `/workplace/admin/devices?device=${DEVICE_ID}&command=${DEVICE_COMMAND_ID}`,
        connectorKind: null,
        configurationVersion: null,
        runtimeVersion: null,
        resolved: false,
        resolvedAt: null,
        ageSeconds: 180,
      },
      {
        exceptionId: `SERVICE_ORDER:${SERVICE_ORDER_ID}`,
        source: 'SERVICE_ORDER',
        severity: 'ERROR',
        status: 'ACTIVE',
        title: 'Service order outcome requires review',
        impact: 'Review the authoritative fulfillment result.',
        code: 'SERVICE_ORDER_RESULT_UNKNOWN',
        detectedAt: NOW,
        version: 3,
        evidence: ['State=RESULT_UNKNOWN'],
        action: 'REVIEW_SERVICE_ORDER',
        actionHref: `/workplace/admin/service-fulfillment?order=${SERVICE_ORDER_ID}`,
        connectorKind: null,
        configurationVersion: null,
        runtimeVersion: null,
        resolved: false,
        resolvedAt: null,
        ageSeconds: 150,
      },
      {
        exceptionId: 'SERVICE_PROVIDER:ACCESS_CONTROL',
        source: 'SERVICE_PROVIDER',
        severity: 'WARNING',
        status: 'ACTIVE',
        title: 'Service provider requires review',
        impact: 'Provider health evidence is stale.',
        code: 'SERVICE_PROVIDER_DEGRADED',
        detectedAt: NOW,
        version: 2,
        evidence: ['State=DEGRADED'],
        action: 'REVIEW_SERVICE_PROVIDER',
        actionHref: '/workplace/admin/service-providers?provider=ACCESS_CONTROL',
        connectorKind: null,
        configurationVersion: 2,
        runtimeVersion: 1,
        resolved: false,
        resolvedAt: null,
        ageSeconds: 140,
      },
      {
        exceptionId: `SERVICE_REFUND:${ADJUSTMENT_ID}`,
        source: 'SERVICE_REFUND',
        severity: 'CRITICAL',
        status: 'MANUAL_REVIEW',
        title: 'Service refund requires review',
        impact: 'Reconcile this exact line adjustment.',
        code: 'SERVICE_REFUND_MANUAL_REVIEW',
        detectedAt: NOW,
        version: 4,
        evidence: ['State=FAILED'],
        action: 'REVIEW_SERVICE_REFUND',
        actionHref: `/workplace/admin/service-fulfillment?order=${SERVICE_ORDER_ID}&adjustment=${ADJUSTMENT_ID}`,
        connectorKind: null,
        configurationVersion: null,
        runtimeVersion: null,
        resolved: false,
        resolvedAt: null,
        ageSeconds: 130,
      },
      {
        exceptionId: `VISIT_PROVIDER:${VISIT_ID}`,
        source: 'VISIT_PROVIDER',
        severity: 'ERROR',
        status: 'ACTIVE',
        title: 'Visit provider requires review',
        impact: 'Reconcile the exact visit delivery.',
        code: 'VISIT_PROVIDER_RESULT_UNKNOWN',
        detectedAt: NOW,
        version: 5,
        evidence: ['State=RESULT_UNKNOWN'],
        action: 'REVIEW_VISIT',
        actionHref: `/workplace/admin/visits?visit=${VISIT_ID}`,
        connectorKind: null,
        configurationVersion: null,
        runtimeVersion: null,
        resolved: false,
        resolvedAt: null,
        ageSeconds: 120,
      },
      {
        exceptionId: `ACCESS_PASS:${PASS_ID}`,
        source: 'ACCESS_PASS',
        severity: 'ERROR',
        status: 'MANUAL_REVIEW',
        title: 'Access-pass pairing requires review',
        impact: 'Open the exact destination credential context.',
        code: 'ACCESS_PASS_PAIRING_RETRY_EXHAUSTED',
        detectedAt: NOW,
        version: 3,
        evidence: ['State=PAIRING_RETRY_EXHAUSTED'],
        action: 'REVIEW_ACCESS_PASS',
        actionHref: null,
        connectorKind: null,
        configurationVersion: null,
        runtimeVersion: null,
        resolved: false,
        resolvedAt: null,
        ageSeconds: 110,
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
    sourceCoverage: (
      [
        ['SAFETY', 1],
        ['BOOKING', 1],
        ['CONNECTOR', 1],
        ['DEVICE_COMMAND', 1],
        ['SERVICE_ORDER', 1],
        ['SERVICE_PROVIDER', 1],
        ['SERVICE_REFUND', 1],
        ['VISIT_PROVIDER', 1],
        ['ACCESS_PASS', 1],
      ] as const
    ).map(([source, count]) => ({
      source,
      unresolvedCount: count,
      returnedCount: count,
      truncated: false,
    })),
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
      rowCount: 9,
      purpose: 'Verified incident review',
      createdAt: NOW,
      expiresAt: '2026-09-17T03:10:00Z',
    });
  });
  await page.route('**/api/platform/v1/admin/workplace/exceptions/exports', (route) => {
    evidence.exportCommands.push({ headers: headers(route), body: body(route) });
    return fulfillSuccess(route, {
      commandId: COMMAND_ID,
      rowCount: 9,
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
  await console.getByText('Device command outcome requires review').click();
  await expect(console.getByText(/Automatic recovery has stopped/u)).toBeVisible();
  await console.getByText('Access-pass pairing requires review').click();
  await expect(console.getByText(/No administrator-authorized owner view exists/u)).toBeVisible();
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
  await expect(exportDialog.getByText(/9 sanitized exception rows/u)).toBeVisible();
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

test('round-trips every operational exception to its exact owner target', async ({ page }) => {
  await setup(page, true);
  const targets = [
    [
      'Device command outcome requires review',
      `/workplace/admin/devices?device=${DEVICE_ID}&command=${DEVICE_COMMAND_ID}`,
    ],
    [
      'Service order outcome requires review',
      `/workplace/admin/service-fulfillment?order=${SERVICE_ORDER_ID}`,
    ],
    [
      'Service provider requires review',
      '/workplace/admin/service-providers?provider=ACCESS_CONTROL',
    ],
    [
      'Service refund requires review',
      `/workplace/admin/service-fulfillment?order=${SERVICE_ORDER_ID}&adjustment=${ADJUSTMENT_ID}`,
    ],
    ['Visit provider requires review', `/workplace/admin/visits?visit=${VISIT_ID}`],
  ] as const;

  for (const [title, expectedTarget] of targets) {
    await page.goto('/workplace/admin/exceptions');
    const console = page.getByRole('main');
    await console.getByText(title, { exact: true }).first().click();
    await console.getByRole('button', { name: 'Open owner workflow' }).click();
    await expect
      .poll(() => {
        const current = new URL(page.url());
        return `${current.pathname}${current.search}`;
      })
      .toBe(expectedTarget);
  }
});
