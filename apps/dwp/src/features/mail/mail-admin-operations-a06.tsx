import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock3, Download, Eye, LockKeyhole, RefreshCw, RotateCcw } from 'lucide-react';
import { ActionButton, InlineFeedback } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import {
  canCancelMailDelivery,
  getMailDeliveryRecoveryAvailability,
} from './mail-admin-operations-model';
import {
  EvidenceChip,
  Facts,
  FormattedTime,
  Section,
  StateChip,
} from './mail-admin-operations-ui-shared';

import type { MailAdminOverview } from '@dwp-frontend/shared-utils';
import type {
  MailAuditExport,
  MailDeliveryAuditPage,
  MailDeliveryRecoveryEvidence,
} from './mail-admin-operations-model';

const DELIVERY_STAGE_LABELS: Readonly<Record<string, readonly [string, string]>> = {
  RECEIVED: ['received', 'Request received'],
  OUTBOX: ['outbox', 'Waiting in the delivery queue'],
  PROVIDER_SUBMITTED: ['providerSubmitted', 'Submitted to the mail provider'],
  ACCEPTED_BY_PROVIDER: ['acceptedByProvider', 'Accepted by the mail provider'],
  DELIVERED_CONFIRMED: ['deliveredConfirmed', 'Delivery confirmed'],
  BOUNCED: ['bounced', 'Message bounced'],
  FAILED: ['failed', 'Delivery failed'],
  UNKNOWN: ['unknown', 'Outcome unknown'],
  CANCELLED: ['cancelled', 'Delivery cancelled'],
  BLOCKED_BY_ACCESS: ['blockedByAccess', 'Blocked by access policy'],
  COMMAND_ACCEPTED: ['commandAccepted', 'Send command accepted'],
  PROVIDER_ATTEMPT: ['providerAttempt', 'Mail provider attempt'],
  PROVIDER_ACCEPTED: ['providerAccepted', 'Mail provider accepted the message'],
  ADMIN_RECONCILE: ['adminReconcile', 'Outcome reconciliation recorded'],
  ADMIN_RETRY: ['adminRetry', 'Retry recorded'],
  ADMIN_CANCEL: ['adminCancel', 'Cancellation recorded'],
  DWP_OUTBOX: ['outbox', 'Waiting in the delivery queue'],
  DWP_WORKER: ['worker', 'Delivery processing'],
  PROVIDER_RECEIPT: ['providerReceipt', 'Mail provider receipt'],
};

const DELIVERY_SOURCE_LABELS: Readonly<Record<string, readonly [string, string]>> = {
  mail_delivery_outbox: ['queue', 'Delivery queue'],
  DWP_OUTBOX: ['queue', 'Delivery queue'],
  DWP_WORKER: ['worker', 'Delivery worker'],
  PROVIDER_RECEIPT: ['providerReceipt', 'Mail provider receipt'],
  mail_delivery_recovery_events: ['adminAudit', 'Administrator recovery audit'],
  DWP_SANDBOX: ['dwpMail', 'DWP Mail'],
  MICROSOFT_GRAPH: ['microsoft365', 'Microsoft 365'],
  GOOGLE_GMAIL: ['googleWorkspace', 'Google Workspace'],
  NAVER_WORKS: ['naverWorks', 'NAVER WORKS'],
  JMAP: ['standardProvider', 'Connected mail provider'],
  IMAP_SMTP: ['standardProvider', 'Connected mail provider'],
};

const DELIVERY_COMMAND_LABELS: Readonly<Record<string, readonly [string, string]>> = {
  SEND: ['send', 'Send message'],
  RETRY: ['retry', 'Retry message'],
  CANCEL: ['cancel', 'Cancel delivery'],
  RECONCILE: ['reconcile', 'Reconcile outcome'],
};

const DELIVERY_BLOCKER_LABELS: Readonly<Record<string, string>> = {
  RESULT_UNKNOWN_RECONCILE_FIRST: 'Reconcile the outcome before deciding whether to retry.',
  RECOVERY_EVIDENCE_NOT_CURRENT: 'Refresh recovery evidence before deciding whether to retry.',
  NOT_RETRYABLE: 'This delivery is not eligible for retry.',
  DUPLICATE_SAFETY_UNVERIFIED: 'Duplicate-safety evidence is unverified.',
  RECONCILIATION_UNAVAILABLE: 'Outcome reconciliation is unavailable.',
};

