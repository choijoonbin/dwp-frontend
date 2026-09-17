import { axiosInstance } from '../axios-instance';
import type { ApiResponse } from '../types';

const BASE = '/api/platform/v1/admin/workplace/experience/facilities';
// Java/PostgreSQL seeded identifiers use canonical UUID text while version and variant bits are unrestricted.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const IDEMPOTENCY_KEY = /^[\x21-\x7e]{1,160}$/u;

export type WorkplaceClosureReservationOwner = 'WORKPLACE' | 'CALENDAR';
export type WorkplaceClosureImpactAction = 'KEEP' | 'CANCEL' | 'REPLACE';
export type WorkplaceClosureCommandState =
  'ACCEPTED' | 'EXECUTING' | 'SUCCEEDED' | 'PARTIAL' | 'FAILED' | 'RESULT_UNKNOWN';
export type WorkplaceClosureItemResultState = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'RESULT_UNKNOWN';
export type WorkplaceClosureNotificationState =
  | 'NOT_REQUIRED'
  | 'NOT_CONFIGURED'
  | 'PENDING'
  | 'RETRY_SCHEDULED'
  | 'SENDING'
  | 'PUBLISHED'
  | 'RESULT_UNKNOWN'
  | 'DEAD';

export type WorkplaceClosureReplacementCandidate = Readonly<{
  workplaceResourceId: string;
  ownerResourceId: string;
  resourceName: string;
  floorId: string;
  resourceVersion: number;
  rank: number;
}>;

export type WorkplaceClosureImpactItem = Readonly<{
  previewItemId: string;
  reservationOwner: WorkplaceClosureReservationOwner;
  bookingId: string;
  eventId: string | null;
  sourceWorkplaceResourceId: string;
  sourceOwnerResourceId: string;
  startsAt: string;
  endsAt: string;
  bookingStatus: string;
  bookingVersion: number;
  recipientUserIds: readonly number[];
  replacementBlockReason: string | null;
  replacementCandidates: readonly WorkplaceClosureReplacementCandidate[];
}>;

export type WorkplaceClosureImpactPreview = Readonly<{
  previewId: string;
  resourceId: string;
  siteId: string;
  reservationOwner: WorkplaceClosureReservationOwner;
  startsAt: string;
  endsAt: string;
  resourceVersion: number;
  previewVersion: number;
  confirmationToken: string;
  affectedBookingCount: number;
  affectedRecipientCount: number;
  expiresAt: string;
  generatedAt: string;
  items: readonly WorkplaceClosureImpactItem[];
}>;

export type WorkplaceClosureImpactSelection = Readonly<{
  previewItemId: string;
  action: WorkplaceClosureImpactAction;
  expectedBookingVersion: number;
  replacementResourceId?: string;
  expectedReplacementResourceVersion?: number;
}>;

export type WorkplaceClosureExecuteInput = Readonly<{
  expectedPreviewVersion: number;
  confirmationToken: string;
  reason: string;
  confirmed: true;
  selections: readonly WorkplaceClosureImpactSelection[];
}>;

export type WorkplaceClosureNotificationRecoveryInput = Readonly<{
  expectedCommandVersion: number;
  reason: string;
  confirmed: true;
}>;

export type WorkplaceClosureCommandItem = Readonly<{
  commandItemId: string;
  previewItemId: string;
  reservationOwner: WorkplaceClosureReservationOwner;
  bookingId: string;
  selectedAction: WorkplaceClosureImpactAction;
  expectedBookingVersion: number;
  replacementWorkplaceResourceId: string | null;
  replacementOwnerResourceId: string | null;
  replacementResourceVersion: number | null;
  resultState: WorkplaceClosureItemResultState;
  resultCode: string | null;
  resultingBookingVersion: number | null;
}>;

export type WorkplaceClosureNotificationDelivery = Readonly<{
  recipientCount: number;
  eventCount: number;
  state: WorkplaceClosureNotificationState;
  pendingCount: number;
  retryCount: number;
  sendingCount: number;
  publishedCount: number;
  resultUnknownCount: number;
  deadCount: number;
  eventTransportConfigured: boolean;
  reconciliationRequired: boolean;
  observedAt: string;
}>;

