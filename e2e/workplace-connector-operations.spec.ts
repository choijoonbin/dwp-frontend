import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';

import type { Page, Route } from '@playwright/test';

const evaluatedAt = '2026-09-16T04:00:00Z';
const previewId = '81000000-0000-4000-8000-000000000021';
const jobId = '82000000-0000-4000-8000-000000000021';
const governedProductKeys = [
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
const connectorKinds = [
  'CALENDAR',
  'ACTUAL_PRESENCE',
  'ACCESS_CONTROL',
  'SIGNAGE',
  'VISITOR',
  'VEHICLE',
  'FACILITY_WORK_ORDER',
] as const;

type SetupOptions = {
  commandRejection?: boolean;
  firstCommandAmbiguousFailure?: 'body-stream' | 'malformed-202' | 'transport' | 408 | 502 | 503;
  elevated?: boolean;
  exposeAcceptedJobAfterTransportFailure?: boolean;
  firstCommandTransportFailure?: boolean;
  firstPreviewTransportFailure?: boolean;
  locale?: 'en' | 'ko';
  metadataFailure?: boolean;
  previewExpiresInMs?: number;
  runtimeFailure?: boolean;
};

type CommandEvidence = {
  previewRequests: Array<{
    headers: Record<string, string>;
    body: Record<string, unknown>;
  }>;
  requests: Array<{
    headers: Record<string, string>;
    body: Record<string, unknown>;
  }>;
  statusReads: number;
};

function successWithStatus(route: Route, data: unknown, status: number) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data }),
  });
}

async function mockAccessMode(page: Page, elevated: boolean) {
  await page.route('**/api/auth/product-surface-contexts', (route) =>
    fulfillSuccess(route, {
      contractVersion: 'product-surfaces/v3',
      decisionRevision: `connector-operations-${elevated ? 'elevated' : 'normal'}`,
      sourceRevisions: {
        auth: 'auth-connector-operations',
        policy: 'policy-connector-operations',
        productRelationship: 'relationship-connector-operations',
      },
      activeAccessMode: elevated ? 'ELEVATED' : 'NORMAL',
      generatedAt: evaluatedAt,
      contexts: [],
      rollouts: governedProductKeys.map((productKey) => ({
        productKey,
        state: '000',
        flags: {
          contextShadow: false,
          capabilityEnforcement: false,
          surfaceUi: false,
        },
        cohort: 'baseline',
        opaqueRevision: `rollout-${productKey}-baseline`,
        authorityStatus: 'NOT_EVALUATED',
      })),
    })
  );
}

