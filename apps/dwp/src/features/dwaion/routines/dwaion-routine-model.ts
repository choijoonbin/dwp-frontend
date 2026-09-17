export type DwaionRoutineViewState = 'loading' | 'error' | 'permission-denied' | 'ready';

export type DwaionRoutineStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
export type DwaionRoutineConsentState = 'UNSET' | 'DISABLED' | 'ENABLED' | 'RECONSENT_REQUIRED';

export type DwaionRoutineConsent = {
  key: 'SOURCE_ACCESS' | 'ANALYSIS' | 'PROPOSAL_DELIVERY';
  state: DwaionRoutineConsentState;
};

export type DwaionRoutineSchedule = {
  cadence: 'DAILY' | 'WEEKDAYS' | 'WEEKLY';
  localTime: string;
  timeZone: string;
  activeFrom: string | null;
  activeUntil: string | null;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  weekDays: readonly number[];
};

export type DwaionRoutine = {
  routineId: string;
  title: string;
  description: string;
  status: DwaionRoutineStatus;
  revision: number;
  executionMode: 'DRY_RUN_ONLY' | 'SCHEDULED' | 'WEBHOOK';
  triggerType: 'SCHEDULED' | 'WEBHOOK';
  webhookEventType: string | null;
  webhookEndpointReference: string | null;
  sourceKeys: readonly string[];
  schedule: DwaionRoutineSchedule;
  consents: readonly DwaionRoutineConsent[];
  schedulingAvailable: boolean;
  backgroundExecutionAvailable: boolean;
  notificationDeliveryAvailable: boolean;
  dryRunAvailable: boolean;
  proposalDeliveryAvailable: boolean;
  activationAvailable: boolean;
  nextRunAt: string | null;
  budget: DwaionRoutineBudget;
  retryPolicy: DwaionRoutineRetryPolicy;
  notificationPolicy: DwaionRoutineNotificationPolicy;
  compensationPolicy: DwaionRoutineCompensationPolicy;
};

export type DwaionRoutineBudget = {
  maximumRunsPerMonth: number;
  maximumTokensPerRun: number;
  maximumMinutesPerRun: number;
};

export type DwaionRoutineRetryPolicy = {
  maximumAttempts: number;
  initialBackoffSeconds: number;
  backoffMultiplier: number;
};

export type DwaionRoutineNotificationPolicy = {
  notifyOnPartial: boolean;
  notifyOnFailure: boolean;
  notifyOnRecovery: boolean;
};

export type DwaionRoutineCompensationPolicy = {
  enabled: boolean;
  strategy: 'REVOKE_PENDING_HANDOFFS' | 'PROVIDER_MANAGED';
};

export type DwaionRoutineDraft = {
  title: string;
  description: string;
  triggerType: 'SCHEDULED' | 'WEBHOOK';
  webhookEventType: string;
  webhookEndpointReference: string;
  sourceKeys: readonly string[];
  schedule: DwaionRoutineSchedule;
  consentKeys: readonly DwaionRoutineConsent['key'][];
  budget: DwaionRoutineBudget;
  retryPolicy: DwaionRoutineRetryPolicy;
  notificationPolicy: DwaionRoutineNotificationPolicy;
  compensationPolicy: DwaionRoutineCompensationPolicy;
};

export type DwaionRoutineDryRunReceipt = {
  routineRunId: string;
  routineId: string;
  routineRevision: number;
  evaluatedAt: string;
  outcome: 'VALIDATED';
  evidenceCount: number;
  evidenceScope: 'AUTHORIZED_SOURCE_BINDING';
  businessEvidenceCount: number;
  proposalsCreated: number;
  externalWritesPerformed: 0;
  validatedSources: readonly string[];
  previewNextRunAt: string | null;
  schedulingAvailable: false;
};

export type DwaionRoutineCommandState =
  | { allowed: true }
  | {
      allowed: false;
      reason:
        | 'REVISION_CONFLICT'
        | 'CONSENT_REQUIRED'
        | 'NOT_DRY_RUN_ONLY'
        | 'LIFECYCLE_BLOCKED'
        | 'DRY_RUN_UNAVAILABLE';
    };

