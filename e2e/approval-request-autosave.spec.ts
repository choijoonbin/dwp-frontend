import { expect, test, type Page, type Route } from '@playwright/test';

import { mockShellSession } from './support/shell-session';
import { mockApprovalProductSurfaceAuthority } from './support/product-surface-authority';
import { APPROVAL_MEMBER_PERMISSIONS } from './support/approval-command-center-fixtures';
import {
  APPROVAL_REQUEST_DETAIL_FIXTURE,
  APPROVAL_REQUEST_FIXTURE,
} from './support/product-area-fixtures';

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
  await mockApprovalProductSurfaceAuthority(page, { surfaceUi: false });
}

async function selectForm(page: Page) {
  await page.getByLabel('결재 양식').click();
  await page.getByRole('option', { name: /데이터 접근 예외 신청서/u }).click();
}

test('부분 초안 자동저장과 저장 중 닫기는 최신 입력을 순서대로 저장하고 생성은 한 번만 수행한다', async ({
  page,
}) => {
  await session(page);
  let releaseCreate!: () => void;
  const pendingCreate = new Promise<void>((resolve) => {
    releaseCreate = resolve;
  });
  const creates: { body: Record<string, unknown>; key?: string }[] = [];
  const updates: { body: Record<string, unknown>; key?: string }[] = [];
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/requests',
    async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      const body = route.request().postDataJSON() as Record<string, unknown>;
      creates.push({ body, key: route.request().headers()['idempotency-key'] });
      await pendingCreate;
      return success(route, { ...APPROVAL_REQUEST_FIXTURE, ...body, status: 'DRAFT', version: 3 });
    }
  );
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/requests/approval-request-001/draft',
    (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      updates.push({ body, key: route.request().headers()['idempotency-key'] });
      return success(route, {
        ...APPROVAL_REQUEST_DETAIL_FIXTURE,
        request: { ...APPROVAL_REQUEST_FIXTURE, ...body, status: 'DRAFT', version: 4 },
        payload: body.payload,
      });
    }
  );

  await page.goto('/approvals/requests/new');
  await selectForm(page);
  await page.getByLabel('제목').fill('제목만 작성한 부분 초안');
  await expect(page.getByRole('status').filter({ hasText: '초안 저장 중' })).toBeVisible();
  expect(creates).toHaveLength(1);
  await page
    .getByLabel('요청 내용')
    .fill('첫 저장 요청 이후 추가한 입력도 닫기 전에 저장해야 합니다.');
  await page.getByRole('button', { name: '저장하고 닫기' }).click();
  await expect(page.getByLabel('요청 내용')).toBeDisabled();
  await expect(page).toHaveURL(/\/approvals\/requests\/new$/u);
  expect(updates).toHaveLength(0);
  releaseCreate();
  await expect(page).toHaveURL(/\/approvals\/requests\/drafts$/u);
  expect(creates).toHaveLength(1);
  expect(creates[0]!.body.summary).toBe('');
  expect(creates[0]!.key).toMatch(/^[A-Za-z0-9._:-]{1,120}$/u);
  expect(updates).toHaveLength(1);
  expect(updates[0]!.body).toMatchObject({
    expectedVersion: 3,
    summary: '첫 저장 요청 이후 추가한 입력도 닫기 전에 저장해야 합니다.',
  });
  expect(updates[0]!.key).toMatch(/^[A-Za-z0-9._:-]{1,120}$/u);
  expect(updates[0]!.key).not.toBe(creates[0]!.key);
});

test('자동저장 첫 503은 결과 불명으로 입력을 보존하고 다른 생성이나 상신을 차단한다', async ({
  page,
}) => {
  await session(page);
  let creates = 0;
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/requests',
    (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      creates += 1;
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ERROR', message: 'Draft save result unavailable' }),
      });
    }
  );
  await page.goto('/approvals/requests/new');
  await selectForm(page);
  await page.getByLabel('제목').fill('유실되면 안 되는 부분 초안');
  const unknown = page.getByRole('alert').filter({ hasText: '저장 결과를 확인할 수 없습니다' });
  await expect(unknown).toBeVisible();
  await expect(page.getByLabel('제목')).toHaveValue('유실되면 안 되는 부분 초안');
  await expect(page.getByRole('button', { name: '임시 저장' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '결재 상신' })).toBeDisabled();
  await page.getByLabel('요청 내용').fill('결과 확인 전의 추가 입력도 로컬에 보존합니다.');
  await page.waitForTimeout(2000);
  expect(creates).toBe(1);
  await expect(page.getByRole('status').filter({ hasText: '초안 저장 완료' })).toHaveCount(0);
});

