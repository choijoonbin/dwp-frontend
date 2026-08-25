import {
  createHomeContributionProvider,
  type HomeContributionInput,
  type HomeContributionPriority,
  type HomeContributionProviderContext,
  type HomePrivacyClassification,
} from '../contributions';
import { resolveZonedDateKey } from '@dwp-frontend/shared-i18n';

import type {
  AppNotificationSummary,
  ApprovalHome,
  ApprovalPriority,
  CalendarHome,
  HomeAudienceProfile,
  HrHomeOverview,
  ServiceRequestPriority,
  ServiceRequestSummary,
  WorkspaceActivityFeed,
  WorkspaceWorkQueue,
  WorkplaceBooking,
} from '@dwp-frontend/shared-utils';

const HOME_SOURCE_FRESHNESS_MS = 5 * 60 * 1000;

export const homeAppReadAuthority = (
  resourceKey: string,
  permissionCodes: readonly string[] = ['VIEW']
) => ({
  allOf: [
    {
      resourceType: 'APP',
      resourceKey,
      permissionCodes,
      match: 'ANY' as const,
    },
  ],
});

export const homeHcmReadAuthority = {
  allOf: [
    {
      resourceType: 'APP',
      resourceKey: 'APP.HCM',
      permissionCodes: ['VIEW', 'MANAGE'],
      match: 'ANY' as const,
    },
  ],
} as const;

const approvalTaskReadAuthority = {
  allOf: [
    {
      resourceType: 'ACTION',
      resourceKey: 'ACTION.APPROVAL_TASK',
      permissionCodes: ['VIEW', 'MANAGE'],
      match: 'ANY' as const,
    },
  ],
} as const;

const approvalTaskActionAuthority = {
  allOf: [
    {
      resourceType: 'ACTION',
      resourceKey: 'ACTION.APPROVAL_TASK',
      permissionCodes: ['UPDATE', 'APPROVE', 'MANAGE'],
      match: 'ANY' as const,
    },
  ],
} as const;

const approvalRequestReadAuthority = {
  allOf: [
    {
      resourceType: 'ACTION',
      resourceKey: 'ACTION.APPROVAL_REQUEST',
      permissionCodes: ['VIEW', 'MANAGE'],
      match: 'ANY' as const,
    },
  ],
} as const;

const approvalRequestResponseAuthority = {
  allOf: [
    {
      resourceType: 'ACTION',
      resourceKey: 'ACTION.APPROVAL_REQUEST',
      permissionCodes: ['UPDATE', 'MANAGE'],
      match: 'ANY' as const,
    },
  ],
} as const;

const approvalOperationsReadAuthority = {
  allOf: [
    {
      resourceType: 'ADMIN',
      resourceKey: 'ADMIN.APPROVAL_OPERATIONS',
      permissionCodes: ['VIEW', 'MANAGE'],
      match: 'ANY' as const,
    },
  ],
} as const;

const calendarResponseAuthority = {
  allOf: [
    {
      resourceType: 'APP',
      resourceKey: 'APP.CALENDAR',
      permissionCodes: ['UPDATE'],
      match: 'ANY' as const,
    },
  ],
} as const;

const workplaceCheckInAuthority = {
  allOf: [
    {
      resourceType: 'APP',
      resourceKey: 'APP.WORKPLACE',
      permissionCodes: ['UPDATE'],
      match: 'ANY' as const,
    },
  ],
} as const;

function privacyClassification(value: string | null | undefined): HomePrivacyClassification {
  const normalized = value?.trim().toLocaleUpperCase('en-US');
  return normalized === 'PUBLIC' ||
    normalized === 'INTERNAL' ||
    normalized === 'CONFIDENTIAL' ||
    normalized === 'RESTRICTED'
    ? normalized
    : 'RESTRICTED';
}

function isKorean(context: HomeContributionProviderContext): boolean {
  return (context.locale ?? '').toLocaleLowerCase().startsWith('ko');
}

function copy(context: HomeContributionProviderContext, ko: string, en: string): string {
  return isKorean(context) ? ko : en;
}

