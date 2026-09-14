import { Temporal } from 'temporal-polyfill';

import type { WorkplaceExploreResponse, WorkplaceSharedWorkPlan } from '@dwp-frontend/shared-utils';

/** Public plans identify an intended floor, never a colleague's actual presence or reservation. */
export function workplaceSharedPlanDiscoveryPath(
  plan: WorkplaceSharedWorkPlan,
  catalog: Pick<WorkplaceExploreResponse, 'sites' | 'floors'> | undefined
) {
  if (
    plan.source !== 'WORK_PLAN' ||
    plan.mode !== 'OFFICE' ||
    !['FLOOR', 'RESOURCE'].includes(plan.visibility) ||
    !plan.siteId ||
    !plan.floorId
  )
    return null;
  const site = catalog?.sites.find(
    (item) => item.siteId === plan.siteId && item.state === 'ACTIVE'
  );
  const floor = catalog?.floors.find(
    (item) =>
      item.floorId === plan.floorId && item.siteId === site?.siteId && item.state === 'ACTIVE'
  );
  if (!site || !floor) return null;
  try {
    if (Temporal.PlainDate.from(plan.planDate).toString() !== plan.planDate) return null;
    Temporal.Now.zonedDateTimeISO(site.timeZone);
  } catch {
    return null;
  }
  const query = new URLSearchParams({
    site: site.siteId,
    floor: floor.floorId,
    date: plan.planDate,
    timeZone: site.timeZone,
  });
  return `/workplace/explore?${query}`;
}
