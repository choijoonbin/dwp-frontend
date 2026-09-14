import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

const root = '/Users/a10697/Work/DWP';
const output = root + '/output/workplace-full-implementation-final/live-browser';
await fs.mkdir(output, { recursive: true });
const readme = await fs.readFile(root + '/dwp-backend/README.md', 'utf8');
const password = readme.match(/공통 비밀번호 `([^`]+)`/)[1];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ baseURL: 'http://localhost:4200', viewport: { width: 1440, height: 1000 } });
const csrfResponse = await context.request.get('/api/auth/csrf');
const csrf = (await csrfResponse.json()).data;
const login = await context.request.post('/api/auth/login', { data: { email: 'hyunwoo.park@sk.com', password, tenantId: 'default' }, headers: { [csrf.headerName]: csrf.token } });
if (login.status() !== 200) throw new Error('Real local tenant login failed: ' + login.status());
const tenantId = (await login.json()).data.tenantId;
await context.addInitScript(id => localStorage.setItem('dwp.tenantId', id), tenantId);
const page = await context.newPage();
const results = [];
for (const [name, path, api] of [
  ['home', '/workplace/home', '/v1/workplace/explore'],
  ['insights', '/workplace/admin/overview?view=insights', '/v1/admin/workplace/experience-report'],
  ['governance', '/workplace/admin/governance?area=experience', '/v1/admin/workplace/experience/collaboration/overview'],
]) {
  const response = page.waitForResponse(value => new URL(value.url()).pathname.endsWith(api), { timeout: 30_000 }).catch(() => null);
  await page.goto(path);
  const actual = await response;
  await page.screenshot({ path: output + '/' + name + '-1440.png', fullPage: true });
  results.push({ name, requestedPath: path, actualPath: new URL(page.url()).pathname, api, apiStatus: actual?.status() ?? null, passed: actual?.status() === 200 && new URL(page.url()).pathname === path.split('?')[0] });
}
await browser.close();
await fs.writeFile(output + '/manifest.json', JSON.stringify({ checkedAt: new Date().toISOString(), source: 'LIVE_BROWSER_REAL_LOCAL_LOGIN_NO_RESPONSE_MOCKS', results, allPassed: results.every(result => result.passed) }, null, 2) + '\n');
process.stdout.write(JSON.stringify({ allPassed: results.every(result => result.passed), results }) + '\n');
