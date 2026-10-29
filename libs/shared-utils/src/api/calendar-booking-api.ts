import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

const BASE = '/api/platform/v1/calendar/booking';
const CANONICAL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

function uuid(value: string, label: string) {
  if (!CANONICAL_UUID.test(value)) {
    throw new Error(`Calendar booking ${label} must be a canonical lowercase UUID.`);
  }
  return value;
}

function requestConfig(signal?: AbortSignal) {
  return signal ? { signal } : undefined;
}

function pagePath(pageId: string, suffix = '') {
  return `${BASE}/pages/${uuid(pageId, 'pageId')}${suffix}`;
}

function appointmentPath(appointmentId: string, suffix = '') {
  return `${BASE}/appointments/${uuid(appointmentId, 'appointmentId')}${suffix}`;
}

export type CalendarBookingOwnerType = 'PERSONAL' | 'TEAM';
export type CalendarBookingPageState = 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'ARCHIVED';
export type CalendarBookingHoldState = 'HELD' | 'CONSUMED' | 'EXPIRED' | 'CANCELLED';
export type CalendarBookingAppointmentState = 'CONFIRMED' | 'RESCHEDULED' | 'CANCELLED';
export type CalendarBookingMeetingMode = 'IN_PERSON' | 'VIDEO' | 'PHONE';
export type CalendarBookingQuestionType = 'SHORT_TEXT' | 'LONG_TEXT' | 'SINGLE_SELECT' | 'CHECKBOX';

export type CalendarBookingAvailabilityRule = {
  dayOfWeek: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
  startsAt: string;
  endsAt: string;
};

export type CalendarBookingQuestion = {
  key: string;
  label: string;
  type: CalendarBookingQuestionType;
  required: boolean;
  options: string[] | null;
};

export type SaveCalendarBookingPageInput = {
  ownerType: CalendarBookingOwnerType;
  ownerGroupRef: string | null;
  calendarId: string;
  title: string;
  description: string | null;
  timeZone: string;
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  dailyLimit: number;
  minimumNoticeMinutes: number;
  maximumAdvanceDays: number;
  meetingMode: CalendarBookingMeetingMode;
  location: string | null;
  conferenceUrl: string | null;
  dialInInstructions: string | null;
  availabilityRules: CalendarBookingAvailabilityRule[];
  questions: CalendarBookingQuestion[];
  version: number;
};

export type CalendarBookingPage = SaveCalendarBookingPageInput & {
  pageId: string;
  ownerPersonPublicId: string | null;
  state: CalendarBookingPageState;
  publicLinkConfigured: boolean;
  publicTokenVersion: number;
  updatedAt: string;
};

export type ChangeCalendarBookingPageStateInput = {
  state: CalendarBookingPageState;
  version: number;
};

export type CreateCalendarBookingHoldInput = {
  startsAt: string;
  endsAt: string;
  idempotencyKey: string;
  pageVersion: number;
};

export type CancelCalendarBookingHoldInput = {
  fencingToken: number;
};

export type CalendarBookingHold = {
  holdId: string;
  pageId: string;
  bookerPersonPublicId: string;
  state: CalendarBookingHoldState;
  startsAt: string;
  endsAt: string;
  expiresAt: string;
  fencingToken: number;
  version: number;
};

export type CalendarBookingAnswer = {
  key: string;
  value: string;
};

export type ConfirmCalendarBookingInput = {
  holdId: string;
  fencingToken: number;
  idempotencyKey: string;
  answers: CalendarBookingAnswer[];
};

export type CalendarBookingAppointment = {
  appointmentId: string;
  pageId: string;
  eventId: string;
  bookerPersonPublicId: string;
  state: CalendarBookingAppointmentState;
  startsAt: string;
  endsAt: string;
  supersedesAppointmentId: string | null;
  version: number;
  updatedAt: string;
};

export type RescheduleCalendarBookingAppointmentInput = {
  replacementHoldId: string;
  fencingToken: number;
  idempotencyKey: string;
  version: number;
};

export type CancelCalendarBookingAppointmentInput = {
  version: number;
  reason: string | null;
};

export type RotateCalendarBookingTokenInput = {
  version: number;
};

export type CalendarBookingSecurityCapabilities = {
  authenticatedBookingEnabled: boolean;
  externalPublicBookingEnabled: boolean;
  externalPublicBookingReason: string | null;
  holdTtlSeconds: number;
};

export type AuthenticatedCalendarBookablePage = {
  pageId: string;
  pageVersion: number;
  title: string;
  description: string | null;
  timeZone: string;
  durationMinutes: number;
  meetingMode: CalendarBookingMeetingMode;
  location: string | null;
  conferenceUrl: string | null;
  dialInInstructions: string | null;
  questions: CalendarBookingQuestion[];
};

export type CalendarBookingAvailabilitySlot = {
  startsAt: string;
  endsAt: string;
};

export type CalendarBookingAvailability = {
  pageId: string;
  pageVersion: number;
  from: string;
  to: string;
  slots: CalendarBookingAvailabilitySlot[];
  generatedAt: string;
};

