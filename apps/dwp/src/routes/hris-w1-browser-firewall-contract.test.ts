import { describe, expect, it } from 'vitest';

import { PRODUCT_AUTHORIZATION_PAGE_PROJECTIONS } from './product-surface-authorization.generated';

import {
  HRIS_W1_AUTHORITY_EVALUATION_PATH,
  HRIS_W1_AUTHORITY_RESPONSE_MAX_BYTES,
  HRIS_W1_HOME_SHADOW_RECEIPT_PATH,
  HRIS_W1_OFFICIAL_HCM_PAGE_EVALUATION_CONTRACTS,
  classifyHrisW1AuthorityEvaluation,
  classifyHrisW1ExpectedBlockedSideEffect,
  isExactHrisW1AuthorityResponseEvidence,
  isExactHrisW1ExpectedBlockedSideEffect,
} from '../../../../e2e/support/hris-w1-browser-firewall-contract.mjs';

const activeContracts = [
  {
    kind: 'PAGE',
    routeContractKey: 'route.hcm.operations.people.page',
    productKey: 'hcm',
    surfaceKey: 'hcm.operations',
    contextScopeKey: 'hcm-scope-active',
  },
  {
    kind: 'PAGE',
    routeContractKey: 'route.hcm.management.integration.page',
    productKey: 'hcm',
    surfaceKey: 'hcm.management',
    contextScopeKey: null,
  },
  {
    kind: 'HIGH',
    routeContractKey: 'route.hcm.operations.payroll-foundation-update.action',
    productKey: 'hcm',
    surfaceKey: 'hcm.operations',
    contextScopeKey: 'hcm-scope-active',
  },
] as const;

function evaluationBody(routeContractKey: string, surfaceKey: string, contextScopeKey?: string) {
  return {
    routeContractKey,
    ...(contextScopeKey ? { contextScopeKey } : {}),
    subject: { type: 'PRODUCT', productKey: 'hcm', surfaceKey },
  };
}

function classifyEvaluation(body: unknown, search = '') {
  return classifyHrisW1AuthorityEvaluation({
    method: 'POST',
    pathname: HRIS_W1_AUTHORITY_EVALUATION_PATH,
    search,
    body,
    activeContracts,
  });
}

const shadowReceipt = {
  schemaVersion: 1,
  outcome: 'MATCH',
  reasons: ['MATCH'],
  mismatchCount: 0,
  homeMode: 'CLASSIC',
  deviceClass: 'DESKTOP_STANDARD',
  runtimeState: 'SHADOW_COMPARE',
  rolloutRing: 'PILOT',
  rolloutRevision: 'home-rollout-r1',
};

function classifyReceipt(body: unknown = shadowReceipt, overrides: Record<string, unknown> = {}) {
  return classifyHrisW1ExpectedBlockedSideEffect({
    method: 'POST',
    pathname: HRIS_W1_HOME_SHADOW_RECEIPT_PATH,
    search: '',
    rawBody: JSON.stringify(body),
    body,
    decisionRevision: 'home-decision-r1',
    ...overrides,
  });
}

