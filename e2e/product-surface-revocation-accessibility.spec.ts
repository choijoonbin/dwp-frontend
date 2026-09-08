import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  broadcastProductSurfaceRevision,
  mockApprovalProductSurfaceAuthority,
} from './support/product-surface-authority';
import { mockShellSession } from './support/shell-session';

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

async function approvalNavigation(page: Page): Promise<Locator> {
  if ((page.viewportSize()?.width ?? 1280) >= 1200) {
    const navigation = page.getByTestId('approvals-sidebar');
    await expect(navigation).toBeVisible();
    return navigation;
  }

  await page.getByRole('button', { name: /전자결재 메뉴 열기|Open approval navigation/u }).click();
  const navigation = page.getByTestId('approvals-mobile-sidebar');
  await expect(navigation).toBeVisible();
  return navigation;
}

async function expectAnnouncedFocusedState(page: Page, heading: string, description: string) {
  const accessState = page.getByTestId('product-surface-access-state');
  await expect(page.getByTestId('approvals-shell')).toHaveCount(0);
  const stateHeading = accessState.getByRole('heading', { name: heading, level: 1 });
  await expect(stateHeading).toBeVisible();
  await expect(stateHeading).toBeFocused();
  await expect(accessState).toContainText(description);
  await expect(accessState.getByRole('status')).toHaveAttribute('aria-live', 'polite');
}

async function expectAnnouncedFocusedRouteState(page: Page, heading: string) {
  const accessState = page.getByTestId('product-surface-access-state');
  await expect(page.getByTestId('approvals-shell')).toBeVisible();
  await expect(page.locator('main#dwp-main-content')).toHaveCount(1);
  await expect(accessState.locator('main')).toHaveCount(0);
  const stateHeading = accessState.getByRole('heading', { name: heading, level: 2 });
  await expect(stateHeading).toBeVisible();
  await expect(stateHeading).toBeFocused();
  await expect(accessState.getByRole('status')).toHaveAttribute('aria-live', 'polite');
}

test('관리 권한 회수는 제거된 focused control을 한국어 관리 상태 H1로 인계한다', async ({
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
  const focusedLink = (await approvalNavigation(page)).getByRole('link', {
    name: '프로세스 설계',
    exact: true,
  });
  await focusedLink.focus();
  await expect(focusedLink).toBeFocused();
  authority.revoke('approvals.admin');
  await broadcastProductSurfaceRevision(page, authority.revision());

  await expectAnnouncedFocusedState(
    page,
    '이 관리 영역이 할당되지 않았습니다',
    '제품 책임과 해당 관리 업무의 정확한 권한이 필요합니다.'
  );
});

test('Work 권한 회수는 제거된 focused control을 영어 업무 상태 H1로 인계한다', async ({ page }) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], { locale: 'en', permissions: [] });
  const authority = await mockApprovalProductSurfaceAuthority(page, {
    work: true,
    management: false,
  });

  await page.goto('/approvals/home');
  const focusedLink = (await approvalNavigation(page)).getByTestId(
    'approvals-navigation-item-inbox'
  );
  await focusedLink.focus();
  await expect(focusedLink).toBeFocused();
  authority.revoke('approvals.work');
  await broadcastProductSurfaceRevision(page, authority.revision());

  await expectAnnouncedFocusedState(
    page,
    'This work area is not assigned',
    "Your current account needs access to this product's work area."
  );
});

test('관리 PAGE 권한 회수는 shell을 유지하고 제거된 navigation focus를 상태 H2로 인계한다', async ({
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

  await page.goto('/approvals/admin/workflows');
  const focusedLink = (await approvalNavigation(page)).getByRole('link', {
    name: '프로세스 설계',
    exact: true,
  });
  await focusedLink.focus();
  await expect(focusedLink).toBeFocused();
  authority.revokeCapability('approvals.admin', 'approvals.design.read');
  await broadcastProductSurfaceRevision(page, authority.revision());

  await expect(focusedLink).toHaveCount(0);
  await expectAnnouncedFocusedRouteState(page, '이 페이지는 현재 접근 범위 밖입니다');
});

test('Work PAGE 권한 회수는 shell을 유지하고 제거된 navigation focus를 상태 H2로 인계한다', async ({
  page,
}) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], { locale: 'en', permissions: [] });
  const authority = await mockApprovalProductSurfaceAuthority(page, {
    work: true,
    management: false,
  });

  await page.goto('/approvals/inbox');
  const focusedLink = (await approvalNavigation(page)).getByTestId(
    'approvals-navigation-item-inbox'
  );
  await focusedLink.focus();
  await expect(focusedLink).toBeFocused();
  authority.revokeCapability('approvals.work', 'approvals.work.task.read');
  await broadcastProductSurfaceRevision(page, authority.revision());

  await expect(focusedLink).toHaveCount(0);
  await expectAnnouncedFocusedRouteState(page, 'This page is outside your access');
});

test('권한 회수는 제품 shell 밖의 연결된 focus를 훔치지 않는다', async ({ page }) => {
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
  const persistentSkipLink = page.getByRole('link', { name: '본문으로 건너뛰기' });
  await persistentSkipLink.focus();
  await expect(persistentSkipLink).toBeFocused();
  authority.revoke('approvals.admin');
  await broadcastProductSurfaceRevision(page, authority.revision());

  await expect(
    page.getByRole('heading', { name: '이 관리 영역이 할당되지 않았습니다', level: 1 })
  ).toBeVisible();
  await expect(persistentSkipLink).toBeFocused();
});

test('일반 Surface 이동 뒤 back으로 돌아온 deny는 과거 shell focus를 소비하지 않는다', async ({
  page,
}) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'APPROVAL_OPERATOR'], {
    locale: 'ko',
    permissions: APPROVAL_ADMIN_PERMISSIONS,
  });
  const authority = await mockApprovalProductSurfaceAuthority(page, {
    work: true,
    management: true,
  });

  await page.goto('/approvals/admin/overview');
  await page.locator('[data-testid="product-surface-work-return"]:visible').click();
  await expect(page).toHaveURL(/\/approvals\/home(?:\?.*)?$/u);
  authority.revoke('approvals.admin');
  await broadcastProductSurfaceRevision(page, authority.revision());
  await page.goBack();

  const stateHeading = page.getByRole('heading', {
    name: '이 관리 영역이 할당되지 않았습니다',
    level: 1,
  });
  await expect(stateHeading).toBeVisible();
  await expect(stateHeading).not.toBeFocused();
});

for (const failure of ['abort', 'http-503'] as const) {
  test(`초기 권한 ${failure}는 skip-link 대상 main과 단일 H1을 유지한다`, async ({ page }) => {
    await mockShellSession(page, ['WORKSPACE_MEMBER', 'APPROVAL_OPERATOR'], {
      locale: 'ko',
      permissions: APPROVAL_ADMIN_PERMISSIONS,
    });
    await mockApprovalProductSurfaceAuthority(page, { work: true, management: true });
    await page.route('**/api/auth/product-surface-contexts', (route) =>
      failure === 'abort'
        ? route.abort('failed')
        : route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ status: 'ERROR', errorCode: 'SERVICE_UNAVAILABLE' }),
          })
    );

    await page.goto('/approvals/admin/overview');

    const main = page.locator('main#dwp-main-content');
    await expect(main).toHaveCount(1);
    await expect(main.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(main.getByRole('alert')).toContainText('현재 접근 권한을 확인할 수 없습니다');
    const skipLink = page.getByRole('link', { name: '본문으로 건너뛰기' });
    await skipLink.focus();
    await skipLink.press('Enter');
    await expect(main).toBeFocused();
  });
}
