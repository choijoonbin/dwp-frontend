import { describe, expect, it } from 'vitest';
import { workplaceDelegatedTargetAllowed } from './workplace-delegated-target-permission';
import {
  workplaceDelegationFloorReviewIsBound,
  workplaceDelegationFloorSet,
} from './workplace-delegation-floor-scope';
import type {
  WorkplaceGovernanceChangeReview,
  WorkplaceGovernanceDelegatedAdminScopeInput,
  WorkplaceGovernanceDelegatedAdminScope,
  WorkplaceGovernanceEffectiveDelegatedScope,
} from '@dwp-frontend/shared-utils';

const site = '11111111-1111-4111-8111-111111111111';
const otherSite = '22222222-2222-4222-8222-222222222222';
const firstFloor = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const secondFloor = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const futureFloor = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const now = Date.parse('2026-09-14T00:00:00Z');
const scope: WorkplaceGovernanceEffectiveDelegatedScope = {
  delegationId: id,
  scopeType: 'SITE',
  scopeId: site,
  permissions: ['CATALOG_MANAGE'],
  validUntil: null,
  floorIds: [firstFloor, secondFloor],
};
const proposed: WorkplaceGovernanceDelegatedAdminScopeInput = {
  delegateType: 'USER',
  delegateUserId: 21,
  delegateGroupRef: null,
  scopeType: 'SITE',
  siteId: site,
  managedGroupRef: null,
  permissions: ['CATALOG_VIEW', 'CATALOG_MANAGE'],
  validFrom: '2026-09-14T00:00:00Z',
  validUntil: null,
  state: 'ACTIVE',
  version: 11,
  floorIds: [firstFloor, secondFloor],
};
const existing: WorkplaceGovernanceDelegatedAdminScope = {
  ...proposed,
  delegationId: id,
  version: 11,
};
const review: WorkplaceGovernanceChangeReview<WorkplaceGovernanceDelegatedAdminScopeInput> = {
  targetType: 'WP_DELEGATION',
  targetId: id,
  current: { ...proposed },
  proposed: { ...proposed },
  currentActorAccess: null,
  evaluatedAt: new Date(now).toISOString(),
  knownImpact: [],
  warnings: [],
};

describe('native delegated administrator floor scope', () => {
  it('uses actual native seeded floor identifiers while retaining permission and target boundaries', () => {
    const nativeFloor = '95de1903-9bd7-7ce6-31c1-ab6e7a2dd8b8';
    const nativeScope = { ...scope, floorIds: [nativeFloor] };
    expect(workplaceDelegationFloorSet([nativeFloor])).toEqual([nativeFloor]);
    expect(
      workplaceDelegatedTargetAllowed([nativeScope], 'CATALOG_MANAGE', site, nativeFloor, now)
    ).toBe(true);
    expect(
      workplaceDelegatedTargetAllowed([nativeScope], 'POLICY_MANAGE', site, nativeFloor, now)
    ).toBe(false);
    expect(
      workplaceDelegatedTargetAllowed([nativeScope], 'CATALOG_MANAGE', site, firstFloor, now)
    ).toBe(false);
    expect(
      workplaceDelegatedTargetAllowed([nativeScope], 'CATALOG_MANAGE', otherSite, nativeFloor, now)
    ).toBe(false);
    expect(workplaceDelegatedTargetAllowed([nativeScope], 'CATALOG_MANAGE', site, null, now)).toBe(
      false
    );
    expect(workplaceDelegationFloorSet([nativeFloor, nativeFloor.toUpperCase()])).toBe(false);
  });
  it('permits either saved floor while closing site-wide, future-floor and foreign-site changes', () => {
    expect(workplaceDelegatedTargetAllowed([scope], 'CATALOG_MANAGE', site, firstFloor, now)).toBe(
      true
    );
    expect(workplaceDelegatedTargetAllowed([scope], 'CATALOG_MANAGE', site, secondFloor, now)).toBe(
      true
    );
    expect(workplaceDelegatedTargetAllowed([scope], 'CATALOG_MANAGE', site, null, now)).toBe(false);
    expect(workplaceDelegatedTargetAllowed([scope], 'CATALOG_MANAGE', site, futureFloor, now)).toBe(
      false
    );
    expect(
      workplaceDelegatedTargetAllowed([scope], 'CATALOG_MANAGE', otherSite, firstFloor, now)
    ).toBe(false);
  });
  it('unions floors only within the permission provided by each native grant', () => {
    const catalog = { ...scope, floorIds: [firstFloor] };
    const policy = { ...scope, permissions: ['POLICY_MANAGE'] as const, floorIds: [secondFloor] };
    expect(
      workplaceDelegatedTargetAllowed(
        [catalog, { ...policy, permissions: [...policy.permissions] }],
        'CATALOG_MANAGE',
        site,
        secondFloor,
        now
      )
    ).toBe(false);
    expect(
      workplaceDelegatedTargetAllowed(
        [catalog, { ...policy, permissions: [...policy.permissions] }],
        'POLICY_MANAGE',
        site,
        secondFloor,
        now
      )
    ).toBe(true);
    expect(
      workplaceDelegatedTargetAllowed(
        [catalog, { ...policy, permissions: [...policy.permissions] }],
        'CATALOG_VIEW',
        site,
        secondFloor,
        now
      )
    ).toBe(true);
    expect(
      workplaceDelegatedTargetAllowed(
        [catalog, { ...scope, floorIds: [secondFloor] }],
        'CATALOG_MANAGE',
        site,
        secondFloor,
        now
      )
    ).toBe(true);
  });
  it.each([undefined, null])('preserves whole-site legacy scope for %s', (floorIds) => {
    expect(
      workplaceDelegatedTargetAllowed([{ ...scope, floorIds }], 'CATALOG_MANAGE', site, null, now)
    ).toBe(true);
    expect(
      workplaceDelegatedTargetAllowed(
        [{ ...scope, floorIds }],
        'CATALOG_MANAGE',
        site,
        futureFloor,
        now
      )
    ).toBe(true);
  });
  it.each(
    [[], [firstFloor, firstFloor.toUpperCase()], ['foreign'], [firstFloor, '']].map((floorIds) => ({
      floorIds,
    }))
  )('closes a malformed restricted set $floorIds', ({ floorIds }) => {
    expect(
      workplaceDelegatedTargetAllowed(
        [{ ...scope, floorIds }],
        'CATALOG_MANAGE',
        site,
        firstFloor,
        now
      )
    ).toBe(false);
  });
  it('expires at the native validity boundary without borrowing another permission', () => {
    const expired = { ...scope, validUntil: new Date(now).toISOString() };
    expect(
      workplaceDelegatedTargetAllowed([expired], 'CATALOG_MANAGE', site, firstFloor, now - 1)
    ).toBe(true);
    expect(
      workplaceDelegatedTargetAllowed([expired], 'CATALOG_MANAGE', site, firstFloor, now)
    ).toBe(false);
  });
});

