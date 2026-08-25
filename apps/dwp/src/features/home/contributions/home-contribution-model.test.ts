import { describe, expect, it } from 'vitest';

import {
  buildHomeContributionModel,
  createHomeContributionProvider,
  hasHomeContributionAuthority,
  resolveHomeContributionProvider,
} from './home-contribution-model';

import type { AppEntitlementPermission } from '@dwp-frontend/shared-utils';
import type {
  HomeContributionAuthority,
  HomeContributionInput,
  HomeContributionProviderResult,
} from './home-contribution-types';

const NOW = '2026-08-25T01:00:00.000Z';
const OWNER = {
  source: 'DWP_APPROVAL',
  appKey: 'APP.APPROVAL',
  appLabel: 'Approval',
} as const;

const VIEW_APPROVAL: HomeContributionAuthority = {
  allOf: [
    {
      resourceType: 'APP',
      resourceKey: 'APP.APPROVAL',
      permissionCodes: ['VIEW'],
    },
  ],
};

const ALLOW_APPROVAL: AppEntitlementPermission = {
  resourceType: 'APP',
  resourceKey: 'APP.APPROVAL',
  permissionCode: 'VIEW',
  effect: 'ALLOW',
};

function contribution(overrides: Partial<HomeContributionInput> = {}): HomeContributionInput {
  return {
    id: 'approval-1',
    kind: 'ACTION',
    scope: 'ME',
    priority: 'MEDIUM',
    status: 'READY',
    title: 'Approve deployment',
    description: 'Deployment window closes today.',
    count: 1,
    dueAt: '2026-08-25T05:00:00.000Z',
    deepLink: '/approval/tasks/approval-1',
    dedupeKey: 'approval:approval-1',
    sourceReference: 'approval-1',
    generatedAt: '2026-08-25T00:55:00.000Z',
    freshnessMs: 10 * 60 * 1000,
    privacy: { classification: 'INTERNAL' },
    ...overrides,
  };
}

function providerResult(
  contributions: readonly HomeContributionInput[],
  overrides: Partial<HomeContributionProviderResult> = {}
): HomeContributionProviderResult {
  return {
    providerKey: 'approval',
    owner: OWNER,
    supportedKinds: ['ACTION'],
    state: 'AVAILABLE',
    generatedAt: '2026-08-25T00:55:00.000Z',
    freshnessMs: 10 * 60 * 1000,
    unavailableSources: [],
    contributions,
    ...overrides,
  };
}

describe('Home Contribution provider contract', () => {
  it('normalizes already-fetched typed data without owning a network query', () => {
    const provider = createHomeContributionProvider<{ ids: readonly string[] }>({
      key: 'approval',
      owner: OWNER,
      supportedKinds: ['ACTION'],
      authority: VIEW_APPROVAL,
      freshnessMs: 60_000,
      normalize: (data) => data.ids.map((id) => contribution({ id, sourceReference: id })),
    });

    const result = resolveHomeContributionProvider(
      provider,
      {
        state: 'AVAILABLE',
        generatedAt: '2026-08-25T00:59:00.000Z',
        data: { ids: ['a-1', 'a-2'] },
      },
      { now: NOW, timeZone: 'Asia/Seoul' }
    );

    expect(result).toMatchObject({
      providerKey: 'approval',
      state: 'AVAILABLE',
      authority: VIEW_APPROVAL,
    });
    expect(result.contributions.map((item) => item.id)).toEqual(['a-1', 'a-2']);
    expect(
      resolveHomeContributionProvider(
        provider,
        { state: 'AVAILABLE', generatedAt: NOW, data: { ids: [] } },
        { now: NOW }
      ).state
    ).toBe('EMPTY');
  });

  it('does not invoke adapters for terminal states and contains adapter failures', () => {
    let calls = 0;
    const provider = createHomeContributionProvider<null>({
      key: 'approval',
      owner: OWNER,
      supportedKinds: ['ACTION'],
      freshnessMs: 60_000,
      normalize: () => {
        calls += 1;
        throw new Error('raw provider detail');
      },
    });

    expect(
      resolveHomeContributionProvider(
        provider,
        { state: 'CONFIGURATION_REQUIRED', generatedAt: NOW, data: null },
        { now: NOW }
      )
    ).toMatchObject({ state: 'CONFIGURATION_REQUIRED', contributions: [] });
    expect(calls).toBe(0);

    expect(
      resolveHomeContributionProvider(
        provider,
        { state: 'AVAILABLE', generatedAt: NOW, data: null },
        { now: NOW }
      )
    ).toMatchObject({ state: 'UNAVAILABLE', reason: 'NORMALIZATION_FAILED' });
    expect(calls).toBe(1);
  });
});

