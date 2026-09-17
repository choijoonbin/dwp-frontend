import { mkdir } from 'node:fs/promises';

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

import { mockDwaionAdminStitch } from './support/dwaion-admin-stitch-fixtures';

const EVIDENCE_DIRECTORY =
  '/Users/a10697/Work/DWP/output/admin-settings-implementation-2026-09-17/screenshots';

const viewports = [
  { name: '1440', width: 1440, height: 1000 },
  { name: '390', width: 390, height: 844 },
  { name: '320', width: 320, height: 720 },
  { name: 'zoom-200-equivalent', width: 720, height: 500 },
] as const;

const initialOverview = {
  controlScope: 'ASK_RUNTIME',
  enforcementActivationState: 'DISABLED',
  runtimeControlState: 'ENABLED',
  toolEnforcementState: 'NOT_CONNECTED',
  policy: {
    emergencyDisabled: false,
    allowedModelRoutes: [
      {
        provider: 'OPENAI',
        model: 'approved-enterprise-model',
        region: 'kr',
        availabilityState: 'UNVERIFIED',
        availabilityObservedAt: null,
      },
    ],
    allowedToolKeys: ['CALENDAR.READ'],
    allowedKnowledgeSources: ['WORK_ITEM', 'CALENDAR'],
    maxOutputTokensPerRequest: 900,
    budgetEnforcementMode: 'ENFORCED',
    periodTokenLimit: 1_000_000,
    alertThresholdPercent: 80,
    requireEvaluationPass: true,
    evaluationGateStatus: 'PENDING',
    evaluationEvidenceState: 'UNAVAILABLE',
    evaluationObservedAt: null,
    evaluationPolicyVersion: null,
    policyVersion: 4,
    updatedAt: '2026-09-17T01:00:00Z',
  },
  usage: {
    periodStart: '2026-09-01T00:00:00Z',
    periodEnd: '2026-10-01T00:00:00Z',
    measuredInputTokens: 35_000,
    measuredOutputTokens: 15_000,
    measuredTotalTokens: 50_000,
    reservedTokens: 7_500,
    unmeasuredReservedTokens: 2_500,
    measurementFreshness: 'CURRENT',
    measurementObservedAt: '2026-09-17T01:00:00Z',
    estimatedCostMinor: null,
    billedCostMinor: null,
    currency: null,
    providerUsageState: 'UNAVAILABLE',
    providerPricingState: 'UNAVAILABLE',
    providerBillingState: 'UNAVAILABLE',
  },
  warnings: [
    'PROVIDER_USAGE_UNAVAILABLE',
    'PROVIDER_PRICING_UNAVAILABLE',
    'PROVIDER_BILLING_UNAVAILABLE',
    'AI_TOOL_EXECUTION_NOT_CONNECTED',
    'MODEL_USAGE_MEASUREMENT_MISSING',
  ],
} as const;

type RecordedRequest = {
  method: string;
  path: string;
  body: Record<string, unknown> | null;
};

function success(route: Route, data: unknown) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'OK', success: true, data }),
  });
}

async function prepare(page: Page) {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await mockDwaionAdminStitch(page, {
    safetyPermissionCodes: ['VIEW', 'UPDATE', 'MANAGE'],
  });
  const requests: RecordedRequest[] = [];
  let overview = structuredClone(initialOverview);
  await page.route('**/api/agent/v1/admin/ai-control**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const body = request.postDataJSON() as Record<string, unknown> | null;
    requests.push({ method: request.method(), path: url.pathname, body });

    if (url.pathname.endsWith('/policy') && body) {
      overview = {
        ...overview,
        policy: {
          ...overview.policy,
          ...body,
          policyVersion: overview.policy.policyVersion + 1,
          updatedAt: '2026-09-17T02:00:00Z',
        },
      } as typeof overview;
    }
    if (url.pathname.endsWith('/emergency') && body) {
      const disabled = body.disabled === true;
      overview = {
        ...overview,
        runtimeControlState: disabled ? 'EMERGENCY_DISABLED' : 'ENABLED',
        policy: {
          ...overview.policy,
          emergencyDisabled: disabled,
          policyVersion: overview.policy.policyVersion + 1,
        },
      } as typeof overview;
    }
    return success(route, overview);
  });
  return requests;
}

