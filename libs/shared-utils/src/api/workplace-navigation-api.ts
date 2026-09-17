import { axiosInstance } from '../axios-instance';
import type { ApiResponse } from '../types';
import {
  parseWorkplaceDevice,
  parseWorkplaceDeviceCommandPreview,
  parseWorkplaceDeviceCommandReceipt,
  parseWorkplaceDeviceProjection,
  parseWorkplaceNavigationPoi,
  parseWorkplaceNavigationRoute,
  workplaceNavigationContractInternals,
} from './workplace-navigation-contract';

import type {
  WorkplaceDevice,
  WorkplaceDeviceAuditEvent,
  WorkplaceDeviceCommandPreview,
  WorkplaceDeviceCommandReceipt,
  WorkplaceDeviceCommandType,
  WorkplaceDeviceProjection,
  WorkplaceDeviceProviderCapability,
  WorkplaceDeviceProviderTruth,
  WorkplaceDeviceRegistrationState,
  WorkplaceDeviceType,
  WorkplaceNavigationGraphRevision,
  WorkplaceNavigationPoi,
  WorkplaceNavigationRoute,
} from './workplace-navigation-contract';

const USER_BASE = '/api/platform/v1/workplace/navigation';
const ADMIN_BASE = '/api/platform/v1/admin/workplace';
const DEVICE_BASE = '/api/platform/v1/device/workplace/devices';

export type WorkplaceNavigationRouteInput = Readonly<{
  siteId: string;
  originPoiId: string;
  destinationPoiId: string;
  accessible: boolean;
  avoidStairs: boolean;
}>;

export type WorkplaceDeviceCommandOptions = Readonly<{
  idempotencyKey: string;
  correlationId?: string;
  activeAccessMode: 'ELEVATED';
}>;

export type WorkplaceDeviceCommandPreviewOptions = Readonly<{
  idempotencyKey: string;
  correlationId: string;
}>;

export type WorkplaceDeviceApproveInput = Readonly<{
  expectedVersion: number;
  reason: string;
  explicitConfirmation: true;
}>;

export type WorkplaceDeviceBindInput = WorkplaceDeviceApproveInput &
  Readonly<{
    siteId: string;
    floorId: string;
    resourceId: string | null;
    safetyOfflineFallback: boolean;
  }>;

export type WorkplaceDeviceCommandPreviewInput = Readonly<{
  commandType: WorkplaceDeviceCommandType;
  expectedDeviceVersion: number;
  payload: Readonly<Record<string, string>>;
}>;

export type WorkplaceDeviceCommandInput = Readonly<{
  previewId: string;
  expectedDeviceVersion: number;
  reason: string;
  explicitConfirmation: true;
}>;

export type WorkplaceDeviceRegistrationInput = Readonly<{
  displayName: string;
  deviceType: WorkplaceDeviceType;
  hardwareModel: string;
  osVersion: string;
}>;

export type WorkplaceDeviceHeartbeatInput = Readonly<{
  expectedVersion: number;
  appVersion: string;
  policyVersion: string;
  observedAt: string;
  scheduleSourceAt: string | null;
  recentErrorCode: string | null;
}>;

export type WorkplaceDeviceProviderConfigurationInput = Readonly<{
  providerCode: string;
  configurationVersion: number;
  configured: boolean;
  reason: string;
  explicitConfirmation: true;
}>;

function id(value: string, label: string) {
  if (!value.trim() || value.length > 320) throw new Error(`${label} is invalid.`);
  return encodeURIComponent(value);
}

function commandHeaders(options: WorkplaceDeviceCommandOptions) {
  if (!options.idempotencyKey.trim() || options.idempotencyKey.length > 160) {
    throw new Error('A valid Workplace device idempotency key is required.');
  }
  return {
    'Idempotency-Key': options.idempotencyKey,
    'X-DWP-Active-Access-Mode': options.activeAccessMode,
    ...(options.correlationId ? { 'X-Correlation-ID': options.correlationId } : {}),
  };
}

