import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CalendarClock, RefreshCw, SearchCheck, XCircle } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  formatDate as formatLocalizedDate,
  resolveSupportedLocale,
  resolveSystemTimeZone,
} from '@dwp-frontend/shared-i18n';
import {
  cancelMailDelivery,
  getMailDeliveries,
  getMailDeliveryReceipt,
  reconcileMailDelivery,
  rescheduleMailDelivery,
  retryMailDeliveryReceipt,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ActionIconButton,
  ConfirmDialog,
  FormDialog,
  FormField,
  GuidedEmptyState,
  LoadingState,
  PageCanvas,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';

import { MailPageHeading, mailRelativeTime } from './mail-components';
import { useMailUserPermissions } from './use-mail-user-permissions';

import type {
  MailDeliveryBucket,
  MailDeliveryReceipt,
  MailDeliverySummary,
} from '@dwp-frontend/shared-utils';

const DELIVERY_BUCKETS: MailDeliveryBucket[] = [
  'SCHEDULED',
  'PROCESSING',
  'COMPLETED',
  'ATTENTION',
];
const DELIVERY_PAGE_SIZE = 30;

function requestedPage(value: string | null) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

export function MailDeliveryOperationsWorkspace() {
  const { t } = useTranslation('mail');
  const [params, setParams] = useSearchParams();
  const requestedBucket = params.get('bucket')?.toUpperCase();
  const bucket = DELIVERY_BUCKETS.includes(requestedBucket as MailDeliveryBucket)
    ? (requestedBucket as MailDeliveryBucket)
    : 'SCHEDULED';
  const selectedId = params.get('deliveryId');
  const page = requestedPage(params.get('page'));
  const query = useQuery({
    queryKey: ['mail', 'deliveries', bucket, page],
    queryFn: () => getMailDeliveries({ bucket, page, pageSize: DELIVERY_PAGE_SIZE }),
    placeholderData: (previous) => previous,
    staleTime: 10_000,
    retry: 1,
  });
  const detail = useQuery({
    queryKey: ['mail', 'delivery', selectedId],
    queryFn: () => getMailDeliveryReceipt(selectedId!),
    enabled: Boolean(selectedId),
    staleTime: 10_000,
    retry: 1,
  });
  const setLocation = (
    nextBucket: MailDeliveryBucket,
    deliveryId?: string | null,
    nextPage = 0
  ) => {
    const next = new URLSearchParams();
    next.set('bucket', nextBucket.toLowerCase());
    if (deliveryId) next.set('deliveryId', deliveryId);
    if (nextPage > 0) next.set('page', String(nextPage));
    setParams(next);
  };

  return (
    <PageCanvas topInset="compact">
      <MailPageHeading
        eyebrow={t('secondary.delivery.eyebrow')}
        title={t('secondary.delivery.title')}
        description={t('secondary.delivery.description')}
        actions={
          <ActionIconButton
            label={t('actions.refresh')}
            onClick={() => void Promise.all([query.refetch(), detail.refetch()])}
          >
            <RefreshCw size={17} />
          </ActionIconButton>
        }
      />
      <Tabs
        value={bucket}
        onChange={(_event, value: MailDeliveryBucket) => setLocation(value)}
        variant="scrollable"
        scrollButtons="auto"
        aria-label={t('secondary.delivery.tabsLabel')}
        sx={{ mt: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        {DELIVERY_BUCKETS.map((value) => (
          <Tab key={value} value={value} label={t(`secondary.delivery.bucket.${value}`)} />
        ))}
      </Tabs>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(280px, .82fr) minmax(0, 1.35fr)' },
          minHeight: 500,
          borderBlock: 1,
          borderColor: 'divider',
        }}
      >
        <DeliveryList
          items={query.data?.items ?? []}
          loading={query.isLoading}
          error={query.isError}
          selectedId={selectedId}
          hiddenOnMobile={Boolean(selectedId)}
          onRetry={() => void query.refetch()}
          page={query.data?.page ?? page}
          pageSize={query.data?.pageSize ?? DELIVERY_PAGE_SIZE}
          total={query.data?.total ?? 0}
          fetching={query.isFetching}
          onPageChange={(nextPage) => setLocation(bucket, null, nextPage)}
          onSelect={(deliveryId) => setLocation(bucket, deliveryId, page)}
        />
        <Box
          sx={{
            minWidth: 0,
            borderLeft: { md: 1 },
            borderColor: 'divider',
            display: { xs: selectedId ? 'block' : 'none', md: 'block' },
          }}
        >
          <DeliveryReceiptInspector
            receipt={detail.data}
            loading={detail.isLoading}
            error={detail.isError}
            onBack={() => setLocation(bucket, null, page)}
            onRetryLoad={() => void detail.refetch()}
          />
        </Box>
      </Box>
    </PageCanvas>
  );
}

function DeliveryList({
  items,
  loading,
  error,
  selectedId,
  hiddenOnMobile,
  page,
  pageSize,
  total,
  fetching,
  onRetry,
  onPageChange,
  onSelect,
}: {
  items: MailDeliverySummary[];
  loading: boolean;
  error: boolean;
  selectedId: string | null;
  hiddenOnMobile: boolean;
  page: number;
  pageSize: number;
  total: number;
  fetching: boolean;
  onRetry: () => void;
  onPageChange: (page: number) => void;
  onSelect: (deliveryId: string) => void;
}) {
  const { t, i18n } = useTranslation('mail');
  if (loading)
    return (
      <Stack spacing={1} sx={{ p: 2 }}>
        <Skeleton variant="rounded" height={96} />
        <Skeleton variant="rounded" height={96} />
      </Stack>
    );
  if (error)
    return (
      <Box sx={{ p: 2 }}>
        <Alert
          severity="error"
          action={
            <ActionButton intent="quiet" size="small" onClick={onRetry}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('secondary.delivery.loadError')}
        </Alert>
      </Box>
    );
  if (!items.length)
    return (
      <Box sx={{ display: { xs: hiddenOnMobile ? 'none' : 'block', md: 'block' } }}>
        <GuidedEmptyState
          kind="empty"
          title={t('secondary.delivery.emptyTitle')}
          description={t('secondary.delivery.emptyDescription')}
        />
      </Box>
    );
  return (
    <Box
      component="section"
      aria-label={t('secondary.delivery.listLabel')}
      sx={{ display: { xs: hiddenOnMobile ? 'none' : 'block', md: 'block' }, minWidth: 0 }}
    >
      {items.map((item, index) => (
        <Box key={item.deliveryId}>
          {index > 0 && <Divider />}
          <Box
            component="button"
            type="button"
            onClick={() => onSelect(item.deliveryId)}
            aria-current={selectedId === item.deliveryId ? 'true' : undefined}
            sx={{
              width: 1,
              minHeight: 96,
              p: 1.75,
              border: 0,
              bgcolor: selectedId === item.deliveryId ? 'action.selected' : 'transparent',
              color: 'inherit',
              textAlign: 'left',
              cursor: 'pointer',
              '&:hover': { bgcolor: 'action.hover' },
              '&:focus-visible': {
                outline: '2px solid',
                outlineColor: 'primary.main',
                outlineOffset: -2,
              },
            }}
          >
            <Stack
              direction="row"
              spacing={1}
              alignItems="flex-start"
              justifyContent="space-between"
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography fontWeight={800} noWrap>
                  {item.subject}
                </Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {item.recipientSummary}
                </Typography>
              </Box>
              <Chip
                size="small"
                color={deliveryColor(item.state)}
                variant="outlined"
                label={t(`secondary.delivery.state.${item.state}`)}
              />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {item.accountName} ·{' '}
              {item.scheduledAt
                ? formatDate(item.scheduledAt, i18n.language)
                : mailRelativeTime(item.requestedAt, i18n.language)}
            </Typography>
          </Box>
        </Box>
      ))}
      <Divider />
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        sx={{ p: 1.5 }}
      >
        <Typography variant="caption" color="text.secondary">
          {t('secondary.delivery.pagination', {
            defaultValue: '{{from}}–{{to}} of {{total}} deliveries',
            from: total ? page * pageSize + 1 : 0,
            to: Math.min((page + 1) * pageSize, total),
            total,
          })}
        </Typography>
        <Stack direction="row" spacing={1}>
          <ActionButton
            intent="secondary"
            size="small"
            disabled={fetching || page <= 0}
            onClick={() => onPageChange(Math.max(0, page - 1))}
          >
            {t('secondary.delivery.previous', { defaultValue: 'Previous' })}
          </ActionButton>
          <ActionButton
            intent="secondary"
            size="small"
            disabled={fetching || (page + 1) * pageSize >= total}
            onClick={() => onPageChange(page + 1)}
          >
            {t('secondary.delivery.next', { defaultValue: 'Next' })}
          </ActionButton>
        </Stack>
      </Stack>
    </Box>
  );
}

function DeliveryReceiptInspector({
  receipt,
  loading,
  error,
  onBack,
  onRetryLoad,
}: {
  receipt?: MailDeliveryReceipt;
  loading: boolean;
  error: boolean;
  onBack: () => void;
  onRetryLoad: () => void;
}) {
  const { t, i18n } = useTranslation('mail');
  const { isLoaded, canUpdate, canSend } = useMailUserPermissions();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [retryOpen, setRetryOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  useEffect(() => {
    if (rescheduleOpen && receipt?.scheduledAt)
      setScheduledAt(localDateTime(new Date(receipt.scheduledAt)));
  }, [receipt?.scheduledAt, rescheduleOpen]);
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['mail', 'deliveries'] });
    await queryClient.invalidateQueries({ queryKey: ['mail', 'delivery', receipt?.deliveryId] });
  };
  const reschedule = useMutation({
    mutationFn: () => {
      if (!canUpdate) throw new Error('APP.MAIL:UPDATE is required');
      return rescheduleMailDelivery(receipt!.deliveryId, {
        scheduledAt: new Date(scheduledAt).toISOString(),
        timeZone: resolveSystemTimeZone('UTC'),
        version: receipt!.version,
      });
    },
    onSuccess: async () => {
      setRescheduleOpen(false);
      await refresh();
      toast.success(t('secondary.delivery.rescheduled'));
    },
    onError: () => toast.error(t('secondary.delivery.commandError')),
  });
  const cancel = useMutation({
    mutationFn: () => {
      if (!canUpdate) throw new Error('APP.MAIL:UPDATE is required');
      return cancelMailDelivery(receipt!.deliveryId, { version: receipt!.version });
    },
    onSuccess: async () => {
      setCancelOpen(false);
      await refresh();
      toast.success(t('secondary.delivery.cancelled'));
    },
    onError: () => toast.error(t('secondary.delivery.commandError')),
  });
  const reconcile = useMutation({
    mutationFn: () => {
      if (!canUpdate) throw new Error('APP.MAIL:UPDATE is required');
      return reconcileMailDelivery(receipt!.deliveryId, { version: receipt!.version });
    },
    onSuccess: async () => {
      await refresh();
      toast.success(t('secondary.delivery.reconcileStarted'));
    },
    onError: () => toast.error(t('secondary.delivery.commandError')),
  });
  const retry = useMutation({
    mutationFn: () => {
      if (!canSend) throw new Error('APP.MAIL:SEND is required');
      return retryMailDeliveryReceipt(receipt!.deliveryId, { version: receipt!.version });
    },
    onSuccess: async () => {
      setRetryOpen(false);
      await refresh();
      toast.success(t('delivery.retryQueued'));
    },
    onError: () => toast.error(t('delivery.retryError')),
  });
  if (loading)
    return (
      <Box sx={{ p: 2 }}>
        <LoadingState label={t('secondary.delivery.loadingDetail')} />
      </Box>
    );
  if (error)
    return (
      <Box sx={{ p: 2 }}>
        <Alert
          severity="error"
          action={
            <ActionButton intent="quiet" size="small" onClick={onRetryLoad}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('secondary.delivery.detailError')}
        </Alert>
      </Box>
    );
  if (!receipt)
    return (
      <GuidedEmptyState
        kind="empty"
        title={t('secondary.delivery.selectTitle')}
        description={t('secondary.delivery.selectDescription')}
      />
    );
  return (
    <Box sx={{ p: { xs: 1.5, md: 2.5 } }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <ActionIconButton
          label={t('actions.back')}
          onClick={onBack}
          sx={{ display: { md: 'none' } }}
        >
          <ArrowLeft size={18} />
        </ActionIconButton>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography component="h2" variant="h6" fontWeight={800}>
            {receipt.subject}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {receipt.accountName} ·{' '}
            {receipt.kind === 'GROUP'
              ? t('secondary.delivery.group')
              : t('secondary.delivery.personal')}
          </Typography>
        </Box>
        <Chip
          color={deliveryColor(receipt.state)}
          label={t(`secondary.delivery.state.${receipt.state}`)}
        />
      </Stack>
      {receipt.state === 'UNKNOWN' && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          {t('secondary.delivery.unknownGuidance')}
        </Alert>
      )}
      {isLoaded && !canUpdate && !canSend && (
        <Alert severity="info" sx={{ mt: 2 }}>
          {t('permissions.readOnly', {
            defaultValue: 'You have read-only access. Delivery commands are unavailable.',
          })}
        </Alert>
      )}
      <Box component="section" sx={{ mt: 2 }}>
        <Typography component="h3" variant="subtitle2" fontWeight={800}>
          {t('secondary.delivery.recipients')}
        </Typography>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
          {receipt.recipients.map((recipient) => (
            <Chip
              key={`${recipient.type}:${recipient.email}`}
              size="small"
              variant="outlined"
              label={`${recipient.type} · ${recipient.name || recipient.email}`}
            />
          ))}
        </Stack>
      </Box>
      <Box component="section" sx={{ mt: 2.5 }}>
        <Typography component="h3" variant="subtitle2" fontWeight={800}>
          {t('secondary.delivery.timeline')}
        </Typography>
        <Stack sx={{ mt: 1, borderBlock: 1, borderColor: 'divider' }}>
          {receipt.timeline.map((event, index) => (
            <Box key={`${event.state}:${event.occurredAt}`}>
              {index > 0 && <Divider />}
              <Stack direction="row" spacing={1.5} sx={{ py: 1.25 }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    mt: 0.75,
                    borderRadius: '50%',
                    bgcolor: `${deliveryColor(event.state)}.main`,
                    flex: '0 0 auto',
                  }}
                />
                <Box>
                  <Typography variant="body2" fontWeight={750}>
                    {t(`secondary.delivery.state.${event.state}`)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(event.occurredAt, i18n.language)}
                  </Typography>
                  {event.description && (
                    <Typography variant="body2" color="text.secondary">
                      {event.description}
                    </Typography>
                  )}
                </Box>
              </Stack>
            </Box>
          ))}
        </Stack>
      </Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2.5 }}>
        {receipt.canReschedule && (
          <ActionButton
            intent="secondary"
            startIcon={<CalendarClock size={16} />}
            disabled={!canUpdate}
            onClick={() => setRescheduleOpen(true)}
          >
            {t('secondary.delivery.reschedule')}
          </ActionButton>
        )}
        {receipt.canCancel && (
          <ActionButton
            intent="secondary"
            startIcon={<XCircle size={16} />}
            disabled={!canUpdate}
            onClick={() => setCancelOpen(true)}
          >
            {t('secondary.delivery.cancel')}
          </ActionButton>
        )}
        {receipt.canReconcile && (
          <ActionButton
            intent="primary"
            startIcon={<SearchCheck size={16} />}
            loading={reconcile.isPending}
            disabled={!canUpdate}
            onClick={() => reconcile.mutate()}
          >
            {t('secondary.delivery.reconcile')}
          </ActionButton>
        )}
        {receipt.retryEligibility === 'ELIGIBLE' && (
          <ActionButton
            intent="primary"
            startIcon={<RefreshCw size={16} />}
            disabled={!canSend}
            onClick={() => setRetryOpen(true)}
          >
            {t('delivery.retry')}
          </ActionButton>
        )}
      </Stack>
      <FormDialog
        open={rescheduleOpen}
        title={t('secondary.delivery.rescheduleTitle')}
        description={t('secondary.delivery.rescheduleDescription')}
        cancelLabel={t('actions.cancel')}
        submitLabel={t('secondary.delivery.reschedule')}
        submittingLabel={t('actions.saving')}
        busy={reschedule.isPending}
        submitDisabled={!scheduledAt || new Date(scheduledAt).getTime() <= Date.now()}
        onClose={() => setRescheduleOpen(false)}
        onSubmit={() => reschedule.mutate()}
      >
        <FormField
          autoFocus
          required
          type="datetime-local"
          label={t('secondary.delivery.scheduledAt')}
          value={scheduledAt}
          slotProps={{ inputLabel: { shrink: true } }}
          onChange={(event) => setScheduledAt(event.target.value)}
        />
      </FormDialog>
      <ConfirmDialog
        open={cancelOpen}
        title={t('secondary.delivery.cancelTitle')}
        description={t('secondary.delivery.cancelDescription')}
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('secondary.delivery.cancel')}
        intent="danger"
        busy={cancel.isPending}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => cancel.mutate()}
      />
      <ConfirmDialog
        open={retryOpen}
        title={t('secondary.delivery.retryTitle')}
        description={t('secondary.delivery.retryDescription')}
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('delivery.retry')}
        intent="primary"
        busy={retry.isPending}
        onClose={() => setRetryOpen(false)}
        onConfirm={() => retry.mutate()}
      />
    </Box>
  );
}

function deliveryColor(state: string): 'default' | 'info' | 'success' | 'warning' | 'error' {
  if (state === 'DELIVERED' || state === 'ACCEPTED') return 'success';
  if (state === 'BOUNCED' || state === 'FAILED') return 'error';
  if (state === 'UNKNOWN') return 'warning';
  if (state === 'SCHEDULED' || state === 'QUEUED' || state === 'SENDING') return 'info';
  return 'default';
}

function localDateTime(value: Date) {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

function formatDate(value: string, language: string) {
  return formatLocalizedDate(
    value,
    { dateStyle: 'medium', timeStyle: 'short' },
    resolveSupportedLocale(language)
  );
}
