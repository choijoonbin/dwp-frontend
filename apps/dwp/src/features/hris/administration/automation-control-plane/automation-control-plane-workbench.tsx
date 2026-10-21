import { useMemo, useState } from 'react';
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
  isProjectedRestriction,
} from './automation-control-plane-model';
import {
  AUTOMATION_ACTION_KEYS,
  AUTOMATION_CONTROL_PLANE_EXPERIENCE,
} from './automation-control-plane-types';

import type { HrisAutomationControlPlaneState } from './automation-control-plane-contract';
import type { AutomationCatalogRow } from './automation-control-plane-model';
import type {
  AutomationCatalogItem,
  AutomationCatalogProjection,
  AutomationControlPlaneAction,
  AutomationResourceType,
  AutomationRunProjection,
  CollectionActionDescriptor,
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
          eyebrow="HRIS governance"
          title="Automation control plane"
          description={AUTOMATION_CONTROL_PLANE_EXPERIENCE.operationalQuestion}
          scope={<Chip size="small" variant="outlined" label={`Scope: ${scopeLabel}`} />}
          status={
            <LiveStatus
              state={liveStatusFor(state)}
              label={liveStatusLabel(state)}
              detail={
                catalog
                  ? `As of ${formatAutomationTimestamp(catalog.asOf)}`
                  : 'No verified snapshot'
              }
              refreshLabel="Refresh automation evidence"
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
                New definition
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
                title="Some automation evidence is restricted or stale"
              >
                Confirmed catalog facts remain visible, but all commands are disabled until a fresh,
                complete authorization projection is available.
              </InlineFeedback>
            ) : null}

            <OperationalContextBar
              label="Automation evidence context"
              items={[
                { label: 'Tenant scope', value: scopeLabel, icon: <ShieldCheck size={16} /> },
                {
                  label: 'Snapshot',
                  value: formatAutomationTimestamp(catalog.asOf),
                  icon: <RefreshCw size={16} />,
                },
                { label: 'Authorization revision', value: String(catalog.authorizationRevision) },
                {
                  label: 'Field visibility',
                  value: `${catalog.fieldDecisionSummary.visible.length} visible · ${catalog.fieldDecisionSummary.masked.length + catalog.fieldDecisionSummary.omitted.length} restricted`,
                },
              ]}
              status={
                <Chip
                  size="small"
                  color={state === 'complete' ? 'success' : 'warning'}
                  label={state === 'complete' ? 'Current evidence' : 'Read only'}
                />
              }
            />

            <OperationalKpiStrip
              ariaLabel="Automation governance summary"
              items={governanceMetrics(allRows, run)}
            />

            <FilterBar
              ariaLabel="Filter automation catalog"
              searchLabel="Search catalog"
              searchValue={currentView.search}
              searchPlaceholder="Automation key, handler, lifecycle…"
              onSearchChange={(search) => updateView({ search, selectedKey: null })}
              resultLabel={`${rows.length} of ${allRows.length} resources`}
              filters={
                <FormControl size="small" sx={{ width: { xs: '100%', sm: 220 } }}>
                  <InputLabel id="automation-resource-filter-label">Resource type</InputLabel>
                  <Select
                    labelId="automation-resource-filter-label"
                    label="Resource type"
                    value={currentView.resourceType}
                    onChange={(event) =>
                      updateView({
                        resourceType: event.target.value as ResourceFilter,
                        selectedKey: null,
                      })
                    }
                  >
                    <MenuItem value="ALL">All resources</MenuItem>
                    <MenuItem value="AUTOMATION_DEFINITION">Definitions</MenuItem>
                    <MenuItem value="AUTOMATION_VERSION">Versions</MenuItem>
                    <MenuItem value="AUTOMATION_SCHEDULE">Schedules</MenuItem>
                  </Select>
                </FormControl>
              }
            />

            {rows.length === 0 ? (
              <GuidedEmptyState
                kind="no-results"
                title="No catalog resources match these filters"
                description="Clear the search or select another resource type. No lifecycle command was submitted."
                actionLabel="Clear filters"
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
  if ((state === 'complete' || state === 'partial') && !hasCatalog) {
    return (
      <LocalErrorState
        title="Automation evidence is unavailable"
        description="The declared state has no trusted owner projection. No command can be submitted."
        retryLabel="Retry"
        onRetry={onRetry}
      />
    );
  }
  if (state === 'loading') {
    return (
      <LoadingState
        label="Loading automation governance"
        description="Confirming definitions, schedules, runs, and current authorization."
        variant="skeleton"
        skeletonHeights={[52, 148, 148]}
      />
    );
  }
  if (state === 'empty') {
    return (
      <GuidedEmptyState
        kind="first-use"
        title="No automation definitions in this scope"
        description="Create definition identity and metadata first. Versions, schedules, and activation remain separate governed steps."
        actionLabel={canCreate ? 'Create first definition' : undefined}
        onAction={onCreate}
      />
    );
  }
  if (state === 'forbidden') {
    return (
      <GuidedEmptyState
        kind="permission"
        title="Automation governance is restricted"
        description="The current session does not have the required page, feature, or operation decision."
      />
    );
  }
  if (state === 'step-up') {
    return (
      <GuidedEmptyState
        kind="permission"
        title="Additional verification is required"
        description="Verify this session before reviewing or submitting a high-impact automation decision."
        actionLabel={onStepUp ? 'Verify session' : undefined}
        onAction={onStepUp}
      />
    );
  }
  if (state === 'retry') {
    return (
      <LocalErrorState
        title="Automation evidence could not be refreshed"
        description="The previous verified view was not replaced and no command was submitted."
        retryLabel="Retry refresh"
        onRetry={onRetry}
        retrying={refreshing}
      />
    );
  }
  if (state === 'unavailable') {
    return (
      <LocalErrorState
        title="Automation governance is unavailable"
        description="Trusted catalog evidence is unavailable or beyond its stale boundary. No command can be submitted."
        requestIdLabel="Use the correlation ID from the failed owner response when contacting support."
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
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ minWidth: 0, maxWidth: '100%' }}>
      <Table size="small" aria-label="Automation resource catalog" sx={{ tableLayout: 'fixed' }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: { xs: '54%', md: '30%' } }}>Resource</TableCell>
            <TableCell sx={{ width: { xs: '24%', md: '18%' } }}>State</TableCell>
            <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, width: '22%' }}>
              Context
            </TableCell>
            <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' }, width: '18%' }}>
              Next event
            </TableCell>
            <TableCell align="right" sx={{ width: { xs: '22%', md: '16%' } }}>
              Action
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
                        fontWeight={750}
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
                      Review
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
              fontWeight={760}
              sx={{ overflowWrap: 'anywhere' }}
            >
              {row.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {row.resourceLabel} governance detail
            </Typography>
          </Box>
        </Stack>
        <DefinitionList
          items={[
            ['Lifecycle', row.lifecycle],
            ['Context', row.context],
            ['Next event', row.nextEvent],
            [
              'Target facts',
              row.redacted ? 'Restricted — commands suppressed' : 'Visible and verified',
            ],
          ]}
        />
        <Stack gap={1}>
          <Typography component="h3" variant="subtitle2">
            Authorized next actions
          </Typography>
          {row.actions.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No action is available for the current lifecycle, eligibility, caller, and
              visible-fact intersection.
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
                Run evidence
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                Run {run.runPublicId} · Definition {run.definitionPublicId} · Version{' '}
                {run.versionNumber}
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
            ['Items', run.itemTotal],
            ['Succeeded', run.itemSucceeded],
            ['Failed', run.itemFailed],
            ['Retry eligible', run.retryEligibleItemCount],
          ].map(([label, value]) => (
            <Box key={label} sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1, minWidth: 0 }}>
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
            title="Attempts"
            icon={<RefreshCw size={17} />}
            empty="No attempts recorded"
            rows={run.attempts.map((attempt) => ({
              key: String(attempt.attemptNumber),
              primary: `Attempt ${attempt.attemptNumber} · ${attempt.state}`,
              secondary: `${attempt.selectionMode} · ${attempt.selectedItemCount} items`,
            }))}
          />
          <EvidenceList
            title="Items"
            icon={<FileCog size={17} />}
            empty="No item receipts recorded"
            rows={run.items.slice(0, 8).map((item) => ({
              key: item.itemPublicId,
              primary: `#${item.itemSequence} · ${item.state}`,
              secondary: item.errorCode ?? `${item.effectState} · ${item.compensationState}`,
            }))}
          />
          <EvidenceList
            title="Checkpoints"
            icon={<CalendarClock size={17} />}
            empty="No checkpoints committed"
            rows={run.checkpoints.slice(0, 8).map((checkpoint) => ({
              key: checkpoint.checkpointPublicId,
              primary: `Attempt ${checkpoint.attemptNumber} · checkpoint ${checkpoint.checkpointOrdinal}`,
              secondary: `${checkpoint.processedItemCount} items · ${formatAutomationTimestamp(checkpoint.committedAt)}`,
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
              <Typography variant="body2" fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>
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
            fontWeight={650}
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

export function automationItemHasVisibleIdentifier(item: AutomationCatalogItem): boolean {
  if (item.resourceType === 'AUTOMATION_DEFINITION')
    return !isProjectedRestriction(item.definitionPublicId);
  if (item.resourceType === 'AUTOMATION_VERSION')
    return !isProjectedRestriction(item.definitionPublicId);
  return !isProjectedRestriction(item.schedulePublicId);
}

export function isCreateDefinitionAction(
  action: CollectionActionDescriptor | ResourceActionDescriptor
): action is CollectionActionDescriptor {
  return action.actionKey === AUTOMATION_ACTION_KEYS.createDefinition;
}
