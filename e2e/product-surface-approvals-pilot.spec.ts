import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  broadcastProductSurfaceRevision,
  mockApprovalProductSurfaceAuthority,
} from './support/product-surface-authority';
import { approvalPilotAuthorityOptions } from './support/pilot-authorization-fixtures';
import {
  APPROVAL_WORKFLOW_DETAIL_FIXTURE,
  APPROVAL_WORKFLOW_FIXTURE,
} from './support/product-area-fixtures';
import { fulfillSuccess, mockShellSession } from './support/shell-session';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((settled) => {
    resolve = settled;
  });
  return { promise, resolve };
}

const APPROVAL_ADMIN_PERMISSIONS = [
  ['ADMIN.APPROVAL_OPERATIONS', 'VIEW'],
  ['ADMIN.APPROVAL_DESIGN', 'VIEW'],
  ['ADMIN.APPROVAL_POLICY', 'VIEW'],
  ['ADMIN.APPROVAL_SIGNATURE', 'VIEW'],
].map(([resourceKey, permissionCode]) => ({
  resourceType: 'ADMIN',
  resourceKey,
  permissionCode,
  effect: 'ALLOW' as const,
}));

const APPROVAL_FIXTURE_MATRIX = [
  {
    testId: 'PS-A001',
    surface: 'approvals.work',
    allowed: '/approvals/home',
    denied: '/approvals/admin/workflows',
  },
  {
    testId: 'PS-A002',
    surface: 'approvals.work',
    allowed: '/approvals/admin/workflows',
    denied: '/approvals/admin/operations',
  },
  {
    testId: 'PS-A003',
    surface: 'approvals.work',
    allowed: '/approvals/admin/workflows',
    denied: '/approvals/admin/operations',
  },
  {
    testId: 'PS-A004',
    surface: 'approvals.work',
    allowed: '/approvals/admin/overview',
    denied: '/approvals/admin/workflows',
  },
  {
    testId: 'PS-A005',
    surface: 'approvals.work',
    allowed: '/approvals/admin/operations',
    denied: '/approvals/admin/workflows',
  },
  {
    testId: 'PS-A006',
    surface: 'approvals.admin',
    allowed: '/approvals/admin/workflows',
    denied: '/approvals/home',
  },
  { testId: 'PS-A007', surface: null, allowed: null, denied: null },
  {
    testId: 'PS-A008',
    surface: 'approvals.work',
    allowed: '/approvals/admin/overview',
    denied: '/approvals/admin/workflows',
    expiryWarning: true,
  },
  { testId: 'PS-A009', surface: null, allowed: null, denied: null },
  {
    testId: 'PS-A010',
    surface: 'approvals.work',
    allowed: '/approvals/admin/policies',
    denied: '/approvals/admin/operations',
  },
  {
    testId: 'PS-A011',
    surface: 'approvals.work',
    allowed: '/approvals/admin/signatures',
    denied: '/approvals/admin/policies',
  },
  {
    testId: 'PS-A012',
    surface: 'approvals.admin',
    allowed: '/approvals/admin/overview',
    denied: null,
  },
  {
    testId: 'PS-A013',
    surface: 'approvals.work',
    allowed: '/approvals/admin/policies',
    denied: '/approvals/admin/operations',
  },
  {
    testId: 'PS-A014',
    surface: 'approvals.work',
    allowed: '/approvals/admin/forms',
    denied: '/approvals/admin/operations',
  },
  {
    testId: 'PS-A015',
    surface: 'approvals.work',
    allowed: '/approvals/inbox',
    denied: '/approvals/admin/workflows',
  },
  {
    testId: 'PS-A016',
    surface: 'approvals.work',
    allowed: '/approvals/inbox',
    denied: '/approvals/admin/workflows',
  },
  {
    testId: 'PS-A017',
    surface: 'approvals.work',
    allowed: '/approvals/inbox',
    denied: '/approvals/admin/workflows',
  },
  {
    testId: 'PS-A018',
    surface: 'approvals.work',
    allowed: '/approvals/requests/new',
    denied: '/approvals/admin/workflows',
  },
] as const;

