import { describe, expect, it } from 'vitest';

import { workplaceSharedPlanDiscoveryPath } from './workplace-shared-plan-discovery';

import type {
  WorkplaceFloor,
  WorkplaceSharedWorkPlan,
  WorkplaceSite,
} from '@dwp-frontend/shared-utils';

const site = { siteId: 'site-a', state: 'ACTIVE', timeZone: 'Pacific/Auckland' } as WorkplaceSite;
const floor = { floorId: 'floor-a', siteId: site.siteId, state: 'ACTIVE' } as WorkplaceFloor;
const catalog = { sites: [site], floors: [floor] };
const plan = {
  planDate: '2026-09-27',
  mode: 'OFFICE',
  siteId: site.siteId,
  floorId: floor.floorId,
  resourceId: 'disclosed-resource',
  visibility: 'FLOOR',
  source: 'WORK_PLAN',
} as WorkplaceSharedWorkPlan;

describe('public colleague plan discovery', () => {
  it('links the disclosed native floor and local plan date without claiming a seat or revealing a person', () => {
    const url = new URL(workplaceSharedPlanDiscoveryPath(plan, catalog)!, 'https://dwp.test');
    expect(url.pathname).toBe('/workplace/find');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      v: '1',
      date: plan.planDate,
      tz: site.timeZone,
      sites: site.siteId,
      floors: floor.floorId,
      types: 'ALL',
    });
    expect(workplaceSharedPlanDiscoveryPath({ ...plan, visibility: 'RESOURCE' }, catalog)).toBe(
      url.pathname + url.search
    );
  });
  it.each([
    { visibility: 'PRIVATE' },
    { visibility: 'SITE' },
    { mode: 'REMOTE' },
    { mode: 'OFF' },
    { source: 'ACTUAL_PRESENCE' },
    { floorId: null },
    { siteId: null },
    { planDate: '2026-02-30' },
  ])('does not offer undisclosed, unverified, or invalid plans: %j', (patch) => {
    expect(
      workplaceSharedPlanDiscoveryPath({ ...plan, ...patch } as WorkplaceSharedWorkPlan, catalog)
    ).toBeNull();
  });
  it('closes discovery when native scope is missing, mismatched, inactive, or has an invalid timezone', () => {
    for (const unavailable of [
      undefined,
      { sites: [site], floors: [] },
      { sites: [site], floors: [{ ...floor, siteId: 'other-site' }] },
      { sites: [{ ...site, state: 'CLOSED' as const }], floors: [floor] },
      { sites: [site], floors: [{ ...floor, state: 'CLOSED' as const }] },
      { sites: [{ ...site, timeZone: 'Invalid/Zone' }], floors: [floor] },
    ])
      expect(workplaceSharedPlanDiscoveryPath(plan, unavailable)).toBeNull();
  });
});
