import {
  matchesProductRoute,
  normalizeProductPath,
  type ProductNavigationGroup,
  type ProductNavigationItem,
  type ProductPlane,
  type ProductSurfaceDefinition,
  type ProductSurfaceManifest,
} from '../../components/product-manifest';

export type LegacyProductSurfaceAccessPredicate = (item: ProductNavigationItem) => boolean;

/**
 * Presentation-only entry point for a legacy-authorized product.
 *
 * Deliberately excludes context, scope, decision revision, and access-mode fields so this model
 * cannot be mistaken for server-authoritative Product Surface runtime evidence.
 */
export type LegacyProductSurfaceEntryPoint = {
  productId: string;
  surfaceId: string;
  plane: ProductPlane;
  labelKey: string;
  path: string;
  entryKind: 'surface' | 'management-entry' | 'work-return';
};

export type LegacyProductSurfaceReturnTarget = {
  path: string;
  kind: 'work' | 'catalog';
};

export type LegacyProductSurfacePresentation = {
  currentSurface: ProductSurfaceDefinition;
  navigation: readonly ProductNavigationGroup[];
  navigationBySurfaceId: ReadonlyMap<string, readonly ProductNavigationGroup[]>;
  accessibleEntryPoints: readonly LegacyProductSurfaceEntryPoint[];
  headerEntryPoints: readonly LegacyProductSurfaceEntryPoint[];
  returnTarget: LegacyProductSurfaceReturnTarget;
};

type SurfaceMatch = {
  surface: ProductSurfaceDefinition;
  matcherPathLength: number;
  exact: boolean;
};

/** Resolves overlapping work/admin prefixes by the most specific matching manifest path. */
export function resolveLegacyPresentationSurface(
  manifest: ProductSurfaceManifest,
  pathname: string
): ProductSurfaceDefinition | undefined {
  const normalizedPath = normalizeProductPath(pathname);
  const candidates: SurfaceMatch[] = manifest.surfaces.flatMap((surface) =>
    surface.routeMatchers.flatMap((matcher) =>
      matchesProductRoute(normalizedPath, matcher)
        ? [
            {
              surface,
              matcherPathLength: normalizeProductPath(matcher.path).length,
              exact: matcher.kind === 'exact',
            },
          ]
        : []
    )
  );
  candidates.sort(
    (left, right) =>
      right.matcherPathLength - left.matcherPathLength || Number(right.exact) - Number(left.exact)
  );
  const winner = candidates[0];
  if (!winner) return undefined;
  const ambiguous = candidates.some(
    (candidate) =>
      candidate.surface.id !== winner.surface.id &&
      candidate.matcherPathLength === winner.matcherPathLength &&
      candidate.exact === winner.exact
  );
  return ambiguous ? undefined : winner.surface;
}

function declaredPathOwners(manifest: ProductSurfaceManifest): ReadonlyMap<string, Set<string>> {
  const owners = new Map<string, Set<string>>();
  for (const surface of manifest.surfaces) {
    for (const item of surface.navigation.flatMap((group) => group.items)) {
      const path = normalizeProductPath(item.path);
      const surfaceIds = owners.get(path) ?? new Set<string>();
      surfaceIds.add(surface.id);
      owners.set(path, surfaceIds);
    }
  }
  return owners;
}

function itemBelongsToSurface(
  manifest: ProductSurfaceManifest,
  owners: ReadonlyMap<string, Set<string>>,
  surfaceId: string,
  item: ProductNavigationItem
): boolean {
  const path = normalizeProductPath(item.path);
  const pathOwners = owners.get(path);
  if (pathOwners?.size !== 1 || !pathOwners.has(surfaceId)) return false;
  return resolveLegacyPresentationSurface(manifest, path)?.id === surfaceId;
}

function firstAccessibleSurfacePath(
  surface: ProductSurfaceDefinition,
  navigation: readonly ProductNavigationGroup[]
): string | undefined {
  const accessibleByPath = new Map(
    navigation
      .flatMap((group) => group.items)
      .map((item) => [normalizeProductPath(item.path), item])
  );
  const indexItem = accessibleByPath.get(normalizeProductPath(surface.indexPath));
  if (indexItem) return indexItem.path;
  for (const item of surface.navigation.flatMap((group) => group.items)) {
    const accessible = accessibleByPath.get(normalizeProductPath(item.path));
    if (accessible) return accessible.path;
  }
  return undefined;
}

