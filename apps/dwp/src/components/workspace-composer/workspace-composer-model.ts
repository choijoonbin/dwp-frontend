import type {
  HomePresentation,
  HomeWidgetHeight,
  HomeWidgetSize,
  PersonalHomeWidgetPreference,
} from '@dwp-frontend/shared-utils';

export type WorkspaceWidgetAudience = 'all' | 'manager' | 'operator';

export type WorkspaceWidgetManifest = {
  schemaVersion: 1;
  owner: string;
  dataSource: string;
  freshnessSeconds: number;
  privacyClass: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL';
  retention: 'NONE' | 'SESSION' | 'PREFERENCE_ONLY';
  analyticsKey: string;
};

export type WorkspaceWidgetDefinition<WidgetKey extends string> = {
  key: WidgetKey;
  icon: React.ComponentType<{
    size?: number;
    strokeWidth?: number;
    'aria-hidden'?: React.AriaAttributes['aria-hidden'];
  }>;
  canHide: boolean;
  defaultSize: HomeWidgetSize;
  allowedSizes: readonly HomeWidgetSize[];
  defaultHeight: HomeWidgetHeight;
  allowedHeights: readonly HomeWidgetHeight[];
  surface?: 'card' | 'plain';
  audience?: WorkspaceWidgetAudience;
  manifest?: WorkspaceWidgetManifest;
};

export const HOME_PRESENTATIONS: readonly HomePresentation[] = [
  'balanced',
  'expressive',
  'focused',
];

export function defaultWorkspaceWidgets<WidgetKey extends string>(
  registry: readonly WorkspaceWidgetDefinition<WidgetKey>[]
): PersonalHomeWidgetPreference<WidgetKey>[] {
  return registry.map((widget) => ({
    widgetKey: widget.key,
    visible: true,
    size: widget.defaultSize,
    height: widget.defaultHeight,
  }));
}

export function reconcileWorkspaceWidgets<WidgetKey extends string>(
  value: unknown,
  registry: readonly WorkspaceWidgetDefinition<WidgetKey>[]
): PersonalHomeWidgetPreference<WidgetKey>[] {
  if (!Array.isArray(value)) return defaultWorkspaceWidgets(registry);
  const definitions = new Map(registry.map((widget) => [widget.key, widget]));
  const used = new Set<WidgetKey>();
  const reconciled: PersonalHomeWidgetPreference<WidgetKey>[] = [];

  value.forEach((candidate) => {
    if (!candidate || typeof candidate !== 'object') return;
    const item = candidate as Partial<PersonalHomeWidgetPreference<WidgetKey>>;
    const definition = definitions.get(item.widgetKey as WidgetKey);
    if (!definition || used.has(definition.key)) return;
    used.add(definition.key);
    reconciled.push({
      widgetKey: definition.key,
      visible: definition.canHide ? item.visible !== false : true,
      size: definition.allowedSizes.includes(item.size as HomeWidgetSize)
        ? item.size
        : definition.defaultSize,
      height: definition.allowedHeights.includes(item.height as HomeWidgetHeight)
        ? item.height
        : definition.defaultHeight,
    });
  });

  registry.forEach((definition) => {
    if (used.has(definition.key)) return;
    reconciled.push({
      widgetKey: definition.key,
      visible: true,
      size: definition.defaultSize,
      height: definition.defaultHeight,
    });
  });
  return reconciled;
}

export function reorderWorkspaceWidgets<WidgetKey extends string>(
  widgets: readonly PersonalHomeWidgetPreference<WidgetKey>[],
  activeKey: WidgetKey,
  overKey: WidgetKey
): PersonalHomeWidgetPreference<WidgetKey>[] {
  const activeIndex = widgets.findIndex((widget) => widget.widgetKey === activeKey);
  const overIndex = widgets.findIndex((widget) => widget.widgetKey === overKey);
  if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) return [...widgets];
  const next = [...widgets];
  const [active] = next.splice(activeIndex, 1);
  if (!active) return [...widgets];
  next.splice(overIndex, 0, active);
  return next;
}

export function moveWorkspaceWidget<WidgetKey extends string>(
  widgets: readonly PersonalHomeWidgetPreference<WidgetKey>[],
  widgetKey: WidgetKey,
  direction: -1 | 1
): PersonalHomeWidgetPreference<WidgetKey>[] {
  const visibleKeys = widgets.filter((widget) => widget.visible).map((widget) => widget.widgetKey);
  const visibleIndex = visibleKeys.indexOf(widgetKey);
  const targetKey = visibleKeys[visibleIndex + direction];
  if (visibleIndex < 0 || !targetKey) return [...widgets];
  return reorderWorkspaceWidgets(widgets, widgetKey, targetKey);
}

export function setWorkspaceWidgetVisibility<WidgetKey extends string>(
  widgets: readonly PersonalHomeWidgetPreference<WidgetKey>[],
  registry: readonly WorkspaceWidgetDefinition<WidgetKey>[],
  widgetKey: WidgetKey,
  visible: boolean
): PersonalHomeWidgetPreference<WidgetKey>[] {
  const definition = registry.find((widget) => widget.key === widgetKey);
  if (!definition || (!definition.canHide && !visible)) return [...widgets];
  const existing = widgets.some((widget) => widget.widgetKey === widgetKey);
  if (visible && !existing) {
    return [
      ...widgets,
      {
        widgetKey: definition.key,
        visible: true,
        size: definition.defaultSize,
        height: definition.defaultHeight,
      },
    ];
  }
  const eligibleKeys = new Set(registry.map((widget) => widget.key));
  if (
    !visible &&
    widgets.filter((widget) => widget.visible && eligibleKeys.has(widget.widgetKey)).length <= 1
  ) {
    return [...widgets];
  }
  return widgets.map((widget) =>
    widget.widgetKey === widgetKey ? { ...widget, visible } : widget
  );
}

export function setWorkspaceWidgetSize<WidgetKey extends string>(
  widgets: readonly PersonalHomeWidgetPreference<WidgetKey>[],
  registry: readonly WorkspaceWidgetDefinition<WidgetKey>[],
  widgetKey: WidgetKey,
  size: HomeWidgetSize
): PersonalHomeWidgetPreference<WidgetKey>[] {
  const definition = registry.find((widget) => widget.key === widgetKey);
  if (!definition?.allowedSizes.includes(size)) return [...widgets];
  return widgets.map((widget) => (widget.widgetKey === widgetKey ? { ...widget, size } : widget));
}

export function setWorkspaceWidgetHeight<WidgetKey extends string>(
  widgets: readonly PersonalHomeWidgetPreference<WidgetKey>[],
  registry: readonly WorkspaceWidgetDefinition<WidgetKey>[],
  widgetKey: WidgetKey,
  height: HomeWidgetHeight
): PersonalHomeWidgetPreference<WidgetKey>[] {
  const definition = registry.find((widget) => widget.key === widgetKey);
  if (!definition?.allowedHeights.includes(height)) return [...widgets];
  return widgets.map((widget) => (widget.widgetKey === widgetKey ? { ...widget, height } : widget));
}

export function visibleWorkspaceRegistry<WidgetKey extends string>(
  registry: readonly WorkspaceWidgetDefinition<WidgetKey>[],
  access: { isManager: boolean; canOperate: boolean }
): WorkspaceWidgetDefinition<WidgetKey>[] {
  return registry.filter(
    (widget) =>
      !widget.audience ||
      widget.audience === 'all' ||
      (widget.audience === 'manager' && access.isManager) ||
      (widget.audience === 'operator' && access.canOperate)
  );
}
