import { getWorkplaceAdminFloors, getWorkplaceAdminResources } from '@dwp-frontend/shared-utils';

import { filterWorkplacePlanningResources } from './workplace-space-planning-model';

import type { WorkplaceFloor, WorkplaceResource } from '@dwp-frontend/shared-utils';
import type { WorkplacePlanningScope } from '@dwp-frontend/shared-utils/api/workplace-planning-contract';

const RESOURCE_REQUEST_BATCH = 6;

function floorsForScope(floors: readonly WorkplaceFloor[], scope: WorkplacePlanningScope) {
  const siteFloors = floors.filter(
    (floor) => floor.siteId === scope.siteId && floor.state !== 'CLOSED'
  );
  if (scope.floorId === null) return siteFloors;
  const selected = siteFloors.find((floor) => floor.floorId === scope.floorId);
  if (!selected) throw new Error('The planning floor is unavailable in the authoritative catalog.');
  return [selected];
}

export async function loadWorkplacePlanningResources(scope: WorkplacePlanningScope) {
  const floors = floorsForScope(await getWorkplaceAdminFloors(scope.siteId), scope);
  const resources: WorkplaceResource[] = [];
  for (let index = 0; index < floors.length; index += RESOURCE_REQUEST_BATCH) {
    const batch = floors.slice(index, index + RESOURCE_REQUEST_BATCH);
    const results = await Promise.all(
      batch.map((floor) => getWorkplaceAdminResources(floor.floorId))
    );
    results.forEach((items) => resources.push(...items));
  }
  return filterWorkplacePlanningResources(resources, scope);
}