function runtimeConnector(kind: (typeof connectorKinds)[number]) {
  const base = {
    kind,
    provider: `${kind.toLowerCase()}-adapter`,
    enabled: true,
    state: 'HEALTHY',
    providerReportedState: 'HEALTHY',
    capabilities: ['HEALTH', 'CHECKPOINT', 'RETRY_QUEUE', 'REPLAY'],
    configurationVersion: 7,
    observedConfigurationVersion: 7,
    runtimeVersion: 11,
    sourceObservedAt: '2026-09-16T03:59:20Z',
    receivedAt: '2026-09-16T03:59:25Z',
    lastSuccessAt: '2026-09-16T03:59:20Z',
    lagSeconds: 40,
    checkpointReference: `cursor:${kind.toLowerCase()}:700`,
    retryQueueDepth: 2,
    deadLetterQueueDepth: 1,
    errorCode: null,
    activeReplayJobId: null,
    evaluatedAt,
  };
  if (kind === 'ACTUAL_PRESENCE') {
    return {
      ...base,
      observedConfigurationVersion: 6,
      lastSuccessAt: null,
    };
  }
  if (kind === 'ACCESS_CONTROL') {
    return {
      ...base,
      state: 'DEGRADED',
      providerReportedState: 'DEGRADED',
      lagSeconds: 420,
      retryQueueDepth: 8,
      errorCode: 'PROVIDER_THROTTLED',
    };
  }
  if (kind === 'SIGNAGE') {
    return {
      ...base,
      state: 'STALE',
      providerReportedState: 'UNAVAILABLE',
      lagSeconds: 3_900,
      errorCode: 'SOURCE_STALE',
    };
  }
  if (kind === 'VISITOR') return { ...base, state: 'REPLAYING' };
  if (kind === 'VEHICLE') {
    return {
      ...base,
      enabled: false,
      state: 'DISABLED',
      providerReportedState: null,
      capabilities: [],
      observedConfigurationVersion: null,
      runtimeVersion: null,
      sourceObservedAt: null,
      receivedAt: null,
      lastSuccessAt: null,
      lagSeconds: null,
      checkpointReference: null,
      retryQueueDepth: null,
      deadLetterQueueDepth: null,
    };
  }
  if (kind === 'FACILITY_WORK_ORDER') {
    return {
      ...base,
      provider: null,
      enabled: false,
      state: 'NOT_CONFIGURED',
      providerReportedState: null,
      capabilities: [],
      configurationVersion: 0,
      observedConfigurationVersion: null,
      runtimeVersion: null,
      sourceObservedAt: null,
      receivedAt: null,
      lastSuccessAt: null,
      lagSeconds: null,
      checkpointReference: null,
      retryQueueDepth: null,
      deadLetterQueueDepth: null,
    };
  }
  return base;
}

function configurationOverview() {
  return {
    policy: { sharingEnabled: false, maximumVisibility: 'SITE', version: 0 },
    connectors: connectorKinds.map((kind) => ({
      kind,
      provider: kind === 'CALENDAR' ? 'calendar-adapter' : null,
      status: kind === 'CALENDAR' ? 'CONFIGURED_UNVERIFIED' : 'NOT_CONFIGURED',
      configurationReference: null,
      lastVerifiedAt: null,
      version: kind === 'CALENDAR' ? 7 : 0,
    })),
    privacy: {
      bookingRetentionDays: 365,
      legalHoldCount: 2,
      anonymizedBookingCount: 4,
      expiredEligibleBookingCount: 3,
      facilityRequestEligibleRetentionCount: 5,
      facilityClosureEligibleRetentionCount: 6,
      facilityRequestsPurgedCount: 7,
      facilityClosuresPurgedCount: 8,
    },
    generatedAt: evaluatedAt,
  };
}

function replayJob(state: 'QUEUED' | 'RESULT_UNKNOWN' | 'SUCCEEDED') {
  return {
    jobId,
    previewId,
    kind: 'CALENDAR',
    provider: 'calendar-adapter',
    state,
    reason: 'Recover failed calendar events for the verified incident',
    providerOperationReference: state === 'SUCCEEDED' ? 'provider-replay-21' : null,
    resultSummary:
      state === 'RESULT_UNKNOWN'
        ? 'Provider dispatch outcome is unknown; query this receipt.'
        : state === 'SUCCEEDED'
          ? '21 failed events were replayed.'
          : null,
    configurationVersion: 7,
    runtimeVersion: 11,
    version: state === 'QUEUED' ? 1 : 2,
    requestedAt: '2026-09-16T04:01:00Z',
    startedAt: state === 'QUEUED' ? null : '2026-09-16T04:01:04Z',
    finishedAt: state === 'SUCCEEDED' ? '2026-09-16T04:01:18Z' : null,
    updatedAt: state === 'QUEUED' ? '2026-09-16T04:01:00Z' : '2026-09-16T04:01:18Z',
  };
}

