import { describe, expect, it } from 'vitest';

import {
  buildFlowHomeViewModel,
  buildFlowSignals,
  buildTodayFlowline,
  rankFlowNowItems,
} from './flow-home-model';

import type { HomeOverview, WorkspaceWorkItem } from '@dwp-frontend/shared-utils';

function work(overrides: Partial<WorkspaceWorkItem>): WorkspaceWorkItem {
  return {
    workItemId: overrides.id ?? 'work-1',
    id: 'work-1',
    title: 'Review request',
    type: 'Approval',
    priority: 'medium',
    status: 'in-progress',
    owner: 'owner',
    sourceSystem: 'DWP_WORK',
    version: 1,
    updatedAt: '2026-08-21T00:00:00Z',
    ...overrides,
  };
}

const overview = {
  audience: { profile: 'MEMBER', ruleVersion: '1', reasons: [] },
  work: {
    status: 'AVAILABLE',
    source: 'DWP_WORK',
    generatedAt: '2026-08-21T00:00:00Z',
    data: {
      summary: { total: 2, dueSoon: 1, inProgress: 1, waiting: 0, completed: 0 },
      generatedAt: '2026-08-21T00:00:00Z',
      items: [
        work({ id: 'normal', workItemId: 'normal' }),
        work({
          id: 'urgent',
          workItemId: 'urgent',
          priority: 'high',
          status: 'due-soon',
          dueAt: '2026-08-21T06:00:00Z',
        }),
      ],
    },
  },
  calendar: {
    status: 'AVAILABLE',
    source: 'DWP_CALENDAR',
    generatedAt: '2026-08-21T00:00:00Z',
    data: {
      date: '2026-08-21',
      timeZone: 'Asia/Seoul',
      today: [
        {
          eventId: 'event-1',
          title: 'Operating review',
          startsAt: '2026-08-21T03:00:00Z',
          endsAt: '2026-08-21T04:00:00Z',
          status: 'CONFIRMED',
          allDay: false,
          conflict: false,
          responseRequired: false,
        },
      ],
      metrics: {
        eventCount: 1,
        meetingMinutes: 60,
        focusMinutes: 30,
        focusTargetMinutes: 60,
        conflictCount: 0,
        awaitingResponseCount: 0,
        availableRoomCount: 1,
      },
      weekLoad: [
        {
          date: '2026-08-21',
          meetingMinutes: 60,
          focusMinutes: 30,
          eventCount: 1,
          conflictCount: 0,
          loadPercent: 72,
        },
      ],
      attention: [],
      generatedAt: '2026-08-21T00:00:00Z',
    },
  },
  communications: {
    status: 'AVAILABLE',
    source: 'DWP_COMMUNICATIONS',
    generatedAt: '2026-08-21T00:00:00Z',
    data: null,
  },
  activity: {
    status: 'AVAILABLE',
    source: 'DWP_ACTIVITY',
    generatedAt: '2026-08-21T00:00:00Z',
    data: {
      events: [],
      generatedAt: '2026-08-21T00:00:00Z',
      executionSummary: {
        total: 0,
        running: 0,
        needsInput: 0,
        policyBlocked: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        generatedAt: '2026-08-21T00:00:00Z',
        coverage: { supportedObjectTypes: [] },
      },
    },
  },
  recommendations: {
    status: 'AVAILABLE',
    source: 'DWP_RECOMMENDATIONS',
    generatedAt: '2026-08-21T00:00:00Z',
    data: [],
  },
  generatedAt: '2026-08-21T00:00:00Z',
} as unknown as HomeOverview;

