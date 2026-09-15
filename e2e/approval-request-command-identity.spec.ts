import { expect, test, type Page, type Route } from '@playwright/test';

import { mockShellSession } from './support/shell-session';
import { mockApprovalProductSurfaceAuthority } from './support/product-surface-authority';
import { APPROVAL_MEMBER_PERMISSIONS } from './support/approval-command-center-fixtures';
import { installApprovalInformationWireCapture } from './support/approval-information-wire-fixtures';
import {
  APPROVAL_FORM_DETAIL_FIXTURE,
  APPROVAL_REQUEST_DETAIL_FIXTURE,
  APPROVAL_REQUEST_FIXTURE,
  APPROVAL_WORKFLOW_DETAIL_FIXTURE,
  APPROVAL_WORKFLOW_FIXTURE,
} from './support/product-area-fixtures';

function success(route: Route, data: unknown) {
  return route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data }),
  });
}
function unknown(route: Route) {
  return route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ status: 'ERROR', message: 'Command result unavailable' }),
  });
}
async function session(page: Page, status: 'DRAFT' | 'NEEDS_INFO') {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: APPROVAL_MEMBER_PERMISSIONS,
  });
  await mockApprovalProductSurfaceAuthority(page, { surfaceUi: false });
  const request = { ...APPROVAL_REQUEST_FIXTURE, status };
  const detail = {
    ...APPROVAL_REQUEST_DETAIL_FIXTURE,
    request,
    formSchema: { schemaVersion: 1, fields: [] },
  };
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/catalog/forms/approval-form-data-access/template',
    (route) =>
      success(route, {
        workflow: APPROVAL_WORKFLOW_FIXTURE,
        routeDefinition: APPROVAL_WORKFLOW_DETAIL_FIXTURE.definition,
        form: { ...APPROVAL_FORM_DETAIL_FIXTURE, schema: detail.formSchema },
      })
  );
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/requests/search',
    (route) =>
      success(route, {
        items: [request],
        totalElements: 1,
        totalPages: 1,
        page: 0,
        size: 20,
        hasNext: false,
        evaluatedAt: new Date().toISOString(),
      })
  );
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/requests/approval-request-001/detail',
    (route) => success(route, detail)
  );
  return detail;
}

test('상신의 실제 original key를 전송하고 첫 503 이후 같은 초안 재조회는 새 key나 POST를 만들지 않는다', async ({
  page,
}) => {
  await session(page, 'DRAFT');
  const commands: { key?: string; body: unknown }[] = [];
  let otherWrites = 0;
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/requests/approval-request-001/draft',
    (route) => {
      otherWrites += 1;
      return unknown(route);
    }
  );
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/requests/approval-request-001/submit',
    (route) => {
      commands.push({
        key: route.request().headers()['idempotency-key'],
        body: route.request().postDataJSON(),
      });
      return unknown(route);
    }
  );
  await page.goto('/approvals/requests/new?draft=approval-request-001');
  await expect(page.getByRole('textbox', { name: '제목', exact: true })).toHaveValue(
    APPROVAL_REQUEST_FIXTURE.title
  );
  await page.getByRole('button', { name: '결재 상신', exact: true }).click();
  const preflight = page.getByRole('dialog');
  await preflight.getByRole('button', { name: '결재 상신', exact: true }).click();
  const recovery = page
    .getByRole('alert')
    .filter({ hasText: '중복 처리를 방지하기 위해 다시 전송하지 않습니다' });
  await expect(recovery).toBeVisible();
  expect(commands).toHaveLength(1);
  expect(commands[0]!.key).toMatch(/^[A-Za-z0-9._:-]{1,120}$/u);
  expect(commands[0]!.body).toEqual({ expectedVersion: 3 });
  await expect(page.getByRole('textbox', { name: '제목', exact: true })).toBeDisabled();
  await recovery.getByRole('button', { name: '새로고침', exact: true }).click();
  await expect(page.getByRole('button', { name: '결재 상신', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '저장하고 닫기', exact: true })).toBeDisabled();
  await expect(page.getByRole('textbox', { name: '제목', exact: true })).toHaveValue(
    APPROVAL_REQUEST_FIXTURE.title
  );
  await expect(page).toHaveURL(/\/approvals\/requests\/new\?draft=approval-request-001$/u);
  expect(commands).toHaveLength(1);
  expect(otherWrites).toBe(0);
});

test('보완 답변의 actual key/header와 원래 입력을 보존하며 UNKNOWN refresh/close가 새 POST를 열지 않는다', async ({
  page,
}) => {
  const wireCaptures = await installApprovalInformationWireCapture(page);
  await session(page, 'NEEDS_INFO');
  const commands: { key?: string }[] = [];
  await page.route(
    (url) =>
      url.pathname === '/api/approvals/v1/requests/approval-request-001/information-response',
    (route) => {
      commands.push({
        key: route.request().headers()['idempotency-key'],
      });
      return unknown(route);
    }
  );
  await page.goto('/approvals/requests/needs-info');
  await page.getByRole('button', { name: '보완 답변', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: '보완 답변을 제출할까요?' });
  const message = dialog.getByRole('textbox', { name: '보완 답변', exact: true });
  await message.fill('원래 사용자 액션의 실제 보완 답변입니다.');
  await dialog.getByRole('button', { name: '답변 제출', exact: true }).click();
  await expect(dialog.getByText(/중복 처리를 방지하기 위해 다시 전송하지 않습니다/u)).toBeVisible();
  expect(commands).toHaveLength(1);
  expect(commands[0]!.key).toMatch(/^[A-Za-z0-9._:-]{1,120}$/u);
  expect(wireCaptures).toHaveLength(1);
  expect(wireCaptures[0]!.body).toMatchObject({
    expectedVersion: 3,
    message: '원래 사용자 액션의 실제 보완 답변입니다.',
  });
  await dialog.getByRole('button', { name: '새로고침', exact: true }).click();
  await expect(message).toHaveValue('원래 사용자 액션의 실제 보완 답변입니다.');
  await expect(message).toBeDisabled();
  await expect(dialog.getByRole('button', { name: '답변 제출', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  await expect(dialog).toBeVisible();
  expect(commands).toHaveLength(1);
});
