import { createContext, useContext, useSyncExternalStore } from 'react';

import { useBrowserOnlineState } from './messaging-presence-freshness';

import type { MessagingConnectionState } from './use-messaging-realtime';
import type { ReactNode } from 'react';

const MessagingConnectionStateContext = createContext<MessagingConnectionState>('polling');

export function MessagingConnectionStateProvider({
  state,
  children,
}: {
  state: MessagingConnectionState;
  children: ReactNode;
}) {
  return (
    <MessagingConnectionStateContext.Provider value={state}>
      {children}
    </MessagingConnectionStateContext.Provider>
  );
}

export function messagingAdaptivePollingInterval({
  state,
  online,
  visible,
  activeIntervalMs,
  reconnectIntervalMs = Math.min(activeIntervalMs, 8_000),
  hiddenIntervalMs = Math.max(activeIntervalMs * 4, 60_000),
}: {
  state: MessagingConnectionState;
  online: boolean;
  visible: boolean;
  activeIntervalMs: number;
  reconnectIntervalMs?: number;
  hiddenIntervalMs?: number;
}): number | false {
  if (!online || state === 'offline' || state === 'live') return false;
  if (!visible) return hiddenIntervalMs;
  if (state === 'reconnecting' || state === 'connecting') return reconnectIntervalMs;
  return activeIntervalMs;
}

export function useMessagingAdaptivePollingInterval(activeIntervalMs: number): number | false {
  const state = useContext(MessagingConnectionStateContext);
  const online = useBrowserOnlineState();
  const visible = useDocumentVisibleState();
  return messagingAdaptivePollingInterval({ state, online, visible, activeIntervalMs });
}

export function useDocumentVisibleState() {
  return useSyncExternalStore(subscribeDocumentVisibility, documentVisibleSnapshot, () => true);
}

function subscribeDocumentVisibility(notify: () => void) {
  if (typeof document === 'undefined') return () => undefined;
  document.addEventListener('visibilitychange', notify);
  return () => document.removeEventListener('visibilitychange', notify);
}

function documentVisibleSnapshot() {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}
