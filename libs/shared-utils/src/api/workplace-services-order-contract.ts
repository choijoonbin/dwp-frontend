import {
  WORKPLACE_SERVICE_CATEGORIES,
  WORKPLACE_SERVICE_ORDER_STATES,
  WORKPLACE_SERVICE_PROVIDER_STATES,
  WORKPLACE_SERVICE_WORK_STATES,
} from './workplace-services-types';
import {
  bool,
  enumeration,
  instant,
  integer,
  invalid,
  list,
  nullableInstant,
  nullableInteger,
  nullableText,
  number,
  object,
  pageCursor,
  pageList,
  record,
  stringList,
  text,
  uuid,
} from './workplace-services-contract-helpers';

import type {
  WorkplaceServiceAttachmentScanCommandResult,
  WorkplaceServiceAttachmentScanState,
  WorkplaceServiceCategory,
  WorkplaceServiceCommandResult,
  WorkplaceServiceCommandState,
  WorkplaceServiceFulfillmentTask,
  WorkplaceServiceInspectionMode,
  WorkplaceServiceLineAdjustment,
  WorkplaceServiceLineAdjustmentCommandResult,
  WorkplaceServiceLineAdjustmentState,
  WorkplaceServiceLineCancellationImpact,
  WorkplaceServiceOrder,
  WorkplaceServiceOrderAttachment,
  WorkplaceServiceOrderAttachmentsPage,
  WorkplaceServiceOrderEvent,
  WorkplaceServiceOrderEventsPage,
  WorkplaceServiceOrderLine,
  WorkplaceServiceOrderMessage,
  WorkplaceServiceOrderMessagesPage,
  WorkplaceServiceOrders,
  WorkplaceServiceOrderState,
  WorkplaceServiceProviderState,
  WorkplaceServiceRefundScope,
  WorkplaceServiceReservationAuthority,
  WorkplaceServiceReservationImpact,
  WorkplaceServiceWorkState,
} from './workplace-services-types';

const categories = new Set<WorkplaceServiceCategory>(WORKPLACE_SERVICE_CATEGORIES);
const providerStates = new Set<WorkplaceServiceProviderState>(WORKPLACE_SERVICE_PROVIDER_STATES);
const orderStates = new Set<WorkplaceServiceOrderState>(WORKPLACE_SERVICE_ORDER_STATES);
const workStates = new Set<WorkplaceServiceWorkState>(WORKPLACE_SERVICE_WORK_STATES);
const authorities = new Set<WorkplaceServiceReservationAuthority>(['WORKPLACE', 'CALENDAR']);
const impacts = new Set<WorkplaceServiceReservationImpact>([
  'NONE',
  'RECONFIRMATION_REQUIRED',
  'CANCELLATION_REVIEW',
]);
const commandStates = new Set<WorkplaceServiceCommandState>([
  'ACCEPTED',
  'SUCCEEDED',
  'FAILED',
  'RESULT_UNKNOWN',
]);
const refundScopes = new Set<WorkplaceServiceRefundScope>(['FULL', 'PARTIAL', 'NONE']);
const lineAdjustmentStates = new Set<WorkplaceServiceLineAdjustmentState>([
  'CANCELLATION_PENDING',
  'RECONCILIATION_PENDING',
  'CANCELLATION_SUCCEEDED',
  'REFUNDED',
  'REFUND_NOT_CONFIGURED',
  'FAILED',
  'RESULT_UNKNOWN',
]);
const attachmentScanStates = new Set<WorkplaceServiceAttachmentScanState>([
  'NOT_CONFIGURED',
  'QUARANTINED',
  'CLEAN',
  'INFECTED',
  'ERROR',
]);
const inspectionModes = new Set<WorkplaceServiceInspectionMode>(['NONE', 'OPERATOR', 'REQUESTER']);

