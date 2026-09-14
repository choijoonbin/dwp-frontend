import { createHash } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

import { mockShellSession } from './support/shell-session';
import { APPROVAL_MEMBER_PERMISSIONS } from './support/approval-command-center-fixtures';
import {
  APPROVAL_FORM_FIXTURE,
  APPROVAL_FORM_DETAIL_FIXTURE,
} from './support/product-area-fixtures';
import {
  broadcastProductSurfaceRevision,
  mockApprovalProductSurfaceAuthority,
} from './support/product-surface-authority';

import type { ApprovalTypedFormSchema } from '../libs/shared-utils/src/api/approval-form-typed-contract';

async function mockLegacyApprovalSurface(page: Page) {
  await mockApprovalProductSurfaceAuthority(page, { surfaceUi: false });
}

function fulfillSuccess(route: Route, data: unknown) {
  return route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data }),
  });
}

function typedAdminSchema(): ApprovalTypedFormSchema {
  return {
    schemaContract: 'DWP_APPROVAL_FORM_TYPED_V2',
    schemaVersion: 2,
    fields: [
      { key: 'summary', type: 'TEXTAREA', labelKo: '요약', labelEn: 'Summary', required: true },
      { key: 'amount', type: 'NUMBER', labelKo: '금액', labelEn: 'Amount' },
      {
        key: 'details',
        type: 'TEXT',
        labelKo: '추가 내용',
        labelEn: 'Details',
        visibleWhen: { op: 'GT', field: 'amount', value: '100' },
        requiredWhen: { op: 'GTE', field: 'amount', value: '200' },
      },
      {
        key: 'items',
        type: 'REPEATING_GROUP',
        labelKo: '구매 항목',
        labelEn: 'Items',
        maxRows: 2,
        fields: [
          { key: 'price', type: 'NUMBER', labelKo: '행 가격', labelEn: 'Price' },
          {
            key: 'line',
            type: 'CALCULATED_NUMBER',
            labelKo: '행 합계',
            labelEn: 'Line',
            calculation: { op: 'FIELD', field: 'price' },
          },
        ],
      },
      {
        key: 'total',
        type: 'CALCULATED_NUMBER',
        labelKo: '총액',
        labelEn: 'Total',
        calculation: { op: 'SUM', group: 'items', field: 'line' },
      },
    ],
  };
}

function typedAdminHash(schema: ApprovalTypedFormSchema): string {
  const canonical = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(canonical)
      : value !== null && typeof value === 'object'
        ? Object.fromEntries(
            Object.entries(value)
              .sort(([left], [right]) => left.localeCompare(right, 'en'))
              .map(([key, item]) => [key, canonical(item)])
          )
        : value;
  return createHash('sha256')
    .update(JSON.stringify(canonical(schema)))
    .digest('hex');
}

