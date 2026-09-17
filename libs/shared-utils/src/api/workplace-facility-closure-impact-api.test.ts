import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  createWorkplaceClosureImpactPreview,
  executeWorkplaceClosureImpact,
  getWorkplaceClosureCommand,
  getWorkplaceClosureCommandReceipt,
  parseWorkplaceClosureImpactPreview,
  reconcileWorkplaceClosureNotifications,
  retryWorkplaceClosureNotifications,
} from './workplace-facility-closure-impact-api';

const SITE = '10000000-0000-4000-8000-000000000001';
const RESOURCE = '20000000-0000-4000-8000-000000000001';
const PREVIEW = '30000000-0000-4000-8000-000000000001';
const PREVIEW_ITEM = '40000000-0000-4000-8000-000000000001';
const BOOKING = '50000000-0000-4000-8000-000000000001';
const COMMAND = '60000000-0000-4000-8000-000000000001';
const COMMAND_ITEM = '70000000-0000-4000-8000-000000000001';
const CLOSURE = '80000000-0000-4000-8000-000000000001';
const EVENT = '90000000-0000-4000-8000-000000000001';
const NOW = '2026-09-17T04:00:00Z';

function preview() {
  return {
    previewId: PREVIEW,
    resourceId: RESOURCE,
    siteId: SITE,
    reservationOwner: 'WORKPLACE',
    startsAt: '2026-09-18T01:00:00Z',
    endsAt: '2026-09-18T03:00:00Z',
    resourceVersion: 7,
    previewVersion: 1,
    confirmationToken: 'snapshot-token',
    affectedBookingCount: 1,
    affectedRecipientCount: 1,
    expiresAt: '2026-09-17T04:10:00Z',
    generatedAt: NOW,
    items: [
      {
        previewItemId: PREVIEW_ITEM,
        reservationOwner: 'WORKPLACE',
        bookingId: BOOKING,
        eventId: EVENT,
        sourceWorkplaceResourceId: RESOURCE,
        sourceOwnerResourceId: RESOURCE,
        startsAt: '2026-09-18T01:00:00Z',
        endsAt: '2026-09-18T02:00:00Z',
        bookingStatus: 'CONFIRMED',
        bookingVersion: 4,
        recipientUserIds: [91],
        replacementBlockReason: null,
        replacementCandidates: [
          {
            workplaceResourceId: '21000000-0000-4000-8000-000000000001',
            ownerResourceId: '22000000-0000-4000-8000-000000000001',
            resourceName: 'D-1210',
            floorId: '23000000-0000-4000-8000-000000000001',
            resourceVersion: 8,
            rank: 0,
          },
        ],
      },
    ],
  };
}

function command(notificationState = 'PUBLISHED') {
  return {
    commandId: COMMAND,
    previewId: PREVIEW,
    closureId: CLOSURE,
    resourceId: RESOURCE,
    siteId: SITE,
    state: 'SUCCEEDED',
    expectedPreviewVersion: 1,
    reason: 'Verified maintenance',
    keptCount: 0,
    cancelledCount: 0,
    replacedCount: 1,
    version: 3,
    createdAt: NOW,
    completedAt: '2026-09-17T04:00:01Z',
    notifications: {
      recipientCount: 1,
      eventCount: 1,
      state: notificationState,
      pendingCount: 0,
      retryCount: 0,
      sendingCount: 0,
      publishedCount: 1,
      resultUnknownCount: 0,
      deadCount: 0,
      eventTransportConfigured: true,
      reconciliationRequired: false,
      observedAt: '2026-09-17T04:00:01Z',
    },
    items: [
      {
        commandItemId: COMMAND_ITEM,
        previewItemId: PREVIEW_ITEM,
        reservationOwner: 'WORKPLACE',
        bookingId: BOOKING,
        selectedAction: 'REPLACE',
        expectedBookingVersion: 4,
        replacementWorkplaceResourceId: '21000000-0000-4000-8000-000000000001',
        replacementOwnerResourceId: '22000000-0000-4000-8000-000000000001',
        replacementResourceVersion: 8,
        resultState: 'SUCCEEDED',
        resultCode: null,
        resultingBookingVersion: 5,
      },
    ],
  };
}

function receipt() {
  return {
    command: command(),
    owner: 'PLATFORM',
    bookingsMutated: true,
    notificationScheduled: true,
    notificationDispatchPublished: true,
    externalDeliveryProven: false,
    auditTrail: [
      {
        commandEventId: 'a0000000-0000-4000-8000-000000000001',
        eventType: 'COMMAND_COMPLETED',
        actorUserId: 91,
        evidence: 'One booking moved and one notification event published.',
        correlationId: 'corr-screen-11',
        occurredAt: '2026-09-17T04:00:01Z',
      },
    ],
  };
}

