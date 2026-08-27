import { describe, expect, it } from 'vitest';

import {
  buildWorkplaceHomeModel,
  workplaceAgenda,
  workplaceAttention,
  workplaceAvailability,
  workplaceDiscoveryTarget,
  workplaceHomeQueryRange,
  workplaceWeek,
} from './workplace-home-model';

import type {
  CalendarEvent,
  CalendarHome,
  CalendarPolicy,
  WorkplaceBooking,
  WorkplaceExploreResponse,
  WorkplacePolicy,
  WorkplaceResource,
} from '@dwp-frontend/shared-utils';
import type { WorkplaceBookabilityContext } from './workplace-discovery-model';

const NOW = '2026-08-19T00:00:00Z';

const WORKPLACE_POLICY: WorkplacePolicy = {
  bookingWindowDays: 30,
  maximumActiveBookings: 10,
  minimumBookingMinutes: 30,
  maximumBookingMinutes: 480,
  maximumConsecutiveDays: 5,
  workingDayStart: '08:00:00',
  workingDayEnd: '20:00:00',
  allowRecurring: false,
  requireCheckIn: true,
  checkInLeadMinutes: 30,
  autoReleaseMinutes: 15,
  allowAssignedDeskLending: false,
  showColleagueNames: false,
  bookingRetentionDays: 365,
  version: 1,
};

const ROOM_POLICY: CalendarPolicy = {
  weekStart: 1,
  workingDayStart: '08:00:00',
  workingDayEnd: '20:00:00',
  defaultEventMinutes: 30,
  minimumEventMinutes: 30,
  maximumEventMinutes: 240,
  maximumAdvanceDays: 30,
  defaultBufferMinutes: 0,
  weeklyFocusTargetMinutes: 240,
  dailyMeetingLimitMinutes: 360,
  enforceMeetingAgenda: false,
  allowExternalAttendees: true,
  version: 1,
};

function bookability(
  overrides: Partial<WorkplaceBookabilityContext> = {}
): WorkplaceBookabilityContext {
  return {
    canCreateRoomBooking: true,
    canCreateWorkplaceBooking: true,
    occupancy: [],
    rangeFrom: NOW,
    rangeTo: '2026-08-19T01:00:00Z',
    roomPolicy: ROOM_POLICY,
    roomPolicyReady: true,
    serverNow: NOW,
    timeZone: 'Asia/Seoul',
    verified: true,
    workplacePolicy: WORKPLACE_POLICY,
    ...overrides,
  };
}

function resource(overrides: Partial<WorkplaceResource> = {}): WorkplaceResource {
  return {
    resourceId: 'desk-1',
    floorId: 'floor-1',
    siteId: 'site-1',
    calendarResourceId: null,
    code: 'D-1',
    name: 'Focus desk',
    nameKo: '집중 좌석',
    nameEn: 'Focus desk',
    type: 'DESK',
    mode: 'RESERVABLE',
    state: 'AVAILABLE',
    neighborhood: null,
    capacity: 1,
    features: [],
    accessible: true,
    approvalRequired: false,
    positionX: 0,
    positionY: 0,
    widthPercent: 10,
    heightPercent: 10,
    rotationDegrees: 0,
    assignedToCurrentUser: false,
    assignedUserId: null,
    assignedPersonPublicId: null,
    assignedDisplayName: null,
    version: 1,
    ...overrides,
  };
}

function explore(resources: WorkplaceResource[]): WorkplaceExploreResponse {
  return {
    sites: [
      {
        siteId: 'site-1',
        campusId: null,
        code: 'SEOUL',
        name: 'Seoul HQ',
        nameKo: '서울 본사',
        nameEn: 'Seoul HQ',
        type: 'HEADQUARTERS',
        address: null,
        timeZone: 'Asia/Seoul',
        totalFloorCount: 12,
        configuredFloorCount: 1,
        resourceCount: resources.length,
        state: 'ACTIVE',
        version: 1,
      },
    ],
    floors: [],
    selectedFloor: {
      floorId: 'floor-1',
      siteId: 'site-1',
      siteName: 'Seoul HQ',
      floorNumber: 6,
      name: '6F',
      nameKo: '6층',
      nameEn: '6F',
      planWidth: 1200,
      planHeight: 760,
      backgroundAssetPath: null,
      state: 'ACTIVE',
      resourceCount: resources.length,
      version: 1,
    },
    resources,
    occupancy: [
      {
        resourceId: 'occupied',
        bookingId: 'booking-occupied',
        status: 'RESERVED',
        startsAt: NOW,
        endsAt: '2026-08-19T01:00:00Z',
        bookedByDisplayName: null,
        currentUser: false,
      },
    ],
    policy: WORKPLACE_POLICY,
    generatedAt: NOW,
  };
}

