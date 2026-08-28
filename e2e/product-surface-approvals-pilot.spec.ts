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
  const result: { kind?: 'desktop' | 'mobile' } = {};
  await expect
    .poll(async () => {
      if (await desktop.isVisible()) {
        result.kind = 'desktop';
        return true;
      }
      if (await mobile.isVisible()) {
        result.kind = 'mobile';
        return true;
      }
      result.kind = undefined;
      return false;
    })
    .toBe(true);
  if (!result.kind) throw new Error('No responsive Product Surface control is visible');
  return result.kind;
}

async function navigatePilotRoute(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  const moduleImportFailure = page.getByRole('heading', {
    name: 'Importing a module script failed.',
  });
  if (await moduleImportFailure.isVisible()) {
    await page.reload({ waitUntil: 'domcontentloaded' });
  }
  await expect(moduleImportFailure).toHaveCount(0);
}

for (const scenario of APPROVAL_FIXTURE_MATRIX) {
  test(`${scenario.testId} canonical fixture가 root·menu·direct-route 결정을 구동한다`, async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const { authority, fixture } = approvalPilotAuthorityOptions(scenario.testId);
    expect(fixture.projectionKind).toBe('E2E_SESSION');
    expect(fixture.fixtureChecksum).toMatch(/^[a-f0-9]{64}$/u);
    expect(fixture.testCase.testId).toBe(scenario.testId);

    await mockShellSession(page, ['WORKSPACE_MEMBER'], { locale: 'ko', permissions: [] });
    await mockApprovalProductSurfaceAuthority(page, authority);
    await navigatePilotRoute(page, '/approvals');

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
      await navigatePilotRoute(page, scenario.allowed);
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
      await navigatePilotRoute(page, scenario.denied);
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
  const mobile = (page.viewportSize()?.width ?? 1280) < 1200;
  const header = page.getByTestId('approvals-header');
  await expect(
    header.getByTestId('shell-application-context').getByText('전자결재 관리', { exact: true })
  ).toBeVisible();
  const managementMode = page
    .getByTestId(
      mobile ? 'approvals-mobile-surface-switcher' : 'approvals-desktop-surface-switcher'
    )
    .getByTestId('product-surface-management-mode');
  await expect(managementMode).toBeVisible();
  await expect(header.getByTestId('product-surface-work-return')).toHaveCount(0);
  await page.locator('#dwp-main-content').focus();
  await page.mouse.move(1, 1);
  await expect(page.getByRole('tooltip', { name: '업무로 돌아가기: 전자결재' })).toHaveCount(0);
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

  const header = page.getByTestId('approvals-header');
  await expect(
    header.getByTestId('shell-application-context').getByText('전자결재', { exact: true })
  ).toBeVisible();
  await expect(header.getByText('결재 업무', { exact: true })).toHaveCount(0);
  await expect(
    page
      .getByTestId(
        mobile ? 'approvals-mobile-surface-switcher' : 'approvals-desktop-surface-switcher'
      )
      .getByTestId('product-surface-management-entry')
  ).toBeVisible();
  await page.getByRole('button', { name: /^계정:/u }).click();
  const accountDialog = page.getByRole('dialog', { name: '계정 및 세션' });
  await expect(accountDialog.getByRole('menuitem', { name: '앱 관리', exact: true })).toHaveCount(
    0
  );
  await page.keyboard.press('Escape');

  const surfaceNavigation = page.getByTestId(
    mobile ? 'approvals-mobile-surface-switcher' : 'approvals-desktop-surface-switcher'
  );
  const managementSurfaceLink = surfaceNavigation.getByTestId('product-surface-management-entry');
  await expect(managementSurfaceLink).toHaveCount(1);
  await expect(managementSurfaceLink).toHaveAccessibleName('앱 관리: 전자결재');
  expect(await managementSurfaceLink.evaluate((element) => element.tagName)).toBe('A');
  await expect(surfaceNavigation.getByRole('link', { name: '결재 업무' })).toHaveCount(0);
  await managementSurfaceLink.click();
  await expect(page).toHaveURL(/\/approvals\/admin\/overview(?:\?.*)?$/u);
  await expect(page.getByTestId('approvals-shell')).toHaveAttribute(
    'data-product-surface',
    'approvals.admin'
  );
  await expect(
    header.getByTestId('shell-application-context').getByText('전자결재 관리', { exact: true })
  ).toBeVisible();
  const activeManagementSwitcher = page.getByTestId(
    mobile ? 'approvals-mobile-surface-switcher' : 'approvals-desktop-surface-switcher'
  );
  const managementMode = activeManagementSwitcher.getByTestId('product-surface-management-mode');
  await expect(managementMode).toBeVisible();
  await expect(
    activeManagementSwitcher.getByTestId('product-surface-work-return')
  ).toHaveAccessibleName('업무로 돌아가기: 전자결재');
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
        .getByRole('navigation', { name: '앱 영역 전환' })
        .getByTestId('product-surface-management-entry')
    ).toBeVisible();
    await expect(
      page.getByTestId('approvals-header').getByText('결재 업무', { exact: true })
    ).toHaveCount(0);
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
    const managementLink = page
      .getByTestId('approvals-mobile-surface-switcher')
      .getByTestId('product-surface-management-entry');
    await expect(managementLink).toBeVisible();
    await expect(managementLink).toHaveAccessibleName('앱 관리: 전자결재');
    await expect(managementLink.getByText('관리', { exact: true })).toBeVisible();
    await managementLink.focus();
    await expect(managementLink).toBeFocused();
    await expect(page.getByTestId('product-surface-mobile-disclosure')).toHaveCount(0);

    const drawerTrigger = page.getByRole('button', { name: '전자결재 메뉴 열기' });
    await drawerTrigger.click();
    const mobileSidebar = page.getByTestId('approvals-mobile-sidebar');
    await expect(mobileSidebar.getByRole('link', { name: '결재함', exact: true })).toBeVisible();
    await expect(mobileSidebar.getByRole('link', { name: '앱 관리', exact: true })).toHaveCount(0);
    await expect(page.locator('#dwp-main-content')).toHaveAttribute('inert', '');
    await expect(page.getByTestId('approvals-header')).toHaveAttribute('inert', '');
    await mobileSidebar.getByRole('button', { name: '탐색 메뉴 닫기' }).click();
    await expect(drawerTrigger).toBeFocused();
    await expect(page.locator('#dwp-main-content')).not.toHaveAttribute('inert', '');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await managementLink.click();
    const contextRail = page.getByTestId('shell-mobile-context-rail');
    await expect(contextRail).toBeVisible();
    await expect(
      contextRail.getByTestId('product-surface-work-return').getByText('업무', { exact: true })
    ).toBeVisible();
    await expect(contextRail.getByTestId('product-surface-context-bar')).toHaveAttribute(
      'data-placement',
      'mobile-rail'
    );
    await expect(
      contextRail.getByText('SKAX · 범위: 전자결재 운영 범위', { exact: true })
    ).toBeVisible();
    await expect(contextRail.getByTestId('product-surface-revalidation-status')).toBeVisible();
    const [headerBox, mainPaddingTop] = await Promise.all([
      page.getByTestId('approvals-header').boundingBox(),
      page
        .locator('#dwp-main-content')
        .evaluate((element) => Number.parseFloat(getComputedStyle(element).paddingTop)),
    ]);
    expect(Math.abs(mainPaddingTop - (headerBox?.height ?? 0))).toBeLessThanOrEqual(1);
    await page.goBack();
    if (viewport.width <= 360) {
      const workRail = page.getByTestId('shell-mobile-context-rail');
      await expect(workRail).toBeVisible();
      await expect(workRail.getByTestId('product-surface-management-entry')).toBeVisible();
    } else {
      await expect(page.getByTestId('shell-mobile-context-rail')).toHaveCount(0);
      await expect(
        page
          .getByTestId('approvals-mobile-surface-switcher')
          .getByTestId('product-surface-management-entry')
      ).toBeVisible();
    }
    await expect(page.getByTestId('shell-application-context')).toBeVisible();
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
  const textZoomManagementLink = page
    .getByTestId('approvals-mobile-surface-switcher')
    .getByTestId('product-surface-management-entry');
  await expect(textZoomManagementLink).toBeVisible();
  await expect(textZoomManagementLink).toHaveAccessibleName('앱 관리: 전자결재');
  await expect(textZoomManagementLink.getByText('관리', { exact: true })).toBeVisible();
  await expect(page.getByTestId('product-surface-mobile-disclosure')).toHaveCount(0);
  const textZoomOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(textZoomOverflow).toBeLessThanOrEqual(1);
  const accessibility = await new AxeBuilder({ page }).include('header').include('main').analyze();
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

test('320px 관리 Context Rail은 단일 Scope와 읽기 전용·재확인 상태를 숨기지 않는다', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', '모바일 관리 Context Rail 전용 검증');
  await page.setViewportSize({ width: 320, height: 720 });
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'APPROVAL_OPERATOR'], {
    locale: 'ko',
    permissions: APPROVAL_ADMIN_PERMISSIONS,
  });
  await mockApprovalProductSurfaceAuthority(page, {
    work: true,
    management: true,
    managementReadOnly: true,
  });

  await page.goto('/approvals/home');
  const workSurface = page.locator('#dwp-main-content');
  await expect(workSurface.getByRole('heading', { name: '전자결재', level: 1 })).toBeVisible();
  await expect(page).toHaveScreenshot('approvals-governed-work-both-320.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: false,
    maxDiffPixelRatio: 0.002,
  });
  await page
    .getByTestId('approvals-mobile-surface-switcher')
    .getByTestId('product-surface-management-entry')
    .click();
  await expect(page.getByRole('heading', { name: '결재 운영 개요', level: 1 })).toBeVisible();
  const contextRail = page.getByTestId('shell-mobile-context-rail');
  await expect(contextRail).toBeVisible();
  const workReturn = contextRail.getByTestId('product-surface-work-return');
  const workReturnLabel = workReturn.getByText('업무', { exact: true });
  await expect(workReturnLabel).toBeVisible();
  expect(await workReturnLabel.boundingBox()).not.toBeNull();
  await expect(
    contextRail.getByText('SKAX · 범위: 전자결재 운영 범위', { exact: true })
  ).toBeVisible();
  await expect(contextRail.getByTestId('product-surface-read-only-status')).toBeVisible();
  await expect(contextRail.getByTestId('product-surface-read-only-status')).toHaveAccessibleName(
    '읽기 전용'
  );
  await expect(contextRail.getByTestId('product-surface-revalidation-status')).toBeVisible();
  expect(
    await contextRail.evaluate((element) => element.scrollWidth - element.clientWidth)
  ).toBeLessThanOrEqual(1);
  await expect(page).toHaveScreenshot('approvals-governed-management-both-320.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: false,
    maxDiffPixelRatio: 0.002,
  });
  await page.emulateMedia({ forcedColors: 'active' });
  await page.getByRole('button', { name: '전자결재 메뉴 열기' }).click();
  const currentNavigation = page
    .getByTestId('approvals-mobile-sidebar')
    .getByRole('link', { name: '운영 개요', exact: true });
  await expect(currentNavigation).toHaveAttribute('aria-current', 'page');
  expect(
    await currentNavigation.evaluate((element) => ({
      style: getComputedStyle(element).outlineStyle,
      width: getComputedStyle(element).outlineWidth,
    }))
  ).toEqual({ style: 'solid', width: '2px' });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