function parseLine(value: unknown, path: string): WorkplaceServiceOrderLine {
  const data = record(value, path);
  return Object.freeze({
    serviceOrderLineId: uuid(data.serviceOrderLineId, `${path}.serviceOrderLineId`),
    catalogItemId: uuid(data.catalogItemId, `${path}.catalogItemId`),
    serviceCode: text(data.serviceCode, `${path}.serviceCode`, 80),
    category: enumeration(data.category, categories, `${path}.category`),
    nameKo: text(data.nameKo, `${path}.nameKo`, 160),
    nameEn: text(data.nameEn, `${path}.nameEn`, 160),
    providerState: enumeration(data.providerState, providerStates, `${path}.providerState`),
    providerCode: text(data.providerCode, `${path}.providerCode`, 80),
    catalogVersion: integer(data.catalogVersion, `${path}.catalogVersion`),
    providerConfigurationVersion: integer(
      data.providerConfigurationVersion,
      `${path}.providerConfigurationVersion`
    ),
    siteScope: list(data.siteScope, `${path}.siteScope`, uuid),
    supportedResourceTypes: stringList(
      data.supportedResourceTypes,
      `${path}.supportedResourceTypes`
    ),
    quantity: integer(data.quantity, `${path}.quantity`),
    options: object(data.options, `${path}.options`),
    optionSchema: list(data.optionSchema, `${path}.optionSchema`, object),
    unitPrice: number(data.unitPrice, `${path}.unitPrice`),
    estimatedCost: number(data.estimatedCost, `${path}.estimatedCost`),
    currency: text(data.currency, `${path}.currency`, 3),
    cancellationCutoffMinutes: integer(
      data.cancellationCutoffMinutes,
      `${path}.cancellationCutoffMinutes`
    ),
    cancellationPolicyKo: text(data.cancellationPolicyKo, `${path}.cancellationPolicyKo`, 1000),
    cancellationPolicyEn: text(data.cancellationPolicyEn, `${path}.cancellationPolicyEn`, 1000),
    slaResponseMinutes: integer(data.slaResponseMinutes, `${path}.slaResponseMinutes`),
    slaFulfillmentLeadMinutes: integer(
      data.slaFulfillmentLeadMinutes,
      `${path}.slaFulfillmentLeadMinutes`
    ),
    minimumQuantity: integer(data.minimumQuantity, `${path}.minimumQuantity`),
    maximumQuantity: integer(data.maximumQuantity, `${path}.maximumQuantity`),
    orderCutoffMinutes: integer(data.orderCutoffMinutes, `${path}.orderCutoffMinutes`),
    inspectionMode: enumeration(data.inspectionMode, inspectionModes, `${path}.inspectionMode`),
    inspectionChecklistSchema: list(
      data.inspectionChecklistSchema,
      `${path}.inspectionChecklistSchema`,
      object
    ),
    state: enumeration(data.state, workStates, `${path}.state`),
    fulfilledQuantity: integer(data.fulfilledQuantity, `${path}.fulfilledQuantity`),
    cancelledQuantity: integer(data.cancelledQuantity, `${path}.cancelledQuantity`),
    refundedAmount: number(data.refundedAmount, `${path}.refundedAmount`),
    blockerCode: nullableText(data.blockerCode, `${path}.blockerCode`, 120),
    version: integer(data.version, `${path}.version`),
  });
}

function parseTask(
  value: unknown,
  path: string,
  administrator: boolean
): WorkplaceServiceFulfillmentTask {
  const data = record(value, path);
  if (
    !administrator &&
    (data.assigneeUserId !== null ||
      data.assigneeDirectorySubjectId != null ||
      data.assigneeDisplayName != null ||
      data.assigneeSecondaryLabel != null ||
      data.externalFulfillmentReference !== null)
  ) {
    return invalid(path);
  }
  return Object.freeze({
    fulfillmentTaskId: uuid(data.fulfillmentTaskId, `${path}.fulfillmentTaskId`),
    serviceOrderLineId: uuid(data.serviceOrderLineId, `${path}.serviceOrderLineId`),
    state: enumeration(data.state, workStates, `${path}.state`),
    providerState: enumeration(data.providerState, providerStates, `${path}.providerState`),
    providerCode: text(data.providerCode, `${path}.providerCode`, 80),
    assigneeUserId: nullableInteger(data.assigneeUserId, `${path}.assigneeUserId`),
    assigneeDirectorySubjectId: nullableText(
      data.assigneeDirectorySubjectId,
      `${path}.assigneeDirectorySubjectId`,
      200
    ),
    assigneeDisplayName: nullableText(data.assigneeDisplayName, `${path}.assigneeDisplayName`, 300),
    assigneeSecondaryLabel: nullableText(
      data.assigneeSecondaryLabel,
      `${path}.assigneeSecondaryLabel`,
      300
    ),
    responseDueAt: instant(data.responseDueAt, `${path}.responseDueAt`),
    dueAt: instant(data.dueAt, `${path}.dueAt`),
    providerReceiptAt: nullableInstant(data.providerReceiptAt, `${path}.providerReceiptAt`),
    acceptedAt: nullableInstant(data.acceptedAt, `${path}.acceptedAt`),
    completedAt: nullableInstant(data.completedAt, `${path}.completedAt`),
    externalFulfillmentReference: nullableText(
      data.externalFulfillmentReference,
      `${path}.externalFulfillmentReference`,
      320
    ),
    blockerCode: nullableText(data.blockerCode, `${path}.blockerCode`, 120),
    blockerDetail: nullableText(data.blockerDetail, `${path}.blockerDetail`, 1000),
    resultDetail: nullableText(data.resultDetail, `${path}.resultDetail`, 1000),
    responseRemainingSeconds: integer(
      data.responseRemainingSeconds,
      `${path}.responseRemainingSeconds`
    ),
    fulfillmentRemainingSeconds: integer(
      data.fulfillmentRemainingSeconds,
      `${path}.fulfillmentRemainingSeconds`
    ),
    responseBreached: bool(data.responseBreached, `${path}.responseBreached`),
    fulfillmentBreached: bool(data.fulfillmentBreached, `${path}.fulfillmentBreached`),
    version: integer(data.version, `${path}.version`),
    updatedAt: instant(data.updatedAt, `${path}.updatedAt`),
  });
}

