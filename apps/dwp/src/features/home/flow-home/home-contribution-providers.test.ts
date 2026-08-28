import { beforeAll, describe, expect, it } from 'vitest';

import { buildHomeContributionModel, resolveHomeContributionProvider } from '../contributions';
import {
  homeContributionI18nReady,
  translateHomeContributionKo,
} from './home-contribution-i18n.test-support';
import {
  activityContributionProvider,
  approvalContributionProvider,
  calendarContributionProvider,
  hrContributionProvider,
  notificationContributionProvider,
  serviceContributionProvider,
  workplaceContributionProvider,
  workspaceWorkContributionProvider,
} from './home-contribution-providers';

import type {
  AppEntitlementPermission,
  AppNotificationSummary,
  ApprovalHome,
  ApprovalRequest,
  ApprovalTask,
  CalendarEvent,
  CalendarHome,
  HrHomeOverview,
  ServiceRequestSummary,
  WorkplaceBooking,
  WorkspaceActivityEvent,
  WorkspaceActivityFeed,
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
  return {
    resourceType,
    resourceKey,
    permissionCode,
    effect: 'ALLOW',
  };
}

function allow(appKey: string): AppEntitlementPermission {
  return allowResource('APP', appKey);
}

const ALL_PERMISSIONS = [
  'APP.CALENDAR',
  'APP.WORK',
  'APP.ACTIVITY',
  'APP.APPROVALS',
  'APP.HCM',
  'APP.EMPLOYEE_SERVICES',
  'APP.WORKPLACE',
  'APP.NOTIFICATIONS',
]
  .map(allow)
  .concat([
    allowResource('APP', 'APP.CALENDAR', 'UPDATE'),
    allowResource('APP', 'APP.WORKPLACE', 'UPDATE'),
    allowResource('ACTION', 'ACTION.APPROVAL_TASK'),
    allowResource('ACTION', 'ACTION.APPROVAL_TASK', 'APPROVE'),
    allowResource('ACTION', 'ACTION.APPROVAL_REQUEST'),
    allowResource('ACTION', 'ACTION.APPROVAL_REQUEST', 'UPDATE'),
    allowResource('ADMIN', 'ADMIN.APPROVAL_OPERATIONS'),
  ]);

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

function calendarHome(today: CalendarEvent[], awaitingResponseCount = 0): CalendarHome {
  return {
    date: '2026-08-25',
    timeZone: 'Asia/Seoul',
    today,
    metrics: {
      eventCount: today.length,
      meetingMinutes: today.length * 60,
      focusMinutes: 0,
      focusTargetMinutes: 120,
      conflictCount: today.filter((event) => event.conflict).length,
      awaitingResponseCount,
      availableRoomCount: 0,
    },
    weekLoad: [],
    attention: [],
    generatedAt: NOW,
  };
}

function activityEvent(
  id: string,
  state: WorkspaceActivityEvent['state'] = 'needs-input'
): WorkspaceActivityEvent {
  return {
    id,
    occurredAt: NOW,
    actor: 'system',
    actorName: 'DWP',
    state,
    title: `Activity ${id}`,
    objectType: 'TASK',
    objectLabel: id,
    source: 'WORK',
    auditId: `audit-${id}`,
  };
}

function activityFeed(events: WorkspaceActivityEvent[]): WorkspaceActivityFeed {
  return { events, generatedAt: NOW };
}

