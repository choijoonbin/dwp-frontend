import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  ChevronDown,
  Clock3,
  Focus,
  ListTodo,
  SlidersHorizontal,
  UsersRound,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createCalendarEvent,
  getCalendars,
  getCalendarResources,
  listPeople,
  resolveIdempotentMutationIntent,
  updateCalendarEvent,
  usePermissions,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  AutocompleteMultiField,
  DatePickerField,
  DateTimePickerField,
  DwpDateTimeProvider,
  FormDialog,
  FormField,
  SelectField,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
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
  IdempotentMutationIntent,
  PersonSummary,
} from '@dwp-frontend/shared-utils';

import {
  calendarEditorAttendees,
  calendarEventDraft,
  calendarEventInput,
  calendarSystemTimeZone,
  type CalendarEditorAttendee,
  type CalendarEventDraft,
} from './calendar-event-editor-model';
import { CalendarSchedulingAssistant } from './calendar-scheduling-assistant';

type CalendarEventDialogProps = {
  open: boolean;
  event?: CalendarEvent | null;
  initialStart?: string | null;
  initialEnd?: string | null;
  initialType?: CalendarEventType;
  initialTitle?: string | null;
  initialResourceId?: string | null;
  initialCalendarId?: string | null;
  initialTimeZone?: string | null;
  initialAttendees?: PersonSummary[];
  initialAttendeeEmails?: string[];
  fromDwaion?: boolean;
  onClose: () => void;
  onSaved?: (event: CalendarEvent) => void;
};