function previewCommandHeaders(options: WorkplaceDeviceCommandPreviewOptions) {
  if (!options.idempotencyKey.match(/^[!-~]{1,160}$/u)) {
    throw new Error('A valid Workplace device preview idempotency key is required.');
  }
  if (!options.correlationId.match(/^[!-~]{1,160}$/u)) {
    throw new Error('A valid Workplace device preview correlation id is required.');
  }
  return {
    'Idempotency-Key': options.idempotencyKey,
    'X-Correlation-ID': options.correlationId,
  };
}

function deviceCredentialHeaders(deviceCredential: string) {
  if (!deviceCredential.trim() || deviceCredential.length > 1024) {
    throw new Error('A valid device credential is required.');
  }
  return { 'X-DWP-Device-Credential': deviceCredential };
}

function parseList<T>(value: unknown, parser: (entry: unknown) => T, label: string): readonly T[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value.map(parser);
}

function parseGraph(value: unknown): WorkplaceNavigationGraphRevision {
  const { object, text, nullableText, number, enumValue } = workplaceNavigationContractInternals;
  const row = object(value, 'Navigation graph');
  return {
    graphRevisionId: text(row.graphRevisionId, 'Graph revision id'),
    siteId: text(row.siteId, 'Graph site id'),
    revisionNumber: number(row.revisionNumber, 'Graph revision number'),
    state: enumValue(
      row.state,
      ['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED'] as const,
      'Graph state'
    ),
    contentHash: text(row.contentHash, 'Graph content hash'),
    changeSummary: text(row.changeSummary, 'Graph change summary'),
    version: number(row.version, 'Graph version'),
    submittedAt: text(row.submittedAt, 'Graph submitted time'),
    publishedAt: nullableText(row.publishedAt, 'Graph published time'),
    nodeCount: number(row.nodeCount, 'Graph node count'),
    edgeCount: number(row.edgeCount, 'Graph edge count'),
    poiCount: number(row.poiCount, 'Graph POI count'),
    updatedAt: text(row.updatedAt, 'Graph updated time'),
  };
}

function parseProvider(value: unknown): WorkplaceDeviceProviderTruth {
  const { object, text, nullableText, number, enumValue } = workplaceNavigationContractInternals;
  const row = object(value, 'Device provider truth');
  return {
    capability: enumValue(
      row.capability,
      ['MDM', 'GRAPH', 'BLE', 'NFC', 'SPEED_GATE', 'SENSOR', 'MTLS', 'TPM'] as const,
      'Provider capability'
    ),
    providerCode: nullableText(row.providerCode, 'Provider code'),
    state: enumValue(
      row.state,
      ['NOT_CONFIGURED', 'CONFIGURED_UNVERIFIED', 'HEALTHY', 'DEGRADED', 'STALE'] as const,
      'Provider truth'
    ),
    configurationVersion: number(row.configurationVersion, 'Provider configuration version'),
    observedConfigurationVersion:
      row.observedConfigurationVersion === null || row.observedConfigurationVersion === undefined
        ? null
        : number(row.observedConfigurationVersion, 'Observed configuration version'),
    evidenceReference: nullableText(row.evidenceReference, 'Provider evidence reference'),
    sourceAt: nullableText(row.sourceAt, 'Provider source time'),
    receivedAt: nullableText(row.receivedAt, 'Provider received time'),
    lastSuccessAt: nullableText(row.lastSuccessAt, 'Provider last success'),
    errorCode: nullableText(row.errorCode, 'Provider error code'),
    version: number(row.version, 'Provider version'),
    evaluatedAt: text(row.evaluatedAt, 'Provider evaluated time'),
  };
}

function parseAudit(value: unknown): WorkplaceDeviceAuditEvent {
  const { object, text, nullableText, number } = workplaceNavigationContractInternals;
  const row = object(value, 'Device audit event');
  return {
    auditEventId: text(row.auditEventId, 'Audit event id'),
    actorUserId: number(row.actorUserId, 'Audit actor id'),
    action: text(row.action, 'Audit action'),
    resourceType: text(row.resourceType, 'Audit resource type'),
    resourceId: text(row.resourceId, 'Audit resource id'),
    correlationId: nullableText(row.correlationId, 'Audit correlation id'),
    occurredAt: text(row.occurredAt, 'Audit event time'),
  };
}

