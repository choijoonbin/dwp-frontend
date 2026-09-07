import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';
import en from '../libs/shared-i18n/src/locales/en/meetings.json' with { type: 'json' };
import {
  MEETING_VISUAL_ID,
  MEETING_VISUAL_CAPABILITIES,
  MEETING_VISUAL_NOW,
  MEETING_VISUAL_SUMMARY,
  mockMeetingVisualHome,
  mockMeetingVisualHomeReports,
  mockMeetingVisualSession,
} from './support/video-meeting-visual-fixtures';

const templateId = '89000000-0000-4000-8000-000000000001';
const response = (route: Route, data: unknown) =>
  route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', data }),
  });
async function home(page: Page, mobile: boolean) {
  await page.setViewportSize({ width: mobile ? 390 : 1440, height: mobile ? 844 : 960 });
  await mockMeetingVisualSession(page, { locale: 'en' });
  await mockMeetingVisualHome(page, 'SAMPLE');
  await mockMeetingVisualHomeReports(page);
  await page.addInitScript(() => {
    let calls = 0;
    Object.defineProperty(window, '__homeResourceMediaCalls', { get: () => calls });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        enumerateDevices: async () => [],
        getSupportedConstraints: () => ({}),
        getUserMedia: async () => {
          calls += 1;
          throw new DOMException('No automatic capture allowed', 'NotAllowedError');
        },
      },
    });
  });
  const mutations: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/meetings/') && request.method() !== 'GET')
      mutations.push(request.method() + ' ' + new URL(request.url()).pathname);
  });
  return mutations;
}
async function resources(page: Page) {
  const region = page.getByTestId('meeting-home-resources');
  await expect(region.getByRole('button', { name: /Weekly team meeting/ })).toBeVisible();
  return region;
}

