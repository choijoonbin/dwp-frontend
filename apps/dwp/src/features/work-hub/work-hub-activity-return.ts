export type WorkHubActivityReturnInput = {
  activityRoute: string;
  itemKey: string;
  itemVersion: number;
  ownerFingerprint: string;
  returnTo: string;
};

type WorkHubActivityReturnIntent = WorkHubActivityReturnInput & {
  focus: 'ACTIVITY';
  recordedAt: number;
};

type WorkHubBrowserLocation = Pick<Location, 'hash' | 'pathname' | 'search'>;
type WorkHubSessionStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;

const ACTIVITY_RETURN_INTENT_KEY = 'dwp.work.activity-return.v1';
const ACTIVITY_RETURN_INTENT_TTL_MS = 10 * 60 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const OWNER_FINGERPRINT_PATTERN = /^sha256:[0-9a-f]{64}$/u;

function containsControlOrBackslash(value: string): boolean {
  return [...value].some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return character === '\\' || code <= 31 || code === 127;
  });
}

function internalUrl(value: string): URL | null {
  if (
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.length > 2048 ||
    containsControlOrBackslash(value)
  )
    return null;
  try {
    const parsed = new URL(value, 'https://dwp.invalid');
    return parsed.origin === 'https://dwp.invalid' ? parsed : null;
  } catch {
    return null;
  }
}

function canonicalWorkReturnTarget(value: string): string | null {
  const parsed = internalUrl(value);
  if (!parsed || (parsed.pathname !== '/work' && !parsed.pathname.startsWith('/work/')))
    return null;
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function workHubActivityHandoffRoute(value: string): string | null {
  const parsed = internalUrl(value);
  if (
    !parsed ||
    parsed.pathname !== '/activity/timeline' ||
    parsed.hash ||
    parsed.searchParams.getAll('objectType').length !== 1 ||
    parsed.searchParams.get('objectType') !== 'WORK_ITEM' ||
    parsed.searchParams.getAll('objectId').length !== 1 ||
    !UUID_PATTERN.test(parsed.searchParams.get('objectId') ?? '')
  )
    return null;
  return `${parsed.pathname}${parsed.search}`;
}

function activityRouteMatchesItem(activityRoute: string, itemKey: string): boolean {
  const target = workHubActivityHandoffRoute(activityRoute);
  if (!target) return false;
  const objectId = new URL(target, 'https://dwp.invalid').searchParams.get('objectId');
  return itemKey === `WORKSPACE:${encodeURIComponent(objectId ?? '')}:`;
}

export function workHubActivityCurrentLocation(location: WorkHubBrowserLocation): string | null {
  return canonicalWorkReturnTarget(`${location.pathname}${location.search}${location.hash}`);
}

/** Compacts the complete security scope without dropping tenant, user, role, or permission changes. */
export async function workHubActivityOwnerFingerprint(ownerKey: string): Promise<string | null> {
  if (!ownerKey || !globalThis.crypto?.subtle) return null;
  try {
    const bytes = new TextEncoder().encode(ownerKey);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    const hex = [...new Uint8Array(digest)]
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('');
    return `sha256:${hex}`;
  } catch {
    return null;
  }
}

export function recordWorkHubActivityReturnIntent(
  input: WorkHubActivityReturnInput,
  storage: WorkHubSessionStorage = window.sessionStorage,
  now = Date.now()
): boolean {
  const returnTo = canonicalWorkReturnTarget(input.returnTo);
  const activityRoute = workHubActivityHandoffRoute(input.activityRoute);
  if (
    !returnTo ||
    !activityRoute ||
    !input.itemKey ||
    input.itemKey.length > 1024 ||
    !Number.isSafeInteger(input.itemVersion) ||
    input.itemVersion < 0 ||
    !activityRouteMatchesItem(activityRoute, input.itemKey) ||
    !OWNER_FINGERPRINT_PATTERN.test(input.ownerFingerprint)
  )
    return false;
  const intent: WorkHubActivityReturnIntent = {
    activityRoute,
    focus: 'ACTIVITY',
    itemKey: input.itemKey,
    itemVersion: input.itemVersion,
    ownerFingerprint: input.ownerFingerprint,
    recordedAt: now,
    returnTo,
  };
  try {
    storage.setItem(ACTIVITY_RETURN_INTENT_KEY, JSON.stringify(intent));
    return true;
  } catch {
    return false;
  }
}

export function consumeWorkHubActivityReturnIntent(
  input: {
    canUseActivity: boolean;
    itemKey: string | null;
    itemVersion: number | null;
    ownerFingerprint: string | null;
    returnTo: string;
  },
  storage: WorkHubSessionStorage = window.sessionStorage,
  now = Date.now()
): boolean {
  let value: string | null = null;
  try {
    value = storage.getItem(ACTIVITY_RETURN_INTENT_KEY);
    if (!value) return false;
    const intent = JSON.parse(value) as Partial<WorkHubActivityReturnIntent>;
    return (
      input.canUseActivity &&
      intent.focus === 'ACTIVITY' &&
      intent.itemKey === input.itemKey &&
      intent.itemVersion === input.itemVersion &&
      typeof intent.ownerFingerprint === 'string' &&
      OWNER_FINGERPRINT_PATTERN.test(intent.ownerFingerprint) &&
      intent.ownerFingerprint === input.ownerFingerprint &&
      intent.returnTo === canonicalWorkReturnTarget(input.returnTo) &&
      activityRouteMatchesItem(intent.activityRoute ?? '', intent.itemKey ?? '') &&
      typeof intent.recordedAt === 'number' &&
      now >= intent.recordedAt &&
      now - intent.recordedAt <= ACTIVITY_RETURN_INTENT_TTL_MS
    );
  } catch {
    return false;
  } finally {
    if (value) {
      try {
        storage.removeItem(ACTIVITY_RETURN_INTENT_KEY);
      } catch {
        // Storage cleanup is best effort; an invalid intent still never restores focus.
      }
    }
  }
}
