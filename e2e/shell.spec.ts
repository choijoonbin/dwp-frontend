import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function expectNoAutomaticAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const summary = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.map((node) => ({ target: node.target, html: node.html })),
  }));
  expect(summary).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  let homePreference = {
    schemaVersion: 1,
    customized: false,
    layout: {
      appLayout: null,
      widgets: [
        { widgetKey: 'announcements', visible: true },
        { widgetKey: 'daily-brief', visible: true },
        { widgetKey: 'focus', visible: true },
        { widgetKey: 'schedule', visible: true },
        { widgetKey: 'activity', visible: true },
      ],
    },
    version: 0,
    updatedAt: null,
  };

  await page.route('**/api/platform/v1/home-experience', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          headline: null,
          subheadline: null,
          backgroundPosition: 'CENTER',
          overlayOpacity: 18,
          backgroundUrl: null,
          version: 0,
        },
      }),
    })
  );
  await page.route('**/api/platform/v1/tenant-branding', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: { organizationName: null, logoUrl: null, version: 0 },
      }),
    })
  );
  await page.route('**/api/platform/v1/announcements', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data: [] }),
    })
  );
  await page.route('**/api/platform/v1/home-preferences**', async (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data: homePreference }),
      });
      return;
    }
    if (new URL(request.url()).pathname.endsWith('/reset')) {
      homePreference = {
        ...homePreference,
        customized: false,
        layout: {
          appLayout: null,
          widgets: homePreference.layout.widgets.map((widget) => ({ ...widget, visible: true })),
        },
        version: 0,
        updatedAt: null,
      };
    } else {
      const body = request.postDataJSON() as { layout: typeof homePreference.layout };
      const nextVersion = homePreference.customized ? homePreference.version + 1 : 0;
      homePreference = {
        ...homePreference,
        customized: true,
        layout: body.layout,
        version: nextVersion,
        updatedAt: '2026-08-10T04:00:00Z',
      };
    }
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data: homePreference }),
    });
  });
  await page.route('**/api/auth/csrf', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: { token: 'csrf-token', headerName: 'X-XSRF-TOKEN' },
      }),
    })
  );
});

async function mockAgentPlanContract(page: Page) {
  await page.route('**/api/auth/csrf', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: { token: 'csrf-token', headerName: 'X-XSRF-TOKEN' },
      }),
    })
  );
  await page.route('**/api/agent/v1/plans/preview', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'Plan preview prepared.',
        success: true,
        data: {
          runId: 'run-ref-1042',
          auditId: 'AUD-REF-1042',
          planHash: 'a'.repeat(64),
          correlationId: 'correlation-ref-1042',
          state: 'REVIEW',
          riskTier: 'L2',
          approvalRequired: true,
          mutationAllowed: false,
          summary: 'Prepare a governed flexible work request preview.',
          steps: [
            {
              id: 'verify-sources',
              title: 'Verify source permissions and freshness',
              tool: 'policy.check',
              description: 'Stop if a source is outside the user scope.',
            },
            {
              id: 'human-gate',
              title: 'Wait for explicit user approval',
              tool: 'workflow.human-approval',
              description: 'A separate approved command is required before mutation.',
            },
          ],
          sourceReferences: ['src-policy-flex', 'src-remote-guide'],
          referenceMode: true,
          agentRegistry: {
            entryKey: 'REFERENCE_PLANNER',
            revision: 2,
            artifactVersion: '1.1.0',
            riskTier: 'MEDIUM',
            resolution: 'ACTIVE',
          },
        },
      }),
    })
  );
}