const requesterEventDetailKeys = new Set([
  'lineAdjustmentId',
  'serviceOrderLineId',
  'attachmentId',
  'lineCount',
  'state',
  'cancelQuantity',
  'refundScope',
  'refundableAmount',
  'refundedAmount',
  'currency',
  'scanState',
  'scanVersion',
  'reservationVersion',
  'fileName',
  'contentType',
  'byteSize',
]);

function parseRequesterEventDetail(value: unknown, path: string) {
  const data = record(value, path);
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(data)) {
    if (!requesterEventDetailKeys.has(key)) return invalid(`${path}.${key}`);
    if (['lineAdjustmentId', 'serviceOrderLineId', 'attachmentId'].includes(key)) {
      result[key] = uuid(item, `${path}.${key}`);
    } else if (
      ['lineCount', 'cancelQuantity', 'scanVersion', 'reservationVersion', 'byteSize'].includes(key)
    ) {
      result[key] = integer(item, `${path}.${key}`);
    } else if (['refundableAmount', 'refundedAmount'].includes(key)) {
      result[key] = number(item, `${path}.${key}`);
    } else {
      result[key] = text(item, `${path}.${key}`, key === 'fileName' ? 255 : 120);
    }
  }
  return Object.freeze(result);
}

function parseEvent(
  value: unknown,
  path: string,
  administrator: boolean
): WorkplaceServiceOrderEvent {
  const data = record(value, path);
  if (!administrator && 'actorUserId' in data) return invalid(`${path}.actorUserId`);
  return Object.freeze({
    eventId: uuid(data.eventId, `${path}.eventId`),
    eventType: text(data.eventType, `${path}.eventType`, 80),
    ...(administrator ? { actorUserId: integer(data.actorUserId, `${path}.actorUserId`) } : {}),
    detail: administrator
      ? object(data.detail, `${path}.detail`)
      : parseRequesterEventDetail(data.detail, `${path}.detail`),
    occurredAt: instant(data.occurredAt, `${path}.occurredAt`),
  });
}

function parseMessage(
  value: unknown,
  path: string,
  administrator: boolean
): WorkplaceServiceOrderMessage {
  const data = record(value, path);
  if (!administrator && 'authorUserId' in data) return invalid(`${path}.authorUserId`);
  return Object.freeze({
    messageId: uuid(data.messageId, `${path}.messageId`),
    ...(administrator ? { authorUserId: integer(data.authorUserId, `${path}.authorUserId`) } : {}),
    authorDisplayName: nullableText(data.authorDisplayName, `${path}.authorDisplayName`, 160),
    authorRole: enumeration(
      data.authorRole,
      new Set<WorkplaceServiceOrderMessage['authorRole']>(['REQUESTER', 'OPERATOR']),
      `${path}.authorRole`
    ),
    message: text(data.message, `${path}.message`, 2000),
    createdAt: instant(data.createdAt, `${path}.createdAt`),
  });
}

