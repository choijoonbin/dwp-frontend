import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';
import { ASK_RUNTIME_FIXTURE, WORKSPACE_QUEUE_FIXTURE } from './support/runtime-access';
import { mockQuestionLaunches } from './support/question-launch';

async function homeFixture(
  page: Page,
  options: { locale?: 'ko' | 'en'; dark?: boolean; empty?: boolean } = {}
) {
  await page.emulateMedia({
    reducedMotion: 'reduce',
    colorScheme: options.dark ? 'dark' : 'light',
  });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: options.locale ?? 'en',
    displayName: options.locale === 'ko' ? '최준빈' : 'Mina Kim',
    permissions: FULL_PRODUCT_PERMISSIONS,
    appearance: {
      mode: options.dark ? 'dark' : 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
  await mockQuestionLaunches(page);
  await page.route('**/api/agent/v1/conversations', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: options.empty
          ? []
          : [
              '오늘 가장 먼저 확인해야 할 업무는 무엇인가요?',
              '고객사 미팅을 위한 주요 이슈를 정리해 주세요.',
              '분기 목표와 진행 상황을 비교해 주세요.',
            ].map((title, index) => ({
              conversationId: `conversation-${index}`,
              title,
              locale: 'ko',
              messageCount: 2,
              createdAt: '2026-09-04T00:00:00Z',
              updatedAt: `2026-09-04T0${index}:00:00Z`,
              lastMessageAt: `2026-09-04T0${index}:00:00Z`,
            })),
      },
    })
  );
  await page.route('**/api/platform/v1/workspace/work-items', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: options.empty
          ? {
              ...WORKSPACE_QUEUE_FIXTURE,
              summary: { total: 0, dueSoon: 0, inProgress: 0, waiting: 0, completed: 0 },
              items: [],
            }
          : WORKSPACE_QUEUE_FIXTURE,
      },
    })
  );
  await page.route('**/api/agent/v1/actions', (route) =>
    route.fulfill({ json: { success: true, data: [] } })
  );
  await page.route('**/api/agent/v1/proposals?**', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          items: [],
          summary: {
            active: options.empty ? 0 : 2,
            highPriority: options.empty ? 0 : 1,
            snoozed: 0,
            handled: 0,
          },
          nextCursor: null,
        },
      },
    })
  );
  await page.route('**/api/platform/v1/catalog/registry-entries?**', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: options.empty
          ? []
          : [
              {
                registryType: 'AGENT',
                entryKey: 'DWP_ASSISTANT',
                revision: 1,
                name: 'DWP 업무 어시스턴트',
                description: '사내 정책, 메일, 일정과 업무 맥락을 함께 확인합니다.',
                ownerRef: 'DWP',
                riskTier: 'LOW',
                artifactVersion: '1.0',
              },
              {
                registryType: 'AGENT',
                entryKey: 'DWP_APPROVAL_EXPERT',
                revision: 1,
                name: '전자결재 전문 에이전트',
                description: '결재 요청과 승인 현황을 근거와 함께 검토합니다.',
                ownerRef: 'DWP',
                riskTier: 'LOW',
                artifactVersion: '1.0',
              },
            ],
      },
    })
  );
}

test('home presents verified signals, navigable destinations and no fabricated live telemetry', async ({
  page,
}) => {
  await homeFixture(page);
  await page.goto('/dwaion/home');
  const home = page.getByTestId('dwaion-home');
  await expect(home.getByText('5 signal sources checked', { exact: false })).toBeVisible();
  for (const [key, route, value] of [
    ['priorityWork', '/work/queue', '1'],
    ['conversations', '/dwaion/conversations', '3'],
    ['proposals', '/dwaion/proposals', '2'],
    ['agents', '/dwaion/agents', '2'],
    ['actions', '/dwaion/actions', '0'],
  ]) {
    await expect(page.getByTestId(`dwaion-signal-${key}`)).toHaveAttribute('href', route);
    await expect(page.getByTestId(`dwaion-signal-${key}`)).toContainText(value);
  }
  await expect(home.getByRole('link', { name: /Approve software access/ })).toHaveAttribute(
    'href',
    '/work/queue?item=WK-1042'
  );
  await expect(home.getByRole('link', { name: /Review customer briefing/ })).toHaveAttribute(
    'href',
    '/work/queue?item=WK-1045'
  );
  await expect(home.getByText('Travel expense follow-up')).toHaveCount(0);
  await expect(
    home.getByText(/Live v2.5|automatic analysis complete|AI prioritization complete/i)
  ).toHaveCount(0);
  for (const label of ['Today’s work brief', 'Find blockers', 'Prepare for meetings']) {
    const bounds = await home.getByRole('button', { name: label, exact: true }).boundingBox();
    expect(bounds?.height ?? 0, `${label} touch target`).toBeGreaterThanOrEqual(44);
  }
  expect(
    await home.locator('img').evaluate((image) => (image as HTMLImageElement).naturalWidth > 0)
  ).toBe(true);
  const violations = (
    await new AxeBuilder({ page }).include('[data-testid="dwaion-home"]').analyze()
  ).violations;
  expect(
    violations.filter((entry) => ['critical', 'serious'].includes(entry.impact ?? ''))
  ).toEqual([]);
});

