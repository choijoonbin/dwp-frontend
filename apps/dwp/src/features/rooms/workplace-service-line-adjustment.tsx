import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  cancelWorkplaceServiceLine,
  createWorkplaceIdempotencyKey,
  getWorkplaceServiceLineAdjustment,
  previewWorkplaceServiceLineCancellation,
  reconcileWorkplaceServiceLineAdjustment,
  resolveIdempotentMutationIntent,
} from '@dwp-frontend/shared-utils';
import { ActionButton, FormField, InlineFeedback } from '@dwp-frontend/design-system';
import { formatNumber, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { requireWorkplaceServiceWrite } from './workplace-services-ui-model';

import type {
  IdempotentMutationIntent,
  WorkplaceServiceLineAdjustmentState,
  WorkplaceServiceOrder,
  WorkplaceServiceOrderLine,
} from '@dwp-frontend/shared-utils';
import type { WorkplaceServiceResultUnknownAdjustment } from './workplace-services-ui-model';

const recoverableAdjustmentStates = new Set<WorkplaceServiceLineAdjustmentState>([
  'CANCELLATION_PENDING',
  'RECONCILIATION_PENDING',
  'RESULT_UNKNOWN',
  'REFUND_NOT_CONFIGURED',
]);

function adjustmentTone(state: WorkplaceServiceLineAdjustmentState) {
  if (recoverableAdjustmentStates.has(state)) return 'warning' as const;
  if (state === 'FAILED') return 'error' as const;
  return 'success' as const;
}

export function WorkplaceServiceLineAdjustmentRecovery({
  orderId,
  recovery,
  administrator = false,
  canWrite = false,
  elevated = false,
}: {
  orderId: string;
  recovery: WorkplaceServiceResultUnknownAdjustment;
  administrator?: boolean;
  canWrite?: boolean;
  elevated?: boolean;
}) {
  const { t, i18n } = useTranslation('rooms');
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const intentRef = useRef<IdempotentMutationIntent | null>(null);
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const statusQuery = useQuery({
    queryKey: [
      'workplace',
      'services',
      administrator ? 'admin' : 'own',
      orderId,
      'line-adjustment',
      recovery.lineAdjustmentId,
    ],
    queryFn: () =>
      getWorkplaceServiceLineAdjustment(orderId, recovery.lineAdjustmentId, administrator),
    retry: false,
  });
  const reconcileMutation = useMutation({
    mutationFn: () => {
      const adjustment = statusQuery.data;
      requireWorkplaceServiceWrite(
        administrator &&
          canWrite &&
          elevated &&
          Boolean(adjustment && recoverableAdjustmentStates.has(adjustment.state)) &&
          confirmed &&
          Boolean(reason.trim()) &&
          reason.trim().length <= 500
      );
      const input = {
        expectedVersion: adjustment!.version,
        explicitConfirmation: true as const,
        reason: reason.trim(),
      };
      const intent = resolveIdempotentMutationIntent(intentRef.current, input, () =>
        createWorkplaceIdempotencyKey('service-line-reconcile')
      );
      intentRef.current = intent;
      return reconcileWorkplaceServiceLineAdjustment(orderId, recovery.lineAdjustmentId, input, {
        idempotencyKey: intent.key,
        activeAccessMode: 'ELEVATED',
      });
    },
    retry: false,
    onSuccess: () => {
      intentRef.current = null;
      setReason('');
      setConfirmed(false);
      void queryClient.invalidateQueries({ queryKey: ['workplace', 'services'] });
    },
    onError: () => void statusQuery.refetch(),
  });
  const adjustment = reconcileMutation.data?.adjustment ?? statusQuery.data;
  return (
    <Stack spacing={1} sx={{ border: 1, borderColor: 'warning.main', p: 1.25 }}>
      <Stack direction="row" justifyContent="space-between" gap={1} alignItems="center">
        <Typography variant="subtitle2">{t('workplace.services.lineRecovery.title')}</Typography>
        {adjustment ? (
          <Chip
            size="small"
            color={adjustmentTone(adjustment.state)}
            label={t(`workplace.services.lineAdjustmentStates.${adjustment.state}`)}
          />
        ) : null}
      </Stack>
      {statusQuery.isError ? (
        <InlineFeedback severity="error">
          {t('workplace.services.lineRecovery.statusError')}
        </InlineFeedback>
      ) : null}
      {adjustment ? (
        <Typography variant="body2" color="text.secondary">
          {t('workplace.services.lineRecovery.refundSummary', {
            amount: formatNumber(adjustment.refundedAmount, undefined, locale),
            currency: adjustment.currency,
          })}
        </Typography>
      ) : null}
      <ActionButton intent="quiet" size="small" onClick={() => void statusQuery.refetch()}>
        {t('workplace.services.lineRecovery.refresh')}
      </ActionButton>
      {administrator &&
      adjustment &&
      recoverableAdjustmentStates.has(adjustment.state) &&
      canWrite ? (
        <Stack spacing={1}>
          <FormField
            label={t('workplace.services.lineRecovery.reconcileReason')}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            inputProps={{ maxLength: 500 }}
            disabled={!elevated || reconcileMutation.isPending}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                disabled={!elevated || reconcileMutation.isPending}
              />
            }
            label={t('workplace.services.lineRecovery.reconcileConfirmation')}
          />
          <ActionButton
            intent="primary"
            loading={reconcileMutation.isPending}
            disabled={!elevated || !reason.trim() || reason.trim().length > 500 || !confirmed}
            onClick={() => reconcileMutation.mutate()}
          >
            {t('workplace.services.lineRecovery.reconcile')}
          </ActionButton>
          {reconcileMutation.isError ? (
            <InlineFeedback severity="error">
              {t('workplace.services.lineRecovery.reconcileError')}
            </InlineFeedback>
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  );
}

export function WorkplaceServiceLineCancellation({
  order,
  line,
  canWrite,
}: {
  order: WorkplaceServiceOrder;
  line: WorkplaceServiceOrderLine;
  canWrite: boolean;
}) {
  const { t, i18n } = useTranslation('rooms');
  const queryClient = useQueryClient();
  const remaining = Math.max(0, line.quantity - line.fulfilledQuantity - line.cancelledQuantity);
  const [quantity, setQuantity] = useState(Math.max(1, remaining));
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const intentRef = useRef<IdempotentMutationIntent | null>(null);
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const previewMutation = useMutation({
    mutationFn: () => {
      requireWorkplaceServiceWrite(
        canWrite &&
          remaining > 0 &&
          quantity >= 1 &&
          quantity <= remaining &&
          Boolean(reason.trim()) &&
          reason.trim().length <= 500
      );
      return previewWorkplaceServiceLineCancellation(
        order.serviceOrderId,
        line.serviceOrderLineId,
        {
          expectedOrderVersion: order.version,
          expectedLineVersion: line.version,
          cancelQuantity: quantity,
          reason: reason.trim(),
        }
      );
    },
    retry: false,
  });
  const cancelMutation = useMutation({
    mutationFn: () => {
      const preview = previewMutation.data;
      requireWorkplaceServiceWrite(
        canWrite && Boolean(preview?.eligible) && confirmed && preview?.cancelQuantity === quantity
      );
      const input = {
        cancellationPreviewId: preview!.cancellationPreviewId,
        expectedOrderVersion: preview!.orderVersion,
        expectedLineVersion: preview!.lineVersion,
        explicitConfirmation: true as const,
        reason: reason.trim(),
      };
      const intent = resolveIdempotentMutationIntent(intentRef.current, input, () =>
        createWorkplaceIdempotencyKey('service-line-cancel')
      );
      intentRef.current = intent;
      return cancelWorkplaceServiceLine(order.serviceOrderId, line.serviceOrderLineId, input, {
        idempotencyKey: intent.key,
      });
    },
    retry: false,
    onSuccess: () => {
      intentRef.current = null;
      setConfirmed(false);
      setReason('');
      previewMutation.reset();
      void queryClient.invalidateQueries({ queryKey: ['workplace', 'services'] });
    },
    onError: () => void queryClient.invalidateQueries({ queryKey: ['workplace', 'services'] }),
  });
  const resetPreview = previewMutation.reset;
  const resetCancel = cancelMutation.reset;
  useEffect(() => {
    setQuantity(Math.max(1, remaining));
    setReason('');
    setConfirmed(false);
    intentRef.current = null;
    resetPreview();
    resetCancel();
  }, [line.serviceOrderLineId, line.version, remaining, resetCancel, resetPreview]);
  if (!canWrite || remaining < 1 || ['FULFILLED', 'CANCELLED'].includes(line.state)) return null;
  const preview = previewMutation.data;
  const result = cancelMutation.data;
  return (
    <Stack component="details" spacing={1} sx={{ mt: 1 }}>
      <Typography component="summary" variant="body2" sx={{ minHeight: 44, py: 1 }}>
        {t('workplace.services.lineCancellation.open')}
      </Typography>
      <FormField
        type="number"
        label={t('workplace.services.lineCancellation.quantity')}
        value={quantity}
        onChange={(event) => {
          setQuantity(Number(event.target.value));
          previewMutation.reset();
          setConfirmed(false);
        }}
        inputProps={{ min: 1, max: remaining }}
        disabled={previewMutation.isPending || cancelMutation.isPending}
      />
      <FormField
        label={t('workplace.services.lineCancellation.reason')}
        value={reason}
        onChange={(event) => {
          setReason(event.target.value);
          previewMutation.reset();
          setConfirmed(false);
        }}
        inputProps={{ maxLength: 500 }}
        disabled={previewMutation.isPending || cancelMutation.isPending}
      />
      <ActionButton
        intent="quiet"
        loading={previewMutation.isPending}
        disabled={
          Boolean(cancelMutation.data) ||
          !reason.trim() ||
          reason.trim().length > 500 ||
          quantity < 1 ||
          quantity > remaining
        }
        onClick={() => previewMutation.mutate()}
      >
        {t('workplace.services.lineCancellation.preview')}
      </ActionButton>
      {previewMutation.isError ? (
        <InlineFeedback severity="error">
          {t('workplace.services.lineCancellation.previewError')}
        </InlineFeedback>
      ) : null}
      {preview ? (
        <Stack spacing={1}>
          <InlineFeedback severity={preview.eligible ? 'info' : 'warning'}>
            {t('workplace.services.lineCancellation.impact', {
              amount: formatNumber(preview.refundableAmount, undefined, locale),
              currency: preview.currency,
              quantity: preview.cancelQuantity,
              scope: t(`workplace.services.refundScopes.${preview.refundScope}`),
            })}
          </InlineFeedback>
          <FormControlLabel
            control={
              <Checkbox
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                disabled={!preview.eligible || cancelMutation.isPending}
              />
            }
            label={t('workplace.services.lineCancellation.confirmation')}
          />
          <ActionButton
            intent="danger"
            loading={cancelMutation.isPending}
            disabled={!preview.eligible || !confirmed}
            onClick={() => cancelMutation.mutate()}
          >
            {t('workplace.services.lineCancellation.confirm')}
          </ActionButton>
        </Stack>
      ) : null}
      {cancelMutation.isError ? (
        <InlineFeedback severity="error">
          {t('workplace.services.lineCancellation.cancelError')}
        </InlineFeedback>
      ) : null}
      {result ? (
        <InlineFeedback
          severity={
            result.receipt.state === 'FAILED'
              ? 'error'
              : result.receipt.state === 'RESULT_UNKNOWN' ||
                  recoverableAdjustmentStates.has(result.adjustment.state)
                ? 'warning'
                : 'success'
          }
        >
          {result.receipt.state === 'FAILED' || result.adjustment.state === 'REFUND_NOT_CONFIGURED'
            ? t('workplace.services.lineCancellation.requiresReview')
            : t('workplace.services.lineCancellation.receipt', {
                state: t(`workplace.services.lineAdjustmentStates.${result.adjustment.state}`),
              })}
        </InlineFeedback>
      ) : null}
    </Stack>
  );
}
