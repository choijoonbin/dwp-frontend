import {
  Archive,
  CheckCircle2,
  Clock3,
  FlaskConical,
  PauseCircle,
  Pencil,
  PlayCircle,
  ShieldCheck,
} from 'lucide-react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ActionButton, DetailInspector, InlineFeedback } from '@dwp-frontend/design-system';

import { DWAION_ROUTINE_COPY_KO } from './dwaion-routine-copy';
import { routineConsentComplete, routineDryRunIsCurrent } from './dwaion-routine-model';

import type { DwaionRoutineCopy } from './dwaion-routine-copy';
import type { DwaionRoutine, DwaionRoutineDryRunReceipt } from './dwaion-routine-model';

export function DwaionRoutineInspector({
  routine,
  open,
  variant,
  dryRunReceipt,
  busy = false,
  canManage = true,
  onClose,
  onDryRun,
  onEdit,
  onToggleStatus,
  onArchive,
  copy = DWAION_ROUTINE_COPY_KO,
  formatTimestamp = (value) => value,
}: {
  routine: DwaionRoutine | null;
  open: boolean;
  variant: 'inline' | 'drawer';
  dryRunReceipt?: DwaionRoutineDryRunReceipt | null;
  busy?: boolean;
  canManage?: boolean;
  onClose: () => void;
  onDryRun: (routine: DwaionRoutine) => void;
  onEdit: (routine: DwaionRoutine) => void;
  onToggleStatus: (routine: DwaionRoutine) => void;
  onArchive: (routine: DwaionRoutine) => void;
  copy?: DwaionRoutineCopy;
  formatTimestamp?: (value: string) => string;
}) {
  if (!routine) return null;

  const consentReady = routineConsentComplete(routine.consents);
  const currentReceipt = routineDryRunIsCurrent(routine, dryRunReceipt ?? null)
    ? dryRunReceipt
    : null;
  const archived = routine.status === 'ARCHIVED';
  const dryRunEnabled =
    routine.status === 'DRAFT' && consentReady && routine.dryRunAvailable && canManage && !busy;

  return (
    <DetailInspector
      open={open}
      variant={variant}
      width={480}
      title={routine.title}
      subtitle={`${copy.status[routine.status]} ${copy.separator} ${copy.revisionPrefix}${routine.revision}`}
      closeLabel={copy.close}
      onClose={onClose}
      status={<Chip size="small" variant="outlined" color="info" label={copy.proposalOnly} />}
    >
      <Stack gap={2.5}>
        <InlineFeedback severity="info">
          <Typography variant="body2" fontWeight="fontWeightBold">
            {copy.schedulerUnavailable}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {copy.schedulerUnavailableHelp}
          </Typography>
        </InlineFeedback>

        <RoutineDefinition routine={routine} copy={copy} />
        <Divider />

        <Box component="section" aria-labelledby="routine-consent-title">
          <Stack direction="row" alignItems="center" gap={0.75}>
            <ShieldCheck size={17} aria-hidden="true" />
            <Typography id="routine-consent-title" component="h3" variant="subtitle2">
              {copy.consent}
            </Typography>
          </Stack>
          <Stack component="ul" sx={{ p: 0, m: 0, mt: 1, listStyle: 'none' }} gap={0.5}>
            {routine.consents.map((consent) => (
              <Stack
                component="li"
                key={consent.key}
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                gap={1}
                sx={{ minHeight: 44 }}
              >
                <Typography variant="body2">{copy.consentLabels[consent.key]}</Typography>
                <Chip
                  size="small"
                  color={consent.state === 'ENABLED' ? 'success' : 'warning'}
                  variant="outlined"
                  label={copy.consentStates[consent.state]}
                />
              </Stack>
            ))}
          </Stack>
        </Box>

        {currentReceipt ? (
          <Box
            component="section"
            aria-labelledby="routine-dry-run-title"
            sx={{
              p: 2,
              bgcolor: 'action.hover',
            }}
          >
            <Stack direction="row" gap={1} alignItems="flex-start">
              <CheckCircle2 size={18} color="var(--dwp-semantic-success)" aria-hidden="true" />
              <Box sx={{ minWidth: 0 }}>
                <Typography id="routine-dry-run-title" component="h3" variant="subtitle2">
                  {copy.dryRunOutcomes.VALIDATED}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatTimestamp(currentReceipt.evaluatedAt)}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.75 }}>
                  {copy.dryRunEvidence.replace(
                    '{{count}}',
                    String(currentReceipt.validatedSources.length)
                  )}
                </Typography>
                <Stack direction="row" gap={0.75} alignItems="center" sx={{ mt: 0.75 }}>
                  <Clock3 size={15} aria-hidden="true" />
                  <Typography variant="caption" color="text.secondary">
                    {copy.nextPreview}: {formatTimestamp(currentReceipt.previewNextRunAt)}
                  </Typography>
                </Stack>
              </Box>
            </Stack>
          </Box>
        ) : null}

        {!archived ? (
          <Stack gap={1}>
            <ActionButton
              intent="primary"
              fullWidth
              startIcon={<FlaskConical size={17} aria-hidden="true" />}
              disabled={!dryRunEnabled}
              loading={busy}
              loadingLabel={copy.dryRunning}
              onClick={() => onDryRun(routine)}
              sx={{ minHeight: 44 }}
            >
              {copy.dryRun}
            </ActionButton>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
              <ActionButton
                intent="secondary"
                fullWidth
                startIcon={<Pencil size={16} aria-hidden="true" />}
                disabled={busy || !canManage}
                onClick={() => onEdit(routine)}
                sx={{ minHeight: 44 }}
              >
                {copy.edit}
              </ActionButton>
              <ActionButton
                intent="quiet"
                fullWidth
                startIcon={
                  routine.status === 'PAUSED' ? (
                    <PlayCircle size={16} aria-hidden="true" />
                  ) : (
                    <PauseCircle size={16} aria-hidden="true" />
                  )
                }
                disabled={busy || !canManage}
                onClick={() => onToggleStatus(routine)}
                sx={{ minHeight: 44 }}
              >
                {routine.status === 'PAUSED' ? copy.resume : copy.pause}
              </ActionButton>
              <ActionButton
                intent="quiet"
                fullWidth
                startIcon={<Archive size={16} aria-hidden="true" />}
                disabled={busy || !canManage}
                onClick={() => onArchive(routine)}
                sx={{ minHeight: 44 }}
              >
                {copy.archive}
              </ActionButton>
            </Stack>
          </Stack>
        ) : null}
      </Stack>
    </DetailInspector>
  );
}

function RoutineDefinition({ routine, copy }: { routine: DwaionRoutine; copy: DwaionRoutineCopy }) {
  const sourceLabels = routine.sourceKeys.map(
    (source) => copy.sourceLabels[source as keyof typeof copy.sourceLabels] ?? source
  );
  const rows = [
    [
      copy.schedule,
      `${copy.cadence[routine.schedule.cadence]} ${copy.separator} ${routine.schedule.localTime.slice(0, 5)}`,
    ],
    [copy.timeZone, routine.schedule.timeZone],
    [copy.sources, sourceLabels.join(', ')],
  ] as const;

  return (
    <Box component="dl" sx={{ m: 0 }}>
      {rows.map(([label, value]) => (
        <Stack
          key={label}
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          gap={0.5}
          sx={{ minHeight: 44, py: 1, borderBottom: 1, borderColor: 'divider' }}
        >
          <Typography component="dt" variant="caption" color="text.secondary">
            {label}
          </Typography>
          <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: 'anywhere' }}>
            {value}
          </Typography>
        </Stack>
      ))}
    </Box>
  );
}
