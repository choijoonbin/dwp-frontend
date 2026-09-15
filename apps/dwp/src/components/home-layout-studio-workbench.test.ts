import { describe, expect, it } from 'vitest';

import {
  HOME_STUDIO_CATALOG,
  homeStudioWidgetsEqual,
  moveStudioWidget,
} from './home-layout-studio-workbench';

import type { HomeWidgetPreference } from '@dwp-frontend/shared-utils';

const widgets: HomeWidgetPreference[] = [
  { widgetKey: 'command-rail', visible: true, size: 'large', height: 'standard' },
  { widgetKey: 'schedule', visible: true, size: 'compact', height: 'standard' },
  { widgetKey: 'daily-brief', visible: true, size: 'compact', height: 'standard' },
];

describe('Home layout studio workbench contract', () => {
  it('publishes twelve catalog entries while keeping only seven native renderers', () => {
    expect(HOME_STUDIO_CATALOG).toHaveLength(12);
    expect(HOME_STUDIO_CATALOG.filter(({ kind }) => kind === 'native')).toHaveLength(7);
    expect(HOME_STUDIO_CATALOG.filter(({ kind }) => kind === 'projection')).toHaveLength(5);
    expect(new Set(HOME_STUDIO_CATALOG.map(({ key }) => key)).size).toBe(12);
    expect(HOME_STUDIO_CATALOG.slice(0, 8).map(({ catalogId }) => catalogId)).toEqual([
      'meetings.next-prep',
      'meetings.decisions',
      'space.feed',
      'dwai.artifacts',
      'workplace.status',
      'hr.learning',
      'services.requests',
      'security.bulletin',
    ]);
  });

  it('moves a widget deterministically without mutating the saved baseline', () => {
    const moved = moveStudioWidget(widgets, 'schedule', -1);
    expect(moved.map(({ widgetKey }) => widgetKey)).toEqual([
      'schedule',
      'command-rail',
      'daily-brief',
    ]);
    expect(widgets.map(({ widgetKey }) => widgetKey)).toEqual([
      'command-rail',
      'schedule',
      'daily-brief',
    ]);
    expect(homeStudioWidgetsEqual(moved, widgets)).toBe(false);
    expect(homeStudioWidgetsEqual(moveStudioWidget(widgets, 'command-rail', -1), widgets)).toBe(
      true
    );
  });
});