function parseAttachment(
  value: unknown,
  path: string,
  administrator: boolean
): WorkplaceServiceOrderAttachment {
  const data = record(value, path);
  if (!administrator && (data.scannerEvidenceReference !== null || data.scanDetail !== null)) {
    return invalid(path);
  }
  return Object.freeze({
    attachmentId: uuid(data.attachmentId, `${path}.attachmentId`),
    fileName: text(data.fileName, `${path}.fileName`, 255),
    contentType: text(data.contentType, `${path}.contentType`, 120),
    byteSize: integer(data.byteSize, `${path}.byteSize`),
    scanState: enumeration(data.scanState, attachmentScanStates, `${path}.scanState`),
    scanVersion: integer(data.scanVersion, `${path}.scanVersion`),
    scannerEvidenceReference: nullableText(
      data.scannerEvidenceReference,
      `${path}.scannerEvidenceReference`,
      320
    ),
    scanDetail: nullableText(data.scanDetail, `${path}.scanDetail`, 1000),
    scannedAt: nullableInstant(data.scannedAt, `${path}.scannedAt`),
    createdAt: instant(data.createdAt, `${path}.createdAt`),
  });
}

export function parseWorkplaceServiceOrderAttachment(
  value: unknown,
  administrator = false
): WorkplaceServiceOrderAttachment {
  return parseAttachment(value, 'attachment', administrator);
}

export function parseWorkplaceServiceOrder(
  value: unknown,
  administrator = false
): WorkplaceServiceOrder {
  const data = record(value, 'order');
  if (!administrator && data.providerOperationReference !== null) {
    return invalid('order.providerOperationReference');
  }
  return Object.freeze({
    serviceOrderId: uuid(data.serviceOrderId, 'order.serviceOrderId'),
    requesterUserId: integer(data.requesterUserId, 'order.requesterUserId'),
    reservationAuthority: enumeration(data.reservationAuthority, authorities, 'order.authority'),
    reservationId: uuid(data.reservationId, 'order.reservationId'),
    reservationVersion: integer(data.reservationVersion, 'order.reservationVersion'),
    currentReservationVersion: nullableInteger(
      data.currentReservationVersion,
      'order.currentReservationVersion'
    ),
    reservationStartsAt: instant(data.reservationStartsAt, 'order.reservationStartsAt'),
    reservationEndsAt: instant(data.reservationEndsAt, 'order.reservationEndsAt'),
    siteReference: nullableText(data.siteReference, 'order.siteReference', 160),
    resourceReference: nullableText(data.resourceReference, 'order.resourceReference', 160),
    attendeeCount: integer(data.attendeeCount, 'order.attendeeCount'),
    costCenter: nullableText(data.costCenter, 'order.costCenter', 80),
    estimatedCost: number(data.estimatedCost, 'order.estimatedCost'),
    currency: text(data.currency, 'order.currency', 3),
    specialRequest: nullableText(data.specialRequest, 'order.specialRequest'),
    state: enumeration(data.state, orderStates, 'order.state'),
    reservationImpact: enumeration(data.reservationImpact, impacts, 'order.reservationImpact'),
    reconfirmationRequired: bool(data.reconfirmationRequired, 'order.reconfirmationRequired'),
    providerOperationReference: nullableText(
      data.providerOperationReference,
      'order.providerOperationReference',
      320
    ),
    resultDetail: nullableText(data.resultDetail, 'order.resultDetail', 1000),
    version: integer(data.version, 'order.version'),
    createdAt: instant(data.createdAt, 'order.createdAt'),
    updatedAt: instant(data.updatedAt, 'order.updatedAt'),
    lines: list(data.lines, 'order.lines', parseLine),
    tasks: list(data.tasks, 'order.tasks', (item, path) => parseTask(item, path, administrator)),
    eventCount: integer(data.eventCount, 'order.eventCount'),
    messageCount: integer(data.messageCount, 'order.messageCount'),
    attachmentCount: integer(data.attachmentCount, 'order.attachmentCount'),
  });
}

export function parseWorkplaceServiceOrders(
  value: unknown,
  administrator = false
): WorkplaceServiceOrders {
  const data = record(value, 'orders');
  const pagination = pageCursor(data, 'orders');
  return Object.freeze({
    items: pageList(data.items, 'orders.items', (item) =>
      parseWorkplaceServiceOrder(item, administrator)
    ),
    ...pagination,
  });
}

export function parseWorkplaceServiceOrderEventsPage(
  value: unknown,
  administrator = false
): WorkplaceServiceOrderEventsPage {
  const data = record(value, 'events');
  return Object.freeze({
    items: pageList(data.items, 'events.items', (item, path) =>
      parseEvent(item, path, administrator)
    ),
    ...pageCursor(data, 'events'),
  });
}

