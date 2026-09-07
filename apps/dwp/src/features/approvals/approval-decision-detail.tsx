import {
  ArrowLeft,
  Check,
  CheckCircle2,
  CircleDot,
  Clock3,
  Hand,
  MessageSquareText,
  ShieldAlert,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  ActionButton,
  ActionIconButton,
  ErrorState,
  LoadingState,
} from '@dwp-frontend/design-system';
import { formatDate, useDisplayDictionary } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import {
  buildApprovalDecisionSignals,
  buildApprovalWorkflowEvidence,
} from './approval-command-center-model';
import { ApprovalPayloadData } from './approval-payload-data';
import {
  approvalTimelineEventContext,
  approvalTimelineEventDetail,
} from './approval-timeline-copy';
import { PriorityChip, StatusChip } from './approval-ui';

import type { ApprovalDecisionSignal } from './approval-command-center-model';
import type { ApprovalTaskDetail } from '@dwp-frontend/shared-utils';

export type ApprovalDecisionKind = 'APPROVE' | 'REJECT' | 'REQUEST_INFO';

export function ApprovalDecisionDetail({
  detail,
  loading,
  error,
  mobile,
  decisionBusy,
  claimBusy,
  onBack,
  onRetry,
  onClaim,
  onDecision,
}: {
  detail?: ApprovalTaskDetail;
  loading: boolean;
  error: boolean;
  mobile: boolean;
  decisionBusy: boolean;
  claimBusy: boolean;
  onBack: () => void;
  onRetry: () => void;
  onClaim: () => void;
  onDecision: (decision: ApprovalDecisionKind) => void;
}) {
  const { t } = useTranslation('approvals');
  const display = useDisplayDictionary();

  if (loading) {
    return (
      <DetailStateShell mobile={mobile} onBack={onBack}>
        <LoadingState label={t('common:labels.loading')} size="page" embedded />
      </DetailStateShell>
    );
  }
  if (error) {
    return (
      <DetailStateShell mobile={mobile} onBack={onBack}>
        <ErrorState
          title={t('inbox.detailLoadError')}
          retryLabel={t('actions.retry')}
          onRetry={onRetry}
          size="standard"
        />
      </DetailStateShell>
    );
  }
  if (!detail) {
    return (
      <DetailStateShell mobile={false} onBack={onBack}>
        <Box sx={{ textAlign: 'center', maxWidth: 420 }}>
          <MessageSquareText size={34} color="currentColor" aria-hidden="true" />
          <Typography component="p" variant="subtitle1" sx={{ mt: 1 }}>
            {t('home.commandCenter.selectTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('home.commandCenter.selectDescription')}
          </Typography>
        </Box>
      </DetailStateShell>
    );
  }

  const signals = buildApprovalDecisionSignals(detail, Date.now());
  const workflow = buildApprovalWorkflowEvidence(detail);
  return (
    <Box sx={{ minWidth: 0, bgcolor: 'background.paper' }}>
      <Box
        sx={{
          px: { xs: 1.5, sm: 2.5 },
          py: 1.75,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        {mobile && (
          <Stack direction="row" alignItems="center" gap={0.5} sx={{ mb: 1 }}>
            <ActionIconButton label={t('home.commandCenter.backToQueue')} onClick={onBack}>
              <ArrowLeft size={18} />
            </ActionIconButton>
            <Typography component="p" variant="subtitle2">
              {t('home.commandCenter.detailTitle')}
            </Typography>
          </Stack>
        )}
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={2}>
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mb: 1 }}>
              <PriorityChip priority={detail.task.priority} />
              <StatusChip status={detail.task.status} />
              <Chip
                size="small"
                variant="outlined"
                label={t(`classification.${detail.task.dataClassification}`, {
                  defaultValue: detail.task.dataClassification,
                })}
              />
            </Stack>
            <Typography component="h2" variant="h5" sx={{ overflowWrap: 'anywhere' }}>
              {detail.task.title}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>
              {detail.task.summary}
            </Typography>
          </Box>
          <Box sx={{ minWidth: 72, textAlign: 'right' }}>
            <Typography variant="caption" color="text.secondary">
              {t('inbox.risk')}
            </Typography>
            <Typography
              component="p"
              variant="h4"
              color={
                detail.task.riskScore >= 80
                  ? 'error.main'
                  : detail.task.riskScore >= 60
                    ? 'warning.main'
                    : 'primary.main'
              }
            >
              {detail.task.riskScore}
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Box
        component="section"
        aria-labelledby="approval-decision-brief-title"
        sx={(theme) => ({
          mx: { xs: 1.5, sm: 2.5 },
          mt: 2,
          px: 2,
          py: 1.75,
          borderLeft: 3,
          borderColor: signals.some((signal) => signal.tone === 'critical')
            ? 'error.main'
            : 'primary.main',
          bgcolor: alpha(theme.palette.primary.main, 0.055),
        })}
      >
        <Stack direction="row" alignItems="center" gap={1}>
          <ShieldAlert size={19} color="currentColor" aria-hidden="true" />
          <Box>
            <Typography id="approval-decision-brief-title" component="h3" variant="subtitle1">
              {t('home.commandCenter.decisionBrief')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('home.commandCenter.decisionBriefDescription')}
            </Typography>
          </Box>
        </Stack>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
            gap: 1,
            mt: 1.5,
          }}
        >
          {signals.map((signal) => (
            <DecisionSignal key={signal.key} signal={signal} />
          ))}
        </Box>
      </Box>

      <Box sx={{ px: { xs: 1.5, sm: 2.5 }, py: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" justifyContent="space-between" gap={1} sx={{ mb: 1.5 }}>
          <Box>
            <Typography component="h3" variant="subtitle1">
              {t('home.commandCenter.workflowEvidence')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('home.commandCenter.workflowEvidenceDescription')}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            {detail.task.requestNumber}
          </Typography>
        </Stack>
        <Box
          component="ol"
          aria-label={t('home.commandCenter.workflowEvidence')}
          sx={{
            m: 0,
            p: 0,
            display: 'flex',
            gap: 1,
            listStyle: 'none',
            overflowX: 'auto',
          }}
        >
          {workflow.map((step) => (
            <Box
              component="li"
              key={step.key}
              aria-current={step.state === 'CURRENT' ? 'step' : undefined}
              sx={{
                minWidth: 144,
                flex: 1,
                py: 1.25,
                borderTop: 3,
                borderColor: step.state === 'CURRENT' ? 'primary.main' : 'success.main',
              }}
            >
              <Stack direction="row" alignItems="center" gap={0.75}>
                {step.state === 'CURRENT' ? (
                  <CircleDot size={17} color="currentColor" aria-hidden="true" />
                ) : (
                  <CheckCircle2 size={17} color="currentColor" aria-hidden="true" />
                )}
                <Typography variant="caption" color="text.secondary">
                  {t('home.commandCenter.stepNumber', { sequence: step.sequence })}
                </Typography>
              </Stack>
              <Typography variant="body2" sx={{ mt: 0.35, overflowWrap: 'anywhere' }}>
                {step.name}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.3fr) minmax(280px, 0.7fr)' },
        }}
      >
        <Box
          component="section"
          aria-labelledby="approval-request-data-title"
          sx={{ minWidth: 0, px: { xs: 1.5, sm: 2.5 }, py: 2 }}
        >
          <Typography id="approval-request-data-title" component="h3" variant="subtitle1">
            {t('inbox.requestData')}
          </Typography>
          <Box sx={{ mt: 1.25 }}>
            <ApprovalPayloadData payload={detail.payload} formSchema={detail.formSchema} />
          </Box>
        </Box>
        <Box
          component="section"
          aria-labelledby="approval-audit-timeline-title"
          sx={{
            minWidth: 0,
            px: { xs: 1.5, sm: 2.5 },
            py: 2,
            borderLeft: { xl: 1 },
            borderTop: { xs: 1, xl: 0 },
            borderColor: 'divider',
          }}
        >
          <Typography id="approval-audit-timeline-title" component="h3" variant="subtitle1">
            {t('inbox.timeline')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('inbox.timelineMeta')}
          </Typography>
          <Stack divider={<Divider flexItem />} sx={{ mt: 1.25 }}>
            {detail.timeline.map((event) => (
              <Stack key={event.eventId} direction="row" gap={1} sx={{ py: 1.1 }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    mt: 0.65,
                    flex: '0 0 8px',
                    borderRadius: '50%',
                    bgcolor: event.outcome === 'SUCCESS' ? 'success.main' : 'warning.main',
                  }}
                />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2">
                    {t(`events.${event.eventType}`, {
                      defaultValue: display('auditActions', event.eventType),
                    })}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {approvalTimelineEventContext(t, event)} ·{' '}
                    {approvalTimelineEventDetail(t, event)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {formatDate(event.occurredAt, { dateStyle: 'medium', timeStyle: 'short' })}
                  </Typography>
                </Box>
              </Stack>
            ))}
          </Stack>
        </Box>
      </Box>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="flex-end"
        gap={1}
        sx={{
          position: 'sticky',
          bottom: 0,
          zIndex: 1,
          px: { xs: 1.5, sm: 2.5 },
          pt: 1.5,
          pb: 'max(12px, env(safe-area-inset-bottom))',
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        {detail.canClaim && (
          <ActionButton
            intent="secondary"
            startIcon={<Hand size={17} />}
            loading={claimBusy}
            disabled={decisionBusy}
            onClick={onClaim}
          >
            {t('actions.claim')}
          </ActionButton>
        )}
        <ActionButton
          intent="secondary"
          startIcon={<MessageSquareText size={17} />}
          disabled={!detail.canDecide || decisionBusy || claimBusy}
          onClick={() => onDecision('REQUEST_INFO')}
        >
          {t('actions.requestInfo')}
        </ActionButton>
        <ActionButton
          intent="danger"
          startIcon={<X size={17} />}
          disabled={!detail.canDecide || decisionBusy || claimBusy}
          onClick={() => onDecision('REJECT')}
        >
          {t('actions.reject')}
        </ActionButton>
        <ActionButton
          intent="primary"
          startIcon={<Check size={17} />}
          disabled={!detail.canDecide || decisionBusy || claimBusy}
          onClick={() => onDecision('APPROVE')}
        >
          {t('actions.approve')}
        </ActionButton>
      </Stack>
    </Box>
  );
}

function DecisionSignal({ signal }: { signal: ApprovalDecisionSignal }) {
  const { t } = useTranslation('approvals');
  const color =
    signal.tone === 'critical'
      ? 'error.main'
      : signal.tone === 'warning'
        ? 'warning.main'
        : signal.tone === 'success'
          ? 'success.main'
          : 'info.main';
  return (
    <Stack direction="row" gap={1} alignItems="flex-start">
      {signal.key === 'DUE_TODAY' || signal.key === 'OVERDUE' ? (
        <Clock3 size={17} color="currentColor" aria-hidden="true" />
      ) : (
        <ShieldAlert size={17} color="currentColor" aria-hidden="true" />
      )}
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" color={color}>
          {t(`home.commandCenter.signals.${signal.key}.title`)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t(`home.commandCenter.signals.${signal.key}.description`)}
        </Typography>
      </Box>
    </Stack>
  );
}

function DetailStateShell({
  mobile,
  onBack,
  children,
}: {
  mobile: boolean;
  onBack: () => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslation('approvals');
  return (
    <Box sx={{ minHeight: 600, display: 'grid', gridTemplateRows: mobile ? 'auto 1fr' : '1fr' }}>
      {mobile && (
        <Box sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}>
          <ActionIconButton label={t('home.commandCenter.backToQueue')} onClick={onBack}>
            <ArrowLeft size={18} />
          </ActionIconButton>
        </Box>
      )}
      <Box sx={{ minHeight: 0, display: 'grid', placeItems: 'center', px: 3 }}>{children}</Box>
    </Box>
  );
}
