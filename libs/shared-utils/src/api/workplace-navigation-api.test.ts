import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  executeWorkplaceDeviceCommand,
  getWorkplaceDeviceCommandReceipt,
  getWorkplaceDeviceProjection,
  getWorkplaceNavigationRoute,
  previewWorkplaceDeviceCommand,
} from './workplace-navigation-api';
import { parseWorkplaceNavigationRoute } from './workplace-navigation-contract';

const SITE_ID = '19000000-0000-4000-8000-000000000001';
const FLOOR_ID = '19000000-0000-4000-8000-000000000002';
const ORIGIN_ID = '19000000-0000-4000-8000-000000000003';
const DESTINATION_ID = '19000000-0000-4000-8000-000000000004';
const DEVICE_ID = '19000000-0000-4000-8000-000000000005';
const COMMAND_ID = '19000000-0000-4000-8000-000000000006';
const NOW = '2026-09-16T03:00:00Z';

function response(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    text: async () => JSON.stringify({ data }),
  } as Response;
}

function poi(poiId: string, name: string) {
  return {
    poiId,
    nodeId: poiId.replace(/.$/u, '7'),
    siteId: SITE_ID,
    floorId: FLOOR_ID,
    resourceId: null,
    category: 'ENTRY',
    nameKo: name,
    nameEn: name,
    directionHintKo: null,
    directionHintEn: null,
  };
}

function route(outcome: 'GUIDED' | 'GRAPH_MISSING' = 'GUIDED') {
  return {
    outcome,
    graphRevisionId: outcome === 'GUIDED' ? '19000000-0000-4000-8000-000000000010' : null,
    graphRevisionNumber: outcome === 'GUIDED' ? 7 : 0,
    origin: poi(ORIGIN_ID, '입구'),
    destination: poi(DESTINATION_ID, '회의실'),
    steps:
      outcome === 'GUIDED'
        ? [
            {
              fromNodeId: ORIGIN_ID,
              toNodeId: DESTINATION_ID,
              floorId: FLOOR_ID,
              travelMode: 'ELEVATOR',
              travelSeconds: 90,
              directionKo: '엘리베이터를 이용하세요.',
              directionEn: 'Take the elevator.',
            },
          ]
        : [],
    totalTravelSeconds: outcome === 'GUIDED' ? 90 : 0,
    fallback:
      outcome === 'GUIDED'
        ? null
        : {
            siteId: SITE_ID,
            floorId: FLOOR_ID,
            resourceId: null,
            siteName: '서울 본사',
            floorName: '19층',
            resourceName: '회의실',
            floorMapPath: '/assets/floors/19.svg',
            helpDesks: [poi(ORIGIN_ID, '안내 데스크')],
          },
    limitations: outcome === 'GUIDED' ? [] : ['PUBLISHED_GRAPH_MISSING'],
    graphPublishedAt: outcome === 'GUIDED' ? NOW : null,
    asOf: NOW,
  };
}

function device() {
  return {
    deviceId: DEVICE_ID,
    displayName: 'Room panel 19A',
    deviceType: 'ROOM_PANEL',
    registrationState: 'BOUND',
    siteId: SITE_ID,
    floorId: FLOOR_ID,
    resourceId: DESTINATION_ID,
    hardwareModel: 'Panel X',
    osVersion: '14.2',
    appVersion: '2.9.0',
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
  };
}

function receipt(state: 'ACCEPTED' | 'RESULT_UNKNOWN') {
  return {
    commandId: COMMAND_ID,
    deviceId: DEVICE_ID,
    actorUserId: 9001,
    commandType: 'REBOOT',
    state,
    reason: 'Recover the verified display fault',
    resultCode: null,
    providerOperationReference: 'mdm-operation-19',
    version: 1,
    recoveryByGetOnly: state === 'RESULT_UNKNOWN',
    statusHref: `/v1/admin/workplace/devices/commands/${COMMAND_ID}`,
    correlationId: 'screen-19-correlation',
    acceptedAt: NOW,
    completedAt: null,
    updatedAt: NOW,
  };
}

function commandPreview() {
  return {
    previewId: '19000000-0000-4000-8000-000000000009',
    deviceId: DEVICE_ID,
    commandType: 'FORCE_SYNC',
    expectedDeviceVersion: 4,
    payload: {},
    impact: ['Refresh schedule and policy projections'],
    eligible: true,
    limitations: [],
    expiresAt: '2026-09-16T03:10:00Z',
    createdAt: NOW,
  };
}

