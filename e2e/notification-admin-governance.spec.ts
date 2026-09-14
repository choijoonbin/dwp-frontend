import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import {
  mockNotificationAdminGovernance,
  NOTIFICATION_GOVERNANCE_PERMISSIONS,
} from './support/notification-admin-governance-fixtures';
import { expectNoHorizontalOverflow } from './support/notification-fixtures';
import { mockShellSession } from './support/shell-session';

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Explicit desktop and mobile viewport matrix.');
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'PRODUCT_ADMIN'], {
    userId: 100,
    locale: 'ko',
    displayName: '최준빈',
    jobTitle: '알림 제품 운영자',
    email: 'joonbin@sk.com',
    permissions: NOTIFICATION_GOVERNANCE_PERMISSIONS,
  });
});

test('계약 카탈로그는 검색과 선택 상세에서 운영 필수 계약 정보를 보존한다', async ({ page }) => {
  await mockNotificationAdminGovernance(page);
  await page.goto('/notifications/admin/contracts');

  await expect(page.getByRole('heading', { name: '알림 계약', level: 1 })).toBeVisible();
  const detail = page.getByTestId('notification-contract-detail');
  await expect(detail.getByRole('heading', { name: '결재 조치 필요' })).toBeVisible();
  await expect(detail.getByText('필수 알림 여부')).toBeVisible();
  await expect(detail.getByText('동시성 버전')).toBeVisible();
  await expect(detail.getByText('v11', { exact: true })).toBeVisible();
  await expect(detail.getByText('허용 스키마 범위')).toBeVisible();
  await expect(detail.getByText('v1-v3', { exact: true })).toBeVisible();
  await expect(detail.getByText('{{requestTitle}}', { exact: true })).toBeVisible();
  await expect(detail.getByText('/approvals/tasks/{{taskId}}', { exact: true })).toBeVisible();
  await expect(detail.getByRole('link', { name: '운영 런북 열기' })).toHaveAttribute(
    'href',
    '/notifications/admin/operations?typeKey=APPROVAL.ACTION_REQUIRED'
  );

  await page.getByTestId('notification-contract-row-contract-mail').click();
  await expect(detail.getByRole('heading', { name: '메일에서 나를 멘션' })).toBeVisible();
  await expect(detail.getByText('선택', { exact: true })).toBeVisible();

  await page.getByPlaceholder('알림 유형, 앱 또는 소유자 검색').fill('결재');
  await expect(page.getByTestId('notification-contract-row-contract-approval')).toBeVisible();
  await expect(page.getByTestId('notification-contract-row-contract-mail')).toHaveCount(0);
});

