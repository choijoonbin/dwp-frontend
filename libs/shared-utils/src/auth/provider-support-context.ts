import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getProviderSupportSessionContext } from '../api/provider-control-api';
import { publishCrossTabRevision, subscribeCrossTabRevision } from './cross-tab-revision';
import { useAuth } from './auth-provider';
import { isProviderIdentity } from './control-plane-access';

import type { ProviderSupportSessionContext } from '../api/provider-control-api';

export const providerSupportContextQueryKey = ['provider', 'support-context'] as const;
export const providerSupportContextRevisionChannel = 'dwp:provider-support-context:revision:v1';
const DEFAULT_SUPPORT_CONTEXT_REFETCH_MS = 30_000;
const MINIMUM_SUPPORT_CONTEXT_REFETCH_MS = 250;
const MAXIMUM_TIMER_DELAY_MS = 2_147_000_000;

export function isProviderSupportSessionActive(
  context: ProviderSupportSessionContext | null | undefined,
  now = Date.now()
): context is ProviderSupportSessionContext {
  if (!context) return false;
  const expiresAt = Date.parse(context.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > now;
}

export function resolveActiveProviderSupportContext(
  context: ProviderSupportSessionContext | null | undefined,
  failed: boolean,
  now = Date.now()
): ProviderSupportSessionContext | null {
  return !failed && isProviderSupportSessionActive(context, now) ? context : null;
}

/**
 * The browser `expiresAt` is the server-computed minimum of the absolute and idle leases.
 * Include it with every authority-bearing field so any lease, scope, version, or target change
 * forces an access-sensitive cache transition.
 */
export function providerSupportContextFingerprint(
  context: ProviderSupportSessionContext | null | undefined
): string {
  if (!context) return 'none';
  return JSON.stringify({
    supportSessionId: context.supportSessionId,
    tenantId: context.tenantId,
    version: context.version,
    scopes: [...context.scopes].sort(),
    accessMode: context.accessMode,
    effectiveExpiresAt: context.expiresAt,
  });
}

export function publishProviderSupportContextRevision(): void {
  publishCrossTabRevision(providerSupportContextRevisionChannel);
}

export function providerSupportContextRefetchInterval(
  context: ProviderSupportSessionContext | null | undefined,
  now = Date.now()
): number {
  if (!context) return DEFAULT_SUPPORT_CONTEXT_REFETCH_MS;
  const expiresAt = Date.parse(context.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    return DEFAULT_SUPPORT_CONTEXT_REFETCH_MS;
  }
  return Math.min(
    DEFAULT_SUPPORT_CONTEXT_REFETCH_MS,
    Math.max(MINIMUM_SUPPORT_CONTEXT_REFETCH_MS, expiresAt - now + 25)
  );
}

export function useProviderSupportContext(enabled: boolean) {
  const [, setExpiryRevision] = useState(0);
  const query = useQuery({
    queryKey: providerSupportContextQueryKey,
    queryFn: getProviderSupportSessionContext,
    enabled,
    retry: false,
    staleTime: 10_000,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
    refetchIntervalInBackground: true,
    refetchInterval: enabled
      ? (current) => providerSupportContextRefetchInterval(current.state.data)
      : false,
  });
  const expiresAt = Date.parse(query.data?.expiresAt ?? '');
  const refetch = query.refetch;

  useEffect(
    () =>
      enabled
        ? subscribeCrossTabRevision(providerSupportContextRevisionChannel, () => {
            void refetch({ cancelRefetch: true });
          })
        : undefined,
    [enabled, refetch]
  );

  useEffect(() => {
    if (!enabled || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return;
    const timeout = setTimeout(
      () => setExpiryRevision((value) => value + 1),
      Math.min(expiresAt - Date.now() + 25, MAXIMUM_TIMER_DELAY_MS)
    );
    return () => clearTimeout(timeout);
  }, [enabled, expiresAt]);

  return {
    ...query,
    // Never let a stale React Query value extend the authorization context
    // beyond a failed refresh or the server-issued expiry.
    rawData: query.data,
    data: resolveActiveProviderSupportContext(query.data, query.isError),
  };
}

export function useCurrentProviderSupportContext() {
  const auth = useAuth();
  return useProviderSupportContext(isProviderIdentity(auth.user));
}
