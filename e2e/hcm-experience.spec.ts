import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { HR_HOME_FIXTURE } from './support/product-area-fixtures';
import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';

async function expectNoHorizontalOverflow(page: Page) {
  const geometry = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    contentWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.contentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
}

async function openMobileHcmNavigation(page: Page) {
  if ((page.viewportSize()?.width ?? 1280) >= 900) return;
  const openButton = page.getByRole('button', { name: 'Open HR navigation' });
  await expect(openButton).toBeVisible();
  await openButton.click();
}

test('employees enter one HR home without manager or operator navigation', async ({ page }) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    displayName: 'Mina Kim',
    jobTitle: 'Product designer',
  });

  await page.goto('/hr/home');

  await expect(
    page.getByRole('heading', { name: new RegExp(HR_HOME_FIXTURE.employee.displayName, 'u') })
  ).toBeVisible();
  await openMobileHcmNavigation(page);
  await expect(page.getByRole('link', { name: 'My HR profile' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'People directory' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Organization explorer' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'My team' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Operations overview' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'HR work that needs attention' })).toBeVisible();
  await expect(page.getByText('A benefits enrollment window is open')).toBeVisible();
  await expect(page.getByText('Resolve your time exceptions')).toBeVisible();
  await page.getByRole('button', { name: 'View HR flow' }).click();
  await expect(page.getByRole('heading', { name: 'My HR flow' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'HR tools' })).toBeVisible();
  await expect(page.locator('[data-workspace-widget="attention"]')).toHaveCount(0);
  await expect(page.locator('[data-workspace-widget="team"]')).toHaveCount(0);
  await expect(page.locator('[data-workspace-widget="operations"]')).toHaveCount(0);

  await page.goto('/hr/operations');
  await expect(page).toHaveURL(/\/hr\/home$/u);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await expectNoHorizontalOverflow(page);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('people managers receive team navigation from the reporting relationship', async ({
  page,
}) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'MANAGER'], {
    displayName: 'Mina Kim',
    jobTitle: 'Product design lead',
  });

  await page.goto('/hr/home');

  await page.getByRole('button', { name: 'My team', exact: true }).click();
  await expect(page.getByRole('heading', { name: "My team's decision flow" })).toBeVisible();
  await expect(page.getByText('Team time decisions are waiting')).toBeVisible();
  await expect(page.getByText('Team leave decisions are waiting')).toBeVisible();
  await expect(page.locator('[data-workspace-widget="team"]')).toBeVisible();
  await expect(page.locator('[data-workspace-widget="profile"]')).toHaveCount(0);
  await expect(page.locator('[data-workspace-widget="operations"]')).toHaveCount(0);

  await openMobileHcmNavigation(page);
  await expect(page.getByRole('link', { name: 'My team' })).toBeVisible();
  await page.getByRole('link', { name: 'My team' }).click();
  await expect(page).toHaveURL(/\/hr\/team$/u);
  await expect(page.getByRole('heading', { name: 'My team', exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('employees can compose and persist their personal HR home', async ({ page }) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    displayName: 'Mina Kim',
    jobTitle: 'Product designer',
  });

  await page.goto('/hr/home');
  await page.getByRole('button', { name: 'Customize HR home' }).click();

  const profileWidget = page.locator('[data-workspace-widget="profile"]');
  await expect(profileWidget).toBeVisible();
  await profileWidget.getByRole('button', { name: 'Hide My profile widget' }).click();
  await page.getByRole('button', { name: 'Expressive' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByRole('button', { name: 'Customize HR home' })).toBeVisible();
  await expect(profileWidget).toHaveCount(0);
  await page.reload();
  await expect(page.locator('[data-workspace-presentation="expressive"]')).toBeVisible();
  await expect(page.locator('[data-workspace-widget="profile"]')).toHaveCount(0);

  await page.getByRole('button', { name: 'Customize HR home' }).click();
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
  });
  await page.route('**/api/people/v1/hr/home', (route) =>
    fulfillSuccess(route, {
      ...HR_HOME_FIXTURE,
      time: null,
      domainStates: {
        ...HR_HOME_FIXTURE.domainStates,
        TIME: {
          availability: 'UNAVAILABLE',
          dataOrigin: 'UNKNOWN',
          reasonCode: 'TIME_QUERY_FAILED',
        },
      },
    })
  );

  await page.goto('/hr/home');

  await expect(page.getByText('A benefits enrollment window is open')).toBeVisible();
  await expect(page.getByText('Some HR work is temporarily unavailable')).toBeVisible();
  await page.getByRole('button', { name: 'View HR flow' }).click();
  await expect(page.getByText('No work schedule is connected.')).toBeVisible();
  await expect(page.getByText('Unavailable').first()).toBeVisible();
});

test('HR operators receive governed workforce and data navigation', async ({ page }) => {
  await mockShellSession(page, ['HR_ADMIN'], {
    displayName: 'Alex Park',
    jobTitle: 'HR operations lead',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });

  await page.goto('/hr/home');

  await page.getByRole('button', { name: 'HR operations', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Workforce operations flow' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'HR operations pulse' })).toBeVisible();
  await expect(
    page.getByRole('main').getByText('HR operations', { exact: true }).first()
  ).toBeVisible();
  await expect(page.locator('[data-workspace-widget="operations"]')).toBeVisible();
  await expect(page.locator('[data-workspace-widget="profile"]')).toHaveCount(0);
  await expect(page.locator('[data-workspace-widget="team"]')).toHaveCount(0);
  await openMobileHcmNavigation(page);
  await expect(page.getByRole('link', { name: 'Operations overview' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Workforce people' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Assignments' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Organization design' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Workforce reference data' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Integrations & reconciliation' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Governed exports' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expectNoHorizontalOverflow(page);
});

test('HR operators without a linked worker enter operations without personal data leakage', async ({
  page,
}) => {
  await mockShellSession(page, ['HR_ADMIN'], {
    displayName: 'Provider HR Operator',
    jobTitle: 'HR data operations lead',
    personPublicId: null,
    permissions: FULL_PRODUCT_PERMISSIONS,
  });

  await page.goto('/hr/home');

  await expect(page.getByRole('heading', { name: 'Workforce operations flow' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Me', exact: true })).toHaveCount(0);
  await expect(page.locator('[data-workspace-widget="profile"]')).toHaveCount(0);
  await expect(page.locator('[data-workspace-widget="operations"]')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('tenant administrators without workforce data access stay in the personal HR boundary', async ({
  page,
}) => {
  await mockShellSession(page, ['ADMIN'], {
    displayName: 'Tenant Administrator',
    jobTitle: 'Company administrator',
    permissions: FULL_PRODUCT_PERMISSIONS.filter(
      (permission) => permission.resourceKey !== 'DATA.WORKFORCE'
    ),
  });

  await page.goto('/hr/home');

  await expect(page.getByRole('button', { name: 'HR operations', exact: true })).toHaveCount(0);
  await openMobileHcmNavigation(page);
  await expect(page.getByRole('link', { name: 'Operations overview' })).toHaveCount(0);
  await page.keyboard.press('Escape');

  await page.goto('/hr/operations');
  await expect(page).toHaveURL(/\/hr\/home$/u);
  await expect(page.getByRole('heading', { name: 'HR work that needs attention' })).toBeVisible();
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