function semanticKey(...values: (string | null | undefined)[]): string {
  return values
    .map((value) => value?.trim().toLocaleLowerCase('en-US').replace(/\s+/gu, ' ') ?? '')
    .join('|');
}

export function canonicalHomeSourceNamespace(value: string): string {
  const normalized = value
    .trim()
    .toLocaleUpperCase('en-US')
    .replace(/[^A-Z0-9]+/gu, '_');
  const compact = normalized.replaceAll('_', '');
  if (['APPROVAL', 'APPROVALS', 'APPROVALSERVICE', 'DWPAPPROVAL'].includes(compact)) {
    return 'APPROVAL';
  }
  if (
    ['SERVICE', 'ITSERVICE', 'EMPLOYEESERVICE', 'EMPLOYEESERVICES', 'DWPEMPLOYEESERVICES'].includes(
      compact
    )
  ) {
    return 'SERVICE';
  }
  if (['HR', 'HCM', 'HRSERVICE', 'DWPHCM'].includes(compact)) return 'HCM';
  if (['WORKPLACE', 'DWPWORKPLACE'].includes(compact)) return 'WORKPLACE';
  if (['CALENDAR', 'DWPCALENDAR'].includes(compact)) return 'CALENDAR';
  return normalized || 'UNKNOWN';
}

function overdue(dueAt: string | null | undefined, now: string): boolean {
  if (!dueAt) return false;
  const due = Date.parse(dueAt);
  const current = Date.parse(now);
  return Number.isFinite(due) && Number.isFinite(current) && due < current;
}

function workPriority(
  priority: 'high' | 'medium' | 'low',
  dueAt: string | null | undefined,
  now: string
): HomeContributionPriority {
  if (overdue(dueAt, now)) return 'CRITICAL';
  return priority === 'high' ? 'HIGH' : priority === 'medium' ? 'MEDIUM' : 'LOW';
}

function approvalPriority(
  priority: ApprovalPriority,
  dueAt: string | null | undefined,
  now: string
): HomeContributionPriority {
  if (overdue(dueAt, now)) return 'CRITICAL';
  return priority === 'URGENT'
    ? 'CRITICAL'
    : priority === 'HIGH'
      ? 'HIGH'
      : priority === 'NORMAL'
        ? 'MEDIUM'
        : 'LOW';
}

function servicePriority(
  priority: ServiceRequestPriority,
  dueAt: string | null | undefined,
  now: string
): HomeContributionPriority {
  if (overdue(dueAt, now)) return 'CRITICAL';
  return priority === 'URGENT'
    ? 'CRITICAL'
    : priority === 'HIGH'
      ? 'HIGH'
      : priority === 'NORMAL'
        ? 'MEDIUM'
        : 'LOW';
}