test('unauthenticated users see the login shell without business navigation', async ({ page }) => {
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ERROR', errorCode: 'UNAUTHORIZED' }),
    });
  });
  await page.route('**/api/auth/policy', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          tenantId: 1,
          defaultLoginType: 'LOCAL',
          allowedLoginTypes: ['LOCAL'],
          localLoginEnabled: true,
          ssoLoginEnabled: false,
          requireMfa: false,
        },
      }),
    });
  });
  await page.route('**/api/auth/idp', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data: [] }),
    });
  });

  await page.goto('/');
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute(
    'href',
    '/assets/brand/dwp-mark.svg'
  );
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    'href',
    '/assets/brand/dwp-touch-icon-180.png'
  );
  const faviconResponse = await page.request.get('/assets/brand/dwp-mark.svg');
  expect(faviconResponse.ok()).toBe(true);
  expect(faviconResponse.headers()['content-type']).toContain('image/svg+xml');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  const password = page.getByRole('textbox', { name: /^Password/ });
  await password.fill('access-policy-test');
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Hide password' }).click();
  await expect(password).toHaveAttribute('type', 'password');
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.mouse.move(0, 0);
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await expect(page.locator('nav')).toHaveCount(0);
  await expectNoAutomaticAccessibilityViolations(page);
});

