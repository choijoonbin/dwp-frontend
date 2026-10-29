/** App-level integration evidence; imported only by verification suites. */
import {
  createHcmNavigation,
  HCM_DEEP_LINK_COMPATIBILITY_ITEMS,
  HCM_NAVIGATION,
} from '../features/hcm/hcm-navigation';
import { HRIS_R7_GOVERNED_PAGE_CATALOG } from '../components/hris-governed-page-catalog';
import { ADMIN_NAVIGATION } from '../features/admin/admin-navigation';
import { OFFICIAL_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE } from '../routes/official-product-page-route-contracts';
import { HRIS_IA_CONTRACT_NODES } from '../features/hris/shell/model/hris-information-architecture.generated';
import { HRIS_PRODUCT_MAP_CATALOG } from '../features/hris/shell/model/hris-product-map-catalog';
import {
  HRIS_CONTROLLED_EXPORT_GROUP_ID,
  HRIS_CONTROLLED_EXPORT_NODE_ID,
  HRIS_CONTROLLED_EXPORT_ROUTE,
} from '../features/hris/shell/model/hris-navigation-topology-successor';
import { HRIS_RUNTIME_NAVIGATION_MANIFEST } from '../features/hris/shell/model/hris-runtime-navigation-manifest';

import type { HcmView } from '../features/hcm/hcm-navigation';
import type { AdminSection, AdminView } from '../features/admin/admin-navigation';
import type {
  HrisCatalogNode,
  HrisExternalTarget,
  HrisModule,
} from '../features/hris/shell/model/hris-product-map-contract';

export type HrisCrossLayerState =
  | 'MOUNTED_DEFAULT_OFF'
  | 'MOUNTED_PRODUCTION_AUTHORIZED'
  | 'COMPATIBILITY_ROUTE_ONLY'
  | 'AUTHORIZED_METADATA_ONLY'
  | 'EXTERNAL_CONTROL_PLANE'
  | 'EXTERNAL_TARGET_PLANNED'
  | 'DESIGN_ONLY';

export type HrisCrossLayerAuthorizationKind = 'PRODUCT_PAGE' | 'ADMIN_RESOURCE_GUARD' | 'NONE';

export type HrisTenantActivationEvidence = Readonly<{
  evidenceSource: string;
  state: string;
  featureEnablementAuthorized: boolean;
  tenantEnrollmentAuthorized: boolean;
  globalActiveSeeds: number;
  tenantEnrollmentSeeds: number;
  productionProviderHandlerSchedulerOrBrokerBindings: number;
}>;

export type HrisCrossLayerNode = Readonly<{
  iaNodeId: string;
  sourceNodeKey: string;
  module: HrisModule;
  canonicalRoute: string;
  state: HrisCrossLayerState;
  hasCurrentCatalog: boolean;
  hasPageAuthorization: boolean;
  authorizationKind: HrisCrossLayerAuthorizationKind;
  hasExactMountedRoute: boolean;
  hasCompatibilityRoute: boolean;
  mountedCompatibilityPaths: readonly string[];
  retiredAliasPaths: readonly string[];
  mountedCurrentPartialPaths: readonly string[];
  productionState: string;
}>;

export type HrisCrossLayerReadinessReport = Readonly<{
  nodes: readonly HrisCrossLayerNode[];
  drifts: readonly string[];
  summary: Readonly<{
    baseIaNodes: number;
    runtimeNodes: number;
    baseCatalogNodes: number;
    modernNodes: number;
    hcmNavigationRoutes: number;
    compatibilityRoutes: number;
    authorizedPageRoutes: number;
    governedAdmissionMountedRoutes: number;
    governedCatalogOnlyRoutes: number;
    productionAuthorizedNodes: number;
    declaredActivationEvidenceSource: string;
    declaredActivationState: string;
    states: Readonly<Record<HrisCrossLayerState, number>>;
  }>;
}>;

