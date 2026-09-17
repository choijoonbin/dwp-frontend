import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import {
  parseWorkplaceServiceCatalog,
  parseWorkplaceServiceAdminCatalog,
  parseWorkplaceServiceAttachmentScanCommandResult,
  parseWorkplaceServiceCatalogCommandResult,
  parseWorkplaceServiceCommandResult,
  parseWorkplaceServiceLineAdjustment,
  parseWorkplaceServiceLineAdjustmentCommandResult,
  parseWorkplaceServiceLineCancellationImpact,
  parseWorkplaceServiceOrder,
  parseWorkplaceServiceOrderAttachment,
  parseWorkplaceServiceOrderAttachmentsPage,
  parseWorkplaceServiceOrderEventsPage,
  parseWorkplaceServiceOrderMessagesPage,
  parseWorkplaceServiceOrders,
  parseWorkplaceServicePreview,
} from './workplace-services-contract';
import type {
  WorkplaceServiceAttachmentScanVerdict,
  WorkplaceServiceOrderAttachment,
  WorkplaceServiceOrderState,
  WorkplaceServiceCategory,
  WorkplaceServiceCapacityMode,
  WorkplaceServiceInspectionMode,
  WorkplaceServiceReservationAuthority,
  WorkplaceServiceWorkState,
} from './workplace-services-contract';

const USER_BASE = '/api/platform/v1/workplace';
const ADMIN_BASE = '/api/platform/v1/admin/workplace/service-orders';
const ADMIN_CATALOG_BASE = '/api/platform/v1/admin/workplace/service-catalog';

export type WorkplaceServiceLineInput = Readonly<{
  catalogItemId: string;
  quantity: number;
  options: Readonly<Record<string, unknown>>;
}>;

export type WorkplaceServicePreviewInput = Readonly<{
  reservationAuthority: WorkplaceServiceReservationAuthority;
  expectedReservationVersion: number;
  attendeeCount: number;
  costCenter: string | null;
  specialRequest: string | null;
  lines: readonly WorkplaceServiceLineInput[];
}>;

export type WorkplaceServiceSubmitInput = Readonly<{
  previewId: string;
  expectedReservationVersion: number;
  explicitConfirmation: true;
  reason: string;
}>;

export type WorkplaceServiceCancelInput = Readonly<{
  expectedVersion: number;
  explicitConfirmation: true;
  reason: string;
}>;

export type WorkplaceServiceMessageInput = Readonly<{
  expectedVersion: number;
  message: string;
  explicitConfirmation: true;
  reason: string;
}>;

export type WorkplaceServiceReconfirmInput = Readonly<{
  expectedVersion: number;
  expectedReservationVersion: number;
  explicitConfirmation: true;
  reason: string;
}>;

export type WorkplaceServiceFulfillmentUpdateInput = Readonly<{
  expectedVersion: number;
  state: Exclude<WorkplaceServiceWorkState, 'NOT_CONFIGURED'>;
  assigneeUserId: number | null;
  externalFulfillmentReference: string | null;
  blockerCode: string | null;
  blockerDetail: string | null;
  resultDetail: string | null;
  fulfilledQuantity: number | null;
  reason: string;
  explicitConfirmation: true;
}>;

export type WorkplaceServicePageInput = Readonly<{
  cursor?: string | null;
  limit?: number;
}>;

export type WorkplaceServiceLineCancellationPreviewInput = Readonly<{
  expectedOrderVersion: number;
  expectedLineVersion: number;
  cancelQuantity: number;
  reason: string;
}>;

export type WorkplaceServiceLineCancellationInput = Readonly<{
  cancellationPreviewId: string;
  expectedOrderVersion: number;
  expectedLineVersion: number;
  explicitConfirmation: true;
  reason: string;
}>;

export type WorkplaceServiceLineAdjustmentReconcileInput = Readonly<{
  expectedVersion: number;
  explicitConfirmation: true;
  reason: string;
}>;

