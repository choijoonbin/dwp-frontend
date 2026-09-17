import {
  FULL_PRODUCT_PERMISSIONS,
  HOME_COMMUNICATIONS_FIXTURE,
  createHomeOverviewFixture,
  fulfillSuccess,
  mockShellSession,
} from './shell-session';
import { APPROVAL_HOME_FIXTURE, HR_HOME_FIXTURE } from './product-area-fixtures';
import { routeEmptyFlowExecutionSummaries } from './flow-home-provider-fixtures';
import { routeCanonicalHomeWorkspaceApps } from './home-launchpad-contract-fixture';
import { widgetRegistryEffectiveCatalog, widgetRegistryReadiness } from './widget-registry';

import type { Page } from '@playwright/test';

export const HOME_WAVE2_FIXED_NOW = new Date('2026-08-11T00:30:00.000Z');

function wave2StudioEffectiveCatalog() {
  const base = widgetRegistryEffectiveCatalog('SHADOW', 'AVAILABLE');
  const nativeByKey = new Map(
    base.contexts[0]!.items.map((item) => [item.legacyWidgetKey, item] as const)
  );
  const native = (legacyWidgetKey: string, definitionKey: string) => ({
    ...nativeByKey.get(legacyWidgetKey)!,
    definitionKey,
  });
  const projection = (index: number, definitionKey: string) => ({
    definitionId: `90000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    definitionKey,
    legacyWidgetKey: null,
    resolvedVersionId: `91000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    semanticVersion: '1.0.0',
    effectiveState: 'AVAILABLE' as const,
    reasonCodes: ['AVAILABLE' as const],
    placementCapabilities: { canAdd: false, canHide: false, canMove: false, canResize: true },
    addedInstanceCount: 0,
  });
  const items = [
    native('schedule', 'meetings.next-prep'),
    projection(1, 'meetings.decisions'),
    projection(2, 'space.feed'),
    projection(3, 'dwai.artifacts'),
    projection(4, 'workplace.status'),
    projection(5, 'hr.learning'),
    native('focus', 'services.requests'),
    native('daily-brief', 'security.bulletin'),
    native('command-rail', 'home.priority-queue'),
    native('activity', 'home.role-activity'),
    native('focus-balance', 'calendar.focus-balance'),
    native('meeting-load', 'calendar.meeting-load'),
  ];
  const context = (placementContext: 'CLASSIC_PERSONAL' | 'FLOW_PERSONAL') => ({
    placementContext,
    capabilities: {
      libraryRead: true,
      legacyPlacementWrite: true,
      instanceV6Write: false,
      brokerRead: false,
      presetCreate: false,
      presetShare: false,
    },
    items,
  });
  return {
    ...base,
    catalogRevision: 'wave2-studio-12',
    hostContext: { ...base.hostContext, resolvedHostMode: 'FLOW' as const },
    contexts: [context('CLASSIC_PERSONAL'), context('FLOW_PERSONAL')],
  };
}

export async function routeHomeWave2WidgetCatalog(page: Page) {
  await page.route('**/api/platform/v1/widget-catalog/readiness', (route) =>
    fulfillSuccess(route, widgetRegistryReadiness('SHADOW'))
  );
  await page.route('**/api/platform/v1/widget-catalog/effective**', (route) =>
    fulfillSuccess(route, wave2StudioEffectiveCatalog())
  );
}

const HOME_CAPABILITIES = [
  'HOME_COMPOSITION_V4',
  'MODE_SCOPED_HOME_VIEWS',
  'FOUR_DEVICE_LAYOUTS',
] as const;

const FLOW_WIDGETS = [
  { widgetKey: 'command-rail', visible: true, size: 'large', height: 'standard' },
  { widgetKey: 'schedule', visible: true, size: 'compact', height: 'standard' },
  { widgetKey: 'daily-brief', visible: true, size: 'compact', height: 'standard' },
  { widgetKey: 'focus', visible: true, size: 'compact', height: 'standard' },
  { widgetKey: 'activity', visible: false, size: 'compact', height: 'standard' },
  { widgetKey: 'focus-balance', visible: false, size: 'medium', height: 'short' },
  { widgetKey: 'meeting-load', visible: false, size: 'medium', height: 'short' },
] as const;