export function parseWorkplaceServiceOrderMessagesPage(
  value: unknown,
  administrator = false
): WorkplaceServiceOrderMessagesPage {
  const data = record(value, 'messages');
  return Object.freeze({
    items: pageList(data.items, 'messages.items', (item, path) =>
      parseMessage(item, path, administrator)
    ),
    ...pageCursor(data, 'messages'),
  });
}

export function parseWorkplaceServiceOrderAttachmentsPage(
  value: unknown,
  administrator = false
): WorkplaceServiceOrderAttachmentsPage {
  const data = record(value, 'attachments');
  return Object.freeze({
    items: pageList(data.items, 'attachments.items', (item, path) =>
      parseAttachment(item, path, administrator)
    ),
    ...pageCursor(data, 'attachments'),
  });
}

export function parseWorkplaceServiceLineCancellationImpact(
  value: unknown
): WorkplaceServiceLineCancellationImpact {
  const data = record(value, 'lineCancellationImpact');
  return Object.freeze({
    cancellationPreviewId: uuid(
      data.cancellationPreviewId,
      'lineCancellationImpact.cancellationPreviewId'
    ),
    serviceOrderId: uuid(data.serviceOrderId, 'lineCancellationImpact.serviceOrderId'),
    serviceOrderLineId: uuid(data.serviceOrderLineId, 'lineCancellationImpact.serviceOrderLineId'),
    orderVersion: integer(data.orderVersion, 'lineCancellationImpact.orderVersion'),
    lineVersion: integer(data.lineVersion, 'lineCancellationImpact.lineVersion'),
    cancelQuantity: integer(data.cancelQuantity, 'lineCancellationImpact.cancelQuantity'),
    fulfilledQuantity: integer(data.fulfilledQuantity, 'lineCancellationImpact.fulfilledQuantity'),
    previouslyCancelledQuantity: integer(
      data.previouslyCancelledQuantity,
      'lineCancellationImpact.previouslyCancelledQuantity'
    ),
    remainingQuantity: integer(data.remainingQuantity, 'lineCancellationImpact.remainingQuantity'),
    refundScope: enumeration(data.refundScope, refundScopes, 'lineCancellationImpact.refundScope'),
    refundableAmount: number(data.refundableAmount, 'lineCancellationImpact.refundableAmount'),
    currency: text(data.currency, 'lineCancellationImpact.currency', 3),
    eligible: bool(data.eligible, 'lineCancellationImpact.eligible'),
    reason: text(data.reason, 'lineCancellationImpact.reason', 500),
    expiresAt: instant(data.expiresAt, 'lineCancellationImpact.expiresAt'),
    generatedAt: instant(data.generatedAt, 'lineCancellationImpact.generatedAt'),
  });
}

export function parseWorkplaceServiceLineAdjustment(
  value: unknown,
  administrator = false
): WorkplaceServiceLineAdjustment {
  const data = record(value, 'lineAdjustment');
  if (
    !administrator &&
    (data.providerOperationReference !== null ||
      data.refundReceiptReference !== null ||
      data.resultDetail !== null)
  ) {
    return invalid('lineAdjustment.internalDetail');
  }
  return Object.freeze({
    lineAdjustmentId: uuid(data.lineAdjustmentId, 'lineAdjustment.lineAdjustmentId'),
    serviceOrderId: uuid(data.serviceOrderId, 'lineAdjustment.serviceOrderId'),
    serviceOrderLineId: uuid(data.serviceOrderLineId, 'lineAdjustment.serviceOrderLineId'),
    cancellationPreviewId: uuid(data.cancellationPreviewId, 'lineAdjustment.cancellationPreviewId'),
    cancelQuantity: integer(data.cancelQuantity, 'lineAdjustment.cancelQuantity'),
    refundScope: enumeration(data.refundScope, refundScopes, 'lineAdjustment.refundScope'),
    refundableAmount: number(data.refundableAmount, 'lineAdjustment.refundableAmount'),
    refundedAmount: number(data.refundedAmount, 'lineAdjustment.refundedAmount'),
    currency: text(data.currency, 'lineAdjustment.currency', 3),
    state: enumeration(data.state, lineAdjustmentStates, 'lineAdjustment.state'),
    providerOperationReference: nullableText(
      data.providerOperationReference,
      'lineAdjustment.providerOperationReference',
      320
    ),
    refundReceiptReference: nullableText(
      data.refundReceiptReference,
      'lineAdjustment.refundReceiptReference',
      320
    ),
    resultDetail: nullableText(data.resultDetail, 'lineAdjustment.resultDetail', 1000),
    version: integer(data.version, 'lineAdjustment.version'),
    createdAt: instant(data.createdAt, 'lineAdjustment.createdAt'),
    updatedAt: instant(data.updatedAt, 'lineAdjustment.updatedAt'),
  });
}

