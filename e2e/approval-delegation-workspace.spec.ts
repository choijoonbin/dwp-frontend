import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page, type Route } from '@playwright/test';

import { mockShellSession } from './support/shell-session';
import { mockApprovalProductSurfaceAuthority } from './support/product-surface-authority';
import { APPROVAL_MEMBER_PERMISSIONS } from './support/approval-command-center-fixtures';

import type { ApprovalDelegation } from '@dwp-frontend/shared-utils';

const outgoing: ApprovalDelegation = {
  delegationId: 'delegation-outgoing',
  delegatorUserId: 1,
  delegateUserId: 2,
  delegatePersonPublicId: 'person-2',
  delegateDisplayName: '김민준',
  delegateEmail: 'delegate@example.test',
  scopeType: 'WORKFLOW',
  workflowId: 'workflow-exact-001',
  workflowKey: 'DATA-ACCESS',
  startsAt: '2026-09-14T00:00:00Z',
  endsAt: '2026-09-18T00:00:00Z',
  lifecycleState: 'ACTIVE',
  reason: '출장 기간에 지정한 프로세스만 대행합니다.',
  version: 3,
  direction: 'OUTGOING',
};
const incoming: ApprovalDelegation = {
  ...outgoing,
  delegationId: 'delegation-incoming',
  delegatorUserId: 22,
  delegateUserId: 1,
  delegatePersonPublicId: 'person-1',
  delegateDisplayName: '현재 사용자',
  delegateEmail: null,
  scopeType: 'ALL',
  workflowId: null,
  workflowKey: null,
  reason: '원 위임자의 부재 기간 동안 대행합니다.',
  direction: 'INCOMING',
  version: 4,
};
const expired: ApprovalDelegation = {
  ...outgoing,
  delegationId: 'delegation-expired',
  lifecycleState: 'EXPIRED',
  reason: '종료된 이전 위임 증적',
  version: 5,
};

function success(route: Route, data: unknown) {
  return route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data }),
  });
}
function unavailable(route: Route, status = 503) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({ status: 'ERROR', message: 'Authority source unavailable' }),
  });
}
async function session(page: Page) {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: APPROVAL_MEMBER_PERMISSIONS,
  });
  await mockApprovalProductSurfaceAuthority(page, { surfaceUi: false });
}
async function settledDialog(dialog: Locator) {
  await expect(dialog).toBeVisible();
  await expect
    .poll(() =>
      dialog.evaluate((element) => {
        for (let parent: Element | null = element; parent; parent = parent.parentElement) {
          if (Number(getComputedStyle(parent).opacity) !== 1) return false;
        }
        return true;
      })
    )
    .toBe(true);
}
async function openOutgoing(page: Page) {
  const row = page.getByRole('button', { name: /김민준/u }).first();
  await expect(row).toBeVisible();
  await row.click();
  const mobile = await page.getByRole('dialog', { name: '위임 상세', exact: true }).isVisible();
  if (mobile) {
    const dialog = page.getByRole('dialog', { name: '위임 상세', exact: true });
    await settledDialog(dialog);
    return dialog;
  }
  return page.getByRole('complementary', { name: '위임 상세' });
}

test('원본 위임 화면의 방향 탭과 실데이터 지표·이력·inspector는 정확한 하나의 프로세스 ID를 유지한다', async ({
  page,
}, testInfo) => {
  await session(page);
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/delegations',
    (route) => success(route, [outgoing, incoming, expired])
  );
  await page.goto('/approvals/delegations');
  await expect(page.getByRole('tab', { name: '전체 위임', exact: true })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await page.getByRole('tab', { name: '내가 위임', exact: true }).click();
  await expect(page.getByRole('tab', { name: '내가 위임', exact: true })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  const inspector = await openOutgoing(page);
  await expect(inspector).toContainText('workflow-exact-001');
  await expect(inspector).toContainText('DATA-ACCESS');
  await expect(inspector.getByRole('button', { name: '위임 철회', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('delegation-inspector.png'), fullPage: false });
  if (await page.getByRole('dialog', { name: '위임 상세', exact: true }).isVisible())
    await page
      .getByRole('dialog', { name: '위임 상세', exact: true })
      .getByRole('button', { name: '닫기', exact: true })
      .click();
  await page.getByRole('tab', { name: '받은 위임', exact: true }).click();
  const received = page.getByRole('button', { name: /사용자 22에게서 받은 위임/u });
  await received.click();
  const receivedDialog = page.getByRole('dialog', { name: '위임 상세', exact: true });
  if (await receivedDialog.isVisible()) await settledDialog(receivedDialog);
  await expect(page.getByRole('button', { name: '위임 철회', exact: true })).toHaveCount(0);
  await expect(page.getByText('모든 결재 프로세스', { exact: true }).first()).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(
    accessibility.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))
  ).toEqual([]);
});