async function mockTypedFormAdmin(
  page: Page,
  corruptHash = false,
  publisher = false,
  options: { governed?: boolean; userFields?: boolean; published?: boolean } = {}
) {
  await mockShellSession(
    page,
    ['WORKSPACE_MEMBER', 'APPROVAL_DESIGNER', ...(publisher ? ['APPROVAL_PUBLISHER'] : [])],
    {
      locale: 'ko',
      permissions: [
        ...APPROVAL_MEMBER_PERMISSIONS,
        ...['VIEW', 'CREATE', 'UPDATE', ...(publisher ? ['APPROVE'] : [])].map(
          (permissionCode) => ({
            resourceType: 'ADMIN',
            resourceKey: 'ADMIN.APPROVAL_DESIGN',
            permissionCode,
            effect: 'ALLOW' as const,
          })
        ),
      ],
    }
  );
  const authority = options.governed
    ? await mockApprovalProductSurfaceAuthority(page, {
        generatedAt: new Date().toISOString(),
        revalidateAt: new Date(Date.now() + 3_600_000).toISOString(),
      })
    : undefined;
  if (!options.governed) await mockLegacyApprovalSurface(page);
  const state = {
    authority,
    formId: options.userFields
      ? '11111111-1111-1111-1111-111111111111'
      : APPROVAL_FORM_FIXTURE.formId,
    corruptHash,
    lifecycleState: options.published ? 'PUBLISHED' : 'DRAFT',
    formVersionId: '33333333-3333-3333-3333-333333333333' as string | null,
    version: APPROVAL_FORM_FIXTURE.version,
    schema: typedAdminSchema(),
    writes: [] as Record<string, unknown>[],
    creates: [] as Record<string, unknown>[],
  };
  if (options.userFields) {
    state.schema = {
      ...state.schema,
      fields: [
        ...state.schema.fields.map((field) =>
          field.type === 'REPEATING_GROUP'
            ? {
                ...field,
                fields: [
                  ...field.fields,
                  { key: 'owner', type: 'USER' as const, labelKo: '담당자', labelEn: 'Owner' },
                ],
              }
            : field
        ),
        { key: 'reviewer', type: 'USER', labelKo: '검토자', labelEn: 'Reviewer', required: true },
      ],
    };
  }
  const record = () => ({
    ...APPROVAL_FORM_FIXTURE,
    formId: state.formId,
    lifecycleState: state.lifecycleState,
    fieldCount: state.schema.fields.length,
    version: state.version,
  });
  const detail = () => ({
    ...APPROVAL_FORM_DETAIL_FIXTURE,
    form: record(),
    schema: state.schema,
    formVersionId: state.formVersionId,
    schemaHash: state.corruptHash ? '0'.repeat(64) : typedAdminHash(state.schema),
  });
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/admin/forms',
    (route) => {
      if (route.request().method() === 'POST') {
        const input = route.request().postDataJSON() as Record<string, unknown>;
        state.creates.push(input);
        state.schema = input.typedSchema as ApprovalTypedFormSchema;
        return fulfillSuccess(route, detail());
      }
      return fulfillSuccess(route, [record()]);
    }
  );
  await page.route(
    (url) =>
      [
        `/api/approvals/v1/admin/forms/${state.formId}`,
        `/api/approvals/v1/admin/forms/${state.formId}/draft`,
      ].includes(url.pathname),
    (route) => {
      if (route.request().method() === 'PUT') {
        const input = route.request().postDataJSON() as Record<string, unknown>;
        state.writes.push(input);
        state.schema = input.typedSchema as ApprovalTypedFormSchema;
        state.version += 1;
      }
      return fulfillSuccess(route, detail());
    }
  );
  return state;
}

async function mockAdminUserCandidates(
  page: Page,
  state: Awaited<ReturnType<typeof mockTypedFormAdmin>>
) {
  const candidates = { requests: [] as URL[], failure: false, ttl: 30_000 };
  await page.route(
    (url) => url.pathname.endsWith('/field-candidates'),
    (route) => {
      const url = new URL(route.request().url());
      candidates.requests.push(url);
      if (candidates.failure)
        return route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ERROR', message: 'Forbidden' }),
        });
      const group = url.searchParams.get('groupKey');
      const field = url.searchParams.get('fieldKey');
      return fulfillSuccess(route, {
        formVersionId: state.formVersionId,
        schemaSha256: typedAdminHash(state.schema),
        fieldPath: group ? `${group}.${field}` : field,
        decisionRevision: state.authority?.revision(),
        validUntil: new Date(Date.now() + candidates.ttl).toISOString(),
        people: [{ personPublicId: '44444444-4444-4444-4444-444444444444', displayName: '김검토' }],
        mayBeTruncated: false,
        requestId: null,
        requestVersion: null,
      });
    }
  );
  return candidates;
}

