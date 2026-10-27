import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  HRIS_ORGANIZATION_GRAPH_CONTRACT,
  HRIS_ORGANIZATION_POSITIONS_ADAPTER_KIND,
  HRIS_ORGANIZATION_POSITIONS_DEFAULT_GATE,
  HRIS_ORGANIZATION_POSITIONS_FEATURE,
  createHrisOrganizationPositionsQueryAdapter,
} from '../../organization-positions';

const managerSource = readFileSync(
  new URL('../../../../people/organization/organization-chart-manager.tsx', import.meta.url),
  'utf8'
);
const canonicalSource = readFileSync(
  new URL('../../organization-positions/organization-positions-explorer.tsx', import.meta.url),
  'utf8'
);
const workspaceSource = readFileSync(
  new URL('../../organization-positions/organization-positions-workspace.tsx', import.meta.url),
  'utf8'
);

describe('[SLICE:BASE-TFR-HRM-005] organization graph frontend seam', () => {
  it('pins the single canonical feature, PEP route, and sealed query-only adapter', () => {
    expect(HRIS_ORGANIZATION_POSITIONS_FEATURE).toBe('HRIS_ORGANIZATION_POSITIONS');
    expect(HRIS_ORGANIZATION_GRAPH_CONTRACT).toEqual({
      bindingId: 'PEP-HRM-010',
      routeContractKey: 'route.hcm.operations.organization-graph.data',
      pageRouteContractKey: 'route.hcm.operations.organization-positions.page',
      method: 'GET',
      path: '/api/people/v1/hris/organizations/graph',
      purposeCode: 'HR_OPERATIONS',
      capability: 'hcm.operations.organization.view',
    });
    const adapter = createHrisOrganizationPositionsQueryAdapter('scope:organization');
    expect(adapter.kind).toBe(HRIS_ORGANIZATION_POSITIONS_ADAPTER_KIND);
    expect(Object.keys(adapter)).toEqual(['kind', 'query']);
    expect(JSON.stringify(adapter)).not.toContain('command');
  });

  it('keeps runtime admission default-off with zero enrollment', () => {
    expect(HRIS_ORGANIZATION_POSITIONS_DEFAULT_GATE).toEqual({
      feature: 'HRIS_ORGANIZATION_POSITIONS',
      enabled: false,
      tenantEnrolled: false,
    });
    expect(Object.isFrozen(HRIS_ORGANIZATION_POSITIONS_DEFAULT_GATE)).toBe(true);
  });

  it('mounts the canonical branch independently from the management feature', () => {
    const seamStart = managerSource.indexOf('export function OrganizationExplorer');
    const managementStart = managerSource.indexOf('function ManagementOrganizationExplorer');
    const seam = managerSource.slice(seamStart, managementStart);
    const management = managerSource.slice(managementStart);

    expect(seamStart).toBeGreaterThan(-1);
    expect(managementStart).toBeGreaterThan(seamStart);
    expect(workspaceSource).toContain('<HrisOrganizationPositionsBranch adapter={adapter}');
    expect(workspaceSource).not.toContain('organization-chart-manager');
    expect(managerSource).not.toContain('HrisOrganizationPositionsBranch');
    expect(seam).not.toMatch(
      /getOrganizationChart|listOrganizationScenarios|listWorkforceOrganizationCandidates|getOrganizationIntelligence|useProductActionMutation/u
    );
    expect(management).toContain('getOrganizationChart(');
    expect(management).toContain('organizationManagementChartRequest({');
    expect(management).toContain('enabled: managementQueryPlan.chart');
    expect(management).toContain('enabled: managementQueryPlan.scenarios');
    expect(management).toContain('enabled: managementQueryPlan.candidates');
    expect(management).toContain('enabled: managementQueryPlan.intelligence');
  });

  it('keeps the canonical branch read-only and free of management owner mounts', () => {
    for (const deniedMount of [
      'listOrganizationScenarios',
      'listWorkforceOrganizationCandidates',
      'getOrganizationIntelligence',
      'addOrganizationScenarioMove',
      'addOrganizationScenarioPositionMove',
      'useProductActionMutation',
      'OrganizationScenarioDrawer',
      'OrganizationIntelligencePanel',
      'controlledExportShortcut',
    ]) {
      expect(canonicalSource).not.toContain(deniedMount);
    }
    expect(canonicalSource).toContain("relationshipType: 'REPORTING'");
    expect(canonicalSource).toContain('adapter.query(request!, signal)');
  });

  it('carries responsive, high-contrast, reduced-motion-safe, and keyboard-operable source evidence', () => {
    expect(canonicalSource).toContain("direction={{ xs: 'column', md: 'row' }}");
    expect(canonicalSource).toContain('gridTemplateColumns: { xs:');
    expect(canonicalSource).toContain("'@media (forced-colors: active)'");
    expect(canonicalSource).toContain("overflowX: 'auto'");
    expect(canonicalSource).toContain('aria-pressed={selected}');
    expect(canonicalSource).not.toMatch(/animation|transitionDuration|setTimeout/u);
  });
});