async function approvalNavigation(page: Page): Promise<Locator> {
  const desktop = page.getByTestId('approvals-sidebar');
  const mobileTrigger = page.getByRole('button', { name: '전자결재 메뉴 열기' });
  await expect
    .poll(async () => (await desktop.isVisible()) || (await mobileTrigger.isVisible()))
    .toBe(true);
  if (await desktop.isVisible()) return desktop;

  await mobileTrigger.click();
  const mobile = page.getByTestId('approvals-mobile-sidebar');
  await expect(mobile).toBeVisible();
  return mobile;
}

async function responsiveControlKind(
  desktop: Locator,
  mobile: Locator
): Promise<'desktop' | 'mobile'> {
  await expect
    .poll(async () => (await desktop.isVisible()) || (await mobile.isVisible()))
    .toBe(true);
  return (await desktop.isVisible()) ? 'desktop' : 'mobile';
}

for (const scenario of APPROVAL_FIXTURE_MATRIX) {
  test(`${scenario.testId} canonical fixture가 root·menu·direct-route 결정을 구동한다`, async ({
    page,
  }) => {
    const { authority, fixture } = approvalPilotAuthorityOptions(scenario.testId);
    expect(fixture.projectionKind).toBe('E2E_SESSION');
    expect(fixture.fixtureChecksum).toMatch(/^[a-f0-9]{64}$/u);
    expect(fixture.testCase.testId).toBe(scenario.testId);

    await mockShellSession(page, ['WORKSPACE_MEMBER'], { locale: 'ko', permissions: [] });
    await mockApprovalProductSurfaceAuthority(page, authority);
    await page.goto('/approvals');

    if (!scenario.surface) {
      await expect(page.getByTestId('approvals-shell')).toHaveCount(0);
      await expect(
        page.getByRole('heading', {
          name: /이 앱을 사용할 수 없습니다|관리 영역이 할당되지 않았습니다/u,
        })
      ).toBeVisible();
      return;
    }

    await expect(page.getByTestId('approvals-shell')).toHaveAttribute(
      'data-product-surface',
      scenario.surface
    );
    if (scenario.allowed) {
      await page.goto(scenario.allowed);
      await expect(page.getByTestId('approvals-shell')).toHaveAttribute(
        'data-product-surface',
        scenario.allowed.startsWith('/approvals/admin') ? 'approvals.admin' : 'approvals.work'
      );
    }
    if (scenario.expiryWarning) {
      await expect(page.getByRole('status')).toContainText(
        '5분 이내에 관리 권한을 다시 확인합니다'
      );
    }
    if (scenario.denied) {
      await page.goto(scenario.denied);
      await expect(
        page.getByRole('heading', {
          name: /현재 접근 범위 밖입니다|관리 영역이 할당되지 않았습니다/u,
        })
      ).toBeVisible();
    }
  });
}

