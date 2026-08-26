import type { HomeEditSession } from './home-edit-session';

export type HomePreferenceStore = HomeEditSession['store'];

/**
 * Keeps every store-specific read and surface behind one resolved store decision.
 * An in-flight editor session owns the decision so a runtime policy refresh cannot
 * silently switch persistence APIs underneath that draft.
 */
export function activeHomeStoreUsesViews(
  configuredUsesViews: boolean,
  editingStore?: HomePreferenceStore | null
): boolean {
  return editingStore ? editingStore === 'VIEWS' : configuredUsesViews;
}