test('source failures do not become zero or stale content and refresh recovers', async ({
  page,
}) => {
  await homeFixture(page);
  let fail = false;
  await page.route('**/api/agent/v1/conversations', (route) =>
    route.fulfill(
      fail ? { status: 403, json: { detail: 'Forbidden' } } : { json: { success: true, data: [] } }
    )
  );
  await page.goto('/dwaion/home');
  const metric = page.getByTestId('dwaion-signal-conversations');
  await expect(metric).toContainText('0');
  fail = true;
  await page
    .getByTestId('dwaion-home')
    .getByRole('button', { name: 'Refresh', exact: true })
    .click();
  await expect(metric).toContainText('Unavailable', { timeout: 20000 });
  await expect(metric).not.toContainText('0');
  await expect(
    page.getByRole('region', { name: 'Recent conversations', exact: true }).getByRole('alert')
  ).toBeVisible();
  await expect(page.getByTestId('dwaion-signal-proposals')).toContainText('2');
  fail = false;
  await page
    .getByRole('region', { name: 'Recent conversations', exact: true })
    .getByRole('button', { name: 'Retry' })
    .click();
  await expect(metric).toContainText('0');
  await expect(page.getByText('There are no conversations yet')).toBeVisible();
});

test('failed question launch retains the prompt and a retry uses only an opaque ticket', async ({
  page,
}) => {
  await homeFixture(page);
  let fail = true;
  let launches = 0;
  await page.route('**/api/agent/v1/question-launches', (route) => {
    launches += 1;
    return fail
      ? route.fulfill({ status: 503, json: { detail: 'Unavailable' } })
      : route.fallback();
  });
  await page.route('**/api/agent/v1/ask/stream', (route) =>
    route.fulfill({
      contentType: 'text/event-stream',
      body: `event: result\ndata: ${JSON.stringify({ data: ASK_RUNTIME_FIXTURE })}\n\n`,
    })
  );
  await page.goto('/dwaion/home');
  await page.getByRole('button', { name: 'Today’s work brief', exact: true }).click();
  await expect(page.getByTestId('dwaion-home').getByRole('alert')).toContainText(
    'Your question is still here'
  );
  await expect(page.getByRole('textbox', { name: 'Ask a work question' })).toHaveValue(
    'Summarize what I should handle today by priority and deadline risk.'
  );
  expect(new URL(page.url()).search).toBe('');
  fail = false;
  await page.getByRole('button', { name: 'Today’s work brief', exact: true }).click();
  await expect(page).toHaveURL(/\/dwaion\/new$/);
  expect(launches).toBe(2);
});

test('successful empty sources present empty states instead of invented recommendations', async ({
  page,
}) => {
  await homeFixture(page, { empty: true });
  await page.goto('/dwaion/home');
  await expect(page.getByText('There is no priority work right now')).toBeVisible();
  await expect(page.getByText('There are no conversations yet')).toBeVisible();
  await expect(page.getByText('No specialized agents are available')).toBeVisible();
  await expect(page.getByTestId('dwaion-signal-proposals')).toContainText('0');
});

for (const view of [
  { width: 1440, height: 1000, locale: 'ko', name: 'desktop' },
  { width: 1280, height: 900, locale: 'en', name: 'desktop-en' },
  { width: 768, height: 1024, locale: 'ko', name: 'tablet' },
  { width: 390, height: 844, locale: 'ko', name: 'mobile' },
  { width: 320, height: 740, locale: 'en', name: 'small-mobile' },
  { width: 1280, height: 900, locale: 'ko', name: 'dark', dark: true },
  { width: 640, height: 900, locale: 'en', name: 'zoom-200', largeText: true },
  { width: 390, height: 844, locale: 'ko', name: 'forced-colors', forced: true },
] as const) {
  test(`home visual and reflow ${view.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: view.width, height: view.height });
    await homeFixture(page, { locale: view.locale, dark: 'dark' in view });
    if ('forced' in view) await page.emulateMedia({ forcedColors: 'active' });
    await page.goto('/dwaion/home');
    await expect(page.getByTestId('dwaion-signal-proposals')).toContainText('2');
    if ('largeText' in view)
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '200%';
      });
    await expect(page.getByTestId('dwaion-home')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true);
    const home = page.getByTestId('dwaion-home');
    const overflow = await home
      .locator('button, a, h1, h2, h3')
      .evaluateAll((elements) =>
        elements
          .filter((element) => element.scrollWidth > element.clientWidth + 2)
          .map((element) => element.textContent)
      );
    expect(overflow).toEqual([]);
    const motionDuration = await home
      .locator('form')
      .evaluate((form) => Number.parseFloat(getComputedStyle(form).transitionDuration));
    expect(motionDuration).toBeLessThanOrEqual(0.001);
    await page.screenshot({
      path: testInfo.outputPath(`dwaion-home-${view.name}.png`),
      fullPage: true,
      animations: 'disabled',
    });
  });
}
