import { randomUUID } from 'node:crypto';

import { FULL_PRODUCT_PERMISSIONS, fulfillSuccess, mockShellSession } from './shell-session';
import { isolateWorkplaceDevelopmentUpdates } from './workplace-runtime-isolation';

import type { Page, Route } from '@playwright/test';

export const ORDER_ID = '18000000-0000-4000-8000-000000000101';
export const OTHER_ORDER_ID = '18000000-0000-4000-8000-000000000102';
export const RESERVATION_ID = '18000000-0000-4000-8000-000000000103';
export const LINE_ID = '18000000-0000-4000-8000-000000000104';
export const TASK_ID = '18000000-0000-4000-8000-000000000105';
export const ITEM_ID = '18000000-0000-4000-8000-000000000106';
export const ATTACHMENT_ID = '18000000-0000-4000-8000-000000000107';
export const MESSAGE_ID = '18000000-0000-4000-8000-000000000108';
export const EVENT_ID = '18000000-0000-4000-8000-000000000109';
export const SITE_ID = '18000000-0000-4000-8000-000000000110';
export const READY_ORDER_ID = '18000000-0000-4000-8000-000000000111';
export const READY_LINE_ID = '18000000-0000-4000-8000-000000000112';
export const READY_TASK_ID = '18000000-0000-4000-8000-000000000113';
export const PREVIEW_ID = '18000000-0000-4000-8000-000000000114';
export const ADJUSTMENT_ID = '18000000-0000-4000-8000-000000000115';
export const SECOND_EVENT_ID = '18000000-0000-4000-8000-000000000116';
export const SECOND_MESSAGE_ID = '18000000-0000-4000-8000-000000000117';
export const SECOND_ATTACHMENT_ID = '18000000-0000-4000-8000-000000000118';
export const PAGE_CURSOR = 'screen-18-page-2';
export const EVENT_CURSOR = 'screen-18-events-2';
export const MESSAGE_CURSOR = 'screen-18-messages-2';
export const ATTACHMENT_CURSOR = 'screen-18-attachments-2';
const GOVERNED_PRODUCTS = [
  'approvals',
  'calendar',
  'communications',
  'dwaion',
  'hcm',
  'mail',
  'meetings',
  'messaging',
  'notifications',
  'services',
  'spaces',
  'workplace',
] as const;

export type Locale = 'en' | 'ko';

function line(
  state = 'RESULT_UNKNOWN',
  providerState = 'READY',
  serviceOrderLineId = LINE_ID,
  inspectionMode: 'NONE' | 'OPERATOR' | 'REQUESTER' = 'NONE'
) {
  return {
    serviceOrderLineId,
    catalogItemId: ITEM_ID,
    serviceCode: 'AV_ASSIST',
    category: 'AV',
    nameKo: 'AV 사전 점검',
    nameEn: 'AV readiness',
    providerState,
    providerCode: 'DWP_NATIVE_FULFILLMENT',
    catalogVersion: 3,
    providerConfigurationVersion: 1,
    siteScope: [SITE_ID],
    supportedResourceTypes: ['ROOM', 'DESK'],
    quantity: 2,
    options: { microphoneCount: 2 },
    optionSchema: [
      {
        key: 'microphoneCount',
        labelKo: '마이크 수량',
        labelEn: 'Microphone count',
        type: 'NUMBER',
        required: true,
        minimum: 1,
        maximum: 8,
      },
    ],
    unitPrice: 25000,
    estimatedCost: 50000,
    currency: 'KRW',
    cancellationCutoffMinutes: 60,
    cancellationPolicyKo: '시작 1시간 전까지 취소',
    cancellationPolicyEn: 'Cancel until one hour before',
    slaResponseMinutes: 15,
    slaFulfillmentLeadMinutes: 45,
    minimumQuantity: 1,
    maximumQuantity: 10,
    orderCutoffMinutes: 90,
    inspectionMode,
    inspectionChecklistSchema:
      inspectionMode === 'NONE'
        ? []
        : [
            {
              key: 'equipment_ready',
              type: 'BOOLEAN',
              required: true,
              labelKo: '장비 준비 확인',
              labelEn: 'Equipment ready',
            },
          ],
    state,
    fulfilledQuantity: state === 'FULFILLED' ? 2 : state === 'PARTIALLY_FULFILLED' ? 1 : 0,
    cancelledQuantity: 0,
    refundedAmount: 0,
    blockerCode: state === 'BLOCKED' ? 'ROOM_ACCESS' : null,
    version: 3,
  };
}

