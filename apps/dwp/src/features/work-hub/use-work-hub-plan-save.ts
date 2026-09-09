import { useEffect, useRef } from 'react';
import type { WorkSourceReference } from '@dwp-frontend/shared-utils/api/personal-work-contracts';
import type { createWorkHubController, WorkHubPlanSaveResult } from './work-hub-controller';
import { workHubReferenceKey, type WorkHubItem, type WorkHubSnapshot } from './work-hub-contracts';
import {
  isWorkAssignmentReference,
  isWorkHubItemCommandReady,
  isWorkHubSourceCommandReady,
} from './work-hub-command-authority';
import type { WorkTaskSaveCoordinator } from './work-hub-task-save-coordinator';

export function useWorkHubPlanSave({
  owner,
  controller,
  enabled,
  preflight,
  snapshot,
  mutationCoordinator,
}: {
  owner: string | null;
  controller: ReturnType<typeof createWorkHubController>;
  enabled: boolean;
  preflight: () => Promise<WorkHubSnapshot | null>;
  snapshot: WorkHubSnapshot | undefined;
  mutationCoordinator?: WorkTaskSaveCoordinator;
}) {
  const current = useRef({ owner, controller, enabled, preflight, snapshot });
  current.current = { owner, controller, enabled, preflight, snapshot };
  const mounted = useRef(false);
  const active = useRef<{ abort: AbortController } | null>(null);
  useEffect(() => {
    mounted.current = true;
    active.current?.abort.abort();
    active.current = null;
    return () => {
      mounted.current = false;
      active.current?.abort.abort();
      active.current = null;
    };
  }, [owner, controller, enabled]);

  return async (
    date: string,
    draft: WorkSourceReference[],
    idempotencyKey: string,
    reviewedItems?: readonly WorkHubItem[]
  ): Promise<WorkHubPlanSaveResult> => {
    const identity = current.current;
    if (!mounted.current || !identity.owner || !identity.enabled || active.current)
      throw new DOMException('Work plan operation unavailable', 'AbortError');
    if (draft.some(isWorkAssignmentReference)) return { state: 'UNAVAILABLE', draft: [...draft] };
    const draftKeys = new Set(draft.map(workHubReferenceKey));
    const reviewed =
      reviewedItems ?? identity.snapshot?.items.filter((item) => draftKeys.has(item.key)) ?? [];
    const run = { abort: new AbortController() };
    active.current = run;
    const fingerprint = `PLAN:${JSON.stringify([
      date,
      identity.controller.state().plan?.version ?? null,
      draft.map((reference) => [
        reference.sourceSystem,
        reference.sourceReference,
        reference.obligationKey ?? null,
      ]),
    ])}`;
    const requestKey = mutationCoordinator
      ? mutationCoordinator.mutationKey(identity.owner, fingerprint, idempotencyKey)
      : idempotencyKey;
    const canContinue = () =>
      mounted.current &&
      active.current === run &&
      current.current.owner === identity.owner &&
      current.current.controller === identity.controller &&
      current.current.enabled;
    try {
      let snapshot: WorkHubSnapshot | null = null;
      try {
        snapshot = await identity.preflight();
      } catch {
        if (!canContinue()) throw new DOMException('Work owner changed', 'AbortError');
      }
      if (!canContinue()) throw new DOMException('Work owner changed', 'AbortError');
      if (
        !isWorkHubSourceCommandReady(snapshot, 'personal') ||
        !reviewed.every((item) => isWorkHubItemCommandReady(snapshot, item))
      ) {
        return { state: 'UNAVAILABLE', draft: [...draft] };
      }
      const result = await identity.controller.savePlan(date, draft, requestKey, {
        signal: run.abort.signal,
        canContinue,
      });
      if (!canContinue()) throw new DOMException('Work owner changed', 'AbortError');
      if (result.state === 'SAVED' || result.state === 'CONFLICT') {
        mutationCoordinator?.acknowledgeMutation(identity.owner, fingerprint);
      }
      return result;
    } finally {
      if (active.current === run) active.current = null;
    }
  };
}
