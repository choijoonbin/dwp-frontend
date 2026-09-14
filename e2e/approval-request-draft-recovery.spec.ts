import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

import { mockShellSession } from './support/shell-session';
import { mockApprovalProductSurfaceAuthority } from './support/product-surface-authority';
import { APPROVAL_MEMBER_PERMISSIONS } from './support/approval-command-center-fixtures';
import {
  APPROVAL_REQUEST_DETAIL_FIXTURE,
  APPROVAL_REQUEST_FIXTURE,
} from './support/product-area-fixtures';

const base = '/api/approvals/v1';
const id = APPROVAL_REQUEST_FIXTURE.requestId;
const at = '2026-09-14T00:00:00Z';
function success(route: Route, data: unknown) {
  return route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data }),
  });
}
function pageResult(items: unknown[], size = 20) {
  return {
    items,
    totalElements: items.length,
    totalPages: items.length ? 1 : 0,
    page: 0,
    size,
    hasNext: false,
    evaluatedAt: at,
  };
}

async function setup(page: Page, loseDeleteResponse = false) {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: APPROVAL_MEMBER_PERMISSIONS,
  });
  await mockApprovalProductSurfaceAuthority(page, { surfaceUi: false });
  let version = 3;
  let deleted = false;
  let title = APPROVAL_REQUEST_FIXTURE.title;
  const commands: { kind: string; body: Record<string, unknown> }[] = [];
  const request = () => ({ ...APPROVAL_REQUEST_FIXTURE, status: 'DRAFT', version, title });
  const state = () => ({
    requestId: id,
    version,
    payloadRevision: 2,
    deletedAt: deleted ? at : null,
    deletedBy: deleted ? 1 : null,
  });
  const revision = (number: number) => ({
    revision: number,
    payloadSha256: 'a'.repeat(64),
    changeType: number === 2 ? 'DRAFT_UPDATED' : 'DRAFT_CREATED',
    changedBy: 1,
    reason: 'Saved draft revision',
    createdAt: at,
    recoverable: number === 2,
    recoveryReason: number === 1 ? 'LEGACY_NO_DRAFT_SNAPSHOT' : null,
  });
  await page.route(
    (url) => url.pathname === `${base}/requests/search`,
    (route) => {
      const view = new URL(route.request().url()).searchParams.get('view');
      return success(route, pageResult((view === 'DELETED') === deleted ? [request()] : []));
    }
  );
  await page.route(
    (url) => url.pathname === `${base}/requests/${id}/detail`,
    (route) =>
      deleted
        ? route.fulfill({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({ status: 'ERROR', message: 'Deleted draft not available' }),
          })
        : success(route, { ...APPROVAL_REQUEST_DETAIL_FIXTURE, request: request() })
  );
  await page.route(
    (url) => url.pathname === `${base}/requests/${id}/draft/revisions`,
    (route) => success(route, pageResult([revision(2), revision(1)], 10))
  );
  await page.route(
    (url) => url.pathname.startsWith(`${base}/requests/${id}/draft/revisions/`),
    (route) => {
      const number = Number(new URL(route.request().url()).pathname.split('/').at(-1));
      return success(route, {
        revision: revision(number),
        payload: APPROVAL_REQUEST_DETAIL_FIXTURE.payload,
        draftSnapshot:
          number === 2
            ? {
                workflowId: APPROVAL_REQUEST_DETAIL_FIXTURE.workflowId,
                formId: APPROVAL_REQUEST_DETAIL_FIXTURE.formId,
                title: '이력에서 복구한 초안',
                summary: '저장된 이전 입력 내용',
              }
            : {},
      });
    }
  );
  await page.route(
    (url) => /\/draft\/(delete|restore|recover)$/u.test(url.pathname),
    (route) => {
      const kind = new URL(route.request().url()).pathname.split('/').at(-1)!;
      const body = route.request().postDataJSON() as Record<string, unknown>;
      commands.push({ kind, body });
      expect(body.expectedVersion).toBe(version);
      expect(route.request().headers()['idempotency-key']).toBe(body.idempotencyKey);
      version += 1;
      if (kind === 'delete') deleted = true;
      if (kind === 'restore') deleted = false;
      if (kind === 'recover') title = '이력에서 복구한 초안';
      if (kind === 'delete' && loseDeleteResponse) return route.abort('connectionfailed');
      return success(route, state());
    }
  );
  await page.route(
    (url) => url.pathname.startsWith(`${base}/draft-commands/`),
    (route) => {
      const key = decodeURIComponent(new URL(route.request().url()).pathname.split('/').at(-1)!);
      const command = commands.find((entry) => entry.body.idempotencyKey === key);
      return success(route, {
        idempotencyKey: key,
        receipts: command
          ? [
              {
                commandType: command.kind.toUpperCase(),
                route: `POST /v1/requests/${id}/draft/${command.kind}`,
                draft: state(),
                completedAt: at,
              },
            ]
          : [],
      });
    }
  );
  return { commands };
}

