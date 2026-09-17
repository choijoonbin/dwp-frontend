import type { DwaionUserRun } from '@dwp-frontend/shared-utils';

export const DWAION_ACTIVITY_PAGE_LIMIT = 50;
export const DWAION_ACTIVITY_FILTERS = [
  'ALL',
  'RUNNING',
  'COMPLETED',
  'ATTENTION',
  'FAILED',
] as const;
export const DWAION_ACTIVITY_PERIODS = ['DAY', 'WEEK', 'MONTH'] as const;

export type DwaionActivityFilter = (typeof DWAION_ACTIVITY_FILTERS)[number];
export type DwaionActivityPeriod = (typeof DWAION_ACTIVITY_PERIODS)[number];

export type DwaionActivityWindowSummary = {
  total: number;
  running: number;
  completed: number;
  attention: number;
  sample: number;
};

export function dwaionActivityPeriodStart(period: DwaionActivityPeriod, now = Date.now()): string {
  const days = period === 'DAY' ? 1 : period === 'WEEK' ? 7 : 30;
  return new Date(now - days * 24 * 60 * 60 * 1_000).toISOString();
}

export function resolveDwaionActivityFilter(value: string | null): DwaionActivityFilter {
  const normalized = value?.trim().toUpperCase();
  return DWAION_ACTIVITY_FILTERS.includes(normalized as DwaionActivityFilter)
    ? (normalized as DwaionActivityFilter)
    : 'ALL';
}

export function resolveDwaionActivityPeriod(value: string | null): DwaionActivityPeriod {
  const normalized = value?.trim().toUpperCase();
  return DWAION_ACTIVITY_PERIODS.includes(normalized as DwaionActivityPeriod)
    ? (normalized as DwaionActivityPeriod)
    : 'MONTH';
}

export function filterDwaionActivityPeriod(
  runs: readonly DwaionUserRun[],
  period: DwaionActivityPeriod,
  now = Date.now()
): DwaionUserRun[] {
  const cutoff = Date.parse(dwaionActivityPeriodStart(period, now));
  return runs.filter((run) => {
    const timestamp = Date.parse(run.createdAt);
    return Number.isFinite(timestamp) && timestamp >= cutoff && timestamp <= now + 60_000;
  });
}

export function filterDwaionActivityWindow(
  runs: readonly DwaionUserRun[],
  filter: DwaionActivityFilter
): DwaionUserRun[] {
  if (filter === 'ALL') return [...runs];
  if (filter === 'ATTENTION') return runs.filter(needsAttention);
  return runs.filter((run) => run.runState === filter);
}

export function hasExpiredDwaionRunLease(run: DwaionUserRun): boolean {
  return run.runState === 'RUNNING' && run.lease?.status === 'EXPIRED';
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
    run.answerState === 'CONFIGURATION_REQUIRED' ||
    hasExpiredDwaionRunLease(run)
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

export function updateDwaionActivityPeriod(
  current: URLSearchParams,
  period: DwaionActivityPeriod
): URLSearchParams {
  const next = new URLSearchParams(current);
  if (period === 'MONTH') next.delete('period');
  else next.set('period', period);
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
