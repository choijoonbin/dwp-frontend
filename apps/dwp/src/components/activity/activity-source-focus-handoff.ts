import type { WorkspaceActivityEvent } from '@dwp-frontend/shared-utils';

const HISTORY_KEY = 'dwpActivitySourceReturnFocus';

type ActivitySourceReturnFocus = {
  eventId: string;
  location: string;
  sourceRoute: string;
};

type ActivitySourceFocusEvent = Pick<WorkspaceActivityEvent, 'id' | 'sourceAccess' | 'sourceRoute'>;

function currentLocation(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function historyState(): Record<string, unknown> {
  const state: unknown = window.history.state;
  return state !== null && typeof state === 'object' ? { ...state } : {};
}

export function recordActivitySourceReturnFocus(event: ActivitySourceFocusEvent): void {
  if (typeof window === 'undefined' || !event.sourceRoute) return;
  const marker: ActivitySourceReturnFocus = {
    eventId: event.id,
    location: currentLocation(),
    sourceRoute: event.sourceRoute,
  };
  window.history.replaceState({ ...historyState(), [HISTORY_KEY]: marker }, '');
}

export function consumeActivitySourceReturnFocus(event: ActivitySourceFocusEvent): boolean {
  if (typeof window === 'undefined') return false;
  const state = historyState();
  const candidate = state[HISTORY_KEY];
  if (candidate === null || typeof candidate !== 'object') return false;
  const marker = candidate as Partial<ActivitySourceReturnFocus>;
  if (marker.location !== currentLocation()) return false;
  const matches =
    marker.eventId === event.id &&
    marker.sourceRoute === event.sourceRoute &&
    event.sourceAccess === 'AVAILABLE';
  delete state[HISTORY_KEY];
  window.history.replaceState(state, '');
  return matches;
}