test('management-only 사용자는 제품 루트에서 첫 관리 페이지로 진입하고 업무 메뉴를 보지 않는다', async ({
  page,
}, testInfo) => {
  await mockShellSession(page, ['APPROVAL_OPERATOR'], {
    locale: 'ko',
    displayName: '결재 관리자',
    permissions: APPROVAL_ADMIN_PERMISSIONS,
  });
  await mockApprovalProductSurfaceAuthority(page, { work: false, management: true });

  await page.goto('/approvals');

  await expect(page).toHaveURL(/\/approvals\/admin\/overview(?:\?.*)?$/u);
  await expect(page.getByTestId('approvals-shell')).toHaveAttribute(
    'data-product-surface',
    'approvals.admin'
  );
  await expect(page.getByTestId('approvals-shell')).toHaveAttribute(
    'data-product-plane',
    'management'
  );
  const navigation = await approvalNavigation(page);
  await expect(navigation.getByRole('link', { name: '운영 개요', exact: true })).toBeVisible();
  await expect(navigation.getByRole('link', { name: '프로세스 설계', exact: true })).toBeVisible();
  await expect(navigation.getByRole('link', { name: '결재함', exact: true })).toHaveCount(0);
  await expect(navigation.getByRole('link', { name: '새 결재 작성', exact: true })).toHaveCount(0);
  await expect(
    navigation.getByRole('link', { name: '앱 목록으로 돌아가기', exact: true })
  ).toHaveAttribute('href', '/apps');
  if (await page.getByTestId('approvals-mobile-sidebar').isVisible()) {
    await page.keyboard.press('Escape');
  }
  await expect(page.getByRole('heading', { name: '결재 운영 개요', level: 1 })).toBeVisible();
  await page.mouse.move(1, 1);
  await expect(page.getByRole('tooltip')).toHaveCount(0);

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath('approvals-management-only-1280.png'),
    fullPage: true,
  });
});

test('업무 Surface와 관리 Surface는 같은 사용자에게도 각자의 메뉴만 렌더링한다', async ({
  page,
}) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'APPROVAL_OPERATOR'], {
    locale: 'ko',
    permissions: APPROVAL_ADMIN_PERMISSIONS,
  });
  await mockApprovalProductSurfaceAuthority(page);

  await page.goto('/approvals/home');
  await expect(page.getByTestId('approvals-shell')).toHaveAttribute(
    'data-product-surface',
    'approvals.work'
  );
  const workNavigation = await approvalNavigation(page);
  await expect(workNavigation.getByRole('link', { name: '결재함', exact: true })).toBeVisible();
  await expect(
    workNavigation.getByRole('link', { name: '프로세스 설계', exact: true })
  ).toHaveCount(0);
  await expect(workNavigation.getByRole('link', { name: '앱 관리', exact: true })).toHaveCount(0);
  const mobile = (page.viewportSize()?.width ?? 1280) < 1200;
  if (mobile) await page.keyboard.press('Escape');

  await expect(
    page.getByTestId('approvals-header').getByRole('link', { name: '앱 관리', exact: true })
  ).toHaveCount(mobile ? 0 : 1);
  await page.getByRole('button', { name: /^계정:/u }).click();
  const accountDialog = page.getByRole('dialog', { name: '계정 및 세션' });
  await expect(accountDialog.getByRole('menuitem', { name: '앱 관리', exact: true })).toHaveCount(
    0
  );
  await page.keyboard.press('Escape');

  if (mobile) {
    await page.getByTestId('approvals-mobile-surface-switcher').getByRole('button').click();
  }
  const surfaceNavigation = (
    mobile
      ? page.getByTestId('product-surface-mobile-disclosure')
      : page.getByTestId('approvals-header')
  ).getByRole('navigation', { name: '제품 업무 및 관리 영역' });
  const managementSurfaceLink = surfaceNavigation.getByRole('link', {
    name: '앱 관리',
    exact: true,
  });
  await expect(managementSurfaceLink).toHaveCount(1);
  expect(await managementSurfaceLink.evaluate((element) => element.tagName)).toBe('A');
  await expect(
    surfaceNavigation.getByRole('link', { name: '결재 업무', exact: true })
  ).toHaveAttribute('aria-current', 'page');
  await managementSurfaceLink.click();
  await expect(page).toHaveURL(/\/approvals\/admin\/overview(?:\?.*)?$/u);
  await expect(page.getByTestId('approvals-shell')).toHaveAttribute(
    'data-product-surface',
    'approvals.admin'
  );
  const managementNavigation = await approvalNavigation(page);
  await expect(
    managementNavigation.getByRole('link', { name: '프로세스 설계', exact: true })
  ).toBeVisible();
  await expect(managementNavigation.getByRole('link', { name: '결재함', exact: true })).toHaveCount(
    0
  );
  await expect(
    managementNavigation.getByRole('link', { name: '업무로 돌아가기', exact: true })
  ).toHaveAttribute('href', /\/approvals\/home/u);
});

