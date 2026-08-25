import { describe, expect, it } from 'vitest';

import {
  resolveWorkspaceWidgetDropOutcome,
  resolveWorkspaceWidgetDropTarget,
} from './workspace-widget-canvas';

describe('workspace widget drop policy', () => {
  it('does not commit a stale preview target after returning to the origin', () => {
    expect(resolveWorkspaceWidgetDropTarget('schedule', 'schedule', 'activity')).toBeNull();
    expect(resolveWorkspaceWidgetDropTarget('schedule', null, 'activity')).toBeNull();
  });

  it('commits the preview target while the pointer remains over another widget', () => {
    expect(resolveWorkspaceWidgetDropTarget('schedule', 'activity', 'activity')).toBe('activity');
  });

  it('announces the final position of the moved widget rather than the target index', () => {
    const keys = ['a', 'b', 'c'] as const;

    expect(resolveWorkspaceWidgetDropOutcome(keys, 'a', 'c', 'c')).toEqual({
      moved: true,
      position: 3,
    });
    expect(resolveWorkspaceWidgetDropOutcome(keys, 'c', 'a', 'a')).toEqual({
      moved: true,
      position: 1,
    });
  });

  it('announces a return when the drag ends at its origin or outside the canvas', () => {
    const keys = ['a', 'b', 'c'] as const;

    expect(resolveWorkspaceWidgetDropOutcome(keys, 'a', 'a', 'c')).toEqual({
      moved: false,
      position: 1,
    });
    expect(resolveWorkspaceWidgetDropOutcome(keys, 'a', null, 'c')).toEqual({
      moved: false,
      position: 1,
    });
  });
});
