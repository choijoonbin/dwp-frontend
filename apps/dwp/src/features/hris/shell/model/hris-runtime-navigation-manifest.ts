import {
  HRIS_IA_CONTRACT_NODES,
  HRIS_IA_CONTRACT_REVISION,
  HRIS_IA_CONTRACT_SHELL_ENTRIES,
  HRIS_IA_CONTRACT_TASK_GROUPS,
} from './hris-information-architecture.generated';
import { HRIS_PRODUCT_MAP_CATALOG } from './hris-product-map-catalog';
import {
  HRIS_CONTROLLED_EXPORT_GROUP_ID,
  HRIS_CONTROLLED_EXPORT_NODE_ID,
  HRIS_CONTROLLED_EXPORT_TOPOLOGY_NODE,
  HRIS_NAVIGATION_TOPOLOGY_PREDECESSOR_REVISION,
  HRIS_NAVIGATION_TOPOLOGY_PREDECESSOR_SHA256,
  HRIS_NAVIGATION_TOPOLOGY_SUCCESSOR_REVISION,
  HRIS_NAVIGATION_TOPOLOGY_SUCCESSOR_SHA256,
} from './hris-navigation-topology-successor';

import type {
  HrisAvailability,
  HrisCatalogNode,
  HrisExternalTarget,
  HrisLifecycle,
  HrisLocalizedText,
} from './hris-product-map-contract';

type HrisIaContractNode = (typeof HRIS_IA_CONTRACT_NODES)[number];

export type HrisRuntimeCatalogProjection = Readonly<{
  lifecycle: HrisLifecycle;
  availability: HrisAvailability;
  authorization: HrisCatalogNode['authorization'];
  label: HrisLocalizedText;
  capability: HrisLocalizedText;
  coverageNote: HrisLocalizedText | null;
  legacyPaths: readonly string[];
  currentPartialPaths: readonly string[];
  externalTarget: HrisExternalTarget | null;
  href: string | null;
}>;

export type HrisRuntimeNavigationNode =
  | (HrisIaContractNode &
      Readonly<{
        /**
         * Current frontend delivery and presentation truth for BASE76 nodes only.
         * Contract lifecycle and implementation fields above are historical IA facts and must
         * never be used to activate navigation.
         */
        currentCatalog: HrisRuntimeCatalogProjection | null;
      }>)
  | typeof HRIS_CONTROLLED_EXPORT_TOPOLOGY_NODE;

function fail(message: string): never {
  throw new Error(`HRIS runtime navigation manifest error: ${message}`);
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  return Object.freeze(value);
}

function cloneLocalizedText(value: HrisLocalizedText): HrisLocalizedText {
  return { ko: value.ko, en: value.en };
}

function projectCurrentCatalog(node: HrisCatalogNode): HrisRuntimeCatalogProjection {
  return {
    lifecycle: node.lifecycle,
    availability: node.availability,
    authorization: node.authorization,
    label: cloneLocalizedText(node.label),
    capability: cloneLocalizedText(node.capability),
    coverageNote: node.coverageNote ? cloneLocalizedText(node.coverageNote) : null,
    legacyPaths: [...node.legacyPaths],
    currentPartialPaths: [...node.currentPartialPaths],
    externalTarget: node.externalTarget ?? null,
    href: node.href ?? null,
  };
}

function buildRuntimeNodes(): HrisRuntimeNavigationNode[] {
  const catalogById = new Map(HRIS_PRODUCT_MAP_CATALOG.map((node) => [node.id, node]));
  if (catalogById.size !== HRIS_PRODUCT_MAP_CATALOG.length)
    fail('current catalog IDs are not unique');

  const baseNodes = HRIS_IA_CONTRACT_NODES.filter((node) => node.sourceSet === 'BASE76');
  const baseIds = new Set<string>(baseNodes.map((node) => node.sourceNodeKey));
  if (baseNodes.length !== 76 || HRIS_PRODUCT_MAP_CATALOG.length !== 76) {
    fail('BASE76 and current catalog must each contain exactly 76 nodes');
  }
  for (const catalogNode of HRIS_PRODUCT_MAP_CATALOG) {
    if (!baseIds.has(catalogNode.id))
      fail(`current catalog node is absent from IA: ${catalogNode.id}`);
  }

  const historicalNodes: HrisRuntimeNavigationNode[] = HRIS_IA_CONTRACT_NODES.map((node) => {
    if (node.sourceSet === 'MODERN22') return { ...node, currentCatalog: null };
    const current = catalogById.get(node.sourceNodeKey);
    if (!current) fail(`BASE76 node is absent from the current catalog: ${node.sourceNodeKey}`);
    if (
      current.inventoryGroup !== node.inventoryGroup ||
      current.surface !== node.navigationSurface ||
      current.module !== node.module
    ) {
      fail(`BASE76 ownership drift: ${node.sourceNodeKey}`);
    }
    return { ...node, currentCatalog: projectCurrentCatalog(current) };
  });
  return [...historicalNodes, HRIS_CONTROLLED_EXPORT_TOPOLOGY_NODE];
}

function buildRuntimeTaskGroups() {
  return HRIS_IA_CONTRACT_TASK_GROUPS.map((group) => ({
    ...group,
    memberIaNodeIds:
      group.taskGroupId === HRIS_CONTROLLED_EXPORT_GROUP_ID
        ? [...group.memberIaNodeIds, HRIS_CONTROLLED_EXPORT_NODE_ID]
        : [...group.memberIaNodeIds],
  }));
}

export const HRIS_RUNTIME_NAVIGATION_MANIFEST = deepFreeze({
  revision: {
    ...HRIS_IA_CONTRACT_REVISION,
    topologyRevision: HRIS_NAVIGATION_TOPOLOGY_SUCCESSOR_REVISION,
    topologySha256: HRIS_NAVIGATION_TOPOLOGY_SUCCESSOR_SHA256,
    predecessor: {
      topologyRevision: HRIS_NAVIGATION_TOPOLOGY_PREDECESSOR_REVISION,
      topologySha256: HRIS_NAVIGATION_TOPOLOGY_PREDECESSOR_SHA256,
    },
    counts: {
      nodes: 99,
      shellEntries: 9,
      taskGroups: 46,
    },
    sources: HRIS_IA_CONTRACT_REVISION.sources.map((source) => ({ ...source })),
  },
  nodes: buildRuntimeNodes(),
  shellEntries: HRIS_IA_CONTRACT_SHELL_ENTRIES.map((entry) => ({
    ...entry,
    memberInventoryGroups: [...entry.memberInventoryGroups],
    memberNavigationSurfaces: [...entry.memberNavigationSurfaces],
  })),
  taskGroups: buildRuntimeTaskGroups(),
});

export type HrisRuntimeNavigationManifest = typeof HRIS_RUNTIME_NAVIGATION_MANIFEST;