describe('Workplace navigation API contract', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('requests a published-graph route with accessibility constraints', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(route()));
    vi.stubGlobal('fetch', fetchMock);

    const result = await getWorkplaceNavigationRoute({
      siteId: SITE_ID,
      originPoiId: ORIGIN_ID,
      destinationPoiId: DESTINATION_ID,
      accessible: true,
      avoidStairs: true,
    });

    expect(result.steps[0]?.travelMode).toBe('ELEVATOR');
    expect(fetchMock.mock.calls[0]?.[0]).toContain(
      `siteId=${SITE_ID}&originPoiId=${ORIGIN_ID}&destinationPoiId=${DESTINATION_ID}&accessible=true&avoidStairs=true`
    );
  });

  it('fails closed when a non-guided response invents straight-line steps', () => {
    expect(() =>
      parseWorkplaceNavigationRoute({
        ...route('GRAPH_MISSING'),
        steps: route().steps,
      })
    ).toThrow(/must not contain an invented guided route/u);
  });

  it('executes once with command identity and recovers RESULT_UNKNOWN by GET only', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(response(receipt('ACCEPTED'), 202))
      .mockResolvedValueOnce(response(receipt('RESULT_UNKNOWN')));
    vi.stubGlobal('fetch', fetchMock);

    const accepted = await executeWorkplaceDeviceCommand(
      DEVICE_ID,
      {
        previewId: '19000000-0000-4000-8000-000000000009',
        expectedDeviceVersion: 4,
        reason: 'Recover the verified display fault',
        explicitConfirmation: true,
      },
      {
        idempotencyKey: 'screen-19-reboot-device',
        correlationId: 'screen-19-correlation',
        activeAccessMode: 'ELEVATED',
      }
    );
    const recovered = await getWorkplaceDeviceCommandReceipt(accepted.commandId);

    expect(recovered.state).toBe('RESULT_UNKNOWN');
    expect(fetchMock.mock.calls).toHaveLength(3);
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      `/api/platform/v1/admin/workplace/devices/commands/${COMMAND_ID}`
    );
    expect((fetchMock.mock.calls[2]?.[1] as RequestInit).method).toBe('GET');
    const headers = new Headers((fetchMock.mock.calls[1]?.[1] as RequestInit).headers);
    expect(headers.get('Idempotency-Key')).toBe('screen-19-reboot-device');
    expect(headers.get('X-DWP-Active-Access-Mode')).toBe('ELEVATED');
  });

  it('previews with its own caller-supplied idempotency and correlation identity', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(response(commandPreview()));
    vi.stubGlobal('fetch', fetchMock);

    const result = await previewWorkplaceDeviceCommand(
      DEVICE_ID,
      { commandType: 'FORCE_SYNC', expectedDeviceVersion: 4, payload: {} },
      {
        idempotencyKey: 'screen-19-preview-device',
        correlationId: 'screen-19-preview-correlation',
      }
    );

    expect(result.previewId).toBe(commandPreview().previewId);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      `/api/platform/v1/admin/workplace/devices/${DEVICE_ID}/commands:preview`
    );
    const headers = new Headers((fetchMock.mock.calls[1]?.[1] as RequestInit).headers);
    expect(headers.get('Idempotency-Key')).toBe('screen-19-preview-device');
    expect(headers.get('X-Correlation-ID')).toBe('screen-19-preview-correlation');
    expect(headers.get('X-DWP-Active-Access-Mode')).toBeNull();
  });

  it('loads the device-authenticated room panel and preserves masking evidence', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      response({
        surface: 'ROOM_PANEL',
        roomPanel: {
          device: device(),
          current: {
            bookingId: DESTINATION_ID,
            startsAt: NOW,
            endsAt: '2026-09-16T04:00:00Z',
            title: '비공개 일정',
            organizer: null,
            privacyMasked: true,
          },
          next: null,
          availability: 'OCCUPIED',
          walkUpBookingAllowed: false,
          checkInAllowed: true,
          earlyEndAllowed: true,
          safetyFrame: null,
          asOf: NOW,
        },
        statusBoard: null,
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const projection = await getWorkplaceDeviceProjection(DEVICE_ID, 'opaque-device-credential');

    expect(projection.roomPanel?.current).toMatchObject({ privacyMasked: true, organizer: null });
    const headers = new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers);
    expect(headers.get('X-DWP-Device-Credential')).toBe('opaque-device-credential');
  });
});