function approvalTask(id: string, requestId = id): ApprovalTask {
  return {
    taskId: id,
    requestId,
    requestNumber: `REQ-${requestId}`,
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

function approvalRequest(
  id: string,
  status: ApprovalRequest['status'] = 'SUBMITTED'
): ApprovalRequest {
  return {
    requestId: id,
    requestNumber: `REQ-${id}`,
    title: `Approval request ${id}`,
    summary: `Request summary ${id}`,
    workflowNameKo: '결재',
    workflowNameEn: 'Approval',
    currentStepName: 'Review',
    totalSteps: 2,
    status,
    priority: 'NORMAL',
    dataClassification: 'CONFIDENTIAL',
    dueAt: '2026-08-25T09:00:00.000Z',
    version: 1,
  };
}

function approvalHome(
  focusQueue: ApprovalTask[],
  recentRequests: ApprovalRequest[] = []
): ApprovalHome {
  return {
    generatedAt: NOW,
    metrics: {
      pending: focusQueue.length,
      dueToday: 0,
      overdue: 0,
      needsInformation: recentRequests.filter((request) => request.status === 'NEEDS_INFO').length,
      myRequestsInFlight: recentRequests.length,
      averageCycleHours: 0,
      slaCompliancePercent: 100,
    },
    focusQueue,
    recentRequests,
    flow: [],
    insights: [],
    administrator: false,
  };
}

function hrHome(overrides: Partial<HrHomeOverview> = {}): HrHomeOverview {
  return {
    asOf: NOW,
    generatedAt: NOW,
    timeZone: 'Asia/Seoul',
    standardDayMinutes: 480,
    employee: { personId: 'person-1', displayName: 'User', directReportCount: 0 },
    time: null,
    leaveBalances: [],
    pay: null,
    enrollmentWindows: [],
    journeys: [],
    activeBenefitCount: 0,
    openBenefitWindowCount: 0,
    activeGoalCount: 0,
    requiredLearningCount: 0,
    teamPendingCount: 0,
    teamTimePendingCount: 0,
    teamAbsencePendingCount: 0,
    domainStates: {},
    referenceDataPresent: true,
    ...overrides,
  };
}

function serviceRequest(
  id: string,
  status: ServiceRequestSummary['status'] = 'SUBMITTED'
): ServiceRequestSummary {
  return {
    requestId: id,
    requestNumber: `SR-${id}`,
    serviceKey: 'it-help',
    serviceNameKo: 'IT 도움',
    serviceNameEn: 'IT Help',
    summary: `Service request ${id}`,
    dataClassification: 'CONFIDENTIAL',
    status,
    priority: 'NORMAL',
    assignedGroup: 'Service Desk',
    submittedAt: NOW,
    slaDueAt: '2026-08-25T10:00:00.000Z',
    updatedAt: NOW,
    version: 1,
  };
}

function workplaceBooking(id: string, overrides: Partial<WorkplaceBooking> = {}): WorkplaceBooking {
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
    ...overrides,
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

const cardinalityCases = [
  {
    provider: 'workspace work',
    zero: () => workspaceWorkContributionProvider.normalize(workQueue([]), CONTEXT),
    one: () =>
      workspaceWorkContributionProvider.normalize(workQueue([workItem('work-1')]), CONTEXT),
    many: () =>
      workspaceWorkContributionProvider.normalize(
        workQueue([
          workItem('work-1'),
          workItem('work-2'),
          workItem('done', { status: 'completed' }),
        ]),
        CONTEXT
      ),
    oneCount: 2,
    manyCount: 3,
  },
  {
    provider: 'calendar',
    zero: () => calendarContributionProvider.normalize(calendarHome([]), CONTEXT),
    one: () =>
      calendarContributionProvider.normalize(calendarHome([calendarEvent('event-1')]), CONTEXT),
    many: () =>
      calendarContributionProvider.normalize(
        calendarHome([calendarEvent('event-1'), calendarEvent('event-2')], 2),
        CONTEXT
      ),
    oneCount: 2,
    manyCount: 5,
  },
  {
    provider: 'activity aggregation',
    zero: () => activityContributionProvider.normalize(activityFeed([]), CONTEXT),
    one: () =>
      activityContributionProvider.normalize(activityFeed([activityEvent('activity-1')]), CONTEXT),
    many: () =>
      activityContributionProvider.normalize(
        activityFeed([activityEvent('activity-1'), activityEvent('activity-2', 'policy-blocked')]),
        CONTEXT
      ),
    manyCount: 1,
    manyAggregateCount: 2,
  },
  {
    provider: 'approval',
    zero: () =>
      approvalContributionProvider.normalize(
        { home: approvalHome([]), audience: 'MEMBER' },
        CONTEXT
      ),
    one: () =>
      approvalContributionProvider.normalize(
        { home: approvalHome([approvalTask('task-1')]), audience: 'MEMBER' },
        CONTEXT
      ),
    many: () =>
      approvalContributionProvider.normalize(
        {
          home: approvalHome(
            [approvalTask('task-1'), approvalTask('task-2')],
            [approvalRequest('request-1'), approvalRequest('request-2', 'NEEDS_INFO')]
          ),
          audience: 'MEMBER',
        },
        CONTEXT
      ),
    oneCount: 2,
    manyCount: 7,
  },
  {
    provider: 'HR',
    zero: () => hrContributionProvider.normalize({ home: hrHome(), audience: 'MEMBER' }, CONTEXT),
    one: () =>
      hrContributionProvider.normalize(
        { home: hrHome({ requiredLearningCount: 1 }), audience: 'MEMBER' },
        CONTEXT
      ),
    many: () =>
      hrContributionProvider.normalize(
        {
          home: hrHome({
            time: {
              timeCardId: 'time-1',
              periodStart: '2026-08-01',
              periodEnd: '2026-08-31',
              status: 'DRAFT',
              scheduledMinutes: 480,
              recordedMinutes: 420,
              exceptionCount: 1,
              dataOrigin: 'SOURCE',
              version: 1,
            },
            requiredLearningCount: 1,
            openBenefitWindowCount: 1,
            teamPendingCount: 2,
          }),
          audience: 'MANAGER',
        },
        CONTEXT
      ),
    manyCount: 4,
  },
  {
    provider: 'employee services',
    zero: () => serviceContributionProvider.normalize([], CONTEXT),
    one: () => serviceContributionProvider.normalize([serviceRequest('service-1')], CONTEXT),
    many: () =>
      serviceContributionProvider.normalize(
        [
          serviceRequest('service-1'),
          serviceRequest('service-2', 'AWAITING_REQUESTER'),
          serviceRequest('closed', 'CLOSED'),
        ],
        CONTEXT
      ),
    manyCount: 2,
  },
  {
    provider: 'workplace',
    zero: () => workplaceContributionProvider.normalize([], CONTEXT),
    one: () => workplaceContributionProvider.normalize([workplaceBooking('booking-1')], CONTEXT),
    many: () =>
      workplaceContributionProvider.normalize(
        [
          workplaceBooking('booking-1'),
          workplaceBooking('booking-2', { canCheckIn: true }),
          workplaceBooking('cancelled', { status: 'CANCELLED' }),
        ],
        CONTEXT
      ),
    manyCount: 3,
  },
  {
    provider: 'notification',
    zero: () => notificationContributionProvider.normalize(notificationSummary([]), CONTEXT),
    one: () =>
      notificationContributionProvider.normalize(
        notificationSummary([
          { appKey: 'approvals', totalUnread: 2, actionableUnread: 1, urgentUnread: 0 },
        ]),
        CONTEXT
      ),
    many: () =>
      notificationContributionProvider.normalize(
        notificationSummary([
          { appKey: 'approvals', totalUnread: 2, actionableUnread: 1, urgentUnread: 0 },
          { appKey: 'mail', totalUnread: 3, actionableUnread: 2, urgentUnread: 1 },
          { appKey: 'space', totalUnread: 4, actionableUnread: 0, urgentUnread: 0 },
        ]),
        CONTEXT
      ),
    manyCount: 2,
  },
] as const;

describe.each(cardinalityCases)('$provider Home Contribution adapter', (testCase) => {
  it('handles zero, one and many source records according to its aggregation policy', () => {
    expect(testCase.zero()).toHaveLength(0);
    expect(testCase.one()).toHaveLength('oneCount' in testCase ? testCase.oneCount : 1);
    const many = testCase.many();
    expect(many).toHaveLength(testCase.manyCount);
    if ('manyAggregateCount' in testCase) expect(many[0].count).toBe(testCase.manyAggregateCount);
  });
});

describe('integrated Home Contribution adapters', () => {
  it('fails work and activity providers closed against their exact backend authorities', () => {
    const work = resolveHomeContributionProvider(
      workspaceWorkContributionProvider,
      { state: 'AVAILABLE', generatedAt: NOW, data: workQueue([workItem('work-1')]) },
      CONTEXT
    );
    const activity = resolveHomeContributionProvider(
      activityContributionProvider,
      { state: 'AVAILABLE', generatedAt: NOW, data: activityFeed([activityEvent('activity-1')]) },
      CONTEXT
    );

    const missing = buildHomeContributionModel([work, activity], { now: NOW, permissions: [] });
    expect(missing.providers.map(({ providerKey, state }) => [providerKey, state])).toEqual([
      ['workspace-activity', 'FORBIDDEN'],
      ['workspace-work', 'FORBIDDEN'],
    ]);

    const scoped = buildHomeContributionModel([work, activity], {
      now: NOW,
      permissions: [
        allow('APP.WORK'),
        allow('APP.ACTIVITY'),
        { ...allow('APP.ACTIVITY'), effect: 'DENY' },
      ],
    });
    expect(scoped.providers.map(({ providerKey, state }) => [providerKey, state])).toEqual([
      ['workspace-activity', 'FORBIDDEN'],
      ['workspace-work', 'AVAILABLE'],
    ]);
  });

  it('blocks a real app provider when entitlement is missing or explicitly denied', () => {
    const result = resolveHomeContributionProvider(
      approvalContributionProvider,
      {
        state: 'AVAILABLE',
        generatedAt: NOW,
        data: { home: approvalHome([approvalTask('task-1')]), audience: 'MEMBER' },
      },
      CONTEXT
    );

    for (const permissions of [
      [],
      [{ ...allow('APP.APPROVALS'), permissionCode: 'USE' }],
      [{ ...allow('APP.APPROVALS'), effect: 'DENY' }],
      [allow('APP.APPROVALS'), { ...allow('APP.APPROVALS'), effect: 'DENY' }],
    ]) {
      const model = buildHomeContributionModel([result], { now: NOW, permissions });
      expect(model.providers[0]).toMatchObject({
        providerKey: 'approval-home',
        state: 'FORBIDDEN',
        visibleCount: 0,
      });
      expect(model.buckets.action).toEqual([]);
      expect(model.diagnostics.unauthorizedCount).toBe(2);
    }
  });

  it('filters cached approval tasks, requests, and operations by their item authority', () => {
    const source = resolveHomeContributionProvider(
      approvalContributionProvider,
      {
        state: 'AVAILABLE',
        generatedAt: NOW,
        data: {
          home: {
            ...approvalHome([approvalTask('task-1')], [approvalRequest('request-1', 'NEEDS_INFO')]),
            administrator: true,
            adminPulse: {
              publishedWorkflows: 1,
              draftWorkflows: 0,
              activeRequests: 1,
              overdueTasks: 1,
              failedIntegrations: 1,
              assurance: [],
            },
          },
          audience: 'OPERATOR',
        },
      },
      CONTEXT
    );
    const permissions = [
      allow('APP.APPROVALS'),
      allowResource('ACTION', 'ACTION.APPROVAL_TASK', 'APPROVE'),
    ];

    const model = buildHomeContributionModel([source], { now: NOW, permissions });

    expect(model.buckets.action.map((item) => item.id)).toEqual(['approval-task:task-1']);
    expect(model.buckets.response).toEqual([]);
    expect(model.buckets.pulse).toEqual([]);
    expect(model.diagnostics.unauthorizedCount).toBe(5);

    const revoked = buildHomeContributionModel([source], {
      now: NOW,
      permissions: [
        ...permissions,
        { ...allowResource('ACTION', 'ACTION.APPROVAL_TASK', 'APPROVE'), effect: 'DENY' },
      ],
    });
    expect(revoked.buckets.action).toEqual([]);
  });

  it('separates read-only approval awareness from write-authorized actions', () => {
    const source = resolveHomeContributionProvider(
      approvalContributionProvider,
      {
        state: 'AVAILABLE',
        generatedAt: NOW,
        data: {
          home: approvalHome(
            [approvalTask('task-view', 'task-request')],
            [approvalRequest('request-view', 'NEEDS_INFO')]
          ),
          audience: 'OPERATOR',
        },
      },
      CONTEXT
    );
    const base = [allow('APP.APPROVALS')];
    const readOnly = buildHomeContributionModel([source], {
      now: NOW,
      permissions: [
        ...base,
        allowResource('ACTION', 'ACTION.APPROVAL_TASK', 'VIEW'),
        allowResource('ACTION', 'ACTION.APPROVAL_REQUEST', 'VIEW'),
      ],
    });

    expect(readOnly.buckets.action).toEqual([]);
    expect(readOnly.buckets.response).toEqual([]);
    expect(readOnly.buckets.pulse[0]).toMatchObject({
      id: 'approval-task-view:task-view',
      scope: 'ME',
    });
    expect(readOnly.buckets.request[0]).toMatchObject({
      id: 'approval-request-view:request-view',
      scope: 'ME',
    });

    const writable = buildHomeContributionModel([source], {
      now: NOW,
      permissions: [
        ...base,
        allowResource('ACTION', 'ACTION.APPROVAL_TASK', 'APPROVE'),
        allowResource('ACTION', 'ACTION.APPROVAL_REQUEST', 'UPDATE'),
      ],
    });
    expect(writable.buckets.action[0]).toMatchObject({
      id: 'approval-task:task-view',
      scope: 'ME',
    });
    expect(writable.buckets.response[0]).toMatchObject({
      id: 'approval-request:request-view',
      scope: 'ME',
    });
    expect(writable.buckets.request).toEqual([]);
    expect(writable.buckets.pulse).toEqual([]);
  });

  it('uses the source-verified approval administrator flag, not a global audience label', () => {
    const adminPulse = {
      publishedWorkflows: 1,
      draftWorkflows: 0,
      activeRequests: 1,
      overdueTasks: 1,
      failedIntegrations: 1,
      assurance: [],
    };
    const resultFor = (administrator: boolean, audience: 'MEMBER' | 'OPERATOR') =>
      resolveHomeContributionProvider(
        approvalContributionProvider,
        {
          state: 'AVAILABLE',
          generatedAt: NOW,
          data: {
            home: { ...approvalHome([]), administrator, adminPulse },
            audience,
          },
        },
        CONTEXT
      );
    const permissions = [
      allow('APP.APPROVALS'),
      allowResource('ADMIN', 'ADMIN.APPROVAL_OPERATIONS', 'VIEW'),
    ];

    expect(
      buildHomeContributionModel([resultFor(false, 'OPERATOR')], { now: NOW, permissions }).buckets
        .pulse
    ).toEqual([]);
    expect(
      buildHomeContributionModel([resultFor(true, 'MEMBER')], {
        now: NOW,
        permissions,
      }).buckets.pulse.map((item) => item.id)
    ).toEqual(['approval-ops:failed-integrations', 'approval-ops:overdue']);
  });

  it('groups visually identical approval assignments into one actionable count', () => {
    const first = approvalTask('task-1', 'request-1');
    const second = approvalTask('task-2', 'request-2');
    const shared = {
      title: '운영 로그 조회 권한 연장',
      summary: 'Finance & Risk 팀',
      stepName: 'Review',
      dueAt: '2026-08-25T08:00:00.000Z',
    };
    const result = resolveHomeContributionProvider(
      approvalContributionProvider,
      {
        state: 'AVAILABLE',
        generatedAt: NOW,
        data: {
          home: approvalHome([
            { ...first, ...shared },
            { ...second, ...shared },
          ]),
          audience: 'OPERATOR',
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
    });

    expect(model.buckets.action).toHaveLength(1);
    expect(model.buckets.action[0]).toMatchObject({
      title: shared.title,
      count: 2,
      route: '/approvals/inbox',
      duplicateCount: 2,
    });
  });

  it('keeps Calendar response prompts read-only unless UPDATE is explicitly granted', () => {
    const result = resolveHomeContributionProvider(
      calendarContributionProvider,
      {
        state: 'AVAILABLE',
        generatedAt: NOW,
        data: calendarHome([], 2),
      },
      CONTEXT
    );

    const readOnly = buildHomeContributionModel([result], {
      now: NOW,
      permissions: [allow('APP.CALENDAR')],
    });
    expect(readOnly.buckets.response).toEqual([]);
    expect(readOnly.buckets.pulse[0]).toMatchObject({
      id: 'calendar:awaiting-response-readonly',
      count: 2,
      route: '/calendar/home',
    });

    const writable = buildHomeContributionModel([result], {
      now: NOW,
      permissions: [allow('APP.CALENDAR'), allowResource('APP', 'APP.CALENDAR', 'UPDATE')],
    });
    expect(writable.buckets.response[0]).toMatchObject({
      id: 'calendar:awaiting-response',
      count: 2,
    });
    expect(writable.buckets.pulse).toEqual([]);
  });

  it('globally dedupes real cross-app objects and routes each object to one purpose bucket', () => {
    const workspace = resolveHomeContributionProvider(
      workspaceWorkContributionProvider,
      {
        state: 'AVAILABLE',
        generatedAt: NOW,
        data: workQueue([
          workItem('service-work', {
            sourceSystem: 'IT Service',
            sourceReference: 'service-1',
          }),
          workItem('approval-work', {
            sourceSystem: 'Approval Service',
            sourceReference: 'approval-1',
          }),
          workItem('independent-action'),
        ]),
      },
      CONTEXT
    );
    const services = resolveHomeContributionProvider(
      serviceContributionProvider,
      {
        state: 'AVAILABLE',
        generatedAt: NOW,
        data: [
          serviceRequest('service-1', 'AWAITING_REQUESTER'),
          serviceRequest('service-2', 'SUBMITTED'),
        ],
      },
      CONTEXT
    );
    const approvals = resolveHomeContributionProvider(
      approvalContributionProvider,
      {
        state: 'AVAILABLE',
        generatedAt: NOW,
        data: {
          home: approvalHome(
            [approvalTask('approval-task-1', 'approval-1')],
            [approvalRequest('approval-1', 'NEEDS_INFO')]
          ),
          audience: 'MEMBER',
        },
      },
      CONTEXT
    );
    const calendar = resolveHomeContributionProvider(
      calendarContributionProvider,
      {
        state: 'AVAILABLE',
        generatedAt: NOW,
        data: calendarHome([calendarEvent('event-1')], 1),
      },
      CONTEXT
    );
    const activity = resolveHomeContributionProvider(
      activityContributionProvider,
      {
        state: 'AVAILABLE',
        generatedAt: NOW,
        data: activityFeed([activityEvent('activity-1')]),
      },
      CONTEXT
    );

    const model = buildHomeContributionModel([workspace, services, approvals, calendar, activity], {
      now: NOW,
      permissions: ALL_PERMISSIONS,
    });

    expect(model.buckets.action.map((item) => item.id)).toEqual([
      'workspace-work:service-work',
      'workspace-work:independent-action',
    ]);
    expect(model.buckets.response.map((item) => item.id)).toEqual([
      'approval-request:approval-1',
      'calendar:awaiting-response',
    ]);
    expect(model.buckets.request.map((item) => item.id)).toEqual(['service-request:service-2']);
    expect(model.buckets.timeline.map((item) => item.id)).toEqual(['calendar:event-1']);
    expect(model.buckets.pulse.map((item) => item.id)).toEqual([
      'calendar:focus-pulse:2026-08-25',
      'activity:attention',
      'workspace-work:open-pulse',
    ]);

    const everyItem = Object.values(model.buckets).flat();
    const dedupeKeys = everyItem.map((item) => item.dedupeKey.toLocaleLowerCase());
    expect(new Set(dedupeKeys).size).toBe(dedupeKeys.length);
    expect(everyItem.filter((item) => item.dedupeKey === 'SERVICE:service-1')).toHaveLength(1);
    expect(everyItem.filter((item) => item.dedupeKey === 'APPROVAL:approval-1')).toHaveLength(1);
    expect(model.diagnostics).toMatchObject({ deduplicatedCount: 6, visibleCount: 9 });
  });
});
