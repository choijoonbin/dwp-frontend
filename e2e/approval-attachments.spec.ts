import { createHash } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

import { PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS } from '../apps/dwp/src/routes/product-surface-authorization.generated';
import { APPROVAL_ATTACHMENT_ACTION_CONTRACTS } from '@dwp-frontend/shared-utils/api/approval-attachment-action-contracts';
import { mockShellSession } from './support/shell-session';
import { mockApprovalProductSurfaceAuthority } from './support/product-surface-authority';
import { APPROVAL_MEMBER_PERMISSIONS } from './support/approval-command-center-fixtures';
import {
  closeApprovalWireTestServers,
  startApprovalWireTestServer,
} from './support/approval-wire-test-server';
import {
  attachmentSource,
  attachmentDetail,
  attachmentUpload,
  attachmentItem,
  ATTACHMENT_REQUEST_ID,
  ATTACHMENT_BYTES,
  ATTACHMENT_FILE_NAME,
  ATTACHMENT_SHA,
  ATTACHMENT_GRANT_ID,
} from './support/approval-attachment-fixtures';

const installed = PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS.some(
  (entry) => entry.routeContractKey === 'route.approvals.work.request-attachment-reserve.action'
);
const success = (route: Route, data: unknown) =>
  route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data }),
  });
const failure = (route: Route, status: number) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({ status: 'ERROR', message: 'Attachment source unavailable' }),
  });

test.afterEach(closeApprovalWireTestServers);

async function settledDialog(dialog: ReturnType<Page['getByRole']>) {
  await expect
    .poll(() =>
      dialog.evaluate((element) => {
        for (let node: Element | null = element; node; node = node.parentElement) {
          if (getComputedStyle(node).opacity !== '1') return false;
        }
        return element
          .getAnimations({ subtree: true })
          .every((animation) => ['finished', 'idle'].includes(animation.playState));
      })
    )
    .toBe(true);
}

