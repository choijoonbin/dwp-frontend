import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  cancelWorkplaceServiceLine,
  downloadWorkplaceServiceOrderAttachment,
  getWorkplaceServiceAttachmentScanStatus,
  getWorkplaceServiceFulfillmentQueue,
  getWorkplaceServiceLineAdjustment,
  getWorkplaceServiceOrderAttachments,
  getWorkplaceServiceOrderEvents,
  getWorkplaceServiceOrderMessages,
  getWorkplaceServiceOrders,
  previewWorkplaceServiceLineCancellation,
  reconcileWorkplaceServiceLineAdjustment,
  recordWorkplaceServiceAttachmentScan,
  updateWorkplaceServiceFulfillment,
} from './workplace-services-api';
import {
  parseWorkplaceServiceAttachmentScanCommandResult,
  parseWorkplaceServiceCommandResult,
  parseWorkplaceServiceLineAdjustment,
  parseWorkplaceServiceLineAdjustmentCommandResult,
  parseWorkplaceServiceOrder,
  parseWorkplaceServiceOrderAttachmentsPage,
  parseWorkplaceServiceOrderEventsPage,
  parseWorkplaceServiceOrderMessagesPage,
  parseWorkplaceServiceOrders,
} from './workplace-services-contract';

const reservationId = '18000000-0000-4000-8000-000000000001';
const itemId = '18000000-0000-4000-8000-000000000002';
const previewId = '18000000-0000-4000-8000-000000000003';
const orderId = '18000000-0000-4000-8000-000000000004';
const lineId = '18000000-0000-4000-8000-000000000005';
const taskId = '18000000-0000-4000-8000-000000000006';
const commandId = '18000000-0000-4000-8000-000000000007';
const eventId = '18000000-0000-4000-8000-000000000008';
const attachmentId = '18000000-0000-4000-8000-000000000011';
const messageId = '18000000-0000-4000-8000-000000000012';
const adjustmentId = '18000000-0000-4000-8000-000000000013';
const cursor = 'opaque-cursor-2';
const generatedAt = '2026-09-17T00:02:00Z';

function order(administrator = false, state = 'SUBMITTED', taskState = 'SUBMITTED') {
  return {
    serviceOrderId: orderId,
    requesterUserId: 99,
    reservationAuthority: 'WORKPLACE',
    reservationId,
    reservationVersion: 4,
    currentReservationVersion: 4,
    reservationStartsAt: '2026-09-18T01:00:00Z',
    reservationEndsAt: '2026-09-18T02:00:00Z',
    siteReference: 'site-1',
    resourceReference: 'resource-1',
    attendeeCount: 8,
    costCenter: 'CC-100',
    estimatedCost: 75_000,
    currency: 'KRW',
    specialRequest: null,
    state,
    reservationImpact: 'NONE',
    reconfirmationRequired: false,
    providerOperationReference: administrator ? 'provider-operation-1' : null,
    resultDetail: taskState === 'RESULT_UNKNOWN' ? 'Provider receipt must be queried.' : null,
    version: 3,
    createdAt: '2026-09-17T00:01:00Z',
    updatedAt: '2026-09-17T00:01:00Z',
    lines: [
      {
        serviceOrderLineId: lineId,
        catalogItemId: itemId,
        serviceCode: 'AV_ASSIST',
        category: 'AV',
        nameKo: 'AV 사전 점검',
        nameEn: 'AV readiness',
        providerState: 'READY',
        providerCode: 'DWP_NATIVE_FULFILLMENT',
        catalogVersion: 3,
        providerConfigurationVersion: 1,
        siteScope: ['18000000-0000-4000-8000-000000000014'],
        supportedResourceTypes: ['ROOM'],
        quantity: 3,
        options: {},
        optionSchema: [],
        unitPrice: 25_000,
        estimatedCost: 75_000,
        currency: 'KRW',
        cancellationCutoffMinutes: 60,
        cancellationPolicyKo: '1시간 전까지 취소',
        cancellationPolicyEn: 'Cancel until one hour before',
        slaResponseMinutes: 15,
        slaFulfillmentLeadMinutes: 45,
        minimumQuantity: 1,
        maximumQuantity: 10,
        orderCutoffMinutes: 90,
        inspectionMode: 'NONE',
        inspectionChecklistSchema: [],
        state: taskState,
        fulfilledQuantity: 1,
        cancelledQuantity: 0,
        refundedAmount: 0,
        blockerCode: null,
        version: 2,
      },
    ],
    tasks: [
      {
        fulfillmentTaskId: taskId,
        serviceOrderLineId: lineId,
        state: taskState,
        providerState: 'READY',
        providerCode: 'DWP_NATIVE_FULFILLMENT',
        assigneeUserId: administrator ? 77 : null,
        assigneeDirectorySubjectId: administrator ? 'subject:workplace:operator-77' : null,
        assigneeDisplayName: administrator ? 'Casey Kim' : null,
        assigneeSecondaryLabel: administrator ? 'AV operations' : null,
        responseDueAt: '2026-09-17T00:16:00Z',
        dueAt: '2026-09-18T00:15:00Z',
        providerReceiptAt: null,
        acceptedAt: null,
        completedAt: null,
        externalFulfillmentReference: administrator ? 'external-1' : null,
        blockerCode: null,
        blockerDetail: null,
        resultDetail: taskState === 'RESULT_UNKNOWN' ? 'Re-query receipt.' : null,
        responseRemainingSeconds: 840,
        fulfillmentRemainingSeconds: 86_400,
        responseBreached: false,
        fulfillmentBreached: false,
        version: 1,
        updatedAt: '2026-09-17T00:01:00Z',
      },
    ],
    eventCount: 1,
    messageCount: 1,
    attachmentCount: 1,
  };
}

