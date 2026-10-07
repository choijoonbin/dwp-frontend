import {
  BookOpenCheck,
  CalendarDays,
  Clock3,
  LifeBuoy,
  ReceiptText,
  ShieldAlert,
  UsersRound,
} from 'lucide-react';
import { formatDate } from '@dwp-frontend/shared-i18n';

import {
  hcmHomeProviderIsAvailable,
  hcmHomeProviderNeedsAttention,
  hcmHomeProviderPayload,
  hcmHomeProviderRoute,
  type HcmHomeProviderSnapshot,
  type HcmHomeProviderWidgetId,
} from './hcm-home-provider-adapter';

import type { LucideIcon } from 'lucide-react';
import type { HrHomeDomain } from '@dwp-frontend/shared-utils';
import type { HcmHomeTimeStage, HcmHomeToolLink } from './hcm-home-widgets';

export type HcmHomeMode = 'personal' | 'team';
export type HcmAttentionPriority = 'critical' | 'attention' | 'routine';
export type HcmAttentionSignal = {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  value: string;
  actionLabel: string;
  route: string;
  priority: HcmAttentionPriority;
};

const PERSONAL_ATTENTION_PROVIDER_IDS = [
  'hrm-self-employment',
  'tim-self-time',
  'tim-self-absence',
  'pay-self-cycle',
  'per-self-performance',
] as const satisfies readonly HcmHomeProviderWidgetId[];

const TEAM_ATTENTION_PROVIDER_IDS = [
  'hrm-team-shape',
  'tim-team-time-decisions',
  'tim-team-absence-decisions',
] as const satisfies readonly HcmHomeProviderWidgetId[];

type Translate = (key: string, values?: Record<string, unknown>) => string;

function daysUntilDate(value: string | null | undefined, asOf: string) {
  if (!value) return null;
  const target = new Date(`${value.slice(0, 10)}T00:00:00Z`).getTime();
  const reference = new Date(`${asOf.slice(0, 10)}T00:00:00Z`).getTime();
  return Math.max(0, Math.ceil((target - reference) / 86_400_000));
}

