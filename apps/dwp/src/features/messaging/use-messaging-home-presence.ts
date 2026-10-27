import { useEffect, useState } from 'react';

import {
  messagingHomePresenceLeaseExpiresAt,
  resolveMessagingHomePresence,
} from './messaging-home-model';
import { useBrowserOnlineState } from './messaging-presence-freshness';

import type { MessagingHome } from '@dwp-frontend/shared-utils';

export function useMessagingHomePresence(
  home: MessagingHome | undefined,
  queryFailed: boolean,
  dataUpdatedAt: number
) {
  const online = useBrowserOnlineState();
  const [observedAt, setObservedAt] = useState(Date.now);
  const leaseExpiresAt = home
    ? messagingHomePresenceLeaseExpiresAt(home, dataUpdatedAt)
    : undefined;

  useEffect(() => {
    const synchronizeVisible = () => {
      if (document.visibilityState === 'visible') setObservedAt(Date.now());
    };
    document.addEventListener('visibilitychange', synchronizeVisible);
    return () => {
      document.removeEventListener('visibilitychange', synchronizeVisible);
    };
  }, []);

  useEffect(() => {
    if (leaseExpiresAt === undefined) return;
    const delay = Math.max(0, leaseExpiresAt - Date.now() + 1);
    const timer = window.setTimeout(
      () => setObservedAt(Date.now()),
      Math.min(delay, 2_147_483_647)
    );
    return () => window.clearTimeout(timer);
  }, [leaseExpiresAt]);

  return home
    ? resolveMessagingHomePresence(home, {
        queryFailed,
        online,
        observedAt: Math.max(observedAt, Date.now()),
        dataUpdatedAt,
      })
    : undefined;
}
