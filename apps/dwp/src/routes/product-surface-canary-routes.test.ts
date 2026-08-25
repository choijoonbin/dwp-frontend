import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

import { isAppResourceEntitled } from '@dwp-frontend/shared-utils/auth/app-entitlements';

import {
  buildProductCanaryLayoutRuntime,
  resolveProductCanaryBoundaryStrategy,
  isProductCanaryBoundaryPending,
  preserveProductRouteLocation,
  type ProductCanaryBoundaryStrategy,
} from './product-surface-canary-routes';

import type { ProductSurfaceManifest } from '../components/product-manifest';
import type { ProductSurfaceCanaryAuthority } from '../features/shell/product-surface-canary-runtime';
import type { ProductSurfaceRolloutMode } from '../features/shell/product-surface-canary-runtime';
import type {
  AllowedSurfaceDecision,
  EffectiveProductSurfaceContext,
} from '../features/shell/product-surface-context';

function strategy(
  contextShadow: boolean,
  capabilityEnforcement: boolean,
  surfaceUi: boolean
): ProductCanaryBoundaryStrategy {
  const authority: ProductSurfaceCanaryAuthority = {
    flags: {
      contextShadow,
      capabilityEnforcement,
      surfaceUi,
      surfaceUiEvaluation: 'resolved',
    },
  };
  return resolveProductCanaryBoundaryStrategy(authority);
}

describe('Canary authorization boundary', () => {
  it('preserves opaque scope/query/hash through an index PAGE redirect', () => {
    expect(
      preserveProductRouteLocation('/approvals/admin/overview', {
        search: '?scope=S2&view=exceptions',
        hash: '#queue',
      })
    ).toBe('/approvals/admin/overview?scope=S2&view=exceptions#queue');
  });
  it('shows a neutral pending state until direct evaluation settles', () => {
    const authority: ProductSurfaceCanaryAuthority = {
      flags: {
        contextShadow: true,
        capabilityEnforcement: true,
        surfaceUi: true,
        surfaceUiEvaluation: 'resolved',
      },
      pendingSurfaces: { 'communications.work': true },
      pendingRoutes: { 'route.communications.work.home.page': true },
    };
    expect(isProductCanaryBoundaryPending(authority, { surfaceId: 'communications.work' })).toBe(
      true
    );
    expect(
      isProductCanaryBoundaryPending(authority, {
        surfaceId: 'communications.work',
        routeContractKey: 'route.communications.work.home.page',
      })
    ).toBe(true);
  });

  it('keeps the neutral fallback while the authority envelope itself is loading', () => {
    const authority: ProductSurfaceCanaryAuthority = {
      flags: {
        contextShadow: false,
        capabilityEnforcement: true,
        surfaceUi: false,
        surfaceUiEvaluation: 'unavailable',
      },
      authorityPending: true,
    };
    expect(isProductCanaryBoundaryPending(authority, { surfaceId: 'communications.work' })).toBe(
      true
    );
  });

  it('uses compatibility only before enforcement and server decisions throughout the Pilot boundary', () => {
    expect(strategy(false, false, false)).toBe('legacy');
    expect(strategy(true, false, false)).toBe('legacy');
    expect(strategy(true, true, false)).toBe('server');
    expect(strategy(true, true, true)).toBe('server');
    expect(strategy(false, true, false)).toBe('fail-closed');
  });

  it('does not invoke empty entitlement fail-open or global MANAGE fallback in the enforced boundary', () => {
    expect(isAppResourceEntitled('APP.CANARY', [])).toBe(true);
    expect(strategy(true, true, false)).toBe('server');

    const source = fs.readFileSync(
      new URL('./product-surface-canary-routes.tsx', import.meta.url),
      'utf8'
    );
    expect(source).not.toContain('isAppResourceEntitled');
    expect(source).not.toContain("'MANAGE'");
    expect(source).not.toContain('hasPermission(');
    expect(source).not.toContain('AppRouteGuard');
    expect(source).not.toContain('ProductRouteGuard');
  });
});

const returnLabelManifest: ProductSurfaceManifest = {
  id: 'return-label',
  appKey: 'APP.RETURN_LABEL',
  basePath: '/return-label',
  surfaces: [
    {
      id: 'return-label.work',
      plane: 'work',
      labelKey: 'returnLabel.work',
      taskKinds: ['work'],
      routeMatchers: [{ kind: 'exact', path: '/return-label/home' }],
      indexPath: '/return-label/home',
      navigation: [],
      entryAccess: {
        type: 'policy',
        accessPolicyKey: 'return-label.work.v1',
        requiresProductEntitlement: true,
      },
      supportedScopeKinds: ['SELF'],
      shellProfile: 'product-work',
    },
    {
      id: 'return-label.admin',
      plane: 'management',
      labelKey: 'returnLabel.admin',
      taskKinds: ['administration'],
      routeMatchers: [{ kind: 'exact', path: '/return-label/admin' }],
      indexPath: '/return-label/admin',
      navigation: [],
      entryAccess: {
        type: 'capability',
        entryCapabilityMode: 'ANY',
        requiredCapabilityContractKeys: ['return-label.admin.read'],
        requiresProductEntitlement: false,
      },
      supportedScopeKinds: ['RESOURCE_SET'],
      shellProfile: 'product-management',
      returnSurfaceId: 'return-label.work',
    },
  ],
};