function parseCommandReceipt(
  value: unknown,
  serviceOrderId: string,
  path: string,
  administrator: boolean
): WorkplaceServiceCommandResult['receipt'] {
  const receipt = record(value, path);
  const receiptOrderId = uuid(receipt.serviceOrderId, `${path}.serviceOrderId`);
  const statusHref = text(receipt.statusHref, `${path}.statusHref`, 500);
  const base = `${administrator ? '/v1/admin' : '/v1'}/workplace/service-orders/${serviceOrderId}`;
  const suffix = statusHref.slice(base.length);
  const validSuffix =
    suffix === '' ||
    /^\/line-adjustments\/[0-9a-f-]{36}$/iu.test(suffix) ||
    (administrator && /^\/attachments\/[0-9a-f-]{36}\/scan-status$/iu.test(suffix));
  if (receiptOrderId !== serviceOrderId || !statusHref.startsWith(base) || !validSuffix) {
    return invalid(path);
  }
  return Object.freeze({
    commandId: uuid(receipt.commandId, `${path}.commandId`),
    serviceOrderId: receiptOrderId,
    state: enumeration(receipt.state, commandStates, `${path}.state`),
    statusHref,
    replayed: bool(receipt.replayed, `${path}.replayed`),
    correlationId: text(receipt.correlationId, `${path}.correlationId`, 160),
    acceptedAt: instant(receipt.acceptedAt, `${path}.acceptedAt`),
  });
}

export function parseWorkplaceServiceCommandResult(
  value: unknown,
  administrator = false
): WorkplaceServiceCommandResult {
  const data = record(value, 'command');
  const order = parseWorkplaceServiceOrder(data.order, administrator);
  return Object.freeze({
    order,
    receipt: parseCommandReceipt(
      data.receipt,
      order.serviceOrderId,
      'command.receipt',
      administrator
    ),
  });
}

export function parseWorkplaceServiceLineAdjustmentCommandResult(
  value: unknown,
  administrator = false
): WorkplaceServiceLineAdjustmentCommandResult {
  const data = record(value, 'lineAdjustmentCommand');
  const adjustment = parseWorkplaceServiceLineAdjustment(data.adjustment, administrator);
  const order = parseWorkplaceServiceOrder(data.order, administrator);
  if (
    adjustment.serviceOrderId !== order.serviceOrderId ||
    !order.lines.some((line) => line.serviceOrderLineId === adjustment.serviceOrderLineId)
  ) {
    return invalid('lineAdjustmentCommand');
  }
  const receipt = parseCommandReceipt(
    data.receipt,
    order.serviceOrderId,
    'lineAdjustmentCommand.receipt',
    administrator
  );
  if (!receipt.statusHref.endsWith(`/line-adjustments/${adjustment.lineAdjustmentId}`)) {
    return invalid('lineAdjustmentCommand.receipt.statusHref');
  }
  return Object.freeze({
    adjustment,
    order,
    receipt,
  });
}

export function parseWorkplaceServiceAttachmentScanCommandResult(
  value: unknown
): WorkplaceServiceAttachmentScanCommandResult {
  const data = record(value, 'attachmentScanCommand');
  const attachment = parseAttachment(data.attachment, 'attachmentScanCommand.attachment', true);
  const receiptData = record(data.receipt, 'attachmentScanCommand.receipt');
  const serviceOrderId = uuid(
    receiptData.serviceOrderId,
    'attachmentScanCommand.receipt.serviceOrderId'
  );
  const receipt = parseCommandReceipt(
    data.receipt,
    serviceOrderId,
    'attachmentScanCommand.receipt',
    true
  );
  if (!receipt.statusHref.endsWith(`/attachments/${attachment.attachmentId}/scan-status`)) {
    return invalid('attachmentScanCommand.receipt.statusHref');
  }
  return Object.freeze({
    attachment,
    receipt,
  });
}
