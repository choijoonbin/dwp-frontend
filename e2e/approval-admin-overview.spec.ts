import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route, type TestInfo } from '@playwright/test';

import { mockShellSession } from './support/shell-session';
import {
  broadcastProductSurfaceRevision,
  mockApprovalProductSurfaceAuthority,
} from './support/product-surface-authority';
import { APPROVAL_ADMIN_FIXTURE } from './support/product-area-approval-fixtures';
import { PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS } from '../apps/dwp/src/routes/product-surface-authorization.generated';

import type { ApprovalAuthorityOptions } from './support/product-surface-authority';
import type { ApprovalAdminPulse } from '../libs/shared-utils/src/api/approval-management-contract';

const overviewPath = '/api/approvals/v1/admin/overview';
const overviewUrl = '/approvals/admin/overview?scope=scope%3Aapprovals%3Atenant';
const history = '과거 수신 데이터 · 현재 상태 미확인';
const quickLinks = [
  ['프로세스 설계', 'workflows'],
  ['결재 정책', 'policies'],
  ['SLA 및 전달 운영', 'operations'],
  ['전자서명 연계', 'signatures'],
] as const;
type Appearance = 'light' | 'dark' | 'forced' | 'large-text';

function pulse(): ApprovalAdminPulse {
  const generatedAt = Date.now();
  const windowEnd =
    Math.floor(generatedAt / (6 * 60 * 60 * 1000)) * (6 * 60 * 60 * 1000) + 6 * 60 * 60 * 1000;
  const windowStart = windowEnd - 72 * 60 * 60 * 1000;
  return {
    ...structuredClone(APPROVAL_ADMIN_FIXTURE),
    activeRequests: 97,
    overdueTasks: 0,
    trend: {
      generatedAt: new Date(generatedAt).toISOString(),
      windowHours: 72,
      bucketHours: 6,
      buckets: Array.from({ length: 12 }, (_, index) => ({
        startsAt: new Date(windowStart + index * 6 * 60 * 60 * 1000).toISOString(),
        endsAt: new Date(windowStart + (index + 1) * 6 * 60 * 60 * 1000).toISOString(),
        submittedRequests: 3 + (index % 4),
        completedRequests: 2 + (index % 3),
        slaBreaches: index === 11 ? 2 : index === 7 ? 1 : 0,
        unresolvedDeliveryUpdates: index === 10 ? 1 : 0,
        inFlightRequests: 71 + index * 2 + (index % 3),
        slaEligibleTasks: index === 11 ? 8 : index === 7 ? 6 : 4,
      })),
    },
  };
}
function success(route: Route, data: unknown) {
  return route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', data }),
  });
}
function main(page: Page) {
  return page.getByRole('main');
}
function shortcuts(page: Page) {
  return main(page)
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: '관리 바로가기', exact: true }) });
}
function exceptions(page: Page) {
  return main(page)
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: '기한 초과 결재', exact: true }) });
}
async function noOverviewLinks(page: Page) {
  await expect(shortcuts(page)).toHaveCount(0);
  await expect(exceptions(page)).toHaveCount(0);
  for (const [label] of quickLinks)
    await expect(main(page).getByRole('button', { name: label, exact: true })).toHaveCount(0);
}
async function historical(page: Page) {
  await expect(main(page).getByRole('alert').filter({ hasText: history })).toBeVisible();
  await expect(main(page).getByText('97', { exact: true })).toBeVisible();
  await expect(main(page).getByText('확인 불가', { exact: true })).toHaveCount(4);
  await expect(main(page).getByText('현재 집계에서 통제 예외 없음', { exact: true })).toHaveCount(
    0
  );
  await noOverviewLinks(page);
}
async function capture(page: Page, info: TestInfo, name: string) {
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: false });
}
async function closeTransientTooltip(page: Page) {
  await page.mouse.move(0, 0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
}

// Canonical current-release browser UI fixtures, not genuine Auth, signed evidence,
// native authority execution, or proof that the original's demo telemetry is real.
async function setup(
  page: Page,
  appearance: Appearance = 'light',
  options: ApprovalAuthorityOptions = {}
) {
  await page.emulateMedia({
    colorScheme: appearance === 'dark' ? 'dark' : 'light',
    forcedColors: appearance === 'forced' ? 'active' : 'none',
    reducedMotion: 'reduce',
  });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: [],
    appearance: {
      mode: appearance === 'dark' ? 'dark' : 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
  const authority = await mockApprovalProductSurfaceAuthority(page, {
    decisionRevisionFormat: 'sha256',
    rolloutState: '111',
    generatedAt: new Date().toISOString(),
    revalidateAt: new Date(Date.now() + 600000).toISOString(),
    ...options,
  });
  const state = {
    pulse: pulse(),
    failure: 0,
    pause: false,
    release: undefined as (() => void) | undefined,
    reads: [] as Array<{ scope: string | null; headers: Record<string, string> }>,
    commands: [] as string[],
  };
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/approvals/') && request.method() !== 'GET')
      state.commands.push(request.url());
  });
  await page.route(
    (url) => url.pathname === overviewPath,
    async (route) => {
      state.reads.push({
        scope: new URL(route.request().url()).searchParams.get('contextScopeKey'),
        headers: route.request().headers(),
      });
      if (state.pause)
        await new Promise<void>((resolve) => {
          state.release = resolve;
        });
      if (state.failure)
        return route.fulfill({
          status: state.failure,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ERROR', errorCode: 'OVERVIEW_SOURCE_UNAVAILABLE' }),
        });
      return success(route, state.pulse);
    }
  );
  return { state, authority };
}
async function open(page: Page) {
  await page.goto(overviewUrl);
  await expect(
    page.getByRole('heading', { name: '결재 운영 개요', exact: true, level: 1 })
  ).toBeVisible();
  await expect(main(page).getByText('97', { exact: true })).toBeVisible();
  await expect(shortcuts(page)).toBeVisible();
  await expect(main(page).getByTestId('approval-admin-trend')).toBeVisible();
}
async function refresh(page: Page) {
  await main(page).getByRole('button', { name: '새로고침', exact: true }).click();
}
async function retry(page: Page) {
  await main(page).getByRole('button', { name: '다시 시도', exact: true }).click();
}
async function overflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  ).toBeLessThanOrEqual(1);
}

