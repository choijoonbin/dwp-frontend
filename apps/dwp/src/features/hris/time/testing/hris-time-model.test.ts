import { describe, expect, it } from 'vitest';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';

import {
  classifyTimeCommandFailure,
  hrisTimeQueryKey,
  mondayToSundayWeek,
  resolveTimeCalendarPeriod,
  resolveTimeDateCommandState,
  selectTimeWorkspaceDisplay,
  timeCardCanSubmit,
  timeDateAtInstant,
} from '../index';

import type { HrisTimeRuntimeProps, TimeCardDisplay, TimeEntryDisplay } from '../index';

type ProductSurfaceRequestScope = HrisTimeRuntimeProps['requestScope'];

const card: TimeCardDisplay = {
  timeCardId: 'card-1',
  periodStart: '2026-03-02',
  periodEnd: '2026-03-08',
  status: 'OPEN',
  scheduledMinutes: 2_400,
  recordedMinutes: 480,
  exceptionCount: 0,
  dataOrigin: 'SOURCE',
  version: 3,
};
const entry: TimeEntryDisplay = {
  timeEntryId: 'entry-1',
  workDate: '2026-03-02',
  entryType: 'WORK',
  minutes: 480,
  version: 1,
};
const scope: ProductSurfaceRequestScope = {
  governed: true,
  ready: true,
  contextScopeKey: 'scope:hris/time',
  cacheKey: ['tenant-1', 'actor-3', 'SELF', 'hcm.personal', 'scope:hris/time', '91'],
  queryMeta: {
    accessSensitive: true,
    tenantId: 'tenant-1',
    actorId: 'actor-3',
    accessMode: 'SELF',
    productId: 'hcm',
    surfaceId: 'hcm.personal',
    contextScopeKey: 'scope:hris/time',
    decisionRevision: '91',
  },
};

describe('HRIS date-only time calendar', () => {
  it('resolves calendar dates by zone without UTC rollover', () => {
    const instant = '2026-03-08T04:30:00Z';
    expect(timeDateAtInstant(instant, 'UTC')).toBe('2026-03-08');
    expect(timeDateAtInstant(instant, 'Asia/Seoul')).toBe('2026-03-08');
    expect(timeDateAtInstant(instant, 'America/New_York')).toBe('2026-03-07');
  });

  it('creates Monday through Sunday across the US DST boundary as plain dates', () => {
    expect(mondayToSundayWeek('2026-03-08')).toEqual([
      { date: '2026-03-02', isoDayOfWeek: 1 },
      { date: '2026-03-03', isoDayOfWeek: 2 },
      { date: '2026-03-04', isoDayOfWeek: 3 },
      { date: '2026-03-05', isoDayOfWeek: 4 },
      { date: '2026-03-06', isoDayOfWeek: 5 },
      { date: '2026-03-07', isoDayOfWeek: 6 },
      { date: '2026-03-08', isoDayOfWeek: 7 },
    ]);
  });

  it('classifies an exact Monday-Sunday card and rejects unsafe ranges', () => {
    expect(resolveTimeCalendarPeriod('2026-03-02', '2026-03-08').state).toBe('MONDAY_TO_SUNDAY');
    expect(resolveTimeCalendarPeriod('2026-03-03', '2026-03-08').state).toBe('NON_STANDARD');
    expect(resolveTimeCalendarPeriod('2026-03-08', '2026-03-02')).toEqual({
      state: 'INVALID',
      dates: [],
    });
  });

  it('binds the read cache to actor, scope, and authority revision', () => {
    expect(hrisTimeQueryKey(scope)).toEqual(['hris', 'time', 'workspace-v2', ...scope.cacheKey]);
  });
});

describe('HRIS time command safety', () => {
  const period = resolveTimeCalendarPeriod(card.periodStart, card.periodEnd);

  it('uses existing entries as evidence but never invents editable weekdays without a schedule', () => {
    expect(resolveTimeDateCommandState({ card, date: entry.workDate, entry, period })).toEqual({
      editable: true,
      reason: 'EXISTING_ENTRY',
    });
    expect(resolveTimeDateCommandState({ card, date: '2026-03-03', period })).toEqual({
      editable: false,
      reason: 'SCHEDULE_UNAVAILABLE',
    });
  });

  it('honors connected schedule evidence and makes reference data read-only', () => {
    const connectedScheduleDates = new Set(['2026-03-03']);
    expect(
      resolveTimeDateCommandState({
        card,
        date: '2026-03-03',
        period,
        connectedScheduleDates,
      }).editable
    ).toBe(true);
    expect(
      resolveTimeDateCommandState({
        card: { ...card, dataOrigin: 'REFERENCE' },
        date: entry.workDate,
        entry,
        period,
        connectedScheduleDates,
      })
    ).toEqual({ editable: false, reason: 'REFERENCE_DATA' });
  });

  it('never submits reference, non-open, empty, or exception-bearing cards', () => {
    expect(timeCardCanSubmit(card)).toBe(true);
    expect(timeCardCanSubmit({ ...card, dataOrigin: 'REFERENCE' })).toBe(false);
    expect(timeCardCanSubmit({ ...card, status: 'SUBMITTED' })).toBe(false);
    expect(timeCardCanSubmit({ ...card, recordedMinutes: 0 })).toBe(false);
    expect(timeCardCanSubmit({ ...card, exceptionCount: 1 })).toBe(false);
  });

  it.each([
    [new HttpError('Conflict', 409), 'CONFLICT', true, false],
    [new HttpError('Signed out', 401), 'UNAUTHENTICATED', false, false],
    [new HttpError('Denied', 403), 'FORBIDDEN', false, false],
    [new HttpError('Rejected', 422), 'REJECTED', false, true],
    [new HttpTransportError('NETWORK'), 'UNKNOWN_OUTCOME', true, false],
    [new HttpTransportError('TIMEOUT'), 'UNKNOWN_OUTCOME', true, false],
    [new HttpTransportError('ABORT'), 'ABORTED', false, false],
  ])('classifies %s as %s without discarding a draft', (error, kind, refresh, retry) => {
    expect(classifyTimeCommandFailure(error)).toEqual({
      kind,
      preserveDraft: true,
      requiresRefresh: refresh,
      retryAllowed: retry,
    });
  });
});