test('고급 양식은 실제 조건·반복 계산·숫자 문자열과 편집 시작 버전을 보존한다', async ({
  page,
  isMobile,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const state = await mockTypedFormAdmin(page);
  await page.goto('/approvals/admin/forms');
  if (isMobile)
    await page.getByRole('button').filter({ hasText: APPROVAL_FORM_FIXTURE.nameKo }).click();
  await page.getByRole('button', { name: '양식 초안 편집', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '양식 초안 편집', exact: true });
  const previewPanel = async () => {
    if (isMobile) await editor.getByRole('button', { name: '양식 미리보기', exact: true }).click();
    return editor.getByRole('region', { name: '양식 미리보기', exact: true });
  };
  const preview = await previewPanel();
  await preview.getByRole('textbox', { name: '요약', exact: true }).fill('실제 검토 내용');
  await preview.getByRole('textbox', { name: '금액', exact: true }).fill('100');
  await expect(preview.getByRole('textbox', { name: '추가 내용', exact: true })).toHaveCount(0);
  await preview.getByRole('textbox', { name: '금액', exact: true }).fill('200');
  await expect(preview.getByRole('textbox', { name: '추가 내용', exact: true })).toHaveAttribute(
    'aria-required',
    'true'
  );
  await preview.getByRole('button', { name: '미리보기 검증', exact: true }).click();
  await expect(preview.getByText('미리보기 값이 필드 규칙을 충족하지 않습니다.')).toBeVisible();
  await preview.getByRole('textbox', { name: '추가 내용', exact: true }).fill('필수 배경');
  await preview.getByRole('button', { name: '행 추가', exact: true }).click();
  await preview
    .getByRole('textbox', { name: '행 가격', exact: true })
    .fill('12345678901234567890.12345678');
  await expect(preview.getByRole('textbox', { name: '행 가격', exact: true })).toHaveAttribute(
    'inputmode',
    'decimal'
  );
  await expect(preview.getByRole('textbox', { name: '총액', exact: true })).toHaveValue(
    '12345678901234567890.12345678'
  );
  await preview.getByRole('button', { name: '미리보기 검증', exact: true }).click();
  await expect(preview.getByText('미리보기 값이 상신 규칙을 충족합니다.')).toBeVisible();
  await preview
    .getByRole('region', { name: '구매 항목', exact: true })
    .getByRole('button', { name: '필드 속성', exact: true })
    .first()
    .click();
  await expect(editor.getByRole('spinbutton', { name: '최대 행 수', exact: true })).toHaveValue(
    '2'
  );
  if (isMobile) await editor.getByRole('button', { name: '필드 목록으로', exact: true }).click();
  await editor.locator('[data-approval-typed-field="items.price"]').click();
  await expect(editor.getByRole('textbox', { name: '필드 키', exact: true })).toBeDisabled();
  await expect(editor.getByRole('combobox', { name: /^필드 유형/u })).toBeDisabled();
  await editor
    .getByRole('textbox', { name: '최솟값', exact: true })
    .fill('12345678901234567890.12345678');
  await expect(editor.getByRole('button', { name: '저장', exact: true })).toBeEnabled();
  await expect(editor.locator('input:invalid,textarea:invalid,select:invalid')).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath('typed-form-builder-original-layout.png'),
    fullPage: false,
  });
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
  state.version += 1;
  await editor.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(editor.getByRole('button', { name: '저장', exact: true })).toBeDisabled();
  await expect(editor.getByRole('textbox', { name: '최솟값', exact: true })).toHaveValue(
    '12345678901234567890.12345678'
  );
  expect(state.writes).toHaveLength(0);
  await editor.getByRole('button', { name: '취소', exact: true }).click();
  await page.getByRole('button', { name: '양식 초안 편집', exact: true }).click();
  await editor
    .getByRole('textbox', { name: '한국어 이름', exact: true })
    .fill('고급 양식 최신 버전');
  await editor.locator('[data-approval-typed-field="items.price"]').click();
  await editor
    .getByRole('textbox', { name: '최솟값', exact: true })
    .fill('12345678901234567890.12345678');
  await expect(editor.getByRole('button', { name: '저장', exact: true })).toBeEnabled();
  const version = state.version;
  await editor.getByRole('button', { name: '저장', exact: true }).click();
  await expect.poll(() => state.writes.length).toBe(1);
  expect(state.writes[0]).toMatchObject({
    expectedVersion: version,
    nameKo: '고급 양식 최신 버전',
    typedSchema: { schemaContract: 'DWP_APPROVAL_FORM_TYPED_V2', schemaVersion: 2 },
  });
  expect(state.writes[0]).not.toHaveProperty('fields');
  const savedSchema = state.writes[0].typedSchema as ApprovalTypedFormSchema;
  const savedGroup = savedSchema.fields.find((field) => field.key === 'items');
  expect(
    savedGroup?.type === 'REPEATING_GROUP' &&
      savedGroup.fields.find((field) => field.key === 'price')
  ).toHaveProperty('min', '12345678901234567890.12345678');
});