export type WorkplaceClosureCommand = Readonly<{
  commandId: string;
  previewId: string;
  closureId: string;
  resourceId: string;
  siteId: string;
  state: WorkplaceClosureCommandState;
  expectedPreviewVersion: number;
  reason: string;
  keptCount: number;
  cancelledCount: number;
  replacedCount: number;
  version: number;
  createdAt: string;
  completedAt: string | null;
  notifications: WorkplaceClosureNotificationDelivery;
  items: readonly WorkplaceClosureCommandItem[];
}>;

export type WorkplaceClosureCommandReceipt = Readonly<{
  command: WorkplaceClosureCommand;
  owner: string;
  bookingsMutated: boolean;
  notificationScheduled: boolean;
  notificationDispatchPublished: boolean;
  externalDeliveryProven: boolean;
  auditTrail: readonly Readonly<{
    commandEventId: string;
    eventType: string;
    actorUserId: number;
    evidence: string;
    correlationId: string | null;
    occurredAt: string;
  }>[];
}>;

export type WorkplaceClosureElevatedOptions = Readonly<{
  idempotencyKey: string;
  activeAccessMode: 'ELEVATED';
}>;

function invalid(path: string): never {
  throw new Error(`Invalid workplace closure-impact response at ${path}.`);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid(path);
  return value as Record<string, unknown>;
}

function text(value: unknown, path: string, maximum = 500): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value !== value.trim() ||
    value.length > maximum ||
    [...value].some((character) => {
      const code = character.charCodeAt(0);
      return code < 0x20 || code === 0x7f;
    })
  )
    return invalid(path);
  return value;
}

function nullableText(value: unknown, path: string, maximum = 500): string | null {
  return value === null ? null : text(value, path, maximum);
}

function uuid(value: unknown, path: string): string {
  const result = text(value, path, 36);
  return UUID.test(result) ? result : invalid(path);
}

function nullableUuid(value: unknown, path: string): string | null {
  return value === null ? null : uuid(value, path);
}

function instant(value: unknown, path: string): string {
  const result = text(value, path, 64);
  return Number.isFinite(Date.parse(result)) ? result : invalid(path);
}

function nullableInstant(value: unknown, path: string): string | null {
  return value === null ? null : instant(value, path);
}

function integer(value: unknown, path: string): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : invalid(path);
}

function positiveInteger(value: unknown, path: string): number {
  const result = integer(value, path);
  return result > 0 ? result : invalid(path);
}

function nullableInteger(value: unknown, path: string): number | null {
  return value === null ? null : integer(value, path);
}

function bool(value: unknown, path: string): boolean {
  return typeof value === 'boolean' ? value : invalid(path);
}

function enumeration<T extends string>(value: unknown, values: readonly T[], path: string): T {
  return typeof value === 'string' && values.includes(value as T) ? (value as T) : invalid(path);
}

function list(value: unknown, path: string, maximum = 1_000): readonly unknown[] {
  return Array.isArray(value) && value.length <= maximum ? value : invalid(path);
}

function parseCandidate(value: unknown, path: string): WorkplaceClosureReplacementCandidate {
  const row = record(value, path);
  return Object.freeze({
    workplaceResourceId: uuid(row.workplaceResourceId, `${path}.workplaceResourceId`),
    ownerResourceId: uuid(row.ownerResourceId, `${path}.ownerResourceId`),
    resourceName: text(row.resourceName, `${path}.resourceName`, 240),
    floorId: uuid(row.floorId, `${path}.floorId`),
    resourceVersion: integer(row.resourceVersion, `${path}.resourceVersion`),
    rank: integer(row.rank, `${path}.rank`),
  });
}

function parseImpactItem(value: unknown, path: string): WorkplaceClosureImpactItem {
  const row = record(value, path);
  const recipientUserIds = list(row.recipientUserIds, `${path}.recipientUserIds`).map(
    (item, index) => positiveInteger(item, `${path}.recipientUserIds[${index}]`)
  );
  const replacementCandidates = list(
    row.replacementCandidates,
    `${path}.replacementCandidates`,
    100
  ).map((item, index) => parseCandidate(item, `${path}.replacementCandidates[${index}]`));
  return Object.freeze({
    previewItemId: uuid(row.previewItemId, `${path}.previewItemId`),
    reservationOwner: enumeration(
      row.reservationOwner,
      ['WORKPLACE', 'CALENDAR'] as const,
      `${path}.reservationOwner`
    ),
    bookingId: uuid(row.bookingId, `${path}.bookingId`),
    eventId: nullableUuid(row.eventId, `${path}.eventId`),
    sourceWorkplaceResourceId: uuid(
      row.sourceWorkplaceResourceId,
      `${path}.sourceWorkplaceResourceId`
    ),
    sourceOwnerResourceId: uuid(row.sourceOwnerResourceId, `${path}.sourceOwnerResourceId`),
    startsAt: instant(row.startsAt, `${path}.startsAt`),
    endsAt: instant(row.endsAt, `${path}.endsAt`),
    bookingStatus: text(row.bookingStatus, `${path}.bookingStatus`, 80),
    bookingVersion: integer(row.bookingVersion, `${path}.bookingVersion`),
    recipientUserIds: Object.freeze(recipientUserIds),
    replacementBlockReason: nullableText(
      row.replacementBlockReason,
      `${path}.replacementBlockReason`,
      500
    ),
    replacementCandidates: Object.freeze(replacementCandidates),
  });
}

