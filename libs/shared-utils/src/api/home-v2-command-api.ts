import { axiosInstance } from '../axios-instance';
import { HttpError } from '../http-error';
import { isSafeHomeInternalRoute } from './home-v2-api';

import type { ApiResponse } from '../types';
import type { HomeDeviceClass } from './home-personalization-api';
import type { HomeExperienceVariant } from './home-experience-api';

export const HOME_DISMISS_RECOMMENDATION_ACTION = Object.freeze({
  actionId: 'dismiss-recommendation',
  commandKey: 'home.recommendation.dismiss',
  definitionKey: 'core.workspace.daily-brief',
  definitionVersion: '1.0.0',
  labelKey: 'home.action.dismissRecommendation',
} as const);

export type HomeV2WidgetCommandStatus = 'ACCEPTED' | 'COMPLETED';

export type HomeV2WidgetCommandReceipt = Readonly<{
  acceptedAt: string;
  commandId: string;
  commandKey: typeof HOME_DISMISS_RECOMMENDATION_ACTION.commandKey;
  receiptId: string;
  resultVersion: string;
  sourceRoute: string;
  status: HomeV2WidgetCommandStatus;
}>;

export type ExecuteHomeV2WidgetActionInput = Readonly<{
  actionId: typeof HOME_DISMISS_RECOMMENDATION_ACTION.actionId;
  deviceClass: HomeDeviceClass;
  expectedResultVersion: string;
  expectedDecisionRevision: string;
  idempotencyKey: string;
  instanceId: string;
  mode: HomeExperienceVariant;
  parameters: Readonly<{ recommendationKey: string }>;
  signal?: AbortSignal;
  timeZone: string;
}>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const OFFSET_TIMESTAMP_PATTERN = /T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;
const HOME_MODES = new Set<HomeExperienceVariant>(['CLASSIC', 'FLOW_V1', 'MZ_V1']);
const HOME_DEVICES = new Set<HomeDeviceClass>([
  'DESKTOP_WIDE',
  'DESKTOP_STANDARD',
  'MOBILE_STANDARD',
  'MOBILE_COMPACT',
]);

function invalid(path: string): never {
  throw new HttpError(`Home v2 command response is invalid at ${path}.`, 502);
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(path);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], path: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    invalid(path);
  }
}

function boundedText(value: unknown, path: string, max = 160): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) invalid(path);
  return value;
}

function requireUuid(value: unknown, path: string): string {
  const id = boundedText(value, path, 36);
  if (!UUID_PATTERN.test(id)) invalid(path);
  return id;
}

function requireInput(input: ExecuteHomeV2WidgetActionInput): void {
  if (!HOME_MODES.has(input.mode)) invalid('request.mode');
  if (!HOME_DEVICES.has(input.deviceClass)) invalid('request.deviceClass');
  requireUuid(input.idempotencyKey, 'request.idempotencyKey');
  requireUuid(input.instanceId, 'request.instanceId');
  if (input.actionId !== HOME_DISMISS_RECOMMENDATION_ACTION.actionId) {
    invalid('request.actionId');
  }
  boundedText(input.expectedResultVersion, 'request.expectedResultVersion');
  boundedText(input.expectedDecisionRevision, 'request.expectedDecisionRevision', 200);
  if (
    Object.keys(input.parameters).length !== 1 ||
    !Object.prototype.hasOwnProperty.call(input.parameters, 'recommendationKey')
  ) {
    invalid('request.parameters');
  }
  boundedText(input.parameters.recommendationKey, 'request.parameters.recommendationKey');
  if (!input.timeZone.trim() || input.timeZone.length > 80) invalid('request.timeZone');
}

export function parseHomeV2WidgetCommandReceipt(value: unknown): HomeV2WidgetCommandReceipt {
  const envelope = object(value, 'response');
  const data = object(envelope.data, 'data');
  exactKeys(
    data,
    [
      'receiptId',
      'commandId',
      'commandKey',
      'status',
      'sourceRoute',
      'acceptedAt',
      'resultVersion',
    ],
    'data'
  );
  const commandKey = boundedText(data.commandKey, 'data.commandKey', 120);
  if (commandKey !== HOME_DISMISS_RECOMMENDATION_ACTION.commandKey) invalid('data.commandKey');
  const status = boundedText(data.status, 'data.status', 20);
  if (status !== 'ACCEPTED' && status !== 'COMPLETED') invalid('data.status');
  const sourceRoute = boundedText(data.sourceRoute, 'data.sourceRoute', 1000);
  if (!isSafeHomeInternalRoute(sourceRoute)) invalid('data.sourceRoute');
  const acceptedAt = boundedText(data.acceptedAt, 'data.acceptedAt', 50);
  if (!OFFSET_TIMESTAMP_PATTERN.test(acceptedAt) || !Number.isFinite(Date.parse(acceptedAt))) {
    invalid('data.acceptedAt');
  }
  return {
    acceptedAt,
    commandId: requireUuid(data.commandId, 'data.commandId'),
    commandKey,
    receiptId: requireUuid(data.receiptId, 'data.receiptId'),
    resultVersion: boundedText(data.resultVersion, 'data.resultVersion'),
    sourceRoute,
    status,
  };
}

export async function executeHomeV2WidgetAction(
  input: ExecuteHomeV2WidgetActionInput
): Promise<HomeV2WidgetCommandReceipt> {
  requireInput(input);
  const query = new URLSearchParams({
    deviceClass: input.deviceClass,
    mode: input.mode,
    timeZone: input.timeZone,
  });
  const body = {
    instanceId: input.instanceId,
    actionId: input.actionId,
    expectedResultVersion: input.expectedResultVersion,
    parameters: input.parameters,
  } as const;
  const response = await axiosInstance.post<ApiResponse<unknown>, typeof body>(
    `/api/platform/v2/home/widget-actions:execute?${query}`,
    body,
    {
      headers: {
        'Idempotency-Key': input.idempotencyKey,
        'X-DWP-Expected-Decision-Revision': input.expectedDecisionRevision,
      },
      signal: input.signal,
      timeoutMs: 10_000,
    }
  );
  const receipt = parseHomeV2WidgetCommandReceipt(response.data);
  if (receipt.commandId !== input.idempotencyKey) invalid('data.commandId');
  return receipt;
}
