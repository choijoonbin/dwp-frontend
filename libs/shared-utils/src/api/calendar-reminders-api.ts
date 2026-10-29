import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

function calendarReminderEventPath(eventId: string) {
  if (!UUID.test(eventId)) {
    throw new Error('Calendar reminder eventId must be a canonical UUID.');
  }
  return `/api/platform/v1/calendar/events/${eventId}/reminders`;
}

export type CalendarReminderChannel = 'IN_APP' | 'EMAIL';
export type CalendarReminderState = 'ACTIVE' | 'INVALIDATED';

export type CalendarEventReminder = {
  reminderId: string;
  offsetMinutes: number;
  channel: CalendarReminderChannel;
  nextOccurrenceStartsAt: string | null;
  nextDueAt: string | null;
};

export type CalendarReminderSet = {
  eventId: string;
  eventVersion: number;
  version: number;
  state: CalendarReminderState;
  reminders: CalendarEventReminder[];
  updatedAt: string | null;
};

export type CalendarReminderSetInput = {
  version: number;
  reminders: Array<{
    offsetMinutes: number;
    channel: CalendarReminderChannel;
  }>;
};

export async function getCalendarEventReminders(
  eventId: string,
  signal?: AbortSignal
): Promise<CalendarReminderSet> {
  const response = await axiosInstance.get<ApiResponse<CalendarReminderSet>>(
    calendarReminderEventPath(eventId),
    signal ? { signal } : undefined
  );
  return response.data.data;
}

export async function updateCalendarEventReminders(
  eventId: string,
  input: CalendarReminderSetInput,
  signal?: AbortSignal
): Promise<CalendarReminderSet> {
  const response = await axiosInstance.put<
    ApiResponse<CalendarReminderSet>,
    CalendarReminderSetInput
  >(calendarReminderEventPath(eventId), input, signal ? { signal } : undefined);
  return response.data.data;
}
