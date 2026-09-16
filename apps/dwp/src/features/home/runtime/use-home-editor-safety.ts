import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

import type { Dispatch, SetStateAction } from 'react';

type HomeEditorSafetyOptions = {
  editorOpen: boolean;
  draftDirty: boolean;
  overlayOpen: boolean;
  onRequestCancel: () => void;
};

/**
 * Keeps Home editing keyboard-safe and protects the in-memory draft from SPA navigation.
 * Browser reload protection stays with the page because it owns the persisted draft lifecycle.
 */
export function useHomeEditorSafety({
  editorOpen,
  draftDirty,
  overlayOpen,
  onRequestCancel,
}: HomeEditorSafetyOptions) {
  useEffect(() => {
    if (!editorOpen) return undefined;
    const focusToolbar = window.requestAnimationFrame(() => {
      const firstControl = document.querySelector<HTMLElement>(
        '[data-workspace-composer-placement="floating"] button:not(:disabled)'
      );
      firstControl?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(focusToolbar);
  }, [editorOpen]);

  useEffect(() => {
    if (!editorOpen || overlayOpen) return undefined;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      onRequestCancel();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [editorOpen, onRequestCancel, overlayOpen]);

  return useBlocker(
    editorOpen && draftDirty
      ? ({ currentLocation, nextLocation }) => currentLocation.pathname !== nextLocation.pathname
      : false
  );
}

/** Hides legacy mutation surfaces immediately when the trusted read authority moves to v2. */
export function useHomeRolloutOverlayGuard<T>(
  active: boolean,
  legacyOverlayOpen: boolean,
  studioOpen: boolean,
  closeStudio: () => void,
  setGalleryOpen: Dispatch<SetStateAction<boolean>>,
  setDiscardOpen: Dispatch<SetStateAction<boolean>>,
  setConflictTarget: Dispatch<SetStateAction<T | null>>
): void {
  useEffect(() => {
    if (!active) return;
    setGalleryOpen(false);
    setDiscardOpen(false);
    setConflictTarget(null);
    if (studioOpen) closeStudio();
  }, [
    active,
    closeStudio,
    legacyOverlayOpen,
    setConflictTarget,
    setDiscardOpen,
    setGalleryOpen,
    studioOpen,
  ]);
}
