import { describe, expect, it } from 'vitest';

import {
  commitHomeDraft,
  commitHomeDraftEdit,
  commitHomeDraftReset,
  createHomeDraftHistory,
  homeDraftChangeCount,
  isHomeDraftDirty,
  reapplyHomeDraft,
  redoHomeDraft,
  undoHomeDraft,
} from './home-draft-history';

import type { HomeDraft } from './home-draft-history';
import type { HomeAppDefinition } from '../../components/workspace-composer/app-launchpad-model';

function draft(presentation: HomeDraft['presentation'] = 'balanced'): HomeDraft {
  return {
    presentation,
    resetIntent: false,
    appLayout: {
      version: 1,
      groups: { work: ['dwp-work'], connect: [], services: [], systems: [] },
      folders: {},
      hiddenAppIds: [],
    },
    widgets: [
      { widgetKey: 'command-rail', visible: true, size: 'large', height: 'short' },
      { widgetKey: 'schedule', visible: true, size: 'quarter', height: 'standard' },
    ],
  };
}

const entitledApps: HomeAppDefinition[] = [
  {
    id: 'dwp-work',
    name: 'Work',
    shortName: 'Work',
    description: 'Work app',
    groupId: 'work',
    route: '/work',
    iconKey: 'work',
    tone: 'blue',
    resourceKey: 'APP.DWP_WORK',
  },
  {
    id: 'calendar',
    name: 'Calendar',
    shortName: 'Calendar',
    description: 'Calendar app',
    groupId: 'connect',
    route: '/calendar',
    iconKey: 'calendar',
    tone: 'green',
    resourceKey: 'APP.CALENDAR',
  },
];

