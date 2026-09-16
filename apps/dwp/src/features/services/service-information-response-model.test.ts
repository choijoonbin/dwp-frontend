import { describe, expect, it } from 'vitest';
import {
  prepareServiceInformationResponse,
  serviceResponseCanDispatch,
  serviceResponseFieldValid,
  serviceResponseReceiptMatches,
} from './service-information-response-model';
import type { ServiceRequestDetail } from '@dwp-frontend/shared-utils/api/service-center-api';

const detail = {
  request: { requestId: 'service-1', status: 'AWAITING_REQUESTER', version: 3 },
  requestSchema: { fields: [{ key: 'purpose', type: 'TEXT', required: true }] },
} as ServiceRequestDetail;
const message = 'Use the secure VPN for customer support.';
describe('Services owner information response', () => {
  it('freezes the reviewed values and version', () => {
    const values = { purpose: 'Customer support' };
    const command = prepareServiceInformationResponse(detail, ` ${message} `, values, 'command-1');
    values.purpose = 'Changed after preview';
    expect(command).toEqual({
      values: { purpose: 'Customer support' },
      message,
      version: 3,
      idempotencyKey: 'command-1',
    });
  });
  it.each(['short', 'x'.repeat(2001)])('rejects an invalid message length', (value) => {
    expect(
      prepareServiceInformationResponse(detail, value, { purpose: 'Support' }, 'key')
    ).toBeNull();
  });
  it('rejects missing or blank required fields', () => {
    expect(prepareServiceInformationResponse(detail, message, { purpose: '  ' }, 'key')).toBeNull();
  });
  it('blocks fresh submission after a version or status change', () => {
    const command = prepareServiceInformationResponse(
      detail,
      message,
      { purpose: 'Support' },
      'key'
    )!;
    expect(
      serviceResponseCanDispatch(
        { ...detail, request: { ...detail.request, version: 4 } },
        'service-1',
        command,
        false
      )
    ).toBe(false);
    expect(
      serviceResponseCanDispatch(
        { ...detail, request: { ...detail.request, status: 'IN_PROGRESS' } },
        'service-1',
        command,
        false
      )
    ).toBe(false);
  });
  it('permits only a frozen idempotent replay to recover a changed receipt', () => {
    const command = prepareServiceInformationResponse(
      detail,
      message,
      { purpose: 'Support' },
      'key'
    )!;
    expect(
      serviceResponseCanDispatch(
        { ...detail, request: { ...detail.request, version: 4, status: 'IN_PROGRESS' } },
        'service-1',
        command,
        true
      )
    ).toBe(true);
    expect(serviceResponseCanDispatch(detail, 'other-request', command, true)).toBe(false);
  });
  it('accepts only the exact requester-response receipt', () => {
    const command = prepareServiceInformationResponse(
      detail,
      message,
      { purpose: 'Support' },
      'command-1'
    )!;
    const receipt = {
      ...detail,
      request: { ...detail.request, status: 'IN_PROGRESS' as const, version: 4 },
      values: { purpose: 'Support' },
    };
    expect(serviceResponseReceiptMatches(receipt, 'service-1', command)).toBe(true);
    expect(
      serviceResponseReceiptMatches(
        { ...receipt, request: { ...receipt.request, status: 'AWAITING_REQUESTER' } },
        'service-1',
        command
      )
    ).toBe(false);
    expect(
      serviceResponseReceiptMatches(
        { ...receipt, values: { purpose: 'Other' } },
        'service-1',
        command
      )
    ).toBe(false);
  });
  it('validates required boolean, finite numeric, and schema options', () => {
    const field = { key: 'field', labelKo: '항목', labelEn: 'Field', required: true };
    expect(serviceResponseFieldValid({ ...field, type: 'CHECKBOX' }, false)).toBe(false);
    expect(serviceResponseFieldValid({ ...field, type: 'NUMBER' }, Number.NaN)).toBe(false);
    expect(
      serviceResponseFieldValid({ ...field, type: 'SELECT', options: ['ALLOWED'] }, 'OTHER')
    ).toBe(false);
    expect(serviceResponseFieldValid({ ...field, type: 'NUMBER' }, 0)).toBe(true);
  });
});
