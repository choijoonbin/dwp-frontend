import { expect, test, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

import {
  fulfillSuccess as success,
  mockShellSession as mockSession,
} from './support/shell-session';

test.setTimeout(60_000);

async function expectHeaderContract(
  header: Locator,
  context: string,
  scope: 'tenant' | 'provider',
  mobile: boolean,
  shellKey: 'workspace' | 'hris' | 'account' | 'admin' | 'provider'
) {
  await expect(header).toBeVisible();
  await expect(header).toHaveAttribute('data-dwp-shell', shellKey);
  await expect(header).toHaveAttribute('data-dwp-shell-context', context);
  await expect(header).toHaveAttribute('data-dwp-shell-scope', scope);
  await expect(header.getByTestId('shell-application-context')).toContainText(context);

  const search = header.getByRole('button', { name: 'Search DWP' });
  const notification = header.getByRole('button', { name: 'Notifications' });
  const account = header.getByRole('button', { name: /^Account:/ });
  await expect(search).toBeVisible();
  await expect(notification).toBeVisible();
  await expect(account).toBeVisible();

  const [searchBox, notificationBox, accountBox] = await Promise.all([
    search.boundingBox(),
    notification.boundingBox(),
    account.boundingBox(),
  ]);
  expect(searchBox?.x ?? 0).toBeLessThan(notificationBox?.x ?? 0);
  expect(notificationBox?.x ?? 0).toBeLessThan(accountBox?.x ?? 0);
  expect(await header.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(false);

  const workspace = header.getByRole('button', { name: 'Select workspace' });
  if (scope === 'provider' || mobile) {
    await expect(workspace).toBeHidden();
  } else {
    await expect(workspace).toBeVisible();
  }

  const accessibility = await new AxeBuilder({ page: header.page() }).include('header').analyze();
  expect(accessibility.violations).toEqual([]);
}

test('tenant shells keep one application-context and global-utility contract', async ({
  page,
}, testInfo) => {
  await mockSession(page, ['TENANT_ADMIN']);
  const mobile = testInfo.project.name === 'mobile';
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));

  await page.goto('/work');
  await expectHeaderContract(page.getByTestId('app-header'), 'Work', 'tenant', mobile, 'workspace');

  await page.goto('/hr/directory');
  await expectHeaderContract(page.getByTestId('hris-header'), 'HRIS', 'tenant', mobile, 'hris');
  if (mobile) {
    await page.getByRole('button', { name: 'Open HRIS navigation' }).click();
    await expect(
      page.getByTestId('hris-mobile-sidebar').getByText('Digital Workplace', { exact: true })
    ).toBeVisible();
    await page.keyboard.press('Escape');
  } else {
    await expect(page.getByTestId('hris-sidebar')).toHaveCSS('width', '248px');
    await expect(
      page.getByTestId('hris-sidebar').getByText('Digital Workplace', { exact: true })
    ).toBeVisible();
  }

  await page.goto('/account/profile');
  await expectHeaderContract(
    page.getByTestId('account-header'),
    'Settings',
    'tenant',
    mobile,
    'account'
  );

  await page.goto('/admin/experience/branding');
  await expectHeaderContract(
    page.getByTestId('admin-header'),
    'Control Center',
    'tenant',
    mobile,
    'admin'
  );
  const adminSidebar = mobile
    ? page.getByTestId('admin-mobile-sidebar')
    : page.getByTestId('admin-sidebar');
  if (mobile) {
    await page.getByRole('button', { name: 'Open administration navigation' }).click();
  } else {
    await expect(adminSidebar).toHaveCSS('width', '272px');
  }
  await expect(adminSidebar.getByText('Control Center', { exact: true })).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test('provider shell keeps global scope separate from tenant workspace', async ({
  page,
}, testInfo) => {
  await mockSession(page, ['PROVIDER_ADMIN']);
  const mobile = testInfo.project.name === 'mobile';

  await page.goto('/');
  await expect(page).toHaveURL(/\/provider\/overview$/);

  await page.goto('/account/settings/appearance');
  await expect(page.getByTestId('account-header')).toBeVisible();
  const accountSidebar = mobile
    ? page.getByTestId('account-mobile-sidebar')
    : page.getByTestId('account-sidebar');
  if (mobile) {
    await page.getByRole('button', { name: 'Open settings navigation' }).click();
  }
  await expect(
    accountSidebar.getByRole('link', { name: 'Back to Provider Control Plane' })
  ).toHaveAttribute('href', '/provider/overview');
  if (mobile) await page.keyboard.press('Escape');

  await page.goto('/provider/overview');
  await expectHeaderContract(
    page.getByTestId('provider-header'),
    'Provider Control Plane',
    'provider',
    mobile,
    'provider'
  );

  const providerSidebar = mobile
    ? page.getByTestId('provider-mobile-sidebar')
    : page.locator('aside');
  if (mobile) {
    await page.getByRole('button', { name: 'Open provider navigation' }).click();
  } else {
    await expect(providerSidebar).toHaveCSS('width', '272px');
  }
  await expect(providerSidebar.getByText('Provider Control Plane', { exact: true })).toBeVisible();
  await expect(providerSidebar.getByRole('link', { name: 'Account settings' })).toHaveAttribute(
    'href',
    '/account/settings/appearance'
  );
});

test('authentication boot screen reserves the resolved shell geometry', async ({
  page,
}, testInfo) => {
  await mockSession(page, ['TENANT_ADMIN']);
  let releaseAuthentication!: () => void;
  const authenticationGate = new Promise<void>((resolve) => {
    releaseAuthentication = resolve;
  });

  await page.route('**/api/auth/me', async (route) => {
    await authenticationGate;
    return success(route, {
      userId: 1,
      displayName: 'Tenant Admin',
      jobTitle: 'Platform administrator',
      email: 'tenant.admin@dwp.local',
      tenantId: 1,
      tenantCode: 'default',
      tenantName: 'SKAX',
      preferredLocale: 'en',
      tenantDefaultLocale: 'en',
      roles: ['TENANT_ADMIN'],
    });
  });

  await page.goto('/admin/experience/branding');
  const boot = page.getByTestId('shell-boot-screen');
  await expect(boot).toBeVisible();
  await expect(boot).toHaveAttribute('data-dwp-shell', 'admin');
  await expect(page.getByTestId('shell-boot-header')).toBeVisible();
  if (testInfo.project.name !== 'mobile') {
    await expect(page.getByTestId('shell-boot-sidebar')).toHaveCSS('width', '272px');
    const [headerBox, mainBox] = await Promise.all([
      page.getByTestId('shell-boot-header').boundingBox(),
      page.getByTestId('shell-boot-main').boundingBox(),
    ]);
    expect(headerBox?.x).toBe(272);
    expect(mainBox?.x).toBe(272);
  }

  releaseAuthentication();
  await expect(page.getByTestId('admin-header')).toBeVisible();
  await expect(boot).toBeHidden();
});

test('shell utilities reflow without horizontal overflow at intermediate and zoom-equivalent widths', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium');
  await mockSession(page, ['TENANT_ADMIN']);

  for (const width of [1280, 1200, 1024, 640]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/work');
    const header = page.getByTestId('app-header');
    await expect(header).toBeVisible();
    const dimensions = await header.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);

    const actionsBox = await header.getByTestId('shell-global-actions').boundingBox();
    expect(actionsBox?.x ?? width).toBeGreaterThanOrEqual(0);
    expect((actionsBox?.x ?? 0) + (actionsBox?.width ?? 0)).toBeLessThanOrEqual(width + 1);
  }
});

test('keyboard users can skip the shell and retain focus through SPA navigation', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium');
  await mockSession(page, ['TENANT_ADMIN']);
  await page.goto('/work');
  await expect(page.getByTestId('app-header')).toBeVisible();

  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('app-main')).toBeFocused();

  await page.getByRole('link', { name: 'Ask', exact: true }).first().click();
  await expect(page).toHaveURL(/\/ask$/);
  await expect(page.getByTestId('app-main')).toBeFocused();
});
