import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';
import type {
  CreatePerformanceCycleRequest,
  PreviewPerformancePopulationRequest,
  PublishPerformanceCycleRequest,
  UpdatePerformanceCycleRequest,
  ValidatePerformanceCycleRequest,
} from '../model/performance-cycle-command';

const runtime = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
}));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  axiosInstance: {
    get: runtime.get,
    patch: runtime.patch,
    post: runtime.post,
  },
}));

import {
  createPerformanceCycle,
  previewPerformancePopulation,
  publishPerformanceCycle,
  readPerformanceCommandReceipt,
  readPerformanceCycle,
  readPerformanceCycleCollection,
  updatePerformanceCycle,
  validatePerformanceCycle,
} from './performance-cycle-api';

const COMMAND_CREATE = '10000000-0000-4000-8000-000000000001';
const COMMAND_UPDATE = '10000000-0000-4000-8000-000000000002';
const COMMAND_VALIDATE = '10000000-0000-4000-8000-000000000003';
const COMMAND_PREVIEW = '10000000-0000-4000-8000-000000000004';
const COMMAND_PUBLISH = '10000000-0000-4000-8000-000000000005';

const authority = {
  mode: 'SECURE',
  rolloutState: '111',
  expectedDecisionRevision: 'decision-revision-17',
  contextKey: 'hcm.operations.talent',
  contextScopeKey: 'tenant:17/performance',
  idempotencyKey: 'authority-level-key-must-not-replace-the-command-id',
} as const satisfies ProductSurfaceGovernedMutationAuthority;

function publicationAuthority(
  commandId: string,
  objectVersion: number
): ProductSurfaceGovernedMutationAuthority {
  return {
    ...authority,
    idempotencyKey: commandId,
    objectVersion,
    stepUp: {
      challenge: 'signed-performance-publication-challenge',
      challengeId: 'performance-publication-challenge-id',
      decisionRevision: authority.expectedDecisionRevision,
      expiresAt: '2099-01-01T00:00:00Z',
    },
  };
}

const stage = Object.freeze({
  stageKey: 'SELF_REVIEW',
  stageType: 'SELF_REVIEW',
  sequenceNo: 1,
  opensAt: '2026-01-01T00:00:00Z',
  closesAt: '2026-03-01T00:00:00Z',
  required: true,
  stageConfig: Object.freeze({ instructions: 'Reflect on the cycle.' }),
});

const createRequest: CreatePerformanceCycleRequest = Object.freeze({
  commandId: COMMAND_CREATE,
  cycleKey: 'FY27',
  displayName: 'FY27 performance cycle',
  retentionPolicyId: '20000000-0000-4000-8000-000000000001',
  effectiveFrom: '2026-01-01T00:00:00Z',
  effectiveTo: '2026-12-31T23:59:59Z',
  timezoneId: 'Asia/Seoul',
  policyVersionId: '30000000-0000-4000-8000-000000000001',
  populationRuleVersionId: '40000000-0000-4000-8000-000000000001',
  stages: Object.freeze([stage]),
});

const updateRequest: UpdatePerformanceCycleRequest = Object.freeze({
  commandId: COMMAND_UPDATE,
  expectedRevision: 7,
  displayName: 'FY27 performance cycle revised',
  retentionPolicyId: createRequest.retentionPolicyId,
  effectiveFrom: createRequest.effectiveFrom,
  effectiveTo: null,
  timezoneId: createRequest.timezoneId,
  policyVersionId: createRequest.policyVersionId,
  populationRuleVersionId: createRequest.populationRuleVersionId,
  stages: createRequest.stages,
});

const validateRequest: ValidatePerformanceCycleRequest = Object.freeze({
  commandId: COMMAND_VALIDATE,
  expectedRevision: 8,
});

const previewRequest: PreviewPerformancePopulationRequest = Object.freeze({
  commandId: COMMAND_PREVIEW,
  expectedRevision: 9,
  asOf: '2026-06-01T00:00:00Z',
});

const publishRequest: PublishPerformanceCycleRequest = Object.freeze({
  commandId: COMMAND_PUBLISH,
  expectedRevision: 10,
  populationPreviewId: '50000000-0000-4000-8000-000000000001',
  expectedWorkforceOwnerRevision: 31,
  publicationApprovalRef: '60000000-0000-4000-8000-000000000001',
  reason: 'Approved after reviewing the frozen participant population.',
});

function response(data: unknown) {
  return Promise.resolve({ data: { data } });
}

function governedConfig(commandId: string) {
  return {
    headers: {
      'X-DWP-Expected-Decision-Revision': authority.expectedDecisionRevision,
      'Idempotency-Key': commandId,
    },
    contextScopeKey: authority.contextScopeKey,
  };
}

