import { appResourceAliasCandidates } from '@dwp-frontend/shared-utils';

import {
  cloneHrisHomePayloadDescriptor,
  isValidHrisHomePayloadDescriptor,
  normalizeHrisHomePayload,
  payloadDescriptorMatchesFields,
} from './hris-home-payload-contract';
import {
  sameEntitlements,
  samePrimaryAction,
  sameSensitivity,
  sameStrings,
} from './hris-home-provider-comparison';
import { hasRequiredHrisHomeModuleContext } from './hris-home-provider-context';

import type { AppEntitlementPermission } from '@dwp-frontend/shared-utils';
import type { HrisHomePayloadObjectDescriptor } from './hris-home-payload-contract';

export type {
  HrisHomePayloadFieldDescriptor,
  HrisHomePayloadObjectDescriptor,
} from './hris-home-payload-contract';

export type HrisHomeSourceModule = 'SYS' | 'HRM' | 'TIM' | 'PAY' | 'PER';
export type HrisHomeAudience = 'EMPLOYEE' | 'MANAGER' | 'OPERATOR' | 'SETTINGS_ADMIN' | 'AUDITOR';
export type HrisHomeScopeKind = 'SELF' | 'TEAM' | 'ORG_UNIT' | 'LEGAL_ENTITY';
export type HrisHomePriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type HrisHomeHorizon = 'NOW' | 'NEXT' | 'CHANGED';
export type HrisHomeProviderState =
  | 'AVAILABLE'
  | 'EMPTY'
  | 'STALE'
  | 'PARTIAL'
  | 'UNAVAILABLE'
  | 'FORBIDDEN'
  | 'CONFIGURATION_REQUIRED';
export type HrisHomeFreshnessState = 'FRESH' | 'STALE' | 'UNKNOWN';
export type HrisHomeSensitivityClass = 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
export type HrisHomeProjection = 'VIEW' | 'MASK' | 'OMIT';
export type HrisHomeEntitlementMode = 'STRICT' | 'LEGACY_SURFACE_COMPATIBILITY';
export type HrisHomeEntitlementDecision = 'ALLOWED' | 'DENIED' | 'MISSING';
export type HrisHomeDataAuthority = 'MODULE_API' | 'LEGACY_AGGREGATE_COMPATIBILITY';
export type HrisHomePurpose = 'HRIS_HOME';

export type HrisHomeEntitlementRequirement = Readonly<{
  resourceType: string;
  resourceKey: string;
  permissionCodes: readonly string[];
  match: 'ANY' | 'ALL';
}>;

export type HrisHomeSensitivity = Readonly<{
  classification: HrisHomeSensitivityClass;
  projection: HrisHomeProjection;
  exposedFields: readonly string[];
}>;

export type HrisHomePrimaryAction = Readonly<{
  actionId: string;
  labelKey: string;
}>;

export type HrisHomeFreshness = Readonly<{
  generatedAt: string | null;
  maxAgeSeconds: number;
  state: HrisHomeFreshnessState;
}>;

export type HrisHomeProviderContext = Readonly<{
  audiences: readonly HrisHomeAudience[];
  scope: Readonly<{ kind: HrisHomeScopeKind; key: string }>;
  surfaceEntitled: boolean;
  entitlements: readonly AppEntitlementPermission[];
  legacyCompatibilityAuthorities: readonly string[];
  dataAuthorities: readonly HrisHomeDataAuthority[];
  tenantCacheKey: string | null;
  subjectCacheKey: string | null;
  authorityCacheKey: string;
  contextScopeKey: string | null;
  decisionRevision: string;
  accessMode: string;
  purpose: HrisHomePurpose;
  asOf: string;
  now: string;
  traceId: string | null;
}>;

export type HrisHomeWidgetSnapshot<TPayload = unknown> = Readonly<{
  contractVersion: 1;
  widgetId: string;
  sourceModule: HrisHomeSourceModule;
  dataAuthority: HrisHomeDataAuthority;
  audience: readonly HrisHomeAudience[];
  requiredEntitlements: readonly HrisHomeEntitlementRequirement[];
  scope: Readonly<{ kind: HrisHomeScopeKind; key: string }>;
  horizon: HrisHomeHorizon;
  priority: HrisHomePriority;
  freshness: HrisHomeFreshness;
  sensitivity: HrisHomeSensitivity;
  purpose: HrisHomePurpose;
  policyRevision: string;
  state: HrisHomeProviderState;
  reasonCode: string | null;
  payload: TPayload | null;
  primaryAction: HrisHomePrimaryAction | null;
  deepLink: string | null;
  traceId: string | null;
}>;

export type HrisHomeProviderResolution<TPayload> = Readonly<{
  state: Exclude<HrisHomeProviderState, 'FORBIDDEN' | 'STALE'>;
  reasonCode?: string | null;
  priority: HrisHomePriority;
  payload: TPayload | null;
}>;

