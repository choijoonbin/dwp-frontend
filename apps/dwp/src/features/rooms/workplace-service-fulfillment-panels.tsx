import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Clock3, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  createWorkplaceIdempotencyKey,
  resolveIdempotentMutationIntent,
  updateWorkplaceServiceFulfillment,
  useProductSurfaceAuthority,
} from '@dwp-frontend/shared-utils';
import {
  formatDate,
  resolveSupportedLocale,
  useDisplayDictionary,
} from '@dwp-frontend/shared-i18n';
import { ActionButton, FormField, InlineFeedback, SelectField } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { WorkplaceServiceAssigneePicker } from './workplace-service-assignee-picker';
import { WorkplaceServiceLineAdjustmentRecovery } from './workplace-service-line-adjustment';
import { WorkplaceServiceOrderCollaboration } from './workplace-service-order-collaboration';
import { useWorkplaceServiceOrderEventPages } from './workplace-service-order-pages';
import { WorkplaceServiceInspectionPanel } from './workplace-service-sensitive-actions';
import { workplaceMemberSoftSurface } from './workplace-member-surfaces';
import {
  providerAllowsFulfillmentWrite,
  requireWorkplaceServiceWrite,
  workplaceServiceAllowedFulfillmentStates,
  workplaceServiceFulfillmentQuantityIsValid,
  workplaceServiceResultUnknownAdjustments,
  workplaceServiceReference,
} from './workplace-services-ui-model';

import type {
  IdempotentMutationIntent,
  WorkplaceServiceFulfillmentTask,
  WorkplaceServiceOrder,
  WorkplaceServiceOrderState,
  WorkplaceServiceWorkState,
} from '@dwp-frontend/shared-utils';

function tone(state: WorkplaceServiceOrderState | WorkplaceServiceWorkState) {
  if (state === 'FULFILLED') return 'success' as const;
  if (['BLOCKED', 'RESULT_UNKNOWN', 'NOT_CONFIGURED'].includes(state)) return 'error' as const;
  if (['DELAYED', 'PARTIALLY_FULFILLED'].includes(state)) return 'warning' as const;
  return 'info' as const;
}

export function QueueItem({
  order,
  active,
  onClick,
}: {
  order: WorkplaceServiceOrder;
  active: boolean;
  onClick: (trigger: HTMLButtonElement) => void;
}) {
  const { t, i18n } = useTranslation('rooms');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const korean = locale === 'ko';
  const serviceNames = order.lines
    .slice(0, 2)
    .map((line) => (korean ? line.nameKo : line.nameEn))
    .join(', ');
  const due = order.tasks.reduce<string | null>(
    (earliest, task) => (!earliest || task.dueAt < earliest ? task.dueAt : earliest),
    null
  );
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
            {serviceNames ||
              t('workplace.services.fulfillmentQueueItem', { count: order.lines.length })}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {t('workplace.services.auditReference', {
              id: workplaceServiceReference('order', order.serviceOrderId),
            })}
          </Typography>
        </Box>
        <Chip
          size="small"
          color={tone(order.state)}
          label={t(`workplace.services.orderStates.${order.state}`)}
        />
      </Stack>
      <Stack direction="row" gap={0.75} alignItems="center" mt={1}>
        <Clock3 size={14} aria-hidden="true" />
        <Typography variant="caption">
          {due
            ? formatDate(due, { dateStyle: 'medium', timeStyle: 'short' }, locale)
            : t('workplace.services.noDeadline')}
        </Typography>
      </Stack>
      <ActionButton
        size="small"
        intent={active ? 'primary' : 'quiet'}
        onClick={(event) => onClick(event.currentTarget)}
        sx={{ mt: 1 }}
      >
        {t('workplace.services.inspect')}
      </ActionButton>
    </Box>
  );
}

