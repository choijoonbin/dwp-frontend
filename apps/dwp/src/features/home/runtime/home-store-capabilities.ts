import type { HomeEditSession } from './home-edit-session';
import type { HomeExperienceVariant } from '@dwp-frontend/shared-utils';

export type HomePreferenceStore = HomeEditSession['store'];
export type HomeViewScope = Readonly<{
  modeKey: HomeExperienceVariant;
  modeScoped: boolean;
}>;
export type HomeStudioContractScope = Readonly<{
  modeKey: HomeExperienceVariant;
  modeScopedViews: boolean;
  fourDeviceLayoutsSupported: boolean;
  preferenceStore: HomePreferenceStore;
}>;

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
 * Pins view reads and cache identity to an in-flight VIEWS edit. Live tenant
 * changes take effect only after that edit session closes.
 */
export function resolveActiveHomeViewScope(
  liveScope: HomeViewScope,
  editSession?: Pick<HomeEditSession, 'store' | 'experienceVariant' | 'modeScopedViews'> | null,
  studioScope?: Pick<HomeStudioContractScope, 'modeKey' | 'modeScopedViews'> | null
): HomeViewScope {
  if (studioScope) {
    return { modeKey: studioScope.modeKey, modeScoped: studioScope.modeScopedViews };
  }
  if (editSession?.store !== 'VIEWS') return liveScope;
  return {
    modeKey: editSession.experienceVariant,
    modeScoped: editSession.modeScopedViews,
  };
}

/** Keeps every Studio query and mutation on the contract captured when it opened. */
export function freezeHomeStudioContractScope(
  currentScope: HomeStudioContractScope | null,
  liveScope: HomeStudioContractScope
): HomeStudioContractScope {
  return currentScope ?? liveScope;
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
  return configuredVariant !== 'CLASSIC' && !viewsStoreReady ? 'CLASSIC' : configuredVariant;
}

/** The broker read model owns the rendered mode without granting legacy write capabilities. */
export function resolveBrokeredHomeExperience(
  brokerVariant: HomeExperienceVariant | null,
  configuredVariant: HomeExperienceVariant,
  viewsStoreReady: boolean
): HomeExperienceVariant {
  return brokerVariant ?? resolveModeIsolatedHomeExperience(configuredVariant, viewsStoreReady);
}
