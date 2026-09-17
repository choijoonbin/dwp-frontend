import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { ASK_RUNTIME_FIXTURE } from './support/runtime-access';
import { createHomeOverviewFixture, fulfillSuccess } from './support/shell-session';
import {
  mockWorkHubFoundation,
  personalTaskRoute,
  WORK_HUB_FIXTURE as foundationFixture,
} from './support/work-hub-foundation-fixtures';
import type { Page, TestInfo } from '@playwright/test';
import type { WorkSourceReference } from '@dwp-frontend/shared-utils/api/personal-work-contracts';

/** Fictional API receipts exercise the actual components; no fixture text enters production. */
const fixture = {
  ...foundationFixture,
  personalTitle: '분기 고객 안내 초안 정리',
  approvalTitle: '고객 지원 장비 구매 승인 · 1,850,000원',
  serviceTitle: '원격접속(VPN) 신청의 사용 사유 보완 요청',
};
const destinations = [
  ['queue', '통합업무함'],
  ['action-required', '내 조치 대기'],
  ['day-plan', '오늘 계획'],
  ['in-progress', '진행 중'],
  ['awaiting-response', '응답 대기'],
  ['completed', '완료된 업무'],
] as const;
const draftAnswer =
  '고객 지원을 위한 원격접속이 필요합니다. 접속 대상은 고객 지원 시스템이며 업무 기간과 접근 범위를 필수 항목에서 확인한 뒤 보완 내용을 제출해 주세요.';
const serviceRoute = `/work/queue?work=${encodeURIComponent(`SERVICE_REQUEST:${fixture.serviceId}:`)}`;

async function mockDesignJourneys(
  page: Page,
  appearance: { mode?: 'light' | 'dark'; highContrast?: boolean } = {}
) {
  const runtime = await mockWorkHubFoundation(page, {
    locale: 'ko',
    designDetails: true,
    nativeWorkspace: true,
    ...appearance,
  });
  const aiQueries: Array<Record<string, unknown>> = [];
  const calendarCommands: Array<Record<string, unknown>> = [];
  let selected: WorkSourceReference[] = [
    { sourceSystem: 'PERSONAL_TASK', sourceReference: fixture.personalId },
    {
      sourceSystem: 'APPROVAL_TASK',
      sourceReference: fixture.approvalId,
      obligationKey: 'SECURITY_REVIEW',
    },
  ];
  let version = 0;
  await page.route('**/api/platform/v1/workspace/work-hub/day-plans/**', async (route) => {
    if (route.request().method() === 'PUT') {
      selected = route.request().postDataJSON().items;
      version += 1;
    }
    return fulfillSuccess(route, {
      date: new URL(route.request().url()).pathname.split('/').at(-1),
      version,
      items: selected.map((reference, position) => ({
        position,
        selectionReference: reference,
        source: {
          availability: 'AVAILABLE',
          reference,
          title:
            reference.sourceSystem === 'PERSONAL_TASK'
              ? fixture.personalTitle
              : fixture.approvalTitle,
          sourceRoute: '/work/queue',
          status: 'OPEN',
        },
      })),
      updatedAt: new Date().toISOString(),
    });
  });
  await page.route('**/api/platform/v1/workspace/work-hub/calendar-links?*', (route) =>
    fulfillSuccess(route, { items: [], page: 0, size: 100, totalElements: 0, hasMore: false })
  );
  await page.route('**/api/agent/v1/ask/stream', async (route) => {
    const request = route.request().postDataJSON() as {
      requestId: string;
      agentKey: string;
      conversationId?: string;
      pageContext?: { selectedWork?: unknown };
    };
    aiQueries.push(request);
    const response = {
      ...ASK_RUNTIME_FIXTURE,
      requestId: request.requestId,
      conversationId: request.conversationId ?? null,
      selectedWork: request.pageContext?.selectedWork,
      answer: draftAnswer,
      sourceCount: 1,
      agentRegistry: {
        ...ASK_RUNTIME_FIXTURE.agentRegistry,
        entryKey: request.agentKey,
      },
      citations: [
        {
          sourceId: 'src-01',
          sourceType: 'WORK_ITEM',
          title: fixture.serviceTitle,
          sourceSystem: 'DWP Workspace',
          route: serviceRoute,
          occurredAt: new Date().toISOString(),
          excerpt: '보완 요청의 접속 대상과 업무 기간 및 사용 목적을 확인해 주세요.',
        },
      ],
    };
    await route.fulfill({
      contentType: 'text/event-stream',
      body: `event: progress\ndata: {"stage":"RETRIEVING"}\n\nevent: result\ndata: ${JSON.stringify({ data: response })}\n\n`,
    });
  });
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/calendar/events')) {
      calendarCommands.push(request.postDataJSON());
    }
  });
  return { ...runtime, aiQueries, calendarCommands };
}