test('authenticated users enter a personal home before the business shell', async ({
  page,
}, testInfo) => {
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          userId: 1,
          displayName: 'Admin',
          jobTitle: 'Platform administrator',
          email: 'admin@dwp.local',
          tenantId: 1,
          tenantCode: 'default',
          roles: ['ADMIN'],
        },
      }),
    });
  });
  await page.route('**/api/auth/permissions', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data: [] }),
    });
  });

  await page.goto('/');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('dwp.accessToken'))).toBeNull();
  if (testInfo.project.name === 'mobile') {
    await expect(page.getByRole('button', { name: 'Select workspace' })).toHaveCount(0);
  } else {
    await expect(page.getByRole('button', { name: 'Select workspace' })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Search' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Notifications' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account' })).toBeVisible();
  if (testInfo.project.name === 'mobile') {
    await expect(page.getByText('Platform administrator', { exact: true })).toBeHidden();
  } else {
    await expect(page.getByText('Platform administrator', { exact: true })).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'Welcome back, Admin', level: 1 })).toBeVisible();
  await expect(page.getByTestId('personal-home-shell')).toBeVisible();
  await expect(page.getByTestId('desktop-sidebar')).toHaveCount(0);
  await expect(page.getByTestId('mobile-sidebar')).toHaveCount(0);
  await expectNoAutomaticAccessibilityViolations(page);

  await page.getByRole('button', { name: 'Search' }).click();
  const globalSearch = page.getByRole('dialog', { name: 'Search DWP' });
  await expect(globalSearch).toBeVisible();
  const globalSearchInput = globalSearch.getByRole('combobox', { name: 'Search DWP' });
  await expect(globalSearchInput).toBeFocused();
  await globalSearchInput.fill('software access');
  await expect(
    globalSearch.getByRole('option', { name: /Approve software access request/ })
  ).toBeVisible();
  await globalSearchInput.press('ArrowDown');
  await expect(globalSearch.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true');
  await globalSearchInput.press('ArrowUp');
  await expect(globalSearch.getByRole('option').first()).toHaveAttribute('aria-selected', 'true');
  await expectNoAutomaticAccessibilityViolations(page);
  await page.keyboard.press('Escape');
  await expect(globalSearch).toHaveCount(0);
  await page.keyboard.press('Control+K');
  await expect(page.getByRole('dialog', { name: 'Search DWP' })).toBeVisible();
  await page.getByRole('button', { name: 'Close search' }).click();

  await page.getByRole('button', { name: 'Open Work' }).click();
  await expect(page).toHaveURL(/\/work/);
  const businessSidebar =
    testInfo.project.name === 'mobile'
      ? page.getByTestId('mobile-sidebar')
      : page.getByTestId('desktop-sidebar');
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Open navigation' }).click();
  }
  await expect(businessSidebar.getByRole('link', { name: 'Digital Workplace home' })).toBeVisible();
  await businessSidebar.getByRole('link', { name: 'Digital Workplace home' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId('personal-home-shell')).toBeVisible();
  await expect(page.getByTestId('desktop-sidebar')).toHaveCount(0);

  await page.getByRole('button', { name: 'Account' }).click();
  await expect(page.getByRole('menuitem', { name: 'Home' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Profile' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Preferences' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Security & sessions' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Administration' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'dark');
  await expect(page.locator('[role="menuitem"]')).toHaveCount(0);
  await expectNoAutomaticAccessibilityViolations(page);

  await page.getByRole('button', { name: 'Account' }).click();
  await page.getByRole('menuitem', { name: 'Preferences' }).click();
  await expect(page).toHaveURL(/\/account\/settings/);
  await expect(page.locator('[role="menuitem"]')).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Color mode' })).toBeVisible();
  await expect(page.getByRole('switch', { name: 'High contrast' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Interface density' })).toBeVisible();
  await expect(page.getByText('Managed')).toHaveCount(3);
  await expectNoAutomaticAccessibilityViolations(page);

  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Open navigation' }).click();
    const sidebar = page.getByTestId('mobile-sidebar');
    await expect(sidebar.getByRole('link', { name: 'Digital Workplace home' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Today', exact: true })).toHaveCount(0);
    await expect(sidebar.getByRole('link', { name: 'Work', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Ask', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Activity', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Apps', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('link')).toHaveCount(5);
  } else {
    const sidebar = page.getByTestId('desktop-sidebar');
    await expect(sidebar.getByRole('link', { name: 'Digital Workplace home' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Today', exact: true })).toHaveCount(0);
    await expect(sidebar.getByRole('link', { name: 'Work', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Ask', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Activity', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Apps', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('link')).toHaveCount(5);
    const collapseNavigation = page.getByRole('button', { name: 'Collapse navigation' });
    await expect(collapseNavigation).toBeVisible();
    await expect(collapseNavigation).toHaveAttribute('aria-controls', 'desktop-navigation');
    await expect(collapseNavigation).toHaveAttribute('aria-expanded', 'true');
    await collapseNavigation.click();
    await expect(sidebar).toHaveCSS('width', '72px');

    const expandNavigation = page.getByRole('button', { name: 'Expand navigation' });
    await expect(expandNavigation).toHaveAttribute('aria-expanded', 'false');
    const compactGeometry = await page.evaluate(() => {
      const sidebarElement = document.querySelector('[data-testid="desktop-sidebar"]');
      const logo = sidebarElement?.querySelector('a[aria-label="Digital Workplace home"]');
      const logoMark = logo?.querySelector('[aria-hidden="true"]');
      const toggle = document.querySelector('button[aria-label="Expand navigation"]');
      const sidebarRect = sidebarElement?.getBoundingClientRect();
      const logoRect = logoMark?.getBoundingClientRect();
      const toggleRect = toggle?.getBoundingClientRect();
      return {
        logoCenter: logoRect ? logoRect.left + logoRect.width / 2 : null,
        railCenter:
          sidebarRect && sidebarElement ? sidebarRect.left + sidebarElement.clientWidth / 2 : null,
        controlGap: logoRect && toggleRect ? toggleRect.left - logoRect.right : null,
      };
    });
    expect(compactGeometry.logoCenter).toBeCloseTo(compactGeometry.railCenter ?? 0, 0);
    expect(compactGeometry.controlGap).toBeGreaterThanOrEqual(24);

    await expandNavigation.click();
    await expect(sidebar).toHaveCSS('width', '248px');
  }
});

test('compact navigation reflows the desktop workspace canvas', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Desktop inline navigation is not used on mobile.');

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          userId: 1,
          displayName: 'Admin',
          email: 'admin@dwp.local',
          tenantId: 1,
          tenantCode: 'default',
          roles: ['ADMIN'],
        },
      }),
    })
  );
  await page.route('**/api/auth/permissions', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data: [] }),
    })
  );

  await page.goto('/work');
  await expect(page.getByRole('heading', { name: 'Work', level: 1 })).toBeVisible();

  const readGeometry = () =>
    page.evaluate(() => {
      const header = document.querySelector('[data-testid="app-header"]');
      const main = document.querySelector('[data-testid="app-main"]');
      const canvas = document.querySelector('[data-dwp-page-canvas="workspace"]');
      const rectangle = (element: Element | null) => {
        const rect = element?.getBoundingClientRect();
        return rect
          ? {
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              width: Math.round(rect.width),
            }
          : null;
      };
      return { header: rectangle(header), main: rectangle(main), canvas: rectangle(canvas) };
    });

  const expanded = await readGeometry();
  expect(expanded.header).toEqual({ left: 248, right: 1920, width: 1672 });
  expect(expanded.main).toEqual({ left: 248, right: 1920, width: 1672 });
  expect(expanded.canvas).toEqual({ left: 248, right: 1920, width: 1672 });

  await page.getByRole('button', { name: 'Collapse navigation' }).click();
  await expect(page.getByTestId('desktop-sidebar')).toHaveCSS('width', '72px');
  await expect(page.locator('[data-dwp-navigation-state="compact"]')).toBeVisible();
  await expect.poll(async () => (await readGeometry()).canvas?.width).toBe(1848);

  const compact = await readGeometry();
  expect(compact.header).toEqual({ left: 72, right: 1920, width: 1848 });
  expect(compact.main).toEqual({ left: 72, right: 1920, width: 1848 });
  expect(compact.canvas).toEqual({ left: 72, right: 1920, width: 1848 });
  expect((compact.canvas?.width ?? 0) - (expanded.canvas?.width ?? 0)).toBe(176);
});

test('personal home launcher can create, rename, persist, and reset folders', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile',
    'Desktop pointer and menu behavior is covered here.'
  );

  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          userId: 1,
          displayName: 'Admin',
          email: 'admin@dwp.local',
          tenantId: 1,
          tenantCode: 'default',
          roles: ['ADMIN'],
        },
      }),
    })
  );
  await page.route('**/api/auth/permissions', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data: [] }),
    })
  );

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Open Work' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Administration' })).toBeVisible();
  await page.getByRole('button', { name: 'Customize' }).click();
  await page.getByRole('button', { name: 'Arrange Work' }).click();
  await page.getByRole('menuitem', { name: 'Create folder', exact: true }).click();
  await page.getByRole('menuitem', { name: 'With Ask DWP' }).click();
  await page.getByRole('menuitem', { name: 'Create selected folder' }).click();

  await page.getByRole('button', { name: 'Open folder Start work folder' }).click();
  const folderDialog = page.getByRole('dialog', { name: 'Start work folder' });
  await expect(folderDialog.getByRole('button', { name: 'Open Work' })).toBeVisible();
  await expect(folderDialog.getByRole('button', { name: 'Open Ask DWP' })).toBeVisible();
  await folderDialog.getByRole('button', { name: 'Rename Start work folder' }).click();
  const renameDialog = page.getByRole('dialog', { name: 'Rename folder' });
  await renameDialog.getByRole('textbox', { name: 'Folder name' }).fill('Priority tools');
  await renameDialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('button', { name: 'Open folder Priority tools' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Open folder Priority tools' })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => Boolean(localStorage.getItem('dwp.home.launchpad.v1:1:1'))))
    .toBe(true);

  await page.getByRole('button', { name: 'Customize' }).click();
  await page.getByRole('button', { name: 'Reset app layout' }).click();
  await expect(page.getByRole('button', { name: 'Open folder Priority tools' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Open Work' }).focus();
  await page.keyboard.press('Space');
  await page.waitForTimeout(100);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(100);
  await page.keyboard.press('Space');
  await expect
    .poll(() =>
      page
        .getByRole('list', { name: 'Start work apps' })
        .locator('[data-launchpad-item]')
        .evaluateAll((items) => items.map((item) => item.getAttribute('data-launchpad-item')))
    )
    .toEqual(['dwp-ask', 'dwp-work', 'dwp-activity']);
  await page.getByRole('button', { name: 'Reset app layout' }).click();
  await expect
    .poll(() =>
      page
        .getByRole('list', { name: 'Start work apps' })
        .locator('[data-launchpad-item]')
        .evaluateAll((items) => items.map((item) => item.getAttribute('data-launchpad-item')))
    )
    .toEqual(['dwp-work', 'dwp-ask', 'dwp-activity']);

  const workBounds = await page.getByRole('button', { name: 'Open Work' }).boundingBox();
  const askTargetBounds = await page.locator('[data-folder-target="dwp-ask"]').boundingBox();
  expect(workBounds).not.toBeNull();
  expect(askTargetBounds).not.toBeNull();
  await page.mouse.move(
    (workBounds?.x ?? 0) + (workBounds?.width ?? 0) / 2,
    (workBounds?.y ?? 0) + (workBounds?.height ?? 0) / 2
  );
  await page.mouse.down();
  await page.mouse.move((workBounds?.x ?? 0) + 12, (workBounds?.y ?? 0) + 12, { steps: 4 });
  await page.waitForTimeout(100);
  await page.mouse.move(
    (askTargetBounds?.x ?? 0) + (askTargetBounds?.width ?? 0) / 2,
    (askTargetBounds?.y ?? 0) + (askTargetBounds?.height ?? 0) / 2,
    { steps: 12 }
  );
  await page.waitForTimeout(100);
  await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Open folder Start work folder' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Work was placed with Ask DWP');
  await page.waitForTimeout(100);
  await page.getByRole('button', { name: 'Open folder Start work folder' }).click();
  await page
    .getByRole('dialog', { name: 'Start work folder' })
    .getByRole('button', { name: 'Open Work' })
    .click();
  await expect(page).toHaveURL(/\/work/);
});

test('personal home widgets persist user choices and restore governed defaults', async ({
  page,
}) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          userId: 1,
          displayName: 'Admin',
          email: 'admin@dwp.local',
          tenantId: 1,
          tenantCode: 'default',
          roles: ['ADMIN'],
        },
      }),
    })
  );
  await page.route('**/api/auth/permissions', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data: [] }),
    })
  );

  await page.goto('/');
  await page.getByRole('button', { name: 'Edit home' }).click();
  await expect(page.getByRole('img', { name: 'Governed content' })).toBeVisible();
  await page.getByRole('switch', { name: 'Show Live activity' }).uncheck();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Live activity' })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Live activity' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit home' }).click();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Live activity' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Announcements' })).toBeVisible();
});

