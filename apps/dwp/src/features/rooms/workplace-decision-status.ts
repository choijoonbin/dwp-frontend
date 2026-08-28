import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export type WorkplaceDecisionActionKind = 'CHECK_IN' | 'RELEASE' | 'CANCEL';

export type WorkplaceDecisionAction = {
  id: string;
  kind: WorkplaceDecisionActionKind;
  endsAt: string;
};

export type WorkplaceDecisionNotice = {
  actionId: string;
  kind: WorkplaceDecisionActionKind;
  endsAt: string;
  reason: 'ENDED' | 'UNVERIFIED' | 'RECOVERED';
};

type WorkplaceDecisionStatusOptions = {
  identityKey: string;
  sourceReady: boolean;
  submittedActionIds?: readonly string[];
};

type WorkplaceDecisionNoticeState = {
  identityKey: string;
  notice: WorkplaceDecisionNotice | null;
};

const DECISION_ACTION_ATTRIBUTE = 'data-workplace-decision-action';
const DIALOG_FOCUS_RESTORE_SETTLE_MS = 250;

function actionMap(actions: readonly WorkplaceDecisionAction[]) {
  return new Map(actions.map((action) => [action.id, action]));
}

export function transitionWorkplaceDecisionNotice(
  notice: WorkplaceDecisionNotice,
  actions: readonly WorkplaceDecisionAction[],
  nowInstant: number,
  sourceReady: boolean,
  completedActionIds: ReadonlySet<string> = new Set()
) {
  if (completedActionIds.has(notice.actionId)) return null;
  if (notice.reason === 'ENDED') return notice;
  const endsAt = Date.parse(notice.endsAt);
  if (Number.isFinite(endsAt) && nowInstant >= endsAt) {
    return { ...notice, reason: 'ENDED' as const };
  }
  if (!sourceReady) {
    return notice.reason === 'UNVERIFIED' ? notice : { ...notice, reason: 'UNVERIFIED' as const };
  }
  const action = actions.find(
    (candidate) => candidate.id === notice.actionId && candidate.kind === notice.kind
  );
  if (action) {
    if (notice.reason === 'RECOVERED' && action.endsAt === notice.endsAt) return notice;
    return { ...notice, endsAt: action.endsAt, reason: 'RECOVERED' as const };
  }
  return null;
}

export function workplaceDecisionActionProps(actionId: string) {
  return { [DECISION_ACTION_ATTRIBUTE]: actionId };
}

export function useWorkplaceDecisionStatus(
  actions: readonly WorkplaceDecisionAction[],
  nowInstant: number,
  { identityKey, sourceReady, submittedActionIds = [] }: WorkplaceDecisionStatusOptions
) {
  const statusRef = useRef<HTMLDivElement>(null);
  const activeIdentityRef = useRef(identityKey);
  const focusedActionIdRef = useRef<string | null>(null);
  const previousActionsRef = useRef(new Map<string, WorkplaceDecisionAction>());
  const completedActionIdsRef = useRef(new Set<string>());
  const shouldFocusStatusRef = useRef(false);
  const [noticeState, setNoticeState] = useState<WorkplaceDecisionNoticeState>(() => ({
    identityKey,
    notice: null,
  }));
  if (activeIdentityRef.current !== identityKey) {
    activeIdentityRef.current = identityKey;
    focusedActionIdRef.current = null;
    previousActionsRef.current = new Map();
    completedActionIdsRef.current = new Set();
    shouldFocusStatusRef.current = false;
  }
  const notice = noticeState.identityKey === identityKey ? noticeState.notice : null;
  const announceClosure = useCallback((nextNotice: WorkplaceDecisionNotice) => {
    focusedActionIdRef.current = null;
    shouldFocusStatusRef.current = true;
    setNoticeState({ identityKey: activeIdentityRef.current, notice: nextNotice });
  }, []);
  const completeAction = useCallback((actionIdentityKey: string, actionId: string) => {
    if (actionIdentityKey !== activeIdentityRef.current) return;
    completedActionIdsRef.current.add(actionId);
    if (focusedActionIdRef.current === actionId) focusedActionIdRef.current = null;
    shouldFocusStatusRef.current = false;
    setNoticeState((current) =>
      current.identityKey === activeIdentityRef.current && current.notice?.actionId === actionId
        ? { identityKey: activeIdentityRef.current, notice: null }
        : current
    );
  }, []);

  useEffect(() => {
    const rememberFocusedDecisionAction = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        focusedActionIdRef.current = null;
        return;
      }
      focusedActionIdRef.current =
        target
          .closest<HTMLElement>(`[${DECISION_ACTION_ATTRIBUTE}]`)
          ?.getAttribute(DECISION_ACTION_ATTRIBUTE) ?? null;
    };

    document.addEventListener('focusin', rememberFocusedDecisionAction);
    return () => document.removeEventListener('focusin', rememberFocusedDecisionAction);
  }, []);

  useLayoutEffect(() => {
    const currentActions = actionMap(actions);
    const submittedActions = new Set(submittedActionIds);
    const focusedActionId = focusedActionIdRef.current;
    const previousAction = focusedActionId
      ? previousActionsRef.current.get(focusedActionId)
      : undefined;

    previousActionsRef.current = currentActions;
    if (focusedActionId && previousAction && !currentActions.has(focusedActionId)) {
      focusedActionIdRef.current = null;
      if (
        submittedActions.has(focusedActionId) ||
        completedActionIdsRef.current.has(focusedActionId)
      ) {
        completedActionIdsRef.current.delete(focusedActionId);
        return;
      }

      const endsAt = Date.parse(previousAction.endsAt);
      const reason = Number.isFinite(endsAt) && nowInstant >= endsAt ? 'ENDED' : 'UNVERIFIED';
      announceClosure({
        actionId: focusedActionId,
        kind: previousAction.kind,
        endsAt: previousAction.endsAt,
        reason,
      });
      return;
    }

    if (!notice) return;
    const nextNotice = transitionWorkplaceDecisionNotice(
      notice,
      actions,
      nowInstant,
      sourceReady,
      completedActionIdsRef.current
    );
    if (nextNotice === notice) return;
    shouldFocusStatusRef.current = false;
    setNoticeState({ identityKey, notice: nextNotice });
  }, [actions, announceClosure, identityKey, notice, nowInstant, sourceReady, submittedActionIds]);

  useLayoutEffect(() => {
    if (noticeState.identityKey !== identityKey) {
      setNoticeState({ identityKey, notice: null });
    }
  }, [identityKey, noticeState.identityKey]);

  useEffect(() => {
    if (!notice || !shouldFocusStatusRef.current) return;
    shouldFocusStatusRef.current = false;
    statusRef.current?.focus({ preventScroll: true });
    const settle = window.setTimeout(() => {
      const activeElement = document.activeElement;
      const hasStableUserFocus =
        activeElement instanceof HTMLElement &&
        activeElement.isConnected &&
        activeElement !== document.body &&
        !activeElement.closest('[role="dialog"], [role="alertdialog"], [aria-modal="true"]');
      if (!hasStableUserFocus) statusRef.current?.focus({ preventScroll: true });
    }, DIALOG_FOCUS_RESTORE_SETTLE_MS);
    return () => window.clearTimeout(settle);
  }, [notice]);

  return { announceClosure, completeAction, notice, statusRef };
}
