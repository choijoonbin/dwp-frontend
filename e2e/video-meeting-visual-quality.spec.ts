import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import {
  expectMinimumTarget,
  expectNoBlockingA11y,
  expectNoHorizontalOverflow,
  expectViewportInset,
  useVisualProject,
} from './support/video-meeting-visual-accessibility';
import {
  MEETING_VISUAL_ID,
  MEETING_VISUAL_SUMMARY,
  MEETING_VISUAL_RECENT_ID,
  mockMeetingVisualHome,
  mockMeetingVisualHomeReports,
  mockMeetingVisualMine,
  mockMeetingVisualPrejoin,
  mockMeetingVisualPublishedRecap,
  mockMeetingVisualSession,
} from './support/video-meeting-visual-fixtures';
import {
  expectPageReady,
  expectCleanMeetingRuntime,
  expectVisualSnapshot,
  trackMeetingRuntime,
} from './support/meeting-visual-runtime';
import { expectFocusClearance, expectKeyboardFocusVisible } from './support/meeting-visual-focus';
import { mockImplementationMeetingPreparation } from './support/meeting-implementation-regression-fixtures';
import {
  annotateJ01Source,
  expectFocusCanvasGutter,
  expectJ01JoinWorkspace,
  mockJ01ResolvedMeeting,
} from './support/meeting-j01-visual';

import type { Locator, Page } from '@playwright/test';

// Independent implementation regressions: one changed PNG must not suppress the
// remaining functional, accessibility, or state checks. These are not source approval.
test.describe.configure({ mode: 'default' });
// A failed full-document comparison must not suppress the independent viewport image.
test.setTimeout(60_000);

const VIEWPORT = {
  desktop: { width: 1_440, height: 960 },
  laptop: { width: 1_280, height: 960 },
  tablet: { width: 768, height: 1_024 },
  mobile: { width: 390, height: 844 },
  minimum: { width: 320, height: 720 },
} as const;

trackMeetingRuntime();

async function expectSharedWorkspaceGutter(page: Page, label: string, expectedPixels: number) {
  const canvas = page.locator('[data-dwp-page-canvas="workspace"]').first();
  await expect(canvas).toBeVisible();
  const layout = await canvas.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      paddingLeft: Number.parseFloat(style.paddingLeft),
      paddingRight: Number.parseFloat(style.paddingRight),
      maxWidth: style.maxWidth,
    };
  });
  expect(layout.paddingLeft, `${label}: shared left gutter`).toBe(expectedPixels);
  expect(layout.paddingRight, `${label}: shared right gutter`).toBe(expectedPixels);
  expect(layout.maxWidth, `${label}: operational canvas remains fluid`).toBe('none');
}

async function expectHomeWorkspace(page: Page, options: { desktopLayout?: boolean } = {}) {
  const context = page.getByTestId('meeting-home-context');
  const actions = page.getByTestId('meeting-home-actions');
  const primary = page.getByTestId('meeting-command-primary');
  const lists = page.getByTestId('meeting-day-lists');
  const timeline = page.getByTestId('meeting-home-timeline');
  const queue = page.getByTestId('meeting-home-queue');
  const continuation = page.getByTestId('meeting-home-continuation');
  const recent = page.getByTestId('meeting-home-recent');
  const resources = page.getByTestId('meeting-home-resources');
  await expect(context).toBeVisible();
  await expect(actions).toBeVisible();
  await expect(primary).toBeVisible();
  await expect(lists).toBeVisible();
  await expect(timeline).toBeVisible();
  await expect(queue).toBeVisible();
  await expect(continuation).toBeVisible();
  await expect(recent).toBeVisible();
  await expect(resources).toBeVisible();
  await expect(page.getByTestId('meeting-insight-strip')).toHaveCount(0);

  if (options.desktopLayout) {
    const geometry = await lists.evaluate((element) => {
      const timelineElement = element.querySelector<HTMLElement>(
        '[data-testid="meeting-home-timeline"]'
      );
      const queueElement = element.querySelector<HTMLElement>('[data-testid="meeting-home-queue"]');
      if (!timelineElement || !queueElement) return null;
      const timelineBounds = timelineElement.getBoundingClientRect();
      const queueBounds = queueElement.getBoundingClientRect();
      return {
        timelineWidth: timelineBounds.width,
        queueWidth: queueBounds.width,
        timelineTop: timelineBounds.top,
        queueTop: queueBounds.top,
      };
    });
    expect(geometry, 'today timeline and queue are measurable').not.toBeNull();
    expect(
      geometry!.timelineWidth / geometry!.queueWidth,
      'today timeline to queue ratio'
    ).toBeGreaterThan(1.7);
    expect(
      geometry!.timelineWidth / geometry!.queueWidth,
      'today timeline to queue ratio'
    ).toBeLessThan(2.3);
    expect(
      Math.abs(geometry!.timelineTop - geometry!.queueTop),
      'today and queue share one desktop row'
    ).toBeLessThanOrEqual(2);
    const primaryBounds = await primary.boundingBox();
    const listsBounds = await lists.boundingBox();
    expect(primaryBounds).not.toBeNull();
    expect(listsBounds).not.toBeNull();
    expect(Math.abs(primaryBounds!.width - listsBounds!.width)).toBeLessThanOrEqual(2);
    const continuationGeometry = await continuation.evaluate((element) => {
      const recentElement = element.querySelector<HTMLElement>(
        '[data-testid="meeting-home-recent"]'
      );
      const resourcesElement = element.querySelector<HTMLElement>(
        '[data-testid="meeting-home-resources"]'
      );
      if (!recentElement || !resourcesElement) return null;
      const recentBounds = recentElement.getBoundingClientRect();
      const resourcesBounds = resourcesElement.getBoundingClientRect();
      return {
        ratio: recentBounds.width / resourcesBounds.width,
        topDifference: Math.abs(recentBounds.top - resourcesBounds.top),
      };
    });
    expect(continuationGeometry, 'recent results and resources are measurable').not.toBeNull();
    expect(continuationGeometry!.ratio, 'recent results to resources ratio').toBeGreaterThan(1.3);
    expect(continuationGeometry!.ratio, 'recent results to resources ratio').toBeLessThan(1.55);
    expect(
      continuationGeometry!.topDifference,
      'recent results and resources share one desktop row'
    ).toBeLessThanOrEqual(2);
  }
}

