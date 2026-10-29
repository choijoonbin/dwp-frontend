import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionButton,
  FilterBar,
  GuidedEmptyState,
  InlineFeedback,
  LiveStatus,
  LoadingState,
  LocalErrorState,
  OperationalContextBar,
  OperationalKpiStrip,
  PageCanvas,
  ResourcePageHeader,
  foundationTokens,
} from '@dwp-frontend/design-system';
import { Bot, CalendarClock, FileCog, Play, RefreshCw, ShieldCheck } from 'lucide-react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import { HRIS_AUTOMATION_CONTROL_PLANE_RESPONSIVE_CONTRACT } from './automation-control-plane-contract';
import {
  automationActionLabel,
  automationActionsForRun,
  catalogRows,
  formatAutomationTimestamp,
} from './automation-control-plane-model';
import {
  AUTOMATION_ACTION_KEYS,
  AUTOMATION_CONTROL_PLANE_EXPERIENCE,
} from './automation-control-plane-types';

import type { HrisAutomationControlPlaneState } from './automation-control-plane-contract';
import type { AutomationCatalogRow } from './automation-control-plane-model';
import type {
  AutomationCatalogProjection,
  AutomationControlPlaneAction,
  AutomationResourceType,
  AutomationRunProjection,
  ResourceActionDescriptor,
} from './automation-control-plane-types';

type ResourceFilter = 'ALL' | AutomationResourceType;

export type AutomationControlPlaneViewState = Readonly<{
  search: string;
  resourceType: ResourceFilter;
  selectedKey: string | null;
}>;

export type AutomationControlPlaneWorkbenchProps = Readonly<{
  state: HrisAutomationControlPlaneState;
  catalog?: AutomationCatalogProjection;
  run?: AutomationRunProjection;
  scopeLabel: string;
  viewState?: AutomationControlPlaneViewState;
  refreshing?: boolean;
  onViewStateChange?(state: AutomationControlPlaneViewState): void;
  onAction?(action: AutomationControlPlaneAction): void;
  onRetry?(): void;
  onStepUp?(): void;
}>;

const DEFAULT_VIEW_STATE: AutomationControlPlaneViewState = Object.freeze({
  search: '',
  resourceType: 'ALL',
  selectedKey: null,
});

/**
 * Unmounted SYS-006 operator workbench. It owns no route and never fetches by itself; a later
 * authorized SYS-002 composition injects owner projections, commands and URL-backed view state.
 */
