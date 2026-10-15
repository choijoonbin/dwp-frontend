import { axiosInstance, productSurfaceGovernedMutationConfig } from '@dwp-frontend/shared-utils';
import { productSurfaceReadScopeConfig } from '@dwp-frontend/shared-utils/api/product-surface-read-scope';

import {
  HRIS_WORK_EXPLORER_BASE_PATH,
  HRIS_WORK_EXPLORER_RECEIPT_PATH,
  parseExplorerReceipt,
  parseHrisReceiptProjection,
  parseHrisExplorerResponse,
} from './work-explorer-contract';

import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';
import type { components, operations } from '@dwp-frontend/api-contracts';
import type {
  ExplorerReceipt,
  HrisExplorerResponse,
  HrisReceiptProjection,
} from './work-explorer-contract';

export const WORK_EXPLORER_PREFERENCES_ACTION =
  'route.hcm.utility.explorer-preferences-update.action' as const;
export const WORK_EXPLORER_RECENT_ACTION =
  'route.hcm.utility.explorer-recent-create.action' as const;

type GeneratedExplorerQuery = Omit<
  operations['platform_getHrisWorkExplorer']['parameters']['query'],
  'contextScopeKey'
>;
type GeneratedExplorerResponse = components['schemas']['platform_HrisExplorerResponseV2'];
type GeneratedExplorerReceipt = components['schemas']['platform_HrisExplorerReceiptV1'];
type GeneratedPreferenceCommand = components['schemas']['platform_ExplorerPreferenceCommand'];
type GeneratedRecentCommand = components['schemas']['platform_ExplorerRecentCommand'];
type GeneratedReceiptResponse =
  operations['platform_getHrisCommandReceipt']['responses'][200]['content']['application/json'];

export type ExplorerQuery = Readonly<GeneratedExplorerQuery>;

export type ExplorerReadContext = Readonly<{
  contextScopeKey?: string;
  signal?: AbortSignal;
}>;

export type ExplorerCommandContext = Readonly<{
  authority: ProductSurfaceGovernedMutationAuthority;
  idempotencyKey: string;
}>;

function queryString(query: ExplorerQuery): string {
  const params = new URLSearchParams({
    asOf: query.asOf,
    freshness: query.freshness,
  });
  if (query.filter) params.set('filter', query.filter);
  if (query.cursor) params.set('cursor', query.cursor);
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  return `?${params.toString()}`;
}

function commandConfig(context: ExplorerCommandContext, ifMatch?: number) {
  if (
    context.idempotencyKey.length < 16 ||
    context.idempotencyKey.length > 128 ||
    (ifMatch !== undefined && (!Number.isSafeInteger(ifMatch) || ifMatch < 1))
  ) {
    throw new Error('HRIS Work Explorer command authority is invalid.');
  }
  const governed = productSurfaceGovernedMutationConfig(context.authority);
  return {
    ...governed,
    headers: {
      ...governed.headers,
      'Idempotency-Key': context.idempotencyKey,
      ...(ifMatch === undefined ? {} : { 'If-Match': `"pref-${ifMatch}"` }),
    },
  };
}

function commandReceipt(
  value: unknown,
  expectedCommand: ExplorerReceipt['commandType']
): ExplorerReceipt {
  const receipt = parseExplorerReceipt(value);
  if (receipt.commandType !== expectedCommand || receipt.originatingAction !== expectedCommand) {
    throw new Error('Mismatched HRIS Work Explorer command receipt.');
  }
  return receipt;
}

export async function queryWorkExplorer(
  query: ExplorerQuery,
  context: ExplorerReadContext = {}
): Promise<HrisExplorerResponse> {
  if (
    !Number.isFinite(Date.parse(query.asOf)) ||
    (query.limit !== undefined &&
      (!Number.isSafeInteger(query.limit) || query.limit < 1 || query.limit > 100)) ||
    (query.filter !== undefined && (!query.filter.trim() || query.filter.length > 200))
  ) {
    throw new Error('HRIS Work Explorer query is invalid.');
  }
  const response = await axiosInstance.get<GeneratedExplorerResponse>(
    `${HRIS_WORK_EXPLORER_BASE_PATH}${queryString(query)}`,
    productSurfaceReadScopeConfig(context.contextScopeKey, context.signal)
  );
  return parseHrisExplorerResponse(response.data);
}

export async function replaceWorkExplorerPreferences(
  orderedFavoriteRouteKeys: readonly string[],
  favoritePreferenceRevision: number,
  context: ExplorerCommandContext
): Promise<ExplorerReceipt> {
  if (
    orderedFavoriteRouteKeys.length > 20 ||
    orderedFavoriteRouteKeys.length !== new Set(orderedFavoriteRouteKeys).size
  ) {
    throw new Error('HRIS Work Explorer favorites are invalid.');
  }
  const response = await axiosInstance.put<GeneratedExplorerReceipt, GeneratedPreferenceCommand>(
    HRIS_WORK_EXPLORER_BASE_PATH + '/preferences',
    { orderedFavoriteRouteKeys: [...orderedFavoriteRouteKeys] },
    commandConfig(context, favoritePreferenceRevision)
  );
  return commandReceipt(response.data, 'EXPLORER_PREFERENCES_REPLACE');
}

export async function recordWorkExplorerRecent(
  routeKey: string,
  context: ExplorerCommandContext
): Promise<ExplorerReceipt> {
  const response = await axiosInstance.post<GeneratedExplorerReceipt, GeneratedRecentCommand>(
    HRIS_WORK_EXPLORER_BASE_PATH + '/recents',
    { routeKey },
    commandConfig(context)
  );
  return commandReceipt(response.data, 'EXPLORER_RECENT_RECORD');
}

export async function queryWorkExplorerReceipt(
  receiptId: string,
  context: ExplorerReadContext = {}
): Promise<ExplorerReceipt> {
  const projection = await queryWorkExplorerActivityReceipt(receiptId, context);
  if (projection.profile !== 'EXPLORER') {
    throw new Error('Mismatched HRIS Work Explorer receipt profile.');
  }
  return projection.receipt;
}

export async function queryWorkExplorerActivityReceipt(
  receiptId: string,
  context: ExplorerReadContext = {}
): Promise<HrisReceiptProjection> {
  const response = await axiosInstance.get<GeneratedReceiptResponse>(
    `${HRIS_WORK_EXPLORER_RECEIPT_PATH}/${encodeURIComponent(receiptId)}`,
    productSurfaceReadScopeConfig(context.contextScopeKey, context.signal)
  );
  const projection = parseHrisReceiptProjection(response.data);
  if (projection.receipt.receiptId !== receiptId) {
    throw new Error('Mismatched HRIS Work Explorer receipt identity.');
  }
  return projection;
}

export const workExplorerDataSource = {
  query: queryWorkExplorer,
  replacePreferences: replaceWorkExplorerPreferences,
  recordRecent: recordWorkExplorerRecent,
  receipt: queryWorkExplorerReceipt,
  activityReceipt: queryWorkExplorerActivityReceipt,
} as const;
