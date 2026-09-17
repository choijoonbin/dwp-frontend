import type { Page, Route } from '@playwright/test';

import { mockShellSession as mockBaseShellSession } from './shell-session';
import { CALENDAR_SHARES_FIXTURE } from './product-area-fixtures';

import type {
  CalendarDelegation,
  CalendarInsightPeriod,
  CalendarInsights,
  CalendarInsightsMetrics,
  CalendarRestoreEventResponse,
  CalendarSettings,
  UpdateCalendarSettingsInput,
} from '@dwp-frontend/shared-utils';

const SETTING_KEYS = [
  'WORKING_DAYS',
  'WORKING_DAY_START',
  'WORKING_DAY_END',
  'TIME_ZONE',
  'WEEK_START',
  'DEFAULT_EVENT_MINUTES',
  'SPEEDY_MEETING_MODE',
  'DEFAULT_BUFFER_MINUTES',
  'DEFAULT_VISIBILITY',
  'DEFAULT_REMINDER_MINUTES',
] as const;

export const CALENDAR_SETTINGS_FIXTURE = {
  workingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
  workingDayStart: '09:00:00',
  workingDayEnd: '18:00:00',
  timeZone: 'Asia/Seoul',
  weekStart: 'MONDAY',
  defaultEventMinutes: 60,
  speedyMeetingMode: 'FIVE_TEN',
  defaultBufferMinutes: 10,
  defaultVisibility: 'PRIVATE',
  defaultReminderMinutes: 10,
  governance: SETTING_KEYS.map((key) => ({
    key,
    source: 'USER' as const,
    managed: false,
    inherited: false,
    locked: false,
  })),
  version: 3,
  updatedAt: '2026-08-11T00:15:00Z',
} as const satisfies CalendarSettings;

const CALENDAR_DELEGATIONS_FIXTURE = [
  {
    delegationId: '68e5a0aa-54c2-4b2d-a4ca-945f61293c63',
    ownerPersonPublicId: 'person-session-user',
    delegatePersonPublicId: 'person-minseo-kim',
    scopes: ['RESPOND'],
    validFrom: '2026-08-01T00:00:00Z',
    validUntil: '2026-09-01T00:00:00Z',
    status: 'ACTIVE',
    version: 1,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
  },
] as const satisfies readonly CalendarDelegation[];

function fulfillSuccess(route: Route, data: unknown) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data }),
  });
}

const EMPTY_INSIGHT_METRICS: CalendarInsightsMetrics = {
  eventCount: 0,
  meetingMinutes: 0,
  focusMinutes: 0,
  protectedFocusMinutes: 0,
  focusQualityPercent: 0,
  afterHoursMinutes: 0,
  noMeetingDays: 0,
  fragmentedDays: 0,
  conflictCount: 0,
};

function calendarInsightsFixture(weeks: CalendarInsightPeriod): CalendarInsights {
  const trend = Array.from({ length: weeks }, (_, index) => {
    const weekStart = new Date(Date.UTC(2026, 5, 29 + (12 - weeks + index) * 7));
    const metrics: CalendarInsightsMetrics = {
      eventCount: 7 + (index % 4),
      meetingMinutes: 210 + index * 15,
      focusMinutes: 120 + (index % 3) * 30,
      protectedFocusMinutes: 90 + (index % 3) * 30,
      focusQualityPercent: 75 + (index % 3) * 5,
      afterHoursMinutes: index % 3 === 0 ? 30 : 0,
      noMeetingDays: index % 2 === 0 ? 2 : 1,
      fragmentedDays: index % 4 === 0 ? 1 : 0,
      conflictCount: index % 5 === 0 ? 1 : 0,
    };
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    return {
      weekStart: weekStart.toISOString().slice(0, 10),
      weekEnd: weekEnd.toISOString().slice(0, 10),
      metrics,
    };
  });
  const current = trend.reduce<CalendarInsightsMetrics>(
    (total, week) => ({
      eventCount: total.eventCount + week.metrics.eventCount,
      meetingMinutes: total.meetingMinutes + week.metrics.meetingMinutes,
      focusMinutes: total.focusMinutes + week.metrics.focusMinutes,
      protectedFocusMinutes: total.protectedFocusMinutes + week.metrics.protectedFocusMinutes,
      focusQualityPercent: 80,
      afterHoursMinutes: total.afterHoursMinutes + week.metrics.afterHoursMinutes,
      noMeetingDays: total.noMeetingDays + week.metrics.noMeetingDays,
      fragmentedDays: total.fragmentedDays + week.metrics.fragmentedDays,
      conflictCount: total.conflictCount + week.metrics.conflictCount,
    }),
    EMPTY_INSIGHT_METRICS
  );
  return {
    weeks,
    periodStart: trend[0]?.weekStart ?? '2026-08-24',
    periodEnd: trend.at(-1)?.weekEnd ?? '2026-09-20',
    previousPeriodStart: '2026-05-04',
    previousPeriodEnd: '2026-06-28',
    timeZone: 'Asia/Seoul',
    workingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
    workingDayStart: '09:00:00',
    workingDayEnd: '18:00:00',
    current,
    previous: {
      ...current,
      meetingMinutes: Math.max(0, current.meetingMinutes - 120),
      focusMinutes: Math.max(0, current.focusMinutes - 60),
      protectedFocusMinutes: Math.max(0, current.protectedFocusMinutes - 60),
      afterHoursMinutes: current.afterHoursMinutes + 30,
      noMeetingDays: Math.max(0, current.noMeetingDays - 1),
    },
    trend,
    source: 'DWP_NATIVE_CALENDAR',
    completeness: 'COMPLETE',
    generatedAt: '2026-09-17T09:00:00+09:00',
  };
}

