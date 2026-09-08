import { expect, test, type Page } from '@playwright/test';

import { mockShellSession } from './support/shell-session';

const NOTIFICATION_OPERATIONS_VIEW = {
  resourceType: 'ADMIN',
  resourceKey: 'ADMIN.NOTIFICATION_OPERATIONS',
  permissionCode: 'VIEW',
  effect: 'ALLOW' as const,
};

async function expectNotificationPolicyLocalDeny(page: Page) {
  await expect(page.getByTestId('notifications-shell')).toHaveAttribute(
    'data-product-plane',
    'management'
  );
  await expect(page.getByTestId('product-surface-access-state')).toHaveAttribute(
    'data-product-access-state',
    'route-denied'
  );
  await expect(
    page.getByRole('heading', { name: '이 페이지는 현재 접근 범위 밖입니다' })
  ).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'PRODUCT_ADMIN'], {
    locale: 'ko',
    permissions: [NOTIFICATION_OPERATIONS_VIEW],
  });
});

test('canonical 관리 URL은 권한이 없을 때 제품 shell 안에서 local deny한다', async ({ page }) => {
  await page.goto('/notifications/admin/policies?audit=deny#permission');

  await expect(page).toHaveURL(
    (url) =>
      url.pathname === '/notifications/admin/policies' &&
      url.searchParams.get('audit') === 'deny' &&
      url.hash === '#permission'
  );
  await expectNotificationPolicyLocalDeny(page);
});

test('legacy 관리 URL은 canonical target으로 replace한 뒤 동일한 local deny를 위임한다', async ({
  page,
}) => {
  await page.goto('/apps?origin=legacy-deny');
  await page.goto('/admin/notifications/policies?audit=deny#permission');

  await expect(page).toHaveURL(
    (url) =>
      url.pathname === '/notifications/admin/policies' &&
      url.searchParams.get('audit') === 'deny' &&
      url.hash === '#permission'
  );
  await expectNotificationPolicyLocalDeny(page);

  await page.goBack();
  await expect(page).toHaveURL(
    (url) => url.pathname === '/apps' && url.searchParams.get('origin') === 'legacy-deny'
  );
  await page.goForward();
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === '/notifications/admin/policies' &&
      url.searchParams.get('audit') === 'deny' &&
      url.hash === '#permission'
  );
  await expectNotificationPolicyLocalDeny(page);
});

test('Provider identity는 legacy product-admin redirect를 사용할 수 없다', async ({ page }) => {
  await mockShellSession(page, ['PROVIDER_SUPPORT'], {
    identityPlane: 'PROVIDER',
    locale: 'ko',
    permissions: [NOTIFICATION_OPERATIONS_VIEW],
  });

  await page.goto('/admin/notifications/policies?audit=deny#permission');
  await expect(page).toHaveURL(/\/provider(?:\/overview)?(?:\?.*)?$/u);
  await expect(page.getByTestId('notifications-shell')).toHaveCount(0);
});

test('Spaces legacy 관리 index도 query/hash를 canonical target에 보존하고 history를 replace한다', async ({
  page,
}) => {
  await mockShellSession(page, ['SPACE_TEMPLATE_ADMIN'], {
    locale: 'ko',
    permissions: [
      {
        resourceType: 'APP',
        resourceKey: 'APP.ADMINISTRATION',
        permissionCode: 'VIEW',
        effect: 'ALLOW',
      },
      {
        resourceType: 'APP',
        resourceKey: 'APP.SPACES',
        permissionCode: 'VIEW',
        effect: 'ALLOW',
      },
      {
        resourceType: 'ADMIN',
        resourceKey: 'ADMIN.SPACE_TEMPLATES',
        permissionCode: 'VIEW',
        effect: 'ALLOW',
      },
    ],
  });
  await page.goto('/apps?origin=spaces-index');
  await page.goto('/admin/spaces?state=draft#catalog');

  await expect(page).toHaveURL(
    (url) =>
      url.pathname === '/spaces/admin/templates' &&
      url.searchParams.get('state') === 'draft' &&
      url.hash === '#catalog'
  );
  await page.goBack();
  await expect(page).toHaveURL(
    (url) => url.pathname === '/apps' && url.searchParams.get('origin') === 'spaces-index'
  );
  await page.goForward();
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === '/spaces/admin/templates' &&
      url.searchParams.get('state') === 'draft' &&
      url.hash === '#catalog'
  );
});
