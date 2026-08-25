import { describe, expect, it } from 'vitest';

import {
  resolveCanaryAccessActionKinds,
  resolveCanarySafeReturnPath,
} from './product-canary-access-state';

import type { ProductSurfaceCanaryAuthority } from '../features/shell/product-surface-canary-runtime';
import type { AllowedSurfaceDecision } from '../features/shell/product-surface-context';

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
    expect(resolveCanarySafeReturnPath(authority, 'approvals', 'approvals.admin')).toBe(
      '/approvals/inbox?scope=scope%3Aapprovals%3Aself'
    );
  });

  it('returns management-only and unknown product denials to the catalog', () => {
    expect(
      resolveCanarySafeReturnPath(
        { ...authority, routeDecisions: {}, lastAllowedWorkRouteIds: {} },
        'approvals',
        'approvals.admin'
      )
    ).toBe('/apps');
    expect(resolveCanarySafeReturnPath(authority, 'unknown', 'unknown.admin')).toBe('/apps');
  });
});
