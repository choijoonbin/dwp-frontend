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
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ActionButton, DetailInspector, InlineFeedback } from '@dwp-frontend/design-system';

import { DWAION_ROUTINE_COPY_KO } from './dwaion-routine-copy';
import {
  routineCommandState,
  routineConsentComplete,
  routineDryRunIsCurrent,
} from './dwaion-routine-model';

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
    routineCommandState(routine, routine.revision).allowed && canManage && !busy;

  return (
    <DetailInspector
      open={open}
      variant={variant}
      width={480}
      title={routine.title}
      subtitle={`${
        routine.status === 'DRAFT' && !consentReady
          ? copy.filters.ATTENTION
          : copy.status[routine.status]
      } ${copy.separator} ${copy.revisionPrefix}${routine.revision}`}
      closeLabel={copy.close}
      onClose={onClose}
      status={<Chip size="small" variant="outlined" color="info" label={copy.proposalOnly} />}
    >
      <Stack gap={2}>
        <InlineFeedback severity="info">
          <Typography variant="body2" fontWeight="fontWeightBold">
            {copy.schedulerUnavailable}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {copy.schedulerUnavailableHelp}
          </Typography>
        </InlineFeedback>

        <Box component="section" aria-labelledby="routine-consent-title">
          <Stack direction="row" alignItems="center" gap={0.75}>
            <ShieldCheck size={17} aria-hidden="true" />
            <Typography id="routine-consent-title" component="h3" variant="subtitle2">
              {copy.contractTitle}
            </Typography>
          </Stack>
          <Stack component="ol" sx={{ p: 0, m: 0, mt: 1, listStyle: 'none' }} gap={0.6}>
            <ContractStep
              number={1}
              title={copy.contractSteps.purpose}
              value={routine.description}
            />
            <ContractStep
              number={2}
              title={copy.contractSteps.source}
              value={routine.sourceKeys
                .map(
                  (source) => copy.sourceLabels[source as keyof typeof copy.sourceLabels] ?? source
                )
                .join(' · ')}
            />
            <ContractStep
              number={3}
              title={copy.contractSteps.trigger}
              value={`${copy.cadence[routine.schedule.cadence]} · ${routine.schedule.localTime.slice(0, 5)} · ${routine.schedule.timeZone}. ${copy.contractValues.triggerPreview}`}
              warning={!routine.schedulingAvailable || !routine.backgroundExecutionAvailable}
            />
            <ContractStep
              number={4}
              title={copy.contractSteps.handoff}
              value={
                routine.proposalDeliveryAvailable
                  ? copy.proposalOnlyHelp
                  : copy.contractValues.handoffUnavailable
              }
              warning={!routine.proposalDeliveryAvailable}
            />
            <ContractStep
              number={5}
              title={copy.contractSteps.guardrail}
              value={copy.contractValues.guardrail}
            />
            <ContractStep
              number={6}
              title={copy.contractSteps.consent}
              value={
                consentReady
                  ? copy.contractValues.consentComplete
                  : copy.contractValues.consentIncomplete
              }
              warning={!consentReady}
            >
              <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.75 }}>
                {routine.consents.map((consent) => (
                  <Chip
                    key={consent.key}
                    size="small"
                    color={consent.state === 'ENABLED' ? 'success' : 'warning'}
                    variant="outlined"
                    label={`${copy.consentLabels[consent.key]} · ${copy.consentStates[consent.state]}`}
                  />
                ))}
              </Stack>
            </ContractStep>
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
                <Box
                  sx={{
                    mt: 1,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: 0.75,
                  }}
                >
                  <ReceiptMetric
                    label={copy.dryRunMetrics.sources}
                    value={currentReceipt.evidenceCount}
                  />
                  <ReceiptMetric
                    label={copy.dryRunMetrics.records}
                    value={currentReceipt.businessEvidenceCount}
                  />
                  <ReceiptMetric
                    label={copy.dryRunMetrics.proposals}
                    value={currentReceipt.proposalsCreated}
                  />
                </Box>
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

function ContractStep({
  number,
  title,
  value,
  warning = false,
  children,
}: {
  number: number;
  title: string;
  value: string;
  warning?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Box
      component="li"
      sx={{
        display: 'grid',
        gridTemplateColumns: '28px minmax(0, 1fr)',
        gap: 1,
        p: 1,
        bgcolor: warning ? 'var(--dwp-semantic-warning-soft)' : 'var(--dwp-product-soft)',
        borderRadius: (theme) => Number(theme.shape.borderRadius) * 1.5 + 'px',
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          width: 24,
          height: 24,
          display: 'grid',
          placeItems: 'center',
          borderRadius: '50%',
          bgcolor: warning ? 'warning.main' : 'primary.main',
          color: 'primary.contrastText',
          fontSize: 'caption.fontSize',
          fontWeight: 'fontWeightBold',
        }}
      >
        {number}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="subtitle2">{title}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
          {value}
        </Typography>
        {children}
      </Box>
    </Box>
  );
}

function ReceiptMetric({ label, value }: { label: string; value: number }) {
  return (
    <Box sx={{ p: 0.75, bgcolor: 'background.paper', textAlign: 'center' }}>
      <Typography variant="subtitle2" color={value ? 'success.main' : 'text.primary'}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}