test('고급 양식의 저장된 정의 해시 불일치는 편집과 게시를 열지 않는다', async ({
  page,
  isMobile,
}) => {
  const state = await mockTypedFormAdmin(page, true, true);
  await page.goto('/approvals/admin/forms');
  if (isMobile)
    await page.getByRole('button').filter({ hasText: APPROVAL_FORM_FIXTURE.nameKo }).click();
  await expect(page.getByText('저장된 스키마 해시를 검증할 수 없습니다.')).toBeVisible();
  await expect(page.getByRole('button', { name: '양식 초안 편집', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '게시', exact: true })).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
  state.corruptHash = false;
  await page.reload();
  if (isMobile)
    await page.getByRole('button').filter({ hasText: APPROVAL_FORM_FIXTURE.nameKo }).click();
  await expect(page.getByRole('button', { name: '양식 초안 편집', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '게시', exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(0);
});

test('고급 양식 생성은 실제 유형 선택과 파괴적 유형 변경 확인을 제공한다', async ({
  page,
  isMobile,
}) => {
  const state = await mockTypedFormAdmin(page);
  await page.goto('/approvals/admin/forms');
  await page.getByRole('button', { name: '새 고급 양식', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '새 결재 양식', exact: true });
  await expect(editor).toBeVisible();
  await editor.getByRole('button', { name: '필드 추가', exact: true }).click();
  await page.getByRole('menuitem', { name: '숫자', exact: true }).click();
  const key = editor.getByRole('textbox', { name: '필드 키', exact: true });
  await key.fill('');
  await key.pressSequentially('precisionValue');
  await expect(key).toHaveValue('precisionValue');
  await editor.getByRole('textbox', { name: '한국어 레이블', exact: true }).fill('정밀 금액');
  await editor.getByRole('textbox', { name: '영어 레이블', exact: true }).fill('Precision value');
  await editor.getByRole('textbox', { name: '최솟값', exact: true }).fill('0.00000001');
  await editor.getByRole('combobox', { name: /^필드 유형/u }).click();
  await page.getByRole('option', { name: '계산된 숫자', exact: true }).click();
  const confirmation = page.getByRole('alertdialog', { name: '필드 유형 변경', exact: true });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: '유형 변경', exact: true }).click();
  await expect(editor.getByRole('textbox', { name: '최솟값', exact: true })).toHaveValue('');
  const calculation = editor.getByRole('region', { name: '계산식', exact: true });
  await calculation
    .getByRole('textbox', { name: '값', exact: true })
    .fill('12345678901234567890.12345678');
  await expect(editor.getByText('양식 정의 검증 완료', { exact: true })).toBeVisible();
  if (isMobile) await editor.getByRole('button', { name: '양식 미리보기', exact: true }).click();
  await expect(
    editor
      .getByRole('region', { name: '양식 미리보기', exact: true })
      .getByRole('textbox', { name: '정밀 금액', exact: true })
  ).toHaveValue('12345678901234567890.12345678');
  await expect(editor.getByRole('button', { name: '저장', exact: true })).toBeDisabled();
  await editor.getByRole('textbox', { name: '양식 키', exact: true }).fill('TYPED_PRECISION_FORM');
  await editor.getByRole('textbox', { name: '한국어 이름', exact: true }).fill('고급 정밀 양식');
  await editor
    .getByRole('textbox', { name: '영어 이름', exact: true })
    .fill('Advanced precision form');
  await editor
    .getByRole('textbox', { name: '한국어 설명', exact: true })
    .fill('문자열 정밀 금액과 실제 계산식을 검증합니다.');
  await editor
    .getByRole('textbox', { name: '영어 설명', exact: true })
    .fill('Validate canonical decimal strings and real calculations.');
  await expect(editor.getByRole('button', { name: '저장', exact: true })).toBeEnabled();
  await editor.getByRole('button', { name: '저장', exact: true }).click();
  await expect.poll(() => state.creates.length).toBe(1);
  expect(state.creates[0]).not.toHaveProperty('fields');
  const createdSchema = state.creates[0].typedSchema as ApprovalTypedFormSchema;
  expect(createdSchema.fields.find((field) => field.key === 'precisionValue')).toMatchObject({
    type: 'CALCULATED_NUMBER',
    calculation: { op: 'CONST', value: '12345678901234567890.12345678' },
  });
});

test('관리자 USER 미리보기는 초안 검색을 막고 게시 버전·해시에 결속된 실제 후보만 선택한다', async ({
  page,
  isMobile,
}, testInfo) => {
  const state = await mockTypedFormAdmin(page, false, false, { governed: true, userFields: true });
  const candidates = await mockAdminUserCandidates(page, state);
  await page.goto('/approvals/admin/forms');
  if (isMobile)
    await page.getByRole('button').filter({ hasText: APPROVAL_FORM_FIXTURE.nameKo }).click();
  await page.getByRole('button', { name: '양식 초안 편집', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '양식 초안 편집', exact: true });
  if (isMobile) await editor.getByRole('button', { name: '양식 미리보기', exact: true }).click();
  const draftPreview = editor.getByRole('region', { name: '양식 미리보기', exact: true });
  await expect(draftPreview.getByRole('textbox', { name: '검토자', exact: true })).toBeDisabled();
  await expect(draftPreview.getByRole('textbox', { name: '검토자', exact: true })).toHaveAttribute(
    'readonly',
    ''
  );
  await draftPreview.getByRole('button', { name: '행 추가', exact: true }).click();
  await expect(draftPreview.getByRole('textbox', { name: '담당자', exact: true })).toBeDisabled();
  await page.waitForTimeout(450);
  expect(candidates.requests).toHaveLength(0);
  await editor.getByRole('button', { name: '취소', exact: true }).click();
  state.lifecycleState = 'PUBLISHED';
  await page.reload();
  await expect(page).toHaveURL(/\/approvals\/admin\/forms\?scope=/);
  if (isMobile)
    await page.getByRole('button').filter({ hasText: APPROVAL_FORM_FIXTURE.nameKo }).click();
  const published = page.getByRole('region', { name: '게시된 양식 미리보기', exact: true });
  const preview = published.getByRole('region', { name: '양식 미리보기', exact: true });
  const reviewer = preview.getByRole('combobox', { name: '검토자', exact: true });
  await expect(reviewer).toBeEnabled();
  await reviewer.fill('김검');
  await expect(reviewer).toHaveValue('김검');
  await page.getByRole('option', { name: '김검토', exact: true }).click();
  await preview.getByRole('textbox', { name: '요약', exact: true }).fill('게시 버전 검증');
  await preview.getByRole('button', { name: '행 추가', exact: true }).click();
  await preview.getByRole('combobox', { name: '담당자', exact: true }).fill('김검');
  await page.getByRole('option', { name: '김검토', exact: true }).click();
  expect(candidates.requests).toHaveLength(2);
  for (const url of candidates.requests) {
    expect(url.pathname).toBe(
      `/api/approvals/v1/admin/forms/${state.formId}/versions/${state.formVersionId}/field-candidates`
    );
    expect(url.searchParams.get('schemaSha256')).toBe(typedAdminHash(state.schema));
  }
  expect(candidates.requests[1].searchParams.get('groupKey')).toBe('items');
  expect(candidates.requests[1].searchParams.get('fieldKey')).toBe('owner');
  await preview.getByRole('button', { name: '미리보기 검증', exact: true }).click();
  await expect(preview.getByText('미리보기 값이 상신 규칙을 충족합니다.')).toBeVisible();
  await reviewer.focus();
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await expect(page.locator('.MuiTouchRipple-childLeaving')).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('typed-form-admin-user-preview.png') });
  expect(state.writes).toHaveLength(0);
  expect(state.creates).toHaveLength(0);
  const requestCount = candidates.requests.length;
  state.corruptHash = true;
  await page.reload();
  if (isMobile)
    await page.getByRole('button').filter({ hasText: APPROVAL_FORM_FIXTURE.nameKo }).click();
  await expect(page.getByText('저장된 스키마 해시를 검증할 수 없습니다.')).toBeVisible();
  await expect(page.getByRole('combobox', { name: '검토자', exact: true })).toHaveCount(0);
  expect(candidates.requests).toHaveLength(requestCount);
  state.corruptHash = false;
  state.formVersionId = null;
  await page.reload();
  if (isMobile)
    await page.getByRole('button').filter({ hasText: APPROVAL_FORM_FIXTURE.nameKo }).click();
  await expect(page.getByRole('combobox', { name: '검토자', exact: true })).toHaveCount(0);
  expect(candidates.requests).toHaveLength(requestCount);
});

