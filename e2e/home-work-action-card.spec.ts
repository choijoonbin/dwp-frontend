import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { APPROVAL_HOME_FIXTURE, APPROVAL_TASK_FIXTURE } from './support/product-area-fixtures';
import { mockWorkHubFoundation, WORK_HUB_FIXTURE } from './support/work-hub-foundation-fixtures';
import { routeEmptyFlowExecutionSummaries } from './support/flow-home-provider-fixtures';
import { createHomeOverviewFixture, fulfillSuccess } from './support/shell-session';

const evidenceDirectory = path.resolve(
  process.cwd(),
  'docs/05-features/DWP-R1-WRK-001-unified-work-execution/implementation-evidence/2026-09-16-stitch-delta-closeout/screens/remaining-frames'
);
const generatedAt = '2026-09-16T01:00:00.000Z';
const reviewId = 'f1111111-1111-4111-8111-111111111111';
const personalId = WORK_HUB_FIXTURE.personalId;
const approvalId = WORK_HUB_FIXTURE.approvalId;
const serviceId = WORK_HUB_FIXTURE.serviceId;
const titles = {
  approval: '고객 지원 장비 구매 승인 · 1,850,000원',
  review: '재무 시스템 접근권한 정기 검토',
  personal: '분기 고객 안내 초안 정리',
  service: '원격접속(VPN) 신청의 사용 사유 보완 요청',
};
const routes = {
  approval: `/approvals/inbox?task=${approvalId}`,
  review: `/work/queue?item=${reviewId}`,
  personal: `/work/queue?work=${encodeURIComponent(`PERSONAL_TASK:${personalId}:`)}`,
  service: `/work/queue?work=${encodeURIComponent(`SERVICE_REQUEST:${serviceId}:`)}`,
};

async function mockHomeActionCard(
  page: Page,
  options: {
    locale?: 'ko' | 'en';
    mode?: 'light' | 'dark';
    highContrast?: boolean;
    denyWork?: boolean;
  } = {}
) {
  await page.clock.setFixedTime(new Date(generatedAt));
  await mockWorkHubFoundation(page, {
    locale: options.locale ?? 'ko',
    mode: options.mode ?? 'light',
    highContrast: options.highContrast ?? false,
    designDetails: true,
    accessReview: true,
    nativeWorkspace: false,
    personalTitle: titles.personal,
    workspaceGeneratedAt: generatedAt,
    additionalPermissions: [
      {
        resourceType: 'APP',
        resourceKey: 'APP.HCM',
        permissionCode: 'VIEW',
        effect: 'DENY',
      },
      ...(options.denyWork
        ? [
            {
              resourceType: 'APP',
              resourceKey: 'APP.WORK',
              permissionCode: 'VIEW',
              effect: 'DENY' as const,
            },
          ]
        : []),
    ],
  });
  await routeEmptyFlowExecutionSummaries(page, generatedAt);
  await page.route('**/api/platform/v1/home-experience', (route) =>
    fulfillSuccess(route, {
      headline: null,
      subheadline: null,
      localizedContent: {},
      defaultLocale: options.locale ?? 'ko',
      backgroundPosition: 'RIGHT',
      overlayOpacity: 18,
      backgroundUrl: null,
      launchpadConfiguration: { schemaVersion: 1, groups: [], placements: [] },
      compositionPolicy: {
        schemaVersion: 3,
        experienceVariant: 'FLOW_V1',
        personalCustomizationEnabled: true,
        governedZones: [],
      },
      effectiveExperienceVariant: 'FLOW_V1',
      advancedPersonalizationEnabled: false,
      composerEnabled: false,
      homePreferenceStore: 'LEGACY',
      version: 7,
    })
  );
  await page.route('**/api/platform/v1/home/overview**', (route) => {
    const overview = createHomeOverviewFixture(['WORKSPACE_MEMBER']);
    return fulfillSuccess(route, {
      ...overview,
      generatedAt,
      work: {
        ...overview.work,
        generatedAt,
        data: {
          summary: { total: 1, dueSoon: 1, inProgress: 0, waiting: 0, completed: 0 },
          generatedAt,
          items: [
            {
              workItemId: reviewId,
              id: 'IG-014',
              title: titles.review,
              summary: '재경팀 · EMP-88219',
              dataClassification: 'INTERNAL',
              type: 'REVIEW',
              priority: 'HIGH',
              status: 'DUE_SOON',
              owner: 'Mina Kim',
              dueAt: '2026-09-16T08:00:00Z',
              sourceSystem: 'IDENTITY_GOVERNANCE',
              sourceReference: reviewId,
              sourceRoute: null,
              reason: '정기 검토 기한이 오늘입니다.',
              version: 3,
              updatedAt: generatedAt,
            },
          ],
        },
      },
    });
  });
  await page.route(/\/api\/approvals\/v1\/home(?:\?|$)/u, (route) =>
    fulfillSuccess(route, {
      ...APPROVAL_HOME_FIXTURE,
      generatedAt,
      metrics: {
        ...APPROVAL_HOME_FIXTURE.metrics,
        pending: 1,
        dueToday: 1,
        overdue: 0,
        needsInformation: 0,
        myRequestsInFlight: 0,
      },
      focusQueue: [
        {
          ...APPROVAL_TASK_FIXTURE,
          taskId: approvalId,
          requestId: 'c2222222-2222-4222-8222-222222222222',
          requestNumber: 'APR-031',
          title: titles.approval,
          summary: '고객지원 인력 증원에 따른 헤드셋 10대 구매 검토',
          requesterName: '박서진',
          requesterOrgName: '고객지원본부',
          dueAt: '2026-09-16T02:00:00Z',
        },
      ],
      recentRequests: [],
      administrator: false,
      adminPulse: null,
    })
  );
  await page.route(/\/api\/platform\/v1\/workspace\/work-hub\/personal-tasks(?:\?|$)/u, (route) =>
    fulfillSuccess(route, {
      items: [
        {
          taskId: personalId,
          title: titles.personal,
          description: '고객 안내 초안의 남은 문구를 정리합니다.',
          status: 'OPEN',
          priority: 'NORMAL',
          dueAt: null,
          source: null,
          sources: [],
          checklist: [],
          version: 4,
          createdAt: generatedAt,
          updatedAt: generatedAt,
          completedAt: null,
        },
      ],
      page: 0,
      size: 100,
      totalElements: 1,
      hasMore: false,
    })
  );
}