const PERSONALIZED_FLOW_WIDGETS = [
  { widgetKey: 'command-rail', visible: true, size: 'full', height: 'short' },
  { widgetKey: 'activity', visible: true, size: 'medium', height: 'standard' },
  { widgetKey: 'schedule', visible: true, size: 'medium', height: 'standard' },
  { widgetKey: 'daily-brief', visible: true, size: 'large', height: 'standard' },
  { widgetKey: 'focus', visible: true, size: 'medium', height: 'standard' },
  { widgetKey: 'meeting-load', visible: true, size: 'medium', height: 'short' },
  { widgetKey: 'focus-balance', visible: true, size: 'medium', height: 'short' },
] as const;

const MODE_LAYOUTS = {
  CLASSIC: {
    layoutScope: 'MODE_SCOPED_VIEW',
    deviceClasses: ['DESKTOP_WIDE', 'DESKTOP_STANDARD', 'MOBILE_STANDARD', 'MOBILE_COMPACT'],
  },
  FLOW_V1: {
    layoutScope: 'MODE_SCOPED_VIEW',
    deviceClasses: ['DESKTOP_WIDE', 'DESKTOP_STANDARD', 'MOBILE_STANDARD', 'MOBILE_COMPACT'],
  },
} as const;

function flowExperience({ studio = false }: { studio?: boolean } = {}) {
  return {
    headline: null,
    subheadline: null,
    localizedContent: {},
    defaultLocale: 'ko',
    backgroundPosition: 'RIGHT',
    overlayOpacity: 18,
    backgroundUrl: null,
    compositionPolicy: {
      schemaVersion: 4,
      experienceVariant: 'FLOW_V1',
      personalCustomizationEnabled: true,
      governedZones: [
        {
          zoneKey: 'announcements',
          placement: 'CANVAS',
          visible: false,
          size: 'full',
          height: 'short',
          sortOrder: 20,
        },
      ],
      modeLayouts: MODE_LAYOUTS,
    },
    effectiveExperienceVariant: 'FLOW_V1',
    advancedPersonalizationEnabled: studio,
    composerEnabled: studio,
    homePreferenceStore: 'VIEWS',
    homeContractCapabilities: [...HOME_CAPABILITIES],
    version: 7,
  };
}

function flowLayout(presentation: 'balanced' | 'expressive') {
  return {
    appLayout: null,
    presentation,
    widgets: presentation === 'expressive' ? PERSONALIZED_FLOW_WIDGETS : FLOW_WIDGETS,
  };
}

function flowView(presentation: 'balanced' | 'expressive') {
  return {
    viewId: 'wave2-flow-view',
    viewKey: 'wave2-flow',
    surfaceKey: 'workspace-home',
    modeKey: 'FLOW_V1',
    name: 'Wave 2 Flow',
    isDefault: true,
    schemaVersion: 5,
    layout: flowLayout(presentation),
    version: 3,
    customized: true,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: HOME_WAVE2_FIXED_NOW.toISOString(),
    widgetConfigurations: {},
  };
}