export function parseWorkplaceClosureImpactPreview(value: unknown): WorkplaceClosureImpactPreview {
  const row = record(value, 'preview');
  const items = list(row.items, 'preview.items').map((item, index) =>
    parseImpactItem(item, `preview.items[${index}]`)
  );
  const preview = Object.freeze({
    previewId: uuid(row.previewId, 'preview.previewId'),
    resourceId: uuid(row.resourceId, 'preview.resourceId'),
    siteId: uuid(row.siteId, 'preview.siteId'),
    reservationOwner: enumeration(
      row.reservationOwner,
      ['WORKPLACE', 'CALENDAR'] as const,
      'preview.reservationOwner'
    ),
    startsAt: instant(row.startsAt, 'preview.startsAt'),
    endsAt: instant(row.endsAt, 'preview.endsAt'),
    resourceVersion: integer(row.resourceVersion, 'preview.resourceVersion'),
    previewVersion: positiveInteger(row.previewVersion, 'preview.previewVersion'),
    confirmationToken: text(row.confirmationToken, 'preview.confirmationToken', 160),
    affectedBookingCount: integer(row.affectedBookingCount, 'preview.affectedBookingCount'),
    affectedRecipientCount: integer(row.affectedRecipientCount, 'preview.affectedRecipientCount'),
    expiresAt: instant(row.expiresAt, 'preview.expiresAt'),
    generatedAt: instant(row.generatedAt, 'preview.generatedAt'),
    items: Object.freeze(items),
  });
  if (preview.affectedBookingCount !== preview.items.length)
    return invalid('preview.affectedBookingCount');
  if (Date.parse(preview.startsAt) >= Date.parse(preview.endsAt))
    return invalid('preview.interval');
  return preview;
}

function parseNotifications(value: unknown): WorkplaceClosureNotificationDelivery {
  const row = record(value, 'command.notifications');
  return Object.freeze({
    recipientCount: integer(row.recipientCount, 'command.notifications.recipientCount'),
    eventCount: integer(row.eventCount, 'command.notifications.eventCount'),
    state: enumeration(
      row.state,
      [
        'NOT_REQUIRED',
        'NOT_CONFIGURED',
        'PENDING',
        'RETRY_SCHEDULED',
        'SENDING',
        'PUBLISHED',
        'RESULT_UNKNOWN',
        'DEAD',
      ] as const,
      'command.notifications.state'
    ),
    pendingCount: integer(row.pendingCount, 'command.notifications.pendingCount'),
    retryCount: integer(row.retryCount, 'command.notifications.retryCount'),
    sendingCount: integer(row.sendingCount, 'command.notifications.sendingCount'),
    publishedCount: integer(row.publishedCount, 'command.notifications.publishedCount'),
    resultUnknownCount: integer(row.resultUnknownCount, 'command.notifications.resultUnknownCount'),
    deadCount: integer(row.deadCount, 'command.notifications.deadCount'),
    eventTransportConfigured: bool(
      row.eventTransportConfigured,
      'command.notifications.eventTransportConfigured'
    ),
    reconciliationRequired: bool(
      row.reconciliationRequired,
      'command.notifications.reconciliationRequired'
    ),
    observedAt: instant(row.observedAt, 'command.notifications.observedAt'),
  });
}