export async function getWorkplaceNavigationPois(
  siteId: string
): Promise<readonly WorkplaceNavigationPoi[]> {
  const query = new URLSearchParams({ siteId: id(siteId, 'Site id') });
  const response = await axiosInstance.get<ApiResponse<unknown>>(`${USER_BASE}/pois?${query}`);
  return parseList(response.data.data, parseWorkplaceNavigationPoi, 'Navigation POIs');
}

export async function getWorkplaceNavigationRoute(
  input: WorkplaceNavigationRouteInput
): Promise<WorkplaceNavigationRoute> {
  const query = new URLSearchParams({
    siteId: id(input.siteId, 'Site id'),
    originPoiId: id(input.originPoiId, 'Origin POI id'),
    destinationPoiId: id(input.destinationPoiId, 'Destination POI id'),
    accessible: String(input.accessible),
    avoidStairs: String(input.avoidStairs),
  });
  const response = await axiosInstance.get<ApiResponse<unknown>>(`${USER_BASE}/routes?${query}`);
  return parseWorkplaceNavigationRoute(response.data.data);
}

export async function getWorkplaceNavigationGraphs(
  siteId?: string
): Promise<readonly WorkplaceNavigationGraphRevision[]> {
  const query = siteId ? `?siteId=${id(siteId, 'Site id')}` : '';
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${ADMIN_BASE}/navigation/graphs${query}`
  );
  return parseList(response.data.data, parseGraph, 'Navigation graphs');
}

export async function getWorkplaceDevices(
  input: Readonly<{ siteId?: string; state?: WorkplaceDeviceRegistrationState }> = {}
): Promise<readonly WorkplaceDevice[]> {
  const query = new URLSearchParams();
  if (input.siteId) query.set('siteId', id(input.siteId, 'Site id'));
  if (input.state) query.set('state', input.state);
  const suffix = query.size ? `?${query}` : '';
  const response = await axiosInstance.get<ApiResponse<unknown>>(`${ADMIN_BASE}/devices${suffix}`);
  return parseList(response.data.data, parseWorkplaceDevice, 'Workplace devices');
}

export async function getWorkplaceDevice(deviceId: string): Promise<WorkplaceDevice> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${ADMIN_BASE}/devices/${id(deviceId, 'Device id')}`
  );
  return parseWorkplaceDevice(response.data.data);
}

export async function approveWorkplaceDevice(
  deviceId: string,
  input: WorkplaceDeviceApproveInput,
  options: WorkplaceDeviceCommandOptions
): Promise<WorkplaceDevice> {
  const response = await axiosInstance.post<ApiResponse<unknown>, WorkplaceDeviceApproveInput>(
    `${ADMIN_BASE}/devices/${id(deviceId, 'Device id')}:approve`,
    input,
    { headers: commandHeaders(options) }
  );
  return parseWorkplaceDevice(response.data.data);
}

export async function bindWorkplaceDevice(
  deviceId: string,
  input: WorkplaceDeviceBindInput,
  options: WorkplaceDeviceCommandOptions
): Promise<WorkplaceDevice> {
  const response = await axiosInstance.post<ApiResponse<unknown>, WorkplaceDeviceBindInput>(
    `${ADMIN_BASE}/devices/${id(deviceId, 'Device id')}:bind`,
    input,
    { headers: commandHeaders(options) }
  );
  return parseWorkplaceDevice(response.data.data);
}

export async function getWorkplaceDeviceProviders(): Promise<
  readonly WorkplaceDeviceProviderTruth[]
> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(`${ADMIN_BASE}/device-providers`);
  return parseList(response.data.data, parseProvider, 'Device providers');
}

