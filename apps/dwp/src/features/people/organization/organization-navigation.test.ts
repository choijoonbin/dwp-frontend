import { describe, expect, it } from 'vitest';

import {
  modeForSelection,
  organizationSelectionSearchParams,
  parseChartMode,
  parseOrganizationSelection,
  personAncestorIds,
  removeValues,
} from './organization-navigation';

import type { OrganizationChartPerson } from '@dwp-frontend/shared-utils';

function person(personId: string, managerPersonId?: string): OrganizationChartPerson {
  return {
    personId,
    assignmentKey: `assignment-${personId}`,
    displayName: personId,
    organizationId: 'org',
    managerPersonId,
    managerReferenceMissing: false,
    jobGradeOrder: 1,
    workerType: 'EMPLOYEE',
    workerStatus: 'ACTIVE',
    directReportCount: 0,
    fullTimeEquivalent: 1,
  };
}

describe('organization navigation state', () => {
  it('uses the selected entity to choose a compatible chart mode', () => {
    const selection = parseOrganizationSelection(
      new URLSearchParams('mode=organizations&person=person-3')
    );

    expect(selection).toEqual({ kind: 'person', id: 'person-3' });
    expect(modeForSelection(selection, parseChartMode('organizations', 'organizations'))).toBe(
      'people'
    );
  });

  it('serializes only one selected entity', () => {
    expect(organizationSelectionSearchParams({ kind: 'position', id: 'position-2' })).toEqual({
      organization: null,
      person: null,
      position: 'position-2',
    });
  });

  it('collects every reporting ancestor and removes it from collapsed nodes', () => {
    const people = [
      person('ceo'),
      person('vp', 'ceo'),
      person('lead', 'vp'),
      person('member', 'lead'),
    ];
    const ancestors = personAncestorIds(people, 'member');

    expect([...ancestors]).toEqual(['lead', 'vp', 'ceo']);
    expect([...removeValues(new Set(['ceo', 'vp', 'other']), ancestors)]).toEqual(['other']);
  });

  it('terminates safely when malformed source data contains a cycle', () => {
    expect([...personAncestorIds([person('a', 'b'), person('b', 'a')], 'a')]).toEqual(['b']);
  });
});