function page<T>(items: readonly T[], hasMore = false) {
  return { items, nextCursor: hasMore ? cursor : null, hasMore, generatedAt };
}

function requesterEvent(detail: Record<string, unknown> = {}) {
  return { eventId, eventType: 'SUBMITTED', detail, occurredAt: generatedAt };
}

function requesterMessage() {
  return {
    messageId,
    authorDisplayName: 'Workplace member',
    authorRole: 'REQUESTER',
    message: 'Use the east entrance.',
    createdAt: generatedAt,
  };
}

function attachment(
  administrator = false,
  scanState: 'NOT_CONFIGURED' | 'QUARANTINED' | 'CLEAN' | 'INFECTED' | 'ERROR' = 'CLEAN'
) {
  return {
    attachmentId,
    fileName: 'layout.pdf',
    contentType: 'application/pdf',
    byteSize: 9,
    scanState,
    scanVersion: 2,
    scannerEvidenceReference: administrator ? 'scanner-job-1' : null,
    scanDetail: administrator ? 'No malware found.' : null,
    scannedAt: generatedAt,
    createdAt: generatedAt,
  };
}

function adjustment(administrator = false) {
  return {
    lineAdjustmentId: adjustmentId,
    serviceOrderId: orderId,
    serviceOrderLineId: lineId,
    cancellationPreviewId: previewId,
    cancelQuantity: 1,
    refundScope: 'PARTIAL',
    refundableAmount: 25_000,
    refundedAmount: 25_000,
    currency: 'KRW',
    state: 'REFUNDED',
    providerOperationReference: administrator ? 'provider-cancel-1' : null,
    refundReceiptReference: administrator ? 'refund-receipt-1' : null,
    resultDetail: administrator ? 'Provider refund confirmed.' : null,
    version: 2,
    createdAt: generatedAt,
    updatedAt: generatedAt,
  };
}

function receipt(administrator = false, suffix = '') {
  return {
    commandId,
    serviceOrderId: orderId,
    state: 'SUCCEEDED',
    statusHref: `${administrator ? '/v1/admin' : '/v1'}/workplace/service-orders/${orderId}${suffix}`,
    replayed: false,
    correlationId: 'screen-18-test',
    acceptedAt: generatedAt,
  };
}

