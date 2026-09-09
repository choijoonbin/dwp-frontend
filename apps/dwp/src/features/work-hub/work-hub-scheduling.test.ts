import { describe, expect, it, vi } from 'vitest';
import type { CalendarEvent, CalendarSummary } from '@dwp-frontend/shared-utils/api/calendar-api';
import type { WorkCalendarLink } from '@dwp-frontend/shared-utils/api/work-hub-calendar-api';
import {
  exactCurrentWorkScheduleLink,
  executeWorkSchedule,
  isExactWorkScheduleCommandForItem,
  isFreshWorkScheduleCommand,
  loadWorkSchedules,
  prepareWorkSchedule,
  unlinkWorkSchedule,
  workScheduleLookupRange,
} from './work-hub-scheduling';
import { executeFreshWorkSchedule } from './work-hub-page-helpers';
import type { WorkHubItem, WorkHubSnapshot } from './work-hub-contracts';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';

const linkId = '36e6e854-ec64-456c-8bcc-46a7d5ba97f2';
const item = {
  key: 'PERSONAL_TASK:task-1:',
  reference: { sourceSystem: 'PERSONAL_TASK', sourceReference: 'task-1' },
  sourceId: 'personal',
  lifecycle: 'OPEN',
  sourceStatus: 'OPEN',
  version: 3,
  dueAt: '2026-09-05T09:00:00Z',
} as WorkHubItem;
const calendar = {
  calendarId: 'calendar-1',
  type: 'PERSONAL',
  capabilities: { canCreateEvents: true },
} as CalendarSummary;
const input = {
  title: '검토 시간',
  startsAt: '2026-09-04T09:00:00+09:00',
  endsAt: '2026-09-04T10:00:00+09:00',
  timeZone: 'Asia/Seoul',
};
const event = {
  eventId: 'b4cbdbdf-ff5a-4a95-8937-8360e6f2194e',
  calendarId: 'calendar-1',
  title: input.title,
  type: 'FOCUS',
  startsAt: input.startsAt,
  endsAt: input.endsAt,
  timeZone: input.timeZone,
  allDay: false,
  visibility: 'PRIVATE',
  recurrence: 'NONE',
  recurrenceInterval: 1,
  responseRequired: false,
  attendees: [],
  status: 'CONFIRMED',
  version: 0,
  calendarName: 'My calendar',
  calendarColor: '#0067c0',
  organizerName: 'Current user',
  conflict: false,
  detailLevel: 'FULL',
  capabilities: {
    canViewDetails: true,
    canEdit: true,
    canDelete: true,
    canRestore: false,
    canRespond: false,
    canStar: true,
  },
} as CalendarEvent;
const link = {
  linkId,
  work: item.reference,
  eventId: event.eventId,
  state: 'LINKED',
  version: 0,
  calendarAvailability: 'REFERENCE_ONLY',
} as WorkCalendarLink;

function clients() {
  return {
    createCalendarEvent: vi.fn().mockResolvedValue(event),
    putWorkCalendarLink: vi.fn().mockResolvedValue(link),
    removeWorkCalendarLink: vi.fn().mockResolvedValue({ ...link, state: 'REMOVED', version: 1 }),
    getCalendarEvents: vi.fn().mockResolvedValue([event]),
    getWorkCalendarLinks: vi
      .fn()
      .mockResolvedValue({ items: [link], page: 0, size: 100, totalElements: 1, hasMore: false }),
  };
}

