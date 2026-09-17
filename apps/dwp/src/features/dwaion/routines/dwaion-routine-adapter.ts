import type {
  DwaionPersonalRoutine,
  DwaionRoutineDefinition,
  DwaionRoutineDryRunReceipt as ApiDryRunReceipt,
  DwaionRoutineRunCommand,
} from '@dwp-frontend/shared-utils';

import type {
  DwaionRoutine,
  DwaionRoutineDraft,
  DwaionRoutineDryRunReceipt,
} from './dwaion-routine-model';

export class RoutineConflictRecoveryError extends Error {
  constructor(
    message: string,
    readonly serverRoutine: DwaionRoutine | null
  ) {
    super(message);
    this.name = 'RoutineConflictRecoveryError';
  }
}

export function toRoutineDefinition(
  draft: DwaionRoutineDraft,
  locale: 'ko' | 'en'
): DwaionRoutineDefinition {
  return {
    name: draft.title.trim(),
    objective: draft.description.trim(),
    triggerType: draft.triggerType,
    cadence: draft.triggerType === 'SCHEDULED' ? draft.schedule.cadence : null,
    localTime: draft.triggerType === 'SCHEDULED' ? draft.schedule.localTime : null,
    timeZone: draft.triggerType === 'SCHEDULED' ? draft.schedule.timeZone : null,
    webhookEventType: draft.triggerType === 'WEBHOOK' ? draft.webhookEventType.trim() : null,
    webhookEndpointReference:
      draft.triggerType === 'WEBHOOK' && draft.webhookEndpointReference.trim()
        ? draft.webhookEndpointReference.trim()
        : null,
    locale,
    activeFrom: draft.triggerType === 'SCHEDULED' ? draft.schedule.activeFrom : null,
    activeUntil: draft.triggerType === 'SCHEDULED' ? draft.schedule.activeUntil : null,
    quietHoursStart: draft.triggerType === 'SCHEDULED' ? draft.schedule.quietHoursStart : null,
    quietHoursEnd: draft.triggerType === 'SCHEDULED' ? draft.schedule.quietHoursEnd : null,
    weekDays: draft.triggerType === 'SCHEDULED' ? [...draft.schedule.weekDays] : [],
    monthDay:
      draft.triggerType === 'SCHEDULED' && draft.schedule.cadence === 'MONTHLY'
        ? (draft.schedule.monthDay ?? 1)
        : null,
    sources: [...draft.sourceKeys] as DwaionRoutineDefinition['sources'],
    budget: { ...draft.budget },
    retryPolicy: { ...draft.retryPolicy },
    notificationPolicy: { ...draft.notificationPolicy },
    compensationPolicy: { ...draft.compensationPolicy },
  };
}

export function toRoutineView(routine: DwaionPersonalRoutine): DwaionRoutine {
  return {
    routineId: routine.routineId,
    title: routine.definition.name,
    description: routine.definition.objective,
    status: routine.lifecycleState,
    revision: routine.revision,
    executionMode: routine.executionMode,
    triggerType: routine.definition.triggerType,
    webhookEventType: routine.definition.webhookEventType ?? null,
    webhookEndpointReference: routine.definition.webhookEndpointReference ?? null,
    sourceKeys: routine.definition.sources,
    schedule: {
      cadence: routine.definition.cadence ?? 'WEEKDAYS',
      localTime: routine.definition.localTime ?? '09:00',
      timeZone: routine.definition.timeZone ?? 'UTC',
      activeFrom: routine.definition.activeFrom ?? null,
      activeUntil: routine.definition.activeUntil ?? null,
      quietHoursStart: routine.definition.quietHoursStart ?? null,
      quietHoursEnd: routine.definition.quietHoursEnd ?? null,
      weekDays: routine.definition.weekDays ?? [],
      monthDay: routine.definition.monthDay ?? null,
    },
    consents: [
      { key: 'SOURCE_ACCESS', state: routine.consents.sourceAccess },
      { key: 'ANALYSIS', state: routine.consents.analysis },
      { key: 'PROPOSAL_DELIVERY', state: routine.consents.proposalDelivery },
    ],
    schedulingAvailable: routine.schedulingAvailable,
    backgroundExecutionAvailable: routine.capabilities?.backgroundExecutionAvailable ?? false,
    notificationDeliveryAvailable: routine.capabilities?.notificationDeliveryAvailable ?? false,
    dryRunAvailable: routine.capabilities?.dryRunAvailable ?? false,
    proposalDeliveryAvailable: routine.capabilities?.proposalDeliveryAvailable ?? false,
    activationAvailable: routine.capabilities?.activationAvailable ?? false,
    nextRunAt: routine.nextRunAt ?? null,
    budget: { ...routine.definition.budget },
    retryPolicy: { ...routine.definition.retryPolicy },
    notificationPolicy: { ...routine.definition.notificationPolicy },
    compensationPolicy: { ...routine.definition.compensationPolicy },
  };
}