test('관리자 USER 후보 만료·첫 권한 실패·현재 컨텍스트 회수는 이전 선택을 즉시 폐기한다', async ({
  page,
  isMobile,
}) => {
  const state = await mockTypedFormAdmin(page, false, false, {
    governed: true,
    userFields: true,
    published: true,
  });
  const candidates = await mockAdminUserCandidates(page, state);
  candidates.ttl = 1_500;
  await page.goto('/approvals/admin/forms');
  await expect(page).toHaveURL(/\/approvals\/admin\/forms\?scope=/);
  if (isMobile)
    await page.getByRole('button').filter({ hasText: APPROVAL_FORM_FIXTURE.nameKo }).click();
  const preview = page
    .getByRole('region', { name: '게시된 양식 미리보기', exact: true })
    .getByRole('region', { name: '양식 미리보기', exact: true });
  await preview.getByRole('textbox', { name: '요약', exact: true }).fill('회수 검증');
  const reviewer = preview.getByRole('combobox', { name: '검토자', exact: true });
  await expect(reviewer).toBeEnabled();
  await reviewer.fill('김검');
  await expect(reviewer).toHaveValue('김검');
  await page.getByRole('option', { name: '김검토', exact: true }).click();
  await preview.getByRole('button', { name: '미리보기 검증', exact: true }).click();
  await expect(preview.getByText('미리보기 값이 상신 규칙을 충족합니다.')).toBeVisible();
  await expect(preview.getByText('미리보기 값이 상신 규칙을 충족합니다.')).toHaveCount(0);
  await preview.getByRole('button', { name: '미리보기 검증', exact: true }).click();
  await expect(preview.getByText('미리보기 값이 필드 규칙을 충족하지 않습니다.')).toBeVisible();
  candidates.ttl = 30_000;
  await reviewer.fill('김검토자');
  await page.getByRole('option', { name: '김검토', exact: true }).click();
  candidates.failure = true;
  await reviewer.fill('권한 회수');
  await expect(page.getByRole('option')).toHaveCount(0);
  await expect(
    preview.getByText(
      '게시 버전, 스키마 및 접근 컨텍스트가 확인되기 전에는 사용자를 검색할 수 없습니다.'
    )
  ).toBeVisible();
  await preview.getByRole('button', { name: '미리보기 검증', exact: true }).click();
  await expect(preview.getByText('미리보기 값이 필드 규칙을 충족하지 않습니다.')).toBeVisible();
  const requestCount = candidates.requests.length;
  state.authority!.revoke('approvals.admin');
  await broadcastProductSurfaceRevision(page, state.authority!.revision());
  await expect(page.getByRole('combobox', { name: '검토자', exact: true })).toHaveCount(0);
  expect(candidates.requests).toHaveLength(requestCount);
  expect(state.writes).toHaveLength(0);
  expect(state.creates).toHaveLength(0);
});

