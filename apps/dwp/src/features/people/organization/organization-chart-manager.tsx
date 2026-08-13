import '@xyflow/react/dist/style.css';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { formatNumber, useDisplayDictionary } from '@dwp-frontend/shared-i18n';
import { ActionIconButton, mergeFilterSearchParams } from '@dwp-frontend/design-system';
import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CircleDollarSign,
  Columns3,
  GitCompareArrows,
  GitPullRequest,
  LocateFixed,
  MapPin,
  Network,
  RefreshCw,
  Rows3,
  Search,
  Share2,
  SlidersHorizontal,
  Undo2,
  UserRound,
  UsersRound,
} from 'lucide-react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  applyNodeChanges,
} from '@xyflow/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addOrganizationScenarioPositionMove,
  addOrganizationScenarioMove,
  getOrganizationChart,
  getOrganizationIntelligence,
  listIdentityUsers,
  listOrganizationScenarios,
  useAuth,
  useToast,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Drawer from '@mui/material/Drawer';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import { AdminPanelError, AdminPanelLoading } from '../../admin/admin-ui';
import {
  OrganizationNode,
  PersonNode,
  PositionNode,
  type OrgChartFlowNode,
} from './org-chart-nodes';
import {
  initialViewportTarget,
  layoutChart,
  visibleOrganizationIds,
  visiblePersonIds,
  visiblePositionIds,
  type ChartDirection,
} from './org-chart-layout';
import { OrgChartInspector, type OrgChartSelection } from './org-chart-inspector';
import {
  OrganizationIntelligencePanel,
  type OrganizationIntelligenceView,
} from './organization-intelligence-panel';
import { OrganizationDesignOverview } from './organization-design-overview';
import { OrganizationScenarioDrawer } from './organization-scenario-drawer';
import { useCurrentProviderSupportContext } from '../../provider/use-provider-support-context';
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
import type { LucideIcon } from 'lucide-react';
import type { TFunction } from 'i18next';
import type {
  OrganizationChartOrganization,
  OrganizationDesignPolicy,
  OrganizationScenario,
} from '@dwp-frontend/shared-utils';

type OrganizationLens = 'structure' | 'health' | 'headcount' | 'span' | 'vacancy' | 'changes';
const ORGANIZATION_LENSES: readonly OrganizationLens[] = [
  'structure',
  'health',
  'headcount',
  'span',
  'vacancy',
  'changes',
];

const nodeTypes = {
  organization: OrganizationNode,
  person: PersonNode,
  position: PositionNode,
};

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

function compactMoney(value: number, currency?: string | null): string {
  return formatNumber(value, {
    style: currency && currency !== 'MIXED' ? 'currency' : 'decimal',
    currency: currency && currency !== 'MIXED' ? currency : undefined,
    notation: 'compact',
    maximumFractionDigits: 1,
  });
}

function Metric({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      gap={1}
      sx={{ minWidth: 140, px: 2, py: 1.2, borderRight: 1, borderColor: 'divider' }}
    >
      <Box sx={{ color, display: 'grid', placeItems: 'center' }}>
        <Icon size={18} strokeWidth={1.8} />
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" display="block">
          {label}
        </Typography>
        <Typography component="p" variant="subtitle2" fontWeight={750}>
          {typeof value === 'number' ? formatNumber(value) : value}
        </Typography>
      </Box>
    </Stack>
  );
}

export type OrganizationExperience = 'directory' | 'workforce';

