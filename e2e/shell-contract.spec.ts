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
  shellKey: 'workspace' | 'work' | 'hcm' | 'account' | 'admin' | 'provider'
) {
  await expect(header).toBeVisible();
  await expect(header).toHaveAttribute('data-dwp-shell', shellKey);
  await expect(header).toHaveAttribute('data-dwp-shell-context', context);
  await expect(header).toHaveAttribute('data-dwp-shell-scope', scope);
  await expect(header.getByTestId('shell-application-context')).toContainText(context);

  const account = header.getByRole('button', { name: /^Account:/ });
  await expect(account).toBeVisible();

  const search = header.getByRole('button', { name: 'Search DWP' });
  const notification = header.getByRole('button', { name: 'Notifications' });
  if (scope === 'provider') {
    await expect(search).toBeVisible();
    await expect(notification).toHaveCount(0);
    const [searchBox, accountBox] = await Promise.all([
      search.boundingBox(),
      account.boundingBox(),
    ]);
    expect(searchBox?.x ?? 0).toBeLessThan(accountBox?.x ?? 0);
  } else {
    await expect(search).toBeVisible();
    await expect(notification).toBeVisible();
    const [searchBox, notificationBox, accountBox] = await Promise.all([
      search.boundingBox(),
      notification.boundingBox(),
      account.boundingBox(),
    ]);
    expect(searchBox?.x ?? 0).toBeLessThan(notificationBox?.x ?? 0);
    expect(notificationBox?.x ?? 0).toBeLessThan(accountBox?.x ?? 0);
  }
  expect(await header.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(false);

  const workspace = header.getByTestId('shell-workspace-identity');
  await expect(header.getByRole('button', { name: 'Select workspace' })).toHaveCount(0);
  if (scope === 'provider') {
    await expect(workspace).toHaveCount(0);
  } else if (mobile) {
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
  const workHeader = page.getByTestId('work-header');
  await expectHeaderContract(workHeader, 'Work', 'tenant', mobile, 'work');
  const workIdentity = workHeader.getByText('Tenant Admin', { exact: true });
  if (mobile) await expect(workIdentity).toBeHidden();
  else await expect(workIdentity).toBeVisible();

  await page.goto('/hr/directory');
  const hcmHeader = page.getByTestId('hcm-header');
  await expectHeaderContract(hcmHeader, 'HR', 'tenant', mobile, 'hcm');
  await expect(hcmHeader.getByText('Tenant Admin', { exact: true })).toBeHidden();
  if (mobile) {
    await page.getByRole('button', { name: 'Open HR navigation' }).click();
    await expect(
      page.getByTestId('hcm-mobile-sidebar').getByText('Digital Workplace', { exact: true })
    ).toBeVisible();
    await page.keyboard.press('Escape');
  } else {
    await expect(page.getByTestId('hcm-sidebar')).toHaveCSS('width', '248px');
    await expect(
      page.getByTestId('hcm-sidebar').getByText('Digital Workplace', { exact: true })
    ).toBeVisible();
  }

  await page.goto('/account/profile');
  const accountHeader = page.getByTestId('account-header');
  await expectHeaderContract(accountHeader, 'Settings', 'tenant', mobile, 'account');
  const accountIdentity = accountHeader.getByText('Tenant Admin', { exact: true });
  if (mobile) await expect(accountIdentity).toBeHidden();
  else await expect(accountIdentity).toBeVisible();
  if (mobile) {
    const accountTrigger = page.getByTestId('account-mobile-navigation-trigger');
    await expect(accountTrigger).toHaveAttribute('aria-expanded', 'false');
    await expect(accountTrigger).toHaveAttribute('aria-controls', 'account-mobile-navigation');
    await accountTrigger.click();
    await expect(accountTrigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#dwp-main-content')).toHaveAttribute('inert', '');
    await page.getByRole('button', { name: 'Close navigation' }).click();
    await expect(accountTrigger).toBeFocused();
    await expect(page.locator('#dwp-main-content')).not.toHaveAttribute('inert', '');
  }

  await page.goto('/admin/experience/branding');
  const adminHeader = page.getByTestId('admin-header');
  await expectHeaderContract(adminHeader, 'Control Center', 'tenant', mobile, 'admin');
  const adminIdentity = adminHeader.getByText('Tenant Admin', { exact: true });
  if (mobile) await expect(adminIdentity).toBeHidden();
  else await expect(adminIdentity).toBeVisible();
  const adminSidebar = mobile
    ? page.getByTestId('admin-mobile-sidebar')
    : page.getByTestId('admin-sidebar');
  if (mobile) {
    const adminTrigger = page.getByTestId('admin-mobile-navigation-trigger');
    await expect(adminTrigger).toHaveAttribute('aria-controls', 'admin-mobile-navigation');
    await adminTrigger.click();
    await expect(adminTrigger).toHaveAttribute('aria-expanded', 'true');
  } else {
    await expect(adminSidebar).toHaveCSS('width', '272px');
  }
  await expect(adminSidebar.getByText('Control Center', { exact: true })).toBeVisible();
  if (mobile) {
    await page.getByRole('button', { name: 'Close navigation' }).click();
    await expect(page.getByTestId('admin-mobile-navigation-trigger')).toBeFocused();
  }
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
  await expectHeaderContract(
    page.getByTestId('account-header'),
    'Settings',
    'provider',
    mobile,
    'account'
  );
  const accountSidebar = mobile
    ? page.getByTestId('account-mobile-sidebar')
    : page.getByTestId('account-sidebar');
  if (mobile) {
    const accountTrigger = page.getByTestId('account-mobile-navigation-trigger');
    await expect(accountTrigger).toHaveAttribute('aria-controls', 'account-mobile-navigation');
    await accountTrigger.click();
  }
  await expect(
    accountSidebar.getByRole('link', { name: 'Back to Provider Control Plane' })
  ).toHaveAttribute('href', '/provider');
  if (mobile) {
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('account-mobile-navigation-trigger')).toBeFocused();
  }

  await page.goto('/provider/overview');
  const providerHeader = page.getByTestId('provider-header');
  await expectHeaderContract(
    providerHeader,
    'Provider Control Plane',
    'provider',
    mobile,
    'provider'
  );
  const providerIdentity = providerHeader.getByText('Provider Admin', { exact: true });
  if (mobile) await expect(providerIdentity).toBeHidden();
  else await expect(providerIdentity).toBeVisible();

  const providerSidebar = mobile
    ? page.getByTestId('provider-mobile-sidebar')
    : page.locator('aside');
  if (mobile) {
    const providerTrigger = page.getByTestId('provider-mobile-navigation-trigger');
    await expect(providerTrigger).toHaveAttribute('aria-controls', 'provider-mobile-navigation');
    await providerTrigger.click();
    await expect(providerTrigger).toHaveAttribute('aria-expanded', 'true');
  } else {
    await expect(providerSidebar).toHaveCSS('width', '272px');
  }
  await expect(providerSidebar.getByText('Provider Control Plane', { exact: true })).toBeVisible();
  await expect(providerSidebar.getByRole('link', { name: 'Account settings' })).toHaveAttribute(
    'href',
    '/account/settings/appearance'
  );
  if (mobile) {
    await page.getByRole('button', { name: 'Close navigation' }).click();
    await expect(page.getByTestId('provider-mobile-navigation-trigger')).toBeFocused();
  }
});

test('global search lazy runtime keeps visible loading feedback and a close action', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Lazy loading feedback is covered once.');
  await mockSession(page, ['TENANT_ADMIN'], { locale: 'en' });

  let releaseModule: (() => void) | undefined;
  const moduleReleased = new Promise<void>((resolve) => {
    releaseModule = resolve;
  });
  await page.route('**/src/features/search/global-search-dialog-runtime.tsx*', async (route) => {
    await moduleReleased;
    await route.continue();
  });

  await page.goto('/work');
  const trigger = page.getByRole('button', { name: 'Search DWP' }).first();
  await trigger.click();

  const loadingDialog = page.getByRole('dialog', { name: 'Loading your assigned apps' });
  await expect(loadingDialog).toBeVisible();
  await expect(loadingDialog.getByRole('status')).toContainText('Loading your assigned apps');
  await page.waitForTimeout(10_100);
  const delayedDialog = page.getByRole('dialog', {
    name: 'Search is taking longer than expected to load',
  });
  await expect(delayedDialog.getByRole('status')).toContainText(
    'Search is taking longer than expected to load'
  );
  await expect(
    delayedDialog.getByRole('button', { name: 'Reload the page to restore search' })
  ).toBeVisible();
  await delayedDialog.getByRole('button', { name: 'Close search' }).click();
  await expect(delayedDialog).toBeHidden();

  releaseModule?.();
});

