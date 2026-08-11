import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

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
  };
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
  } | null;
};

export type PersonalPreference = {
  schemaVersion: 1;
  customized: boolean;
  preferences: PersonalPreferenceValues;
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
