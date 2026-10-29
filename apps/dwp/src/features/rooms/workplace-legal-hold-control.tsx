import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FormDialog, FormField } from '@dwp-frontend/design-system';
import { updateWorkplaceBookingLegalHold, useToast } from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';

import { WORKPLACE_ADMIN_BOOKING_COMMAND_OPTIONS } from './workplace-admin-booking-command-authority';

import type { WorkplaceAdminBooking, WorkplaceAdminBookingPage } from '@dwp-frontend/shared-utils';

type LegalHoldTarget = { booking: WorkplaceAdminBooking; nextState: boolean };

export function useWorkplaceLegalHoldControl(canExecute: boolean) {
  const { t } = useTranslation('rooms');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<LegalHoldTarget | null>(null);
  const [reason, setReason] = useState('');
  const mutation = useMutation({
    mutationFn: ({ booking, nextState, holdReason }: LegalHoldTarget & { holdReason: string }) => {
      if (!canExecute) throw new Error('Elevated Workplace management authority required');
      return updateWorkplaceBookingLegalHold(
        booking.bookingId,
        booking.version,
        nextState,
        holdReason,
        WORKPLACE_ADMIN_BOOKING_COMMAND_OPTIONS
      );
    },
    onSuccess: (saved) => {
      queryClient.setQueriesData<WorkplaceAdminBookingPage>(
        { queryKey: ['workplace', 'admin', 'operations', 'bookings'] },
        (current) =>
          current
            ? {
                ...current,
                content: current.content.map((booking) =>
                  booking.bookingId === saved.bookingId ? saved : booking
                ),
              }
            : current
      );
      setTarget(null);
      setReason('');
      toast.success(
        t(
          saved.legalHold
            ? 'workplace.admin.operations.legalHold.applied'
            : 'workplace.admin.operations.legalHold.released'
        )
      );
      void queryClient.invalidateQueries({ queryKey: ['workplace', 'admin', 'operations'] });
    },
    onError: () => {
      toast.error(t('workplace.admin.operations.legalHold.error'));
      void queryClient.invalidateQueries({
        queryKey: ['workplace', 'admin', 'operations', 'bookings'],
      });
    },
  });
  const close = () => {
    if (mutation.isPending) return;
    setTarget(null);
    setReason('');
  };
  const open = (booking: WorkplaceAdminBooking) => {
    if (!canExecute) return;
    setTarget({ booking, nextState: !booking.legalHold });
    setReason('');
  };
  const submit = () => {
    if (canExecute && target && reason.trim()) {
      mutation.mutate({ ...target, holdReason: reason.trim() });
    }
  };
  return { target, reason, setReason, open, close, submit, pending: mutation.isPending };
}

export function WorkplaceLegalHoldDialog({
  control,
  canExecute,
}: {
  control: ReturnType<typeof useWorkplaceLegalHoldControl>;
  canExecute: boolean;
}) {
  const { t } = useTranslation('rooms');
  const { target, reason, setReason, close, submit, pending } = control;
  return (
    <FormDialog
      open={Boolean(target)}
      title={t(
        target?.nextState
          ? 'workplace.admin.operations.legalHold.applyTitle'
          : 'workplace.admin.operations.legalHold.releaseTitle'
      )}
      description={
        target
          ? t('workplace.admin.operations.legalHold.description', {
              resource: target.booking.resourceName,
              user: target.booking.bookedForDisplayName,
            })
          : undefined
      }
      cancelLabel={t('actions.cancel')}
      submitLabel={t(
        target?.nextState
          ? 'workplace.admin.operations.legalHold.apply'
          : 'workplace.admin.operations.legalHold.release'
      )}
      busy={pending}
      submitDisabled={!canExecute || !reason.trim()}
      onClose={close}
      onSubmit={submit}
    >
      <Alert severity="info" sx={{ mb: 2 }}>
        {t('workplace.admin.operations.legalHold.notice')}
      </Alert>
      <FormField
        autoFocus
        required
        multiline
        minRows={4}
        label={t('workplace.admin.operations.legalHold.reason')}
        value={reason}
        inputProps={{ maxLength: 500 }}
        supportingText={t('workplace.admin.operations.legalHold.reasonHint')}
        onChange={(event) => setReason(event.target.value)}
      />
    </FormDialog>
  );
}
