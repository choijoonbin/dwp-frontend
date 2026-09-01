import { useTranslation } from 'react-i18next';
import {
  BriefcaseBusiness,
  Building2,
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
import { Background, BackgroundVariant, Controls, MiniMap, ReactFlow } from '@xyflow/react';
import { formatNumber, useDisplayDictionary } from '@dwp-frontend/shared-i18n';
import {
  ActionButton,
  ActionIconButton,
  ConfirmDialog,
  DatePickerField,
  FormField,
  SelectField,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Drawer from '@mui/material/Drawer';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import { OrganizationNode, PersonNode, PositionNode } from './org-chart-nodes';
import { organizationSelectionSearchParams } from './organization-navigation';
import { OrganizationDesignOverview } from './organization-design-overview';
import { OrganizationIntelligencePanel } from './organization-intelligence-panel';
import { OrganizationScenarioDrawer } from './organization-scenario-drawer';

import type { ReactNode } from 'react';
import type {
  Edge,
  NodeChange,
  NodeMouseHandler,
  OnNodeDrag,
  ReactFlowInstance,
} from '@xyflow/react';
import type { LucideIcon } from 'lucide-react';
import type {
  OrganizationChart,
  OrganizationIntelligence,
  OrganizationScenario,
} from '@dwp-frontend/shared-utils';
import type { OrgChartFlowNode } from './org-chart-nodes';
import type { ChartDirection } from './org-chart-layout';
import type { OrgChartSelection } from './org-chart-inspector';
import type { OrganizationIntelligenceView } from './organization-intelligence-panel';
import type { OrganizationLens } from './organization-chart-visuals';
import type { ChartMode } from './organization-navigation';

type NavigationValues = Record<string, string | null | undefined>;
type PendingScenarioMove = {
  kind: 'organization' | 'position';
  targetId: string;
  newParentId: string;
};
type ScenarioCapabilities = Readonly<{
  create: boolean;
  update: boolean;
  approve: boolean;
  publish: boolean;
}>;

type OrganizationChartSurfaceProps = {
  workforceView: boolean;
  chart: OrganizationChart;
  mode: ChartMode;
  defaultMode: ChartMode;
  selectedScenario?: OrganizationScenario;
  rootOrganizationId?: string;
  currentDate: string;
  refreshing: boolean;
  onRefresh: () => void;
  updateNavigationState: (values: NavigationValues) => void;
  search: string;
  onFocusSearchResult: () => void;
  scenarios: OrganizationScenario[];
  scenarioId: string;
  lens: OrganizationLens;
  showMatrix: boolean;
  asOf: string;
  compareTo: string;
  defaultCompareTo: string;
  direction: ChartDirection;
  onToggleDirection: () => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  canOpenScenarios: boolean;
  onOpenScenarios: () => void;
  onCopyViewLink: () => void;
  selection?: OrgChartSelection;
  compactInspector: boolean;
  intelligence?: OrganizationIntelligence;
  intelligenceLoading: boolean;
  intelligenceError?: string;
  insightView: OrganizationIntelligenceView;
  onRequestIntelligenceExport?: () => void;
  renderNodes: OrgChartFlowNode[];
  edges: Edge[];
  onFlowInit: (instance: ReactFlowInstance<OrgChartFlowNode, Edge>) => void;
  onNodesChange: (changes: NodeChange<OrgChartFlowNode>[]) => void;
  onNodeClick: NodeMouseHandler<OrgChartFlowNode>;
  onNodeDragStop: OnNodeDrag<OrgChartFlowNode>;
  inspector: ReactNode;
  scenarioOpen: boolean;
  scenarioCapabilities: ScenarioCapabilities;
  currentUserId?: number;
  onScenarioChanged: () => void;
  onCloseScenarios: () => void;
  pendingMove?: PendingScenarioMove;
  scenarioBusy: boolean;
  onCancelPendingMove: () => void;
  onConfirmScenarioMove: () => void;
};

const nodeTypes = {
  organization: OrganizationNode,
  person: PersonNode,
  position: PositionNode,
};

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

export function OrganizationChartSurface({
  workforceView,
  chart,
  mode,
  defaultMode,
  selectedScenario,
  rootOrganizationId,
  currentDate,
  refreshing,
  onRefresh,
  updateNavigationState,
  search,
  onFocusSearchResult,
  scenarios,
  scenarioId,
  lens,
  showMatrix,
  asOf,
  compareTo,
  defaultCompareTo,
  direction,
  onToggleDirection,
  onCollapseAll,
  onExpandAll,
  canOpenScenarios,
  onOpenScenarios,
  onCopyViewLink,
  selection,
  compactInspector,
  intelligence,
  intelligenceLoading,
  intelligenceError,
  insightView,
  onRequestIntelligenceExport,
  renderNodes,
  edges,
  onFlowInit,
  onNodesChange,
  onNodeClick,
  onNodeDragStop,
  inspector,
  scenarioOpen,
  scenarioCapabilities,
  currentUserId,
  onScenarioChanged,
  onCloseScenarios,
  pendingMove,
  scenarioBusy,
  onCancelPendingMove,
  onConfirmScenarioMove,
}: OrganizationChartSurfaceProps) {
  const { t } = useTranslation('workforce');
  const display = useDisplayDictionary();

  return (
    <Stack gap={workforceView ? 2 : 0}>
      {workforceView && (
        <OrganizationDesignOverview
          chart={chart}
          mode={mode}
          scenario={selectedScenario}
          rootOrganizationId={rootOrganizationId}
          currentDate={currentDate}
          fetching={refreshing}
          onRefresh={onRefresh}
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
              color="primary.main"
            />
            <Metric
              icon={Building2}
              label={t('orgChart.metrics.organizations')}
              value={chart.metrics.organizationCount}
              color="success.main"
            />
            <Metric
              icon={UserRound}
              label={t('orgChart.metrics.managers')}
              value={chart.metrics.managerCount}
              color="secondary.main"
            />
            {workforceView && (
              <Metric
                icon={BriefcaseBusiness}
                label={t('orgChart.metrics.openPositions')}
                value={chart.metrics.openPositionCount}
                color="warning.main"
              />
            )}
            <Metric
              icon={MapPin}
              label={t('orgChart.metrics.locations')}
              value={chart.metrics.locationCount}
              color="error.main"
            />
            {workforceView && (
              <Metric
                icon={BriefcaseBusiness}
                label={t('orgChart.metrics.plannedFte')}
                value={chart.metrics.plannedFte.toFixed(1)}
                color="info.main"
              />
            )}
            {workforceView && (
              <Metric
                icon={CircleDollarSign}
                label={t('orgChart.metrics.workforceCost')}
                value={compactMoney(chart.metrics.workforceCostAmount, chart.metrics.costCurrency)}
                color="warning.dark"
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
            sx={{
              px: 1.5,
              py: 1,
              bgcolor: 'action.hover',
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" useFlexGap>
              <GitPullRequest size={16} aria-hidden="true" />
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
            <ActionButton
              intent="quiet"
              size="small"
              startIcon={<Undo2 size={14} />}
              onClick={() => updateNavigationState({ scenario: null })}
            >
              {t('orgChart.scenarios.returnLive')}
            </ActionButton>
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
              <FormField
                size="small"
                value={search}
                onChange={(event) => updateNavigationState({ q: event.target.value || null })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onFocusSearchResult();
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
              <ActionButton
                intent="quiet"
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
              </ActionButton>
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
              <SelectField
                size="small"
                value={scenarioId}
                onValueChange={(nextScenarioId) => {
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
                options={[
                  { value: '', label: t('orgChart.scenarios.live') },
                  ...scenarios.map((scenario) => ({
                    value: scenario.scenarioId,
                    label: scenario.name,
                  })),
                ]}
              />
            )}
            {mode === 'organizations' && (
              <SelectField<OrganizationLens>
                size="small"
                value={lens}
                onValueChange={(nextLens) =>
                  updateNavigationState({
                    lens: nextLens === 'structure' ? null : nextLens,
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
                options={(
                  ['structure', 'health', 'headcount', 'span', 'vacancy', 'changes'] as const
                ).map((item) => ({
                  value: item,
                  label: t(`orgChart.lenses.${item}`),
                  disabled: item === 'changes' && !scenarioId,
                }))}
              />
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
            <DatePickerField
              size="small"
              label={t('orgChart.filters.asOf')}
              value={asOf}
              disabled={Boolean(scenarioId)}
              onValueChange={(nextDate) => {
                updateNavigationState({
                  asOf: nextDate === currentDate ? null : nextDate,
                  compareTo: null,
                  ...organizationSelectionSearchParams(undefined),
                });
              }}
              sx={{ width: { xs: 1, sm: 172 } }}
            />
            {mode === 'insights' && !scenarioId && (
              <DatePickerField
                size="small"
                label={t('orgChart.filters.compareTo')}
                value={compareTo}
                onValueChange={(nextDate) =>
                  updateNavigationState({
                    compareTo: nextDate === defaultCompareTo ? null : nextDate,
                  })
                }
                sx={{ width: { xs: 1, sm: 172 } }}
              />
            )}
            {mode !== 'insights' && (
              <>
                <ActionIconButton
                  size="small"
                  label={t('orgChart.actions.changeDirection')}
                  onClick={onToggleDirection}
                >
                  {direction === 'TB' ? <Rows3 size={17} /> : <Columns3 size={17} />}
                </ActionIconButton>
                <ActionIconButton
                  size="small"
                  label={t('orgChart.actions.collapseAll')}
                  onClick={onCollapseAll}
                >
                  <Network size={17} />
                </ActionIconButton>
                <ActionIconButton
                  size="small"
                  label={t('orgChart.actions.expandAll')}
                  onClick={onExpandAll}
                >
                  <LocateFixed size={17} />
                </ActionIconButton>
              </>
            )}
            {workforceView && (
              <ActionButton
                intent="secondary"
                size="small"
                startIcon={<GitPullRequest size={15} />}
                disabled={!canOpenScenarios}
                onClick={onOpenScenarios}
              >
                {t('orgChart.actions.scenarios')}
              </ActionButton>
            )}
            <ActionIconButton
              size="small"
              label={t('orgChart.actions.copyViewLink')}
              onClick={onCopyViewLink}
            >
              <Share2 size={17} />
            </ActionIconButton>
            <ActionIconButton size="small" label={t('common.actions.refresh')} onClick={onRefresh}>
              <RefreshCw size={17} />
            </ActionIconButton>
          </Stack>
        </Stack>

        <Box
          sx={{
            height: {
              xs: 'clamp(440px, calc(100dvh - 240px), 620px)',
              lg: 'clamp(600px, calc(100vh - 340px), 780px)',
            },
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns:
              selection && !compactInspector ? 'minmax(0, 1fr) 350px' : 'minmax(0, 1fr)',
          }}
        >
          <Box
            sx={{ minWidth: 0, minHeight: 0, position: 'relative', bgcolor: 'background.default' }}
          >
            {mode === 'insights' ? (
              <OrganizationIntelligencePanel
                intelligence={intelligence}
                loading={intelligenceLoading}
                error={intelligenceError}
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
                onRequestExport={onRequestIntelligenceExport}
              />
            ) : (
              <>
                <ReactFlow<OrgChartFlowNode, Edge>
                  nodes={renderNodes}
                  edges={edges}
                  nodeTypes={nodeTypes}
                  onInit={onFlowInit}
                  onNodesChange={onNodesChange}
                  onNodeClick={onNodeClick}
                  onNodeDragStop={onNodeDragStop}
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
            open={scenarioOpen && canOpenScenarios}
            chart={chart}
            capabilities={scenarioCapabilities}
            currentUserId={currentUserId}
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
              onCloseScenarios();
            }}
            onScenarioChanged={onScenarioChanged}
            onClose={onCloseScenarios}
          />
        )}
        <ConfirmDialog
          open={Boolean(pendingMove)}
          title={t('orgChart.scenarios.dragConfirm.title')}
          description={
            pendingMove?.kind === 'position'
              ? t('orgChart.scenarios.dragConfirm.positionMessage', {
                  position:
                    chart.positions.find((position) => position.positionId === pendingMove.targetId)
                      ?.title ?? '',
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
                })
          }
          cancelLabel={t('common.actions.cancel')}
          confirmLabel={t('orgChart.scenarios.dragConfirm.action')}
          busy={scenarioBusy}
          onClose={onCancelPendingMove}
          onConfirm={onConfirmScenarioMove}
        />
      </Box>
    </Stack>
  );
}
