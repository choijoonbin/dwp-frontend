import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';

import { DEFAULT_APP_PERMISSIONS } from './support/runtime-access';
import { mockShellSession } from './support/shell-session';

import type { BrowserContext, Page, Route } from '@playwright/test';

const SUPPORT_REVISION_CHANNEL = 'dwp:provider-support-context:revision:v1';
const PREVIEW_PATH = '/api/platform/v1/admin/tenant-experience-preview';
const SUPPORT_CONTEXT_PATH = '/api/provider/v1/admin/support-session-context';
const PREVIEW_FRESHNESS_BUDGET_MS = 10_000;
const SUPPORT_EVIDENCE_NOW = new Date('2026-08-27T01:45:00.000Z');
const SUPPORT_EVIDENCE_EXPIRES_AT = '2026-08-27T02:00:00.000Z';
const supportClockInstallations = new WeakMap<BrowserContext, Promise<void>>();

type SupportTarget = {
  supportSessionId: string;
  tenantId: string;
  tenantKey: string;
  tenantName: string;
  environmentKey: string;
  dataRegion: string;
  version: number;
};

type PreviewRevision = {
  headline: string;
  homeVersion: number;
};

const targetA: SupportTarget = {
  supportSessionId: 'support-tenant-a-00000001',
  tenantId: 'tenant-a',
  tenantKey: 'tenant-a-production',
  tenantName: 'Tenant A Production',
  environmentKey: 'production',
  dataRegion: 'ap-northeast-2',
  version: 1,
};

const targetB: SupportTarget = {
  supportSessionId: 'support-tenant-b-00000002',
  tenantId: 'tenant-b',
  tenantKey: 'tenant-b-production',
  tenantName: 'Tenant B Production',
  environmentKey: 'production',
  dataRegion: 'us-east-1',
  version: 2,
};

function previewFixture(target: SupportTarget, revision: PreviewRevision) {
  return {
    contractVersion: 'tenant-experience-preview.v1',
    previewMode: 'TENANT_CONFIGURATION_ONLY',
    generatedAt: '2026-08-27T01:00:00.000Z',
    branding: {
      organizationName: target.tenantName,
      accentColor: target.tenantId === 'tenant-a' ? '#2457D6' : '#265E45',
      logoConfigured: false,
      logoWidth: null,
      logoHeight: null,
      version: 3,
    },
    home: {
      headline: revision.headline,
      subheadline: 'Deterministic redacted configuration',
      localizedContent: {},
      defaultLocale: 'en',
      backgroundConfigured: false,
      backgroundPosition: 'CENTER',
      backgroundFocalX: 50,
      backgroundFocalY: 50,
      mobileBackgroundFocalX: 50,
      mobileBackgroundFocalY: 50,
      contentAlignment: 'LEFT',
      overlayOpacity: 20,
      backgroundWidth: null,
      backgroundHeight: null,
      launchpadConfiguration: {
        schemaVersion: 1,
        groups: [
          {
            groupKey: 'work',
            labels: { en: 'Work' },
            descriptions: {},
            sortOrder: 1,
            enabled: true,
          },
        ],
        placements: [{ resourceKey: 'APP.MAIL', groupKey: 'work', sortOrder: 1 }],
      },
      compositionPolicy: {
        schemaVersion: 3,
        experienceVariant: 'FLOW_V1',
        personalCustomizationEnabled: true,
        governedZones: [],
      },
      effectiveExperienceVariant: 'FLOW_V1',
      version: revision.homeVersion,
    },
    excludedData: [
      'USER_PERSONALIZATION',
      'USER_CONTENT',
      'WORKFORCE_DATA',
      'LIVE_ANNOUNCEMENTS',
      'ASSET_LOCATIONS',
      'AUDIT_ACTOR_METADATA',
    ],
  };
}