describe('native current/proposed delegation review binding', () => {
  it('accepts canonical reordered floor and permission sets and equivalent native timestamp offsets', () => {
    const echo = {
      ...review,
      proposed: {
        ...proposed,
        floorIds: [...proposed.floorIds!].reverse(),
        permissions: [...proposed.permissions].reverse(),
        validFrom: '2026-09-14T09:00:00+09:00',
      },
    };
    expect(workplaceDelegationFloorReviewIsBound(echo, proposed, existing)).toBe(true);
  });
  it('closes an older producer that omits the requested floor restriction', () => {
    expect(
      workplaceDelegationFloorReviewIsBound(
        { ...review, proposed: { ...proposed, floorIds: undefined } },
        proposed,
        existing
      )
    ).toBe(false);
  });
  it.each(['floor', 'site', 'subject', 'permission', 'version', 'validity'])(
    'closes a native %s echo that differs from the reviewed request',
    (field) => {
      const changed = { ...proposed };
      if (field === 'floor') changed.floorIds = [firstFloor];
      if (field === 'site') changed.siteId = otherSite;
      if (field === 'subject') changed.delegateUserId = 22;
      if (field === 'permission') changed.permissions = ['CATALOG_VIEW'];
      if (field === 'version') changed.version = 12;
      if (field === 'validity') changed.validUntil = new Date(now + 1000).toISOString();
      expect(
        workplaceDelegationFloorReviewIsBound({ ...review, proposed: changed }, proposed, existing)
      ).toBe(false);
    }
  );
  it('closes another target or a concurrently changed current version', () => {
    expect(
      workplaceDelegationFloorReviewIsBound({ ...review, targetId: firstFloor }, proposed, existing)
    ).toBe(false);
    expect(
      workplaceDelegationFloorReviewIsBound(
        { ...review, current: { ...proposed, version: 12 } },
        proposed,
        existing
      )
    ).toBe(false);
  });
  it('preserves legacy unrestricted site/subject updates with a bound native current version', () => {
    const next = { ...proposed, floorIds: null };
    const saved = { ...existing, floorIds: null, siteId: otherSite, delegateUserId: 25 };
    expect(
      workplaceDelegationFloorReviewIsBound(
        { ...review, current: saved, proposed: next },
        next,
        saved
      )
    ).toBe(true);
  });
  it.each(['site', 'subject', 'permission', 'state', 'validity'])(
    'rejects a same-version current %s snapshot that differs from the saved assignment',
    (field) => {
      const changed = { ...proposed };
      if (field === 'site') changed.siteId = otherSite;
      if (field === 'subject') changed.delegateUserId = 22;
      if (field === 'permission') changed.permissions = ['CATALOG_VIEW'];
      if (field === 'state') changed.state = 'REVOKED';
      if (field === 'validity') changed.validUntil = new Date(now + 1000).toISOString();
      expect(
        workplaceDelegationFloorReviewIsBound({ ...review, current: changed }, proposed, existing)
      ).toBe(false);
    }
  );
  it('closes malformed native review metadata before rendering or confirming it', () => {
    for (const malformed of [
      { evaluatedAt: 'not-a-date' },
      { knownImpact: null },
      { warnings: {} },
      { warnings: [1] },
      { currentActorAccess: {} },
      { proposedActorAccess: {} },
    ]) {
      const result = { ...review, ...malformed } as unknown as typeof review;
      expect(workplaceDelegationFloorReviewIsBound(result, proposed, existing)).toBe(false);
    }
  });
  it('preserves mutable permission and validity edits with the complete saved current snapshot', () => {
    const next = {
      ...proposed,
      permissions: ['CATALOG_VIEW'] as typeof proposed.permissions,
      validUntil: new Date(now + 1000).toISOString(),
    };
    expect(
      workplaceDelegationFloorReviewIsBound(
        { ...review, current: existing, proposed: next },
        next,
        existing
      )
    ).toBe(true);
  });
  it('requires no saved target or current snapshot when reviewing a new floor-range assignment', () => {
    const next = { ...proposed, version: null };
    expect(
      workplaceDelegationFloorReviewIsBound(
        { ...review, targetId: null, current: null, proposed: next },
        next,
        null
      )
    ).toBe(true);
    expect(
      workplaceDelegationFloorReviewIsBound(
        { ...review, targetId: null, proposed: next },
        next,
        null
      )
    ).toBe(false);
  });
});