async function capture(page: Page, testInfo: TestInfo, name: string, preserveScroll = false) {
  await page.evaluate(async (preserveScroll) => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    if (!preserveScroll) window.scrollTo(0, 0);
    await document.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }, preserveScroll);
  const metrics = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    title: document.querySelector('h1')?.textContent,
    horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  await testInfo.attach(`${name}-layout`, {
    body: JSON.stringify(metrics, null, 2),
    contentType: 'application/json',
  });
  for (const fullPage of [false, true]) {
    const path = testInfo.outputPath(`${name}${fullPage ? '-full' : ''}.png`);
    await page.screenshot({ path, fullPage, animations: 'disabled' });
    await testInfo.attach(`${name}${fullPage ? '-full' : ''}`, { path, contentType: 'image/png' });
  }
  expect
    .soft(metrics.horizontalOverflow, `${name} must reflow without horizontal clipping`)
    .toBeLessThanOrEqual(1);
}

const variants = [
  { name: 'desktop-1440', width: 1440, height: 1000, scale: 1 },
  { name: 'desktop-1280', width: 1280, height: 900, scale: 1 },
  { name: 'mobile-390', width: 390, height: 844, scale: 1 },
  { name: 'mobile-320', width: 320, height: 740, scale: 1 },
  // 1440 physical pixels at 200% expose 720 CSS pixels: verify the same reflow boundary.
  { name: 'zoom-200-reflow', width: 720, height: 500, scale: 2 },
];

async function expectAssistActionsClearOfLauncher(page: Page) {
  const panel = page.getByTestId('work-assist-panel');
  const launcher = page.getByTestId('dwaion-launcher');
  const submit = panel.getByRole('button', { name: '선택 업무 질문하기', exact: true });
  const actions = [
    submit,
    panel.getByRole('button', { name: '답변 복사', exact: true }),
    panel.getByRole('button', { name: 'DWAI·ON 전체 화면에서 이어서 대화하기', exact: true }),
  ];
  await expect(launcher).toBeVisible();
  if ((await launcher.getAttribute('data-shell-auxiliary-placement')) === 'floating') {
    await submit.scrollIntoViewIfNeeded();
    await submit.evaluate((element) => {
      const floating = document
        .querySelector('[data-testid="dwaion-launcher"]')!
        .getBoundingClientRect();
      const button = element.getBoundingClientRect();
      window.scrollBy(0, button.top + button.height / 2 - floating.top - floating.height / 2);
    });
    await expect(panel.locator('form')).toHaveAttribute(
      'data-shell-auxiliary-avoidance-active',
      'true'
    );
  }
  const separated = async () => {
    const floating = await launcher.boundingBox();
    const controls = await Promise.all(actions.map((action) => action.boundingBox()));
    if (!floating || controls.some((control) => !control)) return false;
    return controls.every(
      (control) =>
        control!.y + control!.height <= floating.y ||
        control!.y >= floating.y + floating.height ||
        control!.x + control!.width + 12 <= floating.x ||
        control!.x >= floating.x + floating.width + 12
    );
  };
  await expect.poll(separated).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(separated).toBe(true);
}