for (const scenario of [
  {
    locale: 'ko' as const,
    compactLabel: '5분 이내',
    accessibleLabel: '5분 이내에 관리 권한을 다시 확인합니다',
  },
  {
    locale: 'en' as const,
    compactLabel: '≤5 min',
    accessibleLabel: 'Management access will be revalidated within 5 minutes',
  },
]) {
  test(`320px ${scenario.locale} 관리 권한 임박 경고는 forced-colors에서도 짧은 시각 라벨을 유지한다`, async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', '모바일 권한 임박 경고 전용 검증');
    await page.setViewportSize({ width: 320, height: 720 });
    await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
    await mockShellSession(page, ['APPROVAL_OPERATOR'], {
      locale: scenario.locale,
      permissions: APPROVAL_ADMIN_PERMISSIONS,
    });
    await mockApprovalProductSurfaceAuthority(page, {
      work: false,
      management: true,
      generatedAt: '2026-08-24T00:00:00Z',
      revalidateAt: '2026-08-24T00:04:00Z',
    });

    await page.goto('/approvals/admin/overview');
    const rail = page.getByTestId('shell-mobile-context-rail');
    const expiry = rail.getByTestId('product-surface-expiry-status');
    await expect(expiry).toBeVisible();
    await expect(expiry.getByText(scenario.compactLabel, { exact: true })).toBeVisible();
    await expect(expiry).toHaveAccessibleName(scenario.accessibleLabel);
    expect(
      await expiry.evaluate((element) => ({
        borderStyle: getComputedStyle(element).borderTopStyle,
        borderWidth: getComputedStyle(element).borderTopWidth,
      }))
    ).toEqual({ borderStyle: 'solid', borderWidth: '1px' });
    expect(
      await rail.evaluate((element) => element.scrollWidth - element.clientWidth)
    ).toBeLessThanOrEqual(1);
    const accessibility = await new AxeBuilder({ page }).include('header').analyze();
    expect(
      accessibility.violations.filter(
        (violation) => violation.impact === 'critical' || violation.impact === 'serious'
      )
    ).toEqual([]);
  });
}

