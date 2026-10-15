import { describe, expect, it } from 'vitest';

import {
  explorerReceiptNeedsReconciliation,
  explorerReceiptsShareImmutableContext,
  hrisReceiptProjectionsShareImmutableContext,
  nextExplorerFavoriteRouteKeys,
  parseExplorerReceipt,
  parseHrisReceiptProjection,
  parseHrisExplorerResponse,
} from './work-explorer-contract';

const ID = '11111111-1111-4111-8111-111111111111';
const NOW = '2026-10-15T06:00:00Z';
const HASH = 'a'.repeat(64);

function route(overrides: Record<string, unknown> = {}) {
  return {
    routeKey: 'hris.explorer.team-time',
    target: { kind: 'HRIS_INTERNAL', path: '/hr/team/time' },
    labelKey: 'hris.explorer.routes.team-time',
    module: 'TIM',
    workbench: 'TEAM',
    authorization: {
      routeContractKey: 'route.hcm.team.time.page',
      capabilityMode: 'SINGLE',
      capabilityKeys: ['hcm.team.time.read'],
    },
    ...overrides,
  };
}

function response(overrides: Record<string, unknown> = {}) {
  return {
    asOf: NOW,
    projectionRevision: 7,
    entitlementRevision: 8,
    favoritePreferenceRevision: 3,
    routes: [route()],
    favorites: [{ ...route(), position: 1 }],
    recents: [
      {
        ...route(),
        lastVisitedAt: NOW,
        expiresAt: '2026-11-14T06:00:00Z',
      },
    ],
    inProgress: [
      {
        activityId: ID,
        sourceKind: 'APPROVAL_CASE',
        module: 'TIM',
        state: 'WAITING_FOR_ME',
        sourceRevision: 2,
        updatedAt: NOW,
        target: { kind: 'HRIS_INTERNAL', path: '/hr/team/time?tab=approvals' },
      },
    ],
    nextCursor: null,
    projectionStatus: { state: 'FRESH', degradedSources: [] },
    policy: {
      maxFavorites: 20,
      maxRecents: 20,
      recentTtlDays: 30,
      maxInProgress: 20,
      entitlementRefilter: true,
      cleanupMode: 'READ_AND_WRITE_THROUGH_PURGE',
    },
    ...overrides,
  };
}

function receipt(overrides: Record<string, unknown> = {}) {
  return {
    receiptId: ID,
    commandType: 'EXPLORER_RECENT_RECORD',
    originatingAction: 'EXPLORER_RECENT_RECORD',
    subjectPrincipalPublicId: '22222222-2222-4222-8222-222222222222',
    populationScopeDigest: HASH,
    fieldPolicyRevision: 4,
    purposeCode: 'HRIS_APP_DISCOVERY',
    authorizationRevision: 5,
    status: 'RESULT_UNKNOWN',
    correlationId: '33333333-3333-4333-8333-333333333333',
    requestDigest: HASH,
    createdAt: NOW,
    ...overrides,
  };
}

function platformReceipt(overrides: Record<string, unknown> = {}) {
  return {
    receiptId: ID,
    commandType: 'REFERENCE_CONFIGURATION_PUBLISH',
    originatingAction: 'HRIS_REFERENCE_CONFIGURATION_PUBLISH',
    subjectPrincipalPublicId: '22222222-2222-4222-8222-222222222222',
    populationScopeDigest: HASH,
    fieldPolicyRevision: 4,
    purposeCode: 'HRIS_SYSTEM_ADMIN',
    authorizationRevision: 5,
    status: 'RESULT_UNKNOWN',
    correlationId: '33333333-3333-4333-8333-333333333333',
    requestDigest: HASH,
    createdAt: NOW,
    ...overrides,
  };
}

