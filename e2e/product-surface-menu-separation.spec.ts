import { expect, test, type Locator, type Page } from '@playwright/test';

import { mockHcmProductSurfaceAuthority } from './support/product-surface-authority';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

type CompatibilityProductScenario = {
  id: string;
  areaKey:
    | 'calendar'
    | 'communications'
    | 'dwaion'
    | 'mail'
    | 'meetings'
    | 'messaging'
    | 'notifications'
    | 'rooms'
    | 'services'
    | 'spaces';
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
  allowView('APP', 'APP.COMMUNICATIONS'),
  allowView('APP', 'APP.EMPLOYEE_SERVICES'),
  allowView('APP', 'APP.MEETINGS'),
  allowView('APP', 'APP.MESSAGING'),
  allowView('APP', 'APP.NOTIFICATIONS'),
  allowView('ADMIN', 'ADMIN.MAIL'),
  allowView('ADMIN', 'ADMIN.MEETINGS'),
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
    id: 'communications',
    areaKey: 'communications',
    workPath: '/communications/home',
    managementPath: '/communications/admin/content',
    workItem: 'home',
    managementItem: 'admin-content',
  },
  {
    id: 'services',
    areaKey: 'services',
    workPath: '/services/home',
    managementPath: '/services/admin/catalog',
    workItem: 'home',
    managementItem: 'admin-catalog',
  },
  {
    id: 'meetings',
    areaKey: 'meetings',
    workPath: '/meetings/home',
    managementPath: '/meetings/admin/operations',
    workItem: 'home',
    managementItem: 'admin-operations',
  },
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
  const switcher = page.getByTestId(
    `${scenario.areaKey}-${isMobile(page) ? 'mobile' : 'desktop'}-surface-switcher`
  );
  await expect(switcher).toBeVisible();
  const entry = switcher.getByTestId('product-surface-management-entry');
  await expect(entry).toHaveCount(1);
  await expect(entry).toHaveAttribute('href', scenario.managementPath);
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