async function session(page: Page, sealed = false) {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
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
  });
  const authority = await mockApprovalProductSurfaceAuthority(page, {
    surfaceUi: true,
    decisionRevisionFormat: 'sha256',
    generatedAt: new Date().toISOString(),
    revalidateAt: new Date(Date.now() + 120_000).toISOString(),
  });
  let source = attachmentSource(sealed);
  const detail = {
    ...attachmentDetail(),
    request: {
      ...attachmentDetail().request,
      status: sealed ? ('APPROVED' as const) : ('NEEDS_INFO' as const),
    },
  };
  let upload = attachmentUpload();
  let sourceStatus = 200;
  let putStatus = 200;
  let sourceReads = 0;
  const writes: { method: string; path: string; key?: string; body: unknown }[] = [];
  const uploadBytes: Buffer[] = [];
  const browserOrigin = new URL(test.info().project.use.baseURL!).origin;
  const binaryUrl = await startApprovalWireTestServer(browserOrigin, (request) => {
    const bytes = request.bytes;
    uploadBytes.push(bytes);
    writes.push({
      method: request.method!,
      path: 'content',
      key: request.headers['idempotency-key'] as string | undefined,
      body: bytes,
    });
    upload = { ...upload, state: 'QUARANTINED', version: 2, reason: 'AWAITING_SCAN' };
    return { status: putStatus, data: putStatus === 200 ? upload : null };
  });
  await page.route('**/api/approvals/v1/requests/search*', (route) =>
    success(route, {
      items: [detail.request],
      totalElements: 1,
      totalPages: 1,
      hasNext: false,
      page: 0,
      size: 20,
      evaluatedAt: new Date().toISOString(),
    })
  );
  await page.route(`**/api/approvals/v1/requests/${ATTACHMENT_REQUEST_ID}/detail*`, (route) =>
    success(route, detail)
  );
  await page.route(
    `**/api/approvals/v1/requests/${ATTACHMENT_REQUEST_ID}/document-tools*`,
    (route) => (sourceStatus === 200 ? success(route, source.tools) : failure(route, sourceStatus))
  );
  await page.route(
    (url) => url.pathname === `/api/approvals/v1/requests/${ATTACHMENT_REQUEST_ID}/attachments`,
    (route) => {
      sourceReads++;
      if (route.request().method() === 'GET')
        return sourceStatus === 200
          ? success(route, source.attachments)
          : failure(route, sourceStatus);
      const body = route.request().postDataJSON();
      expect(route.request().headers()['x-dwp-expected-decision-revision']).toBe(
        authority.revision()
      );
      writes.push({
        method: 'PUT',
        path: 'selection',
        key: route.request().headers()['idempotency-key'],
        body,
      });
      source = {
        ...source,
        attachments: {
          ...source.attachments,
          manifest: {
            ...source.attachments.manifest,
            selectionVersion: source.attachments.manifest.selectionVersion + 1,
            items: body.attachmentIds.length ? [attachmentItem()] : [],
          },
        },
      };
      return success(route, source.attachments);
    }
  );
  await page.route(
    (url) =>
      url.pathname === `/api/approvals/v1/requests/${ATTACHMENT_REQUEST_ID}/attachment-uploads`,
    (route) => {
      const body = route.request().postDataJSON();
      expect(route.request().headers()['x-dwp-expected-decision-revision']).toBe(
        authority.revision()
      );
      writes.push({
        method: 'POST',
        path: 'reserve',
        key: route.request().headers()['idempotency-key'],
        body,
      });
      expect(body.sha256).toBe(ATTACHMENT_SHA);
      expect(body.sizeBytes).toBe(ATTACHMENT_BYTES.length);
      return success(route, upload);
    }
  );
  await page.route(
    (url) => url.pathname.startsWith('/api/approvals/v1/attachment-uploads/'),
    (route) => {
      const request = route.request();
      if (request.method() === 'GET')
        return sourceStatus === 200 ? success(route, upload) : failure(route, sourceStatus);
      const path = new URL(request.url()).pathname.split('/').at(-1)!;
      if (path === 'content') {
        return route.continue({ url: `${binaryUrl}/content` });
      }
      const body = request.postDataJSON();
      writes.push({ method: 'POST', path, key: request.headers()['idempotency-key'], body });
      if (path === 'cancel')
        upload = { ...upload, state: 'CANCELLED', version: upload.version + 1 };
      return success(route, upload);
    }
  );
  await page.route(
    `**/api/approvals/v1/requests/${ATTACHMENT_REQUEST_ID}/attachments/*/downloads*`,
    (route) => {
      const body = route.request().postDataJSON();
      writes.push({
        method: 'POST',
        path: 'download-grant',
        key: route.request().headers()['idempotency-key'],
        body,
      });
      return success(route, {
        grantId: ATTACHMENT_GRANT_ID,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        sha256: ATTACHMENT_SHA,
        sizeBytes: ATTACHMENT_BYTES.length,
      });
    }
  );
  await page.route(
    `**/api/approvals/v1/attachment-downloads/${ATTACHMENT_GRANT_ID}/content*`,
    (route) =>
      route.fulfill({
        body: Buffer.from(ATTACHMENT_BYTES),
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(ATTACHMENT_BYTES.length),
          'X-Content-SHA256': ATTACHMENT_SHA,
          'X-Content-Type-Options': 'nosniff',
        },
      })
  );
  await page.goto(
    `/approvals/requests/${sealed ? 'archive' : 'needs-info'}?request=${ATTACHMENT_REQUEST_ID}`
  );
  const viewer = page.getByRole('dialog').first();
  await expect(viewer).toBeVisible();
  const panel = viewer.getByTestId('approval-attachment-panel');
  await expect(panel).toBeVisible();
  return {
    panel,
    viewer,
    writes,
    uploadBytes,
    sourceReads: () => sourceReads,
    failSource: (status: number) => {
      sourceStatus = status;
    },
    failPut: () => {
      putStatus = 503;
    },
    passScan: () => {
      upload = {
        ...upload,
        state: 'AVAILABLE',
        version: 3,
        avState: 'AV_CLEAR',
        passiveContentState: 'PASSIVE_ALLOWED',
      };
    },
    choose: async () => {
      await panel.locator('input[type=file]').setInputFiles({
        name: ATTACHMENT_FILE_NAME,
        mimeType: 'text/plain',
        buffer: Buffer.from(ATTACHMENT_BYTES),
      });
      await expect(panel.getByRole('button', { name: '서버에 전송', exact: true })).toBeEnabled();
    },
  };
}

