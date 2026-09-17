import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Clock3, Focus, ListTodo, UsersRound } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createCalendarEvent,
  getCalendars,
  getCalendarResources,
  getCalendarSettings,
  listPeople,
  resolveIdempotentMutationIntent,
  updateCalendarEvent,
  usePermissions,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  DateTimePickerField,
  DwpDateTimeProvider,
  FormDialog,
  FormField,
  InlineFeedback,
  SelectField,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import type {
  CalendarEvent,
  CalendarEventImportance,
  CalendarRecurrenceEditScope,
  CalendarResource,
  CalendarSettings,
  CalendarEventType,
  IdempotentMutationIntent,
  DwaionProposalHandoffBinding,
  MailProposalMutationBinding,
  PersonSummary,
} from '@dwp-frontend/shared-utils';

import {
  EMPTY_CALENDAR_EDITOR_EMAILS,
  EMPTY_CALENDAR_EDITOR_PEOPLE,
  calendarEditorAttendees,
  calendarEventDraft,
  calendarEventInput,
  protectWorkCalendarEventDraft,
  type CalendarEditorAttendee,
  type CalendarEventDraft,
} from './calendar-event-editor-model';
import { CalendarSchedulingAssistant } from './calendar-scheduling-assistant';
import { CalendarEventDialogDetails } from './calendar-event-dialog-details';
import {
  CalendarEventDialogStatus,
  calendarEventSaveErrorMessage,
  calendarEventSaveFailureKind,
} from './calendar-event-dialog-status';
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
  proposalBinding?: MailProposalMutationBinding;
  dwaionProposalBinding?: DwaionProposalHandoffBinding | null;
  submissionBlocked?: boolean;
  workHandoff?: WorkCalendarEventHandoff | null;
  workRecovery?: CalendarWorkHandoffRecovery | null;
  onBeforeCreate?: () => void | Promise<void>;
  onClose: () => void;
  onReturnToWork?: () => void;
  onCreateReceipt?: (event: CalendarEvent, idempotencyKey: string) => Promise<void>;
  onSaved?: (event: CalendarEvent) => void;
};

const EMPTY_CALENDAR_RESOURCES: CalendarResource[] = [];