async function configureSupportPage(
  page: Page,
  currentTarget: () => SupportTarget | null,
  currentPreview: () => PreviewRevision,
  observations: { previewRequests: string[]; streamAttempts: string[] }
) {
  const context = page.context();
  let clockInstallation = supportClockInstallations.get(context);
  if (!clockInstallation) {
    clockInstallation = page.clock.install({ time: SUPPORT_EVIDENCE_NOW });
    supportClockInstallations.set(context, clockInstallation);
  }
  await clockInstallation;
  await mockShellSession(page, ['PROVIDER_SUPPORT'], {
    identityPlane: 'PROVIDER',
    displayName: 'Provider Operator',
    email: 'redacted-provider-operator',
    locale: 'en',
  });
  page.on('websocket', (socket) => {
    const url = new URL(socket.url());
    if (url.pathname.startsWith('/api/')) observations.streamAttempts.push(url.pathname);
  });
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === PREVIEW_PATH) observations.previewRequests.push(url.pathname);
    if (request.headers().accept?.includes('text/event-stream')) {
      observations.streamAttempts.push(url.pathname);
    }
  });
  await page.route(`**${SUPPORT_CONTEXT_PATH}`, (route) => {
    const target = currentTarget();
    return route.fulfill({
      json: {
        data: target
          ? {
              ...target,
              scopes: ['TENANT_EXPERIENCE_PREVIEW'],
              accessMode: 'STANDARD',
              expiresAt: SUPPORT_EVIDENCE_EXPIRES_AT,
            }
          : null,
      },
    });
  });
  await page.route(`**${PREVIEW_PATH}`, (route) => {
    const target = currentTarget();
    if (!target) return route.fulfill({ status: 403 });
    return route.fulfill({ json: { data: previewFixture(target, currentPreview()) } });
  });
}

async function publishSupportRevision(page: Page) {
  await page.evaluate((channelName) => {
    const channel = new BroadcastChannel(channelName);
    channel.postMessage({
      kind: 'dwp-cache-revision',
      revision: crypto.randomUUID(),
    });
    channel.close();
  }, SUPPORT_REVISION_CHANNEL);
}

async function pauseSupportClock(page: Page) {
  const currentTime = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(currentTime + 100);
}

