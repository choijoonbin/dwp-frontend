import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

const BASE = '/api/platform/v1/admin/workplace/space-planning/reports';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256 = /^[0-9a-f]{64}$/u;
const REVISION = /^psr-[0-9a-f]{64}$/u;
const IDEMPOTENCY = /^[\x21-\x7e]{1,160}$/u;
const PDF_MIME = 'application/pdf';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export type WorkplacePlanningReportFormat = 'PDF' | 'XLSX';
export type WorkplacePlanningReportState = 'SUCCEEDED' | 'FAILED' | 'RESULT_UNKNOWN';

export type WorkplacePlanningReportSnapshot = Readonly<{
  scenarioId: string;
  scenarioVersion: number;
  scenarioName: string;
  scenarioState: string;
  siteId: string;
  siteCode: string;
  siteName: string;
  floorId: string | null;
  floorName: string | null;
  windowStart: string;
  windowEnd: string;
  currentCapacity: number;
  proposedCapacity: number;
  currentRoomCapacity: number;
  proposedRoomCapacity: number;
  currentAccessibleResourceCount: number;
  proposedAccessibleResourceCount: number;
  currentUtilizationPercent: number | null;
  proposedUtilizationPercent: number | null;
  peakDemand: number | null;
  forecastConfidencePercent: number | null;
  forecastState: string | null;
  calculationVersion: string | null;
  energyValue: number | null;
  energyUnit: string | null;
  co2eValue: number | null;
  co2eUnit: string | null;
  emissionFactorVersion: string | null;
  emissionRegionCode: string | null;
  affectedResourceCount: number;
  impactedBookingCount: number | null;
  personLevelDataIncluded: false;
  personLevelRowCount: 0;
  capturedAt: string;
}>;

export type WorkplacePlanningReportPreview = Readonly<{
  previewId: string;
  scenarioId: string;
  siteId: string;
  floorId: string | null;
  format: WorkplacePlanningReportFormat;
  scenarioVersion: number;
  previewVersion: number;
  confirmationToken: string;
  snapshotSha256: string;
  snapshot: WorkplacePlanningReportSnapshot;
  createdAt: string;
  expiresAt: string;
  idempotentReplay: boolean;
}>;

export type WorkplacePlanningReportReceipt = Readonly<{
  commandId: string;
  previewId: string;
  scenarioId: string;
  siteId: string;
  floorId: string | null;
  format: WorkplacePlanningReportFormat;
  state: WorkplacePlanningReportState;
  scenarioVersion: number;
  commandVersion: number;
  mimeType: typeof PDF_MIME | typeof XLSX_MIME;
  fileName: string;
  byteSize: number;
  contentSha256: string;
  contentHref: string | null;
  acceptedAt: string;
  completedAt: string;
  expiresAt: string;
  idempotentReplay: boolean;
  correlationId: string;
}>;

function invalid(path: string): never {
  throw new Error(`Invalid Workplace space-planning report response at ${path}.`);
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
      const code = character.codePointAt(0) ?? 0;
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

function integer(value: unknown, path: string, minimum = 0): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum
    ? value
    : invalid(path);
}

function number(value: unknown, path: string): number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value))
    ? (value as number | null)
    : invalid(path);
}

function instant(value: unknown, path: string): string {
  const result = text(value, path, 64);
  return Number.isFinite(Date.parse(result)) ? result : invalid(path);
}

function bool(value: unknown, path: string): boolean {
  return typeof value === 'boolean' ? value : invalid(path);
}

function enumeration<T extends string>(value: unknown, values: readonly T[], path: string): T {
  return typeof value === 'string' && values.includes(value as T) ? (value as T) : invalid(path);
}

function reason(value: string) {
  const normalized = value.trim();
  if (
    !normalized ||
    normalized.length > 500 ||
    [...normalized].some((character) => (character.codePointAt(0) ?? 0) < 0x20)
  )
    throw new Error('A valid board-report reason is required.');
  return normalized;
}

function identifier(value: string, label: string) {
  const normalized = value.trim();
  if (!UUID.test(normalized)) throw new Error(`${label} is invalid.`);
  return normalized;
}

function key(value: string) {
  if (!IDEMPOTENCY.test(value)) throw new Error('Board-report idempotency key is invalid.');
  return value;
}

function decisionRevision(value: string) {
  if (!REVISION.test(value)) throw new Error('Current export authority is unavailable.');
  return value;
}

