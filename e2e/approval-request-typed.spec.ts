import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

import { compileApprovalTypedForm } from '../apps/dwp/src/features/approvals/approval-form-typed-compiler';
import { evaluateApprovalTypedForm } from '../apps/dwp/src/features/approvals/approval-form-typed-evaluator';
import {
  APPROVAL_REQUEST_TYPED_TEST_SCHEMA,
  APPROVAL_REQUEST_TYPED_TEST_INPUT,
} from './support/approval-request-typed-fixture';
import { mockShellSession } from './support/shell-session';
import { mockApprovalProductSurfaceAuthority } from './support/product-surface-authority';
import { APPROVAL_MEMBER_PERMISSIONS } from './support/approval-command-center-fixtures';
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
function failure(route: Route, status: number) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({ status: 'ERROR', message: 'Request source changed' }),
  });
}
async function typedSession(page: Page, hash?: string) {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: APPROVAL_MEMBER_PERMISSIONS,
  });
  await mockApprovalProductSurfaceAuthority(page, { surfaceUi: false });
  const compiled = await compileApprovalTypedForm(APPROVAL_REQUEST_TYPED_TEST_SCHEMA);
  const payload = evaluateApprovalTypedForm(
    compiled,
    {
      ...APPROVAL_REQUEST_TYPED_TEST_INPUT,
      summary: APPROVAL_REQUEST_FIXTURE.summary,
      createdFrom: 'DWP_APPROVALS',
    },
    'DRAFT'
  ).payload;
  const detail = {
    ...APPROVAL_REQUEST_DETAIL_FIXTURE,
    formSchema: APPROVAL_REQUEST_TYPED_TEST_SCHEMA,
    payload,
    request: { ...APPROVAL_REQUEST_FIXTURE, status: 'DRAFT', version: 3 },
  };
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/catalog/forms/approval-form-data-access/template',
    (route) =>
      success(route, {
        workflow: APPROVAL_WORKFLOW_FIXTURE,
        routeDefinition: APPROVAL_WORKFLOW_DETAIL_FIXTURE.definition,
        form: {
          ...APPROVAL_FORM_DETAIL_FIXTURE,
          schema: APPROVAL_REQUEST_TYPED_TEST_SCHEMA,
          schemaHash: hash ?? compiled.schemaSha256,
        },
      })
  );
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/requests/approval-request-001/detail',
    (route) => success(route, detail)
  );
  return { compiled, detail, payload };
}
async function selectForm(page: Page) {
  await page.getByLabel('결재 양식').click();
  await page.getByRole('option', { name: /데이터 접근 예외 신청서/u }).click();
  await expect(page.getByRole('button', { name: '행 추가' })).toBeVisible();
}