/**
 * Raw tokens are deliberately not part of any public return type. Consumers must move the
 * one-time value directly into short-lived component memory; never put it in a query cache,
 * URL, log, analytics event or persistent/browser storage.
 */
export type CalendarBookingOneTimeToken = Readonly<{
  kind: 'PUBLIC_LINK' | 'APPOINTMENT_MANAGEMENT';
  value: string;
}>;

export type ConsumeCalendarBookingOneTimeToken = (token: CalendarBookingOneTimeToken) => void;

type BookingPagePublishReceipt = {
  page: CalendarBookingPage;
  publicToken: string | null;
};

type AppointmentReceipt = {
  appointment: CalendarBookingAppointment;
  managementToken: string | null;
};

function consumeToken(
  kind: CalendarBookingOneTimeToken['kind'],
  value: string | null,
  consume: ConsumeCalendarBookingOneTimeToken
) {
  if (typeof value === 'string' && value.length > 0) consume({ kind, value });
}

function assertIdempotencyKey(value: string) {
  return uuid(value, 'idempotencyKey');
}

export async function getCalendarBookingCapabilities(
  signal?: AbortSignal
): Promise<CalendarBookingSecurityCapabilities> {
  const response = await axiosInstance.get<ApiResponse<CalendarBookingSecurityCapabilities>>(
    `${BASE}/capabilities`,
    requestConfig(signal)
  );
  return response.data.data;
}

export async function listCalendarBookingPages(
  signal?: AbortSignal
): Promise<CalendarBookingPage[]> {
  const response = await axiosInstance.get<ApiResponse<CalendarBookingPage[]>>(
    `${BASE}/pages`,
    requestConfig(signal)
  );
  return response.data.data;
}

export async function getCalendarBookingPage(
  pageId: string,
  signal?: AbortSignal
): Promise<CalendarBookingPage> {
  const response = await axiosInstance.get<ApiResponse<CalendarBookingPage>>(
    pagePath(pageId),
    requestConfig(signal)
  );
  return response.data.data;
}

export async function getAuthenticatedCalendarBookablePage(
  pageId: string,
  signal?: AbortSignal
): Promise<AuthenticatedCalendarBookablePage> {
  const response = await axiosInstance.get<ApiResponse<AuthenticatedCalendarBookablePage>>(
    pagePath(pageId, '/bookable'),
    requestConfig(signal)
  );
  return response.data.data;
}

export async function getAuthenticatedCalendarBookingAvailability(
  pageId: string,
  range: Readonly<{ from: string; to: string }>,
  signal?: AbortSignal
): Promise<CalendarBookingAvailability> {
  const query = new URLSearchParams({ from: range.from, to: range.to });
  const response = await axiosInstance.get<ApiResponse<CalendarBookingAvailability>>(
    `${pagePath(pageId, '/availability')}?${query}`,
    requestConfig(signal)
  );
  return response.data.data;
}

export async function createCalendarBookingPage(
  input: SaveCalendarBookingPageInput,
  signal?: AbortSignal
): Promise<CalendarBookingPage> {
  const response = await axiosInstance.post<
    ApiResponse<CalendarBookingPage>,
    SaveCalendarBookingPageInput
  >(`${BASE}/pages`, input, requestConfig(signal));
  return response.data.data;
}

export async function updateCalendarBookingPage(
  pageId: string,
  input: SaveCalendarBookingPageInput,
  signal?: AbortSignal
): Promise<CalendarBookingPage> {
  const response = await axiosInstance.put<
    ApiResponse<CalendarBookingPage>,
    SaveCalendarBookingPageInput
  >(pagePath(pageId), input, requestConfig(signal));
  return response.data.data;
}

export async function changeCalendarBookingPageState(
  pageId: string,
  input: ChangeCalendarBookingPageStateInput,
  consume: ConsumeCalendarBookingOneTimeToken,
  signal?: AbortSignal
): Promise<CalendarBookingPage> {
  const response = await axiosInstance.post<
    ApiResponse<BookingPagePublishReceipt>,
    ChangeCalendarBookingPageStateInput
  >(pagePath(pageId, '/state'), input, requestConfig(signal));
  const receipt = response.data.data;
  consumeToken('PUBLIC_LINK', receipt.publicToken, consume);
  return receipt.page;
}

export async function rotateCalendarBookingPagePublicToken(
  pageId: string,
  input: RotateCalendarBookingTokenInput,
  consume: ConsumeCalendarBookingOneTimeToken,
  signal?: AbortSignal
): Promise<CalendarBookingPage> {
  const response = await axiosInstance.post<
    ApiResponse<BookingPagePublishReceipt>,
    RotateCalendarBookingTokenInput
  >(pagePath(pageId, '/public-token:rotate'), input, requestConfig(signal));
  const receipt = response.data.data;
  consumeToken('PUBLIC_LINK', receipt.publicToken, consume);
  return receipt.page;
}

