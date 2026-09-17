import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

import { approvalTaskSearchPage } from './support/approval-search-fixtures';
import { APPROVAL_HOME_FIXTURE } from './support/approval-command-center-fixtures';
import { APPROVAL_TASK_DETAIL_FIXTURE } from './support/product-area-fixtures';
import { approvalDocumentTools } from './support/approval-request-document-fixtures';
import { openApprovalQueueSidebar as openQueueSidebar } from './support/approval-sidebar';
import {
  fulfillApprovalSuccess as success,
  prepareApprovalCommandCenter as prepare,
} from './support/approval-command-center-resilience-setup';

test.use({ timezoneId: 'Asia/Seoul' });

for (const outcome of ['fresh', 'revoked', 'new-version'] as const) {
  test(`문서 식별자 복사는 최신 상세 ${outcome} 권한과 버전에 결속된다`, async ({ page }) => {
    await prepare(page);
    await page.addInitScript(() => {
      const writes: string[] = [];
      Object.defineProperty(window, 'approvalCopiedIdentifiers', { value: writes });
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (value: string) => {
            writes.push(value);
          },
        },
      });
    });
    let changed = false;
    let reads = 0;
    await page.route('**/api/approvals/v1/tasks/approval-task-1', (route) => {
      reads += 1;
      if (changed && outcome === 'revoked')
        return route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ERROR', errorCode: 'ACCESS_DENIED' }),
        });
      return success(route, {
        ...APPROVAL_TASK_DETAIL_FIXTURE,
        canDecide: true,
        task: {
          ...APPROVAL_HOME_FIXTURE.focusQueue[0],
          version: changed && outcome === 'new-version' ? 1 : 0,
        },
      });
    });
    await page.goto('/approvals/inbox?task=approval-task-1');
    const copy = page.getByRole('button', { name: '문서 식별자 복사', exact: true });
    await expect(copy).toBeVisible();
    const previousReads = reads;
    changed = true;
    await copy.click();
    await expect.poll(() => reads).toBeGreaterThan(previousReads);
    const copied = () =>
      page.evaluate(
        () =>
          (window as unknown as { approvalCopiedIdentifiers: string[] }).approvalCopiedIdentifiers
      );
    if (outcome === 'fresh') {
      await expect.poll(copied).toEqual([APPROVAL_HOME_FIXTURE.focusQueue[0].requestNumber]);
      await page.getByRole('button', { name: '이력 보기', exact: true }).click();
      await expect(page.locator('#approval-audit-timeline-title')).toBeFocused();
    } else {
      await expect(
        page.getByText('문서를 다시 확인한 후 복사해 주세요.', { exact: true })
      ).toBeVisible();
      expect(await copied()).toEqual([]);
    }
  });
}