test('수정 응답 유실은 최신 초안의 동일 입력과 버전을 확인한 뒤 저장 완료로 조정한다', async ({
  page,
}) => {
  await session(page);
  let version = 3;
  let body: Record<string, unknown> | undefined;
  let updates = 0;
  await page.route(
    (url) => url.pathname.startsWith('/api/approvals/v1/draft-commands/'),
    (route) =>
      success(route, {
        idempotencyKey: decodeURIComponent(
          new URL(route.request().url()).pathname.split('/').at(-1)!
        ),
        receipts: [
          {
            commandType: 'UPDATE',
            route: 'PUT /v1/requests/approval-request-001/draft',
            draft: {
              requestId: 'approval-request-001',
              version: 4,
              payloadRevision: 2,
              deletedAt: null,
              deletedBy: null,
            },
            completedAt: '2026-09-14T00:00:00Z',
          },
        ],
      })
  );
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/requests/approval-request-001/detail',
    (route) =>
      success(route, {
        ...APPROVAL_REQUEST_DETAIL_FIXTURE,
        request: { ...APPROVAL_REQUEST_FIXTURE, ...(body ?? {}), status: 'DRAFT', version },
        payload: body?.payload ?? APPROVAL_REQUEST_DETAIL_FIXTURE.payload,
      })
  );
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/requests/approval-request-001/draft',
    (route) => {
      updates += 1;
      body = route.request().postDataJSON() as Record<string, unknown>;
      version = 4;
      return route.abort('connectionfailed');
    }
  );
  await page.goto('/approvals/requests/new?draft=approval-request-001');
  await expect(page.getByLabel('요청 내용')).toHaveValue(APPROVAL_REQUEST_FIXTURE.summary);
  await page.getByLabel('요청 내용').fill('서버에는 저장되었지만 응답 연결이 끊긴 변경입니다.');
  const unknown = page.getByRole('alert').filter({ hasText: '저장 결과를 확인할 수 없습니다' });
  await expect(unknown).toBeVisible();
  await unknown.getByRole('button', { name: '저장 결과 확인' }).click();
  await expect(page.getByRole('status').filter({ hasText: '초안 저장 완료' })).toContainText('4');
  await expect(page.getByLabel('요청 내용')).toHaveValue(
    '서버에는 저장되었지만 응답 연결이 끊긴 변경입니다.'
  );
  expect(updates).toBe(1);
});

test('초안 생성 응답 유실은 같은 키의 실제 receipt와 저장된 입력을 확인해 중복 생성 없이 복구한다', async ({
  page,
}) => {
  await session(page);
  let creates = 0;
  let key = '';
  let body: Record<string, unknown> = {};
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/requests',
    (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      creates += 1;
      key = route.request().headers()['idempotency-key']!;
      body = route.request().postDataJSON() as Record<string, unknown>;
      return route.abort('connectionfailed');
    }
  );
  await page.route(
    (url) => url.pathname.startsWith('/api/approvals/v1/draft-commands/'),
    (route) => {
      expect(new URL(route.request().url()).pathname.split('/').at(-1)).toBe(key);
      return success(route, {
        idempotencyKey: key,
        receipts: [
          {
            commandType: 'CREATE',
            route: 'POST /v1/requests',
            draft: {
              requestId: 'approval-request-001',
              version: 3,
              payloadRevision: 1,
              deletedAt: null,
              deletedBy: null,
            },
            completedAt: '2026-09-14T00:00:00Z',
          },
        ],
      });
    }
  );
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/requests/approval-request-001/detail',
    (route) =>
      success(route, {
        ...APPROVAL_REQUEST_DETAIL_FIXTURE,
        request: { ...APPROVAL_REQUEST_FIXTURE, ...body, status: 'DRAFT', version: 3 },
        payload: body.payload,
      })
  );
  await page.goto('/approvals/requests/new');
  await selectForm(page);
  await page.getByLabel('제목').fill('생성 결과가 불명확한 부분 초안');
  const unknown = page.getByRole('alert').filter({ hasText: '저장 결과를 확인할 수 없습니다' });
  await expect(unknown).toBeVisible();
  await unknown.getByRole('button', { name: '저장 결과 확인' }).click();
  await expect(page.getByRole('status').filter({ hasText: '초안 저장 완료' })).toContainText('3');
  await expect(page.getByLabel('제목')).toHaveValue('생성 결과가 불명확한 부분 초안');
  expect(creates).toBe(1);
});

