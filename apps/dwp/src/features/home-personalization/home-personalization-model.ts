import type {
  HomeComposerChange,
  HomeDeviceClass,
  HomeDeviceLayout,
  HomeDeviceLayoutOverlay,
  HomeView,
} from '@dwp-frontend/shared-utils';

export type HomeStudioSection =
  'profiles' | 'appearance' | 'content' | 'device' | 'templates' | 'history' | 'ai';
export type HomeWorkstyleIntent = 'FOCUS_DEADLINES' | 'BALANCE_DAY' | 'REDUCE_NOISE';

const FIXED_WIDGET_KEYS = new Set(['my-app-dock', 'announcements', 'now']);

export function createHomeViewKey(name: string, occupiedKeys: readonly string[]): string {
  const normalized = name
    .normalize('NFKC')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  const base = normalized || 'my-home';
  const occupied = new Set(occupiedKeys);
  if (!occupied.has(base)) return base;
  for (let suffix = 2; suffix <= 99; suffix += 1) {
    const candidate = `${base.slice(0, 45)}-${suffix}`;
    if (!occupied.has(candidate)) return candidate;
  }
  return `${base.slice(0, 38)}-${Date.now().toString(36)}`;
}

export function activeHomeView(views: readonly HomeView[]): HomeView | null {
  return views.find((view) => view.isDefault) ?? views[0] ?? null;
}

export function homeDeviceOverlay(
  layouts: readonly HomeDeviceLayout[],
  deviceClass: HomeDeviceClass
): HomeDeviceLayoutOverlay {
  return (
    layouts.find((layout) => layout.deviceClass === deviceClass)?.overlay ?? {
      widgetOrder: [],
      widgetSizes: {},
      density: 'comfortable',
    }
  );
}

export function buildWorkstyleChanges(
  view: HomeView,
  intent: HomeWorkstyleIntent
): HomeComposerChange[] {
  const movableSlots = view.layout.widgets
    .map((widget, index) => ({ widget, index }))
    .filter(({ widget }) => widget.visible && !FIXED_WIDGET_KEYS.has(widget.widgetKey))
    .map(({ index }) => index);
  const find = (key: string) =>
    view.layout.widgets.findIndex((widget) => widget.visible && widget.widgetKey === key);
  const changes: HomeComposerChange[] = [];

  if (intent === 'FOCUS_DEADLINES') {
    const scheduleIndex = find('schedule');
    const firstMovableIndex = movableSlots[0];
    if (
      scheduleIndex >= 0 &&
      firstMovableIndex !== undefined &&
      scheduleIndex > firstMovableIndex
    ) {
      changes.push({
        operation: 'MOVE_WIDGET',
        widgetKey: 'schedule',
        beforeIndex: scheduleIndex,
        afterIndex: firstMovableIndex,
      });
    }
    const focus = view.layout.widgets.find((widget) => widget.widgetKey === 'focus');
    if (focus && !focus.visible) changes.push({ operation: 'SHOW_WIDGET', widgetKey: 'focus' });
    if (view.layout.presentation !== 'focused') {
      changes.push({ operation: 'SET_DENSITY', value: 'focused' });
    }
  }

  if (intent === 'BALANCE_DAY') {
    if (view.layout.presentation !== 'balanced') {
      changes.push({ operation: 'SET_DENSITY', value: 'balanced' });
    }
  }

  if (intent === 'REDUCE_NOISE') {
    const activity = view.layout.widgets.find((widget) => widget.widgetKey === 'activity');
    if (activity?.visible) changes.push({ operation: 'HIDE_WIDGET', widgetKey: 'activity' });
    if (view.layout.presentation !== 'focused') {
      changes.push({ operation: 'SET_DENSITY', value: 'focused' });
    }
  }

  return changes;
}

export function isFixedZoneChange(change: HomeComposerChange): boolean {
  return Boolean(change.widgetKey && FIXED_WIDGET_KEYS.has(change.widgetKey));
}
