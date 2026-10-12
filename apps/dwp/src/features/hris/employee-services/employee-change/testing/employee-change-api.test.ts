import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  axiosInstance: { get: runtime.get, post: runtime.post },
}));

import {
  EMPLOYEE_CHANGE_API_CONTRACTS,
  applyEmployeeChangeRequest,
  createEmployeeChangeRequest,
  queryEmployeeChangeWorkbench,
  submitEmployeeChangeRequest,
} from '../api/employee-change-api';
import {
  CORRELATION_ID,
  REQUEST_ID,
  employeeChangeProjection,
  employeeChangeReceipt,
} from './employee-change-fixtures.test-support';

import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';

const COMMAND_ID = '10000000-0000-4000-8000-000000000005';

function authority(highRisk = false): ProductSurfaceGovernedMutationAuthority {
  return {
    mode: 'SECURE',
    rolloutState: '111',
    expectedDecisionRevision: 'decision:employee-change:31',
    contextKey: 'context:employee-change:31',
    contextScopeKey: 'scope:employee-change:31',
    ...(highRisk
      ? {
          idempotencyKey: COMMAND_ID,
          objectVersion: 3,
          stepUp: {
            challenge: 'signed-step-up-proof',
            challengeId: 'challenge:31',
            decisionRevision: 'decision:employee-change:31',
            expiresAt: '2099-10-12T08:00:00Z',
          },
        }
      : {}),
  };
}

