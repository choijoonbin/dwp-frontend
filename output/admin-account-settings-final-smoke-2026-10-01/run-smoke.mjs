import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const frontendRoot = process.cwd();
const evidenceRoot = '/Users/a10697/Work/DWP/output/admin-account-settings-final-smoke-2026-10-01';
const screenshotRoot = path.join(evidenceRoot, 'screenshots');
const manifestFileName = process.env.SMOKE_MANIFEST ?? 'manifest-final.json';
const backendReadme = await readFile(
  path.resolve(frontendRoot, '../dwp-backend/README.md'),
  'utf8'
);
const password = backendReadme.match(/공통 비밀번호 `([^`]+)`/)?.[1];
if (!password) throw new Error('Local seed password was not found.');

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:4200';
const accountRoutes = [
  '/account/profile',
  '/account/security',
  '/account/settings/appearance',
  '/account/settings/accessibility',
  '/account/settings/language',
  '/account/settings/home',
  '/account/settings/notifications',
  '/account/settings/managed',
];
const adminRoutes = [
  '/admin/experience/branding',
  '/admin/experience/home',
  '/admin/experience/preference-exceptions',
  '/admin/experience/localization',
  '/admin/identity/access',
  '/admin/identity/app-governance',
  '/admin/identity/app-access-requests',
  '/admin/identity/access-reviews',
  '/admin/identity/roles',
  '/admin/identity/workforce-access',
  '/admin/identity/saved-view-custody',
  '/admin/identity/provisioning',
  '/admin/platform/catalog',
  '/admin/platform/reference-data',
  '/admin/platform/registry',
  '/admin/platform/navigation',
  '/admin/integrations/productivity',
  '/admin/governance/api-monitoring',
  '/admin/governance/audit-overview',
  '/admin/governance/audit-investigations',
  '/admin/governance/audit-events',
  '/admin/governance/audit-governance',
];
const canonicalPaths = new Map([
  ['/account/settings/home', '/account/settings/home/overview'],
  ['/account/settings/notifications', '/notifications/settings'],
  ['/admin/experience/home', '/admin/experience/home/modes'],
]);
const personalCodeSets = [
  'PLATFORM.PREFERENCE.COLOR_MODE',
  'PLATFORM.PREFERENCE.DENSITY',
  'PLATFORM.PREFERENCE.TIME_ZONE',
  'PLATFORM.PREFERENCE.DATE_FORMAT',
  'PLATFORM.PREFERENCE.TIME_FORMAT',
  'PLATFORM.PREFERENCE.FIRST_DAY_OF_WEEK',
  'PLATFORM.PREFERENCE.NUMBER_FORMAT',
];
const auditCodeSets = [
  'PLATFORM.AUDIT.WINDOW',
  'PLATFORM.AUDIT.CATEGORY_FILTER',
  'PLATFORM.AUDIT.SEVERITY_FILTER',
  'PLATFORM.AUDIT.OUTCOME_FILTER',
  'PLATFORM.EVENT_ENVELOPE.DOMAIN',
  'PLATFORM.EVENT_ENVELOPE.CLASSIFICATION',
  'PLATFORM.SYS_AUDIT_EXPORT_JOBS.FORMAT',
];
const apiHistoryCodeSets = [
  'PLATFORM.API_HISTORY.WINDOW',
  'PLATFORM.API_HISTORY.OBSERVATION_POINT_FILTER',
  'PLATFORM.API_HISTORY.HTTP_METHOD_FILTER',
  'PLATFORM.API_HISTORY.OUTCOME_FILTER',
];
const mobileRoutes = [
  ['hyunwoo.park@sk.com', '/account/settings/accessibility', 'account-accessibility-390.png'],
  ['hyunwoo.park@sk.com', '/account/settings/managed', 'account-managed-390.png'],
  ['joonbin@sk.com', '/admin/identity/app-governance', 'admin-app-governance-390.png'],
  ['joonbin@sk.com', '/admin/governance/audit-governance', 'admin-audit-governance-390.png'],
];

await mkdir(screenshotRoot, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const manifest = {
  capturedAt: new Date().toISOString(),
  source: 'REAL_LOCAL_GOOGLE_CHROME_LOGIN_NATIVE_HTTP_NO_MOCKS',
  browserVersion: browser.version(),
  baseURL,
  logins: [],
  navigationVisibility: [],
  apiChecks: [],
  routeChecks: [],
};

const unique = (values) => [...new Set(values)];
const apiPath = (key) => `/api/platform/v1/catalog/code-sets/${key}`;

async function login(page, email, returnUrl) {
  await page.goto(`/sign-in?returnUrl=${encodeURIComponent(returnUrl)}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.evaluate(() => window.localStorage.setItem('dwp.tenantId', '1'));
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  const responsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/auth/login' &&
      response.request().method() === 'POST',
    { timeout: 30_000 }
  );
  await page.locator('#dwp-sign-in-form button[type="submit"]').click();
  const response = await responsePromise;
  const body = await response.json().catch(() => null);
  manifest.logins.push({
    email,
    status: response.status(),
    success: body?.success ?? null,
    errorCode: body?.errorCode ?? null,
  });
  if (response.status() !== 200) {
    const sent = response.request().postDataJSON?.() ?? {};
    const requestHeaders = await response.request().allHeaders();
    throw new Error(
      `${email} login failed with HTTP ${response.status()} ${body?.errorCode ?? 'UNKNOWN'} ` +
        `tenant=${String(sent.tenantId ?? 'MISSING')} csrf=${requestHeaders['x-xsrf-token'] ? 'present' : 'missing'}`
    );
  }
  await page.waitForURL((url) => url.pathname !== '/sign-in', { timeout: 45_000 });
  return String(body?.data?.tenantId ?? 1);
}

