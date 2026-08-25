import { expect, test, type Locator, type Page } from '@playwright/test';

import { mockHcmProductSurfaceAuthority } from './support/product-surface-authority';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

type CompatibilityProductScenario = {
  id: string;
  areaKey: 'calendar' | 'mail' | 'messaging' | 'rooms' | 'spaces' | 'notifications' | 'dwaion';
  workPath: `/${string}`;
  managementPath: `/${string}`;
  workItem: string;
  managementItem: string;
};

const allowView = (resourceType: 'APP' | 'ADMIN', resourceKey: string) => ({
  resourceType,
  resourceKey,
  permissionCode: 'VIEW',
  effect: 'ALLOW' as const,
});

const COMPATIBILITY_ADMIN_PERMISSIONS = [
  ...FULL_PRODUCT_PERMISSIONS,
  allowView('APP', 'APP.MESSAGING'),
  allowView('APP', 'APP.NOTIFICATIONS'),
  allowView('ADMIN', 'ADMIN.MAIL'),
  allowView('ADMIN', 'ADMIN.MESSAGING'),
  allowView('ADMIN', 'ADMIN.NOTIFICATION_OPERATIONS'),
  allowView('ADMIN', 'ADMIN.NOTIFICATION_CONTRACT'),
  allowView('ADMIN', 'ADMIN.NOTIFICATION_POLICY'),
  allowView('ADMIN', 'ADMIN.NOTIFICATION_TEMPLATE'),
  allowView('ADMIN', 'ADMIN.DWAION_OPERATIONS'),
  allowView('ADMIN', 'ADMIN.DWAION_AGENTS'),
  allowView('ADMIN', 'ADMIN.DWAION_SOURCES'),
  allowView('ADMIN', 'ADMIN.DWAION_ACTIONS'),
  allowView('ADMIN', 'ADMIN.DWAION_SAFETY'),
  allowView('ADMIN', 'ADMIN.DWAION_EVALUATION'),
  allowView('ADMIN', 'ADMIN.DWAION_GATES'),
  allowView('ADMIN', 'ADMIN.DWAION_AUDIT'),
] as const;

const COMPATIBILITY_PRODUCTS: readonly CompatibilityProductScenario[] = [
  {
    id: 'calendar',
    areaKey: 'calendar',
    workPath: '/calendar/home',
    managementPath: '/calendar/admin/overview',
    workItem: 'home',
    managementItem: 'admin-overview',
  },
  {
    id: 'mail',
    areaKey: 'mail',
    workPath: '/mail/home',
    managementPath: '/mail/admin/overview',
    workItem: 'home',
    managementItem: 'admin-overview',
  },
  {
    id: 'messaging',
    areaKey: 'messaging',
    workPath: '/messages/home',
    managementPath: '/messages/admin/overview',
    workItem: 'home',
    managementItem: 'admin-overview',
  },
  {
    id: 'workplace',
    areaKey: 'rooms',
    workPath: '/workplace/home',
    managementPath: '/workplace/admin/overview',
    workItem: 'home',
    managementItem: 'admin-overview',
  },
  {
    id: 'spaces',
    areaKey: 'spaces',
    workPath: '/spaces/home',
    managementPath: '/spaces/admin/overview',
    workItem: 'home',
    managementItem: 'admin-overview',
  },
  {
    id: 'notifications',
    areaKey: 'notifications',
    workPath: '/notifications/home',
    managementPath: '/notifications/admin/overview',
    workItem: 'home',
    managementItem: 'admin-overview',
  },
  {
    id: 'dwaion',
    areaKey: 'dwaion',
    workPath: '/dwaion/home',
    managementPath: '/dwaion/admin/overview',
    workItem: 'home',
    managementItem: 'admin-overview',
  },
] as const;

function isMobile(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1280) < 1200;
}

async function openProductSidebar(page: Page, areaKey: string): Promise<Locator> {
  if (!isMobile(page)) {
    const navigation = page.getByTestId(`${areaKey}-sidebar`);
    await expect(navigation).toBeVisible();
    return navigation;
  }

  const navigation = page.getByTestId(`${areaKey}-mobile-sidebar`);
  if (!(await navigation.isVisible())) {
    await page.getByTestId(`${areaKey}-mobile-navigation-trigger`).click();
  }
  await expect(navigation).toBeVisible();
  return navigation;
}