async function openCard(page: Page) {
  await page.goto('/');
  const card = page.locator('[data-flow-section="purpose-action"]');
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card.getByRole('tab')).toHaveCount(4);
  await expect(card.locator('[data-home-work-filter-panel="all"]')).toBeVisible();
  return card;
}

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow, `${label} must not overflow horizontally`).toBeLessThanOrEqual(1);
}

async function capture(page: Page, testInfo: TestInfo, fileName: string) {
  await mkdir(evidenceDirectory, { recursive: true });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
  });
  await expectNoHorizontalOverflow(page, fileName);
  const outputPath = path.join(evidenceDirectory, fileName);
  await page.screenshot({ path: outputPath, fullPage: true, animations: 'disabled' });
  await testInfo.attach(fileName, { path: outputPath, contentType: 'image/png' });
}

test.describe.configure({ mode: 'serial' });
test.setTimeout(120_000);

test('H01 renders four governed filters, explicit actions, and canonical destinations', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mockHomeActionCard(page);
  const card = await openCard(page);

  await expect(card.getByRole('link', { name: '통합업무함 열기', exact: true })).toHaveAttribute(
    'href',
    '/work/queue'
  );

  for (const [name, count] of [
    ['전체', 4],
    ['긴급 승인', 1],
    ['권한 심사', 1],
    ['개인 할 일', 1],
  ] as const) {
    await expect(card.getByRole('tab', { name: `${name} ${count}건`, exact: true })).toBeVisible();
  }
  const expected = [
    [routes.approval, titles.approval, '전자결재에서 검토'],
    [routes.review, titles.review, '권한 검토'],
    [routes.personal, titles.personal, '시작하기'],
    [routes.service, titles.service, '사유 보완'],
  ] as const;
  for (const [href, title, action] of expected) {
    const link = card.locator(`a[href="${href}"]`);
    await expect(link).toHaveCount(1);
    await expect(link).toContainText(title);
    await expect(link).toContainText(action);
  }
  await expect(
    page.locator('[data-flow-section="purpose-response"]').getByText(titles.service, {
      exact: true,
    })
  ).toHaveCount(0);

  const all = card.getByRole('tab', { name: '전체 4건', exact: true });
  await all.focus();
  await page.keyboard.press('ArrowRight');
  const urgent = card.getByRole('tab', { name: '긴급 승인 1건', exact: true });
  await expect(urgent).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(urgent).toHaveAttribute('aria-selected', 'true');
  await expect(card.locator('[data-home-work-filter-panel="urgentApproval"]')).toContainText(
    titles.approval
  );
  await expect(card.locator('[data-home-work-filter-panel="urgentApproval"]')).not.toContainText(
    titles.personal
  );
  for (const [tabName, panel, title, action] of [
    ['권한 심사 1건', 'accessReview', titles.review, '권한 검토'],
    ['개인 할 일 1건', 'personalTask', titles.personal, '시작하기'],
  ] as const) {
    await card.getByRole('tab', { name: tabName, exact: true }).click();
    const filtered = card.locator(`[data-home-work-filter-panel="${panel}"]`);
    await expect(filtered.getByRole('listitem')).toHaveCount(1);
    await expect(filtered).toContainText(title);
    await expect(filtered).toContainText(action);
  }
  await all.click();

  const results = await new AxeBuilder({ page })
    .include('[data-flow-section="purpose-action"]')
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  expect(
    results.violations.filter((violation) =>
      ['serious', 'critical'].includes(violation.impact ?? '')
    )
  ).toEqual([]);
  await capture(page, testInfo, 'wrk-h01-1440.png');
});

