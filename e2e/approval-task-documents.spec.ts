import { createHash } from 'node:crypto';
import { expect, test, type Page, type Route } from '@playwright/test';
import { mockShellSession } from './support/shell-session';
import { mockApprovalProductSurfaceAuthority } from './support/product-surface-authority';
import { APPROVAL_MEMBER_PERMISSIONS } from './support/approval-command-center-fixtures';
import { APPROVAL_TASK_DETAIL_FIXTURE } from './support/product-area-fixtures';
import { approvalTaskSearchPage } from './support/approval-search-fixtures';
import {
  approvalDocumentArtifact,
  approvalDocumentRequestId,
  approvalDocumentTools,
} from './support/approval-request-document-fixtures';
import type {
  ApprovalDocumentComment,
  ApprovalGeneratedDocument,
} from '@dwp-frontend/shared-utils/api/approval-document-contract';

const taskId = '22222222-2222-4222-8222-222222222222';
const success = (route: Route, data: unknown) =>
  route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data }) });
const failure = (route: Route, status: number) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({ message: 'Source unavailable' }),
  });

async function viewer(page: Page, policyAllowed = true) {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: APPROVAL_MEMBER_PERMISSIONS,
  });
  // Exercise the actual production component/API and canonical v8 bindings,
  // not a claim that governed rollout or tenant export policy is enabled.
  await mockApprovalProductSurfaceAuthority(page, { surfaceUi: false });
  const task = {
    ...APPROVAL_TASK_DETAIL_FIXTURE.task,
    taskId,
    requestId: approvalDocumentRequestId,
    title: '현재 결재 업무의 검토 문서',
    status: 'CLAIMED',
    version: 3,
  };
  let toolsStatus = 200;
  let unknown = false;
  const comments: ApprovalDocumentComment[] = [];
  const writes: { key?: string; body: Record<string, unknown> }[] = [];
  const artifacts: ApprovalGeneratedDocument[] = [];
  await page.route('**/api/approvals/v1/tasks/search?*', (route) =>
    success(route, approvalTaskSearchPage(new URL(route.request().url()), [task]))
  );
  await page.route(`**/api/approvals/v1/tasks/${taskId}`, (route) =>
    success(route, { ...APPROVAL_TASK_DETAIL_FIXTURE, task })
  );
  await page.route(`**/api/approvals/v1/tasks/${taskId}/document-tools`, (route) => {
    if (toolsStatus !== 200) return failure(route, toolsStatus);
    const capability = {
      allowed: policyAllowed,
      reason: policyAllowed ? 'ALLOWED' : 'POLICY_PROHIBITED',
    };
    return success(route, {
      ...approvalDocumentTools(),
      taskId,
      taskVersion: 3,
      commentsVersion: comments.length,
      comment: capability,
      print: capability,
      jsonExport: capability,
    });
  });
  await page.route(`**/api/approvals/v1/tasks/${taskId}/comments*`, (route) => {
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
    writes.push({ key, body });
    expect(key).toBe(body.idempotencyKey);
    if (!comments.length)
      comments.push({
        commentId: '88888888-8888-4888-8888-888888888888',
        requestId: approvalDocumentRequestId,
        sourceTaskId: taskId,
        sequence: 1,
        authorUserId: 1,
        text: String(body.text),
        createdAt: new Date().toISOString(),
        retainUntil: new Date(Date.now() + 86400_000).toISOString(),
      });
    if (unknown) {
      unknown = false;
      return failure(route, 503);
    }
    return success(route, comments[0]);
  });
  await page.route(`**/api/approvals/v1/tasks/${taskId}/document-exports`, async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    const key = route.request().headers()['idempotency-key'];
    expect(key).toBe(body.idempotencyKey);
    writes.push({ key, body });
    const artifact = await approvalDocumentArtifact(body.intent as 'PRINT' | 'DOWNLOAD');
    artifacts.push(artifact);
    return success(route, artifact);
  });
  await page.goto(`/approvals/inbox?task=${taskId}`);
  await expect(page.getByRole('heading', { name: task.title })).toBeVisible();
  await expect(page.getByRole('button', { name: '댓글', exact: true })).toBeEnabled();
  return {
    writes,
    comments,
    artifacts,
    title: task.title,
    deny: (status: number) => {
      toolsStatus = status;
    },
    uncertain: () => {
      unknown = true;
    },
  };
}
async function comment(page: Page) {
  await page.getByRole('button', { name: '댓글', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '댓글', exact: true });
  await dialog.getByRole('textbox', { name: '댓글 내용', exact: true }).fill('원래 결재 검토 의견');
  return dialog;
}
async function generate(page: Page, intent: 'PRINT' | 'DOWNLOAD') {
  await page
    .getByRole('button', { name: intent === 'PRINT' ? '문서 인쇄' : 'JSON 다운로드', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: '문서 내보내기', exact: true });
  await dialog
    .getByRole('textbox', { name: '사용 목적', exact: true })
    .fill('현재 결재 업무 검토 목적');
  await dialog.getByRole('button', { name: '문서 생성', exact: true }).click();
}