export async function configureWorkplaceDeviceProvider(
  capability: WorkplaceDeviceProviderCapability,
  input: WorkplaceDeviceProviderConfigurationInput,
  options: WorkplaceDeviceCommandOptions
): Promise<WorkplaceDeviceProviderTruth> {
  const response = await axiosInstance.put<
    ApiResponse<unknown>,
    WorkplaceDeviceProviderConfigurationInput
  >(`${ADMIN_BASE}/device-providers/${capability}`, input, { headers: commandHeaders(options) });
  return parseProvider(response.data.data);
}

export async function previewWorkplaceDeviceCommand(
  deviceId: string,
  input: WorkplaceDeviceCommandPreviewInput,
  options: WorkplaceDeviceCommandPreviewOptions
): Promise<WorkplaceDeviceCommandPreview> {
  const response = await axiosInstance.post<
    ApiResponse<unknown>,
    WorkplaceDeviceCommandPreviewInput
  >(`${ADMIN_BASE}/devices/${id(deviceId, 'Device id')}/commands:preview`, input, {
    headers: previewCommandHeaders(options),
  });
  return parseWorkplaceDeviceCommandPreview(response.data.data);
}

export async function executeWorkplaceDeviceCommand(
  deviceId: string,
  input: WorkplaceDeviceCommandInput,
  options: WorkplaceDeviceCommandOptions
): Promise<WorkplaceDeviceCommandReceipt> {
  const response = await axiosInstance.post<ApiResponse<unknown>, WorkplaceDeviceCommandInput>(
    `${ADMIN_BASE}/devices/${id(deviceId, 'Device id')}/commands`,
    input,
    { headers: commandHeaders(options) }
  );
  return parseWorkplaceDeviceCommandReceipt(response.data.data);
}

/** RESULT_UNKNOWN recovery is deliberately read-only. Never replay the original POST here. */
export async function getWorkplaceDeviceCommandReceipt(
  commandId: string
): Promise<WorkplaceDeviceCommandReceipt> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${ADMIN_BASE}/devices/commands/${id(commandId, 'Command id')}`
  );
  return parseWorkplaceDeviceCommandReceipt(response.data.data);
}

export async function getWorkplaceDeviceCommands(
  deviceId: string
): Promise<readonly WorkplaceDeviceCommandReceipt[]> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${ADMIN_BASE}/devices/${id(deviceId, 'Device id')}/commands`
  );
  return parseList(
    response.data.data,
    parseWorkplaceDeviceCommandReceipt,
    'Device command receipts'
  );
}

export async function getWorkplaceDeviceAuditEvents(
  deviceId: string
): Promise<readonly WorkplaceDeviceAuditEvent[]> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${ADMIN_BASE}/devices/${id(deviceId, 'Device id')}/audit-events`
  );
  return parseList(response.data.data, parseAudit, 'Device audit events');
}

export async function registerWorkplaceDevice(
  input: WorkplaceDeviceRegistrationInput,
  deviceCredential: string
): Promise<WorkplaceDevice> {
  const response = await axiosInstance.post<ApiResponse<unknown>, WorkplaceDeviceRegistrationInput>(
    `${DEVICE_BASE}:register`,
    input,
    { headers: deviceCredentialHeaders(deviceCredential) }
  );
  return parseWorkplaceDevice(response.data.data);
}

export async function heartbeatWorkplaceDevice(
  deviceId: string,
  input: WorkplaceDeviceHeartbeatInput,
  deviceCredential: string
): Promise<WorkplaceDevice> {
  const response = await axiosInstance.post<ApiResponse<unknown>, WorkplaceDeviceHeartbeatInput>(
    `${DEVICE_BASE}/${id(deviceId, 'Device id')}/heartbeat`,
    input,
    { headers: deviceCredentialHeaders(deviceCredential) }
  );
  return parseWorkplaceDevice(response.data.data);
}

export async function getWorkplaceDeviceProjection(
  deviceId: string,
  deviceCredential: string
): Promise<WorkplaceDeviceProjection> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${DEVICE_BASE}/${id(deviceId, 'Device id')}/projection`,
    { headers: deviceCredentialHeaders(deviceCredential) }
  );
  return parseWorkplaceDeviceProjection(response.data.data);
}