test('정책 변경은 현재값과 제안값을 비교하고 중첩 팝업 없이 수정으로 복귀한다', async ({
  page,
}) => {
  const fixture = await mockNotificationAdminGovernance(page);
  await page.goto('/notifications/admin/policies');

  const review = page.getByTestId('notification-policy-review-policy-approvals-draft');
  await review.getByRole('button', { name: '검토 및 게시' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: '현재 적용값과 제안값 비교' })).toBeVisible();
  await expect(page.getByText('변경', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: '취소' }).click();

  await review.getByRole('button', { name: '반려' }).click();
  const rejectDialog = page.getByRole('dialog', { name: '알림 정책 초안 반려' });
  await expect(rejectDialog.getByRole('button', { name: '초안 반려' })).toBeDisabled();
  await rejectDialog
    .getByLabel('결정 사유')
    .fill('긴급 우회 범위가 현재 보안 운영 기준보다 넓어 정책을 반려합니다.');
  await rejectDialog.getByRole('button', { name: '초안 반려' }).click();
  await expect.poll(() => fixture.policyRejectRequests.length).toBe(1);
  expect(fixture.policyRejectRequests[0]).toMatchObject({
    expectedVersion: '5',
    reason: '긴급 우회 범위가 현재 보안 운영 기준보다 넓어 정책을 반려합니다.',
  });

  const selfDraft = page.getByTestId('notification-policy-review-policy-work-draft');
  await selfDraft.getByRole('button', { name: '내 초안 철회' }).click();
  const withdrawDialog = page.getByRole('dialog', { name: '알림 정책 초안 철회' });
  await withdrawDialog
    .getByLabel('결정 사유')
    .fill('집중 시간 정책의 사용자 영향 분석을 보완한 뒤 다시 제안합니다.');
  await withdrawDialog.getByRole('button', { name: '초안 철회' }).click();
  await expect.poll(() => fixture.policyWithdrawRequests.length).toBe(1);

  await page.getByRole('button', { name: /메일.*Provider 기본값/s }).click();
  await page.getByRole('button', { name: '변경 제안' }).click();
  const editor = page.getByRole('dialog', { name: '메일 정책 변경 제안' });
  await editor.getByRole('spinbutton', { name: '시간' }).fill('22');
  await editor.getByRole('spinbutton', { name: '분' }).fill('30');
  await editor.getByLabel('집중 모드 사용 중').check();
  await editor.getByLabel('방해 금지 시간에 해당').check();
  await editor.getByLabel('변경 사유').fill('메일 요약 수신을 회사 운영 정책에 맞게 조정합니다.');
  await page.getByRole('button', { name: '영향 미리보기' }).click();

  await expect.poll(() => fixture.policyPreviews.length).toBe(1);
  expect(fixture.policyPreviews[0]).toMatchObject({
    simulation: {
      persona: 'KNOWLEDGE_WORKER',
      timeZone: 'Asia/Seoul',
      localTime: '22:30',
      focusMode: true,
      quietHoursActive: true,
    },
  });
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: '정책 변경 영향' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '현재 적용값과 제안값 비교' })).toBeVisible();
  const simulationResult = page.getByTestId('notification-policy-simulation-result');
  await expect(simulationResult).toContainText('상황별 전달 판정');
  await expect(simulationResult).toContainText('지연 전달');
  await expect(simulationResult).toContainText('방해 금지 시간');
  await page.getByRole('button', { name: '수정으로 돌아가기' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: '메일 정책 변경 제안' })).toBeVisible();
});

test('템플릿 스튜디오는 경고 초안 생성을 차단하고 독립 검토와 사유 기반 철회를 제공한다', async ({
  page,
}) => {
  const fixture = await mockNotificationAdminGovernance(page);
  await page.goto('/notifications/admin/templates');

  const effectivePreview = page.getByTestId('notification-template-channel-preview');
  await expect(effectivePreview).toHaveAttribute('data-channel', 'IN_APP');
  await expect(effectivePreview).toContainText('합성 사용자님이 결재를 요청했습니다');
  await expect(effectivePreview).not.toContainText('{{actorName}}');

  const review = page.getByTestId('notification-template-review-template-review-draft');
  await review.getByRole('button', { name: '검토 및 게시' }).click();
  await expect(page.getByRole('heading', { name: '현재 적용값과 제안값 비교' })).toBeVisible();
  await expect(page.getByText(/체크섬 sha256:template-review-draft/)).toBeVisible();
  await page.getByRole('button', { name: '취소' }).click();

  await review.getByRole('button', { name: '반려' }).click();
  const rejectDialog = page.getByRole('dialog', { name: '템플릿 초안 반려' });
  await rejectDialog
    .getByLabel('반려 사유')
    .fill('제목에 원천 업무 식별자가 빠져 있어 문구 보완 후 재검토가 필요합니다.');
  await rejectDialog.getByRole('button', { name: '초안 반려' }).click();
  await expect.poll(() => fixture.templateRejectRequests.length).toBe(1);

  const selfDraft = page.getByTestId('notification-template-review-template-self-draft');
  await selfDraft.getByRole('button', { name: '내 초안 철회' }).click();
  const withdrawDialog = page.getByRole('dialog', { name: '템플릿 초안 철회' });
  const withdrawButton = withdrawDialog.getByRole('button', { name: '초안 철회' });
  await expect(withdrawButton).toBeDisabled();
  await withdrawDialog
    .getByLabel('철회 사유')
    .fill('보안 검토 문구를 원천 앱 정책과 다시 정합화합니다.');
  await withdrawButton.click();
  await expect.poll(() => fixture.templateWithdrawRequests.length).toBe(1);
  expect(fixture.templateWithdrawRequests[0]).toMatchObject({
    expectedVersion: '2',
    reason: '보안 검토 문구를 원천 앱 정책과 다시 정합화합니다.',
  });

  await page.getByRole('button', { name: /업무 일간 요약.*업무.*IN_APP.*ko/s }).click();
  await page.getByRole('button', { name: '회사 문구 제안' }).click();
  const editor = page.getByRole('dialog', { name: /WORK\.DAILY_DIGEST 회사 템플릿 제안/ });
  await editor
    .getByLabel('변경 사유')
    .fill('사용자가 오늘의 우선 업무를 더 빠르게 이해하도록 개선합니다.');
  await editor.getByRole('button', { name: '검증 및 미리보기' }).click();
  await expect(editor.getByText('초안을 만들기 전에 해결할 검증 경고')).toBeVisible();
  await expect(editor.getByRole('button', { name: '승인 초안 만들기' })).toBeDisabled();
});

