import { expect, test, type Locator, type Page } from '@playwright/test';

import { PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS } from '../apps/dwp/src/routes/product-surface-authorization.generated';
import { approvalPilotAuthorityOptions } from './support/pilot-authorization-fixtures';
import { mockApprovalProductSurfaceAuthority } from './support/product-surface-authority';
import { mockShellSession } from './support/shell-session';

const DESIGN_ROUTE_KEY = 'route.approvals.admin.workflows.page';
const OPERATIONS_ROUTE_KEY = 'route.approvals.admin.operations.page';

function exactPageContract(routeContractKey: string) {
  const records = PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS.filter(
    (record) => record.routeContractKey === routeContractKey
  );
  expect(records, routeContractKey).toHaveLength(1);
  const record = records[0]!;
  expect(record.routeKind).toBe('PAGE');
  expect(record.productId).toBe('approvals');
  expect(record.surfaceId).toBe('approvals.admin');
  return record;
}

async function approvalNavigation(page: Page): Promise<Locator> {
  const desktop = page.getByTestId('approvals-sidebar');
  if (await desktop.isVisible()) return desktop;

  await page.getByRole('button', { name: '전자결재 메뉴 열기' }).click();
  const mobile = page.getByTestId('approvals-mobile-sidebar');
  await expect(mobile).toBeVisible();
  return mobile;
}

test('PS-A002 fixture는 실제 PAGE 계약·메뉴·직접 경로에서 design-only 권위를 증명한다', async ({
  page,
}) => {
  const { authority, fixture } = approvalPilotAuthorityOptions('PS-A002');
  const capabilities = fixture.composition.flatMap((source) =>
    source.source === 'COMPONENT' ? (source.value.capabilityContractKeys ?? []) : []
  );
  expect(fixture.expectedOutcome).toBe('DESIGN_DRAFT_ONLY');
  expect(capabilities).toContain('approvals.design.read');
  expect(capabilities).not.toContain('approvals.operations.read');
  expect(exactPageContract(DESIGN_ROUTE_KEY)).toMatchObject({
    routeId: 'approvals.admin.workflows',
    pattern: '/approvals/admin/workflows',
  });
  expect(exactPageContract(OPERATIONS_ROUTE_KEY)).toMatchObject({
    routeId: 'approvals.admin.operations',
    pattern: '/approvals/admin/operations',
  });

  await mockShellSession(page, ['WORKSPACE_MEMBER'], { locale: 'ko', permissions: [] });
  await mockApprovalProductSurfaceAuthority(page, authority);

  await page.goto('/approvals/admin/workflows');
  await expect(page.getByTestId('approvals-shell')).toHaveAttribute(
    'data-product-surface',
    'approvals.admin'
  );
  await expect(page.getByTestId('product-surface-access-state')).toHaveCount(0);
  await expect(page.locator('#dwp-main-content').getByRole('heading', { level: 1 })).toBeVisible();
  let navigation = await approvalNavigation(page);
  await expect(navigation.getByRole('link', { name: '프로세스 설계', exact: true })).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'SLA 및 전달 운영', exact: true })).toHaveCount(
    0
  );
  await expect(navigation.getByRole('link', { name: '결재함', exact: true })).toHaveCount(0);

  await page.goto('/approvals/admin/operations');
  await expect(page.getByTestId('approvals-shell')).toHaveAttribute(
    'data-product-surface',
    'approvals.admin'
  );
  await expect(page.getByTestId('product-surface-access-state')).toHaveAttribute(
    'data-product-access-state',
    'route-denied'
  );
  navigation = await approvalNavigation(page);
  await expect(navigation.getByRole('link', { name: 'SLA 및 전달 운영', exact: true })).toHaveCount(
    0
  );

  await page.goto('/approvals/home');
  await expect(page.getByTestId('approvals-shell')).toHaveAttribute(
    'data-product-surface',
    'approvals.work'
  );
  await expect(page.getByTestId('product-surface-access-state')).toHaveCount(0);
  navigation = await approvalNavigation(page);
  await expect(navigation.getByRole('link', { name: '결재함', exact: true })).toBeVisible();
  await expect(navigation.getByRole('link', { name: '프로세스 설계', exact: true })).toHaveCount(0);
  await expect(
    page.locator('[data-testid="product-surface-management-entry"]:visible')
  ).toHaveCount(1);
});