export type HrisHomeWidgetContract = Readonly<{
  contractVersion: 1;
  widgetId: string;
  sourceModule: HrisHomeSourceModule;
  dataAuthority: HrisHomeDataAuthority;
  audience: readonly HrisHomeAudience[];
  requiredEntitlements: readonly HrisHomeEntitlementRequirement[];
  entitlementMode: HrisHomeEntitlementMode;
  legacyCompatibilityAuthority?: string;
  supportedScopes: readonly HrisHomeScopeKind[];
  horizon: HrisHomeHorizon;
  freshnessSeconds: number;
  sensitivity: HrisHomeSensitivity;
  payloadDescriptor: HrisHomePayloadObjectDescriptor;
  purpose: HrisHomePurpose;
  policyRevision: string;
  primaryAction: HrisHomePrimaryAction;
  deepLink: string;
}>;

export type HrisHomeWidgetProvider<TSource = unknown, TPayload = unknown> = HrisHomeWidgetContract &
  Readonly<{
    project: (source: TSource) => HrisHomeProviderResolution<TPayload>;
  }>;

export type HrisHomeProviderInput<TSource> = Readonly<{
  data: TSource | null;
  generatedAt: string | null;
  unavailableReason?: string | null;
}>;

export type HrisHomeCompositionMetadata = Readonly<{
  asOf: string | null;
  generatedAt: string | null;
  referenceDataPresent: boolean;
}>;

export type HrisHomeSnapshotContribution = Readonly<{
  sourceId: string;
  dataAuthority: HrisHomeDataAuthority;
  snapshots: readonly HrisHomeWidgetSnapshot[];
  metadata: HrisHomeCompositionMetadata | null;
}>;

export type HrisHomeProviderComposition = Readonly<{
  snapshots: readonly HrisHomeWidgetSnapshot[];
  metadata: HrisHomeCompositionMetadata | null;
}>;

export type HrisHomeProviderSource = Readonly<{
  sourceId: string;
  dataAuthority: HrisHomeDataAuthority;
  widgetIds: readonly string[];
  widgetContracts: readonly HrisHomeWidgetContract[];
  queryKey: (context: HrisHomeProviderContext) => readonly unknown[];
  load: (context: HrisHomeProviderContext, signal?: AbortSignal) => Promise<unknown>;
  resolve: (data: unknown, context: HrisHomeProviderContext) => HrisHomeSnapshotContribution;
  unavailable: (
    context: HrisHomeProviderContext,
    reasonCode: string
  ) => HrisHomeSnapshotContribution;
}>;

export type HrisHomeModuleProviderRegistry = Readonly<{
  schemaVersion: 1;
  sources: readonly HrisHomeProviderSource[];
  canLoadSource: (sourceId: string, context: HrisHomeProviderContext) => boolean;
  unavailableContribution: (
    sourceId: string,
    context: HrisHomeProviderContext,
    reasonCode: string
  ) => HrisHomeSnapshotContribution;
  compose: (
    contributions: readonly HrisHomeSnapshotContribution[],
    context: HrisHomeProviderContext
  ) => HrisHomeProviderComposition;
}>;

const normalized = (value: string) => value.trim().toLocaleUpperCase('en-US');

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const ISO_INSTANT_PATTERN =
  /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-](\d{2}):(\d{2}))$/u;