for (const variant of variants) {
  test.describe(variant.name, () => {
    test.use({
      viewport: { width: variant.width, height: variant.height },
      deviceScaleFactor: variant.scale,
      actionTimeout: 10_000,
    });
    test('01 queue, 07 independent plan, 08 calendar, 09 source status, 11 inline AI', async ({
      page,
    }, testInfo) => {
      test.setTimeout(120_000);
      const runtime = await mockDesignJourneys(page);
      await page.goto('/work/queue');
      await expect(
        page.getByRole('heading', { level: 1, name: '통합업무함', exact: true })
      ).toBeVisible({ timeout: 20_000 });
      await expect(
        page.getByRole('button', { name: `${fixture.personalTitle} 상세 열기`, exact: true })
      ).toBeVisible();
      if (variant.width >= 1200) {
        for (const [view, label] of destinations) {
          const link = page.getByTestId('work-sidebar').getByTestId(`work-navigation-item-${view}`);
          await expect(link).toBeVisible();
          await expect(link).toContainText(label);
          await expect(link).toHaveAttribute('href', `/work/${view}`);
        }
      } else {
        const navigation = page.getByTestId('work-mobile-bottom-navigation');
        await expect(navigation).toBeVisible();
        await expect(navigation.getByRole('button')).toHaveCount(5);
        await expect(navigation.getByRole('button', { name: '프로필', exact: true })).toBeVisible();
      }
      await capture(page, testInfo, '01-unified-queue');

      await page.goto('/work/day-plan');
      const plan = page.getByTestId('work-today-plan-page');
      await expect(plan).toBeVisible();
      await expect(plan).toContainText(fixture.personalTitle);
      await expect(
        page.getByRole('heading', { level: 1, name: '오늘 계획', exact: true })
      ).toBeVisible();
      await expect(page.locator('ul[aria-label="통합 업무 목록"]')).not.toBeVisible();
      await capture(page, testInfo, '07-today-plan');

      await page.goto(personalTaskRoute());
      const scheduleTrigger = page
        .getByRole('article')
        .getByRole('button', { name: '수행 시간 잡기', exact: true });
      await scheduleTrigger.click();
      let calendar = page.getByRole('dialog', {
        name: '수행 시간 잡기 (집중시간 예약)',
        exact: true,
      });
      await expect(calendar).toBeVisible();
      await expect(calendar).toContainText('WRK-C01');
      await expect(calendar).toContainText('DWP Calendar Handoff Service');
      await expect(calendar).toContainText('(집중시간 예약)');
      await expect(calendar).toContainText('연결 대상 업무');
      await expect(calendar).toContainText(fixture.personalTitle);
      await expect(calendar).toContainText('업무와 캘린더의 독립성:');
      await expect(calendar).toContainText('캘린더 가용성 연동 전');
      await expect(calendar).toContainText('등록 대상 및 개인정보 보호');
      await expect(calendar).toContainText('업무함 원본 하이퍼링크');
      await expect(calendar).toContainText('일정 생성 및 안전한 상호 링크 준비 완료');
      await expect(calendar.getByRole('textbox', { name: '일정 제목', exact: true })).toHaveValue(
        `집중: ${fixture.personalTitle}`
      );
      await expect(
        calendar.getByRole('button', {
          name: '개인 캘린더에 집중시간 예약 (Direct)',
          exact: true,
        })
      ).toBeEnabled();
      await expect(
        calendar.getByRole('button', {
          name: '캘린더에서 이어서 작성 (Handoff)',
          exact: true,
        })
      ).toBeEnabled();
      const dialogBounds = await calendar.boundingBox();
      expect(dialogBounds?.width ?? 0).toBeLessThanOrEqual(690);
      if (variant.width < 600) expect(dialogBounds?.width).toBe(variant.width);
      else
        expect(dialogBounds?.width ?? 0).toBeGreaterThanOrEqual(Math.min(690, variant.width - 32));

      const close = calendar.getByRole('button', { name: '닫기', exact: true });
      await close.focus();
      await expect(close).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(calendar).not.toBeVisible();
      await expect(scheduleTrigger).toBeFocused();
      await scheduleTrigger.click();
      calendar = page.getByRole('dialog', {
        name: '수행 시간 잡기 (집중시간 예약)',
        exact: true,
      });
      await expect(calendar).toBeVisible();
      expect(runtime.calendarCommands).toHaveLength(0);
      await capture(page, testInfo, '08-calendar-handoff');

      await page.goto('/work/queue?panel=sources');
      const sources = page.getByRole('dialog', { name: '업무 원천 상태', exact: true });
      await expect(sources).toBeVisible();
      await expect(
        sources.getByRole('button', { name: '전체 다시 조회', exact: true })
      ).toBeEnabled();
      await capture(page, testInfo, '09-source-status');

      await page.goto(serviceRoute);
      const service = page.getByRole('article');
      await expect(service).toContainText(fixture.serviceTitle);
      await service.getByRole('button', { name: 'DWAI·ON에게 묻기', exact: true }).click();
      const assistant = page.getByTestId('work-assist-panel');
      await expect(assistant).toBeVisible();
      await assistant
        .getByRole('textbox', { name: '질문', exact: true })
        .fill('현재 보완 요청을 바탕으로 원격접속 사용 목적 응답 초안을 작성해 주세요.');
      await assistant.getByRole('button', { name: '선택 업무 질문하기', exact: true }).click();
      await expect
        .poll(() => runtime.aiQueries.length, {
          message: 'The question must reach the governed Ask stream',
        })
        .toBe(1);
      await expect(page.getByTestId('work-assist-result')).toContainText(draftAnswer);
      await expect(service).toContainText(fixture.serviceTitle);
      await expect(page).toHaveURL(serviceRoute);
      expect(runtime.aiQueries).toHaveLength(1);
      expect(runtime.aiQueries[0].sourceScopes).toEqual(['WORK_ITEM']);
      expect(runtime.forbiddenWorkspaceMutations).toEqual([]);
      expect(runtime.sourceMutations).toEqual([]);
      if (variant.width < 900)
        await assistant.evaluate((element) => element.scrollIntoView({ block: 'start' }));
      if (variant.width >= 1200) await expectAssistActionsClearOfLauncher(page);
      await capture(page, testInfo, '11-selected-work-ai-assist', variant.width < 900);
      const applyDraft = assistant.getByRole('button', {
        name: '초안을 업무 폼에 적용',
        exact: true,
      });
      await expect(applyDraft).toBeEnabled();
      await applyDraft.click();
      await expect(
        page.getByRole('textbox', { name: '담당자에게 전달할 보완 답변', exact: true })
      ).toHaveValue(draftAnswer);
      await capture(page, testInfo, '11-selected-work-ai-draft-applied', true);
      await expect(
        service.getByRole('button', { name: '원본에서 확인', exact: true })
      ).toBeVisible();
      expect(runtime.sourceMutations, 'Applying an AI draft must never submit it').toEqual([]);

      await page
        .getByRole('textbox', { name: '접속 대상 리소스 / 서버망', exact: true })
        .fill('고객 지원 시스템 전용망');
      await page
        .getByRole('textbox', { name: '업무 목적', exact: true })
        .fill('분기 고객 지원 프로젝트 수행');
      await service.getByRole('button', { name: '보완 답변 검토', exact: true }).click();
      const responsePreview = page.getByRole('dialog', {
        name: '보완 답변을 제출할까요?',
        exact: true,
      });
      await expect(responsePreview).toContainText(draftAnswer);
      await responsePreview.getByRole('button', { name: '보완 답변 제출', exact: true }).click();
      await expect(service).toContainText('보완 답변이 접수되었습니다.');
      expect(runtime.sourceMutations).toHaveLength(1);
      expect(runtime.sourceMutations[0]).toMatchObject({
        path: expect.stringContaining('/information-response'),
        body: {
          message: draftAnswer,
          values: {
            network: '고객 지원 시스템 전용망',
            purpose: '분기 고객 지원 프로젝트 수행',
          },
          version: 3,
          idempotencyKey: expect.any(String),
        },
      });
    });
  });
}

