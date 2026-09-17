import type {
  HomeComposerProposal,
  HomeExperienceVariant,
  HomePreference,
  HomePreferenceLayout,
  HomeView,
} from '@dwp-frontend/shared-utils';
import type { HomeWorkstyleIntent } from './home-personalization-model';

export const homeStudioTemplateQueryKey = ['home-personalization', 'templates'] as const;

export function resolveHomePreferenceStore(
  advertisedStore: 'LEGACY' | 'VIEWS' | undefined
): 'LEGACY' | 'VIEWS' {
  return advertisedStore === 'VIEWS' ? 'VIEWS' : 'LEGACY';
}

export function replaceHomeStudioView(
  views: readonly HomeView[] | undefined,
  next: HomeView
): HomeView[] {
  if (!views) return [next];
  const exists = views.some((view) => view.viewId === next.viewId);
  return exists
    ? views.map((view) => (view.viewId === next.viewId ? next : view))
    : [...views, next];
}

export function createNoopHomeComposerProposal(
  view: HomeView,
  intent: HomeWorkstyleIntent,
  now = new Date()
): HomeComposerProposal {
  return {
    proposalId: `noop-${view.viewId}`,
    viewId: view.viewId,
    state: 'PREVIEWED',
    baseViewVersion: view.version,
    reasonCodes: [intent],
    changes: [],
    warnings: [],
    beforeLayout: view.layout,
    proposedLayout: view.layout,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 5 * 60_000).toISOString(),
  };
}

export function createLegacyHomeStudioView(
  legacyStore: boolean,
  preference: HomePreference<string> | undefined,
  modeKey: HomeExperienceVariant,
  name: string
): HomeView | null {
  if (!legacyStore || !preference) return null;
  const updatedAt = preference.updatedAt ?? new Date(0).toISOString();
  return {
    viewId: 'legacy-workspace-home',
    viewKey: 'default',
    surfaceKey: preference.surfaceKey,
    modeKey,
    name,
    isDefault: true,
    schemaVersion: preference.schemaVersion,
    layout: preference.layout,
    version: preference.version,
    createdAt: updatedAt,
    updatedAt,
    widgetConfigurations: {},
    customized: preference.customized,
  };
}

export function createInitialHomeStudioView(
  legacyStore: boolean,
  selectedView: HomeView | null | undefined,
  seedLayout: HomePreferenceLayout<string> | null,
  unavailable: boolean,
  modeKey: HomeExperienceVariant,
  name: string
): HomeView | null {
  if (legacyStore || selectedView || !seedLayout || unavailable) return null;
  const timestamp = new Date(0).toISOString();
  return {
    viewId: 'new-workspace-home',
    viewKey: 'default',
    surfaceKey: 'workspace-home',
    modeKey,
    name,
    isDefault: true,
    schemaVersion: 5,
    layout: seedLayout,
    version: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    widgetConfigurations: {},
    customized: false,
  };
}
