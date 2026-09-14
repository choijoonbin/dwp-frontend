import { createHash } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Download, type Page, type Route } from '@playwright/test';
import { mockShellSession } from './support/shell-session';
import { mockApprovalProductSurfaceAuthority } from './support/product-surface-authority';
import { APPROVAL_MEMBER_PERMISSIONS } from './support/approval-command-center-fixtures';
import {
  approvalDocumentArtifact,
  approvalDocumentRequestDetail,
  approvalDocumentRequestId,
  approvalDocumentTools,
} from './support/approval-request-document-fixtures';

import type {
  ApprovalDocumentComment,
  ApprovalGeneratedDocument,
} from '@dwp-frontend/shared-utils/api/approval-document-contract';

const secondId = '77777777-7777-4777-8777-777777777777';
const success = (route: Route, data: unknown) =>
  route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data }),
  });
const error = (route: Route, status: number) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({ status: 'ERROR', message: 'Current document source unavailable' }),
  });
async function session(page: Page, { policyAllowed = true, mixedPolicy = false } = {}) {
  const sessionOptions: NonNullable<Parameters<typeof mockShellSession>[2]> = {
    userId: 1,
    displayName: '원래 요청 사용자',
    locale: 'ko',
    permissions: [
      ...APPROVAL_MEMBER_PERMISSIONS,
      {
        resourceType: 'ACTION',
        resourceKey: 'ACTION.APPROVAL_REQUEST',
        permissionCode: 'EXPORT',
        effect: 'ALLOW',
      },
    ],
  };
  await mockShellSession(page, ['WORKSPACE_MEMBER'], sessionOptions);
  await mockApprovalProductSurfaceAuthority(page, { surfaceUi: false });
  let sourceStatus = 200;
  let uncertainComment = false;
  const comments: ApprovalDocumentComment[] = [];
  const writes: { path: string; key?: string; body: Record<string, unknown> }[] = [];
  const artifacts: ApprovalGeneratedDocument[] = [];
  let nextTools: Readonly<{ started: () => void; wait: Promise<void> }> | undefined;
  const detail = (id: string) => ({
    ...approvalDocumentRequestDetail(id),
    request: {
      ...approvalDocumentRequestDetail(id).request,
      requestNumber: id === secondId ? 'APR-DOC-002' : 'APR-DOC-001',
    },
  });
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/requests/search',
    (route) =>
      success(route, {
        items: [detail(approvalDocumentRequestId).request, detail(secondId).request],
        totalElements: 2,
        totalPages: 1,
        page: 0,
        size: 20,
        hasNext: false,
        evaluatedAt: new Date().toISOString(),
      })
  );
  await page.route(
    (url) => /^\/api\/approvals\/v1\/requests\/[^/]+\/detail$/u.test(url.pathname),
    (route) => success(route, detail(new URL(route.request().url()).pathname.split('/')[5]!))
  );
  await page.route(
    (url) => /^\/api\/approvals\/v1\/requests\/[^/]+\/document-tools$/u.test(url.pathname),
    async (route) => {
      if (nextTools) {
        const gate = nextTools;
        nextTools = undefined;
        gate.started();
        await gate.wait;
      }
      if (sourceStatus !== 200) return error(route, sourceStatus);
      const id = new URL(route.request().url()).pathname.split('/')[5]!;
      const tools = approvalDocumentTools(id);
      return success(route, {
        ...tools,
        commentsVersion: id === approvalDocumentRequestId ? comments.length : 0,
        ...(mixedPolicy && id === secondId ? { resourceSetKey: 'RS_OTHER' } : {}),
        ...(!policyAllowed
          ? Object.fromEntries(
              ['comment', 'print', 'jsonExport', 'archiveExport'].map((key) => [
                key,
                { allowed: false, reason: 'POLICY_PROHIBITED' },
              ])
            )
          : {}),
      });
    }
  );
  await page.route(
    (url) => /^\/api\/approvals\/v1\/requests\/[^/]+\/comments$/u.test(url.pathname),
    (route) => {
      if (route.request().method() === 'GET')
        return success(route, {
          items: comments,
          totalElements: comments.length,
          page: 0,
          size: 25,
          commentsVersion: comments.length,
          evaluatedAt: new Date().toISOString(),
        });
      const body = route.request().postDataJSON() as Record<string, unknown>;
      const key = route.request().headers()['idempotency-key'];
      writes.push({ path: 'comment', key, body });
      expect(key).toBe(body.idempotencyKey);
      if (!comments.length)
        comments.push({
          commentId: '88888888-8888-4888-8888-888888888888',
          requestId: approvalDocumentRequestId,
          sourceTaskId: null,
          sequence: 1,
          authorUserId: 2,
          text: String(body.text),
          createdAt: new Date().toISOString(),
          retainUntil: new Date(Date.now() + 86400_000).toISOString(),
        });
      if (uncertainComment) {
        uncertainComment = false;
        return error(route, 503);
      }
      return success(route, comments[0]);
    }
  );
  await page.route(
    (url) => /^\/api\/approvals\/v1\/requests\/[^/]+\/document-exports$/u.test(url.pathname),
    async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      writes.push({ path: 'export', key: route.request().headers()['idempotency-key'], body });
      expect(writes.at(-1)!.key).toBe(body.idempotencyKey);
      const artifact = await approvalDocumentArtifact(body.intent as 'PRINT' | 'DOWNLOAD');
      artifacts.push(artifact);
      return success(route, artifact);
    }
  );
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/requests/archive/document-exports',
    async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      writes.push({ path: 'archive', key: route.request().headers()['idempotency-key'], body });
      expect(writes.at(-1)!.key).toBe(body.idempotencyKey);
      const artifact = await approvalDocumentArtifact(
        'DOWNLOAD',
        (body.items as { requestId: string }[]).map((item) => item.requestId)
      );
      artifacts.push(artifact);
      return success(route, artifact);
    }
  );
  return {
    writes,
    comments,
    artifacts,
    deny: (status: number) => {
      sourceStatus = status;
    },
    resultUnknown: () => {
      uncertainComment = true;
    },
    pauseNextTools: () => {
      let started!: () => void;
      let release!: () => void;
      const began = new Promise<void>((resolve) => {
        started = resolve;
      });
      const wait = new Promise<void>((resolve) => {
        release = resolve;
      });
      nextTools = { started, wait };
      return { began, release };
    },
    changeActor: () => {
      sessionOptions.userId = 2;
      sessionOptions.displayName = '새 요청 사용자';
    },
  };
}
async function viewer(page: Page) {
  await page.goto(`/approvals/requests/archive?request=${approvalDocumentRequestId}`);
  await expect(page).toHaveURL(
    new RegExp(`/approvals/requests/archive\\?request=${approvalDocumentRequestId}$`, 'u')
  );
  await expect(page.getByRole('heading', { name: '문서 도구', exact: true })).toBeVisible();
}
async function generate(page: Page, intent: 'PRINT' | 'DOWNLOAD') {
  const label = intent === 'PRINT' ? '문서 인쇄' : 'JSON 다운로드';
  await page.getByRole('button', { name: label, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '문서 내보내기', exact: true });
  await dialog
    .getByRole('textbox', { name: '사용 목적', exact: true })
    .fill('검증된 내부 업무 처리 목적');
  await dialog.getByRole('button', { name: label, exact: true }).click();
}
async function bytes(download: Download) {
  const stream = await download.createReadStream();
  if (!stream) throw new Error('No actual download stream');
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

test('기본 문서 정책은 댓글·인쇄·JSON 및 보관함 실행을 차단하고 실제 요청 기록을 읽기 전용으로 유지한다', async ({
  page,
}) => {
  const state = await session(page, { policyAllowed: false });
  await viewer(page);
  await expect(page.getByText('게시된 정책이나 현재 권한에서 허용되지 않습니다')).toBeVisible();
  await expect(page.getByRole('button', { name: '문서 인쇄', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'JSON 다운로드', exact: true })).toBeDisabled();
  await expect(page.getByRole('textbox', { name: '댓글 내용', exact: true })).toBeDisabled();
  expect(state.writes).toHaveLength(0);
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations).toEqual([]);
});
test('인쇄 미리보기 만료는 실제 iframe 원문을 제거하고 print 호출 없이 실행을 닫는다', async ({
  page,
}) => {
  const state = await session(page);
  await page.clock.install();
  await viewer(page);
  await generate(page, 'PRINT');
  const preview = page.getByRole('dialog', { name: '인쇄 미리보기', exact: true });
  await expect(preview.getByRole('button', { name: '문서 인쇄', exact: true })).toBeEnabled();
  await preview.locator('iframe').evaluate((element) => {
    (window as unknown as { prints: number }).prints = 0;
    (element as HTMLIFrameElement).contentWindow!.print = () => {
      (window as unknown as { prints: number }).prints += 1;
    };
  });
  await page.clock.fastForward(61_000);
  await expect(preview.getByRole('button', { name: '문서 인쇄', exact: true })).toBeDisabled();
  await expect(preview.locator('iframe')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { prints: number }).prints)).toBe(0);
  expect(state.writes).toHaveLength(1);
  await preview.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(preview).toBeHidden();
  await expect(page.getByRole('dialog').last()).toContainText('문서 도구');
});
test('인쇄 최종 검증 중 실제 세션 사용자가 바뀌면 이전 artifact는 print를 호출하지 않는다', async ({
  page,
}) => {
  const state = await session(page);
  await viewer(page);
  await generate(page, 'PRINT');
  const preview = page.getByRole('dialog', { name: '인쇄 미리보기', exact: true });
  await expect(preview.getByRole('button', { name: '문서 인쇄', exact: true })).toBeEnabled();
  await preview.locator('iframe').evaluate((element) => {
    (window as unknown as { prints: number }).prints = 0;
    (element as HTMLIFrameElement).contentWindow!.print = () => {
      (window as unknown as { prints: number }).prints += 1;
    };
  });
  const gate = state.pauseNextTools();
  await preview.getByRole('button', { name: '문서 인쇄', exact: true }).click();
  await gate.began;
  state.changeActor();
  const verification = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/auth/me'
  );
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  expect((await (await verification).json()).data.userId).toBe(2);
  await expect(preview).toBeHidden();
  gate.release();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { prints: number }).prints))
    .toBe(0);
  expect(state.writes).toHaveLength(1);
});
for (const status of [403, 503])
  test(`문서 도구 첫 ${status}는 캐시된 실행권한을 폐기하고 추가 POST를 차단한다`, async ({
    page,
  }) => {
    const state = await session(page);
    await viewer(page);
    await page.getByRole('textbox', { name: '댓글 내용', exact: true }).fill('원래 댓글 입력');
    await expect(page.getByRole('button', { name: '댓글 등록', exact: true })).toBeEnabled();
    state.deny(status);
    await page.getByRole('button', { name: '새로고침', exact: true }).click();
    await expect(
      page.getByText('문서 도구 확인에 실패했습니다. 새로고침 후 다시 확인하세요.')
    ).toBeVisible();
    await expect(page.getByRole('button', { name: '댓글 등록', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: '문서 인쇄', exact: true })).toBeDisabled();
    await expect(page.getByRole('textbox', { name: '댓글 내용', exact: true })).toHaveValue(
      status === 403 ? '' : '원래 댓글 입력'
    );
    expect(state.writes).toHaveLength(0);
  });
