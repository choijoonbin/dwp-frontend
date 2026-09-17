import { describe, expect, it } from 'vitest';

import {
  defaultRoutineMergeSelections,
  createEmptyRoutineDraft,
  mergeRoutineDraft,
  routineCommandState,
  routineConflictGroups,
  routineConsentComplete,
  routineDraftErrors,
  routineDraftChangeKeys,
  routineDryRunIsCurrent,
} from './dwaion-routine-model';

import type { DwaionRoutine, DwaionRoutineDraft } from './dwaion-routine-model';

const completeConsents = [
  { key: 'SOURCE_ACCESS', state: 'ENABLED' },
  { key: 'ANALYSIS', state: 'ENABLED' },
  { key: 'PROPOSAL_DELIVERY', state: 'ENABLED' },
] as const;

const routine: DwaionRoutine = {
  routineId: 'routine-1',
  title: 'Morning review',
  description: 'Review due work',
  status: 'DRAFT',
  revision: 4,
  executionMode: 'DRY_RUN_ONLY',
  triggerType: 'SCHEDULED',
  webhookEventType: null,
  webhookEndpointReference: null,
  sourceKeys: ['WORK_ITEM'],
  schedule: {
    cadence: 'WEEKDAYS',
    localTime: '09:00:00',
    timeZone: 'Asia/Seoul',
    activeFrom: '2026-09-01',
    activeUntil: null,
    quietHoursStart: '20:00:00',
    quietHoursEnd: '08:00:00',
    weekDays: [],
  },
  consents: completeConsents,
  schedulingAvailable: false,
  backgroundExecutionAvailable: false,
  notificationDeliveryAvailable: false,
  dryRunAvailable: true,
  proposalDeliveryAvailable: false,
  activationAvailable: true,
  nextRunAt: null,
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

describe('DWAI personal routine governance model', () => {
  it('starts with every consent off so the user must opt in explicitly', () => {
    expect(createEmptyRoutineDraft('Asia/Seoul')).toMatchObject({
      sourceKeys: [],
      consentKeys: [],
      schedule: { timeZone: 'Asia/Seoul' },
    });
  });

  it('requires the full source-analysis-delivery consent chain', () => {
    expect(routineConsentComplete(completeConsents)).toBe(true);
    expect(routineConsentComplete(completeConsents.slice(0, 2))).toBe(false);
    expect(
      routineConsentComplete([
        ...completeConsents.slice(0, 2),
        { key: 'PROPOSAL_DELIVERY', state: 'RECONSENT_REQUIRED' },
      ])
    ).toBe(false);
  });

  it('fails closed on revision drift before pause, resume, or dry-run commands', () => {
    expect(routineCommandState(routine, 3)).toEqual({
      allowed: false,
      reason: 'REVISION_CONFLICT',
    });
    expect(routineCommandState(routine, 4)).toEqual({ allowed: true });
  });

  it('does not permit a routine whose consent is missing', () => {
    expect(routineCommandState({ ...routine, consents: completeConsents.slice(0, 2) }, 4)).toEqual({
      allowed: false,
      reason: 'CONSENT_REQUIRED',
    });
  });

  it('blocks preview when the runtime capability is unavailable', () => {
    expect(routineCommandState({ ...routine, dryRunAvailable: false }, 4)).toEqual({
      allowed: false,
      reason: 'DRY_RUN_UNAVAILABLE',
    });
  });

  it('validates governed sources, timezone, schedule, and every consent', () => {
    const draft: DwaionRoutineDraft = {
      ...createEmptyRoutineDraft('Asia/Seoul'),
      title: '',
      description: '',
      sourceKeys: [],
      schedule: {
        ...routine.schedule,
        localTime: '',
        timeZone: '',
        activeFrom: '2026-10-02',
        activeUntil: '2026-10-01',
      },
      consentKeys: [],
    };
    expect(routineDraftErrors(draft)).toEqual([
      'TITLE_REQUIRED',
      'DESCRIPTION_REQUIRED',
      'SOURCE_REQUIRED',
      'LOCAL_TIME_REQUIRED',
      'TIME_ZONE_REQUIRED',
      'DATE_RANGE_INVALID',
      'CONSENT_SOURCE_ACCESS_REQUIRED',
      'CONSENT_ANALYSIS_REQUIRED',
      'CONSENT_PROPOSAL_DELIVERY_REQUIRED',
    ]);
  });

  it('never reuses a dry-run receipt after the routine revision changes', () => {
    const receipt = {
      routineRunId: '55555555-5555-4555-8555-555555555555',
      routineId: routine.routineId,
      routineRevision: 4,
      evaluatedAt: '2026-09-04T00:00:00Z',
      outcome: 'VALIDATED' as const,
      evidenceCount: 1,
      evidenceScope: 'AUTHORIZED_SOURCE_BINDING' as const,
      businessEvidenceCount: 0,
      proposalsCreated: 0,
      externalWritesPerformed: 0 as const,
      validatedSources: ['WORK_ITEM'],
      previewNextRunAt: '2026-09-05T00:00:00Z',
      schedulingAvailable: false as const,
    };
    expect(routineDryRunIsCurrent(routine, receipt)).toBe(true);
    expect(routineDryRunIsCurrent({ ...routine, revision: 5 }, receipt)).toBe(false);
  });

  it('validates webhook definitions without requiring schedule-only fields', () => {
    const draft: DwaionRoutineDraft = {
      ...createEmptyRoutineDraft('Asia/Seoul'),
      title: 'Ledger close monitor',
      description: 'Review approved ledger close evidence.',
      triggerType: 'WEBHOOK',
      webhookEventType: 'ERP.LEDGER_CLOSE',
      webhookEndpointReference: 'hook://erp-ledger-close',
      sourceKeys: ['WORK_ITEM'],
      consentKeys: ['SOURCE_ACCESS', 'ANALYSIS', 'PROPOSAL_DELIVERY'],
      schedule: {
        ...createEmptyRoutineDraft('Asia/Seoul').schedule,
        localTime: '',
        timeZone: '',
      },
    };
    expect(routineDraftErrors(draft)).toEqual([]);
    expect(routineDraftErrors({ ...draft, webhookEventType: 'not safe' })).toContain(
      'WEBHOOK_EVENT_TYPE_INVALID'
    );
  });

  it('derives a truthful semantic change summary from the saved draft', () => {
    const saved: DwaionRoutineDraft = {
      ...createEmptyRoutineDraft('Asia/Seoul'),
      title: 'Morning review',
      description: 'Review due work',
      sourceKeys: ['WORK_ITEM'],
      consentKeys: ['SOURCE_ACCESS', 'ANALYSIS', 'PROPOSAL_DELIVERY'],
    };
    expect(routineDraftChangeKeys(saved, saved)).toEqual([]);
    expect(
      routineDraftChangeKeys(saved, {
        ...saved,
        triggerType: 'WEBHOOK',
        webhookEventType: 'WORK.ITEM_CHANGED',
        sourceKeys: ['MAIL'],
      })
    ).toEqual(['TRIGGER', 'SOURCES']);
  });

  it('classifies all five three-way merge groups without hiding concurrent edits', () => {
    const base = routineDraft();
    const local: DwaionRoutineDraft = {
      ...base,
      title: 'Local title',
      sourceKeys: ['WORK_ITEM', 'MAIL'],
      budget: { ...base.budget, maximumRunsPerMonth: 40 },
    };
    const server: DwaionRoutineDraft = {
      ...base,
      title: 'Server title',
      schedule: { ...base.schedule, localTime: '10:00:00' },
      budget: { ...base.budget, maximumRunsPerMonth: 24 },
    };

    expect(routineConflictGroups(base, local, server)).toEqual([
      expect.objectContaining({ key: 'IDENTITY', status: 'CONFLICT' }),
      expect.objectContaining({ key: 'TRIGGER', status: 'SERVER_ONLY' }),
      expect.objectContaining({ key: 'SOURCES', status: 'LOCAL_ONLY' }),
      expect.objectContaining({ key: 'DELIVERY_AND_CONSENT', status: 'UNCHANGED' }),
      expect.objectContaining({ key: 'BUDGET_AND_RECOVERY', status: 'CONFLICT' }),
    ]);
  });

  it('merges each governed group from the explicitly selected side', () => {
    const base = routineDraft();
    const local: DwaionRoutineDraft = {
      ...base,
      title: 'Local title',
      sourceKeys: ['WORK_ITEM', 'MAIL'],
      consentKeys: ['SOURCE_ACCESS', 'ANALYSIS'],
      budget: { ...base.budget, maximumTokensPerRun: 64_000 },
    };
    const server: DwaionRoutineDraft = {
      ...base,
      title: 'Server title',
      schedule: { ...base.schedule, localTime: '10:30:00' },
      sourceKeys: ['CALENDAR'],
      notificationPolicy: { ...base.notificationPolicy, notifyOnPartial: false },
      budget: { ...base.budget, maximumTokensPerRun: 8_000 },
    };
    const selections = {
      ...defaultRoutineMergeSelections(base, local, server),
      IDENTITY: 'LOCAL',
      TRIGGER: 'SERVER',
      SOURCES: 'LOCAL',
      DELIVERY_AND_CONSENT: 'SERVER',
      BUDGET_AND_RECOVERY: 'LOCAL',
    } as const;

    expect(mergeRoutineDraft(local, server, selections)).toMatchObject({
      title: 'Local title',
      schedule: { localTime: '10:30:00' },
      sourceKeys: ['WORK_ITEM', 'MAIL'],
      consentKeys: base.consentKeys,
      notificationPolicy: { notifyOnPartial: false },
      budget: { maximumTokensPerRun: 64_000 },
    });
  });
});

function routineDraft(): DwaionRoutineDraft {
  return {
    ...createEmptyRoutineDraft('Asia/Seoul'),
    title: 'Morning review',
    description: 'Review due work',
    sourceKeys: ['WORK_ITEM'],
    consentKeys: ['SOURCE_ACCESS', 'ANALYSIS', 'PROPOSAL_DELIVERY'],
  };
}
