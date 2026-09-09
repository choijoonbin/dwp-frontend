import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

const scenarios = [
  { name: '320-light', width: 320, height: 720 },
  { name: '390-light', width: 390, height: 844 },
  { name: '768-light', width: 768, height: 1024 },
  { name: '390-text-200', width: 390, height: 844, textScale: 200 },
  { name: '320-dark', width: 320, height: 720, dark: true },
  { name: '320-forced-colors', width: 320, height: 720, forcedColors: true },
] as const;

for (const scenario of scenarios) {
  test(`the dock preserves complete header commands at ${scenario.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: scenario.width, height: scenario.height });
    await page.emulateMedia({
      reducedMotion: 'reduce',
      ...('dark' in scenario ? { colorScheme: 'dark' } : {}),
      ...('forcedColors' in scenario ? { forcedColors: 'active' } : {}),
    });
    await mockShellSession(page, ['WORKSPACE_MEMBER'], {
      locale: 'en',
      displayName: 'Mina Kim',
      permissions: FULL_PRODUCT_PERMISSIONS,
    });
    await page.goto('/');
    if ('textScale' in scenario) {
      await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
    }
    const launcher = page.getByTestId('dwaion-launcher');
    const trigger = launcher.getByRole('button', { name: 'Open DWAI·ON' });
    await expect(trigger).toBeVisible();
    await expect(launcher).toHaveAttribute('data-shell-auxiliary-placement', 'header');
    const header = page.getByTestId('home-header');
    const geometry = await header.evaluate((element) => {
      const dock = element.querySelector<HTMLElement>('[data-testid="dwaion-launcher"]')!;
      const dockRect = dock.getBoundingClientRect();
      const headerRect = element.getBoundingClientRect();
      const controls = [...element.querySelectorAll<HTMLElement>('a, button')]
        .filter((control) => !dock.contains(control))
        .map((control) => ({
          name: control.getAttribute('aria-label') || control.textContent?.trim(),
          rect: control.getBoundingClientRect().toJSON(),
        }))
        .filter(({ rect }) => rect.width > 0 && rect.height > 0);
      return {
        dock: dockRect.toJSON(),
        header: headerRect.toJSON(),
        controls,
        overlaps: controls.filter(
          ({ rect }) =>
            rect.left < dockRect.right &&
            rect.right > dockRect.left &&
            rect.top < dockRect.bottom &&
            rect.bottom > dockRect.top
        ),
        clipped: controls.filter(
          ({ rect }) => rect.left < headerRect.left || rect.right > headerRect.right
        ),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    await testInfo.attach('header-geometry', {
      body: JSON.stringify(geometry, null, 2),
      contentType: 'application/json',
    });
    expect(geometry.dock.width).toBeGreaterThanOrEqual(44);
    expect(geometry.dock.height).toBeGreaterThanOrEqual(44);
    expect(geometry.dock.left).toBeGreaterThanOrEqual(geometry.header.left);
    expect(geometry.dock.right).toBeLessThanOrEqual(geometry.header.right);
    expect(geometry.dock.top).toBeGreaterThanOrEqual(geometry.header.top);
    expect(geometry.dock.bottom).toBeLessThanOrEqual(geometry.header.bottom);
    expect(geometry.overlaps).toEqual([]);
    expect(geometry.clipped).toEqual([]);
    expect(geometry.overflow).toBeLessThanOrEqual(1);
    await expect(header.getByRole('button', { name: /Search/i })).toBeVisible();
    await expect(header.getByRole('button', { name: /Notifications/i })).toBeVisible();
    await expect(header.getByRole('button', { name: /Mina Kim/i })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`dwaion-launcher-${scenario.name}.png`) });
    const audit = await new AxeBuilder({ page }).include('[data-testid="home-header"]').analyze();
    expect(
      audit.violations.filter((issue) => ['serious', 'critical'].includes(issue.impact ?? ''))
    ).toEqual([]);
    await trigger.focus();
    await trigger.press('Enter');
    const panel = page.getByRole('dialog', { name: 'DWAI·ON conversation and support panel' });
    await expect(panel).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`U10-panel-${scenario.name}.png`) });
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(trigger).toBeFocused();
  });
}