test('personal home launcher only exposes explicitly entitled apps when app permissions exist', async ({
  page,
}) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          userId: 7,
          displayName: 'Min Kim',
          email: 'min@dwp.local',
          tenantId: 2,
          tenantCode: 'pilot',
          roles: ['ADMIN'],
        },
      }),
    })
  );
  await page.route('**/api/auth/permissions', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: [
          {
            resourceType: 'APP',
            resourceKey: 'APP.WORK',
            permissionCode: 'VIEW',
            effect: 'ALLOW',
          },
        ],
      }),
    })
  );

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Open Work' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Ask DWP' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open Administration' })).toHaveCount(0);
  await expect(page.getByText('1 assigned')).toBeVisible();
  await expectNoAutomaticAccessibilityViolations(page);

  await page.getByRole('button', { name: 'Account' }).click();
  await expect(page.getByRole('menuitem', { name: 'Administration' })).toHaveCount(0);
  await page.keyboard.press('Escape');

  await page.goto('/apps');
  await expect(page.getByRole('heading', { name: 'Apps', exact: true })).toBeVisible();
  await expect(page.getByText('No matching apps')).toBeVisible();

  await page.goto('/ask');
  await expect(page).toHaveURL(/\/403/);
  await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();

  await page.goto('/admin');
  await expect(page).toHaveURL(/\/403/);
});