export const workspaceWorkContributionProvider = createHomeContributionProvider<WorkspaceWorkQueue>(
  {
    key: 'workspace-work',
    owner: { source: 'DWP_WORKSPACE', appKey: 'APP.WORK', appLabel: 'Work' },
    supportedKinds: ['ACTION', 'PULSE'],
    authority: homeAppReadAuthority('APP.WORK'),
    freshnessMs: HOME_SOURCE_FRESHNESS_MS,
    normalize(data, context) {
      const actions = data.items
        .filter((item) => item.status !== 'completed')
        .map<HomeContributionInput>((item) => ({
          id: `workspace-work:${item.id}`,
          kind: 'ACTION',
          scope: 'ME',
          priority: workPriority(item.priority, item.dueAt, context.now),
          status: overdue(item.dueAt, context.now) ? 'OVERDUE' : item.status.toUpperCase(),
          title: item.title,
          description: item.reason ?? item.recommendedNext ?? item.summary,
          dueAt: item.dueAt,
          deepLink: `/work/queue?item=${encodeURIComponent(item.id)}`,
          dedupeKey: `${canonicalHomeSourceNamespace(item.sourceSystem)}:${item.sourceReference ?? item.id}`,
          sourceReference: item.sourceReference ?? item.id,
          generatedAt: data.generatedAt,
          privacy: { classification: privacyClassification(item.dataClassification) },
        }));
      const openCount = Math.max(0, data.summary.total - data.summary.completed);
      const pulse: HomeContributionInput[] =
        openCount > 0
          ? [
              {
                id: 'workspace-work:open-pulse',
                kind: 'PULSE',
                scope: 'ME',
                priority: data.summary.dueSoon > 0 ? 'HIGH' : 'LOW',
                status: data.summary.dueSoon > 0 ? 'ATTENTION' : 'ON_TRACK',
                title: copy(context, '열린 업무', 'Open work'),
                description: copy(
                  context,
                  data.summary.dueSoon > 0
                    ? `확인이 필요한 업무 ${data.summary.dueSoon}건`
                    : '현재 업무 흐름이 안정적입니다.',
                  data.summary.dueSoon > 0
                    ? `${data.summary.dueSoon} item(s) need attention.`
                    : 'Your current work flow is on track.'
                ),
                count: openCount,
                deepLink: '/work/queue',
                dedupeKey: `WORK-PULSE:${data.generatedAt.slice(0, 10)}`,
                sourceReference: `open-work:${data.generatedAt.slice(0, 10)}`,
                generatedAt: data.generatedAt,
                privacy: { classification: 'INTERNAL' },
              },
            ]
          : [];
      return [...actions, ...pulse];
    },
  }
);

export const calendarContributionProvider = createHomeContributionProvider<CalendarHome>({
  key: 'calendar-home',
  owner: { source: 'DWP_CALENDAR', appKey: 'APP.CALENDAR', appLabel: 'Calendar' },
  supportedKinds: ['TIMELINE', 'RESPONSE', 'PULSE'],
  authority: homeAppReadAuthority('APP.CALENDAR'),
  freshnessMs: HOME_SOURCE_FRESHNESS_MS,
  normalize(data, context) {
    if (!context.dateKey || data.date !== context.dateKey) return [];
    const timeline = data.today
      .filter((event) => event.status !== 'CANCELLED')
      .map<HomeContributionInput>((event) => ({
        id: `calendar:${event.eventId}`,
        kind: 'TIMELINE',
        scope: 'ME',
        priority: event.conflict ? 'HIGH' : 'NONE',
        status: event.conflict ? 'CONFLICT' : event.status,
        title:
          event.visibility === 'PRIVATE'
            ? copy(context, '비공개 일정', 'Private event')
            : event.title,
        description: event.location ?? event.calendarName,
        dueAt: event.startsAt,
        deepLink: `/calendar/schedule?event=${encodeURIComponent(event.eventId)}`,
        dedupeKey: `CALENDAR:${event.eventId}`,
        sourceReference: event.eventId,
        generatedAt: data.generatedAt,
        privacy: {
          classification: event.visibility === 'PUBLIC' ? 'INTERNAL' : 'CONFIDENTIAL',
          sensitive: event.visibility === 'PRIVATE' || event.visibility === 'CONFIDENTIAL',
          redactedTitle: copy(context, '보호된 일정', 'Protected event'),
        },
      }));
    const response =
      data.metrics.awaitingResponseCount > 0
        ? [
            {
              id: 'calendar:awaiting-response',
              kind: 'RESPONSE' as const,
              scope: 'ME' as const,
              priority: 'HIGH' as const,
              status: 'NEEDS_RESPONSE',
              title: copy(
                context,
                '응답하지 않은 일정 초대',
                'Calendar invitations need a response'
              ),
              description: copy(
                context,
                `${data.metrics.awaitingResponseCount}건의 일정 응답이 필요합니다.`,
                `${data.metrics.awaitingResponseCount} calendar invitation(s) need a response.`
              ),
              authority: calendarResponseAuthority,
              count: data.metrics.awaitingResponseCount,
              deepLink: '/calendar/home',
              dedupeKey: `calendar:awaiting-response:${data.date}`,
              sourceReference: `awaiting-response:${data.date}`,
              generatedAt: data.generatedAt,
              privacy: { classification: 'INTERNAL' as const },
            },
            {
              id: 'calendar:awaiting-response-readonly',
              kind: 'PULSE' as const,
              scope: 'ME' as const,
              priority: 'HIGH' as const,
              status: 'NEEDS_RESPONSE',
              title: copy(
                context,
                '응답이 필요한 일정 초대',
                'Calendar invitations need attention'
              ),
              description: copy(
                context,
                `${data.metrics.awaitingResponseCount}건의 일정 초대를 확인하세요.`,
                `Review ${data.metrics.awaitingResponseCount} calendar invitation(s).`
              ),
              count: data.metrics.awaitingResponseCount,
              deepLink: '/calendar/home',
              dedupeKey: `calendar:awaiting-response:${data.date}`,
              sourceReference: `awaiting-response-readonly:${data.date}`,
              generatedAt: data.generatedAt,
              privacy: { classification: 'INTERNAL' as const },
            },
          ]
        : [];
    const focusPulse: HomeContributionInput[] =
      data.metrics.eventCount > 0 || data.metrics.focusMinutes > 0
        ? [
            {
              id: `calendar:focus-pulse:${data.date}`,
              kind: 'PULSE',
              scope: 'ME',
              priority:
                data.metrics.focusTargetMinutes > 0 &&
                data.metrics.focusMinutes < data.metrics.focusTargetMinutes
                  ? 'MEDIUM'
                  : 'LOW',
              status:
                data.metrics.focusTargetMinutes > 0 &&
                data.metrics.focusMinutes < data.metrics.focusTargetMinutes
                  ? 'BELOW_TARGET'
                  : 'ON_TRACK',
              title: copy(context, '오늘 집중 시간', 'Focus time today'),
              description: copy(
                context,
                data.metrics.focusTargetMinutes > 0
                  ? `${data.metrics.focusMinutes}분 / 목표 ${data.metrics.focusTargetMinutes}분`
                  : `${data.metrics.focusMinutes}분 확보`,
                data.metrics.focusTargetMinutes > 0
                  ? `${data.metrics.focusMinutes} min / ${data.metrics.focusTargetMinutes} min target`
                  : `${data.metrics.focusMinutes} min protected`
              ),
              deepLink: '/calendar/insights',
              dedupeKey: `CALENDAR-FOCUS:${data.date}`,
              sourceReference: `focus:${data.date}`,
              generatedAt: data.generatedAt,
              privacy: { classification: 'INTERNAL' },
            },
          ]
        : [];
    return [...timeline, ...response, ...focusPulse];
  },
});