export function createHomeWave2NewsOverviewFixture(
  roles: readonly string[] = ['TENANT_ADMIN'],
  options: { longEnglish?: boolean } = {}
) {
  const overview = createHomeOverviewFixture(roles);
  const koreanEvidence = options.longEnglish !== true;
  const featured = {
    ...HOME_COMMUNICATIONS_FIXTURE.featured,
    ...(koreanEvidence
      ? {
          title: '2026 하반기 통합 디지털 워크플레이스 고도화 방향과 전사 적용 일정 안내',
          summary:
            '조직 포털 개편 방향, 단계별 적용 일정과 구성원이 미리 확인할 사항을 안내합니다.',
          publisherName: '디지털 워크플레이스 추진단',
          coverImageUrl: '/assets/home/wave2/classic-canonical-hero.jpg',
          sourceLocale: 'ko',
          severity: 'WARNING',
          acknowledgementRequired: true,
          acknowledgementDueAt: '2026-08-11T09:00:00Z',
          dismissible: false,
        }
      : options.longEnglish
        ? {
            title:
              'Enterprise-wide digital workplace modernization, governance, and employee support operating model update',
            summary:
              'Review the organization-wide rollout sequence, security responsibilities, support channels, and decisions that every distributed team needs before the next operating cycle begins.',
            publisherName: 'Enterprise Digital Workplace Transformation Office',
            coverImageUrl: '/assets/home/wave2/classic-canonical-hero.jpg',
          }
        : {}),
    publishedAt: '2026-08-10T09:00:00Z',
  };
  const koreanWork = [
    {
      title: '소프트웨어 접근 권한 요청 승인',
      summary: '신규 구성원의 프로젝트 작업 공간 접근 요청을 검토하세요.',
      owner: '나',
      sourceSystem: 'IT 서비스',
      reason: '승인이 완료되어야 신규 구성원이 프로젝트 업무를 시작할 수 있습니다.',
      recommendedNext: '역할과 라이선스 범위를 확인한 뒤 승인하세요.',
      latestActivity: '정책 엔진이 역할 적합성을 확인했습니다.',
    },
    {
      title: '고객 브리핑 자료 검토',
      summary: '고객 회의 전에 미결 질문과 담당자를 확인하세요.',
      owner: '나',
      sourceSystem: '문서 협업',
      reason: '발견된 질문 3건의 담당자가 아직 정해지지 않았습니다.',
      recommendedNext: '회의 전에 담당자를 지정하세요.',
      latestActivity: '김미나님이 고객 질문 3건을 추가했습니다.',
    },
    {
      title: '복리후생 신청 내용 확인',
      summary: '오늘 마감되는 복리후생 신청 내용을 확인하세요.',
      owner: '나',
      sourceSystem: '구성원 서비스',
      reason: '신청 기간이 오늘 종료됩니다.',
      recommendedNext: '선택한 제도를 확인하세요.',
      latestActivity: '구성원 서비스가 마감 시각을 확인했습니다.',
    },
    {
      title: '출장 경비 후속 처리',
      summary: '공유 서비스에서 경비 후속 처리를 완료했습니다.',
      owner: '공유 서비스',
      sourceSystem: '재무',
      reason: '요청이 완료되어 참고용으로 보관됩니다.',
      recommendedNext: '추가 조치가 필요하지 않습니다.',
      latestActivity: '재무 서비스가 요청을 완료했습니다.',
    },
  ] as const;
  const koreanCommunicationItems = [
    {
      title: 'AI 시대의 협업 방식을 함께 만들어 갑니다',
      summary: '작은 아이디어를 측정 가능한 업무 개선으로 이어가는 팀 실험 사례를 확인하세요.',
      publisherName: '디지털 워크플레이스',
      sourceLocale: 'ko',
    },
    {
      title: '그린 캠퍼스 데이 참여 안내',
      summary: '이번 주 구성원 참여 행사 일정과 신청 방법을 확인하세요.',
      publisherName: '피플 앤 컬처',
      sourceLocale: 'ko',
    },
    {
      title: '분산 근무 보안 준비 체크리스트',
      summary: '고객과 회사 정보를 안전하게 보호하기 위한 실무 점검 항목입니다.',
      publisherName: '정보보안실',
      sourceLocale: 'ko',
    },
  ] as const;
  const localizedWorkData = koreanEvidence
    ? {
        ...overview.work.data,
        items: overview.work.data.items.map((item, index) => ({
          ...item,
          ...koreanWork[index],
        })),
      }
    : overview.work.data;
  const localizedEvent = <T extends Record<string, unknown>>(event: T, focus = false) =>
    koreanEvidence
      ? {
          ...event,
          calendarName: '내 캘린더',
          title: focus ? '집중 업무 시간' : '디지털 워크플레이스 운영 점검 회의',
          description: focus
            ? '방해받지 않는 집중 업무 시간입니다.'
            : '주간 의사결정과 의존성을 점검합니다.',
          location: focus ? null : '서울 본사 · 포커스 08',
        }
      : event;
  const localizedCalendarData = koreanEvidence
    ? {
        ...overview.calendar.data,
        nextEvent: overview.calendar.data.nextEvent
          ? localizedEvent(overview.calendar.data.nextEvent)
          : null,
        today: overview.calendar.data.today.map((event) =>
          localizedEvent(event, event.type === 'FOCUS')
        ),
        attention: overview.calendar.data.attention.map((item) => ({
          ...item,
          title: '응답이 필요한 일정이 1건 있습니다',
          description: '주최자가 회의실을 확정하기 전에 참석 여부를 알려주세요.',
        })),
      }
    : overview.calendar.data;
  return {
    ...overview,
    work: {
      ...overview.work,
      generatedAt: HOME_WAVE2_FIXED_NOW.toISOString(),
      data: { ...localizedWorkData, generatedAt: HOME_WAVE2_FIXED_NOW.toISOString() },
    },
    calendar: {
      ...overview.calendar,
      generatedAt: HOME_WAVE2_FIXED_NOW.toISOString(),
      data: { ...localizedCalendarData, generatedAt: HOME_WAVE2_FIXED_NOW.toISOString() },
    },
    activity: {
      ...overview.activity,
      generatedAt: HOME_WAVE2_FIXED_NOW.toISOString(),
      data: {
        ...overview.activity.data,
        ...(koreanEvidence
          ? {
              events: overview.activity.data.events.map((event, index) => ({
                ...event,
                title: [
                  '참고 요청 실행 계획 준비 완료',
                  '접근 요청 검토 필요',
                  '외부 공유 차단',
                  '조직 정보 동기화 완료',
                ][index],
                summary: [
                  '읽기 전용 실행 계획과 감사 추적을 생성했습니다.',
                  '신규 구성원의 프로젝트 역할을 확인해야 합니다.',
                  '민감 정보 정책에 따라 외부 공유가 차단되었습니다.',
                  '조직과 구성원 변경 사항을 반영했습니다.',
                ][index],
              })),
            }
          : {}),
        generatedAt: HOME_WAVE2_FIXED_NOW.toISOString(),
      },
    },
    communications: {
      status: 'AVAILABLE',
      source: 'DWP_COMMUNICATIONS',
      generatedAt: HOME_WAVE2_FIXED_NOW.toISOString(),
      data: {
        ...HOME_COMMUNICATIONS_FIXTURE,
        featured,
        items: koreanEvidence
          ? HOME_COMMUNICATIONS_FIXTURE.items.map((item, index) => ({
              ...item,
              ...koreanCommunicationItems[index],
            }))
          : HOME_COMMUNICATIONS_FIXTURE.items,
        summary: koreanEvidence
          ? { ...HOME_COMMUNICATIONS_FIXTURE.summary, required: 1 }
          : HOME_COMMUNICATIONS_FIXTURE.summary,
        generatedAt: HOME_WAVE2_FIXED_NOW.toISOString(),
      },
      reason: null,
    },
    recommendations: koreanEvidence
      ? overview.recommendations.map((recommendation) => ({
          ...recommendation,
          title: '마감이 가까운 업무를 확인하세요',
          description: '개인 업무 목록에 곧 마감되는 항목이 있습니다.',
        }))
      : overview.recommendations,
    recommendationSection: koreanEvidence
      ? {
          ...overview.recommendationSection,
          data: overview.recommendations.map((recommendation) => ({
            ...recommendation,
            title: '마감이 가까운 업무를 확인하세요',
            description: '개인 업무 목록에 곧 마감되는 항목이 있습니다.',
          })),
        }
      : overview.recommendationSection,
    generatedAt: HOME_WAVE2_FIXED_NOW.toISOString(),
  };
}