export function AutomationControlPlaneWorkbench({
  state,
  catalog,
  run,
  scopeLabel,
  viewState,
  refreshing = false,
  onViewStateChange,
  onAction,
  onRetry,
  onStepUp,
}: AutomationControlPlaneWorkbenchProps) {
  const { t } = useTranslation('hcm');
  const [localViewState, setLocalViewState] = useState(DEFAULT_VIEW_STATE);
  const currentView = viewState ?? localViewState;
  const allRows = useMemo(() => (catalog ? catalogRows(catalog) : []), [catalog]);
  const rows = useMemo(
    () => filterRows(allRows, currentView.search, currentView.resourceType),
    [allRows, currentView.resourceType, currentView.search]
  );
  const selected =
    rows.find((row) => row.key === currentView.selectedKey) ??
    allRows.find((row) => row.key === currentView.selectedKey) ??
    rows[0];
  const collectionAction = catalog?.collectionActions[0];
  const readOnly = state === 'partial';

  const updateView = (patch: Partial<AutomationControlPlaneViewState>) => {
    const next = Object.freeze({ ...currentView, ...patch });
    if (viewState === undefined) setLocalViewState(next);
    onViewStateChange?.(next);
  };

  return (
    <PageCanvas mode="workspace" topInset="compact">
      <Stack
        gap={{ xs: 2, md: 2.5 }}
        minWidth={0}
        data-testid="automation-control-plane-workbench"
        data-page-archetype={AUTOMATION_CONTROL_PLANE_EXPERIENCE.pageArchetype}
        data-state={state}
        data-mounted="false"
        data-responsive-widths={HRIS_AUTOMATION_CONTROL_PLANE_RESPONSIVE_CONTRACT.viewportWidths.join(
          ','
        )}
        data-zoom-percent={HRIS_AUTOMATION_CONTROL_PLANE_RESPONSIVE_CONTRACT.zoomPercent}
        sx={{ inlineSize: '100%', maxInlineSize: '100%', overflowX: 'clip' }}
      >
        <ResourcePageHeader
          eyebrow={t('administration.automation.eyebrow')}
          title={t('administration.automation.title')}
          description={AUTOMATION_CONTROL_PLANE_EXPERIENCE.operationalQuestion}
          scope={
            <Chip
              size="small"
              variant="outlined"
              label={t('administration.automation.scope', { scope: scopeLabel })}
            />
          }
          status={
            <LiveStatus
              state={liveStatusFor(state)}
              label={liveStatusLabel(state)}
              detail={
                catalog
                  ? t('administration.automation.asOf', {
                      asOf: formatAutomationTimestamp(catalog.asOf),
                    })
                  : t('administration.automation.noSnapshot')
              }
              refreshLabel={t('administration.automation.refreshEvidence')}
              onRefresh={onRetry}
              refreshing={refreshing}
            />
          }
          primaryAction={
            state === 'complete' && collectionAction && onAction ? (
              <ActionButton
                intent="primary"
                startIcon={<FileCog size={17} aria-hidden="true" />}
                onClick={() => onAction({ descriptor: collectionAction })}
                sx={{ minHeight: 44 }}
              >
                {t('administration.automation.newDefinition')}
              </ActionButton>
            ) : undefined
          }
        />

        <StateBoundary
          state={state}
          hasCatalog={Boolean(catalog)}
          canCreate={Boolean(collectionAction && onAction)}
          onCreate={
            collectionAction && onAction
              ? () => onAction({ descriptor: collectionAction })
              : undefined
          }
          onRetry={onRetry}
          onStepUp={onStepUp}
          refreshing={refreshing}
        />

        {(state === 'complete' || state === 'partial') && catalog ? (
          <>
            {state === 'partial' ? (
              <InlineFeedback
                severity="warning"
                title={t('administration.automation.partial.title')}
              >
                {t('administration.automation.partial.description')}
              </InlineFeedback>
            ) : null}

            <OperationalContextBar
              label={t('administration.automation.context.label')}
              items={[
                {
                  label: t('administration.automation.context.tenantScope'),
                  value: scopeLabel,
                  icon: <ShieldCheck size={16} />,
                },
                {
                  label: t('administration.automation.context.snapshot'),
                  value: formatAutomationTimestamp(catalog.asOf),
                  icon: <RefreshCw size={16} />,
                },
                {
                  label: t('administration.automation.context.authorizationRevision'),
                  value: String(catalog.authorizationRevision),
                },
                {
                  label: t('administration.automation.context.fieldVisibility'),
                  value: t('administration.automation.context.fieldVisibilityValue', {
                    visible: catalog.fieldDecisionSummary.visible.length,
                    restricted:
                      catalog.fieldDecisionSummary.masked.length +
                      catalog.fieldDecisionSummary.omitted.length,
                  }),
                },
              ]}
              status={
                <Chip
                  size="small"
                  color={state === 'complete' ? 'success' : 'warning'}
                  label={t(
                    state === 'complete'
                      ? 'administration.automation.context.currentEvidence'
                      : 'administration.automation.context.readOnly'
                  )}
                />
              }
            />

            <OperationalKpiStrip
              ariaLabel={t('administration.automation.summaryAriaLabel')}
              items={governanceMetrics(allRows, run)}
            />

            <FilterBar
              ariaLabel={t('administration.automation.filter.ariaLabel')}
              searchLabel={t('administration.automation.filter.searchLabel')}
              searchValue={currentView.search}
              searchPlaceholder={t('administration.automation.filter.searchPlaceholder')}
              onSearchChange={(search) => updateView({ search, selectedKey: null })}
              resultLabel={t('administration.automation.filter.resultLabel', {
                filtered: rows.length,
                total: allRows.length,
              })}
              filters={
                <FormControl size="small" sx={{ width: { xs: '100%', sm: 220 } }}>
                  <InputLabel id="automation-resource-filter-label">
                    {t('administration.automation.filter.resourceType')}
                  </InputLabel>
                  <Select
                    labelId="automation-resource-filter-label"
                    label={t('administration.automation.filter.resourceType')}
                    value={currentView.resourceType}
                    onChange={(event) =>
                      updateView({
                        resourceType: event.target.value as ResourceFilter,
                        selectedKey: null,
                      })
                    }
                  >
                    <MenuItem value="ALL">
                      {t('administration.automation.filter.allResources')}
                    </MenuItem>
                    <MenuItem value="AUTOMATION_DEFINITION">
                      {t('administration.automation.filter.definitions')}
                    </MenuItem>
                    <MenuItem value="AUTOMATION_VERSION">
                      {t('administration.automation.filter.versions')}
                    </MenuItem>
                    <MenuItem value="AUTOMATION_SCHEDULE">
                      {t('administration.automation.filter.schedules')}
                    </MenuItem>
                  </Select>
                </FormControl>
              }
            />

            {rows.length === 0 ? (
              <GuidedEmptyState
                kind="no-results"
                title={t('administration.automation.filter.emptyTitle')}
                description={t('administration.automation.filter.emptyDescription')}
                actionLabel={t('administration.automation.filter.clear')}
                onAction={() => updateView(DEFAULT_VIEW_STATE)}
              />
            ) : (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'minmax(0, 1fr)',
                    xl: 'minmax(0, 1.7fr) minmax(18rem, 0.8fr)',
                  },
                  alignItems: 'start',
                  gap: 2,
                  minWidth: 0,
                }}
              >
                <CatalogTable
                  rows={rows}
                  selectedKey={selected?.key}
                  onSelect={(selectedKey) => updateView({ selectedKey })}
                  onAction={onAction}
                  readOnly={readOnly}
                />
                {selected ? (
                  <ResourceInspector row={selected} readOnly={readOnly} onAction={onAction} />
                ) : null}
              </Box>
            )}

            {run ? <RunEvidence run={run} readOnly={readOnly} onAction={onAction} /> : null}
          </>
        ) : null}
      </Stack>
    </PageCanvas>
  );
}

