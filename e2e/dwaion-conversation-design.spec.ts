import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import type { DwaionConversationSummary } from '@dwp-frontend/shared-utils';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';
import { ASK_RUNTIME_FIXTURE, WORKSPACE_QUEUE_FIXTURE } from './support/runtime-access';

const summaries: DwaionConversationSummary[] = [
  ['brief', '오늘 가장 먼저 확인해야 할 업무는 무엇인가요?', '2026-09-04T08:00:00Z', 6],
  [
    'meeting',
    'Prepare a customer meeting and review the delivery risks',
    '2026-09-03T07:45:00Z',
    4,
  ],
  ['policy', '원격 근무 정책과 승인 절차를 확인해 주세요', '2026-09-03T00:15:00Z', 2],
].map(([conversationId, title, lastMessageAt, messageCount]) => ({
  conversationId,
  title,
  lastMessageAt,
  messageCount,
  agentKey: 'DWP_ASSISTANT',
  sourceSystems:
    conversationId === 'brief'
      ? ['Microsoft Outlook', 'Google Calendar']
      : conversationId === 'meeting'
        ? ['Confluence', 'Jira']
        : ['SAP ERP'],
  evidenceCount: conversationId === 'brief' ? 2 : conversationId === 'meeting' ? 3 : 0,
  summaryExcerpt:
    conversationId === 'brief'
      ? '오늘 처리해야 할 업무와 일정을 확인했습니다.'
      : conversationId === 'meeting'
        ? '릴리스 전 보안 감사 항목과 고객 전달 위험을 검토했습니다.'
        : '원격 근무 정책과 승인 근거를 확인했습니다.',
  lastAnswerStatus: conversationId === 'policy' ? 'COMPLETED' : 'ANSWER_GROUNDED',
  retentionUntil: conversationId === 'policy' ? null : '2026-12-03T09:00:00Z',
  legalHold: conversationId === 'policy',
  locale: 'ko',
  createdAt: lastMessageAt,
  updatedAt: lastMessageAt,
}));

const visualExtras: DwaionConversationSummary[] = [
  {
    conversationId: 'security',
    title: 'SSO 연동 규격 및 금융보안원 PII 마스킹 기준 질의',
    lastMessageAt: '2026-09-02T05:20:00Z',
    messageCount: 2,
    agentKey: 'DWP_ASSISTANT',
    sourceSystems: ['금융보안원 가이드 2026'],
    evidenceCount: 1,
    summaryExcerpt: 'SAML 2.0 및 OIDC 환경의 개인정보 마스킹 기준을 확인했습니다.',
    lastAnswerStatus: 'ANSWER_GROUNDED_FALLBACK',
    retentionUntil: '2026-12-01T05:20:00Z',
    legalHold: false,
    locale: 'ko',
    createdAt: '2026-09-02T05:20:00Z',
    updatedAt: '2026-09-02T05:20:00Z',
  },
  {
    conversationId: 'weekly-report',
    title: '금요일 팀 주간 업무 보고 초안 정리',
    lastMessageAt: '2026-08-31T08:30:00Z',
    messageCount: 5,
    agentKey: 'DWP_ASSISTANT',
    sourceSystems: ['Work item'],
    evidenceCount: 0,
    summaryExcerpt: '각 파트별 진행 항목과 다음 주 위험 요소를 정리했습니다.',
    lastAnswerStatus: 'COMPLETED',
    retentionUntil: '2026-11-29T08:30:00Z',
    legalHold: false,
    locale: 'ko',
    createdAt: '2026-08-31T08:30:00Z',
    updatedAt: '2026-08-31T08:30:00Z',
  },
];

