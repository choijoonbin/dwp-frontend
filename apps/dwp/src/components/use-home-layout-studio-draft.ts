import { useCallback, useEffect, useMemo, useState } from 'react';

import { homeStudioWidgetsEqual, reconcileStudioWidgets } from './home-layout-studio-model';

import type { HomeView, PersonalHomeWidgetPreference } from '@dwp-frontend/shared-utils';

type StudioWidgetPreference = PersonalHomeWidgetPreference<string>;

type DraftState = Readonly<{
  viewId: string | null;
  baseVersion: number | null;
  resetToken: number;
  baseline: StudioWidgetPreference[];
  draft: StudioWidgetPreference[];
  history: StudioWidgetPreference[][];
}>;

function snapshotState(view: HomeView | null, resetToken: number): DraftState {
  const widgets = reconcileStudioWidgets(view?.layout.widgets);
  return {
    viewId: view?.viewId ?? null,
    baseVersion: view?.version ?? null,
    resetToken,
    baseline: widgets,
    draft: widgets,
    history: [],
  };
}

export function useHomeLayoutStudioDraft(view: HomeView | null, forceResetToken = 0) {
  const incomingFingerprint = JSON.stringify({
    viewId: view?.viewId ?? null,
    version: view?.version ?? null,
    widgets: view?.layout.widgets ?? null,
  });
  const incoming = useMemo(() => {
    const snapshot = JSON.parse(incomingFingerprint) as {
      viewId: string | null;
      version: number | null;
      widgets: unknown;
    };
    const widgets = reconcileStudioWidgets(snapshot.widgets);
    return {
      viewId: snapshot.viewId,
      baseVersion: snapshot.version,
      resetToken: forceResetToken,
      baseline: widgets,
      draft: widgets,
      history: [],
    } satisfies DraftState;
  }, [forceResetToken, incomingFingerprint]);
  const [state, setState] = useState<DraftState>(() => snapshotState(view, forceResetToken));

  useEffect(() => {
    setState((current) => {
      const switchedView = current.viewId !== incoming.viewId;
      const forcedReset = current.resetToken !== incoming.resetToken;
      const dirty = !homeStudioWidgetsEqual(current.draft, current.baseline);
      const savedDraftArrived = homeStudioWidgetsEqual(current.draft, incoming.baseline);
      if (!forcedReset && !switchedView && dirty && !savedDraftArrived) return current;
      if (
        !forcedReset &&
        !switchedView &&
        current.baseVersion === incoming.baseVersion &&
        homeStudioWidgetsEqual(current.baseline, incoming.baseline)
      ) {
        return current;
      }
      return incoming;
    });
  }, [incoming]);

  const commitDraft = useCallback((next: StudioWidgetPreference[]) => {
    setState((current) => ({
      ...current,
      draft: next,
      history: [...current.history.slice(-19), current.draft],
    }));
  }, []);

  const undo = useCallback(() => {
    setState((current) => {
      const previous = current.history.at(-1);
      if (!previous) return current;
      return { ...current, draft: previous, history: current.history.slice(0, -1) };
    });
  }, []);

  const reset = useCallback(() => {
    setState((current) => {
      if (homeStudioWidgetsEqual(current.draft, current.baseline)) return current;
      return {
        ...current,
        draft: current.baseline,
        history: [...current.history.slice(-19), current.draft],
      };
    });
  }, []);

  return {
    baseline: state.baseline,
    baseVersion: state.baseVersion,
    draft: state.draft,
    canUndo: state.history.length > 0,
    dirty: !homeStudioWidgetsEqual(state.draft, state.baseline),
    commitDraft,
    undo,
    reset,
  };
}
