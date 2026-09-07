import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  activityContributionProvider,
  calendarContributionProvider,
  hrContributionProvider,
  notificationContributionProvider,
  workspaceWorkContributionProvider,
} from './home-contribution-providers';
import {
  homeContributionI18nReady,
  translateHomeContributionEn,
} from './home-contribution-i18n.test-support';

import type {
  AppNotificationSummary,
  CalendarHome,
  HrHomeOverview,
  WorkspaceActivityFeed,
  WorkspaceWorkQueue,
} from '@dwp-frontend/shared-utils';

const NOW = '2026-08-25T01:00:00.000Z';
const EN_CONTEXT = {
  now: NOW,
  snapshotAt: NOW,
  dateKey: '2026-08-25',
  locale: 'en-US',
  timeZone: 'Asia/Seoul',
  translate: translateHomeContributionEn,
} as const;

beforeAll(() => homeContributionI18nReady);

function workQueue(dueSoon: number): WorkspaceWorkQueue {
  return {
    summary: { total: dueSoon, dueSoon, inProgress: dueSoon, waiting: 0, completed: 0 },
    items: [],
    generatedAt: NOW,
  };
}

function calendarHome(awaitingResponseCount: number): CalendarHome {
  return {
    date: '2026-08-25',
    timeZone: 'Asia/Seoul',
    today: [],
    metrics: {
      eventCount: 0,
      meetingMinutes: 0,
      focusMinutes: 0,
      focusTargetMinutes: 120,
      conflictCount: 0,
      awaitingResponseCount,
      availableRoomCount: 0,
    },
    weekLoad: [],
    attention: [],
    generatedAt: NOW,
  };
}

function activityFeed(count: number): WorkspaceActivityFeed {
  return {
    events: Array.from({ length: count }, (_, index) => ({
      id: `activity-${String(index + 1)}`,
      occurredAt: NOW,
      actor: 'system',
      actorName: 'DWP',
      state: 'needs-input' as const,
      title: `Activity ${String(index + 1)}`,
      objectType: 'TASK',
      objectLabel: `Task ${String(index + 1)}`,
      source: 'WORK',
      auditId: `audit-${String(index + 1)}`,
    })),
    generatedAt: NOW,
    executionSummary: {
      total: count,
      running: 0,
      needsInput: count,
      policyBlocked: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      generatedAt: NOW,
      coverage: { supportedObjectTypes: ['WORK_ITEM'] },
    },
  };
}

function hrHome(exceptionCount: number): HrHomeOverview {
  return {
    asOf: NOW,
    generatedAt: NOW,
    timeZone: 'Asia/Seoul',
    standardDayMinutes: 480,
    employee: { personId: 'person-1', displayName: 'User', directReportCount: 0 },
    time: {
      timeCardId: `time-${String(exceptionCount)}`,
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
      status: 'DRAFT',
      scheduledMinutes: 480,
      recordedMinutes: 420,
      exceptionCount,
      dataOrigin: 'SOURCE',
      version: 1,
    },
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
  };
}

function notificationSummary(count: number, urgent = false): AppNotificationSummary {
  return {
    partial: false,
    unavailableSources: [],
    apps: [
      {
        appKey: 'approvals' as AppNotificationSummary['apps'][number]['appKey'],
        totalUnread: count,
        actionableUnread: urgent ? 0 : count,
        urgentUnread: urgent ? count : 0,
        lastActivityAt: NOW as AppNotificationSummary['apps'][number]['lastActivityAt'],
      },
    ],
    changeVersion: '1',
    counterVersion: '1',
    generatedAt: NOW as AppNotificationSummary['generatedAt'],
  };
}

describe('Home contribution provider localization contract', () => {
  it('uses i18next count rules for every formerly assembled English count phrase', () => {
    const workspaceDescription = (count: number) =>
      workspaceWorkContributionProvider
        .normalize(workQueue(count), EN_CONTEXT)
        .find((item) => item.id === 'workspace-work:open-pulse')?.description;
    expect(workspaceDescription(1)).toBe('1 item needs attention.');
    expect(workspaceDescription(2)).toBe('2 items need attention.');

    const calendarResponse = (count: number) =>
      calendarContributionProvider
        .normalize(calendarHome(count), EN_CONTEXT)
        .find((item) => item.id === 'calendar:awaiting-response');
    expect(calendarResponse(1)).toMatchObject({
      title: 'A calendar invitation needs a response',
      description: '1 calendar invitation needs a response.',
    });
    expect(calendarResponse(2)).toMatchObject({
      title: 'Calendar invitations need a response',
      description: '2 calendar invitations need a response.',
    });
    const calendarAttention = (count: number) =>
      calendarContributionProvider
        .normalize(calendarHome(count), EN_CONTEXT)
        .find((item) => item.id === 'calendar:awaiting-response-readonly');
    expect(calendarAttention(1)).toMatchObject({
      title: 'A calendar invitation needs attention',
      description: 'Review 1 calendar invitation.',
    });
    expect(calendarAttention(2)).toMatchObject({
      title: 'Calendar invitations need attention',
      description: 'Review 2 calendar invitations.',
    });

    const activityDescription = (count: number) =>
      activityContributionProvider.normalize(activityFeed(count), EN_CONTEXT)[0]?.description;
    expect(activityDescription(1)).toBe('1 activity item is waiting for input or policy review.');
    expect(activityDescription(2)).toBe('2 activity items are waiting for input or policy review.');

    const hrDescription = (count: number) =>
      hrContributionProvider.normalize({ home: hrHome(count), audience: 'MEMBER' }, EN_CONTEXT)[0]
        ?.description;
    expect(hrDescription(1)).toBe('1 exception needs attention.');
    expect(hrDescription(2)).toBe('2 exceptions need attention.');

    const notification = (count: number) =>
      notificationContributionProvider.normalize(notificationSummary(count), EN_CONTEXT)[0];
    expect(notification(1)).toMatchObject({
      title: 'Review Approvals notification',
      description: '1 actionable notification',
    });
    expect(notification(2)).toMatchObject({
      title: 'Review Approvals notifications',
      description: '2 actionable notifications',
    });
    const urgentNotification = (count: number) =>
      notificationContributionProvider.normalize(notificationSummary(count, true), EN_CONTEXT)[0];
    expect(urgentNotification(1)).toMatchObject({
      title: 'Urgent Approvals notification',
      description: '1 urgent notification',
    });
    expect(urgentNotification(2)).toMatchObject({
      title: 'Urgent Approvals notifications',
      description: '2 urgent notifications',
    });
  });

  it('keeps provider-owned presentation copy out of source code', () => {
    const providerSource = readFileSync(
      new URL('./home-contribution-providers.ts', import.meta.url),
      'utf8'
    );

    expect(providerSource).not.toMatch(/\bcopy\s*\(/u);
    expect(providerSource).not.toMatch(/[가-힣]/u);
    expect(providerSource).not.toMatch(/\b(?:item|invitation|exception|notification)\(s\)/iu);
    expect(providerSource).not.toMatch(/\b(?:title|description|redactedTitle):\s*['"`]/u);
  });
});