const workplaceActions = [
  {
    actionKey: 'APPROVAL.REQUEST.CREATE',
    title: '결재 요청 초안',
    description: '검토 가능한 결재 요청 초안을 준비합니다.',
    mode: 'APPROVAL_HANDOFF',
    riskTier: 'L2',
    requiredPermission: 'APP.APPROVALS:CREATE',
    targetRoute: '/approvals/home',
    confirmationRequired: true,
    inputFields: [],
  },
  {
    actionKey: 'CALENDAR.EVENT.CREATE',
    title: '일정 초안',
    description: '사용자 확인 전까지 저장하지 않는 일정 초안을 준비합니다.',
    mode: 'REDIRECT',
    riskTier: 'L0',
    requiredPermission: 'APP.CALENDAR:CREATE',
    targetRoute: '/calendar',
    confirmationRequired: true,
    inputFields: [],
  },
  {
    actionKey: 'MAIL.DRAFT.CREATE',
    title: '메일 초안',
    description: '사용자 확인 전까지 발송하지 않는 메일 초안을 준비합니다.',
    mode: 'REDIRECT',
    riskTier: 'L1',
    requiredPermission: 'APP.MAIL:CREATE',
    targetRoute: '/mail',
    confirmationRequired: true,
    inputFields: [],
  },
] as const;

