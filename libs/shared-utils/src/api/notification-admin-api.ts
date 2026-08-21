import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import type {
  NotificationChannel,
  NotificationEntityVersion,
  NotificationPartialState,
  NotificationPriority,
} from './notification-api';

const NOTIFICATION_API_BASE = '/api/notifications/v1';

export type NotificationAdminMetric = {
  key: string;
  label: string;
  value: number;
  unit?: string | null;
  baseline?: number | null;
  state: 'HEALTHY' | 'ATTENTION' | 'CRITICAL' | 'UNKNOWN';
};

export type NotificationAdminTrendPoint = {
  bucket: string;
  created: number;
  actionable: number;
  failed: number;
  muted: number;
};

export type NotificationOperationalFinding = {
  findingId: string;
  category: 'CONTRACT' | 'POLICY' | 'TEMPLATE' | 'DELIVERY' | 'NOISE' | 'SECURITY';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  detail: string;
  count: number;
  ownerLabel?: string | null;
  detectedAt: string;
  href?: string | null;
};

export type NotificationAdminOverview = NotificationPartialState & {
  generatedAt: string;
  metrics: NotificationAdminMetric[];
  trend: NotificationAdminTrendPoint[];
  findings: NotificationOperationalFinding[];
};

export type NotificationContractState =
  'DRAFT' | 'IN_REVIEW' | 'ACTIVE' | 'DEPRECATED' | 'RETIRED' | 'QUARANTINED';

export type NotificationTypeContract = {
  contractId: string;
  typeKey: string;
  displayName: string;
  description?: string | null;
  appKey: string;
  appName: string;
  ownerLabel: string;
  sourceEventType: string;
  priority: NotificationPriority;
  channels: NotificationChannel[];
  mandatory: boolean;
  state: NotificationContractState;
  contractHealth: 'HEALTHY' | 'ATTENTION' | 'BROKEN';
  volume24Hours: number;
  schemaVersion: number;
  version: NotificationEntityVersion;
  updatedAt: string;
};

export type NotificationTypeContractPage = NotificationPartialState & {
  items: NotificationTypeContract[];
  nextCursor?: string | null;
  hasMore: boolean;
};

export type NotificationPolicyScope = 'APP' | 'TYPE';
export type NotificationPolicySource = 'PROVIDER_POLICY' | 'TENANT_POLICY';
export type NotificationPolicyState = 'DRAFT' | 'PUBLISHED' | 'PREVIEW';
export type NotificationPolicyDefaultMode = 'IMMEDIATE' | 'DIGEST' | 'MUTED';
export type NotificationPolicyDigestMode = 'IMMEDIATE' | 'DAILY' | 'WEEKLY';

export type NotificationPolicyChannelRule = {
  channel: NotificationChannel;
  enabled: boolean;
  defaultMode: NotificationPolicyDefaultMode;
  userOverridable: boolean;
  maxPerWindow?: number | null;
};

export type TenantNotificationPolicy = {
  policyId: string;
  scopeType: NotificationPolicyScope;
  scopeKey: string;
  scopeLabel: string;
  source: NotificationPolicySource;
  state: NotificationPolicyState;
  mandatory: boolean;
  quietHoursBypass: boolean;
  digestMode: NotificationPolicyDigestMode;
  channels: NotificationPolicyChannelRule[];
  changeReason?: string | null;
  createdBy?: number | null;
  approvedBy?: number | null;
  approvedAt?: string | null;
  version: NotificationEntityVersion;
  createdAt: string;
};

export type TenantNotificationPolicyPage = {
  effectivePolicies: TenantNotificationPolicy[];
  drafts: TenantNotificationPolicy[];
  generatedAt: string;
};

export type TenantNotificationPolicyPreview = {
  currentPolicy?: TenantNotificationPolicy | null;
  proposedPolicy: TenantNotificationPolicy;
  affectedTypeCount: number;
  observedRecipients30Days: number;
  riskFlags: string[];
};

export type TenantNotificationPolicyChangeInput = {
  scopeType: NotificationPolicyScope;
  scopeKey: string;
  mandatory: boolean;
  quietHoursBypass: boolean;
  digestMode: NotificationPolicyDigestMode;
  channels: NotificationPolicyChannelRule[];
  changeReason: string;
  expectedVersion: NotificationEntityVersion;
};

