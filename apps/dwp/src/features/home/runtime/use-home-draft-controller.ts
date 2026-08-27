import { useCallback, useState } from 'react';

import {
  commitHomeDraftEdit,
  createHomeDraftHistory,
  redoHomeDraft,
  replaceHomeDraftHistory,
  undoHomeDraft,
  type HomeDraft,
} from '../home-draft-history';

import type { HomePresentation, HomeWidgetPreference } from '@dwp-frontend/shared-utils';
import type { LaunchpadLayout } from '../../../components/workspace-composer/app-launchpad-model';
import type { SetStateAction } from 'react';

export function useHomeDraftController(createInitialDraft: () => HomeDraft) {
  const [draftHistory, setDraftHistory] = useState(() =>
    createHomeDraftHistory(createInitialDraft())
  );

  const updateDraft = useCallback((update: (draft: HomeDraft) => HomeDraft) => {
    setDraftHistory((current) => commitHomeDraftEdit(current, update(current.present)));
  }, []);

  const setDraftWidgets = useCallback(
    (value: SetStateAction<HomeWidgetPreference[]>) => {
      updateDraft((current) => ({
        ...current,
        widgets: typeof value === 'function' ? value(current.widgets) : value,
      }));
    },
    [updateDraft]
  );

  const setDraftAppLayout = useCallback(
    (value: SetStateAction<LaunchpadLayout>) => {
      updateDraft((current) => ({
        ...current,
        appLayout: typeof value === 'function' ? value(current.appLayout) : value,
      }));
    },
    [updateDraft]
  );

  const setDraftPresentation = useCallback(
    (value: SetStateAction<HomePresentation>) => {
      updateDraft((current) => ({
        ...current,
        presentation: typeof value === 'function' ? value(current.presentation) : value,
      }));
    },
    [updateDraft]
  );

  const replaceDraft = useCallback((draft: HomeDraft) => {
    setDraftHistory(replaceHomeDraftHistory(draft));
  }, []);
  const undoDraft = useCallback(() => setDraftHistory((current) => undoHomeDraft(current)), []);
  const redoDraft = useCallback(() => setDraftHistory((current) => redoHomeDraft(current)), []);

  return {
    draftHistory,
    setDraftHistory,
    setDraftWidgets,
    setDraftAppLayout,
    setDraftPresentation,
    replaceDraft,
    undoDraft,
    redoDraft,
  } as const;
}
