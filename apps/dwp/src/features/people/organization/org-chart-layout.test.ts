import { describe, expect, it } from 'vitest';

import {
  initialViewportTarget,
  layoutChart,
  visibleOrganizationIds,
  visiblePersonIds,
  visiblePositionIds,
} from './org-chart-layout';

import type { Edge } from '@xyflow/react';
import type {
  OrganizationChartOrganization,
  OrganizationChartPerson,
  OrganizationChartPosition,
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
    organizationTypeName: parentOrganizationId ? 'Department' : 'Company',
    parentOrganizationId,
    directHeadcount: 1,
    totalHeadcount: 1,
    managerCount: 0,
    openPositionCount: 0,
    childOrganizationCount: 0,
    directMemberIds: [],
    layerDepth: parentOrganizationId ? 1 : 0,
    averageManagerSpan: 0,
    contingentHeadcount: 0,
    healthStatus: 'HEALTHY',
    healthSignals: [],
  };
}

function person(personId: string, managerPersonId?: string): OrganizationChartPerson {
  return {
    personId,
    assignmentKey: `assignment-${personId}`,
    displayName: personId,
    organizationId: 'root',
    managerPersonId,
    managerReferenceMissing: false,
    jobGradeOrder: 1,
    workerType: 'EMPLOYEE',
    workerStatus: 'ACTIVE',
    directReportCount: 0,
    fullTimeEquivalent: 1,
  };
}

function position(positionId: string, reportsToPositionId?: string): OrganizationChartPosition {
  return {
    positionId,
    positionKey: `position-${positionId}`,
    title: positionId,
    organizationId: 'root',
    reportsToPositionId,
    status: 'FILLED',
    positionType: 'REGULAR',
    criticality: 'STANDARD',
    budgetedFte: 1,
    incumbentPersonIds: [],
    subordinatePositionCount: 0,
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

  it('hides subordinate positions below a collapsed position', () => {
    const positions = [position('chief'), position('lead', 'chief'), position('engineer', 'lead')];

    expect(visiblePositionIds(positions, new Set(['lead']))).toEqual(new Set(['chief', 'lead']));
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
          accentColor: '',
          surfaceColor: '',
          scenarioChanged: false,
        },
      })
    );
    const edges: Edge[] = [{ id: 'edge', source: 'root', target: 'child' }];
    const result = layoutChart(nodes, edges, 'TB');

    expect(result[1].position.y).toBeGreaterThan(result[0].position.y);
    expect(Number.isFinite(result[0].position.x)).toBe(true);
  });

  it('keeps a small hierarchy fully fitted and focuses the root of a large hierarchy', () => {
    const smallNodes = ['root', 'child'].map(
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
          accentColor: '',
          surfaceColor: '',
          scenarioChanged: false,
        },
      })
    );
    expect(
      initialViewportTarget(smallNodes, [{ id: 'edge', source: 'root', target: 'child' }])
    ).toBeUndefined();

    const largeNodes = Array.from(
      { length: 9 },
      (_, index): OrgChartFlowNode => ({
        ...smallNodes[0],
        id: index === 0 ? 'root' : `child-${index}`,
      })
    );
    const largeEdges = largeNodes.slice(1).map((node) => ({
      id: `edge-${node.id}`,
      source: 'root',
      target: node.id,
    }));
    expect(initialViewportTarget(largeNodes, largeEdges)).toBe('root');
    expect(initialViewportTarget(largeNodes, largeEdges, 'child-3')).toBe('child-3');
  });
});
