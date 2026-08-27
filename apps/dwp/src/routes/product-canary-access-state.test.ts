import { describe, expect, it } from 'vitest';

import {
  resolveCanaryAccessActionKinds,
  resolveCanarySafeReturnPath,
  resolveCanarySelectableScopes,
} from './product-canary-access-state';

import type { ProductSurfaceCanaryAuthority } from '../features/shell/product-surface-canary-runtime';
import type { AllowedSurfaceDecision } from '../features/shell/product-surface-context';
import { APPROVAL_PRODUCT_MANIFEST } from '../features/approvals/approval-product-manifest';
import { REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG } from './product-page-route-contracts';

describe('Canary typed access-state actions', () => {
  it('never offers an access request for unknown or unavailable authority', () => {
    expect([
      ...resolveCanaryAccessActionKinds({ state: 'authority-unavailable' }, true, true),
    ]).toEqual(['return', 'retry']);
    expect([
      ...resolveCanaryAccessActionKinds({ state: 'route-denied' }, true, true, true),
    ]).toEqual(['return', 'request-responsibility']);
  });

  it('offers only safe state-specific actions', () => {
    expect([...resolveCanaryAccessActionKinds({ state: 'app-denied' }, false, true)]).toEqual([
      'return',
      'request-access',
    ]);
    expect([
      ...resolveCanaryAccessActionKinds({ state: 'scope-selection-required' }, true, true),
    ]).toEqual(['return', 'select-scope']);
    expect([
      ...resolveCanaryAccessActionKinds({ state: 'surface-denied' }, true, true, true),
    ]).toEqual(['return', 'request-responsibility']);
    expect([...resolveCanaryAccessActionKinds({ state: 'expired' }, true, true, true)]).toEqual([
      'return',
      'request-responsibility',
    ]);
    expect([
      ...resolveCanaryAccessActionKinds({ state: 'activation-required' }, true, true),
    ]).toEqual(['return', 'activate-access']);
  });

  it('never turns a Work route denial into an app-management responsibility request', () => {
    expect([
      ...resolveCanaryAccessActionKinds({ state: 'route-denied' }, true, true, false),
    ]).toEqual(['return']);
  });
});

describe('Canary access-state safe return', () => {
  const scope = {
    key: 'scope:approvals:self',
    kind: 'SELF' as const,
    displayName: '내 결재',
    isDefault: true,
    readOnly: false,
  };
  const context = {
    contextKey: 'approvals-work-context',
    productKey: 'approvals',
    surfaceKey: 'approvals.work',
    plane: 'work' as const,
    accessMode: 'NORMAL' as const,
    accessSource: 'ENTITLEMENT' as const,
    appResourceKey: 'APP.APPROVALS',
    effectiveGrants: [],
    scopes: [scope],
    revalidateAt: '2030-01-01T00:00:00Z',
  };
  const allowedInbox: AllowedSurfaceDecision = {
    state: 'allowed',
    context,
    routeGrantRef: 'approvals.work.inbox',
    scope,
    effectiveReadOnly: false,
    revalidateAt: context.revalidateAt,
    decisionRevision: 'revision-1',
  };
  const authority = {
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
      contexts: [context],
    },
    routeDecisions: { 'route.approvals.work.inbox.page': allowedInbox },
    lastAllowedWorkRouteIds: { 'approvals.work': 'approvals.work.inbox' },
  } satisfies ProductSurfaceCanaryAuthority;

  it('returns management denials to the last allowed registered Work route', () => {
    expect(
      resolveCanarySafeReturnPath(
        authority,
        'approvals',
        'approvals.admin',
        APPROVAL_PRODUCT_MANIFEST,
        REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG
      )
    ).toBe('/approvals/inbox?scope=scope%3Aapprovals%3Aself');
  });

  it('returns management-only and unknown product denials to the catalog', () => {
    expect(
      resolveCanarySafeReturnPath(
        { ...authority, routeDecisions: {}, lastAllowedWorkRouteIds: {} },
        'approvals',
        'approvals.admin',
        APPROVAL_PRODUCT_MANIFEST,
        REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG
      )
    ).toBe('/apps');
    expect(resolveCanarySafeReturnPath(authority, 'unknown', 'unknown.admin')).toBe('/apps');
  });
});

