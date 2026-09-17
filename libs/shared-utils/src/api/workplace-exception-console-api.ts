import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import type {
  WorkplaceConnectorReplayPreview,
  WorkplaceConnectorReplayStartResponse,
} from './workplace-connector-operations-api';
import type { WorkplaceConnectorKind } from './workplace-collaboration-api';
import {
  parseWorkplaceConnectorReplayPreview,
  parseWorkplaceConnectorReplayStartResponse,
} from './workplace-connector-operations-api';

const BASE = '/api/platform/v1/admin/workplace/exceptions';
const SOURCES = new Set(['SAFETY', 'BOOKING', 'CONNECTOR']);
const SEVERITIES = new Set(['CRITICAL', 'ERROR', 'WARNING']);
const STATUSES = new Set(['ACTIVE', 'RECOVERING']);
const ACTIONS = new Set(['OPEN_SAFETY', 'REVIEW_BOOKING', 'REPLAY_CONNECTOR']);
const GUARDRAIL_STATUSES = new Set(['HEALTHY', 'WARNING', 'BREACHED', 'UNKNOWN']);
const CONNECTOR_KINDS = new Set([
  'CALENDAR',
  'ACTUAL_PRESENCE',
  'ACCESS_CONTROL',
  'SIGNAGE',
  'VISITOR',
  'VEHICLE',
  'FACILITY_WORK_ORDER',
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const IDEMPOTENCY = /^[\x21-\x7e]{1,160}$/u;

export type WorkplaceExceptionSource = 'SAFETY' | 'BOOKING' | 'CONNECTOR';
export type WorkplaceExceptionSeverity = 'CRITICAL' | 'ERROR' | 'WARNING';
export type WorkplaceExceptionStatus = 'ACTIVE' | 'RECOVERING';
export type WorkplaceExceptionAction = 'OPEN_SAFETY' | 'REVIEW_BOOKING' | 'REPLAY_CONNECTOR';
export type WorkplaceGuardrailStatus = 'HEALTHY' | 'WARNING' | 'BREACHED' | 'UNKNOWN';

export type WorkplaceExceptionItem = Readonly<{
  exceptionId: string;
  source: WorkplaceExceptionSource;
  severity: WorkplaceExceptionSeverity;
  status: WorkplaceExceptionStatus;
  title: string;
  impact: string;
  code: string;
  detectedAt: string;
  version: number;
  evidence: readonly string[];
  action: WorkplaceExceptionAction;
  actionHref: string | null;
  connectorKind: WorkplaceConnectorKind | null;
  configurationVersion: number | null;
  runtimeVersion: number | null;
}>;

export type WorkplaceExceptionConsole = Readonly<{
  summary: Readonly<{
    active: number;
    critical: number;
    warning: number;
    error: number;
    concurrencyConflicts24h: number;
    deadLetterQueueDepth: number;
    automaticRecoveryPercent: number | null;
    slaCompliancePercent: number | null;
  }>;
  exceptions: readonly WorkplaceExceptionItem[];
  guardrails: readonly Readonly<{
    code: string;
    name: string;
    scope: string;
    threshold: string;
    observedValue: string;
    status: WorkplaceGuardrailStatus;
    enforcement: string;
  }>[];
  generatedAt: string;
  externalTelemetryUrl: string | null;
}>;

export type WorkplaceExceptionRecoveryPreview = Readonly<{
  exceptionId: string;
  replay: WorkplaceConnectorReplayPreview;
  impactSummary: string;
}>;

export type WorkplaceExceptionRecoveryReceipt = Readonly<{
  exceptionId: string;
  recovery: WorkplaceConnectorReplayStartResponse;
}>;

export type WorkplaceExceptionExportPreview = Readonly<{
  previewId: string;
  rowCount: number;
  purpose: string;
  createdAt: string;
  expiresAt: string;
}>;

export type WorkplaceExceptionExportReceipt = Readonly<{
  commandId: string;
  rowCount: number;
  acceptedAt: string;
  expiresAt: string;
  downloadHref: string;
  idempotentReplay: boolean;
  correlationId: string;
}>;

function invalid(path: string): never {
  throw new Error(`Invalid Workplace exception-console response at ${path}.`);
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
    [...value].some((character) => character.charCodeAt(0) < 0x20)
  )
    return invalid(path);
  return value;
}

function nullableText(value: unknown, path: string, maximum = 500): string | null {
  return value === null ? null : text(value, path, maximum);
}

function enumeration<T extends string>(value: unknown, values: Set<string>, path: string): T {
  return typeof value === 'string' && values.has(value) ? (value as T) : invalid(path);
}

function integer(value: unknown, path: string): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : invalid(path);
}