async function expectOnlyTarget(page: Page, target: SupportTarget, forbidden: SupportTarget) {
  await expect(page.getByText(target.tenantName, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(`${target.tenantName} deterministic headline`)).toBeVisible();
  await expect(page.getByText(forbidden.tenantName, { exact: true })).toHaveCount(0);
  await expect(page.getByText(`${forbidden.tenantName} deterministic headline`)).toHaveCount(0);
}

async function openCurrentPreview(page: Page, target: SupportTarget) {
  await page.goto(`/provider/tenants/${target.tenantId}/experience-preview`);
  await expect(
    page.getByRole('heading', { name: 'Tenant experience configuration preview' })
  ).toBeVisible();
}

test('PT-A16 A-to-B-to-A across isolated browser profiles purges stale cache and streams', async ({
  browser,
}) => {
  test.setTimeout(60_000);
  let activeTarget: SupportTarget = targetA;
  const currentPreview = () => ({
    headline: `${activeTarget.tenantName} deterministic headline`,
    homeVersion: activeTarget.version + 10,
  });
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  const pages = await Promise.all(
    contexts.flatMap((context) => [context.newPage(), context.newPage()])
  );
  const observations = pages.map(() => ({
    previewRequests: [] as string[],
    streamAttempts: [] as string[],
  }));

  try {
    await Promise.all(
      pages.map((page, index) =>
        configureSupportPage(page, () => activeTarget, currentPreview, observations[index]!)
      )
    );
    await Promise.all(pages.map((page) => openCurrentPreview(page, targetA)));
    await Promise.all(pages.map((page) => expectOnlyTarget(page, targetA, targetB)));

    activeTarget = targetB;
    // Browser one receives an opaque authority revision in both tabs.
    await publishSupportRevision(pages[0]!);
    await Promise.all(
      pages
        .slice(0, 2)
        .map((page) =>
          expect(page.getByText(`${targetA.tenantName} deterministic headline`)).toHaveCount(0)
        )
    );
    await Promise.all(pages.slice(0, 2).map((page) => openCurrentPreview(page, targetB)));

    // Browser two discovers the server transition on a hard refresh, then fans the
    // opaque revision to its sibling tab without sending tenant or authority payload.
    await pages[2]!.reload();
    await expect(pages[2]!.getByText(`${targetA.tenantName} deterministic headline`)).toHaveCount(
      0
    );
    await publishSupportRevision(pages[2]!);
    await expect(pages[3]!.getByText(`${targetA.tenantName} deterministic headline`)).toHaveCount(
      0
    );
    await Promise.all(pages.slice(2).map((page) => openCurrentPreview(page, targetB)));
    await Promise.all(pages.map((page) => expectOnlyTarget(page, targetB, targetA)));

    await pages[0]!.goto('/provider/overview');
    await pages[0]!.goBack();
    await expectOnlyTarget(pages[0]!, targetB, targetA);
    await pages[1]!.reload();
    await expectOnlyTarget(pages[1]!, targetB, targetA);

    activeTarget = { ...targetA, version: 3 };
    await Promise.all([publishSupportRevision(pages[0]!), publishSupportRevision(pages[2]!)]);
    await Promise.all(
      pages.map((page) =>
        expect(page.getByText(`${targetB.tenantName} deterministic headline`)).toHaveCount(0)
      )
    );
    await Promise.all(pages.map((page) => openCurrentPreview(page, activeTarget)));
    await Promise.all(pages.map((page) => expectOnlyTarget(page, activeTarget, targetB)));

    for (const observation of observations) {
      expect(observation.previewRequests.length).toBeGreaterThanOrEqual(3);
      expect(new Set(observation.previewRequests)).toEqual(new Set([PREVIEW_PATH]));
      expect(observation.streamAttempts).toEqual([]);
    }
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test('PT-A21 preview artifacts contain no PII canary in DOM, screenshot, log, or trace', async ({
  context,
  page,
}, testInfo) => {
  let activeTarget: SupportTarget = targetA;
  const observations = { previewRequests: [] as string[], streamAttempts: [] as string[] };
  const piiCanary = ['DWP', '_PII', '_CANARY', '_PTA21'].join('');
  const canaryEmail = ['pt-a21-canary', 'example.invalid'].join('@');
  const forbiddenRequests: string[] = [];
  const browserLog: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') browserLog.push(message.text());
  });
  await configureSupportPage(
    page,
    () => activeTarget,
    () => ({ headline: 'Privacy-safe deterministic headline', homeVersion: 21 }),
    observations
  );
  await page.route('**/api/provider/v1/admin/tenants/tenant-a', (route) => {
    forbiddenRequests.push(new URL(route.request().url()).pathname);
    return route.fulfill({ json: { data: { displayName: piiCanary, email: canaryEmail } } });
  });

  const manualTrace = testInfo.retry === 0;
  if (manualTrace) {
    await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
  }
  await openCurrentPreview(page, activeTarget);
  const bodyText = (await page.locator('body').innerText()).trim();
  expect(bodyText.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/gu) ?? []).toEqual([]);
  expect(bodyText).not.toMatch(/DWP[_-](?:PII|SECRET)[_-]CANARY/iu);
  expect(forbiddenRequests).toEqual([]);
  expect(observations.previewRequests.length).toBeGreaterThan(0);
  expect(new Set(observations.previewRequests)).toEqual(new Set([PREVIEW_PATH]));

  const screenshotPath = testInfo.outputPath('pt-a21-preview.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach('pt-a21-preview-screenshot', {
    path: screenshotPath,
    contentType: 'image/png',
  });
  await testInfo.attach('pt-a21-preview-dom', {
    body: Buffer.from(bodyText),
    contentType: 'text/plain',
  });
  await testInfo.attach('pt-a21-browser-log', {
    body: Buffer.from(browserLog.join('\n')),
    contentType: 'text/plain',
  });
  if (manualTrace) {
    const tracePath = testInfo.outputPath('pt-a21-trace.zip');
    await context.tracing.stop({ path: tracePath });
    await testInfo.attach('pt-a21-preview-trace', {
      path: tracePath,
      contentType: 'application/zip',
    });
  }
  activeTarget = targetA;
});

