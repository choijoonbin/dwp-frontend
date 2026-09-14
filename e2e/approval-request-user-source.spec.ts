import { expect, test, type Page, type Route } from '@playwright/test';

import { compileApprovalTypedForm } from '../apps/dwp/src/features/approvals/approval-form-typed-compiler';
import { mockShellSession } from './support/shell-session';
import {
  APPROVAL_ACTION_CAPABILITY,
  mockApprovalProductSurfaceAuthority,
} from './support/product-surface-authority';
import { APPROVAL_MEMBER_PERMISSIONS } from './support/approval-command-center-fixtures';
import {
  APPROVAL_FORM_FIXTURE,
  APPROVAL_FORM_DETAIL_FIXTURE,
  APPROVAL_REQUEST_DETAIL_FIXTURE,
  APPROVAL_REQUEST_FIXTURE,
  APPROVAL_WORKFLOW_DETAIL_FIXTURE,
  APPROVAL_WORKFLOW_FIXTURE,
} from './support/product-area-fixtures';

import type { ApprovalTypedFormSchema } from '@dwp-frontend/shared-utils/api/approval-form-typed-contract';

const formId = '11111111-1111-4111-8111-111111111111';
const formVersionId = '22222222-2222-4222-8222-222222222222';
const requestId = '33333333-3333-4333-8333-333333333333';
const person = {
  personPublicId: '44444444-4444-4444-8444-444444444444',
  displayName: '현재 사용자',
};
const schema: ApprovalTypedFormSchema = {
  schemaContract: 'DWP_APPROVAL_FORM_TYPED_V2',
  schemaVersion: 2,
  fields: [
    { key: 'summary', type: 'TEXTAREA', required: true, labelKo: '요청 내용', labelEn: 'Summary' },
    { key: 'reviewer', type: 'USER', required: true, labelKo: '검토자', labelEn: 'Reviewer' },
  ],
};
function success(route: Route, data: unknown) {
  return route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data }),
  });
}
async function session(page: Page) {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: APPROVAL_MEMBER_PERMISSIONS,
  });
  const authority = await mockApprovalProductSurfaceAuthority(page);
  await page.route('**/api/auth/product-surface-access/evaluate', async (route) => {
    const body = route.request().postDataJSON() as {
      routeContractKey: string;
      contextScopeKey: string;
    };
    const capability =
      APPROVAL_ACTION_CAPABILITY[body.routeContractKey as keyof typeof APPROVAL_ACTION_CAPABILITY];
    if (!capability) return route.fallback();
    const envelope = (await page.evaluate(async () =>
      (await fetch('/api/auth/product-surface-contexts')).json()
    )) as {
      data: {
        contexts: {
          surfaceKey: string;
          effectiveGrants: { grantKind: string; capabilityContractKey?: string }[];
          scopes: { key: string }[];
        }[];
      };
    };
    const current = envelope.data.contexts.find(
      (context) => context.surfaceKey === 'approvals.work'
    )!;
    const scope = current.scopes.find((scope) => scope.key === body.contextScopeKey)!;
    return success(route, {
      decision: 'ALLOWED',
      reasonCode: null,
      decisionRevision: authority.revision(),
      context: {
        ...current,
        effectiveGrants: current.effectiveGrants.filter(
          (grant) => grant.grantKind === 'CAPABILITY' && grant.capabilityContractKey === capability
        ),
      },
      routeGrantRef: `grant:${body.routeContractKey}`,
      scope,
      effectiveReadOnly: false,
      validUntil: null,
      revalidateAt: '2026-08-25T00:00:00Z',
    });
  });
  const compiled = await compileApprovalTypedForm(schema);
  let version = 3;
  let payload: Record<string, unknown> = {
    summary: APPROVAL_REQUEST_FIXTURE.summary,
    createdFrom: 'DWP_APPROVALS',
  };
  let sourceStatus = 200;
  const requests: number[] = [];
  const writes: { type: string; key?: string; body: Record<string, unknown> }[] = [];
  const detail = () => ({
    ...APPROVAL_REQUEST_DETAIL_FIXTURE,
    formId,
    formVersionId,
    formSchemaSha256: compiled.schemaSha256,
    formSchema: schema,
    payload,
    request: { ...APPROVAL_REQUEST_FIXTURE, requestId, status: 'DRAFT', version },
  });
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/catalog/forms',
    (route) => success(route, [{ ...APPROVAL_FORM_FIXTURE, formId }])
  );
  await page.route(
    (url) => url.pathname === `/api/approvals/v1/catalog/forms/${formId}/template`,
    (route) =>
      success(route, {
        workflow: APPROVAL_WORKFLOW_FIXTURE,
        routeDefinition: APPROVAL_WORKFLOW_DETAIL_FIXTURE.definition,
        form: {
          ...APPROVAL_FORM_DETAIL_FIXTURE,
          form: { ...APPROVAL_FORM_FIXTURE, formId },
          formVersionId,
          schema,
          schemaHash: compiled.schemaSha256,
        },
      })
  );
  await page.route(
    (url) => url.pathname === `/api/approvals/v1/requests/${requestId}/detail`,
    (route) => success(route, detail())
  );
  await page.route(
    (url) =>
      url.pathname ===
      `/api/approvals/v1/catalog/forms/${formId}/versions/${formVersionId}/field-candidates`,
    (route) => {
      expect(new URL(route.request().url()).searchParams.get('requestId')).toBe(requestId);
      if (sourceStatus !== 200)
        return route.fulfill({
          status: sourceStatus,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ERROR', message: 'Current source denied' }),
        });
      requests.push(version);
      return success(route, {
        formVersionId,
        schemaSha256: compiled.schemaSha256,
        fieldPath: 'reviewer',
        decisionRevision: authority.revision(),
        validUntil: new Date(Date.now() + 60_000).toISOString(),
        people: [person],
        mayBeTruncated: false,
        requestId,
        requestVersion: version,
      });
    }
  );
  await page.route(
    (url) => url.pathname === `/api/approvals/v1/requests/${requestId}/draft`,
    (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      writes.push({ type: 'draft', key: route.request().headers()['idempotency-key'], body });
      payload = body.payload as Record<string, unknown>;
      version += 1;
      return success(route, detail());
    }
  );
  await page.route(
    (url) => url.pathname === `/api/approvals/v1/requests/${requestId}/submit`,
    (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      writes.push({ type: 'submit', key: route.request().headers()['idempotency-key'], body });
      return success(route, { ...detail().request, status: 'SUBMITTED', version: version + 1 });
    }
  );
  return {
    writes,
    requests,
    deny: (status: number) => {
      sourceStatus = status;
    },
  };
}