test('1024px 관리 Context Rail은 읽기 전용·재확인 상태를 텍스트로 식별한다', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', '태블릿 관리 Context Rail 전용 검증');
  await page.setViewportSize({ width: 1024, height: 768 });
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'APPROVAL_OPERATOR'], {
    locale: 'ko',
    permissions: APPROVAL_ADMIN_PERMISSIONS,
  });
  await mockApprovalProductSurfaceAuthority(page, {
    work: true,
    management: true,
    managementReadOnly: true,
  });

  await page.goto('/approvals/admin/overview');
  await expect(page.getByRole('heading', { name: '결재 운영 개요', level: 1 })).toBeVisible();
  const header = page.getByTestId('approvals-header');
  const contextRail = header.getByTestId('shell-mobile-context-rail');
  await expect(contextRail).toBeVisible();
  await expect(contextRail.getByTestId('product-surface-read-only-status')).toContainText(
    '읽기 전용'
  );
  await expect(contextRail.getByTestId('product-surface-revalidation-status')).toContainText(
    '접근 재확인'
  );
  const [headerBox, mainPaddingTop, railOverflow, pageOverflow] = await Promise.all([
    header.boundingBox(),
    page
      .locator('#dwp-main-content')
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).paddingTop)),
    contextRail.evaluate((element) => element.scrollWidth - element.clientWidth),
    page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    ),
  ]);
  expect(Math.abs(mainPaddingTop - (headerBox?.height ?? 0))).toBeLessThanOrEqual(1);
  expect(railOverflow).toBeLessThanOrEqual(1);
  expect(pageOverflow).toBeLessThanOrEqual(1);
  await expect(page).toHaveScreenshot('approvals-governed-management-read-only-1024.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: false,
    maxDiffPixelRatio: 0.002,
  });
});

