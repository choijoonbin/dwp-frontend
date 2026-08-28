import { beforeAll, describe, expect, it } from 'vitest';

import { buildHomeContributionModel, resolveHomeContributionProvider } from '../contributions';
import {
  homeContributionI18nReady,
  translateHomeContributionKo,
} from './home-contribution-i18n.test-support';
import {
  approvalContributionProvider,
  calendarContributionProvider,
  notificationContributionProvider,
  serviceContributionProvider,
  workplaceContributionProvider,
  workspaceWorkContributionProvider,
} from './home-contribution-providers';

import type {
  AppEntitlementPermission,
  AppNotificationSummary,
  ApprovalHome,
  ApprovalTask,
  CalendarEvent,
  CalendarHome,
  ServiceRequestSummary,
  WorkplaceBooking,
  WorkspaceWorkItem,
  WorkspaceWorkQueue,
} from '@dwp-frontend/shared-utils';

const NOW = '2026-08-25T01:00:00.000Z';
beforeAll(() => homeContributionI18nReady);

const CONTEXT = {
  now: NOW,
  snapshotAt: NOW,
  dateKey: '2026-08-25',
  locale: 'ko-KR',
  timeZone: 'Asia/Seoul',
  translate: translateHomeContributionKo,
} as const;

function allowResource(
  resourceType: string,
  resourceKey: string,
  permissionCode = 'VIEW'
): AppEntitlementPermission {
  return { resourceType, resourceKey, permissionCode, effect: 'ALLOW' };
}

function allow(appKey: string): AppEntitlementPermission {
  return allowResource('APP', appKey);
}

function workItem(id: string, overrides: Partial<WorkspaceWorkItem> = {}): WorkspaceWorkItem {
  return {
    workItemId: id,
    id,
    title: `Work ${id}`,
    summary: `Summary ${id}`,
    dataClassification: 'CONFIDENTIAL',
    type: 'Task',
    priority: 'medium',
    status: 'in-progress',
    owner: 'me',
    dueAt: '2026-08-25T06:00:00.000Z',
    sourceSystem: 'WORK',
    sourceReference: id,
    sourceRoute: `/work/${id}`,
    version: 1,
    updatedAt: NOW,
    ...overrides,
  };
}

function workQueue(items: WorkspaceWorkItem[]): WorkspaceWorkQueue {
  return {
    summary: {
      total: items.length,
      dueSoon: 0,
      inProgress: items.filter((item) => item.status === 'in-progress').length,
      waiting: 0,
      completed: items.filter((item) => item.status === 'completed').length,
    },
    items,
    generatedAt: NOW,
  };
}

function serviceRequest(id: string): ServiceRequestSummary {
  return {
    requestId: id,
    requestNumber: `SR-${id}`,
    serviceKey: 'it-help',
    serviceNameKo: 'IT 도움',
    serviceNameEn: 'IT Help',
    summary: `Service request ${id}`,
    dataClassification: 'CONFIDENTIAL',
    status: 'SUBMITTED',
    priority: 'NORMAL',
    assignedGroup: 'Service Desk',
    submittedAt: NOW,
    slaDueAt: '2026-08-25T10:00:00.000Z',
    updatedAt: NOW,
    version: 1,
  };
}

function notificationSummary(
  apps: Array<{
    appKey: string;
    totalUnread: number;
    actionableUnread: number;
    urgentUnread: number;
  }>
): AppNotificationSummary {
  return {
    partial: false,
    unavailableSources: [],
    apps: apps.map((app) => ({
      ...app,
      appKey: app.appKey as AppNotificationSummary['apps'][number]['appKey'],
      lastActivityAt: NOW as AppNotificationSummary['apps'][number]['lastActivityAt'],
    })),
    changeVersion: '1',
    counterVersion: '1',
    generatedAt: NOW as AppNotificationSummary['generatedAt'],
  };
}

function approvalTask(id: string): ApprovalTask {
  return {
    taskId: id,
    requestId: id,
    requestNumber: `REQ-${id}`,
    title: `Approval task ${id}`,
    summary: `Task summary ${id}`,
    workflowNameKo: '결재',
    workflowNameEn: 'Approval',
    stepKey: 'review',
    stepName: 'Review',
    stepSequence: 1,
    status: 'PENDING',
    priority: 'NORMAL',
    dataClassification: 'CONFIDENTIAL',
    riskScore: 0,
    dueAt: '2026-08-25T08:00:00.000Z',
    version: 1,
  };
}

function approvalHome(focusQueue: ApprovalTask[]): ApprovalHome {
  return {
    generatedAt: NOW,
    metrics: {
      pending: focusQueue.length,
      dueToday: 0,
      overdue: 0,
      needsInformation: 0,
      myRequestsInFlight: 0,
      averageCycleHours: 0,
      slaCompliancePercent: 100,
    },
    focusQueue,
    recentRequests: [],
    flow: [],
    insights: [],
    administrator: false,
  };
}