async function fixture(
  page: Page,
  {
    locale = 'en',
    dark = false,
    empty = false,
    visual = false,
  }: { locale?: 'ko' | 'en'; dark?: boolean; empty?: boolean; visual?: boolean } = {}
) {
  await page.clock.setFixedTime(new Date('2026-09-04T09:00:00Z'));
  await page.emulateMedia({
    reducedMotion: 'reduce',
    colorScheme: dark ? 'dark' : 'light',
  });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale,
    displayName: locale === 'ko' ? '최준빈' : 'Mina Kim',
    permissions: FULL_PRODUCT_PERMISSIONS,
    appearance: {
      mode: dark ? 'dark' : 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
  await page.route('**/api/platform/v1/observability/web-vitals', (route) =>
    route.fulfill({ status: 202, body: '' })
  );
  const referenceAlignedSummaries = summaries.map((item) =>
    item.conversationId === 'brief'
      ? {
          ...item,
          title: '내일 고객 온보딩 개선 회의 준비 브리핑',
          sourceSystems: ['Confluence', '사내 메일'],
        }
      : item.conversationId === 'meeting'
        ? {
            ...item,
            title: 'Q3 제품 릴리즈 인프라 보안 감사 사규 검토',
            agentKey: 'DWP_APPROVAL_EXPERT',
            sourceSystems: ['사규집', 'Jira'],
          }
        : {
            ...item,
            title: '법인 결산 전표 이상 감지 및 회계 감사 대응',
          }
  );
  const visualItems =
    (page.viewportSize()?.width ?? 0) < 900
      ? [...referenceAlignedSummaries, ...visualExtras.slice(0, 1)]
      : [...referenceAlignedSummaries, ...visualExtras];
  let items = empty ? [] : visual ? visualItems : [...summaries];
  let deletes = 0;
  let held = false;
  await page.route('**/api/agent/v1/conversations', (route) =>
    route.fulfill({ json: { success: true, data: items } })
  );
  await page.route('**/api/agent/v1/conversations/*', async (route) => {
    const id = new URL(route.request().url()).pathname.split('/').at(-1);
    if (route.request().method() === 'DELETE') {
      deletes += 1;
      if (held)
        return route.fulfill({
          status: 409,
          json: { success: false, message: 'retention hold' },
        });
      items = items.filter((item) => item.conversationId !== id);
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({
      json: {
        success: true,
        data: {
          summary:
            [...summaries, ...visualExtras].find((item) => item.conversationId === id) ??
            summaries[0],
          messages: [
            {
              messageId: 'saved-question',
              role: 'USER',
              content: 'Previously saved work question',
              runId: null,
              statusCode: null,
              citations: [],
              createdAt: '2026-09-04T08:00:00Z',
            },
          ],
        },
      },
    });
  });
  await page.route('**/api/platform/v1/workspace/work-items', (route) =>
    route.fulfill({ json: { success: true, data: WORKSPACE_QUEUE_FIXTURE } })
  );
  await page.route('**/api/agent/v1/actions', (route) =>
    route.fulfill({ json: { success: true, data: [] } })
  );
  return {
    deleteCount: () => deletes,
    hold: () => {
      held = true;
    },
  };
}

test('studio scope controls match the actual request, including at mobile width', async ({
  page,
}) => {
  await fixture(page);
  let request: { query?: string; sourceScopes?: string[] } = {};
  await page.route('**/api/agent/v1/ask/stream', (route) => {
    request = route.request().postDataJSON();
    return route.fulfill({
      contentType: 'text/event-stream',
      body: `event: result\ndata: ${JSON.stringify({ data: ASK_RUNTIME_FIXTURE })}\n\n`,
    });
  });
  await page.goto('/dwaion/new');
  const rail = page.getByTestId('dwaion-studio-rail');
  await expect(page.getByText('Travel expense follow-up')).toHaveCount(0);
  if ((page.viewportSize()?.width ?? 0) < 900) {
    const composer = page.getByTestId('dwaion-workspace-composer');
    await composer.getByRole('button', { name: 'Mail', exact: true }).click();
    await composer.getByRole('button', { name: 'Calendar', exact: true }).click();
    await expect(composer.getByRole('button', { name: 'Work item', exact: true })).toBeDisabled();
  } else {
    await rail.getByRole('checkbox', { name: 'Mail', exact: true }).uncheck();
    await rail.getByRole('checkbox', { name: 'Calendar', exact: true }).uncheck();
    await expect(rail.getByRole('checkbox', { name: 'Work item', exact: true })).toBeDisabled();
  }
  await expect(rail.getByText('1 selected')).toBeVisible();
  await page.getByRole('textbox', { name: 'Ask a work question' }).fill('Review my work queue');
  await page.getByRole('button', { name: 'Send question', exact: true }).click();
  await expect.poll(() => request.sourceScopes).toEqual(['WORK_ITEM']);
  expect(request.query).toBe('Review my work queue');
  expect(page.url()).not.toContain('Review');
});

test('studio does not show failed work as zero or retained data', async ({ page }) => {
  await fixture(page);
  await page.route('**/api/platform/v1/workspace/work-items', (route) =>
    route.fulfill({ status: 503, json: { success: false } })
  );
  await page.goto('/dwaion/new');
  await expect(page.getByTestId('dwaion-studio-rail').getByRole('alert')).toBeVisible();
  await expect(page.getByText('Approve software access')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Ask a work question' })).toBeVisible();
});

test('studio opens the governed approval expert through an explicit workspace route', async ({
  page,
}) => {
  await fixture(page);
  await page.goto('/dwaion/new');
  await page.getByRole('button', { name: 'Switch to Approval Expert', exact: true }).click();
  await expect(page).toHaveURL('/dwaion/new?agent=DWP_APPROVAL_EXPERT');
  await expect(page.getByText('Review your approval flow with confidence')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Switch to Approval Expert' })).toHaveCount(0);
});

for (const view of [
  { width: 1440, name: '1440' },
  { width: 390, name: '390' },
  { width: 320, name: '320' },
  { width: 1280, name: '1280-dark', dark: true },
  { width: 390, name: '390-forced', forced: true },
  { width: 640, name: '640-text200', zoom: true },
] as const) {
  test(`answer ${view.name} announces once and exposes the verified source with accessible controls`, async ({
    page,
  }, testInfo) => {
    const { width } = view;
    const height = width >= 900 ? 1000 : 844;
    await page.setViewportSize({ width, height });
    await fixture(page, { dark: 'dark' in view });
    if ('forced' in view) await page.emulateMedia({ forcedColors: 'active' });
    await page.route('**/api/agent/v1/ask/stream', (route) => {
      const request = route.request().postDataJSON() as { requestId: string };
      return route.fulfill({
        contentType: 'text/event-stream',
        body: `event: result\ndata: ${JSON.stringify({
          data: {
            ...ASK_RUNTIME_FIXTURE,
            requestId: request.requestId,
            citations: ASK_RUNTIME_FIXTURE.citations.map((citation, index) => ({
              ...citation,
              route: index === 0 ? '/calendar' : null,
            })),
          },
        })}\n\n`,
      });
    });
    await page.route('**/api/agent/v1/actions', (route) =>
      route.fulfill({
        json: {
          status: 'SUCCESS',
          message: 'OK',
          data: workplaceActions,
        },
      })
    );

    await page.goto('/dwaion/new');
    if ('zoom' in view) {
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '200%';
      });
      await expect
        .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).fontSize))
        .toBe('32px');
    }
    await page.getByRole('textbox', { name: 'Ask a work question' }).fill('Review my schedule');
    await page.getByRole('button', { name: 'Send question', exact: true }).click();
    await expect(page.getByTestId('dwaion-workspace-answer')).toContainText(
      ASK_RUNTIME_FIXTURE.answer
    );

    const announcement = page.getByTestId('dwaion-answer-announcement');
    await expect(announcement).toContainText(ASK_RUNTIME_FIXTURE.answer);
    await expect(
      page.locator('[aria-live="polite"]').filter({ hasText: ASK_RUNTIME_FIXTURE.answer })
    ).toHaveCount(1);

    const result = page.getByTestId('dwaion-workspace-result');
    const undersizedResultActions = await result.locator('button').evaluateAll((buttons) =>
      buttons
        .filter((button) => {
          const bounds = button.getBoundingClientRect();
          return bounds.width > 0 && bounds.height > 0 && (bounds.width < 44 || bounds.height < 44);
        })
        .map((button) => button.getAttribute('aria-label') || button.textContent?.trim())
    );
    expect(undersizedResultActions).toEqual([]);
    expect(
      (
        await new AxeBuilder({ page })
          .include('[data-testid="dwaion-workspace-result"]')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations
    ).toEqual([]);

    await expect(page.locator('vite-error-overlay')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
    if ('zoom' in view) {
      const skipLink = page.getByRole('link', { name: 'Skip to main content', exact: true });
      await page
        .getByRole('button', { name: 'New question', exact: true })
        .evaluate((button) => button.focus({ preventScroll: true }));
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
      await expect(skipLink).not.toBeFocused();
      expect(await skipLink.evaluate((link) => link.matches(':focus-visible'))).toBe(false);
      await expect
        .poll(() => skipLink.evaluate((link) => link.getBoundingClientRect().bottom))
        .toBeLessThanOrEqual(0);
      await page.screenshot({
        path: testInfo.outputPath(`U03-answer-${view.name}-viewport.png`),
        animations: 'disabled',
      });
    }
    await page.screenshot({
      path: testInfo.outputPath(`U03-answer-${view.name}.png`),
      fullPage: true,
      animations: 'disabled',
    });
    if (width >= 900) {
      const evidence = page
        .getByRole('complementary')
        .filter({ has: page.getByRole('heading', { name: 'Verification panel', exact: true }) });
      await expect(evidence.getByText('Flexible work guidance')).toBeVisible();
      await expect(evidence.getByRole('button', { name: /Open source/ })).toHaveCount(1);
      await evidence.getByRole('button', { name: /Open source/ }).click();
      const preview = page.getByRole('dialog', {
        name: ASK_RUNTIME_FIXTURE.citations[0].title,
        exact: true,
      });
      await expect(preview).toBeVisible();
      await expect(preview).toContainText(ASK_RUNTIME_FIXTURE.citations[0].sourceSystem);
      await expect(
        preview.getByRole('button', { name: 'Open in source', exact: true })
      ).toBeEnabled();
      await page.screenshot({
        path: testInfo.outputPath(`U03-source-preview-${view.name}.png`),
        animations: 'disabled',
      });
      await page.keyboard.press('Escape');
      await expect(preview).toBeHidden();
      return;
    }
    const evidence = page
      .getByRole('complementary')
      .filter({ has: page.getByRole('heading', { name: 'Verification panel', exact: true }) });
    await expect(evidence).toBeVisible();
    await expect(evidence.getByText('Flexible work guidance')).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Verification panel' })).toHaveCount(0);
    const sourceAction = evidence.getByRole('button', {
      name: /Open source/,
    });
    const sourceActionBounds = await sourceAction.boundingBox();
    expect(sourceActionBounds?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(sourceActionBounds?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
    expect(
      (
        await new AxeBuilder({ page })
          .include('[data-testid="dwaion-workspace-result"]')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations
    ).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`U03-evidence-inline-${view.name}.png`),
      animations: 'disabled',
    });
    await sourceAction.click();
    const sourcePreview = page.getByRole('dialog', {
      name: ASK_RUNTIME_FIXTURE.citations[0].title,
      exact: true,
    });
    await expect(sourcePreview).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sourcePreview).toBeHidden();
  });
}

