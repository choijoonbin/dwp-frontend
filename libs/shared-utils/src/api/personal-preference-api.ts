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

export type ManagedPreferenceRule = {
  ruleId: string;
  preferencePath: string;
  displayKey: string;
  managedValue: unknown;
  exceptionAllowed: boolean;
  version: number;
};

export type ManagedPreferencePolicy = {
  policyId: string;
  scope: 'TENANT';
  source: 'TENANT_EXPERIENCE_POLICY';
  ownerType: 'ROLE' | 'USER' | 'GROUP';
  ownerRef: string;
  ownerDisplayName: string;
  contactUri?: string | null;
  managedPaths: string[];
  rules: ManagedPreferenceRule[];
  version: number;
};

export type PreferenceExceptionState =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXPIRED';

export type PreferenceExceptionRequest = {
  requestId: string;
  userId: number;
  preferencePath: string;
  requestedValue: unknown;
  businessJustification: string;
  businessImpact: string;
  requestState: PreferenceExceptionState;
  assignedOwnerRef: string;
  requestedUntil?: string | null;
  decisionReason?: string | null;
  decisionEvidenceRef?: string | null;
  decidedBy?: number | null;
  decidedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type CreatePreferenceExceptionRequest = {
  preferencePath: string;
  requestedValue: unknown;
  businessJustification: string;
  businessImpact: string;
  requestedUntil?: string | null;
};

export type DecidePreferenceExceptionRequest = {
  decision: 'APPROVED' | 'REJECTED';
  reason: string;
  evidenceRef?: string;
  version: number;
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

export async function getManagedPreferencePolicy(): Promise<ManagedPreferencePolicy> {
  const response = await axiosInstance.get<ApiResponse<ManagedPreferencePolicy>>(
    '/api/platform/v1/personal-preferences/managed-policy'
  );
  return response.data.data;
}

export async function listMyPreferenceExceptions(): Promise<PreferenceExceptionRequest[]> {
  const response = await axiosInstance.get<ApiResponse<PreferenceExceptionRequest[]>>(
    '/api/platform/v1/personal-preferences/exceptions'
  );
  return response.data.data;
}

export async function requestPreferenceException(
  request: CreatePreferenceExceptionRequest
): Promise<PreferenceExceptionRequest> {
  const response = await axiosInstance.post<
    ApiResponse<PreferenceExceptionRequest>,
    CreatePreferenceExceptionRequest
  >('/api/platform/v1/personal-preferences/exceptions', request);
  return response.data.data;
}

export async function cancelPreferenceException(
  requestId: string,
  version: number
): Promise<PreferenceExceptionRequest> {
  const response = await axiosInstance.post<
    ApiResponse<PreferenceExceptionRequest>,
    { version: number }
  >(`/api/platform/v1/personal-preferences/exceptions/${requestId}/cancel`, { version });
  return response.data.data;
}

export async function listAdminPreferenceExceptions(
  state: PreferenceExceptionState | 'ALL' = 'ALL'
): Promise<PreferenceExceptionRequest[]> {
  const search = new URLSearchParams({ state });
  const response = await axiosInstance.get<ApiResponse<PreferenceExceptionRequest[]>>(
    `/api/platform/v1/admin/preference-exceptions?${search.toString()}`
  );
  return response.data.data;
}

export async function decidePreferenceException(
  requestId: string,
  request: DecidePreferenceExceptionRequest
): Promise<PreferenceExceptionRequest> {
  const response = await axiosInstance.post<
    ApiResponse<PreferenceExceptionRequest>,
    DecidePreferenceExceptionRequest
  >(`/api/platform/v1/admin/preference-exceptions/${requestId}/decision`, request);
  return response.data.data;
}