function parseCommandItem(value: unknown, path: string): WorkplaceClosureCommandItem {
  const row = record(value, path);
  return Object.freeze({
    commandItemId: uuid(row.commandItemId, `${path}.commandItemId`),
    previewItemId: uuid(row.previewItemId, `${path}.previewItemId`),
    reservationOwner: enumeration(
      row.reservationOwner,
      ['WORKPLACE', 'CALENDAR'] as const,
      `${path}.reservationOwner`
    ),
    bookingId: uuid(row.bookingId, `${path}.bookingId`),
    selectedAction: enumeration(
      row.selectedAction,
      ['KEEP', 'CANCEL', 'REPLACE'] as const,
      `${path}.selectedAction`
    ),
    expectedBookingVersion: integer(row.expectedBookingVersion, `${path}.expectedBookingVersion`),
    replacementWorkplaceResourceId: nullableUuid(
      row.replacementWorkplaceResourceId,
      `${path}.replacementWorkplaceResourceId`
    ),
    replacementOwnerResourceId: nullableUuid(
      row.replacementOwnerResourceId,
      `${path}.replacementOwnerResourceId`
    ),
    replacementResourceVersion: nullableInteger(
      row.replacementResourceVersion,
      `${path}.replacementResourceVersion`
    ),
    resultState: enumeration(
      row.resultState,
      ['PENDING', 'SUCCEEDED', 'FAILED', 'RESULT_UNKNOWN'] as const,
      `${path}.resultState`
    ),
    resultCode: nullableText(row.resultCode, `${path}.resultCode`, 160),
    resultingBookingVersion: nullableInteger(
      row.resultingBookingVersion,
      `${path}.resultingBookingVersion`
    ),
  });
}

export function parseWorkplaceClosureCommand(value: unknown): WorkplaceClosureCommand {
  const row = record(value, 'command');
  const items = list(row.items, 'command.items').map((item, index) =>
    parseCommandItem(item, `command.items[${index}]`)
  );
  return Object.freeze({
    commandId: uuid(row.commandId, 'command.commandId'),
    previewId: uuid(row.previewId, 'command.previewId'),
    closureId: uuid(row.closureId, 'command.closureId'),
    resourceId: uuid(row.resourceId, 'command.resourceId'),
    siteId: uuid(row.siteId, 'command.siteId'),
    state: enumeration(
      row.state,
      ['ACCEPTED', 'EXECUTING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'RESULT_UNKNOWN'] as const,
      'command.state'
    ),
    expectedPreviewVersion: positiveInteger(
      row.expectedPreviewVersion,
      'command.expectedPreviewVersion'
    ),
    reason: text(row.reason, 'command.reason'),
    keptCount: integer(row.keptCount, 'command.keptCount'),
    cancelledCount: integer(row.cancelledCount, 'command.cancelledCount'),
    replacedCount: integer(row.replacedCount, 'command.replacedCount'),
    version: positiveInteger(row.version, 'command.version'),
    createdAt: instant(row.createdAt, 'command.createdAt'),
    completedAt: nullableInstant(row.completedAt, 'command.completedAt'),
    notifications: parseNotifications(row.notifications),
    items: Object.freeze(items),
  });
}

export function parseWorkplaceClosureCommandReceipt(
  value: unknown
): WorkplaceClosureCommandReceipt {
  const row = record(value, 'receipt');
  const auditTrail = list(row.auditTrail, 'receipt.auditTrail', 2_000).map((value, index) => {
    const path = `receipt.auditTrail[${index}]`;
    const item = record(value, path);
    return Object.freeze({
      commandEventId: uuid(item.commandEventId, `${path}.commandEventId`),
      eventType: text(item.eventType, `${path}.eventType`, 120),
      actorUserId: positiveInteger(item.actorUserId, `${path}.actorUserId`),
      evidence: text(item.evidence, `${path}.evidence`, 2_000),
      correlationId: nullableText(item.correlationId, `${path}.correlationId`, 160),
      occurredAt: instant(item.occurredAt, `${path}.occurredAt`),
    });
  });
  return Object.freeze({
    command: parseWorkplaceClosureCommand(row.command),
    owner: text(row.owner, 'receipt.owner', 160),
    bookingsMutated: bool(row.bookingsMutated, 'receipt.bookingsMutated'),
    notificationScheduled: bool(row.notificationScheduled, 'receipt.notificationScheduled'),
    notificationDispatchPublished: bool(
      row.notificationDispatchPublished,
      'receipt.notificationDispatchPublished'
    ),
    externalDeliveryProven: bool(row.externalDeliveryProven, 'receipt.externalDeliveryProven'),
    auditTrail: Object.freeze(auditTrail),
  });
}

function identifier(value: string, path: string): string {
  return UUID.test(value) ? value : invalid(path);
}

function siteQuery(siteId: string): string {
  return new URLSearchParams({ siteId: identifier(siteId, 'siteId') }).toString();
}

function idempotencyHeaders(key: string, elevated = false): Record<string, string> {
  if (!IDEMPOTENCY_KEY.test(key))
    throw new Error('A bounded closure-impact Idempotency-Key is required.');
  return {
    'Idempotency-Key': key,
    ...(elevated ? { 'X-DWP-Active-Access-Mode': 'ELEVATED' } : {}),
  };
}

export async function createWorkplaceClosureImpactPreview(
  siteId: string,
  resourceId: string,
  input: Readonly<{ startsAt: string; endsAt: string; resourceVersion: number }>,
  idempotencyKey: string
): Promise<WorkplaceClosureImpactPreview> {
  const response = await axiosInstance.post<ApiResponse<unknown>, typeof input>(
    `${BASE}/resources/${identifier(resourceId, 'resourceId')}/closure-impact-previews?${siteQuery(siteId)}`,
    input,
    { headers: idempotencyHeaders(idempotencyKey) }
  );
  const preview = parseWorkplaceClosureImpactPreview(response.data.data);
  if (preview.siteId !== siteId || preview.resourceId !== resourceId)
    return invalid('preview.scope');
  return preview;
}

export async function getWorkplaceClosureImpactPreview(siteId: string, previewId: string) {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${BASE}/closure-impact-previews/${identifier(previewId, 'previewId')}?${siteQuery(siteId)}`
  );
  const preview = parseWorkplaceClosureImpactPreview(response.data.data);
  if (preview.siteId !== siteId || preview.previewId !== previewId) return invalid('preview.scope');
  return preview;
}

export async function executeWorkplaceClosureImpact(
  siteId: string,
  previewId: string,
  input: WorkplaceClosureExecuteInput,
  options: WorkplaceClosureElevatedOptions
) {
  const response = await axiosInstance.post<ApiResponse<unknown>, WorkplaceClosureExecuteInput>(
    `${BASE}/closure-impact-previews/${identifier(previewId, 'previewId')}/commands?${siteQuery(siteId)}`,
    input,
    { headers: idempotencyHeaders(options.idempotencyKey, true) }
  );
  const command = parseWorkplaceClosureCommand(response.data.data);
  if (command.siteId !== siteId || command.previewId !== previewId) return invalid('command.scope');
  return command;
}

export async function getWorkplaceClosureCommand(siteId: string, commandId: string) {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${BASE}/closure-commands/${identifier(commandId, 'commandId')}?${siteQuery(siteId)}`
  );
  const command = parseWorkplaceClosureCommand(response.data.data);
  if (command.siteId !== siteId || command.commandId !== commandId) return invalid('command.scope');
  return command;
}