test('PT-A22 identical preview versions render deterministically and refresh within ten seconds', async ({
  page,
}) => {
  const activeTarget = targetA;
  let revision: PreviewRevision = {
    headline: 'Stable version seven headline',
    homeVersion: 7,
  };
  const observations = { previewRequests: [] as string[], streamAttempts: [] as string[] };
  await configureSupportPage(
    page,
    () => activeTarget,
    () => revision,
    observations
  );
  await openCurrentPreview(page, activeTarget);
  const canvas = page.getByRole('region', {
    name: 'Synthetic tenant experience configuration canvas',
  });
  const firstSignature = await canvas.evaluate((element) => ({
    text: element.textContent,
    structure: [...element.querySelectorAll('*')].map((child) => child.tagName).join('>'),
  }));
  const firstPixelHash = createHash('sha256')
    .update(await canvas.screenshot({ animations: 'disabled' }))
    .digest('hex');
  const initialRequestCount = observations.previewRequests.length;
  expect(initialRequestCount).toBeGreaterThan(0);

  await page.goto('/provider/overview');
  await page.goBack();
  await expect(page.getByText('Stable version seven headline')).toBeVisible();
  const secondSignature = await canvas.evaluate((element) => ({
    text: element.textContent,
    structure: [...element.querySelectorAll('*')].map((child) => child.tagName).join('>'),
  }));
  expect(secondSignature).toEqual(firstSignature);
  const secondPixelHash = createHash('sha256')
    .update(await canvas.screenshot({ animations: 'disabled' }))
    .digest('hex');
  expect(secondPixelHash).toBe(firstPixelHash);
  expect(observations.previewRequests.length).toBeGreaterThanOrEqual(initialRequestCount);
  expect(new Set(observations.previewRequests)).toEqual(new Set([PREVIEW_PATH]));

  await pauseSupportClock(page);
  revision = { headline: 'Version eight arrived within budget', homeVersion: 8 };
  const changedAt = await page.evaluate(() => Date.now());
  const refreshed = page.waitForResponse(async (response) => {
    if (new URL(response.url()).pathname !== PREVIEW_PATH || !response.ok()) return false;
    const body = (await response.json()) as {
      data?: { home?: { headline?: string; version?: number } };
    };
    return (
      body.data?.home?.version === 8 &&
      body.data.home.headline === 'Version eight arrived within budget'
    );
  });
  await page.clock.runFor(8_001);
  await refreshed;
  await expect(page.getByText('Version eight arrived within budget')).toBeVisible();
  expect((await page.evaluate(() => Date.now())) - changedAt).toBeLessThanOrEqual(
    PREVIEW_FRESHNESS_BUDGET_MS
  );
  expect(observations.previewRequests.length).toBeGreaterThanOrEqual(2);
  await expect(canvas).toContainText('Home v8');
  await expect(canvas).not.toContainText('Stable version seven headline');
});

test('PT-A22 withholds a cached preview when the refresh cannot finish within ten seconds', async ({
  page,
}) => {
  const activeTarget = targetA;
  const observations = { previewRequests: [] as string[], streamAttempts: [] as string[] };
  const revision: PreviewRevision = {
    headline: 'Fresh preview before transport stall',
    homeVersion: 22,
  };
  let holdRefresh = false;
  let heldRefreshStarted = 0;
  let heldRefreshRoute: Route | undefined;
  await configureSupportPage(
    page,
    () => activeTarget,
    () => revision,
    observations
  );
  await page.route(`**${PREVIEW_PATH}`, (route) => {
    if (holdRefresh) {
      heldRefreshStarted += 1;
      heldRefreshRoute = route;
      return;
    }
    return route.fallback();
  });
  await openCurrentPreview(page, activeTarget);
  const canvas = page.getByRole('region', {
    name: 'Synthetic tenant experience configuration canvas',
  });
  await expect(canvas).toContainText(revision.headline);

  await pauseSupportClock(page);
  holdRefresh = true;
  try {
    await page.clock.runFor(8_000);
    await expect.poll(() => heldRefreshStarted).toBe(1);
    holdRefresh = false;
    if (!heldRefreshRoute) throw new Error('Expected a held preview baseline refresh route.');
    const baselineRefreshed = page.waitForResponse(
      (response) => new URL(response.url()).pathname === PREVIEW_PATH && response.ok()
    );
    await heldRefreshRoute.fallback();
    heldRefreshRoute = undefined;
    await baselineRefreshed;
    await expect(canvas).toContainText(revision.headline);
    const baselineAt = await page.evaluate(() => Date.now());

    holdRefresh = true;
    await page.clock.runFor(8_000);
    await expect.poll(() => heldRefreshStarted).toBe(2);
    await page.clock.runFor(1_999);
    expect((await page.evaluate(() => Date.now())) - baselineAt).toBe(9_999);
    await expect(canvas).toBeVisible();
    await page.clock.runFor(1);
    expect((await page.evaluate(() => Date.now())) - baselineAt).toBe(PREVIEW_FRESHNESS_BUDGET_MS);
    await expect(canvas).toHaveCount(0);
    await expect(page.getByText('The complete configuration could not be verified')).toBeVisible();

    holdRefresh = false;
    if (!heldRefreshRoute) throw new Error('Expected a stalled preview refresh route.');
    const stalledRequestUrl = heldRefreshRoute.request().url();
    const stalledRequestAborted = page.waitForEvent(
      'requestfailed',
      (request) => request.url() === stalledRequestUrl
    );
    await heldRefreshRoute.abort('aborted');
    await stalledRequestAborted;
    heldRefreshRoute = undefined;
    const recovered = page.waitForResponse(
      (response) => new URL(response.url()).pathname === PREVIEW_PATH && response.ok()
    );
    await page.getByRole('button', { name: 'Retry failed steps' }).click();
    await recovered;
    await page.clock.runFor(1);
    await expect(canvas).toContainText(revision.headline);
  } finally {
    holdRefresh = false;
    if (heldRefreshRoute) await heldRefreshRoute.abort('aborted').catch(() => undefined);
  }
});