function FulfillmentEditor({
  order,
  task,
  canManage,
}: {
  order: WorkplaceServiceOrder;
  task: WorkplaceServiceFulfillmentTask;
  canManage: boolean;
}) {
  const { t, i18n } = useTranslation('rooms');
  const authority = useProductSurfaceAuthority();
  const queryClient = useQueryClient();
  const elevated = authority.snapshot?.envelope.activeAccessMode === 'ELEVATED';
  const [state, setState] = useState<WorkplaceServiceWorkState>(task.state);
  const [reference, setReference] = useState(task.externalFulfillmentReference ?? '');
  const [blockerCode, setBlockerCode] = useState(task.blockerCode ?? '');
  const [detail, setDetail] = useState(task.blockerDetail ?? task.resultDetail ?? '');
  const [fulfilledQuantity, setFulfilledQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const updateIntent = useRef<IdempotentMutationIntent | null>(null);
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const line = order.lines.find((item) => item.serviceOrderLineId === task.serviceOrderLineId);
  const stateOptions = workplaceServiceAllowedFulfillmentStates(task.state);
  const fulfilledMaximum = Math.max(0, (line?.quantity ?? 0) - (line?.cancelledQuantity ?? 0));
  const fulfilledValue = fulfilledQuantity === '' ? null : Number(fulfilledQuantity);
  const stateValid = stateOptions.includes(state as (typeof stateOptions)[number]);
  const fulfilledValid =
    Boolean(line) &&
    stateValid &&
    workplaceServiceFulfillmentQuantityIsValid(
      line?.fulfilledQuantity ?? 0,
      line?.cancelledQuantity ?? 0,
      line?.quantity ?? 0,
      state as (typeof stateOptions)[number],
      fulfilledValue
    );
  const writable =
    canManage &&
    elevated &&
    providerAllowsFulfillmentWrite(task.providerState) &&
    !['FULFILLED', 'CANCELLED'].includes(task.state);
  const mutation = useMutation({
    mutationFn: () => {
      requireWorkplaceServiceWrite(
        writable &&
          stateValid &&
          fulfilledValid &&
          confirmed &&
          Boolean(reason.trim()) &&
          reason.trim().length <= 500
      );
      const input = {
        expectedVersion: task.version,
        state: state as Exclude<WorkplaceServiceWorkState, 'NOT_CONFIGURED'>,
        assigneeUserId: null,
        externalFulfillmentReference: reference.trim() || null,
        blockerCode: blockerCode.trim() || null,
        blockerDetail: ['BLOCKED', 'DELAYED'].includes(state) ? detail.trim() || null : null,
        resultDetail: ['FULFILLED', 'RESULT_UNKNOWN'].includes(state)
          ? detail.trim() || null
          : null,
        fulfilledQuantity: fulfilledValue,
        reason: reason.trim(),
        explicitConfirmation: true as const,
      };
      const intent = resolveIdempotentMutationIntent(updateIntent.current, input, () =>
        createWorkplaceIdempotencyKey('service-fulfillment-update')
      );
      updateIntent.current = intent;
      return updateWorkplaceServiceFulfillment(
        order.serviceOrderId,
        task.fulfillmentTaskId,
        input,
        { idempotencyKey: intent.key, activeAccessMode: 'ELEVATED' }
      );
    },
    retry: false,
    onSuccess: () => {
      updateIntent.current = null;
      void queryClient.invalidateQueries({ queryKey: ['workplace', 'services'] });
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: ['workplace', 'services'] });
    },
  });
  const resetMutation = mutation.reset;
  useEffect(() => {
    setState(task.state);
    setReference(task.externalFulfillmentReference ?? '');
    setBlockerCode(task.blockerCode ?? '');
    setDetail(task.blockerDetail ?? task.resultDetail ?? '');
    setFulfilledQuantity('');
    setReason('');
    setConfirmed(false);
    updateIntent.current = null;
    resetMutation();
  }, [
    resetMutation,
    task.blockerCode,
    task.blockerDetail,
    task.externalFulfillmentReference,
    task.fulfillmentTaskId,
    task.resultDetail,
    task.state,
    task.version,
  ]);
  const disabled = !writable || mutation.isPending;

  return (
    <Stack
      spacing={1.25}
      data-testid={`workplace-service-fulfillment-task-${workplaceServiceReference(
        'task',
        task.fulfillmentTaskId
      )}`}
    >
      <Stack direction="row" justifyContent="space-between" gap={1}>
        <Box>
          <Typography component="h3" variant="subtitle2" fontWeight="fontWeightBold">
            {t('workplace.services.fulfillmentTask')}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {workplaceServiceReference('task', task.fulfillmentTaskId)}
          </Typography>
        </Box>
        <Stack direction="row" gap={0.75} flexWrap="wrap" justifyContent="flex-end">
          <Chip
            size="small"
            color={tone(task.state)}
            label={t(`workplace.services.workStates.${task.state}`)}
          />
          <Chip
            size="small"
            variant="outlined"
            label={t(`workplace.services.providerStates.${task.providerState}`)}
          />
        </Stack>
      </Stack>
      <Box
        component="dl"
        sx={{
          m: 0,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'auto 1fr' },
          gap: 0.75,
        }}
      >
        <Typography component="dt" variant="caption" color="text.secondary">
          {t('workplace.services.sla.responseDue')}
        </Typography>
        <Typography component="dd" variant="body2" sx={{ m: 0 }}>
          {formatDate(task.responseDueAt, { dateStyle: 'medium', timeStyle: 'short' }, locale)} ·{' '}
          {task.responseBreached
            ? t('workplace.services.sla.breached')
            : t('workplace.services.sla.minutesRemaining', {
                count: Math.ceil(task.responseRemainingSeconds / 60),
              })}
        </Typography>
        <Typography component="dt" variant="caption" color="text.secondary">
          {t('workplace.services.sla.fulfillmentDue')}
        </Typography>
        <Typography component="dd" variant="body2" sx={{ m: 0 }}>
          {formatDate(task.dueAt, { dateStyle: 'medium', timeStyle: 'short' }, locale)} ·{' '}
          {task.fulfillmentBreached
            ? t('workplace.services.sla.breached')
            : t('workplace.services.sla.minutesRemaining', {
                count: Math.ceil(task.fulfillmentRemainingSeconds / 60),
              })}
        </Typography>
        <Typography component="dt" variant="caption" color="text.secondary">
          {t('workplace.services.sla.providerReceipt')}
        </Typography>
        <Typography component="dd" variant="body2" sx={{ m: 0 }}>
          {task.providerReceiptAt
            ? formatDate(
                task.providerReceiptAt,
                { dateStyle: 'medium', timeStyle: 'short' },
                locale
              )
            : t('workplace.services.sla.awaitingProvider')}
        </Typography>
        <Typography component="dt" variant="caption" color="text.secondary">
          {t('workplace.services.sla.sourceFreshness')}
        </Typography>
        <Typography component="dd" variant="body2" sx={{ m: 0 }}>
          {formatDate(task.updatedAt, { dateStyle: 'medium', timeStyle: 'short' }, locale)}
        </Typography>
      </Box>
      {task.responseBreached || task.fulfillmentBreached ? (
        <InlineFeedback severity="error">{t('workplace.services.sla.breachNotice')}</InlineFeedback>
      ) : null}
      {task.providerState !== 'READY' && (
        <InlineFeedback severity="warning">
          {t('workplace.services.providerWriteBlocked')}
        </InlineFeedback>
      )}
      {!elevated && canManage && (
        <InlineFeedback severity="warning" icon={<ShieldCheck size={18} />}>
          {t('workplace.services.stepUpRequired')}
        </InlineFeedback>
      )}
      <SelectField
        label={t('workplace.services.fulfillmentState')}
        value={state}
        options={[
          ...(!stateOptions.includes(task.state as (typeof stateOptions)[number])
            ? [
                {
                  value: task.state,
                  label: t(`workplace.services.workStates.${task.state}`),
                  disabled: true,
                },
              ]
            : []),
          ...stateOptions.map((value) => ({
            value,
            label: t(`workplace.services.workStates.${value}`),
          })),
        ]}
        onValueChange={(value) => {
          if (!value) return;
          setState(value);
          if (value === 'FULFILLED') setFulfilledQuantity(String(fulfilledMaximum));
          else if (value === 'PARTIALLY_FULFILLED') {
            const partial = Math.max(1, line?.fulfilledQuantity ?? 0);
            setFulfilledQuantity(partial < fulfilledMaximum ? String(partial) : '');
          } else setFulfilledQuantity('');
        }}
        disabled={disabled}
      />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
        <FormField
          label={t('workplace.services.externalReference')}
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          inputProps={{ maxLength: 320 }}
          disabled={disabled || !['PARTIALLY_FULFILLED', 'FULFILLED'].includes(state)}
        />
        <FormField
          label={t('workplace.services.blockerCode')}
          value={blockerCode}
          onChange={(event) => setBlockerCode(event.target.value)}
          inputProps={{ maxLength: 120 }}
          disabled={disabled}
        />
        <FormField
          type="number"
          label={t('workplace.services.fulfilledQuantityLabel')}
          value={fulfilledQuantity}
          onChange={(event) => setFulfilledQuantity(event.target.value)}
          inputProps={{ min: 0, max: fulfilledMaximum, step: 1 }}
          errorMessage={
            fulfilledValid
              ? undefined
              : t('workplace.services.fulfilledQuantityInvalid', {
                  maximum: fulfilledMaximum,
                })
          }
          disabled={disabled}
        />
      </Box>
      <WorkplaceServiceAssigneePicker
        order={order}
        task={task}
        canManage={canManage}
        elevated={elevated}
      />
      <FormField
        multiline
        minRows={2}
        label={t('workplace.services.fulfillmentDetail')}
        value={detail}
        onChange={(event) => setDetail(event.target.value)}
        inputProps={{ maxLength: 1000 }}
        disabled={disabled}
      />
      <FormField
        label={t('workplace.services.changeReason')}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        inputProps={{ maxLength: 500 }}
        disabled={disabled}
      />
      <FormControlLabel
        control={
          <Checkbox
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            disabled={disabled}
          />
        }
        label={t('workplace.services.fulfillmentConfirmation')}
      />
      {mutation.isError && (
        <InlineFeedback severity="error">{t('workplace.services.commandError')}</InlineFeedback>
      )}
      {mutation.data?.receipt.state === 'RESULT_UNKNOWN' && (
        <InlineFeedback severity="warning">{t('workplace.services.resultUnknown')}</InlineFeedback>
      )}
      <ActionButton
        intent="primary"
        loading={mutation.isPending}
        disabled={
          disabled ||
          !stateValid ||
          !fulfilledValid ||
          !confirmed ||
          !reason.trim() ||
          reason.trim().length > 500
        }
        onClick={() => {
          if (writable) mutation.mutate();
        }}
      >
        {t('workplace.services.updateFulfillment')}
      </ActionButton>
    </Stack>
  );
}