async function expectUsable(page: Page, context: string) {
  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.scrollWidth, context).toBeLessThanOrEqual(geometry.clientWidth + 1);
  const result = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    result.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    ),
    context
  ).toEqual([]);
}

test.beforeAll(async () => {
  await mkdir(EVIDENCE_DIRECTORY, { recursive: true });
});

for (const viewport of viewports) {
  test(`S19 runtime truth is usable at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await prepare(page);
    await page.goto('/dwaion/admin/safety');

    await expect(
      page.getByRole('heading', {
        name: 'Model, knowledge, usage, and budget enforcement',
      })
    ).toBeVisible();
    await expect(page.getByText('Enforcement off', { exact: true })).toBeVisible();
    await expect(page.getByText('Tool executor not connected', { exact: true })).toBeVisible();
    await expect(page.getByText('Unmeasured reservations awaiting reconciliation')).toBeVisible();
    await expect(page.getByText('No trusted evidence', { exact: true })).toBeVisible();
    await expectUsable(page, `S19 ${viewport.name}`);
    await page.screenshot({
      path: `${EVIDENCE_DIRECTORY}/dwaion-ai-runtime-${viewport.name}.png`,
      fullPage: true,
      animations: 'disabled',
    });
  });
}

test('S19 updates the governed tenant policy without forging external evidence', async ({
  page,
}) => {
  const requests = await prepare(page);
  await page.goto('/dwaion/admin/safety');

  await page.getByRole('button', { name: 'Edit execution policy' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit AI execution policy' });
  await expect(dialog.getByRole('button', { name: 'Save policy' })).toBeDisabled();
  await dialog
    .getByRole('textbox', { name: 'Change reason' })
    .fill('Apply the reviewed tenant model and budget policy.');
  await dialog.getByRole('button', { name: 'Save policy' }).click();

  await expect(page.getByText('The tenant AI execution policy was saved.')).toBeVisible();
  const request = requests.find((item) => item.path.endsWith('/ai-control/policy'));
  expect(request?.method).toBe('PUT');
  expect(request?.body).toMatchObject({
    expectedVersion: 4,
    evaluationGateStatus: 'PENDING',
    evaluationObservedAt: null,
    evaluationPolicyVersion: null,
    allowedModelRoutes: [
      expect.objectContaining({
        provider: 'OPENAI',
        availabilityState: 'UNVERIFIED',
        availabilityObservedAt: null,
      }),
    ],
  });
});

test('S19 emergency stop requires explicit scope confirmation and reports the applied state', async ({
  page,
}) => {
  const requests = await prepare(page);
  await page.goto('/dwaion/admin/safety');

  await page.getByRole('button', { name: 'Emergency stop Ask' }).click();
  const dialog = page.getByRole('dialog', { name: 'Emergency stop DWAI·ON Ask' });
  const submit = dialog.getByRole('button', { name: 'Emergency stop Ask' });
  await expect(submit).toBeDisabled();
  await dialog
    .getByRole('textbox', { name: 'Change reason' })
    .fill('Contain new Ask requests during the reviewed provider incident.');
  await dialog
    .getByRole('switch', { name: 'I reviewed the affected and excluded scopes.' })
    .check();
  await submit.click();

  await expect(page.getByText('Emergency stopped', { exact: true })).toBeVisible();
  const request = requests.find((item) => item.path.endsWith('/ai-control/emergency'));
  expect(request?.method).toBe('POST');
  expect(request?.body).toMatchObject({ disabled: true, expectedVersion: 4 });
});
