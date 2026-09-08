import type { DwaionUserRun } from '@dwp-frontend/shared-utils';

export const DWAION_ACTIVITY_WINDOW_LIMIT = 100;
export const DWAION_ACTIVITY_FILTERS = [
  'ALL',
  'RUNNING',
  'COMPLETED',
  'ATTENTION',
  'FAILED',
] as const;

export type DwaionActivityFilter = (typeof DWAION_ACTIVITY_FILTERS)[number];

export type DwaionActivityWindowSummary = {
  total: number;
  running: number;
  completed: number;
  attention: number;
  sample: number;
};

export function resolveDwaionActivityFilter(value: string | null): DwaionActivityFilter {
  const normalized = value?.trim().toUpperCase();
  return DWAION_ACTIVITY_FILTERS.includes(normalized as DwaionActivityFilter)
    ? (normalized as DwaionActivityFilter)
    : 'ALL';
}

export function filterDwaionActivityWindow(
  runs: readonly DwaionUserRun[],
  filter: DwaionActivityFilter
): DwaionUserRun[] {
  if (filter === 'ALL') return [...runs];
  if (filter === 'ATTENTION') return runs.filter(needsAttention);
  return runs.filter((run) => run.runState === filter);
}

export function findExactDwaionRun(
  runs: readonly DwaionUserRun[],
  runId: string
): DwaionUserRun | undefined {
  const normalized = runId.toLowerCase();
  return runs.find((run) => run.runId.toLowerCase() === normalized);
}

export function summarizeDwaionActivityWindow(
  runs: readonly DwaionUserRun[]
): DwaionActivityWindowSummary {
  const operationalRuns = runs.filter((run) => run.dataProvenance !== 'SAMPLE');
  return {
    total: operationalRuns.length,
    running: operationalRuns.filter((run) => run.runState === 'RUNNING').length,
    completed: operationalRuns.filter((run) => run.runState === 'COMPLETED').length,
    attention: operationalRuns.filter(needsAttention).length,
    sample: runs.length - operationalRuns.length,
  };
}

function needsAttention(run: DwaionUserRun): boolean {
  return (
    run.runState === 'FAILED' ||
    run.policyOutcome === 'DENY' ||
    run.answerState === 'CONFIGURATION_REQUIRED'
  );
}

export function updateDwaionActivityFilter(
  current: URLSearchParams,
  filter: DwaionActivityFilter
): URLSearchParams {
  const next = new URLSearchParams(current);
  if (filter === 'ALL') next.delete('state');
  else next.set('state', filter);
  return next;
}

export function updateDwaionActivitySelection(
  current: URLSearchParams,
  runId: string | null
): URLSearchParams {
  const next = new URLSearchParams(current);
  if (runId) next.set('run', runId);
  else next.delete('run');
  return next;
}