function attachNetworkEvidence(page) {
  const state = {
    apiResponses: [],
    documentResponses: [],
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    navigationAborts: [],
    pending: new Map(),
    navigationInProgress: false,
    suppressAbortsUntil: 0,
  };
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!url.pathname.endsWith('/api/notifications/v1/stream')) {
      state.pending.set(request, `${request.method()} ${url.pathname}`);
    }
  });
  page.on('requestfinished', (request) => state.pending.delete(request));
  page.on('requestfailed', (request) => {
    state.pending.delete(request);
    const url = new URL(request.url());
    const failure = {
      method: request.method(),
      path: url.pathname,
      error: request.failure()?.errorText ?? 'unknown',
    };
    if (
      failure.error === 'net::ERR_ABORTED' &&
      (state.navigationInProgress || Date.now() <= state.suppressAbortsUntil)
    ) {
      state.navigationAborts.push(failure);
      return;
    }
    state.requestFailures.push(failure);
  });
  page.on('response', (response) => {
    const request = response.request();
    const url = new URL(response.url());
    if (request.resourceType() === 'document') {
      state.documentResponses.push({ path: url.pathname, status: response.status() });
    }
    if (url.pathname.startsWith('/api/')) {
      state.apiResponses.push({
        method: request.method(),
        path: url.pathname,
        status: response.status(),
      });
    }
  });
  page.on('console', (message) => {
    if (message.type() === 'error') state.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => state.pageErrors.push(error.message));
  return state;
}

function resetEvidence(state) {
  state.apiResponses.length = 0;
  state.documentResponses.length = 0;
  state.consoleErrors.length = 0;
  state.pageErrors.length = 0;
  state.requestFailures.length = 0;
  state.navigationAborts.length = 0;
}

async function waitForStablePage(page) {
  const main = page.locator('#dwp-main-content').first();
  await main.waitFor({ state: 'visible', timeout: 30_000 });
  await page
    .locator('[data-testid="product-surface-loading-shell"]')
    .first()
    .waitFor({ state: 'detached', timeout: 20_000 })
    .catch(() => undefined);
  await main
    .locator('.MuiSkeleton-root')
    .first()
    .waitFor({ state: 'detached', timeout: 20_000 })
    .catch(() => undefined);
  await main
    .locator('[aria-busy="true"]')
    .first()
    .waitFor({ state: 'detached', timeout: 20_000 })
    .catch(() => undefined);

  let lastText = '';
  let stableReads = 0;
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline && stableReads < 3) {
    const nextText = (await main.innerText().catch(() => '')).trim();
    stableReads = nextText.length > 50 && nextText === lastText ? stableReads + 1 : 0;
    lastText = nextText;
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(700);
  return { main, textLength: lastText.length, stableReads };
}

