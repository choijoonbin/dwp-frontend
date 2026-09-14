import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mockShellSession } from './support/shell-session';
import { APPROVAL_MEMBER_PERMISSIONS } from './support/approval-command-center-fixtures';
import { mockApprovalProductSurfaceAuthority } from './support/product-surface-authority';

// This verifies the actual installed registry's unavailable path. Positive V9
// workspace writes are separately gated on the sealed registry, not simulated
// by replacing the browser's generated authorization module.
for (const mode of ['light', 'dark', 'forced'] as const) {
  test(`양식 버전 작업 공간 ${mode}: 미설치/조회 불가 상태는 읽기 전용이며 신규 명령 HTTP0`, async ({
    page,
    isMobile,
  }, testInfo) => {
    await mockShellSession(page, ['WORKSPACE_MEMBER', 'APPROVAL_DESIGNER'], {
      locale: 'ko',
      permissions: [
        ...APPROVAL_MEMBER_PERMISSIONS,
        ...['VIEW', 'CREATE', 'UPDATE', 'APPROVE'].map((permissionCode) => ({
          resourceType: 'ADMIN',
          resourceKey: 'ADMIN.APPROVAL_DESIGN',
          permissionCode,
          effect: 'ALLOW' as const,
        })),
      ],
    });
    await mockApprovalProductSurfaceAuthority(page, { surfaceUi: false });
    await page.emulateMedia({
      colorScheme: mode === 'dark' ? 'dark' : 'light',
      forcedColors: mode === 'forced' ? 'active' : 'none',
      reducedMotion: 'reduce',
    });
    if (isMobile) await page.setViewportSize({ width: 320, height: 844 });
    const commands: string[] = [];
    await page.route(
      (url) =>
        /\/admin\/forms\/[^/]+\/(?:working-draft|versions|diff|publish-review|publish-reviewed|retire|reinstate)(?:\/|$)/u.test(
          url.pathname
        ),
      (route) => {
        if (route.request().method() !== 'GET') commands.push(route.request().url());
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'ERROR',
            errorCode: 'TEMPORARY_UNAVAILABLE',
            message: 'Workspace source unavailable',
          }),
        });
      }
    );
    await page.goto('/approvals/admin/forms');
    await expect(page.getByRole('heading', { name: '양식 카탈로그', level: 1 })).toBeVisible();
    if (isMobile)
      await page.getByRole('button').filter({ hasText: '데이터 접근 예외 신청서' }).click();
    const workspace = page.getByRole('region', { name: '양식 버전 작업 공간' });
    await expect(workspace).toBeVisible();
    await expect(
      workspace.getByText('버전 정보를 확인하지 못했습니다.', { exact: true })
    ).toBeVisible();
    await expect(workspace.getByRole('button', { name: '작업 초안 편집' })).toHaveCount(0);
    await expect(workspace.getByRole('button', { name: '발행 검토' })).toHaveCount(0);
    await expect(workspace.getByRole('button', { name: '카탈로그에서 사용 중지' })).toHaveCount(0);
    const reload = workspace.getByRole('button', { name: '작업 공간 새로고침' });
    if (await reload.isEnabled()) await reload.click();
    await expect(
      workspace.getByText('버전 정보를 확인하지 못했습니다.', { exact: true })
    ).toBeVisible();
    expect(commands).toEqual([]);
    // 200% text is tested on the genuine page without hiding tooltips or alerts.
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1
    );
    expect(overflow).toBe(false);
    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations).toEqual([]);
    await testInfo.attach(`workspace-${mode}-${isMobile ? '320px' : 'desktop'}`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });
}