export type WorkplaceServiceAttachmentScanInput = Readonly<{
  expectedVersion: number;
  verdict: WorkplaceServiceAttachmentScanVerdict;
  scannerEvidenceReference: string;
  detail: string | null;
  explicitConfirmation: true;
  reason: string;
}>;

export type WorkplaceServiceCatalogWriteInput = Readonly<{
  category: WorkplaceServiceCategory;
  nameKo: string;
  nameEn: string;
  descriptionKo: string | null;
  descriptionEn: string | null;
  providerCode: string;
  siteScope: readonly string[];
  optionSchema: readonly Readonly<Record<string, unknown>>[];
  supportedResourceTypes: readonly string[];
  unitPrice: number;
  currency: string;
  minimumQuantity: number;
  maximumQuantity: number;
  orderCutoffMinutes: number;
  cancellationCutoffMinutes: number;
  slaResponseMinutes: number;
  slaFulfillmentLeadMinutes: number;
  cancellationPolicyKo: string;
  cancellationPolicyEn: string;
  capacityMode: WorkplaceServiceCapacityMode;
  capacityFreshnessSeconds: number;
  inspectionMode: WorkplaceServiceInspectionMode;
  inspectionChecklistSchema: readonly Readonly<Record<string, unknown>>[];
  requiresAttendeeCount: boolean;
  requiresCostCenter: boolean;
  explicitConfirmation: true;
  reason: string;
}>;

export type WorkplaceServiceCatalogCreateInput = WorkplaceServiceCatalogWriteInput &
  Readonly<{ serviceCode: string }>;
export type WorkplaceServiceCatalogUpdateInput = WorkplaceServiceCatalogWriteInput &
  Readonly<{ expectedVersion: number }>;

type CommandOptions = Readonly<{
  idempotencyKey: string;
  correlationId?: string;
  activeAccessMode?: 'ELEVATED';
}>;

function reservationPath(reservationId: string) {
  if (!reservationId.trim()) throw new Error('Reservation id is required.');
  return `${USER_BASE}/reservations/${encodeURIComponent(reservationId)}/service-orders`;
}

function serviceOrderPath(orderId: string, administrator = false) {
  if (!orderId.trim()) throw new Error('Service order id is required.');
  return `${administrator ? ADMIN_BASE : `${USER_BASE}/service-orders`}/${encodeURIComponent(orderId)}`;
}

function pageQuery(input: WorkplaceServicePageInput = {}) {
  const query = new URLSearchParams();
  if (input.cursor) {
    if (input.cursor.length > 2000) throw new Error('Workplace service cursor is invalid.');
    query.set('cursor', input.cursor);
  }
  if (input.limit !== undefined) {
    if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100) {
      throw new Error('Workplace service page limit must be between 1 and 100.');
    }
    query.set('limit', String(input.limit));
  }
  const encoded = query.toString();
  return encoded ? `?${encoded}` : '';
}

function linePath(orderId: string, lineId: string) {
  if (!lineId.trim()) throw new Error('Service order line id is required.');
  return `${serviceOrderPath(orderId)}/lines/${encodeURIComponent(lineId)}`;
}

function commandHeaders(options: CommandOptions) {
  if (!options.idempotencyKey.trim() || options.idempotencyKey.length > 160) {
    throw new Error('A valid Workplace service idempotency key is required.');
  }
  return {
    'Idempotency-Key': options.idempotencyKey,
    ...(options.correlationId ? { 'X-Correlation-ID': options.correlationId } : {}),
    ...(options.activeAccessMode ? { 'X-DWP-Active-Access-Mode': options.activeAccessMode } : {}),
  };
}