function calendarEvent(id: string, overrides: Partial<CalendarEvent> = {}): CalendarEvent {
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
    ...overrides,
  };
}

function calendarHome(today: CalendarEvent[]): CalendarHome {
  return {
    date: '2026-08-25',
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

function workplaceBooking(id: string): WorkplaceBooking {
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
    canCheckIn: false,
    canCancel: true,
    canRelease: false,
    checkInOpensAt: '2026-08-25T02:30:00.000Z',
    checkInClosesAt: '2026-08-25T03:30:00.000Z',
    version: 1,
  };
}

describe('Home contribution privacy contracts', () => {
  it('routes notification contributions only to the authorized Notification Center', () => {
    const items = notificationContributionProvider.normalize(
      notificationSummary([
        { appKey: 'approvals', totalUnread: 2, actionableUnread: 2, urgentUnread: 0 },
        { appKey: 'hcm', totalUnread: 1, actionableUnread: 1, urgentUnread: 1 },
      ]),
      CONTEXT
    );

    expect(items.map((item) => item.deepLink)).toEqual([
      '/notifications/home',
      '/notifications/home',
    ]);
  });

  it('reports notification counts without conflating urgent and actionable populations', () => {
    const actionableOnly = notificationContributionProvider.normalize(
      notificationSummary([
        { appKey: 'approvals', totalUnread: 4, actionableUnread: 3, urgentUnread: 0 },
      ]),
      CONTEXT
    );
    expect(actionableOnly[0]).toMatchObject({ kind: 'RESPONSE', count: 3, status: 'ACTIONABLE' });

    const urgentOnly = notificationContributionProvider.normalize(
      notificationSummary([
        { appKey: 'mail', totalUnread: 4, actionableUnread: 0, urgentUnread: 2 },
      ]),
      CONTEXT
    );
    expect(urgentOnly[0]).toMatchObject({ kind: 'PULSE', count: 2, status: 'URGENT' });

    const both = notificationContributionProvider.normalize(
      notificationSummary([
        { appKey: 'hcm', totalUnread: 8, actionableUnread: 5, urgentUnread: 2 },
      ]),
      CONTEXT
    );
    expect(both).toHaveLength(1);
    expect(both[0]).toMatchObject({ kind: 'RESPONSE', count: 5, priority: 'CRITICAL' });
  });

  it('treats per-app notification counts as confidential runtime aggregates', () => {
    const result = resolveHomeContributionProvider(
      notificationContributionProvider,
      {
        state: 'AVAILABLE',
        generatedAt: NOW,
        data: notificationSummary([
          { appKey: 'approvals', totalUnread: 4, actionableUnread: 3, urgentUnread: 0 },
        ]),
      },
      CONTEXT
    );
    const model = buildHomeContributionModel([result], {
      now: NOW,
      permissions: [allow('APP.NOTIFICATIONS')],
    });

    expect(model.buckets.response[0]).toMatchObject({
      title: '전자결재 알림 확인',
      description: null,
      count: 3,
      route: '/notifications/home',
      privacy: { classification: 'CONFIDENTIAL', redaction: 'TITLE_ONLY' },
    });
  });

  it('fails closed for restricted or unknown approval classifications', () => {
    for (const dataClassification of ['RESTRICTED', 'LEGACY_SECRET']) {
      const result = resolveHomeContributionProvider(
        approvalContributionProvider,
        {
          state: 'AVAILABLE',
          generatedAt: NOW,
          data: {
            home: approvalHome([
              { ...approvalTask(`task-${dataClassification}`), dataClassification },
            ]),
            audience: 'MEMBER',
          },
        },
        CONTEXT
      );
      const model = buildHomeContributionModel([result], {
        now: NOW,
        permissions: [
          allow('APP.APPROVALS'),
          allowResource('ACTION', 'ACTION.APPROVAL_TASK', 'APPROVE'),
        ],
        redactionPolicy: { fallbackTitle: '보호된 항목' },
      });

      expect(model.buckets.action[0]).toMatchObject({
        title: '보호된 항목',
        description: null,
        route: '',
        sourceReference: 'REDACTED',
        privacy: { classification: 'RESTRICTED', redaction: 'COUNT_ONLY' },
      });
    }
  });

  it('uses the array query snapshot instead of an old service object update clock', () => {
    const [request] = serviceContributionProvider.normalize(
      [{ ...serviceRequest('snapshot'), updatedAt: '2025-01-01T00:00:00.000Z' }],
      CONTEXT
    );

    expect(request?.generatedAt).toBe(CONTEXT.snapshotAt);
  });

  it('carries every Services classification into Home and fails unknown values closed', () => {
    const expectations = [
      ['PUBLIC', 'NONE'],
      ['INTERNAL', 'NONE'],
      ['CONFIDENTIAL', 'TITLE_ONLY'],
      ['RESTRICTED', 'COUNT_ONLY'],
      ['LEGACY_SECRET', 'COUNT_ONLY'],
      [undefined, 'COUNT_ONLY'],
    ] as const;

    for (const [classification, redaction] of expectations) {
      const source = serviceRequest(`classification-${String(classification)}`);
      source.dataClassification = classification as ServiceRequestSummary['dataClassification'];
      const result = resolveHomeContributionProvider(
        serviceContributionProvider,
        { state: 'AVAILABLE', generatedAt: NOW, data: [source] },
        CONTEXT
      );
      const model = buildHomeContributionModel([result], {
        now: NOW,
        permissions: [allow('APP.EMPLOYEE_SERVICES')],
        redactionPolicy: { fallbackTitle: '보호된 항목' },
      });
      const item = model.buckets.request[0];
      expect(item).toBeDefined();
      if (!item) throw new Error('Expected a Services contribution');

      expect(item.privacy.redaction).toBe(redaction);
      if (redaction === 'COUNT_ONLY') {
        expect(item).toMatchObject({
          title: '보호된 항목',
          description: null,
          route: '',
          sourceReference: 'REDACTED',
          privacy: { classification: 'RESTRICTED' },
        });
        expect(JSON.stringify(item)).not.toContain(source.summary);
      } else {
        expect(item.title).toBe(source.summary);
        expect(item.route).toContain(source.requestId);
        expect(item.description === null).toBe(redaction === 'TITLE_ONLY');
      }
    }
  });

  it('uses the workspace projection classification and fails missing values closed', () => {
    for (const dataClassification of ['CONFIDENTIAL', 'RESTRICTED', 'UNREGISTERED', undefined]) {
      const source = workItem(`work-${String(dataClassification)}`, { dataClassification });
      const result = resolveHomeContributionProvider(
        workspaceWorkContributionProvider,
        { state: 'AVAILABLE', generatedAt: NOW, data: workQueue([source]) },
        CONTEXT
      );
      const model = buildHomeContributionModel([result], {
        now: NOW,
        permissions: [allow('APP.WORK')],
        redactionPolicy: { fallbackTitle: '보호된 항목' },
      });
      const item = model.buckets.action[0];
      expect(item).toBeDefined();
      if (!item) throw new Error('Expected a Workspace contribution');

      if (dataClassification === 'CONFIDENTIAL') {
        expect(item).toMatchObject({
          title: source.title,
          description: null,
          privacy: { classification: 'CONFIDENTIAL', redaction: 'TITLE_ONLY' },
        });
      } else {
        expect(item).toMatchObject({
          title: '보호된 항목',
          route: '',
          sourceReference: 'REDACTED',
          privacy: { classification: 'RESTRICTED', redaction: 'COUNT_ONLY' },
        });
        expect(JSON.stringify(item)).not.toContain(source.title);
      }
    }
  });

  it('redacts sensitive calendar content and retains only safe workplace title navigation', () => {
    const secretCalendar = resolveHomeContributionProvider(
      calendarContributionProvider,
      {
        state: 'AVAILABLE',
        generatedAt: NOW,
        data: calendarHome([
          calendarEvent('secret-event', {
            title: 'Project Aurora acquisition',
            visibility: 'CONFIDENTIAL',
            location: 'Executive room',
          }),
        ]),
      },
      CONTEXT
    );
    const workplace = resolveHomeContributionProvider(
      workplaceContributionProvider,
      { state: 'AVAILABLE', generatedAt: NOW, data: [workplaceBooking('booking-1')] },
      CONTEXT
    );
    const model = buildHomeContributionModel([secretCalendar, workplace], {
      now: NOW,
      permissions: [allow('APP.CALENDAR'), allow('APP.WORKPLACE')],
      redactionPolicy: { fallbackTitle: '보호된 항목' },
    });

    expect(model.buckets.timeline).toHaveLength(2);
    const calendar = model.buckets.timeline.find((item) => item.providerKey === 'calendar-home');
    expect(calendar).toMatchObject({
      title: '보호된 일정',
      description: null,
      route: '',
      sourceReference: 'REDACTED',
      privacy: { redaction: 'COUNT_ONLY', sensitive: true },
    });
    expect(JSON.stringify(calendar)).not.toContain('Aurora');
    expect(JSON.stringify(calendar)).not.toContain('Executive room');
    expect(JSON.stringify(calendar)).not.toContain('secret-event');

    const booking = model.buckets.timeline.find(
      (item) => item.providerKey === 'workplace-bookings'
    );
    expect(booking).toMatchObject({
      title: 'Desk booking-1',
      description: null,
      route: '/workplace/my-bookings',
      privacy: { redaction: 'TITLE_ONLY', sensitive: false },
    });
  });
});
