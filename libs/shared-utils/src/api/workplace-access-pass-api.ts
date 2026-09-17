import { axiosInstance } from '../axios-instance';
import type { ApiResponse } from '../types';
import { workplaceNavigationContractInternals } from './workplace-navigation-contract';

import type {
  WorkplaceDeviceProviderCapability,
  WorkplaceDeviceProviderTruth,
  WorkplaceDeviceProviderTruthState,
} from './workplace-navigation-contract';

const BASE = '/api/platform/v1/workplace/navigation/access-pass';

export type WorkplaceAccessPassState = 'ACTIVE' | 'REVOKED' | 'EXPIRED';
export type WorkplaceAccessPassCommandType = 'ISSUE' | 'ROTATE' | 'REVOKE';
export type WorkplaceAccessPassCommandState = 'SUCCEEDED' | 'FAILED' | 'RESULT_UNKNOWN';

export type WorkplaceAccessPass = Readonly<{
  passId: string;
  sourceBookingId: string | null;
  siteId: string;
  floorId: string;
  resourceId: string;
  destinationPoiId: string;
  state: WorkplaceAccessPassState;
  credentialLastFour: string;
  pairingAvailable: boolean;
  nfcEnabled: boolean;
  qrEnabled: boolean;
  nfcProviderCode: string | null;
  nfcProviderConfigurationVersion: number | null;
  nfcProviderEvidenceReference: string | null;
  qrProviderCode: string | null;
  qrProviderConfigurationVersion: number | null;
  qrProviderEvidenceReference: string | null;
  version: number;
  issuedAt: string;
  expiresAt: string;
  revokedAt: string | null;
  updatedAt: string;
}>;

export type WorkplaceAccessPassContext = Readonly<{
  pass: WorkplaceAccessPass | null;
  providers: readonly WorkplaceDeviceProviderTruth[];
  bookingEligible: boolean;
  bookingEndsAt: string | null;
  evaluatedAt: string;
}>;

export type WorkplaceAccessPassPreviewInput = Readonly<{
  commandType: WorkplaceAccessPassCommandType;
  passId: string | null;
  siteId: string;
  floorId: string;
  resourceId: string;
  destinationPoiId: string;
  expectedPassVersion: number;
}>;

export type WorkplaceAccessPassPreview = WorkplaceAccessPassPreviewInput &
  Readonly<{
    previewId: string;
    nfcEnabled: boolean;
    qrEnabled: boolean;
    eligible: boolean;
    impact: readonly string[];
    limitations: readonly string[];
    expiresAt: string;
    createdAt: string;
  }>;

export type WorkplaceAccessPassConfirmInput = Readonly<{
  previewId: string;
  expectedPassVersion: number;
  reason: string;
  explicitConfirmation: true;
}>;

export type WorkplaceAccessPassCommandReceipt = Readonly<{
  commandId: string;
  passId: string;
  commandType: WorkplaceAccessPassCommandType;
  state: WorkplaceAccessPassCommandState;
  reason: string;
  resultCode: string | null;
  version: number;
  recoveryByGetOnly: boolean;
  statusHref: string;
  correlationId: string | null;
  acceptedAt: string;
  completedAt: string | null;
  updatedAt: string;
}>;

export type WorkplaceAccessPassCommandResult = Readonly<{
  receipt: WorkplaceAccessPassCommandReceipt;
  pass: WorkplaceAccessPass;
  oneTimeCredential: string | null;
  pairingCode: string | null;
  replayed: boolean;
}>;

export type WorkplaceAccessPassAuditEvent = Readonly<{
  auditEventId: string;
  action: string;
  passId: string;
  correlationId: string | null;
  occurredAt: string;
}>;

export type WorkplaceAccessPassCommandOptions = Readonly<{
  idempotencyKey: string;
  correlationId?: string;
  activeAccessMode: 'ELEVATED';
}>;

