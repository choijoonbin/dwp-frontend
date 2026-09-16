import { beforeEach, describe, expect, it, vi } from 'vitest';
import { askSelectedWorkStream } from '@dwp-frontend/shared-utils/api/agent-selected-work-api';
import type { AskDwpResponse } from '@dwp-frontend/shared-utils/api/agent-runtime-api';
import {
  executeFreshWorkSchedule,
  selectedWorkFromRequest,
  shouldShowWorkAssignmentRoleFilter,
  submitWorkHubAssist,
  verifiedWorkHubSnapshotFromRefetch,
  workHubCalendarComposerRoute,
} from './work-hub-page-helpers';
import { parseWorkCalendarEventHandoff } from '@dwp-frontend/shared-utils/api/work-hub-calendar-api';
import type { WorkHubItem, WorkHubSnapshot } from './work-hub-contracts';
import type { WorkScheduleCommand, WorkScheduleResult } from './work-hub-scheduling';

vi.mock('@dwp-frontend/shared-utils/api/agent-selected-work-api', () => ({
  askSelectedWorkStream: vi.fn(),
}));

const receivedAt = new Date().toISOString();
const item: WorkHubItem = {
  key: 'PERSONAL_TASK:b1111111-1111-4111-8111-111111111111:',
  reference: {
    sourceSystem: 'PERSONAL_TASK',
    sourceReference: 'b1111111-1111-4111-8111-111111111111',
  },
  sourceId: 'personal',
  title: 'Current work',
  summary: null,
  lifecycle: 'OPEN',
  sourceStatus: 'OPEN',
  originSystem: 'PERSONAL_TASK',
  priority: 'NORMAL',
  dueAt: null,
  waitingFor: 'ME',
  sourceRoute: null,
  version: 3,
  updatedAt: receivedAt,
  reason: null,
  dataClassification: 'INTERNAL',
  actions: [],
};
const snapshot: WorkHubSnapshot = {
  items: [item],
  sources: [
    {
      sourceId: 'personal',
      state: 'READY',
      items: [item],
      receivedAt,
      generatedAt: receivedAt,
      hasMore: false,
    },
  ],
  completeness: 'COMPLETE',
  receivedAt,
};

describe('assignment role filter availability', () => {
  it.each(['READY', 'FORBIDDEN', 'UNAVAILABLE', 'NOT_REQUESTED'] as const)(
    'keeps the filter available for an activated empty assignment source with a %s receipt',
    (state) => {
      const assignmentSnapshot: WorkHubSnapshot = {
        ...snapshot,
        items: [],
        sources: [
          {
            sourceId: 'work-assignments',
            state,
            items: [],
            receivedAt: state === 'READY' ? receivedAt : null,
            generatedAt: null,
            hasMore: false,
          },
        ],
      };

      expect(shouldShowWorkAssignmentRoleFilter(assignmentSnapshot, ['work-assignments'])).toBe(
        true
      );
    }
  );

  it('requires both actor-driven activation and an assignment source receipt', () => {
    expect(shouldShowWorkAssignmentRoleFilter(snapshot, ['work-assignments'])).toBe(false);
    expect(
      shouldShowWorkAssignmentRoleFilter(
        { ...snapshot, sources: [{ ...snapshot.sources[0]!, sourceId: 'work-assignments' }] },
        ['personal']
      )
    ).toBe(false);
    expect(shouldShowWorkAssignmentRoleFilter(undefined, ['work-assignments'])).toBe(false);
  });
});
const scheduleCommand: WorkScheduleCommand = {
  linkId: '36e6e854-ec64-456c-8bcc-46a7d5ba97f2',
  work: item.reference,
  reviewedItemSourceId: item.sourceId,
  reviewedItemSourceStatus: item.sourceStatus,
  reviewedItemVersion: item.version,
  reviewedItemLifecycle: item.lifecycle,
  eventInput: {
    idempotencyKey: '36e6e854-ec64-456c-8bcc-46a7d5ba97f2',
    calendarId: 'calendar-one',
    title: item.title,
    type: 'FOCUS',
    startsAt: '2026-09-08T01:00:00.000Z',
    endsAt: '2026-09-08T02:00:00.000Z',
    timeZone: 'Asia/Seoul',
    allDay: false,
    visibility: 'PRIVATE',
    recurrence: 'NONE',
    recurrenceInterval: 1,
    responseRequired: false,
    attendees: [],
  },
};

function response(statusCode: string): AskDwpResponse {
  return { state: 'ABSTAINED', statusCode } as AskDwpResponse;
}

