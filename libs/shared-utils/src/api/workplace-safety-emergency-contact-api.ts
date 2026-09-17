import { axiosInstance } from '../axios-instance';
import type { ApiResponse } from '../types';
import { workplaceNavigationContractInternals } from './workplace-navigation-contract';
import { parseWorkplaceSafetyCommandReceipt } from './workplace-safety-parser';

import type { WorkplaceSafetyCommandReceipt } from './workplace-safety-contract';

const USER_BASE = '/api/platform/v1/workplace/safety';
const ADMIN_BASE = '/api/platform/v1/admin/workplace/safety';

export type WorkplaceEmergencyContactKind = 'HOTLINE' | 'RADIO' | 'PUBLIC_EMERGENCY';
export type WorkplaceEmergencyContactActionMode = 'TEL_URI' | 'GOVERNED_HANDOFF';
export type WorkplaceEmergencyContactProviderState =
  'NOT_CONFIGURED' | 'CONFIGURED_UNVERIFIED' | 'READY' | 'DEGRADED' | 'STALE';

export type WorkplaceEmergencyContact = Readonly<{
  contactId: string;
  kind: WorkplaceEmergencyContactKind;
  displayNameKo: string;
  displayNameEn: string;
  actionMode: WorkplaceEmergencyContactActionMode;
  telUri: string | null;
  directTelAllowed: boolean;
  providerState: WorkplaceEmergencyContactProviderState;
  providerCode: string | null;
  providerConfigurationVersion: number | null;
  active: boolean;
  sortOrder: number;
  version: number;
  evaluatedAt: string;
}>;

export type WorkplaceEmergencyContactConfigurationInput = Readonly<{
  kind: WorkplaceEmergencyContactKind;
  displayNameKo: string;
  displayNameEn: string;
  actionMode: WorkplaceEmergencyContactActionMode;
  telUri: string | null;
  directTelAllowed: boolean;
  active: boolean;
  sortOrder: number;
  expectedVersion: number;
  reason: string;
  explicitConfirmation: true;
}>;

export type WorkplaceEmergencyHandoffPreviewInput = Readonly<{
  contactId: string;
  expectedIncidentVersion: number;
  expectedContactVersion: number;
  reason: string;
}>;

export type WorkplaceEmergencyHandoffPreview = Readonly<{
  previewId: string;
  incidentId: string;
  contactId: string;
  expectedIncidentVersion: number;
  expectedContactVersion: number;
  providerState: WorkplaceEmergencyContactProviderState;
  providerCode: string | null;
  providerConfigurationVersion: number | null;
  eligible: boolean;
  impact: readonly string[];
  limitations: readonly string[];
  expiresAt: string;
  createdAt: string;
}>;

export type WorkplaceEmergencyHandoffConfirmInput = Readonly<{
  previewId: string;
  expectedIncidentVersion: number;
  expectedContactVersion: number;
  reason: string;
  explicitConfirmation: true;
}>;

export type WorkplaceEmergencyHandoffReceipt = Readonly<{
  handoffId: string;
  commandId: string;
  previewId: string;
  incidentId: string;
  contactId: string;
  state: 'SUCCEEDED' | 'FAILED' | 'RESULT_UNKNOWN';
  resultCode: string | null;
  providerOperationReference: string | null;
  providerEvidenceReference: string | null;
  version: number;
  statusHref: string;
  correlationId: string;
  acceptedAt: string;
  completedAt: string | null;
  updatedAt: string;
  idempotentReplay: boolean;
}>;

export type WorkplaceEmergencyCommandOptions = Readonly<{
  idempotencyKey: string;
  correlationId?: string;
  activeAccessMode: 'ELEVATED';
}>;

function id(value: string, label: string) {
  if (!value.match(/^[A-Za-z0-9-]{1,160}$/u)) throw new Error(`${label} is invalid.`);
  return encodeURIComponent(value);
}

function headers(options: WorkplaceEmergencyCommandOptions) {
  if (!options.idempotencyKey.match(/^[!-~]{1,160}$/u)) {
    throw new Error('A bounded emergency-contact Idempotency-Key is required.');
  }
  if (options.correlationId && !options.correlationId.match(/^[!-~]{1,160}$/u)) {
    throw new Error('The emergency-contact correlation identifier is invalid.');
  }
  return {
    'Idempotency-Key': options.idempotencyKey,
    'X-DWP-Active-Access-Mode': options.activeAccessMode,
    ...(options.correlationId ? { 'X-Correlation-ID': options.correlationId } : {}),
  };
}