test('모바일 카탈로그는 목록과 상세를 분리하고 선택 위치로 포커스를 복원한다', async ({ page }) => {
  await mockNotificationAdminGovernance(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const cases = [
    {
      route: '/notifications/admin/contracts',
      ready: 'notification-contract-catalog',
      list: '알림 계약 목록',
      detail: '선택한 알림 계약 상세',
      item: /메일에서 나를 멘션.*MAIL\.MENTIONED/s,
    },
    {
      route: '/notifications/admin/policies',
      ready: 'notification-policy-studio',
      list: '알림 정책 목록',
      detail: '선택한 알림 정책 상세',
      item: /메일.*APP.*mail/s,
    },
    {
      route: '/notifications/admin/templates',
      ready: 'notification-template-studio',
      list: '알림 템플릿 목록',
      detail: '선택한 알림 템플릿 상세',
      item: /업무 일간 요약.*업무.*IN_APP.*ko/s,
    },
  ];

  for (const current of cases) {
    await page.goto(current.route);
    await expect(page.getByTestId(current.ready)).toBeVisible();
    const list = page.getByRole('region', { name: current.list });
    const detail = page.getByRole('region', { name: current.detail });
    const item = list.getByRole('button', { name: current.item });
    await expect(list).toBeVisible();
    await expect(detail).toBeHidden();
    await item.click();
    await expect(list).toBeHidden();
    await expect(detail).toBeVisible();
    await expect(detail).toBeFocused();
    await detail.getByRole('button', { name: '목록으로 돌아가기' }).click();
    await expect(list).toBeVisible();
    await expect(detail).toBeHidden();
    await expect(item).toBeFocused();
  }
});

test('운영 화면은 공통 폭과 모바일 접근성 계약을 유지한다', async ({ page }, testInfo) => {
  await mockNotificationAdminGovernance(page);
  const routes = [
    ['/notifications/admin/contracts', 'notification-contract-catalog'],
    ['/notifications/admin/policies', 'notification-policy-studio'],
    ['/notifications/admin/templates', 'notification-template-studio'],
  ];

  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [route, readyTestId] of routes) {
      await page.goto(route);
      await expect(page.getByTestId(readyTestId)).toBeVisible();
      await expectNoHorizontalOverflow(page);
      if (width !== 320) {
        const screen = route.split('/').at(-1);
        await page.screenshot({
          path: testInfo.outputPath(`notification-admin-${screen}-${width}.png`),
          animations: 'disabled',
          fullPage: true,
        });
      }
    }
  }

  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
});
