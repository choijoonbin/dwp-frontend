import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, CalendarClock, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import {
  cancelWorkplaceServiceOrder,
  createWorkplaceIdempotencyKey,
  getWorkplaceServiceOrder,
  getWorkplaceServiceOrders,
  reconfirmWorkplaceServiceOrder,
  resolveIdempotentMutationIntent,
} from '@dwp-frontend/shared-utils';
import { ActionButton, EmptyState, FormField, InlineFeedback } from '@dwp-frontend/design-system';
import {
  formatDate,
  formatNumber,
  resolveSupportedLocale,
  useDisplayDictionary,
} from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { useRoomsCapabilities } from './rooms-capabilities';
import {
  WorkplaceServiceLineAdjustmentRecovery,
  WorkplaceServiceLineCancellation,
} from './workplace-service-line-adjustment';
import { WorkplaceServiceOrderCollaboration } from './workplace-service-order-collaboration';
import { useWorkplaceServiceOrderEventPages } from './workplace-service-order-pages';
import {
  WorkplaceServiceOrderActions,
  WorkplaceServiceOrderPrintView,
  WorkplaceServicePolicyDetails,
} from './workplace-service-order-details';
import {
  WorkplaceServiceCredentialReveal,
  WorkplaceServiceInspectionPanel,
} from './workplace-service-sensitive-actions';
import { WorkplaceMobileReservationInspector } from './workplace-mobile-reservation-inspector';
import { workplaceMemberCard, workplaceMemberSoftSurface } from './workplace-member-surfaces';
import {
  requireWorkplaceServiceWrite,
  workplaceServiceResultUnknownAdjustments,
  workplaceServiceReference,
} from './workplace-services-ui-model';

import type {
  IdempotentMutationIntent,
  WorkplaceServiceOrder,
  WorkplaceServiceOrderState,
} from '@dwp-frontend/shared-utils';

function stateColor(state: WorkplaceServiceOrderState) {
  if (state === 'FULFILLED') return 'success' as const;
  if (['BLOCKED', 'RESULT_UNKNOWN'].includes(state)) return 'error' as const;
  if (['DELAYED', 'PARTIALLY_FULFILLED'].includes(state)) return 'warning' as const;
  return 'info' as const;
}

function OrderSummary({
  order,
  active,
  onSelect,
}: {
  order: WorkplaceServiceOrder;
  active: boolean;
  onSelect: (trigger: HTMLButtonElement) => void;
}) {
  const { t, i18n } = useTranslation('rooms');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const korean = locale === 'ko';
  const serviceNames = order.lines
    .slice(0, 2)
    .map((line) => (korean ? line.nameKo : line.nameEn))
    .join(', ');
  return (
    <Box
      component="li"
      sx={(theme) => ({
        ...workplaceMemberSoftSurface(theme),
        p: 1.5,
        listStyle: 'none',
        border: '1px solid',
        borderColor: active ? 'primary.main' : 'divider',
      })}
    >
      <Stack direction="row" justifyContent="space-between" gap={1}>
        <Box minWidth={0}>
          <Typography component="h2" variant="subtitle2" fontWeight="fontWeightBold">
            {serviceNames || t('workplace.services.orderFor', { count: order.lines.length })}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {t('workplace.services.auditReference', {
              id: workplaceServiceReference('order', order.serviceOrderId),
            })}
          </Typography>
        </Box>
        <Chip
          size="small"
          color={stateColor(order.state)}
          label={t(`workplace.services.orderStates.${order.state}`)}
        />
      </Stack>
      <Typography variant="body2" color="text.secondary" mt={1}>
        {t('workplace.services.reservationWindow', {
          start: formatDate(
            order.reservationStartsAt,
            { dateStyle: 'medium', timeStyle: 'short' },
            locale
          ),
          end: formatDate(
            order.reservationEndsAt,
            { dateStyle: 'medium', timeStyle: 'short' },
            locale
          ),
        })}
      </Typography>
      <ActionButton
        intent={active ? 'primary' : 'quiet'}
        size="small"
        onClick={(event) => onSelect(event.currentTarget)}
        sx={{ mt: 1 }}
      >
        {t('workplace.services.openOrder')}
      </ActionButton>
    </Box>
  );
}

