import { describe, expect, it } from 'vitest';

import {
  filterWorkplaceUnifiedReservations,
  projectWorkplaceUnifiedReservations,
  selectWorkplaceUnifiedReservation,
} from './workplace-unified-reservations-model';

import type { CalendarEvent, WorkplaceBooking } from '@dwp-frontend/shared-utils';

const workplaceBooking = {
  bookingId: 'desk/1',
  resourceId: 'desk-1',
  resourceName: 'Desk 1',
  resourceType: 'DESK',
  siteName: 'Seoul',
  floorName: '12F',
  purpose: null,
  startsAt: '2026-09-17T01:00:00Z',
  endsAt: '2026-09-17T02:00:00Z',
  status: 'RESERVED',
  visibleToColleagues: false,
  checkedInAt: null,
  releasedAt: null,
  canCheckIn: true,
  canCancel: true,
  canRelease: false,
  checkInOpensAt: '2026-09-17T00:45:00Z',
  checkInClosesAt: '2026-09-17T01:15:00Z',
  version: 1,
} satisfies WorkplaceBooking;

const roomEvent = {
  eventId: 'event/1',
  calendarId: 'calendar-1',
  calendarName: 'Work',
  calendarColor: '#2457d6',
  organizerName: 'Owner',
  title: 'Planning',
  type: 'MEETING',
  startsAt: '2026-09-17T03:00:00Z',
  endsAt: '2026-09-17T04:00:00Z',
  timeZone: 'Asia/Seoul',
  allDay: false,
  status: 'CONFIRMED',
  visibility: 'DEFAULT',
  recurrence: 'NONE',
  recurrenceInterval: 1,
  responseRequired: true,
  attendees: [],
  resource: {
    resourceId: 'room-1',
    code: 'ROOM-1',
    name: 'Room 1',
    nameKo: '회의실 1',
    nameEn: 'Room 1',
    type: 'ROOM',
    site: 'Seoul',
    floor: '12F',
    capacity: 8,
    features: [],
    timeZone: 'Asia/Seoul',
    approvalRequired: false,
    state: 'AVAILABLE',
    available: true,
    version: 2,
  },
  conflict: false,
  version: 3,
  capabilities: {
    canViewDetails: true,
    canEdit: true,
    canDelete: true,
    canRestore: false,
    canRespond: true,
    canStar: true,
  },
} satisfies CalendarEvent;

describe('projectWorkplaceUnifiedReservations', () => {
  it('keeps both authorities distinct and sorts one shared timeline', () => {
    const result = projectWorkplaceUnifiedReservations({
      workplace: [workplaceBooking],
      calendar: [roomEvent],
      workplaceState: 'READY',
      calendarState: 'READY',
    });

    expect(result.partial).toBe(false);
    expect(result.items.map((item) => item.key)).toEqual(['WORKPLACE:desk/1', 'CALENDAR:event/1']);
    expect(result.items[0]).toMatchObject({ canCheckIn: true, canRespond: false });
    expect(result.items[1]).toMatchObject({ canCancel: true, canRespond: true });
  });

  it('preserves a healthy source when the other source is denied', () => {
    const result = projectWorkplaceUnifiedReservations({
      workplace: [workplaceBooking],
      calendar: [roomEvent],
      workplaceState: 'READY',
      calendarState: 'DENIED',
    });

    expect(result.partial).toBe(true);
    expect(result.items.map((item) => item.authority)).toEqual(['WORKPLACE']);
    expect(result.sources.calendar).toBe('DENIED');
  });

  it('retains stale data for reading and disables its writes', () => {
    const result = projectWorkplaceUnifiedReservations({
      workplace: [workplaceBooking],
      calendar: [roomEvent],
      workplaceState: 'STALE',
      calendarState: 'READY',
    });

    expect(result.partial).toBe(true);
    expect(result.items[0]).toMatchObject({
      authority: 'WORKPLACE',
      sourceState: 'STALE',
      canCheckIn: false,
      canCancel: false,
      canRelease: false,
    });
  });

  it('drops invalid time windows instead of inventing a display range', () => {
    const result = projectWorkplaceUnifiedReservations({
      workplace: [{ ...workplaceBooking, endsAt: workplaceBooking.startsAt }],
      calendar: [{ ...roomEvent, startsAt: 'not-an-instant' }],
      workplaceState: 'READY',
      calendarState: 'READY',
    });

    expect(result.items).toEqual([]);
  });

  it('filters by authority, resource family, state, and visible text without crossing sources', () => {
    const projected = projectWorkplaceUnifiedReservations({
      workplace: [workplaceBooking],
      calendar: [roomEvent],
      workplaceState: 'READY',
      calendarState: 'READY',
    });

    expect(
      filterWorkplaceUnifiedReservations(projected.items, {
        authority: 'WORKPLACE',
        type: 'DESK',
        status: 'ACTIVE',
        query: 'seoul',
      }).map((item) => item.key)
    ).toEqual(['WORKPLACE:desk/1']);
    expect(
      filterWorkplaceUnifiedReservations(projected.items, {
        authority: 'CALENDAR',
        type: 'MEETING',
        status: 'CONFIRMED',
        query: 'planning',
      }).map((item) => item.key)
    ).toEqual(['CALENDAR:event/1']);
  });

  it('opens the mobile inspector only for an explicit URL selection', () => {
    const items = projectWorkplaceUnifiedReservations({
      workplace: [workplaceBooking],
      calendar: [roomEvent],
      workplaceState: 'READY',
      calendarState: 'READY',
    }).items;

    expect(
      selectWorkplaceUnifiedReservation(
        items,
        { reservationId: null, reservationAuthority: null },
        false
      )
    ).toBeNull();
    expect(
      selectWorkplaceUnifiedReservation(
        items,
        { reservationId: null, reservationAuthority: null },
        true
      )?.key
    ).toBe('WORKPLACE:desk/1');
    expect(
      selectWorkplaceUnifiedReservation(
        items,
        { reservationId: roomEvent.eventId, reservationAuthority: 'CALENDAR' },
        false
      )?.key
    ).toBe('CALENDAR:event/1');
  });
});