function task(
  state = 'RESULT_UNKNOWN',
  providerState = 'READY',
  id = TASK_ID,
  serviceOrderLineId = LINE_ID,
  administrator = false
) {
  return {
    fulfillmentTaskId: id,
    serviceOrderLineId,
    state,
    providerState,
    providerCode: 'DWP_NATIVE_FULFILLMENT',
    assigneeUserId: administrator ? 1801 : null,
    assigneeDirectorySubjectId: administrator ? 'subject:workplace:operator-18' : null,
    assigneeDisplayName: administrator ? 'Casey Kim' : null,
    assigneeSecondaryLabel: administrator ? 'AV operations' : null,
    responseDueAt: '2026-09-17T00:21:00Z',
    dueAt: '2026-09-20T00:30:00Z',
    providerReceiptAt: null,
    acceptedAt: '2026-09-17T00:05:00Z',
    completedAt: null,
    externalFulfillmentReference: administrator ? 'FUL-18' : null,
    blockerCode: state === 'BLOCKED' ? 'ROOM_ACCESS' : null,
    blockerDetail: state === 'BLOCKED' ? 'Room access is not confirmed.' : null,
    resultDetail: state === 'RESULT_UNKNOWN' ? 'Provider receipt is being recovered.' : null,
    responseRemainingSeconds: 900,
    fulfillmentRemainingSeconds: 259200,
    responseBreached: false,
    fulfillmentBreached: false,
    version: 4,
    updatedAt: '2026-09-17T00:06:00Z',
  };
}

export function serviceOrder({
  id = ORDER_ID,
  state = 'RESULT_UNKNOWN',
  workState = 'RESULT_UNKNOWN',
  providerState = 'READY',
  version = 7,
  impact = 'RECONFIRMATION_REQUIRED',
  serviceOrderLineId = LINE_ID,
  fulfillmentTaskId = TASK_ID,
  administrator = false,
  requesterUserId = 18001,
  inspectionMode = 'NONE',
}: {
  id?: string;
  state?: string;
  workState?: string;
  providerState?: string;
  version?: number;
  impact?: string;
  serviceOrderLineId?: string;
  fulfillmentTaskId?: string;
  administrator?: boolean;
  requesterUserId?: number;
  inspectionMode?: 'NONE' | 'OPERATOR' | 'REQUESTER';
} = {}) {
  return {
    serviceOrderId: id,
    requesterUserId,
    reservationAuthority: 'WORKPLACE',
    reservationId: RESERVATION_ID,
    reservationVersion: 4,
    currentReservationVersion: 5,
    reservationStartsAt: '2026-09-20T01:00:00Z',
    reservationEndsAt: '2026-09-20T02:00:00Z',
    siteReference: SITE_ID,
    resourceReference: 'Seoul HQ · Horizon room 18',
    attendeeCount: 8,
    costCenter: 'CC-1800',
    estimatedCost: 50000,
    currency: 'KRW',
    specialRequest: 'No equipment PIN is stored.',
    state,
    reservationImpact: impact,
    reconfirmationRequired: impact === 'RECONFIRMATION_REQUIRED',
    providerOperationReference: administrator ? 'provider-operation-18' : null,
    resultDetail: state === 'RESULT_UNKNOWN' ? 'Provider receipt is being recovered.' : null,
    version,
    createdAt: '2026-09-17T00:01:00Z',
    updatedAt: '2026-09-17T00:06:00Z',
    lines: [line(workState, providerState, serviceOrderLineId, inspectionMode)],
    tasks: [task(workState, providerState, fulfillmentTaskId, serviceOrderLineId, administrator)],
    eventCount: 2,
    messageCount: 2,
    attachmentCount: 2,
  };
}

function ordinalId(ordinal: number) {
  return `18000000-0000-4000-8000-${String(ordinal).padStart(12, '0')}`;
}

function orderProjection<T extends ReturnType<typeof serviceOrder>>(
  order: T,
  administrator: boolean
) {
  return {
    ...order,
    providerOperationReference: administrator ? 'provider-operation-18' : null,
    tasks: order.tasks.map((item) => ({
      ...item,
      assigneeUserId: administrator ? 1801 : null,
      assigneeDirectorySubjectId: administrator ? 'subject:workplace:operator-18' : null,
      assigneeDisplayName: administrator ? 'Casey Kim' : null,
      assigneeSecondaryLabel: administrator ? 'AV operations' : null,
      externalFulfillmentReference: administrator ? 'FUL-18' : null,
    })),
  };
}

