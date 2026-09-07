import { describe, expect, it } from 'vitest';

import {
  createEmptyRoutineDraft,
  routineCommandState,
  routineConsentComplete,
  routineDraftErrors,
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
  dryRunAvailable: true,
  proposalDeliveryAvailable: false,
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

  it('validates governed sources, timezone, schedule, and every consent', () => {
    const draft: DwaionRoutineDraft = {
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
      routineId: routine.routineId,
      routineRevision: 4,
      evaluatedAt: '2026-09-04T00:00:00Z',
      outcome: 'VALIDATED' as const,
      evidenceCount: 1,
      evidenceScope: 'AUTHORIZED_SOURCE_BINDING' as const,
      businessEvidenceCount: 0,
      proposalsCreated: 0,
      validatedSources: ['WORK_ITEM'],
      previewNextRunAt: '2026-09-05T00:00:00Z',
      schedulingAvailable: false as const,
    };
    expect(routineDryRunIsCurrent(routine, receipt)).toBe(true);
    expect(routineDryRunIsCurrent({ ...routine, revision: 5 }, receipt)).toBe(false);
  });
});
