import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import type {
  NotificationChannel,
  NotificationEntityVersion,
  NotificationPartialState,
} from './notification-contract';

const BASE = '/api/notifications/v1';

export type NotificationAttentionScopeKind =
  'APP_TYPE' | 'ACTOR' | 'THREAD' | 'RESOURCE' | 'TOPIC_TOKEN';

export type NotificationAttentionEffect = 'FOLLOW' | 'PRIORITIZE' | 'MUTE';
export type NotificationAttentionRuleSource = 'USER' | 'TENANT_POLICY' | 'SYSTEM_DEFAULT';

export type NotificationAttentionRule = {
  ruleId: string;
  scopeKind: NotificationAttentionScopeKind;
  scopeKey: string;
  displayLabel?: string | null;
  effect: NotificationAttentionEffect;
  channels: Partial<Record<NotificationChannel, boolean>>;
  startsAt?: string | null;
  expiresAt?: string | null;
  source: NotificationAttentionRuleSource;
  managed: boolean;
  exceptionAllowed: boolean;
  enabled: boolean;
  version: NotificationEntityVersion;
  createdAt: string;
  updatedAt: string;
};

export type NotificationAttentionRuleInput = {
  scopeKind: NotificationAttentionScopeKind;
  scopeKey: string;
  displayLabel?: string | null;
  effect: NotificationAttentionEffect;
  channels?: Partial<Record<NotificationChannel, boolean>>;
  startsAt?: string | null;
  expiresAt?: string | null;
  enabled?: boolean;
};

export type NotificationAttentionRuleCollection = {
  items: NotificationAttentionRule[];
  maxActiveRules: number;
};

export type NotificationAttentionDiscoverableContextKind = 'PROJECT' | 'WORK_ITEM' | 'TOPIC';
export type NotificationAttentionDiscoverableScopeKind = Extract<
  NotificationAttentionScopeKind,
  'RESOURCE' | 'TOPIC_TOKEN'
>;

export type NotificationAttentionContextOption = {
  scopeKind: NotificationAttentionDiscoverableScopeKind;
  contextKind: NotificationAttentionDiscoverableContextKind;
  scopeKey: string;
  displayLabel: string;
  lastSeenAt: string;
};

export type NotificationAttentionContextCollection = {
  items: NotificationAttentionContextOption[];
  limit: number;
  generatedAt: string;
};

export type NotificationAttentionRulePreview = {
  allowed: boolean;
  effectiveEffect: NotificationAttentionEffect;
  mandatoryConflict: boolean;
  conflictReason?: string | null;
  estimatedAffectedCount?: number | null;
  estimateAvailable: boolean;
  asOf: string;
};

export type NotificationAttentionControl = {
  controlKey: string;
  scopeKind: NotificationAttentionScopeKind;
  label: string;
  description?: string | null;
  allowedEffects: NotificationAttentionEffect[];
  currentEffect?: NotificationAttentionEffect | null;
  policyLocked: boolean;
  policyReason?: string | null;
  dndBypassAllowed: boolean;
  expiresAt?: string | null;
  ruleId?: string | null;
  ruleVersion?: NotificationEntityVersion | null;
};

export type NotificationAttentionControls = NotificationPartialState & {
  notificationId: string;
  whyReceived: string;
  controls: NotificationAttentionControl[];
  generatedAt: string;
};

export type NotificationAttentionControlPreviewInput = {
  controlKey: string;
  effect: NotificationAttentionEffect;
  expiresAt?: string | null;
};

export type NotificationAttentionControlImpactPreview = {
  controlKey: string;
  allowed: boolean;
  policyLocked: boolean;
  effectiveEffect: NotificationAttentionEffect;
  policySource?: string | null;
  policyReason?: string | null;
  previewFingerprint: string;
  currentRuleVersion?: NotificationEntityVersion | null;
  expiresAt?: string | null;
  asOf: string;
};

export type NotificationAttentionControlInput = NotificationAttentionControlPreviewInput & {
  expectedVersion?: NotificationEntityVersion | null;
  previewFingerprint: string;
};

export type NotificationTestDeliveryStageState =
  'PENDING' | 'SUCCEEDED' | 'FAILED' | 'DISABLED' | 'EXPIRED';

export type NotificationTestDeliveryStage = {
  stage: 'REQUEST_VALIDATION' | 'PRIVACY_FILTER' | 'IN_APP_PREVIEW' | 'ENDPOINT_DELIVERY';
  state: NotificationTestDeliveryStageState;
  detail?: string | null;
  occurredAt?: string | null;
};

