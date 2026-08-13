import { describe, expect, it } from 'vitest';
import { Activity, ContactRound, UsersRound } from 'lucide-react';

import {
  defaultWorkspaceWidgets,
  reconcileWorkspaceWidgets,
  reorderWorkspaceWidgets,
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
  },
  {
    key: 'profile',
    icon: ContactRound,
    canHide: true,
    defaultSize: 'compact',
    allowedSizes: ['compact', 'medium'],
  },
  {
    key: 'team',
    icon: UsersRound,
    canHide: true,
    defaultSize: 'full',
    allowedSizes: ['medium', 'large', 'full'],
    audience: 'manager',
  },
];

describe('workspace composer model', () => {
  it('reconciles versioned preferences and restores new registry widgets', () => {
    expect(
      reconcileWorkspaceWidgets(
        [
          { widgetKey: 'profile', visible: false, size: 'full' },
          { widgetKey: 'unknown', visible: true, size: 'full' },
        ],
        registry
      )
    ).toEqual([
      { widgetKey: 'profile', visible: false, size: 'compact' },
      { widgetKey: 'attention', visible: true, size: 'large' },
      { widgetKey: 'team', visible: true, size: 'full' },
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