test('home resources navigate to current workspaces and preserve the 1440/390 composition', async ({
  page,
  isMobile,
}, testInfo) => {
  const mutations = await home(page, isMobile);
  await page.route('**/api/meetings/v1/templates/' + templateId, (route) =>
    response(route, {
      templateId,
      scope: 'ORGANIZATION',
      name: 'Weekly team meeting',
      purpose: 'Use the confirmed agenda.',
      category: 'GENERAL',
      durationMinutes: 50,
      agendaItems: [],
      favorite: true,
      canEdit: false,
      version: 2,
      updatedAt: '2026-08-31T04:20:00Z',
    })
  );
  await page.route('**/api/meetings/v1/personal-room', (route) => response(route, null));
  await page.route('**/api/meetings/v1/preferences', (route) =>
    response(route, {
      displayName: 'Mina Kim',
      microphoneOff: true,
      cameraOff: true,
      prejoinEnabled: true,
      reminderEnabled: true,
      reminderMinutes: 10,
      recapNotifications: true,
      version: 0,
      updatedAt: null,
    })
  );
  await page.goto('/meetings/home');
  const region = await resources(page);
  await expect(region.getByRole('listitem')).toHaveCount(3);
  const resourceHeights = await region
    .locator('li button')
    .evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().height));
  expect(Math.max(...resourceHeights) - Math.min(...resourceHeights)).toBeLessThanOrEqual(1);
  if (isMobile) {
    const actions = page.getByTestId('meeting-home-actions');
    const boxes = await Promise.all(
      ['Schedule meeting', 'Start now', 'Enter code'].map(async (name) => {
        const button = actions.getByRole('button', { name, exact: true });
        await expect(button).toBeVisible();
        const bounds = await button.boundingBox();
        expect(bounds!.width).toBeGreaterThanOrEqual(44);
        expect(bounds!.height).toBeGreaterThanOrEqual(44);
        return bounds!;
      })
    );
    expect(
      Math.max(...boxes.map((box) => box.y)) - Math.min(...boxes.map((box) => box.y))
    ).toBeLessThanOrEqual(1);
    expect(boxes[0].x + boxes[0].width).toBeLessThanOrEqual(boxes[1].x);
    expect(boxes[1].x + boxes[1].width).toBeLessThanOrEqual(boxes[2].x);
    const rows = page.getByTestId('meeting-home-timeline-row');
    await expect(rows).toHaveCount(3);
    for (const row of await rows.all()) {
      const content = await row.getByTestId('meeting-home-timeline-content').boundingBox();
      const action = await row.getByTestId('meeting-home-timeline-action').boundingBox();
      expect(content!.x + content!.width).toBeLessThanOrEqual(action!.x);
      expect(Math.min(content!.y + content!.height, action!.y + action!.height)).toBeGreaterThan(
        Math.max(content!.y, action!.y)
      );
      expect(action!.height).toBeGreaterThanOrEqual(44);
    }
  }
  await expect(page.getByTestId('meeting-home-recent')).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .include('#dwp-main-content')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations
  ).toEqual([]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  ).toBeLessThanOrEqual(1);
  await testInfo.attach('home-layout-metrics', {
    contentType: 'application/json',
    body: JSON.stringify(
      await page.evaluate(() => ({
        width: innerWidth,
        contentHeight: document.documentElement.scrollHeight,
        regions: [
          'meeting-home-context',
          'meeting-home-actions',
          'meeting-command-primary',
          'meeting-home-timeline',
          'meeting-home-queue',
          'meeting-home-recent',
          'meeting-home-resources',
        ].map((id) => {
          const box = document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect();
          return { id, x: box.x, y: box.y + scrollY, width: box.width, height: box.height };
        }),
        resourceButtons: [
          ...document.querySelectorAll('[data-testid="meeting-home-resources"] li button'),
        ].map((button) => ({
          name: button.textContent,
          height: button.getBoundingClientRect().height,
        })),
      })),
      null,
      2
    ),
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: testInfo.outputPath(`home-resources-${isMobile ? 390 : 1440}.png`),
    fullPage: true,
  });
  await region.getByRole('button', { name: /Weekly team meeting/ }).click();
  await expect(page).toHaveURL(
    new RegExp(`/meetings/templates\\?scope=ORGANIZATION&template=${templateId}$`)
  );
  await expect(page.getByTestId('template-list')).toContainText('Weekly team meeting');
  expect(page.url()).not.toContain('Weekly');
  await page.goto('/meetings/home');
  await (
    await resources(page)
  )
    .getByRole('button', { name: en.personalRoom.title, exact: true })
    .click();
  await expect(page).toHaveURL(/\/meetings\/mine\?view=personal-room$/);
  await expect(
    page.getByRole('button', { name: en.personalRoom.first.create, exact: true })
  ).toBeVisible();
  await page.goto('/meetings/home');
  await (
    await resources(page)
  )
    .getByRole('button', { name: en.context.preferences, exact: true })
    .click();
  await expect(page).toHaveURL(/\/meetings\/preferences$/);
  await expect(
    page.getByRole('heading', { name: en.preferences.title, exact: true })
  ).toBeVisible();
  expect(mutations).toEqual([]);
  expect(
    await page.evaluate(
      () => (window as unknown as { __homeResourceMediaCalls: number }).__homeResourceMediaCalls
    )
  ).toBe(0);
});

test('meeting preparation is a separate context action and never a hidden join command', async ({
  page,
  isMobile,
}) => {
  const mutations = await home(page, isMobile);
  await page.route('**/api/meetings/v1/meetings/' + MEETING_VISUAL_ID, (route) =>
    response(route, {
      ...MEETING_VISUAL_SUMMARY,
      participants: [],
      artifacts: [],
      guestAccessEnabled: false,
      recordingAvailable: false,
      transcriptAvailable: false,
      aiNotesAvailable: false,
    })
  );
  await page.route('**/api/meetings/v1/meetings/' + MEETING_VISUAL_ID + '/preparation', (route) =>
    response(route, {
      meetingId: MEETING_VISUAL_ID,
      meetingVersion: 7,
      agendaVersion: 0,
      materialsVersion: 0,
      invitationRevision: 1,
      agendaItems: [],
      materials: [],
      myResponse: null,
      invitationResponses: [],
      invitationCounts: { accepted: 0, tentative: 0, declined: 0, pending: 0 },
      myPreparation: {
        agendaVersion: 0,
        version: 0,
        preparedAgendaItemIds: [],
        updatedAt: null,
      },
      canEditAgenda: false,
      canManageMaterials: false,
      canRespond: false,
      canPrepare: false,
      observedAt: '2026-08-31T04:20:00Z',
    })
  );
  await page.goto('/meetings/home');
  const focus = page.getByTestId('meeting-command-primary');
  await expect(
    focus.getByRole('button', { name: en.home.focus.prepare, exact: true })
  ).toBeVisible();
  await focus.getByRole('button', { name: en.context.openPreparation, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`view=preparation&meetingId=${MEETING_VISUAL_ID}$`));
  await expect(
    page.getByRole('heading', { name: MEETING_VISUAL_SUMMARY.title, exact: true, level: 1 })
  ).toBeVisible();
  expect(mutations).toEqual([]);
  expect(
    await page.evaluate(
      () => (window as unknown as { __homeResourceMediaCalls: number }).__homeResourceMediaCalls
    )
  ).toBe(0);
});