for (const appearance of ['light', 'dark', 'forced', 'large-text'] as const) {
  test(`original-adapted Overview geometry, four controls, keyboard and Axe (${appearance})`, async ({
    page,
  }, info) => {
    await page.setViewportSize({
      width: info.project.name === 'mobile' ? 320 : 1440,
      height: 1000,
    });
    const { state } = await setup(page, appearance);
    await open(page);
    const heading = page.getByRole('heading', {
      name: '결재 운영 개요',
      exact: true,
      level: 1,
    });
    const initialHeadingFont = await heading.evaluate((node) =>
      Number.parseFloat(getComputedStyle(node).fontSize)
    );
    if (appearance === 'large-text') {
      const baseFont = await page.evaluate(() =>
        Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
      );
      await page.evaluate(
        (size) => document.documentElement.style.setProperty('font-size', `${size}px`, 'important'),
        baseFont * 2
      );
      await expect
        .poll(() => heading.evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize)))
        .toBe(initialHeadingFont * 2);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await overflow(page);
    await capture(page, info, `overview-${appearance}-top-viewport`);
    await expect(main(page).getByText(/^마지막 수신 /u)).toBeVisible();
    await expect(main(page).getByText('역할 분리 참고 기준', { exact: true })).toBeVisible();
    await expect(
      main(page).getByRole('button', {
        name: /프로세스 설계자|정책 게시 책임자|결재 운영 담당자|독립 감사자/u,
      })
    ).toHaveCount(0);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    const refreshControl = main(page).getByRole('button', { name: '새로고침', exact: true });
    await refreshControl.hover();
    const refreshTooltip = main(page).getByRole('tooltip', { name: '새로고침', exact: true });
    await expect(refreshTooltip).toBeVisible();
    await expect(page.locator('body > [role="tooltip"]')).toHaveCount(0);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await closeTransientTooltip(page);
    for (const [label] of quickLinks) {
      const control = shortcuts(page).getByRole('button', { name: label, exact: true });
      await control.scrollIntoViewIfNeeded();
      await control.focus();
      await expect(control).toBeFocused();
      const bounds = await control.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return { left: rect.left, right: rect.right, width: rect.width, height: rect.height };
      });
      expect(bounds.left).toBeGreaterThanOrEqual(0);
      expect(bounds.right).toBeLessThanOrEqual(page.viewportSize()!.width);
      expect(bounds.height).toBeGreaterThanOrEqual(44);
    }
    await shortcuts(page).scrollIntoViewIfNeeded();
    await overflow(page);
    await capture(page, info, `overview-${appearance}-quicklinks-viewport`);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await capture(page, info, `overview-${appearance}-bottom-viewport`);
    expect(state.commands).toEqual([]);
  });
}