describe('HRIS Work Explorer closed transport', () => {
  it('accepts the exact minimized V2 projection and receipt profile', () => {
    expect(parseHrisExplorerResponse(response())).toMatchObject({
      routes: [{ routeKey: 'hris.explorer.team-time' }],
      favorites: [{ position: 1 }],
      inProgress: [{ sourceKind: 'APPROVAL_CASE' }],
    });
    expect(parseExplorerReceipt(receipt())).toMatchObject({
      commandType: 'EXPLORER_RECENT_RECORD',
      status: 'RESULT_UNKNOWN',
    });
    expect(parseHrisReceiptProjection(receipt())).toMatchObject({
      profile: 'EXPLORER',
      receipt: { commandType: 'EXPLORER_RECENT_RECORD' },
    });
  });

  it('decodes the closed platform-origin receipt profile without weakening Explorer identity', () => {
    const pending = parseHrisReceiptProjection(platformReceipt());
    const succeeded = parseHrisReceiptProjection(platformReceipt({ status: 'SUCCEEDED' }));
    expect(pending).toMatchObject({
      profile: 'PLATFORM',
      receipt: {
        commandType: 'REFERENCE_CONFIGURATION_PUBLISH',
        originatingAction: 'HRIS_REFERENCE_CONFIGURATION_PUBLISH',
        purposeCode: 'HRIS_SYSTEM_ADMIN',
        status: 'RESULT_UNKNOWN',
      },
    });
    expect(hrisReceiptProjectionsShareImmutableContext(pending, succeeded)).toBe(true);
    expect(
      hrisReceiptProjectionsShareImmutableContext(pending, {
        profile: 'EXPLORER',
        receipt: parseExplorerReceipt(receipt()),
      })
    ).toBe(false);

    expect(() => parseHrisReceiptProjection(platformReceipt({ undisclosed: true }))).toThrow();
    expect(() => parseHrisReceiptProjection(platformReceipt({ purposeCode: 'NO' }))).toThrow();
    expect(() =>
      parseHrisReceiptProjection(platformReceipt({ originatingAction: 'x'.repeat(129) }))
    ).toThrow();
    expect(() =>
      parseHrisReceiptProjection(
        platformReceipt({ authorizationRevision: Number.MAX_SAFE_INTEGER + 1 })
      )
    ).toThrow();
    expect(() =>
      parseHrisReceiptProjection(
        platformReceipt({ commandType: 'EXPLORER_RECENT_RECORD', purposeCode: 'HRIS_SYSTEM_ADMIN' })
      )
    ).toThrow();
  });

  it.each([
    ['/admin', 'generic admin'],
    ['/admin/experience/branding?product=HCM', 'withheld DWP control target'],
    ['/hrish/people', 'near-prefix HRIS target'],
  ])('rejects unsafe target %s (%s)', (path) => {
    const target = path.startsWith('/admin')
      ? { kind: 'DWP_CONTROL', path }
      : { kind: 'HRIS_INTERNAL', path };
    expect(() => parseHrisExplorerResponse(response({ routes: [route({ target })] }))).toThrow();
  });

  it('accepts only the currently operational DWP audit target', () => {
    const governance = route({
      routeKey: 'hris.explorer.dwp-governance',
      labelKey: 'hris.explorer.routes.dwp-governance',
      module: 'SYS',
      workbench: 'SETTINGS',
      target: {
        kind: 'DWP_CONTROL',
        path: '/admin/governance/audit-overview?product=HCM',
      },
      authorization: {
        routeContractKey: 'route.hcm.audit.evidence.page',
        capabilityMode: 'SINGLE',
        capabilityKeys: ['hcm.audit.evidence.view'],
      },
    });
    expect(
      parseHrisExplorerResponse(
        response({ routes: [governance], favorites: [], recents: [], inProgress: [] })
      ).routes[0]?.target
    ).toEqual({
      kind: 'DWP_CONTROL',
      path: '/admin/governance/audit-overview?product=HCM',
    });
    expect(() =>
      parseHrisExplorerResponse(
        response({
          routes: [
            {
              ...governance,
              authorization: {
                routeContractKey: 'route.hcm.team.time.page',
                capabilityMode: 'SINGLE',
                capabilityKeys: ['hcm.team.time.read'],
              },
            },
          ],
          favorites: [],
          recents: [],
          inProgress: [],
        })
      )
    ).toThrow();
  });

  it('validates favorites and recents independently from a filtered route page', () => {
    const favorite = {
      ...route({
        routeKey: 'hris.explorer.my-employment-documents',
        labelKey: 'hris.explorer.routes.my-employment-documents',
        target: { kind: 'HRIS_INTERNAL', path: '/hr/me/employment-documents' },
      }),
      position: 1,
    };
    const recent = {
      ...route({
        routeKey: 'hris.explorer.hr-employee-change-requests',
        labelKey: 'hris.explorer.routes.hr-employee-change-requests',
        target: {
          kind: 'HRIS_INTERNAL',
          path: '/hr/operations/people/employee-change-requests',
        },
      }),
      lastVisitedAt: NOW,
      expiresAt: '2026-11-14T06:00:00Z',
    };

    expect(
      parseHrisExplorerResponse(response({ routes: [], favorites: [favorite], recents: [recent] }))
    ).toMatchObject({
      routes: [],
      favorites: [{ routeKey: favorite.routeKey }],
      recents: [{ routeKey: recent.routeKey }],
    });
  });

  it('orders favorites by their wire position and rejects gaps or duplicates', () => {
    const second = {
      ...route({
        routeKey: 'hris.explorer.my-employment-documents',
        labelKey: 'hris.explorer.routes.my-employment-documents',
        target: { kind: 'HRIS_INTERNAL', path: '/hr/me/employment-documents' },
      }),
      position: 2,
    };
    const first = { ...route(), position: 1 };

    expect(
      parseHrisExplorerResponse(response({ favorites: [second, first] })).favorites.map(
        (favorite) => favorite.routeKey
      )
    ).toEqual([first.routeKey, second.routeKey]);
    expect(() =>
      parseHrisExplorerResponse(
        response({
          favorites: [
            { ...first, position: 1 },
            { ...second, position: 3 },
          ],
        })
      )
    ).toThrow();
  });

  it('never silently turns a 20-to-21 favorite request into an unchanged command', () => {
    const full = Array.from({ length: 20 }, (_, index) => `hris.explorer.route-${index}`);
    expect(nextExplorerFavoriteRouteKeys(full, 'hris.explorer.route-20', 20)).toBeNull();
    expect(nextExplorerFavoriteRouteKeys(full, 'hris.explorer.route-19', 20)).toHaveLength(19);
  });

  it('rejects extra source payload fields, identity drift, and scalar capability authority', () => {
    expect(() =>
      parseHrisExplorerResponse(
        response({
          inProgress: [
            {
              ...(response().inProgress as Record<string, unknown>[])[0],
              requestPayload: { workerIdentifier: 'secret' },
            },
          ],
        })
      )
    ).toThrow();
    expect(() =>
      parseHrisExplorerResponse(
        response({ routes: [route({ labelKey: 'hris.explorer.routes.team-members' })] })
      )
    ).toThrow();
    expect(() =>
      parseHrisExplorerResponse(
        response({
          routes: [
            route({
              authorization: {
                routeContractKey: 'route.hcm.team.time.page',
                capabilityMode: 'SINGLE',
                capabilityKey: 'hcm.team.time.read',
              },
            }),
          ],
        })
      )
    ).toThrow();
  });

  it('rejects an explorer receipt whose originating action differs from its command', () => {
    expect(() =>
      parseExplorerReceipt(
        receipt({
          originatingAction: 'EXPLORER_PREFERENCES_REPLACE',
        })
      )
    ).toThrow();
  });

  it('never infers command success from a nonterminal or unknown receipt', () => {
    expect(explorerReceiptNeedsReconciliation('ACCEPTED')).toBe(true);
    expect(explorerReceiptNeedsReconciliation('RUNNING')).toBe(true);
    expect(explorerReceiptNeedsReconciliation('RESULT_UNKNOWN')).toBe(true);
    expect(explorerReceiptNeedsReconciliation('SUCCEEDED')).toBe(false);
    expect(explorerReceiptNeedsReconciliation('FAILED')).toBe(false);
    expect(explorerReceiptNeedsReconciliation('REJECTED')).toBe(false);
  });

  it.each([
    ['receiptId', '44444444-4444-4444-8444-444444444444'],
    ['commandType', 'EXPLORER_PREFERENCES_REPLACE'],
    ['originatingAction', 'EXPLORER_PREFERENCES_REPLACE'],
    ['subjectPrincipalPublicId', '55555555-5555-4555-8555-555555555555'],
    ['populationScopeDigest', 'b'.repeat(64)],
    ['fieldPolicyRevision', 9],
    ['purposeCode', 'COMMAND_STATUS'],
    ['authorizationRevision', 9],
    ['correlationId', '66666666-6666-4666-8666-666666666666'],
    ['requestDigest', 'c'.repeat(64)],
    ['createdAt', '2026-10-15T06:00:01Z'],
  ] as const)('rejects reconciled receipt immutable-context drift in %s', (field, value) => {
    const pending = parseExplorerReceipt(receipt());
    const reconciled = { ...pending, status: 'SUCCEEDED' as const, [field]: value };
    expect(explorerReceiptsShareImmutableContext(pending, reconciled)).toBe(false);
  });

  it('accepts only status/result evolution within the same receipt context', () => {
    const pending = parseExplorerReceipt(receipt());
    expect(
      explorerReceiptsShareImmutableContext(pending, {
        ...pending,
        status: 'SUCCEEDED',
        aggregateVersion: 8,
        resultRef: '/hr/me/employment-documents',
      })
    ).toBe(true);
  });
});