test('미확정 생성의 receipt 403은 원본을 격리하고 같은 키 확인 뒤 복원하며 빈 초안 재저장을 전송하지 않는다', async ({
  page,
}) => {
  await session(page);
  let creates = 0;
  let updates = 0;
  let reads = 0;
  let key = '';
  let body: Record<string, unknown> = {};
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/requests',
    (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      creates += 1;
      key = route.request().headers()['idempotency-key']!;
      body = route.request().postDataJSON() as Record<string, unknown>;
      return route.abort('connectionfailed');
    }
  );
  await page.route(
    (url) => url.pathname.startsWith('/api/approvals/v1/draft-commands/'),
    (route) => {
      reads += 1;
      expect(new URL(route.request().url()).pathname.split('/').at(-1)).toBe(key);
      if (reads === 1)
        return route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ERROR', message: 'Receipt access denied' }),
        });
      return success(route, {
        idempotencyKey: key,
        receipts: [
          {
            commandType: 'CREATE',
            route: 'POST /v1/requests',
            draft: {
              requestId: 'approval-request-001',
              version: 3,
              payloadRevision: 1,
              deletedAt: null,
              deletedBy: null,
            },
            completedAt: '2026-09-14T00:00:00Z',
          },
        ],
      });
    }
  );
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/requests/approval-request-001/detail',
    (route) =>
      success(route, {
        ...APPROVAL_REQUEST_DETAIL_FIXTURE,
        request: { ...APPROVAL_REQUEST_FIXTURE, ...body, status: 'DRAFT', version: 3 },
        payload: body.payload,
      })
  );
  await page.route(
    (url) => url.pathname.endsWith('/approval-request-001/draft'),
    (route) => {
      updates += 1;
      return route.abort();
    }
  );
  await page.goto('/approvals/requests/new');
  await selectForm(page);
  await page.getByLabel('제목').fill('receipt 권한 복구 전 보존할 원본');
  await page
    .getByLabel('요청 내용')
    .fill('실제 저장된 본문과 업무값을 빈 입력으로 덮어쓰지 않습니다.');
  await page.getByRole('textbox', { name: '업무 사유', exact: true }).fill('원본 업무 사유');
  const unknown = page.getByRole('alert').filter({ hasText: '저장 결과를 확인할 수 없습니다' });
  await expect(unknown).toBeVisible();
  await unknown.getByRole('button', { name: '저장 결과 확인' }).click();
  await expect(page.getByLabel('제목')).toHaveValue('');
  await expect(page.getByLabel('제목')).toBeDisabled();
  await expect(page.getByLabel('요청 내용')).toHaveValue('');
  await expect(page.getByLabel('결재 양식')).toBeDisabled();
  await page
    .getByRole('alert')
    .filter({ hasText: '요청을 처리하지 못했습니다' })
    .getByRole('button', { name: '새로고침', exact: true })
    .click();
  await expect(unknown).toBeVisible();
  await expect(page.getByLabel('제목')).toBeDisabled();
  await unknown.getByRole('button', { name: '저장 결과 확인' }).click();
  await expect(page.getByRole('status').filter({ hasText: '초안 저장 완료' })).toContainText('3');
  await expect(page.getByLabel('제목')).toHaveValue('receipt 권한 복구 전 보존할 원본');
  await expect(page.getByLabel('요청 내용')).toHaveValue(
    '실제 저장된 본문과 업무값을 빈 입력으로 덮어쓰지 않습니다.'
  );
  await expect(page.getByRole('textbox', { name: '업무 사유', exact: true })).toHaveValue(
    '원본 업무 사유'
  );
  await page.getByRole('button', { name: '임시 저장', exact: true }).click();
  await expect(page).toHaveURL(/\/approvals\/requests\/drafts$/u);
  expect(creates).toBe(1);
  expect(reads).toBe(2);
  expect(updates).toBe(0);
});

test('제목 없는 초안은 미완성 제목으로 표시하며 진행률을 사실처럼 생성하지 않는다', async ({
  page,
}) => {
  await session(page);
  await page.route(
    (url) =>
      url.pathname === '/api/approvals/v1/requests/search' &&
      url.searchParams.get('view') === 'DRAFTS',
    (route) =>
      success(route, {
        items: [
          { ...APPROVAL_REQUEST_FIXTURE, status: 'DRAFT', title: '', summary: '', version: 2 },
        ],
        totalElements: 1,
        totalPages: 1,
        page: 0,
        size: 20,
        hasNext: false,
        evaluatedAt: '2026-09-14T00:00:00Z',
      })
  );
  await page.goto('/approvals/requests/drafts');
  await expect(page.locator('main').getByRole('list').filter({ hasText: '제목 없음' })).toHaveCount(
    1
  );
});
