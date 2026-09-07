import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator } from '@playwright/test';

import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

const MESSAGING_PERMISSIONS = ['VIEW', 'CREATE', 'UPDATE'].map((permissionCode) => ({
  resourceType: 'APP',
  resourceKey: 'APP.MESSAGING',
  permissionCode,
  effect: 'ALLOW' as const,
}));

type WidthScenario = {
  name: string;
  path: string;
  roles: string[];
  root: string;
};

const desktopScenarios: readonly WidthScenario[] = [
  {
    name: 'calendar',
    path: '/calendar/home',
    roles: ['CALENDAR_ADMIN'],
    root: '[data-calendar-canvas="command"]',
  },
  {
    name: 'messaging',
    path: '/messages/home',
    roles: ['WORKSPACE_MEMBER'],
    root: '[data-testid="messaging-home-canvas"]',
  },
  {
    name: 'meetings',
    path: '/meetings/home',
    roles: ['WORKSPACE_MEMBER'],
    root: '[data-testid="meeting-command-primary"]',
  },
  {
    name: 'communications',
    path: '/communications/all',
    roles: ['ADMIN'],
    root: '[data-dwp-page-canvas="workspace"] > :first-child',
  },
  {
    name: 'mail',
    path: '/mail/home',
    roles: ['WORKSPACE_MEMBER'],
    root: '[data-dwp-page-canvas="workspace"] > :first-child',
  },
  {
    name: 'notifications',
    path: '/notifications/home',
    roles: ['WORKSPACE_MEMBER'],
    root: '[data-dwp-page-canvas="workspace"] > :first-child',
  },
  {
    name: 'hcm',
    path: '/hr/home',
    roles: ['HR_ADMIN'],
    root: '[data-testid="hcm-home-overview"]',
  },
  {
    name: 'provider overview',
    path: '/provider/overview',
    roles: ['PROVIDER_ADMIN'],
    root: '[data-testid="provider-overview-canvas"]',
  },
  {
    name: 'provider tenants',
    path: '/provider/tenants',
    roles: ['PROVIDER_ADMIN'],
    root: '[data-testid="provider-tenants-canvas"]',
  },
  {
    name: 'provider operations',
    path: '/provider/operations',
    roles: ['PROVIDER_ADMIN'],
    root: '[data-testid="provider-operations-canvas"]',
  },
  {
    name: 'provider health',
    path: '/provider/health',
    roles: ['PROVIDER_ADMIN'],
    root: '[data-testid="provider-health-canvas"]',
  },
  {
    name: 'administration',
    path: '/admin/governance/api-monitoring',
    roles: ['TENANT_ADMIN'],
    root: '[data-testid="api-monitoring"]',
  },
  {
    name: 'administration saved-view custody',
    path: '/admin/identity/saved-view-custody',
    roles: ['TENANT_ADMIN'],
    root: '[data-testid="saved-view-custody-canvas"]',
  },
];

async function workspaceWidth(root: Locator) {
  return root.evaluate((element) => {
    const canvas = element.closest<HTMLElement>('[data-dwp-page-canvas="workspace"]');
    if (!canvas) throw new Error('Workspace root is not contained by PageCanvas.');
    const canvasStyle = getComputedStyle(canvas);
    const canvasBounds = canvas.getBoundingClientRect();
    const rootBounds = element.getBoundingClientRect();
    const paddingInlineStart = Number.parseFloat(canvasStyle.paddingInlineStart);
    const paddingInlineEnd = Number.parseFloat(canvasStyle.paddingInlineEnd);
    const contentStart = canvasBounds.left + paddingInlineStart;
    const contentEnd = canvasBounds.right - paddingInlineEnd;

    return {
      canvasWidth: canvasBounds.width,
      rootWidth: rootBounds.width,
      startDelta: rootBounds.left - contentStart,
      endDelta: contentEnd - rootBounds.right,
      paddingInlineStart,
      paddingInlineEnd,
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}

async function expectFluidWorkspace(root: Locator) {
  await expect(root).toBeVisible({ timeout: 15_000 });
  const metrics = await workspaceWidth(root);
  expect(metrics.rootWidth).toBeGreaterThan(0);
  expect(Math.abs(metrics.startDelta)).toBeLessThanOrEqual(1.5);
  expect(Math.abs(metrics.endDelta)).toBeLessThanOrEqual(1.5);
  expect(metrics.paddingInlineStart).toBe(metrics.paddingInlineEnd);
  expect(metrics.documentOverflow).toBeLessThanOrEqual(1);
  return metrics;
}

test.describe('shared workspace page width', () => {
  test.describe.configure({ mode: 'parallel' });

  for (const scenario of desktopScenarios) {
    test(`${scenario.name} consumes the shared fluid workspace width at 1920px`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== 'chromium');
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await mockShellSession(page, scenario.roles, {
        locale: 'en',
        permissions:
          scenario.name === 'messaging' ? MESSAGING_PERMISSIONS : FULL_PRODUCT_PERMISSIONS,
      });

      await page.goto(scenario.path);
      const root = page.locator(scenario.root).first();
      const metrics = await expectFluidWorkspace(root);
      expect(metrics.canvasWidth - metrics.rootWidth).toBeCloseTo(
        metrics.paddingInlineStart + metrics.paddingInlineEnd,
        0
      );
      testInfo.annotations.push({
        type: 'workspace-width',
        description: `${scenario.name}: canvas=${metrics.canvasWidth}px root=${metrics.rootWidth}px gutter=${metrics.paddingInlineStart}px`,
      });
      if (scenario.name === 'calendar' || scenario.name === 'mail') {
        const screenshotPath = testInfo.outputPath(`${scenario.name}-workspace-1920.png`);
        await page.screenshot({ path: screenshotPath, fullPage: false });
        await testInfo.attach(`${scenario.name}-workspace-1920`, {
          path: screenshotPath,
          contentType: 'image/png',
        });
      }
    });
  }
});

test('calendar keeps the same shared gutter at 1280px and 1440px', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium');
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });

  for (const width of [1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/calendar/home');
    const metrics = await expectFluidWorkspace(
      page.locator('[data-calendar-canvas="command"]').first()
    );
    expect(metrics.paddingInlineStart).toBe(24);
    testInfo.annotations.push({
      type: 'workspace-width',
      description: `calendar-${width}: canvas=${metrics.canvasWidth}px root=${metrics.rootWidth}px gutter=${metrics.paddingInlineStart}px`,
    });
  }
});

test('workspace width stays symmetric at 320px and 390px with 200% text, RTL and forced colors', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/calendar/home');
    await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
    await page.evaluate(() => {
      document.documentElement.dir = 'rtl';
    });

    const root = page.locator('[data-calendar-canvas="command"]').first();
    const metrics = await expectFluidWorkspace(root);
    expect(metrics.paddingInlineStart).toBe(16);
    testInfo.annotations.push({
      type: 'workspace-width',
      description: `calendar-mobile-${width}-200%-rtl-forced: canvas=${metrics.canvasWidth}px root=${metrics.rootWidth}px gutter=${metrics.paddingInlineStart}px`,
    });

    const accessibility = await new AxeBuilder({ page })
      .include('[data-calendar-canvas="command"]')
      .analyze();
    expect(
      accessibility.violations.filter(
        (violation) => violation.impact === 'critical' || violation.impact === 'serious'
      )
    ).toEqual([]);
  }
});
