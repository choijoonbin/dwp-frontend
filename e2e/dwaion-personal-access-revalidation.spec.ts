import { expect, test, type Page } from '@playwright/test';

import {
  DWAION_PERSONAL_PERMISSIONS,
  mockDwaionPersonalIntelligence,
} from './support/dwaion-personal-intelligence-fixtures';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

const ARTIFACT_ID = '33333333-3333-4333-8333-333333333333';
const ARTIFACT_PATH = `/api/agent/v1/artifacts/${ARTIFACT_ID}`;

async function setup(page: Page, path: string, deniedPath: string, published = false) {
  await page.clock.install({ time: new Date('2026-09-04T00:05:00Z') });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    permissions: [...FULL_PRODUCT_PERMISSIONS, ...DWAION_PERSONAL_PERMISSIONS],
  });
  const probe = await mockDwaionPersonalIntelligence(page, { published });
  let denied = false;
  let deniedReads = 0;
  let deniedResponses = 0;
  page.on('response', (response) => {
    if (
      new URL(response.url()).pathname === deniedPath &&
      response.request().method() === 'GET' &&
      response.status() === 403
    ) {
      deniedResponses += 1;
    }
  });
  await page.route(
    (url) => url.pathname === deniedPath,
    (route) => {
      if (!denied || route.request().method() !== 'GET') return route.fallback();
      deniedReads += 1;
      return route.fulfill({ status: 403, json: { detail: 'Resource access was revoked.' } });
    }
  );
  await page.goto(path);
  return {
    probe,
    revoke: () => {
      denied = true;
    },
    restore: () => {
      denied = false;
    },
    deniedReads: () => deniedReads,
    deniedResponses: () => deniedResponses,
  };
}

async function reconnect(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
}

for (const deniedPath of ['/api/agent/v1/ai-controls', '/api/agent/v1/ai-controls/memories']) {
  test(`memory endpoint ${deniedPath} denial removes cached preferences and preserves privacy`, async ({
    page,
  }, info) => {
    await page.setViewportSize({
      width: deniedPath.endsWith('/memories') ? 390 : 1440,
      height: 1000,
    });
    const access = await setup(page, '/dwaion/personal-controls', deniedPath);
    await expect(page.getByText('Use a concise, direct tone.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Retention boundaries' })).toBeVisible();
    await page.clock.fastForward(61_001);
    access.revoke();
    await reconnect(page);
    await expect.poll(access.deniedReads).toBe(1);
    await expect(page.getByText('Use a concise, direct tone.')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add preference' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Retention boundaries' })).toBeVisible();
    await page.screenshot({ path: info.outputPath('memory-denied-privacy-available.png') });
    await page.getByRole('button', { name: 'Clean up data' }).click();
    const clear = page.getByRole('dialog', { name: 'Clean up personal AI data' });
    await expect(clear.getByRole('checkbox', { name: 'Personal AI routines' })).toBeVisible();
    await clear.getByRole('button', { name: 'Cancel', exact: true }).click();
    access.restore();
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(page.getByText('Use a concise, direct tone.')).toBeVisible();
  });
}

for (const endpoint of ['capabilities', 'retention']) {
  test(`privacy ${endpoint} denial removes cached privacy controls and preserves memory`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: endpoint === 'retention' ? 320 : 1280, height: 1000 });
    const access = await setup(
      page,
      '/dwaion/personal-controls',
      `/api/agent/v1/personal-data/${endpoint}`
    );
    await expect(page.getByText('Use a concise, direct tone.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Retention boundaries' })).toBeVisible();
    await page.clock.fastForward(61_001);
    access.revoke();
    await reconnect(page);
    await expect.poll(access.deniedReads).toBe(1);
    await expect(page.getByRole('heading', { name: 'Retention boundaries' })).toHaveCount(0);
    await expect(page.getByText('Use a concise, direct tone.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add preference' })).toBeEnabled();
    await page.getByRole('switch', { name: 'Apply preferences to answers: On' }).click();
    await expect.poll(() => access.probe.runtimePreferenceUpdates).toBe(1);
    await page.screenshot({ path: info.outputPath('privacy-denied-memory-available.png') });
    await page.getByRole('button', { name: 'Clean up data' }).click();
    const clear = page.getByRole('dialog', { name: 'Clean up personal AI data' });
    await expect(clear.getByRole('checkbox', { name: 'Personal AI routines' })).toHaveCount(0);
  });
}