describe('Home Contribution authority and provider states', () => {
  it('fails closed for declared authority and lets an explicit DENY win', () => {
    expect(hasHomeContributionAuthority(VIEW_APPROVAL, [])).toBe(false);
    expect(hasHomeContributionAuthority({}, [ALLOW_APPROVAL])).toBe(false);
    expect(hasHomeContributionAuthority(VIEW_APPROVAL, [ALLOW_APPROVAL])).toBe(true);
    expect(
      hasHomeContributionAuthority(VIEW_APPROVAL, [
        ALLOW_APPROVAL,
        { ...ALLOW_APPROVAL, effect: 'DENY' },
      ])
    ).toBe(false);
  });

  it('filters unauthorized providers and unauthorized items before bucketing', () => {
    const providerBlocked = providerResult([contribution()], {
      providerKey: 'blocked-provider',
      authority: VIEW_APPROVAL,
    });
    const itemBlocked = providerResult(
      [
        contribution({
          id: 'restricted-item',
          dedupeKey: 'restricted-item',
          authority: VIEW_APPROVAL,
        }),
      ],
      { providerKey: 'item-provider' }
    );

    const model = buildHomeContributionModel([providerBlocked, itemBlocked], {
      now: NOW,
      permissions: [],
    });

    expect(model.buckets.action).toEqual([]);
    expect(model.providers.map(({ providerKey, state }) => [providerKey, state])).toEqual([
      ['blocked-provider', 'FORBIDDEN'],
      ['item-provider', 'AVAILABLE'],
    ]);
    expect(model.diagnostics).toMatchObject({ receivedCount: 2, unauthorizedCount: 2 });
  });

  it('marks expired provider data stale but preserves terminal source states', () => {
    const stale = providerResult([contribution({ freshnessMs: undefined })], {
      generatedAt: '2026-08-24T00:00:00.000Z',
      freshnessMs: 60_000,
    });
    const unavailable = providerResult([], {
      providerKey: 'calendar',
      owner: { source: 'DWP_CALENDAR', appKey: 'APP.CALENDAR' },
      state: 'UNAVAILABLE',
      generatedAt: '2026-08-20T00:00:00.000Z',
    });

    const model = buildHomeContributionModel([stale, unavailable], {
      now: NOW,
      permissions: [],
    });

    expect(model.providers.map(({ providerKey, state }) => [providerKey, state])).toEqual([
      ['approval', 'STALE'],
      ['calendar', 'UNAVAILABLE'],
    ]);
    expect(model.buckets.action[0].freshness.state).toBe('STALE');
  });

  it('fails freshness closed when a provider source clock is missing or malformed', () => {
    for (const generatedAt of ['', 'not-an-instant']) {
      const model = buildHomeContributionModel(
        [
          providerResult([contribution({ generatedAt })], {
            generatedAt,
            freshnessMs: 60_000,
          }),
        ],
        { now: NOW, permissions: [] }
      );

      expect(model.providers[0]?.state).toBe('STALE');
      expect(model.buckets.action[0]?.freshness).toEqual({ state: 'STALE', expiresAt: null });
    }
  });

  it('derives each purpose state only from providers that support that purpose', () => {
    const availableAction = providerResult([contribution()], {
      providerKey: 'action-source',
      supportedKinds: ['ACTION'],
    });
    const forbiddenAction = providerResult([contribution({ id: 'blocked' })], {
      providerKey: 'restricted-action-source',
      supportedKinds: ['ACTION'],
      authority: VIEW_APPROVAL,
    });
    const unrelatedFailure = providerResult([], {
      providerKey: 'pulse-source',
      supportedKinds: ['PULSE'],
      state: 'UNAVAILABLE',
    });

    const mixed = buildHomeContributionModel([availableAction, forbiddenAction, unrelatedFailure], {
      now: NOW,
      permissions: [],
    });
    expect(mixed.bucketStates).toMatchObject({ action: 'AVAILABLE', pulse: 'UNAVAILABLE' });

    const restricted = buildHomeContributionModel([forbiddenAction], {
      now: NOW,
      permissions: [],
    });
    expect(restricted.bucketStates.action).toBe('RESTRICTED');

    const empty = buildHomeContributionModel(
      [providerResult([], { supportedKinds: ['REQUEST'], state: 'AVAILABLE' })],
      { now: NOW, permissions: [] }
    );
    expect(empty.bucketStates.request).toBe('EMPTY');
    expect(mixed.bucketStates.action).not.toBe(mixed.bucketStates.pulse);

    const emptyWithForbidden = buildHomeContributionModel(
      [
        providerResult([], { supportedKinds: ['REQUEST'], state: 'AVAILABLE' }),
        providerResult([], {
          providerKey: 'restricted-request-source',
          supportedKinds: ['REQUEST'],
          state: 'FORBIDDEN',
        }),
      ],
      { now: NOW, permissions: [] }
    );
    expect(emptyWithForbidden.bucketStates.request).toBe('EMPTY');

    const partialWithForbidden = buildHomeContributionModel(
      [
        providerResult([], { supportedKinds: ['REQUEST'], state: 'PARTIAL' }),
        providerResult([], {
          providerKey: 'restricted-request-source',
          supportedKinds: ['REQUEST'],
          state: 'FORBIDDEN',
        }),
      ],
      { now: NOW, permissions: [] }
    );
    expect(partialWithForbidden.bucketStates.request).toBe('PARTIAL');
  });
});