const HRIS_CROSS_LAYER_STATES: readonly HrisCrossLayerState[] = [
  'MOUNTED_DEFAULT_OFF',
  'MOUNTED_PRODUCTION_AUTHORIZED',
  'COMPATIBILITY_ROUTE_ONLY',
  'AUTHORIZED_METADATA_ONLY',
  'EXTERNAL_CONTROL_PLANE',
  'EXTERNAL_TARGET_PLANNED',
  'DESIGN_ONLY',
];

const HRIS_EXTERNAL_TARGET_ADMIN_MOUNT: Readonly<
  Record<HrisExternalTarget, Readonly<{ section: AdminSection; view: AdminView }> | null>
> = Object.freeze({
  DWP_EXPERIENCE: { section: 'experience', view: 'branding' },
  DWP_IDENTITY: { section: 'identity', view: 'app-governance' },
  DWP_PLATFORM: { section: 'platform', view: 'catalog' },
  DWP_INTEGRATIONS: { section: 'integrations', view: 'productivity' },
  DWP_GOVERNANCE: { section: 'governance', view: 'audit-overview' },
  DWP_EXTENSIBILITY: null,
});

type RuntimeNodeIdentity = Readonly<{ iaNodeId: string }>;
type RuntimeTaskGroupMembership = Readonly<{
  taskGroupId: string;
  memberIaNodeIds: readonly string[];
}>;