export async function getWorkplaceClosureCommandReceipt(siteId: string, commandId: string) {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${BASE}/closure-commands/${identifier(commandId, 'commandId')}/receipt?${siteQuery(siteId)}`
  );
  const receipt = parseWorkplaceClosureCommandReceipt(response.data.data);
  if (receipt.command.siteId !== siteId || receipt.command.commandId !== commandId)
    return invalid('receipt.scope');
  return receipt;
}

async function recoverNotifications(
  operation: 'reconcile' | 'retry',
  siteId: string,
  commandId: string,
  input: WorkplaceClosureNotificationRecoveryInput,
  options: WorkplaceClosureElevatedOptions
) {
  const response = await axiosInstance.post<
    ApiResponse<unknown>,
    WorkplaceClosureNotificationRecoveryInput
  >(
    `${BASE}/closure-commands/${identifier(commandId, 'commandId')}/notifications/${operation}?${siteQuery(siteId)}`,
    input,
    { headers: idempotencyHeaders(options.idempotencyKey, true) }
  );
  const command = parseWorkplaceClosureCommand(response.data.data);
  if (command.siteId !== siteId || command.commandId !== commandId) return invalid('command.scope');
  return command;
}

export function reconcileWorkplaceClosureNotifications(
  siteId: string,
  commandId: string,
  input: WorkplaceClosureNotificationRecoveryInput,
  options: WorkplaceClosureElevatedOptions
) {
  return recoverNotifications('reconcile', siteId, commandId, input, options);
}

export function retryWorkplaceClosureNotifications(
  siteId: string,
  commandId: string,
  input: WorkplaceClosureNotificationRecoveryInput,
  options: WorkplaceClosureElevatedOptions
) {
  return recoverNotifications('retry', siteId, commandId, input, options);
}