export const activityContributionProvider = createHomeContributionProvider<WorkspaceActivityFeed>({
  key: 'workspace-activity',
  owner: { source: 'DWP_ACTIVITY', appKey: 'APP.ACTIVITY', appLabel: 'Activity' },
  supportedKinds: ['PULSE'],
  authority: homeAppReadAuthority('APP.ACTIVITY'),
  freshnessMs: HOME_SOURCE_FRESHNESS_MS,
  normalize(data, context) {
    const attentionCount = data.events.filter(
      (event) => event.state === 'needs-input' || event.state === 'policy-blocked'
    ).length;
    if (attentionCount === 0) return [];
    return [
      {
        id: 'activity:attention',
        kind: 'PULSE',
        scope: 'ME',
        priority: data.events.some((event) => event.state === 'policy-blocked') ? 'HIGH' : 'MEDIUM',
        status: 'ATTENTION',
        title: copy(context, '확인이 필요한 활동', 'Activity needs attention'),
        description: copy(
          context,
          `${attentionCount}건의 활동이 입력 또는 정책 확인을 기다립니다.`,
          `${attentionCount} activity item(s) are waiting for input or policy review.`
        ),
        count: attentionCount,
        deepLink: '/activity',
        dedupeKey: `activity:attention:${data.generatedAt.slice(0, 10)}`,
        sourceReference: `attention:${data.generatedAt.slice(0, 10)}`,
        generatedAt: data.generatedAt,
        privacy: { classification: 'INTERNAL' },
      },
    ];
  },
});

