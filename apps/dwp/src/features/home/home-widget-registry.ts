import { Activity, CalendarDays, CheckCircle2, Megaphone, Sparkles } from 'lucide-react';

import type { LucideIcon } from 'lucide-react';
import type { HomeWidgetKey, HomeWidgetPreference } from '@dwp-frontend/shared-utils';

export type HomeWidgetDefinition = {
  key: HomeWidgetKey;
  label: string;
  description: string;
  icon: LucideIcon;
  canHide: boolean;
  desktopSpan: 3 | 6 | 12;
};

export const HOME_WIDGET_REGISTRY: readonly HomeWidgetDefinition[] = [
  {
    key: 'announcements',
    label: 'Announcements',
    description: 'Official and time-sensitive organization updates',
    icon: Megaphone,
    canHide: false,
    desktopSpan: 12,
  },
  {
    key: 'daily-brief',
    label: 'Daily brief',
    description: 'Live work priorities and day rhythm',
    icon: Sparkles,
    canHide: true,
    desktopSpan: 12,
  },
  {
    key: 'focus',
    label: 'Focus now',
    description: 'Priority work and approvals',
    icon: CheckCircle2,
    canHide: true,
    desktopSpan: 6,
  },
  {
    key: 'schedule',
    label: 'Schedule',
    description: 'Meetings, focus time, and deadlines',
    icon: CalendarDays,
    canHide: true,
    desktopSpan: 3,
  },
  {
    key: 'activity',
    label: 'Live activity',
    description: 'Human, system, and agent events',
    icon: Activity,
    canHide: true,
    desktopSpan: 3,
  },
];

export const HOME_WIDGET_KEYS: readonly HomeWidgetKey[] = HOME_WIDGET_REGISTRY.map(
  (widget) => widget.key
);

export function defaultHomeWidgets(
  registeredOrder: readonly HomeWidgetKey[] = HOME_WIDGET_KEYS
): HomeWidgetPreference[] {
  return registeredOrder.map((widgetKey) => ({ widgetKey, visible: true }));
}

export function reconcileHomeWidgets(
  value: unknown,
  registeredOrder: readonly HomeWidgetKey[] = HOME_WIDGET_KEYS
): HomeWidgetPreference[] {
  if (!Array.isArray(value)) return defaultHomeWidgets(registeredOrder);
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

  registeredOrder.forEach((widgetKey) => {
    const definition = definitions.get(widgetKey);
    if (!definition) return;
    if (!used.has(definition.key)) {
      reconciled.push({ widgetKey: definition.key, visible: true });
    }
  });
  return reconciled;
}

export function reorderHomeWidgets(
  widgets: readonly HomeWidgetPreference[],
  activeKey: HomeWidgetKey,
  overKey: HomeWidgetKey
): HomeWidgetPreference[] {
  const activeIndex = widgets.findIndex((widget) => widget.widgetKey === activeKey);
  const overIndex = widgets.findIndex((widget) => widget.widgetKey === overKey);
  if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) {
    return [...widgets];
  }
  const next = [...widgets];
  const [active] = next.splice(activeIndex, 1);
  if (!active) return [...widgets];
  next.splice(overIndex, 0, active);
  return next;
}

export function setHomeWidgetVisibility(
  widgets: readonly HomeWidgetPreference[],
  widgetKey: HomeWidgetKey,
  visible: boolean
): HomeWidgetPreference[] {
  const definition = HOME_WIDGET_REGISTRY.find((widget) => widget.key === widgetKey);
  if (!definition || (!definition.canHide && !visible)) return [...widgets];
  return widgets.map((widget) =>
    widget.widgetKey === widgetKey ? { ...widget, visible } : widget
  );
}
