import { describe, expect, it } from 'vitest';

import {
  commitHomeDraft,
  commitHomeDraftEdit,
  commitHomeDraftReset,
  createHomeDraftHistory,
  homeDraftChangeCount,
  isHomeDraftDirty,
  redoHomeDraft,
  undoHomeDraft,
} from './home-draft-history';

import type { HomeDraft } from './home-draft-history';

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
});
