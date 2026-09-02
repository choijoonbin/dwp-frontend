import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

import type { Page } from '@playwright/test';

async function expectCompactHeaderIntegrity(page: Page, headerTestId: string) {
  const geometry = await page.evaluate((testId) => {
    const header = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
    if (!header) throw new Error(`Missing shell header: ${testId}`);

    const actions = [...header.querySelectorAll<HTMLElement>('a[href], button')]
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          rect.width > 0 &&
          rect.height > 0
        );
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          name:
            element.getAttribute('aria-label') ||
            element.getAttribute('data-testid') ||
            element.textContent?.trim() ||
            element.tagName,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
        };
      });
    const overlaps: string[] = [];
    for (let leftIndex = 0; leftIndex < actions.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < actions.length; rightIndex += 1) {
        const left = actions[leftIndex];
        const right = actions[rightIndex];
        const horizontalIntersection =
          Math.min(left.right, right.right) - Math.max(left.left, right.left);
        const verticalIntersection =
          Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top);
        if (horizontalIntersection > 1 && verticalIntersection > 1) {
          overlaps.push(`${left.name} <> ${right.name}`);
        }
      }
    }

    return {
      documentClientWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      headerClientWidth: header.clientWidth,
      headerScrollWidth: header.scrollWidth,
      innerWidth: window.innerWidth,
      outsideViewport: actions
        .filter((action) => action.left < -1 || action.right > window.innerWidth + 1)
        .map((action) => action.name),
      overlaps,
    };
  }, headerTestId);

  expect(geometry.documentScrollWidth).toBeLessThanOrEqual(geometry.documentClientWidth + 1);
  expect(geometry.documentScrollWidth).toBeLessThanOrEqual(geometry.innerWidth + 1);
  expect(geometry.headerScrollWidth).toBeLessThanOrEqual(geometry.headerClientWidth + 1);
  expect(geometry.outsideViewport).toEqual([]);
  expect(geometry.overlaps).toEqual([]);
}