export async function revokeCalendarBookingPagePublicToken(
  pageId: string,
  input: RotateCalendarBookingTokenInput,
  signal?: AbortSignal
): Promise<CalendarBookingPage> {
  const response = await axiosInstance.post<
    ApiResponse<CalendarBookingPage>,
    RotateCalendarBookingTokenInput
  >(pagePath(pageId, '/public-token:revoke'), input, requestConfig(signal));
  return response.data.data;
}

export async function createAuthenticatedCalendarBookingHold(
  pageId: string,
  input: CreateCalendarBookingHoldInput,
  signal?: AbortSignal
): Promise<CalendarBookingHold> {
  assertIdempotencyKey(input.idempotencyKey);
  const response = await axiosInstance.post<
    ApiResponse<CalendarBookingHold>,
    CreateCalendarBookingHoldInput
  >(pagePath(pageId, '/holds'), input, requestConfig(signal));
  return response.data.data;
}

export async function cancelAuthenticatedCalendarBookingHold(
  pageId: string,
  holdId: string,
  input: CancelCalendarBookingHoldInput,
  signal?: AbortSignal
): Promise<CalendarBookingHold> {
  const response = await axiosInstance.post<
    ApiResponse<CalendarBookingHold>,
    CancelCalendarBookingHoldInput
  >(pagePath(pageId, `/holds/${uuid(holdId, 'holdId')}/cancel`), input, requestConfig(signal));
  return response.data.data;
}

export async function confirmAuthenticatedCalendarBooking(
  pageId: string,
  input: ConfirmCalendarBookingInput,
  consume: ConsumeCalendarBookingOneTimeToken,
  signal?: AbortSignal
): Promise<CalendarBookingAppointment> {
  uuid(input.holdId, 'holdId');
  assertIdempotencyKey(input.idempotencyKey);
  const response = await axiosInstance.post<
    ApiResponse<AppointmentReceipt>,
    ConfirmCalendarBookingInput
  >(pagePath(pageId, '/appointments'), input, requestConfig(signal));
  const receipt = response.data.data;
  consumeToken('APPOINTMENT_MANAGEMENT', receipt.managementToken, consume);
  return receipt.appointment;
}

export async function listMyCalendarBookingAppointments(
  signal?: AbortSignal
): Promise<CalendarBookingAppointment[]> {
  const response = await axiosInstance.get<ApiResponse<CalendarBookingAppointment[]>>(
    `${BASE}/appointments`,
    requestConfig(signal)
  );
  return response.data.data;
}

export async function getMyCalendarBookingAppointment(
  appointmentId: string,
  signal?: AbortSignal
): Promise<CalendarBookingAppointment> {
  const response = await axiosInstance.get<ApiResponse<CalendarBookingAppointment>>(
    appointmentPath(appointmentId),
    requestConfig(signal)
  );
  return response.data.data;
}

export async function rescheduleAuthenticatedCalendarBooking(
  appointmentId: string,
  input: RescheduleCalendarBookingAppointmentInput,
  signal?: AbortSignal
): Promise<CalendarBookingAppointment> {
  uuid(input.replacementHoldId, 'replacementHoldId');
  assertIdempotencyKey(input.idempotencyKey);
  const response = await axiosInstance.post<
    ApiResponse<CalendarBookingAppointment>,
    RescheduleCalendarBookingAppointmentInput
  >(appointmentPath(appointmentId, '/reschedule'), input, requestConfig(signal));
  return response.data.data;
}

export async function cancelAuthenticatedCalendarBooking(
  appointmentId: string,
  input: CancelCalendarBookingAppointmentInput,
  signal?: AbortSignal
): Promise<CalendarBookingAppointment> {
  const response = await axiosInstance.post<
    ApiResponse<CalendarBookingAppointment>,
    CancelCalendarBookingAppointmentInput
  >(appointmentPath(appointmentId, '/cancel'), input, requestConfig(signal));
  return response.data.data;
}

export async function rotateCalendarBookingManagementToken(
  appointmentId: string,
  input: RotateCalendarBookingTokenInput,
  consume: ConsumeCalendarBookingOneTimeToken,
  signal?: AbortSignal
): Promise<CalendarBookingAppointment> {
  const response = await axiosInstance.post<
    ApiResponse<AppointmentReceipt>,
    RotateCalendarBookingTokenInput
  >(appointmentPath(appointmentId, '/management-token:rotate'), input, requestConfig(signal));
  const receipt = response.data.data;
  consumeToken('APPOINTMENT_MANAGEMENT', receipt.managementToken, consume);
  return receipt.appointment;
}

export async function revokeCalendarBookingManagementToken(
  appointmentId: string,
  input: RotateCalendarBookingTokenInput,
  signal?: AbortSignal
): Promise<CalendarBookingAppointment> {
  const response = await axiosInstance.post<
    ApiResponse<CalendarBookingAppointment>,
    RotateCalendarBookingTokenInput
  >(appointmentPath(appointmentId, '/management-token:revoke'), input, requestConfig(signal));
  return response.data.data;
}
