import { useEffect, useState } from 'react';
import {
  NOTIFICATION_CONNECTION_STATE_EVENT,
  NOTIFICATION_LIVE_EVENT,
  NOTIFICATION_SYNC_RESET_EVENT,
  getNotificationConnectionState,
  parseNotificationConnectionStateSignal,
  parseNotificationLiveSignal,
  parseNotificationSyncResetSignal,
  type NotificationLiveSignal,
} from '@dwp-frontend/shared-utils/api/notification-api';

export type NotificationConnectionState = 'live' | 'polling' | 'offline';

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return reduced;
}

/**
 * The approved shell transport dispatches a content-free CustomEvent after SSE version
 * reconciliation. The feature never opens an ungoverned transport on its own.
 */
export function useNotificationLiveUpdates(
  onSignal: (signal: NotificationLiveSignal) => void
): NotificationConnectionState {
  const online = useOnlineStatus();
  const [connectionState, setConnectionState] = useState(getNotificationConnectionState);

  useEffect(() => {
    const listener = (event: Event) => {
      const signal = parseNotificationLiveSignal((event as CustomEvent<unknown>).detail);
      if (!signal) return;
      setConnectionState('live');
      onSignal(signal);
    };
    window.addEventListener(NOTIFICATION_LIVE_EVENT, listener);
    return () => window.removeEventListener(NOTIFICATION_LIVE_EVENT, listener);
  }, [onSignal]);

  useEffect(() => {
    const listener = (event: Event) => {
      const signal = parseNotificationConnectionStateSignal((event as CustomEvent<unknown>).detail);
      if (signal) setConnectionState(signal.state);
    };
    window.addEventListener(NOTIFICATION_CONNECTION_STATE_EVENT, listener);
    return () => window.removeEventListener(NOTIFICATION_CONNECTION_STATE_EVENT, listener);
  }, []);

  if (!online) return 'offline';
  return connectionState;
}

export function useNotificationSyncResetSignal(): {
  resetRequired: boolean;
  clearResetRequired: () => void;
} {
  const [resetRequired, setResetRequired] = useState(false);

  useEffect(() => {
    const listener = (event: Event) => {
      const signal = parseNotificationSyncResetSignal((event as CustomEvent<unknown>).detail);
      if (signal) setResetRequired(true);
    };
    window.addEventListener(NOTIFICATION_SYNC_RESET_EVENT, listener);
    return () => window.removeEventListener(NOTIFICATION_SYNC_RESET_EVENT, listener);
  }, []);

  return {
    resetRequired,
    clearResetRequired: () => setResetRequired(false),
  };
}