test('Surface 전환은 1280·1440 desktop, 390·320 mobile, 200% text에서 항상 발견 가능하다', async ({
  page,
}, testInfo) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'APPROVAL_OPERATOR'], {
    locale: 'ko',
    permissions: APPROVAL_ADMIN_PERMISSIONS,
  });
  await mockApprovalProductSurfaceAuthority(page);

  for (const width of [1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/approvals/home');
    await expect(
      page
        .getByTestId('approvals-header')
        .getByRole('navigation', { name: '제품 업무 및 관리 영역' })
        .getByRole('link', { name: '앱 관리', exact: true })
    ).toBeVisible();
    await expect(
      page.getByTestId('approvals-sidebar').getByRole('link', { name: '앱 관리', exact: true })
    ).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath(`approvals-surface-switch-${width}.png`),
      fullPage: true,
    });
  }

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 320, height: 720 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/approvals/home');
    const disclosureTrigger = page.getByRole('button', { name: '현재 영역: 결재 업무' });
    await disclosureTrigger.click();
    await expect(disclosureTrigger).toHaveAttribute('aria-expanded', 'true');
    await expect(
      page
        .getByTestId('product-surface-mobile-disclosure')
        .getByRole('link', { name: '앱 관리', exact: true })
    ).toBeVisible();
    await page.getByRole('button', { name: '제품 영역 목록 닫기' }).click();
    await expect(disclosureTrigger).toBeFocused();
    await disclosureTrigger.click();
    await page.keyboard.press('Escape');
    await expect(disclosureTrigger).toHaveAttribute('aria-expanded', 'false');
    await expect(disclosureTrigger).toBeFocused();

    const drawerTrigger = page.getByRole('button', { name: '전자결재 메뉴 열기' });
    await drawerTrigger.click();
    const mobileSidebar = page.getByTestId('approvals-mobile-sidebar');
    await expect(mobileSidebar.getByRole('link', { name: '결재함', exact: true })).toBeVisible();
    await expect(mobileSidebar.getByRole('link', { name: '앱 관리', exact: true })).toHaveCount(0);
    await expect(page.locator('#dwp-main-content')).toHaveAttribute('inert', '');
    await expect(page.getByTestId('approvals-header')).toHaveAttribute('inert', '');
    await mobileSidebar.getByRole('button', { name: '제품 메뉴 닫기' }).click();
    await expect(drawerTrigger).toBeFocused();
    await expect(page.locator('#dwp-main-content')).not.toHaveAttribute('inert', '');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: testInfo.outputPath(`approvals-surface-switch-mobile-${viewport.width}.png`),
      fullPage: true,
    });
  }

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/approvals/home');
  await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
  await expect(page.getByRole('heading', { name: '전자결재', level: 1 })).toBeVisible();
  const textZoomDisclosureTrigger = page.getByRole('button', {
    name: '현재 영역: 결재 업무',
  });
  await textZoomDisclosureTrigger.click();
  await expect(
    page
      .getByTestId('product-surface-mobile-disclosure')
      .getByRole('link', { name: '앱 관리', exact: true })
  ).toBeVisible();
  await page.getByRole('button', { name: '제품 영역 목록 닫기' }).click();
  await expect(textZoomDisclosureTrigger).toHaveAttribute('aria-expanded', 'false');
  await expect(textZoomDisclosureTrigger).toBeFocused();
  const textZoomOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(textZoomOverflow).toBeLessThanOrEqual(1);
  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath('approvals-surface-switch-text-200.png'),
    fullPage: true,
  });
});