test('위임 철회 직전 첫 503은 POST0으로 닫고 명시적 새로고침 뒤 최신 버전만 한 번 전송한다', async ({
  page,
}) => {
  await session(page);
  let failNextRead = false;
  let authorityUnavailable = true;
  const bodies: Record<string, unknown>[] = [];
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/delegations',
    (route) => {
      if (failNextRead && authorityUnavailable) {
        failNextRead = false;
        return unavailable(route);
      }
      return success(route, [outgoing]);
    }
  );
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/delegations/delegation-outgoing/revoke',
    (route) => {
      bodies.push(route.request().postDataJSON() as Record<string, unknown>);
      return success(route, [{ ...outgoing, lifecycleState: 'REVOKED', version: 4 }]);
    }
  );
  await page.goto('/approvals/delegations');
  const inspector = await openOutgoing(page);
  failNextRead = true;
  await inspector.getByRole('button', { name: '위임 철회', exact: true }).click();
  const confirm = page.getByRole('alertdialog', { name: '이 위임을 철회할까요?' });
  await confirm.getByRole('button', { name: '위임 철회', exact: true }).click();
  await expect(confirm).toHaveCount(0);
  const recovery = page.getByRole('alert').filter({
    hasText: '결재 위임을 철회하지 못했습니다',
    has: page.getByRole('button', { name: '새로고침' }),
  });
  await expect(recovery).toBeVisible();
  expect(bodies).toHaveLength(0);
  await expect(page.getByRole('button', { name: '위임 추가' })).toBeDisabled();
  authorityUnavailable = false;
  const mobileDialog = page.getByRole('dialog', { name: '위임 상세', exact: true });
  if (await mobileDialog.isVisible())
    await mobileDialog.getByRole('button', { name: '닫기', exact: true }).click();
  await recovery.getByRole('button', { name: '새로고침' }).click();
  await expect(recovery).toHaveCount(0);
  const recoveredInspector = await openOutgoing(page);
  await recoveredInspector.getByRole('button', { name: '위임 철회', exact: true }).click();
  await confirm.getByRole('button', { name: '위임 철회', exact: true }).click();
  await expect(confirm).toHaveCount(0);
  expect(bodies).toEqual([{ expectedVersion: 3 }]);
});

test('위임 철회는 조회 후 변경된 방향·버전을 빌려 쓰지 않고 최신 이력을 다시 검토하게 한다', async ({
  page,
}) => {
  await session(page);
  let changed = false;
  let posts = 0;
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/delegations',
    (route) => {
      return success(
        route,
        !changed ? [outgoing] : [{ ...outgoing, direction: 'INCOMING', version: 4 }]
      );
    }
  );
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/delegations/delegation-outgoing/revoke',
    (route) => {
      posts += 1;
      return unavailable(route, 500);
    }
  );
  await page.goto('/approvals/delegations');
  const inspector = await openOutgoing(page);
  changed = true;
  await inspector.getByRole('button', { name: '위임 철회', exact: true }).click();
  const confirm = page.getByRole('alertdialog', { name: '이 위임을 철회할까요?' });
  await confirm.getByRole('button', { name: '위임 철회', exact: true }).click();
  await expect(confirm).toHaveCount(0);
  const mobileDialog = page.getByRole('dialog', { name: '위임 상세', exact: true });
  if (await mobileDialog.isVisible())
    await mobileDialog.getByRole('button', { name: '닫기', exact: true }).click();
  const recovery = page.getByRole('alert').filter({
    hasText: '결재 위임을 철회하지 못했습니다',
    has: page.getByRole('button', { name: '새로고침' }),
  });
  await recovery.getByRole('button', { name: '새로고침' }).click();
  await expect(page.getByRole('button', { name: '위임 철회', exact: true })).toHaveCount(0);
  expect(posts).toBe(0);
});

test('위임 목록과 상세는 320px·200% 글자에서도 실제 권한과 대결 식별 정보를 가리지 않는다', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await session(page);
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/delegations',
    (route) => success(route, [outgoing, incoming])
  );
  await page.goto('/approvals/delegations');
  await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
  const inspector = await openOutgoing(page);
  await expect(inspector).toContainText('workflow-exact-001');
  const geometry = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(geometry.content).toBeLessThanOrEqual(geometry.viewport);
  await expect(inspector.getByRole('button', { name: '위임 철회', exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('delegation-320-text200.png'),
    fullPage: false,
  });
});
