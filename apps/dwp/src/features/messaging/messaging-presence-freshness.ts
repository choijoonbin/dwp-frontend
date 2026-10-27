import { useSyncExternalStore } from 'react';

import type { MessagingPerson } from '@dwp-frontend/shared-utils';

type PresenceBearing = Readonly<{
  presenceState: MessagingPerson['presenceState'];
}>;

function subscribeBrowserOnlineState(notify: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener('online', notify);
  window.addEventListener('offline', notify);
  document.addEventListener('visibilitychange', notify);
  return () => {
    window.removeEventListener('online', notify);
    window.removeEventListener('offline', notify);
    document.removeEventListener('visibilitychange', notify);
  };
}

function browserOnlineSnapshot(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

/** Reactively follows the browser's explicit online/offline signal. */
export function useBrowserOnlineState(): boolean {
  return useSyncExternalStore(subscribeBrowserOnlineState, browserOnlineSnapshot, () => true);
}

/**
 * Cached presence is not authoritative while the browser is offline. Project it to UNKNOWN
 * without mutating the query cache so a successful refresh can restore the server response.
 */
export function maskMessagingPresence<T extends PresenceBearing>(
  people: T[],
  online: boolean
): T[] {
  if (online) return people;
  return people.map((person) =>
    person.presenceState === 'UNKNOWN' ? person : { ...person, presenceState: 'UNKNOWN' as const }
  );
}