for (const view of [
  { width: 1440, height: 1000, name: '1440-ko' },
  { width: 390, height: 844, name: '390-ko' },
] as const) {
  test(`answer Stitch-size visual ${view.name} keeps Korean evidence inline`, async ({
    page,
  }, testInfo) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') {
        const location = message.location().url;
        consoleErrors.push(`${message.text()}${location ? ` @ ${location}` : ''}`);
      }
    });
    await page.setViewportSize({ width: view.width, height: view.height });
    await fixture(page, { locale: 'ko' });
    const answer =
      '내일 고객 온보딩 회의 전에 확인할 규정과 미결 업무를 정리했습니다.\n\n1. 확인된 일정과 범위\n9월 28일 일정과 사내 보안 감사 선행 조건을 확인했습니다.\n\n2. 추가 확인이 필요한 항목\n외부 감사 대응 전 보존 기한 충돌 여부를 담당자에게 확인해야 합니다.';
    const citations = ASK_RUNTIME_FIXTURE.citations.map((citation, index) => ({
      ...citation,
      title: index === 0 ? '온보딩 보안 규정' : '고객 지원팀 협의 메일',
      excerpt:
        index === 0
          ? '외부 고객 연동 시스템 배포 전 보안 감사 승인이 필요합니다.'
          : '지원 범위와 후속 확인 일정을 협의한 메일입니다.',
      route: index === 0 ? '/calendar' : null,
    }));
    await page.route('**/api/agent/v1/ask/stream', (route) => {
      const request = route.request().postDataJSON() as { requestId: string };
      return route.fulfill({
        contentType: 'text/event-stream',
        body: `event: result\ndata: ${JSON.stringify({
          data: {
            ...ASK_RUNTIME_FIXTURE,
            requestId: request.requestId,
            conversationId: 'brief',
            userMessageId: 'saved-question',
            assistantMessageId: 'a-brief-latest',
            answer,
            citations,
          },
        })}\n\n`,
      });
    });
    await page.route('**/api/agent/v1/actions', (route) =>
      route.fulfill({
        json: { status: 'SUCCESS', message: 'OK', data: workplaceActions },
      })
    );

    await page.goto('/dwaion/new');
    const composer = page.getByTestId('dwaion-workspace-composer');
    await composer.getByRole('textbox').fill('내일 회의 전에 확인할 규정과 업무를 정리해 주세요.');
    await composer.locator('button[type="submit"]').click();
    await expect(page.getByTestId('dwaion-workspace-answer')).toContainText('확인된 일정과 범위');
    await expect(page.getByText('온보딩 보안 규정', { exact: false }).first()).toBeVisible();
    await expect(page.locator('vite-error-overlay')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
    if (view.width < 900) {
      await expect(page.getByTestId('dwaion-mobile-surface-switcher')).toHaveCount(0);
      await expect(page.getByTestId('dwaion-mobile-navigation')).toHaveCount(0);
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    expect(consoleErrors).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`U03-answer-${view.name}.png`),
      fullPage: true,
      animations: 'disabled',
    });
  });
}

