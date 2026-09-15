import { useTranslation } from 'react-i18next';
import { ArchiveX, CloudCog, ListChecks, RefreshCcw, RotateCcw, TriangleAlert } from 'lucide-react';
import { ActionButton, EmptyState, InlineFeedback } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';

import {
  approvalDeliveryRetryEligibility,
  isApprovalDeliveryRetryCandidate,
} from './approval-management-model';
import { approvalDeliverySupports } from './approval-native-operations-model';
import { ApprovalSurface, StatusChip, approvalTone } from './approval-ui';

import type { ApprovalIntegrationDelivery } from '@dwp-frontend/shared-utils';
import type { ApprovalNativeDeliveryAction } from '@dwp-frontend/shared-utils/api/approval-native-operations-api';

type ApprovalOperationsDeliveryPaneProps = Readonly<{
  deliveries: readonly ApprovalIntegrationDelivery[];
  selected: ApprovalIntegrationDelivery | null;
  selectedIds: ReadonlySet<string>;
  canOperate: boolean;
  busy: boolean;
  formatTimestamp: (value?: string | null) => string;
  onSelect: (delivery: ApprovalIntegrationDelivery) => void;
  onToggle: (targetId: string, checked: boolean) => void;
  onToggleVisible: (targets: readonly ApprovalIntegrationDelivery[], checked: boolean) => void;
  onNative: (
    action: ApprovalNativeDeliveryAction,
    targets: readonly ApprovalIntegrationDelivery[]
  ) => void;
}>;

function actionLabel(
  t: ReturnType<typeof useTranslation<'approvals'>>['t'],
  action: ApprovalNativeDeliveryAction
) {
  return t(`admin.nativeOperations.actions.${action}`, {
    defaultValue: {
      RETRY: 'Retry selected',
      DEAD_LETTER: 'Move to dead-letter',
      REPLAY: 'Replay selected',
      RECONCILE: 'Reconcile state',
    }[action],
  });
}

export function ApprovalOperationsDeliveryPane({
  deliveries,
  selected,
  selectedIds,
  canOperate,
  busy,
  formatTimestamp,
  onSelect,
  onToggle,
  onToggleVisible,
  onNative,
}: ApprovalOperationsDeliveryPaneProps) {
  const { t } = useTranslation('approvals');
  const selectedTargets = deliveries.filter((delivery) => selectedIds.has(delivery.outboxId));
  const allVisibleSelected =
    deliveries.length > 0 && deliveries.every((item) => selectedIds.has(item.outboxId));
  const partiallySelected = selectedTargets.length > 0 && !allVisibleSelected;

  return (
    <>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        gap={1}
        sx={{ px: 1.5, py: 1, borderBlock: 1, borderColor: 'divider' }}
      >
        <FormControlLabel
          sx={{
            m: 0,
            '& .MuiFormControlLabel-label.Mui-disabled': { color: 'text.secondary' },
          }}
          control={
            <Checkbox
              size="small"
              checked={allVisibleSelected}
              indeterminate={partiallySelected}
              disabled={!canOperate || deliveries.length === 0 || busy}
              onChange={(_event, checked) => onToggleVisible(deliveries, checked)}
            />
          }
          label={t('admin.nativeOperations.selectedCount', {
            count: selectedTargets.length,
            defaultValue: '{{count}} selected',
          })}
        />
        <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
          {t('admin.nativeOperations.batchLimit', {
            defaultValue: 'Maximum 50 · all or nothing',
          })}
        </Box>
      </Stack>
      {selectedTargets.length > 0 ? (
        <Stack
          direction="row"
          flexWrap="wrap"
          gap={0.75}
          sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}
        >
          {(['RETRY', 'DEAD_LETTER', 'REPLAY', 'RECONCILE'] as const).map((action) => (
            <ActionButton
              key={action}
              size="small"
              intent={
                action === 'DEAD_LETTER'
                  ? 'danger'
                  : action === 'RECONCILE'
                    ? 'secondary'
                    : 'primary'
              }
              disabled={
                !canOperate ||
                busy ||
                !selectedTargets.every((target) => approvalDeliverySupports(target, action))
              }
              startIcon={
                action === 'DEAD_LETTER' ? (
                  <ArchiveX size={15} />
                ) : action === 'RECONCILE' ? (
                  <RefreshCcw size={15} />
                ) : (
                  <RotateCcw size={15} />
                )
              }
              onClick={() => onNative(action, selectedTargets)}
            >
              {actionLabel(t, action)}
            </ActionButton>
          ))}
        </Stack>
      ) : null}
      {deliveries.length === 0 ? (
        <EmptyState
          title={t('admin.integrations.empty')}
          description={t('admin.integrations.meta')}
          icon={<CloudCog size={24} />}
        />
      ) : (
        <Stack
          component="ul"
          sx={{ m: 0, p: 0, listStyle: 'none', maxHeight: 540, overflowY: 'auto' }}
        >
          {deliveries.map((delivery) => (
            <DeliveryQueueRow
              key={delivery.outboxId}
              delivery={delivery}
              selected={delivery.outboxId === selected?.outboxId}
              checked={selectedIds.has(delivery.outboxId)}
              disabled={!canOperate || busy}
              updatedAt={formatTimestamp(
                delivery.lastRetriedAt ?? delivery.publishedAt ?? delivery.createdAt
              )}
              onSelect={() => onSelect(delivery)}
              onToggle={(checked) => onToggle(delivery.outboxId, checked)}
            />
          ))}
        </Stack>
      )}
    </>
  );
}

