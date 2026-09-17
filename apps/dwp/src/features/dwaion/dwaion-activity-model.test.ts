import { describe, expect, it } from 'vitest';

import {
  dwaionActivityPeriodStart,
  filterDwaionActivityWindow,
  filterDwaionActivityPeriod,
  findExactDwaionRun,
  hasExpiredDwaionRunLease,
  resolveDwaionActivityFilter,
  resolveDwaionActivityPeriod,
  summarizeDwaionActivityWindow,
  updateDwaionActivityFilter,
  updateDwaionActivityPeriod,
  updateDwaionActivitySelection,
} from './dwaion-activity-model';

import type { DwaionUserRun } from '@dwp-frontend/shared-utils';

const runs: DwaionUserRun[] = [
  run('10000000-0000-4000-8000-000000000001', 'RUNNING', 'ALLOW', null),
  run('10000000-0000-4000-8000-000000000002', 'COMPLETED', 'ALLOW', 'COMPLETED'),
  run('10000000-0000-4000-8000-000000000003', 'COMPLETED', 'DENY', 'ABSTAINED'),
  run('10000000-0000-4000-8000-000000000004', 'FAILED', 'HANDOFF', 'CONFIGURATION_REQUIRED'),
  {
    ...run('10000000-0000-0000-0000-000000000005', 'COMPLETED', 'ALLOW', 'COMPLETED'),
    dataProvenance: 'SAMPLE',
  },
  {
    ...run('10000000-0000-4000-8000-000000000006', 'RUNNING', 'HANDOFF', null),
    lease: { status: 'EXPIRED', expiresAt: '2026-09-04T00:01:00Z' },
  },
];

describe('DWAI activity recent-window model', () => {
  it('accepts only supported URL filters and applies them to the loaded window', () => {
    expect(resolveDwaionActivityFilter('running')).toBe('RUNNING');
    expect(resolveDwaionActivityFilter('unknown')).toBe('ALL');
    expect(filterDwaionActivityWindow(runs, 'COMPLETED').map((item) => item.runId)).toEqual([
      runs[1]?.runId,
      runs[2]?.runId,
      runs[4]?.runId,
    ]);
  });

  it('applies an explicit date range only to timestamps returned by the run API', () => {
    const now = Date.parse('2026-09-09T00:00:00Z');
    expect(resolveDwaionActivityPeriod('week')).toBe('WEEK');
    expect(resolveDwaionActivityPeriod('unsupported')).toBe('MONTH');
    expect(filterDwaionActivityPeriod(runs, 'DAY', now)).toEqual([]);
    expect(filterDwaionActivityPeriod(runs, 'WEEK', now)).toHaveLength(runs.length);
    expect(dwaionActivityPeriodStart('DAY', now)).toBe('2026-09-08T00:00:00.000Z');
    expect(dwaionActivityPeriodStart('MONTH', now)).toBe('2026-08-10T00:00:00.000Z');
    expect(updateDwaionActivityPeriod(new URLSearchParams('run=exact'), 'DAY').toString()).toBe(
      'run=exact&period=DAY'
    );
  });

  it('keeps local samples out of operational totals without hiding them from the recent list', () => {
    expect(summarizeDwaionActivityWindow(runs)).toEqual({
      total: 5,
      running: 2,
      completed: 2,
      attention: 3,
      sample: 1,
    });
    expect(filterDwaionActivityWindow(runs, 'ALL')).toContain(runs[4]);
  });

  it('drills the attention metric into the same evidence-based set of runs', () => {
    expect(resolveDwaionActivityFilter('attention')).toBe('ATTENTION');
    const attention = filterDwaionActivityWindow(runs, 'ATTENTION');
    expect(attention.map((item) => item.runId)).toEqual([
      runs[2]?.runId,
      runs[3]?.runId,
      runs[5]?.runId,
    ]);
    expect(attention).toHaveLength(summarizeDwaionActivityWindow(runs).attention);
    expect(
      updateDwaionActivityFilter(new URLSearchParams('run=exact'), 'ATTENTION').toString()
    ).toBe('run=exact&state=ATTENTION');
  });

  it('flags an expired lease only while the server still reports the run as running', () => {
    expect(hasExpiredDwaionRunLease(runs[5]!)).toBe(true);
    expect(
      hasExpiredDwaionRunLease({
        ...runs[1]!,
        lease: { status: 'EXPIRED', expiresAt: '2026-09-04T00:01:00Z' },
      })
    ).toBe(false);
    expect(
      hasExpiredDwaionRunLease({
        ...runs[0]!,
        lease: { status: 'ACTIVE', expiresAt: '2026-09-04T00:01:00Z' },
      })
    ).toBe(false);
  });

  it('never substitutes another recent row for an exact deep link', () => {
    expect(findExactDwaionRun(runs, runs[0]!.runId)).toBe(runs[0]);
    const alphabetic = run('aaaaaaaa-0000-4000-8000-000000000001', 'COMPLETED', 'ALLOW', null);
    expect(findExactDwaionRun([alphabetic], alphabetic.runId.toUpperCase())).toBe(alphabetic);
    expect(findExactDwaionRun(runs, '10000000-0000-4000-8000-000000000099')).toBeUndefined();
  });

  it('preserves unrelated URL state while changing filters and selection', () => {
    const selected = updateDwaionActivitySelection(
      new URLSearchParams('state=FAILED&source=ask'),
      runs[0]!.runId
    );
    expect(selected.get('state')).toBe('FAILED');
    expect(selected.get('source')).toBe('ask');
    expect(selected.get('run')).toBe(runs[0]!.runId);

    const all = updateDwaionActivityFilter(selected, 'ALL');
    expect(all.has('state')).toBe(false);
    expect(all.get('run')).toBe(runs[0]!.runId);
  });
});

function run(
  runId: string,
  runState: DwaionUserRun['runState'],
  policyOutcome: DwaionUserRun['policyOutcome'],
  answerState: DwaionUserRun['answerState']
): DwaionUserRun {
  return {
    runId,
    agentKey: 'DWP_ASSISTANT',
    agentRevision: 1,
    runState,
    answerState,
    riskTier: 'L1',
    policyOutcome,
    statusCode: null,
    sourceCount: 2,
    latencyMs: 120,
    conversationId: null,
    createdAt: '2026-09-04T00:00:00Z',
    completedAt: runState === 'RUNNING' ? null : '2026-09-04T00:00:01Z',
  };
}