function identifier(value: string, label: string) {
  if (!value.match(/^[A-Za-z0-9-]{1,160}$/u)) throw new Error(`${label} is invalid.`);
  return value;
}

function idempotencyHeaders(idempotencyKey: string, correlationId?: string) {
  if (!idempotencyKey.match(/^[!-~]{1,160}$/u)) {
    throw new Error('A bounded access-pass Idempotency-Key is required.');
  }
  if (correlationId && !correlationId.match(/^[!-~]{1,160}$/u)) {
    throw new Error('The access-pass correlation identifier is invalid.');
  }
  return {
    'Idempotency-Key': idempotencyKey,
    ...(correlationId ? { 'X-Correlation-ID': correlationId } : {}),
  };
}

function parseProvider(value: unknown): WorkplaceDeviceProviderTruth {
  const { object, text, nullableText, number, enumValue } = workplaceNavigationContractInternals;
  const row = object(value, 'Access provider truth');
  return {
    capability: enumValue(
      row.capability,
      [
        'MDM',
        'GRAPH',
        'BLE',
        'NFC',
        'SPEED_GATE',
        'SENSOR',
        'MTLS',
        'TPM',
      ] as const satisfies readonly WorkplaceDeviceProviderCapability[],
      'Provider capability'
    ),
    providerCode: nullableText(row.providerCode, 'Provider code'),
    state: enumValue(
      row.state,
      [
        'NOT_CONFIGURED',
        'CONFIGURED_UNVERIFIED',
        'HEALTHY',
        'DEGRADED',
        'STALE',
      ] as const satisfies readonly WorkplaceDeviceProviderTruthState[],
      'Provider state'
    ),
    configurationVersion: number(row.configurationVersion, 'Provider configuration version'),
    observedConfigurationVersion:
      row.observedConfigurationVersion === null || row.observedConfigurationVersion === undefined
        ? null
        : number(row.observedConfigurationVersion, 'Observed provider configuration version'),
    evidenceReference: nullableText(row.evidenceReference, 'Provider evidence reference'),
    sourceAt: nullableText(row.sourceAt, 'Provider source time'),
    receivedAt: nullableText(row.receivedAt, 'Provider received time'),
    lastSuccessAt: nullableText(row.lastSuccessAt, 'Provider last success'),
    errorCode: nullableText(row.errorCode, 'Provider error code'),
    version: number(row.version, 'Provider version'),
    evaluatedAt: text(row.evaluatedAt, 'Provider evaluation time'),
  };
}

export function parseWorkplaceAccessPass(value: unknown): WorkplaceAccessPass {
  const { object, text, nullableText, number, boolean, enumValue } =
    workplaceNavigationContractInternals;
  const row = object(value, 'Workplace access pass');
  return {
    passId: text(row.passId, 'Pass id'),
    sourceBookingId: nullableText(row.sourceBookingId, 'Source booking id'),
    siteId: text(row.siteId, 'Pass site id'),
    floorId: text(row.floorId, 'Pass floor id'),
    resourceId: text(row.resourceId, 'Pass resource id'),
    destinationPoiId: text(row.destinationPoiId, 'Pass destination POI id'),
    state: enumValue(row.state, ['ACTIVE', 'REVOKED', 'EXPIRED'] as const, 'Pass state'),
    credentialLastFour: text(row.credentialLastFour, 'Credential suffix'),
    pairingAvailable: boolean(row.pairingAvailable, 'Pairing availability'),
    nfcEnabled: boolean(row.nfcEnabled, 'NFC availability'),
    qrEnabled: boolean(row.qrEnabled, 'QR availability'),
    nfcProviderCode: nullableText(row.nfcProviderCode, 'Pass NFC provider code'),
    nfcProviderConfigurationVersion:
      row.nfcProviderConfigurationVersion === null ||
      row.nfcProviderConfigurationVersion === undefined
        ? null
        : number(row.nfcProviderConfigurationVersion, 'Pass NFC provider configuration version'),
    nfcProviderEvidenceReference: nullableText(
      row.nfcProviderEvidenceReference,
      'Pass NFC provider evidence'
    ),
    qrProviderCode: nullableText(row.qrProviderCode, 'Pass QR provider code'),
    qrProviderConfigurationVersion:
      row.qrProviderConfigurationVersion === null ||
      row.qrProviderConfigurationVersion === undefined
        ? null
        : number(row.qrProviderConfigurationVersion, 'Pass QR provider configuration version'),
    qrProviderEvidenceReference: nullableText(
      row.qrProviderEvidenceReference,
      'Pass QR provider evidence'
    ),
    version: number(row.version, 'Pass version'),
    issuedAt: text(row.issuedAt, 'Pass issued time'),
    expiresAt: text(row.expiresAt, 'Pass expiry'),
    revokedAt: nullableText(row.revokedAt, 'Pass revoked time'),
    updatedAt: text(row.updatedAt, 'Pass updated time'),
  };
}

