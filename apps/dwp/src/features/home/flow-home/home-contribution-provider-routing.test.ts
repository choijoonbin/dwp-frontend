import { beforeAll, describe, expect, it } from 'vitest';

import { buildHomeContributionModel, resolveHomeContributionProvider } from '../contributions';
import {
  calendarContributionProvider,
  serviceContributionProvider,
  workplaceContributionProvider,
  workspaceWorkContributionProvider,
} from './home-contribution-providers';
import {
  homeContributionI18nReady,
  translateHomeContributionKo,
} from './home-contribution-i18n.test-support';

import type {
  AppEntitlementPermission,
  CalendarEvent,
  CalendarHome,
  ServiceRequestSummary,
  WorkplaceBooking,
  WorkspaceWorkQueue,
} from '@dwp-frontend/shared-utils';

const NOW = '2026-08-25T01:00:00.000Z';
const CONTEXT = {
  now: NOW,
  snapshotAt: NOW,
  dateKey: '2026-08-25',
  locale: 'ko-KR',
  timeZone: 'Asia/Seoul',
  translate: translateHomeContributionKo,
} as const;

beforeAll(() => homeContributionI18nReady);

function allowResource(resourceKey: string, permissionCode = 'VIEW'): AppEntitlementPermission {
  return { resourceType: 'APP', resourceKey, permissionCode, effect: 'ALLOW' };
}

function workQueue(): WorkspaceWorkQueue {
  return {
    summary: { total: 1, dueSoon: 0, inProgress: 1, waiting: 0, completed: 0 },
    items: [
      {
        workItemId: 'work-42',
        id: 'work-42',
        title: 'Work 42',
        summary: 'Summary 42',
        dataClassification: 'CONFIDENTIAL',
        type: 'Task',
        priority: 'medium',
        status: 'in-progress',
        owner: 'me',
        dueAt: '2026-08-25T06:00:00.000Z',
        sourceSystem: 'WORK',
        sourceReference: 'work-42',
        sourceRoute: '/admin/unsafe-target',
        version: 1,
        updatedAt: NOW,
      },
    ],
    generatedAt: NOW,
  };
}

function serviceRequest(): ServiceRequestSummary {
  return {
    requestId: 'needs-information',
    requestNumber: 'SR-needs-information',
    serviceKey: 'it-help',
    serviceNameKo: 'IT 도움',
    serviceNameEn: 'IT Help',
    summary: 'Service request',
    dataClassification: 'CONFIDENTIAL',
    status: 'AWAITING_REQUESTER',
    priority: 'NORMAL',
    assignedGroup: 'Service Desk',
    submittedAt: NOW,
    slaDueAt: '2026-08-25T10:00:00.000Z',
    updatedAt: NOW,
    version: 1,
  };
}

function calendarEvent(id: string): CalendarEvent {
  return {
    eventId: id,
    calendarId: 'calendar-1',
    calendarName: 'My calendar',
    calendarColor: '#3367d6',
    organizerName: 'Owner',
    title: `Event ${id}`,
    type: 'MEETING',
    startsAt: '2026-08-25T03:00:00.000Z',
    endsAt: '2026-08-25T04:00:00.000Z',
    timeZone: 'Asia/Seoul',
    allDay: false,
    location: 'Room 1',
    status: 'CONFIRMED',
    visibility: 'DEFAULT',
    recurrence: 'NONE',
    recurrenceInterval: 1,
    responseRequired: false,
    attendees: [],
    conflict: false,
    version: 1,
  };
}

function calendarHome(today: CalendarEvent[], date = '2026-08-25'): CalendarHome {
  return {
    date,
    timeZone: 'Asia/Seoul',
    today,
    metrics: {
      eventCount: today.length,
      meetingMinutes: today.length * 60,
      focusMinutes: 0,
      focusTargetMinutes: 120,
      conflictCount: 0,
      awaitingResponseCount: 0,
      availableRoomCount: 0,
    },
    weekLoad: [],
    attention: [],
    generatedAt: NOW,
  };
}

function workplaceBooking(id: string, canCheckIn = false): WorkplaceBooking {
  return {
    bookingId: id,
    resourceId: `resource-${id}`,
    resourceName: `Desk ${id}`,
    resourceType: 'DESK',
    siteName: 'Seoul HQ',
    floorName: '10F',
    purpose: null,
    startsAt: '2026-08-25T03:00:00.000Z',
    endsAt: '2026-08-25T09:00:00.000Z',
    status: 'RESERVED',
    visibleToColleagues: true,
    checkedInAt: null,
    releasedAt: null,
    canCheckIn,
    canCancel: true,
    canRelease: false,
    checkInOpensAt: '2026-08-25T02:30:00.000Z',
    checkInClosesAt: '2026-08-25T03:30:00.000Z',
    version: 1,
  };
}

describe('Home contribution provider route and date contracts', () => {
  it('routes Work through its canonical product destination', () => {
    const [work] = workspaceWorkContributionProvider.normalize(workQueue(), CONTEXT);
    expect(work?.deepLink).toBe('/work/queue?item=work-42');
  });

  it('keeps awaiting-requester Services work non-actionable', () => {
    const [service] = serviceContributionProvider.normalize([serviceRequest()], CONTEXT);
    expect(service).toMatchObject({
      kind: 'REQUEST',
      deepLink: '/services/my/needs-information',
      status: 'AWAITING_REQUESTER',
    });
  });

  it('routes current Calendar events through the schedule destination', () => {
    const [timeline] = calendarContributionProvider.normalize(
      calendarHome([calendarEvent('event-42')]),
      CONTEXT
    );
    expect(timeline?.deepLink).toBe('/calendar/schedule?event=event-42');
  });

  it('fails closed for a Calendar payload from a different zoned date', () => {
    expect(
      calendarContributionProvider.normalize(
        calendarHome([calendarEvent('stale-event')], '2026-08-24'),
        CONTEXT
      )
    ).toEqual([]);
  });

  it('keeps only user-time-zone-today Workplace bookings', () => {
    const tomorrow = {
      ...workplaceBooking('tomorrow'),
      startsAt: '2026-08-26T03:00:00.000Z',
      endsAt: '2026-08-26T04:00:00.000Z',
    };
    expect(
      workplaceContributionProvider
        .normalize([workplaceBooking('today'), tomorrow], CONTEXT)
        .map((item) => item.sourceReference)
    ).toEqual(['today']);
  });

  it('exposes Workplace check-in as an action only with UPDATE authority', () => {
    const result = resolveHomeContributionProvider(
      workplaceContributionProvider,
      { state: 'AVAILABLE', generatedAt: NOW, data: [workplaceBooking('ready', true)] },
      CONTEXT
    );
    const readOnly = buildHomeContributionModel([result], {
      now: NOW,
      permissions: [allowResource('APP.WORKPLACE')],
    });
    expect(readOnly.buckets.action).toEqual([]);
    expect(readOnly.buckets.timeline[0]).toMatchObject({
      id: 'workplace:ready:readonly',
      route: '/workplace/my-bookings',
    });

    const writable = buildHomeContributionModel([result], {
      now: NOW,
      permissions: [allowResource('APP.WORKPLACE'), allowResource('APP.WORKPLACE', 'UPDATE')],
    });
    expect(writable.buckets.action[0]).toMatchObject({ id: 'workplace:ready:check-in' });
    expect(writable.buckets.timeline).toEqual([]);
  });
});
