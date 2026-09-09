import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import {
  DWAION_PERSONAL_PERMISSIONS,
  mockDwaionPersonalIntelligence,
} from './support/dwaion-personal-intelligence-fixtures';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

for (const mode of ['dark', 'high-contrast', 'text-200'] as const) {
  for (const surface of [
    { path: 'routines', title: 'My AI routines' },
    { path: 'personal-controls', title: 'My AI controls' },
    { path: 'artifacts', title: 'Artifact studio' },
  ]) {
    test(`${surface.path} remains readable with ${mode}`, async ({ page }, info) => {
      const width = mode === 'text-200' ? 640 : mode === 'high-contrast' ? 390 : 1280;
      await page.setViewportSize({ width, height: 1000 });
      await page.clock.setFixedTime(new Date('2026-09-04T00:05:00Z'));
      await page.emulateMedia({
        colorScheme: mode === 'dark' ? 'dark' : 'light',
        reducedMotion: 'reduce',
        forcedColors: mode === 'high-contrast' ? 'active' : 'none',
      });
      await mockShellSession(page, ['WORKSPACE_MEMBER'], {
        locale: 'en',
        permissions: [...FULL_PRODUCT_PERMISSIONS, ...DWAION_PERSONAL_PERMISSIONS],
        appearance: {
          mode: mode === 'dark' ? 'dark' : 'light',
          density: 'standard',
          highContrast: mode === 'high-contrast',
          reduceMotion: true,
        },
      });
      await mockDwaionPersonalIntelligence(page);
      await page.goto(`/dwaion/${surface.path}`);
      if (mode === 'text-200')
        await page.evaluate(() => {
          document.documentElement.style.fontSize = '200%';
        });
      await expect(page.getByRole('heading', { name: surface.title, exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width
      );
      const violations = (
        await new AxeBuilder({ page }).include('#dwp-main-content').analyze()
      ).violations.filter((item) => ['critical', 'serious'].includes(item.impact ?? ''));
      expect(violations).toEqual([]);
      await page.screenshot({
        path: info.outputPath(`${surface.path}-${mode}.png`),
        fullPage: true,
        animations: 'disabled',
      });
    });
  }
}