export function parseWorkplaceEmergencyContact(value: unknown): WorkplaceEmergencyContact {
  const { object, text, nullableText, number, boolean, enumValue } =
    workplaceNavigationContractInternals;
  const row = object(value, 'Workplace emergency contact');
  const telUri = nullableText(row.telUri, 'Emergency tel URI');
  if (telUri && !telUri.match(/^tel:\+[1-9][0-9]{6,14}$/u)) {
    throw new Error('Emergency tel URI is invalid.');
  }
  return {
    contactId: text(row.contactId, 'Emergency contact id'),
    kind: enumValue(
      row.kind,
      ['HOTLINE', 'RADIO', 'PUBLIC_EMERGENCY'] as const,
      'Emergency contact kind'
    ),
    displayNameKo: text(row.displayNameKo, 'Korean emergency contact name'),
    displayNameEn: text(row.displayNameEn, 'English emergency contact name'),
    actionMode: enumValue(
      row.actionMode,
      ['TEL_URI', 'GOVERNED_HANDOFF'] as const,
      'Emergency contact action mode'
    ),
    telUri,
    directTelAllowed: boolean(row.directTelAllowed, 'Direct tel policy'),
    providerState: enumValue(
      row.providerState,
      ['NOT_CONFIGURED', 'CONFIGURED_UNVERIFIED', 'READY', 'DEGRADED', 'STALE'] as const,
      'Emergency provider state'
    ),
    providerCode: nullableText(row.providerCode, 'Emergency provider code'),
    providerConfigurationVersion:
      row.providerConfigurationVersion === null || row.providerConfigurationVersion === undefined
        ? null
        : number(row.providerConfigurationVersion, 'Emergency provider configuration version'),
    active: boolean(row.active, 'Emergency contact active state'),
    sortOrder: number(row.sortOrder, 'Emergency contact sort order'),
    version: number(row.version, 'Emergency contact version'),
    evaluatedAt: text(row.evaluatedAt, 'Emergency contact evaluation time'),
  };
}

function parsePreview(value: unknown): WorkplaceEmergencyHandoffPreview {
  const { object, text, nullableText, number, boolean, strings, enumValue } =
    workplaceNavigationContractInternals;
  const row = object(value, 'Emergency handoff preview');
  return {
    previewId: text(row.previewId, 'Emergency handoff preview id'),
    incidentId: text(row.incidentId, 'Emergency handoff incident id'),
    contactId: text(row.contactId, 'Emergency handoff contact id'),
    expectedIncidentVersion: number(row.expectedIncidentVersion, 'Expected incident version'),
    expectedContactVersion: number(row.expectedContactVersion, 'Expected contact version'),
    providerState: enumValue(
      row.providerState,
      ['NOT_CONFIGURED', 'CONFIGURED_UNVERIFIED', 'READY', 'DEGRADED', 'STALE'] as const,
      'Emergency preview provider state'
    ),
    providerCode: nullableText(row.providerCode, 'Emergency preview provider code'),
    providerConfigurationVersion:
      row.providerConfigurationVersion === null || row.providerConfigurationVersion === undefined
        ? null
        : number(row.providerConfigurationVersion, 'Emergency preview provider version'),
    eligible: boolean(row.eligible, 'Emergency preview eligibility'),
    impact: strings(row.impact, 'Emergency preview impact'),
    limitations: strings(row.limitations, 'Emergency preview limitations'),
    expiresAt: text(row.expiresAt, 'Emergency preview expiry'),
    createdAt: text(row.createdAt, 'Emergency preview creation time'),
  };
}

function parseReceipt(value: unknown): WorkplaceEmergencyHandoffReceipt {
  const { object, text, nullableText, number, boolean, enumValue } =
    workplaceNavigationContractInternals;
  const row = object(value, 'Emergency handoff receipt');
  return {
    handoffId: text(row.handoffId, 'Emergency handoff id'),
    commandId: text(row.commandId, 'Emergency handoff command id'),
    previewId: text(row.previewId, 'Emergency handoff preview id'),
    incidentId: text(row.incidentId, 'Emergency handoff incident id'),
    contactId: text(row.contactId, 'Emergency handoff contact id'),
    state: enumValue(
      row.state,
      ['SUCCEEDED', 'FAILED', 'RESULT_UNKNOWN'] as const,
      'Emergency handoff state'
    ),
    resultCode: nullableText(row.resultCode, 'Emergency handoff result code'),
    providerOperationReference: nullableText(
      row.providerOperationReference,
      'Emergency provider operation reference'
    ),
    providerEvidenceReference: nullableText(
      row.providerEvidenceReference,
      'Emergency provider evidence reference'
    ),
    version: number(row.version, 'Emergency handoff version'),
    statusHref: text(row.statusHref, 'Emergency handoff status href'),
    correlationId: text(row.correlationId, 'Emergency handoff correlation id'),
    acceptedAt: text(row.acceptedAt, 'Emergency handoff acceptance time'),
    completedAt: nullableText(row.completedAt, 'Emergency handoff completion time'),
    updatedAt: text(row.updatedAt, 'Emergency handoff update time'),
    idempotentReplay: boolean(row.idempotentReplay, 'Emergency handoff replay state'),
  };
}

