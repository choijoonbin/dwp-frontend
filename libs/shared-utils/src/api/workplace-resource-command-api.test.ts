import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  executeWorkplaceResourceCommand,
  getWorkplaceResourceCommandContext,
  getWorkplaceResourceCommandReceipt,
  parseWorkplaceResourceCommandContext,
  previewWorkplaceResourceCommand,
  reconcileWorkplaceResourceCommand,
} from './workplace-resource-command-api';

const BOOKING = '16000000-0000-4000-8000-000000000001';
const RESOURCE = '16000000-0000-4000-8000-000000000002';
const PREVIEW = '16000000-0000-4000-8000-000000000003';
const COMMAND = '16000000-0000-4000-8000-000000000004';
const NOW = '2026-09-17T03:00:00Z';

function response(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    text: async () => JSON.stringify({ data }),
  } as Response;
}

function context(providerState = 'READY') {
  return {
    bookingId: BOOKING,
    resourceId: RESOURCE,
    resourceType: 'PARKING',
    bookingVersion: 3,
    actions: [
      {
        commandType: 'PARKING_EXTEND',
        providerCapability: 'SPEED_GATE',
        providerState,
        availability: providerState === 'READY' ? 'AVAILABLE' : 'PROVIDER_NOT_READY',
        limitationCode: providerState === 'READY' ? null : `PROVIDER_${providerState}`,
        elevatedConfirmationRequired: true,
      },
    ],
    evaluatedAt: NOW,
  };
}

function preview() {
  return {
    previewId: PREVIEW,
    bookingId: BOOKING,
    resourceId: RESOURCE,
    commandType: 'PARKING_EXTEND',
    expectedBookingVersion: 3,
    parameters: { minutes: '60' },
    providerCapability: 'SPEED_GATE',
    providerState: 'READY',
    providerCode: 'parking-provider',
    providerConfigurationVersion: 7,
    eligible: true,
    impact: ['PARKING_ACCESS_WINDOW_WILL_CHANGE'],
    limitations: [],
    expiresAt: '2026-09-17T03:05:00Z',
    createdAt: NOW,
  };
}

function receipt(state: 'SUCCEEDED' | 'RESULT_UNKNOWN', replay = false) {
  return {
    commandId: COMMAND,
    previewId: PREVIEW,
    bookingId: BOOKING,
    resourceId: RESOURCE,
    commandType: 'PARKING_EXTEND',
    state,
    resultCode: state === 'SUCCEEDED' ? 'EXTENDED' : 'PROVIDER_RESULT_UNKNOWN',
    providerOperationReference: `command:${COMMAND}`,
    version: state === 'SUCCEEDED' ? 3 : 2,
    statusHref: `/v1/workplace/bookings/${BOOKING}/resource-commands/${COMMAND}`,
    correlationId: 'screen-16-command',
    acceptedAt: NOW,
    completedAt: state === 'SUCCEEDED' ? NOW : null,
    updatedAt: NOW,
    requeryRequired: state === 'RESULT_UNKNOWN',
    idempotentReplay: replay,
  };
}

describe('Workplace resource-command API', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('keeps an unverified provider unavailable instead of inferring readiness', () => {
    expect(parseWorkplaceResourceCommandContext(context('CONFIGURED_UNVERIFIED'))).toMatchObject({
      actions: [
        {
          providerState: 'CONFIGURED_UNVERIFIED',
          availability: 'PROVIDER_NOT_READY',
        },
      ],
    });
    expect(() =>
      parseWorkplaceResourceCommandContext({
        ...context(),
        actions: [{ ...context().actions[0], providerState: 'CONNECTED' }],
      })
    ).toThrow(/provider state/i);
  });

  it('uses canonical preview, elevated execute, GET receipt, and idempotent reconcile paths', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(context()))
      .mockResolvedValueOnce(response({ token: 'csrf-resource', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(response(preview()))
      .mockResolvedValueOnce(response(receipt('RESULT_UNKNOWN')))
      .mockResolvedValueOnce(response(receipt('RESULT_UNKNOWN')))
      .mockResolvedValueOnce(response(receipt('SUCCEEDED')));
    vi.stubGlobal('fetch', fetchMock);

    const loaded = await getWorkplaceResourceCommandContext(BOOKING);
    const impact = await previewWorkplaceResourceCommand(BOOKING, {
      commandType: 'PARKING_EXTEND',
      expectedBookingVersion: loaded.bookingVersion,
      parameters: { minutes: '60' },
    });
    const executed = await executeWorkplaceResourceCommand(
      BOOKING,
      {
        previewId: impact.previewId,
        expectedBookingVersion: 3,
        reason: 'Extend for a delayed customer meeting',
        explicitConfirmation: true,
      },
      {
        idempotencyKey: 'screen-16-resource-command',
        correlationId: 'screen-16-command',
        activeAccessMode: 'ELEVATED',
      }
    );
    await getWorkplaceResourceCommandReceipt(BOOKING, executed.commandId);
    const recovered = await reconcileWorkplaceResourceCommand(
      BOOKING,
      executed.commandId,
      'Confirm the provider result without replaying the command',
      {
        idempotencyKey: 'screen-16-resource-reconcile',
        activeAccessMode: 'ELEVATED',
      }
    );

    expect(recovered.state).toBe('SUCCEEDED');
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `/api/platform/v1/workplace/bookings/${BOOKING}/resource-command-context`
    );
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      `/api/platform/v1/workplace/bookings/${BOOKING}/resource-commands:preview`
    );
    const executeHeaders = new Headers((fetchMock.mock.calls[3]?.[1] as RequestInit).headers);
    expect(executeHeaders.get('Idempotency-Key')).toBe('screen-16-resource-command');
    expect(executeHeaders.get('X-DWP-Active-Access-Mode')).toBe('ELEVATED');
    expect((fetchMock.mock.calls[4]?.[1] as RequestInit).method).toBe('GET');
    const reconcileHeaders = new Headers((fetchMock.mock.calls[5]?.[1] as RequestInit).headers);
    expect(reconcileHeaders.get('Idempotency-Key')).toBe('screen-16-resource-reconcile');
    expect(fetchMock.mock.calls[5]?.[0]).toBe(
      `/api/platform/v1/workplace/bookings/${BOOKING}/resource-commands/${COMMAND}:reconcile`
    );
  });
});
