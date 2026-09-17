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

export function DeliveryAuditSurface({
  overview,
  page,
  auditExport,
  evidence,
  canManage,
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
  canManage: boolean;
  now: number;
  busyAction?: string | null;
  onReconcile?: (deliveryId: string) => void;
  onRetry?: (deliveryId: string) => void;
  onCancel?: (deliveryId: string) => void;
  onExport?: () => void;
}) {
  const { t } = useTranslation('mail');
  const [filter, setFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const items = page?.items ?? [];
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
      {!page ? (
        <InlineFeedback severity="warning">
          {t('admin.operationsWorkspace.a06.aggregateOnly', {
            defaultValue:
              'Message-level command, provider, and audit evidence could not be loaded. Recovery actions remain evidence-gated.',
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
            disabled={!page || !onExport}
            loading={busyAction === 'export-audit'}
            startIcon={<Download size={16} />}
            onClick={onExport}
          >
            {t('admin.operationsWorkspace.a06.export', { defaultValue: 'Export evidence' })}
          </ActionButton>
        }
      >
        {auditExport ? (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.25}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            sx={{ p: 2 }}
          >
            <Download size={17} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" fontWeight="fontWeightBold">
                {auditExport.exportId}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {auditExport.watermark ?? 'Evidence export'}
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
        {auditExport ? <Divider /> : null}
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
        {page ? (
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
                            {item.commandType} · {item.accountName} · {item.providerType}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: 'block', overflowWrap: 'anywhere' }}
                          >
                            {item.correlationId}
                          </Typography>
                        </Box>
                        <StateChip label={item.stage} />
                        <Typography variant="caption">
                          <FormattedTime value={item.lastEvidenceAt} />
                        </Typography>
                      </Stack>
                      <Typography
                        variant="caption"
                        color={availability.blockedReason ? 'warning.main' : 'success.main'}
                      >
                        {availability.blockedReason ?? 'Retry safety evidence is current.'}
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
                          disabled={!canManage || !availability.reconcileEnabled || !onReconcile}
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
                          disabled={!canManage || !availability.retryEnabled || !onRetry}
                          startIcon={<RotateCcw size={15} />}
                          onClick={() => onRetry?.(item.deliveryId)}
                        >
                          {t('delivery.retry')}
                        </ActionButton>
                        <ActionButton
                          intent="danger"
                          size="small"
                          loading={busyAction === `cancel:${item.deliveryId}`}
                          disabled={!canManage || !cancelEnabled || !onCancel}
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
        ) : evidence?.length ? (
          evidence.map((item, index) => {
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
                    {item.deliveryId} · {item.state}
                  </Typography>
                  <Typography variant="caption">{availability.blockedReason}</Typography>
                  <ActionButton
                    intent="secondary"
                    disabled={!canManage || !availability.reconcileEnabled || !onReconcile}
                    onClick={() => onReconcile?.(item.deliveryId)}
                  >
                    Reconcile
                  </ActionButton>
                  <ActionButton
                    intent="primary"
                    disabled={!canManage || !availability.retryEnabled || !onRetry}
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
                Reconcile
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
                      {event.stage} · {event.source}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      <FormattedTime value={event.at} />
                      {event.code ? ` · ${event.code}` : ''}
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
