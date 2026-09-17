import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Clock3,
  Download,
  Eye,
  LockKeyhole,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { ActionButton, InlineFeedback, SelectField } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
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
import type { MailDeliveryAuditFilters } from './mail-delivery-audit-filters';

type RecoveryReviewItem = MailDeliveryRecoveryEvidence &
  Partial<
    Pick<
      MailDeliveryAuditPage['items'][number],
      'safeResourceRef' | 'stage' | 'accountName' | 'providerType' | 'cancelCapability'
    >
  >;

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
  filters,
  canReadAudit,
  canRevealAudit,
  canReconcile,
  canRetry,
  canCancel,
  canExport,
  now,
  busyAction,
  onReconcile,
  onRetry,
  onCancel,
  onFiltersChange,
  onExport,
  onApproveExport,
  onRefreshExport,
  onDownloadExport,
}: {
  overview: MailAdminOverview;
  page?: MailDeliveryAuditPage;
  auditExport?: MailAuditExport;
  evidence?: readonly MailDeliveryRecoveryEvidence[];
  filters?: MailDeliveryAuditFilters;
  canReadAudit: boolean;
  canRevealAudit: boolean;
  canReconcile: boolean;
  canRetry: boolean;
  canCancel: boolean;
  canExport: boolean;
  now: number;
  busyAction?: string | null;
  onReconcile?: (deliveryId: string) => void;
  onRetry?: (deliveryId: string) => void;
  onCancel?: (deliveryId: string) => void;
  onFiltersChange?: (filters: MailDeliveryAuditFilters) => void;
  onExport?: () => void;
  onApproveExport?: (exportId: string) => void;
  onRefreshExport?: (exportId: string) => void;
  onDownloadExport?: (exportId: string) => void;
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingRecovery, setPendingRecovery] = useState<{
    action: 'retry' | 'cancel';
    item: RecoveryReviewItem;
  } | null>(null);
  const canViewRecoveryQueue = canReadAudit || canReconcile || canRetry || canCancel;
  const authorizedPage = canViewRecoveryQueue ? page : undefined;
  const authorizedEvidence = canViewRecoveryQueue ? evidence : undefined;
  const items = authorizedPage?.items ?? [];
  const pendingRecoveryCurrentItem: RecoveryReviewItem | null = pendingRecovery
    ? authorizedPage
      ? (authorizedPage.items.find((item) => item.deliveryId === pendingRecovery.item.deliveryId) ??
        null)
      : (authorizedEvidence?.find((item) => item.deliveryId === pendingRecovery.item.deliveryId) ??
        null)
    : null;
  const pendingRecoveryItem = pendingRecoveryCurrentItem ?? pendingRecovery?.item ?? null;
  const pendingRecoveryEnabled = Boolean(
    pendingRecovery &&
    pendingRecoveryCurrentItem &&
    (pendingRecovery.action === 'retry'
      ? canRetry &&
        getMailDeliveryRecoveryAvailability(pendingRecoveryCurrentItem, now).retryEnabled &&
        onRetry
      : canCancel && canCancelMailDelivery(pendingRecoveryCurrentItem) && onCancel)
  );
  const activeFilters: MailDeliveryAuditFilters = filters ?? {
    page: authorizedPage?.page ?? 0,
    pageSize: authorizedPage?.pageSize ?? 50,
  };
  const setFilter = (updates: Partial<MailDeliveryAuditFilters>, resetPage = true) =>
    onFiltersChange?.({
      ...activeFilters,
      ...updates,
      page: resetPage ? 0 : (updates.page ?? activeFilters.page),
    });
  const filterChips = [
    canRevealAudit && activeFilters.query ? ['query', activeFilters.query] : null,
    canRevealAudit && activeFilters.accountId ? ['accountId', activeFilters.accountId] : null,
    canRevealAudit && activeFilters.provider
      ? ['provider', providerLabel(activeFilters.provider)]
      : null,
    activeFilters.command ? ['command', commandLabel(activeFilters.command)] : null,
    activeFilters.state ? ['state', stageLabel(activeFilters.state)] : null,
    activeFilters.dateFrom ? ['dateFrom', activeFilters.dateFrom] : null,
    activeFilters.dateTo ? ['dateTo', activeFilters.dateTo] : null,
  ].filter((item): item is [string, string] => Boolean(item));
  const selected = items.find((item) => item.deliveryId === selectedId);
  const auditExportExpiresAt = auditExport ? Date.parse(auditExport.expiresAt) : Number.NaN;
  const auditExportExpired = Boolean(
    auditExport && (!Number.isFinite(auditExportExpiresAt) || auditExportExpiresAt <= now)
  );
  const pendingRecoveryIsCancel = pendingRecovery?.action === 'cancel';
  return (
    <Stack spacing={2.5}>
      {!authorizedPage ? (
        <InlineFeedback severity="warning">
          {canViewRecoveryQueue
            ? t('admin.operationsWorkspace.a06.aggregateOnly', {
                defaultValue:
                  'The redacted recovery queue could not be loaded. Recovery actions remain evidence-gated.',
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
          <Stack spacing={1.25} sx={{ p: 2 }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.25}
              alignItems={{ xs: 'stretch', sm: 'center' }}
            >
              <ShieldCheck size={17} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight="fontWeightBold">
                  {t('admin.operationsWorkspace.a06.exportReady', {
                    defaultValue: 'Delivery evidence export',
                  })}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {auditExport.exportId} · {auditExport.distinctApproverCount}/
                  {auditExport.requiredApprovals}{' '}
                  {t('admin.operationsWorkspace.a06.approvals', { defaultValue: 'approvals' })}
                </Typography>
              </Box>
              <StateChip label={auditExport.approvalState} />
              <StateChip label={auditExport.state} />
            </Stack>
            {canRevealAudit ? (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ overflowWrap: 'anywhere' }}
              >
                {t('admin.operationsWorkspace.a06.exportSnapshot', {
                  defaultValue: 'Filter snapshot: {{filters}}',
                  filters: JSON.stringify(auditExport.filters),
                })}
              </Typography>
            ) : (
              <Typography variant="caption" color="text.secondary">
                {t('admin.operationsWorkspace.a06.sensitiveMetadataRestricted', {
                  defaultValue: 'Sensitive audit metadata requires reveal permission.',
                })}
              </Typography>
            )}
            {canRevealAudit ? (
              <>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ overflowWrap: 'anywhere' }}
                >
                  {t('admin.operationsWorkspace.a06.exportWatermarkExpiry', {
                    defaultValue: 'Watermark {{watermark}} · expires {{time}}',
                    watermark: auditExport.watermark,
                    time: auditExport.expiresAt,
                  })}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ overflowWrap: 'anywhere' }}
                >
                  {t('admin.operationsWorkspace.a06.exportPayloadEvidence', {
                    defaultValue:
                      '{{count}} items{{truncated}} · snapshot {{cutoff}} · payload {{hash}}',
                    count: auditExport.itemCount,
                    truncated: auditExport.truncated ? ' (truncated)' : '',
                    cutoff: auditExport.snapshotCutoff,
                    hash: auditExport.payloadSha256,
                  })}
                </Typography>
              </>
            ) : null}
            {auditExportExpired ? (
              <InlineFeedback severity="warning">
                {t('admin.operationsWorkspace.a06.exportExpired', {
                  defaultValue:
                    'This export expired. Refresh or create a new evidence export before downloading.',
                })}
              </InlineFeedback>
            ) : null}
            {auditExport.approvals.map((approval) => (
              <Typography key={approval.approvalId} variant="caption" color="text.secondary">
                {t('admin.operationsWorkspace.a06.exportApprovalEvidence', {
                  defaultValue: 'Approved by user {{userId}} at {{time}}',
                  userId: approval.approverUserId,
                  time: approval.decidedAt,
                })}
              </Typography>
            ))}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end">
              <ActionButton
                intent="quiet"
                size="small"
                startIcon={<RefreshCw size={15} />}
                disabled={!onRefreshExport}
                onClick={() => onRefreshExport?.(auditExport.exportId)}
              >
                {t('actions.refresh')}
              </ActionButton>
              <ActionButton
                intent="secondary"
                size="small"
                loading={busyAction === 'approve-audit-export'}
                disabled={!onApproveExport || auditExport.approvalState === 'APPROVED'}
                onClick={() => onApproveExport?.(auditExport.exportId)}
              >
                {t('admin.operationsWorkspace.a06.approveExport', {
                  defaultValue: 'Approve export',
                })}
              </ActionButton>
              {auditExport.approvalState === 'APPROVED' &&
              auditExport.state === 'READY' &&
              auditExport.downloadUrl ? (
                <ActionButton
                  intent="primary"
                  size="small"
                  startIcon={<Download size={15} />}
                  loading={busyAction === 'download-audit-export'}
                  disabled={!onDownloadExport || auditExportExpired}
                  onClick={() => onDownloadExport?.(auditExport.exportId)}
                >
                  {t('admin.operationsWorkspace.a06.download', { defaultValue: 'Download' })}
                </ActionButton>
              ) : null}
            </Stack>
          </Stack>
        ) : null}
        {canExport && auditExport ? <Divider /> : null}
        <Stack spacing={1.25} sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
            {canRevealAudit ? (
              <>
                <TextField
                  fullWidth
                  size="small"
                  label={t('admin.operationsWorkspace.a06.filter', {
                    defaultValue: 'Safe reference or correlation ID',
                  })}
                  value={activeFilters.query ?? ''}
                  onChange={(event) => setFilter({ query: event.target.value || undefined })}
                />
                <TextField
                  fullWidth
                  size="small"
                  label={t('admin.operationsWorkspace.a06.account', {
                    defaultValue: 'Account ID',
                  })}
                  value={activeFilters.accountId ?? ''}
                  onChange={(event) => setFilter({ accountId: event.target.value || undefined })}
                />
                <SelectField<string>
                  size="small"
                  label={t('admin.operationsWorkspace.a06.provider', { defaultValue: 'Provider' })}
                  value={activeFilters.provider ?? ''}
                  options={[
                    {
                      value: '',
                      label: t('admin.operationsWorkspace.a06.allProviders', {
                        defaultValue: 'All providers',
                      }),
                    },
                    ...overview.providerCatalog.map((provider) => ({
                      value: provider.providerType,
                      label: provider.name,
                    })),
                  ]}
                  onValueChange={(provider) => setFilter({ provider: provider || undefined })}
                />
              </>
            ) : null}
            <SelectField<string>
              size="small"
              label={t('admin.operationsWorkspace.a06.stateFilter', { defaultValue: 'State' })}
              value={activeFilters.state ?? ''}
              options={[
                {
                  value: '',
                  label: t('admin.operationsWorkspace.a06.allStates', {
                    defaultValue: 'All states',
                  }),
                },
                ...[
                  'QUEUED',
                  'ACCEPTED_BY_PROVIDER',
                  'DELIVERED_CONFIRMED',
                  'BOUNCED',
                  'FAILED',
                  'UNKNOWN',
                ].map((state) => ({
                  value: state,
                  label: stageLabel(state),
                })),
              ]}
              onValueChange={(state) => setFilter({ state: state || undefined })}
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <SelectField<string>
              size="small"
              label={t('admin.operationsWorkspace.a06.command', { defaultValue: 'Command' })}
              value={activeFilters.command ?? ''}
              options={[
                {
                  value: '',
                  label: t('admin.operationsWorkspace.a06.allCommands', {
                    defaultValue: 'All commands',
                  }),
                },
                { value: 'SEND', label: commandLabel('SEND') },
              ]}
              onValueChange={(command) =>
                setFilter({ command: command === 'SEND' ? 'SEND' : undefined })
              }
            />
            <TextField
              size="small"
              type="date"
              label={t('admin.operationsWorkspace.a06.dateFrom', { defaultValue: 'From date' })}
              slotProps={{ inputLabel: { shrink: true } }}
              value={activeFilters.dateFrom ?? ''}
              onChange={(event) => setFilter({ dateFrom: event.target.value || undefined })}
            />
            <TextField
              size="small"
              type="date"
              label={t('admin.operationsWorkspace.a06.dateTo', { defaultValue: 'To date' })}
              slotProps={{ inputLabel: { shrink: true } }}
              value={activeFilters.dateTo ?? ''}
              onChange={(event) => setFilter({ dateTo: event.target.value || undefined })}
            />
          </Stack>
          {filterChips.length ? (
            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
              {filterChips.map(([key, label]) => (
                <Chip key={key} size="small" variant="outlined" label={label} />
              ))}
              <ActionButton
                size="small"
                intent="quiet"
                onClick={() => onFiltersChange?.({ page: 0, pageSize: activeFilters.pageSize })}
              >
                {t('admin.operationsWorkspace.a06.clearFilters', { defaultValue: 'Clear filters' })}
              </ActionButton>
            </Stack>
          ) : null}
        </Stack>
        <Divider />
        {authorizedPage ? (
          <>
            {items.length ? (
              items.map((item, index) => {
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
                            {commandLabel(item.commandType)}
                            {canRevealAudit
                              ? ` · ${item.accountName} · ${providerLabel(item.providerType)}`
                              : ''}
                          </Typography>
                          {canRevealAudit ? (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ display: 'block', overflowWrap: 'anywhere' }}
                            >
                              {item.correlationId}
                            </Typography>
                          ) : null}
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
                          disabled={!canReconcile || !availability.reconcileEnabled || !onReconcile}
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
                          disabled={!canRetry || !availability.retryEnabled || !onRetry}
                          startIcon={<RotateCcw size={15} />}
                          onClick={() => setPendingRecovery({ action: 'retry', item })}
                        >
                          {t('delivery.retry')}
                        </ActionButton>
                        <ActionButton
                          intent="danger"
                          size="small"
                          loading={busyAction === `cancel:${item.deliveryId}`}
                          disabled={!canCancel || !cancelEnabled || !onCancel}
                          onClick={() => setPendingRecovery({ action: 'cancel', item })}
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
            <Divider />
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              alignItems={{ xs: 'stretch', sm: 'center' }}
              justifyContent="space-between"
              sx={{ p: 2 }}
            >
              <Typography variant="caption" color="text.secondary">
                {t('admin.operationsWorkspace.a06.pagination', {
                  defaultValue: '{{from}}–{{to}} of {{total}} records',
                  from:
                    authorizedPage.page * authorizedPage.pageSize + (authorizedPage.total ? 1 : 0),
                  to: Math.min(
                    (authorizedPage.page + 1) * authorizedPage.pageSize,
                    authorizedPage.total
                  ),
                  total: authorizedPage.total,
                })}
              </Typography>
              <Stack direction="row" spacing={1}>
                <ActionButton
                  size="small"
                  intent="secondary"
                  disabled={!onFiltersChange || authorizedPage.page <= 0}
                  onClick={() => setFilter({ page: Math.max(0, authorizedPage.page - 1) }, false)}
                >
                  {t('admin.operationsWorkspace.a06.previous', { defaultValue: 'Previous' })}
                </ActionButton>
                <ActionButton
                  size="small"
                  intent="secondary"
                  disabled={
                    !onFiltersChange ||
                    (authorizedPage.page + 1) * authorizedPage.pageSize >= authorizedPage.total
                  }
                  onClick={() => setFilter({ page: authorizedPage.page + 1 }, false)}
                >
                  {t('admin.operationsWorkspace.a06.next', { defaultValue: 'Next' })}
                </ActionButton>
              </Stack>
            </Stack>
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
                    disabled={!canReconcile || !availability.reconcileEnabled || !onReconcile}
                    onClick={() => onReconcile?.(item.deliveryId)}
                  >
                    {t('admin.operationsWorkspace.a06.reconcile', {
                      defaultValue: 'Reconcile outcome',
                    })}
                  </ActionButton>
                  <ActionButton
                    intent="primary"
                    disabled={!canRetry || !availability.retryEnabled || !onRetry}
                    onClick={() => setPendingRecovery({ action: 'retry', item })}
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
                      {stageLabel(event.stage)}
                      {canRevealAudit ? ` · ${sourceLabel(event.source)}` : ''}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      <FormattedTime value={event.at} />
                      {canRevealAudit && event.code
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
      <Dialog
        open={Boolean(pendingRecovery)}
        onClose={() => setPendingRecovery(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {t(
            pendingRecoveryIsCancel
              ? 'admin.operationsWorkspace.a06.cancelReviewTitle'
              : 'admin.operationsWorkspace.a06.retryReviewTitle',
            {
              defaultValue: pendingRecoveryIsCancel
                ? 'Review delivery cancellation'
                : 'Review delivery retry',
            }
          )}
        </DialogTitle>
        <DialogContent>
          {pendingRecovery && pendingRecoveryItem ? (
            <Stack spacing={1.5} sx={{ pt: 0.5 }}>
              <InlineFeedback severity="warning">
                {t('admin.operationsWorkspace.a06.recoveryReviewWarning', {
                  defaultValue:
                    'This changes the current delivery command. Confirm the scope, current evidence, and duplicate risk before continuing.',
                })}
              </InlineFeedback>
              {!pendingRecoveryCurrentItem ? (
                <InlineFeedback severity="warning">
                  {t('admin.operationsWorkspace.a06.recoveryEvidenceChanged', {
                    defaultValue:
                      'Current recovery evidence is no longer available. Close this review, refresh, and review the action again.',
                  })}
                </InlineFeedback>
              ) : null}
              <Facts
                items={[
                  {
                    label: t('admin.operationsWorkspace.a06.reviewScope', {
                      defaultValue: 'Delivery scope',
                    }),
                    value:
                      pendingRecoveryItem.safeResourceRef ??
                      t('admin.operationsWorkspace.a06.deliveryRecord', {
                        defaultValue: 'Delivery record',
                      }),
                  },
                  {
                    label: t('admin.operationsWorkspace.a06.reviewState', {
                      defaultValue: 'Current state',
                    }),
                    value: stageLabel(pendingRecoveryItem.stage ?? pendingRecoveryItem.state),
                  },
                  {
                    label: t('admin.operationsWorkspace.a06.reviewEligibility', {
                      defaultValue: 'Retry eligibility',
                    }),
                    value: pendingRecoveryItem.retryEligibility,
                  },
                  {
                    label: t('admin.operationsWorkspace.a06.reviewDuplicateRisk', {
                      defaultValue: 'Duplicate risk evidence',
                    }),
                    value: `${pendingRecoveryItem.providerDisposition} · ${pendingRecoveryItem.idempotencyState}`,
                  },
                  {
                    label: t('admin.operationsWorkspace.a06.reviewAccess', {
                      defaultValue: 'Current action access',
                    }),
                    value:
                      pendingRecovery.action === 'retry'
                        ? canRetry
                          ? 'RETRY_GRANTED'
                          : 'UNAVAILABLE'
                        : canCancel
                          ? 'CANCEL_GRANTED'
                          : 'UNAVAILABLE',
                  },
                  {
                    label: t('admin.operationsWorkspace.a06.reviewEvidence', {
                      defaultValue: 'Current recovery evidence',
                    }),
                    value: blockerLabel(
                      getMailDeliveryRecoveryAvailability(pendingRecoveryItem, now).blockedReason
                    ),
                  },
                ]}
              />
              {canRevealAudit &&
              pendingRecoveryItem.accountName &&
              pendingRecoveryItem.providerType ? (
                <Typography variant="caption" color="text.secondary">
                  {pendingRecoveryItem.accountName} ·{' '}
                  {providerLabel(pendingRecoveryItem.providerType)}
                </Typography>
              ) : null}
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ flexDirection: { xs: 'column-reverse', sm: 'row' }, gap: 1 }}>
          <ActionButton intent="quiet" onClick={() => setPendingRecovery(null)}>
            {t('actions.cancel')}
          </ActionButton>
          <ActionButton
            intent={pendingRecoveryIsCancel ? 'danger' : 'primary'}
            loading={Boolean(
              pendingRecovery &&
              busyAction === `${pendingRecovery.action}:${pendingRecoveryItem?.deliveryId}`
            )}
            disabled={!pendingRecoveryEnabled}
            onClick={() => {
              if (!pendingRecovery || !pendingRecoveryCurrentItem || !pendingRecoveryEnabled)
                return;
              if (pendingRecovery.action === 'retry')
                onRetry?.(pendingRecoveryCurrentItem.deliveryId);
              else onCancel?.(pendingRecoveryCurrentItem.deliveryId);
              setPendingRecovery(null);
            }}
          >
            {pendingRecoveryIsCancel
              ? t('admin.operationsWorkspace.a06.confirmCancel', {
                  defaultValue: 'Confirm cancellation',
                })
              : t('admin.operationsWorkspace.a06.confirmRetry', {
                  defaultValue: 'Confirm retry',
                })}
          </ActionButton>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