describe('Canary access-state scope chooser', () => {
  const serverNowMs = Date.parse('2029-01-01T00:00:00Z');
  const scopes = [
    {
      key: 'scope:approvals:eligible',
      kind: 'RESOURCE_SET' as const,
      displayName: 'Eligible',
      isDefault: false,
      readOnly: false,
    },
    {
      key: 'scope:approvals:unrelated',
      kind: 'RESOURCE_SET' as const,
      displayName: 'Unrelated',
      isDefault: false,
      readOnly: false,
    },
  ];
  const context = {
    contextKey: 'approvals-admin-context',
    productKey: 'approvals',
    surfaceKey: 'approvals.admin',
    plane: 'management' as const,
    accessMode: 'NORMAL' as const,
    accessSource: 'MANAGEMENT' as const,
    appResourceKey: 'ADMIN.APPROVALS',
    effectiveGrants: [
      {
        grantKind: 'CAPABILITY' as const,
        capabilityContractKey: 'approvals.design.read',
        resolvedCapabilityCode: 'APPROVAL_DESIGN:READ',
        authorityMode: 'PERMISSION' as const,
        responsibilityRequirement: 'NOT_REQUIRED' as const,
        scopeKeys: ['scope:approvals:eligible'],
        requiresProductEntitlement: false,
        readOnly: false,
        activationState: 'ACTIVE',
      },
    ],
    scopes,
    revalidateAt: '2030-01-01T00:00:00Z',
  };
  const authority = {
    flags: {
      contextShadow: true,
      capabilityEnforcement: true,
      surfaceUi: true,
      surfaceUiEvaluation: 'resolved',
    },
    serverNowMs,
    envelope: {
      contractVersion: '1',
      decisionRevision: 'revision-envelope',
      sourceRevisions: {},
      activeAccessMode: 'NORMAL',
      generatedAt: '2029-01-01T00:00:00Z',
      contexts: [context],
    },
  } satisfies ProductSurfaceCanaryAuthority;
  const decision = {
    state: 'scope-selection-required' as const,
    detail: { decisionRevision: 'revision-route' },
  };

  it('offers only scopes eligible for the exact management entry route', () => {
    expect(
      resolveCanarySelectableScopes(
        authority,
        decision,
        'approvals',
        'approvals.admin',
        'route.approvals.admin.forms.page',
        APPROVAL_PRODUCT_MANIFEST,
        REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG
      ).map((scope) => scope.key)
    ).toEqual(['scope:approvals:eligible']);
  });

  it('offers only scopes that can reach at least one registered index destination', () => {
    expect(
      resolveCanarySelectableScopes(
        authority,
        decision,
        'approvals',
        'approvals.admin',
        undefined,
        APPROVAL_PRODUCT_MANIFEST,
        REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG
      ).map((scope) => scope.key)
    ).toEqual(['scope:approvals:eligible']);
  });

  it('fails closed for missing direct decision provenance or duplicate canonical contexts', () => {
    expect(
      resolveCanarySelectableScopes(
        authority,
        { state: 'scope-selection-required' },
        'approvals',
        'approvals.admin',
        'route.approvals.admin.forms.page',
        APPROVAL_PRODUCT_MANIFEST,
        REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG
      )
    ).toEqual([]);
    expect(
      resolveCanarySelectableScopes(
        {
          ...authority,
          envelope: {
            ...authority.envelope,
            contexts: [context, { ...context, contextKey: 'duplicate-context' }],
          },
        },
        decision,
        'approvals',
        'approvals.admin',
        'route.approvals.admin.forms.page',
        APPROVAL_PRODUCT_MANIFEST,
        REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG
      )
    ).toEqual([]);
  });
});
