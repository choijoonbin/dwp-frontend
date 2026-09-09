import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { expectMobileActivityLayout } from './support/activity-mobile-layout';
import {
  COMPLETED_RUN_ID,
  FIXED_NOW,
  INPUT_EVENT_ID,
  mockActivityContracts,
  mockFlowExperience,
  RUNNING_RUN_ID,
  SAMPLE_RUN_ID,
  WORK_EVENT_ID,
} from './support/activity-stitch-contract-fixtures';
import { expectNoInventedCommands, screenshotOptions } from './support/activity-visual-assertions';
import { createBrowserZoomSession } from './support/browser-zoom';
import { mockShellSession } from './support/shell-session';

// Each route has its own contract fixture. A failed visual baseline must not
// prevent the remaining responsive and accessibility profiles from being checked.
test.describe.configure({ mode: 'default' });

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', '해상도를 명시한 단일 Chromium 기준선입니다.');
  await page.setViewportSize({ width: 1280, height: 1024 });
  await page.clock.setFixedTime(FIXED_NOW);
  await page.emulateMedia({ colorScheme: 'light', forcedColors: 'none', reducedMotion: 'reduce' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    displayName: '김민아',
    appearance: {
      mode: 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
  await mockActivityContracts(page);
});

test('활동 홈은 현재 실행 합계·주의 신호·근거 있는 최근 활동을 구분한다', async ({ page }) => {
  await page.goto('/activity/home');
  await expectReady(page, '활동 홈');

  const summary = page.getByRole('region', { name: '활동 상태 요약' });
  await expect(summary).toContainText('연결된 실행');
  await expect(summary).toContainText('12');
  await expect(summary).toContainText('실행 중');
  await expect(summary).toContainText('확인 필요');
  await expect(summary).toContainText('정책 차단');
  await expect(page.getByRole('heading', { name: '최근 활동' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '개인 연동 원장 상태' })).toBeVisible();
  await expect(page.getByText('개인 메일 연동', { exact: true })).toBeVisible();
  await expect(page.getByText('최신성 지연', { exact: true })).toBeVisible();
  await expect(page.getByText('정책 제한 캘린더 연동', { exact: true })).toBeVisible();
  await expect(page.getByText('개발 검증 데이터', { exact: true })).toBeVisible();
  await expect(page.getByText('월간 운영 리스크를 분석하고 있습니다')).toBeVisible();
  await expect(page.getByRole('link', { name: '입력 필요 2건 보기' })).toBeVisible();
  await expect(page.getByRole('link', { name: '정책 차단 1건 보기' })).toBeVisible();
  await expectNoInventedCommands(page);
  await expectVisualQuality(page, '#dwp-main-content');
  await expect(page).toHaveScreenshot('activity-stitch-home-1280.png', screenshotOptions());

  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoHorizontalOverflow(page, '/activity/home @ 390');
  await expect(page).toHaveScreenshot('activity-stitch-home-390.png', screenshotOptions());
});

test('활동 타임라인은 현재 합계와 필터된 과거 사건을 섞지 않는다', async ({ page }) => {
  const requests: URL[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith('/workspace/activity') || url.pathname.endsWith('/activity/events')) {
      requests.push(url);
    }
  });
  await page.goto('/activity/timeline');
  await expectReady(page, '활동');

  await expect(page.getByRole('region', { name: '활동 요약' })).toContainText('12');
  const timeline = page.getByRole('list', { name: '워크스페이스 활동' });
  await expect(timeline).toContainText('월간 운영 리스크를 분석하고 있습니다');
  await expect(timeline).toContainText('접근 권한 검토 기록이 저장됐습니다');
  await expect(page.getByText('표시 중인 이벤트 6개')).toBeVisible();
  await expectVisualQuality(page, '#dwp-main-content');
  await expect(page).toHaveScreenshot('activity-stitch-timeline-1280.png', screenshotOptions());
  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoHorizontalOverflow(page, '/activity/timeline @ 390');
  await expectMobileActivityLayout(page, 'timeline');
  await expect(timeline.getByText('월간 운영 리스크를 분석하고 있습니다')).toBeInViewport();
  await expect(page).toHaveScreenshot('activity-stitch-timeline-390.png', screenshotOptions());
  await page.setViewportSize({ width: 1280, height: 1024 });

  await page.getByRole('button', { name: '에이전트', exact: true }).click();
  await expect(page).toHaveURL((url) => url.searchParams.get('actor') === 'agent');
  await expect(page.getByText('표시 중인 이벤트 3개')).toBeVisible();
  await expect(timeline).not.toContainText('고객 제안서 최종 검토가 필요합니다');
  expect(requests.some((url) => url.searchParams.get('actor') === 'AGENT')).toBe(true);

  await page.setViewportSize({ width: 320, height: 844 });
  await expectNoHorizontalOverflow(page, '/activity/timeline?actor=agent @ 320');
  await expectMobileActivityLayout(page, 'timeline');
  await expect(timeline.getByText('월간 운영 리스크를 분석하고 있습니다')).toBeInViewport();
  await expectNoSeriousAxeViolations(page, '#dwp-main-content');
  await expect(page).toHaveScreenshot(
    'activity-stitch-timeline-filtered-320.png',
    screenshotOptions()
  );
});

