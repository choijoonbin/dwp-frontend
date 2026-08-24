import {
  isProductSurfaceManifest,
  matchesProductRoute,
  normalizeProductPath,
  type ProductManifest,
  type ProductSurfaceManifest,
} from '../components/product-manifest';

export type RegisteredProductRouteBase = {
  productId: string;
  surfaceId: string;
  routeContractKey: string;
};

export type RegisteredProductRoute = RegisteredProductRouteBase &
  (
    | { routeKind: 'PAGE'; routeId: string; pattern: `/${string}` }
    | { routeKind: 'DATA' | 'ACTION'; routeId?: never; pattern?: never }
  );

/** Router-owned input. Authorization profiles and API bindings must never be added here. */
export type ProductPageRouteContractSource = {
  routeId: string;
  pattern: `/${string}`;
  productId: string;
  surfaceId: string;
  routeContractKey: string;
  legacyRedirectIds?: readonly string[];
};

export type ProductRouteKeyProjection = {
  routeId: string;
  routeContractKey: string;
  productId: string;
  surfaceId: string;
};

export type ProductLegacyRedirectRegistryRecord = {
  redirectId: string;
  productId: string;
  routeId: string;
};

export type ProductLegacyRouteSource = {
  redirectId: string;
  sourcePath: `/${string}`;
  targetRouteContractKey: string;
  preserveQuery: true;
  preserveHash: true;
  maxHops: 1;
};

export type ResolvedProductLegacyRoute = {
  redirectId: string;
  target: string;
  maxHops: 1;
};

const ROUTE_ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const ROUTE_CONTRACT_PATTERN = /^route\.[a-z0-9]+(?:[.-][a-z0-9]+)*\.page$/u;

function assertRoutePattern(pattern: string, routeId: string): void {
  if (
    !pattern.startsWith('/') ||
    pattern.includes('?') ||
    pattern.includes('#') ||
    pattern.includes('..') ||
    pattern.includes('//') ||
    (pattern.length > 1 && pattern.endsWith('/'))
  ) {
    throw new Error(`Product page route pattern is not canonical: ${routeId}`);
  }
  const segments = pattern.slice(1).split('/');
  if (
    segments.some(
      (segment, index) =>
        !segment ||
        (segment === '*' && index !== segments.length - 1) ||
        (segment.startsWith(':') && !/^[a-zA-Z][a-zA-Z0-9]*$/u.test(segment.slice(1)))
    )
  ) {
    throw new Error(`Product page route pattern has an invalid segment: ${routeId}`);
  }
}

function surfaceContractSegment(manifest: ProductSurfaceManifest, surfaceId: string): string {
  const prefix = `${manifest.id}.`;
  return surfaceId.startsWith(prefix) ? surfaceId.slice(prefix.length) : surfaceId;
}

export function defineProductRouteContractSource(
  records: readonly ProductPageRouteContractSource[],
  manifests: readonly ProductManifest[] = []
): readonly ProductPageRouteContractSource[] {
  const surfaceManifests = manifests.filter(isProductSurfaceManifest);
  const routeIds = new Set<string>();
  const patterns = new Set<string>();
  const contractKeys = new Set<string>();
  for (const record of records) {
    if (!ROUTE_ID_PATTERN.test(record.routeId) || routeIds.has(record.routeId)) {
      throw new Error(`Product page route id is invalid or duplicated: ${record.routeId}`);
    }
    routeIds.add(record.routeId);
    assertRoutePattern(record.pattern, record.routeId);
    const normalizedPattern = normalizeProductPath(record.pattern);
    if (patterns.has(normalizedPattern)) {
      throw new Error(`Product page route pattern is duplicated: ${record.pattern}`);
    }
    patterns.add(normalizedPattern);
    if (!ROUTE_CONTRACT_PATTERN.test(record.routeContractKey)) {
      throw new Error(`Product page route contract key is invalid: ${record.routeContractKey}`);
    }
    if (contractKeys.has(record.routeContractKey)) {
      throw new Error(`Product page route contract key is duplicated: ${record.routeContractKey}`);
    }
    contractKeys.add(record.routeContractKey);
    if (manifests.length === 0) continue;
    const manifest = surfaceManifests.find((candidate) => candidate.id === record.productId);
    if (!manifest)
      throw new Error(`Product page route references an unknown product: ${record.routeId}`);
    const surface = manifest.surfaces.find((candidate) => candidate.id === record.surfaceId);
    if (!surface)
      throw new Error(`Product page route references an unknown surface: ${record.routeId}`);
    if (!surface.routeMatchers.some((matcher) => matchesProductRoute(record.pattern, matcher))) {
      throw new Error(`Product page route is outside its surface boundary: ${record.routeId}`);
    }
    const expectedContractPrefix = `route.${manifest.id}.${surfaceContractSegment(
      manifest,
      surface.id
    )}.`;
    if (!record.routeContractKey.startsWith(expectedContractPrefix)) {
      throw new Error(
        `Product page route contract is outside its product surface: ${record.routeId}`
      );
    }
    const knownRedirectIds = new Set((manifest.legacyRedirects ?? []).map(({ id }) => id));
    for (const redirectId of record.legacyRedirectIds ?? []) {
      if (!knownRedirectIds.has(redirectId)) {
        throw new Error(`Product page route references an unknown legacy redirect: ${redirectId}`);
      }
    }
  }
  return records;
}