test('mobile Surface Link는 route 전환 후 Document Title·H1 focus를 갱신하고 browser back focus를 덮어쓰지 않는다', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'APPROVAL_OPERATOR'], {
    locale: 'ko',
    permissions: APPROVAL_ADMIN_PERMISSIONS,
  });
  await mockApprovalProductSurfaceAuthority(page);

  await page.goto('/approvals/home');
  await page.getByRole('button', { name: '현재 영역: 결재 업무' }).click();
  await page
    .getByTestId('product-surface-mobile-disclosure')
    .getByRole('link', { name: '앱 관리', exact: true })
    .click();
  const managementHeading = page.getByRole('heading', { name: '결재 운영 개요', level: 1 });
  await expect(managementHeading).toBeFocused();
  await expect(page).toHaveTitle('결재 운영 개요 · 결재 관리 · DWP');

  await page.getByRole('button', { name: '전자결재 메뉴 열기' }).click();
  const persistentLink = page
    .getByTestId('approvals-mobile-sidebar')
    .getByRole('link', { name: '프로세스 설계', exact: true });
  await persistentLink.focus();
  await page.goBack();
  await expect(page).toHaveURL(/\/approvals\/home(?:\?.*)?$/u);
  await expect(page.getByRole('heading', { name: '전자결재', level: 1 })).not.toBeFocused();
});

test('관리 딥링크의 query/hash와 back/forward 및 새 탭 URL을 보존한다', async ({
  page,
  context,
}) => {
  await mockShellSession(page, ['APPROVAL_DESIGNER'], {
    locale: 'ko',
    permissions: APPROVAL_ADMIN_PERMISSIONS,
  });
  await mockApprovalProductSurfaceAuthority(page, { work: false, management: true });

  await page.goto('/approvals/admin/forms?view=published#catalog');
  const canonicalManagementUrl = (url: URL, pathname: string) =>
    url.pathname === pathname &&
    url.searchParams.get('scope') === 'scope:approvals:tenant' &&
    url.searchParams.get('view') === 'published' &&
    url.hash === '#catalog';
  await expect(page).toHaveURL((url) => canonicalManagementUrl(url, '/approvals/admin/forms'));
  const navigation = await approvalNavigation(page);
  await navigation.getByRole('link', { name: '결재 정책', exact: true }).click();
  await expect(page).toHaveURL((url) => canonicalManagementUrl(url, '/approvals/admin/policies'));
  await page.goBack();
  await expect(page).toHaveURL((url) => canonicalManagementUrl(url, '/approvals/admin/forms'));
  await page.goForward();
  await expect(page).toHaveURL((url) => canonicalManagementUrl(url, '/approvals/admin/policies'));

  const second = await context.newPage();
  await mockShellSession(second, ['APPROVAL_DESIGNER'], {
    locale: 'ko',
    permissions: APPROVAL_ADMIN_PERMISSIONS,
  });
  await mockApprovalProductSurfaceAuthority(second, { work: false, management: true });
  await second.goto('/approvals/admin/forms?view=published#catalog');
  await expect(second).toHaveURL((url) => canonicalManagementUrl(url, '/approvals/admin/forms'));
});

test('제품 root는 명시한 non-default Scope와 query/hash를 canonical 관리 PAGE까지 보존한다', async ({
  page,
}) => {
  await mockShellSession(page, ['APPROVAL_OPERATOR'], {
    locale: 'ko',
    permissions: APPROVAL_ADMIN_PERMISSIONS,
  });
  await mockApprovalProductSurfaceAuthority(page, {
    work: false,
    management: true,
    managementScopes: 'two-no-default',
  });

  await page.goto('/approvals?scope=S2&view=exceptions#queue');

  await expect(page).toHaveURL(
    (url) =>
      url.pathname === '/approvals/admin/overview' &&
      url.searchParams.get('scope') === 'S2' &&
      url.searchParams.get('view') === 'exceptions' &&
      url.hash === '#queue'
  );
  await expect(page.getByTestId('approvals-shell')).toHaveAttribute(
    'data-product-surface',
    'approvals.admin'
  );
});

