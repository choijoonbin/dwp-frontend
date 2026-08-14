import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type CalendarType = 'PERSONAL' | 'TEAM' | 'RESOURCE' | 'SYSTEM';
export type CalendarEventType = 'MEETING' | 'FOCUS' | 'TASK' | 'OUT_OF_OFFICE' | 'REMINDER';
export type CalendarEventStatus = 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';
export type CalendarVisibility = 'DEFAULT' | 'PUBLIC' | 'PRIVATE' | 'CONFIDENTIAL';
export type CalendarRecurrence = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type CalendarResponseStatus = 'NEEDS_ACTION' | 'ACCEPTED' | 'TENTATIVE' | 'DECLINED';
export type CalendarAttendeeType = 'REQUIRED' | 'OPTIONAL' | 'RESOURCE';
export type CalendarResourceType = 'ROOM' | 'DESK' | 'EQUIPMENT';
export type CalendarResourceState = 'AVAILABLE' | 'MAINTENANCE' | 'RETIRED';

export type CalendarSummary = {
  calendarId: string;
  calendarKey: string;
  name: string;
  color: string;
  type: CalendarType;
  visibility: string;
  selected: boolean;
};

export type CalendarAttendee = {
  userId?: number | null;
  personPublicId?: string | null;
  email: string;
  name: string;
  type: CalendarAttendeeType;
  response: CalendarResponseStatus;
};

export type CalendarResource = {
  resourceId: string;
  code: string;
  name: string;
  nameKo: string;
  nameEn: string;
  type: CalendarResourceType;
  site: string;
  floor?: string | null;
  capacity: number;
  features: string[];
  timeZone: string;
  approvalRequired: boolean;
  state: CalendarResourceState;
  available: boolean;
  version: number;
};

export type CalendarEvent = {
  eventId: string;
  calendarId: string;
  calendarName: string;
  calendarColor: string;
  organizerUserId?: number | null;
  organizerPersonPublicId?: string | null;
  organizerName: string;
  organizerEmail?: string | null;
  title: string;
  description?: string | null;
  type: CalendarEventType;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  allDay: boolean;
  location?: string | null;
  conferenceUrl?: string | null;
  status: CalendarEventStatus;
  visibility: CalendarVisibility;
  recurrence: CalendarRecurrence;
  recurrenceInterval: number;
  recurrenceUntil?: string | null;
  responseRequired: boolean;
  myResponse?: CalendarResponseStatus | null;
  attendees: CalendarAttendee[];
  resource?: CalendarResource | null;
  conflict: boolean;
  version: number;
};

export type CalendarDayLoad = {
  date: string;
  meetingMinutes: number;
  focusMinutes: number;
  eventCount: number;
  conflictCount: number;
  loadPercent: number;
};

export type CalendarAttentionItem = {
  key: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  title: string;
  description: string;
  eventId?: string | null;
  actionPath: string;
};

export type CalendarHome = {
  date: string;
  timeZone: string;
  nextEvent?: CalendarEvent | null;
  today: CalendarEvent[];
  metrics: {
    eventCount: number;
    meetingMinutes: number;
    focusMinutes: number;
    focusTargetMinutes: number;
    conflictCount: number;
    awaitingResponseCount: number;
    availableRoomCount: number;
  };
  weekLoad: CalendarDayLoad[];
  attention: CalendarAttentionItem[];
  generatedAt: string;
};

export type CalendarPolicy = {
  weekStart: number;
  workingDayStart: string;
  workingDayEnd: string;
  defaultEventMinutes: number;
  minimumEventMinutes: number;
  maximumEventMinutes: number;
  maximumAdvanceDays: number;
  defaultBufferMinutes: number;
  weeklyFocusTargetMinutes: number;
  dailyMeetingLimitMinutes: number;
  enforceMeetingAgenda: boolean;
  allowExternalAttendees: boolean;
  version: number;
};

export type CalendarAdminOverview = {
  activeResources: number;
  resourcesInMaintenance: number;
  bookingsThisWeek: number;
  pendingBookings: number;
  eventsThisWeek: number;
  conflictedUsers: number;
  policy: CalendarPolicy;
  resources: CalendarResource[];
  generatedAt: string;
};

export type CalendarAvailabilityParticipant = {
  personPublicId: string;
  busyMinutes: number;
  availableSlotCount: number;
};

export type CalendarAvailabilitySlot = {
  startsAt: string;
  endsAt: string;
  score: number;
  reason: string;
};

export type CalendarAvailability = {
  participants: CalendarAvailabilityParticipant[];
  suggestions: CalendarAvailabilitySlot[];
  generatedAt: string;
};

export type CalendarBooking = {
  bookingId: string;
  eventId: string;
  resourceId: string;
  resourceName: string;
  eventTitle: string;
  startsAt: string;
  endsAt: string;
  organizerName: string;
  organizerEmail?: string | null;
  status: 'PENDING' | 'CONFIRMED' | 'DECLINED' | 'CANCELLED';
  requestedBy: number;
  decisionNote?: string | null;
  decidedAt?: string | null;
  decidedBy?: number | null;
  version: number;
};

export type CalendarAttendeeInput = {
  userId?: number | null;
  personPublicId?: string | null;
  email: string;
  name: string;
  type: CalendarAttendeeType;
};

export type CreateCalendarEventInput = {
  title: string;
  description?: string | null;
  type: CalendarEventType;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  allDay: boolean;
  location?: string | null;
  conferenceUrl?: string | null;
  visibility: CalendarVisibility;
  recurrence: CalendarRecurrence;
  recurrenceInterval: number;
  recurrenceUntil?: string | null;
  responseRequired: boolean;
  attendees: CalendarAttendeeInput[];
  resourceId?: string | null;
  idempotencyKey: string;
};