export function DeliveryAuditSurface({
  overview,
  page,
  auditExport,
  evidence,
  canReadAudit,
  canRecover,
  canExport,
  now,
  busyAction,
  onReconcile,
  onRetry,
  onCancel,
  onExport,
}: {
  overview: MailAdminOverview;
  page?: MailDeliveryAuditPage;
  auditExport?: MailAuditExport;
  evidence?: readonly MailDeliveryRecoveryEvidence[];
  canReadAudit: boolean;
  canRecover: boolean;
  canExport: boolean;
  now: number;
  busyAction?: string | null;
  onReconcile?: (deliveryId: string) => void;
  onRetry?: (deliveryId: string) => void;
  onCancel?: (deliveryId: string) => void;
  onExport?: () => void;
}) {
  const { t } = useTranslation('mail');
  const translatedLabel = (
    group: 'stages' | 'sources' | 'commands',
    definitions: Readonly<Record<string, readonly [string, string]>>,
    value: string,
    fallback: string
  ) => {
    const definition = definitions[value];
    return definition
      ? t(`admin.operationsWorkspace.a06.${group}.${definition[0]}`, {
          defaultValue: definition[1],
        })
      : t(`admin.operationsWorkspace.a06.${group}.other`, { defaultValue: fallback });
  };
  const stageLabel = (value: string) =>
    translatedLabel('stages', DELIVERY_STAGE_LABELS, value, 'Delivery event');
  const sourceLabel = (value: string) =>
    translatedLabel('sources', DELIVERY_SOURCE_LABELS, value, 'System evidence');
  const commandLabel = (value: string) =>
    translatedLabel('commands', DELIVERY_COMMAND_LABELS, value, 'Mail command');
  const providerLabel = (value: string) =>
    translatedLabel('sources', DELIVERY_SOURCE_LABELS, value, 'Connected mail provider');
  const blockerLabel = (value: string | null) =>
    value
      ? t(`admin.operationsWorkspace.a06.blockers.${value}`, {
          defaultValue:
            DELIVERY_BLOCKER_LABELS[value] ??
            t('admin.operationsWorkspace.a06.recoveryUnavailable', {
              defaultValue: 'Recovery is unavailable until current evidence is confirmed.',
            }),
        })
      : t('admin.operationsWorkspace.a06.retryEvidenceReady', {
          defaultValue: 'Retry safety evidence is current.',
        });
  const [filter, setFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const authorizedPage = canReadAudit ? page : undefined;
  const authorizedEvidence = canReadAudit ? evidence : undefined;
  const items = authorizedPage?.items ?? [];
  const visible = items.filter(
    (item) =>
      !filter ||
      `${item.safeResourceRef} ${item.correlationId} ${item.state}`
        .toLowerCase()
        .includes(filter.toLowerCase())
  );
  const selected = items.find((item) => item.deliveryId === selectedId);
  return (
    <Stack spacing={2.5}>
      {!authorizedPage ? (
        <InlineFeedback severity="warning">
          {canReadAudit
            ? t('admin.operationsWorkspace.a06.aggregateOnly', {
                defaultValue:
                  'Message-level command, provider, and audit evidence could not be loaded. Recovery actions remain evidence-gated.',
              })
            : t('admin.operationsWorkspace.a06.auditReadRequired', {
                defaultValue:
                  'Delivery audit permission is required to view message-level evidence.',
              })}
        </InlineFeedback>
      ) : null}
      <Section
        title={t('admin.operationsWorkspace.a06.title', {
          defaultValue: 'Delivery audit and recovery',
        })}
        action={
          <ActionButton
            intent="secondary"
            disabled={!canExport || !authorizedPage || !onExport}
            loading={busyAction === 'export-audit'}
            startIcon={<Download size={16} />}
            onClick={onExport}
          >
            {t('admin.operationsWorkspace.a06.export', { defaultValue: 'Export evidence' })}
          </ActionButton>
        }
      >
        {canExport && auditExport ? (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.25}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            sx={{ p: 2 }}
          >
            <Download size={17} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" fontWeight="fontWeightBold">
                {t('admin.operationsWorkspace.a06.exportReady', {
                  defaultValue: 'Delivery evidence export',
                })}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('admin.operationsWorkspace.a06.exportExpiry', {
                  defaultValue: 'Available until {{time}}',
                  time: auditExport.expiresAt ?? '',
                })}
              </Typography>
            </Box>
            <StateChip label={auditExport.state} />
            {auditExport.state === 'READY' && auditExport.downloadUrl ? (
              <ActionButton
                component="a"
                href={auditExport.downloadUrl}
                intent="primary"
                size="small"
              >
                {t('admin.operationsWorkspace.a06.download', { defaultValue: 'Download' })}
              </ActionButton>
            ) : null}
          </Stack>
        ) : null}
        {canExport && auditExport ? <Divider /> : null}
        <Box sx={{ p: 2 }}>
          <TextField
            fullWidth
            size="small"
            label={t('admin.operationsWorkspace.a06.filter', {
              defaultValue: 'Filter safe reference, correlation ID, or state',
            })}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
        </Box>
        <Divider />
        {authorizedPage ? (
          <>
            {visible.length ? (
              visible.map((item, index) => {
                const availability = getMailDeliveryRecoveryAvailability(item, now);
                const cancelEnabled = canCancelMailDelivery(item);
                return (
                  <Box key={item.deliveryId}>
                    {index > 0 ? <Divider /> : null}
                    <Stack spacing={1.1} sx={{ p: 2 }}>
                      <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={1.25}
                        alignItems={{ xs: 'stretch', md: 'center' }}
                      >
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight="fontWeightBold">
                            {item.safeResourceRef}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {commandLabel(item.commandType)} · {item.accountName} ·{' '}
                            {providerLabel(item.providerType)}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: 'block', overflowWrap: 'anywhere' }}
                          >
                            {item.correlationId}
                          </Typography>
                        </Box>
                        <StateChip label={item.stage} displayLabel={stageLabel(item.stage)} />
                        <Typography variant="caption">
                          <FormattedTime value={item.lastEvidenceAt} />
                        </Typography>
                      </Stack>
                      <Typography
                        variant="caption"
                        color={availability.blockedReason ? 'warning.main' : 'success.main'}
                      >
                        {blockerLabel(availability.blockedReason)}
                      </Typography>
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1}
                        justifyContent="flex-end"
                      >
                        <ActionButton
                          intent="quiet"
                          size="small"
                          onClick={() => setSelectedId(item.deliveryId)}
                          startIcon={<Eye size={15} />}
                        >
                          {t('admin.operationsWorkspace.a06.timeline', {
                            defaultValue: 'Timeline',
                          })}
                        </ActionButton>
                        <ActionButton
                          intent="secondary"
                          size="small"
                          loading={busyAction === `reconcile:${item.deliveryId}`}
                          disabled={!canRecover || !availability.reconcileEnabled || !onReconcile}
                          startIcon={<RefreshCw size={15} />}
                          onClick={() => onReconcile?.(item.deliveryId)}
                        >
                          {t('admin.operationsWorkspace.a06.reconcile', {
                            defaultValue: 'Reconcile',
                          })}
                        </ActionButton>
                        <ActionButton
                          intent="primary"
                          size="small"
                          loading={busyAction === `retry:${item.deliveryId}`}
                          disabled={!canRecover || !availability.retryEnabled || !onRetry}
                          startIcon={<RotateCcw size={15} />}
                          onClick={() => onRetry?.(item.deliveryId)}
                        >
                          {t('delivery.retry')}
                        </ActionButton>
                        <ActionButton
                          intent="danger"
                          size="small"
                          loading={busyAction === `cancel:${item.deliveryId}`}
                          disabled={!canRecover || !cancelEnabled || !onCancel}
                          onClick={() => onCancel?.(item.deliveryId)}
                        >
                          {t('actions.cancel')}
                        </ActionButton>
                      </Stack>
                    </Stack>
                  </Box>
                );
              })
            ) : (
              <Box sx={{ p: 2 }}>
                <Typography variant="body2">
                  {t('admin.operationsWorkspace.a06.noMatches', {
                    defaultValue: 'No delivery evidence matches the current filter.',
                  })}
                </Typography>
              </Box>
            )}
          </>
        ) : authorizedEvidence?.length ? (
          authorizedEvidence.map((item, index) => {
            const availability = getMailDeliveryRecoveryAvailability(item, now);
            return (
              <Box key={item.deliveryId}>
                {index > 0 ? <Divider /> : null}
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1.25}
                  alignItems={{ xs: 'stretch', md: 'center' }}
                  sx={{ p: 2 }}
                >
                  <Typography variant="body2" fontWeight="fontWeightBold" sx={{ flex: 1 }}>
                    {t('admin.operationsWorkspace.a06.deliveryRecord', {
                      defaultValue: 'Delivery record',
                    })}{' '}
                    · {stageLabel(item.state)}
                  </Typography>
                  <Typography variant="caption">
                    {blockerLabel(availability.blockedReason)}
                  </Typography>
                  <ActionButton
                    intent="secondary"
                    disabled={!canRecover || !availability.reconcileEnabled || !onReconcile}
                    onClick={() => onReconcile?.(item.deliveryId)}
                  >
                    {t('admin.operationsWorkspace.a06.reconcile', {
                      defaultValue: 'Reconcile outcome',
                    })}
                  </ActionButton>
                  <ActionButton
                    intent="primary"
                    disabled={!canRecover || !availability.retryEnabled || !onRetry}
                    onClick={() => onRetry?.(item.deliveryId)}
                  >
                    {t('delivery.retry')}
                  </ActionButton>
                </Stack>
              </Box>
            );
          })
        ) : (
          <>
            <Facts
              items={[
                { label: t('admin.metrics.delivery'), value: overview.queuedDeliveries },
                { label: t('admin.metrics.failedDelivery'), value: overview.failedDeliveries },
                { label: 'Message-level evidence', value: 'Unavailable' },
              ]}
            />
            <Divider />
            <Stack direction="row" spacing={1.25} sx={{ p: 2 }} alignItems="center">
              <LockKeyhole size={18} />
              <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                {t('admin.operationsWorkspace.a06.noEvidence', {
                  defaultValue: 'No delivery-level recovery evidence is available.',
                })}
              </Typography>
              <ActionButton intent="secondary" disabled>
                {t('admin.operationsWorkspace.a06.reconcile', {
                  defaultValue: 'Reconcile outcome',
                })}
              </ActionButton>
              <ActionButton intent="primary" disabled>
                {t('delivery.retry')}
              </ActionButton>
            </Stack>
          </>
        )}
      </Section>
      <Dialog open={Boolean(selected)} onClose={() => setSelectedId(null)} fullWidth maxWidth="md">
        <DialogTitle>
          {t('admin.operationsWorkspace.a06.timeline', {
            defaultValue: 'Delivery evidence timeline',
          })}
        </DialogTitle>
        <DialogContent>
          {selected ? (
            <Stack sx={{ mt: 1 }}>
              {selected.timeline.map((event, index) => (
                <Stack
                  key={`${event.stage}:${index}`}
                  direction="row"
                  spacing={1.25}
                  sx={{ py: 1.3, borderBottom: 1, borderColor: 'divider' }}
                >
                  <Clock3 size={17} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight="fontWeightBold">
                      {stageLabel(event.stage)} · {sourceLabel(event.source)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      <FormattedTime value={event.at} />
                      {event.code
                        ? ` · ${t('admin.operationsWorkspace.a06.providerDetail', {
                            defaultValue:
                              'Additional provider detail is available in the evidence export.',
                          })}`
                        : ''}
                    </Typography>
                  </Box>
                  <StateChip label={event.state} />
                  <EvidenceChip state={event.evidenceState} />
                </Stack>
              ))}
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <ActionButton intent="primary" onClick={() => setSelectedId(null)}>
            {t('actions.close', { defaultValue: 'Close' })}
          </ActionButton>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
