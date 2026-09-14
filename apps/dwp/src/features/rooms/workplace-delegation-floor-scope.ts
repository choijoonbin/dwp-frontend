import { isWorkplaceGovernanceUuid } from './workplace-admin-governance-model';
import type {
  WorkplaceGovernanceChangeReview,
  WorkplaceGovernanceDelegatedAdminScope,
  WorkplaceGovernanceDelegatedAdminScopeInput,
} from '@dwp-frontend/shared-utils';

export function workplaceDelegationFloorSet(value: unknown): string[] | null | false {
  if (value == null) return null;
  if (
    !Array.isArray(value) ||
    !value.length ||
    value.some((id) => typeof id !== 'string' || !isWorkplaceGovernanceUuid(id))
  )
    return false;
  const normalized = value.map((id) => id.trim().toLowerCase()).sort();
  return new Set(normalized).size === normalized.length ? normalized : false;
}

export function workplaceDelegationFloorSetEqual(left: unknown, right: unknown) {
  const first = workplaceDelegationFloorSet(left);
  const second = workplaceDelegationFloorSet(right);
  return first !== false && second !== false && JSON.stringify(first) === JSON.stringify(second);
}

function snapshotMatches(
  echo: WorkplaceGovernanceDelegatedAdminScopeInput | null,
  expected: WorkplaceGovernanceDelegatedAdminScopeInput
) {
  if (!echo || !workplaceDelegationFloorSetEqual(echo.floorIds, expected.floorIds)) return false;
  if (
    [
      'siteId',
      'delegateType',
      'delegateUserId',
      'delegateGroupRef',
      'scopeType',
      'managedGroupRef',
      'state',
      'version',
    ].some((key) => echo[key as keyof typeof echo] !== expected[key as keyof typeof expected])
  )
    return false;
  if (
    !Array.isArray(echo.permissions) ||
    new Set(echo.permissions).size !== echo.permissions.length ||
    JSON.stringify([...echo.permissions].sort()) !==
      JSON.stringify([...expected.permissions].sort())
  )
    return false;
  for (const key of ['validFrom', 'validUntil'] as const) {
    if (
      expected[key] === null
        ? echo[key] != null
        : typeof echo[key] !== 'string' ||
          !Number.isFinite(Date.parse(echo[key])) ||
          Date.parse(echo[key]) !== Date.parse(expected[key])
    )
      return false;
  }
  return true;
}

export function workplaceDelegationFloorReviewIsBound(
  review: WorkplaceGovernanceChangeReview<WorkplaceGovernanceDelegatedAdminScopeInput>,
  proposed: WorkplaceGovernanceDelegatedAdminScopeInput,
  existing: WorkplaceGovernanceDelegatedAdminScope | null
) {
  if (
    !review ||
    review.targetType !== 'WP_DELEGATION' ||
    review.targetId !== (existing?.delegationId ?? null) ||
    !snapshotMatches(review.proposed, proposed)
  )
    return false;
  if (
    typeof review.evaluatedAt !== 'string' ||
    !Number.isFinite(Date.parse(review.evaluatedAt)) ||
    review.currentActorAccess !== null ||
    review.proposedActorAccess != null
  )
    return false;
  if (
    [review.knownImpact, review.warnings].some(
      (value) => !Array.isArray(value) || value.some((item) => typeof item !== 'string')
    )
  )
    return false;
  if (!existing) return proposed.version === null && review.current === null;
  if (
    proposed.version !== existing.version ||
    !snapshotMatches(review.current, existing) ||
    !workplaceDelegationFloorSetEqual(existing.floorIds, proposed.floorIds)
  )
    return false;
  return (
    existing.floorIds == null ||
    [
      'siteId',
      'delegateType',
      'delegateUserId',
      'delegateGroupRef',
      'scopeType',
      'managedGroupRef',
    ].every(
      (key) => proposed[key as keyof typeof proposed] === existing[key as keyof typeof existing]
    )
  );
}
