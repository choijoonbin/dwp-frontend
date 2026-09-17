import type {
  AppGovernanceDashboard,
  CatalogEntity,
  ProductSurfaceContextListData,
} from '@dwp-frontend/shared-utils';

import type { ProductEntryManifest } from '../../components/product-entry-point-catalog';

export type AppLifecycleObservationState = 'OBSERVED' | 'NOT_OBSERVED' | 'UNAVAILABLE';

export type AppLifecycleCatalogItem = {
  appKey: string;
  displayName: string;
  registry: {
    state: AppLifecycleObservationState;
    lifecycleState?: string;
    scope?: CatalogEntity['scope'];
    revision?: number;
  };
  tenantAdminBoundary: {
    state: AppLifecycleObservationState;
    count: number;
  };
  currentActorEntitlement: {
    state: AppLifecycleObservationState;
    sources: string[];
  };
  installation: { state: 'UNAVAILABLE' };
  workforceAssignment: { state: 'UNAVAILABLE' };
  runnable: {
    state: AppLifecycleObservationState;
    surfaceCount: number;
  };
  adminAssignments: {
    state: AppLifecycleObservationState;
    active: number;
    pending: number;
  };
  managementPath?: string;
  managementAccess: AppLifecycleObservationState;
};

type OwnerStatus = 'ready' | 'loading' | 'unavailable';

type BuildAppLifecycleCatalogInput = {
  catalogEntities: readonly CatalogEntity[];
  catalogStatus: OwnerStatus;
  manifests: readonly ProductEntryManifest[];
  governance?: AppGovernanceDashboard;
  governanceStatus: OwnerStatus;
  authority?: ProductSurfaceContextListData;
  authorityStatus: OwnerStatus;
};