function creationDraftWithSettings(
  draft: CalendarEventDraft,
  settings: CalendarSettings | undefined,
  explicit: Readonly<{
    end: boolean;
    timeZone: boolean;
    visibility: boolean;
  }>
) {
  if (!settings) return draft;
  const startsAt = new Date(draft.startsAt);
  const speedyMinutes =
    settings.speedyMeetingMode === 'FIVE_TEN'
      ? settings.defaultEventMinutes >= 60
        ? 10
        : 5
      : 0;
  const durationMinutes = Math.max(5, settings.defaultEventMinutes - speedyMinutes);
  return {
    ...draft,
    endsAt:
      explicit.end || Number.isNaN(startsAt.getTime())
        ? draft.endsAt
        : new Date(startsAt.getTime() + durationMinutes * 60_000).toISOString(),
    timeZone: explicit.timeZone ? draft.timeZone : settings.timeZone,
    visibility: explicit.visibility
      ? draft.visibility
      : settings.defaultVisibility === 'PRIVATE'
        ? ('PRIVATE' as const)
        : ('DEFAULT' as const),
  };
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
  initialAttendees = EMPTY_CALENDAR_EDITOR_PEOPLE,
  initialAttendeeEmails = EMPTY_CALENDAR_EDITOR_EMAILS,
  fromDwaion = false,
  proposalBinding,
  dwaionProposalBinding,
  submissionBlocked = false,
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
  const settingsQuery = useQuery({
    queryKey: ['calendar', 'settings'],
    queryFn: ({ signal }) => getCalendarSettings(signal),
    enabled: open && canMutate && !event && !recoveryMode,
    staleTime: 60_000,
    retry: 1,
  });
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
    const draft = creationDraftWithSettings(calendarEventDraft(event, {
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
    }), event ? undefined : settingsQuery.data, {
      end: Boolean(initialEnd),
      timeZone: Boolean(initialTimeZone),
      visibility: Boolean(initialVisibility || workHandoff),
    });
    return workDescription ? protectWorkCalendarEventDraft(draft, workDescription) : draft;
  });
  const [attendees, setAttendees] = useState<CalendarEditorAttendee[]>([]);
  const [validationVisible, setValidationVisible] = useState(false);
  const [additionalOptionsOpen, setAdditionalOptionsOpen] = useState(
    Boolean(event || initialDescription)
  );
  const [versionConflict, setVersionConflict] = useState(false);
  const [editScope, setEditScope] = useState<CalendarRecurrenceEditScope>('SERIES');
  const authorityNoticeShown = useRef(false);
  const createIntent = useRef<IdempotentMutationIntent | null>(
    initialRecoveryReceipt?.intent ?? null
  );
  const occurrenceIntent = useRef<IdempotentMutationIntent | null>(null);
  const pendingWorkReceipt = useRef<CalendarPendingWorkEventReceipt | null>(initialRecoveryReceipt);
  const [workReceiptLocked, setWorkReceiptLocked] = useState(recoveryMode);

  useEffect(() => {
    if (!open) {
      authorityNoticeShown.current = false;
      return;
    }
    if (canMutate || authorityNoticeShown.current) return;
    authorityNoticeShown.current = true;
    setForm((current) => calendarEventDraft(null, { fallbackTimeZone: current.timeZone }));
    setAttendees([]);
    queryClient.removeQueries({ queryKey: ['calendar'] });
    toast.error(t('event.authorityRevoked'));
    onClose();
  }, [canMutate, onClose, open, queryClient, t, toast]);

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
    const draft = creationDraftWithSettings(calendarEventDraft(event, {
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
    }), event ? undefined : settingsQuery.data, {
      end: Boolean(initialEnd),
      timeZone: Boolean(initialTimeZone),
      visibility: Boolean(initialVisibility || workHandoff),
    });
    setForm(workDescription ? protectWorkCalendarEventDraft(draft, workDescription) : draft);
    setAttendees(
      workProtected ? [] : calendarEditorAttendees(event, initialAttendees, initialAttendeeEmails)
    );
    setValidationVisible(false);
    setVersionConflict(false);
    setEditScope('SERIES');
    occurrenceIntent.current = null;
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
    settingsQuery.data,
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
  const resources = resourcesQuery.data ?? EMPTY_CALENDAR_RESOURCES;
  const recurringEvent = event?.recurrence && event.recurrence !== 'NONE' ? event : null;
  const occurrenceOnly = Boolean(
    recurringEvent && editScope === 'THIS_OCCURRENCE'
  );

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
  const patchForm = useCallback((patch: Partial<CalendarEventDraft>) => {
    setForm((current) => ({ ...current, ...patch }));
  }, []);
  const changeResource = useCallback((resourceId: string, resourceName?: string) => {
    setForm((current) => ({
      ...current,
      resourceId,
      location: resourceName ?? current.location,
    }));
  }, []);
  const replaceAttendees = useCallback(
    (type: CalendarEditorAttendee['type'], values: readonly CalendarEditorAttendee[]) => {
      const selectedIds = new Set(values.map((person) => person.personId));
      setAttendees((current) => [
        ...current.filter((person) => person.type !== type && !selectedIds.has(person.personId)),
        ...values.map((person) => ({ ...person, type })),
      ]);
    },
    []
  );
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
        if (occurrenceOnly) {
          const occurrenceCommand = {
            ...updateInput,
            version: event.version,
            editScope: 'THIS_OCCURRENCE' as const,
            originalStartsAt: event.recurrenceId ?? event.startsAt,
          };
          const intent = resolveIdempotentMutationIntent(
            occurrenceIntent.current,
            occurrenceCommand,
            () => crypto.randomUUID()
          );
          occurrenceIntent.current = intent;
          return updateCalendarEvent(event.eventId, {
            ...occurrenceCommand,
            idempotencyKey: intent.key,
          });
        }
        return updateCalendarEvent(event.eventId, {
          ...updateInput,
          version: event.version,
          editScope: 'SERIES',
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
      const saved = await createCalendarEvent(
        request,
        undefined,
        proposalBinding,
        dwaionProposalBinding
      );
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
      setVersionConflict(false);
      createIntent.current = null;
      occurrenceIntent.current = null;
      pendingWorkReceipt.current = null;
      setWorkReceiptLocked(false);
      onSaved?.(saved);
      onClose();
    },
    onError: (error) => {
      const failure = calendarEventSaveFailureKind(error);
      if (failure === 'AUTHORITY_REVOKED') {
        setForm((current) => calendarEventDraft(null, { fallbackTimeZone: current.timeZone }));
        setAttendees([]);
        queryClient.removeQueries({ queryKey: ['calendar'] });
        toast.error(t('event.authorityRevoked'));
        onClose();
        return;
      }
      if (failure === 'VERSION_CONFLICT') {
        setVersionConflict(true);
        return;
      }
      // Work handoff failures stay actionable inside the open composer. A duplicate bottom toast
      // can cover the retry/create action on a full-screen mobile dialog.
      if (!workHandoff) toast.error(calendarEventSaveErrorMessage(error, t('event.saveError')));
    },
  });

  const submit = () => {
    if (!canMutate || submissionBlocked || (!pendingWorkReceipt.current && !valid)) {
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
      open={
        open &&
        canMutate &&
        Boolean(event || recoveryMode || settingsQuery.isFetched || settingsQuery.isError)
      }
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
      submitDisabled={!canMutate || submissionBlocked}
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
          <CalendarEventDialogStatus
            fromDwaion={fromDwaion}
            workHandoff={Boolean(workHandoff)}
            workReceiptLocked={workReceiptLocked}
            saveError={
              mutation.isError && !versionConflict
                ? calendarEventSaveErrorMessage(mutation.error, t('event.saveError'))
                : null
            }
            versionConflict={versionConflict}
            calendarsError={calendarsQuery.isError}
            peopleError={peopleQuery.isError}
            onKeepDraft={() => setVersionConflict(false)}
            onReloadCurrent={() => {
              queryClient.removeQueries({ queryKey: ['calendar'] });
              void queryClient.invalidateQueries({ queryKey: ['calendar'] });
              onClose();
            }}
            onRetryCalendars={() => void calendarsQuery.refetch()}
            onRetryPeople={() => void peopleQuery.refetch()}
          />
          {!event && settingsQuery.isError ? (
            <InlineFeedback severity="warning">
              {t('event.settingsDefaultsUnavailable')}
            </InlineFeedback>
          ) : null}
          {recurringEvent ? (
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={700}>
                {t('event.recurrenceEditScopeLabel')}
              </Typography>
              <ToggleButtonGroup
                exclusive
                fullWidth
                size="small"
                value={editScope}
                onChange={(_, value: CalendarRecurrenceEditScope | null) => {
                  if (!value) return;
                  setEditScope(value);
                  occurrenceIntent.current = null;
                  if (value === 'THIS_OCCURRENCE') {
                    setForm((current) => ({
                      ...current,
                      type: recurringEvent.type,
                      timeZone: recurringEvent.timeZone,
                      recurrence: recurringEvent.recurrence,
                      recurrenceInterval: recurringEvent.recurrenceInterval,
                      recurrenceUntil: recurringEvent.recurrenceUntil ?? '',
                      responseRequired: recurringEvent.responseRequired,
                      resourceId: recurringEvent.resource?.resourceId ?? '',
                    }));
                    setAttendees(
                      calendarEditorAttendees(
                        recurringEvent,
                        EMPTY_CALENDAR_EDITOR_PEOPLE,
                        EMPTY_CALENDAR_EDITOR_EMAILS
                      )
                    );
                  }
                }}
                aria-label={t('event.recurrenceEditScopeLabel')}
                sx={{ mt: 0.75 }}
              >
                <ToggleButton value="THIS_OCCURRENCE" disabled={Boolean(recurringEvent.resource)}>
                  {t('event.recurrenceEditScopes.THIS_OCCURRENCE')}
                </ToggleButton>
                <ToggleButton value="SERIES">
                  {t('event.recurrenceEditScopes.SERIES')}
                </ToggleButton>
              </ToggleButtonGroup>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
                {recurringEvent.resource
                  ? t('event.occurrenceResourceSeriesOnly')
                  : occurrenceOnly
                    ? t('event.occurrenceFieldsHint')
                    : t('event.seriesFieldsHint')}
              </Typography>
            </Box>
          ) : null}
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
                  disabled={workProtected || occurrenceOnly}
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
              <CalendarEventDialogDetails
                expanded={additionalOptionsOpen}
                form={form}
                attendees={attendees}
                attendeeOptions={attendeeOptions}
                resources={resources}
                peopleLoading={peopleQuery.isLoading}
                workProtected={workProtected}
                workReceiptLocked={workReceiptLocked}
                occurrenceOnly={occurrenceOnly}
                validationVisible={validationVisible}
                resourceRecurrenceError={resourceRecurrenceError}
                eventResourceId={event?.resource?.resourceId}
                onExpandedChange={setAdditionalOptionsOpen}
                onFormPatch={patchForm}
                onResourceChange={changeResource}
                onReplaceAttendees={replaceAttendees}
              />
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
                      resources={resources}
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
