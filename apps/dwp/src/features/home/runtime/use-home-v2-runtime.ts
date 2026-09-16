import { useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getHomeV2 } from '@dwp-frontend/shared-utils';

import type {
  ConditionalHttpSnapshot,
  HomeDeviceClass,
  HomeExperienceVariant,
  HomeV2ReadModel,
  HomeV2ReadResult,
} from '@dwp-frontend/shared-utils';

export const HOME_V2_QUERY_ROOT = ['home-runtime-v2'] as const;

type UseHomeV2RuntimeInput = Readonly<{
  accessFingerprint: string;
  deviceClass: HomeDeviceClass;
  enabled: boolean;
  mode?: HomeExperienceVariant;
  tenantId?: number | null;
  timeZone: string;
  userId?: number | null;
}>;

type ScopedSnapshot = Readonly<{
  scopeKey: string;
  snapshot: ConditionalHttpSnapshot<HomeV2ReadModel>;
}>;

export type HomeV2ActivationState =
  | Readonly<{ kind: 'DISABLED' }>
  | Readonly<{ kind: 'PENDING' }>
  | Readonly<{ kind: 'ERROR'; error: unknown }>
  | Readonly<{ kind: 'ACTIVE'; refreshFailed: boolean; result: HomeV2ReadResult }>
  | Readonly<{ kind: 'SHADOW'; refreshFailed: boolean; result: HomeV2ReadResult }>;

export type HomeV2ReadPath = Readonly<{
  legacyFanoutEnabled: boolean;
  render: 'LOADING' | 'ERROR' | 'V2' | 'LEGACY';
}>;

export function resolveHomeV2ActivationState(
  enabled: boolean,
  query: Readonly<{
    data?: HomeV2ReadResult;
    error?: unknown;
    isError: boolean;
    isPending: boolean;
    isRefetchError?: boolean;
  }>
): HomeV2ActivationState {
  if (!enabled) return { kind: 'DISABLED' };
  if (query.isPending) return { kind: 'PENDING' };
  if (query.data) {
    return query.data.metadata.runtimeMode === 'ACTIVE'
      ? {
          kind: 'ACTIVE',
          refreshFailed: query.isError || query.isRefetchError === true,
          result: query.data,
        }
      : {
          kind: 'SHADOW',
          refreshFailed: query.isError || query.isRefetchError === true,
          result: query.data,
        };
  }
  return { kind: 'ERROR', error: query.error };
}

export function resolveHomeV2ReadPath(activation: HomeV2ActivationState): HomeV2ReadPath {
  switch (activation.kind) {
    case 'ACTIVE':
      return { legacyFanoutEnabled: false, render: 'V2' };
    case 'SHADOW':
      return { legacyFanoutEnabled: true, render: 'LEGACY' };
    case 'PENDING':
      return { legacyFanoutEnabled: false, render: 'LOADING' };
    case 'ERROR':
      return { legacyFanoutEnabled: false, render: 'ERROR' };
    case 'DISABLED':
      return { legacyFanoutEnabled: false, render: 'ERROR' };
  }
}

export function useHomeV2Runtime({
  accessFingerprint,
  deviceClass,
  enabled,
  mode,
  tenantId,
  timeZone,
  userId,
}: UseHomeV2RuntimeInput) {
  const queryClient = useQueryClient();
  const identityReady = enabled && tenantId != null && userId != null;
  const scopeKey = useMemo(
    () =>
      JSON.stringify([
        tenantId ?? null,
        userId ?? null,
        accessFingerprint,
        deviceClass,
        mode ?? null,
        timeZone,
      ]),
    [accessFingerprint, deviceClass, mode, tenantId, timeZone, userId]
  );
  const snapshotRef = useRef<ScopedSnapshot | null>(null);
  const activeScopeRef = useRef(scopeKey);
  activeScopeRef.current = scopeKey;
  if (snapshotRef.current?.scopeKey !== scopeKey) snapshotRef.current = null;

  useEffect(() => {
    void queryClient.cancelQueries({
      queryKey: HOME_V2_QUERY_ROOT,
      predicate: (query) => query.queryKey[1] !== scopeKey,
    });
    queryClient.removeQueries({
      queryKey: HOME_V2_QUERY_ROOT,
      predicate: (query) => query.queryKey[1] !== scopeKey,
    });
    return () => {
      snapshotRef.current = null;
    };
  }, [queryClient, scopeKey]);

  const query = useQuery({
    queryKey: [...HOME_V2_QUERY_ROOT, scopeKey],
    queryFn: async ({ signal }) => {
      const requestedScope = scopeKey;
      const previous =
        snapshotRef.current?.scopeKey === requestedScope ? snapshotRef.current.snapshot : undefined;
      const result = await getHomeV2({ deviceClass, mode, signal, timeZone }, previous);
      signal.throwIfAborted();
      if (requestedScope !== activeScopeRef.current) {
        throw new DOMException('Home v2 scope changed', 'AbortError');
      }
      snapshotRef.current = { scopeKey: requestedScope, snapshot: result.snapshot };
      return result;
    },
    enabled: identityReady,
    gcTime: 0,
    staleTime: 0,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    retry: false,
  });
  const activation = resolveHomeV2ActivationState(identityReady, query);
  const readPath = resolveHomeV2ReadPath(activation);

  return {
    activation,
    active: activation.kind === 'ACTIVE',
    legacyEnabled: readPath.legacyFanoutEnabled,
    query,
    readPath,
  } as const;
}
