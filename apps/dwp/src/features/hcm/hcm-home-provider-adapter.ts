import type { AppEntitlementPermission } from '@dwp-frontend/shared-utils';

export type HcmHomeProviderAudience =
  'EMPLOYEE' | 'MANAGER' | 'OPERATOR' | 'SETTINGS_ADMIN' | 'AUDITOR';
export type HcmHomeProviderModule = 'SYS' | 'HRM' | 'TIM' | 'PAY' | 'PER';
export type HcmHomeProviderState =
  | 'AVAILABLE'
  | 'EMPTY'
  | 'STALE'
  | 'PARTIAL'
  | 'UNAVAILABLE'
  | 'FORBIDDEN'
  | 'CONFIGURATION_REQUIRED';

export type HcmHomeProviderPayloadMap = Readonly<{
  'hrm-self-employment': Readonly<{
    displayName: string;
    businessTitle: string | null;
    organizationName: string | null;
    managerDisplayName: string | null;
  }>;
  'hrm-team-shape': Readonly<{ directReportCount: number }>;
  'tim-self-time': Readonly<{
    periodStart: string | null;
    periodEnd: string | null;
    status: string | null;
    recordedMinutes: number | null;
    scheduledMinutes: number | null;
    exceptionCount: number;
  }>;
  'tim-self-absence': Readonly<{
    leavePlanCount: number;
    standardDayMinutes: number | null;
    displayBalance: Readonly<{
      grantedMinutes: number;
      usedMinutes: number;
      pendingMinutes: number;
      availableMinutes: number;
    }> | null;
  }>;
  'tim-team-time-decisions': Readonly<{ timePendingCount: number | null }>;
  'tim-team-absence-decisions': Readonly<{ absencePendingCount: number | null }>;
  'pay-self-cycle': Readonly<{
    payDate: string | null;
    status: string | null;
    timeValidated: boolean | null;
    absenceValidated: boolean | null;
    sourceConfirmed: boolean | null;
  }>;
  'per-self-performance': Readonly<{
    activeGoalCount: number;
    requiredLearningCount: number;
    activeJourneyCount: number;
    nearestTargetDate: string | null;
    activeJourneyProgressPercent: number | null;
  }>;
}>;

export type HcmHomeProviderWidgetId = keyof HcmHomeProviderPayloadMap;

export type HcmHomeProviderSnapshot = Readonly<{
  contractVersion: 1;
  widgetId: string;
  sourceModule: HcmHomeProviderModule;
  dataAuthority: 'MODULE_API' | 'LEGACY_AGGREGATE_COMPATIBILITY';
  audience: readonly HcmHomeProviderAudience[];
  requiredEntitlements: readonly Readonly<{
    resourceType: string;
    resourceKey: string;
    permissionCodes: readonly string[];
    match: 'ANY' | 'ALL';
  }>[];
  scope: Readonly<{ kind: 'SELF' | 'TEAM' | 'ORG_UNIT' | 'LEGAL_ENTITY'; key: string }>;
  horizon: 'NOW' | 'NEXT' | 'CHANGED';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  freshness: Readonly<{
    generatedAt: string | null;
    maxAgeSeconds: number;
    state: 'FRESH' | 'STALE' | 'UNKNOWN';
  }>;
  sensitivity: Readonly<{
    classification: 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
    projection: 'VIEW' | 'MASK' | 'OMIT';
    exposedFields: readonly string[];
  }>;
  purpose: 'HRIS_HOME';
  policyRevision: string;
  state: HcmHomeProviderState;
  reasonCode: string | null;
  payload: unknown;
  primaryAction: Readonly<{ actionId: string; labelKey: string }> | null;
  deepLink: string | null;
  traceId: string | null;
}>;

export type HcmHomeProviderContext = Readonly<{
  audiences: readonly HcmHomeProviderAudience[];
  scope: Readonly<{ kind: 'SELF' | 'TEAM'; key: string }>;
  surfaceEntitled: boolean;
  entitlements: readonly AppEntitlementPermission[];
  legacyCompatibilityAuthorities: readonly string[];
  dataAuthorities: readonly ('MODULE_API' | 'LEGACY_AGGREGATE_COMPATIBILITY')[];
  tenantCacheKey: string | null;
  subjectCacheKey: string | null;
  authorityCacheKey: string;
  contextScopeKey: string | null;
  decisionRevision: string;
  accessMode: string;
  purpose: 'HRIS_HOME';
  asOf: string;
  now: string;
  traceId: string | null;
}>;

export type HcmHomeSnapshotContribution = Readonly<{
  sourceId: string;
  dataAuthority: 'MODULE_API' | 'LEGACY_AGGREGATE_COMPATIBILITY';
  snapshots: readonly HcmHomeProviderSnapshot[];
  metadata: Readonly<{
    asOf: string | null;
    generatedAt: string | null;
    referenceDataPresent: boolean;
  }> | null;
}>;