async function smokeRoute(page, state, requestedPath, viewport, screenshotName = null) {
  resetEvidence(state);
  state.navigationInProgress = true;
  state.suppressAbortsUntil = Date.now() + 5_000;
  let documentResponse;
  try {
    documentResponse = await page.goto(requestedPath, {
      waitUntil: 'domcontentloaded',
      timeout: 45_000,
    });
  } finally {
    state.navigationInProgress = false;
  }
  const { main, textLength, stableReads } = await waitForStablePage(page);
  const actualPath = new URL(page.url()).pathname;
  const expectedPath = canonicalPaths.get(requestedPath) ?? requestedPath;
  const progressbars = await main.getByRole('progressbar').evaluateAll((elements) =>
    elements
      .filter((element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
      })
      .map((element) => ({
        ariaValueNow: element.getAttribute('aria-valuenow'),
        ariaValueText: element.getAttribute('aria-valuetext'),
        ariaLabel: element.getAttribute('aria-label'),
        className: element.getAttribute('class'),
        parentText: element.parentElement?.textContent?.trim().slice(0, 240) ?? '',
        outerHTML: element.outerHTML.slice(0, 600),
      }))
  );
  const layout = await page.evaluate(() => {
    const mainElement = document.querySelector('#dwp-main-content');
    return {
      innerWidth,
      documentClientWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      mainClientWidth: mainElement?.clientWidth ?? null,
      mainScrollWidth: mainElement?.scrollWidth ?? null,
      scrollX,
    };
  });
  const successfulApiKeys = new Set(
    state.apiResponses
      .filter((entry) => entry.status < 400)
      .map((entry) => `${entry.method} ${entry.path}`)
  );
  const unrecoveredFailures = state.requestFailures.filter(
    (failure) => !successfulApiKeys.has(`${failure.method} ${failure.path}`)
  );
  const visibleBusy = await main.locator('[aria-busy="true"]:visible').count();
  const visibleSkeletons = await main.locator('.MuiSkeleton-root:visible').count();
  const loadingProgressbars = progressbars.filter(
    (entry) => entry.ariaValueNow === null && entry.ariaValueText === null
  );
  if (screenshotName) {
    await page.screenshot({
      path: path.join(screenshotRoot, screenshotName),
      fullPage: true,
    });
  }
  const result = {
    viewport,
    requestedPath,
    expectedPath,
    actualPath,
    documentStatus: documentResponse?.status() ?? null,
    exactPath: actualPath === expectedPath,
    textLength,
    stableReads,
    non2xxApis: state.apiResponses.filter((entry) => entry.status >= 400),
    consoleErrors: unique(state.consoleErrors),
    pageErrors: unique(state.pageErrors),
    unrecoveredRequestFailures: unrecoveredFailures,
    navigationAborts: state.navigationAborts,
    pendingRequests: unique([...state.pending.values()]),
    busy: {
      visibleAriaBusy: visibleBusy,
      visibleSkeletons,
      loadingProgressbars: loadingProgressbars.length,
      allProgressbars: progressbars,
    },
    overflow: {
      root: Math.max(layout.documentScrollWidth, layout.bodyScrollWidth) - layout.innerWidth,
      main:
        layout.mainClientWidth === null || layout.mainScrollWidth === null
          ? null
          : layout.mainScrollWidth - layout.mainClientWidth,
      evidence: layout,
    },
  };
  manifest.routeChecks.push(result);
  return result;
}

async function catalogChecks(page, tenantId, email, keys) {
  for (const key of keys) {
    const result = await page.evaluate(
      async ({ target, tenant }) => {
        const response = await fetch(target, {
          credentials: 'include',
          headers: { 'X-Tenant-ID': tenant },
        });
        let body = null;
        try {
          body = await response.json();
        } catch {
          // Empty error responses are still captured by status.
        }
        return {
          status: response.status,
          success: body?.success ?? null,
          errorCode: body?.errorCode ?? null,
          valueCount: Array.isArray(body?.data?.values) ? body.data.values.length : null,
        };
      },
      { target: apiPath(key), tenant: tenantId }
    );
    manifest.apiChecks.push({ email, key, ...result });
  }
}

async function visibleManifestPaths(page, manifestPaths) {
  for (let index = 0; index < 10; index += 1) {
    const collapsedGroup = page
      .locator('[aria-controls^="admin-navigation-"][aria-expanded="false"]')
      .first();
    if ((await collapsedGroup.count()) === 0) break;
    await collapsedGroup.click();
  }
  await page.waitForTimeout(500);
  return page.locator('a[href]').evaluateAll(
    (anchors, candidates) => {
      const allowed = new Set(candidates);
      return [...new Set(
        anchors
          .map((anchor) => anchor.getAttribute('href'))
          .filter((href) => href && allowed.has(href))
      )].sort();
    },
    manifestPaths
  );
}

