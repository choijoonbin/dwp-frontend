import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BellRing, Building2, UsersRound } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createRoomBooking,
  listPeople,
  updateRoomBooking,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  AutocompleteMultiField,
  DateTimePickerField,
  FormDialog,
  FormField,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { CalendarEvent, CalendarResource, PersonSummary } from '@dwp-frontend/shared-utils';

type AttendeeOption = Pick<PersonSummary, 'personId' | 'displayName' | 'workEmail'> & {
  userId?: number | null;
};

type RoomBookingDialogProps = {
  open: boolean;
  room: CalendarResource | null;
  initialStart?: string | null;
  initialEnd?: string | null;
  event?: CalendarEvent | null;
  onClose: () => void;
  onSaved?: (event: CalendarEvent) => void;
};

function defaultStart() {
  const value = new Date();
  value.setSeconds(0, 0);
  value.setMinutes(value.getMinutes() < 30 ? 30 : 60);
  return value;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function RoomBookingDialog({
  open,
  room,
  initialStart,
  initialEnd,
  event,
  onClose,
  onSaved,
}: RoomBookingDialogProps) {
  const { t } = useTranslation('rooms');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [agenda, setAgenda] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [attendees, setAttendees] = useState<AttendeeOption[]>([]);
  const [showValidation, setShowValidation] = useState(false);

  useEffect(() => {
    if (!open) return;
    const start = initialStart ? new Date(initialStart) : defaultStart();
    const end = initialEnd ? new Date(initialEnd) : new Date(start.getTime() + 30 * 60_000);
    setTitle(event?.title ?? '');
    setAgenda(event?.description ?? '');
    setStartsAt(event?.startsAt ?? start.toISOString());
    setEndsAt(event?.endsAt ?? end.toISOString());
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
    setShowValidation(false);
  }, [event, initialEnd, initialStart, open]);

  const peopleQuery = useQuery({
    queryKey: ['rooms', 'people-options'],
    queryFn: () => listPeople({ size: 100, surface: 'directory' }),
    enabled: open,
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const attendeeOptions = useMemo(
    () =>
      (peopleQuery.data?.items ?? [])
        .filter((person) => Boolean(person.workEmail))
        .map<AttendeeOption>((person) => ({
          personId: person.personId,
          displayName: person.displayName,
          workEmail: person.workEmail,
        })),
    [peopleQuery.data?.items]
  );
  const rangeInvalid = !startsAt || !endsAt || Date.parse(endsAt) <= Date.parse(startsAt);
  const valid = Boolean(room && title.trim() && !rangeInvalid);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!room) throw new Error(t('booking.roomRequired'));
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
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || room.timeZone,
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
      return event
        ? updateRoomBooking(event.eventId, { ...input, version: event.version })
        : createRoomBooking({ ...input, idempotencyKey: crypto.randomUUID() });
    },
    onSuccess: async (saved) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['rooms'] }),
        queryClient.invalidateQueries({ queryKey: ['calendar'] }),
      ]);
      toast.success(t(event ? 'booking.updated' : 'booking.created'));
      onSaved?.(saved);
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, t('booking.saveError'))),
  });

  return (
    <FormDialog
      open={open}
      title={t(event ? 'booking.editTitle' : 'booking.createTitle')}
      description={t('booking.description')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t(event ? 'actions.save' : 'actions.book')}
      submittingLabel={t('actions.saving')}
      busy={mutation.isPending}
      submitDisabled={!valid}
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
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
          <DateTimePickerField
            required
            label={t('booking.start')}
            value={startsAt}
            onValueChange={(value) => value && setStartsAt(value)}
          />
          <DateTimePickerField
            required
            label={t('booking.end')}
            value={endsAt}
            onValueChange={(value) => value && setEndsAt(value)}
            errorMessage={showValidation && rangeInvalid ? t('booking.rangeError') : undefined}
          />
        </Box>
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
