import { describe, expect, it } from 'vitest';

import {
  canContextAccessNavigation,
  mapProductSurfaceAccessError,
  mapProductSurfaceDirectEvaluation,
  resolveEffectiveScope,
} from './product-surface-context';

import type { EffectiveProductSurfaceContext, EffectiveScope } from './product-surface-context';

const scopes: readonly EffectiveScope[] = [
  {
    key: 'scope-a',
    kind: 'RESOURCE_SET',
    displayName: 'A',
    isDefault: true,
    readOnly: false,
    validUntil: '2030-01-01T00:00:00Z',
  },
  {
    key: 'scope-b',
    kind: 'RESOURCE_SET',
    displayName: 'B',
    isDefault: false,
    readOnly: true,
  },
];

const context: EffectiveProductSurfaceContext = {
  contextKey: 'context-1',
  productKey: 'example',
  surfaceKey: 'example.admin',
  plane: 'management',
  accessMode: 'NORMAL',
  accessSource: 'MANAGEMENT',
  appResourceKey: 'APP.EXAMPLE',
  scopes,
  revalidateAt: '2030-01-01T00:00:00Z',
  effectiveGrants: [
    {
      grantKind: 'CAPABILITY',
      capabilityContractKey: 'example.policy.read',
      resolvedCapabilityCode: 'ADMIN.EXAMPLE_POLICY:VIEW',
      authorityMode: 'PERMISSION',
      responsibilityRequirement: 'REQUIRED',
      responsibility: { code: 'APP_CONFIG_ADMIN', resourceSetKey: 'EXAMPLE' },
      scopeKeys: ['scope-a'],
      requiresProductEntitlement: false,
      readOnly: true,
      activationState: 'ACTIVE',
    },
    {
      grantKind: 'POLICY',
      accessPolicyKey: 'example.audit-access.v1',
      authorityMode: 'RELATIONSHIP',
      policyDecisionRef: 'policy-decision-1',
      scopeKeys: ['scope-b'],
      requiresProductEntitlement: false,
      readOnly: true,
    },
  ],
};

describe('effective product surface context', () => {
  it('selects only an explicit or unique/default scope and never widens an invalid key', () => {
    expect(resolveEffectiveScope(scopes, 'scope-b', Date.parse('2029-01-01'))).toMatchObject({
      state: 'selected',
      scope: { key: 'scope-b' },
      canonicalize: false,
    });
    expect(resolveEffectiveScope(scopes, 'unknown', Date.parse('2029-01-01'))).toEqual({
      state: 'scope-invalid',
    });
    expect(resolveEffectiveScope(scopes, undefined, Date.parse('2029-01-01'))).toMatchObject({
      state: 'selected',
      scope: { key: 'scope-a' },
      canonicalize: true,
    });
    expect(
      resolveEffectiveScope(
        scopes.map((scope) => ({ ...scope, isDefault: false })),
        undefined,
        Date.parse('2029-01-01')
      )
    ).toEqual({ state: 'scope-selection-required' });
  });

  it('fails closed for malformed or unknown direct decisions', () => {
    expect(
      mapProductSurfaceDirectEvaluation(
        { decision: 'FUTURE_DECISION', decisionRevision: 'r2' },
        { productKey: 'example', surfaceKey: 'example.admin' }
      )
    ).toMatchObject({ state: 'authority-unavailable' });
    expect(
      mapProductSurfaceDirectEvaluation(
        {
          decision: 'ALLOWED',
          decisionRevision: 'r2',
          context,
          routeGrantRef: 'grant-ref',
          scope: { ...scopes[0]!, key: 'foreign-scope' },
          effectiveReadOnly: false,
          revalidateAt: '2030-01-01T00:00:00Z',
        },
        { productKey: 'example', surfaceKey: 'example.admin' }
      )
    ).toEqual({ state: 'authority-unavailable' });
  });

  it('maps a valid allow and stable HTTP reason codes to exhaustive access states', () => {
    expect(
      mapProductSurfaceDirectEvaluation(
        {
          decision: 'ALLOWED',
          decisionRevision: 'r2',
          context,
          routeGrantRef: 'grant-ref',
          scope: scopes[0],
          effectiveReadOnly: false,
          revalidateAt: '2030-01-01T00:00:00Z',
        },
        { productKey: 'example', surfaceKey: 'example.admin' }
      )
    ).toMatchObject({
      state: 'allowed',
      decisionRevision: 'r2',
      scope: { key: 'scope-a' },
    });
    expect(
      mapProductSurfaceAccessError({ status: 403, reasonCode: 'STEP_UP_REQUIRED' })
    ).toMatchObject({ state: 'step-up-required' });
    expect(mapProductSurfaceAccessError({ status: 503 })).toEqual({
      state: 'authority-unavailable',
    });
  });

  it('projects navigation from exact grants without MANAGE or cross-scope fallback', () => {
    expect(
      canContextAccessNavigation(
        { type: 'capability', capabilityContractKey: 'example.policy.read' },
        context,
        'scope-a',
        Date.parse('2029-01-01')
      )
    ).toBe(true);
    expect(
      canContextAccessNavigation(
        { type: 'capability', capabilityContractKey: 'example.policy.read' },
        context,
        'scope-b',
        Date.parse('2029-01-01')
      )
    ).toBe(false);
    expect(
      canContextAccessNavigation(
        { type: 'policy', accessPolicyKey: 'example.audit-access.v1' },
        context,
        'scope-b',
        Date.parse('2029-01-01')
      )
    ).toBe(true);
    expect(
      canContextAccessNavigation(
        {
          type: 'capability-expression',
          mode: 'ALL',
          capabilityContractKeys: ['example.policy.read', 'example.policy.write'],
        },
        context,
        'scope-a',
        Date.parse('2029-01-01')
      )
    ).toBe(false);
  });

  it('uses the supplied server clock when the browser clock is ahead of the authority', () => {
    const browserNow = Date.parse('2031-01-01T00:00:00Z');
    const serverNow = Date.parse('2029-01-01T00:00:00Z');
    expect(browserNow).toBeGreaterThan(Date.parse(context.revalidateAt));
    expect(
      canContextAccessNavigation(
        { type: 'capability', capabilityContractKey: 'example.policy.read' },
        context,
        'scope-a',
        serverNow
      )
    ).toBe(true);
  });
});