for (const [label, pageKey] of quickLinks) {
  test(`keyboard ${label} goes to its canonical PAGE with exact selected scope`, async ({
    page,
  }) => {
    const contract = PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS.find(
      (entry) => entry.routeContractKey === `route.approvals.admin.${pageKey}.page`
    );
    expect(contract?.pattern).toBe(`/approvals/admin/${pageKey}`);
    const { state } = await setup(page);
    await open(page);
    const control = shortcuts(page).getByRole('button', { name: label, exact: true });
    await control.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(
      new RegExp(`/approvals/admin/${pageKey}\\?scope=scope%3Aapprovals%3Atenant$`, 'u')
    );
    expect(state.commands).toEqual([]);
  });
}

for (const [label, target, queue] of [
  ['기한 초과', 'operations', 'sla'],
  ['전달 실패', 'operations', 'delivery'],
  ['직무 분리', 'policies', null],
] as const) {
  test(`exception ${label} uses actual ${target} PAGE and ${queue ?? 'no invented policy ID'}`, async ({
    page,
  }) => {
    const { state } = await setup(page);
    state.pulse.overdueTasks = 2;
    state.pulse.failedIntegrations = 1;
    state.pulse.assurance = state.pulse.assurance.map((row) =>
      row.key === 'segregation' ? { ...row, state: 'ATTENTION', exceptions: 1 } : row
    );
    await open(page);
    const control = exceptions(page).getByRole('button', { name: new RegExp(label, 'u') });
    await control.click();
    await expect.poll(() => new URL(page.url()).pathname).toBe(`/approvals/admin/${target}`);
    const query = new URL(page.url()).searchParams;
    expect(query.get('queue')).toBe(queue);
    expect(query.get('scope')).toBe('scope:approvals:tenant');
    expect(query.has('policyId')).toBe(false);
    expect(query.has('review')).toBe(false);
    expect(state.commands).toEqual([]);
  });
}

