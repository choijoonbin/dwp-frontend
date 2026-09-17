import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  acceptWorkplaceAlternativeOffer,
  cancelWorkplaceWaitlistEntry,
  compensateWorkplaceBookingBatch,
  createWorkplaceReservationHolds,
  createWorkplaceWaitlistEntry,
  getWorkplaceAuthorizedBookingBeneficiaries,
  getWorkplaceBookingBatch,
  getWorkplaceBookingIntent,
  getWorkplaceWaitlistEntry,
  getWorkplaceWaitlistEntries,
  previewWorkplaceBookingIntent,
  releaseWorkplaceReservationHolds,
  replanWorkplaceBookingBatch,
  startWorkplaceBookingBatch,
  updateWorkplaceWaitlistEntry,
  type WorkplaceBookingIntentItemInput,
} from './workplace-booking-orchestration-api';

function response(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    text: async () => JSON.stringify({ data }),
  } as Response;
}

const item: WorkplaceBookingIntentItemInput = {
  clientItemKey: '2026-09-16:user-11:DESK',
  beneficiaryUserId: 11,
  beneficiaryPersonPublicId: '51000000-0000-4000-8000-000000000011',
  beneficiaryDisplayName: 'Workplace member',
  delegationGrantId: null,
  resourceType: 'DESK',
  preferredResourceId: null,
  siteId: '51000000-0000-4000-8000-000000000021',
  floorId: '51000000-0000-4000-8000-000000000031',
  startsAt: '2026-09-16T09:00:00+09:00',
  endsAt: '2026-09-16T18:00:00+09:00',
  purpose: 'Weekly workplace plan',
  visibleToColleagues: false,
  accessibleOnly: false,
  requiredFeatures: [],
};

afterEach(() => {
  resetCsrfToken();
  vi.unstubAllGlobals();
});

