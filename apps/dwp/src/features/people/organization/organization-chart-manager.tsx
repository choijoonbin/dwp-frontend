import '@xyflow/react/dist/style.css';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { mergeFilterSearchParams } from '@dwp-frontend/design-system';
import { MarkerType, applyNodeChanges } from '@xyflow/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addOrganizationScenarioPositionMove,
  addOrganizationScenarioMove,
  getOrganizationChart,
  getOrganizationIntelligence,
  listOrganizationScenarios,
  listWorkforceOrganizationCandidates,
  useAuth,
  useToast,
} from '@dwp-frontend/shared-utils';

import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import { HcmQueryState } from '../../../components/hcm-query-state';
import {
  appendProductPageShortcutScope,
  PRODUCT_PAGE_SHORTCUT_TARGETS,
  useProductPageShortcutAccess,
} from '../../../components/product-page-shortcut-access';
import { useProductActionMutation } from '../../../components/use-product-action-mutation';
import { useProductSurfaceCapabilityAccess } from '../../../components/product-surface-capability-access';
import { useProductSurfaceRequestScope } from '../../../components/use-product-surface-request-scope';
import { type OrgChartFlowNode } from './org-chart-nodes';
import {
  initialViewportTarget,
  layoutChart,
  visibleOrganizationIds,
  visiblePersonIds,
  visiblePositionIds,
  type ChartDirection,
} from './org-chart-layout';
import { OrgChartInspector, type OrgChartSelection } from './org-chart-inspector';
import { type OrganizationIntelligenceView } from './organization-intelligence-panel';
import { OrganizationChartSurface } from './organization-chart-surface';
import {
  ORGANIZATION_LENSES,
  matchesOrganization,
  matchesPerson,
  matchesPosition,
  organizationLensLabel,
  organizationVisual,
  toggleSetValue,
  type OrganizationLens,
} from './organization-chart-visuals';
import { useCurrentProviderSupportContext } from '@dwp-frontend/shared-utils/auth/provider-support-context';
import {
  isIsoDate,
  modeForSelection,
  organizationAncestorIds,
  organizationSelectionSearchParams,
  parseChartMode,
  parseOrganizationSelection,
  personAncestorIds,
  positionAncestorIds,
  removeValues,
  type ChartMode,
} from './organization-navigation';

import type {
  Edge,
  NodeChange,
  NodeMouseHandler,
  OnNodeDrag,
  ReactFlowInstance,
} from '@xyflow/react';
import type { OrganizationScenario } from '@dwp-frontend/shared-utils';

function today(): string {
  const value = new Date();
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 10);
}

function monthBefore(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() - 1);
  return value.toISOString().slice(0, 10);
}

export type OrganizationExperience = 'directory' | 'workforce';