export function FulfillmentInspector({
  order,
  canManage,
}: {
  order: WorkplaceServiceOrder;
  canManage: boolean;
}) {
  const { t } = useTranslation('rooms');
  const display = useDisplayDictionary();
  const authority = useProductSurfaceAuthority();
  const elevated = authority.snapshot?.envelope.activeAccessMode === 'ELEVATED';
  const eventsQuery = useWorkplaceServiceOrderEventPages(order.serviceOrderId, true);
  const events = useMemo(
    () => eventsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [eventsQuery.data]
  );
  const recoveries = useMemo(() => workplaceServiceResultUnknownAdjustments(events), [events]);
  return (
    <Stack spacing={2} data-testid="workplace-service-fulfillment-inspector">
      <Typography component="h2" variant="subtitle1" fontWeight="fontWeightBold">
        {t('workplace.services.auditReference', {
          id: workplaceServiceReference('order', order.serviceOrderId),
        })}
      </Typography>
      {order.reservationImpact !== 'NONE' && (
        <InlineFeedback severity="warning" icon={<AlertTriangle size={18} />}>
          {t(`workplace.services.impacts.${order.reservationImpact}`)}
        </InlineFeedback>
      )}
      <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 1 }}>
        <Typography component="dt" variant="caption" color="text.secondary">
          {t('workplace.services.reservation')}
        </Typography>
        <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: 'anywhere' }}>
          {workplaceServiceReference('reservation', order.reservationId)}
        </Typography>
        <Typography component="dt" variant="caption" color="text.secondary">
          {t('workplace.services.costCenter')}
        </Typography>
        <Typography component="dd" variant="body2" sx={{ m: 0 }}>
          {order.costCenter ?? '—'}
        </Typography>
        <Typography component="dt" variant="caption" color="text.secondary">
          {t('workplace.services.attendeeCount')}
        </Typography>
        <Typography component="dd" variant="body2" sx={{ m: 0 }}>
          {order.attendeeCount}
        </Typography>
      </Box>
      {order.tasks.map((task) => (
        <Box
          key={task.fulfillmentTaskId}
          sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.5 })}
        >
          <FulfillmentEditor order={order} task={task} canManage={canManage} />
          {order.lines.find((line) => line.serviceOrderLineId === task.serviceOrderLineId) ? (
            <WorkplaceServiceInspectionPanel
              order={order}
              line={order.lines.find(
                (line) => line.serviceOrderLineId === task.serviceOrderLineId
              )!}
              canWrite={canManage}
              administrator
              elevated={elevated}
            />
          ) : null}
        </Box>
      ))}
      {recoveries.map((recovery) => (
        <WorkplaceServiceLineAdjustmentRecovery
          key={recovery.lineAdjustmentId}
          orderId={order.serviceOrderId}
          recovery={recovery}
          administrator
          canWrite={canManage}
          elevated={elevated}
        />
      ))}
      <WorkplaceServiceOrderCollaboration
        order={order}
        administrator
        canWrite={canManage}
        elevated={elevated}
      />
      <Box>
        <Typography component="h3" variant="subtitle2" fontWeight="fontWeightBold">
          {t('workplace.services.auditTimeline')}
        </Typography>
        {eventsQuery.isError ? (
          <InlineFeedback severity="error">{t('workplace.services.historyError')}</InlineFeedback>
        ) : null}
        <Stack component="ol" spacing={0.75} sx={{ pl: 2.5 }}>
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
      <Typography variant="caption" color="text.secondary">
        {t('workplace.services.extensionsNotice')}
      </Typography>
    </Stack>
  );
}
