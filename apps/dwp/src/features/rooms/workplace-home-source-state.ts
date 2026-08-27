import { isAuthoritativeWorkplaceReadFailure } from './workplace-authority-failure';

export type WorkplaceHomeSourceState =
  'LOADING' | 'READY' | 'STALE' | 'DENIED' | 'UNAVAILABLE' | 'SKIPPED';

type SourceSnapshot<T> = {
  data: T | undefined;
  error: unknown;
  isError: boolean;
  isPending: boolean;
  required: boolean;
};

export function workplaceHomeSourceState<T>(snapshot: SourceSnapshot<T>): WorkplaceHomeSourceState {
  if (!snapshot.required) return 'SKIPPED';
  if (snapshot.isError) {
    if (isAuthoritativeWorkplaceReadFailure(snapshot.error)) return 'DENIED';
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
