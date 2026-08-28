import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  FULL_PRODUCT_PERMISSIONS,
  HOME_COMMUNICATIONS_FIXTURE,
  createHomeOverviewFixture,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';
import { APPROVAL_HOME_FIXTURE, HR_HOME_FIXTURE } from './support/product-area-fixtures';

test.describe.configure({ mode: 'serial' });

const FLOW_VISUAL_NOW = new Date('2026-08-11T00:30:00.000Z');

const FLOW_PERMISSIONS = [
  ...FULL_PRODUCT_PERMISSIONS,
  {
    resourceType: 'APP',
    resourceKey: 'APP.NOTIFICATIONS',
    permissionCode: 'VIEW',
    effect: 'ALLOW' as const,
  },
  {
    resourceType: 'APP',
    resourceKey: 'APP.MESSAGING',
    permissionCode: 'VIEW',
    effect: 'ALLOW' as const,
  },
];

const FLOW_POLICY = {
  schemaVersion: 3,
  experienceVariant: 'FLOW_V1',
  personalCustomizationEnabled: true,
  governedZones: [
    {
      zoneKey: 'announcements',
      placement: 'CANVAS',
      visible: true,
      size: 'full',
      height: 'short',
      sortOrder: 20,
    },
  ],
};

const canonicalWidgets = [
  { widgetKey: 'command-rail', visible: true, size: 'large', height: 'standard' },
  { widgetKey: 'schedule', visible: true, size: 'compact', height: 'standard' },
  { widgetKey: 'daily-brief', visible: true, size: 'compact', height: 'standard' },
  { widgetKey: 'focus', visible: true, size: 'compact', height: 'standard' },
  { widgetKey: 'activity', visible: true, size: 'compact', height: 'standard' },
] as const;

function flowExperience(
  overrides: Partial<{
    backgroundPosition: 'LEFT' | 'CENTER' | 'RIGHT';
    overlayOpacity: number;
    backgroundUrl: string | null;
  }> = {}
) {
  return {
    headline: null,
    subheadline: null,
    localizedContent: {},
    defaultLocale: 'ko',
    backgroundPosition: 'RIGHT',
    overlayOpacity: 18,
    backgroundUrl: null,
    launchpadConfiguration: { schemaVersion: 1, groups: [], placements: [] },
    compositionPolicy: FLOW_POLICY,
    effectiveExperienceVariant: 'FLOW_V1',
    advancedPersonalizationEnabled: false,
    composerEnabled: false,
    homePreferenceStore: 'LEGACY',
    version: 7,
    ...overrides,
  };
}

function flowOverview(roles: readonly string[] = ['WORKSPACE_MEMBER']) {
  const overview = createHomeOverviewFixture(roles);
  const generatedAt = FLOW_VISUAL_NOW.toISOString();
  return {
    ...overview,
    work: { ...overview.work, generatedAt, data: { ...overview.work.data, generatedAt } },
    calendar: {
      ...overview.calendar,
      generatedAt,
      data: { ...overview.calendar.data, generatedAt },
    },
    communications: {
      status: 'AVAILABLE' as const,
      source: 'DWP_COMMUNICATIONS',
      generatedAt,
      data: { ...HOME_COMMUNICATIONS_FIXTURE, generatedAt },
      reason: null,
    },
    activity: {
      ...overview.activity,
      generatedAt,
      data: { ...overview.activity.data, generatedAt },
    },
    recommendationSection: { ...overview.recommendationSection, generatedAt },
    generatedAt,
  };
}

function longKoreanFlowOverview(roles: readonly string[] = ['WORKSPACE_MEMBER']) {
  const overview = flowOverview(roles);
  const workTitles = [
    '해외 고객 데이터 이전을 위한 보안 예외 승인 요청을 오늘 안에 검토해 주세요',
    '신규 입사자 프로젝트 접근 권한과 필수 라이선스 범위를 최종 확인해 주세요',
    '분기 운영 리스크 브리핑 자료의 미확정 질문과 담당자를 점검해 주세요',
  ];
  const communicationTitles = [
    '생성형 AI를 활용한 협업 방식 전환과 안전한 업무 자동화 운영 원칙 안내',
    '지역 사회와 함께하는 친환경 캠퍼스 주간 프로그램 참여 방법을 확인하세요',
    '분산 근무 환경에서 고객 정보와 회사 자산을 보호하는 보안 점검 안내',
  ];
  const recommendations = overview.recommendations.map((recommendation) => ({
    ...recommendation,
    title: '마감이 임박한 핵심 업무와 선행 의사결정 항목을 먼저 검토해 주세요',
    description:
      '여러 업무 앱에서 수집된 우선순위와 마감 정보를 기준으로 지금 처리할 항목을 정리했습니다.',
  }));
  const today = overview.calendar.data.today.map((event, index) => ({
    ...event,
    title:
      index === 0
        ? '디지털 워크플레이스 운영 안정화와 다음 분기 우선순위 정렬 회의'
        : '집중 업무 시간을 보호하기 위한 고객 제안서 최종 검토',
    description: '관련 부서의 결정 사항과 후속 실행 책임자를 함께 확인합니다.',
  }));

  return {
    ...overview,
    work: {
      ...overview.work,
      data: {
        ...overview.work.data,
        items: overview.work.data.items.map((item, index) => ({
          ...item,
          title: workTitles[index] ?? item.title,
          summary:
            index < workTitles.length
              ? '업무 영향 범위와 남은 의사결정 사항을 확인하고 담당자에게 결과를 공유해 주세요.'
              : item.summary,
        })),
      },
    },
    calendar: {
      ...overview.calendar,
      data: {
        ...overview.calendar.data,
        nextEvent: today[0] ?? overview.calendar.data.nextEvent,
        today,
        attention: overview.calendar.data.attention.map((item) => ({
          ...item,
          title: '회의실 확정 전에 참석 여부를 회신해야 하는 일정이 있습니다',
          description: '주최자가 최종 참석자와 장소를 확정할 수 있도록 응답해 주세요.',
        })),
      },
    },
    communications: {
      ...overview.communications,
      data: {
        ...overview.communications.data,
        featured: {
          ...overview.communications.data.featured,
          title: '전사 리더십 대화에서 공유된 주요 질문과 후속 실행 계획을 확인하세요',
          summary:
            '구성원이 가장 많이 질문한 주제와 경영진 답변, 다음 분기 실행 방향을 한눈에 정리했습니다.',
          publisherName: '대표이사실',
        },
        items: overview.communications.data.items.map((item, index) => ({
          ...item,
          title: communicationTitles[index] ?? item.title,
          summary:
            '업무에 바로 적용할 수 있는 핵심 내용과 필요한 후속 행동을 간결하게 확인해 보세요.',
          publisherName: index === 0 ? '디지털 워크플레이스팀' : '기업문화팀',
        })),
      },
    },
    recommendations,
    recommendationSection: {
      ...overview.recommendationSection,
      data: recommendations,
    },
  };
}