function StateBoundary({
  state,
  hasCatalog,
  canCreate,
  onCreate,
  onRetry,
  onStepUp,
  refreshing,
}: Readonly<{
  state: HrisAutomationControlPlaneState;
  hasCatalog: boolean;
  canCreate: boolean;
  onCreate?: () => void;
  onRetry?: () => void;
  onStepUp?: () => void;
  refreshing: boolean;
}>) {
  const { t } = useTranslation('hcm');
  if ((state === 'complete' || state === 'partial') && !hasCatalog) {
    return (
      <LocalErrorState
        title={t('administration.automation.state.noProjectionTitle')}
        description={t('administration.automation.state.noProjectionDescription')}
        retryLabel={t('common.retry')}
        onRetry={onRetry}
      />
    );
  }
  if (state === 'loading') {
    return (
      <LoadingState
        label={t('administration.automation.state.loadingTitle')}
        description={t('administration.automation.state.loadingDescription')}
        variant="skeleton"
        skeletonHeights={[52, 148, 148]}
      />
    );
  }
  if (state === 'empty') {
    return (
      <GuidedEmptyState
        kind="first-use"
        title={t('administration.automation.state.emptyTitle')}
        description={t('administration.automation.state.emptyDescription')}
        actionLabel={canCreate ? t('administration.automation.state.createFirst') : undefined}
        onAction={onCreate}
      />
    );
  }
  if (state === 'forbidden') {
    return (
      <GuidedEmptyState
        kind="permission"
        title={t('administration.automation.state.restrictedTitle')}
        description={t('administration.automation.state.restrictedDescription')}
      />
    );
  }
  if (state === 'step-up') {
    return (
      <GuidedEmptyState
        kind="permission"
        title={t('administration.automation.state.stepUpTitle')}
        description={t('administration.automation.state.stepUpDescription')}
        actionLabel={onStepUp ? t('administration.common.verifySession') : undefined}
        onAction={onStepUp}
      />
    );
  }
  if (state === 'retry') {
    return (
      <LocalErrorState
        title={t('administration.automation.state.retryTitle')}
        description={t('administration.automation.state.retryDescription')}
        retryLabel={t('administration.automation.state.retryRefresh')}
        onRetry={onRetry}
        retrying={refreshing}
      />
    );
  }
  if (state === 'unavailable') {
    return (
      <LocalErrorState
        title={t('administration.automation.state.unavailableTitle')}
        description={t('administration.automation.state.unavailableDescription')}
        requestIdLabel={t('administration.automation.state.requestIdHelp')}
      />
    );
  }
  return null;
}

