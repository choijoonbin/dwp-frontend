import { axiosInstance } from '../axios-instance';
import type { ApiResponse } from '../types';
import { workplaceNavigationContractInternals } from './workplace-navigation-contract';

const TYPES = [
  'PARKING_EXTEND',
  'PARKING_EXIT_STATUS',
  'LOCKER_UNLOCK',
  'NFC_KEY_RESEND',
  'ROOM_PRE_ENTRY',
] as const;
const PROVIDER_CAPABILITIES = ['NFC', 'SPEED_GATE'] as const;
const PROVIDER_STATES = [
  'NOT_CONFIGURED',
  'CONFIGURED_UNVERIFIED',
  'READY',
  'DEGRADED',
  'STALE',
] as const;
const AVAILABILITIES = ['AVAILABLE', 'BOOKING_INACTIVE', 'PROVIDER_NOT_READY'] as const;
const STATES = ['SUCCEEDED', 'FAILED', 'RESULT_UNKNOWN'] as const;
const RESOURCE_TYPES = [
  'ROOM',
  'DESK',
  'LOCKER',
  'PARKING',
  'FOCUS_POD',
  'PHONE_BOOTH',
  'EQUIPMENT',
] as const;

export type WorkplaceResourceCommandType = (typeof TYPES)[number];
export type WorkplaceResourceCommandProviderCapability = (typeof PROVIDER_CAPABILITIES)[number];
export type WorkplaceResourceCommandProviderState = (typeof PROVIDER_STATES)[number];
export type WorkplaceResourceCommandAvailability = (typeof AVAILABILITIES)[number];
export type WorkplaceResourceCommandState = (typeof STATES)[number];

export type WorkplaceResourceCommandAction = Readonly<{
  commandType: WorkplaceResourceCommandType;
  providerCapability: WorkplaceResourceCommandProviderCapability;
  providerState: WorkplaceResourceCommandProviderState;
  availability: WorkplaceResourceCommandAvailability;
  limitationCode: string | null;
  elevatedConfirmationRequired: boolean;
}>;

export type WorkplaceResourceCommandContext = Readonly<{
  bookingId: string;
  resourceId: string;
  resourceType: (typeof RESOURCE_TYPES)[number];
  bookingVersion: number;
  actions: readonly WorkplaceResourceCommandAction[];
  evaluatedAt: string;
}>;

export type WorkplaceResourceCommandPreviewInput = Readonly<{
  commandType: WorkplaceResourceCommandType;
  expectedBookingVersion: number;
  parameters: Readonly<Record<string, string>>;
}>;

export type WorkplaceResourceCommandPreview = Readonly<{
  previewId: string;
  bookingId: string;
  resourceId: string;
  commandType: WorkplaceResourceCommandType;
  expectedBookingVersion: number;
  parameters: Readonly<Record<string, string>>;
  providerCapability: WorkplaceResourceCommandProviderCapability;
  providerState: WorkplaceResourceCommandProviderState;
  providerCode: string | null;
  providerConfigurationVersion: number | null;
  eligible: boolean;
  impact: readonly string[];
  limitations: readonly string[];
  expiresAt: string;
  createdAt: string;
}>;

export type WorkplaceResourceCommandExecuteInput = Readonly<{
  previewId: string;
  expectedBookingVersion: number;
  reason: string;
  explicitConfirmation: true;
}>;

export type WorkplaceResourceCommandReceipt = Readonly<{
  commandId: string;
  previewId: string;
  bookingId: string;
  resourceId: string;
  commandType: WorkplaceResourceCommandType;
  state: WorkplaceResourceCommandState;
  resultCode: string | null;
  providerOperationReference: string | null;
  version: number;
  statusHref: string;
  correlationId: string | null;
  acceptedAt: string;
  completedAt: string | null;
  updatedAt: string;
  requeryRequired: boolean;
  idempotentReplay: boolean;
}>;

export type WorkplaceResourceCommandOptions = Readonly<{
  idempotencyKey: string;
  correlationId?: string;
  activeAccessMode: 'ELEVATED';
}>;

const { object, text, nullableText, number, boolean, strings, enumValue } =
  workplaceNavigationContractInternals;