export type UpdateCalendarEventInput = Omit<CreateCalendarEventInput, 'idempotencyKey'> & {
  version: number;
};

function rangeQuery(from: string, to: string) {
  return `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
}

export async function getCalendarHome(timeZone = 'Asia/Seoul'): Promise<CalendarHome> {
  const response = await axiosInstance.get<ApiResponse<CalendarHome>>(
    `/api/platform/v1/calendar/home?timeZone=${encodeURIComponent(timeZone)}`
  );
  return response.data.data;
}

export async function getCalendars(): Promise<CalendarSummary[]> {
  const response = await axiosInstance.get<ApiResponse<CalendarSummary[]>>(
    '/api/platform/v1/calendar/calendars'
  );
  return response.data.data;
}

export async function getCalendarEvents(from: string, to: string): Promise<CalendarEvent[]> {
  const response = await axiosInstance.get<ApiResponse<CalendarEvent[]>>(
    `/api/platform/v1/calendar/events?${rangeQuery(from, to)}`
  );
  return response.data.data;
}

export async function createCalendarEvent(input: CreateCalendarEventInput): Promise<CalendarEvent> {
  const response = await axiosInstance.post<ApiResponse<CalendarEvent>, CreateCalendarEventInput>(
    '/api/platform/v1/calendar/events',
    input
  );
  return response.data.data;
}

export async function updateCalendarEvent(
  eventId: string,
  input: UpdateCalendarEventInput
): Promise<CalendarEvent> {
  const response = await axiosInstance.put<ApiResponse<CalendarEvent>, UpdateCalendarEventInput>(
    `/api/platform/v1/calendar/events/${encodeURIComponent(eventId)}`,
    input
  );
  return response.data.data;
}

export async function respondToCalendarEvent(
  eventId: string,
  responseStatus: Exclude<CalendarResponseStatus, 'NEEDS_ACTION'>
): Promise<CalendarEvent> {
  const response = await axiosInstance.post<
    ApiResponse<CalendarEvent>,
    { response: Exclude<CalendarResponseStatus, 'NEEDS_ACTION'> }
  >(`/api/platform/v1/calendar/events/${encodeURIComponent(eventId)}/response`, {
    response: responseStatus,
  });
  return response.data.data;
}

export async function cancelCalendarEvent(eventId: string, version: number): Promise<void> {
  await axiosInstance.post<ApiResponse<void>, { version: number }>(
    `/api/platform/v1/calendar/events/${encodeURIComponent(eventId)}/cancel`,
    { version }
  );
}

export async function getCalendarResources(from: string, to: string): Promise<CalendarResource[]> {
  const response = await axiosInstance.get<ApiResponse<CalendarResource[]>>(
    `/api/platform/v1/calendar/resources?${rangeQuery(from, to)}`
  );
  return response.data.data;
}

export async function getCalendarAvailability(
  personIds: string[],
  from: string,
  to: string,
  durationMinutes: number,
  timeZone = 'Asia/Seoul'
): Promise<CalendarAvailability> {
  const search = new URLSearchParams({
    from,
    to,
    durationMinutes: String(durationMinutes),
    timeZone,
  });
  personIds.forEach((personId) => search.append('personIds', personId));
  const response = await axiosInstance.get<ApiResponse<CalendarAvailability>>(
    `/api/platform/v1/calendar/availability?${search.toString()}`
  );
  return response.data.data;
}

export async function getCalendarAdminOverview(): Promise<CalendarAdminOverview> {
  const response = await axiosInstance.get<ApiResponse<CalendarAdminOverview>>(
    '/api/platform/v1/admin/calendar/overview'
  );
  return response.data.data;
}

export async function getPendingCalendarBookings(): Promise<CalendarBooking[]> {
  const response = await axiosInstance.get<ApiResponse<CalendarBooking[]>>(
    '/api/platform/v1/admin/calendar/bookings/pending'
  );
  return response.data.data;
}

export async function decideCalendarBooking(
  bookingId: string,
  decision: 'APPROVE' | 'DECLINE',
  note: string,
  version: number
): Promise<CalendarBooking> {
  const response = await axiosInstance.post<
    ApiResponse<CalendarBooking>,
    { decision: 'APPROVE' | 'DECLINE'; note: string; version: number }
  >(`/api/platform/v1/admin/calendar/bookings/${encodeURIComponent(bookingId)}/decision`, {
    decision,
    note,
    version,
  });
  return response.data.data;
}

export async function updateCalendarPolicy(input: CalendarPolicy): Promise<CalendarPolicy> {
  const response = await axiosInstance.put<ApiResponse<CalendarPolicy>, CalendarPolicy>(
    '/api/platform/v1/admin/calendar/policy',
    input
  );
  return response.data.data;
}

export type CalendarResourceInput = {
  code: string;
  nameKo: string;
  nameEn: string;
  type: CalendarResourceType;
  site: string;
  floor?: string | null;
  capacity: number;
  features: string[];
  timeZone: string;
  approvalRequired: boolean;
  state: CalendarResourceState;
  version?: number | null;
};

export async function saveCalendarResource(
  resourceId: string | null,
  input: CalendarResourceInput
): Promise<CalendarResource> {
  if (!resourceId) {
    const response = await axiosInstance.post<ApiResponse<CalendarResource>, CalendarResourceInput>(
      '/api/platform/v1/admin/calendar/resources',
      input
    );
    return response.data.data;
  }
  const response = await axiosInstance.put<ApiResponse<CalendarResource>, CalendarResourceInput>(
    `/api/platform/v1/admin/calendar/resources/${encodeURIComponent(resourceId)}`,
    input
  );
  return response.data.data;
}