function isStrictDateKey(value: string): boolean {
  if (!DATE_KEY_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isStrictInstant(value: string): boolean {
  const match = ISO_INSTANT_PATTERN.exec(value);
  if (!match || !isStrictDateKey(match[1]!)) return false;
  const [, , hour, minute, second, offsetHour, offsetMinute] = match;
  return (
    Number(hour) <= 23 &&
    Number(minute) <= 59 &&
    Number(second) <= 59 &&
    (offsetHour === undefined || Number(offsetHour) <= 23) &&
    (offsetMinute === undefined || Number(offsetMinute) <= 59) &&
    Number.isFinite(Date.parse(value))
  );
}

function resourceKeyCandidates(requirement: HrisHomeEntitlementRequirement): Set<string> {
  if (normalized(requirement.resourceType) !== 'APP') {
    return new Set([normalized(requirement.resourceKey)]);
  }
  return new Set(appResourceAliasCandidates(requirement.resourceKey).map(normalized));
}

function requirementSatisfied(
  requirement: HrisHomeEntitlementRequirement,
  entitlements: readonly AppEntitlementPermission[]
): boolean | null {
  const resourceKeys = resourceKeyCandidates(requirement);
  const candidates = entitlements.filter(
    (permission) =>
      normalized(permission.resourceType) === normalized(requirement.resourceType) &&
      resourceKeys.has(normalized(permission.resourceKey)) &&
      requirement.permissionCodes.some(
        (code) => normalized(permission.permissionCode) === normalized(code)
      )
  );
  if (candidates.length === 0) return null;
  if (candidates.some((permission) => normalized(permission.effect) === 'DENY')) return false;
  const allowed = new Set(
    candidates
      .filter((permission) => normalized(permission.effect) === 'ALLOW')
      .map((permission) => normalized(permission.permissionCode))
  );
  return requirement.match === 'ALL'
    ? requirement.permissionCodes.every((code) => allowed.has(normalized(code)))
    : requirement.permissionCodes.some((code) => allowed.has(normalized(code)));
}

export function evaluateHrisHomeProviderEntitlement(
  provider: HrisHomeWidgetContract,
  context: HrisHomeProviderContext
): HrisHomeEntitlementDecision {
  // Defense-in-depth display gating only. The API remains responsible for
  // authorizing and projecting data before it reaches this registry.
  if (!context.surfaceEntitled) return 'DENIED';
  const decisions = provider.requiredEntitlements.map((requirement) =>
    requirementSatisfied(requirement, context.entitlements)
  );
  if (decisions.some((decision) => decision === false)) return 'DENIED';
  if (decisions.every((decision) => decision === true)) return 'ALLOWED';
  const compatibilityAuthorized =
    provider.entitlementMode === 'LEGACY_SURFACE_COMPATIBILITY' &&
    Boolean(provider.legacyCompatibilityAuthority) &&
    context.legacyCompatibilityAuthorities.some(
      (authority) =>
        normalized(authority) === normalized(provider.legacyCompatibilityAuthority ?? '')
    );
  return compatibilityAuthorized ? 'ALLOWED' : 'MISSING';
}

export function hasHrisHomeProviderEntitlement(
  provider: HrisHomeWidgetContract,
  context: HrisHomeProviderContext
): boolean {
  return evaluateHrisHomeProviderEntitlement(provider, context) === 'ALLOWED';
}

export function resolveHrisHomeFreshness(
  generatedAt: string | null,
  maxAgeSeconds: number,
  now: string
): HrisHomeFreshness {
  const generatedAtMs = generatedAt && isStrictInstant(generatedAt) ? Date.parse(generatedAt) : NaN;
  const nowMs = isStrictInstant(now) ? Date.parse(now) : NaN;
  const valid = Number.isFinite(generatedAtMs) && Number.isFinite(nowMs);
  const futureDated = valid && generatedAtMs > nowMs;
  return {
    generatedAt,
    maxAgeSeconds,
    state:
      !valid || futureDated
        ? 'UNKNOWN'
        : nowMs - generatedAtMs > maxAgeSeconds * 1000
          ? 'STALE'
          : 'FRESH',
  };
}

type HrisHomeProviderAccess = Readonly<{
  state: 'ALLOWED' | 'FORBIDDEN' | 'CONFIGURATION_REQUIRED';
  reasonCode: string | null;
}>;

function resolveHrisHomeProviderAccess(
  provider: HrisHomeWidgetContract,
  context: HrisHomeProviderContext
): HrisHomeProviderAccess {
  const authorizedAudience = provider.audience.some((audience) =>
    context.audiences.includes(audience)
  );
  const authorizedScope = provider.supportedScopes.includes(context.scope.kind);
  const entitlementDecision = evaluateHrisHomeProviderEntitlement(provider, context);
  const authorizedDataAuthority = context.dataAuthorities.includes(provider.dataAuthority);
  const authorizedPurpose = provider.purpose === context.purpose;
  const configuredPolicyRevision = provider.policyRevision.trim().length > 0;
  const validTemporalContext = isStrictDateKey(context.asOf) && isStrictInstant(context.now);

  if (!authorizedAudience) return { state: 'FORBIDDEN', reasonCode: 'AUDIENCE_DENIED' };
  if (!authorizedScope) return { state: 'FORBIDDEN', reasonCode: 'SCOPE_DENIED' };
  if (entitlementDecision === 'DENIED') {
    return { state: 'FORBIDDEN', reasonCode: 'ENTITLEMENT_DENIED' };
  }
  if (!validTemporalContext) {
    return { state: 'CONFIGURATION_REQUIRED', reasonCode: 'CONTEXT_TEMPORAL_INVALID' };
  }
  if (!authorizedPurpose) {
    return { state: 'CONFIGURATION_REQUIRED', reasonCode: 'PURPOSE_CONFIGURATION_REQUIRED' };
  }
  if (!configuredPolicyRevision) {
    return {
      state: 'CONFIGURATION_REQUIRED',
      reasonCode: 'POLICY_REVISION_CONFIGURATION_REQUIRED',
    };
  }
  if (entitlementDecision === 'MISSING') {
    return {
      state: 'CONFIGURATION_REQUIRED',
      reasonCode: 'ENTITLEMENT_CONFIGURATION_REQUIRED',
    };
  }
  if (!authorizedDataAuthority) {
    return {
      state: 'CONFIGURATION_REQUIRED',
      reasonCode: 'SOURCE_AUTHORITY_CONFIGURATION_REQUIRED',
    };
  }
  return { state: 'ALLOWED', reasonCode: null };
}

export function resolveHrisHomeWidgetProvider<TSource, TPayload>(
  provider: HrisHomeWidgetProvider<TSource, TPayload>,
  input: HrisHomeProviderInput<TSource>,
  context: HrisHomeProviderContext
): HrisHomeWidgetSnapshot<TPayload> {
  const freshness = resolveHrisHomeFreshness(
    input.generatedAt,
    provider.freshnessSeconds,
    context.now
  );
  const access = resolveHrisHomeProviderAccess(provider, context);
  if (access.state !== 'ALLOWED') {
    return {
      contractVersion: provider.contractVersion,
      widgetId: provider.widgetId,
      sourceModule: provider.sourceModule,
      dataAuthority: provider.dataAuthority,
      audience: provider.audience,
      requiredEntitlements: provider.requiredEntitlements,
      scope: context.scope,
      horizon: provider.horizon,
      priority: 'LOW',
      freshness,
      sensitivity: provider.sensitivity,
      purpose: provider.purpose,
      policyRevision: provider.policyRevision,
      state: access.state,
      reasonCode: access.reasonCode,
      payload: null,
      primaryAction: null,
      deepLink: null,
      traceId: context.traceId,
    };
  }

  if (input.data === null) {
    return {
      contractVersion: provider.contractVersion,
      widgetId: provider.widgetId,
      sourceModule: provider.sourceModule,
      dataAuthority: provider.dataAuthority,
      audience: provider.audience,
      requiredEntitlements: provider.requiredEntitlements,
      scope: context.scope,
      horizon: provider.horizon,
      priority: 'LOW',
      freshness,
      sensitivity: provider.sensitivity,
      purpose: provider.purpose,
      policyRevision: provider.policyRevision,
      state: 'UNAVAILABLE',
      reasonCode: input.unavailableReason || 'SOURCE_UNAVAILABLE',
      payload: null,
      primaryAction: null,
      deepLink: null,
      traceId: context.traceId,
    };
  }

  const resolution = provider.project(input.data);
  const stale =
    freshness.state === 'STALE' && resolution.state === 'AVAILABLE'
      ? ('STALE' as const)
      : resolution.state;
  const actionable = ['AVAILABLE', 'EMPTY', 'STALE', 'PARTIAL'].includes(stale);
  return {
    contractVersion: provider.contractVersion,
    widgetId: provider.widgetId,
    sourceModule: provider.sourceModule,
    dataAuthority: provider.dataAuthority,
    audience: provider.audience,
    requiredEntitlements: provider.requiredEntitlements,
    scope: context.scope,
    horizon: provider.horizon,
    priority: resolution.priority,
    freshness,
    sensitivity: provider.sensitivity,
    purpose: provider.purpose,
    policyRevision: provider.policyRevision,
    state: stale,
    reasonCode: resolution.reasonCode ?? null,
    payload: actionable ? resolution.payload : null,
    primaryAction: actionable ? provider.primaryAction : null,
    deepLink: actionable ? provider.deepLink : null,
    traceId: context.traceId,
  };
}

function providerConflictSnapshot(
  left: HrisHomeWidgetSnapshot,
  right: HrisHomeWidgetSnapshot
): HrisHomeWidgetSnapshot {
  const sourceModule = left.sourceModule === right.sourceModule ? left.sourceModule : 'SYS';
  return {
    ...left,
    sourceModule,
    priority: 'LOW',
    freshness: {
      generatedAt: null,
      maxAgeSeconds: Math.min(left.freshness.maxAgeSeconds, right.freshness.maxAgeSeconds),
      state: 'UNKNOWN',
    },
    state: 'CONFIGURATION_REQUIRED',
    reasonCode: 'PROVIDER_CONTRIBUTION_CONFLICT',
    payload: null,
    primaryAction: null,
    deepLink: null,
  };
}

function validatedSafetySnapshot(candidate: HrisHomeWidgetSnapshot): HrisHomeWidgetSnapshot {
  if (
    candidate.contractVersion === 1 &&
    candidate.purpose === 'HRIS_HOME' &&
    typeof candidate.policyRevision === 'string' &&
    candidate.policyRevision.trim().length > 0
  ) {
    return candidate;
  }
  return {
    ...candidate,
    priority: 'LOW',
    state: 'CONFIGURATION_REQUIRED',
    reasonCode: 'PROVIDER_SAFETY_METADATA_REQUIRED',
    payload: null,
    primaryAction: null,
    deepLink: null,
  };
}

export function composeHrisHomeProviderContributions(
  contributions: readonly HrisHomeSnapshotContribution[]
): HrisHomeProviderComposition {
  const snapshots = new Map<string, HrisHomeWidgetSnapshot>();
  for (const contribution of contributions) {
    for (const unresolvedCandidate of contribution.snapshots) {
      const candidate = validatedSafetySnapshot(unresolvedCandidate);
      const current = snapshots.get(candidate.widgetId);
      if (!current) {
        snapshots.set(candidate.widgetId, candidate);
        continue;
      }
      if (
        current.dataAuthority === 'LEGACY_AGGREGATE_COMPATIBILITY' &&
        candidate.dataAuthority === 'MODULE_API'
      ) {
        snapshots.set(candidate.widgetId, candidate);
        continue;
      }
      if (
        current.dataAuthority === 'MODULE_API' &&
        candidate.dataAuthority === 'LEGACY_AGGREGATE_COMPATIBILITY'
      ) {
        continue;
      }
      snapshots.set(candidate.widgetId, providerConflictSnapshot(current, candidate));
    }
  }

  const metadataCandidates = contributions
    .map((contribution) => contribution.metadata)
    .filter((metadata): metadata is HrisHomeCompositionMetadata => metadata !== null);
  const completeMetadata =
    contributions.length > 0 && metadataCandidates.length === contributions.length;
  const asOfCandidates = metadataCandidates
    .map((candidate) => candidate.asOf)
    .filter((value): value is string => typeof value === 'string' && isStrictDateKey(value));
  const generatedAtCandidates = metadataCandidates
    .map((candidate) => candidate.generatedAt)
    .filter((value): value is string => typeof value === 'string' && isStrictInstant(value));
  const uniqueAsOf = new Set(asOfCandidates);
  const metadata = completeMetadata
    ? {
        asOf:
          asOfCandidates.length === metadataCandidates.length && uniqueAsOf.size === 1
            ? asOfCandidates[0]!
            : null,
        // The home-level timestamp represents the oldest participating source,
        // not the newest one. A newer module must never mask a stale peer.
        generatedAt:
          generatedAtCandidates.length === metadataCandidates.length
            ? ([...generatedAtCandidates].sort(
                (left, right) => Date.parse(left) - Date.parse(right)
              )[0] ?? null)
            : null,
        referenceDataPresent: metadataCandidates.some(
          (candidate) => candidate.referenceDataPresent
        ),
      }
    : null;

  return Object.freeze({
    snapshots: Object.freeze([...snapshots.values()]),
    metadata: metadata ? Object.freeze(metadata) : null,
  });
}

function expectedSourceModule(widgetId: string): HrisHomeSourceModule | null {
  const prefix = widgetId.split('-', 1)[0]?.toLocaleUpperCase('en-US');
  return prefix === 'SYS' ||
    prefix === 'HRM' ||
    prefix === 'TIM' ||
    prefix === 'PAY' ||
    prefix === 'PER'
    ? prefix
    : null;
}

const providerStates = new Set<HrisHomeProviderState>([
  'AVAILABLE',
  'EMPTY',
  'STALE',
  'PARTIAL',
  'UNAVAILABLE',
  'FORBIDDEN',
  'CONFIGURATION_REQUIRED',
]);
const providerPriorities = new Set<HrisHomePriority>(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);

function cloneWidgetContract(contract: HrisHomeWidgetContract): HrisHomeWidgetContract {
  return Object.freeze({
    contractVersion: contract.contractVersion,
    widgetId: contract.widgetId,
    sourceModule: contract.sourceModule,
    dataAuthority: contract.dataAuthority,
    audience: Object.freeze([...contract.audience]),
    requiredEntitlements: Object.freeze(
      contract.requiredEntitlements.map((requirement) =>
        Object.freeze({
          ...requirement,
          permissionCodes: Object.freeze([...requirement.permissionCodes]),
        })
      )
    ),
    entitlementMode: contract.entitlementMode,
    legacyCompatibilityAuthority: contract.legacyCompatibilityAuthority,
    supportedScopes: Object.freeze([...contract.supportedScopes]),
    horizon: contract.horizon,
    freshnessSeconds: contract.freshnessSeconds,
    sensitivity: Object.freeze({
      ...contract.sensitivity,
      exposedFields: Object.freeze([...contract.sensitivity.exposedFields]),
    }),
    payloadDescriptor: cloneHrisHomePayloadDescriptor(
      contract.payloadDescriptor
    ) as HrisHomePayloadObjectDescriptor,
    purpose: contract.purpose,
    policyRevision: contract.policyRevision,
    primaryAction: Object.freeze({ ...contract.primaryAction }),
    deepLink: contract.deepLink,
  });
}

function validRegisteredContract(
  contract: HrisHomeWidgetContract,
  source: HrisHomeProviderSource
): boolean {
  return (
    contract.contractVersion === 1 &&
    contract.widgetId.trim().length > 0 &&
    expectedSourceModule(contract.widgetId) === contract.sourceModule &&
    contract.dataAuthority === source.dataAuthority &&
    contract.audience.length > 0 &&
    contract.requiredEntitlements.length > 0 &&
    contract.requiredEntitlements.every(
      (item) =>
        item.resourceType.trim().length > 0 &&
        item.resourceKey.trim().length > 0 &&
        item.permissionCodes.length > 0
    ) &&
    contract.supportedScopes.length > 0 &&
    Number.isFinite(contract.freshnessSeconds) &&
    contract.freshnessSeconds > 0 &&
    contract.sensitivity.exposedFields.length > 0 &&
    contract.payloadDescriptor.type === 'OBJECT' &&
    contract.payloadDescriptor.nullable === false &&
    isValidHrisHomePayloadDescriptor(contract.payloadDescriptor) &&
    payloadDescriptorMatchesFields(
      contract.payloadDescriptor,
      contract.sensitivity.exposedFields
    ) &&
    contract.purpose === 'HRIS_HOME' &&
    contract.policyRevision.trim().length > 0 &&
    contract.primaryAction.actionId.trim().length > 0 &&
    contract.primaryAction.labelKey.trim().length > 0 &&
    contract.deepLink.startsWith('/hr/') &&
    (contract.entitlementMode !== 'LEGACY_SURFACE_COMPATIBILITY' ||
      Boolean(contract.legacyCompatibilityAuthority?.trim()))
  );
}

function centralFallbackSnapshot(
  contract: HrisHomeWidgetContract,
  context: HrisHomeProviderContext,
  state: Extract<HrisHomeProviderState, 'UNAVAILABLE' | 'FORBIDDEN' | 'CONFIGURATION_REQUIRED'>,
  reasonCode: string
): HrisHomeWidgetSnapshot {
  return Object.freeze({
    contractVersion: contract.contractVersion,
    widgetId: contract.widgetId,
    sourceModule: contract.sourceModule,
    dataAuthority: contract.dataAuthority,
    audience: contract.audience,
    requiredEntitlements: contract.requiredEntitlements,
    scope: Object.freeze({ ...context.scope }),
    horizon: contract.horizon,
    priority: 'LOW',
    freshness: Object.freeze({
      generatedAt: null,
      maxAgeSeconds: contract.freshnessSeconds,
      state: 'UNKNOWN',
    }),
    sensitivity: contract.sensitivity,
    purpose: contract.purpose,
    policyRevision: contract.policyRevision,
    state,
    reasonCode,
    payload: null,
    primaryAction: null,
    deepLink: null,
    traceId: context.traceId,
  });
}

function centralFallbackContribution(
  source: HrisHomeProviderSource,
  context: HrisHomeProviderContext,
  reasonCode: string,
  state: Extract<
    HrisHomeProviderState,
    'UNAVAILABLE' | 'FORBIDDEN' | 'CONFIGURATION_REQUIRED'
  > = 'UNAVAILABLE'
): HrisHomeSnapshotContribution {
  return Object.freeze({
    sourceId: source.sourceId,
    dataAuthority: source.dataAuthority,
    snapshots: Object.freeze(
      source.widgetContracts.map((contract) => {
        const access = resolveHrisHomeProviderAccess(contract, context);
        return access.state === 'ALLOWED'
          ? centralFallbackSnapshot(contract, context, state, reasonCode)
          : centralFallbackSnapshot(contract, context, access.state, access.reasonCode!);
      })
    ),
    metadata: null,
  });
}

function normalizedMetadata(
  metadata: HrisHomeCompositionMetadata | null,
  context: HrisHomeProviderContext
): HrisHomeCompositionMetadata | null | undefined {
  if (metadata === null) return null;
  if (!metadata || typeof metadata !== 'object') return undefined;
  if (
    (metadata.asOf !== null &&
      (!isStrictDateKey(metadata.asOf) || metadata.asOf !== context.asOf)) ||
    (metadata.generatedAt !== null &&
      (!isStrictInstant(metadata.generatedAt) ||
        !isStrictInstant(context.now) ||
        Date.parse(metadata.generatedAt) > Date.parse(context.now))) ||
    typeof metadata.referenceDataPresent !== 'boolean'
  ) {
    return undefined;
  }
  return Object.freeze({ ...metadata });
}

function snapshotMatchesContract(
  snapshot: HrisHomeWidgetSnapshot,
  contract: HrisHomeWidgetContract,
  context: HrisHomeProviderContext
): boolean {
  const actionable = ['AVAILABLE', 'EMPTY', 'STALE', 'PARTIAL'].includes(snapshot.state);
  const expectedAction = actionable ? contract.primaryAction : null;
  const expectedDeepLink = actionable ? contract.deepLink : null;
  return (
    snapshot.contractVersion === contract.contractVersion &&
    snapshot.widgetId === contract.widgetId &&
    snapshot.sourceModule === contract.sourceModule &&
    snapshot.dataAuthority === contract.dataAuthority &&
    Array.isArray(snapshot.audience) &&
    sameStrings(snapshot.audience, contract.audience) &&
    Array.isArray(snapshot.requiredEntitlements) &&
    sameEntitlements(snapshot.requiredEntitlements, contract.requiredEntitlements) &&
    snapshot.scope?.kind === context.scope.kind &&
    snapshot.scope?.key === context.scope.key &&
    snapshot.horizon === contract.horizon &&
    snapshot.sensitivity !== null &&
    typeof snapshot.sensitivity === 'object' &&
    sameSensitivity(snapshot.sensitivity, contract.sensitivity) &&
    snapshot.purpose === contract.purpose &&
    snapshot.policyRevision === contract.policyRevision &&
    samePrimaryAction(snapshot.primaryAction, expectedAction) &&
    snapshot.deepLink === expectedDeepLink &&
    snapshot.traceId === context.traceId
  );
}

function normalizeSnapshot(
  candidate: HrisHomeWidgetSnapshot,
  contract: HrisHomeWidgetContract,
  context: HrisHomeProviderContext
): HrisHomeWidgetSnapshot {
  const access = resolveHrisHomeProviderAccess(contract, context);
  if (access.state !== 'ALLOWED') {
    return centralFallbackSnapshot(contract, context, access.state, access.reasonCode!);
  }

  if (!candidate || typeof candidate !== 'object' || !providerStates.has(candidate.state)) {
    return centralFallbackSnapshot(
      contract,
      context,
      'CONFIGURATION_REQUIRED',
      'SOURCE_WIDGET_CONTRACT_MISMATCH'
    );
  }
  const mismatchReason =
    candidate.contractVersion !== 1 ||
    candidate.purpose !== 'HRIS_HOME' ||
    typeof candidate.policyRevision !== 'string' ||
    candidate.policyRevision.trim().length === 0
      ? 'PROVIDER_SAFETY_METADATA_REQUIRED'
      : 'SOURCE_WIDGET_CONTRACT_MISMATCH';
  const generatedAt = candidate.freshness?.generatedAt;
  const strictGeneratedAt =
    generatedAt === null || (typeof generatedAt === 'string' && isStrictInstant(generatedAt));
  const resolvedFreshness = resolveHrisHomeFreshness(
    strictGeneratedAt ? generatedAt : null,
    contract.freshnessSeconds,
    context.now
  );
  const validFreshness =
    strictGeneratedAt &&
    candidate.freshness?.maxAgeSeconds === contract.freshnessSeconds &&
    candidate.freshness?.state === resolvedFreshness.state;
  const validPriority = providerPriorities.has(candidate.priority);
  const validReasonCode = candidate.reasonCode === null || typeof candidate.reasonCode === 'string';
  const centralMayAcceptState = candidate.state !== 'FORBIDDEN';
  const actionable = ['AVAILABLE', 'EMPTY', 'STALE', 'PARTIAL'].includes(candidate.state);
  const validStateFreshness =
    (candidate.state !== 'STALE' || resolvedFreshness.state === 'STALE') &&
    (candidate.state !== 'AVAILABLE' || resolvedFreshness.state !== 'STALE');
  let normalizedPayload: unknown = null;
  let validPayload = !actionable && candidate.payload === null;
  if (actionable && candidate.payload !== null) {
    try {
      normalizedPayload = normalizeHrisHomePayload(
        candidate.payload,
        contract.payloadDescriptor,
        contract.widgetId
      );
      validPayload = true;
    } catch {
      validPayload = false;
    }
  }

  if (
    !snapshotMatchesContract(candidate, contract, context) ||
    !validFreshness ||
    !validPriority ||
    !validReasonCode ||
    !centralMayAcceptState ||
    !validStateFreshness
  ) {
    return centralFallbackSnapshot(contract, context, 'CONFIGURATION_REQUIRED', mismatchReason);
  }
  if (!validPayload) {
    return centralFallbackSnapshot(
      contract,
      context,
      'CONFIGURATION_REQUIRED',
      'SOURCE_WIDGET_PAYLOAD_INVALID'
    );
  }

  return Object.freeze({
    ...candidate,
    audience: contract.audience,
    requiredEntitlements: contract.requiredEntitlements,
    scope: Object.freeze({ ...context.scope }),
    freshness: Object.freeze(resolvedFreshness),
    sensitivity: contract.sensitivity,
    primaryAction: actionable ? contract.primaryAction : null,
    deepLink: actionable ? contract.deepLink : null,
    payload: actionable ? normalizedPayload : null,
    traceId: context.traceId,
  });
}

function normalizeSourceContribution(
  source: HrisHomeProviderSource,
  contribution: HrisHomeSnapshotContribution,
  context: HrisHomeProviderContext
): HrisHomeSnapshotContribution {
  if (
    !contribution ||
    typeof contribution !== 'object' ||
    contribution.sourceId !== source.sourceId ||
    contribution.dataAuthority !== source.dataAuthority ||
    !Array.isArray(contribution.snapshots)
  ) {
    return centralFallbackContribution(source, context, 'SOURCE_CONTRIBUTION_PROVENANCE_INVALID');
  }
  const metadata = normalizedMetadata(contribution.metadata, context);
  if (metadata === undefined) {
    return centralFallbackContribution(source, context, 'SOURCE_CONTRIBUTION_TEMPORAL_INVALID');
  }
  const candidates = new Map<string, HrisHomeWidgetSnapshot>();
  for (const candidate of contribution.snapshots) {
    if (!candidate || typeof candidate !== 'object' || candidates.has(candidate.widgetId)) {
      return centralFallbackContribution(source, context, 'SOURCE_CONTRIBUTION_PROVENANCE_INVALID');
    }
    candidates.set(candidate.widgetId, candidate);
  }
  if (
    candidates.size !== source.widgetContracts.length ||
    source.widgetContracts.some((contract) => !candidates.has(contract.widgetId))
  ) {
    return centralFallbackContribution(source, context, 'SOURCE_CONTRIBUTION_PROVENANCE_INVALID');
  }
  if (
    metadata !== null &&
    metadata.generatedAt !== null &&
    source.widgetContracts.some(
      (contract) =>
        candidates.get(contract.widgetId)?.freshness?.generatedAt !== metadata.generatedAt
    )
  ) {
    return centralFallbackContribution(source, context, 'SOURCE_CONTRIBUTION_METADATA_MISMATCH');
  }
  return Object.freeze({
    sourceId: source.sourceId,
    dataAuthority: source.dataAuthority,
    snapshots: Object.freeze(
      source.widgetContracts.map((contract) =>
        normalizeSnapshot(candidates.get(contract.widgetId)!, contract, context)
      )
    ),
    metadata,
  });
}

/** Enforces the single trusted composition boundary for every registered HRIS home source. */
export function createHrisHomeModuleProviderRegistry(
  registeredSources: readonly HrisHomeProviderSource[]
): HrisHomeModuleProviderRegistry {
  const sources = Object.freeze(
    registeredSources.map((source) => {
      if (!Array.isArray(source.widgetContracts) || source.widgetContracts.length === 0) {
        throw new Error(`Invalid HRIS home source widget contract: ${source.sourceId}`);
      }
      let originalContractsValid = false;
      try {
        originalContractsValid = source.widgetContracts.every((contract) =>
          validRegisteredContract(contract, source)
        );
      } catch {
        originalContractsValid = false;
      }
      if (!originalContractsValid) {
        throw new Error(`Invalid HRIS home source widget contract: ${source.sourceId}`);
      }
      const widgetContracts = Object.freeze(source.widgetContracts.map(cloneWidgetContract));
      const widgetIds = Object.freeze(widgetContracts.map((contract) => contract.widgetId));
      const declaredWidgetIds = new Set(source.widgetIds);
      if (
        declaredWidgetIds.size !== widgetIds.length ||
        widgetIds.some((widgetId) => !declaredWidgetIds.has(widgetId)) ||
        new Set(widgetIds).size !== widgetIds.length ||
        widgetContracts.some((contract) => !validRegisteredContract(contract, source))
      ) {
        throw new Error(`Invalid HRIS home source widget contract: ${source.sourceId}`);
      }
      return Object.freeze({ ...source, widgetIds, widgetContracts });
    })
  );
  const sourceIds = new Set<string>();
  const sourceById = new Map<string, HrisHomeProviderSource>();
  for (const source of sources) {
    if (!source.sourceId.trim() || sourceIds.has(source.sourceId)) {
      throw new Error(`Invalid or duplicate HRIS home source: ${source.sourceId}`);
    }
    sourceIds.add(source.sourceId);
    sourceById.set(source.sourceId, source);
  }

  return Object.freeze({
    schemaVersion: 1 as const,
    sources,
    canLoadSource: (sourceId, context) => {
      const source = sourceById.get(sourceId);
      return Boolean(
        hasRequiredHrisHomeModuleContext(source, context) &&
        source.widgetContracts.some(
          (contract) => resolveHrisHomeProviderAccess(contract, context).state === 'ALLOWED'
        )
      );
    },
    unavailableContribution: (sourceId, context, reasonCode) => {
      const source = sourceById.get(sourceId);
      if (!source) throw new Error(`Unknown HRIS home source: ${sourceId}`);
      return centralFallbackContribution(
        source,
        context,
        reasonCode.trim() || 'SOURCE_UNAVAILABLE'
      );
    },
    compose: (contributions, context) => {
      const validated: HrisHomeSnapshotContribution[] = [];
      for (const source of sources) {
        const matches: HrisHomeSnapshotContribution[] = [];
        for (const contribution of contributions) {
          try {
            if (contribution?.sourceId === source.sourceId) matches.push(contribution);
          } catch {
            // A hostile contribution is not allowed to fail another source.
          }
        }
        if (matches.length === 1) {
          try {
            validated.push(normalizeSourceContribution(source, matches[0]!, context));
          } catch {
            validated.push(
              centralFallbackContribution(source, context, 'SOURCE_CONTRIBUTION_INVALID')
            );
          }
          continue;
        }

        const reasonCode =
          matches.length === 0
            ? 'SOURCE_CONTRIBUTION_MISSING'
            : matches.length > 1
              ? 'SOURCE_CONTRIBUTION_DUPLICATE'
              : 'SOURCE_CONTRIBUTION_PROVENANCE_INVALID';
        validated.push(centralFallbackContribution(source, context, reasonCode));
      }
      return composeHrisHomeProviderContributions(validated);
    },
  });
}
