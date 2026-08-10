import { Activity, CalendarDays, CheckCircle2, Megaphone, Sparkles } from 'lucide-react';

import type { LucideIcon } from 'lucide-react';
import type { HomeWidgetKey, HomeWidgetPreference } from '@dwp-frontend/shared-utils';

export type HomeWidgetDefinition = {
  key: HomeWidgetKey;
  label: string;
  description: string;
  icon: LucideIcon;
  canHide: boolean;
};

export const HOME_WIDGET_REGISTRY: readonly HomeWidgetDefinition[] = [
  {
    key: 'announcements',
    label: 'Announcements',
    description: 'Official and time-sensitive organization updates',
    icon: Megaphone,
    canHide: false,
  },
  {
    key: 'daily-brief',
    label: 'Daily brief',
    description: 'AI-grounded priorities and day rhythm',
    icon: Sparkles,
    canHide: true,
  },
  {
    key: 'focus',
    label: 'Focus now',
    description: 'Priority work and approvals',
    icon: CheckCircle2,
    canHide: true,
  },
  {
    key: 'schedule',
    label: 'Schedule',
    description: 'Meetings, focus time, and deadlines',
    icon: CalendarDays,
    canHide: true,
  },
  {
    key: 'activity',
    label: 'Live activity',
    description: 'Human, system, and agent events',
    icon: Activity,
    canHide: true,
  },
];

export function defaultHomeWidgets(): HomeWidgetPreference[] {
  return HOME_WIDGET_REGISTRY.map((widget) => ({ widgetKey: widget.key, visible: true }));
}

export function reconcileHomeWidgets(value: unknown): HomeWidgetPreference[] {
  if (!Array.isArray(value)) return defaultHomeWidgets();
  const definitions = new Map(HOME_WIDGET_REGISTRY.map((widget) => [widget.key, widget]));
  const used = new Set<HomeWidgetKey>();
  const reconciled: HomeWidgetPreference[] = [];

  value.forEach((candidate) => {
    if (!candidate || typeof candidate !== 'object') return;
    const item = candidate as Partial<HomeWidgetPreference>;
    const definition = definitions.get(item.widgetKey as HomeWidgetKey);
    if (!definition || used.has(definition.key)) return;
    used.add(definition.key);
    reconciled.push({
      widgetKey: definition.key,
      visible: definition.canHide ? item.visible !== false : true,
    });
  });

  HOME_WIDGET_REGISTRY.forEach((definition) => {
    if (!used.has(definition.key)) {
      reconciled.push({ widgetKey: definition.key, visible: true });
    }
  });
  return reconciled;
}

export function moveHomeWidget(
  widgets: readonly HomeWidgetPreference[],
  index: number,
  offset: -1 | 1
): HomeWidgetPreference[] {
  const target = index + offset;
  if (index < 0 || index >= widgets.length || target < 0 || target >= widgets.length) {
    return [...widgets];
  }
  const next = [...widgets];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