async function openMobilePreview(page: Page, title = APPROVAL_REQUEST_FIXTURE.title) {
  if (page.viewportSize()!.width < 1200) {
    await page
      .locator('main')
      .getByRole('list')
      .filter({ hasText: title })
      .getByRole('button')
      .first()
      .click();
    await expect(page.getByRole('dialog', { name: '결재 상세' })).toBeVisible();
  }
}

test('초안은 사유와 최신 버전에 결속해 휴지통으로 이동하고 동일 문서로 복원된다', async ({
  page,
}) => {
  const { commands } = await setup(page);
  await page.goto('/approvals/requests/drafts');
  await openMobilePreview(page);
  const remove = page.getByRole('button', { name: '초안 휴지통으로 이동' });
  await expect(remove).toBeEnabled();
  await expect(page.locator('.MuiTouchRipple-childLeaving')).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath('draft-workspace.png'), fullPage: false });
  const a11y = await new AxeBuilder({ page }).analyze();
  expect(
    a11y.violations.filter((issue) => ['serious', 'critical'].includes(issue.impact ?? ''))
  ).toEqual([]);
  await remove.click();
  const dialog = page.getByRole('dialog', { name: '초안을 휴지통으로 이동할까요?' });
  await dialog.getByLabel('변경 사유').fill('중복 작성한 초안을 복원 가능하도록 정리합니다.');
  await dialog.getByRole('button', { name: '초안 휴지통으로 이동' }).dblclick();
  await expect(dialog).not.toBeVisible();
  expect(commands).toHaveLength(1);
  expect(commands[0]!.body).toMatchObject({
    expectedVersion: 3,
    reason: '중복 작성한 초안을 복원 가능하도록 정리합니다.',
  });
  await page.getByRole('tab', { name: '휴지통' }).click();
  await openMobilePreview(page);
  await page.getByRole('button', { name: '초안 복원' }).click();
  const restore = page.getByRole('dialog', { name: '초안을 복원할까요?' });
  await restore.getByLabel('변경 사유').fill('중복이 아니어서 작성 중인 초안으로 복원합니다.');
  await restore.getByRole('button', { name: '초안 복원' }).click();
  await expect(restore).not.toBeVisible();
  expect(commands).toHaveLength(2);
  expect(commands[1]!.body.expectedVersion).toBe(4);
  await page.getByRole('tab', { name: '작성 중' }).click();
  await expect(page.locator('main')).toContainText(APPROVAL_REQUEST_FIXTURE.requestNumber);
});

test('수정 이력은 실제 스냅샷을 미리보고 legacy 복구를 막으며 복구는 새 버전을 만든다', async ({
  page,
}) => {
  const { commands } = await setup(page);
  await page.goto('/approvals/requests/drafts');
  await openMobilePreview(page);
  const history = page.getByRole('region', { name: '수정 이력' });
  await history.getByRole('button').filter({ hasText: '리비전 1' }).click();
  await expect(history).toContainText('이전 입력에 전체 초안 스냅샷이 없어');
  await expect(history.getByRole('button', { name: '이 버전으로 복구' })).toHaveCount(0);
  await history.getByRole('button').filter({ hasText: '리비전 2' }).click();
  await expect(history).toContainText('이력에서 복구한 초안');
  await history.getByRole('button', { name: '이 버전으로 복구' }).click();
  const dialog = page.getByRole('dialog', { name: '이 버전으로 초안을 복구할까요?' });
  await dialog.getByLabel('변경 사유').fill('확인한 이전 입력으로 새 초안 버전을 복구합니다.');
  await dialog.getByRole('button', { name: '이 버전으로 복구' }).click();
  await expect(dialog).not.toBeVisible();
  expect(commands).toHaveLength(1);
  expect(commands[0]!.body).toMatchObject({ expectedVersion: 3, revision: 2 });
  await expect(page.locator('main')).toContainText('이력에서 복구한 초안');
});

test('삭제 응답 유실은 원래 명령 receipt를 확인하기 전 재삭제를 차단한다', async ({ page }) => {
  const { commands } = await setup(page, true);
  await page.goto('/approvals/requests/drafts');
  await openMobilePreview(page);
  await page.getByRole('button', { name: '초안 휴지통으로 이동' }).click();
  const dialog = page.getByRole('dialog', { name: '초안을 휴지통으로 이동할까요?' });
  await dialog.getByLabel('변경 사유').fill('결과 확인이 필요한 휴지통 이동');
  await dialog.getByRole('button', { name: '초안 휴지통으로 이동' }).click();
  await expect(dialog).toContainText('변경 결과가 불명확합니다');
  await expect(dialog.getByRole('button', { name: '초안 휴지통으로 이동' })).toBeDisabled();
  await dialog.getByRole('button', { name: '저장 결과 확인' }).click();
  await expect(dialog).not.toBeVisible();
  expect(commands).toHaveLength(1);
});
