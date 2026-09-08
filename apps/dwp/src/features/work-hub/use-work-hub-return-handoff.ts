import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { openWorkHubSourceRoute } from './work-hub-actions';
import {
  consumeWorkHubReturnIntent,
  recordWorkHubReturnIntent,
  workHubApprovalHandoffRoute,
  workHubCurrentLocation,
  type WorkHubReturnFocus,
} from './work-hub-return-handoff';

import type { WorkHubItem, WorkHubSnapshot } from './work-hub-contracts';

export type WorkHubReturnRefetchResult = {
  data?: { snapshot: Pick<WorkHubSnapshot, 'items'> };
  isSuccess: boolean;
};

const focusSelector: Record<WorkHubReturnFocus, string> = {
  ASSIST: '[data-work-ai-trigger]',
  SOURCE: '[data-work-source-trigger]',
};

/** Revalidates owner data before returning focus to the control that initiated an approval handoff. */
export function useWorkHubReturnHandoff({
  itemKey,
  ready,
  refetch,
}: {
  itemKey: string | null;
  ready: boolean;
  refetch: () => Promise<WorkHubReturnRefetchResult>;
}) {
  const location = useLocation();
  const returnTo = workHubCurrentLocation(location);
  useEffect(() => {
    if (!ready || !returnTo) return;
    const focus = consumeWorkHubReturnIntent(returnTo, itemKey);
    if (!focus || !itemKey) return;
    let active = true;
    void refetch()
      .then((result) => {
        if (!active || !result.isSuccess) return;
        if (!result.data?.snapshot.items.some((item) => item.key === itemKey)) return;
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            if (!active) return;
            [...document.querySelectorAll<HTMLElement>(focusSelector[focus])]
              .find((candidate) => candidate.dataset.workItemKey === itemKey)
              ?.focus({ preventScroll: true });
          })
        );
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [itemKey, ready, refetch, returnTo]);

  return (item: WorkHubItem, route: string, focus: WorkHubReturnFocus): boolean => {
    const handoffReturnTo = workHubCurrentLocation(window.location);
    if (!handoffReturnTo) return false;
    const target = workHubApprovalHandoffRoute(route, handoffReturnTo);
    if (!target) return false;
    const parsed = new URL(target, window.location.origin);
    if (
      parsed.pathname.startsWith('/approvals/') &&
      parsed.searchParams.get('returnTo') === handoffReturnTo
    )
      recordWorkHubReturnIntent(item, handoffReturnTo, focus);
    return openWorkHubSourceRoute(target);
  };
}
