import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ShieldCheck } from 'lucide-react';

import { isAppResourceEntitled } from '@dwp-frontend/shared-utils/auth/app-entitlements';
import { APPROVAL_PRODUCT_MANIFEST } from '../features/approvals/approval-product-manifest';
import { REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG } from './product-page-route-contracts';

import {
  buildProductCanaryLayoutRuntime,
  resolveProductCanaryBoundaryStrategy,
  resolveFirstAllowedCanaryRoute,
  isProductCanaryBoundaryPending,
  preserveProductRouteLocation,
  type ProductCanaryBoundaryStrategy,
} from './product-surface-canary-routes';

import type { ProductSurfaceManifest } from '../components/product-manifest';
import type { ProductSurfaceCanaryAuthority } from '../features/shell/product-surface-canary-runtime';
import type { ProductSurfaceRolloutMode } from '../features/shell/product-surface-canary-runtime';
import type { RegisteredProductRoute } from './product-route-contract-source';
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
    expect(source.match(/boundaryKind="exact-route"/g)).toHaveLength(1);
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

const returnLabelRoutes: readonly RegisteredProductRoute[] = [
  {
    routeKind: 'PAGE',
    routeId: 'return-label.work.home',
    routeContractKey: 'route.return-label.work.home.page',
    productId: 'return-label',
    surfaceId: 'return-label.work',
    pattern: '/return-label/home',
  },
  {
    routeKind: 'PAGE',
    routeId: 'return-label.admin.operations',
    routeContractKey: 'route.return-label.admin.operations.page',
    productId: 'return-label',
    surfaceId: 'return-label.admin',
    pattern: '/return-label/admin/operations',
  },
  {
    routeKind: 'PAGE',
    routeId: 'return-label.admin.home',
    routeContractKey: 'route.return-label.admin.home.page',
    productId: 'return-label',
    surfaceId: 'return-label.admin',
    pattern: '/return-label/admin',
  },
];

describe('Canary Surface index scope routing', () => {
  it('selects an allowed child whose exact scope matches the requested canonical scope', () => {
    const scope2 = {
      ...contextScope,
      key: 'scope-2',
      displayName: 'Scope 2',
      isDefault: false,
    };
    const canonicalContext: EffectiveProductSurfaceContext = {
      ...managementContext,
      scopes: [contextScope, scope2],
    };
    const scope1Decision: AllowedSurfaceDecision = {
      ...managementDecision,
      context: {
        ...managementContext,
        contextKey: 'management-route-scope-1',
        scopes: [contextScope],
      },
      scope: contextScope,
    };
    const scope2Decision: AllowedSurfaceDecision = {
      ...managementDecision,
      context: {
        ...managementContext,
        contextKey: 'management-route-scope-2',
        scopes: [scope2],
      },
      scope: scope2,
    };
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
        contexts: [canonicalContext],
      },
      routeDecisions: {
        'route.return-label.admin.operations.page': scope1Decision,
        'route.return-label.admin.home.page': scope2Decision,
      },
    };
    const candidates = [
      {
        routeContractKey: 'route.return-label.admin.operations.page',
        path: '/return-label/admin/operations',
      },
      {
        routeContractKey: 'route.return-label.admin.home.page',
        path: '/return-label/admin/home',
      },
    ] as const;

    expect(
      resolveFirstAllowedCanaryRoute(authority, {
        productId: 'return-label',
        surfaceId: 'return-label.admin',
        candidates,
      })
    ).toBe('/return-label/admin/operations');
    expect(
      resolveFirstAllowedCanaryRoute(authority, {
        productId: 'return-label',
        surfaceId: 'return-label.admin',
        candidates,
        requestedScopeKey: 'scope-2',
      })
    ).toBe('/return-label/admin/home');
  });
});