export function parseWorkplaceAccessPassContext(value: unknown): WorkplaceAccessPassContext {
  const { object, text, nullableText, boolean } = workplaceNavigationContractInternals;
  const row = object(value, 'Workplace access-pass context');
  return {
    pass: row.pass === null || row.pass === undefined ? null : parseWorkplaceAccessPass(row.pass),
    providers: Array.isArray(row.providers) ? row.providers.map(parseProvider) : [],
    bookingEligible: boolean(row.bookingEligible, 'Booking eligibility'),
    bookingEndsAt: nullableText(row.bookingEndsAt, 'Booking end'),
    evaluatedAt: text(row.evaluatedAt, 'Access-pass evaluation time'),
  };
}

function parsePreview(value: unknown): WorkplaceAccessPassPreview {
  const { object, text, nullableText, number, boolean, strings, enumValue } =
    workplaceNavigationContractInternals;
  const row = object(value, 'Workplace access-pass preview');
  return {
    previewId: text(row.previewId, 'Preview id'),
    commandType: enumValue(
      row.commandType,
      ['ISSUE', 'ROTATE', 'REVOKE'] as const,
      'Pass command type'
    ),
    passId: nullableText(row.passId, 'Preview pass id'),
    siteId: text(row.siteId, 'Preview site id'),
    floorId: text(row.floorId, 'Preview floor id'),
    resourceId: text(row.resourceId, 'Preview resource id'),
    destinationPoiId: text(row.destinationPoiId, 'Preview destination id'),
    expectedPassVersion: number(row.expectedPassVersion, 'Expected pass version'),
    nfcEnabled: boolean(row.nfcEnabled, 'Preview NFC availability'),
    qrEnabled: boolean(row.qrEnabled, 'Preview QR availability'),
    eligible: boolean(row.eligible, 'Preview eligibility'),
    impact: strings(row.impact, 'Preview impact'),
    limitations: strings(row.limitations, 'Preview limitations'),
    expiresAt: text(row.expiresAt, 'Preview expiry'),
    createdAt: text(row.createdAt, 'Preview creation time'),
  };
}

function parseReceipt(value: unknown): WorkplaceAccessPassCommandReceipt {
  const { object, text, nullableText, number, boolean, enumValue } =
    workplaceNavigationContractInternals;
  const row = object(value, 'Workplace access-pass receipt');
  return {
    commandId: text(row.commandId, 'Command id'),
    passId: text(row.passId, 'Receipt pass id'),
    commandType: enumValue(
      row.commandType,
      ['ISSUE', 'ROTATE', 'REVOKE'] as const,
      'Receipt command type'
    ),
    state: enumValue(
      row.state,
      ['SUCCEEDED', 'FAILED', 'RESULT_UNKNOWN'] as const,
      'Receipt state'
    ),
    reason: text(row.reason, 'Receipt reason'),
    resultCode: nullableText(row.resultCode, 'Receipt result code'),
    version: number(row.version, 'Receipt version'),
    recoveryByGetOnly: boolean(row.recoveryByGetOnly, 'GET-only recovery'),
    statusHref: text(row.statusHref, 'Receipt status href'),
    correlationId: nullableText(row.correlationId, 'Receipt correlation id'),
    acceptedAt: text(row.acceptedAt, 'Receipt acceptance time'),
    completedAt: nullableText(row.completedAt, 'Receipt completion time'),
    updatedAt: text(row.updatedAt, 'Receipt update time'),
  };
}

