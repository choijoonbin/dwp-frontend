import {
  isSegmentOwnedPath,
  matchesProductRoute,
  normalizeProductPath,
  type LegacyRedirectDefinition,
  type ProductSurfaceManifest,
} from '../../components/product-manifest';

import type { RegisteredProductRoute } from '../../routes/product-route-contract-source';

export type ProductSurfaceResolution =
  | { type: 'product-entry'; productId: string }
  | { type: 'known-route'; productId: string; surfaceId: string; routeId: string }
  | { type: 'unknown-surface-path'; productId: string; surfaceId: string }
  | { type: 'unknown-product-path'; productId: string }
  | { type: 'outside-product' };

export type LegacyProductRedirectResolution =
  | { type: 'no-redirect' }
  | { type: 'redirect'; redirectId: string; to: string; replace: true }
  | {
      type: 'surface-not-found' | 'product-not-found';
      redirectId: string;
      attemptedTarget?: string;
    };

function registeredPageMatches(pathname: string, pattern: string): boolean {
  const pathSegments = normalizeProductPath(pathname).slice(1).split('/');
  const patternSegments = normalizeProductPath(pattern).slice(1).split('/');
  if (pathSegments.length === 1 && pathSegments[0] === '') pathSegments.length = 0;
  if (patternSegments.length === 1 && patternSegments[0] === '') patternSegments.length = 0;

  for (let index = 0; index < patternSegments.length; index += 1) {
    const patternSegment = patternSegments[index]!;
    if (patternSegment === '*') return index === patternSegments.length - 1;
    const pathSegment = pathSegments[index];
    if (pathSegment === undefined) return false;
    if (patternSegment.startsWith(':')) continue;
    if (patternSegment !== pathSegment) return false;
  }
  return pathSegments.length === patternSegments.length;
}

function findOwningProduct(
  pathname: string,
  manifests: readonly ProductSurfaceManifest[]
): ProductSurfaceManifest | undefined {
  return [...manifests]
    .filter((manifest) => isSegmentOwnedPath(pathname, manifest.basePath))
    .sort((left, right) => right.basePath.length - left.basePath.length)[0];
}

export function resolveProductSurface(
  pathname: string,
  manifests: readonly ProductSurfaceManifest[],
  registeredProductRouteCatalog: readonly RegisteredProductRoute[]
): ProductSurfaceResolution {
  const normalizedPath = normalizeProductPath(pathname);
  const manifest = findOwningProduct(normalizedPath, manifests);
  if (!manifest) return { type: 'outside-product' };
  if (normalizedPath === manifest.basePath) {
    return { type: 'product-entry', productId: manifest.id };
  }

  const surfaceCandidates = manifest.surfaces.flatMap((surface) =>
    surface.routeMatchers
      .filter((matcher) => matchesProductRoute(normalizedPath, matcher))
      .map((matcher) => ({ surface, matcher }))
  );
  surfaceCandidates.sort((left, right) => right.matcher.path.length - left.matcher.path.length);
  const owningCandidate = surfaceCandidates[0];
  if (!owningCandidate) return { type: 'unknown-product-path', productId: manifest.id };
  const longestLength = owningCandidate.matcher.path.length;
  if (
    surfaceCandidates.some(
      (candidate) =>
        candidate.matcher.path.length === longestLength &&
        candidate.surface.id !== owningCandidate.surface.id
    )
  ) {
    return { type: 'unknown-product-path', productId: manifest.id };
  }

  const route = registeredProductRouteCatalog.find(
    (candidate) =>
      candidate.routeKind === 'PAGE' &&
      candidate.productId === manifest.id &&
      candidate.surfaceId === owningCandidate.surface.id &&
      registeredPageMatches(normalizedPath, candidate.pattern)
  );
  if (!route || route.routeKind !== 'PAGE') {
    return {
      type: 'unknown-surface-path',
      productId: manifest.id,
      surfaceId: owningCandidate.surface.id,
    };
  }
  return {
    type: 'known-route',
    productId: manifest.id,
    surfaceId: owningCandidate.surface.id,
    routeId: route.routeId,
  };
}

function withPreservedLocation(
  targetPath: string,
  definition: LegacyRedirectDefinition,
  search = '',
  hash = ''
): string {
  const query =
    definition.preserveQuery && search ? (search.startsWith('?') ? search : `?${search}`) : '';
  const fragment =
    definition.preserveHash && hash ? (hash.startsWith('#') ? hash : `#${hash}`) : '';
  return `${targetPath}${query}${fragment}`;
}

function targetIsRegistered(
  pathname: string,
  registeredProductRouteCatalog: readonly RegisteredProductRoute[]
): boolean {
  return registeredProductRouteCatalog.some(
    (route) => route.routeKind === 'PAGE' && registeredPageMatches(pathname, route.pattern)
  );
}

export function resolveLegacyProductRedirect(
  location: { pathname: string; search?: string; hash?: string },
  definitions: readonly LegacyRedirectDefinition[],
  registeredProductRouteCatalog: readonly RegisteredProductRoute[]
): LegacyProductRedirectResolution {
  const pathname = normalizeProductPath(location.pathname);
  const definition = [...definitions]
    .filter((candidate) => matchesProductRoute(pathname, candidate.sourceMatcher))
    .sort((left, right) => right.sourceMatcher.path.length - left.sourceMatcher.path.length)[0];
  if (!definition) return { type: 'no-redirect' };

  let targetPath: string | undefined;
  if (definition.target.kind === 'static') targetPath = definition.target.path;
  if (definition.target.kind === 'path-map') {
    targetPath = definition.target.entries.find(
      (entry) => normalizeProductPath(entry.sourcePath) === pathname
    )?.targetPath;
  }
  if (definition.target.kind === 'registered-suffix') {
    if (isSegmentOwnedPath(pathname, definition.target.sourceBase)) {
      const suffix = pathname.slice(normalizeProductPath(definition.target.sourceBase).length);
      targetPath = normalizeProductPath(`${definition.target.targetBase}${suffix}`);
    }
  }

  const unknown = (): LegacyProductRedirectResolution => ({
    type: definition.unknownTarget,
    redirectId: definition.id,
    attemptedTarget: targetPath,
  });
  if (!targetPath || !targetIsRegistered(targetPath, registeredProductRouteCatalog))
    return unknown();
  if (definitions.some((candidate) => matchesProductRoute(targetPath!, candidate.sourceMatcher))) {
    return unknown();
  }
  return {
    type: 'redirect',
    redirectId: definition.id,
    to: withPreservedLocation(targetPath, definition, location.search, location.hash),
    replace: true,
  };
}

export const productRoutePatternMatches = registeredPageMatches;
