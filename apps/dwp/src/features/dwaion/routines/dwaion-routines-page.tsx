import { useMemo, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';

import {
  ActionButton,
  ConfirmDialog,
  ErrorState,
  GuidedEmptyState,
  LoadingState,
  OperationalKpiStrip,
  PageCanvas,
} from '@dwp-frontend/design-system';

import { DWAION_ROUTINE_COPY_KO } from './dwaion-routine-copy';
import { DwaionRoutineInspector } from './dwaion-routine-inspector';
import { DwaionRoutineList } from './dwaion-routine-list';
import { routineConsentComplete } from './dwaion-routine-model';

import type { DwaionRoutineCopy } from './dwaion-routine-copy';
import type {
  DwaionRoutine,
  DwaionRoutineDryRunReceipt,
  DwaionRoutineViewState,
} from './dwaion-routine-model';

export function DwaionRoutinesPage({
  state,
  routines,
  selectedId,
  partialError,
  commandError,
  dryRunReceipt,
  busy = false,
  canManage = true,
  canCreate = canManage,
  onRetry,
  onCreate,
  onSelect,
  onCloseSelection,
  onDryRun,
  onEdit,
  onSetLifecycle,
  onArchive,
  copy = DWAION_ROUTINE_COPY_KO,
  formatTimestamp,
}: {
  state: DwaionRoutineViewState;
  routines: readonly DwaionRoutine[];
  selectedId?: string;
  partialError?: string;
  commandError?: 'REVISION_CONFLICT' | 'COMMAND_FAILED';
  dryRunReceipt?: DwaionRoutineDryRunReceipt | null;
  busy?: boolean;
  canManage?: boolean;
  canCreate?: boolean;
  onRetry: () => void;
  onCreate: () => void;
  onSelect: (routine: DwaionRoutine) => void;
  onCloseSelection: () => void;
  onDryRun: (routineId: string, expectedRevision: number) => void;
  onEdit: (routine: DwaionRoutine) => void;
  onSetLifecycle: (routineId: string, expectedRevision: number, action: 'PAUSE' | 'RESUME') => void;
  onArchive: (routineId: string, expectedRevision: number) => void;
  copy?: DwaionRoutineCopy;
  formatTimestamp?: (value: string) => string;
}) {
  const compact = useMediaQuery('(max-width:899.95px)', { noSsr: true });
  const selected = useMemo(
    () => routines.find((routine) => routine.routineId === selectedId) ?? null,
    [routines, selectedId]
  );
  const [compactInspectorOpen, setCompactInspectorOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<DwaionRoutine | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<DwaionRoutine | null>(null);
  const metrics = useMemo(
    () => ({
      total: routines.length,
      ready: routines.filter(
        (routine) => routine.status === 'DRAFT' && routineConsentComplete(routine.consents)
      ).length,
      attention: routines.filter(
        (routine) => routine.status === 'DRAFT' && !routineConsentComplete(routine.consents)
      ).length,
      paused: routines.filter((routine) => routine.status === 'PAUSED').length,
    }),
    [routines]
  );

  return (
    <PageCanvas mode="workspace">
      <Stack gap={3}>
        <Stack
          component="header"
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ sm: 'flex-start' }}
          gap={2}
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
        {commandError ? (
          <Typography role="alert" variant="body2" color="error.main">
            {commandError === 'REVISION_CONFLICT' ? copy.revisionConflict : copy.commandFailed}
          </Typography>
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
              },
            ]}
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
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) 480px' },
              minWidth: 0,
              borderTop: 1,
              borderColor: 'divider',
            }}
          >
            <DwaionRoutineList
              routines={routines}
              selectedId={selectedId}
              onSelect={(routine) => {
                onSelect(routine);
                if (compact) setCompactInspectorOpen(true);
              }}
              copy={copy}
            />
            {!compact ? (
              selected ? (
                <Box sx={{ borderLeft: 1, borderColor: 'divider', minWidth: 0 }}>
                  <DwaionRoutineInspector
                    routine={selected}
                    open
                    variant="inline"
                    dryRunReceipt={dryRunReceipt}
                    busy={busy}
                    canManage={canManage}
                    onClose={onCloseSelection}
                    onDryRun={(routine) => onDryRun(routine.routineId, routine.revision)}
                    onEdit={onEdit}
                    onToggleStatus={setStatusTarget}
                    onArchive={setArchiveTarget}
                    copy={copy}
                    formatTimestamp={formatTimestamp}
                  />
                </Box>
              ) : (
                <GuidedEmptyState
                  kind="empty"
                  title={copy.title}
                  description={copy.emptyDescription}
                  announce={false}
                />
              )
            ) : null}
          </Box>
        )}
      </Stack>

      {compact ? (
        <DwaionRoutineInspector
          routine={selected}
          open={Boolean(selected) && compactInspectorOpen}
          variant="drawer"
          dryRunReceipt={dryRunReceipt}
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