async function expectMeetingMobileNavigation(page: Page, active: string) {
  const navigation = page.getByTestId('meeting-mobile-navigation');
  await expect(navigation).toBeVisible();
  const destinations = navigation.locator('a');
  await expect(destinations).toHaveCount(5);
  await expect(navigation.getByTestId(`meeting-mobile-navigation-${active}`)).toHaveAttribute(
    'aria-current',
    'page'
  );
  for (let index = 0; index < 5; index += 1) {
    const destination = destinations.nth(index);
    await expectMinimumTarget(destination, `mobile meeting destination ${index + 1}`);
    const labelFits = await destination
      .locator('span')
      .evaluate((element) => element.scrollWidth <= element.clientWidth + 1);
    expect(labelFits, `mobile meeting destination ${index + 1} label is not truncated`).toBe(true);
  }
  const placement = await navigation.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const content = element.previousElementSibling;
    return {
      position: getComputedStyle(element).position,
      bottomGap: innerHeight - bounds.bottom,
      height: bounds.height,
      contentBottomPadding: content
        ? Number.parseFloat(getComputedStyle(content).paddingBottom)
        : 0,
    };
  });
  expect(placement.position, 'mobile meeting navigation is viewport-fixed').toBe('fixed');
  expect(
    Math.abs(placement.bottomGap),
    'mobile meeting navigation sits at viewport bottom'
  ).toBeLessThanOrEqual(1);
  expect(
    placement.height,
    'mobile meeting navigation reserves a usable dock'
  ).toBeGreaterThanOrEqual(64);
  expect(
    placement.contentBottomPadding,
    'mobile meeting content reserves space above the fixed dock'
  ).toBeGreaterThanOrEqual(placement.height);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  const endClearance = await navigation.evaluate((element) => {
    const navigationBounds = element.getBoundingClientRect();
    const content = element.previousElementSibling;
    const contentBody = content?.firstElementChild;
    if (!(contentBody instanceof HTMLElement)) return null;
    return {
      contentBottom: contentBody.getBoundingClientRect().bottom,
      navigationTop: navigationBounds.top,
    };
  });
  expect(endClearance, 'mobile meeting content end is measurable').not.toBeNull();
  expect(
    endClearance!.contentBottom,
    'the last meeting content is not hidden behind the fixed dock'
  ).toBeLessThanOrEqual(endClearance!.navigationTop + 1);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
}

async function expectNoInventedHomeWork(page: Page) {
  const canvas = page.locator('#dwp-main-content [data-dwp-page-canvas="workspace"]').first();
  await expect(canvas.locator('a[href*="/meetings/templates"]')).toHaveCount(0);
  await expect(canvas.locator('a[href*="/meetings/follow-ups"]')).toHaveCount(0);
  await expect(canvas.locator('a[href*="/meetings/personal-room"]')).toHaveCount(0);
  await expect(
    canvas.getByText(/E2EE ready|종단간 암호화 보장|Security level 2|보안 레벨 2/iu)
  ).toHaveCount(0);
  await expect(canvas.getByText(/0\s*\/\s*3 completed|0\s*\/\s*3 완료/u)).toHaveCount(0);
}

async function expectReducedMotion(locator: Locator, label: string) {
  const durations = await locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return [style.animationDuration, style.transitionDuration]
      .flatMap((value) => value.split(','))
      .map((value) => Number.parseFloat(value) || 0);
  });
  expect(Math.max(...durations), `${label}: reduced motion duration`).toBeLessThanOrEqual(0.001);
}

test('home EMPTY keeps real actions and honest empty work at 1440px Korean', async ({
  page,
}, testInfo) => {
  useVisualProject(testInfo, 'chromium');
  await page.setViewportSize(VIEWPORT.desktop);
  await mockMeetingVisualSession(page, { locale: 'ko', reducedMotion: true });
  await mockMeetingVisualHome(page, 'EMPTY');

  await page.goto('/meetings/home');
  await expectPageReady(page);
  await expect(
    page.getByRole('heading', { level: 1, name: '오늘의 회의와 다음 행동' })
  ).toBeVisible({ timeout: 15_000 });
  await expectHomeWorkspace(page, { desktopLayout: true });
  await expectSharedWorkspaceGutter(page, 'home EMPTY 1440 ko', 24);
  await expectNoInventedHomeWork(page);
  const primaryAction = page.getByTestId('meeting-command-primary').getByRole('button').first();
  await expectMinimumTarget(primaryAction, 'empty-home primary action');
  await expectKeyboardFocusVisible(page, primaryAction, 'empty-home primary action');
  await expectReducedMotion(page.getByTestId('meeting-home-actions'), 'empty-home action rail');
  await expectNoHorizontalOverflow(page, 'home EMPTY 1440 ko');
  await expectNoBlockingA11y(page, 'home EMPTY 1440 ko');
  await expectCleanMeetingRuntime(page, 'home EMPTY 1440 ko');
  await expectVisualSnapshot(page, 'meeting-home-empty-ko-1440-light.png');
});

