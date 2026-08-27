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
export type CalendarSourceKind = 'OWNED' | 'COMPANY' | 'SHARED' | 'TEAM' | 'RESOURCE';
export type CalendarAccessLevel =
  'OWNER' | 'MANAGE' | 'EDIT' | 'VIEW_DETAILS' | 'VIEW_FREE_BUSY' | 'EVENT_ATTENDEE' | 'NONE';
export type CalendarSubscriptionPolicy = 'REQUIRED' | 'DEFAULT_ON' | 'OPTIONAL';
export type CalendarEventImportance = 'LOW' | 'NORMAL' | 'HIGH';
export type CalendarEventDetailLevel = 'FULL' | 'FREE_BUSY';

export type CalendarCapabilities = {
  canViewDetails: boolean;
  canCreateEvents: boolean;
  canEditCalendar: boolean;
  canManageSharing: boolean;
  canDeleteCalendar: boolean;
  canUnsubscribe: boolean;
};

export type CalendarEventCapabilities = {
  canViewDetails: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canRestore: boolean;
  canRespond: boolean;
  canStar: boolean;
};

export type CalendarSummary = {
  calendarId: string;
  calendarKey: string;
  name: string;
  color: string;
  type: CalendarType;
  visibility: string;
  ownerPersonPublicId?: string | null;
  ownerDisplayName?: string | null;
  sourceKind?: CalendarSourceKind;
  accessLevel?: CalendarAccessLevel;
  subscriptionPolicy?: CalendarSubscriptionPolicy;
  required?: boolean;
  selected: boolean;
  favorite?: boolean;
  displayOrder?: number;
  version?: number;
  subscriptionVersion?: number;
  capabilities?: CalendarCapabilities;
};

export type CalendarShare = {
  grantId: string;
  principalType: string;
  principalPersonPublicId?: string | null;
  principalGroupRef?: string | null;
  principalDisplayName: string;
  accessLevel: CalendarAccessLevel;
  canViewPrivate: boolean;
  validUntil?: string | null;
  lifecycleState: string;
  version: number;
};

export type CalendarShareInput = {
  principalPersonPublicId: string;
  principalDisplayName: string;
  accessLevel: Extract<CalendarAccessLevel, 'VIEW_FREE_BUSY' | 'VIEW_DETAILS' | 'EDIT' | 'MANAGE'>;
  canViewPrivate: boolean;
  validUntil?: string | null;
  version: number;
};

export type CalendarSubscriptionInput = {
  selected: boolean;
  favorite: boolean;
  displayOrder: number;
  colorOverride?: string | null;
  version: number;
};

export type CalendarSubscription = {
  selected: boolean;
  favorite: boolean;
  displayOrder: number;
  colorOverride?: string | null;
  version: number;
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
  importance?: CalendarEventImportance;
  detailLevel?: CalendarEventDetailLevel;
  redacted?: boolean;
  starred?: boolean;
  preferenceVersion?: number;
  capabilities?: CalendarEventCapabilities;
  restrictionReason?: string | null;
  version: number;
};

export type CalendarEventPreferenceInput = {
  starred: boolean;
  hidden: boolean;
  version: number;
};

export type CalendarEventPreference = CalendarEventPreferenceInput;

export type CalendarTrashedEvent = {
  eventId: string;
  calendarId: string;
  calendarName: string;
  calendarColor: string;
  title: string;
  startsAt: string;
  endsAt: string;
  deletedAt: string;
  purgeAfter?: string | null;
  legalHold: boolean;
  deletionReason?: string | null;
  importance: CalendarEventImportance;
  version: number;
  capabilities: CalendarEventCapabilities;
};

export type CompanyCalendar = {
  calendarId: string;
  key: string;
  name: string;
  nameKo: string;
  nameEn: string;
  color: string;
  upcomingEventCount: number;
  trashedEventCount: number;
  version: number;
};

export type CompanyCalendarInput = {
  key: string;
  nameKo: string;
  nameEn: string;
  color: string;
  version: number;
};

export type CompanyCalendarEvent = {
  eventId: string;
  calendarId: string;
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
  attendees: CalendarAttendee[];
  importance: CalendarEventImportance;
  deletedAt?: string | null;
  purgeAfter?: string | null;
  legalHold: boolean;
  capabilities: CalendarEventCapabilities;
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
  reasonCode?: string | null;
  reason: string;
};

