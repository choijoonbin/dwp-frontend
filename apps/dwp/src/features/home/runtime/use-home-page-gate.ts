import { useCallback } from 'react';

import {
  canStartHomeEditing,
  resolveHomePageGateState,
  type HomePageGateState,
} from './home-page-runtime-state';

type HomePageGateQuery = Readonly<{
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => Promise<unknown>;
}>;

export function useHomePageGate({
  experienceQuery,
  layoutQuery,
  deviceLayoutPending,
  customizationEnabled,
  editorOpen,
}: Readonly<{
  experienceQuery: HomePageGateQuery;
  layoutQuery: HomePageGateQuery;
  deviceLayoutPending: boolean;
  customizationEnabled: boolean;
  editorOpen: boolean;
}>): Readonly<{
  state: HomePageGateState;
  retrying: boolean;
  editActionAvailable: boolean;
  retry: () => void;
}> {
  const state = resolveHomePageGateState({
    experiencePending: experienceQuery.isPending,
    experienceReady: experienceQuery.isSuccess,
    experienceFailed: experienceQuery.isError,
    layoutPending: layoutQuery.isPending,
    layoutFailed: layoutQuery.isError,
    deviceLayoutPending,
  });
  const retry = useCallback(() => {
    if (state.kind !== 'error') return;
    void (state.source === 'experience' ? experienceQuery.refetch() : layoutQuery.refetch());
  }, [experienceQuery, layoutQuery, state]);

  return {
    state,
    retrying:
      state.kind === 'error' && state.source === 'experience'
        ? experienceQuery.isFetching
        : layoutQuery.isFetching,
    editActionAvailable: canStartHomeEditing({
      customizationEnabled,
      editorOpen,
      gateState: state,
    }),
    retry,
  };
}