function eventPage(administrator: boolean, cursor: string | null, includeRecovery = false) {
  const first = {
    eventId: EVENT_ID,
    eventType: includeRecovery ? 'LINE_CANCELLATION_RESULT_UNKNOWN' : 'SUBMITTED',
    ...(administrator ? { actorUserId: 18001 } : {}),
    detail: includeRecovery ? { lineAdjustmentId: ADJUSTMENT_ID, serviceOrderLineId: LINE_ID } : {},
    occurredAt: '2026-09-17T00:01:00Z',
  };
  const second = {
    eventId: SECOND_EVENT_ID,
    eventType: 'MESSAGE_ADDED',
    ...(administrator ? { actorUserId: 18002 } : {}),
    detail: {},
    occurredAt: '2026-09-17T00:04:00Z',
  };
  return cursor
    ? { items: [second], nextCursor: null, hasMore: false, generatedAt: '2026-09-17T00:07:00Z' }
    : {
        items: [first],
        nextCursor: EVENT_CURSOR,
        hasMore: true,
        generatedAt: '2026-09-17T00:07:00Z',
      };
}

function messagePage(administrator: boolean, cursor: string | null) {
  const item = cursor
    ? {
        messageId: SECOND_MESSAGE_ID,
        ...(administrator ? { authorUserId: 18002 } : {}),
        authorDisplayName: 'Service operator',
        authorRole: 'OPERATOR',
        message: 'Delivery route confirmed.',
        createdAt: '2026-09-17T00:05:00Z',
      }
    : {
        messageId: MESSAGE_ID,
        ...(administrator ? { authorUserId: 18001 } : {}),
        authorDisplayName: null,
        authorRole: 'REQUESTER',
        message: 'Use the east entrance for delivery.',
        createdAt: '2026-09-17T00:04:00Z',
      };
  return {
    items: [item],
    nextCursor: cursor ? null : MESSAGE_CURSOR,
    hasMore: !cursor,
    generatedAt: '2026-09-17T00:07:00Z',
  };
}

function attachmentPage(administrator: boolean, cursor: string | null, clean = false) {
  const item = cursor
    ? {
        attachmentId: SECOND_ATTACHMENT_ID,
        fileName: 'delivery-note.pdf',
        contentType: 'application/pdf',
        byteSize: 12,
        scanState: 'CLEAN',
        scanVersion: 1,
        scannerEvidenceReference: administrator ? 'scanner-job-17' : null,
        scanDetail: administrator ? 'No malware found.' : null,
        scannedAt: '2026-09-17T00:06:00Z',
        createdAt: '2026-09-17T00:05:30Z',
      }
    : {
        attachmentId: ATTACHMENT_ID,
        fileName: 'approved-layout.pdf',
        contentType: 'application/pdf',
        byteSize: 9,
        scanState: clean ? 'CLEAN' : 'QUARANTINED',
        scanVersion: clean ? 3 : 2,
        scannerEvidenceReference: administrator && clean ? 'scanner-job-18' : null,
        scanDetail: administrator && clean ? 'No malware found.' : null,
        scannedAt: clean ? '2026-09-17T00:08:00Z' : null,
        createdAt: '2026-09-17T00:05:00Z',
      };
  return {
    items: [item],
    nextCursor: cursor ? null : ATTACHMENT_CURSOR,
    hasMore: !cursor,
    generatedAt: '2026-09-17T00:07:00Z',
  };
}

export function command(
  order: ReturnType<typeof serviceOrder>,
  state = 'SUCCEEDED',
  administrator = false,
  suffix = ''
) {
  return {
    order: orderProjection(order, administrator),
    receipt: {
      commandId: randomUUID(),
      serviceOrderId: order.serviceOrderId,
      state,
      statusHref: `${administrator ? '/v1/admin' : '/v1'}/workplace/service-orders/${order.serviceOrderId}${suffix}`,
      replayed: false,
      correlationId: 'screen-18-e2e',
      acceptedAt: '2026-09-17T00:07:00Z',
    },
  };
}

function lineAdjustment(administrator = false, state = 'RECONCILIATION_PENDING') {
  return {
    lineAdjustmentId: ADJUSTMENT_ID,
    serviceOrderId: ORDER_ID,
    serviceOrderLineId: LINE_ID,
    cancellationPreviewId: PREVIEW_ID,
    cancelQuantity: 1,
    refundScope: 'PARTIAL',
    refundableAmount: 25000,
    refundedAmount: state === 'REFUNDED' ? 25000 : 0,
    currency: 'KRW',
    state,
    providerOperationReference: administrator ? 'provider-cancel-18' : null,
    refundReceiptReference: administrator && state === 'REFUNDED' ? 'refund-receipt-18' : null,
    resultDetail: administrator ? 'Provider receipt has not reached a terminal state.' : null,
    version: state === 'REFUNDED' ? 2 : 1,
    createdAt: '2026-09-17T00:07:00Z',
    updatedAt: state === 'REFUNDED' ? '2026-09-17T00:09:00Z' : '2026-09-17T00:07:00Z',
  };
}

