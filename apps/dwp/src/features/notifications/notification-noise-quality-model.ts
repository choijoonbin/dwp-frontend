import { formatNumber, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

export type NotificationNoiseMetricKey =
  'MUTED_RATE' | 'DEDUPLICATION_RATE' | 'ACTION_CONVERSION' | 'FATIGUE_COHORT';

export type NotificationNoiseMetricUnit = 'PERCENT' | 'COUNT' | 'RATIO';

export type NotificationNoiseDatumState = 'AVAILABLE' | 'PRIVACY_WITHHELD' | 'MISSING' | 'ERROR';

export type NotificationNoiseDatum = {
  state: NotificationNoiseDatumState;
  value: number | null;
  cohortSize?: number | null;
  note?: string;
};

export type NotificationNoiseMetric = {
  key: NotificationNoiseMetricKey;
  label: string;
  description: string;
  unit: NotificationNoiseMetricUnit;
  datum: NotificationNoiseDatum;
};

export type NotificationNoiseMetrics = Record<NotificationNoiseMetricKey, NotificationNoiseMetric>;

export type NotificationNoiseFindingTarget =
  'CONTRACT' | 'POLICY' | 'TEMPLATE' | 'DELIVERY_CONTROL';

export type NotificationNoiseFinding = {
  findingId: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  label: string;
  summary: string;
  target: NotificationNoiseFindingTarget;
  targetKey: string;
  targetLabel: string;
};

export type NotificationNoisyType = {
  typeId: string;
  contractId: string;
  appKey: string;
  typeKey: string;
  appLabel: string;
  typeLabel: string;
  sent: NotificationNoiseDatum;
  mutedRate: NotificationNoiseDatum;
  deduplicationRate: NotificationNoiseDatum;
  actionConversion: NotificationNoiseDatum;
  ownerLabel?: string | null;
  finding?: NotificationNoiseFinding | null;
};

export type NotificationNoiseTimeRange =
  'LAST_24_HOURS' | 'LAST_7_DAYS' | 'LAST_30_DAYS';

export type NotificationNoiseSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type NotificationNoiseRisk =
  'HIGH_MUTE_RATE' | 'LOW_ACTION_CONVERSION' | 'DEDUPLICATION_OPPORTUNITY';

export type NotificationNoiseFilters = {
  range: NotificationNoiseTimeRange;
  search: string;
  severity: NotificationNoiseSeverity | null;
  risk: NotificationNoiseRisk | null;
};

export const DEFAULT_NOTIFICATION_NOISE_FILTERS: NotificationNoiseFilters = {
  range: 'LAST_30_DAYS',
  search: '',
  severity: null,
  risk: null,
};

export type NotificationNoiseTrendPoint = {
  bucketStart: string;
  cohortSize: number;
  volume: number;
  muteRate: number | null;
  deduplicationRate: number | null;
  actionConversionRate: number | null;
};

export type NotificationNoisePrivacyPolicy = {
  minimumCohortSize: number;
  explanation: string;
};

export type NotificationNoiseQualityState =
  | { kind: 'LOADING' }
  | { kind: 'READY' }
  | { kind: 'EMPTY'; message?: string }
  | { kind: 'PARTIAL'; message: string }
  | { kind: 'MISSING'; message: string }
  | { kind: 'ERROR'; message: string };

export type NotificationFourEyesPolicy = {
  state: 'ENFORCED' | 'NOT_CONFIGURED' | 'UNAVAILABLE';
  summary: string;
  draftLabel: string;
  reviewLabel: string;
  reviewerSeparationRequired: boolean;
  updatedAt?: string;
  canOpenPolicy: boolean;
};

export type NotificationNoiseDatumVisibility =
  | { visible: true; value: number }
  | { visible: false; reason: 'PRIVACY' | 'MISSING' | 'ERROR' | 'INVALID' };

function validCohortSize(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function validNotificationNoisePrivacyPolicy(
  policy: NotificationNoisePrivacyPolicy | null | undefined
): policy is NotificationNoisePrivacyPolicy {
  return Boolean(
    policy && Number.isSafeInteger(policy.minimumCohortSize) && policy.minimumCohortSize >= 1
  );
}

export function resolveNotificationNoiseDatum(
  datum: NotificationNoiseDatum,
  policy: NotificationNoisePrivacyPolicy | null | undefined,
  unit?: NotificationNoiseMetricUnit
): NotificationNoiseDatumVisibility {
  if (datum.state === 'PRIVACY_WITHHELD') return { visible: false, reason: 'PRIVACY' };
  if (datum.state === 'MISSING') return { visible: false, reason: 'MISSING' };
  if (datum.state === 'ERROR') return { visible: false, reason: 'ERROR' };
  if (
    !validNotificationNoisePrivacyPolicy(policy) ||
    !validCohortSize(datum.cohortSize) ||
    datum.cohortSize < policy.minimumCohortSize
  ) {
    return { visible: false, reason: 'PRIVACY' };
  }
  if (datum.value === null || !Number.isFinite(datum.value) || datum.value < 0) {
    return { visible: false, reason: 'INVALID' };
  }
  if (unit === 'PERCENT' && datum.value > 1) return { visible: false, reason: 'INVALID' };
  if (unit === 'COUNT' && !Number.isSafeInteger(datum.value)) {
    return { visible: false, reason: 'INVALID' };
  }
  return { visible: true, value: datum.value };
}

export function formatNotificationNoiseDatum(
  datum: NotificationNoiseDatum,
  unit: NotificationNoiseMetricUnit,
  policy: NotificationNoisePrivacyPolicy | null | undefined,
  locale = 'en'
): string | null {
  const resolved = resolveNotificationNoiseDatum(datum, policy, unit);
  if (!resolved.visible) return null;
  const supportedLocale = resolveSupportedLocale(locale);
  if (unit === 'PERCENT') {
    return formatNumber(
      resolved.value,
      { style: 'percent', maximumFractionDigits: 1 },
      supportedLocale
    );
  }
  if (unit === 'RATIO') {
    return formatNumber(resolved.value, { maximumFractionDigits: 2 }, supportedLocale);
  }
  return formatNumber(resolved.value, { maximumFractionDigits: 0 }, supportedLocale);
}

export function notificationNoiseHasVisibleData(
  metrics: readonly NotificationNoiseMetric[],
  policy: NotificationNoisePrivacyPolicy | null | undefined
): boolean {
  return metrics.some(
    (metric) => resolveNotificationNoiseDatum(metric.datum, policy, metric.unit).visible
  );
}

export function notificationNoiseFindingPriority(
  finding: NotificationNoiseFinding | null | undefined
): number {
  if (!finding) return 0;
  if (finding.severity === 'CRITICAL') return 3;
  if (finding.severity === 'WARNING') return 2;
  return 1;
}

export function sortNotificationNoisyTypes(
  items: readonly NotificationNoisyType[]
): NotificationNoisyType[] {
  return [...items].sort((left, right) => {
    const findingDifference =
      notificationNoiseFindingPriority(right.finding) -
      notificationNoiseFindingPriority(left.finding);
    if (findingDifference !== 0) return findingDifference;
    return (
      left.appLabel.localeCompare(right.appLabel) || left.typeLabel.localeCompare(right.typeLabel)
    );
  });
}