export type NotificationPolicyPublishInput = {
  expectedVersion: NotificationEntityVersion;
  approvalReason: string;
};

export type NotificationTemplateContent = {
  title: string;
  preview: string;
  body: string;
  actionLabel: string;
};

export type NotificationTemplateRevision = {
  revisionId: string;
  typeVersionId: string;
  typeKey: string;
  appKey: string;
  channel: NotificationChannel;
  locale: string;
  state: 'DRAFT' | 'PUBLISHED' | 'RETIRED';
  revision: number;
  content: NotificationTemplateContent;
  checksum: string;
  changeReason: string;
  createdBy?: number | null;
  approvedBy?: number | null;
  approvedAt?: string | null;
  approvalReason?: string | null;
  version: NotificationEntityVersion;
  createdAt: string;
};

export type NotificationTemplateVariant = {
  typeVersionId: string;
  typeKey: string;
  displayName: string;
  appKey: string;
  appName: string;
  channel: NotificationChannel;
  locale: string;
  allowedVariables: string[];
  version: NotificationEntityVersion;
  providerDefault: NotificationTemplateContent;
  publishedOverride?: NotificationTemplateRevision | null;
  draft?: NotificationTemplateRevision | null;
  history: NotificationTemplateRevision[];
};

export type NotificationTemplateWorkspace = {
  items: NotificationTemplateVariant[];
  generatedAt: string;
};

export type NotificationTemplatePreviewInput = NotificationTemplateContent & {
  typeVersionId: string;
  channel: NotificationChannel;
  locale: string;
  sampleData: Record<string, string>;
};

export type NotificationTemplatePreview = {
  rendered: NotificationTemplateContent;
  variables: string[];
  warnings: string[];
};

export type NotificationTemplateDraftInput = NotificationTemplateContent & {
  typeVersionId: string;
  channel: NotificationChannel;
  locale: string;
  changeReason: string;
  expectedVersion: NotificationEntityVersion;
};

export type NotificationTemplateDecisionInput = {
  expectedVersion: NotificationEntityVersion;
  reason: string;
};

export type NotificationDeliveryLane = {
  lane: 'CRITICAL' | 'INTERACTIVE' | 'BULK';
  queued: number;
  oldestAgeSeconds: number;
  throughputPerMinute: number;
  failureRatePercent: number;
  state: 'HEALTHY' | 'DEGRADED' | 'PAUSED';
};

export type NotificationProviderHealth = {
  providerKey: string;
  displayName: string;
  channel: NotificationChannel;
  state: 'HEALTHY' | 'DEGRADED' | 'OUTAGE' | 'DISABLED';
  successRatePercent: number;
  p95LatencyMs: number;
  circuitState: 'CLOSED' | 'HALF_OPEN' | 'OPEN';
  lastCheckedAt: string;
};

export type NotificationDeliveryOperations = NotificationPartialState & {
  generatedAt: string;
  lanes: NotificationDeliveryLane[];
  providers: NotificationProviderHealth[];
  retryQueue: number;
  deadLetterQueue: number;
  unknownOutcomes: number;
  findings: NotificationOperationalFinding[];
};

export type NotificationSuppressionScope = 'TENANT' | 'APP' | 'TYPE';
export type NotificationSuppressionChannel = NotificationChannel | 'ALL';

export type NotificationSuppressionCommand = {
  scopeType: NotificationSuppressionScope;
  scopeKey: string;
  channel: NotificationSuppressionChannel;
  startsAt?: string | null;
  expiresAt: string;
  criticalBypass: boolean;
  reason: string;
};

export type NotificationSuppression = NotificationSuppressionCommand & {
  suppressionId: string;
  createdBy: number;
  revokedAt?: string | null;
  revokedBy?: number | null;
  revokeReason?: string | null;
  version: NotificationEntityVersion;
  createdAt: string;
  updatedAt: string;
};

export type NotificationSuppressionPage = {
  items: NotificationSuppression[];
  generatedAt: string;
};

export type NotificationSuppressionPreview = NotificationSuppressionCommand & {
  startsAt: string;
  affectedTypeCount: number;
  observedNotifications7Days: number;
  criticalBypassCandidates7Days: number;
  overlappingSuppressionCount: number;
  matchedTypeKeys: string[];
  riskFlags: string[];
  generatedAt: string;
};

export type NotificationSuppressionRevokeInput = {
  expectedVersion: NotificationEntityVersion;
  reason: string;
};