const REQUIRED_CONSENTS: readonly DwaionRoutineConsent['key'][] = [
  'SOURCE_ACCESS',
  'ANALYSIS',
  'PROPOSAL_DELIVERY',
];

export function createEmptyRoutineDraft(timeZone: string): DwaionRoutineDraft {
  return {
    title: '',
    description: '',
    triggerType: 'SCHEDULED',
    webhookEventType: '',
    webhookEndpointReference: '',
    sourceKeys: [],
    schedule: {
      cadence: 'WEEKDAYS',
      localTime: '09:00',
      timeZone,
      activeFrom: null,
      activeUntil: null,
      quietHoursStart: null,
      quietHoursEnd: null,
      weekDays: [],
    },
    consentKeys: [],
    budget: {
      maximumRunsPerMonth: 31,
      maximumTokensPerRun: 32_000,
      maximumMinutesPerRun: 15,
    },
    retryPolicy: {
      maximumAttempts: 3,
      initialBackoffSeconds: 30,
      backoffMultiplier: 2,
    },
    notificationPolicy: {
      notifyOnPartial: true,
      notifyOnFailure: true,
      notifyOnRecovery: true,
    },
    compensationPolicy: {
      enabled: true,
      strategy: 'REVOKE_PENDING_HANDOFFS',
    },
  };
}

export function routineConsentComplete(consents: readonly DwaionRoutineConsent[]): boolean {
  return REQUIRED_CONSENTS.every((key) =>
    consents.some((consent) => consent.key === key && consent.state === 'ENABLED')
  );
}

export function routineCommandState(
  routine: DwaionRoutine,
  expectedRevision: number
): DwaionRoutineCommandState {
  if (routine.revision !== expectedRevision) {
    return { allowed: false, reason: 'REVISION_CONFLICT' };
  }
  if (routine.executionMode !== 'DRY_RUN_ONLY') {
    return { allowed: false, reason: 'NOT_DRY_RUN_ONLY' };
  }
  if (!routine.dryRunAvailable) return { allowed: false, reason: 'DRY_RUN_UNAVAILABLE' };
  if (routine.status !== 'DRAFT') return { allowed: false, reason: 'LIFECYCLE_BLOCKED' };
  if (!routineConsentComplete(routine.consents)) {
    return { allowed: false, reason: 'CONSENT_REQUIRED' };
  }
  return { allowed: true };
}