function booking(overrides: Partial<WorkplaceBooking> = {}): WorkplaceBooking {
  return {
    bookingId: 'booking-1',
    resourceId: 'desk-1',
    resourceName: 'Focus desk',
    resourceType: 'DESK',
    siteName: 'Seoul HQ',
    floorName: '6F',
    purpose: null,
    startsAt: '2026-08-19T00:30:00Z',
    endsAt: '2026-08-19T01:30:00Z',
    status: 'RESERVED',
    visibleToColleagues: false,
    checkedInAt: null,
    releasedAt: null,
    canCheckIn: false,
    canCancel: true,
    canRelease: false,
    checkInOpensAt: NOW,
    checkInClosesAt: '2026-08-19T01:00:00Z',
    version: 1,
    ...overrides,
  };
}

function calendarEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    eventId: 'event-1',
    calendarId: 'calendar-1',
    calendarName: 'Work',
    calendarColor: '#2563eb',
    organizerName: 'Owner',
    title: 'Planning session',
    type: 'MEETING',
    startsAt: '2026-08-19T02:00:00Z',
    endsAt: '2026-08-19T03:00:00Z',
    timeZone: 'Asia/Seoul',
    allDay: false,
    location: null,
    conferenceUrl: null,
    status: 'CONFIRMED',
    visibility: 'DEFAULT',
    recurrence: 'NONE',
    recurrenceInterval: 1,
    responseRequired: false,
    myResponse: 'ACCEPTED',
    attendees: [],
    resource: null,
    conflict: false,
    detailLevel: 'FULL',
    redacted: false,
    capabilities: {
      canViewDetails: true,
      canEdit: true,
      canDelete: true,
      canRestore: false,
      canRespond: false,
      canStar: true,
    },
    version: 1,
    ...overrides,
  };
}

function calendar(today: CalendarEvent[]): CalendarHome {
  return {
    date: '2026-08-19',
    timeZone: 'Asia/Seoul',
    nextEvent: today[0] ?? null,
    today,
    metrics: {
      eventCount: today.length,
      meetingMinutes: 60,
      focusMinutes: 90,
      focusTargetMinutes: 240,
      conflictCount: 0,
      awaitingResponseCount: 0,
      availableRoomCount: 2,
    },
    weekLoad: [
      {
        date: '2026-08-19',
        meetingMinutes: 60,
        focusMinutes: 90,
        eventCount: 2,
        conflictCount: 0,
        loadPercent: 42,
      },
    ],
    attention: [],
    generatedAt: NOW,
  };
}