function DeliveryQueueRow({
  delivery,
  selected,
  checked,
  disabled,
  updatedAt,
  onSelect,
  onToggle,
}: Readonly<{
  delivery: ApprovalIntegrationDelivery;
  selected: boolean;
  checked: boolean;
  disabled: boolean;
  updatedAt: string;
  onSelect: () => void;
  onToggle: (checked: boolean) => void;
}>) {
  const { t } = useTranslation('approvals');
  return (
    <Box component="li" sx={{ display: 'flex', alignItems: 'stretch' }}>
      <Checkbox
        size="small"
        checked={checked}
        disabled={disabled}
        inputProps={{
          'aria-label': t('admin.nativeOperations.selectTarget', {
            target: delivery.eventType,
            defaultValue: 'Select {{target}}',
          }),
        }}
        sx={{ alignSelf: 'center', ml: 0.5 }}
        onChange={(_event, value) => onToggle(value)}
      />
      <ButtonBase
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 86,
          px: 1.25,
          py: 1.25,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1.25,
          textAlign: 'left',
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: selected ? alpha(approvalTone.primary, 0.075) : 'transparent',
          borderInlineStart: 3,
          borderInlineStartColor: selected ? approvalTone.primary : 'transparent',
          '&:hover': { bgcolor: alpha(approvalTone.primary, 0.05) },
        }}
      >
        {isApprovalDeliveryRetryCandidate(delivery) ? (
          <TriangleAlert size={17} color={approvalTone.amber} />
        ) : (
          <CloudCog size={17} />
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ typography: 'body2', fontWeight: 'fontWeightBold', overflowWrap: 'anywhere' }}>
            {delivery.eventType}
          </Box>
          <Box sx={{ typography: 'caption', color: 'text.secondary', overflowWrap: 'anywhere' }}>
            {delivery.eventId}
          </Box>
          <Box sx={{ typography: 'caption', color: 'text.secondary' }}>{updatedAt}</Box>
        </Box>
        <StatusChip status={delivery.status} />
      </ButtonBase>
    </Box>
  );
}

