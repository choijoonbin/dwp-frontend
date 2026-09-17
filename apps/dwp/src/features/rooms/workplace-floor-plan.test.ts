import { describe, expect, it } from 'vitest';

import { workplaceFloorPlanZones } from './workplace-floor-plan';

import type { WorkplaceResource } from '@dwp-frontend/shared-utils';

const resource = (
  resourceId: string,
  neighborhood: string | null,
  positionX: number,
  positionY: number,
  widthPercent = 8,
  heightPercent = 6
) =>
  ({
    resourceId,
    neighborhood,
    positionX,
    positionY,
    widthPercent,
    heightPercent,
  }) as WorkplaceResource;

describe('workplace floor-plan zones', () => {
  it('derives neighborhood outlines from registered resource coordinates', () => {
    expect(
      workplaceFloorPlanZones([
        resource('desk-1', 'Window zone', 10, 20),
        resource('desk-2', 'Window zone', 30, 24, 10, 8),
        resource('pod-1', 'Focus', 70, 10, 12, 10),
      ])
    ).toEqual([
      {
        key: 'Focus',
        label: 'Focus',
        resourceCount: 1,
        left: 68.5,
        top: 8.5,
        width: 15,
        height: 13,
      },
      {
        key: 'Window zone',
        label: 'Window zone',
        resourceCount: 2,
        left: 8.5,
        top: 18.5,
        width: 33,
        height: 15,
      },
    ]);
  });

  it('does not invent a zone for resources without a registered neighborhood', () => {
    expect(workplaceFloorPlanZones([resource('desk-1', null, 10, 20)])).toEqual([]);
  });

  it('keeps derived zone geometry inside the plan boundary', () => {
    expect(workplaceFloorPlanZones([resource('edge-desk', 'Edge', 99, 98, 8, 9)])).toEqual([
      expect.objectContaining({
        left: 97.5,
        top: 96.5,
        width: 2.5,
        height: 3.5,
      }),
    ]);
  });
});
