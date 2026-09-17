export type NotificationAttentionRuleKind = 'VIP' | 'FOLLOW_CONTEXT' | 'MUTE_SCOPE' | 'TOPIC_WATCH';

export type NotificationAttentionEffect = 'PRIORITIZE' | 'FOLLOW' | 'MUTE';

export type NotificationAttentionScopeKind =
  'APP_TYPE' | 'ACTOR' | 'THREAD' | 'RESOURCE' | 'TOPIC_TOKEN';

export type NotificationAttentionRuleState = 'ENABLED' | 'PAUSED' | 'EXPIRED';

export type NotificationAttentionRuleSource = 'USER' | 'TENANT_POLICY' | 'SYSTEM_DEFAULT';

export type NotificationAttentionPolicyLock = {
  ownerLabel: string;
  reason: string;
  exceptionAllowed: boolean;
};

export type NotificationAttentionConflict = {
  conflictId: string;
  severity: 'INFO' | 'WARNING' | 'BLOCKING';
  message: string;
};

export type NotificationAttentionRule = {
  ruleId: string;
  kind: NotificationAttentionRuleKind;
  label: string;
  scopeLabel: string;
  scopeKind: NotificationAttentionScopeKind;
  source: NotificationAttentionRuleSource;
  sourceLabel: string;
  effect: NotificationAttentionEffect;
  channelLabels: readonly string[];
  state: NotificationAttentionRuleState;
  startsAt?: string | null;
  expiresAt?: string | null;
  updatedAt: string;
  managed?: NotificationAttentionPolicyLock | null;
  conflicts?: readonly NotificationAttentionConflict[];
  actions: {
    canEdit: boolean;
    canDelete: boolean;
    canPause: boolean;
    canResume: boolean;
    canExtend: boolean;
  };
};

export type NotificationAttentionSummary = Record<NotificationAttentionRuleKind, number>;

export type NotificationAttentionRuleLimit = {
  used: number;
  limit: number;
  reached: boolean;
  message?: string;
};

export type NotificationAttentionDataState =
  | { kind: 'LOADING' }
  | { kind: 'READY' }
  | { kind: 'EMPTY'; message?: string }
  | { kind: 'PARTIAL'; message: string }
  | { kind: 'OFFLINE'; message: string }
  | { kind: 'ERROR'; message: string };

export type NotificationAttentionContextAction =
  'MUTE_TYPE' | 'MUTE_CONTEXT' | 'FOLLOW_CONTEXT' | 'PRIORITIZE_ACTOR';

export type NotificationAttentionExpirationOption = {
  optionId: string;
  label: string;
  expiresAt?: string | null;
};

export type NotificationAttentionScopeOption = {
  optionId: string;
  action: NotificationAttentionContextAction;
  label: string;
  description: string;
  scopeLabel: string;
  scopeKind: NotificationAttentionScopeKind;
  current: boolean;
  availability: 'AVAILABLE' | 'LOCKED' | 'UNAVAILABLE';
  unavailableReason?: string;
  policyLock?: NotificationAttentionPolicyLock | null;
  expirationOptions: readonly NotificationAttentionExpirationOption[];
};

export type NotificationAttentionImpactPreview =
  | { state: 'IDLE' }
  | { state: 'LOADING' }
  | {
      state: 'READY';
      asOf: string;
      statements: readonly string[];
      policyNotices?: readonly string[];
    }
  | { state: 'CONFLICT'; asOf: string; message: string; latestVersion?: string }
  | { state: 'OFFLINE'; message: string }
  | { state: 'ERROR'; message: string };

export type NotificationTestStageStatus =
  'NOT_RUN' | 'QUEUED' | 'RUNNING' | 'REACHED' | 'SKIPPED' | 'BLOCKED' | 'FAILED' | 'EXPIRED';

export type NotificationTestCapability = 'SUPPORTED' | 'DISABLED' | 'UNAVAILABLE';

export type NotificationTestStage = {
  stageId: string;
  label: string;
  description: string;
  capability: NotificationTestCapability;
  status: NotificationTestStageStatus;
  detail?: string;
  observedAt?: string;
};

export type NotificationTestDeliveryState =
  | 'IDLE'
  | 'QUEUED'
  | 'RUNNING'
  | 'COMPLETE'
  | 'PARTIAL'
  | 'FAILED'
  | 'RATE_LIMITED'
  | 'OFFLINE'
  | 'EXPIRED'
  | 'DISABLED';

export type NotificationTestDiagnostics = {
  state: NotificationTestDeliveryState;
  runAvailability: NotificationTestAction['reason'];
  testId?: string;
  generatedAt?: string;
  expiresAt?: string;
  retryAt?: string;
  statusMessage?: string;
  stages: readonly NotificationTestStage[];
};

export type NotificationTestAction = {
  allowed: boolean;
  reason: 'AVAILABLE' | 'BUSY' | 'RATE_LIMITED' | 'OFFLINE' | 'EXPIRED' | 'DISABLED';
};

export function resolveAttentionRuleState(
  rule: Pick<NotificationAttentionRule, 'state' | 'expiresAt'>,
  now: number
): NotificationAttentionRuleState {
  if (rule.state === 'EXPIRED') return 'EXPIRED';
  if (rule.expiresAt) {
    const expiresAt = Date.parse(rule.expiresAt);
    if (Number.isFinite(expiresAt) && expiresAt <= now) return 'EXPIRED';
  }
  return rule.state;
}

export function isAttentionScopeActionable(option: NotificationAttentionScopeOption): boolean {
  return option.availability === 'AVAILABLE' && !option.policyLock;
}

export function selectedAttentionExpiration(
  option: NotificationAttentionScopeOption | undefined,
  expirationId: string | null
): NotificationAttentionExpirationOption | null {
  if (!option || !expirationId) return null;
  return option.expirationOptions.find((item) => item.optionId === expirationId) ?? null;
}

export function resolveAttentionRuleLimit(
  limit: NotificationAttentionRuleLimit | null | undefined
): {
  valid: boolean;
  reached: boolean;
  remaining: number;
} {
  const valid =
    Boolean(limit) &&
    limit !== undefined &&
    limit !== null &&
    Number.isSafeInteger(limit.used) &&
    Number.isSafeInteger(limit.limit) &&
    limit.used >= 0 &&
    limit.limit >= 0 &&
    limit.used <= limit.limit;
  if (!valid) return { valid: false, reached: true, remaining: 0 };
  const remaining = limit.limit - limit.used;
  return { valid: true, reached: limit.reached || remaining === 0, remaining };
}

export function validNotificationAttentionCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function hasBlockingAttentionConflict(rule: NotificationAttentionRule): boolean {
  return Boolean(rule.conflicts?.some((conflict) => conflict.severity === 'BLOCKING'));
}

export function resolveNotificationTestAction(
  diagnostics: NotificationTestDiagnostics,
  busy: boolean
): NotificationTestAction {
  if (busy || diagnostics.state === 'QUEUED' || diagnostics.state === 'RUNNING') {
    return { allowed: false, reason: 'BUSY' };
  }
  return {
    allowed: diagnostics.runAvailability === 'AVAILABLE',
    reason: diagnostics.runAvailability,
  };
}

export function notificationTestStageProgress(stages: readonly NotificationTestStage[]): {
  observed: number;
  total: number;
} {
  const supported = stages.filter((stage) => stage.capability === 'SUPPORTED');
  const observed = supported.filter((stage) =>
    ['REACHED', 'SKIPPED', 'BLOCKED', 'FAILED', 'EXPIRED'].includes(stage.status)
  ).length;
  return { observed, total: supported.length };
}
