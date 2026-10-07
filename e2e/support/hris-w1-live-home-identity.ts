import { chmod } from 'node:fs/promises';

import { expect } from '@playwright/test';

import type { HrisW1LiveEnvironment, HrisW1Tenant } from './hris-w1-live-environment';
import type * as PW from '@playwright/test';

export type HomeLaunchpadIdentityEvidence = Readonly<{
  requestedPath: '/';
  finalPath: '/';
  appId: 'ref-app-people';
  visibleLabel: 'HRIS';
  shortLabel: 'HRIS';
  fullLabel: 'HRIS';
  screenshot: string;
}>;

export async function verifyHomeLaunchpadIdentity(
  page: PW.Page,
  tenant: HrisW1Tenant,
  info: PW.TestInfo,
  runtime: HrisW1LiveEnvironment
): Promise<HomeLaunchpadIdentityEvidence> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#dwp-main-content').first()).toBeVisible({
    timeout: runtime.assertionTimeoutMs,
  });
  await expect
    .poll(() => {
      const current = new URL(page.url());
      return { origin: current.origin, pathname: current.pathname, search: current.search };
    })
    .toEqual({ origin: new URL(runtime.baseURL).origin, pathname: '/', search: '' });

  const tile = page.locator('[data-launchpad-item="ref-app-people"]');
  await expect(tile, 'Global Home must render exactly one HRIS launchpad app.').toHaveCount(1);
  await expect(tile).toBeVisible({ timeout: runtime.assertionTimeoutMs });
  const shortLabel = tile.locator('[data-launchpad-label-short]');
  const fullLabel = tile.locator('[data-launchpad-label-full]');
  await expect(shortLabel).toHaveText('HRIS');
  await expect(fullLabel).toHaveText('HRIS');
  const visibleLabels = await tile
    .locator('[data-launchpad-label-short], [data-launchpad-label-full]')
    .evaluateAll((labels) =>
      labels
        .filter((label) => label.getClientRects().length > 0)
        .map((label) => label.textContent?.trim() ?? '')
        .filter(Boolean)
    );
  expect(visibleLabels, 'Global Home must visibly present the app as HRIS.').toEqual(['HRIS']);

  const screenshot = info.outputPath(`${tenant.label}-global-home-hris-launchpad.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  await chmod(screenshot, 0o600);
  await info.attach(`${tenant.label}-global-home-hris-launchpad`, {
    path: screenshot,
    contentType: 'image/png',
  });
  return {
    requestedPath: '/',
    finalPath: '/',
    appId: 'ref-app-people',
    visibleLabel: 'HRIS',
    shortLabel: 'HRIS',
    fullLabel: 'HRIS',
    screenshot,
  };
}

export async function readHrisW1HomeRuntimeBoundary(page: PW.Page, runtime: HrisW1LiveEnvironment) {
  const root = page.locator('[data-home-runtime-state]').first();
  await expect(root).toBeVisible({ timeout: runtime.assertionTimeoutMs });
  await expect(root).toHaveAttribute('data-home-runtime-state', 'shadow_compare');
  await expect(root).toHaveAttribute('data-home-render-authority', 'legacy');
  await expect(root).toHaveAttribute('data-home-action-authority', 'disabled');
  return Object.freeze({
    runtimeState: 'SHADOW_COMPARE' as const,
    renderAuthority: 'LEGACY' as const,
    actionAuthority: 'DISABLED' as const,
  });
}