test('공통 상세는 데스크톱 인라인과 모바일 드로어에서 사건·업무 상태를 정확히 설명한다', async ({
  page,
}) => {
  await page.goto(`/activity/timeline?event=${WORK_EVENT_ID}`);
  await expectReady(page, '활동');

  const inspector = page.getByRole('complementary', { name: '신호 상세' });
  await expect(inspector).toContainText('변경 기록');
  await expect(inspector).toContainText('접근 권한 검토 기록이 저장됐습니다');
  await expect(inspector).toContainText('변경 기록 상태');
  await expect(inspector).toContainText('변경 당시 업무 상태');
  await expect(inspector).toContainText('감사 참조 연결됨');
  await expect(inspector.getByRole('heading', { name: '감사 무결성 확인' })).toBeVisible();
  await expect(inspector.getByText('보고된 일일 체크포인트와 일치')).toBeVisible();
  await expectNoInventedCommands(inspector);
  await expectVisualQuality(page, '#dwp-main-content');
  await expect(page).toHaveScreenshot(
    'activity-stitch-detail-inline-1280.png',
    screenshotOptions()
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(inspector).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: '신호 상세' })).toBeInViewport();
  await expect(page.getByRole('button', { name: '신호 상세 닫기' })).toBeInViewport();
  await expectNoHorizontalOverflow(page, `/activity/timeline?event=${WORK_EVENT_ID} @ 390`);
  await expectMobileActivityLayout(page, 'detail');
  await expectNoSeriousAxeViolations(page, '.MuiDrawer-paper');
  await expect(page).toHaveScreenshot('activity-stitch-detail-drawer-390.png', screenshotOptions());

  await page.setViewportSize({ width: 320, height: 844 });
  await expect(page.getByRole('heading', { level: 2, name: '신호 상세' })).toBeInViewport();
  await expect(page.getByRole('button', { name: '신호 상세 닫기' })).toBeInViewport();
  await expectNoHorizontalOverflow(page, `/activity/timeline?event=${WORK_EVENT_ID} @ 320`);
  await expect(page).toHaveScreenshot('activity-stitch-detail-drawer-320.png', screenshotOptions());

  await page.keyboard.press('Escape');
  await expect(inspector).toHaveCount(0);
  await expect(page).toHaveURL((url) => !url.searchParams.has('event'));
});

