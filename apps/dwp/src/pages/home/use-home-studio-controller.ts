import { useCallback, useMemo, useRef, useState } from 'react';

import type { Dispatch, SetStateAction } from 'react';

import type {
  HomeEditConflictTarget,
  HomeEditSession,
} from '../../features/home/runtime/home-edit-session';
import type { HomeExperienceVariant } from '@dwp-frontend/shared-utils';
import {
  freezeHomeStudioContractScope,
  resolveActiveHomeViewScope,
  type HomePreferenceStore,
  type HomeStudioContractScope,
} from '../../features/home/runtime/home-store-capabilities';
import { useHomeRolloutOverlayGuard } from '../../features/home/runtime/use-home-editor-safety';

type UseHomeStudioControllerOptions = {
  homeModeKey: HomeExperienceVariant;
  modeScopedHomeViewsSupported: boolean;
  fourDeviceLayoutsSupported: boolean;
  preferenceStore: HomePreferenceStore;
  editSession: HomeEditSession | null;
  homeV2Active: boolean;
  galleryOpen: boolean;
  discardEditorOpen: boolean;
  conflictTarget: HomeEditConflictTarget | null;
  setGalleryOpen: Dispatch<SetStateAction<boolean>>;
  setDiscardEditorOpen: Dispatch<SetStateAction<boolean>>;
  setConflictTarget: Dispatch<SetStateAction<HomeEditConflictTarget | null>>;
};

/** Owns the Studio overlay scope and focus lifecycle outside the main Home page composition. */
export function useHomeStudioController({
  homeModeKey,
  modeScopedHomeViewsSupported,
  fourDeviceLayoutsSupported,
  preferenceStore,
  editSession,
  homeV2Active,
  galleryOpen,
  discardEditorOpen,
  conflictTarget,
  setGalleryOpen,
  setDiscardEditorOpen,
  setConflictTarget,
}: UseHomeStudioControllerOptions) {
  const [studioOpen, setStudioOpen] = useState(false);
  const [studioContractScope, setStudioContractScope] = useState<HomeStudioContractScope | null>(
    null
  );
  const studioEntryFocusRef = useRef<HTMLElement | null>(null);
  const studioFocusRestorePendingRef = useRef(false);
  const editingHomeViewScope = resolveActiveHomeViewScope(
    { modeKey: homeModeKey, modeScoped: modeScopedHomeViewsSupported },
    editSession
  );
  const liveHomeStudioContractScope = useMemo<HomeStudioContractScope>(
    () => ({
      modeKey: editingHomeViewScope.modeKey,
      modeScopedViews: editingHomeViewScope.modeScoped,
      fourDeviceLayoutsSupported,
      preferenceStore,
    }),
    [
      editingHomeViewScope.modeKey,
      editingHomeViewScope.modeScoped,
      fourDeviceLayoutsSupported,
      preferenceStore,
    ]
  );
  const effectiveHomeStudioContractScope = studioContractScope ?? liveHomeStudioContractScope;
  const openHomeStudio = useCallback(() => {
    const activeElement = document.activeElement as HTMLElement | null;
    studioEntryFocusRef.current =
      (activeElement?.matches('[data-home-edit-trigger]') ? activeElement : null) ??
      document.querySelector<HTMLElement>('[data-home-edit-trigger]') ??
      activeElement;
    studioFocusRestorePendingRef.current = false;
    setStudioContractScope((current) =>
      freezeHomeStudioContractScope(current, liveHomeStudioContractScope)
    );
    setStudioOpen(true);
  }, [liveHomeStudioContractScope]);
  const openStudioFromGallery = useCallback(() => {
    setGalleryOpen(false);
    openHomeStudio();
  }, [openHomeStudio, setGalleryOpen]);
  const closeHomeStudio = useCallback(() => {
    studioFocusRestorePendingRef.current = true;
    setStudioOpen(false);
    setStudioContractScope(null);
  }, []);
  useHomeRolloutOverlayGuard(
    homeV2Active,
    galleryOpen || discardEditorOpen || conflictTarget !== null,
    studioOpen,
    closeHomeStudio,
    setGalleryOpen,
    setDiscardEditorOpen,
    setConflictTarget
  );
  const restoreHomeStudioEntryFocus = useCallback(() => {
    if (!studioFocusRestorePendingRef.current) return;
    const retainedEntry = studioEntryFocusRef.current;
    const fallbackEntry = document.querySelector<HTMLElement>('[data-home-edit-trigger]');
    const target = retainedEntry?.isConnected ? retainedEntry : fallbackEntry;
    target?.focus({ preventScroll: true });
    studioEntryFocusRef.current = null;
    studioFocusRestorePendingRef.current = false;
  }, []);
  const activeHomeViewScope = resolveActiveHomeViewScope(
    { modeKey: homeModeKey, modeScoped: modeScopedHomeViewsSupported },
    editSession,
    studioOpen ? studioContractScope : null
  );
  const markHomeStudioEditStarted = useCallback(() => {
    studioFocusRestorePendingRef.current = false;
  }, []);

  return {
    activeHomeViewScope,
    closeHomeStudio,
    effectiveHomeStudioContractScope,
    markHomeStudioEditStarted,
    openHomeStudio,
    openStudioFromGallery,
    restoreHomeStudioEntryFocus,
    studioContractScope,
    studioOpen,
  };
}