describe('workplace home model', () => {
  it('queries the full local workweek from the next canonical minute', () => {
    const range = workplaceHomeQueryRange(new Date(NOW), 'Asia/Seoul');

    expect(range).toEqual({
      availabilityFrom: '2026-08-19T00:01:00Z',
      availabilityTo: '2026-08-19T01:01:00Z',
      bookingsFrom: '2026-08-16T15:00:00Z',
      bookingsTo: '2026-08-23T15:00:00Z',
    });

    expect(
      workplaceHomeQueryRange(new Date('2026-08-19T00:00:38.500Z'), 'Asia/Seoul')
    ).toMatchObject({
      availabilityFrom: '2026-08-19T00:01:00Z',
      availabilityTo: '2026-08-19T01:01:00Z',
    });
  });

  it('counts only immediately usable resources in the selected floor scope', () => {
    const availability = workplaceAvailability(
      explore([
        resource(),
        resource({ resourceId: 'occupied' }),
        resource({ resourceId: 'approval', approvalRequired: true }),
        resource({ resourceId: 'assigned-other', mode: 'ASSIGNED' }),
        resource({ resourceId: 'assigned-mine', mode: 'ASSIGNED', assignedToCurrentUser: true }),
        resource({ resourceId: 'unmapped-room', type: 'ROOM' }),
      ]),
      bookability()
    );

    expect(availability).toEqual([
      { type: 'DESK', total: 5, available: 4, bookable: 3, accessible: 3 },
      { type: 'ROOM', total: 1, available: 1, bookable: 0, accessible: 0 },
    ]);
  });

  it('deduplicates Calendar-backed room bookings while preserving workspace reservations', () => {
    const event = calendarEvent();
    const agenda = workplaceAgenda({
      bookings: [booking()],
      roomBookings: [event],
      calendar: calendar([event]),
      now: NOW,
      timeZone: 'Asia/Seoul',
    });

    expect(agenda.map((item) => item.key)).toEqual([
      'workplace:booking-1',
      `calendar:${event.eventId}:${event.startsAt}`,
    ]);
    expect(agenda[1]?.path).toBe('/calendar/schedule?event=event-1');
  });

  it('prioritizes a direct check-in and merges verified week context', () => {
    const checkIn = booking({ canCheckIn: true });
    const model = buildWorkplaceHomeModel({
      explore: explore([resource()]),
      bookings: [checkIn],
      roomBookings: [],
      calendar: calendar([]),
      bookability: bookability(),
      now: NOW,
      timeZone: 'Asia/Seoul',
    });

    expect(model.nextAction.kind).toBe('CHECK_IN');
    expect(model.week.find((day) => day.date === '2026-08-19')).toMatchObject({
      current: true,
      reservationCount: 1,
      meetingMinutes: 60,
      focusMinutes: 90,
      loadPercent: 42,
    });
    expect(model.verifiedAt).toBe(NOW);
  });

  it('surfaces an explicit no-site action instead of linking members to an empty search', () => {
    const response = explore([]);
    const model = buildWorkplaceHomeModel({
      explore: { ...response, sites: [], selectedFloor: null },
      bookings: [],
      roomBookings: [],
      calendar: calendar([]),
      bookability: bookability(),
      now: NOW,
      timeZone: 'Asia/Seoul',
    });

    expect(model.nextAction.kind).toBe('NO_SITE');
    expect(model.scopeState).toBe('NO_SITE');
  });

  it('separates a missing floor and an empty configured floor from a missing site', () => {
    const response = explore([]);
    const noFloor = buildWorkplaceHomeModel({
      explore: { ...response, selectedFloor: null, floors: [] },
      bookings: [],
      roomBookings: [],
      bookability: bookability(),
      now: NOW,
      timeZone: 'Asia/Seoul',
    });
    const noResource = buildWorkplaceHomeModel({
      explore: response,
      bookings: [],
      roomBookings: [],
      bookability: bookability(),
      now: NOW,
      timeZone: 'Asia/Seoul',
    });

    expect(noFloor.nextAction.kind).toBe('NO_FLOOR');
    expect(noResource.nextAction.kind).toBe('NO_RESOURCE');
  });

  it('separates physical openings from booking eligibility for read-only members', () => {
    const model = buildWorkplaceHomeModel({
      explore: explore([resource()]),
      bookings: [],
      roomBookings: [],
      calendar: calendar([]),
      bookability: bookability({
        canCreateRoomBooking: false,
        canCreateWorkplaceBooking: false,
      }),
      now: NOW,
      timeZone: 'Asia/Seoul',
    });

    expect(model.availableCount).toBe(1);
    expect(model.bookableCount).toBe(0);
    expect(model.nextAction.kind).toBe('BROWSE_SPACE');
  });

  it('keeps mapped rooms physically open but closes booking when room policy is unverified', () => {
    const availability = workplaceAvailability(
      explore([
        resource({
          resourceId: 'room-1',
          type: 'ROOM',
          calendarResourceId: 'calendar-room-1',
        }),
      ]),
      bookability({ roomPolicyReady: false })
    );

    expect(availability).toEqual([
      { type: 'ROOM', total: 1, available: 1, bookable: 0, accessible: 0 },
    ]);
  });

  it('preserves site, floor, time range, duration, and type in discovery handoff', () => {
    expect(
      workplaceDiscoveryTarget({
        explore: explore([resource()]),
        rangeFrom: NOW,
        rangeTo: '2026-08-19T01:00:00Z',
        timeZone: 'Asia/Seoul',
        type: 'DESK',
      })
    ).toBe(
      '/workplace/explore?site=site-1&floor=floor-1&date=2026-08-19&time=09%3A00&duration=60&type=DESK'
    );
  });

  it('removes an expired booking range from discovery handoff', () => {
    const model = buildWorkplaceHomeModel({
      explore: explore([resource()]),
      bookings: [],
      roomBookings: [],
      calendar: calendar([]),
      bookability: bookability({ serverNow: '2026-08-19T00:00:00.500Z' }),
      now: '2026-08-19T00:00:00.500Z',
      timeZone: 'Asia/Seoul',
    });

    expect(model.bookableCount).toBe(0);
    expect(model.nextAction.kind).toBe('BROWSE_SPACE');
    expect(model.nextAction.path).toBe('/workplace/explore?site=site-1&floor=floor-1&type=DESK');
  });

  it('closes check-in decisions immediately after the window ends', () => {
    const closed = booking({
      canCheckIn: true,
      checkInOpensAt: '2026-08-18T23:30:00Z',
      checkInClosesAt: NOW,
    });
    const model = buildWorkplaceHomeModel({
      explore: explore([]),
      bookings: [closed],
      roomBookings: [],
      calendar: calendar([]),
      bookability: bookability(),
      now: '2026-08-19T00:00:00.001Z',
      timeZone: 'Asia/Seoul',
    });

    expect(model.nextAction.kind).not.toBe('CHECK_IN');
    expect(model.attention.some((item) => item.kind === 'CHECK_IN')).toBe(false);
  });

  it('closes cached check-in and release decisions when the reservation ends', () => {
    const endedCheckIn = booking({
      bookingId: 'ended-check-in',
      canCheckIn: true,
      startsAt: '2026-08-18T23:45:00Z',
      endsAt: NOW,
      checkInOpensAt: '2026-08-18T23:30:00Z',
      checkInClosesAt: '2026-08-19T00:10:00Z',
    });
    const endedRelease = booking({
      bookingId: 'ended-release',
      canRelease: true,
      startsAt: '2026-08-18T23:30:00Z',
      endsAt: NOW,
    });
    const model = buildWorkplaceHomeModel({
      explore: explore([]),
      bookings: [endedCheckIn, endedRelease],
      roomBookings: [],
      calendar: calendar([]),
      bookability: bookability(),
      now: '2026-08-19T00:00:00.001Z',
      timeZone: 'Asia/Seoul',
    });

    expect(model.nextAction.kind).not.toBe('CHECK_IN');
    expect(model.attention.some((item) => item.kind === 'CHECK_IN')).toBe(false);
    expect(model.attention.some((item) => item.kind === 'RELEASE')).toBe(false);
  });

  it('does not request a room for online or hybrid meetings', () => {
    const online = calendarEvent({ eventId: 'online', conferenceUrl: 'https://meet.example/1' });
    const inPerson = calendarEvent({ eventId: 'in-person' });
    const hybrid = calendarEvent({
      eventId: 'hybrid',
      conferenceUrl: 'https://meet.example/2',
      location: 'Seoul HQ',
    });
    const attention = workplaceAttention({
      calendar: calendar([online, inPerson, hybrid]),
      now: NOW,
    });

    expect(attention.filter((item) => item.kind === 'ROOM_NEEDED').map((item) => item.key)).toEqual(
      ['room-needed:in-person']
    );
  });

  it('only requests rooms for actionable full-detail meetings', () => {
    const eligible = calendarEvent({ eventId: 'eligible' });
    const freeBusy = calendarEvent({
      eventId: 'free-busy',
      title: 'Busy',
      detailLevel: 'FREE_BUSY',
      redacted: true,
      capabilities: {
        canViewDetails: false,
        canEdit: false,
        canDelete: false,
        canRestore: false,
        canRespond: false,
        canStar: false,
      },
    });
    const readOnly = calendarEvent({
      eventId: 'read-only',
      capabilities: { ...eligible.capabilities!, canEdit: false },
    });
    const declined = calendarEvent({ eventId: 'declined', myResponse: 'DECLINED' });
    const allDay = calendarEvent({ eventId: 'all-day', allDay: true });
    const ongoing = calendarEvent({
      eventId: 'ongoing',
      startsAt: '2026-08-18T23:45:00Z',
      endsAt: '2026-08-19T00:15:00Z',
    });
    const startingNow = calendarEvent({
      eventId: 'starting-now',
      startsAt: NOW,
      endsAt: '2026-08-19T01:00:00Z',
    });
    const ended = calendarEvent({
      eventId: 'ended',
      startsAt: '2026-08-18T23:00:00Z',
      endsAt: '2026-08-18T23:30:00Z',
    });

    const attention = workplaceAttention({
      calendar: calendar([
        freeBusy,
        readOnly,
        declined,
        allDay,
        ongoing,
        startingNow,
        ended,
        eligible,
      ]),
      now: NOW,
    });

    expect(attention.filter((item) => item.kind === 'ROOM_NEEDED').map((item) => item.key)).toEqual(
      ['room-needed:eligible']
    );
  });

  it('does not count cancelled reservations in the weekly rhythm', () => {
    const week = workplaceWeek({
      bookings: [booking({ status: 'CANCELLED' })],
      roomBookings: [calendarEvent({ status: 'CANCELLED' })],
      now: NOW,
      timeZone: 'Asia/Seoul',
    });

    expect(week.find((day) => day.current)?.reservationCount).toBe(0);
  });

  it('sorts attention by severity and deadline before applying the five-item limit', () => {
    const lowPriority = Array.from({ length: 5 }, (_, index) =>
      booking({
        bookingId: `release-${index}`,
        canRelease: true,
        startsAt: '2026-08-18T23:30:00Z',
        endsAt: `2026-08-19T${String(index + 10).padStart(2, '0')}:00:00Z`,
      })
    );
    const urgent = booking({
      bookingId: 'urgent-check-in',
      canCheckIn: true,
      checkInClosesAt: '2026-08-19T00:10:00Z',
    });

    const attention = workplaceAttention({ bookings: [...lowPriority, urgent], now: NOW });

    expect(attention).toHaveLength(5);
    expect(attention[0]).toMatchObject({ kind: 'CHECK_IN', key: 'check-in:urgent-check-in' });
  });
});
