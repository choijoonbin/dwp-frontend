import { isAuthoritativeWorkplaceReadFailure } from './workplace-authority-failure';

export type WorkplaceHomeSourceState =
  'LOADING' | 'READY' | 'STALE' | 'DENIED' | 'UNAVAILABLE' | 'SKIPPED';

type SourceSnapshot<T> = {
  data: T | undefined;
  error: unknown;
  failureCount?: number;
  failureReason?: unknown;
  isError: boolean;
  isPending: boolean;
  required: boolean;
};

export function workplaceHomeSourceState<T>(snapshot: SourceSnapshot<T>): WorkplaceHomeSourceState {
  if (!snapshot.required) return 'SKIPPED';
  const failed = snapshot.isError || (snapshot.failureCount ?? 0) > 0;
  if (failed) {
    const failure = snapshot.failureReason ?? snapshot.error;
    if (isAuthoritativeWorkplaceReadFailure(failure)) return 'DENIED';
    return snapshot.data === undefined ? 'UNAVAILABLE' : 'STALE';
  }
  if (snapshot.data !== undefined) return 'READY';
  return snapshot.isPending ? 'LOADING' : 'UNAVAILABLE';
}

export function workplaceHomeSourceData<T>(state: WorkplaceHomeSourceState, data: T | undefined) {
  return state === 'READY' || state === 'STALE' ? data : undefined;
}

export function workplaceHomeSourceComplete(state: WorkplaceHomeSourceState) {
  return state === 'READY' || state === 'SKIPPED';
}
