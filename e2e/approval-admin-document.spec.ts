import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

import { mockShellSession } from './support/shell-session';
import { APPROVAL_MEMBER_PERMISSIONS } from './support/approval-command-center-fixtures';
import { mockApprovalProductSurfaceAuthority } from './support/product-surface-authority';
import type {
  ApprovalDocumentHold,
  ApprovalDocumentPolicy,
} from '../libs/shared-utils/src/api/approval-document-contract';

const policy: ApprovalDocumentPolicy = {
  policyId: '11111111-1111-1111-1111-111111111111',
  resourceSetKey: 'ALL',
  version: 2,
  published: {
    revision: 0,
    rules: {
      allowComments: true,
      allowPrint: false,
      allowJsonExport: false,
      allowArchiveExport: false,
      includeComments: false,
      includeEvidence: false,
      allowedClassifications: [],
      fields: [],
      maxBatchItems: 20,
      maxBytes: 1048576,
      snapshotTtlSeconds: 300,
      evidenceRetentionDays: 365,
    },
    sha256: 'a'.repeat(64),
    makerUserId: null,
    createdAt: '2026-09-14T00:00:00Z',
  },
  pending: null,
};
const hold: ApprovalDocumentHold = {
  requestId: '22222222-2222-2222-2222-222222222222',
  version: 3,
  active: false,
  pending: {
    proposalId: '33333333-3333-3333-3333-333333333333',
    operation: 'PLACE',
    reason: 'Independent preservation review required',
    makerUserId: 12,
    createdAt: '2026-09-14T00:00:00Z',
  },
  journal: [],
  purgeState: 'LEGAL_HOLD_PENDING_APPROVAL',
  retainUntil: '2027-09-14T00:00:00Z',
  preservationPending: true,
  purgeEligible: false,
};
const success = (route: Route, data: unknown) =>
  route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data }),
  });
async function documentAdmin(page: Page) {
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'APPROVAL_AUDITOR'], {
    locale: 'ko',
    permissions: [
      ...APPROVAL_MEMBER_PERMISSIONS,
      {
        resourceType: 'ADMIN',
        resourceKey: 'ADMIN.APPROVAL_POLICY',
        permissionCode: 'VIEW',
        effect: 'ALLOW',
      },
    ],
  });
  await mockApprovalProductSurfaceAuthority(page, { surfaceUi: false });
  const state: {
    policy: unknown;
    hold: unknown;
    forbidden: boolean;
    reads: number;
    writes: string[];
  } = {
    policy,
    hold,
    forbidden: false,
    reads: 0,
    writes: [],
  };
  await page.route(
    (url) => url.pathname.startsWith('/api/approvals/v1/admin/document-tools/'),
    (route) => {
      if (route.request().method() !== 'GET') {
        state.writes.push(route.request().url());
        return route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'ERROR',
            errorCode: 'FORBIDDEN',
            message: 'Read only auditor',
          }),
        });
      }
      if (route.request().url().includes('/holds/')) return success(route, state.hold);
      state.reads += 1;
      return state.forbidden
        ? route.fulfill({
            status: 403,
            contentType: 'application/json',
            body: JSON.stringify({
              status: 'ERROR',
              errorCode: 'FORBIDDEN',
              message: 'Policy source revoked',
            }),
          })
        : success(route, state.policy);
    }
  );
  return state;
}

test('문서 감사자는 ALL 기본 반출 차단과 보존 집행 대기를 구분하고 변경 명령을 보내지 않는다', async ({
  page,
  isMobile,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const state = await documentAdmin(page);
  state.policy = {
    ...policy,
    pending: {
      ...policy.published,
      revision: 1,
      makerUserId: 12,
      sha256: 'b'.repeat(64),
      rules: {
        ...policy.published.rules,
        allowJsonExport: true,
        allowedClassifications: ['INTERNAL'],
        fields: [
          { key: 'amount', type: 'DECIMAL_STRING', maxLength: 1000, children: [], maxRows: null },
        ],
      },
    },
  };
  await page.goto('/approvals/admin/policies');
  await expect(page.getByRole('heading', { name: '문서 접근 정책', exact: true })).toBeVisible();
  await expect(page.getByText('ALL', { exact: true })).toBeVisible();
  await expect(page.getByText('본문 필드', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '변경 제안 편집', exact: true })).toHaveCount(0);
  await expect(page.getByText('amount / 십진 문자열 / 1000', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: '기안 식별자', exact: true }).fill(hold.requestId);
  await page.getByRole('button', { name: '문서 제한 조회', exact: true }).click();
  await expect(page.getByText('보존 집행 대기', { exact: true })).toBeVisible();
  await expect(page.getByText('반출 제한 적용', { exact: true })).toBeVisible();
  await expect(page.getByText('LEGAL_HOLD_PENDING_APPROVAL', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^(제한 제안|해제 제안)$/ })).toHaveCount(0);
  await expect(
    page.getByText('Independent preservation review required', { exact: true })
  ).toBeVisible();
  await expect(page.getByText('반출 제한만으로 법적 보존', { exact: false })).toBeVisible();
  if (isMobile) {
    await page.setViewportSize({ width: 320, height: 780 });
    await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
  await page.getByRole('heading', { name: '문서 접근 정책', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath('approval-admin-document-read-only.png'),
    fullPage: false,
  });
  await page.getByText('보존 집행 대기', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath('approval-admin-document-preservation.png'),
    fullPage: false,
  });
  expect(state.writes).toEqual([]);
});

test('문서 정책 최초 403은 보존된 정본 조작을 즉시 닫고 새 200 조회만으로 읽기를 복구한다', async ({
  page,
}) => {
  const state = await documentAdmin(page);
  await page.goto('/approvals/admin/policies');
  await expect(page.getByText('ALL', { exact: true })).toBeVisible();
  const initialReads = state.reads;
  state.forbidden = true;
  await page.getByRole('button', { name: '문서 정책 다시 조회', exact: true }).click();
  await expect(page.getByText('ALL', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '변경 제안 편집', exact: true })).toHaveCount(0);
  expect(state.reads).toBe(initialReads + 1);
  state.forbidden = false;
  await page.getByRole('button', { name: '문서 정책 다시 조회', exact: true }).click();
  await expect(page.getByText('ALL', { exact: true })).toBeVisible();
  expect(state.reads).toBe(initialReads + 2);
  expect(state.writes).toEqual([]);
});

test('잘못된 정책과 보존 DTO는 crash·가짜 readiness 없이 읽기 실패로 닫고 실제 정본으로 복구한다', async ({
  page,
}) => {
  const state = await documentAdmin(page);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  state.policy = { ...policy, published: null };
  state.hold = { ...hold, journal: [null] };
  await page.goto('/approvals/admin/policies');
  await expect(
    page.getByRole('button', { name: '문서 정책 다시 조회', exact: true })
  ).toBeVisible();
  await expect(page.getByText('ALL', { exact: true })).toHaveCount(0);
  await page.getByRole('textbox', { name: '기안 식별자', exact: true }).fill(hold.requestId);
  await page.getByRole('button', { name: '문서 제한 조회', exact: true }).click();
  await expect(page.getByText('보존 집행 대기', { exact: true })).toHaveCount(0);
  state.policy = policy;
  state.hold = hold;
  await page.getByRole('button', { name: '문서 정책 다시 조회', exact: true }).click();
  await expect(page.getByText('ALL', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '문서 제한 조회', exact: true }).click();
  await expect(page.getByText('보존 집행 대기', { exact: true })).toBeVisible();
  expect(pageErrors).toEqual([]);
  expect(state.writes).toEqual([]);
});