function OrderInspector({ order, canWrite }: { order: WorkplaceServiceOrder; canWrite: boolean }) {
  const { t, i18n } = useTranslation('rooms');
  const display = useDisplayDictionary();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [reconfirmReason, setReconfirmReason] = useState('');
  const [reconfirmConfirmed, setReconfirmConfirmed] = useState(false);
  const cancelIntent = useRef<IdempotentMutationIntent | null>(null);
  const reconfirmIntent = useRef<IdempotentMutationIntent | null>(null);
  const eventsQuery = useWorkplaceServiceOrderEventPages(order.serviceOrderId);
  const events = useMemo(
    () => eventsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [eventsQuery.data]
  );
  const recoveries = useMemo(() => workplaceServiceResultUnknownAdjustments(events), [events]);
  const requiresLineCancellation = order.lines.some(
    (line) =>
      line.quantity - line.fulfilledQuantity - line.cancelledQuantity > 0 &&
      (line.unitPrice > 0 || line.providerCode !== 'DWP_NATIVE_FULFILLMENT')
  );
  const cancellable =
    !requiresLineCancellation && !['FULFILLED', 'CANCELLED'].includes(order.state);
  const mutation = useMutation({
    mutationFn: () => {
      requireWorkplaceServiceWrite(
        canWrite &&
          cancellable &&
          confirmed &&
          Boolean(reason.trim()) &&
          reason.trim().length <= 500
      );
      const input = {
        expectedVersion: order.version,
        explicitConfirmation: true as const,
        reason: reason.trim(),
      };
      const intent = resolveIdempotentMutationIntent(cancelIntent.current, input, () =>
        createWorkplaceIdempotencyKey('service-order-cancel')
      );
      cancelIntent.current = intent;
      return cancelWorkplaceServiceOrder(order.serviceOrderId, input, {
        idempotencyKey: intent.key,
      });
    },
    retry: false,
    onSuccess: () => {
      cancelIntent.current = null;
      void queryClient.invalidateQueries({ queryKey: ['workplace', 'services', 'orders'] });
      void queryClient.invalidateQueries({
        queryKey: ['workplace', 'services', 'order', order.serviceOrderId],
      });
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: ['workplace', 'services'] });
    },
  });
  const reconfirmMutation = useMutation({
    mutationFn: () => {
      requireWorkplaceServiceWrite(
        canWrite &&
          order.currentReservationVersion !== null &&
          reconfirmConfirmed &&
          Boolean(reconfirmReason.trim())
      );
      const input = {
        expectedVersion: order.version,
        expectedReservationVersion: order.currentReservationVersion!,
        explicitConfirmation: true as const,
        reason: reconfirmReason.trim(),
      };
      const intent = resolveIdempotentMutationIntent(reconfirmIntent.current, input, () =>
        createWorkplaceIdempotencyKey('service-order-reconfirm')
      );
      reconfirmIntent.current = intent;
      return reconfirmWorkplaceServiceOrder(order.serviceOrderId, input, {
        idempotencyKey: intent.key,
      });
    },
    retry: false,
    onSuccess: () => {
      reconfirmIntent.current = null;
      void queryClient.invalidateQueries({ queryKey: ['workplace', 'services'] });
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: ['workplace', 'services'] });
    },
  });
  const resetCancelMutation = mutation.reset;
  const resetReconfirmMutation = reconfirmMutation.reset;
  useEffect(() => {
    setReason('');
    setConfirmed(false);
    setReconfirmReason('');
    setReconfirmConfirmed(false);
    cancelIntent.current = null;
    reconfirmIntent.current = null;
    resetCancelMutation();
    resetReconfirmMutation();
  }, [order.serviceOrderId, resetCancelMutation, resetReconfirmMutation]);
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const korean = locale === 'ko';
  return (
    <Stack spacing={2} data-testid="workplace-service-order-inspector">
      <Typography component="h2" variant="subtitle1" fontWeight="fontWeightBold">
        {t('workplace.services.orderInspectorLabel')}
      </Typography>
      <WorkplaceServiceOrderActions order={order} />
      <WorkplaceServiceOrderPrintView order={order} />
      {order.reservationImpact !== 'NONE' && (
        <InlineFeedback severity="warning" icon={<AlertTriangle size={18} />}>
          {t(`workplace.services.impacts.${order.reservationImpact}`)}
        </InlineFeedback>
      )}
      {order.state === 'RESULT_UNKNOWN' && (
        <InlineFeedback severity="warning">{t('workplace.services.resultUnknown')}</InlineFeedback>
      )}
      {canWrite &&
        order.reconfirmationRequired &&
        order.reservationImpact === 'RECONFIRMATION_REQUIRED' && (
          <Stack spacing={1}>
            <Typography component="h3" variant="subtitle2" fontWeight="fontWeightBold">
              {t('workplace.services.reconfirmTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('workplace.services.reconfirmDescription')}
            </Typography>
            <FormField
              label={t('workplace.services.reconfirmReason')}
              value={reconfirmReason}
              onChange={(event) => setReconfirmReason(event.target.value)}
              inputProps={{ maxLength: 500 }}
              disabled={!canWrite || reconfirmMutation.isPending}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={reconfirmConfirmed}
                  onChange={(event) => setReconfirmConfirmed(event.target.checked)}
                  disabled={!canWrite || reconfirmMutation.isPending}
                />
              }
              label={t('workplace.services.reconfirmConfirmation')}
            />
            {reconfirmMutation.isError && (
              <InlineFeedback severity="error">
                {t('workplace.services.reconfirmError')}
              </InlineFeedback>
            )}
            <ActionButton
              intent="primary"
              loading={reconfirmMutation.isPending}
              disabled={
                !canWrite ||
                order.currentReservationVersion === null ||
                !reconfirmReason.trim() ||
                reconfirmReason.trim().length > 500 ||
                !reconfirmConfirmed
              }
              onClick={() => {
                if (canWrite) reconfirmMutation.mutate();
              }}
            >
              {t('workplace.services.reconfirmOrder')}
            </ActionButton>
          </Stack>
        )}
      <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 1 }}>
        <Typography component="dt" variant="caption" color="text.secondary">
          {t('workplace.services.estimatedCost')}
        </Typography>
        <Typography component="dd" variant="body2" sx={{ m: 0 }}>
          {formatNumber(order.estimatedCost, undefined, locale)} {order.currency}
        </Typography>
        <Typography component="dt" variant="caption" color="text.secondary">
          {t('workplace.services.costCenter')}
        </Typography>
        <Typography component="dd" variant="body2" sx={{ m: 0 }}>
          {order.costCenter ?? '—'}
        </Typography>
      </Box>
      <Stack component="ul" spacing={1} sx={{ p: 0, m: 0 }}>
        {order.lines.map((line) => (
          <Box
            component="li"
            key={line.serviceOrderLineId}
            sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.25, listStyle: 'none' })}
          >
            <Stack direction="row" justifyContent="space-between" gap={1}>
              <Typography component="h3" variant="subtitle2">
                {korean ? line.nameKo : line.nameEn}
              </Typography>
              <Chip
                size="small"
                label={t(`workplace.services.workStates.${line.state}`)}
                color={line.state === 'FULFILLED' ? 'success' : 'default'}
              />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {t('workplace.services.fulfillmentProgress', {
                fulfilled: line.fulfilledQuantity,
                quantity: line.quantity,
              })}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              {t('workplace.services.lineFinancialSummary', {
                cancelled: line.cancelledQuantity,
                refunded: formatNumber(line.refundedAmount, undefined, locale),
                currency: line.currency,
              })}
            </Typography>
            <WorkplaceServiceLineCancellation order={order} line={line} canWrite={canWrite} />
            <WorkplaceServiceCredentialReveal order={order} line={line} canWrite={canWrite} />
            <WorkplaceServiceInspectionPanel order={order} line={line} canWrite={canWrite} />
            {recoveries
              .filter((item) => item.serviceOrderLineId === line.serviceOrderLineId)
              .map((recovery) => (
                <WorkplaceServiceLineAdjustmentRecovery
                  key={recovery.lineAdjustmentId}
                  orderId={order.serviceOrderId}
                  recovery={recovery}
                />
              ))}
          </Box>
        ))}
      </Stack>
      <WorkplaceServicePolicyDetails order={order} />
      <Box>
        <Typography component="h3" variant="subtitle2" fontWeight="fontWeightBold">
          {t('workplace.services.timeline')}
        </Typography>
        {eventsQuery.isError ? (
          <InlineFeedback severity="error">{t('workplace.services.historyError')}</InlineFeedback>
        ) : null}
        <Stack component="ol" spacing={0.75} sx={{ pl: 2.5, mb: 0 }}>
          {events.map((event) => (
            <Typography component="li" variant="body2" key={event.eventId}>
              {t(`workplace.services.events.${event.eventType}`, {
                defaultValue: display('auditActions', event.eventType),
              })}
            </Typography>
          ))}
        </Stack>
        {eventsQuery.hasNextPage ? (
          <ActionButton
            intent="quiet"
            size="small"
            loading={eventsQuery.isFetchingNextPage}
            onClick={() => void eventsQuery.fetchNextPage()}
          >
            {t('workplace.services.loadMore')}
          </ActionButton>
        ) : null}
      </Box>
      <WorkplaceServiceOrderCollaboration order={order} canWrite={canWrite} />
      {requiresLineCancellation && canWrite ? (
        <InlineFeedback severity="info">
          {t('workplace.services.lineCancellation.wholeOrderBlocked')}
        </InlineFeedback>
      ) : null}
      {cancellable && canWrite && (
        <Stack spacing={1}>
          <FormField
            label={t('workplace.services.cancelReason')}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            inputProps={{ maxLength: 500 }}
            disabled={!canWrite || mutation.isPending}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                disabled={!canWrite || mutation.isPending}
              />
            }
            label={t('workplace.services.cancelConfirmation')}
          />
          {mutation.isError && (
            <InlineFeedback severity="error">{t('workplace.services.cancelError')}</InlineFeedback>
          )}
          <ActionButton
            intent="danger"
            loading={mutation.isPending}
            disabled={!canWrite || !confirmed || !reason.trim() || reason.trim().length > 500}
            onClick={() => {
              if (canWrite) mutation.mutate();
            }}
          >
            {t('workplace.services.cancelOrder')}
          </ActionButton>
        </Stack>
      )}
    </Stack>
  );
}

