import type { AppEntitlementPermission } from '@dwp-frontend/shared-utils';

export type HomeContributionKind = 'ACTION' | 'TIMELINE' | 'RESPONSE' | 'REQUEST' | 'PULSE';

export type HomeContributionScope = 'ME' | 'TEAM' | 'OPERATIONS';

export type HomeContributionBucketKey = 'action' | 'timeline' | 'response' | 'request' | 'pulse';

export type HomeContributionBucketState =
  | 'AVAILABLE'
  | 'EMPTY'
  | 'PARTIAL'
  | 'RESTRICTED'
  | 'UNAVAILABLE';

export type HomeContributionPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

export type HomeContributionProviderState =
  | 'AVAILABLE'
  | 'EMPTY'
  | 'PARTIAL'
  | 'FORBIDDEN'
  | 'UNAVAILABLE'
  | 'CONFIGURATION_REQUIRED'
  | 'STALE';

export type HomePrivacyClassification = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';

export type HomeRedactionMode = 'NONE' | 'TITLE_ONLY' | 'COUNT_ONLY' | 'HIDDEN';

export type HomeContributionOwner = Readonly<{
  /** Stable source/provider name, for example DWP_APPROVAL. */
  source: string;
  /** Entitled application resource key, for example APP.APPROVAL. */
  appKey: string;
  appLabel?: string;
}>;

export type HomeAuthorityRequirement = Readonly<{
  resourceType: string;
  resourceKey: string;
  permissionCodes: readonly string[];
  match?: 'ANY' | 'ALL';
}>;

/**
 * `allOf` requirements must all pass. When `anyOf` is present, at least one
 * of its requirements must also pass. An explicit DENY always wins.
 */
export type HomeContributionAuthority = Readonly<{
  allOf?: readonly HomeAuthorityRequirement[];
  anyOf?: readonly HomeAuthorityRequirement[];
}>;

export type HomeContributionPrivacy = Readonly<{
  classification: HomePrivacyClassification;
  sensitive?: boolean;
  /** A provider can make redaction stricter, never weaker, than the shell policy. */
  minimumRedaction?: HomeRedactionMode;
  redactedTitle?: string;
}>;

/** Provider-normalized, UI-agnostic contribution. */
export type HomeContributionInput = Readonly<{
  id: string;
  kind: HomeContributionKind;
  scope: HomeContributionScope;
  authority?: HomeContributionAuthority;
  priority: HomeContributionPriority;
  /** Provider-normalized status code. It is intentionally open to app-specific states. */
  status: string;
  title: string;
  description?: string | null;
  /** Numeric presentation value; defaults to one business object. */
  count?: number;
  dueAt?: string | null;
  deepLink: string;
  /** Cross-provider identity used to suppress the same business object globally. */
  dedupeKey: string;
  /** Source-owned immutable identifier used for audit and drill-down. */
  sourceReference: string;
  generatedAt: string;
  /** Item TTL. Falls back to the provider TTL when omitted. */
  freshnessMs?: number;
  privacy: HomeContributionPrivacy;
}>;

export type HomeContributionProviderContext = Readonly<{
  now: string;
  /** Query observation time for APIs that do not return a source timestamp. */
  snapshotAt?: string;
  /** User-time-zone calendar date (YYYY-MM-DD) for today-scoped providers. */
  dateKey?: string;
  locale?: string;
  timeZone?: string;
}>;

/**
 * Adapters implement this interface over data already fetched by the shell.
 * It deliberately has no query/client dependency and performs no network I/O.
 */
export interface HomeContributionProvider<TData> {
  readonly key: string;
  readonly owner: HomeContributionOwner;
  /** Purpose kinds this source can truthfully satisfy, even when it returns zero items. */
  readonly supportedKinds: readonly HomeContributionKind[];
  readonly authority?: HomeContributionAuthority;
  readonly freshnessMs: number;
  normalize(
    data: TData,
    context: HomeContributionProviderContext
  ): readonly HomeContributionInput[];
}

export type HomeContributionProviderSnapshot<TData> = Readonly<{
  state: HomeContributionProviderState;
  generatedAt: string;
  data?: TData;
  freshnessMs?: number;
  reason?: string;
  unavailableSources?: readonly string[];
}>;

/** Type-erased, resolved provider output consumed by the pure home model. */
export type HomeContributionProviderResult = Readonly<{
  providerKey: string;
  owner: HomeContributionOwner;
  authority?: HomeContributionAuthority;
  supportedKinds: readonly HomeContributionKind[];
  state: HomeContributionProviderState;
  generatedAt: string;
  freshnessMs: number;
  reason?: string;
  unavailableSources: readonly string[];
  contributions: readonly HomeContributionInput[];
}>;

export type HomeContributionRedactionPolicy = Readonly<{
  classifications?: Partial<Readonly<Record<HomePrivacyClassification, HomeRedactionMode>>>;
  sensitive?: HomeRedactionMode;
  fallbackTitle?: string;
}>;

export type BuildHomeContributionModelOptions = Readonly<{
  now: Date | string | number;
  permissions: readonly AppEntitlementPermission[];
  redactionPolicy?: HomeContributionRedactionPolicy;
}>;

export type NormalizedHomeContribution = Readonly<{
  id: string;
  providerKey: string;
  owner: HomeContributionOwner;
  kind: HomeContributionKind;
  scope: HomeContributionScope;
  authority?: HomeContributionAuthority;
  priority: HomeContributionPriority;
  status: string;
  title: string;
  description: string | null;
  count: number;
  dueAt: string | null;
  /** Presentation-safe navigation alias used by bucket renderers. */
  route: string;
  deepLink: string;
  dedupeKey: string;
  sourceReference: string;
  sourceReferences: readonly string[];
  generatedAt: string;
  freshness: Readonly<{
    state: 'FRESH' | 'STALE';
    expiresAt: string | null;
  }>;
  privacy: Readonly<{
    classification: HomePrivacyClassification;
    sensitive: boolean;
    redaction: HomeRedactionMode;
  }>;
  redacted: boolean;
  duplicateCount: number;
}>;

export type HomeContributionProviderViewState = Readonly<{
  providerKey: string;
  owner: HomeContributionOwner;
  supportedKinds: readonly HomeContributionKind[];
  state: HomeContributionProviderState;
  sourceState: HomeContributionProviderState;
  generatedAt: string;
  freshnessMs: number;
  reason?: string;
  unavailableSources: readonly string[];
  receivedCount: number;
  visibleCount: number;
}>;

export type HomeContributionModel = Readonly<{
  buckets: Readonly<Record<HomeContributionBucketKey, readonly NormalizedHomeContribution[]>>;
  bucketStates: Readonly<Record<HomeContributionBucketKey, HomeContributionBucketState>>;
  providers: readonly HomeContributionProviderViewState[];
  diagnostics: Readonly<{
    receivedCount: number;
    unauthorizedCount: number;
    hiddenCount: number;
    deduplicatedCount: number;
    visibleCount: number;
  }>;
}>;
