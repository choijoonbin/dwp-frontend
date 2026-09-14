// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import type {
  WorkplaceGovernanceChangeReview,
  WorkplaceGovernanceSiteAccessRuleInput,
} from '@dwp-frontend/shared-utils';
import {
  accessRuleFloorReviewMatches,
  verifiedAccessRuleFloors,
} from './workplace-governance-floor-scope';
import { useGovernanceChangeReview } from './workplace-governance-change-review';
vi.mock('@dwp-frontend/design-system', () => ({
  ActionButton: 'button',
  FormField: 'input',
  InlineFeedback: 'div',
}));
vi.mock('@dwp-frontend/shared-utils', async () => ({
  HttpError: (await import('@dwp-frontend/shared-utils/http-error')).HttpError,
}));
const siteId = '10000000-0000-0000-0000-000000000001';
const floorId = '20000000-0000-4000-8000-000000000001';
const proposed: WorkplaceGovernanceSiteAccessRuleInput = {
  subjectType: 'USER',
  subjectUserId: 7,
  subjectGroupRef: null,
  permission: 'VIEW',
  effect: 'DENY',
  validFrom: null,
  validUntil: null,
  state: 'ACTIVE',
  version: null,
  floorId,
};
const decision = {
  siteId,
  floorId,
  userId: 7,
  requestedPermission: 'VIEW' as const,
  allowed: true,
  decision: 'ALLOW_SITE_INHERITED',
  matchedRuleIds: [],
  evaluatedAt: '2026-09-14T00:00:00Z',
};
const result = (): WorkplaceGovernanceChangeReview<WorkplaceGovernanceSiteAccessRuleInput> => ({
  targetType: 'WP_ACCESS_RULE',
  targetId: null,
  current: null,
  proposed,
  currentActorAccess: decision,
  proposedActorAccess: { ...decision, allowed: false, decision: 'DENY_EXPLICIT' },
  knownImpact: [],
  warnings: [],
  evaluatedAt: decision.evaluatedAt,
});
describe('native floor scope rollout guard', () => {
  it('requires actual unique tenant/site options and rejects absent or mismatched metadata', () => {
    const option = { floorId, siteId, name: '10F', state: 'ACTIVE' };
    expect(verifiedAccessRuleFloors(siteId, [option])).toEqual([option]);
    for (const value of [
      undefined,
      [{ ...option, siteId: 'foreign' }],
      [{ ...option, floorId: 'arbitrary' }],
      [option, option],
      [{ ...option, state: 'MAINTENANCE' }],
    ])
      expect(verifiedAccessRuleFloors(siteId, value)).toBeNull();
  });
  it('requires both native actor decisions and proposed echo to bind the exact requested floor', () => {
    expect(accessRuleFloorReviewMatches(siteId, proposed, result())).toBe(true);
    const original = result();
    for (const response of [
      { ...original, proposed: { ...proposed, floorId: null } },
      { ...original, proposedActorAccess: undefined },
      { ...original, currentActorAccess: { ...decision, floorId: null } },
      { ...original, proposedActorAccess: { ...decision, siteId: 'foreign' } },
    ])
      expect(accessRuleFloorReviewMatches(siteId, proposed, response)).toBe(false);
    expect(
      accessRuleFloorReviewMatches(
        siteId,
        { ...proposed, floorId: null },
        { ...original, proposedActorAccess: undefined }
      )
    ).toBe(true);
  });
  it('mounted guarded flow never dispatches a floor commit when an old producer ignores floorId', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const apply = vi.fn(async () => ({}));
    let observed!: ReturnType<
      typeof useGovernanceChangeReview<WorkplaceGovernanceSiteAccessRuleInput>
    >;
    function Probe() {
      observed = useGovernanceChangeReview({
        contextKey: siteId,
        proposed,
        canManage: true,
        sourceReady: true,
        valid: true,
        review: async () => {
          const old = {
            ...result(),
            proposed: { ...proposed, floorId: null },
            proposedActorAccess: undefined,
          };
          if (!accessRuleFloorReviewMatches(siteId, proposed, old))
            throw new Error('Unverified floor scope');
          return old;
        },
        apply,
        recheck: async () => true,
        onSaved: () => {},
      });
      return null;
    }
    try {
      await act(async () => root.render(createElement(Probe)));
      await act(async () => observed.review());
      await act(async () => {
        observed.setReason('Never promote a floor to a site');
        observed.setConfirmed(true);
      });
      expect(observed.outcome).toBe('reviewUnavailable');
      expect(observed.canSave).toBe(false);
      await act(async () => observed.save());
      expect(apply).not.toHaveBeenCalled();
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });
});
