import type {
  AppGovernanceDashboard,
  CatalogEntity,
  ProductSurfaceContextListData,
  TenantAppAdoptionProjection,
  TenantAppAssignment,
} from '@dwp-frontend/shared-utils';

import type { ProductEntryManifest } from '../../components/product-entry-point-catalog';

export type AppLifecycleObservationState = 'OBSERVED' | 'NOT_OBSERVED' | 'LOADING' | 'UNAVAILABLE';

export type AppLifecycleCatalogItem = {
  appKey: string;
  displayName?: string;
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
  installation: {
    state: AppLifecycleObservationState;
    lifecycleState?: string;
    activeSeats: number;
    reservedSeats: number;
    seatCapacity?: number | null;
  };
  workforceAssignment: {
    state: AppLifecycleObservationState;
    active: number;
    pending: number;
  };
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

export type OwnerStatus = 'ready' | 'partial' | 'loading' | 'unavailable';

export type AppLifecycleProvenance = {
  authority: {
    state: AppLifecycleObservationState;
    generatedAt?: string;
    decisionRevision?: string;
    sourceRevisionCount: number;
  };
  adoption: {
    state: AppLifecycleObservationState;
    observedAt?: string;
    coverageState?: string;
    ownerCount: number;
    exclusionCount: number;
  };
};

function observationState(status: OwnerStatus, observed: boolean): AppLifecycleObservationState {
  if (status === 'loading') return 'LOADING';
  if (status === 'unavailable') return 'UNAVAILABLE';
  if (status === 'partial') return observed ? 'OBSERVED' : 'UNAVAILABLE';
  return observed ? 'OBSERVED' : 'NOT_OBSERVED';
}

export function buildAppLifecycleProvenance({
  authority,
  authorityStatus,
  adoption,
  adoptionStatus,
}: Pick<
  BuildAppLifecycleCatalogInput,
  'authority' | 'authorityStatus' | 'adoption' | 'adoptionStatus'
>): AppLifecycleProvenance {
  return {
    authority: {
      state: observationState(authorityStatus, Boolean(authority)),
      generatedAt: authority?.generatedAt,
      decisionRevision: authority?.decisionRevision,
      sourceRevisionCount: Object.keys(authority?.sourceRevisions ?? {}).length,
    },
    adoption: {
      state: observationState(adoptionStatus ?? 'unavailable', Boolean(adoption)),
      observedAt: adoption?.observedAt,
      coverageState: adoption?.coverageState,
      ownerCount: adoption?.includedOwners.length ?? 0,
      exclusionCount: adoption?.exclusions.length ?? 0,
    },
  };
}

type BuildAppLifecycleCatalogInput = {
  catalogEntities: readonly CatalogEntity[];
  catalogStatus: OwnerStatus;
  manifests: readonly ProductEntryManifest[];
  governance?: AppGovernanceDashboard;
  governanceStatus: OwnerStatus;
  authority?: ProductSurfaceContextListData;
  authorityStatus: OwnerStatus;
  adoption?: TenantAppAdoptionProjection;
  adoptionStatus?: OwnerStatus;
  workforceAssignments?: readonly TenantAppAssignment[];
  workforceAssignmentsStatus?: OwnerStatus;
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
  adoption,
  adoptionStatus = 'unavailable',
  workforceAssignments,
  workforceAssignmentsStatus = 'unavailable',
}: BuildAppLifecycleCatalogInput): AppLifecycleCatalogItem[] {
  const catalogApps = catalogEntities.filter((entity) => entity.kind === 'APP');
  const appKeys = new Set(manifests.map((manifest) => manifest.appKey));
  catalogApps.forEach((entity) => appKeys.add(metadataKey(entity) ?? entity.key));
  governance?.resourceSets.forEach((resourceSet) =>
    resourceSet.resources.forEach((resource) => appKeys.add(resource.resourceKey))
  );
  governance?.presetCatalog?.forEach((preset) => appKeys.add(preset.appResourceKey));
  authority?.contexts.forEach((context) => appKeys.add(context.appResourceKey));
  adoption?.installations.forEach((installation) => appKeys.add(installation.appResourceKey));

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
      const installation = adoption?.installations.find(
        (candidate) => candidate.appResourceKey === appKey || candidate.productKey === manifest?.id
      );
      const installationAssignments = installation
        ? (workforceAssignments ?? []).filter(
            (assignment) => assignment.installationId === installation.installationId
          )
        : [];
      const activeWorkforceAssignments = installationAssignments.filter(
        (assignment) => assignment.lifecycleState === 'ACTIVE'
      ).length;
      const pendingWorkforceAssignments = installationAssignments.filter((assignment) =>
        ['PENDING_APPROVAL', 'APPROVED'].includes(assignment.lifecycleState)
      ).length;
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
          manifestDisplayName(manifest),
        registry: registry
          ? {
              state: 'OBSERVED' as const,
              lifecycleState: registry.lifecycleState,
              scope: registry.scope,
              revision: registry.revision,
            }
          : {
              state: observationState(catalogStatus, false),
            },
        tenantAdminBoundary: {
          state: observationState(governanceStatus, resources.length > 0),
          count: resources.length,
        },
        currentActorEntitlement: {
          state: observationState(authorityStatus, entitlementContexts.length > 0),
          sources: [...new Set(entitlementContexts.map((context) => context.accessSource))],
        },
        installation: {
          state: observationState(adoptionStatus, Boolean(installation)),
          lifecycleState: installation?.lifecycleState,
          activeSeats: installation?.activeSeats ?? 0,
          reservedSeats: installation?.reservedSeats ?? 0,
          seatCapacity: installation?.seatCapacity,
        },
        workforceAssignment: {
          state: observationState(workforceAssignmentsStatus, installationAssignments.length > 0),
          active: activeWorkforceAssignments,
          pending: pendingWorkforceAssignments,
        },
        runnable: {
          state: observationState(authorityStatus, workContexts.length > 0),
          surfaceCount: workContexts.length,
        },
        adminAssignments: {
          state: observationState(governanceStatus, allAssignments.length > 0),
          active: activeAssignments,
          pending: pendingAssignments,
        },
        managementPath: managementSurface?.indexPath,
        managementAccess: observationState(authorityStatus, managementContexts.length > 0),
      } satisfies AppLifecycleCatalogItem;
    })
    .sort((left, right) => (left.displayName ?? '').localeCompare(right.displayName ?? ''));
}