test('home SAMPLE presents contract-backed schedule and result links at 1280px English', async ({
  page,
}, testInfo) => {
  useVisualProject(testInfo, 'chromium');
  await page.setViewportSize(VIEWPORT.laptop);
  await mockMeetingVisualSession(page, { locale: 'en', reducedMotion: true });
  await mockMeetingVisualHome(page, 'SAMPLE');
  await mockMeetingVisualHomeReports(page);

  await page.goto('/meetings/home');
  await expectPageReady(page);
  await expectHomeWorkspace(page, { desktopLayout: true });
  await expectSharedWorkspaceGutter(page, 'home SAMPLE 1280 en', 24);
  const timeline = page.getByTestId('meeting-home-timeline');
  await expect(timeline.getByText('Global launch decision review')).toBeVisible();
  await expect(timeline.getByText('Platform design decisions')).toBeVisible();
  await expect(timeline.getByText('Weekly one-to-one check-in')).toBeVisible();
  await expect(page.getByTestId('meeting-home-results-recent')).toBeVisible();
  await expect(page.locator('[data-testid^="meeting-home-result-recent-"]')).toHaveCount(1);
  await expect(page.locator('[data-testid^="meeting-home-result-queue-"]')).toHaveCount(1);
  await expectNoInventedHomeWork(page);
  const primaryAction = page.getByTestId('meeting-command-primary').getByRole('button', {
    name: 'Enter & check devices',
  });
  await expectMinimumTarget(primaryAction, 'sample-home prepare action');
  await expectKeyboardFocusVisible(page, primaryAction, 'sample-home prepare action');
  await expectNoHorizontalOverflow(page, 'home SAMPLE 1280 en');
  await expectNoBlockingA11y(page, 'home SAMPLE 1280 en');
  await expectCleanMeetingRuntime(page, 'home SAMPLE 1280 en');
  await expectVisualSnapshot(page, 'meeting-home-sample-en-1280-light.png');
});

test('home SAMPLE preserves the approved full work hierarchy at 390px Korean', async ({
  page,
}, testInfo) => {
  useVisualProject(testInfo, 'chromium');
  await page.setViewportSize(VIEWPORT.mobile);
  await mockMeetingVisualSession(page, { locale: 'ko', reducedMotion: true });
  await mockMeetingVisualHome(page, 'SAMPLE');
  await mockMeetingVisualHomeReports(page);

  await page.goto('/meetings/home');
  await expectPageReady(page);
  await expectHomeWorkspace(page);
  await expect(page.getByTestId('meeting-home-timeline-row')).toHaveCount(3);
  await expect(page.locator('[data-testid^="meeting-home-result-queue-"]')).toHaveCount(1);
  await expect(page.locator('[data-testid^="meeting-home-result-recent-"]')).toHaveCount(1);
  await expect(page.getByTestId('meeting-home-resources')).toBeVisible();
  await expectMeetingMobileNavigation(page, 'home');
  await expectSharedWorkspaceGutter(page, 'home SAMPLE 390 ko', 16);
  await expectNoHorizontalOverflow(page, 'home SAMPLE 390 ko');
  await expectNoBlockingA11y(page, 'home SAMPLE 390 ko');
  await expectCleanMeetingRuntime(page, 'home SAMPLE 390 ko');
  await expectVisualSnapshot(page, 'meeting-home-sample-ko-390-light.png');
  await expectVisualSnapshot(page, 'meeting-home-sample-ko-390-light-viewport.png', {
    fullPage: false,
  });
});

test('home NEXT remains usable at 768px and 200 percent English text', async ({
  page,
}, testInfo) => {
  useVisualProject(testInfo, 'chromium');
  await page.setViewportSize(VIEWPORT.tablet);
  await mockMeetingVisualSession(page, { locale: 'en', reducedMotion: true });
  await mockMeetingVisualHome(page, 'NEXT');

  await page.goto('/meetings/home');
  await expect(page.getByText('Global launch decision review').first()).toBeVisible();
  await expectPageReady(page);
  await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
  const heading = page.getByRole('heading', {
    level: 1,
    name: "Today's meetings and next actions",
  });
  await expectViewportInset(heading, 'home NEXT 200 percent heading');
  await expectHomeWorkspace(page);
  await expectSharedWorkspaceGutter(page, 'home NEXT 768 en 200 percent', 16);
  await expectNoHorizontalOverflow(page, 'home NEXT 768 en 200 percent');
  await expectNoBlockingA11y(page, 'home NEXT 768 en 200 percent');
  await expectCleanMeetingRuntime(page, 'home NEXT 768 en 200 percent');
  await expectVisualSnapshot(page, 'meeting-home-next-en-768-text-200.png');
});

test('home LIVE preserves hierarchy and touch targets at 390px Korean dark mode', async ({
  page,
}, testInfo) => {
  useVisualProject(testInfo, 'chromium');
  await page.setViewportSize(VIEWPORT.mobile);
  await mockMeetingVisualSession(page, {
    locale: 'ko',
    colorScheme: 'dark',
    reducedMotion: true,
  });
  await mockMeetingVisualHome(page, 'LIVE');

  await page.goto('/meetings/home');
  await expect(page.getByText('Executive launch room').first()).toBeVisible();
  const heading = page.getByRole('heading', {
    level: 1,
    name: '오늘의 회의와 다음 행동',
  });
  await expect(heading, 'Korean display heading keeps words together').toHaveCSS(
    'word-break',
    'keep-all'
  );
  await expectPageReady(page);
  await expectHomeWorkspace(page);
  await expectSharedWorkspaceGutter(page, 'home LIVE 390 ko dark', 16);
  const primaryAction = page.getByTestId('meeting-command-primary').getByRole('button').first();
  await expectMinimumTarget(primaryAction, 'live-home primary action');
  await expectNoHorizontalOverflow(page, 'home LIVE 390 ko dark');
  await expectNoBlockingA11y(page, 'home LIVE 390 ko dark');
  await expectCleanMeetingRuntime(page, 'home LIVE 390 ko dark');
  await expectVisualSnapshot(page, 'meeting-home-live-ko-390-dark.png');
  await expectVisualSnapshot(page, 'meeting-home-live-ko-390-dark-viewport.png', {
    fullPage: false,
  });
});

