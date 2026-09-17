import type {
  NotificationAttentionControl,
  NotificationAttentionEffect as ApiAttentionEffect,
  NotificationAttentionRule as ApiAttentionRule,
  NotificationAttentionRuleCollection,
  NotificationAttentionRuleInput,
  NotificationNoiseQuality,
  NotificationNoiseTypeMetric,
  NotificationTestDelivery,
} from '@dwp-frontend/shared-utils/api/notification-attention-api';
import type { NotificationChannel } from '@dwp-frontend/shared-utils/api/notification-contract';

import type {
  NotificationAttentionContextAction,
  NotificationAttentionRule,
  NotificationAttentionRuleKind,
  NotificationAttentionScopeOption,
  NotificationAttentionSummary,
  NotificationTestDiagnostics,
  NotificationTestStage,
} from './notification-attention-model';
import type {
  NotificationFourEyesPolicy,
  NotificationNoiseDatum,
  NotificationNoiseFinding,
  NotificationNoiseMetrics,
  NotificationNoisePrivacyPolicy,
  NotificationNoiseQualityState,
  NotificationNoiseTrendPoint,
  NotificationNoisyType,
} from './notification-noise-quality-model';

type Translate = (key: string, options?: Record<string, unknown>) => string;

const CHANNELS: NotificationChannel[] = [
  'IN_APP',
  'EMAIL',
  'WEB_PUSH',
  'MOBILE_PUSH',
  'TEAMS',
  'SLACK',
];

function ruleKind(rule: ApiAttentionRule): NotificationAttentionRuleKind {
  if (rule.scopeKind === 'TOPIC_TOKEN') return 'TOPIC_WATCH';
  if (rule.effect === 'MUTE') return 'MUTE_SCOPE';
  if (rule.scopeKind === 'ACTOR' && rule.effect === 'PRIORITIZE') return 'VIP';
  return 'FOLLOW_CONTEXT';
}

function ruleState(rule: ApiAttentionRule, now: number): NotificationAttentionRule['state'] {
  if (rule.expiresAt && Date.parse(rule.expiresAt) <= now) return 'EXPIRED';
  return rule.enabled ? 'ENABLED' : 'PAUSED';
}

export function toAttentionRule(
  rule: ApiAttentionRule,
  t: Translate,
  now = Date.now()
): NotificationAttentionRule {
  const state = ruleState(rule, now);
  const mutable = rule.source === 'USER' && !rule.managed;
  const scopeFallback = t(`attention.scopeKinds.${rule.scopeKind}`);
  return {
    ruleId: rule.ruleId,
    kind: ruleKind(rule),
    label: rule.displayLabel?.trim() || scopeFallback,
    scopeLabel: rule.displayLabel?.trim() || scopeFallback,
    scopeKind: rule.scopeKind,
    source: rule.source,
    sourceLabel: t(`attention.sources.${rule.source}`),
    effect: rule.effect,
    channelLabels: CHANNELS.filter((channel) => rule.channels[channel]).map((channel) =>
      t(`channels.${channel}`)
    ),
    state,
    startsAt: rule.startsAt,
    expiresAt: rule.expiresAt,
    updatedAt: rule.updatedAt,
    managed: rule.managed
      ? {
          ownerLabel: t('attention.managed.owner'),
          reason: t('attention.managed.reason'),
          exceptionAllowed: rule.exceptionAllowed,
        }
      : null,
    actions: {
      canEdit: mutable,
      canDelete: mutable,
      canPause: mutable && state === 'ENABLED',
      canResume: mutable && state === 'PAUSED',
      canExtend: mutable && Boolean(rule.expiresAt),
    },
  };
}

export function attentionRuleSummary(
  rules: readonly NotificationAttentionRule[]
): NotificationAttentionSummary {
  return rules.reduce<NotificationAttentionSummary>(
    (summary, rule) => ({ ...summary, [rule.kind]: summary[rule.kind] + 1 }),
    { VIP: 0, FOLLOW_CONTEXT: 0, MUTE_SCOPE: 0, TOPIC_WATCH: 0 }
  );
}

export function attentionRuleLimit(
  collection: NotificationAttentionRuleCollection,
  now = Date.now()
) {
  const used = collection.items.filter((rule) => ruleState(rule, now) === 'ENABLED').length;
  return {
    used,
    limit: collection.maxActiveRules,
    reached: used >= collection.maxActiveRules,
  };
}

