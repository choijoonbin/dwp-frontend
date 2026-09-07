import { describe, expect, it, vi } from 'vitest';
import type { CalendarEvent, CalendarSummary } from '@dwp-frontend/shared-utils/api/calendar-api';
import type { WorkCalendarLink } from '@dwp-frontend/shared-utils/api/work-hub-calendar-api';
import {
  executeWorkSchedule,
  loadWorkSchedules,
  prepareWorkSchedule,
  unlinkWorkSchedule,
  workScheduleLookupRange,
} from './work-hub-scheduling';
import type { WorkHubItem } from './work-hub-contracts';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';

const linkId = '36e6e854-ec64-456c-8bcc-46a7d5ba97f2';
const item = {
  reference: { sourceSystem: 'PERSONAL_TASK', sourceReference: 'task-1' },
  lifecycle: 'OPEN',
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
  eventId: 'event-1',
  calendarId: 'calendar-1',
  type: 'FOCUS',
  status: 'CONFIRMED',
  detailLevel: 'FULL',
  capabilities: { canViewDetails: true },
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
    expect(await executeWorkSchedule(command, undefined, api)).toMatchObject({
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
    expect(item.dueAt).toBe('2026-09-05T09:00:00Z');
    expect(() => prepareWorkSchedule(item, { ...calendar, type: 'TEAM' }, input)).toThrow(
      'personal calendar'
    );
  });

  it('retries only the link save after the Calendar event is confirmed', async () => {
    const api = clients();
    api.putWorkCalendarLink.mockRejectedValueOnce(new Error('response lost'));
    const command = prepareWorkSchedule(item, calendar, input, linkId);
    const pending = await executeWorkSchedule(command, undefined, api);
    expect(pending).toMatchObject({ state: 'LINK_PENDING', command, event, sourceChanged: false });
    expect(await executeWorkSchedule(command, event, api)).toMatchObject({
      state: 'SCHEDULED',
      sourceChanged: false,
    });
    expect(api.createCalendarEvent).toHaveBeenCalledTimes(1);
    expect(api.putWorkCalendarLink.mock.calls).toEqual([
      [linkId, { work: item.reference, eventId: event.eventId }],
      [linkId, { work: item.reference, eventId: event.eventId }],
    ]);
  });

  it('retains the same Calendar idempotency key when the create outcome is unknown', async () => {
    const api = clients();
    api.createCalendarEvent.mockRejectedValueOnce(new Error('timeout'));
    const command = prepareWorkSchedule(item, calendar, input, linkId);
    expect(await executeWorkSchedule(command, undefined, api)).toMatchObject({
      state: 'CALENDAR_UNCONFIRMED',
      command,
    });
    await executeWorkSchedule(command, undefined, api);
    expect(api.createCalendarEvent.mock.calls.map(([request]) => request.idempotencyKey)).toEqual([
      linkId,
      linkId,
    ]);
  });

  it('never turns an inaccessible or out-of-range Calendar reference into deletion or task completion', async () => {
    const api = clients();
    api.getCalendarEvents.mockResolvedValueOnce([]);
    expect(await loadWorkSchedules(input.startsAt, input.endsAt, api)).toMatchObject({
      state: 'LOADED',
      items: [{ state: 'NOT_IN_RANGE_OR_UNAVAILABLE', event: null }],
    });
    api.getCalendarEvents.mockRejectedValueOnce(new Error('denied'));
    expect(await loadWorkSchedules(input.startsAt, input.endsAt, api)).toMatchObject({
      state: 'PARTIAL',
      items: [{ state: 'UNAVAILABLE', event: null }],
    });
    expect(await unlinkWorkSchedule(link, api)).toMatchObject({
      calendarChanged: false,
      sourceChanged: false,
      link: { state: 'REMOVED' },
    });
    expect(api.createCalendarEvent).not.toHaveBeenCalled();
  });
});
