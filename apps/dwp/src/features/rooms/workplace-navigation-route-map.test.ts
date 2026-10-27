import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  WorkplaceNavigationRouteMap,
  workplaceNavigationRouteMapModel,
} from './workplace-navigation-route-map';

import type { WorkplaceNavigationRoute } from '@dwp-frontend/shared-utils/api/workplace-navigation-contract';

const FLOOR_A = '19000000-0000-4000-8000-000000000001';
const FLOOR_B = '19000000-0000-4000-8000-000000000002';

function route(): WorkplaceNavigationRoute {
  return {
    outcome: 'GUIDED',
    graphRevisionId: '19000000-0000-4000-8000-000000000010',
    graphRevisionNumber: 2,
    origin: {
      poiId: '19000000-0000-4000-8000-000000000011',
      nodeId: '19000000-0000-4000-8000-000000000012',
      siteId: '19000000-0000-4000-8000-000000000013',
      floorId: FLOOR_A,
      resourceId: null,
      category: 'ENTRY',
      nameKo: '주 출입구',
      nameEn: 'Main entrance',
      directionHintKo: null,
      directionHintEn: null,
    },
    destination: {
      poiId: '19000000-0000-4000-8000-000000000014',
      nodeId: '19000000-0000-4000-8000-000000000015',
      siteId: '19000000-0000-4000-8000-000000000013',
      floorId: FLOOR_B,
      resourceId: '19000000-0000-4000-8000-000000000016',
      category: 'ROOM',
      nameKo: '회의실',
      nameEn: 'Meeting room',
      directionHintKo: null,
      directionHintEn: null,
    },
    steps: [
      {
        fromNodeId: 'entry',
        toNodeId: 'elevator-a',
        floorId: FLOOR_A,
        fromFloorId: FLOOR_A,
        toFloorId: FLOOR_A,
        fromPositionX: 92,
        fromPositionY: 90,
        toPositionX: 58,
        toPositionY: 78,
        travelMode: 'WALK',
        travelSeconds: 35,
        directionKo: '통로를 따라 이동하세요.',
        directionEn: 'Follow the corridor.',
      },
      {
        fromNodeId: 'elevator-a',
        toNodeId: 'elevator-b',
        floorId: FLOOR_B,
        fromFloorId: FLOOR_A,
        toFloorId: FLOOR_B,
        fromPositionX: 58,
        fromPositionY: 78,
        toPositionX: 58,
        toPositionY: 78,
        travelMode: 'ELEVATOR',
        travelSeconds: 45,
        directionKo: '엘리베이터를 이용하세요.',
        directionEn: 'Take the elevator.',
      },
      {
        fromNodeId: 'elevator-b',
        toNodeId: 'room',
        floorId: FLOOR_B,
        fromFloorId: FLOOR_B,
        toFloorId: FLOOR_B,
        fromPositionX: 58,
        fromPositionY: 78,
        toPositionX: 13.5,
        toPositionY: 17,
        travelMode: 'WALK',
        travelSeconds: 52,
        directionKo: '회의실 앞 통로를 따라 이동하세요.',
        directionEn: 'Follow the corridor to the meeting room.',
      },
    ],
    totalTravelSeconds: 132,
    fallback: {
      siteId: '19000000-0000-4000-8000-000000000013',
      floorId: FLOOR_B,
      resourceId: '19000000-0000-4000-8000-000000000016',
      siteName: 'SKAX 서울 오피스',
      floorName: '6층',
      resourceName: '회의실',
      floorMapPath: '/assets/workplace/skax-seoul-floor-v1.svg',
      helpDesks: [],
    },
    limitations: [],
    graphPublishedAt: '2026-10-27T06:00:00Z',
    asOf: '2026-10-27T06:01:00Z',
  };
}

describe('workplaceNavigationRouteMapModel', () => {
  it('projects authoritative coordinates onto the destination floor plan', () => {
    const model = workplaceNavigationRouteMapModel(route());

    expect(model).toMatchObject({
      floorId: FLOOR_B,
      floorName: '6층',
      backgroundAssetPath: '/assets/workplace/skax-seoul-floor-v1.svg',
    });
    expect(model.segments).toHaveLength(1);
    expect(model.segments[0]).toMatchObject({
      fromX: 58,
      fromY: 78,
      toX: 13.5,
      toY: 17,
      travelMode: 'WALK',
      stepNumber: 3,
    });
  });

  it('does not invent geometry for rolling-deploy responses without coordinates', () => {
    const legacy = route();
    const model = workplaceNavigationRouteMapModel({
      ...legacy,
      fallback: { ...legacy.fallback!, floorMapPath: 'https://untrusted.example/map.svg' },
      steps: legacy.steps.map((step) => ({
        ...step,
        fromPositionX: null,
        fromPositionY: null,
        toPositionX: null,
        toPositionY: null,
      })),
    });

    expect(model.backgroundAssetPath).toBeNull();
    expect(model.segments).toEqual([]);
  });

  it('labels the destination-floor map with its first visible step', () => {
    const markup = renderToStaticMarkup(
      createElement(WorkplaceNavigationRouteMap, {
        route: route(),
        locale: 'ko',
        originName: '주 출입구',
        destinationName: '회의실',
      })
    );

    expect(markup).toContain('회의실 앞 통로를 따라 이동하세요.');
    expect(markup).not.toContain('엘리베이터를 이용하세요.');
  });
});
