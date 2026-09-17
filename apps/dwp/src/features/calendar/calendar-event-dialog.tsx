import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
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
  InlineFeedback,
  SelectField,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
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
  CalendarEventImportance,
  CalendarEventType,
  IdempotentMutationIntent,
  PersonSummary,
} from '@dwp-frontend/shared-utils';

import {
  calendarEditorAttendees,
  calendarEventDraft,
  calendarEventInput,
  calendarSystemTimeZone,
  protectWorkCalendarEventDraft,
  type CalendarEditorAttendee,
  type CalendarEventDraft,
} from './calendar-event-editor-model';
import { CalendarSchedulingAssistant } from './calendar-scheduling-assistant';
import {
  calendarWorkHandoffRecoveryReceipt,
  clearCalendarWorkHandoffRecovery,
  isExactWorkHandoffEventReceipt,
  persistCalendarWorkHandoffRecovery,
  type CalendarPendingWorkEventReceipt,
  type CalendarWorkHandoffRecovery,
} from './calendar-work-handoff';
import {
  parseWorkCalendarEventHandoffDescription,
  workCalendarEventHandoffDescription,
  type WorkCalendarEventHandoff,
} from '@dwp-frontend/shared-utils/api/work-hub-calendar-api';

type CalendarEventDialogProps = {
  open: boolean;
  event?: CalendarEvent | null;
  initialStart?: string | null;
  initialEnd?: string | null;
  initialType?: CalendarEventType;
  initialTitle?: string | null;
  initialDescription?: string | null;
  initialVisibility?: CalendarEvent['visibility'];
  initialResourceId?: string | null;
  initialCalendarId?: string | null;
  initialTimeZone?: string | null;
  initialImportance?: CalendarEventImportance;
  initialAttendees?: PersonSummary[];
  initialAttendeeEmails?: string[];
  fromDwaion?: boolean;
  workHandoff?: WorkCalendarEventHandoff | null;
  workRecovery?: CalendarWorkHandoffRecovery | null;
  onBeforeCreate?: () => void | Promise<void>;
  onClose: () => void;
  onReturnToWork?: () => void;
  onCreateReceipt?: (event: CalendarEvent, idempotencyKey: string) => Promise<void>;
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
  initialDescription,
  initialVisibility,
  initialResourceId,
  initialCalendarId,
  initialTimeZone,
  initialImportance,
  initialAttendees = EMPTY_ATTENDEES,
  initialAttendeeEmails = EMPTY_EMAILS,
  fromDwaion = false,
  workHandoff,
  workRecovery,
  onBeforeCreate,
  onClose,
  onReturnToWork,
  onCreateReceipt,
  onSaved,
}: CalendarEventDialogProps) {
  const { t, i18n } = useTranslation('calendar');
  const eventTypeLabelId = useId();
  const { hasPermission } = usePermissions();
  const initialRecoveryReceipt = calendarWorkHandoffRecoveryReceipt(workHandoff, workRecovery);
  const recoveryMode = Boolean(initialRecoveryReceipt);
  const canMutate = recoveryMode
    ? hasPermission('APP.WORK', 'UPDATE')
    : hasPermission('APP.CALENDAR', event ? 'UPDATE' : 'CREATE') &&
      (!workHandoff || hasPermission('APP.WORK', 'UPDATE'));
  const toast = useToast();
  const queryClient = useQueryClient();
  const workReference = useMemo(
    () => workHandoff ?? parseWorkCalendarEventHandoffDescription(event?.description),
    [event?.description, workHandoff]
  );
  const workDescription = useMemo(
    () => (workReference ? workCalendarEventHandoffDescription(workReference) : null),
    [workReference]
  );
  const workProtected = Boolean(workDescription);
  const [form, setForm] = useState<CalendarEventDraft>(() => {
    const draft = calendarEventDraft(event, {
      initialStart,
      initialEnd,
      initialType: workHandoff ? 'FOCUS' : initialType,
      initialTitle,
      initialDescription: workDescription ?? initialDescription,
      initialVisibility: workHandoff ? 'PRIVATE' : initialVisibility,
      initialResourceId,
      initialCalendarId,
      fallbackTimeZone: initialTimeZone ?? undefined,
      initialImportance,
    });
    return workDescription ? protectWorkCalendarEventDraft(draft, workDescription) : draft;
  });
  const [attendees, setAttendees] = useState<CalendarEditorAttendee[]>([]);
  const [validationVisible, setValidationVisible] = useState(false);
  const [additionalOptionsOpen, setAdditionalOptionsOpen] = useState(
    Boolean(event || initialDescription)
  );
  const createIntent = useRef<IdempotentMutationIntent | null>(
    initialRecoveryReceipt?.intent ?? null
  );
  const pendingWorkReceipt = useRef<CalendarPendingWorkEventReceipt | null>(initialRecoveryReceipt);
  const [workReceiptLocked, setWorkReceiptLocked] = useState(recoveryMode);

  useEffect(() => {
    if (open && !canMutate) onClose();
  }, [canMutate, onClose, open]);

  useEffect(() => {
    if (!open || event) {
      createIntent.current = null;
      pendingWorkReceipt.current = null;
      setWorkReceiptLocked(false);
    }
  }, [event, open]);

  useEffect(() => {
    const receipt = calendarWorkHandoffRecoveryReceipt(workHandoff, workRecovery);
    if (!open || !receipt) return;
    pendingWorkReceipt.current = receipt;
    createIntent.current = pendingWorkReceipt.current.intent;
    setWorkReceiptLocked(true);
  }, [open, workHandoff, workRecovery]);

  useEffect(() => {
    if (!open) return;
    const draft = calendarEventDraft(event, {
      initialStart,
      initialEnd,
      initialType: workHandoff ? 'FOCUS' : initialType,
      initialTitle,
      initialDescription: workDescription ?? initialDescription,
      initialVisibility: workHandoff ? 'PRIVATE' : initialVisibility,
      initialResourceId,
      initialCalendarId,
      fallbackTimeZone: initialTimeZone ?? undefined,
      initialImportance,
    });
    setForm(workDescription ? protectWorkCalendarEventDraft(draft, workDescription) : draft);
    setAttendees(
      workProtected ? [] : calendarEditorAttendees(event, initialAttendees, initialAttendeeEmails)
    );
    setValidationVisible(false);
    setAdditionalOptionsOpen(Boolean(event || initialDescription));
  }, [
    event,
    initialAttendeeEmails,
    initialAttendees,
    initialEnd,
    initialDescription,
    initialResourceId,
    initialCalendarId,
    initialStart,
    initialTitle,
    initialVisibility,
    initialTimeZone,
    initialImportance,
    initialType,
    open,
    workDescription,
    workHandoff,
    workProtected,
  ]);

  const peopleQuery = useQuery({
    queryKey: ['calendar', 'people-options'],
    queryFn: () => listPeople({ size: 100, surface: 'directory' }),
    enabled: open && canMutate && form.type === 'MEETING' && !workProtected,
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const calendarsQuery = useQuery({
    queryKey: ['calendar', 'calendars'],
    queryFn: ({ signal }) => getCalendars(signal),
    enabled: open && canMutate && !recoveryMode,
    staleTime: 60_000,
    retry: 1,
  });
  const writableCalendars = useMemo(
    () =>
      (calendarsQuery.data ?? []).filter(
        (calendar) =>
          calendar.capabilities?.canCreateEvents === true &&
          (!workHandoff || calendar.type === 'PERSONAL')
      ),
    [calendarsQuery.data, workHandoff]
  );
  const calendarOptions = useMemo(() => {
    const options = writableCalendars.map((calendar) => ({
      value: calendar.calendarId,
      label: `${calendar.name} · ${t(`sources.kinds.${calendar.sourceKind ?? 'OWNED'}`)}`,
    }));
    if (
      recoveryMode &&
      workRecovery &&
      !options.some((option) => option.value === workRecovery.event.calendarId)
    ) {
      options.unshift({
        value: workRecovery.event.calendarId,
        label: workRecovery.event.calendarName || workRecovery.event.calendarId,
      });
    }
    return options;
  }, [recoveryMode, t, workRecovery, writableCalendars]);

  useEffect(() => {
    if (
      !open ||
      event ||
      !writableCalendars.length ||
      writableCalendars.some((calendar) => calendar.calendarId === form.calendarId)
    )
      return;
    setForm((current) => ({ ...current, calendarId: writableCalendars[0]!.calendarId }));
  }, [event, form.calendarId, open, writableCalendars]);
  const resourceRangeValid = Boolean(
    form.startsAt && form.endsAt && new Date(form.endsAt) > new Date(form.startsAt)
  );
  const resourcesQuery = useQuery({
    queryKey: ['calendar', 'resources', form.startsAt, form.endsAt],
    queryFn: () => getCalendarResources(form.startsAt, form.endsAt),
    enabled: open && canMutate && form.type === 'MEETING' && !workProtected && resourceRangeValid,
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
    form.title.trim() &&
    form.title.trim().length <= (workProtected ? 300 : 240) &&
    form.calendarId &&
    (event || writableCalendars.some((calendar) => calendar.calendarId === form.calendarId)) &&
    !rangeError &&
    !resourceRecurrenceError
  );

  const mutation = useMutation({
    mutationFn: async () => {
      if (!canMutate) throw new Error('Calendar mutation permission is required.');
      const pending = pendingWorkReceipt.current;
      if (pending) {
        if (pending.handoffId !== workHandoff?.handoffId || !onCreateReceipt)
          throw new Error(t('event.workLinkSaveError'));
        await onCreateReceipt(pending.event, pending.intent.key);
        clearCalendarWorkHandoffRecovery(pending.handoffId);
        pendingWorkReceipt.current = null;
        setWorkReceiptLocked(false);
        return pending.event;
      }
      const input = calendarEventInput(form, attendees, { workReference });
      if (event) {
        const { calendarId: _calendarId, ...updateInput } = input;
        return updateCalendarEvent(event.eventId, {
          ...updateInput,
          version: event.version,
        });
      }
      const selectedCalendar = writableCalendars.find(
        (calendar) => calendar.calendarId === input.calendarId
      );
      if (!selectedCalendar) throw new Error('A currently writable Calendar receipt is required.');
      if (
        workHandoff &&
        (selectedCalendar.type !== 'PERSONAL' || !onBeforeCreate || !onCreateReceipt)
      )
        throw new Error(t('event.workLinkSaveError'));
      const previousIntent = createIntent.current;
      const intent = resolveIdempotentMutationIntent(previousIntent, input, () =>
        !previousIntent && workHandoff ? workHandoff.handoffId : crypto.randomUUID()
      );
      const request = {
        ...input,
        idempotencyKey: intent.key,
      };
      await onBeforeCreate?.();
      createIntent.current = intent;
      const saved = await createCalendarEvent(request);
      if (workHandoff) {
        if (!isExactWorkHandoffEventReceipt(saved, request))
          throw new Error(t('event.workLinkSaveError'));
        pendingWorkReceipt.current = { handoffId: workHandoff.handoffId, intent, event: saved };
        persistCalendarWorkHandoffRecovery(workHandoff, saved, request);
        setWorkReceiptLocked(true);
      }
      await onCreateReceipt?.(saved, intent.key);
      if (workHandoff) clearCalendarWorkHandoffRecovery(workHandoff.handoffId);
      pendingWorkReceipt.current = null;
      setWorkReceiptLocked(false);
      return saved;
    },
    onSuccess: async (saved) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['calendar'] }),
        queryClient.invalidateQueries({ queryKey: ['workspace', 'apps'] }),
      ]);
      toast.success(t(event ? 'event.updated' : 'event.created'));
      createIntent.current = null;
      pendingWorkReceipt.current = null;
      setWorkReceiptLocked(false);
      onSaved?.(saved);
      onClose();
    },
    onError: (error) => {
      // Work handoff failures stay actionable inside the open composer. A duplicate bottom toast
      // can cover the retry/create action on a full-screen mobile dialog.
      if (!workHandoff) toast.error(message(error, t('event.saveError')));
    },
  });

  const submit = () => {
    if (!canMutate || (!pendingWorkReceipt.current && !valid)) {
      setValidationVisible(true);
      return;
    }
    mutation.mutate();
  };
  const requestClose = () => {
    if (pendingWorkReceipt.current) {
      toast.error(t('event.workLinkRecoveryRequired'));
      return;
    }
    onClose();
  };

  return (
    <FormDialog
      open={open && canMutate}
      title={t(event ? 'event.editTitle' : 'event.createTitle')}
      description={t(event ? 'event.editDescription' : 'event.createDescription')}
      cancelLabel={t('actions.cancel')}
      submitLabel={
        workReceiptLocked ? t('event.retryWorkLink') : t(event ? 'actions.save' : 'actions.create')
      }
      submittingLabel={t('actions.saving')}
      onClose={requestClose}
      onSubmit={submit}
      busy={mutation.isPending}
      submitDisabled={!canMutate}
      secondaryActions={
        onReturnToWork ? (
          <ActionButton
            intent="quiet"
            startIcon={<ArrowLeft size={17} />}
            disabled={mutation.isPending || workReceiptLocked}
            onClick={onReturnToWork}
          >
            {t('actions.returnToWork')}
          </ActionButton>
        ) : undefined
      }
      maxWidth="lg"
      mobileFullScreen
    >
      <DwpDateTimeProvider locale={i18n.resolvedLanguage ?? i18n.language} timeZone={form.timeZone}>
        <Stack spacing={2.25}>
          {fromDwaion && (
            <InlineFeedback severity="info">{t('event.dwaionDraftNotice')}</InlineFeedback>
          )}
          {workHandoff && (
            <InlineFeedback severity="info">{t('event.workHandoffNotice')}</InlineFeedback>
          )}
          {workReceiptLocked && (
            <InlineFeedback severity="warning">
              {t('event.workLinkRecoveryRequired')}
            </InlineFeedback>
          )}
          {mutation.isError && (
            <InlineFeedback severity="error">
              {message(mutation.error, t('event.saveError'))}
            </InlineFeedback>
          )}
          {calendarsQuery.isError && (
            <InlineFeedback
              severity="error"
              action={
                <ActionButton intent="quiet" size="small" onClick={() => calendarsQuery.refetch()}>
                  {t('actions.retry')}
                </ActionButton>
              }
            >
              {t('event.calendarsLoadError')}
            </InlineFeedback>
          )}
          {peopleQuery.isError && (
            <InlineFeedback
              severity="warning"
              action={
                <ActionButton intent="quiet" size="small" onClick={() => peopleQuery.refetch()}>
                  {t('actions.retry')}
                </ActionButton>
              }
            >
              {t('event.peopleLoadError')}
            </InlineFeedback>
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
                disabled={Boolean(event) || calendarsQuery.isError || workReceiptLocked}
                label={t('event.calendarLabel')}
                value={form.calendarId}
                placeholder={t('event.calendarPlaceholder')}
                options={calendarOptions}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, calendarId: String(value) }))
                }
                errorMessage={
                  validationVisible && !form.calendarId ? t('event.calendarRequired') : undefined
                }
                supportingText={
                  event
                    ? t('event.calendarLockedHint')
                    : workHandoff
                      ? t('event.workCalendarOnlyHint')
                      : undefined
                }
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
                  disabled={workProtected}
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
                disabled={workReceiptLocked}
                label={t('event.titleLabel')}
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
                errorMessage={
                  validationVisible && !form.title.trim()
                    ? t('event.titleRequired')
                    : validationVisible && form.title.trim().length > (workProtected ? 300 : 240)
                      ? t('event.titleTooLong', { max: workProtected ? 300 : 240 })
                      : undefined
                }
                inputProps={{ maxLength: workProtected ? 300 : 240 }}
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
                  disabled={workReceiptLocked}
                  label={t('event.startLabel')}
                  value={form.startsAt}
                  onValueChange={(value) =>
                    value && setForm((current) => ({ ...current, startsAt: value }))
                  }
                />
                <DateTimePickerField
                  required
                  disabled={workReceiptLocked}
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
                      disabled={workProtected}
                      label={t(
                        form.type === 'MEETING' ? 'event.agendaLabel' : 'event.descriptionLabel'
                      )}
                      value={form.description}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, description: event.target.value }))
                      }
                      supportingText={
                        workProtected
                          ? t('event.workMetadataLockedHint')
                          : form.type === 'MEETING'
                            ? t('event.agendaHint')
                            : undefined
                      }
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
                        disabled={workProtected}
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
                        disabled={workProtected}
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
                        disabled={workReceiptLocked}
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
                      disabled={workReceiptLocked}
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
                          disabled={workProtected}
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
                    <InlineFeedback severity="info">
                      {t('schedulingAssistant.recurringSeriesNotice')}
                    </InlineFeedback>
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
