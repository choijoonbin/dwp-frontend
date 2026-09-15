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

import type { Page } from '@playwright/test';

export const HOME_WAVE2_FIXED_NOW = new Date('2026-08-11T00:30:00.000Z');

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

export async function routeHomeWave2NewsOverview(
  page: Page,
  roles: readonly string[] = ['TENANT_ADMIN'],
  options: { longEnglish?: boolean } = {}
) {
  const overview = createHomeOverviewFixture(roles);
  const featured = {
    ...HOME_COMMUNICATIONS_FIXTURE.featured,
    ...(options.longEnglish
      ? {
          title:
            'Enterprise-wide digital workplace modernization, governance, and employee support operating model update',
          summary:
            'Review the organization-wide rollout sequence, security responsibilities, support channels, and decisions that every distributed team needs before the next operating cycle begins.',
          publisherName: 'Enterprise Digital Workplace Transformation Office',
        }
      : {}),
    publishedAt: '2026-08-10T09:00:00Z',
  };
  await page.route('**/api/platform/v1/home/overview**', (route) =>
    fulfillSuccess(route, {
      ...overview,
      work: {
        ...overview.work,
        generatedAt: HOME_WAVE2_FIXED_NOW.toISOString(),
        data: { ...overview.work.data, generatedAt: HOME_WAVE2_FIXED_NOW.toISOString() },
      },
      calendar: {
        ...overview.calendar,
        generatedAt: HOME_WAVE2_FIXED_NOW.toISOString(),
        data: { ...overview.calendar.data, generatedAt: HOME_WAVE2_FIXED_NOW.toISOString() },
      },
      activity: {
        ...overview.activity,
        generatedAt: HOME_WAVE2_FIXED_NOW.toISOString(),
        data: { ...overview.activity.data, generatedAt: HOME_WAVE2_FIXED_NOW.toISOString() },
      },
      communications: {
        status: 'AVAILABLE',
        source: 'DWP_COMMUNICATIONS',
        generatedAt: HOME_WAVE2_FIXED_NOW.toISOString(),
        data: {
          ...HOME_COMMUNICATIONS_FIXTURE,
          featured,
          generatedAt: HOME_WAVE2_FIXED_NOW.toISOString(),
        },
        reason: null,
      },
      generatedAt: HOME_WAVE2_FIXED_NOW.toISOString(),
    })
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