test('six destinations retain their own URL and the mobile drawer reaches every Work state', async ({
  page,
}) => {
  await mockDesignJourneys(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/work/queue');
  for (const [view, label] of destinations) {
    await page.getByTestId('work-sidebar').getByTestId(`work-navigation-item-${view}`).click();
    await expect(page).toHaveURL(`/work/${view}`);
    await expect(page.getByRole('heading', { level: 1, name: label, exact: true })).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [view, label] of destinations.slice(3)) {
    await page.getByTestId('work-mobile-navigation-trigger').click();
    const drawer = page.getByTestId('work-mobile-sidebar');
    await expect(drawer).toBeVisible();
    await drawer.getByTestId(`work-navigation-item-${view}`).click();
    await expect(page).toHaveURL(`/work/${view}`);
    await expect(page.getByRole('heading', { level: 1, name: label, exact: true })).toBeVisible();
  }
});

test('CSS page zoom at 200 percent preserves the selected source and drawer navigation', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await mockDesignJourneys(page);
  await page.goto(personalTaskRoute());
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  await expect(page.getByTestId('work-sidebar')).not.toBeVisible();
  await expect(page.getByTestId('work-mobile-navigation-trigger')).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByRole('article').getByRole('heading', { name: fixture.personalTitle, exact: true })
  ).toBeVisible();
  const start = page.getByRole('article').getByRole('button', { name: '진행 중', exact: true });
  await expect(start).toBeEnabled();
  await start.scrollIntoViewIfNeeded();
  await expect(start).toBeInViewport();
  await capture(page, testInfo, '05-personal-task-css-zoom-200', true);
  await page.getByTestId('work-mobile-navigation-trigger').click();
  const drawer = page.getByTestId('work-mobile-sidebar');
  await expect(drawer).toBeVisible();
  await expect(drawer.getByTestId('work-navigation-item-completed')).toBeVisible();
});