describe('home draft history', () => {
  it('supports ordered undo and redo without mutating the saved base', () => {
    const base = draft();
    const expressive = draft('expressive');
    const focused = draft('focused');
    const history = commitHomeDraft(
      commitHomeDraft(createHomeDraftHistory(base), expressive),
      focused
    );

    const undone = undoHomeDraft(history);
    expect(undone.present.presentation).toBe('expressive');
    expect(undoHomeDraft(undone).present.presentation).toBe('balanced');
    expect(redoHomeDraft(undone).present.presentation).toBe('focused');
    expect(base.presentation).toBe('balanced');
  });

  it('ignores identical commits and reports meaningful draft changes', () => {
    const base = draft();
    const history = createHomeDraftHistory(base);
    expect(commitHomeDraft(history, draft())).toBe(history);

    const changed: HomeDraft = {
      ...draft('focused'),
      appLayout: { ...base.appLayout, hiddenAppIds: ['dwp-work'] },
      widgets: base.widgets.map((widget) =>
        widget.widgetKey === 'schedule' ? { ...widget, visible: false } : widget
      ),
    };
    expect(isHomeDraftDirty(base, changed)).toBe(true);
    expect(homeDraftChangeCount(base, changed)).toBe(3);
  });

  it('tracks reset through undo and redo and clears it after another edit', () => {
    const base = draft('expressive');
    const reset = commitHomeDraftReset(createHomeDraftHistory(base), draft('balanced'));

    expect(reset.present.resetIntent).toBe(true);
    expect(undoHomeDraft(reset).present.resetIntent).toBe(false);
    expect(redoHomeDraft(undoHomeDraft(reset)).present.resetIntent).toBe(true);

    const edited = commitHomeDraftEdit(reset, {
      ...reset.present,
      presentation: 'focused',
    });
    expect(edited.present.resetIntent).toBe(false);
    expect(isHomeDraftDirty(base, edited.present)).toBe(true);
  });

  it('reapplies local widget changes without overwriting untouched concurrent changes', () => {
    const base = draft();
    const local: HomeDraft = {
      ...base,
      widgets: base.widgets.map((widget) =>
        widget.widgetKey === 'schedule' ? { ...widget, visible: false } : widget
      ),
    };
    const latest: HomeDraft = {
      ...base,
      presentation: 'focused',
      appLayout: { ...base.appLayout, hiddenAppIds: ['calendar'] },
      widgets: base.widgets.map((widget) =>
        widget.widgetKey === 'command-rail'
          ? { ...widget, size: 'full' }
          : { ...widget, size: 'medium', height: 'tall' }
      ),
    };

    expect(reapplyHomeDraft(base, local, latest, entitledApps)).toEqual({
      ...latest,
      widgets: [
        { widgetKey: 'command-rail', visible: true, size: 'full', height: 'short' },
        { widgetKey: 'schedule', visible: false, size: 'medium', height: 'tall' },
      ],
    });
  });

  it('keeps a local order while retaining widgets added concurrently', () => {
    const original = draft();
    const base: HomeDraft = {
      ...original,
      widgets: [
        ...original.widgets,
        { widgetKey: 'activity', visible: true, size: 'quarter', height: 'standard' },
      ],
    };
    const local: HomeDraft = {
      ...base,
      widgets: [base.widgets[1]!, base.widgets[0]!, base.widgets[2]!],
    };
    const latest: HomeDraft = {
      ...base,
      widgets: [
        base.widgets[0]!,
        { widgetKey: 'focus', visible: true, size: 'medium', height: 'standard' },
        base.widgets[1]!,
        base.widgets[2]!,
      ],
    };

    expect(
      reapplyHomeDraft(base, local, latest, entitledApps).widgets.map((widget) => widget.widgetKey)
    ).toEqual(['schedule', 'command-rail', 'focus', 'activity']);
  });

  it('converts a conflicted reset into a non-destructive merged draft', () => {
    const base = draft();
    const local = { ...base, presentation: 'focused' as const, resetIntent: true };
    const latest = { ...base, appLayout: { ...base.appLayout, hiddenAppIds: ['calendar'] } };

    const merged = reapplyHomeDraft(base, local, latest, entitledApps);
    expect(merged.resetIntent).toBe(false);
    expect(merged.presentation).toBe('focused');
    expect(merged.appLayout.hiddenAppIds).toEqual(['calendar']);
  });

  it('keeps disjoint local and concurrent app placement changes', () => {
    const original = draft();
    const base: HomeDraft = {
      ...original,
      appLayout: {
        ...original.appLayout,
        groups: { ...original.appLayout.groups, connect: ['calendar'] },
      },
    };
    const local: HomeDraft = {
      ...base,
      appLayout: {
        ...base.appLayout,
        groups: { ...base.appLayout.groups, work: [] },
        hiddenAppIds: ['dwp-work'],
      },
    };
    const latest: HomeDraft = {
      ...base,
      appLayout: {
        ...base.appLayout,
        groups: { ...base.appLayout.groups, connect: [] },
        hiddenAppIds: ['calendar'],
      },
    };

    const merged = reapplyHomeDraft(base, local, latest, entitledApps);
    expect(merged.appLayout.groups.work).toEqual([]);
    expect(merged.appLayout.groups.connect).toEqual([]);
    expect(merged.appLayout.hiddenAppIds).toEqual(['calendar', 'dwp-work']);
  });

  it('preserves a concurrent same-group reorder when a different app is hidden locally', () => {
    const apps = [
      entitledApps[0]!,
      { ...entitledApps[1]!, groupId: 'work' },
      {
        ...entitledApps[0]!,
        id: 'activity',
        name: 'Activity',
        shortName: 'Activity',
        resourceKey: 'APP.ACTIVITY',
      },
    ];
    const original = draft();
    const base: HomeDraft = {
      ...original,
      appLayout: {
        version: 1,
        groups: { work: ['dwp-work', 'calendar', 'activity'] },
        folders: {},
        hiddenAppIds: [],
      },
    };
    const local: HomeDraft = {
      ...base,
      appLayout: {
        ...base.appLayout,
        groups: { work: ['dwp-work', 'calendar'] },
        hiddenAppIds: ['activity'],
      },
    };
    const latest: HomeDraft = {
      ...base,
      appLayout: {
        ...base.appLayout,
        groups: { work: ['calendar', 'dwp-work', 'activity'] },
      },
    };

    const merged = reapplyHomeDraft(base, local, latest, apps);
    expect(merged.appLayout.groups.work).toEqual(['calendar', 'dwp-work']);
    expect(merged.appLayout.hiddenAppIds).toEqual(['activity']);
  });

  it('preserves a concurrent folder rename and move during an unrelated local hide', () => {
    const apps = [
      entitledApps[0]!,
      entitledApps[1]!,
      {
        ...entitledApps[0]!,
        id: 'activity',
        name: 'Activity',
        shortName: 'Activity',
        resourceKey: 'APP.ACTIVITY',
      },
    ];
    const original = draft();
    const base: HomeDraft = {
      ...original,
      appLayout: {
        version: 1,
        groups: { work: ['focus-folder', 'activity'], connect: [] },
        folders: {
          'focus-folder': {
            id: 'focus-folder',
            name: 'Focus',
            groupId: 'work',
            appIds: ['dwp-work', 'calendar'],
          },
        },
        hiddenAppIds: [],
      },
    };
    const local: HomeDraft = {
      ...base,
      appLayout: {
        ...base.appLayout,
        groups: { ...base.appLayout.groups, work: ['focus-folder'] },
        hiddenAppIds: ['activity'],
      },
    };
    const latest: HomeDraft = {
      ...base,
      appLayout: {
        ...base.appLayout,
        groups: { work: ['activity'], connect: ['focus-folder'] },
        folders: {
          'focus-folder': {
            ...base.appLayout.folders['focus-folder']!,
            name: 'Deep focus',
            groupId: 'connect',
            appIds: ['calendar', 'dwp-work'],
          },
        },
      },
    };

    const merged = reapplyHomeDraft(base, local, latest, apps);
    expect(merged.appLayout.groups).toEqual({ work: [], connect: ['focus-folder'] });
    expect(merged.appLayout.folders['focus-folder']).toMatchObject({
      name: 'Deep focus',
      groupId: 'connect',
      appIds: ['calendar', 'dwp-work'],
    });
    expect(merged.appLayout.hiddenAppIds).toEqual(['activity']);
  });

  it('combines a local widget front move with the latest sibling reorder', () => {
    const widget = (
      widgetKey: HomeDraft['widgets'][number]['widgetKey'],
      visible = true
    ): HomeDraft['widgets'][number] => ({
      widgetKey,
      visible,
      size: 'quarter',
      height: 'standard',
    });
    const original = draft();
    const base: HomeDraft = {
      ...original,
      widgets: [
        widget('command-rail'),
        widget('daily-brief'),
        widget('focus'),
        widget('activity', false),
      ],
    };
    const local: HomeDraft = {
      ...base,
      widgets: [widget('activity'), widget('command-rail'), widget('daily-brief'), widget('focus')],
    };
    const latest: HomeDraft = {
      ...base,
      widgets: [
        widget('daily-brief'),
        widget('command-rail'),
        widget('focus'),
        widget('activity', false),
      ],
    };

    const merged = reapplyHomeDraft(base, local, latest, entitledApps);

    expect(merged.widgets.map(({ widgetKey }) => widgetKey)).toEqual([
      'activity',
      'daily-brief',
      'command-rail',
      'focus',
    ]);
    expect(merged.widgets[0]?.visible).toBe(true);
  });
});