export type ApprovalContributionData = Readonly<{
  home: ApprovalHome;
  audience: HomeAudienceProfile;
}>;

export const approvalContributionProvider =
  createHomeContributionProvider<ApprovalContributionData>({
    key: 'approval-home',
    owner: { source: 'DWP_APPROVAL', appKey: 'APP.APPROVALS', appLabel: 'Approvals' },
    supportedKinds: ['ACTION', 'RESPONSE', 'REQUEST', 'PULSE'],
    authority: homeAppReadAuthority('APP.APPROVALS'),
    freshnessMs: HOME_SOURCE_FRESHNESS_MS,
    normalize({ home }, context) {
      const taskSignatures = home.focusQueue.map((task) =>
        semanticKey(task.title, task.stepName, task.dueAt?.slice(0, 10))
      );
      const taskSignatureCounts = taskSignatures.reduce<Map<string, number>>(
        (counts, signature) => {
          counts.set(signature, (counts.get(signature) ?? 0) + 1);
          return counts;
        },
        new Map()
      );
      const tasks = home.focusQueue.flatMap<HomeContributionInput>((task) => {
        const signature = semanticKey(task.title, task.stepName, task.dueAt?.slice(0, 10));
        const count = taskSignatureCounts.get(signature) ?? 1;
        const shared = {
          scope: 'ME' as const,
          priority: approvalPriority(task.priority, task.dueAt, context.now),
          status: overdue(task.dueAt, context.now) ? 'OVERDUE' : task.status,
          title: task.title,
          description: task.summary || task.stepName,
          count,
          dueAt: task.dueAt,
          deepLink:
            count > 1
              ? '/approvals/inbox'
              : `/approvals/inbox?task=${encodeURIComponent(task.taskId)}`,
          dedupeKey: count > 1 ? `APPROVAL-ACTION:${signature}` : `APPROVAL:${task.requestId}`,
          sourceReference: task.taskId,
          generatedAt: home.generatedAt,
          privacy: { classification: privacyClassification(task.dataClassification) },
        };
        return [
          {
            id: `approval-task:${task.taskId}`,
            kind: 'ACTION',
            authority: approvalTaskActionAuthority,
            ...shared,
          },
          {
            id: `approval-task-view:${task.taskId}`,
            kind: 'PULSE',
            authority: approvalTaskReadAuthority,
            ...shared,
          },
        ];
      });
      const requests = home.recentRequests
        .filter(
          (request) => !['APPROVED', 'REJECTED', 'WITHDRAWN', 'CANCELLED'].includes(request.status)
        )
        .flatMap<HomeContributionInput>((request) => {
          const needsInformation = request.status === 'NEEDS_INFO';
          const shared = {
            scope: 'ME' as const,
            priority: needsInformation
              ? ('HIGH' as const)
              : approvalPriority(request.priority, request.dueAt, context.now),
            status: request.status,
            title: request.title,
            description: request.currentStepName ?? request.summary,
            dueAt: request.dueAt,
            deepLink: needsInformation
              ? `/approvals/requests/needs-info?request=${encodeURIComponent(request.requestId)}`
              : `/approvals/requests/submitted?request=${encodeURIComponent(request.requestId)}`,
            dedupeKey: `APPROVAL:${request.requestId}`,
            sourceReference: request.requestId,
            generatedAt: home.generatedAt,
            privacy: { classification: privacyClassification(request.dataClassification) },
          };
          if (!needsInformation) {
            return [
              {
                id: `approval-request:${request.requestId}`,
                kind: 'REQUEST',
                authority: approvalRequestReadAuthority,
                ...shared,
              },
            ];
          }
          return [
            {
              id: `approval-request:${request.requestId}`,
              kind: 'RESPONSE',
              authority: approvalRequestResponseAuthority,
              ...shared,
            },
            {
              id: `approval-request-view:${request.requestId}`,
              kind: 'REQUEST',
              authority: approvalRequestReadAuthority,
              ...shared,
            },
          ];
        });
      const operations =
        home.administrator && home.adminPulse
          ? [
              ...(home.adminPulse.failedIntegrations > 0
                ? [
                    {
                      id: 'approval-ops:failed-integrations',
                      kind: 'PULSE' as const,
                      scope: 'OPERATIONS' as const,
                      priority: 'CRITICAL' as const,
                      status: 'FAILED',
                      title: copy(context, '결재 연동 실패', 'Approval integration failures'),
                      authority: approvalOperationsReadAuthority,
                      count: home.adminPulse.failedIntegrations,
                      deepLink: '/approvals/admin/operations',
                      dedupeKey: 'approval-ops:failed-integrations',
                      sourceReference: 'failed-integrations',
                      generatedAt: home.generatedAt,
                      privacy: { classification: 'INTERNAL' as const },
                    },
                  ]
                : []),
              ...(home.adminPulse.overdueTasks > 0
                ? [
                    {
                      id: 'approval-ops:overdue',
                      kind: 'PULSE' as const,
                      scope: 'OPERATIONS' as const,
                      priority: 'HIGH' as const,
                      status: 'OVERDUE',
                      title: copy(context, '연체된 결재 업무', 'Overdue approval work'),
                      authority: approvalOperationsReadAuthority,
                      count: home.adminPulse.overdueTasks,
                      deepLink: '/approvals/admin/operations',
                      dedupeKey: 'approval-ops:overdue',
                      sourceReference: 'overdue-tasks',
                      generatedAt: home.generatedAt,
                      privacy: { classification: 'INTERNAL' as const },
                    },
                  ]
                : []),
            ]
          : [];
      return [...tasks, ...requests, ...operations];
    },
  });