test('home service blocker stays explicit at the 320px English forced-colors boundary', async ({
  browserName,
  page,
}, testInfo) => {
  useVisualProject(testInfo, 'chromium');
  await page.setViewportSize(VIEWPORT.minimum);
  await mockMeetingVisualSession(page, {
    locale: 'en',
    forcedColors: 'active',
    reducedMotion: true,
  });
  await mockMeetingVisualHome(page, 'BLOCKED');

  await page.goto('/meetings/home');
  if (browserName === 'chromium') {
    expect(
      await page.evaluate(() => matchMedia('(forced-colors: active)').matches),
      'Chromium forced-colors emulation is active'
    ).toBe(true);
  }
  await expectPageReady(page);
  await expectHomeWorkspace(page);
  const actions = page.getByTestId('meeting-home-actions');
  await expect(actions.getByRole('button', { name: 'Start now' })).toBeDisabled();
  await expect(actions.getByRole('button', { name: 'Schedule meeting' })).toBeEnabled();
  await expect(actions.getByRole('button', { name: 'Enter code' })).toBeDisabled();
  await expectMeetingMobileNavigation(page, 'home');
  await expectNoInventedHomeWork(page);
  await expectNoHorizontalOverflow(page, 'home BLOCKED 320 en forced colors');
  await expectNoBlockingA11y(page, 'home BLOCKED 320 en forced colors');
  await expectCleanMeetingRuntime(page, 'home BLOCKED 320 en forced colors');
  await expectVisualSnapshot(page, 'meeting-home-blocked-en-320-forced-colors.png');
  await expectVisualSnapshot(page, 'meeting-home-blocked-en-320-forced-colors-viewport.png', {
    fullPage: false,
  });
});

test('My meetings uses a bounded list and inspector at 1280px English', async ({
  page,
}, testInfo) => {
  useVisualProject(testInfo, 'chromium');
  await page.setViewportSize(VIEWPORT.laptop);
  await mockMeetingVisualSession(page, { locale: 'en', reducedMotion: true });
  await mockMeetingVisualMine(page);
  await mockImplementationMeetingPreparation(page);

  await page.goto('/meetings/mine');
  await expectPageReady(page);
  await expect(page.getByRole('heading', { level: 1, name: 'My meetings' })).toBeVisible();
  const workspace = page.getByTestId('my-meetings-workspace');
  await expectSharedWorkspaceGutter(page, 'My meetings 1280 en', 24);
  const list = page.getByTestId('my-meetings-list');
  const inspector = page.getByTestId('my-meetings-inspector');
  await expect(list.getByText('Global launch decision review')).toBeVisible();
  await expect(inspector.getByText('Global launch decision review')).toBeVisible();
  const geometry = await workspace.evaluate((element) => {
    const listElement = element.querySelector<HTMLElement>('[data-testid="my-meetings-list"]');
    const inspectorElement = element.querySelector<HTMLElement>(
      '[data-testid="my-meetings-inspector"]'
    );
    if (!listElement || !inspectorElement) return null;
    return {
      list: listElement.getBoundingClientRect().width,
      inspector: inspectorElement.getBoundingClientRect().width,
    };
  });
  expect(geometry).not.toBeNull();
  expect(geometry!.list).toBeGreaterThan(geometry!.inspector * 1.6);
  await page.getByRole('tab', { name: 'Live now' }).click();
  await expect(list.getByText('Executive launch room')).toBeVisible();
  await expect(inspector.getByText('Executive launch room')).toBeVisible();
  await page.getByRole('tab', { name: 'Upcoming' }).click();
  await expectNoHorizontalOverflow(page, 'My meetings 1280 en');
  await expectNoBlockingA11y(page, 'My meetings 1280 en');
  await expectCleanMeetingRuntime(page, 'My meetings 1280 en');
  await expectVisualSnapshot(page, 'meeting-mine-en-1280-light.png');
});

test('My meetings keeps the selected preparation and stable navigation at 390px Korean dark', async ({
  page,
}, testInfo) => {
  useVisualProject(testInfo, 'chromium');
  await page.setViewportSize(VIEWPORT.mobile);
  await mockMeetingVisualSession(page, {
    locale: 'ko',
    colorScheme: 'dark',
    reducedMotion: true,
  });
  await mockMeetingVisualMine(page);
  await mockImplementationMeetingPreparation(page);

  await page.goto('/meetings/mine');
  await expectPageReady(page);
  await expect(page.getByTestId('my-meetings-inspector')).toHaveCount(0);
  await page.getByRole('button', { name: MEETING_VISUAL_SUMMARY.title, exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByTestId('my-meetings-inspector')).toBeVisible();
  await dialog
    .getByTestId('my-meetings-inspector')
    .getByRole('button', { name: '닫기', exact: true })
    .click();
  await expect(page.getByTestId('my-meetings-inspector')).toHaveCount(0);
  await expect(page.getByTestId('my-meetings-list')).toBeVisible();
  await expectSharedWorkspaceGutter(page, 'My meetings 390 ko dark', 16);
  await expectMeetingMobileNavigation(page, 'mine');
  await expectNoHorizontalOverflow(page, 'My meetings 390 ko dark');
  await expectNoBlockingA11y(page, 'My meetings 390 ko dark');
  await expectCleanMeetingRuntime(page, 'My meetings 390 ko dark');
  await expectVisualSnapshot(page, 'meeting-mine-ko-390-dark.png');
  await expectVisualSnapshot(page, 'meeting-mine-ko-390-dark-viewport.png', { fullPage: false });
});

test('prejoin keeps the private preview and security rail side by side at 1280px English', async ({
  page,
}, testInfo) => {
  useVisualProject(testInfo, 'chromium');
  await page.setViewportSize(VIEWPORT.laptop);
  await mockMeetingVisualSession(page, { locale: 'en', reducedMotion: true });
  await mockMeetingVisualHome(page, 'NEXT');
  await mockMeetingVisualPrejoin(page);

  await page.goto(`/meetings/room/${MEETING_VISUAL_ID}`);
  await expect(page.getByRole('heading', { name: 'Check the room before entering' })).toBeVisible();
  await page.getByRole('button', { name: 'Check camera and microphone' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: MEETING_VISUAL_SUMMARY.title })
  ).toBeVisible();
  const workspace = page.getByRole('region', {
    name: 'Device and security check before joining',
  });
  await expect(workspace.getByText('Private preview')).toBeVisible();
  await expect(workspace.getByText('Live capture is not requested')).toBeVisible();
  const speaker = page.getByTestId('meeting-prejoin-speaker');
  await expect(speaker.getByRole('combobox', { name: 'Speaker' })).toBeVisible();
  await expectMinimumTarget(
    speaker.getByRole('button', { name: 'Play test sound' }),
    'speaker test'
  );
  const geometry = await workspace.evaluate((element) => {
    const stage = element.querySelector<HTMLElement>('.dwp-meeting-prejoin__stage');
    const rail = element.querySelector<HTMLElement>('.dwp-meeting-prejoin__rail');
    if (!stage || !rail) return null;
    const stageBounds = stage.getBoundingClientRect();
    const railBounds = rail.getBoundingClientRect();
    return {
      stageWidth: stageBounds.width,
      railWidth: railBounds.width,
      topDifference: Math.abs(stageBounds.top - railBounds.top),
    };
  });
  expect(geometry).not.toBeNull();
  expect(geometry!.stageWidth).toBeGreaterThan(geometry!.railWidth * 1.45);
  expect(geometry!.topDifference).toBeLessThanOrEqual(1);
  await expect(page.getByTestId('meeting-mobile-navigation')).toHaveCount(0);
  await expectNoHorizontalOverflow(page, 'prejoin 1280 en');
  await expectNoBlockingA11y(page, 'prejoin 1280 en');
  await expectCleanMeetingRuntime(page, 'prejoin 1280 en');
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 100);
  await expect(workspace).toBeVisible();
  await expectVisualSnapshot(page, 'meeting-prejoin-en-1280-light.png');
});

