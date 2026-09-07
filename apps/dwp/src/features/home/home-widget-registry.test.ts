import { describe, expect, it } from 'vitest';

import {
  HOME_WIDGET_REGISTRY,
  defaultHomeWidgets,
  homeWidgetLifecyclePolicy,
  reconcileHomeWidgets,
  setHomeWidgetVisibility,
} from './home-widget-registry';
import { reorderWorkspaceWidgets } from '../../components/workspace-composer/workspace-composer-model';

describe('home widget registry', () => {
  it('fails closed for blocked lifecycle and preserves deprecated instances without new placement', () => {
    expect(homeWidgetLifecyclePolicy('ACTIVE')).toEqual({
      renderExisting: true,
      allowNewPlacement: true,
      allowRestore: true,
    });
    expect(homeWidgetLifecyclePolicy('DEPRECATED')).toEqual({
      renderExisting: true,
      allowNewPlacement: false,
      allowRestore: false,
    });
    expect(homeWidgetLifecyclePolicy('BLOCKED')).toEqual({
      renderExisting: false,
      allowNewPlacement: false,
      allowRestore: false,
    });
  });

  it('restores personal widgets and drops fixed-zone or unknown preferences', () => {
    const widgets = reconcileHomeWidgets([
      { widgetKey: 'activity', visible: false },
      { widgetKey: 'announcements', visible: false },
      { widgetKey: 'unknown', visible: true },
    ]);

    expect(widgets).toHaveLength(7);
    expect(widgets[0]).toEqual({
      widgetKey: 'activity',
      visible: false,
      size: 'quarter',
      height: 'tall',
    });
    expect(widgets.map((widget) => widget.widgetKey)).not.toContain('announcements');
  });

  it('moves widgets without mutating the source list', () => {
    const source = reconcileHomeWidgets(null);
    const moved = reorderWorkspaceWidgets(source, 'activity', 'daily-brief');

    expect(moved[2].widgetKey).toBe('activity');
    expect(source[0].widgetKey).toBe('command-rail');
  });

  it('provides distinct governed defaults for each work audience', () => {
    expect(defaultHomeWidgets(undefined, 'MEMBER').map((widget) => widget.widgetKey)).toEqual([
      'command-rail',
      'schedule',
      'daily-brief',
      'focus',
      'activity',
      'focus-balance',
      'meeting-load',
    ]);
    expect(defaultHomeWidgets(undefined, 'MANAGER').map((widget) => widget.widgetKey)).toEqual([
      'command-rail',
      'schedule',
      'daily-brief',
      'focus',
      'activity',
      'focus-balance',
      'meeting-load',
    ]);
    expect(defaultHomeWidgets(undefined, 'OPERATOR').map((widget) => widget.widgetKey)).toEqual([
      'command-rail',
      'activity',
      'schedule',
      'daily-brief',
      'focus',
      'meeting-load',
      'focus-balance',
    ]);
  });

  it('keeps client widget sizes aligned with the workspace-home server contract', () => {
    expect(
      HOME_WIDGET_REGISTRY.map(
        ({ key, defaultSize, allowedSizes, defaultHeight, allowedHeights }) => ({
          key,
          defaultSize,
          allowedSizes,
          defaultHeight,
          allowedHeights,
        })
      )
    ).toEqual([
      {
        key: 'command-rail',
        defaultSize: 'large',
        allowedSizes: ['large', 'full'],
        defaultHeight: 'short',
        allowedHeights: ['short', 'standard'],
      },
      {
        key: 'daily-brief',
        defaultSize: 'full',
        allowedSizes: ['compact', 'large', 'full'],
        defaultHeight: 'standard',
        allowedHeights: ['short', 'standard', 'tall'],
      },
      {
        key: 'focus',
        defaultSize: 'medium',
        allowedSizes: ['quarter', 'compact', 'medium', 'large', 'full'],
        defaultHeight: 'tall',
        allowedHeights: ['short', 'standard', 'tall', 'expanded'],
      },
      {
        key: 'schedule',
        defaultSize: 'quarter',
        allowedSizes: ['fifth', 'quarter', 'compact', 'medium'],
        defaultHeight: 'standard',
        allowedHeights: ['short', 'standard', 'tall'],
      },
      {
        key: 'activity',
        defaultSize: 'quarter',
        allowedSizes: ['fifth', 'quarter', 'compact', 'medium'],
        defaultHeight: 'tall',
        allowedHeights: ['short', 'standard', 'tall'],
      },
      {
        key: 'focus-balance',
        defaultSize: 'medium',
        allowedSizes: ['quarter', 'compact', 'medium'],
        defaultHeight: 'short',
        allowedHeights: ['short', 'standard'],
      },
      {
        key: 'meeting-load',
        defaultSize: 'medium',
        allowedSizes: ['quarter', 'compact', 'medium'],
        defaultHeight: 'short',
        allowedHeights: ['short', 'standard'],
      },
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

  it('hides personal widgets without changing their governed default size', () => {
    const source = reconcileHomeWidgets(null);

    expect(setHomeWidgetVisibility(source, 'focus', false)).toContainEqual({
      widgetKey: 'focus',
      visible: false,
      size: 'medium',
      height: 'tall',
    });
  });

  it('adds a registered widget that is not yet present in the current view', () => {
    expect(setHomeWidgetVisibility([], 'schedule', true)).toEqual([
      {
        widgetKey: 'schedule',
        visible: true,
        size: 'quarter',
        height: 'standard',
      },
    ]);
  });
});
