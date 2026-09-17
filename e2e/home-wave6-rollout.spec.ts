import { expect, test } from '@playwright/test';

import {
  createHomeWave4Model,
  HOME_V2_ROUTE,
  homeWave4ResponseBody,
  homeWave4ResponseHeaders,
  withHomeWave6DismissCommand,
  withHomeWave6Runtime,
} from './support/home-wave4-runtime-fixtures';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

import type { Page, Route } from '@playwright/test';
import type {
  HomeDeviceClass,
  HomeV2RuntimeState,
  HomeV2ShadowReceiptRequest,
} from '@dwp-frontend/shared-utils';

const FIXED_NOW = new Date('2026-09-16T00:00:30Z');
const DEVICE_CLASSES = new Set<HomeDeviceClass>([
  'DESKTOP_WIDE',
  'DESKTOP_STANDARD',
  'MOBILE_STANDARD',
  'MOBILE_COMPACT',
]);

type RuntimeControl = {
  commandStatus: 202 | 403 | 503;
  omitHeader?: string;
  registryMismatch?: boolean;
  state: Exclude<HomeV2RuntimeState, 'DISABLED'>;
};

type RuntimeEvidence = {
  commands: Array<
    Readonly<{
      body: unknown;
      expectedDecisionRevision: string | undefined;
      idempotencyKey: string | undefined;
      query: string;
    }>
  >;
  legacyRequests: string[];
  shadowReceipts: HomeV2ShadowReceiptRequest[];
  shadowReceiptDecisionRevisions: Array<string | undefined>;
};

async function prepare(page: Page): Promise<void> {
  await page.clock.setFixedTime(FIXED_NOW);
  await page.setViewportSize({ width: 1280, height: 900 });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
}

function runtimeRoot(page: Page) {
  return page.locator('[data-home-runtime-path]');
}

async function routeWave6Runtime(page: Page, control: RuntimeControl): Promise<RuntimeEvidence> {
  const evidence: RuntimeEvidence = {
    commands: [],
    legacyRequests: [],
    shadowReceipts: [],
    shadowReceiptDecisionRevisions: [],
  };
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith('/api/platform/v1/home')) evidence.legacyRequests.push(pathname);
  });
  await page.route(HOME_V2_ROUTE, async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/api/platform/v2/home/shadow-receipts') {
      evidence.shadowReceipts.push(request.postDataJSON() as HomeV2ShadowReceiptRequest);
      evidence.shadowReceiptDecisionRevisions.push(
        request.headers()['x-dwp-expected-decision-revision']
      );
      return route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'SUCCESS',
          data: { accepted: true, receiptVersion: 'home-shadow-v1' },
        }),
      });
    }
    if (url.pathname === '/api/platform/v2/home/widget-actions:execute') {
      evidence.commands.push({
        body: request.postDataJSON(),
        expectedDecisionRevision: request.headers()['x-dwp-expected-decision-revision'],
        idempotencyKey: request.headers()['idempotency-key'],
        query: url.search,
      });
      if (control.commandStatus !== 202) {
        return route.fulfill({
          status: control.commandStatus,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ERROR', errorCode: 'HOME_OWNER_ACTION_REJECTED' }),
        });
      }
      const commandId = request.headers()['idempotency-key'];
      return route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'SUCCESS',
          data: {
            receiptId: '77777777-7777-4777-8777-777777777777',
            commandId,
            commandKey: 'home.recommendation.dismiss',
            status: 'ACCEPTED',
            sourceRoute: '/work',
            acceptedAt: '2026-09-16T00:00:31Z',
            resultVersion: 'recommendation-wave6-2',
          },
        }),
      });
    }
    if (url.pathname !== '/api/platform/v2/home') return route.fallback();
    const deviceClass = url.searchParams.get('deviceClass');
    if (!deviceClass || !DEVICE_CLASSES.has(deviceClass as HomeDeviceClass)) {
      return route.fulfill({ status: 400, body: '{}' });
    }
    const marker = `${control.state.toLowerCase()}-${deviceClass.toLowerCase()}`;
    const base = createHomeWave4Model({
      deviceClass: deviceClass as HomeDeviceClass,
      marker,
      mode: 'CLASSIC',
    });
    const model =
      control.state === 'COMMAND_CANARY'
        ? withHomeWave6DismissCommand(base)
        : withHomeWave6Runtime(base, control.state);
    const runtimeMode = control.state === 'SHADOW_COMPARE' ? 'SHADOW' : 'ACTIVE';
    const headers: Record<string, string> = {
      ...homeWave4ResponseHeaders(runtimeMode, `"${marker}"`, {
        registryAuthoritative: control.registryMismatch,
        runtimeState: control.state,
      }),
    };
    if (control.omitHeader) delete headers[control.omitHeader];
    return route.fulfill({
      status: 200,
      headers,
      contentType: 'application/json',
      body: homeWave4ResponseBody(model),
    });
  });
  return evidence;
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Wave 6 owns an isolated Chromium gate.');
  await prepare(page);
});

test('missing runtime metadata and registry disagreement fail closed without legacy fanout', async ({
  page,
}) => {
  const missing: RuntimeControl = {
    commandStatus: 202,
    omitHeader: 'X-DWP-Home-Runtime-State',
    state: 'READ_ONLY_ACTIVE',
  };
  const evidence = await routeWave6Runtime(page, missing);
  await page.goto('/');

  await expect(runtimeRoot(page)).toHaveAttribute('data-home-runtime-path', 'error');
  await expect(page.getByTestId('home-experience-error')).toBeVisible();
  expect(evidence.legacyRequests).toEqual([]);

  missing.omitHeader = undefined;
  missing.registryMismatch = true;
  await page.reload();
  await expect(runtimeRoot(page)).toHaveAttribute('data-home-runtime-path', 'error');
  await expect(runtimeRoot(page)).toHaveAttribute('data-home-legacy-fanout', 'disabled');
  expect(evidence.legacyRequests).toEqual([]);
});