export type HrContributionData = Readonly<{
  home: HrHomeOverview;
  audience: HomeAudienceProfile;
}>;

export const hrContributionProvider = createHomeContributionProvider<HrContributionData>({
  key: 'hr-home',
  owner: { source: 'DWP_HCM', appKey: 'APP.HCM', appLabel: 'HR' },
  supportedKinds: ['ACTION', 'PULSE'],
  authority: homeHcmReadAuthority,
  freshnessMs: HOME_SOURCE_FRESHNESS_MS,
  normalize({ home, audience }, context) {
    const generatedAt = home.generatedAt ?? home.asOf;
    const values: HomeContributionInput[] = [];
    if (home.time && !['APPROVED', 'COMPLETED', 'SUBMITTED'].includes(home.time.status)) {
      values.push({
        id: `hr-time:${home.time.timeCardId}`,
        kind: 'ACTION',
        scope: 'ME',
        priority: home.time.exceptionCount > 0 ? 'HIGH' : 'MEDIUM',
        status: home.time.exceptionCount > 0 ? 'ATTENTION' : home.time.status,
        title: copy(context, '근무 기록을 확인하세요', 'Review your time card'),
        description:
          home.time.exceptionCount > 0
            ? copy(
                context,
                `확인이 필요한 예외가 ${home.time.exceptionCount}건 있습니다.`,
                `${home.time.exceptionCount} exception(s) need attention.`
              )
            : copy(
                context,
                '현재 기간의 근무 기록이 완료되지 않았습니다.',
                'Your current time card is not complete.'
              ),
        count: Math.max(1, home.time.exceptionCount),
        dueAt: home.time.periodEnd,
        deepLink: '/hr/time',
        dedupeKey: `HCM:${home.time.timeCardId}`,
        sourceReference: home.time.timeCardId,
        generatedAt,
        privacy: { classification: 'CONFIDENTIAL' },
      });
    }
    if (home.requiredLearningCount > 0) {
      values.push({
        id: 'hr:required-learning',
        kind: 'PULSE',
        scope: 'ME',
        priority: 'MEDIUM',
        status: 'REQUIRED',
        title: copy(context, '필수 학습', 'Required learning'),
        count: home.requiredLearningCount,
        deepLink: '/hr/talent',
        dedupeKey: 'hr:required-learning',
        sourceReference: 'required-learning',
        generatedAt,
        privacy: { classification: 'INTERNAL' },
      });
    }
    if (home.openBenefitWindowCount > 0) {
      values.push({
        id: 'hr:benefit-window',
        kind: 'PULSE',
        scope: 'ME',
        priority: 'MEDIUM',
        status: 'OPEN',
        title: copy(context, '진행 중인 복리후생 신청', 'Open benefit enrollment'),
        count: home.openBenefitWindowCount,
        deepLink: '/hr/benefits',
        dedupeKey: 'hr:benefit-window',
        sourceReference: 'benefit-window',
        generatedAt,
        privacy: { classification: 'INTERNAL' },
      });
    }
    if (audience !== 'MEMBER' && home.teamPendingCount > 0) {
      values.push({
        id: 'hr:team-pending',
        kind: 'PULSE',
        scope: 'TEAM',
        priority: 'HIGH',
        status: 'PENDING',
        title: copy(context, '팀 인사 승인 대기', 'Team HR approvals pending'),
        count: home.teamPendingCount,
        deepLink: '/hr/team',
        dedupeKey: 'hr:team-pending',
        sourceReference: 'team-pending',
        generatedAt,
        privacy: { classification: 'CONFIDENTIAL', minimumRedaction: 'TITLE_ONLY' },
      });
    }
    return values;
  },
});

