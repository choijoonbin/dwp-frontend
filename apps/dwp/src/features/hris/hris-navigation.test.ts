import { describe, expect, it } from 'vitest';

import { isHrisWorkItem, selectCurrentPerson } from './hris-experience-model';
import {
  findHrisNavigationItem,
  mapLegacyHrisPath,
  visibleHrisNavigation,
} from './hris-navigation';

import type { PersonSummary } from '@dwp-frontend/shared-utils';

function person(overrides: Partial<PersonSummary> = {}): PersonSummary {
  return {
    personId: 'person-1',
    displayName: 'Minseo Kim',
    lifecycleState: 'ACTIVE',
    workEmail: 'minseo.kim@example.invalid',
    directReportCount: 0,
    dataAccess: { classification: 'DIRECTORY', workerNumberMasked: true, excludedFieldGroups: [] },
    ...overrides,
  };
}

describe('HR product navigation', () => {
  it('builds one menu from employee, manager, and operator audiences', () => {
    const employee = visibleHrisNavigation({ isManager: false, canOperate: false });
    const manager = visibleHrisNavigation({ isManager: true, canOperate: false });
    const operator = visibleHrisNavigation({ isManager: false, canOperate: true });

    expect(employee.flatMap((group) => group.items).map((item) => item.view)).toEqual([
      'home',
      'me',
      'directory',
      'organization',
    ]);
    expect(manager.flatMap((group) => group.items).some((item) => item.view === 'team')).toBe(true);
    expect(
      operator.flatMap((group) => group.items).some((item) => item.view === 'operations')
    ).toBe(true);
  });

  it('keeps legacy bookmarks while resolving every destination to the HR shell', () => {
    expect(mapLegacyHrisPath('/people/directory')).toBe('/hr/directory');
    expect(mapLegacyHrisPath('/workforce/data-operations')).toBe('/hr/data/integrations');
    expect(findHrisNavigationItem('/hr/design/organization')?.view).toBe('organization-design');
  });
});

describe('HR experience evidence', () => {
  it('links the signed-in identity by exact normalized email before display name', () => {
    const people = [
      person({ personId: 'same-name', workEmail: 'other@example.invalid' }),
      person({
        personId: 'exact-email',
        displayName: 'Another Name',
        workEmail: 'exact-email@example.invalid',
      }),
    ];
    expect(
      selectCurrentPerson(people, {
        email: ' EXACT-EMAIL@example.invalid ',
        displayName: 'Minseo Kim',
      })?.personId
    ).toBe('exact-email');
  });

  it('only promotes actual HR-routed or HR-owned work onto HR home', () => {
    expect(isHrisWorkItem({ sourceRoute: '/people', sourceSystem: 'People Service' })).toBe(true);
    expect(isHrisWorkItem({ sourceRoute: '/admin/access', sourceSystem: 'IT Service' })).toBe(
      false
    );
  });
});