export async function routeHomeWave2NewsOverview(
  page: Page,
  roles: readonly string[] = ['TENANT_ADMIN'],
  options: { longEnglish?: boolean } = {}
) {
  const overview = createHomeWave2NewsOverviewFixture(roles, options);
  await page.route('**/api/platform/v1/home/overview**', (route) =>
    fulfillSuccess(route, overview)
  );
}

export async function routeHomeWave2HealthyFlowContributions(page: Page) {
  await routeEmptyFlowExecutionSummaries(page, HOME_WAVE2_FIXED_NOW.toISOString());
  await page.route('**/api/platform/v1/workspace/work-hub/personal-tasks?*', (route) =>
    fulfillSuccess(route, { items: [], page: 0, size: 100, totalElements: 0, hasMore: false })
  );
  await page.route('**/api/platform/v1/workspace/work-hub/day-plans/*', (route) => {
    const date = new URL(route.request().url()).pathname.split('/').pop()!;
    return fulfillSuccess(route, {
      date,
      version: 0,
      items: [],
      updatedAt: HOME_WAVE2_FIXED_NOW.toISOString(),
    });
  });
  await page.route('**/api/platform/v1/workplace/bookings**', (route) => fulfillSuccess(route, []));
  await page.route(/\/api\/approvals\/v1\/home(?:\?|$)/u, (route) =>
    fulfillSuccess(route, {
      ...APPROVAL_HOME_FIXTURE,
      generatedAt: HOME_WAVE2_FIXED_NOW.toISOString(),
    })
  );
  await page.route('**/api/people/v1/hr/home', (route) =>
    fulfillSuccess(route, {
      ...HR_HOME_FIXTURE,
      generatedAt: HOME_WAVE2_FIXED_NOW.toISOString(),
    })
  );
  await page.route('**/api/platform/v1/services/requests', (route) => fulfillSuccess(route, []));
  await page.route('**/api/notifications/v1/summary/by-app**', (route) =>
    fulfillSuccess(route, {
      partial: false,
      unavailableSources: [],
      apps: [],
      changeVersion: '11',
      counterVersion: '11',
      generatedAt: HOME_WAVE2_FIXED_NOW.toISOString(),
    })
  );
}