test.describe('desktop sidebar collapse control', () => {
  test.skip(({ isMobile }) => isMobile, 'The compact navigation rail is desktop-only.');

  test('lives inside every tenant sidebar and morphs without losing focus', async ({ page }) => {
    await mockShellSession(page, ['TENANT_ADMIN'], {
      locale: 'en',
      appearance: {
        mode: 'light',
        density: 'standard',
        highContrast: false,
        reduceMotion: true,
      },
    });

    const shells = [
      {
        route: '/work',
        sidebarTestId: 'work-sidebar',
        headerTestId: 'work-header',
        controlsId: 'work-desktop-navigation',
      },
      {
        route: '/account/profile',
        sidebarTestId: 'account-sidebar',
        headerTestId: 'account-header',
        controlsId: 'account-desktop-navigation',
      },
      {
        route: '/admin/experience/branding',
        sidebarTestId: 'admin-sidebar',
        headerTestId: 'admin-header',
        controlsId: 'admin-desktop-navigation',
      },
    ] as const;

    for (const shell of shells) {
      await page.goto(shell.route);
      const sidebar = page.getByTestId(shell.sidebarTestId);
      const toggle = sidebar.getByTestId('desktop-navigation-toggle');
      await expect(toggle).toBeVisible();
      await expect(toggle).toHaveAttribute('aria-controls', shell.controlsId);
      await expect(
        page.getByTestId(shell.headerTestId).getByTestId('desktop-navigation-toggle')
      ).toHaveCount(0);
    }

    await page.goto('/work');
    const sidebar = page.getByTestId('work-sidebar');
    const toggle = sidebar.getByTestId('desktop-navigation-toggle');
    const restingVisual = toggle.locator('[data-navigation-toggle-visual="resting"]');
    const activeVisual = toggle.locator('[data-navigation-toggle-visual="active"]');

    await expect(sidebar).toHaveCSS('width', '248px');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(restingVisual).toHaveAttribute('data-navigation-toggle-visual-kind', 'sidebar');
    await expect(activeVisual).toHaveAttribute('data-navigation-toggle-visual-kind', 'collapse');
    await expect(restingVisual).toHaveCSS('opacity', '1');
    await expect(activeVisual).toHaveCSS('opacity', '0');

    await toggle.hover();
    await expect(restingVisual).toHaveCSS('opacity', '0');
    await expect(activeVisual).toHaveCSS('opacity', '1');
    const collapseTooltip = page.getByRole('tooltip', { name: 'Collapse navigation' });
    await expect(collapseTooltip).toBeVisible();
    const [toggleBox, tooltipBox] = await Promise.all([
      toggle.boundingBox(),
      collapseTooltip.boundingBox(),
    ]);
    expect(tooltipBox?.x ?? 0).toBeGreaterThan(toggleBox?.x ?? 0);

    await page.mouse.move(600, 400);
    await toggle.focus();
    await page.keyboard.press('Enter');

    await expect(sidebar).toHaveCSS('width', '72px');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toBeFocused();
    await expect(restingVisual).toHaveAttribute(
      'data-navigation-toggle-visual-kind',
      'product-mark'
    );
    await expect(activeVisual).toHaveAttribute('data-navigation-toggle-visual-kind', 'expand');
    await expect(sidebar.getByRole('link', { name: 'Digital Workplace home' })).toHaveCount(0);

    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await expect(restingVisual).toHaveCSS('opacity', '1');
    await expect(activeVisual).toHaveCSS('opacity', '0');

    await toggle.hover();
    await expect(restingVisual).toHaveCSS('opacity', '0');
    await expect(activeVisual).toHaveCSS('opacity', '1');
    await expect(page.getByRole('tooltip', { name: 'Expand navigation' })).toBeVisible();

    await page.mouse.move(600, 400);
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(sidebar).toHaveCSS('width', '248px');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(toggle).toBeFocused();
  });

  test('uses the same sidebar-owned control in the provider shell', async ({ page }) => {
    await mockShellSession(page, ['PROVIDER_ADMIN'], {
      locale: 'en',
      appearance: {
        mode: 'dark',
        density: 'standard',
        highContrast: false,
        reduceMotion: true,
      },
    });
    await page.goto('/provider/overview');

    const sidebar = page.getByTestId('provider-sidebar');
    const toggle = sidebar.getByTestId('desktop-navigation-toggle');
    await expect(sidebar).toHaveCSS('width', '272px');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-controls', 'provider-desktop-navigation');
    await expect(
      page.getByTestId('provider-header').getByTestId('desktop-navigation-toggle')
    ).toHaveCount(0);
    await toggle.hover();
    await expect(toggle.locator('[data-navigation-toggle-visual-kind="collapse"]')).toHaveCSS(
      'opacity',
      '1'
    );
  });
});