export const serviceContributionProvider = createHomeContributionProvider<
  readonly ServiceRequestSummary[]
>({
  key: 'service-requests',
  owner: {
    source: 'DWP_EMPLOYEE_SERVICES',
    appKey: 'APP.EMPLOYEE_SERVICES',
    appLabel: 'Services',
  },
  supportedKinds: ['REQUEST'],
  authority: homeAppReadAuthority('APP.EMPLOYEE_SERVICES'),
  freshnessMs: HOME_SOURCE_FRESHNESS_MS,
  normalize(data, context) {
    return data
      .filter((request) => !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(request.status))
      .map<HomeContributionInput>((request) => ({
        id: `service-request:${request.requestId}`,
        // The current Services UI has no requester-response command. Keep the
        // item visible as tracked work until that end-to-end capability exists.
        kind: 'REQUEST',
        scope: 'ME',
        priority:
          request.status === 'AWAITING_REQUESTER'
            ? 'HIGH'
            : servicePriority(request.priority, request.slaDueAt, context.now),
        status: overdue(request.slaDueAt, context.now) ? 'OVERDUE' : request.status,
        title: request.summary,
        description: isKorean(context) ? request.serviceNameKo : request.serviceNameEn,
        dueAt: request.slaDueAt,
        deepLink: `/services/${request.status === 'DRAFT' ? 'drafts' : 'my'}/${encodeURIComponent(
          request.requestId
        )}`,
        dedupeKey: `SERVICE:${request.requestId}`,
        sourceReference: request.requestId,
        generatedAt: context.snapshotAt ?? '',
        privacy: { classification: privacyClassification(request.dataClassification) },
      }));
  },
});

export const workplaceContributionProvider = createHomeContributionProvider<
  readonly WorkplaceBooking[]
