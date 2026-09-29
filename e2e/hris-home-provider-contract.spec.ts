import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { HR_HOME_FIXTURE } from './support/product-area-fixtures';
import { fulfillSuccess, mockShellSession } from './support/shell-session';

const EMPLOYEE_SELF_GRANTS = [
  {
    resourceType: 'APP',
    resourceKey: 'APP.HCM',
    permissionCode: 'VIEW',
    effect: 'ALLOW' as const,
  },
  ...['DATA.WORKFORCE', 'DATA.HR_TIME', 'DATA.HR_ABSENCE', 'DATA.HR_PAY', 'DATA.HR_TALENT'].map(
    (resourceKey) => ({
      resourceType: 'DATA',
      resourceKey,
      permissionCode: 'VIEW',
      effect: 'ALLOW' as const,
    })
  ),
];

async function expectNoDocumentOverflow(page: Page) {
  const geometry = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(geometry.content).toBeLessThanOrEqual(geometry.viewport + 1);
}

function currentSeoulDateKey(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((result, part) => {
      result[part.type] = part.value;
      return result;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

test('minimum employee SELF grants compose the governed HRIS home', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    displayName: 'HRIS Employee',
    jobTitle: 'Product designer',
    permissions: EMPLOYEE_SELF_GRANTS,
  });
  await page.route('**/api/people/v1/hr/home', (route) =>
    fulfillSuccess(route, {
      ...HR_HOME_FIXTURE,
      asOf: currentSeoulDateKey(),
      generatedAt: new Date().toISOString(),
    })
  );

  await page.goto('/hr/home');

  const home = page.getByTestId('hcm-home-overview');
  await expect(home).toBeVisible();
  await expect(home).toHaveAttribute('data-hris-home-provider-registry', 'v1');
  await expect(home).toHaveAttribute(
    'data-hris-home-data-authority',
    'LEGACY_AGGREGATE_COMPATIBILITY'
  );
  await expect(home).toHaveAttribute(
    'data-hris-home-provider-states',
    /tim-self-time:AVAILABLE:FRESH:VIEW:LEGACY_AGGREGATE_COMPATIBILITY/u
  );
  await expect(page.locator('[data-hris-home-provider="hrm-self-employment"]')).toHaveAttribute(
    'data-hris-home-provider-state',
    'AVAILABLE'
  );
  await expect(page.getByRole('heading', { name: 'HR work that needs attention' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'HR tools' })).toBeVisible();
  await expect(page.getByText('A benefits enrollment window is open')).toHaveCount(0);
  await expect(page.locator('[data-workspace-widget]').first()).toHaveCSS('animation-name', 'none');
  const sidebar = page.getByTestId('hcm-sidebar');
  await expect(sidebar.getByTestId('hcm-navigation-item-shell-home')).toHaveText('HRIS home');
  await expect(sidebar.getByTestId('hcm-navigation-item-workbench-my-hr')).toHaveText('My HR');
  await expect(sidebar.getByTestId('hcm-navigation-item-workbench-hr-operations')).toHaveCount(0);
  await expect(sidebar.getByTestId('hcm-navigation-item-workbench-time')).toHaveCount(0);
  await expect(sidebar.getByTestId('hcm-navigation-item-workbench-payroll')).toHaveCount(0);
  await expect(sidebar.getByTestId('hcm-navigation-item-workbench-performance')).toHaveCount(0);
  await expect(sidebar.getByText('Benefits operations')).toHaveCount(0);
  await expectNoDocumentOverflow(page);
  const accessibility = await new AxeBuilder({ page }).include('[data-dwp-page-canvas]').analyze();
  expect(accessibility.violations).toEqual([]);
});

test('wheel input over an HRIS widget continues the document scroll', async ({
  page,
}, testInfo) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    displayName: 'HRIS Employee',
    jobTitle: 'Product designer',
    permissions: EMPLOYEE_SELF_GRANTS,
  });
  await page.route('**/api/people/v1/hr/home', (route) =>
    fulfillSuccess(route, {
      ...HR_HOME_FIXTURE,
      asOf: currentSeoulDateKey(),
      generatedAt: new Date().toISOString(),
    })
  );

  await page.goto('/hr/home');
  const widgetContent = page.locator('[data-workspace-widget-content]').first();
  await expect(widgetContent).toBeVisible();
  await widgetContent.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => window.scrollY);
  if (testInfo.project.name === 'mobile') {
    await page.evaluate(() => window.scrollBy(0, 480));
  } else {
    await widgetContent.hover();
    await page.mouse.wheel(0, 480);
  }

  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
  expect(
    await widgetContent.evaluate((element) => ({
      overflowY: window.getComputedStyle(element).overflowY,
      scrollTop: element.scrollTop,
    }))
  ).toEqual({ overflowY: 'visible', scrollTop: 0 });
});

