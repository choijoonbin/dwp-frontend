import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

import { HR_HOME_FIXTURE } from './support/product-area-fixtures';
import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';

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

const TIME_ADMIN_GRANTS = [
  {
    resourceType: 'APP',
    resourceKey: 'APP.HCM',
    permissionCode: 'VIEW',
    effect: 'ALLOW' as const,
  },
  {
    resourceType: 'DATA',
    resourceKey: 'DATA.HR_TIME',
    permissionCode: 'VIEW_TENANT',
    effect: 'ALLOW' as const,
  },
];

const TENANT_ADMIN_WITHOUT_HR_OPERATIONS_GRANTS = [
  ...EMPLOYEE_SELF_GRANTS,
  {
    resourceType: 'ADMIN',
    resourceKey: 'ADMIN.APP_GOVERNANCE',
    permissionCode: 'VIEW',
    effect: 'ALLOW' as const,
  },
];

const HRIS_SHELL_WORKBENCHES = {
  'shell-home': 'HRIS home',
  'workbench-my-hr': 'My HR',
  'workbench-team': 'Team',
  'workbench-hr-operations': 'People operations',
  'workbench-time': 'Time',
  'workbench-payroll': 'Payroll',
  'workbench-performance': 'Performance',
  'workbench-settings': 'Settings',
} as const;

const LEGACY_HCM_LEAF_NAVIGATION_VIEWS = [
  'home',
  'me',
  'time',
  'absence',
  'benefits',
  'pay',
  'talent',
  'services',
  'directory',
  'organization',
  'team',
  'team-time',
  'team-absence',
  'operations',
  'people',
  'assignments',
  'time-operations',
  'absence-operations',
  'benefits-operations',
  'pay-operations',
  'talent-operations',
  'organization-design',
  'reference-data',
  'data-operations',
  'exports',
] as const;

type HrisShellWorkbench = keyof typeof HRIS_SHELL_WORKBENCHES;

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

async function mockCurrentHrisHome(page: Page, overrides: Partial<typeof HR_HOME_FIXTURE> = {}) {
  await page.route('**/api/people/v1/hr/home', (route) =>
    fulfillSuccess(route, {
      ...HR_HOME_FIXTURE,
      asOf: currentSeoulDateKey(),
      generatedAt: new Date().toISOString(),
      ...overrides,
    })
  );
}

async function expectNoHorizontalOverflow(page: Page) {
  const geometry = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    contentWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.contentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
}

async function openMobileHcmNavigation(page: Page) {
  if ((page.viewportSize()?.width ?? 1280) >= 1200) return;
  const openButton = page.getByRole('button', { name: 'Open HRIS navigation' });
  await expect(openButton).toBeVisible();
  await openButton.click();
}

async function hcmNavigation(page: Page) {
  await openMobileHcmNavigation(page);
  const navigation = page.getByTestId(
    (page.viewportSize()?.width ?? 1280) < 1200 ? 'hcm-mobile-sidebar' : 'hcm-sidebar'
  );
  await expect(navigation).toBeVisible();
  return navigation;
}

async function dismissMobileHcmNavigation(page: Page) {
  if ((page.viewportSize()?.width ?? 1280) >= 1200) return;
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('hcm-mobile-sidebar')).not.toBeVisible();
}

async function expectCanonicalHrisNavigation(
  page: Page,
  visibleWorkbenches: readonly HrisShellWorkbench[]
): Promise<Locator> {
  const navigation = await hcmNavigation(page);
  for (const workbench of visibleWorkbenches) {
    const item = navigation.getByTestId(`hcm-navigation-item-${workbench}`);
    await expect(item).toBeVisible();
    await expect(item).toHaveText(HRIS_SHELL_WORKBENCHES[workbench]);
  }
  for (const workbench of Object.keys(HRIS_SHELL_WORKBENCHES) as HrisShellWorkbench[]) {
    if (!visibleWorkbenches.includes(workbench)) {
      await expect(navigation.getByTestId(`hcm-navigation-item-${workbench}`)).toHaveCount(0);
    }
  }
  for (const view of LEGACY_HCM_LEAF_NAVIGATION_VIEWS) {
    await expect(navigation.getByTestId(`hcm-navigation-item-${view}`)).toHaveCount(0);
  }
  await expect(page.getByTestId('hcm-desktop-surface-switcher')).toHaveCount(0);
  await expect(page.getByTestId('hcm-mobile-drawer-surface-switcher')).toHaveCount(0);
  await expect(page.getByTestId('hcm-mobile-surface-switcher')).toHaveCount(0);
  return navigation;
}