test('notification lazy runtime keeps an accessible loading dialog and restores its trigger', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Lazy loading feedback is covered once.');
  await mockSession(page, ['TENANT_ADMIN'], { locale: 'en' });

  let releaseModule: (() => void) | undefined;
  const moduleReleased = new Promise<void>((resolve) => {
    releaseModule = resolve;
  });
  await page.route(
    '**/src/features/notifications/notification-header-glance.tsx*',
    async (route) => {
      await moduleReleased;
      await route.continue();
    }
  );

  await page.goto('/work');
  const trigger = page.getByRole('button', { name: 'Notifications' });
  await trigger.click();

  const loadingDialog = page.getByRole('dialog', { name: 'Loading notifications' });
  await expect(loadingDialog).toBeVisible();
  await expect(loadingDialog.getByRole('status')).toContainText('Loading notifications');
  await loadingDialog.getByRole('button', { name: 'Close notifications' }).click();
  await expect(loadingDialog).toBeHidden();
  await expect(trigger).toBeFocused();

  releaseModule?.();
});

test('OS forced-colors preserves the current account and administration destinations', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium',
    'Desktop forced-colors contract is covered once.'
  );
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await mockSession(page, ['TENANT_ADMIN'], { locale: 'en' });

  await page.goto('/account/profile');
  const accountCurrent = page.getByTestId('account-sidebar').getByRole('link', { name: 'Profile' });
  await expect(accountCurrent).toHaveAttribute('aria-current', 'page');
  await expect(accountCurrent).toHaveCSS('outline-style', 'solid');
  await expect(accountCurrent).toHaveCSS('outline-width', '2px');

  await page.goto('/admin/experience/branding');
  const adminCurrent = page.getByTestId('admin-sidebar').getByRole('link', { name: 'Branding' });
  await expect(adminCurrent).toHaveAttribute('aria-current', 'page');
  await expect(adminCurrent).toHaveCSS('outline-style', 'solid');
  await expect(adminCurrent).toHaveCSS('outline-width', '2px');
});

