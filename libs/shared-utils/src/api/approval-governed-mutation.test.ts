import { describe, expect, it } from 'vitest';

import {
  buildProductSurfaceGovernedMutationHeaders,
  productSurfaceGovernedMutationConfig,
  PRODUCT_SURFACE_EXPECTED_DECISION_REVISION_HEADER,
  PRODUCT_SURFACE_EXPECTED_OBJECT_VERSION_HEADER,
  PRODUCT_SURFACE_IDEMPOTENCY_KEY_HEADER,
  PRODUCT_SURFACE_STEP_UP_CHALLENGE_HEADER,
} from './product-surface-governed-mutation';

describe('Product surface governed mutation headers', () => {
  const authority = {
    mode: 'SECURE',
    rolloutState: '111',
    expectedDecisionRevision: 'direct-action-revision',
    contextKey: 'approvals-management',
    contextScopeKey: 'scope-1',
    objectVersion: 7,
    idempotencyKey: 'stable-attempt-key',
    stepUp: {
      challenge: 'signed-jwt',
      challengeId: 'challenge-jti',
      decisionRevision: 'direct-action-revision',
      expiresAt: '2026-08-24T01:05:00Z',
    },
  } as const;

  it('sends only the Gateway precondition, idempotency and bearer proof headers', () => {
    expect(
      buildProductSurfaceGovernedMutationHeaders(authority, { objectVersionHeader: true })
    ).toEqual({
      [PRODUCT_SURFACE_EXPECTED_DECISION_REVISION_HEADER]: 'direct-action-revision',
      [PRODUCT_SURFACE_EXPECTED_OBJECT_VERSION_HEADER]: '7',
      [PRODUCT_SURFACE_IDEMPOTENCY_KEY_HEADER]: 'stable-attempt-key',
      [PRODUCT_SURFACE_STEP_UP_CHALLENGE_HEADER]: 'signed-jwt',
    });
    const serializedHeaders = JSON.stringify(buildProductSurfaceGovernedMutationHeaders(authority));
    expect(serializedHeaders).not.toContain('challenge-jti');
    expect(serializedHeaders).not.toContain('approvals-management');
    expect(serializedHeaders).not.toContain('scope-1');
    expect(
      buildProductSurfaceGovernedMutationHeaders({
        mode: 'LEGACY_COMPATIBILITY',
        rolloutState: '100',
      })
    ).toEqual({});
  });

  it('carries the selected scope only as the standard request option', () => {
    expect(productSurfaceGovernedMutationConfig(authority)).toEqual({
      headers: {
        [PRODUCT_SURFACE_EXPECTED_DECISION_REVISION_HEADER]: 'direct-action-revision',
        [PRODUCT_SURFACE_IDEMPOTENCY_KEY_HEADER]: 'stable-attempt-key',
        [PRODUCT_SURFACE_STEP_UP_CHALLENGE_HEADER]: 'signed-jwt',
      },
      contextScopeKey: 'scope-1',
    });
    expect(
      productSurfaceGovernedMutationConfig({
        mode: 'LEGACY_COMPATIBILITY',
        rolloutState: '100',
      })
    ).toEqual({ headers: {} });
  });

  it('rejects a proof whose issuer revision differs from the direct action revision', () => {
    expect(() =>
      buildProductSurfaceGovernedMutationHeaders({
        ...authority,
        stepUp: { ...authority.stepUp, decisionRevision: 'issuer-other-revision' },
      })
    ).toThrowError('Product surface governed step-up proof is invalid.');
  });
});