for (const suffix of ['', '/versions', '/preflights/current']) {
  test(`artifact ${suffix || 'detail'} denial removes cached selected content and actions`, async ({
    page,
  }, info) => {
    const width = suffix === '/versions' ? 390 : suffix ? 320 : 1440;
    await page.setViewportSize({ width, height: 1000 });
    const access = await setup(page, '/dwaion/artifacts', `${ARTIFACT_PATH}${suffix}`);
    await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(
      'Launch readiness plan'
    );
    await expect(page.getByRole('button', { name: 'Publish personally' })).toBeEnabled();
    await page.getByRole('button', { name: 'Compare versions', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.clock.fastForward(61_001);
    access.revoke();
    await reconnect(page);
    await expect.poll(access.deniedReads).toBe(1);
    await expect.poll(access.deniedResponses).toBe(1);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveCount(0);
    await expect(page.getByText('WK-1042', { exact: true })).toHaveCount(0);
    for (const name of [
      'Publish personally',
      'Request export',
      'Create version and inspect',
      'Compare versions',
    ]) {
      await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
    }
    await expect(
      page.getByRole('heading', { name: 'You do not have access to artifacts' })
    ).toBeVisible();
    await page.screenshot({ path: info.outputPath('artifact-selected-access-denied.png') });
    const openArtifacts = page.getByRole('button', { name: 'Open artifact list' });
    if (await openArtifacts.isVisible()) await openArtifacts.click();
    await expect(page.getByRole('button', { name: /Launch readiness plan/ })).toBeVisible();
    const closePanel = page.getByRole('button', { name: 'Close panel' });
    if (await closePanel.isVisible()) await closePanel.click();
    access.restore();
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(
      'Launch readiness plan'
    );
  });
}

test('artifact access denial cancels a pending autosave before submission', async ({ page }) => {
  const access = await setup(page, '/dwaion/artifacts', ARTIFACT_PATH);
  const title = page.getByRole('textbox', { name: 'Title', exact: true });
  await expect(title).toHaveValue('Launch readiness plan');
  await page.clock.pauseAt(new Date('2026-09-04T00:07:00Z'));
  await title.fill('Unsaved private draft');
  access.revoke();
  const rejectedRead = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === ARTIFACT_PATH &&
      response.request().method() === 'GET' &&
      response.status() === 403
  );
  await reconnect(page);
  await (await rejectedRead).finished();
  await expect.poll(access.deniedReads).toBe(1);
  // Let the query observer's zero-delay notification cancel the 650ms autosave timer.
  await page.clock.resume();
  await expect(title).toHaveCount(0);
  await page.clock.runFor(1_000);
  expect(access.probe.artifactAutosaves).toBe(0);
  access.restore();
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(title).toHaveValue('Launch readiness plan');
  await page.clock.runFor(1_000);
  expect(access.probe.artifactAutosaves).toBe(0);
});

test('a denied immutable version closes cached comparison and requires successful revalidation', async ({
  page,
}) => {
  const access = await setup(page, '/dwaion/artifacts', `${ARTIFACT_PATH}/versions/2`);
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Compare versions', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Immutable version comparison' });
  await dialog.getByRole('combobox', { name: 'Base version' }).click();
  await page.getByRole('option').first().click();
  access.revoke();
  await dialog.getByRole('combobox', { name: 'Comparison version' }).click();
  await page.getByRole('option').nth(1).click();
  await expect.poll(access.deniedReads).toBe(1);
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'You do not have access to artifacts' })
  ).toBeVisible();
  access.restore();
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(
    'Launch readiness plan'
  );
});

test('valid preflight expiry disables publication and closes an open export request', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await setup(page, '/dwaion/artifacts', ARTIFACT_PATH, true);
  const writes: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/agent/v1/artifacts') && request.method() === 'POST') {
      writes.push(request.url());
    }
  });
  const publish = page.getByRole('button', { name: 'Publish personally', exact: true });
  const exportRequest = page.getByRole('button', { name: 'Request export', exact: true });
  await expect(publish).toBeEnabled();
  await expect(exportRequest).toBeEnabled();
  await exportRequest.click();
  const dialog = page.getByRole('dialog', { name: 'Request export' });
  await expect(dialog).toBeVisible();
  await page.clock.fastForward(600_001);
  expect(await page.evaluate(() => Date.now())).toBeGreaterThan(Date.parse('2026-09-04T00:15:00Z'));
  await expect(dialog).toHaveCount(0);
  await expect(publish).toBeDisabled();
  await expect(exportRequest).toBeDisabled();
  expect(writes).toEqual([]);
  await page.screenshot({ path: info.outputPath('artifact-preflight-expired.png') });
});
