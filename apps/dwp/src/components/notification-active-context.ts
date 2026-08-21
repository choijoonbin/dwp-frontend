import { useEffect, useMemo } from 'react';

import type { NotificationItem } from '@dwp-frontend/shared-utils/api/notification-api';

type ContextRegistration = {
  registrationId: symbol;
  keys: ReadonlySet<string>;
};

const registrations = new Map<symbol, ContextRegistration>();

function normalizeContextKeys(keys: readonly (string | null | undefined)[]): ReadonlySet<string> {
  return new Set(keys.map((key) => key?.trim()).filter((key): key is string => Boolean(key)));
}

export function registerNotificationActiveContexts(
  keys: readonly (string | null | undefined)[]
): () => void {
  const registrationId = Symbol('notification-active-context');
  registrations.set(registrationId, {
    registrationId,
    keys: normalizeContextKeys(keys),
  });
  return () => registrations.delete(registrationId);
}

export function useNotificationActiveContexts(keys: readonly (string | null | undefined)[]): void {
  const normalizedKey = useMemo(
    () => [...normalizeContextKeys(keys)].sort().join('\u0000'),
    [keys]
  );

  useEffect(() => {
    if (!normalizedKey) return undefined;
    return registerNotificationActiveContexts(normalizedKey.split('\u0000'));
  }, [normalizedKey]);
}

export function isNotificationTargetActive(item: NotificationItem, visible: boolean): boolean {
  const threadKey = item.threadKey?.trim();
  if (!visible || !threadKey) return false;
  return [...registrations.values()].some((registration) => registration.keys.has(threadKey));
}

export const notificationContextKeys = {
  messagingConversation: (conversationId: string) =>
    `messaging-conversation:${conversationId.trim()}`,
};
