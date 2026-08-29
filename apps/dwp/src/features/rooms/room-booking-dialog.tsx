import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BellRing, Building2, UsersRound } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createRoomBooking,
  getRoomAvailability,
  listPeople,
  resolveIdempotentMutationIntent,
  updateRoomBooking,
  useAuth,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  AutocompleteMultiField,
  DateTimePickerField,
  DwpDateTimeProvider,
  FormDialog,
  FormField,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  DEFAULT_ROOM_POLICY,
  roomDefaultRange,
  validateRoomBookingRange,
} from './room-availability-model';
import { useRoomsCapabilities } from './rooms-capabilities';
import { roomBookingActionPolicy } from './room-booking-action-policy';
import { RoomsPermissionNotice } from './rooms-ui';
import { retryRecoverableWorkplaceRead } from './workplace-authority-failure';
import {
  workplaceBookingInstantMatches,
  workplaceBookingSourceVerified,
  type WorkplaceBookingSourceSnapshot,
} from './workplace-booking-source-snapshot';
import { workplaceHomeSourceState } from './workplace-home-source-state';

import type {
  CalendarEvent,
  CalendarPolicy,
  CalendarResource,
  IdempotentMutationIntent,
  PersonSummary,
} from '@dwp-frontend/shared-utils';

type AttendeeOption = Pick<PersonSummary, 'personId' | 'displayName' | 'workEmail'> & {
  userId?: number | null;
};