test('H01 reflows at 390, 320, and CSS 200 percent without hiding actions', async ({
  page,
}, testInfo) => {
  await mockHomeActionCard(page);
  for (const [width, height, fileName] of [
    [390, 844, 'wrk-h01-390.png'],
    [320, 740, 'wrk-h01-320.png'],
  ] as const) {
    await page.setViewportSize({ width, height });
    const card = await openCard(page);
    await expect(card.getByText('사유 보완', { exact: true })).toBeVisible();
    const controls = await card.getByRole('tab').evaluateAll((tabs) =>
      tabs.map((tab) => ({
        width: tab.getBoundingClientRect().width,
        height: tab.getBoundingClientRect().height,
      }))
    );
    expect(controls.every((control) => control.width >= 44 && control.height >= 44)).toBe(true);
    const cardRect = await card.boundingBox();
    const tabRects = await card.getByRole('tab').evaluateAll((tabs) =>
      tabs.map((tab) => {
        const rect = tab.getBoundingClientRect();
        return { left: rect.left, right: rect.right };
      })
    );
    expect(cardRect).not.toBeNull();
    expect(
      tabRects.every(
        (rect) =>
          rect.left >= (cardRect?.x ?? 0) - 1 &&
          rect.right <= (cardRect?.x ?? 0) + (cardRect?.width ?? 0) + 1
      )
    ).toBe(true);
    await capture(page, testInfo, fileName);
  }

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  await expect(page.getByTestId('flow-home')).toHaveAttribute('data-flow-large-text', 'true');
  const zoomCard = page.locator('[data-flow-section="purpose-action"]');
  await expect(zoomCard.getByRole('tab')).toHaveCount(4);
  await expect(zoomCard.getByText('전자결재에서 검토', { exact: true })).toBeVisible();
  const widgetWidths = await page.locator('[data-workspace-widget]').evaluateAll((widgets) =>
    widgets
      .map((widget) => widget.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .map((rect) => rect.width)
  );
  expect(widgetWidths.length).toBeGreaterThan(0);
  expect(Math.min(...widgetWidths)).toBeGreaterThanOrEqual(600);
  await capture(page, testInfo, 'wrk-h01-zoom-200.png');
});

for (const appearance of [
  { name: 'dark', mode: 'dark' as const, highContrast: false },
  { name: 'forced-colors', mode: 'light' as const, highContrast: true },
]) {
  test(`H01 preserves filters and actions in ${appearance.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockHomeActionCard(page, appearance);
    if (appearance.highContrast) {
      await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
    }
    const card = await openCard(page);
    const first = card.getByRole('tab', { name: '전체 4건', exact: true });
    await first.focus();
    await expect(first).toBeFocused();
    await expect(card.getByText('권한 검토', { exact: true })).toBeVisible();
    await capture(page, testInfo, `wrk-h01-${appearance.name}-390.png`);
  });
}

test('H01 provides the same filter and action contract in English', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockHomeActionCard(page, { locale: 'en' });
  const card = await openCard(page);
  await expect(card.getByRole('tab', { name: 'All, 4 items', exact: true })).toBeVisible();
  await expect(
    card.getByRole('tab', { name: 'Urgent approvals, 1 item', exact: true })
  ).toBeVisible();
  for (const action of ['Review in Approvals', 'Review access', 'Start', 'Add reason']) {
    await expect(card.getByText(action, { exact: true })).toBeVisible();
  }
});

test('H01 withholds the Work Hub header route when Work view is denied', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockHomeActionCard(page, { denyWork: true });
  await page.goto('/');
  const card = page.locator('[data-flow-section="purpose-action"]');
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card.locator('a[href="/work/queue"]')).toHaveCount(0);
  await expect(card.getByRole('link', { name: '통합업무함 열기', exact: true })).toHaveCount(0);
});