export function ApprovalOperationsDeliveryInspector({
  delivery,
  canOperate,
  busy,
  formatTimestamp,
  onRetry,
  onNative,
}: Readonly<{
  delivery: ApprovalIntegrationDelivery;
  canOperate: boolean;
  busy: boolean;
  formatTimestamp: (value?: string | null) => string;
  onRetry: (expectedVersion: number) => void;
  onNative: (
    action: ApprovalNativeDeliveryAction,
    targets: readonly ApprovalIntegrationDelivery[]
  ) => void;
}>) {
  const { t } = useTranslation('approvals');
  const retryEligibility = approvalDeliveryRetryEligibility(delivery);
  const rows = [
    [t('admin.integrations.columns.status'), <StatusChip key="status" status={delivery.status} />],
    [t('admin.integrations.columns.attempts'), String(delivery.attemptCount)],
    [t('admin.operationsQueue.eventVersion'), t('admin.version', { version: delivery.version })],
    [t('admin.integrations.availableAt'), formatTimestamp(delivery.availableAt)],
    [t('admin.integrations.evaluatedAt'), formatTimestamp(retryEligibility.evaluatedAt)],
    [t('admin.integrations.requestId'), delivery.requestId ?? t('admin.integrations.notAvailable')],
  ] as const;

  return (
    <ApprovalSurface
      title={delivery.eventType}
      meta={delivery.eventId}
      action={<CloudCog size={18} />}
    >
      <Stack gap={2} sx={{ p: 2 }}>
        <Box
          component="dl"
          sx={{
            m: 0,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' },
            gap: 1.5,
          }}
        >
          {rows.map(([label, value]) => (
            <Box key={String(label)} sx={{ minWidth: 0 }}>
              <Box component="dt" sx={{ typography: 'caption', color: 'text.secondary' }}>
                {label}
              </Box>
              <Box
                component="dd"
                sx={{
                  m: 0,
                  mt: 0.35,
                  typography: 'body2',
                  fontWeight: 'fontWeightBold',
                  overflowWrap: 'anywhere',
                }}
              >
                {value}
              </Box>
            </Box>
          ))}
        </Box>
        <Box>
          <Stack direction="row" alignItems="center" gap={0.75} sx={{ mb: 0.75 }}>
            <ListChecks size={16} />
            <Box sx={{ typography: 'subtitle2' }}>
              {t('admin.nativeOperations.attempts.title', { defaultValue: 'Delivery attempts' })}
            </Box>
          </Stack>
          <Stack component="ol" gap={0.75} sx={{ m: 0, pl: 2.5 }}>
            <Box component="li" sx={{ typography: 'body2' }}>
              {t('admin.nativeOperations.attempts.automatic', {
                count: delivery.attemptCount,
                defaultValue: '{{count}} automatic attempt(s)',
              })}
            </Box>
            <Box component="li" sx={{ typography: 'body2' }}>
              {t('admin.nativeOperations.attempts.manual', {
                count: delivery.manualRetryCount,
                defaultValue: '{{count}} operator recovery attempt(s)',
              })}
            </Box>
            <Box component="li" sx={{ typography: 'body2' }}>
              {formatTimestamp(
                delivery.lastRetriedAt ?? delivery.publishedAt ?? delivery.createdAt
              )}
            </Box>
          </Stack>
        </Box>
        <InlineFeedback severity={delivery.lastError ? 'error' : 'info'}>
          <Box sx={{ typography: 'body2', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {delivery.lastError ?? t('admin.integrations.noError')}
          </Box>
        </InlineFeedback>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} justifyContent="flex-end">
          <ActionButton
            intent="primary"
            startIcon={<RotateCcw size={17} />}
            disabled={!canOperate || !retryEligibility.eligible}
            loading={busy}
            onClick={() => {
              if (retryEligibility.expectedVersion !== null) {
                onRetry(retryEligibility.expectedVersion);
              }
            }}
          >
            {t('admin.integrations.retry')}
          </ActionButton>
          {(['DEAD_LETTER', 'REPLAY', 'RECONCILE'] as const).map((action) => (
            <ActionButton
              key={action}
              intent={action === 'DEAD_LETTER' ? 'danger' : 'secondary'}
              disabled={!canOperate || busy || !approvalDeliverySupports(delivery, action)}
              onClick={() => onNative(action, [delivery])}
            >
              {actionLabel(t, action)}
            </ActionButton>
          ))}
        </Stack>
      </Stack>
    </ApprovalSurface>
  );
}
