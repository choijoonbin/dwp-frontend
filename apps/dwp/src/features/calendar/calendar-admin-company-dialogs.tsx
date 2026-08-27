import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays } from 'lucide-react';
import { resolveIdempotentMutationIntent } from '@dwp-frontend/shared-utils';
import {
  DatePickerField,
  DateTimePickerField,
  FormDialog,
  FormField,
  SelectField,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type {
  CalendarEventImportance,
  CalendarEventType,
  CalendarRecurrence,
  CalendarVisibility,
  CompanyCalendar,
  CompanyCalendarEvent,
  CompanyCalendarInput,
  CreateCalendarEventInput,
  IdempotentMutationIntent,
  UpdateCalendarEventInput,
} from '@dwp-frontend/shared-utils';

import { calendarDate, calendarTime } from './calendar-components';

const COMPANY_COLORS = ['#0F766E', '#2563EB', '#7C3AED', '#B45309', '#BE123C'] as const;

function nextHour() {
  const value = new Date();
  value.setMinutes(0, 0, 0);
  value.setHours(value.getHours() + 1);
  return value;
}

export function CompanyCalendarDialog({
  open,
  calendar,
  busy,
  error,
  onClose,
  onSave,
}: {
  open: boolean;
  calendar: CompanyCalendar | null;
  busy: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (input: CompanyCalendarInput) => void;
}) {
  const { t } = useTranslation('calendar');
  const [key, setKey] = useState('company-events');
  const [nameKo, setNameKo] = useState('회사 일정');
  const [nameEn, setNameEn] = useState('Company events');
  const [color, setColor] = useState<string>(COMPANY_COLORS[0]);
  const [validation, setValidation] = useState(false);

  useEffect(() => {
    if (!open) return;
    setKey(calendar?.key ?? 'company-events');
    setNameKo(calendar?.nameKo ?? '회사 일정');
    setNameEn(calendar?.nameEn ?? 'Company events');
    setColor(calendar?.color ?? COMPANY_COLORS[0]);
    setValidation(false);
  }, [calendar, open]);

  const valid = /^[a-z0-9][a-z0-9-]{2,79}$/u.test(key) && nameKo.trim() && nameEn.trim();
  return (
    <FormDialog
      open={open}
      title={t(calendar ? 'company.editCalendarTitle' : 'company.createCalendarTitle')}
      description={t('company.calendarDialogDescription')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t(calendar ? 'actions.save' : 'actions.create')}
      submittingLabel={t('actions.saving')}
      busy={busy}
      onClose={onClose}
      onSubmit={() => {
        if (!valid) {
          setValidation(true);
          return;
        }
        onSave({
          key,
          nameKo: nameKo.trim(),
          nameEn: nameEn.trim(),
          color,
          version: calendar?.version ?? 0,
        });
      }}
    >
      <Stack spacing={2}>
        {error && <Alert severity="error">{error}</Alert>}
        <FormField
          required
          label={t('company.keyLabel')}
          value={key}
          disabled={Boolean(calendar)}
          onChange={(event) => setKey(event.target.value.toLowerCase())}
          supportingText={t('company.keyHint')}
          errorMessage={
            validation && !/^[a-z0-9][a-z0-9-]{2,79}$/u.test(key)
              ? t('company.keyError')
              : undefined
          }
          inputProps={{ maxLength: 80 }}
        />
        <FormField
          required
          label={t('company.nameKoLabel')}
          value={nameKo}
          onChange={(event) => setNameKo(event.target.value)}
          inputProps={{ maxLength: 160 }}
        />
        <FormField
          required
          label={t('company.nameEnLabel')}
          value={nameEn}
          onChange={(event) => setNameEn(event.target.value)}
          inputProps={{ maxLength: 160 }}
        />
        <SelectField
          label={t('company.colorLabel')}
          value={color}
          options={COMPANY_COLORS.map((value) => ({ value, label: value }))}
          onValueChange={(value) => value && setColor(String(value))}
          InputProps={{ startAdornment: <CalendarDays size={17} color={color} /> }}
        />
      </Stack>
    </FormDialog>
  );
}

type CompanyEventDraft = {
  title: string;
  description: string;
  type: CalendarEventType;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  allDay: boolean;
  location: string;
  visibility: CalendarVisibility;
  recurrence: CalendarRecurrence;
  recurrenceInterval: number;
  recurrenceUntil: string;
  importance: CalendarEventImportance;
};

function eventDraft(event: CompanyCalendarEvent | null): CompanyEventDraft {
  const start = nextHour();
  return {
    title: event?.title ?? '',
    description: event?.description ?? '',
    type: event?.type ?? 'REMINDER',
    startsAt: event?.startsAt ?? start.toISOString(),
    endsAt: event?.endsAt ?? new Date(start.getTime() + 60 * 60_000).toISOString(),
    timeZone: event?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Asia/Seoul',
    allDay: event?.allDay ?? false,
    location: event?.location ?? '',
    visibility: event?.visibility ?? 'DEFAULT',
    recurrence: event?.recurrence ?? 'NONE',
    recurrenceInterval: event?.recurrenceInterval ?? 1,
    recurrenceUntil: event?.recurrenceUntil ?? '',
    importance: event?.importance ?? 'NORMAL',
  };
}

function createInput(draft: CompanyEventDraft): Omit<CreateCalendarEventInput, 'idempotencyKey'> {
  return {
    title: draft.title.trim(),
    description: draft.description.trim() || null,
    type: draft.type,
    startsAt: draft.startsAt,
    endsAt: draft.endsAt,
    timeZone: draft.timeZone,
    allDay: draft.allDay,
    location: draft.location.trim() || null,
    conferenceUrl: null,
    visibility: draft.visibility,
    recurrence: draft.recurrence,
    recurrenceInterval: draft.recurrenceInterval,
    recurrenceUntil: draft.recurrence === 'NONE' ? null : draft.recurrenceUntil || null,
    responseRequired: false,
    attendees: [],
    resourceId: null,
    importance: draft.importance,
  };
}

export function CompanyEventDialog({
  open,
  event,
  busy,
  error,
  onClose,
  onCreate,
  onUpdate,
}: {
  open: boolean;
  event: CompanyCalendarEvent | null;
  busy: boolean;
  error?: string | null;
  onClose: () => void;
  onCreate: (input: CreateCalendarEventInput) => void;
  onUpdate: (input: UpdateCalendarEventInput) => void;
}) {
  const { t, i18n } = useTranslation('calendar');
  const [draft, setDraft] = useState<CompanyEventDraft>(() => eventDraft(event));
  const [validation, setValidation] = useState(false);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const createIntent = useRef<IdempotentMutationIntent | null>(null);
  const language = i18n.resolvedLanguage ?? i18n.language;
  useEffect(() => {
    if (!open) return;
    setDraft(eventDraft(event));
    setValidation(false);
    setReviewConfirmed(false);
  }, [event, open]);
  useEffect(() => {
    if (!open || event) createIntent.current = null;
  }, [event, open]);
  const valid = Boolean(
    draft.title.trim() &&
    draft.startsAt &&
    draft.endsAt &&
    new Date(draft.endsAt) > new Date(draft.startsAt)
  );
  return (
    <FormDialog
      open={open}
      title={t(event ? 'company.editEventTitle' : 'company.createEventTitle')}
      description={t('company.eventDialogDescription')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t(event ? 'actions.save' : 'company.publish')}
      submittingLabel={t('actions.saving')}
      busy={busy}
      submitDisabled={!reviewConfirmed}
      onClose={onClose}
      onSubmit={() => {
        if (!valid) {
          setValidation(true);
          return;
        }
        const input = createInput(draft);
        if (event) {
          const { calendarId: _calendarId, ...update } = input;
          onUpdate({ ...update, version: event.version });
        } else {
          const intent = resolveIdempotentMutationIntent(createIntent.current, input);
          createIntent.current = intent;
          onCreate({ ...input, idempotencyKey: intent.key });
        }
      }}
      maxWidth="md"
      mobileFullScreen
    >
      <Stack spacing={2}>
        {error && <Alert severity="error">{error}</Alert>}
        <FormField
          autoFocus
          required
          label={t('event.titleLabel')}
          value={draft.title}
          onChange={(change) => setDraft((current) => ({ ...current, title: change.target.value }))}
          errorMessage={validation && !draft.title.trim() ? t('event.titleRequired') : undefined}
          inputProps={{ maxLength: 240 }}
        />
        <FormField
          multiline
          minRows={3}
          label={t('event.descriptionLabel')}
          value={draft.description}
          onChange={(change) =>
            setDraft((current) => ({ ...current, description: change.target.value }))
          }
          inputProps={{ maxLength: 4000 }}
        />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <DateTimePickerField
            required
            label={t('event.startLabel')}
            value={draft.startsAt}
            onValueChange={(value) =>
              value && setDraft((current) => ({ ...current, startsAt: value }))
            }
          />
          <DateTimePickerField
            required
            label={t('event.endLabel')}
            value={draft.endsAt}
            onValueChange={(value) =>
              value && setDraft((current) => ({ ...current, endsAt: value }))
            }
            errorMessage={validation && !valid ? t('event.rangeError') : undefined}
          />
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <SelectField
            label={t('event.typeLabel')}
            value={draft.type}
            options={(['MEETING', 'REMINDER', 'OUT_OF_OFFICE', 'TASK'] as const).map((value) => ({
              value,
              label: t(`event.types.${value}`),
            }))}
            onValueChange={(value) => value && setDraft((current) => ({ ...current, type: value }))}
          />
          <SelectField
            label={t('event.importanceLabel')}
            value={draft.importance}
            options={(['LOW', 'NORMAL', 'HIGH'] as const).map((value) => ({
              value,
              label: t(`event.importance.${value}`),
            }))}
            onValueChange={(value) =>
              value && setDraft((current) => ({ ...current, importance: value }))
            }
          />
        </Stack>
        <FormField
          label={t('event.locationLabel')}
          value={draft.location}
          onChange={(change) =>
            setDraft((current) => ({ ...current, location: change.target.value }))
          }
          inputProps={{ maxLength: 240 }}
        />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <SelectField
            label={t('event.visibilityLabel')}
            value={draft.visibility}
            options={(['DEFAULT', 'PUBLIC', 'PRIVATE', 'CONFIDENTIAL'] as const).map((value) => ({
              value,
              label: t(`event.visibility.${value}`),
            }))}
            onValueChange={(value) =>
              value && setDraft((current) => ({ ...current, visibility: value }))
            }
          />
          <SelectField
            label={t('event.recurrenceLabel')}
            value={draft.recurrence}
            options={(['NONE', 'DAILY', 'WEEKLY', 'MONTHLY'] as const).map((value) => ({
              value,
              label: t(`event.recurrence.${value}`),
            }))}
            onValueChange={(value) =>
              value && setDraft((current) => ({ ...current, recurrence: value }))
            }
          />
        </Stack>
        {draft.recurrence !== 'NONE' && (
          <DatePickerField
            label={t('event.recurrenceUntilLabel')}
            value={draft.recurrenceUntil}
            onValueChange={(value) =>
              setDraft((current) => ({ ...current, recurrenceUntil: value ?? '' }))
            }
          />
        )}
        <FormControlLabel
          control={
            <Checkbox
              checked={draft.allDay}
              onChange={(change) =>
                setDraft((current) => ({ ...current, allDay: change.target.checked }))
              }
            />
          }
          label={t('event.allDay')}
        />
        <Alert severity="warning">
          <Typography fontWeight={600}>{t('company.publishReviewTitle')}</Typography>
          <Typography variant="body2" sx={{ mt: 0.35 }}>
            {t('company.publishReviewDescription')}
          </Typography>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1.25 }}>
            <Chip size="small" variant="outlined" label={t('company.publishAudience')} />
            <Chip
              size="small"
              variant="outlined"
              label={t('company.publishSchedule', {
                date: calendarDate(draft.startsAt, language),
                start: calendarTime(draft.startsAt, language),
                end: calendarTime(draft.endsAt, language),
                timeZone: draft.timeZone,
              })}
            />
          </Stack>
        </Alert>
        <FormControlLabel
          control={
            <Checkbox
              checked={reviewConfirmed}
              onChange={(change) => setReviewConfirmed(change.target.checked)}
            />
          }
          label={t('company.confirmCompanyAudience')}
        />
      </Stack>
    </FormDialog>
  );
}
