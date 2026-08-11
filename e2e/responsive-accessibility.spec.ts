import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { mockShellSession } from './support/shell-session';

const viewports = [
  { name: 'compact', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'wide', width: 1920, height: 1080 },
] as const;

for (const viewport of viewports) {
  test(`workspace resource views reflow at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockShellSession(page, ['WORKSPACE_MEMBER']);

    for (const path of ['/work', '/activity', '/apps']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const overflow = await page.evaluate(() =>
        Math.max(0, document.documentElement.scrollWidth - window.innerWidth)
      );
      expect(overflow, `${path} must not overflow the viewport`).toBeLessThanOrEqual(1);
    }
  });
}

test('work view passes serious accessibility checks at 200 percent text size', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    appearance: {
      mode: 'light',
      density: 'standard',
      highContrast: true,
      reduceMotion: true,
    },
  });
  await page.goto('/work');
  await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
  await expect(page.getByRole('heading', { level: 1, name: /work|업무/i })).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious'
  );
  expect(blocking).toEqual([]);
});
