import { describe, expect, it } from 'vitest';

import {
  applyHomeDeviceOverlay,
  buildFlowDeviceWidthControls,
  mergeFlowDeviceWidthOverrides,
} from './home-device-overlay';

import type { HomeWidgetPreference } from '@dwp-frontend/shared-utils';

const widgets: HomeWidgetPreference[] = [
  { widgetKey: 'command-rail', visible: true, size: 'large' },
  { widgetKey: 'schedule', visible: true, size: 'quarter' },
  { widgetKey: 'focus', visible: true, size: 'medium' },
  { widgetKey: 'activity', visible: true, size: 'quarter' },
  { widgetKey: 'focus-balance', visible: true, size: 'medium' },
  { widgetKey: 'meeting-load', visible: true, size: 'medium' },
];

describe('home device overlay', () => {
  it('applies only registered size hints without changing semantic DOM order', () => {
    expect(
      applyHomeDeviceOverlay(widgets, {
        widgetOrder: ['focus', 'unknown', 'focus'],
        widgetSizes: { focus: 'full', activity: 'invalid' },
        density: 'compact',
      })
    ).toEqual([
      { widgetKey: 'command-rail', visible: true, size: 'large' },
      { widgetKey: 'schedule', visible: true, size: 'quarter' },
      { widgetKey: 'focus', visible: true, size: 'full' },
      { widgetKey: 'activity', visible: true, size: 'quarter' },
      { widgetKey: 'focus-balance', visible: true, size: 'medium' },
      { widgetKey: 'meeting-load', visible: true, size: 'medium' },
    ]);
  });

  it('exposes every visible Flow purpose widget without merging unrelated sources', () => {
    const focusHidden = widgets.map((widget) =>
      widget.widgetKey === 'focus' ? { ...widget, visible: false } : widget
    );

    expect(buildFlowDeviceWidthControls(focusHidden)).toEqual([
      {
        storageKey: 'command-rail',
        sourceSize: 'large',
        labelKey: 'content.widgetLabels.command-rail',
        allowedSizes: ['large', 'full'],
      },
      {
        storageKey: 'schedule',
        sourceSize: 'quarter',
        labelKey: 'content.widgetLabels.schedule',
        allowedSizes: ['fifth', 'quarter', 'compact', 'medium'],
      },
      {
        storageKey: 'activity',
        sourceSize: 'quarter',
        labelKey: 'content.widgetLabels.activity',
        allowedSizes: ['fifth', 'quarter', 'compact', 'medium'],
      },
      {
        storageKey: 'focus-balance',
        sourceSize: 'medium',
        labelKey: 'content.widgetLabels.focus-balance',
        allowedSizes: ['quarter', 'compact', 'medium'],
      },
      {
        storageKey: 'meeting-load',
        sourceSize: 'medium',
        labelKey: 'content.widgetLabels.meeting-load',
        allowedSizes: ['quarter', 'compact', 'medium'],
      },
    ]);
  });

  it('keeps request and role-pulse widths independently round-trippable', () => {
    expect(buildFlowDeviceWidthControls(widgets)).toEqual([
      expect.objectContaining({
        storageKey: 'command-rail',
        sourceSize: 'large',
        allowedSizes: ['large', 'full'],
      }),
      expect.objectContaining({ storageKey: 'schedule' }),
      expect.objectContaining({ storageKey: 'focus', sourceSize: 'medium' }),
      expect.objectContaining({ storageKey: 'activity', sourceSize: 'quarter' }),
      expect.objectContaining({ storageKey: 'focus-balance', sourceSize: 'medium' }),
      expect.objectContaining({ storageKey: 'meeting-load', sourceSize: 'medium' }),
    ]);
  });

  it('preserves hidden widget widths while normalizing the saved overlay', () => {
    expect(
      mergeFlowDeviceWidthOverrides(
        {
          'command-rail': 'full',
          schedule: 'quarter',
          focus: 'full',
          activity: 'invalid',
          'focus-balance': 'full',
          'meeting-load': 'quarter',
          unknown: 'large',
        },
        {
          'command-rail': 'large',
          schedule: 'medium',
          activity: 'compact',
          'focus-balance': 'compact',
        }
      )
    ).toEqual({
      'command-rail': 'large',
      schedule: 'medium',
      focus: 'full',
      activity: 'compact',
      'focus-balance': 'compact',
      'meeting-load': 'quarter',
    });
  });
});