test.describe('compact product shell header contract', () => {
  test.skip(({ isMobile }) => isMobile, 'The viewport matrix runs in the Chromium project.');

  test('keeps catalog navigation usable at the 320 and 390 pixel mobile edges', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockShellSession(page, ['TENANT_ADMIN'], {
      locale: 'en',
      permissions: FULL_PRODUCT_PERMISSIONS,
      appearance: {
        mode: 'light',
        density: 'standard',
        highContrast: false,
        reduceMotion: true,
      },
    });

    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    for (const width of [320, 390] as const) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/apps');

      const header = page.getByTestId('catalog-header');
      const navigationTrigger = page.getByTestId('catalog-mobile-navigation-trigger');
      await expect(header).toHaveAttribute('data-dwp-shell', 'catalog');
      await expect(header).toHaveAttribute('data-dwp-shell-context', 'Apps');
      await expect(header.getByTestId('shell-application-context')).toContainText('Apps');
      await expect(navigationTrigger).toBeVisible();
      await expect(navigationTrigger).toHaveAttribute('aria-controls', 'catalog-mobile-navigation');
      const triggerBox = await navigationTrigger.boundingBox();
      expect(triggerBox?.width ?? 0).toBeGreaterThanOrEqual(40);
      expect(triggerBox?.height ?? 0).toBeGreaterThanOrEqual(40);
      if (width < 360) {
        await expect(page.getByRole('button', { name: 'Search DWP' })).toHaveCount(0);
      } else {
        await expect(page.getByRole('button', { name: 'Search DWP' })).toBeVisible();
      }
      await expect(page.getByRole('button', { name: 'Notifications' })).toBeVisible();
      await expect(page.getByRole('button', { name: /^Account:/ })).toBeVisible();
      await expectCompactHeaderIntegrity(page, 'catalog-header');

      await navigationTrigger.click();
      await expect(navigationTrigger).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('#dwp-main-content')).toHaveAttribute('inert', '');
      const drawer = page.getByTestId('catalog-mobile-sidebar');
      await expect(drawer).toBeVisible();
      await expect(drawer.getByRole('link', { name: 'Apps' })).toHaveAttribute(
        'aria-current',
        'page'
      );
      const accessibility = await new AxeBuilder({ page })
        .include('[data-testid="catalog-header"]')
        .include('[data-testid="catalog-mobile-sidebar"]')
        .analyze();
      expect(accessibility.violations).toEqual([]);
      const close = page.getByRole('button', { name: 'Close navigation' });
      const closeBox = await close.boundingBox();
      expect(closeBox?.width ?? 0).toBeGreaterThanOrEqual(40);
      expect(closeBox?.height ?? 0).toBeGreaterThanOrEqual(40);
      await close.click();
      await expect(navigationTrigger).toBeFocused();
      await expect(page.locator('#dwp-main-content')).not.toHaveAttribute('inert', '');
    }

    expect(runtimeErrors).toEqual([]);
  });

  test('keeps tenant product actions separated across compact and 200 percent layouts', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockShellSession(page, ['TENANT_ADMIN'], {
      locale: 'en',
      permissions: FULL_PRODUCT_PERMISSIONS,
      appearance: {
        mode: 'light',
        density: 'standard',
        highContrast: false,
        reduceMotion: true,
      },
    });

    const products = [
      { path: '/dwaion/new', headerTestId: 'dwaion-header', launcher: 'hidden' },
      { path: '/workplace/home', headerTestId: 'rooms-header', launcher: 'visible' },
      { path: '/apps', headerTestId: 'catalog-header', launcher: 'visible' },
    ] as const;
    const scenarios = [
      { width: 320, height: 720, textScale: 100 },
      { width: 390, height: 844, textScale: 100 },
      { width: 768, height: 1024, textScale: 100 },
      { width: 320, height: 720, textScale: 200 },
      { width: 390, height: 844, textScale: 200 },
      { width: 768, height: 1024, textScale: 200 },
    ] as const;

    for (const product of products) {
      for (const scenario of scenarios) {
        await page.setViewportSize({ width: scenario.width, height: scenario.height });
        await page.goto(product.path);
        if (scenario.textScale === 200) {
          await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
        }
        await expect(page.getByTestId(product.headerTestId)).toBeVisible();
        if (scenario.width < 360) {
          await expect(page.getByRole('button', { name: 'Search DWP' })).toHaveCount(0);
        } else {
          await expect(page.getByRole('button', { name: 'Search DWP' })).toBeVisible();
        }
        await expect(page.getByRole('button', { name: 'Notifications' })).toBeVisible();
        await expect(page.getByRole('button', { name: /^Account:/ })).toBeVisible();
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve))
            )
        );

        const launcher = page.getByTestId('dwaion-launcher');
        if (product.launcher === 'hidden') {
          await expect(launcher).toHaveCount(0);
        } else {
          await expect(launcher).toBeVisible();
          await expect(launcher).toHaveAttribute('data-shell-auxiliary-placement', 'header');
        }
        await expectCompactHeaderIntegrity(page, product.headerTestId);
      }
    }
  });

  test('keeps provider utilities compact without tenant notifications or DWAI·ON', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockShellSession(page, ['PROVIDER_ADMIN'], {
      locale: 'en',
      appearance: {
        mode: 'light',
        density: 'standard',
        highContrast: false,
        reduceMotion: true,
      },
    });

    for (const scenario of [
      { width: 320, height: 720, textScale: 100 },
      { width: 390, height: 844, textScale: 200 },
    ] as const) {
      await page.setViewportSize({ width: scenario.width, height: scenario.height });
      await page.goto('/provider/overview');
      if (scenario.textScale === 200) {
        await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
      }
      await expect(page.getByTestId('provider-header')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Search DWP' })).toBeVisible();
      await expect(page.getByRole('button', { name: /^Account:/ })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Notifications' })).toHaveCount(0);
      await expect(page.getByTestId('dwaion-launcher')).toHaveCount(0);
      await expectCompactHeaderIntegrity(page, 'provider-header');
    }
  });
});
