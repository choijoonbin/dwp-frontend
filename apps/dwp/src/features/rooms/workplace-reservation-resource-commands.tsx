import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createWorkplaceIdempotencyKey,
  executeWorkplaceResourceCommand,
  getWorkplaceResourceCommandContext,
  previewWorkplaceResourceCommand,
  reconcileWorkplaceResourceCommand,
  useProductSurfaceAuthority,
  type WorkplaceResourceCommandAction,
  type WorkplaceResourceCommandPreview,
  type WorkplaceResourceCommandReceipt,
} from '@dwp-frontend/shared-utils';
import { ActionButton, ConfirmDialog, InlineFeedback } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

type Props = Readonly<{
  bookingId: string;
  bookingVersion: number;
  sourceReady: boolean;
}>;

export function WorkplaceReservationResourceCommands({
  bookingId,
  bookingVersion,
  sourceReady,
}: Props) {
  const { t } = useTranslation('rooms');
  const authority = useProductSurfaceAuthority();
  const elevated = authority.snapshot?.envelope.activeAccessMode === 'ELEVATED';
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [parkingMinutes, setParkingMinutes] = useState('60');
  const [preview, setPreview] = useState<WorkplaceResourceCommandPreview | null>(null);
  const [receipt, setReceipt] = useState<WorkplaceResourceCommandReceipt | null>(null);
  const [executeKey, setExecuteKey] = useState<string | null>(null);
  const [reconcileKey, setReconcileKey] = useState<string | null>(null);

  const context = useQuery({
    queryKey: ['workplace', 'resource-commands', bookingId, bookingVersion],
    queryFn: () => getWorkplaceResourceCommandContext(bookingId),
    enabled: sourceReady,
    staleTime: 15_000,
    retry: 1,
  });

  const previewMutation = useMutation({
    mutationFn: (action: WorkplaceResourceCommandAction) =>
      previewWorkplaceResourceCommand(bookingId, {
        commandType: action.commandType,
        expectedBookingVersion: bookingVersion,
        parameters: action.commandType === 'PARKING_EXTEND' ? { minutes: parkingMinutes } : {},
      }),
    onSuccess: (value) => {
      setPreview(value);
      setExecuteKey(createWorkplaceIdempotencyKey('resource-command'));
    },
  });

  const executeMutation = useMutation({
    mutationFn: (value: WorkplaceResourceCommandPreview) =>
      executeWorkplaceResourceCommand(
        bookingId,
        {
          previewId: value.previewId,
          expectedBookingVersion: bookingVersion,
          reason: reason.trim(),
          explicitConfirmation: true,
        },
        {
          idempotencyKey: executeKey ?? createWorkplaceIdempotencyKey('resource-command'),
          activeAccessMode: 'ELEVATED',
        }
      ),
    onSuccess: async (value) => {
      setReceipt(value);
      setPreview(null);
      setExecuteKey(null);
      setReconcileKey(
        value.requeryRequired ? createWorkplaceIdempotencyKey('resource-command-reconcile') : null
      );
      await queryClient.invalidateQueries({
        queryKey: ['workplace', 'resource-commands', bookingId],
      });
    },
  });

  const reconcileMutation = useMutation({
    mutationFn: (value: WorkplaceResourceCommandReceipt) =>
      reconcileWorkplaceResourceCommand(bookingId, value.commandId, reason.trim(), {
        idempotencyKey: reconcileKey ?? createWorkplaceIdempotencyKey('resource-command-reconcile'),
        activeAccessMode: 'ELEVATED',
      }),
    onSuccess: (value) => {
      setReceipt(value);
      if (!value.requeryRequired) setReconcileKey(null);
    },
  });

  const actions = context.data?.actions ?? [];
  const commandError =
    previewMutation.isError || executeMutation.isError || reconcileMutation.isError;
  const busy =
    previewMutation.isPending || executeMutation.isPending || reconcileMutation.isPending;
  const commandLabel = useMemo(
    () =>
      preview ? t(`workplace.reservations.resourceCommands.actions.${preview.commandType}`) : '',
    [preview, t]
  );

  if (!sourceReady) return null;

  return (
    <Stack
      spacing={1.25}
      data-testid="workplace-reservation-resource-commands"
      sx={{ mt: 2, p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}
    >
      <Box>
        <Typography variant="subtitle2">
          {t('workplace.reservations.resourceCommands.title')}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('workplace.reservations.resourceCommands.description')}
        </Typography>
      </Box>
      {!elevated && (
        <InlineFeedback severity="warning">
          {t('workplace.reservations.resourceCommands.stepUpRequired')}
        </InlineFeedback>
      )}
      {context.isError && (
        <InlineFeedback severity="error">
          {t('workplace.reservations.resourceCommands.loadError')}
        </InlineFeedback>
      )}
      <TextField
        size="small"
        label={t('workplace.reservations.resourceCommands.reason')}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        inputProps={{ maxLength: 500 }}
        required
      />
      {actions.some((action) => action.commandType === 'PARKING_EXTEND') && (
        <TextField
          select
          size="small"
          label={t('workplace.reservations.resourceCommands.parkingMinutes')}
          value={parkingMinutes}
          onChange={(event) => setParkingMinutes(event.target.value)}
        >
          {['30', '60', '120', '240'].map((value) => (
            <MenuItem value={value} key={value}>
              {t('workplace.reservations.resourceCommands.minutes', { count: Number(value) })}
            </MenuItem>
          ))}
        </TextField>
      )}
      <Stack direction="row" gap={1} flexWrap="wrap">
        {actions.map((action) => {
          const available = action.availability === 'AVAILABLE';
          return (
            <ActionButton
              key={action.commandType}
              intent={action.commandType === 'LOCKER_UNLOCK' ? 'primary' : 'secondary'}
              size="small"
              disabled={!available || !elevated || !reason.trim() || busy}
              onClick={() => previewMutation.mutate(action)}
            >
              {t(`workplace.reservations.resourceCommands.actions.${action.commandType}`)}
            </ActionButton>
          );
        })}
      </Stack>
      {actions
        .filter((action) => action.availability !== 'AVAILABLE')
        .map((action) => (
          <Typography key={action.commandType} variant="caption" color="text.secondary">
            {t(`workplace.reservations.resourceCommands.actions.${action.commandType}`)}:{' '}
            {t(
              `workplace.reservations.resourceCommands.limitations.${action.limitationCode ?? 'PROVIDER_NOT_READY'}`
            )}
          </Typography>
        ))}
      {receipt && (
        <InlineFeedback severity={receipt.state === 'SUCCEEDED' ? 'success' : 'warning'}>
          {t(`workplace.reservations.resourceCommands.states.${receipt.state}`)}
          {receipt.resultCode ? ` · ${receipt.resultCode}` : ''}
        </InlineFeedback>
      )}
      {receipt?.requeryRequired && (
        <ActionButton
          intent="secondary"
          size="small"
          disabled={!elevated || !reason.trim() || busy}
          onClick={() => reconcileMutation.mutate(receipt)}
        >
          {t('workplace.reservations.resourceCommands.reconcile')}
        </ActionButton>
      )}
      {commandError && (
        <InlineFeedback severity="error">
          {t('workplace.reservations.resourceCommands.commandError')}
        </InlineFeedback>
      )}
      <ConfirmDialog
        open={Boolean(preview?.eligible)}
        title={t('workplace.reservations.resourceCommands.confirmTitle', {
          action: commandLabel,
        })}
        description={t('workplace.reservations.resourceCommands.confirmDescription')}
        details={
          preview ? (
            <Stack spacing={0.5}>
              {preview.impact.map((impact) => (
                <Typography key={impact} variant="body2">
                  {t(`workplace.reservations.resourceCommands.impacts.${impact}`)}
                </Typography>
              ))}
            </Stack>
          ) : null
        }
        cancelLabel={t('actions.keep')}
        confirmLabel={t('workplace.reservations.resourceCommands.confirm')}
        confirmingLabel={t('workplace.reservations.resourceCommands.confirming')}
        busy={executeMutation.isPending}
        intent="danger"
        focusCancelAfterOpen
        minimumActionHeight={44}
        mobilePresentation="sheet"
        onClose={() => {
          if (!executeMutation.isPending) {
            setPreview(null);
            setExecuteKey(null);
          }
        }}
        onConfirm={() => {
          if (preview) executeMutation.mutate(preview);
        }}
      />
    </Stack>
  );
}