export async function getWorkplaceServiceCatalog(
  reservationAuthority: WorkplaceServiceReservationAuthority,
  reservationId: string
) {
  const query = new URLSearchParams({ reservationAuthority, reservationId });
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${USER_BASE}/service-catalog?${query.toString()}`
  );
  return parseWorkplaceServiceCatalog(response.data.data);
}

export async function previewWorkplaceServiceOrder(
  reservationId: string,
  input: WorkplaceServicePreviewInput
) {
  const response = await axiosInstance.post<ApiResponse<unknown>, WorkplaceServicePreviewInput>(
    `${reservationPath(reservationId)}:preview`,
    input
  );
  return parseWorkplaceServicePreview(response.data.data);
}

export async function submitWorkplaceServiceOrder(
  reservationId: string,
  input: WorkplaceServiceSubmitInput,
  options: CommandOptions
) {
  const response = await axiosInstance.post<ApiResponse<unknown>, WorkplaceServiceSubmitInput>(
    reservationPath(reservationId),
    input,
    { headers: commandHeaders(options) }
  );
  return parseWorkplaceServiceCommandResult(response.data.data);
}

export async function getWorkplaceServiceOrders(input: WorkplaceServicePageInput = {}) {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${USER_BASE}/service-orders${pageQuery(input)}`
  );
  return parseWorkplaceServiceOrders(response.data.data);
}

export async function getWorkplaceServiceOrder(orderId: string) {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${USER_BASE}/service-orders/${encodeURIComponent(orderId)}`
  );
  return parseWorkplaceServiceOrder(response.data.data);
}

export async function getWorkplaceServiceOrderEvents(
  orderId: string,
  input: WorkplaceServicePageInput = {},
  administrator = false
) {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${serviceOrderPath(orderId, administrator)}/events${pageQuery(input)}`
  );
  return parseWorkplaceServiceOrderEventsPage(response.data.data, administrator);
}

export async function getWorkplaceServiceOrderMessages(
  orderId: string,
  input: WorkplaceServicePageInput = {},
  administrator = false
) {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${serviceOrderPath(orderId, administrator)}/messages${pageQuery(input)}`
  );
  return parseWorkplaceServiceOrderMessagesPage(response.data.data, administrator);
}

export async function getWorkplaceServiceOrderAttachments(
  orderId: string,
  input: WorkplaceServicePageInput = {},
  administrator = false
) {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${serviceOrderPath(orderId, administrator)}/attachments${pageQuery(input)}`
  );
  return parseWorkplaceServiceOrderAttachmentsPage(response.data.data, administrator);
}

export async function addWorkplaceServiceOrderMessage(
  orderId: string,
  input: WorkplaceServiceMessageInput,
  options: CommandOptions,
  administrator = false
) {
  const response = await axiosInstance.post<ApiResponse<unknown>, WorkplaceServiceMessageInput>(
    `${serviceOrderPath(orderId, administrator)}/messages`,
    input,
    { headers: commandHeaders(options) }
  );
  return parseWorkplaceServiceCommandResult(response.data.data, administrator);
}

export async function reconfirmWorkplaceServiceOrder(
  orderId: string,
  input: WorkplaceServiceReconfirmInput,
  options: CommandOptions
) {
  const response = await axiosInstance.post<ApiResponse<unknown>, WorkplaceServiceReconfirmInput>(
    `${serviceOrderPath(orderId)}:reconfirm`,
    input,
    { headers: commandHeaders(options) }
  );
  return parseWorkplaceServiceCommandResult(response.data.data);
}

export async function uploadWorkplaceServiceOrderAttachment(
  orderId: string,
  file: File,
  expectedVersion: number,
  reason: string,
  options: CommandOptions,
  administrator = false
) {
  const form = new FormData();
  form.set('file', file);
  form.set('expectedVersion', String(expectedVersion));
  form.set('reason', reason);
  form.set('explicitConfirmation', 'true');
  const response = await axiosInstance.post<ApiResponse<unknown>, FormData>(
    `${serviceOrderPath(orderId, administrator)}/attachments`,
    form,
    { headers: commandHeaders(options) }
  );
  return parseWorkplaceServiceCommandResult(response.data.data, administrator);
}

