// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  WorkplaceRoomPanelSurface,
  WorkplaceStatusBoardSurface,
} from './workplace-navigation-device-surfaces';

import type { WorkplaceDeviceProjection } from '@dwp-frontend/shared-utils/api/workplace-navigation-contract';

const NOW = '2026-09-16T03:00:00Z';

function device(type: 'ROOM_PANEL' | 'STATUS_BOARD') {
  return {
    deviceId: `device-${type}`,
    displayName: type === 'ROOM_PANEL' ? '19A Room' : '19F Board',
    deviceType: type,
    registrationState: 'BOUND',
    siteId: 'site-1',
    floorId: 'floor-19',
    resourceId: type === 'ROOM_PANEL' ? 'room-19a' : null,
    hardwareModel: 'Panel X',
    osVersion: '14',
    appVersion: '2.9',
    policyVersion: 'privacy-v4',
    heartbeatAt: NOW,
    connectivity: 'ONLINE',
    scheduleSourceAt: NOW,
    scheduleReceivedAt: NOW,
    scheduleFreshness: 'FRESH',
    recentErrorCode: null,
    safetyOfflineFallback: true,
    version: 4,
    updatedAt: NOW,
  } as const;
}

function roomProjection(safety = false): WorkplaceDeviceProjection {
  return {
    surface: 'ROOM_PANEL',
    roomPanel: {
      device: device('ROOM_PANEL'),
      availability: 'OCCUPIED',
      walkUpBookingAllowed: false,
      checkInAllowed: true,
      earlyEndAllowed: true,
      asOf: NOW,
      current: {
        bookingId: 'booking-1',
        startsAt: NOW,
        endsAt: '2026-09-16T04:00:00Z',
        title: 'Unredacted secret title',
        organizer: 'Unredacted Person',
        privacyMasked: true,
      },
      next: null,
      safetyFrame: safety
        ? {
            safetyFrameId: 'frame-1',
            state: 'ACTIVE',
            message: '대피하세요',
            direction: '북쪽 계단을 피하고 동쪽 출구로 이동하세요.',
            issuedAt: NOW,
            issuedByActorId: 912345,
            offlineFallback: true,
            clearedAt: null,
            version: 1,
          }
        : null,
    },
    statusBoard: null,
  };
}

function boardProjection(): WorkplaceDeviceProjection {
  return {
    surface: 'STATUS_BOARD',
    roomPanel: null,
    statusBoard: {
      device: device('STATUS_BOARD'),
      availableCount: 1,
      occupiedCount: 1,
      unavailableCount: 0,
      freshness: 'STALE',
      safetyFrame: null,
      asOf: NOW,
      resources: [
        {
          resourceId: 'room-a',
          zoneId: 'zone-a',
          zoneNameKo: '동쪽',
          zoneNameEn: 'East',
          nameKo: '회의실 A',
          nameEn: 'Room A',
          availability: 'AVAILABLE',
          directionKo: '오른쪽 20m',
          directionEn: '20m right',
        },
        {
          resourceId: 'room-b',
          zoneId: 'zone-b',
          zoneNameKo: '서쪽',
          zoneNameEn: 'West',
          nameKo: '회의실 B',
          nameEn: 'Room B',
          availability: 'OCCUPIED',
          directionKo: '왼쪽 10m',
          directionEn: '10m left',
        },
      ],
    },
  };
}

describe('Screen 19 device surfaces', () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.append(host);
  });

  afterEach(() => host.remove());

  it('masks schedule text and never exposes the provider raw title or organizer', async () => {
    const root = createRoot(host);
    await act(async () =>
      root.render(<WorkplaceRoomPanelSurface projection={roomProjection()} locale="ko" />)
    );
    expect(host.textContent).toContain('비공개 일정');
    expect(host.textContent).not.toContain('Unredacted secret title');
    expect(host.textContent).not.toContain('Unredacted Person');
    await act(async () => root.unmount());
  });

  it('replaces the normal room panel with an assertive safety frame and a masked actor reference', async () => {
    const root = createRoot(host);
    await act(async () =>
      root.render(<WorkplaceRoomPanelSurface projection={roomProjection(true)} locale="ko" />)
    );
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('대피하세요');
    expect(host.textContent).toContain('안전 운영자 ···45');
    expect(host.textContent).not.toContain('912345');
    expect(host.textContent).not.toContain('Unredacted secret title');
    await act(async () => root.unmount());
  });

  it('renders a distinct status board with directions, freshness, and as-of evidence', async () => {
    const root = createRoot(host);
    await act(async () =>
      root.render(<WorkplaceStatusBoardSurface projection={boardProjection()} locale="en" />)
    );
    expect(host.querySelector('[data-testid="workplace-status-board"]')).not.toBeNull();
    expect(host.textContent).toContain('20m right');
    expect(host.textContent).toContain('stale information');
    expect(host.textContent).toContain('As of');
    await act(async () => root.unmount());
  });
});
