import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

import { mockShellSession } from './support/shell-session';
import { mockApprovalProductSurfaceAuthority } from './support/product-surface-authority';
import { APPROVAL_MEMBER_PERMISSIONS } from './support/approval-command-center-fixtures';
import { APPROVAL_REQUEST_FIXTURE } from './support/product-area-fixtures';
import { approvalRequestSearchPage } from './support/approval-search-fixtures';

import type { ApprovalRequest } from '@dwp-frontend/shared-utils';

const base = '/api/approvals/v1';
function success(route: Route, data: unknown) {
  return route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data }),
  });
}
async function setup(page: Page) {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: APPROVAL_MEMBER_PERMISSIONS,
  });
  await mockApprovalProductSurfaceAuthority(page, { surfaceUi: false });
}
const queryLabel = '결재 번호·제목·요약 검색';

test('요청 검색은 실제 서버 조건·페이지를 사용하고 검색 없음과 완료 보관의 읽기 전용 의미를 구분한다', async ({
  page,
}) => {
  await setup(page);
  const source: ApprovalRequest[] = Array.from({ length: 21 }, (_, index) => ({
    ...APPROVAL_REQUEST_FIXTURE,
    requestId: `request-${String(index).padStart(2, '0')}`,
    requestNumber: `APR-${index}`,
    title: `검색 가능한 기안 ${index}`,
    status: 'IN_REVIEW',
    submittedAt: '2026-09-14T00:00:00Z',
  }));
  const seen: URL[] = [];
  await page.route(
    (url) => url.pathname === `${base}/requests/search`,
    (route) => {
      const url = new URL(route.request().url());
      seen.push(url);
      return success(route, approvalRequestSearchPage(url, source));
    }
  );
  await page.goto('/approvals/requests/submitted');
  await expect(page.getByText('1/2 페이지')).toBeVisible();
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await expect(page.getByText('2/2 페이지')).toBeVisible();
  expect(seen.at(-1)!.searchParams.get('page')).toBe('1');
  await page.getByLabel(queryLabel).fill('존재하지 않는 결재');
  await expect(page.getByText('조건에 맞는 요청이 없습니다.')).toBeVisible();
  expect(seen.at(-1)!.searchParams.get('page')).toBe('0');
  expect(seen.at(-1)!.searchParams.get('query')).toBe('존재하지 않는 결재');
  await page.getByRole('button', { name: '필터 초기화' }).click();
  await expect(page.getByText('1/2 페이지')).toBeVisible();
  await page.getByLabel('요청 상태', { exact: true }).click();
  await page.getByRole('option', { name: '보완 필요', exact: true }).click();
  await expect(page.getByText('조건에 맞는 요청이 없습니다.')).toBeVisible();
  expect(seen.at(-1)!.searchParams.get('status')).toBe('NEEDS_INFO');
});

test('완료 보관함은 소유한 종결 요청을 조회하며 승인·회수·재상신 명령을 다시 열지 않는다', async ({
  page,
}) => {
  await setup(page);
  const archived: ApprovalRequest = {
    ...APPROVAL_REQUEST_FIXTURE,
    status: 'APPROVED',
    title: '내가 소유한 종결 요청',
    completedAt: '2026-09-14T00:00:00Z',
  };
  const views: string[] = [];
  await page.route(
    (url) => url.pathname === `${base}/requests/search`,
    (route) => {
      const url = new URL(route.request().url());
      views.push(url.searchParams.get('view')!);
      return success(route, approvalRequestSearchPage(url, [archived]));
    }
  );
  await page.goto('/approvals/requests/archive');
  await expect(page.getByText(archived.title).first()).toBeVisible();
  expect(views.length).toBeGreaterThan(0);
  expect(views.every((view) => view === 'ARCHIVE')).toBe(true);
  await expect(page.getByRole('button', { name: /^(회수|상신|승인|반려|편집)$/u })).toHaveCount(0);
  const audit = await new AxeBuilder({ page }).analyze();
  expect(
    audit.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))
  ).toEqual([]);
});

test('목록 첫 503 재조회 실패는 cached 요청 명령을 즉시 닫고 명시적 재조회 성공 뒤에만 복구한다', async ({
  page,
}) => {
  await setup(page);
  await page.clock.install();
  let failed = false;
  let posts = 0;
  await page.route(
    (url) => url.pathname === `${base}/requests/search`,
    (route) =>
      failed
        ? route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ status: 'ERROR', message: 'Authority unavailable' }),
          })
        : success(
            route,
            approvalRequestSearchPage(new URL(route.request().url()), [APPROVAL_REQUEST_FIXTURE])
          )
  );
  await page.route(
    (url) => url.pathname.endsWith('/withdraw'),
    (route) => {
      posts += 1;
      return route.abort();
    }
  );
  await page.goto('/approvals/requests/submitted');
  await expect(page.getByRole('button', { name: '회수', exact: true }).first()).toBeEnabled();
  failed = true;
  await page.clock.fastForward(61_000);
  await expect(page.getByText('결재 목록을 불러오지 못했습니다.')).toBeVisible();
  await expect(page.getByRole('button', { name: '회수', exact: true })).toHaveCount(0);
  expect(posts).toBe(0);
  failed = false;
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.getByRole('button', { name: '회수', exact: true }).first()).toBeEnabled();
});

test('검색·정렬 도구 모음은 320px·200%와 데스크톱에서도 컨트롤을 겹치거나 잘라내지 않는다', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/approvals/requests/submitted');
  await expect(page.getByLabel(queryLabel)).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('request-search.png'), fullPage: false });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await expect(page.getByLabel(queryLabel)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    )
  ).toBe(true);
  await expect(page.getByRole('button', { name: '필터 초기화' })).toBeVisible();
});