test('DWAI·ON 실행 이력은 최근 응답 범위와 정확한 실행 상세만 표시한다', async ({ page }) => {
  const commonDetailRequests: string[] = [];
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.includes('/api/agent/v1/activity/events/')) commonDetailRequests.push(pathname);
  });
  await page.goto(`/dwaion/activity?run=${COMPLETED_RUN_ID}`);
  await expectReady(page, 'AI 실행 이력');

  const summary = page.getByRole('region', { name: 'AI 실행 상태 요약' });
  await expect(summary).toContainText('조회된 실행');
  await expect(summary.getByTestId('dwaion-sample-summary')).toContainText(
    '1건은 위 운영 수치에서 제외'
  );
  await expect(page.getByText(/\ucd5c근 실행을 최대 100건까지 조회합니다/)).toBeVisible();
  await expect(page.getByRole('list', { name: '최근 조회된 AI 실행' })).toBeVisible();

  const inspector = page.getByRole('complementary', { name: '선택 실행 상세' });
  await expect(inspector).toContainText(COMPLETED_RUN_ID);
  await expect(inspector).toContainText('최근 실행 응답');
  await expect(inspector.getByRole('heading', { name: '실행 단계와 처리 시간' })).toBeVisible();
  await expect(inspector.getByRole('heading', { name: '감사 무결성 확인' })).toBeVisible();
  await expect(inspector.getByRole('button', { name: '대화 열기' })).toBeVisible();
  await expect(inspector.getByRole('complementary', { name: '신호 상세' })).toContainText(
    '결재 요청 요약을 완료했습니다'
  );
  await expect(
    inspector.getByRole('complementary', { name: '신호 상세' }).getByText('에이전트 실행', {
      exact: true,
    })
  ).toBeVisible();
  await expect(
    inspector.getByRole('complementary', { name: '신호 상세' }).getByText('AGENT_RUN', {
      exact: true,
    })
  ).toHaveCount(0);
  await expectNoInventedCommands(inspector);
  await expectVisualQuality(page, '#dwp-main-content');
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(consoleErrors).toEqual([]);
  await expect(page).toHaveScreenshot(
    'activity-stitch-dwaion-detail-1280.png',
    screenshotOptions()
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(inspector).toBeVisible();
  const inspectorHeading = inspector.getByRole('heading', {
    level: 2,
    name: '근거 기반 업무 응답 생성',
  });
  // The Stitch mobile inspector is intentionally a long inline card. Scroll its
  // actionable header into view instead of centering the whole oversized region.
  await inspectorHeading.scrollIntoViewIfNeeded();
  await expect(inspectorHeading).toBeInViewport();
  await expect(inspector.getByRole('button', { name: '선택 실행 닫기' })).toBeInViewport();
  await expectNoHorizontalOverflow(page, `/dwaion/activity?run=${COMPLETED_RUN_ID} @ 390`);
  await expectMobileActivityLayout(page, 'dwaion');
  await expectNoSeriousAxeViolations(page, '[data-testid="dwaion-run-inspector"]');
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(consoleErrors).toEqual([]);
  await expect(page).toHaveScreenshot('activity-stitch-dwaion-detail-390.png', screenshotOptions());

  await page.setViewportSize({ width: 320, height: 844 });
  await inspectorHeading.scrollIntoViewIfNeeded();
  await expect(inspectorHeading).toBeInViewport();
  await expect(inspector.getByRole('button', { name: '선택 실행 닫기' })).toBeInViewport();
  await expectNoHorizontalOverflow(page, `/dwaion/activity?run=${COMPLETED_RUN_ID} @ 320`);
  await expect(page).toHaveScreenshot('activity-stitch-dwaion-detail-320.png', screenshotOptions());

  await page.setViewportSize({ width: 1280, height: 1024 });
  const sampleDisclosure = page.getByRole('button', { name: /개발 검증 데이터/ });
  await expect(sampleDisclosure).toHaveAttribute('aria-expanded', 'false');
  await sampleDisclosure.click();
  const sampleRun = page.getByTestId(`dwaion-run-${SAMPLE_RUN_ID}`);
  await expect(sampleRun).toHaveAttribute('data-run-provenance', 'SAMPLE');
  await expect(sampleRun).toContainText('개발 검증 데이터');
  await sampleRun.click();
  await expect(page.getByRole('complementary', { name: '선택 실행 상세' })).toContainText(
    '공통 활동 집계에서 제외된 검증 실행'
  );
  await expect(page.getByText('이 사건을 표시할 수 없습니다')).toHaveCount(0);
  expect(commonDetailRequests.some((path) => path.endsWith(`/${SAMPLE_RUN_ID}`))).toBe(false);
});