function metadataKey(entity: CatalogEntity): string | undefined {
  for (const candidate of ['appResourceKey', 'resourceKey', 'appKey']) {
    const value = entity.metadata[candidate];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function matchingRegistryEntity(
  entities: readonly CatalogEntity[],
  appKey: string
): CatalogEntity | undefined {
  return entities.find(
    (entity) =>
      entity.kind === 'APP' &&
      (entity.key === appKey || entity.ref === appKey || metadataKey(entity) === appKey)
  );
}

function manifestDisplayName(manifest: ProductEntryManifest | undefined): string | undefined {
  if (!manifest) return undefined;
  if (manifest.id === 'dwaion') return 'DWAI·ON';
  return manifest.id
    .split(/[-_]/u)
    .map((word) =>
      word.length <= 3 ? word.toUpperCase() : `${word.charAt(0).toUpperCase()}${word.slice(1)}`
    )
    .join(' ');
}

export function buildAppLifecycleCatalog({
  catalogEntities,
  catalogStatus,
  manifests,
  governance,
  governanceStatus,
  authority,
  authorityStatus,
}: BuildAppLifecycleCatalogInput): AppLifecycleCatalogItem[] {
  const catalogApps = catalogEntities.filter((entity) => entity.kind === 'APP');
  const appKeys = new Set(manifests.map((manifest) => manifest.appKey));
  catalogApps.forEach((entity) => appKeys.add(metadataKey(entity) ?? entity.key));
  governance?.resourceSets.forEach((resourceSet) =>
    resourceSet.resources.forEach((resource) => appKeys.add(resource.resourceKey))
  );
  governance?.presetCatalog?.forEach((preset) => appKeys.add(preset.appResourceKey));
  authority?.contexts.forEach((context) => appKeys.add(context.appResourceKey));

  return [...appKeys]
    .filter(Boolean)
    .map((appKey) => {
      const manifest = manifests.find((candidate) => candidate.appKey === appKey);
      const registry = matchingRegistryEntity(catalogApps, appKey);
      const resources =
        governance?.resourceSets.flatMap((resourceSet) =>
          resourceSet.resources
            .filter((resource) => resource.resourceKey === appKey)
            .map((resource) => ({ resourceSet, resource }))
        ) ?? [];
      const preset = governance?.presetCatalog?.find(
        (candidate) => candidate.appResourceKey === appKey
      );
      const contexts =
        authority?.contexts.filter((context) => context.appResourceKey === appKey) ?? [];
      const entitlementContexts = contexts.filter(
        (context) => context.accessSource === 'ENTITLEMENT'
      );
      const workContexts = contexts.filter((context) => context.plane === 'work');
      const managementContexts = contexts.filter((context) => context.plane === 'management');
      const managementSurface = manifest?.surfaces.find(
        (surface) => surface.plane === 'management'
      );
      const resourceSetIds = new Set(resources.map(({ resourceSet }) => resourceSet.resourceSetId));
      const assignments = governance?.assignments.filter((assignment) =>
        resourceSetIds.has(assignment.resourceSetId)
      );
      const presetAssignments = governance?.presetAssignments?.filter((assignment) =>
        resourceSetIds.has(assignment.resourceSetId)
      );
      // Every preset aggregate owns one underlying responsibility assignment. Count that access
      // package once instead of presenting the aggregate and its implementation record as two
      // administrator assignments.
      const presetResponsibilityIds = new Set(
        (presetAssignments ?? []).map((assignment) => assignment.responsibilityAssignmentId)
      );
      const directAssignments = (assignments ?? []).filter(
        (assignment) => !presetResponsibilityIds.has(assignment.assignmentId)
      );
      const allAssignments = [...directAssignments, ...(presetAssignments ?? [])];
      const activeAssignments = allAssignments.filter(
        (assignment) => assignment.lifecycleState === 'ACTIVE'
      ).length;
      const pendingAssignments = allAssignments.filter((assignment) =>
        ['PENDING_APPROVAL', 'APPROVED'].includes(assignment.lifecycleState)
      ).length;

      return {
        appKey,
        displayName:
          registry?.name ??
          resources[0]?.resource.resourceName ??
          preset?.displayName ??
          manifestDisplayName(manifest) ??
          appKey,
        registry: registry
          ? {
              state: 'OBSERVED' as const,
              lifecycleState: registry.lifecycleState,
              scope: registry.scope,
              revision: registry.revision,
            }
          : {
              state:
                catalogStatus === 'ready' ? ('NOT_OBSERVED' as const) : ('UNAVAILABLE' as const),
            },
        tenantAdminBoundary: {
          state:
            governanceStatus === 'ready'
              ? resources.length
                ? ('OBSERVED' as const)
                : ('NOT_OBSERVED' as const)
              : ('UNAVAILABLE' as const),
          count: resources.length,
        },
        currentActorEntitlement: {
          state:
            authorityStatus === 'ready'
              ? entitlementContexts.length
                ? ('OBSERVED' as const)
                : ('NOT_OBSERVED' as const)
              : ('UNAVAILABLE' as const),
          sources: [...new Set(entitlementContexts.map((context) => context.accessSource))],
        },
        installation: { state: 'UNAVAILABLE' as const },
        workforceAssignment: { state: 'UNAVAILABLE' as const },
        runnable: {
          state:
            authorityStatus === 'ready'
              ? workContexts.length
                ? ('OBSERVED' as const)
                : ('NOT_OBSERVED' as const)
              : ('UNAVAILABLE' as const),
          surfaceCount: workContexts.length,
        },
        adminAssignments: {
          state:
            governanceStatus === 'ready'
              ? allAssignments.length
                ? ('OBSERVED' as const)
                : ('NOT_OBSERVED' as const)
              : ('UNAVAILABLE' as const),
          active: activeAssignments,
          pending: pendingAssignments,
        },
        managementPath: managementSurface?.indexPath,
        managementAccess:
          authorityStatus === 'ready'
            ? managementContexts.length
              ? ('OBSERVED' as const)
              : ('NOT_OBSERVED' as const)
            : ('UNAVAILABLE' as const),
      } satisfies AppLifecycleCatalogItem;
    })
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
}