for (const scenario of [
  {
    locale: 'ko' as const,
    scope:
      '글로벌 엔터프라이즈 조달·규제·재무 결재 운영 범위 — 아시아 태평양 및 유럽 본사 통합 관리 책임',
    mobilePrefix: 'SKAX · 범위',
    desktopPrefix: '관리 범위',
  },
  {
    locale: 'en' as const,
    scope:
      'Global Enterprise Procurement and Regulatory Approval Operations — Asia Pacific and European Headquarters',
    mobilePrefix: 'SKAX · Scope',
    desktopPrefix: 'Management scope',
  },
]) {
  test(`장문 단일 Scope ${scenario.locale} 전체명은 1024·1536px·200%에서 키보드와 터치로 확인된다`, async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', '장문 Scope 데스크톱·태블릿 전용 검증');
    await mockShellSession(page, ['APPROVAL_OPERATOR'], {
      locale: scenario.locale,
      permissions: APPROVAL_ADMIN_PERMISSIONS,
    });
    await mockApprovalProductSurfaceAuthority(page, {
      work: false,
      management: true,
      managementScopeDisplayName: scenario.scope,
    });

    const verifyDisclosure = async (
      placement: 'mobile-rail' | 'header',
      prefix: string,
      expectClipped: boolean
    ) => {
      const contextBar = page.locator(
        `[data-testid="product-surface-context-bar"][data-placement="${placement}"]`
      );
      const scope = contextBar.getByTestId('product-surface-single-scope');
      const fullLabel = `${prefix}: ${scenario.scope}`;
      await expect(scope).toBeVisible();
      await expect(scope).toHaveAccessibleName(fullLabel);
      await expect(scope).toHaveCSS('text-overflow', 'ellipsis');
      if (expectClipped) {
        expect(await scope.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
          true
        );
      }

      await scope.focus();
      await expect(scope).toBeFocused();
      await expect(page.getByRole('tooltip')).toHaveText(fullLabel);
      await scope.press('Escape');
      await expect(page.getByRole('tooltip')).toHaveCount(0);
      await scope.click();
      await expect(page.getByRole('tooltip')).toHaveText(fullLabel);
      await page.locator('#dwp-main-content').focus();
      await expect(page.getByRole('tooltip')).toHaveCount(0);
    };

    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/approvals/admin/overview');
    await verifyDisclosure('mobile-rail', scenario.mobilePrefix, false);

    await page.setViewportSize({ width: 1536, height: 900 });
    await verifyDisclosure('header', scenario.desktopPrefix, true);
    await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
    await verifyDisclosure('header', scenario.desktopPrefix, true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      )
    ).toBeLessThanOrEqual(1);
  });
}

