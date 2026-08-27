import { axiosInstance } from '../axios-instance';
import { HttpError } from '../http-error';

import type { ApiResponse } from '../types';

export const NOTIFICATION_API_BASE = '/api/notifications/v1';
export const NOTIFICATION_LIVE_EVENT = 'dwp:notification-changed';
export const NOTIFICATION_CONNECTION_STATE_EVENT = 'dwp:notification-connection-state';
export const NOTIFICATION_SYNC_RESET_EVENT = 'dwp:notification-sync-reset-required';

export const NOTIFICATION_API_CAPABILITIES = {
  bulkTriage: true,
  unsave: true,
  restore: true,
  effectiveSettings: true,
  tenantAdmin: true,
} as const;

export type NotificationChangeCursor = string;
export type NotificationDecimalVersion = string;
export type NotificationChangeVersion = NotificationDecimalVersion;
export type NotificationCounterVersion = NotificationDecimalVersion;
export type NotificationEntityVersion = NotificationDecimalVersion;

export type NotificationView = 'PRIORITY' | 'ALL' | 'MENTIONS' | 'SAVED' | 'SNOOZED' | 'DONE';
export type NotificationPriority = 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
export type NotificationInterruptionLevel = 'PASSIVE' | 'ACTIVE' | 'TIME_SENSITIVE' | 'CRITICAL';
export type NotificationChannel =
  'IN_APP' | 'EMAIL' | 'WEB_PUSH' | 'MOBILE_PUSH' | 'TEAMS' | 'SLACK';
export type NotificationCapabilities = {
  enabledChannels: NotificationChannel[];
  unavailableChannels: NotificationChannel[];
  canonicalStore: 'POSTGRESQL';
  realtimeTransport: 'SSE_HINT_WITH_DURABLE_SYNC';
  externalDeliveryState: 'ENABLED' | 'DISABLED';
  generatedAt: string;
};
export type NotificationDeliveryMode = 'IMMEDIATE' | 'DAILY_DIGEST' | 'WEEKLY_DIGEST' | 'MUTED';
export type NotificationTriageAction =
  'READ' | 'UNREAD' | 'SAVE' | 'UNSAVE' | 'COMPLETE' | 'RESTORE' | 'SNOOZE';
export type NotificationReasonKind =
  'DIRECT' | 'MENTION' | 'ROLE' | 'ORGANIZATION' | 'SUBSCRIPTION' | 'MANDATORY_POLICY';

export type NotificationSource = {
  appKey: string;
  appName: string;
  iconKey?: string | null;
  accent?: string | null;
};

export type NotificationReason = {
  kind: NotificationReasonKind;
  label: string;
  detail?: string | null;
};

export type NotificationAction = {
  actionKey: string;
  label: string;
  href?: string | null;
  enabled: boolean;
  disabledReason?: string | null;
  primary?: boolean;
};

export type NotificationItem = {
  notificationId: string;
  threadKey?: string | null;
  threadCount: number;
  source: NotificationSource;
  typeKey: string;
  title: string;
  preview?: string | null;
  actorLabel?: string | null;
  priority: NotificationPriority;
  interruptionLevel?: NotificationInterruptionLevel;
  reason: NotificationReason;
  receivedAt: string;
  lastActivityAt: string;
  dueAt?: string | null;
  readAt?: string | null;
  savedAt?: string | null;
  completedAt?: string | null;
  snoozedUntil?: string | null;
  actionable: boolean;
  sensitive: boolean;
  actions: NotificationAction[];
  version: NotificationEntityVersion;
};

export type NotificationTimelineEntry = {
  entryId: string;
  title: string;
  detail?: string | null;
  occurredAt: string;
  actorLabel?: string | null;
};

export type NotificationDetail = {
  item: NotificationItem;
  reasonExplanation: string;
  absoluteOccurredAt: string;
  targetState: 'AVAILABLE' | 'DELETED' | 'EXPIRED' | 'FORBIDDEN';
  targetStateReason?: string | null;
  timeline: NotificationTimelineEntry[];
};

export type NotificationTargetResolution = {
  notificationId: string;
  targetState: 'AVAILABLE';
  action: NotificationAction;
};