>({
  key: 'workplace-bookings',
  owner: { source: 'DWP_WORKPLACE', appKey: 'APP.WORKPLACE', appLabel: 'Workplace' },
  supportedKinds: ['ACTION', 'TIMELINE'],
  authority: homeAppReadAuthority('APP.WORKPLACE'),
  freshnessMs: HOME_SOURCE_FRESHNESS_MS,
  normalize(data, context) {
    return data
      .filter(
        (booking) =>
          ['RESERVED', 'CHECKED_IN'].includes(booking.status) &&
          Boolean(context.dateKey) &&
          resolveZonedDateKey(booking.startsAt, context.timeZone ?? 'UTC') === context.dateKey
      )
      .flatMap<HomeContributionInput>((booking) => {
        const common = {
          scope: 'ME' as const,
          title: booking.resourceName,
          description: [booking.siteName, booking.floorName].filter(Boolean).join(' · '),
          dueAt: booking.startsAt,
          deepLink: '/workplace/my-bookings',
          dedupeKey: `WORKPLACE:${booking.bookingId}`,
          generatedAt: context.snapshotAt ?? '',
          privacy: {
            classification: 'CONFIDENTIAL' as const,
            minimumRedaction: 'TITLE_ONLY' as const,
          },
        };
        if (!booking.canCheckIn) {
          return [
            {
              ...common,
              id: `workplace:${booking.bookingId}`,
              kind: 'TIMELINE',
              priority: 'NONE',
              status: booking.status,
              sourceReference: booking.bookingId,
            },
          ];
        }
        return [
          {
            ...common,
            id: `workplace:${booking.bookingId}:check-in`,
            kind: 'ACTION',
            priority: 'HIGH',
            status: 'CHECK_IN',
            authority: workplaceCheckInAuthority,
            sourceReference: `${booking.bookingId}:check-in`,
          },
          {
            ...common,
            id: `workplace:${booking.bookingId}:readonly`,
            kind: 'TIMELINE',
            priority: 'NONE',
            status: booking.status,
            sourceReference: `${booking.bookingId}:readonly`,
          },
        ];
      });
  },
});

const notificationName: Readonly<Record<string, Readonly<{ ko: string; en: string }>>> = {
  approvals: { ko: '전자결재', en: 'Approvals' },
  communications: { ko: '소식', en: 'News' },
  hcm: { ko: '인사', en: 'HR' },
  messaging: { ko: '메시지', en: 'Messages' },
  space: { ko: 'Space', en: 'Space' },
  mail: { ko: '메일', en: 'Mail' },
};

export const notificationContributionProvider =
  createHomeContributionProvider<AppNotificationSummary>({
    key: 'notification-summary',
    owner: {
      source: 'DWP_NOTIFICATION',
      appKey: 'APP.NOTIFICATIONS',
      appLabel: 'Notifications',
    },
    supportedKinds: ['RESPONSE', 'PULSE'],
    authority: homeAppReadAuthority('APP.NOTIFICATIONS'),
    freshnessMs: HOME_SOURCE_FRESHNESS_MS,
    normalize(data, context) {
      return data.apps
        .filter((app) => app.actionableUnread > 0 || app.urgentUnread > 0)
        .map<HomeContributionInput>((app) => {
          const appKey = String(app.appKey);
          const appName = notificationName[appKey];
          const label = appName
            ? copy(context, appName.ko, appName.en)
            : copy(context, '업무 앱', 'Work app');
          const actionable = app.actionableUnread > 0;
          const count = actionable ? app.actionableUnread : app.urgentUnread;
          return {
            id: `notification:${appKey}`,
            kind: actionable ? 'RESPONSE' : 'PULSE',
            scope: 'ME',
            priority: app.urgentUnread > 0 ? 'CRITICAL' : 'HIGH',
            status: app.urgentUnread > 0 ? 'URGENT' : 'ACTIONABLE',
            title: actionable
              ? copy(context, `${label} 알림 확인`, `Review ${label} notifications`)
              : copy(context, `${label} 긴급 알림`, `Urgent ${label} notifications`),
            description: copy(
              context,
              actionable ? `조치 가능한 알림 ${count}건` : `긴급 알림 ${count}건`,
              actionable ? `${count} actionable notification(s)` : `${count} urgent notification(s)`
            ),
            count,
            deepLink: '/notifications/home',
            dedupeKey: `NOTIFICATION:${appKey}:${String(app.lastActivityAt)}`,
            sourceReference: `${appKey}:${String(app.lastActivityAt)}`,
            generatedAt: String(data.generatedAt),
            privacy: { classification: 'CONFIDENTIAL' },
          };
        });
    },
  });

export const HOME_CONTRIBUTION_PROVIDERS = [
  workspaceWorkContributionProvider,
  calendarContributionProvider,
  activityContributionProvider,
  approvalContributionProvider,
  hrContributionProvider,
  serviceContributionProvider,
  workplaceContributionProvider,
  notificationContributionProvider,
] as const;
