import type {
  EffectiveWidgetCatalog,
  EffectiveWidgetCatalogItem,
  HomeExperienceVariant,
  HomeWidgetKey,
  WidgetPlacementContext,
  WidgetPublicReasonCode,
  WidgetRegistryConnection,
  WidgetRegistryReadiness,
} from '@dwp-frontend/shared-utils';
import type {
  HomeWidgetRuntimeDecision,
  HomeWidgetRuntimeDecisions,
  HomeWidgetShadowObservation,
} from '../../../components/home-widget-runtime-contract';

export type {
  HomeWidgetRuntimeDecision,
  HomeWidgetRuntimeDecisions,
  HomeWidgetShadowObservation,
  HomeWidgetShadowObservationStatus,
} from '../../../components/home-widget-runtime-contract';

export const HOME_NATIVE_HOST_API_VERSION = 1;

export function homeWidgetRegistryEffectiveQueryKey(
  tenantId: number | undefined,
  userId: number | undefined,
  mode: HomeExperienceVariant,
  readiness: WidgetRegistryReadiness | undefined
) {
  return [
    'widget-registry',
    'effective',
    tenantId,
    userId,
    'workspace-home',
    mode,
    readiness?.migrationMode,
    readiness?.registryRevision,
    readiness?.policyRevision,
    readiness?.safetyRevision,
  ] as const;
}

export type NativeHomeWidgetBinding = Readonly<{
  legacyWidgetKey: HomeWidgetKey;
  definitionKey: string;
  semanticVersion: '1.0.0' | '1.0.1';
  expectedManifestHash: string;
  rendererKey: string;
  minimumHostApiVersion: 1;
  supportedContexts: readonly WidgetPlacementContext[];
}>;

export const NATIVE_HOME_WIDGET_BINDINGS: readonly NativeHomeWidgetBinding[] = [
  {
    legacyWidgetKey: 'command-rail',
    definitionKey: 'core.workspace.command-rail',
    semanticVersion: '1.0.1',
    expectedManifestHash: '36de53926e21ef11e61c78f6325fdf35b37998fe42403e0df0e70d71e3f4df13',
    rendererKey: 'home.command-rail',
    minimumHostApiVersion: 1,
    supportedContexts: ['CLASSIC_PERSONAL', 'FLOW_PERSONAL'],
  },
  {
    legacyWidgetKey: 'daily-brief',
    definitionKey: 'core.workspace.daily-brief',
    semanticVersion: '1.0.0',
    expectedManifestHash: '9b7f48b7ea4ef429120db330a4972c3315ad682759fa86e49c212c42bdd02406',
    rendererKey: 'home.daily-brief',
    minimumHostApiVersion: 1,
    supportedContexts: ['CLASSIC_PERSONAL', 'FLOW_PERSONAL'],
  },
  {
    legacyWidgetKey: 'focus',
    definitionKey: 'core.work.focus',
    semanticVersion: '1.0.0',
    expectedManifestHash: '36d1b02326e4725a235749e173dfdf50a0423ef30f42d7ccab97946ba826d893',
    rendererKey: 'home.focus',
    minimumHostApiVersion: 1,
    supportedContexts: ['CLASSIC_PERSONAL', 'FLOW_PERSONAL'],
  },
  {
    legacyWidgetKey: 'schedule',
    definitionKey: 'core.calendar.schedule',
    semanticVersion: '1.0.0',
    expectedManifestHash: '7f3e090997a213e9d3e6f8184e1458e57382c5f31db79f00fbf678d36f884f5d',
    rendererKey: 'home.schedule',
    minimumHostApiVersion: 1,
    supportedContexts: ['CLASSIC_PERSONAL', 'FLOW_PERSONAL'],
  },
  {
    legacyWidgetKey: 'activity',
    definitionKey: 'core.activity.activity',
    semanticVersion: '1.0.0',
    expectedManifestHash: 'fbab61015ec3b20c2faf9810b1758aebbd7517029baa64cb6b99190815836ca1',
    rendererKey: 'home.activity',
    minimumHostApiVersion: 1,
    supportedContexts: ['CLASSIC_PERSONAL', 'FLOW_PERSONAL'],
  },
  {
    legacyWidgetKey: 'focus-balance',
    definitionKey: 'core.work.focus-balance',
    semanticVersion: '1.0.1',
    expectedManifestHash: '5f4c5990a0b1b417832c93074f92a00cbb8c9e4f4e49240073120c485a8c9436',
    rendererKey: 'home.focus-balance',
    minimumHostApiVersion: 1,
    supportedContexts: ['CLASSIC_PERSONAL', 'FLOW_PERSONAL'],
  },
  {
    legacyWidgetKey: 'meeting-load',
    definitionKey: 'core.calendar.meeting-load',
    semanticVersion: '1.0.1',
    expectedManifestHash: '90d31f29e1dbc8e26a49475174aca5ecd76d557f3b7d39975f58ff1f047bb6c3',
    rendererKey: 'home.meeting-load',
    minimumHostApiVersion: 1,
    supportedContexts: ['CLASSIC_PERSONAL', 'FLOW_PERSONAL'],
  },
] as const;

