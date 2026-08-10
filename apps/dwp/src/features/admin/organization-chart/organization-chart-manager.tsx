import '@xyflow/react/dist/style.css';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Columns3,
  LocateFixed,
  MapPin,
  Network,
  RefreshCw,
  Rows3,
  Search,
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
} from '@xyflow/react';
import { useQuery } from '@tanstack/react-query';
import { getOrganizationChart, listIdentityUsers } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Drawer from '@mui/material/Drawer';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import { AdminPanelError, AdminPanelLoading } from '../admin-ui';
import { OrganizationNode, PersonNode, type OrgChartFlowNode } from './org-chart-nodes';
import {
  layoutChart,
  visibleOrganizationIds,
  visiblePersonIds,
  type ChartDirection,
} from './org-chart-layout';
import { OrgChartInspector, type OrgChartSelection } from './org-chart-inspector';

import type { Edge, NodeMouseHandler, ReactFlowInstance } from '@xyflow/react';
import type { LucideIcon } from 'lucide-react';

type ChartMode = 'organizations' | 'people';

const nodeTypes = {
  organization: OrganizationNode,
  person: PersonNode,
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function Metric({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
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
          {value.toLocaleString()}
        </Typography>
      </Box>
    </Stack>
  );
}

export function OrganizationChartManager() {
  const { t } = useTranslation('admin');
  const theme = useTheme();
  const compactInspector = useMediaQuery(theme.breakpoints.down('md'));
  const [asOf, setAsOf] = useState(today);
  const [rootOrganizationId, setRootOrganizationId] = useState<string>();
  const [mode, setMode] = useState<ChartMode>('organizations');
  const [direction, setDirection] = useState<ChartDirection>('TB');
  const [showMatrix, setShowMatrix] = useState(true);
  const [search, setSearch] = useState('');
  const [collapsedOrganizations, setCollapsedOrganizations] = useState<Set<string>>(new Set());
  const [collapsedPeople, setCollapsedPeople] = useState<Set<string>>(new Set());
  const [selection, setSelection] = useState<OrgChartSelection>();
  const [flow, setFlow] = useState<ReactFlowInstance<OrgChartFlowNode, Edge>>();
  const initializedChart = useRef('');

  const chartQuery = useQuery({
    queryKey: ['admin', 'organization-chart', asOf, rootOrganizationId],
    queryFn: () => getOrganizationChart({ asOf, rootOrganizationId, depth: 10 }),
  });
  const identitiesQuery = useQuery({
    queryKey: ['admin', 'organization-chart', 'identity-roles'],
    queryFn: () => listIdentityUsers(),
    retry: false,
  });

  const chart = chartQuery.data;
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

  useEffect(() => {
    if (!chart) return;
    const key = `${chart.asOf}:${chart.company.organizationId}`;
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
  }, [chart]);

  const graph = useMemo(() => {
    if (!chart) return { nodes: [] as OrgChartFlowNode[], edges: [] as Edge[] };
    const normalizedSearch = search.trim().toLocaleLowerCase();
    const organizationsById = new Map(
      chart.organizations.map((organization) => [organization.organizationId, organization])
    );
    const peopleById = new Map(chart.people.map((person) => [person.personId, person]));

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
              type: 'bezier',
              label: t('orgChart.legend.matrix'),
              style: { stroke: '#D55B42', strokeWidth: 1.4, strokeDasharray: '6 5' },
              labelStyle: { fill: '#9F3F2E', fontSize: 10 },
              markerEnd: { type: MarkerType.ArrowClosed, color: '#D55B42', width: 13, height: 13 },
            }))
        : [];
      const nodes: OrgChartFlowNode[] = chart.organizations
        .filter((organization) => visibleIds.has(organization.organizationId))
        .map((organization) => ({
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
          },
        }));
      return {
        nodes: layoutChart(nodes, hierarchyEdges, direction),
        edges: [...hierarchyEdges, ...matrixEdges],
      };
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
    direction,
    mode,
    search,
    showMatrix,
    t,
    toggleOrganization,
    togglePerson,
  ]);

  useEffect(() => {
    if (!flow || !graph.nodes.length) return;
    const timer = window.setTimeout(() => {
      void flow.fitView({ padding: 0.15, duration: 380, maxZoom: 1.05 });
    }, 40);
    return () => window.clearTimeout(timer);
  }, [direction, flow, graph.nodes.length, mode, rootOrganizationId]);

  const handleNodeClick: NodeMouseHandler<OrgChartFlowNode> = (_event, node) => {
    setSelection({
      kind: node.type === 'person' ? 'person' : 'organization',
      id: node.id,
    });
  };

  const focusSearchResult = () => {
    if (!chart || !search.trim()) return;
    const needle = search.trim().toLocaleLowerCase();
    const organization = chart.organizations.find((candidate) =>
      matchesOrganization(candidate, needle)
    );
    const person = chart.people.find((candidate) => matchesPerson(candidate, needle));
    const targetId = mode === 'people' ? person?.personId : organization?.organizationId;
    const fallbackId = mode === 'people' ? undefined : person?.organizationId;
    const id = targetId ?? fallbackId;
    if (!id) return;
    setSelection({ kind: mode === 'people' ? 'person' : 'organization', id });
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
    } else {
      setCollapsedPeople(
        new Set(
          chart.people
            .filter((person) => person.directReportCount > 0)
            .map((person) => person.personId)
        )
      );
    }
  };
  const expandAll = () => {
    if (mode === 'organizations') setCollapsedOrganizations(new Set());
    else setCollapsedPeople(new Set());
  };

  const inspector = selection ? (
    <OrgChartInspector
      chart={chart}
      selection={selection}
      rolesByEmail={rolesByEmail}
      onClose={() => setSelection(undefined)}
      onSelect={setSelection}
      onFocusOrganization={(organizationId) => {
        setRootOrganizationId(organizationId);
        setSelection(undefined);
        setCollapsedOrganizations(new Set());
      }}
    />
  ) : null;

  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
      <Box sx={{ overflowX: 'auto', borderBottom: 1, borderColor: 'divider' }}>
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
          <Metric
            icon={BriefcaseBusiness}
            label={t('orgChart.metrics.openPositions')}
            value={chart.metrics.openPositionCount}
            color="#B7791F"
          />
          <Metric
            icon={MapPin}
            label={t('orgChart.metrics.locations')}
            value={chart.metrics.locationCount}
            color="#D55B42"
          />
        </Stack>
      </Box>

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
            onChange={(_event, value: ChartMode | null) => {
              if (!value) return;
              setMode(value);
              setSelection(undefined);
            }}
          >
            <ToggleButton value="organizations">
              <Building2 size={15} />
              <Box component="span" sx={{ ml: 0.75 }}>
                {t('orgChart.view.organizations')}
              </Box>
            </ToggleButton>
            <ToggleButton value="people">
              <UsersRound size={15} />
              <Box component="span" sx={{ ml: 0.75 }}>
                {t('orgChart.view.people')}
              </Box>
            </ToggleButton>
          </ToggleButtonGroup>
          <TextField
            size="small"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
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
          {rootOrganizationId && (
            <Button
              size="small"
              startIcon={<Undo2 size={15} />}
              onClick={() => {
                setRootOrganizationId(undefined);
                setSelection(undefined);
              }}
            >
              {t('orgChart.actions.showCompany')}
            </Button>
          )}
        </Stack>

        <Stack direction="row" alignItems="center" gap={0.4} flexWrap="wrap" useFlexGap>
          {mode === 'organizations' && (
            <FormControlLabel
              sx={{ mr: 0.5 }}
              control={
                <Switch
                  size="small"
                  checked={showMatrix}
                  onChange={(event) => setShowMatrix(event.target.checked)}
                />
              }
              label={<Typography variant="caption">{t('orgChart.actions.matrix')}</Typography>}
            />
          )}
          <TextField
            size="small"
            type="date"
            value={asOf}
            onChange={(event) => {
              setAsOf(event.target.value);
              setSelection(undefined);
            }}
            inputProps={{ 'aria-label': t('orgChart.filters.asOf') }}
            sx={{ width: 172 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <CalendarDays size={15} />
                </InputAdornment>
              ),
            }}
          />
          <Tooltip title={t('orgChart.actions.changeDirection')}>
            <IconButton
              size="small"
              aria-label={t('orgChart.actions.changeDirection')}
              onClick={() => setDirection((current) => (current === 'TB' ? 'LR' : 'TB'))}
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
          <Tooltip title={t('common.actions.refresh')}>
            <IconButton
              size="small"
              aria-label={t('common.actions.refresh')}
              onClick={() => void chartQuery.refetch()}
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
          <ReactFlow<OrgChartFlowNode, Edge>
            nodes={graph.nodes}
            edges={graph.edges}
            nodeTypes={nodeTypes}
            onInit={setFlow}
            onNodeClick={handleNodeClick}
            nodesDraggable={false}
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
              nodeColor={(node) => (node.type === 'organization' ? '#C9D7E6' : '#D8E5DC')}
              maskColor="rgba(247, 249, 251, 0.78)"
              style={{ width: 150, height: 92 }}
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
          </Stack>
          <Chip
            size="small"
            variant="outlined"
            label={t('orgChart.asOf', { date: chart.asOf })}
            sx={{ position: 'absolute', top: 12, left: 12, bgcolor: 'rgba(255,255,255,0.92)' }}
          />
        </Box>
        {selection && !compactInspector && (
          <Box sx={{ minWidth: 0, borderLeft: 1, borderColor: 'divider' }}>{inspector}</Box>
        )}
      </Box>

      <Drawer
        open={Boolean(selection) && compactInspector}
        onClose={() => setSelection(undefined)}
        anchor="bottom"
        PaperProps={{
          'aria-label': t('orgChart.details.panelLabel'),
          sx: { maxHeight: '76vh', borderRadius: '8px 8px 0 0' },
        }}
      >
        {inspector}
      </Drawer>
    </Box>
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
