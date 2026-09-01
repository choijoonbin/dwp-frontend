import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

describe('HCM query discriminator source contract', () => {
  it('keeps operations people on its own projection without identity or candidate enrichment', () => {
    const peopleDirectory = source('../people/directory/people-directory.tsx');
    expect(peopleDirectory).not.toContain('listIdentityUsers');
    expect(peopleDirectory).not.toContain('listWorkforceOrganizationCandidates');
    expect(peopleDirectory).not.toContain('identity-admin-api');
    expect(peopleDirectory).not.toContain("field: 'roles'");
  });

  it('uses candidates and design view only in organization design', () => {
    const organizationDesign = source('../people/organization/organization-chart-manager.tsx');
    expect(organizationDesign).toContain('listWorkforceOrganizationCandidates');
    expect(organizationDesign).toContain("view: workforceView ? 'design' : undefined");
  });

  it('pins assignment, directory, and HCM service discriminators in their callers', () => {
    expect(source('../workforce/assignment-register.tsx')).toContain("view: 'assignments'");
    const directory = source('../people/directory/people-directory.tsx');
    expect(directory).toContain("experience === 'directory' ? 'directory' : undefined");
    const serviceHub = source('./hr-service-hub.tsx');
    expect(serviceHub).toContain('getHcmServiceCatalog');
    expect(serviceHub).toContain('getHcmServiceRequests');
    expect(serviceHub).toContain("'surface:hcm'");
  });

  it('keeps directory identity resolution out of the shared shell and non-profile pages', () => {
    for (const path of ['../../pages/hcm.tsx', '../../layouts/hcm-layout.tsx', './hcm-home.tsx']) {
      const pageSource = source(path);
      expect(pageSource).not.toContain('useCurrentHcmPerson');
      expect(pageSource).not.toContain('listPeople');
      expect(pageSource).not.toContain('getPerson');
    }

    expect(source('./my-hr-profile.tsx')).toContain('useCurrentHcmPerson');
  });

  it('keeps HCM request tracking independent from catalog key discovery', () => {
    const serviceHub = source('./hr-service-hub.tsx');
    expect(serviceHub).toContain('const hrRequests = requests.data ?? []');
    expect(serviceHub).not.toContain('peopleServiceKeys');
    expect(serviceHub).toContain('catalog.isError && requests.isError');
  });

  it('connects every operations summary domain to its actionable workspace', () => {
    const overview = source('./hr-operations-overview.tsx');
    for (const path of [
      '/hr/operations/time',
      '/hr/operations/absence',
      '/hr/operations/benefits',
      '/hr/operations/pay',
      '/hr/operations/talent',
    ]) {
      expect(overview).toContain(`path: '${path}'`);
    }
    expect(overview).toContain('navigate(destination.path)');
  });
});
