import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mockShellSession } from './support/shell-session';
import { APPROVAL_MEMBER_PERMISSIONS } from './support/approval-command-center-fixtures';
import { mockApprovalProductSurfaceAuthority } from './support/product-surface-authority';

async function signatureSource(page: Page) {
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'APPROVAL_AUDITOR'], {
    locale: 'ko',
    permissions: [
      ...APPROVAL_MEMBER_PERMISSIONS,
      {
        resourceType: 'ADMIN',
        resourceKey: 'ADMIN.APPROVAL_SIGNATURE',
        permissionCode: 'VIEW',
        effect: 'ALLOW',
      },
    ],
  });
  await mockApprovalProductSurfaceAuthority(page, { surfaceUi: false });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const state = {
    status: 0,
    code: '',
    reads: 0,
    failures: 0,
    writes: [] as string[],
    capabilities: true,
    policyRequests: [] as string[],
  };
  await page.route(
    (url) => url.pathname.startsWith('/api/approvals/v1/admin/attachments/'),
    (route) => {
      state.policyRequests.push(`${route.request().method()} ${route.request().url()}`);
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ERROR', errorCode: 'AUTHORITY_RESOLUTION_UNAVAILABLE' }),
      });
    }
  );
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/admin/signatures',
    (route) => {
      if (route.request().method() !== 'GET') state.writes.push(route.request().url());
      state.reads += 1;
      if (state.status) state.failures += 1;
      return route.fulfill({
        status: state.status || 200,
        contentType: 'application/json',
        body: JSON.stringify(
          state.status
            ? { status: 'ERROR', errorCode: state.code, message: 'Provider source unavailable' }
            : {
                status: 'SUCCESS',
                data: [
                  {
                    providerId: '11111111-1111-4111-8111-111111111111',
                    providerKey: 'INTERNAL_ATTESTATION',
                    displayName: 'Internal current verification',
                    providerType: 'INTERNAL_ATTESTATION',
                    lifecycleState: 'ACTIVE',
                    credentialConfigured: false,
                    version: 1,
                    lastHealthCheckedAt: '2026-09-14T00:00:00Z',
                    ...(state.capabilities
                      ? {
                          capabilities: {
                            readiness: 'READY',
                            internalAttestation: true,
                            auditEvidence: true,
                            verifiedIdentity: true,
                          },
                        }
                      : {}),
                  },
                ],
              }
        ),
      });
    }
  );
  await page.goto('/approvals/admin/signatures');
  await expect(page.getByText('준비 완료', { exact: true })).toBeVisible();
  return state;
}
for (const failure of [
  { status: 403, code: 'FORBIDDEN', masked: true },
  { status: 503, code: 'AUTHORITY_RESOLUTION_UNAVAILABLE', masked: false },
  { status: 503, code: 'TEMPORARY_UNAVAILABLE', masked: false },
]) {
  test(`전자서명 첫 ${failure.status}/${failure.code}는 이전 READY를 폐기하고 새 조회로만 복구한다`, async ({
    page,
  }) => {
    const state = await signatureSource(page);
    state.status = failure.status;
    state.code = failure.code;
    await page.getByRole('button', { name: '새로고침', exact: true }).click();
    await expect(page.getByText('준비 완료', { exact: true })).toHaveCount(0);
    if (failure.masked)
      await expect(page.getByText('Internal current verification', { exact: true })).toHaveCount(0);
    else {
      await expect(page.getByText('Internal current verification', { exact: true })).toBeVisible();
      await expect(page.getByText('확인 불가', { exact: true })).toBeVisible();
    }
    // The generic 503 still has one bounded retry; authority failures have none.
    if (failure.code !== 'TEMPORARY_UNAVAILABLE') {
      await page.waitForTimeout(1100);
      expect(state.failures).toBe(1);
    }
    expect(state.writes).toEqual([]);
    expect(state.policyRequests).toEqual([]);
    state.status = 0;
    if (failure.masked) await page.getByRole('button', { name: '다시 시도', exact: true }).click();
    else {
      const refresh = page.getByRole('button', { name: '새로고침', exact: true });
      await expect(refresh).toBeEnabled();
      await refresh.click();
    }
    await expect(page.getByText('준비 완료', { exact: true })).toBeVisible();
    expect(state.writes).toEqual([]);
    expect(state.policyRequests).toEqual([]);
  });
}
test('전자서명 capabilities 누락은 현재 조회 성공이어도 UNKNOWN이며 320px·200%·고대비에 접근 가능하다', async ({
  page,
  isMobile,
}, testInfo) => {
  const state = await signatureSource(page);
  state.capabilities = false;
  await page.getByRole('button', { name: '새로고침', exact: true }).click();
  await expect(page.getByText('준비 완료', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Internal current verification', { exact: true })).toBeVisible();
  await expect(page.getByText('확인 불가', { exact: true }).first()).toBeVisible();
  if (isMobile) await page.setViewportSize({ width: 320, height: 844 });
  await page.emulateMedia({ forcedColors: 'active' });
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  ).toBe(false);
  // Keep the real refresh tooltip visible and fully settled for the audit.
  await page.getByRole('button', { name: '새로고침', exact: true }).hover();
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toHaveCSS('opacity', '1');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await testInfo.attach('signature-unknown-forced-colors', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
  expect(state.writes).toEqual([]);
  expect(state.policyRequests).toEqual([]);
});
