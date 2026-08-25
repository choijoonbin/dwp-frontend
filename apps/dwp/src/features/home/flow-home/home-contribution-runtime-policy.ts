import type { AppEntitlementPermission, HrHomeOverview } from '@dwp-frontend/shared-utils';
import { HttpError } from '@dwp-frontend/shared-utils';
import { isHcmReadEntitled } from '@dwp-frontend/shared-utils/auth/hcm-access';
import type { HomeContributionProviderState } from '../contributions';

const LEGACY_HCM_VIEW_PERMISSION: AppEntitlementPermission = {
  resourceType: 'APP',
  resourceKey: 'APP.HCM',
  permissionCode: 'VIEW',
  effect: 'ALLOW',
};

/**
 * Mirrors PeopleSecurityFilter's compatibility branch. Role fallback is
 * trusted only when the server supplied no entitlement rows at all; an
 * explicit permission set must never be widened by a legacy role.
 */
export function resolveHomeContributionPermissions(
  permissions: readonly AppEntitlementPermission[],
  roles: readonly string[],
  legacyRoleFallbackAllowed = false
): readonly AppEntitlementPermission[] {
  if (permissions.length > 0 || !isHcmReadEntitled(permissions, roles, legacyRoleFallbackAllowed))
    return permissions;
  return [LEGACY_HCM_VIEW_PERMISSION];
}

/** Business-domain partial success must be stronger than HTTP AVAILABLE. */
export function promoteHomeProviderPartialState(
  state: HomeContributionProviderState,
  businessPartial: boolean
): HomeContributionProviderState {
  return state === 'AVAILABLE' && businessPartial ? 'PARTIAL' : state;
}

/** Missing or malformed source clocks stay missing so freshness fails closed. */
export function trustedHomeSourceTimestamp(value: string | null | undefined): string {
  return value && Number.isFinite(Date.parse(value)) ? value : '';
}

/** Query observation time is valid only for APIs with no aggregate source clock. */
export function homeQuerySnapshotTimestamp(dataUpdatedAt: number): string {
  return Number.isFinite(dataUpdatedAt) && dataUpdatedAt > 0
    ? new Date(dataUpdatedAt).toISOString()
    : '';
}

/** Keeps HCM fallback zero/null values from being presented as confirmed data. */
export function hrHomeUnavailableSources(home: HrHomeOverview | undefined): readonly string[] {
  if (!home) return [];
  return Object.entries(home.domainStates)
    .filter(([, state]) => state?.availability === 'UNAVAILABLE')
    .map(([domain, state]) =>
      state?.reasonCode ? `HCM.${domain}:${state.reasonCode}` : `HCM.${domain}`
    )
    .sort();
}

export function isHomeAuthorizationFailure(error: unknown): boolean {
  if (error instanceof HttpError) return error.status === 401 || error.status === 403;
  if (!error || typeof error !== 'object' || !('status' in error)) return false;
  const status = Number((error as { status?: unknown }).status);
  return status === 401 || status === 403;
}

/** Authorization failures are terminal so cached private data is hidden immediately. */
export function homeQueryRetry(failureCount: number, error: unknown): boolean {
  return !isHomeAuthorizationFailure(error) && failureCount < 1;
}

export function homeAuthorizedQueryData<T>(data: T | undefined, error: unknown): T | undefined {
  return isHomeAuthorizationFailure(error) ? undefined : data;
}

export function homeProviderQueryState(
  enabled: boolean,
  query: Readonly<{
    data?: unknown;
    loading: boolean;
    fetching?: boolean;
    failed: boolean;
    refreshFailed?: boolean;
    error?: unknown;
  }>
): HomeContributionProviderState {
  if (!enabled || isHomeAuthorizationFailure(query.error)) return 'FORBIDDEN';
  if (query.loading && !query.data) return 'EMPTY';
  if (query.failed && !query.data) return 'UNAVAILABLE';
  if (query.data && (query.failed || query.refreshFailed)) return 'PARTIAL';
  return query.data ? 'AVAILABLE' : 'UNAVAILABLE';
}

export function homeHcmPulseAllRoute(items: readonly Readonly<{ deepLink: string }>[]): string {
  if (items.length === 0 || items.some((item) => !item.deepLink.trim().startsWith('/hr/'))) {
    return '/hr/home';
  }
  const routes = [
    ...new Set(
      items.map((item) => item.deepLink.trim()).filter((route) => route.startsWith('/hr/'))
    ),
  ];
  return routes.length === 1 ? routes[0]! : '/hr/home';
}