function parseContactConfiguration(value: unknown) {
  const row = workplaceNavigationContractInternals.object(
    value,
    'Emergency contact configuration result'
  );
  return {
    contact: parseWorkplaceEmergencyContact(row.contact),
    receipt: parseWorkplaceSafetyCommandReceipt(row.receipt),
  } as const satisfies Readonly<{
    contact: WorkplaceEmergencyContact;
    receipt: WorkplaceSafetyCommandReceipt;
  }>;
}

function parsePreviewResult(value: unknown) {
  const row = workplaceNavigationContractInternals.object(value, 'Emergency preview result');
  return {
    preview: parsePreview(row.preview),
    receipt: parseWorkplaceSafetyCommandReceipt(row.receipt),
  } as const;
}

export async function getWorkplaceEmergencyContacts(incidentId: string) {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${USER_BASE}/incidents/${id(incidentId, 'Incident id')}/emergency-contacts`
  );
  return Array.isArray(response.data.data)
    ? response.data.data.map(parseWorkplaceEmergencyContact)
    : [];
}

export async function getAdminWorkplaceEmergencyContacts() {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${ADMIN_BASE}/emergency-contacts`
  );
  return Array.isArray(response.data.data)
    ? response.data.data.map(parseWorkplaceEmergencyContact)
    : [];
}

export async function configureWorkplaceEmergencyContact(
  contactId: string,
  input: WorkplaceEmergencyContactConfigurationInput,
  options: WorkplaceEmergencyCommandOptions
) {
  const response = await axiosInstance.put<
    ApiResponse<unknown>,
    WorkplaceEmergencyContactConfigurationInput
  >(`${ADMIN_BASE}/emergency-contacts/${id(contactId, 'Emergency contact id')}`, input, {
    headers: headers(options),
  });
  return parseContactConfiguration(response.data.data);
}

export async function previewWorkplaceEmergencyHandoff(
  incidentId: string,
  input: WorkplaceEmergencyHandoffPreviewInput,
  options: WorkplaceEmergencyCommandOptions
) {
  const response = await axiosInstance.post<
    ApiResponse<unknown>,
    WorkplaceEmergencyHandoffPreviewInput
  >(`${ADMIN_BASE}/incidents/${id(incidentId, 'Incident id')}/emergency-handoffs:preview`, input, {
    headers: headers(options),
  });
  return parsePreviewResult(response.data.data);
}

export async function executeWorkplaceEmergencyHandoff(
  incidentId: string,
  input: WorkplaceEmergencyHandoffConfirmInput,
  options: WorkplaceEmergencyCommandOptions
) {
  const response = await axiosInstance.post<
    ApiResponse<unknown>,
    WorkplaceEmergencyHandoffConfirmInput
  >(`${ADMIN_BASE}/incidents/${id(incidentId, 'Incident id')}/emergency-handoffs`, input, {
    headers: headers(options),
  });
  return parseReceipt(response.data.data);
}

export async function getWorkplaceEmergencyHandoff(incidentId: string, commandId: string) {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${ADMIN_BASE}/incidents/${id(incidentId, 'Incident id')}/emergency-handoffs/${id(commandId, 'Command id')}`
  );
  return parseReceipt(response.data.data);
}

export async function reconcileWorkplaceEmergencyHandoff(
  incidentId: string,
  commandId: string,
  reason: string,
  options: WorkplaceEmergencyCommandOptions
) {
  const response = await axiosInstance.post<
    ApiResponse<unknown>,
    Readonly<{ reason: string; explicitConfirmation: true }>
  >(
    `${ADMIN_BASE}/incidents/${id(incidentId, 'Incident id')}/emergency-handoffs/${id(commandId, 'Command id')}:reconcile`,
    { reason, explicitConfirmation: true },
    { headers: headers(options) }
  );
  return parseReceipt(response.data.data);
}
