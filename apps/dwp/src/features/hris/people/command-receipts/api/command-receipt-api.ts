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
const EMPLOYEE_CHANGE_RESULT_LOCATION =
  /^\/hr\/operations\/people\/employee-change-requests\?requestPublicId=([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/u;
const EMPLOYEE_CHANGE_RECEIPT_BINDINGS = Object.freeze({
  EMPLOYEE_CHANGE_CREATE: 'CREATE_EMPLOYEE_CHANGE_REQUEST',
  EMPLOYEE_CHANGE_SUBMIT: 'SUBMIT_EMPLOYEE_CHANGE_REQUEST',
  EMPLOYEE_CHANGE_APPLY: 'APPLY_EMPLOYEE_CHANGE_REQUEST',
});

declare const authorizedEmployeeChangeResultLocation: unique symbol;
export type AuthorizedEmployeeChangeResultLocation = string & {
  readonly [authorizedEmployeeChangeResultLocation]: true;
};

export type HrisCommandReceiptReadResult = Readonly<{
  receipt: HrisCommandReceipt;
  resultLocation: AuthorizedEmployeeChangeResultLocation | null;
}>;

export type HrisCommandReceiptReader = (
  receiptId: string,
  contextScopeKey?: string,
  signal?: AbortSignal
) => Promise<HrisCommandReceiptReadResult>;

export function parseAuthorizedEmployeeChangeResultLocation(
  value: string | null,
  receipt: HrisCommandReceipt
): AuthorizedEmployeeChangeResultLocation | null {
  if (value === null) return null;
  const expectedAction =
    EMPLOYEE_CHANGE_RECEIPT_BINDINGS[
      receipt.commandType as keyof typeof EMPLOYEE_CHANGE_RECEIPT_BINDINGS
    ];
  if (
    receipt.status !== 'SUCCEEDED' ||
    expectedAction !== receipt.originatingAction ||
    !EMPLOYEE_CHANGE_RESULT_LOCATION.test(value)
  ) {
    throw new Error('HRIS command receipt result Location is invalid.');
  }
  return value as AuthorizedEmployeeChangeResultLocation;
}

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
  return Object.freeze({
    receipt,
    resultLocation: parseAuthorizedEmployeeChangeResultLocation(
      response.headers?.get('Location') ?? null,
      receipt
    ),
  });
};