test('홈의 주의 신호에서 필터와 사건 상세까지 키보드로 조사할 수 있다', async ({ page }) => {
  await page.goto('/activity/home');
  await expectReady(page, '활동 홈');
  const needsInput = page.getByRole('link', { name: '입력 필요 2건 보기' });
  await needsInput.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === '/activity/timeline' && url.searchParams.get('state') === 'needs-input'
  );
  const timeline = page.getByRole('list', { name: '워크스페이스 활동' });
  const event = timeline.getByRole('button', { name: /고객 제안서 최종 검토가 필요합니다/ });
  await expect(timeline.getByRole('button')).toHaveCount(1);
  await event.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(
    (url) =>
      url.searchParams.get('event') === INPUT_EVENT_ID &&
      url.searchParams.get('state') === 'needs-input'
  );
  await expect(page.getByRole('complementary', { name: '신호 상세' })).toContainText(
    '고객 제안서 최종 검토가 필요합니다'
  );
  await page.getByRole('button', { name: '신호 상세 닫기' }).click();
  await expect(page).toHaveURL(
    (url) => !url.searchParams.has('event') && url.searchParams.get('state') === 'needs-input'
  );
  await expect(event).toBeFocused();
});

const qualitySurfaces = [
  { key: 'flow', route: '/', heading: /.+/u, englishHeading: /.+/u },
  { key: 'home', route: '/activity/home', heading: '활동 홈', englishHeading: 'Activity home' },
  { key: 'timeline', route: '/activity/timeline', heading: '활동', englishHeading: 'Activity' },
  {
    key: 'detail',
    route: `/activity/timeline?event=${WORK_EVENT_ID}`,
    heading: '활동',
    englishHeading: 'Activity',
  },
  {
    key: 'dwaion',
    route: `/dwaion/activity?run=${COMPLETED_RUN_ID}`,
    heading: 'AI 실행 이력',
    englishHeading: 'AI run activity',
  },
] as const;

test('Flow 실행 신호는 현재 분포를 설명하고 소유된 활동 이력으로 연결한다', async ({
  page,
}, testInfo) => {
  await mockFlowExperience(page);
  await page.goto('/');
  await expectReady(page, /.+/u);
  const trigger = page.getByTestId('flow-activity-signal-trigger');
  const originalTrigger = await trigger.elementHandle();
  if (!originalTrigger) throw new Error('Flow execution signal trigger was not attached.');
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: '실행 신호', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('입력 필요 2건 · 정책 차단 1건');
  await expect(dialog).toContainText('현재 실행 스냅샷');
  await expectNoInventedCommands(dialog);
  await expectVisualQuality(page, '.MuiDialog-paper');
  await expect(dialog).toHaveScreenshot(
    'activity-stitch-flow-signals-1280.png',
    screenshotOptions()
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: '실행 신호 닫기' })).toBeInViewport();
  await expectNoHorizontalOverflow(page, 'Flow execution signals @ 390');
  await expectMobileActivityLayout(page, 'flow');
  await expect(dialog).toHaveScreenshot(
    'activity-stitch-flow-signals-390.png',
    screenshotOptions()
  );
  await testInfo.attach('flow-trigger-responsive-continuity', {
    contentType: 'application/json',
    body: JSON.stringify(
      await originalTrigger.evaluate((element) => ({
        connected: element.isConnected,
        same: element === document.querySelector('[data-testid="flow-activity-signal-trigger"]'),
      }))
    ),
  });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  try {
    await expect(trigger).toBeFocused();
  } catch (error) {
    await testInfo.attach('flow-focus-restore-diagnostic', {
      contentType: 'application/json',
      body: JSON.stringify(
        await page.evaluate(() => ({
          activeElement: document.activeElement?.outerHTML.slice(0, 2000),
          trigger: document.querySelector('[data-testid="flow-activity-signal-trigger"]')
            ?.outerHTML,
          documentFocused: document.hasFocus(),
        }))
      ),
    });
    throw error;
  }
  await trigger.click();
  await dialog.locator('a[href="/activity/timeline?state=needs-input"]').click();
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === '/activity/timeline' && url.searchParams.get('state') === 'needs-input'
  );
  await expect(page.getByRole('list', { name: '워크스페이스 활동' })).toContainText(
    '고객 제안서 최종 검토가 필요합니다'
  );
});

