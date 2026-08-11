import { describe, expect, it } from 'vitest';

import {
  reconcileHomeWidgets,
  reorderHomeWidgets,
  setHomeWidgetVisibility,
} from './home-widget-registry';

describe('home widget registry', () => {
  it('restores registered widgets and keeps announcements visible', () => {
    const widgets = reconcileHomeWidgets([
      { widgetKey: 'activity', visible: false },
      { widgetKey: 'announcements', visible: false },
      { widgetKey: 'unknown', visible: true },
    ]);

    expect(widgets).toHaveLength(5);
    expect(widgets[0]).toEqual({ widgetKey: 'activity', visible: false });
    expect(widgets.find((widget) => widget.widgetKey === 'announcements')?.visible).toBe(true);
  });

  it('moves widgets without mutating the source list', () => {
    const source = reconcileHomeWidgets(null);
    const moved = reorderHomeWidgets(source, 'announcements', 'daily-brief');

    expect(moved[1].widgetKey).toBe('announcements');
    expect(source[0].widgetKey).toBe('announcements');
  });

  it('hides personal widgets but keeps governed announcements visible', () => {
    const source = reconcileHomeWidgets(null);

    expect(setHomeWidgetVisibility(source, 'focus', false)).toContainEqual({
      widgetKey: 'focus',
      visible: false,
    });
    expect(
      setHomeWidgetVisibility(source, 'announcements', false).find(
        (widget) => widget.widgetKey === 'announcements'
      )?.visible
    ).toBe(true);
  });
});
