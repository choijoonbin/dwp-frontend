import type {
  WorkplaceGovernanceSiteAccessDecision,
  WorkplaceGovernanceSiteAccessRuleInput,
  WorkplaceGovernanceChangeReview,
} from '@dwp-frontend/shared-utils';
import { isWorkplaceGovernanceUuid } from './workplace-admin-governance-model';

type Floors = NonNullable<WorkplaceGovernanceSiteAccessDecision['availableFloors']>;

export function verifiedAccessRuleFloors(siteId: string, value: unknown): Floors | null {
  if (!Array.isArray(value)) return null;
  const seen = new Set<string>();
  for (const floor of value) {
    if (
      !floor ||
      floor.siteId !== siteId ||
      !isWorkplaceGovernanceUuid(floor.floorId) ||
      typeof floor.name !== 'string' ||
      !['ACTIVE', 'DRAFT', 'CLOSED'].includes(floor.state) ||
      seen.has(floor.floorId)
    )
      return null;
    seen.add(floor.floorId);
  }
  return value as Floors;
}

export function accessRuleFloorReviewMatches(
  siteId: string,
  proposed: WorkplaceGovernanceSiteAccessRuleInput,
  review: WorkplaceGovernanceChangeReview<WorkplaceGovernanceSiteAccessRuleInput>
) {
  if (!proposed.floorId) return true;
  return (
    review.proposed?.floorId === proposed.floorId &&
    review.currentActorAccess?.siteId === siteId &&
    review.currentActorAccess.floorId === proposed.floorId &&
    review.proposedActorAccess?.siteId === siteId &&
    review.proposedActorAccess.floorId === proposed.floorId &&
    review.proposedActorAccess.requestedPermission === proposed.permission
  );
}
