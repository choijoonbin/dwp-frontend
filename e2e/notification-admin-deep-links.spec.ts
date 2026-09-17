import { expect, test } from '@playwright/test';

import {
  mockNotificationAdminGovernance,
  NOTIFICATION_GOVERNANCE_PERMISSIONS,
} from './support/notification-admin-governance-fixtures';
import {
  mockNotificationOperationsAndSuppressions,
  NOTIFICATION_OPERATIONS_PERMISSIONS,
} from './support/notification-design-completion-fixtures';
import { mockNotificationAttentionGovernance } from './support/notification-attention-governance-fixtures';
import { expectNoHorizontalOverflow } from './support/notification-fixtures';
import { mockShellSession } from './support/shell-session';

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Desktop governance deep links use Chromium.');
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'PRODUCT_ADMIN'], {
    locale: 'ko',
    permissions: [...NOTIFICATION_GOVERNANCE_PERMISSIONS, ...NOTIFICATION_OPERATIONS_PERMISSIONS],
  });
  await mockNotificationAdminGovernance(page);
  await mockNotificationAttentionGovernance(page);
  await mockNotificationOperationsAndSuppressions(page);
});

test('품질 finding의 정책 링크는 정확한 정책을 선택한다', async ({ page }) => {
  await page.goto('/notifications/admin/policies?policyId=policy-work-current');

  await expect(page.getByRole('button', { name: /업무.*APP.*work/u })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expectNoHorizontalOverflow(page);
});

test('품질 finding의 템플릿 링크는 정확한 revision을 선택한다', async ({ page }) => {
  await page.goto('/notifications/admin/templates?revisionId=template-review-draft');

  await expect(page.getByRole('button', { name: /결재 조치 필요/ })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expectNoHorizontalOverflow(page);
});

test('품질 finding의 전달 제어 링크는 정확한 제어를 강조한다', async ({ page }) => {
  await page.goto('/notifications/admin/suppressions?controlId=suppression-space-1');

  await expect(
    page.locator('[data-suppression-focus="true"]').filter({ visible: true })
  ).toHaveCount(1);
  await expectNoHorizontalOverflow(page);
});