function nullableInteger(value: unknown, path: string): number | null {
  return value === null ? null : integer(value, path);
}

function nullableNumber(value: unknown, path: string): number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0)
    ? (value as number | null)
    : invalid(path);
}

function nullablePercent(value: unknown, path: string): number | null {
  const result = nullableNumber(value, path);
  return result === null || result <= 100 ? result : invalid(path);
}

function instant(value: unknown, path: string): string {
  const result = text(value, path, 64);
  return Number.isFinite(Date.parse(result)) ? result : invalid(path);
}

function uuid(value: unknown, path: string): string {
  const result = text(value, path, 36);
  return UUID.test(result) ? result : invalid(path);
}

function stringList(value: unknown, path: string): readonly string[] {
  if (!Array.isArray(value) || value.length > 20) return invalid(path);
  return value.map((item, index) => text(item, `${path}[${index}]`, 320));
}

export function parseWorkplaceExceptionItem(
  value: unknown,
  path = 'exception'
): WorkplaceExceptionItem {
  const data = record(value, path);
  const actionHref = nullableText(data.actionHref, `${path}.actionHref`, 500);
  if (actionHref !== null && !actionHref.startsWith('/workplace/'))
    return invalid(`${path}.actionHref`);
  const connectorKind =
    data.connectorKind === null
      ? null
      : enumeration<WorkplaceConnectorKind>(
          data.connectorKind,
          CONNECTOR_KINDS,
          `${path}.connectorKind`
        );
  return Object.freeze({
    exceptionId: text(data.exceptionId, `${path}.exceptionId`, 100),
    source: enumeration<WorkplaceExceptionSource>(data.source, SOURCES, `${path}.source`),
    severity: enumeration<WorkplaceExceptionSeverity>(
      data.severity,
      SEVERITIES,
      `${path}.severity`
    ),
    status: enumeration<WorkplaceExceptionStatus>(data.status, STATUSES, `${path}.status`),
    title: text(data.title, `${path}.title`),
    impact: text(data.impact, `${path}.impact`),
    code: text(data.code, `${path}.code`, 120),
    detectedAt: instant(data.detectedAt, `${path}.detectedAt`),
    version: integer(data.version, `${path}.version`),
    evidence: stringList(data.evidence, `${path}.evidence`),
    action: enumeration<WorkplaceExceptionAction>(data.action, ACTIONS, `${path}.action`),
    actionHref,
    connectorKind,
    configurationVersion: nullableInteger(
      data.configurationVersion,
      `${path}.configurationVersion`
    ),
    runtimeVersion: nullableInteger(data.runtimeVersion, `${path}.runtimeVersion`),
  });
}

export function parseWorkplaceExceptionConsole(value: unknown): WorkplaceExceptionConsole {
  const data = record(value, 'console');
  const summary = record(data.summary, 'console.summary');
  if (!Array.isArray(data.exceptions) || data.exceptions.length > 300)
    return invalid('console.exceptions');
  if (!Array.isArray(data.guardrails) || data.guardrails.length > 30)
    return invalid('console.guardrails');
  const externalTelemetryUrl = nullableText(
    data.externalTelemetryUrl,
    'console.externalTelemetryUrl',
    500
  );
  if (externalTelemetryUrl !== null && !externalTelemetryUrl.startsWith('https://'))
    return invalid('console.externalTelemetryUrl');
  return Object.freeze({
    summary: Object.freeze({
      active: integer(summary.active, 'console.summary.active'),
      critical: integer(summary.critical, 'console.summary.critical'),
      warning: integer(summary.warning, 'console.summary.warning'),
      error: integer(summary.error, 'console.summary.error'),
      concurrencyConflicts24h: integer(
        summary.concurrencyConflicts24h,
        'console.summary.concurrencyConflicts24h'
      ),
      deadLetterQueueDepth: integer(
        summary.deadLetterQueueDepth,
        'console.summary.deadLetterQueueDepth'
      ),
      automaticRecoveryPercent: nullablePercent(
        summary.automaticRecoveryPercent,
        'console.summary.automaticRecoveryPercent'
      ),
      slaCompliancePercent: nullablePercent(
        summary.slaCompliancePercent,
        'console.summary.slaCompliancePercent'
      ),
    }),
    exceptions: data.exceptions.map((item, index) =>
      parseWorkplaceExceptionItem(item, `console.exceptions[${index}]`)
    ),
    guardrails: data.guardrails.map((value, index) => {
      const item = record(value, `console.guardrails[${index}]`);
      return Object.freeze({
        code: text(item.code, `console.guardrails[${index}].code`, 120),
        name: text(item.name, `console.guardrails[${index}].name`),
        scope: text(item.scope, `console.guardrails[${index}].scope`),
        threshold: text(item.threshold, `console.guardrails[${index}].threshold`),
        observedValue: text(item.observedValue, `console.guardrails[${index}].observedValue`),
        status: enumeration<WorkplaceGuardrailStatus>(
          item.status,
          GUARDRAIL_STATUSES,
          `console.guardrails[${index}].status`
        ),
        enforcement: text(item.enforcement, `console.guardrails[${index}].enforcement`),
      });
    }),
    generatedAt: instant(data.generatedAt, 'console.generatedAt'),
    externalTelemetryUrl,
  });
}