test('first generic503 keeps labelled historical counts, zero Overview links, scoped explicit200 recovery', async ({
  page,
}, info) => {
  const { state } = await setup(page);
  await open(page);
  const before = state.reads.length;
  state.failure = 503;
  await refresh(page);
  await expect.poll(() => state.reads.length).toBe(before + 1);
  await historical(page);
  await capture(page, info, 'overview-first503-historical-viewport');
  await page.waitForTimeout(1100);
  expect(state.reads).toHaveLength(before + 1);
  await closeTransientTooltip(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  state.failure = 0;
  await refresh(page);
  await expect(shortcuts(page)).toBeVisible();
  await expect(main(page).getByText(history, { exact: true })).toHaveCount(0);
  expect(state.reads.at(-1)?.scope).toBe('scope:approvals:tenant');
  expect(state.reads.at(-1)?.headers['idempotency-key']).toBeUndefined();
  expect(state.reads.at(-1)?.headers['x-dwp-step-up-challenge']).toBeUndefined();
  expect(state.commands).toEqual([]);
  await capture(page, info, 'overview-503-explicit200-recovered-viewport');
});

test('first403 masks data and all Overview links; retry503 stays latched; only qualified explicit200 recovers', async ({
  page,
}, info) => {
  const { state } = await setup(page);
  await open(page);
  const before = state.reads.length;
  state.failure = 403;
  await refresh(page);
  await expect.poll(() => state.reads.length).toBe(before + 1);
  await expect(main(page).getByText('97', { exact: true })).toHaveCount(0);
  await noOverviewLinks(page);
  await expect(main(page).getByRole('alert')).toBeVisible();
  await capture(page, info, 'overview-first403-masked-viewport');
  await page.waitForTimeout(1100);
  expect(state.reads).toHaveLength(before + 1);
  state.failure = 503;
  await retry(page);
  await expect.poll(() => state.reads.length).toBe(before + 2);
  await expect(main(page).getByText('97', { exact: true })).toHaveCount(0);
  await noOverviewLinks(page);
  await expect(main(page).getByText(history, { exact: true })).toHaveCount(0);
  await capture(page, info, 'overview-403-retry503-still-latched-viewport');
  state.failure = 0;
  await retry(page);
  await expect(shortcuts(page)).toBeVisible();
  await expect(main(page).getByText('97', { exact: true })).toBeVisible();
  expect(state.commands).toEqual([]);
  await capture(page, info, 'overview-403-explicit200-recovered-viewport');
});

test('held actual revalidation GET disables all Overview links until the real scoped response succeeds', async ({
  page,
}, info) => {
  const { state } = await setup(page);
  await open(page);
  const before = state.reads.length;
  state.pause = true;
  await refresh(page);
  await expect.poll(() => state.release !== undefined).toBe(true);
  try {
    await historical(page);
    await capture(page, info, 'overview-held-revalidation-readonly-viewport');
    expect(state.reads).toHaveLength(before + 1);
    expect(state.commands).toEqual([]);
  } finally {
    state.pause = false;
    state.release?.();
  }
  await expect(shortcuts(page)).toBeVisible();
});

test('initial503 has no historical or invented zero counts and only explicit retry recovers', async ({
  page,
}) => {
  const { state } = await setup(page);
  state.failure = 503;
  await page.goto(overviewUrl);
  await expect(main(page).getByRole('alert')).toBeVisible();
  await noOverviewLinks(page);
  await expect(main(page).getByText('97', { exact: true })).toHaveCount(0);
  await expect(main(page).getByText(history, { exact: true })).toHaveCount(0);
  expect(state.reads).toHaveLength(1);
  state.failure = 0;
  await retry(page);
  await expect(shortcuts(page)).toBeVisible();
  expect(state.reads).toHaveLength(2);
});

test('denied workflow/operations target PAGE does not borrow policy/signature authority; role reference is not a command', async ({
  page,
}) => {
  const { state } = await setup(page, 'light', {
    deniedRouteKeys: [
      'route.approvals.admin.workflows.page',
      'route.approvals.admin.operations.page',
    ],
  });
  state.pulse.overdueTasks = 2;
  state.pulse.assurance = state.pulse.assurance.map((row) =>
    row.key === 'segregation' ? { ...row, state: 'ATTENTION', exceptions: 1 } : row
  );
  await open(page);
  await expect(shortcuts(page).getByRole('button')).toHaveCount(2);
  await expect(
    shortcuts(page).getByRole('button', { name: '결재 정책', exact: true })
  ).toBeVisible();
  await expect(
    shortcuts(page).getByRole('button', { name: '전자서명 연계', exact: true })
  ).toBeVisible();
  await expect(exceptions(page).getByRole('button')).toHaveCount(1);
  await expect(
    main(page).getByRole('button', {
      name: /프로세스 설계자|정책 게시 책임자|결재 운영 담당자|독립 감사자/u,
    })
  ).toHaveCount(0);
  expect(state.commands).toEqual([]);
});

test('current PAGE capability revocation removes body and shortcuts without another Overview read', async ({
  page,
}) => {
  const { state, authority } = await setup(page);
  await open(page);
  const before = state.reads.length;
  authority.revoke('approvals.admin');
  await broadcastProductSurfaceRevision(page, authority.revision());
  await expect(main(page).getByText('97', { exact: true })).toHaveCount(0);
  await noOverviewLinks(page);
  expect(state.reads).toHaveLength(before);
  expect(state.commands).toEqual([]);
});

test('real browser20s expiry starts one scoped revalidation; first403 then no automatic GET or current links', async ({
  page,
}) => {
  await page.clock.install();
  const { state } = await setup(page);
  await open(page);
  const before = state.reads.length;
  state.failure = 403;
  await page.clock.runFor(20_100);
  await expect.poll(() => state.reads.length).toBe(before + 1);
  await noOverviewLinks(page);
  await expect(main(page).getByText('97', { exact: true })).toHaveCount(0);
  await page.clock.runFor(60_000);
  expect(state.reads).toHaveLength(before + 1);
  expect(state.commands).toEqual([]);
});