export type HcmHomePayloadFieldDescriptor =
  | Readonly<{ type: 'STRING'; nullable: boolean; nonBlank: boolean }>
  | Readonly<{ type: 'DATE_KEY'; nullable: boolean }>
  | Readonly<{ type: 'BOOLEAN'; nullable: boolean }>
  | Readonly<{
      type: 'NUMBER';
      nullable: boolean;
      integer: boolean;
      minimum: number | null;
      maximum: number | null;
    }>
  | Readonly<{
      type: 'OBJECT';
      nullable: boolean;
      fields: Readonly<Record<string, HcmHomePayloadFieldDescriptor>>;
    }>;

export type HcmHomeWidgetContract = Readonly<{
  contractVersion: 1;
  widgetId: string;
  sourceModule: HcmHomeProviderModule;
  dataAuthority: 'MODULE_API' | 'LEGACY_AGGREGATE_COMPATIBILITY';
  audience: readonly HcmHomeProviderAudience[];
  requiredEntitlements: HcmHomeProviderSnapshot['requiredEntitlements'];
  entitlementMode: 'STRICT' | 'LEGACY_SURFACE_COMPATIBILITY';
  legacyCompatibilityAuthority?: string;
  supportedScopes: readonly ('SELF' | 'TEAM' | 'ORG_UNIT' | 'LEGAL_ENTITY')[];
  horizon: HcmHomeProviderSnapshot['horizon'];
  freshnessSeconds: number;
  sensitivity: HcmHomeProviderSnapshot['sensitivity'];
  payloadDescriptor: Extract<HcmHomePayloadFieldDescriptor, Readonly<{ type: 'OBJECT' }>>;
  purpose: 'HRIS_HOME';
  policyRevision: string;
  primaryAction: NonNullable<HcmHomeProviderSnapshot['primaryAction']>;
  deepLink: string;
}>;

export type HcmHomeProviderSource = Readonly<{
  sourceId: string;
  dataAuthority: 'MODULE_API' | 'LEGACY_AGGREGATE_COMPATIBILITY';
  widgetIds: readonly string[];
  widgetContracts: readonly HcmHomeWidgetContract[];
  queryKey: (context: HcmHomeProviderContext) => readonly unknown[];
  load: (context: HcmHomeProviderContext, signal?: AbortSignal) => Promise<unknown>;
  resolve: (data: unknown, context: HcmHomeProviderContext) => HcmHomeSnapshotContribution;
  unavailable: (context: HcmHomeProviderContext, reasonCode: string) => HcmHomeSnapshotContribution;
}>;

export type HcmHomeModuleProviderRegistry = Readonly<{
  schemaVersion: 1;
  sources: readonly HcmHomeProviderSource[];
  canLoadSource: (sourceId: string, context: HcmHomeProviderContext) => boolean;
  unavailableContribution: (
    sourceId: string,
    context: HcmHomeProviderContext,
    reasonCode: string
  ) => HcmHomeSnapshotContribution;
  compose: (
    contributions: readonly HcmHomeSnapshotContribution[],
    context: HcmHomeProviderContext
  ) => Readonly<{
    snapshots: readonly HcmHomeProviderSnapshot[];
    metadata: HcmHomeSnapshotContribution['metadata'];
  }>;
}>;

export type HcmHomeProviderQueryResolution = Readonly<{
  hasData: boolean;
  data: unknown;
  reasonCode: string;
}>;

export function canLoadHcmHomeSourceSafely(
  registry: HcmHomeModuleProviderRegistry,
  sourceId: string,
  context: HcmHomeProviderContext
): boolean {
  try {
    return registry.canLoadSource(sourceId, context);
  } catch {
    return false;
  }
}

export function loadHcmHomeSourceSafely(
  registry: HcmHomeModuleProviderRegistry,
  source: HcmHomeProviderSource,
  context: HcmHomeProviderContext,
  signal?: AbortSignal
): Promise<unknown> {
  if (!canLoadHcmHomeSourceSafely(registry, source.sourceId, context)) {
    return Promise.reject(new Error('HRIS_HOME_SOURCE_NOT_AUTHORIZED'));
  }
  return source.load(context, signal);
}

export function resolveHcmHomeSourceContributionSafely(
  registry: HcmHomeModuleProviderRegistry,
  source: HcmHomeProviderSource,
  context: HcmHomeProviderContext,
  query: HcmHomeProviderQueryResolution
): HcmHomeSnapshotContribution | null {
  const centralFallback = (reasonCode: string): HcmHomeSnapshotContribution | null => {
    try {
      return registry.unavailableContribution(source.sourceId, context, reasonCode);
    } catch {
      return null;
    }
  };
  if (!canLoadHcmHomeSourceSafely(registry, source.sourceId, context)) {
    return centralFallback('SOURCE_QUERY_NOT_AUTHORIZED');
  }
  if (!query.hasData) return centralFallback(query.reasonCode);
  try {
    return source.resolve(query.data, context);
  } catch {
    return centralFallback(query.reasonCode);
  }
}