export default function WorkplaceServiceOrdersPage() {
  const { t } = useTranslation('rooms');
  const capabilities = useRoomsCapabilities();
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('order');
  const ordersQuery = useInfiniteQuery({
    queryKey: ['workplace', 'services', 'orders'],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => getWorkplaceServiceOrders({ cursor: pageParam, limit: 100 }),
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    enabled: capabilities.isLoaded && capabilities.canViewWorkplace,
    retry: 1,
  });
  const orders = useMemo(
    () => ordersQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [ordersQuery.data]
  );
  const selectedFromList = useMemo(
    () => orders.find((order) => order.serviceOrderId === selectedId) ?? null,
    [orders, selectedId]
  );
  const detailQuery = useQuery({
    queryKey: ['workplace', 'services', 'order', selectedId],
    queryFn: () => getWorkplaceServiceOrder(selectedId!),
    enabled: capabilities.canViewWorkplace && Boolean(selectedId) && !selectedFromList,
    initialData: selectedFromList ?? undefined,
  });
  const selected = selectedFromList ?? detailQuery.data ?? null;

  return (
    <Box
      data-testid="workplace-service-orders"
      sx={{ width: '100%', maxWidth: 1440, mx: 'auto', p: { xs: 2, md: 3 } }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        gap={1.5}
        mb={2.5}
      >
        <Box>
          <Typography variant="overline" color="primary.main">
            {t('workplace.services.eyebrow')}
          </Typography>
          <Typography
            ref={headingRef}
            tabIndex={-1}
            component="h1"
            variant="h4"
            fontWeight="fontWeightBold"
          >
            {t('workplace.services.ordersTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            {t('workplace.services.ordersDescription')}
          </Typography>
        </Box>
        <ActionButton
          component={Link}
          to="/workplace/reservations"
          intent="primary"
          startIcon={<CalendarClock size={17} />}
        >
          {t('workplace.services.openReservations')}
        </ActionButton>
      </Stack>
      {!capabilities.isLoaded || ordersQuery.isLoading ? (
        <Typography color="text.secondary">{t('workplace.services.loading')}</Typography>
      ) : !capabilities.canViewWorkplace ? (
        <InlineFeedback severity="warning">{t('workplace.services.denied')}</InlineFeedback>
      ) : ordersQuery.isError ? (
        <InlineFeedback
          severity="error"
          action={
            <ActionButton
              intent="quiet"
              startIcon={<RefreshCw size={16} />}
              onClick={() => void ordersQuery.refetch()}
            >
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('workplace.services.ordersError')}
        </InlineFeedback>
      ) : !orders.length ? (
        <EmptyState
          title={t('workplace.services.ordersEmpty')}
          description={t('workplace.services.ordersEmptyDescription')}
          action={
            <ActionButton
              component={Link}
              to="/workplace/reservations"
              intent="primary"
              endIcon={<ArrowRight size={16} />}
            >
              {t('workplace.services.openReservations')}
            </ActionButton>
          }
        />
      ) : (
        <Stack spacing={1.5}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 0.9fr) minmax(360px, 1.1fr)' },
              gap: 2,
            }}
          >
            <Stack
              component="ul"
              spacing={1.25}
              sx={{
                p: 0,
                m: 0,
                display: { xs: selected ? 'none' : 'flex', md: 'flex' },
              }}
            >
              {orders.map((order) => (
                <OrderSummary
                  key={order.serviceOrderId}
                  order={order}
                  active={selected?.serviceOrderId === order.serviceOrderId}
                  onSelect={(trigger) => {
                    openerRef.current = trigger;
                    const next = new URLSearchParams(params);
                    next.set('order', order.serviceOrderId);
                    setParams(next);
                  }}
                />
              ))}
              {ordersQuery.hasNextPage ? (
                <ActionButton
                  intent="quiet"
                  loading={ordersQuery.isFetchingNextPage}
                  onClick={() => void ordersQuery.fetchNextPage()}
                >
                  {t('workplace.services.loadMore')}
                </ActionButton>
              ) : null}
            </Stack>
            {selected ? (
              <WorkplaceMobileReservationInspector
                closeLabel={t('actions.close')}
                label={t('workplace.services.orderInspectorLabel')}
                openerRef={openerRef}
                fallbackFocusRef={headingRef}
                onClose={() => {
                  const next = new URLSearchParams(params);
                  next.delete('order');
                  setParams(next);
                }}
              >
                <Box sx={{ p: { xs: 1.5, md: 2 } }}>
                  <OrderInspector
                    order={selected}
                    canWrite={capabilities.canUpdateWorkplaceBooking}
                  />
                </Box>
              </WorkplaceMobileReservationInspector>
            ) : (
              <Box component="aside" sx={(theme) => ({ ...workplaceMemberCard(theme), p: 2 })}>
                <EmptyState title={t('workplace.services.selectOrder')} />
              </Box>
            )}
          </Box>
        </Stack>
      )}
    </Box>
  );
}