export type NotificationTestDelivery = {
  testId: string;
  state: 'PENDING' | 'COMPLETED' | 'PARTIAL' | 'FAILED' | 'EXPIRED';
  requestedChannels: NotificationChannel[];
  stages: NotificationTestDeliveryStage[];
  createdAt: string;
  expiresAt: string;
  retryAfterSeconds?: number | null;
};

export type NotificationNoiseTypeMetric = {
  contractId: string;
  appKey: string;
  typeKey: string;
  ownerTeam: string;
  cohortSize: number;
  volume: number;
  muteRate?: number | null;
  deduplicationRate?: number | null;
  actionConversionRate?: number | null;
  findingCode?: string | null;
  findingSeverity?: NotificationNoiseFindingSeverity | null;
  findingTarget?: NotificationNoiseFindingTarget | null;
  findingTargetKey?: string | null;
};

export type NotificationNoiseTimeRange = 'LAST_24_HOURS' | 'LAST_7_DAYS' | 'LAST_30_DAYS';

export type NotificationNoiseFindingSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type NotificationNoiseRisk =
  'HIGH_MUTE_RATE' | 'LOW_ACTION_CONVERSION' | 'DEDUPLICATION_OPPORTUNITY';
export type NotificationNoiseFindingTarget =
  'CONTRACT' | 'POLICY' | 'TEMPLATE' | 'DELIVERY_CONTROL';

export type NotificationNoiseTrendPoint = {
  bucketStart: string;
  cohortSize: number;
  volume: number;
  muteRate?: number | null;
  deduplicationRate?: number | null;
  actionConversionRate?: number | null;
};

export type NotificationNoiseFourEyesGovernance = {
  state: 'ENFORCED' | 'NOT_CONFIGURED' | 'UNAVAILABLE';
  publishedPolicyCount: number;
  draftPolicyCount: number;
  reviewerSeparationRequired: boolean;
  updatedAt?: string | null;
};

export type NotificationNoiseQuality = NotificationPartialState & {
  sufficientCohort: boolean;
  minimumCohortSize: number;
  observedCohortSize?: number | null;
  muteRate?: number | null;
  deduplicationRate?: number | null;
  actionConversionRate?: number | null;
  fatigueExposedUsers?: number | null;
  noisyTypes: NotificationNoiseTypeMetric[];
  trend: NotificationNoiseTrendPoint[];
  fourEyes: NotificationNoiseFourEyesGovernance;
  range: NotificationNoiseTimeRange;
  windowStart: string;
  generatedAt: string;
};

export type NotificationNoiseQualityQuery = {
  range?: NotificationNoiseTimeRange;
  query?: string;
  severity?: NotificationNoiseFindingSeverity;
  risk?: NotificationNoiseRisk;
};

function headers(idempotencyKey: string): Record<string, string> {
  const normalized = idempotencyKey.trim();
  if (!normalized) throw new Error('Notification attention mutations require an idempotency key.');
  return { 'Idempotency-Key': normalized };
}

export function listNotificationAttentionRules(
  signal?: AbortSignal
): Promise<NotificationAttentionRuleCollection> {
  return axiosInstance
    .get<ApiResponse<NotificationAttentionRuleCollection>>(`${BASE}/me/attention-rules`, { signal })
    .then((response) => response.data.data);
}

export function listNotificationAttentionContexts(
  input: {
    kind: NotificationAttentionDiscoverableScopeKind;
    query?: string;
    limit?: number;
  },
  signal?: AbortSignal
): Promise<NotificationAttentionContextCollection> {
  const query = input.query?.trim() ?? '';
  if (query.length > 300) {
    throw new Error('Notification attention context search must be 300 characters or fewer.');
  }
  if (input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit < 1)) {
    throw new Error('Notification attention context limit must be a positive integer.');
  }
  const params = new URLSearchParams({ kind: input.kind });
  if (query) params.set('query', query);
  params.set('limit', String(Math.min(input.limit ?? 20, 50)));
  return axiosInstance
    .get<ApiResponse<NotificationAttentionContextCollection>>(
      `${BASE}/me/attention-contexts?${params.toString()}`,
      { signal }
    )
    .then((response) => response.data.data);
}

export function previewNotificationAttentionRule(
  input: NotificationAttentionRuleInput,
  signal?: AbortSignal
): Promise<NotificationAttentionRulePreview> {
  return axiosInstance
    .post<ApiResponse<NotificationAttentionRulePreview>, NotificationAttentionRuleInput>(
      `${BASE}/me/attention-rules/preview`,
      input,
      { signal }
    )
    .then((response) => response.data.data);
}