async function setup(page: Page, options: SetupOptions = {}): Promise<CommandEvidence> {
  const locale = options.locale ?? 'en';
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale,
    permissions: FULL_PRODUCT_PERMISSIONS,
    appearance: {
      mode: 'system',
      density: 'standard',
      highContrast: false,
      reduceMotion: false,
    },
  });
  await mockAccessMode(page, options.elevated ?? false);
  const evidence: CommandEvidence = { previewRequests: [], requests: [], statusReads: 0 };
  const resolvedRuntimeConnector = (kind: (typeof connectorKinds)[number]) => {
    const runtime = runtimeConnector(kind);
    return kind === 'CALENDAR' &&
      options.exposeAcceptedJobAfterTransportFailure &&
      evidence.requests.length > 0
      ? { ...runtime, state: 'REPLAYING', activeReplayJobId: jobId }
      : runtime;
  };
  await page.route('**/api/platform/v1/admin/workplace/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/experience/collaboration/overview')) {
      if (options.metadataFailure) {
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ERROR', message: 'Metadata source unavailable' }),
        });
      }
      return fulfillSuccess(route, configurationOverview());
    }
    if (path.endsWith('/connectors/operations')) {
      if (options.runtimeFailure) {
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ERROR', message: 'Runtime source unavailable' }),
        });
      }
      return fulfillSuccess(route, {
        connectors: connectorKinds.map(resolvedRuntimeConnector),
        generatedAt: evaluatedAt,
      });
    }
    const operation = path.match(/\/connectors\/([^/]+)\/operations$/u);
    if (operation) {
      const kind = operation[1] as (typeof connectorKinds)[number];
      return fulfillSuccess(route, resolvedRuntimeConnector(kind));
    }
    if (path.endsWith('/connectors/CALENDAR/replays:preview')) {
      const body = request.postDataJSON() as Record<string, unknown>;
      evidence.previewRequests.push({ headers: request.headers(), body });
      if (options.firstPreviewTransportFailure && evidence.previewRequests.length === 1) {
        return route.abort('connectionfailed');
      }
      return fulfillSuccess(route, {
        previewId,
        kind: 'CALENDAR',
        provider: 'calendar-adapter',
        from: body.from,
        to: body.to,
        failedOnly: body.failedOnly,
        maximumRecords: body.maximumRecords,
        estimatedRecords: 21,
        eligible: true,
        limitations: ['Replay does not recreate provider events already acknowledged.'],
        configurationVersion: body.configurationVersion,
        runtimeVersion: body.runtimeVersion,
        expiresAt: new Date(Date.now() + (options.previewExpiresInMs ?? 300_000)).toISOString(),
        createdAt: new Date().toISOString(),
      });
    }
    if (path.endsWith('/connectors/CALENDAR/replays') && request.method() === 'POST') {
      evidence.requests.push({
        headers: request.headers(),
        body: request.postDataJSON() as Record<string, unknown>,
      });
      const ambiguousFailure =
        options.firstCommandAmbiguousFailure ??
        (options.firstCommandTransportFailure ? 'transport' : null);
      if (ambiguousFailure === 'transport' && evidence.requests.length === 1) {
        return route.abort('connectionfailed');
      }
      if (ambiguousFailure === 'body-stream' && evidence.requests.length === 1) {
        return route.abort('connectionreset');
      }
      if (ambiguousFailure === 'malformed-202' && evidence.requests.length === 1) {
        return route.fulfill({ status: 202, contentType: 'application/json', body: '{' });
      }
      if (typeof ambiguousFailure === 'number' && evidence.requests.length === 1) {
        return route.fulfill({
          status: ambiguousFailure,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ERROR', message: 'Upstream response unavailable' }),
        });
      }
      if (options.commandRejection) {
        return route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ERROR', message: 'Preview version changed' }),
        });
      }
      const job = replayJob('QUEUED');
      return successWithStatus(
        route,
        {
          job,
          receipt: {
            commandId: jobId,
            state: 'QUEUED',
            acceptedAt: job.requestedAt,
            statusHref: `/v1/admin/workplace/connectors/CALENDAR/replays/${jobId}`,
            idempotentReplay: false,
            correlationId: request.headers()['x-correlation-id'],
          },
        },
        202
      );
    }
    if (path.endsWith(`/connectors/CALENDAR/replays/${jobId}`)) {
      evidence.statusReads += 1;
      return fulfillSuccess(
        route,
        replayJob(evidence.statusReads === 1 ? 'RESULT_UNKNOWN' : 'SUCCEEDED')
      );
    }
    return route.fallback();
  });
  return evidence;
}

