import { axiosInstance } from '../axios-instance';

import type { components as GatewayComponents } from '@dwp-frontend/api-contracts';
import type { ApiResponse } from '../types';

type PlatformSchemas = GatewayComponents['schemas'];

export type PersonalSettingKey =
  | 'profile'
  | 'security'
  | 'appearance'
  | 'accessibility'
  | 'language'
  | 'home'
  | 'notifications'
  | 'managed';

export type PersonalSettingFavorite = {
  settingKey: PersonalSettingKey;
  favorite: boolean;
  version: number;
  updatedAt?: string | null;
};

export type PersonalSettingActivity = {
  activityId: string;
  settingKey: PersonalSettingKey;
  activityType: 'VIEW' | 'CHANGE';
  changedFields: string[];
  occurredAt: string;
};

export type PersonalSettingsWorkspace = {
  favorites: PersonalSettingFavorite[];
  recentActivity: PersonalSettingActivity[];
  observation: {
    sourceState: 'AVAILABLE';
    freshnessState: 'CURRENT' | 'UNCONFIRMED' | 'CHANGED_SINCE_CONFIRMATION' | 'REVIEW_DUE';
    observedAt: string;
    lastChangeAt?: string | null;
    lastConfirmedAt?: string | null;
    reviewDueAt?: string | null;
    version: number;
    offlineBehavior: 'MEMORY_ONLY_READ_ONLY';
  };
};

export type PersonalPrivacyConsent = {
  consentId: string;
  purposeKey: 'PRODUCT_ANALYTICS';
  consentState: 'GRANTED' | 'WITHDRAWN';
  noticeVersion: string;
  source: 'ACCOUNT_SETTINGS';
  occurredAt: string;
};

export type PersonalPrivacyConsentLedger = {
  currentProductAnalytics?: PersonalPrivacyConsent | null;
  history: PersonalPrivacyConsent[];
  historyHasMore: boolean;
  historyLimit: number;
  coveredPurposes: Array<'PRODUCT_ANALYTICS'>;
  coverageState: 'PRODUCT_LOCAL';
  coverageBoundary: 'CROSS_PRODUCT_CONSENT_SOURCES_NOT_CONNECTED';
};

type GeneratedPrivacyRequestReceipt = Required<PlatformSchemas['platform_PrivacyRequestReceipt']>;
type GeneratedPrivacyRequestEvent = Required<PlatformSchemas['platform_PrivacyRequestEvent']>;
type GeneratedPrivacyRequest = Required<PlatformSchemas['platform_PrivacyRequest']>;
type GeneratedPrivacyRequestPage = Required<PlatformSchemas['platform_PrivacyRequestPage']>;

export type PersonalPrivacyRequestReceipt = Omit<
  GeneratedPrivacyRequestReceipt,
  'receiptType' | 'evidenceState' | 'fulfillmentBoundary'
> & {
  receiptType: 'INTAKE';
  evidenceState: 'INTAKE_ONLY';
  fulfillmentBoundary: 'PRIVACY_OWNER_EXECUTION_NOT_CONNECTED';
};

export type PersonalPrivacyRequestEvent = Omit<
  GeneratedPrivacyRequestEvent,
  'eventType' | 'requestState' | 'detailKey'
> & {
  eventType: 'REQUEST_RECEIVED' | 'FULFILLMENT_BOUNDARY_RECORDED' | 'REQUEST_CANCELLED';
  requestState: 'RECEIVED' | 'CANCELLED';
  detailKey:
    | 'PRIVACY_REQUEST_INTAKE_RECORDED'
    | 'PRIVACY_OWNER_EXECUTION_NOT_CONNECTED'
    | 'CANCELLED_BY_REQUEST_OWNER';
};

export type PersonalPrivacyRequest = Omit<
  GeneratedPrivacyRequest,
  | 'requestType'
  | 'requestState'
  | 'reason'
  | 'fulfillmentAvailable'
  | 'fulfillmentBoundary'
  | 'receipt'
  | 'lifecycle'