export type NotificationPartialState = {
  partial: boolean;
  unavailableSources: string[];
  message?: string | null;
};

export type NotificationInboxPage = NotificationPartialState & {
  items: NotificationItem[];
  nextCursor?: string | null;
  hasMore: boolean;
  approximateTotal?: number | null;
  changeVersion: NotificationChangeVersion;
};

export type NotificationViewCounts = Record<NotificationView, number>;

export type NotificationSummary = NotificationPartialState & {
  actionableUnread: number;
  totalUnread: number;
  viewCounts: NotificationViewCounts;
  changeVersion: NotificationChangeVersion;
  counterVersion: NotificationCounterVersion;
  generatedAt: string;
};

export type NotificationSyncResult = {
  changeVersion: NotificationChangeVersion;
  counterVersion: NotificationCounterVersion;
  changedIds: string[];
  deletedIds: string[];
  hasMore: boolean;
  summary: NotificationSummary;
};

export type NotificationLiveSignal = {
  changeVersion: NotificationChangeVersion;
  counterVersion?: NotificationCounterVersion;
  changedIds: string[];
  arrivalIds: string[];
};

export type NotificationConnectionStateSignal = {
  state: 'live' | 'polling';
};

export type NotificationSyncResetSignal = {
  errorCode: 'NOTIFICATION_SYNC_RESET_REQUIRED';
};

export type NotificationInboxQuery = {
  view: NotificationView;
  cursor?: string | null;
  limit?: number;
  query?: string;
  appKey?: string;
  priority?: NotificationPriority | 'ALL';
  readState?: 'ALL' | 'UNREAD' | 'READ';
  reason?: NotificationReasonKind | 'ALL';
  from?: string;
  to?: string;
};

export type NotificationSyncQuery = {
  after?: NotificationChangeCursor | null;
  limit?: number;
};

export type NotificationSyncOutcome =
  | { kind: 'SYNCED'; data: NotificationSyncResult }
  | { kind: 'RESET_REQUIRED'; error: NotificationCursorResetError };

export type NotificationTriageResult = {
  item: NotificationItem;
  changeVersion: NotificationChangeVersion;
  summary: NotificationSummary;
};

export type NotificationBulkItemResult = {
  notificationId: string;
  outcome: 'APPLIED' | 'ALREADY_APPLIED' | 'CONFLICT' | 'FORBIDDEN' | 'NOT_FOUND';
  item?: NotificationItem | null;
  message?: string | null;
};

export type NotificationBulkResult = {
  results: NotificationBulkItemResult[];
  changeVersion: NotificationChangeVersion;
  summary: NotificationSummary;
  undoToken?: string | null;
  undoExpiresAt?: string | null;
};

export type NotificationQuietHours = {
  enabled: boolean;
  start: string;
  end: string;
  timeZone: string;
  days: number[];
  allowUrgentBypass: boolean;
};

export type NotificationDigest = {
  mode: 'OFF' | 'DAILY' | 'WEEKLY';
  deliveryTime: string;
  dayOfWeek?: number | null;
};

export type NotificationPresentation = {
  bannerMode: 'SMART' | 'HIGH_PRIORITY_ONLY' | 'OFF';
  previewMode: 'FULL' | 'TITLE_ONLY' | 'HIDDEN';
};

export type NotificationDeliveryProfile = {
  channels: Record<NotificationChannel, boolean>;
  quietHours: NotificationQuietHours;
  digest: NotificationDigest;
  presentation: NotificationPresentation;
  version: NotificationEntityVersion;
  updatedAt: string;
};

export type NotificationDeliveryProfileUpdate = Pick<
  NotificationDeliveryProfile,
  'channels' | 'quietHours' | 'digest' | 'presentation' | 'version'
>;

export type NotificationManagedValue<T> = {
  effectiveValue: T;
  source: 'USER' | 'TENANT_POLICY' | 'PROVIDER_POLICY' | 'SYSTEM_DEFAULT';
  managed: boolean;
  exceptionAllowed: boolean;
  ownerLabel?: string | null;
};

