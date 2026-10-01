import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const readme = await readFile(path.resolve(process.cwd(), '../dwp-backend/README.md'), 'utf8');
const password = readme.match(/공통 비밀번호 `([^`]+)`/)?.[1];
if (!password) throw new Error('Seed password not found.');

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ baseURL: 'http://localhost:4200' });
const page = await context.newPage();
const transactions = [];
const responseTasks = [];

page.on('response', (response) => {
  const url = new URL(response.url());
  if (url.pathname !== '/api/auth/csrf') return;
  responseTasks.push(
    (async () => {
      const body = await response.json().catch(() => null);
      const requestHeaders = await response.request().allHeaders();
      const cookie = (requestHeaders.cookie ?? '')
        .split(';')
        .map((entry) => entry.trim())
        .find((entry) => entry.startsWith('XSRF-TOKEN='))
        ?.slice('XSRF-TOKEN='.length);
      transactions.push({
        host: url.host,
        status: response.status(),
        token: body?.data?.token ?? null,
        requestCookie: cookie ? decodeURIComponent(cookie) : null,
        responseSetsCookie: Boolean(response.headers()['set-cookie']),
      });
    })()
  );
});

await page.goto('/sign-in', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => window.localStorage.setItem('dwp.tenantId', '1'));
await page.locator('input[name="email"]').fill('hyunwoo.park@sk.com');
await page.locator('input[name="password"]').fill(password);
const loginResponsePromise = page.waitForResponse(
  (response) =>
    new URL(response.url()).pathname === '/api/auth/login' &&
    response.request().method() === 'POST'
);
await page.locator('#dwp-sign-in-form button[type="submit"]').click();
const loginResponse = await loginResponsePromise;
await Promise.all(responseTasks);
const loginHeaders = await loginResponse.request().allHeaders();
const loginCookie = (loginHeaders.cookie ?? '')
  .split(';')
  .map((entry) => entry.trim())
  .find((entry) => entry.startsWith('XSRF-TOKEN='))
  ?.slice('XSRF-TOKEN='.length);
const loginToken = loginHeaders['x-xsrf-token'] ?? null;
const browserCookies = (await context.cookies()).filter((cookie) => cookie.name === 'XSRF-TOKEN');

console.log(
  JSON.stringify(
    {
      loginStatus: loginResponse.status(),
      csrfResponseCount: transactions.length,
      csrfHosts: [...new Set(transactions.map((entry) => entry.host))],
      csrfDistinctTokens: new Set(transactions.map((entry) => entry.token)).size,
      csrfTransactions: transactions.map((entry, index) => ({
        index,
        status: entry.status,
        requestHadCookie: Boolean(entry.requestCookie),
        responseSetsCookie: entry.responseSetsCookie,
        responseTokenMatchedRequestCookie: entry.token === entry.requestCookie,
        responseTokenMatchedLoginHeader: entry.token === loginToken,
      })),
      loginHeaderMatchedRequestCookie:
        Boolean(loginToken && loginCookie) && loginToken === decodeURIComponent(loginCookie),
      browserCookieCount: browserCookies.length,
      loginHeaderMatchedBrowserCookie: browserCookies.some(
        (cookie) => decodeURIComponent(cookie.value) === loginToken
      ),
    },
    null,
    2
  )
);

await context.close();
await browser.close();