test('reference work hub connects Home, Work, Ask, Activity, and Apps', async ({
  page,
}, testInfo) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          userId: 1,
          displayName: 'Admin User',
          email: 'admin@dwp.local',
          tenantId: 1,
          tenantCode: 'default',
          roles: ['ADMIN'],
        },
      }),
    })
  );
  await page.route('**/api/auth/permissions', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data: [] }),
    })
  );
  await mockAgentPlanContract(page);

  const navigateTo = async (label: 'Work' | 'Ask' | 'Activity' | 'Apps') => {
    if (testInfo.project.name === 'mobile') {
      await page.getByRole('button', { name: 'Open navigation' }).click();
      await page
        .getByTestId('mobile-sidebar')
        .getByRole('link', { name: label, exact: true })
        .click();
      return;
    }
    await page
      .getByTestId('desktop-sidebar')
      .getByRole('link', { name: label, exact: true })
      .click();
  };

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome back, Admin' })).toBeVisible();
  await page.getByRole('button', { name: /Approve software access request/ }).click();
  await expect(page).toHaveURL(/\/work\?item=WK-1042/);
  await expect(page.getByRole('heading', { name: 'Work', exact: true })).toBeVisible();
  await expect(page.getByRole('grid', { name: 'Work queue' })).toBeVisible();
  await expect(page.getByText('WK-1042 / Approval / Owner: You')).toBeVisible();

  await navigateTo('Ask');
  await expect(page.getByRole('heading', { name: 'Ask DWP' })).toBeVisible();
  await page.getByRole('button', { name: 'Can I work remotely next Friday?' }).click();
  await expect(page.getByRole('heading', { name: 'Answer' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Answer sources' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Flexible work request preview' })).toBeVisible();
  await expect(page.getByText('AUD-REF-1042')).toBeVisible();

  await navigateTo('Activity');
  await expect(page.getByRole('heading', { name: 'Activity', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Agents' }).click();
  await expect(
    page.getByRole('list', { name: 'Workspace activity' }).getByRole('listitem')
  ).toHaveCount(2);
  await page.getByRole('button', { name: /Restricted payroll query stopped by policy/ }).click();
  await expect(page.getByText('AUD-20260808-2051')).toBeVisible();

  await navigateTo('Apps');
  await expect(page.getByRole('heading', { name: 'Apps', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Search apps' }).fill('legacy');
  await expect(page.getByText('1 apps')).toBeVisible();
  await page.getByRole('button', { name: /Legacy operations/ }).click();
  await expect(page.getByRole('alert')).toContainText('Legacy operations launch preview opened.');
  await expect(page.locator('.MuiAlert-root')).toHaveCSS('opacity', '1');
  await expectNoAutomaticAccessibilityViolations(page);
});

test('users can review and revoke another browser session', async ({ page }) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          userId: 1,
          displayName: 'Admin',
          email: 'admin@dwp.local',
          tenantId: 1,
          tenantCode: 'default',
          roles: ['ADMIN'],
        },
      }),
    })
  );
  await page.route('**/api/auth/permissions', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data: [] }),
    })
  );
  await page.route('**/api/auth/csrf', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: { token: 'csrf-token', headerName: 'X-XSRF-TOKEN' },
      }),
    })
  );

  let sessions = [
    {
      sessionId: '11111111-1111-4111-8111-111111111111',
      current: true,
      ipAddress: '10.20.30.40',
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36',
      startedAt: '2026-08-08T00:00:00Z',
      lastSeenAt: '2026-08-08T00:10:00Z',
      idleExpiresAt: '2026-08-08T00:40:00Z',
      expiresAt: '2026-08-08T08:00:00Z',
    },
    {
      sessionId: '22222222-2222-4222-8222-222222222222',
      current: false,
      ipAddress: '203.0.113.24',
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36 Edg/126.0',
      startedAt: '2026-08-07T23:00:00Z',
      lastSeenAt: '2026-08-08T00:05:00Z',
      idleExpiresAt: '2026-08-08T00:35:00Z',
      expiresAt: '2026-08-08T07:00:00Z',
    },
  ];

  await page.route('**/api/auth/sessions/**', async (route) => {
    const sessionId = route.request().url().split('/').pop();
    sessions = sessions.filter((session) => session.sessionId !== sessionId);
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data: null }),
    });
  });
  await page.route('**/api/auth/sessions', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data: sessions }),
    });
  });

  await page.goto('/account/security');
  await expect(page.getByRole('heading', { name: 'Security & sessions' })).toBeVisible();
  const sessionList = page.getByRole('list', { name: 'Active browser sessions' });
  await expect(sessionList.getByRole('listitem')).toHaveCount(2);
  await expect(page.getByText('Chrome on macOS')).toBeVisible();
  const otherSession = sessionList
    .getByRole('listitem')
    .filter({ hasText: 'Microsoft Edge on Windows' });
  await otherSession.getByRole('button', { name: 'End session' }).click();

  const dialog = page.getByRole('dialog', { name: 'End this session?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Sign out' }).click();
  await expect(sessionList.getByRole('listitem')).toHaveCount(1);
  await expect(page.getByText('Microsoft Edge on Windows')).toHaveCount(0);
  await expectNoAutomaticAccessibilityViolations(page);
});
