import { describe, expect, it } from 'vitest';

import {
  HOME_WIDGET_REGISTRY,
  defaultHomeWidgets,
  reconcileHomeWidgets,
  setHomeWidgetVisibility,
} from './home-widget-registry';
import { reorderWorkspaceWidgets } from '../../components/workspace-composer/workspace-composer-model';

describe('home widget registry', () => {
  it('restores registered widgets and keeps announcements visible', () => {
    const widgets = reconcileHomeWidgets([
      { widgetKey: 'activity', visible: false },
      { widgetKey: 'announcements', visible: false },
      { widgetKey: 'unknown', visible: true },
    ]);

    expect(widgets).toHaveLength(5);
    expect(widgets[0]).toEqual({ widgetKey: 'activity', visible: false, size: 'full' });
    expect(widgets.find((widget) => widget.widgetKey === 'announcements')?.visible).toBe(true);
  });

  it('moves widgets without mutating the source list', () => {
    const source = reconcileHomeWidgets(null);
    const moved = reorderWorkspaceWidgets(source, 'announcements', 'daily-brief');

    expect(moved[3].widgetKey).toBe('announcements');
    expect(source[0].widgetKey).toBe('announcements');
  });

  it('provides distinct governed defaults for each work audience', () => {
    expect(defaultHomeWidgets(undefined, 'MEMBER').map((widget) => widget.widgetKey)).toEqual([
      'announcements',
      'focus',
      'schedule',
      'daily-brief',
      'activity',
    ]);
    expect(defaultHomeWidgets(undefined, 'MANAGER').map((widget) => widget.widgetKey)).toEqual([
      'announcements',
      'daily-brief',
      'focus',
      'schedule',
      'activity',
    ]);
    expect(defaultHomeWidgets(undefined, 'OPERATOR').map((widget) => widget.widgetKey)).toEqual([
      'announcements',
      'activity',
      'daily-brief',
      'focus',
      'schedule',
    ]);
  });

  it('registers ownership, freshness, privacy, and analytics metadata for every widget', () => {
    const manifests = HOME_WIDGET_REGISTRY.map((widget) => widget.manifest);
    expect(manifests.every(Boolean)).toBe(true);
    expect(new Set(manifests.map((manifest) => manifest?.analyticsKey)).size).toBe(
      HOME_WIDGET_REGISTRY.length
    );
    expect(manifests.every((manifest) => (manifest?.freshnessSeconds ?? 0) > 0)).toBe(true);
  });

  it('hides personal widgets but keeps governed announcements visible', () => {
    const source = reconcileHomeWidgets(null);

    expect(setHomeWidgetVisibility(source, 'focus', false)).toContainEqual({
      widgetKey: 'focus',
      visible: false,
      size: 'large',
    });
    expect(
      setHomeWidgetVisibility(source, 'announcements', false).find(
        (widget) => widget.widgetKey === 'announcements'
      )?.visible
    ).toBe(true);
  });
});
