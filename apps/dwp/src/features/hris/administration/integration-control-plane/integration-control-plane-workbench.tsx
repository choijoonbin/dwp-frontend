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
import { Activity, Cable, Plus, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import { HRIS_INTEGRATION_CONTROL_PLANE_RESPONSIVE_CONTRACT } from './integration-control-plane-contract';
import {
  formatIntegrationTimestamp,
  integrationActionLabel,
  integrationProjectionRows,
} from './integration-control-plane-model';
import {
  INTEGRATION_ACTION_KEYS,
  INTEGRATION_CONTROL_PLANE_EXPERIENCE,
} from './integration-control-plane-types';

import type { HrisIntegrationControlPlaneState } from './integration-control-plane-contract';
import type { IntegrationProjectionRow } from './integration-control-plane-model';
import type {
  ConnectorExecutionResponse,
  IntegrationProjectionResponse,
  IntegrationWorkbenchAction,
} from './integration-control-plane-types';

export type IntegrationControlPlaneViewState = Readonly<{
  search: string;
  selectedItemPublicId: string | null;
}>;

export type IntegrationCommandFeedback = Readonly<{
  kind: 'ERROR' | 'RESULT_UNKNOWN' | 'SUCCESS';
  title: string;
  detail: string;
  correlationId?: string;
}>;

export type IntegrationControlPlaneWorkbenchProps = Readonly<{
  state: HrisIntegrationControlPlaneState;
  projection?: IntegrationProjectionResponse;
  execution?: ConnectorExecutionResponse;
  scopeLabel: string;
  asOf?: string;
  viewState?: IntegrationControlPlaneViewState;
  refreshing?: boolean;
  createAvailable?: boolean;
  commandFeedback?: IntegrationCommandFeedback;
  onViewStateChange?(state: IntegrationControlPlaneViewState): void;
  onAction?(action: IntegrationWorkbenchAction): void;
  onRetry?(): void;
  onStepUp?(): void;
}>;

const DEFAULT_VIEW_STATE: IntegrationControlPlaneViewState = Object.freeze({
  search: '',
  selectedItemPublicId: null,
});

/**
 * Unmounted SYS-008 command center. It owns no route, performs no request, and accepts only
 * owner-projected rows and actions from a later authorized composition boundary.
 */
export function IntegrationControlPlaneWorkbench({
  state,
  projection,
  execution,
  scopeLabel,
  asOf,
  viewState,
  refreshing = false,
  createAvailable = false,
  commandFeedback,
  onViewStateChange,
  onAction,
  onRetry,
  onStepUp,
}: IntegrationControlPlaneWorkbenchProps) {
  const [localViewState, setLocalViewState] = useState(DEFAULT_VIEW_STATE);
  const currentView = viewState ?? localViewState;
  const allRows = useMemo(
    () => (projection ? integrationProjectionRows(projection) : []),
    [projection]
  );
  const rows = useMemo(
    () => filterRows(allRows, currentView.search),
    [allRows, currentView.search]
  );
  const selected =
    rows.find((row) => row.key === currentView.selectedItemPublicId) ??
    allRows.find((row) => row.key === currentView.selectedItemPublicId) ??
    rows[0];
  const hasVerifiedRows = Boolean(projection && projection.items.length > 0);
  const readOnly = state !== 'complete';

  const updateView = (patch: Partial<IntegrationControlPlaneViewState>) => {
    const next = Object.freeze({ ...currentView, ...patch });
    if (viewState === undefined) setLocalViewState(next);
    onViewStateChange?.(next);
  };

  return (
    <PageCanvas mode="workspace" topInset="compact">
      <Stack
        gap={{ xs: 2, md: 2.5 }}
        minWidth={0}
        data-testid="integration-control-plane-workbench"
        data-page-archetype={INTEGRATION_CONTROL_PLANE_EXPERIENCE.pageArchetype}
        data-state={state}
        data-mounted="false"
        data-projection={projection?.projection ?? 'NONE'}
        data-responsive-widths={HRIS_INTEGRATION_CONTROL_PLANE_RESPONSIVE_CONTRACT.viewportWidths.join(
          ','
        )}
        data-zoom-percent={HRIS_INTEGRATION_CONTROL_PLANE_RESPONSIVE_CONTRACT.zoomPercent}
        sx={{
          inlineSize: '100%',
          maxInlineSize: '100%',
          overflowX: 'clip',
          '@media (prefers-reduced-motion: reduce)': {
            '&, & *': { scrollBehavior: 'auto', transition: 'none' },
          },
          '@media (forced-colors: active)': {
            '& [data-integration-surface]': { borderColor: 'CanvasText' },
          },
        }}
      >
        <ResourcePageHeader
          eyebrow="HRIS governance"
          title="Integration control plane"
          description={INTEGRATION_CONTROL_PLANE_EXPERIENCE.operationalQuestion}
          scope={<Chip size="small" variant="outlined" label={`Scope: ${scopeLabel}`} />}
          status={
            <LiveStatus
              state={liveStatusFor(state)}
              label={liveStatusLabel(state)}
              detail={asOf ? `As of ${formatIntegrationTimestamp(asOf)}` : 'No verified snapshot'}
              refreshLabel="Refresh integration evidence"
              onRefresh={onRetry}
              refreshing={refreshing}
            />
          }
          primaryAction={
            state === 'complete' && createAvailable && onAction ? (
              <ActionButton
                intent="primary"
                data-integration-command
                startIcon={<Plus size={17} aria-hidden="true" />}
                onClick={() =>
                  onAction({
                    scope: 'COLLECTION',
                    actionKey: INTEGRATION_ACTION_KEYS.createDefinition,
                  })
                }
                sx={{ minHeight: 44 }}
              >
                New connector
              </ActionButton>
            ) : undefined
          }
        />

        <StateBoundary
          state={state}
          hasProjection={Boolean(projection)}
          hasVerifiedRows={hasVerifiedRows}
          canCreate={Boolean(state === 'complete' && createAvailable && onAction)}
          onCreate={
            createAvailable && onAction
              ? () =>
                  onAction({
                    scope: 'COLLECTION',
                    actionKey: INTEGRATION_ACTION_KEYS.createDefinition,
                  })
              : undefined
          }
          onRetry={onRetry}
          onStepUp={onStepUp}
          refreshing={refreshing}
        />

        {commandFeedback ? <CommandFeedback feedback={commandFeedback} /> : null}

        {(state === 'partial' || state === 'result-unknown') && hasVerifiedRows ? (
          <InlineFeedback
            severity="warning"
            title={
              state === 'result-unknown'
                ? 'The latest command outcome is not confirmed'
                : 'Some integration evidence is restricted or stale'
            }
          >
            Verified connector facts remain visible, but every command is withheld until current,
            complete owner evidence is available. Reconciliation never mutates the original
            result-unknown receipt.
          </InlineFeedback>
        ) : null}

        {projection && hasVerifiedRows ? (
          <>
            <OperationalContextBar
              label="Integration evidence context"
              items={[
                { label: 'Tenant scope', value: scopeLabel, icon: <ShieldCheck size={16} /> },
                {
                  label: 'Projection',
                  value:
                    projection.projection === 'PRIMARY_HRIS_SETTINGS'
                      ? 'HRIS settings'
                      : 'DWP control',
                  icon: <Cable size={16} />,
                },
                {
                  label: 'Snapshot',
                  value: asOf ? formatIntegrationTimestamp(asOf) : 'Injected owner snapshot',
                  icon: <RefreshCw size={16} />,
                },
                {
                  label: 'Evidence state',
                  value: projection.state,
                  icon: <Activity size={16} />,
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
              ariaLabel="Integration governance summary"
              items={governanceMetrics(allRows, execution)}
            />

            <FilterBar
              ariaLabel="Filter connector evidence"
              searchLabel="Search connectors"
              searchValue={currentView.search}
              searchPlaceholder="Connector, policy, status…"
              onSearchChange={(search) => updateView({ search, selectedItemPublicId: null })}
              resultLabel={`${rows.length} of ${allRows.length} connectors`}
            />

            {rows.length === 0 ? (
              <GuidedEmptyState
                kind="no-results"
                title="No connectors match this search"
                description="Clear the search to return to the verified owner projection. No command was submitted."
                actionLabel="Clear search"
                onAction={() => updateView(DEFAULT_VIEW_STATE)}
              />
            ) : (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'minmax(0, 1fr)',
                    xl: 'minmax(0, 1.65fr) minmax(18rem, 0.85fr)',
                  },
                  alignItems: 'start',
                  gap: 2,
                  minWidth: 0,
                }}
              >
                <ConnectorTable
                  rows={rows}
                  selectedKey={selected?.key}
                  readOnly={readOnly}
                  onSelect={(selectedItemPublicId) => updateView({ selectedItemPublicId })}
                  onAction={onAction}
                />
                {selected ? (
                  <ConnectorInspector row={selected} readOnly={readOnly} onAction={onAction} />
                ) : null}
              </Box>
            )}

            {execution ? <ExecutionEvidence execution={execution} readOnly={readOnly} /> : null}
          </>
        ) : null}
      </Stack>
    </PageCanvas>
  );
}

function StateBoundary({
  state,
  hasProjection,
  hasVerifiedRows,
  canCreate,
  onCreate,
  onRetry,
  onStepUp,
  refreshing,
}: Readonly<{
  state: HrisIntegrationControlPlaneState;
  hasProjection: boolean;
  hasVerifiedRows: boolean;
  canCreate: boolean;
  onCreate?: () => void;
  onRetry?: () => void;
  onStepUp?: () => void;
  refreshing: boolean;
}>) {
  if ((state === 'complete' || state === 'partial') && !hasProjection) {
    return (
      <LocalErrorState
        title="Integration evidence is unavailable"
        description="The declared state has no trusted owner projection. No command can be submitted."
        retryLabel="Retry"
        onRetry={onRetry}
      />
    );
  }
  if (state === 'loading') {
    return (
      <LoadingState
        label="Loading integration governance"
        description="Confirming connector policy, effective status, and current authorization."
        variant="skeleton"
        skeletonHeights={[52, 148, 148]}
      />
    );
  }
  if (state === 'empty') {
    return (
      <GuidedEmptyState
        kind="first-use"
        title="No connector definitions in this scope"
        description="Create a connector definition first. Validation, approval, activation, and provider execution remain separate governed steps."
        actionLabel={canCreate ? 'Create first connector' : undefined}
        onAction={onCreate}
      />
    );
  }
  if (state === 'forbidden') {
    return (
      <GuidedEmptyState
        kind="permission"
        title="Integration governance is restricted"
        description="The current session has no valid feature, route, or operation decision."
      />
    );
  }
  if (state === 'step-up') {
    return (
      <GuidedEmptyState
        kind="permission"
        title="Additional verification is required"
        description="Verify this session before submitting a high-impact integration decision."
        actionLabel={onStepUp ? 'Verify session' : undefined}
        onAction={onStepUp}
      />
    );
  }
  if (state === 'retry') {
    return (
      <LocalErrorState
        title="Integration evidence could not be refreshed"
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
        title="Integration governance is unavailable"
        description="Trusted owner evidence is unavailable. No connector command can be submitted."
        requestIdLabel="Use the correlation ID from the failed owner response when contacting support."
      />
    );
  }
  if (state === 'result-unknown' && !hasVerifiedRows) {
    return (
      <LocalErrorState
        title="Command outcome requires reconciliation"
        description="No verified read snapshot is available. Use the original correlation and provider receipt evidence; never redispatch blindly."
      />
    );
  }
  return null;
}

function CommandFeedback({ feedback }: Readonly<{ feedback: IntegrationCommandFeedback }>) {
  const severity =
    feedback.kind === 'SUCCESS' ? 'success' : feedback.kind === 'ERROR' ? 'error' : 'warning';
  return (
    <InlineFeedback severity={severity} title={feedback.title}>
      {feedback.detail}
      {feedback.correlationId ? ` Correlation: ${feedback.correlationId}` : ''}
    </InlineFeedback>
  );
}

function ConnectorTable({
  rows,
  selectedKey,
  readOnly,
  onSelect,
  onAction,
}: Readonly<{
  rows: readonly IntegrationProjectionRow[];
  selectedKey?: string;
  readOnly: boolean;
  onSelect(key: string): void;
  onAction?: (action: IntegrationWorkbenchAction) => void;
}>) {
  return (
    <TableContainer
      component={Paper}
      variant="outlined"
      data-integration-surface
      sx={{ minWidth: 0, maxWidth: '100%' }}
    >
      <Table size="small" aria-label="Connector governance evidence" sx={{ tableLayout: 'fixed' }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: { xs: '54%', md: '34%' } }}>Connector</TableCell>
            <TableCell sx={{ width: { xs: '24%', md: '22%' } }}>Status</TableCell>
            <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, width: '28%' }}>
              Policy context
            </TableCell>
            <TableCell align="right" sx={{ width: { xs: '22%', md: '16%' } }}>
              Action
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => {
            const selected = row.key === selectedKey;
            const actionKey = row.actions[0];
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
                        Revision {row.effectiveStatusRevision}
                        {row.redacted ? ' · restricted facts' : ''}
                      </Typography>
                    </Stack>
                  </ActionButton>
                </TableCell>
                <TableCell>
                  <StatusChip value={row.effectiveStatus} />
                </TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                  <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                    {row.context}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  {!readOnly && actionKey && onAction ? (
                    <ActionButton
                      intent={actionIntent(actionKey)}
                      data-integration-command
                      size="small"
                      onClick={() =>
                        onAction({
                          scope: 'ITEM',
                          actionKey,
                          itemPublicId: row.item.itemPublicId,
                          expectedObjectRevision: row.item.effectiveStatusRevision,
                        })
                      }
                      sx={{ minWidth: 44, minHeight: 44, whiteSpace: 'normal' }}
                    >
                      {shortActionLabel(actionKey)}
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

function ConnectorInspector({
  row,
  readOnly,
  onAction,
}: Readonly<{
  row: IntegrationProjectionRow;
  readOnly: boolean;
  onAction?: (action: IntegrationWorkbenchAction) => void;
}>) {
  return (
    <Paper
      component="aside"
      variant="outlined"
      data-integration-surface
      aria-label={`${row.title} details`}
      sx={{ minWidth: 0 }}
    >
      <Stack gap={2} sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack direction="row" gap={1.25} alignItems="flex-start">
          <Box sx={{ display: 'grid', color: 'primary.main', pt: 0.25 }} aria-hidden="true">
            <Cable size={20} />
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
              Connector governance detail
            </Typography>
          </Box>
        </Stack>
        <DefinitionList
          items={[
            ['Effective status', row.effectiveStatus],
            ['Policy context', row.context],
            ['Status revision', String(row.effectiveStatusRevision)],
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
          {readOnly || row.actions.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {readOnly
                ? 'Commands are withheld until current, complete owner evidence is available.'
                : 'No action is available from the current owner-policy intersection.'}
            </Typography>
          ) : (
            row.actions.map((actionKey) => (
              <ActionButton
                key={actionKey}
                intent={actionIntent(actionKey)}
                data-integration-command
                disabled={!onAction}
                onClick={() =>
                  onAction?.({
                    scope: 'ITEM',
                    actionKey,
                    itemPublicId: row.item.itemPublicId,
                    expectedObjectRevision: row.item.effectiveStatusRevision,
                  })
                }
                sx={{ minHeight: 44, justifyContent: 'flex-start', whiteSpace: 'normal' }}
              >
                {integrationActionLabel(actionKey)}
              </ActionButton>
            ))
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}

function ExecutionEvidence({
  execution,
  readOnly,
}: Readonly<{ execution: ConnectorExecutionResponse; readOnly: boolean }>) {
  const unresolved = execution.state === 'RESULT_UNKNOWN' || execution.state === 'RECONCILING';
  return (
    <Paper
      component="section"
      variant="outlined"
      data-integration-surface
      aria-labelledby="integration-execution-evidence-title"
      sx={{ minWidth: 0 }}
    >
      <Stack gap={2} sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={1.5}>
          <Stack direction="row" gap={1.25} alignItems="flex-start">
            <Box
              sx={{
                display: 'grid',
                color: unresolved ? 'warning.main' : 'primary.main',
                pt: 0.25,
              }}
              aria-hidden="true"
            >
              {unresolved ? <TriangleAlert size={20} /> : <Activity size={20} />}
            </Box>
            <Box minWidth={0}>
              <Typography id="integration-execution-evidence-title" component="h2" variant="h6">
                Execution evidence
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                Execution {execution.executionId} · Mapping version {execution.mappingVersion}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" gap={1} alignItems="center">
            <StatusChip value={execution.state} />
            {readOnly ? <Chip size="small" variant="outlined" label="Commands withheld" /> : null}
          </Stack>
        </Stack>
        {unresolved ? (
          <InlineFeedback severity="warning" title="Provider outcome requires evidence">
            Reconcile with the original provider key and receipt evidence. Blind redispatch is not
            available.
          </InlineFeedback>
        ) : null}
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
            ['Source', execution.sourceCount],
            ['Accepted', execution.acceptedCount],
            ['Rejected', execution.rejectedCount],
            ['Selected', execution.selectedItemCount],
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
      </Stack>
    </Paper>
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

function StatusChip({ value }: Readonly<{ value: string }>) {
  const normalized = value.toUpperCase();
  const color = ['FAILED', 'DEAD_LETTER', 'REJECTED_FINAL'].includes(normalized)
    ? 'error'
    : ['RESULT_UNKNOWN', 'PARTIAL', 'SUSPENDED', 'PENDING_APPROVAL'].includes(normalized)
      ? 'warning'
      : ['ACTIVE', 'RECONCILED', 'SUCCEEDED'].includes(normalized)
        ? 'success'
        : 'default';
  return (
    <Chip
      size="small"
      color={color}
      variant={color === 'default' ? 'outlined' : 'filled'}
      label={value.replaceAll('_', ' ')}
      sx={{
        maxWidth: '100%',
        '& .MuiChip-label': { overflowWrap: 'anywhere', whiteSpace: 'normal' },
      }}
    />
  );
}

function filterRows(rows: readonly IntegrationProjectionRow[], search: string) {
  const needle = search.trim().toLocaleLowerCase();
  if (needle.length === 0) return rows;
  return rows.filter((row) =>
    [row.title, row.context, row.effectiveStatus].join(' ').toLocaleLowerCase().includes(needle)
  );
}

function governanceMetrics(
  rows: readonly IntegrationProjectionRow[],
  execution?: ConnectorExecutionResponse
) {
  return [
    {
      key: 'actionable',
      label: 'Needs a decision',
      value: rows.filter((row) => row.actions.length > 0).length,
      detail: 'Server-authorized transitions',
      tone: 'info' as const,
    },
    {
      key: 'restricted',
      label: 'Restricted evidence',
      value: rows.filter((row) => row.redacted).length,
      detail: 'Commands automatically withheld',
      tone: rows.some((row) => row.redacted) ? ('warning' as const) : ('neutral' as const),
    },
    {
      key: 'unknown',
      label: 'Ambiguous outcomes',
      value: execution?.state === 'RESULT_UNKNOWN' ? 1 : 0,
      detail: 'Requires same-key reconciliation',
      tone: execution?.state === 'RESULT_UNKNOWN' ? ('warning' as const) : ('neutral' as const),
    },
    {
      key: 'rejected',
      label: 'Rejected items',
      value: execution?.rejectedCount ?? 0,
      detail: execution ? 'From the selected execution' : 'No execution selected',
      tone: (execution?.rejectedCount ?? 0) > 0 ? ('critical' as const) : ('neutral' as const),
    },
  ];
}

function liveStatusFor(
  state: HrisIntegrationControlPlaneState
): 'live' | 'syncing' | 'stale' | 'degraded' {
  if (state === 'complete' || state === 'empty') return 'live';
  if (state === 'loading') return 'syncing';
  if (state === 'partial') return 'stale';
  return 'degraded';
}

function liveStatusLabel(state: HrisIntegrationControlPlaneState): string {
  if (state === 'complete') return 'Current';
  if (state === 'empty') return 'Current · empty';
  if (state === 'loading') return 'Refreshing';
  if (state === 'partial') return 'Partial evidence';
  if (state === 'result-unknown') return 'Reconciliation required';
  if (state === 'step-up') return 'Verification required';
  if (state === 'forbidden') return 'Restricted';
  return 'Unavailable';
}

function actionIntent(action: string): 'primary' | 'secondary' | 'danger' {
  if (action === INTEGRATION_ACTION_KEYS.cancelExecution) return 'danger';
  if (
    [
      INTEGRATION_ACTION_KEYS.approveDefinition,
      INTEGRATION_ACTION_KEYS.activateDefinition,
      INTEGRATION_ACTION_KEYS.approveMapping,
      INTEGRATION_ACTION_KEYS.activateMapping,
      INTEGRATION_ACTION_KEYS.reconcileExecution,
    ].includes(action as never)
  ) {
    return 'primary';
  }
  return 'secondary';
}

function shortActionLabel(action: string): string {
  if (action.includes('.approve')) return 'Approve';
  if (action.includes('.activate')) return 'Activate';
  if (action.includes('.validate')) return 'Validate';
  if (action.includes('.submit')) return 'Submit';
  if (action.includes('.reconcile')) return 'Reconcile';
  if (action.includes('.retry')) return 'Retry';
  if (action.includes('.cancel')) return 'Cancel';
  if (action.includes('.dry-runs')) return 'Preview';
  if (action.endsWith('.test')) return 'Test';
  if (action.endsWith('.executions')) return 'Execute';
  return 'Create';
}