describe('Workplace booking orchestration gateway contract', () => {
  it('uses intent, hold, 202 batch and authoritative batch status paths with stable keys', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(response({ intentId: 'intent-1', items: [], version: 1 }))
      .mockResolvedValueOnce(response({ intentId: 'intent-1', holds: [], intentVersion: 2 }))
      .mockResolvedValueOnce(
        response({
          intent: { intentId: 'intent-1', holds: [], intentVersion: 3 },
          receipt: { commandId: 'release-1', state: 'SUCCEEDED' },
        })
      )
      .mockResolvedValueOnce(
        response({ batchId: 'batch-1', state: 'ACCEPTED', statusUrl: '/status', version: 1 }, 202)
      )
      .mockResolvedValueOnce(
        response({ batchId: 'batch-1', state: 'RESULT_UNKNOWN', items: [], requeryRequired: true })
      );
    vi.stubGlobal('fetch', fetchMock);

    await previewWorkplaceBookingIntent(
      {
        items: [item],
        requestedHoldTtlSeconds: 120,
        allowAlternatives: true,
        teamPlacementConstraints: [],
        reason: 'Plan week',
      },
      'preview-key'
    );
    await createWorkplaceReservationHolds(
      'intent/1',
      {
        expectedIntentVersion: 1,
        selections: [
          {
            intentItemId: 'item-1',
            resourceId: 'resource-1',
            expectedItemVersion: 1,
            expectedResourceVersion: 3,
          },
        ],
        reason: 'Hold reviewed resources',
        explicitConfirmation: true,
      },
      'hold-key'
    );
    await releaseWorkplaceReservationHolds(
      'intent/1',
      {
        expectedIntentVersion: 2,
        holds: [{ holdId: 'hold-1', expectedHoldVersion: 1 }],
        reason: 'Edit this plan',
        explicitConfirmation: true,
      },
      'release-key'
    );
    await startWorkplaceBookingBatch(
      {
        intentId: 'intent-1',
        expectedIntentVersion: 2,
        holds: [{ holdId: 'hold-1', expectedVersion: 1 }],
        failurePolicy: 'KEEP_SUCCEEDED',
        reason: 'Confirm weekly plan',
        explicitConfirmation: true,
      },
      'batch-key'
    );
    await expect(getWorkplaceBookingBatch('batch/1')).resolves.toMatchObject({
      state: 'RESULT_UNKNOWN',
      requeryRequired: true,
    });

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/api/auth/csrf',
      '/api/platform/v1/workplace/booking-intents/preview',
      '/api/platform/v1/workplace/booking-intents/intent%2F1/holds',
      '/api/platform/v1/workplace/booking-orchestration/intents/intent%2F1/holds:release',
      '/api/platform/v1/workplace/booking-batches',
      '/api/platform/v1/workplace/booking-batches/batch%2F1',
    ]);
    expect(
      fetchMock.mock.calls
        .slice(1, 5)
        .map(([, request]) => new Headers((request as RequestInit).headers).get('Idempotency-Key'))
    ).toEqual(['preview-key', 'hold-key', 'release-key', 'batch-key']);
  });

  it('keeps waitlist conditions and alternative offer acceptance on separate versioned commands', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(response({ waitlistEntryId: 'wait-1', version: 1 }))
      .mockResolvedValueOnce(response({ waitlistEntryId: 'wait-1', version: 1 }))
      .mockResolvedValueOnce(response({ waitlistEntryId: 'wait-1', version: 2 }))
      .mockResolvedValueOnce(
        response({ waitlistEntryId: 'wait-1', state: 'CANCELLED', version: 3 })
      )
      .mockResolvedValueOnce(response({ batchId: 'batch-2', state: 'ACCEPTED' }, 202));
    vi.stubGlobal('fetch', fetchMock);
    const conditions = {
      maximumDistanceMeters: 800,
      earliestStart: item.startsAt,
      latestEnd: item.endsAt,
      pricingMode: 'NOT_APPLICABLE' as const,
      maximumPrice: null,
      currency: null,
    };

    await createWorkplaceWaitlistEntry(
      {
        item,
        autoConfirm: false,
        conditions,
        notificationChannels: ['IN_APP', 'EMAIL'],
        reason: 'No resource was available',
      },
      'wait-create-key'
    );
    await getWorkplaceWaitlistEntry('wait/1');
    await updateWorkplaceWaitlistEntry(
      'wait/1',
      {
        expectedVersion: 1,
        autoConfirm: true,
        conditions,
        notificationChannels: ['IN_APP'],
        reason: 'Enable automatic confirmation',
      },
      'wait-update-key'
    );
    await cancelWorkplaceWaitlistEntry(
      'wait/1',
      {
        expectedVersion: 2,
        reason: 'Leave this waitlist',
        explicitConfirmation: true,
      },
      'wait-cancel-key'
    );
    await acceptWorkplaceAlternativeOffer(
      'offer/1',
      {
        expectedOfferVersion: 3,
        failurePolicy: 'KEEP_SUCCEEDED',
        reason: 'Accept current alternative',
        explicitConfirmation: true,
      },
      'offer-key'
    );

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/api/auth/csrf',
      '/api/platform/v1/workplace/waitlist-entries',
      '/api/platform/v1/workplace/waitlist-entries/wait%2F1',
      '/api/platform/v1/workplace/waitlist-entries/wait%2F1',
      '/api/platform/v1/workplace/waitlist-entries/wait%2F1:cancel',
      '/api/platform/v1/workplace/alternative-offers/offer%2F1:accept',
    ]);
    expect(
      fetchMock.mock.calls.slice(1).map(([, request]) => ({
        method: (request as RequestInit | undefined)?.method ?? 'GET',
        key: new Headers((request as RequestInit | undefined)?.headers).get('Idempotency-Key'),
      }))
    ).toEqual([
      { method: 'POST', key: 'wait-create-key' },
      { method: 'GET', key: null },
      { method: 'PATCH', key: 'wait-update-key' },
      { method: 'POST', key: 'wait-cancel-key' },
      { method: 'POST', key: 'offer-key' },
    ]);
  });

  it('uses authoritative recovery, beneficiary, waitlist page and child-resource recovery paths', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ beneficiaries: [], generatedAt: '2026-09-16T00:00:00Z' }))
      .mockResolvedValueOnce(
        response({ intent: { intentId: 'intent-1' }, holds: [], latestBatchId: 'batch-1' })
      )
      .mockResolvedValueOnce(response({ content: [], totalElements: 0 }))
      .mockResolvedValueOnce(response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(response({ batchId: 'batch-1', state: 'COMPENSATED', items: [] }))
      .mockResolvedValueOnce(response({ intentId: 'intent-2', state: 'PREVIEWED', items: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await getWorkplaceAuthorizedBookingBeneficiaries();
    await getWorkplaceBookingIntent('intent/1');
    await getWorkplaceWaitlistEntries({
      from: '2026-09-14T00:00:00Z',
      to: '2026-09-19T00:00:00Z',
      size: 25,
    });
    await compensateWorkplaceBookingBatch(
      'batch/1',
      {
        expectedBatchVersion: 4,
        batchItemIds: ['item-1'],
        compensateAllSucceeded: false,
        reason: 'Cancel successful item',
        explicitConfirmation: true,
      },
      'compensate-key'
    );
    await replanWorkplaceBookingBatch(
      'batch/1',
      {
        expectedBatchVersion: 5,
        batchItemIds: ['item-2'],
        requestedHoldTtlSeconds: 120,
        allowAlternatives: true,
        reason: 'Replan failed item',
      },
      'replan-key'
    );

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/api/platform/v1/workplace/booking-intents/beneficiaries',
      '/api/platform/v1/workplace/booking-intents/intent%2F1',
      '/api/platform/v1/workplace/waitlist-entries?from=2026-09-14T00%3A00%3A00Z&to=2026-09-19T00%3A00%3A00Z&page=0&size=25',
      '/api/auth/csrf',
      '/api/platform/v1/workplace/booking-batches/batch%2F1/compensations',
      '/api/platform/v1/workplace/booking-batches/batch%2F1/replans',
    ]);
    expect(
      fetchMock.mock.calls
        .slice(-2)
        .map(([, request]) => new Headers((request as RequestInit).headers).get('Idempotency-Key'))
    ).toEqual(['compensate-key', 'replan-key']);
  });
});
