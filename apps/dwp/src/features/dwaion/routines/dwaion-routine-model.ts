export type DwaionRoutineViewState = 'loading' | 'error' | 'permission-denied' | 'ready';

export type DwaionRoutineStatus = 'DRAFT' | 'PAUSED' | 'ARCHIVED';
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
  executionMode: 'DRY_RUN_ONLY';
  sourceKeys: readonly string[];
  schedule: DwaionRoutineSchedule;
  consents: readonly DwaionRoutineConsent[];
  schedulingAvailable: boolean;
  dryRunAvailable: boolean;
  proposalDeliveryAvailable: boolean;
};

export type DwaionRoutineDraft = {
  title: string;
  description: string;
  sourceKeys: readonly string[];
  schedule: DwaionRoutineSchedule;
  consentKeys: readonly DwaionRoutineConsent['key'][];
};

export type DwaionRoutineDryRunReceipt = {
  routineId: string;
  routineRevision: number;
  evaluatedAt: string;
  outcome: 'VALIDATED';
  evidenceCount: number;
  evidenceScope: 'AUTHORIZED_SOURCE_BINDING';
  businessEvidenceCount: number;
  proposalsCreated: number;
  validatedSources: readonly string[];
  previewNextRunAt: string;
  schedulingAvailable: false;
};

export type DwaionRoutineCommandState =
  | { allowed: true }
  | {
      allowed: false;
      reason: 'REVISION_CONFLICT' | 'CONSENT_REQUIRED' | 'NOT_DRY_RUN_ONLY' | 'LIFECYCLE_BLOCKED';
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
    sourceKeys: [],
    schedule: {
      cadence: 'WEEKDAYS',
      localTime: '09:00:00',
      timeZone,
      activeFrom: null,
      activeUntil: null,
      quietHoursStart: null,
      quietHoursEnd: null,
      weekDays: [],
    },
    consentKeys: [],
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
  if (!draft.schedule.localTime) errors.push('LOCAL_TIME_REQUIRED');
  if (!draft.schedule.timeZone.trim()) errors.push('TIME_ZONE_REQUIRED');
  if (
    draft.schedule.activeFrom &&
    draft.schedule.activeUntil &&
    draft.schedule.activeFrom > draft.schedule.activeUntil
  ) {
    errors.push('DATE_RANGE_INVALID');
  }
  if (draft.schedule.cadence === 'WEEKLY' && draft.schedule.weekDays.length === 0) {
    errors.push('WEEK_DAY_REQUIRED');
  }
  if (draft.schedule.cadence !== 'WEEKLY' && draft.schedule.weekDays.length > 0) {
    errors.push('WEEK_DAY_NOT_ALLOWED');
  }
  if (Boolean(draft.schedule.quietHoursStart) !== Boolean(draft.schedule.quietHoursEnd)) {
    errors.push('QUIET_HOURS_INCOMPLETE');
  }
  for (const key of REQUIRED_CONSENTS) {
    if (!draft.consentKeys.includes(key)) errors.push(`CONSENT_${key}_REQUIRED`);
  }
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
