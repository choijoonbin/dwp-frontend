import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';

const runtime = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  axiosInstance: { get: runtime.get, post: runtime.post },
}));

import {
  REFERENCE_CONFIGURATION_OPERATION_BINDINGS,
  publishReferenceConfigurationVersion,
  readReferenceConfigurationWorkbench,
  validateReferenceConfigurationVersion,
} from '../api/reference-configuration-api';

const CONFIGURATION_ID = '10000000-0000-4000-8000-000000000001';
const IDEMPOTENCY_KEY = '20000000-0000-4000-8000-000000000001';
const CORRELATION_ID = '30000000-0000-4000-8000-000000000001';

describe('reference-configuration API', () => {
  beforeEach(() => {
    runtime.get.mockReset();
    runtime.post.mockReset();
  });

  it('binds exactly the twelve governed Gateway operations without reusing workforce data', () => {
    expect(REFERENCE_CONFIGURATION_OPERATION_BINDINGS).toHaveLength(12);
    expect(
      new Set(
        REFERENCE_CONFIGURATION_OPERATION_BINDINGS.map(([method, path]) => `${method} ${path}`)
      ).size
    ).toBe(12);
    expect(JSON.stringify(REFERENCE_CONFIGURATION_OPERATION_BINDINGS)).not.toContain(
      '/hr/data/reference'
    );
  });

  it('reads the IAQ-052 workbench with scope, filter, locale, time zone, and correlation', async () => {
    const payload = workbench();
    const signal = new AbortController().signal;
    runtime.get.mockResolvedValue({ data: { data: payload } });

    await expect(
      readReferenceConfigurationWorkbench(
        {
          limit: 25,
          asOf: '2026-10-12T00:00:00Z',
          policyVersion: { policyKeys: ['employment-status'], minimumRevision: 3 },
          referenceData: { publicIds: [CONFIGURATION_ID], codes: ['SYS'] },
          effectiveStatus: { codes: ['DRAFT'], minimumRevision: 4 },
          fields: ['POLICY_VERSION', 'REFERENCE_DATA'],
          freshness: 'ALLOW_STALE',
          sort: ['referenceData:ASC'],
          locale: 'ko-KR',
          timeZone: 'Asia/Seoul',
          correlationId: CORRELATION_ID,
        },
        'tenant:42/configuration',
        signal
      )
    ).resolves.toEqual(payload);
    const requested = new URL(runtime.get.mock.calls[0][0], 'http://test.invalid');
    expect(requested.pathname).toBe('/api/platform/v1/hris/workbench/settings-reference');
    expect(Object.fromEntries(requested.searchParams)).toMatchObject({
      limit: '25',
      asOf: '2026-10-12T00:00:00Z',
      'policyVersion.policyKeys': 'employment-status',
      'policyVersion.minimumRevision': '3',
      'referenceData.publicIds': CONFIGURATION_ID,
      'referenceData.codes': 'SYS',
      'effectiveStatus.codes': 'DRAFT',
      'effectiveStatus.minimumRevision': '4',
      fields: 'POLICY_VERSION,REFERENCE_DATA',
      freshness: 'ALLOW_STALE',
      locale: 'ko-KR',
      timeZone: 'Asia/Seoul',
      sort: 'referenceData:ASC',
    });
    expect(runtime.get.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        contextScopeKey: 'tenant:42/configuration',
        signal,
        headers: {
          'X-Correlation-ID': CORRELATION_ID,
          'X-Purpose-Code': 'HRIS_SYSTEM_ADMIN',
        },
      })
    );
  });

  it('sends CAS for author transitions and complete step-up evidence for publish', async () => {
    runtime.post
      .mockResolvedValueOnce({ data: { data: receipt('VALIDATE_VERSION') } })
      .mockResolvedValueOnce({ data: { data: receipt('PUBLISH_VERSION') } });
    const authorAuthority = commandAuthority(false);
    const publisherAuthority = commandAuthority(true);

    await validateReferenceConfigurationVersion(
      CONFIGURATION_ID,
      1,
      { inputScopeDigest: 'a'.repeat(64), schemaRevision: 1 },
      authorAuthority
    );
    await publishReferenceConfigurationVersion(
      CONFIGURATION_ID,
      1,
      {
        approvalReceiptId: '40000000-0000-4000-8000-000000000001',
        impactDigest: 'b'.repeat(64),
        effectiveFrom: '2026-10-13T00:00:00Z',
        effectiveTo: null,
      },
      publisherAuthority
    );

    expect(runtime.post.mock.calls[0][2].headers).toMatchObject({
      'Idempotency-Key': IDEMPOTENCY_KEY,
      'X-Correlation-ID': CORRELATION_ID,
      'X-Purpose-Code': 'HRIS_SYSTEM_ADMIN',
      'X-DWP-Expected-Object-Version': '7',
    });
    expect(runtime.post.mock.calls[1][2].headers).toMatchObject({
      'Idempotency-Key': IDEMPOTENCY_KEY,
      'X-DWP-Expected-Object-Version': '7',
      'X-DWP-Expected-Decision-Revision': 'decision-9',
      'X-DWP-Step-Up-Challenge': 'signed-step-up',
      'X-Purpose-Code': 'HRIS_SYSTEM_ADMIN',
    });
  });

  it('rejects substituted idempotency or object-version authority before transport', async () => {
    const authority = commandAuthority(false);
    await expect(
      validateReferenceConfigurationVersion(
        CONFIGURATION_ID,
        1,
        { inputScopeDigest: 'a'.repeat(64), schemaRevision: 1 },
        { ...authority, expectedObjectVersion: 8 }
      )
    ).rejects.toThrow('does not match the command');
    expect(runtime.post).not.toHaveBeenCalled();
  });
});