test('favorite lookup denial is local and never fabricates sample templates', async ({
  page,
  isMobile,
}) => {
  await home(page, isMobile);
  await page.route('**/api/meetings/v1/templates?*', (route) =>
    route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ERROR', message: 'Denied' }),
    })
  );
  await page.goto('/meetings/home');
  const region = page.getByTestId('meeting-home-resources');
  await expect(region.getByText(en.home.resources.loadError, { exact: true })).toBeVisible();
  await expect(region.getByRole('listitem')).toHaveCount(0);
  await expect(
    region.getByRole('button', { name: en.personalRoom.title, exact: true })
  ).toBeVisible();
  await expect(
    region.getByRole('button', { name: en.context.preferences, exact: true })
  ).toBeVisible();
  await expect(
    page.getByTestId('meeting-home-timeline').getByText(MEETING_VISUAL_SUMMARY.title)
  ).toBeVisible();
});

test('compact mobile home reflows long Korean titles at 320px and 200 percent text', async ({
  page,
}, testInfo) => {
  await mockMeetingVisualSession(page, { locale: 'ko' });
  await mockMeetingVisualHome(page, 'SAMPLE');
  const meeting = {
    ...MEETING_VISUAL_SUMMARY,
    title: '전사 글로벌 서비스의 안전한 출시 준비와 단계별 아키텍처 의사결정 및 담당자 확인 회의',
  };
  await page.route('**/api/meetings/v1/home*', (route) =>
    response(route, {
      serverNow: MEETING_VISUAL_NOW.toISOString(),
      timeZone: 'Asia/Seoul',
      capabilities: MEETING_VISUAL_CAPABILITIES,
      activeMeeting: null,
      nextMeeting: meeting,
      today: [meeting],
      recent: [],
      metrics: {
        meetingsToday: 1,
        meetingMinutesToday: 50,
        waitingForApproval: 0,
        qualityScore: null,
        averageJoinSeconds: null,
      },
    })
  );
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/meetings/home');
  await expect(
    page.getByTestId('meeting-command-primary').getByRole('heading', { name: meeting.title })
  ).toBeVisible();
  let textEnlarged = false;
  for (const scenario of [
    { width: 320, enlarged: false, screenshot: 'home-ko-long-320.png' },
    { width: 320, enlarged: true, screenshot: 'home-ko-text-200-320.png' },
    { width: 390, enlarged: true, screenshot: 'home-ko-text-200.png' },
  ]) {
    await page.setViewportSize({ width: scenario.width, height: 844 });
    if (scenario.enlarged && !textEnlarged) {
      await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
      textEnlarged = true;
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    ).toBeLessThanOrEqual(1);
    const navigation = page.getByTestId('meeting-mobile-navigation');
    const navigationMetrics = await navigation.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const content = element.previousElementSibling;
      const destinations = Array.from(element.querySelectorAll<HTMLElement>('a'));
      return {
        height: bounds.height,
        horizontalOverflow: element.scrollWidth - element.clientWidth,
        contentBottomPadding: content
          ? Number.parseFloat(getComputedStyle(content).paddingBottom)
          : 0,
        destinations: destinations.map((destination) => {
          const destinationBounds = destination.getBoundingClientRect();
          const label = destination.querySelector<HTMLElement>('span');
          const icon = destination.querySelector<SVGElement>('svg');
          const iconBounds = icon?.getBoundingClientRect();
          return {
            width: destinationBounds.width,
            height: destinationBounds.height,
            labelFits:
              label !== null &&
              label.scrollWidth <= label.clientWidth + 1 &&
              label.scrollHeight <= label.clientHeight + 1,
            labelLines:
              label === null
                ? Number.POSITIVE_INFINITY
                : label.getBoundingClientRect().height /
                  Number.parseFloat(getComputedStyle(label).lineHeight),
            iconFits:
              iconBounds !== undefined &&
              iconBounds.top >= destinationBounds.top - 1 &&
              iconBounds.bottom <= destinationBounds.bottom + 1,
          };
        }),
      };
    });
    expect(navigationMetrics.horizontalOverflow).toBeLessThanOrEqual(1);
    expect(navigationMetrics.contentBottomPadding).toBeGreaterThanOrEqual(
      navigationMetrics.height + 7
    );
    for (const destination of navigationMetrics.destinations) {
      expect(destination.width).toBeGreaterThanOrEqual(44);
      expect(destination.height).toBeGreaterThanOrEqual(44);
      expect(destination.labelFits).toBe(true);
      expect(destination.labelLines).toBeLessThanOrEqual(2.01);
      expect(destination.iconFits).toBe(true);
    }
    await expect
      .poll(
        () =>
          navigation.evaluate((element) => {
            const content = element.previousElementSibling;
            const contentBody = content?.firstElementChild;
            if (!(contentBody instanceof HTMLElement)) return Number.NEGATIVE_INFINITY;
            let scrollContainer: Element | null = content;
            while (scrollContainer instanceof HTMLElement) {
              const overflowY = getComputedStyle(scrollContainer).overflowY;
              if (
                /(auto|scroll|overlay)/u.test(overflowY) &&
                scrollContainer.scrollHeight > scrollContainer.clientHeight + 1
              )
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
              scrollContainer = scrollContainer.parentElement;
            }
            const documentScroller = document.scrollingElement;
            if (documentScroller) documentScroller.scrollTop = documentScroller.scrollHeight;
            return element.getBoundingClientRect().top - contentBody.getBoundingClientRect().bottom;
          }),
        {
          message: 'late home projections must settle before measuring fixed-navigation clearance',
          timeout: 10_000,
        }
      )
      .toBeGreaterThanOrEqual(7);
    await navigation.evaluate((element) => {
      let scrollContainer = element.previousElementSibling?.parentElement;
      while (scrollContainer) {
        const overflowY = getComputedStyle(scrollContainer).overflowY;
        if (
          /(auto|scroll|overlay)/u.test(overflowY) &&
          scrollContainer.scrollHeight > scrollContainer.clientHeight + 1
        ) {
          scrollContainer.scrollTop = 0;
        }
        scrollContainer = scrollContainer.parentElement;
      }
      const documentScroller = document.scrollingElement;
      if (documentScroller) documentScroller.scrollTop = 0;
    });
    const actions = await page
      .getByTestId('meeting-home-actions')
      .getByRole('button')
      .evaluateAll((buttons) =>
        buttons.map((button) => {
          const r = button.getBoundingClientRect();
          return {
            left: r.left,
            right: r.right,
            top: r.top,
            bottom: r.bottom,
            height: r.height,
            width: r.width,
          };
        })
      );
    expect(actions).toHaveLength(3);
    for (const [index, box] of actions.entries()) {
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(scenario.width);
      for (const other of actions.slice(index + 1))
        expect(
          box.right <= other.left ||
            other.right <= box.left ||
            box.bottom <= other.top ||
            other.bottom <= box.top
        ).toBe(true);
    }
    expect(
      (
        await new AxeBuilder({ page })
          .include('#dwp-main-content')
          .include('[data-testid="meeting-mobile-navigation"]')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations
    ).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(scenario.screenshot),
      fullPage: true,
    });
  }
});
