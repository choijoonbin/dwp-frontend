import type { HomeEditSession } from './home-edit-session';
import type { HomeExperienceVariant } from '@dwp-frontend/shared-utils';

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

/**
 * The legacy preference row predates Home modes and is the Classic rollback
 * source only. A pre-Wave 1 VIEWS store is already tied to the tenant's effective
 * mode, while the LEGACY store must never be interpreted as a Flow layout.
 */
export function resolveModeIsolatedHomeExperience(
  configuredVariant: HomeExperienceVariant,
  viewsStoreReady: boolean
): HomeExperienceVariant {
  return configuredVariant === 'FLOW_V1' && !viewsStoreReady ? 'CLASSIC' : configuredVariant;
}
