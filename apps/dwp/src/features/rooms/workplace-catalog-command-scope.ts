import { useWorkplaceMemberScopeRevision } from './workplace-member-scope-revision';
import { useEffect, useRef, useState } from 'react';
import { HttpError, useAuth } from '@dwp-frontend/shared-utils';
import { useRoomsCapabilities } from './rooms-capabilities';
import { useWorkplaceGovernanceTargetScope } from './workplace-governance-target-scope';
import type { WorkplaceGovernanceDelegatedPermission } from '@dwp-frontend/shared-utils';

export function useWorkplaceCatalogCommandScope(
  target: string,
  sourceReady: boolean,
  creating: boolean,
  targetScope?: {
    siteId: string | null;
    floorId?: string | null;
    permission?: WorkplaceGovernanceDelegatedPermission;
  }
) {
  const auth = useAuth();
  const capabilities = useRoomsCapabilities();
  const governance = useWorkplaceGovernanceTargetScope();
  const targetAllowed = () =>
    !targetScope ||
    (governance.ready &&
      (targetScope.siteId
        ? governance.allowsTarget(
            targetScope.permission ?? 'CATALOG_MANAGE',
            targetScope.siteId,
            targetScope.floorId ?? null
          )
        : governance.globalAdministrator));
  const scopeKey = useWorkplaceMemberScopeRevision(
    JSON.stringify([
      auth.user?.tenantId,
      auth.user?.userId,
      target,
      targetScope,
      governance.authorityKey,
    ])
  );
  const active = useRef(scopeKey);
  active.current = scopeKey;
  const inFlight = useRef<string | null>(null);
  const [failed, setFailed] = useState<{ scopeKey: string; unknown: boolean } | null>(null);
  const failedHere = failed?.scopeKey === scopeKey;
  const allowed =
    capabilities.isLoaded &&
    capabilities.canViewWorkplaceAdmin &&
    (creating ? capabilities.canCreateWorkplaceAdmin : capabilities.canUpdateWorkplaceAdmin) &&
    targetAllowed() &&
    sourceReady &&
    !failedHere;
  const readyRef = useRef(allowed);
  readyRef.current = allowed;
  const targetAllowedRef = useRef(targetAllowed);
  targetAllowedRef.current = targetAllowed;
  useEffect(() => {
    setFailed(null);
  }, [scopeKey]);
  useEffect(() => {
    active.current = scopeKey;
    return () => {
      if (active.current === scopeKey) active.current = '';
    };
  }, [scopeKey]);
  return {
    scopeKey,
    allowed,
    failed: failedHere,
    unknown: failedHere && failed.unknown,
    begin(commandScope: string) {
      if (
        commandScope !== active.current ||
        !readyRef.current ||
        !targetAllowedRef.current() ||
        inFlight.current === commandScope
      )
        throw new Error('workplace-catalog-command-unverified');
      inFlight.current = commandScope;
    },
    current(commandScope: string) {
      return active.current === commandScope && targetAllowedRef.current();
    },
    finish(commandScope: string) {
      if (inFlight.current === commandScope) inFlight.current = null;
    },
    recover(commandScope: string) {
      if (active.current === commandScope && targetAllowedRef.current()) setFailed(null);
    },
    reject(commandScope: string, error: unknown) {
      if (active.current !== commandScope) return;
      setFailed({
        scopeKey: commandScope,
        unknown: !(error instanceof HttpError) || error.status >= 500,
      });
    },
  };
}