function longKoreanApprovalHome() {
  return {
    ...APPROVAL_HOME_FIXTURE,
    focusQueue: APPROVAL_HOME_FIXTURE.focusQueue.map((task) => ({
      ...task,
      title: '고객 데이터 분석 환경의 한시적 접근 권한과 보안 예외 승인 요청',
      summary: '운영 장애 분석을 위한 최소 권한 범위와 종료 시점을 검토해 주세요.',
      stepName: '정보보호 검토 및 최종 승인',
    })),
    recentRequests: APPROVAL_HOME_FIXTURE.recentRequests.map((request) => ({
      ...request,
      title: '글로벌 협업 프로젝트 외부 참여자 초대 및 자료 공유 승인 요청',
      summary: '외부 참여 범위와 자료 분류 기준을 확인한 뒤 후속 조치를 결정해 주세요.',
      currentStepName: '업무 책임자 검토 단계',
    })),
  };
}

async function mockFlowHome(
  page: Page,
  presentation: 'focused' | 'balanced' | 'expressive',
  experienceOverrides: Parameters<typeof flowExperience>[0] = {},
  visualOptions: Readonly<{
    colorScheme?: 'light' | 'dark';
    forcedColors?: 'active' | 'none';
    roles?: readonly string[];
    longKoreanContent?: boolean;
    preferenceGate?: Promise<void>;
  }> = {}
) {
  const colorScheme = visualOptions.colorScheme ?? 'light';
  const roles = visualOptions.roles ?? ['WORKSPACE_MEMBER'];
  await page.emulateMedia({
    reducedMotion: 'reduce',
    colorScheme,
    forcedColors: visualOptions.forcedColors ?? 'none',
  });
  await page.clock.setFixedTime(FLOW_VISUAL_NOW);
  await mockShellSession(page, roles, {
    locale: 'ko',
    displayName: '김미나',
    jobTitle: '디지털 워크플레이스 담당자',
    permissions: FLOW_PERMISSIONS,
    appearance: {
      mode: colorScheme,
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
  await page.route('**/api/platform/v1/home-experience', (route) =>
    fulfillSuccess(route, flowExperience(experienceOverrides))
  );
  await page.route('**/api/platform/v1/home/overview**', (route) =>
    fulfillSuccess(
      route,
      visualOptions.longKoreanContent ? longKoreanFlowOverview(roles) : flowOverview(roles)
    )
  );
  await page.route('**/api/platform/v1/home-preferences**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() !== 'GET' || !path.endsWith('/home-preferences')) {
      return route.fallback();
    }
    await visualOptions.preferenceGate;
    return fulfillSuccess(route, {
      schemaVersion: 5,
      surfaceKey: 'workspace-home',
      customized: presentation === 'expressive',
      layout: {
        appLayout: null,
        presentation,
        widgets: canonicalWidgets,
      },
      version: 3,
    });
  });
  await page.route('**/api/platform/v1/workplace/bookings**', (route) => fulfillSuccess(route, []));
  await page.route(/\/api\/approvals\/v1\/home(?:\?|$)/u, (route) =>
    fulfillSuccess(route, {
      ...(visualOptions.longKoreanContent ? longKoreanApprovalHome() : APPROVAL_HOME_FIXTURE),
      generatedAt: FLOW_VISUAL_NOW.toISOString(),
    })
  );
  await page.route('**/api/people/v1/hr/home', (route) =>
    fulfillSuccess(route, { ...HR_HOME_FIXTURE, generatedAt: FLOW_VISUAL_NOW.toISOString() })
  );
  await page.route('**/api/platform/v1/services/requests', (route) => fulfillSuccess(route, []));
  await page.route('**/api/notifications/v1/summary/by-app', (route) =>
    fulfillSuccess(route, {
      partial: false,
      unavailableSources: [],
      apps: [
        {
          appKey: 'approvals',
          totalUnread: 7,
          actionableUnread: 3,
          urgentUnread: 1,
          lastActivityAt: FLOW_VISUAL_NOW.toISOString(),
        },
        {
          appKey: 'messaging',
          totalUnread: 4,
          actionableUnread: 1,
          urgentUnread: 0,
          lastActivityAt: FLOW_VISUAL_NOW.toISOString(),
        },
      ],
      changeVersion: '11',
      counterVersion: '11',
      generatedAt: FLOW_VISUAL_NOW.toISOString(),
    })
  );
}

async function emulateReducedTransparency(page: Page, colorScheme: 'light' | 'dark') {
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setEmulatedMedia', {
    media: '',
    features: [
      { name: 'prefers-color-scheme', value: colorScheme },
      { name: 'prefers-reduced-motion', value: 'reduce' },
      { name: 'prefers-reduced-transparency', value: 'reduce' },
    ],
  });
}