function boundedLimit(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(100, Math.trunc(value)));
}

function queryString(values: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const serialized = search.toString();
  return serialized ? `?${serialized}` : '';
}

function mutationHeaders(idempotencyKey: string): Record<string, string> {
  const trimmed = idempotencyKey.trim();
  if (!trimmed) throw new Error('Notification mutation requires an idempotency key.');
  return { 'Idempotency-Key': trimmed };
}

function requireDecimalVersion(value: NotificationEntityVersion, field: string): string {
  if (!/^(?:0|[1-9]\d*)$/u.test(value)) {
    throw new Error(`${field} must be a canonical decimal string.`);
  }
  return value;
}

export function getNotificationAdminOverview(
  signal?: AbortSignal
): Promise<NotificationAdminOverview> {
  return axiosInstance
    .get<ApiResponse<NotificationAdminOverview>>(`${NOTIFICATION_API_BASE}/admin/overview`, {
      signal,
    })
    .then((response) => response.data.data);
}

export function getNotificationTypeContracts(
  input: {
    cursor?: string | null;
    limit?: number;
    query?: string;
    state?: string;
    appKey?: string;
  },
  signal?: AbortSignal
): Promise<NotificationTypeContractPage> {
  const query = queryString({
    cursor: input.cursor,
    limit: boundedLimit(input.limit, 40),
    query: input.query?.trim(),
    state: input.state,
    appKey: input.appKey,
  });
  return axiosInstance
    .get<ApiResponse<NotificationTypeContractPage>>(
      `${NOTIFICATION_API_BASE}/admin/types${query}`,
      { signal }
    )
    .then((response) => response.data.data);
}

export function getNotificationDeliveryOperations(
  signal?: AbortSignal
): Promise<NotificationDeliveryOperations> {
  return axiosInstance
    .get<ApiResponse<NotificationDeliveryOperations>>(`${NOTIFICATION_API_BASE}/admin/operations`, {
      signal,
    })
    .then((response) => response.data.data);
}

export function getNotificationTenantPolicies(
  signal?: AbortSignal
): Promise<TenantNotificationPolicyPage> {
  return axiosInstance
    .get<ApiResponse<TenantNotificationPolicyPage>>(`${NOTIFICATION_API_BASE}/admin/policies`, {
      signal,
    })
    .then((response) => response.data.data);
}

export function previewNotificationTenantPolicy(
  input: TenantNotificationPolicyChangeInput,
  signal?: AbortSignal
): Promise<TenantNotificationPolicyPreview> {
  const body = {
    ...input,
    expectedVersion: requireDecimalVersion(input.expectedVersion, 'expectedVersion'),
  };
  return axiosInstance
    .post<ApiResponse<TenantNotificationPolicyPreview>, typeof body>(
      `${NOTIFICATION_API_BASE}/admin/policies/preview`,
      body,
      { signal }
    )
    .then((response) => response.data.data);
}

export function createNotificationTenantPolicyDraft(
  input: TenantNotificationPolicyChangeInput,
  idempotencyKey: string
): Promise<TenantNotificationPolicy> {
  const body = {
    ...input,
    expectedVersion: requireDecimalVersion(input.expectedVersion, 'expectedVersion'),
  };
  return axiosInstance
    .post<ApiResponse<TenantNotificationPolicy>, typeof body>(
      `${NOTIFICATION_API_BASE}/admin/policies/drafts`,
      body,
      { headers: mutationHeaders(idempotencyKey) }
    )
    .then((response) => response.data.data);
}

export function publishNotificationTenantPolicy(
  policyId: string,
  input: NotificationPolicyPublishInput,
  idempotencyKey: string
): Promise<TenantNotificationPolicy> {
  const body = {
    ...input,
    expectedVersion: requireDecimalVersion(input.expectedVersion, 'expectedVersion'),
  };
  return axiosInstance
    .post<ApiResponse<TenantNotificationPolicy>, typeof body>(
      `${NOTIFICATION_API_BASE}/admin/policies/${encodeURIComponent(policyId)}/publish`,
      body,
      { headers: mutationHeaders(idempotencyKey) }
    )
    .then((response) => response.data.data);
}

export function getNotificationTemplateWorkspace(
  signal?: AbortSignal
): Promise<NotificationTemplateWorkspace> {
  return axiosInstance
    .get<ApiResponse<NotificationTemplateWorkspace>>(`${NOTIFICATION_API_BASE}/admin/templates`, {
      signal,
    })
    .then((response) => response.data.data);
}