test('the exact owner command renders only in canary and reports accepted, denied, and unavailable', async ({
  page,
}) => {
  const control: RuntimeControl = {
    commandStatus: 202,
    state: 'READ_ONLY_ACTIVE',
  };
  const evidence = await routeWave6Runtime(page, control);
  await page.goto('/');
  const runtime = runtimeRoot(page);

  await expect(runtime).toHaveAttribute('data-home-command-state', 'disabled');
  await expect(
    page.getByRole('button', { name: 'This recommendation is not relevant' })
  ).toHaveCount(0);

  control.state = 'COMMAND_CANARY';
  await page.reload();
  await expect(runtime).toHaveAttribute('data-home-command-state', 'ready');
  await page.getByRole('button', { name: 'This recommendation is not relevant' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Hide this recommendation?' })).toBeVisible();
  await page.getByRole('button', { name: 'Hide recommendation' }).click();
  await expect(runtime).toHaveAttribute('data-home-command-state', 'accepted');
  await expect(page.getByText('The recommendation action was accepted.')).toBeVisible();

  expect(evidence.commands).toHaveLength(1);
  expect(evidence.commands[0]?.idempotencyKey).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
  );
  expect(evidence.commands[0]?.expectedDecisionRevision).toBe('home-route-decision-r1');
  expect(evidence.commands[0]?.query).toBe(
    '?deviceClass=DESKTOP_STANDARD&mode=CLASSIC&timeZone=Asia%2FSeoul'
  );
  expect(evidence.commands[0]?.body).toEqual({
    instanceId: '66666666-6666-4666-8666-666666666666',
    actionId: 'dismiss-recommendation',
    expectedResultVersion: 'recommendation-wave6-1',
    parameters: { recommendationKey: 'wave6-daily-focus' },
  });

  for (const scenario of [
    { status: 403 as const, state: 'denied', message: 'This action is no longer allowed.' },
    {
      status: 503 as const,
      state: 'unavailable',
      message: 'The recommendation owner is temporarily unavailable.',
    },
  ]) {
    control.commandStatus = scenario.status;
    await page.reload();
    await expect(runtime).toHaveAttribute('data-home-command-state', 'ready');
    await page.getByRole('button', { name: 'This recommendation is not relevant' }).first().click();
    await page.getByRole('button', { name: 'Hide recommendation' }).click();
    await expect(runtime).toHaveAttribute('data-home-command-state', scenario.state);
    await expect(page.getByText(scenario.message)).toBeVisible();
  }
});

test('ACTIVE to SHADOW rollback preserves a dirty draft and shadow receipts stay aggregate-only', async ({
  page,
}) => {
  const control: RuntimeControl = { commandStatus: 202, state: 'SHADOW_COMPARE' };
  const evidence = await routeWave6Runtime(page, control);
  await page.goto('/?edit=home');
  const runtime = runtimeRoot(page);
  const toolbar = page.locator('[data-workspace-composer-placement="floating"]');

  await expect(runtime).toHaveAttribute('data-home-runtime-state', 'shadow_compare');
  await expect(toolbar).toBeVisible();
  await toolbar.getByRole('button', { name: 'Focused', exact: true }).click();
  await expect(toolbar).toHaveAttribute('data-home-content-state', 'dirty');
  await expect.poll(() => evidence.shadowReceipts.length).toBeGreaterThan(0);
  const receipt = evidence.shadowReceipts.at(-1)!;
  expect(Object.keys(receipt).sort()).toEqual(
    [
      'schemaVersion',
      'outcome',
      'reasons',
      'mismatchCount',
      'homeMode',
      'deviceClass',
      'runtimeState',
      'rolloutRing',
      'rolloutRevision',
    ].sort()
  );
  expect(JSON.stringify(receipt)).not.toMatch(
    /tenant|user|person|widgetKey|instanceId|sourceRoute|payload/iu
  );
  expect(receipt.deviceClass).toBe('DESKTOP_STANDARD');
  expect(evidence.shadowReceiptDecisionRevisions.at(-1)).toBe('home-route-decision-r1');

  control.state = 'READ_ONLY_ACTIVE';
  await page.setViewportSize({ width: 1920, height: 900 });
  await expect(runtime).toHaveAttribute('data-home-runtime-state', 'read_only_active');
  await expect(runtime).toHaveAttribute('data-home-runtime-draft-preserved', 'true');
  await expect(toolbar).toHaveCount(0);
  await expect(page.getByTestId('classic-home')).toHaveAttribute(
    'data-home-presentation',
    'balanced'
  );

  control.state = 'SHADOW_COMPARE';
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(runtime).toHaveAttribute('data-home-runtime-state', 'shadow_compare');
  await expect(toolbar).toBeVisible();
  await expect(toolbar).toHaveAttribute('data-home-content-state', 'dirty');
  await expect(toolbar.getByRole('button', { name: 'Focused', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );

  control.state = 'READ_ONLY_ACTIVE';
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(runtime).toHaveAttribute('data-home-runtime-state', 'read_only_active');
  await expect(runtime).toHaveAttribute('data-home-runtime-draft-preserved', 'true');
  await expect(toolbar).toHaveCount(0);
});
