import { describe, expect, it } from 'vitest';

import {
  filterDwaionActivityWindow,
  findExactDwaionRun,
  resolveDwaionActivityFilter,
  summarizeDwaionActivityWindow,
  updateDwaionActivityFilter,
  updateDwaionActivitySelection,
} from './dwaion-activity-model';

import type { DwaionUserRun } from '@dwp-frontend/shared-utils';

const runs: DwaionUserRun[] = [
  run('10000000-0000-4000-8000-000000000001', 'RUNNING', 'ALLOW', null),
  run('10000000-0000-4000-8000-000000000002', 'COMPLETED', 'ALLOW', 'COMPLETED'),
  run('10000000-0000-4000-8000-000000000003', 'COMPLETED', 'DENY', 'ABSTAINED'),
  run('10000000-0000-4000-8000-000000000004', 'FAILED', 'HANDOFF', 'CONFIGURATION_REQUIRED'),
];

describe('DWAI activity recent-window model', () => {
  it('accepts only supported URL filters and applies them to the loaded window', () => {
    expect(resolveDwaionActivityFilter('running')).toBe('RUNNING');
    expect(resolveDwaionActivityFilter('unknown')).toBe('ALL');
    expect(filterDwaionActivityWindow(runs, 'COMPLETED').map((item) => item.runId)).toEqual([
      runs[1]?.runId,
      runs[2]?.runId,
    ]);
  });

  it('summarizes only actual run, policy and answer fields without double counting attention', () => {
    expect(summarizeDwaionActivityWindow(runs)).toEqual({
      total: 4,
      running: 1,
      completed: 2,
      attention: 2,
    });
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