export function routineDraftErrors(draft: DwaionRoutineDraft): readonly string[] {
  const errors: string[] = [];
  if (!draft.title.trim()) errors.push('TITLE_REQUIRED');
  if (!draft.description.trim()) errors.push('DESCRIPTION_REQUIRED');
  if (!draft.sourceKeys.length) errors.push('SOURCE_REQUIRED');
  if (draft.triggerType === 'SCHEDULED' && !draft.schedule.localTime)
    errors.push('LOCAL_TIME_REQUIRED');
  if (draft.triggerType === 'SCHEDULED' && !draft.schedule.timeZone.trim())
    errors.push('TIME_ZONE_REQUIRED');
  if (draft.triggerType === 'WEBHOOK' && !/^[A-Z][A-Z0-9_.-]{1,63}$/u.test(draft.webhookEventType))
    errors.push('WEBHOOK_EVENT_TYPE_INVALID');
  if (
    draft.triggerType === 'WEBHOOK' &&
    draft.webhookEndpointReference &&
    !/^[A-Za-z0-9][A-Za-z0-9:/._-]{0,239}$/u.test(draft.webhookEndpointReference)
  )
    errors.push('WEBHOOK_ENDPOINT_REFERENCE_INVALID');
  if (
    draft.schedule.activeFrom &&
    draft.schedule.activeUntil &&
    draft.schedule.activeFrom > draft.schedule.activeUntil
  ) {
    errors.push('DATE_RANGE_INVALID');
  }
  if (
    draft.triggerType === 'SCHEDULED' &&
    draft.schedule.cadence === 'WEEKLY' &&
    draft.schedule.weekDays.length === 0
  ) {
    errors.push('WEEK_DAY_REQUIRED');
  }
  if (
    draft.triggerType === 'SCHEDULED' &&
    draft.schedule.cadence !== 'WEEKLY' &&
    draft.schedule.weekDays.length > 0
  ) {
    errors.push('WEEK_DAY_NOT_ALLOWED');
  }
  if (
    draft.triggerType === 'SCHEDULED' &&
    Boolean(draft.schedule.quietHoursStart) !== Boolean(draft.schedule.quietHoursEnd)
  ) {
    errors.push('QUIET_HOURS_INCOMPLETE');
  }
  for (const key of REQUIRED_CONSENTS) {
    if (!draft.consentKeys.includes(key)) errors.push(`CONSENT_${key}_REQUIRED`);
  }
  if (draft.budget.maximumRunsPerMonth < 1 || draft.budget.maximumRunsPerMonth > 744)
    errors.push('RUN_BUDGET_INVALID');
  if (draft.budget.maximumTokensPerRun < 128 || draft.budget.maximumTokensPerRun > 2_000_000)
    errors.push('TOKEN_BUDGET_INVALID');
  if (draft.budget.maximumMinutesPerRun < 1 || draft.budget.maximumMinutesPerRun > 240)
    errors.push('TIME_BUDGET_INVALID');
  if (draft.retryPolicy.maximumAttempts < 1 || draft.retryPolicy.maximumAttempts > 10)
    errors.push('RETRY_ATTEMPTS_INVALID');
  if (
    draft.retryPolicy.initialBackoffSeconds < 5 ||
    draft.retryPolicy.initialBackoffSeconds > 3_600
  )
    errors.push('RETRY_BACKOFF_INVALID');
  if (draft.retryPolicy.backoffMultiplier < 1 || draft.retryPolicy.backoffMultiplier > 10)
    errors.push('RETRY_MULTIPLIER_INVALID');
  return errors;
}

export function routineDryRunIsCurrent(
  routine: DwaionRoutine,
  receipt: DwaionRoutineDryRunReceipt | null
): boolean {
  return Boolean(
    receipt &&
    receipt.routineId === routine.routineId &&
    receipt.routineRevision === routine.revision
  );
}

export type DwaionRoutineChangeKey =
  'IDENTITY' | 'TRIGGER' | 'SOURCES' | 'DELIVERY_AND_CONSENT' | 'BUDGET_AND_RECOVERY';

export function routineDraftChangeKeys(
  saved: DwaionRoutineDraft | null,
  draft: DwaionRoutineDraft
): DwaionRoutineChangeKey[] {
  if (!saved)
    return ['IDENTITY', 'TRIGGER', 'SOURCES', 'DELIVERY_AND_CONSENT', 'BUDGET_AND_RECOVERY'];
  const changes: DwaionRoutineChangeKey[] = [];
  if (!same([saved.title, saved.description], [draft.title, draft.description]))
    changes.push('IDENTITY');
  if (
    !same(
      [saved.triggerType, saved.webhookEventType, saved.webhookEndpointReference, saved.schedule],
      [draft.triggerType, draft.webhookEventType, draft.webhookEndpointReference, draft.schedule]
    )
  )
    changes.push('TRIGGER');
  if (!same([...saved.sourceKeys].sort(), [...draft.sourceKeys].sort())) changes.push('SOURCES');
  if (
    !same(
      [[...saved.consentKeys].sort(), saved.notificationPolicy, saved.compensationPolicy],
      [[...draft.consentKeys].sort(), draft.notificationPolicy, draft.compensationPolicy]
    )
  )
    changes.push('DELIVERY_AND_CONSENT');
  if (!same([saved.budget, saved.retryPolicy], [draft.budget, draft.retryPolicy]))
    changes.push('BUDGET_AND_RECOVERY');
  return changes;
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
