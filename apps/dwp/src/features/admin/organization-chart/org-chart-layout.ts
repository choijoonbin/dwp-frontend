import dagre from '@dagrejs/dagre';

import {
  ORGANIZATION_NODE_HEIGHT,
  ORGANIZATION_NODE_WIDTH,
  PERSON_NODE_HEIGHT,
  PERSON_NODE_WIDTH,
  POSITION_NODE_HEIGHT,
  POSITION_NODE_WIDTH,
} from './org-chart-nodes';

import type { Edge } from '@xyflow/react';
import type {
  OrganizationChartOrganization,
  OrganizationChartPerson,
  OrganizationChartPosition,
} from '@dwp-frontend/shared-utils';
import type { OrgChartFlowNode } from './org-chart-nodes';

export type ChartDirection = 'TB' | 'LR';

export function visibleOrganizationIds(
  organizations: OrganizationChartOrganization[],
  collapsed: ReadonlySet<string>
): Set<string> {
  const known = new Set(organizations.map((organization) => organization.organizationId));
  const children = new Map<string, string[]>();
  const roots: string[] = [];
  for (const organization of organizations) {
    const parentId = organization.parentOrganizationId;
    if (!parentId || !known.has(parentId)) {
      roots.push(organization.organizationId);
      continue;
    }
    children.set(parentId, [...(children.get(parentId) ?? []), organization.organizationId]);
  }
  return traverseVisible(roots, children, collapsed);
}

export function visiblePersonIds(
  people: OrganizationChartPerson[],
  collapsed: ReadonlySet<string>
): Set<string> {
  const known = new Set(people.map((person) => person.personId));
  const children = new Map<string, string[]>();
  const roots: string[] = [];
  for (const person of people) {
    const managerId = person.managerPersonId;
    if (!managerId || !known.has(managerId)) {
      roots.push(person.personId);
      continue;
    }
    children.set(managerId, [...(children.get(managerId) ?? []), person.personId]);
  }
  return traverseVisible(roots, children, collapsed);
}

export function visiblePositionIds(
  positions: OrganizationChartPosition[],
  collapsed: ReadonlySet<string>
): Set<string> {
  const known = new Set(positions.map((position) => position.positionId));
  const children = new Map<string, string[]>();
  const roots: string[] = [];
  for (const position of positions) {
    const parentId = position.reportsToPositionId;
    if (!parentId || !known.has(parentId)) {
      roots.push(position.positionId);
      continue;
    }
    children.set(parentId, [...(children.get(parentId) ?? []), position.positionId]);
  }
  return traverseVisible(roots, children, collapsed);
}

function traverseVisible(
  roots: string[],
  children: ReadonlyMap<string, string[]>,
  collapsed: ReadonlySet<string>
): Set<string> {
  const visible = new Set<string>();
  const queue = [...roots];
  while (queue.length) {
    const current = queue.shift();
    if (!current || visible.has(current)) continue;
    visible.add(current);
    if (!collapsed.has(current)) queue.push(...(children.get(current) ?? []));
  }
  return visible;
}

export function layoutChart(
  nodes: OrgChartFlowNode[],
  edges: Edge[],
  direction: ChartDirection
): OrgChartFlowNode[] {
  const graph = new dagre.graphlib.Graph()
    .setDefaultEdgeLabel(() => ({}))
    .setGraph({
      rankdir: direction,
      ranksep: direction === 'TB' ? 74 : 90,
      nodesep: direction === 'TB' ? 34 : 42,
      edgesep: 20,
      marginx: 28,
      marginy: 28,
    });

  for (const node of nodes) {
    const organizationNode = node.type === 'organization';
    const positionNode = node.type === 'position';
    graph.setNode(node.id, {
      width: organizationNode
        ? ORGANIZATION_NODE_WIDTH
        : positionNode
          ? POSITION_NODE_WIDTH
          : PERSON_NODE_WIDTH,
      height: organizationNode
        ? ORGANIZATION_NODE_HEIGHT
        : positionNode
          ? POSITION_NODE_HEIGHT
          : PERSON_NODE_HEIGHT,
    });
  }
  for (const edge of edges) graph.setEdge(edge.source, edge.target);
  dagre.layout(graph);

  return nodes.map((node) => {
    const position = graph.node(node.id) as { x: number; y: number };
    const organizationNode = node.type === 'organization';
    const positionNode = node.type === 'position';
    const width = organizationNode
      ? ORGANIZATION_NODE_WIDTH
      : positionNode
        ? POSITION_NODE_WIDTH
        : PERSON_NODE_WIDTH;
    const height = organizationNode
      ? ORGANIZATION_NODE_HEIGHT
      : positionNode
        ? POSITION_NODE_HEIGHT
        : PERSON_NODE_HEIGHT;
    return {
      ...node,
      position: { x: position.x - width / 2, y: position.y - height / 2 },
    };
  });
}