test('View HR flow keeps the focused rhythm landmark clear of the fixed shell', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    displayName: 'HRIS Employee',
    jobTitle: 'Product designer',
    permissions: EMPLOYEE_SELF_GRANTS,
  });
  await page.route('**/api/people/v1/hr/home', (route) =>
    fulfillSuccess(route, {
      ...HR_HOME_FIXTURE,
      asOf: currentSeoulDateKey(),
      generatedAt: new Date().toISOString(),
    })
  );

  await page.goto('/hr/home');

  const rhythm = page.locator('#hcm-rhythm');
  await expect(rhythm).toBeVisible();
  await page.getByRole('button', { name: 'View HR flow' }).click();

  await expect
    .poll(() => rhythm.evaluate((element) => document.activeElement === element))
    .toBe(true);
  const geometry = await rhythm.evaluate((element) => {
    const header = document.querySelector<HTMLElement>('[data-testid="hcm-header"]');
    const target = element.getBoundingClientRect();
    const headerBottom = header?.getBoundingClientRect().bottom ?? 0;
    return {
      clearOfHeader: target.top - headerBottom,
      scrollMarginBlockStart: parseFloat(getComputedStyle(element).scrollMarginBlockStart) || 0,
    };
  });

  // Mobile reserves a context-rail-sized allowance even when the home projection
  // currently has no rail. This keeps the anchor safe if that contextual rail is
  // enabled for the product surface.
  const minimumReservedOffset = testInfo.project.name === 'mobile' ? 124 : 80;
  expect(geometry.scrollMarginBlockStart).toBeGreaterThanOrEqual(minimumReservedOffset);
  expect(geometry.clearOfHeader).toBeGreaterThanOrEqual(8);
});

test('one missing entitlement and one unavailable source degrade independently', async ({
  page,
}) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    displayName: 'HRIS Employee',
    jobTitle: 'Product designer',
    permissions: EMPLOYEE_SELF_GRANTS.filter(
      (permission) => permission.resourceKey !== 'DATA.HR_ABSENCE'
    ),
  });
  await page.route('**/api/people/v1/hr/home', (route) =>
    fulfillSuccess(route, {
      ...HR_HOME_FIXTURE,
      asOf: currentSeoulDateKey(),
      generatedAt: new Date().toISOString(),
      time: null,
      domainStates: {
        ...HR_HOME_FIXTURE.domainStates,
        TIME: {
          availability: 'UNAVAILABLE',
          dataOrigin: 'NONE',
          reasonCode: 'TIME_SOURCE_DOWN',
        },
      },
    })
  );

  await page.goto('/hr/home');

  const home = page.getByTestId('hcm-home-overview');
  await expect(home).toBeVisible();
  await expect(home).toHaveAttribute('data-hris-home-provider-degraded', 'true');
  await expect(home).toHaveAttribute(
    'data-hris-home-provider-states',
    /tim-self-time:UNAVAILABLE:FRESH:VIEW:LEGACY_AGGREGATE_COMPATIBILITY/u
  );
  await expect(home).toHaveAttribute(
    'data-hris-home-provider-states',
    /tim-self-absence:CONFIGURATION_REQUIRED:UNKNOWN:VIEW:LEGACY_AGGREGATE_COMPATIBILITY/u
  );
  await expect(page.getByText('Some HR work is temporarily unavailable').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Request time off' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Pay statements' })).toBeVisible();
  await expectNoDocumentOverflow(page);
});

test('legacy source failure degrades its widgets without replacing the HRIS shell', async ({
  page,
}) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    displayName: 'HRIS Employee',
    jobTitle: 'Product designer',
    permissions: EMPLOYEE_SELF_GRANTS,
  });
  await page.route('**/api/people/v1/hr/home', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ERROR', message: 'source unavailable' }),
    })
  );

  await page.goto('/hr/home');

  const home = page.getByTestId('hcm-home-overview');
  await expect(home).toBeVisible();
  await expect(home).toHaveAttribute('data-hris-home-provider-degraded', 'true');
  await expect(home).toHaveAttribute(
    'data-hris-home-provider-states',
    /tim-self-time:UNAVAILABLE:UNKNOWN:VIEW:LEGACY_AGGREGATE_COMPATIBILITY/u
  );
  await expect(page.getByRole('heading', { name: 'HR work that needs attention' })).toBeVisible();
  await expect(page.getByText('Some HR work is temporarily unavailable').first()).toBeVisible();
  await expectNoDocumentOverflow(page);
});