describe('selected work AI page recovery', () => {
  beforeEach(() => vi.mocked(askSelectedWorkStream).mockReset());

  it.each([
    'SELECTED_WORK_FORBIDDEN',
    'SELECTED_WORK_NOT_FOUND',
    'SELECTED_WORK_STALE',
    'SELECTED_WORK_INVALID_SOURCE',
  ])('resets the selected panel and refreshes the queue for %s', async (statusCode) => {
    const result = response(statusCode);
    vi.mocked(askSelectedWorkStream).mockResolvedValue(result);
    const resetSelection = vi.fn();
    const refetch = vi.fn().mockResolvedValue(undefined);

    await expect(
      submitWorkHubAssist({
        item,
        question: 'Review the current evidence',
        options: {},
        locale: 'en',
        route: '/work/queue',
        refresh: vi.fn().mockResolvedValue(snapshot),
        refetch,
        resetSelection,
      })
    ).resolves.toBe(result);
    expect(resetSelection).toHaveBeenCalledOnce();
    expect(refetch).toHaveBeenCalledOnce();
  });

  it.each([
    'SELECTED_WORK_UNAVAILABLE',
    'SELECTED_WORK_AUTHORIZATION_REQUIRED',
    'SELECTED_WORK_RESTRICTED',
    'SELECTED_WORK_UNSUPPORTED',
  ])('keeps the current item available for guided recovery from %s', async (statusCode) => {
    const result = response(statusCode);
    vi.mocked(askSelectedWorkStream).mockResolvedValue(result);
    const resetSelection = vi.fn();
    const refetch = vi.fn().mockResolvedValue(undefined);

    await expect(
      submitWorkHubAssist({
        item,
        question: 'Keep this question for a retry',
        options: {},
        locale: 'en',
        route: '/work/queue',
        refresh: vi.fn().mockResolvedValue(snapshot),
        refetch,
        resetSelection,
      })
    ).resolves.toBe(result);
    expect(resetSelection).not.toHaveBeenCalled();
    expect(refetch).not.toHaveBeenCalled();
  });

  it.each([
    ['aggregate outage', { ...snapshot, completeness: 'UNAVAILABLE' as const }],
    [
      'source outage',
      { ...snapshot, sources: [{ ...snapshot.sources[0]!, state: 'UNAVAILABLE' as const }] },
    ],
    ['source status drift', { ...snapshot, items: [{ ...item, sourceStatus: 'WAITING' }] }],
    [
      'source identity drift',
      { ...snapshot, items: [{ ...item, sourceId: 'workspace' as const }] },
    ],
  ])('does not dispatch selected AI for %s', async (_label, fresh) => {
    await expect(
      submitWorkHubAssist({
        item,
        question: 'Review evidence',
        options: {},
        locale: 'en',
        route: '/work/queue',
        refresh: vi.fn().mockResolvedValue(fresh),
        refetch: vi.fn().mockResolvedValue(undefined),
        resetSelection: vi.fn(),
      })
    ).rejects.toThrow('context changed');
    expect(askSelectedWorkStream).not.toHaveBeenCalled();
  });

  it('purges a selection whose version changed during preflight', async () => {
    const resetSelection = vi.fn();
    const refetch = vi.fn().mockResolvedValue(undefined);
    await expect(
      submitWorkHubAssist({
        item,
        question: 'Review the current evidence',
        options: {},
        locale: 'en',
        route: '/work/queue',
        refresh: vi.fn().mockResolvedValue({
          ...snapshot,
          items: [{ ...item, version: 4 }],
        }),
        refetch,
        resetSelection,
      })
    ).rejects.toThrow('context changed');
    expect(resetSelection).toHaveBeenCalledOnce();
    expect(refetch).toHaveBeenCalledOnce();
    expect(askSelectedWorkStream).not.toHaveBeenCalled();
  });
});

