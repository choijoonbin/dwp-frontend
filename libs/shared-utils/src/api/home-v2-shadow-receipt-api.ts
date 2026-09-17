import { sessionNeutralHttp } from '../axios-instance';
import { HttpError } from '../http-error';
import { HOME_DEVICE_CLASSES } from './home-personalization-api';
import { HOME_V2_ROLLOUT_RINGS } from './home-v2-runtime-contract';

import type { ApiResponse } from '../types';
import type { HomeDeviceClass } from './home-personalization-api';
import type { HomeExperienceVariant } from './home-experience-api';
import type { HomeV2RolloutRing } from './home-v2-runtime-contract';

export const HOME_V2_SHADOW_OUTCOMES = [
  'MATCH',
  'EXPECTED_TRANSIENT',
  'MISMATCH',
  'UNAVAILABLE',
] as const;
export type HomeV2ShadowOutcome = (typeof HOME_V2_SHADOW_OUTCOMES)[number];

export const HOME_V2_SHADOW_REASONS = [
  'MATCH',
  'EXPECTED_TRANSIENT',
  'STRUCTURE',
  'AUTHORITY',
  'MODE',
  'LAYOUT',
  'APP_DOCK',
  'WIDGET_STATE',
  'ROUTE_ACTION',
  'FRESHNESS',
  'UNAVAILABLE',
] as const;
export type HomeV2ShadowReason = (typeof HOME_V2_SHADOW_REASONS)[number];

export type HomeV2ShadowReceiptRequest = Readonly<{
  deviceClass: HomeDeviceClass;
  homeMode: HomeExperienceVariant;
  mismatchCount: number;
  outcome: HomeV2ShadowOutcome;
  reasons: readonly HomeV2ShadowReason[];
  rolloutRevision: string;
  rolloutRing: HomeV2RolloutRing;
  runtimeState: 'SHADOW_COMPARE';
  schemaVersion: 1;
}>;

export type HomeV2ShadowReceipt = Readonly<{
  accepted: true;
  receiptVersion: 'home-shadow-v1';
}>;

const OUTCOMES = new Set<string>(HOME_V2_SHADOW_OUTCOMES);
const REASONS = new Set<string>(HOME_V2_SHADOW_REASONS);
const DEVICES = new Set<string>(HOME_DEVICE_CLASSES);
const RINGS = new Set<string>(HOME_V2_ROLLOUT_RINGS);
const REVISION_PATTERN = /^[A-Za-z0-9._:-]{1,160}$/u;
const REQUEST_KEYS = [
  'schemaVersion',
  'outcome',
  'reasons',
  'mismatchCount',
  'homeMode',
  'deviceClass',
  'runtimeState',
  'rolloutRing',
  'rolloutRevision',
] as const;

function invalid(path: string): never {
  throw new HttpError(`Home shadow receipt is invalid at ${path}.`, 502);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], path: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    invalid(path);
  }
}

export function assertHomeV2ShadowReceiptRequest(
  input: HomeV2ShadowReceiptRequest
): HomeV2ShadowReceiptRequest {
  exactKeys(input as unknown as Record<string, unknown>, REQUEST_KEYS, 'request');
  if (
    input.schemaVersion !== 1 ||
    !OUTCOMES.has(input.outcome) ||
    !Number.isSafeInteger(input.mismatchCount) ||
    input.mismatchCount < 0 ||
    input.mismatchCount > 100 ||
    !Array.isArray(input.reasons) ||
    input.reasons.length < 1 ||
    input.reasons.length > 10 ||
    new Set(input.reasons).size !== input.reasons.length ||
    input.reasons.some((reason) => !REASONS.has(reason)) ||
    !['CLASSIC', 'FLOW_V1', 'MZ_V1'].includes(input.homeMode) ||
    !DEVICES.has(input.deviceClass) ||
    input.runtimeState !== 'SHADOW_COMPARE' ||
    !RINGS.has(input.rolloutRing) ||
    !REVISION_PATTERN.test(input.rolloutRevision)
  ) {
    invalid('request');
  }
  if (
    (input.outcome === 'MATCH' &&
      (input.mismatchCount !== 0 || input.reasons.length !== 1 || input.reasons[0] !== 'MATCH')) ||
    (input.outcome === 'EXPECTED_TRANSIENT' &&
      (input.mismatchCount === 0 ||
        input.reasons.length !== 2 ||
        !input.reasons.includes('EXPECTED_TRANSIENT') ||
        !input.reasons.includes('FRESHNESS'))) ||
    (input.outcome === 'MISMATCH' &&
      (input.mismatchCount === 0 ||
        input.reasons.some((reason) =>
          ['MATCH', 'EXPECTED_TRANSIENT', 'UNAVAILABLE'].includes(reason)
        ) ||
        input.reasons.every((reason) => reason === 'FRESHNESS'))) ||
    (input.outcome === 'UNAVAILABLE' &&
      (input.mismatchCount === 0 ||
        input.reasons.length !== 1 ||
        input.reasons[0] !== 'UNAVAILABLE'))
  ) {
    invalid('request.outcome');
  }
  return input;
}

function parseReceipt(value: unknown): HomeV2ShadowReceipt {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('response');
  const data = (value as Record<string, unknown>).data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) invalid('response.data');
  exactKeys(data as Record<string, unknown>, ['accepted', 'receiptVersion'], 'response.data');
  if (
    (data as Record<string, unknown>).accepted !== true ||
    (data as Record<string, unknown>).receiptVersion !== 'home-shadow-v1'
  ) {
    invalid('response.data');
  }
  return data as HomeV2ShadowReceipt;
}

export async function sendHomeV2ShadowReceipt(
  input: HomeV2ShadowReceiptRequest,
  expectedDecisionRevision: string,
  signal?: AbortSignal
): Promise<HomeV2ShadowReceipt> {
  const body = assertHomeV2ShadowReceiptRequest(input);
  const revision = expectedDecisionRevision.trim();
  if (
    !revision ||
    revision.length > 200 ||
    revision.includes(',') ||
    revision.includes('\r') ||
    revision.includes('\n')
  ) {
    invalid('request.expectedDecisionRevision');
  }
  const response = await sessionNeutralHttp.post<ApiResponse<unknown>, typeof body>(
    '/api/platform/v2/home/shadow-receipts',
    body,
    {
      headers: { 'X-DWP-Expected-Decision-Revision': revision },
      keepalive: true,
      signal,
      timeoutMs: 2_000,
    }
  );
  return parseReceipt(response.data);
}
