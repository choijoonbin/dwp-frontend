import { Activity, CalendarDays, CheckCircle2, ListChecks, Sparkles } from 'lucide-react';

import {
  defaultWorkspaceWidgets,
  reconcileWorkspaceWidgets,
  setWorkspaceWidgetVisibility,
} from '../../components/workspace-composer/workspace-composer-model';
import {
  WORKSPACE_WIDGET_CATALOG,
  workspaceWidgetCatalogDefinition,
} from '../../components/workspace-composer/workspace-widget-catalog';

import type {
  HomeAudienceProfile,
  HomeWidgetKey,
  HomeWidgetPreference,
} from '@dwp-frontend/shared-utils';
import type { WorkspaceWidgetDefinition } from '../../components/workspace-composer/workspace-composer-model';
import type { WorkspaceWidgetLifecycle } from '../../components/workspace-composer/workspace-widget-catalog';

export const HOME_OVERVIEW_FRESHNESS_SECONDS = 30;

const widgetIcons = {
  'command-rail': ListChecks,
  'daily-brief': Sparkles,
  focus: CheckCircle2,
  schedule: CalendarDays,
  activity: Activity,
} as const;

export type HomeWidgetLifecyclePolicy = Readonly<{
  renderExisting: boolean;
  allowNewPlacement: boolean;
  allowRestore: boolean;
}>;

export function homeWidgetLifecyclePolicy(
  lifecycle: WorkspaceWidgetLifecycle
): HomeWidgetLifecyclePolicy {
  if (lifecycle === 'ACTIVE') {
    return { renderExisting: true, allowNewPlacement: true, allowRestore: true };
  }
  if (lifecycle === 'DEPRECATED') {
    return { renderExisting: true, allowNewPlacement: false, allowRestore: false };
  }
  return { renderExisting: false, allowNewPlacement: false, allowRestore: false };
}

export const HOME_WIDGET_REGISTRY: readonly WorkspaceWidgetDefinition<HomeWidgetKey>[] =
  WORKSPACE_WIDGET_CATALOG.filter(
    (definition) => homeWidgetLifecyclePolicy(definition.lifecycle).renderExisting
  ).map((definition) => ({
    key: definition.key,
    icon: widgetIcons[definition.key],
    canHide: definition.canHide,
    defaultSize: definition.defaultSize,
    allowedSizes: definition.allowedSizes,
    defaultHeight: definition.defaultHeight,
    allowedHeights: definition.allowedHeights,
    surface: definition.key === 'command-rail' ? 'plain' : undefined,
    audience: 'all',
    manifest: {
      schemaVersion: definition.manifestVersion,
      owner: definition.ownerProduct,
      dataSource: definition.dataSource,
      freshnessSeconds: definition.freshnessSeconds,
      privacyClass: definition.privacyClass,
      retention: definition.retention,
      analyticsKey: definition.analyticsKey,
    },
  }));

export const HOME_WIDGET_KEYS: readonly HomeWidgetKey[] = HOME_WIDGET_REGISTRY.map(
  (widget) => widget.key
);

export const HOME_WIDGET_ROLE_ORDER: Record<HomeAudienceProfile, readonly HomeWidgetKey[]> = {
  // Personal alias order: action-queue, today, response-hub,
  // request-tracker, role-pulse.
  MEMBER: ['command-rail', 'schedule', 'daily-brief', 'focus', 'activity'],
  MANAGER: ['command-rail', 'schedule', 'daily-brief', 'focus', 'activity'],
  // Operators keep the action queue first and then start with role-pulse.
  OPERATOR: ['command-rail', 'activity', 'schedule', 'daily-brief', 'focus'],
};

function orderedRegistry(
  registeredOrder: readonly HomeWidgetKey[],
  profile: HomeAudienceProfile
): WorkspaceWidgetDefinition<HomeWidgetKey>[] {
  const definitions = new Map(HOME_WIDGET_REGISTRY.map((widget) => [widget.key, widget]));
  const registered = new Set(registeredOrder);
  return HOME_WIDGET_ROLE_ORDER[profile]
    .filter((widgetKey) => registered.has(widgetKey))
    .map((widgetKey) => definitions.get(widgetKey))
    .filter((widget): widget is WorkspaceWidgetDefinition<HomeWidgetKey> => Boolean(widget));
}

export function defaultHomeWidgets(
  registeredOrder: readonly HomeWidgetKey[] = HOME_WIDGET_KEYS,
  profile: HomeAudienceProfile = 'MEMBER'
): HomeWidgetPreference[] {
  return defaultWorkspaceWidgets(
    orderedRegistry(registeredOrder, profile).filter((widget) => {
      const definition = workspaceWidgetCatalogDefinition(widget.key);
      return Boolean(
        definition && homeWidgetLifecyclePolicy(definition.lifecycle).allowNewPlacement
      );
    })
  );
}

export function reconcileHomeWidgets(
  value: unknown,
  registeredOrder: readonly HomeWidgetKey[] = HOME_WIDGET_KEYS,
  profile: HomeAudienceProfile = 'MEMBER'
): HomeWidgetPreference[] {
  const persistedKeys = new Set<HomeWidgetKey>();
  if (Array.isArray(value)) {
    value.forEach((candidate) => {
      if (!candidate || typeof candidate !== 'object') return;
      const widgetKey = (candidate as { widgetKey?: unknown }).widgetKey;
      if (typeof widgetKey === 'string') persistedKeys.add(widgetKey as HomeWidgetKey);
    });
  }
  const registry = orderedRegistry(registeredOrder, profile).filter((widget) => {
    const definition = workspaceWidgetCatalogDefinition(widget.key);
    if (!definition) return false;
    const policy = homeWidgetLifecyclePolicy(definition.lifecycle);
    return policy.allowNewPlacement || (policy.renderExisting && persistedKeys.has(widget.key));
  });
  return reconcileWorkspaceWidgets(value, registry);
}

export function setHomeWidgetVisibility(
  widgets: readonly HomeWidgetPreference[],
  widgetKey: HomeWidgetKey,
  visible: boolean
): HomeWidgetPreference[] {
  const definition = workspaceWidgetCatalogDefinition(widgetKey);
  if (visible && (!definition || !homeWidgetLifecyclePolicy(definition.lifecycle).allowRestore)) {
    return [...widgets];
  }
  return setWorkspaceWidgetVisibility(widgets, HOME_WIDGET_REGISTRY, widgetKey, visible);
}