test('prejoin stacks preview before policy at 390px Korean dark mode', async ({
  page,
}, testInfo) => {
  useVisualProject(testInfo, 'chromium');
  await page.setViewportSize(VIEWPORT.mobile);
  await mockMeetingVisualSession(page, {
    locale: 'ko',
    colorScheme: 'dark',
    reducedMotion: true,
  });
  await mockMeetingVisualHome(page, 'NEXT');
  await mockMeetingVisualPrejoin(page);

  await page.goto(`/meetings/room/${MEETING_VISUAL_ID}`);
  await page.getByRole('button', { name: '카메라와 마이크 점검' }).click();
  const heading = page.getByRole('heading', { level: 1, name: MEETING_VISUAL_SUMMARY.title });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  const headingTop = await heading.evaluate((element) => element.getBoundingClientRect().top);
  expect(headingTop).toBeGreaterThanOrEqual(64);
  expect(headingTop).toBeLessThan(180);
  const workspace = page.getByRole('region', { name: '회의 입장 전 장치 및 보안 확인' });
  await expect(workspace.getByText('비공개 미리보기')).toBeVisible();
  await expect(workspace.getByText('실시간 수집 요청 없음')).toBeVisible();
  const speaker = page.getByTestId('meeting-prejoin-speaker');
  await expect(speaker.getByRole('combobox', { name: '스피커' })).toBeVisible();
  const join = page.getByRole('button', { name: '회의 참여' });
  await expectMinimumTarget(join, 'mobile sticky join');
  const joinPlacement = await join.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const footer = element.closest('.dwp-meeting-prejoin__admission-actions')!;
    return {
      position: getComputedStyle(footer).position,
      footerBottom: innerHeight - footer.getBoundingClientRect().bottom,
      buttonBottom: innerHeight - bounds.bottom,
    };
  });
  expect(joinPlacement.position).toBe('fixed');
  expect(joinPlacement.footerBottom).toBeGreaterThanOrEqual(0);
  expect(joinPlacement.footerBottom).toBeLessThanOrEqual(1);
  expect(joinPlacement.buttonBottom).toBeGreaterThanOrEqual(12);
  expect(joinPlacement.buttonBottom).toBeLessThanOrEqual(120);
  const geometry = await workspace.evaluate((element) => {
    const stage = element.querySelector<HTMLElement>('.dwp-meeting-prejoin__stage');
    const rail = element.querySelector<HTMLElement>('.dwp-meeting-prejoin__rail');
    if (!stage || !rail) return null;
    const stageBounds = stage.getBoundingClientRect();
    const railBounds = rail.getBoundingClientRect();
    return {
      stageBottom: stageBounds.bottom,
      railTop: railBounds.top,
    };
  });
  expect(geometry).not.toBeNull();
  expect(geometry!.railTop).toBeGreaterThanOrEqual(geometry!.stageBottom - 1);
  await expect(page.getByTestId('meeting-mobile-navigation')).toHaveCount(0);
  await expectNoHorizontalOverflow(page, 'prejoin 390 ko dark');
  await expectNoBlockingA11y(page, 'prejoin 390 ko dark');
  await expectCleanMeetingRuntime(page, 'prejoin 390 ko dark');
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 100);
  await expect(workspace).toBeVisible();
  await expectVisualSnapshot(page, 'meeting-prejoin-ko-390-dark.png');
  await expectVisualSnapshot(page, 'meeting-prejoin-ko-390-dark-viewport.png', {
    fullPage: false,
  });
});

