import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type CalendarDayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

export type CalendarSpeedyMeetingMode = 'STANDARD' | 'FIVE_TEN';
export type CalendarDefaultVisibility = 'FREE_BUSY' | 'DETAILS' | 'PRIVATE';
export type CalendarDelegationScope = 'RESPOND' | 'EDIT_SCHEDULE' | 'CREATE';
export type CalendarDelegationStatus = 'SCHEDULED' | 'ACTIVE' | 'EXPIRED' | 'REVOKED';
export type CalendarSettingSource = 'USER' | 'TENANT_POLICY' | 'SYSTEM_DEFAULT';
export type CalendarSettingKey =
  | 'WORKING_DAYS'
  | 'WORKING_DAY_START'
  | 'WORKING_DAY_END'
  | 'TIME_ZONE'
  | 'WEEK_START'
  | 'DEFAULT_EVENT_MINUTES'
  | 'SPEEDY_MEETING_MODE'
  | 'DEFAULT_BUFFER_MINUTES'
  | 'DEFAULT_VISIBILITY'
  | 'DEFAULT_REMINDER_MINUTES';

export type CalendarSettingGovernance = Readonly<{
  key: CalendarSettingKey;
  source: CalendarSettingSource;
  managed: boolean;
  inherited: boolean;
  locked: boolean;
}>;

export type CalendarSettings = Readonly<{
  workingDays: CalendarDayOfWeek[];
  workingDayStart: string;
  workingDayEnd: string;
  timeZone: string;
  weekStart: CalendarDayOfWeek;
  defaultEventMinutes: number;
  speedyMeetingMode: CalendarSpeedyMeetingMode;
  defaultBufferMinutes: number;
  defaultVisibility: CalendarDefaultVisibility;
  defaultReminderMinutes: number;
  governance: CalendarSettingGovernance[];
  version: number;
  updatedAt: string | null;
}>;

export type UpdateCalendarSettingsInput = Readonly<{
  workingDays: CalendarDayOfWeek[];
  workingDayStart: string;
  workingDayEnd: string;
  timeZone: string;
  weekStart: CalendarDayOfWeek;
  defaultEventMinutes: number;
  speedyMeetingMode: CalendarSpeedyMeetingMode;
  defaultBufferMinutes: number;
  defaultVisibility: CalendarDefaultVisibility;
  defaultReminderMinutes: number;
  version: number;
}>;

export type CalendarDelegation = Readonly<{
  delegationId: string;
  ownerPersonPublicId: string;
  delegatePersonPublicId: string;
  scopes: CalendarDelegationScope[];
  validFrom: string;
  validUntil: string;
  status: CalendarDelegationStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}>;

export type CreateCalendarDelegationInput = Readonly<{
  delegatePersonPublicId: string;
  scopes: CalendarDelegationScope[];
  validFrom: string;
  validUntil: string;
}>;

export async function getCalendarSettings(signal?: AbortSignal): Promise<CalendarSettings> {
  const response = await axiosInstance.get<ApiResponse<CalendarSettings>>(
    '/api/platform/v1/calendar/settings',
    signal ? { signal } : undefined
  );
  return response.data.data;
}

export async function updateCalendarSettings(
  input: UpdateCalendarSettingsInput
): Promise<CalendarSettings> {
  const response = await axiosInstance.put<ApiResponse<CalendarSettings>, UpdateCalendarSettingsInput>(
    '/api/platform/v1/calendar/settings',
    input
  );
  return response.data.data;
}

export async function resetCalendarSettings(version: number): Promise<CalendarSettings> {
  const response = await axiosInstance.post<ApiResponse<CalendarSettings>, { version: number }>(
    '/api/platform/v1/calendar/settings/reset',
    { version }
  );
  return response.data.data;
}

export async function getCalendarDelegations(
  signal?: AbortSignal
): Promise<CalendarDelegation[]> {
  const response = await axiosInstance.get<ApiResponse<CalendarDelegation[]>>(
    '/api/platform/v1/calendar/settings/delegations',
    signal ? { signal } : undefined
  );
  return response.data.data;
}

export async function createCalendarDelegation(
  input: CreateCalendarDelegationInput
): Promise<CalendarDelegation> {
  const response = await axiosInstance.post<
    ApiResponse<CalendarDelegation>,
    CreateCalendarDelegationInput
  >('/api/platform/v1/calendar/settings/delegations', input);
  return response.data.data;
}

export async function revokeCalendarDelegation(
  delegationId: string,
  version: number
): Promise<CalendarDelegation> {
  const response = await axiosInstance.post<
    ApiResponse<CalendarDelegation>,
    { version: number }
  >(
    `/api/platform/v1/calendar/settings/delegations/${encodeURIComponent(delegationId)}/revoke`,
    { version }
  );
  return response.data.data;
}
