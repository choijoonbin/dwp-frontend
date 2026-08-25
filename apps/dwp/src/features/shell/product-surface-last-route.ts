const STORAGE_PREFIX = 'dwp:product-surface:last-route:v1:';
const SAFE_IDENTIFIER = /^[a-zA-Z0-9._-]+$/u;
const SAFE_ROUTE_ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;

export type ProductSurfaceLastRouteIdentity = {
  tenantId: string;
  actorId: string;
  productId: string;
  surfaceId: string;
};

type StoredLastRoute = {
  version: 1;
  routeId: string;
  decisionRevision: string;
  expiresAt: string;
};

function browserSessionStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}

function validIdentifier(value: string): boolean {
  return Boolean(value && value === value.trim() && SAFE_IDENTIFIER.test(value));
}

function identityKey(identity: ProductSurfaceLastRouteIdentity): string | undefined {
  const values = [identity.tenantId, identity.actorId, identity.productId, identity.surfaceId];
  if (!values.every(validIdentifier)) return undefined;
  return `${STORAGE_PREFIX}${values.join(':')}`;
}

function parseStoredLastRoute(value: string): StoredLastRoute | undefined {
  try {
    const record = JSON.parse(value) as Partial<StoredLastRoute>;
    if (
      record.version !== 1 ||
      typeof record.routeId !== 'string' ||
      !SAFE_ROUTE_ID.test(record.routeId) ||
      typeof record.decisionRevision !== 'string' ||
      !validIdentifier(record.decisionRevision) ||
      typeof record.expiresAt !== 'string' ||
      !Number.isFinite(Date.parse(record.expiresAt))
    ) {
      return undefined;
    }
    return record as StoredLastRoute;
  } catch {
    return undefined;
  }
}

export function storeProductSurfaceLastRoute(
  identity: ProductSurfaceLastRouteIdentity,
  value: { routeId: string; decisionRevision: string; expiresAt: string },
  storage: Storage | undefined = browserSessionStorage(),
  nowMs = Date.now()
): boolean {
  const key = identityKey(identity);
  if (
    !storage ||
    !key ||
    !SAFE_ROUTE_ID.test(value.routeId) ||
    !validIdentifier(value.decisionRevision) ||
    !Number.isFinite(Date.parse(value.expiresAt)) ||
    Date.parse(value.expiresAt) <= nowMs
  ) {
    return false;
  }
  try {
    storage.setItem(
      key,
      JSON.stringify({
        version: 1,
        routeId: value.routeId,
        decisionRevision: value.decisionRevision,
        expiresAt: value.expiresAt,
      } satisfies StoredLastRoute)
    );
    return true;
  } catch {
    return false;
  }
}

export function readProductSurfaceLastRoute(
  identity: ProductSurfaceLastRouteIdentity,
  expectedRevision: string,
  storage: Storage | undefined = browserSessionStorage(),
  nowMs = Date.now()
): string | undefined {
  const key = identityKey(identity);
  if (!storage || !key || !validIdentifier(expectedRevision)) return undefined;
  try {
    const raw = storage.getItem(key);
    if (!raw) return undefined;
    const record = parseStoredLastRoute(raw);
    if (
      !record ||
      record.decisionRevision !== expectedRevision ||
      Date.parse(record.expiresAt) <= nowMs
    ) {
      storage.removeItem(key);
      return undefined;
    }
    return record.routeId;
  } catch {
    return undefined;
  }
}

export function purgeProductSurfaceLastRoutes(
  storage: Storage | undefined = browserSessionStorage()
): void {
  if (!storage) return;
  try {
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(
      (key): key is string => Boolean(key?.startsWith(STORAGE_PREFIX))
    );
    for (const key of keys) storage.removeItem(key);
  } catch {
    // Storage policy must not block logout, tenant changes, or authority invalidation.
  }
}

export function purgeForeignProductSurfaceLastRoutes(
  identity: Pick<ProductSurfaceLastRouteIdentity, 'tenantId' | 'actorId'>,
  storage: Storage | undefined = browserSessionStorage()
): void {
  if (!storage) return;
  if (!validIdentifier(identity.tenantId) || !validIdentifier(identity.actorId)) {
    purgeProductSurfaceLastRoutes(storage);
    return;
  }
  const allowedIdentityPrefix = `${STORAGE_PREFIX}${identity.tenantId}:${identity.actorId}:`;
  try {
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(
      (key): key is string =>
        Boolean(key?.startsWith(STORAGE_PREFIX) && !key.startsWith(allowedIdentityPrefix))
    );
    for (const key of keys) storage.removeItem(key);
  } catch {
    // Storage policy must not block session recovery. Exact-key reads remain identity scoped.
  }
}