export function ruleInput(rule: ApiAttentionRule): NotificationAttentionRuleInput {
  return {
    scopeKind: rule.scopeKind,
    scopeKey: rule.scopeKey,
    displayLabel: rule.displayLabel,
    effect: rule.effect,
    channels: rule.channels,
    startsAt: rule.startsAt,
    expiresAt: rule.expiresAt,
    enabled: rule.enabled,
  };
}

function controlAction(controlKey: string): NotificationAttentionContextAction | null {
  if (
    controlKey === 'MUTE_TYPE' ||
    controlKey === 'MUTE_CONTEXT' ||
    controlKey === 'FOLLOW_CONTEXT' ||
    controlKey === 'PRIORITIZE_ACTOR'
  ) {
    return controlKey;
  }
  return null;
}

export function controlEffect(action: NotificationAttentionContextAction): ApiAttentionEffect {
  if (action === 'PRIORITIZE_ACTOR') return 'PRIORITIZE';
  if (action === 'FOLLOW_CONTEXT') return 'FOLLOW';
  return 'MUTE';
}

export function toAttentionScopeOption(
  control: NotificationAttentionControl,
  t: Translate
): NotificationAttentionScopeOption | null {
  const action = controlAction(control.controlKey);
  if (!action) return null;
  const effect = controlEffect(action);
  const effectAllowed = control.allowedEffects.includes(effect);
  const locked = control.policyLocked;
  return {
    optionId: control.controlKey,
    action,
    label: control.label,
    description: control.description ?? t(`attention.controls.descriptions.${action}`),
    scopeLabel: control.label,
    scopeKind: control.scopeKind,
    current: control.currentEffect === effect,
    availability: locked ? 'LOCKED' : effectAllowed ? 'AVAILABLE' : 'UNAVAILABLE',
    unavailableReason: effectAllowed ? undefined : t('attention.controls.effectUnavailable'),
    policyLock: locked
      ? {
          ownerLabel: t('attention.managed.owner'),
          reason: control.policyReason ?? t('attention.managed.reason'),
          exceptionAllowed: false,
        }
      : null,
    expirationOptions: control.expiresAt
      ? [
          {
            optionId: 'current-expiry',
            label: t('attention.controls.currentExpiry'),
            expiresAt: control.expiresAt,
          },
        ]
      : [],
  };
}

const TEST_STAGE_KEYS: Record<NotificationTestDelivery['stages'][number]['stage'], string> = {
  REQUEST_VALIDATION: 'requestValidation',
  PRIVACY_FILTER: 'privacyFilter',
  IN_APP_PREVIEW: 'inAppPreview',
  ENDPOINT_DELIVERY: 'endpointDelivery',
};

function testStage(
  stage: NotificationTestDelivery['stages'][number],
  t: Translate
): NotificationTestStage {
  const key = TEST_STAGE_KEYS[stage.stage];
  const status = {
    PENDING: 'QUEUED',
    SUCCEEDED: 'REACHED',
    FAILED: 'FAILED',
    DISABLED: 'SKIPPED',
    EXPIRED: 'EXPIRED',
  }[stage.state] as NotificationTestStage['status'];
  return {
    stageId: stage.stage,
    label: t(`attention.diagnostics.stages.${key}.label`),
    description: t(`attention.diagnostics.stages.${key}.description`),
    capability: stage.state === 'DISABLED' ? 'DISABLED' : 'SUPPORTED',
    status,
    detail: stage.detail ?? undefined,
    observedAt: stage.occurredAt ?? undefined,
  };
}

export function toTestDiagnostics(
  delivery: NotificationTestDelivery | null,
  t: Translate,
  now = Date.now()
): NotificationTestDiagnostics {
  if (!delivery) return { state: 'IDLE', runAvailability: 'AVAILABLE', stages: [] };
  const expired = Date.parse(delivery.expiresAt) <= now;
  const retryAt = delivery.retryAfterSeconds
    ? new Date(now + delivery.retryAfterSeconds * 1000).toISOString()
    : undefined;
  const state = expired
    ? 'EXPIRED'
    : ({
        PENDING: 'RUNNING',
        COMPLETED: 'COMPLETE',
        PARTIAL: 'PARTIAL',
        FAILED: 'FAILED',
        EXPIRED: 'EXPIRED',
      }[delivery.state] as NotificationTestDiagnostics['state']);
  return {
    state,
    runAvailability: retryAt ? 'RATE_LIMITED' : expired ? 'EXPIRED' : 'AVAILABLE',
    testId: delivery.testId,
    generatedAt: delivery.createdAt,
    expiresAt: delivery.expiresAt,
    retryAt,
    statusMessage: state === 'PARTIAL' ? t('attention.diagnostics.partialDescription') : undefined,
    stages: delivery.stages.map((stage) => testStage(stage, t)),
  };
}