function parseCommandResult(value: unknown): WorkplaceAccessPassCommandResult {
  const { object, nullableText, boolean } = workplaceNavigationContractInternals;
  const row = object(value, 'Workplace access-pass command result');
  return {
    receipt: parseReceipt(row.receipt),
    pass: parseWorkplaceAccessPass(row.pass),
    oneTimeCredential: nullableText(row.oneTimeCredential, 'One-time credential'),
    pairingCode: nullableText(row.pairingCode, 'One-time pairing code'),
    replayed: boolean(row.replayed, 'Command replay flag'),
  };
}

function parseAudit(value: unknown): WorkplaceAccessPassAuditEvent {
  const { object, text, nullableText } = workplaceNavigationContractInternals;
  const row = object(value, 'Workplace access-pass audit event');
  return {
    auditEventId: text(row.auditEventId, 'Audit event id'),
    action: text(row.action, 'Audit action'),
    passId: text(row.passId, 'Audit pass id'),
    correlationId: nullableText(row.correlationId, 'Audit correlation id'),
    occurredAt: text(row.occurredAt, 'Audit occurrence time'),
  };
}

export async function getWorkplaceAccessPassContext(
  siteId: string,
  resourceId: string
): Promise<WorkplaceAccessPassContext> {
  const query = new URLSearchParams({
    siteId: identifier(siteId, 'Site id'),
    resourceId: identifier(resourceId, 'Resource id'),
  });
  const response = await axiosInstance.get<ApiResponse<unknown>>(`${BASE}?${query}`);
  return parseWorkplaceAccessPassContext(response.data.data);
}

export async function previewWorkplaceAccessPass(
  input: WorkplaceAccessPassPreviewInput,
  idempotencyKey: string
): Promise<WorkplaceAccessPassPreview> {
  const response = await axiosInstance.post<ApiResponse<unknown>, WorkplaceAccessPassPreviewInput>(
    `${BASE}:preview`,
    input,
    { headers: idempotencyHeaders(idempotencyKey) }
  );
  return parsePreview(response.data.data);
}

export async function executeWorkplaceAccessPass(
  input: WorkplaceAccessPassConfirmInput,
  options: WorkplaceAccessPassCommandOptions
): Promise<WorkplaceAccessPassCommandResult> {
  const response = await axiosInstance.post<ApiResponse<unknown>, WorkplaceAccessPassConfirmInput>(
    `${BASE}:execute`,
    input,
    {
      headers: {
        ...idempotencyHeaders(options.idempotencyKey, options.correlationId),
        'X-DWP-Active-Access-Mode': options.activeAccessMode,
      },
    }
  );
  return parseCommandResult(response.data.data);
}

/** RESULT_UNKNOWN recovery is read-only and never replays the original command. */
export async function getWorkplaceAccessPassCommand(
  commandId: string
): Promise<WorkplaceAccessPassCommandResult> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${BASE}/commands/${identifier(commandId, 'Command id')}`
  );
  return parseCommandResult(response.data.data);
}

export async function getWorkplaceAccessPassAuditEvents(
  passId?: string
): Promise<readonly WorkplaceAccessPassAuditEvent[]> {
  const query = new URLSearchParams({ limit: '20' });
  if (passId) query.set('passId', identifier(passId, 'Pass id'));
  const response = await axiosInstance.get<ApiResponse<unknown>>(`${BASE}/audit-events?${query}`);
  if (!Array.isArray(response.data.data))
    throw new Error('Access-pass audit events must be a list.');
  return response.data.data.map(parseAudit);
}
