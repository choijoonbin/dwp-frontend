import { describe, expect, it, vi } from 'vitest';

import {
  activeHomeView,
  buildWorkstyleChanges,
  createHomeViewKey,
  isFixedZoneChange,
} from './home-personalization-model';

import type { HomeView } from '@dwp-frontend/shared-utils';

function view(widgets: HomeView['layout']['widgets']): HomeView {
  return {
    viewId: 'view-1',
    viewKey: 'default',
    surfaceKey: 'workspace-home',
    name: 'Default',
    isDefault: true,
    schemaVersion: 1,
    layout: { appLayout: null, presentation: 'balanced', widgets },
    version: 1,
    createdAt: '2026-08-21T00:00:00Z',
    updatedAt: '2026-08-21T00:00:00Z',
    widgetConfigurations: {},
  };
}

describe('home personalization model', () => {
  it('creates a stable collision-free key', () => {
    expect(createHomeViewKey('나의 집중 홈', [])).toBe('my-home');
    expect(createHomeViewKey('Focus Time', ['focus-time'])).toBe('focus-time-2');
  });

  it('falls back to the first view when a migrated set has no active marker', () => {
    const first = { ...view([]), isDefault: false };
    expect(activeHomeView([first])?.viewId).toBe('view-1');
  });

  it('builds a previewable focus proposal without fixed-zone changes', () => {
    const changes = buildWorkstyleChanges(
      view([
        { widgetKey: 'command-rail', visible: true },
        { widgetKey: 'activity', visible: true },
        { widgetKey: 'schedule', visible: true },
        { widgetKey: 'focus', visible: false },
      ]),
      'FOCUS_DEADLINES'
    );

    expect(changes).toContainEqual(
      expect.objectContaining({ operation: 'MOVE_WIDGET', widgetKey: 'schedule', afterIndex: 0 })
    );
    expect(changes).toContainEqual({ operation: 'SHOW_WIDGET', widgetKey: 'focus' });
    expect(changes.every((change) => !isFixedZoneChange(change))).toBe(true);
  });

  it('treats the action queue as personal while retaining actual governed zones', () => {
    expect(isFixedZoneChange({ operation: 'HIDE_WIDGET', widgetKey: 'command-rail' })).toBe(false);
    expect(isFixedZoneChange({ operation: 'MOVE_WIDGET', widgetKey: 'command-rail' })).toBe(false);
    expect(isFixedZoneChange({ operation: 'SET_WIDTH', widgetKey: 'command-rail' })).toBe(false);
    expect(isFixedZoneChange({ operation: 'HIDE_WIDGET', widgetKey: 'announcements' })).toBe(true);
  });

  it('never emits a direct mutation while building a proposal', () => {
    const now = vi.spyOn(Date, 'now');
    buildWorkstyleChanges(view([{ widgetKey: 'activity', visible: true }]), 'REDUCE_NOISE');
    expect(now).not.toHaveBeenCalled();
  });

  it('returns no change when the selected workstyle already matches the view', () => {
    expect(buildWorkstyleChanges(view([]), 'BALANCE_DAY')).toEqual([]);
    expect(
      buildWorkstyleChanges(
        {
          ...view([{ widgetKey: 'activity', visible: false }]),
          layout: {
            ...view([]).layout,
            presentation: 'focused',
            widgets: [{ widgetKey: 'activity', visible: false }],
          },
        },
        'REDUCE_NOISE'
      )
    ).toEqual([]);
  });
});
