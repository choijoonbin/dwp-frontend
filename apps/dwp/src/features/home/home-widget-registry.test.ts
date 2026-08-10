import { describe, expect, it } from 'vitest';

import { moveHomeWidget, reconcileHomeWidgets } from './home-widget-registry';

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
    const moved = moveHomeWidget(source, 0, 1);

    expect(moved[1].widgetKey).toBe('announcements');
    expect(source[0].widgetKey).toBe('announcements');
  });
});
