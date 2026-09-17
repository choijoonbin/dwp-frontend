import { useId, useState } from 'react';
import { Check, RefreshCw, ShieldCheck, X } from 'lucide-react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ActionButton, FormDialog, FormField } from '@dwp-frontend/design-system';

import type { DwaionRoutineCopy } from './dwaion-routine-copy';
import type {
  DwaionRoutineAdvancedCommand,
  DwaionRoutineAdvancedDecisionInput,
} from '@dwp-frontend/shared-utils';

type DecisionTarget = {
  command: DwaionRoutineAdvancedCommand;
  decision: DwaionRoutineAdvancedDecisionInput['decision'];
};

export function DwaionRoutineApprovalQueue({
  commands,
  loading,
  error,
  busy,
  copy,
  formatTimestamp = (value) => value,
  onRetry,
  onDecide,
}: {
  commands: readonly DwaionRoutineAdvancedCommand[];
  loading?: boolean;
  error?: boolean;
  busy?: boolean;
  copy: DwaionRoutineCopy;
  formatTimestamp?: (value: string) => string;
  onRetry: () => void;
  onDecide: (
    command: DwaionRoutineAdvancedCommand,
    input: DwaionRoutineAdvancedDecisionInput
  ) => Promise<void>;
}) {
  const titleId = useId();
  const [target, setTarget] = useState<DecisionTarget | null>(null);
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const evidenceRefs = evidence
    .split(/\r?\n/gu)
    .map((value) => value.trim())
    .filter(Boolean);
  const reasonValid = reason.trim().replaceAll(/\s+/gu, ' ').length >= 5;
  const evidenceValid =
    evidenceRefs.length >= 1 &&
    evidenceRefs.length <= 20 &&
    evidenceRefs.every((value) => value.length <= 240) &&
    new Set(evidenceRefs).size === evidenceRefs.length;

  const openDecision = (
    command: DwaionRoutineAdvancedCommand,
    decision: DwaionRoutineAdvancedDecisionInput['decision']
  ) => {
    setTarget({ command, decision });
    setReason('');
    setEvidence('');
    setSubmitted(false);
  };
  const closeDecision = () => {
    if (!busy) setTarget(null);
  };
  const submitDecision = async () => {
    setSubmitted(true);
    if (!target || !reasonValid || !evidenceValid) return;
    try {
      await onDecide(target.command, {
        decision: target.decision,
        changeReason: reason,
        evidenceRefs,
      });
      setTarget(null);
    } catch {
      // The mutation presents the server error and leaves the reviewed input intact.
    }
  };

  return (
    <>
      <Box
        component="section"
        aria-labelledby={titleId}
        sx={{
          border: 1,
          borderColor: commands.length ? 'primary.light' : 'divider',
          borderRadius: (theme) => Number(theme.shape.borderRadius) * 2 + 'px',
          bgcolor: 'background.paper',
          overflow: 'hidden',
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ sm: 'center' }}
          justifyContent="space-between"
          gap={1}
          sx={{ p: { xs: 1.5, sm: 2 } }}
        >
          <Stack direction="row" alignItems="flex-start" gap={1.25} sx={{ minWidth: 0 }}>
            <Box
              sx={{
                display: 'grid',
                placeItems: 'center',
                width: 36,
                height: 36,
                flexShrink: 0,
                borderRadius: '12px',
                bgcolor: 'var(--dwp-product-soft)',
                color: 'primary.main',
              }}
            >
              <ShieldCheck size={19} aria-hidden="true" />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
                <Typography id={titleId} component="h2" variant="subtitle1">
                  {copy.approvalQueue.title}
                </Typography>
                <Chip
                  size="small"
                  color={commands.length ? 'primary' : 'default'}
                  label={copy.approvalQueue.pendingCount.replace(
                    '{{count}}',
                    String(commands.length)
                  )}
                />
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                {copy.approvalQueue.description}
              </Typography>
            </Box>
          </Stack>
          <ActionButton
            intent="quiet"
            startIcon={
              loading ? <CircularProgress size={16} color="inherit" /> : <RefreshCw size={16} />
            }
            onClick={onRetry}
            disabled={loading || busy}
            sx={{ minHeight: 44, alignSelf: { xs: 'stretch', sm: 'center' } }}
          >
            {copy.approvalQueue.retry}
          </ActionButton>
        </Stack>
        <Divider />
        {error ? (
          <Alert
            severity="error"
            action={
              <ActionButton intent="quiet" size="small" onClick={onRetry}>
                {copy.approvalQueue.retry}
              </ActionButton>
            }
            sx={{ m: 1.5 }}
          >
            {copy.approvalQueue.error}
          </Alert>
        ) : loading && commands.length === 0 ? (
          <Stack role="status" direction="row" alignItems="center" gap={1} sx={{ p: 2 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">
              {copy.approvalQueue.loading}
            </Typography>
          </Stack>
        ) : commands.length === 0 ? (
          <Typography role="status" variant="body2" color="text.secondary" sx={{ p: 2 }}>
            {copy.approvalQueue.empty}
          </Typography>
        ) : (
          <Box
            component="ul"
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
              gap: 1,
              p: 1.5,
              m: 0,
              listStyle: 'none',
            }}
          >
            {commands.map((command) => (
              <Box
                component="li"
                key={command.commandId}
                sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: '12px' }}
              >
                <Stack gap={1.25}>
                  {command.proposedDefinition ? (
                    <Box>
                      <Typography variant="overline" color="primary.main">
                        {copy.approvalQueue.proposedChange}
                      </Typography>
                      <Typography component="h3" variant="subtitle1">
                        {command.proposedDefinition.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                        {command.proposedDefinition.objective}
                      </Typography>
                      <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 1 }}>
                        {command.proposedDefinition.sources.map((source) => (
                          <Chip key={source} size="small" label={copy.sourceLabels[source]} />
                        ))}
                      </Stack>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                          gap: 0.5,
                          mt: 1,
                        }}
                      >
                        <DefinitionFact
                          label={copy.triggerType}
                          value={triggerSummary(command.proposedDefinition, copy)}
                        />
                        <DefinitionFact
                          label={copy.executionBudget}
                          value={`${command.proposedDefinition.budget.maximumRunsPerMonth} / ${command.proposedDefinition.budget.maximumTokensPerRun} / ${command.proposedDefinition.budget.maximumMinutesPerRun}m`}
                        />
                        <DefinitionFact
                          label={copy.recoveryPolicy}
                          value={`${command.proposedDefinition.retryPolicy.maximumAttempts}× · ${command.proposedDefinition.retryPolicy.initialBackoffSeconds}s · ${command.proposedDefinition.retryPolicy.backoffMultiplier}×`}
                        />
                        <DefinitionFact
                          label={`${copy.activeFrom} / ${copy.activeUntil}`}
                          value={`${command.proposedDefinition.activeFrom ?? '—'} → ${command.proposedDefinition.activeUntil ?? '—'}`}
                        />
                        <DefinitionFact
                          label={copy.quietHours}
                          value={`${command.proposedDefinition.quietHoursStart ?? '—'} → ${command.proposedDefinition.quietHoursEnd ?? '—'}`}
                        />
                        <DefinitionFact
                          label={copy.notificationDelivery}
                          value={notificationSummary(command.proposedDefinition, copy)}
                        />
                        <DefinitionFact
                          label={copy.compensationEnabled}
                          value={
                            command.proposedDefinition.compensationPolicy.enabled
                              ? command.proposedDefinition.compensationPolicy.strategy
                              : copy.capabilityUnavailable
                          }
                        />
                      </Box>
                    </Box>
                  ) : null}
                  <Divider />
                  <Stack direction="row" justifyContent="space-between" gap={1}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="subtitle2" noWrap title={command.ownerUserId}>
                        {copy.approvalQueue.maker}: {command.makerUserId}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {copy.approvalQueue.submitted}: {formatTimestamp(command.createdAt)}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={`${copy.approvalQueue.revision} ${command.expectedRevision}`}
                    />
                  </Stack>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ overflowWrap: 'anywhere' }}
                  >
                    {copy.approvalQueue.routine}: {command.routineId}
                  </Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} gap={0.75}>
                    <ActionButton
                      intent="primary"
                      startIcon={<Check size={16} />}
                      onClick={() => openDecision(command, 'APPROVE')}
                      disabled={busy || !command.canApprove}
                      sx={{ minHeight: 44, flex: 1 }}
                    >
                      {copy.approvalQueue.approve}
                    </ActionButton>
                    <ActionButton
                      intent="danger"
                      startIcon={<X size={16} />}
                      onClick={() => openDecision(command, 'REJECT')}
                      disabled={busy || !command.canApprove}
                      sx={{ minHeight: 44, flex: 1 }}
                    >
                      {copy.approvalQueue.reject}
                    </ActionButton>
                  </Stack>
                </Stack>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      <FormDialog
        open={Boolean(target)}
        title={
          target?.decision === 'APPROVE'
            ? copy.approvalQueue.approveTitle
            : copy.approvalQueue.rejectTitle
        }
        description={copy.approvalQueue.decisionDescription}
        cancelLabel={copy.approvalQueue.cancel}
        submitLabel={
          target?.decision === 'APPROVE' ? copy.approvalQueue.approve : copy.approvalQueue.reject
        }
        submittingLabel={copy.approvalQueue.submitting}
        submitIntent={target?.decision === 'REJECT' ? 'danger' : 'primary'}
        busy={busy}
        submitDisabled={submitted && (!reasonValid || !evidenceValid)}
        mobileFullScreen
        onClose={closeDecision}
        onSubmit={submitDecision}
      >
        <Stack gap={2}>
          <FormField
            label={copy.approvalQueue.reasonLabel}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            multiline
            minRows={3}
            required
            errorMessage={submitted && !reasonValid ? copy.approvalQueue.invalidReason : undefined}
            supportingText={submitted && !reasonValid ? undefined : copy.approvalQueue.reasonHelp}
            slotProps={{ htmlInput: { maxLength: 1_000 } }}
          />
          <FormField
            label={copy.approvalQueue.evidenceLabel}
            value={evidence}
            onChange={(event) => setEvidence(event.target.value)}
            multiline
            minRows={4}
            required
            placeholder={copy.approvalQueue.evidencePlaceholder}
            errorMessage={
              submitted && !evidenceValid ? copy.approvalQueue.invalidEvidence : undefined
            }
            supportingText={
              submitted && !evidenceValid ? undefined : copy.approvalQueue.evidenceHelp
            }
          />
        </Stack>
      </FormDialog>
    </>
  );
}