try {
  const accountContext = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 1000 },
  });
  const accountPage = await accountContext.newPage();
  const accountNetwork = attachNetworkEvidence(accountPage);
  const accountTenant = await login(accountPage, 'hyunwoo.park@sk.com', '/account/profile');
  await waitForStablePage(accountPage);
  manifest.navigationVisibility.push({
    email: 'hyunwoo.park@sk.com',
    surface: 'account',
    paths: await visibleManifestPaths(accountPage, accountRoutes),
  });
  await catalogChecks(accountPage, accountTenant, 'hyunwoo.park@sk.com', personalCodeSets);
  await catalogChecks(accountPage, accountTenant, 'hyunwoo.park@sk.com', auditCodeSets);
  for (const route of accountRoutes) {
    const screenshotName = route === '/account/settings/managed' ? 'account-managed-1440.png' : null;
    await smokeRoute(accountPage, accountNetwork, route, '1440x1000', screenshotName);
  }
  await accountContext.close();

  for (const [email, returnUrl, verifyAudit] of [
    ['hyunwoo.park@sk.com', '/admin/experience/branding', false],
    ['seoyeon.lee@sk.com', '/admin/governance/audit-overview', true],
  ]) {
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    const tenantId = await login(page, email, returnUrl);
    await waitForStablePage(page);
    manifest.navigationVisibility.push({
      email,
      surface: 'admin',
      paths: await visibleManifestPaths(page, adminRoutes),
    });
    if (verifyAudit) await catalogChecks(page, tenantId, email, auditCodeSets);
    await context.close();
  }

  const adminContext = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 1000 },
  });
  const adminPage = await adminContext.newPage();
  const adminNetwork = attachNetworkEvidence(adminPage);
  const adminTenant = await login(adminPage, 'joonbin@sk.com', '/admin/experience/branding');
  await waitForStablePage(adminPage);
  manifest.navigationVisibility.push({
    email: 'joonbin@sk.com',
    surface: 'admin',
    paths: await visibleManifestPaths(adminPage, adminRoutes),
  });
  await catalogChecks(adminPage, adminTenant, 'joonbin@sk.com', auditCodeSets);
  await catalogChecks(adminPage, adminTenant, 'joonbin@sk.com', apiHistoryCodeSets);
  await catalogChecks(adminPage, adminTenant, 'joonbin@sk.com', [
    'PLATFORM.PREFERENCE.UNKNOWN',
    'PLATFORM.AUDIT.UNKNOWN',
    'PLATFORM.EVENT_ENVELOPE.UNKNOWN',
    'PLATFORM.SYS_AUDIT_EXPORT_JOBS.UNKNOWN',
  ]);
  for (const route of adminRoutes) {
    let screenshotName = null;
    if (route === '/admin/identity/app-governance') screenshotName = 'admin-app-governance-1440.png';
    if (route === '/admin/governance/audit-governance') screenshotName = 'admin-audit-governance-1440.png';
    await smokeRoute(adminPage, adminNetwork, route, '1440x1000', screenshotName);
  }
  await adminContext.close();

  for (const [email, route, screenshotName] of mobileRoutes) {
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const state = attachNetworkEvidence(page);
    await login(page, email, route);
    await smokeRoute(page, state, route, '390x844', screenshotName);
    await context.close();
  }
} finally {
  await browser.close();
}

await writeFile(
  path.join(evidenceRoot, manifestFileName),
  `${JSON.stringify(manifest, null, 2)}\n`
);

const summary = {
  browserVersion: manifest.browserVersion,
  loginStatuses: manifest.logins,
  routeCount: manifest.routeChecks.length,
  routeFailures: manifest.routeChecks.filter(
    (result) =>
      result.documentStatus !== 200 ||
      !result.exactPath ||
      result.non2xxApis.length > 0 ||
      result.consoleErrors.length > 0 ||
      result.pageErrors.length > 0 ||
      result.unrecoveredRequestFailures.length > 0 ||
      result.busy.visibleAriaBusy > 0 ||
      result.busy.visibleSkeletons > 0 ||
      result.busy.loadingProgressbars > 0 ||
      result.overflow.root > 0 ||
      (result.overflow.main ?? 0) > 0
  ),
  apiFailures: manifest.apiChecks.filter((result) => {
    const unknown = result.key.endsWith('.UNKNOWN');
    const unauthorizedAudit =
      result.email === 'hyunwoo.park@sk.com' && auditCodeSets.includes(result.key);
    const expected = unknown ? 503 : unauthorizedAudit ? 403 : 200;
    return result.status !== expected;
  }),
};
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
