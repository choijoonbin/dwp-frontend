import { beforeEach, describe, expect, it, vi } from 'vitest';

const transport = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  axiosInstance: transport,
}));

import {
  readHrisOperationalExceptionDetail,
  readHrisOperationalExceptions,
  readHrisOperationsEntry,
  readHrisOperationsReceipt,
} from '../api/hris-operations-api';
import {
  CORRELATION_ID,
  EXCEPTION_ID,
  NOW,
  RECEIPT_ID,
  exceptionDetail,
  exceptionPage,
  operationsEntry,
} from './hris-operations-fixtures.test-support';

const PACKAGE_SCOPE = 'scope-0123456789abcdef0123456789abcdef';

function platformReceipt() {
  return {
    receiptId: RECEIPT_ID,
    commandType: 'REFERENCE_CONFIGURATION_PUBLISH',
    originatingAction: 'HRIS_REFERENCE_CONFIGURATION_PUBLISH',
    subjectPrincipalPublicId: '40000000-0000-4000-8000-000000000001',
    populationScopeDigest: 'a'.repeat(64),
    fieldPolicyRevision: 4,
    purposeCode: 'HRIS_SYSTEM_ADMIN',
    authorizationRevision: 5,
    status: 'SUCCEEDED',
    correlationId: CORRELATION_ID,
    requestDigest: 'b'.repeat(64),
    createdAt: NOW,
  };
}

describe('SYS-002 HRIS operations GET adapters', () => {
  beforeEach(() => transport.get.mockReset());

  it('reads IAQ-059 with HRIS_CONFIGURATION and lets Gateway/Auth derive CONFIG_SCOPE', async () => {
    const signal = new AbortController().signal;
    transport.get.mockResolvedValue({ data: operationsEntry() });
    await expect(
      readHrisOperationsEntry({
        signal,
        contextScopeKey: 'APP_RESOURCE_SET:RS_HCM_CONFIG',
      } as unknown as { signal: AbortSignal })
    ).resolves.toEqual(operationsEntry());
    expect(transport.get).toHaveBeenCalledWith(
      '/api/platform/v1/hris/workbench/settings-operations',
      {
        signal,
        headers: { 'X-Purpose-Code': 'HRIS_CONFIGURATION' },
      }
    );
  });

  it('reads the stable PEP-SYS-037 page with HRIS_OPERATIONS filters', async () => {
    transport.get.mockResolvedValue({ data: exceptionPage() });
    await expect(
      readHrisOperationalExceptions(
        { limit: 50, ownerModule: 'SYS', severity: 'HIGH', state: 'OPEN' },
        { contextScopeKey: PACKAGE_SCOPE }
      )
    ).resolves.toEqual(exceptionPage());
    expect(transport.get).toHaveBeenCalledWith(
      '/api/platform/v1/admin/hris/operations/exceptions?limit=50&ownerModule=SYS&severity=HIGH&state=OPEN',
      {
        contextScopeKey: PACKAGE_SCOPE,
        headers: { 'X-Purpose-Code': 'HRIS_OPERATIONS' },
      }
    );
  });

  it('reads exact PEP-SYS-038 object detail and rejects identity substitution', async () => {
    transport.get.mockResolvedValue({ data: exceptionDetail() });
    await expect(
      readHrisOperationalExceptionDetail(EXCEPTION_ID, { contextScopeKey: PACKAGE_SCOPE })
    ).resolves.toEqual(exceptionDetail());
    expect(transport.get).toHaveBeenCalledWith(
      `/api/platform/v1/admin/hris/operations/exceptions/${EXCEPTION_ID}`,
      {
        contextScopeKey: PACKAGE_SCOPE,
        headers: { 'X-Purpose-Code': 'HRIS_OPERATIONS' },
      }
    );

    transport.get.mockResolvedValue({
      data: {
        ...exceptionDetail(),
        exceptionPublicId: '50000000-0000-4000-8000-000000000001',
        ownerDeepLink: '/hr/settings/reference-data?focus=50000000-0000-4000-8000-000000000001',
      },
    });
    await expect(
      readHrisOperationalExceptionDetail(EXCEPTION_ID, { contextScopeKey: PACKAGE_SCOPE })
    ).rejects.toThrow('does not match the request');
  });

  it('reuses PEP-SYS-040 byte-for-behavior and never adds a recovery transport', async () => {
    const signal = new AbortController().signal;
    transport.get.mockResolvedValue({ data: platformReceipt() });
    await expect(
      readHrisOperationsReceipt(RECEIPT_ID, {
        signal,
        contextScopeKey: PACKAGE_SCOPE,
      } as unknown as { signal: AbortSignal })
    ).resolves.toMatchObject({
      profile: 'PLATFORM',
      receipt: { receiptId: RECEIPT_ID, status: 'SUCCEEDED' },
    });
    expect(transport.get).toHaveBeenCalledTimes(1);
    expect(transport.get).toHaveBeenCalledWith(
      `/api/platform/v1/admin/hris/command-receipts/${RECEIPT_ID}`,
      { signal }
    );
  });

  it('rejects malformed object and cursor input before any protected call', async () => {
    await expect(
      readHrisOperationalExceptionDetail('../recover', { contextScopeKey: PACKAGE_SCOPE })
    ).rejects.toThrow('identity is invalid');
    await expect(
      readHrisOperationalExceptions(
        { cursor: 'short' },
        { contextScopeKey: PACKAGE_SCOPE }
      )
    ).rejects.toThrow('cursor is invalid');
    expect(transport.get).not.toHaveBeenCalled();
  });

  it('rejects raw and malformed exception scopes before list or detail transport', async () => {
    await expect(
      readHrisOperationalExceptions(
        { limit: 50 },
        { contextScopeKey: 'APP_RESOURCE_SET:RS_HCM_CONFIG' }
      )
    ).rejects.toThrow('package scope is invalid');
    await expect(
      readHrisOperationalExceptionDetail(EXCEPTION_ID, {
        contextScopeKey: 'scope-0123456789abcdef0123456789abcdeg',
      })
    ).rejects.toThrow('package scope is invalid');
    expect(transport.get).not.toHaveBeenCalled();
  });
});