test('employees enter one HR home without manager or operator navigation', async ({ page }) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    displayName: 'Mina Kim',
    jobTitle: 'Product designer',
    permissions: EMPLOYEE_SELF_GRANTS,
  });
  await mockCurrentHrisHome(page);

  await page.goto('/hr/home');

  const home = page.getByTestId('hcm-home-overview');
  await expect(home).toBeVisible();
  await expectCanonicalHrisNavigation(page, ['shell-home', 'workbench-my-hr']);
  await dismissMobileHcmNavigation(page);
  await expect(page.getByRole('heading', { name: 'HR work that needs attention' })).toBeVisible();
  await expect(page.locator('[data-workspace-widget="people-signals"]')).toBeVisible();
  await expect(page.locator('[data-workspace-widget="quick-actions"]')).toBeVisible();
  await expect(page.locator('[data-workspace-widget="team"]')).toHaveCount(0);
  await expect(page.getByText('A benefits enrollment window is open')).toHaveCount(0);
  await page.getByRole('button', { name: 'View HR flow' }).click();
  await expect(page.getByRole('heading', { name: 'My HR flow' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'HR tools' })).toBeVisible();

  await expectNoHorizontalOverflow(page);
  const accessibility = await new AxeBuilder({ page }).include('[data-dwp-page-canvas]').analyze();
  expect(accessibility.violations).toEqual([]);

  await page.goto('/hr/operations');
  await expect(page).toHaveURL(/403$/u);
  await expect(page.getByRole('heading', { name: 'Access denied', exact: true })).toBeVisible();
});

test('people managers receive team navigation from the reporting relationship', async ({
  page,
}) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'MANAGER'], {
    displayName: 'Mina Kim',
    jobTitle: 'Product design lead',
    permissions: EMPLOYEE_SELF_GRANTS,
  });
  await mockCurrentHrisHome(page);

  await page.goto('/hr/home');

  await page.getByRole('button', { name: 'My team', exact: true }).click();
  await expect(page.getByRole('heading', { name: "My team's decision flow" })).toBeVisible();
  await expect(page.getByTestId('hcm-home-overview')).toHaveAttribute(
    'data-hris-home-provider-states',
    /hrm-team-shape:UNAVAILABLE/u
  );
  await expect(page.getByText('Team time decisions are waiting')).toHaveCount(0);
  await expect(page.getByText('Team leave decisions are waiting')).toHaveCount(0);
  await expect(page.locator('[data-workspace-widget="team"]')).toBeVisible();
  await expect(page.locator('[data-workspace-widget="profile"]')).toHaveCount(0);

  const personalNavigation = await expectCanonicalHrisNavigation(page, [
    'shell-home',
    'workbench-my-hr',
    'workbench-team',
  ]);

  await personalNavigation.getByTestId('hcm-navigation-item-workbench-team').click();
  await expect(page).toHaveURL(/\/hr\/team$/u);
  await expectCanonicalHrisNavigation(page, ['shell-home', 'workbench-my-hr', 'workbench-team']);
  await dismissMobileHcmNavigation(page);
  await expect(page.getByRole('heading', { name: 'My team', exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('employees can compose and persist their personal HR home', async ({ page }) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    displayName: 'Mina Kim',
    jobTitle: 'Product designer',
    permissions: EMPLOYEE_SELF_GRANTS,
  });
  await mockCurrentHrisHome(page);

  await page.goto('/hr/home');
  await page.getByRole('button', { name: 'Customize HRIS home widgets' }).click();

  const profileWidget = page.locator('[data-workspace-widget="profile"]');
  await expect(profileWidget).toBeVisible();
  await profileWidget.getByRole('button', { name: 'Hide My profile widget' }).click();
  await page.getByRole('button', { name: 'Expressive' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByRole('button', { name: 'Customize HRIS home widgets' })).toBeVisible();
  await expect(profileWidget).toHaveCount(0);
  await page.reload();
  await expect(page.locator('[data-workspace-presentation="expressive"]')).toBeVisible();
  await expect(page.locator('[data-workspace-widget="profile"]')).toHaveCount(0);

  await page.getByRole('button', { name: 'Customize HRIS home widgets' }).click();
  await page.getByRole('button', { name: 'Add widget' }).click();
  await expect(page.getByRole('dialog', { name: 'Add widgets' })).toBeVisible();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('[data-workspace-widget="profile"]')).toBeVisible();
});

test('available HR actions remain usable when one home domain is unavailable', async ({ page }) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    displayName: 'Mina Kim',
    jobTitle: 'Product designer',
    permissions: EMPLOYEE_SELF_GRANTS,
  });
  await mockCurrentHrisHome(page, {
    time: null,
    domainStates: {
      ...HR_HOME_FIXTURE.domainStates,
      TIME: {
        availability: 'UNAVAILABLE',
        dataOrigin: 'UNKNOWN',
        reasonCode: 'TIME_QUERY_FAILED',
      },
    },
  });

  await page.goto('/hr/home');

  const home = page.getByTestId('hcm-home-overview');
  await expect(home).toHaveAttribute('data-hris-home-provider-degraded', 'true');
  await expect(home).toHaveAttribute(
    'data-hris-home-provider-states',
    /tim-self-time:UNAVAILABLE/u
  );
  await expect(page.getByText('A benefits enrollment window is open')).toHaveCount(0);
  await expect(page.getByText('Some HR work is temporarily unavailable')).toBeVisible();
  await page.getByRole('button', { name: 'View HR flow' }).click();
  await expect(page.getByText('No work schedule is connected.')).toBeVisible();
  await expect(page.getByText('Unavailable').first()).toBeVisible();
});