test('USER 게시 양식은 실제 최소 조회로 선택한 UUID를 저장하고 새 저장 버전을 재검증한 뒤 original command key로 상신한다', async ({
  page,
}) => {
  const state = await session(page);
  await page.goto(`/approvals/requests/new?draft=${requestId}`);
  const input = page.getByRole('combobox', { name: '검토자', exact: true });
  await expect(input).toBeEnabled();
  await input.fill('현재');
  await page.getByRole('option', { name: person.displayName }).click();
  await page.getByRole('button', { name: '결재 상신', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '결재 상신', exact: true }).click();
  await expect.poll(() => state.writes.map((write) => write.type)).toEqual(['draft', 'submit']);
  await expect(page).toHaveURL(/\/approvals\/requests\/submitted(?:\?|$)/u);
  expect(state.writes.map((write) => write.type)).toEqual(['draft', 'submit']);
  expect(state.writes[0]!.body).toMatchObject({
    expectedVersion: 3,
    payload: { reviewer: person.personPublicId },
  });
  expect(state.writes[1]!.body).toEqual({ expectedVersion: 4 });
  expect(state.writes[1]!.key).toMatch(/^[A-Za-z0-9._:-]{1,120}$/u);
  expect(state.writes[1]!.key).not.toBe(state.writes[0]!.key);
  expect(state.requests).toContain(4);
});

for (const status of [403, 503]) {
  test(`USER 선택 이후 첫 ${status}는 조회 결과를 폐기하고 입력을 보존하며 저장·상신 POST를 차단한다`, async ({
    page,
  }) => {
    const state = await session(page);
    await page.goto(`/approvals/requests/new?draft=${requestId}`);
    const input = page.getByRole('combobox', { name: '검토자', exact: true });
    await expect(input).toBeEnabled();
    await input.fill('현재');
    await page.getByRole('option', { name: person.displayName }).click();
    state.deny(status);
    await input.fill('회수된 조회');
    await expect(page.getByText(/현재 사용자 조회 권한을 확인할 수 없습니다/u)).toBeVisible();
    await expect(page.getByRole('option', { name: person.displayName })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '임시 저장', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: '결재 상신', exact: true })).toBeDisabled();
    await expect(page.getByRole('textbox', { name: '제목', exact: true })).toHaveValue(
      APPROVAL_REQUEST_FIXTURE.title
    );
    expect(state.writes).toHaveLength(0);
  });
}