> & {
  requestType: 'DATA_EXPORT' | 'ACCOUNT_DELETION';
  requestState: 'RECEIVED' | 'CANCELLED';
  reason: string | null;
  fulfillmentAvailable: false;
  fulfillmentBoundary: 'PRIVACY_OWNER_EXECUTION_NOT_CONNECTED';
  receipt: PersonalPrivacyRequestReceipt | null;
  lifecycle: PersonalPrivacyRequestEvent[];
};

export type PersonalPrivacyRequestPage = Omit<GeneratedPrivacyRequestPage, 'items'> & {
  items: PersonalPrivacyRequest[];
};

export async function getPersonalSettingsWorkspace(): Promise<PersonalSettingsWorkspace> {
  const response = await axiosInstance.get<ApiResponse<PersonalSettingsWorkspace>>(
    '/api/platform/v1/personal-settings/workspace'
  );
  return response.data.data;
}

export async function reconfirmPersonalSettingsWorkspace(
  version: number
): Promise<PersonalSettingsWorkspace> {
  const response = await axiosInstance.post<
    ApiResponse<PersonalSettingsWorkspace>,
    { version: number }
  >('/api/platform/v1/personal-settings/workspace/reconfirm', { version });
  return response.data.data;
}

export async function updatePersonalSettingFavorite(
  settingKey: PersonalSettingKey,
  favorite: boolean,
  version: number
): Promise<PersonalSettingFavorite> {
  const response = await axiosInstance.put<
    ApiResponse<PersonalSettingFavorite>,
    { favorite: boolean; version: number }
  >(`/api/platform/v1/personal-settings/favorites/${settingKey}`, { favorite, version });
  return response.data.data;
}

export async function recordPersonalSettingView(
  settingKey: PersonalSettingKey
): Promise<PersonalSettingActivity> {
  const response = await axiosInstance.post<
    ApiResponse<PersonalSettingActivity>,
    { settingKey: PersonalSettingKey }
  >('/api/platform/v1/personal-settings/activity/view', { settingKey });
  return response.data.data;
}

export async function getPersonalPrivacyConsentLedger(): Promise<PersonalPrivacyConsentLedger> {
  const response = await axiosInstance.get<ApiResponse<PersonalPrivacyConsentLedger>>(
    '/api/platform/v1/personal-settings/privacy/consents'
  );
  return response.data.data;
}

export async function updateProductAnalyticsConsent(
  granted: boolean,
  noticeVersion: string
): Promise<PersonalPrivacyConsent> {
  const response = await axiosInstance.put<
    ApiResponse<PersonalPrivacyConsent>,
    { granted: boolean; noticeVersion: string }
  >('/api/platform/v1/personal-settings/privacy/consents/product-analytics', {
    granted,
    noticeVersion,
  });
  return response.data.data;
}

export async function listPersonalPrivacyRequests(limit = 50): Promise<PersonalPrivacyRequestPage> {
  const response = await axiosInstance.get<ApiResponse<PersonalPrivacyRequestPage>>(
    `/api/platform/v1/personal-settings/privacy/requests?limit=${limit}`
  );
  return response.data.data;
}

export async function createPersonalPrivacyRequest(
  requestType: PersonalPrivacyRequest['requestType'],
  accountDeletionAcknowledged = false
): Promise<PersonalPrivacyRequest> {
  const response = await axiosInstance.post<
    ApiResponse<PersonalPrivacyRequest>,
    {
      requestType: PersonalPrivacyRequest['requestType'];
      requestedScope: string;
      accountDeletionAcknowledged: boolean;
    }
  >('/api/platform/v1/personal-settings/privacy/requests', {
    requestType,
    requestedScope: 'ALL_PERSONAL_DATA',
    accountDeletionAcknowledged,
  });
  return response.data.data;
}

export async function cancelPersonalPrivacyRequest(
  requestId: string,
  version: number
): Promise<PersonalPrivacyRequest> {
  const response = await axiosInstance.patch<
    ApiResponse<PersonalPrivacyRequest>,
    { version: number }
  >(`/api/platform/v1/personal-settings/privacy/requests/${requestId}/cancel`, { version });
  return response.data.data;
}
