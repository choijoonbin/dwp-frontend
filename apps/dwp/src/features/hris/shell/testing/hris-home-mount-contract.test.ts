import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), 'apps/dwp/src', path), 'utf8');
}

describe('HRIS home and work-explorer separation', () => {
  it('keeps the product map out of the role-based home dashboard', () => {
    const page = source('pages/hcm.tsx');
    expect(page).toContain('import { HRIS_HOME_RUNTIME_PROVIDER_REGISTRY }');
    expect(page).toContain(
      '<HcmHome moduleProviderRegistry={HRIS_HOME_RUNTIME_PROVIDER_REGISTRY} />'
    );
    expect(page).not.toContain('import { HrisProductMap }');
    expect(page).not.toContain('HrisProductMapForCurrentAudience');
  });

  it('renders provider states without importing a sibling feature or a menu catalog', () => {
    const home = source('features/hcm/hcm-home.tsx');
    expect(home).toContain('export function HcmHome({');
    expect(home).toContain('moduleProviderRegistry: HcmHomeModuleProviderRegistry');
    expect(home).toContain('moduleProviderRegistry.sources.map');
    expect(home).toContain('composeHcmHomeProvidersSafely(');
    expect(home).not.toContain('getHrHome');
    expect(home).not.toContain('HrHomeOverview');
    expect(home).not.toContain('productMap');
    expect(home).not.toContain('features/hris');
  });

  it('lets the document own wheel scrolling instead of trapping it inside home widgets', () => {
    const home = source('features/hcm/hcm-home.tsx');
    expect(home).toContain('scrollMode="document"');
  });

  it('isolates each provider source lifecycle instead of failing the whole shell', () => {
    const home = source('features/hcm/hcm-home.tsx');
    const contract = source('features/hris/home/model/hris-home-provider-contract.ts');
    const registry = source('features/hris/home/model/hris-home-provider-registry.ts');

    expect(home).toContain('useQueries');
    expect(home).toContain('loadHcmHomeSourceSafely(');
    expect(home).toContain('enabled,');
    expect(home).toContain('resolveHcmHomeSourceContributionSafely(');
    expect(home).toContain('composeHcmHomeProvidersSafely(');
    expect(home).not.toContain('source.unavailable(');
    expect(home).toContain('providerContributions,');
    expect(home).toContain('providerResolutionContext');
    expect(home).not.toContain('if (hrOverview.isError');
    expect(contract).not.toContain('HrHomeOverview');
    expect(contract).toContain('sources: readonly HrisHomeProviderSource[]');
    expect(contract).toContain('normalizeSourceContribution');
    expect(contract).toContain('centralFallbackContribution');
    expect(contract).toContain('SOURCE_CONTRIBUTION_PROVENANCE_INVALID');
    expect(registry).toContain("sourceId: 'legacy-home-aggregate'");
    expect(registry).toContain('dataAuthority: LEGACY_AGGREGATE');
  });

  it('suppresses out-of-scope benefits and avoids leave-plan name heuristics', () => {
    const home = source('features/hcm/hcm-home-view-model.ts');
    const widgets = source('features/hcm/hcm-home-widgets.tsx');
    expect(home).not.toContain('/ANNUAL/');
    expect(home).not.toContain("domainAvailable('BENEFITS')");
    expect(widgets).not.toContain("navigate('/hr/benefits')");
  });

  it('keeps rendered widgets behind provider projections without an organization-chart fan-out', () => {
    const home = source('features/hcm/hcm-home.tsx');
    const widgets = source('features/hcm/hcm-home-widgets.tsx');
    const viewModel = source('features/hcm/hcm-home-view-model.ts');

    expect(home).not.toContain('getOrganizationChart');
    expect(home).not.toContain('teamChart');
    expect(widgets).not.toContain('HrHomeOverview');
    expect(widgets).not.toContain('OrganizationChartPerson');
    expect(widgets).not.toContain('overview.');
    expect(viewModel).not.toContain('HrHomeOverview');
    expect(viewModel).toContain('hcmHomeProviderPayload');
  });

  it('routes each non-SYS pilot to its governed HRIS implementation', () => {
    const page = source('pages/hcm.tsx').replace(/\s+/gu, ' ');

    expect(page).toContain("import('../features/hris/time')");
    expect(page).toContain("import('../features/hris/payroll')");
    expect(page).toContain("import('../features/hris/performance')");
    expect(page).toContain("import('../features/hris/people')");
    expect(page).toContain('time: <HrisTimeWorkspace />');
    expect(page).toContain('pay: <HrisPayrollWorkspace />');
    expect(page).toContain('talent: <HrisPerformanceWorkspace />');
    expect(page).toContain('people: <HrisPeople360Workspace />');
  });
});