async function closeProductSidebar(page: Page, areaKey: string) {
  if (!isMobile(page)) return;
  const navigation = page.getByTestId(`${areaKey}-mobile-sidebar`);
  if (await navigation.isVisible()) {
    await page.keyboard.press('Escape');
    await expect(navigation).toBeHidden();
  }
}

async function managementEntry(page: Page, scenario: CompatibilityProductScenario) {
  if (!isMobile(page)) {
    const switcher = page.getByTestId(`${scenario.areaKey}-desktop-surface-switcher`);
    await expect(switcher).toBeVisible();
    const entry = switcher.locator(`a[href="${scenario.managementPath}"]`);
    await expect(entry).toHaveCount(1);
    return entry;
  }

  const switcher = page.getByTestId(`${scenario.areaKey}-mobile-surface-switcher`);
  await expect(switcher).toBeVisible();
  await switcher.getByRole('button').click();
  const disclosure = page.getByTestId('product-surface-mobile-disclosure');
  await expect(disclosure).toBeVisible();
  const entry = disclosure.locator(`a[href="${scenario.managementPath}"]`);
  await expect(entry).toHaveCount(1);
  return entry;
}

async function expectLocalNotFound(
  page: Page,
  scenario: CompatibilityProductScenario,
  plane: 'work' | 'management',
  path: string
) {
  await page.goto(`${path}?acceptance=local-404#missing`);
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === path &&
      url.searchParams.get('acceptance') === 'local-404' &&
      url.hash === '#missing'
  );
  await expect(page.getByTestId(`${scenario.areaKey}-shell`)).toHaveAttribute(
    'data-product-plane',
    plane
  );
  await expect(page.getByTestId('product-surface-local-not-found')).toBeVisible();
}

test.describe('compatibility 제품 Work·Management 메뉴 분리', () => {
  for (const scenario of COMPATIBILITY_PRODUCTS) {
    test(`${scenario.id}는 Work에 단일 관리 진입점, Management에 업무 복귀만 노출한다`, async ({
      page,
    }, testInfo) => {
      await mockShellSession(page, ['WORKSPACE_MEMBER', 'PRODUCT_ADMIN'], {
        locale: 'ko',
        permissions: [...COMPATIBILITY_ADMIN_PERMISSIONS],
      });

      await page.goto(scenario.workPath);
      const shell = page.getByTestId(`${scenario.areaKey}-shell`);
      await expect(shell).toHaveAttribute('data-product-presentation', 'compatibility-separated');
      await expect(shell).toHaveAttribute('data-product-plane', 'work');

      const workNavigation = await openProductSidebar(page, scenario.areaKey);
      await expect(
        workNavigation.getByTestId(`${scenario.areaKey}-navigation-item-${scenario.workItem}`)
      ).toBeVisible();
      await expect(
        workNavigation.getByTestId(`${scenario.areaKey}-navigation-item-${scenario.managementItem}`)
      ).toHaveCount(0);
      await expect(
        workNavigation.getByTestId(`${scenario.areaKey}-surface-return`)
      ).toHaveAttribute('href', '/apps');
      await closeProductSidebar(page, scenario.areaKey);

      const entry = await managementEntry(page, scenario);
      await entry.click();
      await expect(page).toHaveURL((url) => url.pathname === scenario.managementPath);
      await expect(shell).toHaveAttribute('data-product-plane', 'management');

      const managementNavigation = await openProductSidebar(page, scenario.areaKey);
      await expect(
        managementNavigation.getByTestId(
          `${scenario.areaKey}-navigation-item-${scenario.managementItem}`
        )
      ).toBeVisible();
      await expect(
        managementNavigation.getByTestId(`${scenario.areaKey}-navigation-item-${scenario.workItem}`)
      ).toHaveCount(0);
      await expect(
        managementNavigation.getByTestId(`${scenario.areaKey}-surface-return`)
      ).toHaveAttribute('href', scenario.workPath);
      await page.screenshot({
        path: testInfo.outputPath(`${scenario.id}-management-menu-separated.png`),
        fullPage: true,
      });

      await expectLocalNotFound(
        page,
        scenario,
        'work',
        `${scenario.workPath.replace(/\/home$/u, '')}/not/a/registered-route`
      );
      await expectLocalNotFound(
        page,
        scenario,
        'management',
        `${scenario.managementPath.replace(/\/overview$/u, '')}/not/a/registered-route`
      );
    });
  }
});

