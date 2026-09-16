import { describe, expect, it } from 'vitest';

import {
  projectOwnerWidgetPlacements,
  selectOwnerRuntimeWidgets,
} from './home-owner-widget-region';

import type { HomeV2ReadModel, HomeV2Widget } from '@dwp-frontend/shared-utils';

function widget(definitionKey: string): HomeV2Widget {
  return { definitionKey } as HomeV2Widget;
}

describe('Home owner widget region', () => {
  it('preserves broker order while excluding native and appDock-only definitions', () => {
    expect(
      selectOwnerRuntimeWidgets([
        widget('core.workspace.command-rail'),
        widget('space.change-feed'),
        widget('notification.app-badges'),
        widget('approval.focus-queue'),
      ]).map((item) => item.definitionKey)
    ).toEqual(['space.change-feed', 'approval.focus-queue']);
  });

  it('keeps a known owner definition even when its tuple will fail closed in the boundary', () => {
    expect(selectOwnerRuntimeWidgets([widget('hr.edu')])).toHaveLength(1);
  });

  it('applies Composition v4 visibility plus device order and size within the owner subset', () => {
    const model = {
      view: {
        composition: {
          widgets: [
            { widgetKey: 'command-rail', visible: true, size: 'large' },
            { widgetKey: 'focus-queue', visible: true, size: 'medium' },
            { widgetKey: 'hr-education', visible: false, size: 'compact' },
            { widgetKey: 'space-change-feed', visible: true, size: 'large' },
            { widgetKey: 'future-owner-card', visible: true, size: 'quarter' },
          ],
        },
        deviceOverlay: {
          density: 'comfortable',
          widgetOrder: ['space-change-feed', 'focus-queue'],
          widgetSizes: { 'focus-queue': 'full' },
        },
      },
      widgets: [widget('approval.focus-queue'), widget('hr.edu'), widget('space.change-feed')],
    } as unknown as HomeV2ReadModel;

    expect(projectOwnerWidgetPlacements(model)).toEqual([
      expect.objectContaining({
        placementKey: 'space-change-feed',
        size: 'large',
        widget: expect.objectContaining({ definitionKey: 'space.change-feed' }),
      }),
      expect.objectContaining({
        placementKey: 'focus-queue',
        size: 'full',
        widget: expect.objectContaining({ definitionKey: 'approval.focus-queue' }),
      }),
      { placementKey: 'future-owner-card', size: 'quarter', widget: null },
    ]);
  });

  it('projects a missing known owner runtime record as a fail-closed placeholder', () => {
    const model = {
      view: {
        composition: {
          widgets: [{ widgetKey: 'meeting-next-prep', visible: true, size: null }],
        },
        deviceOverlay: null,
      },
      widgets: [],
    } as unknown as HomeV2ReadModel;

    expect(projectOwnerWidgetPlacements(model)).toEqual([
      { placementKey: 'meeting-next-prep', size: 'medium', widget: null },
    ]);
  });
});