test('Typed 게시 양식은 반복 행과 계산값을 실제 canonical 초안으로 저장하고 조건부 필수 입력 후 같은 버전으로 상신한다', async ({
  page,
}, testInfo) => {
  await typedSession(page);
  const creates: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  const submits: Record<string, unknown>[] = [];
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/requests',
    (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      const body = route.request().postDataJSON() as Record<string, unknown>;
      creates.push(body);
      expect(route.request().headers()['idempotency-key']).toMatch(/^[A-Za-z0-9._:-]{1,120}$/u);
      return success(route, { ...APPROVAL_REQUEST_FIXTURE, ...body, status: 'DRAFT', version: 3 });
    }
  );
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/requests/approval-request-001/draft',
    (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      updates.push(body);
      return success(route, {
        ...APPROVAL_REQUEST_DETAIL_FIXTURE,
        formSchema: APPROVAL_REQUEST_TYPED_TEST_SCHEMA,
        request: {
          ...APPROVAL_REQUEST_FIXTURE,
          ...body,
          status: 'DRAFT',
          version: 3 + updates.length,
        },
        payload: body.payload,
      });
    }
  );
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/requests/approval-request-001/submit',
    (route) => {
      submits.push(route.request().postDataJSON() as Record<string, unknown>);
      return success(route, {
        ...APPROVAL_REQUEST_FIXTURE,
        status: 'SUBMITTED',
        version: 4 + updates.length,
      });
    }
  );
  await page.goto('/approvals/requests/new');
  await selectForm(page);
  await page.getByRole('textbox', { name: '제목', exact: true }).fill('반복 항목 구매 요청');
  await page
    .getByRole('textbox', { name: '요청 내용', exact: true })
    .fill('정확한 금액과 조건을 검증한 구매 기안입니다.');
  await page.getByLabel('분류').click();
  await page.getByRole('option', { name: 'OTHER', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '추가 내용', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '행 추가' }).click();
  await page.getByRole('textbox', { name: '수량', exact: true }).fill('2.00');
  await page.getByRole('textbox', { name: '단가', exact: true }).fill('50.25');
  await expect(page.getByRole('textbox', { name: '소계', exact: true })).toHaveValue('100.5');
  await expect(page.getByRole('textbox', { name: '합계', exact: true })).toHaveValue('100.5');
  expect(
    await page.getByRole('textbox', { name: '합계', exact: true }).getAttribute('readonly')
  ).not.toBeNull();
  await expect(page.getByRole('button', { name: '결재 상신', exact: true })).toBeDisabled();
  await page
    .getByRole('textbox', { name: '추가 내용', exact: true })
    .fill('예외 항목의 업무상 필요성을 설명합니다.');
  await page.getByRole('textbox', { name: '고액 사유', exact: true }).fill('승인된 예산 내 구매');
  await page.getByRole('button', { name: '결재 상신', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '상신 전 통제' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('100.5');
  await page.screenshot({
    path: testInfo.outputPath('typed-request-preflight.png'),
    fullPage: false,
  });
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(
    accessibility.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))
  ).toEqual([]);
  await dialog.getByRole('button', { name: '결재 상신', exact: true }).click();
  await expect(page).toHaveURL(/\/approvals\/requests\/submitted$/u);
  expect(creates).toHaveLength(1);
  expect(submits).toHaveLength(1);
  const last = updates.at(-1) ?? creates[0]!;
  expect(last.payload).toEqual({
    summary: '정확한 금액과 조건을 검증한 구매 기안입니다.',
    category: 'OTHER',
    details: '예외 항목의 업무상 필요성을 설명합니다.',
    items: [{ quantity: '2', price: '50.25', lineTotal: '100.5' }],
    total: '100.5',
    justification: '승인된 예산 내 구매',
    createdFrom: 'DWP_APPROVALS',
  });
  expect(submits[0]!.expectedVersion).toBe(3 + updates.length);
});

test('Typed 초안 409는 반복 행 입력을 보존하고 최신 버전 확인 뒤 명시적 재적용만 전송한다', async ({
  page,
}) => {
  const { detail } = await typedSession(page);
  let version = 3;
  const updates: Record<string, unknown>[] = [];
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/requests/approval-request-001/detail',
    (route) => success(route, { ...detail, request: { ...detail.request, version } })
  );
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/requests/approval-request-001/draft',
    (route) => {
      updates.push(route.request().postDataJSON() as Record<string, unknown>);
      if (updates.length === 1) {
        version = 4;
        return failure(route, 409);
      }
      version = 5;
      return success(route, {
        ...detail,
        request: { ...detail.request, version },
        payload: updates.at(-1)!.payload,
      });
    }
  );
  await page.goto('/approvals/requests/new?draft=approval-request-001');
  const quantity = page.getByRole('textbox', { name: '수량', exact: true });
  await expect(quantity).toHaveValue('2');
  await quantity.fill('3.00');
  await page.getByRole('button', { name: '임시 저장', exact: true }).click();
  const conflict = page.getByRole('alert').filter({ hasText: '다른 곳에서 초안이 변경되었습니다' });
  await expect(conflict).toBeVisible();
  await expect(quantity).toHaveValue('3.00');
  await expect(page.getByRole('button', { name: '결재 상신', exact: true })).toBeDisabled();
  await conflict.getByRole('button', { name: '새로고침' }).click();
  await expect(conflict.getByRole('button', { name: '내 입력 다시 적용' })).toBeVisible();
  expect(updates).toHaveLength(1);
  await conflict.getByRole('button', { name: '내 입력 다시 적용' }).click();
  await expect(page.getByRole('status').filter({ hasText: '초안 저장 완료' })).toContainText('5');
  expect(updates).toHaveLength(2);
  expect(updates[1]).toMatchObject({
    expectedVersion: 4,
    payload: { items: [{ quantity: '3', price: '10.25', lineTotal: '30.75' }], total: '30.75' },
  });
});