describe('selected work URL identity', () => {
  const collision = 'b1111111-1111-4111-8111-111111111111';
  const assignment: WorkHubItem = {
    ...item,
    key: `WORK_ASSIGNMENT:${collision}:`,
    reference: { sourceSystem: 'WORK_ASSIGNMENT', sourceReference: collision },
    sourceId: 'work-assignments',
    sourceContext: {
      kind: 'WORK_ASSIGNMENT',
      assignmentState: 'PENDING',
      workState: 'OPEN',
      requesterIsMe: false,
      assigneeIsMe: true,
      sourceAvailability: 'NOT_REQUESTED',
    },
  };

  it('requires the canonical key for the work parameter even when raw identifiers collide', () => {
    expect(
      selectedWorkFromRequest([item, assignment], {
        work: collision,
        personalTaskId: null,
        item: null,
      })
    ).toBeUndefined();
    expect(
      selectedWorkFromRequest([item, assignment], {
        work: assignment.key,
        personalTaskId: null,
        item: null,
      })
    ).toBe(assignment);
  });

  it('confines legacy personal and item parameters to their original owners', () => {
    expect(
      selectedWorkFromRequest([assignment, item], {
        work: null,
        personalTaskId: collision,
        item: null,
      })
    ).toBe(item);
    expect(
      selectedWorkFromRequest([assignment], {
        work: null,
        personalTaskId: null,
        item: collision,
      })
    ).toBeUndefined();
  });
});

describe('work Calendar composer navigation', () => {
  it('keeps the work return URL and sensitive prefill metadata only in fresh router state', () => {
    const now = new Date('2026-09-16T00:00:00.000Z');
    const returnTo = `/work/queue?work=${encodeURIComponent(item.key)}#selected`;
    const navigation = workHubCalendarComposerRoute(
      '2026-09-16',
      returnTo,
      item,
      {
        title: '집중: Current work',
        startsAt: '2026-09-16T09:00:00+09:00',
        endsAt: '2026-09-16T09:30:00+09:00',
        timeZone: 'Asia/Seoul',
      },
      `sha256:${'a'.repeat(64)}`,
      now
    );

    const url = new URL(navigation.to, 'https://dwp.example');
    expect(url.pathname).toBe('/calendar/schedule');
    expect(url.searchParams.get('date')).toBe('2026-09-16');
    expect(url.searchParams.get('create')).toBe('focus');
    expect(url.searchParams.has('returnTo')).toBe(false);
    expect(url.searchParams.has('title')).toBe(false);
    expect(url.searchParams.has('work')).toBe(false);
    expect(parseWorkCalendarEventHandoff(navigation.state, now.getTime())).toMatchObject({
      work: item.reference,
      ownerFingerprint: `sha256:${'a'.repeat(64)}`,
      sourceUrl: `/work/queue?work=${encodeURIComponent(item.key)}`,
      returnTo,
      title: '집중: Current work',
      startsAt: '2026-09-16T09:00:00+09:00',
      endsAt: '2026-09-16T09:30:00+09:00',
    });
  });
});

describe('work schedule aggregate refresh', () => {
  it('only accepts snapshot data from a successful network refetch', () => {
    expect(
      verifiedWorkHubSnapshotFromRefetch({
        data: { snapshot },
        isSuccess: true,
        isRefetchError: false,
      })
    ).toBe(snapshot);
    expect(
      verifiedWorkHubSnapshotFromRefetch({
        data: { snapshot },
        isSuccess: false,
        isRefetchError: true,
      })
    ).toBeNull();
    expect(
      verifiedWorkHubSnapshotFromRefetch({
        data: { snapshot },
        isSuccess: true,
        isRefetchError: true,
      })
    ).toBeNull();
  });

  it('does not call the Calendar/link POST boundary when refresh fails with cached READY data', async () => {
    const sourcePost = vi.fn<() => Promise<WorkScheduleResult>>();

    await expect(
      executeFreshWorkSchedule({
        command: scheduleCommand,
        refresh: vi.fn().mockResolvedValue({
          data: { snapshot },
          isSuccess: false,
          isRefetchError: true,
        }),
        execute: sourcePost,
      })
    ).resolves.toMatchObject({
      state: 'CALENDAR_REJECTED',
      reason: 'WORK_CHANGED',
      retryable: false,
    });
    expect(sourcePost).not.toHaveBeenCalled();
  });

  it('does not call the Calendar/link POST boundary for an aggregate UNAVAILABLE receipt', async () => {
    const sourcePost = vi.fn<() => Promise<WorkScheduleResult>>();

    await expect(
      executeFreshWorkSchedule({
        command: scheduleCommand,
        refresh: vi.fn().mockResolvedValue({
          data: { snapshot: { ...snapshot, completeness: 'UNAVAILABLE' } },
          isSuccess: true,
          isRefetchError: false,
        }),
        execute: sourcePost,
      })
    ).resolves.toMatchObject({ state: 'CALENDAR_REJECTED', reason: 'WORK_CHANGED' });
    expect(sourcePost).not.toHaveBeenCalled();
  });
});