export type NotificationTypeSetting = {
  typeKey: string;
  typeName: string;
  description?: string | null;
  mode: NotificationManagedValue<NotificationDeliveryMode>;
  channels: Partial<Record<NotificationChannel, NotificationManagedValue<boolean>>>;
  mandatory: boolean;
  quietHoursBypass: boolean;
  ruleId?: string | null;
  ruleVersion?: NotificationEntityVersion | null;
};

export type NotificationAppSetting = {
  appKey: string;
  appName: string;
  iconKey?: string | null;
  types: NotificationTypeSetting[];
};

export type NotificationEffectiveSettings = NotificationPartialState & {
  globalChannels: Partial<Record<NotificationChannel, NotificationManagedValue<boolean>>>;
  apps: NotificationAppSetting[];
  generatedAt: string;
};

export type NotificationSubscriptionRuleInput = {
  appKey: string;
  typeKey: string;
  mode: NotificationDeliveryMode;
  channels: Partial<Record<NotificationChannel, boolean>>;
  expectedVersion?: NotificationEntityVersion | null;
};

export type NotificationSubscriptionRule = NotificationSubscriptionRuleInput & {
  ruleId: string;
  version: NotificationEntityVersion;
  updatedAt: string;
};

export type NotificationUnavailableCapability = keyof typeof NOTIFICATION_API_CAPABILITIES;

type NotificationErrorEnvelope = {
  errorCode?: unknown;
  message?: unknown;
  correlationId?: unknown;
};

export class NotificationCursorResetError extends Error {
  readonly code = 'NOTIFICATION_SYNC_RESET_REQUIRED';

  constructor(
    message: string,
    public readonly correlationId?: string
  ) {
    super(message);
    this.name = 'NotificationCursorResetError';
  }
}

export class NotificationCapabilityUnavailableError extends Error {
  readonly code = 'NOTIFICATION_CAPABILITY_DISABLED';

  constructor(public readonly capability: NotificationUnavailableCapability) {
    super(`Notification capability is not exposed by the current server: ${capability}.`);
    this.name = 'NotificationCapabilityUnavailableError';
  }
}

export function isNotificationCursorResetError(
  error: unknown
): error is NotificationCursorResetError {
  return error instanceof NotificationCursorResetError;
}

export function isNotificationCapabilityUnavailableError(
  error: unknown
): error is NotificationCapabilityUnavailableError {
  return error instanceof NotificationCapabilityUnavailableError;
}

export function toNotificationApiError(error: unknown): Error {
  if (error instanceof NotificationCursorResetError) return error;
  if (error instanceof HttpError && error.status === 409) {
    const envelope =
      error.details && typeof error.details === 'object'
        ? (error.details as NotificationErrorEnvelope)
        : null;
    if (envelope?.errorCode === 'NOTIFICATION_SYNC_RESET_REQUIRED') {
      return new NotificationCursorResetError(
        typeof envelope.message === 'string' ? envelope.message : error.message,
        typeof envelope.correlationId === 'string' ? envelope.correlationId : undefined
      );
    }
  }
  return error instanceof Error ? error : new Error('Unknown notification request failure.');
}

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