function returnLabelRuntime(
  contexts: readonly EffectiveProductSurfaceContext[],
  rolloutMode: ProductSurfaceRolloutMode = 'surface-ui',
  decision: AllowedSurfaceDecision = managementDecision
) {
  const surfaceDecisions = Object.fromEntries(
    contexts.map((context) => [
      context.surfaceKey,
      {
        ...managementDecision,
        context,
        routeGrantRef: `${context.surfaceKey}.page`,
        scope: context.scopes[0]!,
        effectiveReadOnly: context.scopes[0]!.readOnly,
        revalidateAt: context.revalidateAt,
      },
    ])
  ) as Record<string, AllowedSurfaceDecision>;
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
    surfaceDecisions,
    routeDecisions: Object.fromEntries(
      returnLabelRoutes.flatMap((route) => {
        const routeDecision = surfaceDecisions[route.surfaceId];
        return routeDecision ? [[route.routeContractKey, routeDecision] as const] : [];
      })
    ),
  };
  return buildProductCanaryLayoutRuntime({
    authority,
    manifest: returnLabelManifest,
    decision,
    label: '관리',
    returnLabels: { work: '업무로 돌아가기', catalog: '앱 목록으로 돌아가기' },
    registeredRoutes: returnLabelRoutes,
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
      separated: true,
      compatibility: true,
    },
    { state: '111', mode: 'surface-ui', separated: true, compatibility: false },
  ] as const)(
    'builds the trusted App Management header CTA for enforced rollout $state',
    ({ mode, separated, compatibility }) => {
      const runtime = returnLabelRuntime([workContext, managementContext], mode, workDecision);

      expect(runtime.compatibilityNavigation).toBe(compatibility);
      expect(Boolean(runtime.entryPoints)).toBe(separated);
      expect(
        runtime.entryPoints?.filter((entry) => entry.entryKind === 'management-entry') ?? []
      ).toHaveLength(separated ? 1 : 0);
    }
  );

  const scopeSelectionManifest: ProductSurfaceManifest = {
    ...returnLabelManifest,
    surfaces: returnLabelManifest.surfaces.map((surface) =>
      surface.id === 'return-label.admin'
        ? {
            ...surface,
            navigation: [
              {
                id: 'administration',
                items: [
                  {
                    path: '/return-label/admin',
                    view: 'admin-home',
                    icon: ShieldCheck,
                    taskKind: 'administration',
                    access: {
                      type: 'policy',
                      accessPolicyKey: 'return-label.admin.entry',
                    },
                  },
                ],
              },
            ],
          }
        : surface
    ) as unknown as ProductSurfaceManifest['surfaces'],
  };
  const alternateManagementScope = {
    ...contextScope,
    key: 'scope-2',
    displayName: 'Scope 2',
    isDefault: false,
  };
  const selectableManagementContext: EffectiveProductSurfaceContext = {
    ...managementContext,
    scopes: [{ ...contextScope, isDefault: false }, alternateManagementScope],
    effectiveGrants: [
      {
        grantKind: 'POLICY',
        accessPolicyKey: 'return-label.admin.entry',
        authorityMode: 'ENTITLEMENT',
        policyDecisionRef: 'policy-decision-1',
        scopeKeys: ['scope-1', 'scope-2'],
        requiresProductEntitlement: false,
        readOnly: false,
      },
    ],
  };

  function scopeSelectionRuntime(
    rolloutMode: ProductSurfaceRolloutMode,
    options: {
      managementContexts?: readonly EffectiveProductSurfaceContext[];
      managementDecision?:
        | { state: 'scope-selection-required'; detail?: { decisionRevision?: string } }
        | { state: 'route-denied' };
    } = {}
  ) {
    const managementContexts = options.managementContexts ?? [selectableManagementContext];
    const authority: ProductSurfaceCanaryAuthority = {
      flags: {
        contextShadow: true,
        capabilityEnforcement: true,
        surfaceUi: rolloutMode === 'surface-ui',
        surfaceUiEvaluation: 'resolved',
      },
      serverNowMs: Date.parse('2029-01-01T00:00:00Z'),
      envelope: {
        contractVersion: '1',
        decisionRevision: 'revision-envelope',
        sourceRevisions: {},
        activeAccessMode: 'NORMAL',
        generatedAt: '2029-01-01T00:00:00Z',
        contexts: [workContext, ...managementContexts],
      },
      routeDecisions: {
        'route.return-label.work.home.page': workDecision,
        'route.return-label.admin.operations.page': { state: 'route-denied' },
        'route.return-label.admin.home.page': options.managementDecision ?? {
          state: 'scope-selection-required',
          detail: { decisionRevision: 'revision-scope-selection' },
        },
      },
    };
    return buildProductCanaryLayoutRuntime({
      authority,
      manifest: scopeSelectionManifest,
      decision: workDecision,
      label: '업무',
      returnLabels: { work: '업무로 돌아가기', catalog: '앱 목록으로 돌아가기' },
      registeredRoutes: returnLabelRoutes,
      rolloutMode,
    });
  }

  it.each(['enforced-compatibility', 'surface-ui'] as const)(
    'keeps one scope-selection App Management entry in %s without inventing a scope',
    (rolloutMode) => {
      const entries = scopeSelectionRuntime(rolloutMode).entryPoints?.filter(
        (entry) => entry.entryKind === 'management-entry'
      );
      expect(entries).toEqual([
        expect.objectContaining({
          surfaceId: 'return-label.admin',
          path: '/return-label/admin',
          contextScopeKey: undefined,
          requiresScopeSelection: true,
        }),
      ]);
    }
  );

  it.each([
    {
      name: 'duplicate canonical context',
      contexts: [
        selectableManagementContext,
        { ...selectableManagementContext, contextKey: 'management-context-duplicate' },
      ],
    },
    {
      name: 'expired context',
      contexts: [{ ...selectableManagementContext, revalidateAt: '2028-01-01T00:00:00Z' }],
    },
    {
      name: 'unsupported scope',
      contexts: [
        {
          ...selectableManagementContext,
          scopes: [
            selectableManagementContext.scopes[0]!,
            { ...alternateManagementScope, kind: 'SELF' as const },
          ],
        },
      ],
    },
    {
      name: 'duplicate scope key',
      contexts: [
        {
          ...selectableManagementContext,
          scopes: [
            selectableManagementContext.scopes[0]!,
            { ...alternateManagementScope, key: 'scope-1' },
          ],
        },
      ],
    },
  ])('fails closed for a $name scope-selection context', ({ contexts }) => {
    expect(
      scopeSelectionRuntime('surface-ui', { managementContexts: contexts }).entryPoints?.filter(
        (entry) => entry.entryKind === 'management-entry'
      )
    ).toEqual([]);
  });

  it.each([
    {
      name: 'blank direct revision',
      decision: {
        state: 'scope-selection-required' as const,
        detail: { decisionRevision: '' },
      },
    },
    { name: 'route denial', decision: { state: 'route-denied' as const } },
  ])('fails closed for $name instead of disclosing App Management', ({ decision }) => {
    expect(
      scopeSelectionRuntime('surface-ui', { managementDecision: decision }).entryPoints?.filter(
        (entry) => entry.entryKind === 'management-entry'
      )
    ).toEqual([]);
  });

  it('builds one App Management transition from trusted route-specific contexts', () => {
    const entryWorkContext: EffectiveProductSurfaceContext = {
      ...workContext,
      contextKey: 'entry-work-context',
      scopes: [
        { ...workContext.scopes[0]!, isDefault: false, readOnly: true },
        {
          key: 'scope-management-alternative',
          kind: 'RESOURCE_SET',
          displayName: 'Management alternative',
          isDefault: false,
          readOnly: false,
        },
      ],
    };
    const directWorkContext: EffectiveProductSurfaceContext = {
      ...workContext,
      contextKey: 'route-work-context',
    };
    const entryManagementContext: EffectiveProductSurfaceContext = {
      ...managementContext,
      appResourceKey: 'ADMIN.RETURN_LABEL.DESIGN',
      scopes: [
        { ...contextScope, key: 'scope-design', displayName: 'Design scope' },
        {
          ...contextScope,
          key: 'scope-operations',
          displayName: 'Operations scope',
          isDefault: false,
        },
      ],
    };
    const exactEntryManagementContext: EffectiveProductSurfaceContext = {
      ...managementContext,
      contextKey: 'route-management-entry-context',
      appResourceKey: 'ADMIN.RETURN_LABEL.DESIGN',
      scopes: [{ ...contextScope, key: 'scope-design', displayName: 'Design scope' }],
    };
    const siblingManagementContext: EffectiveProductSurfaceContext = {
      ...managementContext,
      contextKey: 'route-management-sibling-context',
      appResourceKey: 'ADMIN.RETURN_LABEL.OPERATIONS',
      scopes: [{ ...contextScope, key: 'scope-operations', displayName: 'Operations scope' }],
    };
    const directWorkDecision: AllowedSurfaceDecision = {
      ...workDecision,
      context: directWorkContext,
      scope: directWorkContext.scopes[0]!,
    };
    const exactEntryManagementDecision: AllowedSurfaceDecision = {
      ...managementDecision,
      context: exactEntryManagementContext,
      scope: exactEntryManagementContext.scopes[0]!,
    };
    const siblingManagementDecision: AllowedSurfaceDecision = {
      ...managementDecision,
      context: siblingManagementContext,
      scope: siblingManagementContext.scopes[0]!,
    };
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
        contexts: [entryWorkContext, entryManagementContext],
      },
      surfaceDecisions: {
        'return-label.work': directWorkDecision,
        'return-label.admin': exactEntryManagementDecision,
      },
      routeDecisions: {
        'route.return-label.work.home.page': directWorkDecision,
        'route.return-label.admin.operations.page': siblingManagementDecision,
        'route.return-label.admin.home.page': exactEntryManagementDecision,
      },
    };

    const runtime = buildProductCanaryLayoutRuntime({
      authority,
      manifest: returnLabelManifest,
      decision: directWorkDecision,
      label: '업무',
      returnLabels: { work: '업무로 돌아가기', catalog: '앱 목록으로 돌아가기' },
      registeredRoutes: returnLabelRoutes,
      rolloutMode: 'surface-ui',
    });

    expect(runtime.entryPoints).toHaveLength(2);
    expect(runtime.entryPoints?.filter((entry) => entry.entryKind === 'management-entry')).toEqual([
      expect.objectContaining({
        surfaceId: 'return-label.admin',
        path: '/return-label/admin?scope=scope-design',
      }),
    ]);
  });

  it('falls back from denied workflows to the exact allowed forms PAGE and scope', () => {
    const workScope = {
      key: 'scope-self',
      kind: 'SELF' as const,
      displayName: 'Self',
      isDefault: true,
      readOnly: false,
    };
    const formsScope = {
      key: 'scope-forms',
      kind: 'RESOURCE_SET' as const,
      displayName: 'Forms',
      isDefault: true,
      readOnly: false,
    };
    const approvalsWorkContext: EffectiveProductSurfaceContext = {
      contextKey: 'approvals-work-entry',
      productKey: 'approvals',
      surfaceKey: 'approvals.work',
      plane: 'work',
      accessMode: 'NORMAL',
      accessSource: 'ENTITLEMENT',
      appResourceKey: 'APP.APPROVALS',
      effectiveGrants: [],
      scopes: [workScope],
      revalidateAt: '2030-01-01T00:00:00Z',
    };
    const approvalsAdminEntryContext: EffectiveProductSurfaceContext = {
      contextKey: 'approvals-admin-entry',
      productKey: 'approvals',
      surfaceKey: 'approvals.admin',
      plane: 'management',
      accessMode: 'NORMAL',
      accessSource: 'MANAGEMENT',
      appResourceKey: 'ADMIN.APPROVAL_DESIGN',
      effectiveGrants: [],
      scopes: [formsScope],
      revalidateAt: '2030-01-01T00:00:00Z',
    };
    const workDirectContext = {
      ...approvalsWorkContext,
      contextKey: 'approvals-work-home-direct',
    };
    const formsDirectContext = {
      ...approvalsAdminEntryContext,
      contextKey: 'approvals-admin-forms-direct',
      appResourceKey: 'ADMIN.APPROVAL_FORMS',
    };
    const workDirectDecision: AllowedSurfaceDecision = {
      state: 'allowed',
      context: workDirectContext,
      routeGrantRef: 'approvals.member-entry.v1',
      scope: workScope,
      effectiveReadOnly: false,
      revalidateAt: workDirectContext.revalidateAt,
      decisionRevision: 'revision-work-home',
    };
    const formsDirectDecision: AllowedSurfaceDecision = {
      state: 'allowed',
      context: formsDirectContext,
      routeGrantRef: 'approvals.form.read',
      scope: formsScope,
      effectiveReadOnly: false,
      revalidateAt: formsDirectContext.revalidateAt,
      decisionRevision: 'revision-admin-forms',
    };
    const approvalsRoutes = REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG.filter(
      (route) => route.routeKind === 'PAGE' && route.productId === 'approvals'
    );
    const routeByPath = (path: string) =>
      approvalsRoutes.find((route) => route.pattern === path)!.routeContractKey;
    const authority: ProductSurfaceCanaryAuthority = {
      flags: {
        contextShadow: true,
        capabilityEnforcement: true,
        surfaceUi: true,
        surfaceUiEvaluation: 'resolved',
      },
      serverNowMs: Date.parse('2029-01-01T00:00:00Z'),
      envelope: {
        contractVersion: 'product-surfaces/v3',
        decisionRevision: 'revision-list',
        sourceRevisions: {},
        activeAccessMode: 'NORMAL',
        generatedAt: '2029-01-01T00:00:00Z',
        contexts: [approvalsWorkContext, approvalsAdminEntryContext],
      },
      routeDecisions: {
        [routeByPath('/approvals/home')]: workDirectDecision,
        [routeByPath('/approvals/admin/workflows')]: { state: 'route-denied' },
        [routeByPath('/approvals/admin/forms')]: formsDirectDecision,
      },
    };

    const runtime = buildProductCanaryLayoutRuntime({
      authority,
      manifest: APPROVAL_PRODUCT_MANIFEST,
      decision: workDirectDecision,
      label: 'Approvals',
      returnLabels: { work: 'Back to work', catalog: 'Back to apps' },
      registeredRoutes: approvalsRoutes,
      rolloutMode: 'surface-ui',
    });

    expect(runtime.entryPoints?.filter((entry) => entry.entryKind === 'management-entry')).toEqual([
      expect.objectContaining({
        surfaceId: 'approvals.admin',
        path: '/approvals/admin/forms?scope=scope-forms',
        contextKey: 'approvals-admin-forms-direct',
        contextScopeKey: 'scope-forms',
      }),
    ]);
  });
});