test('기본값 없는 복수 Scope의 관리 index와 sidebar는 선택 Scope·query·hash를 보존한다', async ({
  page,
}, testInfo) => {
  await mockShellSession(page, ['APPROVAL_OPERATOR'], {
    locale: 'ko',
    permissions: APPROVAL_ADMIN_PERMISSIONS,
  });
  await mockApprovalProductSurfaceAuthority(page, {
    work: false,
    management: true,
    managementScopes: 'two-no-default',
  });

  await page.goto('/approvals/admin?scope=S2&view=exceptions#queue');
  await expect(
    page.getByTestId('approvals-header').getByTestId('product-surface-context-bar')
  ).toHaveAttribute('data-placement', 'header');
  await expect(
    page.getByTestId('approvals-sidebar').getByTestId('product-surface-context-bar')
  ).toHaveCount(0);
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === '/approvals/admin/overview' &&
      url.searchParams.get('scope') === 'S2' &&
      url.searchParams.get('view') === 'exceptions' &&
      url.hash === '#queue'
  );
  const navigation = await approvalNavigation(page);
  await navigation.getByRole('link', { name: '프로세스 설계', exact: true }).click();
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === '/approvals/admin/workflows' &&
      url.searchParams.get('scope') === 'S2' &&
      url.searchParams.get('view') === 'exceptions' &&
      url.hash === '#queue'
  );
  await expect(page.getByRole('heading', { name: '프로세스 설계', level: 1 })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('approvals-multi-scope-s2.png'),
    fullPage: true,
  });
});

test('기본 Scope가 없어도 앱 관리 진입점을 유지하고 exact 선택 후 query·hash를 보존한다', async ({
  page,
}) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'APPROVAL_OPERATOR'], {
    locale: 'ko',
    permissions: APPROVAL_ADMIN_PERMISSIONS,
  });
  await mockApprovalProductSurfaceAuthority(page, {
    managementScopes: 'two-no-default',
  });

  await page.goto('/approvals/home');
  const mobile = (page.viewportSize()?.width ?? 1280) < 1200;
  if (mobile) {
    await page.getByTestId('approvals-mobile-surface-switcher').getByRole('button').click();
  }
  const surfaceNavigation = mobile
    ? page.getByTestId('product-surface-mobile-disclosure')
    : page.getByTestId('approvals-header');
  const managementEntry = surfaceNavigation.getByRole('link', { name: '앱 관리', exact: true });
  await expect(managementEntry).toHaveCount(1);
  await expect(managementEntry).not.toHaveAttribute('href', /[?&]scope=/u);
  await managementEntry.click();
  await expect(page.getByTestId('product-surface-access-state')).toHaveAttribute(
    'data-product-access-state',
    'scope-selection-required'
  );

  await page.goto('/approvals/admin/overview?view=exceptions#queue');
  await page.getByRole('button', { name: '관리 범위 선택' }).click();
  const dialog = page.getByRole('dialog', { name: '허용된 관리 범위 선택' });
  await dialog.getByRole('combobox', { name: '범위' }).click();
  await page.getByRole('option', { name: '전자결재 운영 B' }).click();
  await dialog.getByRole('button', { name: '관리 범위 선택' }).click();

  await expect(page).toHaveURL(
    (url) =>
      url.pathname === '/approvals/admin/overview' &&
      url.searchParams.get('scope') === 'S2' &&
      url.searchParams.get('view') === 'exceptions' &&
      url.hash === '#queue'
  );
  await expect(page.getByRole('heading', { name: '결재 운영 개요', level: 1 })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === '/approvals/admin/overview' &&
      url.searchParams.get('scope') === null &&
      url.searchParams.get('view') === 'exceptions' &&
      url.hash === '#queue'
  );
  await expect(page.getByTestId('product-surface-access-state')).toHaveAttribute(
    'data-product-access-state',
    'scope-selection-required'
  );

  await page.goForward();
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === '/approvals/admin/overview' &&
      url.searchParams.get('scope') === 'S2' &&
      url.searchParams.get('view') === 'exceptions' &&
      url.hash === '#queue'
  );
  await expect(page.getByRole('heading', { name: '결재 운영 개요', level: 1 })).toBeVisible();
});