test('attachment contract absence closes actual browser DATA and writes without a legacy fallback', async ({
  page,
}) => {
  test.skip(
    installed,
    'Canonical new generation installed; policy-denial cases cover the active contract.'
  );
  const s = await session(page);
  await expect(s.panel.getByText('현재 권한 또는 첨부 서비스를 확인할 수 없습니다.')).toBeVisible();
  await expect(s.panel.getByRole('button', { name: '파일 선택', exact: true })).toHaveCount(0);
  expect(s.sourceReads()).toBe(0);
  expect(s.writes).toHaveLength(0);
});

test.describe('canonical generation 9 attachment frontend contract journeys', () => {
  test.beforeEach(() => {
    test.skip(
      !installed,
      'Pending Root canonical generation 9 install. Positive proof must use installed source, not a success-only mock.'
    );
    for (const contract of APPROVAL_ATTACHMENT_ACTION_CONTRACTS) {
      const routes = PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS.filter(
        (route) => route.routeContractKey === contract.routeContractKey
      );
      expect(routes).toHaveLength(1);
      expect(routes[0]).toMatchObject({
        routeKind: 'ACTION',
        productId: 'approvals',
        surfaceId: 'approvals.work',
      });
      expect(routes[0]!.gatewayBindings).toEqual([
        { method: contract.method, path: contract.path },
      ]);
    }
    for (const [name, path] of [
      ['attachment-upload', '/api/approvals/v1/attachment-uploads/{uploadId}'],
      ['request-attachments', '/api/approvals/v1/requests/{requestId}/attachments'],
      ['task-attachments', '/api/approvals/v1/tasks/{taskId}/attachments'],
      ['attachment-download-content', '/api/approvals/v1/attachment-downloads/{grantId}/content'],
    ]) {
      const routes = PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS.filter(
        (route) => route.routeContractKey === `route.approvals.work.${name}.data`
      );
      expect(routes).toHaveLength(1);
      expect(routes[0]).toMatchObject({
        routeKind: 'DATA',
        productId: 'approvals',
        surfaceId: 'approvals.work',
      });
      expect(routes[0]!.gatewayBindings).toEqual([{ method: 'GET', path }]);
    }
  });

  test('File SHA upload quarantines until actual scan data permits explicit selection', async ({
    page,
  }) => {
    const s = await session(page);
    await s.choose();
    await s.panel.getByRole('button', { name: '서버에 전송', exact: true }).click();
    await expect(s.panel.getByText('보안 검사 대기', { exact: true })).toBeVisible();
    await s.viewer.screenshot({ path: test.info().outputPath('attachment-quarantine.png') });
    expect(s.writes.map((write) => write.path)).toEqual(['reserve', 'content']);
    expect(s.writes[0].key).toBe(s.writes[1].key);
    expect(s.uploadBytes[0]).toEqual(Buffer.from(ATTACHMENT_BYTES));
    expect(createHash('sha256').update(s.uploadBytes[0]!).digest('hex')).toBe(ATTACHMENT_SHA);
    await expect(s.panel.getByRole('button', { name: '문서에 첨부', exact: true })).toHaveCount(0);
    s.passScan();
    await s.panel.getByRole('button', { name: '상태 새로고침', exact: true }).last().click();
    await s.panel.getByRole('button', { name: '문서에 첨부', exact: true }).click();
    await expect(s.panel.getByText('문서 첨부됨', { exact: false })).toBeVisible();
    expect(s.writes.at(-1)?.path).toBe('selection');
  });

  test('ambiguous binary PUT survives close/reopen and needs explicit reconciliation, never new reserve', async ({
    page,
  }) => {
    const s = await session(page);
    s.failPut();
    await s.choose();
    await s.panel.getByRole('button', { name: '서버에 전송', exact: true }).click();
    await expect(s.panel.getByText(/전송 결과가 불명확/)).toBeVisible();
    expect(s.writes).toHaveLength(2);
    await s.viewer.getByRole('button', { name: '닫기', exact: true }).first().click();
    await expect(s.viewer).toBeHidden();
    await page.getByRole('button', { name: '결재 상세 열기', exact: true }).first().click();
    const panel = page.getByRole('dialog').first().getByTestId('approval-attachment-panel');
    await expect(panel.getByText(/전송 결과가 불명확/)).toBeVisible();
    await panel.getByRole('button', { name: '상태 새로고침', exact: true }).last().click();
    await expect(panel.getByText(/전송 결과가 불명확/)).toBeVisible();
    await panel.getByRole('button', { name: '저장 결과 확인', exact: true }).click();
    await expect
      .poll(() => s.writes.map((write) => write.path))
      .toEqual(['reserve', 'content', 'reconcile']);
    await expect(panel.getByText(/전송 결과가 불명확/)).toHaveCount(0);
    await expect(panel.getByText('보안 검사 대기', { exact: true })).toBeVisible();
    expect(s.writes.map((write) => write.path)).toEqual(['reserve', 'content', 'reconcile']);
  });

  for (const mode of ['dark', 'forced-colors'] as const) {
    test(`320px ${mode} attachment quarantine keeps scan actions closed and supports keyboard focus`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 320, height: 720 });
      await page.emulateMedia({
        colorScheme: mode === 'dark' ? 'dark' : 'light',
        forcedColors: mode === 'forced-colors' ? 'active' : 'none',
        reducedMotion: 'reduce',
      });
      const s = await session(page);
      await expect(page.locator('html')).toHaveAttribute(
        'data-color-scheme',
        mode === 'dark' ? 'dark' : 'light'
      );
      await s.choose();
      await s.panel.getByRole('button', { name: '서버에 전송', exact: true }).click();
      await expect(s.panel.getByText('보안 검사 대기', { exact: true })).toBeVisible();
      await expect(s.panel.getByRole('button', { name: '문서에 첨부', exact: true })).toHaveCount(
        0
      );
      const refresh = s.panel.getByRole('button', { name: '상태 새로고침', exact: true }).last();
      await refresh.focus();
      await expect(refresh).toBeFocused();
      await refresh.press('Enter');
      await expect(refresh).toBeEnabled();
      await expect(s.panel.getByText('보안 검사 대기', { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
        false
      );
      await s.viewer.screenshot({ path: test.info().outputPath(`attachment-${mode}-320.png`) });
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      expect(s.writes.map((write) => write.path)).toEqual(['reserve', 'content']);
    });
  }

  test('REQUEST 320px sealed evidence downloads exact UTF8 bytes/hash with recorded reason', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    const s = await session(page, true);
    await s.panel.getByRole('button', { name: '다운로드', exact: true }).click();
    const dialog = page
      .getByRole('dialog')
      .filter({ has: page.getByRole('textbox', { name: '다운로드 사유' }) });
    await dialog.getByRole('textbox', { name: '다운로드 사유' }).fill('검토 증빙 확인');
    await expect(dialog.getByRole('textbox', { name: '다운로드 사유' })).toBeFocused();
    await settledDialog(dialog);
    await dialog.screenshot({ path: test.info().outputPath('attachment-download-320.png') });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      dialog.getByRole('button', { name: '다운로드', exact: true }).click(),
    ]);
    const stream = await download.createReadStream();
    expect(stream).not.toBeNull();
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
    const actual = Buffer.concat(chunks);
    expect(actual).toEqual(Buffer.from(ATTACHMENT_BYTES));
    expect(createHash('sha256').update(actual).digest('hex')).toBe(ATTACHMENT_SHA);
    expect(download.suggestedFilename()).toBe(ATTACHMENT_FILE_NAME);
    expect(s.writes[0].body).toMatchObject({ expectedVersion: 3, reason: '검토 증빙 확인' });
    await expect(dialog).toBeHidden();
    await expect(dialog).toHaveCount(0);
    await expect(s.panel.getByRole('button', { name: '다운로드', exact: true })).toBeFocused();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    ).toBe(false);
    await expect(s.viewer).toBeVisible();
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations).toEqual([]);
  });
});