test('대표 앱의 Work·Management 전환은 1440·1024·390·320에서 제품 문맥과 복귀를 보존한다', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', '공통 반응형 Product Surface 계약 전용 검증');
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'PRODUCT_ADMIN'], {
    locale: 'ko',
    permissions: [...COMPATIBILITY_ADMIN_PERMISSIONS],
  });

  const representativeProducts = COMPATIBILITY_PRODUCTS.filter(({ id }) =>
    ['calendar', 'meetings', 'mail'].includes(id)
  );
  for (const scenario of representativeProducts) {
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1024, height: 768 },
      { width: 390, height: 844 },
      { width: 320, height: 720 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(scenario.workPath);
      const header = page.getByTestId(`${scenario.areaKey}-header`);
      const applicationContext = header.getByTestId('shell-application-context');
      await expect(applicationContext).toBeVisible();

      const entry = await managementEntry(page, scenario);
      await expect(entry).toHaveAccessibleName(/앱 관리/u);
      if (viewport.width <= 360) {
        const workRail = header.getByTestId('shell-mobile-context-rail');
        await expect(workRail).toBeVisible();
        await expect(workRail.getByText('관리', { exact: true })).toBeVisible();
      } else if (viewport.width < 1200) {
        await expect(header.getByTestId('shell-mobile-context-rail')).toHaveCount(0);
      }

      await entry.click();
      await expect(page).toHaveURL((url) => url.pathname === scenario.managementPath);
      if (viewport.width < 1200) {
        const managementRail = header.getByTestId('shell-mobile-context-rail');
        await expect(managementRail).toBeVisible();
        await expect(managementRail.getByTestId('product-surface-management-mode')).toBeVisible();
        await expect(managementRail.getByTestId('product-surface-work-return')).toBeVisible();
        await expect(managementRail.getByTestId('product-surface-compatibility-tenant')).toHaveText(
          'SKAX'
        );
        await expect(managementRail.getByTestId('product-surface-read-only-status')).toHaveCount(0);
        await expect(managementRail.getByTestId('product-surface-revalidation-status')).toHaveCount(
          0
        );
      } else {
        const desktopSwitcher = page.getByTestId(`${scenario.areaKey}-desktop-surface-switcher`);
        await expect(desktopSwitcher.getByTestId('product-surface-management-mode')).toBeVisible();
        await expect(desktopSwitcher.getByTestId('product-surface-work-return')).toBeVisible();
      }

      const [headerBox, mainPaddingTop, headerOverflow, pageOverflow] = await Promise.all([
        header.boundingBox(),
        page
          .locator('#dwp-main-content')
          .evaluate((element) => Number.parseFloat(getComputedStyle(element).paddingTop)),
        header.evaluate((element) => element.scrollWidth - element.clientWidth),
        page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        ),
      ]);
      expect(Math.abs(mainPaddingTop - (headerBox?.height ?? 0))).toBeLessThanOrEqual(1);
      expect(headerOverflow).toBeLessThanOrEqual(1);
      expect(pageOverflow).toBeLessThanOrEqual(1);
    }
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
      await expect(switcher.getByTestId('product-surface-management-entry')).toHaveCount(1);
      if (isMobile(page)) {
        await switcher.getByRole('button').click();
        await expect(
          page
            .getByTestId('product-surface-mobile-disclosure')
            .locator('a[href^="/hr/design/organization"]')
        ).toHaveCount(0);
        await expect(
          page.getByTestId('product-surface-mobile-disclosure').locator('a[href^="/hr/"]')
        ).toHaveCount(2);
        await page.keyboard.press('Escape');
      } else {
        await expect(switcher.getByTestId('product-surface-management-entry')).toHaveAttribute(
          'href',
          /\/hr\/design\/organization/u
        );
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

test('HCM 다중 Surface 전환은 320px·200% text에서도 한 줄과 키보드 문맥을 보존한다', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', '모바일 임계 폭 전용 검증');
  await page.setViewportSize({ width: 320, height: 720 });
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'MANAGER', 'HR_ADMIN'], {
    locale: 'ko',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await mockHcmProductSurfaceAuthority(page);

  const expectNoHorizontalOverflow = async () => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  };

  for (const zoomed of [false, true]) {
    await page.goto('/hr/home');
    if (zoomed) await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });

    const switcher = page.getByTestId('hcm-mobile-surface-switcher');
    const areaTrigger = switcher.getByRole('button', { name: '현재 영역: 나의 인사' });
    const managementEntry = switcher.getByTestId('product-surface-management-entry');
    await expect(areaTrigger).toBeVisible();
    await expect(managementEntry).toBeVisible();
    await expect(managementEntry).toHaveAccessibleName('앱 관리: 인사');
    await managementEntry.focus();
    await expect(managementEntry).toBeFocused();

    await areaTrigger.click();
    const workMenu = page.getByTestId('product-surface-mobile-disclosure');
    await expect(workMenu.getByRole('menuitem', { name: '나의 인사' })).toBeVisible();
    await expect(workMenu.getByRole('menuitem', { name: '팀 관리' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(areaTrigger).toBeFocused();
    await expect(workMenu).toHaveCount(0);
    await expectNoHorizontalOverflow();
  }

  for (const zoomed of [false, true]) {
    await page.goto('/hr/design/organization');
    if (zoomed) await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });

    const switcher = page.getByTestId('hcm-mobile-surface-switcher');
    const areaTrigger = switcher.getByRole('button', { name: '현재 영역: 데이터 및 연계' });
    const workReturn = switcher.getByTestId('product-surface-work-return');
    await expect(areaTrigger).toBeVisible();
    await expect(workReturn).toBeVisible();
    await expect(workReturn).toHaveAccessibleName('업무로 돌아가기: 인사');
    await workReturn.focus();
    await expect(workReturn).toBeFocused();

    await areaTrigger.click();
    const managementMenu = page.getByTestId('product-surface-mobile-disclosure');
    await expect(managementMenu.getByRole('menuitem', { name: 'HR 운영' })).toBeVisible();
    await expect(managementMenu.getByRole('menuitem', { name: '데이터 및 연계' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(areaTrigger).toBeFocused();
    await expect(managementMenu).toHaveCount(0);
    await expectNoHorizontalOverflow();
  }
});

test('HCM 관리 헤더는 1280·1440·200% text에서 현재 영역과 복귀 동작을 균형 있게 유지한다', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', '데스크톱 헤더 임계 폭 전용 검증');
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'MANAGER', 'HR_ADMIN'], {
    locale: 'ko',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await mockHcmProductSurfaceAuthority(page);

  for (const scenario of [
    { width: 1280, height: 720, zoomed: false },
    { width: 1440, height: 900, zoomed: false },
    { width: 1280, height: 720, zoomed: true },
  ]) {
    await page.setViewportSize({ width: scenario.width, height: scenario.height });
    await page.goto('/hr/design/organization');
    if (scenario.zoomed) {
      await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
    }

    const header = page.getByTestId('hcm-header');
    const switcher = page.getByTestId('hcm-desktop-surface-switcher');
    const managementMode = switcher.getByTestId('product-surface-management-mode');
    const areaTrigger = switcher.getByRole('button', { name: '현재 영역: 데이터 및 연계' });
    const workReturn = switcher.getByTestId('product-surface-work-return');
    await expect(managementMode).toBeVisible();
    await expect(areaTrigger).toBeVisible();
    await expect(workReturn).toBeVisible();
    await expect(workReturn).toHaveAccessibleName('업무로 돌아가기: 인사');

    if (!scenario.zoomed) {
      const visibleAreaLabel = areaTrigger.getByText('데이터 및 연계', { exact: true });
      await expect(visibleAreaLabel).toBeVisible();
      expect(
        await visibleAreaLabel.evaluate((element) => element.scrollWidth - element.clientWidth <= 1)
      ).toBe(true);
    }

    const controlBoxes = await Promise.all([
      managementMode.boundingBox(),
      areaTrigger.boundingBox(),
      workReturn.boundingBox(),
    ]);
    expect(controlBoxes.every(Boolean)).toBe(true);
    const controlCenters = controlBoxes.map((box) => (box ? box.y + box.height / 2 : 0));
    expect(Math.max(...controlCenters) - Math.min(...controlCenters)).toBeLessThanOrEqual(1);

    await areaTrigger.click();
    const managementMenu = page.getByTestId('product-surface-desktop-disclosure');
    await expect(managementMenu.getByRole('menuitem', { name: 'HR 운영' })).toBeVisible();
    await expect(managementMenu.getByRole('menuitem', { name: '데이터 및 연계' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(areaTrigger).toBeFocused();
    await expect(managementMenu).toHaveCount(0);

    const overflow = await header.evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
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
    removedQueryKeys: ['q'],
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
        (!('removedQueryKeys' in alias) ||
          alias.removedQueryKeys.every((queryKey) => !url.searchParams.has(queryKey))) &&
        url.hash === alias.hash
    );
    await expect(page.getByTestId(alias.shell)).toBeVisible();
  }
});