test('10 Flow receives personal Work and today-plan contributions with canonical return links', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const runtime = await mockDesignJourneys(page);
  await page.route('**/api/platform/v1/home-experience', (route) =>
    fulfillSuccess(route, {
      headline: null,
      subheadline: null,
      localizedContent: {},
      defaultLocale: 'ko',
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
    const generatedAt = new Date().toISOString();
    return fulfillSuccess(route, {
      ...overview,
      generatedAt,
      work: {
        ...overview.work,
        generatedAt,
        data: { ...overview.work.data, generatedAt, items: [] },
      },
    });
  });
  await page.goto('/');
  const home = page.getByTestId('flow-home');
  await expect(home).toBeVisible({ timeout: 20_000 });
  const personalLink = home.locator(`a[href="${personalTaskRoute()}"]`);
  await expect(personalLink).toBeVisible();
  await expect(personalLink).toContainText(fixture.personalTitle);
  const planLink = home.locator('a[href="/work/day-plan"]');
  await expect(planLink).toBeVisible();
  await expect(planLink).toContainText('오늘 계획');
  const serviceLink = home.locator(`a[href="${serviceRoute}"]`);
  await expect(serviceLink).toHaveCount(1);
  await expect(serviceLink).toContainText(fixture.serviceTitle);
  await capture(page, testInfo, '10-flow-work-contribution');
  await personalLink.click();
  await expect(page).toHaveURL(personalTaskRoute());
  await expect(
    page.getByRole('article').getByRole('heading', { name: fixture.personalTitle, exact: true })
  ).toBeVisible();
  await page.goBack();
  await home.locator('a[href="/work/day-plan"]').click();
  await expect(page).toHaveURL('/work/day-plan');
  await expect(page.getByTestId('work-today-plan-page')).toContainText(fixture.personalTitle);
  await page.goBack();
  await home.locator(`a[href="${serviceRoute}"]`).click();
  await expect(page).toHaveURL(serviceRoute);
  const response = page.getByRole('article');
  await expect(response).toContainText(fixture.serviceTitle);
  await expect(response.getByRole('button', { name: '원본에서 확인', exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '요청된 정보를 보완해 주세요', exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: '담당자에게 전달할 보완 답변', exact: true })
  ).toBeVisible();
  expect(runtime.sourceMutations).toHaveLength(0);
  await capture(page, testInfo, '10-service-response-entry');
});

for (const appearance of [
  { name: 'dark', mode: 'dark' as const, highContrast: false },
  { name: 'high-contrast', mode: 'light' as const, highContrast: true },
]) {
  test(`${appearance.name} mobile navigation and keyboard drawer return`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockDesignJourneys(page, appearance);
    if (appearance.highContrast)
      await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
    await page.goto('/work/queue');
    const navigation = page.getByTestId('work-mobile-bottom-navigation');
    await expect(
      page.getByRole('heading', { level: 1, name: '통합업무함', exact: true })
    ).toBeVisible();
    await expect(navigation.getByRole('button', { name: '업무함', exact: true })).toHaveAttribute(
      'aria-current',
      'page'
    );
    const trigger = page.getByTestId('work-mobile-navigation-trigger');
    await trigger.focus();
    await page.keyboard.press('Enter');
    const drawer = page.getByTestId('work-mobile-sidebar');
    await expect(drawer).toBeVisible();
    await drawer.getByTestId('work-navigation-item-in-progress').focus();
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await capture(page, testInfo, `01-queue-${appearance.name}`);
    const results = await new AxeBuilder({ page })
      .include('#dwp-main-content')
      .include('[data-testid="work-mobile-bottom-navigation"]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    await testInfo.attach('accessibility-results', {
      body: JSON.stringify(results.violations, null, 2),
      contentType: 'application/json',
    });
    expect(
      results.violations.filter((violation) =>
        ['serious', 'critical'].includes(violation.impact ?? '')
      )
    ).toEqual([]);

    await page.goto(personalTaskRoute());
    await page
      .getByRole('article')
      .getByRole('button', { name: '수행 시간 잡기', exact: true })
      .click();
    const scheduleDialog = page.getByRole('dialog', {
      name: '수행 시간 잡기 (집중시간 예약)',
      exact: true,
    });
    await expect(scheduleDialog).toBeVisible();
    await expect(scheduleDialog).toContainText('WRK-C01');
    await expect(
      scheduleDialog.getByRole('button', {
        name: '개인 캘린더에 집중시간 예약 (Direct)',
        exact: true,
      })
    ).toBeEnabled();
    await capture(page, testInfo, `08-calendar-handoff-${appearance.name}`);
    const scheduleResults = await new AxeBuilder({ page })
      .include('[data-testid="work-schedule-dialog"]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    await testInfo.attach(`calendar-accessibility-results-${appearance.name}`, {
      body: JSON.stringify(scheduleResults.violations, null, 2),
      contentType: 'application/json',
    });
    expect(
      scheduleResults.violations.filter((violation) =>
        ['serious', 'critical'].includes(violation.impact ?? '')
      )
    ).toEqual([]);
  });
}