test('forbidden projections neither render aggregate values nor fan out to the organization chart', async ({
  page,
}) => {
  const organizationRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/org-chart')) organizationRequests.push(request.url());
  });
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'MANAGER'], {
    locale: 'en',
    displayName: 'Safe auth identity',
    jobTitle: 'Manager',
    permissions: EMPLOYEE_SELF_GRANTS.filter((permission) => permission.resourceType === 'APP'),
  });
  await page.route('**/api/people/v1/hr/home', (route) =>
    fulfillSuccess(route, {
      ...HR_HOME_FIXTURE,
      asOf: currentSeoulDateKey(),
      generatedAt: new Date().toISOString(),
      employee: {
        ...HR_HOME_FIXTURE.employee,
        displayName: 'DO_NOT_RENDER_EMPLOYEE',
        managerDisplayName: 'DO_NOT_RENDER_MANAGER',
        directReportCount: 999,
      },
      leaveBalances: HR_HOME_FIXTURE.leaveBalances.map((balance) => ({
        ...balance,
        planName: 'DO_NOT_RENDER_LEAVE',
        availableMinutes: 999_999,
      })),
      pay: HR_HOME_FIXTURE.pay ? { ...HR_HOME_FIXTURE.pay, name: 'DO_NOT_RENDER_PAY' } : null,
      journeys: HR_HOME_FIXTURE.journeys.map((journey) => ({
        ...journey,
        name: 'DO_NOT_RENDER_JOURNEY',
        progressPercent: 99,
      })),
    })
  );

  await page.goto('/hr/home');

  const home = page.getByTestId('hcm-home-overview');
  await expect(home).toHaveAttribute(
    'data-hris-home-provider-states',
    /hrm-self-employment:CONFIGURATION_REQUIRED/u
  );
  await expect(page.getByRole('heading', { name: /Safe/u }).first()).toBeVisible();
  await expect(page.getByText(/DO_NOT_RENDER/u)).toHaveCount(0);
  await page.getByRole('button', { name: 'My team', exact: true }).click();
  await expect(page.getByText(/DO_NOT_RENDER/u)).toHaveCount(0);
  expect(organizationRequests).toEqual([]);
});

for (const viewport of [
  { name: 'compact-320', width: 320, height: 720 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'desktop-1280', width: 1280, height: 900 },
  { name: 'wide-1440', width: 1440, height: 1000 },
] as const) {
  test(`long tenant and employee labels remain usable at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockShellSession(page, ['WORKSPACE_MEMBER'], {
      locale: 'en',
      displayName:
        'Alexandra International Workforce Experience and Organizational Development Specialist',
      jobTitle:
        'Global People Operations, Organizational Capability and Employee Experience Partner',
      permissions: EMPLOYEE_SELF_GRANTS,
    });
    await page.route('**/api/people/v1/hr/home', (route) =>
      fulfillSuccess(route, {
        ...HR_HOME_FIXTURE,
        asOf: currentSeoulDateKey(),
        generatedAt: new Date().toISOString(),
        employee: {
          ...HR_HOME_FIXTURE.employee,
          displayName:
            'Alexandra International Workforce Experience and Organizational Development Specialist',
          businessTitle:
            'Global People Operations, Organizational Capability and Employee Experience Partner',
          organizationName:
            'International Workforce Strategy, Culture and Employee Experience Center of Excellence',
        },
      })
    );

    await page.goto('/hr/home');

    await expect(page.getByTestId('hcm-home-overview')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'HR work that needs attention' })).toBeVisible();
    await expectNoDocumentOverflow(page);
  });
}

test('200 percent zoom, forced colors and keyboard activation preserve home customization', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    displayName: 'Keyboard HRIS Employee',
    jobTitle: 'Global employee experience partner',
    permissions: EMPLOYEE_SELF_GRANTS,
  });
  await page.route('**/api/people/v1/hr/home', (route) =>
    fulfillSuccess(route, {
      ...HR_HOME_FIXTURE,
      asOf: currentSeoulDateKey(),
      generatedAt: new Date().toISOString(),
    })
  );

  await page.goto('/hr/home');
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });

  const customize = page.getByRole('button', { name: 'Customize HRIS home widgets' });
  await customize.focus();
  await expect(customize).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('navigation', { name: 'Home composition tools' })).toBeVisible();
  await expectNoDocumentOverflow(page);
  const accessibility = await new AxeBuilder({ page }).include('[data-dwp-page-canvas]').analyze();
  expect(accessibility.violations).toEqual([]);
});
