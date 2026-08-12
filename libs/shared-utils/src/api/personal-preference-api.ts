import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import type {
  DateFormatPreference,
  FirstDayOfWeekPreference,
  NumberFormatPreference,
  RegionalPreference,
  TimeFormatPreference,
  TimeZonePreference,
} from '../regional-preference';

export type PersonalColorMode = 'system' | 'light' | 'dark';
export type PersonalDensity = 'compact' | 'standard' | 'comfortable';

export type PersonalPreferenceValues = {
  appearance: {
    mode: PersonalColorMode;
    density: PersonalDensity;
  };
  accessibility: {
    highContrast: boolean;
    reduceMotion: boolean;
    underlineLinks: boolean;
    reduceTransparency: boolean;
  };
  regional: RegionalPreference;
  [namespace: string]: unknown;
};

export type PersonalPreferencePatch = {
  appearance?: {
    mode?: PersonalColorMode | null;
    density?: PersonalDensity | null;
  } | null;
  accessibility?: {
    highContrast?: boolean | null;
    reduceMotion?: boolean | null;
    underlineLinks?: boolean | null;
    reduceTransparency?: boolean | null;
  } | null;
  regional?: {
    timeZone?: TimeZonePreference | null;
    dateFormat?: DateFormatPreference | null;
    timeFormat?: TimeFormatPreference | null;
    firstDayOfWeek?: FirstDayOfWeekPreference | null;
    numberFormat?: NumberFormatPreference | null;
  } | null;
};

export type ManagedPreferencePolicy = {
  scope: 'TENANT';
  source: 'TENANT_EXPERIENCE_POLICY';
  owner: 'TENANT_ADMINISTRATOR';
  managedPaths: string[];
};

export type PersonalPreference = {
  schemaVersion: 2;
  customized: boolean;
  preferences: PersonalPreferenceValues;
  managedPolicy: ManagedPreferencePolicy;
  version: number;
  updatedAt?: string | null;
};

export async function getPersonalPreference(): Promise<PersonalPreference> {
  const response = await axiosInstance.get<ApiResponse<PersonalPreference>>(
    '/api/platform/v1/personal-preferences',
    { timeoutMs: 4_000 }
  );
  return response.data.data;
}

export async function patchPersonalPreference(
  patch: PersonalPreferencePatch,
  version: number
): Promise<PersonalPreference> {
  const response = await axiosInstance.patch<
    ApiResponse<PersonalPreference>,
    { patch: PersonalPreferencePatch; version: number }
  >('/api/platform/v1/personal-preferences', { patch, version });
  return response.data.data;
}

export async function resetPersonalPreference(version: number): Promise<PersonalPreference> {
  const response = await axiosInstance.post<ApiResponse<PersonalPreference>, { version: number }>(
    '/api/platform/v1/personal-preferences/reset',
    { version }
  );
  return response.data.data;
}
