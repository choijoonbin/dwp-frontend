import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Clock3, Focus, ListTodo, UsersRound } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createCalendarEvent,
  getCalendarResources,
  listPeople,
  updateCalendarEvent,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  AutocompleteMultiField,
  DatePickerField,
  DateTimePickerField,
  FormDialog,
  FormField,
  SelectField,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import type {
  CalendarEvent,
  CalendarEventType,
  CalendarRecurrence,
  CalendarVisibility,
  PersonSummary,
} from '@dwp-frontend/shared-utils';

type CalendarEventDialogProps = {
  open: boolean;
  event?: CalendarEvent | null;
  initialStart?: string | null;
  initialEnd?: string | null;
  initialType?: CalendarEventType;
  initialTitle?: string | null;
  initialResourceId?: string | null;
  initialAttendees?: PersonSummary[];
  initialAttendeeEmails?: string[];
  fromDwaion?: boolean;
  onClose: () => void;
  onSaved?: (event: CalendarEvent) => void;
};

type FormState = {
  title: string;
  description: string;
  type: CalendarEventType;
  startsAt: string;
  endsAt: string;
  location: string;
  conferenceUrl: string;
  visibility: CalendarVisibility;
  recurrence: CalendarRecurrence;
  recurrenceUntil: string;
  responseRequired: boolean;
  resourceId: string;
};

type AttendeeOption = Pick<PersonSummary, 'personId' | 'displayName' | 'workEmail'> & {
  userId?: number | null;
};

const EMPTY_ATTENDEES: PersonSummary[] = [];
const EMPTY_EMAILS: string[] = [];

function roundToHalfHour(value = new Date()) {
  const next = new Date(value);
  next.setSeconds(0, 0);
  const minutes = next.getMinutes();
  next.setMinutes(minutes < 30 ? 30 : 60);
  return next;
}

function initialState(
  event?: CalendarEvent | null,
  initialStart?: string | null,
  initialEnd?: string | null,
  initialType: CalendarEventType = 'MEETING',
  initialTitle?: string | null
): FormState {
  const start = initialStart ? new Date(initialStart) : roundToHalfHour();
  const end = initialEnd
    ? new Date(initialEnd)
    : new Date(start.getTime() + (initialType === 'FOCUS' ? 90 : 30) * 60_000);
  return {
    title: event?.title ?? initialTitle ?? '',
    description: event?.description ?? '',
    type: event?.type ?? initialType,
    startsAt: event?.startsAt ?? start.toISOString(),
    endsAt: event?.endsAt ?? end.toISOString(),
    location: event?.location ?? '',
    conferenceUrl: event?.conferenceUrl ?? '',
    visibility: event?.visibility ?? 'DEFAULT',
    recurrence: event?.recurrence ?? 'NONE',
    recurrenceUntil: event?.recurrenceUntil ?? '',
    responseRequired: event?.responseRequired ?? true,
    resourceId: event?.resource?.resourceId ?? '',
  };
}

