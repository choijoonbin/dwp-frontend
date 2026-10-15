import { axiosInstance } from '@dwp-frontend/shared-utils';
import { productSurfaceReadScopeConfig } from '@dwp-frontend/shared-utils/api/product-surface-read-scope';

import { parseHrisCommandReceipt } from '../model/command-receipt';

import type { HrisCommandReceipt } from '../model/command-receipt';

export const HRIS_COMMAND_RECEIPT_PATH = '/api/people/v1/hris/command-receipts' as const;
export const HRIS_COMMAND_RECEIPT_API_CONTRACT = Object.freeze({
  bindingId: 'PEP-HRM-014',
  method: 'GET',
  path: `${HRIS_COMMAND_RECEIPT_PATH}/{receiptId}`,
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type HrisCommandReceiptReader = (
  receiptId: string,
  contextScopeKey?: string,
  signal?: AbortSignal
) => Promise<HrisCommandReceipt>;

export const readHrisCommandReceipt: HrisCommandReceiptReader = async (
  receiptId,
  contextScopeKey,
  signal
) => {
  if (!UUID.test(receiptId)) throw new Error('HRIS command receipt identity is invalid.');
  const response = await axiosInstance.get<unknown>(
    `${HRIS_COMMAND_RECEIPT_PATH}/${encodeURIComponent(receiptId)}`,
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  const receipt = parseHrisCommandReceipt(response.data);
  if (receipt.receiptId !== receiptId) {
    throw new Error('HRIS command receipt does not match the request.');
  }
  return receipt;
};