test('PT-A30 tenant, scope, expiry, and revoke remain operable on mobile and at 200 percent zoom', async ({
  page,
}, testInfo) => {
  let activeTarget: SupportTarget | null = targetA;
  const observations = { previewRequests: [] as string[], streamAttempts: [] as string[] };
  await configureSupportPage(
    page,
    () => activeTarget,
    () => ({ headline: 'Accessible support preview', homeVersion: 30 }),
    observations
  );
  await page.route(
    `**/api/provider/v1/admin/support-sessions/${targetA.supportSessionId}/revoke`,
    (route) => {
      activeTarget = null;
      return route.fulfill({
        json: {
          data: { supportSessionId: targetA.supportSessionId, state: 'REVOKED', version: 2 },
        },
      });
    }
  );
  if (testInfo.project.name === 'mobile') {
    await page.setViewportSize({ width: 320, height: 720 });
  } else {
    await page.setViewportSize({ width: 640, height: 720 });
  }
  await page.goto('/provider/overview');
  if (testInfo.project.name !== 'mobile') {
    await page.evaluate(() => {
      document.documentElement.style.zoom = '2';
    });
  }

  const supportBar = page.getByRole('region', { name: 'Active tenant diagnosis session' });
  await expect(supportBar).toContainText('Tenant A Production');
  const approvedDetails = supportBar.getByText('Approved session details');
  await expect(approvedDetails).toBeVisible();
  await approvedDetails.click();
  await expect(supportBar).toContainText('Tenant · tenant-a-production');
  await expect(supportBar).toContainText('Preview redacted tenant experience configuration');
  await expect(supportBar).toContainText('Approved scope expires');
  const expiryStatus = supportBar.getByRole('status');
  await expect(expiryStatus).toContainText('Remaining · in 15 minutes');
  const remainingMinutes = Number(
    (await expiryStatus.textContent())?.match(/Remaining · in (\d+) minutes/)?.[1]
  );
  expect(remainingMinutes).toBeGreaterThan(0);
  expect(remainingMinutes).toBeLessThanOrEqual(60);
  await expect(supportBar).not.toContainText(/days?/i);
  const revoke = supportBar.getByRole('button', { name: 'Revoke support session' });
  await expect(revoke).toBeVisible();
  const clippedControls = await supportBar.locator('.MuiChip-root, button').evaluateAll((items) =>
    items.flatMap((item) => {
      const box = item.getBoundingClientRect();
      const label = item.querySelector('.MuiChip-label') as HTMLElement | null;
      const outsideViewport = box.left < -1 || box.right > document.documentElement.clientWidth + 1;
      const clippedLabel = Boolean(label && label.scrollWidth > label.clientWidth + 1);
      return outsideViewport || clippedLabel
        ? [
            {
              text: item.textContent?.trim() ?? '',
              left: box.left,
              right: box.right,
              viewport: document.documentElement.clientWidth,
              clippedLabel,
            },
          ]
        : [];
    })
  );
  expect(clippedControls).toEqual([]);
  const expandedScreenshotPath = testInfo.outputPath(
    `pt-a30-${testInfo.project.name}-expanded-details.png`
  );
  await page.screenshot({ path: expandedScreenshotPath, fullPage: false, animations: 'disabled' });
  await testInfo.attach(`pt-a30-${testInfo.project.name}-expanded-details`, {
    path: expandedScreenshotPath,
    contentType: 'image/png',
  });
  await approvedDetails.click();

  const [initialHeaderBox, initialSupportBox] = await Promise.all([
    page.getByRole('banner').boundingBox(),
    supportBar.boundingBox(),
  ]);
  expect(initialHeaderBox).not.toBeNull();
  expect(initialSupportBox).not.toBeNull();
  expect(initialSupportBox!.height).toBeLessThanOrEqual(720 - initialHeaderBox!.height);

  await page.evaluate(() => {
    const spacer = document.createElement('div');
    spacer.dataset.providerSupportStickyEvidence = 'true';
    spacer.style.height = '1800px';
    document.querySelector('#dwp-main-content')?.appendChild(spacer);
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  await expect(supportBar).toBeInViewport();
  const [headerBox, supportBox] = await Promise.all([
    page.getByRole('banner').boundingBox(),
    supportBar.boundingBox(),
  ]);
  expect(headerBox).not.toBeNull();
  expect(supportBox).not.toBeNull();
  expect(supportBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height - 2);
  expect(supportBox!.y).toBeLessThan(720);
  const commandCenter = page.getByRole('heading', { name: 'Operations command center' });
  await commandCenter.scrollIntoViewIfNeeded();
  await expect(commandCenter).toBeInViewport();
  const commandCenterBox = await commandCenter.boundingBox();
  const stickySupportBox = await supportBar.boundingBox();
  expect(commandCenterBox).not.toBeNull();
  expect(stickySupportBox).not.toBeNull();
  expect(commandCenterBox!.y).toBeGreaterThanOrEqual(
    stickySupportBox!.y + stickySupportBox!.height
  );
  const stickyScreenshotPath = testInfo.outputPath(
    `pt-a30-${testInfo.project.name}-sticky-summary.png`
  );
  await page.screenshot({ path: stickyScreenshotPath, fullPage: false, animations: 'disabled' });
  await testInfo.attach(`pt-a30-${testInfo.project.name}-sticky-summary`, {
    path: stickyScreenshotPath,
    contentType: 'image/png',
  });
  await testInfo.attach(`pt-a30-${testInfo.project.name}-geometry`, {
    body: Buffer.from(
      JSON.stringify(
        { initialHeaderBox, initialSupportBox, headerBox, supportBox, commandCenterBox },
        null,
        2
      )
    ),
    contentType: 'application/json',
  });

  let reachedRevoke = false;
  for (let index = 0; index < 80; index += 1) {
    if (await revoke.evaluate((element) => element === document.activeElement)) {
      reachedRevoke = true;
      break;
    }
    await page.keyboard.press('Tab');
  }
  expect(reachedRevoke).toBe(true);
  await expect(revoke).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/provider\/support$/);
  await expect(page.getByRole('region', { name: 'Active tenant diagnosis session' })).toHaveCount(
    0
  );
});

for (const plane of ['TENANT', 'PROVIDER'] as const) {
  test(`notification runtime hard reload stays inside preferences on the ${plane.toLowerCase()} plane`, async ({
    page,
  }, testInfo) => {
    const permissions = [
      ...DEFAULT_APP_PERMISSIONS,
      {
        resourceType: 'APP',
        resourceKey: 'APP.NOTIFICATIONS',
        permissionCode: 'VIEW',
        effect: 'ALLOW' as const,
      },
    ];
    const hookFailures: string[] = [];
    const responses: Array<{ path: string; status: number }> = [];
    const requests: string[] = [];
    page.on('pageerror', (error) => {
      if (error.message.includes('usePersonalPreference')) hookFailures.push(error.message);
    });
    page.on('console', (message) => {
      if (message.type() === 'error' && message.text().includes('usePersonalPreference')) {
        hookFailures.push(message.text());
      }
    });
    page.on('response', (response) => {
      const path = new URL(response.url()).pathname;
      if (path === '/api/auth/policy') responses.push({ path, status: response.status() });
    });
    page.on('request', (request) => requests.push(new URL(request.url()).pathname));
    await mockShellSession(page, plane === 'PROVIDER' ? ['PROVIDER_ADMIN'] : ['WORKSPACE_MEMBER'], {
      identityPlane: plane,
      email: `redacted-${plane.toLowerCase()}-operator`,
      permissions,
      locale: 'en',
    });
    const path = plane === 'PROVIDER' ? '/provider/overview' : '/account/settings/appearance';
    await page.goto(path);
    if (testInfo.project.name === 'chromium') {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    }
    await page.reload({ waitUntil: 'domcontentloaded' });

    if (plane === 'PROVIDER') {
      await expect(page.getByRole('heading', { name: 'Operations command center' })).toBeVisible();
      expect(requests.filter((request) => request.includes('/personal-preferences'))).toEqual([]);
    } else {
      await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible();
      expect(requests).toContain('/api/platform/v1/personal-preferences');
    }
    expect(await page.evaluate(async () => (await fetch('/api/auth/policy')).status)).toBe(200);
    expect(responses.some((response) => response.status === 200)).toBe(true);
    expect(hookFailures).toEqual([]);
  });
}
