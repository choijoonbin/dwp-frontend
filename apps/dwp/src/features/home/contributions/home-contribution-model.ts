import { appResourceAliasCandidates } from '@dwp-frontend/shared-utils';

import type { AppEntitlementPermission } from '@dwp-frontend/shared-utils';
import type {
  BuildHomeContributionModelOptions,
  HomeAuthorityRequirement,
  HomeContributionAuthority,
  HomeContributionBucketKey,
  HomeContributionBucketState,
  HomeContributionInput,
  HomeContributionKind,
  HomeContributionModel,
  HomeContributionPriority,
  HomeContributionProvider,
  HomeContributionProviderContext,
  HomeContributionProviderResult,
  HomeContributionProviderSnapshot,
  HomeContributionProviderState,
  HomeContributionProviderViewState,
  HomeContributionScope,
  HomePrivacyClassification,
  HomeRedactionMode,
  NormalizedHomeContribution,
} from './home-contribution-types';

const BUCKET_BY_KIND: Readonly<Record<HomeContributionKind, HomeContributionBucketKey>> = {
  ACTION: 'action',
  TIMELINE: 'timeline',
  RESPONSE: 'response',
  REQUEST: 'request',
  PULSE: 'pulse',
};

// A direct response is a more precise obligation than a generic action. A
// tracked request is next; timeline and pulse remain contextual, not duplicate
// calls to act.
const PURPOSE_ORDER: Readonly<Record<HomeContributionKind, number>> = {
  RESPONSE: 0,
  ACTION: 1,
  REQUEST: 2,
  TIMELINE: 3,
  PULSE: 4,
};

const PRIORITY_ORDER: Readonly<Record<HomeContributionPriority, number>> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  NONE: 4,
};

const SCOPE_ORDER: Readonly<Record<HomeContributionScope, number>> = {
  ME: 0,
  TEAM: 1,
  OPERATIONS: 2,
};

const CLASSIFICATION_ORDER: Readonly<Record<HomePrivacyClassification, number>> = {
  PUBLIC: 0,
  INTERNAL: 1,
  CONFIDENTIAL: 2,
  RESTRICTED: 3,
};

const REDACTION_ORDER: Readonly<Record<HomeRedactionMode, number>> = {
  NONE: 0,
  TITLE_ONLY: 1,
  COUNT_ONLY: 2,
  HIDDEN: 3,
};

const DEFAULT_REDACTION: Readonly<Record<HomePrivacyClassification, HomeRedactionMode>> = {
  PUBLIC: 'NONE',
  INTERNAL: 'NONE',
  CONFIDENTIAL: 'TITLE_ONLY',
  RESTRICTED: 'COUNT_ONLY',
};

const CONTRIBUTING_STATES = new Set<HomeContributionProviderState>([
  'AVAILABLE',
  'PARTIAL',
  'STALE',
]);

const DEGRADED_BUCKET_STATES = new Set<HomeContributionProviderState>([
  'PARTIAL',
  'STALE',
  'UNAVAILABLE',
  'CONFIGURATION_REQUIRED',
]);

type Freshness = Readonly<{
  state: 'FRESH' | 'STALE';
  expiresAt: string | null;
}>;

type PreparedContribution = Readonly<{
  providerKey: string;
  owner: HomeContributionProviderResult['owner'];
  input: HomeContributionInput;
  freshness: Freshness;
  redaction: HomeRedactionMode;
}>;

function token(value: string): string {
  return value.trim().toUpperCase();
}

function normalizedPermissionCandidates(requirement: HomeAuthorityRequirement): Set<string> {
  const resourceKey = token(requirement.resourceKey);
  return new Set(
    token(requirement.resourceType) === 'APP'
      ? appResourceAliasCandidates(resourceKey)
      : [resourceKey]
  );
}

function passesRequirement(
  requirement: HomeAuthorityRequirement,
  permissions: readonly AppEntitlementPermission[]
): boolean {
  const permissionCodes = [...new Set(requirement.permissionCodes.map(token).filter(Boolean))];
  if (permissionCodes.length === 0) return false;

  const resourceType = token(requirement.resourceType);
  const resourceKeys = normalizedPermissionCandidates(requirement);
  const candidates = permissions.filter(
    (permission) =>
      token(permission.resourceType) === resourceType &&
      resourceKeys.has(token(permission.resourceKey)) &&
      permissionCodes.includes(token(permission.permissionCode))
  );

  if (candidates.some((permission) => token(permission.effect) === 'DENY')) return false;

  const allowedCodes = new Set(
    candidates
      .filter((permission) => token(permission.effect) === 'ALLOW')
      .map((permission) => token(permission.permissionCode))
  );
  return (requirement.match ?? 'ANY') === 'ALL'
    ? permissionCodes.every((permissionCode) => allowedCodes.has(permissionCode))
    : permissionCodes.some((permissionCode) => allowedCodes.has(permissionCode));
}