function commandAuthority(highRisk: boolean) {
  const governance: ProductSurfaceGovernedMutationAuthority = {
    mode: 'SECURE',
    rolloutState: '111',
    expectedDecisionRevision: 'decision-9',
    contextKey: 'hcm.management.reference-configuration',
    contextScopeKey: 'tenant:42/configuration',
    idempotencyKey: IDEMPOTENCY_KEY,
    objectVersion: 7,
    ...(highRisk
      ? {
          stepUp: {
            challenge: 'signed-step-up',
            challengeId: 'challenge-1',
            decisionRevision: 'decision-9',
            expiresAt: '2099-01-01T00:00:00Z',
          },
        }
      : {}),
  };
  return {
    governance,
    idempotencyKey: IDEMPOTENCY_KEY,
    correlationId: CORRELATION_ID,
    expectedObjectVersion: 7,
  };
}

function receipt(commandType: string) {
  return {
    receiptId: '50000000-0000-4000-8000-000000000001',
    commandType,
    originatingAction: 'configuration.version.command',
    subjectPrincipalPublicId: '60000000-0000-4000-8000-000000000001',
    populationScopeDigest: 'c'.repeat(64),
    fieldPolicyRevision: 9,
    purposeCode: 'HRIS_SYSTEM_ADMIN',
    authorizationRevision: 9,
    status: 'SUCCEEDED',
    correlationId: CORRELATION_ID,
    requestDigest: 'd'.repeat(64),
    createdAt: '2026-10-12T00:00:00Z',
    aggregateVersion: 8,
    resultRef: `${CONFIGURATION_ID}/1`,
  };
}

function workbench() {
  return {
    projectionVersion: '1',
    asOf: '2026-10-12T00:00:00Z',
    variantKey: 'REFERENCE',
    queryState: {
      state: 'EMPTY',
      scopeDecisionRevision: 'scope-1',
      freshness: 'CURRENT',
      nextCursor: null,
      fieldDecisionSummary: { viewCount: 0, maskedCount: 0, omittedCount: 0 },
      partialFailures: [],
      correlationId: CORRELATION_ID,
      cachePolicy: {
        authorizationDecisionRevision: 'scope-1',
        invalidationEvent: 'dwp.hris.access.assignment.changed.v1',
        maxAgeSeconds: 30,
      },
    },
    items: [],
  };
}