test('archive supports private loaded-record search, time filtering, sorting and continuation', async ({
  page,
}) => {
  await fixture(page);
  await page.goto('/dwaion/conversations');
  const archive = page.getByTestId('dwaion-archive');
  await expect(archive.getByTestId('dwaion-archive-row')).toHaveCount(3);
  await page.keyboard.press('Control+f');
  await expect(archive.getByRole('textbox', { name: 'Search conversations' })).toBeFocused();
  await archive.getByRole('tab', { name: 'Past 7 days' }).click();
  await expect(archive.getByTestId('dwaion-archive-row')).toHaveCount(3);
  await archive.getByRole('textbox', { name: 'Search conversations' }).fill('customer');
  await expect(archive.getByTestId('dwaion-archive-row')).toHaveCount(1);
  expect(page.url()).not.toContain('customer');
  await archive.getByRole('textbox', { name: 'Search conversations' }).press('Escape');
  await archive.getByRole('tab', { name: 'All', exact: true }).click();
  await archive.getByRole('combobox', { name: 'Sort conversations' }).click();
  await page.getByRole('option', { name: 'Oldest first' }).click();
  await expect(archive.getByTestId('dwaion-archive-row').first()).toContainText('원격 근무');
  await archive.getByRole('link', { name: /Prepare a customer meeting/ }).click();
  await expect(page).toHaveURL(/\/dwaion\/conversations\/meeting$/);
  await expect(page.getByText('Previously saved work question')).toBeVisible();
});