async function waitForVisualState(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => {
    // Vite's development-only checker is verified by the independent type and
    // lint gates. It must not become part of the product visual contract when
    // another local task is compiling in the shared workspace.
    document.querySelectorAll('vite-plugin-checker-error-overlay').forEach((overlay) => {
      overlay.remove();
    });
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images).map(async (image) => {
        if (!image.complete) {
          await new Promise<void>((resolve) => {
            image.addEventListener('load', () => resolve(), { once: true });
            image.addEventListener('error', () => resolve(), { once: true });
          });
        }
        await image.decode().catch(() => undefined);
      })
    );
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    (document.activeElement as HTMLElement | null)?.blur();
    window.scrollTo(0, 0);
  });

  const launcher = page.getByTestId('dwaion-launcher');
  await expect(launcher).toBeVisible();
  await expect
    .poll(
      async () => {
        const first = await launcher.boundingBox();
        await page.waitForTimeout(100);
        const second = await launcher.boundingBox();
        return JSON.stringify(first) === JSON.stringify(second);
      },
      { timeout: 5_000, message: 'DWAI launcher fixed position should settle before capture' }
    )
    .toBe(true);
  const [bounds, viewport] = await Promise.all([launcher.boundingBox(), page.viewportSize()]);
  expect(bounds).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (!bounds || !viewport) return;
  if (viewport.width < 900) {
    expect(bounds.width).toBeCloseTo(44, 0);
    expect(bounds.height).toBeCloseTo(44, 0);
    await expect(launcher).toHaveCSS('position', 'relative');
    await expect(launcher).toHaveAttribute('data-shell-auxiliary-placement', 'header');
    return;
  }
  expect(bounds.width).toBeCloseTo(56, 0);
  expect(bounds.height).toBeCloseTo(56, 0);
  expect(viewport.width - bounds.x - bounds.width).toBeCloseTo(24, 0);
  expect(viewport.height - bounds.y - bounds.height).toBeCloseTo(24, 0);
  await expect(launcher).toHaveCSS('position', 'fixed');
  await expect(launcher).toHaveAttribute('data-shell-auxiliary-placement', 'floating');
}

async function expectDwaionClearOfHomeActions(page: Page) {
  const launcher = page.getByTestId('dwaion-launcher');
  const placement = await launcher.getAttribute('data-shell-auxiliary-placement');
  // Compact launchers live inside the opaque shell header. Main content can
  // geometrically pass behind that fixed layer while remaining neither visible
  // nor interactive, so collision geometry only applies to the floating mode.
  if (placement !== 'floating') return;
  const scrollRange = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight
  );
  const scrollPositions = [...new Set([0, 0.33, 0.66, 1].map((ratio) => scrollRange * ratio))];

  for (const top of scrollPositions) {
    await page.evaluate(async (scrollTop) => {
      window.scrollTo(0, scrollTop);
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
    }, top);
    const geometry = await page.evaluate(() => {
      const launcher = document.querySelector<HTMLElement>('[data-testid="dwaion-launcher"]');
      if (!launcher) return { launcher: null, collisions: ['launcher missing'] };
      const launcherRect = launcher.getBoundingClientRect();
      const clearance = 8;
      const collisions = Array.from(
        document.querySelectorAll<HTMLElement>('#dwp-main-content a, #dwp-main-content button')
      )
        .filter((element) => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return (
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            rect.width > 0 &&
            rect.height > 0 &&
            rect.bottom > 0 &&
            rect.top < window.innerHeight
          );
        })
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return !(
            rect.right <= launcherRect.left - clearance ||
            rect.left >= launcherRect.right + clearance ||
            rect.bottom <= launcherRect.top - clearance ||
            rect.top >= launcherRect.bottom + clearance
          );
        })
        .map(
          (element) =>
            element.getAttribute('aria-label') ||
            element.getAttribute('data-home-contribution') ||
            element.textContent?.trim().slice(0, 60) ||
            element.tagName
        );
      return {
        launcher: {
          left: launcherRect.left,
          right: launcherRect.right,
          top: launcherRect.top,
          bottom: launcherRect.bottom,
        },
        collisions,
      };
    });
    expect(geometry.launcher).not.toBeNull();
    expect(geometry.collisions, `DWAI collision at scrollTop ${Math.round(top)}`).toEqual([]);
  }

  await page.evaluate(() => window.scrollTo(0, 0));
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
      )
    )
    .toBe(true);
}

async function expectRoleMetricLabelsReadable(flowHome: Locator) {
  const roleLabels = await flowHome
    .locator('[data-home-role-label], [data-home-role-comparison]')
    .evaluateAll((labels) =>
      labels.map((label) => {
        const element = label as HTMLElement;
        return {
          text: element.textContent?.trim() ?? '',
          whiteSpace: window.getComputedStyle(element).whiteSpace,
          clippedHorizontally: element.scrollWidth > element.clientWidth + 1,
          clippedVertically: element.scrollHeight > element.clientHeight + 1,
        };
      })
    );
  expect(roleLabels).toHaveLength(8);
  expect(
    roleLabels.every(
      (label) => label.text.length > 1 && !label.clippedHorizontally && !label.clippedVertically
    ),
    JSON.stringify(roleLabels)
  ).toBe(true);
}

