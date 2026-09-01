import { workspaceWidgetCatalogDefinition } from '../../components/workspace-composer/workspace-widget-catalog';
import { HOME_WIDGET_REGISTRY, homeWidgetLifecyclePolicy } from './home-widget-registry';

import type { HomeWidgetKey, HomeWidgetPreference } from '@dwp-frontend/shared-utils';
import type { WorkspaceWidgetLifecycle } from '../../components/workspace-composer/workspace-widget-catalog';
import type {
  HomeAppDefinition,
  LaunchpadLayout,
} from '../../components/workspace-composer/app-launchpad-model';

export type HomeGalleryItemKind = 'APP' | 'WIDGET';
export type HomeGalleryPlacementState = 'ADD' | 'RESTORE' | 'ADDED' | 'LOCKED' | 'FORBIDDEN';
export type HomeGalleryView = 'LIBRARY' | 'HIDDEN';
export type HomeGalleryKindFilter = 'ALL' | HomeGalleryItemKind;
export type HomeGalleryStatusFilter = 'ALL' | 'ACTIONABLE' | 'ADDED';

export type HomeAppGalleryItem = Readonly<{
  id: string;
  kind: 'APP';
  state: HomeGalleryPlacementState;
  app: HomeAppDefinition;
}>;

export type HomeWidgetGalleryItem = Readonly<{
  id: string;
  kind: 'WIDGET';
  state: HomeGalleryPlacementState;
  widget: (typeof HOME_WIDGET_REGISTRY)[number];
}>;

export type HomeGalleryItem = HomeAppGalleryItem | HomeWidgetGalleryItem;

export function resolveHomeWidgetLifecycleGalleryState(
  lifecycle: WorkspaceWidgetLifecycle,
  visible: boolean | null
): HomeGalleryPlacementState | null {
  const policy = homeWidgetLifecyclePolicy(lifecycle);
  if (!policy.renderExisting) return null;
  if (visible === true) return 'ADDED';
  if (visible === false) return policy.allowRestore ? 'RESTORE' : 'LOCKED';
  return policy.allowNewPlacement ? 'ADD' : null;
}

function placedLaunchpadAppIds(layout: LaunchpadLayout): Set<string> {
  const placed = new Set<string>();
  Object.values(layout.groups).forEach((items) => {
    items.forEach((itemId) => {
      const folder = layout.folders[itemId];
      if (folder) folder.appIds.forEach((appId) => placed.add(appId));
      else placed.add(itemId);
    });
  });
  return placed;
}

export function resolveHomeAppGalleryItems(
  availableApps: readonly HomeAppDefinition[],
  layout: LaunchpadLayout
): HomeAppGalleryItem[] {
  const hidden = new Set(layout.hiddenAppIds);
  const placed = placedLaunchpadAppIds(layout);

  return availableApps.map((app) => ({
    id: `app:${app.id}`,
    kind: 'APP',
    state: hidden.has(app.id) ? 'RESTORE' : placed.has(app.id) ? 'ADDED' : 'ADD',
    app,
  }));
}

export function resolveHomeWidgetGalleryItems(
  registeredWidgetKeys: readonly HomeWidgetKey[],
  widgetPreferences: readonly HomeWidgetPreference[],
  entitledApps: readonly Pick<HomeAppDefinition, 'resourceKey'>[],
  flow: boolean
): HomeWidgetGalleryItem[] {
  const registered = new Set(registeredWidgetKeys);
  const preferenceByKey = new Map(
    widgetPreferences.map((preference) => [preference.widgetKey, preference])
  );
  const entitledAppResourceKeys = new Set(entitledApps.map((app) => app.resourceKey));

  return HOME_WIDGET_REGISTRY.flatMap((widget) => {
    if (!registered.has(widget.key)) return [];
    const definition = workspaceWidgetCatalogDefinition(widget.key);
    if (!definition) return [];
    const entitlementResourceKeys = flow
      ? definition.contributorAppResourceKeys
      : [definition.sourceAppResourceKey];
    if (!entitlementResourceKeys.some((resourceKey) => entitledAppResourceKeys.has(resourceKey))) {
      return [];
    }
    const preference = preferenceByKey.get(widget.key);
    const state = resolveHomeWidgetLifecycleGalleryState(
      definition.lifecycle,
      preference?.visible ?? null
    );
    if (!state) return [];
    return [{ id: `widget:${widget.key}`, kind: 'WIDGET' as const, state, widget }];
  });
}

export function filterHomeGalleryItems(
  items: readonly HomeGalleryItem[],
  {
    view,
    kind,
    status,
  }: {
    view: HomeGalleryView;
    kind: HomeGalleryKindFilter;
    status: HomeGalleryStatusFilter;
  }
): HomeGalleryItem[] {
  return items.filter((item) => {
    if (view === 'HIDDEN' && item.state !== 'RESTORE') return false;
    if (kind !== 'ALL' && item.kind !== kind) return false;
    if (view === 'HIDDEN' || status === 'ALL') return true;
    if (status === 'ACTIONABLE') return item.state === 'ADD' || item.state === 'RESTORE';
    if (status === 'ADDED') return item.state === 'ADDED';
    return false;
  });
}

export function normalizeHomeGallerySearch(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase();
}

export function matchesHomeGallerySearch(query: string, values: readonly string[]): boolean {
  const normalizedQuery = normalizeHomeGallerySearch(query);
  if (!normalizedQuery) return true;
  return normalizeHomeGallerySearch(values.join(' ')).includes(normalizedQuery);
}

export function homeGalleryActionableCount(items: readonly HomeGalleryItem[]): number {
  return items.filter((item) => item.state === 'ADD' || item.state === 'RESTORE').length;
}

export function homeGalleryRestorableCount(items: readonly HomeGalleryItem[]): number {
  return items.filter((item) => item.state === 'RESTORE').length;
}