function pathname(route: string): string {
  return route.split(/[?#]/u, 1)[0]!;
}

export function validateHrisRuntimeTaskGroupClosure({
  nodes,
  taskGroups,
  ungroupedNodeIds = new Set(['BASE:my-hr-home']),
}: {
  nodes: readonly RuntimeNodeIdentity[];
  taskGroups: readonly RuntimeTaskGroupMembership[];
  ungroupedNodeIds?: ReadonlySet<string>;
}): readonly string[] {
  const drifts: string[] = [];
  const nodeIds = nodes.map((node) => node.iaNodeId);
  const known = new Set(nodeIds);
  if (known.size !== nodeIds.length) drifts.push('runtime navigation node IDs are not unique');

  const membership = new Map<string, number>();
  for (const group of taskGroups) {
    for (const nodeId of group.memberIaNodeIds) {
      membership.set(nodeId, (membership.get(nodeId) ?? 0) + 1);
      if (!known.has(nodeId)) {
        drifts.push(
          `runtime task group contains an unknown node: ${group.taskGroupId} -> ${nodeId}`
        );
      }
    }
  }
  for (const nodeId of nodeIds) {
    const count = membership.get(nodeId) ?? 0;
    const expected = ungroupedNodeIds.has(nodeId) ? 0 : 1;
    if (count !== expected) {
      drifts.push(
        `runtime task-group membership differs: ${nodeId} expected=${expected} actual=${count}`
      );
    }
  }
  return Object.freeze([...new Set(drifts)].sort());
}

function classifyNode({
  canonicalRoute,
  productionAuthorized,
  exactMountedPaths,
  mountedCompatibilityPaths,
  authorizedPagePaths,
  external,
  externalTargetAvailable,
}: {
  canonicalRoute: string;
  productionAuthorized: boolean;
  exactMountedPaths: ReadonlySet<string>;
  mountedCompatibilityPaths: readonly string[];
  authorizedPagePaths: ReadonlySet<string>;
  external: boolean;
  externalTargetAvailable: boolean;
}): HrisCrossLayerState {
  if (external) {
    return externalTargetAvailable ? 'EXTERNAL_CONTROL_PLANE' : 'EXTERNAL_TARGET_PLANNED';
  }
  if (exactMountedPaths.has(canonicalRoute)) {
    return productionAuthorized ? 'MOUNTED_PRODUCTION_AUTHORIZED' : 'MOUNTED_DEFAULT_OFF';
  }
  if (mountedCompatibilityPaths.length > 0) return 'COMPATIBILITY_ROUTE_ONLY';
  if (authorizedPagePaths.has(canonicalRoute)) return 'AUTHORIZED_METADATA_ONLY';
  return 'DESIGN_ONLY';
}

/**
 * Reconciles design, catalog, actual HCM route/page mount, PAGE authorization and the pinned
 * roadmap's declared tenant-activation evidence. It does not claim to inspect a live tenant
 * database. Intentional catalog-only or default-OFF routes are classifications rather than errors;
 * a drift is reserved for contradictory facts such as a mounted route without PAGE authority.
 */
export function buildHrisCrossLayerReadinessReport({
  mountedViews,
  mountedAdminViews,
  tenantActivation,
  catalogNodes = HRIS_PRODUCT_MAP_CATALOG,
}: {
  mountedViews: ReadonlySet<HcmView>;
  mountedAdminViews: ReadonlySet<AdminView>;
  tenantActivation: HrisTenantActivationEvidence;
  catalogNodes?: readonly HrisCatalogNode[];
}): HrisCrossLayerReadinessReport {
  const navigationItems = HCM_NAVIGATION.flatMap((group) => group.items);
  const navigationPaths = new Set(navigationItems.map((item) => item.path));
  const featureFlaggedDefaultOffItems = createHcmNavigation(true)
    .flatMap((group) => group.items)
    .filter((item) => !navigationPaths.has(item.path));
  const mountableNavigationItems = [...navigationItems, ...featureFlaggedDefaultOffItems];
  const navigationByPath = new Map(mountableNavigationItems.map((item) => [item.path, item]));
  const compatibilityByPath = new Map(
    HCM_DEEP_LINK_COMPATIBILITY_ITEMS.map((item) => [item.path, item])
  );
  const mountedRouteByPath = new Map([...navigationByPath, ...compatibilityByPath]);
  const exactMountedPaths = new Set(navigationByPath.keys());
  const authorizedPagePaths = new Set<string>(
    OFFICIAL_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.map((route) => route.pattern)
  );
  const catalogById = new Map(catalogNodes.map((node) => [node.id, node]));
  const adminNavigationBySection = new Map(ADMIN_NAVIGATION.map((group) => [group.id, group]));
  const drifts: string[] = [
    ...validateHrisRuntimeTaskGroupClosure({
      nodes: HRIS_RUNTIME_NAVIGATION_MANIFEST.nodes,
      taskGroups: HRIS_RUNTIME_NAVIGATION_MANIFEST.taskGroups,
    }),
  ];

  for (const item of [...mountableNavigationItems, ...HCM_DEEP_LINK_COMPATIBILITY_ITEMS]) {
    if (!authorizedPagePaths.has(item.path)) {
      drifts.push(`mounted HCM route has no PAGE authorization: ${item.path}`);
    }
    if (!mountedViews.has(item.view)) {
      drifts.push(`HCM route has no page component mount: ${item.path} -> ${item.view}`);
    }
  }

  for (const governed of HRIS_R7_GOVERNED_PAGE_CATALOG) {
    const item = navigationByPath.get(governed.path);
    if (!authorizedPagePaths.has(governed.path)) {
      drifts.push(`governed route has no PAGE authorization: ${governed.path}`);
    }
    if (governed.state === 'ADMISSION_MOUNTED') {
      if (!item || !mountedViews.has(item.view)) {
        drifts.push(`ADMISSION_MOUNTED route is not mounted: ${governed.path}`);
      }
    } else if (item || compatibilityByPath.has(governed.path)) {
      drifts.push(`CATALOG_ONLY route is mounted: ${governed.path}`);
    }
  }

  for (const catalogNode of catalogNodes) {
    if (catalogNode.lifecycle !== 'PILOT') continue;
    if (!catalogNode.href) {
      drifts.push(`PILOT catalog node has no href: ${catalogNode.id}`);
      continue;
    }
    const item = navigationByPath.get(catalogNode.href);
    if (!item || !mountedViews.has(item.view)) {
      drifts.push(`PILOT catalog href is not mounted: ${catalogNode.id} -> ${catalogNode.href}`);
    }
    if (!authorizedPagePaths.has(catalogNode.href)) {
      drifts.push(`PILOT catalog href has no PAGE authorization: ${catalogNode.href}`);
    }
  }

  const controlledExportNodes = HRIS_RUNTIME_NAVIGATION_MANIFEST.nodes.filter(
    (node) => node.iaNodeId === HRIS_CONTROLLED_EXPORT_NODE_ID
  );
  if (controlledExportNodes.length !== 1) {
    drifts.push(`controlled-export runtime node count differs: ${controlledExportNodes.length}`);
  } else {
    const controlled = controlledExportNodes[0]!;
    if (
      controlled.ownerSession !== 'HRIS-HRM' ||
      controlled.module !== 'HRM' ||
      controlled.canonicalRoute !== HRIS_CONTROLLED_EXPORT_ROUTE ||
      controlled.contractProductionState !== 'NOT_AUTHORIZED_G6' ||
      controlled.currentCatalog?.lifecycle !== 'PILOT' ||
      controlled.currentCatalog.href !== HRIS_CONTROLLED_EXPORT_ROUTE
    ) {
      drifts.push('controlled-export runtime successor contract differs');
    }
    const controlledGroup = HRIS_RUNTIME_NAVIGATION_MANIFEST.taskGroups.find(
      (group) => group.taskGroupId === HRIS_CONTROLLED_EXPORT_GROUP_ID
    );
    if (
      !controlledGroup ||
      controlledGroup.memberIaNodeIds.filter((id) => id === HRIS_CONTROLLED_EXPORT_NODE_ID)
        .length !== 1
    ) {
      drifts.push('controlled-export runtime successor is not closed by its task group');
    }
  }

  const currentPartialOwners = new Map<string, string[]>();
  for (const catalog of catalogNodes) {
    for (const path of catalog.currentPartialPaths) {
      currentPartialOwners.set(path, [...(currentPartialOwners.get(path) ?? []), catalog.id]);
    }
  }
  for (const [path, owners] of currentPartialOwners) {
    if (owners.length !== 1) {
      drifts.push(`current partial path ownership is not unique: ${path} -> ${owners.join(',')}`);
    }
  }

  const runtimeCanonicalOwners = new Map<string, string[]>();
  for (const runtimeNode of HRIS_RUNTIME_NAVIGATION_MANIFEST.nodes) {
    const route = pathname(runtimeNode.canonicalRoute);
    runtimeCanonicalOwners.set(route, [
      ...(runtimeCanonicalOwners.get(route) ?? []),
      runtimeNode.iaNodeId,
    ]);
  }

  const nodes: HrisCrossLayerNode[] = HRIS_RUNTIME_NAVIGATION_MANIFEST.nodes.map((node) => {
    const baseCatalog =
      node.sourceSet === 'BASE76' ? catalogById.get(node.sourceNodeKey) : undefined;
    const catalog = baseCatalog ?? node.currentCatalog ?? undefined;
    if (node.sourceSet === 'BASE76' && !baseCatalog) {
      drifts.push(`BASE76 IA node has no current catalog record: ${node.sourceNodeKey}`);
    }
    if (baseCatalog && baseCatalog.module !== node.module) {
      drifts.push(`IA/catalog module ownership differs: ${node.sourceNodeKey}`);
    }

    const canonicalPath = pathname(node.canonicalRoute);
    const productionAuthorized = node.contractProductionState !== 'NOT_AUTHORIZED_G6';
    const external = catalog?.lifecycle === 'EXTERNAL';
    const requiredAdminMount = catalog?.externalTarget
      ? HRIS_EXTERNAL_TARGET_ADMIN_MOUNT[catalog.externalTarget]
      : undefined;
    const externalAdminGroup = requiredAdminMount
      ? adminNavigationBySection.get(requiredAdminMount.section)
      : undefined;
    const targetItem = requiredAdminMount
      ? externalAdminGroup?.items.find((item) => item.view === requiredAdminMount.view)
      : undefined;
    const targetPathMatches = targetItem?.path === canonicalPath;
    const targetMounted = targetItem ? mountedAdminViews.has(targetItem.view) : false;
    const targetProtected = Boolean(
      targetItem?.requiredResourceKey && targetItem.requiredPermissionCode
    );
    const targetPageAuthorized = authorizedPagePaths.has(canonicalPath);
    const externalTargetAvailable = Boolean(
      requiredAdminMount && targetPathMatches && targetMounted && targetProtected
    );
    if (external && !catalog?.externalTarget) {
      drifts.push(`EXTERNAL catalog node has no external target: ${node.sourceNodeKey}`);
    }
    if (requiredAdminMount) {
      if (!externalAdminGroup || externalAdminGroup.items.length === 0) {
        drifts.push(
          `external control-plane target has no admin navigation items: ${node.sourceNodeKey} -> ${requiredAdminMount.section}`
        );
      } else if (!targetItem) {
        drifts.push(
          `external control-plane target has no admin navigation item: ${node.sourceNodeKey} -> ${requiredAdminMount.view}`
        );
      } else {
        if (!targetPathMatches) {
          drifts.push(
            `external control-plane canonical path differs: ${node.sourceNodeKey} expected=${canonicalPath} actual=${targetItem.path}`
          );
        }
        if (!targetMounted) {
          drifts.push(
            `external control-plane target has no admin page mount: ${node.sourceNodeKey} -> ${requiredAdminMount.view}`
          );
        }
        if (!targetProtected) {
          drifts.push(
            `external control-plane target has an unprotected admin item: ${node.sourceNodeKey} -> ${requiredAdminMount.view}`
          );
        }
      }
    }
    if (external && catalog?.href) {
      const hrefPath = pathname(catalog.href);
      if (hrefPath !== canonicalPath) {
        drifts.push(
          `external catalog href differs from canonical path: ${node.sourceNodeKey} expected=${canonicalPath} actual=${hrefPath}`
        );
      }
      if (!targetItem || targetItem.path !== hrefPath || !targetMounted) {
        drifts.push(
          `external catalog href has no admin page mount: ${node.sourceNodeKey} -> ${hrefPath}`
        );
      }
      if (!authorizedPagePaths.has(hrefPath)) {
        drifts.push(
          `external catalog href has no PAGE authorization: ${node.sourceNodeKey} -> ${hrefPath}`
        );
      }
    }

    const retiredAliasPaths = (catalog?.legacyPaths ?? []).filter((path) => {
      const exactOwners = runtimeCanonicalOwners.get(path) ?? [];
      return exactOwners.some((owner) => owner !== node.iaNodeId);
    });
    const retiredAliases = new Set(retiredAliasPaths);
    const mountedCompatibilityPaths = (catalog?.legacyPaths ?? []).filter((path) => {
      if (path === canonicalPath || retiredAliases.has(path)) return false;
      const route = mountedRouteByPath.get(path);
      return route !== undefined && mountedViews.has(route.view);
    });
    const mountedCurrentPartialPaths = (catalog?.currentPartialPaths ?? []).filter((path) => {
      if (path !== canonicalPath) {
        drifts.push(
          `current partial path does not match its canonical owner: ${node.sourceNodeKey} -> ${path}`
        );
      }
      const route = navigationByPath.get(path);
      if (!route || !mountedViews.has(route.view)) {
        drifts.push(`current partial path is not mounted: ${node.sourceNodeKey} -> ${path}`);
        return false;
      }
      if (!authorizedPagePaths.has(path)) {
        drifts.push(
          `current partial path has no PAGE authorization: ${node.sourceNodeKey} -> ${path}`
        );
        return false;
      }
      return true;
    });
    const state = classifyNode({
      canonicalRoute: canonicalPath,
      productionAuthorized,
      exactMountedPaths,
      mountedCompatibilityPaths,
      authorizedPagePaths,
      external,
      externalTargetAvailable,
    });
    if (exactMountedPaths.has(canonicalPath) && !authorizedPagePaths.has(canonicalPath)) {
      drifts.push(`canonical IA route is mounted without PAGE authorization: ${canonicalPath}`);
    }

    return {
      iaNodeId: node.iaNodeId,
      sourceNodeKey: node.sourceNodeKey,
      module: node.module,
      canonicalRoute: node.canonicalRoute,
      state,
      hasCurrentCatalog: catalog !== undefined,
      hasPageAuthorization: targetPageAuthorized,
      authorizationKind: targetPageAuthorized
        ? 'PRODUCT_PAGE'
        : external && targetProtected
          ? 'ADMIN_RESOURCE_GUARD'
          : 'NONE',
      hasExactMountedRoute: exactMountedPaths.has(canonicalPath),
      hasCompatibilityRoute: mountedCompatibilityPaths.length > 0,
      mountedCompatibilityPaths: Object.freeze([...mountedCompatibilityPaths]),
      retiredAliasPaths: Object.freeze([...retiredAliasPaths]),
      mountedCurrentPartialPaths: Object.freeze([...mountedCurrentPartialPaths]),
      productionState: node.contractProductionState,
    };
  });

  const productionAuthorizedNodes = nodes.filter(
    (node) => node.state === 'MOUNTED_PRODUCTION_AUTHORIZED'
  ).length;
  if (
    !tenantActivation.featureEnablementAuthorized &&
    (tenantActivation.globalActiveSeeds !== 0 || productionAuthorizedNodes !== 0)
  ) {
    drifts.push('default-OFF activation evidence contradicts active seeds or authorized IA nodes');
  }
  if (
    !tenantActivation.tenantEnrollmentAuthorized &&
    tenantActivation.tenantEnrollmentSeeds !== 0
  ) {
    drifts.push('tenant enrollment is unauthorized but enrollment seeds are present');
  }
  if (
    tenantActivation.productionProviderHandlerSchedulerOrBrokerBindings !== 0 &&
    productionAuthorizedNodes === 0
  ) {
    drifts.push('production bindings exist while no IA node is production-authorized');
  }

  const states = Object.fromEntries(
    HRIS_CROSS_LAYER_STATES.map((state) => [
      state,
      nodes.filter((node) => node.state === state).length,
    ])
  ) as Record<HrisCrossLayerState, number>;

  return Object.freeze({
    nodes: Object.freeze(nodes),
    drifts: Object.freeze([...new Set(drifts)].sort()),
    summary: Object.freeze({
      baseIaNodes: HRIS_IA_CONTRACT_NODES.length,
      runtimeNodes: nodes.length,
      baseCatalogNodes: catalogNodes.length,
      modernNodes: nodes.filter((node) => !node.hasCurrentCatalog).length,
      hcmNavigationRoutes: navigationItems.length,
      compatibilityRoutes: HCM_DEEP_LINK_COMPATIBILITY_ITEMS.length,
      authorizedPageRoutes: authorizedPagePaths.size,
      governedAdmissionMountedRoutes: HRIS_R7_GOVERNED_PAGE_CATALOG.filter(
        (item) => item.state === 'ADMISSION_MOUNTED'
      ).length,
      governedCatalogOnlyRoutes: HRIS_R7_GOVERNED_PAGE_CATALOG.filter(
        (item) => item.state === 'CATALOG_ONLY'
      ).length,
      productionAuthorizedNodes,
      declaredActivationEvidenceSource: tenantActivation.evidenceSource,
      declaredActivationState: tenantActivation.state,
      states: Object.freeze(states),
    }),
  });
}

export type { HcmView } from '../features/hcm/hcm-navigation';
export type { AdminView } from '../features/admin/admin-navigation';