function preferredManagementEntry(
  manifest: ProductSurfaceManifest,
  entries: readonly LegacyProductSurfaceEntryPoint[]
): LegacyProductSurfaceEntryPoint | undefined {
  const managementEntries = entries.filter((entry) => entry.plane === 'management');
  const administrationSurfaceIds = new Set(
    manifest.surfaces
      .filter(
        (surface) => surface.plane === 'management' && surface.taskKinds.includes('administration')
      )
      .map((surface) => surface.id)
  );
  return (
    managementEntries.find((entry) => administrationSurfaceIds.has(entry.surfaceId)) ??
    managementEntries[0]
  );
}

function buildHeaderEntryPoints(
  manifest: ProductSurfaceManifest,
  currentSurface: ProductSurfaceDefinition,
  entries: readonly LegacyProductSurfaceEntryPoint[]
): readonly LegacyProductSurfaceEntryPoint[] {
  const workEntries = entries.filter((entry) => entry.plane === 'work');
  const managementEntries = entries.filter((entry) => entry.plane === 'management');
  if (currentSurface.plane === 'work') {
    const managementEntry = preferredManagementEntry(manifest, entries);
    return managementEntry
      ? [...workEntries, { ...managementEntry, entryKind: 'management-entry' }]
      : workEntries;
  }

  const workReturn =
    workEntries.find((entry) => entry.surfaceId === currentSurface.returnSurfaceId) ??
    workEntries[0];
  return [
    ...(workReturn ? [{ ...workReturn, entryKind: 'work-return' as const }] : []),
    ...managementEntries,
  ];
}

/**
 * Separates an existing legacy menu into Product Manifest planes without changing authorization.
 * The caller remains responsible for the existing route/page guard and supplies the exact legacy
 * access predicate already used by that shell. No rollout mode or server authority is promoted.
 */
export function buildLegacyProductSurfacePresentation({
  manifest,
  pathname,
  navigation,
  canAccessItem,
  catalogPath = '/apps',
}: {
  manifest: ProductSurfaceManifest;
  pathname: string;
  navigation: readonly ProductNavigationGroup[];
  canAccessItem: LegacyProductSurfaceAccessPredicate;
  catalogPath?: string;
}): LegacyProductSurfacePresentation | undefined {
  const currentSurface = resolveLegacyPresentationSurface(manifest, pathname);
  if (!currentSurface) return undefined;

  const owners = declaredPathOwners(manifest);
  const navigationBySurfaceId = new Map<string, readonly ProductNavigationGroup[]>();
  for (const surface of manifest.surfaces) {
    const surfaceNavigation = navigation
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) => itemBelongsToSurface(manifest, owners, surface.id, item) && canAccessItem(item)
        ),
      }))
      .filter((group) => group.items.length > 0);
    navigationBySurfaceId.set(surface.id, surfaceNavigation);
  }

  const accessibleEntryPoints = manifest.surfaces.flatMap((surface) => {
    const path = firstAccessibleSurfacePath(surface, navigationBySurfaceId.get(surface.id) ?? []);
    return path
      ? [
          {
            productId: manifest.id,
            surfaceId: surface.id,
            plane: surface.plane,
            labelKey: surface.labelKey,
            path,
            entryKind: 'surface' as const,
          },
        ]
      : [];
  });
  const headerEntryPoints = buildHeaderEntryPoints(manifest, currentSurface, accessibleEntryPoints);
  const workReturn = headerEntryPoints.find((entry) => entry.entryKind === 'work-return');
  const returnTarget: LegacyProductSurfaceReturnTarget =
    currentSurface.plane === 'management' && workReturn
      ? { path: workReturn.path, kind: 'work' }
      : { path: catalogPath, kind: 'catalog' };

  return {
    currentSurface,
    navigation: navigationBySurfaceId.get(currentSurface.id) ?? [],
    navigationBySurfaceId,
    accessibleEntryPoints,
    headerEntryPoints,
    returnTarget,
  };
}