function command(administrator = false) {
  return { order: order(administrator), receipt: receipt(administrator) };
}

function cancellationImpact() {
  return {
    cancellationPreviewId: previewId,
    serviceOrderId: orderId,
    serviceOrderLineId: lineId,
    orderVersion: 3,
    lineVersion: 2,
    cancelQuantity: 1,
    fulfilledQuantity: 1,
    previouslyCancelledQuantity: 0,
    remainingQuantity: 2,
    refundScope: 'PARTIAL',
    refundableAmount: 25_000,
    currency: 'KRW',
    eligible: true,
    reason: 'Meeting changed',
    expiresAt: '2026-09-17T00:12:00Z',
    generatedAt,
  };
}

function lineCommand(administrator = false) {
  return {
    adjustment: adjustment(administrator),
    order: order(administrator),
    receipt: receipt(administrator, `/line-adjustments/${adjustmentId}`),
  };
}

function scanCommand() {
  return {
    attachment: attachment(true),
    receipt: receipt(true, `/attachments/${attachmentId}/scan-status`),
  };
}

function response(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    text: async () => JSON.stringify({ data }),
  } as Response;
}

describe('Workplace reservation services contract', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('loads 101 records as two bounded cursor pages without silent truncation', async () => {
    const firstItems = Array.from({ length: 100 }, () => order());
    expect(() => parseWorkplaceServiceOrders(page([...firstItems, order()], true))).toThrow(
      /orders.items/u
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(page(firstItems, true)))
      .mockResolvedValueOnce(response(page([order()])));
    vi.stubGlobal('fetch', fetchMock);

    const first = await getWorkplaceServiceOrders({ limit: 100 });
    const second = await getWorkplaceServiceOrders({ cursor: first.nextCursor, limit: 100 });

    expect([...first.items, ...second.items]).toHaveLength(101);
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/api/platform/v1/workplace/service-orders?limit=100',
      `/api/platform/v1/workplace/service-orders?cursor=${cursor}&limit=100`,
    ]);
  });

  it('rejects requester projection leaks while allowing the matching admin projection', () => {
    expect(() =>
      parseWorkplaceServiceOrder({ ...order(), providerOperationReference: 'provider-raw' })
    ).toThrow(/providerOperationReference/u);
    expect(() =>
      parseWorkplaceServiceOrder({
        ...order(),
        tasks: [{ ...order().tasks[0], assigneeUserId: 77 }],
      })
    ).toThrow(/tasks/u);
    expect(parseWorkplaceServiceOrder(order(true), true).tasks[0]?.assigneeUserId).toBe(77);

    expect(() =>
      parseWorkplaceServiceOrderEventsPage(page([{ ...requesterEvent(), actorUserId: 99 }]))
    ).toThrow(/actorUserId/u);
    expect(() =>
      parseWorkplaceServiceOrderEventsPage(
        page([requesterEvent({ providerOperationReference: 'provider-raw' })])
      )
    ).toThrow(/providerOperationReference/u);
    expect(
      parseWorkplaceServiceOrderEventsPage(page([{ ...requesterEvent(), actorUserId: 99 }]), true)
        .items[0]?.actorUserId
    ).toBe(99);

    expect(() =>
      parseWorkplaceServiceOrderMessagesPage(page([{ ...requesterMessage(), authorUserId: 99 }]))
    ).toThrow(/authorUserId/u);
    expect(
      parseWorkplaceServiceOrderMessagesPage(
        page([{ ...requesterMessage(), authorUserId: 99 }]),
        true
      ).items[0]?.authorUserId
    ).toBe(99);
    expect(() => parseWorkplaceServiceOrderAttachmentsPage(page([attachment(true)]))).toThrow(
      /attachments.items/u
    );
    expect(
      parseWorkplaceServiceOrderAttachmentsPage(page([attachment(true)]), true).items[0]
        ?.scannerEvidenceReference
    ).toBe('scanner-job-1');
    expect(() => parseWorkplaceServiceLineAdjustment(adjustment(true))).toThrow(/internalDetail/u);
    expect(parseWorkplaceServiceLineAdjustment(adjustment(true), true).resultDetail).toBeTruthy();
  });

  it('binds command receipts to the exact projection and resource path', () => {
    expect(parseWorkplaceServiceCommandResult(command()).receipt.statusHref).toBe(
      `/v1/workplace/service-orders/${orderId}`
    );
    expect(() =>
      parseWorkplaceServiceCommandResult({
        ...command(),
        receipt: { ...receipt(), statusHref: `/v1/admin/workplace/service-orders/${orderId}` },
      })
    ).toThrow(/receipt/u);
    expect(() =>
      parseWorkplaceServiceCommandResult({
        ...command(),
        receipt: { ...receipt(), statusHref: `https://evil.example/${orderId}` },
      })
    ).toThrow(/receipt/u);
    expect(
      parseWorkplaceServiceCommandResult(command(true), true).order.providerOperationReference
    ).toBe('provider-operation-1');
    expect(() =>
      parseWorkplaceServiceLineAdjustmentCommandResult({
        ...lineCommand(),
        receipt: receipt(false, `/line-adjustments/${attachmentId}`),
      })
    ).toThrow(/statusHref/u);
    expect(
      parseWorkplaceServiceLineAdjustmentCommandResult(lineCommand()).adjustment.lineAdjustmentId
    ).toBe(adjustmentId);
    expect(() =>
      parseWorkplaceServiceAttachmentScanCommandResult({
        ...scanCommand(),
        receipt: receipt(true, `/attachments/${adjustmentId}/scan-status`),
      })
    ).toThrow(/statusHref/u);
  });

  it('accepts durable cancellation and reconciliation pending adjustment states', () => {
    expect(
      parseWorkplaceServiceLineAdjustment({
        ...adjustment(),
        state: 'CANCELLATION_PENDING',
        refundedAmount: 0,
      }).state
    ).toBe('CANCELLATION_PENDING');
    expect(
      parseWorkplaceServiceLineAdjustment({
        ...adjustment(),
        state: 'RECONCILIATION_PENDING',
        refundedAmount: 0,
      }).state
    ).toBe('RECONCILIATION_PENDING');
  });

  it('calls cursor history, line recovery and attachment scan routes in the correct mode', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(page([requesterEvent()])))
      .mockResolvedValueOnce(response(page([requesterMessage()])))
      .mockResolvedValueOnce(response(page([attachment()])))
      .mockResolvedValueOnce(response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(response(cancellationImpact()))
      .mockResolvedValueOnce(response(lineCommand(), 202))
      .mockResolvedValueOnce(response(adjustment()))
      .mockResolvedValueOnce(response(lineCommand(true), 202))
      .mockResolvedValueOnce(response(scanCommand(), 202))
      .mockResolvedValueOnce(response(attachment(true)));
    vi.stubGlobal('fetch', fetchMock);

    await getWorkplaceServiceOrderEvents(orderId, { cursor, limit: 50 });
    await getWorkplaceServiceOrderMessages(orderId, { limit: 50 });
    await getWorkplaceServiceOrderAttachments(orderId, { limit: 50 });
    await previewWorkplaceServiceLineCancellation(orderId, lineId, {
      expectedOrderVersion: 3,
      expectedLineVersion: 2,
      cancelQuantity: 1,
      reason: 'Meeting changed',
    });
    await cancelWorkplaceServiceLine(
      orderId,
      lineId,
      {
        cancellationPreviewId: previewId,
        expectedOrderVersion: 3,
        expectedLineVersion: 2,
        explicitConfirmation: true,
        reason: 'Meeting changed',
      },
      { idempotencyKey: 'line-cancel' }
    );
    await getWorkplaceServiceLineAdjustment(orderId, adjustmentId);
    await reconcileWorkplaceServiceLineAdjustment(
      orderId,
      adjustmentId,
      { expectedVersion: 2, explicitConfirmation: true, reason: 'Reconcile provider receipt' },
      { idempotencyKey: 'line-reconcile', activeAccessMode: 'ELEVATED' }
    );
    await recordWorkplaceServiceAttachmentScan(
      orderId,
      attachmentId,
      {
        expectedVersion: 2,
        verdict: 'CLEAN',
        scannerEvidenceReference: 'scanner-job-1',
        detail: null,
        explicitConfirmation: true,
        reason: 'Scanner completed',
      },
      { idempotencyKey: 'attachment-scan', activeAccessMode: 'ELEVATED' }
    );
    await getWorkplaceServiceAttachmentScanStatus(orderId, attachmentId, 'ELEVATED');

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      `/api/platform/v1/workplace/service-orders/${orderId}/events?cursor=${cursor}&limit=50`,
      `/api/platform/v1/workplace/service-orders/${orderId}/messages?limit=50`,
      `/api/platform/v1/workplace/service-orders/${orderId}/attachments?limit=50`,
      '/api/auth/csrf',
      `/api/platform/v1/workplace/service-orders/${orderId}/lines/${lineId}/cancellation-impact:preview`,
      `/api/platform/v1/workplace/service-orders/${orderId}/lines/${lineId}:cancel`,
      `/api/platform/v1/workplace/service-orders/${orderId}/line-adjustments/${adjustmentId}`,
      `/api/platform/v1/admin/workplace/service-orders/${orderId}/line-adjustments/${adjustmentId}:reconcile`,
      `/api/platform/v1/admin/workplace/service-orders/${orderId}/attachments/${attachmentId}/scan-result`,
      `/api/platform/v1/admin/workplace/service-orders/${orderId}/attachments/${attachmentId}/scan-status`,
    ]);
    for (const index of [7, 8, 9]) {
      expect(
        new Headers((fetchMock.mock.calls[index]?.[1] as RequestInit).headers).get(
          'X-DWP-Active-Access-Mode'
        )
      ).toBe('ELEVATED');
    }
  });

  it('gates download on CLEAN and enforces fulfillment pagination and bounds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(page([order(true)])))
      .mockResolvedValueOnce(response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(response(command(true), 202))
      .mockResolvedValueOnce(
        new Response('%PDF-1.7', { headers: { 'Content-Type': 'application/pdf' } })
      );
    vi.stubGlobal('fetch', fetchMock);

    const queue = await getWorkplaceServiceFulfillmentQueue('SUBMITTED', { limit: 50 });
    expect(queue.items[0]?.tasks[0]?.assigneeUserId).toBe(77);
    await updateWorkplaceServiceFulfillment(
      orderId,
      taskId,
      {
        expectedVersion: 1,
        state: 'IN_PREPARATION',
        assigneeUserId: null,
        externalFulfillmentReference: null,
        blockerCode: null,
        blockerDetail: null,
        resultDetail: null,
        fulfilledQuantity: null,
        reason: 'Start preparation',
        explicitConfirmation: true,
      },
      { idempotencyKey: 'fulfillment-update', activeAccessMode: 'ELEVATED' }
    );
    await expect(
      downloadWorkplaceServiceOrderAttachment(orderId, attachment(false, 'QUARANTINED'))
    ).rejects.toThrow(/clean/u);
    const blob = await downloadWorkplaceServiceOrderAttachment(orderId, attachment());

    expect(blob.type).toBe('application/pdf');
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/api/platform/v1/admin/workplace/service-orders?state=SUBMITTED&limit=50',
      '/api/auth/csrf',
      `/api/platform/v1/admin/workplace/service-orders/${orderId}/tasks/${taskId}:update`,
      `/api/platform/v1/workplace/service-orders/${orderId}/attachments/${attachmentId}`,
    ]);
  });
});
