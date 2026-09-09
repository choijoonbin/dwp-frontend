import { useMemo, useState } from 'react';
import { BellOff, Globe2, Plus, RefreshCw, ShieldCheck, TimerOff } from 'lucide-react';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
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
  const [filter, setFilter] = useState<'ALL' | 'READY' | 'ATTENTION' | 'PAUSED'>('ALL');
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
  const filteredRoutines = useMemo(
    () =>
      routines.filter((routine) => {
        if (filter === 'ALL') return true;
        if (filter === 'PAUSED') return routine.status === 'PAUSED';
        if (filter === 'READY') {
          return routine.status === 'DRAFT' && routineConsentComplete(routine.consents);
        }
        return routine.status === 'DRAFT' && !routineConsentComplete(routine.consents);
      }),
    [filter, routines]
  );
  const filterCounts = {
    ALL: metrics.total,
    READY: metrics.ready,
    ATTENTION: metrics.attention,
    PAUSED: metrics.paused,
  } as const;
  const timeZones = [...new Set(routines.map((routine) => routine.schedule.timeZone))];
  const timeZoneLabel = timeZones.length === 1 ? timeZones[0] : timeZones.join(' · ');

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
                value: '—',
                label: copy.engineUnavailable,
                detail: copy.notificationUnavailable,
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
                <Chip
                  size="small"
                  variant="outlined"
                  icon={<TimerOff size={14} />}
                  label={copy.engineUnavailable}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  icon={<BellOff size={14} />}
                  label={copy.notificationUnavailable}
                />
              </Stack>
            </Stack>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) 480px' },
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