async function expectDesktopPurposeComposition(
  flowHome: Locator,
  template: 'standard' | 'adaptive-wide' = 'standard'
) {
  const stage = flowHome.getByTestId('flow-home-personal-sections');
  await expect(stage).toHaveAttribute('data-flow-layout-contract', 'purpose-widgets');
  await expect(stage.locator('[data-workspace-widget="action-queue"]')).toHaveAttribute(
    'data-workspace-widget-size',
    'large'
  );
  for (const key of ['today', 'response-hub', 'request-tracker', 'role-pulse']) {
    await expect(stage.locator(`[data-workspace-widget="${key}"]`)).toHaveAttribute(
      'data-workspace-widget-size',
      'compact'
    );
  }

  const geometry = await stage.evaluate((root) => {
    const rect = (key: string) => {
      const node = root.querySelector<HTMLElement>(`[data-workspace-widget="${key}"]`)!;
      const bounds = node.getBoundingClientRect();
      return {
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
        bottom: bounds.bottom,
        width: bounds.width,
      };
    };
    return {
      action: rect('action-queue'),
      today: rect('today'),
      response: rect('response-hub'),
      request: rect('request-tracker'),
      pulse: rect('role-pulse'),
    };
  });
  if (template === 'adaptive-wide') {
    await expect(stage).toHaveAttribute('data-flow-read-template', 'adaptive-wide');
    await expect(stage).toHaveAttribute('data-flow-adaptive-applied', 'true');
    await expect(stage).toHaveAttribute('data-flow-wide-composition', '7-5/4-4-4');
    expect(Math.abs(geometry.action.top - geometry.today.top)).toBeLessThanOrEqual(2);
    expect(Math.abs(geometry.action.bottom - geometry.today.bottom)).toBeLessThanOrEqual(2);
    expect(geometry.action.width / geometry.today.width).toBeGreaterThan(1.36);
    expect(geometry.action.width / geometry.today.width).toBeLessThan(1.44);
    expect(geometry.response.width / geometry.today.width).toBeGreaterThan(0.77);
    expect(geometry.response.width / geometry.today.width).toBeLessThan(0.83);
    expect(geometry.response.top).toBeGreaterThanOrEqual(
      Math.max(geometry.action.bottom, geometry.today.bottom)
    );
    expect(Math.abs(geometry.response.top - geometry.request.top)).toBeLessThanOrEqual(2);
    expect(Math.abs(geometry.request.top - geometry.pulse.top)).toBeLessThanOrEqual(2);
    expect(Math.abs(geometry.response.bottom - geometry.request.bottom)).toBeLessThanOrEqual(2);
    expect(Math.abs(geometry.request.bottom - geometry.pulse.bottom)).toBeLessThanOrEqual(2);
    expect(geometry.request.left).toBeGreaterThanOrEqual(geometry.response.right);
    expect(geometry.pulse.left).toBeGreaterThanOrEqual(geometry.request.right);
    return;
  }
  expect(Math.abs(geometry.action.top - geometry.today.top)).toBeLessThanOrEqual(2);
  expect(Math.abs(geometry.action.bottom - geometry.today.bottom)).toBeLessThanOrEqual(2);
  expect(geometry.action.width / geometry.today.width).toBeGreaterThan(1.9);
  expect(Math.abs(geometry.response.top - geometry.request.top)).toBeLessThanOrEqual(2);
  expect(Math.abs(geometry.request.top - geometry.pulse.top)).toBeLessThanOrEqual(2);
  expect(Math.abs(geometry.response.bottom - geometry.request.bottom)).toBeLessThanOrEqual(2);
  expect(Math.abs(geometry.request.bottom - geometry.pulse.bottom)).toBeLessThanOrEqual(2);
  expect(Math.abs(geometry.response.width - geometry.request.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(geometry.request.width - geometry.pulse.width)).toBeLessThanOrEqual(2);
}

const WORKSCAPE_VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 320, height: 760 },
] as const;

const WORKSCAPE_POSITIONS = ['LEFT', 'CENTER', 'RIGHT'] as const;
const WORKSCAPE_SCHEMES = ['light', 'dark'] as const;
const WORKSCAPE_PHOTO = '/media/communications/workplace-improvement.jpg';

for (const viewport of WORKSCAPE_VIEWPORTS) {
  for (const backgroundPosition of WORKSCAPE_POSITIONS) {
    for (const colorScheme of WORKSCAPE_SCHEMES) {
      test(`Workscape matrix ${viewport.width} ${backgroundPosition} ${colorScheme}`, async ({
        page,
      }, testInfo) => {
        test.skip(testInfo.project.name !== 'chromium', 'The full matrix is captured in Chromium.');
        await page.setViewportSize(viewport);
        await mockFlowHome(
          page,
          viewport.width >= 1600 ? 'expressive' : 'balanced',
          {
            backgroundUrl: WORKSCAPE_PHOTO,
            backgroundPosition,
            overlayOpacity: 24,
          },
          { colorScheme }
        );

        await page.goto('/');
        const flowHome = page.getByTestId('flow-home');
        const workscape = flowHome.locator('[data-flow-workscape]');
        await expect(workscape).toHaveAttribute(
          'data-tenant-background-position',
          backgroundPosition.toLowerCase()
        );
        await expect(workscape).toHaveAttribute(
          'data-tenant-background-focal-x',
          backgroundPosition === 'LEFT' ? '0' : backgroundPosition === 'CENTER' ? '50' : '100'
        );
        await expect(workscape).toHaveAttribute(
          'data-tenant-content-alignment',
          backgroundPosition === 'LEFT'
            ? 'right'
            : backgroundPosition === 'CENTER'
              ? 'center'
              : 'left'
        );
        await expect(workscape).toHaveAttribute('data-tenant-image-opacity', '1');
        await expect(workscape.locator('[data-flow-health-strip]')).toHaveCount(0);
        await expectNoHorizontalOverflow(page);
        await waitForVisualState(page);

        const contract = await workscape.evaluate((surface) => {
          const frame = surface.querySelector<HTMLElement>('[data-flow-launch-deck-frame]')!;
          const copy = surface.querySelector<HTMLElement>('[data-flow-context-copy]')!;
          const dock = surface.querySelector<HTMLElement>('[data-flow-dock-shell]')!;
          const frameBounds = frame.getBoundingClientRect();
          const copyBounds = copy.getBoundingClientRect();
          const dockBounds = dock.getBoundingClientRect();
          const targets = Array.from(surface.querySelectorAll<HTMLElement>('button')).map(
            (target) => {
              const bounds = target.getBoundingClientRect();
              return { width: bounds.width, height: bounds.height };
            }
          );
          const appLabels = Array.from(
            surface.querySelectorAll<HTMLElement>(
              '[data-flow-dock-item] button .MuiTypography-root'
            )
          ).map((label) => ({
            text: label.textContent?.trim() ?? '',
            clipped: label.scrollWidth > label.clientWidth + 1,
          }));
          const appItemBounds = Array.from(
            surface.querySelectorAll<HTMLElement>('[data-flow-dock-item] button')
          ).map((item) => {
            const bounds = item.getBoundingClientRect();
            return {
              left: bounds.left,
              right: bounds.right,
              top: bounds.top,
              bottom: bounds.bottom,
            };
          });
          const groupLabels = Array.from(
            surface.querySelectorAll<HTMLElement>('[data-flow-dock-group] > .MuiTypography-root')
          )
            .filter((label) => window.getComputedStyle(label).display !== 'none')
            .map((label) => {
              const bounds = label.getBoundingClientRect();
              return {
                text: label.textContent?.trim() ?? '',
                clipped: label.scrollWidth > label.clientWidth + 1,
                bounds: {
                  left: bounds.left,
                  right: bounds.right,
                  top: bounds.top,
                  bottom: bounds.bottom,
                },
              };
            });
          const dockAction = surface
            .querySelector<HTMLElement>('[data-flow-dock-action]')!
            .getBoundingClientRect();
          return {
            frame: {
              left: frameBounds.left,
              right: frameBounds.right,
              width: frameBounds.width,
              center: frameBounds.left + frameBounds.width / 2,
            },
            copy: { left: copyBounds.left, right: copyBounds.right },
            dock: {
              left: dockBounds.left,
              right: dockBounds.right,
              width: dockBounds.width,
              center: dockBounds.left + dockBounds.width / 2,
              background: window.getComputedStyle(dock).backgroundColor,
              overflow: dock.scrollWidth - dock.clientWidth,
            },
            workscapeHeight: surface.getBoundingClientRect().height,
            targets,
            appLabels,
            appItemBounds,
            groupLabels,
            dockAction: {
              left: dockAction.left,
              right: dockAction.right,
              top: dockAction.top,
              bottom: dockAction.bottom,
            },
          };
        });

        expect(contract.dock.background).not.toBe('rgba(255, 255, 255, 0.94)');
        expect(contract.dock.background).not.toBe('rgba(0, 0, 0, 0)');
        expect(contract.dock.overflow).toBeLessThanOrEqual(1);
        expect(contract.targets.every((target) => target.width >= 44 && target.height >= 44)).toBe(
          true
        );
        expect(contract.appLabels.every((label) => label.text.length > 0 && !label.clipped)).toBe(
          true
        );
        expect(contract.groupLabels.every((label) => label.text.length > 0 && !label.clipped)).toBe(
          true
        );
        expect(
          contract.groupLabels.every(
            (label) =>
              label.bounds.right <= contract.dockAction.left ||
              label.bounds.left >= contract.dockAction.right ||
              label.bounds.bottom <= contract.dockAction.top ||
              label.bounds.top >= contract.dockAction.bottom
          )
        ).toBe(true);
        expect(
          contract.appItemBounds.every(
            (bounds) =>
              bounds.right <= contract.dockAction.left ||
              bounds.left >= contract.dockAction.right ||
              bounds.bottom <= contract.dockAction.top ||
              bounds.top >= contract.dockAction.bottom
          )
        ).toBe(true);
        expect(contract.workscapeHeight).toBeLessThanOrEqual(
          viewport.width >= 1200 ? 340 : viewport.width >= 900 ? 380 : 460
        );

        if (viewport.width >= 900 && backgroundPosition === 'RIGHT') {
          expect(Math.abs(contract.copy.left - contract.dock.left)).toBeLessThanOrEqual(2);
          expect(contract.frame.right - contract.dock.right).toBeGreaterThanOrEqual(
            contract.frame.width * 0.24
          );
        } else if (viewport.width >= 900 && backgroundPosition === 'LEFT') {
          expect(Math.abs(contract.copy.right - contract.dock.right)).toBeLessThanOrEqual(2);
          expect(contract.dock.left - contract.frame.left).toBeGreaterThanOrEqual(
            contract.frame.width * 0.24
          );
        } else if (viewport.width >= 900) {
          expect(Math.abs(contract.frame.center - contract.dock.center)).toBeLessThanOrEqual(2);
        } else {
          expect(Math.abs(contract.frame.width - contract.dock.width)).toBeLessThanOrEqual(2);
        }

        await expect(workscape).toHaveScreenshot(
          `flow-workscape-${viewport.width}-${backgroundPosition.toLowerCase()}-${colorScheme}.png`,
          {
            animations: 'disabled',
            caret: 'hide',
            scale: 'css',
            maxDiffPixelRatio: 0.001,
            timeout: 15_000,
          }
        );
      });
    }
  }
}

