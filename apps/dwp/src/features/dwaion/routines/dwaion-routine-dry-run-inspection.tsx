import { CheckCircle2, FlaskConical, ShieldCheck } from 'lucide-react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { InlineFeedback } from '@dwp-frontend/design-system';

import type { DwaionRoutineRuntimeCapabilities } from '@dwp-frontend/shared-utils';
import type { DwaionRoutineCopy } from './dwaion-routine-copy';
import type { DwaionRoutine, DwaionRoutineDryRunReceipt } from './dwaion-routine-model';

export function DwaionRoutineDryRunInspection({
  routine,
  receipt,
  capabilities,
  copy,
  formatTimestamp,
}: {
  routine: DwaionRoutine;
  receipt: DwaionRoutineDryRunReceipt | null;
  capabilities?: DwaionRoutineRuntimeCapabilities;
  copy: DwaionRoutineCopy;
  formatTimestamp: (value: string) => string;
}) {
  const zeroWriteReady = Boolean(
    capabilities?.zeroWritePolicy.available && capabilities.zeroWritePolicy.configured
  );
  const pipeline = [
    {
      title: copy.dryRunStages.purpose,
      detail: routine.description,
      ready: true,
    },
    {
      title: copy.dryRunStages.sources,
      detail: routine.sourceKeys.join(' · '),
      ready: routine.sourceKeys.length > 0,
    },
    {
      title: copy.dryRunStages.trigger,
      detail:
        routine.triggerType === 'WEBHOOK'
          ? `${routine.webhookEventType ?? copy.capabilityUnavailable} · ${routine.webhookEndpointReference ?? copy.capabilityUnavailable}`
          : `${copy.cadence[routine.schedule.cadence]} · ${routine.schedule.localTime} · ${routine.schedule.timeZone}`,
      ready: true,
    },
    {
      title: copy.dryRunStages.zeroWrite,
      detail: receipt
        ? `${copy.externalWrites}: ${receipt.externalWritesPerformed}`
        : zeroWriteReady
          ? copy.zeroWritePolicyOnly
          : (capabilities?.zeroWritePolicy.recoveryHint ?? copy.runtimeActionUnavailable),
      ready: receipt ? receipt.externalWritesPerformed === 0 : zeroWriteReady,
    },
    {
      title: copy.dryRunStages.delivery,
      detail: receipt
        ? `${copy.runProposals} ${receipt.proposalsCreated} · ${copy.dryRunMetrics.records} ${receipt.businessEvidenceCount}`
        : copy.dryRunResultUnavailable,
      ready: Boolean(receipt),
    },
  ];

  return (
    <Box
      component="section"
      aria-labelledby="routine-dry-run-inspection-title"
      data-testid="dwaion-routine-dry-run-inspection"
      sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1.5 }}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" gap={0.75} alignItems="center">
            <FlaskConical size={17} aria-hidden="true" />
            <Typography id="routine-dry-run-inspection-title" component="h3" variant="subtitle2">
              {copy.dryRunInspectionTitle}
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {copy.dryRunInspectionDescription}
          </Typography>
        </Box>
        <Chip
          size="small"
          color={receipt ? 'success' : 'default'}
          label={receipt ? copy.dryRunOutcomes.VALIDATED : copy.dryRunReceiptUnavailable}
        />
      </Stack>

      <Stack component="ol" gap={0.6} sx={{ p: 0, m: 0, mt: 1, listStyle: 'none' }}>
        {pipeline.map((stage, index) => (
          <Box
            component="li"
            key={stage.title}
            sx={{
              display: 'grid',
              gridTemplateColumns: '26px minmax(0, 1fr)',
              gap: 0.75,
              p: 0.85,
              bgcolor: stage.ready ? 'var(--dwp-product-soft)' : 'action.hover',
              borderRadius: 1,
            }}
          >
            <Box
              aria-hidden="true"
              sx={{
                width: 22,
                height: 22,
                display: 'grid',
                placeItems: 'center',
                borderRadius: '50%',
                bgcolor: stage.ready ? 'primary.main' : 'action.disabled',
                color: 'primary.contrastText',
                fontWeight: 'fontWeightBold',
                fontSize: 'caption.fontSize',
              }}
            >
              {index + 1}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight="fontWeightBold">
                {stage.title}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ overflowWrap: 'anywhere' }}
              >
                {stage.detail}
              </Typography>
            </Box>
          </Box>
        ))}
      </Stack>

      {receipt ? (
        <Box sx={{ mt: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Stack direction="row" gap={0.75} alignItems="center">
            <CheckCircle2 size={16} color="var(--mui-palette-success-main)" aria-hidden="true" />
            <Typography variant="subtitle2">{copy.dryRunOutcomes.VALIDATED}</Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {formatTimestamp(receipt.evaluatedAt)} · {receipt.routineRunId}
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 0.75,
              mt: 0.75,
            }}
          >
            <Metric label={copy.dryRunMetrics.sources} value={receipt.evidenceCount} />
            <Metric label={copy.dryRunMetrics.records} value={receipt.businessEvidenceCount} />
            <Metric label={copy.dryRunMetrics.proposals} value={receipt.proposalsCreated} />
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
            {copy.nextPreview}:{' '}
            {receipt.previewNextRunAt
              ? formatTimestamp(receipt.previewNextRunAt)
              : (routine.webhookEventType ?? copy.webhookTrigger)}
          </Typography>
        </Box>
      ) : (
        <InlineFeedback severity="info" sx={{ mt: 1 }}>
          {copy.dryRunResultUnavailable}
        </InlineFeedback>
      )}

      <Box sx={{ mt: 1.25 }}>
        <Stack direction="row" gap={0.75} alignItems="center">
          <ShieldCheck size={16} aria-hidden="true" />
          <Typography component="h4" variant="subtitle2">
            {copy.dryRunEvidenceBoundaryTitle}
          </Typography>
        </Stack>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
            gap: 0.75,
            mt: 0.75,
          }}
        >
          {[
            [copy.dryRunCost, copy.dryRunCostUnavailable],
            [copy.dryRunLatency, copy.dryRunLatencyUnavailable],
            [copy.idempotencyEvidence, copy.dryRunIdempotencyUnavailable],
          ].map(([label, reason]) => (
            <Box key={label} sx={{ p: 0.85, border: 1, borderColor: 'divider', borderRadius: 1 }}>
              <Typography variant="body2" fontWeight="fontWeightBold">
                {label}
              </Typography>
              <Chip
                size="small"
                variant="outlined"
                label={copy.capabilityUnavailable}
                sx={{ my: 0.5 }}
              />
              <Typography variant="caption" color="text.secondary" display="block">
                {reason}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Box sx={{ p: 0.6, bgcolor: 'background.paper', textAlign: 'center' }}>
      <Typography variant="subtitle2" color={value ? 'success.main' : 'text.primary'}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}