function parseSnapshot(value: unknown): WorkplacePlanningReportSnapshot {
  const row = record(value, 'reportPreview.snapshot');
  const personLevelDataIncluded = bool(
    row.personLevelDataIncluded,
    'reportPreview.snapshot.personLevelDataIncluded'
  );
  const personLevelRowCount = integer(
    row.personLevelRowCount,
    'reportPreview.snapshot.personLevelRowCount'
  );
  if (personLevelDataIncluded || personLevelRowCount !== 0) {
    return invalid('reportPreview.snapshot.personLevelData');
  }
  return Object.freeze({
    scenarioId: uuid(row.scenarioId, 'reportPreview.snapshot.scenarioId'),
    scenarioVersion: integer(row.scenarioVersion, 'reportPreview.snapshot.scenarioVersion', 1),
    scenarioName: text(row.scenarioName, 'reportPreview.snapshot.scenarioName'),
    scenarioState: text(row.scenarioState, 'reportPreview.snapshot.scenarioState', 32),
    siteId: uuid(row.siteId, 'reportPreview.snapshot.siteId'),
    siteCode: text(row.siteCode, 'reportPreview.snapshot.siteCode', 100),
    siteName: text(row.siteName, 'reportPreview.snapshot.siteName'),
    floorId: nullableUuid(row.floorId, 'reportPreview.snapshot.floorId'),
    floorName: nullableText(row.floorName, 'reportPreview.snapshot.floorName'),
    windowStart: instant(row.windowStart, 'reportPreview.snapshot.windowStart'),
    windowEnd: instant(row.windowEnd, 'reportPreview.snapshot.windowEnd'),
    currentCapacity: integer(row.currentCapacity, 'reportPreview.snapshot.currentCapacity'),
    proposedCapacity: integer(row.proposedCapacity, 'reportPreview.snapshot.proposedCapacity'),
    currentRoomCapacity: integer(
      row.currentRoomCapacity,
      'reportPreview.snapshot.currentRoomCapacity'
    ),
    proposedRoomCapacity: integer(
      row.proposedRoomCapacity,
      'reportPreview.snapshot.proposedRoomCapacity'
    ),
    currentAccessibleResourceCount: integer(
      row.currentAccessibleResourceCount,
      'reportPreview.snapshot.currentAccessibleResourceCount'
    ),
    proposedAccessibleResourceCount: integer(
      row.proposedAccessibleResourceCount,
      'reportPreview.snapshot.proposedAccessibleResourceCount'
    ),
    currentUtilizationPercent: number(
      row.currentUtilizationPercent,
      'reportPreview.snapshot.currentUtilizationPercent'
    ),
    proposedUtilizationPercent: number(
      row.proposedUtilizationPercent,
      'reportPreview.snapshot.proposedUtilizationPercent'
    ),
    peakDemand: number(row.peakDemand, 'reportPreview.snapshot.peakDemand'),
    forecastConfidencePercent: number(
      row.forecastConfidencePercent,
      'reportPreview.snapshot.forecastConfidencePercent'
    ),
    forecastState: nullableText(row.forecastState, 'reportPreview.snapshot.forecastState', 32),
    calculationVersion: nullableText(
      row.calculationVersion,
      'reportPreview.snapshot.calculationVersion',
      160
    ),
    energyValue: number(row.energyValue, 'reportPreview.snapshot.energyValue'),
    energyUnit: nullableText(row.energyUnit, 'reportPreview.snapshot.energyUnit', 32),
    co2eValue: number(row.co2eValue, 'reportPreview.snapshot.co2eValue'),
    co2eUnit: nullableText(row.co2eUnit, 'reportPreview.snapshot.co2eUnit', 32),
    emissionFactorVersion: nullableText(
      row.emissionFactorVersion,
      'reportPreview.snapshot.emissionFactorVersion',
      160
    ),
    emissionRegionCode: nullableText(
      row.emissionRegionCode,
      'reportPreview.snapshot.emissionRegionCode',
      32
    ),
    affectedResourceCount: integer(
      row.affectedResourceCount,
      'reportPreview.snapshot.affectedResourceCount'
    ),
    impactedBookingCount:
      row.impactedBookingCount === null
        ? null
        : integer(row.impactedBookingCount, 'reportPreview.snapshot.impactedBookingCount'),
    personLevelDataIncluded: false,
    personLevelRowCount: 0,
    capturedAt: instant(row.capturedAt, 'reportPreview.snapshot.capturedAt'),
  });
}

