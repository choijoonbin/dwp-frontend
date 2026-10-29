import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  axiosInstance: { post: runtime.post },
}));

import {
  HCM_SEPARATION_CASE_MUTATION_API_CONTRACT,
  createSeparationCase,
} from './separation-case-api';

import type { SeparationCaseCommandAuthority } from './separation-case-api';

const CORRELATION_ID = '10000000-0000-4000-8000-000000000001';
const RELATIONSHIP_ID = '20000000-0000-4000-8000-000000000002';
const SUBJECT_ID = '30000000-0000-4000-8000-000000000003';
const RECEIPT_ID = '40000000-0000-4000-8000-000000000004';
const IDEMPOTENCY_KEY = 'separation-case-command-0001';
const DIGEST = 'a'.repeat(64);

const command = Object.freeze({
  relationshipPublicId: RELATIONSHIP_ID,
  separationType: 'RESIGNATION' as const,
  effectiveDate: '2026-11-01',
  reasonCode: 'VOLUNTARY_RESIGNATION',
  lastWorkingDate: '2026-10-31',
});

function authority(): SeparationCaseCommandAuthority {
  return {
    idempotencyKey: IDEMPOTENCY_KEY,
    correlationId: CORRELATION_ID,
    expectedObjectVersion: 5,
    governance: {
      mode: 'SECURE',
      rolloutState: '111',
      expectedDecisionRevision: 'decision:separation:5',
      contextKey: 'context:separation:5',
      contextScopeKey: 'scope:separation:5',
      idempotencyKey: IDEMPOTENCY_KEY,
      objectVersion: 5,
      stepUp: {
        challenge: 'signed-separation-proof',
        challengeId: 'challenge:separation:5',
        decisionRevision: 'decision:separation:5',
        expiresAt: '2099-10-29T00:00:00Z',
      },
    },
  };
}

function receipt() {
  return {
    receiptId: RECEIPT_ID,
    commandType: 'SEPARATION_CASE_CREATE',
    status: 'RECEIVED',
    requestHash: DIGEST,
    correlationId: CORRELATION_ID,
    receivedAt: '2026-10-29T00:00:00Z',
    originatingAction: 'hris.action.hrm.create-separation-case',
    subjectPrincipalPublicId: SUBJECT_ID,
    populationScopeDigest: DIGEST,
    fieldPolicyRevision: 2,
    purposeCode: 'SEPARATION_CASE',
    authorizationRevision: 3,
    links: { self: `/api/people/v1/hris/command-receipts/${RECEIPT_ID}` },
  } as const;
}

describe('separation-case governed API', () => {
  beforeEach(() => runtime.post.mockReset());

  it('exports the exact canonical ACTION contract', () => {
    expect(HCM_SEPARATION_CASE_MUTATION_API_CONTRACT).toEqual({
      apiFunction: 'createSeparationCase',
      routeContractKey: 'route.hcm.operations.separation-case.action',
      method: 'POST',
      path: '/api/people/v1/hris/separation-cases',
    });
  });

  it('posts the closed command with COMMAND_HEADER HIGH authority', async () => {
    runtime.post.mockResolvedValue({ data: receipt() });

    await expect(createSeparationCase(command, authority())).resolves.toEqual(receipt());

    expect(runtime.post).toHaveBeenCalledWith(
      HCM_SEPARATION_CASE_MUTATION_API_CONTRACT.path,
      command,
      expect.objectContaining({
        contextScopeKey: 'scope:separation:5',
        csrfReplay: 'NEVER',
        headers: expect.objectContaining({
          'Idempotency-Key': IDEMPOTENCY_KEY,
          'If-Match': '"5"',
          'X-Correlation-ID': CORRELATION_ID,
          'X-Purpose-Code': 'SEPARATION_CASE',
          'X-DWP-Expected-Decision-Revision': 'decision:separation:5',
          'X-DWP-Step-Up-Challenge': 'signed-separation-proof',
          'X-DWP-Expected-Object-Version': '5',
        }),
      })
    );
  });

  it('rejects incomplete or mismatched HIGH authority before transport', async () => {
    const secure = authority();
    const invalid = [
      { ...secure, governance: { mode: 'LEGACY_COMPATIBILITY', rolloutState: '100' } as const },
      { ...secure, governance: { ...secure.governance, stepUp: undefined } },
      { ...secure, expectedObjectVersion: 6 },
      { ...secure, idempotencyKey: 'different-separation-command-key' },
    ];
    for (const candidate of invalid) {
      await expect(createSeparationCase(command, candidate)).rejects.toThrow(
        'HIGH-risk authority does not match'
      );
    }
    expect(runtime.post).not.toHaveBeenCalled();
  });
});
