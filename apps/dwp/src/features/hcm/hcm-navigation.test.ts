import { describe, expect, it } from 'vitest';

import { isHrWorkItem, selectCurrentPerson } from './hcm-experience-model';
import { findHcmNavigationItem, mapLegacyHrPath, visibleHcmNavigation } from './hcm-navigation';

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
    const employee = visibleHcmNavigation({ isManager: false, canOperate: false });
    const manager = visibleHcmNavigation({ isManager: true, canOperate: false });
    const operator = visibleHcmNavigation({ isManager: false, canOperate: true });

    expect(employee.flatMap((group) => group.items).map((item) => item.view)).toEqual([
      'home',
      'me',
      'time',
      'absence',
      'benefits',
      'pay',
      'talent',
      'services',
      'directory',
      'organization',
    ]);
    expect(manager.flatMap((group) => group.items).some((item) => item.view === 'team')).toBe(true);
    expect(
      operator.flatMap((group) => group.items).some((item) => item.view === 'operations')
    ).toBe(true);
  });

  it('keeps legacy bookmarks while resolving every destination to the HR shell', () => {
    expect(mapLegacyHrPath('/people/directory')).toBe('/hr/directory');
    expect(mapLegacyHrPath('/workforce/data-operations')).toBe('/hr/data/integrations');
    expect(mapLegacyHrPath('/WORKFORCE/DATA-OPERATIONS/?scope=S#tab')).toBeUndefined();
    expect(mapLegacyHrPath('/WORKFORCE/DATA-OPERATIONS/')).toBe('/hr/data/integrations');
    expect(mapLegacyHrPath('/people/unknown')).toBeUndefined();
    expect(mapLegacyHrPath('/workforce/unknown')).toBeUndefined();
    expect(findHcmNavigationItem('/hr/design/organization')?.view).toBe('organization-design');
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
    expect(isHrWorkItem({ sourceRoute: '/people', sourceSystem: 'People Service' })).toBe(true);
    expect(isHrWorkItem({ sourceRoute: '/admin/access', sourceSystem: 'IT Service' })).toBe(false);
  });
});