export function parseWorkplacePlanningReportPreview(
  value: unknown
): WorkplacePlanningReportPreview {
  const row = record(value, 'reportPreview');
  const snapshot = parseSnapshot(row.snapshot);
  const result = Object.freeze({
    previewId: uuid(row.previewId, 'reportPreview.previewId'),
    scenarioId: uuid(row.scenarioId, 'reportPreview.scenarioId'),
    siteId: uuid(row.siteId, 'reportPreview.siteId'),
    floorId: nullableUuid(row.floorId, 'reportPreview.floorId'),
    format: enumeration(row.format, ['PDF', 'XLSX'] as const, 'reportPreview.format'),
    scenarioVersion: integer(row.scenarioVersion, 'reportPreview.scenarioVersion', 1),
    previewVersion: integer(row.previewVersion, 'reportPreview.previewVersion', 1),
    confirmationToken: uuid(row.confirmationToken, 'reportPreview.confirmationToken'),
    snapshotSha256: text(row.snapshotSha256, 'reportPreview.snapshotSha256', 64),
    snapshot,
    createdAt: instant(row.createdAt, 'reportPreview.createdAt'),
    expiresAt: instant(row.expiresAt, 'reportPreview.expiresAt'),
    idempotentReplay: bool(row.idempotentReplay, 'reportPreview.idempotentReplay'),
  });
  if (
    !SHA256.test(result.snapshotSha256) ||
    result.scenarioId !== snapshot.scenarioId ||
    result.siteId !== snapshot.siteId ||
    result.floorId !== snapshot.floorId ||
    result.scenarioVersion !== snapshot.scenarioVersion ||
    Date.parse(result.expiresAt) <= Date.parse(result.createdAt) ||
    Date.parse(snapshot.windowEnd) <= Date.parse(snapshot.windowStart)
  )
    return invalid('reportPreview.binding');
  return result;
}

export function parseWorkplacePlanningReportReceipt(
  value: unknown
): WorkplacePlanningReportReceipt {
  const row = record(value, 'reportReceipt');
  const format = enumeration(row.format, ['PDF', 'XLSX'] as const, 'reportReceipt.format');
  const commandId = uuid(row.commandId, 'reportReceipt.commandId');
  const siteId = uuid(row.siteId, 'reportReceipt.siteId');
  const mimeType = text(row.mimeType, 'reportReceipt.mimeType', 100);
  const fileName = text(row.fileName, 'reportReceipt.fileName', 220);
  const contentHref = nullableText(row.contentHref, 'reportReceipt.contentHref', 500);
  const expectedMime = format === 'PDF' ? PDF_MIME : XLSX_MIME;
  const expectedSuffix = format === 'PDF' ? '.pdf' : '.xlsx';
  const expectedHref = `/v1/admin/workplace/space-planning/reports/${commandId}/content`;
  if (
    mimeType !== expectedMime ||
    !fileName.endsWith(expectedSuffix) ||
    !/^[A-Za-z0-9._-]{1,220}$/u.test(fileName) ||
    (contentHref !== null &&
      !contentHref.startsWith(`${expectedHref}?`) &&
      contentHref !== expectedHref)
  )
    return invalid('reportReceipt.content');
  if (contentHref !== null) {
    const url = new URL(contentHref, 'https://dwp.invalid');
    if (
      url.pathname !== expectedHref ||
      url.searchParams.get('siteId') !== siteId ||
      [...url.searchParams.keys()].some((name) => name !== 'siteId')
    )
      return invalid('reportReceipt.contentHref');
  }
  const result = Object.freeze({
    commandId,
    previewId: uuid(row.previewId, 'reportReceipt.previewId'),
    scenarioId: uuid(row.scenarioId, 'reportReceipt.scenarioId'),
    siteId,
    floorId: nullableUuid(row.floorId, 'reportReceipt.floorId'),
    format,
    state: enumeration(
      row.state,
      ['SUCCEEDED', 'FAILED', 'RESULT_UNKNOWN'] as const,
      'reportReceipt.state'
    ),
    scenarioVersion: integer(row.scenarioVersion, 'reportReceipt.scenarioVersion', 1),
    commandVersion: integer(row.commandVersion, 'reportReceipt.commandVersion', 1),
    mimeType: expectedMime,
    fileName,
    byteSize: integer(row.byteSize, 'reportReceipt.byteSize', 1),
    contentSha256: text(row.contentSha256, 'reportReceipt.contentSha256', 64),
    contentHref,
    acceptedAt: instant(row.acceptedAt, 'reportReceipt.acceptedAt'),
    completedAt: instant(row.completedAt, 'reportReceipt.completedAt'),
    expiresAt: instant(row.expiresAt, 'reportReceipt.expiresAt'),
    idempotentReplay: bool(row.idempotentReplay, 'reportReceipt.idempotentReplay'),
    correlationId: text(row.correlationId, 'reportReceipt.correlationId', 160),
  });
  if (
    !SHA256.test(result.contentSha256) ||
    result.byteSize > 10_485_760 ||
    Date.parse(result.completedAt) < Date.parse(result.acceptedAt) ||
    Date.parse(result.expiresAt) <= Date.parse(result.completedAt)
  )
    return invalid('reportReceipt.integrity');
  return result;
}

function query(siteId: string) {
  return `?siteId=${encodeURIComponent(identifier(siteId, 'Site id'))}`;
}