function lineCancellationImpact() {
  return {
    cancellationPreviewId: PREVIEW_ID,
    serviceOrderId: ORDER_ID,
    serviceOrderLineId: LINE_ID,
    orderVersion: 7,
    lineVersion: 3,
    cancelQuantity: 1,
    fulfilledQuantity: 0,
    previouslyCancelledQuantity: 0,
    remainingQuantity: 1,
    refundScope: 'PARTIAL',
    refundableAmount: 25000,
    currency: 'KRW',
    eligible: true,
    reason: 'The meeting needs one fewer microphone.',
    expiresAt: '2026-09-17T00:17:00Z',
    generatedAt: '2026-09-17T00:07:00Z',
  };
}

function lineCommand(
  order: ReturnType<typeof serviceOrder>,
  administrator = false,
  state = 'RECONCILIATION_PENDING'
) {
  return {
    adjustment: lineAdjustment(administrator, state),
    order: orderProjection(order, administrator),
    receipt: command(
      order,
      ['RECONCILIATION_PENDING', 'RESULT_UNKNOWN'].includes(state)
        ? 'RESULT_UNKNOWN'
        : state === 'CANCELLATION_PENDING'
          ? 'ACCEPTED'
          : 'SUCCEEDED',
      administrator,
      `/line-adjustments/${ADJUSTMENT_ID}`
    ).receipt,
  };
}

function scanCommand(order: ReturnType<typeof serviceOrder>, clean: boolean) {
  return {
    attachment: attachmentPage(true, null, clean).items[0],
    receipt: command(order, 'SUCCEEDED', true, `/attachments/${ATTACHMENT_ID}/scan-status`).receipt,
  };
}

export function catalogItem(overrides: Record<string, unknown> = {}) {
  return {
    catalogItemId: ITEM_ID,
    serviceCode: 'AV_ASSIST',
    category: 'AV',
    nameKo: 'AV 사전 점검',
    nameEn: 'AV readiness',
    descriptionKo: '회의 전 장비 점검',
    descriptionEn: 'Equipment readiness before the meeting',
    providerState: 'READY',
    providerCode: 'DWP_NATIVE_FULFILLMENT',
    optionSchema: [
      {
        key: 'microphoneCount',
        labelKo: '마이크 수량',
        labelEn: 'Microphone count',
        type: 'NUMBER',
        required: true,
        minimum: 1,
        maximum: 8,
      },
      {
        key: 'layout',
        labelKo: '좌석 배치',
        labelEn: 'Room layout',
        type: 'SINGLE_SELECT',
        required: false,
        values: ['BOARDROOM', 'CLASSROOM'],
      },
    ],
    supportedResourceTypes: ['ROOM', 'DESK'],
    unitPrice: 25000,
    currency: 'KRW',
    minimumQuantity: 1,
    maximumQuantity: 10,
    orderCutoffMinutes: 90,
    cancellationCutoffMinutes: 60,
    slaResponseMinutes: 15,
    slaFulfillmentLeadMinutes: 45,
    cancellationPolicyKo: '시작 1시간 전까지 취소',
    cancellationPolicyEn: 'Cancel until one hour before',
    capacityMode: 'UNBOUNDED',
    capacityFreshnessSeconds: 900,
    inspectionMode: 'NONE',
    inspectionChecklistSchema: [],
    requiresAttendeeCount: true,
    requiresCostCenter: true,
    version: 3,
    ...overrides,
  };
}

function adminCatalogItem(item = catalogItem(), lifecycleState: 'ACTIVE' | 'INACTIVE' = 'ACTIVE') {
  return {
    item,
    siteScope: [SITE_ID],
    lifecycleState,
    updatedAt: '2026-09-17T00:00:00Z',
  };
}

function catalogCommand(item: ReturnType<typeof adminCatalogItem>, state = 'SUCCEEDED') {
  return {
    item,
    receipt: {
      commandId: randomUUID(),
      catalogItemId: item.item.catalogItemId,
      state,
      statusHref: `/v1/admin/workplace/service-catalog/${item.item.catalogItemId}`,
      replayed: false,
      correlationId: 'screen-18-e2e',
      acceptedAt: '2026-09-17T00:07:00Z',
    },
  };
}

export function fulfillAccepted(route: Route, data: unknown) {
  return route.fulfill({
    status: 202,
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'Accepted', data }),
  });
}

export async function elevatedAuthority(page: Page) {
  await page.unroute('**/api/auth/product-surface-contexts');
  await page.route('**/api/auth/product-surface-contexts', (route) =>
    fulfillSuccess(route, {
      contractVersion: 'product-surfaces/v3',
      decisionRevision: 'screen-18-elevated',
      sourceRevisions: { auth: '18', policy: '18', productRelationship: '18' },
      activeAccessMode: 'ELEVATED',
      generatedAt: '2026-09-17T00:00:00Z',
      contexts: [],
      rollouts: GOVERNED_PRODUCTS.map((productKey) => ({
        productKey,
        state: '000',
        flags: {
          contextShadow: false,
          capabilityEnforcement: false,
          surfaceUi: false,
        },
        cohort: 'baseline',
        opaqueRevision: `rollout-${productKey}-baseline`,
        authorityStatus: 'NOT_EVALUATED',
      })),
    })
  );
}