test('결재함 댓글은 현재 task/version과 원래 명령 키로만 등록한다', async ({ page }) => {
  const state = await viewer(page);
  const dialog = await comment(page);
  await dialog.getByRole('button', { name: '댓글 등록', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('원래 결재 검토 의견', { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]!.body).toEqual({
    expectedVersion: 3,
    expectedCommentsVersion: 0,
    idempotencyKey: state.writes[0]!.key,
    text: '원래 결재 검토 의견',
  });
});
for (const status of [403, 503])
  test(`열린 댓글 창의 첫 ${status}는 추가 POST 없이 최신 권한 확인을 요구한다`, async ({
    page,
  }) => {
    const state = await viewer(page);
    const dialog = await comment(page);
    state.deny(status);
    await dialog.getByRole('button', { name: '댓글 등록', exact: true }).click();
    await expect(dialog.getByRole('button', { name: '댓글 등록', exact: true })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: '새로고침', exact: true })).toBeVisible();
    if (status === 403) await expect(page.getByRole('heading', { name: state.title })).toBeHidden();
    expect(state.writes).toHaveLength(0);
  });
test('결재함 JSON은 명시적 다운로드와 최종 권한 검증 뒤 실제 UTF8 파일을 전달한다', async ({
  page,
}) => {
  const state = await viewer(page);
  await generate(page, 'DOWNLOAD');
  const dialog = page.getByRole('dialog', { name: 'JSON 다운로드', exact: true });
  await expect(dialog).toBeVisible();
  const downloaded = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'JSON 다운로드', exact: true }).click();
  const download = await downloaded;
  const stream = await download.createReadStream();
  if (!stream) throw new Error('Actual browser download missing');
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const bytes = Buffer.concat(chunks);
  const artifact = state.artifacts[0]!;
  expect(bytes.toString('utf8')).toBe(artifact.content);
  expect(bytes.byteLength).toBe(artifact.sizeBytes);
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(artifact.sha256);
  expect(download.suggestedFilename()).toBe(artifact.fileName);
  expect(state.writes).toHaveLength(1);
});
test('결재함 인쇄는 sandbox 원문과 최종 현재 권한을 확인하며 회수 후 print를 호출하지 않는다', async ({
  page,
}) => {
  const state = await viewer(page);
  await generate(page, 'PRINT');
  const dialog = page.getByRole('dialog', { name: '인쇄 미리보기', exact: true });
  await expect(
    page.frameLocator('iframe').getByRole('heading', { name: '검토 완료 문서' })
  ).toBeVisible();
  await expect(dialog.locator('iframe')).toHaveAttribute(
    'sandbox',
    'allow-same-origin allow-modals'
  );
  await dialog.locator('iframe').evaluate((element) => {
    (window as unknown as { prints: number }).prints = 0;
    (element as HTMLIFrameElement).contentWindow!.print = () => {
      (window as unknown as { prints: number }).prints += 1;
    };
  });
  await dialog.getByRole('button', { name: '문서 인쇄', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { prints: number }).prints))
    .toBe(1);
  state.deny(403);
  await dialog.getByRole('button', { name: '문서 인쇄', exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => (window as unknown as { prints: number }).prints)).toBe(1);
  expect(state.writes).toHaveLength(1);
});
test('결재함 댓글은 커밋 뒤 UNKNOWN이어도 원래 키·본문으로만 중복 없이 재시도한다', async ({
  page,
}) => {
  const state = await viewer(page);
  state.uncertain();
  const dialog = await comment(page);
  await dialog.getByRole('button', { name: '댓글 등록', exact: true }).click();
  await expect(dialog.getByText(/처리 결과를 확인할 수 없습니다/u)).toBeVisible();
  await expect(dialog.getByRole('button', { name: '댓글 등록', exact: true })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: '원래 요청 재시도', exact: true })).toBeEnabled();
  expect(state.writes).toHaveLength(1);
  expect(state.comments).toHaveLength(1);
  await dialog.getByRole('button', { name: '원래 요청 재시도', exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(state.writes).toHaveLength(2);
  expect(state.writes[1]).toEqual(state.writes[0]);
  expect(state.comments).toHaveLength(1);
});