test('Meeting library uses a 7 to 5 result and evidence preview at 1280px English', async ({
  page,
}, testInfo) => {
  useVisualProject(testInfo, 'chromium');
  await page.setViewportSize(VIEWPORT.laptop);
  await mockMeetingVisualSession(page, { locale: 'en', reducedMotion: true });
  await mockMeetingVisualPublishedRecap(page);

  const publishedReportRequest = page.waitForRequest((request) =>
    request.url().endsWith(`/meetings/${MEETING_VISUAL_ID}/intelligence/reports/latest-published`)
  );
  await page.goto('/meetings/history');
  await publishedReportRequest;
  await expectPageReady(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Meeting library' })).toBeVisible();
  const list = page.getByTestId('meeting-library-list');
  await expectSharedWorkspaceGutter(page, 'Meeting library 1280 en', 24);
  const preview = page.getByTestId('meeting-library-preview');
  await expect(list).toContainText('Regional launch readiness review');
  await expect(preview).toContainText('Regional launch readiness review');
  await expect(preview.getByTestId('meeting-library-ai-preview')).toContainText(
    'The group approved a staged launch'
  );
  await expect(preview.getByTestId('meeting-library-recording-preview')).toContainText(
    'A governed recording is available'
  );
  const listBounds = await list.boundingBox();
  const previewBounds = await preview.boundingBox();
  expect(listBounds).not.toBeNull();
  expect(previewBounds).not.toBeNull();
  expect(listBounds!.width / previewBounds!.width).toBeGreaterThan(1.3);
  expect(listBounds!.width / previewBounds!.width).toBeLessThan(1.55);
  const stages = preview.getByTestId('meeting-recap-pipeline').getByRole('listitem');
  await expect(stages).toHaveCount(5);
  for (const word of ['Recording', 'Transcript', 'Review', 'Published']) {
    const label = stages.getByText(word, { exact: true });
    const lines = await label.evaluate((element) => {
      const style = getComputedStyle(element);
      return element.getBoundingClientRect().height / Number.parseFloat(style.lineHeight);
    });
    expect(lines, `The narrow inspector must not split the word ${word}`).toBeLessThanOrEqual(1.1);
  }
  await expectNoHorizontalOverflow(page, 'Meeting library 1280 en');
  await expectNoBlockingA11y(page, 'Meeting library 1280 en');
  await expectCleanMeetingRuntime(page, 'Meeting library 1280 en');
  await expectVisualSnapshot(page, 'meeting-library-en-1280-light.png');
});

test('Meeting library becomes a single actionable list at 390px Korean', async ({
  page,
}, testInfo) => {
  useVisualProject(testInfo, 'chromium');
  await page.setViewportSize(VIEWPORT.mobile);
  await mockMeetingVisualSession(page, { locale: 'ko', reducedMotion: true });
  await mockMeetingVisualPublishedRecap(page);

  await page.goto('/meetings/history');
  await expectPageReady(page);
  await expect(page.getByTestId('meeting-library-list')).toBeVisible();
  await expect(page.getByTestId('meeting-library-preview')).toBeHidden();
  await expectSharedWorkspaceGutter(page, 'Meeting library 390 ko', 16);
  await expect(page.getByRole('button', { name: '회의 회고 열기' }).first()).toBeVisible();
  await expectMeetingMobileNavigation(page, 'history');
  await expectNoHorizontalOverflow(page, 'Meeting library 390 ko');
  await expectNoBlockingA11y(page, 'Meeting library 390 ko');
  await expectCleanMeetingRuntime(page, 'Meeting library 390 ko');
  await expectVisualSnapshot(page, 'meeting-library-ko-390-light.png');
  await expectVisualSnapshot(page, 'meeting-library-ko-390-light-viewport.png', {
    fullPage: false,
  });
});

test('home code entry preserves the real join route and keyboard focus on desktop and mobile', async ({
  page,
}) => {
  await mockMeetingVisualSession(page, { locale: 'en', reducedMotion: true });
  await mockMeetingVisualHome(page, 'NEXT');
  await page.setViewportSize(VIEWPORT.laptop);
  await page.goto('/meetings/home');
  const actions = page.getByTestId('meeting-home-actions');
  const inlineCode = actions.locator('input[autocomplete="one-time-code"]');
  await inlineCode.fill('abcdefghjkmn');
  await inlineCode.press('Enter');
  await expect(page).toHaveURL(/\/meetings\/join\?code=ABCDEFGHJKMN$/u);

  await page.setViewportSize(VIEWPORT.mobile);
  await page.goto('/meetings/home');
  const openCode = actions.getByRole('button', { name: 'Enter code' });
  await openCode.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const dialogCode = dialog.locator('input[autocomplete="one-time-code"]');
  await expect(dialogCode).toBeFocused();
  await dialogCode.fill('ABCD-EFGH-JKMN');
  const dialogAccessibility = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  expect(
    dialogAccessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
  await dialogCode.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(openCode).toBeFocused();
  await openCode.click();
  await dialogCode.fill('ABCD-EFGH-JKMN');
  await dialogCode.press('Enter');
  await expect(page).toHaveURL(/\/meetings\/join\?code=ABCDEFGHJKMN$/u);
});

test('home revalidation failure removes stale meeting data and recovers the entered code', async ({
  page,
}, testInfo) => {
  useVisualProject(testInfo, 'chromium');
  await mockMeetingVisualSession(page, { locale: 'en', reducedMotion: true });
  await mockMeetingVisualHome(page, 'NEXT');
  await page.setViewportSize(VIEWPORT.laptop);
  await page.goto('/meetings/home');
  const actions = page.getByTestId('meeting-home-actions');
  const code = actions.locator('input[autocomplete="one-time-code"]');
  await code.fill('ABCD-EFGH-JKMN');
  let failing = true;
  await page.route('**/api/meetings/v1/home*', (route) =>
    failing
      ? route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ERROR', message: 'Temporarily unavailable' }),
        })
      : route.fallback()
  );
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByTestId('meeting-home-stale')).toBeVisible();
  await expect(page.getByText('Global launch decision review')).toHaveCount(0);
  await expect(actions).toHaveCount(0);
  await expect(page.getByTestId('meeting-home-recent')).toHaveCount(0);
  failing = false;
  await page.getByRole('button', { name: /Retry|Try again/u }).click();
  await expect(actions).toBeVisible();
  await expect(code).toHaveValue('ABCD-EFGH-JKMN');
  await expect(page.getByText('Global launch decision review').first()).toBeVisible();
});