function json(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    text: async () => JSON.stringify({ data }),
  } as Response;
}

describe('workplace facility closure impact API', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('rejects a response whose count or scope does not match its authoritative rows', async () => {
    expect(() =>
      parseWorkplaceClosureImpactPreview({ ...preview(), affectedBookingCount: 2 })
    ).toThrow(/affectedBookingCount/u);

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(json({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
        .mockResolvedValueOnce(
          json({ ...preview(), siteId: '11000000-0000-4000-8000-000000000001' })
        )
    );
    await expect(
      createWorkplaceClosureImpactPreview(
        SITE,
        RESOURCE,
        { startsAt: preview().startsAt, endsAt: preview().endsAt, resourceVersion: 7 },
        'preview-key'
      )
    ).rejects.toThrow(/preview.scope/u);
  });

  it('binds preview, execution, GET-only recovery, receipt and notification recovery to exact routes', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(json(preview()))
      .mockResolvedValueOnce(json(command()))
      .mockResolvedValueOnce(json(command()))
      .mockResolvedValueOnce(json(receipt()))
      .mockResolvedValueOnce(json(command('RESULT_UNKNOWN')))
      .mockResolvedValueOnce(json(command('PUBLISHED')));
    vi.stubGlobal('fetch', fetchMock);

    const impact = await createWorkplaceClosureImpactPreview(
      SITE,
      RESOURCE,
      { startsAt: preview().startsAt, endsAt: preview().endsAt, resourceVersion: 7 },
      'preview-key'
    );
    const input = {
      expectedPreviewVersion: impact.previewVersion,
      confirmationToken: impact.confirmationToken,
      reason: 'Verified maintenance',
      confirmed: true as const,
      selections: [
        {
          previewItemId: PREVIEW_ITEM,
          action: 'REPLACE' as const,
          expectedBookingVersion: 4,
          replacementResourceId: '21000000-0000-4000-8000-000000000001',
          expectedReplacementResourceVersion: 8,
        },
      ],
    };
    await executeWorkplaceClosureImpact(SITE, PREVIEW, input, {
      idempotencyKey: 'execute-key',
      activeAccessMode: 'ELEVATED',
    });
    await getWorkplaceClosureCommand(SITE, COMMAND);
    await getWorkplaceClosureCommandReceipt(SITE, COMMAND);
    const recovery = {
      expectedCommandVersion: 3,
      reason: 'Verified transport receipt',
      confirmed: true as const,
    };
    await reconcileWorkplaceClosureNotifications(SITE, COMMAND, recovery, {
      idempotencyKey: 'reconcile-key',
      activeAccessMode: 'ELEVATED',
    });
    await retryWorkplaceClosureNotifications(SITE, COMMAND, recovery, {
      idempotencyKey: 'retry-key',
      activeAccessMode: 'ELEVATED',
    });

    const requests = fetchMock.mock.calls.map(([request, init]) => ({
      url: typeof request === 'string' ? request : (request as Request).url,
      headers: new Headers((init as RequestInit | undefined)?.headers),
    }));
    expect(requests.map((request) => new URL(request.url, 'http://dwp.test').pathname)).toEqual([
      '/api/auth/csrf',
      `/api/platform/v1/admin/workplace/experience/facilities/resources/${RESOURCE}/closure-impact-previews`,
      `/api/platform/v1/admin/workplace/experience/facilities/closure-impact-previews/${PREVIEW}/commands`,
      `/api/platform/v1/admin/workplace/experience/facilities/closure-commands/${COMMAND}`,
      `/api/platform/v1/admin/workplace/experience/facilities/closure-commands/${COMMAND}/receipt`,
      `/api/platform/v1/admin/workplace/experience/facilities/closure-commands/${COMMAND}/notifications/reconcile`,
      `/api/platform/v1/admin/workplace/experience/facilities/closure-commands/${COMMAND}/notifications/retry`,
    ]);
    expect(requests[2].headers.get('Idempotency-Key')).toBe('execute-key');
    expect(requests[2].headers.get('X-DWP-Active-Access-Mode')).toBe('ELEVATED');
    expect(requests[5].headers.get('Idempotency-Key')).toBe('reconcile-key');
    expect(requests[6].headers.get('Idempotency-Key')).toBe('retry-key');
    expect(new URL(requests[2].url, 'http://dwp.test').searchParams.get('siteId')).toBe(SITE);
  });
});
