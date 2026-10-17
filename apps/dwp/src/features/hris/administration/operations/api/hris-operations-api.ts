import { axiosInstance } from '@dwp-frontend/shared-utils';
import { productSurfaceReadScopeConfig } from '@dwp-frontend/shared-utils/api/product-surface-read-scope';

import { queryWorkExplorerActivityReceipt } from '../../../explorer/work-explorer-api';
import {
  HRIS_OPERATION_EXCEPTIONS_PATH,
  HRIS_OPERATIONS_ENTRY_PATH,
  parseHrisOperationalExceptionDetail,
  parseHrisOperationalExceptionPage,
  parseHrisOperationsEntry,
} from '../model/hris-operations-contract';

import type { HrisReceiptProjection } from '../../../explorer/work-explorer-contract';
import type {
  HrisOperationalExceptionDetail,
  HrisOperationalExceptionPage,
  HrisOperationModule,
  HrisOperationPublicState,
  HrisOperationSeverity,
  HrisOperationsEntry,
} from '../model/hris-operations-contract';

export type HrisOperationsEntryReadContext = Readonly<{
  signal?: AbortSignal;
}>;

export type HrisOperationsScopedReadContext = Readonly<{
  contextScopeKey: string;
  signal?: AbortSignal;
}>;

export type HrisOperationalExceptionQuery = Readonly<{
  limit?: number;
  cursor?: string;
  ownerModule?: HrisOperationModule;
  severity?: HrisOperationSeverity;
  state?: HrisOperationPublicState;
}>;

export type HrisOperationsDataSource = Readonly<{
  entry: (context?: HrisOperationsEntryReadContext) => Promise<HrisOperationsEntry>;
  exceptions: (
    query: HrisOperationalExceptionQuery,
    context: HrisOperationsScopedReadContext
  ) => Promise<HrisOperationalExceptionPage>;
  detail: (
    exceptionPublicId: string,
    context: HrisOperationsScopedReadContext
  ) => Promise<HrisOperationalExceptionDetail>;
  receipt: (
    receiptId: string,
    context?: HrisOperationsEntryReadContext
  ) => Promise<HrisReceiptProjection>;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const CURSOR = /^[A-Za-z0-9_-]{16,4096}$/u;
const EXCEPTION_CONTEXT_SCOPE = /^scope-[a-f0-9]{32}$/u;

function readConfig(
  purpose: 'HRIS_CONFIGURATION' | 'HRIS_OPERATIONS',
  context: HrisOperationsScopedReadContext
) {
  if (!EXCEPTION_CONTEXT_SCOPE.test(context.contextScopeKey)) {
    throw new Error('HRIS operational exception package scope is invalid.');
  }
  return {
    ...productSurfaceReadScopeConfig(context.contextScopeKey, context.signal),
    headers: { 'X-Purpose-Code': purpose },
  };
}

export async function readHrisOperationsEntry(
  context: HrisOperationsEntryReadContext = {}
): Promise<HrisOperationsEntry> {
  const response = await axiosInstance.get<unknown>(
    HRIS_OPERATIONS_ENTRY_PATH,
    {
      ...productSurfaceReadScopeConfig(undefined, context.signal),
      headers: { 'X-Purpose-Code': 'HRIS_CONFIGURATION' },
    }
  );
  return parseHrisOperationsEntry(response.data);
}

export async function readHrisOperationalExceptions(
  query: HrisOperationalExceptionQuery,
  context: HrisOperationsScopedReadContext
): Promise<HrisOperationalExceptionPage> {
  const limit = query.limit ?? 50;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('HRIS operational exception query limit is invalid.');
  }
  if (query.cursor !== undefined && !CURSOR.test(query.cursor)) {
    throw new Error('HRIS operational exception cursor is invalid.');
  }
  const search = new URLSearchParams({ limit: String(limit) });
  if (query.cursor) search.set('cursor', query.cursor);
  if (query.ownerModule) search.set('ownerModule', query.ownerModule);
  if (query.severity) search.set('severity', query.severity);
  if (query.state) search.set('state', query.state);
  const response = await axiosInstance.get<unknown>(
    `${HRIS_OPERATION_EXCEPTIONS_PATH}?${search.toString()}`,
    readConfig('HRIS_OPERATIONS', context)
  );
  return parseHrisOperationalExceptionPage(response.data);
}

export async function readHrisOperationalExceptionDetail(
  exceptionPublicId: string,
  context: HrisOperationsScopedReadContext
): Promise<HrisOperationalExceptionDetail> {
  if (!UUID.test(exceptionPublicId)) {
    throw new Error('HRIS operational exception identity is invalid.');
  }
  const response = await axiosInstance.get<unknown>(
    `${HRIS_OPERATION_EXCEPTIONS_PATH}/${encodeURIComponent(exceptionPublicId)}`,
    readConfig('HRIS_OPERATIONS', context)
  );
  const detail = parseHrisOperationalExceptionDetail(response.data);
  if (detail.exceptionPublicId !== exceptionPublicId) {
    throw new Error('HRIS operational exception detail does not match the request.');
  }
  return detail;
}

export async function readHrisOperationsReceipt(
  receiptId: string,
  context: HrisOperationsEntryReadContext = {}
): Promise<HrisReceiptProjection> {
  return queryWorkExplorerActivityReceipt(receiptId, {
    ...(context.signal === undefined ? {} : { signal: context.signal }),
  });
}

export const hrisOperationsDataSource: HrisOperationsDataSource = Object.freeze({
  entry: readHrisOperationsEntry,
  exceptions: readHrisOperationalExceptions,
  detail: readHrisOperationalExceptionDetail,
  receipt: readHrisOperationsReceipt,
});