function exceptionPath(exceptionId: string) {
  const normalized = exceptionId.trim();
  if (!/^(SAFETY|BOOKING):[0-9a-f-]{36}$|^CONNECTOR:[A-Z_]{3,40}$/u.test(normalized))
    throw new Error('Workplace exception identifier is invalid.');
  const urlSafeReference = normalized.replace(':', '_');
  return `${BASE}/${urlSafeReference}`;
}

export async function getWorkplaceExceptionConsole() {
  const response = await axiosInstance.get<ApiResponse<unknown>>(BASE);
  return parseWorkplaceExceptionConsole(response.data.data);
}

export async function previewWorkplaceExceptionRecovery(
  exceptionId: string,
  input: Readonly<{ from: string; to: string; maximumRecords: number }>,
  options: Readonly<{
    idempotencyKey: string;
    activeAccessMode: 'ELEVATED';
    correlationId?: string;
  }>
): Promise<WorkplaceExceptionRecoveryPreview> {
  if (
    !Number.isFinite(Date.parse(input.from)) ||
    !Number.isFinite(Date.parse(input.to)) ||
    Date.parse(input.to) <= Date.parse(input.from) ||
    !Number.isSafeInteger(input.maximumRecords) ||
    input.maximumRecords < 1 ||
    input.maximumRecords > 100_000 ||
    !IDEMPOTENCY.test(options.idempotencyKey)
  )
    throw new Error('Workplace exception recovery preview input is invalid.');
  const response = await axiosInstance.post<ApiResponse<unknown>, typeof input>(
    `${exceptionPath(exceptionId)}/recovery:preview`,
    input,
    {
      headers: {
        'Idempotency-Key': options.idempotencyKey,
        'X-DWP-Active-Access-Mode': options.activeAccessMode,
        ...(options.correlationId ? { 'X-Correlation-ID': options.correlationId } : {}),
      },
    }
  );
  const data = record(response.data.data, 'recoveryPreview');
  const returnedId = text(data.exceptionId, 'recoveryPreview.exceptionId', 100);
  if (returnedId !== exceptionId) return invalid('recoveryPreview.exceptionId');
  return Object.freeze({
    exceptionId: returnedId,
    replay: parseWorkplaceConnectorReplayPreview(data.replay),
    impactSummary: text(data.impactSummary, 'recoveryPreview.impactSummary'),
  });
}