export function OrganizationExplorer({
  experience = 'workforce',
}: {
  experience?: OrganizationExperience;
}) {
  const { t } = useTranslation('workforce');
  const display = useDisplayDictionary();
  const auth = useAuth();
  const supportContext = useCurrentProviderSupportContext();
  const workforceView = experience === 'workforce';
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
  const canManageWorkforce = (auth.user?.roles ?? []).some((role) =>
    ['ADMIN', 'HR_ADMIN'].includes(role)
  );
  const workforceReadOnly = !workforceView || Boolean(supportContext.data) || !canManageWorkforce;
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
    queryKey: [experience, 'organization-chart', asOf, rootOrganizationId, scenarioId],
    queryFn: () =>
      getOrganizationChart({
        asOf,
        rootOrganizationId,
        scenarioId: workforceView && scenarioId ? scenarioId : undefined,
        depth: 10,
        surface: experience,
      }),
  });
  const scenariosQuery = useQuery({
    queryKey: ['workforce', 'organization-scenarios'],
    queryFn: listOrganizationScenarios,
    enabled: workforceView,
  });
  const identitiesQuery = useQuery({
    queryKey: ['workforce', 'organization-chart', 'identity-roles'],
    queryFn: () => listIdentityUsers(),
    enabled: workforceView && !workforceReadOnly,
    retry: false,
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
    ],
    queryFn: () =>
      getOrganizationIntelligence({
        asOf,
        compareTo,
        rootOrganizationId,
        scenarioId: scenarioId || undefined,
        depth: 10,
      }),
    enabled: workforceView && mode === 'insights',
  });

  const chart = chartQuery.data;
  const scenarios = scenariosQuery.data ?? [];
  const selectedScenario = scenarios.find((scenario) => scenario.scenarioId === scenarioId);
  const rolesByEmail = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const identity of identitiesQuery.data?.content ?? []) {
      if (identity.email) map.set(identity.email.toLowerCase(), identity.roles);
    }
    return map;
  }, [identitiesQuery.data]);

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

  if (chartQuery.isLoading) return <AdminPanelLoading label={t('orgChart.loading')} />;
  if (chartQuery.isError || !chart) {
    return (
      <AdminPanelError
        message={
          chartQuery.error instanceof Error ? chartQuery.error.message : t('common.operationError')
        }
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
          ? await addOrganizationScenarioMove(
              selectedScenario,
              pendingMove.targetId,
              pendingMove.newParentId
            )
          : await addOrganizationScenarioPositionMove(
              selectedScenario,
              pendingMove.targetId,
              pendingMove.newParentId
            );
      queryClient.setQueryData<OrganizationScenario[]>(
        ['workforce', 'organization-scenarios'],
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
      rolesByEmail={rolesByEmail}
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
    <Stack gap={workforceView ? 2 : 0}>
      {workforceView && (
        <OrganizationDesignOverview
          chart={chart}
          mode={mode}
          scenario={selectedScenario}
          rootOrganizationId={rootOrganizationId}
          currentDate={currentDate}
          fetching={chartQuery.isFetching || intelligenceQuery.isFetching}
          onRefresh={() => {
            void chartQuery.refetch();
            if (mode === 'insights') void intelligenceQuery.refetch();
          }}
          onOpenInsight={(nextInsight) =>
            updateNavigationState({
              mode: 'insights',
              insight: nextInsight === 'health' ? null : nextInsight,
              ...organizationSelectionSearchParams(undefined),
            })
          }
        />
      )}
      <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
        <Box
          role="region"
          tabIndex={0}
          aria-label={t('orgChart.metrics.summaryLabel')}
          sx={{ overflowX: 'auto', borderBottom: 1, borderColor: 'divider' }}
        >
          <Stack direction="row" sx={{ minWidth: 'max-content' }}>
            <Metric
              icon={UsersRound}
              label={t('orgChart.metrics.headcount')}
              value={chart.metrics.headcount}
              color="#2563EB"
            />
            <Metric
              icon={Building2}
              label={t('orgChart.metrics.organizations')}
              value={chart.metrics.organizationCount}
              color="#0F8A7B"
            />
            <Metric
              icon={UserRound}
              label={t('orgChart.metrics.managers')}
              value={chart.metrics.managerCount}
              color="#7C3AED"
            />
            {workforceView && (
              <Metric
                icon={BriefcaseBusiness}
                label={t('orgChart.metrics.openPositions')}
                value={chart.metrics.openPositionCount}
                color="#B7791F"
              />
            )}
            <Metric
              icon={MapPin}
              label={t('orgChart.metrics.locations')}
              value={chart.metrics.locationCount}
              color="#D55B42"
            />
            {workforceView && (
              <Metric
                icon={BriefcaseBusiness}
                label={t('orgChart.metrics.plannedFte')}
                value={chart.metrics.plannedFte.toFixed(1)}
                color="#0F766E"
              />
            )}
            {workforceView && (
              <Metric
                icon={CircleDollarSign}
                label={t('orgChart.metrics.workforceCost')}
                value={compactMoney(chart.metrics.workforceCostAmount, chart.metrics.costCurrency)}
                color="#9A6700"
              />
            )}
          </Stack>
        </Box>

        {workforceView && chart.scenario && (
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            alignItems={{ xs: 'flex-start', md: 'center' }}
            justifyContent="space-between"
            gap={1}
            sx={{ px: 1.5, py: 1, bgcolor: '#F5F3FF', borderBottom: 1, borderColor: '#DDD6FE' }}
          >
            <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" useFlexGap>
              <GitPullRequest size={16} color="#6D28D9" />
              <Typography variant="body2" fontWeight={750}>
                {chart.scenario.name}
              </Typography>
              <Chip
                size="small"
                variant="outlined"
                color={chart.scenario.lifecycleState === 'DRAFT' ? 'warning' : 'info'}
                label={display('states', chart.scenario.lifecycleState)}
              />
              <Typography variant="caption" color="text.secondary">
                {t('orgChart.scenarios.previewSummary', {
                  date: chart.scenario.effectiveDate,
                  count: chart.scenario.activeChangeCount,
                })}
              </Typography>
            </Stack>
            <Button
              size="small"
              startIcon={<Undo2 size={14} />}
              onClick={() => updateNavigationState({ scenario: null })}
            >
              {t('orgChart.scenarios.returnLive')}
            </Button>
          </Stack>
        )}

        <Stack
          direction={{ xs: 'column', xl: 'row' }}
          alignItems={{ xs: 'stretch', xl: 'center' }}
          justifyContent="space-between"
          gap={1.25}
          sx={{ px: 1.5, py: 1.25, borderBottom: 1, borderColor: 'divider' }}
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} gap={1}>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={mode}
              aria-label={t('orgChart.view.label')}
              sx={{
                width: { xs: 1, sm: 'auto' },
                '& .MuiToggleButton-root': {
                  flex: { xs: 1, sm: 'initial' },
                  minWidth: { xs: 44, sm: 'auto' },
                  px: { xs: 1, sm: 1.25 },
                },
              }}
              onChange={(_event, value: ChartMode | null) => {
                if (!value) return;
                updateNavigationState({
                  mode: value === defaultMode ? null : value,
                  insight: value === 'insights' ? undefined : null,
                  ...organizationSelectionSearchParams(undefined),
                });
              }}
            >
              <ToggleButton
                value="organizations"
                aria-label={t('orgChart.view.organizations')}
                title={t('orgChart.view.organizations')}
              >
                <Building2 size={15} />
                <Box component="span" sx={{ ml: 0.75, display: { xs: 'none', sm: 'inline' } }}>
                  {t('orgChart.view.organizations')}
                </Box>
              </ToggleButton>
              <ToggleButton
                value="people"
                aria-label={t('orgChart.view.people')}
                title={t('orgChart.view.people')}
              >
                <UsersRound size={15} />
                <Box component="span" sx={{ ml: 0.75, display: { xs: 'none', sm: 'inline' } }}>
                  {t('orgChart.view.people')}
                </Box>
              </ToggleButton>
              {workforceView && (
                <ToggleButton
                  value="positions"
                  aria-label={t('orgChart.view.positions')}
                  title={t('orgChart.view.positions')}
                >
                  <BriefcaseBusiness size={15} />
                  <Box component="span" sx={{ ml: 0.75, display: { xs: 'none', sm: 'inline' } }}>
                    {t('orgChart.view.positions')}
                  </Box>
                </ToggleButton>
              )}
              {workforceView && (
                <ToggleButton
                  value="insights"
                  aria-label={t('orgChart.view.insights')}
                  title={t('orgChart.view.insights')}
                >
                  <GitCompareArrows size={15} />
                  <Box component="span" sx={{ ml: 0.75, display: { xs: 'none', sm: 'inline' } }}>
                    {t('orgChart.view.insights')}
                  </Box>
                </ToggleButton>
              )}
            </ToggleButtonGroup>
            {mode !== 'insights' && (
              <TextField
                size="small"
                value={search}
                onChange={(event) => updateNavigationState({ q: event.target.value || null })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') focusSearchResult();
                }}
                placeholder={t('orgChart.search')}
                inputProps={{ 'aria-label': t('orgChart.search') }}
                sx={{ width: { xs: 1, sm: 260 } }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search size={16} />
                    </InputAdornment>
                  ),
                }}
              />
            )}
            {rootOrganizationId && (
              <Button
                size="small"
                startIcon={<Undo2 size={15} />}
                onClick={() => {
                  updateNavigationState({
                    root: null,
                    ...organizationSelectionSearchParams(undefined),
                  });
                }}
              >
                {t('orgChart.actions.showCompany')}
              </Button>
            )}
          </Stack>

          <Stack
            direction="row"
            alignItems="center"
            gap={0.4}
            flexWrap="wrap"
            useFlexGap
            sx={{ width: { xs: 1, xl: 'auto' } }}
          >
            {workforceView && (
              <TextField
                select
                size="small"
                value={scenarioId}
                onChange={(event) => {
                  const nextScenarioId = event.target.value;
                  const scenario = scenarios.find((item) => item.scenarioId === nextScenarioId);
                  updateNavigationState({
                    scenario: nextScenarioId || null,
                    asOf: scenario?.baselineDate ?? null,
                    compareTo: scenario?.baselineDate ?? null,
                    root: null,
                    ...organizationSelectionSearchParams(undefined),
                  });
                }}
                inputProps={{ 'aria-label': t('orgChart.scenarios.preview') }}
                SelectProps={{ displayEmpty: true }}
                sx={{ width: { xs: 1, sm: 210 } }}
              >
                <MenuItem value="">{t('orgChart.scenarios.live')}</MenuItem>
                {scenarios.map((scenario) => (
                  <MenuItem key={scenario.scenarioId} value={scenario.scenarioId}>
                    {scenario.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
            {mode === 'organizations' && (
              <TextField
                select
                size="small"
                value={lens}
                onChange={(event) =>
                  updateNavigationState({
                    lens: event.target.value === 'structure' ? null : event.target.value,
                  })
                }
                inputProps={{ 'aria-label': t('orgChart.lenses.label') }}
                sx={{ width: { xs: 1, sm: 150 } }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SlidersHorizontal size={14} />
                    </InputAdornment>
                  ),
                }}
              >
                {(['structure', 'health', 'headcount', 'span', 'vacancy'] as const).map((item) => (
                  <MenuItem key={item} value={item}>
                    {t(`orgChart.lenses.${item}`)}
                  </MenuItem>
                ))}
                <MenuItem value="changes" disabled={!scenarioId}>
                  {t('orgChart.lenses.changes')}
                </MenuItem>
              </TextField>
            )}
            {mode === 'organizations' && (
              <FormControlLabel
                sx={{ mr: 0.5 }}
                control={
                  <Switch
                    size="small"
                    checked={showMatrix}
                    onChange={(event) =>
                      updateNavigationState({ matrix: event.target.checked ? null : 'false' })
                    }
                  />
                }
                label={<Typography variant="caption">{t('orgChart.actions.matrix')}</Typography>}
              />
            )}
            <TextField
              size="small"
              type="date"
              value={asOf}
              disabled={Boolean(scenarioId)}
              onChange={(event) => {
                updateNavigationState({
                  asOf: event.target.value === currentDate ? null : event.target.value,
                  compareTo: null,
                  ...organizationSelectionSearchParams(undefined),
                });
              }}
              inputProps={{ 'aria-label': t('orgChart.filters.asOf') }}
              sx={{ width: { xs: 1, sm: 172 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <CalendarDays size={15} />
                  </InputAdornment>
                ),
              }}
            />
            {mode === 'insights' && !scenarioId && (
              <TextField
                size="small"
                type="date"
                label={t('orgChart.filters.compareTo')}
                value={compareTo}
                onChange={(event) =>
                  updateNavigationState({
                    compareTo: event.target.value === monthBefore(asOf) ? null : event.target.value,
                  })
                }
                inputProps={{ 'aria-label': t('orgChart.filters.compareTo') }}
                InputLabelProps={{ shrink: true }}
                sx={{ width: { xs: 1, sm: 172 } }}
              />
            )}
            {mode !== 'insights' && (
              <>
                <Tooltip title={t('orgChart.actions.changeDirection')}>
                  <IconButton
                    size="small"
                    aria-label={t('orgChart.actions.changeDirection')}
                    onClick={() => {
                      directionWasCustomized.current = true;
                      updateNavigationState({ direction: direction === 'TB' ? 'LR' : null });
                    }}
                  >
                    {direction === 'TB' ? <Rows3 size={17} /> : <Columns3 size={17} />}
                  </IconButton>
                </Tooltip>
                <Tooltip title={t('orgChart.actions.collapseAll')}>
                  <IconButton
                    size="small"
                    aria-label={t('orgChart.actions.collapseAll')}
                    onClick={collapseAll}
                  >
                    <Network size={17} />
                  </IconButton>
                </Tooltip>
                <Tooltip title={t('orgChart.actions.expandAll')}>
                  <IconButton
                    size="small"
                    aria-label={t('orgChart.actions.expandAll')}
                    onClick={expandAll}
                  >
                    <LocateFixed size={17} />
                  </IconButton>
                </Tooltip>
              </>
            )}
            {workforceView && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<GitPullRequest size={15} />}
                disabled={workforceReadOnly}
                onClick={() => setScenarioOpen(true)}
              >
                {t('orgChart.actions.scenarios')}
              </Button>
            )}
            <ActionIconButton
              size="small"
              label={t('orgChart.actions.copyViewLink')}
              onClick={() => void copyViewLink()}
            >
              <Share2 size={17} />
            </ActionIconButton>
            <Tooltip title={t('common.actions.refresh')}>
              <IconButton
                size="small"
                aria-label={t('common.actions.refresh')}
                onClick={() => {
                  void chartQuery.refetch();
                  if (mode === 'insights') void intelligenceQuery.refetch();
                }}
              >
                <RefreshCw size={17} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        <Box
          sx={{
            height: { xs: 620, lg: 'clamp(600px, calc(100vh - 340px), 780px)' },
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns:
              selection && !compactInspector ? 'minmax(0, 1fr) 350px' : 'minmax(0, 1fr)',
          }}
        >
          <Box sx={{ minWidth: 0, minHeight: 0, position: 'relative', bgcolor: '#F7F9FB' }}>
            {mode === 'insights' ? (
              <OrganizationIntelligencePanel
                intelligence={intelligenceQuery.data}
                loading={intelligenceQuery.isLoading}
                error={
                  intelligenceQuery.error instanceof Error
                    ? intelligenceQuery.error.message
                    : undefined
                }
                view={insightView}
                onViewChange={(nextInsight) =>
                  updateNavigationState({ insight: nextInsight === 'health' ? null : nextInsight })
                }
                onSelect={(nextSelection) => {
                  const nextMode =
                    nextSelection.kind === 'person'
                      ? 'people'
                      : nextSelection.kind === 'position'
                        ? 'positions'
                        : 'organizations';
                  updateNavigationState({
                    mode: nextMode === defaultMode ? null : nextMode,
                    insight: null,
                    ...organizationSelectionSearchParams(nextSelection),
                  });
                }}
                onRequestExport={() => {
                  const params = new URLSearchParams({
                    dataset: 'ORGANIZATION_INTELLIGENCE',
                    view: insightView,
                    asOf: intelligenceQuery.data?.asOf ?? asOf,
                    compareTo,
                  });
                  if (scenarioId) params.set('scenarioId', scenarioId);
                  if (rootOrganizationId) params.set('rootOrganizationId', rootOrganizationId);
                  navigate(`/workforce/exports?${params.toString()}`);
                }}
              />
            ) : (
              <>
                <ReactFlow<OrgChartFlowNode, Edge>
                  nodes={renderNodes}
                  edges={graph.edges}
                  nodeTypes={nodeTypes}
                  onInit={setFlow}
                  onNodesChange={handleNodeChanges}
                  onNodeClick={handleNodeClick}
                  onNodeDragStop={handleNodeDragStop}
                  nodesDraggable={
                    (mode === 'organizations' || mode === 'positions') &&
                    selectedScenario?.lifecycleState === 'DRAFT'
                  }
                  nodesConnectable={false}
                  elementsSelectable
                  fitView
                  fitViewOptions={{ padding: 0.15, maxZoom: 1.05 }}
                  minZoom={0.18}
                  maxZoom={1.8}
                  proOptions={{ hideAttribution: true }}
                  aria-label={t('orgChart.canvasLabel')}
                >
                  <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#CBD5E1" />
                  <MiniMap
                    pannable
                    zoomable
                    nodeStrokeWidth={2}
                    nodeColor={(node) =>
                      node.type === 'organization'
                        ? '#C9D7E6'
                        : node.type === 'position'
                          ? '#F1D9A7'
                          : '#D8E5DC'
                    }
                    maskColor="rgba(247, 249, 251, 0.78)"
                    style={{
                      width: compactInspector ? 96 : 150,
                      height: compactInspector ? 64 : 92,
                    }}
                  />
                  <Controls showInteractive={false} position="bottom-left" />
                </ReactFlow>
                <Stack
                  direction="row"
                  gap={1.5}
                  sx={{
                    position: 'absolute',
                    left: 54,
                    bottom: 13,
                    px: 1,
                    py: 0.6,
                    bgcolor: 'rgba(255,255,255,0.92)',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                  }}
                >
                  <Stack direction="row" alignItems="center" gap={0.6}>
                    <Box sx={{ width: 18, borderTop: '2px solid #94A3B8' }} />
                    <Typography variant="caption">{t('orgChart.legend.supervisory')}</Typography>
                  </Stack>
                  {mode === 'organizations' && showMatrix && (
                    <Stack direction="row" alignItems="center" gap={0.6}>
                      <Box sx={{ width: 18, borderTop: '2px dashed #D55B42' }} />
                      <Typography variant="caption">{t('orgChart.legend.matrix')}</Typography>
                    </Stack>
                  )}
                  {mode === 'organizations' && scenarioId && (
                    <Stack direction="row" alignItems="center" gap={0.6}>
                      <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#7C3AED' }} />
                      <Typography variant="caption">
                        {t('orgChart.legend.scenarioChange')}
                      </Typography>
                    </Stack>
                  )}
                </Stack>
                <Chip
                  size="small"
                  variant="outlined"
                  label={t('orgChart.asOf', { date: chart.asOf })}
                  sx={{
                    position: 'absolute',
                    top: 12,
                    left: 12,
                    bgcolor: 'rgba(255,255,255,0.92)',
                  }}
                />
                {(mode === 'organizations' || mode === 'positions') &&
                  selectedScenario?.lifecycleState === 'DRAFT' && (
                    <Chip
                      size="small"
                      color="secondary"
                      variant="outlined"
                      label={t('orgChart.scenarios.dragHint')}
                      sx={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        bgcolor: 'rgba(255,255,255,0.94)',
                      }}
                    />
                  )}
              </>
            )}
          </Box>
          {selection && !compactInspector && (
            <Box sx={{ minWidth: 0, borderLeft: 1, borderColor: 'divider' }}>{inspector}</Box>
          )}
        </Box>

        <Drawer
          open={Boolean(selection) && compactInspector}
          onClose={() => updateNavigationState(organizationSelectionSearchParams(undefined))}
          anchor="bottom"
          PaperProps={{
            'aria-label': t('orgChart.details.panelLabel'),
            sx: { maxHeight: '76vh', borderRadius: '8px 8px 0 0' },
          }}
        >
          {inspector}
        </Drawer>
        {workforceView && (
          <OrganizationScenarioDrawer
            open={scenarioOpen && !workforceReadOnly}
            chart={chart}
            currentUserId={auth.user?.userId}
            previewScenarioId={scenarioId}
            onPreviewScenario={(nextScenarioId) => {
              const scenario = scenarios.find((item) => item.scenarioId === nextScenarioId);
              updateNavigationState({
                scenario: nextScenarioId,
                asOf: scenario?.baselineDate ?? null,
                compareTo: scenario?.baselineDate ?? null,
                root: null,
                mode: defaultMode === 'organizations' ? null : 'organizations',
                insight: null,
                lens: 'changes',
                ...organizationSelectionSearchParams(undefined),
              });
              setScenarioOpen(false);
            }}
            onScenarioChanged={() => {
              void queryClient.invalidateQueries({ queryKey: ['workforce', 'organization-chart'] });
            }}
            onClose={() => setScenarioOpen(false)}
          />
        )}
        <Dialog
          open={Boolean(pendingMove)}
          onClose={() => {
            if (scenarioBusy) return;
            setPendingMove(undefined);
            setRenderNodes(graph.nodes);
          }}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>{t('orgChart.scenarios.dragConfirm.title')}</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary">
              {pendingMove?.kind === 'position'
                ? t('orgChart.scenarios.dragConfirm.positionMessage', {
                    position:
                      chart.positions.find(
                        (position) => position.positionId === pendingMove.targetId
                      )?.title ?? '',
                    parent:
                      chart.positions.find(
                        (position) => position.positionId === pendingMove.newParentId
                      )?.title ?? '',
                  })
                : t('orgChart.scenarios.dragConfirm.message', {
                    organization:
                      chart.organizations.find(
                        (organization) => organization.organizationId === pendingMove?.targetId
                      )?.name ?? '',
                    parent:
                      chart.organizations.find(
                        (organization) => organization.organizationId === pendingMove?.newParentId
                      )?.name ?? '',
                  })}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button
              disabled={scenarioBusy}
              onClick={() => {
                setPendingMove(undefined);
                setRenderNodes(graph.nodes);
              }}
            >
              {t('common.actions.cancel')}
            </Button>
            <Button
              variant="contained"
              disabled={scenarioBusy}
              onClick={() => void confirmScenarioMove()}
            >
              {t('orgChart.scenarios.dragConfirm.action')}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Stack>
  );
}