export async function previewWorkplacePlanningBoardReport(
  siteId: string,
  input: Readonly<{
    scenarioId: string;
    expectedScenarioVersion: number;
    format: WorkplacePlanningReportFormat;
    reason: string;
  }>,
  options: Readonly<{ idempotencyKey: string; correlationId?: string }>
) {
  const body = {
    scenarioId: identifier(input.scenarioId, 'Scenario id'),
    expectedScenarioVersion: integer(
      input.expectedScenarioVersion,
      'reportPreview.expectedScenarioVersion',
      1
    ),
    format: enumeration(input.format, ['PDF', 'XLSX'] as const, 'reportPreview.format'),
    reason: reason(input.reason),
  };
  const response = await axiosInstance.post<ApiResponse<unknown>, typeof body>(
    `${BASE}:preview${query(siteId)}`,
    body,
    {
      headers: {
        'Idempotency-Key': key(options.idempotencyKey),
        ...(options.correlationId ? { 'X-Correlation-ID': options.correlationId } : {}),
        'Cache-Control': 'no-store',
      },
    }
  );
  return parseWorkplacePlanningReportPreview(response.data.data);
}

export async function executeWorkplacePlanningBoardReport(
  siteId: string,
  input: Readonly<{
    previewId: string;
    expectedPreviewVersion: number;
    expectedScenarioVersion: number;
    confirmationToken: string;
    reason: string;
    explicitConfirmation: true;
  }>,
  options: Readonly<{
    idempotencyKey: string;
    activeAccessMode: 'ELEVATED';
    decisionRevision: string;
    correlationId?: string;
  }>
) {
  const revision = decisionRevision(options.decisionRevision);
  const body = {
    previewId: identifier(input.previewId, 'Report preview id'),
    expectedPreviewVersion: integer(
      input.expectedPreviewVersion,
      'reportExecute.expectedPreviewVersion',
      1
    ),
    expectedScenarioVersion: integer(
      input.expectedScenarioVersion,
      'reportExecute.expectedScenarioVersion',
      1
    ),
    confirmationToken: identifier(input.confirmationToken, 'Confirmation token'),
    reason: reason(input.reason),
    explicitConfirmation: input.explicitConfirmation,
  };
  const response = await axiosInstance.post<ApiResponse<unknown>, typeof body>(
    `${BASE}${query(siteId)}`,
    body,
    {
      headers: {
        'Idempotency-Key': key(options.idempotencyKey),
        'X-DWP-Active-Access-Mode': options.activeAccessMode,
        'X-DWP-Expected-Decision-Revision': revision,
        'X-DWP-Current-Decision-Revision': revision,
        ...(options.correlationId ? { 'X-Correlation-ID': options.correlationId } : {}),
        'Cache-Control': 'no-store',
      },
    }
  );
  return parseWorkplacePlanningReportReceipt(response.data.data);
}

export async function getWorkplacePlanningBoardReportReceipt(siteId: string, commandId: string) {
  const normalizedCommand = identifier(commandId, 'Report command id');
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${BASE}/${encodeURIComponent(normalizedCommand)}${query(siteId)}`,
    { headers: { 'Cache-Control': 'no-store' } }
  );
  return parseWorkplacePlanningReportReceipt(response.data.data);
}

function hex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

export async function downloadWorkplacePlanningBoardReport(
  receipt: WorkplacePlanningReportReceipt,
  options: Readonly<{ activeAccessMode: 'ELEVATED'; decisionRevision: string }>
) {
  const revision = decisionRevision(options.decisionRevision);
  if (receipt.state !== 'SUCCEEDED' || !receipt.contentHref) {
    throw new Error('The board-report content is unavailable.');
  }
  const response = await axiosInstance.get<Blob>(
    `${BASE}/${encodeURIComponent(receipt.commandId)}/content${query(receipt.siteId)}`,
    {
      responseType: 'blob',
      headers: {
        Accept: receipt.mimeType,
        'X-DWP-Active-Access-Mode': options.activeAccessMode,
        'X-DWP-Expected-Decision-Revision': revision,
        'X-DWP-Current-Decision-Revision': revision,
        'Cache-Control': 'no-store',
      },
    }
  );
  const blob = response.data;
  if (blob.type !== receipt.mimeType || blob.size !== receipt.byteSize) {
    throw new Error('The downloaded board-report metadata does not match its receipt.');
  }
  const bytes = await blob.arrayBuffer();
  const prefix = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 5));
  const validMagic =
    receipt.format === 'PDF'
      ? new TextDecoder().decode(prefix) === '%PDF-'
      : prefix.length >= 2 && prefix[0] === 0x50 && prefix[1] === 0x4b;
  const digest = hex(await crypto.subtle.digest('SHA-256', bytes));
  if (!validMagic || digest !== receipt.contentSha256) {
    throw new Error('The downloaded board-report integrity check failed.');
  }
  return blob;
}