export async function startWorkplaceExceptionRecovery(
  exceptionId: string,
  input: Readonly<{
    previewId: string;
    configurationVersion: number;
    runtimeVersion: number;
    reason: string;
    explicitConfirmation: true;
  }>,
  options: Readonly<{
    idempotencyKey: string;
    activeAccessMode: 'ELEVATED';
    correlationId?: string;
  }>
): Promise<WorkplaceExceptionRecoveryReceipt> {
  const reason = input.reason.trim();
  if (
    !UUID.test(input.previewId) ||
    !Number.isSafeInteger(input.configurationVersion) ||
    input.configurationVersion < 0 ||
    !Number.isSafeInteger(input.runtimeVersion) ||
    input.runtimeVersion < 0 ||
    !reason ||
    reason.length > 500 ||
    !IDEMPOTENCY.test(options.idempotencyKey)
  )
    throw new Error('Workplace exception recovery command is invalid.');
  const response = await axiosInstance.post<ApiResponse<unknown>, typeof input>(
    `${exceptionPath(exceptionId)}/recovery`,
    { ...input, reason },
    {
      headers: {
        'Idempotency-Key': options.idempotencyKey,
        'X-DWP-Active-Access-Mode': options.activeAccessMode,
        ...(options.correlationId ? { 'X-Correlation-ID': options.correlationId } : {}),
      },
    }
  );
  const data = record(response.data.data, 'recoveryReceipt');
  const returnedId = text(data.exceptionId, 'recoveryReceipt.exceptionId', 100);
  if (returnedId !== exceptionId) return invalid('recoveryReceipt.exceptionId');
  return Object.freeze({
    exceptionId: returnedId,
    recovery: parseWorkplaceConnectorReplayStartResponse(data.recovery),
  });
}

export async function previewWorkplaceExceptionExport(
  purpose: string,
  options: Readonly<{ idempotencyKey: string; activeAccessMode: 'ELEVATED' }>
): Promise<WorkplaceExceptionExportPreview> {
  const normalized = purpose.trim();
  if (!normalized || normalized.length > 500 || !IDEMPOTENCY.test(options.idempotencyKey))
    throw new Error('Workplace exception export preview input is invalid.');
  const response = await axiosInstance.post<ApiResponse<unknown>, { purpose: string }>(
    `${BASE}/exports:preview`,
    { purpose: normalized },
    {
      headers: {
        'Idempotency-Key': options.idempotencyKey,
        'X-DWP-Active-Access-Mode': options.activeAccessMode,
      },
    }
  );
  const data = record(response.data.data, 'exportPreview');
  return Object.freeze({
    previewId: uuid(data.previewId, 'exportPreview.previewId'),
    rowCount: integer(data.rowCount, 'exportPreview.rowCount'),
    purpose: text(data.purpose, 'exportPreview.purpose'),
    createdAt: instant(data.createdAt, 'exportPreview.createdAt'),
    expiresAt: instant(data.expiresAt, 'exportPreview.expiresAt'),
  });
}

export async function startWorkplaceExceptionExport(
  input: Readonly<{
    previewId: string;
    reason: string;
    explicitConfirmation: true;
  }>,
  options: Readonly<{ idempotencyKey: string; activeAccessMode: 'ELEVATED' }>
): Promise<WorkplaceExceptionExportReceipt> {
  const reason = input.reason.trim();
  if (
    !UUID.test(input.previewId) ||
    !reason ||
    reason.length > 500 ||
    !IDEMPOTENCY.test(options.idempotencyKey)
  )
    throw new Error('Workplace exception export command is invalid.');
  const response = await axiosInstance.post<ApiResponse<unknown>, typeof input>(
    `${BASE}/exports`,
    { ...input, reason },
    {
      headers: {
        'Idempotency-Key': options.idempotencyKey,
        'X-DWP-Active-Access-Mode': options.activeAccessMode,
      },
    }
  );
  const data = record(response.data.data, 'exportReceipt');
  const downloadHref = text(data.downloadHref, 'exportReceipt.downloadHref', 500);
  if (!downloadHref.startsWith('/v1/admin/workplace/exceptions/exports/'))
    return invalid('exportReceipt.downloadHref');
  return Object.freeze({
    commandId: uuid(data.commandId, 'exportReceipt.commandId'),
    rowCount: integer(data.rowCount, 'exportReceipt.rowCount'),
    acceptedAt: instant(data.acceptedAt, 'exportReceipt.acceptedAt'),
    expiresAt: instant(data.expiresAt, 'exportReceipt.expiresAt'),
    downloadHref,
    idempotentReplay: data.idempotentReplay === true,
    correlationId: text(data.correlationId, 'exportReceipt.correlationId', 160),
  });
}

export async function downloadWorkplaceExceptionExport(
  commandId: string,
  options: Readonly<{ activeAccessMode: 'ELEVATED' }>
) {
  if (!UUID.test(commandId)) throw new Error('Workplace exception export command is invalid.');
  const response = await axiosInstance.get<Blob>(
    `${BASE}/exports/${encodeURIComponent(commandId)}/content`,
    {
      responseType: 'blob',
      headers: { Accept: 'text/csv', 'X-DWP-Active-Access-Mode': options.activeAccessMode },
    }
  );
  return response.data;
}