async function expectNoHorizontalOverflow(page: Page) {
  const dataSources = page.getByTestId('workplace-data-sources');
  const sizing = await dataSources.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(sizing.scrollWidth, JSON.stringify(sizing)).toBeLessThanOrEqual(sizing.clientWidth + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => window.innerWidth + 1)
  );
}

test('verified runtime truth stays separate from metadata and replay recovers RESULT_UNKNOWN by receipt', async ({
  page,
}, testInfo) => {
  const evidence = await setup(page, { elevated: true });
  await page.goto('/workplace/admin/governance?area=dataSources');
  const dataSources = page.getByTestId('workplace-data-sources');
  await expect(dataSources.getByRole('heading', { name: 'Connector runtime truth' })).toBeVisible();
  await expect(
    dataSources.getByRole('heading', { name: 'Workplace data connections' })
  ).toBeVisible();
  await expect(dataSources.getByText('Reference time:', { exact: false })).toBeVisible();
  await expect(dataSources.getByText('Healthy 1', { exact: true })).toBeVisible();
  await expect(dataSources.getByText('Replaying 1', { exact: true })).toBeVisible();

  const actualPresence = dataSources.getByRole('button', { name: /Actual presence connector/u });
  await actualPresence.focus();
  await page.keyboard.press('Space');
  await expect(actualPresence).toHaveAttribute('aria-pressed', 'true');
  await expect(
    dataSources.getByText(
      'Current provider evidence does not match the saved provider and configuration version.',
      { exact: false }
    )
  ).toBeVisible();
  await expect(actualPresence.getByText('Awaiting verification', { exact: true })).toBeVisible();

  const calendar = dataSources.getByRole('button', { name: /Calendar connector/u });
  await calendar.click();
  await expect(calendar.getByText('Healthy', { exact: true })).toBeVisible();
  await expect(dataSources.getByText('cursor:calendar:700', { exact: true })).toBeVisible();
  await expect(dataSources.getByText('40 seconds', { exact: true })).toBeVisible();

  const axe = await new AxeBuilder({ page })
    .include('[data-testid="workplace-data-sources"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(
    axe.violations.filter((issue) => ['serious', 'critical'].includes(issue.impact ?? '')),
    JSON.stringify(axe.violations)
  ).toEqual([]);

  const responsiveWidths =
    testInfo.project.name === 'mobile' ? ([390] as const) : ([1440, 1280, 390, 320, 640] as const);
  for (const width of responsiveWidths) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      dataSources.getByRole('heading', { name: 'Connector runtime truth' })
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({
      path: `/tmp/workplace-connector-operations-${testInfo.project.name}-${width}.png`,
      fullPage: true,
    });
  }

  if (testInfo.project.name !== 'mobile') {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await expect(dataSources.getByRole('button', { name: 'Refresh' })).toBeVisible();
    await page.screenshot({
      path: `/tmp/workplace-connector-operations-${testInfo.project.name}-dark.png`,
      fullPage: true,
    });
    await page.emulateMedia({
      colorScheme: 'light',
      forcedColors: 'active',
      reducedMotion: 'reduce',
    });
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      path: `/tmp/workplace-connector-operations-${testInfo.project.name}-high-contrast.png`,
      fullPage: true,
    });
    await page.emulateMedia({
      colorScheme: 'light',
      forcedColors: 'none',
      reducedMotion: 'no-preference',
    });
  }

  await dataSources.getByRole('button', { name: 'Review replay' }).click();
  const workflow = dataSources.getByTestId('workplace-connector-replay-workflow');
  await workflow.getByRole('button', { name: 'Preview replay impact' }).click();
  await expect(workflow.getByText('Estimated impact: 21 records.', { exact: false })).toBeVisible();
  await expect(
    workflow.getByText('Replay does not recreate provider events already acknowledged.')
  ).toBeVisible();
  await workflow
    .getByRole('textbox', { name: 'Replay reason' })
    .fill('Recover failed calendar events for the verified incident');
  await workflow
    .getByRole('checkbox', {
      name: 'I reviewed the time range, estimated impact and current connector versions.',
    })
    .check();
  const start = workflow.getByRole('button', { name: 'Start confirmed replay' });
  await expect(start).toBeEnabled();
  await start.click();

  const status = dataSources.getByTestId('workplace-connector-replay-status');
  await expect(status.getByText('The provider result is unknown.', { exact: false })).toBeVisible({
    timeout: 8_000,
  });
  expect(evidence.requests).toHaveLength(1);
  expect(evidence.requests[0]?.headers['x-dwp-active-access-mode']).toBe('ELEVATED');
  expect(evidence.requests[0]?.headers['idempotency-key']).toMatch(/^workplace:connector-replay:/u);
  expect(evidence.requests[0]?.body).toMatchObject({
    previewId,
    configurationVersion: 7,
    runtimeVersion: 11,
    reason: 'Recover failed calendar events for the verified incident',
    explicitConfirmation: true,
  });
  await status.getByRole('button', { name: 'Re-check status' }).click();
  await expect(status.getByText('Replay completed successfully.')).toBeVisible();
  await expect(status.getByText('provider-replay-21')).toBeVisible();
  expect(evidence.statusReads).toBeGreaterThanOrEqual(2);
});