function identifier(value: string, label: string) {
  if (!value.match(/^[A-Za-z0-9-]{1,160}$/u)) throw new Error(`${label} is invalid.`);
  return value;
}

function commandHeaders(options: WorkplaceResourceCommandOptions) {
  if (!options.idempotencyKey.match(/^[!-~]{1,160}$/u)) {
    throw new Error('A bounded resource-command Idempotency-Key is required.');
  }
  if (options.correlationId && !options.correlationId.match(/^[!-~]{1,160}$/u)) {
    throw new Error('The resource-command correlation identifier is invalid.');
  }
  return {
    'Idempotency-Key': options.idempotencyKey,
    'X-DWP-Active-Access-Mode': options.activeAccessMode,
    ...(options.correlationId ? { 'X-Correlation-ID': options.correlationId } : {}),
  };
}

function stringMap(value: unknown, label: string): Readonly<Record<string, string>> {
  const row = object(value, label);
  if (Object.keys(row).length > 8) throw new Error(`${label} has too many entries.`);
  return Object.freeze(
    Object.fromEntries(
      Object.entries(row).map(([key, item]) => [
        text(key, `${label} key`),
        text(item, `${label}.${key}`),
      ])
    )
  );
}

function parseAction(value: unknown): WorkplaceResourceCommandAction {
  const row = object(value, 'Resource command action');
  return Object.freeze({
    commandType: enumValue(row.commandType, TYPES, 'Resource command type'),
    providerCapability: enumValue(
      row.providerCapability,
      PROVIDER_CAPABILITIES,
      'Resource provider capability'
    ),
    providerState: enumValue(row.providerState, PROVIDER_STATES, 'Resource provider state'),
    availability: enumValue(row.availability, AVAILABILITIES, 'Resource command availability'),
    limitationCode: nullableText(row.limitationCode, 'Resource command limitation'),
    elevatedConfirmationRequired: boolean(
      row.elevatedConfirmationRequired,
      'Resource command elevated flag'
    ),
  });
}

export function parseWorkplaceResourceCommandContext(
  value: unknown
): WorkplaceResourceCommandContext {
  const row = object(value, 'Resource command context');
  if (!Array.isArray(row.actions) || row.actions.length > TYPES.length) {
    throw new Error('Resource command actions are invalid.');
  }
  return Object.freeze({
    bookingId: text(row.bookingId, 'Resource command booking id'),
    resourceId: text(row.resourceId, 'Resource command resource id'),
    resourceType: enumValue(row.resourceType, RESOURCE_TYPES, 'Resource command resource type'),
    bookingVersion: number(row.bookingVersion, 'Resource command booking version'),
    actions: Object.freeze(row.actions.map(parseAction)),
    evaluatedAt: text(row.evaluatedAt, 'Resource command evaluation time'),
  });
}

export function parseWorkplaceResourceCommandPreview(
  value: unknown
): WorkplaceResourceCommandPreview {
  const row = object(value, 'Resource command preview');
  return Object.freeze({
    previewId: text(row.previewId, 'Resource command preview id'),
    bookingId: text(row.bookingId, 'Resource command preview booking id'),
    resourceId: text(row.resourceId, 'Resource command preview resource id'),
    commandType: enumValue(row.commandType, TYPES, 'Resource command preview type'),
    expectedBookingVersion: number(
      row.expectedBookingVersion,
      'Resource command preview booking version'
    ),
    parameters: stringMap(row.parameters, 'Resource command parameters'),
    providerCapability: enumValue(
      row.providerCapability,
      PROVIDER_CAPABILITIES,
      'Resource command preview provider capability'
    ),
    providerState: enumValue(
      row.providerState,
      PROVIDER_STATES,
      'Resource command preview provider state'
    ),
    providerCode: nullableText(row.providerCode, 'Resource command provider code'),
    providerConfigurationVersion:
      row.providerConfigurationVersion === null
        ? null
        : number(
            row.providerConfigurationVersion,
            'Resource command provider configuration version'
          ),
    eligible: boolean(row.eligible, 'Resource command preview eligibility'),
    impact: strings(row.impact, 'Resource command impact'),
    limitations: strings(row.limitations, 'Resource command limitations'),
    expiresAt: text(row.expiresAt, 'Resource command preview expiry'),
    createdAt: text(row.createdAt, 'Resource command preview created time'),
  });
}