test('OS forced-colors preserves the current provider destination', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium',
    'Desktop forced-colors contract is covered once.'
  );
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await mockSession(page, ['PROVIDER_ADMIN'], { locale: 'en' });

  await page.goto('/provider/overview');
  const providerCurrent = page
    .locator('#provider-desktop-navigation')
    .getByRole('link', { name: 'Command center' });
  await expect(providerCurrent).toHaveAttribute('aria-current', 'page');
  await expect(providerCurrent).toHaveCSS('outline-style', 'solid');
  await expect(providerCurrent).toHaveCSS('outline-width', '2px');
});

test('mobile drawer navigation leaves focus on the new route heading', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSession(page, ['TENANT_ADMIN']);
  await page.goto('/account/settings/appearance');

  const trigger = page.getByTestId('account-mobile-navigation-trigger');
  await trigger.click();
  await expect(page.getByTestId('account-mobile-sidebar')).toBeVisible();
  await page
    .getByTestId('account-mobile-sidebar')
    .getByRole('link', {
      name: 'Accessibility',
    })
    .click();

  await expect(page).toHaveURL(/\/account\/settings\/accessibility$/);
  await expect(page.getByRole('heading', { name: 'Accessibility', level: 1 })).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).not.toBeFocused();
});

test('mobile navigation drawer isolates the global assistant layer', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSession(page, ['TENANT_ADMIN']);
  await page.goto('/hr/directory');

  const navigationTrigger = page.getByTestId('hcm-mobile-navigation-trigger');
  const launcher = page.getByTestId('dwaion-launcher');
  const launcherTrigger = launcher.getByRole('button', { name: 'Open DWAI·ON' });
  await expect(launcherTrigger).toBeVisible();

  await navigationTrigger.click();
  await expect(page.getByTestId('hcm-mobile-sidebar')).toBeVisible();
  await expect(launcher).toHaveAttribute('inert', '');
  const launcherBounds = await launcher.boundingBox();
  expect(launcherBounds).not.toBeNull();
  const launcherOwnsHitTarget = await page.evaluate(
    ({ x, y }) => {
      const target = document.elementFromPoint(x, y);
      return Boolean(target?.closest('[data-testid="dwaion-launcher"]'));
    },
    {
      x: launcherBounds!.x + launcherBounds!.width / 2,
      y: launcherBounds!.y + launcherBounds!.height / 2,
    }
  );
  expect(launcherOwnsHitTarget).toBe(false);
  await page.mouse.click(
    launcherBounds!.x + launcherBounds!.width / 2,
    launcherBounds!.y + launcherBounds!.height / 2
  );
  await expect(
    page.getByRole('dialog', { name: 'DWAI·ON conversation and support panel' })
  ).toHaveCount(0);
  await expect(page.getByTestId('hcm-mobile-sidebar')).toBeHidden();
  await expect(launcher).not.toHaveAttribute('inert', '');
  await launcherTrigger.click();
  const assistantPanel = page.getByRole('dialog', {
    name: 'DWAI·ON conversation and support panel',
  });
  await expect(assistantPanel).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(assistantPanel).toBeHidden();
  await expect(launcherTrigger).toBeFocused();
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
      identityPlane: 'TENANT',
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
    const header = page.getByTestId('work-header');
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
  await page.goto('/account/settings/appearance');
  await expect(page.getByTestId('account-header')).toBeVisible();

  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('account-main')).toBeFocused();

  await page.getByTestId('account-sidebar').getByRole('link', { name: 'Accessibility' }).click();
  await expect(page).toHaveURL(/\/account\/settings\/accessibility$/);
  await expect(page.getByRole('heading', { name: 'Accessibility', level: 1 })).toBeFocused();
});