for (const denied of [
  {
    id: 'notifications policy',
    areaKey: 'notifications',
    path: '/notifications/admin/policies',
    deniedResourceKey: 'ADMIN.NOTIFICATION_POLICY',
  },
  {
    id: 'dwaion safety',
    areaKey: 'dwaion',
    path: '/dwaion/admin/safety',
    deniedResourceKey: 'ADMIN.DWAION_SAFETY',
  },
] as const) {
  test(`${denied.id} 권한 없는 관리 deep link는 제품 shell 안에서 local deny한다`, async ({
    page,
  }) => {
    await mockShellSession(page, ['WORKSPACE_MEMBER', 'PRODUCT_ADMIN'], {
      locale: 'ko',
      permissions: COMPATIBILITY_ADMIN_PERMISSIONS.filter(
        (permission) => permission.resourceKey !== denied.deniedResourceKey
      ),
    });

    await page.goto(`${denied.path}?acceptance=local-deny#permission`);
    await expect(page).toHaveURL(
      (url) =>
        url.pathname === denied.path &&
        url.searchParams.get('acceptance') === 'local-deny' &&
        url.hash === '#permission'
    );
    await expect(page.getByTestId(`${denied.areaKey}-shell`)).toHaveAttribute(
      'data-product-plane',
      'management'
    );
    await expect(page.getByTestId('product-surface-access-state')).toHaveAttribute(
      'data-product-access-state',
      'route-denied'
    );
  });
}

const HCM_SURFACES = [
  {
    path: '/hr/home',
    plane: 'work',
    visibleItem: 'home',
    hiddenItems: ['team', 'operations', 'organization-design'],
    returnPath: '/apps',
  },
  {
    path: '/hr/team',
    plane: 'work',
    visibleItem: 'team',
    hiddenItems: ['home', 'operations', 'organization-design'],
    returnPath: '/apps',
  },
  {
    path: '/hr/operations',
    plane: 'management',
    visibleItem: 'operations',
    hiddenItems: ['home', 'team', 'organization-design'],
    returnPath: '/hr/home',
  },
  {
    path: '/hr/design/organization',
    plane: 'management',
    visibleItem: 'organization-design',
    hiddenItems: ['home', 'team', 'operations'],
    returnPath: '/hr/home',
  },
] as const;