describe('Home Contribution privacy, dedupe and ranking', () => {
  it('assigns one business object to exactly one purpose bucket deterministically', () => {
    const results = [
      providerResult(
        [
          contribution({
            id: 'generic-action',
            kind: 'ACTION',
            priority: 'CRITICAL',
            title: 'Generic action',
            dueAt: '2026-08-25T02:00:00.000Z',
          }),
        ],
        { providerKey: 'work' }
      ),
      providerResult(
        [
          contribution({
            id: 'direct-response',
            kind: 'RESPONSE',
            priority: 'LOW',
            title: 'Direct response',
            dueAt: '2026-08-25T09:00:00.000Z',
          }),
        ],
        { providerKey: 'approval' }
      ),
      providerResult(
        [contribution({ id: 'tracked-request', kind: 'REQUEST', title: 'Tracked request' })],
        { providerKey: 'request' }
      ),
    ];

    const forward = buildHomeContributionModel(results, { now: NOW, permissions: [] });
    const reverse = buildHomeContributionModel([...results].reverse(), {
      now: NOW,
      permissions: [],
    });

    expect(reverse).toEqual(forward);
    expect(forward.buckets.action).toEqual([]);
    expect(forward.buckets.request).toEqual([]);
    expect(forward.buckets.response).toHaveLength(1);
    expect(forward.buckets.response[0]).toMatchObject({
      id: 'direct-response',
      kind: 'RESPONSE',
      title: 'Direct response',
      priority: 'CRITICAL',
      dueAt: '2026-08-25T02:00:00.000Z',
      duplicateCount: 3,
      route: '/approval/tasks/approval-1',
    });
    expect(forward.diagnostics.deduplicatedCount).toBe(2);
  });

  it('applies the strongest privacy rule across duplicates before exposing content', () => {
    const hiddenDuplicate = providerResult([
      contribution({ privacy: { classification: 'PUBLIC' } }),
      contribution({
        id: 'same-secret',
        privacy: { classification: 'RESTRICTED', minimumRedaction: 'HIDDEN' },
      }),
    ]);
    const restricted = providerResult(
      [
        contribution({
          id: 'payroll-1',
          dedupeKey: 'payroll:1',
          sourceReference: 'employee-1234',
          title: 'Salary adjustment for employee 1234',
          description: 'Sensitive amount',
          deepLink: '/hcm/payroll/employee-1234',
          privacy: {
            classification: 'RESTRICTED',
            redactedTitle: 'Protected HR item',
          },
        }),
      ],
      { providerKey: 'hcm', owner: { source: 'DWP_HCM', appKey: 'APP.HCM' } }
    );

    const model = buildHomeContributionModel([hiddenDuplicate, restricted], {
      now: NOW,
      permissions: [],
    });

    expect(model.diagnostics.hiddenCount).toBe(2);
    expect(model.buckets.action).toHaveLength(1);
    expect(model.buckets.action[0]).toMatchObject({
      title: 'Protected HR item',
      description: null,
      status: 'REDACTED',
      route: '',
      deepLink: '',
      sourceReference: 'REDACTED',
      sourceReferences: [],
      redacted: true,
      privacy: { classification: 'RESTRICTED', redaction: 'COUNT_ONLY' },
    });
    expect(model.buckets.action[0].id).not.toContain('employee-1234');
    expect(model.buckets.action[0].dedupeKey).not.toContain('payroll:1');
  });

  it('keeps title and route but removes detail under TITLE_ONLY redaction', () => {
    const model = buildHomeContributionModel(
      [
        providerResult([
          contribution({
            privacy: { classification: 'CONFIDENTIAL' },
            description: 'Confidential explanation',
          }),
        ]),
      ],
      { now: NOW, permissions: [] }
    );

    expect(model.buckets.action[0]).toMatchObject({
      title: 'Approve deployment',
      description: null,
      route: '/approval/tasks/approval-1',
      redacted: true,
      privacy: { redaction: 'TITLE_ONLY' },
    });
  });

  it('ranks each purpose bucket by priority, due time, scope and freshness', () => {
    const model = buildHomeContributionModel(
      [
        providerResult([
          contribution({
            id: 'high-later',
            dedupeKey: 'high-later',
            priority: 'HIGH',
            dueAt: '2026-08-25T07:00:00.000Z',
          }),
          contribution({
            id: 'critical-team',
            dedupeKey: 'critical-team',
            priority: 'CRITICAL',
            scope: 'TEAM',
            dueAt: '2026-08-26T07:00:00.000Z',
          }),
          contribution({
            id: 'high-earlier',
            dedupeKey: 'high-earlier',
            priority: 'HIGH',
            dueAt: '2026-08-25T03:00:00.000Z',
          }),
        ]),
      ],
      { now: NOW, permissions: [] }
    );

    expect(model.buckets.action.map((item) => item.id)).toEqual([
      'critical-team',
      'high-earlier',
      'high-later',
    ]);
    expect(model.buckets).toMatchObject({
      timeline: [],
      response: [],
      request: [],
      pulse: [],
    });
  });

  it('keeps deduped freshness conservative regardless of provider order', () => {
    const fresh = providerResult(
      [
        contribution({
          id: 'fresh-copy',
          priority: 'LOW',
          generatedAt: '2026-08-25T00:59:00.000Z',
          freshnessMs: 10 * 60 * 1000,
        }),
      ],
      { providerKey: 'fresh-provider' }
    );
    const stale = providerResult(
      [
        contribution({
          id: 'stale-critical-copy',
          priority: 'CRITICAL',
          dueAt: '2026-08-25T02:00:00.000Z',
          generatedAt: '2026-08-24T23:00:00.000Z',
          freshnessMs: 5 * 60 * 1000,
        }),
      ],
      { providerKey: 'stale-provider', state: 'STALE' }
    );

    const forward = buildHomeContributionModel([fresh, stale], { now: NOW, permissions: [] });
    const reverse = buildHomeContributionModel([stale, fresh], { now: NOW, permissions: [] });

    expect(reverse).toEqual(forward);
    expect(forward.buckets.action[0]).toMatchObject({
      priority: 'CRITICAL',
      dueAt: '2026-08-25T02:00:00.000Z',
      generatedAt: '2026-08-24T23:00:00.000Z',
      freshness: { state: 'STALE' },
    });
  });
});