test('고급 양식은 실제 도구 설명과 320px·200%·대비 모드에서 접근 가능하다', async ({
  page,
  isMobile,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await mockTypedFormAdmin(page);
  await page.goto('/approvals/admin/forms');
  if (isMobile)
    await page.getByRole('button').filter({ hasText: APPROVAL_FORM_FIXTURE.nameKo }).click();
  await page.getByRole('button', { name: '양식 초안 편집', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '양식 초안 편집', exact: true });
  if (isMobile) await editor.getByRole('button', { name: '양식 미리보기', exact: true }).click();
  const preview = editor.getByRole('region', { name: '양식 미리보기', exact: true });
  await preview.getByRole('button', { name: '필드 속성', exact: true }).first().hover();
  const tooltip = page.getByRole('tooltip', { name: '필드 속성', exact: true });
  await expect(tooltip).toBeVisible();
  await expect
    .poll(() => tooltip.evaluate((element) => getComputedStyle(element.parentElement!).opacity))
    .toBe('1');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath('typed-form-tooltip-dark.png'),
    fullPage: false,
  });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ forcedColors: 'active' });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await editor.getByRole('button', { name: '양식 미리보기', exact: true }).click();
  await expect(preview.getByRole('textbox', { name: '요약', exact: true })).toBeVisible();
  await expect(preview.getByRole('textbox', { name: '총액', exact: true })).toBeVisible();
  const overflow = await editor.evaluate((element) =>
    [...element.querySelectorAll<HTMLElement>('section,fieldset')]
      .filter((item) => item.scrollWidth > item.clientWidth + 1)
      .map((item) => ({
        label: item.getAttribute('aria-label'),
        width: item.clientWidth,
        scroll: item.scrollWidth,
      }))
  );
  expect(overflow).toEqual([]);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath('typed-form-320-forced-colors.png'),
    fullPage: false,
  });
});