export function toRoutineDraft(routine: DwaionRoutine): DwaionRoutineDraft {
  return {
    title: routine.title,
    description: routine.description,
    triggerType: routine.triggerType,
    webhookEventType: routine.webhookEventType ?? '',
    webhookEndpointReference: routine.webhookEndpointReference ?? '',
    sourceKeys: routine.sourceKeys,
    schedule: routine.schedule,
    consentKeys: routine.consents
      .filter((consent) => consent.state === 'ENABLED')
      .map((consent) => consent.key),
    budget: { ...routine.budget },
    retryPolicy: { ...routine.retryPolicy },
    notificationPolicy: { ...routine.notificationPolicy },
    compensationPolicy: { ...routine.compensationPolicy },
  };
}

export function toRoutineDryRunReceipt(receipt: ApiDryRunReceipt): DwaionRoutineDryRunReceipt {
  return {
    routineRunId: receipt.routineRunId,
    routineId: receipt.routineId,
    routineRevision: receipt.routineRevision,
    evaluatedAt: receipt.evaluatedAt,
    outcome: 'VALIDATED',
    evidenceCount: receipt.evidenceCount,
    evidenceScope: 'AUTHORIZED_SOURCE_BINDING',
    businessEvidenceCount: receipt.businessEvidenceCount,
    proposalsCreated: receipt.proposalsCreated,
    externalWritesPerformed: 0,
    validatedSources: receipt.validatedSources,
    previewNextRunAt: receipt.previewNextRunAt ?? null,
    schedulingAvailable: false,
  };
}

export function routineRunCommandReason(
  action: DwaionRoutineRunCommand['action'],
  locale: 'ko' | 'en'
) {
  if (action === 'SKIP_QUARANTINED_AND_CONTINUE')
    return {
      reasonCode: 'USER_CONFIRMED_SKIP_QUARANTINED',
      changeReason:
        locale === 'ko'
          ? '사용자가 공급자 격리 증거와 영향 범위를 검토하고 격리 건을 제외한 실행 계속을 요청했습니다.'
          : 'The user reviewed provider quarantine evidence and requested continuation without quarantined items.',
    };
  if (action === 'RETRY')
    return {
      reasonCode: 'USER_CONFIRMED_RETRY',
      changeReason:
        locale === 'ko'
          ? '사용자가 실패 원인과 재시도 예산을 검토하고 실행 재시도를 요청했습니다.'
          : 'The user reviewed the failure and retry budget and requested another attempt.',
    };
  if (action === 'CANCEL')
    return {
      reasonCode: 'USER_CONFIRMED_SAFE_CANCEL',
      changeReason:
        locale === 'ko'
          ? '사용자가 진행 상태를 검토하고 실행을 안전하게 취소했습니다.'
          : 'The user reviewed progress and safely cancelled the execution.',
    };
  return {
    reasonCode: 'USER_CONFIRMED_COMPENSATION',
    changeReason:
      locale === 'ko'
        ? '사용자가 완료 영수증과 영향 범위를 검토하고 보상 처리를 요청했습니다.'
        : 'The user reviewed the receipt and impact and requested compensation.',
  };
}
