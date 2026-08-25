import { Activity, CalendarDays, CheckCircle2, ListChecks, Sparkles } from 'lucide-react';

import {
  defaultWorkspaceWidgets,
  reconcileWorkspaceWidgets,
  setWorkspaceWidgetVisibility,
} from '../../components/workspace-composer/workspace-composer-model';

import type {
  HomeAudienceProfile,
  HomeWidgetKey,
  HomeWidgetPreference,
} from '@dwp-frontend/shared-utils';
import type { WorkspaceWidgetDefinition } from '../../components/workspace-composer/workspace-composer-model';

export const HOME_OVERVIEW_FRESHNESS_SECONDS = 30;

export const HOME_WIDGET_REGISTRY: readonly WorkspaceWidgetDefinition<HomeWidgetKey>[] = [
  {
    key: 'command-rail',
    icon: ListChecks,
    canHide: true,
    defaultSize: 'large',
    allowedSizes: ['large', 'full'],
    defaultHeight: 'short',
    allowedHeights: ['short', 'standard'],
    surface: 'plain',
    audience: 'all',
    manifest: {
      schemaVersion: 1,
      owner: 'Digital Workplace Product',
      dataSource: 'DWP_HOME_OVERVIEW',
      freshnessSeconds: HOME_OVERVIEW_FRESHNESS_SECONDS,
      privacyClass: 'CONFIDENTIAL',
      retention: 'NONE',
      analyticsKey: 'home.command-rail',
    },
  },
  {
    key: 'daily-brief',
    icon: Sparkles,
    canHide: true,
    defaultSize: 'full',
    allowedSizes: ['compact', 'large', 'full'],
    defaultHeight: 'standard',
    allowedHeights: ['short', 'standard', 'tall'],
    audience: 'all',
    manifest: {
      schemaVersion: 1,
      owner: 'Digital Workplace Product',
      dataSource: 'DWP_HOME_OVERVIEW',
      freshnessSeconds: HOME_OVERVIEW_FRESHNESS_SECONDS,
      privacyClass: 'INTERNAL',
      retention: 'NONE',
      analyticsKey: 'home.workday-insights',
    },
  },
  {
    key: 'focus',
    icon: CheckCircle2,
    canHide: true,
    defaultSize: 'medium',
    allowedSizes: ['quarter', 'compact', 'medium', 'large', 'full'],
    defaultHeight: 'tall',
    allowedHeights: ['short', 'standard', 'tall', 'expanded'],
    audience: 'all',
    manifest: {
      schemaVersion: 1,
      owner: 'Digital Workplace Product',
      dataSource: 'DWP_WORKSPACE',
      freshnessSeconds: HOME_OVERVIEW_FRESHNESS_SECONDS,
      privacyClass: 'CONFIDENTIAL',
      retention: 'NONE',
      analyticsKey: 'home.focus',
    },
  },
  {
    key: 'schedule',
    icon: CalendarDays,
    canHide: true,
    defaultSize: 'quarter',
    allowedSizes: ['fifth', 'quarter', 'compact', 'medium'],
    defaultHeight: 'standard',
    allowedHeights: ['short', 'standard', 'tall'],
    audience: 'all',
    manifest: {
      schemaVersion: 1,
      owner: 'Calendar Product',
      dataSource: 'DWP_CALENDAR',
      freshnessSeconds: HOME_OVERVIEW_FRESHNESS_SECONDS,
      privacyClass: 'CONFIDENTIAL',
      retention: 'NONE',
      analyticsKey: 'home.schedule',
    },
  },
  {
    key: 'activity',
    icon: Activity,
    canHide: true,
    defaultSize: 'quarter',
    allowedSizes: ['fifth', 'quarter', 'compact', 'medium'],
    defaultHeight: 'tall',
    allowedHeights: ['short', 'standard', 'tall'],
    audience: 'all',
    manifest: {
      schemaVersion: 1,
      owner: 'Digital Workplace Product',
      dataSource: 'DWP_ACTIVITY',
      freshnessSeconds: HOME_OVERVIEW_FRESHNESS_SECONDS,
      privacyClass: 'INTERNAL',
      retention: 'NONE',
      analyticsKey: 'home.activity',
    },
  },
];

export const HOME_WIDGET_KEYS: readonly HomeWidgetKey[] = HOME_WIDGET_REGISTRY.map(
  (widget) => widget.key
);

export const HOME_WIDGET_ROLE_ORDER: Record<HomeAudienceProfile, readonly HomeWidgetKey[]> = {
  // command-rail is the governed Action Queue and is not a Flow personal key.
  // Personal alias order: today, response-hub, request-tracker, role-pulse.
  MEMBER: ['command-rail', 'schedule', 'daily-brief', 'focus', 'activity'],
  MANAGER: ['command-rail', 'schedule', 'daily-brief', 'focus', 'activity'],
  // Operators start with role-pulse before the shared personal sequence.
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
  return defaultWorkspaceWidgets(orderedRegistry(registeredOrder, profile));
}

export function reconcileHomeWidgets(
  value: unknown,
  registeredOrder: readonly HomeWidgetKey[] = HOME_WIDGET_KEYS,
  profile: HomeAudienceProfile = 'MEMBER'
): HomeWidgetPreference[] {
  return reconcileWorkspaceWidgets(value, orderedRegistry(registeredOrder, profile));
}

export function setHomeWidgetVisibility(
  widgets: readonly HomeWidgetPreference[],
  widgetKey: HomeWidgetKey,
  visible: boolean
): HomeWidgetPreference[] {
  return setWorkspaceWidgetVisibility(widgets, HOME_WIDGET_REGISTRY, widgetKey, visible);
}