for (const profile of ['light-ko', 'dark-en', 'forced-colors-ko', 'enlarged-text-ko'] as const) {
  test(`품질 매트릭스 ${profile}: 원본 4개 화면과 활동 홈이 1440·1280·390·320px에서 접근 가능하다`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    const english = profile === 'dark-en';
    const dark = profile === 'dark-en';
    await mockShellSession(page, ['WORKSPACE_MEMBER'], {
      locale: english ? 'en' : 'ko',
      displayName: english
        ? 'Alexandra Montgomery — Enterprise Operations'
        : '김민아 · 글로벌 엔터프라이즈 운영 담당자',
      appearance: {
        mode: dark ? 'dark' : 'light',
        density: 'standard',
        highContrast: profile === 'dark-en' || profile === 'forced-colors-ko',
        reduceMotion: true,
      },
    });
    await mockActivityContracts(page);
    await mockFlowExperience(page);
    await page.emulateMedia({
      colorScheme: dark ? 'dark' : 'light',
      forcedColors: profile === 'forced-colors-ko' ? 'active' : 'none',
      reducedMotion: 'reduce',
    });

    for (const surface of qualitySurfaces) {
      await page.setViewportSize({ width: 1440, height: 1024 });
      await page.goto(surface.route);
      await expectReady(page, english ? surface.englishHeading : surface.heading);
      if (profile === 'enlarged-text-ko') {
        // Root-font scaling is distinct from the opt-in native 200% browser zoom test.
        await page.evaluate(() => {
          document.documentElement.style.fontSize = '200%';
        });
      }
      if (surface.key === 'flow') {
        await expect(page.locator('[data-home-role-lens="activity-attention"]')).toContainText(
          english ? '2 need input · 1 policy blocked' : '입력 필요 2건 · 정책 차단 1건'
        );
        await page.getByTestId('flow-activity-signal-trigger').click();
        await expect(page.getByTestId('flow-activity-signal-panel')).toBeVisible();
        await expect(page.getByTestId('flow-activity-distribution')).toHaveAttribute(
          'aria-label',
          /.+/u
        );
      }
      for (const width of [1440, 1280, 390, 320]) {
        await page.setViewportSize({ width, height: width < 600 ? 844 : 1024 });
        await expectNoHorizontalOverflow(page, `${surface.key} ${profile} @ ${width}`);
        if (surface.key === 'flow') {
          await expect(
            page.getByRole('button', {
              name: english ? 'Close execution signals' : '실행 신호 닫기',
              exact: true,
            })
          ).toBeInViewport();
        }
        const inspector =
          surface.key === 'dwaion'
            ? page.getByRole('complementary', {
                name: english ? 'Selected run details' : '선택 실행 상세',
                exact: true,
              })
            : surface.key === 'detail'
              ? page.getByRole('complementary', {
                  name: english ? 'Signal detail' : '신호 상세',
                  exact: true,
                })
              : null;
        if (inspector) await expect(inspector).toBeVisible();
        await page.screenshot({
          path: testInfo.outputPath(`activity-quality-${surface.key}-${profile}-${width}.png`),
          animations: 'disabled',
          fullPage: true,
        });
        if (width === 1440 || width === 320) {
          await expectNoSeriousAxeViolations(
            page,
            surface.key === 'flow'
              ? '.MuiDialog-paper'
              : inspector && width === 320
                ? '.MuiDrawer-paper'
                : '#dwp-main-content'
          );
        }
      }
    }
  });
}

