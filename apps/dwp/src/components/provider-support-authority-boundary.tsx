import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { isProviderIdentity } from '@dwp-frontend/shared-utils/auth/control-plane-access';
import {
  isProviderSupportSessionActive,
  providerSupportContextFingerprint,
  publishProviderSupportContextRevision,
  useProviderSupportContext,
} from '@dwp-frontend/shared-utils/auth/provider-support-context';

import { ShellBootScreen } from './shell-boot-screen';

import type { PlaneCachePurger } from './query-cache-plane-boundary';

type ObservedSupportIdentity = {
  initialized: boolean;
  fingerprint: string;
};

type ProviderSupportAuthorityBoundaryProps = PropsWithChildren<{
  purgeTenantCache: PlaneCachePurger;
}>;

/**
 * Observes the Provider JIT support identity without a static dependency on the Provider feature.
 * The platform bootstrap owns tenant product authority and injects the cache transition policy.
 */
export function ProviderSupportAuthorityBoundary({
  children,
  purgeTenantCache,
}: ProviderSupportAuthorityBoundaryProps) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const providerAccount = isProviderIdentity(auth.user);
  const supportContext = useProviderSupportContext(providerAccount);
  const [, setPurgeRevision] = useState(0);
  const observed = useRef<ObservedSupportIdentity>({ initialized: false, fingerprint: 'none' });
  const purgeGeneration = useRef(0);
  const inFlightTransition = useRef<string | null>(null);
  const activeSupportContext =
    !supportContext.isError && isProviderSupportSessionActive(supportContext.data)
      ? supportContext.data
      : null;
  const currentFingerprint = providerSupportContextFingerprint(activeSupportContext);
  const observationReady = providerAccount && !supportContext.isLoading;

  if (observationReady && !observed.current.initialized) {
    observed.current = { initialized: true, fingerprint: currentFingerprint };
  }

  const requiresTenantCachePurge =
    observationReady &&
    observed.current.initialized &&
    observed.current.fingerprint !== currentFingerprint;

  useEffect(() => {
    if (!requiresTenantCachePurge) return;
    const transition = `${observed.current.fingerprint}:${currentFingerprint}`;
    if (inFlightTransition.current === transition) return;
    inFlightTransition.current = transition;
    const generation = ++purgeGeneration.current;
    void purgeTenantCache(queryClient)
      .then(() => {
        if (generation !== purgeGeneration.current) return;
        observed.current = { initialized: true, fingerprint: currentFingerprint };
        inFlightTransition.current = null;
        publishProviderSupportContextRevision();
        setPurgeRevision((value) => value + 1);
      })
      .catch(() => undefined);
  }, [currentFingerprint, purgeTenantCache, queryClient, requiresTenantCachePurge]);

  if (!providerAccount) return children;
  if (requiresTenantCachePurge) return <ShellBootScreen />;
  // Provider diagnosis is configuration-preview only. It never enters the tenant product
  // authority plane, even while a support session is active.
  return children;
}