export function createNotificationAttentionRule(
  input: NotificationAttentionRuleInput & { idempotencyKey: string }
): Promise<NotificationAttentionRule> {
  const { idempotencyKey, ...body } = input;
  return axiosInstance
    .post<ApiResponse<NotificationAttentionRule>, NotificationAttentionRuleInput>(
      `${BASE}/me/attention-rules`,
      body,
      { headers: headers(idempotencyKey) }
    )
    .then((response) => response.data.data);
}

export function updateNotificationAttentionRule(
  ruleId: string,
  input: NotificationAttentionRuleInput & {
    expectedVersion: NotificationEntityVersion;
    idempotencyKey: string;
  }
): Promise<NotificationAttentionRule> {
  const { idempotencyKey, ...body } = input;
  return axiosInstance
    .put<ApiResponse<NotificationAttentionRule>, typeof body>(
      `${BASE}/me/attention-rules/${encodeURIComponent(ruleId)}`,
      body,
      { headers: headers(idempotencyKey) }
    )
    .then((response) => response.data.data);
}

export async function deleteNotificationAttentionRule(
  ruleId: string,
  input: { expectedVersion: NotificationEntityVersion; idempotencyKey: string }
): Promise<void> {
  const query = new URLSearchParams({ expectedVersion: input.expectedVersion });
  await axiosInstance.delete(
    `/api/notifications/v1/me/attention-rules/${encodeURIComponent(ruleId)}?${query.toString()}`,
    { headers: headers(input.idempotencyKey) }
  );
}

export function getNotificationAttentionControls(
  notificationId: string,
  signal?: AbortSignal
): Promise<NotificationAttentionControls> {
  return axiosInstance
    .get<ApiResponse<NotificationAttentionControls>>(
      `${BASE}/inbox/${encodeURIComponent(notificationId)}/attention-controls`,
      { signal }
    )
    .then((response) => response.data.data);
}

export function applyNotificationAttentionControl(
  notificationId: string,
  input: NotificationAttentionControlInput & { idempotencyKey: string }
): Promise<NotificationAttentionRule> {
  const { idempotencyKey, ...body } = input;
  return axiosInstance
    .post<ApiResponse<NotificationAttentionRule>, NotificationAttentionControlInput>(
      `${BASE}/inbox/${encodeURIComponent(notificationId)}/attention-controls`,
      body,
      { headers: headers(idempotencyKey) }
    )
    .then((response) => response.data.data);
}

export function previewNotificationAttentionControl(
  notificationId: string,
  input: NotificationAttentionControlPreviewInput
): Promise<NotificationAttentionControlImpactPreview> {
  return axiosInstance
    .post<
      ApiResponse<NotificationAttentionControlImpactPreview>,
      NotificationAttentionControlPreviewInput
    >(`${BASE}/inbox/${encodeURIComponent(notificationId)}/attention-controls/preview`, input)
    .then((response) => response.data.data);
}

export function createNotificationTestDelivery(input: {
  channels: NotificationChannel[];
  idempotencyKey: string;
}): Promise<NotificationTestDelivery> {
  return axiosInstance
    .post<ApiResponse<NotificationTestDelivery>, { channels: NotificationChannel[] }>(
      `${BASE}/me/test-deliveries`,
      { channels: [...new Set(input.channels)] },
      { headers: headers(input.idempotencyKey) }
    )
    .then((response) => response.data.data);
}

export function getNotificationTestDelivery(
  testId: string,
  signal?: AbortSignal
): Promise<NotificationTestDelivery> {
  return axiosInstance
    .get<ApiResponse<NotificationTestDelivery>>(
      `${BASE}/me/test-deliveries/${encodeURIComponent(testId)}`,
      { signal }
    )
    .then((response) => response.data.data);
}

export function getNotificationNoiseQuality(
  input: NotificationNoiseQualityQuery = {},
  signal?: AbortSignal
): Promise<NotificationNoiseQuality> {
  const query = input.query?.trim();
  if (query && query.length > 120) {
    throw new Error('Notification quality search must be 120 characters or fewer.');
  }
  const params = new URLSearchParams();
  if (input.range) params.set('range', input.range);
  if (query) params.set('query', query);
  if (input.severity) params.set('severity', input.severity);
  if (input.risk) params.set('risk', input.risk);
  const suffix = params.size ? `?${params.toString()}` : '';
  return axiosInstance
    .get<ApiResponse<NotificationNoiseQuality>>(`${BASE}/admin/noise-quality${suffix}`, { signal })
    .then((response) => response.data.data);
}
