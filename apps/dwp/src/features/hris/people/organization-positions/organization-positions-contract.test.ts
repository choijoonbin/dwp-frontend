import { HttpError } from '@dwp-frontend/shared-utils';
import { describe, expect, it } from 'vitest';

import {
  assertOrganizationGraphQuery,
  organizationGraphFailure,
  organizationGraphQueryString,
  selectOrganizationGraphWithPositionsV2,
} from './organization-positions-contract';

import type {
  OrganizationGraphWithPositionsV2Query,
  OrganizationPositionV2,
} from './organization-positions-contract';

const ROOT = '10000000-0000-4000-8000-000000000001';
const CHILD = '10000000-0000-4000-8000-000000000002';
const POSITION_A = '20000000-0000-4000-8000-000000000001';
const POSITION_B = '20000000-0000-4000-8000-000000000002';
const PERSON_A = '30000000-0000-4000-8000-000000000001';
const PERSON_B = '30000000-0000-4000-8000-000000000002';

const request: OrganizationGraphWithPositionsV2Query = {
  asOf: '2026-10-17T09:00:00+09:00',
  rootPublicId: ROOT,
  depth: 2,
  relationshipType: 'REPORTING',
  includePositions: true,
};

function position(
  positionPublicId: string,
  positionKey: string,
  organizationPublicId: string,
  incumbents: string[]
): OrganizationPositionV2 {
  return {
    positionPublicId,
    positionKey,
    title: `Position ${positionKey}`,
    organizationPublicId,
    reportsToPositionPublicId: null,
    status: 'FILLED',
    positionType: 'REGULAR',
    criticality: 'STANDARD',
    budgetedFte: 1,
    annualCostAmount: null,
    costCurrency: null,
    jobProfileName: null,
    locationName: null,
    availabilityDate: null,
    incumbentPersonPublicIds: incumbents,
    subordinatePositionCount: 0,
  };
}

function graph(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 2,
    asOf: '2026-10-17T00:00:00Z',
    effectiveDate: '2026-10-17',
    rootPublicId: ROOT,
    depth: 2,
    relationshipType: 'REPORTING',
    positionsIncluded: true,
    nodes: [
      { organizationPublicId: CHILD, parentPublicId: ROOT, name: 'Child', depth: 1 },
      { organizationPublicId: ROOT, parentPublicId: null, name: 'Root', depth: 0 },
    ],
    positions: [
      position(POSITION_B, 'Z-2', CHILD, [PERSON_B, PERSON_A]),
      position(POSITION_A, 'A-1', ROOT, []),
    ],
    ...overrides,
  };
}

describe('OrganizationGraphWithPositionsV2 contract', () => {
  it('serializes all five required PEP-HRM-010 query values without aliases', () => {
    expect(assertOrganizationGraphQuery(request)).toEqual(request);
    expect(organizationGraphQueryString(request)).toBe(
      `asOf=2026-10-17T09%3A00%3A00%2B09%3A00&rootPublicId=${ROOT}&depth=2&relationshipType=REPORTING&includePositions=true`
    );
    expect(() => assertOrganizationGraphQuery({ ...request, depth: 13 })).toThrow(
      'Organization graph query is invalid.'
    );
    expect(() => assertOrganizationGraphQuery({ ...request, relationshipType: 'LEGAL' })).toThrow(
      'Organization graph query is invalid.'
    );
    expect(() => assertOrganizationGraphQuery({ ...request, tenantId: 'tenant-1' })).toThrow(
      'Organization graph query is invalid.'
    );
    expect(
      assertOrganizationGraphQuery({ ...request, rootPublicId: ROOT.toUpperCase() }).rootPublicId
    ).toBe(ROOT);
  });

  it('maps an offset-equivalent instant and applies the sealed stable order', () => {
    const selected = selectOrganizationGraphWithPositionsV2(graph(), request);
    expect(selected.nodes.map((node) => node.organizationPublicId)).toEqual([ROOT, CHILD]);
    expect(selected.positions.map((item) => item.positionPublicId)).toEqual([
      POSITION_A,
      POSITION_B,
    ]);
    expect(selected.positions[1]?.incumbentPersonPublicIds).toEqual([PERSON_A, PERSON_B]);
    expect(selected).toMatchObject({
      schemaVersion: 2,
      asOf: '2026-10-17T00:00:00Z',
      effectiveDate: '2026-10-17',
      rootPublicId: ROOT,
      depth: 2,
      relationshipType: 'REPORTING',
      positionsIncluded: true,
    });
  });

  it('fails closed on disclosure, identity, hierarchy, and response-echo drift', () => {
    const organizationsOnly = { ...request, includePositions: false } as const;
    expect(() =>
      selectOrganizationGraphWithPositionsV2(graph({ positionsIncluded: false }), organizationsOnly)
    ).toThrow('Organization-only graph disclosed position data.');
    expect(() =>
      selectOrganizationGraphWithPositionsV2(
        graph({ nodes: [{ organizationPublicId: ROOT, name: 'Root', depth: 1 }] }),
        request
      )
    ).toThrow('Organization graph root is invalid.');
    expect(() =>
      selectOrganizationGraphWithPositionsV2(graph({ rootPublicId: CHILD }), request)
    ).toThrow('Organization graph response is invalid.');
    expect(() =>
      selectOrganizationGraphWithPositionsV2(graph({ nodes: [], positions: [] }), request)
    ).toThrow('Organization graph root is invalid.');
    expect(() =>
      selectOrganizationGraphWithPositionsV2({ ...graph(), tenantId: 'foreign' }, request)
    ).toThrow('Organization graph response is invalid.');
  });

  it('keeps permission, missing, stale, unsupported, invalid, and unavailable states distinct', () => {
    expect(
      organizationGraphFailure(
        new HttpError('Denied', 403, {
          code: 'OPAQUE_AUTHORIZATION_DENIED',
          correlationId: 'correlation-403',
        })
      )
    ).toEqual({ kind: 'PERMISSION_DENIED', reference: 'correlation-403' });
    expect(
      organizationGraphFailure(
        new HttpError('Missing', 404, { code: 'ORGANIZATION_GRAPH_NOT_FOUND' })
      ).kind
    ).toBe('NOT_FOUND');
    expect(organizationGraphFailure(new HttpError('Stale', 409)).kind).toBe('STALE');
    expect(
      organizationGraphFailure(
        new HttpError('Unsupported', 422, { code: 'UNSUPPORTED_RELATIONSHIP_MODEL' })
      ).kind
    ).toBe('UNSUPPORTED');
    expect(
      organizationGraphFailure(
        new HttpError('Invalid', 400, { code: 'INVALID_ORGANIZATION_GRAPH_QUERY' })
      ).kind
    ).toBe('INVALID_QUERY');
    expect(organizationGraphFailure(new Error('offline')).kind).toBe('UNAVAILABLE');
  });
});
