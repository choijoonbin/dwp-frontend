import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const projectRoot = process.cwd();
const outputRoot = path.join(projectRoot, 'output', 'calendar-re-audit-2026-09-16', 'current-state');
const backendReadme = await readFile(path.resolve(projectRoot, '../dwp-backend/README.md'), 'utf8');
const password = backendReadme.match(/공통 비밀번호 `([^`]+)`/)?.[1];

if (!password) throw new Error('The local seed password could not be resolved from the backend README.');

const routes = [
  ['01-today', '/calendar/home'],
  ['02-schedule', '/calendar/schedule'],
  ['03-focus-plan', '/calendar/focus'],
  ['04-invitations', '/calendar/invitations'],
  ['05-find-time', '/calendar/availability'],
  ['06-insights', '/calendar/insights'],
  ['07-trash', '/calendar/trash'],
  ['08-admin-overview', '/calendar/admin/overview'],
  ['09-admin-company-calendars', '/calendar/admin/company-calendars'],
  ['10-admin-policies', '/calendar/admin/policies'],
];
const viewports = [
  ['desktop', { width: 1440, height: 1000 }],
  ['mobile', { width: 390, height: 844 }],
];
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4200';
const browser = await chromium.launch({ headless: true });
const manifest = {
  capturedAt: new Date().toISOString(),
  source: 'REAL_LOCAL_UI_LOGIN_NATIVE_HTTP_NO_RESPONSE_MOCKS',
  baseURL,
  results: [],
};

try {
  for (const [viewportName, viewport] of viewports) {
    const context = await browser.newContext({ baseURL, viewport });
    const page = await context.newPage();
    const failedReads = [];
    const consoleErrors = [];
    const pageErrors = [];
    page.on('response', (response) => {
      const request = response.request();
      const url = new URL(response.url());
      if (
        ['GET', 'HEAD'].includes(request.method()) &&
        url.pathname.startsWith('/api/') &&
        response.status() >= 400
      ) {
        failedReads.push({ method: request.method(), pathname: url.pathname, status: response.status() });
      }
    });
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto('/sign-in?returnUrl=%2Fcalendar%2Fhome', { waitUntil: 'domcontentloaded' });
    await page.locator('input[name="email"]').fill('hyunwoo.park@sk.com');
    await page.locator('input[name="password"]').fill(password);
    const loginResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/auth/login' &&
        response.request().method() === 'POST'
    );
    await page.locator('#dwp-sign-in-form button[type="submit"]').click();
    const loginStatus = (await loginResponse).status();
    if (loginStatus !== 200) throw new Error(`Local login failed with HTTP ${loginStatus}.`);
    await page.waitForURL(/\/calendar\/home(?:\?|$)/, { timeout: 45_000 });
    await page.waitForTimeout(1_000);

    const targetDir = path.join(outputRoot, viewportName);
    await mkdir(targetDir, { recursive: true });

    for (const [screen, route] of routes) {
      failedReads.length = 0;
      consoleErrors.length = 0;
      pageErrors.length = 0;
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.waitForURL(new RegExp(`${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\?|$)`), {
        timeout: 30_000,
      });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      await page.evaluate(() => window.scrollTo({ left: 0, top: 0, behavior: 'instant' }));
      const main = page.locator('#dwp-main-content').first();
      await main.waitFor({ state: 'visible', timeout: 30_000 });
      await page
        .locator('[data-testid="product-surface-loading-shell"]')
        .waitFor({ state: 'detached', timeout: 30_000 })
        .catch(() => undefined);
      await main.locator('[aria-busy="true"]').first().waitFor({ state: 'detached', timeout: 20_000 }).catch(() => undefined);
      await main.locator('.MuiSkeleton-root').first().waitFor({ state: 'detached', timeout: 30_000 }).catch(() => undefined);

      let bodyText = '';
      let stableReads = 0;
      const stableDeadline = Date.now() + 20_000;
      while (Date.now() < stableDeadline && stableReads < 3) {
        const nextText = (await main.innerText()).trim();
        stableReads = nextText.length > 50 && nextText === bodyText ? stableReads + 1 : 0;
        bodyText = nextText;
        await page.waitForTimeout(300);
      }

      const heading = await main.locator('h1').first().textContent().catch(() => null);
      const screenshot = path.join(targetDir, `${screen}.png`);
      const viewportEvidence = await page.evaluate(() => ({
        innerWidth,
        scrollX,
        documentScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
      }));
      await page.screenshot({ path: screenshot, fullPage: true });
      manifest.results.push({
        viewport: viewportName,
        width: viewport.width,
        height: viewport.height,
        requestedRoute: route,
        actualPath: new URL(page.url()).pathname,
        heading: heading?.trim() ?? null,
        textLength: bodyText.length,
        stableReads,
        skeletons: await main.locator('.MuiSkeleton-root').count(),
        progressbars: await main.getByRole('progressbar').count(),
        viewportEvidence,
        failedReads: [...failedReads],
        consoleErrors: [...new Set(consoleErrors)],
        pageErrors: [...new Set(pageErrors)],
        screenshot: path.relative(projectRoot, screenshot),
      });
    }
    await context.close();
  }
} finally {
  await browser.close();
}

await mkdir(outputRoot, { recursive: true });
await writeFile(path.join(outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ status: 'PASS', outputRoot, captures: manifest.results.length })}\n`);
