export const MESSAGING_CROSS_TAB_LEASE_TTL_MS = 12_000;
export const MESSAGING_CROSS_TAB_LEASE_RENEW_MS = 4_000;

type LeaseValue = Readonly<{
  version: 1;
  owner: string;
  expiresAt: number;
  cursor?: string;
}>;

type LeaseStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export class MessagingCrossTabLease {
  readonly key: string;
  readonly owner: string;

  private storageAvailable = true;

  constructor({
    name,
    owner = messagingTabId(),
    storage = browserLocalStorage(),
  }: {
    name: string;
    owner?: string;
    storage?: LeaseStorage | null;
  }) {
    this.key = `dwp:messaging:leader:${name}:v1`;
    this.owner = owner;
    this.storage = storage;
  }

  private readonly storage: LeaseStorage | null;

  claim(now = Date.now(), cursor?: string | null): boolean {
    if (!this.storage || !this.storageAvailable) return true;
    const current = this.read();
    if (
      current &&
      current.owner !== this.owner &&
      current.expiresAt > now &&
      current.expiresAt <= now + MESSAGING_CROSS_TAB_LEASE_TTL_MS * 2
    ) {
      return false;
    }
    if (
      !this.write({
        version: 1,
        owner: this.owner,
        expiresAt: now + MESSAGING_CROSS_TAB_LEASE_TTL_MS,
        ...this.retainedCursor(current, now, cursor),
      })
    ) {
      return true;
    }
    return this.read()?.owner === this.owner;
  }

  renew(now = Date.now(), cursor?: string | null): boolean {
    if (!this.storage || !this.storageAvailable) return true;
    const current = this.read();
    if (!current || current.owner !== this.owner) return false;
    if (
      !this.write({
        version: 1,
        owner: this.owner,
        expiresAt: now + MESSAGING_CROSS_TAB_LEASE_TTL_MS,
        ...this.retainedCursor(current, now, cursor),
      })
    ) {
      return true;
    }
    return this.read()?.owner === this.owner;
  }

  release(): void {
    if (!this.storage || !this.storageAvailable) return;
    const current = this.read();
    if (current?.owner !== this.owner) return;
    try {
      this.storage.removeItem(this.key);
    } catch {
      this.storageAvailable = false;
    }
  }

  cursor(now = Date.now()): string | null {
    const current = this.read();
    if (
      !current ||
      current.expiresAt < now - MESSAGING_CROSS_TAB_LEASE_TTL_MS * 2 ||
      current.expiresAt > now + MESSAGING_CROSS_TAB_LEASE_TTL_MS * 2
    ) {
      return null;
    }
    return current.cursor ?? null;
  }

  clearCursor(now = Date.now()): void {
    if (!this.storage || !this.storageAvailable) return;
    const current = this.read();
    if (!current || current.owner !== this.owner) return;
    this.write({
      version: 1,
      owner: this.owner,
      expiresAt: Math.max(current.expiresAt, now),
    });
  }

  private read(): LeaseValue | null {
    if (!this.storage || !this.storageAvailable) return null;
    try {
      const raw = this.storage.getItem(this.key);
      if (!raw) return null;
      const value = JSON.parse(raw) as Partial<LeaseValue>;
      if (
        value.version !== 1 ||
        typeof value.owner !== 'string' ||
        value.owner.length === 0 ||
        typeof value.expiresAt !== 'number' ||
        !Number.isFinite(value.expiresAt)
      ) {
        return null;
      }
      return {
        version: 1,
        owner: value.owner,
        expiresAt: value.expiresAt,
        ...(typeof value.cursor === 'string' ? { cursor: value.cursor } : {}),
      };
    } catch {
      this.storageAvailable = false;
      return null;
    }
  }

  private write(value: LeaseValue): boolean {
    if (!this.storage || !this.storageAvailable) return false;
    try {
      this.storage.setItem(this.key, JSON.stringify(value));
      return true;
    } catch {
      this.storageAvailable = false;
      return false;
    }
  }

  private retainedCursor(
    current: LeaseValue | null,
    now: number,
    cursor?: string | null
  ): Pick<LeaseValue, 'cursor'> {
    if (cursor === null) return {};
    if (cursor !== undefined) return { cursor };
    return current?.cursor &&
      current.expiresAt >= now - MESSAGING_CROSS_TAB_LEASE_TTL_MS * 2 &&
      current.expiresAt <= now + MESSAGING_CROSS_TAB_LEASE_TTL_MS * 2
      ? { cursor: current.cursor }
      : {};
  }
}

export function openMessagingBroadcastChannel(name: string): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  try {
    return new BroadcastChannel(`dwp:messaging:${name}:v1`);
  } catch {
    return null;
  }
}

function messagingTabId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function browserLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