function datum(
  value: number | null | undefined,
  cohortSize: number | null | undefined,
  sufficientCohort: boolean
): NotificationNoiseDatum {
  if (!sufficientCohort) return { state: 'PRIVACY_WITHHELD', value: null, cohortSize };
  if (value == null) return { state: 'MISSING', value: null, cohortSize };
  return { state: 'AVAILABLE', value, cohortSize };
}

export function toNoiseQualityView(
  quality: NotificationNoiseQuality,
  t: Translate
): {
  metrics: NotificationNoiseMetrics;
  noisyTypes: NotificationNoisyType[];
  trend: NotificationNoiseTrendPoint[];
  privacyPolicy: NotificationNoisePrivacyPolicy;
  state: NotificationNoiseQualityState;
  fourEyesPolicy: NotificationFourEyesPolicy;
} {
  const cohort = quality.observedCohortSize;
  const metrics: NotificationNoiseMetrics = {
    MUTED_RATE: {
      key: 'MUTED_RATE',
      label: t('noiseQuality.metrics.muted.label'),
      description: t('noiseQuality.metrics.muted.description'),
      unit: 'PERCENT',
      datum: datum(quality.muteRate, cohort, quality.sufficientCohort),
    },
    DEDUPLICATION_RATE: {
      key: 'DEDUPLICATION_RATE',
      label: t('noiseQuality.metrics.deduplication.label'),
      description: t('noiseQuality.metrics.deduplication.description'),
      unit: 'PERCENT',
      datum: datum(quality.deduplicationRate, cohort, quality.sufficientCohort),
    },
    ACTION_CONVERSION: {
      key: 'ACTION_CONVERSION',
      label: t('noiseQuality.metrics.actionConversion.label'),
      description: t('noiseQuality.metrics.actionConversion.description'),
      unit: 'PERCENT',
      datum: datum(quality.actionConversionRate, cohort, quality.sufficientCohort),
    },
    FATIGUE_COHORT: {
      key: 'FATIGUE_COHORT',
      label: t('noiseQuality.metrics.fatigue.label'),
      description: t('noiseQuality.metrics.fatigue.description'),
      unit: 'COUNT',
      datum: datum(quality.fatigueExposedUsers, cohort, quality.sufficientCohort),
    },
  };
  const noisyTypes = quality.noisyTypes.map<NotificationNoisyType>((item) => ({
    // A type-level cohort may be smaller than the aggregate cohort. Each row
    // must satisfy the privacy threshold independently before values are shown.
    typeId: item.contractId?.trim() || `${item.appKey}:${item.typeKey}`,
    contractId: item.contractId?.trim() || `${item.appKey}:${item.typeKey}`,
    appKey: item.appKey,
    typeKey: item.typeKey,
    appLabel: t(`sources.${item.appKey.toLowerCase()}`, { defaultValue: item.appKey }),
    typeLabel: item.typeKey,
    sent: datum(item.volume, item.cohortSize, item.cohortSize >= quality.minimumCohortSize),
    mutedRate: datum(item.muteRate, item.cohortSize, item.cohortSize >= quality.minimumCohortSize),
    deduplicationRate: datum(
      item.deduplicationRate,
      item.cohortSize,
      item.cohortSize >= quality.minimumCohortSize
    ),
    actionConversion: datum(
      item.actionConversionRate,
      item.cohortSize,
      item.cohortSize >= quality.minimumCohortSize
    ),
    ownerLabel: item.ownerTeam?.trim() || null,
    finding: item.findingCode ? noiseFinding(item, t) : null,
  }));
  return {
    metrics,
    noisyTypes,
    trend: (quality.trend ?? [])
      .filter((point) => point.cohortSize >= quality.minimumCohortSize)
      .map((point) => ({
        bucketStart: point.bucketStart,
        cohortSize: point.cohortSize,
        volume: point.volume,
        muteRate: finiteRate(point.muteRate),
        deduplicationRate: finiteRate(point.deduplicationRate),
        actionConversionRate: finiteRate(point.actionConversionRate),
      })),
    privacyPolicy: {
      minimumCohortSize: quality.minimumCohortSize,
      explanation: t('noiseQuality.privacy.explanation'),
    },
    state: quality.partial
      ? { kind: 'PARTIAL', message: quality.message ?? t('noiseQuality.partial') }
      : quality.sufficientCohort
        ? { kind: noisyTypes.length ? 'READY' : 'EMPTY', message: t('noiseQuality.empty') }
        : { kind: 'EMPTY', message: t('noiseQuality.privacy.insufficient') },
    fourEyesPolicy: fourEyesPolicy(quality, t),
  };
}

