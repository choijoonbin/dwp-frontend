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
});