describe('work time scheduling owner boundary', () => {
  it('keeps event lookups inside the Calendar 370-day contract', () => {
    const range = workScheduleLookupRange('2026-09-04');
    expect(Date.parse(range.to) - Date.parse(range.from)).toBe(360 * 24 * 60 * 60_000);
    expect(() => workScheduleLookupRange('2026-02-31')).toThrow('valid calendar date');
  });
  it('distinguishes a denied Calendar command from an unknown network outcome', async () => {
    const api = clients();
    api.createCalendarEvent.mockRejectedValueOnce(new HttpError('denied', 403));
    const command = prepareWorkSchedule(item, calendar, input, linkId);
    expect(await executeWorkSchedule(command, undefined, undefined, api)).toMatchObject({
      state: 'CALENDAR_REJECTED',
      reason: 'FORBIDDEN',
      retryable: false,
    });
    expect(api.putWorkCalendarLink).not.toHaveBeenCalled();
  });
  it('creates a private focus event independently of the task due date and without attendees', () => {
    const command = prepareWorkSchedule(item, calendar, input, linkId);
    expect(command.eventInput).toMatchObject({
      ...input,
      type: 'FOCUS',
      visibility: 'PRIVATE',
      attendees: [],
      responseRequired: false,
      idempotencyKey: linkId,
    });
    expect(command).toMatchObject({
      work: item.reference,
      reviewedItemSourceId: item.sourceId,
      reviewedItemSourceStatus: item.sourceStatus,
      reviewedItemVersion: item.version,
      reviewedItemLifecycle: item.lifecycle,
    });
    expect(item.dueAt).toBe('2026-09-05T09:00:00Z');
    expect(() => prepareWorkSchedule(item, { ...calendar, type: 'TEAM' }, input)).toThrow(
      'personal calendar'
    );
  });

  it('requires the exact active version from a fresh source receipt before execution', () => {
    const command = prepareWorkSchedule(item, calendar, input, linkId);
    const snapshot = {
      items: [item],
      sources: [
        {
          sourceId: item.sourceId,
          state: 'READY',
          items: [item],
          receivedAt: '2026-09-04T08:00:00Z',
          generatedAt: '2026-09-04T08:00:00Z',
          hasMore: false,
        },
      ],
      completeness: 'COMPLETE',
      receivedAt: '2026-09-04T08:00:00Z',
    } as WorkHubSnapshot;

    expect(isExactWorkScheduleCommandForItem(command, item)).toBe(true);
    expect(isFreshWorkScheduleCommand(command, snapshot)).toBe(true);
    expect(
      isFreshWorkScheduleCommand(command, {
        ...snapshot,
        items: [{ ...item, version: item.version + 1 }],
      })
    ).toBe(false);
    expect(
      isFreshWorkScheduleCommand(command, {
        ...snapshot,
        items: [{ ...item, lifecycle: 'COMPLETED' }],
      })
    ).toBe(false);
    expect(
      isFreshWorkScheduleCommand(command, {
        ...snapshot,
        sources: [{ ...snapshot.sources[0]!, state: 'UNAVAILABLE' }],
      })
    ).toBe(false);
    expect(
      isFreshWorkScheduleCommand(command, {
        ...snapshot,
        items: [{ ...item, sourceStatus: 'WAITING' }],
        sources: [{ ...snapshot.sources[0]!, items: [{ ...item, sourceStatus: 'WAITING' }] }],
      })
    ).toBe(false);
    expect(isFreshWorkScheduleCommand(command, { ...snapshot, completeness: 'UNAVAILABLE' })).toBe(
      false
    );
  });

  it('requires the personal authority source even when the selected source is READY', () => {
    const workspaceItem = {
      ...item,
      key: 'WORKSPACE:work-1:',
      reference: { sourceSystem: 'WORKSPACE', sourceReference: 'work-1' },
      sourceId: 'workspace',
    } as WorkHubItem;
    const command = prepareWorkSchedule(workspaceItem, calendar, input, linkId);
    const workspaceSource = {
      sourceId: 'workspace' as const,
      state: 'READY' as const,
      items: [workspaceItem],
      receivedAt: '2026-09-04T08:00:00Z',
      generatedAt: '2026-09-04T08:00:00Z',
      hasMore: false,
    };
    const personalSource = {
      ...workspaceSource,
      sourceId: 'personal' as const,
      items: [],
    };
    const candidate: WorkHubSnapshot = {
      items: [workspaceItem],
      sources: [workspaceSource, { ...personalSource, state: 'UNAVAILABLE', receivedAt: null }],
      completeness: 'PARTIAL',
      receivedAt: '2026-09-04T08:00:00Z',
    };

    expect(isFreshWorkScheduleCommand(command, candidate)).toBe(false);
    expect(
      isFreshWorkScheduleCommand(command, {
        ...candidate,
        sources: [workspaceSource, personalSource],
      })
    ).toBe(true);
  });

  it('never executes Calendar creation when aggregate or personal authority is unavailable', async () => {
    const command = prepareWorkSchedule(item, calendar, input, linkId);
    const ready: WorkHubSnapshot = {
      items: [item],
      sources: [
        {
          sourceId: 'personal',
          state: 'READY',
          items: [item],
          receivedAt: '2026-09-04T08:00:00Z',
          generatedAt: '2026-09-04T08:00:00Z',
          hasMore: false,
        },
      ],
      completeness: 'COMPLETE',
      receivedAt: '2026-09-04T08:00:00Z',
    };
    const execute = vi.fn(async () => {
      throw new Error('Calendar execution must not run');
    });
    const denied = [
      { ...ready, completeness: 'UNAVAILABLE' as const },
      {
        ...ready,
        completeness: 'PARTIAL' as const,
        sources: [
          {
            ...ready.sources[0]!,
            state: 'UNAVAILABLE' as const,
            items: [],
            receivedAt: null,
          },
        ],
      },
    ];

    for (const candidate of denied) {
      await expect(
        executeFreshWorkSchedule({
          command,
          refresh: vi.fn().mockResolvedValue({
            data: { snapshot: candidate },
            isSuccess: true,
            isRefetchError: false,
          }),
          execute,
        })
      ).resolves.toMatchObject({ state: 'CALENDAR_REJECTED', reason: 'WORK_CHANGED' });
    }
    expect(execute).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', []],
    ['removed', [{ ...link, state: 'REMOVED' as const }]],
    ['version drift', [{ ...link, version: link.version + 1 }]],
    ['event drift', [{ ...link, eventId: '85fdccda-1ba0-4c7d-9829-189db4da0b4d' }]],
    [
      'work drift',
      [
        {
          ...link,
          work: { sourceSystem: 'PERSONAL_TASK', sourceReference: 'task-2' },
        },
      ],
    ],
    ['duplicate', [link, { ...link }]],
  ] as const)('rejects a %s current link during unlink review', (_label, candidates) => {
    expect(exactCurrentWorkScheduleLink(candidates, link)).toBeNull();
  });

  it('accepts exactly one unchanged current LINKED relationship', () => {
    expect(exactCurrentWorkScheduleLink([link], link)).toBe(link);
  });

  it('does not send a command with a terminal reviewed lifecycle to Calendar', async () => {
    const api = clients();
    const command = {
      ...prepareWorkSchedule(item, calendar, input, linkId),
      reviewedItemLifecycle: 'COMPLETED' as const,
    };

    await expect(executeWorkSchedule(command, undefined, undefined, api)).resolves.toMatchObject({
      state: 'CALENDAR_REJECTED',
      reason: 'INVALID_COMMAND',
      retryable: false,
    });
    expect(api.createCalendarEvent).not.toHaveBeenCalled();
    expect(api.putWorkCalendarLink).not.toHaveBeenCalled();
  });

  it('retries only the link save after the Calendar event is confirmed', async () => {
    const api = clients();
    api.putWorkCalendarLink.mockRejectedValueOnce(new Error('response lost'));
    const command = prepareWorkSchedule(item, calendar, input, linkId);
    const pending = await executeWorkSchedule(command, undefined, undefined, api);
    expect(pending).toMatchObject({ state: 'LINK_PENDING', command, event, sourceChanged: false });
    expect(await executeWorkSchedule(command, event, undefined, api)).toMatchObject({
      state: 'SCHEDULED',
      sourceChanged: false,
    });
    expect(api.createCalendarEvent).toHaveBeenCalledTimes(1);
    expect(api.putWorkCalendarLink.mock.calls).toEqual([
      [linkId, { work: item.reference, eventId: event.eventId }, undefined],
      [linkId, { work: item.reference, eventId: event.eventId }, undefined],
    ]);
  });

  it('retains the same Calendar idempotency key when the create outcome is unknown', async () => {
    const api = clients();
    api.createCalendarEvent.mockRejectedValueOnce(new Error('timeout'));
    const command = prepareWorkSchedule(item, calendar, input, linkId);
    expect(await executeWorkSchedule(command, undefined, undefined, api)).toMatchObject({
      state: 'CALENDAR_UNCONFIRMED',
      command,
    });
    await executeWorkSchedule(command, undefined, undefined, api);
    expect(api.createCalendarEvent.mock.calls.map(([request]) => request.idempotencyKey)).toEqual([
      linkId,
      linkId,
    ]);
  });

  it('never turns an inaccessible or out-of-range Calendar reference into deletion or task completion', async () => {
    const api = clients();
    api.getCalendarEvents.mockResolvedValueOnce([]);
    expect(await loadWorkSchedules(input.startsAt, input.endsAt, undefined, api)).toMatchObject({
      state: 'LOADED',
      items: [{ state: 'NOT_IN_RANGE_OR_UNAVAILABLE', event: null }],
    });
    api.getCalendarEvents.mockRejectedValueOnce(new Error('denied'));
    expect(await loadWorkSchedules(input.startsAt, input.endsAt, undefined, api)).toMatchObject({
      state: 'PARTIAL',
      items: [{ state: 'UNAVAILABLE', event: null }],
    });
    expect(await unlinkWorkSchedule(link, undefined, api)).toMatchObject({
      calendarChanged: false,
      sourceChanged: false,
      link: { state: 'REMOVED' },
    });
    expect(api.createCalendarEvent).not.toHaveBeenCalled();
  });

  it('propagates the query AbortSignal to both relationship and Calendar reads', async () => {
    const api = clients();
    const abort = new AbortController();

    await loadWorkSchedules(input.startsAt, input.endsAt, { signal: abort.signal }, api);

    expect(api.getWorkCalendarLinks).toHaveBeenCalledWith(0, 100, abort.signal);
    expect(api.getCalendarEvents).toHaveBeenCalledWith(input.startsAt, input.endsAt, abort.signal);
  });

  it('stops before link persistence and retains the exact event after scope cancellation', async () => {
    const api = clients();
    let allowed = true;
    api.createCalendarEvent.mockImplementationOnce(async () => {
      allowed = false;
      return event;
    });
    const command = prepareWorkSchedule(item, calendar, input, linkId);

    await expect(
      executeWorkSchedule(command, undefined, { canContinue: () => allowed }, api)
    ).resolves.toMatchObject({
      state: 'LINK_PENDING',
      reason: 'CANCELLED',
      command,
      event,
      retryable: true,
    });
    expect(api.putWorkCalendarLink).not.toHaveBeenCalled();
  });

  it('reuses the same link id after an aborted ambiguous link response', async () => {
    const api = clients();
    const abort = new AbortController();
    api.putWorkCalendarLink.mockImplementationOnce(async () => {
      abort.abort();
      throw new DOMException('cancelled', 'AbortError');
    });
    const command = prepareWorkSchedule(item, calendar, input, linkId);

    const pending = await executeWorkSchedule(command, undefined, { signal: abort.signal }, api);

    expect(pending).toMatchObject({ state: 'LINK_PENDING', command, event, reason: 'CANCELLED' });
    await executeWorkSchedule(command, event, undefined, api);
    expect(api.putWorkCalendarLink.mock.calls.map(([candidate]) => candidate)).toEqual([
      linkId,
      linkId,
    ]);
    expect(api.createCalendarEvent).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['event id', { eventId: 'not-a-uuid' }],
    ['calendar', { calendarId: 'other-calendar' }],
    ['title', { title: 'different title' }],
    ['start', { startsAt: '2026-09-04T11:00:00+09:00' }],
    ['type', { type: 'TASK' }],
    ['status', { status: 'CANCELLED' }],
    ['missing version', { version: undefined }],
    ['version', { version: Number.NaN }],
  ])('does not confirm a mismatched Calendar %s receipt', async (_label, mismatch) => {
    const api = clients();
    api.createCalendarEvent.mockResolvedValueOnce({ ...event, ...mismatch });
    const command = prepareWorkSchedule(item, calendar, input, linkId);

    await expect(executeWorkSchedule(command, undefined, undefined, api)).resolves.toMatchObject({
      state: 'CALENDAR_UNCONFIRMED',
      reason: 'INVALID_RECEIPT',
      retryable: true,
    });
    expect(api.putWorkCalendarLink).not.toHaveBeenCalled();
  });

  it.each([
    ['link id', { linkId: '46e6e854-ec64-456c-8bcc-46a7d5ba97f2' }],
    ['work', { work: { sourceSystem: 'PERSONAL_TASK', sourceReference: 'task-2' } }],
    ['event', { eventId: '85fdccda-1ba0-4c7d-9829-189db4da0b4d' }],
    ['state', { state: 'REMOVED' }],
    ['missing version', { version: undefined }],
    ['version', { version: Number.POSITIVE_INFINITY }],
  ])('does not confirm a mismatched link %s receipt', async (_label, mismatch) => {
    const api = clients();
    api.putWorkCalendarLink.mockResolvedValueOnce({ ...link, ...mismatch });
    const command = prepareWorkSchedule(item, calendar, input, linkId);

    await expect(executeWorkSchedule(command, undefined, undefined, api)).resolves.toMatchObject({
      state: 'LINK_PENDING',
      reason: 'INVALID_RECEIPT',
      retryable: true,
    });
  });

  it.each([
    ['link id', { linkId: '46e6e854-ec64-456c-8bcc-46a7d5ba97f2' }],
    ['work', { work: { sourceSystem: 'PERSONAL_TASK', sourceReference: 'task-2' } }],
    ['event', { eventId: '85fdccda-1ba0-4c7d-9829-189db4da0b4d' }],
    ['state', { state: 'LINKED' }],
    ['missing version', { version: undefined }],
    ['stale version', { version: link.version }],
  ])('rejects a mismatched unlink %s receipt', async (_label, mismatch) => {
    const api = clients();
    api.removeWorkCalendarLink.mockResolvedValueOnce({
      ...link,
      state: 'REMOVED',
      version: link.version + 1,
      ...mismatch,
    });

    await expect(unlinkWorkSchedule(link, undefined, api)).rejects.toThrow('unlink receipt');
  });

  it('treats missing 2xx bodies as unconfirmed evidence', async () => {
    const command = prepareWorkSchedule(item, calendar, input, linkId);
    const missingEvent = clients();
    missingEvent.createCalendarEvent.mockResolvedValueOnce(null);
    await expect(
      executeWorkSchedule(command, undefined, undefined, missingEvent)
    ).resolves.toMatchObject({ state: 'CALENDAR_UNCONFIRMED', reason: 'INVALID_RECEIPT' });

    const missingLink = clients();
    missingLink.putWorkCalendarLink.mockResolvedValueOnce(null);
    await expect(
      executeWorkSchedule(command, undefined, undefined, missingLink)
    ).resolves.toMatchObject({ state: 'LINK_PENDING', reason: 'INVALID_RECEIPT' });

    const missingUnlink = clients();
    missingUnlink.removeWorkCalendarLink.mockResolvedValueOnce(null);
    await expect(unlinkWorkSchedule(link, undefined, missingUnlink)).rejects.toThrow(
      'unlink receipt'
    );
  });

  it.each([
    [
      'repeated page',
      [
        { items: [link], page: 0, size: 100, totalElements: 2, hasMore: true },
        {
          items: [{ ...link, linkId: '46e6e854-ec64-456c-8bcc-46a7d5ba97f2' }],
          page: 0,
          size: 100,
          totalElements: 2,
          hasMore: false,
        },
      ],
    ],
    [
      'duplicate link',
      [
        { items: [link], page: 0, size: 100, totalElements: 2, hasMore: true },
        { items: [link], page: 1, size: 100, totalElements: 2, hasMore: false },
      ],
    ],
    ['empty progress', [{ items: [], page: 0, size: 100, totalElements: 2, hasMore: true }]],
    ['false total', [{ items: [link], page: 0, size: 100, totalElements: 2, hasMore: false }]],
  ])('fails closed on a malformed %s pagination receipt', async (_label, pages) => {
    const api = clients();
    api.getWorkCalendarLinks.mockReset();
    pages.forEach((page) => api.getWorkCalendarLinks.mockResolvedValueOnce(page));

    await expect(loadWorkSchedules(input.startsAt, input.endsAt, undefined, api)).resolves.toEqual({
      state: 'UNAVAILABLE',
      items: [],
    });
    expect(api.getWorkCalendarLinks).toHaveBeenCalledTimes(pages.length);
  });
});
