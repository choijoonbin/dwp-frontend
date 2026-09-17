import {
  WIDGET_REGISTRY_CAPABILITIES,
  type WidgetRegistryReadiness,
} from './widget-registry-contract';

export type WidgetRegistryConnection = Readonly<{
  runtimeSource: 'STATIC' | 'AUTHORITATIVE';
  queryEffectiveCatalog: boolean;
  observeShadow: boolean;
  mutationAllowed: boolean;
  reason: 'ABSENT' | 'STATIC' | 'PARTIAL' | 'SHADOW' | 'AUTHORITATIVE';
}>;

function hasCapabilities(readiness: WidgetRegistryReadiness, required: readonly string[]): boolean {
  if (!Array.isArray(readiness.capabilities)) return false;
  const advertised = new Set<string>(readiness.capabilities);
  return required.every((capability) => advertised.has(capability));
}

/** Missing, malformed, or incomplete handshakes preserve the static Wave 1 runtime. */
export function resolveWidgetRegistryConnection(
  readiness: WidgetRegistryReadiness | null | undefined
): WidgetRegistryConnection {
  if (!readiness) {
    return {
      runtimeSource: 'STATIC',
      queryEffectiveCatalog: false,
      observeShadow: false,
      mutationAllowed: false,
      reason: 'ABSENT',
    };
  }
  if (
    readiness.schemaVersion !== 1 ||
    !readiness.controlPlaneReady ||
    readiness.migrationMode === 'STATIC'
  ) {
    return {
      runtimeSource: 'STATIC',
      queryEffectiveCatalog: false,
      observeShadow: false,
      mutationAllowed: false,
      reason: readiness.migrationMode === 'STATIC' ? 'STATIC' : 'PARTIAL',
    };
  }
  const controlPlaneCapabilities = [
    WIDGET_REGISTRY_CAPABILITIES.controlPlane,
    WIDGET_REGISTRY_CAPABILITIES.tenantPolicy,
  ];
  if (readiness.migrationMode === 'SHADOW') {
    const ready = hasCapabilities(readiness, [
      ...controlPlaneCapabilities,
      WIDGET_REGISTRY_CAPABILITIES.shadowEvaluation,
    ]);
    return {
      runtimeSource: 'STATIC',
      queryEffectiveCatalog: ready,
      observeShadow: ready,
      mutationAllowed: false,
      reason: ready ? 'SHADOW' : 'PARTIAL',
    };
  }
  if (readiness.migrationMode !== 'AUTHORITATIVE') {
    return {
      runtimeSource: 'STATIC',
      queryEffectiveCatalog: false,
      observeShadow: false,
      mutationAllowed: false,
      reason: 'PARTIAL',
    };
  }
  const authoritative =
    readiness.runtimeActivationReady === true &&
    hasCapabilities(readiness, [
      ...controlPlaneCapabilities,
      WIDGET_REGISTRY_CAPABILITIES.authoritativeRuntime,
    ]);
  return {
    runtimeSource: authoritative ? 'AUTHORITATIVE' : 'STATIC',
    queryEffectiveCatalog: authoritative,
    observeShadow: false,
    mutationAllowed: authoritative,
    reason: authoritative ? 'AUTHORITATIVE' : 'PARTIAL',
  };
}