test('normal access explains step-up and cannot create a persisted replay preview', async ({
  page,
}) => {
  const evidence = await setup(page, { locale: 'ko' });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/workplace/admin/governance?area=dataSources');
  const dataSources = page.getByTestId('workplace-data-sources');
  await expect(dataSources.getByRole('heading', { name: '연계 Runtime 진실 상태' })).toBeVisible();
  await expect(
    dataSources.getByRole('heading', { name: '근무공간 데이터 연계 운영' })
  ).toBeVisible();
  await dataSources.getByRole('button', { name: /캘린더 연계/u }).click();
  await dataSources.getByRole('button', { name: '재처리 검토' }).click();
  const workflow = dataSources.getByTestId('workplace-connector-replay-workflow');
  await expect(
    workflow.getByText('현재 세션을 상승 권한으로 전환하세요.', { exact: false })
  ).toBeVisible();
  await expect(workflow.getByRole('button', { name: '재처리 영향 미리보기' })).toBeDisabled();
  await expect(workflow.getByRole('textbox', { name: '재처리 사유' })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  expect(evidence.requests).toHaveLength(0);
});

test('an interrupted replay command recovers its receipt with the same idempotency key', async ({
  page,
}) => {
  const evidence = await setup(page, {
    elevated: true,
    firstCommandTransportFailure: true,
  });
  await page.goto('/workplace/admin/governance?area=dataSources');
  const dataSources = page.getByTestId('workplace-data-sources');
  await dataSources.getByRole('button', { name: /Calendar connector/u }).click();
  await dataSources.getByRole('button', { name: 'Review replay' }).click();
  const workflow = dataSources.getByTestId('workplace-connector-replay-workflow');
  await workflow.getByRole('button', { name: 'Preview replay impact' }).click();
  await workflow
    .getByRole('textbox', { name: 'Replay reason' })
    .fill('Recover the receipt for this exact reviewed replay');
  await workflow
    .getByRole('checkbox', {
      name: 'I reviewed the time range, estimated impact and current connector versions.',
    })
    .check();
  await workflow.getByRole('button', { name: 'Start confirmed replay' }).click();
  await expect(
    workflow.getByText('The command response was interrupted.', { exact: false })
  ).toBeVisible();
  await expect(workflow.getByRole('button', { name: 'Close' })).toBeDisabled();
  await page.reload();
  const restoredDataSources = page.getByTestId('workplace-data-sources');
  const restoredWorkflow = restoredDataSources.getByTestId('workplace-connector-replay-workflow');
  await expect(
    restoredWorkflow.getByText('The command response was interrupted.', { exact: false })
  ).toBeVisible();
  await expect(restoredWorkflow.getByRole('textbox', { name: 'Replay reason' })).toBeDisabled();
  await expect(restoredWorkflow.getByRole('button', { name: 'Close' })).toBeDisabled();
  await restoredWorkflow.getByRole('button', { name: 'Recover receipt' }).click();
  const status = restoredDataSources.getByTestId('workplace-connector-replay-status');
  await expect(status.getByText('The provider result is unknown.', { exact: false })).toBeVisible({
    timeout: 8_000,
  });
  await expect(status.getByText(jobId)).toBeVisible();

  expect(evidence.requests).toHaveLength(2);
  const firstKey = evidence.requests[0]?.headers['idempotency-key'];
  expect(firstKey).toMatch(/^workplace:connector-replay:/u);
  expect(evidence.requests[1]?.headers['idempotency-key']).toBe(firstKey);
  expect(evidence.requests[1]?.headers['x-correlation-id']).toBe(
    evidence.requests[0]?.headers['x-correlation-id']
  );
  expect(evidence.requests[1]?.body).toEqual(evidence.requests[0]?.body);
  expect(
    await page.evaluate(() =>
      Object.keys(sessionStorage).filter((key) =>
        key.startsWith('dwp.workplace.connector-replay-command.v1:')
      )
    )
  ).toEqual([]);
});

for (const failure of ['body-stream', 'malformed-202', 408, 502, 503] as const) {
  test(`an ambiguous ${failure} response preserves the exact replay command`, async ({ page }) => {
    const evidence = await setup(page, {
      elevated: true,
      firstCommandAmbiguousFailure: failure,
    });
    await page.goto('/workplace/admin/governance?area=dataSources');
    const workflow = page
      .getByTestId('workplace-data-sources')
      .getByTestId('workplace-connector-replay-workflow');
    await page
      .getByTestId('workplace-data-sources')
      .getByRole('button', { name: /Calendar connector/u })
      .click();
    await page
      .getByTestId('workplace-data-sources')
      .getByRole('button', { name: 'Review replay' })
      .click();
    await workflow.getByRole('button', { name: 'Preview replay impact' }).click();
    await workflow
      .getByRole('textbox', { name: 'Replay reason' })
      .fill(`Recover after ambiguous ${failure} response`);
    await workflow
      .getByRole('checkbox', {
        name: 'I reviewed the time range, estimated impact and current connector versions.',
      })
      .check();
    await workflow.getByRole('button', { name: 'Start confirmed replay' }).click();

    await expect(
      workflow.getByText('The command response was interrupted.', { exact: false })
    ).toBeVisible();
    await expect(workflow.getByRole('button', { name: 'Close' })).toBeDisabled();
    await workflow.getByRole('button', { name: 'Recover receipt' }).click();
    await expect(
      page.getByTestId('workplace-data-sources').getByTestId('workplace-connector-replay-status')
    ).toBeVisible();

    expect(evidence.requests).toHaveLength(2);
    expect(evidence.requests[1]).toEqual(evidence.requests[0]);
  });
}

test('a definitive replay rejection clears recovery evidence and unlocks reviewed input', async ({
  page,
}) => {
  const evidence = await setup(page, { elevated: true, commandRejection: true });
  await page.goto('/workplace/admin/governance?area=dataSources');
  const dataSources = page.getByTestId('workplace-data-sources');
  await dataSources.getByRole('button', { name: /Calendar connector/u }).click();
  await dataSources.getByRole('button', { name: 'Review replay' }).click();
  const workflow = dataSources.getByTestId('workplace-connector-replay-workflow');
  await workflow.getByRole('button', { name: 'Preview replay impact' }).click();
  const reason = workflow.getByRole('textbox', { name: 'Replay reason' });
  await reason.fill('Verify definitive rejection cleanup');
  await workflow
    .getByRole('checkbox', {
      name: 'I reviewed the time range, estimated impact and current connector versions.',
    })
    .check();
  await workflow.getByRole('button', { name: 'Start confirmed replay' }).click();

  await expect(
    workflow.getByText('The replay command was rejected.', { exact: false })
  ).toBeVisible();
  await expect(reason).toBeEnabled();
  await expect(workflow.getByRole('button', { name: 'Close' })).toBeEnabled();
  expect(evidence.requests).toHaveLength(1);
  expect(
    await page.evaluate(() =>
      Object.keys(sessionStorage).filter((key) =>
        key.startsWith('dwp.workplace.connector-replay-command.v1:')
      )
    )
  ).toEqual([]);
});

test('reload reconciles an accepted uncertain command by status without resending it', async ({
  page,
}) => {
  const evidence = await setup(page, {
    elevated: true,
    firstCommandTransportFailure: true,
    exposeAcceptedJobAfterTransportFailure: true,
  });
  await page.goto('/workplace/admin/governance?area=dataSources');
  const dataSources = page.getByTestId('workplace-data-sources');
  await dataSources.getByRole('button', { name: /Calendar connector/u }).click();
  await dataSources.getByRole('button', { name: 'Review replay' }).click();
  const workflow = dataSources.getByTestId('workplace-connector-replay-workflow');
  await workflow.getByRole('button', { name: 'Preview replay impact' }).click();
  await workflow
    .getByRole('textbox', { name: 'Replay reason' })
    .fill('Reconcile the accepted command through authoritative status');
  await workflow
    .getByRole('checkbox', {
      name: 'I reviewed the time range, estimated impact and current connector versions.',
    })
    .check();
  await workflow.getByRole('button', { name: 'Start confirmed replay' }).click();
  await expect(
    workflow.getByText('The command response was interrupted.', { exact: false })
  ).toBeVisible();

  await page.reload();
  const restoredDataSources = page.getByTestId('workplace-data-sources');
  await expect(
    restoredDataSources
      .getByTestId('workplace-connector-replay-status')
      .getByText('The provider result is unknown.', { exact: false })
  ).toBeVisible({ timeout: 8_000 });
  expect(evidence.requests).toHaveLength(1);
  expect(
    await page.evaluate(() =>
      Object.keys(sessionStorage).filter((key) =>
        key.startsWith('dwp.workplace.connector-replay-command.v1:')
      )
    )
  ).toEqual([]);
});

test('an interrupted preview request reuses the exact payload and idempotency key', async ({
  page,
}) => {
  const evidence = await setup(page, {
    elevated: true,
    firstPreviewTransportFailure: true,
  });
  await page.goto('/workplace/admin/governance?area=dataSources');
  const dataSources = page.getByTestId('workplace-data-sources');
  await dataSources.getByRole('button', { name: /Calendar connector/u }).click();
  await dataSources.getByRole('button', { name: 'Review replay' }).click();
  const workflow = dataSources.getByTestId('workplace-connector-replay-workflow');
  const preview = workflow.getByRole('button', { name: 'Preview replay impact' });
  await preview.click();
  await expect(
    workflow.getByText('The preview response was interrupted.', { exact: false })
  ).toBeVisible();
  await expect(workflow.getByRole('button', { name: 'Close' })).toBeDisabled();
  const exactRetry = workflow.getByRole('button', { name: 'Retry exact preview' });
  await exactRetry.click();
  await expect(workflow.getByTestId('workplace-connector-replay-impact')).toBeVisible();

  expect(evidence.previewRequests).toHaveLength(2);
  const firstKey = evidence.previewRequests[0]?.headers['idempotency-key'];
  expect(firstKey).toMatch(/^workplace:connector-replay-preview:/u);
  expect(evidence.previewRequests[1]?.headers['idempotency-key']).toBe(firstKey);
  expect(evidence.previewRequests[1]?.headers['x-correlation-id']).toBe(
    evidence.previewRequests[0]?.headers['x-correlation-id']
  );
  expect(evidence.previewRequests[1]?.body).toEqual(evidence.previewRequests[0]?.body);

  await workflow.getByRole('button', { name: 'Preview replay impact' }).click();
  expect(evidence.previewRequests).toHaveLength(3);
  expect(evidence.previewRequests[2]?.headers['idempotency-key']).not.toBe(firstKey);
  expect(evidence.previewRequests[2]?.headers['x-correlation-id']).not.toBe(
    evidence.previewRequests[1]?.headers['x-correlation-id']
  );
});

test('an eligible preview expires in place and requires a fresh preview before execution', async ({
  page,
}) => {
  const evidence = await setup(page, { elevated: true, previewExpiresInMs: 700 });
  await page.goto('/workplace/admin/governance?area=dataSources');
  const dataSources = page.getByTestId('workplace-data-sources');
  await dataSources.getByRole('button', { name: /Calendar connector/u }).click();
  await dataSources.getByRole('button', { name: 'Review replay' }).click();
  const workflow = dataSources.getByTestId('workplace-connector-replay-workflow');
  await workflow.getByRole('button', { name: 'Preview replay impact' }).click();
  await expect(workflow.getByTestId('workplace-connector-replay-impact')).toBeVisible();
  await expect(
    workflow.getByText('This preview expired. Create a fresh preview', { exact: false })
  ).toBeVisible({ timeout: 3_000 });
  await expect(workflow.getByRole('textbox', { name: 'Replay reason' })).toBeDisabled();
  await expect(workflow.getByRole('button', { name: 'Start confirmed replay' })).toBeDisabled();

  await workflow.getByRole('button', { name: 'Create a fresh preview' }).click();
  await expect.poll(() => evidence.previewRequests.length).toBe(2);
  expect(evidence.previewRequests[1]?.headers['idempotency-key']).not.toBe(
    evidence.previewRequests[0]?.headers['idempotency-key']
  );
});

test('runtime source failure leaves saved configuration usable without inventing health', async ({
  page,
}) => {
  await setup(page, { runtimeFailure: true });
  await page.goto('/workplace/admin/governance?area=dataSources');
  const dataSources = page.getByTestId('workplace-data-sources');
  await expect(
    dataSources.getByText(
      'Connector runtime evidence could not be loaded. Saved configuration remains available below.'
    )
  ).toBeVisible({ timeout: 10_000 });
  await expect(
    dataSources.getByRole('heading', { name: 'Workplace data connections' })
  ).toBeVisible();
  await expect(dataSources.getByRole('region', { name: 'Calendar connector' })).toBeVisible();
  await expect(dataSources.getByText(/^Healthy \d+$/u)).toHaveCount(0);
  await expect(
    dataSources.getByText('Configured, awaiting verification', { exact: true })
  ).toBeVisible();
});

test('metadata source failure leaves verified runtime evidence usable', async ({ page }) => {
  await setup(page, { metadataFailure: true });
  await page.goto('/workplace/admin/governance?area=dataSources');
  const dataSources = page.getByTestId('workplace-data-sources');
  await expect(dataSources.getByRole('heading', { name: 'Connector runtime truth' })).toBeVisible();
  await expect(dataSources.getByText('Healthy 1', { exact: true })).toBeVisible();
  await dataSources.getByRole('button', { name: /Calendar connector/u }).click();
  await expect(dataSources.getByText('cursor:calendar:700', { exact: true })).toBeVisible();
  await expect(dataSources.getByText('The governance data could not be loaded.')).toBeVisible({
    timeout: 10_000,
  });
  await expect(
    dataSources.getByRole('heading', { name: 'Workplace data connections' })
  ).toHaveCount(0);
});
