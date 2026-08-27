import { describe, expect, it } from 'vitest';
import { Activity, ContactRound, UsersRound } from 'lucide-react';

import {
  defaultWorkspaceWidgets,
  moveWorkspaceWidget,
  reconcileWorkspaceWidgets,
  reorderWorkspaceWidgets,
  setWorkspaceWidgetHeight,
  setWorkspaceWidgetSize,
  setWorkspaceWidgetVisibility,
  visibleWorkspaceRegistry,
} from './workspace-composer-model';

import type { WorkspaceWidgetDefinition } from './workspace-composer-model';

type Key = 'attention' | 'profile' | 'team';

const registry: readonly WorkspaceWidgetDefinition<Key>[] = [
  {
    key: 'attention',
    icon: Activity,
    canHide: false,
    defaultSize: 'large',
    allowedSizes: ['medium', 'large', 'full'],
    defaultHeight: 'tall',
    allowedHeights: ['standard', 'tall', 'expanded'],
  },
  {
    key: 'profile',
    icon: ContactRound,
    canHide: true,
    defaultSize: 'compact',
    allowedSizes: ['compact', 'medium'],
    defaultHeight: 'short',
    allowedHeights: ['short', 'standard'],
  },
  {
    key: 'team',
    icon: UsersRound,
    canHide: true,
    defaultSize: 'full',
    allowedSizes: ['medium', 'large', 'full'],
    defaultHeight: 'standard',
    allowedHeights: ['standard', 'tall'],
    audience: 'manager',
  },
];

describe('workspace composer model', () => {
  it('reconciles versioned preferences and restores new registry widgets', () => {
    expect(
      reconcileWorkspaceWidgets(
        [
          { widgetKey: 'profile', visible: false, size: 'full', height: 'expanded' },
          { widgetKey: 'unknown', visible: true, size: 'full' },
        ],
        registry
      )
    ).toEqual([
      { widgetKey: 'profile', visible: false, size: 'compact', height: 'short' },
      { widgetKey: 'attention', visible: true, size: 'large', height: 'tall' },
      { widgetKey: 'team', visible: true, size: 'full', height: 'standard' },
    ]);
  });

  it('supports immutable reorder, hide, and constrained resize operations', () => {
    const defaults = defaultWorkspaceWidgets(registry);
    expect(reorderWorkspaceWidgets(defaults, 'team', 'attention')[0]?.widgetKey).toBe('team');
    expect(setWorkspaceWidgetVisibility(defaults, registry, 'attention', false)).toEqual(defaults);
    expect(setWorkspaceWidgetVisibility(defaults, registry, 'profile', false)[1]?.visible).toBe(
      false
    );
    expect(setWorkspaceWidgetSize(defaults, registry, 'profile', 'full')).toEqual(defaults);
    expect(setWorkspaceWidgetSize(defaults, registry, 'profile', 'medium')[1]?.size).toBe('medium');
    expect(setWorkspaceWidgetHeight(defaults, registry, 'profile', 'expanded')).toEqual(defaults);
    expect(setWorkspaceWidgetHeight(defaults, registry, 'profile', 'standard')[1]?.height).toBe(
      'standard'
    );
    expect(moveWorkspaceWidget(defaults, 'team', -1).map((widget) => widget.widgetKey)).toEqual([
      'attention',
      'team',
      'profile',
    ]);
    expect(moveWorkspaceWidget(defaults, 'attention', -1)).toEqual(defaults);
  });

  it('adds a missing registered widget with its safe defaults without mutating the draft', () => {
    const draft = [{ widgetKey: 'profile' as const, visible: true, size: 'compact' as const }];

    expect(setWorkspaceWidgetVisibility(draft, registry, 'team', true)).toEqual([
      { widgetKey: 'profile', visible: true, size: 'compact' },
      { widgetKey: 'team', visible: true, size: 'full', height: 'standard' },
    ]);
    expect(draft).toEqual([{ widgetKey: 'profile', visible: true, size: 'compact' }]);
  });

  it('filters the catalog by runtime audience without changing persisted data', () => {
    expect(
      visibleWorkspaceRegistry(registry, { isManager: false, canOperate: false })
    ).toHaveLength(2);
    expect(visibleWorkspaceRegistry(registry, { isManager: true, canOperate: false })).toHaveLength(
      3
    );
  });
});