export function previewNotificationTemplate(
  input: NotificationTemplatePreviewInput,
  signal?: AbortSignal
): Promise<NotificationTemplatePreview> {
  return axiosInstance
    .post<ApiResponse<NotificationTemplatePreview>, NotificationTemplatePreviewInput>(
      `${NOTIFICATION_API_BASE}/admin/templates/preview`,
      input,
      { signal }
    )
    .then((response) => response.data.data);
}

export function createNotificationTemplateDraft(
  input: NotificationTemplateDraftInput,
  idempotencyKey: string
): Promise<NotificationTemplateRevision> {
  const body = {
    ...input,
    expectedVersion: requireDecimalVersion(input.expectedVersion, 'expectedVersion'),
  };
  return axiosInstance
    .post<ApiResponse<NotificationTemplateRevision>, typeof body>(
      `${NOTIFICATION_API_BASE}/admin/templates/drafts`,
      body,
      { headers: mutationHeaders(idempotencyKey) }
    )
    .then((response) => response.data.data);
}

export function publishNotificationTemplate(
  revisionId: string,
  input: NotificationTemplateDecisionInput,
  idempotencyKey: string
): Promise<NotificationTemplateRevision> {
  const body = {
    ...input,
    expectedVersion: requireDecimalVersion(input.expectedVersion, 'expectedVersion'),
  };
  return axiosInstance
    .post<ApiResponse<NotificationTemplateRevision>, typeof body>(
      `${NOTIFICATION_API_BASE}/admin/templates/${encodeURIComponent(revisionId)}/publish`,
      body,
      { headers: mutationHeaders(idempotencyKey) }
    )
    .then((response) => response.data.data);
}

export function retireNotificationTemplateDraft(
  revisionId: string,
  input: NotificationTemplateDecisionInput,
  idempotencyKey: string
): Promise<NotificationTemplateRevision> {
  const body = {
    ...input,
    expectedVersion: requireDecimalVersion(input.expectedVersion, 'expectedVersion'),
  };
  return axiosInstance
    .post<ApiResponse<NotificationTemplateRevision>, typeof body>(
      `${NOTIFICATION_API_BASE}/admin/templates/${encodeURIComponent(revisionId)}/retire`,
      body,
      { headers: mutationHeaders(idempotencyKey) }
    )
    .then((response) => response.data.data);
}

export function getNotificationSuppressions(
  signal?: AbortSignal
): Promise<NotificationSuppressionPage> {
  return axiosInstance
    .get<ApiResponse<NotificationSuppressionPage>>(`${NOTIFICATION_API_BASE}/admin/suppressions`, {
      signal,
    })
    .then((response) => response.data.data);
}

export function previewNotificationSuppression(
  input: NotificationSuppressionCommand,
  signal?: AbortSignal
): Promise<NotificationSuppressionPreview> {
  return axiosInstance
    .post<ApiResponse<NotificationSuppressionPreview>, NotificationSuppressionCommand>(
      `${NOTIFICATION_API_BASE}/admin/suppressions/preview`,
      input,
      { signal }
    )
    .then((response) => response.data.data);
}

export function createNotificationSuppression(
  input: NotificationSuppressionCommand,
  idempotencyKey: string
): Promise<NotificationSuppression> {
  return axiosInstance
    .post<ApiResponse<NotificationSuppression>, NotificationSuppressionCommand>(
      `${NOTIFICATION_API_BASE}/admin/suppressions`,
      input,
      { headers: mutationHeaders(idempotencyKey) }
    )
    .then((response) => response.data.data);
}

export function revokeNotificationSuppression(
  suppressionId: string,
  input: NotificationSuppressionRevokeInput,
  idempotencyKey: string
): Promise<NotificationSuppression> {
  const body = {
    ...input,
    expectedVersion: requireDecimalVersion(input.expectedVersion, 'expectedVersion'),
  };
  return axiosInstance
    .post<ApiResponse<NotificationSuppression>, typeof body>(
      `${NOTIFICATION_API_BASE}/admin/suppressions/${encodeURIComponent(suppressionId)}/revoke`,
      body,
      { headers: mutationHeaders(idempotencyKey) }
    )
    .then((response) => response.data.data);
}