function sourceWorkspace() {
  return {
    employee: {
      personId: 'private-person',
      displayName: 'Private employee',
      bankAccount: 'private-bank',
    },
    card: {
      ...card,
      adjacentPayrollGroup: 'private-payroll-group',
    },
    entries: [
      {
        ...entry,
        workMode: 'OFFICE',
        note: 'Recorded at source',
        adjacentReview: 'private-review',
      },
    ],
    exceptions: [
      {
        exceptionId: 'exception-1',
        exceptionCode: 'MISSING_BREAK',
        severity: 'WARNING',
        occurredOn: '2026-03-02',
        message: 'Review the recorded break.',
        lifecycleState: 'OPEN',
        resolutionNote: null,
        adjacentManagerNote: 'private-manager-note',
      },
    ],
    teamQueue: [{ privateManagerNote: 'private-team-queue' }],
  };
}

describe('HRIS time strict display projection', () => {
  it('copies and freezes only the explicitly allowed display contract', () => {
    const source = sourceWorkspace();
    const display = selectTimeWorkspaceDisplay(source);

    expect(display).toEqual({
      card,
      entries: [
        {
          ...entry,
          workMode: 'OFFICE',
          note: 'Recorded at source',
        },
      ],
      exceptions: [
        {
          exceptionId: 'exception-1',
          exceptionCode: 'MISSING_BREAK',
          severity: 'WARNING',
          occurredOn: '2026-03-02',
          message: 'Review the recorded break.',
          lifecycleState: 'OPEN',
          resolutionNote: null,
        },
      ],
    });
    expect(JSON.stringify(display)).not.toContain('private-');
    expect(display).not.toBe(source);
    expect(display.card).not.toBe(source.card);
    expect(display.entries[0]).not.toBe(source.entries[0]);
    expect(Object.isFrozen(display)).toBe(true);
    expect(Object.isFrozen(display.card)).toBe(true);
    expect(Object.isFrozen(display.entries)).toBe(true);
    expect(Object.isFrozen(display.entries[0])).toBe(true);
    expect(Object.isFrozen(display.exceptions)).toBe(true);
    expect(Object.isFrozen(display.exceptions[0])).toBe(true);
  });

  it('accepts an empty workspace only when a missing card has no dependent records', () => {
    expect(selectTimeWorkspaceDisplay({ card: null, entries: [], exceptions: [] })).toEqual({
      card: null,
      entries: [],
      exceptions: [],
    });
    expect(() =>
      selectTimeWorkspaceDisplay({ card: null, entries: [entry], exceptions: [] })
    ).toThrow('Time workspace source payload is invalid.');
  });

  it.each([
    [
      'non-canonical status alias',
      (value: ReturnType<typeof sourceWorkspace>) => {
        Reflect.set(value.card, 'status', 'open');
      },
    ],
    [
      'non-canonical origin alias',
      (value: ReturnType<typeof sourceWorkspace>) => {
        Reflect.set(value.card, 'dataOrigin', 'source');
      },
    ],
    [
      'invalid civil date',
      (value: ReturnType<typeof sourceWorkspace>) => {
        value.entries[0]!.workDate = '2026-02-30';
      },
    ],
    [
      'fractional minutes',
      (value: ReturnType<typeof sourceWorkspace>) => {
        value.entries[0]!.minutes = 480.5;
      },
    ],
    [
      'negative version',
      (value: ReturnType<typeof sourceWorkspace>) => {
        value.card.version = -1;
      },
    ],
    [
      'duplicate entry identity',
      (value: ReturnType<typeof sourceWorkspace>) => {
        value.entries.push({ ...value.entries[0]! });
      },
    ],
    [
      'missing canonical identity',
      (value: ReturnType<typeof sourceWorkspace>) => {
        const source = value.entries[0] as unknown as Record<string, unknown>;
        source.id = source.timeEntryId;
        delete source.timeEntryId;
      },
    ],
  ])('rejects %s without reflecting a rejected value', (_label, mutate) => {
    const source = sourceWorkspace();
    mutate(source);
    let error: unknown;
    try {
      selectTimeWorkspaceDisplay(source);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('Time workspace source payload is invalid.');
    expect((error as Error).message).not.toContain('private-');
  });

  it('rejects sparse arrays and non-plain records', () => {
    const sparse = sourceWorkspace();
    sparse.entries.length = 2;
    expect(() => selectTimeWorkspaceDisplay(sparse)).toThrow(
      'Time workspace source payload is invalid.'
    );

    const nonPlain = Object.create({ inherited: true }) as Record<string, unknown>;
    Object.assign(nonPlain, sourceWorkspace());
    expect(() => selectTimeWorkspaceDisplay(nonPlain)).toThrow(
      'Time workspace source payload is invalid.'
    );
  });
});