test('archive deletion requires confirmation and updates cache', async ({ page }) => {
  const state = await fixture(page);
  await page.goto('/dwaion/conversations');
  await page.getByTestId('dwaion-archive-row').first().getByRole('button').click();
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  expect(state.deleteCount()).toBe(0);
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();
  expect(state.deleteCount()).toBe(0);
  await page.getByTestId('dwaion-archive-row').first().getByRole('button').click();
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByTestId('dwaion-archive-row')).toHaveCount(2);
  expect(state.deleteCount()).toBe(1);
});

test('archive legal hold remains visible and never implies a successful deletion', async ({
  page,
}) => {
  const state = await fixture(page);
  state.hold();
  await page.goto('/dwaion/conversations');
  await page.getByTestId('dwaion-archive-row').first().getByRole('button').click();
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('alertdialog').getByRole('alert')).toContainText('legal hold');
  await expect(page.getByTestId('dwaion-archive-row')).toHaveCount(3);
});

test('archive facets and search use returned evidence, source, and legal-hold fields', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page);
  await page.goto('/dwaion/conversations');
  const archive = page.getByTestId('dwaion-archive');
  await expect(archive.getByRole('tab', { name: 'Legal hold', exact: true })).toContainText('1');
  await archive.getByRole('tab', { name: 'Legal hold', exact: true }).click();
  await expect(archive.getByTestId('dwaion-archive-row')).toHaveCount(1);
  await expect(archive.getByTestId('dwaion-archive-row')).toContainText('Legal hold');
  await archive.getByRole('button', { name: /Conversation actions/ }).click();
  await expect(page.getByRole('menuitem', { name: /Deletion blocked/ })).toBeDisabled();
  await page.keyboard.press('Escape');
  await archive.getByRole('tab', { name: 'All', exact: true }).click();
  await archive.getByRole('textbox', { name: 'Search conversations' }).fill('Outlook');
  await expect(archive.getByTestId('dwaion-archive-row')).toHaveCount(1);
  await expect(archive.getByTestId('dwaion-archive-row')).toContainText('오늘 가장');
});

test('archive refresh errors hide cached titles and recover with retry', async ({ page }) => {
  await fixture(page);
  await page.goto('/dwaion/conversations');
  await expect(page.getByTestId('dwaion-archive-row')).toHaveCount(3);
  await page.route('**/api/agent/v1/conversations', (route) =>
    route.fulfill({ status: 403, json: { success: false } })
  );
  await page.getByRole('button', { name: 'Refresh conversations' }).click();
  await expect(page.getByTestId('dwaion-archive').getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('dwaion-archive-row')).toHaveCount(0);
  await expect(page.getByText('There are no conversations yet')).toHaveCount(0);
  await page.route('**/api/agent/v1/conversations', (route) =>
    route.fulfill({ json: { success: true, data: summaries } })
  );
  await page.getByTestId('dwaion-archive').getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByTestId('dwaion-archive-row')).toHaveCount(3);
});

test('conversation access failure never offers a follow-up against an unverified thread', async ({
  page,
}) => {
  await fixture(page);
  await page.route('**/api/agent/v1/conversations/brief?agentKey=DWP_ASSISTANT', (route) =>
    route.fulfill({ status: 403, json: { success: false } })
  );
  await page.goto('/dwaion/conversations/brief');
  await expect(page.getByTestId('dwaion-studio').getByRole('alert')).toContainText(
    'could not be verified'
  );
  await expect(page.getByRole('textbox', { name: 'Ask a work question' })).toHaveCount(0);
});

