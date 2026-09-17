import { useMemo, useState } from 'react';
import {
  Activity,
  BellOff,
  Globe2,
  History,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  TimerOff,
} from 'lucide-react';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';

import {
  ActionButton,
  ConfirmDialog,
  ErrorState,
  FormField,
  GuidedEmptyState,
  LoadingState,
  OperationalKpiStrip,
  PageCanvas,
} from '@dwp-frontend/design-system';

import { DWAION_ROUTINE_COPY_KO } from './dwaion-routine-copy';
import { DwaionRoutineApprovalQueue } from './dwaion-routine-approval-queue';
import { DwaionRoutineConflictWorkbench } from './dwaion-routine-conflict-workbench';
import { DwaionRoutineInspector } from './dwaion-routine-inspector';
import { DwaionRoutineList } from './dwaion-routine-list';
import { routineConsentComplete } from './dwaion-routine-model';

import type { DwaionRoutineCopy } from './dwaion-routine-copy';
import type {
  DwaionRoutineConflictFailure,
  DwaionRoutineConflictReceipt,
  DwaionRoutineConflictSnapshot,
  DwaionRoutineRecoveryStrategy,
} from './dwaion-routine-conflict-workbench';
import type {
  DwaionRoutine,
  DwaionRoutineMergeSelections,
  DwaionRoutineDryRunReceipt,
  DwaionRoutineViewState,
} from './dwaion-routine-model';
import type {
  DwaionRoutineExecutionRun,
  DwaionRoutineAdvancedCommand,
  DwaionRoutineAdvancedDecisionInput,
  DwaionRoutineAdvancedPayload,
  DwaionRoutineHealth,
  DwaionRoutineRollbackReceipt,
  DwaionRoutineRunCommand,
  DwaionRoutineRuntimeCapabilities,
  DwaionRoutineVersionSnapshot,
} from '@dwp-frontend/shared-utils';