function toggleSetValue(current: ReadonlySet<string>, value: string): Set<string> {
  const next = new Set(current);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function matchesOrganization(
  organization: {
    name: string;
    shortName?: string | null;
    organizationKey: string;
    costCenterKey?: string | null;
  },
  search: string
): boolean {
  if (!search) return false;
  return [
    organization.name,
    organization.shortName,
    organization.organizationKey,
    organization.costCenterKey,
  ].some((value) => value?.toLocaleLowerCase().includes(search));
}

function matchesPerson(
  person: {
    displayName: string;
    workEmail?: string | null;
    businessTitle?: string | null;
    jobProfileName?: string | null;
  },
  search: string
): boolean {
  if (!search) return false;
  return [person.displayName, person.workEmail, person.businessTitle, person.jobProfileName].some(
    (value) => value?.toLocaleLowerCase().includes(search)
  );
}

function matchesPosition(
  position: {
    positionKey: string;
    title: string;
    jobProfileName?: string | null;
    locationName?: string | null;
  },
  search: string
): boolean {
  if (!search) return false;
  return [
    position.positionKey,
    position.title,
    position.jobProfileName,
    position.locationName,
  ].some((value) => value?.toLocaleLowerCase().includes(search));
}

function organizationVisual(
  organization: OrganizationChartOrganization,
  lens: OrganizationLens,
  changed: boolean,
  policy: OrganizationDesignPolicy
): { accentColor: string; surfaceColor: string; changed: boolean } {
  if (lens === 'health') {
    if (organization.healthStatus === 'CRITICAL') {
      return { accentColor: '#C2412D', surfaceColor: '#FFF7F5', changed };
    }
    if (organization.healthStatus === 'ATTENTION') {
      return { accentColor: '#A16207', surfaceColor: '#FFFBEB', changed };
    }
    return { accentColor: '#16815F', surfaceColor: '#F4FBF8', changed };
  }
  if (lens === 'headcount') {
    if (organization.totalHeadcount >= 20) {
      return { accentColor: '#1D4ED8', surfaceColor: '#EFF6FF', changed };
    }
    if (organization.totalHeadcount >= 10) {
      return { accentColor: '#0F766E', surfaceColor: '#F0FDFA', changed };
    }
    return { accentColor: '#64748B', surfaceColor: '#F8FAFC', changed };
  }
  if (lens === 'span') {
    if (organization.averageManagerSpan > policy.maximumManagerSpan) {
      return { accentColor: '#C2412D', surfaceColor: '#FFF7F5', changed };
    }
    if (
      organization.managerCount > 0 &&
      organization.averageManagerSpan < policy.minimumManagerSpan
    ) {
      return { accentColor: '#A16207', surfaceColor: '#FFFBEB', changed };
    }
    return { accentColor: '#16815F', surfaceColor: '#F4FBF8', changed };
  }
  if (lens === 'vacancy') {
    return organization.openPositionCount > 0
      ? { accentColor: '#A16207', surfaceColor: '#FFFBEB', changed }
      : { accentColor: '#16815F', surfaceColor: '#F4FBF8', changed };
  }
  if (lens === 'changes') {
    return changed
      ? { accentColor: '#7C3AED', surfaceColor: '#F5F3FF', changed }
      : { accentColor: '#64748B', surfaceColor: '#F8FAFC', changed };
  }
  return { accentColor: '', surfaceColor: '', changed };
}

function organizationLensLabel(
  organization: OrganizationChartOrganization,
  lens: OrganizationLens,
  changed: boolean,
  t: TFunction<'admin'>
): string | undefined {
  if (lens === 'health') {
    return t(`orgChart.health.${organization.healthStatus}`, {
      defaultValue: organization.healthStatus,
    });
  }
  if (lens === 'headcount') {
    return t('orgChart.lensValues.headcount', { count: organization.totalHeadcount });
  }
  if (lens === 'span') {
    return t('orgChart.lensValues.span', { value: organization.averageManagerSpan.toFixed(1) });
  }
  if (lens === 'vacancy') {
    return t('orgChart.lensValues.vacancy', { count: organization.openPositionCount });
  }
  if (lens === 'changes') {
    return t(changed ? 'orgChart.lensValues.changed' : 'orgChart.lensValues.unchanged');
  }
  return undefined;
}
