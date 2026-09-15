import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

import { mockShellSession } from './support/shell-session';
import { mockApprovalProductSurfaceAuthority } from './support/product-surface-authority';
import { APPROVAL_POLICIES_FIXTURE } from './support/product-area-approval-fixtures';

async function capture(target: Page | Locator, name: string, testInfo: TestInfo) {
  const path = testInfo.outputPath(`${name}.png`);
  await target.screenshot({ path });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}

// Canonical V14 UI fixture evidence, not a live Auth/Approval deployment claim.
async function setup(page: Page, mode: 'light' | 'dark' | 'forced') {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: [],
    appearance: {
      mode: mode === 'dark' ? 'dark' : 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
  await mockApprovalProductSurfaceAuthority(page, { decisionRevisionFormat: 'sha256' });
  const policies = ['SEGREGATION_OF_DUTIES', 'SLA', 'DATA', 'DECISION', 'DECISION'].map(
    (policyType, index) => ({
      ...APPROVAL_POLICIES_FIXTURE[0],
      policyId: `11111111-1111-4111-8111-11111111111${index + 1}`,
      policyKey: `POLICY_CONTROL_${index + 1}`,
      policyType,
      nameKo:
        index === 0
          ? '고위험 결재 요청자 자기승인 금지 및 직무분리 정책'
          : `${index + 1}번째 결재 통제 정책`,
      nameEn:
        index === 0
          ? 'High-risk requester self-approval and segregation control'
          : `Approval control ${index + 1}`,
      enforcementMode: index < 2 ? 'BLOCK' : 'WARN',
      lifecycleState: index === 4 ? 'DISABLED' : 'ACTIVE',
      rule: { requesterCannotDecide: false },
      pendingReview: index === 0,
      pendingEnforcementMode: index === 0 ? 'BLOCK' : null,
      pendingSeverity: index === 0 ? 'CRITICAL' : null,
      pendingLifecycleState: index === 0 ? 'ACTIVE' : null,
      pendingRule: index === 0 ? { requesterCannotDecide: true } : {},
      pendingBy: index === 0 ? 31 : null,
      pendingAt: index === 0 ? '2026-09-14T00:00:00Z' : null,
      pendingChangeReason:
        index === 0 ? '자기승인 통제 강화에 대한 실제 변경 사유와 검토 요청입니다.' : null,
    })
  );
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/admin/policies',
    (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ status: 'SUCCESS', data: policies }),
      })
  );
  await page.route(
    (url) => /^\/api\/approvals\/v1\/admin\/policies\/[^/]+\/versions$/u.test(url.pathname),
    (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ status: 'SUCCESS', data: [] }),
      })
  );
  await page.goto('/approvals/admin/policies');
  await expect(page.getByRole('region', { name: '검토 및 게시 권한', exact: true })).toBeVisible();
  return policies;
}

for (const mode of ['light', 'dark', 'forced'] as const) {
  test(`APR15 ${mode}: 실제 목록 수치와 현재/변경 비교, 우측 검토·영향·이력을 원본 구조로 표시한다`, async ({
    page,
    isMobile,
  }, testInfo) => {
    await page.setViewportSize({ width: isMobile ? 320 : 1440, height: 960 });
    await page.emulateMedia({
      colorScheme: mode === 'dark' ? 'dark' : 'light',
      forcedColors: mode === 'forced' ? 'active' : 'none',
      reducedMotion: 'reduce',
    });
    const policies = await setup(page, mode);
    await expect(page.locator('dl').first().locator('dd')).toHaveText(['5', '1', '2', '4', '1']);
    const comparison = page.getByRole('table', { name: '정책 변경 전후 비교', exact: true });
    await expect(comparison).toHaveCount(1);
    await expect(comparison.getByText('true', { exact: true })).toBeVisible();
    await expect(comparison.getByText('false', { exact: true })).toBeVisible();
    const review = page.getByRole('region', { name: '검토 및 게시 권한', exact: true });
    const impact = page.getByRole('region', { name: '정책 변경 영향 분석', exact: true });
    const history = page.getByRole('region', { name: '게시 이력', exact: true });
    await expect(review.getByText('변경 요청자 ID 31', { exact: true })).toBeVisible();
    await expect(review.getByText('게시 전', { exact: true })).toBeVisible();
    const order = await impact.evaluate((element) => {
      const history = document.querySelector('section[aria-label="게시 이력"]');
      return Boolean(
        history && element.compareDocumentPosition(history) & Node.DOCUMENT_POSITION_FOLLOWING
      );
    });
    expect(order).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    if (!isMobile) {
      const list = await page.getByRole('region', { name: '결재 정책', exact: true }).boundingBox();
      const center = await page
        .getByRole('region', { name: '게시 대기 변경안', exact: true })
        .boundingBox();
      const right = await review.boundingBox();
      expect(list?.width).toBeCloseTo(280, 0);
      expect(right?.width).toBeCloseTo(280, 0);
      expect(center!.x).toBeGreaterThan(list!.x + list!.width);
      expect(right!.x).toBeGreaterThan(center!.x + center!.width);
      await capture(page, `APR15-${mode}-1440-pending-viewport`, testInfo);
      await capture(comparison, `APR15-${mode}-pending-comparison`, testInfo);
      await page.getByRole('button').filter({ hasText: policies[1].nameKo }).click();
    } else {
      await capture(page, `APR15-${mode}-320-pending-viewport`, testInfo);
      await capture(comparison, `APR15-${mode}-pending-comparison`, testInfo);
      await page.getByRole('combobox', { name: '결재 정책', exact: true }).click();
      await page.getByRole('option', { name: policies[1].nameKo, exact: true }).click();
    }
    await expect(
      page.getByRole('heading', { name: policies[1].nameKo, exact: true })
    ).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /게시 제안값/u })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
      false
    );
    await capture(page, `APR15-${mode}-${isMobile ? '320' : '1440'}-viewport`, testInfo);
    await comparison.scrollIntoViewIfNeeded();
    await capture(comparison, `APR15-${mode}-comparison`, testInfo);
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
      false
    );
    await history.scrollIntoViewIfNeeded();
    await expect(history).toBeVisible();
    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations).toEqual([]);
    await capture(page, `APR15-${mode}-text200-viewport`, testInfo);
  });
}