type Evidence = {
  attachmentPosts: () => number;
  cancelBodies: Array<unknown>;
  cancelKeys: string[];
  cancelPosts: () => number;
  catalogStateBodies: Array<unknown>;
  catalogStatePosts: () => number;
  catalogUpdateBodies: Array<unknown>;
  catalogUpdatePosts: () => number;
  detailReads: () => number;
  downloadGets: () => number;
  eventCursors: string[];
  fulfillmentBodies: Array<unknown>;
  fulfillmentKeys: string[];
  fulfillmentPosts: () => number;
  lineCancelBodies: Array<unknown>;
  lineCancelPosts: () => number;
  linePreviewBodies: Array<unknown>;
  linePreviewPosts: () => number;
  lineRecoveryGets: () => number;
  lineReconcilePosts: () => number;
  listCursors: string[];
  listIds: readonly string[];
  messageCursors: string[];
  messageKeys: string[];
  messagePosts: () => number;
  reconfirmPosts: () => number;
  scanBodies: Array<unknown>;
  scanPosts: () => number;
  attachmentCursors: string[];
};

export async function mockServices(
  page: Page,
  locale: Locale,
  timeoutFirstMessage = false,
  options: {
    largeOrderSet?: boolean;
    quarantinedAttachment?: boolean;
    readOnly?: boolean;
    requesterInspection?: boolean;
  } = {}
) {
  await isolateWorkplaceDevelopmentUpdates(page);
  await mockShellSession(page, options.readOnly ? ['EMPLOYEE'] : ['TENANT_ADMIN'], {
    locale,
    permissions: options.readOnly
      ? [
          {
            resourceType: 'APP',
            resourceKey: 'APP.WORKPLACE',
            permissionCode: 'VIEW',
            effect: 'ALLOW',
          },
        ]
      : FULL_PRODUCT_PERMISSIONS,
  });
  await elevatedAuthority(page);
  let current = serviceOrder(
    options.requesterInspection
      ? {
          state: 'FULFILLED',
          workState: 'FULFILLED',
          impact: 'NONE',
          inspectionMode: 'REQUESTER',
        }
      : undefined
  );
  const secondary = serviceOrder({
    id: OTHER_ORDER_ID,
    state: 'BLOCKED',
    workState: 'NOT_CONFIGURED',
    providerState: 'NOT_CONFIGURED',
    impact: 'NONE',
  });
  let ready = serviceOrder({
    id: READY_ORDER_ID,
    state: 'IN_PREPARATION',
    workState: 'IN_PREPARATION',
    impact: 'NONE',
    serviceOrderLineId: READY_LINE_ID,
    fulfillmentTaskId: READY_TASK_ID,
  });
  const bulkOrders = Array.from({ length: options.largeOrderSet ? 98 : 0 }, (_, index) =>
    serviceOrder({
      id: ordinalId(1000 + index),
      state: 'SUBMITTED',
      workState: 'SUBMITTED',
      impact: 'NONE',
      serviceOrderLineId: ordinalId(2000 + index),
      fulfillmentTaskId: ordinalId(3000 + index),
      requesterUserId: 18100 + index,
    })
  );
  const allOrders = () => [current, secondary, ready, ...bulkOrders];
  let catalog = adminCatalogItem();
  let detailReads = 0;
  let messagePosts = 0;
  let reconfirmPosts = 0;
  let attachmentPosts = 0;
  let fulfillmentPosts = 0;
  let cancelPosts = 0;
  let catalogUpdatePosts = 0;
  let catalogStatePosts = 0;
  let linePreviewPosts = 0;
  let lineCancelPosts = 0;
  let lineRecoveryGets = 0;
  let lineReconcilePosts = 0;
  let scanPosts = 0;
  let downloadGets = 0;
  let recoveryVisible = false;
  let postedMessageVisible = false;
  let attachmentClean = !options.quarantinedAttachment;
  let reconciled = false;
  const listCursors: string[] = [];
  const eventCursors: string[] = [];
  const messageCursors: string[] = [];
  const attachmentCursors: string[] = [];
  const messageKeys: string[] = [];
  const cancelKeys: string[] = [];
  const fulfillmentKeys: string[] = [];
  const cancelBodies: Array<unknown> = [];
  const fulfillmentBodies: Array<unknown> = [];
  const catalogUpdateBodies: Array<unknown> = [];
  const catalogStateBodies: Array<unknown> = [];
  const linePreviewBodies: Array<unknown> = [];
  const lineCancelBodies: Array<unknown> = [];
  const scanBodies: Array<unknown> = [];

  await page.route('**/api/platform/v1/workplace/service-orders**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const requestPath = url.pathname;
    const cursor = url.searchParams.get('cursor');

    if (request.method() === 'GET' && requestPath.endsWith(`/attachments/${ATTACHMENT_ID}`)) {
      downloadGets += 1;
      if (!attachmentClean) {
        return route.fulfill({ status: 409, contentType: 'application/json', body: '{}' });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        headers: { 'Content-Disposition': 'attachment; filename="approved-layout.pdf"' },
        body: Buffer.from('%PDF-1.7'),
      });
    }
    if (request.method() === 'GET' && requestPath.endsWith(`/${ORDER_ID}/events`)) {
      eventCursors.push(cursor ?? 'first');
      return fulfillSuccess(route, eventPage(false, cursor, recoveryVisible));
    }
    if (request.method() === 'GET' && requestPath.endsWith(`/${ORDER_ID}/messages`)) {
      messageCursors.push(cursor ?? 'first');
      const response = messagePage(false, cursor);
      return fulfillSuccess(
        route,
        !cursor && postedMessageVisible
          ? {
              ...response,
              items: [
                ...response.items,
                {
                  messageId: ordinalId(4118),
                  authorDisplayName: null,
                  authorRole: 'REQUESTER',
                  message: 'Please confirm the loading route.',
                  createdAt: '2026-09-17T00:08:00Z',
                },
              ],
            }
          : response
      );
    }
    if (request.method() === 'GET' && requestPath.endsWith(`/${ORDER_ID}/attachments`)) {
      attachmentCursors.push(cursor ?? 'first');
      return fulfillSuccess(route, attachmentPage(false, cursor, attachmentClean));
    }
    if (
      request.method() === 'GET' &&
      requestPath.endsWith(`/${ORDER_ID}/line-adjustments/${ADJUSTMENT_ID}`)
    ) {
      lineRecoveryGets += 1;
      return fulfillSuccess(
        route,
        lineAdjustment(false, reconciled ? 'REFUNDED' : 'RECONCILIATION_PENDING')
      );
    }
    if (
      request.method() === 'POST' &&
      requestPath.endsWith(`/${ORDER_ID}/lines/${LINE_ID}/cancellation-impact:preview`)
    ) {
      linePreviewPosts += 1;
      linePreviewBodies.push(request.postDataJSON());
      return fulfillSuccess(route, lineCancellationImpact());
    }
    if (
      request.method() === 'POST' &&
      requestPath.endsWith(`/${ORDER_ID}/lines/${LINE_ID}:cancel`)
    ) {
      lineCancelPosts += 1;
      lineCancelBodies.push(request.postDataJSON());
      recoveryVisible = true;
      current = {
        ...current,
        version: current.version + 1,
        lines: current.lines.map((item) => ({
          ...item,
          cancelledQuantity: item.cancelledQuantity + 1,
          version: item.version + 1,
        })),
      };
      return fulfillAccepted(route, lineCommand(current));
    }
    if (request.method() === 'GET' && requestPath.endsWith(`/${ORDER_ID}`)) {
      detailReads += 1;
      return fulfillSuccess(route, orderProjection(current, false));
    }
    if (request.method() === 'GET' && requestPath.endsWith(`/${OTHER_ORDER_ID}`)) {
      detailReads += 1;
      return fulfillSuccess(route, orderProjection(secondary, false));
    }
    if (request.method() === 'GET' && requestPath.endsWith(`/${READY_ORDER_ID}`)) {
      detailReads += 1;
      return fulfillSuccess(route, orderProjection(ready, false));
    }
    if (request.method() === 'GET' && requestPath.endsWith('/service-orders')) {
      detailReads += 1;
      listCursors.push(`${cursor ?? 'first'}:${url.searchParams.get('limit') ?? 'none'}`);
      const orders = allOrders();
      const items = cursor === PAGE_CURSOR ? orders.slice(100) : orders.slice(0, 100);
      return fulfillSuccess(route, {
        items: items.map((item) => orderProjection(item, false)),
        nextCursor: cursor === PAGE_CURSOR || orders.length <= 100 ? null : PAGE_CURSOR,
        hasMore: cursor !== PAGE_CURSOR && orders.length > 100,
        generatedAt: '2026-09-17T00:07:00Z',
      });
    }
    if (request.method() === 'POST' && requestPath.endsWith(`/${ORDER_ID}/messages`)) {
      messagePosts += 1;
      messageKeys.push(request.headers()['idempotency-key'] ?? '');
      if (timeoutFirstMessage && messagePosts === 1) return route.abort('timedout');
      postedMessageVisible = true;
      current = {
        ...current,
        version: current.version + 1,
        messageCount: current.messageCount + 1,
      };
      return fulfillAccepted(route, command(current));
    }
    if (request.method() === 'POST' && requestPath.endsWith(`/${ORDER_ID}:reconfirm`)) {
      reconfirmPosts += 1;
      current = {
        ...current,
        version: current.version + 1,
        reservationVersion: 5,
        reservationImpact: 'NONE',
        reconfirmationRequired: false,
      };
      return fulfillAccepted(route, command(current));
    }
    if (request.method() === 'POST' && requestPath.endsWith(`/${ORDER_ID}/attachments`)) {
      attachmentPosts += 1;
      return fulfillAccepted(route, command(current));
    }
    if (request.method() === 'POST' && requestPath.endsWith(`/${ORDER_ID}:cancel`)) {
      cancelPosts += 1;
      cancelBodies.push(request.postDataJSON());
      cancelKeys.push(request.headers()['idempotency-key'] ?? '');
      current = {
        ...current,
        state: 'CANCELLED',
        version: current.version + 1,
      };
      return fulfillAccepted(route, command(current));
    }
    return route.fallback();
  });

  await page.route('**/api/platform/v1/admin/workplace/service-orders**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const requestPath = url.pathname;
    const cursor = url.searchParams.get('cursor');

    if (request.method() === 'GET' && requestPath.endsWith(`/attachments/${ATTACHMENT_ID}`)) {
      downloadGets += 1;
      if (!attachmentClean) {
        return route.fulfill({ status: 409, contentType: 'application/json', body: '{}' });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        headers: { 'Content-Disposition': 'attachment; filename="approved-layout.pdf"' },
        body: Buffer.from('%PDF-1.7'),
      });
    }
    if (request.method() === 'GET' && requestPath.endsWith(`/${ORDER_ID}/events`)) {
      eventCursors.push(`admin:${cursor ?? 'first'}`);
      return fulfillSuccess(route, eventPage(true, cursor, recoveryVisible));
    }
    if (request.method() === 'GET' && requestPath.endsWith(`/${ORDER_ID}/messages`)) {
      messageCursors.push(`admin:${cursor ?? 'first'}`);
      return fulfillSuccess(route, messagePage(true, cursor));
    }
    if (request.method() === 'GET' && requestPath.endsWith(`/${ORDER_ID}/attachments`)) {
      attachmentCursors.push(`admin:${cursor ?? 'first'}`);
      return fulfillSuccess(route, attachmentPage(true, cursor, attachmentClean));
    }
    if (
      request.method() === 'GET' &&
      requestPath.endsWith(`/${ORDER_ID}/attachments/${ATTACHMENT_ID}/scan-status`)
    ) {
      return fulfillSuccess(route, attachmentPage(true, null, attachmentClean).items[0]);
    }
    if (
      request.method() === 'POST' &&
      requestPath.endsWith(`/${ORDER_ID}/attachments/${ATTACHMENT_ID}/scan-result`)
    ) {
      scanPosts += 1;
      scanBodies.push(request.postDataJSON());
      attachmentClean = true;
      return fulfillAccepted(route, scanCommand(current, true));
    }
    if (
      request.method() === 'GET' &&
      requestPath.endsWith(`/${ORDER_ID}/line-adjustments/${ADJUSTMENT_ID}`)
    ) {
      lineRecoveryGets += 1;
      return fulfillSuccess(
        route,
        lineAdjustment(true, reconciled ? 'REFUNDED' : 'RECONCILIATION_PENDING')
      );
    }
    if (
      request.method() === 'POST' &&
      requestPath.endsWith(`/${ORDER_ID}/line-adjustments/${ADJUSTMENT_ID}:reconcile`)
    ) {
      lineReconcilePosts += 1;
      reconciled = true;
      return fulfillAccepted(route, lineCommand(current, true, 'REFUNDED'));
    }
    if (request.method() === 'GET' && requestPath.endsWith(`/${ORDER_ID}`)) {
      detailReads += 1;
      return fulfillSuccess(route, orderProjection(current, true));
    }
    if (request.method() === 'GET' && requestPath.endsWith(`/${OTHER_ORDER_ID}`)) {
      detailReads += 1;
      return fulfillSuccess(route, orderProjection(secondary, true));
    }
    if (request.method() === 'GET' && requestPath.endsWith(`/${READY_ORDER_ID}`)) {
      detailReads += 1;
      return fulfillSuccess(route, orderProjection(ready, true));
    }
    if (request.method() === 'GET' && requestPath.endsWith('/service-orders')) {
      detailReads += 1;
      const orders = allOrders();
      const items = cursor === PAGE_CURSOR ? orders.slice(100) : orders.slice(0, 100);
      return fulfillSuccess(route, {
        items: items.map((item) => orderProjection(item, true)),
        nextCursor: cursor === PAGE_CURSOR || orders.length <= 100 ? null : PAGE_CURSOR,
        hasMore: cursor !== PAGE_CURSOR && orders.length > 100,
        generatedAt: '2026-09-17T00:07:00Z',
      });
    }
    if (request.method() === 'POST' && requestPath.includes('/tasks/')) {
      fulfillmentPosts += 1;
      fulfillmentBodies.push(request.postDataJSON());
      fulfillmentKeys.push(request.headers()['idempotency-key'] ?? '');
      const input = request.postDataJSON() as {
        state: string;
        fulfilledQuantity: number | null;
        assigneeUserId: number | null;
        externalFulfillmentReference: string | null;
        blockerCode: string | null;
        blockerDetail: string | null;
        resultDetail: string | null;
      };
      const previousTask = ready.tasks[0];
      const previousLine = ready.lines[0];
      ready = {
        ...ready,
        state: input.state,
        version: ready.version + 1,
        lines: [
          {
            ...previousLine,
            state: input.state,
            fulfilledQuantity: input.fulfilledQuantity ?? previousLine.fulfilledQuantity,
            version: previousLine.version + 1,
          },
        ],
        tasks: [
          {
            ...previousTask,
            state: input.state,
            assigneeUserId: input.assigneeUserId,
            externalFulfillmentReference: input.externalFulfillmentReference,
            blockerCode: input.blockerCode,
            blockerDetail: input.blockerDetail,
            resultDetail: input.resultDetail,
            completedAt: input.state === 'FULFILLED' ? '2026-09-17T00:08:00Z' : null,
            version: previousTask.version + 1,
            updatedAt: '2026-09-17T00:08:00Z',
          },
        ],
      };
      return fulfillAccepted(route, command(ready, 'SUCCEEDED', true));
    }
    return route.fallback();
  });

  await page.route('**/api/platform/v1/admin/workplace/service-catalog**', (route) => {
    const request = route.request();
    const requestPath = new URL(request.url()).pathname;
    if (request.method() === 'GET') {
      return fulfillSuccess(route, {
        items: [catalog],
        generatedAt: '2026-09-17T00:07:00Z',
      });
    }
    if (request.method() === 'PUT' && requestPath.endsWith(`/${ITEM_ID}`)) {
      catalogUpdatePosts += 1;
      const body = request.postDataJSON() as Record<string, unknown>;
      catalogUpdateBodies.push(body);
      catalog = adminCatalogItem(
        catalogItem({ ...body, catalogItemId: ITEM_ID, serviceCode: 'AV_ASSIST', version: 4 })
      );
      return fulfillAccepted(route, catalogCommand(catalog));
    }
    if (request.method() === 'POST' && requestPath.endsWith(`/${ITEM_ID}:state`)) {
      catalogStatePosts += 1;
      const body = request.postDataJSON() as { active: boolean };
      catalogStateBodies.push(body);
      catalog = adminCatalogItem(
        catalogItem({ ...catalog.item, version: catalog.item.version + 1 }),
        body.active ? 'ACTIVE' : 'INACTIVE'
      );
      return fulfillAccepted(route, catalogCommand(catalog));
    }
    return route.fallback();
  });
  await page.route('**/api/platform/v1/admin/workplace/sites', (route) =>
    fulfillSuccess(route, [])
  );

  return {
    attachmentPosts: () => attachmentPosts,
    cancelBodies,
    cancelKeys,
    cancelPosts: () => cancelPosts,
    catalogStateBodies,
    catalogStatePosts: () => catalogStatePosts,
    catalogUpdateBodies,
    catalogUpdatePosts: () => catalogUpdatePosts,
    detailReads: () => detailReads,
    downloadGets: () => downloadGets,
    eventCursors,
    fulfillmentBodies,
    fulfillmentKeys,
    fulfillmentPosts: () => fulfillmentPosts,
    lineCancelBodies,
    lineCancelPosts: () => lineCancelPosts,
    linePreviewBodies,
    linePreviewPosts: () => linePreviewPosts,
    lineRecoveryGets: () => lineRecoveryGets,
    lineReconcilePosts: () => lineReconcilePosts,
    listCursors,
    listIds: allOrders().map((order) => order.serviceOrderId),
    messageCursors,
    messageKeys,
    messagePosts: () => messagePosts,
    reconfirmPosts: () => reconfirmPosts,
    scanBodies,
    scanPosts: () => scanPosts,
    attachmentCursors,
  } satisfies Evidence;
}