function CatalogTable({
  rows,
  selectedKey,
  onSelect,
  onAction,
  readOnly,
}: Readonly<{
  rows: readonly AutomationCatalogRow[];
  selectedKey?: string;
  onSelect: (key: string) => void;
  onAction?: (action: AutomationControlPlaneAction) => void;
  readOnly: boolean;
}>) {
  const { t } = useTranslation('hcm');
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ minWidth: 0, maxWidth: '100%' }}>
      <Table
        size="small"
        aria-label={t('administration.automation.catalog.ariaLabel')}
        sx={{ tableLayout: 'fixed' }}
      >
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: { xs: '54%', md: '30%' } }}>
              {t('administration.automation.catalog.resource')}
            </TableCell>
            <TableCell sx={{ width: { xs: '24%', md: '18%' } }}>
              {t('administration.automation.catalog.state')}
            </TableCell>
            <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, width: '22%' }}>
              {t('administration.automation.catalog.context')}
            </TableCell>
            <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' }, width: '18%' }}>
              {t('administration.automation.catalog.nextEvent')}
            </TableCell>
            <TableCell align="right" sx={{ width: { xs: '22%', md: '16%' } }}>
              {t('administration.automation.catalog.action')}
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => {
            const selected = row.key === selectedKey;
            const primaryAction = row.actions[0];
            return (
              <TableRow
                key={row.key}
                selected={selected}
                hover
                sx={{
                  '& td': { verticalAlign: 'top', overflowWrap: 'anywhere' },
                  '&:focus-within': { outline: 2, outlineColor: 'primary.main', outlineOffset: -2 },
                }}
              >
                <TableCell>
                  <ActionButton
                    intent="quiet"
                    onClick={() => onSelect(row.key)}
                    aria-pressed={selected}
                    sx={{
                      minWidth: 0,
                      minHeight: 44,
                      maxWidth: '100%',
                      p: 0,
                      textAlign: 'left',
                      justifyContent: 'flex-start',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    <Stack alignItems="flex-start" minWidth={0}>
                      <Typography
                        variant="body2"
                        fontWeight="fontWeightBold"
                        sx={{ overflowWrap: 'anywhere' }}
                      >
                        {row.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {row.resourceLabel}
                        {row.redacted ? ' · restricted facts' : ''}
                      </Typography>
                    </Stack>
                  </ActionButton>
                </TableCell>
                <TableCell>
                  <LifecycleChip state={row.lifecycle} />
                </TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                  <Typography variant="body2">{row.context}</Typography>
                </TableCell>
                <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>
                  <Typography variant="body2">{row.nextEvent}</Typography>
                </TableCell>
                <TableCell align="right">
                  {primaryAction && onAction ? (
                    <ActionButton
                      intent="quiet"
                      size="small"
                      disabled={readOnly}
                      onClick={() => onAction({ descriptor: primaryAction, target: row.item })}
                      sx={{ minWidth: 44, minHeight: 44, whiteSpace: 'normal' }}
                    >
                      {shortActionLabel(primaryAction.actionKey)}
                    </ActionButton>
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      {t('administration.automation.catalog.review')}
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function ResourceInspector({
  row,
  readOnly,
  onAction,
}: Readonly<{
  row: AutomationCatalogRow;
  readOnly: boolean;
  onAction?: (action: AutomationControlPlaneAction) => void;
}>) {
  const { t } = useTranslation('hcm');
  return (
    <Paper
      component="aside"
      variant="outlined"
      aria-label={`${row.title} details`}
      sx={{ minWidth: 0 }}
    >
      <Stack gap={2} sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack direction="row" gap={1.25} alignItems="flex-start">
          <Box sx={{ display: 'grid', color: 'primary.main', pt: 0.25 }} aria-hidden="true">
            <Bot size={20} />
          </Box>
          <Box minWidth={0}>
            <Typography
              component="h2"
              variant="subtitle1"
              fontWeight="fontWeightBold"
              sx={{ overflowWrap: 'anywhere' }}
            >
              {row.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('administration.automation.inspector.detail', {
                resource: row.resourceLabel,
              })}
            </Typography>
          </Box>
        </Stack>
        <DefinitionList
          items={[
            [t('administration.automation.inspector.lifecycle'), row.lifecycle],
            [t('administration.automation.catalog.context'), row.context],
            [t('administration.automation.catalog.nextEvent'), row.nextEvent],
            [
              t('administration.automation.inspector.targetFacts'),
              row.redacted
                ? t('administration.automation.inspector.restrictedFacts')
                : t('administration.automation.inspector.visibleFacts'),
            ],
          ]}
        />
        <Stack gap={1}>
          <Typography component="h3" variant="subtitle2">
            {t('administration.automation.inspector.nextActions')}
          </Typography>
          {row.actions.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t('administration.automation.inspector.noActions')}
            </Typography>
          ) : (
            row.actions.map((action) => (
              <ActionButton
                key={action.actionKey}
                intent={actionIntent(action)}
                disabled={readOnly || !onAction}
                onClick={() => onAction?.({ descriptor: action, target: row.item })}
                sx={{ minHeight: 44, justifyContent: 'flex-start', whiteSpace: 'normal' }}
              >
                {automationActionLabel(action.actionKey)}
              </ActionButton>
            ))
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}

function RunEvidence({
  run,
  readOnly,
  onAction,
}: Readonly<{
  run: AutomationRunProjection;
  readOnly: boolean;
  onAction?: (action: AutomationControlPlaneAction) => void;
}>) {
  const { t } = useTranslation('hcm');
  const actions = automationActionsForRun(run);
  return (
    <Paper
      component="section"
      variant="outlined"
      aria-labelledby="automation-run-evidence-title"
      sx={{ minWidth: 0 }}
    >
      <Stack gap={2} sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={1.5}>
          <Stack direction="row" gap={1.25} alignItems="flex-start">
            <Box sx={{ display: 'grid', color: 'primary.main', pt: 0.25 }} aria-hidden="true">
              <Play size={20} />
            </Box>
            <Box minWidth={0}>
              <Typography id="automation-run-evidence-title" component="h2" variant="h6">
                {t('administration.automation.run.title')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                {t('administration.automation.run.identity', {
                  runId: run.runPublicId,
                  definitionId: run.definitionPublicId,
                  version: run.versionNumber,
                })}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" gap={1} flexWrap="wrap">
            <LifecycleChip state={run.state} />
            {actions.map((action) => (
              <ActionButton
                key={action.actionKey}
                intent={actionIntent(action)}
                disabled={readOnly || !onAction}
                onClick={() => onAction?.({ descriptor: action, target: run })}
                sx={{ minHeight: 44 }}
              >
                {automationActionLabel(action.actionKey)}
              </ActionButton>
            ))}
          </Stack>
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, minmax(0, 1fr))',
              md: 'repeat(4, minmax(0, 1fr))',
            },
            gap: 1,
            minWidth: 0,
          }}
        >
          {[
            [t('administration.automation.run.items'), run.itemTotal],
            [t('administration.automation.run.succeeded'), run.itemSucceeded],
            [t('administration.automation.run.failed'), run.itemFailed],
            [t('administration.automation.run.retryEligible'), run.retryEligibleItemCount],
          ].map(([label, value]) => (
            <Box
              key={label}
              sx={{
                p: 1.5,
                bgcolor: 'action.hover',
                borderRadius: foundationTokens.radius.control + 'px',
                minWidth: 0,
              }}
            >
              <Typography variant="h6" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {value}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {label}
              </Typography>
            </Box>
          ))}
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'repeat(3, minmax(0, 1fr))' },
            gap: 2,
          }}
        >
          <EvidenceList
            title={t('administration.automation.run.attempts')}
            icon={<RefreshCw size={17} />}
            empty={t('administration.automation.run.noAttempts')}
            rows={run.attempts.map((attempt) => ({
              key: String(attempt.attemptNumber),
              primary: t('administration.automation.run.attempt', {
                attempt: attempt.attemptNumber,
                state: attempt.state,
              }),
              secondary: t('administration.automation.run.attemptItems', {
                mode: attempt.selectionMode,
                count: attempt.selectedItemCount,
              }),
            }))}
          />
          <EvidenceList
            title={t('administration.automation.run.items')}
            icon={<FileCog size={17} />}
            empty={t('administration.automation.run.noItems')}
            rows={run.items.slice(0, 8).map((item) => ({
              key: item.itemPublicId,
              primary: `#${item.itemSequence} · ${item.state}`,
              secondary: item.errorCode ?? `${item.effectState} · ${item.compensationState}`,
            }))}
          />
          <EvidenceList
            title={t('administration.automation.run.checkpoints')}
            icon={<CalendarClock size={17} />}
            empty={t('administration.automation.run.noCheckpoints')}
            rows={run.checkpoints.slice(0, 8).map((checkpoint) => ({
              key: checkpoint.checkpointPublicId,
              primary: t('administration.automation.run.checkpoint', {
                attempt: checkpoint.attemptNumber,
                checkpoint: checkpoint.checkpointOrdinal,
              }),
              secondary: t('administration.automation.run.checkpointItems', {
                count: checkpoint.processedItemCount,
                committedAt: formatAutomationTimestamp(checkpoint.committedAt),
              }),
            }))}
          />
        </Box>
      </Stack>
    </Paper>
  );
}

function EvidenceList({
  title,
  icon,
  empty,
  rows,
}: Readonly<{
  title: string;
  icon: React.ReactNode;
  empty: string;
  rows: readonly Readonly<{ key: string; primary: string; secondary: string }>[];
}>) {
  return (
    <Box component="section" sx={{ minWidth: 0 }}>
      <Stack direction="row" gap={0.75} alignItems="center" sx={{ mb: 1 }}>
        <Box aria-hidden="true" sx={{ display: 'grid', color: 'text.secondary' }}>
          {icon}
        </Box>
        <Typography component="h3" variant="subtitle2">
          {title}
        </Typography>
      </Stack>
      {rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {empty}
        </Typography>
      ) : (
        <Stack component="ol" gap={0.75} sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {rows.map((row) => (
            <Box
              component="li"
              key={row.key}
              sx={{ borderTop: 1, borderColor: 'divider', pt: 0.75, minWidth: 0 }}
            >
              <Typography
                variant="body2"
                fontWeight="fontWeightBold"
                sx={{ overflowWrap: 'anywhere' }}
              >
                {row.primary}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ overflowWrap: 'anywhere' }}
              >
                {row.secondary}
              </Typography>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}

function DefinitionList({ items }: Readonly<{ items: readonly (readonly [string, string])[] }>) {
  return (
    <Stack component="dl" gap={1} sx={{ m: 0 }}>
      {items.map(([label, value]) => (
        <Box key={label} sx={{ minWidth: 0 }}>
          <Typography component="dt" variant="caption" color="text.secondary">
            {label}
          </Typography>
          <Typography
            component="dd"
            variant="body2"
            fontWeight="subtitle2.fontWeight"
            sx={{ m: 0, overflowWrap: 'anywhere' }}
          >
            {value}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}

function LifecycleChip({ state }: Readonly<{ state: string }>) {
  const color = ['FAILED', 'DEAD_LETTER'].includes(state)
    ? 'error'
    : ['PENDING_APPROVAL', 'PARTIAL', 'SUSPENDED'].includes(state)
      ? 'warning'
      : ['ACTIVE', 'SUCCEEDED'].includes(state)
        ? 'success'
        : 'default';
  return (
    <Chip
      size="small"
      color={color}
      variant={color === 'default' ? 'outlined' : 'filled'}
      label={state.replaceAll('_', ' ')}
    />
  );
}

function filterRows(
  rows: readonly AutomationCatalogRow[],
  search: string,
  resourceType: ResourceFilter
): readonly AutomationCatalogRow[] {
  const needle = search.trim().toLocaleLowerCase();
  return rows.filter((row) => {
    const resourceMatches = resourceType === 'ALL' || row.item.resourceType === resourceType;
    const textMatches =
      needle.length === 0 ||
      [row.title, row.resourceLabel, row.lifecycle, row.context, row.nextEvent]
        .join(' ')
        .toLocaleLowerCase()
        .includes(needle);
    return resourceMatches && textMatches;
  });
}

function governanceMetrics(rows: readonly AutomationCatalogRow[], run?: AutomationRunProjection) {
  return [
    {
      key: 'actionable',
      label: 'Needs a decision',
      value: rows.filter((row) => row.actions.length > 0).length,
      detail: 'Authorized lifecycle transitions',
      tone: 'info' as const,
    },
    {
      key: 'pending',
      label: 'Pending approval',
      value: rows.filter((row) => row.lifecycle === 'PENDING_APPROVAL').length,
      detail: 'Maker-checker review',
      tone: 'warning' as const,
    },
    {
      key: 'active-schedules',
      label: 'Active schedules',
      value: rows.filter((row) => row.resourceLabel === 'Schedule' && row.lifecycle === 'ACTIVE')
        .length,
      detail: 'Pinned approved versions',
      tone: 'success' as const,
    },
    {
      key: 'run-failures',
      label: 'Visible run failures',
      value: run?.itemFailed ?? 0,
      detail: run ? `${run.retryEligibleItemCount} retry eligible` : 'No run selected',
      tone: (run?.itemFailed ?? 0) > 0 ? ('critical' as const) : ('neutral' as const),
    },
  ];
}

function liveStatusFor(
  state: HrisAutomationControlPlaneState
): 'live' | 'syncing' | 'stale' | 'degraded' {
  if (state === 'complete' || state === 'empty') return 'live';
  if (state === 'loading') return 'syncing';
  if (state === 'partial') return 'stale';
  return 'degraded';
}

function liveStatusLabel(state: HrisAutomationControlPlaneState): string {
  if (state === 'complete') return 'Current';
  if (state === 'empty') return 'Current · empty';
  if (state === 'loading') return 'Refreshing';
  if (state === 'partial') return 'Partial evidence';
  if (state === 'step-up') return 'Verification required';
  if (state === 'forbidden') return 'Restricted';
  return 'Unavailable';
}

function actionIntent(action: ResourceActionDescriptor): 'primary' | 'secondary' | 'danger' {
  if (
    [AUTOMATION_ACTION_KEYS.cancelRun, AUTOMATION_ACTION_KEYS.suspendSchedule].includes(
      action.actionKey as never
    )
  ) {
    return 'danger';
  }
  if (
    [
      AUTOMATION_ACTION_KEYS.approveVersion,
      AUTOMATION_ACTION_KEYS.activateVersion,
      AUTOMATION_ACTION_KEYS.approveSchedule,
      AUTOMATION_ACTION_KEYS.activateSchedule,
    ].includes(action.actionKey as never)
  ) {
    return 'primary';
  }
  return 'secondary';
}

function shortActionLabel(action: ResourceActionDescriptor['actionKey']): string {
  if (action.includes('.approve')) return 'Approve';
  if (action.includes('.activate')) return 'Activate';
  if (action.includes('.validate')) return 'Validate';
  if (action.includes('.submit')) return 'Submit';
  if (action.includes('.retry')) return 'Retry';
  if (action.includes('.cancel')) return 'Cancel';
  if (action.includes('.suspend')) return 'Suspend';
  if (action.endsWith('.runs')) return 'Run';
  return 'Create';
}
