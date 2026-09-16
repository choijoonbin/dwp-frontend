import { describe, expect, it, vi } from 'vitest';

import type {
  CalendarEvent,
  CreateCalendarEventInput,
  PermissionDTO,
} from '@dwp-frontend/shared-utils';
import {
  createWorkCalendarEventHandoff,
  workCalendarEventHandoffDescription,
  type WorkCalendarLink,
} from '@dwp-frontend/shared-utils/api/work-hub-calendar-api';

import {
  authorizedWorkCalendarEventHandoff,
  authorizedWorkCalendarHandoffReturnTarget,
  calendarWorkHandoffRecoveryReceipt,
  clearCalendarWorkHandoffRecovery,
  hasWorkCalendarEventHandoff,
  isExactWorkHandoffEventReceipt,
  isCurrentWorkCalendarHandoffOwner,
  persistCalendarWorkHandoffRecovery,
  persistWorkCalendarHandoffLink,
  readCalendarWorkHandoffRecovery,
} from './calendar-work-handoff';

const ownerFingerprint = `sha256:${'a'.repeat(64)}`;
const now = new Date('2026-09-16T00:00:00.000Z');
const handoff = createWorkCalendarEventHandoff(
  {
    ownerFingerprint,
    work: { sourceSystem: 'PERSONAL_TASK', sourceReference: 'task-42' },
    sourceUrl: '/work/queue?work=PERSONAL_TASK%3Atask-42%3A',
    returnTo: '/work/queue?view=mine#task-42',
    title: 'Focus: quarterly report',
    startsAt: '2026-09-16T09:00:00+09:00',
    endsAt: '2026-09-16T09:30:00+09:00',
    timeZone: 'Asia/Seoul',
  },
  now
);
const state = { workCalendarEventHandoff: handoff };
const permissions: PermissionDTO[] = [
  { resourceType: 'APP', resourceKey: 'APP.WORK', permissionCode: 'VIEW', effect: 'ALLOW' },
  { resourceType: 'APP', resourceKey: 'APP.WORK', permissionCode: 'UPDATE', effect: 'ALLOW' },
];

const eventInput: CreateCalendarEventInput = {
  idempotencyKey: handoff.handoffId,
  calendarId: 'personal-calendar',
  title: handoff.title,
  description: workCalendarEventHandoffDescription(handoff),
  type: 'FOCUS',
  startsAt: handoff.startsAt,
  endsAt: handoff.endsAt,
  timeZone: handoff.timeZone,
  allDay: false,
  visibility: 'PRIVATE',
  recurrence: 'NONE',
  recurrenceInterval: 1,
  recurrenceUntil: null,
  responseRequired: false,
  attendees: [],
  resourceId: null,
};
const event = {
  ...eventInput,
  eventId: '95fdccda-1ba0-4c7d-9829-189db4da0b4d',
  calendarId: 'personal-calendar',
  calendarName: 'Personal',
  calendarColor: '#2563eb',
  organizerName: 'Current user',
  status: 'CONFIRMED',
  conflict: false,
  detailLevel: 'FULL',
  attendees: [],
  version: 0,
} as CalendarEvent;

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