test('댓글 응답이 끊겨도 조회만으로 성공 처리하지 않으며 커밋된 순번에서 원래 키·본문만 재시도한다', async ({
  page,
}) => {
  const state = await session(page);
  state.resultUnknown();
  await viewer(page);
  await page.getByRole('textbox', { name: '댓글 내용', exact: true }).fill('원래 결재 요청 댓글');
  await page.getByRole('button', { name: '댓글 등록', exact: true }).click();
  await expect(page.getByText(/처리 결과를 확인할 수 없습니다/u).first()).toBeVisible();
  await expect(page.getByRole('button', { name: '닫기', exact: true }).last()).toBeDisabled();
  expect(state.writes).toHaveLength(1);
  await page.getByRole('button', { name: '새로고침', exact: true }).first().click();
  await expect(page.getByText('원래 결재 요청 댓글', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '댓글 내용', exact: true })).toHaveValue(
    '원래 결재 요청 댓글'
  );
  await expect(page.getByRole('button', { name: '댓글 등록', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '원래 요청 재시도', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '댓글 내용', exact: true })).toHaveValue('');
  expect(state.writes).toHaveLength(2);
  expect(state.writes[1]).toEqual(state.writes[0]);
  expect(state.comments).toHaveLength(1);
});
test('JSON 다운로드는 생성·최종 권한검증 후 실제 브라우저 파일의 UTF8 바이트·SHA·크기를 유지한다', async ({
  page,
}) => {
  const state = await session(page);
  await viewer(page);
  await generate(page, 'DOWNLOAD');
  await expect(page.getByText('문서를 생성했습니다', { exact: true })).toBeVisible();
  const downloaded = page.waitForEvent('download');
  await page
    .getByRole('status')
    .filter({ hasText: '문서를 생성했습니다' })
    .getByRole('button', { name: 'JSON 다운로드', exact: true })
    .click();
  const download = await downloaded;
  const actual = await bytes(download);
  const artifact = state.artifacts[0]!;
  expect(actual.toString('utf8')).toBe(artifact.content);
  expect(actual.byteLength).toBe(artifact.sizeBytes);
  expect(createHash('sha256').update(actual).digest('hex')).toBe(artifact.sha256);
  expect(download.suggestedFilename()).toBe(artifact.fileName);
  expect(JSON.parse(actual.toString('utf8')).documents[0].requestId).toBe(
    approvalDocumentRequestId
  );
  expect(state.writes).toHaveLength(1);
});
test('HTML 인쇄는 실제 sandbox 문서를 표시하고 최종 권한 회수 전까지만 print를 호출한다', async ({
  page,
}) => {
  const state = await session(page);
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await viewer(page);
  await generate(page, 'PRINT');
  const preview = page.getByRole('dialog', { name: '인쇄 미리보기', exact: true });
  const print = preview.getByRole('button', { name: '문서 인쇄', exact: true });
  await expect(print).toBeEnabled();
  await expect(preview.locator('iframe')).toHaveAttribute(
    'sandbox',
    'allow-same-origin allow-modals'
  );
  await expect(
    page.frameLocator('iframe').getByRole('heading', { name: '검토 완료 문서', exact: true })
  ).toBeVisible();
  await preview.locator('iframe').evaluate((element) => {
    const frame = element as HTMLIFrameElement;
    (window as unknown as { prints: number }).prints = 0;
    frame.contentWindow!.print = () => {
      (window as unknown as { prints: number }).prints += 1;
    };
  });
  await print.click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { prints: number }).prints))
    .toBe(1);
  state.deny(403);
  await print.click();
  await expect(
    page.getByText('문서 도구 확인에 실패했습니다. 새로고침 후 다시 확인하세요.').first()
  ).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { prints: number }).prints)).toBe(1);
  expect(state.writes).toHaveLength(1);
  await expect(page.getByRole('button', { name: '문서 인쇄', exact: true }).first()).toBeDisabled();
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations).toEqual([]);
});
test('보관함의 두 문서는 동일 게시 정책·resource set·버전으로만 일괄 JSON을 생성한다', async ({
  page,
}) => {
  const state = await session(page);
  await page.goto('/approvals/requests/archive');
  await page.getByRole('button', { name: '보관 문서 일괄 JSON 내보내기', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '보관 문서 일괄 JSON 내보내기', exact: true });
  await dialog.getByRole('checkbox').nth(0).check();
  await dialog.getByRole('checkbox').nth(1).check();
  await dialog
    .getByRole('textbox', { name: '사용 목적', exact: true })
    .fill('보관 문서 내부 검토 목적');
  await dialog.getByRole('button', { name: '보관 문서 일괄 JSON 내보내기', exact: true }).click();
  await expect(dialog.getByText('문서를 생성했습니다', { exact: true })).toBeVisible();
  expect(state.writes[0]!.body).toMatchObject({
    items: [
      { requestId: approvalDocumentRequestId, expectedVersion: 3, payloadRevision: 1 },
      { requestId: secondId, expectedVersion: 3, payloadRevision: 1 },
    ],
    expectedPolicyVersion: 2,
    expectedPolicyId: approvalDocumentTools().policyId,
    resourceSetKey: 'RS_DOC_CONTROL',
  });
  const downloaded = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'JSON 다운로드', exact: true }).click();
  const actual = await bytes(await downloaded);
  expect(createHash('sha256').update(actual).digest('hex')).toBe(state.artifacts[0]!.sha256);
  expect(actual.byteLength).toBe(state.artifacts[0]!.sizeBytes);
  expect(
    JSON.parse(actual.toString('utf8')).documents.map(
      (item: { requestId: string }) => item.requestId
    )
  ).toEqual([approvalDocumentRequestId, secondId]);
});
test('서로 다른 resource set 문서를 선택하면 입력은 유지하지만 일괄 내보내기 POST는 보내지 않는다', async ({
  page,
}) => {
  const state = await session(page, { mixedPolicy: true });
  await page.goto('/approvals/requests/archive');
  await page.getByRole('button', { name: '보관 문서 일괄 JSON 내보내기', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '보관 문서 일괄 JSON 내보내기', exact: true });
  await dialog.getByRole('checkbox').nth(0).check();
  await dialog.getByRole('checkbox').nth(1).check();
  await dialog.getByRole('textbox', { name: '사용 목적', exact: true }).fill('원래 내보내기 목적');
  await expect(
    dialog.getByText('선택 문서에 공통 정책이 없거나 내보내기가 허용되지 않습니다')
  ).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: '보관 문서 일괄 JSON 내보내기', exact: true })
  ).toBeDisabled();
  expect(state.writes).toHaveLength(0);
});
