import { useWorkplaceExperienceAuthority } from './workplace-experience-authority';
import { LoadingState } from '@dwp-frontend/design-system';
import { foundationTokens } from '@dwp-frontend/design-system';
import { InlineFeedback } from '@dwp-frontend/design-system';
import { formatWorkplaceExperienceInstant } from './workplace-experience-format';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionButton, EmptyState, FormDialog, FormField } from '@dwp-frontend/design-system';
import {
  forceCancelWorkplaceBooking,
  getWorkplaceExperienceBookingDetail,
  getWorkplaceFutureBookingImpact,
  HttpError,
} from '@dwp-frontend/shared-utils';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useRoomsCapabilities } from './rooms-capabilities';
import { retryRecoverableWorkplaceRead } from './workplace-authority-failure';
import { WorkplaceExperiencePanel, WorkplaceExperienceQueryError } from './workplace-experience-ui';

export function WorkplaceExperienceFutureImpact({
  siteId,
  resourceId,
  from,
  to,
  timeZone,
}: {
  siteId: string;
  resourceId: string;
  from: string;
  to: string;
  timeZone?: string;
}) {
  const { t } = useTranslation('rooms');
  const authorityKey = useWorkplaceExperienceAuthority();
  const capabilities = useRoomsCapabilities();
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [siteId, resourceId, from, to]);
  const query = useQuery({
    queryKey: [
      'workplace',
      'experience',
      authorityKey,
      'future-impact',
      siteId,
      resourceId,
      from,
      to,
      page,
    ],
    queryFn: () => getWorkplaceFutureBookingImpact(siteId, resourceId, from, to, page),
    enabled: capabilities.isLoaded && capabilities.canViewWorkplaceAdmin,
    staleTime: 0,
    retry: retryRecoverableWorkplaceRead,
  });
  const data =
    !query.isError && capabilities.isLoaded && capabilities.canViewWorkplaceAdmin
      ? query.data
      : undefined;
  return (
    <WorkplaceExperiencePanel
      title={t('workplace.experience.futureImpact')}
      description={t('workplace.experience.impactReadOnly')}
    >
      {query.isLoading ? (
        <LoadingState
          variant="skeleton"
          embedded
          skeletonRows={1}
          skeletonHeight={120}
          label={t('workplace.experience.refreshing')}
        />
      ) : query.isError ? (
        <WorkplaceExperienceQueryError retry={() => void query.refetch()} />
      ) : data ? (
        <Stack gap={1}>
          {!data.affectedBookings ? (
            <InlineFeedback severity="info">
              {t('workplace.experience.roomsImpactNotice')}
            </InlineFeedback>
          ) : (
            <>
              <Typography fontWeight={(theme) => theme.typography.fontWeightBold}>
                {t('workplace.experience.affectedCount', {
                  count: data.affectedBookings.totalElements,
                })}
              </Typography>
              {data.affectedBookings.content.map((booking) => (
                <Stack
                  key={booking.bookingId}
                  gap={0.25}
                  sx={{
                    p: 1,
                    bgcolor: 'var(--dwp-product-soft)',
                    borderRadius: foundationTokens.radius.control + 'px',
                  }}
                >
                  <Typography
                    variant="body2"
                    fontWeight={(theme) => theme.typography.fontWeightBold}
                  >
                    {booking.resourceName}
                  </Typography>
                  <Typography variant="caption">
                    {formatWorkplaceExperienceInstant(booking.startsAt, timeZone)} –{' '}
                    {formatWorkplaceExperienceInstant(booking.endsAt, timeZone)}
                  </Typography>
                  <Chip
                    size="small"
                    variant="outlined"
                    label={t(`workplace.bookingStatus.${booking.status}`)}
                    sx={{ alignSelf: 'start' }}
                  />
                </Stack>
              ))}
              <Stack direction="row" justifyContent="space-between" gap={1}>
                <ActionButton
                  intent="quiet"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  {t('workplace.experience.previous')}
                </ActionButton>
                <ActionButton
                  intent="quiet"
                  disabled={page + 1 >= data.affectedBookings.totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  {t('workplace.experience.next')}
                </ActionButton>
              </Stack>
            </>
          )}
        </Stack>
      ) : null}
    </WorkplaceExperiencePanel>
  );
}