test('empty archive has a real new conversation action', async ({ page }) => {
  await fixture(page, { empty: true });
  await page.goto('/dwaion/conversations');
  await expect(page.getByText('There are no conversations yet')).toBeVisible();
  await page
    .getByTestId('dwaion-archive')
    .getByRole('button', { name: 'New conversation', exact: true })
    .last()
    .click();
  await expect(page).toHaveURL(/\/dwaion\/new$/);
});

for (const [width, locale, dark, scale] of [
  [2560, 'ko', false, 1],
  [1920, 'ko', false, 1],
  [1440, 'ko', false, 1],
  [1280, 'en', false, 1],
  [390, 'ko', false, 1],
  [320, 'en', false, 1],
  [640, 'en', false, 2],
  [1440, 'en', true, 1],
] as const) {
  test(`studio and archive visual reflow ${width} ${locale} ${dark ? 'dark' : 'light'} ${scale}x`, async ({
    page,
  }, testInfo) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    await page.setViewportSize({ width, height: 1000 });
    await fixture(page, { locale, dark, visual: true });
    for (const route of ['new', 'conversations']) {
      await page.goto(`/dwaion/${route}`);
      const surface = page.getByTestId(route === 'new' ? 'dwaion-studio' : 'dwaion-archive');
      await expect(surface).toBeVisible();
      if (route === 'conversations')
        await expect(page.getByTestId('dwaion-archive-row')).toHaveCount(width < 900 ? 4 : 5);
      else if (width < 900)
        await expect(
          page.getByTestId('dwaion-workspace-composer').getByRole('button', { pressed: true })
        ).toHaveCount(3);
      else
        await expect(page.getByTestId('dwaion-studio-rail').getByRole('checkbox')).toHaveCount(3);
      if (scale === 2)
        await page.addStyleTag({
          content: 'html { font-size: 200% !important; }',
        });
      const gutters = await surface.evaluate((element) => {
        const canvas = element.closest<HTMLElement>('[data-dwp-page-canvas="workspace"]');
        if (!canvas) throw new Error('DWAI·ON surface must use the shared workspace canvas.');
        const surfaceBounds = element.getBoundingClientRect();
        const canvasBounds = canvas.getBoundingClientRect();
        const canvasStyle = getComputedStyle(canvas);
        return {
          startDelta:
            surfaceBounds.left -
            (canvasBounds.left + Number.parseFloat(canvasStyle.paddingInlineStart)),
          endDelta:
            canvasBounds.right -
            Number.parseFloat(canvasStyle.paddingInlineEnd) -
            surfaceBounds.right,
        };
      });
      expect(Math.abs(gutters.startDelta)).toBeLessThanOrEqual(1.5);
      expect(Math.abs(gutters.endDelta)).toBeLessThanOrEqual(1.5);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
      ).toBe(true);
      await expect(page.locator('vite-error-overlay')).toHaveCount(0);
      expect(consoleErrors).toEqual([]);
      const violations = (
        await new AxeBuilder({ page })
          .include(
            route === 'new' ? '[data-testid="dwaion-studio"]' : '[data-testid="dwaion-archive"]'
          )
          .analyze()
      ).violations;
      expect(
        violations.filter((entry) => ['serious', 'critical'].includes(entry.impact ?? ''))
      ).toEqual([]);
      await page.screenshot({
        path: testInfo.outputPath(`${route}-${width}-${locale}-${scale}x.png`),
        fullPage: true,
        animations: 'disabled',
      });
    }
  });
}

test('forced colors keeps studio and archive actions available', async ({ page }, testInfo) => {
  await fixture(page);
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  for (const route of ['new', 'conversations']) {
    await page.goto(`/dwaion/${route}`);
    const surface = page.getByTestId(route === 'new' ? 'dwaion-studio' : 'dwaion-archive');
    if (route === 'new' && (page.viewportSize()?.width ?? 0) < 900)
      await expect(page.getByTestId('dwaion-workspace-composer')).toBeVisible();
    else
      await expect(
        surface.getByRole('button', { name: 'New conversation', exact: true }).first()
      ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`${route}-forced-colors.png`),
      fullPage: true,
    });
  }
});