/** Fail-closed evaluation for a declared provider or item authority contract. */
export function hasHomeContributionAuthority(
  authority: HomeContributionAuthority | undefined,
  permissions: readonly AppEntitlementPermission[]
): boolean {
  if (!authority) return true;
  const allOf = authority.allOf ?? [];
  if (allOf.length === 0 && (authority.anyOf?.length ?? 0) === 0) return false;
  const anyOfPasses =
    authority.anyOf === undefined ||
    (authority.anyOf.length > 0 &&
      authority.anyOf.some((requirement) => passesRequirement(requirement, permissions)));
  return allOf.every((requirement) => passesRequirement(requirement, permissions)) && anyOfPasses;
}

/** Preserves a provider's concrete data type while keeping registration terse. */
export function createHomeContributionProvider<TData>(
  provider: HomeContributionProvider<TData>
): HomeContributionProvider<TData> {
  return provider;
}

function uniqueSorted(values: readonly string[] | undefined): string[] {
  return [...new Set((values ?? []).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right)
  );
}

function validFreshnessMs(value: number): number {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

/**
 * Resolves already-fetched query data through a provider adapter. Terminal
 * states never invoke the adapter; adapter failures become UNAVAILABLE without
 * leaking an exception message into presentation state.
 */
export function resolveHomeContributionProvider<TData>(
  provider: HomeContributionProvider<TData>,
  snapshot: HomeContributionProviderSnapshot<TData>,
  context: HomeContributionProviderContext
): HomeContributionProviderResult {
  const freshnessMs = validFreshnessMs(snapshot.freshnessMs ?? provider.freshnessMs);
  const base = {
    providerKey: provider.key,
    owner: provider.owner,
    authority: provider.authority,
    supportedKinds: [...new Set(provider.supportedKinds)].sort(),
    generatedAt: snapshot.generatedAt,
    freshnessMs,
    unavailableSources: uniqueSorted(snapshot.unavailableSources),
  } as const;

  if (!CONTRIBUTING_STATES.has(snapshot.state)) {
    return {
      ...base,
      state: snapshot.state,
      reason: snapshot.reason,
      contributions: [],
    };
  }

  if (!Object.prototype.hasOwnProperty.call(snapshot, 'data')) {
    return {
      ...base,
      state: snapshot.state === 'AVAILABLE' ? 'EMPTY' : snapshot.state,
      reason: snapshot.reason,
      contributions: [],
    };
  }

  try {
    const contributions = provider.normalize(snapshot.data as TData, context);
    return {
      ...base,
      state:
        snapshot.state === 'AVAILABLE' && contributions.length === 0 ? 'EMPTY' : snapshot.state,
      reason: snapshot.reason,
      contributions,
    };
  } catch {
    return {
      ...base,
      state: 'UNAVAILABLE',
      reason: 'NORMALIZATION_FAILED',
      contributions: [],
    };
  }
}

function instant(value: Date | string | number): number | null {
  const result = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(result) ? result : null;
}

function freshnessOf(
  generatedAt: string,
  freshnessMs: number,
  now: number,
  providerState?: HomeContributionProviderState
): Freshness {
  const generated = instant(generatedAt);
  if (generated === null) return { state: 'STALE', expiresAt: null };
  const ttl = validFreshnessMs(freshnessMs);
  const expires = generated + ttl;
  const expiresInstant = instant(expires);
  return {
    state:
      providerState === 'STALE' || expiresInstant === null || now > expires ? 'STALE' : 'FRESH',
    expiresAt: expiresInstant === null ? null : new Date(expiresInstant).toISOString(),
  };
}

function effectiveProviderState(
  sourceState: HomeContributionProviderState,
  generatedAt: string,
  freshnessMs: number,
  now: number
): HomeContributionProviderState {
  if (!['AVAILABLE', 'EMPTY', 'PARTIAL'].includes(sourceState)) return sourceState;
  return freshnessOf(generatedAt, freshnessMs, now).state === 'STALE' ? 'STALE' : sourceState;
}

function strongerRedaction(left: HomeRedactionMode, right: HomeRedactionMode): HomeRedactionMode {
  return REDACTION_ORDER[left] >= REDACTION_ORDER[right] ? left : right;
}

function requiredRedaction(
  input: HomeContributionInput,
  options: BuildHomeContributionModelOptions
): HomeRedactionMode {
  const policy = {
    ...DEFAULT_REDACTION,
    ...options.redactionPolicy?.classifications,
  };
  let mode = policy[input.privacy.classification];
  if (input.privacy.sensitive) {
    mode = strongerRedaction(mode, options.redactionPolicy?.sensitive ?? 'COUNT_ONLY');
  }
  if (input.privacy.minimumRedaction) {
    mode = strongerRedaction(mode, input.privacy.minimumRedaction);
  }
  return mode;
}

function timeOrInfinity(value: string | null | undefined): number {
  return value ? (instant(value) ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
}

function latestFirst(left: string, right: string): number {
  const leftTime = instant(left) ?? Number.NEGATIVE_INFINITY;
  const rightTime = instant(right) ?? Number.NEGATIVE_INFINITY;
  return rightTime - leftTime;
}

function compareCanonical(left: PreparedContribution, right: PreparedContribution): number {
  return (
    PURPOSE_ORDER[left.input.kind] - PURPOSE_ORDER[right.input.kind] ||
    PRIORITY_ORDER[left.input.priority] - PRIORITY_ORDER[right.input.priority] ||
    SCOPE_ORDER[left.input.scope] - SCOPE_ORDER[right.input.scope] ||
    timeOrInfinity(left.input.dueAt) - timeOrInfinity(right.input.dueAt) ||
    Number(left.freshness.state === 'STALE') - Number(right.freshness.state === 'STALE') ||
    latestFirst(left.input.generatedAt, right.input.generatedAt) ||
    left.providerKey.localeCompare(right.providerKey) ||
    left.input.sourceReference.localeCompare(right.input.sourceReference) ||
    left.input.id.localeCompare(right.input.id)
  );
}

function normalizedDedupeKey(contribution: PreparedContribution): string {
  const declared = contribution.input.dedupeKey.trim();
  const fallback = `${contribution.owner.source}:${contribution.input.sourceReference || contribution.input.id}`;
  return (declared || fallback).toLocaleLowerCase('en-US');
}

function highestPriority(group: readonly PreparedContribution[]): HomeContributionPriority {
  return [...group]
    .map((candidate) => candidate.input.priority)
    .sort((left, right) => PRIORITY_ORDER[left] - PRIORITY_ORDER[right])[0];
}

function earliestDueAt(group: readonly PreparedContribution[]): string | null {
  return (
    [...group]
      .map((candidate) => candidate.input.dueAt)
      .filter((value): value is string => Boolean(value) && instant(value as string) !== null)
      .sort((left, right) => timeOrInfinity(left) - timeOrInfinity(right))[0] ?? null
  );
}

function strongestClassification(
  group: readonly PreparedContribution[]
): HomePrivacyClassification {
  return [...group]
    .map((candidate) => candidate.input.privacy.classification)
    .sort((left, right) => CLASSIFICATION_ORDER[right] - CLASSIFICATION_ORDER[left])[0];
}

function strongestGroupRedaction(group: readonly PreparedContribution[]): HomeRedactionMode {
  return group.reduce<HomeRedactionMode>(
    (mode, candidate) => strongerRedaction(mode, candidate.redaction),
    'NONE'
  );
}

function conservativeGroupFreshness(group: readonly PreparedContribution[]): Freshness {
  const stale = group.some((candidate) => candidate.freshness.state === 'STALE');
  const expirations = group.map((candidate) => candidate.freshness.expiresAt);
  const expiresAt = expirations.some((value) => value === null)
    ? null
    : (expirations
        .filter((value): value is string => value !== null)
        .sort((left, right) => timeOrInfinity(left) - timeOrInfinity(right))[0] ?? null);
  return { state: stale ? 'STALE' : 'FRESH', expiresAt };
}

function oldestGeneratedAt(group: readonly PreparedContribution[]): string {
  return (
    group
      .map((candidate) => candidate.input.generatedAt)
      .filter((value) => instant(value) !== null)
      .sort((left, right) => timeOrInfinity(left) - timeOrInfinity(right))[0] ?? ''
  );
}

function presentationCount(input: HomeContributionInput): number {
  return Number.isFinite(input.count) && (input.count ?? 0) >= 0 ? Math.floor(input.count ?? 1) : 1;
}

function stableOpaqueKey(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `redacted-${(hash >>> 0).toString(36)}`;
}

function normalizeGroup(
  groupKey: string,
  unsortedGroup: readonly PreparedContribution[],
  fallbackTitle: string
): NormalizedHomeContribution | null {
  const group = [...unsortedGroup].sort(compareCanonical);
  const canonical = group[0];
  const redaction = strongestGroupRedaction(group);
  if (redaction === 'HIDDEN') return null;

  const classification = strongestClassification(group);
  const sensitive = group.some((candidate) => Boolean(candidate.input.privacy.sensitive));
  const sourceReferences = uniqueSorted(group.map((candidate) => candidate.input.sourceReference));
  const count = Math.max(...group.map((candidate) => presentationCount(candidate.input)));
  const countOnly = redaction === 'COUNT_ONLY';
  const title = countOnly
    ? (group.map((candidate) => candidate.input.privacy.redactedTitle).find(Boolean) ??
      fallbackTitle)
    : canonical.input.title;
  const opaqueKey = stableOpaqueKey(groupKey);

  return {
    id: countOnly ? opaqueKey : canonical.input.id,
    providerKey: canonical.providerKey,
    owner: canonical.owner,
    kind: canonical.input.kind,
    scope: canonical.input.scope,
    authority: canonical.input.authority,
    priority: highestPriority(group),
    status: countOnly ? 'REDACTED' : canonical.input.status,
    title,
    description: redaction === 'NONE' ? (canonical.input.description ?? null) : null,
    count,
    dueAt: countOnly ? null : earliestDueAt(group),
    route: countOnly ? '' : canonical.input.deepLink,
    deepLink: countOnly ? '' : canonical.input.deepLink,
    dedupeKey: countOnly ? opaqueKey : canonical.input.dedupeKey,
    sourceReference: countOnly ? 'REDACTED' : canonical.input.sourceReference,
    sourceReferences: countOnly ? [] : sourceReferences,
    generatedAt: oldestGeneratedAt(group),
    freshness: conservativeGroupFreshness(group),
    privacy: { classification, sensitive, redaction },
    redacted: redaction !== 'NONE',
    duplicateCount: countOnly ? 1 : group.length,
  };
}

function compareRank(left: NormalizedHomeContribution, right: NormalizedHomeContribution): number {
  return (
    PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority] ||
    timeOrInfinity(left.dueAt) - timeOrInfinity(right.dueAt) ||
    SCOPE_ORDER[left.scope] - SCOPE_ORDER[right.scope] ||
    Number(left.freshness.state === 'STALE') - Number(right.freshness.state === 'STALE') ||
    latestFirst(left.generatedAt, right.generatedAt) ||
    left.providerKey.localeCompare(right.providerKey) ||
    left.dedupeKey.localeCompare(right.dedupeKey) ||
    left.id.localeCompare(right.id)
  );
}

function emptyBuckets(): Record<HomeContributionBucketKey, NormalizedHomeContribution[]> {
  return { action: [], timeline: [], response: [], request: [], pulse: [] };
}

function bucketState(
  kind: HomeContributionKind,
  items: readonly NormalizedHomeContribution[],
  providers: readonly HomeContributionProviderViewState[]
): HomeContributionBucketState {
  const relevant = providers.filter((provider) => provider.supportedKinds.includes(kind));
  if (relevant.length === 0) return 'EMPTY';
  if (relevant.every((provider) => provider.state === 'FORBIDDEN')) return 'RESTRICTED';

  // A source the viewer cannot access is not a degraded version of an allowed
  // source. Exclude it from the bucket's availability calculation so a healthy
  // source cannot be mislabeled PARTIAL (or offered a meaningless retry).
  const permitted = relevant.filter((provider) => provider.state !== 'FORBIDDEN');

  const hasUsableSource = permitted.some((provider) =>
    ['AVAILABLE', 'EMPTY', 'PARTIAL', 'STALE'].includes(provider.state)
  );
  if (!hasUsableSource) return 'UNAVAILABLE';
  if (permitted.some((provider) => DEGRADED_BUCKET_STATES.has(provider.state))) return 'PARTIAL';
  return items.length > 0 ? 'AVAILABLE' : 'EMPTY';
}

/**
 * Builds a deterministic, presentation-safe home contribution model.
 * Processing order is authority -> freshness -> privacy -> global dedupe ->
 * purpose bucket ranking. Input order never affects the selected contribution.
 */
export function buildHomeContributionModel(
  results: readonly HomeContributionProviderResult[],
  options: BuildHomeContributionModelOptions
): HomeContributionModel {
  const now = instant(options.now);
  if (now === null) throw new RangeError('A valid `now` instant is required.');

  const prepared: PreparedContribution[] = [];
  const providerStates: HomeContributionProviderViewState[] = [];
  let receivedCount = 0;
  let unauthorizedCount = 0;

  const orderedResults = [...results].sort(
    (left, right) =>
      left.providerKey.localeCompare(right.providerKey) ||
      left.owner.source.localeCompare(right.owner.source)
  );

  for (const result of orderedResults) {
    const received = result.contributions.length;
    receivedCount += received;
    const providerAllowed = hasHomeContributionAuthority(result.authority, options.permissions);
    const sourceState = result.state;
    const contentState = sourceState === 'AVAILABLE' && received === 0 ? 'EMPTY' : sourceState;
    const state = providerAllowed
      ? effectiveProviderState(contentState, result.generatedAt, result.freshnessMs, now)
      : 'FORBIDDEN';

    providerStates.push({
      providerKey: result.providerKey,
      owner: result.owner,
      supportedKinds: result.supportedKinds,
      state,
      sourceState,
      generatedAt: result.generatedAt,
      freshnessMs: result.freshnessMs,
      reason: providerAllowed ? result.reason : 'AUTHORITY_REQUIRED',
      unavailableSources: uniqueSorted(result.unavailableSources),
      receivedCount: received,
      visibleCount: 0,
    });

    if (!providerAllowed) {
      unauthorizedCount += received;
      continue;
    }
    if (!CONTRIBUTING_STATES.has(state)) continue;

    for (const contribution of result.contributions) {
      if (!hasHomeContributionAuthority(contribution.authority, options.permissions)) {
        unauthorizedCount += 1;
        continue;
      }
      prepared.push({
        providerKey: result.providerKey,
        owner: result.owner,
        input: contribution,
        freshness: freshnessOf(
          contribution.generatedAt,
          contribution.freshnessMs ?? result.freshnessMs,
          now,
          state
        ),
        redaction: requiredRedaction(contribution, options),
      });
    }
  }

  const groups = new Map<string, PreparedContribution[]>();
  for (const contribution of prepared) {
    const key = normalizedDedupeKey(contribution);
    const group = groups.get(key);
    if (group) group.push(contribution);
    else groups.set(key, [contribution]);
  }

  const normalized: NormalizedHomeContribution[] = [];
  let hiddenCount = 0;
  let deduplicatedCount = 0;
  for (const groupKey of [...groups.keys()].sort((left, right) => left.localeCompare(right))) {
    const group = groups.get(groupKey) ?? [];
    deduplicatedCount += Math.max(0, group.length - 1);
    const contribution = normalizeGroup(
      groupKey,
      group,
      options.redactionPolicy?.fallbackTitle ?? 'Protected item'
    );
    if (contribution) normalized.push(contribution);
    else hiddenCount += group.length;
  }

  const buckets = emptyBuckets();
  for (const contribution of normalized) {
    buckets[BUCKET_BY_KIND[contribution.kind]].push(contribution);
  }
  for (const bucket of Object.values(buckets)) bucket.sort(compareRank);

  const visibleByProvider = new Map<string, number>();
  for (const contribution of normalized) {
    visibleByProvider.set(
      contribution.providerKey,
      (visibleByProvider.get(contribution.providerKey) ?? 0) + 1
    );
  }

  const providers = providerStates.map((provider) => ({
    ...provider,
    visibleCount: visibleByProvider.get(provider.providerKey) ?? 0,
  }));

  return {
    buckets,
    bucketStates: {
      action: bucketState('ACTION', buckets.action, providers),
      timeline: bucketState('TIMELINE', buckets.timeline, providers),
      response: bucketState('RESPONSE', buckets.response, providers),
      request: bucketState('REQUEST', buckets.request, providers),
      pulse: bucketState('PULSE', buckets.pulse, providers),
    },
    providers,
    diagnostics: {
      receivedCount,
      unauthorizedCount,
      hiddenCount,
      deduplicatedCount,
      visibleCount: normalized.length,
    },
  };
}