export function defineProductLegacyRouteSource(
  redirects: readonly ProductLegacyRouteSource[],
  pageRoutes: readonly ProductPageRouteContractSource[]
): readonly ProductLegacyRouteSource[] {
  const redirectIds = new Set<string>();
  const sourcePaths = new Set<string>();
  const routesByKey = new Map(pageRoutes.map((route) => [route.routeContractKey, route]));
  const redirectSources = new Set(
    redirects.map((redirect) => normalizeProductPath(redirect.sourcePath))
  );
  for (const redirect of redirects) {
    if (!redirect.redirectId.trim() || redirectIds.has(redirect.redirectId)) {
      throw new Error(
        `Product legacy redirect id is invalid or duplicated: ${redirect.redirectId}`
      );
    }
    redirectIds.add(redirect.redirectId);
    const sourcePath = normalizeProductPath(redirect.sourcePath);
    if (sourcePath !== redirect.sourcePath || sourcePaths.has(sourcePath)) {
      throw new Error(
        `Product legacy redirect source is invalid or duplicated: ${redirect.sourcePath}`
      );
    }
    sourcePaths.add(sourcePath);
    if (!redirect.preserveQuery || !redirect.preserveHash || redirect.maxHops !== 1) {
      throw new Error(
        `Product legacy redirect must preserve URL state for one hop: ${redirect.redirectId}`
      );
    }
    const target = routesByKey.get(redirect.targetRouteContractKey);
    if (!target) {
      throw new Error(
        `Product legacy redirect references an unknown target: ${redirect.redirectId}`
      );
    }
    if (target.pattern.includes(':') || target.pattern.includes('*')) {
      throw new Error(`Product legacy redirect target must be static: ${redirect.redirectId}`);
    }
    if (
      sourcePath === target.pattern ||
      redirectSources.has(normalizeProductPath(target.pattern))
    ) {
      throw new Error(`Product legacy redirect forms a cycle: ${redirect.redirectId}`);
    }
  }
  return redirects;
}

export function resolveProductLegacyRoute(
  pathname: string,
  search: string,
  hash: string,
  redirects: readonly ProductLegacyRouteSource[],
  pageRoutes: readonly ProductPageRouteContractSource[]
): ResolvedProductLegacyRoute | undefined {
  const normalizedPath = normalizeProductPath(pathname);
  const redirect = redirects.find(
    (candidate) => normalizeProductPath(candidate.sourcePath) === normalizedPath
  );
  if (!redirect) return undefined;
  const route = pageRoutes.find(
    (candidate) => candidate.routeContractKey === redirect.targetRouteContractKey
  );
  if (!route || route.pattern.includes(':') || route.pattern.includes('*')) return undefined;
  return {
    redirectId: redirect.redirectId,
    target: `${route.pattern}${redirect.preserveQuery ? search : ''}${
      redirect.preserveHash ? hash : ''
    }`,
    maxHops: redirect.maxHops,
  };
}

export function generateRegisteredProductRouteCatalog(
  source: readonly ProductPageRouteContractSource[]
): readonly RegisteredProductRoute[] {
  return source.map((record) => ({
    productId: record.productId,
    surfaceId: record.surfaceId,
    routeContractKey: record.routeContractKey,
    routeKind: 'PAGE',
    routeId: record.routeId,
    pattern: record.pattern,
  }));
}

export function generateProductRouteKeyProjection(
  source: readonly ProductPageRouteContractSource[]
): readonly ProductRouteKeyProjection[] {
  return source.map(({ routeId, routeContractKey, productId, surfaceId }) => ({
    routeId,
    routeContractKey,
    productId,
    surfaceId,
  }));
}

export function generateProductLegacyRedirectRegistry(
  source: readonly ProductPageRouteContractSource[]
): readonly ProductLegacyRedirectRegistryRecord[] {
  return source.flatMap((record) =>
    (record.legacyRedirectIds ?? []).map((redirectId) => ({
      redirectId,
      productId: record.productId,
      routeId: record.routeId,
    }))
  );
}