test('HR operators receive only their authorized canonical HRIS workbenches', async ({ page }) => {
  await mockShellSession(page, ['HR_ADMIN'], {
    displayName: 'Alex Park',
    jobTitle: 'HR operations lead',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });

  await page.goto('/hr/operations');

  await expect(page.getByRole('heading', { name: 'Workforce operations', level: 1 })).toBeVisible();
  await expect(page.locator('[data-workspace-widget="profile"]')).toHaveCount(0);
  await expect(page.locator('[data-workspace-widget="team"]')).toHaveCount(0);
  await expectCanonicalHrisNavigation(page, [
    'shell-home',
    'workbench-my-hr',
    'workbench-hr-operations',
    'workbench-time',
    'workbench-payroll',
    'workbench-performance',
    'workbench-settings',
  ]);
  await dismissMobileHcmNavigation(page);

  await page.goto('/hr/design/organization');
  await expectCanonicalHrisNavigation(page, [
    'shell-home',
    'workbench-my-hr',
    'workbench-hr-operations',
    'workbench-time',
    'workbench-payroll',
    'workbench-performance',
    'workbench-settings',
  ]);
  await dismissMobileHcmNavigation(page);
  await expectNoHorizontalOverflow(page);
});

test('HR operators without a linked worker use the operations Surface without personal data leakage', async ({
  page,
}) => {
  await mockShellSession(page, ['HR_ADMIN'], {
    displayName: 'Provider HR Operator',
    jobTitle: 'HR data operations lead',
    personPublicId: null,
    permissions: FULL_PRODUCT_PERMISSIONS,
  });

  await page.goto('/hr/operations');

  await expect(page.getByRole('heading', { name: 'Workforce operations', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Me', exact: true })).toHaveCount(0);
  await expect(page.locator('[data-workspace-widget="profile"]')).toHaveCount(0);
  await expect(page.getByTestId('hcm-shell')).toHaveAttribute('data-product-plane', 'management');
  await expectNoHorizontalOverflow(page);
});

test('single-domain administrators receive only their authorized HRIS workbenches', async ({
  page,
}) => {
  await mockShellSession(page, ['ADMIN'], {
    displayName: 'Time Administrator',
    jobTitle: 'Time operations lead',
    permissions: TIME_ADMIN_GRANTS,
  });
  await page.route('**/api/people/v1/workforce/operations/overview', (route) =>
    fulfillSuccess(route, {
      generatedAt: '2026-08-12T09:30:00Z',
      dataBoundary: 'TENANT',
      fieldGroups: ['DIRECTORY', 'EMPLOYMENT'],
      domains: [
        {
          domain: 'TIME',
          pendingCount: 7,
          metrics: [
            { key: 'submitted', value: 18, severity: 'INFO' },
            { key: 'openExceptions', value: 3, severity: 'ATTENTION' },
          ],
        },
      ],
    })
  );

  await page.goto('/hr/operations');

  await expect(page).toHaveURL(/\/hr\/operations$/u);
  await expect(page.getByRole('heading', { name: 'Workforce operations', level: 1 })).toBeVisible();
  await expectCanonicalHrisNavigation(page, [
    'shell-home',
    'workbench-my-hr',
    'workbench-hr-operations',
    'workbench-time',
  ]);
  await dismissMobileHcmNavigation(page);
  await expect(page.getByText('Time operations summary')).toBeVisible();
  await expect(page.getByText('Absence operations summary')).toHaveCount(0);

  await page.goto('/hr/operations/absence');
  await expect(page).toHaveURL(/\/hr\/operations\/absence$/u);
  await expect(
    page.getByRole('heading', { name: 'This page is outside your access' })
  ).toBeVisible();
});

test('tenant administrators without HR operations capabilities stay in the self HR boundary', async ({
  page,
}) => {
  await mockShellSession(page, ['ADMIN'], {
    displayName: 'Tenant Administrator',
    jobTitle: 'Company administrator',
    permissions: TENANT_ADMIN_WITHOUT_HR_OPERATIONS_GRANTS,
  });
  await mockCurrentHrisHome(page);

  await page.goto('/hr/home');

  await expectCanonicalHrisNavigation(page, ['shell-home', 'workbench-my-hr']);
  await dismissMobileHcmNavigation(page);

  await page.goto('/hr/operations');
  await expect(page).toHaveURL(/\/403$/u);
  await expect(page.getByRole('heading', { name: 'Access denied', exact: true })).toBeVisible();
});

test('legacy People and Workforce deep links preserve their navigation intent', async ({
  page,
}) => {
  await mockShellSession(page, ['HR_ADMIN'], {
    permissions: FULL_PRODUCT_PERMISSIONS,
  });

  await page.goto('/people/directory?query=Mina#results');
  await expect(page).toHaveURL(/\/hr\/directory\?query=Mina#results$/u);

  await page.goto('/workforce/assignments?asOf=2026-08-13');
  await expect(page).toHaveURL(/\/hr\/operations\/assignments\?asOf=2026-08-13$/u);
});