test('1280·1440px 관리 헤더는 권한 상태와 lazy 로딩 배치를 안정적으로 보존한다', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', '데스크톱 관리 Context 헤더 전용 검증');
  await page.setViewportSize({ width: 1280, height: 800 });
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'APPROVAL_OPERATOR'], {
    locale: 'ko',
    permissions: APPROVAL_ADMIN_PERMISSIONS,
  });
  await mockApprovalProductSurfaceAuthority(page, {
    work: true,
    management: true,
    managementReadOnly: true,
  });

  const chunkRequested = deferred();
  const releaseChunk = deferred();
  await page.route('**/src/components/product-surface-controls.tsx*', async (route) => {
    chunkRequested.resolve();
    await releaseChunk.promise;
    await route.continue();
  });

  const navigation = page.goto('/approvals/admin/overview');
  await chunkRequested.promise;
  const header = page.getByTestId('approvals-header');
  const loading = header.locator('[data-testid="product-surface-context-bar-loading"]:visible');
  await expect(loading).toBeVisible();
  const [applicationBefore, actionsBefore] = await Promise.all([
    header.getByTestId('shell-application-context').boundingBox(),
    header.getByTestId('shell-global-actions').boundingBox(),
  ]);

  releaseChunk.resolve();
  await navigation;
  const contextBar = header.locator('[data-testid="product-surface-context-bar"]:visible');
  await expect(contextBar).toHaveAttribute('data-placement', 'header');
  await expect(contextBar.getByTestId('product-surface-read-only-status')).toContainText(
    '읽기 전용'
  );
  await expect(contextBar.getByTestId('product-surface-revalidation-status')).toContainText(
    '접근 재확인'
  );
  const [applicationAfter, actionsAfter] = await Promise.all([
    header.getByTestId('shell-application-context').boundingBox(),
    header.getByTestId('shell-global-actions').boundingBox(),
  ]);
  expect(Math.abs((applicationAfter?.x ?? 0) - (applicationBefore?.x ?? 0))).toBeLessThanOrEqual(1);
  expect(Math.abs((actionsAfter?.x ?? 0) - (actionsBefore?.x ?? 0))).toBeLessThanOrEqual(1);

  for (const width of [1280, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await expect(contextBar.getByTestId('product-surface-read-only-status')).toBeVisible();
    await expect(contextBar.getByTestId('product-surface-revalidation-status')).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      )
    ).toBeLessThanOrEqual(1);
  }

  const accessibility = await new AxeBuilder({ page }).include('header').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
});

