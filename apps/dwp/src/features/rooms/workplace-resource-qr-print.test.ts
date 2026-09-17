import { describe, expect, it } from 'vitest';

import { workplaceResourceQrTarget } from './workplace-resource-qr-print';

import type { WorkplaceFloor, WorkplaceResource, WorkplaceSite } from '@dwp-frontend/shared-utils';

describe('workplaceResourceQrTarget', () => {
  it('builds a canonical public discovery URL without user or credential data', () => {
    const resource = {
      resourceId: '06cc5f90-d211-4d85-ae73-56ba6ed43921',
      siteId: '375a8f0c-f584-44ae-aa83-aa1a8ab0c823',
      floorId: 'b41ddd84-b7e0-432d-8a3f-a6fdf40993f2',
      type: 'DESK',
    } as WorkplaceResource;
    const site = {
      siteId: resource.siteId,
    } as WorkplaceSite;
    const floor = {
      floorId: resource.floorId,
    } as WorkplaceFloor;

    const target = new URL(
      workplaceResourceQrTarget('https://workplace.example.test', resource, site, floor)
    );

    expect(target.origin).toBe('https://workplace.example.test');
    expect(target.pathname).toBe('/workplace/find');
    expect(Object.fromEntries(target.searchParams)).toEqual({
      v: '1',
      sites: site.siteId,
      floors: floor.floorId,
      types: 'DESK',
      resource: resource.resourceId,
    });
    expect(target.href).not.toMatch(/token|user|email|authorization/i);
  });
});