describe('Flow Home model', () => {
  it('uses the current sourced schedule load as the KPI and keeps conflicts as context', () => {
    const conflictOverview = {
      ...overview,
      calendar: {
        ...overview.calendar,
        data: {
          ...overview.calendar.data,
          metrics: {
            ...overview.calendar.data!.metrics,
            conflictCount: 2,
          },
        },
      },
    } as unknown as HomeOverview;

    expect(
      buildFlowSignals(conflictOverview).find((signal) => signal.key === 'schedule-load')
    ).toMatchObject({
      value: 72,
      unit: 'percent',
      tone: 'risk',
      comparison: { kind: 'threshold', value: 2 },
      seriesCurrentDate: '2026-08-21',
    });
  });

  it('does not fabricate a schedule load KPI without a load point for the calendar date', () => {
    const missingCurrentLoad = {
      ...overview,
      calendar: {
        ...overview.calendar,
        data: {
          ...overview.calendar.data,
          weekLoad: [
            {
              ...overview.calendar.data!.weekLoad[0],
              date: '2026-08-20',
            },
          ],
        },
      },
    } as unknown as HomeOverview;

    expect(
      buildFlowSignals(missingCurrentLoad).some((signal) => signal.key === 'schedule-load')
    ).toBe(false);
  });

  it('ranks due, high-priority work first and excludes completed work', () => {
    const ranked = rankFlowNowItems([
      work({ id: 'done', status: 'completed', priority: 'high' }),
      ...overview.work.data!.items,
    ]);
    expect(ranked.map((item) => item.id)).toEqual(['urgent', 'normal']);
  });

  it('merges real calendar and due work into a three-item action budget', () => {
    const result = buildTodayFlowline(overview, new Date('2026-08-21T02:00:00Z'));
    expect(result.items.map((item) => item.key)).toEqual(['calendar:event-1', 'work:urgent']);
    expect(result.overflow).toBe(0);
    expect(result.dateState).toEqual({
      expectedDate: '2026-08-21',
      payloadDate: '2026-08-21',
      mismatch: false,
    });
  });

  it('matches due work to the calendar date in the user time zone', () => {
    const boundaryOverview = {
      ...overview,
      work: {
        ...overview.work,
        data: {
          ...overview.work.data,
          items: [
            work({
              id: 'kst-boundary',
              workItemId: 'kst-boundary',
              dueAt: '2026-08-21T15:30:00Z',
            }),
          ],
        },
      },
      calendar: {
        ...overview.calendar,
        data: {
          ...overview.calendar.data,
          date: '2026-08-22',
          today: [],
        },
      },
    } as unknown as HomeOverview;

    expect(
      buildTodayFlowline(
        boundaryOverview,
        new Date('2026-08-21T15:10:00Z'),
        'Asia/Seoul'
      ).items.map((item) => item.key)
    ).toEqual(['work:kst-boundary']);
    expect(
      buildTodayFlowline(boundaryOverview, new Date('2026-08-21T15:10:00Z'), 'UTC').items.map(
        (item) => item.key
      )
    ).toEqual(['work:kst-boundary']);
    expect(
      buildTodayFlowline(boundaryOverview, new Date('2026-08-21T15:10:00Z'), 'UTC').dateState
    ).toEqual({
      expectedDate: '2026-08-21',
      payloadDate: '2026-08-22',
      mismatch: true,
    });
  });

  it('does not label a stale calendar payload as today', () => {
    const staleOverview = {
      ...overview,
      calendar: {
        ...overview.calendar,
        data: {
          ...overview.calendar.data,
          date: '2026-08-20',
          today: [
            {
              ...overview.calendar.data!.today[0],
              eventId: 'stale-event',
              startsAt: '2026-08-20T03:00:00Z',
              endsAt: '2026-08-20T04:00:00Z',
            },
          ],
        },
      },
    } as unknown as HomeOverview;

    const result = buildTodayFlowline(staleOverview, new Date('2026-08-21T02:00:00Z'), 'UTC');

    expect(result.dateState).toEqual({
      expectedDate: '2026-08-21',
      payloadDate: '2026-08-20',
      mismatch: true,
    });
    expect(result.items.map((item) => item.key)).toEqual(['work:urgent']);
    expect(result.items.some((item) => item.key === 'calendar:stale-event')).toBe(false);
  });

  it('keeps up to six source-backed items, orders active items by time, and compresses history', () => {
    const event = (
      eventId: string,
      startsAt: string,
      endsAt: string,
      overrides: Record<string, unknown> = {}
    ) => ({
      ...overview.calendar.data!.today[0],
      eventId,
      title: eventId,
      startsAt,
      endsAt,
      ...overrides,
    });
    const prioritizedOverview = {
      ...overview,
      work: {
        ...overview.work,
        data: { ...overview.work.data, items: [] },
      },
      calendar: {
        ...overview.calendar,
        data: {
          ...overview.calendar.data,
          today: [
            event('completed', '2026-08-21T00:00:00Z', '2026-08-21T01:00:00Z'),
            event('current', '2026-08-21T02:00:00Z', '2026-08-21T03:00:00Z'),
            event('upcoming', '2026-08-21T04:00:00Z', '2026-08-21T05:00:00Z'),
            event('attention', '2026-08-21T05:00:00Z', '2026-08-21T06:00:00Z', {
              responseRequired: true,
              myResponse: 'NEEDS_ACTION',
            }),
            event('risk', '2026-08-21T06:00:00Z', '2026-08-21T07:00:00Z', {
              conflict: true,
            }),
          ],
        },
      },
    } as unknown as HomeOverview;

    const result = buildTodayFlowline(prioritizedOverview, new Date('2026-08-21T02:30:00Z'), 'UTC');

    expect(result.items.map((item) => [item.key, item.state])).toEqual([
      ['calendar:completed', 'completed'],
      ['calendar:current', 'current'],
      ['calendar:upcoming', 'upcoming'],
      ['calendar:attention', 'attention'],
      ['calendar:risk', 'risk'],
    ]);
    expect(result.overflow).toBe(0);
  });

  it('compresses completed history to its most recent item', () => {
    const completedOverview = {
      ...overview,
      work: {
        ...overview.work,
        data: { ...overview.work.data, items: [] },
      },
      calendar: {
        ...overview.calendar,
        data: {
          ...overview.calendar.data,
          today: ['00', '01', '02'].map((hour, index) => ({
            ...overview.calendar.data!.today[0],
            eventId: `completed-${index + 1}`,
            startsAt: `2026-08-21T${hour}:00:00Z`,
            endsAt: `2026-08-21T${hour}:30:00Z`,
            conflict: index === 2,
            responseRequired: index === 2,
            myResponse: index === 2 ? 'NEEDS_ACTION' : 'ACCEPTED',
          })),
        },
      },
    } as unknown as HomeOverview;

    const result = buildTodayFlowline(completedOverview, new Date('2026-08-21T04:00:00Z'), 'UTC');

    expect(result.items.map((item) => item.key)).toEqual(['calendar:completed-3']);
    expect(result.items[0]?.state).toBe('completed');
    expect(result.overflow).toBe(2);
  });

  it('builds only source-backed signals and explicit comparisons', () => {
    const model = buildFlowHomeViewModel(overview);
    expect(model.signals.map((signal) => signal.key)).toEqual([
      'open-work',
      'focus-time',
      'schedule-load',
      'activity-attention',
    ]);
    expect(model.signals.find((signal) => signal.key === 'focus-time')?.comparison).toEqual({
      kind: 'target',
      value: 60,
    });
  });

  it('does not infer current activity attention from historical events when the ledger summary is absent', () => {
    const historical = {
      ...overview,
      activity: {
        ...overview.activity,
        data: {
          events: [{ state: 'needs-input' }, { state: 'policy-blocked' }],
          generatedAt: overview.generatedAt,
        },
      },
    } as unknown as HomeOverview;
    expect(buildFlowSignals(historical).some((signal) => signal.key === 'activity-attention')).toBe(
      false
    );
  });

  it('uses current ledger attention independently of the size and state of the history page', () => {
    const ledger = {
      ...overview,
      activity: {
        ...overview.activity,
        data: {
          ...overview.activity.data,
          events: [],
          executionSummary: {
            ...overview.activity.data!.executionSummary!,
            needsInput: 2,
            policyBlocked: 1,
          },
        },
      },
    } as HomeOverview;
    expect(
      buildFlowSignals(ledger).find((signal) => signal.key === 'activity-attention')
    ).toMatchObject({
      value: 3,
      route: '/activity/timeline',
      activityBreakdown: { needsInput: 2, policyBlocked: 1 },
    });
    expect(
      buildFlowSignals({ ...ledger, activity: { ...ledger.activity, status: 'FORBIDDEN' } }).some(
        (signal) => signal.key === 'activity-attention'
      )
    ).toBe(false);
    const unavailable = {
      ...ledger,
      activity: {
        ...ledger.activity,
        data: {
          ...ledger.activity.data!,
          executionSummaryStatus: 'UNAVAILABLE' as const,
        },
      },
    };
    expect(
      buildFlowSignals(unavailable).some((signal) => signal.key === 'activity-attention')
    ).toBe(false);
  });

  it('does not repeat any of the three visible priority items in the timeline', () => {
    const prioritizedOverview = {
      ...overview,
      work: {
        ...overview.work,
        data: {
          ...overview.work.data,
          items: [
            ...overview.work.data!.items,
            work({
              id: 'third-priority',
              workItemId: 'third-priority',
              priority: 'medium',
              dueAt: '2026-08-21T08:00:00Z',
            }),
          ],
        },
      },
    } as unknown as HomeOverview;
    const model = buildFlowHomeViewModel(
      prioritizedOverview,
      new Date('2026-08-21T02:00:00Z'),
      'UTC'
    );

    expect(model.nowItems[0]?.id).toBe('urgent');
    expect(model.nowItems.map((item) => item.id)).toEqual(['urgent', 'third-priority', 'normal']);
    expect(model.flowline.some((item) => item.kind === 'work')).toBe(false);
    expect(model.flowline.map((item) => item.key)).toEqual(['calendar:event-1']);
  });

  it('never derives personal work from a forbidden or unavailable section payload', () => {
    const forbidden = {
      ...overview,
      work: { ...overview.work, status: 'FORBIDDEN' as const },
    } as HomeOverview;

    const model = buildFlowHomeViewModel(forbidden);

    expect(model.nowItems).toEqual([]);
    expect(model.flowline.some((item) => item.kind === 'work')).toBe(false);
    expect(model.signals.some((signal) => signal.key === 'open-work')).toBe(false);
  });
});
