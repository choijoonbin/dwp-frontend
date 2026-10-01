import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const readme = await readFile(path.resolve(process.cwd(), '../dwp-backend/README.md'), 'utf8');
const password = readme.match(/공통 비밀번호 `([^`]+)`/)?.[1];
if (!password) throw new Error('Seed password not found.');
const viewportWidth = Number(process.env.INSPECT_WIDTH ?? 1440);
const viewportHeight = Number(process.env.INSPECT_HEIGHT ?? 1000);

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({
  baseURL: 'http://localhost:4200',
  viewport: { width: viewportWidth, height: viewportHeight },
});
const page = await context.newPage();
await page.goto('/sign-in?returnUrl=%2Fadmin%2Fgovernance%2Faudit-investigations', {
  waitUntil: 'domcontentloaded',
});
await page.evaluate(() => window.localStorage.setItem('dwp.tenantId', '1'));
await page.locator('input[name="email"]').fill('joonbin@sk.com');
await page.locator('input[name="password"]').fill(password);
const login = page.waitForResponse(
  (response) =>
    new URL(response.url()).pathname === '/api/auth/login' &&
    response.request().method() === 'POST'
);
await page.locator('#dwp-sign-in-form button[type="submit"]').click();
if ((await login).status() !== 200) throw new Error('Login failed.');
await page.waitForURL((url) => url.pathname === '/admin/governance/audit-investigations');
await page.locator('#dwp-main-content').waitFor({ state: 'visible' });
await page.waitForTimeout(3000);

const evidence = await page.evaluate(() => {
  const main = document.querySelector('#dwp-main-content');
  if (!main) throw new Error('Main content not found.');
  const mainRect = main.getBoundingClientRect();
  const describe = (element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      tag: element.tagName.toLowerCase(),
      id: element.id || null,
      className: String(element.className || '').slice(0, 240),
      role: element.getAttribute('role'),
      ariaLabel: element.getAttribute('aria-label'),
      text: element.textContent?.trim().slice(0, 180) || '',
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      rectLeft: Math.round(rect.left),
      rectRight: Math.round(rect.right),
      overflowX: style.overflowX,
    };
  };
  const visible = [...main.querySelectorAll('*')].filter((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0;
  });
  return {
    main: describe(main),
    descendantsBeyondMain: visible
      .filter((element) => element.getBoundingClientRect().right > mainRect.right + 1)
      .map(describe)
      .slice(0, 30),
    localScrollers: visible
      .filter(
        (element) =>
          element.scrollWidth > element.clientWidth + 1 &&
          ['auto', 'scroll'].includes(getComputedStyle(element).overflowX)
      )
      .map(describe)
      .slice(0, 30),
  };
});

await page.screenshot({
  path: `/Users/a10697/Work/DWP/output/admin-account-settings-final-smoke-2026-10-01/screenshots/admin-audit-investigations-${viewportWidth}.png`,
  fullPage: true,
});
console.log(JSON.stringify(evidence, null, 2));
await context.close();
await browser.close();