export function OrganizationExplorer({
  experience = 'workforce',
}: {
  experience?: OrganizationExperience;
}) {
  const { t } = useTranslation('workforce');
  const auth = useAuth();
  const capabilityAccess = useProductSurfaceCapabilityAccess();
  const controlledExportShortcut = useProductPageShortcutAccess(
    PRODUCT_PAGE_SHORTCUT_TARGETS.hcmControlledExport
  );
  const requestScope = useProductSurfaceRequestScope({
    productKey: 'hcm',
    surfaceKey: 'hcm.management',
  });
  const supportContext = useCurrentProviderSupportContext();
  const workforceView = experience === 'workforce';
  const updateScenario = useProductActionMutation('route.hcm.management.org-update.action');
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const defaultMode: ChartMode = workforceView ? 'organizations' : 'people';
  const currentDate = today();
  const serializedSearchParams = searchParams.toString();
  const requestedSelection = useMemo(
    () => parseOrganizationSelection(new URLSearchParams(serializedSearchParams)),
    [serializedSearchParams]
  );
  const mode = modeForSelection(
    requestedSelection,
    parseChartMode(searchParams.get('mode'), defaultMode)
  );
  const asOfParam = searchParams.get('asOf');
  const asOf = isIsoDate(asOfParam) ? asOfParam : currentDate;
  const compareToParam = searchParams.get('compareTo');
  const compareTo = isIsoDate(compareToParam) ? compareToParam : monthBefore(asOf);
  const rootOrganizationId = searchParams.get('root') || undefined;
  const scenarioId = workforceView ? searchParams.get('scenario') || '' : '';
  const requestedInsight = searchParams.get('insight');
  const insightView: OrganizationIntelligenceView = ['changes', 'quality'].includes(
    requestedInsight ?? ''
  )
    ? (requestedInsight as OrganizationIntelligenceView)
    : 'health';
  const requestedLens = searchParams.get('lens');
  const lens: OrganizationLens = ORGANIZATION_LENSES.includes(requestedLens as OrganizationLens)
    ? (requestedLens as OrganizationLens)
    : 'structure';
  const direction: ChartDirection = searchParams.get('direction') === 'LR' ? 'LR' : 'TB';
  const showMatrix = searchParams.get('matrix') !== 'false';
  const search = searchParams.get('q') ?? '';
  const selection: OrgChartSelection | undefined = requestedSelection;
  const updateNavigationState = useCallback(
    (values: Record<string, string | null | undefined>) => {
      setSearchParams(
        (current) => {
          const next = mergeFilterSearchParams(current, values);
          return next.toString() === current.toString() ? current : next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );
  const legacyCanManage = (auth.user?.roles ?? []).some((role) =>
    ['ADMIN', 'HR_ADMIN'].includes(role)
  );
  const scenarioCapabilities = {
    create: capabilityAccess.governed
      ? capabilityAccess.hasWritableCapability('hcm.org-design.create')
      : legacyCanManage,
    update: capabilityAccess.governed
      ? capabilityAccess.hasWritableCapability('hcm.org-design.update')
      : legacyCanManage,
    approve: capabilityAccess.governed
      ? capabilityAccess.hasWritableCapability('hcm.org-design.approve')
      : legacyCanManage,
    publish: capabilityAccess.governed
      ? capabilityAccess.hasWritableCapability('hcm.org-design.publish')
      : legacyCanManage,
  };
  const canOpenScenarios =
    workforceView && !supportContext.data && Object.values(scenarioCapabilities).some(Boolean);
  const workforceReadOnly =
    !workforceView || Boolean(supportContext.data) || !scenarioCapabilities.update;
  const toast = useToast();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const compactInspector = useMediaQuery(theme.breakpoints.down('md'));
  const [collapsedOrganizations, setCollapsedOrganizations] = useState<Set<string>>(new Set());
  const [collapsedPeople, setCollapsedPeople] = useState<Set<string>>(new Set());
  const [collapsedPositions, setCollapsedPositions] = useState<Set<string>>(new Set());
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [pendingMove, setPendingMove] = useState<{
    kind: 'organization' | 'position';
    targetId: string;
    newParentId: string;
  }>();
  const [scenarioBusy, setScenarioBusy] = useState(false);
  const [flow, setFlow] = useState<ReactFlowInstance<OrgChartFlowNode, Edge>>();
  const [renderNodes, setRenderNodes] = useState<OrgChartFlowNode[]>([]);
  const initializedChart = useRef('');
  const initializedViewport = useRef('');
  const directionWasCustomized = useRef(searchParams.has('direction'));

  const chartQuery = useQuery({
    queryKey: [
      experience,
      'organization-chart',
      asOf,
      rootOrganizationId,
      scenarioId,
      workforceView ? 'design' : '',
      ...(workforceView ? requestScope.cacheKey : []),
    ],
    queryFn: ({ signal }) =>
      getOrganizationChart({
        asOf,
        rootOrganizationId,
        scenarioId: workforceView && scenarioId ? scenarioId : undefined,
        depth: 10,
        surface: experience,
        view: workforceView ? 'design' : undefined,
        contextScopeKey: workforceView ? requestScope.contextScopeKey : undefined,
        signal,
      }),
    enabled: !workforceView || requestScope.ready,
    meta: workforceView ? requestScope.queryMeta : undefined,
  });
  const scenariosQuery = useQuery({
    queryKey: ['workforce', 'organization-scenarios', ...requestScope.cacheKey],
    queryFn: ({ signal }) => listOrganizationScenarios(requestScope.contextScopeKey, signal),
    enabled: workforceView && requestScope.ready,
    meta: requestScope.queryMeta,
  });
  const candidatesQuery = useQuery({
    queryKey: ['workforce', 'organization-chart', 'candidates', ...requestScope.cacheKey],
    queryFn: ({ signal }) =>
      listWorkforceOrganizationCandidates(requestScope.contextScopeKey, signal),
    enabled: workforceView && !workforceReadOnly && requestScope.ready,
    retry: false,
    meta: requestScope.queryMeta,
  });
  const intelligenceQuery = useQuery({
    queryKey: [
      'admin',
      'organization-chart',
      'intelligence',
      asOf,
      compareTo,
      rootOrganizationId,
      scenarioId,
      ...requestScope.cacheKey,
    ],
    queryFn: ({ signal }) =>
      getOrganizationIntelligence({
        asOf,
        compareTo,
        rootOrganizationId,
        scenarioId: scenarioId || undefined,
        depth: 10,
        contextScopeKey: requestScope.contextScopeKey,
        signal,
      }),
    enabled: workforceView && mode === 'insights' && requestScope.ready,
    meta: requestScope.queryMeta,
  });

  const chart = chartQuery.data;
  const scenarios = scenariosQuery.data ?? [];
  const selectedScenario = scenarios.find((scenario) => scenario.scenarioId === scenarioId);
  const candidatesByPersonId = useMemo(() => {
    const map = new Map(
      (candidatesQuery.data ?? []).map((candidate) => [candidate.publicId, candidate] as const)
    );
    return map;
  }, [candidatesQuery.data]);

  const toggleOrganization = useCallback((organizationId: string) => {
    setCollapsedOrganizations((current) => toggleSetValue(current, organizationId));
  }, []);
  const togglePerson = useCallback((personId: string) => {
    setCollapsedPeople((current) => toggleSetValue(current, personId));
  }, []);
  const togglePosition = useCallback((positionId: string) => {
    setCollapsedPositions((current) => toggleSetValue(current, positionId));
  }, []);

  useEffect(() => {
    if (!chart) return;
    const key = `${chart.asOf}:${chart.company.organizationId}:${chart.scenario?.scenarioId ?? 'live'}`;
    if (initializedChart.current === key) return;
    initializedChart.current = key;

    setCollapsedOrganizations(
      new Set(
        chart.organizations
          .filter(
            (organization) =>
              organization.parentOrganizationId === chart.company.organizationId &&
              organization.childOrganizationCount > 0
          )
          .map((organization) => organization.organizationId)
      )
    );
    const personIds = new Set(chart.people.map((person) => person.personId));
    const reportingRoots = new Set(
      chart.people
        .filter((person) => !person.managerPersonId || !personIds.has(person.managerPersonId))
        .map((person) => person.personId)
    );
    setCollapsedPeople(
      new Set(
        chart.people
          .filter(
            (person) =>
              Boolean(person.managerPersonId) &&
              reportingRoots.has(person.managerPersonId as string) &&
              person.directReportCount > 0
          )
          .map((person) => person.personId)
      )
    );
    const positionIds = new Set(chart.positions.map((position) => position.positionId));
    const positionRoots = new Set(
      chart.positions
        .filter(
          (position) =>
            !position.reportsToPositionId || !positionIds.has(position.reportsToPositionId)
        )
        .map((position) => position.positionId)
    );
    setCollapsedPositions(
      new Set(
        chart.positions
          .filter(
            (position) =>
              Boolean(position.reportsToPositionId) &&
              positionRoots.has(position.reportsToPositionId as string) &&
              position.subordinatePositionCount > 0
          )
          .map((position) => position.positionId)
      )
    );
  }, [chart]);

  useEffect(() => {
    if (directionWasCustomized.current) return;
    updateNavigationState({ direction: compactInspector ? 'LR' : null });
  }, [compactInspector, updateNavigationState]);

  useEffect(() => {
    if (!chart || !selection) return;
    const targetExists =
      selection.kind === 'person'
        ? chart.people.some((person) => person.personId === selection.id)
        : selection.kind === 'position'
          ? chart.positions.some((position) => position.positionId === selection.id)
          : chart.organizations.some(
              (organization) => organization.organizationId === selection.id
            );

    if (!targetExists) {
      updateNavigationState(
        rootOrganizationId ? { root: null } : organizationSelectionSearchParams(undefined)
      );
      return;
    }

    if (selection.kind === 'person') {
      setCollapsedPeople((current) =>
        removeValues(current, personAncestorIds(chart.people, selection.id))
      );
    } else if (selection.kind === 'position') {
      setCollapsedPositions((current) =>
        removeValues(current, positionAncestorIds(chart.positions, selection.id))
      );
    } else {
      setCollapsedOrganizations((current) =>
        removeValues(current, organizationAncestorIds(chart.organizations, selection.id))
      );
    }
  }, [chart, rootOrganizationId, selection, updateNavigationState]);

  const graph = useMemo(() => {
    if (!chart) return { nodes: [] as OrgChartFlowNode[], edges: [] as Edge[] };
    if (mode === 'insights') return { nodes: [] as OrgChartFlowNode[], edges: [] as Edge[] };
    const normalizedSearch = search.trim().toLocaleLowerCase();
    const organizationsById = new Map(
      chart.organizations.map((organization) => [organization.organizationId, organization])
    );
    const peopleById = new Map(chart.people.map((person) => [person.personId, person]));
    const changedOrganizationIds = new Set(
      selectedScenario?.changes
        .filter((change) => change.targetKind === 'ORGANIZATION')
        .map((change) => change.targetReference) ?? []
    );
    const changedPositionIds = new Set(
      selectedScenario?.changes
        .filter((change) => change.targetKind === 'POSITION')
        .map((change) => change.targetReference) ?? []
    );

    if (mode === 'organizations') {
      const visibleIds = visibleOrganizationIds(chart.organizations, collapsedOrganizations);
      const hierarchyEdges: Edge[] = chart.relationships
        .filter((relationship) => relationship.relationshipType === 'SUPERVISORY')
        .filter(
          (relationship) =>
            visibleIds.has(relationship.parentOrganizationId) &&
            visibleIds.has(relationship.childOrganizationId)
        )
        .map((relationship) => ({
          id: `supervisory-${relationship.parentOrganizationId}-${relationship.childOrganizationId}`,
          source: relationship.parentOrganizationId,
          target: relationship.childOrganizationId,
          type: 'smoothstep',
          style: { stroke: '#94A3B8', strokeWidth: 1.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#94A3B8', width: 14, height: 14 },
        }));
      const matrixEdges: Edge[] = showMatrix
        ? chart.relationships
            .filter((relationship) => relationship.relationshipType === 'MATRIX')
            .filter(
              (relationship) =>
                visibleIds.has(relationship.parentOrganizationId) &&
                visibleIds.has(relationship.childOrganizationId)
            )
            .map((relationship) => ({
              id: `matrix-${relationship.parentOrganizationId}-${relationship.childOrganizationId}`,
              source: relationship.parentOrganizationId,
              target: relationship.childOrganizationId,
              type: 'default',
              label: t('orgChart.legend.matrix'),
              style: { stroke: '#D55B42', strokeWidth: 1.4, strokeDasharray: '6 5' },
              labelStyle: { fill: '#9F3F2E', fontSize: 10 },
              markerEnd: { type: MarkerType.ArrowClosed, color: '#D55B42', width: 13, height: 13 },
            }))
        : [];
      const nodes: OrgChartFlowNode[] = chart.organizations
        .filter((organization) => visibleIds.has(organization.organizationId))
        .map((organization) => {
          const visual = organizationVisual(
            organization,
            lens,
            changedOrganizationIds.has(organization.organizationId),
            chart.analysis.policy
          );
          return {
            id: organization.organizationId,
            type: 'organization',
            position: { x: 0, y: 0 },
            data: {
              organization,
              leader: organization.leaderPersonId
                ? peopleById.get(organization.leaderPersonId)
                : undefined,
              collapsed: collapsedOrganizations.has(organization.organizationId),
              matched: matchesOrganization(organization, normalizedSearch),
              headcountLabel: t('orgChart.node.headcount', {
                count: organization.totalHeadcount,
              }),
              openPositionLabel: t('orgChart.node.openPositions', {
                count: organization.openPositionCount,
              }),
              collapseLabel: t('orgChart.actions.collapse'),
              expandLabel: t('orgChart.actions.expand'),
              onToggle: toggleOrganization,
              direction,
              accentColor: visual.accentColor,
              surfaceColor: visual.surfaceColor,
              lensLabel: organizationLensLabel(organization, lens, visual.changed, t),
              scenarioChanged: visual.changed,
            },
          };
        });
      return {
        nodes: layoutChart(nodes, hierarchyEdges, direction),
        edges: [...hierarchyEdges, ...matrixEdges],
      };
    }

    if (mode === 'positions') {
      const visibleIds = visiblePositionIds(chart.positions, collapsedPositions);
      const edges: Edge[] = chart.positions
        .filter(
          (position) =>
            position.reportsToPositionId &&
            visibleIds.has(position.positionId) &&
            visibleIds.has(position.reportsToPositionId)
        )
        .map((position) => ({
          id: `position-${position.reportsToPositionId}-${position.positionId}`,
          source: position.reportsToPositionId as string,
          target: position.positionId,
          type: 'smoothstep',
          style: { stroke: '#8091A3', strokeWidth: 1.35 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#8091A3', width: 13, height: 13 },
        }));
      const nodes: OrgChartFlowNode[] = chart.positions
        .filter((position) => visibleIds.has(position.positionId))
        .map((position) => ({
          id: position.positionId,
          type: 'position',
          position: { x: 0, y: 0 },
          data: {
            position,
            incumbent: position.incumbentPersonIds.length
              ? peopleById.get(position.incumbentPersonIds[0] as string)
              : undefined,
            organizationName:
              organizationsById.get(position.organizationId)?.shortName ||
              organizationsById.get(position.organizationId)?.name ||
              '',
            collapsed: collapsedPositions.has(position.positionId),
            matched: matchesPosition(position, normalizedSearch),
            statusLabel: t(`orgChart.positionStatus.${position.status}`, {
              defaultValue: position.status,
            }),
            criticalityLabel: t(`orgChart.criticality.${position.criticality}`, {
              defaultValue: position.criticality,
            }),
            subordinateLabel: t('orgChart.node.subordinatePositions', {
              count: position.subordinatePositionCount,
            }),
            collapseLabel: t('orgChart.actions.collapse'),
            expandLabel: t('orgChart.actions.expand'),
            onToggle: togglePosition,
            direction,
            scenarioChanged: changedPositionIds.has(position.positionId),
            scenarioChangeLabel: t('orgChart.legend.scenarioChange'),
          },
        }));
      return { nodes: layoutChart(nodes, edges, direction), edges };
    }

    const visibleIds = visiblePersonIds(chart.people, collapsedPeople);
    const edges: Edge[] = chart.people
      .filter(
        (person) =>
          person.managerPersonId &&
          visibleIds.has(person.personId) &&
          visibleIds.has(person.managerPersonId)
      )
      .map((person) => ({
        id: `reporting-${person.managerPersonId}-${person.personId}`,
        source: person.managerPersonId as string,
        target: person.personId,
        type: 'smoothstep',
        style: { stroke: '#8091A3', strokeWidth: 1.35 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#8091A3', width: 13, height: 13 },
      }));
    const nodes: OrgChartFlowNode[] = chart.people
      .filter((person) => visibleIds.has(person.personId))
      .map((person) => ({
        id: person.personId,
        type: 'person',
        position: { x: 0, y: 0 },
        data: {
          person,
          organizationName:
            organizationsById.get(person.organizationId)?.shortName ||
            organizationsById.get(person.organizationId)?.name ||
            '',
          collapsed: collapsedPeople.has(person.personId),
          matched: matchesPerson(person, normalizedSearch),
          reportLabel: t('orgChart.node.directReports', {
            count: person.directReportCount,
          }),
          collapseLabel: t('orgChart.actions.collapse'),
          expandLabel: t('orgChart.actions.expand'),
          onToggle: togglePerson,
          direction,
        },
      }));
    return { nodes: layoutChart(nodes, edges, direction), edges };
  }, [
    chart,
    collapsedOrganizations,
    collapsedPeople,
    collapsedPositions,
    direction,
    lens,
    mode,
    search,
    selectedScenario,
    showMatrix,
    t,
    toggleOrganization,
    togglePerson,
    togglePosition,
  ]);

  useEffect(() => {
    setRenderNodes(graph.nodes);
  }, [graph.nodes]);

  useEffect(() => {
    if (mode === 'insights' || !flow || !graph.nodes.length) return;
    const selectedNodeId =
      selection &&
      ((selection.kind === 'person' && mode === 'people') ||
        (selection.kind === 'position' && mode === 'positions') ||
        (selection.kind === 'organization' && mode === 'organizations'))
        ? selection.id
        : undefined;
    if (selectedNodeId && !graph.nodes.some((node) => node.id === selectedNodeId)) return;
    const viewportKey = [
      chart?.asOf,
      chart?.company.organizationId,
      chart?.scenario?.scenarioId ?? 'live',
      rootOrganizationId ?? 'company',
      mode,
      lens,
      direction,
      selectedNodeId ?? 'unselected',
    ].join(':');
    if (initializedViewport.current === viewportKey) return;
    initializedViewport.current = viewportKey;
    const timer = window.setTimeout(() => {
      const preferredNodeId =
        selectedNodeId ?? (mode === 'organizations' ? chart?.company.organizationId : undefined);
      const focusNodeId = initialViewportTarget(graph.nodes, graph.edges, preferredNodeId);
      if (selectedNodeId || focusNodeId) {
        void flow.fitView({
          nodes: [{ id: selectedNodeId ?? (focusNodeId as string) }],
          padding: selectedNodeId ? 0.75 : 1.1,
          duration: 420,
          minZoom: selectedNodeId ? 0.76 : 0.72,
          maxZoom: selectedNodeId ? 1.18 : 0.92,
        });
        return;
      }
      void flow.fitView({ padding: 0.18, duration: 380, maxZoom: 1.05 });
    }, 40);
    return () => window.clearTimeout(timer);
  }, [chart, direction, flow, graph.edges, graph.nodes, lens, mode, rootOrganizationId, selection]);

  const handleNodeClick: NodeMouseHandler<OrgChartFlowNode> = (_event, node) => {
    updateNavigationState(
      organizationSelectionSearchParams({
        kind:
          node.type === 'person'
            ? 'person'
            : node.type === 'position'
              ? 'position'
              : 'organization',
        id: node.id,
      })
    );
  };

  const handleNodeChanges = (changes: NodeChange<OrgChartFlowNode>[]) => {
    setRenderNodes((current) => applyNodeChanges(changes, current));
  };

  const handleNodeDragStop: OnNodeDrag<OrgChartFlowNode> = (_event, node) => {
    const draggableKind =
      node.type === 'organization' && mode === 'organizations'
        ? 'organization'
        : node.type === 'position' && mode === 'positions'
          ? 'position'
          : undefined;
    if (
      workforceReadOnly ||
      !draggableKind ||
      selectedScenario?.lifecycleState !== 'DRAFT' ||
      (draggableKind === 'organization' && node.id === chart?.company.organizationId)
    ) {
      setRenderNodes(graph.nodes);
      return;
    }
    const target = flow
      ?.getIntersectingNodes(node)
      .find((candidate) => candidate.type === node.type && candidate.id !== node.id);
    if (!target) {
      setRenderNodes(graph.nodes);
      return;
    }
    const currentParentId =
      draggableKind === 'organization'
        ? chart?.organizations.find((candidate) => candidate.organizationId === node.id)
            ?.parentOrganizationId
        : chart?.positions.find((candidate) => candidate.positionId === node.id)
            ?.reportsToPositionId;
    if (currentParentId === target.id) {
      setRenderNodes(graph.nodes);
      return;
    }
    setPendingMove({ kind: draggableKind, targetId: node.id, newParentId: target.id });
  };

  const focusSearchResult = () => {
    if (!chart || !search.trim()) return;
    const needle = search.trim().toLocaleLowerCase();
    const organization = chart.organizations.find((candidate) =>
      matchesOrganization(candidate, needle)
    );
    const person = chart.people.find((candidate) => matchesPerson(candidate, needle));
    const position = chart.positions.find((candidate) => matchesPosition(candidate, needle));
    const targetId =
      mode === 'people'
        ? person?.personId
        : mode === 'positions'
          ? position?.positionId
          : organization?.organizationId;
    const fallbackId = mode === 'organizations' ? person?.organizationId : undefined;
    const id = targetId ?? fallbackId;
    if (!id) return;
    updateNavigationState(
      organizationSelectionSearchParams({
        kind: mode === 'people' ? 'person' : mode === 'positions' ? 'position' : 'organization',
        id,
      })
    );
    void flow?.fitView({ nodes: [{ id }], padding: 0.75, duration: 480, maxZoom: 1.2 });
  };

  if (chartQuery.isLoading) return <HcmQueryState loading size="page" />;
  if (chartQuery.isError || !chart) {
    return (
      <HcmQueryState
        error={chartQuery.error ?? true}
        retrying={chartQuery.isFetching}
        onRetry={() => void chartQuery.refetch()}
      />
    );
  }

  const collapseAll = () => {
    if (mode === 'organizations') {
      setCollapsedOrganizations(
        new Set(
          chart.organizations
            .filter((organization) => organization.childOrganizationCount > 0)
            .map((organization) => organization.organizationId)
        )
      );
    } else if (mode === 'people') {
      setCollapsedPeople(
        new Set(
          chart.people
            .filter((person) => person.directReportCount > 0)
            .map((person) => person.personId)
        )
      );
    } else if (mode === 'positions') {
      setCollapsedPositions(
        new Set(
          chart.positions
            .filter((position) => position.subordinatePositionCount > 0)
            .map((position) => position.positionId)
        )
      );
    }
  };
  const expandAll = () => {
    if (mode === 'organizations') setCollapsedOrganizations(new Set());
    else if (mode === 'people') setCollapsedPeople(new Set());
    else if (mode === 'positions') setCollapsedPositions(new Set());
  };

  const copyViewLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success(t('orgChart.actions.copyViewLinkSuccess'));
    } catch {
      toast.error(t('orgChart.actions.copyViewLinkError'));
    }
  };

  const confirmScenarioMove = async () => {
    if (!pendingMove || !selectedScenario) return;
    setScenarioBusy(true);
    try {
      const next =
        pendingMove.kind === 'organization'
          ? await updateScenario((authority) =>
              addOrganizationScenarioMove(
                selectedScenario,
                pendingMove.targetId,
                pendingMove.newParentId,
                authority
              )
            )
          : await updateScenario((authority) =>
              addOrganizationScenarioPositionMove(
                selectedScenario,
                pendingMove.targetId,
                pendingMove.newParentId,
                authority
              )
            );
      queryClient.setQueryData<OrganizationScenario[]>(
        ['workforce', 'organization-scenarios', ...requestScope.cacheKey],
        (current = []) => current.map((item) => (item.scenarioId === next.scenarioId ? next : item))
      );
      await queryClient.invalidateQueries({ queryKey: ['workforce', 'organization-chart'] });
      toast.success(
        t(
          pendingMove.kind === 'organization'
            ? 'orgChart.scenarios.messages.moveAdded'
            : 'orgChart.scenarios.messages.positionMoveAdded'
        )
      );
      setPendingMove(undefined);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t('common.operationError'));
    } finally {
      setScenarioBusy(false);
      setRenderNodes(graph.nodes);
    }
  };

  const inspector = selection ? (
    <OrgChartInspector
      chart={chart}
      selection={selection}
      candidatesByPersonId={candidatesByPersonId}
      onClose={() => updateNavigationState(organizationSelectionSearchParams(undefined))}
      onSelect={(nextSelection) =>
        updateNavigationState(organizationSelectionSearchParams(nextSelection))
      }
      onFocusOrganization={(organizationId) => {
        updateNavigationState({
          root: organizationId,
          ...organizationSelectionSearchParams(undefined),
        });
        setCollapsedOrganizations(new Set());
      }}
    />
  ) : null;

  return (
    <OrganizationChartSurface
      workforceView={workforceView}
      chart={chart}
      mode={mode}
      defaultMode={defaultMode}
      selectedScenario={selectedScenario}
      rootOrganizationId={rootOrganizationId}
      currentDate={currentDate}
      refreshing={chartQuery.isFetching || intelligenceQuery.isFetching}
      onRefresh={() => {
        void chartQuery.refetch();
        if (mode === 'insights') void intelligenceQuery.refetch();
      }}
      updateNavigationState={updateNavigationState}
      search={search}
      onFocusSearchResult={focusSearchResult}
      scenarios={scenarios}
      scenarioId={scenarioId}
      lens={lens}
      showMatrix={showMatrix}
      asOf={asOf}
      compareTo={compareTo}
      defaultCompareTo={monthBefore(asOf)}
      direction={direction}
      onToggleDirection={() => {
        directionWasCustomized.current = true;
        updateNavigationState({ direction: direction === 'TB' ? 'LR' : null });
      }}
      onCollapseAll={collapseAll}
      onExpandAll={expandAll}
      canOpenScenarios={canOpenScenarios}
      onOpenScenarios={() => setScenarioOpen(true)}
      onCopyViewLink={() => void copyViewLink()}
      selection={selection}
      compactInspector={compactInspector}
      intelligence={intelligenceQuery.data}
      intelligenceLoading={intelligenceQuery.isLoading}
      intelligenceError={
        intelligenceQuery.error instanceof Error ? intelligenceQuery.error.message : undefined
      }
      insightView={insightView}
      onRequestIntelligenceExport={
        controlledExportShortcut.disclosed
          ? () => {
              const params = new URLSearchParams({
                dataset: 'ORGANIZATION_INTELLIGENCE',
                view: insightView,
                asOf: intelligenceQuery.data?.asOf ?? asOf,
                compareTo,
              });
              if (scenarioId) params.set('scenarioId', scenarioId);
              if (rootOrganizationId) params.set('rootOrganizationId', rootOrganizationId);
              navigate(
                appendProductPageShortcutScope(
                  `/hr/data/exports?${params.toString()}`,
                  controlledExportShortcut
                )
              );
            }
          : undefined
      }
      renderNodes={renderNodes}
      edges={graph.edges}
      onFlowInit={setFlow}
      onNodesChange={handleNodeChanges}
      onNodeClick={handleNodeClick}
      onNodeDragStop={handleNodeDragStop}
      inspector={inspector}
      scenarioOpen={scenarioOpen}
      scenarioCapabilities={scenarioCapabilities}
      currentUserId={auth.user?.userId}
      onScenarioChanged={() => {
        void queryClient.invalidateQueries({ queryKey: ['workforce', 'organization-chart'] });
      }}
      onCloseScenarios={() => setScenarioOpen(false)}
      pendingMove={pendingMove}
      scenarioBusy={scenarioBusy}
      onCancelPendingMove={() => {
        if (scenarioBusy) return;
        setPendingMove(undefined);
        setRenderNodes(graph.nodes);
      }}
      onConfirmScenarioMove={() => void confirmScenarioMove()}
    />
  );
}
