import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

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
    ({ currentLocation, nextLocation }) =>
      draftDirty && currentLocation.pathname !== nextLocation.pathname
  );
}