test('관리 Context 청크 1회 실패는 명시적 재로드로 같은 URL에서 안전하게 복구한다', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', '모바일 관리 Context 복구 전용 검증');
  await page.setViewportSize({ width: 320, height: 720 });
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'APPROVAL_OPERATOR'], {
    locale: 'ko',
    permissions: APPROVAL_ADMIN_PERMISSIONS,
  });
  await mockApprovalProductSurfaceAuthority(page, {
    work: true,
    management: true,
    managementReadOnly: true,
  });

  let chunkRequests = 0;
  await page.route('**/src/components/product-surface-controls.tsx*', async (route) => {
    chunkRequests += 1;
    if (chunkRequests === 1) {
      await route.abort('failed');
      return;
    }
    await route.continue();
  });

  await page.goto('/approvals/admin/overview?scope=scope%3Aapprovals%3Atenant');
  const recovery = page.locator('[data-testid="product-surface-context-bar-recovery"]:visible');
  await expect(recovery).toBeVisible();
  await expect(recovery.getByRole('alert')).toContainText('관리 컨텍스트를 불러오지 못했습니다.');
  const reload = recovery.getByRole('button', { name: '페이지 새로고침' });
  const reloadBounds = await reload.boundingBox();
  expect(reloadBounds?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(reloadBounds?.height ?? 0).toBeGreaterThanOrEqual(44);

  await reload.click();
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === '/approvals/admin/overview' &&
      url.searchParams.get('scope') === 'scope:approvals:tenant'
  );
  await expect(page.getByTestId('product-surface-context-bar-recovery')).toHaveCount(0);
  const contextRail = page.getByTestId('shell-mobile-context-rail');
  await expect(contextRail.getByText(/범위: 전자결재 운영 범위/u)).toBeVisible();
  expect(chunkRequests).toBeGreaterThanOrEqual(2);
  expect(
    await contextRail.evaluate((element) => element.scrollWidth - element.clientWidth)
  ).toBeLessThanOrEqual(1);
  const accessibility = await new AxeBuilder({ page }).include('header').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
});