test('HCM personal·team·operations·management Surface는 메뉴와 업무 복귀를 격리한다', async ({
  page,
}, testInfo) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'MANAGER', 'HR_ADMIN'], {
    locale: 'ko',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await mockHcmProductSurfaceAuthority(page, {
    deniedRouteKeys: ['route.hcm.management.reference.page'],
  });

  for (const surface of HCM_SURFACES) {
    await page.goto(surface.path);
    const shell = page.getByTestId('hcm-shell');
    await expect(shell).toHaveAttribute('data-product-presentation', 'native-surface');
    await expect(shell).toHaveAttribute('data-product-plane', surface.plane);
    await expect(shell).toHaveAttribute(
      'data-product-surface',
      surface.visibleItem === 'home'
        ? 'hcm.personal'
        : surface.visibleItem === 'team'
          ? 'hcm.team'
          : surface.visibleItem === 'operations'
            ? 'hcm.operations'
            : 'hcm.management'
    );
    const navigation = await openProductSidebar(page, 'hcm');
    await expect(
      navigation.getByTestId(`hcm-navigation-item-${surface.visibleItem}`)
    ).toBeVisible();
    for (const hiddenItem of surface.hiddenItems) {
      await expect(navigation.getByTestId(`hcm-navigation-item-${hiddenItem}`)).toHaveCount(0);
    }
    await expect(navigation.getByTestId('hcm-surface-return')).toHaveAttribute(
      'href',
      new RegExp(`^${surface.returnPath.replaceAll('/', '\\/')}(?:\\?|$)`, 'u')
    );
    if (surface.visibleItem === 'organization-design') {
      await page.screenshot({
        path: testInfo.outputPath('hcm-management-menu-separated.png'),
        fullPage: true,
      });
    }
    await closeProductSidebar(page, 'hcm');

    if (surface.plane === 'work') {
      const switcher = page.getByTestId(
        isMobile(page) ? 'hcm-mobile-surface-switcher' : 'hcm-desktop-surface-switcher'
      );
      if (isMobile(page)) {
        await switcher.getByRole('button').click();
        await expect(
          page
            .getByTestId('product-surface-mobile-disclosure')
            .locator('a[href^="/hr/design/organization"]')
        ).toHaveCount(1);
        await page.keyboard.press('Escape');
      } else {
        await expect(switcher.locator('a[href^="/hr/design/organization"]')).toHaveCount(1);
      }
    }
  }

  await page.goto('/hr/data/reference?acceptance=local-deny#permission');
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === '/hr/data/reference' &&
      url.searchParams.get('acceptance') === 'local-deny' &&
      url.hash === '#permission'
  );
  await expect(page.getByTestId('hcm-shell')).toHaveAttribute(
    'data-product-surface',
    'hcm.management'
  );
  await expect(page.getByTestId('product-surface-access-state')).toHaveAttribute(
    'data-product-access-state',
    'route-denied'
  );

  await page.goto('/people/not/a/registered-route?source=legacy#missing');
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === '/hr/legacy-not-found' &&
      url.searchParams.get('source') === 'legacy' &&
      url.hash === '#missing'
  );
  await expect(page.getByTestId('product-surface-local-not-found')).toBeVisible();
});

const LEGACY_ALIASES = [
  {
    source: '/rooms/home?floor=2#map',
    targetPath: '/workplace/home',
    queryKey: 'floor',
    queryValue: '2',
    hash: '#map',
    shell: 'rooms-shell',
  },
  {
    source: '/admin/notifications/policies?tenant=alpha#rules',
    targetPath: '/notifications/admin/policies',
    queryKey: 'tenant',
    queryValue: 'alpha',
    hash: '#rules',
    shell: 'notifications-shell',
  },
  {
    source: '/admin/spaces/templates?state=draft#catalog',
    targetPath: '/spaces/admin/templates',
    queryKey: 'state',
    queryValue: 'draft',
    hash: '#catalog',
    shell: 'spaces-shell',
  },
  {
    source: '/ask?q=review&agent=calendar#composer',
    targetPath: '/dwaion/new',
    queryKey: 'agent',
    queryValue: 'calendar',
    hash: '#composer',
    shell: 'dwaion-shell',
  },
  {
    source: '/dwaion/admin/retention?range=90d#audit',
    targetPath: '/dwaion/admin/audit',
    queryKey: 'range',
    queryValue: '90d',
    hash: '#audit',
    shell: 'dwaion-shell',
  },
  {
    source: '/people/directory?query=Mina#results',
    targetPath: '/hr/directory',
    queryKey: 'query',
    queryValue: 'Mina',
    hash: '#results',
    shell: 'hcm-shell',
  },
] as const;

test('주요 legacy alias는 canonical 제품 shell에서 query와 hash를 한 번만 보존한다', async ({
  page,
}) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'MANAGER', 'HR_ADMIN', 'PRODUCT_ADMIN'], {
    locale: 'ko',
    permissions: [...COMPATIBILITY_ADMIN_PERMISSIONS],
  });

  for (const alias of LEGACY_ALIASES) {
    await page.goto(alias.source);
    await expect(page).toHaveURL(
      (url) =>
        url.pathname === alias.targetPath &&
        url.searchParams.get(alias.queryKey) === alias.queryValue &&
        url.hash === alias.hash
    );
    await expect(page.getByTestId(alias.shell)).toBeVisible();
  }
});
