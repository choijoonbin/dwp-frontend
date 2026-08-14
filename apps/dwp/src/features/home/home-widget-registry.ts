import { Activity, CalendarDays, CheckCircle2, Megaphone, Sparkles } from 'lucide-react';

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

export const HOME_WIDGET_REGISTRY: readonly WorkspaceWidgetDefinition<HomeWidgetKey>[] = [
  {
    key: 'announcements',
    icon: Megaphone,
    canHide: false,
    defaultSize: 'full',
    allowedSizes: ['full'],
    audience: 'all',
    manifest: {
      schemaVersion: 1,
      owner: 'Employee Communications',
      dataSource: 'DWP_COMMUNICATIONS',
      freshnessSeconds: 60,
      privacyClass: 'INTERNAL',
      retention: 'NONE',
      analyticsKey: 'home.announcements',
    },
  },
  {
    key: 'daily-brief',
    icon: Sparkles,
    canHide: true,
    defaultSize: 'full',
    allowedSizes: ['large', 'full'],
    audience: 'all',
    manifest: {
      schemaVersion: 1,
      owner: 'Digital Workplace Product',
      dataSource: 'DWP_HOME_OVERVIEW',
      freshnessSeconds: 30,
      privacyClass: 'INTERNAL',
      retention: 'NONE',
      analyticsKey: 'home.workday-insights',
    },
  },
  {
    key: 'focus',
    icon: CheckCircle2,
    canHide: true,
    defaultSize: 'large',
    allowedSizes: ['medium', 'large', 'full'],
    audience: 'all',
    manifest: {
      schemaVersion: 1,
      owner: 'Digital Workplace Product',
      dataSource: 'DWP_WORKSPACE',
      freshnessSeconds: 30,
      privacyClass: 'CONFIDENTIAL',
      retention: 'NONE',
      analyticsKey: 'home.focus',
    },
  },
  {
    key: 'schedule',
    icon: CalendarDays,
    canHide: true,
    defaultSize: 'compact',
    allowedSizes: ['compact', 'medium'],
    audience: 'all',
    manifest: {
      schemaVersion: 1,
      owner: 'Calendar Product',
      dataSource: 'DWP_CALENDAR',
      freshnessSeconds: 30,
      privacyClass: 'CONFIDENTIAL',
      retention: 'NONE',
      analyticsKey: 'home.schedule',
    },
  },
  {
    key: 'activity',
    icon: Activity,
    canHide: true,
    defaultSize: 'compact',
    allowedSizes: ['compact', 'medium'],
    audience: 'all',
    manifest: {
      schemaVersion: 1,
      owner: 'Digital Workplace Product',
      dataSource: 'DWP_ACTIVITY',
      freshnessSeconds: 30,
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
  MEMBER: ['announcements', 'focus', 'schedule', 'daily-brief', 'activity'],
  MANAGER: ['announcements', 'daily-brief', 'focus', 'schedule', 'activity'],
  OPERATOR: ['announcements', 'activity', 'daily-brief', 'focus', 'schedule'],
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