test('내 완료함은 서버 106건의 마지막 페이지·검색을 조회하고 결재 명령을 노출하지 않는다', async ({
  page,
}) => {
  await prepare(page);
  const tasks = Array.from({ length: 106 }, (_, index) => ({
    ...APPROVAL_HOME_FIXTURE.focusQueue[0],
    taskId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    requestId: `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    requestNumber: `APR-COMPLETED-${index + 1}`,
    title: index === 105 ? '완료된 정산 최종 결정' : `완료 결정 ${index + 1}`,
    status: 'APPROVED',
    priority: 'NORMAL' as const,
  }));
  const searches: URL[] = [];
  await page.route('**/api/approvals/v1/tasks/search?*', (route) => {
    const url = new URL(route.request().url());
    searches.push(url);
    return success(route, approvalTaskSearchPage(url, tasks));
  });
  await page.route(
    (url) => /^\/api\/approvals\/v1\/tasks\/[0-9a-f-]{36}$/u.test(url.pathname),
    (route) => {
      const taskId = new URL(route.request().url()).pathname.split('/').at(-1) ?? '';
      return success(route, {
        ...APPROVAL_TASK_DETAIL_FIXTURE,
        task: tasks.find((candidate) => candidate.taskId === taskId),
        canClaim: false,
        canDecide: false,
      });
    }
  );
  await page.route(
    (url) => /^\/api\/approvals\/v1\/tasks\/[0-9a-f-]{36}\/document-tools$/u.test(url.pathname),
    (route) => {
      const taskId = new URL(route.request().url()).pathname.split('/').at(-2) ?? '';
      const task = tasks.find((candidate) => candidate.taskId === taskId);
      return success(route, {
        ...approvalDocumentTools(task?.requestId),
        taskId,
        taskVersion: task?.version ?? 0,
      });
    }
  );
  await page.route(
    (url) => /^\/api\/approvals\/v1\/tasks\/[0-9a-f-]{36}\/comments$/u.test(url.pathname),
    (route) =>
      success(route, {
        items: [],
        totalElements: 0,
        page: 0,
        size: 25,
        commentsVersion: 0,
        evaluatedAt: new Date().toISOString(),
      })
  );
  await page.goto('/approvals/completed');
  const next = page.getByRole('button', { name: '다음', exact: true });
  await expect(next).toBeEnabled();
  for (let pageNumber = 1; pageNumber <= 4; pageNumber += 1) {
    await next.click();
    await expect
      .poll(() =>
        searches
          .filter((url) => url.searchParams.get('view') === 'COMPLETED')
          .at(-1)
          ?.searchParams.get('page')
      )
      .toBe(String(pageNumber));
    await expect(page.getByText(`${pageNumber + 1}/5 페이지`, { exact: true })).toBeVisible();
  }
  await expect(next).toBeDisabled();
  await page
    .getByRole('textbox', { name: '결재 번호·제목·요약 검색', exact: true })
    .fill('정산 최종');
  await expect
    .poll(() =>
      searches
        .filter((url) => url.searchParams.get('view') === 'COMPLETED')
        .at(-1)
        ?.searchParams.get('query')
    )
    .toBe('정산 최종');
  await expect(page.getByRole('button').filter({ hasText: '완료된 정산 최종 결정' })).toHaveCount(
    1
  );
  await expect(page.getByRole('button', { name: /^(승인|반려|검토 시작)$/u })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '결정 증적 문서', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '문서 인쇄', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'JSON 다운로드', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: '댓글', exact: true })).toHaveCount(0);
});

test('서버 전체 106건에서 마지막 페이지와 검색·상태 필터를 조회한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await prepare(page);
  const tasks = Array.from({ length: 106 }, (_, index) => ({
    ...APPROVAL_HOME_FIXTURE.focusQueue[0],
    taskId: `search-task-${String(index).padStart(3, '0')}`,
    requestNumber: `APR-SEARCH-${index + 1}`,
    title: index === 105 ? '정산 증빙 최종 검토' : `일반 요청 ${index + 1}`,
    priority: 'NORMAL' as const,
    status: index === 105 ? 'CLAIMED' : 'PENDING',
    riskScore: 70,
  }));
  const searches: URL[] = [];
  await page.route('**/api/approvals/v1/tasks/search?*', (route) => {
    const url = new URL(route.request().url());
    searches.push(url);
    return success(route, approvalTaskSearchPage(url, tasks));
  });
  await page.route('**/api/approvals/v1/tasks/search-task-*', (route) => {
    const task = tasks.find((candidate) => route.request().url().endsWith(candidate.taskId));
    return success(route, { ...APPROVAL_TASK_DETAIL_FIXTURE, task, canDecide: true });
  });
  await page.goto('/approvals/inbox');
  const list = page.getByRole('grid', { name: '검토 대기 결재 목록' });
  await expect(list.getByRole('row')).toHaveCount(25);
  for (let pageNumber = 1; pageNumber <= 4; pageNumber += 1) {
    await page.getByRole('button', { name: '다음 페이지', exact: true }).click();
    await expect(page).toHaveURL((url) => url.searchParams.get('page') === String(pageNumber));
    await expect.poll(() => searches.at(-1)?.searchParams.get('page')).toBe(String(pageNumber));
    await expect(
      page.getByRole('status').filter({ hasText: `${pageNumber + 1}/5 페이지` })
    ).toBeVisible();
  }
  await expect(list.getByRole('row')).toHaveCount(6);
  await expect(list.getByText('정산 증빙 최종 검토')).toBeVisible();
  await expect(page.getByRole('button', { name: '다음 페이지', exact: true })).toBeDisabled();
  await page.getByRole('textbox', { name: '결재 검색', exact: true }).fill('정산 증빙');
  await expect(list.getByRole('row')).toHaveCount(1);
  await expect.poll(() => searches.at(-1)?.searchParams.get('query')).toBe('정산 증빙');
  await expect(page).toHaveURL((url) => url.searchParams.get('page') === '0');
  await page.getByRole('combobox', { name: '상태', exact: true }).click();
  await page.getByRole('option', { name: '처리 중', exact: true }).click();
  await expect.poll(() => searches.at(-1)?.searchParams.get('status')).toBe('CLAIMED');
  await expect(list.getByText('정산 증빙 최종 검토')).toBeVisible();
});

test('서버 목록 첫 실패는 열린 결재 확인을 닫고 최신 조회 성공 후에만 복구한다', async ({
  page,
}) => {
  await prepare(page);
  let failed = false;
  let reads = 0;
  let posts = 0;
  await page.route('**/api/approvals/v1/tasks/search?*', (route) => {
    reads += 1;
    if (failed)
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ERROR', errorCode: 'AUTHORITY_RESOLUTION_UNAVAILABLE' }),
      });
    return success(
      route,
      approvalTaskSearchPage(new URL(route.request().url()), APPROVAL_HOME_FIXTURE.focusQueue)
    );
  });
  await page.route('**/api/approvals/v1/tasks/*/decisions', (route) => {
    posts += 1;
    return success(route, {});
  });
  await page.goto('/approvals/inbox?task=approval-task-1');
  await page.getByRole('button', { name: '승인', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const before = reads;
  failed = true;
  await page.evaluate(() => {
    dispatchEvent(new Event('offline'));
    dispatchEvent(new Event('online'));
  });
  await expect.poll(() => reads).toBeGreaterThan(before);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '승인', exact: true })).toHaveCount(0);
  expect(posts).toBe(0);
  await expect(
    page.getByRole('alert').filter({ hasText: '결재 목록을 불러오지 못했습니다' })
  ).toBeVisible();
  failed = false;
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.getByRole('button', { name: '승인', exact: true })).toBeEnabled();
  expect(posts).toBe(0);
});

test('결재함 부모 항목은 필터와 우측 화면을 유지하며 하위 메뉴를 접고 펼친다', async ({
  page,
}, info) => {
  await prepare(page);
  await page.goto('/approvals/home');
  let sidebar = await openQueueSidebar(page);
  await sidebar.getByRole('link', { name: '결재함', exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === '/approvals/inbox');
  sidebar = await openQueueSidebar(page);
  const parent = sidebar.getByRole('button', { name: '결재함', exact: true });
  const filters = sidebar.getByRole('navigation', { name: '결재 큐 필터' });
  await expect(parent).toHaveAttribute('aria-expanded', 'true');
  await expect(filters.getByRole('button')).toHaveCount(4);
  await filters.getByRole('button', { name: /^긴급 결재/u }).click();
  await expect(page).toHaveURL(/queue=URGENT/u);
  if ((page.viewportSize()?.width ?? 1280) < 1200) {
    await expect(page.locator('[data-approval-command-center-heading]')).toBeFocused();
  }
  if ((page.viewportSize()?.width ?? 1280) >= 900) {
    await expect(page).toHaveURL((url) => url.searchParams.get('task') === 'approval-task-1');
  }
  await openQueueSidebar(page);
  const selectedUrl = page.url();
  await parent.click();
  await expect(parent).toHaveAttribute('aria-expanded', 'false');
  await expect(filters).toHaveCount(0);
  expect(page.url()).toBe(selectedUrl);
  await expect(sidebar).toBeVisible();
  await page.screenshot({ path: info.outputPath('approval-sidebar-collapsed.png') });
  await parent.click();
  await expect(parent).toHaveAttribute('aria-expanded', 'true');
  await expect(filters.getByRole('button', { name: /^긴급 결재/u })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  expect(page.url()).toBe(selectedUrl);
  await page.screenshot({ path: info.outputPath('approval-sidebar-expanded.png') });
  await parent.click();
  await sidebar.getByRole('link', { name: '전자결재 홈', exact: true }).click();
  await expect(page).toHaveURL(/\/approvals\/home$/u);
  await openQueueSidebar(page);
  await sidebar.getByRole('link', { name: '결재함', exact: true }).click();
  await openQueueSidebar(page);
  await expect(parent).toHaveAttribute('aria-expanded', 'true');
  await expect(filters.getByRole('button')).toHaveCount(4);
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
});

test('결재함 접기 펼치기는 다크 모드 200%와 키보드에서도 포커스와 선택을 유지한다', async ({
  page,
}) => {
  const mobile = (page.viewportSize()?.width ?? 1280) < 1200;
  await page.setViewportSize({ width: mobile ? 320 : 1440, height: 960 });
  await prepare(page, true);
  await page.goto('/approvals/inbox?queue=HIGH_RISK&task=approval-task-2');
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  const sidebar = await openQueueSidebar(page);
  const parent = sidebar.getByRole('button', { name: '결재함', exact: true });
  const filters = sidebar.getByRole('navigation', { name: '결재 큐 필터' });
  const selectedUrl = page.url();
  await parent.focus();
  await parent.press('Space');
  await expect(parent).toBeFocused();
  await expect(parent).toHaveAttribute('aria-expanded', 'false');
  await expect(filters).toHaveCount(0);
  await parent.press('Enter');
  await expect(parent).toBeFocused();
  await expect(parent).toHaveAttribute('aria-expanded', 'true');
  await expect(filters.getByRole('button', { name: /^고위험/u })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  const controlsId = await parent.getAttribute('aria-controls');
  expect(
    await page
      .locator('[id]')
      .evaluateAll(
        (elements, id) => elements.filter((element) => element.id === id).length,
        controlsId
      )
  ).toBe(1);
  expect(page.url()).toBe(selectedUrl);
  await parent.press('Tab');
  await expect(filters.getByRole('button', { name: /^전체 대기/u })).toBeFocused();
  expect(await sidebar.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
    true
  );
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
});

for (const outcome of ['unavailable', 'new-version'] as const) {
  test(`열린 승인 확인은 상세 ${outcome} 재검증에서 무효화된다`, async ({ page }) => {
    await prepare(page);
    let changed = false;
    let detailReads = 0;
    let posts = 0;
    await page.route('**/api/approvals/v1/tasks/approval-task-1', (route) => {
      detailReads += 1;
      if (changed && outcome === 'unavailable')
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ERROR', errorCode: 'AUTHORITY_RESOLUTION_UNAVAILABLE' }),
        });
      return success(route, {
        ...APPROVAL_TASK_DETAIL_FIXTURE,
        canDecide: true,
        task: { ...APPROVAL_HOME_FIXTURE.focusQueue[0], version: changed ? 2 : 1 },
      });
    });
    await page.route('**/api/approvals/v1/tasks/*/decisions', (route) => {
      posts += 1;
      return success(route, APPROVAL_TASK_DETAIL_FIXTURE);
    });
    await page.goto('/approvals/inbox?task=approval-task-1');
    await page.getByRole('button', { name: '승인', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const previousReads = detailReads;
    changed = true;
    await page.evaluate(() => {
      dispatchEvent(new Event('offline'));
      dispatchEvent(new Event('online'));
    });
    await expect.poll(() => detailReads).toBeGreaterThan(previousReads);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(posts).toBe(0);
    if (outcome === 'new-version') {
      await expect(page.getByRole('button', { name: '승인', exact: true })).toBeEnabled();
      await page.getByRole('button', { name: '승인', exact: true }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      expect(posts).toBe(0);
    } else {
      await expect(
        page.getByRole('alert').filter({ hasText: '선택한 결재의 최신 권한' })
      ).toBeVisible();
      await expect(page.getByRole('button', { name: '승인', exact: true })).toHaveCount(0);
    }
  });
}

test('동일 화면 URL 선택과 모바일 상세 키보드 포커스는 일치한다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepare(page);
  await page.goto('/approvals/inbox');
  const first = page.getByRole('button', { name: /고객 분석 환경 접근 연장/u });
  await first.focus();
  await first.press('Enter');
  const detail = page.getByRole('region', { name: '결재 상세', exact: true });
  await expect(detail).toBeFocused();
  await expect(detail.getByRole('heading', { name: '고객 분석 환경 접근 연장' })).toBeVisible();
  await page.evaluate(() => {
    history.pushState({}, '', '/approvals/inbox?task=approval-task-2');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(detail.getByRole('heading', { name: '신규 협력사 보안 예외' })).toBeVisible();
  await page.getByRole('button', { name: '결재 목록으로 돌아가기' }).click();
  await page.evaluate(() => {
    history.pushState({}, '', '/approvals/inbox?task=approval-task-2');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(detail.getByRole('heading', { name: '신규 협력사 보안 예외' })).toBeVisible();
  await expect(detail).toBeFocused();
});

test('데스크톱 자동 선택과 큐 변경은 유효한 task URL을 보존하고 정규화한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await prepare(page);
  await page.goto('/approvals/inbox');
  await expect(page).toHaveURL((url) => url.searchParams.get('task') === 'approval-task-1');

  const filters = page.getByRole('navigation', { name: '결재 큐 필터' });
  await filters.getByRole('button', { name: /^고위험/u }).click();
  await expect(page).toHaveURL(
    (url) =>
      url.searchParams.get('queue') === 'HIGH_RISK' &&
      url.searchParams.get('task') === 'approval-task-1'
  );
  await filters.getByRole('button', { name: /^전체 대기/u }).click();
  await expect(page).toHaveURL(
    (url) =>
      url.searchParams.get('queue') === 'ALL' && url.searchParams.get('task') === 'approval-task-1'
  );

  await page.getByRole('button', { name: /신규 협력사 보안 예외/u }).click();
  await expect(page).toHaveURL((url) => url.searchParams.get('task') === 'approval-task-2');
  await filters.getByRole('button', { name: /^긴급 결재/u }).click();
  await expect(page).toHaveURL(
    (url) =>
      url.searchParams.get('queue') === 'URGENT' &&
      url.searchParams.get('task') === 'approval-task-1'
  );
});

test('결정 직전 버전 충돌은 POST 없이 의견을 보존하고 최신본 재확인을 요구한다', async ({
  page,
}) => {
  await prepare(page);
  let changed = false;
  let posts = 0;
  await page.route('**/api/approvals/v1/tasks/approval-task-1', (route) =>
    success(route, {
      ...APPROVAL_TASK_DETAIL_FIXTURE,
      canDecide: true,
      task: { ...APPROVAL_HOME_FIXTURE.focusQueue[0], version: changed ? 1 : 0 },
    })
  );
  await page.route('**/api/approvals/v1/tasks/*/decisions', (route) => {
    posts += 1;
    return success(route, {});
  });

  await page.goto('/approvals/inbox?task=approval-task-1');
  await page.getByRole('button', { name: '반려', exact: true }).click();
  await page.getByLabel('결정 사유').fill('현재 증적 기준으로는 승인할 수 없습니다.');
  changed = true;
  await page.getByRole('dialog').getByRole('button', { name: '반려 확정' }).click();

  const conflict = page.getByRole('alert').filter({ hasText: '결재 내용이 변경되었습니다' });
  await expect(conflict).toBeVisible();
  expect(posts).toBe(0);
  await conflict.getByRole('button', { name: '최신본 검토' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('결정 사유')).toHaveValue(
    '현재 증적 기준으로는 승인할 수 없습니다.'
  );
  await dialog.getByRole('button', { name: '반려 확정' }).click();
  await expect.poll(() => posts).toBe(1);
});

test('결정 POST 503은 자동 재시도 없이 읽기 전용으로 전환하고 명시적 복구만 허용한다', async ({
  page,
}) => {
  await prepare(page);
  let posts = 0;
  await page.route('**/api/approvals/v1/tasks/*/decisions', (route) => {
    posts += 1;
    return route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ERROR', errorCode: 'UPSTREAM_UNAVAILABLE' }),
    });
  });

  await page.goto('/approvals/inbox?task=approval-task-1');
  await page.getByRole('button', { name: '승인', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '승인 확정' }).click();

  const recovery = page.getByRole('alert').filter({ hasText: '결정 결과를 확인할 수 없습니다' });
  await expect(recovery).toBeVisible();
  await expect(page.getByRole('button', { name: '승인', exact: true })).toBeDisabled();
  expect(posts).toBe(1);
  await recovery.getByRole('button', { name: '최신 권한 확인' }).click();
  await expect(recovery).toHaveCount(0);
  await expect(page.getByRole('button', { name: '승인', exact: true })).toBeEnabled();
  expect(posts).toBe(1);
});

test('결정 POST 시점의 403 권한 회수는 재전송 없이 최신 읽기 전용 상태로 수렴한다', async ({
  page,
}) => {
  await prepare(page);
  let revoked = false;
  let posts = 0;
  await page.route('**/api/approvals/v1/tasks/approval-task-1', (route) =>
    success(route, {
      ...APPROVAL_TASK_DETAIL_FIXTURE,
      canDecide: !revoked,
      task: { ...APPROVAL_HOME_FIXTURE.focusQueue[0], version: revoked ? 1 : 0 },
    })
  );
  await page.route('**/api/approvals/v1/tasks/*/decisions', (route) => {
    posts += 1;
    revoked = true;
    return route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ERROR', errorCode: 'APPROVAL_DECISION_FORBIDDEN' }),
    });
  });

  await page.goto('/approvals/inbox?task=approval-task-1');
  await page.getByRole('button', { name: '승인', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '승인 확정' }).click();

  const denied = page.getByRole('alert').filter({ hasText: '결정 권한이 변경되었습니다' });
  await expect(denied).toBeVisible();
  expect(posts).toBe(1);
  await denied.getByRole('button', { name: '최신 권한 확인' }).click();
  await expect(denied).toHaveCount(0);
  await expect(page.getByRole('button', { name: '승인', exact: true })).toBeDisabled();
  expect(posts).toBe(1);
});

test('담당 지정 직전 최신 상세 조회 실패는 claim POST 없이 읽기 전용으로 전환한다', async ({
  page,
}) => {
  await prepare(page);
  let failPreflight = false;
  let posts = 0;
  await page.route('**/api/approvals/v1/tasks/approval-task-1', (route) => {
    if (failPreflight) {
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ERROR', errorCode: 'AUTHORITY_RESOLUTION_UNAVAILABLE' }),
      });
    }
    return success(route, {
      ...APPROVAL_TASK_DETAIL_FIXTURE,
      canClaim: true,
      canDecide: false,
      task: { ...APPROVAL_HOME_FIXTURE.focusQueue[0], version: 1 },
    });
  });
  await page.route('**/api/approvals/v1/tasks/*/claim', (route) => {
    posts += 1;
    return success(route, APPROVAL_TASK_DETAIL_FIXTURE);
  });

  await page.goto('/approvals/inbox?task=approval-task-1');
  const claim = page.getByRole('button', { name: '내 업무로 가져오기' });
  await expect(claim).toBeEnabled();
  failPreflight = true;
  await claim.click();

  const recovery = page
    .getByRole('alert')
    .filter({ hasText: '담당 지정 결과를 확인할 수 없습니다' });
  await expect(recovery).toBeVisible();
  await expect(claim).toHaveCount(0);
  expect(posts).toBe(0);

  failPreflight = false;
  await recovery.getByRole('button', { name: '최신 권한 확인' }).click();
  await expect(recovery).toHaveCount(0);
  await expect(page.getByRole('button', { name: '내 업무로 가져오기' })).toBeEnabled();
  expect(posts).toBe(0);
});

test('완료 문서 권한이 회수되면 본문과 이력을 가리고 단건·배치 쓰기를 모두 닫는다', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await prepare(page);
  let posts = 0;
  await page.route('**/api/approvals/v1/tasks/approval-task-1', (route) =>
    success(route, {
      ...APPROVAL_TASK_DETAIL_FIXTURE,
      task: {
        ...APPROVAL_HOME_FIXTURE.focusQueue[0],
        title: 'Restricted approval',
        summary: '',
        status: 'APPROVED',
      },
      contentAccess: {
        state: 'REDACTED',
        reason: 'CURRENT_PERMISSION_REVOKED',
        evaluatedAt: '2026-09-11T00:00:00Z',
      },
      canClaim: false,
      canDecide: true,
    })
  );
  await page.route('**/api/approvals/v1/tasks/*/decisions', (route) => {
    posts += 1;
    return success(route, APPROVAL_TASK_DETAIL_FIXTURE);
  });

  await page.goto('/approvals/inbox?task=approval-task-1');
  await expect(
    page.getByRole('alert').filter({ hasText: '현재 권한으로 결재 내용을 열 수 없습니다' })
  ).toBeVisible();
  await expect(page.getByText('결재 조회 권한이 회수되었습니다.')).toBeVisible();
  await expect(page.getByText(/Restore a customer-facing integration/u)).toHaveCount(0);
  await expect(page.getByRole('button', { name: '승인', exact: true })).toHaveCount(0);

  await page.getByLabel('고객 분석 환경 접근 연장 배치 승인 선택').check();
  await page.getByRole('button', { name: '선택 항목 승인' }).click();
  const batchDialog = page.getByRole('dialog', { name: '선택한 결재를 승인할까요?' });
  await expect(batchDialog.getByText('처리 제외', { exact: true }).last()).toBeVisible();
  await expect(
    batchDialog.getByRole('button', {
      name: '배치 승인 시작 · 처리 가능 0건',
      exact: true,
    })
  ).toBeDisabled();
  expect(posts).toBe(0);
});

test('처리 불가 사전검증은 쓰기 없이 해당 결재의 최신 상세를 유지한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await prepare(page);
  let posts = 0;
  await page.route('**/api/approvals/v1/tasks/approval-task-1', (route) =>
    success(route, {
      ...APPROVAL_TASK_DETAIL_FIXTURE,
      task: APPROVAL_HOME_FIXTURE.focusQueue[0],
      canDecide: false,
    })
  );
  await page.route('**/api/approvals/v1/tasks/*/decisions', (route) => {
    posts += 1;
    return success(route, {});
  });

  await page.goto('/approvals/inbox');
  await page.getByLabel('고객 분석 환경 접근 연장 배치 승인 선택').check();
  await page.getByRole('button', { name: '선택 항목 승인' }).click();
  const batchDialog = page.getByRole('dialog', { name: '선택한 결재를 승인할까요?' });
  await expect(batchDialog).toContainText('현재 사용자에게 이 결재의 결정 권한이 없습니다.');
  await expect(
    batchDialog.getByRole('button', {
      name: '배치 승인 시작 · 처리 가능 0건',
      exact: true,
    })
  ).toBeDisabled();
  expect(posts).toBe(0);

  await batchDialog.getByRole('button', { name: '취소', exact: true }).click();
  await expect(page).toHaveURL(/task=approval-task-1/u);
  await expect(page.getByRole('heading', { name: '고객 분석 환경 접근 연장' })).toBeVisible();
  await expect(page.getByRole('button', { name: '승인', exact: true })).toBeDisabled();
});

test('배치 409는 최신 큐·권한·버전으로 실패 및 미시도 항목만 새 명령으로 재개하고 비식별 CSV를 제공한다', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await prepare(page);
  const thirdTask = {
    ...APPROVAL_HOME_FIXTURE.focusQueue[1],
    taskId: 'approval-task-3',
    requestId: 'approval-request-3',
    requestNumber: 'APR-20260814-003',
    title: '개인정보 포함 가능 비공개 제목',
    requesterName: '비공개 요청자',
  };
  const queue = [...APPROVAL_HOME_FIXTURE.focusQueue, thirdTask];
  const taskReads: string[] = [];
  await page.route('**/api/approvals/v1/tasks/search?*', async (route) =>
    success(route, approvalTaskSearchPage(new URL(route.request().url()), queue))
  );

  let task2Version = 0;
  for (const task of queue) {
    await page.route(`**/api/approvals/v1/tasks/${task.taskId}`, (route) => {
      taskReads.push(task.taskId);
      return success(route, {
        ...APPROVAL_TASK_DETAIL_FIXTURE,
        task: {
          ...task,
          version: task.taskId === 'approval-task-2' ? task2Version : task.version,
        },
        canDecide: true,
      });
    });
  }

  const writes: Array<{
    taskId: string;
    version: number;
  }> = [];
  await page.route('**/api/approvals/v1/tasks/*/decisions', (route) => {
    const body = route.request().postDataJSON() as { expectedVersion: number };
    const taskId = new URL(route.request().url()).pathname.split('/').at(-2)!;
    writes.push({
      taskId,
      version: body.expectedVersion,
    });
    if (taskId === 'approval-task-2' && task2Version === 0) {
      task2Version = 1;
      return route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ERROR', errorCode: 'VERSION_CONFLICT' }),
      });
    }
    return success(route, {});
  });

  await page.goto('/approvals/inbox');
  for (const task of queue) {
    await page.getByLabel(`${task.title} 배치 승인 선택`).check();
  }
  await page.getByRole('button', { name: '선택 항목 승인' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '배치 승인 시작' }).click();

  const result = page.getByRole('status').filter({ hasText: '배치 처리 결과' });
  await expect(result).toContainText('승인 1건 · 처리 불가 0건 · 남음 2건');
  await expect(result).toContainText('결재 내용이 변경되었습니다');
  await expect(result).toContainText('재시도 가능');

  const downloadPromise = page.waitForEvent('download');
  await result.getByRole('button', { name: 'CSV 다운로드' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();
  const csv = await readFile(path!, 'utf8');
  expect(csv).toContain('"approval-task-2","FAILED","VERSION_CONFLICT","true"');
  expect(csv).toContain('"approval-task-3","NOT_ATTEMPTED","EARLIER_FAILURE","true"');
  expect(csv).not.toContain(thirdTask.title);
  expect(csv).not.toContain(thirdTask.requesterName);

  await result.getByRole('button', { name: '다시 시도 (2)' }).click();
  await expect(result).toContainText('승인 3건 · 처리 불가 0건 · 남음 0건');
  expect(writes.map(({ taskId, version }) => [taskId, version])).toEqual([
    ['approval-task-1', 0],
    ['approval-task-2', 0],
    ['approval-task-2', 1],
    ['approval-task-3', 0],
  ]);
  expect(taskReads.filter((taskId) => taskId === 'approval-task-2').length).toBeGreaterThanOrEqual(
    2
  );
  expect(taskReads).toContain('approval-task-3');
});

test('배치가 확인한 권한 회수는 우측 상세에도 즉시 반영된다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await prepare(page);
  let revoked = false;
  let posts = 0;
  const queueTask = APPROVAL_HOME_FIXTURE.focusQueue[0];
  await page.route('**/api/approvals/v1/tasks/approval-task-1', (route) =>
    success(route, {
      ...APPROVAL_TASK_DETAIL_FIXTURE,
      canDecide: !revoked,
      task: { ...queueTask, version: queueTask.version + (revoked ? 1 : 0) },
    })
  );
  await page.route('**/api/approvals/v1/tasks/*/decisions', (route) => {
    posts += 1;
    return success(route, {});
  });
  await page.goto('/approvals/inbox?task=approval-task-1');
  await expect(page.getByRole('button', { name: '승인', exact: true })).toBeEnabled();
  revoked = true;
  await page.getByLabel('고객 분석 환경 접근 연장 배치 승인 선택').check();
  await page.getByRole('button', { name: '선택 항목 승인' }).click();
  const batchDialog = page.getByRole('dialog', { name: '선택한 결재를 승인할까요?' });
  await expect(
    batchDialog.getByRole('button', {
      name: '배치 승인 시작 · 처리 가능 0건',
      exact: true,
    })
  ).toBeDisabled();
  await expect(batchDialog).toContainText('목록과 상세의 버전이 달라 다시 확인해야 합니다.');
  await batchDialog.getByRole('button', { name: '취소', exact: true }).click();
  await expect(page.getByRole('button', { name: '승인', exact: true })).toBeDisabled();
  expect(posts).toBe(0);
});

test('모바일은 명시적 선택 모드에서만 배치 제어를 열고 항목별 결과를 알린다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepare(page);
  let posts = 0;
  await page.route('**/api/approvals/v1/tasks/*/decisions', (route) => {
    posts += 1;
    return success(route, {});
  });

  await page.goto('/approvals/inbox');
  const selection = page.getByLabel('고객 분석 환경 접근 연장 배치 승인 선택');
  await expect(selection).toHaveCount(0);
  await page.getByRole('button', { name: '선택', exact: true }).click();
  await expect(selection).toBeVisible();
  await selection.check();
  await page.getByRole('button', { name: '선택 항목 승인' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '배치 승인 시작' }).click();

  await expect(page.getByRole('status').filter({ hasText: '배치 처리 결과' })).toContainText(
    '승인 완료'
  );
  await expect(
    page.getByRole('status').filter({ hasText: '배치 처리 결과' }).getByRole('button')
  ).toHaveCount(2);
  const accessibility = await new AxeBuilder({ page })
    .include('[aria-labelledby="approval-batch-result-title"]')
    .analyze();
  expect(accessibility.violations).toEqual([]);
  expect(posts).toBe(1);
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '배치 처리 결과' })).toHaveCount(0);
  await page.getByRole('button', { name: '선택 취소', exact: true }).click();
  await expect(selection).toHaveCount(0);
});

test('결재함은 현재 큐와 확인 시각을 표시하고 사용자가 최신 목록을 재조회할 수 있다', async ({
  page,
}) => {
  await prepare(page);
  let reads = 0;
  await page.route(
    (url) =>
      url.pathname === '/api/approvals/v1/tasks/search' && url.searchParams.get('view') === 'INBOX',
    (route) => {
      reads += 1;
      return success(
        route,
        approvalTaskSearchPage(new URL(route.request().url()), APPROVAL_HOME_FIXTURE.focusQueue)
      );
    }
  );

  await page.goto('/approvals/inbox?queue=HIGH_RISK');
  await expect(page.getByRole('status').filter({ hasText: '고위험 · 2건' })).toBeVisible();
  const before = reads;
  await page.getByRole('button', { name: '결재 목록 새로고침', exact: true }).click();
  await expect.poll(() => reads).toBeGreaterThan(before);
});

test('오늘 마감 큐와 사이드바 건수는 자정에 함께 갱신된다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.clock.install({ time: new Date('2026-09-04T23:59:50+09:00') });
  await prepare(page);
  await page.route(
    (url) =>
      url.pathname === '/api/approvals/v1/tasks/search' && url.searchParams.get('view') === 'INBOX',
    async (route) =>
      success(
        route,
        approvalTaskSearchPage(
          new URL(route.request().url()),
          APPROVAL_HOME_FIXTURE.focusQueue.map((task, index) => ({
            ...task,
            dueAt: index === 0 ? '2026-09-04T23:59:59+09:00' : '2026-09-05T12:00:00+09:00',
          })),
          await page.evaluate(() => Date.now())
        )
      )
  );
  await page.goto('/approvals/inbox?queue=DUE_TODAY');
  const list = page.getByLabel('검토 대기 결재 목록');
  await expect(list.getByText('고객 분석 환경 접근 연장')).toBeVisible();
  await expect(list.getByText('신규 협력사 보안 예외')).toHaveCount(0);
  await page.clock.fastForward(15_000);
  await expect(list.getByText('고객 분석 환경 접근 연장')).toHaveCount(0);
  await expect(list.getByText('신규 협력사 보안 예외')).toBeVisible();
  await expect(
    page
      .getByRole('navigation', { name: '결재 큐 필터' })
      .getByRole('button', { name: /^오늘 마감/u })
  ).toContainText('1');
});

test('320px 200% 결재 상세와 확인 dialog는 가로 넘침 없이 마지막 작업까지 유지된다', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' });
  await prepare(page);
  await page.goto('/approvals/inbox?task=approval-task-1');
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });

  const detail = page.getByRole('region', { name: '결재 상세', exact: true });
  await expect(detail.getByRole('heading', { name: '고객 분석 환경 접근 연장' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await detail.getByRole('button', { name: '반려', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: '반려 확정' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('approval-detail-320-forced-200.png') });
});

for (const view of [
  { width: 1440, dark: false, forced: false },
  { width: 1280, dark: true, forced: false },
  { width: 390, dark: false, forced: false },
  { width: 320, dark: false, forced: true },
]) {
  test(`홈 시각 및 접근성 ${view.width} ${view.dark ? 'dark' : view.forced ? 'forced' : 'light'}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: view.width, height: 960 });
    await page.emulateMedia({
      reducedMotion: 'reduce',
      forcedColors: view.forced ? 'active' : 'none',
    });
    await prepare(page, view.dark);
    await page.goto('/approvals/home');
    await expect(
      page.getByRole('heading', { name: '안녕하세요, 이서연님', level: 1 })
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: '내 기안 진행 추적' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: '결재 큐 필터' })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations).toEqual([]);
    const screenshot = testInfo.outputPath('approval-home.png');
    await page.screenshot({ path: screenshot, fullPage: true });
    await testInfo.attach('approval-home', { path: screenshot, contentType: 'image/png' });
    if (view.width === 1440) {
      await page.goto('/approvals/inbox?task=approval-task-1');
      const filters = page.getByRole('navigation', { name: '결재 큐 필터' });
      await expect(filters.getByRole('button')).toHaveCount(4);
      await expect(page.getByRole('region', { name: '결재 상세', exact: true })).toContainText(
        '고객 분석 환경 접근 연장'
      );
      for (const [name, count] of [
        ['전체 대기', 2],
        ['긴급 결재', 1],
        ['오늘 마감', 0],
        ['고위험', 2],
      ] as const) {
        await filters.getByRole('button', { name: new RegExp(`^${name}`, 'u') }).click();
        await expect(
          page.getByLabel('검토 대기 결재 목록').locator('[data-approval-task-id]')
        ).toHaveCount(count);
      }
      const inboxScreenshot = testInfo.outputPath('approval-inbox.png');
      await page.screenshot({ path: inboxScreenshot, fullPage: true });
      await testInfo.attach('approval-inbox', { path: inboxScreenshot, contentType: 'image/png' });
    }
  });
}