export function composeHcmHomeProvidersSafely(
  registry: HcmHomeModuleProviderRegistry,
  contributions: readonly HcmHomeSnapshotContribution[],
  context: HcmHomeProviderContext
): Readonly<{
  snapshots: readonly HcmHomeProviderSnapshot[];
  metadata: HcmHomeSnapshotContribution['metadata'];
}> {
  try {
    return registry.compose(contributions, context);
  } catch {
    const fallbacks = registry.sources
      .map((source) => {
        try {
          return registry.unavailableContribution(
            source.sourceId,
            context,
            'PROVIDER_COMPOSITION_FAILED'
          );
        } catch {
          return null;
        }
      })
      .filter((value): value is HcmHomeSnapshotContribution => value !== null);
    try {
      return registry.compose(fallbacks, context);
    } catch {
      return Object.freeze({
        snapshots: Object.freeze(fallbacks.flatMap((fallback) => fallback.snapshots)),
        metadata: null,
      });
    }
  }
}

const SETTINGS_ROLES = new Set(['ADMIN', 'HRIS_SETTINGS_ADMIN', 'SETTINGS_ADMIN']);
const AUDITOR_ROLES = new Set(['AUDITOR', 'ENTERPRISE_AUDITOR', 'COMPANY_AUDITOR']);

export function resolveHcmHomeProviderAudiences({
  roles,
  canAccessPersonal,
  isManager,
  canOperate,
  canManageSettings,
}: {
  roles: readonly string[];
  canAccessPersonal: boolean;
  isManager: boolean;
  canOperate: boolean;
  canManageSettings: boolean;
}): HcmHomeProviderAudience[] {
  const normalizedRoles = new Set(roles.map((role) => role.trim().toLocaleUpperCase('en-US')));
  const audiences = new Set<HcmHomeProviderAudience>();
  if (canAccessPersonal) audiences.add('EMPLOYEE');
  if (isManager) audiences.add('MANAGER');
  if (canOperate) audiences.add('OPERATOR');
  if (canManageSettings || [...SETTINGS_ROLES].some((role) => normalizedRoles.has(role))) {
    audiences.add('SETTINGS_ADMIN');
  }
  if ([...AUDITOR_ROLES].some((role) => normalizedRoles.has(role))) audiences.add('AUDITOR');
  return [...audiences];
}

export function hcmHomeProviderRoute(
  snapshots: readonly HcmHomeProviderSnapshot[],
  widgetId: HcmHomeProviderWidgetId
): string {
  const provider = snapshots.find((snapshot) => snapshot.widgetId === widgetId);
  return provider &&
    hcmHomeProviderIsAvailable(snapshots, widgetId) &&
    provider.primaryAction &&
    provider.deepLink
    ? provider.deepLink
    : '';
}

export function hcmHomeProviderIsAvailable(
  snapshots: readonly HcmHomeProviderSnapshot[],
  widgetId: HcmHomeProviderWidgetId
): boolean {
  const state = snapshots.find((snapshot) => snapshot.widgetId === widgetId)?.state;
  return state === 'AVAILABLE' || state === 'EMPTY' || state === 'STALE' || state === 'PARTIAL';
}

export function hcmHomeProviderPayload<TWidgetId extends HcmHomeProviderWidgetId>(
  snapshots: readonly HcmHomeProviderSnapshot[],
  widgetId: TWidgetId
): HcmHomeProviderPayloadMap[TWidgetId] | null {
  const provider = snapshots.find((snapshot) => snapshot.widgetId === widgetId);
  if (!provider || !hcmHomeProviderIsAvailable(snapshots, widgetId) || !provider.payload) {
    return null;
  }
  return provider.payload as HcmHomeProviderPayloadMap[TWidgetId];
}

export function hcmHomeProviderStateSummary(snapshots: readonly HcmHomeProviderSnapshot[]): string {
  return snapshots
    .filter((snapshot) => snapshot.state !== 'FORBIDDEN')
    .map(
      (snapshot) =>
        `${snapshot.widgetId}:${snapshot.state}:${snapshot.freshness.state}:${snapshot.sensitivity.projection}:${snapshot.dataAuthority}:v${snapshot.contractVersion}:${snapshot.purpose}:${snapshot.policyRevision}`
    )
    .sort()
    .join('|');
}

export function hcmHomeProviderHasDegradation(
  snapshots: readonly HcmHomeProviderSnapshot[]
): boolean {
  return snapshots.some(
    (snapshot) =>
      snapshot.state !== 'FORBIDDEN' &&
      (snapshot.freshness.state !== 'FRESH' ||
        ['STALE', 'PARTIAL', 'UNAVAILABLE', 'CONFIGURATION_REQUIRED'].includes(snapshot.state))
  );
}

export function hcmHomeProviderNeedsAttention(
  snapshots: readonly HcmHomeProviderSnapshot[],
  widgetId: HcmHomeProviderWidgetId
): boolean {
  const provider = snapshots.find((snapshot) => snapshot.widgetId === widgetId);
  return (
    !provider ||
    !hcmHomeProviderIsAvailable(snapshots, widgetId) ||
    provider.state === 'STALE' ||
    provider.state === 'PARTIAL' ||
    provider.freshness.state !== 'FRESH'
  );
}
