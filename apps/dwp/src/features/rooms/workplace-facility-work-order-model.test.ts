import { describe, expect, it } from 'vitest';

import type { WorkplaceFacilityRequest } from '@dwp-frontend/shared-utils';

import {
  facilityDateTimeIsoValue,
  facilityWorkOrderChanged,
  facilityWorkOrderDraft,
} from './workplace-facility-work-order-model';

const request = {
  requestId: '10000000-0000-4000-8000-000000000001',
  resourceId: '20000000-0000-4000-8000-000000000001',
  siteId: '30000000-0000-4000-8000-000000000001',
  floorId: '40000000-0000-4000-8000-000000000001',
  resourceName: 'D-1208',
  category: 'REPAIR',
  description: 'Monitor arm is loose',
  status: 'OPEN',
  statusReason: null,
  priority: 'NORMAL',
  assignedTo: null,
  serviceProvider: null,
  externalWorkOrderReference: null,
  slaDueAt: null,
  version: 0,
  createdAt: '2026-09-16T00:00:00Z',
  updatedAt: '2026-09-16T00:00:00Z',
  owner: 'WORKPLACE_FACILITIES',
} satisfies WorkplaceFacilityRequest;

describe('facility work-order model', () => {
  it('starts with the next valid workflow state and preserves saved metadata', () => {
    expect(facilityWorkOrderDraft(request)).toMatchObject({
      status: 'IN_PROGRESS',
      priority: 'NORMAL',
      assignedTo: '',
    });
  });

  it('detects metadata-only changes after the operator selects the current state', () => {
    const draft = {
      ...facilityWorkOrderDraft(request),
      status: 'OPEN' as const,
      assignedTo: 'Facilities A',
    };
    expect(facilityWorkOrderChanged(request, draft)).toBe(true);
  });

  it('rejects rolled and malformed local date-time values', () => {
    expect(facilityDateTimeIsoValue('2026-02-30T09:00')).toBeNull();
    expect(facilityDateTimeIsoValue('bad')).toBeNull();
    expect(facilityDateTimeIsoValue('')).toBeNull();
  });
});