export async function remockHomeWave2ClassicSession(
  page: Page,
  options: {
    locale: 'ko' | 'en';
    displayName: string;
    mode: 'light' | 'dark';
    highContrast?: boolean;
    longEnglish?: boolean;
  }
) {
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: options.locale,
    displayName: options.displayName,
    permissions: FULL_PRODUCT_PERMISSIONS,
    appearance: {
      mode: options.mode,
      density: 'standard',
      highContrast: options.highContrast ?? false,
      reduceMotion: true,
    },
  });
  await routeHomeWave2NewsOverview(page, ['TENANT_ADMIN'], {
    longEnglish: options.longEnglish,
  });
  await routeCanonicalHomeWorkspaceApps(page);
}

export async function routeHomeWave2Flow(
  page: Page,
  presentation: 'balanced' | 'expressive',
  options: { studio?: boolean } = {}
) {
  const studio = options.studio === true;
  await page.route('**/api/platform/v1/home-experience', (route) =>
    fulfillSuccess(route, flowExperience({ studio }))
  );
  await page.route('**/api/platform/v1/home-views**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/device-layouts') || path.endsWith('/revisions')) {
      return fulfillSuccess(route, []);
    }
    return fulfillSuccess(route, [flowView(presentation)]);
  });
  if (studio) {
    await page.route('**/api/platform/v1/home-templates**', (route) => fulfillSuccess(route, []));
  }
}