for (const surface of qualitySurfaces) {
  test(`작은 모바일 320×568 ${surface.key}: 첫 작업과 닫기 제어가 보인다`, async ({
    page,
  }, testInfo) => {
    await mockFlowExperience(page);
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto(surface.key === 'dwaion' ? '/dwaion/activity' : surface.route);
    if (surface.key === 'detail') {
      await expect(page.getByRole('complementary', { name: '신호 상세' })).toBeVisible();
      await page.evaluate(() => document.fonts.ready.then(() => true));
    } else {
      await expectReady(page, surface.heading);
    }
    if (surface.key === 'flow') await page.getByTestId('flow-activity-signal-trigger').click();
    await page.screenshot({
      path: testInfo.outputPath(`integrated-${surface.key}-320x568.png`),
      animations: 'disabled',
    });
    await expectNoHorizontalOverflow(page, `${surface.key} @ 320×568`);
    if (surface.key === 'flow') {
      await expectMobileActivityLayout(page, 'flow');
      await expect(page.getByRole('button', { name: '실행 신호 닫기' })).toBeInViewport();
      await expect(page.getByText('Flow 확인 필요', { exact: true })).toBeInViewport();
    } else if (surface.key === 'detail') {
      await expect(page.getByRole('button', { name: '신호 상세 닫기' })).toBeInViewport();
      await expect(
        page
          .getByRole('complementary')
          .getByText('접근 권한 검토 기록이 저장됐습니다', { exact: true })
      ).toBeInViewport();
    } else if (surface.key === 'timeline') {
      await expectMobileActivityLayout(page, 'timeline');
      await expect(
        page
          .getByRole('list', { name: '워크스페이스 활동' })
          .getByText('월간 운영 리스크를 분석하고 있습니다', { exact: true })
      ).toBeInViewport();
    } else if (surface.key === 'dwaion') {
      await expect(
        page
          .getByTestId(`dwaion-run-${RUNNING_RUN_ID}`)
          .getByRole('heading', { name: '운영 리스크 근거 수집' })
      ).toBeInViewport();
      const summary = page.getByRole('region', { name: 'AI 실행 상태 요약' });
      const attention = summary.getByRole('button', { name: /^확인 신호:/u });
      await expect(attention).toBeVisible();
      expect((await attention.boundingBox())?.height).toBeGreaterThanOrEqual(44);
      await attention.focus();
      await page.keyboard.press('Enter');
      await expect(
        page.getByRole('list', { name: '최근 조회된 AI 실행' }).getByRole('button')
      ).toHaveCount(2);
    } else {
      await expect(
        page.getByRole('region', { name: '활동 상태 요약' }).getByText('12', { exact: true })
      ).toBeInViewport();
    }
  });
}