export async function downloadWorkplaceServiceOrderAttachment(
  orderId: string,
  attachment: WorkplaceServiceOrderAttachment,
  administrator = false,
  activeAccessMode?: 'ELEVATED'
) {
  if (attachment.scanState !== 'CLEAN') {
    throw new Error('Only clean Workplace service attachments can be downloaded.');
  }
  if (!attachment.attachmentId.trim()) throw new Error('Service attachment id is required.');
  const response = await axiosInstance.get<Blob>(
    `${serviceOrderPath(orderId, administrator)}/attachments/${encodeURIComponent(attachment.attachmentId)}`,
    {
      responseType: 'blob',
      ...(activeAccessMode ? { headers: { 'X-DWP-Active-Access-Mode': activeAccessMode } } : {}),
    }
  );
  return response.data;
}

export async function cancelWorkplaceServiceOrder(
  orderId: string,
  input: WorkplaceServiceCancelInput,
  options: CommandOptions
) {
  const response = await axiosInstance.post<ApiResponse<unknown>, WorkplaceServiceCancelInput>(
    `${USER_BASE}/service-orders/${encodeURIComponent(orderId)}:cancel`,
    input,
    { headers: commandHeaders(options) }
  );
  return parseWorkplaceServiceCommandResult(response.data.data);
}

export async function previewWorkplaceServiceLineCancellation(
  orderId: string,
  lineId: string,
  input: WorkplaceServiceLineCancellationPreviewInput
) {
  const response = await axiosInstance.post<
    ApiResponse<unknown>,
    WorkplaceServiceLineCancellationPreviewInput
  >(`${linePath(orderId, lineId)}/cancellation-impact:preview`, input);
  return parseWorkplaceServiceLineCancellationImpact(response.data.data);
}

export async function cancelWorkplaceServiceLine(
  orderId: string,
  lineId: string,
  input: WorkplaceServiceLineCancellationInput,
  options: CommandOptions
) {
  const response = await axiosInstance.post<
    ApiResponse<unknown>,
    WorkplaceServiceLineCancellationInput
  >(`${linePath(orderId, lineId)}:cancel`, input, { headers: commandHeaders(options) });
  return parseWorkplaceServiceLineAdjustmentCommandResult(response.data.data);
}

export async function getWorkplaceServiceLineAdjustment(
  orderId: string,
  adjustmentId: string,
  administrator = false
) {
  if (!adjustmentId.trim()) throw new Error('Service line adjustment id is required.');
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${serviceOrderPath(orderId, administrator)}/line-adjustments/${encodeURIComponent(adjustmentId)}`
  );
  return parseWorkplaceServiceLineAdjustment(response.data.data, administrator);
}

export async function reconcileWorkplaceServiceLineAdjustment(
  orderId: string,
  adjustmentId: string,
  input: WorkplaceServiceLineAdjustmentReconcileInput,
  options: CommandOptions & Readonly<{ activeAccessMode: 'ELEVATED' }>
) {
  if (!adjustmentId.trim()) throw new Error('Service line adjustment id is required.');
  const response = await axiosInstance.post<
    ApiResponse<unknown>,
    WorkplaceServiceLineAdjustmentReconcileInput
  >(
    `${serviceOrderPath(orderId, true)}/line-adjustments/${encodeURIComponent(adjustmentId)}:reconcile`,
    input,
    { headers: commandHeaders(options) }
  );
  return parseWorkplaceServiceLineAdjustmentCommandResult(response.data.data, true);
}

export async function getWorkplaceServiceFulfillmentQueue(
  state?: WorkplaceServiceOrderState,
  input: WorkplaceServicePageInput = {}
) {
  const query = new URLSearchParams();
  if (state) query.set('state', state);
  const page = pageQuery(input).replace(/^\?/, '');
  if (page) {
    const pageParams = new URLSearchParams(page);
    pageParams.forEach((value, key) => query.set(key, value));
  }
  const suffix = query.size ? `?${query.toString()}` : '';
  const response = await axiosInstance.get<ApiResponse<unknown>>(`${ADMIN_BASE}${suffix}`);
  return parseWorkplaceServiceOrders(response.data.data, true);
}

export async function getWorkplaceServiceFulfillmentOrder(orderId: string) {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${ADMIN_BASE}/${encodeURIComponent(orderId)}`
  );
  return parseWorkplaceServiceOrder(response.data.data, true);
}