async function mockCalendarInsightsContract(page: Page) {
  await page.route('**/api/platform/v1/calendar/home**', async (route) => {
    const url = new URL(route.request().url());
    const value = Number(url.searchParams.get('insightWeeks'));
    if (value !== 4 && value !== 8 && value !== 12) return route.fallback();
    return fulfillSuccess(route, { insights: calendarInsightsFixture(value) });
  });
}

async function mockCalendarRecoveryContracts(page: Page) {
  const restored: CalendarRestoreEventResponse = {
    canViewDetails: true,
    canEdit: true,
    canDelete: true,
    canRestore: false,
    canRespond: false,
    canStar: true,
    outcome: 'EVENT_ONLY_NO_PRIOR_RESOURCE',
    reason: 'NO_PRIOR_RESOURCE',
    eventVersion: 5,
    resources: [],
  };
  await page.route('**/api/platform/v1/calendar/events/*/restore', (route) =>
    fulfillSuccess(route, restored)
  );
  await page.route('**/api/platform/v1/calendar/events/*/resource-rebook', (route) =>
    fulfillSuccess(route, restored)
  );
}

async function mockCalendarSharingContracts(page: Page) {
  await page.route('**/api/platform/v1/calendar/calendars/*/shares', (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return fulfillSuccess(route, [
      ...CALENDAR_SHARES_FIXTURE,
      {
        grantId: 'calendar-grant-design-group',
        principalType: 'GROUP',
        principalPersonPublicId: null,
        principalGroupRef: 'group-platform-design',
        principalDisplayName: 'Platform Design',
        accessLevel: 'VIEW_DETAILS',
        canViewPrivate: false,
        validUntil: null,
        lifecycleState: 'ACTIVE',
        version: 4,
      },
    ]);
  });
}

async function mockCalendarSettingsContracts(page: Page) {
  let settings: CalendarSettings = structuredClone(CALENDAR_SETTINGS_FIXTURE);
  let delegations: CalendarDelegation[] = structuredClone(CALENDAR_DELEGATIONS_FIXTURE);

  await page.route('**/api/platform/v1/calendar/settings**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/platform/v1/calendar/settings') {
      if (request.method() === 'GET') return fulfillSuccess(route, settings);
      const input = request.postDataJSON() as UpdateCalendarSettingsInput;
      settings = {
        ...settings,
        ...input,
        workingDayStart: `${input.workingDayStart.slice(0, 5)}:00`,
        workingDayEnd: `${input.workingDayEnd.slice(0, 5)}:00`,
        version: settings.version + 1,
        updatedAt: '2026-08-11T00:20:00Z',
      };
      return fulfillSuccess(route, settings);
    }
    if (path === '/api/platform/v1/calendar/settings/reset') {
      settings = { ...structuredClone(CALENDAR_SETTINGS_FIXTURE), version: settings.version + 1 };
      return fulfillSuccess(route, settings);
    }
    if (path === '/api/platform/v1/calendar/settings/delegations') {
      if (request.method() === 'GET') return fulfillSuccess(route, delegations);
      const input = request.postDataJSON() as {
        delegatePersonPublicId: string;
        scopes: CalendarDelegation['scopes'];
        validFrom: string;
        validUntil: string;
      };
      const created: CalendarDelegation = {
        delegationId: 'b4200845-79fc-4de8-89a4-c039a3d94cdc',
        ownerPersonPublicId: 'person-session-user',
        ...input,
        status: 'ACTIVE',
        version: 0,
        createdAt: '2026-08-11T00:20:00Z',
        updatedAt: '2026-08-11T00:20:00Z',
      };
      delegations = [...delegations, created];
      return fulfillSuccess(route, created);
    }
    const revoke = path.match(
      /^\/api\/platform\/v1\/calendar\/settings\/delegations\/([^/]+)\/revoke$/u
    );
    if (revoke) {
      const delegationId = decodeURIComponent(revoke[1] ?? '');
      const current = delegations.find((delegation) => delegation.delegationId === delegationId);
      if (!current) return route.fulfill({ status: 404 });
      const revoked: CalendarDelegation = {
        ...current,
        status: 'REVOKED',
        version: current.version + 1,
        updatedAt: '2026-08-11T00:20:00Z',
      };
      delegations = delegations.map((delegation) =>
        delegation.delegationId === delegationId ? revoked : delegation
      );
      return fulfillSuccess(route, revoked);
    }
    return route.fallback();
  });
}

export async function mockCalendarShellSession(
  ...args: Parameters<typeof mockBaseShellSession>
) {
  await mockBaseShellSession(...args);
  await mockCalendarSettingsContracts(args[0]);
  await mockCalendarInsightsContract(args[0]);
  await mockCalendarRecoveryContracts(args[0]);
  await mockCalendarSharingContracts(args[0]);
}