test('home initial failure exposes retry without manufactured ready work', async ({ page }) => {
  await mockMeetingVisualSession(page, { locale: 'en', reducedMotion: true });
  await mockMeetingVisualHome(page, 'NEXT');
  let failing = true;
  await page.route('**/api/meetings/v1/home*', (route) =>
    failing
      ? route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ERROR', message: 'Temporarily unavailable' }),
        })
      : route.fallback()
  );
  await page.goto('/meetings/home');
  const retry = page.getByRole('button', { name: /Retry|Try again/u });
  await expect(retry).toBeVisible();
  await expect(page.getByTestId('meeting-home-actions')).toHaveCount(0);
  await expect(page.getByText('Global launch decision review')).toHaveCount(0);
  await expectNoBlockingA11y(page, 'home initial load failure');
  failing = false;
  await retry.click();
  await expect(page.getByTestId('meeting-home-actions')).toBeVisible();
});

test('home uses authorized review tasks and published excerpts then redacts revoked reports', async ({
  page,
}, testInfo) => {
  useVisualProject(testInfo, 'chromium');
  await mockMeetingVisualSession(page, { locale: 'en', reducedMotion: true });
  await mockMeetingVisualHome(page, 'SAMPLE');
  const reports = await mockMeetingVisualHomeReports(page);
  await page.setViewportSize(VIEWPORT.desktop);
  await page.goto('/meetings/home');
  const queueItem = page.getByTestId(`meeting-home-result-queue-${MEETING_VISUAL_RECENT_ID}`);
  const recentItem = page.getByTestId(`meeting-home-result-recent-${MEETING_VISUAL_RECENT_ID}`);
  await expect(queueItem).toContainText('Regional launch readiness review');
  await expect(recentItem).toContainText('The group approved a staged launch');
  await expect(page.getByText('Private unreviewed draft text', { exact: false })).toHaveCount(0);
  await expectMinimumTarget(queueItem.getByRole('button'), 'assigned review action');
  await expectMinimumTarget(recentItem.getByRole('button'), 'published recap action');
  await expectNoBlockingA11y(page, 'home assigned review and published report');
  await page.screenshot({
    path: testInfo.outputPath('home-authorized-results.png'),
    fullPage: true,
  });
  await queueItem.getByRole('button').click();
  await expect(page).toHaveURL((url) => {
    return (
      url.pathname === '/meetings/history' &&
      url.searchParams.get('meeting') === MEETING_VISUAL_RECENT_ID &&
      url.searchParams.get('reportId') === '88000000-0000-0000-0000-000000000305' &&
      url.searchParams.get('intent') === 'review'
    );
  });
  await page.goBack();
  await expect(queueItem).toBeVisible();
  reports.revoke();
  await page.clock.fastForward(60_001);
  await expect(queueItem).toHaveCount(0);
  await expect(recentItem).toHaveCount(0);
  await expect(page.getByText('The group approved a staged launch', { exact: false })).toHaveCount(
    0
  );
  await expect(page.getByTestId('meeting-home-timeline')).toContainText(
    'Global launch decision review'
  );
});

test('J01 code join keeps a compact work and support composition at 1440 and 1280', async ({
  page,
}, testInfo) => {
  useVisualProject(testInfo, 'chromium');
  await mockMeetingVisualSession(page, { locale: 'en', reducedMotion: true });

  for (const viewport of [VIEWPORT.desktop, VIEWPORT.laptop]) {
    await page.setViewportSize(viewport);
    await page.goto('/meetings/join');
    await expectPageReady(page);
    await expectJ01JoinWorkspace(page, 'desktop');
    await expectFocusCanvasGutter(page, `J01 join ${viewport.width} en`, 24);
    const code = page.locator('input[autocomplete="one-time-code"]');
    await expect(code).not.toBeFocused();
    await code.fill('ABCD-EFGH-JKMN');
    const resolve = page.getByTestId('meeting-join-actions').getByRole('button');
    await expectMinimumTarget(resolve, `J01 ${viewport.width} primary action`);
    await expectKeyboardFocusVisible(page, resolve, `J01 ${viewport.width} primary action`);
    await expectNoHorizontalOverflow(page, `J01 join ${viewport.width} en`);
    await expectNoBlockingA11y(page, `J01 join ${viewport.width} en`);
    await expectCleanMeetingRuntime(page, `J01 join ${viewport.width} en`);
  }
});

test('J01 code join reflows at 390 and survives 320px forced colors with 200% text', async ({
  page,
}, testInfo) => {
  useVisualProject(testInfo, 'mobile');
  await mockMeetingVisualSession(page, {
    locale: 'ko',
    colorScheme: 'dark',
    reducedMotion: true,
  });

  await page.setViewportSize(VIEWPORT.mobile);
  await page.goto('/meetings/join');
  await expectPageReady(page);
  await expectJ01JoinWorkspace(page, 'mobile');
  await expectFocusCanvasGutter(page, 'J01 join 390 ko dark', 16);
  let code = page.locator('input[autocomplete="one-time-code"]');
  await code.fill('ABCD-EFGH-JKMN');
  let resolve = page.getByTestId('meeting-join-actions').getByRole('button');
  await expectMinimumTarget(resolve, 'J01 390 primary action');
  await expectKeyboardFocusVisible(page, resolve, 'J01 390 primary action');
  await expectNoHorizontalOverflow(page, 'J01 join 390 ko dark');
  await expectNoBlockingA11y(page, 'J01 join 390 ko dark');
  await expectCleanMeetingRuntime(page, 'J01 join 390 ko dark');

  await page.emulateMedia({
    colorScheme: 'light',
    forcedColors: 'active',
    reducedMotion: 'reduce',
  });
  await page.setViewportSize(VIEWPORT.minimum);
  await page.goto('/meetings/join');
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await expectPageReady(page);
  await expectJ01JoinWorkspace(page, 'mobile', { compactRail: false });
  await expectFocusCanvasGutter(page, 'J01 join 320 ko forced colors 200 percent', 16);
  code = page.locator('input[autocomplete="one-time-code"]');
  await code.fill('ABCD-EFGH-JKMN');
  resolve = page.getByTestId('meeting-join-actions').getByRole('button');
  await expectMinimumTarget(resolve, 'J01 320 primary action');
  await expectKeyboardFocusVisible(page, resolve, 'J01 320 primary action');
  await expectViewportInset(resolve, 'J01 320 primary action');
  await expectNoHorizontalOverflow(page, 'J01 join 320 ko forced colors 200 percent');
  await expectNoBlockingA11y(page, 'J01 join 320 ko forced colors 200 percent');
  await expectCleanMeetingRuntime(page, 'J01 join 320 ko forced colors 200 percent');
});