type RoomBookingDialogProps = {
  open: boolean;
  room: CalendarResource | null;
  initialStart?: string | null;
  initialEnd?: string | null;
  event?: CalendarEvent | null;
  policy?: CalendarPolicy | null;
  commandSourceReady?: boolean;
  sourceSnapshot?: WorkplaceBookingSourceSnapshot | null;
  onClose: () => void;
  onSaved?: (event: CalendarEvent) => void;
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function RoomBookingDialog({
  open,
  room,
  initialStart,
  initialEnd,
  event,
  policy,
  commandSourceReady = true,
  sourceSnapshot,
  onClose,
  onSaved,
}: RoomBookingDialogProps) {
  const { t, i18n } = useTranslation('rooms');
  const toast = useToast();
  const queryClient = useQueryClient();
  const capabilities = useRoomsCapabilities();
  const auth = useAuth();
  const identityKey = `${auth.user?.tenantId ?? 'anonymous'}:${auth.user?.userId ?? 'anonymous'}`;
  const effectivePolicy = policy ?? DEFAULT_ROOM_POLICY;
  const policyAvailable = Boolean(policy);
  const canSave = event
    ? roomBookingActionPolicy(event, capabilities.canUpdateRoomBooking).canEdit
    : capabilities.canCreateRoomBooking;
  const [title, setTitle] = useState('');
  const [agenda, setAgenda] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [attendees, setAttendees] = useState<AttendeeOption[]>([]);
  const [attendeeQuery, setAttendeeQuery] = useState('');
  const [showValidation, setShowValidation] = useState(false);
  const createIntent = useRef<IdempotentMutationIntent | null>(null);
  const upstreamSourceSnapshotRef = useRef<WorkplaceBookingSourceSnapshot | null | undefined>(
    sourceSnapshot
  );
  const ownerSourceSnapshotRef = useRef<WorkplaceBookingSourceSnapshot | null>(null);
  const upstreamResourceVersionRef = useRef<number | null>(null);
  const ownerResourceVersionRef = useRef<number | null>(null);
  const commandSourceReadyRef = useRef(commandSourceReady);
  commandSourceReadyRef.current = commandSourceReady;
  const deferredAttendeeQuery = useDeferredValue(attendeeQuery.trim());
  const deferredStartsAt = useDeferredValue(startsAt);
  const deferredEndsAt = useDeferredValue(endsAt);

  useEffect(() => {
    if (!open || event) createIntent.current = null;
  }, [event, open]);

  useEffect(() => {
    if (!open) return;
    const fallback = room
      ? roomDefaultRange(room.timeZone, effectivePolicy)
      : roomDefaultRange('UTC', effectivePolicy);
    setTitle(event?.title ?? '');
    setAgenda(event?.description ?? '');
    setStartsAt(event?.startsAt ?? initialStart ?? fallback.startsAt);
    setEndsAt(event?.endsAt ?? initialEnd ?? fallback.endsAt);
    setAttendees(
      event?.attendees.map((attendee) => ({
        personId:
          attendee.personPublicId ??
          (attendee.userId ? `user:${attendee.userId}` : `email:${attendee.email}`),
        displayName: attendee.name,
        workEmail: attendee.email,
        userId: attendee.userId,
      })) ?? []
    );
    setAttendeeQuery('');
    setShowValidation(false);
  }, [effectivePolicy, event, initialEnd, initialStart, open, room]);

  const peopleQuery = useQuery({
    queryKey: ['rooms', 'people-options', identityKey, deferredAttendeeQuery],
    queryFn: () =>
      listPeople({
        query: deferredAttendeeQuery || undefined,
        size: 50,
        surface: 'directory',
      }),
    enabled: open,
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const attendeeOptions = useMemo(() => {
    const values = [
      ...attendees,
      ...(peopleQuery.data?.items ?? [])
        .filter((person) => Boolean(person.workEmail))
        .map<AttendeeOption>((person) => ({
          personId: person.personId,
          displayName: person.displayName,
          workEmail: person.workEmail,
        })),
    ];
    return values.filter(
      (person, index) =>
        values.findIndex((candidate) => candidate.personId === person.personId) === index
    );
  }, [attendees, peopleQuery.data?.items]);
  const ownerRangeReady = Boolean(
    open &&
    room &&
    policy &&
    Number.isFinite(Date.parse(deferredStartsAt)) &&
    Number.isFinite(Date.parse(deferredEndsAt)) &&
    Date.parse(deferredEndsAt) > Date.parse(deferredStartsAt)
  );
  const ownerAvailabilityQuery = useQuery({
    queryKey: [
      'rooms',
      'booking-dialog-availability',
      identityKey,
      room?.resourceId ?? null,
      deferredStartsAt,
      deferredEndsAt,
      event?.eventId ?? null,
    ],
    queryFn: () => getRoomAvailability(deferredStartsAt, deferredEndsAt, event?.eventId ?? null),
    enabled: ownerRangeReady,
    staleTime: 15_000,
    refetchInterval: 60_000,
    retry: retryRecoverableWorkplaceRead,
  });
  const ownerAvailabilityState = workplaceHomeSourceState({
    data: ownerAvailabilityQuery.data,
    error: ownerAvailabilityQuery.error,
    failureCount: ownerAvailabilityQuery.failureCount,
    failureReason: ownerAvailabilityQuery.failureReason,
    isError: ownerAvailabilityQuery.isError,
    isPending: ownerAvailabilityQuery.isPending,
    required: open,
  });
  const verifiedOwnerRoom =
    ownerAvailabilityQuery.data?.rooms.find(
      (candidate) => candidate.resourceId === room?.resourceId
    ) ?? null;
  const ownerEligibilityDecision = ownerAvailabilityQuery.data?.bookingEligibility?.find(
    (candidate) =>
      candidate.resourceId === verifiedOwnerRoom?.resourceId &&
      candidate.resourceVersion === verifiedOwnerRoom?.version &&
      workplaceBookingInstantMatches(candidate.evaluatedFrom, startsAt) &&
      workplaceBookingInstantMatches(candidate.evaluatedTo, endsAt) &&
      candidate.excludedEventId === (event?.eventId ?? null) &&
      candidate.policyVersion === policy?.version &&
      workplaceBookingInstantMatches(
        candidate.evaluatedAt,
        ownerAvailabilityQuery.data?.generatedAt
      )
  );
  const verifiedOwnerEligibility =
    ownerEligibilityDecision?.eligible && ownerEligibilityDecision.reasonCode === 'ELIGIBLE'
      ? ownerEligibilityDecision
      : null;
  const ownerSourceSnapshot =
    verifiedOwnerRoom &&
    verifiedOwnerEligibility &&
    policy &&
    ownerAvailabilityState === 'READY' &&
    deferredStartsAt === startsAt &&
    deferredEndsAt === endsAt
      ? {
          identityKey,
          resourceId: verifiedOwnerRoom.resourceId,
          resourceVersion: verifiedOwnerRoom.version,
          rangeFrom: startsAt,
          rangeTo: endsAt,
          generatedAt: verifiedOwnerEligibility.evaluatedAt,
          policyVersion: policy.version,
          bookingEligibility: {
            evaluatedAt: verifiedOwnerEligibility.evaluatedAt,
            excludedEventId: verifiedOwnerEligibility.excludedEventId,
          },
        }
      : null;
  upstreamSourceSnapshotRef.current = sourceSnapshot;
  ownerSourceSnapshotRef.current = ownerSourceSnapshot;
  upstreamResourceVersionRef.current = sourceSnapshot?.resourceVersion ?? room?.version ?? null;
  ownerResourceVersionRef.current = verifiedOwnerRoom?.version ?? null;
  const validationGeneratedAt = ownerSourceSnapshot?.generatedAt ?? sourceSnapshot?.generatedAt;
  const rangeError =
    room && startsAt && endsAt
      ? validateRoomBookingRange(
          startsAt,
          endsAt,
          room.timeZone,
          effectivePolicy,
          validationGeneratedAt
        )
      : 'invalid';
  const valid = Boolean(room && title.trim() && !rangeError);
  const sourceRangeChanged = Boolean(
    sourceSnapshot && (sourceSnapshot.rangeFrom !== startsAt || sourceSnapshot.rangeTo !== endsAt)
  );
  const sourceVerifying = Boolean(
    deferredStartsAt !== startsAt ||
    deferredEndsAt !== endsAt ||
    ownerAvailabilityState === 'LOADING' ||
    ownerAvailabilityQuery.isFetching
  );
  const eligibilityMessageKey =
    ownerAvailabilityState === 'READY' && ownerEligibilityDecision && !verifiedOwnerEligibility
      ? ownerEligibilityDecision.reasonCode === 'RESOURCE_CONFLICT'
        ? 'find.eligibilityConflict'
        : ownerEligibilityDecision.reasonCode === 'POLICY_BLOCKED'
          ? 'find.eligibilityPolicyBlocked'
          : 'find.eligibilityResourceUnavailable'
      : null;
  const upstreamSourceVerified = workplaceBookingSourceVerified(sourceSnapshot, {
    resourceId: room?.resourceId,
    resourceVersion: sourceSnapshot?.resourceVersion ?? room?.version,
    rangeFrom: startsAt,
    rangeTo: endsAt,
    policyVersion: policy?.version,
  });
  const ownerSourceVerified = workplaceBookingSourceVerified(ownerSourceSnapshot, {
    resourceId: room?.resourceId,
    resourceVersion: verifiedOwnerRoom?.version,
    rangeFrom: startsAt,
    rangeTo: endsAt,
    policyVersion: policy?.version,
    requireBookingEligibility: true,
    excludedEventId: event?.eventId ?? null,
  });
  const sourceVerified = commandSourceReady && upstreamSourceVerified && ownerSourceVerified;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!room) throw new Error(t('booking.roomRequired'));
      if (
        !commandSourceReadyRef.current ||
        !workplaceBookingSourceVerified(upstreamSourceSnapshotRef.current, {
          resourceId: room.resourceId,
          resourceVersion: upstreamResourceVersionRef.current,
          rangeFrom: startsAt,
          rangeTo: endsAt,
          policyVersion: policy?.version,
        }) ||
        !workplaceBookingSourceVerified(ownerSourceSnapshotRef.current, {
          resourceId: room.resourceId,
          resourceVersion: ownerResourceVersionRef.current,
          rangeFrom: startsAt,
          rangeTo: endsAt,
          policyVersion: policy?.version,
          requireBookingEligibility: true,
          excludedEventId: event?.eventId ?? null,
        })
      ) {
        throw new Error(t('find.availabilityStale'));
      }
      if (!policyAvailable) throw new Error(t('booking.policyUnavailable'));
      if (!canSave) throw new Error(t('permissions.roomBookingReadOnly'));
      const attendeeInput = attendees
        .filter((person) => person.workEmail)
        .map((person) => ({
          userId: person.userId,
          personPublicId:
            person.personId.startsWith('user:') || person.personId.startsWith('email:')
              ? null
              : person.personId,
          email: person.workEmail!,
          name: person.displayName,
          type: 'REQUIRED' as const,
        }));
      const input = {
        title: title.trim(),
        description: agenda.trim() || null,
        type: 'MEETING' as const,
        startsAt,
        endsAt,
        timeZone: room.timeZone,
        allDay: false,
        location: room.name,
        conferenceUrl: null,
        visibility: 'DEFAULT' as const,
        recurrence: 'NONE' as const,
        recurrenceInterval: 1,
        recurrenceUntil: null,
        responseRequired: attendeeInput.length > 0,
        attendees: attendeeInput,
        resourceId: room.resourceId,
      };
      if (event) return updateRoomBooking(event.eventId, { ...input, version: event.version });
      const intent = resolveIdempotentMutationIntent(createIntent.current, input);
      createIntent.current = intent;
      return createRoomBooking({ ...input, idempotencyKey: intent.key });
    },
    onSuccess: async (saved) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['rooms'] }),
        queryClient.invalidateQueries({ queryKey: ['calendar'] }),
      ]);
      toast.success(t(event ? 'booking.updated' : 'booking.created'));
      createIntent.current = null;
      onSaved?.(saved);
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, t('booking.saveError'))),
  });

  useEffect(() => {
    if (ownerAvailabilityState === 'DENIED') onClose();
  }, [onClose, ownerAvailabilityState]);

  return (
    <FormDialog
      open={open}
      title={t(event ? 'booking.editTitle' : 'booking.createTitle')}
      description={t('booking.description')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t(event ? 'actions.save' : 'actions.book')}
      submittingLabel={t('actions.saving')}
      busy={mutation.isPending}
      submitDisabled={!valid || !canSave || !policyAvailable || !sourceVerified}
      onClose={onClose}
      onSubmit={() => {
        if (!valid) {
          setShowValidation(true);
          return;
        }
        mutation.mutate();
      }}
      maxWidth="md"
    >
      <Stack spacing={2.25}>
        {!canSave && (
          <RoomsPermissionNotice>
            {t(event ? 'permissions.roomUpdateReadOnly' : 'permissions.roomBookingReadOnly')}
          </RoomsPermissionNotice>
        )}
        {!sourceVerified && (
          <Alert severity={sourceVerifying ? 'info' : 'warning'}>
            {t(
              sourceVerifying
                ? 'find.availabilityVerifying'
                : (eligibilityMessageKey ??
                    (sourceRangeChanged ? 'find.rangeChanged' : 'find.availabilityStale'))
            )}
          </Alert>
        )}
        {!policyAvailable && <Alert severity="error">{t('booking.policyUnavailable')}</Alert>}
        {room && (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
            gap={1}
            sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}
          >
            <Stack direction="row" gap={1} alignItems="center">
              <Building2 size={19} color="var(--dwp-product-accent)" />
              <Box>
                <Typography fontWeight={750}>{room.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {[room.site, room.floor, `${room.capacity}${t('units.people')}`]
                    .filter(Boolean)
                    .join(' · ')}
                </Typography>
              </Box>
            </Stack>
            {room.approvalRequired && (
              <Chip size="small" color="warning" variant="outlined" label={t('booking.approval')} />
            )}
          </Stack>
        )}
        <FormField
          autoFocus
          required
          label={t('booking.subject')}
          value={title}
          onChange={(change) => setTitle(change.target.value)}
          errorMessage={showValidation && !title.trim() ? t('booking.subjectRequired') : undefined}
          inputProps={{ maxLength: 240 }}
        />
        <DwpDateTimeProvider locale={i18n.resolvedLanguage} timeZone={room?.timeZone}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
            <DateTimePickerField
              required
              label={t('booking.start')}
              value={startsAt}
              onValueChange={(value) => value && setStartsAt(value)}
              supportingText={room?.timeZone}
            />
            <DateTimePickerField
              required
              label={t('booking.end')}
              value={endsAt}
              onValueChange={(value) => value && setEndsAt(value)}
              errorMessage={
                showValidation && rangeError ? t(`booking.rangeErrors.${rangeError}`) : undefined
              }
            />
          </Box>
        </DwpDateTimeProvider>
        <FormField
          multiline
          minRows={3}
          label={t('booking.agenda')}
          value={agenda}
          onChange={(change) => setAgenda(change.target.value)}
          inputProps={{ maxLength: 4000 }}
        />
        <AutocompleteMultiField
          multiple
          options={attendeeOptions}
          value={attendees}
          onChange={(_, value) => setAttendees(value)}
          onInputChange={(_, value, reason) => {
            if (reason === 'input') setAttendeeQuery(value);
          }}
          filterOptions={(options) => options}
          loading={peopleQuery.isLoading}
          getOptionLabel={(person) => `${person.displayName} · ${person.workEmail ?? ''}`}
          isOptionEqualToValue={(option, value) => option.personId === value.personId}
          renderTags={(values, getTagProps) =>
            values.map((person, index) => (
              <Chip
                {...getTagProps({ index })}
                key={person.personId}
                size="small"
                label={person.displayName}
              />
            ))
          }
          label={t('booking.attendees')}
          textFieldProps={{
            placeholder: attendees.length ? undefined : t('booking.attendeesPlaceholder'),
            InputProps: { startAdornment: <UsersRound size={17} /> },
          }}
        />
        <Alert severity="info" icon={<BellRing size={18} />}>
          {t('booking.invitationNotice')}
        </Alert>
      </Stack>
    </FormDialog>
  );
}