export function parseWorkplaceResourceCommandReceipt(
  value: unknown
): WorkplaceResourceCommandReceipt {
  const row = object(value, 'Resource command receipt');
  return Object.freeze({
    commandId: text(row.commandId, 'Resource command id'),
    previewId: text(row.previewId, 'Resource command receipt preview id'),
    bookingId: text(row.bookingId, 'Resource command receipt booking id'),
    resourceId: text(row.resourceId, 'Resource command receipt resource id'),
    commandType: enumValue(row.commandType, TYPES, 'Resource command receipt type'),
    state: enumValue(row.state, STATES, 'Resource command receipt state'),
    resultCode: nullableText(row.resultCode, 'Resource command result code'),
    providerOperationReference: nullableText(
      row.providerOperationReference,
      'Resource command provider operation reference'
    ),
    version: number(row.version, 'Resource command receipt version'),
    statusHref: text(row.statusHref, 'Resource command receipt status href'),
    correlationId: nullableText(row.correlationId, 'Resource command correlation id'),
    acceptedAt: text(row.acceptedAt, 'Resource command accepted time'),
    completedAt: nullableText(row.completedAt, 'Resource command completed time'),
    updatedAt: text(row.updatedAt, 'Resource command updated time'),
    requeryRequired: boolean(row.requeryRequired, 'Resource command requery flag'),
    idempotentReplay: boolean(row.idempotentReplay, 'Resource command replay flag'),
  });
}

function base(bookingId: string) {
  return `/api/platform/v1/workplace/bookings/${identifier(bookingId, 'Booking id')}`;
}

export async function getWorkplaceResourceCommandContext(
  bookingId: string
): Promise<WorkplaceResourceCommandContext> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${base(bookingId)}/resource-command-context`
  );
  return parseWorkplaceResourceCommandContext(response.data.data);
}

export async function previewWorkplaceResourceCommand(
  bookingId: string,
  input: WorkplaceResourceCommandPreviewInput
): Promise<WorkplaceResourceCommandPreview> {
  const response = await axiosInstance.post<
    ApiResponse<unknown>,
    WorkplaceResourceCommandPreviewInput
  >(`${base(bookingId)}/resource-commands:preview`, input);
  return parseWorkplaceResourceCommandPreview(response.data.data);
}

export async function getWorkplaceResourceCommandPreview(
  bookingId: string,
  previewId: string
): Promise<WorkplaceResourceCommandPreview> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${base(bookingId)}/resource-command-previews/${identifier(previewId, 'Preview id')}`
  );
  return parseWorkplaceResourceCommandPreview(response.data.data);
}

export async function executeWorkplaceResourceCommand(
  bookingId: string,
  input: WorkplaceResourceCommandExecuteInput,
  options: WorkplaceResourceCommandOptions
): Promise<WorkplaceResourceCommandReceipt> {
  const response = await axiosInstance.post<
    ApiResponse<unknown>,
    WorkplaceResourceCommandExecuteInput
  >(`${base(bookingId)}/resource-commands`, input, { headers: commandHeaders(options) });
  return parseWorkplaceResourceCommandReceipt(response.data.data);
}

export async function getWorkplaceResourceCommandReceipt(
  bookingId: string,
  commandId: string
): Promise<WorkplaceResourceCommandReceipt> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${base(bookingId)}/resource-commands/${identifier(commandId, 'Command id')}`
  );
  return parseWorkplaceResourceCommandReceipt(response.data.data);
}

export async function reconcileWorkplaceResourceCommand(
  bookingId: string,
  commandId: string,
  reason: string,
  options: WorkplaceResourceCommandOptions
): Promise<WorkplaceResourceCommandReceipt> {
  const response = await axiosInstance.post<
    ApiResponse<unknown>,
    { reason: string; explicitConfirmation: true }
  >(
    `${base(bookingId)}/resource-commands/${identifier(commandId, 'Command id')}:reconcile`,
    { reason, explicitConfirmation: true },
    { headers: commandHeaders(options) }
  );
  return parseWorkplaceResourceCommandReceipt(response.data.data);
}