describe('employee-change owner API', () => {
  beforeEach(() => {
    runtime.get.mockReset();
    runtime.post.mockReset();
  });

  it('pins the four browser-facing official bindings without an alias', () => {
    expect(
      EMPLOYEE_CHANGE_API_CONTRACTS.map(({ bindingId, method, path }) => ({
        bindingId,
        method,
        path,
      }))
    ).toEqual([
      {
        bindingId: 'IAQ-009',
        method: 'GET',
        path: '/api/people/v1/hris/workbench/operations/employee/change/requests',
      },
      {
        bindingId: 'PEP-HRM-003',
        method: 'POST',
        path: '/api/people/v1/hris/employee-change-requests',
      },
      {
        bindingId: 'PEP-HRM-004',
        method: 'POST',
        path: '/api/people/v1/hris/employee-change-requests/{requestPublicId}/submit',
      },
      {
        bindingId: 'PEP-HRM-005',
        method: 'POST',
        path: '/api/people/v1/hris/employee-change-requests/{requestPublicId}/apply',
      },
    ]);
  });

  it('serializes the IAQ-009 deep-object query and keeps tenant context trusted', async () => {
    const signal = new AbortController().signal;
    runtime.get.mockResolvedValue({ data: employeeChangeProjection() });

    await queryEmployeeChangeWorkbench(
      {
        limit: 25,
        filter: {
          changeRequestSummary: { minimumItemCount: 1, maximumItemCount: 5 },
          approvalStatus: { codes: ['DRAFT', 'APPROVED'], minimumRevision: 2 },
          employment: { from: '2026-10-01', to: '2026-10-31' },
          effectiveOn: '2026-10-12',
        },
        sort: ['approvalStatus:ASC', 'itemPublicId:ASC'],
        locale: 'ko-KR',
        timeZone: 'Asia/Seoul',
        correlationId: CORRELATION_ID,
        asOf: '2026-10-12T08:00:00Z',
        cursor: 'a'.repeat(32),
      },
      'scope:employee-change:31',
      signal
    );

    const [url, config] = runtime.get.mock.calls[0]!;
    const requestUrl = new URL(url, 'https://dwp.invalid');
    expect(requestUrl.pathname).toBe(
      '/api/people/v1/hris/workbench/operations/employee/change/requests'
    );
    expect(requestUrl.searchParams.getAll('sort')).toEqual([
      'approvalStatus:ASC',
      'itemPublicId:ASC',
    ]);
    expect(requestUrl.searchParams.getAll('filter[approvalStatus][codes]')).toEqual([
      'DRAFT',
      'APPROVED',
    ]);
    expect(requestUrl.searchParams.get('filter[employment][from]')).toBe('2026-10-01');
    expect(requestUrl.searchParams.get('tenantId')).toBeNull();
    expect(config).toEqual({ contextScopeKey: 'scope:employee-change:31', signal });
  });

  it('serializes the required deep-object filter even when it is empty', async () => {
    runtime.get.mockResolvedValue({ data: employeeChangeProjection() });

    await queryEmployeeChangeWorkbench({
      limit: 25,
      filter: {},
      sort: ['itemPublicId:ASC'],
      locale: 'ko-KR',
      timeZone: 'Asia/Seoul',
      correlationId: CORRELATION_ID,
      asOf: null,
      cursor: null,
    });

    const requestUrl = new URL(runtime.get.mock.calls[0]![0], 'https://dwp.invalid');
    expect(requestUrl.searchParams.get('filter')).toBe('{}');
    expect([...requestUrl.searchParams.keys()].filter((key) => key.startsWith('filter['))).toEqual(
      []
    );
  });

  it('binds create and submit to idempotency, version, correlation and route authority', async () => {
    runtime.post
      .mockResolvedValueOnce({
        data: {
          ...employeeChangeReceipt(),
          commandType: 'EMPLOYEE_CHANGE_CREATE',
          originatingAction: 'CREATE_EMPLOYEE_CHANGE_REQUEST',
        },
      })
      .mockResolvedValueOnce({ data: employeeChangeReceipt() });
    const command = {
      requestPublicId: REQUEST_ID,
      expectedRequestVersion: 3,
      idempotencyKey: COMMAND_ID,
      correlationId: CORRELATION_ID,
    } as const;

    await createEmployeeChangeRequest(
      {
        expectedTargetVersion: 0,
        idempotencyKey: COMMAND_ID,
        correlationId: CORRELATION_ID,
        request: {
          targetPersonPublicId: '10000000-0000-4000-8000-000000000006',
          targetAggregateType: 'PERSON',
          targetAggregatePublicId: '10000000-0000-4000-8000-000000000007',
          changeType: 'PROFILE_UPDATE',
          effectiveDate: '2026-10-12',
          patchSchemaKey: 'employee-change.person.v1',
          patchSchemaVersion: 1,
          patch: [{ op: 'replace', path: '/displayName', value: 'Updated name' }],
          evidence: [],
        },
      },
      authority()
    );
    await submitEmployeeChangeRequest(command, authority());

    expect(runtime.post.mock.calls[0]![0]).toBe('/api/people/v1/hris/employee-change-requests');
    expect(runtime.post.mock.calls[0]![2]).toMatchObject({
      contextScopeKey: 'scope:employee-change:31',
      csrfReplay: 'NEVER',
      headers: {
        'Idempotency-Key': COMMAND_ID,
        'If-Match': '"v:0"',
        'X-Correlation-ID': CORRELATION_ID,
        'X-DWP-Expected-Decision-Revision': 'decision:employee-change:31',
      },
    });
    expect(runtime.post.mock.calls[1]![0]).toBe(
      `/api/people/v1/hris/employee-change-requests/${REQUEST_ID}/submit`
    );
    expect(runtime.post.mock.calls[1]![1]).toEqual({});
    expect(runtime.post.mock.calls[1]![2].headers['If-Match']).toBe('"v:3"');

    await expect(
      submitEmployeeChangeRequest({ ...command, expectedRequestVersion: 0 }, authority())
    ).rejects.toThrow('Employee-change optimistic version is invalid.');
  });

  it('requires apply authority to carry the exact step-up key and object version', async () => {
    runtime.post.mockResolvedValue({
      data: {
        ...employeeChangeReceipt(),
        commandType: 'EMPLOYEE_CHANGE_APPLY',
        originatingAction: 'APPLY_EMPLOYEE_CHANGE_REQUEST',
      },
    });
    const command = {
      requestPublicId: REQUEST_ID,
      expectedRequestVersion: 3,
      idempotencyKey: COMMAND_ID,
      correlationId: CORRELATION_ID,
      purposeCode: 'HR_LIFECYCLE',
    } as const;

    await applyEmployeeChangeRequest(command, authority(true));

    const [url, body, config] = runtime.post.mock.calls[0]!;
    expect(url).toBe(`/api/people/v1/hris/employee-change-requests/${REQUEST_ID}/apply`);
    expect(body).toEqual({});
    expect(config.headers).toMatchObject({
      'Idempotency-Key': COMMAND_ID,
      'If-Match': '"v:3"',
      'X-Correlation-ID': CORRELATION_ID,
      'X-Purpose-Code': 'HR_LIFECYCLE',
      'X-DWP-Step-Up-Challenge': 'signed-step-up-proof',
      'X-DWP-Expected-Object-Version': '3',
    });

    await expect(
      applyEmployeeChangeRequest(command, {
        ...authority(true),
        objectVersion: 4,
      } as ProductSurfaceGovernedMutationAuthority)
    ).rejects.toThrow('Employee-change command authority does not match the command.');
  });

  it('rejects a structurally valid receipt that is not bound to the submitted command', async () => {
    runtime.post.mockResolvedValue({
      data: { ...employeeChangeReceipt(), correlationId: '10000000-0000-4000-8000-000000000099' },
    });

    await expect(
      submitEmployeeChangeRequest(
        {
          requestPublicId: REQUEST_ID,
          expectedRequestVersion: 3,
          idempotencyKey: COMMAND_ID,
          correlationId: CORRELATION_ID,
        },
        authority()
      )
    ).rejects.toThrow('Employee-change receipt does not match the submitted command.');
  });
});