export async function updateWorkplaceServiceFulfillment(
  orderId: string,
  taskId: string,
  input: WorkplaceServiceFulfillmentUpdateInput,
  options: CommandOptions & Readonly<{ activeAccessMode: 'ELEVATED' }>
) {
  const response = await axiosInstance.post<
    ApiResponse<unknown>,
    WorkplaceServiceFulfillmentUpdateInput
  >(
    `${ADMIN_BASE}/${encodeURIComponent(orderId)}/tasks/${encodeURIComponent(taskId)}:update`,
    input,
    { headers: commandHeaders(options) }
  );
  return parseWorkplaceServiceCommandResult(response.data.data, true);
}

export async function recordWorkplaceServiceAttachmentScan(
  orderId: string,
  attachmentId: string,
  input: WorkplaceServiceAttachmentScanInput,
  options: CommandOptions & Readonly<{ activeAccessMode: 'ELEVATED' }>
) {
  if (!attachmentId.trim()) throw new Error('Service attachment id is required.');
  const response = await axiosInstance.post<
    ApiResponse<unknown>,
    WorkplaceServiceAttachmentScanInput
  >(
    `${serviceOrderPath(orderId, true)}/attachments/${encodeURIComponent(attachmentId)}/scan-result`,
    input,
    { headers: commandHeaders(options) }
  );
  return parseWorkplaceServiceAttachmentScanCommandResult(response.data.data);
}

export async function getWorkplaceServiceAttachmentScanStatus(
  orderId: string,
  attachmentId: string,
  activeAccessMode: 'ELEVATED'
) {
  if (!attachmentId.trim()) throw new Error('Service attachment id is required.');
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${serviceOrderPath(orderId, true)}/attachments/${encodeURIComponent(attachmentId)}/scan-status`,
    { headers: { 'X-DWP-Active-Access-Mode': activeAccessMode } }
  );
  return parseWorkplaceServiceOrderAttachment(response.data.data, true);
}

export async function getWorkplaceServiceAdminCatalog() {
  const response = await axiosInstance.get<ApiResponse<unknown>>(ADMIN_CATALOG_BASE);
  return parseWorkplaceServiceAdminCatalog(response.data.data);
}

export async function createWorkplaceServiceCatalogItem(
  input: WorkplaceServiceCatalogCreateInput,
  options: CommandOptions & Readonly<{ activeAccessMode: 'ELEVATED' }>
) {
  const response = await axiosInstance.post<
    ApiResponse<unknown>,
    WorkplaceServiceCatalogCreateInput
  >(ADMIN_CATALOG_BASE, input, { headers: commandHeaders(options) });
  return parseWorkplaceServiceCatalogCommandResult(response.data.data);
}

export async function updateWorkplaceServiceCatalogItem(
  itemId: string,
  input: WorkplaceServiceCatalogUpdateInput,
  options: CommandOptions & Readonly<{ activeAccessMode: 'ELEVATED' }>
) {
  const response = await axiosInstance.put<
    ApiResponse<unknown>,
    WorkplaceServiceCatalogUpdateInput
  >(`${ADMIN_CATALOG_BASE}/${encodeURIComponent(itemId)}`, input, {
    headers: commandHeaders(options),
  });
  return parseWorkplaceServiceCatalogCommandResult(response.data.data);
}

export async function setWorkplaceServiceCatalogItemActive(
  itemId: string,
  input: Readonly<{
    expectedVersion: number;
    active: boolean;
    explicitConfirmation: true;
    reason: string;
  }>,
  options: CommandOptions & Readonly<{ activeAccessMode: 'ELEVATED' }>
) {
  const response = await axiosInstance.post<ApiResponse<unknown>, typeof input>(
    `${ADMIN_CATALOG_BASE}/${encodeURIComponent(itemId)}:state`,
    input,
    { headers: commandHeaders(options) }
  );
  return parseWorkplaceServiceCatalogCommandResult(response.data.data);
}