test('J01 desktop initial state remains stable against its exact Stitch source node', async ({
  page,
}, testInfo) => {
  useVisualProject(testInfo, 'chromium');
  annotateJ01Source(testInfo, 'desktop');
  await page.setViewportSize(VIEWPORT.desktop);
  await mockMeetingVisualSession(page, { locale: 'ko', reducedMotion: true });

  await page.goto('/meetings/join');
  await expectPageReady(page);
  await expectJ01JoinWorkspace(page, 'desktop');
  await expectNoHorizontalOverflow(page, 'J01 desktop source review 1440 ko');
  await expectNoBlockingA11y(page, 'J01 desktop source review 1440 ko');
  await expectCleanMeetingRuntime(page, 'J01 desktop source review 1440 ko');
  await expectVisualSnapshot(page, 'meeting-j01-initial-ko-1440-light.png');
});

test('J01 mobile resolved approval state remains stable against its exact Stitch source node', async ({
  page,
}, testInfo) => {
  useVisualProject(testInfo, 'mobile');
  annotateJ01Source(testInfo, 'mobile');
  await page.setViewportSize(VIEWPORT.mobile);
  await mockMeetingVisualSession(page, { locale: 'ko', reducedMotion: true });
  await mockJ01ResolvedMeeting(page);

  await page.goto('/meetings/join?code=ABCDEFGHJKMN');
  await page.getByTestId('meeting-join-actions').getByRole('button').click();
  await expect(page.getByTestId('meeting-join-summary')).toBeVisible();
  await expectPageReady(page);
  await expectJ01JoinWorkspace(page, 'mobile');
  await expect(
    page.getByTestId('meeting-join-step-rail').locator('[aria-current="step"]')
  ).toHaveText(/입장|승인/u);
  await expectNoHorizontalOverflow(page, 'J01 mobile source review 390 ko');
  await expectNoBlockingA11y(page, 'J01 mobile source review 390 ko');
  await expectCleanMeetingRuntime(page, 'J01 mobile source review 390 ko');
  await expectVisualSnapshot(page, 'meeting-j01-resolved-approval-ko-390-light.png');
});

test('published AI recap remains evidence-led at 1440px English dark mode', async ({
  page,
}, testInfo) => {
  useVisualProject(testInfo, 'chromium');
  await page.setViewportSize(VIEWPORT.desktop);
  await mockMeetingVisualSession(page, {
    locale: 'en',
    colorScheme: 'dark',
    reducedMotion: true,
  });
  await mockMeetingVisualPublishedRecap(page);

  await page.goto(`/meetings/history?meeting=${MEETING_VISUAL_ID}`);
  await expect(
    page.getByRole('heading', { name: 'Regional launch readiness review' })
  ).toBeVisible();
  await expect(page.getByText('The group approved a staged launch')).toBeVisible();
  await expect(page.getByText('Launch the internal pilot on Monday.')).toBeVisible();
  await expectPageReady(page);
  const overviewTab = page.getByRole('tab', { name: 'Overview' });
  await expectMinimumTarget(overviewTab, 'recap overview tab');
  await expectKeyboardFocusVisible(page, overviewTab, 'recap overview tab');
  await expectFocusClearance(overviewTab, 'recap overview tab');
  await expectNoHorizontalOverflow(page, 'published recap 1440 en dark');
  await expectNoBlockingA11y(page, 'published recap 1440 en dark');
  await expectCleanMeetingRuntime(page, 'published recap 1440 en dark');
  // Await MUI's font/resize measurement: all four tabs fit this desktop rail.
  const tabRail = overviewTab.locator('xpath=ancestor::div[contains(@class, "MuiTabs-root")][1]');
  await expect(tabRail.locator('.MuiTabs-scrollButtons')).toHaveCount(0);
  await expectVisualSnapshot(page, 'meeting-recap-published-en-1440-dark.png');
});

test('published AI recap preserves the evidence rail and library navigation at 390px Korean', async ({
  page,
}, testInfo) => {
  useVisualProject(testInfo, 'chromium');
  await page.setViewportSize(VIEWPORT.mobile);
  await mockMeetingVisualSession(page, { locale: 'ko', reducedMotion: true });
  await mockMeetingVisualPublishedRecap(page);

  await page.goto(`/meetings/history?meeting=${MEETING_VISUAL_ID}`);
  await expectPageReady(page);
  await expect(page.getByTestId('meeting-recap-overview')).toBeVisible();
  await expect(page.getByTestId('meeting-recap-evidence-rail')).toBeVisible();
  await expect(page.getByText('거버넌스가 적용된 녹화를 재생할 수 있습니다')).toBeVisible();
  await expectMeetingMobileNavigation(page, 'history');
  await expectNoHorizontalOverflow(page, 'published recap 390 ko');
  await expectNoBlockingA11y(page, 'published recap 390 ko');
  await expectCleanMeetingRuntime(page, 'published recap 390 ko');
  await expectVisualSnapshot(page, 'meeting-recap-published-ko-390-light.png');
  await expectVisualSnapshot(page, 'meeting-recap-published-ko-390-light-viewport.png', {
    fullPage: false,
  });
});