// Catalog-wide revision emitted by WidgetCatalogService after evaluating all 19
// Wave 4 bindings (7 native and 14 owner definitions). The broker copies this
// aggregate revision into every RuntimeDefinition envelope.
export const HOME_WIDGET_BINDING_CATALOG_REVISION =
  '2fcb00cb8df02d953d5e4be94d7659dd937f951a02fba3aeabefa73de30a024b';

// Compatibility alias for native-renderer call sites. The backend signs every
// runtime definition, including owner widgets, with the same catalog revision.
export const HOME_NATIVE_BINDING_CATALOG_REVISION = HOME_WIDGET_BINDING_CATALOG_REVISION;

const PUBLIC_REASON_CODES = new Set<WidgetPublicReasonCode>([
  'NOT_AVAILABLE',
  'DISABLED_BY_ORGANIZATION',
  'APP_ACCESS_REQUIRED',
  'INCOMPATIBLE',
  'TEMPORARILY_UNAVAILABLE',
  'DEPRECATED',
  'AVAILABLE',
  'ALREADY_ADDED',
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const EFFECTIVE_ITEM_KEYS = [
  'addedInstanceCount',
  'definitionId',
  'definitionKey',
  'effectiveState',
  'legacyWidgetKey',
  'placementCapabilities',
  'reasonCodes',
  'resolvedVersionId',
  'semanticVersion',
] as const;
const PLACEMENT_CAPABILITY_KEYS = ['canAdd', 'canHide', 'canMove', 'canResize'] as const;
const CONTEXT_CAPABILITY_KEYS = [
  'brokerRead',
  'instanceV6Write',
  'legacyPlacementWrite',
  'libraryRead',
  'presetCreate',
  'presetShare',
] as const;
const HOST_CONTEXT_KEYS = [
  'activeViewRef',
  'compositionSchemaVersion',
  'decisionRevision',
  'homeExperienceVersion',
  'hostCapabilityVersion',
  'hostConfigurationRevision',
  'layoutRevision',
  'layoutSource',
  'resolvedHostMode',
  'surfaceKey',
] as const;
const CATALOG_KEYS = [
  'bindingCatalogRevision',
  'catalogRevision',
  'contexts',
  'hostContext',
  'mode',
  'policyRevision',
  'safetyRevision',
  'schemaVersion',
] as const;

function hasExactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function safePublicReason(value: unknown): WidgetPublicReasonCode {
  return typeof value === 'string' && PUBLIC_REASON_CODES.has(value as WidgetPublicReasonCode)
    ? (value as WidgetPublicReasonCode)
    : 'TEMPORARILY_UNAVAILABLE';
}

function unavailable(
  widgetKey: HomeWidgetKey,
  publicReason: WidgetPublicReasonCode = 'TEMPORARILY_UNAVAILABLE'
): HomeWidgetRuntimeDecision {
  return {
    widgetKey,
    rendererKey: null,
    render: 'UNAVAILABLE',
    canAdd: false,
    canRestore: false,
    deprecated: false,
    publicReason,
  };
}

function staticDecision(binding: NativeHomeWidgetBinding): HomeWidgetRuntimeDecision {
  return {
    widgetKey: binding.legacyWidgetKey,
    rendererKey: binding.rendererKey,
    render: 'NATIVE',
    canAdd: true,
    canRestore: true,
    deprecated: false,
    publicReason: 'AVAILABLE',
  };
}

const STATIC_HOME_WIDGET_RUNTIME_DECISIONS = Object.freeze(
  Object.fromEntries(
    NATIVE_HOME_WIDGET_BINDINGS.map((binding) => [binding.legacyWidgetKey, staticDecision(binding)])
  )
) as HomeWidgetRuntimeDecisions;

export function staticHomeWidgetRuntimeDecisions(): HomeWidgetRuntimeDecisions {
  return STATIC_HOME_WIDGET_RUNTIME_DECISIONS;
}

function expectedContext(
  catalog: EffectiveWidgetCatalog,
  binding: NativeHomeWidgetBinding
): WidgetPlacementContext | null {
  if (catalog.hostContext.resolvedHostMode === 'MZ') {
    if (
      binding.supportedContexts.includes('MZ_PERSONAL') ||
      binding.supportedContexts.includes('FLOW_PERSONAL')
    ) {
      return 'MZ_PERSONAL';
    }
    if (
      binding.supportedContexts.includes('MZ_GOVERNED') ||
      binding.supportedContexts.includes('FLOW_GOVERNED')
    ) {
      return 'MZ_GOVERNED';
    }
    return null;
  }
  const compatible = binding.supportedContexts.filter((context) => {
    if (catalog.hostContext.resolvedHostMode === 'CLASSIC') return context === 'CLASSIC_PERSONAL';
    return context === 'FLOW_PERSONAL' || context === 'FLOW_GOVERNED';
  });
  return compatible.length === 1 ? compatible[0]! : null;
}

function isEffectiveItem(value: unknown): value is EffectiveWidgetCatalogItem {
  if (!hasExactKeys(value, EFFECTIVE_ITEM_KEYS)) return false;
  const item = value as Partial<EffectiveWidgetCatalogItem>;
  const capabilities = item.placementCapabilities;
  return (
    typeof item.definitionId === 'string' &&
    UUID_PATTERN.test(item.definitionId) &&
    typeof item.definitionKey === 'string' &&
    (typeof item.legacyWidgetKey === 'string' || item.legacyWidgetKey === null) &&
    typeof item.resolvedVersionId === 'string' &&
    UUID_PATTERN.test(item.resolvedVersionId) &&
    typeof item.semanticVersion === 'string' &&
    ['AVAILABLE', 'ALREADY_ADDED', 'DEPRECATED', 'DENY'].includes(item.effectiveState as string) &&
    Array.isArray(item.reasonCodes) &&
    item.reasonCodes.length > 0 &&
    item.reasonCodes.every(
      (reason) =>
        typeof reason === 'string' && PUBLIC_REASON_CODES.has(reason as WidgetPublicReasonCode)
    ) &&
    hasExactKeys(capabilities, PLACEMENT_CAPABILITY_KEYS) &&
    PLACEMENT_CAPABILITY_KEYS.every((key) => typeof capabilities[key] === 'boolean') &&
    Number.isSafeInteger(item.addedInstanceCount) &&
    (item.addedInstanceCount ?? -1) >= 0
  );
}

function isCatalogContext(
  value: unknown,
  placementContext: WidgetPlacementContext
): value is EffectiveWidgetCatalog['contexts'][number] {
  if (!hasExactKeys(value, ['capabilities', 'items', 'placementContext'])) return false;
  if (value.placementContext !== placementContext || !Array.isArray(value.items)) return false;
  if (!hasExactKeys(value.capabilities, CONTEXT_CAPABILITY_KEYS)) return false;
  return CONTEXT_CAPABILITY_KEYS.every(
    (key) => typeof (value.capabilities as Record<string, unknown>)[key] === 'boolean'
  );
}

function isCatalogForMode(
  value: unknown,
  expectedMode: 'SHADOW' | 'AUTHORITATIVE'
): value is EffectiveWidgetCatalog {
  if (!hasExactKeys(value, CATALOG_KEYS)) return false;
  if (
    value.schemaVersion !== 1 ||
    value.mode !== expectedMode ||
    typeof value.catalogRevision !== 'string' ||
    !value.catalogRevision ||
    typeof value.bindingCatalogRevision !== 'string' ||
    !/^[0-9a-f]{64}$/u.test(value.bindingCatalogRevision) ||
    typeof value.policyRevision !== 'string' ||
    !value.policyRevision ||
    typeof value.safetyRevision !== 'string' ||
    !value.safetyRevision ||
    !Array.isArray(value.contexts) ||
    !hasExactKeys(value.hostContext, HOST_CONTEXT_KEYS)
  ) {
    return false;
  }
  const host = value.hostContext;
  const validHost =
    host.surfaceKey === 'workspace-home' &&
    (host.resolvedHostMode === 'CLASSIC' ||
      host.resolvedHostMode === 'FLOW' ||
      host.resolvedHostMode === 'MZ') &&
    Number.isSafeInteger(host.homeExperienceVersion) &&
    Number.isSafeInteger(host.compositionSchemaVersion) &&
    (host.layoutSource === 'HOME_VIEW' || host.layoutSource === 'LEGACY_PREFERENCE') &&
    (typeof host.activeViewRef === 'string' || host.activeViewRef === null) &&
    Number.isSafeInteger(host.layoutRevision) &&
    typeof host.hostConfigurationRevision === 'string' &&
    Boolean(host.hostConfigurationRevision) &&
    Number.isSafeInteger(host.hostCapabilityVersion) &&
    typeof host.decisionRevision === 'string' &&
    Boolean(host.decisionRevision);
  if (!validHost) return false;
  const seenContexts = new Set<WidgetPlacementContext>();
  return value.contexts.every((context) => {
    const placementContext = (context as { placementContext?: unknown }).placementContext;
    if (
      ![
        'CLASSIC_PERSONAL',
        'FLOW_PERSONAL',
        'FLOW_GOVERNED',
        'MZ_PERSONAL',
        'MZ_GOVERNED',
      ].includes(placementContext as string) ||
      seenContexts.has(placementContext as WidgetPlacementContext) ||
      !isCatalogContext(context, placementContext as WidgetPlacementContext) ||
      !context.items.every(isEffectiveItem)
    ) {
      return false;
    }
    seenContexts.add(placementContext as WidgetPlacementContext);
    return true;
  });
}

function validateResolvedItem(
  item: EffectiveWidgetCatalogItem,
  binding: NativeHomeWidgetBinding,
  hostCapabilityVersion: number,
  placementWriteAllowed: boolean
): HomeWidgetRuntimeDecision {
  if (
    !isEffectiveItem(item) ||
    item.definitionKey !== binding.definitionKey ||
    item.legacyWidgetKey !== binding.legacyWidgetKey ||
    !item.definitionId ||
    !item.resolvedVersionId ||
    item.semanticVersion !== binding.semanticVersion ||
    binding.minimumHostApiVersion > hostCapabilityVersion ||
    hostCapabilityVersion > HOME_NATIVE_HOST_API_VERSION
  ) {
    return unavailable(binding.legacyWidgetKey, 'INCOMPATIBLE');
  }
  if (item.effectiveState === 'DEPRECATED') {
    return {
      widgetKey: binding.legacyWidgetKey,
      rendererKey: binding.rendererKey,
      render: 'NATIVE',
      canAdd: false,
      canRestore: false,
      deprecated: true,
      publicReason: 'DEPRECATED',
    };
  }
  if (item.effectiveState === 'AVAILABLE' || item.effectiveState === 'ALREADY_ADDED') {
    const expectedReason = item.effectiveState;
    if (!item.reasonCodes.includes(expectedReason)) {
      return unavailable(binding.legacyWidgetKey);
    }
    return {
      widgetKey: binding.legacyWidgetKey,
      rendererKey: binding.rendererKey,
      render: 'NATIVE',
      canAdd:
        item.effectiveState === 'AVAILABLE' &&
        placementWriteAllowed &&
        item.placementCapabilities.canAdd,
      canRestore:
        item.effectiveState === 'AVAILABLE' &&
        placementWriteAllowed &&
        item.placementCapabilities.canAdd,
      deprecated: false,
      publicReason: expectedReason,
    };
  }
  return unavailable(binding.legacyWidgetKey, safePublicReason(item.reasonCodes[0]));
}

export function resolveHomeWidgetRuntimeDecisions(
  connection: WidgetRegistryConnection,
  catalog: EffectiveWidgetCatalog | null | undefined
): HomeWidgetRuntimeDecisions {
  if (connection.runtimeSource !== 'AUTHORITATIVE') return staticHomeWidgetRuntimeDecisions();
  if (
    !isCatalogForMode(catalog, 'AUTHORITATIVE') ||
    catalog.bindingCatalogRevision !== HOME_NATIVE_BINDING_CATALOG_REVISION
  ) {
    return Object.fromEntries(
      NATIVE_HOME_WIDGET_BINDINGS.map((binding) => [
        binding.legacyWidgetKey,
        unavailable(binding.legacyWidgetKey),
      ])
    ) as HomeWidgetRuntimeDecisions;
  }
  return resolveValidatedCatalog(catalog);
}

function resolveValidatedCatalog(catalog: EffectiveWidgetCatalog): HomeWidgetRuntimeDecisions {
  return Object.fromEntries(
    NATIVE_HOME_WIDGET_BINDINGS.map((binding) => {
      const placementContext = expectedContext(catalog, binding);
      const contexts = placementContext
        ? catalog.contexts.filter((context) => isCatalogContext(context, placementContext))
        : [];
      if (contexts.length !== 1) {
        return [binding.legacyWidgetKey, unavailable(binding.legacyWidgetKey)];
      }
      const selectedContext = contexts[0]!;
      const candidates = selectedContext.items.filter((candidate) => {
        if (!candidate || typeof candidate !== 'object') return false;
        const item = candidate as Partial<EffectiveWidgetCatalogItem>;
        return (
          item.legacyWidgetKey === binding.legacyWidgetKey ||
          item.definitionKey === binding.definitionKey
        );
      });
      const placementWriteAllowed =
        selectedContext.capabilities.libraryRead &&
        (selectedContext.capabilities.legacyPlacementWrite ||
          selectedContext.capabilities.instanceV6Write);
      return [
        binding.legacyWidgetKey,
        candidates.length === 1 && isEffectiveItem(candidates[0])
          ? validateResolvedItem(
              candidates[0],
              binding,
              catalog.hostContext.hostCapabilityVersion,
              placementWriteAllowed
            )
          : unavailable(
              binding.legacyWidgetKey,
              candidates.length > 1 ? 'NOT_AVAILABLE' : undefined
            ),
      ];
    })
  ) as HomeWidgetRuntimeDecisions;
}

/**
 * Compares a valid SHADOW projection with the immutable native baseline. The result is
 * diagnostic evidence only: placement mutation flags are intentionally excluded and this
 * function never supplies renderer decisions to the Home runtime.
 */
export function observeHomeWidgetShadow(
  connection: WidgetRegistryConnection,
  catalog: EffectiveWidgetCatalog | null | undefined
): HomeWidgetShadowObservation {
  if (!connection.observeShadow) {
    return { status: 'INACTIVE', mismatchCount: 0, decisionRevision: null, mismatches: [] };
  }
  if (catalog === undefined) {
    return { status: 'PENDING', mismatchCount: 0, decisionRevision: null, mismatches: [] };
  }
  if (!isCatalogForMode(catalog, 'SHADOW')) {
    return { status: 'INVALID', mismatchCount: 0, decisionRevision: null, mismatches: [] };
  }

  if (catalog.bindingCatalogRevision !== HOME_NATIVE_BINDING_CATALOG_REVISION) {
    return {
      status: 'DRIFT',
      mismatchCount: NATIVE_HOME_WIDGET_BINDINGS.length,
      decisionRevision: catalog.hostContext.decisionRevision,
      mismatches: NATIVE_HOME_WIDGET_BINDINGS.map((binding) => ({
        widgetKey: binding.legacyWidgetKey,
        observedRender: 'UNAVAILABLE',
        observedReason: 'INCOMPATIBLE',
      })),
    };
  }

  const observed = resolveValidatedCatalog(catalog);
  const mismatches: Array<HomeWidgetShadowObservation['mismatches'][number]> = [];
  NATIVE_HOME_WIDGET_BINDINGS.forEach((binding) => {
    const decision = observed[binding.legacyWidgetKey];
    const matchesStaticBaseline =
      decision.render === 'NATIVE' &&
      decision.rendererKey === binding.rendererKey &&
      !decision.deprecated &&
      (decision.publicReason === 'AVAILABLE' || decision.publicReason === 'ALREADY_ADDED');
    if (!matchesStaticBaseline) {
      mismatches.push({
        widgetKey: binding.legacyWidgetKey,
        observedRender: decision.render,
        observedReason: decision.publicReason,
      });
    }
  });
  return {
    status: mismatches.length === 0 ? 'MATCH' : 'DRIFT',
    mismatchCount: mismatches.length,
    decisionRevision: catalog.hostContext.decisionRevision,
    mismatches,
  };
}