describe('Calendar Work handoff boundary', () => {
  it('requires a fresh handoff bound to the exact current security owner', () => {
    expect(hasWorkCalendarEventHandoff(state)).toBe(true);
    expect(
      authorizedWorkCalendarEventHandoff(state, permissions, ownerFingerprint, now.getTime())
    ).toEqual(handoff);
    expect(
      authorizedWorkCalendarEventHandoff(
        state,
        permissions,
        `sha256:${'b'.repeat(64)}`,
        now.getTime()
      )
    ).toBeNull();
    expect(
      authorizedWorkCalendarEventHandoff(
        state,
        permissions,
        ownerFingerprint,
        Date.parse(handoff.expiresAt)
      )
    ).toBeNull();
    expect(
      authorizedWorkCalendarEventHandoff(
        state,
        permissions.slice(0, 1),
        ownerFingerprint,
        now.getTime()
      )
    ).toBeNull();
    expect(isCurrentWorkCalendarHandoffOwner(handoff, ownerFingerprint)).toBe(true);
    expect(isCurrentWorkCalendarHandoffOwner(handoff, `sha256:${'b'.repeat(64)}`)).toBe(false);
    expect(isCurrentWorkCalendarHandoffOwner(handoff, null)).toBe(false);
    expect(
      authorizedWorkCalendarHandoffReturnTarget(
        handoff,
        permissions,
        ownerFingerprint,
        now.getTime()
      )
    ).toEqual({
      path: handoff.returnTo,
      handoffId: handoff.handoffId,
      ownerFingerprint,
      expiresAt: handoff.expiresAt,
    });
  });

  it('accepts only an exact private focus event receipt before linking with the same identity', async () => {
    expect(isExactWorkHandoffEventReceipt(event, eventInput)).toBe(true);
    expect(isExactWorkHandoffEventReceipt({ ...event, visibility: 'PUBLIC' }, eventInput)).toBe(
      false
    );
    expect(
      isExactWorkHandoffEventReceipt(
        { ...event, location: 'Meeting room attached by server' },
        eventInput
      )
    ).toBe(false);
    expect(
      isExactWorkHandoffEventReceipt(
        { ...event, conferenceUrl: 'https://meet.example.invalid/unreviewed' },
        eventInput
      )
    ).toBe(false);
    expect(
      isExactWorkHandoffEventReceipt(
        {
          ...event,
          resource: {
            resourceId: 'resource-room-1',
            code: 'ROOM-1',
            name: 'Unreviewed room',
            nameKo: '검토하지 않은 회의실',
            nameEn: 'Unreviewed room',
            type: 'ROOM',
            site: 'Seoul HQ',
            capacity: 4,
            features: [],
            timeZone: 'Asia/Seoul',
            approvalRequired: false,
            state: 'AVAILABLE',
            available: true,
            version: 0,
          },
        },
        eventInput
      )
    ).toBe(false);

    const receipt = {
      linkId: handoff.handoffId,
      work: handoff.work,
      eventId: event.eventId,
      state: 'LINKED',
      version: 0,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      calendarAvailability: 'REFERENCE_ONLY',
    } satisfies WorkCalendarLink;
    const putLink = vi.fn().mockResolvedValue(receipt);

    await expect(
      persistWorkCalendarHandoffLink(handoff, event, handoff.handoffId, putLink)
    ).resolves.toEqual(receipt);
    expect(putLink).toHaveBeenCalledWith(handoff.handoffId, {
      work: handoff.work,
      eventId: event.eventId,
    });
    await expect(
      persistWorkCalendarHandoffLink(handoff, event, handoff.handoffId, async () => ({
        ...receipt,
        eventId: crypto.randomUUID(),
      }))
    ).rejects.toThrow('did not match');
  });

  it('rehydrates only the exact owner-authorized receipt and destroys invalid persisted state', () => {
    const sessionStorage = memoryStorage();
    vi.stubGlobal('window', { sessionStorage });
    try {
      expect(persistCalendarWorkHandoffRecovery(handoff, event, eventInput, now.getTime())).toBe(
        true
      );
      expect(
        readCalendarWorkHandoffRecovery(permissions, ownerFingerprint, true, now.getTime())
      ).toEqual({ handoff, event, input: eventInput, linkId: handoff.handoffId });

      // A transient empty permission snapshot does not erase a valid receipt during bootstrap.
      expect(
        readCalendarWorkHandoffRecovery([], ownerFingerprint, false, now.getTime())
      ).toBeNull();
      expect(sessionStorage.length).toBe(1);

      // Once the empty snapshot is authoritative, revocation destroys the dormant receipt.
      expect(readCalendarWorkHandoffRecovery([], ownerFingerprint, true, now.getTime())).toBeNull();
      expect(sessionStorage.length).toBe(0);

      expect(persistCalendarWorkHandoffRecovery(handoff, event, eventInput, now.getTime())).toBe(
        true
      );

      // A settled logged-out/session-loss state has no owner and destroys the old receipt.
      expect(readCalendarWorkHandoffRecovery(permissions, null, true, now.getTime())).toBeNull();
      expect(sessionStorage.length).toBe(0);

      expect(persistCalendarWorkHandoffRecovery(handoff, event, eventInput, now.getTime())).toBe(
        true
      );

      // A definitive owner mismatch destroys the previous owner's opaque receipt.
      expect(
        readCalendarWorkHandoffRecovery(
          permissions,
          `sha256:${'b'.repeat(64)}`,
          true,
          now.getTime()
        )
      ).toBeNull();
      expect(sessionStorage.length).toBe(0);

      expect(persistCalendarWorkHandoffRecovery(handoff, event, eventInput, now.getTime())).toBe(
        true
      );
      expect(
        readCalendarWorkHandoffRecovery(
          permissions.slice(0, 1),
          ownerFingerprint,
          true,
          now.getTime()
        )
      ).toBeNull();
      expect(sessionStorage.length).toBe(0);

      expect(persistCalendarWorkHandoffRecovery(handoff, event, eventInput, now.getTime())).toBe(
        true
      );
      const key = sessionStorage.key(0)!;
      const persisted = JSON.parse(sessionStorage.getItem(key)!) as {
        event: CalendarEvent;
      };
      sessionStorage.setItem(
        key,
        JSON.stringify({ ...persisted, event: { ...persisted.event, title: 'tampered title' } })
      );
      expect(
        readCalendarWorkHandoffRecovery(permissions, ownerFingerprint, true, now.getTime())
      ).toBeNull();
      expect(sessionStorage.length).toBe(0);
    } finally {
      clearCalendarWorkHandoffRecovery();
      vi.unstubAllGlobals();
    }
  });

  it('builds a PUT-only retry receipt only for the exact handoff and link identity', () => {
    const recovery = { handoff, event, input: eventInput, linkId: handoff.handoffId };

    expect(calendarWorkHandoffRecoveryReceipt(handoff, recovery)).toEqual({
      handoffId: handoff.handoffId,
      intent: { key: handoff.handoffId, fingerprint: `recovery:${handoff.handoffId}` },
      event,
    });
    expect(calendarWorkHandoffRecoveryReceipt(null, recovery)).toBeNull();
    expect(
      calendarWorkHandoffRecoveryReceipt(
        { ...handoff, handoffId: 'd3b91953-1e88-4b15-9b80-b903c2b3189f' },
        recovery
      )
    ).toBeNull();
    expect(
      calendarWorkHandoffRecoveryReceipt(handoff, {
        ...recovery,
        linkId: '1c0917bb-309c-4ad6-864a-b520a3f4723f',
      })
    ).toBeNull();
  });

  it('rehydrates an edited exact POST receipt and rejects a tampered persisted input', () => {
    const sessionStorage = memoryStorage();
    vi.stubGlobal('window', { sessionStorage });
    const editedInput: CreateCalendarEventInput = {
      ...eventInput,
      title: 'Edited focus block',
      startsAt: '2026-09-16T10:00:00.000Z',
      endsAt: '2026-09-16T11:00:00.000Z',
      timeZone: 'UTC',
      importance: 'HIGH',
    };
    const editedEvent: CalendarEvent = {
      ...event,
      title: editedInput.title,
      startsAt: editedInput.startsAt,
      endsAt: editedInput.endsAt,
      timeZone: editedInput.timeZone,
      importance: editedInput.importance,
    };
    try {
      expect(
        persistCalendarWorkHandoffRecovery(handoff, editedEvent, editedInput, now.getTime())
      ).toBe(true);
      expect(
        readCalendarWorkHandoffRecovery(permissions, ownerFingerprint, true, now.getTime())
      ).toEqual({ handoff, event: editedEvent, input: editedInput, linkId: handoff.handoffId });

      const key = sessionStorage.key(0)!;
      const persisted = JSON.parse(sessionStorage.getItem(key)!) as {
        input: CreateCalendarEventInput;
      };
      sessionStorage.setItem(
        key,
        JSON.stringify({
          ...persisted,
          input: { ...persisted.input, title: 'tampered after receipt' },
        })
      );
      expect(
        readCalendarWorkHandoffRecovery(permissions, ownerFingerprint, true, now.getTime())
      ).toBeNull();
      expect(sessionStorage.length).toBe(0);
    } finally {
      clearCalendarWorkHandoffRecovery();
      vi.unstubAllGlobals();
    }
  });
});
