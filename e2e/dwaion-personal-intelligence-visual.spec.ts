import { expect, test, type Page, type TestInfo } from '@playwright/test';

import {
  DWAION_PERSONAL_PERMISSIONS,
  mockDwaionPersonalIntelligence,
} from './support/dwaion-personal-intelligence-fixtures';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

const SURFACES = [
  { id: 'routines', path: '/dwaion/routines', heading: 'My AI routines' },
  { id: 'controls', path: '/dwaion/personal-controls', heading: 'My AI controls' },
  { id: 'artifacts', path: '/dwaion/artifacts', heading: 'Artifact studio' },
] as const;

async function prepareSurface(page: Page, testInfo: TestInfo, path: string, heading: string) {
  const mobile = testInfo.project.name === 'mobile';
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
  await page.clock.setFixedTime(new Date('2026-09-04T00:00:00Z'));
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce', forcedColors: 'none' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    displayName: 'Mina Kim',
    permissions: [...FULL_PRODUCT_PERMISSIONS, ...DWAION_PERSONAL_PERMISSIONS],
    appearance: {
      mode: 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
  await mockDwaionPersonalIntelligence(page);
  await page.goto(path);

  const main = page.locator('#dwp-main-content');
  await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  await expect(main.locator('.MuiSkeleton-root')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => window.innerWidth)
  );
  return main;
}

for (const surface of SURFACES) {
  test(`DWAI personal ${surface.id} keeps its governed visual baseline`, async ({
    page,
  }, testInfo) => {
    const main = await prepareSurface(page, testInfo, surface.path, surface.heading);
    await expect(main).toHaveScreenshot(`dwaion-personal-${surface.id}.png`, {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.002,
      timeout: 15_000,
    });
  });
}