test('browser back의 지연된 A→B Scope 전환은 stale A mutation을 dispatch하지 않는다', async ({
  page,
}) => {
  await mockShellSession(page, ['APPROVAL_OPERATOR'], {
    locale: 'ko',
    permissions: APPROVAL_ADMIN_PERMISSIONS,
  });
  await mockApprovalProductSurfaceAuthority(page, {
    work: false,
    management: true,
    managementScopes: 'two-no-default',
  });

  const draftWorkflow = { ...APPROVAL_WORKFLOW_FIXTURE, lifecycleState: 'DRAFT' as const };
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/admin/workflows',
    (route) =>
      route.request().method() === 'GET' ? fulfillSuccess(route, [draftWorkflow]) : route.fallback()
  );
  await page.route(
    (url) => url.pathname === `/api/approvals/v1/admin/workflows/${draftWorkflow.workflowId}`,
    (route) =>
      fulfillSuccess(route, {
        ...APPROVAL_WORKFLOW_DETAIL_FIXTURE,
        workflow: draftWorkflow,
      })
  );

  await page.goto('/approvals/admin/workflows?scope=S2');
  await expect(page.getByRole('heading', { name: '프로세스 설계', level: 1 })).toBeVisible();
  const scopeSelector = page.getByRole('combobox', { name: '범위' });
  const mobileScopeTrigger = page.getByRole('button', {
    name: '관리 범위: 전자결재 운영 B',
  });
  if ((await responsiveControlKind(scopeSelector, mobileScopeTrigger)) === 'desktop') {
    await scopeSelector.click();
    await page.getByRole('option', { name: '전자결재 운영 A' }).click();
  } else {
    await mobileScopeTrigger.click();
    const dialog = page.getByRole('dialog', { name: '허용된 관리 범위 선택' });
    await dialog.getByRole('combobox', { name: '관리 범위' }).click();
    await page.getByRole('option', { name: '전자결재 운영 A' }).click();
    await dialog.getByRole('button', { name: '관리 범위 선택' }).click();
  }
  await expect(page).toHaveURL((url) => url.searchParams.get('scope') === 'S1');
  const selectedMobileScopeTrigger = page.getByRole('button', {
    name: '관리 범위: 전자결재 운영 A',
  });
  const selectedScopeControl =
    (await responsiveControlKind(scopeSelector, selectedMobileScopeTrigger)) === 'desktop'
      ? scopeSelector
      : selectedMobileScopeTrigger;
  await expect(selectedScopeControl).toBeVisible();

  const actionGate = deferred();
  const actionStarted = deferred();
  const actionSettled = deferred();
  const scopeBPageGate = deferred();
  const scopeBPageStarted = deferred();
  let createDispatchCount = 0;

  await page.route('**/api/auth/product-surface-access/evaluate', async (route) => {
    const body = route.request().postDataJSON() as {
      routeContractKey?: string;
      contextScopeKey?: string;
    };
    const delayedAction =
      body.routeContractKey === 'route.approvals.admin.workflow-create.action' &&
      body.contextScopeKey === 'S1';
    const delayedScopeBPage =
      body.routeContractKey === 'route.approvals.admin.workflows.page' &&
      body.contextScopeKey === 'S2';
    if (delayedAction) {
      actionStarted.resolve();
      await actionGate.promise;
    }
    if (delayedScopeBPage) {
      scopeBPageStarted.resolve();
      await scopeBPageGate.promise;
    }
    try {
      await route.fallback();
    } catch (error) {
      if (!delayedAction) throw error;
    } finally {
      if (delayedAction) actionSettled.resolve();
    }
  });
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/admin/workflows',
    (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      createDispatchCount += 1;
      return fulfillSuccess(route, {
        workflow: draftWorkflow,
        definition: APPROVAL_WORKFLOW_DETAIL_FIXTURE.definition,
        definitionHash: APPROVAL_WORKFLOW_DETAIL_FIXTURE.definitionHash,
      });
    }
  );

  try {
    await page.getByRole('button', { name: '새 프로세스 초안' }).click();
    await page.getByRole('textbox', { name: '프로세스 키' }).fill('STALE_SCOPE_CREATE');
    await page.getByRole('textbox', { name: '한국어 이름' }).fill('이전 범위 초안');
    await page.getByRole('textbox', { name: '영어 이름' }).fill('Stale scope draft');
    await page.getByRole('button', { name: '저장', exact: true }).click();
    await actionStarted.promise;

    await page.goBack();
    await expect(page).toHaveURL((url) => url.searchParams.get('scope') === 'S2');
    await scopeBPageStarted.promise;
    await expect(page.getByTestId('product-surface-loading-shell')).toBeVisible();
    await expect(page.getByTestId('product-surface-loading-shell')).toHaveAttribute(
      'aria-busy',
      'true'
    );
    await expect(page.getByRole('heading', { name: '프로세스 설계', level: 1 })).toHaveCount(0);

    actionGate.resolve();
    await actionSettled.promise;
    expect(createDispatchCount).toBe(0);

    scopeBPageGate.resolve();
    await expect(page.getByRole('heading', { name: '프로세스 설계', level: 1 })).toBeVisible();
    const restoredDesktopScope = page.getByRole('combobox', { name: '범위' });
    const restoredMobileScope = page.getByRole('button', {
      name: '관리 범위: 전자결재 운영 B',
    });
    if ((await responsiveControlKind(restoredDesktopScope, restoredMobileScope)) === 'desktop') {
      await expect(restoredDesktopScope).toContainText('전자결재 운영 B');
    } else {
      await expect(restoredMobileScope).toBeVisible();
    }
    expect(createDispatchCount).toBe(0);
  } finally {
    actionGate.resolve();
    scopeBPageGate.resolve();
  }
});