// Opt-in real browser zoom; ordinary 15-test baseline runs remain unchanged.
// A disposable extension controls Chromium's tab zoom, not document/CSS scaling.
if (process.env.E2E_BROWSER_ZOOM_EXTENSION) {
  test('브라우저 실제 200% 확대에서도 활동 4개 표면과 홈을 조사할 수 있다', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    await page.close();
    const extension = process.env.E2E_BROWSER_ZOOM_EXTENSION!;
    const {
      context,
      page: zoomPage,
      setZoom,
      setPhysicalViewport,
      captureViewport,
    } = await createBrowserZoomSession(
      extension,
      process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4223'
    );
    try {
      await zoomPage.clock.setFixedTime(FIXED_NOW);
      await zoomPage.emulateMedia({ reducedMotion: 'reduce' });
      await mockShellSession(zoomPage, ['WORKSPACE_MEMBER'], {
        locale: 'ko',
        displayName: '김민아',
      });
      await mockActivityContracts(zoomPage);
      await mockFlowExperience(zoomPage);
      for (const physicalWidth of [1280, 640]) {
        await setPhysicalViewport(physicalWidth, 1024);
        for (const surface of qualitySurfaces) {
          await zoomPage.goto(surface.route);
          const reportedZoom = await setZoom(2);
          expect(reportedZoom).toBe(2);
          await expect
            .poll(() => zoomPage.evaluate(() => window.innerWidth))
            .toBe(physicalWidth / 2);
          await expect(zoomPage.locator('.MuiSkeleton-root')).toHaveCount(0);
          if (surface.key === 'flow')
            await zoomPage.getByTestId('flow-activity-signal-trigger').click();
          const inspector =
            surface.key === 'flow'
              ? '.MuiDialog-paper'
              : ['detail', 'dwaion'].includes(surface.key)
                ? '.MuiDrawer-paper'
                : '#dwp-main-content';
          await expect(zoomPage.locator(inspector)).toBeVisible();
          await zoomPage.evaluate(() => document.fonts.ready.then(() => true));
          const metrics = await zoomPage.evaluate(() => ({
            width: innerWidth,
            height: innerHeight,
            dpr: devicePixelRatio,
            scrollY,
            cssZoom: getComputedStyle(document.documentElement).zoom,
            rootFontSize: getComputedStyle(document.documentElement).fontSize,
          }));
          expect(metrics).toMatchObject({
            width: physicalWidth / 2,
            dpr: 2,
            cssZoom: '1',
            rootFontSize: '16px',
          });
          await testInfo.attach(`browser-zoom-${surface.key}-${physicalWidth}`, {
            contentType: 'application/json',
            body: JSON.stringify({ reportedZoom, ...metrics }),
          });
          await expectVisualQuality(zoomPage, inspector);
          await captureViewport(
            testInfo.outputPath(`browser-native-zoom200-${surface.key}-${physicalWidth}.png`)
          );
          if (surface.key === 'flow' || surface.key === 'detail' || surface.key === 'dwaion') {
            const label =
              surface.key === 'flow'
                ? '실행 신호 닫기'
                : surface.key === 'detail'
                  ? '신호 상세 닫기'
                  : '선택 실행 닫기';
            await expect(zoomPage.getByRole('button', { name: label })).toBeInViewport();
            await zoomPage.keyboard.press('Escape');
            await expect(zoomPage.locator(inspector)).toHaveCount(0);
          } else {
            const action =
              surface.key === 'home'
                ? zoomPage.getByRole('link', { name: '입력 필요 2건 보기' })
                : zoomPage
                    .getByRole('list', { name: '워크스페이스 활동' })
                    .getByRole('button')
                    .first();
            await action.focus();
            await expect(action).toBeFocused();
            await zoomPage.keyboard.press('Enter');
            await expect(zoomPage).toHaveURL((url) =>
              surface.key === 'home'
                ? url.searchParams.get('state') === 'needs-input'
                : url.searchParams.has('event')
            );
          }
        }
      }
    } finally {
      await context.close();
    }
  });
}

async function expectReady(page: Page, heading: string | RegExp) {
  await expect(page.locator('#dwp-main-content')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator('.MuiSkeleton-root')).toHaveCount(0, { timeout: 15_000 });
  await page.evaluate(() => document.fonts.ready.then(() => true));
}

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow, `${label}에 수평 오버플로가 있습니다.`).toBeLessThanOrEqual(1);
}

async function expectNoSeriousAxeViolations(page: Page, selector: string) {
  const effectiveSelector =
    (await page.locator(selector).count()) > 0 ? selector : '#dwp-main-content';
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await new AxeBuilder({ page }).include(effectiveSelector).analyze();
      expect(
        result.violations.filter(
          (violation) => violation.impact === 'critical' || violation.impact === 'serious'
        )
      ).toEqual([]);
      return;
    } catch (error) {
      if (attempt > 0 || !String(error).includes('Execution context was destroyed')) throw error;
      // A concurrently rebuilt Vite test server can reload between axe injection and analysis.
      // The route mocks survive the reload, so wait for the same governed surface and retry once.
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator(effectiveSelector)).toBeVisible({ timeout: 15_000 });
    }
  }
}

async function expectVisualQuality(page: Page, selector: string) {
  await expectNoHorizontalOverflow(page, page.url());
  await expectNoSeriousAxeViolations(page, selector);
}
