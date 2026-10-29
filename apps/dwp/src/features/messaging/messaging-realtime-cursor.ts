const MAX_SIGNED_64_BIT_CURSOR = '9223372036854775807';
export const MESSAGING_REALTIME_SHARED_CURSOR_TTL_MS = 24 * 60 * 60 * 1_000;
const MESSAGING_REALTIME_CURSOR_CLOCK_SKEW_MS = 5 * 60 * 1_000;

type CursorStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type MessagingRealtimeIdentity = Readonly<{
  tenantId: string | number;
  userId: string | number;
}>;

export function messagingRealtimeScopeKey(identity: MessagingRealtimeIdentity): string {
  return `${encodeURIComponent(String(identity.tenantId))}:${encodeURIComponent(
    String(identity.userId)
  )}`;
}

export function messagingRealtimeCursorStorageKey(identity: MessagingRealtimeIdentity): string {
  return `dwp:messaging:realtime:v1:${messagingRealtimeScopeKey(identity)}:cursor`;
}

export function normalizeMessagingRealtimeCursor(value: unknown): string | null {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d{0,18})$/u.test(value)) return null;
  return value.length < 19 || value <= MAX_SIGNED_64_BIT_CURSOR ? value : null;
}

export function newestMessagingRealtimeCursor(
  current: string | null,
  candidate: unknown
): string | null {
  const next = normalizeMessagingRealtimeCursor(candidate);
  if (!next) return current;
  const previous = normalizeMessagingRealtimeCursor(current);
  if (!previous) return next;
  if (next.length !== previous.length) return next.length > previous.length ? next : previous;
  return next > previous ? next : previous;
}

export function readMessagingRealtimeCursor(
  storage: Pick<CursorStorage, 'getItem'> | null,
  key: string
): string | null {
  if (!storage) return null;
  try {
    return normalizeMessagingRealtimeCursor(storage.getItem(key));
  } catch {
    return null;
  }
}

export function storeMessagingRealtimeCursor(
  storage: Pick<CursorStorage, 'setItem'> | null,
  key: string,
  cursor: string
): void {
  const valid = normalizeMessagingRealtimeCursor(cursor);
  if (!storage || !valid) return;
  try {
    storage.setItem(key, valid);
  } catch {
    // The hook retains the cursor in memory when session storage is unavailable.
  }
}

export function clearMessagingRealtimeCursor(
  storage: Pick<CursorStorage, 'removeItem'> | null,
  key: string
): void {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // A blocked storage implementation must not prevent a cursor recovery retry.
  }
}

export function readMessagingRealtimeSharedCursor(
  storage: Pick<CursorStorage, 'getItem'> | null,
  key: string,
  now = Date.now()
): string | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as { version?: unknown; cursor?: unknown; updatedAt?: unknown };
    if (
      value.version !== 1 ||
      typeof value.updatedAt !== 'number' ||
      !Number.isFinite(value.updatedAt) ||
      value.updatedAt > now + MESSAGING_REALTIME_CURSOR_CLOCK_SKEW_MS ||
      now - value.updatedAt > MESSAGING_REALTIME_SHARED_CURSOR_TTL_MS
    ) {
      return null;
    }
    return normalizeMessagingRealtimeCursor(value.cursor);
  } catch {
    return null;
  }
}

export function storeMessagingRealtimeSharedCursor(
  storage: Pick<CursorStorage, 'setItem'> | null,
  key: string,
  cursor: string,
  now = Date.now()
): void {
  const valid = normalizeMessagingRealtimeCursor(cursor);
  if (!storage || !valid) return;
  try {
    storage.setItem(key, JSON.stringify({ version: 1, cursor: valid, updatedAt: now }));
  } catch {
    // Session storage and the active lease still cover reconnects when this store is blocked.
  }
}

export function browserSessionStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function browserLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