describe('HRIS W1 browser firewall contract', () => {
  it('stays exactly synchronized with all official generated HCM PAGE projections', () => {
    const generated = PRODUCT_AUTHORIZATION_PAGE_PROJECTIONS.filter(
      (route) => route.productId === 'hcm'
    )
      .map((route) => ({
        routeContractKey: route.routeContractKey,
        surfaceKey: route.surfaceId,
      }))
      .sort((left, right) => left.routeContractKey.localeCompare(right.routeContractKey));
    const firewall = [...HRIS_W1_OFFICIAL_HCM_PAGE_EVALUATION_CONTRACTS].sort((left, right) =>
      left.routeContractKey.localeCompare(right.routeContractKey)
    );

    expect(firewall).toHaveLength(26);
    expect(firewall).toEqual(generated);
  });

  it('separates active PAGE/HIGH tuples from exact official background PAGE tuples', () => {
    expect(
      classifyEvaluation(
        evaluationBody('route.hcm.operations.people.page', 'hcm.operations', 'hcm-scope-active')
      ).observation.reason
    ).toBe('EXACT_PAGE_CONTRACT');
    expect(
      classifyEvaluation(evaluationBody('route.hcm.management.integration.page', 'hcm.management'))
        .observation.reason
    ).toBe('EXACT_PAGE_CONTRACT');
    expect(
      classifyEvaluation(evaluationBody('route.hcm.personal.directory.page', 'hcm.personal'))
        .observation.reason
    ).toBe('EXACT_BACKGROUND_PAGE_CONTRACT');
    expect(
      classifyEvaluation(
        evaluationBody(
          'route.hcm.operations.payroll-foundation-update.action',
          'hcm.operations',
          'hcm-scope-active'
        )
      ).observation.reason
    ).toBe('EXACT_HIGH_CONTRACT');
  });

  it('blocks unknown, malformed, query-bearing, or mismatched authority evaluations', () => {
    const valid = evaluationBody('route.hcm.personal.directory.page', 'hcm.personal');
    for (const classified of [
      classifyEvaluation({ ...valid, extra: true }),
      classifyEvaluation(valid, '?unexpected=true'),
      classifyEvaluation(evaluationBody('route.hcm.personal.unknown.page', 'hcm.personal')),
      classifyEvaluation(evaluationBody('route.hcm.personal.directory.page', 'hcm.team')),
    ]) {
      expect(classified).toMatchObject({
        allowed: false,
        observation: { action: 'BLOCKED', reason: 'OTHER_AUTHORITY_EVALUATION' },
      });
    }
  });

  it('accepts only bounded digest evidence for a continued authority response', () => {
    const response = {
      status: 200,
      bodyByteLength: 128,
      responseBodySha256: 'a'.repeat(64),
      fromServiceWorker: false,
    };
    expect(isExactHrisW1AuthorityResponseEvidence(response)).toBe(true);
    expect(isExactHrisW1AuthorityResponseEvidence({ ...response, status: 503 })).toBe(false);
    expect(
      isExactHrisW1AuthorityResponseEvidence({
        ...response,
        bodyByteLength: HRIS_W1_AUTHORITY_RESPONSE_MAX_BYTES + 1,
      })
    ).toBe(false);
    expect(isExactHrisW1AuthorityResponseEvidence({ ...response, fromServiceWorker: true })).toBe(
      false
    );
    expect(isExactHrisW1AuthorityResponseEvidence({ ...response, rawBody: 'secret' })).toBe(false);
  });

  it('aborts only the exact aggregate SHADOW_COMPARE receipt and stores hashes, not raw data', () => {
    const classified = classifyReceipt();
    expect(classified.allowed).toBe(true);
    expect(isExactHrisW1ExpectedBlockedSideEffect(classified.evidence)).toBe(true);
    expect(classified.evidence).toEqual({
      method: 'POST',
      path: HRIS_W1_HOME_SHADOW_RECEIPT_PATH,
      query: '',
      reason: 'EXPECTED_BLOCKED_HOME_SHADOW_RECEIPT',
      runtimeState: 'SHADOW_COMPARE',
      bodyByteLength: JSON.stringify(shadowReceipt).length,
      requestBodySha256: expect.stringMatching(/^[0-9a-f]{64}$/u),
      decisionRevisionSha256: expect.stringMatching(/^[0-9a-f]{64}$/u),
    });
    expect(JSON.stringify(classified.evidence)).not.toContain('home-decision-r1');
    expect(JSON.stringify(classified.evidence)).not.toContain('home-rollout-r1');
  });

  it('fails closed for malformed, duplicate-prone, query-bearing, or headerless receipts', () => {
    for (const classified of [
      classifyReceipt({ ...shadowReceipt, runtimeState: 'ACTIVE' }),
      classifyReceipt({ ...shadowReceipt, extra: true }),
      classifyReceipt(shadowReceipt, { search: '?retry=1' }),
      classifyReceipt(shadowReceipt, { decisionRevision: '' }),
      classifyReceipt(shadowReceipt, {
        rawBody: JSON.stringify(shadowReceipt).replace(
          '"schemaVersion":1',
          '"schemaVersion":1,"schemaVersion":1'
        ),
      }),
      classifyReceipt(shadowReceipt, { rawBody: 'x'.repeat(4 * 1024 + 1) }),
    ]) {
      expect(classified).toEqual({ allowed: false, evidence: null });
    }
  });
});