function message(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function CalendarEventDialog({
  open,
  event,
  initialStart,
  initialEnd,
  initialType = 'MEETING',
  initialTitle,
  initialResourceId,
  initialAttendees = EMPTY_ATTENDEES,
  initialAttendeeEmails = EMPTY_EMAILS,
  fromDwaion = false,
  onClose,
  onSaved,
}: CalendarEventDialogProps) {
  const { t } = useTranslation('calendar');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(() =>
    initialState(event, initialStart, initialEnd, initialType, initialTitle)
  );
  const [attendees, setAttendees] = useState<AttendeeOption[]>([]);
  const [validationVisible, setValidationVisible] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      ...initialState(event, initialStart, initialEnd, initialType),
      title: event?.title ?? initialTitle ?? '',
      resourceId: event?.resource?.resourceId ?? initialResourceId ?? '',
    });
    setAttendees(
      event
        ? event.attendees.map((attendee) => ({
            personId:
              attendee.personPublicId ??
              (attendee.userId ? `user:${attendee.userId}` : `email:${attendee.email}`),
            displayName: attendee.name,
            workEmail: attendee.email,
            userId: attendee.userId,
          }))
        : [
            ...initialAttendees,
            ...initialAttendeeEmails.map((email) => ({
              personId: `email:${email}`,
              displayName: email,
              workEmail: email,
            })),
          ]
    );
    setValidationVisible(false);
  }, [
    event,
    initialAttendeeEmails,
    initialAttendees,
    initialEnd,
    initialResourceId,
    initialStart,
    initialTitle,
    initialType,
    open,
  ]);

  const peopleQuery = useQuery({
    queryKey: ['calendar', 'people-options'],
    queryFn: () => listPeople({ size: 100, surface: 'directory' }),
    enabled: open,
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const resourceRangeValid = Boolean(
    form.startsAt && form.endsAt && new Date(form.endsAt) > new Date(form.startsAt)
  );
  const resourcesQuery = useQuery({
    queryKey: ['calendar', 'resources', form.startsAt, form.endsAt],
    queryFn: () => getCalendarResources(form.startsAt, form.endsAt),
    enabled: open && resourceRangeValid,
    staleTime: 15_000,
    retry: 1,
  });

  const typeOptions = useMemo(
    () =>
      [
        { value: 'MEETING' as const, label: t('event.types.MEETING'), icon: UsersRound },
        { value: 'FOCUS' as const, label: t('event.types.FOCUS'), icon: Focus },
        { value: 'TASK' as const, label: t('event.types.TASK'), icon: ListTodo },
        { value: 'OUT_OF_OFFICE' as const, label: t('event.types.OUT_OF_OFFICE'), icon: Clock3 },
      ] as const,
    [t]
  );
  const start = new Date(form.startsAt);
  const end = new Date(form.endsAt);
  const rangeError = !form.startsAt || !form.endsAt || end <= start;
  const resourceRecurrenceError = Boolean(
    form.resourceId && form.recurrence !== 'NONE' && !form.recurrenceUntil
  );
  const valid = Boolean(form.title.trim() && !rangeError && !resourceRecurrenceError);

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

  const mutation = useMutation({
    mutationFn: async () => {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul';
      if (event) {
        return updateCalendarEvent(event.eventId, {
          title: form.title.trim(),
          description: form.description.trim() || null,
          type: form.type,
          startsAt: form.startsAt,
          endsAt: form.endsAt,
          timeZone,
          allDay: false,
          location: form.location.trim() || null,
          conferenceUrl: form.conferenceUrl.trim() || null,
          visibility: form.visibility,
          recurrence: form.recurrence,
          recurrenceInterval: 1,
          recurrenceUntil: form.recurrence === 'NONE' ? null : form.recurrenceUntil || null,
          responseRequired: form.responseRequired,
          attendees: attendeeInput,
          resourceId: form.resourceId || null,
          version: event.version,
        });
      }
      return createCalendarEvent({
        title: form.title.trim(),
        description: form.description.trim() || null,
        type: form.type,
        startsAt: form.startsAt,
        endsAt: form.endsAt,
        timeZone,
        allDay: false,
        location: form.location.trim() || null,
        conferenceUrl: form.conferenceUrl.trim() || null,
        visibility: form.visibility,
        recurrence: form.recurrence,
        recurrenceInterval: 1,
        recurrenceUntil: form.recurrence === 'NONE' ? null : form.recurrenceUntil || null,
        responseRequired: form.responseRequired,
        attendees: attendeeInput,
        resourceId: form.resourceId || null,
        idempotencyKey: crypto.randomUUID(),
      });
    },
    onSuccess: async (saved) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['calendar'] }),
        queryClient.invalidateQueries({ queryKey: ['workspace', 'apps'] }),
      ]);
      toast.success(t(event ? 'event.updated' : 'event.created'));
      onSaved?.(saved);
      onClose();
    },
    onError: (error) => toast.error(message(error, t('event.saveError'))),
  });

  const submit = () => {
    if (!valid) {
      setValidationVisible(true);
      return;
    }
    mutation.mutate();
  };

  return (
    <FormDialog
      open={open}
      title={t(event ? 'event.editTitle' : 'event.createTitle')}
      description={t(event ? 'event.editDescription' : 'event.createDescription')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t(event ? 'actions.save' : 'actions.create')}
      submittingLabel={t('actions.saving')}
      onClose={onClose}
      onSubmit={submit}
      busy={mutation.isPending}
      submitDisabled={!valid}
      maxWidth="md"
    >
      <Stack spacing={2.25}>
        {fromDwaion && <Alert severity="info">{t('event.dwaionDraftNotice')}</Alert>}
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ mb: 0.75 }}>
            {t('event.typeLabel')}
          </Typography>
          <ToggleButtonGroup
            exclusive
            fullWidth
            value={form.type}
            onChange={(_, value: CalendarEventType | null) => {
              if (value) setForm((current) => ({ ...current, type: value }));
            }}
            size="small"
          >
            {typeOptions.map((option) => {
              const Icon = option.icon;
              return (
                <ToggleButton
                  key={option.value}
                  value={option.value}
                  sx={{ gap: 0.75, minHeight: 42 }}
                >
                  <Icon size={16} aria-hidden="true" />
                  {option.label}
                </ToggleButton>
              );
            })}
          </ToggleButtonGroup>
        </Box>
        <FormField
          autoFocus
          required
          label={t('event.titleLabel')}
          value={form.title}
          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
          errorMessage={
            validationVisible && !form.title.trim() ? t('event.titleRequired') : undefined
          }
          inputProps={{ maxLength: 240 }}
        />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
          <DateTimePickerField
            required
            label={t('event.startLabel')}
            value={form.startsAt}
            onValueChange={(value) =>
              value && setForm((current) => ({ ...current, startsAt: value }))
            }
          />
          <DateTimePickerField
            required
            label={t('event.endLabel')}
            value={form.endsAt}
            onValueChange={(value) =>
              value && setForm((current) => ({ ...current, endsAt: value }))
            }
            errorMessage={validationVisible && rangeError ? t('event.rangeError') : undefined}
          />
        </Box>
        <FormField
          multiline
          minRows={3}
          label={t(form.type === 'MEETING' ? 'event.agendaLabel' : 'event.descriptionLabel')}
          value={form.description}
          onChange={(event) =>
            setForm((current) => ({ ...current, description: event.target.value }))
          }
          supportingText={form.type === 'MEETING' ? t('event.agendaHint') : undefined}
          inputProps={{ maxLength: 4000 }}
        />
        <AutocompleteMultiField
          multiple
          options={(peopleQuery.data?.items ?? [])
            .filter((person) => Boolean(person.workEmail))
            .map<AttendeeOption>((person) => ({
              personId: person.personId,
              displayName: person.displayName,
              workEmail: person.workEmail,
            }))}
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
          label={t('event.attendeesLabel')}
          textFieldProps={{
            placeholder: attendees.length ? undefined : t('event.attendeesPlaceholder'),
          }}
        />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
          <FormField
            label={t('event.locationLabel')}
            value={form.location}
            onChange={(event) =>
              setForm((current) => ({ ...current, location: event.target.value }))
            }
            inputProps={{ maxLength: 240 }}
          />
          <SelectField
            label={t('event.resourceLabel')}
            value={form.resourceId}
            options={[
              { value: '', label: t('event.noResource') },
              ...(resourcesQuery.data ?? []).map((resource) => ({
                value: resource.resourceId,
                label: `${resource.name} · ${resource.capacity}${t('resources.peopleUnit')}`,
                disabled:
                  resource.state !== 'AVAILABLE' ||
                  (!resource.available && resource.resourceId !== event?.resource?.resourceId),
              })),
            ]}
            onValueChange={(value) => {
              const resource = resourcesQuery.data?.find((item) => item.resourceId === value);
              setForm((current) => ({
                ...current,
                resourceId: String(value),
                location: resource?.name ?? current.location,
              }));
            }}
            InputProps={{ startAdornment: <Building2 size={17} /> }}
          />
        </Box>
        <FormField
          label={t('event.conferenceLabel')}
          value={form.conferenceUrl}
          onChange={(event) =>
            setForm((current) => ({ ...current, conferenceUrl: event.target.value }))
          }
          placeholder={t('event.conferencePlaceholder')}
          inputProps={{ maxLength: 1000 }}
        />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
          <SelectField
            label={t('event.recurrenceLabel')}
            value={form.recurrence}
            options={(['NONE', 'DAILY', 'WEEKLY', 'MONTHLY'] as const).map((value) => ({
              value,
              label: t(`event.recurrence.${value}`),
            }))}
            onValueChange={(value) =>
              value && setForm((current) => ({ ...current, recurrence: value }))
            }
          />
          <SelectField
            label={t('event.visibilityLabel')}
            value={form.visibility}
            options={(['DEFAULT', 'PUBLIC', 'PRIVATE', 'CONFIDENTIAL'] as const).map((value) => ({
              value,
              label: t(`event.visibility.${value}`),
            }))}
            onValueChange={(value) =>
              value && setForm((current) => ({ ...current, visibility: value }))
            }
          />
        </Box>
        {form.recurrence !== 'NONE' && (
          <DatePickerField
            label={t('event.recurrenceUntilLabel')}
            value={form.recurrenceUntil}
            onValueChange={(value) =>
              setForm((current) => ({ ...current, recurrenceUntil: value ?? '' }))
            }
            errorMessage={
              validationVisible && resourceRecurrenceError
                ? t('event.resourceRecurrenceUntilRequired')
                : undefined
            }
          />
        )}
        <FormControlLabel
          control={
            <Checkbox
              checked={form.responseRequired}
              onChange={(event) =>
                setForm((current) => ({ ...current, responseRequired: event.target.checked }))
              }
            />
          }
          label={t('event.responseRequired')}
        />
      </Stack>
    </FormDialog>
  );
}