test('Typed 초안의 invalid decimal은 편집값을 보존하며 저장과 상신을 실제로 전송하지 않는다', async ({
  page,
}) => {
  await typedSession(page);
  let writes = 0;
  await page.route(
    (url) =>
      /\/api\/approvals\/v1\/requests\/approval-request-001\/(draft|submit)$/u.test(url.pathname),
    (route) => {
      writes += 1;
      return failure(route, 500);
    }
  );
  await page.goto('/approvals/requests/new?draft=approval-request-001');
  const quantity = page.getByRole('textbox', { name: '수량', exact: true });
  await expect(quantity).toHaveValue('2');
  await quantity.fill('1e3');
  await expect(quantity).toHaveValue('1e3');
  await expect(page.getByRole('button', { name: '임시 저장', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '결재 상신', exact: true })).toBeDisabled();
  await page.waitForTimeout(1900);
  expect(writes).toBe(0);
  await quantity.fill('3');
  await expect(page.getByRole('button', { name: '임시 저장', exact: true })).toBeEnabled();
});

test('Typed marker가 있어도 advertised schema hash가 다르면 저장과 상신을 열지 않는다', async ({
  page,
}) => {
  await typedSession(page, '0'.repeat(64));
  await page.goto('/approvals/requests/new');
  await selectForm(page);
  await page.getByRole('textbox', { name: '제목', exact: true }).fill('검증되지 않은 양식');
  await expect(
    page.getByRole('alert').filter({ hasText: '이 양식의 구조를 확인할 수 없습니다' })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '임시 저장', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '결재 상신', exact: true })).toBeDisabled();
});

test('Typed 보완 요청은 계산값을 재평가하고 schema-complete canonical payload만 최신 요청 버전으로 전송한다', async ({
  page,
}) => {
  const { detail } = await typedSession(page);
  const request = {
    ...detail.request,
    status: 'NEEDS_INFO',
    latestInformationRequest: '정확한 수량을 보완해 주세요.',
  };
  const bodies: Record<string, unknown>[] = [];
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
    (route) => success(route, { ...detail, request })
  );
  await page.route(
    (url) =>
      url.pathname === '/api/approvals/v1/requests/approval-request-001/information-response',
    (route) => {
      bodies.push(route.request().postDataJSON() as Record<string, unknown>);
      return success(route, { ...request, status: 'IN_REVIEW', version: 4 });
    }
  );
  await page.goto('/approvals/requests/needs-info');
  await page.getByRole('button', { name: '보완 답변', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: '보완 답변을 제출할까요?' });
  const quantity = dialog.getByRole('textbox', { name: '수량', exact: true });
  await expect(quantity).toHaveValue('2');
  await quantity.fill('3.00');
  await dialog
    .getByRole('textbox', { name: '보완 답변', exact: true })
    .fill('확인한 수량을 정확하게 보완했습니다.');
  await expect(dialog.getByRole('textbox', { name: '합계', exact: true })).toHaveValue('30.75');
  await dialog.getByRole('button', { name: '답변 제출', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(bodies).toHaveLength(1);
  expect(bodies[0]).toMatchObject({
    expectedVersion: 3,
    payload: {
      category: 'STANDARD',
      items: [{ quantity: '3', price: '10.25', lineTotal: '30.75' }],
      total: '30.75',
      summary: APPROVAL_REQUEST_FIXTURE.summary,
      createdFrom: 'DWP_APPROVALS',
    },
  });
});