test('320px management-only read-only 관리 rail은 tenant·scope·상태를 보존한다', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', '모바일 관리 Context Rail 전용 검증');
  await page.setViewportSize({ width: 320, height: 720 });
  await mockShellSession(page, ['APPROVAL_OPERATOR'], {
    locale: 'ko',
    permissions: APPROVAL_ADMIN_PERMISSIONS,
  });
  await mockApprovalProductSurfaceAuthority(page, {
    work: false,
    management: true,
    managementReadOnly: true,
  });

  await page.goto('/approvals/admin/overview');
  await expect(page.getByRole('heading', { name: '결재 운영 개요', level: 1 })).toBeVisible();
  const contextRail = page.getByTestId('shell-mobile-context-rail');
  await expect(contextRail).toBeVisible();
  await expect(contextRail.getByTestId('product-surface-work-return')).toHaveCount(0);
  await expect(
    contextRail.getByText('SKAX · 범위: 전자결재 운영 범위', { exact: true })
  ).toBeVisible();
  await expect(contextRail.getByTestId('product-surface-read-only-status')).toBeVisible();
  await expect(contextRail.getByTestId('product-surface-revalidation-status')).toBeVisible();
  const [headerBox, mainPaddingTop, railOverflow] = await Promise.all([
    page.getByTestId('approvals-header').boundingBox(),
    page
      .locator('#dwp-main-content')
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).paddingTop)),
    contextRail.evaluate((element) => element.scrollWidth - element.clientWidth),
  ]);
  expect(Math.abs(mainPaddingTop - (headerBox?.height ?? 0))).toBeLessThanOrEqual(1);
  expect(railOverflow).toBeLessThanOrEqual(1);
  await expect(page).toHaveScreenshot('approvals-governed-management-only-read-only-320.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: false,
    maxDiffPixelRatio: 0.002,
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
  await page
    .getByTestId('approvals-mobile-surface-switcher')
    .getByTestId('product-surface-management-entry')
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
    page
      .getByTestId('approvals-header')
      .locator('[data-testid="product-surface-context-bar"][data-placement="header"]')
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
  const surfaceNavigation = mobile
    ? page.getByTestId('approvals-mobile-surface-switcher')
    : page.getByTestId('approvals-desktop-surface-switcher');
  const managementEntry = surfaceNavigation.getByTestId('product-surface-management-entry');
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
  const scopeSelector = page
    .locator('[data-testid="product-surface-context-bar"][data-placement="header"]')
    .getByRole('combobox', { name: '관리 범위' });
  const mobileScopeTrigger = page
    .locator('[data-testid="product-surface-context-bar"][data-placement="mobile-rail"]')
    .getByRole('button', { name: '관리 범위: 전자결재 운영 B' });
  if ((await responsiveControlKind(scopeSelector, mobileScopeTrigger)) === 'desktop') {
    await scopeSelector.selectOption({ label: '전자결재 운영 A' });
  } else {
    await mobileScopeTrigger.click();
    const dialog = page.getByRole('dialog', { name: '허용된 관리 범위 선택' });
    await dialog.getByRole('combobox', { name: '관리 범위' }).click();
    await page.getByRole('option', { name: '전자결재 운영 A' }).click();
    await dialog.getByRole('button', { name: '관리 범위 선택' }).click();
  }
  await expect(page).toHaveURL((url) => url.searchParams.get('scope') === 'S1');
  const selectedMobileScopeTrigger = page
    .locator('[data-testid="product-surface-context-bar"][data-placement="mobile-rail"]')
    .getByRole('button', { name: '관리 범위: 전자결재 운영 A' });
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
    const restoredDesktopScope = page
      .locator('[data-testid="product-surface-context-bar"][data-placement="header"]')
      .getByRole('combobox', { name: '관리 범위' });
    const restoredMobileScope = page
      .locator('[data-testid="product-surface-context-bar"][data-placement="mobile-rail"]')
      .getByRole('button', { name: '관리 범위: 전자결재 운영 B' });
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

test('surface UI flag off는 canonical URL과 기존 호환 shell을 유지한다', async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name === 'mobile';
  if (mobile) await page.setViewportSize({ width: 320, height: 720 });
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'APPROVAL_OPERATOR'], {
    locale: 'ko',
    permissions: APPROVAL_ADMIN_PERMISSIONS,
  });
  await mockApprovalProductSurfaceAuthority(page, { surfaceUi: false });

  await page.goto('/approvals/admin/forms?view=published#catalog');

  await expect(page).toHaveURL(/\/approvals\/admin\/forms\?view=published#catalog$/u);
  await expect(page.getByRole('heading', { name: '양식 카탈로그', level: 1 })).toBeVisible();
  await expect(page.getByTestId('product-surface-context-bar')).toHaveCount(0);
  if (mobile) {
    const rail = page.getByTestId('shell-mobile-context-rail');
    await expect(rail.getByTestId('product-surface-compatibility-tenant')).toHaveText('SKAX');
    await expect(rail.getByTestId('product-surface-read-only-status')).toHaveCount(0);
    await expect(rail.getByTestId('product-surface-revalidation-status')).toHaveCount(0);
    expect(
      await rail.evaluate((element) => element.scrollWidth - element.clientWidth)
    ).toBeLessThanOrEqual(1);

    await page.goto('/approvals/admin/overview');
    await expect(
      page
        .getByTestId('shell-mobile-context-rail')
        .getByTestId('product-surface-compatibility-tenant')
    ).toHaveText('SKAX');
  }
});