test('관리 권한 회수 시 현재 관리 데이터와 shell을 제거하고 fail-closed 상태를 표시한다', async ({
  page,
}) => {
  await mockShellSession(page, ['APPROVAL_OPERATOR'], {
    locale: 'ko',
    permissions: APPROVAL_ADMIN_PERMISSIONS,
  });
  const authority = await mockApprovalProductSurfaceAuthority(page, {
    work: false,
    management: true,
  });

  await page.goto('/approvals/admin/overview');
  await expect(page.getByTestId('approvals-shell')).toBeVisible();
  authority.revoke('approvals.admin');
  await broadcastProductSurfaceRevision(page, authority.revision());

  await expect(page.getByTestId('approvals-shell')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: '이 관리 영역이 할당되지 않았습니다' })
  ).toBeVisible();
});

test('surface UI flag off는 canonical URL과 기존 호환 shell을 유지한다', async ({ page }) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'APPROVAL_OPERATOR'], {
    locale: 'ko',
    permissions: APPROVAL_ADMIN_PERMISSIONS,
  });
  await mockApprovalProductSurfaceAuthority(page, { surfaceUi: false });

  await page.goto('/approvals/admin/forms?view=published#catalog');

  await expect(page).toHaveURL(/\/approvals\/admin\/forms\?view=published#catalog$/u);
  await expect(page.getByRole('heading', { name: '양식 카탈로그', level: 1 })).toBeVisible();
  await expect(page.getByTestId('product-surface-context-bar')).toHaveCount(0);
});