export function DwaionRoutinesPage({
  state,
  routines,
  selectedId,
  partialError,
  commandError,
  conflictSnapshot = null,
  conflictReceipt = null,
  conflictFailure = null,
  conflictBusy = false,
  dryRunReceipt,
  runtimeCapabilities,
  runtimeCapabilitiesError,
  runs = [],
  runsLoading,
  runsError,
  versions = [],
  health,
  rollbackReceipt,
  advancedCommand,
  approvalQueue = [],
  approvalQueueLoading,
  approvalQueueError,
  evidenceLoading,
  evidenceError,
  busy = false,
  canManage = true,
  canApprove = false,
  canCreate = canManage,
  onRetry,
  onResolveConflict,
  onReloadConflict,
  onDismissConflict,
  onCreate,
  onSelect,
  onCloseSelection,
  onDryRun,
  onEdit,
  onSetLifecycle,
  onArchive,
  onActivate,
  onTriggerRun,
  onRunCommand,
  onRollbackVersion,
  onDownloadTelemetry,
  onAdvancedCommand,
  onRetryApprovals,
  onDecideApproval,
  onRetryRuntime,
  copy = DWAION_ROUTINE_COPY_KO,
  formatTimestamp,
}: {
  state: DwaionRoutineViewState;
  routines: readonly DwaionRoutine[];
  selectedId?: string;
  partialError?: string;
  commandError?: 'REVISION_CONFLICT' | 'COMMAND_FAILED' | 'RECOVERY_REJECTED';
  conflictSnapshot?: DwaionRoutineConflictSnapshot | null;
  conflictReceipt?: DwaionRoutineConflictReceipt | null;
  conflictFailure?: DwaionRoutineConflictFailure | null;
  conflictBusy?: boolean;
  dryRunReceipt?: DwaionRoutineDryRunReceipt | null;
  runtimeCapabilities?: DwaionRoutineRuntimeCapabilities;
  runtimeCapabilitiesError?: boolean;
  runs?: readonly DwaionRoutineExecutionRun[];
  runsLoading?: boolean;
  runsError?: boolean;
  versions?: readonly DwaionRoutineVersionSnapshot[];
  health?: DwaionRoutineHealth;
  rollbackReceipt?: DwaionRoutineRollbackReceipt | null;
  advancedCommand?: DwaionRoutineAdvancedCommand | null;
  approvalQueue?: readonly DwaionRoutineAdvancedCommand[];
  approvalQueueLoading?: boolean;
  approvalQueueError?: boolean;
  evidenceLoading?: boolean;
  evidenceError?: boolean;
  busy?: boolean;
  canManage?: boolean;
  canApprove?: boolean;
  canCreate?: boolean;
  onRetry: () => void;
  onResolveConflict: (
    strategy: DwaionRoutineRecoveryStrategy,
    selections: DwaionRoutineMergeSelections
  ) => void;
  onReloadConflict: () => void;
  onDismissConflict: () => void;
  onCreate: () => void;
  onSelect: (routine: DwaionRoutine) => void;
  onCloseSelection: () => void;
  onDryRun: (routineId: string, expectedRevision: number) => void;
  onEdit: (routine: DwaionRoutine) => void;
  onSetLifecycle: (routineId: string, expectedRevision: number, action: 'PAUSE' | 'RESUME') => void;
  onArchive: (routineId: string, expectedRevision: number) => void;
  onActivate: (routine: DwaionRoutine, action: 'ACTIVATE' | 'DEACTIVATE') => void;
  onTriggerRun: (routine: DwaionRoutine) => void;
  onRunCommand: (
    routine: DwaionRoutine,
    run: DwaionRoutineExecutionRun,
    action: DwaionRoutineRunCommand['action']
  ) => void;
  onRollbackVersion: (routine: DwaionRoutine, version: DwaionRoutineVersionSnapshot) => void;
  onDownloadTelemetry: (routine: DwaionRoutine) => void;
  onAdvancedCommand: (routine: DwaionRoutine, payload: DwaionRoutineAdvancedPayload) => void;
  onRetryApprovals: () => void;
  onDecideApproval: (
    command: DwaionRoutineAdvancedCommand,
    input: DwaionRoutineAdvancedDecisionInput
  ) => Promise<void>;
  onRetryRuntime: () => void;
  copy?: DwaionRoutineCopy;
  formatTimestamp?: (value: string) => string;
}) {
  const compact = useMediaQuery('(max-width:1199.95px)', { noSsr: true });
  const selected = useMemo(
    () => routines.find((routine) => routine.routineId === selectedId) ?? null,
    [routines, selectedId]
  );
  const [compactInspectorOpen, setCompactInspectorOpen] = useState(false);
  const [filter, setFilter] = useState<
    'ALL' | 'SCHEDULED' | 'WEBHOOK' | 'READY' | 'ATTENTION' | 'PAUSED'
  >('ALL');
  const [search, setSearch] = useState('');
  const [statusTarget, setStatusTarget] = useState<DwaionRoutine | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<DwaionRoutine | null>(null);
  const metrics = useMemo(
    () => ({
      total: routines.length,
      ready: routines.filter(
        (routine) =>
          (routine.status === 'DRAFT' || routine.status === 'ACTIVE') &&
          routineConsentComplete(routine.consents)
      ).length,
      attention: routines.filter(
        (routine) => routine.status === 'DRAFT' && !routineConsentComplete(routine.consents)
      ).length,
      paused: routines.filter((routine) => routine.status === 'PAUSED').length,
      scheduled: routines.filter((routine) => routine.triggerType === 'SCHEDULED').length,
      webhook: routines.filter((routine) => routine.triggerType === 'WEBHOOK').length,
    }),
    [routines]
  );
  const filteredRoutines = useMemo(
    () =>
      routines.filter((routine) => {
        const query = search.trim().toLocaleLowerCase();
        const matchesSearch =
          !query ||
          [routine.title, routine.description, ...routine.sourceKeys]
            .join(' ')
            .toLocaleLowerCase()
            .includes(query);
        if (!matchesSearch) return false;
        if (filter === 'ALL') return true;
        if (filter === 'SCHEDULED') return routine.triggerType === 'SCHEDULED';
        if (filter === 'WEBHOOK') return routine.triggerType === 'WEBHOOK';
        if (filter === 'PAUSED') return routine.status === 'PAUSED';
        if (filter === 'READY') {
          return (
            (routine.status === 'DRAFT' || routine.status === 'ACTIVE') &&
            routineConsentComplete(routine.consents)
          );
        }
        return routine.status === 'DRAFT' && !routineConsentComplete(routine.consents);
      }),
    [filter, routines, search]
  );
  const filterCounts = {
    ALL: metrics.total,
    SCHEDULED: metrics.scheduled,
    WEBHOOK: metrics.webhook,
    READY: metrics.ready,
    ATTENTION: metrics.attention,
    PAUSED: metrics.paused,
  } as const;
  const timeZones = [...new Set(routines.map((routine) => routine.schedule.timeZone))];
  const timeZoneLabel = timeZones.length === 1 ? timeZones[0] : timeZones.join(' · ');
  const focusServerEvidence = () => {
    if (compact && selected) setCompactInspectorOpen(true);
    window.setTimeout(() => {
      document
        .getElementById('routine-server-evidence-title')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };

  return (
    <PageCanvas mode="workspace" topInset="compact">
      <Stack gap={{ xs: 1.75, md: 2 }}>
        <Stack
          component="header"
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ sm: 'flex-start' }}
          gap={2}
          sx={{
            p: { xs: 2, md: 2.25 },
            border: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            borderRadius: (theme) => Number(theme.shape.borderRadius) * 2 + 'px',
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="overline" color="primary.main">
              {copy.eyebrow}
            </Typography>
            <Typography component="h1" variant="h4">
              {copy.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 760 }}>
              {copy.description}
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={0.75} sx={{ flexShrink: 0 }}>
            <ActionButton
              intent="secondary"
              startIcon={<History size={17} aria-hidden="true" />}
              onClick={focusServerEvidence}
              disabled={!selected}
              sx={{ minHeight: 44 }}
            >
              {copy.versionAudit}
            </ActionButton>
            <ActionButton
              intent="secondary"
              startIcon={<Activity size={17} aria-hidden="true" />}
              onClick={focusServerEvidence}
              disabled={!selected}
              sx={{ minHeight: 44 }}
            >
              {copy.healthCheck}
            </ActionButton>
            <ActionButton
              intent="primary"
              startIcon={<Plus size={17} aria-hidden="true" />}
              onClick={onCreate}
              disabled={!canCreate}
              sx={{ minHeight: 44 }}
            >
              {copy.create}
            </ActionButton>
          </Stack>
        </Stack>

        {partialError ? (
          <Stack
            role="status"
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ sm: 'center' }}
            justifyContent="space-between"
            gap={1}
            sx={{ py: 1.25, borderBlock: 1, borderColor: 'warning.main' }}
          >
            <Typography variant="body2">{partialError || copy.partial}</Typography>
            <ActionButton
              intent="quiet"
              startIcon={<RefreshCw size={16} />}
              onClick={onRetry}
              sx={{ minHeight: 44 }}
            >
              {copy.retry}
            </ActionButton>
          </Stack>
        ) : null}
        {commandError === 'REVISION_CONFLICT' && !conflictSnapshot ? (
          <Typography role="alert" variant="body2" color="warning.main">
            {copy.conflictFetchFailed}
          </Typography>
        ) : commandError === 'COMMAND_FAILED' ? (
          <Typography role="alert" variant="body2" color="error.main">
            {copy.commandFailed}
          </Typography>
        ) : commandError === 'RECOVERY_REJECTED' ? (
          <Typography role="alert" variant="body2" color="warning.main">
            {copy.skipQuarantinedRejected}
          </Typography>
        ) : null}

        <DwaionRoutineConflictWorkbench
          conflict={conflictSnapshot}
          receipt={conflictReceipt}
          failure={conflictFailure}
          busy={conflictBusy}
          copy={copy}
          formatTimestamp={formatTimestamp}
          onResolve={onResolveConflict}
          onReload={onReloadConflict}
          onDismiss={onDismissConflict}
        />

        {state === 'ready' && canApprove ? (
          <DwaionRoutineApprovalQueue
            commands={approvalQueue}
            loading={approvalQueueLoading}
            error={approvalQueueError}
            busy={busy}
            copy={copy}
            formatTimestamp={formatTimestamp}
            onRetry={onRetryApprovals}
            onDecide={onDecideApproval}
          />
        ) : null}

        {state === 'ready' && routines.length > 0 ? (
          <OperationalKpiStrip
            ariaLabel={copy.title}
            items={[
              {
                key: 'total',
                value: metrics.total,
                label: copy.metrics.total,
                detail: copy.metrics.totalDetail,
              },
              {
                key: 'ready',
                value: metrics.ready,
                label: copy.metrics.ready,
                detail: copy.metrics.readyDetail,
                tone: 'success',
              },
              {
                key: 'attention',
                value: metrics.attention,
                label: copy.metrics.attention,
                detail: copy.metrics.attentionDetail,
                tone: metrics.attention ? 'warning' : 'neutral',
              },
              {
                key: 'paused',
                value: metrics.paused,
                label: copy.metrics.paused,
                detail: copy.metrics.pausedDetail,
                tone: 'info',
              },
            ]}
            sx={{ bgcolor: 'background.paper', borderInline: 1, borderColor: 'divider' }}
          />
        ) : null}

        {state === 'loading' ? (
          <LoadingState label={copy.loading} variant="skeleton" skeletonRows={5} />
        ) : state === 'error' ? (
          <ErrorState title={copy.errorTitle} retryLabel={copy.retry} onRetry={onRetry} />
        ) : state === 'permission-denied' ? (
          <GuidedEmptyState
            kind="permission"
            title={copy.permissionTitle}
            description={copy.permissionDescription}
          />
        ) : routines.length === 0 ? (
          <GuidedEmptyState
            kind="first-use"
            title={copy.emptyTitle}
            description={copy.emptyDescription}
            actionLabel={canCreate ? copy.create : undefined}
            onAction={canCreate ? onCreate : undefined}
          />
        ) : (
          <Stack gap={2}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              justifyContent="space-between"
              alignItems={{ md: 'center' }}
              gap={1.25}
              sx={{
                p: 1,
                border: 1,
                borderColor: 'divider',
                bgcolor: 'background.paper',
                borderRadius: (theme) => Number(theme.shape.borderRadius) * 2 + 'px',
              }}
            >
              <FormField
                type="search"
                size="small"
                value={search}
                placeholder={copy.searchPlaceholder}
                onChange={(event) => setSearch(event.target.value)}
                slotProps={{
                  htmlInput: { 'aria-label': copy.searchLabel },
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search size={16} aria-hidden="true" />
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{ width: { xs: '100%', md: 280 }, flexShrink: 0 }}
              />
              <Box
                role="group"
                aria-label={copy.filtersLabel}
                sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}
              >
                {(Object.keys(filterCounts) as Array<keyof typeof filterCounts>).map((key) => (
                  <ButtonBase
                    key={key}
                    aria-pressed={filter === key}
                    onClick={() => setFilter(key)}
                    sx={{
                      minHeight: 36,
                      px: 1.25,
                      borderRadius: (theme) => Number(theme.shape.borderRadius) * 1.5 + 'px',
                      border: 1,
                      borderColor: filter === key ? 'primary.main' : 'transparent',
                      bgcolor: filter === key ? 'var(--dwp-product-soft)' : 'transparent',
                      color: filter === key ? 'primary.main' : 'text.secondary',
                      fontWeight: 'fontWeightBold',
                      fontSize: 'body2.fontSize',
                    }}
                  >
                    {copy.filters[key]} {filterCounts[key]}
                  </ButtonBase>
                ))}
              </Box>
              <Stack direction="row" gap={0.75} flexWrap="wrap">
                {timeZoneLabel ? (
                  <Chip
                    size="small"
                    variant="outlined"
                    icon={<Globe2 size={14} />}
                    label={`${copy.timeZone} · ${timeZoneLabel}`}
                  />
                ) : null}
                {!runtimeCapabilities?.activationAvailable ? (
                  <Chip
                    size="small"
                    variant="outlined"
                    icon={<TimerOff size={14} />}
                    label={copy.engineUnavailable}
                  />
                ) : null}
                {!runtimeCapabilities?.notificationDeliveryAvailable ? (
                  <Chip
                    size="small"
                    variant="outlined"
                    icon={<BellOff size={14} />}
                    label={copy.notificationUnavailable}
                  />
                ) : null}
              </Stack>
            </Stack>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'minmax(0, 1fr)',
                  lg: 'minmax(320px, 0.65fr) minmax(600px, 1.35fr)',
                },
                minWidth: 0,
                gap: 2,
                alignItems: 'start',
              }}
            >
              <DwaionRoutineList
                routines={filteredRoutines}
                selectedId={selectedId}
                onSelect={(routine) => {
                  onSelect(routine);
                  if (compact) setCompactInspectorOpen(true);
                }}
                copy={copy}
              />
              {!compact ? (
                selected ? (
                  <Box
                    sx={{
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: (theme) => Number(theme.shape.borderRadius) * 2 + 'px',
                      bgcolor: 'background.paper',
                      minWidth: 0,
                      overflow: 'hidden',
                    }}
                  >
                    <DwaionRoutineInspector
                      routine={selected}
                      open
                      variant="inline"
                      dryRunReceipt={dryRunReceipt}
                      runtimeCapabilities={runtimeCapabilities}
                      runtimeCapabilitiesError={runtimeCapabilitiesError}
                      runs={runs}
                      runsLoading={runsLoading}
                      runsError={runsError}
                      versions={versions}
                      health={health}
                      rollbackReceipt={rollbackReceipt}
                      advancedCommand={advancedCommand}
                      evidenceLoading={evidenceLoading}
                      evidenceError={evidenceError}
                      busy={busy}
                      canManage={canManage}
                      onClose={onCloseSelection}
                      onDryRun={(routine) => onDryRun(routine.routineId, routine.revision)}
                      onEdit={onEdit}
                      onToggleStatus={setStatusTarget}
                      onArchive={setArchiveTarget}
                      onActivate={onActivate}
                      onTriggerRun={onTriggerRun}
                      onRunCommand={onRunCommand}
                      onRollbackVersion={onRollbackVersion}
                      onDownloadTelemetry={onDownloadTelemetry}
                      onAdvancedCommand={onAdvancedCommand}
                      onRetryRuntime={onRetryRuntime}
                      copy={copy}
                      formatTimestamp={formatTimestamp}
                    />
                  </Box>
                ) : (
                  <Box
                    sx={{
                      p: 3,
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: (theme) => Number(theme.shape.borderRadius) * 2 + 'px',
                    }}
                  >
                    <Stack direction="row" gap={1} alignItems="center">
                      <ShieldCheck size={19} />
                      <Typography variant="subtitle2">{copy.statusReview}</Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {copy.emptyDescription}
                    </Typography>
                  </Box>
                )
              ) : null}
            </Box>
          </Stack>
        )}
      </Stack>

      {compact ? (
        <DwaionRoutineInspector
          routine={selected}
          open={Boolean(selected) && compactInspectorOpen}
          variant="drawer"
          dryRunReceipt={dryRunReceipt}
          runtimeCapabilities={runtimeCapabilities}
          runtimeCapabilitiesError={runtimeCapabilitiesError}
          runs={runs}
          runsLoading={runsLoading}
          runsError={runsError}
          versions={versions}
          health={health}
          rollbackReceipt={rollbackReceipt}
          advancedCommand={advancedCommand}
          evidenceLoading={evidenceLoading}
          evidenceError={evidenceError}
          busy={busy}
          canManage={canManage}
          onClose={() => {
            setCompactInspectorOpen(false);
            onCloseSelection();
          }}
          onDryRun={(routine) => onDryRun(routine.routineId, routine.revision)}
          onEdit={onEdit}
          onToggleStatus={setStatusTarget}
          onArchive={setArchiveTarget}
          onActivate={onActivate}
          onTriggerRun={onTriggerRun}
          onRunCommand={onRunCommand}
          onRollbackVersion={onRollbackVersion}
          onDownloadTelemetry={onDownloadTelemetry}
          onAdvancedCommand={onAdvancedCommand}
          onRetryRuntime={onRetryRuntime}
          copy={copy}
          formatTimestamp={formatTimestamp}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(statusTarget)}
        title={statusTarget?.status === 'PAUSED' ? copy.resumeTitle : copy.pauseTitle}
        description={
          statusTarget?.status === 'PAUSED' ? copy.resumeDescription : copy.pauseDescription
        }
        cancelLabel={copy.cancel}
        confirmLabel={copy.confirm}
        busy={busy}
        onClose={() => setStatusTarget(null)}
        onConfirm={() => {
          if (!statusTarget) return;
          onSetLifecycle(
            statusTarget.routineId,
            statusTarget.revision,
            statusTarget.status === 'PAUSED' ? 'RESUME' : 'PAUSE'
          );
          setStatusTarget(null);
        }}
      />
      <ConfirmDialog
        open={Boolean(archiveTarget)}
        title={copy.archiveTitle}
        description={copy.archiveDescription}
        cancelLabel={copy.cancel}
        confirmLabel={copy.archive}
        busy={busy}
        intent="danger"
        onClose={() => setArchiveTarget(null)}
        onConfirm={() => {
          if (!archiveTarget) return;
          onArchive(archiveTarget.routineId, archiveTarget.revision);
          setArchiveTarget(null);
        }}
      />
    </PageCanvas>
  );
}