function finiteRate(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : null;
}

function fourEyesPolicy(
  quality: NotificationNoiseQuality,
  t: Translate
): NotificationFourEyesPolicy {
  const policy = quality.fourEyes;
  const draftLabel = policy
    ? t('noiseQuality.fourEyes.draftCount', { count: policy.draftPolicyCount })
    : t('noiseQuality.fourEyes.draft');
  const unavailable = {
    state: 'UNAVAILABLE' as const,
    summary: t('noiseQuality.fourEyes.unavailableSummary'),
    draftLabel,
    reviewLabel: t('noiseQuality.fourEyes.review'),
    reviewerSeparationRequired: false,
    updatedAt: policy?.updatedAt ?? undefined,
    canOpenPolicy: Boolean(policy),
  };
  if (!policy) return unavailable;
  if (policy.state === 'NOT_CONFIGURED' && policy.publishedPolicyCount === 0) {
    return {
      ...unavailable,
      state: 'NOT_CONFIGURED',
      summary: t('noiseQuality.fourEyes.separationNotConfigured'),
      canOpenPolicy: true,
    };
  }
  if (
    policy.state !== 'ENFORCED' ||
    policy.publishedPolicyCount < 1 ||
    !policy.reviewerSeparationRequired
  ) {
    return unavailable;
  }
  return {
    state: 'ENFORCED',
    summary: t('noiseQuality.fourEyes.enforcedSummary', {
      published: policy.publishedPolicyCount,
      drafts: policy.draftPolicyCount,
    }),
    draftLabel,
    reviewLabel: t('noiseQuality.fourEyes.review'),
    reviewerSeparationRequired: true,
    updatedAt: policy.updatedAt ?? undefined,
    canOpenPolicy: true,
  };
}

function noiseFinding(
  item: NotificationNoiseTypeMetric,
  t: Translate
): NotificationNoiseFinding {
  const code = item.findingCode ?? 'UNKNOWN';
  const known = new Set([
    'HIGH_MUTE_RATE',
    'LOW_ACTION_CONVERSION',
    'DEDUPLICATION_OPPORTUNITY',
  ]);
  const key = known.has(code) ? code : 'UNKNOWN';
  const candidateTarget = new Set(['CONTRACT', 'POLICY', 'TEMPLATE', 'DELIVERY_CONTROL']).has(
    item.findingTarget ?? ''
  )
    ? (item.findingTarget as NotificationNoiseFinding['target'])
    : 'CONTRACT';
  const candidateTargetKey = item.findingTargetKey?.trim() ?? '';
  const exactTargetAvailable =
    candidateTarget === 'CONTRACT' ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      candidateTargetKey
    );
  const target = exactTargetAvailable ? candidateTarget : 'CONTRACT';
  const severity = new Set(['INFO', 'WARNING', 'CRITICAL']).has(item.findingSeverity ?? '')
    ? (item.findingSeverity as NotificationNoiseFinding['severity'])
    : key === 'DEDUPLICATION_OPPORTUNITY'
      ? 'INFO'
      : 'WARNING';
  return {
    findingId: `${code}:${exactTargetAvailable ? candidateTargetKey : item.contractId}`,
    severity,
    label: t(`noiseQuality.findings.${key}.label`),
    summary: t(`noiseQuality.findings.${key}.summary`),
    target,
    targetKey: exactTargetAvailable && candidateTargetKey ? candidateTargetKey : item.contractId,
    targetLabel: item.typeKey,
  };
}