test('고급 양식의 잘못된 런타임 필드는 렌더러 충돌 없이 닫힌다', async ({ page, isMobile }) => {
  const state = await mockTypedFormAdmin(page);
  state.schema = { ...typedAdminSchema(), fields: [null] } as unknown as ApprovalTypedFormSchema;
  const crashes: string[] = [];
  page.on('pageerror', (error) => crashes.push(error.message));
  await page.goto('/approvals/admin/forms');
  if (isMobile)
    await page.getByRole('button').filter({ hasText: APPROVAL_FORM_FIXTURE.nameKo }).click();
  await expect(page.getByText('저장된 스키마 해시를 검증할 수 없습니다.')).toBeVisible();
  await expect(page.getByRole('button', { name: '양식 초안 편집', exact: true })).toHaveCount(0);
  expect(crashes).toEqual([]);
  expect(state.writes).toHaveLength(0);
});

test('선택 캔버스와 속성 검사기는 실제 필드·그룹 복제를 같은 버전으로 저장한다', async ({
  page,
  isMobile,
}, testInfo) => {
  const state = await mockTypedFormAdmin(page);
  await page.goto('/approvals/admin/forms');
  if (isMobile)
    await page.getByRole('button').filter({ hasText: APPROVAL_FORM_FIXTURE.nameKo }).click();
  await page.getByRole('button', { name: '양식 초안 편집', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '양식 초안 편집', exact: true });
  if (isMobile) await editor.getByRole('button', { name: '양식 미리보기', exact: true }).click();
  const preview = editor.getByRole('region', { name: '양식 미리보기', exact: true });
  const summary = preview.locator('[data-approval-typed-canvas-field="summary"]');
  await expect(summary.getByRole('button', { name: '필드 복제', exact: true })).toBeDisabled();
  await expect(summary.getByRole('button', { name: '필드 제거', exact: true })).toBeDisabled();
  await preview.getByRole('textbox', { name: '금액', exact: true }).focus();
  await preview
    .locator('[data-approval-typed-canvas-field="amount"]')
    .getByRole('button', { name: '필드 복제', exact: true })
    .click();
  const inspector = editor.getByRole('group', { name: '필드 속성', exact: true });
  await expect(inspector.getByRole('textbox', { name: '필드 키', exact: true })).toHaveValue(
    'amount_copy_1'
  );
  await expect(inspector.getByRole('textbox', { name: '필드 키', exact: true })).toBeEnabled();
  await inspector.getByRole('textbox', { name: '한국어 레이블', exact: true }).fill('복제 금액');
  await inspector.getByRole('textbox', { name: '영어 레이블', exact: true }).fill('Copied amount');
  await inspector
    .getByRole('textbox', { name: '최솟값', exact: true })
    .fill('12345678901234567890.12345678');
  await expect(editor.getByRole('button', { name: '저장', exact: true })).toBeEnabled();
  if (isMobile) await editor.getByRole('button', { name: '양식 미리보기', exact: true }).click();
  await preview.getByRole('textbox', { name: '복제 금액', exact: true }).focus();
  await preview
    .locator('[data-approval-typed-canvas-field="amount_copy_1"]')
    .getByRole('button', { name: '아래로 이동', exact: true })
    .click();
  const selectedCanvas = preview.locator('[data-approval-typed-canvas-field="amount_copy_1"]');
  await expect(
    selectedCanvas.getByRole('button', { name: '필드 복제', exact: true })
  ).toBeEnabled();
  await expect(
    selectedCanvas.getByRole('button', { name: '필드 제거', exact: true })
  ).toBeEnabled();
  await selectedCanvas.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath('typed-form-selected-canvas-toolbar.png'),
    fullPage: false,
  });
  if (isMobile) await editor.getByRole('button', { name: '필드 목록으로', exact: true }).click();
  await editor.locator('[data-approval-typed-field="items"]').click();
  await inspector.getByRole('button', { name: '필드 복제', exact: true }).click();
  await expect(inspector.getByRole('textbox', { name: '필드 키', exact: true })).toHaveValue(
    'items_copy_1'
  );
  await expect(inspector.getByRole('spinbutton', { name: '최대 행 수', exact: true })).toHaveValue(
    '2'
  );
  expect(state.writes).toHaveLength(0);
  if (isMobile) {
    await page.setViewportSize({ width: 320, height: 844 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await editor.getByRole('button', { name: '양식 미리보기', exact: true }).click();
  }
  await expect(
    preview.getByRole('region', { name: '구매 항목 (items)', exact: true })
  ).toBeVisible();
  const copiedGroup = preview.getByRole('region', {
    name: '구매 항목 (items_copy_1)',
    exact: true,
  });
  await expect(copiedGroup).toBeVisible();
  expect(
    await preview.evaluate((element) => element.scrollWidth - element.clientWidth)
  ).toBeLessThanOrEqual(1);
  await copiedGroup.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath('typed-form-copied-group-toolbar.png'),
    fullPage: false,
  });
  if (isMobile) await copiedGroup.getByRole('button', { name: '필드 속성', exact: true }).click();
  await inspector.getByRole('textbox', { name: '한국어 레이블', exact: true }).focus();
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath('typed-form-copy-toolbar.png'),
    fullPage: false,
  });
  const version = state.version;
  await editor.getByRole('button', { name: '저장', exact: true }).click();
  await expect.poll(() => state.writes.length).toBe(1);
  expect(state.writes[0]).toHaveProperty('expectedVersion', version);
  const saved = state.writes[0].typedSchema as ApprovalTypedFormSchema;
  expect(saved.fields.find((field) => field.key === 'amount')).not.toHaveProperty('min');
  expect(saved.fields.find((field) => field.key === 'amount_copy_1')).toHaveProperty(
    'min',
    '12345678901234567890.12345678'
  );
  const group = saved.fields.find((field) => field.key === 'items_copy_1');
  expect(
    group?.type === 'REPEATING_GROUP' && group.fields.find((field) => field.key === 'line')
  ).toHaveProperty('calculation', { op: 'FIELD', field: 'price' });
  expect(saved.fields.find((field) => field.key === 'total')).toHaveProperty('calculation', {
    op: 'SUM',
    group: 'items',
    field: 'line',
  });
});
