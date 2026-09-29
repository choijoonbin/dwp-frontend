import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpTransportError } from '@dwp-frontend/shared-utils';

const runtime = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  axiosInstance: { get: runtime.get },
}));

import {
  getHrisSystemSnapshot,
  reconcileOwnerSelfServiceRequest,
  submitOwnerSelfServiceRequest,
} from '../api/hris-system-api';

import type { AppAdminPresetAssignment } from '@dwp-frontend/shared-utils';
import type { OwnerCommandDependencies, OwnerSelfServiceRequest } from '../api/hris-system-api';

const request: OwnerSelfServiceRequest = {
  presetCode: 'HCM_CONFIGURATION_OWNER',
  resourceSetId: 'resource-set-1',
  validTo: '2026-12-31T00:00:00Z',
  reviewDueAt: '2026-11-30T00:00:00Z',
  justification: 'Temporary owner coverage for the approved configuration window.',
};

function assignment(): AppAdminPresetAssignment {
  return {
    presetAssignmentId: 'assignment-1',
    presetCode: request.presetCode,
    productKey: 'HCM',
    presetName: 'HCM configuration owner',
    principalType: 'USER',
    principalRef: '11',
    principalName: 'Current user',
    resourceSetId: request.resourceSetId,
    resourceSetKey: 'HCM_SCOPE',
    resourceSetName: 'HCM scope',
    responsibilityAssignmentId: 'responsibility-1',
    assignmentSource: 'PRESET',
    requestChannel: 'SELF_SERVICE',
    lifecycleState: 'PENDING_APPROVAL',
    validTo: request.validTo,
    reviewDueAt: request.reviewDueAt,
    justification: request.justification,
    version: 0,
    catalogVersion: 1,
    createdAt: '2026-09-17T03:00:00Z',
    updatedAt: '2026-09-17T03:00:00Z',
    duties: [],
  };
}

describe('owner self-service receipt transport', () => {
  beforeEach(() => {
    runtime.get.mockReset();
  });

  it('loads both projections through the same opaque product scope', async () => {
    const signal = new AbortController().signal;
    runtime.get
      .mockResolvedValueOnce({ data: { data: { tenantId: 7 } } })
      .mockResolvedValueOnce({ data: { data: { tenantId: 7 } } });

    await getHrisSystemSnapshot('scope:hcm/settings-west', signal);

    expect(runtime.get).toHaveBeenNthCalledWith(1, '/api/auth/hris/product-access/snapshot', {
      contextScopeKey: 'scope:hcm/settings-west',
      signal,
    });
    expect(runtime.get).toHaveBeenNthCalledWith(
      2,
      '/api/platform/v1/hris/configuration/projection',
      { contextScopeKey: 'scope:hcm/settings-west', signal }
    );
  });

  it('returns RESULT_UNKNOWN after a timeout and never retries the mutation automatically', async () => {
    const dependencies: OwnerCommandDependencies = {
      submit: vi.fn().mockRejectedValue(new HttpTransportError('TIMEOUT')),
      list: vi.fn(),
    };

    const receipt = await submitOwnerSelfServiceRequest(
      request,
      'owner-request-0001',
      'correlation-1',
      dependencies
    );

    expect(receipt).toMatchObject({
      idempotencyKey: 'owner-request-0001',
      status: 'RESULT_UNKNOWN',
      request: {
        presetCode: request.presetCode,
        resourceSetId: request.resourceSetId,
      },
    });
    expect(dependencies.submit).toHaveBeenCalledTimes(1);
    expect(dependencies.list).not.toHaveBeenCalled();
  });

  it('reconciles RESULT_UNKNOWN through a read without replaying the command', async () => {
    const dependencies: OwnerCommandDependencies = {
      submit: vi.fn(),
      list: vi.fn().mockResolvedValue([assignment()]),
    };

    const receipt = await reconcileOwnerSelfServiceRequest(
      {
        idempotencyKey: 'owner-request-0001',
        status: 'RESULT_UNKNOWN',
        request,
      },
      dependencies
    );

    expect(receipt).toMatchObject({ status: 'RECONCILED', presetAssignmentId: 'assignment-1' });
    expect(dependencies.list).toHaveBeenCalledTimes(1);
    expect(dependencies.submit).not.toHaveBeenCalled();
  });
});
