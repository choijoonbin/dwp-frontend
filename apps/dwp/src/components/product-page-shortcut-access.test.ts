import { describe, expect, it } from 'vitest';

import {
  appendProductPageShortcutScope,
  PRODUCT_PAGE_SHORTCUT_TARGETS,
  resolveProductPageShortcutAccess,
} from './product-page-shortcut-access';
import { requireProductPageRouteContract } from '../routes/product-page-route-contracts';

import type { ProductSurfaceCanaryAuthority } from '../features/shell/product-surface-canary-runtime';
import type { AllowedSurfaceDecision } from '../features/shell/product-surface-context';

const NOW = Date.parse('2029-01-01T00:00:00Z');
const FUTURE = '2030-01-01T00:00:00Z';
const TARGET = {
  productId: 'hcm',
  surfaceId: 'hcm.management',
  routeContractKey: 'route.hcm.management.controlled-export.page',
} as const;

function allowedDecision(overrides: Partial<AllowedSurfaceDecision> = {}): AllowedSurfaceDecision {
  return {
    state: 'allowed',
    routeGrantRef: 'route-grant:controlled-export',
    decisionRevision: 'psr-direct-route',
    effectiveReadOnly: false,
    revalidateAt: FUTURE,
    scope: {
      key: 'scope:selected',
      kind: 'RESOURCE_SET',
      displayName: 'Selected',
      isDefault: true,
      readOnly: false,
      validUntil: FUTURE,
    },
    context: {
      contextKey: 'context:hcm-management',
      productKey: 'hcm',
      surfaceKey: 'hcm.management',
      plane: 'management',
      accessMode: 'NORMAL',
      accessSource: 'MANAGEMENT',
      appResourceKey: 'APP.HCM',
      effectiveGrants: [],
      scopes: [
        {
          key: 'scope:selected',
          kind: 'RESOURCE_SET',
          displayName: 'Selected',
          isDefault: true,
          readOnly: false,
          validUntil: FUTURE,
        },
      ],
      revalidateAt: FUTURE,
    },
    ...overrides,
  };
}

function authority(
  bits: '000' | '100' | '110' | '111',
  decision: AllowedSurfaceDecision | { state: 'route-denied' } = allowedDecision()
): ProductSurfaceCanaryAuthority {
  const allowed = decision.state === 'allowed' ? decision : undefined;
  return {
    flags: {
      contextShadow: bits[0] === '1',
      capabilityEnforcement: bits[1] === '1',
      surfaceUi: bits[2] === '1',
      surfaceUiEvaluation: 'resolved',
    },
    serverNowMs: NOW,
    envelope: allowed
      ? {
          contractVersion: '3',
          decisionRevision: 'psr-list-envelope',
          sourceRevisions: { auth: 'auth-1' },
          activeAccessMode: 'NORMAL',
          generatedAt: '2029-01-01T00:00:00Z',
          contexts: [allowed.context],
        }
      : undefined,
    routeDecisions: { [TARGET.routeContractKey]: decision },
  };
}

describe('product PAGE shortcut exact disclosure', () => {
  it.each([
    ['approvalOperations', '/approvals/admin/operations'],
    ['approvalWorkflows', '/approvals/admin/workflows'],
    ['hcmControlledExport', '/hr/data/exports'],
    ['hcmOrganizationDesign', '/hr/design/organization'],
    ['hcmEmployeeServices', '/hr/services'],
  ] as const)('keeps shortcut %s bound to the registered PAGE owner', (targetKey, pattern) => {
    const target = PRODUCT_PAGE_SHORTCUT_TARGETS[targetKey];
    expect(requireProductPageRouteContract(target.routeContractKey)).toMatchObject({
      pattern,
      productId: target.productId,
      surfaceId: target.surfaceId,
    });
  });

  it.each(['000', '100'] as const)('keeps legacy disclosure in rollout %s', (bits) => {
    expect(
      resolveProductPageShortcutAccess(authority(bits, { state: 'route-denied' }), TARGET)
    ).toEqual({ disclosed: true });
  });

  it.each(['110', '111'] as const)(
    'requires the trusted target PAGE decision and carries its exact scope in rollout %s',
    (bits) => {
      const access = resolveProductPageShortcutAccess(authority(bits), TARGET);
      expect(access).toEqual({ disclosed: true, contextScopeKey: 'scope:selected' });
      expect(appendProductPageShortcutScope('/hr/data/exports?dataset=ORG#queue', access)).toBe(
        '/hr/data/exports?dataset=ORG&scope=scope%3Aselected#queue'
      );
      expect(
        resolveProductPageShortcutAccess(authority(bits, { state: 'route-denied' }), TARGET)
      ).toEqual({ disclosed: false });
    }
  );

  it('fails closed for pending, wrong-surface, and expired PAGE evidence', () => {
    const pending = authority('111');
    pending.pendingRoutes = { [TARGET.routeContractKey]: true };
    expect(resolveProductPageShortcutAccess(pending, TARGET)).toEqual({ disclosed: false });

    const wrongSurface = allowedDecision({
      context: { ...allowedDecision().context, surfaceKey: 'hcm.operations' },
    });
    expect(resolveProductPageShortcutAccess(authority('111', wrongSurface), TARGET)).toEqual({
      disclosed: false,
    });

    const expired = allowedDecision({ revalidateAt: '2028-01-01T00:00:00Z' });
    expect(resolveProductPageShortcutAccess(authority('111', expired), TARGET)).toEqual({
      disclosed: false,
    });
  });
});