const EMPTY_ATTENDEES: PersonSummary[] = [];
const EMPTY_EMAILS: string[] = [];
const COMMON_TIME_ZONES = [
  'Asia/Seoul',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Europe/London',
  'America/New_York',
  'UTC',
] as const;

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
  initialCalendarId,
  initialTimeZone,
  initialAttendees = EMPTY_ATTENDEES,
  initialAttendeeEmails = EMPTY_EMAILS,
  fromDwaion = false,
  onClose,
  onSaved,
}: CalendarEventDialogProps) {
  const { t, i18n } = useTranslation('calendar');
  const eventTypeLabelId = useId();
  const { hasPermission } = usePermissions();
  const canMutate = hasPermission('APP.CALENDAR', event ? 'UPDATE' : 'CREATE');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CalendarEventDraft>(() =>
    calendarEventDraft(event, {
      initialStart,
      initialEnd,
      initialType,
      initialTitle,
      initialResourceId,
      initialCalendarId,
      fallbackTimeZone: initialTimeZone ?? undefined,
    })
  );
  const [attendees, setAttendees] = useState<CalendarEditorAttendee[]>([]);
  const [validationVisible, setValidationVisible] = useState(false);
  const [additionalOptionsOpen, setAdditionalOptionsOpen] = useState(Boolean(event));
  const createIntent = useRef<IdempotentMutationIntent | null>(null);

  useEffect(() => {
    if (open && !canMutate) onClose();
  }, [canMutate, onClose, open]);

  useEffect(() => {
    if (!open || event) createIntent.current = null;
  }, [event, open]);

  useEffect(() => {
    if (!open) return;
    setForm(
      calendarEventDraft(event, {
        initialStart,
        initialEnd,
        initialType,
        initialTitle,
        initialResourceId,
        initialCalendarId,
        fallbackTimeZone: initialTimeZone ?? undefined,
      })
    );
    setAttendees(calendarEditorAttendees(event, initialAttendees, initialAttendeeEmails));
    setValidationVisible(false);
    setAdditionalOptionsOpen(Boolean(event));
  }, [
    event,
    initialAttendeeEmails,
    initialAttendees,
    initialEnd,
    initialResourceId,
    initialCalendarId,
    initialStart,
    initialTitle,
    initialTimeZone,
    initialType,
    open,
  ]);

  const peopleQuery = useQuery({
    queryKey: ['calendar', 'people-options'],
    queryFn: () => listPeople({ size: 100, surface: 'directory' }),
    enabled: open && canMutate && form.type === 'MEETING',
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const calendarsQuery = useQuery({
    queryKey: ['calendar', 'calendars'],
    queryFn: getCalendars,
    enabled: open && canMutate,
    staleTime: 60_000,
    retry: 1,
  });
  const writableCalendars = useMemo(
    () =>
      (calendarsQuery.data ?? []).filter(
        (calendar) => calendar.capabilities?.canCreateEvents === true
      ),
    [calendarsQuery.data]
  );

  useEffect(() => {
    if (!open || event || form.calendarId || !writableCalendars.length) return;
    setForm((current) => ({ ...current, calendarId: writableCalendars[0]!.calendarId }));
  }, [event, form.calendarId, open, writableCalendars]);
  const resourceRangeValid = Boolean(
    form.startsAt && form.endsAt && new Date(form.endsAt) > new Date(form.startsAt)
  );
  const resourcesQuery = useQuery({
    queryKey: ['calendar', 'resources', form.startsAt, form.endsAt],
    queryFn: () => getCalendarResources(form.startsAt, form.endsAt),
    enabled: open && canMutate && form.type === 'MEETING' && resourceRangeValid,
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
  const attendeeOptions = useMemo(
    () =>
      (peopleQuery.data?.items ?? [])
        .filter((person) => Boolean(person.workEmail))
        .map<CalendarEditorAttendee>((person) => ({
          personId: person.personId,
          displayName: person.displayName,
          workEmail: person.workEmail,
          type: 'REQUIRED',
        })),
    [peopleQuery.data?.items]
  );
  const replaceAttendees = (
    type: CalendarEditorAttendee['type'],
    values: readonly CalendarEditorAttendee[]
  ) => {
    const selectedIds = new Set(values.map((person) => person.personId));
    setAttendees((current) => [
      ...current.filter((person) => person.type !== type && !selectedIds.has(person.personId)),
      ...values.map((person) => ({ ...person, type })),
    ]);
  };
  const start = new Date(form.startsAt);
  const end = new Date(form.endsAt);
  const rangeError = !form.startsAt || !form.endsAt || end <= start;
  const resourceRecurrenceError = Boolean(
    form.type === 'MEETING' &&
    form.resourceId &&
    form.recurrence !== 'NONE' &&
    !form.recurrenceUntil
  );
  const valid = Boolean(
    form.title.trim() && form.calendarId && !rangeError && !resourceRecurrenceError
  );

  const mutation = useMutation({
    mutationFn: async () => {
      if (!canMutate) throw new Error('Calendar mutation permission is required.');
      const input = calendarEventInput(form, attendees);
      if (event) {
        const { calendarId: _calendarId, ...updateInput } = input;
        return updateCalendarEvent(event.eventId, {
          ...updateInput,
          version: event.version,
        });
      }
      const intent = resolveIdempotentMutationIntent(createIntent.current, input);
      createIntent.current = intent;
      return createCalendarEvent({
        ...input,
        idempotencyKey: intent.key,
      });
    },
    onSuccess: async (saved) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['calendar'] }),
        queryClient.invalidateQueries({ queryKey: ['workspace', 'apps'] }),
      ]);
      toast.success(t(event ? 'event.updated' : 'event.created'));
      createIntent.current = null;
      onSaved?.(saved);
      onClose();
    },
    onError: (error) => toast.error(message(error, t('event.saveError'))),
  });

  const submit = () => {
    if (!canMutate || !valid) {
      setValidationVisible(true);
      return;
    }
    mutation.mutate();
  };

  return (
    <FormDialog
      open={open && canMutate}
      title={t(event ? 'event.editTitle' : 'event.createTitle')}
      description={t(event ? 'event.editDescription' : 'event.createDescription')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t(event ? 'actions.save' : 'actions.create')}
      submittingLabel={t('actions.saving')}
      onClose={onClose}
      onSubmit={submit}
      busy={mutation.isPending}
      submitDisabled={!canMutate}
      maxWidth="lg"
      mobileFullScreen
    >
      <DwpDateTimeProvider locale={i18n.resolvedLanguage ?? i18n.language} timeZone={form.timeZone}>
        <Stack spacing={2.25}>
          {fromDwaion && <Alert severity="info">{t('event.dwaionDraftNotice')}</Alert>}
          {mutation.isError && (
            <Alert severity="error">{message(mutation.error, t('event.saveError'))}</Alert>
          )}
          {calendarsQuery.isError && (
            <Alert
              severity="error"
              action={
                <ActionButton intent="quiet" size="small" onClick={() => calendarsQuery.refetch()}>
                  {t('actions.retry')}
                </ActionButton>
              }
            >
              {t('event.calendarsLoadError')}
            </Alert>
          )}
          {peopleQuery.isError && (
            <Alert
              severity="warning"
              action={
                <ActionButton intent="quiet" size="small" onClick={() => peopleQuery.refetch()}>
                  {t('actions.retry')}
                </ActionButton>
              }
            >
              {t('event.peopleLoadError')}
            </Alert>
          )}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns:
                form.type === 'MEETING'
                  ? { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1.3fr) minmax(360px, 0.9fr)' }
                  : 'minmax(0, 1fr)',
              gap: { xs: 2.25, lg: 3 },
              alignItems: 'start',
            }}
          >
            <Stack spacing={2.25} sx={{ minWidth: 0 }}>
              <SelectField
                required
                disabled={Boolean(event) || calendarsQuery.isError}
                label={t('event.calendarLabel')}
                value={form.calendarId}
                placeholder={t('event.calendarPlaceholder')}
                options={writableCalendars.map((calendar) => ({
                  value: calendar.calendarId,
                  label: `${calendar.name} · ${t(`sources.kinds.${calendar.sourceKind ?? 'OWNED'}`)}`,
                }))}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, calendarId: String(value) }))
                }
                errorMessage={
                  validationVisible && !form.calendarId ? t('event.calendarRequired') : undefined
                }
                supportingText={event ? t('event.calendarLockedHint') : undefined}
              />
              <Box>
                <Typography
                  id={eventTypeLabelId}
                  variant="caption"
                  color="text.secondary"
                  fontWeight={700}
                  sx={{ mb: 0.75 }}
                >
                  {t('event.typeLabel')}
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  fullWidth
                  value={form.type}
                  onChange={(_, value: CalendarEventType | null) => {
                    if (!value) return;
                    if (value !== 'MEETING') setAttendees([]);
                    setForm((current) =>
                      value === 'MEETING'
                        ? { ...current, type: value }
                        : {
                            ...current,
                            type: value,
                            resourceId: '',
                            location: '',
                            conferenceUrl: '',
                            responseRequired: false,
                          }
                    );
                  }}
                  aria-labelledby={eventTypeLabelId}
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
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
                errorMessage={
                  validationVisible && !form.title.trim() ? t('event.titleRequired') : undefined
                }
                inputProps={{ maxLength: 240 }}
              />
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                  gap: 2,
                }}
              >
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
              <Accordion
                expanded={additionalOptionsOpen}
                onChange={(_, expanded) => setAdditionalOptionsOpen(expanded)}
                disableGutters
                elevation={0}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: '8px !important',
                  overflow: 'hidden',
                  '&::before': { display: 'none' },
                }}
              >
                <AccordionSummary
                  expandIcon={<ChevronDown size={18} />}
                  sx={{
                    minHeight: 64,
                    px: 2,
                    '& .MuiAccordionSummary-content': { my: 1.25 },
                  }}
                >
                  <Stack direction="row" spacing={1.25} alignItems="center">
                    <Box
                      aria-hidden="true"
                      sx={{
                        width: 30,
                        height: 30,
                        display: 'grid',
                        placeItems: 'center',
                        borderRadius: 0.75,
                        bgcolor: 'action.hover',
                        color: 'primary.main',
                      }}
                    >
                      <SlidersHorizontal size={16} />
                    </Box>
                    <Box>
                      <Typography fontWeight={600}>{t('event.additionalOptions')}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('event.additionalOptionsDescription')}
                      </Typography>
                    </Box>
                  </Stack>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 2, pt: 0.75, pb: 2 }}>
                  <Stack spacing={2.25}>
                    <FormField
                      multiline
                      minRows={3}
                      label={t(
                        form.type === 'MEETING' ? 'event.agendaLabel' : 'event.descriptionLabel'
                      )}
                      value={form.description}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, description: event.target.value }))
                      }
                      supportingText={form.type === 'MEETING' ? t('event.agendaHint') : undefined}
                      inputProps={{ maxLength: 4000 }}
                    />
                    {form.type === 'MEETING' &&
                      (['REQUIRED', 'OPTIONAL'] as const).map((attendeeType) => {
                        const selectedForType = attendees.filter(
                          (person) => person.type === attendeeType
                        );
                        return (
                          <AutocompleteMultiField
                            key={attendeeType}
                            multiple
                            options={attendeeOptions.map((person) => ({
                              ...person,
                              type: attendeeType,
                            }))}
                            value={selectedForType}
                            onChange={(_, value) => replaceAttendees(attendeeType, value)}
                            loading={peopleQuery.isLoading}
                            getOptionLabel={(person) =>
                              `${person.displayName} · ${person.workEmail ?? ''}`
                            }
                            isOptionEqualToValue={(option, value) =>
                              option.personId === value.personId
                            }
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
                            label={t(
                              attendeeType === 'REQUIRED'
                                ? 'event.requiredAttendeesLabel'
                                : 'event.optionalAttendeesLabel'
                            )}
                            textFieldProps={{
                              placeholder: selectedForType.length
                                ? undefined
                                : t(
                                    attendeeType === 'REQUIRED'
                                      ? 'event.requiredAttendeesPlaceholder'
                                      : 'event.optionalAttendeesPlaceholder'
                                  ),
                            }}
                          />
                        );
                      })}
                    {form.type === 'MEETING' ? (
                      <>
                        <Box
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                            gap: 2,
                          }}
                        >
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
                                  (!resource.available &&
                                    resource.resourceId !== event?.resource?.resourceId),
                              })),
                            ]}
                            onValueChange={(value) => {
                              const resource = resourcesQuery.data?.find(
                                (item) => item.resourceId === value
                              );
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
                            setForm((current) => ({
                              ...current,
                              conferenceUrl: event.target.value,
                            }))
                          }
                          placeholder={t('event.conferencePlaceholder')}
                          inputProps={{ maxLength: 1000 }}
                        />
                      </>
                    ) : null}
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                        gap: 2,
                      }}
                    >
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
                        options={(['DEFAULT', 'PUBLIC', 'PRIVATE', 'CONFIDENTIAL'] as const).map(
                          (value) => ({
                            value,
                            label: t(`event.visibility.${value}`),
                          })
                        )}
                        onValueChange={(value) =>
                          value && setForm((current) => ({ ...current, visibility: value }))
                        }
                      />
                      <SelectField
                        label={t('event.importanceLabel')}
                        value={form.importance}
                        options={(['LOW', 'NORMAL', 'HIGH'] as const).map((value) => ({
                          value,
                          label: t(`event.importance.${value}`),
                        }))}
                        onValueChange={(value) =>
                          value && setForm((current) => ({ ...current, importance: value }))
                        }
                      />
                    </Box>
                    <SelectField
                      label={t('event.timeZoneLabel')}
                      value={form.timeZone}
                      options={Array.from(
                        new Set([form.timeZone, calendarSystemTimeZone(), ...COMMON_TIME_ZONES])
                      ).map((timeZone) => ({ value: timeZone, label: timeZone }))}
                      onValueChange={(timeZone) =>
                        timeZone &&
                        setForm((current) => ({ ...current, timeZone: String(timeZone) }))
                      }
                      supportingText={t('event.timeZoneHint')}
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={form.allDay}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, allDay: event.target.checked }))
                          }
                        />
                      }
                      label={t('event.allDay')}
                    />
                    {form.recurrence !== 'NONE' && (
                      <SelectField<number>
                        label={t('event.recurrenceIntervalLabel')}
                        value={form.recurrenceInterval}
                        options={[1, 2, 3, 4].map((value) => ({
                          value,
                          label: t(`event.recurrenceIntervals.${form.recurrence}`, {
                            count: value,
                          }),
                        }))}
                        onValueChange={(value) =>
                          value &&
                          setForm((current) => ({ ...current, recurrenceInterval: Number(value) }))
                        }
                      />
                    )}
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
                    {form.type === 'MEETING' ? (
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={form.responseRequired}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                responseRequired: event.target.checked,
                              }))
                            }
                          />
                        }
                        label={t('event.responseRequired')}
                      />
                    ) : null}
                  </Stack>
                </AccordionDetails>
              </Accordion>
            </Stack>
            {form.type === 'MEETING' && (
              <Box
                component="aside"
                sx={{
                  minWidth: 0,
                  alignSelf: 'stretch',
                  bgcolor: { lg: 'action.hover' },
                  borderRadius: { lg: 1 },
                  p: { lg: 1.5 },
                }}
              >
                <Box sx={{ position: { lg: 'sticky' }, top: { lg: 0 } }}>
                  {form.recurrence === 'NONE' ? (
                    <CalendarSchedulingAssistant
                      open={open}
                      startsAt={form.startsAt}
                      endsAt={form.endsAt}
                      attendees={attendees}
                      resources={resourcesQuery.data ?? []}
                      resourcesLoading={resourcesQuery.isLoading || resourcesQuery.isFetching}
                      resourcesError={resourcesQuery.isError}
                      selectedResourceId={form.resourceId}
                      language={i18n.resolvedLanguage ?? i18n.language}
                      timeZone={form.timeZone}
                      onApplyTime={(startsAt, endsAt) =>
                        setForm((current) => ({ ...current, startsAt, endsAt }))
                      }
                      onApplyRoom={(resource) =>
                        setForm((current) => ({
                          ...current,
                          resourceId: resource.resourceId,
                          location: resource.name,
                        }))
                      }
                    />
                  ) : (
                    <Alert severity="info">{t('schedulingAssistant.recurringSeriesNotice')}</Alert>
                  )}
                </Box>
              </Box>
            )}
          </Box>
        </Stack>
      </DwpDateTimeProvider>
    </FormDialog>
  );
}