const contextScope = {
  key: 'scope-1',
  kind: 'RESOURCE_SET' as const,
  displayName: 'Scope 1',
  isDefault: true,
  readOnly: false,
};

const managementContext: EffectiveProductSurfaceContext = {
  contextKey: 'management-context',
  productKey: 'return-label',
  surfaceKey: 'return-label.admin',
  plane: 'management',
  accessMode: 'NORMAL',
  accessSource: 'MANAGEMENT',
  appResourceKey: 'APP.RETURN_LABEL',
  effectiveGrants: [],
  scopes: [contextScope],
  revalidateAt: '2030-01-01T00:00:00Z',
};

const workContext: EffectiveProductSurfaceContext = {
  ...managementContext,
  contextKey: 'work-context',
  surfaceKey: 'return-label.work',
  plane: 'work',
  accessSource: 'ENTITLEMENT',
  scopes: [{ ...contextScope, kind: 'SELF' }],
};

const managementDecision: AllowedSurfaceDecision = {
  state: 'allowed',
  context: managementContext,
  routeGrantRef: 'return-label.admin.read',
  scope: contextScope,
  effectiveReadOnly: false,
  revalidateAt: managementContext.revalidateAt,
  decisionRevision: 'revision-1',
};

const workDecision: AllowedSurfaceDecision = {
  ...managementDecision,
  context: workContext,
  routeGrantRef: 'return-label.work.v1',
  scope: workContext.scopes[0]!,
  revalidateAt: workContext.revalidateAt,
};

function returnLabelRuntime(
  contexts: readonly EffectiveProductSurfaceContext[],
  rolloutMode: ProductSurfaceRolloutMode = 'surface-ui',
  decision: AllowedSurfaceDecision = managementDecision
) {
  const authority: ProductSurfaceCanaryAuthority = {
    flags: {
      contextShadow: true,
      capabilityEnforcement: true,
      surfaceUi: true,
      surfaceUiEvaluation: 'resolved',
    },
    serverNowMs: Date.parse('2029-01-01T00:00:00Z'),
    envelope: {
      contractVersion: '1',
      decisionRevision: 'revision-1',
      sourceRevisions: {},
      activeAccessMode: 'NORMAL',
      generatedAt: '2029-01-01T00:00:00Z',
      contexts,
    },
  };
  return buildProductCanaryLayoutRuntime({
    authority,
    manifest: returnLabelManifest,
    decision,
    label: '관리',
    returnLabels: { work: '업무로 돌아가기', catalog: '앱 목록으로 돌아가기' },
    registeredRoutes: [],
    rolloutMode,
  });
}

describe('Canary layout return label', () => {
  it('uses the catalog label when a management-only user has no allowed work surface', () => {
    expect(returnLabelRuntime([managementContext]).returnTarget).toEqual({
      path: '/apps',
      label: '앱 목록으로 돌아가기',
    });
  });

  it('uses the work label when an allowed work surface is available', () => {
    expect(returnLabelRuntime([managementContext, workContext]).returnTarget).toEqual({
      path: '/return-label/home?scope=scope-1',
      label: '업무로 돌아가기',
    });
  });
});

describe('Canary header entry-point rollout boundary', () => {
  it.each([
    { state: '000', mode: 'baseline', separated: false, compatibility: false },
    { state: '100', mode: 'shadow', separated: false, compatibility: false },
    {
      state: '110',
      mode: 'enforced-compatibility',
      separated: false,
      compatibility: true,
    },
    { state: '111', mode: 'surface-ui', separated: true, compatibility: false },
  ] as const)(
    'keeps the App Management header CTA gated for rollout $state',
    ({ mode, separated, compatibility }) => {
      const runtime = returnLabelRuntime([workContext, managementContext], mode, workDecision);

      expect(runtime.compatibilityNavigation).toBe(compatibility);
      expect(Boolean(runtime.entryPoints)).toBe(separated);
      expect(
        runtime.entryPoints?.filter((entry) => entry.entryKind === 'management-entry') ?? []
      ).toHaveLength(separated ? 1 : 0);
    }
  );
});
