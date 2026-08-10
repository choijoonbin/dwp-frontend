import { describe, expect, it } from 'vitest';

import { layoutChart, visibleOrganizationIds, visiblePersonIds } from './org-chart-layout';

import type { Edge } from '@xyflow/react';
import type {
  OrganizationChartOrganization,
  OrganizationChartPerson,
} from '@dwp-frontend/shared-utils';
import type { OrgChartFlowNode } from './org-chart-nodes';

function organization(
  organizationId: string,
  parentOrganizationId?: string
): OrganizationChartOrganization {
  return {
    organizationId,
    organizationKey: organizationId,
    name: organizationId,
    organizationType: parentOrganizationId ? 'DEPARTMENT' : 'COMPANY',
    parentOrganizationId,
    directHeadcount: 1,
    totalHeadcount: 1,
    managerCount: 0,
    openPositionCount: 0,
    childOrganizationCount: 0,
    directMemberIds: [],
  };
}

function person(personId: string, managerPersonId?: string): OrganizationChartPerson {
  return {
    personId,
    assignmentKey: `assignment-${personId}`,
    displayName: personId,
    organizationId: 'root',
    managerPersonId,
    jobGradeOrder: 1,
    workerType: 'EMPLOYEE',
    workerStatus: 'ACTIVE',
    directReportCount: 0,
  };
}

describe('organization chart visibility', () => {
  it('hides every descendant of a collapsed organization', () => {
    const organizations = [
      organization('root'),
      organization('division', 'root'),
      organization('team', 'division'),
    ];

    expect([...visibleOrganizationIds(organizations, new Set(['division']))]).toEqual([
      'root',
      'division',
    ]);
  });

  it('keeps independent reporting roots and respects manager collapse', () => {
    const people = [
      person('ceo'),
      person('lead', 'ceo'),
      person('engineer', 'lead'),
      person('independent'),
    ];

    expect(visiblePersonIds(people, new Set(['lead']))).toEqual(
      new Set(['ceo', 'lead', 'independent'])
    );
  });
});

describe('organization chart layout', () => {
  it('lays a hierarchy top-to-bottom without overlapping the rank', () => {
    const nodes = ['root', 'child'].map(
      (id): OrgChartFlowNode => ({
        id,
        type: 'organization',
        position: { x: 0, y: 0 },
        data: {
          organization: organization(id, id === 'child' ? 'root' : undefined),
          collapsed: false,
          matched: false,
          headcountLabel: '1',
          openPositionLabel: '0',
          collapseLabel: 'collapse',
          expandLabel: 'expand',
          onToggle: () => undefined,
          direction: 'TB',
        },
      })
    );
    const edges: Edge[] = [{ id: 'edge', source: 'root', target: 'child' }];
    const result = layoutChart(nodes, edges, 'TB');

    expect(result[1].position.y).toBeGreaterThan(result[0].position.y);
    expect(Number.isFinite(result[0].position.x)).toBe(true);
  });
});
