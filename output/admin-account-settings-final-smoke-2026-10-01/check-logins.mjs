import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const readme = await readFile(path.resolve(process.cwd(), '../dwp-backend/README.md'), 'utf8');
const password = readme.match(/공통 비밀번호 `([^`]+)`/)?.[1];
if (!password) throw new Error('Seed password not found.');

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  for (const email of [
    'hyunwoo.park@sk.com',
    'seoyeon.lee@sk.com',
    'joonbin@sk.com',
  ]) {
    const context = await browser.newContext({ baseURL: 'http://localhost:4200' });
    const page = await context.newPage();
    await page.goto('/sign-in', { waitUntil: 'domcontentloaded' });
    const csrfBootstrap = await page.evaluate(async () => {
      const response = await fetch('/api/auth/csrf', { credentials: 'include' });
      const body = await response.json().catch(() => null);
      return {
        status: response.status,
        token: body?.data?.token ?? null,
        headerName: body?.data?.headerName ?? null,
      };
    });
    const csrfCookieBefore = (await context.cookies()).find(
      (cookie) => cookie.name === 'XSRF-TOKEN'
    );
    await page.evaluate(() => window.localStorage.setItem('dwp.tenantId', '1'));
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    const responsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/auth/login' &&
        response.request().method() === 'POST'
    );
    await page.locator('#dwp-sign-in-form button[type="submit"]').click();
    const response = await responsePromise;
    const body = await response.json().catch(() => null);
    const requestHeaders = await response.request().allHeaders();
    const csrfCookie = (await context.cookies()).find((cookie) => cookie.name === 'XSRF-TOKEN');
    const csrfHeader = requestHeaders['x-xsrf-token'] ?? '';
    const csrfRequestCookie = (requestHeaders.cookie ?? '')
      .split(';')
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith('XSRF-TOKEN='))
      ?.slice('XSRF-TOKEN='.length);
    results.push({
      email,
      status: response.status(),
      errorCode: body?.errorCode ?? null,
      message: body?.message ?? null,
      tenantId: response.request().postDataJSON()?.tenantId ?? null,
      csrfHeader: Boolean(csrfHeader),
      csrfBootstrapStatus: csrfBootstrap.status,
      csrfCookieBefore: Boolean(csrfCookieBefore?.value),
      csrfBootstrapMatchesCookie:
        Boolean(csrfBootstrap.token && csrfCookieBefore?.value) &&
        csrfBootstrap.token === decodeURIComponent(csrfCookieBefore.value),
      csrfHeaderMatchesBootstrap: csrfHeader === csrfBootstrap.token,
      csrfHeaderMatchesCookieBefore:
        Boolean(csrfHeader && csrfCookieBefore?.value) &&
        csrfHeader === decodeURIComponent(csrfCookieBefore.value),
      csrfHeaderMatchesRequestCookie:
        Boolean(csrfHeader && csrfRequestCookie) &&
        csrfHeader === decodeURIComponent(csrfRequestCookie),
      csrfCookie: Boolean(csrfCookie?.value),
      csrfHeaderMatchesCookie:
        Boolean(csrfHeader && csrfCookie?.value) &&
        csrfHeader === decodeURIComponent(csrfCookie.value),
      responseServer: response.headers()['server'] ?? null,
    });
    await context.close();
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(results, null, 2));