function DefinitionFact({ label, value }: { label: string; value: string }) {
  return (
    <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
      <Box component="span" sx={{ color: 'text.primary', fontWeight: 'fontWeightMedium' }}>
        {label}
      </Box>{' '}
      · {value}
    </Typography>
  );
}

function triggerSummary(
  definition: NonNullable<DwaionRoutineAdvancedCommand['proposedDefinition']>,
  copy: DwaionRoutineCopy
): string {
  if (definition.triggerType === 'WEBHOOK') {
    return [
      copy.webhookTrigger,
      definition.webhookEventType,
      definition.webhookEndpointReference,
      definition.locale,
    ]
      .filter(Boolean)
      .join(' · ');
  }
  const cadence = definition.cadence ? copy.cadence[definition.cadence] : '';
  const days = definition.weekDays?.length ? definition.weekDays.join(',') : null;
  const monthDay = definition.monthDay ? `${copy.monthDay} ${definition.monthDay}` : null;
  return [
    copy.scheduledTrigger,
    cadence,
    days,
    monthDay,
    definition.localTime,
    definition.timeZone,
    definition.locale,
  ]
    .filter(Boolean)
    .join(' · ');
}

function notificationSummary(
  definition: NonNullable<DwaionRoutineAdvancedCommand['proposedDefinition']>,
  copy: DwaionRoutineCopy
): string {
  const policy = definition.notificationPolicy;
  return [
    `${copy.notifyOnPartial}:${policy.notifyOnPartial ? 'ON' : 'OFF'}`,
    `${copy.notifyOnFailure}:${policy.notifyOnFailure ? 'ON' : 'OFF'}`,
    `${copy.notifyOnRecovery}:${policy.notifyOnRecovery ? 'ON' : 'OFF'}`,
  ].join(' · ');
}
