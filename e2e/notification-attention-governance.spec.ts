import { expect, test } from '@playwright/test';

import { mockNotificationAttentionGovernance } from './support/notification-attention-governance-fixtures';
import {
  mockNotificationAdminGovernance,
  NOTIFICATION_GOVERNANCE_PERMISSIONS,
} from './support/notification-admin-governance-fixtures';
import { expectNoHorizontalOverflow } from './support/notification-fixtures';
import { mockShellSession } from './support/shell-session';

test.beforeEach(async ({ page: _page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium',
    'The governance contract has an explicit Chromium matrix.'
  );
});

async function session(
  page: Parameters<typeof mockShellSession>[0],
  permissions = NOTIFICATION_GOVERNANCE_PERMISSIONS
) {
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'PRODUCT_ADMIN'], {
    userId: 100,
    locale: 'ko',
    displayName: '최준빈',
    jobTitle: '알림 제품 운영자',
    email: 'joonbin@sk.com',
    permissions,
  });
  await mockNotificationAdminGovernance(page);
}

test('관심 정책은 제품 정책 화면에서 실 API로 로드되고 작성자 자기 승인을 차단한 채 철회한다', async ({
  page,
}, testInfo) => {
  await session(page);
  const fixture = await mockNotificationAttentionGovernance(page, {
    actorUserId: 100,
    draftCreatorUserId: 100,
  });

  await page.goto('/notifications/admin/policies?tab=attention');
  const runtime = page.getByTestId('notification-attention-governance-runtime');
  await expect(runtime).toBeVisible();
  await expect(runtime).toBeFocused();
  await expect(runtime.getByRole('heading', { name: '관심 정책 거버넌스' })).toBeVisible();
  await expect(
    runtime.getByText('검토 중인 초안을 결정하기 전에는 새 초안을 만들 수 없습니다.')
  ).toBeVisible();
  await expect(
    runtime.getByText('본인이 작성한 리비전은 게시하거나 반려할 수 없습니다.')
  ).toBeVisible();
  await expect(runtime.getByRole('button', { name: '정책 게시' })).toBeDisabled();
  await expect(runtime.getByRole('button', { name: '초안 반려' })).toBeDisabled();

  await runtime
    .getByLabel('결정 사유')
    .fill('운영 한도 변경의 사용자 영향 분석을 보완한 뒤 다시 제안합니다.');
  await runtime.getByRole('button', { name: '초안 철회' }).click();
  await expect
    .poll(() => fixture.commands.filter(({ action }) => action === 'withdraw').length)
    .toBe(1);
  expect(fixture.commands.at(-1)).toMatchObject({
    action: 'withdraw',
    body: { expectedVersion: '4' },
  });
  expect(fixture.commands.at(-1)?.idempotencyKey).toMatch(/^attention-governance-withdraw:/u);
  await expect(runtime.getByText('검토 대기 리비전')).toHaveCount(0);
  await expect(runtime.getByText('현재 운영 리비전')).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('notification-attention-governance-1440.png'),
    animations: 'disabled',
    fullPage: true,
  });
});

test('독립 승인자는 409 충돌에서 초안을 보존하고 정본 재조회 후 게시를 재시도한다', async ({
  page,
}) => {
  await session(page);
  const fixture = await mockNotificationAttentionGovernance(page, {
    actorUserId: 100,
    draftCreatorUserId: 200,
    stalePublishOnce: true,
  });

  await page.goto('/notifications/admin/policies?tab=attention');
  const runtime = page.getByTestId('notification-attention-governance-runtime');
  await expect(runtime.getByText('검토 대기 리비전')).toBeVisible();
  await runtime
    .getByLabel('결정 사유')
    .fill('보안과 개인정보 영향 검토를 완료하여 운영 게시를 승인합니다.');
  const publish = runtime.getByRole('button', { name: '정책 게시' });
  await expect(publish).toBeEnabled();
  await publish.click();

  await expect(runtime.getByText(/다른 운영자가 먼저 정책을 변경했습니다/)).toBeVisible();
  await expect(runtime.getByText('검토 대기 리비전')).toBeVisible();
  await expect.poll(() => fixture.reads()).toBeGreaterThan(1);

  await publish.click();
  await expect
    .poll(() => fixture.commands.filter(({ action }) => action === 'publish').length)
    .toBe(2);
  await expect(runtime.getByText('검토 대기 리비전')).toHaveCount(0);
  await expect(runtime.getByText('현재 운영 리비전')).toBeVisible();
});

test('APPROVE 권한이 없는 운영자는 게시와 반려를 실행할 수 없다', async ({ page }) => {
  const permissions = NOTIFICATION_GOVERNANCE_PERMISSIONS.filter(
    ({ resourceKey, permissionCode }) =>
      resourceKey !== 'ADMIN.NOTIFICATION_POLICY' || permissionCode !== 'APPROVE'
  );
  await session(page, permissions);
  await mockNotificationAttentionGovernance(page, {
    actorUserId: 100,
    draftCreatorUserId: 200,
  });

  await page.goto('/notifications/admin/policies?tab=attention');
  const runtime = page.getByTestId('notification-attention-governance-runtime');
  await expect(
    runtime.getByText('정책 게시와 반려에는 독립 승인 권한이 필요합니다.')
  ).toBeVisible();
  await runtime
    .getByLabel('결정 사유')
    .fill('권한 경계 검증을 위해 충분한 길이의 결정 사유를 입력합니다.');
  await expect(runtime.getByRole('button', { name: '정책 게시' })).toBeDisabled();
  await expect(runtime.getByRole('button', { name: '초안 반려' })).toBeDisabled();
});

test('390px 오류 상태는 데이터를 꾸며내지 않고 복구 동작과 공통 폭을 유지한다', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await session(page);
  const fixture = await mockNotificationAttentionGovernance(page, { loadFailure: true });

  await page.goto('/notifications/admin/policies?tab=attention');
  const runtime = page.getByTestId('notification-attention-governance-runtime');
  await expect(runtime.getByText('관심 정책 거버넌스를 불러오지 못했습니다')).toBeVisible();
  await expect(runtime.getByText('최대 활성 규칙')).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  fixture.recover();
  await runtime.getByRole('button', { name: '다시 시도' }).click();
  await expect(runtime.getByText('사용자 관심 규칙 한도')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath('notification-attention-governance-390.png'),
    animations: 'disabled',
    fullPage: true,
  });
});