type CancellationCommand = {
  identity: string;
  generation: number;
  bookingId: string;
  version: number;
  reason: string;
};

export function WorkplaceExperienceBookingInspector({
  siteId,
  bookingId,
  onClose,
  timeZone,
}: {
  siteId: string;
  bookingId: string | null;
  onClose: () => void;
  timeZone?: string;
}) {
  const { t } = useTranslation('rooms');
  const authorityKey = useWorkplaceExperienceAuthority();
  const capabilities = useRoomsCapabilities();
  const queryClient = useQueryClient();
  const identity = `${authorityKey}:${siteId}:${bookingId}`;
  const activeIdentity = useRef(identity);
  activeIdentity.current = identity;
  const commandContext = useRef({ identity, generation: 0 });
  if (commandContext.current.identity !== identity)
    commandContext.current = { identity, generation: commandContext.current.generation + 1 };
  const inFlight = useRef<CancellationCommand | null>(null);
  const impactRange = useMemo(
    () => ({
      from: new Date().toISOString(),
      to: new Date(Date.now() + 30 * 86400000).toISOString(),
    }),
    []
  );
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [outcome, setOutcome] = useState<'conflict' | 'unknown' | 'denied' | null>(null);
  const query = useQuery({
    queryKey: ['workplace', 'experience', identity, 'booking-detail'],
    queryFn: () => getWorkplaceExperienceBookingDetail(siteId, bookingId!),
    enabled: Boolean(bookingId) && capabilities.isLoaded && capabilities.canViewWorkplaceAdmin,
    staleTime: 0,
    refetchInterval: bookingId ? 15_000 : false,
    retry: retryRecoverableWorkplaceRead,
  });
  const booking =
    !query.isError && capabilities.isLoaded && capabilities.canViewWorkplaceAdmin
      ? query.data
      : undefined;
  useEffect(() => {
    setReason('');
    setConfirmed(false);
    setOutcome(null);
  }, [identity]);
  useEffect(() => setConfirmed(false), [booking?.version]);
  const mutable = Boolean(booking && ['RESERVED', 'CHECKED_IN'].includes(booking.status));
  const ready =
    mutable &&
    capabilities.canManageWorkplaceAdmin &&
    !query.isFetching &&
    !query.isError &&
    !outcome &&
    confirmed &&
    Boolean(reason.trim());
  const matchesCommand = (command: CancellationCommand) =>
    command.identity === activeIdentity.current &&
    command.generation === commandContext.current.generation;
  const mutation = useMutation({
    mutationFn: async (command: CancellationCommand) => {
      if (!matchesCommand(command) || !ready || !booking || !capabilities.canViewWorkplaceAdmin)
        throw new Error('Booking decision is not current');
      await forceCancelWorkplaceBooking(command.bookingId, command.version, command.reason);
    },
    onSuccess: async (_result, command) => {
      if (!matchesCommand(command)) return;
      await queryClient.invalidateQueries({ queryKey: ['workplace'] });
      if (matchesCommand(command)) onClose();
    },
    onError: (error, command) => {
      if (!matchesCommand(command)) return;
      setConfirmed(false);
      setOutcome(
        error instanceof HttpError && error.status === 409
          ? 'conflict'
          : error instanceof HttpError && [401, 403].includes(error.status)
            ? 'denied'
            : 'unknown'
      );
    },
    onSettled: (_data, _error, command) => {
      if (inFlight.current === command) inFlight.current = null;
    },
  });
  const resetMutation = mutation.reset;
  useEffect(() => resetMutation(), [identity, resetMutation]);
  const submit = () => {
    if (inFlight.current || !ready || !booking) return;
    const command = {
      identity,
      generation: commandContext.current.generation,
      bookingId: booking.bookingId,
      version: booking.version,
      reason: reason.trim(),
    };
    inFlight.current = command;
    mutation.mutate(command);
  };
  return (
    <FormDialog
      open={Boolean(bookingId) && capabilities.canViewWorkplaceAdmin}
      title={t('workplace.experience.bookingReview')}
      cancelLabel={t('actions.close')}
      submitLabel={t('workplace.admin.operations.forceCancel.submit')}
      submittingLabel={t('actions.cancelling')}
      showSubmit={capabilities.canManageWorkplaceAdmin && mutable}
      submitIntent="danger"
      submitDisabled={!ready}
      busy={mutation.isPending}
      onClose={onClose}
      onSubmit={submit}
      maxWidth="md"
      mobileFullScreen
    >
      {query.isLoading ? (
        <LoadingState
          variant="skeleton"
          embedded
          skeletonRows={1}
          skeletonHeight={240}
          label={t('workplace.experience.refreshing')}
        />
      ) : query.isError ? (
        <WorkplaceExperienceQueryError retry={() => void query.refetch()} />
      ) : booking ? (
        <Stack gap={2}>
          <Box
            sx={{
              p: 1.5,
              bgcolor: 'var(--dwp-product-soft)',
              borderRadius: foundationTokens.radius.control + 'px',
            }}
          >
            <Typography variant="h6" fontWeight={(theme) => theme.typography.fontWeightBold}>
              {booking.resourceName}
            </Typography>
            <Typography variant="body2">{booking.floorName}</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              {formatWorkplaceExperienceInstant(booking.startsAt, timeZone)} –{' '}
              {formatWorkplaceExperienceInstant(booking.endsAt, timeZone)}
            </Typography>
            <Stack direction="row" gap={1} sx={{ mt: 1 }}>
              <Chip
                size="small"
                variant="outlined"
                label={t(`workplace.bookingStatus.${booking.status}`)}
              />
              {booking.legalHold ? (
                <Chip size="small" color="warning" label={t('workplace.experience.legalHold')} />
              ) : null}
            </Stack>
          </Box>
          <WorkplaceExperienceFutureImpact
            siteId={siteId}
            resourceId={booking.resourceId}
            from={impactRange.from}
            to={impactRange.to}
            timeZone={timeZone}
          />
          {capabilities.canManageWorkplaceAdmin && mutable ? (
            <>
              <InlineFeedback severity="warning">
                {t('workplace.admin.operations.forceCancel.warning')}
              </InlineFeedback>
              <FormField
                required
                multiline
                minRows={3}
                label={t('workplace.experience.reason')}
                value={reason}
                disabled={mutation.isPending || outcome === 'denied'}
                inputProps={{ maxLength: 1000 }}
                onChange={(event) => {
                  setReason(event.target.value);
                  setConfirmed(false);
                }}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={confirmed}
                    disabled={mutation.isPending || Boolean(outcome)}
                    onChange={(event) => setConfirmed(event.target.checked)}
                  />
                }
                label={t('workplace.experience.confirmImpact')}
              />
            </>
          ) : (
            <InlineFeedback severity="info">{t('workplace.experience.readOnly')}</InlineFeedback>
          )}
          {outcome ? (
            <InlineFeedback
              severity="error"
              action={
                outcome === 'denied' ? undefined : (
                  <ActionButton
                    intent="secondary"
                    onClick={async () => {
                      const generation = commandContext.current.generation;
                      const result = await query.refetch();
                      if (
                        activeIdentity.current === identity &&
                        generation === commandContext.current.generation &&
                        result.isSuccess
                      ) {
                        setOutcome(null);
                        setConfirmed(false);
                        mutation.reset();
                      }
                    }}
                  >
                    {t('workplace.experience.recheck')}
                  </ActionButton>
                )
              }
            >
              {t(
                `workplace.experience.${outcome === 'conflict' ? 'conflict' : outcome === 'denied' ? 'permissionChanged' : 'changeUnknown'}`
              )}
            </InlineFeedback>
          ) : null}
        </Stack>
      ) : (
        <EmptyState title={t('workplace.experience.unavailable')} />
      )}
    </FormDialog>
  );
}