describe('performance cycle API', () => {
  beforeEach(() => {
    runtime.get.mockReset();
    runtime.patch.mockReset();
    runtime.post.mockReset();
  });

  it('uses exact Gateway read paths, encodes opaque identifiers, and forwards scope and abort', async () => {
    const signal = new AbortController().signal;
    const collection = { cycles: [] };
    const cycle = { cycleId: 'selected-cycle' };
    const receipt = { receiptId: 'selected-receipt' };
    runtime.get
      .mockImplementationOnce(() => response(collection))
      .mockImplementationOnce(() => response(cycle))
      .mockImplementationOnce(() => response(receipt));

    await expect(readPerformanceCycleCollection('scope:tenant/17', signal)).resolves.toBe(
      collection
    );
    await expect(
      readPerformanceCycle('cycle/../../tenant?expand=true', 'scope:tenant/17', signal)
    ).resolves.toBe(cycle);
    await expect(
      readPerformanceCommandReceipt('receipt/../other#fragment', 'scope:tenant/17', signal)
    ).resolves.toBe(receipt);

    const config = { contextScopeKey: 'scope:tenant/17', signal };
    expect(runtime.get).toHaveBeenNthCalledWith(
      1,
      '/api/people/v1/hris/performance/cycles',
      config
    );
    expect(runtime.get).toHaveBeenNthCalledWith(
      2,
      '/api/people/v1/hris/performance/cycles/cycle%2F..%2F..%2Ftenant%3Fexpand%3Dtrue',
      config
    );
    expect(runtime.get).toHaveBeenNthCalledWith(
      3,
      '/api/people/v1/hris/performance/command-receipts/receipt%2F..%2Fother%23fragment',
      config
    );
  });

  it('sends every author command unchanged with its stable command id as idempotency key', async () => {
    runtime.post.mockImplementation((_url, body) => response(body));
    runtime.patch.mockImplementation((_url, body) => response(body));
    const cycleId = 'cycle/tenant ?#17';
    const encodedCycleId = 'cycle%2Ftenant%20%3F%2317';

    await expect(createPerformanceCycle(createRequest, authority)).resolves.toBe(createRequest);
    await expect(updatePerformanceCycle(cycleId, updateRequest, authority)).resolves.toBe(
      updateRequest
    );
    await expect(validatePerformanceCycle(cycleId, validateRequest, authority)).resolves.toBe(
      validateRequest
    );
    await expect(previewPerformancePopulation(cycleId, previewRequest, authority)).resolves.toBe(
      previewRequest
    );

    expect(runtime.post).toHaveBeenNthCalledWith(
      1,
      '/api/people/v1/hris/performance/cycles',
      createRequest,
      governedConfig(COMMAND_CREATE)
    );
    expect(runtime.patch).toHaveBeenCalledWith(
      `/api/people/v1/hris/performance/cycles/${encodedCycleId}`,
      updateRequest,
      governedConfig(COMMAND_UPDATE)
    );
    expect(runtime.post).toHaveBeenNthCalledWith(
      2,
      `/api/people/v1/hris/performance/cycles/${encodedCycleId}/validate`,
      validateRequest,
      governedConfig(COMMAND_VALIDATE)
    );
    expect(runtime.post).toHaveBeenNthCalledWith(
      3,
      `/api/people/v1/hris/performance/cycles/${encodedCycleId}/population-previews`,
      previewRequest,
      governedConfig(COMMAND_PREVIEW)
    );
  });

  it('preserves the reviewed publication approval and reuses the publish command id', async () => {
    const result = { cycle: { cycleId: 'published-cycle' } };
    runtime.post.mockImplementation(() => response(result));
    const cycleId = 'cycle/publish target';
    const expectedPath = '/api/people/v1/hris/performance/cycles/cycle%2Fpublish%20target/publish';

    const publishAuthority = publicationAuthority(COMMAND_PUBLISH, publishRequest.expectedRevision);
    await expect(publishPerformanceCycle(cycleId, publishRequest, publishAuthority)).resolves.toBe(
      result
    );
    await expect(publishPerformanceCycle(cycleId, publishRequest, publishAuthority)).resolves.toBe(
      result
    );

    expect(runtime.post).toHaveBeenCalledTimes(2);
    for (const call of runtime.post.mock.calls) {
      expect(call).toEqual([
        expectedPath,
        publishRequest,
        {
          ...governedConfig(COMMAND_PUBLISH),
          headers: {
            ...governedConfig(COMMAND_PUBLISH).headers,
            'X-DWP-Expected-Object-Version': String(publishRequest.expectedRevision),
            'X-DWP-Step-Up-Challenge': 'signed-performance-publication-challenge',
          },
        },
      ]);
      expect(call[1]).toHaveProperty(
        'publicationApprovalRef',
        '60000000-0000-4000-8000-000000000001'
      );
      expect(call[2].headers['Idempotency-Key']).toBe(COMMAND_PUBLISH);
    }
  });

  it('rejects publication when signed command identity or version is substituted', async () => {
    await expect(
      publishPerformanceCycle(
        'cycle-id',
        publishRequest,
        publicationAuthority(
          '70000000-0000-4000-8000-000000000001',
          publishRequest.expectedRevision
        )
      )
    ).rejects.toThrow('Performance publication authority does not match the command.');
    await expect(
      publishPerformanceCycle(
        'cycle-id',
        publishRequest,
        publicationAuthority(COMMAND_PUBLISH, publishRequest.expectedRevision + 1)
      )
    ).rejects.toThrow('Performance publication authority does not match the command.');
    expect(runtime.post).not.toHaveBeenCalled();
  });
});