export function greetingKey(hour: number): 'morning' | 'afternoon' | 'evening' {
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

export function buildHcmHomeViewModel({
  aggregateMetadata,
  homeMode,
  providerSnapshots,
  identity,
  employeeServicesDisclosed,
  t,
}: {
  aggregateMetadata: Readonly<{ asOf: string; generatedAt: string | null }>;
  homeMode: HcmHomeMode;
  providerSnapshots: readonly HcmHomeProviderSnapshot[];
  identity: Readonly<{
    displayName?: string | null;
    jobTitle?: string | null;
    tenantName?: string | null;
    tenantCode?: string | null;
  }>;
  employeeServicesDisclosed: boolean;
  t: Translate;
}) {
  const employment = hcmHomeProviderPayload(providerSnapshots, 'hrm-self-employment');
  const teamShape = hcmHomeProviderPayload(providerSnapshots, 'hrm-team-shape');
  const time = hcmHomeProviderPayload(providerSnapshots, 'tim-self-time');
  const absence = hcmHomeProviderPayload(providerSnapshots, 'tim-self-absence');
  const teamTime = hcmHomeProviderPayload(providerSnapshots, 'tim-team-time-decisions');
  const teamAbsence = hcmHomeProviderPayload(providerSnapshots, 'tim-team-absence-decisions');
  const pay = hcmHomeProviderPayload(providerSnapshots, 'pay-self-cycle');
  const performance = hcmHomeProviderPayload(providerSnapshots, 'per-self-performance');

  const domainAvailable = (domain: HrHomeDomain) => {
    if (domain === 'TIME') {
      return hcmHomeProviderIsAvailable(providerSnapshots, 'tim-self-time');
    }
    if (domain === 'ABSENCE') {
      return hcmHomeProviderIsAvailable(providerSnapshots, 'tim-self-absence');
    }
    if (domain === 'PAY') {
      return hcmHomeProviderIsAvailable(providerSnapshots, 'pay-self-cycle');
    }
    if (domain === 'TALENT') {
      return hcmHomeProviderIsAvailable(providerSnapshots, 'per-self-performance');
    }
    if (domain === 'TEAM') {
      return (
        hcmHomeProviderIsAvailable(providerSnapshots, 'tim-team-time-decisions') &&
        hcmHomeProviderIsAvailable(providerSnapshots, 'tim-team-absence-decisions')
      );
    }
    return false;
  };

  const hasTimeProjection = Boolean(
    time &&
    (time.status ||
      time.periodStart ||
      time.periodEnd ||
      time.recordedMinutes !== null ||
      time.scheduledMinutes !== null)
  );
  const currentTime = hasTimeProjection ? time : null;
  const selfDisplayName =
    employment?.displayName || identity.displayName || t('home.personFallback');
  const firstName = selfDisplayName.trim().split(/\s+/u)[0] || t('home.personFallback');
  const organizationName =
    employment?.organizationName || identity.tenantName || identity.tenantCode || '-';
  const businessTitle = employment?.businessTitle || identity.jobTitle || null;
  const managerDisplayName = employment?.managerDisplayName ?? null;
  const directReportCount = teamShape?.directReportCount ?? null;

  const recordedMinutes = currentTime?.recordedMinutes ?? 0;
  const scheduledMinutes = currentTime?.scheduledMinutes ?? 0;
  const remainingMinutes = Math.max(0, scheduledMinutes - recordedMinutes);
  const recordedHours = Math.round((recordedMinutes / 60) * 10) / 10;
  const scheduledHours = Math.round((scheduledMinutes / 60) * 10) / 10;
  const primaryLeaveBalance = absence?.displayBalance ?? null;
  const standardDayMinutes = absence?.standardDayMinutes ?? null;
  const availableLeaveDays =
    primaryLeaveBalance && standardDayMinutes
      ? Math.round((primaryLeaveBalance.availableMinutes / standardDayMinutes) * 10) / 10
      : null;
  const usedLeaveDays =
    primaryLeaveBalance && standardDayMinutes
      ? Math.round((primaryLeaveBalance.usedMinutes / standardDayMinutes) * 10) / 10
      : null;
  const payDaysRemaining = daysUntilDate(pay?.payDate, aggregateMetadata.asOf);
  const journeyTargetDays = daysUntilDate(performance?.nearestTargetDate, aggregateMetadata.asOf);
  const currentDate = formatDate(aggregateMetadata.asOf, { dateStyle: 'full' });
  const freshness = aggregateMetadata.generatedAt
    ? formatDate(aggregateMetadata.generatedAt, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : t('home.states.unavailable');
  const teamTimePendingCount = teamTime?.timePendingCount ?? null;
  const teamAbsencePendingCount = teamAbsence?.absencePendingCount ?? null;

  const selfTimeRoute = hcmHomeProviderRoute(providerSnapshots, 'tim-self-time');
  const selfAbsenceRoute = hcmHomeProviderRoute(providerSnapshots, 'tim-self-absence');
  const teamTimeRoute = hcmHomeProviderRoute(providerSnapshots, 'tim-team-time-decisions');
  const teamAbsenceRoute = hcmHomeProviderRoute(providerSnapshots, 'tim-team-absence-decisions');
  const payRoute = hcmHomeProviderRoute(providerSnapshots, 'pay-self-cycle');
  const performanceRoute = hcmHomeProviderRoute(providerSnapshots, 'per-self-performance');
  const teamRoute = hcmHomeProviderRoute(providerSnapshots, 'hrm-team-shape');

  const personalAttention: HcmAttentionSignal[] = [
    ...(currentTime?.exceptionCount
      ? [
          {
            id: 'time-exception',
            icon: ShieldAlert,
            title: t('home.needsAttention.timeException.title'),
            description: t('home.needsAttention.timeException.description'),
            value: t('home.needsAttention.timeException.value', {
              count: currentTime.exceptionCount,
            }),
            actionLabel: t('home.needsAttention.resolveTime'),
            route: selfTimeRoute,
            priority: 'critical' as const,
          },
        ]
      : currentTime && currentTime.status === 'OPEN' && remainingMinutes > 0
        ? [
            {
              id: 'time-remaining',
              icon: Clock3,
              title: t('home.needsAttention.timeRemaining.title'),
              description: t('home.needsAttention.timeRemaining.description', {
                end: currentTime.periodEnd
                  ? formatDate(currentTime.periodEnd, { dateStyle: 'medium' })
                  : t('home.states.unavailable'),
              }),
              value: t('home.needsAttention.timeRemaining.value', {
                value: Math.round((remainingMinutes / 60) * 10) / 10,
              }),
              actionLabel: t('home.needsAttention.finishTime'),
              route: selfTimeRoute,
              priority: 'attention' as const,
            },
          ]
        : []),
    ...((performance?.requiredLearningCount ?? 0) > 0 && performanceRoute
      ? [
          {
            id: 'required-learning',
            icon: BookOpenCheck,
            title: t('home.needsAttention.requiredLearning.title'),
            description: t('home.needsAttention.requiredLearning.description'),
            value: t('home.needsAttention.requiredLearning.value', {
              count: performance?.requiredLearningCount ?? 0,
            }),
            actionLabel: t('home.needsAttention.continueLearning'),
            route: performanceRoute,
            priority: 'routine' as const,
          },
        ]
      : []),
  ];
  const teamAttention: HcmAttentionSignal[] = [
    ...((teamTimePendingCount ?? 0) > 0 && teamTimeRoute
      ? [
          {
            id: 'team-time',
            icon: Clock3,
            title: t('home.needsAttention.teamTime.title'),
            description: t('home.needsAttention.teamTime.description'),
            value: t('home.needsAttention.teamTime.value', {
              count: teamTimePendingCount,
            }),
            actionLabel: t('home.needsAttention.reviewTime'),
            route: teamTimeRoute,
            priority: 'attention' as const,
          },
        ]
      : []),
    ...((teamAbsencePendingCount ?? 0) > 0 && teamAbsenceRoute
      ? [
          {
            id: 'team-absence',
            icon: CalendarDays,
            title: t('home.needsAttention.teamAbsence.title'),
            description: t('home.needsAttention.teamAbsence.description'),
            value: t('home.needsAttention.teamAbsence.value', {
              count: teamAbsencePendingCount,
            }),
            actionLabel: t('home.needsAttention.reviewLeave'),
            route: teamAbsenceRoute,
            priority: 'attention' as const,
          },
        ]
      : []),
  ];
  const attentionSignals = homeMode === 'team' ? teamAttention : personalAttention;
  const attentionUnavailable = (
    homeMode === 'team' ? TEAM_ATTENTION_PROVIDER_IDS : PERSONAL_ATTENTION_PROVIDER_IDS
  ).some((widgetId) => hcmHomeProviderNeedsAttention(providerSnapshots, widgetId));

  const personalTools: HcmHomeToolLink[] = [
    {
      id: 'time',
      icon: Clock3,
      label: t('home.tools.time'),
      description: t('home.tools.descriptions.time'),
      route: selfTimeRoute,
    },
    {
      id: 'leave',
      icon: CalendarDays,
      label: t('home.tools.requestLeave'),
      description: t('home.tools.descriptions.requestLeave'),
      route: selfAbsenceRoute ? `${selfAbsenceRoute}?request=open` : '',
    },
    {
      id: 'pay',
      icon: ReceiptText,
      label: t('home.tools.pay'),
      description: t('home.tools.descriptions.pay'),
      route: payRoute,
    },
    {
      id: 'services',
      icon: LifeBuoy,
      label: t('home.tools.services'),
      description: t('home.tools.descriptions.services'),
      route: '/hr/services',
    },
    {
      id: 'directory',
      icon: UsersRound,
      label: t('home.tools.directory'),
      description: t('home.tools.descriptions.directory'),
      route: '/hr/directory',
    },
  ];
  const teamTools: HcmHomeToolLink[] = [
    {
      id: 'team',
      icon: UsersRound,
      label: t('home.tools.myTeam'),
      description: t('home.tools.descriptions.myTeam'),
      route: teamRoute,
    },
    {
      id: 'team-time',
      icon: Clock3,
      label: t('home.tools.teamTime'),
      description: t('home.tools.descriptions.teamTime'),
      route: teamTimeRoute,
      badge: teamTimePendingCount ? String(teamTimePendingCount) : undefined,
    },
    {
      id: 'team-absence',
      icon: CalendarDays,
      label: t('home.tools.teamAbsence'),
      description: t('home.tools.descriptions.teamAbsence'),
      route: teamAbsenceRoute,
      badge: teamAbsencePendingCount ? String(teamAbsencePendingCount) : undefined,
    },
    personalTools[4]!,
  ];
  const tools = (homeMode === 'team' ? teamTools : personalTools).filter(
    (tool) => Boolean(tool.route) && (tool.id !== 'services' || employeeServicesDisclosed)
  );

  const timeStatus = currentTime?.status ?? 'UNAVAILABLE';
  const timeStages: HcmHomeTimeStage[] = [
    {
      label: t('home.rhythm.time.record'),
      detail: currentTime
        ? t('home.rhythm.time.recordValue', {
            recorded: recordedHours,
            target: scheduledHours,
          })
        : t('home.states.unavailable'),
      state: !currentTime
        ? 'upcoming'
        : recordedMinutes >= scheduledMinutes && scheduledMinutes > 0
          ? 'completed'
          : 'current',
    },
    {
      label: t('home.rhythm.time.validate'),
      detail: currentTime
        ? currentTime.exceptionCount
          ? t('home.rhythm.time.exceptionValue', {
              count: currentTime.exceptionCount,
            })
          : t('home.rhythm.time.validated')
        : t('home.states.unavailable'),
      state: currentTime?.exceptionCount
        ? 'current'
        : recordedMinutes >= scheduledMinutes && scheduledMinutes > 0
          ? 'completed'
          : 'upcoming',
    },
    {
      label: t('home.rhythm.time.submit'),
      detail: t(`domains.status.${timeStatus}`, {
        defaultValue: timeStatus,
      }),
      state: ['SUBMITTED', 'APPROVED', 'LOCKED'].includes(timeStatus)
        ? 'completed'
        : currentTime && recordedMinutes >= scheduledMinutes && !currentTime.exceptionCount
          ? 'current'
          : 'upcoming',
    },
  ];

  const teamPendingCount =
    teamTimePendingCount !== null && teamAbsencePendingCount !== null
      ? teamTimePendingCount + teamAbsencePendingCount
      : null;
  const modeSummary =
    homeMode === 'team'
      ? teamPendingCount !== null
        ? t('home.header.teamSummary', { count: teamPendingCount })
        : t('home.header.teamUnavailableSummary')
      : currentTime?.exceptionCount
        ? t('home.header.personalExceptionSummary', {
            count: currentTime.exceptionCount,
          })
        : t('home.header.personalSummary');

  return {
    domainAvailable,
    currentTime,
    selfDisplayName,
    firstName,
    organizationName,
    businessTitle,
    managerDisplayName,
    directReportCount,
    primaryLeaveBalance,
    standardDayMinutes,
    availableLeaveDays,
    usedLeaveDays,
    payDaysRemaining,
    hasPayCycle: Boolean(pay?.payDate || pay?.status),
    activeGoalCount: performance?.activeGoalCount ?? 0,
    requiredLearningCount: performance?.requiredLearningCount ?? 0,
    activeJourneyCount: performance?.activeJourneyCount ?? 0,
    activeJourneyProgressPercent: performance?.activeJourneyProgressPercent ?? null,
    journeyTargetDays,
    currentDate,
    freshness,
    teamTimePendingCount,
    teamAbsencePendingCount,
    attentionSignals,
    attentionUnavailable,
    tools,
    timeStages,
    modeSummary,
  };
}