for (const viewport of WORKSCAPE_VIEWPORTS) {
  test(`Workscape forced colors ${viewport.width}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Forced colors are captured in Chromium.');
    await page.setViewportSize(viewport);
    await mockFlowHome(
      page,
      viewport.width >= 1600 ? 'expressive' : 'balanced',
      {
        backgroundUrl: WORKSCAPE_PHOTO,
        backgroundPosition: 'CENTER',
        overlayOpacity: 24,
      },
      { forcedColors: 'active' }
    );

    await page.goto('/');
    const workscape = page.getByTestId('flow-home').locator('[data-flow-workscape]');
    await waitForVisualState(page);
    const forcedContract = await workscape.evaluate((surface) => ({
      beforeDisplay: window.getComputedStyle(surface, '::before').display,
      afterDisplay: window.getComputedStyle(surface, '::after').display,
      dockBackground: window.getComputedStyle(
        surface.querySelector<HTMLElement>('[data-flow-dock-shell]')!
      ).backgroundColor,
    }));
    expect(forcedContract.beforeDisplay).toBe('none');
    expect(forcedContract.afterDisplay).toBe('none');
    expect(forcedContract.dockBackground).not.toBe('rgba(0, 0, 0, 0)');
    await expectNoHorizontalOverflow(page);
    await expect(workscape).toHaveScreenshot(`flow-workscape-${viewport.width}-forced-colors.png`, {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      maxDiffPixelRatio: 0.001,
      timeout: 15_000,
    });
  });
}

for (const viewport of [WORKSCAPE_VIEWPORTS[1], WORKSCAPE_VIEWPORTS[4]]) {
  for (const colorScheme of WORKSCAPE_SCHEMES) {
    test(`Workscape reduced transparency ${viewport.width} ${colorScheme}`, async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== 'chromium',
        'Reduced transparency is captured in Chromium.'
      );
      await page.setViewportSize(viewport);
      await mockFlowHome(
        page,
        'balanced',
        {
          backgroundUrl: WORKSCAPE_PHOTO,
          backgroundPosition: 'RIGHT',
          overlayOpacity: 24,
        },
        { colorScheme }
      );
      await emulateReducedTransparency(page, colorScheme);

      await page.goto('/');
      const workscape = page.getByTestId('flow-home').locator('[data-flow-workscape]');
      await waitForVisualState(page);
      const dockBackground = await workscape
        .locator('[data-flow-dock-shell]')
        .evaluate((dock) => window.getComputedStyle(dock).backgroundColor);
      expect(dockBackground).toBe(colorScheme === 'dark' ? 'rgb(7, 20, 38)' : 'rgb(16, 40, 77)');
      await expectNoHorizontalOverflow(page);
      await expect(workscape).toHaveScreenshot(
        `flow-workscape-${viewport.width}-reduced-transparency-${colorScheme}.png`,
        {
          animations: 'disabled',
          caret: 'hide',
          scale: 'css',
          maxDiffPixelRatio: 0.001,
          timeout: 15_000,
        }
      );
    });
  }
}

for (const viewport of [WORKSCAPE_VIEWPORTS[2], WORKSCAPE_VIEWPORTS[3]]) {
  for (const mode of ['dark', 'forced-colors'] as const) {
    test(`Flow Home full-page intermediate ${viewport.width} ${mode}`, async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== 'chromium',
        'Intermediate full-page accessibility coverage is captured in Chromium.'
      );
      await page.setViewportSize(viewport);
      await mockFlowHome(
        page,
        'balanced',
        {
          backgroundUrl: WORKSCAPE_PHOTO,
          backgroundPosition: 'RIGHT',
          overlayOpacity: 24,
        },
        mode === 'dark' ? { colorScheme: 'dark' } : { forcedColors: 'active' }
      );

      await page.goto('/');
      const flowHome = page.getByTestId('flow-home');
      await expect(flowHome).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await waitForVisualState(page);
      await expectDwaionClearOfHomeActions(page);
      if (mode === 'forced-colors') {
        const featured = flowHome.locator('[data-news-featured]');
        await expect(featured.locator('[data-news-featured-media]')).toBeHidden();
        const featuredColumns = await featured.evaluate((node) =>
          window.getComputedStyle(node).gridTemplateColumns.split(' ').filter(Boolean)
        );
        expect(featuredColumns).toHaveLength(1);
      }
      await expect(page).toHaveScreenshot(
        `flow-home-purpose-${viewport.width}-${mode}-full-page.png`,
        {
          animations: 'disabled',
          caret: 'hide',
          fullPage: true,
          scale: 'css',
          maxDiffPixelRatio: 0.001,
          timeout: 15_000,
        }
      );
    });
  }
}

test('Flow Home purpose-led Korean desktop 1440 visual baseline', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Desktop baseline uses the Chromium project.');
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockFlowHome(page, 'balanced');

  await page.goto('/');
  const flowHome = page.getByTestId('flow-home');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
  await expect(flowHome).toHaveAttribute('data-flow-home-presentation', 'balanced');
  await expect(flowHome.locator('[data-flow-section^="purpose-"]')).toHaveCount(5);
  await expectDesktopPurposeComposition(flowHome);
  const workscapeHeight =
    (await flowHome.locator('[data-flow-workscape]').boundingBox())?.height ??
    Number.POSITIVE_INFINITY;
  expect(workscapeHeight).toBeLessThanOrEqual(340);
  await expectNoHorizontalOverflow(page);
  await waitForVisualState(page);
  await expectDwaionClearOfHomeActions(page);

  await expect(page).toHaveScreenshot('flow-home-purpose-balanced-ko-1440.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    scale: 'css',
    maxDiffPixelRatio: 0.001,
    timeout: 15_000,
  });
});

test('Flow Home operator Korean desktop 1440 keeps the 8+4 role overview tier', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Desktop baseline uses the Chromium project.');
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockFlowHome(page, 'balanced', {}, { roles: ['TENANT_ADMIN'] });

  await page.goto('/');
  const flowHome = page.getByTestId('flow-home');
  const stage = flowHome.getByTestId('flow-home-personal-sections');
  await expect(stage).toHaveAttribute('data-flow-adaptive-first-section', 'role-pulse');
  const roleInsight = stage.locator(
    '[data-workspace-widget="role-pulse"] [data-home-role-insight]'
  );
  await expect(roleInsight.locator('[data-home-role-lens]')).toHaveCount(4);
  const geometry = await stage.evaluate((root) => {
    const rect = (key: string) => {
      const bounds = root
        .querySelector<HTMLElement>(`[data-workspace-widget="${key}"]`)!
        .getBoundingClientRect();
      return { top: bounds.top, bottom: bounds.bottom, width: bounds.width };
    };
    return { action: rect('action-queue'), role: rect('role-pulse') };
  });
  expect(geometry.action.width / geometry.role.width).toBeGreaterThan(1.9);
  expect(geometry.action.width / geometry.role.width).toBeLessThan(2.1);
  expect(Math.abs(geometry.action.top - geometry.role.top)).toBeLessThanOrEqual(2);
  expect(Math.abs(geometry.action.bottom - geometry.role.bottom)).toBeLessThanOrEqual(2);
  await expectNoHorizontalOverflow(page);
  await waitForVisualState(page);
  await expectDwaionClearOfHomeActions(page);

  await expect(page).toHaveScreenshot('flow-home-purpose-operator-ko-1440.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    scale: 'css',
    maxDiffPixelRatio: 0.001,
    timeout: 15_000,
  });
});

test('Flow Home focused Korean desktop 1440 visual baseline', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Desktop baseline uses the Chromium project.');
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockFlowHome(page, 'focused');

  await page.goto('/');
  const flowHome = page.getByTestId('flow-home');
  await expect(flowHome).toHaveAttribute('data-flow-home-presentation', 'focused');
  await expectDesktopPurposeComposition(flowHome);
  await expectRoleMetricLabelsReadable(flowHome);
  const frame = await flowHome.boundingBox();
  expect(frame?.width ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(1281);
  expect(frame?.x ?? 0).toBeGreaterThanOrEqual(79);
  await expectNoHorizontalOverflow(page);
  await waitForVisualState(page);
  await expectDwaionClearOfHomeActions(page);

  await expect(page).toHaveScreenshot('flow-home-purpose-focused-ko-1440.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    scale: 'css',
    maxDiffPixelRatio: 0.001,
    timeout: 15_000,
  });
});

test('Flow Home expressive Korean desktop 1440 visual baseline', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Desktop baseline uses the Chromium project.');
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockFlowHome(page, 'expressive');

  await page.goto('/');
  const flowHome = page.getByTestId('flow-home');
  await expect(flowHome).toHaveAttribute('data-flow-home-presentation', 'expressive');
  await expect(flowHome.locator('[data-flow-dock-shell]')).toHaveAttribute(
    'data-flow-dock-item-limit',
    '10'
  );
  await expectDesktopPurposeComposition(flowHome);
  const workscape = await flowHome.locator('[data-flow-workscape]').boundingBox();
  expect(workscape?.x ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(21);
  await expectNoHorizontalOverflow(page);
  await waitForVisualState(page);
  await expectDwaionClearOfHomeActions(page);

  await expect(page).toHaveScreenshot('flow-home-purpose-expressive-ko-1440.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    scale: 'css',
    maxDiffPixelRatio: 0.001,
    timeout: 15_000,
  });
});

test('Flow Home expressive Korean desktop 1920 visual baseline', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Desktop baseline uses the Chromium project.');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await mockFlowHome(page, 'expressive');

  await page.goto('/');
  const flowHome = page.getByTestId('flow-home');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
  await expect(flowHome).toHaveAttribute('data-flow-home-presentation', 'expressive');
  await expect(flowHome.locator('[data-flow-dock-shell]')).toHaveAttribute(
    'data-flow-dock-item-limit',
    '12'
  );
  await expectDesktopPurposeComposition(flowHome, 'adaptive-wide');
  const priorityLayout = flowHome.locator(
    '[data-workspace-widget="action-queue"] [data-home-purpose-list]'
  );
  await expect(priorityLayout).toBeVisible();
  const priorityRows = await priorityLayout.evaluate((list) => {
    const style = window.getComputedStyle(list);
    return {
      display: style.display,
      direction: style.flexDirection,
      rows: Array.from(list.querySelectorAll<HTMLElement>(':scope > [role="listitem"]')).map(
        (row) => {
          const bounds = row.getBoundingClientRect();
          return { top: bounds.top, bottom: bounds.bottom, height: bounds.height };
        }
      ),
    };
  });
  expect(priorityRows.display).toBe('flex');
  expect(priorityRows.direction).toBe('column');
  expect(priorityRows.rows.length).toBeGreaterThanOrEqual(2);
  expect(
    Math.max(...priorityRows.rows.map((row) => row.height)) -
      Math.min(...priorityRows.rows.map((row) => row.height))
  ).toBeLessThanOrEqual(2);
  expect(
    priorityRows.rows.every(
      (row, index) => index === 0 || row.top >= (priorityRows.rows[index - 1]?.bottom ?? row.top)
    )
  ).toBe(true);
  const workscapeHeight =
    (await flowHome.locator('[data-flow-workscape]').boundingBox())?.height ??
    Number.POSITIVE_INFINITY;
  expect(workscapeHeight).toBeLessThanOrEqual(340);
  await expectNoHorizontalOverflow(page);
  await waitForVisualState(page);
  await expectDwaionClearOfHomeActions(page);

  await expect(page).toHaveScreenshot('flow-home-purpose-expressive-ko-1920.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    scale: 'css',
    maxDiffPixelRatio: 0.001,
    timeout: 15_000,
  });
});

test('Flow Home tenant photo keeps brand colour and a readable launch deck', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Desktop baseline uses the Chromium project.');
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockFlowHome(page, 'balanced', {
    backgroundUrl: '/media/communications/workplace-improvement.jpg',
    backgroundPosition: 'RIGHT',
    overlayOpacity: 24,
  });

  await page.goto('/');
  const workscape = page.getByTestId('flow-home').locator('[data-flow-workscape]');
  await expect(workscape).toHaveAttribute('data-tenant-image-opacity', '1');
  const contract = await workscape.evaluate((surface) => {
    const dock = surface.querySelector<HTMLElement>('[data-flow-dock-shell]')!;
    return {
      imageOpacity: window.getComputedStyle(surface, '::before').opacity,
      workscapeHeight: surface.getBoundingClientRect().height,
      dockBackground: window.getComputedStyle(dock).backgroundColor,
    };
  });
  expect(contract.imageOpacity).toBe('1');
  expect(contract.workscapeHeight).toBeLessThanOrEqual(340);
  expect(contract.dockBackground).not.toBe('rgba(0, 0, 0, 0)');
  await expectNoHorizontalOverflow(page);
  await waitForVisualState(page);
  await expectDwaionClearOfHomeActions(page);

  await expect(workscape).toHaveScreenshot('flow-home-purpose-tenant-photo-workscape-ko-1440.png', {
    animations: 'disabled',
    caret: 'hide',
    scale: 'css',
    maxDiffPixelRatio: 0.001,
    timeout: 15_000,
  });
});

test('Flow Home purpose-led Korean mobile 390 visual baseline', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Mobile baseline uses the mobile project.');
  await page.setViewportSize({ width: 390, height: 844 });
  await mockFlowHome(page, 'balanced');

  await page.goto('/');
  const flowHome = page.getByTestId('flow-home');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
  await expect(flowHome).toHaveAttribute('data-flow-home-presentation', 'balanced');
  await expect(flowHome.locator('[data-flow-section^="purpose-"]')).toHaveCount(5);
  await expect(flowHome.locator('[data-flow-dock-item]')).toHaveCount(4);
  const columns = await flowHome
    .locator('[data-workspace-presentation]')
    .evaluate((grid) => window.getComputedStyle(grid).gridTemplateColumns.split(' ').length);
  expect(columns).toBe(1);
  await expectRoleMetricLabelsReadable(flowHome);
  await expectNoHorizontalOverflow(page);
  await waitForVisualState(page);
  await expectDwaionClearOfHomeActions(page);

  await expect(page).toHaveScreenshot('flow-home-purpose-balanced-ko-390.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    scale: 'css',
    maxDiffPixelRatio: 0.001,
    timeout: 15_000,
  });
});

test('Flow Home expressive Korean mobile 390 actual visual baseline', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Mobile baseline uses the mobile project.');
  await page.setViewportSize({ width: 390, height: 844 });
  await mockFlowHome(page, 'expressive');

  await page.goto('/');
  const flowHome = page.getByTestId('flow-home');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
  await expect(flowHome).toHaveAttribute('data-flow-home-presentation', 'expressive');
  await expect(flowHome.locator('[data-flow-section^="purpose-"]')).toHaveCount(5);
  await expect(flowHome.locator('[data-flow-dock-item]')).toHaveCount(4);
  await expect(flowHome.getByTestId('flow-home-personal-sections')).toHaveAttribute(
    'data-flow-read-template',
    'standard'
  );
  await expectNoHorizontalOverflow(page);
  await waitForVisualState(page);
  await expectDwaionClearOfHomeActions(page);

  await expect(page).toHaveScreenshot('flow-home-purpose-expressive-ko-390.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    scale: 'css',
    maxDiffPixelRatio: 0.001,
    timeout: 15_000,
  });
});

test('Flow Home Korean mobile 320 full-page visual baseline', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'The 320px baseline uses the mobile project.');
  await page.setViewportSize({ width: 320, height: 760 });
  await mockFlowHome(page, 'balanced');

  await page.goto('/');
  const flowHome = page.getByTestId('flow-home');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
  await expect(flowHome.locator('[data-flow-section^="purpose-"]')).toHaveCount(5);
  await expect(flowHome.locator('[data-flow-dock-item]')).toHaveCount(4);
  const columns = await flowHome
    .locator('[data-workspace-presentation]')
    .evaluate((grid) => window.getComputedStyle(grid).gridTemplateColumns.split(' ').length);
  expect(columns).toBe(1);
  await expectRoleMetricLabelsReadable(flowHome);
  await expectNoHorizontalOverflow(page);
  await waitForVisualState(page);

  await expect(page).toHaveScreenshot('flow-home-purpose-balanced-ko-320.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    scale: 'css',
    maxDiffPixelRatio: 0.001,
    timeout: 15_000,
  });
});

test('Flow Home Korean desktop 1280 at 200 percent text keeps a dark visual baseline', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Large-text dark baseline uses Chromium.');
  await page.setViewportSize({ width: 1280, height: 720 });
  await mockFlowHome(page, 'balanced', {}, { colorScheme: 'dark' });

  await page.goto('/');
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  const flowHome = page.getByTestId('flow-home');
  await expect
    .poll(() => page.evaluate(() => window.getComputedStyle(document.documentElement).fontSize))
    .toBe('32px');
  await expect(flowHome).toHaveAttribute('data-flow-large-text', 'true');
  const largeTextMeaning = await flowHome.evaluate((root) => {
    const measure = (element: HTMLElement) => ({
      text: element.textContent?.trim() ?? '',
      clippedHorizontally: element.scrollWidth > element.clientWidth + 1,
      clippedVertically: element.scrollHeight > element.clientHeight + 1,
    });
    const description = root.querySelector<HTMLElement>('[data-flow-context-description]');
    const groupLabels = Array.from(
      root.querySelectorAll<HTMLElement>('[data-flow-dock-group-label]')
    ).filter((label) => window.getComputedStyle(label).display !== 'none');
    return {
      description: description ? measure(description) : null,
      groupLabels: groupLabels.map(measure),
    };
  });
  expect(largeTextMeaning.description).not.toBeNull();
  expect(largeTextMeaning.description?.text.length ?? 0).toBeGreaterThan(1);
  expect(largeTextMeaning.description?.clippedHorizontally).toBe(false);
  expect(largeTextMeaning.description?.clippedVertically).toBe(false);
  expect(largeTextMeaning.groupLabels.length).toBeGreaterThan(1);
  expect(
    largeTextMeaning.groupLabels.every(
      (label) => label.text.length > 1 && !label.clippedHorizontally && !label.clippedVertically
    ),
    JSON.stringify(largeTextMeaning.groupLabels)
  ).toBe(true);
  const columns = await flowHome
    .locator('[data-workspace-presentation]')
    .evaluate((grid) => window.getComputedStyle(grid).gridTemplateColumns.split(' ').length);
  expect(columns).toBe(1);
  await expectNoHorizontalOverflow(page);
  await waitForVisualState(page);
  await expectDwaionClearOfHomeActions(page);

  await expect(page).toHaveScreenshot('flow-home-purpose-balanced-ko-1280-text-200-dark.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    scale: 'css',
    maxDiffPixelRatio: 0.001,
    timeout: 15_000,
  });
});

test('Flow Home Korean long-content desktop visual baseline', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Long-content baseline uses Chromium.');
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockFlowHome(page, 'balanced', {}, { longKoreanContent: true });

  await page.goto('/');
  const flowHome = page.getByTestId('flow-home');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
  await expect(
    flowHome.getByText('고객 데이터 분석 환경의 한시적 접근 권한과 보안 예외 승인 요청', {
      exact: true,
    })
  ).toBeVisible();
  await expect(
    flowHome.getByText('생성형 AI를 활용한 협업 방식 전환과 안전한 업무 자동화 운영 원칙 안내', {
      exact: true,
    })
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await waitForVisualState(page);
  await expectDwaionClearOfHomeActions(page);

  await expect(page).toHaveScreenshot('flow-home-purpose-long-ko-1440.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    scale: 'css',
    maxDiffPixelRatio: 0.001,
    timeout: 15_000,
  });
});

test('Flow Home loading transition stays within the layout-shift contract', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Layout shift is measured once in Chromium.');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    const state = { supported: false, value: 0, entries: 0 };
    Object.assign(window, { __flowHomeLayoutShift: state });
    if (!PerformanceObserver.supportedEntryTypes.includes('layout-shift')) return;
    state.supported = true;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
        if (shift.hadRecentInput) continue;
        state.value += shift.value;
        state.entries += 1;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  let releasePreference = () => undefined;
  const preferenceGate = new Promise<void>((resolve) => {
    releasePreference = resolve;
  });
  await mockFlowHome(page, 'balanced', {}, { preferenceGate });

  await page.goto('/');
  await expect(page.getByTestId('home-loading-skeleton')).toBeVisible();
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    const state = (
      window as typeof window & {
        __flowHomeLayoutShift: { supported: boolean; value: number; entries: number };
      }
    ).__flowHomeLayoutShift;
    state.value = 0;
    state.entries = 0;
  });
  releasePreference();

  await expect(page.getByTestId('flow-home')).toBeVisible();
  await waitForVisualState(page);
  await page.waitForTimeout(250);
  const shift = await page.evaluate(
    () =>
      (
        window as typeof window & {
          __flowHomeLayoutShift: { supported: boolean; value: number; entries: number };
        }
      ).__flowHomeLayoutShift
  );
  expect(shift.supported).toBe(true);
  expect(shift.value).toBeLessThanOrEqual(0.02);
});
