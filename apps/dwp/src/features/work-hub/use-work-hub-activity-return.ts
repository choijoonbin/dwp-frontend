import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { workspaceWorkActivityRoute } from '@dwp-frontend/shared-utils/api/workspace-work-policy';
import { isAppReadEntitled } from '@dwp-frontend/shared-utils/auth/app-entitlements';
import { usePermissions } from '@dwp-frontend/shared-utils/auth/use-permissions';

import { useWorkHubOperationOwner } from './use-work-hub-operation-owner';
import {
  consumeWorkHubActivityReturnIntent,
  recordWorkHubActivityReturnIntent,
  workHubActivityCurrentLocation,
  workHubActivityHandoffRoute,
  workHubActivityOwnerFingerprint,
} from './work-hub-activity-return';

import type { WorkHubItem } from './work-hub-contracts';

type WorkHubActivityRefreshResult = {
  data?: { snapshot?: { items: readonly { key: string; version: number }[] } };
  isSuccess: boolean;
};

function useActivityOwnerFingerprint(ownerKey: string | null): string | null | undefined {
  const [resolved, setResolved] = useState<{
    ownerKey: string;
    fingerprint: string | null;
  } | null>(null);
  useEffect(() => {
    if (!ownerKey) return;
    let active = true;
    void workHubActivityOwnerFingerprint(ownerKey).then((fingerprint) => {
      if (active) setResolved({ ownerKey, fingerprint });
    });
    return () => {
      active = false;
    };
  }, [ownerKey]);
  if (!ownerKey) return null;
  return resolved?.ownerKey === ownerKey ? resolved.fingerprint : undefined;
}

/** Restores Activity trigger focus only after fresh owner-scoped Work data confirms the item. */
export function useWorkHubActivityReturn(
  item: Pick<WorkHubItem, 'key' | 'legacyItem' | 'version'> | undefined,
  ready: boolean,
  refetch: () => Promise<WorkHubActivityRefreshResult>
) {
  const itemKey = item?.key ?? null;
  const itemVersion = item?.version ?? null;
  const activityRoute = item?.legacyItem ? workspaceWorkActivityRoute(item.legacyItem) : null;
  const location = useLocation();
  const navigate = useNavigate();
  const ownerKey = useWorkHubOperationOwner();
  const ownerFingerprint = useActivityOwnerFingerprint(ownerKey);
  const { permissions } = usePermissions();
  const canUseActivity = isAppReadEntitled('APP.ACTIVITY', permissions);
  const returnTo = workHubActivityCurrentLocation(location);
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    if (!ready || !returnTo || ownerFingerprint === undefined) return;
    const restore = consumeWorkHubActivityReturnIntent({
      canUseActivity,
      itemKey,
      itemVersion,
      ownerFingerprint,
      returnTo,
    });
    if (!restore || !itemKey || itemVersion === null) return;
    let active = true;
    void refetchRef
      .current()
      .then((result) => {
        if (
          !active ||
          !result.isSuccess ||
          !result.data?.snapshot?.items.some(
            (item) => item.key === itemKey && item.version === itemVersion
          )
        )
          return;
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            if (!active) return;
            const trigger = [
              ...document.querySelectorAll<HTMLElement>('[data-work-activity-trigger]'),
            ].find((element) => element.dataset.workActivityTrigger === itemKey);
            trigger?.focus({ preventScroll: true });
          })
        );
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [canUseActivity, itemKey, itemVersion, ownerFingerprint, ready, returnTo]);

  const open = useCallback((): void => {
    const target = workHubActivityHandoffRoute(activityRoute ?? '');
    const currentReturnTo = workHubActivityCurrentLocation(window.location);
    if (
      !canUseActivity ||
      !ownerFingerprint ||
      !itemKey ||
      itemVersion === null ||
      !target ||
      !currentReturnTo
    )
      return;
    const recorded = recordWorkHubActivityReturnIntent({
      activityRoute: target,
      itemKey,
      itemVersion,
      ownerFingerprint,
      returnTo: currentReturnTo,
    });
    if (recorded) navigate(target);
  }, [activityRoute, canUseActivity, itemKey, itemVersion, navigate, ownerFingerprint]);

  return canUseActivity && ownerFingerprint && activityRoute ? open : undefined;
}