export function createNotificationIdempotencyKey(scope = 'notification'): string {
  const randomId = globalThis.crypto?.randomUUID?.();
  if (randomId) return `${scope}:${randomId}`;
  return `${scope}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const DECIMAL_VERSION_PATTERN = /^(?:0|[1-9]\d*)$/u;
const LIVE_SIGNAL_KEYS = new Set(['changeVersion', 'counterVersion', 'changedIds', 'arrivalIds']);
const SYNC_RESET_SIGNAL_KEYS = new Set(['errorCode']);
const CONNECTION_STATE_SIGNAL_KEYS = new Set(['state']);
let currentNotificationConnectionState: NotificationConnectionStateSignal['state'] = 'polling';

export function normalizeNotificationDecimalVersion(
  value: unknown
): NotificationDecimalVersion | null {
  if (typeof value !== 'string') return null;
  return DECIMAL_VERSION_PATTERN.test(value) ? value : null;
}

function requireNotificationDecimalVersion(
  value: NotificationDecimalVersion,
  field: string
): NotificationDecimalVersion {
  if (typeof value !== 'string' || normalizeNotificationDecimalVersion(value) !== value) {
    throw new Error(`${field} must be a canonical decimal string.`);
  }
  return value;
}

export function parseNotificationLiveSignal(value: unknown): NotificationLiveSignal | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !LIVE_SIGNAL_KEYS.has(key))) return null;
  const changeVersion = normalizeNotificationDecimalVersion(record.changeVersion);
  const counterVersion =
    record.counterVersion === undefined
      ? undefined
      : normalizeNotificationDecimalVersion(record.counterVersion);
  if (!changeVersion || (record.counterVersion !== undefined && !counterVersion)) return null;
  const changedIds = record.changedIds ?? [];
  const arrivalIds = record.arrivalIds ?? [];
  if (
    !Array.isArray(changedIds) ||
    changedIds.some((id) => typeof id !== 'string' || !UUID_PATTERN.test(id)) ||
    !Array.isArray(arrivalIds) ||
    arrivalIds.some((id) => typeof id !== 'string' || !UUID_PATTERN.test(id)) ||
    arrivalIds.some((id) => !changedIds.includes(id))
  ) {
    return null;
  }
  return {
    changeVersion,
    ...(counterVersion ? { counterVersion } : {}),
    changedIds: changedIds as string[],
    arrivalIds: arrivalIds as string[],
  };
}

export function createNotificationLiveEventDetail(value: unknown): NotificationLiveSignal | null {
  return parseNotificationLiveSignal(value);
}

export function parseNotificationConnectionStateSignal(
  value: unknown
): NotificationConnectionStateSignal | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !CONNECTION_STATE_SIGNAL_KEYS.has(key))) return null;
  return record.state === 'live' || record.state === 'polling' ? { state: record.state } : null;
}

export function getNotificationConnectionState(): NotificationConnectionStateSignal['state'] {
  return currentNotificationConnectionState;
}

export function publishNotificationConnectionState(value: unknown): void {
  const signal = parseNotificationConnectionStateSignal(value);
  if (!signal) return;
  currentNotificationConnectionState = signal.state;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(NOTIFICATION_CONNECTION_STATE_EVENT, { detail: signal }));
  }
}

export function parseNotificationSyncResetSignal(
  value: unknown
): NotificationSyncResetSignal | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !SYNC_RESET_SIGNAL_KEYS.has(key))) return null;
  return record.errorCode === 'NOTIFICATION_SYNC_RESET_REQUIRED'
    ? { errorCode: 'NOTIFICATION_SYNC_RESET_REQUIRED' }
    : null;
}

export function getNotificationSummary(signal?: AbortSignal): Promise<NotificationSummary> {
  return axiosInstance
    .get<ApiResponse<NotificationSummary>>(`${NOTIFICATION_API_BASE}/summary`, { signal })
    .then((response) => response.data.data);
}

export function getNotificationCapabilities(
  signal?: AbortSignal
): Promise<NotificationCapabilities> {
  return axiosInstance
    .get<ApiResponse<NotificationCapabilities>>(`${NOTIFICATION_API_BASE}/capabilities`, {
      signal,
    })
    .then((response) => response.data.data);
}

export function getNotificationSync(
  input: NotificationSyncQuery,
  signal?: AbortSignal
): Promise<NotificationSyncResult> {
  return axiosInstance
    .get<ApiResponse<NotificationSyncResult>>(
      `${NOTIFICATION_API_BASE}/sync${queryString({
        after: input.after,
        limit: boundedLimit(input.limit, 100),
      })}`,
      { signal }
    )
    .then((response) => response.data.data)
    .catch((error: unknown) => Promise.reject(toNotificationApiError(error)));
}

export async function getNotificationSyncOutcome(
  input: NotificationSyncQuery,
  signal?: AbortSignal
): Promise<NotificationSyncOutcome> {
  try {
    return { kind: 'SYNCED', data: await getNotificationSync(input, signal) };
  } catch (error) {
    if (isNotificationCursorResetError(error)) return { kind: 'RESET_REQUIRED', error };
    throw error;
  }
}

export function getNotificationInbox(
  input: NotificationInboxQuery,
  signal?: AbortSignal
): Promise<NotificationInboxPage> {
  const query = queryString({
    view: input.view,
    cursor: input.cursor,
    limit: boundedLimit(input.limit, 30),
    query: input.query?.trim(),
    appKey: input.appKey,
    priority: input.priority === 'ALL' ? undefined : input.priority,
    readState: input.readState === 'ALL' ? undefined : input.readState,
    reason: input.reason === 'ALL' ? undefined : input.reason,
    from: input.from,
    to: input.to,
  });
  return axiosInstance
    .get<ApiResponse<NotificationInboxPage>>(`${NOTIFICATION_API_BASE}/inbox${query}`, { signal })
    .then((response) => response.data.data);
}

export function getNotificationDetail(
  notificationId: string,
  signal?: AbortSignal
): Promise<NotificationDetail> {
  return axiosInstance
    .get<ApiResponse<NotificationDetail>>(
      `${NOTIFICATION_API_BASE}/inbox/${encodeURIComponent(notificationId)}`,
      { signal }
    )
    .then((response) => response.data.data);
}

export function resolveNotificationTarget(
  notificationId: string,
  signal?: AbortSignal
): Promise<NotificationTargetResolution> {
  return axiosInstance
    .get<ApiResponse<NotificationTargetResolution>>(
      `${NOTIFICATION_API_BASE}/inbox/${encodeURIComponent(notificationId)}/target`,
      { signal }
    )
    .then((response) => response.data.data);
}

export const NOTIFICATION_SERVER_TRIAGE_ACTIONS = [
  'READ',
  'UNREAD',
  'SAVE',
  'UNSAVE',
  'COMPLETE',
  'RESTORE',
  'SNOOZE',
] as const;

export type NotificationServerTriageAction = (typeof NOTIFICATION_SERVER_TRIAGE_ACTIONS)[number];

const ACTION_PATH: Record<NotificationServerTriageAction, string> = {
  READ: 'read',
  UNREAD: 'unread',
  SAVE: 'save',
  UNSAVE: 'unsave',
  COMPLETE: 'complete',
  RESTORE: 'restore',
  SNOOZE: 'snooze',
};

export function isNotificationTriageActionSupported(
  action: NotificationTriageAction
): action is NotificationServerTriageAction {
  return (NOTIFICATION_SERVER_TRIAGE_ACTIONS as readonly NotificationTriageAction[]).includes(
    action
  );
}

export function applyNotificationTriage(
  notificationId: string,
  input: {
    action: NotificationTriageAction;
    expectedVersion: NotificationEntityVersion;
    snoozedUntil?: string;
    idempotencyKey: string;
  }
): Promise<NotificationTriageResult> {
  if (!isNotificationTriageActionSupported(input.action)) {
    const capability = input.action === 'UNSAVE' ? 'unsave' : 'restore';
    return Promise.reject(new NotificationCapabilityUnavailableError(capability));
  }
  if (input.action === 'SNOOZE' && !input.snoozedUntil) {
    throw new Error('Snooze actions require snoozedUntil.');
  }
  const body = {
    expectedVersion: requireNotificationDecimalVersion(input.expectedVersion, 'expectedVersion'),
    ...(input.action === 'SNOOZE' ? { snoozedUntil: input.snoozedUntil } : {}),
  };
  return axiosInstance
    .post<ApiResponse<NotificationTriageResult>, typeof body>(
      `${NOTIFICATION_API_BASE}/inbox/${encodeURIComponent(notificationId)}/${ACTION_PATH[input.action]}`,
      body,
      { headers: mutationHeaders(input.idempotencyKey) }
    )
    .then((response) => response.data.data);
}

export function applyNotificationBulkAction(input: {
  notificationIds: string[];
  action: NotificationTriageAction;
  snoozedUntil?: string;
  idempotencyKey: string;
}): Promise<NotificationBulkResult> {
  const notificationIds = [
    ...new Set(input.notificationIds.map((id) => id.trim()).filter(Boolean)),
  ];
  if (notificationIds.length === 0) throw new Error('Select at least one notification.');
  if (notificationIds.length > 100)
    throw new Error('Bulk notification actions are limited to 100 items.');
  if (input.action === 'SNOOZE' && !input.snoozedUntil) {
    throw new Error('Bulk snooze actions require snoozedUntil.');
  }
  const body = {
    notificationIds,
    action: input.action,
    ...(input.action === 'SNOOZE' ? { snoozedUntil: input.snoozedUntil } : {}),
  };
  return axiosInstance
    .post<ApiResponse<NotificationBulkResult>, typeof body>(
      `${NOTIFICATION_API_BASE}/inbox/bulk-actions`,
      body,
      { headers: mutationHeaders(input.idempotencyKey) }
    )
    .then((response) => response.data.data);
}

export function undoNotificationBulkAction(
  undoToken: string,
  idempotencyKey: string
): Promise<NotificationBulkResult> {
  return axiosInstance
    .post<ApiResponse<NotificationBulkResult>>(
      `${NOTIFICATION_API_BASE}/inbox/bulk-actions/${encodeURIComponent(undoToken)}/undo`,
      undefined,
      { headers: mutationHeaders(idempotencyKey) }
    )
    .then((response) => response.data.data);
}

export function getNotificationDeliveryProfile(
  signal?: AbortSignal
): Promise<NotificationDeliveryProfile> {
  return axiosInstance
    .get<ApiResponse<NotificationDeliveryProfile>>(`${NOTIFICATION_API_BASE}/me/delivery-profile`, {
      signal,
    })
    .then((response) => response.data.data);
}

export function updateNotificationDeliveryProfile(
  input: NotificationDeliveryProfileUpdate,
  idempotencyKey: string
): Promise<NotificationDeliveryProfile> {
  const body = {
    ...input,
    version: requireNotificationDecimalVersion(input.version, 'version'),
  };
  return axiosInstance
    .put<ApiResponse<NotificationDeliveryProfile>, typeof body>(
      `${NOTIFICATION_API_BASE}/me/delivery-profile`,
      body,
      { headers: mutationHeaders(idempotencyKey) }
    )
    .then((response) => response.data.data);
}

export function getNotificationSubscriptionRules(
  signal?: AbortSignal
): Promise<NotificationSubscriptionRule[]> {
  return axiosInstance
    .get<ApiResponse<NotificationSubscriptionRule[]>>(
      `${NOTIFICATION_API_BASE}/me/subscription-rules`,
      { signal }
    )
    .then((response) => response.data.data);
}

export function getNotificationEffectiveSettings(
  signal?: AbortSignal
): Promise<NotificationEffectiveSettings> {
  return axiosInstance
    .get<ApiResponse<NotificationEffectiveSettings>>(
      `${NOTIFICATION_API_BASE}/me/effective-settings`,
      { signal }
    )
    .then((response) => response.data.data);
}

export function putNotificationSubscriptionRule(
  ruleId: string,
  input: NotificationSubscriptionRuleInput,
  idempotencyKey: string
): Promise<NotificationSubscriptionRule> {
  const body = {
    ...input,
    ...(input.expectedVersion == null
      ? {}
      : {
          expectedVersion: requireNotificationDecimalVersion(
            input.expectedVersion,
            'expectedVersion'
          ),
        }),
  };
  return axiosInstance
    .put<ApiResponse<NotificationSubscriptionRule>, typeof body>(
      `${NOTIFICATION_API_BASE}/me/subscription-rules/${encodeURIComponent(ruleId)}`,
      body,
      { headers: mutationHeaders(idempotencyKey) }
    )
    .then((response) => response.data.data);
}

export function deleteNotificationSubscriptionRule(
  ruleId: string,
  expectedVersion: NotificationEntityVersion,
  idempotencyKey: string
): Promise<void> {
  const query = queryString({
    expectedVersion: requireNotificationDecimalVersion(expectedVersion, 'expectedVersion'),
  });
  return axiosInstance
    .delete<ApiResponse<void>>(
      `${NOTIFICATION_API_BASE}/me/subscription-rules/${encodeURIComponent(ruleId)}${query}`,
      { headers: mutationHeaders(idempotencyKey) }
    )
    .then(() => undefined);
}

export * from './notification-admin-api';
