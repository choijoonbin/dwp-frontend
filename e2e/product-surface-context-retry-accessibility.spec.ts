import { expect, test } from '@playwright/test';

import { mockApprovalProductSurfaceAuthority } from './support/product-surface-authority';
import { failFirstAndHoldRetryProductSurfaceControlsChunk } from './support/product-surface-context-chunk';
import { mockShellSession } from './support/shell-session';

const approvalAdminPermissions = [
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

async function openCoarsePointerManagementContext(
  page: Parameters<typeof mockShellSession>[0],
  multipleScopes = false
) {
  await page.setViewportSize({ width: 1600, height: 900 });
  await mockShellSession(page, ['APPROVAL_OPERATOR'], {
    locale: 'ko',
    permissions: approvalAdminPermissions,
  });
  await mockApprovalProductSurfaceAuthority(page, {
    work: false,
    management: true,
    managementScopes: multipleScopes ? 'two-no-default' : 'default',
  });
  await page.goto(`/approvals/admin/overview${multipleScopes ? '?scope=S2' : ''}`);
  expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
  return page
    .getByTestId('approvals-header')
    .locator('[data-testid="product-surface-context-bar"][data-placement="header"]');
}

test('coarse-pointer 관리 header의 단일 Scope가 44px 조작 영역을 유지한다', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'coarse-pointer header 전용 검증');
  const context = await openCoarsePointerManagementContext(page);
  const scope = context.getByTestId('product-surface-single-scope');
  await expect(scope).toBeVisible();
  const bounds = await scope.boundingBox();
  expect(bounds?.height ?? 0).toBeGreaterThanOrEqual(44);
});

test('coarse-pointer 관리 header의 복수 Scope 선택기가 44px 조작 영역을 유지한다', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'coarse-pointer header 전용 검증');
  const context = await openCoarsePointerManagementContext(page, true);
  const scope = context.getByRole('combobox', { name: '관리 범위' });
  await expect(scope).toBeVisible();
  const bounds = await scope.boundingBox();
  expect(bounds?.height ?? 0).toBeGreaterThanOrEqual(44);
});

test('관리 Context 재시도 중 사용자가 옮긴 포커스를 복구 완료가 가로채지 않는다', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', '모바일 Context 포커스 전이 전용 검증');
  await page.setViewportSize({ width: 320, height: 720 });
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'APPROVAL_OPERATOR'], {
    locale: 'ko',
    permissions: approvalAdminPermissions,
  });
  await mockApprovalProductSurfaceAuthority(page, {
    work: true,
    management: true,
    managementReadOnly: true,
  });
  const chunk = await failFirstAndHoldRetryProductSurfaceControlsChunk(page);

  await page.goto('/approvals/admin/overview');
  const retry = page
    .locator('[data-testid="product-surface-context-bar-recovery"]:visible')
    .getByRole('button', { name: '다시 시도' });
  await retry.focus();
  await retry.press('Enter');
  await chunk.retryRequested.promise;

  const search = page.locator('[data-shell-global-action="search"] button:visible');
  await search.focus();
  await expect(search).toBeFocused();
  chunk.releaseRetry.resolve();

  const contextRail = page.getByTestId('shell-mobile-context-rail');
  const restoredContext = contextRail.getByTestId('product-surface-context-bar');
  await expect(restoredContext).toBeVisible();
  await expect.poll(chunk.requests).toBeGreaterThanOrEqual(2);
  await expect(search).toBeFocused();
  await expect(restoredContext).not.toBeFocused();
  await expect(
    contextRail
      .getByTestId('product-surface-context-bar-recovery-status')
      .filter({ hasText: '제품 접근 컨텍스트를 복구했습니다.' })
  ).toHaveText('제품 접근 컨텍스트를 복구했습니다.');
});