export type CalendarAvailability = {
  participants: CalendarAvailabilityParticipant[];
  suggestions: CalendarAvailabilitySlot[];
  generatedAt: string;
};

export type CalendarSchedulingEvaluation = {
  evaluationId: string;
  criteriaHash: string;
  completeness: 'COMPLETE' | 'PARTIAL';
  sources: Array<{
    sourceType: string;
    status: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE';
    lastSuccessfulSyncAt?: string | null;
  }>;
  availability: CalendarAvailability;
  rooms: CalendarResource[];
  generatedAt: string;
  validUntil: string;
};

export type CalendarSchedulingEvaluationInput = {
  personIds: string[];
  from: string;
  to: string;
  roomStartsAt: string;
  roomEndsAt: string;
  durationMinutes: number;
  timeZone: string;
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
  calendarId?: string | null;
  importance?: CalendarEventImportance;
  idempotencyKey: string;
};

export type UpdateCalendarEventInput = Omit<
  CreateCalendarEventInput,
  'idempotencyKey' | 'calendarId'
> & {
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

export async function updateCalendarSubscription(
  calendarId: string,
  input: CalendarSubscriptionInput
): Promise<CalendarSubscription> {
  const response = await axiosInstance.put<
    ApiResponse<CalendarSubscription>,
    CalendarSubscriptionInput
  >(`/api/platform/v1/calendar/calendars/${encodeURIComponent(calendarId)}/subscription`, input);
  return response.data.data;
}

export async function getCalendarShares(calendarId: string): Promise<CalendarShare[]> {
  const response = await axiosInstance.get<ApiResponse<CalendarShare[]>>(
    `/api/platform/v1/calendar/calendars/${encodeURIComponent(calendarId)}/shares`
  );
  return response.data.data;
}

export async function putCalendarShare(
  calendarId: string,
  input: CalendarShareInput
): Promise<CalendarShare> {
  const response = await axiosInstance.put<ApiResponse<CalendarShare>, CalendarShareInput>(
    `/api/platform/v1/calendar/calendars/${encodeURIComponent(calendarId)}/shares/${encodeURIComponent(input.principalPersonPublicId)}`,
    input
  );
  return response.data.data;
}

export async function deleteCalendarShare(
  calendarId: string,
  grantId: string,
  version: number
): Promise<void> {
  await axiosInstance.delete<ApiResponse<void>>(
    `/api/platform/v1/calendar/calendars/${encodeURIComponent(calendarId)}/shares/${encodeURIComponent(grantId)}?version=${encodeURIComponent(String(version))}`
  );
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

export async function updateCalendarEventPreference(
  eventId: string,
  input: CalendarEventPreferenceInput
): Promise<CalendarEventPreference> {
  const response = await axiosInstance.put<
    ApiResponse<CalendarEventPreference>,
    CalendarEventPreferenceInput
  >(`/api/platform/v1/calendar/events/${encodeURIComponent(eventId)}/preference`, input);
  return response.data.data;
}

export async function getCalendarTrash(): Promise<CalendarTrashedEvent[]> {
  const response = await axiosInstance.get<ApiResponse<CalendarTrashedEvent[]>>(
    '/api/platform/v1/calendar/trash'
  );
  return response.data.data;
}

export async function trashCalendarEvent(
  eventId: string,
  version: number,
  reason?: string
): Promise<CalendarEventCapabilities> {
  const response = await axiosInstance.post<
    ApiResponse<CalendarEventCapabilities>,
    { version: number; reason?: string }
  >(`/api/platform/v1/calendar/events/${encodeURIComponent(eventId)}/trash`, {
    version,
    ...(reason ? { reason } : {}),
  });
  return response.data.data;
}

export async function restoreCalendarEvent(
  eventId: string,
  version: number
): Promise<CalendarEventCapabilities> {
  const response = await axiosInstance.post<
    ApiResponse<CalendarEventCapabilities>,
    { version: number }
  >(`/api/platform/v1/calendar/events/${encodeURIComponent(eventId)}/restore`, { version });
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

export async function getCalendarPolicy(): Promise<CalendarPolicy> {
  const response = await axiosInstance.get<ApiResponse<CalendarPolicy>>(
    '/api/platform/v1/calendar/policy'
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
  const roomEndsAt = new Date(Date.parse(from) + durationMinutes * 60_000).toISOString();
  const evaluation = await evaluateCalendarScheduling({
    personIds,
    from,
    to,
    roomStartsAt: from,
    roomEndsAt,
    durationMinutes,
    timeZone,
  });
  return evaluation.availability;
}

export async function evaluateCalendarScheduling(
  input: CalendarSchedulingEvaluationInput
): Promise<CalendarSchedulingEvaluation> {
  const response = await axiosInstance.post<
    ApiResponse<CalendarSchedulingEvaluation>,
    CalendarSchedulingEvaluationInput
  >('/api/platform/v1/calendar/scheduling/evaluations', input);
  return response.data.data;
}

export async function getCalendarAdminOverview(): Promise<CalendarAdminOverview> {
  const response = await axiosInstance.get<ApiResponse<CalendarAdminOverview>>(
    '/api/platform/v1/admin/calendar/overview'
  );
  return response.data.data;
}

export async function getCompanyCalendars(): Promise<CompanyCalendar[]> {
  const response = await axiosInstance.get<ApiResponse<CompanyCalendar[]>>(
    '/api/platform/v1/admin/calendar/company-calendars'
  );
  return response.data.data;
}

export async function createCompanyCalendar(input: CompanyCalendarInput): Promise<CompanyCalendar> {
  const response = await axiosInstance.post<ApiResponse<CompanyCalendar>, CompanyCalendarInput>(
    '/api/platform/v1/admin/calendar/company-calendars',
    input
  );
  return response.data.data;
}

export async function updateCompanyCalendar(
  calendarId: string,
  input: CompanyCalendarInput
): Promise<CompanyCalendar> {
  const response = await axiosInstance.put<ApiResponse<CompanyCalendar>, CompanyCalendarInput>(
    `/api/platform/v1/admin/calendar/company-calendars/${encodeURIComponent(calendarId)}`,
    input
  );
  return response.data.data;
}

export async function getCompanyCalendarEvents(
  calendarId: string,
  from: string,
  to: string,
  deleted = false
): Promise<CompanyCalendarEvent[]> {
  const response = await axiosInstance.get<ApiResponse<CompanyCalendarEvent[]>>(
    `/api/platform/v1/admin/calendar/company-calendars/${encodeURIComponent(calendarId)}/events?${rangeQuery(from, to)}&deleted=${deleted}`
  );
  return response.data.data;
}

export async function createCompanyCalendarEvent(
  calendarId: string,
  input: CreateCalendarEventInput
): Promise<CompanyCalendarEvent> {
  const response = await axiosInstance.post<
    ApiResponse<CompanyCalendarEvent>,
    CreateCalendarEventInput
  >(
    `/api/platform/v1/admin/calendar/company-calendars/${encodeURIComponent(calendarId)}/events`,
    input
  );
  return response.data.data;
}

export async function updateCompanyCalendarEvent(
  calendarId: string,
  eventId: string,
  input: UpdateCalendarEventInput
): Promise<CompanyCalendarEvent> {
  const response = await axiosInstance.put<
    ApiResponse<CompanyCalendarEvent>,
    UpdateCalendarEventInput
  >(
    `/api/platform/v1/admin/calendar/company-calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    input
  );
  return response.data.data;
}

export async function trashCompanyCalendarEvent(
  calendarId: string,
  eventId: string,
  version: number,
  reason?: string
): Promise<CompanyCalendarEvent> {
  const response = await axiosInstance.post<
    ApiResponse<CompanyCalendarEvent>,
    { version: number; reason?: string }
  >(
    `/api/platform/v1/admin/calendar/company-calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}/trash`,
    { version, ...(reason ? { reason } : {}) }
  );
  return response.data.data;
}

export async function restoreCompanyCalendarEvent(
  calendarId: string,
  eventId: string,
  version: number
): Promise<CompanyCalendarEvent> {
  const response = await axiosInstance.post<ApiResponse<CompanyCalendarEvent>, { version: number }>(
    `/api/platform/v1/admin/calendar/company-calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}/restore`,
    { version }
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
